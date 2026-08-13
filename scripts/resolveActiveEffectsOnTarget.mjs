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

const ADD2E_INCOMING_EFFECT_RESOLUTION_VERSION = "2026-08-13-generic-incoming-active-effects-v5";

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

const ADD2E_EFFECTIVE_ABILITY_RULE_KINDS = new Set([
  "effective_ability_floor",
  "contextual_ability_floor",
  "ability_floor"
]);

function add2eResolveAbilityKey(value) {
  const key = add2eResolveEffectKey(value);
  const aliases = {
    for: "force",
    str: "force",
    strength: "force",
    dex: "dexterite",
    dexterity: "dexterite",
    con: "constitution",
    int: "intelligence",
    intel: "intelligence",
    wis: "sagesse",
    wisdom: "sagesse",
    sag: "sagesse",
    cha: "charisme",
    charisma: "charisme"
  };
  return aliases[key] ?? key;
}

function add2eResolveGetProperty(object, path) {
  if (!object || !path) return undefined;
  try {
    if (typeof foundry?.utils?.getProperty === "function") return foundry.utils.getProperty(object, path);
  } catch (_error) {}
  return String(path).split(".").reduce((current, part) => current?.[part], object);
}

function add2eResolveStrictNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "object") {
    for (const key of ["value", "current", "total", "base", "actuel"]) {
      const nested = add2eResolveStrictNumber(value?.[key]);
      if (Number.isFinite(nested)) return nested;
    }
    return null;
  }
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function add2eResolveActorAbilityValue(actor, ability) {
  const key = add2eResolveAbilityKey(ability);
  if (!actor || !key) return null;
  const system = actor.system ?? {};
  const short = {
    force: "for",
    dexterite: "dex",
    constitution: "con",
    intelligence: "int",
    sagesse: "sag",
    charisme: "cha"
  }[key] ?? "";

  const directPaths = [
    key,
    `${key}.value`,
    `abilities.${key}.value`,
    `attributes.${key}.value`,
    short,
    short ? `${short}.value` : "",
    short ? `abilities.${short}.value` : "",
    short ? `attributes.${short}.value` : ""
  ].filter(Boolean);

  for (const path of directPaths) {
    const value = add2eResolveStrictNumber(add2eResolveGetProperty(system, path));
    if (Number.isFinite(value)) return value;
  }

  const componentPaths = [
    `${key}_base`,
    `${key}_race`,
    `${key}_bonus`,
    `bonus_caracteristiques.${key}`,
    `bonus_divers_caracteristiques.${key}`
  ];
  let found = false;
  let total = 0;
  for (const path of componentPaths) {
    const value = add2eResolveStrictNumber(add2eResolveGetProperty(system, path));
    if (!Number.isFinite(value)) continue;
    found = true;
    total += value;
  }
  return found ? total : null;
}

function add2eResolveAbilityContext(context = {}) {
  if (context?.keys instanceof Set && context?.tags instanceof Set) return context;
  const effectTypes = [
    context?.effectType,
    context?.effectTypes,
    context?.type,
    context?.kind,
    context?.attackType
  ];
  return add2eResolveIncomingContext(null, {
    name: context?.name ?? context?.label ?? "Contexte",
    flags: {
      add2e: {
        tags: context?.tags ?? context?.actionTags ?? [],
        effectTypes
      }
    }
  });
}

function add2eResolveRuleAbility(rule) {
  return add2eResolveAbilityKey(rule?.ability ?? rule?.characteristic ?? rule?.caracteristique ?? rule?.stat ?? "");
}

