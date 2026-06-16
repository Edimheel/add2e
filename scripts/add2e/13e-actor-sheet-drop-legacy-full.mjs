// ADD2E — Actor sheet drop — implémentation compacte legacy
// Version : 2026-06-16-actor-drop-projectile-normalize-before-create-v1
//
// Ce fichier remplace l'ancien 13e monolithique par une implémentation plus courte.
// Le fichier 13e-actor-sheet-drop.mjs reste un chargeur court.

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant _onDrop.");

const ADD2E_ACTOR_SHEET_DROP_VERSION = "2026-06-16-actor-drop-projectile-normalize-before-create-v1";
globalThis.ADD2E_ACTOR_SHEET_DROP_VERSION = ADD2E_ACTOR_SHEET_DROP_VERSION;
console.log("[ADD2E][DROP][VERSION]", ADD2E_ACTOR_SHEET_DROP_VERSION);

function add2eDropClone(value) {
  if (value === undefined || value === null) return value;
  try { return foundry.utils.deepClone(value); } catch (_e) {}
  try { return foundry.utils.duplicate(value); } catch (_e) {}
  return JSON.parse(JSON.stringify(value));
}

function add2eDropArray(value) {
  if (Array.isArray(value)) return value.flatMap(add2eDropArray).filter(v => v !== null && v !== undefined && String(v).trim() !== "");
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") return Object.values(value).flatMap(add2eDropArray).filter(v => v !== null && v !== undefined && String(v).trim() !== "");
  return [value];
}

function add2eDropNormalizeSpellName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eDropSpellLevel(itemOrData) {
  const sys = itemOrData?.system ?? itemOrData ?? {};
  return Number(sys.niveau ?? sys.level ?? sys.niveau_sort ?? sys.spellLevel ?? 1) || 1;
}

function add2eDropSameSpell(a, b) {
  return String(a?.type ?? "").toLowerCase() === "sort"
    && String(b?.type ?? "").toLowerCase() === "sort"
    && add2eDropNormalizeSpellName(a?.name) === add2eDropNormalizeSpellName(b?.name)
    && add2eDropSpellLevel(a) === add2eDropSpellLevel(b);
}

function add2eDropMarkManualSpellList(itemData, targetEntry) {
  const key = String(targetEntry?.key ?? "").trim().toLowerCase();
  if (!itemData || !key) return itemData;
  const data = add2eDropClone(itemData);
  data.flags = data.flags ?? {};
  data.flags.add2e = data.flags.add2e ?? {};
  data.flags.add2e.learnedSpellLists = [key];
  data.flags.add2e.knownSpellLists = [key];
  data.flags.add2e.manuallyLearnedSpell = true;
  data.flags.add2e.lastLearnedSpellList = key;
  foundry.utils.setProperty(data, "system.spellLists", [key]);
  return data;
}

async function add2eResolveDropItemData(raw) {
  if (typeof globalThis.add2eResolveDropItemDataCompendiumFirst === "function") {
    const resolved = await globalThis.add2eResolveDropItemDataCompendiumFirst(raw);
    if (resolved) return resolved;
  }

  if (raw.pack && raw.id) {
    const pack = game.packs.get(raw.pack);
    const doc = pack ? await pack.getDocument(raw.id) : null;
    if (doc instanceof Item) return doc.toObject();
  }

  if (raw.uuid) {
    const doc = await fromUuid(raw.uuid);
    if (doc instanceof Item) return doc.toObject();
  }

  return raw.data ?? null;
}

function add2eDropIsBoutiqueConsumable(item) {
  if (!item || String(item.type ?? "").toLowerCase() !== "objet") return false;
  const sys = item.system ?? {};
  const flags = item.flags?.add2e ?? {};
  const categorie = String(sys.categorie ?? sys.category ?? "").trim().toLowerCase();
  const sousType = String(sys.sousType ?? sys.sous_type ?? "").trim().toLowerCase();
  const type = String(sys.type ?? "").trim().toLowerCase();
  const tags = [
    ...add2eDropArray(sys.tags),
    ...add2eDropArray(sys.effectTags),
    ...add2eDropArray(flags.tags)
  ].map(t => String(t ?? "").trim().toLowerCase()).filter(Boolean);

  return categorie === "composant_sort"
    || categorie === "munition"
    || type === "munition"
    || sousType === "composant"
    || tags.includes("composant_sort")
    || tags.includes("munition")
    || tags.includes("trait:munition")
    || tags.some(t => t.startsWith("composant:"))
    || flags.purchasedFromVendor === true;
}

