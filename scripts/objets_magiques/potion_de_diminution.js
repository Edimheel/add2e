return Add2eEffectsEngine.applyConfiguredEffect({ actor, item, sourceItem, sort, args }, {
  name: "Potion de diminution",
  slug: "diminution",
  kind: "effect",
  selfOnly: true,
  durationFormula: "1d4+7",
  durationMultiplier: 10,
  tags: ["transformation", "forme:diminution", "taille:5_pourcent"],
  extraFlags: {
    capabilityTransformation: {
      kind: "form",
      sourceKey: "potion:diminution",
      formKey: "diminution",
      label: "Potion de diminution",
      size: "5_pourcent",
      sizeFactor: 0.05
    }
  },
  rule: "La potion entière réduit le consommateur et son équipement à 5 % de leur taille normale. La durée est de 6 tours plus 2 à 5 tours."
});