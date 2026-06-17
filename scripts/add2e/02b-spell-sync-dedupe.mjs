// ============================================================
// ADD2E — Garde anti-doublons pour la synchronisation des sorts
// Version : 2026-06-17-spell-sync-dedupe-v5-materials-cleanup
// ============================================================

const ADD2E_SPELL_SYNC_DEDUPE_VERSION = "2026-06-17-spell-sync-dedupe-v5-materials-cleanup";
globalThis.ADD2E_SPELL_SYNC_DEDUPE_VERSION = ADD2E_SPELL_SYNC_DEDUPE_VERSION;

const ADD2E_SPELL_SYNC_DEDUPE_RUNNING = globalThis.ADD2E_SPELL_SYNC_DEDUPE_RUNNING instanceof Set
  ? globalThis.ADD2E_SPELL_SYNC_DEDUPE_RUNNING
  : new Set();
globalThis.ADD2E_SPELL_SYNC_DEDUPE_RUNNING = ADD2E_SPELL_SYNC_DEDUPE_RUNNING;

function add2eSpellDedupeNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eSpellDedupeClone(value) {
  if (value === undefined || value === null) return value;
  try { return foundry.utils.deepClone(value); } catch (_e) {}
  try { return foundry.utils.duplicate(value); } catch (_e) {}
  return JSON.parse(JSON.stringify(value));
}

function add2eSpellDedupeLevel(system = {}) {
  const raw = system.niveau ?? system.niveau_sort ?? system.spellLevel ?? system.level ?? system.lvl ?? 0;
  const m = String(raw).match(/\d+/);
  return m ? Number(m[0]) || 0 : 0;
}

function add2eSpellDedupeKey(itemLike) {
  const sys = itemLike?.system ?? {};
  const name = add2eSpellDedupeNormalize(itemLike?.name ?? sys.nom ?? sys.name ?? "");
  const level = add2eSpellDedupeLevel(sys);
  if (!name) return "";
  return `${level}|${name}`;
}

function add2eSpellDedupeIsCompendiumTruth(item) {
  const f = item?.flags?.add2e ?? {};
  const source = String(item?._stats?.compendiumSource ?? item?.flags?.core?.sourceId ?? f.sourceUuid ?? f.sourceId ?? "");
  return f.autoGrantedSpellSync === true || !!f.autoGrantedByClassId || !!f.autoGrantedByClass || source.includes("add2e.sorts");
}

function add2eSpellDedupeSortWeight(item) {
  const compendiumTruth = add2eSpellDedupeIsCompendiumTruth(item);
  const prepared = Number(item?.flags?.add2e?.memorizedCount ?? item?.system?.prepared ?? item?.system?.prepare ?? item?.system?.memorise ?? item?.system?.memorized ?? 0) || 0;
  const hasImg = item?.img && !String(item.img).includes("icons/svg/item-bag.svg") && !String(item.img).includes("mystery-man");
  const created = Number(item?._stats?.createdTime ?? 0) || 0;
  return [compendiumTruth ? 0 : 1, prepared > 0 ? 0 : 1, hasImg ? 0 : 1, created || Number.MAX_SAFE_INTEGER];
}

function add2eSpellDedupeCompareKeep(a, b) {
  const aw = add2eSpellDedupeSortWeight(a);
  const bw = add2eSpellDedupeSortWeight(b);
  for (let i = 0; i < Math.max(aw.length, bw.length); i++) {
    const d = (aw[i] ?? 0) - (bw[i] ?? 0);
    if (d !== 0) return d;
  }
  return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
}

function add2eSpellDedupeRunKey(actor) {
  return String(actor?.uuid || actor?.id || actor?.name || "unknown-actor");
}

