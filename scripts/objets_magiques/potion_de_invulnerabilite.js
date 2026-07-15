const classNames = Array.from(actor?.items ?? [])
  .filter(entry => String(entry?.type ?? "").toLowerCase() === "classe")
  .map(entry => String(entry?.name ?? entry?.system?.nom ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
if (!classNames.some(name => name.includes("guerrier"))) {
  ui.notifications.warn("La potion d’invulnérabilité ne peut bénéficier qu’à un guerrier.");
  return false;
}

return Add2eEffectsEngine.applyConfiguredEffect({ actor, item, sourceItem, sort, args }, {
  name: "Potion d’invulnérabilité",
  slug: "invulnerabilite",
  kind: "effect",
  selfOnly: true,
  durationFormula: "5d4",
  tags: ["invulnerabilite", "immunite:armes_non_magiques", "immunite:creature_moins_4_dv", "bonus_ca:2", "bonus_save:2", "restriction:guerrier"],
  rule: "Immunité aux armes non magiques et aux attaques de créatures de moins de 4 DV, amélioration de CA de 2 et bonus de +2 aux jets de protection."
});
