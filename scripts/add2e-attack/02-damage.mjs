// scripts/add2e-attack/02-damage.mjs
// ADD2E — Application des dégâts via Add2eEffectsEngine.

import { add2eGetCombatStatProfile } from "./03-attack-rules.mjs";

export const ADD2E_DAMAGE_VERSION = "2026-07-10-monk-projectile-save-damage-v3";

function add2eDamageTokenClass() {
  return foundry?.canvas?.placeables?.Token ?? CONFIG?.Token?.objectClass ?? null;
}

function add2eDamageTokenId(cible) {
  if (!cible) return null;
  if (cible.token?.id) return cible.token.id;
  const TokenClass = add2eDamageTokenClass();
  if (TokenClass && cible instanceof TokenClass) return cible.id;
  if (cible.documentName === "Token" || cible.constructor?.name === "TokenDocument") return cible.id;
  return null;
}

function add2eDamageActor(cible) {
  return cible?.actor ?? cible ?? null;
}

function add2eDamageNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eDamageEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eDamageEffectTags(effect) {
  const raw = effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? [];
  const values = Array.isArray(raw) ? raw : String(raw ?? "").split(/[,;|\n]+/g);
  return values.map(add2eDamageNormalize).filter(Boolean);
}

function add2eDamageTargetToken(cible, actor) {
  if (cible?.actor?.id === actor?.id) return cible.object ?? cible;
  if (cible?.object?.actor?.id === actor?.id) return cible.object;
  return canvas?.tokens?.placeables?.find(token => token?.actor?.id === actor?.id)
    ?? actor?.getActiveTokens?.()[0]
    ?? null;
}

function add2eFindDamageResolutionEffect(actor, resolution) {
  if (!resolution?.applied || !actor) return null;
  const element = add2eDamageNormalize(resolution.element);
  if (!element) return null;

  return [...(actor.effects ?? [])].find(effect => {
    if (!effect || effect.disabled) return false;
    const handler = effect.flags?.add2e?.damageResolution;
    const onUse = String(handler?.onUse ?? "").trim();
    if (!onUse) return false;

    const configuredElement = add2eDamageNormalize(handler.element);
    if (configuredElement) return configuredElement === element;
    return add2eDamageEffectTags(effect).includes(`resistance:${element}`);
  }) ?? null;
}

