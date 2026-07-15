return Add2eEffectsEngine.applyConfiguredEffect({ actor, item, sourceItem, sort, args }, {
  name: "Potion de contrôle des dragons",
  slug: "controle_dragons",
  kind: "effect",
  durationFormula: "5d4",
  confirm: true,
  saveNote: "Le dragon a droit à un jet de protection contre la magie avec un malus de −2.",
  tags: ["controle", "controle:dragon", "sauvegarde:magie:-2"],
  rule: "La potion affecte les dragons du type prévu par la potion dans un rayon de 6 pouces."
});
