// ============================================================================
// ADD2E — Mécaniques réutilisables d'attaques de capacité.
// Profils : contact sans dégâts ordinaires, fenêtre temporaire,
// résolution immédiate ou effet latent. Compatible Foundry V13/V14/V15.
// ============================================================================

import {
  add2eMeasureTokenGridDistance,
  add2eGetCombatStatProfile,
  add2eGetAttackAbilityModifier
} from "../add2e-attack/03-attack-rules.mjs";
import { add2eAttackComputeActiveAttackModifiers } from "../add2e-attack/04e-attack-roll-modifiers.mjs";
import { add2eAttackMeasureContactAndDistance, add2eAttackValidateRange } from "../add2e-attack/04g-attack-roll-range.mjs";
import { classItems, classProgression } from "./17b-multiclass-core.mjs";

export const ADD2E_CAPABILITY_SPECIAL_ATTACK_VERSION = "2026-08-11-canonical-combat-owners-v4";

const SYSTEM_ID = "add2e";
const GM_OPERATION = "ADD2E_GM_OPERATION";
const SPECIAL_ATTACK_FLAG = "capabilitySpecialAttack";
const WINDOW_FLAG = "capabilitySpecialAttackWindow";
const DEFERRED_FLAG = "capabilityDeferredAction";
const TAG = "[ADD2E][CAPABILITY_SPECIAL_ATTACK]";
const MONSTER_TERMINAL_HP_ACTOR_TYPES = new Set(["monster", "pnj"]);

function diag(step, data = {}) {
  try { console.info(`${TAG}[${step}]`, { version: ADD2E_CAPABILITY_SPECIAL_ATTACK_VERSION, ...data }); }
  catch (_error) {}
}

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function clone(value) {
  try { return foundry.utils.deepClone(value); }
  catch (_error) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_jsonError) { return value; }
  }
}

function number(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function array(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(array);
  if (value instanceof Set) return [...value];
  if (typeof value?.values === "function" && typeof value !== "string") return [...value.values()];
  return [value];
}

function currentTick() {
  const engine = game?.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const tick = typeof engine?.currentTick === "function" ? Number(engine.currentTick()) : NaN;
  return Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : null;
}

function hitPointEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (
    !engine
    || typeof engine.readHitPoints !== "function"
    || typeof engine.readMaximumHitPoints !== "function"
    || typeof engine.applyHitPointDamage !== "function"
  ) {
    throw new Error("Le propriétaire canonique ADD2E des points de vie est indisponible.");
  }
  return engine;
}

function actorHp(actor) {
  const engine = hitPointEngine();
  return {
    current: engine.readHitPoints(actor),
    maximum: engine.readMaximumHitPoints(actor)
  };
}

