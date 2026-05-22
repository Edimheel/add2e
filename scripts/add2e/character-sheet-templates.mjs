// ADD2E — Préchargement des partials de la feuille personnage.

const ADD2E_CHARACTER_SHEET_PARTIALS = [
  "systems/add2e/templates/actor/parts/character-header.hbs",
  "systems/add2e/templates/actor/parts/character-caracs-saves.hbs",
  "systems/add2e/templates/actor/parts/character-tabs.hbs",
  "systems/add2e/templates/actor/parts/tab-resume.hbs",
  "systems/add2e/templates/actor/parts/tab-combat.hbs",
  "systems/add2e/templates/actor/parts/tab-capacites.hbs",
  "systems/add2e/templates/actor/parts/tab-sorts.hbs",
  "systems/add2e/templates/actor/parts/tab-effets.hbs",
  "systems/add2e/templates/actor/parts/tab-equipement.hbs",
  "systems/add2e/templates/actor/parts/tab-notes.hbs"
];

Hooks.once("init", async () => {
  await loadTemplates(ADD2E_CHARACTER_SHEET_PARTIALS);
});
