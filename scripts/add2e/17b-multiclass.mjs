// ADD2E — Multiclassage propre
// Version : 2026-06-10-multiclass-layer-v14-clean-monoclass-replace
//
// Module dédié au multiclassage.
// Champ de référence unique pour les races : system.multiclassing.allowedCombinations.
// Ne modifie pas les JSON de races.
// L'XP globale est gérée par 17-movement-xp.mjs.
// Ce fichier synchronise l'XP/niveau par classe, les drops multiclasses et les champs dynamiques ApplicationV2.

const VERSION = "2026-06-10-multiclass-layer-v14-clean-monoclass-replace";
const TAG = "[ADD2E][MULTICLASSE]";
const INTERNAL = "add2eMulticlassInternal";

globalThis.ADD2E_MULTICLASS_VERSION = VERSION;

function log(label, data = {}) { console.log(`${TAG}${label}`, data); }
function warn(label, data = {}) { console.warn(`${TAG}${label}`, data); }

function num(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (value && typeof value === "object") {
    for (const key of ["value", "valeur", "total", "current", "base", "max", "niveau", "level", "xp"]) {
      if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "object") return num(value[key], fallback);
    }
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

function cloneItemData(itemLike) {
  const data = typeof itemLike?.toObject === "function" ? itemLike.toObject() : foundry.utils.deepClone(itemLike ?? {});
  if (!data || typeof data !== "object") return null;
  delete data._id;
  delete data._stats;
  return data;
}

function itemLabel(data, fallback = "Item") {
  const sys = data?.system ?? data ?? {};
  return String(data?.name ?? sys.label ?? sys.nom ?? sys.name ?? fallback).trim() || fallback;
}

function classSlug(data) {
  const sys = data?.system ?? data ?? {};
  return norm(sys.slug ?? sys.label ?? sys.nom ?? sys.name ?? data?.name ?? "classe");
}

function classItems(actor) {
  return (actor?.items?.contents ?? Array.from(actor?.items ?? []))
    .filter(i => String(i.type || "").toLowerCase() === "classe");
}

function raceItem(actor) {
  return actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "race") ?? null;
}

function systemRace(actor, override = null) {
  if (override) return override;
  const item = raceItem(actor);
  if (item) return item;
  const sys = actor?.system ?? {};
  return { name: sys.race ?? sys.details_race?.label ?? sys.details_race?.name ?? "Race", system: sys.details_race ?? {} };
}

function multiclassEnabled(actor) {
  return actor?.type === "personnage" && (actor.system?.multiclasse?.enabled === true || classItems(actor).length > 1);
}

function strictAllowedCombinations(raceData) {
  const sys = raceData?.system ?? raceData ?? {};
  return Array.isArray(sys.multiclassing?.allowedCombinations) ? sys.multiclassing.allowedCombinations : [];
}

function comboTokens(combo) {
  if (Array.isArray(combo)) return combo.map(norm).filter(Boolean);
  if (typeof combo === "string") return combo.split(/[+/;,|\n]+/).map(norm).filter(Boolean);
  if (combo && typeof combo === "object" && Array.isArray(combo.classes)) return combo.classes.map(norm).filter(Boolean);
  return [];
}

function allowedCombosFromRace(raceData) {
  return strictAllowedCombinations(raceData)
    .map(comboTokens)
    .map(tokens => [...new Set(tokens)])
    .filter(tokens => tokens.length >= 2);
}

function wantedClassNames(actor, classData = null) {
  const existing = classItems(actor).map(c => c.name);
  if (!classData) return existing;
  const slug = classSlug(classData);
  if (classItems(actor).some(c => classSlug(c) === slug)) return existing;
  return [...existing, itemLabel(classData, "Classe")];
}

function raceAllowsClassSet(raceData, names) {
  const wanted = [...new Set(names.map(norm).filter(Boolean))];
  if (wanted.length <= 1) return true;
  const combos = allowedCombosFromRace(raceData);
  return combos.some(combo => wanted.every(c => combo.includes(c)));
}

