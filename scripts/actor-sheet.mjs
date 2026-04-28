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

  async _onDropItem(event, data) {
  console.log("[add2e] --- DROP ITEM TRIGGERED ---");
  console.log("[add2e] Raw event:", event);
  console.log("[add2e] Raw data:", data);

  // v12 : fetch item par uuid
  let item = null;
  if (data.uuid) {
    item = await fromUuid(data.uuid);
  }
  if (!item || item.type !== "classe") return;

  // Ajoute tous les champs que tu veux
  const maj = {
    "system.classe": item.name,
    "system.nom": this.actor.name, // ou item.name si tu veux
    "system.niveau": 1,
    "system.points_de_coup": item.system.hitDie ?? 8,
    "system.special": item.system.specialAbilities?.join("\n") ?? "",
    "system.alignement": Array.isArray(item.system.alignment) ? item.system.alignment[0] : (item.system.alignment ?? ""),
    "system.armure_portee": item.system.armorAllowed?.join(", ") ?? "",
    "system.bouclier": item.system.shieldAllowed ? "Oui" : "Non",
    "system.pv_par_niveau": item.system.hdPerLevel ?? "",
    "system.principale": item.system.primaryAbility ?? "",
    "system.xp_progression": item.system.progression ? JSON.stringify(item.system.progression) : "",
    // Ajoute tous les champs que tu veux préremplir !
  };

  console.log("[add2e] Mise à jour de l'acteur :", maj);

  await this.actor.update(maj);

  ui.notifications.info(`Classe "${item.name}" appliquée au personnage !`);
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
