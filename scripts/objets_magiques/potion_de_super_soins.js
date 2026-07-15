const { runPotion } = await import(`/systems/add2e/scripts/objets_magiques/_potion-runtime.mjs?cb=${Date.now()}`);
return runPotion({ actor, item, sort, args }, {
  name: "Potion de super-soins",
  slug: "super_soins",
  kind: "healing",
  formula: "3d8+3"
});