function classRaceMaxLevel(classData, raceData) {
  const sys = classData?.system ?? classData ?? {};
  const rules = sys.raceRestriction?.races ?? {};
  const raceKey = `race:${norm(itemLabel(raceData, "Race"))}`;
  const rule = rules[raceKey] ?? rules[norm(raceKey)] ?? null;
  const value = Number(rule?.maxLevel ?? rule?.niveauMax ?? rule?.max ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function raceMatchesClassRules(raceData, classData) {
  try {
    if (typeof add2eRaceMatchesClassRules === "function") return add2eRaceMatchesClassRules(raceData, classData) === true;
  } catch (err) { warn("[RACE_MATCH_GLOBAL_ERROR]", err); }
  const sys = classData?.system ?? classData ?? {};
  const rules = sys.raceRestriction?.races ?? null;
  if (!rules || typeof rules !== "object" || !Object.keys(rules).length) return true;
  const raceKey = `race:${norm(itemLabel(raceData, "Race"))}`;
  const rule = rules[raceKey] ?? rules[norm(raceKey)] ?? null;
  return rule?.allowed === true;
}

function classPrerequisitesOk(actor, classData, raceData = null) {
  try {
    if (typeof checkClassStatMin === "function") {
      const alignment = typeof add2ePickClassAlignment === "function" ? add2ePickClassAlignment(actor, classData?.system ?? {}) : actor.system?.alignement;
      return checkClassStatMin(actor, classData, raceData, alignment, { silent: true, ignoreLevelMax: true }) === true;
    }
  } catch (err) { warn("[PREREQUIS][SKIP]", err); }
  return true;
}

function worldItemsByType(type) {
  try {
    if (typeof add2eWorldItemsByType === "function") return add2eWorldItemsByType(type);
  } catch (err) { warn("[WORLD_ITEMS_GLOBAL_ERROR]", err); }
  return Array.from(game?.items ?? [])
    .filter(i => String(i.type || "").toLowerCase() === String(type).toLowerCase())
    .map(cloneItemData)
    .filter(Boolean);
}

function raceCompatibleForMulticlass(actor, classData, raceData) {
  return raceAllowsClassSet(raceData, wantedClassNames(actor, classData))
    && raceMatchesClassRules(raceData, classData)
    && classPrerequisitesOk(actor, classData, raceData);
}

function raceCandidatesForClass(actor, classData) {
  const current = raceItem(actor);
  const races = [...(current ? [cloneItemData(current)] : []), ...worldItemsByType("race")].filter(Boolean);
  const seen = new Set();
  return races.filter(race => {
    const key = norm(itemLabel(race, "Race"));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return raceCompatibleForMulticlass(actor, classData, race);
  });
}

function parseXpRange(raw) {
  const text = String(raw ?? "").trim();
  const values = text.match(/[0-9][0-9.\s]*/g)?.map(v => num(v, NaN)).filter(Number.isFinite) ?? [];
  return { min: values[0] ?? 0, max: values[1] ?? null };
}

function progressionRows(classSystem) {
  const progression = Array.isArray(classSystem?.progression) ? classSystem.progression : [];
  return progression.map((row, index) => {
    const range = parseXpRange(row?.xp ?? row?.experience ?? row?.xpRange ?? row?.niveau_xp ?? "");
    return { ...row, niveau: num(row?.niveau ?? row?.level ?? index + 1, index + 1), xpMin: range.min, xpMax: range.max };
  }).filter(r => r.niveau > 0).sort((a, b) => a.niveau - b.niveau);
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

function mergedClassMap(actor, path, partial = null) {
  return { ...(foundry.utils.deepClone(foundry.utils.getProperty(actor.system ?? {}, path) ?? {})), ...(partial ?? {}) };
}

function buildClassEntries(actor, extraClassDoc = null, xpByClass = null, levelByClass = null, raceDataOverride = null) {
  const docs = classItems(actor);
  if (extraClassDoc) docs.push(extraClassDoc);
  const raceData = raceDataOverride ?? systemRace(actor);
  const seen = new Set();
  const entries = [];
  const xpMap = mergedClassMap(actor, "xp_par_classe", xpByClass);
  const levelOverrides = levelByClass && typeof levelByClass === "object" ? levelByClass : {};
  const hasLevelOverrides = Object.keys(levelOverrides).length > 0;

  for (const doc of docs) {
    const slug = classSlug(doc);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const sys = foundry.utils.deepClone(doc.system ?? {});
    let xp = Math.max(0, Math.floor(num(xpMap?.[slug], 0)));
    let level;

    if (hasLevelOverrides && Object.prototype.hasOwnProperty.call(levelOverrides, slug)) {
      level = Math.max(1, Math.floor(num(levelOverrides[slug], 1)));
      xp = minXpForClassLevel(sys, level);
    } else {
      level = levelForClassXp(sys, xp);
    }

    const maxLevel = classRaceMaxLevel(doc, raceData);
    if (maxLevel > 0 && level > maxLevel) {
      level = maxLevel;
      xp = minXpForClassLevel(sys, level);
    }

    const title = classTitleForLevel(sys, level);
    entries.push({ id: doc.id ?? null, uuid: doc.uuid ?? null, name: doc.name ?? itemLabel(doc, "Classe"), slug, niveau: level, level, xp, titre: title, title, hitDie: sys.hitDie ?? sys.dv ?? null, spellcasting: sys.spellcasting ?? null, levelMaxRace: maxLevel, system: sys });
  }
  return entries;
}

function combinedSpellcasting(entries) {
  const enabled = entries.map(e => e.spellcasting).filter(sc => sc?.enabled);
  if (!enabled.length) return null;
  const lists = [...new Set(enabled.flatMap(sc => Array.isArray(sc.lists) ? sc.lists : []).filter(Boolean))];
  return { enabled: true, mode: "multiclass", type: "prepared", lists, usesSlots: true, usesPreparation: true, preparationSource: "multiclasse.details_classes" };
}

function multiclassUpdatePayload(actor, extraClassDoc = null, xpByClass = null, levelByClass = null, raceDataOverride = null) {
  const entries = buildClassEntries(actor, extraClassDoc, xpByClass, levelByClass, raceDataOverride);
  if (entries.length <= 1) return null;
  const xpMap = {}, levelMap = {}, titleMap = {}, nextMap = {}, maxMap = {};
  for (const e of entries) {
    xpMap[e.slug] = e.xp;
    levelMap[e.slug] = e.level;
    titleMap[e.slug] = e.title;
    nextMap[e.slug] = nextXpForClassLevel(e.system, e.level);
    if (e.levelMaxRace) maxMap[e.slug] = e.levelMaxRace;
  }
  const maxLevel = Math.max(...entries.map(e => e.level));
  const totalXp = Object.values(xpMap).reduce((sum, value) => sum + num(value, 0), 0);
  const label = entries.map(e => e.name).join(" / ");
  const titleLabel = entries.map(e => `${e.name} ${e.level}${e.title ? ` (${e.title})` : ""}`).join(" / ");
  const nextValues = Object.values(nextMap).filter(v => Number(v) > 0);
  const nextXp = nextValues.length ? Math.min(...nextValues) : 0;
  return {
    "system.classe": label,
    "system.classes": entries.map(e => ({ id: e.id, uuid: e.uuid, name: e.name, slug: e.slug, niveau: e.level, level: e.level, xp: e.xp, titre: e.title, title: e.title, hitDie: e.hitDie, spellcasting: e.spellcasting, levelMaxRace: e.levelMaxRace })),
    "system.details_classes": entries.map(e => ({ ...e.system, name: e.name, label: e.name, slug: e.slug, sourceItemId: e.id, sourceItemUuid: e.uuid, niveau: e.level, level: e.level, xp: e.xp, title: e.title, levelMaxRace: e.levelMaxRace })),
    "system.details_classe": { ...entries[0].system, name: entries[0].name, label: entries[0].name, slug: entries[0].slug, sourceItemId: entries[0].id, sourceItemUuid: entries[0].uuid },
    "system.multiclasse": { enabled: true, mode: "racial", xpSplit: "equal", classes: entries.map(e => e.slug), label },
    "system.xp": totalXp,
    "system.xp_par_classe": xpMap,
    "system.niveaux_par_classe": levelMap,
    "system.titres_par_classe": titleMap,
    "system.xp_next_par_classe": nextMap,
    "system.niveau_max_par_classe": maxMap,
    "system.niveau": maxLevel,
    "system.niveau_suggere": maxLevel,
    "system.titre": titleLabel,
    "system.progression_xp": entries.map(e => `${e.name} ${e.xp.toLocaleString()}${nextMap[e.slug] ? ` / ${nextMap[e.slug].toLocaleString()} XP` : " XP"}${e.levelMaxRace ? ` — max racial ${e.levelMaxRace}` : ""}`).join(" — "),
    "system.xp_next": nextXp,
    "system.xp_to_next": nextXp ? Math.max(0, nextXp - Math.min(...entries.map(e => e.xp))) : 0,
    "system.xp_percent": 0,
    "system.spellcasting": combinedSpellcasting(entries)
  };
}

function monoClassCleanupPayload() {
  return {
    "system.multiclasse": { enabled: false, mode: "mono", xpSplit: "none", classes: [], label: "" },
    "system.classes": [],
    "system.details_classes": [],
    "system.xp_par_classe": {},
    "system.niveaux_par_classe": {},
    "system.titres_par_classe": {},
    "system.xp_next_par_classe": {},
    "system.niveau_max_par_classe": {}
  };
}

async function cleanupAfterMonoclassReplace(actor, itemData, sheet = null) {
  if (!actor || actor.type !== "personnage") return false;
  const wantedSlug = classSlug(itemData);
  const docs = classItems(actor);
  let keep = docs.find(doc => classSlug(doc) === wantedSlug) ?? docs.at(-1) ?? null;
  const toDelete = docs.filter(doc => doc.id !== keep?.id);
  if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete.map(doc => doc.id), { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-monoclass-clean-items" });
  const payload = monoClassCleanupPayload();
  if (keep) {
    payload["system.details_classe"] = { ...(keep.system ?? {}), name: keep.name, label: keep.name, slug: classSlug(keep), sourceItemId: keep.id, sourceItemUuid: keep.uuid };
    payload["system.classe"] = keep.name;
  }
  await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-monoclass-clean-system" });
  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  log("[MONOCLASS_CLEANUP]", { actor: actor.name, keep: keep?.name ?? null, deleted: toDelete.map(doc => doc.name) });
  return true;
}

function applyPayloadToSheetData(data, payload) {
  if (!data?.actor?.system || !payload) return data;
  for (const [path, value] of Object.entries(payload)) foundry.utils.setProperty(data.actor, path, value);
  data.progressionCourante = { title: data.actor.system?.titre ?? "" };
  return data;
}

function installGetDataPatch() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto?.getData || proto.__add2eMulticlassGetDataPatch === VERSION) return !!proto?.getData;
  const original = proto.getData;
  proto.getData = async function add2eMulticlassGetData(...args) {
    const data = await original.apply(this, args);
    if (this.actor?.type !== "personnage" || !multiclassEnabled(this.actor)) return data;
    return applyPayloadToSheetData(data, multiclassUpdatePayload(this.actor));
  };
  proto.__add2eMulticlassGetDataPatch = VERSION;
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
    await dialogAlert(title, `${content}<p><b>DialogV2.wait indisponible : action annulée.</b></p>`);
    return { action: "cancel" };
  }
  return DialogV2.wait({ window: { title }, content, buttons, modal: true, rejectClose: false, close: () => ({ action: "cancel" }) });
}

function readDropPayload(event, data = null) {
  if (data && typeof data === "object" && Object.keys(data).length) return data;
  const direct = event?.data ?? event?.dropData ?? event?.dragData;
  if (direct && typeof direct === "object" && Object.keys(direct).length) return direct;
  for (const type of ["text/plain", "application/json", "text/x-foundry-dragdrop"]) {
    try {
      const raw = event?.dataTransfer?.getData?.(type);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length) return parsed;
    } catch (_err) {}
  }
  return null;
}

