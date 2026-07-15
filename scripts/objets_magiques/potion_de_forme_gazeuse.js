return Add2eEffectsEngine.applyConfiguredEffect({ actor, item, sourceItem, sort, args }, {
  name: "Potion de forme gazeuse",
  slug: "forme_gazeuse",
  kind: "effect",
  selfOnly: true,
  durationFormula: "5d6",
  tags: ["transformation", "forme:gazeuse", "mouvement:vol:3", "immunite:armes_non_magiques", "vulnerabilite:tourbillon"],
  rule: "Le consommateur devient gazeux, traverse les ouvertures non hermétiques et ne peut être blessé que par les feux magiques et la foudre ; les tourbillons infligent des dégâts doubles."
});
