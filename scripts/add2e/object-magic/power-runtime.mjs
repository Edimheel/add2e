// ADD2E — Objets magiques : charges et exécution des pouvoirs.
// Compatible Foundry V13/V14/V15.

import {
  add2eMagicClone,
  add2eObjectMagicNormalizeTag,
  add2eObjectMagicToArray
} from "./core.mjs";

export function add2eObjectPowerOnUsePath(power) {
  return String(
    power?.onUse
    ?? power?.onuse
    ?? power?.on_use
    ?? power?.script
    ?? power?.macro
    ?? power?.objetMagicOnUse
    ?? power?.fallbackOnUse
    ?? power?.onUseSortPath
    ?? power?.linkedSpell?.onUse
    ?? power?.linkedSpell?.onuse
    ?? power?.linkedSpell?.on_use
    ?? ""
  ).trim();
}

export function add2eObjectPowerCost(power) {
  return Math.max(0, Math.floor(Number(power?.parameters?.chargeCost ?? 0) || 0));
}

function add2eObjectGlobalChargeMax(itemSource) {
  const value = Number(itemSource?.system?.charges?.max);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function add2eObjectGlobalChargeCurrent(itemSource, maximum = add2eObjectGlobalChargeMax(itemSource)) {
  if (maximum <= 0) return 0;
  const value = Number(itemSource?.system?.charges?.value);
  if (!Number.isFinite(value)) return maximum;
  return Math.max(0, Math.min(Math.floor(value), maximum));
}

async function add2eObjectSetGlobalCharges(itemSource, value, reason = "object-magic-power-charges") {
  const maximum = add2eObjectGlobalChargeMax(itemSource);
  if (maximum <= 0) {
    throw new Error(`L’objet magique « ${itemSource?.name ?? "Objet"} » ne possède pas de system.charges.max canonique.`);
  }
  const next = Math.max(0, Math.min(maximum, Math.floor(Number(value) || 0)));
  await itemSource.update(
    { "system.charges.value": next },
    { add2eInternal: true, add2eReason: reason, render: false }
  );
  return next;
}

export function add2eObjectPowerMaxCharges(itemSource, power, _index) {
  const globalMax = add2eObjectGlobalChargeMax(itemSource);
  if (globalMax > 0) return globalMax;
  return add2eObjectPowerCost(power) > 0 ? 0 : 1;
}

export function add2eObjectPowerCurrentCharges(itemSource, power, _index) {
  const cost = add2eObjectPowerCost(power);
  if (cost <= 0) return 1;

  const globalMax = add2eObjectGlobalChargeMax(itemSource);
  if (globalMax <= 0) return 0;
  return add2eObjectGlobalChargeCurrent(itemSource, globalMax);
}

export async function add2eObjectPowerSetCharges(itemSource, power, _index, value) {
  const globalMax = add2eObjectGlobalChargeMax(itemSource);
  if (globalMax <= 0) {
    if (add2eObjectPowerCost(power) <= 0) return 1;
    throw new Error(`L’objet magique « ${itemSource?.name ?? "Objet"} » utilise des charges sans system.charges.max canonique.`);
  }
  return add2eObjectSetGlobalCharges(itemSource, value);
}

export function add2eMagicItemRechargeInfo(itemSource) {
  const charges = itemSource?.system?.charges;
  const maximum = add2eObjectGlobalChargeMax(itemSource);
  const current = add2eObjectGlobalChargeCurrent(itemSource, maximum);
  const rechargeable = charges?.rechargeable === true;
  const formula = String(charges?.rechargeFormula ?? "").trim();
  return {
    rechargeable,
    formula,
    current,
    maximum,
    available: rechargeable && Boolean(formula) && maximum > 0 && current < maximum
  };
}

function add2eMagicItemRechargeResource(actor, itemSource) {
  const info = add2eMagicItemRechargeInfo(itemSource);
  return {
    id: `${itemSource?.uuid ?? itemSource?.id}:magic-item-recharge`,
    type: "magic-item-charge",
    label: `${itemSource?.name ?? "Objet magique"} — charges`,
    document: itemSource,
    actor,
    item: itemSource,
    target: "global",
    get current() {
      return add2eObjectGlobalChargeCurrent(itemSource, info.maximum);
    },
    maximum: info.maximum,
    recovery: 0,
    source: {
      kind: "magic-item",
      id: String(itemSource?.id ?? ""),
      uuid: String(itemSource?.uuid ?? ""),
      name: String(itemSource?.name ?? "Objet magique")
    },
    context: {
      consumer: "object-magic/power-runtime",
      operation: "recharge"
    },
    write: next => add2eObjectSetGlobalCharges(itemSource, next, "object-magic-recharge")
  };
}

export async function add2eRechargeMagicItemCharges(actor, itemSource) {
  if (!itemSource) throw new Error("Objet magique introuvable pour la recharge.");
  const info = add2eMagicItemRechargeInfo(itemSource);
  if (!info.rechargeable) throw new Error(`L’objet magique « ${itemSource.name} » n’est pas rechargeable.`);
  if (!info.formula) throw new Error(`L’objet magique « ${itemSource.name} » ne possède pas de rechargeFormula canonique.`);
  if (info.maximum <= 0) throw new Error(`L’objet magique « ${itemSource.name} » ne possède pas de maximum de charges canonique.`);
  if (info.current >= info.maximum) {
    return { ok: false, reason: "full", item: itemSource, before: info.current, after: info.current, maximum: info.maximum };
  }

  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!engine || typeof engine.recoverResource !== "function") {
    throw new Error("Le domaine canonique ADD2E resource n’est pas disponible pour la recharge d’objet magique.");
  }

  const roll = await new Roll(info.formula).evaluate();
  const rolled = Math.max(0, Math.floor(Number(roll.total) || 0));
  const recovery = await engine.recoverResource(add2eMagicItemRechargeResource(actor, itemSource), {
    amount: rolled,
    reason: "magic-item-recharge",
    consumer: "object-magic/power-runtime"
  });
  if (!recovery?.ok) {
    return { ok: false, reason: recovery?.reason ?? "resource-recovery-failed", item: itemSource, roll, formula: info.formula, rolled, recovery };
  }

  const state = recovery.resources?.[0] ?? null;
  const before = Number(state?.before ?? info.current) || 0;
  const after = Number(state?.after ?? add2eObjectGlobalChargeCurrent(itemSource, info.maximum)) || 0;
  return {
    ok: true,
    item: itemSource,
    roll,
    formula: info.formula,
    rolled,
    recovered: Math.max(0, after - before),
    before,
    after,
    maximum: Number(state?.maximum ?? info.maximum) || info.maximum,
    recovery
  };
}