async function resolveDroppedItemData(event, data = null) {
  const raw = readDropPayload(event, data);
  if (!raw) return null;
  if (raw.system && ["classe", "race"].includes(raw.type)) return cloneItemData(raw);
  if (raw.data?.system && ["classe", "race"].includes(raw.data.type)) return cloneItemData(raw.data);
  if (raw.uuid) {
    const doc = await fromUuid(raw.uuid).catch(() => null);
    if (doc instanceof Item) return cloneItemData(doc);
  }
  if (raw.pack && (raw.id || raw._id)) {
    const pack = game.packs.get(raw.pack);
    const doc = pack ? await pack.getDocument(raw.id ?? raw._id).catch(() => null) : null;
    if (doc instanceof Item) return cloneItemData(doc);
  }
  return null;
}

function currentRaceKey(actor) { return norm(systemRace(actor)?.name ?? actor.system?.race ?? ""); }

function multiclassOptionsForDroppedClass(actor, classData) {
  const slug = classSlug(classData);
  const already = classItems(actor).some(c => classSlug(c) === slug);
  if (already) return [{ classData, raceData: systemRace(actor), already: true, needsRaceChange: false, label: `${itemLabel(classData, "Classe")} — déjà présente` }];
  return raceCandidatesForClass(actor, classData).map(raceData => ({
    classData,
    raceData,
    already: false,
    needsRaceChange: norm(itemLabel(raceData, "Race")) !== currentRaceKey(actor),
    label: `${itemLabel(classData, "Classe")} avec ${itemLabel(raceData, "Race")}${classRaceMaxLevel(classData, raceData) ? ` — max niveau ${classRaceMaxLevel(classData, raceData)}` : ""}`
  }));
}