function add2eResolveEffectiveAbility(actor, ability, context = {}) {
  const key = add2eResolveAbilityKey(ability);
  const normalizedContext = add2eResolveAbilityContext(context);
  const base = add2eResolveActorAbilityValue(actor, key);
  const engine = globalThis.Add2eEffectsEngine;
  const candidates = [];

  for (const rule of add2eResolveRuleList(actor)) {
    if (!ADD2E_EFFECTIVE_ABILITY_RULE_KINDS.has(add2eResolveRuleKind(rule))) continue;
    if (add2eResolveRuleAbility(rule) !== key) continue;
    if (!add2eResolveRuleContextMatches(rule, normalizedContext)) continue;
    const rawValue = typeof engine?.getPassiveRuleNumber === "function"
      ? engine.getPassiveRuleNumber(rule, {
          actor,
          actorLevel: engine.getActorLevel?.(actor),
          classLevel: Number(rule?.source?.classLevel) || null
        })
      : Number(rule?.value ?? rule?.floor ?? rule?.minimum);
    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;
    candidates.push({
      value,
      rule,
      label: String(rule?.label ?? rule?.source?.featureName ?? rule?.source?.effectName ?? "Valeur effective")
    });
  }

  const selected = candidates.sort((left, right) => right.value - left.value)[0] ?? null;
  const effective = selected
    ? (Number.isFinite(base) ? Math.max(base, selected.value) : selected.value)
    : base;
  return {
    ability: key,
    base,
    effective,
    applied: !!selected && Number.isFinite(effective) && (!Number.isFinite(base) || effective > base),
    rule: selected?.rule ?? null,
    label: selected?.label ?? "",
    context: normalizedContext
  };
}

function add2eResolveContextualEffectiveAbilities(actor, context = {}) {
  const normalizedContext = add2eResolveAbilityContext(context);
  const abilities = new Set();
  for (const rule of add2eResolveRuleList(actor)) {
    if (!ADD2E_EFFECTIVE_ABILITY_RULE_KINDS.has(add2eResolveRuleKind(rule))) continue;
    if (!add2eResolveRuleContextMatches(rule, normalizedContext)) continue;
    const ability = add2eResolveRuleAbility(rule);
    if (ability) abilities.add(ability);
  }
  return Object.fromEntries(
    [...abilities].map(ability => [ability, add2eResolveEffectiveAbility(actor, ability, normalizedContext)])
  );
}

function add2eSerializeEffectiveAbilities(results = {}) {
  return Object.fromEntries(Object.entries(results).map(([ability, result]) => [ability, {
    ability,
    base: Number.isFinite(result?.base) ? result.base : null,
    effective: Number.isFinite(result?.effective) ? result.effective : null,
    applied: result?.applied === true,
    label: String(result?.label ?? "")
  }]));
}