async function add2eRunDamageResolutionOnUse({ actor, cible, resolution, amount, type, details }) {
  const effect = add2eFindDamageResolutionEffect(actor, resolution);
  if (!effect) return false;

  const handler = effect.flags?.add2e?.damageResolution ?? {};
  const scriptPath = String(handler.onUse ?? "").trim();
  if (!scriptPath) return false;

  try {
    const response = await fetch(scriptPath, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const code = await response.text();
    const Fn = Object.getPrototypeOf(async function () {}).constructor;
    const targetToken = add2eDamageTargetToken(cible, actor);
    const event = {
      add2eMode: String(handler.mode ?? "damageResolved"),
      actor,
      token: targetToken,
      targetActor: actor,
      targetToken,
      effect,
      effectId: effect.id ?? null,
      effectFlags: effect.flags?.add2e ?? {},
      damageResolution: resolution,
      damage: {
        original: Math.max(0, Number(amount) || 0),
        final: Math.max(0, Number(resolution.amount) || 0),
        type: String(type ?? ""),
        details: String(details ?? "")
      }
    };

    const fn = new Fn("actor", "item", "sort", "token", "args", "sourceItem", code);
    await fn.call(effect, actor, null, null, targetToken, [event], null);
    return true;
  } catch (error) {
    console.error("[ADD2E][DAMAGE][ONUSE_CARD][ERROR]", {
      actor: actor?.name,
      effect: effect?.name,
      scriptPath,
      error
    });
    return false;
  }
}

function add2eDamageSourceItem({ source = null, sourceItem = null, lanceur = null } = {}) {
  if (sourceItem?.documentName === "Item" || sourceItem?.type) return sourceItem;
  if (source?.documentName === "Item" || (source && typeof source === "object" && source.system)) return source;

  const sourceKey = String(source ?? "").trim();
  if (!sourceKey || !lanceur) return null;
  return lanceur.items?.get?.(sourceKey)
    ?? Array.from(lanceur.items ?? []).find(item => String(item?.id ?? "") === sourceKey || String(item?.name ?? "") === sourceKey)
    ?? null;
}

function add2eDamageSaveSucceeded(save) {
  if (typeof save === "boolean") return save;
  if (!save || typeof save !== "object") return false;
  if (typeof save.success === "boolean") return save.success;
  if (typeof save.saved === "boolean") return save.saved;
  const value = add2eDamageNormalize(save.result ?? save.outcome ?? save.status ?? "");
  return ["success", "saved", "save", "reussi", "reussite", "succes"].includes(value);
}

function add2eDamageMonkLevel(engine, actor) {
  try {
    const classItem = engine?.getMonkClassItem?.(actor) ?? null;
    const level = Number(engine?.getEmbeddedClassLevel?.(classItem) ?? classItem?.system?.niveau ?? classItem?.system?.level);
    return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
  } catch (_error) {
    return null;
  }
}

function add2eDamageMultiplier(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function add2eResolveSaveDamage(actor, original, save = null) {
  const amount = Math.max(0, Number(original) || 0);
  if (!save || amount <= 0) {
    return { applied: false, amount, original: amount, save: null, success: false, multiplier: 1, monk: false, reason: "no-save-context" };
  }

  const success = add2eDamageSaveSucceeded(save);
  const defaultMultiplier = success
    ? add2eDamageMultiplier(save.succeededMultiplier ?? save.successMultiplier ?? save.onSuccessMultiplier, 1)
    : add2eDamageMultiplier(save.failedMultiplier ?? save.failureMultiplier ?? save.onFailureMultiplier, 1);

  const engine = globalThis.Add2eEffectsEngine ?? null;
  const isMonk = Boolean(engine?.isMonk?.(actor));
  const tags = isMonk && typeof engine?.getActiveTags === "function"
    ? new Set(engine.getActiveTags(actor).map(tag => engine.normalizeTag?.(tag) ?? add2eDamageNormalize(tag)))
    : new Set();
  const level = isMonk ? add2eDamageMonkLevel(engine, actor) : null;
  const noDamageOnSuccess = isMonk && tags.has("moine:sauvegarde_aucun_degats");
  const halfDamageOnFailure = isMonk
    && Number(level) >= 9
    && tags.has("moine:sauvegarde_demi_degats_niveau_9");

  let multiplier = defaultMultiplier;
  let reason = success ? "default-save-success" : "default-save-failure";
  if (success && noDamageOnSuccess) {
    multiplier = 0;
    reason = "monk-save-no-damage";
  } else if (!success && halfDamageOnFailure) {
    multiplier = 0.5;
    reason = "monk-failed-save-half-damage";
  }

  return {
    applied: multiplier !== 1 || noDamageOnSuccess || halfDamageOnFailure,
    amount: Math.max(0, Math.floor(amount * multiplier)),
    original: amount,
    save,
    success,
    multiplier,
    monk: isMonk,
    monkLevel: level,
    noDamageOnSuccess,
    halfDamageOnFailure,
    reason
  };
}

function add2eDamageEquippedProjectile(lanceur, weapon, profile) {
  if (!lanceur || !weapon || profile?.isProjectilePropulse !== true) return null;
  try {
    return globalThis.add2eGetEquippedProjectileForWeapon?.(lanceur, weapon)
      ?? game?.add2e?.consumables?.add2eGetEquippedProjectileForWeapon?.(lanceur, weapon)
      ?? null;
  } catch (_error) {
    return null;
  }
}

async function add2eResolveMonkProjectileDeflection({ actor, lanceur, weapon } = {}) {
  const engine = globalThis.Add2eEffectsEngine ?? null;
  if (!actor || !weapon || !engine?.isMonk?.(actor) || !engine?.hasTag?.(actor, "moine:parade_projectiles")) {
    return { eligible: false, deflected: false, reason: "not-eligible" };
  }

  const profile = add2eGetCombatStatProfile(weapon);
  if (!profile?.isProjectilePropulse && !profile?.isLancer) {
    return { eligible: false, deflected: false, reason: "not-projectile", profile };
  }

  const projectile = add2eDamageEquippedProjectile(lanceur, weapon, profile);
  const magical = Boolean(engine?.looksMagical?.(weapon) || engine?.looksMagical?.(projectile));
  if (magical) {
    return { eligible: false, deflected: false, reason: "magical-projectile", profile, projectile, magical: true };
  }

  const save = await engine.rollActionSave(actor, "petrification", 0);
  const deflected = save?.canRoll === true && save?.success === true;
  return {
    eligible: true,
    deflected,
    reason: save?.canRoll === true ? (deflected ? "save-success" : "save-failure") : "save-unavailable",
    profile,
    projectile,
    magical: false,
    save
  };
}

async function add2eCreateMonkProjectileChat({ actor, weapon, projectile, save } = {}) {
  const projectileName = projectile?.name ?? weapon?.name ?? "projectile";
  const total = Number(save?.total);
  const threshold = Number(save?.threshold);
  const result = Number.isFinite(total) && Number.isFinite(threshold)
    ? `${total} contre ${threshold}`
    : "jet réussi";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="add2e-chat-card" style="border:1px solid #8b5e20;border-radius:9px;background:#fff7df;padding:.65em .8em;"><h3 style="margin:0 0 .35em 0;">Parade des projectiles</h3><p style="margin:.2em 0;"><b>${add2eDamageEscapeHtml(actor?.name ?? "Le moine")}</b> détourne <b>${add2eDamageEscapeHtml(projectileName)}</b>.</p><p style="margin:.2em 0;font-size:.9em;">Jet de protection contre la pétrification : <b>${add2eDamageEscapeHtml(result)}</b>.</p></div>`,
    flags: { add2e: { monkProjectileDeflection: true, weaponId: weapon?.id ?? null, projectileId: projectile?.id ?? null } }
  });
}

async function add2eResolveDamage(actor, amount, type, details) {
  const engine = globalThis.Add2eEffectsEngine;
  if (typeof engine?.resolveIncomingDamage !== "function") {
    ui.notifications.error("Moteur d'effets ADD2E indisponible : dégâts non appliqués.");
    return null;
  }
  return engine.resolveIncomingDamage(actor, { amount, type, details });
}

export async function add2eApplyDamage({
  cible,
  montant,
  type = "",
  details = "",
  source = null,
  sourceItem = null,
  lanceur = null,
  save = null
} = {}) {
  if (!cible) {
    ui.notifications.error("Pas de cible !");
    return null;
  }

  const originalDamage = Math.max(0, Number(montant) || 0);
  const actor = add2eDamageActor(cible);
  if (!actor) {
    ui.notifications.error("Acteur cible introuvable.");
    return null;
  }

  const damageSourceItem = add2eDamageSourceItem({ source, sourceItem, lanceur });
  const projectileDefense = save
    ? { eligible: false, deflected: false, reason: "save-damage-context" }
    : await add2eResolveMonkProjectileDeflection({ actor, lanceur, weapon: damageSourceItem });

  if (projectileDefense.deflected) {
    await add2eCreateMonkProjectileChat({
      actor,
      weapon: damageSourceItem,
      projectile: projectileDefense.projectile,
      save: projectileDefense.save
    });
    ui.notifications.info(`${actor.name} détourne le projectile et ne subit aucun dégât.`);
    return {
      amount: 0,
      original: originalDamage,
      applied: true,
      projectileDefense,
      saveResolution: null,
      reason: "monk-projectile-deflected"
    };
  }

  const saveResolution = add2eResolveSaveDamage(actor, originalDamage, save);
  const baseDamage = Math.max(0, Number(saveResolution.amount) || 0);
  if (baseDamage <= 0) {
    const message = saveResolution.reason === "monk-save-no-damage"
      ? `${actor.name} réussit sa sauvegarde de moine et ne subit aucun dégât.`
      : `${actor.name} ne subit aucun dégât.`;
    ui.notifications.info(message);
    return {
      amount: 0,
      original: originalDamage,
      applied: true,
      projectileDefense,
      saveResolution,
      reason: saveResolution.reason
    };
  }

  if (!game.user.isGM) {
    if (!game.socket) {
      ui.notifications.error("Socket Foundry indisponible (game.socket).");
      return null;
    }

    game.socket.emit("system.add2e", {
      type: "applyDamageFlag",
      tokenId: add2eDamageTokenId(cible),
      actorId: cible.actor?.id || cible.id,
      flagData: {
        montant: baseDamage,
        type,
        details,
        source: "attack",
        fromUserId: game.user.id,
        timestamp: Date.now()
      }
    });

    ui.notifications.info(`Dégâts (${baseDamage}) envoyés au MJ.`);
    return {
      amount: baseDamage,
      original: originalDamage,
      applied: true,
      delegated: true,
      projectileDefense,
      saveResolution
    };
  }

  const resolution = await add2eResolveDamage(actor, baseDamage, type, details);
  if (!resolution) return null;
  const damage = Math.max(0, Number(resolution.amount) || 0);

  const maxHP = Number(actor.system?.points_de_coup) || 0;
  let currentHP = actor.system?.pdv;
  if (currentHP === undefined || currentHP === null || currentHP === "" || Number.isNaN(Number(currentHP))) {
    currentHP = maxHP;
  } else {
    currentHP = Number(currentHP) || 0;
  }

  const newHP = currentHP - damage;
  await actor.update({ "system.pdv": newHP });

  if (typeof globalThis.add2eSyncActorVitalStatus === "function") {
    await globalThis.add2eSyncActorVitalStatus(actor, { reason: "damage" });
  }

  await add2eRunDamageResolutionOnUse({
    actor,
    cible,
    resolution,
    amount: baseDamage,
    type,
    details
  });

  ui.notifications.info(`${actor.name} prend ${damage} dégât(s).`);
  return {
    ...resolution,
    amount: damage,
    original: originalDamage,
    incomingAfterSave: baseDamage,
    projectileDefense,
    saveResolution
  };
}

globalThis.add2eApplyDamage = add2eApplyDamage;
globalThis.ADD2E_DAMAGE_VERSION = ADD2E_DAMAGE_VERSION;
