// ADD2E — Actor sheet drop — route sûre
// Compatible Foundry V13/V14/V15. Aucun Dialog V1.
// Les drops de classe/race sont délégués aux routeurs spécialisés.

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant _onDrop.");

const ADD2E_ACTOR_SHEET_DROP_VERSION = "2026-06-25-actor-drop-safe-v2";
globalThis.ADD2E_ACTOR_SHEET_DROP_VERSION = ADD2E_ACTOR_SHEET_DROP_VERSION;

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

async function resolveDropItemData(raw) {
  if (typeof globalThis.add2eResolveDropItemDataCompendiumFirst === "function") {
    const resolved = await globalThis.add2eResolveDropItemDataCompendiumFirst(raw).catch(() => null);
    if (resolved) return clone(resolved);
  }
  if (raw?.pack && (raw.id || raw._id)) {
    const pack = game.packs?.get(raw.pack);
    const document = pack ? await pack.getDocument(raw.id ?? raw._id).catch(() => null) : null;
    if (document instanceof Item) return document.toObject();
  }
  if (raw?.uuid) {
    const document = await fromUuid(raw.uuid).catch(() => null);
    if (document instanceof Item) return document.toObject();
  }
  return raw?.data ? clone(raw.data) : null;
}

function rawTags(itemData) {
  const system = itemData?.system ?? {};
  const flags = itemData?.flags?.add2e ?? {};
  return [system.tags, system.effectTags, system.effecttags, flags.tags, flags.effectTags, flags.effecttags]
    .flatMap(values).map(norm).filter(Boolean);
}

function isThrownWeapon(itemData) {
  if (itemType(itemData) !== "arme") return false;
  const system = itemData?.system ?? {};
  const tags = rawTags(itemData);
  return system.arme_de_jet === true || system.armeDeJet === true || system.isThrown === true
    || tags.some(tag => ["usage:lancer", "usage_lancer", "usage:jet", "arme_de_jet", "type_arme:arme_de_jet"].includes(tag));
}

function projectileType(tags) {
  for (const tag of tags) {
    for (const prefix of ["munition:", "projectile:", "ammo:", "ammunition:"]) {
      if (tag.startsWith(prefix) && tag.length > prefix.length) return tag.slice(prefix.length);
    }
  }
  return "projectile";
}

function looksLikeProjectile(itemData) {
  if (!itemData || !["arme", "objet"].includes(itemType(itemData)) || isThrownWeapon(itemData)) return false;
  const system = itemData.system ?? {};
  const fields = [system.categorie, system.category, system.type, system.sousType, system.sous_type].map(norm);
  const tags = rawTags(itemData);
  return fields.includes("munition") || fields.includes("projectile")
    || tags.some(tag => tag === "munition" || tag === "projectile" || tag.startsWith("munition:") || tag.startsWith("projectile:") || tag === "trait:munition" || tag === "trait:projectile");
}

