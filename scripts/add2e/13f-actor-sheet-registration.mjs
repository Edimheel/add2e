// ADD2E — Enregistrement de la feuille personnage ApplicationV2

import { Add2eActorSheet } from "./13a-actor-sheet-class.mjs";

function add2eRegisterCharacterSheet() {
  const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;
  const ActorDocument = foundry.documents.Actor;
  if (!DocumentSheetConfig?.registerSheet) throw new Error("[ADD2E] DocumentSheetConfig.registerSheet est indisponible.");
  if (!ActorDocument) throw new Error("[ADD2E] Le document Actor est indisponible pour l’enregistrement de la feuille personnage.");

  DocumentSheetConfig.registerSheet(ActorDocument, game.system.id, Add2eActorSheet, {
    types: ["personnage"],
    makeDefault: true,
    canConfigure: true,
    canBeDefault: true,
    label: "ADD2e Personnage"
  });
}

Hooks.once("init", add2eRegisterCharacterSheet);

const ADD2E_REVERSIBLE_COMPONENT_MODE_VERSION = "2026-06-23-reversible-components-entry-mode-v1";
globalThis.ADD2E_REVERSIBLE_COMPONENT_MODE_VERSION = ADD2E_REVERSIBLE_COMPONENT_MODE_VERSION;

function add2eReversibleNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "_")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eReversibleClone(value) {
  try { return foundry.utils.deepClone(value); }
  catch (_error) { return JSON.parse(JSON.stringify(value)); }
}

function add2eReversibleCondition(rule) {
  if (!rule || typeof rule !== "object") return "";
  return String(rule.condition ?? rule.conditions ?? rule.sourceCondition ?? rule.modeCondition ?? "").trim();
}

function add2eIsInverseOnlyComponentRule(rule) {
  const condition = add2eReversibleNormalize(add2eReversibleCondition(rule));
  return condition === "inverse"
    || condition.startsWith("sort_inverse")
    || condition.startsWith("forme_inverse")
    || condition.startsWith("inverse_");
}