function monsterHitDice(actor) {
  const raw = String(actor?.system?.hitDice ?? "").trim();
  const match = raw.match(/^(\d+(?:[.,]\d+)?)/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function characterClassLevel(actor) {
  const levels = classItems(actor).map(item => {
    const progression = classProgression(item);
    return progression.hasLevel ? progression.level : null;
  }).filter(level => Number.isFinite(level) && level >= 1);
  return levels.length ? Math.max(...levels) : null;
}

function actorHitDice(actor) {
  const type = String(actor?.type ?? "").trim().toLowerCase();
  if (type === "monster") return monsterHitDice(actor);
  if (type === "pnj") {
    const level = Number(actor?.system?.niveau);
    return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
  }
  if (type === "personnage") return characterClassLevel(actor);
  return null;
}

function actorTags(actor) {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.getContextTags !== "function") {
    throw new Error("Le propriétaire canonique ADD2E des tags de contexte est indisponible.");
  }
  return new Set((engine.getContextTags(actor) ?? []).map(norm).filter(Boolean));
}

function profileFor(item) {
  const profile = item?.flags?.[SYSTEM_ID]?.[SPECIAL_ATTACK_FLAG] ?? null;
  if (!profile || typeof profile !== "object") return null;
  const kind = norm(profile.kind);
  if (!["contact_deferred", "contact_immediate", "contact_special"].includes(kind)) return null;
  if (!String(profile.id ?? "").trim()) return null;
  return clone(profile);
}

function sourceLevel(_actor, _item, profile) {
  const configured = Number(profile?.sourceLevel);
  return Number.isFinite(configured) && configured >= 1 ? Math.floor(configured) : null;
}

function formatTicks(rounds) {
  const value = Math.max(0, Math.ceil(Number(rounds) || 0));
  if (!value) return "disponible";
  const days = Math.floor(value / 1440);
  const hours = Math.floor((value % 1440) / 60);
  const rest = value % 60;
  const parts = [];
  if (days) parts.push(`${days} jour(s)`);
  if (hours) parts.push(`${hours} heure(s)`);
  if (rest || !parts.length) parts.push(`${rest} round(s)`);
  return parts.join(" et ");
}

function sourceToken(actor) {
  const controlled = canvas?.tokens?.controlled ?? [];
  return controlled.find(token => token?.actor?.id === actor?.id || token?.document?.actorId === actor?.id)
    ?? actor?.getActiveTokens?.()?.[0]
    ?? actor?.token?.object
    ?? actor?.token
    ?? null;
}

function targetActor(token) {
  return token?.actor
    ?? token?.document?.actor
    ?? (token?.document?.actorId ? game.actors?.get?.(token.document.actorId) : null)
    ?? null;
}

function resolveThac0(actor) {
  const type = String(actor?.type ?? "").trim().toLowerCase();
  if (type !== "personnage") {
    const direct = Number(actor?.system?.thac0);
    return Number.isFinite(direct) ? direct : null;
  }

  const classes = classItems(actor);
  if (!classes.length) return null;
  const values = classes.map(classItem => {
    const progressionState = classProgression(classItem);
    if (!progressionState.hasLevel) {
      throw new Error(`Niveau canonique absent sur l’Item classe « ${classItem?.name ?? classItem?.id ?? "inconnu"} ».`);
    }
    const rows = Array.isArray(classItem?.system?.progression) ? classItem.system.progression : [];
    const row = rows.find(entry => Number(entry?.niveau) === progressionState.level) ?? null;
    if (!row) {
      throw new Error(`Progression THAC0 absente pour « ${classItem?.name ?? "classe"} » au niveau ${progressionState.level}.`);
    }
    const value = Number(row.thac0);
    if (!Number.isFinite(value)) {
      throw new Error(`THAC0 canonique invalide pour « ${classItem?.name ?? "classe"} » au niveau ${progressionState.level}.`);
    }
    return value;
  });
  return Math.min(...values);
}

function resolveArmorClass(actor) {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.resolveArmorClass !== "function") {
    throw new Error("Le propriétaire canonique ADD2E de la classe d’armure est indisponible.");
  }
  const resolution = engine.resolveArmorClass(actor, {
    source: "capability-special-attack",
    consumer: "capability-special-attacks"
  });
  const value = Number(resolution?.caTotal);
  if (!Number.isFinite(value)) {
    throw new Error(`Classe d’armure canonique invalide pour « ${actor?.name ?? actor?.id ?? "acteur"} ».`);
  }
  return value;
}

function validateTarget(profile, sourceActor, target) {
  const restrictions = profile?.targetRestrictions ?? {};
  const tags = actorTags(target);
  const excludedTags = Array.isArray(restrictions.excludedTags)
    ? restrictions.excludedTags.map(norm).filter(Boolean)
    : [];
  const blocked = excludedTags.find(tag => tags.has(tag));
  if (blocked) {
    return {
      ok: false,
      code: "excluded-tag",
      reason: "Cette cible ne peut pas être affectée par cette capacité.",
      detail: blocked
    };
  }

  const level = sourceLevel(sourceActor, null, profile);
  if (!Number.isFinite(level)) {
    return {
      ok: false,
      code: "missing-source-level",
      reason: "Le niveau source canonique de la capacité est absent."
    };
  }

  const hitDiceRule = restrictions.maxHitDice ?? null;
  if (hitDiceRule) {
    const multiplier = Math.max(0, Number(hitDiceRule.multiplier ?? 1) || 0);
    const maximum = Number.isFinite(Number(hitDiceRule.maximum))
      ? Number(hitDiceRule.maximum)
      : level * multiplier;
    const targetDice = actorHitDice(target);
    if (!Number.isFinite(targetDice)) {
      return {
        ok: false,
        code: "missing-hit-dice",
        reason: "La cible doit être validée par le MJ.",
        maximum
      };
    }
    if (targetDice > maximum) {
      return {
        ok: false,
        code: "hit-dice",
        reason: "Cette cible dépasse les limites de la capacité.",
        targetDice,
        maximum
      };
    }
  }

  const hpRule = restrictions.maxHitPoints ?? null;
  if (hpRule) {
    const multiplier = Math.max(0, Number(hpRule.multiplier ?? 1) || 0);
    const sourceMaximum = actorHp(sourceActor).maximum;
    const targetMaximum = actorHp(target).maximum;
    const maximum = Number.isFinite(Number(hpRule.maximum))
      ? Number(hpRule.maximum)
      : Number(sourceMaximum) * multiplier;
    if (!Number.isFinite(sourceMaximum) || !Number.isFinite(targetMaximum)) {
      return {
        ok: false,
        code: "missing-hit-points",
        reason: "La cible doit être validée par le MJ.",
        maximum
      };
    }
    if (targetMaximum > maximum) {
      return {
        ok: false,
        code: "hit-points",
        reason: "Cette cible dépasse les limites de la capacité.",
        targetMaximum,
        maximum
      };
    }
  }

  return { ok: true, code: "ok" };
}

