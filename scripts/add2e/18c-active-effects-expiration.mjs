// ============================================================================
// ADD2E — Expiration des effets temporaires.
// Version : 2026-07-01-active-effects-expiration-world-time-priority-v3
// ============================================================================

import { add2eVitalEffectKind } from "./18a-vital-status-core.mjs";
import {
  ADD2E_TIME_ENGINE_VERSION,
  add2eTimeCurrentTick,
  add2eTimeNormalizeEffect,
  add2eTimeRemainingRounds
} from "./19a-time-engine.mjs";

export const ADD2E_ACTIVE_EFFECTS_EXPIRATION_VERSION = "2026-07-01-active-effects-expiration-world-time-priority-v3";

const LINKED_EFFECT_GROUP_FLAG = "linkedEffectGroup";
const LINKED_EFFECT_GROUP_HOOKS_FLAG = "ADD2E_LINKED_EFFECT_GROUP_HOOKS_REGISTERED";
const linkedEffectGroupCleanups = new Set();

function numeric(value, fallback = NaN) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
  if (CONST.CHAT_MESSAGE_STYLES) return { style: CONST.CHAT_MESSAGE_STYLES.OTHER };
  return { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
}

function gmIds() {
  try {
    const recipients = ChatMessage.getWhisperRecipients?.("GM") ?? [];
    const ids = recipients.map(u => u?.id).filter(Boolean);
    if (ids.length) return ids;
  } catch (_err) {}

  return Array.from(game.users ?? [])
    .filter(u => u?.isGM)
    .map(u => u.id)
    .filter(Boolean);
}

function actorOwnerPlayerIds(actor) {
  const ids = [];
  for (const user of game.users ?? []) {
    if (!user || user.isGM) continue;

    let isOwner = false;
    try {
      if (typeof actor?.testUserPermission === "function") isOwner = actor.testUserPermission(user, "OWNER");
    } catch (_err) {}

    if (!isOwner) {
      try {
        const ownerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
        const userLevel = Number(actor?.ownership?.[user.id] ?? actor?.permission?.[user.id] ?? 0);
        const defaultLevel = Number(actor?.ownership?.default ?? actor?.permission?.default ?? 0);
        isOwner = userLevel >= ownerLevel || defaultLevel >= ownerLevel;
      } catch (_err) {}
    }

    if (isOwner) ids.push(user.id);
  }
  return ids;
}

function effectFlag(effect, key) {
  try { if (typeof effect?.getFlag === "function") return effect.getFlag("add2e", key); }
  catch (_err) {}
  return effect?.flags?.add2e?.[key];
}

function effectTags(effect) {
  const raw = effectFlag(effect, "tags") ?? effect?.flags?.add2e?.tags ?? [];
  if (Array.isArray(raw)) return raw.map(x => String(x ?? "")).filter(Boolean);
  if (typeof raw === "string") return raw.split(/[,;|\n]+/).map(x => x.trim()).filter(Boolean);
  return [];
}

function effectSourceLabel(effect) {
  const explicit = effectFlag(effect, "spellName")
    ?? effectFlag(effect, "name")
    ?? effect?.flags?.add2e?.spell?.name
    ?? effect?.flags?.add2e?.spell?.slug
    ?? null;

  if (explicit) return String(explicit);

  const tags = effectTags(effect);
  const spellTag = tags.find(t => String(t).startsWith("sort:"));
  if (spellTag) return spellTag.replace(/^sort:/, "").replace(/_/g, " ");

  return effect?.name ?? effect?.label ?? "Effet";
}

function expiryDescription(effect, actor, currentRound) {
  const effectName = effectSourceLabel(effect);
  const actorName = actor?.name ?? "la cible";
  const roundValue = numeric(currentRound, NaN);
  const roundText = Number.isFinite(roundValue) && roundValue > 0 ? ` Round ${roundValue}.` : "";
  const tickText = Number.isFinite(roundValue) && roundValue > 0 ? "" : ` Temps ADD2E : ${add2eTimeCurrentTick()} round(s).`;

  const customEndMessage = effectFlag(effect, "endMessage")
    ?? effect?.flags?.add2e?.roundEngine?.endMessage
    ?? effect?.flags?.add2e?.expirationMessage
    ?? null;

  if (customEndMessage) return String(customEndMessage)
    .replace(/\{actor\}/g, actorName)
    .replace(/\{effect\}/g, effectName)
    .replace(/\{round\}/g, String(currentRound ?? ""));

  return `L’effet ${effectName} prend fin sur ${actorName}.${roundText}${tickText}`;
}

