// ============================================================
// ADD2E — Auto-compatibilité race / classe au drop
// Branche dev-grosses-modifications
//
// Rôle :
// - intercepter uniquement les drops d'items race/classe ;
// - afficher un popup si la race/classe actuelle est incohérente ;
// - appliquer directement le choix validé, sans relancer l'ancien _onDrop ;
// - conserver les fonctions globales attendues par le code legacy.
// ============================================================

const ADD2E_RACE_CLASS_DROP_VERSION = "2026-05-18-dev-race-class-drop-direct-apply-v3";
globalThis.ADD2E_RACE_CLASS_DROP_VERSION = ADD2E_RACE_CLASS_DROP_VERSION;
console.log("[ADD2E][DROP][RACE_CLASSE][VERSION]", ADD2E_RACE_CLASS_DROP_VERSION);

const CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
const CARAC_SHORT = {
  force: "FOR",
  dexterite: "DEX",
  constitution: "CON",
  intelligence: "INT",
  sagesse: "SAG",
  charisme: "CHA"
};

// ============================================================
// Utilitaires
// ============================================================

function add2eDropDebugRaceClass(...args) {
  if (globalThis.ADD2E_DEBUG_RACE_CLASSE === true) console.log("[ADD2E][DROP][RACE_CLASSE]", ...args);
}

function add2eItemDataCloneForDrop(itemLike) {
  if (!itemLike) return null;
  const data = typeof itemLike.toObject === "function" ? itemLike.toObject() : add2eDeepClone(itemLike);
  if (!data || typeof data !== "object") return null;
  delete data._id;
  delete data._stats;
  return data;
}

function add2eWorldItemsByType(type) {
  const wanted = String(type ?? "").toLowerCase();
  return Array.from(game?.items ?? [])
    .filter(i => String(i?.type ?? "").toLowerCase() === wanted)
    .map(i => add2eItemDataCloneForDrop(i))
    .filter(Boolean);
}

function add2eRaceCandidateLabel(raceData) {
  return String(raceData?.name ?? raceData?.system?.label ?? raceData?.system?.nom ?? "Race").trim() || "Race";
}

function add2eClassCandidateLabel(classData) {
  return String(classData?.name ?? classData?.system?.label ?? classData?.system?.nom ?? "Classe").trim() || "Classe";
}

function add2eClassRuleSystem(classeItem) {
  return classeItem?.system ?? classeItem ?? {};
}

function add2eNormalizeDropTag(value) {
  if (typeof add2eNormalizeEquipTag === "function") return add2eNormalizeEquipTag(value);
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[_\s-]+/g, "_");
}

function add2eToDropArray(value) {
  if (typeof add2eToEquipArray === "function") return add2eToEquipArray(value);
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") return value.split(/[,;\n]+/).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") return Object.values(value).filter(Boolean);
  return [];
}

function add2eRaceTagsFromDataSafe(raceData) {
  if (typeof add2eRaceTagsFromData === "function") return add2eRaceTagsFromData(raceData);
  const sys = raceData?.system ?? {};
  const base = add2eNormalizeDropTag(raceData?.name ?? sys.slug ?? sys.label ?? sys.name ?? sys.nom ?? "");
  const tags = [
    ...add2eToDropArray(sys.identityTags),
    ...add2eToDropArray(sys.raceTags),
    ...add2eToDropArray(sys.tags),
    ...(base ? [`race:${base}`, base] : [])
  ];
  return [...new Set(tags.map(add2eNormalizeDropTag).filter(Boolean))];
}

function add2eRaceMatchesClassRules(raceData, classData) {
  const cls = add2eClassRuleSystem(classData);
  const rules = cls?.raceRestriction?.races;
  if (!rules || typeof rules !== "object" || !Object.keys(rules).length) return true;

  const raceTags = add2eRaceTagsFromDataSafe(raceData).map(add2eNormalizeDropTag);
  const normalizedRules = {};
  for (const [tag, rule] of Object.entries(rules)) normalizedRules[add2eNormalizeDropTag(tag)] = rule;

  const matched = raceTags.find(t => Object.prototype.hasOwnProperty.call(normalizedRules, t));
  if (!matched) return false;
  return normalizedRules[matched]?.allowed === true;
}

function add2ePickClassAlignmentSafe(actor, classData) {
  try {
    if (typeof add2ePickClassAlignment === "function") return add2ePickClassAlignment(actor, classData?.system ?? classData ?? {});
  } catch (e) {
    console.warn("[ADD2E][DROP][RACE_CLASSE] add2ePickClassAlignment indisponible.", e);
  }
  return actor?.system?.alignement ?? "";
}

function add2eGetDialogRoot(html) {
  if (html?.querySelector) return html;
  if (html?.jquery && html[0]?.querySelector) return html[0];
  if (html?.[0]?.querySelector) return html[0];
  return null;
}