function actionForProfile(profile) {
  return profile?.immediateAction
    ?? profile?.action
    ?? profile?.resolution?.action
    ?? profile?.deferredEffect?.command?.action
    ?? null;
}

function profileResolvesImmediately(profile) {
  const values = [profile?.kind, profile?.mode, profile?.resolution?.mode, profile?.resolutionMode];
  return values.map(norm).some(value => [
    "contact_immediate",
    "immediate",
    "immediat",
    "apply_immediate",
    "resolution_immediate"
  ].includes(value));
}

function targetUsesMonsterTerminalHp(actor) {
  return MONSTER_TERMINAL_HP_ACTOR_TYPES.has(String(actor?.type ?? "").trim().toLowerCase());
}

async function emitGmOperation(operation, payload) {
  if (game.user?.isGM) {
    const actor = payload?.actorUuid
      ? await fromUuid(payload.actorUuid).catch(() => null)
      : game.actors?.get?.(payload?.actorId) ?? null;
    if (operation === "createActiveEffect" && actor && payload.effectData) {
      return actor.createEmbeddedDocuments("ActiveEffect", [clone(payload.effectData)], {
        add2eInternal: true,
        add2eReason: "capability-special-attack"
      });
    }
    if (operation === "deleteActiveEffects" && actor && Array.isArray(payload.effectIds)) {
      return actor.deleteEmbeddedDocuments("ActiveEffect", payload.effectIds.filter(Boolean), {
        add2eInternal: true,
        add2eReason: "capability-deferred-command"
      });
    }
    if (operation === "applyDamage" && actor) {
      const amount = Math.abs(Number(payload.montant) || 0);
      if (!amount) return false;
      return hitPointEngine().applyHitPointDamage(actor, amount, {
        reason: "capability-special-attack",
        updateOptions: {
          add2eInternal: true,
          add2eDetails: payload.details
        }
      });
    }
  }
  game.socket?.emit?.(`system.${SYSTEM_ID}`, { type: GM_OPERATION, operation, payload });
  return true;
}

async function applyHitPointAction({
  sourceActor,
  target,
  profile,
  action,
  detailSource = "capability-special-attack"
} = {}) {
  if (norm(action?.type) !== "set_hit_points") return { ok: false, reason: "unsupported-action" };
  const targetValue = targetUsesMonsterTerminalHp(target)
    ? Number(action?.monsterValue ?? 0)
    : Number(action?.characterValue ?? -11);
  const hp = actorHp(target).current;
  if (!Number.isFinite(hp)) return { ok: false, reason: "missing-hit-points" };
  const amount = Math.max(0, hp - targetValue);
  if (amount > 0) {
    await emitGmOperation("applyDamage", {
      actorUuid: target.uuid ?? null,
      actorId: target.id ?? null,
      montant: amount,
      details: {
        capabilitySpecialAttack: profile?.id ?? null,
        sourceActorUuid: sourceActor?.uuid ?? null,
        source: detailSource,
        targetValue
      }
    });
  }
  return { ok: true, hp, targetValue, amount };
}

function buildDeferredEffect({ sourceActor, target, item, profile, tick }) {
  const deferred = profile?.deferredEffect ?? {};
  const level = sourceLevel(sourceActor, item, profile);
  if (!Number.isFinite(level)) throw new Error("Le niveau source canonique de la capacité est absent.");
  const roundsPerLevel = Math.max(1, Number(deferred?.duration?.roundsPerSourceLevel ?? 1) || 1);
  const rounds = Math.max(1, Math.floor(level * roundsPerLevel));
  const expiresAtTick = tick + rounds;
  const deferredAction = {
    version: ADD2E_CAPABILITY_SPECIAL_ATTACK_VERSION,
    profileId: profile.id,
    sourceActorId: sourceActor.id ?? null,
    sourceActorUuid: sourceActor.uuid ?? null,
    sourceItemId: item.id ?? null,
    sourceItemUuid: item.uuid ?? null,
    sourceLevel: level,
    targetActorId: target.id ?? null,
    targetActorUuid: target.uuid ?? null,
    expiresAtTick,
    command: clone(deferred.command ?? {})
  };
  const name = String(deferred.name ?? profile.label ?? "Effet latent");
  const img = String(deferred.img ?? item.img ?? "icons/svg/aura.svg");
  const tags = Array.isArray(deferred.tags) ? deferred.tags.map(norm).filter(Boolean) : [];
  const endMessage = String(deferred.endMessage ?? "L’effet latent sur {actor} s’éteint sans se déclencher.");
  const engine = game?.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;

  if (typeof engine?.effectData === "function") {
    return engine.effectData({
      name,
      img,
      origin: item.uuid ?? null,
      rounds,
      unit: "round",
      description: String(deferred.description ?? ""),
      tags: ["capability:deferred-action", `capability-profile:${norm(profile.id)}`, ...tags],
      changes: [],
      source: "capability-special-attack",
      caster: sourceActor,
      sourceItem: item,
      endMessage,
      extraFlags: {
        [DEFERRED_FLAG]: deferredAction,
        specialAttackProfileId: profile.id
      }
    });
  }

  return {
    name,
    img,
    origin: item.uuid ?? null,
    disabled: false,
    transfer: false,
    changes: [],
    duration: {
      rounds,
      startRound: game.combat?.round ?? null,
      startTurn: game.combat?.turn ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    },
    flags: {
      [SYSTEM_ID]: {
        tags: ["capability:deferred-action", `capability-profile:${norm(profile.id)}`, ...tags],
        timeEngine: { managed: true, totalRounds: rounds, startTick: tick, createdAtTick: tick },
        roundEngine: { managed: true, totalRounds: rounds, startTick: tick, endMessage },
        endMessage,
        [DEFERRED_FLAG]: deferredAction,
        specialAttackProfileId: profile.id
      }
    }
  };
}

