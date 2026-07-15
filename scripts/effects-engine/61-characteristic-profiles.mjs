// ADD2E — Effects Engine / profils génériques de caractéristiques.
// Permet un remplacement temporaire non numérique sans inventer de score.
// Compatible Foundry V13/V14/V15.

export const ADD2E_CHARACTERISTIC_PROFILES_VERSION = "2026-07-15-characteristic-profiles-v1";
globalThis.ADD2E_CHARACTERISTIC_PROFILES_VERSION = ADD2E_CHARACTERISTIC_PROFILES_VERSION;

const Engine = globalThis.Add2eEffectsEngine;
if (!Engine) throw new Error("[ADD2E][EFFECTS_ENGINE] Moteur indisponible pour les profils de caractéristiques.");

const normalize = value => String(value ?? "")
  .trim()
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const clone = value => {
  try { return foundry.utils.deepClone(value); }
  catch (_error) { return JSON.parse(JSON.stringify(value ?? null)); }
};

function effectRules(effect) {
  if (!effect || effect.disabled) return [];
  const raw = effect.flags?.add2e?.rules ?? [];
  if (typeof Engine.toRules === "function") return Engine.toRules(raw);
  return Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? [raw] : []);
}

function getCharacteristicOverride(actor, characteristic) {
  const wanted = normalize(characteristic);
  const rows = [];
  for (const effect of actor?.effects?.contents ?? actor?.effects ?? []) {
    for (const rule of effectRules(effect)) {
      const kind = normalize(rule?.kind ?? rule?.type ?? rule?.ruleType);
      const ability = normalize(rule?.characteristic ?? rule?.ability ?? rule?.caracteristique);
      if (kind !== "characteristic_override" || ability !== wanted) continue;
      const rawValue = rule?.value ?? rule?.score ?? rule?.total ?? rule?.displayValue;
      if (rawValue === undefined || rawValue === null || rawValue === "") continue;
      rows.push({
        value: rawValue,
        numericValue: Number.isFinite(Number(rawValue)) ? Number(rawValue) : null,
        displayValue: rule?.displayValue ?? rawValue,
        profile: rule?.profile && typeof rule.profile === "object" ? clone(rule.profile) : {},
        priority: Number(rule?.priority ?? 0) || 0,
        rule,
        effect
      });
    }
  }
  return rows.sort((a, b) => b.priority - a.priority)[0] ?? null;
}

async function createTimedCharacteristicEffect({
  actor,
  characteristic,
  value,
  displayValue = null,
  profile = {},
  priority = 100,
  rules = [],
  extraFlags = {},
  ...options
} = {}) {
  const ability = normalize(characteristic);
  if (!actor || !ability || value === undefined || value === null || value === "") {
    throw new Error("Override de caractéristique invalide.");
  }
  return Engine.createTimedEffect({
    ...options,
    actor,
    rules: [
      ...(Array.isArray(rules) ? rules : []),
      {
        kind: "characteristic_override",
        characteristic: ability,
        value,
        displayValue: displayValue ?? value,
        profile: clone(profile),
        priority: Number(priority) || 0
      }
    ],
    extraFlags: {
      ...clone(extraFlags),
      characteristicEffect: true,
      characteristic: ability,
      characteristicValue: value,
      characteristicDisplayValue: displayValue ?? value,
      characteristicProfile: clone(profile),
      characteristicProfilesVersion: ADD2E_CHARACTERISTIC_PROFILES_VERSION
    }
  });
}

Object.defineProperties(Engine, {
  getCharacteristicOverride: {
    configurable: true,
    writable: true,
    value: getCharacteristicOverride
  },
  getEffectiveCharacteristic: {
    configurable: true,
    writable: true,
    value(actor, characteristic, fallback = 0) {
      return getCharacteristicOverride(actor, characteristic)?.value ?? fallback;
    }
  },
  createTimedCharacteristicEffect: {
    configurable: true,
    writable: true,
    value: createTimedCharacteristicEffect
  }
});

async function applyProfiles(actor) {
  if (!actor?.system || actor.__add2eCharacteristicProfileInProgress) return false;
  const overrides = {};
  for (const characteristic of ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"]) {
    const row = getCharacteristicOverride(actor, characteristic);
    if (row) overrides[characteristic] = row;
  }
  if (!Object.keys(overrides).length) return false;

  actor.__add2eCharacteristicProfileInProgress = true;
  try {
    const update = {};
    const strength = overrides.force;
    if (strength) {
      const profile = strength.profile ?? {};
      update["system.for_aff"] = strength.displayValue;
      if (profile.toucher !== undefined) update["system.force_bonus_toucher"] = Number(profile.toucher) || 0;
      if (profile.degats !== undefined) update["system.force_bonus_degats"] = Number(profile.degats) || 0;
      if (profile.poids !== undefined) {
        const weight = Number(profile.poids) || 0;
        update["system.force_poids"] = weight;
        update["system.charge_max"] = weight;
        update["system.charge_max_bench"] = weight;
      }
      if (profile.ouvrir !== undefined) {
        update["system.force_ouvrir"] = profile.ouvrir;
        update["system.force_bonus_porte"] = profile.ouvrir;
      }
      if (profile.tordre !== undefined) update["system.force_tordre"] = profile.tordre;
    }

    const mappings = {
      dexterite: {
        display: "system.dex_aff",
        fields: { att: "system.dex_att", def: "system.dex_def" }
      },
      constitution: {
        display: "system.con_aff",
        fields: { pv: "system.con_pv", trauma: "system.con_trauma", resu: "system.con_resu" }
      },
      intelligence: {
        display: "system.int_aff",
        fields: { langues: "system.int_langues", chance_sort: "system.int_chance_sort", min_sort: "system.int_min_sort", max_sort: "system.int_max_sort", sort_par_niveau: "system.int_sort_par_niveau" }
      },
      sagesse: {
        display: "system.sag_aff",
        fields: { magie: "system.sag_magie", sort_suppl: "system.sag_sort_suppl", echec: "system.sag_echec" }
      },
      charisme: {
        display: "system.cha_aff",
        fields: { compagnons: "system.cha_compagnons", loy: "system.cha_loy", react: "system.cha_react" }
      }
    };

    for (const [characteristic, mapping] of Object.entries(mappings)) {
      const row = overrides[characteristic];
      if (!row) continue;
      update[mapping.display] = row.displayValue;
      for (const [key, path] of Object.entries(mapping.fields)) {
        if (row.profile?.[key] !== undefined) update[path] = Number(row.profile[key]) || 0;
      }
    }

    const diff = {};
    for (const [path, value] of Object.entries(update)) {
      if (foundry.utils.getProperty(actor, path) !== value) diff[path] = value;
    }
    if (Object.keys(diff).length) {
      await actor.update(diff, {
        add2eInternal: true,
        add2eReason: "generic-characteristic-profile",
        render: false
      });
    }
    globalThis.add2eRerenderActorSheet?.(actor, true);
    return true;
  } finally {
    actor.__add2eCharacteristicProfileInProgress = false;
  }
}

function installProfileBridge() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  const base = proto?.autoSetCaracAjustements;
  if (typeof base !== "function" || base.__add2eCharacteristicProfileBridge) return false;
  const wrapped = async function add2eAutoSetCaracAjustementsWithProfiles(...args) {
    const result = await base.apply(this, args);
    await applyProfiles(this.actor);
    return result;
  };
  wrapped.__add2eCharacteristicProfileBridge = true;
  wrapped.__add2eBase = base;
  proto.autoSetCaracAjustements = wrapped;
  return true;
}

Hooks.once("ready", () => installProfileBridge());
