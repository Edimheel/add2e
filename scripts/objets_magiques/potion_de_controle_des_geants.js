return Add2eEffectsEngine.applyConfiguredEffect({ actor, item, sourceItem, sort, args }, {
  name: "Potion de contrôle des géants",
  slug: "controle_geants",
  kind: "effect",
  durationFormula: "5d6",
  confirm: true,
  saveNote: "Un géant ciblé effectue sa sauvegarde contre la magie à −4 ; deux géants la font à +2.",
  tags: ["controle", "controle:geant"],
  rule: "La potion affecte un ou deux géants du type correspondant à la potion."
});
