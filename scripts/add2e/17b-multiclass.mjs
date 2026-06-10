// ADD2E — Multiclassage propre
// Version : 2026-06-10-multiclass-layer-v1
//
// Objectif :
// - préserver le fonctionnement mono-classe existant ;
// - ajouter une couche structurée pour les personnages multiclassés ;
// - ne pas modifier les JSON de races ;
// - s'appuyer sur les données de race déjà corrigées pour déterminer les combinaisons autorisées ;
// - rester compatible Foundry V13/V14/V15 avec ApplicationV2/DialogV2.

const VERSION = "2026-06-10-multiclass-layer-v1";
const TAG = "[ADD2E][MULTICLASSE]";
const SCOPE = "add2e";
const INTERNAL = "add2eMulticlassInternal";

globalThis.ADD2E_MULTICLASS_VERSION = VERSION;

function log(label, data = {}) {
  console.log(`${TAG}${label}`, data);
}

function warn(label, data = {}) {
  console.warn(`${TAG}${label}`, data);
}

function num(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value && typeof value === "object") {
    for (const key of ["value", "valeur", "total", "current", "actuel", "base", "max", "niveau", "level", "xp"]) {
      if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "object") return num(value[key], fallback);
    }
    return fallback;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number(raw.replace(/\s+/g, "").replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.+\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(toArray).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n/]+/).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") return Object.values(value).flatMap(toArray).filter(Boolean);
  return [value];
}

function classSlugFromData(data) {
  const sys = data?.system ?? data ?? {};
  return norm(sys.slug ?? sys.label ?? sys.nom ?? sys.name ?? data?.name ?? "classe");
}

function classLabelFromData(data) {
  const sys = data?.system ?? data ?? {};
  return String(data?.name ?? sys.label ?? sys.nom ?? sys.name ?? "Classe").trim() || "Classe";
}

function itemObjectWithoutRuntime(itemLike) {
  const data = typeof itemLike?.toObject === "function" ? itemLike.toObject() : foundry.utils.deepClone(itemLike ?? {});
  if (!data || typeof data !== "object") return null;
  delete data._id;
  delete data._stats;
  return data;
}

function raceItem(actor) {
  return actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "race") ?? null;
}

function classItems(actor) {
  return (actor?.items?.contents ?? Array.from(actor?.items ?? []))
    .filter(i => String(i.type || "").toLowerCase() === "classe");
}

function systemRace(actor, candidateRaceData = null) {
  if (candidateRaceData) return candidateRaceData;
  const item = raceItem(actor);
  if (item) return item;
  const sys = actor?.system ?? {};
  if (!sys.race && !sys.details_race) return null;
  return {
    name: sys.race ?? sys.details_race?.label ?? sys.details_race?.name ?? "Race",
    system: sys.details_race ?? {}
  };
}

function multiclassRawRules(raceData) {
  const sys = raceData?.system ?? raceData ?? {};
  return sys.multiclassage_permis
    ?? sys.multiclassagePermis
    ?? sys.multiclassage
    ?? sys.multiClass
    ?? sys.multiclass
    ?? sys.classes_multiclasse
    ?? sys.classesMulticlasse
    ?? sys.classCombinations
    ?? sys.combinaisons_multiclasse
    ?? null;
}

function flattenRuleTokens(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(flattenRuleTokens).filter(Boolean);
  if (typeof value === "string") return value.split(/[+,;|/\n]+/).map(norm).filter(Boolean);
  if (typeof value === "object") {
    const candidates = value.classes ?? value.combo ?? value.combinaison ?? value.allowed ?? value.permis ?? value.value ?? value.name ?? value.label;
    if (candidates !== undefined) return flattenRuleTokens(candidates);
    return Object.entries(value)
      .filter(([_k, v]) => v === true || v === "true" || v === 1)
      .map(([k]) => norm(k))
      .filter(Boolean);
  }
  return [norm(value)].filter(Boolean);
}