async function notifyExpiredEffect(actor, effectSnapshot, currentRound) {
  if (!actor || !effectSnapshot) return false;

  const silent = effectFlag(effectSnapshot, "silentExpiration")
    ?? effectSnapshot?.flags?.add2e?.roundEngine?.silentExpiration
    ?? false;
  if (silent) return false;

  const whisper = [...new Set([...gmIds(), ...actorOwnerPlayerIds(actor)])].filter(Boolean);
  if (!whisper.length) return false;

  const actorName = actor.name ?? "Acteur";
  const effectName = effectSourceLabel(effectSnapshot);
  const img = effectSnapshot.img || effectSnapshot.icon || actor.img || "icons/svg/aura.svg";
  const message = expiryDescription(effectSnapshot, actor, currentRound);

  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper,
      content: `
        <div class="add2e-chat-card add2e-effect-expired"
             style="border:1px solid #8d6e63;border-radius:8px;overflow:hidden;background:#fffaf4;color:#3b2a22;font-family:var(--font-primary);">
          <div style="display:flex;align-items:center;gap:8px;background:#6d4c41;color:#fff;padding:7px 9px;">
            <img src="${htmlEscape(img)}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;border:1px solid #d7ccc8;background:#fff;" />
            <div style="flex:1;line-height:1.15;">
              <div style="font-weight:900;font-size:13px;">Effet expiré</div>
              <div style="font-size:12px;opacity:.95;">${htmlEscape(effectName)}</div>
            </div>
          </div>
          <div style="padding:8px 10px;background:#fffaf4;">
            <div style="border:1px solid #bcaaa4;border-radius:6px;background:#fff;padding:8px;text-align:center;font-size:13px;line-height:1.35;">
              ${htmlEscape(message)}
            </div>
            <div style="margin-top:6px;font-size:11px;color:#6d4c41;text-align:center;">
              Acteur : <b>${htmlEscape(actorName)}</b>
            </div>
          </div>
        </div>`,
      flags: {
        add2e: {
          effectExpirationMessage: true,
          effectId: effectSnapshot.id ?? null,
          effectName,
          actorId: actor.id ?? null,
          actorUuid: actor.uuid ?? null,
          round: currentRound ?? null,
          tick: add2eTimeCurrentTick(),
          expirationVersion: ADD2E_ACTIVE_EFFECTS_EXPIRATION_VERSION,
          timeEngineVersion: ADD2E_TIME_ENGINE_VERSION
        }
      },
      ...chatStyleData()
    });
    return true;
  } catch (err) {
    console.warn("[ADD2E][AUTO-REMOVE][EXPIRE_MESSAGE_FAILED] Message d'expiration impossible", { actor: actor.name, effectId: effectSnapshot.id, effectName, err });
    return false;
  }
}

function hasTimedDuration(effect) {
  const duration = effect?.duration ?? {};
  const flags = effect?.flags?.add2e ?? {};
  return Number.isFinite(Number(duration.rounds)) ||
    Number.isFinite(Number(duration.remaining)) ||
    Number.isFinite(Number(flags.rounds)) ||
    Number.isFinite(Number(flags.durationRounds)) ||
    Number.isFinite(Number(flags.dureeRounds)) ||
    Number.isFinite(Number(flags.duree_rounds)) ||
    Number.isFinite(Number(flags.roundEngine?.totalRounds)) ||
    Number.isFinite(Number(flags.timeEngine?.totalRounds)) ||
    Number.isFinite(Number(flags.duration?.rounds)) ||
    Number.isFinite(Number(flags.duration?.durationRounds));
}

function remainingForEffect(effect, currentRound) {
  // Le helper canonique choisit startTick ADD2E lorsqu'il existe, puis conserve
  // startRound pour les anciens effets qui ne possèdent pas de tick global.
  const canonical = add2eTimeRemainingRounds(effect, currentRound);
  if (canonical) return canonical;

  const nativeRemaining = numeric(effect?.duration?.remaining, NaN);
  if (Number.isFinite(nativeRemaining)) return { remaining: nativeRemaining, clock: "native" };

  return null;
}

