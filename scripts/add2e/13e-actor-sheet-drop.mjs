// ADD2E — Actor sheet drop restauré V1 — full ApplicationV2
// Logique V1 conservée. Aucun appel ActorSheet.prototype._onDrop.

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant _onDrop.");

const ADD2E_ACTOR_SHEET_DROP_VERSION = "2026-05-27-drop-application-v2-purge-boutique-v1";
globalThis.ADD2E_ACTOR_SHEET_DROP_VERSION = ADD2E_ACTOR_SHEET_DROP_VERSION;
console.log("[ADD2E][DROP][VERSION]", ADD2E_ACTOR_SHEET_DROP_VERSION);

function add2eDropUniqueExistingIds(collection, ids) {
  return [...new Set(
    (Array.isArray(ids) ? ids : [])
      .map(id => String(id ?? "").trim())
      .filter(Boolean)
  )].filter(id => collection?.has?.(id));
}

function add2eDropArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  if (typeof value === "string") return value.split(/[,;|]/g).map(v => v.trim()).filter(Boolean);
  return [value];
}

function add2eDropItemTags(item) {
  const sys = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [
    ...add2eDropArray(sys.tags),
    ...add2eDropArray(sys.effectTags),
    ...add2eDropArray(flags.tags)
  ].map(t => String(t ?? "").trim().toLowerCase()).filter(Boolean);
}

function add2eDropIsBoutiqueConsumable(item) {
  if (!item || String(item.type ?? "").toLowerCase() !== "objet") return false;

  const sys = item.system ?? {};
  const flags = item.flags?.add2e ?? {};
  const categorie = String(sys.categorie ?? sys.category ?? "").trim().toLowerCase();
  const sousType = String(sys.sousType ?? sys.sous_type ?? "").trim().toLowerCase();
  const type = String(sys.type ?? "").trim().toLowerCase();
  const tags = add2eDropItemTags(item);

  if (categorie === "composant_sort") return true;
  if (categorie === "munition") return true;
  if (type === "munition") return true;
  if (sousType === "composant") return true;
  if (tags.includes("composant_sort")) return true;
  if (tags.includes("munition") || tags.includes("trait:munition")) return true;
  if (tags.some(t => t.startsWith("composant:"))) return true;
  if (flags.purchasedFromVendor === true && (categorie || sousType || type || tags.length)) return true;
  return false;
}

async function add2eDropBulkDelete(actor, documentName, ids, label) {
  const collection = documentName === "Item" ? actor?.items : actor?.effects;
  const existingIds = add2eDropUniqueExistingIds(collection, ids);

  if (!existingIds.length) {
    console.log(`[ADD2E][DROP CLASSE][PURGE][${label}][SKIP] Aucun document existant à supprimer.`);
    return { deleted: 0, ids: [] };
  }

  console.log(`[ADD2E][DROP CLASSE][PURGE][${label}][BULK_DELETE]`, {
    actor: actor?.name,
    documentName,
    count: existingIds.length,
    ids: existingIds
  });

  try {
    await actor.deleteEmbeddedDocuments(documentName, existingIds, {
      add2eInternal: true,
      add2eDropPurge: true,
      render: false
    });
    return { deleted: existingIds.length, ids: existingIds };
  } catch (err) {
    console.warn(`[ADD2E][DROP CLASSE][PURGE][${label}][BULK_FAILED] Fallback unitaire sécurisé.`, {
      actor: actor?.name,
      documentName,
      ids: existingIds,
      err
    });

    let deleted = 0;
    for (const id of existingIds) {
      const doc = collection?.get?.(id);
      if (!doc) continue;

      try {
        await doc.delete({
          add2eInternal: true,
          add2eDropPurge: true,
          render: false
        });
        deleted += 1;
      } catch (oneErr) {
        const msg = String(oneErr?.message ?? oneErr ?? "");
        if (msg.includes("does not exist")) {
          console.warn(`[ADD2E][DROP CLASSE][PURGE][${label}][ALREADY_GONE]`, { id });
          continue;
        }
        console.error(`[ADD2E][DROP CLASSE][PURGE][${label}][DELETE_ERROR]`, { id, err: oneErr });
      }
    }

    return { deleted, ids: existingIds };
  }
}