function compatibleMulticlassClassCandidates(actor, preferredClassData = null) {
  const out = [];
  const seen = new Set();
  for (const cls of [preferredClassData, ...worldItemsByType("classe")].filter(Boolean)) {
    const slug = classSlug(cls);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    if (multiclassOptionsForDroppedClass(actor, cls).length) out.push(cls);
  }
  return out.sort((a, b) => itemLabel(a, "Classe").localeCompare(itemLabel(b, "Classe"), game.i18n?.lang ?? "fr"));
}

async function showClassDropChoiceDialog(actor, droppedClassData) {
  const current = classItems(actor).map(c => c.name).join(" / ") || actor.system?.classe || "Aucune";
  const options = [];
  const seen = new Set();
  for (const opt of multiclassOptionsForDroppedClass(actor, droppedClassData)) {
    const key = `${classSlug(opt.classData)}|${norm(itemLabel(opt.raceData, "Race"))}`;
    if (!seen.has(key)) { seen.add(key); options.push(opt); }
  }
  const optionHtml = options.map((opt, index) => `<option value="${index}">${esc(opt.label)}${opt.needsRaceChange ? " — changement de race" : ""}</option>`).join("");
  const content = `
    <form class="add2e-multiclass-choice" style="line-height:1.45;min-width:560px;">
      <p><b>Drop d'une classe sur un personnage déjà classé</b></p>
      <p>Classe(s) actuelle(s) : <b>${esc(current)}</b></p>
      <p>Classe déposée : <b>${esc(itemLabel(droppedClassData, "Classe"))}</b></p>
      ${options.length ? `<div class="form-group"><label>Multiclassage disponible</label><select name="multiclassChoice">${optionHtml}</select></div>` : `<p style="color:#9b1c1c;font-weight:700;">Aucune combinaison classe + race disponible.</p>`}
      <p style="font-size:0.9em;color:#6b5a2a;margin-bottom:0;">Les combinaisons viennent uniquement du champ <b>system.multiclassing.allowedCombinations</b> des races.</p>
    </form>`;
  const buttons = [{ action: "monoclass", label: "Remplacer en mono-classe", default: !options.length, callback: () => ({ action: "monoclass" }) }];
  if (options.length) {
    buttons.push({
      action: "multiclass-selected",
      label: options[0]?.already ? "Recalculer / resynchroniser" : "Appliquer ce multiclassage",
      default: true,
      callback: (_event, _button, dialog) => {
        const root = dialog?.element ?? document;
        const idx = Number(root.querySelector?.('[name="multiclassChoice"]')?.value ?? 0) || 0;
        return { action: "multiclass", option: options[idx] ?? null };
      }
    });
  }
  buttons.push({ action: "cancel", label: "Annuler", callback: () => ({ action: "cancel" }) });
  return dialogWait({ title: "ADD2E — Classe ou multiclassage", content, buttons });
}

