const { runPotion } = await import(`/systems/add2e/scripts/objets_magiques/_potion-runtime.mjs?cb=${Date.now()}`);
return runPotion({ actor, item, sort, args }, {
  name: "Potion de guérison suprême",
  slug: "guerison_supreme",
  kind: "healing",
  formula: "3d8+3"
});