function add2eReversibleRulesFor(doc) {
  const system = doc?.system ?? {};
  for (const value of [system.composants_materiels, system.composantsMateriels, doc?.composants_materiels]) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function add2eReversibleEntryMode(doc) {
  const system = doc?.system ?? {};
  const entry = doc?.flags?.add2e?.reversibleActorEntry ?? system.reversibleActorEntry ?? {};
  const explicit = add2eReversibleNormalize(typeof entry === "object" ? entry.mode : entry);
  if (["inverse", "inversee", "invers", "reversed"].includes(explicit)) return "inverse";
  if (["normal", "base", "original"].includes(explicit)) return "normal";

  const name = add2eReversibleNormalize(doc?.name ?? system.nom);
  for (const rule of add2eReversibleRulesFor(doc)) {
    if (!add2eIsInverseOnlyComponentRule(rule)) continue;
    const target = add2eReversibleNormalize(add2eReversibleCondition(rule))
      .replace(/^(?:sort|forme)_inverse_?/, "")
      .replace(/^inverse_?/, "");
    if (target && name && (target === name || target.includes(name) || name.includes(target))) return "inverse";
  }
  return "normal";
}

function add2eFilterReversibleRuleArray(value, mode) {
  if (!Array.isArray(value)) return value;
  const inverseRules = value.filter(add2eIsInverseOnlyComponentRule);
  if (!inverseRules.length) return value;
  return mode === "inverse"
    ? inverseRules
    : value.filter(rule => !add2eIsInverseOnlyComponentRule(rule));
}

function add2eSortForReversibleComponents(sort) {
  if (!sort) return sort;

  const data = typeof sort.toObject === "function"
    ? sort.toObject()
    : {
      id: sort.id,
      _id: sort._id ?? sort.id,
      uuid: sort.uuid,
      name: sort.name,
      system: add2eReversibleClone(sort.system ?? {}),
      flags: add2eReversibleClone(sort.flags ?? {})
    };

  data.id ??= sort.id;
  data._id ??= sort._id ?? sort.id;
  data.uuid ??= sort.uuid;
  data.name ??= sort.name;
  data.system = add2eReversibleClone(data.system ?? sort.system ?? {});
  data.flags = add2eReversibleClone(data.flags ?? sort.flags ?? {});

  const mode = add2eReversibleEntryMode({ ...data, system: data.system, flags: data.flags });
  const fields = [
    "composants_materiels",
    "composantsMateriels",
    "composants_requis",
    "composants_materiels_objets"
  ];

  for (const field of fields) {
    if (Array.isArray(data.system[field])) data.system[field] = add2eFilterReversibleRuleArray(data.system[field], mode);
  }
  if (Array.isArray(data.composants_materiels)) data.composants_materiels = add2eFilterReversibleRuleArray(data.composants_materiels, mode);

  const add2eFlags = data.flags.add2e ??= {};
  for (const field of ["composants_materiels", "composants_requis", "components", "requiredComponents"]) {
    if (Array.isArray(add2eFlags[field])) add2eFlags[field] = add2eFilterReversibleRuleArray(add2eFlags[field], mode);
  }

  return data;
}

function add2eCollectReversibleComponentLabels(value, out = []) {
  if (value === null || value === undefined || value === "") return out;
  if (Array.isArray(value)) {
    for (const entry of value) add2eCollectReversibleComponentLabels(entry, out);
    return out;
  }
  if (typeof value === "object") {
    const alternatives = value.alternatives ?? value.options ?? value.choix ?? value.auChoix ?? value.or;
    if (Array.isArray(alternatives) && alternatives.length) {
      const labels = [];
      add2eCollectReversibleComponentLabels(alternatives, labels);
      if (labels.length) out.push(labels.join(" ou "));
      return out;
    }
    const name = value.nom ?? value.name ?? value.label ?? value.item ?? value.itemName ?? value.component ?? value.composant ?? value.slug ?? value.id;
    if (name !== undefined && name !== null && String(name).trim()) out.push(String(name).trim());
    return out;
  }
  for (const label of String(value).split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean)) out.push(label);
  return out;
}

