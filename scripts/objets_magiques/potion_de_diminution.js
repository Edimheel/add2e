return Add2eEffectsEngine.applyConfiguredEffect({ actor, item, sourceItem, sort, args }, {
  name: "Potion de diminution",
  slug: "diminution",
  kind: "effect",
  selfOnly: true,
  durationFormula: "1d4+7",
  durationMultiplier: 10,
  tags: ["transformation", "taille:5_pourcent", "mouvement:adapte"],
  rule: "La potion entière réduit le consommateur et son équipement à 5 % de leur taille normale. La durée est de 6 tours plus 2 à 5 tours."
});
