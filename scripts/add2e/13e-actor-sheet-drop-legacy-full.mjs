// ADD2E — Actor sheet drop — route unique
// Compatible Foundry V13/V14/V15. Aucun Dialog V1.
// Les domaines spécialisés sont appelés directement, sans wrapper de prototype.

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant le routeur de drop.");

const ADD2E_ACTOR_SHEET_DROP_VERSION = "2026-08-10-native-drop-handler-v8";
const ADD2E_SPELL_DROP_PENDING = globalThis.ADD2E_SPELL_DROP_PENDING instanceof Set
  ? globalThis.ADD2E_SPELL_DROP_PENDING
  : new Set();
globalThis.ADD2E_ACTOR_SHEET_DROP_VERSION = ADD2E_ACTOR_SHEET_DROP_VERSION;
globalThis.ADD2E_SPELL_DROP_PENDING = ADD2E_SPELL_DROP_PENDING;

function clone(value) {
  if (value === undefined || value === null) return value;
  try { return foundry.utils.deepClone(value); } catch (_error) {}
  try { return foundry.utils.duplicate(value); } catch (_error) {}
  return JSON.parse(JSON.stringify(value));
}

function norm(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "")
    .replace(/[^a-z0-9:]+/g, "_").replace(/^_+|_+$/g, "");
}

function values(value) {
  if (Array.isArray(value)) return value.flatMap(values).filter(Boolean);
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") return Object.values(value).flatMap(values).filter(Boolean);
  return [value];
}

function itemType(item) { return String(item?.type ?? "").toLowerCase(); }
function spellLevel(item) { return Number(item?.system?.niveau ?? item?.system?.level ?? item?.system?.niveau_sort ?? item?.system?.spellLevel ?? 1) || 1; }
function sameSpell(left, right) {
  return itemType(left) === "sort" && itemType(right) === "sort"
    && norm(left?.name) === norm(right?.name)
    && spellLevel(left) === spellLevel(right);
}

function spellListKey(entry) {
  const key = String(entry?.key ?? entry ?? "").trim();
  return typeof globalThis.add2eNormalizeSpellKey === "function" ? globalThis.add2eNormalizeSpellKey(key) : norm(key);
}

function spellDropKey(actor, itemData, entry) {
  const actorKey = String(actor?.uuid ?? actor?.id ?? "");
  return `${actorKey}|${spellListKey(entry)}|${spellLevel(itemData)}|${norm(itemData?.name)}`;
}

function markCurrentDropName(itemData, currentName = "") {
  if (!itemData) return itemData;
  const data = clone(itemData);
  const name = String(currentName || data.name || "").trim();
  data.flags ??= {};
  data.flags.add2e ??= {};
  if (name) data.flags.add2e.dropCurrentName = name;
  return data;
}

async function resolveDropItemData(raw) {
  if (raw?.data) {
    const current = markCurrentDropName(raw.data, raw.data?.name ?? raw.name);
    if (current) return current;
  }
  if (raw?.uuid) {
    const document = await fromUuid(raw.uuid).catch(() => null);
    if (document instanceof Item) return markCurrentDropName(document.toObject(), document.name);
  }
  if (raw?.pack && (raw.id || raw._id)) {
    const pack = game.packs?.get(raw.pack);
    const document = pack ? await pack.getDocument(raw.id ?? raw._id).catch(() => null) : null;
    if (document instanceof Item) return markCurrentDropName(document.toObject(), document.name);
  }
  if (typeof globalThis.add2eResolveDropItemDataCompendiumFirst === "function") {
    const resolved = await globalThis.add2eResolveDropItemDataCompendiumFirst(raw).catch(() => null);
    if (resolved) return markCurrentDropName(resolved, raw?.name ?? resolved?.name);
  }
  return null;
}

function rawTags(itemData) {
  const system = itemData?.system ?? {};
  const flags = itemData?.flags?.add2e ?? {};
  return [system.tags, system.effectTags, system.effecttags, flags.tags, flags.effectTags, flags.effecttags]
    .flatMap(values).map(norm).filter(Boolean);
}

