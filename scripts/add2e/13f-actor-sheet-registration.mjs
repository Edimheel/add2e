// ADD2E — Enregistrement de la feuille personnage extrait de 13-actor-sheet-legacy.mjs

if (!globalThis.Add2eActorSheet) {
  throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant l'enregistrement de la sheet.");
}

Actors.registerSheet("add2e", globalThis.Add2eActorSheet, {
  types: ["personnage"], makeDefault: true, label: "ADD2e Personnage"
});

globalThis.Add2eActorSheet = globalThis.Add2eActorSheet;

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.Add2eActorSheet = globalThis.Add2eActorSheet; } catch (_e) {}