export function add2eMagicPowerGeneratedId(item, index) {
  return String(item?.id ?? "00000000000000").substring(0, 14) + String(index).padStart(2, "0");
}

function add2eVirtualItemParent(actor) {
  const DataModelClass = globalThis.foundry?.abstract?.DataModel
    ?? globalThis.foundry?.data?.DataModel
    ?? null;
  if (typeof DataModelClass === "function") return actor instanceof DataModelClass ? actor : null;
  return actor?.documentName === "Actor" && typeof actor?.getRollData === "function" ? actor : null;
}

export function add2eBuildVirtualObjectPowerSort(actor, itemSource, power, index) {
  const generatedId = add2eMagicPowerGeneratedId(itemSource, index);
  const onUse = add2eObjectPowerOnUsePath(power);
  const cost = add2eObjectPowerCost(power);
  const max = cost <= 0
    ? Math.max(1, add2eObjectPowerMaxCharges(itemSource, power, index))
    : add2eObjectPowerMaxCharges(itemSource, power, index);
  const current = cost <= 0 ? 1 : add2eObjectPowerCurrentCharges(itemSource, power, index);
  const linkedSystem = power?.linkedSpell?.system && typeof power.linkedSpell.system === "object"
    ? add2eMagicClone(power.linkedSpell.system)
    : {};
  const fakeData = {
    _id: generatedId,
    name: String(power?.name ?? power?.nom ?? power?.label ?? itemSource?.name ?? "Pouvoir").trim() || "Pouvoir",
    type: "sort",
    img: power?.img || itemSource?.img || "icons/svg/aura.svg",
    system: {
      ...linkedSystem,
      niveau: Number(power?.niveau ?? power?.level ?? linkedSystem.niveau ?? linkedSystem.level ?? 1) || 1,
      école: power?.ecole || power?.["école"] || "Magique",
      description: power?.description || power?.desc || itemSource?.system?.description || "",
      composantes: "Objet",
      temps_incantation: power?.activation || power?.temps_incantation || "Objet magique",
      isPower: true,
      isObjectPower: true,
      sourceItemId: itemSource.id,
      sourceWeaponId: itemSource.id,
      sourceItemName: itemSource.name,
      powerIndex: index,
      cost,
      cout: cost,
      max,
      isGlobalCharge: add2eObjectGlobalChargeMax(itemSource) > 0,
      onUse,
      onuse: onUse,
      on_use: onUse,
      objetMagicOnUse: power?.objetMagicOnUse || power?.fallbackOnUse || "",
      linkedSpell: power?.linkedSpell || null
    },
    flags: {
      add2e: {
        memorizedCount: current,
        originalOnUse: onUse,
        sourceType: "objet_magique",
        sourceItemId: itemSource.id,
        sourceItemName: itemSource.name,
        powerIndex: index
      }
    }
  };
  const parent = add2eVirtualItemParent(actor);
  const sort = parent ? new Item(fakeData, { parent }) : new Item(fakeData);
  sort.getFlag = (scope, key) => {
    if (scope !== "add2e") return null;
    if (key === "memorizedCount") return cost <= 0 ? 1 : add2eObjectPowerCurrentCharges(itemSource, power, index);
    if (key === "originalOnUse") return onUse;
    return fakeData.flags?.add2e?.[key] ?? null;
  };
  return sort;
}

