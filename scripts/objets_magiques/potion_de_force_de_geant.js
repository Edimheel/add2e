const source = sourceItem ?? item ?? args?.[0]?.sourceItem ?? args?.[0]?.item ?? null;
if (!actor) {
  ui.notifications.error("Potion de force de géant : acteur introuvable.");
  return false;
}

const normalize = value => String(value ?? "")
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

async function ensureEffectsEngine() {
  const engine = globalThis.Add2eEffectsEngine;
  if (typeof engine?.createTimedEffect === "function" && typeof engine?.postGenericEffectChat === "function") return engine;

  const module = await import(`/systems/add2e/scripts/effects-engine/00-core.mjs?cb=${Date.now()}`);
  if (typeof module?.installEffectsEngineCore !== "function" || !globalThis.Add2eEffectsEngine) {
    throw new Error("Le noyau d’effets ADD2E est indisponible.");
  }
  module.installEffectsEngineCore(globalThis.Add2eEffectsEngine);

  if (typeof globalThis.Add2eEffectsEngine.createTimedEffect !== "function") {
    throw new Error("La création d’effets temporaires ADD2E est indisponible.");
  }
  return globalThis.Add2eEffectsEngine;
}

const effectsEngine = await ensureEffectsEngine();
const effectIcon = "icons/svg/aura.svg";
const foundryGeneration = Number(game.release?.generation ?? String(game.version ?? "13").split(".")[0]) || 13;
const overrideMode = foundryGeneration >= 14 ? "OVERRIDE" : 5;

const giantTable = [
  { giant: "Géant des collines", strength: 19, rockRange: 8, rockDamage: "1d6" },
  { giant: "Géant des pierres", strength: 20, rockRange: 16, rockDamage: "1d12" },
  { giant: "Géant du froid", strength: 21, rockRange: 10, rockDamage: "1d8" },
  { giant: "Géant du feu", strength: 22, rockRange: 12, rockDamage: "1d8" },
  { giant: "Géant des nuages", strength: 23, rockRange: 14, rockDamage: "1d10" },
  { giant: "Géant des tempêtes", strength: 24, rockRange: 16, rockDamage: "1d12" }
];

const typeRoll = await new Roll("1d6").evaluate();
const giant = giantTable[Math.max(0, Math.min(5, Number(typeRoll.total) - 1))];
const durationRoll = await new Roll("2d4").evaluate();
const rounds = Math.max(1, Number(durationRoll.total) * 10);
const giantSlug = normalize(giant.giant).replace(/[^a-z0-9]+/g, "_");

await typeRoll.toMessage({
  speaker: ChatMessage.getSpeaker({ actor }),
  flavor: `Potion de force de géant — ${giant.giant}`
});
await durationRoll.toMessage({
  speaker: ChatMessage.getSpeaker({ actor }),
  flavor: "Potion de force de géant — durée en tours"
});

const previousGiantEffects = Array.from(actor.effects ?? [])
  .filter(effect => effect?.flags?.add2e?.potionSlug === "force_de_geant")
  .map(effect => effect.id)
  .filter(Boolean);
if (previousGiantEffects.length) {
  await actor.deleteEmbeddedDocuments("ActiveEffect", previousGiantEffects, {
    add2eReason: "replace-giant-strength-potion"
  });
}

const racialBonus = Number(actor.system?.bonus_caracteristiques?.force ?? actor.system?.force_race ?? 0) || 0;
const temporaryBaseStrength = giant.strength - racialBonus;
const priority = 100;

const effect = await effectsEngine.createTimedEffect({
  actor,
  name: `Potion de force de géant — ${giant.giant}`,
  img: effectIcon,
  sourceItem: source,
  rounds,
  unit: "round",
  description: `Le consommateur possède une Force de ${giant.strength}, équivalente à celle d’un ${giant.giant.toLowerCase()}, pendant ${durationRoll.total} tours.`,
  changes: [{
    key: "system.force_base",
    mode: overrideMode,
    value: temporaryBaseStrength,
    priority
  }],
  tags: [
    "objet_magique",
    "potion",
    "potion:force_de_geant",
    `force_equivalente:${giantSlug}`,
    `force_effective:${giant.strength}`,
    "lancer_rochers",
    `rocher_portee:${giant.rockRange}`,
    `rocher_degats:${giant.rockDamage}`
  ],
  rules: [{
    kind: "characteristic_override",
    characteristic: "force",
    value: giant.strength,
    displayValue: giant.giant,
    priority
  }],
  endMessage: `La force équivalente à celle d’un ${giant.giant.toLowerCase()} prend fin sur {actor}.`,
  extraFlags: {
    potion: true,
    potionSlug: "force_de_geant",
    giantType: giant.giant,
    giantStrength: giant.strength,
    originalBaseStrength: Number(actor.system?.force_base ?? actor.system?.force ?? 10) || 10,
    temporaryBaseStrength,
    rockRange: giant.rockRange,
    rockDamage: giant.rockDamage
  }
});

if (!effect) return false;

if (String(effect.img ?? effect.icon ?? "") !== effectIcon) {
  await effect.update({ img: effectIcon }, { add2eInternal: true, add2eReason: "force-giant-potion-icon" });
}

if (typeof actor.sheet?.autoSetCaracAjustements === "function") {
  await actor.sheet.autoSetCaracAjustements();
} else if (typeof actor.autoSetCaracAjustements === "function") {
  await actor.autoSetCaracAjustements();
}
if (actor.sheet?.rendered) actor.sheet.render(false);

await effectsEngine.postGenericEffectChat(actor, "Potion de force de géant", `
  <p>Jet de dé : <b>${typeRoll.total}</b>.</p>
  <p>Type de géant : <b>${giant.giant}</b>.</p>
  <p>Durée : <b>${durationRoll.total} tours</b>.</p>
  <p>Force affectée : <b>${giant.strength}</b>.</p>
`, { img: effectIcon });

return true;