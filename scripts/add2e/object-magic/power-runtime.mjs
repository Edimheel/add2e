// ADD2E — Objets magiques : charges et exécution des pouvoirs.
// Compatible Foundry V13/V14/V15.

import {
  add2eMagicClone,
  add2eMagicReadNumber,
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
  return Math.max(0, Number(power?.cout ?? power?.cost ?? power?.chargeCost ?? 0) || 0);
}

export function add2eObjectPowerMaxCharges(itemSource, power, _index) {
  const system = itemSource?.system ?? {};
  const globalMax = add2eMagicReadNumber(
    system?.charges?.max,
    system?.charges?.maximum,
    system?.max_charges,
    system?.maxCharges,
    system?.chargesMax
  );
  if (Number.isFinite(globalMax) && globalMax > 0) return globalMax;
  return Number(
    power?.max
    ?? power?.chargesMax
    ?? power?.maxCharges
    ?? power?.charges?.max
    ?? power?.charges
    ?? 1
  ) || 1;
}

export function add2eObjectPowerCurrentCharges(itemSource, power, index) {
  const system = itemSource?.system ?? {};
  if (add2eObjectPowerCost(power) <= 0) return 1;
  const globalMax = add2eMagicReadNumber(
    system?.charges?.max,
    system?.charges?.maximum,
    system?.max_charges,
    system?.maxCharges,
    system?.chargesMax
  );
  if (Number.isFinite(globalMax) && globalMax > 0) {
    const current = add2eMagicReadNumber(
      system?.charges?.value,
      system?.charges?.current,
      system?.charges?.actuel,
      system?.charges?.remaining,
      system?.chargesValeur,
      system?.charges_value,
      system?.current_charges,
      system?.currentCharges,
      system?.charges_actuelles,
      system?.chargesRestantes,
      system?.remainingCharges
    );
    if (Number.isFinite(current)) return Math.max(0, Math.min(current, globalMax));
    const flag = add2eMagicReadNumber(
      itemSource?.getFlag?.("add2e", "global_charges"),
      itemSource?.getFlag?.("add2e", "charges")
    );
    return Number.isFinite(flag) ? Math.max(0, Math.min(flag, globalMax)) : globalMax;
  }
  const flag = itemSource?.getFlag?.("add2e", `charges_${index}`);
  if (flag !== undefined && flag !== null && flag !== "") return Number(flag) || 0;
  return Number(power?.charges?.value ?? power?.charges ?? power?.value ?? power?.max ?? 1) || 0;
}

export async function add2eObjectPowerSetCharges(itemSource, _power, index, value) {
  const system = itemSource?.system ?? {};
  const globalMax = add2eMagicReadNumber(
    system?.charges?.max,
    system?.charges?.maximum,
    system?.max_charges,
    system?.maxCharges,
    system?.chargesMax
  );
  const next = Math.max(0, Number(value) || 0);
  if (Number.isFinite(globalMax) && globalMax > 0) {
    const clamped = Math.min(next, globalMax);
    if (system?.charges && typeof system.charges === "object") {
      await itemSource.update({ "system.charges.value": clamped });
    }
    await itemSource.setFlag?.("add2e", "global_charges", clamped);
    return;
  }
  await itemSource.setFlag?.("add2e", `charges_${index}`, next);
}

export function add2eMagicPowerGeneratedId(item, index) {
  return String(item?.id ?? "00000000000000").substring(0, 14) + String(index).padStart(2, "0");
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
      isGlobalCharge: Number(itemSource?.system?.charges?.max ?? itemSource?.system?.max_charges ?? 0) > 0,
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
  const sort = new Item(fakeData, { parent: actor });
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
  const cost = add2eObjectPowerCost(power);
  const current = add2eObjectPowerCurrentCharges(itemSource, power, index);
  if (!onUse) {
    ui.notifications.warn(`${powerName} n'a pas de script utilisable.`);
    return false;
  }
  if (cost > 0 && current < cost) {
    ui.notifications.warn(`${itemSource.name} n'a pas assez de charges pour utiliser ${powerName}.`);
    return false;
  }
  const sort = add2eBuildVirtualObjectPowerSort(actor, itemSource, power, index);
  try {
    const url = onUse.includes("?") ? `${onUse}&cb=${Date.now()}` : `${onUse}?cb=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const code = await response.text();
    const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
    const scope = {
      actor,
      item: itemSource,
      sourceItem: itemSource,
      sort,
      power,
      pouvoir: power,
      powerIndex: index,
      isObjectPower: true
    };
    const args = [{ actor, item: itemSource, sourceItem: itemSource, sort, power, pouvoir: power, powerIndex: index, scope }];
    const runner = new AsyncFunction(
      "actor", "item", "sourceItem", "sort", "power", "pouvoir", "powerIndex", "scope", "args",
      "game", "ui", "ChatMessage", "Roll", "foundry", "canvas",
      code
    );
    const result = await runner(
      actor, itemSource, itemSource, sort, power, power, index, scope, args,
      game, ui, ChatMessage, Roll, foundry, canvas
    );
    if (result !== false && cost > 0) {
      await add2eObjectPowerSetCharges(itemSource, power, index, current - cost);
    }
    if (result !== false) {
      sheet?._add2eRememberActiveTab?.();
      sheet?.render?.(false);
      return true;
    }
    return false;
  } catch (error) {
    console.error("[ADD2E][OBJET_MAGIQUE][POUVOIR_ERREUR]", {
      actor: actor.name,
      item: itemSource.name,
      power: powerName,
      onUse,
      error
    });
    ui.notifications.error(`Erreur pendant l'utilisation de ${powerName} : ${error.message}`);
    return false;
  }
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

export function add2eMagicObjectChargeInfo(item, powers = null) {
  const system = item?.system ?? {};
  const list = powers ?? add2eMagicObjectPowerArray(item);
  let max = add2eMagicReadNumber(
    system?.charges?.max,
    system?.charges?.maximum,
    system?.max_charges,
    system?.maxCharges,
    system?.charges_max,
    system?.chargesMax,
    system?.max,
    ...list.map(power => power.max ?? power.maxCharges ?? power.chargesMax ?? power.charges_max)
  );
  if (!Number.isFinite(max) || max < 0) max = 0;
  let current = add2eMagicReadNumber(
    system?.charges?.value,
    system?.charges?.current,
    system?.charges?.actuel,
    system?.charges?.remaining,
    system?.current_charges,
    system?.currentCharges,
    system?.charges_actuelles,
    system?.chargesRestantes,
    system?.remainingCharges,
    item?.getFlag?.("add2e", "global_charges"),
    item?.getFlag?.("add2e", "charges")
  );
  if (!Number.isFinite(current)) current = max;
  if (max > 0) current = Math.max(0, Math.min(current, max));
  return { current, max, label: max > 0 ? `${current}/${max}` : "—" };
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