function isBoutiqueConsumable(item) {
  if (itemType(item) !== "objet") return false;
  const system = item?.system ?? {};
  const fields = [system.categorie, system.category, system.sousType, system.sous_type, system.type].map(norm);
  const tags = rawTags(item);
  return fields.includes("composant_sort") || fields.includes("munition") || tags.includes("composant_sort") || tags.includes("munition") || tags.includes("trait:munition") || tags.some(tag => tag.startsWith("composant:")) || item?.flags?.add2e?.purchasedFromVendor === true;
}

function classSources(classDocs) {
  const ids = new Set((classDocs ?? []).map(item => String(item?.id ?? "")).filter(Boolean));
  const slugs = new Set((classDocs ?? []).map(item => norm(item?.system?.slug ?? item?.name)).filter(Boolean));
  const uuids = new Set((classDocs ?? []).map(item => String(item?.uuid ?? "")).filter(Boolean));
  return { ids, slugs, uuids };
}

function belongsToClass(item, sources) {
  const flags = item?.flags?.add2e ?? {};
  const id = String(flags.autoGrantedByClassId ?? flags.sourceClassId ?? flags.sourceItemId ?? flags.classId ?? "");
  const slug = norm(flags.autoGrantedByClass ?? flags.sourceClassSlug ?? flags.sourceClasse ?? flags.sourceClass ?? flags.classSlug ?? "");
  return (id && sources.ids.has(id)) || (slug && sources.slugs.has(slug));
}

async function add2eDropPurgeClassContent(actor, classDocs = []) {
  if (!actor || !classDocs.length) return { spellsDeleted: 0, effectsDeleted: 0 };
  const sources = classSources(classDocs);
  const spellIds = actor.items
    .filter(item => itemType(item) === "sort" && belongsToClass(item, sources))
    .map(item => item.id).filter(Boolean);
  const effectIds = actor.effects
    .filter(effect => {
      const flags = effect?.flags?.add2e ?? {};
      const origin = String(effect?.origin ?? "");
      const id = String(flags.sourceItemId ?? flags.sourceClassId ?? flags.classId ?? "");
      const slug = norm(flags.sourceClasse ?? flags.sourceClass ?? flags.classSlug ?? flags.classe ?? "");
      return [...sources.uuids].some(uuid => uuid && origin === uuid) || (id && sources.ids.has(id)) || (slug && sources.slugs.has(slug));
    })
    .map(effect => effect.id).filter(Boolean);
  if (effectIds.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effectIds, { add2eInternal: true, add2eDropPurge: true, render: false });
  if (spellIds.length) await actor.deleteEmbeddedDocuments("Item", spellIds, { add2eInternal: true, add2eDropPurge: true, render: false });
  return { spellsDeleted: spellIds.length, effectsDeleted: effectIds.length };
}

async function add2eDropBulkDelete(actor, documentName, ids) {
  const collection = documentName === "Item" ? actor?.items : actor?.effects;
  const existing = [...new Set((ids ?? []).filter(Boolean))].filter(id => collection?.has?.(id));
  if (!existing.length) return { deleted: 0, ids: [] };
  await actor.deleteEmbeddedDocuments(documentName, existing, { add2eInternal: true, add2eDropPurge: true, render: false });
  return { deleted: existing.length, ids: existing };
}

function markManualSpellList(itemData, entry) {
  const key = spellListKey(entry);
  if (!itemData || !key) return itemData;
  const data = clone(itemData);
  data.flags = data.flags ?? {};
  data.flags.add2e = data.flags.add2e ?? {};
  data.flags.add2e.learnedSpellLists = [key];
  data.flags.add2e.knownSpellLists = [key];
  data.flags.add2e.manuallyLearnedSpell = true;
  data.flags.add2e.lastLearnedSpellList = key;
  foundry.utils.setProperty(data, "system.spellLists", [key]);
  return data;
}

async function add2eDropLearnSpellListOnExisting(actor, existingSort, entry) {
  const key = spellListKey(entry);
  if (!actor || !existingSort || !key) return { handled: false };
  const current = new Set(values(existingSort.flags?.add2e?.knownSpellLists ?? existingSort.system?.spellLists).map(spellListKey).filter(Boolean));
  if (current.has(key)) return { handled: true, updated: false, alreadyKnown: true };

  current.add(key);
  const lists = [...current];
  await existingSort.update({
    "flags.add2e.learnedSpellLists": lists,
    "flags.add2e.knownSpellLists": lists,
    "flags.add2e.manuallyLearnedSpell": true,
    "flags.add2e.lastLearnedSpellList": key,
    "system.spellLists": lists
  }, { add2eInternal: true, add2eSpellLearnList: true });
  ui.notifications.info(`"${existingSort.name}" ajouté à la liste ${entry?.label || key}.`);
  return { handled: true, updated: true, alreadyKnown: false };
}

