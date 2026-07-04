// ============================================================================
// ADD2E — Sauvegardes périodiques des charmes de type Charme-personne.
// Version : 2026-07-04-charm-person-periodic-saves-v1
// Compatible Foundry V13/V14/V15.
// ============================================================================

import { add2eTimeCurrentTick } from "./19a-time-engine.mjs";

export const ADD2E_CHARM_PERIODIC_SAVE_VERSION = "2026-07-04-charm-person-periodic-saves-v1";

const TAG = "[ADD2E][CHARM_PERIODIC_SAVE]";
const FLAG_SCOPE = "add2e";
const FLAG_KEY = "charmPeriodicSave";
const MAX_SAVES_PER_PASS = 1000;
const processingEffects = new Set();
let hooksRegistered = false;

function number(value, fallback = NaN) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function chatStyleData() {
  return CONST.CHAT_MESSAGE_STYLES
    ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
    : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
}

function isResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id || !game.users?.activeGM;
}

function gmIds() {
  try {
    const ids = (ChatMessage.getWhisperRecipients?.("GM") ?? [])
      .map(user => user?.id)
      .filter(Boolean);
    if (ids.length) return ids;
  } catch (_error) {}

  return Array.from(game.users ?? [])
    .filter(user => user?.isGM)
    .map(user => user.id)
    .filter(Boolean);
}

function actorOwnerPlayerIds(actor) {
  const ids = [];
  const ownerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;

  for (const user of game.users ?? []) {
    if (!user || user.isGM) continue;

    let owner = false;
    try {
      owner = actor?.testUserPermission?.(user, "OWNER") === true;
    } catch (_error) {}

    if (!owner) {
      const permission = number(actor?.ownership?.[user.id] ?? actor?.permission?.[user.id], 0);
      const defaultPermission = number(actor?.ownership?.default ?? actor?.permission?.default, 0);
      owner = permission >= ownerLevel || defaultPermission >= ownerLevel;
    }

    if (owner) ids.push(user.id);
  }

  return ids;
}

function effectState(effect) {
  const value = effect?.flags?.[FLAG_SCOPE]?.[FLAG_KEY];
  if (!value || typeof value !== "object" || value.enabled !== true) return null;

  const intervalTicks = Math.max(1, Math.floor(number(value.intervalTicks, NaN)));
  const nextSaveTick = Math.floor(number(value.nextSaveTick, NaN));
  if (!Number.isFinite(intervalTicks) || !Number.isFinite(nextSaveTick)) return null;

  return {
    ...value,
    intervalTicks,
    nextSaveTick,
    intelligence: Math.max(0, Math.floor(number(value.intelligence, 0))),
    attempts: Math.max(0, Math.floor(number(value.attempts, 0))),
    intervalLabel: String(value.intervalLabel || "délai spécial")
  };
}

function effectKey(actor, effect) {
  return `${actor?.uuid ?? actor?.id ?? "actor"}::${effect?.id ?? "effect"}`;
}

function getSagesse(actor) {
  return number(
    actor?.system?.sagesse
      ?? actor?.system?.sagesse_base
      ?? actor?.system?.sag_aff
      ?? actor?.system?.abilities?.wis?.value,
    0
  ) || 0;
}

function getSaveVsSpell(actor) {
  const system = actor?.system ?? {};
  const direct = number(system.sauvegardes?.sorts ?? system.saves?.spells ?? system.save_spells, NaN);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const level = Math.max(1, Math.floor(number(system.niveau ?? system.level, 1)));
  const classItem = actor?.items?.find?.(entry => entry.type === "classe");
  const saves = classItem?.system?.progression?.[level - 1]?.savingThrows;
  const fromClass = Array.isArray(saves) ? number(saves[4], NaN) : NaN;
  return Number.isFinite(fromClass) && fromClass > 0 ? fromClass : 15;
}

