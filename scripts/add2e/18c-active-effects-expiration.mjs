// ============================================================================
// ADD2E — Expiration des effets temporaires.
// Version : 2026-06-02-active-effects-expiration-end-message-v1
// ============================================================================

import { add2eVitalEffectKind } from "./18a-vital-status-core.mjs";

export const ADD2E_ACTIVE_EFFECTS_EXPIRATION_VERSION = "2026-06-02-active-effects-expiration-end-message-v1";

function add2eExpireHtmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eExpireChatStyleData() {
  if (CONST.CHAT_MESSAGE_STYLES) return { style: CONST.CHAT_MESSAGE_STYLES.OTHER };
  return { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
}

function add2eExpireGmIds() {
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

function add2eActorOwnerPlayerIds(actor) {
  const ids = [];
  for (const user of game.users ?? []) {
    if (!user || user.isGM) continue;

    let isOwner = false;
    try {
      if (typeof actor?.testUserPermission === "function") {
        isOwner = actor.testUserPermission(user, "OWNER");
      }
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

function add2eEffectFlag(effect, key) {
  try {
    if (typeof effect?.getFlag === "function") return effect.getFlag("add2e", key);
  } catch (_err) {}
  return effect?.flags?.add2e?.[key];
}

function add2eEffectTags(effect) {
  const raw = add2eEffectFlag(effect, "tags") ?? effect?.flags?.add2e?.tags ?? [];
  if (Array.isArray(raw)) return raw.map(x => String(x ?? "")).filter(Boolean);
  if (typeof raw === "string") return raw.split(/[,;|\n]+/).map(x => x.trim()).filter(Boolean);
  return [];
}

function add2eEffectSourceLabel(effect) {
  const explicit = add2eEffectFlag(effect, "spellName")
    ?? add2eEffectFlag(effect, "name")
    ?? effect?.flags?.add2e?.spell?.name
    ?? effect?.flags?.add2e?.spell?.slug
    ?? null;

  if (explicit) return String(explicit);

  const tags = add2eEffectTags(effect);
  const spellTag = tags.find(t => String(t).startsWith("sort:"));
  if (spellTag) return spellTag.replace(/^sort:/, "").replace(/_/g, " ");

  return effect?.name ?? effect?.label ?? "Effet";
}

function add2eEffectExpiryDescription(effect, actor, currentRound) {
  const effectName = add2eEffectSourceLabel(effect);
  const actorName = actor?.name ?? "la cible";
  const roundText = Number.isFinite(Number(currentRound)) && Number(currentRound) > 0
    ? ` Round ${Number(currentRound)}.`
    : "";

  const customEndMessage = add2eEffectFlag(effect, "endMessage")
    ?? effect?.flags?.add2e?.roundEngine?.endMessage
    ?? effect?.flags?.add2e?.expirationMessage
    ?? null;

  if (customEndMessage) return String(customEndMessage)
    .replace(/\{actor\}/g, actorName)
    .replace(/\{effect\}/g, effectName)
    .replace(/\{round\}/g, String(currentRound ?? ""));

  return `L’effet ${effectName} prend fin sur ${actorName}.${roundText}`;
}

async function add2eNotifyExpiredEffect(actor, effectSnapshot, currentRound) {
  if (!actor || !effectSnapshot) return false;

  const silent = add2eEffectFlag(effectSnapshot, "silentExpiration")
    ?? effectSnapshot?.flags?.add2e?.roundEngine?.silentExpiration
    ?? false;
  if (silent) return false;

  const gmIds = add2eExpireGmIds();
  const ownerIds = add2eActorOwnerPlayerIds(actor);
  const whisper = [...new Set([...gmIds, ...ownerIds])].filter(Boolean);
  if (!whisper.length) return false;

  const actorName = actor.name ?? "Acteur";
  const effectName = add2eEffectSourceLabel(effectSnapshot);
  const img = effectSnapshot.img || effectSnapshot.icon || actor.img || "icons/svg/aura.svg";
  const message = add2eEffectExpiryDescription(effectSnapshot, actor, currentRound);
  const ownerNote = ownerIds.length
    ? "Le joueur propriétaire de l’acteur et le MJ sont prévenus."
    : "Aucun joueur propriétaire trouvé : notification envoyée au MJ.";

  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper,
      content: `
        <div class="add2e-chat-card add2e-effect-expired"
             style="border:1px solid #8d6e63;border-radius:8px;overflow:hidden;background:#fffaf4;color:#3b2a22;font-family:var(--font-primary);">
          <div style="display:flex;align-items:center;gap:8px;background:#6d4c41;color:#fff;padding:7px 9px;">
            <img src="${add2eExpireHtmlEscape(img)}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;border:1px solid #d7ccc8;background:#fff;" />
            <div style="flex:1;line-height:1.15;">
              <div style="font-weight:900;font-size:13px;">Effet expiré</div>
              <div style="font-size:12px;opacity:.95;">${add2eExpireHtmlEscape(effectName)}</div>
            </div>
          </div>
          <div style="padding:8px 10px;background:#fffaf4;">
            <div style="border:1px solid #bcaaa4;border-radius:6px;background:#fff;padding:8px;text-align:center;font-size:13px;line-height:1.35;">
              ${add2eExpireHtmlEscape(message)}
            </div>
            <div style="margin-top:6px;font-size:11px;color:#6d4c41;text-align:center;">
              Acteur : <b>${add2eExpireHtmlEscape(actorName)}</b> — ${add2eExpireHtmlEscape(ownerNote)}
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
          version: ADD2E_ACTIVE_EFFECTS_EXPIRATION_VERSION
        }
      },
      ...add2eExpireChatStyleData()
    });
    return true;
  } catch (err) {
    console.warn("[ADD2E][AUTO-REMOVE][EXPIRE_MESSAGE_FAILED] Message d'expiration impossible", {
      actor: actor.name,
      effectId: effectSnapshot.id,
      effectName,
      err
    });
    return false;
  }
}

export async function add2eExpireTemporaryEffectsForActor(actor, currentRound) {
  if (!actor) return { actor: null, deleted: 0, ids: [], messages: 0 };

  const toDelete = [];

  for (const effect of Array.from(actor.effects ?? [])) {
    if (!effect) continue;
    if (add2eVitalEffectKind(effect)) continue;

    const dur = effect.duration || {};
    if (effect.disabled) continue;
    if (typeof dur.rounds !== "number" || Number.isNaN(dur.rounds)) continue;

    const totalRounds = dur.rounds;
    let startRound = dur.startRound;

    if (typeof startRound !== "number" || Number.isNaN(startRound)) {
      try {
        if (!actor.effects.get(effect.id)) continue;
        await effect.update({ "duration.startRound": currentRound });
        startRound = currentRound;
      } catch (err) {
        const msg = String(err?.message || err || "");
        if (msg.includes("does not exist") || msg.includes("n'existe pas")) {
          console.warn("[ADD2E][AUTO-REMOVE][STALE_UPDATE] Effet déjà absent pendant l'initialisation startRound", {
            actor: actor.name,
            effectId: effect.id,
            effectName: effect.name
          });
          continue;
        }
        throw err;
      }
    }

    const elapsed = Math.max(0, currentRound - startRound);
    const remaining = totalRounds - elapsed;
    if (remaining <= 0) {
      toDelete.push({
        id: effect.id,
        name: effect.name ?? effect.label ?? "Effet",
        label: effect.label ?? effect.name ?? "Effet",
        img: effect.img ?? effect.icon ?? null,
        icon: effect.icon ?? effect.img ?? null,
        duration: foundry.utils.deepClone(effect.duration ?? {}),
        flags: foundry.utils.deepClone(effect.flags ?? {})
      });
    }
  }

  const valid = toDelete.filter(row => row.id && actor.effects.get(row.id));
  const validIds = valid.map(row => row.id);
  if (!validIds.length) return { actor: actor.name, deleted: 0, ids: [], messages: 0 };

  console.log("[ADD2E][AUTO-REMOVE] Suppression auto des effets expirés", { actor: actor.name, ids: validIds });

  let deleted = 0;
  let messages = 0;
  for (const snapshot of valid) {
    const effectId = snapshot.id;
    if (!actor.effects.get(effectId)) continue;

    try {
      await actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
      deleted += 1;
      const notified = await add2eNotifyExpiredEffect(actor, snapshot, currentRound);
      if (notified) messages += 1;
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (msg.includes("does not exist") || msg.includes("n'existe pas")) {
        console.warn("[ADD2E][AUTO-REMOVE][ALREADY_GONE] Effet déjà absent, suppression ignorée", { actor: actor.name, effectId, err });
        continue;
      }
      console.error("[ADD2E][AUTO-REMOVE][DELETE_ERROR] Suppression impossible", { actor: actor.name, effectId, err });
    }
  }

  return { actor: actor.name, deleted, ids: validIds, messages };
}