function add2eReadDialogSelect(html, selector, fallback = 0) {
  const root = add2eGetDialogRoot(html);
  const direct = root?.querySelector?.(selector)?.value;
  if (direct !== undefined && direct !== null && direct !== "") return Number(direct);

  try {
    if (typeof html?.find === "function") {
      const jq = html.find(selector);
      const v = jq?.val?.();
      if (v !== undefined && v !== null && v !== "") return Number(v);
    }
  } catch (_e) {}

  return Number(fallback);
}

async function add2eDropDialog(content, buttons, title = "Compatibilité du personnage") {
  return new Promise(resolve => {
    let resolved = false;
    const close = value => {
      if (resolved) return;
      resolved = true;
      console.log("[ADD2E][DROP][RACE_CLASSE][DIALOG_RESULT]", value);
      resolve(value ?? null);
    };

    const wrappedButtons = {};
    for (const [key, button] of Object.entries(buttons ?? {})) {
      wrappedButtons[key] = {
        ...button,
        callback: html => {
          try {
            const value = typeof button.callback === "function" ? button.callback(html) : null;
            close(value);
            return value;
          } catch (e) {
            console.error("[ADD2E][DROP][RACE_CLASSE][DIALOG_ERROR]", e);
            close(null);
            return null;
          }
        }
      };
    }

    new Dialog({
      title,
      content,
      buttons: wrappedButtons,
      close: () => close(null)
    }, { width: 560 }).render(true);
  });
}

// ============================================================
// Validation prérequis classe
// ============================================================