function add2eResolvePostEffectiveAbilities(actor, context, results = {}) {
  const applied = Object.values(results).filter(result => result?.applied === true && Number.isFinite(result?.effective));
  if (!actor || !applied.length) return;
  const details = applied.map(result => {
    const label = result.ability.charAt(0).toUpperCase() + result.ability.slice(1);
    return `${label} effective : ${result.effective}${Number.isFinite(result.base) ? ` (valeur réelle ${result.base})` : ""}`;
  }).join(" — ");
  Promise.resolve().then(() => ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="add2e-chat-card" style="border:1px solid #4c5f9e;border-radius:8px;padding:8px;">
      <div style="font-weight:900;color:#4c5f9e;">${add2eResolveEscapeHtml(applied[0]?.label || "Défense contextuelle")}</div>
      <div><b>${add2eResolveEscapeHtml(actor.name)}</b> — ${add2eResolveEscapeHtml(context?.name ?? "Effet")}</div>
      <div>${add2eResolveEscapeHtml(details)}</div>
    </div>`,
    flags: {
      add2e: {
        effectiveAbilityResolution: true,
        version: ADD2E_INCOMING_EFFECT_RESOLUTION_VERSION,
        abilities: add2eSerializeEffectiveAbilities(results)
      }
    }
  })).catch(error => console.warn("[ADD2E][EFFECTIVE_ABILITY][CHAT_ERROR]", error));
}

function add2eInstallEffectiveAbilityContract() {
  const engine = globalThis.Add2eEffectsEngine;
  if (!engine) return false;
  Object.defineProperties(engine, {
    getEffectiveAbility: {
      configurable: true,
      writable: true,
      value(actor, ability, context = {}) {
        return add2eResolveEffectiveAbility(actor, ability, context);
      }
    },
    getContextualEffectiveAbilities: {
      configurable: true,
      writable: true,
      value(actor, context = {}) {
        return add2eResolveContextualEffectiveAbilities(actor, context);
      }
    }
  });
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
    return { blocked: false, kind: "none", pct: 0, roll: 0, rule: null, effectiveAbilities: {}, context };
  }

  const rules = add2eResolveRuleList(actor);
  const effectiveAbilities = add2eResolveContextualEffectiveAbilities(actor, context);

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
      effectiveAbilities,
      context
    };
  }

  const legacy = add2eResolveLegacyImmunity(actor, context);
  if (legacy) return { ...legacy, effectiveAbilities, context };

  const candidates = [];
  for (const rule of rules) {
    if (add2eResolveRuleKind(rule) !== "incoming_effect_resistance") continue;
    if (!add2eResolveRuleContextMatches(rule, context)) continue;
    const pct = add2eResolvePercent(rule, actor);
    if (pct <= 0) continue;
    candidates.push({ rule, pct });
  }

  if (!candidates.length) {
    return { blocked: false, kind: "none", pct: 0, roll: 0, rule: null, effectiveAbilities, context };
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
    effectiveAbilities,
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

const ADD2E_LIGHT_DARKNESS_FAMILY_KEYS = new Set([
  "lumiere",
  "lumiere_eternelle",
  "tenebres",
  "tenebres_sur_5_metres",
  "tenebres_eternelles"
]);

function add2eLightDarknessResponsibleGM() {
  if (game.user?.isGM !== true) return false;
  const activeGMs = Array.from(game.users ?? [])
    .filter(user => user?.isGM && user?.active)
    .sort((left, right) => String(left.id ?? "").localeCompare(String(right.id ?? "")));
  return activeGMs[0]?.id === game.user.id;
}

function add2eLightDarknessTags(effect) {
  const flags = effect?.flags?.add2e ?? {};
  return add2eResolveToArray(flags.tags ?? flags.effectTags)
    .map(add2eResolveEffectKey)
    .filter(Boolean);
}

function add2eLightDarknessSpellKey(effect) {
  const flags = effect?.flags?.add2e ?? {};
  const direct = add2eResolveEffectKey(flags.spellKey ?? "");
  if (ADD2E_LIGHT_DARKNESS_FAMILY_KEYS.has(direct)) return direct;
  const tag = add2eLightDarknessTags(effect).find(value => value.startsWith("sort:"));
  const fromTag = add2eResolveEffectKey(tag?.slice(5) ?? "");
  return ADD2E_LIGHT_DARKNESS_FAMILY_KEYS.has(fromTag) ? fromTag : "";
}

function add2eLightDarknessKind(effect) {
  const key = add2eLightDarknessSpellKey(effect);
  if (key === "lumiere") return "light";
  if (key === "lumiere_eternelle") return "eternal-light";
  if (key === "tenebres_eternelles") return "eternal-darkness";
  if (key === "tenebres" || key === "tenebres_sur_5_metres") return "temporary-darkness";
  return "";
}

function add2eLightDarknessScene(effect) {
  const payload = effect?.flags?.add2e?.lightPayload ?? null;
  const sceneId = String(payload?.sceneId ?? "").trim();
  return sceneId ? game.scenes?.get(sceneId) ?? null : null;
}

function add2eLightDarknessMetersPerUnit(scene) {
  const unit = String(scene?.grid?.units ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const factors = new Map([
    ["m", 1], ["metre", 1], ["metres", 1], ["meter", 1], ["meters", 1],
    ["km", 1000], ["kilometre", 1000], ["kilometres", 1000], ["kilometer", 1000], ["kilometers", 1000],
    ["cm", 0.01], ["centimetre", 0.01], ["centimetres", 0.01], ["centimeter", 0.01], ["centimeters", 0.01],
    ["ft", 0.3048], ["foot", 0.3048], ["feet", 0.3048], ["pied", 0.3048], ["pieds", 0.3048],
    ["yd", 0.9144], ["yard", 0.9144], ["yards", 0.9144]
  ]);
  return factors.get(unit) ?? null;
}

function add2eLightDarknessRadiusPixels(effect, scene) {
  const radiusMeters = Number(effect?.flags?.add2e?.radiusMeters);
  const gridDistance = Number(scene?.grid?.distance);
  const gridSize = Number(scene?.grid?.size);
  const metersPerUnit = add2eLightDarknessMetersPerUnit(scene);
  if (!(radiusMeters > 0) || !(gridDistance > 0) || !(gridSize > 0) || !(metersPerUnit > 0)) return null;
  const sceneUnits = radiusMeters / metersPerUnit;
  return (sceneUnits / gridDistance) * gridSize;
}

function add2eLightDarknessPoint(effect, scene) {
  const payload = effect?.flags?.add2e?.lightPayload ?? null;
  if (!payload) return null;

  const x = Number(payload.x);
  const y = Number(payload.y);
  if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };

  const tokenId = String(payload.tokenId ?? "").trim();
  if (!tokenId) return null;
  const tokenDoc = scene?.tokens?.get?.(tokenId) ?? null;
  if (!tokenDoc) return null;
  const gridSize = Number(scene?.grid?.size);
  if (!(gridSize > 0)) return null;
  const width = Math.max(1, Number(tokenDoc.width) || 1) * gridSize;
  const height = Math.max(1, Number(tokenDoc.height) || 1) * gridSize;
  const tokenX = Number(tokenDoc.x);
  const tokenY = Number(tokenDoc.y);
  if (!Number.isFinite(tokenX) || !Number.isFinite(tokenY)) return null;
  return { x: tokenX + (width / 2), y: tokenY + (height / 2) };
}

function add2eLightDarknessDescriptor(effect) {
  if (!effect || effect.disabled === true) return null;
  const kind = add2eLightDarknessKind(effect);
  if (!kind) return null;
  const scene = add2eLightDarknessScene(effect);
  if (!scene) return null;
  const point = add2eLightDarknessPoint(effect, scene);
  const radiusPixels = add2eLightDarknessRadiusPixels(effect, scene);
  if (!point || !(radiusPixels > 0)) return null;
  return {
    effect,
    actor: add2eResolveEffectParentActor(effect),
    kind,
    spellKey: add2eLightDarknessSpellKey(effect),
    scene,
    point,
    radiusPixels
  };
}

function add2eLightDarknessActors(scene) {
  const actors = new Map();
  for (const actor of game.actors ?? []) {
    const key = actor?.uuid ?? actor?.id;
    if (key) actors.set(key, actor);
  }
  for (const tokenDoc of scene?.tokens ?? []) {
    const actor = tokenDoc?.actor ?? null;
    const key = actor?.uuid ?? actor?.id;
    if (key) actors.set(key, actor);
  }
  return [...actors.values()];
}

function add2eLightDarknessExistingDescriptors(scene, incomingEffect) {
  const descriptors = [];
  for (const actor of add2eLightDarknessActors(scene)) {
    for (const effect of actor?.effects ?? []) {
      if (!effect || effect.id === incomingEffect?.id && effect.parent === incomingEffect?.parent) continue;
      const descriptor = add2eLightDarknessDescriptor(effect);
      if (!descriptor || descriptor.scene.id !== scene.id) continue;
      descriptors.push(descriptor);
    }
  }
  return descriptors;
}

function add2eLightDarknessDirectConflict(left, right) {
  if (!left || !right || left.scene?.id !== right.scene?.id) return false;
  const distance = Math.hypot(left.point.x - right.point.x, left.point.y - right.point.y);
  return distance <= (left.radiusPixels + right.radiusPixels) + 0.1;
}

async function add2eLightDarknessDeleteEffect(descriptor, reason) {
  const effect = descriptor?.effect ?? null;
  const actor = descriptor?.actor ?? add2eResolveEffectParentActor(effect);
  if (!effect?.id || !actor?.deleteEmbeddedDocuments) return false;
  if (!actor.effects?.get?.(effect.id)) return true;
  await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id], {
    add2eLightDarknessResolution: true,
    add2eReason: reason
  });
  return !actor.effects?.get?.(effect.id);
}

async function add2eResolveLightDarknessInteraction(effect) {
  if (!add2eLightDarknessResponsibleGM()) return { resolved: false, reason: "not-responsible-gm" };
  const incoming = add2eLightDarknessDescriptor(effect);
  if (!incoming) return { resolved: false, reason: "not-light-darkness-family" };

  const conflicts = add2eLightDarknessExistingDescriptors(incoming.scene, effect)
    .filter(existing => add2eLightDarknessDirectConflict(incoming, existing));
  if (!conflicts.length) return { resolved: false, reason: "no-direct-conflict" };

  const deleteExisting = [];
  if (incoming.kind === "light" || incoming.kind === "eternal-light") {
    deleteExisting.push(...conflicts.filter(existing => existing.kind === "temporary-darkness" || existing.kind === "eternal-darkness"));
  } else if (incoming.kind === "temporary-darkness") {
    deleteExisting.push(...conflicts.filter(existing => existing.kind === "light"));
  } else if (incoming.kind === "eternal-darkness") {
    deleteExisting.push(...conflicts.filter(existing => existing.kind === "light" || existing.kind === "eternal-light"));
  }

  const unique = new Map();
  for (const descriptor of deleteExisting) {
    const key = `${descriptor.actor?.uuid ?? descriptor.actor?.id ?? "actor"}:${descriptor.effect?.id ?? "effect"}`;
    unique.set(key, descriptor);
  }

  let deleted = 0;
  for (const descriptor of unique.values()) {
    const ok = await add2eLightDarknessDeleteEffect(descriptor, `light-darkness-conflict:${incoming.spellKey}`);
    if (ok) deleted += 1;
  }

  if (deleted) {
    console.info("[ADD2E][LIGHT_DARKNESS][RESOLVED]", {
      incoming: incoming.spellKey,
      effectId: effect.id,
      sceneId: incoming.scene.id,
      deleted
    });
  }
  return { resolved: deleted > 0, deleted };
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
  const effectiveAbilities = incoming.effectiveAbilities ?? {};
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
      bonus: 0,
      effectiveAbilities
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
      bonus: 0,
      effectiveAbilities
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
      bonus: 0,
      effectiveAbilities
    };
  }
  if (resistance.found) {
    const result = {
      annulé: false,
      résiste: !!resistance.resiste,
      details: resistance.details,
      pct: Number(resistance.pct) || 0,
      jet: Number(resistance.jet) || 0,
      bonus: 0,
      effectiveAbilities
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
  const baseDetails = manual
    ? `Résistance à ${type} à appliquer selon la règle de campagne. ${bonus ? `Bonus de sauvegarde ${bonus >= 0 ? "+" : ""}${bonus}` : ""}`.trim()
    : (bonus
      ? `Bonus de sauvegarde (${category}) ${bonus >= 0 ? "+" : ""}${bonus}`
      : `Aucune immunité ni résistance active contre ${type}`);
  const abilityDetails = Object.values(effectiveAbilities)
    .filter(result => result?.applied === true && Number.isFinite(result?.effective))
    .map(result => `${result.ability} effective ${result.effective}`)
    .join(", ");
  const details = abilityDetails ? `${baseDetails}. ${abilityDetails}.` : baseDetails;

  return {
    annulé: false,
    résiste: false,
    details,
    pct: 0,
    jet: 0,
    bonus,
    effectiveAbilities
  };
}

add2eInstallEffectiveAbilityContract();

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
    const effectiveAbilities = result.effectiveAbilities ?? {};
    const serializedAbilities = add2eSerializeEffectiveAbilities(effectiveAbilities);
    if (Object.keys(serializedAbilities).length) {
      try {
        effect.updateSource?.({ "flags.add2e.effectiveAbilities": serializedAbilities });
      } catch (error) {
        console.warn("[ADD2E][EFFECTIVE_ABILITY][UPDATE_SOURCE_ERROR]", error);
      }
      add2eResolvePostEffectiveAbilities(actor, context, effectiveAbilities);
    }
    if (result.kind === "none") return true;

    add2eResolvePostIncomingResult(actor, result);
    return result.blocked ? false : true;
  });
}

if (!globalThis.ADD2E_LIGHT_DARKNESS_INTERACTION_HOOK_REGISTERED) {
  globalThis.ADD2E_LIGHT_DARKNESS_INTERACTION_HOOK_REGISTERED = ADD2E_INCOMING_EFFECT_RESOLUTION_VERSION;
  Hooks.on("createActiveEffect", async effect => {
    if (!add2eLightDarknessResponsibleGM()) return;
    try {
      await add2eResolveLightDarknessInteraction(effect);
    } catch (error) {
      console.error("[ADD2E][LIGHT_DARKNESS][RESOLUTION_FAILED]", {
        effectId: effect?.id,
        effectName: effect?.name,
        error
      });
    }
  });
}

window.resolveActiveEffectsOnTarget = resolveActiveEffectsOnTarget;
globalThis.resolveActiveEffectsOnTarget = resolveActiveEffectsOnTarget;
globalThis.add2eResolveIncomingActiveEffect = add2eResolveIncomingActiveEffect;
globalThis.add2eResolveEffectiveAbility = add2eResolveEffectiveAbility;
globalThis.add2eResolveContextualEffectiveAbilities = add2eResolveContextualEffectiveAbilities;
globalThis.add2eResolveLightDarknessInteraction = add2eResolveLightDarknessInteraction;
globalThis.ADD2E_INCOMING_EFFECT_RESOLUTION_VERSION = ADD2E_INCOMING_EFFECT_RESOLUTION_VERSION;