async function applyItemEffects(actor, item) {
  if (!actor || itemType(item) === "sort" || !item.effects?.contents?.length) return;
  const effects = item.effects.contents.map(effect => {
    const data = foundry.utils.duplicate(effect.toObject());
    data.origin = item.uuid;
    data.disabled = false;
    data.transfer = false;
    data.flags = data.flags ?? {};
    data.flags.add2e = {
      ...(data.flags.add2e ?? {}),
      sourceType: item.type,
      sourceItemId: item.id,
      sourceItemUuid: item.uuid
    };
    return data;
  });
  if (effects.length) await actor.createEmbeddedDocuments("ActiveEffect", effects, { add2eInternal: true });
}

async function renderDropResult(sheet, actor) {
  const application = sheet ?? actor?.sheet ?? null;
  if (!application) return false;
  try {
    const rendered = typeof application._add2eNativeRender === "function"
      ? application._add2eNativeRender(true)
      : application.render?.({ force: true });
    await Promise.resolve(rendered);
    return true;
  } catch (error) {
    console.warn("[ADD2E][DROP][RENDER_ERROR]", { actor: actor?.name, error });
    return false;
  }
}

async function finalizeSpellDrop(sheet, actor) {
  const expand = globalThis.add2eRequestActorSpellFamilyExpansion ?? globalThis.add2eExpandActorSpellFamilies;
  try {
    if (typeof expand === "function") await expand(actor);
  } catch (error) {
    console.error("[ADD2E][DROP][SPELL_FAMILY_ERROR]", { actor: actor?.name, error });
    ui.notifications?.error?.("Le sort a été ajouté, mais sa famille n’a pas pu être synchronisée.");
  }
  return renderDropResult(sheet, actor);
}

function rootFor(sheet) {
  const element = sheet?.element;
  return element?.jquery ? element[0] : element;
}

function isItemDrag(event) {
  try { return JSON.parse(event?.dataTransfer?.getData("text/plain") || "{}").type === "Item"; }
  catch (_error) { return false; }
}