async function add2eDropPurgeClassContent(actor, itemData) {
  console.log("=== [ADD2E][DROP CLASSE][PURGE] ===", {
    actor: actor.name,
    nouvelleClasse: itemData.name,
    actorIsToken: actor.isToken ?? false,
    tokenId: actor.token?.id ?? null,
    mode: "bulk"
  });

  const typesToDelete = ["classe", "sort", "arme", "armure", "spell", "weapon", "armor"];

  const itemsToDelete = actor.items.filter(i =>
    typesToDelete.includes(String(i.type || "").toLowerCase()) || add2eDropIsBoutiqueConsumable(i)
  );

  console.log("[ADD2E][DROP CLASSE][PURGE] items à supprimer :", itemsToDelete.map(i => ({
    id: i.id,
    name: i.name,
    type: i.type,
    categorie: i.system?.categorie ?? null,
    sousType: i.system?.sousType ?? i.system?.sous_type ?? null,
    uuid: i.uuid
  })));

  const effectsToDelete = actor.effects.filter(eff =>
    add2eShouldDeleteEffectForClassPurge(eff, itemsToDelete)
  );

  console.log("[ADD2E][DROP CLASSE][PURGE] effets liés à supprimer :", effectsToDelete.map(e => ({
    id: e.id,
    name: e.name,
    origin: e.origin
  })));

  const effectResult = await add2eDropBulkDelete(actor, "ActiveEffect", effectsToDelete.map(e => e.id), "EFFECTS");
  const itemResult = await add2eDropBulkDelete(actor, "Item", itemsToDelete.map(i => i.id), "ITEMS");

  console.log("[ADD2E][DROP CLASSE][PURGE][DONE]", {
    actor: actor.name,
    effectsDeleted: effectResult.deleted,
    itemsDeleted: itemResult.deleted,
    itemsRestants: actor.items.map(i => ({ id: i.id, name: i.name, type: i.type }))
  });

  return { effectsDeleted: effectResult.deleted, itemsDeleted: itemResult.deleted };
}

async function add2eResolveDropItemData(raw) {
  let itemData = raw.data;
  if (!itemData && raw.uuid) {
    const doc = await fromUuid(raw.uuid);
    if (doc instanceof Item) itemData = doc.toObject();
  }
  if (!itemData && raw.pack && raw.id) {
    const pack = game.packs.get(raw.pack);
    const ent = pack && await pack.getDocument(raw.id);
    if (ent instanceof Item) itemData = ent.toObject();
  }
  return itemData;
}

try { globalThis.add2eDropPurgeClassContent = add2eDropPurgeClassContent; } catch (_e) {}
try { globalThis.add2eDropBulkDelete = add2eDropBulkDelete; } catch (_e) {}
try { globalThis.add2eDropIsBoutiqueConsumable = add2eDropIsBoutiqueConsumable; } catch (_e) {}