function allowedCombosFromRace(raceData) {
  const raw = multiclassRawRules(raceData);
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .map(entry => [...new Set(flattenRuleTokens(entry))])
      .filter(combo => combo.length >= 2);
  }

  if (typeof raw === "string") {
    return raw
      .split(/[;\n|]+/)
      .map(entry => [...new Set(flattenRuleTokens(entry))])
      .filter(combo => combo.length >= 2);
  }

  if (typeof raw === "object") {
    const explicit = raw.combinaisons ?? raw.combinations ?? raw.combos ?? raw.classes ?? raw.allowed ?? raw.permis;
    if (explicit !== undefined) return allowedCombosFromRace({ system: { multiclassage: explicit } });

    const combos = [];
    for (const [key, value] of Object.entries(raw)) {
      if (value === true || value === "true" || value === 1) {
        const combo = [...new Set(flattenRuleTokens(key))];
        if (combo.length >= 2) combos.push(combo);
      } else {
        const combo = [...new Set(flattenRuleTokens(value))];
        if (combo.length >= 2) combos.push(combo);
      }
    }
    return combos;
  }

  return [];
}

function raceAllowsClassSet(raceData, classNamesOrSlugs) {
  const wanted = [...new Set(classNamesOrSlugs.map(norm).filter(Boolean))];
  if (wanted.length <= 1) return true;

  const combos = allowedCombosFromRace(raceData);
  if (!combos.length) return false;

  return combos.some(combo => wanted.every(c => combo.includes(c)));
}

function parseXpRange(raw) {
  const text = String(raw ?? "").trim();
  const values = text.match(/[0-9][0-9.\s]*/g)?.map(v => num(v, NaN)).filter(Number.isFinite) ?? [];
  return { min: values[0] ?? 0, max: values[1] ?? null, raw: text };
}

function progressionRows(classSystem) {
  const progression = Array.isArray(classSystem?.progression) ? classSystem.progression : [];
  return progression.map((row, index) => {
    const range = parseXpRange(row?.xp ?? row?.experience ?? row?.xpRange ?? row?.niveau_xp ?? "");
    return {
      ...row,
      niveau: num(row?.niveau ?? row?.level ?? index + 1, index + 1),
      xpMin: range.min,
      xpMax: range.max,
      xpLabel: range.raw
    };
  }).filter(row => row.niveau > 0).sort((a, b) => a.niveau - b.niveau);
}

function levelForClassXp(classSystem, xpValue) {
  const xp = Math.max(0, Math.floor(num(xpValue, 0)));
  const rows = progressionRows(classSystem);
  if (!rows.length) return 1;
  let current = rows[0];
  for (const row of rows) if (xp >= row.xpMin) current = row;
  return Math.max(1, Number(current.niveau) || 1);
}

function nextXpForClassLevel(classSystem, level) {
  const rows = progressionRows(classSystem);
  const next = rows.find(row => Number(row.niveau) > Number(level));
  return next ? Number(next.xpMin) || 0 : 0;
}

function classTitleForLevel(classSystem, level) {
  const rows = progressionRows(classSystem);
  const rowTitle = rows.find(row => Number(row.niveau) === Number(level))?.title;
  if (rowTitle) return rowTitle;
  const titles = Array.isArray(classSystem?.titlesByLevel) ? classSystem.titlesByLevel : [];
  return titles.find(t => Number(level) >= Number(t.minLevel ?? t.niveauMin ?? 0) && Number(level) <= Number(t.maxLevel ?? t.niveauMax ?? 999))?.title ?? "";
}

function multiclassEnabled(actor) {
  return actor?.system?.multiclasse?.enabled === true || classItems(actor).length > 1;
}