function add2eDropSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eDropItemTextFields(itemData) {
  const sys = itemData?.system ?? {};
  const flags = itemData?.flags?.add2e ?? {};
  return [
    itemData?.type,
    itemData?.name,
    sys.nom,
    sys.categorie,
    sys.category,
    sys.type,
    sys.sousType,
    sys.sous_type,
    sys.subtype,
    sys.kind,
    sys.slot,
    sys.type_arme,
    sys.famille_arme,
    sys.munitionType,
    sys.munition_type,
    sys.tags,
    sys.effectTags,
    sys.effecttags,
    flags.tags,
    flags.effectTags,
    flags.effecttags,
    flags.kind,
    flags.vendorKind,
    flags.category,
    flags.categorie,
    flags.type,
    flags.sousType,
    flags.sous_type
  ].flatMap(add2eDropArray).map(add2eDropSlug).filter(Boolean);
}

function add2eDropAmmoName(value) {
  const text = add2eDropSlug(value);
  return /(^|_)(fleche|fleches|carreau|carreaux|trait|traits|bille|billes|pierre_de_fronde|pierres_de_fronde)(_|$)/.test(text);
}

function add2eDropAmmoType(itemData) {
  const fields = add2eDropItemTextFields(itemData);
  const joined = fields.join(" ");
  const explicit = add2eDropSlug(itemData?.system?.munitionType ?? itemData?.system?.munition_type ?? itemData?.system?.sousType ?? itemData?.system?.sous_type ?? "");
  if (explicit && !["munition", "munitions", "projectile", "projectiles"].includes(explicit)) return explicit;
  if (/(^|_)(carreau|carreaux)(_|$)/.test(joined)) return "carreau";
  if (/(^|_)(bille|billes|pierre_de_fronde|pierres_de_fronde)(_|$)/.test(joined)) return "bille";
  if (/(^|_)(trait|traits)(_|$)/.test(joined)) return "trait";
  if (/(^|_)(fleche|fleches)(_|$)/.test(joined)) return "fleche";
  return "projectile";
}

function add2eDropIsThrownWeapon(itemData) {
  if (String(itemData?.type ?? "").toLowerCase() !== "arme") return false;
  if (add2eDropAmmoName(itemData?.name)) return false;
  const sys = itemData?.system ?? {};
  const fields = add2eDropItemTextFields(itemData);
  const name = add2eDropSlug(itemData?.name);
  return sys.arme_de_jet === true
    || sys.jet === true
    || fields.some(field => ["arme_de_jet", "usage_lancer", "usage:lancer", "usage_jet", "arme:jet", "type_arme:jet", "type_arme:arme_de_jet"].includes(field))
    || /(dague|poignard|javelot|javeline|hache_de_jet|marteau_de_jet|couteau_de_jet|lance)/.test(name);
}

function add2eDropLooksLikeProjectile(itemData) {
  if (!itemData) return false;
  const documentType = String(itemData.type ?? "").toLowerCase();
  if (!["arme", "objet"].includes(documentType)) return false;
  if (add2eDropIsThrownWeapon(itemData)) return false;
  const fields = add2eDropItemTextFields(itemData);
  if (add2eDropAmmoName(itemData.name)) return true;
  return fields.some(field =>
    field === "munition" ||
    field === "munitions" ||
    field === "projectile" ||
    field === "projectiles" ||
    field === "ammo" ||
    field === "ammunition" ||
    field === "trait:munition" ||
    field === "trait:projectile" ||
    field === "categorie:munition" ||
    field === "categorie:projectile" ||
    field === "type:munition" ||
    field === "type:projectile" ||
    field === "type_arme:munition" ||
    field.startsWith("munition:") ||
    field.startsWith("projectile:")
  );
}

