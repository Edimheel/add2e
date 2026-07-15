const { runPotion } = await import(`/systems/add2e/scripts/objets_magiques/_potion-runtime.mjs?cb=${Date.now()}`);
return runPotion({ actor, item, sort, args }, {
  name: "Potion de contrôle des plantes",
  slug: "controle_plantes",
  kind: "effect",
  durationFormula: "5d4",
  confirm: true,
  saveNote: "Les monstres végétaux d’Intelligence 5 ou plus ont droit à un jet de protection contre la magie.",
  tags: ["controle", "controle:plante"],
  rule: "Portée 9 pouces ; surface contrôlée 2 pouces sur 2 pouces. Les ordres doivent respecter les possibilités normales des plantes."
});