function add2eDropNormalizeProjectileItemData(itemData) {
  if (!looksLikeProjectile(itemData)) return itemData;
  const data = clone(itemData);
  const type = projectileType(rawTags(data));
  data.type = "objet";
  data.system = data.system ?? {};
  data.flags = data.flags ?? {};
  data.flags.add2e = data.flags.add2e ?? {};
  const tags = new Set([...rawTags(data), "munition", "projectile", "trait:munition", `munition:${type}`, `projectile:${type}`]);
  Object.assign(data.system, {
    categorie: "munition",
    category: "munition",
    type: "munition",
    sousType: type,
    sous_type: type,
    munitionType: type,
    munition_type: type,
    tags: [...tags]
  });
  Object.assign(data.flags.add2e, {
    kind: "projectile",
    vendorKind: "projectile",
    category: "munition",
    projectile: true,
    ammunition: true,
    sourceItemType: itemType(itemData),
    tags: [...tags]
  });
  return data;
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
  const key = String(entry?.key ?? "").trim().toLowerCase();
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
  const key = String(entry?.key ?? "").trim().toLowerCase();
  if (!actor || !existingSort || !key) return { handled: false };
  const current = new Set(values(existingSort.flags?.add2e?.knownSpellLists ?? existingSort.system?.spellLists).map(value => String(value).toLowerCase()));
  if (current.has(key)) {
    ui.notifications.warn(`"${existingSort.name}" est déjà connu pour cette liste.`);
    return { handled: true, updated: false };
  }
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
  actor.sheet?.render?.(false);
  return { handled: true, updated: true };
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
  if (!root || root.dataset.add2eDropAnywhereBound === "safe-v2") return;
  root.dataset.add2eDropAnywhereBound = "safe-v2";
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

globalThis.Add2eActorSheet.prototype._onDrop = async function add2eSafeOnDrop(event, data = null) {
  event.preventDefault?.();
  event.stopPropagation?.();
  let raw = data;
  if (!raw) {
    try { raw = JSON.parse(event.dataTransfer?.getData("text/plain") || "{}"); }
    catch (_error) { return false; }
  }
  if (raw?.type !== "Item") return false;
  let itemData = await resolveDropItemData(raw);
  if (!itemData) return false;
  itemData = add2eDropNormalizeProjectileItemData(itemData);
  const type = itemType(itemData);
  if (!new Set(["arme", "armure", "sort", "classe", "race", "objet"]).has(type)) return false;

  if (["classe", "race"].includes(type)) return applyClassOrRaceDrop(this, itemData);

  let spellCheck = null;
  if (type === "sort" && typeof globalThis.add2eCanActorUseSpell === "function") {
    const source = itemData.uuid ? await fromUuid(itemData.uuid).catch(() => null) : null;
    const spellSource = source?.system ? source : { name: itemData.name, type: itemData.type, system: itemData.system, flags: itemData.flags };
    spellCheck = globalThis.add2eCanActorUseSpell(this.actor, spellSource);
    if (!spellCheck?.sortLists?.length) {
      ui.notifications.error(`Sort non migré : “${spellSource.name}” n’a pas system.spellLists.`);
      return false;
    }
    if (!spellCheck.ok) {
      ui.notifications.error(`${this.actor.name} ne peut pas apprendre ou préparer “${spellSource.name}”.`);
      return false;
    }
    itemData = markManualSpellList(itemData, spellCheck.entry);
  }

  const existing = Array.from(this.actor.items ?? []).find(item => item.name === itemData.name && itemType(item) === type) ?? null;
  if (existing) {
    if (type === "sort" && sameSpell(existing, itemData) && spellCheck?.entry) {
      const result = await add2eDropLearnSpellListOnExisting(this.actor, existing, spellCheck.entry);
      if (result?.handled) return result.updated;
    }
    ui.notifications.warn(`"${itemData.name}" est déjà présent sur cet acteur.`);
    return false;
  }

  const [created] = await this.actor.createEmbeddedDocuments("Item", [clone(itemData)], { add2eInternal: true });
  if (!created) return false;
  await applyItemEffects(this.actor, created);
  this._add2eRememberActiveTab?.();
  this.render(false);
  return true;
};

if (!globalThis.Add2eActorSheet.prototype.__add2eDropAnywhereBoundSafeV2) {
  globalThis.Add2eActorSheet.prototype.__add2eDropAnywhereBoundSafeV2 = true;
  const previousOnRender = globalThis.Add2eActorSheet.prototype._onRender;
  globalThis.Add2eActorSheet.prototype._onRender = async function add2eSafeDropOnRender(context, options = {}) {
    const result = await previousOnRender.call(this, context, options);
    bindDropAnywhere(this);
    return result;
  };
}

try { globalThis.add2eDropPurgeClassContent = add2eDropPurgeClassContent; } catch (_error) {}
try { globalThis.add2eDropBulkDelete = add2eDropBulkDelete; } catch (_error) {}
try { globalThis.add2eDropIsBoutiqueConsumable = isBoutiqueConsumable; } catch (_error) {}
try { globalThis.add2eDropLearnSpellListOnExisting = add2eDropLearnSpellListOnExisting; } catch (_error) {}
try { globalThis.add2eDropNormalizeProjectileItemData = add2eDropNormalizeProjectileItemData; } catch (_error) {}