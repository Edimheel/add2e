// ADD2E — Actor sheet drop — full ApplicationV2

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant _onDrop.");

const ADD2E_ACTOR_SHEET_DROP_VERSION = "2026-05-23-drop-application-v2-full-v1";
globalThis.ADD2E_ACTOR_SHEET_DROP_VERSION = ADD2E_ACTOR_SHEET_DROP_VERSION;
console.log("[ADD2E][DROP][VERSION]", ADD2E_ACTOR_SHEET_DROP_VERSION);

function add2eDropUniqueExistingIds(collection, ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).map(id => String(id ?? "").trim()).filter(Boolean))]
    .filter(id => collection?.has?.(id));
}

async function add2eDropBulkDelete(actor, documentName, ids, label) {
  const collection = documentName === "Item" ? actor?.items : actor?.effects;
  const existingIds = add2eDropUniqueExistingIds(collection, ids);
  if (!existingIds.length) return { deleted: 0, ids: [] };

  try {
    await actor.deleteEmbeddedDocuments(documentName, existingIds, {
      add2eInternal: true,
      add2eDropPurge: true,
      render: false
    });
    return { deleted: existingIds.length, ids: existingIds };
  } catch (err) {
    console.warn(`[ADD2E][DROP CLASSE][PURGE][${label}][BULK_FAILED] Suppression unitaire.`, err);
    let deleted = 0;
    for (const id of existingIds) {
      const doc = collection?.get?.(id);
      if (!doc) continue;
      try {
        await doc.delete({ add2eInternal: true, add2eDropPurge: true, render: false });
        deleted++;
      } catch (oneErr) {
        const msg = String(oneErr?.message ?? oneErr ?? "");
        if (!msg.includes("does not exist")) console.error(`[ADD2E][DROP CLASSE][PURGE][${label}][DELETE_ERROR]`, { id, err: oneErr });
      }
    }
    return { deleted, ids: existingIds };
  }
}

async function add2eDropPurgeClassContent(actor, itemData) {
  const typesToDelete = ["classe", "sort", "arme", "armure", "spell", "weapon", "armor"];
  const itemsToDelete = actor.items.filter(i => typesToDelete.includes(String(i.type || "").toLowerCase()));
  const effectsToDelete = actor.effects.filter(eff => add2eShouldDeleteEffectForClassPurge(eff, itemsToDelete));
  const effectResult = await add2eDropBulkDelete(actor, "ActiveEffect", effectsToDelete.map(e => e.id), "EFFECTS");
  const itemResult = await add2eDropBulkDelete(actor, "Item", itemsToDelete.map(i => i.id), "ITEMS");
  return { effectsDeleted: effectResult.deleted, itemsDeleted: itemResult.deleted };
}

async function add2eResolveDropItemData(raw) {
  let itemData = raw?.data ?? null;
  if (!itemData && raw?.uuid) {
    const doc = await fromUuid(raw.uuid);
    if (doc instanceof Item) itemData = doc.toObject();
  }
  if (!itemData && raw?.pack && raw?.id) {
    const pack = game.packs.get(raw.pack);
    const ent = pack && await pack.getDocument(raw.id);
    if (ent instanceof Item) itemData = ent.toObject();
  }
  return itemData;
}

try { globalThis.add2eDropPurgeClassContent = add2eDropPurgeClassContent; } catch (_e) {}
try { globalThis.add2eDropBulkDelete = add2eDropBulkDelete; } catch (_e) {}

