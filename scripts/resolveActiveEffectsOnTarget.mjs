/**
 * ADD2E — Résolution générique des protections, immunités et résistances.
 * Compatible Foundry V13/V14/V15.
 *
 * Usage manuel :
 *   await resolveActiveEffectsOnTarget(actor, "sommeil")
 *
 * Résolution automatique :
 *   tout ActiveEffect entrant portant des tags ADD2E est évalué avant création.
 *
 * Retour : { annulé, résiste, details, pct, jet, bonus }
 */

const ADD2E_INCOMING_EFFECT_RESOLUTION_VERSION = "2026-07-10-generic-incoming-active-effects-v1";

function add2eResolveEffectKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:*]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eResolveEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eResolveToArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eResolveToArray);
  if (value instanceof Set) return [...value].flatMap(add2eResolveToArray);
  if (typeof value === "string") {
    return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  }
  if (typeof value === "object") {
    for (const key of ["values", "items", "list", "tags", "effectTags", "value"]) {
      if (value[key] !== undefined) return add2eResolveToArray(value[key]);
    }
  }
  return [];
}

function add2eResolveRuleKind(rule) {
  return add2eResolveEffectKey(rule?.kind ?? rule?.type ?? "");
}

function add2eResolveWildcardMatch(value, pattern) {
  const candidate = add2eResolveEffectKey(value);
  const wanted = add2eResolveEffectKey(pattern);
  if (!candidate || !wanted) return false;
  if (!wanted.includes("*")) return candidate === wanted;
  const escaped = wanted
    .split("*")
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`).test(candidate);
}

function add2eResolvePatternsMatch(keys, patterns, excludedPatterns = []) {
  const values = [...(keys instanceof Set ? keys : new Set(keys ?? []))];
  const excluded = add2eResolveToArray(excludedPatterns).map(add2eResolveEffectKey).filter(Boolean);
  if (excluded.some(pattern => values.some(value => add2eResolveWildcardMatch(value, pattern)))) return false;

  const wanted = add2eResolveToArray(patterns).map(add2eResolveEffectKey).filter(Boolean);
  if (!wanted.length) return true;
  return wanted.some(pattern => values.some(value => add2eResolveWildcardMatch(value, pattern)));
}

function add2eResolveIncomingContext(effect, data = {}) {
  const engine = globalThis.Add2eEffectsEngine;
  const normalize = value => engine?.normalizeTag?.(value) ?? add2eResolveEffectKey(value);
  const tags = new Set();
  const keys = new Set();
  const addTags = raw => {
    for (const value of add2eResolveToArray(raw)) {
      const tag = normalize(value);
      if (tag) tags.add(tag);
    }
  };
  const addKey = raw => {
    for (const value of add2eResolveToArray(raw)) {
      const key = add2eResolveEffectKey(value);
      if (key) keys.add(key);
    }
  };

  const dataFlags = data?.flags?.add2e ?? {};
  const effectFlags = effect?.flags?.add2e ?? {};
  for (const raw of [
    dataFlags.tags,
    dataFlags.effectTags,
    effectFlags.tags,
    effectFlags.effectTags
  ]) addTags(raw);

  for (const raw of [
    dataFlags.effectType,
    dataFlags.effectTypes,
    dataFlags.conditionType,
    dataFlags.statusType,
    dataFlags.afflictionType,
    effectFlags.effectType,
    effectFlags.effectTypes,
    effectFlags.conditionType,
    effectFlags.statusType,
    effectFlags.afflictionType
  ]) addKey(raw);

  const prefixes = ["sort:", "effect:", "effet:", "etat:", "status:", "condition:", "affliction:"];
  for (const tag of tags) {
    const prefix = prefixes.find(entry => tag.startsWith(entry));
    if (!prefix) continue;
    const key = add2eResolveEffectKey(tag.slice(prefix.length));
    if (!key) continue;
    keys.add(key);
    tags.add(`effect:${key}`);
  }

  return {
    effect,
    data,
    tags,
    keys,
    name: String(data?.name ?? effect?.name ?? "Effet").trim() || "Effet"
  };
}

function add2eResolveRuleList(actor) {
  const engine = globalThis.Add2eEffectsEngine;
  if (!engine || !actor) return [];
  return [
    ...(engine.getActiveRules?.(actor) ?? []),
    ...(engine.getClassFeaturePassiveRules?.(actor) ?? [])
  ];
}

function add2eResolveRuleLevelMatches(rule) {
  const minimum = Number(rule?.minSourceLevel);
  if (!Number.isFinite(minimum)) return true;
  const level = Number(rule?.source?.classLevel);
  return Number.isFinite(level) && level >= minimum;
}

function add2eResolveRuleContextMatches(rule, context) {
  if (!add2eResolveRuleLevelMatches(rule)) return false;
  if (!add2eResolvePatternsMatch(
    context.keys,
    rule?.effectPatterns ?? rule?.effectTypes ?? rule?.effects ?? rule?.matches,
    rule?.excludePatterns ?? rule?.excludedEffectPatterns ?? rule?.notEffectPatterns
  )) return false;

  const engine = globalThis.Add2eEffectsEngine;
  if (typeof engine?.passiveRuleActionTagsMatch === "function") {
    return engine.passiveRuleActionTagsMatch(rule, context.tags);
  }
  return true;
}

function add2eResolveLegacyImmunity(actor, context) {
  const engine = globalThis.Add2eEffectsEngine;
  if (!actor || !engine) return null;
  const activeTags = engine.getActiveTags?.(actor) ?? [];

  for (const key of context.keys) {
    if (engine.hasImmunity?.(actor, key)) {
      return {
        blocked: true,
        kind: "immunity",
        key,
        label: `Immunité contre ${key.replaceAll("_", " ")}`,
        rule: null,
        pct: 100,
        roll: 0
      };
    }
    const tag = activeTags.find(value => value === `immunite:${key}` || value === `protection:${key}`);
    if (tag) {
      return {
        blocked: true,
        kind: tag.startsWith("protection:") ? "protection" : "immunity",
        key,
        label: tag.startsWith("protection:") ? `Protection contre ${key.replaceAll("_", " ")}` : `Immunité contre ${key.replaceAll("_", " ")}`,
        rule: null,
        pct: 100,
        roll: 0
      };
    }
  }
  return null;
}

function add2eResolvePercent(rule, actor) {
  const engine = globalThis.Add2eEffectsEngine;
  const value = typeof engine?.getPassiveRuleNumber === "function"
    ? engine.getPassiveRuleNumber(rule, {
        actor,
        actorLevel: engine.getActorLevel?.(actor),
        classLevel: Number(rule?.source?.classLevel) || null
      })
    : Number(rule?.value ?? rule?.percent ?? rule?.pct);
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function add2eResolveD100() {
  const random = typeof CONFIG?.Dice?.randomUniform === "function"
    ? CONFIG.Dice.randomUniform()
    : Math.random();
  return Math.max(1, Math.min(100, Math.floor(Number(random) * 100) + 1));
}

function add2eResolveIncomingActiveEffect(actor, context) {
  if (!actor || !context) {
    return { blocked: false, kind: "none", pct: 0, roll: 0, rule: null, context };
  }

  const rules = add2eResolveRuleList(actor);

  for (const rule of rules) {
    if (add2eResolveRuleKind(rule) !== "incoming_effect_immunity") continue;
    if (!add2eResolveRuleContextMatches(rule, context)) continue;
    return {
      blocked: true,
      kind: "immunity",
      pct: 100,
      roll: 0,
      rule,
      label: String(rule?.label ?? rule?.source?.featureName ?? rule?.source?.effectName ?? "Immunité"),
      context
    };
  }

  const legacy = add2eResolveLegacyImmunity(actor, context);
  if (legacy) return { ...legacy, context };

  const candidates = [];
  for (const rule of rules) {
    if (add2eResolveRuleKind(rule) !== "incoming_effect_resistance") continue;
    if (!add2eResolveRuleContextMatches(rule, context)) continue;
    const pct = add2eResolvePercent(rule, actor);
    if (pct <= 0) continue;
    candidates.push({ rule, pct });
  }

  if (!candidates.length) {
    return { blocked: false, kind: "none", pct: 0, roll: 0, rule: null, context };
  }

  const selected = candidates.sort((left, right) => right.pct - left.pct)[0];
  const roll = add2eResolveD100();
  const blocked = roll <= selected.pct;
  return {
    blocked,
    kind: "resistance",
    pct: selected.pct,
    roll,
    rule: selected.rule,
    label: String(selected.rule?.label ?? selected.rule?.source?.featureName ?? selected.rule?.source?.effectName ?? "Résistance"),
    context
  };
}

function add2eResolvePostIncomingResult(actor, result) {
  if (!actor || !result || result.kind === "none") return;
  const effectName = result.context?.name ?? "Effet";
  const blockedText = result.blocked ? "annulé" : "appliqué";
  const detail = result.kind === "resistance"
    ? `Résistance ${result.pct}% — jet ${result.roll} : effet ${blockedText}.`
    : `L’effet est annulé par ${result.label ?? "une immunité active"}.`;
  const border = result.blocked ? "#2f8f46" : "#b36b2e";

  Promise.resolve().then(() => ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="add2e-chat-card" style="border:1px solid ${border};border-radius:8px;padding:8px;">
      <div style="font-weight:900;color:${border};">${add2eResolveEscapeHtml(result.label ?? "Défense passive")}</div>
      <div><b>${add2eResolveEscapeHtml(actor.name)}</b> — ${add2eResolveEscapeHtml(effectName)}</div>
      <div>${add2eResolveEscapeHtml(detail)}</div>
    </div>`,
    flags: {
      add2e: {
        incomingEffectResolution: true,
        version: ADD2E_INCOMING_EFFECT_RESOLUTION_VERSION,
        blocked: result.blocked,
        kind: result.kind,
        pct: result.pct,
        roll: result.roll
      }
    }
  })).catch(error => {
    console.warn("[ADD2E][INCOMING_EFFECT][CHAT_ERROR]", error);
  });
}