async function deleteTemporaryLinkedItem(actor, effect) {
  const temporaryItemId = effect?.flags?.add2e?.temporaryItemId;
  if (temporaryItemId && actor.items?.get(temporaryItemId)) await actor.deleteEmbeddedDocuments("Item", [temporaryItemId]);
}

function snapshotEffect(effect, remainingData) {
  return {
    id: effect.id,
    name: effect.name ?? effect.label ?? "Effet",
    label: effect.label ?? effect.name ?? "Effet",
    img: effect.img ?? effect.icon ?? null,
    icon: effect.icon ?? effect.img ?? null,
    duration: foundry.utils.deepClone(effect.duration ?? {}),
    flags: foundry.utils.deepClone(effect.flags ?? {}),
    expirationState: foundry.utils.deepClone(remainingData ?? {})
  };
}

function groupRole(value) {
  const normalized = String(value ?? "member").trim().toLowerCase();
  return ["anchor", "controller", "source"].includes(normalized) ? "anchor" : "member";
}

function groupBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function groupTemplateData(value = {}, fallback = {}) {
  return {
    sceneId: value.sceneId ?? value.templateSceneId ?? fallback.sceneId ?? null,
    templateId: value.templateId ?? value.id ?? fallback.templateId ?? null,
    requestId: value.requestId ?? value.templateRequestId ?? fallback.requestId ?? null
  };
}

/**
 * Format générique à stocker dans flags.add2e.linkedEffectGroup.
 * Les sorts de zone et multi-cibles peuvent l'utiliser sans contrôleur dédié.
 */
export function add2eLinkedEffectGroupData({
  id,
  role = "member",
  cleanup = {},
  template = {}
} = {}) {
  const groupId = String(id ?? "").trim();
  if (!groupId) return null;

  return {
    version: 1,
    id: groupId,
    role: groupRole(role),
    cleanup: {
      deleteMembersWhenAnchorRemoved: groupBoolean(cleanup.deleteMembersWhenAnchorRemoved, true),
      deleteAnchorWhenNoMembers: groupBoolean(cleanup.deleteAnchorWhenNoMembers, true),
      deleteTemplate: groupBoolean(cleanup.deleteTemplate, true)
    },
    template: groupTemplateData(template, { requestId: groupId })
  };
}

/**
 * Lit le groupe générique. Les anciens effets liés par templateRequestId restent
 * reconnus afin que leur nettoyage soit assuré après la migration.
 */
export function add2eReadLinkedEffectGroup(effect) {
  const flags = effect?.flags?.add2e ?? {};
  const spell = flags.spell ?? {};
  const raw = flags[LINKED_EFFECT_GROUP_FLAG];
  const linked = raw && typeof raw === "object" ? raw : {};
  const legacyRequestId = flags.templateRequestId ?? spell.templateRequestId ?? null;
  const id = String(linked.id ?? linked.groupId ?? legacyRequestId ?? "").trim();
  if (!id) return null;

  const role = groupRole(linked.role ?? flags.role ?? spell.role ?? "member");
  const cleanup = linked.cleanup ?? {};
  const template = groupTemplateData(linked.template ?? linked, {
    sceneId: flags.templateSceneId ?? spell.templateSceneId ?? null,
    templateId: flags.templateId ?? spell.templateId ?? null,
    requestId: legacyRequestId ?? id
  });

  return {
    id,
    role,
    cleanup: {
      deleteMembersWhenAnchorRemoved: groupBoolean(cleanup.deleteMembersWhenAnchorRemoved, true),
      deleteAnchorWhenNoMembers: groupBoolean(cleanup.deleteAnchorWhenNoMembers, true),
      deleteTemplate: groupBoolean(cleanup.deleteTemplate, true)
    },
    template
  };
}

function isResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id || !game.users?.activeGM;
}

function linkedGroupEntries(groupId) {
  const entries = [];
  const expected = String(groupId ?? "");
  if (!expected) return entries;

  for (const actor of game.actors ?? []) {
    for (const effect of actor.effects ?? []) {
      const group = add2eReadLinkedEffectGroup(effect);
      if (!group || group.id !== expected) continue;
      entries.push({ actor, effect, group });
    }
  }
  return entries;
}