function add2eDropNormalizeProjectileItemData(itemData) {
  if (!add2eDropLooksLikeProjectile(itemData)) return itemData;
  const data = add2eDropClone(itemData);
  const ammoType = add2eDropAmmoType(data);
  data.type = "objet";
  data.system = data.system ?? {};
  data.flags = data.flags ?? {};
  data.flags.add2e = data.flags.add2e ?? {};

  const tags = new Set([
    ...add2eDropArray(data.system.tags),
    ...add2eDropArray(data.system.effectTags),
    ...add2eDropArray(data.flags.add2e.tags),
    "munition",
    "projectile",
    "trait:munition",
    `munition:${ammoType}`,
    `projectile:${ammoType}`
  ].map(String).filter(Boolean));

  data.system.categorie = "munition";
  data.system.category = "munition";
  data.system.type = "munition";
  data.system.sousType = ammoType;
  data.system.sous_type = ammoType;
  data.system.munitionType = ammoType;
  data.system.munition_type = ammoType;
  data.system.tags = [...tags];
  data.flags.add2e.kind = "projectile";
  data.flags.add2e.vendorKind = "projectile";
  data.flags.add2e.category = "munition";
  data.flags.add2e.projectile = true;
  data.flags.add2e.ammunition = true;
  data.flags.add2e.sourceItemType = String(itemData.type ?? "");
  data.flags.add2e.tags = [...tags];
  return data;
}

function add2eShouldDeleteEffectForClassPurgeSafe(effect, itemsToDelete) {
  if (typeof add2eShouldDeleteEffectForClassPurge === "function") return add2eShouldDeleteEffectForClassPurge(effect, itemsToDelete);
  const origin = String(effect?.origin ?? "");
  return itemsToDelete.some(i => origin === i.uuid || origin.includes(i.id));
}

async function add2eDropBulkDelete(actor, documentName, ids) {
  const collection = documentName === "Item" ? actor?.items : actor?.effects;
  const existingIds = [...new Set((ids ?? []).filter(Boolean))].filter(id => collection?.has?.(id));
  if (!existingIds.length) return { deleted: 0, ids: [] };
  await actor.deleteEmbeddedDocuments(documentName, existingIds, { add2eInternal: true, add2eDropPurge: true, render: false });
  return { deleted: existingIds.length, ids: existingIds };
}

async function add2eDropPurgeClassContent(actor) {
  const typesToDelete = ["classe", "sort", "arme", "armure", "spell", "weapon", "armor"];
  const itemsToDelete = actor.items.filter(i =>
    typesToDelete.includes(String(i.type || "").toLowerCase()) || add2eDropIsBoutiqueConsumable(i)
  );
  const effectsToDelete = actor.effects.filter(eff => add2eShouldDeleteEffectForClassPurgeSafe(eff, itemsToDelete));
  const effectResult = await add2eDropBulkDelete(actor, "ActiveEffect", effectsToDelete.map(e => e.id));
  const itemResult = await add2eDropBulkDelete(actor, "Item", itemsToDelete.map(i => i.id));
  return { effectsDeleted: effectResult.deleted, itemsDeleted: itemResult.deleted };
}

async function add2eDropLearnSpellListOnExisting(actor, existingSort, targetEntry) {
  const key = String(targetEntry?.key ?? "").trim().toLowerCase();
  if (!actor || !existingSort || !key) return { handled: false };
  const current = new Set(add2eDropArray(existingSort.flags?.add2e?.knownSpellLists ?? existingSort.system?.spellLists).map(v => String(v).toLowerCase()));
  if (current.has(key)) {
    ui.notifications.warn(`"${existingSort.name}" est déjà connu pour cette liste.`);
    return { handled: true, updated: false };
  }
  current.add(key);
  const lists = [...current].filter(Boolean);
  await existingSort.update({
    "flags.add2e.learnedSpellLists": lists,
    "flags.add2e.knownSpellLists": lists,
    "flags.add2e.manuallyLearnedSpell": true,
    "flags.add2e.lastLearnedSpellList": key,
    "system.spellLists": lists
  }, { add2eInternal: true, add2eSpellLearnList: true });
  ui.notifications.info(`"${existingSort.name}" ajouté à la liste ${targetEntry?.label || key}.`);
  add2eRerenderActorSheet?.(actor, false);
  return { handled: true, updated: true };
}