async function rollSaveVsSpell(actor) {
  const engine = globalThis.Add2eEffectsEngine;
  const wisdom = getSagesse(actor);
  const wisdomBonus = wisdom >= 15 ? wisdom - 14 : 0;

  if (typeof engine?.rollActionSave === "function") {
    const result = await engine.rollActionSave(actor, "sorts", wisdomBonus);
    if (result?.canRoll) {
      return {
        total: number(result.total, 0),
        threshold: number(result.threshold, getSaveVsSpell(actor)),
        success: result.success === true,
        wisdomBonus,
        racialBonus: number(result.racialBonus, 0),
        usedEngine: true
      };
    }
  }

  const threshold = getSaveVsSpell(actor);
  const racialBonus = number(engine?.getSaveBonus?.(actor, "sorts"), 0);
  const totalBonus = wisdomBonus + racialBonus;
  const formula = totalBonus ? `1d20${totalBonus >= 0 ? "+" : ""}${totalBonus}` : "1d20";
  const roll = await new Roll(formula).evaluate({ async: true });
  if (game.dice3d) await game.dice3d.showForRoll(roll);

  const total = number(roll.total, 0);
  return {
    total,
    threshold,
    success: total >= threshold,
    wisdomBonus,
    racialBonus,
    usedEngine: false
  };
}

function saveBonusLabel(save) {
  const parts = [];
  const wisdom = number(save?.wisdomBonus, 0);
  const racial = number(save?.racialBonus, 0);
  if (wisdom) parts.push(`${wisdom >= 0 ? "+" : ""}${wisdom} Sag`);
  if (racial) parts.push(`${racial >= 0 ? "+" : ""}${racial} racial`);
  return parts.length ? ` (${parts.join(" ; ")})` : "";
}

async function endCharmVfx(actor) {
  if (typeof Sequencer === "undefined") return;

  for (const token of actor?.getActiveTokens?.() ?? []) {
    try {
      Sequencer.EffectManager.endEffects({ name: `charme-effect-${token.id}`, object: token });
    } catch (error) {
      console.warn(`${TAG}[VFX_END_FAILED]`, { actor: actor?.name, tokenId: token?.id, error });
    }
  }
}

async function notifyPeriodicSave(actor, effect, state, attempts, { escaped = false, nextSaveTick = null } = {}) {
  const whisper = [...new Set([...gmIds(), ...actorOwnerPlayerIds(actor)])].filter(Boolean);
  if (!whisper.length || !attempts.length) return false;

  const last = attempts.at(-1);
  const first = attempts[0];
  const count = attempts.length;
  const actorName = actor?.name ?? "La cible";
  const effectName = effect?.name ?? "Charmé";
  const spellName = String(state.spellName || "Charme-personne");
  const img = effect?.img || effect?.icon || actor?.img || "icons/svg/status/heart.svg";
  const dueDetail = count === 1
    ? `Jet : <b>${last.total}</b>${htmlEscape(saveBonusLabel(last))} contre <b>${last.threshold}</b>.`
    : `${count} jets périodiques étaient dus ; dernier jet : <b>${last.total}</b>${htmlEscape(saveBonusLabel(last))} contre <b>${last.threshold}</b>.`;
  const result = escaped
    ? `${htmlEscape(actorName)} réussit son jet et se libère du charme.`
    : `${htmlEscape(actorName)} reste charmé. Prochain jet dans <b>${htmlEscape(state.intervalLabel)}</b>.`;
  const nextLine = !escaped && Number.isFinite(Number(nextSaveTick))
    ? `<div style="margin-top:5px;font-size:11px;color:#5d4037;">Prochain contrôle au tick ADD2E <b>${Math.floor(Number(nextSaveTick))}</b>.</div>`
    : "";

  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper,
      content: `
        <div class="add2e-chat-card add2e-charm-periodic-save" style="border:1px solid #8e44ad;border-radius:8px;overflow:hidden;background:#fff7fd;color:#3c1c46;font-family:var(--font-primary);">
          <div style="display:flex;align-items:center;gap:8px;background:#7d3c98;color:#fff;padding:7px 9px;">
            <img src="${htmlEscape(img)}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;border:1px solid #e8daef;background:#fff;" />
            <div style="flex:1;line-height:1.15;">
              <div style="font-weight:900;font-size:13px;">Sauvegarde périodique</div>
              <div style="font-size:12px;opacity:.95;">${htmlEscape(spellName)}</div>
            </div>
          </div>
          <div style="padding:8px 10px;background:#fff7fd;">
            <div style="font-size:13px;margin-bottom:5px;"><b>Cible :</b> ${htmlEscape(actorName)}</div>
            <div style="border:1px solid ${escaped ? "#2e8b57" : "#b9770e"};border-radius:6px;background:#fff;padding:8px;text-align:center;font-size:13px;line-height:1.35;">
              <div style="font-weight:900;color:${escaped ? "#1e8449" : "#af601a"};">${escaped ? "CHARME ROMPU" : "CHARME MAINTENU"}</div>
              <div style="margin-top:4px;">${result}</div>
              <div style="margin-top:4px;">${dueDetail}</div>
            </div>
            ${nextLine}
            <div style="margin-top:6px;font-size:11px;color:#6c3483;text-align:center;">Effet : ${htmlEscape(effectName)} — Intelligence : ${state.intelligence}</div>
          </div>
        </div>`,
      flags: {
        add2e: {
          charmPeriodicSaveMessage: true,
          actorId: actor?.id ?? null,
          actorUuid: actor?.uuid ?? null,
          effectId: effect?.id ?? null,
          spellName,
          attempts: count,
          escaped,
          tick: add2eTimeCurrentTick(),
          version: ADD2E_CHARM_PERIODIC_SAVE_VERSION
        }
      },
      ...chatStyleData()
    });
    return true;
  } catch (error) {
    console.warn(`${TAG}[CHAT_FAILED]`, { actor: actor?.name, effectId: effect?.id, error });
    return false;
  }
}