async function createChat({
  sourceActor,
  target,
  profile,
  state,
  detail = "",
  d20 = null,
  total = null,
  threshold = null
}) {
  const build = globalThis.add2eBuildChatCard;
  const create = globalThis.add2eCreateChatCard;
  if (typeof build !== "function" || typeof create !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
  }

  const label = String(profile?.label ?? "Capacité");
  const text = ({
    applied: `Le contact de <b>${esc(sourceActor?.name)}</b> réussit : <b>${esc(label)}</b> marque ${esc(target?.name)}.`,
    immediate: `Le contact de <b>${esc(sourceActor?.name)}</b> réussit : <b>${esc(label)}</b> prend effet sur ${esc(target?.name)}.`,
    triggered: `<b>${esc(sourceActor?.name)}</b> déclenche <b>${esc(label)}</b> sur ${esc(target?.name)}.`,
    miss: `<b>${esc(sourceActor?.name)}</b> ne parvient pas à établir le contact requis pour <b>${esc(label)}</b>.`,
    invalid: `${esc(target?.name)} ne peut pas être affecté par <b>${esc(label)}</b>.`
  })[state] ?? `<b>${esc(label)}</b> est résolue.`;
  const rollText = Number.isFinite(Number(d20))
    ? `<div><b>Jet :</b> d20 ${esc(d20)}</div>`
    : "";
  const publicDetail = state === "invalid" ? "" : String(detail ?? "").trim();
  const variant = ["applied", "triggered", "immediate"].includes(state)
    ? "success"
    : state === "miss"
      ? "failure"
      : "ability";

  const options = {
    actor: sourceActor,
    title: label,
    icon: "fas fa-hand",
    variant,
    source: {
      name: sourceActor?.name ?? "Capacité",
      img: profile?.img ?? "icons/svg/aura.svg",
      type: "Capacité de classe"
    },
    trustedBodyHtml: `${text}${rollText}${publicDetail ? `<div>${esc(publicDetail)}</div>` : ""}`,
    chatData: {
      flags: {
        [SYSTEM_ID]: {
          capabilitySpecialAttack: true,
          profileId: profile?.id ?? null,
          state,
          sourceActorId: sourceActor?.id ?? null,
          targetActorId: target?.id ?? null,
          roll: { d20, total, threshold }
        }
      }
    }
  };

  build(options);
  return create(options);
}

function capabilityWindow(actor, itemId) {
  return Array.from(actor?.effects ?? [])
    .find(effect => effect?.flags?.[SYSTEM_ID]?.[WINDOW_FLAG]?.itemId === itemId)
    ?? null;
}

function windowExpiresAt(effect) {
  return Number(effect?.flags?.[SYSTEM_ID]?.[WINDOW_FLAG]?.expiresAtTick ?? 0) || 0;
}

function profileTriggers(profile) {
  const values = [
    profile?.trigger,
    profile?.triggers,
    profile?.activation?.trigger,
    profile?.activation?.triggers,
    profile?.deferredEffect?.trigger,
    profile?.deferredEffect?.triggers
  ];
  return new Set(array(values).map(norm).filter(Boolean));
}

function profileMatchesTrigger(profile, trigger = null) {
  const wanted = norm(trigger);
  if (!wanted) return true;
  const triggers = profileTriggers(profile);
  if (!triggers.size) return true;
  return triggers.has(wanted)
    || triggers.has("contact")
    || triggers.has("contact_reussi")
    || triggers.has("after_contact_hit");
}