function add2eResolveEffectParentActor(effect) {
  const parent = effect?.parent ?? null;
  if (parent?.documentName === "Actor") return parent;
  if (parent?.actor?.documentName === "Actor") return parent.actor;
  return null;
}

function add2eIncomingEffectShouldBypass(effect, data = {}, options = {}) {
  if (options?.add2eSkipIncomingEffectResolution === true) return true;
  const sources = [data?.flags?.add2e, effect?.flags?.add2e].filter(flags => flags && typeof flags === "object");
  return sources.some(flags => (
    flags.autoClassPassiveEffect === true
    || flags.classPassiveFeatureEffect === true
    || flags.racial === true
    || flags.incomingEffectResolutionBypass === true
  ));
}

async function resolveActiveEffectsOnTarget(actor, effectType) {
  if (!actor) {
    return { annulé: false, résiste: false, details: "Aucune cible", pct: 0, jet: 0, bonus: 0 };
  }

  const engine = globalThis.Add2eEffectsEngine;
  const type = String(effectType ?? "").trim() || "effet";
  const key = add2eResolveEffectKey(type);
  if (!engine?.getActiveTags) {
    return { annulé: false, résiste: false, details: "Effects Engine indisponible", pct: 0, jet: 0, bonus: 0 };
  }

  const context = {
    effect: null,
    data: null,
    tags: new Set([`effect:${key}`]),
    keys: new Set([key]),
    name: type
  };
  const incoming = add2eResolveIncomingActiveEffect(actor, context);
  if (incoming.kind !== "none") {
    add2eResolvePostIncomingResult(actor, incoming);
    return {
      annulé: incoming.blocked,
      résiste: incoming.kind === "resistance" && incoming.blocked,
      details: incoming.kind === "resistance"
        ? `${incoming.label} : ${incoming.pct}% — jet ${incoming.roll}`
        : incoming.label,
      pct: incoming.pct,
      jet: incoming.roll,
      bonus: 0
    };
  }

  const tags = engine.getActiveTags(actor);
  if (engine.hasImmunity?.(actor, key) || tags.includes(`protection:${key}`)) {
    const result = {
      annulé: true,
      résiste: false,
      details: `Immunité ou protection contre ${type}`,
      pct: 100,
      jet: 0,
      bonus: 0
    };
    globalThis.add2eLastResistanceRoll = {
      found: true,
      immunise: true,
      resiste: true,
      type,
      matchedType: key,
      tag: tags.find(tag => tag === `immunite:${key}` || tag === `protection:${key}`) ?? `immunite:${key}`,
      pct: 100,
      jet: 0,
      details: result.details
    };
    return result;
  }

  const resistance = engine.checkResistanceDetails?.(actor, type, { chat: false })
    ?? { found: false, manual: false, resiste: false, pct: 0, jet: 0, details: "" };
  if (resistance.immunise) {
    return {
      annulé: true,
      résiste: false,
      details: resistance.details,
      pct: 100,
      jet: 0,
      bonus: 0
    };
  }
  if (resistance.found) {
    const result = {
      annulé: false,
      résiste: !!resistance.resiste,
      details: resistance.details,
      pct: Number(resistance.pct) || 0,
      jet: Number(resistance.jet) || 0,
      bonus: 0
    };
    if (typeof ChatMessage !== "undefined") {
      const color = result.résiste ? "#2f8f46" : "#b33a2e";
      const label = result.résiste ? "RÉSISTANCE RÉUSSIE" : "RÉSISTANCE ÉCHOUÉE";
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="add2e-chat-card" style="border:1px solid ${color};border-radius:8px;padding:8px;">
          <div style="font-weight:900;color:${color};">${label}</div>
          <div><b>${add2eResolveEscapeHtml(actor.name)}</b> contre <b>${add2eResolveEscapeHtml(type)}</b></div>
          <div>Résistance : <b>${result.pct}%</b> — jet <b>${result.jet}</b></div>
        </div>`
      });
    }
    return result;
  }

  const bonus = Number(engine.getSaveBonus?.(actor, type) ?? (
    Number(engine.getSaveBonusVs?.(actor, type) || 0)
    + Number(engine.getBonusSaveConstitution?.(actor, type) || 0)
  )) || 0;
  const category = engine.getSaveCategory?.(type) ?? key;
  const manual = engine.getResistanceInfo?.(actor, type)?.manual === true;
  const details = manual
    ? `Résistance à ${type} à appliquer selon la règle de campagne. ${bonus ? `Bonus de sauvegarde ${bonus >= 0 ? "+" : ""}${bonus}` : ""}`.trim()
    : (bonus
      ? `Bonus de sauvegarde (${category}) ${bonus >= 0 ? "+" : ""}${bonus}`
      : `Aucune immunité ni résistance active contre ${type}`);

  return {
    annulé: false,
    résiste: false,
    details,
    pct: 0,
    jet: 0,
    bonus
  };
}

if (!globalThis.ADD2E_INCOMING_EFFECT_HOOK_REGISTERED) {
  globalThis.ADD2E_INCOMING_EFFECT_HOOK_REGISTERED = true;
  Hooks.on("preCreateActiveEffect", (effect, data, options, userId) => {
    if (userId && game.user?.id && userId !== game.user.id) return true;
    if (add2eIncomingEffectShouldBypass(effect, data, options)) return true;

    const actor = add2eResolveEffectParentActor(effect);
    if (!actor) return true;

    const context = add2eResolveIncomingContext(effect, data);
    if (!context.keys.size) return true;

    const result = add2eResolveIncomingActiveEffect(actor, context);
    if (result.kind === "none") return true;

    add2eResolvePostIncomingResult(actor, result);
    return result.blocked ? false : true;
  });
}

window.resolveActiveEffectsOnTarget = resolveActiveEffectsOnTarget;
globalThis.resolveActiveEffectsOnTarget = resolveActiveEffectsOnTarget;
globalThis.add2eResolveIncomingActiveEffect = add2eResolveIncomingActiveEffect;
globalThis.ADD2E_INCOMING_EFFECT_RESOLUTION_VERSION = ADD2E_INCOMING_EFFECT_RESOLUTION_VERSION;
