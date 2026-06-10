// ADD2E — Multiclassage propre
// Version : 2026-06-10-multiclass-layer-v4-header-xp-level-sync
//
// Objectif :
// - préserver le fonctionnement mono-classe existant ;
// - proposer mono-classe ou multiclassage au drop d'une classe ;
// - afficher Classe/Niveau/XP/Titre par classe dans l'en-tête ;
// - synchroniser niveau <-> XP par classe ;
// - ne pas modifier les JSON de races ;
// - rester compatible Foundry V13/V14/V15 avec ApplicationV2/DialogV2.

const VERSION = "2026-06-10-multiclass-layer-v4-header-xp-level-sync";
const TAG = "[ADD2E][MULTICLASSE]";
const INTERNAL = "add2eMulticlassInternal";

globalThis.ADD2E_MULTICLASS_VERSION = VERSION;

function log(label, data = {}) { console.log(`${TAG}${label}`, data); }
function warn(label, data = {}) { console.warn(`${TAG}${label}`, data); }

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

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function looksLikeSingleComboArray(raw) {
  return Array.isArray(raw)
    && raw.length >= 2
    && raw.every(entry => typeof entry === "string" && flattenRuleTokens(entry).length === 1);
}

function allowedCombosFromRace(raceData) {
  const raw = multiclassRawRules(raceData);
  if (!raw) return [];

  if (Array.isArray(raw)) {
    if (looksLikeSingleComboArray(raw)) return [[...new Set(flattenRuleTokens(raw))]];
    return raw.map(entry => [...new Set(flattenRuleTokens(entry))]).filter(combo => combo.length >= 2);
  }

  if (typeof raw === "string") {
    return raw.split(/[;\n|]+/).map(entry => [...new Set(flattenRuleTokens(entry))]).filter(combo => combo.length >= 2);
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

function minXpForClassLevel(classSystem, levelValue) {
  const level = Math.max(1, Math.floor(num(levelValue, 1)));
  const rows = progressionRows(classSystem);
  const row = rows.find(r => Number(r.niveau) === level) ?? rows.filter(r => Number(r.niveau) <= level).at(-1) ?? rows[0] ?? null;
  return Math.max(0, Math.floor(num(row?.xpMin, 0)));
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

function worldClassCandidates() {
  return Array.from(game?.items ?? [])
    .filter(i => String(i.type || "").toLowerCase() === "classe")
    .map(i => itemObjectWithoutRuntime(i))
    .filter(Boolean);
}

function classPrerequisitesOk(actor, classData) {
  try {
    if (typeof checkClassStatMin === "function") {
      return checkClassStatMin(actor, classData, null, actor.system?.alignement, { silent: true, ignoreLevelMax: true }) === true;
    }
  } catch (err) {
    warn("[PREREQUIS][SKIP]", err);
  }
  return true;
}

function compatibleMulticlassClassCandidates(actor, preferredClassData = null) {
  const race = systemRace(actor);
  const existing = classItems(actor);
  const existingSlugs = existing.map(classSlugFromData).filter(Boolean);
  const candidates = [preferredClassData, ...worldClassCandidates()].filter(Boolean);
  const seen = new Set();
  const out = [];

  for (const candidate of candidates) {
    const slug = classSlugFromData(candidate);
    if (!slug || seen.has(slug) || existingSlugs.includes(slug)) continue;
    seen.add(slug);
    const wanted = [...existing.map(c => c.name), classLabelFromData(candidate)];
    if (!raceAllowsClassSet(race, wanted)) continue;
    if (!classPrerequisitesOk(actor, candidate)) continue;
    out.push(candidate);
  }

  return out.sort((a, b) => classLabelFromData(a).localeCompare(classLabelFromData(b), game.i18n?.lang ?? "fr"));
}

function mergeClassMap(actor, path, incoming = {}) {
  return {
    ...(foundry.utils.deepClone(foundry.utils.getProperty(actor.system ?? {}, path) ?? {})),
    ...(incoming ?? {})
  };
}

function buildClassEntries(actor, extraClassDoc = null, xpByClass = null, levelByClass = null) {
  const docs = classItems(actor);
  if (extraClassDoc) docs.push(extraClassDoc);

  const seen = new Set();
  const entries = [];
  const oldXp = xpByClass ?? actor?.system?.xp_par_classe ?? {};
  const oldLevels = levelByClass ?? actor?.system?.niveaux_par_classe ?? {};
  const levelMode = !!levelByClass;
  const xpMode = !!xpByClass && !levelMode;

  for (const doc of docs) {
    const slug = classSlugFromData(doc);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    const sys = foundry.utils.deepClone(doc.system ?? {});
    let xp = Math.max(0, Math.floor(num(oldXp?.[slug], 0)));
    let level = Math.max(1, Math.floor(num(oldLevels?.[slug], levelForClassXp(sys, xp))));

    if (levelMode && oldLevels?.[slug] !== undefined) {
      level = Math.max(1, Math.floor(num(oldLevels[slug], 1)));
      xp = minXpForClassLevel(sys, level);
    } else if (xpMode && oldXp?.[slug] !== undefined) {
      level = levelForClassXp(sys, xp);
    } else {
      level = Math.max(1, Math.floor(num(oldLevels?.[slug], levelForClassXp(sys, xp))));
      if (!oldXp?.[slug] && xp <= 0) xp = minXpForClassLevel(sys, level);
    }

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

function multiclassUpdatePayload(actor, extraClassDoc = null, xpByClass = null, levelByClass = null) {
  const entries = buildClassEntries(actor, extraClassDoc, xpByClass, levelByClass);
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

function applyPayloadToSheetData(data, payload) {
  if (!data?.actor?.system || !payload) return data;
  for (const [path, value] of Object.entries(payload)) foundry.utils.setProperty(data.actor, path, value);
  data.progressionCourante = { title: data.actor.system?.titre ?? "" };
  const classNames = String(data.actor.system?.classe ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f’']/g, "");
  data.canExceptionalStrength = Number(data.actor.system?.force) === 18 && (
    classNames.includes("guerrier") || classNames.includes("paladin") || classNames.includes("rodeur") || classNames.includes("ranger")
  );
  return data;
}

function installGetDataPatch() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto?.getData || proto.__add2eMulticlassGetDataPatch === VERSION) return !!proto?.getData;
  const original = proto.getData;
  proto.getData = async function add2eMulticlassGetData(...args) {
    const data = await original.apply(this, args);
    if (this.actor?.type !== "personnage" || !multiclassEnabled(this.actor)) return data;
    const payload = multiclassUpdatePayload(this.actor);
    return applyPayloadToSheetData(data, payload);
  };
  proto.__add2eMulticlassGetDataPatch = VERSION;
  log("[GETDATA_PATCH_INSTALLED]", { version: VERSION });
  return true;
}

async function dialogAlert(title, content) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (DialogV2?.alert) return DialogV2.alert({ window: { title }, content, ok: { label: "Compris" }, modal: true });
  ui.notifications.warn(String(content ?? "").replace(/<[^>]+>/g, " "));
  return false;
}

async function dialogWait({ title, content, buttons }) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    await dialogAlert(title, `${content}<p><b>DialogV2.wait indisponible : action annulée pour éviter un choix automatique.</b></p>`);
    return { action: "cancel" };
  }
  return DialogV2.wait({ window: { title }, content, buttons, modal: true, rejectClose: false, close: () => ({ action: "cancel" }) });
}

async function showClassDropChoiceDialog(actor, droppedClassData) {
  const current = classItems(actor).map(c => c.name).join(" / ") || actor.system?.classe || "Aucune";
  const race = systemRace(actor);
  const candidates = compatibleMulticlassClassCandidates(actor, droppedClassData);
  const droppedSlug = classSlugFromData(droppedClassData);
  const droppedIsCandidate = candidates.some(c => classSlugFromData(c) === droppedSlug);
  const selectOptions = candidates.map((candidate, index) => {
    const label = classLabelFromData(candidate);
    const marker = classSlugFromData(candidate) === droppedSlug ? " — classe déposée" : "";
    return `<option value="${index}">${esc(label)}${marker}</option>`;
  }).join("");

  const content = `
    <form class="add2e-multiclass-choice" style="line-height:1.45;min-width:520px;">
      <p><b>Drop d'une classe sur un personnage déjà classé</b></p>
      <p>Race actuelle : <b>${esc(race?.name ?? actor.system?.race ?? "Race inconnue")}</b></p>
      <p>Classe(s) actuelle(s) : <b>${esc(current)}</b></p>
      <p>Classe déposée : <b>${esc(classLabelFromData(droppedClassData))}</b></p>
      ${candidates.length
        ? `<div class="form-group"><label>Classe à ajouter en multiclassage</label><select name="multiclassChoice">${selectOptions}</select></div>`
        : `<p style="color:#9b1c1c;font-weight:700;">Aucune classe compatible disponible pour le multiclassage avec cette race.</p>`}
      <p style="font-size:0.9em;color:#6b5a2a;margin-bottom:0;">Le choix mono-classe garde le comportement existant : la classe actuelle est remplacée par la classe déposée.</p>
    </form>`;

  const buttons = [{ action: "monoclass", label: "Remplacer en mono-classe", default: !droppedIsCandidate, callback: () => ({ action: "monoclass" }) }];
  if (candidates.length) {
    buttons.push({
      action: "multiclass-selected",
      label: droppedIsCandidate ? "Ajouter en multiclassage" : "Ajouter la classe choisie",
      default: droppedIsCandidate,
      callback: (_event, _button, dialog) => {
        const root = dialog?.element ?? document;
        const idx = Number(root.querySelector?.('[name="multiclassChoice"]')?.value ?? 0) || 0;
        return { action: "multiclass", classData: candidates[idx] ?? null };
      }
    });
  }
  buttons.push({ action: "cancel", label: "Annuler", callback: () => ({ action: "cancel" }) });
  return dialogWait({ title: "ADD2E — Classe ou multiclassage", content, buttons });
}

async function addClassAsMulticlass(actor, itemData, sheet = null) {
  const race = systemRace(actor);
  const existing = classItems(actor);
  const wantedClasses = [...existing.map(c => c.name), itemData.name];
  if (!raceAllowsClassSet(race, wantedClasses)) {
    await dialogAlert("ADD2E — Multiclassage refusé", `<p>La race <b>${esc(race?.name ?? actor.system?.race ?? "actuelle")}</b> ne permet pas la combinaison :</p><p><b>${esc(wantedClasses.join(" / "))}</b></p><p>Le JSON de race n'est pas modifié.</p>`);
    return false;
  }
  const slug = classSlugFromData(itemData);
  if (existing.some(c => classSlugFromData(c) === slug)) {
    ui.notifications.info(`${itemData.name} est déjà une classe du personnage.`);
    return false;
  }
  if (!classPrerequisitesOk(actor, itemData)) {
    await dialogAlert("ADD2E — Prérequis insuffisants", `<p>Les prérequis de <b>${esc(itemData.name)}</b> ne sont pas respectés pour ce personnage.</p>`);
    return false;
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
      effectData.flags.add2e = { ...(effectData.flags.add2e ?? {}), sourceType: "classe", sourceClasse: classDoc.name, sourceItemId: classDoc.id, sourceItemUuid: classDoc.uuid, multiclass: true };
      return effectData;
    });
    if (actorEffects.length) await actor.createEmbeddedDocuments("ActiveEffect", actorEffects, { [INTERNAL]: true, add2eInternal: true });
  }

  const oldXpMap = foundry.utils.deepClone(actor.system?.xp_par_classe ?? {});
  oldXpMap[slug] ??= minXpForClassLevel(classDoc.system ?? {}, 1);
  const payload = multiclassUpdatePayload(actor, classDoc, oldXpMap, null);
  if (payload) await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-add-class" });

  try {
    if (typeof add2eSyncActorSpellsFromClass === "function") await add2eSyncActorSpellsFromClass(actor, classDoc, { mode: "append", showWait: true });
  } catch (err) { warn("[SPELL_SYNC][APPEND_ERROR]", err); }

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
    await dialogAlert("ADD2E — Race incompatible", `<p>La race <b>${esc(raceData?.name ?? "déposée")}</b> ne permet pas la combinaison multiclassée actuelle :</p><p><b>${esc(wantedClasses.join(" / "))}</b></p><p>Le drop est annulé pour éviter de détruire les classes existantes.</p>`);
    return true;
  }
  if (typeof add2eApplyRaceItemDataToActor === "function") await add2eApplyRaceItemDataToActor(actor, raceData, sheet, { notify: true });
  else {
    const data = itemObjectWithoutRuntime(raceData);
    const old = actor.items.filter(i => String(i.type || "").toLowerCase() === "race");
    if (old.length) await actor.deleteEmbeddedDocuments("Item", old.map(i => i.id), { [INTERNAL]: true, add2eInternal: true });
    const [raceDoc] = await actor.createEmbeddedDocuments("Item", [data], { [INTERNAL]: true, add2eInternal: true });
    await actor.update({ "system.race": raceDoc.name, "system.details_race": { ...(raceDoc.system ?? {}), name: raceDoc.name, label: raceDoc.name }, "system.bonus_caracteristiques": foundry.utils.deepClone(raceDoc.system?.bonus_caracteristiques ?? {}) }, { [INTERNAL]: true, add2eInternal: true });
  }
  const payload = multiclassUpdatePayload(actor);
  if (payload) await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-race-refresh" });
  sheet?.render?.(false);
  return true;
}