async function add2eApplyRaceDrop(actor, itemDoc, sheet, autoClassData, autoClassAlignment) {
  const raceSystem = add2eDropClone(itemDoc.system ?? {});
  await actor.update({
    "system.race": itemDoc.name,
    "system.details_race": {
      ...raceSystem,
      name: itemDoc.name,
      label: raceSystem.label || itemDoc.name,
      img: itemDoc.img || raceSystem.img || ""
    },
    "system.bonus_caracteristiques": raceSystem.bonus_caracteristiques ? add2eDropClone(raceSystem.bonus_caracteristiques) : {}
  }, { add2eInternal: true });

  if (typeof sheet?.autoSetCaracAjustements === "function") await sheet.autoSetCaracAjustements();
  if (autoClassData && typeof add2eApplyClassItemDataToActor === "function") {
    await add2eApplyClassItemDataToActor(actor, autoClassData, sheet, {
      alignmentCandidate: autoClassAlignment,
      notify: true,
      reason: "race-drop-class-auto-compat"
    });
  }
}

async function add2eApplyClassDrop(actor, itemDoc, sheet, alignmentCandidate) {
  const classSystem = add2eDropClone(itemDoc.system ?? {});
  const levelClamp = typeof add2eClampLevelToClassMax === "function"
    ? add2eClampLevelToClassMax(actor, actor.system?.niveau, classSystem, { notify: true })
    : { changed: false };
  const alns = typeof add2eClassAllowedAlignments === "function" ? add2eClassAllowedAlignments(classSystem) : [];
  const updates = {
    "system.classe": itemDoc.name,
    "system.details_classe": classSystem,
    "system.spellcasting": classSystem.spellcasting ?? null,
    "system.alignements_autorises": alns
  };
  if (levelClamp.changed) updates["system.niveau"] = levelClamp.level;
  if (alignmentCandidate) updates["system.alignement"] = alignmentCandidate;
  if (itemDoc.system?.progression?.[0]?.sauvegardes) updates["system.sauvegardes"] = foundry.utils.duplicate(itemDoc.system.progression[0].sauvegardes);
  await actor.update(updates, { add2eInternal: true });

  if (typeof sheet?.autoSetCaracAjustements === "function") await sheet.autoSetCaracAjustements();
  if (typeof sheet?.autoSetPointsDeCoup === "function") await sheet.autoSetPointsDeCoup({ syncCurrent: true, force: true, reason: "class-drop" });
  try { if (typeof add2eSyncMonkUnarmedWeapon === "function") await add2eSyncMonkUnarmedWeapon(actor); } catch (e) { console.warn("[ADD2E][MOINE] Erreur synchronisation Main nue après drop classe :", e); }
  try { if (typeof add2eSyncClassPassiveEffect === "function") await add2eSyncClassPassiveEffect(actor); } catch (e) { console.warn("[ADD2E][CLASSE][EFFETS] Erreur synchronisation des effets de classe :", e); }
  try {
    if (typeof add2eSyncActorSpellsFromClass === "function") {
      const spellSync = await add2eSyncActorSpellsFromClass(actor, itemDoc, { mode: "replace", showWait: true });
      if (spellSync?.handled) ui.notifications.info(`Sorts de ${itemDoc.name} synchronisés : ${spellSync.imported} importé(s).`);
    }
  } catch (e) {
    console.error("[ADD2E][CLASSE][SORTS] Erreur synchronisation des sorts après drop classe :", e);
    ui.notifications.error("Erreur pendant la synchronisation des sorts de classe.");
  }
}