async function deleteLinkedGroupEffects(entries = []) {
  const byActor = new Map();

  for (const entry of entries) {
    const actor = entry?.actor;
    const effect = entry?.effect;
    if (!actor?.effects?.get?.(effect?.id)) continue;
    if (!byActor.has(actor)) byActor.set(actor, []);
    byActor.get(actor).push(effect);
  }

  let deleted = 0;
  for (const [actor, effects] of byActor.entries()) {
    for (const effect of effects) await deleteTemporaryLinkedItem(actor, effect);
    const ids = effects.map(effect => effect.id).filter(id => actor.effects.get(id));
    if (!ids.length) continue;
    await actor.deleteEmbeddedDocuments("ActiveEffect", ids, { add2eLinkedEffectGroup: true });
    deleted += ids.length;
  }
  return deleted;
}

function groupTemplateReferences(group, entries = []) {
  const sceneIds = new Set();
  const templateIds = new Set();
  const requestIds = new Set();

  const collect = data => {
    const template = data?.template ?? {};
    if (template.sceneId) sceneIds.add(String(template.sceneId));
    if (template.templateId) templateIds.add(String(template.templateId));
    if (template.requestId) requestIds.add(String(template.requestId));
  };

  collect(group);
  for (const entry of entries) collect(entry.group);
  requestIds.add(String(group.id));

  return { sceneIds, templateIds, requestIds };
}

async function deleteLinkedGroupTemplates(group, entries = []) {
  const refs = groupTemplateReferences(group, entries);
  const scenes = refs.sceneIds.size
    ? Array.from(refs.sceneIds).map(id => game.scenes?.get?.(id)).filter(Boolean)
    : Array.from(game.scenes ?? []);

  let deleted = 0;
  for (const scene of scenes) {
    const ids = Array.from(scene.templates ?? [])
      .filter(template => {
        const flags = template?.flags?.add2e ?? {};
        const linked = flags[LINKED_EFFECT_GROUP_FLAG] ?? {};
        const groupId = String(linked?.id ?? linked?.groupId ?? flags.linkedEffectGroupId ?? flags.effectGroupId ?? "");
        const requestId = String(flags.templateRequestId ?? "");
        return refs.templateIds.has(String(template.id)) ||
          groupId === String(group.id) ||
          (requestId && refs.requestIds.has(requestId));
      })
      .map(template => template.id)
      .filter(Boolean);

    if (!ids.length) continue;
    await scene.deleteEmbeddedDocuments("MeasuredTemplate", ids, { add2eLinkedEffectGroup: true });
    deleted += ids.length;
  }
  return deleted;
}

/**
 * Nettoie un groupe d'effets temporaires liés. La suppression de l'ancre met
 * fin aux membres ; la disparition du dernier membre peut supprimer l'ancre.
 */
export async function add2eCleanupLinkedEffectGroup(groupOrEffect, {
  reason = "effect-removed",
  removedRole = null
} = {}) {
  const group = groupOrEffect?.id && groupOrEffect?.cleanup
    ? groupOrEffect
    : add2eReadLinkedEffectGroup(groupOrEffect);
  if (!group?.id || !isResponsibleGM()) return { ok: false, reason: "unavailable" };

  const key = String(group.id);
  if (linkedEffectGroupCleanups.has(key)) return { ok: false, reason: "already-cleaning" };

  linkedEffectGroupCleanups.add(key);
  try {
    const entries = linkedGroupEntries(group.id);
    const role = groupRole(removedRole ?? group.role);
    const activeMembers = entries.filter(entry => entry.group.role === "member" && !entry.effect?.disabled);
    const anchorRemoved = role === "anchor";
    const removeWholeGroup = anchorRemoved
      ? group.cleanup.deleteMembersWhenAnchorRemoved
      : group.cleanup.deleteAnchorWhenNoMembers && activeMembers.length === 0;

    if (!removeWholeGroup) return { ok: true, deletedEffects: 0, deletedTemplates: 0, reason: "group-retained" };

    const deletedEffects = await deleteLinkedGroupEffects(entries);
    const deletedTemplates = group.cleanup.deleteTemplate
      ? await deleteLinkedGroupTemplates(group, entries)
      : 0;

    return { ok: true, deletedEffects, deletedTemplates, reason };
  } finally {
    setTimeout(() => linkedEffectGroupCleanups.delete(key), 0);
  }
}

