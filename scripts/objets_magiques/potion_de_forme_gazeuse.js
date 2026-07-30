return Add2eEffectsEngine.applyConfiguredEffect({ actor, item, sourceItem, sort, args }, {
  name: "Potion de forme gazeuse",
  slug: "forme_gazeuse",
  kind: "effect",
  selfOnly: true,
  durationFormula: "5d6",
  tags: ["transformation", "forme:gazeuse", "mouvement:flight", "immunite:armes_non_magiques", "vulnerabilite:tourbillon"],
  modifiers: [
    {
      id: "potion:forme-gazeuse:movement:ground",
      domain: "movement",
      target: "ground",
      operation: "set",
      value: 0,
      priority: 260,
      stacking: { mode: "exclusive", group: "transformation-movement:ground" },
      conditions: { active: true },
      metadata: {
        label: "Forme gazeuse — déplacement terrestre",
        producer: "magic-item-script",
        movementMode: "ground",
        modes: ["ground"]
      }
    },
    {
      id: "potion:forme-gazeuse:movement:flight",
      domain: "movement",
      target: "flight",
      operation: "set",
      value: 9,
      priority: 260,
      stacking: { mode: "exclusive", group: "transformation-movement:flight" },
      conditions: { active: true },
      metadata: {
        label: "Forme gazeuse — flottement 3 pouces",
        producer: "magic-item-script",
        movementMode: "flight",
        modes: ["flight"]
      }
    }
  ],
  extraFlags: {
    capabilityTransformation: {
      kind: "form",
      sourceKey: "potion:forme-gazeuse",
      formKey: "gazeuse",
      label: "Potion de forme gazeuse",
      movement: { ground: 0, flight: 9 },
      movementMode: "flight"
    }
  },
  rule: "Le consommateur devient gazeux et flotte à une vitesse de base de 3 pouces par round. Il traverse les ouvertures non hermétiques et ne peut être blessé que par les feux magiques et la foudre ; les tourbillons infligent des dégâts doubles."
});