const source = sourceItem ?? item ?? args?.[0]?.sourceItem ?? args?.[0]?.item ?? null;
if (!actor) {
  ui.notifications.error("Potion de force de géant : acteur introuvable.");
  return false;
}

const normalize = value => String(value ?? "")
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const isFighter = Array.from(actor.items ?? []).some(entry => {
  if (String(entry?.type ?? "").toLowerCase() !== "classe") return false;
  return [entry.name, entry.system?.nom, entry.system?.name, entry.system?.label, entry.system?.slug]
    .map(normalize)
    .some(value => value.includes("guerrier"));
});
if (!isFighter) {
  ui.notifications.warn("La potion de force de géant ne peut être utilisée que par un guerrier.");
  return false;
}

const giantTable = [
  { giant: "Géant des collines", weight: 4500, damage: 7, rockRange: 8, rockDamage: "1d6", doors: "50 %" },
  { giant: "Géant des pierres", weight: 5000, damage: 8, rockRange: 16, rockDamage: "1d12", doors: "60 %" },
  { giant: "Géant du froid", weight: 6000, damage: 9, rockRange: 10, rockDamage: "1d8", doors: "70 %" },
  { giant: "Géant du feu", weight: 7500, damage: 10, rockRange: 12, rockDamage: "1d8", doors: "80 %" },
  { giant: "Géant des nuages", weight: 9000, damage: 11, rockRange: 14, rockDamage: "1d10", doors: "90 %" },
  { giant: "Géant des tempêtes", weight: 12000, damage: 12, rockRange: 16, rockDamage: "1d12", doors: "100 %" }
];

const typeRoll = await new Roll("1d6").evaluate();
const giant = giantTable[Math.max(0, Math.min(5, Number(typeRoll.total) - 1))];
const durationRoll = await new Roll("2d4").evaluate();
const rounds = Math.max(1, Number(durationRoll.total) * 10);

await typeRoll.toMessage({
  speaker: ChatMessage.getSpeaker({ actor }),
  flavor: "Potion de force de géant — type de géant"
});
await durationRoll.toMessage({
  speaker: ChatMessage.getSpeaker({ actor }),
  flavor: "Potion de force de géant — durée en tours"
});

await Add2eEffectsEngine.createTimedCharacteristicEffect({
  actor,
  characteristic: "force",
  value: normalize(giant.giant).replace(/[^a-z0-9]+/g, "_"),
  displayValue: giant.giant,
  profile: {
    degats: giant.damage,
    poids: giant.weight,
    ouvrir: giant.doors
  },
  priority: 100,
  name: "Potion de force de géant",
  img: source?.img,
  sourceItem: source,
  rounds,
  unit: "round",
  description: `Le consommateur possède une force équivalente à celle d’un ${giant.giant.toLowerCase()} pendant ${durationRoll.total} tours.`,
  tags: [
    "objet_magique",
    "potion",
    "potion:force_de_geant",
    `force_equivalente:${normalize(giant.giant).replace(/[^a-z0-9]+/g, "_")}`,
    "lancer_rochers",
    `rocher_portee:${giant.rockRange}`,
    `rocher_degats:${giant.rockDamage}`,
    `portes:${giant.doors.replace(/\s+/g, "")}`
  ],
  endMessage: "La force de géant prend fin sur {actor}.",
  extraFlags: {
    potion: true,
    potionSlug: "force_de_geant",
    giantType: giant.giant,
    giantDamageAdjustment: giant.damage,
    giantWeightAllowance: giant.weight,
    rockRange: giant.rockRange,
    rockDamage: giant.rockDamage,
    doors: giant.doors
  }
});

await Add2eEffectsEngine.postGenericEffectChat(actor, "Potion de force de géant", `
  <p>Force équivalente : <b>${giant.giant}</b>.</p>
  <p>Ajustement aux dégâts : <b>+${giant.damage}</b>.</p>
  <p>Poids permis : <b>+${giant.weight}</b>.</p>
  <p>Durée : <b>${durationRoll.total} tours</b> (${rounds} rounds).</p>
  <p>Lancer de rochers : portée <b>${giant.rockRange}\"</b>, dégâts <b>${giant.rockDamage}</b>.</p>
  <p>Portes : <b>${giant.doors}</b>.</p>
`, source);

return true;
