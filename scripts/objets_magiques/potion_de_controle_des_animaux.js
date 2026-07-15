const { runPotion } = await import(`/systems/add2e/scripts/objets_magiques/_potion-runtime.mjs?cb=${Date.now()}`);
return runPotion({ actor, item, sort, args }, {
  name: "Potion de contrôle des animaux",
  slug: "controle_animaux",
  kind: "effect",
  durationFormula: "5d4",
  confirm: true,
  saveNote: "Les animaux d’Intelligence 5 ou plus ont droit à un jet de protection contre la magie.",
  tags: ["controle", "controle:animal"],
  rule: "Le type et le nombre d’animaux contrôlés dépendent de leur catégorie et de leur taille, conformément au Guide du Maître."
});