function add2eFormatReversibleComponentDisplay(system = {}) {
  const values = [
    system.composants_materiels,
    system.composants_materiels_objets,
    system.composants_requis
  ];
  const names = [];
  for (const value of values) {
    add2eCollectReversibleComponentLabels(value, names);
    if (names.length) break;
  }
  const seen = new Set();
  const clean = names.filter(name => {
    const key = add2eReversibleNormalize(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return clean.length ? clean.join(", ") : "—";
}

function add2ePostprocessReversibleSpellRows(data) {
  for (const level of data?.add2eSpellLevels ?? []) {
    for (const row of level?.sorts ?? []) {
      const filtered = add2eSortForReversibleComponents(row);
      row.system = filtered.system;
      row.flags = filtered.flags;
      row.composants_materiels_brut = add2eReversibleClone(filtered.system?.composants_materiels ?? []);
      row.composants_materiels_objets = add2eReversibleClone(filtered.system?.composants_materiels_objets ?? []);
      row.composants_requis = add2eReversibleClone(filtered.system?.composants_requis ?? []);
      row.composants_materiels = add2eFormatReversibleComponentDisplay(filtered.system ?? {});
    }
  }
  return data;
}

function add2eObjectMagicPowerArray(item) {
  const raw = item?.system?.pouvoirs
    ?? item?.system?.powers
    ?? item?.system?.pouvoirsMagiques
    ?? item?.system?.magicalPowers
    ?? [];
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") return Object.values(raw);
  return [];
}

function add2eLinkedSpellDisplayName(power) {
  if (!power || typeof power !== "object") return "";
  const linkedEffect = (Array.isArray(power.effects) ? power.effects : [])
    .find(effect => add2eReversibleNormalize(effect?.type ?? effect?.kind) === "linked_spell");
  return String(
    power.parameters?.spellName
    ?? linkedEffect?.spellName
    ?? power.linkedSpell?.name
    ?? power.linkedSpell?.nom
    ?? ""
  ).trim();
}

function add2ePostprocessObjectMagicLinkedSpellNames(data, actor) {
  const items = new Map(Array.from(actor?.items ?? []).map(item => [String(item.id), item]));
  const rename = row => {
    const itemId = String(row?.sourceItemId ?? row?.itemId ?? "");
    const powerIndex = Number(row?.powerIndex);
    if (!itemId || !Number.isInteger(powerIndex)) return;
    const sourceItem = items.get(itemId);
    const power = add2eObjectMagicPowerArray(sourceItem)[powerIndex];
    const spellName = add2eLinkedSpellDisplayName(power);
    if (spellName) row.name = spellName;
  };

  for (const row of data?.add2eObjectMagicPowers ?? []) rename(row);
  for (const item of data?.add2eObjectMagicItems ?? []) {
    for (const row of item?.powers ?? []) rename(row);
  }
  for (const row of data?.add2ePotionRows ?? []) rename(row);
  return data;
}

function add2ePatchReversibleComponentSheetRows() {
  const prototype = Add2eActorSheet.prototype;
  if (prototype.__add2eReversibleComponentSheetRowsV1) return true;
  if (typeof prototype.getData !== "function") {
    throw new Error("[ADD2E] Add2eActorSheet.getData est indisponible pour les composants réversibles.");
  }

  prototype.__add2eReversibleComponentSheetRowsV1 = true;
  const originalGetData = prototype.getData;
  prototype.getData = async function add2eReversibleComponentGetData(...args) {
    const data = await originalGetData.apply(this, args);
    add2ePostprocessReversibleSpellRows(data);
    return add2ePostprocessObjectMagicLinkedSpellNames(data, this.actor ?? data?.actor);
  };
  return true;
}

function add2eWrapReversibleComponentApi(endpoint) {
  if (!endpoint || typeof endpoint !== "object") return false;
  let changed = false;

  const reserve = endpoint.add2eReserveSpellComponents;
  if (typeof reserve === "function" && !reserve.__add2eReversibleComponentModeV1) {
    const wrappedReserve = async function add2eReserveReversibleSpellComponents(actor, sort) {
      return reserve.call(this, actor, add2eSortForReversibleComponents(sort));
    };
    wrappedReserve.__add2eReversibleComponentModeV1 = true;
    endpoint.add2eReserveSpellComponents = wrappedReserve;
    changed = true;
  }

  const resolve = endpoint.add2eResolveSpellMaterialComponents;
  if (typeof resolve === "function" && !resolve.__add2eReversibleComponentModeV1) {
    const wrappedResolve = function add2eResolveReversibleSpellMaterialComponents(sort) {
      return resolve.call(this, add2eSortForReversibleComponents(sort));
    };
    wrappedResolve.__add2eReversibleComponentModeV1 = true;
    endpoint.add2eResolveSpellMaterialComponents = wrappedResolve;
    changed = true;
  }

  return changed;
}

function add2eInstallReversibleComponentApiBridge() {
  const endpoints = [
    globalThis.ADD2E_CONSUMABLES,
    game?.add2e?.consumables
  ].filter(endpoint => endpoint && typeof endpoint === "object");

  let changed = false;
  for (const endpoint of new Set(endpoints)) changed = add2eWrapReversibleComponentApi(endpoint) || changed;

  if (globalThis.ADD2E_CONSUMABLES?.add2eReserveSpellComponents) {
    globalThis.add2eReserveSpellComponents = globalThis.ADD2E_CONSUMABLES.add2eReserveSpellComponents;
  }
  return changed;
}

add2ePatchReversibleComponentSheetRows();
Hooks.once("ready", add2eInstallReversibleComponentApiBridge);