function checkClassStatMin(actor, classeItem, candidateRaceData = null, candidateAlignment = null, options = {}) {
  const silent = options?.silent === true;
  const ignoreLevelMax = options?.ignoreLevelMax === true;
  const classeSystem = add2eClassRuleSystem(classeItem);
  const actorSystem = actor?.system ?? {};
  const manques = [];

  const raceItems = actor?.items?.filter?.(i => String(i.type || "").toLowerCase() === "race") ?? [];
  const wantedRace = add2eNormalizeDropTag(
    actorSystem.race ||
    actorSystem.details_race?.label ||
    actorSystem.details_race?.name ||
    actorSystem.details_race?.nom ||
    ""
  );

  const matchedRaceItem = wantedRace
    ? raceItems.find(r => {
        const sys = r.system ?? {};
        return [r.id, r.name, sys.slug, sys.label, sys.name, sys.nom].map(add2eNormalizeDropTag).includes(wantedRace);
      })
    : null;

  const actorRaceFallback = wantedRace
    ? {
        name: actorSystem.race || actorSystem.details_race?.label || actorSystem.details_race?.name || actorSystem.details_race?.nom || wantedRace,
        system: {
          ...(actorSystem.details_race ?? {}),
          slug: actorSystem.details_race?.slug || wantedRace,
          tags: add2eToDropArray(actorSystem.details_race?.tags).length ? actorSystem.details_race.tags : [`race:${wantedRace}`],
          identityTags: add2eToDropArray(actorSystem.details_race?.identityTags).length ? actorSystem.details_race.identityTags : [`race:${wantedRace}`],
          bonus_caracteristiques: actorSystem.bonus_caracteristiques ?? actorSystem.details_race?.bonus_caracteristiques ?? {}
        }
      }
    : null;

  const raceData = candidateRaceData ?? matchedRaceItem ?? actorRaceFallback ?? raceItems[0] ?? null;
  const raceTags = add2eRaceTagsFromDataSafe(raceData);
  const actorLevel = Number(actorSystem.niveau ?? 1) || 1;
  const candidateRaceBonus = candidateRaceData?.system?.bonus_caracteristiques ?? null;
  const currentRaceBonus = actorSystem.bonus_caracteristiques ?? {};

  const caracTotal = carac => {
    const base = Number(actorSystem[`${carac}_base`] ?? actorSystem[carac] ?? 10) || 10;
    const race = Number((candidateRaceBonus ?? currentRaceBonus)?.[carac] ?? actorSystem[`${carac}_race`] ?? 0) || 0;
    return base + race;
  };

  const races = classeSystem.raceRestriction?.races;
  const hasRaceRestriction = races && typeof races === "object" && Object.keys(races).length > 0;

  if (hasRaceRestriction) {
    if (!raceData) {
      manques.push("race requise pour vérifier la compatibilité de classe");
    } else {
      const normalizedRules = {};
      for (const [tag, rule] of Object.entries(races)) normalizedRules[add2eNormalizeDropTag(tag)] = rule;
      const matchedTag = raceTags.find(tag => Object.prototype.hasOwnProperty.call(normalizedRules, tag));

      if (!matchedTag) {
        manques.push(`race non autorisée (${raceTags.join(", ") || "aucun tag race:*"})`);
      } else {
        const rule = normalizedRules[matchedTag] ?? {};
        if (rule.allowed !== true) manques.push(`race interdite (${matchedTag})`);
        const maxLevel = Number(rule.maxLevel ?? rule.niveauMax ?? rule.max);
        if (!ignoreLevelMax && Number.isFinite(maxLevel) && maxLevel > 0 && actorLevel > maxLevel) manques.push(`${matchedTag} limité au niveau ${maxLevel}`);
      }
    }
  } else if (raceData) {
    const legacyAllowed = add2eToDropArray(classeSystem.raceAllowed).map(add2eNormalizeDropTag).filter(Boolean);
    if (legacyAllowed.length) {
      const matchedLegacy = raceTags.some(t => legacyAllowed.includes(t.replace(/^race:/, "")) || legacyAllowed.includes(t));
      if (!matchedLegacy) manques.push(`race non autorisée (${raceTags.join(", ") || "aucun tag race:*"})`);
    }
  }

  const min = classeSystem.caracs_min || {};
  for (const [carac, rawMin] of Object.entries(min)) {
    const minVal = Number(rawMin);
    if (!Number.isFinite(minVal)) continue;
    const total = caracTotal(carac);
    if (total < minVal) manques.push(`${carac} ${total} < ${minVal}`);
  }

  const allowedAlignments = typeof add2eClassAllowedAlignments === "function" ? add2eClassAllowedAlignments(classeSystem) : [];
  const currentAlignmentRaw = candidateAlignment ?? actorSystem.alignement ?? "";
  const currentAlignment = add2eNormalizeDropTag(currentAlignmentRaw);
  if (allowedAlignments.length) {
    const allowedNorm = allowedAlignments.map(add2eNormalizeDropTag);
    if (!currentAlignment || !allowedNorm.includes(currentAlignment)) manques.push(`alignement requis : ${allowedAlignments.join(" ou ")}`);
  }

  const requirementTags = add2eToDropArray(classeSystem.requirementTags).map(add2eNormalizeDropTag).filter(Boolean);
  const allowedAlignmentTags = [];
  const forbiddenAlignmentTags = [];

  for (const tag of requirementTags) {
    const parts = tag.split(":");
    if (parts[0] !== "prerequis" || parts[1] !== "alignement") continue;
    const mode = parts[2];
    const wanted = add2eNormalizeDropTag(parts.slice(3).join(":"));
    if (!wanted) continue;
    if (mode === "allow") allowedAlignmentTags.push(wanted);
    if (mode === "not") forbiddenAlignmentTags.push(wanted);
  }

  if (currentAlignment) {
    const forbiddenMatch = forbiddenAlignmentTags.find(a => currentAlignment === a);
    if (forbiddenMatch) manques.push(`alignement interdit : ${currentAlignmentRaw || actorSystem.alignement}`);
    const uniqueAllowedAlignments = [...new Set(allowedAlignmentTags)];
    if (uniqueAllowedAlignments.length && !uniqueAllowedAlignments.includes(currentAlignment)) manques.push(`alignement requis : ${uniqueAllowedAlignments.join(" ou ")}`);
  }

  for (const tag of requirementTags) {
    const parts = tag.split(":");
    if (parts[0] !== "prerequis") continue;
    if (parts[1] === "alignement") continue;

    if (parts[1] === "caracteristique") {
      const carac = parts[2];
      const op = parts[3];
      const target = Number(parts[4]);
      if (!carac || !Number.isFinite(target)) continue;
      const total = caracTotal(carac);
      if (op === "min" && total < target) manques.push(`${carac} ${total} < ${target}`);
      if (op === "max" && total > target) manques.push(`${carac} ${total} > ${target}`);
    }

    if (parts[1] === "niveau") {
      const op = parts[2];
      const target = Number(parts[3]);
      if (!Number.isFinite(target)) continue;
      if (op === "min" && actorLevel < target) manques.push(`niveau ${actorLevel} < ${target}`);
      if (op === "max" && actorLevel > target && !ignoreLevelMax) manques.push(`niveau ${actorLevel} > ${target}`);
    }

    if (parts[1] === "tag") {
      const mode = parts[2];
      const wanted = add2eNormalizeDropTag(parts.slice(3).join(":"));
      if (!wanted) continue;
      const activeTags = typeof Add2eEffectsEngine !== "undefined" ? Add2eEffectsEngine.getActiveTags(actor) : [];
      const has = activeTags.map(add2eNormalizeDropTag).includes(wanted);
      if (mode === "required" && !has) manques.push(`tag requis absent : ${wanted}`);
      if (mode === "forbidden" && has) manques.push(`tag interdit présent : ${wanted}`);
    }
  }

  if (manques.length) {
    if (!silent) {
      ui.notifications.warn(`Prérequis insuffisants pour la classe "${classeItem.name}" (${manques.join(", ")})`);
      console.warn("[ADD2E][DROP][RACE_CLASSE][REFUS_PREREQUIS]", {
        actor: actor?.name,
        classe: classeItem?.name,
        race: raceData?.name ?? null,
        raceTags,
        alignementTeste: currentAlignmentRaw,
        manques
      });
    }
    return false;
  }

  return true;
}

