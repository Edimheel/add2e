// ============================================================================
// ADD2E — Mécaniques réutilisables d'attaques de capacité.
// Profils : contact spécial sans dégâts ordinaires, fenêtre temporaire,
// effet différé et action ultérieure. Compatible Foundry V13/V14/V15.
// ============================================================================

import {
  add2eMeasureTokenGridDistance,
  add2eGetCombatStatProfile,
  add2eGetAttackAbilityModifier
} from "../add2e-attack/03-attack-rules.mjs";
import { add2eAttackComputeActiveAttackModifiers } from "../add2e-attack/04e-attack-roll-modifiers.mjs";
import { add2eAttackComputeCharacterDisplayedCA } from "../add2e-attack/04d-attack-roll-defense.mjs";
import { add2eAttackMeasureContactAndDistance, add2eAttackValidateRange } from "../add2e-attack/04g-attack-roll-range.mjs";

export const ADD2E_CAPABILITY_SPECIAL_ATTACK_VERSION = "2026-07-07-capability-special-attack-v2";

const SYSTEM_ID = "add2e";
const GM_OPERATION = "ADD2E_GM_OPERATION";
const SPECIAL_ATTACK_FLAG = "capabilitySpecialAttack";
const WINDOW_FLAG = "capabilitySpecialAttackWindow";
const DEFERRED_FLAG = "capabilityDeferredAction";
const TAG = "[ADD2E][CAPABILITY_SPECIAL_ATTACK]";

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

function chatStyleData() {
  if (CONST.CHAT_MESSAGE_STYLES) return { style: CONST.CHAT_MESSAGE_STYLES.OTHER };
  return { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
}

function currentTick() {
  const engine = game?.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const tick = typeof engine?.currentTick === "function" ? Number(engine.currentTick()) : NaN;
  return Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : null;
}

function number(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function actorHp(actor) {
  const system = actor?.system ?? {};
  const current = number(system.pdv, system.pv, system.hp?.value, system.attributes?.hp?.value);
  const maximum = number(
    system.points_de_coup,
    system.pv_max,
    system.points_de_vie,
    system.hp?.max,
    system.attributes?.hp?.max,
    // Les acteurs monstre historiques n'ont souvent que system.pdv.
    system.pdv,
    system.pv,
    system.hp?.value,
    system.attributes?.hp?.value
  );
  return { current: Number.isFinite(current) ? current : maximum, maximum };
}

function actorHitDice(actor) {
  const system = actor?.system ?? {};
  const candidates = [
    system.dv,
    system.hitDice,
    system.hit_dice,
    system.des_de_vie,
    system.niveau,
    system.level,
    system.details?.niveau,
    system.details?.level
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
    const match = String(candidate ?? "").match(/\d+(?:[.,]\d+)?/);
    if (match) return Number(match[0].replace(",", "."));
  }
  return null;
}

function actorTags(actor) {
  const values = [];
  const visit = value => {
    if (value === null || value === undefined || value === "") return;
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) {
        if (entry === true) values.push(key);
        else visit(entry);
      }
      return;
    }
    for (const entry of String(value).split(/[,;|\n]+/g)) {
      const key = norm(entry);
      if (key) values.push(key);
    }
  };

  const system = actor?.system ?? {};
  const flags = actor?.flags?.[SYSTEM_ID] ?? {};
  visit([
    system.tags,
    system.effectTags,
    system.effecttags,
    system.type,
    system.type_monstre,
    system.immunites,
    system.immunities,
    system.resistances,
    system.defenses,
    system.specialDefenses,
    system.special_defenses,
    flags.tags,
    flags.effectTags,
    flags.monsterCapabilities
  ]);
  for (const item of actor?.items ?? []) {
    visit([item?.system?.tags, item?.system?.effectTags, item?.flags?.[SYSTEM_ID]?.tags]);
  }
  return new Set(values);
}

