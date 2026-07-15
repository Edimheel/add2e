return Add2eEffectsEngine.applyConfiguredEffect({ actor, item, sourceItem, sort, args }, {
  name: "Potion de super-héroïsme",
  slug: "super_heroisme",
  kind: "heroism",
  maxLevelExclusive: 13,
  durationFormula: "5d4",
  levelTable: [
    { min: 0, max: 0, bonus: 6, hpDice: "5d10" },
    { min: 1, max: 3, bonus: 5, hpDice: "4d10+1" },
    { min: 4, max: 6, bonus: 4, hpDice: "3d10+1" },
    { min: 7, max: 9, bonus: 3, hpDice: "2d10+3" },
    { min: 10, max: 12, bonus: 2, hpDice: "1d10+2" }
  ],
  tags: ["super_heroisme", "bonus:martial"]
});