function add2eSpellDedupeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function add2eSpellDedupeSlug(value) {
  return add2eSpellDedupeText(value)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eSpellDedupeCleanMaterialLabel(value) {
  return add2eSpellDedupeText(value)
    .replace(/[_-]+/g, " ")
    .replace(/^d['’]\s*/i, "")
    .replace(/^(un|une)?\s*peu\s+de\s+/i, "")
    .replace(/^(un|une|du|de la|de l['’]?|des|le|la|les)\s+/i, "")
    .replace(/^(quelques|plusieurs)\s+/i, "")
    .replace(/^petit morceau de\s+/i, "")
    .replace(/^morceau de\s+/i, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?;:]+$/g, "")
    .replace(/^symbole sacre$/i, "symbole sacré")
    .replace(/^gousse ail$/i, "gousse d’ail")
    .replace(/^poudre argent$/i, "poudre d’argent")
    .replace(/^eau benite$/i, "eau bénite")
    .replace(/^eau maudite$/i, "eau maudite")
    .trim();
}

function add2eSpellDedupeIsNoiseMaterial(value) {
  const text = add2eSpellDedupeCleanMaterialLabel(value);
  if (!text) return true;
  if (/^-?\d+(?:[.,]\d+)?$/.test(text)) return true;
  const n = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  if ([
    "true", "false", "oui", "non", "consomme", "non consomme", "nonconsomme", "optionnel", "manuel", "manuel du joueur", "manuel des joueurs",
    "source", "aucun", "null", "undefined", "a completer", "liquide", "liquide consomme"
  ].includes(n)) return true;
  return /^(requi[st]e?s?|necessaire|alternative|variante|composant requis|ingredient materiel|formulation source|source du manuel|sort normal|sort inverse|liquide consomme|selon la regle|regle d arbitrage|la fiole est|son contenu est|disparait quand|disparait quand)\b/.test(n)
    || /\b(manuel des joueurs|formulation source|regle d arbitrage add2e)\b/.test(n);
}

function add2eSpellDedupeSplitMaterialNameAndNote(value) {
  const raw = add2eSpellDedupeText(value);
  const match = raw.match(/\b(?:optionnel|alternative\s*:|ingr[eé]dient\s+mat[eé]riel|consomm[eé]|consomme|non[_\s-]*consomm[eé]|formulation\s+source|manuel\s+(?:du|des)\s+joueurs?|source\s*:|r[eé]f[eé]rence\s*:|r[eè]gle\s+d['’]arbitrage|selon\s+la\s+r[eè]gle|requi[st]e?s?\s+pour|sort\s+normal|sort\s+invers[eé]).*$/i);
  if (!match) return { name: raw, note: "" };
  const idx = match.index ?? raw.length;
  return {
    name: raw.slice(0, idx).replace(/[,;:\s]+$/g, "").trim(),
    note: raw.slice(idx).replace(/^[,;:\s]+/g, "").trim()
  };
}

function add2eSpellDedupeAddMaterialName(list, value) {
  const label = add2eSpellDedupeCleanMaterialLabel(value);
  if (!label || add2eSpellDedupeIsNoiseMaterial(label)) return;
  const key = add2eSpellDedupeSlug(label);
  if (!key || list.some(v => add2eSpellDedupeSlug(v) === key)) return;
  list.push(label);
}

function add2eSpellDedupeCollectMaterialNames(value, list = []) {
  if (value === undefined || value === null || value === "") return list;

  if (Array.isArray(value)) {
    for (const entry of value) add2eSpellDedupeCollectMaterialNames(entry, list);
    return list;
  }

  if (typeof value === "object") {
    const alternatives = value.alternatives ?? value.options ?? value.choix ?? value.auChoix ?? value.or;
    if (Array.isArray(alternatives) && alternatives.length) {
      const alt = [];
      for (const entry of alternatives) add2eSpellDedupeCollectMaterialNames(entry, alt);
      if (alt.length) add2eSpellDedupeAddMaterialName(list, alt.join(" ou "));
      return list;
    }

    const direct = value.nom ?? value.name ?? value.label ?? value.item ?? value.itemName ?? value.component ?? value.composant ?? value.slug ?? value.id;
    if (direct !== undefined && direct !== null && String(direct).trim()) {
      add2eSpellDedupeCollectMaterialNames(direct, list);
      return list;
    }

    for (const [key, entry] of Object.entries(value)) {
      if (["quantite", "quantity", "qty", "nombre", "count", "consomme", "consume", "consumption", "consommation", "source", "reference", "note", "notes", "description", "condition", "conditions"].includes(String(key))) continue;
      add2eSpellDedupeCollectMaterialNames(entry, list);
    }
    return list;
  }

  const { name } = add2eSpellDedupeSplitMaterialNameAndNote(value);
  if (add2eSpellDedupeIsNoiseMaterial(name)) return list;

  for (const part of String(name).split(/[,;|\n]+/g).map(add2eSpellDedupeCleanMaterialLabel).filter(Boolean)) {
    add2eSpellDedupeAddMaterialName(list, part);
  }
  return list;
}

function add2eSpellDedupeCleanSpellMaterialComponents(system = {}) {
  const source = system.composants_materiels ?? system.composants_materiels_objets ?? system.materialComponents ?? system.material_components ?? [];
  const names = add2eSpellDedupeCollectMaterialNames(source, []);
  return names.length ? names : [];
}

async function add2eNormalizeActorSpellMaterials(actor, reason = "sync-material-cleanup") {
  if (!game.user?.isGM || !actor || actor.type !== "personnage") return { updated: 0 };
  const updates = [];

  for (const item of actor.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
    const system = item.system ?? {};
    const clean = add2eSpellDedupeCleanSpellMaterialComponents(system);
    const current = Array.isArray(system.composants_materiels)
      ? system.composants_materiels.map(v => String(v ?? ""))
      : (system.composants_materiels === undefined || system.composants_materiels === null ? [] : [String(system.composants_materiels)]);

    if (JSON.stringify(current) === JSON.stringify(clean)) continue;
    updates.push({ _id: item.id, "system.composants_materiels": clean });
  }

  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates, { add2eInternal: true, add2eSpellSync: true, reason, render: false });
    add2eRerenderActorSheet?.(actor, false);
  }
  return { updated: updates.length };
}

async function add2eSafeDeleteDuplicateActorSpellIds(actor, ids, reason = "manual") {
  const rawIds = Array.isArray(ids) ? ids : [];
  const uniqueIds = [...new Set(rawIds.map(id => String(id ?? "").trim()).filter(Boolean))];
  if (!uniqueIds.length) return { deleted: 0, skippedMissing: 0, requested: 0 };
  const existingIds = uniqueIds.filter(id => actor.items?.get?.(id));
  const missingIds = uniqueIds.filter(id => !actor.items?.get?.(id));
  if (!existingIds.length) return { deleted: 0, skippedMissing: missingIds.length, requested: uniqueIds.length };
  try {
    await actor.deleteEmbeddedDocuments("Item", existingIds, { add2eInternal: true, add2eDedupe: true, reason });
    return { deleted: existingIds.length, skippedMissing: missingIds.length, requested: uniqueIds.length };
  } catch (err) {
    let deleted = 0;
    let skippedMissing = missingIds.length;
    for (const id of existingIds) {
      const item = actor.items?.get?.(id);
      if (!item) { skippedMissing += 1; continue; }
      try { await item.delete({ add2eInternal: true, add2eDedupe: true, reason }); deleted += 1; }
      catch (oneErr) { if (String(oneErr?.message ?? oneErr ?? "").includes("does not exist")) skippedMissing += 1; }
    }
    return { deleted, skippedMissing, requested: uniqueIds.length, error: String(err?.message ?? err ?? "") };
  }
}

async function add2eRemoveDuplicateActorSpells(actor, reason = "manual") {
  if (!actor || actor.type !== "personnage") return { deleted: 0 };
  const runKey = add2eSpellDedupeRunKey(actor);
  if (ADD2E_SPELL_SYNC_DEDUPE_RUNNING.has(runKey)) return { deleted: 0, skippedRunning: true };
  ADD2E_SPELL_SYNC_DEDUPE_RUNNING.add(runKey);
  try {
    const byKey = new Map();
    for (const item of actor.items?.filter?.(i => String(i.type || "").toLowerCase() === "sort") ?? []) {
      const key = add2eSpellDedupeKey(item);
      if (!key || key === "0|") continue;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(item);
    }
    const toDelete = [];
    for (const spells of byKey.values()) {
      if (spells.length < 2) continue;
      const sorted = [...spells].sort(add2eSpellDedupeCompareKeep);
      toDelete.push(...sorted.slice(1).map(s => s.id));
    }
    if (!toDelete.length) return { deleted: 0 };
    return await add2eSafeDeleteDuplicateActorSpellIds(actor, toDelete, reason);
  } finally {
    ADD2E_SPELL_SYNC_DEDUPE_RUNNING.delete(runKey);
  }
}

async function add2eRemoveDuplicateSpellsEverywhere(reason = "manual-all-actors") {
  if (!game.user?.isGM) {
    ui.notifications?.warn?.("Seul le MJ peut nettoyer les sorts en doublon de tous les acteurs.");
    return { actors: 0, deleted: 0 };
  }
  let actors = 0;
  let deleted = 0;
  const results = [];
  for (const actor of game.actors?.filter?.(a => a.type === "personnage") ?? []) {
    actors += 1;
    const result = await add2eRemoveDuplicateActorSpells(actor, reason);
    deleted += Number(result?.deleted ?? 0) || 0;
    results.push({ actor: actor.name, ...result });
  }
  ui.notifications?.info?.(`ADD2E : nettoyage terminé (${deleted} sort(s) doublon(s) supprimé(s)).`);
  return { actors, deleted, results };
}

function add2eInstallSpellSyncDedupeWrapper() {
  const original = globalThis.add2eSyncActorSpellsFromClass;
  if (typeof original !== "function") return false;
  if (original._add2eDedupeWrapped === true) return true;
  const wrapped = async function add2eSyncActorSpellsFromClassDedupe(actor, classItem, options = {}) {
    const syncOptions = {
      ...options,
      forceCacheRefresh: options.forceCacheRefresh ?? options.mode === "replace"
    };
    const result = await original(actor, classItem, syncOptions);
    try {
      const cleanup = await add2eRemoveDuplicateActorSpells(actor, `sync-${options?.mode || "replace"}`);
      if (cleanup.deleted > 0) result.deleted = (Number(result.deleted) || 0) + cleanup.deleted;
    } catch (_err) {}
    try {
      const materialCleanup = await add2eNormalizeActorSpellMaterials(actor, `sync-${options?.mode || "replace"}`);
      if (materialCleanup.updated > 0) result.materialsCleaned = materialCleanup.updated;
    } catch (err) {
      console.warn("[ADD2E][SPELL_SYNC][MATERIAL_CLEANUP_ERROR]", err);
    }
    return result;
  };
  wrapped._add2eDedupeWrapped = true;
  globalThis.add2eSyncActorSpellsFromClass = wrapped;
  return true;
}

Hooks.once("ready", () => {
  if (!add2eInstallSpellSyncDedupeWrapper()) {
    setTimeout(add2eInstallSpellSyncDedupeWrapper, 250);
    setTimeout(add2eInstallSpellSyncDedupeWrapper, 1000);
  }
});

Hooks.on("createItem", async (item, _options, userId) => {
  if (userId !== game.user.id) return;
  const actor = item?.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage") return;
  if (String(item.type || "").toLowerCase() !== "sort") return;
  setTimeout(() => add2eRemoveDuplicateActorSpells(actor, "createItem-sort"), 80);
  setTimeout(() => add2eNormalizeActorSpellMaterials(actor, "createItem-sort"), 120);
});

globalThis.add2eRemoveDuplicateActorSpells = add2eRemoveDuplicateActorSpells;
globalThis.add2eSafeDeleteDuplicateActorSpellIds = add2eSafeDeleteDuplicateActorSpellIds;
globalThis.add2eRemoveDuplicateSpellsEverywhere = add2eRemoveDuplicateSpellsEverywhere;
globalThis.add2eNormalizeActorSpellMaterials = add2eNormalizeActorSpellMaterials;
globalThis.add2eSpellDedupeCleanSpellMaterialComponents = add2eSpellDedupeCleanSpellMaterialComponents;
