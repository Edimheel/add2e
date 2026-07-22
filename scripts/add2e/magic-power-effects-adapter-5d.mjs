// scripts/add2e/magic-power-effects-adapter-5d.mjs
// ADD2E — Adaptateur des pouvoirs d'objets magiques, lot 5D.
// Mouvement, caractéristiques, CA fixe, immunités et résistances.
// Module interne chargé uniquement par magic-power-effects-adapter.mjs.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.

const ADD2E_MAGIC_POWER_EFFECTS_5D_VERSION = "2026-07-22-magic-power-effects-5d-v1";
const EFFECT_FLAG = "magicItemCatalogueEffect";
const INTERNAL_OPTION = "add2eMagicPower5D";
const NORMALIZE_LOCK = new Set();

const ABILITY_ALIASES = Object.freeze({
  force: "force",
  strength: "force",
  str: "force",
  dexterite: "dexterite",
  dexterity: "dexterite",
  dex: "dexterite",
  constitution: "constitution",
  con: "constitution",
  intelligence: "intelligence",
  int: "intelligence",
  sagesse: "sagesse",
  wisdom: "sagesse",
  wis: "sagesse",
  charisme: "charisme",
  charisma: "charisme",
  cha: "charisme"
});

const DAMAGE_ALIASES = Object.freeze({
  feu: ["feu", "fire"],
  fire: ["feu", "fire"],
  froid: ["froid", "cold"],
  cold: ["froid", "cold"],
  acide: ["acide", "acid"],
  acid: ["acide", "acid"],
  electricite: ["electricite", "electricity", "foudre", "lightning"],
  electricity: ["electricite", "electricity", "foudre", "lightning"],
  foudre: ["electricite", "electricity", "foudre", "lightning"],
  lightning: ["electricite", "electricity", "foudre", "lightning"],
  poison: ["poison"],
  magie: ["magie", "magic"],
  magic: ["magie", "magic"],
  sommeil: ["sommeil", "sleep"],
  sleep: ["sommeil", "sleep"],
  charme: ["charme", "charm"],
  charm: ["charme", "charm"]
});

function clone(value) {
  if (value == null) return value;
  try { return foundry.utils.deepClone(value); }
  catch (_error) {
    try { return structuredClone(value); }
    catch (_cloneError) { return JSON.parse(JSON.stringify(value)); }
  }
}

function norm(value) {
  return String(value ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "").replace(/[^a-z0-9:+*_.-]+/g, "_")
    .replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}

function list(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(list);
  if (value instanceof Set) return [...value].flatMap(list);
  if (typeof value === "string") return value.split(/[,;\n|]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["values", "items", "list", "lists", "tags", "effectTags", "types", "categories"]) {
      if (value[key] != null) return list(value[key]);
    }
  }
  return [value];
}