function buildClassEntries(actor, extraClassDoc = null, xpByClass = null) {
  const docs = classItems(actor);
  if (extraClassDoc) docs.push(extraClassDoc);

  const seen = new Set();
  const entries = [];
  const oldXp = xpByClass ?? actor?.system?.xp_par_classe ?? {};
  const oldLevels = actor?.system?.niveaux_par_classe ?? {};

  for (const doc of docs) {
    const slug = classSlugFromData(doc);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    const sys = foundry.utils.deepClone(doc.system ?? {});
    const xp = Math.max(0, Math.floor(num(oldXp?.[slug], 0)));
    const level = Math.max(1, Math.floor(num(oldLevels?.[slug], levelForClassXp(sys, xp))));
    const title = classTitleForLevel(sys, level);

    entries.push({
      id: doc.id ?? null,
      uuid: doc.uuid ?? null,
      name: doc.name ?? classLabelFromData(doc),
      slug,
      niveau: level,
      level,
      xp,
      titre: title,
      title,
      hitDie: sys.hitDie ?? sys.dv ?? null,
      spellcasting: sys.spellcasting ?? null,
      system: sys
    });
  }

  return entries;
}

function combinedSpellcasting(entries) {
  const enabled = entries.map(e => e.spellcasting).filter(sc => sc?.enabled);
  if (!enabled.length) return null;
  const lists = [...new Set(enabled.flatMap(sc => toArray(sc.lists)).filter(Boolean))];
  return {
    enabled: true,
    mode: enabled.map(sc => sc.mode).filter(Boolean).join("+") || enabled[0].mode || "multiclass",
    type: "prepared",
    ability: enabled.map(sc => sc.ability).filter(Boolean).join("+") || enabled[0].ability || "",
    abilityKey: enabled.map(sc => sc.abilityKey).filter(Boolean).join("+") || enabled[0].abilityKey || "",
    lists,
    startsAt: Math.min(...enabled.map(sc => num(sc.startsAt, 1))),
    maxSpellLevel: Math.max(...enabled.map(sc => num(sc.maxSpellLevel, 0))),
    usesSlots: enabled.some(sc => sc.usesSlots !== false),
    usesPreparation: enabled.some(sc => sc.usesPreparation !== false),
    preparationSource: "multiclasse.details_classes"
  };
}

function multiclassUpdatePayload(actor, extraClassDoc = null, xpByClass = null) {
  const entries = buildClassEntries(actor, extraClassDoc, xpByClass);
  if (entries.length <= 1) return null;

  const xpMap = {};
  const levelMap = {};
  const titleMap = {};
  const nextMap = {};
  for (const entry of entries) {
    xpMap[entry.slug] = entry.xp;
    levelMap[entry.slug] = entry.level;
    titleMap[entry.slug] = entry.title;
    nextMap[entry.slug] = nextXpForClassLevel(entry.system, entry.level);
  }

  const maxLevel = Math.max(...entries.map(e => e.level));
  const totalXp = Object.values(xpMap).reduce((sum, value) => sum + num(value, 0), 0);
  const label = entries.map(e => e.name).join(" / ");
  const titleLabel = entries.map(e => `${e.name} ${e.level}${e.title ? ` (${e.title})` : ""}`).join(" / ");
  const nextValues = Object.values(nextMap).filter(v => Number(v) > 0);
  const nextXp = nextValues.length ? Math.min(...nextValues) : 0;

  return {
    "system.classe": label,
    "system.classes": entries.map(e => ({
      id: e.id,
      uuid: e.uuid,
      name: e.name,
      slug: e.slug,
      niveau: e.level,
      level: e.level,
      xp: e.xp,
      titre: e.title,
      title: e.title,
      hitDie: e.hitDie,
      spellcasting: e.spellcasting
    })),
    "system.details_classes": entries.map(e => ({
      ...e.system,
      name: e.name,
      label: e.name,
      slug: e.slug,
      sourceItemId: e.id,
      sourceItemUuid: e.uuid,
      niveau: e.level,
      level: e.level,
      xp: e.xp,
      title: e.title
    })),
    "system.details_classe": {
      ...entries[0].system,
      name: entries[0].name,
      label: entries[0].name,
      slug: entries[0].slug,
      sourceItemId: entries[0].id,
      sourceItemUuid: entries[0].uuid
    },
    "system.multiclasse": {
      enabled: true,
      mode: "racial",
      xpSplit: "equal",
      classes: entries.map(e => e.slug),
      label
    },
    "system.xp": totalXp,
    "system.xp_par_classe": xpMap,
    "system.niveaux_par_classe": levelMap,
    "system.titres_par_classe": titleMap,
    "system.xp_next_par_classe": nextMap,
    "system.niveau": maxLevel,
    "system.niveau_suggere": maxLevel,
    "system.titre": titleLabel,
    "system.progression_xp": entries.map(e => {
      const next = nextMap[e.slug];
      return next ? `${e.name} ${e.xp.toLocaleString()} / ${next.toLocaleString()} XP` : `${e.name} ${e.xp.toLocaleString()} XP`;
    }).join(" — "),
    "system.xp_next": nextXp,
    "system.xp_to_next": nextXp ? Math.max(0, nextXp - Math.min(...entries.map(e => e.xp))) : 0,
    "system.xp_percent": 0,
    "system.spellcasting": combinedSpellcasting(entries)
  };
}

