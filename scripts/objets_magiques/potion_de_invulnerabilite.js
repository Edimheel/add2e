const { runPotion } = await import(`/systems/add2e/scripts/objets_magiques/_potion-runtime.mjs?cb=${Date.now()}`);
return runPotion({ actor, item, sort, args }, {
  name: "Potion d’invulnérabilité",
  slug: "invulnerabilite",
  kind: "effect",
  selfOnly: true,
  durationFormula: "5d4",
  tags: ["invulnerabilite", "immunite:armes_non_magiques", "immunite:creature_moins_4_dv", "bonus:ca:2", "bonus:sauvegarde:2", "restriction:guerrier"],
  rule: "Immunité aux armes non magiques et aux attaques de créatures de moins de 4 DV, amélioration de CA de 2 et bonus de +2 aux jets de protection. Seuls les guerriers peuvent en bénéficier."
});