function findPreparedContacts({ sourceActor, profileId = null, trigger = null } = {}) {
  if (!sourceActor) return [];
  const tick = currentTick();
  const wanted = norm(profileId);
  const entries = [];
  for (const item of sourceActor.items ?? []) {
    const profile = profileFor(item);
    if (!profile) continue;
    if (wanted && norm(profile.id) !== wanted) continue;
    if (!profileMatchesTrigger(profile, trigger)) continue;
    const window = capabilityWindow(sourceActor, item.id);
    const expiresAtTick = windowExpiresAt(window);
    if (!window || (tick !== null && expiresAtTick && tick >= expiresAtTick)) continue;
    entries.push({ sourceActor, item, profile, window, expiresAtTick });
  }
  diag("FIND_PREPARED_CONTACTS", {
    source: sourceActor?.name,
    profileId,
    trigger,
    count: entries.length
  });
  return entries;
}

async function removeWindowAndItem(actor, itemId) {
  const effect = capabilityWindow(actor, itemId);
  diag("REMOVE_WINDOW_AND_ITEM", {
    actor: actor?.name,
    itemId,
    effect: effect?.name,
    effectId: effect?.id,
    hasItem: !!actor?.items?.get?.(itemId)
  });
  if (effect?.id) {
    try {
      await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id], {
        add2eInternal: true,
        add2eReason: "capability-special-attack-consumed"
      });
    } catch (error) {
      const message = String(error?.message ?? error ?? "");
      if (!/does not exist|introuvable/i.test(message)) {
        console.warn(`${TAG}[DELETE_WINDOW_FAILED]`, {
          actor: actor?.name,
          itemId,
          effectId: effect.id,
          error
        });
      }
    }
  }
  if (itemId && actor?.items?.get?.(itemId)) {
    try {
      await actor.deleteEmbeddedDocuments("Item", [itemId], {
        add2eInternal: true,
        add2eReason: "capability-special-attack-consumed"
      });
    } catch (error) {
      const message = String(error?.message ?? error ?? "");
      if (!/does not exist|introuvable/i.test(message)) {
        console.warn(`${TAG}[DELETE_ITEM_FAILED]`, { actor: actor?.name, itemId, error });
      }
    }
  }
}

async function prepareWindow({ actor, item, profile, rounds }) {
  const tick = currentTick();
  if (!actor || !item || !profile || tick === null) {
    diag("PREPARE_WINDOW_ABORT", {
      actor: actor?.name,
      item: item?.name,
      profileId: profile?.id,
      tick
    });
    return null;
  }
  const totalRounds = Math.max(1, Math.floor(Number(rounds) || 0));
  const engine = game?.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const extraFlags = {
    temporaryItemId: item.id,
    [WINDOW_FLAG]: {
      version: ADD2E_CAPABILITY_SPECIAL_ATTACK_VERSION,
      profileId: profile.id,
      itemId: item.id,
      itemUuid: item.uuid ?? null,
      sourceActorId: actor.id ?? null,
      sourceActorUuid: actor.uuid ?? null,
      startTick: tick,
      expiresAtTick: tick + totalRounds
    }
  };

  const data = typeof engine?.effectData === "function"
    ? engine.effectData({
      name: String(profile.window?.name ?? `${profile.label} — préparation`),
      img: String(profile.img ?? item.img ?? "icons/svg/aura.svg"),
      origin: item.uuid ?? null,
      rounds: totalRounds,
      unit: "round",
      description: String(profile.window?.description ?? ""),
      tags: ["capability:special-attack-window", `capability-profile:${norm(profile.id)}`],
      changes: [],
      source: "capability-special-attack-window",
      caster: actor,
      sourceItem: item,
      endMessage: String(profile.window?.endMessage ?? "La préparation de {actor} expire sans effet."),
      extraFlags
    })
    : {
      name: String(profile.window?.name ?? `${profile.label} — préparation`),
      img: String(profile.img ?? item.img ?? "icons/svg/aura.svg"),
      origin: item.uuid ?? null,
      disabled: false,
      transfer: false,
      changes: [],
      duration: {
        rounds: totalRounds,
        startRound: game.combat?.round ?? null,
        startTurn: game.combat?.turn ?? null,
        startTime: game.time?.worldTime ?? null,
        combat: game.combat?.id ?? null
      },
      flags: {
        [SYSTEM_ID]: {
          tags: ["capability:special-attack-window", `capability-profile:${norm(profile.id)}`, ...[]],
          timeEngine: { managed: true, totalRounds, startTick: tick },
          roundEngine: {
            managed: true,
            totalRounds,
            startTick: tick,
            endMessage: String(profile.window?.endMessage ?? "La préparation de {actor} expire sans effet.")
          },
          ...extraFlags
        }
      }
    };

  const created = await actor.createEmbeddedDocuments("ActiveEffect", [data], {
    add2eInternal: true,
    add2eReason: "capability-special-attack-window"
  });
  const window = created?.[0] ?? null;
  diag("PREPARE_WINDOW_DONE", {
    actor: actor?.name,
    item: item?.name,
    itemId: item?.id,
    profileId: profile?.id,
    window: window?.name,
    windowId: window?.id,
    rounds: totalRounds,
    expiresAtTick: tick + totalRounds
  });
  return window;
}