async function dialogAlert(title, content) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (DialogV2?.alert) {
    return DialogV2.alert({
      window: { title },
      content,
      ok: { label: "Compris" },
      modal: true
    });
  }
  ui.notifications.warn(String(content ?? "").replace(/<[^>]+>/g, " "));
  return false;
}

async function addClassAsMulticlass(actor, itemData, sheet = null) {
  const race = systemRace(actor);
  const existing = classItems(actor);
  const wantedClasses = [...existing.map(c => c.name), itemData.name];

  if (!raceAllowsClassSet(race, wantedClasses)) {
    await dialogAlert("ADD2E — Multiclassage refusé", `
      <p>La race <b>${race?.name ?? actor.system?.race ?? "actuelle"}</b> ne permet pas la combinaison :</p>
      <p><b>${wantedClasses.join(" / ")}</b></p>
      <p>Le JSON de race n'est pas modifié. Corrige la combinaison autorisée dans la race si cette association doit être valide.</p>
    `);
    return false;
  }

  const slug = classSlugFromData(itemData);
  if (existing.some(c => classSlugFromData(c) === slug)) {
    ui.notifications.info(`${itemData.name} est déjà une classe du personnage.`);
    return false;
  }

  try {
    if (typeof checkClassStatMin === "function") {
      const ok = checkClassStatMin(actor, itemData, null, actor.system?.alignement, { silent: true, ignoreLevelMax: true });
      if (!ok) {
        await dialogAlert("ADD2E — Prérequis insuffisants", `<p>Les prérequis de <b>${itemData.name}</b> ne sont pas respectés pour ce personnage.</p>`);
        return false;
      }
    }
  } catch (err) {
    warn("[PREREQUIS][SKIP]", err);
  }

  const data = itemObjectWithoutRuntime(itemData);
  data.type = "classe";

  const [classDoc] = await actor.createEmbeddedDocuments("Item", [data], { [INTERNAL]: true, add2eInternal: true });
  if (!classDoc) return false;

  if (classDoc.effects?.contents?.length) {
    const actorEffects = classDoc.effects.contents.map(eff => {
      const effectData = foundry.utils.deepClone(eff.toObject());
      effectData.origin = classDoc.uuid;
      effectData.disabled = false;
      effectData.transfer = false;
      effectData.flags = effectData.flags ?? {};
      effectData.flags.add2e = {
        ...(effectData.flags.add2e ?? {}),
        sourceType: "classe",
        sourceClasse: classDoc.name,
        sourceItemId: classDoc.id,
        sourceItemUuid: classDoc.uuid,
        multiclass: true
      };
      return effectData;
    });
    if (actorEffects.length) await actor.createEmbeddedDocuments("ActiveEffect", actorEffects, { [INTERNAL]: true, add2eInternal: true });
  }

  const oldXpMap = foundry.utils.deepClone(actor.system?.xp_par_classe ?? {});
  oldXpMap[slug] ??= 0;
  const payload = multiclassUpdatePayload(actor, classDoc, oldXpMap);
  if (payload) await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-add-class" });

  try {
    if (typeof add2eSyncActorSpellsFromClass === "function") {
      await add2eSyncActorSpellsFromClass(actor, classDoc, { mode: "append", showWait: true });
    }
  } catch (err) {
    warn("[SPELL_SYNC][APPEND_ERROR]", err);
  }

  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  ui.notifications.info(`Classe multiclassée ajoutée : ${classDoc.name}.`);
  log("[ADD_CLASS]", { actor: actor.name, class: classDoc.name, payload });
  return true;
}

