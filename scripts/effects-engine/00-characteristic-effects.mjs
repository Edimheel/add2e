// ADD2E — Effects Engine / canonicalisation des effets de caractéristiques.
// Compatible Foundry V13/V14/V15.

import {
  ADD2E_MODIFIER_RESOLVER_VERSION,
  ADD2E_ABILITIES,
  abilityKey,
  canonicalKey,
  clone,
  effectArray,
  isObject,
  modifierSignature,
  rawList,
  sourceStableKey
} from "./00-core-shared.mjs";

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

export function installCharacteristicEffectCanonicalization(Engine) {
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
