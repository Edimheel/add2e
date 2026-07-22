// ADD2E — Pouvoirs d'objets magiques / effets périodiques.

import { VERSION, EFFECT_FLAG, clone, currentTick, hp, itemUsable, list, norm, primaryGM, signed } from "./runtime.mjs";

const periodicEntries = effect => Array.isArray(effect?.flags?.add2e?.periodic)
  ? effect.flags.add2e.periodic.filter(Boolean) : [];
const periodicEffects = actor => Array.from(actor?.effects ?? [])
  .filter(effect => !effect.disabled && effect.flags?.add2e?.[EFFECT_FLAG] === true && periodicEntries(effect).length);

function allActors() {
  const map = new Map();
  const add = actor => actor && map.set(String(actor.uuid ?? actor.id), actor);
  for (const actor of game.actors ?? []) add(actor);
  for (const token of canvas?.tokens?.placeables ?? []) add(token.actor);
  for (const combat of game.combats ?? []) {
    for (const combatant of combat.combatants ?? []) add(combatant.actor ?? combatant.token?.actor);
  }
  return [...map.values()];
}

async function regenerationCard(actor, item, effect, before, after, healed, pulses, intervalRounds) {
  if (typeof globalThis.add2eCreateChatCard !== "function") return;
  await globalThis.add2eCreateChatCard({
    actor,
    title: "Régénération",
    icon: "fas fa-heart-pulse",
    variant: "healing",
    source: {
      name: item?.name ?? effect.flags?.add2e?.sourceItemName ?? "Objet magique",
      img: item?.img ?? effect.img,
      type: "Objet magique",
      meta: effect.name
    },
    target: { name: actor.name, img: actor.img },
    rows: [
      { label: "Points récupérés", value: healed },
      { label: "Pulsations", value: pulses },
      { label: "Intervalle", value: `${intervalRounds} round(s) moteur` },
      { label: "Points de vie", value: `${before} → ${after}` }
    ],
    chatData: { flags: { add2e: {
      magicItemRegeneration: true,
      sourceItemId: item?.id,
      sourceEffectId: effect.id,
      actorId: actor.id,
      healed, pulses, before, after, intervalRounds,
      version: VERSION
    } } }
  });
}

async function applyRegeneration(actor, effect, tick) {
  const item = actor.items?.get?.(String(effect.flags?.add2e?.sourceItemId ?? ""));
  if (!item || !itemUsable(item)) return { applied: false, reason: "source-item-not-equipped" };
  const entries = periodicEntries(effect).filter(entry => norm(entry.type) === "regeneration");
  const descriptor = hp(actor);
  if (!entries.length || !descriptor) return { applied: false, reason: !entries.length ? "no-regeneration-entry" : "hp-schema-not-supported" };
  const state = clone(effect.flags?.add2e?.periodicState ?? {});
  const last = Number(state.lastTick);
  if (!Number.isFinite(last) || tick < last) {
    await effect.update({ "flags.add2e.periodicState.lastTick": tick }, { add2eMagicPowerEffectsAdapter: true });
    return { applied: false, reason: "clock-initialized" };
  }
  let pulses = 0;
  let requested = 0;
  let consumed = 0;
  for (const entry of entries) {
    const interval = Math.max(1, Math.floor(Number(entry.intervalRounds) || 0));
    const points = Math.max(0, Math.floor(Number(entry.points) || 0));
    const count = interval && points ? Math.floor((tick - last) / interval) : 0;
    if (count > 0) {
      pulses += count;
      requested += count * points;
      consumed = Math.max(consumed, count * interval);
    }
  }
  if (!pulses) return { applied: false, reason: "interval-not-reached" };
  const before = descriptor.value;
  const after = before > 0 ? Math.min(descriptor.max, before + requested) : before;
  const healed = Math.max(0, after - before);
  if (healed) {
    await actor.update({ [descriptor.path]: after }, {
      add2eMagicPowerRegeneration: true,
      add2eMagicPowerRegenerationEffectId: effect.id
    });
    await globalThis.add2eSyncActorVitalStatus?.(actor, { reason: "magic-item-regeneration" });
  }
  await effect.update({
    "flags.add2e.periodicState.lastTick": last + consumed,
    "flags.add2e.periodicState.lastAppliedTick": tick,
    "flags.add2e.periodicState.pulses": (Number(state.pulses) || 0) + pulses,
    "flags.add2e.periodicState.healed": (Number(state.healed) || 0) + healed,
    "flags.add2e.periodicState.lastResult": { before, after, healed, requested, pulses, tick }
  }, { add2eMagicPowerEffectsAdapter: true });
  if (healed) await regenerationCard(actor, item, effect, before, after, healed, pulses, Math.max(1, Number(entries[0].intervalRounds) || 1));
  return { applied: healed > 0, actor: actor.name, effect: effect.name, before, after, healed, requested, pulses, tick };
}

async function applyProgressive(actor, effect, tick) {
  const combat = game.combat;
  if (!combat?.started || !Array.from(combat.combatants ?? [])
    .some(combatant => String(combatant.actorId ?? combatant.actor?.id) === String(actor.id))) {
    return { applied: false, reason: "actor-not-in-active-combat" };
  }
  const entry = periodicEntries(effect).find(value => norm(value.type) === "progressive_weapon_bonus");
  const cycle = list(entry?.cycle).map(Number).filter(Number.isFinite);
  const state = clone(effect.flags?.add2e?.periodicState ?? {});
  const last = Number(state.lastTick);
  if (!cycle.length || !Number.isFinite(last) || tick <= last) return { applied: false, reason: "no-new-round" };
  const step = Math.max(0, (Number(state.cycleIndex) || 0) + tick - last);
  const value = cycle[step % cycle.length];
  const tags = list(effect.flags?.add2e?.tags)
    .filter(tag => !String(tag).startsWith("bonus_attaque:") && !String(tag).startsWith("bonus_degats:"));
  tags.push(`bonus_attaque:${signed(value)}`, `bonus_degats:${signed(value)}`);
  await effect.update({
    "flags.add2e.tags": tags,
    "flags.add2e.effectTags": tags,
    "flags.add2e.periodicState.lastTick": tick,
    "flags.add2e.periodicState.lastAppliedTick": tick,
    "flags.add2e.periodicState.cycleIndex": step
  }, { add2eMagicPowerEffectsAdapter: true });
  return { applied: true, actor: actor.name, effect: effect.name, value, tick };
}

export async function processPeriodic(tick = currentTick()) {
  if (!primaryGM()) return { ok: false, reason: "not-primary-gm", tick };
  const rows = [];
  let effects = 0;
  let healed = 0;
  for (const actor of allActors()) {
    for (const effect of periodicEffects(actor)) {
      effects += 1;
      try {
        const types = periodicEntries(effect).map(entry => norm(entry.type));
        if (types.includes("regeneration")) {
          const result = await applyRegeneration(actor, effect, tick);
          rows.push(result);
          healed += Number(result.healed) || 0;
        }
        if (types.includes("progressive_weapon_bonus")) rows.push(await applyProgressive(actor, effect, tick));
      } catch (error) {
        console.error("[ADD2E][MAGIC_POWER_EFFECTS][PERIODIC_EFFECT]", { actor: actor.name, effect: effect.name, error });
      }
    }
  }
  return { ok: true, tick, effects, healed, rows };
}
