// ADD2E — Enregistrement de la feuille personnage ApplicationV2

if (!globalThis.Add2eActorSheet) {
  throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant l'enregistrement de la sheet.");
}

Actors.registerSheet("add2e", globalThis.Add2eActorSheet, {
  types: ["personnage"],
  makeDefault: true,
  label: "ADD2e Personnage"
});

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.Add2eActorSheet = globalThis.Add2eActorSheet; } catch (_e) {}

// Le pont ActorSheet n'est utile que pendant le chargement des modules 13b à 13e.
// On restaure le global d'origine juste après l'enregistrement pour éviter tout effet de bord.
try {
  if (globalThis.ActorSheet === globalThis.ADD2E_ACTOR_SHEET_LEGACY_BRIDGE) {
    if (globalThis.ADD2E_ORIGINAL_ACTOR_SHEET_GLOBAL) globalThis.ActorSheet = globalThis.ADD2E_ORIGINAL_ACTOR_SHEET_GLOBAL;
    else delete globalThis.ActorSheet;
  }
} catch (err) {
  console.warn("[ADD2E][ACTOR_SHEET][APPLICATION_V2] Restauration ActorSheet impossible", err);
}

console.log("[ADD2E][ACTOR_SHEET][REGISTERED]", globalThis.ADD2E_ACTOR_SHEET_V2_VERSION || "application-v2");