async function processEffect(actor, effect) {
  const state = effectState(effect);
  if (!state || !actor?.effects?.get?.(effect.id) || effect.disabled) return { processed: false, reason: "inactive" };
  if (!isResponsibleGM()) return { processed: false, reason: "not-responsible-gm" };

  const key = effectKey(actor, effect);
  if (processingEffects.has(key)) return { processed: false, reason: "already-processing" };

  processingEffects.add(key);
  try {
    const currentTick = add2eTimeCurrentTick();
    if (currentTick < state.nextSaveTick) return { processed: false, reason: "not-due", nextSaveTick: state.nextSaveTick };

    const attempts = [];
    let dueTick = state.nextSaveTick;
    let escaped = false;

    while (dueTick <= currentTick && attempts.length < MAX_SAVES_PER_PASS) {
      const save = await rollSaveVsSpell(actor);
      attempts.push({ ...save, dueTick });
      if (save.success) {
        escaped = true;
        break;
      }
      dueTick += state.intervalTicks;
    }

    if (!attempts.length) return { processed: false, reason: "no-attempt" };

    if (escaped) {
      await endCharmVfx(actor);
      if (actor.effects?.get?.(effect.id)) await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id], { add2eCharmPeriodicSave: true });
      await notifyPeriodicSave(actor, effect, state, attempts, { escaped: true });
      return { processed: true, escaped: true, attempts: attempts.length };
    }

    if (attempts.length >= MAX_SAVES_PER_PASS && dueTick <= currentTick) {
      console.warn(`${TAG}[SAVE_CAP_REACHED]`, { actor: actor.name, effectId: effect.id, currentTick, dueTick, attempts: attempts.length });
    }

    await effect.update({
      [`flags.${FLAG_SCOPE}.${FLAG_KEY}.nextSaveTick`]: dueTick,
      [`flags.${FLAG_SCOPE}.${FLAG_KEY}.lastSaveTick`]: attempts.at(-1).dueTick,
      [`flags.${FLAG_SCOPE}.${FLAG_KEY}.attempts`]: state.attempts + attempts.length,
      [`flags.${FLAG_SCOPE}.${FLAG_KEY}.lastCheckTick`]: currentTick
    }, { add2eCharmPeriodicSave: true });
    await notifyPeriodicSave(actor, effect, state, attempts, { escaped: false, nextSaveTick: dueTick });

    return { processed: true, escaped: false, attempts: attempts.length, nextSaveTick: dueTick };
  } catch (error) {
    console.error(`${TAG}[PROCESS_FAILED]`, { actor: actor?.name, actorId: actor?.id, effectId: effect?.id, error });
    return { processed: false, reason: "error", error };
  } finally {
    processingEffects.delete(key);
  }
}