function profileFor(item) {
  const profile = item?.flags?.[SYSTEM_ID]?.[SPECIAL_ATTACK_FLAG] ?? item?.system?.[SPECIAL_ATTACK_FLAG] ?? null;
  if (!profile || typeof profile !== "object") return null;
  if (norm(profile.kind) !== "contact_deferred") return null;
  if (!String(profile.id ?? "").trim()) return null;
  return clone(profile);
}

function sourceLevel(actor, item, profile) {
  const configured = number(profile?.sourceLevel, item?.flags?.[SYSTEM_ID]?.sourceLevel, item?.system?.sourceLevel);
  if (Number.isFinite(configured) && configured > 0) return Math.floor(configured);
  const system = actor?.system ?? {};
  return Math.max(1, Math.floor(number(system.niveau, system.level, 1) ?? 1));
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

function resolveThac0(actor, level) {
  const direct = number(actor?.system?.thac0);
  if (Number.isFinite(direct)) return direct;

  const classes = Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
  for (const classItem of classes) {
    const rows = Array.isArray(classItem?.system?.progression) ? classItem.system.progression : [];
    const row = rows.find(entry => Number(entry?.niveau ?? entry?.level) === level)
      ?? rows.slice().reverse().find(entry => Number(entry?.niveau ?? entry?.level ?? 0) <= level);
    const value = number(row?.thac0);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function resolveArmorClass(actor) {
  const system = actor?.system ?? {};
  if (actor?.type === "personnage") {
    try {
      if (typeof globalThis.Add2eEffectsEngine?.getMagicPassiveDefense === "function") {
        const passive = globalThis.Add2eEffectsEngine.getMagicPassiveDefense(actor, { source: "capability-special-attack" });
        const value = number(passive?.caTotal);
        if (Number.isFinite(value)) return value;
      }
      const displayed = add2eAttackComputeCharacterDisplayedCA(actor);
      const value = number(displayed?.caTotal);
      if (Number.isFinite(value)) return value;
    } catch (error) {
      console.warn(`${TAG}[ARMOR_CLASS]`, { actor: actor?.name, error });
    }
  }
  return number(
    system.armorClass,
    system.ca_total,
    system.ca,
    system.ac,
    system.ca_naturel,
    system.defense?.armorClass,
    system.defense?.ca,
    system.combat?.armorClass,
    system.combat?.ca
  );
}

function validateTarget(profile, sourceActor, target) {
  const restrictions = profile?.targetRestrictions ?? {};
  const targetName = target?.name ?? "la cible";
  const tags = actorTags(target);
  const excludedTags = Array.isArray(restrictions.excludedTags)
    ? restrictions.excludedTags.map(norm).filter(Boolean)
    : [];
  const blocked = excludedTags.find(tag => tags.has(tag));
  if (blocked) {
    return {
      ok: false,
      code: "excluded-tag",
      reason: `La cible ${targetName} possède une immunité incompatible (${blocked.replace(/_/g, " ")}).`
    };
  }

  const level = sourceLevel(sourceActor, null, profile);
  const hitDiceRule = restrictions.maxHitDice ?? null;
  if (hitDiceRule) {
    const multiplier = Math.max(0, Number(hitDiceRule.multiplier ?? 1) || 0);
    const maximum = Number.isFinite(Number(hitDiceRule.maximum)) ? Number(hitDiceRule.maximum) : level * multiplier;
    const targetDice = actorHitDice(target);
    if (!Number.isFinite(targetDice)) {
      return { ok: false, code: "missing-hit-dice", reason: `Les dés de vie de ${targetName} sont absents ; validation du MJ requise.` };
    }
    if (targetDice > maximum) {
      return { ok: false, code: "hit-dice", reason: `${targetName} possède ${targetDice} DV, au-delà de la limite de ${maximum} DV.` };
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
      return { ok: false, code: "missing-hit-points", reason: `Les PV maximum nécessaires à la restriction sont absents ; validation du MJ requise.` };
    }
    if (targetMaximum > maximum) {
      return { ok: false, code: "hit-points", reason: `${targetName} possède ${targetMaximum} PV maximum, au-delà de la limite de ${maximum}.` };
    }
  }

  return { ok: true, code: "ok" };
}

function buildDeferredEffect({ sourceActor, target, item, profile, tick }) {
  const deferred = profile?.deferredEffect ?? {};
  const level = sourceLevel(sourceActor, item, profile);
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
  const name = String(deferred.name ?? profile.label ?? "Effet différé");
  const img = String(deferred.img ?? item.img ?? "icons/svg/aura.svg");
  const tags = Array.isArray(deferred.tags) ? deferred.tags.map(norm).filter(Boolean) : [];
  const endMessage = String(deferred.endMessage ?? "L’effet différé sur {actor} prend fin sans être déclenché.");
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

async function emitGmOperation(operation, payload) {
  if (game.user?.isGM) {
    const actor = payload?.actorUuid ? await fromUuid(payload.actorUuid).catch(() => null) : game.actors?.get?.(payload?.actorId) ?? null;
    if (operation === "createActiveEffect" && actor && payload.effectData) {
      return actor.createEmbeddedDocuments("ActiveEffect", [clone(payload.effectData)], { add2eInternal: true, add2eReason: "capability-special-attack" });
    }
    if (operation === "deleteActiveEffects" && actor && Array.isArray(payload.effectIds)) {
      return actor.deleteEmbeddedDocuments("ActiveEffect", payload.effectIds.filter(Boolean), { add2eInternal: true, add2eReason: "capability-deferred-command" });
    }
    if (operation === "applyDamage" && actor) {
      const current = actorHp(actor).current;
      const amount = Math.abs(Number(payload.montant) || 0);
      if (!Number.isFinite(current) || !amount) return false;
      await actor.update({ "system.pdv": current - amount }, { add2eInternal: true, add2eReason: "capability-deferred-command" });
      await globalThis.add2eSyncActorVitalStatus?.(actor, { reason: "capability-deferred-command" });
      return true;
    }
  }

  game.socket?.emit?.(`system.${SYSTEM_ID}`, { type: GM_OPERATION, operation, payload });
  return true;
}

async function createChat({ sourceActor, target, profile, state, detail = "", d20 = null, total = null, threshold = null }) {
  const label = String(profile?.label ?? "Attaque spéciale");
  const color = (state === "applied" || state === "triggered") ? "#2f7a45" : state === "miss" ? "#9d3c2f" : "#8a631e";
  const text = ({
    applied: `Le contact de ${esc(sourceActor?.name)} réussit : <b>${esc(label)}</b> est appliqué à ${esc(target?.name)}.`,
    triggered: `${esc(sourceActor?.name)} prononce le mot de commande : l’effet <b>${esc(label)}</b> se déclenche sur ${esc(target?.name)}.`,
    miss: `${esc(sourceActor?.name)} ne parvient pas à établir le contact requis pour <b>${esc(label)}</b>.`,
    invalid: `Le contact ne peut pas produire l’effet <b>${esc(label)}</b> sur ${esc(target?.name)}.`
  })[state] ?? `${esc(label)} est résolu.`;
  const rollLine = Number.isFinite(Number(d20))
    ? `<div style="margin-top:5px;"><b>Jet de contact :</b> d20 ${esc(d20)}${Number.isFinite(Number(total)) ? ` = ${esc(total)}` : ""}${Number.isFinite(Number(threshold)) ? ` (seuil ${esc(threshold)})` : ""}</div>`
    : "";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: sourceActor }),
    content: `<div class="add2e-chat-card add2e-capability-special-attack" style="border:1px solid ${color};border-radius:9px;overflow:hidden;background:#fffaf0;color:#2d2416;font-family:var(--font-primary);"><div style="display:flex;align-items:center;gap:8px;background:${color};color:#fff;padding:7px 9px;"><img src="${esc(profile?.img ?? "icons/svg/aura.svg")}" style="width:32px;height:32px;object-fit:cover;border-radius:5px;background:#fff;border:1px solid rgba(255,255,255,.55);"><div><div style="font-weight:900;">${esc(label)}</div><div style="font-size:.84em;opacity:.92;">Capacité spéciale</div></div></div><div style="padding:9px 10px;line-height:1.4;">${text}${rollLine}${detail ? `<div style="margin-top:6px;font-size:.9em;color:#624f2b;">${esc(detail)}</div>` : ""}</div></div>`,
    flags: { [SYSTEM_ID]: { capabilitySpecialAttack: true, profileId: profile?.id ?? null, state, sourceActorId: sourceActor?.id ?? null, targetActorId: target?.id ?? null } },
    ...chatStyleData()
  });
}