function scheduleLinkedGroupCleanup(effect, reason) {
  const group = add2eReadLinkedEffectGroup(effect);
  if (!group || !isResponsibleGM()) return;

  setTimeout(() => {
    add2eCleanupLinkedEffectGroup(group, { reason, removedRole: group.role })
      .catch(error => console.error("[ADD2E][LINKED_EFFECT_GROUP][CLEANUP_FAILED]", { groupId: group.id, reason, error }));
  }, 0);
}

function registerLinkedEffectGroupHooks() {
  if (globalThis[LINKED_EFFECT_GROUP_HOOKS_FLAG]) return;
  globalThis[LINKED_EFFECT_GROUP_HOOKS_FLAG] = true;

  Hooks.on("deleteActiveEffect", effect => scheduleLinkedGroupCleanup(effect, "effect-deleted"));
  Hooks.on("updateActiveEffect", effect => {
    if (effect?.disabled) scheduleLinkedGroupCleanup(effect, "effect-disabled");
  });
}

export async function add2eExpireTemporaryEffectsForActor(actor, currentRound = game.combat?.round ?? 0) {
  if (!actor) return { actor: null, deleted: 0, ids: [], messages: 0 };

  const effectiveRound = numeric(currentRound, game.combat?.round ?? 0);
  const toDelete = [];

  for (const effect of Array.from(actor.effects ?? [])) {
    if (!effect) continue;
    if (add2eVitalEffectKind(effect)) continue;
    if (effect.disabled) continue;
    if (!actor.effects.get(effect.id)) continue;
    if (!hasTimedDuration(effect)) continue;

    try {
      await add2eTimeNormalizeEffect(effect, effectiveRound);
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (msg.includes("does not exist") || msg.includes("n'existe pas")) continue;
      console.warn("[ADD2E][AUTO-REMOVE][NORMALIZE_FAILED]", { actor: actor.name, effectId: effect.id, effectName: effect.name, err });
    }

    if (!actor.effects.get(effect.id)) continue;

    const remainingData = remainingForEffect(effect, effectiveRound);
    const remaining = Number(remainingData?.remaining);
    if (Number.isFinite(remaining) && remaining <= 0) toDelete.push(snapshotEffect(effect, remainingData));
  }

  const valid = toDelete.filter(row => row.id && actor.effects.get(row.id));
  const validIds = valid.map(row => row.id);
  if (!validIds.length) return { actor: actor.name, deleted: 0, ids: [], messages: 0 };

  console.log("[ADD2E][AUTO-REMOVE] Suppression auto des effets expirés", { actor: actor.name, ids: validIds, tick: add2eTimeCurrentTick() });

  let deleted = 0;
  let messages = 0;
  for (const snapshot of valid) {
    const effect = actor.effects.get(snapshot.id);
    if (!effect) continue;

    try {
      await deleteTemporaryLinkedItem(actor, effect);
      if (actor.effects.get(snapshot.id)) await actor.deleteEmbeddedDocuments("ActiveEffect", [snapshot.id]);
      deleted += 1;
      const notified = await notifyExpiredEffect(actor, snapshot, currentRound);
      if (notified) messages += 1;
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (msg.includes("does not exist") || msg.includes("n'existe pas")) {
        console.warn("[ADD2E][AUTO-REMOVE][ALREADY_GONE] Effet déjà absent, suppression ignorée", { actor: actor.name, effectId: snapshot.id, err });
        continue;
      }
      console.error("[ADD2E][AUTO-REMOVE][DELETE_ERROR] Suppression impossible", { actor: actor.name, effectId: snapshot.id, err });
    }
  }

  return { actor: actor.name, deleted, ids: validIds, messages };
}

registerLinkedEffectGroupHooks();
globalThis.add2eLinkedEffectGroupData = add2eLinkedEffectGroupData;
globalThis.add2eReadLinkedEffectGroup = add2eReadLinkedEffectGroup;
globalThis.add2eCleanupLinkedEffectGroup = add2eCleanupLinkedEffectGroup;
