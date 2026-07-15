return Add2eEffectsEngine.applyConfiguredEffect({ actor, item, sourceItem, sort, args }, {
  name: "Élixir de jeunesse",
  slug: "elixir_de_jeunesse",
  kind: "age",
  formula: "1d4+1",
  description: "Rajeunit le consommateur. La réduction d’âge est enregistrée directement lorsque la feuille possède un champ d’âge."
});
