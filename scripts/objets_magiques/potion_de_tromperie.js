const { runPotion } = await import(`/systems/add2e/scripts/objets_magiques/_potion-runtime.mjs?cb=${Date.now()}`);
return runPotion({ actor, item, sort, args }, {
  name: "Potion de tromperie",
  slug: "tromperie",
  kind: "deception",
  apparentEffect: "soins",
  description: "Le consommateur croit que la potion a produit l’effet supposé, sans bénéfice réel."
});
