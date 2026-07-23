// ADD2E — Effects Engine / noyau partagé.
// Résolveur canonique des modificateurs et primitives métier existantes.
// Compatible Foundry V13/V14/V15.

import { add2eTimeEffectData } from "../add2e/19a-time-engine.mjs";

const ADD2E_MODIFIER_RESOLVER_VERSION = "2026-07-23-bonus-bigbang-abilities-v1";
const ADD2E_MODIFIER_DOMAINS = new Set([
  "ability", "attack", "damage", "armor-class", "save", "movement",
  "initiative", "hit-points", "spell-slot", "skill", "reaction",
  "morale", "encumbrance", "level", "resource", "resistance"
]);
const ADD2E_MODIFIER_OPERATIONS = new Set(["add", "set", "multiply", "minmax"]);
const ADD2E_MODIFIER_STACKING = new Set(["stack", "highest", "lowest", "replace", "unique-source", "exclusive"]);
const ADD2E_ABILITIES = new Set(["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"]);

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

const clone = value => {
  try { return foundry.utils.deepClone(value); }
  catch (_error) { return JSON.parse(JSON.stringify(value ?? null)); }
};

const escapeHtml = value => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const isObject = value => !!value && typeof value === "object" && !Array.isArray(value);

const canonicalKey = value => String(value ?? "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-+|-+$/g, "");

const abilityKey = value => {
  const key = canonicalKey(value);
  const aliases = {
    strength: "force",
    str: "force",
    dexterity: "dexterite",
    dex: "dexterite",
    con: "constitution",
    int: "intelligence",
    wisdom: "sagesse",
    wis: "sagesse",
    charisma: "charisme",
    cha: "charisme"
  };
  return aliases[key] ?? key;
};

const sourceStableKey = source => String(source?.uuid ?? source?.id ?? source?.name ?? "").trim();

const modifierSignature = modifier => JSON.stringify([
  modifier?.domain,
  modifier?.target,
  modifier?.operation,
  modifier?.value,
  modifier?.priority,
  modifier?.stacking?.mode,
  modifier?.stacking?.group,
  sourceStableKey(modifier?.source)
]);

const rawList = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (isObject(value)) return Object.values(value);
  return [];
};

const effectArray = actor => Array.from(actor?.effects?.contents ?? actor?.effects ?? []);
const itemArray = actor => Array.from(actor?.items?.contents ?? actor?.items ?? []);

function potionContextActor(context = {}) {
  return context.actor ?? context.args?.[0]?.actor ?? null;
}

function potionContextItem(context = {}) {
  return context.sourceItem ?? context.item ?? context.args?.[0]?.sourceItem ?? context.args?.[0]?.item ?? null;
}

async function potionRoll(formula, actor, flavor) {
  const roll = await new Roll(String(formula || "0")).evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor });
  return Number(roll.total) || 0;
}

function potionTargets(actor, selfOnly = false) {
  if (selfOnly) return actor ? [actor] : [];
  const targets = Array.from(game.user?.targets ?? []).map(token => token.actor).filter(Boolean);
  return targets.length ? targets : (actor ? [actor] : []);
}

function potionHpDescriptor(actor) {
  const system = actor?.system ?? {};
  return [
    { path: "system.pdv", value: system.pdv, max: system.points_de_coup },
    { path: "system.pv.value", value: system.pv?.value, max: system.pv?.max },
    { path: "system.hp.value", value: system.hp?.value, max: system.hp?.max },
    { path: "system.points_de_vie.value", value: system.points_de_vie?.value, max: system.points_de_vie?.max }
  ].find(row => Number.isFinite(Number(row.value))) ?? null;
}

async function potionDuration(actor, config = {}) {
  if (config.durationFormula) {
    const total = await potionRoll(config.durationFormula, actor, `${config.name} — durée`);
    return Math.max(0, total * (Number(config.durationMultiplier) || 1));
  }
  return Math.max(0, Number(config.durationRounds) || 0);
}

function characteristicRuleModifier(Engine, rule, defaults = {}, index = 0) {
  const kind = canonicalKey(rule?.kind ?? rule?.type);
  if (!["characteristic-bonus", "characteristic-override"].includes(kind)) return null;
  const target = abilityKey(rule?.characteristic ?? rule?.ability ?? rule?.target);
  if (!ADD2E_ABILITIES.has(target)) return null;
  const operation = kind === "characteristic-override" ? "set" : "add";
  const source = {
    ...(isObject(defaults.source) ? defaults.source : {}),
    ...(isObject(rule?.source) ? rule.source : {})
  };
  return Engine.createModifier({
    id: String(rule?.id ?? `${sourceStableKey(source) || "effect"}:${target}:${operation}:${index}`),
    domain: "ability",
    target,
    operation,
    value: Number(rule?.value ?? rule?.amount ?? rule?.bonus),
    priority: Number(rule?.priority ?? defaults.priority ?? 100),
    stacking: rule?.stacking ?? (operation === "set"
      ? { mode: "replace", group: `ability:${target}:override` }
      : { mode: "stack", group: null }),
    conditions: clone(rule?.conditions ?? {}),
    source,
    metadata: {
      label: String(rule?.label ?? defaults.label ?? source?.name ?? "Modificateur de caractéristique"),
      displayValue: rule?.displayValue ?? rule?.display_value ?? null,
      profile: clone(rule?.profile ?? {})
    }
  });
}

function characteristicChangeDescriptor(change) {
  const rawKey = String(change?.key ?? "");
  const direct = rawKey.match(/^system\.(force|dexterite|constitution|intelligence|sagesse|charisme)(?:_base)?$/);
  if (direct) return { target: direct[1], derived: false };

  const displays = {
    "system.for_aff": "force",
    "system.dex_aff": "dexterite",
    "system.con_aff": "constitution",
    "system.int_aff": "intelligence",
    "system.sag_aff": "sagesse",
    "system.cha_aff": "charisme"
  };
  if (displays[rawKey]) return { target: displays[rawKey], derived: true };

  if (/^system\.(?:force_bonus_toucher|force_bonus_degats|force_poids|force_ouvrir|force_tordre|force_bonus_porte|charge_max|charge_max_bench)$/.test(rawKey)) {
    return { target: "force", derived: true };
  }
  return null;
}

