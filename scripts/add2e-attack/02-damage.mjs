// scripts/add2e-attack/02-damage.mjs
// ADD2E — Application des dégâts via Add2eEffectsEngine.

import { add2eGetCombatStatProfile } from "./03-attack-rules.mjs";

export const ADD2E_DAMAGE_VERSION = "2026-07-10-generic-incoming-damage-rules-v1";

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
  if (sourceItem?.system) return sourceItem;
  if (source?.system) return source;
  const key = String(source ?? "").trim();
  if (!key || !lanceur) return null;
  return lanceur.items?.get?.(key)
    ?? Array.from(lanceur.items ?? []).find(item => item?.name === key)
    ?? null;
}

function add2eDamageRuleList(actor) {
  const engine = globalThis.Add2eEffectsEngine;
  if (!engine || !actor) return [];
  return [
    ...(engine.getActiveRules?.(actor) ?? []),
    ...(engine.getClassFeaturePassiveRules?.(actor) ?? [])
  ];
}

function add2eDamageRuleLevelMatches(rule) {
  const minimum = Number(rule?.minSourceLevel);
  if (!Number.isFinite(minimum)) return true;
  const level = Number(rule?.source?.classLevel);
  return Number.isFinite(level) && level >= minimum;
}

function add2eDamageRuleTagsMatch(rule, tags) {
  const engine = globalThis.Add2eEffectsEngine;
  return typeof engine?.passiveRuleActionTagsMatch !== "function"
    || engine.passiveRuleActionTagsMatch(rule, tags);
}

function add2eDamageLooksMagical(item) {
  const engine = globalThis.Add2eEffectsEngine;
  return !!item && typeof engine?.looksMagical === "function" && engine.looksMagical(item);
}

function add2eDamageEquippedProjectile(lanceur, sourceItem, profile) {
  if (!lanceur || !sourceItem || profile?.isProjectilePropulse !== true) return null;
  return globalThis.add2eGetEquippedProjectileForWeapon?.(lanceur, sourceItem)
    ?? game?.add2e?.consumables?.add2eGetEquippedProjectileForWeapon?.(lanceur, sourceItem)
    ?? null;
}

function add2eBuildIncomingDamageContext({ lanceur, sourceItem, type, actionTags = [] } = {}) {
  const engine = globalThis.Add2eEffectsEngine;
  const normalize = value => engine?.normalizeTag?.(value) ?? add2eDamageNormalize(value);
  const tags = new Set((engine?.toArray?.(actionTags) ?? actionTags ?? []).map(normalize).filter(Boolean));
  const profile = sourceItem ? add2eGetCombatStatProfile(sourceItem) : null;
  for (const tag of profile?.tags ?? []) tags.add(normalize(tag));

  const projectileAttack = profile?.isProjectilePropulse === true || profile?.isLancer === true;
  if (projectileAttack) tags.add("attack:projectile");
  if (profile?.isProjectilePropulse) tags.add("attack:projectile_propulse");
  if (profile?.isLancer) tags.add("attack:projectile_lance");

  const projectile = add2eDamageEquippedProjectile(lanceur, sourceItem, profile);
  const magical = add2eDamageLooksMagical(sourceItem) || add2eDamageLooksMagical(projectile);
  if (sourceItem) tags.add(magical ? "attack:magical" : "attack:nonmagical");
  if (type) tags.add(`damage:${normalize(type)}`);

  return { tags, sourceItem, projectile, magical };
}

function add2eDamageSaveSucceeded(save) {
  if (typeof save === "boolean") return save;
  if (typeof save?.success === "boolean") return save.success;
  if (typeof save?.saved === "boolean") return save.saved;
  return false;
}

function add2eDamageMultiplier(value, fallback) {
  const multiplier = Number(value);
  return Number.isFinite(multiplier) && multiplier >= 0 ? multiplier : fallback;
}

function add2eDamageRuleMessage(template, actor, context) {
  const source = context.projectile?.name ?? context.sourceItem?.name ?? "l'attaque";
  return String(template ?? "")
    .replaceAll("{target}", String(actor?.name ?? "La cible"))
    .replaceAll("{source}", String(source));
}