function capabilityWindow(actor, itemId) {
  return Array.from(actor?.effects ?? []).find(effect => effect?.flags?.[SYSTEM_ID]?.[WINDOW_FLAG]?.itemId === itemId) ?? null;
}

async function removeWindowAndItem(actor, itemId) {
  const effect = capabilityWindow(actor, itemId);
  if (effect?.id) await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id], { add2eInternal: true, add2eReason: "capability-special-attack-consumed" });
  if (itemId && actor?.items?.get?.(itemId)) await actor.deleteEmbeddedDocuments("Item", [itemId], { add2eInternal: true, add2eReason: "capability-special-attack-consumed" });
}

async function prepareWindow({ actor, item, profile, rounds }) {
  const tick = currentTick();
  if (!actor || !item || !profile || tick === null) return null;
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
      endMessage: String(profile.window?.endMessage ?? "La fenêtre de contact spécial de {actor} expire sans effet."),
      extraFlags
    })
    : {
      name: String(profile.window?.name ?? `${profile.label} — préparation`),
      img: String(profile.img ?? item.img ?? "icons/svg/aura.svg"),
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
          tags: ["capability:special-attack-window", `capability-profile:${norm(profile.id)}`],
          timeEngine: { managed: true, totalRounds, startTick: tick },
          roundEngine: { managed: true, totalRounds, startTick: tick },
          ...extraFlags
        }
      }
    };
  const created = await actor.createEmbeddedDocuments("ActiveEffect", [data], { add2eInternal: true, add2eReason: "capability-special-attack-window" });
  return created?.[0] ?? null;
}