globalThis.Add2eActorSheet.prototype._onDrop = async function _onDrop(event) {
  event.preventDefault?.();
  event.stopPropagation?.();

  let raw;
  try {
    raw = JSON.parse(event.dataTransfer?.getData("text/plain") || "{}");
  } catch (err) {
    console.warn("[ADD2E][DROP][V2] Drop non JSON ignoré : aucun fallback V1.", err);
    return false;
  }

  if (raw.type !== "Item") {
    console.warn("[ADD2E][DROP][V2] Drop ignoré : seul le type Item est accepté sur la feuille personnage.", raw);
    return false;
  }

  const itemData = await add2eResolveDropItemData(raw);
  if (!itemData) {
    console.warn("[ADD2E] _onDrop impossible de reconstruire itemData", raw);
    return false;
  }

  const VALID = ["arme", "armure", "sort", "classe", "race", "objet"];
  if (!VALID.includes(itemData.type)) {
    console.warn("[ADD2E][DROP][V2] Type item non accepté sur personnage.", { type: itemData.type, name: itemData.name });
    return false;
  }

  if (itemData.type === "sort") {
    console.log("=== [ADD2E DROP SORT][POOLS] ===");
    console.log("actor:", { id: this.actor?.id, name: this.actor?.name });
    console.log("itemData:", itemData);

    let source = null;

    if (itemData.uuid) {
      source = await fromUuid(itemData.uuid);
    }

    if (!source && itemData.pack && itemData._id) {
      const pack = game.packs.get(itemData.pack);
      if (pack) source = await pack.getDocument(itemData._id);
    }

    if (!source && itemData.system) {
      source = { name: itemData.name, type: itemData.type, system: itemData.system };
    }

    if (!source || !source.system) {
      console.log("[ADD2E DROP SORT][POOLS] ❌ FAIL: source unresolved");
      ui.notifications.error("Impossible de résoudre le sort.");
      return false;
    }

    const check = add2eCanActorUseSpell(this.actor, source);

    console.log("[ADD2E DROP SORT][POOLS] check:", {
      sort: source.name,
      sortLists: check.sortLists,
      actorEntries: check.entries,
      selectedEntry: check.entry,
      reason: check.reason,
      actorLevel: check.actorLevel,
      spellLevel: check.spellLevel
    });

    if (!check.sortLists?.length) {
      ui.notifications.error(`Sort non migré : “${source.name}” n’a pas system.spellLists.`);
      return false;
    }

    if (!check.ok) {
      const entry = check.entry;
      if (check.reason === "list") {
        ui.notifications.error(`${this.actor.name} ne peut pas apprendre ou préparer “${source.name}” : ligne de sort non autorisée (${check.sortLists.map(add2eSpellLabel).join(", ")}).`);
      } else if (check.reason === "start") {
        ui.notifications.error(`${this.actor.name} ne peut pas encore préparer “${source.name}” : ${entry?.label || "cette ligne"} commence au niveau ${entry?.startsAt}.`);
      } else if (check.reason === "max-level") {
        ui.notifications.error(`${this.actor.name} ne peut pas préparer “${source.name}” : ${entry?.label || "cette ligne"} est limitée aux sorts de niveau ${entry?.maxSpellLevel}.`);
      } else {
        ui.notifications.error(`${this.actor.name} ne peut pas apprendre ou préparer “${source.name}”.`);
      }
      return false;
    }

    console.log("[ADD2E DROP SORT][POOLS] ✅ DROP SORT OK", {
      sort: source.name,
      list: check.entry?.label,
      spellLevel: check.spellLevel
    });
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
        console.warn("[ADD2e] Blocage prise de classe (aucune race compatible trouvée ou prérequis NON atteints)", {
          actor: this.actor?.name,
          classe: itemData?.name,
          raceAuto: add2eAutoRaceCandidateData?.name ?? null,
          alignementTeste: add2eClassAlignmentCandidate
        });
        add2eRerenderActorSheet(this.actor);
        return false;
      }
    } else {
      console.warn("[ADD2e] Fonction checkClassStatMin NON trouvée !");
    }
  }

  if (itemData.type === "race") {
    const existingClass = this.actor.items.find(i => i.type === "classe");
    if (existingClass && typeof checkClassStatMin === "function") {
      let existingAlignment = add2ePickClassAlignment(this.actor, existingClass.system ?? {});
      let ok = checkClassStatMin(
        this.actor,
        existingClass,
        itemData,
        existingAlignment,
        { silent: true, ignoreLevelMax: true }
      );

      if (!ok) {
        const compatibleClass = add2eFindCompatibleClassForRace(this.actor, itemData);
        if (compatibleClass?.classData) {
          add2eAutoClassCandidateData = compatibleClass.classData;
          add2eAutoClassAlignmentCandidate = compatibleClass.alignmentCandidate;
          ok = checkClassStatMin(
            this.actor,
            add2eAutoClassCandidateData,
            itemData,
            add2eAutoClassAlignmentCandidate,
            { silent: true, ignoreLevelMax: true }
          );
        }
      }

      if (!ok) {
        checkClassStatMin(
          this.actor,
          add2eAutoClassCandidateData ?? existingClass,
          itemData,
          add2eAutoClassAlignmentCandidate ?? existingAlignment,
          { silent: false, ignoreLevelMax: true }
        );
        console.warn("[ADD2e] Blocage prise de race (aucune classe compatible trouvée ou prérequis NON atteints)", {
          actor: this.actor?.name,
          race: itemData?.name,
          classeActuelle: existingClass?.name,
          classeAuto: add2eAutoClassCandidateData?.name ?? null
        });
        add2eRerenderActorSheet(this.actor);
        return false;
      }
    }
  }

  if (itemData.type === "classe" && add2eAutoRaceCandidateData) {
    await add2eApplyRaceItemDataToActor(this.actor, add2eAutoRaceCandidateData, this, {
      notify: true,
      reason: "class-drop-race-auto-compat"
    });
  }

  if (itemData.type === "race") {
    const existingRaces = this.actor.items.filter(i => i.type === "race");
    for (const oldRace of existingRaces) {
      const raceEffects = this.actor.effects.filter(eff => eff.origin === oldRace.uuid);
      if (raceEffects.length) {
        const ids = raceEffects.map(e => e.id).filter(id => this.actor.effects.has(id));
        if (ids.length) {
          await this.actor.deleteEmbeddedDocuments("ActiveEffect", ids);
        }
      }
      await oldRace.delete();
    }
    await this.actor.update({ "system.bonus_caracteristiques": {} });
  }

  if (itemData.type === "classe") {
    await add2eDropPurgeClassContent(this.actor, itemData);
  }

  if (["arme", "armure", "sort", "objet"].includes(itemData.type)) {
    if (this.actor.items.some(i => i.name === itemData.name && i.type === itemData.type)) {
      ui.notifications.warn(`"${itemData.name}" est déjà présent sur cet acteur.`);
      return false;
    }
  }

  const [itemDoc] = await this.actor.createEmbeddedDocuments("Item", [foundry.utils.duplicate(itemData)]);
  if (!itemDoc) {
    console.warn("[ADD2E] Échec de création de l'item (itemDoc undefined) :", itemData);
    return false;
  }

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
      "system.details_race": {
        ...raceSystem,
        name: itemDoc.name,
        label: raceSystem.label || itemDoc.name,
        img: itemDoc.img || raceSystem.img || ""
      },
      "system.bonus_caracteristiques": raceSystem.bonus_caracteristiques
        ? foundry.utils.deepClone(raceSystem.bonus_caracteristiques)
        : {}
    });

    if (typeof this.autoSetCaracAjustements === "function") {
      await this.autoSetCaracAjustements();
    }

    if (add2eAutoClassCandidateData) {
      await add2eApplyClassItemDataToActor(this.actor, add2eAutoClassCandidateData, this, {
        alignmentCandidate: add2eAutoClassAlignmentCandidate,
        notify: true,
        reason: "race-drop-class-auto-compat"
      });
    } else {
      try {
        const currentClass = this.actor.items.find(i => i.type === "classe");
        if (currentClass) {
          const classSystem = foundry.utils.deepClone(currentClass.system ?? this.actor.system?.details_classe ?? {});
          const clamp = add2eClampLevelToClassMax(this.actor, this.actor.system?.niveau, classSystem, { notify: true });
          if (clamp.changed) {
            await this.actor.update({ "system.niveau": clamp.level }, { add2eInternal: true });
            if (typeof this.autoSetPointsDeCoup === "function") {
              await this.autoSetPointsDeCoup({ syncCurrent: true, force: true, reason: "race-drop-level-clamp" });
            }
          }
        }
      } catch (e) {
        console.warn("[ADD2E][DROP RACE][NIVEAU MAX] Erreur correction niveau max après drop race", e);
      }
    }
  }

  if (itemData.type === "classe") {
    const classSystem = foundry.utils.deepClone(itemDoc.system ?? {});
    const levelClamp = add2eClampLevelToClassMax(this.actor, this.actor.system?.niveau, classSystem, { notify: true });
    const alns = add2eClassAllowedAlignments(classSystem);
    const updates = {
      "system.classe": itemDoc.name,
      "system.details_classe": classSystem,
      "system.spellcasting": classSystem.spellcasting ?? null,
      "system.alignements_autorises": alns
    };

    if (levelClamp.changed) {
      updates["system.niveau"] = levelClamp.level;
    }

    if (add2eClassAlignmentCandidate) {
      updates["system.alignement"] = add2eClassAlignmentCandidate;
    }

    if (itemDoc.system?.progression?.[0]?.sauvegardes) {
      updates["system.sauvegardes"] = foundry.utils.duplicate(itemDoc.system.progression[0].sauvegardes);
    }

    await this.actor.update(updates);

    if (typeof this.autoSetCaracAjustements === "function") {
      await this.autoSetCaracAjustements();
    }

    if (typeof this.autoSetPointsDeCoup === "function") {
      await this.autoSetPointsDeCoup({ syncCurrent: true, force: true, reason: "class-drop" });
    }

    try {
      await add2eSyncMonkUnarmedWeapon(this.actor);
    } catch (e) {
      console.warn("[ADD2E][MOINE] Erreur synchronisation Main nue après drop classe :", e);
    }

    try {
      await add2eSyncClassPassiveEffect(this.actor);
    } catch (e) {
      console.warn("[ADD2E][CLASSE][EFFETS] Erreur synchronisation des effets de classe :", e);
    }

    try {
      const spellSync = await add2eSyncActorSpellsFromClass(this.actor, itemDoc, { mode: "replace", showWait: true });
      if (spellSync?.handled) {
        ui.notifications.info(`Sorts de ${itemDoc.name} synchronisés : ${spellSync.imported} importé(s).`);
      }
    } catch (e) {
      console.error("[ADD2E][CLASSE][SORTS] Erreur synchronisation des sorts après drop classe :", e);
      ui.notifications.error("Erreur pendant la synchronisation des sorts de classe.");
    }
  }

  this.render(false);
  return true;
};