function collectionValues(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value.contents !== "undefined") return Array.from(value.contents ?? []);
  if (typeof value.values === "function") return Array.from(value.values());
  if (typeof value[Symbol.iterator] === "function" && typeof value !== "string") return Array.from(value);
  return [];
}

function tokenActor(tokenLike) {
  return tokenLike?.actor ?? tokenLike?.document?.actor ?? tokenLike?.object?.actor ?? null;
}

function allActors() {
  const rows = [];
  const seen = new Set();
  const add = actor => {
    if (!actor) return;
    const key = String(actor.uuid ?? actor.id ?? actor.name ?? "");
    if (!key || seen.has(key)) return;
    seen.add(key);
    rows.push(actor);
  };

  for (const actor of collectionValues(game.actors)) add(actor);
  for (const combatant of collectionValues(game.combat?.combatants)) add(tokenActor(combatant) ?? combatant?.actor);
  for (const token of collectionValues(canvas?.tokens?.placeables)) add(tokenActor(token));
  for (const scene of collectionValues(game.scenes)) {
    for (const token of collectionValues(scene?.tokens)) add(tokenActor(token));
  }

  return rows;
}

export async function add2eProcessPeriodicCharmForActor(actor) {
  if (!isResponsibleGM() || !actor) return { actor: actor?.name ?? null, processed: 0, escaped: 0 };

  let processed = 0;
  let escaped = 0;
  for (const effect of Array.from(actor.effects ?? [])) {
    const result = await processEffect(actor, effect);
    if (result.processed) processed += 1;
    if (result.escaped) escaped += 1;
  }
  return { actor: actor.name, processed, escaped };
}

export async function add2eProcessPeriodicCharms({ reason = "manual" } = {}) {
  if (!isResponsibleGM()) return { ok: false, reason: "not-responsible-gm", actors: 0, processed: 0, escaped: 0 };

  let processed = 0;
  let escaped = 0;
  const actors = allActors();
  for (const actor of actors) {
    const result = await add2eProcessPeriodicCharmForActor(actor);
    processed += result.processed;
    escaped += result.escaped;
  }

  return { ok: true, reason, actors: actors.length, processed, escaped, tick: add2eTimeCurrentTick() };
}

function scheduleProcess(reason) {
  if (!isResponsibleGM()) return;
  window.setTimeout(() => {
    add2eProcessPeriodicCharms({ reason })
      .catch(error => console.error(`${TAG}[SCHEDULED_PROCESS_FAILED]`, { reason, error }));
  }, 0);
}

export function add2eRegisterPeriodicCharmSaveHooks() {
  if (hooksRegistered) return false;
  hooksRegistered = true;

  Hooks.on("updateSetting", (setting) => {
    const key = String(setting?.key ?? setting?.id ?? "");
    if (key === "add2e.worldTimeTick") scheduleProcess("time-tick");
  });
  Hooks.once("ready", () => scheduleProcess("ready-scan"));

  game.add2e = game.add2e ?? {};
  game.add2e.charmPeriodicSaves = {
    version: ADD2E_CHARM_PERIODIC_SAVE_VERSION,
    processAll: add2eProcessPeriodicCharms,
    processActor: add2eProcessPeriodicCharmForActor
  };
  globalThis.ADD2E_CHARM_PERIODIC_SAVE_VERSION = ADD2E_CHARM_PERIODIC_SAVE_VERSION;
  globalThis.add2eProcessPeriodicCharms = add2eProcessPeriodicCharms;
  globalThis.add2eProcessPeriodicCharmForActor = add2eProcessPeriodicCharmForActor;

  console.log(`${TAG}[REGISTERED]`, { version: ADD2E_CHARM_PERIODIC_SAVE_VERSION, hooks: ["updateSetting:add2e.worldTimeTick", "ready"] });
  return true;
}

add2eRegisterPeriodicCharmSaveHooks();