async function resolveSpecialAttack({ actor, arme, actorId, itemId }) {
  const sourceActor = actor ?? (actorId ? game.actors?.get?.(actorId) : null);
  const item = arme ?? (itemId && sourceActor ? sourceActor.items?.get?.(itemId) : null);
  const profile = profileFor(item);
  if (!sourceActor || !item || !profile) return false;

  const tick = currentTick();
  if (tick === null) return ui.notifications?.error?.("Attaque spéciale : le compteur de temps ADD2E est indisponible.");
  const window = capabilityWindow(sourceActor, item.id);
  const expiresAtTick = Number(window?.flags?.[SYSTEM_ID]?.[WINDOW_FLAG]?.expiresAtTick ?? 0) || 0;
  if (!window || (expiresAtTick && tick >= expiresAtTick)) {
    await removeWindowAndItem(sourceActor, item.id);
    ui.notifications?.warn?.("Cette attaque spéciale n’est plus préparée.");
    return false;
  }

  const targetToken = Array.from(game.user?.targets ?? [])[0] ?? null;
  const target = targetActor(targetToken);
  if (!targetToken || !target) return ui.notifications?.warn?.("Sélectionne une cible pour l’attaque spéciale.");
  const source = sourceToken(sourceActor);
  if (!source) return ui.notifications?.warn?.("L’attaquant doit être présent sur la scène.");

  const distance = add2eAttackMeasureContactAndDistance({ srcToken: source, cibleToken: targetToken, measureDistance: add2eMeasureTokenGridDistance });
  const range = add2eAttackValidateRange({ arme: item, distanceCible: distance.distanceCible, auContact: distance.auContact });
  if (!range.ok || !distance.auContact) {
    ui.notifications?.warn?.("Cette attaque spéciale exige le contact avec la cible.");
    return false;
  }

  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return ui.notifications?.error?.("Attaque spéciale : DialogV2 est indisponible.");
  const selection = await DialogV2.wait({
    window: { title: String(profile.dialogTitle ?? profile.label ?? "Attaque spéciale") },
    position: { width: 390 },
    classes: ["add2e", "add2e-capability-dialog", "add2e-special-attack-dialog"],
    content: `<form style="font-family:var(--font-primary);display:grid;gap:8px;"><div style="border:1px solid #b77a32;border-radius:8px;background:#fff7e8;padding:8px;"><b>${esc(profile.label ?? "Attaque spéciale")}</b><br><small>Contact requis. Cette résolution ne lance aucun dégât ordinaire.</small></div><div class="form-group"><label>Modificateur circonstanciel</label><input type="number" name="modifier" value="0" step="1" style="width:72px;text-align:center;"></div></form>`,
    buttons: [
      { action: "roll", label: "Tenter le contact", icon: "fa-solid fa-hand", default: true, callback: (_event, button) => ({ modifier: Number(button.form?.elements?.modifier?.value ?? 0) || 0 }) },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });
  if (!selection) return false;

  const level = sourceLevel(sourceActor, item, profile);
  const thac0 = resolveThac0(sourceActor, level);
  const armorClass = resolveArmorClass(target);
  if (!Number.isFinite(thac0) || !Number.isFinite(armorClass)) {
    ui.notifications?.error?.("Attaque spéciale : THAC0 ou CA de la cible introuvable.");
    return false;
  }

  const combatProfile = add2eGetCombatStatProfile(item);
  const attackOptions = profile.attack ?? {};
  let abilityModifier = 0;
  if (attackOptions.abilityModifier !== false && combatProfile?.toucherCarac) {
    abilityModifier = Number(add2eGetAttackAbilityModifier(sourceActor, combatProfile.toucherCarac, "toucher")) || 0;
  }
  let magicalBonus = Number(item?.system?.bonus_hit ?? item?.system?.bonus_toucher ?? 0) || 0;
  if (attackOptions.magicWeaponBonus !== false && typeof globalThis.Add2eEffectsEngine?.getMagicWeaponBonus === "function") {
    magicalBonus = Number(globalThis.Add2eEffectsEngine.getMagicWeaponBonus(item, "hit")) || 0;
  }
  const active = add2eAttackComputeActiveAttackModifiers({ actor: sourceActor, cible: target, combatProfile });
  const effectBonus = attackOptions.effectModifiers === false ? 0 : Number(active?.bonusToucheEffets) || 0;
  const racialBonus = attackOptions.racialVs === false ? 0 : Number(active?.bonusRacialVs) || 0;
  const totalBonus = abilityModifier + magicalBonus + effectBonus + racialBonus + (Number(selection.modifier) || 0);
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

  const eligibility = validateTarget(profile, sourceActor, target);
  if (!eligibility.ok) {
    await createChat({ sourceActor, target, profile, state: "invalid", detail: eligibility.reason, d20, total, threshold });
    return { ok: true, hit: true, applied: false, consumed: false, eligibility };
  }

  const effectData = buildDeferredEffect({ sourceActor, target, item, profile, tick });
  await emitGmOperation("createActiveEffect", { actorUuid: target.uuid ?? null, actorId: target.id ?? null, effectData });
  await removeWindowAndItem(sourceActor, item.id);
  const effectTick = Number(effectData?.flags?.[SYSTEM_ID]?.[DEFERRED_FLAG]?.expiresAtTick ?? tick);
  await createChat({ sourceActor, target, profile, state: "applied", d20, total, threshold, detail: `Effet différé actif pendant ${formatTicks(Math.max(0, effectTick - tick))}.` });
  return { ok: true, hit: true, applied: true, consumed: true };
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
      if (tick !== null && Number(data.expiresAtTick ?? 0) > 0 && tick >= Number(data.expiresAtTick)) continue;
      result.push({ actor: target, effect, data });
    }
  }
  return result;
}