function parseDropItemData(event) { try { return JSON.parse(event.dataTransfer?.getData("text/plain") || "{}"); } catch (_err) { return null; } }
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
      const choice = await showClassDropChoiceDialog(actor, itemData);
      if (choice?.action === "monoclass") return original.call(this, event);
      if (choice?.action === "multiclass" && choice.classData) {
        const handled = await addClassAsMulticlass(actor, choice.classData, this);
        if (handled) { event.preventDefault?.(); event.stopPropagation?.(); return false; }
      }
      event.preventDefault?.(); event.stopPropagation?.(); ui.notifications.info("Drop de classe annulé."); return false;
    }

    if (itemData.type === "race" && classItems(actor).length > 1) {
      const handled = await applyRaceForMulticlass(actor, itemData, this);
      if (handled) { event.preventDefault?.(); event.stopPropagation?.(); return false; }
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
    const remaining = Math.abs(delta);
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

function mergeMulticlassChanges(actor, changes) {
  if (!actor || actor.type !== "personnage" || !multiclassEnabled(actor)) return;
  const flat = foundry.utils.flattenObject(changes ?? {});
  let payload = null;

  const levelChanges = {};
  const xpClassChanges = {};
  for (const [path, value] of Object.entries(flat)) {
    if (path.startsWith("system.niveaux_par_classe.")) levelChanges[path.slice("system.niveaux_par_classe.".length)] = value;
    if (path.startsWith("system.xp_par_classe.")) xpClassChanges[path.slice("system.xp_par_classe.".length)] = value;
  }

  if (Object.keys(levelChanges).length) {
    const levelMap = mergeClassMap(actor, "niveaux_par_classe", levelChanges);
    payload = multiclassUpdatePayload(actor, null, null, levelMap);
  } else if (Object.keys(xpClassChanges).length) {
    const xpMap = mergeClassMap(actor, "xp_par_classe", xpClassChanges);
    payload = multiclassUpdatePayload(actor, null, xpMap, null);
  } else if (foundry.utils.hasProperty(changes, "system.xp")) {
    const incomingTotal = foundry.utils.getProperty(changes, "system.xp");
    const xpMap = splitXpDelta(actor, incomingTotal);
    if (xpMap) payload = multiclassUpdatePayload(actor, null, xpMap, null);
  }

  if (!payload) return;
  foundry.utils.mergeObject(changes, foundry.utils.expandObject(payload), { inplace: true });
  log("[SYNC_PREUPDATE]", { actor: actor.name, payload });
}

async function recalcActor(actor) {
  if (!actor || actor.type !== "personnage" || !multiclassEnabled(actor)) return null;
  const payload = multiclassUpdatePayload(actor);
  if (!payload) return null;
  await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-recalc" });
  return payload;
}

Hooks.once("ready", () => {
  installGetDataPatch();
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
  mergeMulticlassChanges(actor, changes);
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
globalThis.add2eCompatibleMulticlassClassCandidates = compatibleMulticlassClassCandidates;
globalThis.add2eMulticlassMinXpForClassLevel = minXpForClassLevel;
globalThis.add2eMulticlassLevelForClassXp = levelForClassXp;

installGetDataPatch();
log("[LOADED]", { version: VERSION });