async function add2eValidateClassRaceDrop(sheet, itemData) {
  const actor = sheet.actor;
  let classAlignmentCandidate = null;
  let autoRaceData = null;
  let autoClassData = null;
  let autoClassAlignment = null;

  if (itemData.type === "classe") {
    classAlignmentCandidate = typeof add2ePickClassAlignment === "function" ? add2ePickClassAlignment(actor, itemData.system ?? {}) : actor.system?.alignement;
    if (typeof checkClassStatMin === "function") {
      let ok = checkClassStatMin(actor, itemData, null, classAlignmentCandidate, { silent: true, ignoreLevelMax: true });
      if (!ok && typeof add2eFindCompatibleRaceForClass === "function") {
        autoRaceData = add2eFindCompatibleRaceForClass(actor, itemData, classAlignmentCandidate);
        if (autoRaceData) ok = checkClassStatMin(actor, itemData, autoRaceData, classAlignmentCandidate, { silent: true, ignoreLevelMax: true });
      }
      if (!ok) {
        checkClassStatMin(actor, itemData, autoRaceData, classAlignmentCandidate, { silent: false, ignoreLevelMax: true });
        add2eRerenderActorSheet?.(actor);
        return { ok: false };
      }
    }
  }

  if (itemData.type === "race") {
    const existingClass = actor.items.find(i => i.type === "classe");
    if (existingClass && typeof checkClassStatMin === "function") {
      const existingAlignment = typeof add2ePickClassAlignment === "function" ? add2ePickClassAlignment(actor, existingClass.system ?? {}) : actor.system?.alignement;
      let ok = checkClassStatMin(actor, existingClass, itemData, existingAlignment, { silent: true, ignoreLevelMax: true });
      if (!ok && typeof add2eFindCompatibleClassForRace === "function") {
        const compatibleClass = add2eFindCompatibleClassForRace(actor, itemData);
        if (compatibleClass?.classData) {
          autoClassData = compatibleClass.classData;
          autoClassAlignment = compatibleClass.alignmentCandidate;
          ok = checkClassStatMin(actor, autoClassData, itemData, autoClassAlignment, { silent: true, ignoreLevelMax: true });
        }
      }
      if (!ok) {
        checkClassStatMin(actor, autoClassData ?? existingClass, itemData, autoClassAlignment ?? existingAlignment, { silent: false, ignoreLevelMax: true });
        add2eRerenderActorSheet?.(actor);
        return { ok: false };
      }
    }
  }

  return { ok: true, classAlignmentCandidate, autoRaceData, autoClassData, autoClassAlignment };
}

async function add2eDropApplyItemEffects(actor, itemDoc) {
  if (itemDoc.type === "sort" || !itemDoc.effects.contents?.length) return;
  const actorEffects = itemDoc.effects.contents.map(eff => {
    const data = foundry.utils.duplicate(eff.toObject());
    data.origin = itemDoc.uuid;
    data.disabled = false;
    data.transfer = false;
    data.flags = data.flags ?? {};
    data.flags.add2e = {
      ...(data.flags.add2e ?? {}),
      sourceType: itemDoc.type === "classe" ? "classe" : itemDoc.type,
      sourceClasse: itemDoc.type === "classe" ? itemDoc.name : undefined,
      sourceItemId: itemDoc.id,
      sourceItemUuid: itemDoc.uuid
    };
    return data;
  });
  if (actorEffects.length) await actor.createEmbeddedDocuments("ActiveEffect", actorEffects, { add2eInternal: true });
}

function add2eDropGetRoot(sheet) {
  const element = sheet?.element;
  if (!element) return null;
  return element.jquery ? element[0] : element;
}

function add2eDropIsItemDrag(event) {
  try {
    const raw = JSON.parse(event?.dataTransfer?.getData("text/plain") || "{}");
    return raw?.type === "Item";
  } catch (_e) {
    return false;
  }
}