async function triggerDeferredAction({ sourceActor, targetActor: targetFromCall, effect }) {
  const data = effect?.flags?.[SYSTEM_ID]?.[DEFERRED_FLAG] ?? null;
  const target = targetFromCall ?? effect?.parent ?? null;
  const tick = currentTick();
  if (!sourceActor || !target || !effect || !data || tick === null) return false;
  if (Number(data.expiresAtTick ?? 0) > 0 && tick >= Number(data.expiresAtTick)) {
    ui.notifications?.warn?.("Cet effet différé a expiré.");
    return false;
  }

  const command = data.command ?? {};
  if (norm(command?.action?.type) !== "set_hit_points") {
    ui.notifications?.error?.("Action différée inconnue ou non autorisée.");
    return false;
  }
  const targetValue = target.type === "monster"
    ? Number(command?.action?.monsterValue ?? 0)
    : Number(command?.action?.characterValue ?? -11);
  const hp = actorHp(target).current;
  if (!Number.isFinite(hp)) {
    ui.notifications?.error?.("Les PV de la cible sont introuvables.");
    return false;
  }
  const amount = Math.max(0, hp - targetValue);
  if (amount > 0) {
    await emitGmOperation("applyDamage", {
      actorUuid: target.uuid ?? null,
      actorId: target.id ?? null,
      montant: amount,
      details: { capabilityDeferredAction: data.profileId, sourceActorUuid: sourceActor.uuid ?? null }
    });
  }
  await emitGmOperation("deleteActiveEffects", {
    actorUuid: target.uuid ?? null,
    actorId: target.id ?? null,
    effectIds: [effect.id]
  });

  await createChat({
    sourceActor,
    target,
    profile: { id: data.profileId, label: command.label ?? effect.name, img: effect.img ?? sourceActor.img },
    state: "triggered",
    detail: String(command?.message ?? "L’action différée est résolue.")
  });
  return true;
}