function bindDropAnywhere(sheet) {
  const root = rootFor(sheet);
  if (!root || root.dataset.add2eDropAnywhereBound === "safe-v4") return;
  root.dataset.add2eDropAnywhereBound = "safe-v4";
  root.addEventListener("dragover", event => {
    if (!isItemDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, true);
  root.addEventListener("drop", async event => {
    if (!isItemDrag(event) || event.__add2eDropAnywhereHandled) return;
    event.__add2eDropAnywhereHandled = true;
    event.preventDefault();
    event.stopPropagation();
    await sheet._onDrop(event);
  }, true);
}

async function applyClassOrRaceDrop(sheet, itemData) {
  const actor = sheet.actor;
  if (itemType(itemData) === "race") {
    if (classItems(actor).length > 1) return globalThis.add2eApplyRaceForMulticlass?.(actor, itemData, sheet) ?? false;
    return !!(await globalThis.add2eApplyRaceItemDataToActor?.(actor, itemData, sheet, { notify: true }));
  }
  if (itemType(itemData) === "classe") {
    if (classItems(actor).length) {
      ui.notifications.warn("Le drop de classe est géré par le routeur multiclasses.");
      return false;
    }
    return !!(await globalThis.add2eApplyClassItemDataToActor?.(actor, itemData, sheet, { notify: true, reason: "safe-class-drop" }));
  }
  return false;
}

function classItems(actor) {
  return Array.from(actor?.items ?? []).filter(item => itemType(item) === "classe");
}

async function routeClassOrRaceDrop(sheet, itemData) {
  const router = globalThis.add2eRouteClassRaceDrop;
  if (typeof router !== "function") {
    throw new Error("Le routeur canonique ADD2E classe/race est indisponible.");
  }
  const routed = await router(sheet, itemData);
  if (routed !== undefined) return routed;
  return applyClassOrRaceDrop(sheet, itemData);
}

async function mergeDroppedAmmunition(sheet, event) {
  const merge = globalThis.add2eTryMergeDroppedAmmunition;
  if (typeof merge !== "function") {
    throw new Error("Le propriétaire canonique ADD2E des piles de munitions est indisponible.");
  }
  return merge(sheet, event);
}

async function handleActorSheetDrop(sheet, event, data = null) {
  if (!sheet?.actor) return false;
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (!data && await mergeDroppedAmmunition(sheet, event)) return false;

  let raw = data;
  if (!raw) {
    try { raw = JSON.parse(event?.dataTransfer?.getData("text/plain") || "{}"); }
    catch (_error) { return false; }
  }
  if (raw?.type !== "Item") return false;
  const itemData = await resolveDropItemData(raw);
  if (!itemData) return false;
  const type = itemType(itemData);
  if (!new Set(["arme", "armure", "sort", "classe", "race", "objet"]).has(type)) return false;

  if (["classe", "race"].includes(type)) return routeClassOrRaceDrop(sheet, itemData);

  let spellCheck = null;
  let pendingKey = "";
  if (type === "sort" && typeof globalThis.add2eCanActorUseSpell === "function") {
    const source = itemData.uuid ? await fromUuid(itemData.uuid).catch(() => null) : null;
    const spellSource = source?.system ? source : { name: itemData.name, type: itemData.type, system: itemData.system, flags: itemData.flags };
    spellCheck = globalThis.add2eCanActorUseSpell(sheet.actor, spellSource);
    if (!spellCheck?.sortLists?.length) {
      ui.notifications.error(`Sort non migré : “${spellSource.name}” n’a pas system.spellLists.`);
      return false;
    }
    if (!spellCheck.ok) {
      ui.notifications.error(`${sheet.actor.name} ne peut pas apprendre ou préparer “${spellSource.name}”.`);
      return false;
    }
    const markedItemData = markManualSpellList(itemData, spellCheck.entry);
    pendingKey = spellDropKey(sheet.actor, markedItemData, spellCheck.entry);
    if (ADD2E_SPELL_DROP_PENDING.has(pendingKey)) {
      ui.notifications?.info?.(`Ajout de “${markedItemData.name}” en cours.`);
      return true;
    }
    ADD2E_SPELL_DROP_PENDING.add(pendingKey);
    Object.assign(itemData, markedItemData);
  }

  try {
    const existing = Array.from(sheet.actor.items ?? []).find(item => item.name === itemData.name && itemType(item) === type) ?? null;
    if (existing) {
      if (type === "sort" && sameSpell(existing, itemData) && spellCheck?.entry) {
        const result = await add2eDropLearnSpellListOnExisting(sheet.actor, existing, spellCheck.entry);
        if (result?.handled) {
          await finalizeSpellDrop(sheet, sheet.actor);
          if (result.alreadyKnown) ui.notifications?.info?.(`“${existing.name}” est déjà connu pour cette liste.`);
          return true;
        }
      }
      ui.notifications.warn(`"${itemData.name}" est déjà présent sur cet acteur.`);
      return false;
    }

    const [created] = await sheet.actor.createEmbeddedDocuments("Item", [clone(itemData)], { add2eInternal: true, add2eCurrentDropName: true });
    if (!created) return false;
    await applyItemEffects(sheet.actor, created);
    sheet._add2eRememberActiveTab?.();
    if (type === "sort") await finalizeSpellDrop(sheet, sheet.actor);
    else await renderDropResult(sheet, sheet.actor);
    return true;
  } finally {
    if (pendingKey) ADD2E_SPELL_DROP_PENDING.delete(pendingKey);
  }
}

function isStorageActor(actor) {
  if (!actor || actor.documentName !== "Actor") return false;
  const flags = actor.flags?.add2e ?? {};
  const role = norm(flags.role ?? flags.actorRole ?? actor.system?.role ?? actor.system?.actorRole ?? "");
  const name = norm(actor.name);
  return flags.isVendor === true || flags.isArmorer === true || flags.isLoot === true || flags.isContainer === true
    || flags.vendor === true || flags.armorer === true || flags.loot === true || flags.container === true
    || ["vendor", "vendeur", "marchand", "armorer", "armurier", "loot", "butin", "container", "conteneur", "coffre"].includes(role)
    || name === "armurier" || name.startsWith("marchand_") || name.startsWith("coffre_");
}

function isMagicItem(item) {
  if (!item || !["arme", "armure", "objet"].includes(itemType(item))) return false;
  const system = item.system ?? {};
  const flags = item.flags?.add2e ?? {};
  return system.magique === true || system.magic === true || flags.isMagicItem === true
    || String(system.categorie ?? "").toLowerCase().includes("magique")
    || rawTags(item).some(tag => tag.includes("magique"));
}

function renderActorApplications(actor) {
  if (!actor?.id) return;
  for (const app of Object.values(ui.windows ?? {})) {
    const document = app?.actor ?? app?.document ?? app?.object ?? null;
    if (document?.documentName !== "Actor" || String(document.id) !== String(actor.id)) continue;
    try { app.render?.({ force: true }); continue; } catch (_error) {}
    try { app.render?.(true); } catch (_error) {}
  }
}

Hooks.on("createItem", async (item, options = {}, userId = null) => {
  const actor = item?.parent;
  if (actor?.documentName !== "Actor" || String(userId ?? game.user?.id) !== String(game.user?.id)) return;

  const droppedName = String(item.flags?.add2e?.dropCurrentName ?? "").trim();
  const storage = isStorageActor(actor);
  const magic = isMagicItem(item);
  const currentTrueName = String(item.system?.nom ?? item.system?.nom_reel ?? item.system?.trueName ?? "").trim();
  const wantedName = droppedName || (storage ? currentTrueName : "");
  const hasDropCurrentName = item.flags?.add2e?.dropCurrentName !== undefined;
  const update = {};

  if (wantedName && String(item.name ?? "").trim() !== wantedName) update.name = wantedName;
  if (wantedName && currentTrueName !== wantedName) update["system.nom"] = wantedName;
  if (storage && magic) {
    if (item.system?.identifie !== true) update["system.identifie"] = true;
    if (item.system?.identified !== true) update["system.identified"] = true;
    if (item.flags?.add2e?.identified !== true) update["flags.add2e.identified"] = true;
  }

  let changed = false;
  if (Object.keys(update).length) {
    await item.update(update, {
      add2eInternal: true,
      add2eReason: storage ? "storage-item-identification" : "restore-current-drop-name",
      render: false
    });
    changed = true;
  }
  if (hasDropCurrentName) {
    await item.unsetFlag("add2e", "dropCurrentName");
    changed = true;
  }
  if (changed) renderActorApplications(actor);
});

Hooks.on("deleteItem", (item, options = {}, userId = null) => {
  const actor = item?.parent;
  if (actor?.documentName !== "Actor" || String(userId ?? game.user?.id) !== String(game.user?.id)) return;
  const arcaneKind = String(item.system?.arcaneDocument?.kind ?? item.flags?.add2e?.arcaneDocumentKind ?? "").toLowerCase();
  const consumedScroll = options?.add2eArcaneScroll === true || arcaneKind === "spell-scroll";
  if (!consumedScroll) return;

  try {
    const escapedId = globalThis.CSS?.escape ? CSS.escape(String(item.id)) : String(item.id).replace(/(["'\\])/g, "\\$1");
    document.querySelectorAll(`[data-item-id="${escapedId}"], [data-itemid="${escapedId}"], [data-id="${escapedId}"]`).forEach(element => {
      const row = element.closest?.(".item, tr, li, .add2e-scroll-row") ?? element;
      row.remove?.();
    });
  } catch (_error) {}

  queueMicrotask(() => renderActorApplications(actor));
  setTimeout(() => renderActorApplications(actor), 100);
});

try { globalThis.add2eHandleActorSheetDrop = handleActorSheetDrop; } catch (_error) {}
try { globalThis.add2eBindActorSheetDropAnywhere = bindDropAnywhere; } catch (_error) {}
try { globalThis.add2eDropPurgeClassContent = add2eDropPurgeClassContent; } catch (_error) {}
try { globalThis.add2eDropBulkDelete = add2eDropBulkDelete; } catch (_error) {}
try { globalThis.add2eDropIsBoutiqueConsumable = isBoutiqueConsumable; } catch (_error) {}
try { globalThis.add2eDropLearnSpellListOnExisting = add2eDropLearnSpellListOnExisting; } catch (_error) {}