function characteristicChangeModifier(Engine, change, defaults = {}, index = 0) {
  const descriptor = characteristicChangeDescriptor(change);
  if (!descriptor || descriptor.derived) return null;
  const mode = Number(change?.mode);
  const target = descriptor.target;
  let operation = null;
  let value = Number(change?.value);
  if (!Number.isFinite(value)) return null;
  if (mode === (CONST.ACTIVE_EFFECT_MODES?.ADD ?? 2)) operation = "add";
  else if (mode === (CONST.ACTIVE_EFFECT_MODES?.MULTIPLY ?? 1)) operation = "multiply";
  else if (mode === (CONST.ACTIVE_EFFECT_MODES?.OVERRIDE ?? 5)) operation = "set";
  else if (mode === (CONST.ACTIVE_EFFECT_MODES?.DOWNGRADE ?? 3)) {
    operation = "minmax";
    value = { max: value };
  } else if (mode === (CONST.ACTIVE_EFFECT_MODES?.UPGRADE ?? 4)) {
    operation = "minmax";
    value = { min: value };
  } else return null;

  const source = isObject(defaults.source) ? defaults.source : {};
  return Engine.createModifier({
    id: `${sourceStableKey(source) || "effect"}:${target}:${operation}:change:${index}`,
    domain: "ability",
    target,
    operation,
    value,
    priority: Number(change?.priority ?? defaults.priority ?? 100),
    stacking: operation === "set"
      ? { mode: "replace", group: `ability:${target}:override` }
      : { mode: "stack", group: null },
    source,
    metadata: { label: String(defaults.label ?? source?.name ?? "Effet de caractéristique") }
  });
}

function numericCharacteristicTag(value) {
  const key = canonicalKey(value);
  return /^(?:bonus|malus|penalite)-(?:caracteristique|force|dexterite|constitution|intelligence|sagesse|charisme)(?:-|$)/.test(key)
    || /^(?:force|dexterite|constitution|intelligence|sagesse|charisme)-[+-]?\d/.test(key);
}

function canonicalizeCharacteristicEffectData(Engine, rawData, effect = null) {
  const data = isObject(rawData) ? clone(rawData) : {};
  const currentFlags = effect?.flags?.add2e ?? {};
  const incomingFlags = data?.flags?.add2e ?? {};
  const flags = { ...clone(currentFlags), ...clone(incomingFlags) };
  const rules = rawList(flags.rules);
  const changes = Array.isArray(data.changes)
    ? data.changes
    : Array.from(effect?.changes ?? []);
  const hasCharacteristicRule = rules.some(rule => ["characteristic-bonus", "characteristic-override"].includes(canonicalKey(rule?.kind ?? rule?.type)));
  const hasCharacteristicChange = changes.some(change => characteristicChangeDescriptor(change));
  const marked = flags.characteristicEffect === true;
  if (!hasCharacteristicRule && !hasCharacteristicChange && !marked) return null;

  const source = {
    kind: canonicalKey(flags.sourceType ?? flags.sourceKind ?? "effect") || "effect",
    id: String(flags.sourceItemId ?? effect?.id ?? data?._id ?? "").trim(),
    uuid: String(flags.sourceItemUuid ?? effect?.uuid ?? "").trim(),
    name: String(flags.classFeatureName ?? flags.sourceName ?? effect?.name ?? data?.name ?? "Effet").trim()
  };
  if (!source.id && !source.uuid) source.id = String(flags.passiveKey ?? flags.classFeatureId ?? data?.name ?? "effect");

  const existing = rawList(flags.modifiers)
    .map(raw => Engine.normalizeModifier(raw, { source }))
    .filter(Boolean);
  const converted = [];

  rules.forEach((rule, index) => {
    const modifier = characteristicRuleModifier(Engine, rule, { source, label: source.name }, index);
    if (modifier) converted.push(modifier);
  });
  changes.forEach((change, index) => {
    const modifier = characteristicChangeModifier(Engine, change, { source, label: source.name }, index);
    if (modifier) converted.push(modifier);
  });

  if (marked && !converted.length && flags.characteristic) {
    const target = abilityKey(flags.characteristic);
    if (ADD2E_ABILITIES.has(target) && Number.isFinite(Number(flags.characteristicValue))) {
      converted.push(Engine.createModifier({
        id: `${sourceStableKey(source)}:${target}:set`,
        domain: "ability",
        target,
        operation: "set",
        value: Number(flags.characteristicValue),
        priority: Number(flags.priority ?? 100),
        stacking: { mode: "replace", group: `ability:${target}:override` },
        source,
        metadata: {
          label: source.name,
          displayValue: flags.characteristicDisplayValue ?? flags.characteristicValue,
          profile: clone(flags.characteristicProfile ?? {})
        }
      }));
    }
  }

  const deduped = new Map();
  for (const modifier of [...existing, ...converted]) {
    if (!modifier) continue;
    deduped.set(modifierSignature(modifier), modifier);
  }

  const remainingRules = rules.filter(rule => !["characteristic-bonus", "characteristic-override"].includes(canonicalKey(rule?.kind ?? rule?.type)));
  const remainingChanges = changes.filter(change => !characteristicChangeDescriptor(change));
  const filterTags = value => {
    const list = Array.isArray(value) ? value : (typeof value === "string" ? value.split(/[,;\n|]+/) : []);
    return list.filter(tag => !numericCharacteristicTag(tag));
  };

  flags.modifiers = [...deduped.values()];
  flags.rules = remainingRules;
  if (flags.tags !== undefined) flags.tags = filterTags(flags.tags);
  if (flags.effectTags !== undefined) flags.effectTags = filterTags(flags.effectTags);

  return { flags: { ...(data.flags ?? {}), add2e: flags }, changes: remainingChanges };
}