globalThis.Add2eActorSheet.prototype._onDrop = async function _onDrop(event) {
  event.preventDefault?.();
  event.stopPropagation?.();

  let raw;
  try {
    raw = JSON.parse(event.dataTransfer?.getData("text/plain") || "{}");
  } catch (err) {
    console.warn("[ADD2E][DROP][V2] Drop ignoré : payload non JSON.", err);
    return false;
  }

  if (raw.type !== "Item") {
    console.warn("[ADD2E][DROP][V2] Drop ignoré : seul le type Item est accepté.", raw);
    return false;
  }

  const itemData = await add2eResolveDropItemData(raw);
  if (!itemData) {
    console.warn("[ADD2E][DROP][V2] Impossible de reconstruire itemData.", raw);
    return false;
  }

  const VALID = ["arme", "armure", "sort", "classe", "race"];
  if (!VALID.includes(itemData.type)) {
    console.warn("[ADD2E][DROP][V2] Type d'item non accepté sur personnage.", { type: itemData.type, name: itemData.name });
    return false;
  }

  if (itemData.type === "sort") {
    let source = null;
    if (itemData.uuid) source = await fromUuid(itemData.uuid);
    if (!source && itemData.pack && itemData._id) {
      const pack = game.packs.get(itemData.pack);
      if (pack) source = await pack.getDocument(itemData._id);
    }
    if (!source && itemData.system) source = { name: itemData.name, type: itemData.type, system: itemData.system };
    if (!source?.system) return ui.notifications.error("Impossible de résoudre le sort."), false;

    const check = add2eCanActorUseSpell(this.actor, source);
    if (!check.sortLists?.length) return ui.notifications.error(`Sort non migré : “${source.name}” n’a pas system.spellLists.`), false;
    if (!check.ok) {
      const entry = check.entry;
      if (check.reason === "list") ui.notifications.error(`${this.actor.name} ne peut pas apprendre ou préparer “${source.name}” : ligne de sort non autorisée (${check.sortLists.map(add2eSpellLabel).join(", ")}).`);
      else if (check.reason === "start") ui.notifications.error(`${this.actor.name} ne peut pas encore préparer “${source.name}” : ${entry?.label || "cette ligne"} commence au niveau ${entry?.startsAt}.`);
      else if (check.reason === "max-level") ui.notifications.error(`${this.actor.name} ne peut pas préparer “${source.name}” : ${entry?.label || "cette ligne"} est limitée aux sorts de niveau ${entry?.maxSpellLevel}.`);
      else ui.notifications.error(`${this.actor.name} ne peut pas apprendre ou préparer “${source.name}”.`);
      return false;
    }
  }

  let add2eClassAlignmentCandidate = null;
  let add2eAutoRaceCandidateData = null;
  let add2eAutoClassCandidateData = null;
  let add2eAutoClassAlignmentCandidate = null;

  if (itemData.type === "classe") {
    add2eClassAlignmentCandidate = add2ePickClassAlignment(this.actor, itemData.system ?? {});
    if (typeof checkClassStatMin === "function") {
      let ok = checkClassStatMin(this.actor, itemData, null, add2eClassAlignmentCandidate, { silent: true, ignoreLevelMax: true });
      if (!ok) {
        const compatibleRace = add2eFindCompatibleRaceForClass(this.actor, itemData, add2eClassAlignmentCandidate);
        if (compatibleRace) {
          add2eAutoRaceCandidateData = compatibleRace;
          ok = checkClassStatMin(this.actor, itemData, compatibleRace, add2eClassAlignmentCandidate, { silent: true, ignoreLevelMax: true });
        }
      }
      if (!ok) {
        checkClassStatMin(this.actor, itemData, add2eAutoRaceCandidateData, add2eClassAlignmentCandidate, { silent: false, ignoreLevelMax: true });
        add2eRerenderActorSheet(this.actor);
        return false;
      }
    }
  }

  if (itemData.type === "race") {
    const existingClass = this.actor.items.find(i => i.type === "classe");
    if (existingClass && typeof checkClassStatMin === "function") {
      const existingAlignment = add2ePickClassAlignment(this.actor, existingClass.system ?? {});
      let ok = checkClassStatMin(this.actor, existingClass, itemData, existingAlignment, { silent: true, ignoreLevelMax: true });
      if (!ok) {
        const compatibleClass = add2eFindCompatibleClassForRace(this.actor, itemData);
        if (compatibleClass?.classData) {
          add2eAutoClassCandidateData = compatibleClass.classData;
          add2eAutoClassAlignmentCandidate = compatibleClass.alignmentCandidate;
          ok = checkClassStatMin(this.actor, add2eAutoClassCandidateData, itemData, add2eAutoClassAlignmentCandidate, { silent: true, ignoreLevelMax: true });
        }
      }
      if (!ok) {
        checkClassStatMin(this.actor, add2eAutoClassCandidateData ?? existingClass, itemData, add2eAutoClassAlignmentCandidate ?? existingAlignment, { silent: false, ignoreLevelMax: true });
        add2eRerenderActorSheet(this.actor);
        return false;
      }
    }
  }

  if (itemData.type === "classe" && add2eAutoRaceCandidateData) {
    await add2eApplyRaceItemDataToActor(this.actor, add2eAutoRaceCandidateData, this, { notify: true, reason: "class-drop-race-auto-compat" });
  }

  if (itemData.type === "race") {
    for (const oldRace of this.actor.items.filter(i => i.type === "race")) {
      const raceEffects = this.actor.effects.filter(eff => eff.origin === oldRace.uuid).map(e => e.id).filter(id => this.actor.effects.has(id));
      if (raceEffects.length) await this.actor.deleteEmbeddedDocuments("ActiveEffect", raceEffects);
      await oldRace.delete();
    }
    await this.actor.update({ "system.bonus_caracteristiques": {} });
  }

  if (itemData.type === "classe") await add2eDropPurgeClassContent(this.actor, itemData);

  if (["arme", "armure", "sort"].includes(itemData.type)) {
    if (this.actor.items.some(i => i.name === itemData.name && i.type === itemData.type)) {
      ui.notifications.warn(`"${itemData.name}" est déjà présent sur cet acteur.`);
      return false;
    }
  }

  const [itemDoc] = await this.actor.createEmbeddedDocuments("Item", [foundry.utils.duplicate(itemData)]);
  if (!itemDoc) return false;

  if (itemData.type !== "sort" && itemDoc.effects.contents?.length) {
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
    await this.actor.createEmbeddedDocuments("ActiveEffect", actorEffects);
  }

  if (itemData.type === "race") {
    const raceSystem = foundry.utils.deepClone(itemDoc.system ?? {});
    await this.actor.update({
      "system.race": itemDoc.name,
      "system.details_race": { ...raceSystem, name: itemDoc.name, label: raceSystem.label || itemDoc.name, img: itemDoc.img || raceSystem.img || "" },
      "system.bonus_caracteristiques": raceSystem.bonus_caracteristiques ? foundry.utils.deepClone(raceSystem.bonus_caracteristiques) : {}
    });
    if (typeof this.autoSetCaracAjustements === "function") await this.autoSetCaracAjustements();
    if (add2eAutoClassCandidateData) {
      await add2eApplyClassItemDataToActor(this.actor, add2eAutoClassCandidateData, this, { alignmentCandidate: add2eAutoClassAlignmentCandidate, notify: true, reason: "race-drop-class-auto-compat" });
    }
  }

  if (itemData.type === "classe") {
    const classSystem = foundry.utils.deepClone(itemDoc.system ?? {});
    const levelClamp = add2eClampLevelToClassMax(this.actor, this.actor.system?.niveau, classSystem, { notify: true });
    const updates = {
      "system.classe": itemDoc.name,
      "system.details_classe": classSystem,
      "system.spellcasting": classSystem.spellcasting ?? null,
      "system.alignements_autorises": add2eClassAllowedAlignments(classSystem)
    };
    if (levelClamp.changed) updates["system.niveau"] = levelClamp.level;
    if (add2eClassAlignmentCandidate) updates["system.alignement"] = add2eClassAlignmentCandidate;
    if (itemDoc.system?.progression?.[0]?.sauvegardes) updates["system.sauvegardes"] = foundry.utils.duplicate(itemDoc.system.progression[0].sauvegardes);
    await this.actor.update(updates);
    if (typeof this.autoSetCaracAjustements === "function") await this.autoSetCaracAjustements();
    if (typeof this.autoSetPointsDeCoup === "function") await this.autoSetPointsDeCoup({ syncCurrent: true, force: true, reason: "class-drop" });
    try { await add2eSyncMonkUnarmedWeapon(this.actor); } catch (e) { console.warn("[ADD2E][MOINE] Sync classe échoué", e); }
    try { await add2eSyncClassPassiveEffect(this.actor); } catch (e) { console.warn("[ADD2E][CLASSE][EFFETS] Sync classe échoué", e); }
    try {
      const spellSync = await add2eSyncActorSpellsFromClass(this.actor, itemDoc, { mode: "replace", showWait: true });
      if (spellSync?.handled) ui.notifications.info(`Sorts de ${itemDoc.name} synchronisés : ${spellSync.imported} importé(s).`);
    } catch (e) {
      console.error("[ADD2E][CLASSE][SORTS] Erreur synchronisation des sorts après drop classe :", e);
      ui.notifications.error("Erreur pendant la synchronisation des sorts de classe.");
    }
  }

  this.render(false);
  return true;
};