async function resolveDeferredContactFromAttack({
  sourceActor,
  targetActor: target,
  item,
  profile: profileFromCall = null,
  attackContext = {}
} = {}) {
  const profile = profileFromCall ?? profileFor(item);
  const tick = currentTick();
  diag("RESOLVE_FROM_ATTACK_ENTER", {
    source: sourceActor?.name,
    target: target?.name,
    item: item?.name,
    itemId: item?.id,
    profileId: profile?.id,
    tick,
    attackContext
  });
  if (!sourceActor || !target || !item || !profile || tick === null) {
    return { ok: false, reason: "missing-context" };
  }
  const window = capabilityWindow(sourceActor, item.id);
  const expiresAtTick = windowExpiresAt(window);
  if (!window || (expiresAtTick && tick >= expiresAtTick)) {
    await removeWindowAndItem(sourceActor, item.id);
    diag("RESOLVE_FROM_ATTACK_EXPIRED", {
      source: sourceActor?.name,
      itemId: item?.id,
      expiresAtTick,
      tick
    });
    return { ok: false, reason: "expired-window" };
  }
  const eligibility = validateTarget(profile, sourceActor, target);
  const d20 = Number(attackContext.d20);
  const total = Number(attackContext.total ?? attackContext.totalAuToucher);
  const threshold = Number(attackContext.threshold ?? attackContext.seuilFinalD20);
  const chatNumbers = {
    d20: Number.isFinite(d20) ? d20 : null,
    total: Number.isFinite(total) ? total : null,
    threshold: Number.isFinite(threshold) ? threshold : null
  };
  if (!eligibility.ok) {
    await createChat({ sourceActor, target, profile, state: "invalid", ...chatNumbers });
    diag("RESOLVE_FROM_ATTACK_INVALID_TARGET", {
      source: sourceActor?.name,
      target: target?.name,
      eligibility
    });
    return { ok: true, applied: false, consumed: false, eligibility };
  }

  if (profileResolvesImmediately(profile)) {
    const action = actionForProfile(profile);
    const applied = await applyHitPointAction({
      sourceActor,
      target,
      profile,
      action,
      detailSource: "capability-contact-immediate"
    });
    if (!applied.ok) {
      ui.notifications?.error?.("Capacité : la résolution est impossible. Préviens le MJ.");
      diag("RESOLVE_FROM_ATTACK_IMMEDIATE_FAILED", {
        source: sourceActor?.name,
        target: target?.name,
        action,
        applied
      });
      return { ok: false, reason: applied.reason ?? "immediate-failed" };
    }
    await removeWindowAndItem(sourceActor, item.id);
    await createChat({
      sourceActor,
      target,
      profile,
      state: "immediate",
      ...chatNumbers,
      detail: String(action?.message ?? "La capacité prend effet.")
    });
    diag("RESOLVE_FROM_ATTACK_IMMEDIATE_APPLIED", {
      source: sourceActor?.name,
      target: target?.name,
      itemId: item?.id,
      profileId: profile?.id,
      ...applied
    });
    return {
      ok: true,
      hit: true,
      applied: true,
      immediate: true,
      consumed: true,
      item,
      profile,
      target
    };
  }

  const effectData = buildDeferredEffect({ sourceActor, target, item, profile, tick });
  await emitGmOperation("createActiveEffect", {
    actorUuid: target.uuid ?? null,
    actorId: target.id ?? null,
    effectData
  });
  await removeWindowAndItem(sourceActor, item.id);
  const effectTick = Number(effectData?.flags?.[SYSTEM_ID]?.[DEFERRED_FLAG]?.expiresAtTick ?? tick);
  await createChat({
    sourceActor,
    target,
    profile,
    state: "applied",
    ...chatNumbers,
    detail: `L’effet reste latent pendant ${formatTicks(Math.max(0, effectTick - tick))}.`
  });
  diag("RESOLVE_FROM_ATTACK_APPLIED", {
    source: sourceActor?.name,
    target: target?.name,
    itemId: item?.id,
    profileId: profile?.id,
    expiresAtTick: effectTick
  });
  return {
    ok: true,
    hit: true,
    applied: true,
    consumed: true,
    item,
    profile,
    target
  };
}

async function consumePreparedContactFromAttack({
  sourceActor,
  targetActor,
  profileId = null,
  trigger = null,
  attackContext = {}
} = {}) {
  const prepared = findPreparedContacts({ sourceActor, profileId, trigger });
  if (!prepared.length) {
    diag("CONSUME_PREPARED_NONE", {
      source: sourceActor?.name,
      target: targetActor?.name,
      profileId,
      trigger
    });
    return { ok: false, reason: "no-prepared-contact" };
  }
  const entry = prepared[0];
  diag("CONSUME_PREPARED", {
    source: sourceActor?.name,
    target: targetActor?.name,
    profileId: entry.profile?.id,
    item: entry.item?.name,
    itemId: entry.item?.id,
    trigger
  });
  return resolveDeferredContactFromAttack({
    sourceActor,
    targetActor,
    item: entry.item,
    profile: entry.profile,
    attackContext
  });
}