function add2eBindDropAnywhere(sheet) {
  const root = add2eDropGetRoot(sheet);
  if (!root || root.dataset.add2eDropAnywhereBound === "1") return;
  root.dataset.add2eDropAnywhereBound = "1";

  root.addEventListener("dragover", event => {
    if (!add2eDropIsItemDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, true);

  root.addEventListener("drop", async event => {
    if (!add2eDropIsItemDrag(event)) return;
    if (event.__add2eDropAnywhereHandled) return;
    event.__add2eDropAnywhereHandled = true;
    event.preventDefault();
    event.stopPropagation();
    await sheet._onDrop(event);
  }, true);
}

globalThis.Add2eActorSheet.prototype._onDrop = async function _onDrop(event) {
  event.preventDefault?.();
  event.stopPropagation?.();

  let raw;
  try {
    raw = JSON.parse(event.dataTransfer?.getData("text/plain") || "{}");
  } catch (err) {
    console.warn("[ADD2E][DROP][V2] Drop non JSON ignoré.", err);
    return false;
  }

  if (raw.type !== "Item") return false;

  let itemData = await add2eResolveDropItemData(raw);
  if (!itemData) {
    console.warn("[ADD2E] _onDrop impossible de reconstruire itemData", raw);
    return false;
  }

  itemData = add2eDropNormalizeProjectileItemData(itemData);

  const VALID = ["arme", "armure", "sort", "classe", "race", "objet"];
  if (!VALID.includes(itemData.type)) return false;

  let spellCheck = null;
  if (itemData.type === "sort" && typeof add2eCanActorUseSpell === "function") {
    const source = itemData.uuid ? await fromUuid(itemData.uuid).catch?.(() => null) : null;
    const spellSource = source?.system ? source : { name: itemData.name, type: itemData.type, system: itemData.system, flags: itemData.flags };
    spellCheck = add2eCanActorUseSpell(this.actor, spellSource);
    if (!spellCheck?.sortLists?.length) {
      ui.notifications.error(`Sort non migré : “${spellSource.name}” n’a pas system.spellLists.`);
      return false;
    }
    if (!spellCheck.ok) {
      ui.notifications.error(`${this.actor.name} ne peut pas apprendre ou préparer “${spellSource.name}”.`);
      return false;
    }
    itemData = add2eDropMarkManualSpellList(itemData, spellCheck.entry);
  }

  const validation = await add2eValidateClassRaceDrop(this, itemData);
  if (!validation.ok) return false;

  if (itemData.type === "classe" && validation.autoRaceData && typeof add2eApplyRaceItemDataToActor === "function") {
    await add2eApplyRaceItemDataToActor(this.actor, validation.autoRaceData, this, { notify: true, reason: "class-drop-race-auto-compat" });
  }

  if (itemData.type === "race") {
    const raceIds = this.actor.items.filter(i => i.type === "race").map(i => i.id).filter(Boolean);
    if (raceIds.length) await this.actor.deleteEmbeddedDocuments("Item", raceIds, { add2eInternal: true, render: false });
    await this.actor.update({ "system.bonus_caracteristiques": {} }, { add2eInternal: true });
  }

  if (itemData.type === "classe") await add2eDropPurgeClassContent(this.actor);

  if (["arme", "armure", "sort", "objet"].includes(itemData.type)) {
    const existing = this.actor.items.find(i => i.name === itemData.name && i.type === itemData.type);
    if (existing) {
      if (itemData.type === "sort" && add2eDropSameSpell(existing, itemData) && spellCheck?.entry) {
        const result = await add2eDropLearnSpellListOnExisting(this.actor, existing, spellCheck.entry);
        if (result?.handled) return result.updated;
      }
      ui.notifications.warn(`"${itemData.name}" est déjà présent sur cet acteur.`);
      return false;
    }
  }

  const [itemDoc] = await this.actor.createEmbeddedDocuments("Item", [foundry.utils.duplicate(itemData)], { add2eInternal: true });
  if (!itemDoc) return false;

  await add2eDropApplyItemEffects(this.actor, itemDoc);

  if (itemData.type === "race") await add2eApplyRaceDrop(this.actor, itemDoc, this, validation.autoClassData, validation.autoClassAlignment);
  if (itemData.type === "classe") await add2eApplyClassDrop(this.actor, itemDoc, this, validation.classAlignmentCandidate);

  this.render(false);
  return true;
};

if (!globalThis.Add2eActorSheet.prototype.__add2eDropAnywhereBoundV1) {
  globalThis.Add2eActorSheet.prototype.__add2eDropAnywhereBoundV1 = true;
  const previousOnRender = globalThis.Add2eActorSheet.prototype._onRender;
  globalThis.Add2eActorSheet.prototype._onRender = async function add2eDropAnywhereOnRender(context, options = {}) {
    const result = await previousOnRender.call(this, context, options);
    add2eBindDropAnywhere(this);
    return result;
  };
}

try { globalThis.add2eDropPurgeClassContent = add2eDropPurgeClassContent; } catch (_e) {}
try { globalThis.add2eDropBulkDelete = add2eDropBulkDelete; } catch (_e) {}
try { globalThis.add2eDropIsBoutiqueConsumable = add2eDropIsBoutiqueConsumable; } catch (_e) {}
try { globalThis.add2eDropLearnSpellListOnExisting = add2eDropLearnSpellListOnExisting; } catch (_e) {}
try { globalThis.add2eDropNormalizeProjectileItemData = add2eDropNormalizeProjectileItemData; } catch (_e) {}
