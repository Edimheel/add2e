const { runPotion } = await import(`/systems/add2e/scripts/objets_magiques/_potion-runtime.mjs?cb=${Date.now()}`);
return runPotion({ actor, item, sort, args }, {
  name: "Potion de forme gazeuse",
  slug: "forme_gazeuse",
  kind: "effect",
  selfOnly: true,
  durationFormula: "5d6",
  tags: ["transformation", "forme:gazeuse", "mouvement:vol:3", "immunite:armes_non_magiques", "vulnerabilite:tourbillon"],
  rule: "Le consommateur devient gazeux, traverse les ouvertures non hermétiques et ne peut être blessé que par les feux magiques et la foudre ; les tourbillons infligent des dégâts doubles."
});
