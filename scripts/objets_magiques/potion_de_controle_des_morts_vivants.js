return Add2eEffectsEngine.applyConfiguredEffect({ actor, item, sourceItem, sort, args }, {
  name: "Potion de contrôle des morts-vivants",
  slug: "controle_morts_vivants",
  kind: "effect",
  durationFormula: "5d4",
  confirm: true,
  saveNote: "Seuls les morts-vivants intelligents ont droit à un jet de protection contre la magie, avec un malus de −2. Maximum total : 16 dés de vie.",
  tags: ["controle", "controle:mort_vivant", "charme", "sauvegarde:magie:-2"],
  rule: "La potion n’affecte que le type de mort-vivant prévu par la potion."
});
