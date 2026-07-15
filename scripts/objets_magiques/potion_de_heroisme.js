const { runPotion } = await import(`/systems/add2e/scripts/objets_magiques/_potion-runtime.mjs?cb=${Date.now()}`);
return runPotion({ actor, item, sort, args }, {
  name: "Potion de héroïsme",
  slug: "heroisme",
  kind: "heroism",
  maxLevelExclusive: 10,
  durationFormula: "5d4",
  levelTable: [
    { min: 0, max: 3, bonus: 4, hpDice: "4d10" },
    { min: 4, max: 6, bonus: 3, hpDice: "3d10" },
    { min: 7, max: 9, bonus: 2, hpDice: "2d10" }
  ],
  tags: ["heroisme", "bonus:martial"]
});