function number(...values) {
  for (const value of values) {
    if (value == null || value === "") continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      const nested = number(value.value, value.amount, value.total, value.current, value.actuel, value.max);
      if (Number.isFinite(nested)) return nested;
      continue;
    }
    const parsed = Number(String(value).replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function bool(value, fallback = false) {
  if (value === true || value === false) return value;
  if (value == null || value === "") return fallback;
  const key = norm(value);
  if (["true", "1", "yes", "oui", "on", "active", "enabled"].includes(key)) return true;
  if (["false", "0", "no", "non", "off", "inactive", "disabled"].includes(key)) return false;
  return fallback;
}

function rulesOf(effect) {
  const raw = effect?.flags?.add2e?.rules;
  if (Array.isArray(raw)) return raw.filter(rule => rule && typeof rule === "object");
  if (!raw || typeof raw !== "object") return [];
  if (Array.isArray(raw.rules)) return raw.rules.filter(rule => rule && typeof rule === "object");
  return [raw];
}

function ruleType(rule) {
  return norm(rule?.type ?? rule?.kind ?? rule?.category ?? "");
}

function actorForEffect(effect) {
  const parent = effect?.parent;
  if (parent?.documentName === "Actor") return parent;
  if (parent?.actor?.documentName === "Actor") return parent.actor;
  return null;
}

function generatedState(effect) {
  const value = effect?.flags?.add2e?.magicPower5D;
  return value && typeof value === "object" ? value : {};
}

function changeSignature(change) {
  return JSON.stringify({
    key: String(change?.key ?? ""),
    mode: Number(change?.mode ?? 0),
    value: String(change?.value ?? ""),
    priority: Number(change?.priority ?? 0)
  });
}

function uniqueChanges(changes) {
  const seen = new Set();
  const result = [];
  for (const change of changes) {
    if (!change?.key) continue;
    const signature = changeSignature(change);
    if (seen.has(signature)) continue;
    seen.add(signature);
    result.push(change);
  }
  return result;
}

function uniqueTags(tags) {
  const seen = new Set();
  const result = [];
  for (const value of tags) {
    const tag = String(value ?? "").trim();
    const key = norm(tag);
    if (!tag || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result;
}

function same(left, right) {
  try { return JSON.stringify(left) === JSON.stringify(right); }
  catch (_error) { return false; }
}

function addMode() {
  return CONST.ACTIVE_EFFECT_MODES?.ADD ?? 2;
}

function multiplyMode() {
  return CONST.ACTIVE_EFFECT_MODES?.MULTIPLY ?? 1;
}

function overrideMode() {
  return CONST.ACTIVE_EFFECT_MODES?.OVERRIDE ?? 5;
}

function canonicalAbility(value) {
  return ABILITY_ALIASES[norm(value)] ?? "";
}

function damageAliases(value) {
  const key = norm(value);
  return DAMAGE_ALIASES[key] ?? (key ? [key] : []);
}

function firstRuleValues(rule, keys) {
  for (const key of keys) {
    if (rule?.[key] == null || rule[key] === "") continue;
    const values = list(rule[key]).map(norm).filter(Boolean);
    if (values.length) return values;
  }
  return [];
}

function movementPaths({ includeBase = false } = {}) {
  const paths = [
    "system.mouvement.actuel",
    "system.mouvement.vitesse",
    "system.mouvement.metresTour",
    "system.mouvement.donjonRoundMetres",
    "system.mouvement.segmentMetres",
    "system.mouvement.exterieurDemiJourKm",
    "system.movement",
    "system.vitesse_deplacement"
  ];
  if (includeBase) paths.unshift("system.mouvement.base", "system.vitesse_base");
  return paths;
}

function movementRuleData(rule) {
  const type = ruleType(rule);
  const explicitMode = norm(rule?.operation ?? rule?.applyMode ?? rule?.application ?? rule?.mode);
  const multiplier = number(rule?.multiplier, rule?.factor, rule?.coefficient);
  const direct = number(rule?.value, rule?.amount, rule?.bonus, rule?.modifier, rule?.speed, rule?.movement, rule?.distance);
  const isMultiplier = type.includes("multiplier") || ["multiply", "multiplication", "multiplier", "factor"].includes(explicitMode);
  const isOverride = type.includes("override") || type.includes("fixed") || type.includes("base")
    || ["override", "set", "fixed", "replace", "impose", "imposed"].includes(explicitMode);
  const value = isMultiplier ? multiplier ?? direct : direct ?? multiplier;
  const movementMode = firstRuleValues(rule, ["movementMode", "movementModes", "modeName", "travelMode", "movementType", "modes"])
    .filter(entry => !["add", "multiply", "override", "set", "fixed"].includes(entry));
  if (!movementMode.length && type === "movement_mode") {
    const candidate = norm(rule?.mode ?? rule?.value ?? rule?.movement);
    if (candidate && !Number.isFinite(Number(candidate)) && !["add", "multiply", "override", "set", "fixed"].includes(candidate)) {
      movementMode.push(candidate);
    }
  }
  return { type, value, isMultiplier, isOverride, movementMode };
}

function movementChanges(rule) {
  const data = movementRuleData(rule);
  const supported = [
    "movement_mode", "movement_bonus", "movement_modifier", "movement_multiplier", "movement_override",
    "speed_bonus", "speed_modifier", "speed_multiplier", "speed_override", "base_movement", "fixed_movement"
  ].includes(data.type);
  if (!supported || !Number.isFinite(data.value)) return [];
  const mode = data.isMultiplier ? multiplyMode() : data.isOverride ? overrideMode() : addMode();
  const includeBase = data.isOverride || norm(rule?.scope) === "base" || bool(rule?.affectsBase, false);
  const priority = Math.max(1, Math.floor(number(rule?.priority) ?? 100));
  return movementPaths({ includeBase }).map(key => ({ key, mode, value: data.value, priority }));
}

function abilityTargets(rule) {
  return firstRuleValues(rule, ["ability", "abilities", "stat", "stats", "attribute", "attributes", "characteristic", "characteristics", "target", "targetAny"])
    .map(canonicalAbility).filter(Boolean);
}

function abilityChanges(rule) {
  const type = ruleType(rule);
  if (!["ability_bonus", "characteristic_bonus", "stat_bonus", "attribute_bonus", "ability_override", "characteristic_override", "stat_override", "attribute_override"].includes(type)) {
    return [];
  }
  const value = number(rule?.value, rule?.amount, rule?.bonus, rule?.modifier, rule?.score);
  if (!Number.isFinite(value)) return [];
  const explicitMode = norm(rule?.mode ?? rule?.operation ?? rule?.applyMode);
  const override = type.includes("override") || ["override", "set", "fixed", "replace", "impose", "imposed"].includes(explicitMode);
  const mode = override ? overrideMode() : addMode();
  const priority = Math.max(1, Math.floor(number(rule?.priority) ?? 100));
  return abilityTargets(rule).map(ability => ({ key: `system.${ability}_base`, mode, value, priority }));
}

function fixedArmorClassRule(rule) {
  const type = ruleType(rule);
  if (!["fixed_armor_class", "armor_class_fixed", "armor_class_base", "fixed_ac", "ac_fixed", "classe_armure_fixe", "classe_armure_base", "ca_fixe", "ca_base", "defense_base"].includes(type)) {
    return null;
  }
  const value = number(rule?.value, rule?.amount, rule?.armorClass, rule?.armor_class, rule?.ac, rule?.ca, rule?.fixedCA, rule?.fixedAc, rule?.base);
  if (!Number.isFinite(value)) return null;
  return {
    value,
    ignoreDex: bool(rule?.ignoreDex ?? rule?.ignore_dex, false) || norm(rule?.dex) === "ignore",
    rule
  };
}

function immunityValues(rule) {
  const type = ruleType(rule);
  const generic = ["damage_immunity", "attack_immunity", "condition_immunity", "immunity", "immunite"].includes(type);
  const suffixed = type.endsWith("_immunity") || type.endsWith("_immunite");
  if (!generic && !suffixed) return [];
  const values = firstRuleValues(rule, ["attackAny", "damageAny", "damageTypes", "immunities", "types", "elements", "conditions", "targetAny", "against"]);
  if (values.length) return values;
  const inferred = type.replace(/_(?:immunity|immunite)$/, "");
  return inferred && !["damage", "attack", "condition"].includes(inferred) ? [inferred] : [];
}

function resistanceData(rule) {
  const type = ruleType(rule);
  if (!["damage_resistance", "magic_resistance", "resistance", "resistance_damage"].includes(type)) return null;
  const values = firstRuleValues(rule, ["attackAny", "damageAny", "damageTypes", "resistances", "types", "elements", "targetAny", "against", "kind"]);
  const targets = values.length ? values : type === "magic_resistance" ? ["magie"] : [];
  const percentage = number(rule?.percentage, rule?.percent, rule?.pct, rule?.value, rule?.amount, rule?.reduction);
  return { targets, percentage };
}

function generatedTagsForRule(rule) {
  const tags = [];
  const movement = movementRuleData(rule);
  for (const mode of movement.movementMode) {
    tags.push(`mouvement:${mode}`, `movement_mode:${mode}`);
  }
  const fixed = fixedArmorClassRule(rule);
  if (fixed) tags.push(`ca_fixe:${fixed.value}`, `fixed_ca:${fixed.value}`);
  for (const raw of immunityValues(rule)) {
    for (const alias of damageAliases(raw)) tags.push(`immunite:${alias}`, `immunity:${alias}`);
  }
  const resistance = resistanceData(rule);
  if (resistance) {
    for (const raw of resistance.targets) {
      for (const alias of damageAliases(raw)) {
        tags.push(`resistance:${alias}`);
        if (Number.isFinite(resistance.percentage)) tags.push(`resistance:${alias}:${resistance.percentage}`);
      }
    }
  }
  return tags;
}

function generatedData(effect) {
  const changes = [];
  const tags = [];
  for (const rule of rulesOf(effect)) {
    changes.push(...movementChanges(rule), ...abilityChanges(rule));
    tags.push(...generatedTagsForRule(rule));
  }
  return { changes: uniqueChanges(changes), tags: uniqueTags(tags) };
}

function relevantEffect(effect) {
  if (!effect || effect.disabled === true) return false;
  const flags = effect.flags?.add2e ?? {};
  if (flags[EFFECT_FLAG] === true || flags.magicPowerActivation === true || flags.magicPowerCondition === true) return true;
  return rulesOf(effect).some(rule => {
    const type = ruleType(rule);
    return type.startsWith("movement_") || type.startsWith("speed_")
      || type.includes("ability") || type.includes("characteristic") || type.includes("attribute") || type.includes("stat_")
      || type.includes("armor_class") || type === "fixed_ac" || type === "ac_fixed" || type === "ca_fixe" || type === "ca_base"
      || type.includes("immunity") || type.includes("immunite") || type.includes("resistance");
  });
}

async function normalizeEffect(effect) {
  if (!effect?.id || !relevantEffect(effect)) return false;
  const key = String(effect.uuid ?? effect.id);
  if (NORMALIZE_LOCK.has(key)) return false;
  NORMALIZE_LOCK.add(key);
  try {
    const previous = generatedState(effect);
    const oldChangeSignatures = new Set(list(previous.generatedChangeSignatures).map(String));
    const oldTags = new Set(list(previous.generatedTags).map(norm));
    const baseChanges = Array.from(effect.changes ?? []).filter(change => !oldChangeSignatures.has(changeSignature(change)));
    const currentTags = list(effect.flags?.add2e?.tags ?? effect.flags?.add2e?.effectTags).filter(tag => !oldTags.has(norm(tag)));
    const generated = generatedData(effect);
    const changes = uniqueChanges([...baseChanges, ...generated.changes]);
    const tags = uniqueTags([...currentTags, ...generated.tags]);
    const state = {
      version: ADD2E_MAGIC_POWER_EFFECTS_5D_VERSION,
      generatedTags: generated.tags,
      generatedChangeSignatures: generated.changes.map(changeSignature)
    };
    const update = {};
    if (!same(Array.from(effect.changes ?? []), changes)) update.changes = changes;
    if (!same(list(effect.flags?.add2e?.tags), tags)) update["flags.add2e.tags"] = tags;
    if (!same(list(effect.flags?.add2e?.effectTags), tags)) update["flags.add2e.effectTags"] = tags;
    if (!same(previous, state)) update["flags.add2e.magicPower5D"] = state;
    if (!Object.keys(update).length) return false;
    await effect.update(update, { [INTERNAL_OPTION]: true, add2eInternal: true, render: false });
    return true;
  } finally {
    NORMALIZE_LOCK.delete(key);
  }
}

function activeEffects(actor) {
  const seen = new Set();
  const result = [];
  for (const effect of [...(actor?.effects?.contents ?? actor?.effects ?? []), ...(actor?.appliedEffects ?? [])]) {
    const key = String(effect?.uuid ?? effect?.id ?? "");
    if (!effect || effect.disabled === true || !key || seen.has(key)) continue;
    seen.add(key);
    result.push(effect);
  }
  return result;
}

function fixedArmorClassForActor(actor) {
  const candidates = [];
  for (const effect of activeEffects(actor)) {
    for (const rule of rulesOf(effect)) {
      const fixed = fixedArmorClassRule(rule);
      if (!fixed) continue;
      candidates.push({ ...fixed, effect, label: String(rule?.label ?? rule?.name ?? effect.name ?? "CA fixe magique") });
    }
  }
  if (!candidates.length) return null;
  return candidates.sort((left, right) => left.value - right.value)[0];
}

function applyFixedArmorClassToDefense(base, candidate) {
  if (!candidate) return base;
  const currentFixed = number(base?.fixedCA);
  if (Number.isFinite(currentFixed) && currentFixed <= candidate.value) return base;
  const dex = candidate.ignoreDex ? 0 : number(base?.dex) ?? 0;
  const shieldBonus = number(base?.shieldBonus) ?? 0;
  const helmetBonus = number(base?.helmetBonus) ?? 0;
  const objectProtectionBonus = number(base?.objectProtectionBonus) ?? 0;
  const naturalAdjustment = number(base?.effectCaNaturelAdjustment) ?? 0;
  const totalAdjustment = number(base?.effectCaTotalAdjustment) ?? 0;
  const armorLayerCA = candidate.value;
  const caNaturel = armorLayerCA + dex - shieldBonus - helmetBonus + naturalAdjustment;
  const caTotal = caNaturel - objectProtectionBonus + totalAdjustment;
  return {
    ...(base ?? {}),
    fixedCA: candidate.value,
    fixedSource: candidate.label,
    fixedCAActive: true,
    baseAfterFixed: candidate.value,
    armorLayerCA,
    dex,
    ignoredArmorMagicBonus: number(base?.armorMagicBonus) ?? number(base?.ignoredArmorMagicBonus) ?? 0,
    armorMagicBonus: 0,
    caNaturel,
    caTotal,
    syntheticArmorAC: armorLayerCA - objectProtectionBonus,
    magicPowerFixedArmorClass: {
      value: candidate.value,
      ignoreDex: candidate.ignoreDex,
      effectId: candidate.effect?.id ?? null,
      effectName: candidate.effect?.name ?? candidate.label
    }
  };
}

function installDefenseBridge() {
  const engine = globalThis.Add2eEffectsEngine;
  if (!engine || engine.__add2eMagicPower5DDefense === ADD2E_MAGIC_POWER_EFFECTS_5D_VERSION) return;
  const originalDefense = typeof engine.getMagicPassiveDefense === "function"
    ? engine.getMagicPassiveDefense.bind(engine)
    : actor => ({ caNaturel: number(actor?.system?.ca_naturel) ?? 10, caTotal: number(actor?.system?.ca_total) ?? 10 });
  const originalDamage = typeof engine.resolveIncomingDamage === "function"
    ? engine.resolveIncomingDamage.bind(engine)
    : null;
  engine.getMagicPassiveDefense = function add2eMagicPower5DDefense(actor, context = {}) {
    return applyFixedArmorClassToDefense(originalDefense(actor, context), fixedArmorClassForActor(actor));
  };
  if (originalDamage) {
    engine.resolveIncomingDamage = async function add2eMagicPower5DIncomingDamage(actor, options = {}) {
      const tags = new Set((typeof this.getActiveTags === "function" ? this.getActiveTags(actor) : []).map(norm));
      const rawTypes = [options.type, options.details].flatMap(value => String(value ?? "").split(/[,;|/\s]+/g)).map(norm).filter(Boolean);
      const aliases = new Set(rawTypes.flatMap(damageAliases));
      const immune = [...aliases].find(alias => tags.has(`immunite:${alias}`)
        || tags.has(`immunity:${alias}`)
        || tags.has(`immunite:degats:${alias}`)
        || tags.has(`damage_immunity:${alias}`));
      if (immune) {
        const original = Math.max(0, Number(options.amount) || 0);
        return { amount: 0, applied: true, original, immunity: true, immunityType: immune, save: null };
      }
      return originalDamage(actor, options);
    };
  }
  engine.__add2eMagicPower5DDefense = ADD2E_MAGIC_POWER_EFFECTS_5D_VERSION;
}

function installSheetBridge() {
  const Sheet = globalThis.Add2eActorSheet;
  if (!Sheet?.prototype || Sheet.prototype.__add2eMagicPower5DSheet === ADD2E_MAGIC_POWER_EFFECTS_5D_VERSION) return;
  const originalGetData = Sheet.prototype.getData;
  Sheet.prototype.getData = async function add2eMagicPower5DSheetData(...args) {
    const data = await originalGetData.apply(this, args);
    try {
      if (this.actor?.type !== "personnage") return data;
      installDefenseBridge();
      const defense = globalThis.Add2eEffectsEngine?.getMagicPassiveDefense?.(this.actor, { source: "magic-power-effects-5d" });
      if (!defense) return data;
      data.combatDefense ??= {};
      data.combatDefense.ac_naturelle = defense.caNaturel;
      data.combatDefense.ac_totale = defense.caTotal;
      data.combatDefense.objets_magiques_defense = defense;
      if (defense.fixedCAActive) {
        data.combatDefense.armure = `${defense.fixedSource} <small style="color:#7f704d;">(CA fixe, armure ignorée)</small>`;
      }
    } catch (error) {
      console.warn("[ADD2E][MAGIC_POWER_EFFECTS][5D][SHEET]", error);
    }
    return data;
  };
  Sheet.prototype.__add2eMagicPower5DSheet = ADD2E_MAGIC_POWER_EFFECTS_5D_VERSION;
}

function primaryGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id || !game.users?.activeGM;
}

async function migrateActor(actor) {
  let updated = 0;
  for (const effect of activeEffects(actor)) {
    if (await normalizeEffect(effect)) updated += 1;
  }
  return updated;
}

async function migrateAll() {
  if (!primaryGM()) return { actors: 0, effects: 0 };
  let actors = 0;
  let effects = 0;
  for (const actor of game.actors?.contents ?? game.actors ?? []) {
    const count = await migrateActor(actor);
    if (count) actors += 1;
    effects += count;
  }
  return { actors, effects };
}

globalThis.ADD2E_MAGIC_POWER_EFFECTS_5D_VERSION = ADD2E_MAGIC_POWER_EFFECTS_5D_VERSION;
globalThis.add2eNormalizeMagicPower5DEffect = normalizeEffect;
globalThis.add2eMigrateMagicPower5DEffects = migrateAll;
globalThis.add2eGetMagicPowerFixedArmorClass = fixedArmorClassForActor;

Hooks.on("createActiveEffect", (effect, _options = {}, userId = null) => {
  if (userId && String(userId) !== String(game.user?.id ?? "")) return;
  normalizeEffect(effect).catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][5D][CREATE]", error));
});
Hooks.on("updateActiveEffect", (effect, _changes = {}, options = {}, userId = null) => {
  if (options?.[INTERNAL_OPTION]) return;
  if (userId && String(userId) !== String(game.user?.id ?? "")) return;
  normalizeEffect(effect).catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][5D][UPDATE]", error));
});
Hooks.on("deleteActiveEffect", effect => {
  const actor = actorForEffect(effect);
  if (actor?.sheet?.rendered) actor.sheet.render(false);
});
Hooks.once("ready", () => {
  installDefenseBridge();
  installSheetBridge();
  game.add2e ??= {};
  game.add2e.magicPowerEffects5D = {
    version: ADD2E_MAGIC_POWER_EFFECTS_5D_VERSION,
    normalizeEffect,
    migrateActor,
    migrateAll,
    fixedArmorClassForActor
  };
  setTimeout(() => {
    migrateAll().catch(error => console.error("[ADD2E][MAGIC_POWER_EFFECTS][5D][READY]", error));
  }, 0);
});