function installCharacteristicEffectCanonicalization(Engine) {
  if (globalThis.__ADD2E_CHARACTERISTIC_EFFECT_CANONICALIZATION__ === ADD2E_MODIFIER_RESOLVER_VERSION) return;
  globalThis.__ADD2E_CHARACTERISTIC_EFFECT_CANONICALIZATION__ = ADD2E_MODIFIER_RESOLVER_VERSION;

  Hooks.on("preCreateActiveEffect", (effect, data = {}) => {
    const source = typeof effect?.toObject === "function" ? effect.toObject() : data;
    const canonical = canonicalizeCharacteristicEffectData(Engine, source, effect);
    if (canonical) effect?.updateSource?.(canonical);
  });

  Hooks.on("preUpdateActiveEffect", (effect, changes = {}) => {
    const base = typeof effect?.toObject === "function" ? effect.toObject() : {};
    const merged = foundry.utils.mergeObject(base, clone(changes), { inplace: false, insertKeys: true, overwrite: true });
    const canonical = canonicalizeCharacteristicEffectData(Engine, merged, effect);
    if (!canonical) return;
    changes.changes = canonical.changes;
    changes.flags = canonical.flags;
  });

  Hooks.once("ready", () => {
    if (!game.user?.isGM || game.users?.activeGM?.id !== game.user.id) return;
    for (const actor of game.actors?.contents ?? []) {
      const updates = [];
      for (const effect of effectArray(actor)) {
        const canonical = canonicalizeCharacteristicEffectData(Engine, effect.toObject(), effect);
        if (!canonical) continue;
        const before = JSON.stringify({
          modifiers: effect.flags?.add2e?.modifiers ?? [],
          rules: effect.flags?.add2e?.rules ?? [],
          tags: effect.flags?.add2e?.tags ?? [],
          effectTags: effect.flags?.add2e?.effectTags ?? [],
          changes: Array.from(effect.changes ?? [])
        });
        const after = JSON.stringify({
          modifiers: canonical.flags?.add2e?.modifiers ?? [],
          rules: canonical.flags?.add2e?.rules ?? [],
          tags: canonical.flags?.add2e?.tags ?? [],
          effectTags: canonical.flags?.add2e?.effectTags ?? [],
          changes: canonical.changes
        });
        if (before !== after) updates.push({ _id: effect.id, ...canonical });
      }
      if (updates.length) {
        actor.updateEmbeddedDocuments("ActiveEffect", updates, {
          add2eInternal: true,
          add2eReason: "bonus-bigbang-characteristic-effect-migration"
        }).catch(error => console.error("[ADD2E][MODIFIERS][MIGRATION]", { actor: actor.name, error }));
      }
    }
  });
}

