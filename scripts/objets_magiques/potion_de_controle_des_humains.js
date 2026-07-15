const { runPotion } = await import(`/systems/add2e/scripts/objets_magiques/_potion-runtime.mjs?cb=${Date.now()}`);
return runPotion({ actor, item, sort, args }, {
  name: "Potion de contrôle des humains",
  slug: "controle_humains",
  kind: "effect",
  durationFormula: "5d6",
  confirm: true,
  saveNote: "Chaque humain, demi-humain ou humanoïde ciblé a droit à un jet de protection contre la magie. Maximum total : 32 niveaux ou dés de vie.",
  tags: ["controle", "controle:humanoide", "charme"],
  rule: "Le type de créatures contrôlables dépend de la potion particulière."
});