async function applyRaceData(actor, raceData, sheet = null) {
  if (!raceData) return false;
  if (norm(itemLabel(systemRace(actor), "Race")) === norm(itemLabel(raceData, "Race"))) return true;
  if (typeof add2eApplyRaceItemDataToActor === "function") {
    await add2eApplyRaceItemDataToActor(actor, raceData, sheet, { notify: true, reason: "multiclass-direct-race-choice" });
    return true;
  }
  const data = cloneItemData(raceData);
  data.type = "race";
  const old = actor.items.filter(i => String(i.type || "").toLowerCase() === "race");
  if (old.length) await actor.deleteEmbeddedDocuments("Item", old.map(i => i.id), { [INTERNAL]: true, add2eInternal: true });
  const [raceDoc] = await actor.createEmbeddedDocuments("Item", [data], { [INTERNAL]: true, add2eInternal: true });
  await actor.update({ "system.race": raceDoc.name, "system.details_race": { ...(raceDoc.system ?? {}), name: raceDoc.name, label: raceDoc.name }, "system.bonus_caracteristiques": foundry.utils.deepClone(raceDoc.system?.bonus_caracteristiques ?? {}) }, { [INTERNAL]: true, add2eInternal: true });
  return true;
}

async function applyClassAsMonoclass(actor, itemData, sheet = null) {
  if (typeof add2eApplyClassItemDataToActor === "function") {
    const alignment = typeof add2ePickClassAlignment === "function" ? add2ePickClassAlignment(actor, itemData.system ?? {}) : actor.system?.alignement;
    const result = await add2eApplyClassItemDataToActor(actor, itemData, sheet, { alignmentCandidate: alignment, notify: true, reason: "multiclass-choice-monoclass" });
    await cleanupAfterMonoclassReplace(actor, itemData, sheet);
    return result;
  }
  ui.notifications.error("Remplacement mono-classe impossible : helper add2eApplyClassItemDataToActor introuvable.");
  return false;
}