async function applyRaceForMulticlass(actor, raceData, sheet = null) {
  const existing = classItems(actor);
  if (existing.length <= 1) return false;

  const wantedClasses = existing.map(c => c.name);
  if (!raceAllowsClassSet(raceData, wantedClasses)) {
    await dialogAlert("ADD2E — Race incompatible", `
      <p>La race <b>${raceData?.name ?? "déposée"}</b> ne permet pas la combinaison multiclassée actuelle :</p>
      <p><b>${wantedClasses.join(" / ")}</b></p>
      <p>Le drop est annulé pour éviter de détruire les classes existantes.</p>
    `);
    return true;
  }

  if (typeof add2eApplyRaceItemDataToActor === "function") {
    await add2eApplyRaceItemDataToActor(actor, raceData, sheet, { notify: true });
  } else {
    const data = itemObjectWithoutRuntime(raceData);
    const old = actor.items.filter(i => String(i.type || "").toLowerCase() === "race");
    if (old.length) await actor.deleteEmbeddedDocuments("Item", old.map(i => i.id), { [INTERNAL]: true, add2eInternal: true });
    const [raceDoc] = await actor.createEmbeddedDocuments("Item", [data], { [INTERNAL]: true, add2eInternal: true });
    await actor.update({
      "system.race": raceDoc.name,
      "system.details_race": { ...(raceDoc.system ?? {}), name: raceDoc.name, label: raceDoc.name },
      "system.bonus_caracteristiques": foundry.utils.deepClone(raceDoc.system?.bonus_caracteristiques ?? {})
    }, { [INTERNAL]: true, add2eInternal: true });
  }

  const payload = multiclassUpdatePayload(actor);
  if (payload) await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-race-refresh" });
  sheet?.render?.(false);
  return true;
}

function parseDropItemData(event) {
  try {
    const raw = JSON.parse(event.dataTransfer?.getData("text/plain") || "{}");
    return raw;
  } catch (_err) {
    return null;
  }
}

async function resolveDroppedItemData(raw) {
  if (!raw || raw.type !== "Item") return null;
  if (raw.data) return raw.data;
  if (raw.uuid) {
    const doc = await fromUuid(raw.uuid).catch(() => null);
    if (doc instanceof Item) return doc.toObject();
  }
  if (raw.pack && raw.id) {
    const pack = game.packs.get(raw.pack);
    const ent = pack && await pack.getDocument(raw.id);
    if (ent instanceof Item) return ent.toObject();
  }
  return null;
}

function installDropWrapper() {
  const SheetClass = globalThis.Add2eActorSheet;
  if (!SheetClass?.prototype?._onDrop) return false;
  if (SheetClass.prototype._add2eMulticlassWrapped) return true;

  const original = SheetClass.prototype._onDrop;
  SheetClass.prototype._onDrop = async function add2eMulticlassDropWrapped(event) {
    const actor = this.actor;
    if (!actor || actor.type !== "personnage") return original.call(this, event);

    const raw = parseDropItemData(event);
    const itemData = await resolveDroppedItemData(raw);
    if (!itemData || !["classe", "race"].includes(itemData.type)) return original.call(this, event);

    if (itemData.type === "classe" && classItems(actor).length >= 1) {
      const handled = await addClassAsMulticlass(actor, itemData, this);
      event.preventDefault?.();
      event.stopPropagation?.();
      return false;
    }

    if (itemData.type === "race" && classItems(actor).length > 1) {
      const handled = await applyRaceForMulticlass(actor, itemData, this);
      if (handled) {
        event.preventDefault?.();
        event.stopPropagation?.();
        return false;
      }
    }

    return original.call(this, event);
  };

  SheetClass.prototype._add2eMulticlassWrapped = true;
  log("[DROP_WRAPPER_INSTALLED]", { version: VERSION });
  return true;
}