function contactDialogHtml({ sourceActor, target, profile } = {}) {
  const label = String(profile?.label ?? "Capacité");
  return `
    <form class="add2e-capability-special-attack-form">
      <p><b>${esc(sourceActor?.name)}</b> tente de porter <b>${esc(label)}</b> sur <b>${esc(target?.name)}</b>.</p>
      <p>Cette capacité exige un contact et ne lance aucun dégât ordinaire.</p>
      <div class="form-group">
        <label>Modificateur</label>
        <input type="number" name="modifier" value="0" step="1">
      </div>
    </form>`;
}

async function resolveSpecialAttack({ actor, arme, actorId, itemId }) {
  const sourceActor = actor ?? (actorId ? game.actors?.get?.(actorId) : null);
  const item = arme ?? (itemId && sourceActor ? sourceActor.items?.get?.(itemId) : null);
  const profile = profileFor(item);
  if (!sourceActor || !item || !profile) return false;
  const tick = currentTick();
  if (tick === null) {
    return ui.notifications?.error?.("Capacité : le suivi des rounds n’est pas disponible.");
  }
  const window = capabilityWindow(sourceActor, item.id);
  const expiresAtTick = windowExpiresAt(window);
  if (!window || (expiresAtTick && tick >= expiresAtTick)) {
    await removeWindowAndItem(sourceActor, item.id);
    ui.notifications?.warn?.("Cette capacité n’est plus préparée.");
    return false;
  }
  const targetToken = Array.from(game.user?.targets ?? [])[0] ?? null;
  const target = targetActor(targetToken);
  if (!targetToken || !target) {
    return ui.notifications?.warn?.("Sélectionne une cible pour cette capacité.");
  }
  const source = sourceToken(sourceActor);
  if (!source) return ui.notifications?.warn?.("L’acteur doit être présent sur la scène.");
  const distance = add2eAttackMeasureContactAndDistance({
    srcToken: source,
    cibleToken: targetToken,
    measureDistance: add2eMeasureTokenGridDistance
  });
  const range = add2eAttackValidateRange({
    arme: item,
    distanceCible: distance.distanceCible,
    auContact: distance.auContact
  });
  if (!range.ok || !distance.auContact) {
    ui.notifications?.warn?.("La cible doit être au contact.");
    return false;
  }

  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  const selection = await globalThis.add2eDialogWait({
    add2eTheme: "danger",
    add2ePrimaryAction: "roll",
    add2eClasses: ["add2e-capability-dialog", "add2e-special-attack-dialog"],
    window: { title: String(profile.dialogTitle ?? profile.label ?? "Capacité") },
    position: { width: 430 },
    content: contactDialogHtml({ sourceActor, target, profile }),
    buttons: [
      {
        action: "roll",
        label: "Tenter le contact",
        icon: "<i class='fas fa-hand'></i>",
        default: true,
        callback: (_event, button) => ({
          modifier: Number(button.form?.elements?.modifier?.value ?? 0) || 0
        })
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "<i class='fas fa-times'></i>",
        callback: () => null
      }
    ],
    close: () => null
  });
  if (!selection) return false;

  const level = sourceLevel(sourceActor, item, profile);
  const thac0 = resolveThac0(sourceActor);
  const armorClass = resolveArmorClass(target);
  if (!Number.isFinite(level) || !Number.isFinite(thac0) || !Number.isFinite(armorClass)) {
    ui.notifications?.error?.("Capacité : les données de combat nécessaires sont introuvables.");
    return false;
  }
  const combatProfile = add2eGetCombatStatProfile(item);
  const attackOptions = profile.attack ?? {};
  let abilityModifier = 0;
  if (attackOptions.abilityModifier !== false && combatProfile?.toucherCarac) {
    abilityModifier = Number(
      add2eGetAttackAbilityModifier(sourceActor, combatProfile.toucherCarac, "toucher")
    ) || 0;
  }
  let magicalBonus = Number(item?.system?.bonus_hit ?? item?.system?.bonus_toucher ?? 0) || 0;
  if (
    attackOptions.magicWeaponBonus !== false
    && typeof globalThis.Add2eEffectsEngine?.getMagicWeaponBonus === "function"
  ) {
    magicalBonus = Number(globalThis.Add2eEffectsEngine.getMagicWeaponBonus(item, "hit")) || 0;
  }
  const active = add2eAttackComputeActiveAttackModifiers({
    actor: sourceActor,
    cible: target,
    combatProfile
  });
  const effectBonus = attackOptions.effectModifiers === false
    ? 0
    : Number(active?.bonusToucheEffets) || 0;
  const racialBonus = attackOptions.racialVs === false
    ? 0
    : Number(active?.bonusRacialVs) || 0;
  const totalBonus = abilityModifier
    + magicalBonus
    + effectBonus
    + racialBonus
    + (Number(selection.modifier) || 0);
  const threshold = thac0 - armorClass - totalBonus;
  const roll = await (new Roll("1d20")).evaluate();
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  const d20 = Number(roll.total) || 0;
  const total = d20 + totalBonus;
  const hit = d20 === 20 || (d20 !== 1 && d20 >= threshold);
  if (!hit) {
    await createChat({ sourceActor, target, profile, state: "miss", d20, total, threshold });
    return { ok: true, hit: false, consumed: false };
  }
  return resolveDeferredContactFromAttack({
    sourceActor,
    targetActor: target,
    item,
    profile,
    attackContext: { d20, total, threshold }
  });
}

