// ADD2E — Résolution canonique des jets de toucher de sort.
// Compatible Foundry V13/V14/V15.
// Ce module ne crée ni carte de chat, ni dégâts : le consommateur reste propriétaire du résultat métier.

import { resolveCanonicalThac0 } from "../add2e/17b-multiclass-core.mjs";

const ADD2E_TOUCH_ATTACK_VERSION = "2026-09-17-canonical-spell-touch-v1";

function add2eTouchReadNumber(system, ...paths) {
  for (const path of paths) {
    let value = system?.[path];
    if (value === undefined && typeof foundry?.utils?.getProperty === "function") {
      value = foundry.utils.getProperty(system, path);
    }
    if (value === undefined || value === null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return { value: number, path };
  }
  return { value: null, path: null };
}

function add2eResolveTouchArmorClass({ targetActor, attacker = null, sourceItem = null } = {}) {
  if (!targetActor) throw new Error("Jet de toucher ADD2E : cible absente.");

  const engine = globalThis.ADD2E_EFFECTS;
  if (!engine) throw new Error("Jet de toucher ADD2E : moteur canonique des effets indisponible.");

  if (String(targetActor.type ?? "").toLowerCase() === "personnage") {
    if (typeof engine.getMagicPassiveDefense !== "function") {
      throw new Error("Jet de toucher ADD2E : défense magique canonique indisponible pour le personnage ciblé.");
    }
    const details = engine.getMagicPassiveDefense(targetActor, {
      source: "spell-touch-attack",
      attacker: attacker?.name ?? null,
      weapon: sourceItem?.name ?? null,
      sourceItem,
      attackerActor: attacker
    });
    const armorClass = Number(details?.caTotal);
    if (!Number.isFinite(armorClass)) {
      throw new Error(`${targetActor.name ?? "Cible"} : classe d’armure canonique invalide pour le jet de toucher.`);
    }
    return {
      value: armorClass,
      source: "effects-engine:magic-passive-defense",
      details
    };
  }

  const read = add2eTouchReadNumber(
    targetActor.system ?? {},
    "armorClass",
    "ca",
    "ac",
    "ca_naturel",
    "defense.armorClass",
    "defense.ca",
    "combat.armorClass",
    "combat.ca"
  );
  if (!Number.isFinite(read.value)) {
    throw new Error(`${targetActor.name ?? "Cible"} : classe d’armure canonique absente pour le jet de toucher.`);
  }
  return {
    value: read.value,
    source: `system.${read.path}`,
    details: null
  };
}

export async function add2eResolveTouchAttack({
  actor,
  targetActor,
  sourceItem = null,
  bonus = 0,
  showDice = false
} = {}) {
  if (!actor) throw new Error("Jet de toucher ADD2E : lanceur absent.");
  if (!targetActor) throw new Error("Jet de toucher ADD2E : cible absente.");

  const thac0Resolution = resolveCanonicalThac0(actor);
  const thac0 = Number(thac0Resolution?.value);
  if (!Number.isFinite(thac0)) {
    throw new Error(`${actor.name ?? "Lanceur"} : THAC0 canonique invalide pour le jet de toucher.`);
  }

  const armorClassResolution = add2eResolveTouchArmorClass({ targetActor, attacker: actor, sourceItem });
  const armorClass = Number(armorClassResolution.value);
  const modifier = Number(bonus);
  if (!Number.isFinite(modifier)) throw new Error("Jet de toucher ADD2E : bonus/malus invalide.");

  const thresholdBase = thac0 - armorClass;
  const threshold = thresholdBase - modifier;
  const roll = await new Roll("1d20").evaluate();
  if (showDice === true) {
    try { await game.dice3d?.showForRoll?.(roll); }
    catch (error) { console.warn("[ADD2E][TOUCH_ATTACK][DSN]", error); }
  }

  const d20 = Number(roll.total) || 0;
  const total = d20 + modifier;
  const natural20 = d20 === 20;
  const natural1 = d20 === 1;
  const success = natural20 || (!natural1 && d20 >= threshold);

  return Object.freeze({
    ok: true,
    roll,
    d20,
    thac0,
    thac0Source: String(thac0Resolution?.source ?? ""),
    armorClass,
    armorClassSource: armorClassResolution.source,
    armorClassDetails: armorClassResolution.details,
    bonus: modifier,
    thresholdBase,
    threshold,
    total,
    success,
    natural20,
    natural1,
    version: ADD2E_TOUCH_ATTACK_VERSION
  });
}

globalThis.add2eResolveTouchAttack = add2eResolveTouchAttack;
