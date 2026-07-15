return Add2eEffectsEngine.applyConfiguredEffect({ actor, item, sourceItem, sort, args }, {
  name: "Potion de contrôle des animaux",
  slug: "controle_animaux",
  kind: "effect",
  durationFormula: "5d4",
  confirm: true,
  saveNote: "Les animaux d’Intelligence 5 ou plus ont droit à un jet de protection contre la magie.",
  tags: ["controle", "controle:animal"],
  rule: "Le type et le nombre d’animaux contrôlés dépendent de leur catégorie et de leur taille, conformément au Guide du Maître."
});