function findDeferredActions({ sourceActor, profileId = null }) {
  const tick = currentTick();
  const sourceUuid = sourceActor?.uuid ?? null;
  const sourceId = sourceActor?.id ?? null;
  const wanted = norm(profileId);
  const result = [];
  for (const target of game.actors?.contents ?? []) {
    for (const effect of target?.effects ?? []) {
      const data = effect?.flags?.[SYSTEM_ID]?.[DEFERRED_FLAG] ?? null;
      if (!data || typeof data !== "object") continue;
      if (sourceUuid ? data.sourceActorUuid !== sourceUuid : data.sourceActorId !== sourceId) continue;
      if (wanted && norm(data.profileId) !== wanted) continue;
      if (
        tick !== null
        && Number(data.expiresAtTick ?? 0) > 0
        && tick >= Number(data.expiresAtTick)
      ) continue;
      result.push({ actor: target, effect, data });
    }
  }
  diag("FIND_DEFERRED_ACTIONS", {
    source: sourceActor?.name,
    sourceId,
    sourceUuid,
    profileId,
    tick,
    count: result.length,
    result: result.map(entry => ({
      target: entry.actor?.name,
      effect: entry.effect?.name,
      effectId: entry.effect?.id,
      expiresAtTick: entry.data?.expiresAtTick
    }))
  });
  return result;
}

async function triggerDeferredAction({ sourceActor, targetActor: targetFromCall, effect }) {
  const data = effect?.flags?.[SYSTEM_ID]?.[DEFERRED_FLAG] ?? null;
  const target = targetFromCall ?? effect?.parent ?? null;
  const tick = currentTick();
  diag("TRIGGER_ENTER", {
    source: sourceActor?.name,
    target: target?.name,
    effect: effect?.name,
    effectId: effect?.id,
    profileId: data?.profileId,
    tick
  });
  if (!sourceActor || !target || !effect || !data || tick === null) return false;
  if (Number(data.expiresAtTick ?? 0) > 0 && tick >= Number(data.expiresAtTick)) {
    ui.notifications?.warn?.("Cet effet a expiré.");
    diag("TRIGGER_EXPIRED", {
      source: sourceActor?.name,
      target: target?.name,
      effectId: effect?.id,
      expiresAtTick: data.expiresAtTick,
      tick
    });
    return false;
  }
  const command = data.command ?? {};
  const applied = await applyHitPointAction({
    sourceActor,
    target,
    profile: { id: data.profileId },
    action: command.action,
    detailSource: "capability-deferred-command"
  });
  if (!applied.ok) {
    ui.notifications?.error?.("Capacité : la résolution est impossible. Préviens le MJ.");
    diag("TRIGGER_FAILED", {
      source: sourceActor?.name,
      target: target?.name,
      effectId: effect?.id,
      applied
    });
    return false;
  }
  await emitGmOperation("deleteActiveEffects", {
    actorUuid: target.uuid ?? null,
    actorId: target.id ?? null,
    effectIds: [effect.id]
  });
  await createChat({
    sourceActor,
    target,
    profile: {
      id: data.profileId,
      label: command.label ?? effect.name,
      img: effect.img ?? sourceActor.img
    },
    state: "triggered",
    detail: String(command?.message ?? "La capacité prend effet.")
  });
  diag("TRIGGER_DONE", {
    source: sourceActor?.name,
    target: target?.name,
    effectId: effect?.id,
    ...applied
  });
  return true;
}

globalThis.add2eCapabilitySpecialAttack = {
  version: ADD2E_CAPABILITY_SPECIAL_ATTACK_VERSION,
  profileFor,
  currentTick,
  formatTicks,
  prepareWindow,
  resolveSpecialAttack,
  resolveDeferredContactFromAttack,
  consumePreparedContactFromAttack,
  findPreparedContacts,
  findDeferredActions,
  triggerDeferredAction,
  validateTarget
};

diag("SERVICE_READY", {
  nativeDispatchVersion: globalThis.ADD2E_ATTACK_ROLL_SPLIT_VERSION ?? null
});