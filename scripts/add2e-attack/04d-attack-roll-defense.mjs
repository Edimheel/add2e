// scripts/add2e-attack/04d-attack-roll-defense.mjs
// ADD2E — Adaptateur de CA des attaques vers le résolveur canonique.
// Compatible Foundry V13/V14/V15.

export const ADD2E_ATTACK_DEFENSE_VERSION = "2026-07-23-canonical-armor-class-adapter-v2";

function add2eAttackArmorClassEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.resolveArmorClass !== "function") {
    throw new Error("Le résolveur canonique ADD2E de classe d’armure n’est pas disponible.");
  }
  return engine;
}

export function add2eAttackComputeCharacterDisplayedCA(targetActor, context = {}) {
  if (!targetActor) throw new Error("Cible manquante pour la résolution de CA.");
  const resolution = add2eAttackArmorClassEngine().resolveArmorClass(targetActor, {
    ...context,
    source: context.source ?? "attack-defense-adapter"
  });

  return {
    caTotal: Number(resolution.caTotal),
    caNaturel: Number(resolution.caNaturel),
    armorBase: Number(resolution.armorBase),
    armorSource: resolution.armorName ?? resolution.fixedSource ?? resolution.mode,
    dexMod: Number(resolution.dex) || 0,
    dexSource: resolution.dexIgnored ? "ignored" : "canonical-ability-resolver",
    shieldMod: -(Number(resolution.shieldBonus) || 0),
    shieldSource: resolution.shieldSources?.join(", ") || (resolution.shieldIgnored ? "ignored" : "none"),
    stored: {
      ca: targetActor.system?.ca,
      armorClass: targetActor.system?.armorClass,
      ca_total: targetActor.system?.ca_total,
      ca_naturel: targetActor.system?.ca_naturel
    },
    resolution
  };
}

globalThis.ADD2E_ATTACK_DEFENSE_VERSION = ADD2E_ATTACK_DEFENSE_VERSION;
