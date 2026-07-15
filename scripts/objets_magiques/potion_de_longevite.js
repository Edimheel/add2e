return Add2eEffectsEngine.applyConfiguredEffect({ actor, item, sourceItem, sort, args }, {
  name: "Potion de longévité",
  slug: "longevite",
  kind: "age",
  formula: "1d2",
  description: "Réduit l’âge de jeu de 1 à 2 ans. Le risque cumulatif d’inversion de 1 % par potion antérieure reste à arbitrer par le MD."
});