async function addClassAsMulticlass(actor, option, sheet = null) {
  const itemData = option?.classData;
  if (!itemData) return false;
  const slug = classSlug(itemData);
  const already = classItems(actor).find(c => classSlug(c) === slug);
  if (already) {
    const payload = multiclassUpdatePayload(actor);
    if (payload) await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-resync-existing-class" });
    sheet?._add2eRememberActiveTab?.();
    sheet?.render?.(false);
    ui.notifications.info(`${already.name} est déjà présente : acteur multiclassé recalculé.`);
    return true;
  }
  if (!raceCompatibleForMulticlass(actor, itemData, option.raceData)) {
    await dialogAlert("ADD2E — Multiclassage refusé", `<p>La combinaison <b>${esc(itemLabel(itemData, "Classe"))} avec ${esc(itemLabel(option.raceData, "Race"))}</b> n'est pas valide.</p>`);
    return false;
  }
  await applyRaceData(actor, option.raceData, sheet);
  const data = cloneItemData(itemData);
  data.type = "classe";
  const [classDoc] = await actor.createEmbeddedDocuments("Item", [data], { [INTERNAL]: true, add2eInternal: true });
  if (!classDoc) return false;
  const oldXpMap = foundry.utils.deepClone(actor.system?.xp_par_classe ?? {});
  oldXpMap[slug] ??= minXpForClassLevel(classDoc.system ?? {}, 1);
  const payload = multiclassUpdatePayload(actor, classDoc, oldXpMap, null, systemRace(actor));
  if (payload) await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-add-class" });
  try { if (typeof add2eSyncActorSpellsFromClass === "function") await add2eSyncActorSpellsFromClass(actor, classDoc, { mode: "append", showWait: true }); }
  catch (err) { warn("[SPELL_SYNC][APPEND_ERROR]", err); }
  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  ui.notifications.info(`Multiclassage appliqué : ${classDoc.name} avec ${itemLabel(option.raceData, "Race")}.`);
  return true;
}