async function add2eDamagePostRuleMessage(actor, rule, success, context) {
  const template = success ? rule?.successMessage : rule?.failureMessage;
  if (!template) return;
  const label = String(rule?.label ?? "Règle défensive");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="add2e-chat-card" style="border:1px solid #8b5e20;border-radius:9px;background:#fff7df;padding:.65em .8em;"><h3 style="margin:0 0 .35em 0;">${add2eDamageEscapeHtml(label)}</h3><p style="margin:.2em 0;">${add2eDamageEscapeHtml(add2eDamageRuleMessage(template, actor, context))}</p></div>`,
    flags: { add2e: { genericIncomingDamageRule: true, ruleKind: rule?.kind ?? "" } }
  });
}

async function add2eResolveGenericIncomingDamage(actor, original, options = {}) {
  const initial = Math.max(0, Number(original) || 0);
  const context = add2eBuildIncomingDamageContext(options);
  const rules = add2eDamageRuleList(actor);
  const events = [];
  let amount = initial;

  if (options.save) {
    const success = add2eDamageSaveSucceeded(options.save);
    const defaultMultiplier = success
      ? add2eDamageMultiplier(options.save.successMultiplier, 1)
      : add2eDamageMultiplier(options.save.failureMultiplier, 1);
    amount = Math.floor(initial * defaultMultiplier);

    for (const rule of rules) {
      if (add2eDamageNormalize(rule?.kind) !== "save_damage_override") continue;
      if (!add2eDamageRuleLevelMatches(rule) || !add2eDamageRuleTagsMatch(rule, context.tags)) continue;
      const outcome = add2eDamageNormalize(rule?.outcome ?? "any");
      if (outcome === "success" && !success) continue;
      if (outcome === "failure" && success) continue;
      const multiplier = add2eDamageMultiplier(rule?.multiplier, defaultMultiplier);
      amount = rule?.mode === "replace"
        ? Math.floor(initial * multiplier)
        : Math.min(amount, Math.floor(initial * multiplier));
      events.push({ rule, success, multiplier });
    }
  }

  for (const rule of rules) {
    if (add2eDamageNormalize(rule?.kind) !== "incoming_damage_save") continue;
    if (!add2eDamageRuleLevelMatches(rule) || !add2eDamageRuleTagsMatch(rule, context.tags)) continue;
    const engine = globalThis.Add2eEffectsEngine;
    if (typeof engine?.rollActionSave !== "function") continue;
    const save = await engine.rollActionSave(actor, rule.saveType ?? "sorts", Number(rule.saveBonus) || 0);
    if (!save?.canRoll) continue;
    const multiplier = save.success
      ? add2eDamageMultiplier(rule.successMultiplier, 0)
      : add2eDamageMultiplier(rule.failureMultiplier, 1);
    amount = rule?.mode === "replace"
      ? Math.floor(initial * multiplier)
      : Math.min(amount, Math.floor(initial * multiplier));
    events.push({ rule, success: save.success, multiplier, save });
    await add2eDamagePostRuleMessage(actor, rule, save.success, context);
  }

  return { amount: Math.max(0, amount), original: initial, events, context };
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
  save = null,
  actionTags = []
} = {}) {
  if (!cible) {
    ui.notifications.error("Pas de cible !");
    return null;
  }

  const actor = add2eDamageActor(cible);
  if (!actor) {
    ui.notifications.error("Acteur cible introuvable.");
    return null;
  }

  const originalDamage = Math.max(0, Number(montant) || 0);
  const resolvedSourceItem = add2eDamageSourceItem({ source, sourceItem, lanceur });
  const genericResolution = await add2eResolveGenericIncomingDamage(actor, originalDamage, {
    lanceur,
    sourceItem: resolvedSourceItem,
    type,
    save,
    actionTags
  });
  const baseDamage = genericResolution.amount;

  if (baseDamage <= 0) {
    ui.notifications.info(`${actor.name} ne subit aucun dégât.`);
    return { amount: 0, original: originalDamage, applied: true, genericResolution };
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
    return { amount: baseDamage, original: originalDamage, applied: true, delegated: true, genericResolution };
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
  return { ...resolution, amount: damage, original: originalDamage, genericResolution };
}

globalThis.add2eApplyDamage = add2eApplyDamage;
globalThis.ADD2E_DAMAGE_VERSION = ADD2E_DAMAGE_VERSION;
