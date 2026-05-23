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

// NOTE : les modules 13b/13c/13d/13e appellent encore ActorSheet.prototype.*
// dans leurs méthodes de prototype. Ces références sont résolues à l'exécution.
// Le pont défini dans 13a doit donc rester disponible tant que ces méthodes
// n'auront pas été réécrites directement vers ADD2E_ACTOR_SHEET_LEGACY_BRIDGE.
console.log("[ADD2E][ACTOR_SHEET][REGISTERED]", globalThis.ADD2E_ACTOR_SHEET_V2_VERSION || "application-v2");
