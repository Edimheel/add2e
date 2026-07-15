const { runPotion } = await import(`/systems/add2e/scripts/objets_magiques/_potion-runtime.mjs?cb=${Date.now()}`);
return runPotion({ actor, item, sort, args }, {
  name: "Potion de longévité",
  slug: "longevite",
  kind: "age",
  formula: "1d2",
  description: "Réduit l’âge de jeu de 1 à 2 ans. Le risque cumulatif d’inversion de 1 % par potion antérieure reste à arbitrer par le MD."
});
