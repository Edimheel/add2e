return Add2eEffectsEngine.applyConfiguredEffect({ actor, item, sourceItem, sort, args }, {
  name: "Potion de tromperie",
  slug: "tromperie",
  kind: "deception",
  apparentEffect: "soins",
  description: "Le consommateur croit que la potion a produit l’effet supposé, sans bénéfice réel."
});