function patchAttackRoll() {
  const original = globalThis.add2eAttackRoll;
  if (typeof original !== "function") return false;
  if (original.__add2eCapabilitySpecialAttackWrapper) return true;

  const wrapped = async function add2eCapabilityAwareAttackRoll(args = {}) {
    const actor = args.actor ?? (args.actorId ? game.actors?.get?.(args.actorId) : null);
    const item = args.arme ?? (args.itemId && actor ? actor.items?.get?.(args.itemId) : null);
    if (profileFor(item)) return resolveSpecialAttack({ ...args, actor, arme: item });
    return original.call(this, args);
  };
  wrapped.__add2eCapabilitySpecialAttackWrapper = true;
  wrapped.__add2eCapabilitySpecialAttackOriginal = original;
  globalThis.add2eAttackRoll = wrapped;
  return true;
}

function registerPatch() {
  if (patchAttackRoll()) return;
  setTimeout(patchAttackRoll, 100);
  setTimeout(patchAttackRoll, 500);
  setTimeout(patchAttackRoll, 1500);
}

globalThis.add2eCapabilitySpecialAttack = {
  version: ADD2E_CAPABILITY_SPECIAL_ATTACK_VERSION,
  profileFor,
  currentTick,
  formatTicks,
  prepareWindow,
  resolveSpecialAttack,
  findDeferredActions,
  triggerDeferredAction,
  validateTarget
};

if (game?.ready) registerPatch();
else Hooks.once("ready", registerPatch);