function splitXpDelta(actor, newTotalXp) {
  const entries = buildClassEntries(actor);
  if (entries.length <= 1) return null;

  const oldTotal = Math.max(0, Math.floor(num(actor.system?.xp, 0)));
  const incomingTotal = Math.max(0, Math.floor(num(newTotalXp, oldTotal)));
  const delta = incomingTotal - oldTotal;
  const xpMap = foundry.utils.deepClone(actor.system?.xp_par_classe ?? {});

  for (const entry of entries) xpMap[entry.slug] = Math.max(0, Math.floor(num(xpMap[entry.slug], 0)));

  if (delta !== 0) {
    const sign = delta >= 0 ? 1 : -1;
    let remaining = Math.abs(delta);
    const baseShare = Math.floor(remaining / entries.length);
    let rest = remaining % entries.length;

    for (const entry of entries) {
      const add = baseShare + (rest > 0 ? 1 : 0);
      if (rest > 0) rest -= 1;
      xpMap[entry.slug] = Math.max(0, xpMap[entry.slug] + (add * sign));
    }
  }

  return xpMap;
}

function mergeMulticlassXpChanges(actor, changes) {
  if (!actor || actor.type !== "personnage" || !multiclassEnabled(actor)) return;
  if (!foundry.utils.hasProperty(changes, "system.xp")) return;

  const incomingTotal = foundry.utils.getProperty(changes, "system.xp");
  const xpMap = splitXpDelta(actor, incomingTotal);
  if (!xpMap) return;

  const payload = multiclassUpdatePayload(actor, null, xpMap);
  if (!payload) return;
  foundry.utils.mergeObject(changes, foundry.utils.expandObject(payload), { inplace: true });
  log("[XP_SPLIT]", { actor: actor.name, incomingTotal, xpMap, payload });
}

async function recalcActor(actor) {
  if (!actor || actor.type !== "personnage" || !multiclassEnabled(actor)) return null;
  const payload = multiclassUpdatePayload(actor);
  if (!payload) return null;
  await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-recalc" });
  return payload;
}

Hooks.once("ready", () => {
  setTimeout(() => {
    if (!installDropWrapper()) {
      setTimeout(installDropWrapper, 500);
      setTimeout(installDropWrapper, 1500);
    }
  }, 0);

  if (game.user?.isGM) {
    for (const actor of game.actors?.filter(a => a.type === "personnage" && multiclassEnabled(a)) ?? []) {
      recalcActor(actor).catch(err => warn("[READY_RECALC_ERROR]", { actor: actor.name, err }));
    }
  }
});

Hooks.on("preUpdateActor", (actor, changes, options) => {
  if (options?.[INTERNAL] || options?.add2eInternal) return true;
  mergeMulticlassXpChanges(actor, changes);
  return true;
});

Hooks.on("createItem", item => {
  const actor = item?.parent;
  if (actor?.documentName === "Actor" && actor.type === "personnage" && String(item.type || "").toLowerCase() === "classe") {
    setTimeout(() => recalcActor(actor).catch(err => warn("[CREATE_ITEM_RECALC_ERROR]", err)), 0);
  }
});

Hooks.on("deleteItem", item => {
  const actor = item?.parent;
  if (actor?.documentName === "Actor" && actor.type === "personnage" && String(item.type || "").toLowerCase() === "classe") {
    setTimeout(() => recalcActor(actor).catch(err => warn("[DELETE_ITEM_RECALC_ERROR]", err)), 0);
  }
});

globalThis.add2eMulticlassEnabled = multiclassEnabled;
globalThis.add2eMulticlassAllowedCombosFromRace = allowedCombosFromRace;
globalThis.add2eRaceAllowsClassSet = raceAllowsClassSet;
globalThis.add2eRecalcMulticlassActor = recalcActor;
globalThis.add2eMulticlassUpdatePayload = multiclassUpdatePayload;

log("[LOADED]", { version: VERSION });