export async function add2eExecuteObjectMagicPower(actor, itemSource, power, index, sheet = null) {
  if (!actor || !itemSource || !power) {
    ui.notifications.error("Pouvoir d'objet magique introuvable.");
    return false;
  }
  const powerName = String(power?.name ?? power?.nom ?? power?.label ?? itemSource.name ?? "Pouvoir").trim() || "Pouvoir";
  const onUse = add2eObjectPowerOnUsePath(power);
  if (!onUse) {
    ui.notifications.warn(`${powerName} n'a pas de script utilisable.`);
    return false;
  }
  if (typeof globalThis.add2eCastSpell !== "function") {
    ui.notifications.error("Le lanceur canonique ADD2E des sorts et pouvoirs est indisponible.");
    return false;
  }

  const sort = add2eBuildVirtualObjectPowerSort(actor, itemSource, power, index);
  const result = await globalThis.add2eCastSpell({
    actor,
    sort,
    mode: "power",
    sourceItem: itemSource
  });
  if (result !== true) return false;

  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
  return true;
}

function add2eMagicItemIsPotion(item) {
  if (String(item?.type ?? "").toLowerCase() !== "objet") return false;
  const system = item?.system ?? {};
  const values = [
    system.sousType,
    system.sous_type,
    system.typeObjet,
    system.type_objet,
    system.categorie,
    system.category,
    system.forme,
    system.kind,
    ...add2eObjectMagicToArray(system.tags),
    ...add2eObjectMagicToArray(system.effectTags),
    item?.flags?.add2e?.kind,
    item?.flags?.add2e?.category
  ].map(add2eObjectMagicNormalizeTag).filter(Boolean);
  return values.some(value =>
    value === "potion"
    || value.startsWith("potion_")
    || value.endsWith("_potion")
    || value.includes("consommable_potion")
  );
}

export function add2eMagicItemEquippedOrUsable(item) {
  const system = item?.system ?? {};
  return add2eMagicItemIsPotion(item) || system.equipee === true || system.equipped === true;
}

export function add2eMagicObjectRawPowers(item) {
  if (!add2eMagicItemEquippedOrUsable(item)) return [];
  return item?.system?.pouvoirs ?? [];
}

export function add2eMagicObjectPowerArray(item) {
  const raw = add2eMagicObjectRawPowers(item);
  if (Array.isArray(raw)) return raw.filter(power => power && typeof power === "object");
  if (raw && typeof raw === "object") return Object.values(raw).filter(power => power && typeof power === "object");
  return [];
}

export function add2eMagicObjectActivePowerEntries(item) {
  return add2eMagicObjectPowerArray(item)
    .map((power, index) => ({ power, index }))
    .filter(entry => add2eObjectPowerOnUsePath(entry.power));
}

export function add2eMagicObjectChargeInfo(item, _powers = null) {
  const max = add2eObjectGlobalChargeMax(item);
  if (max <= 0) return { current: 0, max: 0, label: "—" };

  const current = add2eObjectGlobalChargeCurrent(item, max);
  return { current, max, label: `${current}/${max}` };
}

export function add2eMagicLooksMagical(item) {
  const system = item?.system ?? {};
  const tags = add2eObjectMagicToArray(system.tags ?? system.effectTags ?? system.effets ?? system.effects)
    .map(add2eObjectMagicNormalizeTag);
  const name = String(item?.name ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return tags.some(tag => tag.includes("magique") || tag.includes("magic"))
    || name.includes("magique")
    || system.magique === true
    || system.magic === true;
}