async function applyRaceForMulticlass(actor, raceData, sheet = null) {
  const classes = classItems(actor);
  if (classes.length <= 1) return false;
  const ok = classes.every(cls => raceCompatibleForMulticlass(actor, cls, raceData));
  if (!ok) {
    await dialogAlert("ADD2E — Race incompatible", `<p>La race <b>${esc(itemLabel(raceData, "Race"))}</b> n'est pas compatible avec le multiclassage actuel.</p>`);
    return true;
  }
  await applyRaceData(actor, raceData, sheet);
  const payload = multiclassUpdatePayload(actor, null, null, null, raceData);
  if (payload) await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-race-refresh" });
  sheet?.render?.(false);
  return true;
}

function mergeMulticlassChanges(actor, changes) {
  if (!actor || actor.type !== "personnage" || !multiclassEnabled(actor)) return;
  const flat = foundry.utils.flattenObject(changes ?? {});
  let payload = null;
  const levelChanges = {}, xpClassChanges = {};
  for (const [path, value] of Object.entries(flat)) {
    if (path.startsWith("system.niveaux_par_classe.")) levelChanges[path.slice("system.niveaux_par_classe.".length)] = value;
    if (path.startsWith("system.xp_par_classe.")) xpClassChanges[path.slice("system.xp_par_classe.".length)] = value;
  }
  if (Object.keys(levelChanges).length) payload = multiclassUpdatePayload(actor, null, null, levelChanges);
  else if (Object.keys(xpClassChanges).length) payload = multiclassUpdatePayload(actor, null, xpClassChanges, null);
  if (!payload) return;
  foundry.utils.mergeObject(changes, foundry.utils.expandObject(payload), { inplace: true });
}

async function recalcActor(actor) {
  if (!actor || actor.type !== "personnage" || !multiclassEnabled(actor)) return null;
  const payload = multiclassUpdatePayload(actor);
  if (!payload) return null;
  await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-recalc" });
  return payload;
}

async function updateDirectMulticlassField(sheet, input) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor || actor.type !== "personnage" || !multiclassEnabled(actor) || !input?.name) return false;
  const name = String(input.name);
  const value = Math.max(0, Math.floor(num(input.value, 0)));
  let payload = null;

  if (name.startsWith("system.xp_par_classe.")) {
    const slug = name.slice("system.xp_par_classe.".length);
    if (!slug) return false;
    payload = multiclassUpdatePayload(actor, null, { [slug]: value }, null);
  } else if (name.startsWith("system.niveaux_par_classe.")) {
    const slug = name.slice("system.niveaux_par_classe.".length);
    if (!slug) return false;
    payload = multiclassUpdatePayload(actor, null, null, { [slug]: Math.max(1, value) });
  }

  if (!payload) return false;
  await actor.update(payload, { [INTERNAL]: true, add2eInternal: true, add2eReason: "multiclass-direct-field" });
  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  log("[DIRECT_FIELD_SYNC]", { actor: actor.name, field: name, value, payload });
  return true;
}

function bindDirectMulticlassFields(sheet, html) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor || actor.type !== "personnage") return;
  const root = html?.jquery ? html[0] : html;
  if (!root?.querySelector || root.dataset.add2eMulticlassDirectFields === VERSION) return;
  root.dataset.add2eMulticlassDirectFields = VERSION;
  root.addEventListener("change", ev => {
    const input = ev.target?.closest?.('input[name^="system.xp_par_classe."], input[name^="system.niveaux_par_classe."]');
    if (!input || !root.contains(input)) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation?.();
    updateDirectMulticlassField(sheet, input).catch(err => warn("[DIRECT_FIELD_SYNC_ERROR]", err));
  }, true);
}

