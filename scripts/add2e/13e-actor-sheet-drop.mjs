// ADD2E — Actor sheet drop extrait de 13-actor-sheet-legacy.mjs
// Logique conservée volontairement : aucune correction métier appliquée dans ce découpage.

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant _onDrop.");

globalThis.Add2eActorSheet.prototype._onDrop = async function _onDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  let raw;
  try {
    raw = JSON.parse(event.dataTransfer.getData("text/plain"));
  } catch {
    console.warn("[ADD2E] Drop non JSON, fallback natif");
    return ActorSheet.prototype._onDrop.call(this, event);
  }

  if (raw.type !== "Item") return ActorSheet.prototype._onDrop.call(this, event);

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
  if (!itemData) {
    console.warn("[ADD2E] _onDrop impossible de reconstruire itemData", raw);
    return ActorSheet.prototype._onDrop.call(this, event);
  }

  const VALID = ["arme", "armure", "sort", "classe", "race"];
  if (!VALID.includes(itemData.type)) return ActorSheet.prototype._onDrop.call(this, event);

 // --- Validation générique du drop de sort par lignes de sorts
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
// --- Prévalidation race/classe AVANT toute modification de l'acteur.
  // Important : on ne met plus à jour system.classe/details_classe avant validation,
  // sinon un drop refusé laisse la fiche avec des données mélangées.
  // Si seule la compatibilité race/classe bloque, on corrige automatiquement
  // comme pour l'alignement : drop classe => race compatible ; drop race => classe compatible.
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
        // Dernier appel non silencieux pour conserver le message précis des vrais prérequis bloquants.
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

  // Drop d'une classe incompatible avec la race actuelle : on remplace la race avant
  // de créer la classe, afin que la fiche reste cohérente et que le niveau max racial
  // soit calculé sur la bonne race.
  if (itemData.type === "classe" && add2eAutoRaceCandidateData) {
    await add2eApplyRaceItemDataToActor(this.actor, add2eAutoRaceCandidateData, this, {
      notify: true,
      reason: "class-drop-race-auto-compat"
    });
  }

  // --- Remplace ancienne race (et ses effets)
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
    // Supprime les anciens bonus raciaux
    await this.actor.update({ "system.bonus_caracteristiques": {} });
  }


// --- Changement de classe : purge ancienne classe + sorts + armes + armures
// Important : on ne supprime PAS la race.
// Important : suppression item par item, plus fiable sur token non lié / acteur synthétique.
if (itemData.type === "classe") {
  console.log("=== [ADD2E][DROP CLASSE][PURGE] ===", {
    actor: this.actor.name,
    nouvelleClasse: itemData.name,
    actorIsToken: this.actor.isToken ?? false,
    tokenId: this.actor.token?.id ?? null
  });

  const typesToDelete = ["classe", "sort", "arme", "armure", "spell", "weapon", "armor"];

  const itemsToDelete = this.actor.items.filter(i =>
    typesToDelete.includes(String(i.type || "").toLowerCase())
  );

  console.log("[ADD2E][DROP CLASSE][PURGE] items à supprimer :", itemsToDelete.map(i => ({
    id: i.id,
    name: i.name,
    type: i.type,
    uuid: i.uuid
  })));

  // Effets liés aux items supprimés et effets de classe générés sans origine fiable.
  const effectsToDelete = this.actor.effects.filter(eff =>
    add2eShouldDeleteEffectForClassPurge(eff, itemsToDelete)
  );

  console.log("[ADD2E][DROP CLASSE][PURGE] effets liés à supprimer :", effectsToDelete.map(e => ({
    id: e.id,
    name: e.name,
    origin: e.origin
  })));

  for (const eff of effectsToDelete) {
    await eff.delete({ render: false });
  }

  for (const it of itemsToDelete) {
    console.log("[ADD2E][DROP CLASSE][PURGE] suppression item :", {
      id: it.id,
      name: it.name,
      type: it.type
    });

    await it.delete({ render: false });
  }

  console.log("[ADD2E][DROP CLASSE][PURGE] items restants après purge :", this.actor.items.map(i => ({
    id: i.id,
    name: i.name,
    type: i.type
  })));
}

  // --- Anti-doublon (évite d'ajouter deux fois le même item)
  if (["arme", "armure", "sort"].includes(itemData.type)) {
    if (this.actor.items.some(i => i.name === itemData.name && i.type === itemData.type)) {
      ui.notifications.warn(`"${itemData.name}" est déjà présent sur cet acteur.`);
      return false;
    }
  }

  // --- Création de l'Item
  const [itemDoc] = await this.actor.createEmbeddedDocuments("Item", [foundry.utils.duplicate(itemData)]);
  if (!itemDoc) {
    console.warn("[ADD2E] Échec de création de l'item (itemDoc undefined) :", itemData);
    return false;
  }

   // --- Application effets embarqués SAUF pour les sorts
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

  // --- Traitement spécial classe (alignements, etc.)
  // La mise à jour complète de system.classe/details_classe est faite plus bas,
  // après création effective de l'item classe.

  // --- Application effets et bonus pour race
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

    // Drop d'une race incompatible avec la classe actuelle : on remplace la classe
    // par une classe compatible après l'application de la nouvelle race.
    if (add2eAutoClassCandidateData) {
      await add2eApplyClassItemDataToActor(this.actor, add2eAutoClassCandidateData, this, {
        alignmentCandidate: add2eAutoClassAlignmentCandidate,
        notify: true,
        reason: "race-drop-class-auto-compat"
      });
    } else {
      // La race peut modifier le niveau maximum autorisé de la classe actuelle.
      // On accepte le drop, puis on ramène proprement le niveau si nécessaire.
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

  // --- Application effets + sauvegardes pour classe
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
        ui.notifications.info(
          `Sorts de ${itemDoc.name} synchronisés : ${spellSync.imported} importé(s).`
        );
      }
    } catch (e) {
      console.error("[ADD2E][CLASSE][SORTS] Erreur synchronisation des sorts après drop classe :", e);
      ui.notifications.error("Erreur pendant la synchronisation des sorts de classe.");
    }
  }

  this.render(false);
  return true;

};