export function installEffectsEngineCore(Engine) {
  register(Engine, {
    normalizeTag(v) {
      return String(v ?? "").trim().toLowerCase().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’']/g, "")
        .replace(/\s+/g, "_");
    },

    normalizeKey(v) {
      return canonicalKey(v);
    },

    toArray(v) {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      if (v instanceof Set) return [...v];
      if (typeof v === "string") return v.split(/[,;\n|]+/).map(s => s.trim()).filter(Boolean);
      if (typeof v === "object") {
        for (const k of ["value", "tags", "list", "items", "effectTags"]) {
          if (v[k] !== undefined && v[k] !== null) return this.toArray(v[k]);
        }
      }
      return [];
    },

    readNumber(...vals) {
      for (const v of vals) {
        if (v === undefined || v === null || v === "") continue;
        if (typeof v === "object") {
          const n = this.readNumber(v.value, v.current, v.actuel, v.total, v.max);
          if (Number.isFinite(n)) return n;
          continue;
        }
        const n = Number(String(v).replace(",", "."));
        if (Number.isFinite(n)) return n;
      }
      return null;
    },

    normalizeModifier(raw = {}, defaults = {}) {
      if (!isObject(raw)) return null;
      const domain = canonicalKey(raw.domain ?? defaults.domain);
      const target = abilityKey(raw.target ?? defaults.target);
      const operation = canonicalKey(raw.operation ?? defaults.operation ?? "add");
      const priorityValue = Number(raw.priority ?? defaults.priority ?? 100);
      const priority = Number.isFinite(priorityValue) ? priorityValue : 100;
      const rawStacking = isObject(raw.stacking) ? raw.stacking : { mode: raw.stacking };
      const stackingMode = canonicalKey(rawStacking?.mode ?? defaults?.stacking?.mode ?? "stack") || "stack";
      const stacking = {
        mode: stackingMode,
        group: String(rawStacking?.group ?? defaults?.stacking?.group ?? "").trim() || null
      };
      const sourceRaw = {
        ...(isObject(defaults.source) ? defaults.source : {}),
        ...(isObject(raw.source) ? raw.source : {})
      };
      const source = {
        kind: canonicalKey(sourceRaw.kind ?? "effect") || "effect",
        id: String(sourceRaw.id ?? "").trim(),
        uuid: String(sourceRaw.uuid ?? "").trim(),
        name: String(sourceRaw.name ?? "").trim()
      };
      let value = raw.value;
      if (operation === "minmax") {
        const bounds = isObject(value) ? value : {};
        const minimum = bounds.min === undefined || bounds.min === null || bounds.min === "" ? null : Number(bounds.min);
        const maximum = bounds.max === undefined || bounds.max === null || bounds.max === "" ? null : Number(bounds.max);
        value = {
          min: Number.isFinite(minimum) ? minimum : null,
          max: Number.isFinite(maximum) ? maximum : null
        };
      } else {
        value = Number(value);
      }
      const id = String(raw.id ?? `${sourceStableKey(source) || "modifier"}:${domain}:${target}:${operation}:${priority}`).trim();
      return {
        id,
        domain,
        target,
        operation,
        value,
        priority,
        stacking,
        conditions: clone(raw.conditions ?? {}),
        source,
        duration: clone(raw.duration ?? null),
        metadata: clone(raw.metadata ?? {})
      };
    },

    validateModifier(raw = {}, defaults = {}) {
      const modifier = this.normalizeModifier(raw, defaults);
      const errors = [];
      if (!modifier) errors.push("modifier-invalid");
      else {
        if (!ADD2E_MODIFIER_DOMAINS.has(modifier.domain)) errors.push(`domain:${modifier.domain || "missing"}`);
        if (!modifier.target) errors.push("target:missing");
        if (!ADD2E_MODIFIER_OPERATIONS.has(modifier.operation)) errors.push(`operation:${modifier.operation || "missing"}`);
        if (!ADD2E_MODIFIER_STACKING.has(modifier.stacking?.mode)) errors.push(`stacking:${modifier.stacking?.mode || "missing"}`);
        if (!sourceStableKey(modifier.source)) errors.push("source:missing");
        if (modifier.operation === "minmax") {
          if (modifier.value?.min === null && modifier.value?.max === null) errors.push("value:bounds-missing");
        } else if (!Number.isFinite(Number(modifier.value))) errors.push("value:not-number");
      }
      return { valid: errors.length === 0, errors, modifier };
    },

    createModifier(raw = {}, defaults = {}) {
      const result = this.validateModifier(raw, defaults);
      if (!result.valid) throw new Error(`Modificateur ADD2E invalide : ${result.errors.join(", ")}`);
      return result.modifier;
    },

    collectDocumentModifiers(document, defaults = {}) {
      if (!document) return [];
      let raw = document.flags?.add2e?.modifiers;
      if ((raw === undefined || raw === null) && document.getFlag) {
        try { raw = document.getFlag("add2e", "modifiers"); } catch (_error) {}
      }
      return rawList(raw).map(entry => {
        const normalized = this.normalizeModifier(entry, defaults);
        const validation = this.validateModifier(normalized);
        return validation.valid ? validation.modifier : null;
      }).filter(Boolean);
    },

    collect(actor, context = {}) {
      if (!actor) return [];
      const collected = [];
      const pushDocument = (document, defaults, sourceContext = {}) => {
        for (const modifier of this.collectDocumentModifiers(document, defaults)) {
          collected.push({
            ...modifier,
            _context: {
              sourceDocument: document,
              sourceItem: sourceContext.sourceItem ?? null,
              sourceEffect: sourceContext.sourceEffect ?? null
            }
          });
        }
      };

      pushDocument(actor, {
        source: { kind: "actor", id: actor.id, uuid: actor.uuid, name: actor.name }
      });

      for (const effect of effectArray(actor)) {
        if (!effect || effect.disabled === true || effect.isSuppressed === true) continue;
        const flags = effect.flags?.add2e ?? {};
        pushDocument(effect, {
          source: {
            kind: canonicalKey(flags.sourceType ?? flags.sourceKind ?? "effect") || "effect",
            id: String(flags.sourceItemId ?? effect.id ?? ""),
            uuid: String(flags.sourceItemUuid ?? effect.uuid ?? ""),
            name: String(flags.classFeatureName ?? effect.name ?? "")
          }
        }, { sourceEffect: effect });
      }

      for (const item of itemArray(actor)) {
        if (!item) continue;
        pushDocument(item, {
          source: {
            kind: canonicalKey(item.flags?.add2e?.sourceType ?? item.type ?? "item") || "item",
            id: item.id,
            uuid: item.uuid,
            name: item.name
          }
        }, { sourceItem: item });

        for (const effect of Array.from(item.effects?.contents ?? item.effects ?? [])) {
          if (!effect || effect.disabled === true || effect.isSuppressed === true) continue;
          pushDocument(effect, {
            source: {
              kind: canonicalKey(effect.flags?.add2e?.sourceType ?? item.type ?? "item-effect") || "item-effect",
              id: String(item.id ?? effect.id ?? ""),
              uuid: String(item.uuid ?? effect.uuid ?? ""),
              name: String(effect.name ?? item.name ?? "")
            }
          }, { sourceItem: item, sourceEffect: effect });
        }
      }

      const seen = new Set();
      return collected.filter(modifier => {
        const key = `${modifier.id}|${sourceStableKey(modifier.source)}|${modifierSignature(modifier)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },

    evaluateModifierConditions(modifier, context = {}) {
      const conditions = isObject(modifier?.conditions) ? modifier.conditions : {};
      const sourceContext = modifier?._context ?? {};
      const sourceItem = sourceContext.sourceItem ?? context.sourceItem ?? context.item ?? null;
      const sourceEffect = sourceContext.sourceEffect ?? null;
      const targetActor = context.targetActor ?? context.target?.actor ?? context.target ?? null;
      const includes = (actual, expected) => {
        const wanted = Array.isArray(expected) ? expected : [expected];
        const actualKey = canonicalKey(actual);
        return wanted.map(canonicalKey).includes(actualKey);
      };

      if (conditions.active !== undefined) {
        const active = sourceEffect ? sourceEffect.disabled !== true && sourceEffect.isSuppressed !== true : true;
        if (active !== Boolean(conditions.active)) return { applicable: false, reason: "condition-active" };
      }
      if (conditions.equipped !== undefined) {
        const equipped = sourceItem ? this.itemEquipped(sourceItem) : false;
        if (equipped !== Boolean(conditions.equipped)) return { applicable: false, reason: "condition-equipped" };
      }
      if (conditions.sourceType && !includes(modifier?.source?.kind, conditions.sourceType)) return { applicable: false, reason: "condition-source-type" };
      if (conditions.actorType && !includes(context.actor?.type, conditions.actorType)) return { applicable: false, reason: "condition-actor-type" };
      if (conditions.itemId && String(sourceItem?.id ?? context.item?.id ?? "") !== String(conditions.itemId)) return { applicable: false, reason: "condition-item-id" };
      if (conditions.itemIds && !rawList(conditions.itemIds).map(String).includes(String(sourceItem?.id ?? context.item?.id ?? ""))) return { applicable: false, reason: "condition-item-ids" };

      const weaponType = context.weaponType ?? context.item?.system?.famille_arme ?? context.item?.system?.type_arme ?? context.item?.system?.type;
      if (conditions.weaponType && !includes(weaponType, conditions.weaponType)) return { applicable: false, reason: "condition-weapon-type" };
      if (conditions.weaponTypes && !includes(weaponType, conditions.weaponTypes)) return { applicable: false, reason: "condition-weapon-types" };
      if (conditions.targetType && !includes(targetActor?.type ?? context.targetType, conditions.targetType)) return { applicable: false, reason: "condition-target-type" };
      const targetRace = context.targetRace ?? targetActor?.system?.race ?? targetActor?.system?.details_race?.slug ?? targetActor?.system?.details_race?.name;
      if (conditions.targetRace && !includes(targetRace, conditions.targetRace)) return { applicable: false, reason: "condition-target-race" };
      if (conditions.targetRaces && !includes(targetRace, conditions.targetRaces)) return { applicable: false, reason: "condition-target-races" };
      if (conditions.position && !includes(context.position, conditions.position)) return { applicable: false, reason: "condition-position" };

      if (conditions.range !== undefined && conditions.range !== null) {
        if (isObject(conditions.range)) {
          const distance = Number(context.distance ?? context.range);
          if (!Number.isFinite(distance)) return { applicable: false, reason: "condition-range-missing" };
          const minimum = Number(conditions.range.min);
          const maximum = Number(conditions.range.max);
          if (Number.isFinite(minimum) && distance < minimum) return { applicable: false, reason: "condition-range-min" };
          if (Number.isFinite(maximum) && distance > maximum) return { applicable: false, reason: "condition-range-max" };
        } else if (!includes(context.rangeBand ?? context.range, conditions.range)) {
          return { applicable: false, reason: "condition-range" };
        }
      }
      return { applicable: true, reason: "applicable" };
    },

    applyStacking(modifiers = []) {
      const accepted = [];
      const rejected = [];
      const grouped = new Map();

      for (const modifier of modifiers) {
        const mode = modifier.stacking?.mode ?? "stack";
        if (mode === "stack") {
          accepted.push(modifier);
          continue;
        }
        const group = modifier.stacking?.group || `${modifier.domain}:${modifier.target}`;
        const sourcePart = mode === "unique-source" ? `:${sourceStableKey(modifier.source)}` : "";
        const key = `${mode}:${group}${sourcePart}`;
        const list = grouped.get(key) ?? [];
        list.push(modifier);
        grouped.set(key, list);
      }

      const stableSort = (left, right) => {
        const priority = Number(right.priority) - Number(left.priority);
        if (priority) return priority;
        return sourceStableKey(left.source).localeCompare(sourceStableKey(right.source));
      };

      for (const [key, list] of grouped.entries()) {
        const mode = key.split(":")[0];
        let winner = null;
        if (mode === "highest") {
          winner = [...list].sort((left, right) => Number(right.value) - Number(left.value) || stableSort(left, right))[0];
        } else if (mode === "lowest") {
          winner = [...list].sort((left, right) => Number(left.value) - Number(right.value) || stableSort(left, right))[0];
        } else {
          winner = [...list].sort(stableSort)[0];
        }
        accepted.push(winner);
        for (const modifier of list) {
          if (modifier !== winner) rejected.push({ modifier, reason: `stacking-${mode}` });
        }
      }
      return { accepted, rejected };
    },

    resolve(actor, query = {}) {
      const domain = canonicalKey(query.domain);
      const target = abilityKey(query.target);
      if (!ADD2E_MODIFIER_DOMAINS.has(domain)) throw new Error(`Domaine de modificateur inconnu : ${domain || "vide"}`);
      if (!target) throw new Error("Cible de modificateur manquante.");

      const baseValue = Number(query.base ?? 0);
      const base = Number.isFinite(baseValue) ? baseValue : 0;
      const context = { ...(query.context ?? {}), actor, item: query.item ?? query.context?.item, targetActor: query.targetActor ?? query.context?.targetActor };
      const all = Array.isArray(query.modifiers) ? query.modifiers : this.collect(actor, context);
      const applicable = [];
      const rejected = [];

      for (const raw of all) {
        const modifier = this.normalizeModifier(raw, { source: raw?.source });
        const validation = this.validateModifier(modifier);
        if (!validation.valid) {
          rejected.push({ modifier: raw, reason: `invalid:${validation.errors.join("|")}` });
          continue;
        }
        if (modifier.domain !== domain || ![target, "all"].includes(modifier.target)) continue;
        modifier._context = raw?._context ?? {};
        const condition = this.evaluateModifierConditions(modifier, context);
        if (!condition.applicable) {
          rejected.push({ modifier, reason: condition.reason });
          continue;
        }
        applicable.push(modifier);
      }

      const stacking = this.applyStacking(applicable);
      rejected.push(...stacking.rejected);
      const ordered = [...stacking.accepted].sort((left, right) => {
        const priority = Number(left.priority) - Number(right.priority);
        if (priority) return priority;
        return sourceStableKey(left.source).localeCompare(sourceStableKey(right.source));
      });

      let afterOverride = base;
      let override = null;
      const additions = [];
      const multipliers = [];
      const bounds = [];

      for (const modifier of ordered) {
        if (modifier.operation === "set") {
          afterOverride = Number(modifier.value);
          override = { modifier, value: afterOverride };
        } else if (modifier.operation === "add") additions.push(modifier);
        else if (modifier.operation === "multiply") multipliers.push(modifier);
        else if (modifier.operation === "minmax") bounds.push(modifier);
      }

      const additionsTotal = additions.reduce((total, modifier) => total + Number(modifier.value), 0);
      const afterAdditions = afterOverride + additionsTotal;
      const multiplierTotal = multipliers.reduce((total, modifier) => total * Number(modifier.value), 1);
      const afterMultipliers = afterAdditions * multiplierTotal;
      let afterBounds = afterMultipliers;
      for (const modifier of bounds) {
        const minimum = modifier.value?.min;
        const maximum = modifier.value?.max;
        if (Number.isFinite(minimum)) afterBounds = Math.max(afterBounds, minimum);
        if (Number.isFinite(maximum)) afterBounds = Math.min(afterBounds, maximum);
      }

      const rounding = canonicalKey(query.rounding ?? "none");
      const total = rounding === "floor" ? Math.floor(afterBounds)
        : rounding === "ceil" ? Math.ceil(afterBounds)
          : rounding === "round" ? Math.round(afterBounds)
            : afterBounds;

      const applied = ordered.map(modifier => ({
        modifier,
        contribution: modifier.operation === "add"
          ? Number(modifier.value)
          : modifier.operation === "multiply"
            ? Number(modifier.value)
            : modifier.operation === "set"
              ? Number(modifier.value)
              : clone(modifier.value),
        reason: "applicable"
      }));

      return {
        domain,
        target,
        base,
        additionsTotal,
        multiplierTotal,
        override,
        total,
        applied,
        rejected,
        stages: { afterOverride, afterAdditions, afterMultipliers, afterBounds }
      };
    },

    explain(actor, query = {}) {
      return this.resolve(actor, { ...query, explain: true });
    },

    getAbilityBase(actor, ability) {
      const target = abilityKey(ability);
      if (!ADD2E_ABILITIES.has(target)) throw new Error(`Caractéristique inconnue : ${target || ability}`);
      const value = Number(actor?.system?.[`${target}_base`] ?? actor?.system?.[target] ?? 10);
      return Number.isFinite(value) ? value : 10;
    },

    resolveAbility(actor, ability, context = {}) {
      const target = abilityKey(ability);
      return this.resolve(actor, {
        domain: "ability",
        target,
        base: this.getAbilityBase(actor, target),
        context
      });
    },

    addTagsInto(dst, raw) {
      if (!dst) return;
      const add = typeof dst.add === "function"
        ? value => dst.add(value)
        : typeof dst.push === "function"
          ? value => dst.push(value)
          : null;
      if (!add) return;
      for (const tag of this.toArray(raw)) {
        const normalized = this.normalizeTag(tag);
        if (normalized) add(normalized);
      }
    },

    addEffectTagsInto(dst, effect) {
      if (!effect) return;
      this.addTagsInto(dst, effect.flags?.add2e?.tags);
      this.addTagsInto(dst, effect.flags?.add2e?.effectTags);
      if (!effect.getFlag) return;
      try { this.addTagsInto(dst, effect.getFlag("add2e", "tags")); } catch {}
      try { this.addTagsInto(dst, effect.getFlag("add2e", "effectTags")); } catch {}
    },

    addEmbeddedItemEffectTagsInto(dst, item) {
      const effects = item?.effects?.contents ?? item?.effects ?? [];
      for (const effect of effects) if (!effect?.disabled) this.addEffectTagsInto(dst, effect);
    },

    getActorLevel(actor) {
      const system = actor?.system ?? {};
      for (const value of [system.niveau, system.level, system.details?.level, system.details?.niveau]) {
        const level = Number(value);
        if (Number.isFinite(level) && level > 0) return level;
      }
      return 1;
    },

    itemTags(item) {
      const system = item?.system ?? {};
      const out = [];
      for (const value of [
        item?.name, system.nom, system.categorie, system.category, system.type,
        system.sousType, system.sous_type, system.famille, system.famille_arme,
        system.tags, system.tag, system.effectTags, system.effets, system.effects,
        item?.flags?.add2e?.tags, item?.flags?.add2e?.effectTags
      ]) this.addTagsInto(out, value);
      return [...new Set(out.map(tag => this.normalizeTag(tag)).filter(Boolean))];
    },

    itemText(item) {
      return this.itemTags(item).join(" ");
    },

    itemEquipped(item) {
      const system = item?.system ?? {};
      return system.equipee === true || system.equipped === true || system.portee === true || system.worn === true;
    },

    isShieldItem(item) {
      const text = this.itemText(item);
      return text.includes("bouclier") || text.includes("shield");
    },

    isHelmetItem(item) {
      const text = this.itemText(item);
      return text.includes("heaume") || text.includes("casque") || text.includes("helmet");
    },

    bonusFromName(item) {
      const match = String(item?.name ?? item?.system?.nom ?? "").match(/\+\s*(\d+)/);
      return match ? Number(match[1]) || 0 : 0;
    },

    looksMagical(item) {
      const system = item?.system ?? {};
      const text = this.itemText(item);
      return system.magique === true
        || system.magic === true
        || text.includes("magique")
        || text.includes("magic")
        || /\+\s*\d+/.test(String(item?.name ?? ""));
    },

    itemDefenseBonus(item) {
      const system = item?.system ?? {};
      let bonus = Math.abs(this.readNumber(
        system.bonus_ca, system.bonus_ac, system.ca_bonus, system.ac_bonus,
        system.protectionBonus, system.protection_bonus
      ) ?? 0);
      for (const tag of this.itemTags(item)) {
        const match = tag.match(/^(?:bonus_ca|bonus_ac|protection|protection_ca):([+\-]?\d+)$/);
        if (match) bonus += Math.abs(Number(match[1]) || 0);
      }
      if (!bonus && this.looksMagical(item)) {
        const type = String(item?.type ?? "").toLowerCase();
        const text = this.itemText(item);
        if (type === "armure" || type === "armor" || text.includes("anneau") || text.includes("bague") || text.includes("cape") || text.includes("protection")) {
          bonus = this.bonusFromName(item);
        }
      }
      return bonus;
    },

    itemFixedCA(item) {
      const system = item?.system ?? {};
      const type = String(item?.type ?? "").toLowerCase();
      const text = this.itemText(item);
      let ca = this.readNumber(
        system.ca_fixe, system.caFixe, system.fixedCA, system.fixed_ac, system.ac_fixe, system.acFixe
      );
      for (const tag of this.itemTags(item)) {
        const match = tag.match(/^(?:ca_fixe|ca_fixe_autres|ac_fixe|fixed_ca|classe_armure):([+\-]?\d+)$/);
        if (match) ca = Number(match[1]);
      }
      if (!Number.isFinite(ca)
        && (type === "objet" || type === "object" || type === "equipment")
        && (text.includes("bracelet") || text.includes("bracer"))) {
        const match = String(item?.name ?? system.nom ?? "").match(/(?:ca|classe\s+d[’']?armure|ac)\s*([\-]?\d+)/i)
          || String(item?.name ?? system.nom ?? "").match(/\b([\-]?\d+)\b\s*$/);
        if (match) ca = Number(match[1]);
      }
      return Number.isFinite(ca) ? ca : null;
    },

    getMagicWeaponBonus(item, kind = "hit") {
      const system = item?.system ?? {};
      const value = kind === "damage"
        ? this.readNumber(system.bonus_dom, system.bonus_degats, system.damage_bonus, system.degats_bonus, system.bonusDegats)
        : this.readNumber(system.bonus_hit, system.bonus_toucher, system.hit_bonus, system.attack_bonus, system.bonusAttaque);
      if (Number.isFinite(value)) return value;
      return this.looksMagical(item) ? this.bonusFromName(item) : 0;
    },

    equippedItems(actor, types = null) {
      const allowed = types ? new Set(types.map(type => String(type).toLowerCase())) : null;
      return [...(actor?.items ?? [])].filter(item => {
        const type = String(item?.type ?? "").toLowerCase();
        return (!allowed || allowed.has(type)) && this.itemEquipped(item);
      });
    },

    getDexDefense(actor) {
      const passiveArmorClass = typeof this.getPassiveArmorClassBase === "function"
        ? this.getPassiveArmorClassBase(actor, { ruleScope: "owner", source: "dex-defense" })
        : null;
      if (passiveArmorClass?.ignoreDex === true) return 0;

      const dex = this.resolveAbility(actor, "dexterite").total;
      if (dex <= 3) return 4;
      if (dex === 4) return 3;
      if (dex === 5) return 2;
      if (dex === 6) return 1;
      if (dex <= 14) return 0;
      if (dex === 15) return -1;
      if (dex === 16) return -2;
      if (dex === 17) return -3;
      return -4;
    },

    async createTimedEffect({ actor, name, img = null, sourceItem = null, rounds = 0, unit = "round", description = "", tags = [], rules = [], modifiers = [], changes = [], endMessage = null, silentExpiration = false, extraFlags = {} } = {}) {
      if (!actor) throw new Error("Acteur introuvable pour l’effet temporaire.");
      const canonicalModifiers = rawList(modifiers).map((modifier, index) => this.createModifier(modifier, {
        source: {
          kind: canonicalKey(extraFlags?.sourceType ?? sourceItem?.type ?? "effect") || "effect",
          id: String(sourceItem?.id ?? `${name || "effect"}-${index}`),
          uuid: String(sourceItem?.uuid ?? ""),
          name: String(sourceItem?.name ?? name ?? "Effet")
        }
      }));
      const data = add2eTimeEffectData({
        name,
        img: img || sourceItem?.img || "icons/svg/aura.svg",
        origin: sourceItem?.uuid ?? null,
        rounds,
        unit,
        description,
        tags,
        changes,
        source: "objet_magique",
        caster: actor,
        sourceItem,
        endMessage,
        silentExpiration,
        extraFlags: {
          rules: clone(rules),
          modifiers: clone(canonicalModifiers),
          genericEffect: true,
          ...clone(extraFlags)
        }
      });
      const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
      return effect ?? null;
    },

    async createTimedCharacteristicEffect({ actor, characteristic, value, displayValue = null, profile = {}, priority = 100, rules = [], changes = [], ...options } = {}) {
      const ability = abilityKey(characteristic);
      if (!actor || !ADD2E_ABILITIES.has(ability) || value === undefined || value === null || value === "") {
        throw new Error("Override de caractéristique invalide.");
      }
      const sourceItem = options.sourceItem ?? null;
      const source = {
        kind: canonicalKey(options.extraFlags?.sourceType ?? sourceItem?.type ?? "effect") || "effect",
        id: String(sourceItem?.id ?? options.extraFlags?.sourceItemId ?? `${options.name ?? "effect"}:${ability}`),
        uuid: String(sourceItem?.uuid ?? options.extraFlags?.sourceItemUuid ?? ""),
        name: String(sourceItem?.name ?? options.name ?? "Effet de caractéristique")
      };
      const modifier = this.createModifier({
        id: `${sourceStableKey(source)}:${ability}:set`,
        domain: "ability",
        target: ability,
        operation: "set",
        value: Number(value),
        priority,
        stacking: { mode: "replace", group: `ability:${ability}:override` },
        source,
        metadata: {
          label: source.name,
          displayValue: displayValue ?? value,
          profile: clone(profile)
        }
      });
      return this.createTimedEffect({
        ...options,
        actor,
        rules,
        changes,
        modifiers: [...rawList(options.modifiers), modifier],
        extraFlags: {
          ...(options.extraFlags ?? {}),
          characteristicEffect: true,
          characteristic: ability,
          characteristicValue: value,
          characteristicDisplayValue: displayValue ?? value,
          characteristicProfile: clone(profile)
        }
      });
    },

    async postGenericEffectChat(actor, title, html, item = null) {
      if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
        throw new Error("Les constructeurs de carte de chat ADD2E ne sont pas disponibles.");
      }
      const container = document.createElement("div");
      container.innerHTML = String(html ?? "");
      const message = String(container.textContent ?? "").replace(/\s+/g, " ").trim();
      const options = {
        actor,
        title,
        icon: "fas fa-wand-magic-sparkles",
        variant: "magic",
        source: {
          name: item?.name ?? actor?.name ?? "Source",
          img: item?.img ?? actor?.img ?? "icons/svg/aura.svg",
          type: item ? "Objet" : "Acteur"
        },
        message
      };
      globalThis.add2eBuildChatCard(options);
      return globalThis.add2eCreateChatCard(options);
    },

    async applyConfiguredEffect(context, config = {}) {
      const actor = potionContextActor(context);
      const item = potionContextItem(context);
      if (!actor) return false;

      if (config.kind === "healing") {
        const total = await potionRoll(config.formula, actor, config.name);
        const hp = potionHpDescriptor(actor);
        if (!hp) {
          await this.postGenericEffectChat(actor, config.name, `<p>Soins obtenus : <b>${total}</b>. Aucun champ de points de vie compatible n’a été trouvé.</p>`, item);
          return true;
        }
        const before = Number(hp.value) || 0;
        const maximum = Number.isFinite(Number(hp.max)) ? Number(hp.max) : before + total;
        const after = Math.min(maximum, before + total);
        await actor.update({ [hp.path]: after }, { add2eInternal: true, add2eReason: "potion-healing" });
        await this.postGenericEffectChat(actor, config.name, `<p>Points de vie : <b>${before} → ${after}</b>.</p><p>Soins effectifs : <b>${after - before}</b>.</p>`, item);
        return true;
      }

      if (config.kind === "age") {
        const total = await potionRoll(config.formula, actor, config.name);
        const system = actor.system ?? {};
        const target = [
          ["system.age", system.age],
          ["system.details.age", system.details?.age],
          ["system.age_actuel", system.age_actuel]
        ].find(([, current]) => Number.isFinite(Number(current)));
        if (target) {
          const [path, before] = target;
          const after = Math.max(0, Number(before) - total);
          await actor.update({ [path]: after }, { add2eInternal: true, add2eReason: "potion-age" });
          await this.postGenericEffectChat(actor, config.name, `<p>Âge : <b>${before} → ${after}</b>.</p>`, item);
        } else {
          await this.postGenericEffectChat(actor, config.name, `<p>Réduction d’âge à appliquer : <b>${total}</b> an(s).</p>`, item);
        }
        return true;
      }

      if (config.kind === "deception") {
        await this.createTimedEffect({
          actor,
          name: config.name,
          img: item?.img || "icons/svg/aura.svg",
          sourceItem: item,
          description: config.description || "",
          tags: ["objet_magique", "potion", `potion:${config.slug}`, "tromperie"],
          rules: [{ kind: "deception", apparentEffect: config.apparentEffect || "soins" }],
          extraFlags: { potion: true, potionSlug: config.slug, deceptivePotion: true }
        });
        await this.postGenericEffectChat(actor, config.name, "<p>Le consommateur croit que la potion a produit l’effet attendu. Aucun bénéfice réel n’est appliqué.</p>", item);
        return true;
      }

      if (config.kind === "heroism") {
        const level = this.getActorLevel(actor);
        if (level >= Number(config.maxLevelExclusive ?? Infinity)) {
          ui.notifications.warn(`${config.name} est sans effet sur un personnage de niveau ${level}.`);
          return false;
        }
        const row = (config.levelTable ?? []).find(entry => level >= Number(entry.min) && level <= Number(entry.max));
        if (!row) return false;
        const temporaryHp = await potionRoll(row.hpDice, actor, `${config.name} — points de vie temporaires`);
        const rounds = await potionDuration(actor, config);
        await this.createTimedEffect({
          actor,
          name: config.name,
          img: item?.img || "icons/svg/aura.svg",
          sourceItem: item,
          rounds,
          description: config.description || "",
          tags: ["objet_magique", "potion", `potion:${config.slug}`, ...(config.tags ?? [])],
          rules: [
            { kind: "temporary_levels", value: Number(row.bonus) || 0 },
            { kind: "temporary_hp", value: temporaryHp }
          ],
          endMessage: `L’effet ${config.name} prend fin sur {actor}.`,
          extraFlags: { potion: true, potionSlug: config.slug, temporaryLevels: Number(row.bonus) || 0, temporaryHp }
        });
        await this.postGenericEffectChat(actor, config.name, `<p>Niveaux temporaires : <b>+${Number(row.bonus) || 0}</b>.</p><p>Points de vie temporaires : <b>${temporaryHp}</b>.</p>${rounds ? `<p>Durée : <b>${rounds} round(s)</b>.</p>` : ""}`, item);
        return true;
      }

      const rounds = await potionDuration(actor, config);
      const targets = potionTargets(actor, config.selfOnly === true);
      if (!targets.length) return false;
      if (config.confirm === true) {
        const DialogV2 = foundry.applications?.api?.DialogV2;
        if (!DialogV2?.confirm) throw new Error("DialogV2 est indisponible.");
        const accepted = await DialogV2.confirm({
          window: { title: config.name || "Effet" },
          modal: true,
          content: `<div class="add2e-dialog"><p><b>${escapeHtml(config.name || "Effet")}</b></p><p>Cible(s) : <b>${escapeHtml(targets.map(target => target.name).join(", "))}</b></p>${config.saveNote ? `<p>${escapeHtml(config.saveNote)}</p>` : ""}<p>Appliquer l’effet ?</p></div>`,
          yes: { label: "Appliquer", icon: "fa-solid fa-check" },
          no: { label: "Annuler", icon: "fa-solid fa-xmark" }
        });
        if (!accepted) return false;
      }
      for (const target of targets) {
        await this.createTimedEffect({
          actor: target,
          name: config.name,
          img: item?.img || "icons/svg/aura.svg",
          sourceItem: item,
          rounds,
          description: config.description || config.rule || "",
          tags: ["objet_magique", "potion", `potion:${config.slug}`, ...(config.tags ?? [])],
          rules: config.rules ?? [],
          modifiers: config.modifiers ?? [],
          endMessage: config.endMessage ?? `L’effet ${config.name} prend fin sur {actor}.`,
          extraFlags: { potion: true, potionSlug: config.slug, ...(config.extraFlags ?? {}) }
        });
      }
      await this.postGenericEffectChat(actor, config.name, `<p>Effet appliqué à : <b>${escapeHtml(targets.map(target => target.name).join(", "))}</b>.</p>${rounds ? `<p>Durée : <b>${rounds} round(s)</b>.</p>` : ""}${config.rule ? `<p>${escapeHtml(config.rule)}</p>` : ""}`, item);
      return true;
    }
  });

  installCharacteristicEffectCanonicalization(Engine);
  globalThis.ADD2E_EFFECTS = Engine;
  globalThis.ADD2E_MODIFIER_RESOLVER_VERSION = ADD2E_MODIFIER_RESOLVER_VERSION;
}
