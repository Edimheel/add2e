// ADD2E — Préchargement des partials de la feuille personnage.

const ADD2E_CHARACTER_SHEET_PARTIALS = [
  "systems/add2e/templates/actor/parts/character-header.hbs",
  "systems/add2e/templates/actor/parts/character-caracs-saves.hbs",
  "systems/add2e/templates/actor/parts/carac-force.hbs",
  "systems/add2e/templates/actor/parts/carac-dexterite.hbs",
  "systems/add2e/templates/actor/parts/carac-constitution.hbs",
  "systems/add2e/templates/actor/parts/carac-intelligence.hbs",
  "systems/add2e/templates/actor/parts/carac-sagesse.hbs",
  "systems/add2e/templates/actor/parts/carac-charisme.hbs",
  "systems/add2e/templates/actor/parts/character-saves.hbs",
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
  await foundry.applications.handlebars.loadTemplates(ADD2E_CHARACTER_SHEET_PARTIALS);
});