// ============================================================
// Recherche de candidats
// ============================================================

const ADD2E_DROP_COMPAT_CHOICES = new Map();

function add2eDropChoiceKey(actor, kind, itemData) {
  return [actor?.uuid ?? actor?.id ?? "actor", kind, add2eNormalizeDropTag(itemData?.name ?? itemData?.system?.slug ?? "")].join("|");
}

function add2eDropQueueChoice(actor, kind, itemData, value) {
  ADD2E_DROP_COMPAT_CHOICES.set(add2eDropChoiceKey(actor, kind, itemData), value);
}

function add2eDropConsumeQueuedChoice(actor, kind, itemData) {
  const key = add2eDropChoiceKey(actor, kind, itemData);
  const value = ADD2E_DROP_COMPAT_CHOICES.get(key);
  if (value) ADD2E_DROP_COMPAT_CHOICES.delete(key);
  return value ?? null;
}

function add2eFindCompatibleRaceForClass(actor, classData, alignmentCandidate = null) {
  const queued = add2eDropConsumeQueuedChoice(actor, "race", classData);
  if (queued) return queued;

  const currentRaces = (actor?.items?.filter?.(i => String(i.type).toLowerCase() === "race") ?? [])
    .map(i => add2eItemDataCloneForDrop(i))
    .filter(Boolean);

  const candidates = [...currentRaces, ...add2eWorldItemsByType("race")];
  const seen = new Set();

  for (const raceData of candidates) {
    const key = add2eNormalizeDropTag(raceData?.name ?? raceData?.system?.slug ?? raceData?.system?.label ?? "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (!add2eRaceMatchesClassRules(raceData, classData)) continue;
    if (checkClassStatMin(actor, classData, raceData, alignmentCandidate, { silent: true, ignoreLevelMax: true })) return raceData;
  }

  return null;
}

function add2eFindCompatibleClassForRace(actor, raceData) {
  const queued = add2eDropConsumeQueuedChoice(actor, "classe", raceData);
  if (queued?.classData) return queued;

  const currentClasses = (actor?.items?.filter?.(i => String(i.type).toLowerCase() === "classe") ?? [])
    .map(i => add2eItemDataCloneForDrop(i))
    .filter(Boolean);

  const candidates = [...currentClasses, ...add2eWorldItemsByType("classe")];
  const seen = new Set();

  for (const classData of candidates) {
    const key = add2eNormalizeDropTag(classData?.name ?? classData?.system?.slug ?? classData?.system?.label ?? "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (!add2eRaceMatchesClassRules(raceData, classData)) continue;
    const alignmentCandidate = add2ePickClassAlignmentSafe(actor, classData);
    if (checkClassStatMin(actor, classData, raceData, alignmentCandidate, { silent: true, ignoreLevelMax: true })) return { classData, alignmentCandidate };
  }

  return null;
}

function add2eDropCompatibleRaceCandidates(actor, classData) {
  const currentRace = actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "race");
  const candidates = [...(currentRace ? [add2eItemDataCloneForDrop(currentRace)] : []), ...add2eWorldItemsByType("race")];
  const seen = new Set();

  return candidates.filter(raceData => {
    const key = add2eNormalizeDropTag(raceData?.name ?? raceData?.system?.slug ?? raceData?.system?.label ?? "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return add2eRaceMatchesClassRules(raceData, classData);
  });
}

function add2eDropCompatibleClassCandidates(actor, raceData) {
  const currentClass = actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "classe");
  const candidates = [...(currentClass ? [add2eItemDataCloneForDrop(currentClass)] : []), ...add2eWorldItemsByType("classe")];
  const seen = new Set();

  return candidates.filter(classData => {
    const key = add2eNormalizeDropTag(classData?.name ?? classData?.system?.slug ?? classData?.system?.label ?? "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return add2eRaceMatchesClassRules(raceData, classData);
  }).map(classData => ({ classData, alignmentCandidate: add2ePickClassAlignmentSafe(actor, classData) }));
}

function add2eDropCurrentClassLevelMax(actor, classData, raceData = null) {
  const cls = add2eClassRuleSystem(classData);
  const raceTags = add2eRaceTagsFromDataSafe(raceData).map(add2eNormalizeDropTag);
  const races = cls?.raceRestriction?.races ?? {};
  let max = 0;

  for (const [tag, rule] of Object.entries(races)) {
    if (!raceTags.includes(add2eNormalizeDropTag(tag))) continue;
    const n = Number(rule?.maxLevel ?? rule?.niveauMax ?? rule?.max ?? 0);
    if (Number.isFinite(n) && n > 0) max = max ? Math.min(max, n) : n;
  }

  return max;
}

// ============================================================
// Application directe race / classe
// ============================================================

async function add2eApplyRaceItemDataToActor(actor, raceData, sheet = null, options = {}) {
  if (!actor || !raceData || raceData.type !== "race") return null;

  const data = add2eItemDataCloneForDrop(raceData);
  data.type = "race";

  const existingRaces = actor.items.filter(i => String(i.type || "").toLowerCase() === "race");
  for (const oldRace of existingRaces) {
    const raceEffects = actor.effects.filter(eff => eff.origin === oldRace.uuid);
    if (raceEffects.length) {
      const ids = raceEffects.map(e => e.id).filter(id => actor.effects.has(id));
      if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids, { add2eInternal: true });
    }
    await oldRace.delete({ render: false });
  }

  await actor.update({ "system.bonus_caracteristiques": {} }, { add2eInternal: true });

  const [raceDoc] = await actor.createEmbeddedDocuments("Item", [data], { add2eInternal: true });
  if (!raceDoc) return null;

  if (raceDoc.effects.contents?.length) {
    const actorEffects = raceDoc.effects.contents.map(eff => {
      const effectData = foundry.utils.duplicate(eff.toObject());
      effectData.origin = raceDoc.uuid;
      effectData.disabled = false;
      effectData.transfer = false;
      effectData.flags = effectData.flags ?? {};
      effectData.flags.add2e = {
        ...(effectData.flags.add2e ?? {}),
        sourceType: "race",
        sourceItemId: raceDoc.id,
        sourceItemUuid: raceDoc.uuid
      };
      return effectData;
    });
    if (actorEffects.length) await actor.createEmbeddedDocuments("ActiveEffect", actorEffects, { add2eInternal: true });
  }

  const raceSystem = foundry.utils.deepClone(raceDoc.system ?? {});
  await actor.update({
    "system.race": raceDoc.name,
    "system.details_race": {
      ...raceSystem,
      name: raceDoc.name,
      label: raceSystem.label || raceDoc.name,
      img: raceDoc.img || raceSystem.img || ""
    },
    "system.bonus_caracteristiques": raceSystem.bonus_caracteristiques ? foundry.utils.deepClone(raceSystem.bonus_caracteristiques) : {}
  }, { add2eInternal: true });

  if (typeof sheet?.autoSetCaracAjustements === "function") await sheet.autoSetCaracAjustements();
  if (options.notify !== false) ui.notifications.info(`Race ajustée automatiquement : ${raceDoc.name}.`);

  return raceDoc;
}

async function add2eApplyClassItemDataToActor(actor, classData, sheet = null, options = {}) {
  if (!actor || !classData || classData.type !== "classe") return null;

  const data = add2eItemDataCloneForDrop(classData);
  data.type = "classe";
  const alignmentCandidate = options.alignmentCandidate ?? add2ePickClassAlignmentSafe(actor, data);

  const typesToDelete = ["classe", "sort", "arme", "armure", "spell", "weapon", "armor"];
  const itemsToDelete = actor.items.filter(i => typesToDelete.includes(String(i.type || "").toLowerCase()));
  const effectsToDelete = typeof add2eShouldDeleteEffectForClassPurge === "function"
    ? actor.effects.filter(eff => add2eShouldDeleteEffectForClassPurge(eff, itemsToDelete))
    : [];

  for (const eff of effectsToDelete) await eff.delete({ render: false });
  for (const it of itemsToDelete) await it.delete({ render: false });

  const [classDoc] = await actor.createEmbeddedDocuments("Item", [data], { add2eInternal: true });
  if (!classDoc) return null;

  if (classDoc.effects.contents?.length) {
    const actorEffects = classDoc.effects.contents.map(eff => {
      const effectData = foundry.utils.duplicate(eff.toObject());
      effectData.origin = classDoc.uuid;
      effectData.disabled = false;
      effectData.transfer = false;
      effectData.flags = effectData.flags ?? {};
      effectData.flags.add2e = {
        ...(effectData.flags.add2e ?? {}),
        sourceType: "classe",
        sourceClasse: classDoc.name,
        sourceItemId: classDoc.id,
        sourceItemUuid: classDoc.uuid
      };
      return effectData;
    });
    if (actorEffects.length) await actor.createEmbeddedDocuments("ActiveEffect", actorEffects, { add2eInternal: true });
  }

  const classSystem = foundry.utils.deepClone(classDoc.system ?? {});
  const levelClamp = typeof add2eClampLevelToClassMax === "function"
    ? add2eClampLevelToClassMax(actor, actor.system?.niveau, classSystem, { notify: true })
    : { changed: false, level: actor.system?.niveau };
  const alns = typeof add2eClassAllowedAlignments === "function" ? add2eClassAllowedAlignments(classSystem) : [];

  const updates = {
    "system.classe": classDoc.name,
    "system.details_classe": classSystem,
    "system.spellcasting": classSystem.spellcasting ?? null,
    "system.alignements_autorises": alns
  };

  if (levelClamp.changed) updates["system.niveau"] = levelClamp.level;
  if (alignmentCandidate) updates["system.alignement"] = alignmentCandidate;
  if (classDoc.system?.progression?.[0]?.sauvegardes) updates["system.sauvegardes"] = foundry.utils.duplicate(classDoc.system.progression[0].sauvegardes);

  await actor.update(updates, { add2eInternal: true });

  if (typeof sheet?.autoSetCaracAjustements === "function") await sheet.autoSetCaracAjustements();
  if (typeof sheet?.autoSetPointsDeCoup === "function") await sheet.autoSetPointsDeCoup({ syncCurrent: true, force: true, reason: options.reason || "auto-class-compat" });

  try { if (typeof add2eSyncMonkUnarmedWeapon === "function") await add2eSyncMonkUnarmedWeapon(actor); }
  catch (e) { console.warn("[ADD2E][MOINE] Erreur synchronisation Main nue après changement auto classe :", e); }

  try { if (typeof add2eSyncClassPassiveEffect === "function") await add2eSyncClassPassiveEffect(actor); }
  catch (e) { console.warn("[ADD2E][CLASSE][EFFETS] Erreur effets classe après changement auto classe :", e); }

  try {
    if (typeof add2eSyncActorSpellsFromClass === "function") {
      const spellSync = await add2eSyncActorSpellsFromClass(actor, classDoc, { mode: "replace", showWait: true });
      if (spellSync?.handled) ui.notifications.info(`Sorts de ${classDoc.name} synchronisés : ${spellSync.imported} importé(s).`);
    }
  } catch (e) {
    console.error("[ADD2E][CLASSE][SORTS] Erreur synchronisation sorts après changement auto classe :", e);
    ui.notifications.error("Erreur pendant la synchronisation des sorts de classe.");
  }

  if (options.notify !== false) ui.notifications.info(`Classe ajustée automatiquement : ${classDoc.name}.`);
  return classDoc;
}

// ============================================================
// Popups
// ============================================================

async function add2eDropShowClassIncompatPopup(actor, classData) {
  const raceCandidates = add2eDropCompatibleRaceCandidates(actor, classData);
  const currentRace = actor?.system?.race || actor?.items?.find?.(i => i.type === "race")?.name || "Aucune";
  const actorLevel = Number(actor?.system?.niveau ?? 1) || 1;

  const options = raceCandidates.map((race, index) => {
    const max = add2eDropCurrentClassLevelMax(actor, classData, race);
    const maxTxt = max ? ` — niveau max ${max}` : "";
    return `<option value="${index}">${add2eRaceCandidateLabel(race)}${maxTxt}</option>`;
  }).join("");

  const content = `
    <form class="add2e-drop-compat-dialog" style="line-height:1.45;">
      <p><b>Incohérence détectée</b></p>
      <p>Classe déposée : <b>${add2eClassCandidateLabel(classData)}</b></p>
      <p>Race actuelle : <b>${currentRace}</b> — Niveau actuel : <b>${actorLevel}</b></p>
      <p>Choisis une race compatible avec la classe déposée.</p>
      ${raceCandidates.length ? `<div class="form-group"><label>Race compatible</label><select name="raceChoice">${options}</select></div>` : `<p style="color:#9b1c1c;font-weight:700;">Aucune race compatible trouvée dans les items monde.</p>`}
      <p style="font-size:0.9em;color:#6b5a2a;">Si la race sélectionnée limite le niveau maximum, le niveau sera ramené automatiquement au maximum autorisé.</p>
    </form>
  `;

  if (!raceCandidates.length) return { action: "cancel" };

  return add2eDropDialog(content, {
    apply: {
      label: "Appliquer ce choix",
      callback: html => {
        const idx = add2eReadDialogSelect(html, '[name="raceChoice"]', 0);
        return { action: "apply", raceData: raceCandidates[idx] ?? null };
      }
    },
    cancel: { label: "Annuler le drop", callback: () => ({ action: "cancel" }) }
  });
}

async function add2eDropShowRaceIncompatPopup(actor, raceData) {
  const classCandidates = add2eDropCompatibleClassCandidates(actor, raceData);
  const currentClass = actor?.system?.classe || actor?.items?.find?.(i => i.type === "classe")?.name || "Aucune";
  const actorLevel = Number(actor?.system?.niveau ?? 1) || 1;

  const options = classCandidates.map((entry, index) => {
    const max = add2eDropCurrentClassLevelMax(actor, entry.classData, raceData);
    const maxTxt = max ? ` — niveau max ${max}` : "";
    return `<option value="${index}">${add2eClassCandidateLabel(entry.classData)}${maxTxt}</option>`;
  }).join("");

  const content = `
    <form class="add2e-drop-compat-dialog" style="line-height:1.45;">
      <p><b>Incohérence détectée</b></p>
      <p>Race déposée : <b>${add2eRaceCandidateLabel(raceData)}</b></p>
      <p>Classe actuelle : <b>${currentClass}</b> — Niveau actuel : <b>${actorLevel}</b></p>
      <p>Choisis une classe compatible avec la race déposée.</p>
      ${classCandidates.length ? `<div class="form-group"><label>Classe compatible</label><select name="classChoice">${options}</select></div>` : `<p style="color:#9b1c1c;font-weight:700;">Aucune classe compatible trouvée dans les items monde.</p>`}
      <p style="font-size:0.9em;color:#6b5a2a;">Si la classe/race sélectionnée limite le niveau maximum, le niveau sera ramené automatiquement au maximum autorisé.</p>
    </form>
  `;

  if (!classCandidates.length) return { action: "cancel" };

  return add2eDropDialog(content, {
    apply: {
      label: "Appliquer ce choix",
      callback: html => {
        const idx = add2eReadDialogSelect(html, '[name="classChoice"]', 0);
        return { action: "apply", ...(classCandidates[idx] ?? {}) };
      }
    },
    cancel: { label: "Annuler le drop", callback: () => ({ action: "cancel" }) }
  });
}

async function add2eDropShowPrereqRefusal(actor, classData, raceData = null, alignmentCandidate = null) {
  checkClassStatMin(actor, classData, raceData, alignmentCandidate, { silent: false, ignoreLevelMax: true });
  return add2eDropDialog(`
    <div style="line-height:1.45;">
      <p><b>Drop refusé : prérequis de classe non respectés.</b></p>
      <p>Classe : <b>${add2eClassCandidateLabel(classData)}</b></p>
      <p>Race testée : <b>${raceData ? add2eRaceCandidateLabel(raceData) : "Race actuelle"}</b></p>
      <p>Les caractéristiques, l'alignement, le niveau ou les tags requis ne permettent pas cette combinaison.</p>
      <p>Le détail exact est écrit dans la console sous <code>[ADD2E][DROP][RACE_CLASSE][REFUS_PREREQUIS]</code>.</p>
    </div>
  `, {
    ok: { label: "Compris", callback: () => ({ action: "cancel" }) }
  }, "ADD2E — Drop refusé");
}

// ============================================================
// Résolution et wrapper
// ============================================================

async function add2eResolveDropCompatibilityWithPopup(actor, itemData, sheet = null) {
  if (!actor || !itemData || !["classe", "race"].includes(itemData.type)) return { ok: true, handled: false };

  console.log("[ADD2E][DROP][RACE_CLASSE][RESOLVE]", {
    version: ADD2E_RACE_CLASS_DROP_VERSION,
    actor: actor.name,
    item: itemData.name,
    type: itemData.type
  });

  if (itemData.type === "classe") {
    const alignmentCandidate = add2ePickClassAlignmentSafe(actor, itemData);
    const currentOk = checkClassStatMin(actor, itemData, null, alignmentCandidate, { silent: true, ignoreLevelMax: true });
    if (currentOk) return { ok: true, handled: false };

    const choice = await add2eDropShowClassIncompatPopup(actor, itemData);
    if (!choice || choice.action !== "apply" || !choice.raceData) return { ok: false, handled: true };

    if (!checkClassStatMin(actor, itemData, choice.raceData, alignmentCandidate, { silent: true, ignoreLevelMax: true })) {
      await add2eDropShowPrereqRefusal(actor, itemData, choice.raceData, alignmentCandidate);
      return { ok: false, handled: true };
    }

    await add2eApplyRaceItemDataToActor(actor, choice.raceData, sheet, { notify: true });
    await add2eApplyClassItemDataToActor(actor, itemData, sheet, { alignmentCandidate, notify: true, reason: "drop-classe-popup" });
    return { ok: true, handled: true };
  }

  if (itemData.type === "race") {
    const existingClass = actor.items?.find?.(i => String(i.type || "").toLowerCase() === "classe");
    if (!existingClass) return { ok: true, handled: false };

    const existingClassData = add2eItemDataCloneForDrop(existingClass);
    const alignmentCandidate = add2ePickClassAlignmentSafe(actor, existingClassData);
    const currentOk = checkClassStatMin(actor, existingClassData, itemData, alignmentCandidate, { silent: true, ignoreLevelMax: true });
    if (currentOk) return { ok: true, handled: false };

    const choice = await add2eDropShowRaceIncompatPopup(actor, itemData);
    if (!choice || choice.action !== "apply" || !choice.classData) return { ok: false, handled: true };

    const chosenAlignment = choice.alignmentCandidate ?? add2ePickClassAlignmentSafe(actor, choice.classData);
    if (!checkClassStatMin(actor, choice.classData, itemData, chosenAlignment, { silent: true, ignoreLevelMax: true })) {
      await add2eDropShowPrereqRefusal(actor, choice.classData, itemData, chosenAlignment);
      return { ok: false, handled: true };
    }

    await add2eApplyRaceItemDataToActor(actor, itemData, sheet, { notify: true });
    await add2eApplyClassItemDataToActor(actor, choice.classData, sheet, { alignmentCandidate: chosenAlignment, notify: true, reason: "drop-race-popup" });
    return { ok: true, handled: true };
  }

  return { ok: true, handled: false };
}

function add2eInstallDropCompatibilityPopupWrapper() {
  const SheetClass = globalThis.Add2eActorSheet;
  if (!SheetClass?.prototype?._onDrop) return false;
  if (SheetClass.prototype._add2eDropCompatPopupWrapped) return true;

  const original = SheetClass.prototype._onDrop;
  SheetClass.prototype._onDrop = async function add2eDropCompatPopupWrapped(event) {
    console.log("[ADD2E][DROP][RACE_CLASSE][VERSION]", ADD2E_RACE_CLASS_DROP_VERSION);

    let raw = null;
    let itemData = null;

    try {
      raw = JSON.parse(event.dataTransfer?.getData("text/plain") || "{}");
      if (raw?.type === "Item") {
        itemData = raw.data ?? null;
        if (!itemData && raw.uuid) {
          const doc = await fromUuid(raw.uuid);
          if (doc instanceof Item) itemData = doc.toObject();
        }
        if (!itemData && raw.pack && raw.id) {
          const pack = game.packs.get(raw.pack);
          const ent = pack && await pack.getDocument(raw.id);
          if (ent instanceof Item) itemData = ent.toObject();
        }
      }
    } catch (e) {
      console.warn("[ADD2E][DROP][RACE_CLASSE] Impossible de lire les données de drop.", e);
    }

    if (itemData && ["classe", "race"].includes(itemData.type)) {
      const resolved = await add2eResolveDropCompatibilityWithPopup(this.actor, itemData, this);
      console.log("[ADD2E][DROP][RACE_CLASSE][RESOLVED]", resolved);

      if (!resolved.ok) {
        event.preventDefault();
        event.stopPropagation();
        ui.notifications.info("Drop annulé.");
        return false;
      }

      if (resolved.handled) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    }

    return original.call(this, event);
  };

  SheetClass.prototype._add2eDropCompatPopupWrapped = true;
  console.log("[ADD2E][DROP][POPUP] Wrapper compatibilité race/classe/niveau installé.", ADD2E_RACE_CLASS_DROP_VERSION);
  return true;
}

Hooks.once("ready", () => {
  if (!add2eInstallDropCompatibilityPopupWrapper()) {
    setTimeout(add2eInstallDropCompatibilityPopupWrapper, 250);
    setTimeout(add2eInstallDropCompatibilityPopupWrapper, 1000);
  }
});

// ============================================================
// Exposition globale conservée
// ============================================================

try { globalThis.add2eDropDebugRaceClass = add2eDropDebugRaceClass; } catch (_e) {}
try { globalThis.add2eItemDataCloneForDrop = add2eItemDataCloneForDrop; } catch (_e) {}
try { globalThis.add2eWorldItemsByType = add2eWorldItemsByType; } catch (_e) {}
try { globalThis.add2eRaceCandidateLabel = add2eRaceCandidateLabel; } catch (_e) {}
try { globalThis.add2eClassCandidateLabel = add2eClassCandidateLabel; } catch (_e) {}
try { globalThis.add2eRaceMatchesClassRules = add2eRaceMatchesClassRules; } catch (_e) {}
try { globalThis.add2eFindCompatibleRaceForClass = add2eFindCompatibleRaceForClass; } catch (_e) {}
try { globalThis.add2eFindCompatibleClassForRace = add2eFindCompatibleClassForRace; } catch (_e) {}
try { globalThis.add2eApplyRaceItemDataToActor = add2eApplyRaceItemDataToActor; } catch (_e) {}
try { globalThis.add2eApplyClassItemDataToActor = add2eApplyClassItemDataToActor; } catch (_e) {}
try { globalThis.checkClassStatMin = checkClassStatMin; } catch (_e) {}
try { globalThis.CARACS = CARACS; } catch (_e) {}
try { globalThis.CARAC_SHORT = CARAC_SHORT; } catch (_e) {}
try { globalThis.add2eResolveDropCompatibilityWithPopup = add2eResolveDropCompatibilityWithPopup; } catch (_e) {}
try { globalThis.add2eInstallDropCompatibilityPopupWrapper = add2eInstallDropCompatibilityPopupWrapper; } catch (_e) {}
try { globalThis.ADD2E_RACE_CLASS_DROP_VERSION = ADD2E_RACE_CLASS_DROP_VERSION; } catch (_e) {}
