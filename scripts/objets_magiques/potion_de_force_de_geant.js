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
  { giant: "Géant des collines", strength: 19, weight: 4500, damage: 7, rockRange: 8, rockDamage: "1d6", doors: "50 %" },
  { giant: "Géant des pierres", strength: 20, weight: 5000, damage: 8, rockRange: 16, rockDamage: "1d12", doors: "60 %" },
  { giant: "Géant du froid", strength: 21, weight: 6000, damage: 9, rockRange: 10, rockDamage: "1d8", doors: "70 %" },
  { giant: "Géant du feu", strength: 22, weight: 7500, damage: 10, rockRange: 12, rockDamage: "1d8", doors: "80 %" },
  { giant: "Géant des nuages", strength: 23, weight: 9000, damage: 11, rockRange: 14, rockDamage: "1d10", doors: "90 %" },
  { giant: "Géant des tempêtes", strength: 24, weight: 12000, damage: 12, rockRange: 16, rockDamage: "1d12", doors: "100 %" }
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

const obsoleteImage = "systems/add2e/assets/icones/sorts/magicien-force.webp";
const obsoleteEffects = Array.from(actor.effects ?? []).filter(effect =>
  String(effect?.img ?? effect?.icon ?? "") === obsoleteImage
  && normalize(effect?.name).includes("force")
);
for (const effect of obsoleteEffects) {
  await effect.update({ img: effectIcon }, { add2eInternal: true, add2eReason: "repair-invalid-force-effect-icon" });
}

// Nettoyage des anciennes versions qui ajoutaient la Force temporaire à system.for_aff.
const legacyGiantEffects = Array.from(actor.effects ?? []).filter(effect =>
  effect?.flags?.add2e?.potionSlug === "force_de_geant"
);
for (const effect of legacyGiantEffects) {
  const filteredChanges = Array.from(effect.changes ?? []).filter(change => change?.key !== "system.for_aff");
  if (filteredChanges.length !== Number(effect.changes?.length ?? 0)) {
    await effect.update({ changes: filteredChanges }, { add2eInternal: true, add2eReason: "repair-giant-strength-display" });
  }
}

const priority = 100;
const changes = [
  { key: "flags.add2e.forceEffectiveDisplay", mode: overrideMode, value: giant.strength, priority },
  { key: "system.force_bonus_degats", mode: overrideMode, value: giant.damage, priority },
  { key: "system.force_poids", mode: overrideMode, value: giant.weight, priority },
  { key: "system.charge_max", mode: overrideMode, value: giant.weight, priority },
  { key: "system.charge_max_bench", mode: overrideMode, value: giant.weight, priority },
  { key: "system.force_ouvrir", mode: overrideMode, value: giant.doors, priority },
  { key: "system.force_bonus_porte", mode: overrideMode, value: giant.doors, priority }
];

const effect = await effectsEngine.createTimedEffect({
  actor,
  name: `Potion de force de géant — ${giant.giant}`,
  img: effectIcon,
  sourceItem: source,
  rounds,
  unit: "round",
  description: `Le consommateur possède une force équivalente à celle d’un ${giant.giant.toLowerCase()} pendant ${durationRoll.total} tours.`,
  changes,
  tags: [
    "objet_magique",
    "potion",
    "potion:force_de_geant",
    `force_equivalente:${giantSlug}`,
    `force_effective:${giant.strength}`,
    "lancer_rochers",
    `rocher_portee:${giant.rockRange}`,
    `rocher_degats:${giant.rockDamage}`,
    `portes:${giant.doors.replace(/\s+/g, "")}`
  ],
  rules: [{
    kind: "characteristic_override",
    characteristic: "force",
    value: giant.strength,
    displayValue: giant.giant,
    profile: {
      degats: giant.damage,
      poids: giant.weight,
      ouvrir: giant.doors
    },
    priority
  }],
  endMessage: `La force équivalente à celle d’un ${giant.giant.toLowerCase()} prend fin sur {actor}.`,
  extraFlags: {
    potion: true,
    potionSlug: "force_de_geant",
    giantType: giant.giant,
    giantStrength: giant.strength,
    giantDamageAdjustment: giant.damage,
    giantWeightAllowance: giant.weight,
    rockRange: giant.rockRange,
    rockDamage: giant.rockDamage,
    doors: giant.doors
  }
});

if (effect && String(effect.img ?? effect.icon ?? "") !== effectIcon) {
  await effect.update({ img: effectIcon }, { add2eInternal: true, add2eReason: "force-giant-potion-icon" });
}

await effectsEngine.postGenericEffectChat(actor, "Potion de force de géant", `
  <p>Jet de dé : <b>${typeRoll.total}</b>.</p>
  <p>Type de géant : <b>${giant.giant}</b>.</p>
  <p>Durée : <b>${durationRoll.total} tours</b>.</p>
  <p>Force affectée : <b>${giant.strength}</b>.</p>
`, { img: effectIcon });

return true;