function installDropWrapper() {
  const SheetClass = globalThis.Add2eActorSheet;
  if (!SheetClass?.prototype?._onDrop) return false;
  if (SheetClass.prototype._add2eMulticlassWrapped === VERSION) return true;
  const original = SheetClass.prototype._onDrop;
  SheetClass.prototype._onDrop = async function add2eMulticlassDropWrapped(event, data = null) {
    const actor = this.actor;
    if (!actor || actor.type !== "personnage") return original.call(this, event, data);
    const itemData = await resolveDroppedItemData(event, data);
    if (!itemData || !["classe", "race"].includes(itemData.type)) return original.call(this, event, data);
    if (itemData.type === "classe" && classItems(actor).length >= 1) {
      const choice = await showClassDropChoiceDialog(actor, itemData);
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (choice?.action === "monoclass") return applyClassAsMonoclass(actor, itemData, this);
      if (choice?.action === "multiclass" && choice.option) return addClassAsMulticlass(actor, choice.option, this);
      ui.notifications.info("Drop de classe annulé.");
      return false;
    }
    if (itemData.type === "race" && classItems(actor).length > 1) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return applyRaceForMulticlass(actor, itemData, this);
    }
    return original.call(this, event, data);
  };
  SheetClass.prototype._add2eMulticlassWrapped = VERSION;
  log("[DROP_WRAPPER_INSTALLED]", { version: VERSION });
  return true;
}

installGetDataPatch();

Hooks.once("ready", () => {
  installGetDataPatch();
  setTimeout(() => {
    if (!installDropWrapper()) {
      setTimeout(installDropWrapper, 500);
      setTimeout(installDropWrapper, 1500);
    }
  }, 0);
  if (game.user?.isGM) {
    for (const actor of game.actors?.filter(a => a.type === "personnage" && multiclassEnabled(a)) ?? []) recalcActor(actor).catch(err => warn("[READY_RECALC_ERROR]", { actor: actor.name, err }));
  }
});

Hooks.on("renderActorSheet", bindDirectMulticlassFields);
Hooks.on("renderAdd2eActorSheet", bindDirectMulticlassFields);

Hooks.on("preUpdateActor", (actor, changes, options) => {
  if (options?.[INTERNAL] || options?.add2eInternal) return true;
  mergeMulticlassChanges(actor, changes);
  return true;
});

Hooks.on("createItem", item => {
  const actor = item?.parent;
  if (actor?.documentName === "Actor" && actor.type === "personnage" && String(item.type || "").toLowerCase() === "classe") setTimeout(() => recalcActor(actor).catch(err => warn("[CREATE_ITEM_RECALC_ERROR]", err)), 0);
});

Hooks.on("deleteItem", item => {
  const actor = item?.parent;
  if (actor?.documentName === "Actor" && actor.type === "personnage" && String(item.type || "").toLowerCase() === "classe") setTimeout(() => recalcActor(actor).catch(err => warn("[DELETE_ITEM_RECALC_ERROR]", err)), 0);
});

globalThis.add2eMulticlassEnabled = multiclassEnabled;
globalThis.add2eMulticlassAllowedCombosFromRace = allowedCombosFromRace;
globalThis.add2eRaceAllowsClassSet = raceAllowsClassSet;
globalThis.add2eRecalcMulticlassActor = recalcActor;
globalThis.add2eMulticlassUpdatePayload = multiclassUpdatePayload;
globalThis.add2eCompatibleMulticlassClassCandidates = compatibleMulticlassClassCandidates;
globalThis.add2eMulticlassMinXpForClassLevel = minXpForClassLevel;
globalThis.add2eMulticlassLevelForClassXp = levelForClassXp;
globalThis.add2eMulticlassRaceCandidatesForClass = raceCandidatesForClass;
globalThis.add2eMulticlassClassRaceMaxLevel = classRaceMaxLevel;
globalThis.add2eMulticlassDirectFieldSync = updateDirectMulticlassField;
globalThis.add2eCleanMonoclassAfterReplace = cleanupAfterMonoclassReplace;

log("[LOADED]", { version: VERSION });
