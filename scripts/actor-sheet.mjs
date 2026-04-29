// scripts/actor-sheet.mjs

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

// Déclaration de la feuille custom pour les acteurs
export class Add2eActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "actor", "personnage"],
      template: "systems/add2e/templates/actor/character-sheet.hbs",
      width: 800,
      height: 900
    });
  }

  async getData(opts) {
    if (this.actor.type !== "personnage") return super.getData(opts);
    const ctx = await super.getData(opts);
    return ctx;
  }

async _onDropItem(event, item) {
  console.log("=== [ADD2E][_onDropItem] ===");
  console.log("[ADD2E][_onDropItem] item reçu :", item ? {
    id: item.id,
    name: item.name,
    type: item.type,
    parent: item.parent?.name ?? null,
    uuid: item.uuid
  } : null);

  if (!item) return null;

  // =====================================================
  // DROP CLASSE
  // La nouvelle classe déclenche elle-même :
  // - suppression ancienne classe
  // - suppression sorts / armes / armures
  // - création nouvelle classe
  // - synchro actor.system
  // =====================================================
  if (item.type === "classe") {
    console.log("=== [ADD2E][DROP CLASSE - RESET ÉQUIPEMENT/SORTS] ===");

    const actor = this.actor;

    console.log("[DROP CLASSE] acteur cible :", {
      name: actor.name,
      id: actor.id,
      isToken: actor.isToken,
      tokenId: actor.token?.id ?? null
    });

    const classData = foundry.utils.duplicate(item.toObject());
    delete classData._id;

    // -------------------------------------------------
    // 1) Supprimer ancienne classe + sorts + armes + armures
    // -------------------------------------------------
    const typesToDelete = ["classe", "sort", "arme", "armure"];

    const itemsToDelete = actor.items.filter(i =>
      typesToDelete.includes(i.type)
    );

    console.log("[DROP CLASSE] items à supprimer :", itemsToDelete.map(i => ({
      id: i.id,
      name: i.name,
      type: i.type,
      uuid: i.uuid
    })));

    // Supprimer les effets liés à ces items
    const itemUuidsToDelete = itemsToDelete.map(i => i.uuid);

    const effectsToDelete = actor.effects.filter(e =>
      itemUuidsToDelete.includes(e.origin)
    );

    console.log("[DROP CLASSE] effets liés à supprimer :", effectsToDelete.map(e => ({
      id: e.id,
      name: e.name,
      origin: e.origin
    })));

    if (effectsToDelete.length) {
      await actor.deleteEmbeddedDocuments(
        "ActiveEffect",
        effectsToDelete.map(e => e.id)
      );
    }

    if (itemsToDelete.length) {
      await actor.deleteEmbeddedDocuments(
        "Item",
        itemsToDelete.map(i => i.id)
      );
    }

    console.log("[DROP CLASSE] après suppression :", actor.items.map(i => ({
      id: i.id,
      name: i.name,
      type: i.type
    })));

    // -------------------------------------------------
    // 2) Créer la nouvelle classe
    // -------------------------------------------------
    const [classDoc] = await actor.createEmbeddedDocuments("Item", [classData]);

    if (!classDoc) {
      console.error("[DROP CLASSE] ERREUR : impossible de créer la nouvelle classe.");
      return null;
    }

    console.log("[DROP CLASSE] nouvelle classe créée :", {
      id: classDoc.id,
      name: classDoc.name,
      spellcasting: foundry.utils.duplicate(classDoc.system?.spellcasting ?? null)
    });

    // -------------------------------------------------
    // 3) Appliquer les effets embarqués de la nouvelle classe
    // -------------------------------------------------
    if (classDoc.effects?.contents?.length) {
      const actorEffects = classDoc.effects.contents.map(eff => {
        const e = foundry.utils.duplicate(eff.toObject());
        e.origin = classDoc.uuid;
        e.disabled = false;
        e.transfer = false;
        delete e._id;
        return e;
      });

      console.log("[DROP CLASSE] effets de classe à créer :", actorEffects.map(e => ({
        name: e.name,
        origin: e.origin
      })));

      await actor.createEmbeddedDocuments("ActiveEffect", actorEffects);
    }

    // -------------------------------------------------
    // 4) Synchroniser l'acteur depuis la classe
    // -------------------------------------------------
    const patch = {
      "system.classe": classDoc.name,
      "system.details_classe": foundry.utils.duplicate(classDoc.system ?? {}),
      "system.spellcasting": foundry.utils.duplicate(classDoc.system?.spellcasting ?? null),
      "system.alignements_autorises": foundry.utils.duplicate(
        classDoc.system?.alignements_autorises
        ?? classDoc.system?.alignment
        ?? []
      )
    };

    console.log("[DROP CLASSE] patch acteur :", foundry.utils.duplicate(patch));

    await actor.update(patch);

    // -------------------------------------------------
    // 5) Recalculs existants
    // -------------------------------------------------
    if (typeof this.autoSetCaracAjustements === "function") {
      await this.autoSetCaracAjustements();
    }

    if (typeof this.autoSetPointsDeCoup === "function") {
      await this.autoSetPointsDeCoup({
        syncCurrent: true,
        force: true,
        reason: "class-drop"
      });
    }

    console.log("✅ [DROP CLASSE] terminé :", {
      actor: actor.name,
      systemClasse: actor.system?.classe,
      systemSpellcasting: foundry.utils.duplicate(actor.system?.spellcasting ?? null),
      itemsRestants: actor.items.map(i => ({
        id: i.id,
        name: i.name,
        type: i.type,
        spellcasting: foundry.utils.duplicate(i.system?.spellcasting ?? null)
      })),
      effetsRestants: actor.effects.map(e => ({
        id: e.id,
        name: e.name,
        origin: e.origin
      }))
    });

    ui.notifications.info(`Classe "${classDoc.name}" appliquée. Ancienne classe, sorts, armes et armures supprimés.`);

    this.render(false);
    return classDoc;
  }

  // Tous les autres drops gardent le comportement natif Foundry.
  return super._onDropItem(event, item);
}

}
globalThis.Add2eActorSheet = Add2eActorSheet;

// Hook d'initialisation, registration de la feuille custom
Hooks.once("init", () => {
  console.log("[add2e] Hook init : override ActorSheet");

  // Désenregistre la core sheet et enregistre la tienne pour tous les types souhaités
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("add2e", Add2eActorSheet, {
    types: ["personnage", "monster"],
    makeDefault: true,
    label: "ADD2e Descartes (FR)"
  });
});
