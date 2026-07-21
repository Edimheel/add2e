// scripts/add2e/object-magic-powers.mjs
// ADD2E — Pouvoirs d'objets magiques, générateur unifié et catalogue réutilisable.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.

const ADD2E_MAGIC_ITEM_BUILDER_VERSION = "2026-07-21-magic-item-builder-v8-integrated-catalogue";
const ADD2E_MAGIC_ITEM_TYPES = new Set(["arme", "armure", "objet"]);
const ADD2E_MAGIC_CATALOGUE_SELECTION_SCHEMA = 1;
const ADD2E_MAGIC_CATALOGUE_POWER_SCHEMA = 2;
const ADD2E_MAGIC_CREATOR_STATES = new WeakMap();

function add2eObjectMagicEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eObjectMagicToArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eObjectMagicToArray);
  if (value instanceof Set) return [...value].flatMap(add2eObjectMagicToArray);
  if (typeof value === "string") return value.split(/[,;\n|]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["value", "list", "lists", "items", "tags", "effectTags"]) {
      if (value[key] !== undefined && value[key] !== null) return add2eObjectMagicToArray(value[key]);
    }
  }
  return [value];
}

function add2eObjectMagicNormalizeTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eMagicClone(value) {
  try { return foundry.utils.deepClone(value); }
  catch (_error) {
    try { return structuredClone(value); }
    catch (_cloneError) { return JSON.parse(JSON.stringify(value ?? null)); }
  }
}

function add2eMagicGetProperty(object, path) {
  try { return foundry.utils.getProperty(object, path); }
  catch (_error) { return String(path).split(".").reduce((current, key) => current?.[key], object); }
}

function add2eMagicSetProperty(object, path, value) {
  try { return foundry.utils.setProperty(object, path, value); }
  catch (_error) {
    const parts = String(path).split(".");
    let current = object;
    while (parts.length > 1) {
      const key = parts.shift();
      current[key] ??= {};
      current = current[key];
    }
    current[parts[0]] = value;
    return true;
  }
}

function add2eMagicMerge(base, update) {
  try {
    return foundry.utils.mergeObject(add2eMagicClone(base ?? {}), add2eMagicClone(update ?? {}), {
      inplace: false,
      insertKeys: true,
      overwrite: true,
      recursive: true
    });
  } catch (_error) {
    return { ...(base ?? {}), ...(update ?? {}) };
  }
}

function add2eMagicNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

function add2eMagicOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function add2eMagicSigned(value) {
  const number = add2eMagicNumber(value, 0);
  return `${number >= 0 ? "+" : ""}${number}`;
}

function add2eMagicMergeUniqueValues(...values) {
  const seen = new Set();
  const result = [];
  for (const raw of values) {
    for (const value of add2eObjectMagicToArray(raw)) {
      const text = String(value ?? "").trim();
      const key = text.toLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      result.push(text);
    }
  }
  return result;
}

export function add2eMagicReadNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") {
      const nested = add2eMagicReadNumber(value.value, value.current, value.actuel, value.remaining, value.max);
      if (Number.isFinite(nested)) return nested;
      continue;
    }
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return NaN;
}

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
  const system = item?.system ?? {};
  return system.pouvoirs
    ?? system.powers
    ?? system.pouvoirsMagiques
    ?? system.magicalPowers
    ?? system.sorts
    ?? system.spells
    ?? [];
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

export function add2eUiCollectObjectMagicGroups(actor) {
  const groups = [];
  const itemSources = actor?.items?.filter?.(item => {
    const type = String(item?.type ?? "").toLowerCase();
    if (!["arme", "armure", "objet", "object", "magic", "objet_magique"].includes(type)) return false;
    return add2eMagicItemEquippedOrUsable(item) && add2eMagicObjectActivePowerEntries(item).length > 0;
  }) ?? [];
  for (const itemSource of itemSources) {
    const powerEntries = add2eMagicObjectActivePowerEntries(itemSource);
    if (!powerEntries.length) continue;
    const chargeInfo = add2eMagicObjectChargeInfo(itemSource, powerEntries.map(entry => entry.power));
    const maxGlobal = Number(chargeInfo.max) || 0;
    const isGlobal = maxGlobal > 0;
    const powers = [];
    for (const { power, index } of powerEntries) {
      const max = isGlobal
        ? maxGlobal
        : Number(power.max ?? power.maxCharges ?? power.chargesMax ?? power.charges_max ?? itemSource.system?.charges ?? 1) || 1;
      const charges = isGlobal
        ? chargeInfo.current
        : itemSource.getFlag?.("add2e", `charges_${index}`) ?? power.charges ?? itemSource.system?.charges ?? max;
      powers.push({
        id: add2eMagicPowerGeneratedId(itemSource, index),
        name: String(power.name || power.nom || power.label || itemSource.name || "Pouvoir").trim() || "Pouvoir",
        img: power.img || itemSource.img || "icons/svg/aura.svg",
        sourceItemId: itemSource.id,
        sourceName: itemSource.name || "Objet magique",
        sourceImg: itemSource.img || "icons/svg/item-bag.svg",
        niveau: Number(power.niveau ?? power.level ?? 1) || 1,
        description: power.description || power.desc || "",
        charges: Number(charges) || 0,
        max,
        cost: Number(power.cout ?? power.cost ?? 0) || 0
      });
    }
    groups.push({
      itemId: itemSource.id,
      itemName: itemSource.name || "Objet magique",
      itemImg: itemSource.img || "icons/svg/item-bag.svg",
      charges: chargeInfo.current,
      max: chargeInfo.max,
      chargeLabel: chargeInfo.label,
      powers: powers.sort((left, right) => String(left.name).localeCompare(String(right.name), "fr"))
    });
  }
  return groups.sort((left, right) => String(left.itemName).localeCompare(String(right.itemName), "fr"));
}

export function add2eUiCollectObjectMagicPowers(actor) {
  return add2eUiCollectObjectMagicGroups(actor).flatMap(group => group.powers);
}

export function add2eUiBuildObjectMagicSection(actor) {
  const groups = add2eUiCollectObjectMagicGroups(actor);
  const content = groups.length
    ? groups.map(group => {
        const rows = group.powers.length
          ? group.powers.map(power => `
            <tr class="add2e-object-magic-power-row" data-sort-id="${add2eObjectMagicEscapeHtml(power.id)}">
              <td style="width:46px;text-align:center;"><img class="sort-cast-img add2e-object-magic-cast" data-sort-id="${add2eObjectMagicEscapeHtml(power.id)}" src="${add2eObjectMagicEscapeHtml(power.img)}" title="Utiliser ${add2eObjectMagicEscapeHtml(power.name)}" style="width:32px;height:32px;border:1px solid #6f4b12;border-radius:6px;object-fit:cover;cursor:pointer;"></td>
              <td><strong>${add2eObjectMagicEscapeHtml(power.name)}</strong><br><small>Niveau ${Number(power.niveau) || 1}${power.cost ? ` — coût ${Number(power.cost)}` : ""}</small></td>
              <td class="a2e-small">${power.description || ""}</td>
            </tr>`).join("")
          : `<tr><td colspan="3" class="a2e-muted" style="text-align:center;padding:0.6em;">Aucun pouvoir détaillé.</td></tr>`;
        return `<div class="add2e-object-magic-group" data-item-id="${add2eObjectMagicEscapeHtml(group.itemId)}" style="border:1px solid #d9bf73;border-radius:9px;margin-bottom:8px;background:#fffdf6;overflow:hidden;">
          <div class="add2e-object-magic-header" style="display:flex;align-items:center;gap:8px;padding:7px 9px;background:#ead99d;border-bottom:1px solid #dac276;color:#3d2b0a;font-weight:900;">
            <img src="${add2eObjectMagicEscapeHtml(group.itemImg)}" alt="" style="width:28px;height:28px;border:1px solid #6f4b12;border-radius:6px;object-fit:cover;">
            <span style="flex:1;">${add2eObjectMagicEscapeHtml(group.itemName)}</span>
            <span title="Charges restantes / charges maximum" style="padding:2px 8px;border:1px solid #9f7a24;border-radius:999px;background:#fffaf0;white-space:nowrap;">Charges ${add2eObjectMagicEscapeHtml(group.chargeLabel)}</span>
          </div>
          <table class="a2e-table add2e-object-magic-table" style="margin:0;">
            <thead><tr><th style="width:46px;">Utiliser</th><th>Pouvoir</th><th>Description</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      }).join("")
    : `<div class="a2e-muted" style="text-align:center;padding:0.8em;border:1px solid #dac276;border-radius:9px;background:#fffdf6;">Aucun objet magique doté d’un pouvoir utilisable.</div>`;
  return `<section class="a2e-panel add2e-object-magic-panel"><h2><i class="fas fa-wand-sparkles"></i> Objets magiques</h2><div class="a2e-panel-body">${content}</div></section>`;
}

export function add2eUiInjectObjectMagicSection(spellContainer, actor) {
  if (!spellContainer || !actor) return;
  if (spellContainer.matches?.(".item, a.item, .sheet-tabs, .tabs, nav")) return;
  spellContainer.querySelectorAll(".add2e-object-magic-panel").forEach(element => element.remove());
  const wrapper = document.createElement("div");
  wrapper.innerHTML = add2eUiBuildObjectMagicSection(actor).trim();
  const panel = wrapper.firstElementChild;
  if (!panel) return;
  const summary = spellContainer.querySelector(".a2e-spellcasting-summary");
  const firstSpellPanel = [...spellContainer.querySelectorAll(".a2e-panel")]
    .find(candidate => candidate.querySelector?.("table.sort-table"));
  if (summary) spellContainer.insertBefore(panel, summary.nextElementSibling || firstSpellPanel || null);
  else if (firstSpellPanel) spellContainer.insertBefore(panel, firstSpellPanel);
  else spellContainer.insertBefore(panel, spellContainer.firstElementChild || null);
}

function add2eMagicBuilderType(item) {
  return String(item?.type ?? "").trim().toLowerCase();
}

function add2eMagicBuilderSupported(item) {
  return ADD2E_MAGIC_ITEM_TYPES.has(add2eMagicBuilderType(item));
}

function add2eMagicBuilderDefaultApplication(itemOrType) {
  const type = typeof itemOrType === "string" ? itemOrType : add2eMagicBuilderType(itemOrType);
  return type === "arme" ? "source" : "porteur";
}

function add2eMagicBuilderEnchantment(item, systemOverride = null) {
  const system = systemOverride ?? item?.system ?? {};
  const hasRawEnchantement = Boolean(
    system.enchantement
    && typeof system.enchantement === "object"
    && !Array.isArray(system.enchantement)
  );
  const raw = hasRawEnchantement ? system.enchantement : {};
  const baseStats = raw.baseStats && typeof raw.baseStats === "object" ? raw.baseStats : {};
  const type = add2eMagicBuilderType(item);
  const legacyToucher = type === "arme"
    ? system.bonus_hit ?? system.bonus_toucher ?? system.hit_bonus ?? system.attack_bonus
    : system.bonus_toucher ?? system.bonus_hit ?? system.attack_bonus;
  const legacyDegats = type === "arme"
    ? system.bonus_dom ?? system.bonus_degats ?? system.damage_bonus ?? system.degats_bonus
    : system.bonus_degats ?? system.bonus_dom ?? system.damage_bonus;
  const legacyBonusCA = system.bonus_ac ?? system.bonus_ca ?? system.ac_bonus ?? system.ca_bonus;
  const legacyCAFixe = system.ca_fixe ?? system.caFixe ?? system.fixedCA ?? system.fixed_ac;
  return {
    schema: 1,
    baseUuid: String(raw.baseUuid ?? item?.flags?.add2e?.baseItemUuid ?? "").trim(),
    baseName: String(raw.baseName ?? item?.flags?.add2e?.baseItemName ?? "").trim(),
    baseType: String(raw.baseType ?? item?.flags?.add2e?.baseItemType ?? "").trim(),
    application: ["source", "porteur"].includes(String(raw.application ?? "").trim())
      ? String(raw.application).trim()
      : add2eMagicBuilderDefaultApplication(item),
    bonusToucher: add2eMagicNumber(raw.bonusToucher ?? raw.bonus_toucher ?? (hasRawEnchantement ? 0 : legacyToucher), 0),
    bonusDegats: add2eMagicNumber(raw.bonusDegats ?? raw.bonus_degats ?? (hasRawEnchantement ? 0 : legacyDegats), 0),
    bonusCA: add2eMagicNumber(raw.bonusCA ?? raw.bonus_ca ?? (hasRawEnchantement ? 0 : legacyBonusCA), 0),
    caFixe: add2eMagicOptionalNumber(raw.caFixe ?? raw.ca_fixe ?? (hasRawEnchantement ? null : legacyCAFixe)),
    baseStats: {
      bonusToucher: add2eMagicNumber(baseStats.bonusToucher, 0),
      bonusDegats: add2eMagicNumber(baseStats.bonusDegats, 0),
      bonusCA: add2eMagicNumber(baseStats.bonusCA, 0),
      caFixe: add2eMagicOptionalNumber(baseStats.caFixe)
    }
  };
}

function add2eMagicBuilderReadBaseStats(item) {
  const system = item?.system ?? {};
  return {
    bonusToucher: add2eMagicNumber(system.bonus_hit ?? system.bonus_toucher ?? system.hit_bonus ?? system.attack_bonus, 0),
    bonusDegats: add2eMagicNumber(system.bonus_dom ?? system.bonus_degats ?? system.damage_bonus ?? system.degats_bonus, 0),
    bonusCA: add2eMagicNumber(system.bonus_ac ?? system.bonus_ca ?? system.ac_bonus ?? system.ca_bonus, 0),
    caFixe: add2eMagicOptionalNumber(system.ca_fixe ?? system.caFixe ?? system.fixedCA ?? system.fixed_ac)
  };
}

function add2eMagicBuilderSyncUpdate(item, change) {
  if (!add2eMagicBuilderSupported(item) || !change || typeof change !== "object") return;
  const touchesEnchantement = add2eMagicGetProperty(change, "system.enchantement") !== undefined;
  const touchesLegacyBuilder = [
    "system.bonus_hit", "system.bonus_dom", "system.bonus_toucher", "system.bonus_degats",
    "system.bonus_ac", "system.bonus_ca", "system.ca_fixe", "system.caFixe"
  ].some(path => add2eMagicGetProperty(change, path) !== undefined);
  if (!touchesEnchantement && !touchesLegacyBuilder) return;
  const mergedSystem = add2eMagicMerge(item.system ?? {}, change.system ?? {});
  const enchantement = add2eMagicBuilderEnchantment(item, mergedSystem);
  const type = add2eMagicBuilderType(item);
  const base = enchantement.baseStats;
  const sourceMode = enchantement.application === "source";
  if (type === "arme") {
    add2eMagicSetProperty(change, "system.bonus_hit", base.bonusToucher + (sourceMode ? enchantement.bonusToucher : 0));
    add2eMagicSetProperty(change, "system.bonus_dom", base.bonusDegats + (sourceMode ? enchantement.bonusDegats : 0));
  } else {
    add2eMagicSetProperty(change, "system.bonus_toucher", enchantement.bonusToucher);
    add2eMagicSetProperty(change, "system.bonus_degats", enchantement.bonusDegats);
  }
  add2eMagicSetProperty(change, "system.bonus_ac", base.bonusCA + enchantement.bonusCA);
  add2eMagicSetProperty(change, "system.ca_fixe", enchantement.caFixe ?? base.caFixe ?? null);
  const previousGenerated = new Set(
    add2eObjectMagicToArray(item.flags?.add2e?.magicItemBuilder?.generatedTags)
      .map(value => String(value ?? "").trim())
      .filter(Boolean)
  );
  const existingTags = add2eObjectMagicToArray(mergedSystem.effectTags ?? mergedSystem.effets ?? mergedSystem.effects)
    .map(value => String(value ?? "").trim())
    .filter(Boolean)
    .filter(tag => !previousGenerated.has(tag));
  const generatedTags = [];
  if (enchantement.application === "porteur") {
    if (enchantement.bonusToucher) generatedTags.push(`bonus_attaque:${add2eMagicSigned(enchantement.bonusToucher)}`);
    if (enchantement.bonusDegats) generatedTags.push(`bonus_degats:${add2eMagicSigned(enchantement.bonusDegats)}`);
  }
  add2eMagicSetProperty(change, "system.effectTags", [...new Set([...existingTags, ...generatedTags])]);
  add2eMagicSetProperty(change, "system.enchantement", enchantement);
  add2eMagicSetProperty(change, "flags.add2e.magicItemBuilder", {
    version: ADD2E_MAGIC_ITEM_BUILDER_VERSION,
    generatedTags
  });
  const powers = mergedSystem.pouvoirs ?? mergedSystem.powers ?? [];
  const chargeMax = add2eMagicNumber(mergedSystem.charges?.max, 0);
  const isMagic = Boolean(
    enchantement.baseUuid
    || enchantement.bonusToucher
    || enchantement.bonusDegats
    || enchantement.bonusCA
    || enchantement.caFixe !== null
    || add2eObjectMagicToArray(powers).length
    || chargeMax > 0
  );
  if (isMagic) add2eMagicSetProperty(change, "system.magique", true);
}

function add2eMagicBuilderCopyPaths(sourceSystem, targetUpdate, paths) {
  for (const path of paths) {
    const value = add2eMagicGetProperty(sourceSystem, path);
    if (value === undefined) continue;
    add2eMagicSetProperty(targetUpdate, `system.${path}`, add2eMagicClone(value));
  }
}

function add2eMagicBuilderBasePaths(type) {
  if (type === "arme") {
    return [
      "type", "categorie", "famille", "famille_arme", "facteur_rapidité", "facteur_rapidite",
      "type_degats", "degats", "dégâts", "ajustement_ca", "portee_courte", "portee_moyenne",
      "portee_longue", "poids", "deuxMains", "arme_de_jet", "encombrante", "proprietes",
      "properties", "tags", "effectTags"
    ];
  }
  if (type === "armure") {
    return [
      "ac", "ca", "armorClass", "categorie", "properties", "proprietes", "poids", "weight",
      "prix", "cost", "materiau", "type_armure", "structure", "bouclier", "tags", "effectTags"
    ];
  }
  return [
    "categorie", "sousType", "sous_type", "quantite", "poids", "prix", "activation", "cible",
    "duree", "tags", "effectTags"
  ];
}

async function add2eMagicBuilderResolveItem(value) {
  if (!value) return null;
  if (value.documentName === "Item") return value;
  if (typeof value === "string" && typeof fromUuid === "function") {
    try {
      const item = await fromUuid(value);
      if (item?.documentName === "Item") return item;
    } catch (_error) {}
  }
  return null;
}

async function add2eMagicBuilderResolveDrop(event) {
  let data = null;
  const editor = foundry?.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
  if (typeof editor?.getDragEventData === "function") {
    try { data = editor.getDragEventData(event); }
    catch (_error) { data = null; }
  }
  if (!data) {
    try { data = JSON.parse(event?.dataTransfer?.getData?.("text/plain") || "null"); }
    catch (_error) { data = null; }
  }
  if (!data || (data.type && data.type !== "Item")) return null;
  if (data.uuid) {
    const item = await add2eMagicBuilderResolveItem(data.uuid);
    if (item) return item;
  }
  if (typeof CONFIG?.Item?.documentClass?.fromDropData === "function") {
    try {
      const item = await CONFIG.Item.documentClass.fromDropData(data);
      if (item?.documentName === "Item") return item;
    } catch (_error) {}
  }
  if (data.pack && data.id) {
    try { return await game.packs?.get?.(data.pack)?.getDocument?.(data.id) ?? null; }
    catch (_error) {}
  }
  return null;
}

async function add2eMagicBuilderConfirm(title, content, yesLabel = "Confirmer") {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("DialogV2 est introuvable.");
    return false;
  }
  return await DialogV2.wait({
    window: { title },
    modal: true,
    rejectClose: false,
    content,
    buttons: [
      { action: "yes", label: yesLabel, icon: "fa-solid fa-check", default: true, callback: () => true },
      { action: "no", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => false }
    ]
  }) === true;
}

async function add2eMagicBuilderApplyBase(targetItem, baseItem) {
  if (!add2eMagicBuilderSupported(targetItem) || !add2eMagicBuilderSupported(baseItem)) {
    ui.notifications.warn("La base doit être une arme, une armure ou un objet ADD2E.");
    return false;
  }
  const targetType = add2eMagicBuilderType(targetItem);
  const baseType = add2eMagicBuilderType(baseItem);
  if (targetType !== baseType) {
    ui.notifications.warn(`Une ${targetType} doit utiliser une base du même type.`);
    return false;
  }
  if (targetItem.uuid === baseItem.uuid) {
    ui.notifications.warn("Un objet ne peut pas être sa propre base.");
    return false;
  }
  const currentTags = add2eObjectMagicToArray(targetItem.system?.tags);
  const currentEffectTags = add2eObjectMagicToArray(
    targetItem.system?.effectTags ?? targetItem.system?.effets ?? targetItem.system?.effects
  );
  const update = {};
  add2eMagicBuilderCopyPaths(baseItem.system ?? {}, update, add2eMagicBuilderBasePaths(targetType));
  add2eMagicSetProperty(update, "system.tags", add2eMagicMergeUniqueValues(add2eMagicGetProperty(update, "system.tags"), currentTags));
  add2eMagicSetProperty(update, "system.effectTags", add2eMagicMergeUniqueValues(add2eMagicGetProperty(update, "system.effectTags"), currentEffectTags));
  const currentEnchantement = add2eMagicBuilderEnchantment(targetItem);
  const nextEnchantement = {
    ...currentEnchantement,
    schema: 1,
    baseUuid: String(baseItem.uuid ?? ""),
    baseName: String(baseItem.name ?? "Base"),
    baseType,
    baseStats: add2eMagicBuilderReadBaseStats(baseItem)
  };
  add2eMagicSetProperty(update, "system.enchantement", nextEnchantement);
  add2eMagicSetProperty(update, "flags.add2e.baseItemUuid", nextEnchantement.baseUuid);
  add2eMagicSetProperty(update, "flags.add2e.baseItemName", nextEnchantement.baseName);
  add2eMagicSetProperty(update, "flags.add2e.baseItemType", nextEnchantement.baseType);
  add2eMagicSetProperty(update, "flags.add2e.magicItemBuilderVersion", ADD2E_MAGIC_ITEM_BUILDER_VERSION);
  const currentDescription = String(targetItem.system?.description ?? "").trim();
  if (!currentDescription && String(baseItem.system?.description ?? "").trim()) {
    add2eMagicSetProperty(update, "system.description", baseItem.system.description);
  }
  if (baseItem.img) update.img = baseItem.img;
  await targetItem.update(update, { add2eMagicItemBuilder: true, add2eInternal: true });
  ui.notifications.info(`${targetItem.name} utilise maintenant ${baseItem.name} comme base.`);
  targetItem.sheet?.render?.({ force: true });
  return true;
}

async function add2eMagicBuilderCollectBases(type, currentUuid = "") {
  const groups = [];
  const world = [...(game.items ?? [])]
    .filter(item => add2eMagicBuilderType(item) === type && item.uuid !== currentUuid)
    .map(item => ({ uuid: item.uuid, name: item.name, img: item.img }));
  if (world.length) groups.push({ label: "Monde", entries: world });
  for (const pack of game.packs ?? []) {
    if (String(pack.documentName ?? pack.metadata?.type ?? "") !== "Item") continue;
    let index = null;
    try { index = await pack.getIndex({ fields: ["name", "type", "img"] }); }
    catch (_error) { continue; }
    const entries = [...(index ?? [])]
      .filter(entry => String(entry.type ?? "").toLowerCase() === type)
      .map(entry => ({
        uuid: entry.uuid ?? `Compendium.${pack.collection}.${entry._id}`,
        name: entry.name,
        img: entry.img
      }));
    if (entries.length) groups.push({ label: pack.title ?? pack.metadata?.label ?? pack.collection, entries });
  }
  return groups;
}

async function add2eMagicBuilderChooseBase(itemUuid) {
  const item = await add2eMagicBuilderResolveItem(itemUuid);
  if (!item || !add2eMagicBuilderSupported(item)) return false;
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("DialogV2 est introuvable.");
    return false;
  }
  const groups = await add2eMagicBuilderCollectBases(add2eMagicBuilderType(item), item.uuid);
  const options = groups.map(group => {
    const rows = group.entries
      .sort((left, right) => String(left.name).localeCompare(String(right.name), "fr"))
      .map(entry => `<option value="${add2eObjectMagicEscapeHtml(entry.uuid)}">${add2eObjectMagicEscapeHtml(entry.name)}</option>`)
      .join("");
    return `<optgroup label="${add2eObjectMagicEscapeHtml(group.label)}">${rows}</optgroup>`;
  }).join("");
  if (!options) {
    ui.notifications.warn(`Aucune base de type ${item.type} n'est disponible.`);
    return false;
  }
  const selectedUuid = await DialogV2.wait({
    window: { title: `Choisir la base de ${item.name}` },
    modal: true,
    rejectClose: false,
    content: `<div class="add2e-dialog" style="min-width:520px;padding:10px"><p>La base fournit les caractéristiques ordinaires. Les pouvoirs, charges et bonus magiques actuels sont conservés.</p><label style="display:grid;gap:5px"><b>Objet de base</b><select name="baseUuid" style="width:100%">${options}</select></label></div>`,
    buttons: [
      {
        action: "apply",
        label: "Utiliser cette base",
        icon: "fa-solid fa-link",
        default: true,
        callback: (_event, button, dialog) => {
          const root = button?.form ?? dialog?.element;
          return root?.querySelector?.('[name="baseUuid"]')?.value ?? "";
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
  });
  if (!selectedUuid) return false;
  const baseItem = await add2eMagicBuilderResolveItem(selectedUuid);
  if (!baseItem) {
    ui.notifications.error("L'objet de base sélectionné est introuvable.");
    return false;
  }
  return add2eMagicBuilderApplyBase(item, baseItem);
}

async function add2eMagicBuilderDropBase(event, itemUuid) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const item = await add2eMagicBuilderResolveItem(itemUuid);
  const baseItem = await add2eMagicBuilderResolveDrop(event);
  if (!item || !baseItem) {
    ui.notifications.warn("Objet de base introuvable.");
    return false;
  }
  if (add2eMagicBuilderType(item) !== add2eMagicBuilderType(baseItem)) {
    ui.notifications.warn(`Déposez un Item de type ${item.type}.`);
    return false;
  }
  const confirmed = await add2eMagicBuilderConfirm(
    `Utiliser ${baseItem.name} comme base`,
    `<div class="add2e-dialog" style="min-width:460px;padding:8px"><p>Copier les caractéristiques ordinaires de <b>${add2eObjectMagicEscapeHtml(baseItem.name)}</b> dans <b>${add2eObjectMagicEscapeHtml(item.name)}</b> ?</p><p>Les pouvoirs, charges et bonus magiques seront conservés.</p></div>`,
    "Appliquer la base"
  );
  return confirmed ? add2eMagicBuilderApplyBase(item, baseItem) : false;
}

async function add2eMagicBuilderClearBase(itemUuid) {
  const item = await add2eMagicBuilderResolveItem(itemUuid);
  if (!item || !add2eMagicBuilderSupported(item)) return false;
  const confirmed = await add2eMagicBuilderConfirm(
    "Dissocier l'objet de base",
    `<div class="add2e-dialog" style="min-width:440px;padding:8px"><p>Dissocier <b>${add2eObjectMagicEscapeHtml(item.name)}</b> de sa base ?</p><p>Les caractéristiques déjà copiées restent présentes.</p></div>`,
    "Dissocier"
  );
  if (!confirmed) return false;
  const enchantement = add2eMagicBuilderEnchantment(item);
  enchantement.baseUuid = "";
  enchantement.baseName = "";
  enchantement.baseType = "";
  await item.update({
    "system.enchantement": enchantement,
    "flags.add2e.-=baseItemUuid": null,
    "flags.add2e.-=baseItemName": null,
    "flags.add2e.-=baseItemType": null
  }, { add2eMagicItemBuilder: true, add2eInternal: true });
  item.sheet?.render?.({ force: true });
  return true;
}

async function add2eMagicBuilderDropPower(event, itemUuid) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const item = await add2eMagicBuilderResolveItem(itemUuid);
  const spell = await add2eMagicBuilderResolveDrop(event);
  if (!item || !add2eMagicBuilderSupported(item)) return false;
  if (!spell || String(spell.type ?? "").toLowerCase() !== "sort") {
    ui.notifications.warn("Déposez un Item de type sort.");
    return false;
  }
  const store = globalThis.add2eStoreSpellInMagicItem;
  if (typeof store !== "function") {
    ui.notifications.error("Le gestionnaire de pouvoirs magiques est indisponible.");
    return false;
  }
  const stored = await store(item, spell);
  if (stored) item.sheet?.render?.({ force: true });
  return stored !== false;
}

async function add2eMagicBuilderRemovePower(itemUuid, powerIndex) {
  const item = await add2eMagicBuilderResolveItem(itemUuid);
  if (!item || !add2eMagicBuilderSupported(item)) return false;
  const remove = globalThis.add2eRemoveMagicItemPower;
  if (typeof remove !== "function") {
    ui.notifications.error("Le gestionnaire de pouvoirs magiques est indisponible.");
    return false;
  }
  const removed = await remove(item, Number(powerIndex));
  if (removed) item.sheet?.render?.({ force: true });
  return removed !== false;
}

const ADD2E_MAGIC_CREATOR_PROFILES = Object.freeze({
  objet: Object.freeze({
    label: "Objet",
    itemType: "objet",
    sousType: "objet_magique",
    img: "icons/svg/item-bag.svg",
    tags: ["objet_magique", "actif_si_equipe"],
    enchantable: true,
    charges: true,
    defaultCharges: 0,
    defaultMax: 0
  }),
  arme: Object.freeze({
    label: "Arme",
    itemType: "arme",
    baseType: "arme",
    img: "icons/weapons/swords/sword-guard-gold.webp",
    tags: ["objet_magique", "arme_magique"],
    enchantable: true,
    charges: true,
    defaultCharges: 0,
    defaultMax: 0
  }),
  armure: Object.freeze({
    label: "Armure",
    itemType: "armure",
    baseType: "armure",
    img: "icons/equipment/chest/breastplate-layered-steel.webp",
    tags: ["objet_magique", "armure_magique", "actif_si_equipe"],
    enchantable: true,
    charges: true,
    defaultCharges: 0,
    defaultMax: 0
  }),
  anneau: Object.freeze({
    label: "Anneau",
    itemType: "objet",
    sousType: "anneau",
    img: "icons/equipment/finger/ring-band-engraved-gold.webp",
    tags: ["objet_magique", "sous_type:anneau", "anneau", "actif_si_equipe"],
    enchantable: true,
    charges: false
  }),
  parchemin: Object.freeze({
    label: "Parchemin",
    itemType: "objet",
    sousType: "parchemin_de_sort",
    img: "icons/sundries/scrolls/scroll-runed-brown.webp",
    tags: ["objet_magique", "parchemin", "parchemin_de_sort", "consommable"],
    consumable: true,
    enchantable: false,
    charges: false
  }),
  baguette: Object.freeze({
    label: "Baguette",
    itemType: "objet",
    sousType: "baguette",
    img: "icons/weapons/wands/wand-gem-blue.webp",
    tags: ["objet_magique", "sous_type:baguette", "baguette", "charges", "actif_si_equipe"],
    enchantable: true,
    charges: true,
    rechargeable: true,
    rechargeFormula: "1d6",
    defaultCharges: 10,
    defaultMax: 10
  }),
  batonnet: Object.freeze({
    label: "Bâtonnet",
    itemType: "objet",
    sousType: "batonnet",
    img: "icons/weapons/staves/staff-engraved-brown.webp",
    tags: ["objet_magique", "sous_type:batonnet", "batonnet", "charges", "actif_si_equipe"],
    enchantable: true,
    charges: true,
    rechargeable: true,
    rechargeFormula: "1d6",
    defaultCharges: 10,
    defaultMax: 10
  }),
  potion: Object.freeze({
    label: "Potion",
    itemType: "objet",
    sousType: "potion",
    img: "icons/consumables/potions/potion-bottle-corked-blue.webp",
    tags: ["objet_magique", "potion", "consommable_potion", "consommable"],
    consumable: true,
    enchantable: true,
    charges: true,
    defaultCharges: 10,
    defaultMax: 10
  }),
  livre_illusionniste: Object.freeze({
    label: "Livre de sorts d’illusionniste",
    itemType: "objet",
    sousType: "livre_de_sorts",
    img: "icons/sundries/books/book-embossed-gold-blue.webp",
    spellbookOwnerList: "illusionniste",
    enchantable: false,
    charges: false
  }),
  livre_magicien: Object.freeze({
    label: "Livre de sorts de magicien",
    itemType: "objet",
    sousType: "livre_de_sorts",
    img: "icons/sundries/books/book-embossed-gold-red.webp",
    spellbookOwnerList: "magicien",
    enchantable: false,
    charges: false
  })
});

function add2eMagicCatalogueAutomationLabel(value) {
  return ({
    automatic: "Automatique",
    assisted: "Assisté par le MD",
    manual: "Manuel",
    chat_card: "Carte de chat"
  })[add2eObjectMagicNormalizeTag(value)] ?? String(value ?? "—");
}

function add2eMagicCatalogueCategoryLabel(value) {
  const labels = {
    attribute: "Caractéristiques",
    charges: "Charges",
    combat: "Combat",
    consumable: "Consommable",
    control: "Contrôle",
    curse: "Malédiction",
    defense: "Défense",
    destruction: "Destruction",
    detection: "Détection",
    environment: "Environnement",
    healing: "Guérison",
    holy: "Sacré",
    illusion: "Illusion",
    immunity: "Immunité",
    light: "Lumière",
    movement: "Déplacement",
    negation: "Négation",
    poison: "Poison",
    protection: "Protection",
    random: "Aléatoire",
    ranged: "Distance",
    resistance: "Résistance",
    restriction: "Restriction",
    scroll: "Parchemin",
    social: "Social",
    spell: "Sort",
    summoning: "Invocation",
    survival: "Survie",
    transformation: "Transformation"
  };
  return labels[add2eObjectMagicNormalizeTag(value)] ?? String(value ?? "Autre");
}

function add2eMagicCreatorForm(dialogOrElement) {
  const raw = dialogOrElement?.element ?? dialogOrElement ?? null;
  const element = raw?.jquery
    ? raw[0]
    : raw?.querySelector
      ? raw
      : raw?.[0]?.querySelector
        ? raw[0]
        : null;
  return element?.matches?.(".add2e-magic-item-create-form")
    ? element
    : element?.querySelector?.(".add2e-magic-item-create-form")
      ?? element?.closest?.("dialog")?.querySelector?.(".add2e-magic-item-create-form")
      ?? null;
}

function add2eMagicCreatorField(form, name) {
  return form?.elements?.[name] ?? form?.querySelector?.(`[name="${name}"]`) ?? null;
}

function add2eMagicCreatorState(form) {
  if (!ADD2E_MAGIC_CREATOR_STATES.has(form)) {
    ADD2E_MAGIC_CREATOR_STATES.set(form, {
      catalogue: null,
      compatible: [],
      selected: [],
      sequence: 0,
      previousProfile: ""
    });
  }
  return ADD2E_MAGIC_CREATOR_STATES.get(form);
}

function add2eMagicCreatorProfileContext(form) {
  const profile = String(add2eMagicCreatorField(form, "profile")?.value ?? "objet").trim();
  const definition = ADD2E_MAGIC_CREATOR_PROFILES[profile] ?? ADD2E_MAGIC_CREATOR_PROFILES.objet;
  return { profile, itemType: definition.itemType };
}

function add2eMagicCatalogueParameterInitial(schema, currentValue) {
  if (currentValue !== undefined) return currentValue;
  if (schema?.default !== undefined) return add2eMagicClone(schema.default);
  if (schema?.value !== undefined) return add2eMagicClone(schema.value);
  return undefined;
}

function add2eMagicCatalogueJsonValue(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2); }
  catch (_error) { return String(value); }
}

function add2eMagicCatalogueParameterControl(name, schema = {}, currentValue) {
  const type = add2eObjectMagicNormalizeTag(schema.type);
  const value = add2eMagicCatalogueParameterInitial(schema, currentValue);
  const escapedName = add2eObjectMagicEscapeHtml(name);
  const required = schema.required === true ? ' <span style="color:#a40000">*</span>' : "";
  const label = `${add2eObjectMagicEscapeHtml(name)}${required}`;
  const common = `name="${escapedName}" data-add2e-parameter-type="${add2eObjectMagicEscapeHtml(type)}"`;
  if (type === "boolean") {
    return `<label class="form-group" style="display:flex;align-items:center;gap:8px;"><input ${common} type="checkbox" ${value === true ? "checked" : ""}> <span>${label}</span></label>`;
  }
  if (type === "fixed" || type === "fixed_list") {
    return `<div class="form-group"><label>${label}</label><input ${common} type="hidden" value="${add2eObjectMagicEscapeHtml(add2eMagicCatalogueJsonValue(value))}"><div style="padding:6px 8px;border:1px solid var(--color-border-light-primary,#999);border-radius:4px;opacity:.85;">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueJsonValue(value) || "Valeur imposée")}</div></div>`;
  }
  if (type === "choice" && Array.isArray(schema.values)) {
    const options = schema.values.map(entry => `<option value="${add2eObjectMagicEscapeHtml(entry)}"${String(entry) === String(value) ? " selected" : ""}>${add2eObjectMagicEscapeHtml(entry)}</option>`).join("");
    return `<div class="form-group"><label>${label}</label><select ${common}>${options}</select></div>`;
  }
  if (type === "choice_list" && Array.isArray(schema.values)) {
    const selectedValues = new Set(add2eObjectMagicToArray(value).map(String));
    const options = schema.values.map(entry => `<option value="${add2eObjectMagicEscapeHtml(entry)}"${selectedValues.has(String(entry)) ? " selected" : ""}>${add2eObjectMagicEscapeHtml(entry)}</option>`).join("");
    return `<div class="form-group"><label>${label}</label><select ${common} multiple size="${Math.min(7, Math.max(3, schema.values.length))}">${options}</select></div>`;
  }
  const numericTypes = new Set(["integer", "number", "percentage", "percentage_per_use"]);
  if (numericTypes.has(type)) {
    const min = Number.isFinite(Number(schema.min)) ? ` min="${Number(schema.min)}"` : "";
    const max = Number.isFinite(Number(schema.max)) ? ` max="${Number(schema.max)}"` : "";
    return `<div class="form-group"><label>${label}</label><input ${common} type="number" step="${type === "integer" ? "1" : "any"}"${min}${max} value="${add2eObjectMagicEscapeHtml(value ?? "")}"></div>`;
  }
  const jsonTypes = new Set([
    "object", "effect_list", "effect_table", "spell_list", "form_list", "save_rule",
    "percentage_or_save", "percentage_or_table", "number_or_table", "weight_or_table",
    "formula_or_table"
  ]);
  if (jsonTypes.has(type)) {
    return `<div class="form-group"><label>${label}</label><textarea ${common} rows="3" placeholder="Valeur ou JSON">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueJsonValue(value))}</textarea></div>`;
  }
  const listTypes = new Set(["tag_list", "string_list", "integer_list"]);
  if (listTypes.has(type)) {
    return `<div class="form-group"><label>${label}</label><input ${common} type="text" value="${add2eObjectMagicEscapeHtml(add2eObjectMagicToArray(value).join(", "))}" placeholder="Valeurs séparées par des virgules"></div>`;
  }
  return `<div class="form-group"><label>${label}</label><input ${common} type="text" value="${add2eObjectMagicEscapeHtml(add2eMagicCatalogueJsonValue(value))}"></div>`;
}

function add2eMagicCatalogueReadParameter(input, schema = {}) {
  const type = add2eObjectMagicNormalizeTag(schema.type);
  if (type === "boolean") return input.checked === true;
  if (type === "choice_list") return [...input.selectedOptions].map(option => option.value);
  if (type === "fixed" || type === "fixed_list") return add2eMagicClone(schema.value);
  const raw = String(input.value ?? "").trim();
  if (!raw) return undefined;
  if (["integer", "number", "percentage", "percentage_per_use"].includes(type)) {
    const number = Number(raw.replace(",", "."));
    return Number.isFinite(number) ? number : undefined;
  }
  if (["tag_list", "string_list"].includes(type)) return add2eObjectMagicToArray(raw).map(String);
  if (type === "integer_list") return add2eObjectMagicToArray(raw).map(Number).filter(Number.isFinite);
  if (["formula_or_integer", "integer_or_null", "number_or_formula", "number_or_distance"].includes(type)) {
    const number = Number(raw.replace(",", "."));
    return Number.isFinite(number) ? number : raw;
  }
  if ([
    "object", "effect_list", "effect_table", "spell_list", "form_list", "save_rule",
    "percentage_or_save", "percentage_or_table", "number_or_table", "weight_or_table",
    "formula_or_table"
  ].includes(type)) {
    try { return JSON.parse(raw); }
    catch (_error) { return raw; }
  }
  return raw;
}

function add2eMagicCatalogueValidateParameters(power, parameters) {
  const missing = [];
  for (const [name, schema] of Object.entries(power.parameters ?? {})) {
    if (schema?.required !== true) continue;
    const value = parameters[name];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) missing.push(name);
  }
  const alternatives = add2eObjectMagicToArray(power.validation?.requiresOneOf);
  if (alternatives.length && !alternatives.some(name => {
    const value = parameters[name];
    return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length);
  })) {
    missing.push(`un des paramètres suivants : ${alternatives.join(", ")}`);
  }
  return missing;
}

async function add2eMagicCatalogueConfigurePower(power, existingParameters = {}) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("DialogV2 est introuvable.");
    return null;
  }
  const parameterEntries = Object.entries(power.parameters ?? {});
  if (!parameterEntries.length) return {};
  const controls = parameterEntries.map(([name, schema]) =>
    add2eMagicCatalogueParameterControl(name, schema, existingParameters?.[name])
  ).join("");
  const result = await DialogV2.wait({
    window: { title: `Configurer — ${power.label}` },
    modal: true,
    rejectClose: false,
    content: `<div class="add2e-dialog add2e-magic-power-parameter-form" style="min-width:560px;padding:10px;display:grid;gap:8px;">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <strong>${add2eObjectMagicEscapeHtml(power.label)}</strong>
        <span style="font-size:.8em;padding:2px 7px;border:1px solid currentColor;border-radius:999px;">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueCategoryLabel(power.category))}</span>
        <span style="font-size:.8em;padding:2px 7px;border:1px solid currentColor;border-radius:999px;">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueAutomationLabel(power.automation))}</span>
      </div>
      <p style="margin:0;opacity:.8;">Source : ${add2eObjectMagicEscapeHtml(power.source?.section ?? "Guide du Maître")}${power.source?.page ? `, page ${add2eObjectMagicEscapeHtml(power.source.page)}` : ""}</p>
      ${controls}
      <p style="margin:0;font-size:.82em;opacity:.75;">Les champs complexes acceptent une valeur simple ou du JSON. Les paramètres marqués d’un astérisque sont obligatoires.</p>
    </div>`,
    buttons: [
      {
        action: "save",
        label: "Enregistrer",
        icon: "fa-solid fa-check",
        default: true,
        callback: (_event, button, dialog) => {
          const root = button?.form ?? dialog?.element;
          const parameters = {};
          for (const [name, schema] of parameterEntries) {
            const input = root?.querySelector?.(`[name="${CSS.escape(name)}"]`);
            if (!input) continue;
            const value = add2eMagicCatalogueReadParameter(input, schema);
            if (value !== undefined) parameters[name] = value;
          }
          const missing = add2eMagicCatalogueValidateParameters(power, parameters);
          if (missing.length) {
            ui.notifications.warn(`Paramètres obligatoires manquants : ${missing.join(", ")}.`);
            return false;
          }
          return parameters;
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
  });
  return result && typeof result === "object" ? result : null;
}

function add2eMagicCatalogueSelectedPayload(state) {
  return state.selected.map(entry => ({
    catalogueId: entry.power.id,
    parameters: add2eMagicClone(entry.parameters)
  }));
}

function add2eMagicCatalogueSyncHidden(form, state) {
  const hidden = add2eMagicCreatorField(form, "cataloguePowersJson");
  if (hidden) hidden.value = JSON.stringify(add2eMagicCatalogueSelectedPayload(state));
}

function add2eMagicCatalogueFilteredPowers(section, state) {
  const search = add2eObjectMagicNormalizeTag(section.querySelector('[data-add2e-power-search]')?.value);
  const category = String(section.querySelector('[data-add2e-power-category]')?.value ?? "");
  const automation = String(section.querySelector('[data-add2e-power-automation]')?.value ?? "");
  return state.compatible.filter(power => {
    if (category && String(power.category) !== category) return false;
    if (automation && String(power.automation) !== automation) return false;
    if (!search) return true;
    const haystack = add2eObjectMagicNormalizeTag(`${power.label} ${power.id} ${power.category} ${power.automation}`);
    return haystack.includes(search);
  });
}

function add2eMagicCatalogueRenderAvailable(form, state) {
  const section = form.querySelector('[data-add2e-power-section]');
  const select = section?.querySelector?.('[data-add2e-power-select]');
  if (!section || !select) return;
  const powers = add2eMagicCatalogueFilteredPowers(section, state);
  const groups = new Map();
  for (const power of powers) {
    const category = String(power.category ?? "other");
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(power);
  }
  select.innerHTML = [...groups.entries()]
    .sort(([left], [right]) => add2eMagicCatalogueCategoryLabel(left).localeCompare(add2eMagicCatalogueCategoryLabel(right), "fr"))
    .map(([category, entries]) => `<optgroup label="${add2eObjectMagicEscapeHtml(add2eMagicCatalogueCategoryLabel(category))}">${entries
      .sort((left, right) => String(left.label).localeCompare(String(right.label), "fr"))
      .map(power => `<option value="${add2eObjectMagicEscapeHtml(power.id)}">${add2eObjectMagicEscapeHtml(power.label)} — ${add2eObjectMagicEscapeHtml(add2eMagicCatalogueAutomationLabel(power.automation))}</option>`)
      .join("")}</optgroup>`)
    .join("");
  const count = section.querySelector('[data-add2e-power-available-count]');
  if (count) count.textContent = `${powers.length} pouvoir${powers.length > 1 ? "s" : ""} compatible${powers.length > 1 ? "s" : ""}`;
}

function add2eMagicCatalogueParameterSummary(parameters = {}) {
  const entries = Object.entries(parameters);
  if (!entries.length) return "Aucun paramètre";
  return entries.map(([key, value]) => {
    const display = Array.isArray(value)
      ? value.join(", ")
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
    return `${key}: ${display}`;
  }).join(" · ");
}

function add2eMagicCatalogueRenderSelected(form, state) {
  const section = form.querySelector('[data-add2e-power-section]');
  const container = section?.querySelector?.('[data-add2e-selected-powers]');
  if (!container) return;
  container.innerHTML = state.selected.length
    ? state.selected.map(entry => `<article data-add2e-selected-power="${add2eObjectMagicEscapeHtml(entry.uid)}" style="border:1px solid var(--color-border-light-primary,#999);border-radius:6px;padding:7px;display:grid;gap:5px;">
        <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;">
          <strong style="flex:1;">${add2eObjectMagicEscapeHtml(entry.power.label)}</strong>
          <span style="font-size:.76em;padding:1px 6px;border:1px solid currentColor;border-radius:999px;">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueCategoryLabel(entry.power.category))}</span>
          <span style="font-size:.76em;padding:1px 6px;border:1px solid currentColor;border-radius:999px;">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueAutomationLabel(entry.power.automation))}</span>
          <button type="button" data-action="edit-catalogue-power" data-power-uid="${add2eObjectMagicEscapeHtml(entry.uid)}" title="Configurer"><i class="fa-solid fa-pen"></i></button>
          <button type="button" data-action="remove-catalogue-power" data-power-uid="${add2eObjectMagicEscapeHtml(entry.uid)}" title="Retirer"><i class="fa-solid fa-trash"></i></button>
        </div>
        <small style="opacity:.8;overflow-wrap:anywhere;">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueParameterSummary(entry.parameters))}</small>
      </article>`).join("")
    : `<p style="margin:0;opacity:.72;text-align:center;padding:7px;">Aucun pouvoir sélectionné.</p>`;
  const count = section.querySelector('[data-add2e-selected-count]');
  if (count) count.textContent = `${state.selected.length} sélectionné${state.selected.length > 1 ? "s" : ""}`;
  add2eMagicCatalogueSyncHidden(form, state);
}

function add2eMagicCatalogueRefreshFilters(form, state) {
  const section = form.querySelector('[data-add2e-power-section]');
  if (!section) return;
  const categorySelect = section.querySelector('[data-add2e-power-category]');
  const automationSelect = section.querySelector('[data-add2e-power-automation]');
  const currentCategory = categorySelect?.value ?? "";
  const currentAutomation = automationSelect?.value ?? "";
  const categories = [...new Set(state.compatible.map(power => String(power.category ?? "")).filter(Boolean))]
    .sort((left, right) => add2eMagicCatalogueCategoryLabel(left).localeCompare(add2eMagicCatalogueCategoryLabel(right), "fr"));
  if (categorySelect) {
    categorySelect.innerHTML = `<option value="">Toutes les catégories</option>${categories.map(category => `<option value="${add2eObjectMagicEscapeHtml(category)}">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueCategoryLabel(category))}</option>`).join("")}`;
    categorySelect.value = categories.includes(currentCategory) ? currentCategory : "";
  }
  const automations = [...new Set(state.compatible.map(power => String(power.automation ?? "")).filter(Boolean))]
    .sort((left, right) => add2eMagicCatalogueAutomationLabel(left).localeCompare(add2eMagicCatalogueAutomationLabel(right), "fr"));
  if (automationSelect) {
    automationSelect.innerHTML = `<option value="">Tous les niveaux d’automatisation</option>${automations.map(automation => `<option value="${add2eObjectMagicEscapeHtml(automation)}">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueAutomationLabel(automation))}</option>`).join("")}`;
    automationSelect.value = automations.includes(currentAutomation) ? currentAutomation : "";
  }
}

async function add2eMagicCatalogueRefreshCompatibility(form, { profileChanged = false } = {}) {
  const state = add2eMagicCreatorState(form);
  const context = add2eMagicCreatorProfileContext(form);
  if (typeof globalThis.add2eLoadMagicPowerCatalogue !== "function" || typeof globalThis.add2eGetCompatibleMagicPowers !== "function") {
    throw new Error("Le chargeur du catalogue de pouvoirs est indisponible.");
  }
  state.catalogue ??= await globalThis.add2eLoadMagicPowerCatalogue();
  state.compatible = await globalThis.add2eGetCompatibleMagicPowers(context);
  const compatibleIds = new Set(state.compatible.map(power => power.id));
  if (profileChanged) state.selected = state.selected.filter(entry => compatibleIds.has(entry.power.id));
  state.previousProfile = context.profile;
  add2eMagicCatalogueRefreshFilters(form, state);
  add2eMagicCatalogueRenderAvailable(form, state);
  add2eMagicCatalogueRenderSelected(form, state);
  const status = form.querySelector('[data-add2e-power-status]');
  if (status) status.textContent = `${state.catalogue.counts?.standardPowers ?? 0} pouvoirs standards chargés — artefacts exclus.`;
}

async function add2eMagicCatalogueAddSelected(form) {
  const state = add2eMagicCreatorState(form);
  const select = form.querySelector('[data-add2e-power-select]');
  const power = state.compatible.find(entry => entry.id === select?.value);
  if (!power) {
    ui.notifications.warn("Sélectionnez un pouvoir compatible.");
    return;
  }
  const parameters = await add2eMagicCatalogueConfigurePower(power, {});
  if (parameters === null) return;
  state.sequence += 1;
  state.selected.push({ uid: `${power.id}-${state.sequence}`, power, parameters });
  add2eMagicCatalogueRenderSelected(form, state);
}

async function add2eMagicCatalogueEditSelected(form, uid) {
  const state = add2eMagicCreatorState(form);
  const entry = state.selected.find(selected => selected.uid === uid);
  if (!entry) return;
  const parameters = await add2eMagicCatalogueConfigurePower(entry.power, entry.parameters);
  if (parameters === null) return;
  entry.parameters = parameters;
  add2eMagicCatalogueRenderSelected(form, state);
}

function add2eMagicCatalogueRemoveSelected(form, uid) {
  const state = add2eMagicCreatorState(form);
  state.selected = state.selected.filter(entry => entry.uid !== uid);
  add2eMagicCatalogueRenderSelected(form, state);
}

function add2eMagicCatalogueResolveTemplates(value, parameters) {
  if (Array.isArray(value)) return value.map(entry => add2eMagicCatalogueResolveTemplates(entry, parameters));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, add2eMagicCatalogueResolveTemplates(entry, parameters)]));
  }
  if (typeof value !== "string") return add2eMagicClone(value);
  const exact = value.match(/^@([A-Za-z0-9_]+)$/);
  if (exact && Object.prototype.hasOwnProperty.call(parameters, exact[1])) return add2eMagicClone(parameters[exact[1]]);
  return value.replace(/@([A-Za-z0-9_]+)/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(parameters, key)) return match;
    const replacement = parameters[key];
    return typeof replacement === "object" ? JSON.stringify(replacement) : String(replacement);
  });
}

function add2eMagicCatalogueStoredPower(power, parameters, catalogue) {
  const onUse = add2eObjectPowerOnUsePath(power);
  return {
    schema: ADD2E_MAGIC_CATALOGUE_POWER_SCHEMA,
    kind: "catalogue",
    catalogueId: power.id,
    name: power.label,
    label: power.label,
    category: power.category,
    automation: power.automation,
    activation: add2eMagicClone(power.activation ?? {}),
    parameters: add2eMagicClone(parameters),
    effects: add2eMagicCatalogueResolveTemplates(power.effects ?? [], parameters),
    effectTemplates: add2eMagicClone(power.effects ?? []),
    compatibility: add2eMagicClone(power.compatibility ?? {}),
    validation: add2eMagicClone(power.validation ?? {}),
    source: add2eMagicClone(power.source ?? {}),
    catalogue: {
      id: catalogue?.manifest?.catalogueId ?? catalogue?.manifest?.id ?? "add2e-gdm-magic-powers",
      version: catalogue?.manifest?.version ?? "",
      runtimeVersion: catalogue?.runtimeVersion ?? ""
    },
    ...(onUse ? { onUse, onuse: onUse, on_use: onUse } : {})
  };
}

async function add2eMagicCatalogueValidateSelection(selection, profileKey) {
  if (!Array.isArray(selection) || !selection.length) return { powers: [], catalogue: null };
  if (typeof globalThis.add2eLoadMagicPowerCatalogue !== "function") throw new Error("Le catalogue de pouvoirs est indisponible.");
  const catalogue = await globalThis.add2eLoadMagicPowerCatalogue();
  const profile = ADD2E_MAGIC_CREATOR_PROFILES[profileKey];
  const compatible = await globalThis.add2eGetCompatibleMagicPowers({ profile: profileKey, itemType: profile.itemType });
  const compatibleIds = new Set(compatible.map(power => power.id));
  const powers = [];
  for (const raw of selection) {
    const catalogueId = String(raw?.catalogueId ?? "").trim();
    const definition = catalogue.powerById?.get?.(catalogueId);
    if (!definition) throw new Error(`Pouvoir de catalogue inconnu : ${catalogueId || "identifiant vide"}.`);
    if (!compatibleIds.has(catalogueId)) throw new Error(`Le pouvoir « ${definition.label} » n'est pas compatible avec le profil ${profile.label}.`);
    const parameters = raw?.parameters && typeof raw.parameters === "object" && !Array.isArray(raw.parameters)
      ? add2eMagicClone(raw.parameters)
      : {};
    const missing = add2eMagicCatalogueValidateParameters(definition, parameters);
    if (missing.length) throw new Error(`Paramètres manquants pour « ${definition.label} » : ${missing.join(", ")}.`);
    powers.push(add2eMagicCatalogueStoredPower(definition, parameters, catalogue));
  }
  return { powers, catalogue };
}

function add2eMagicCatalogueAttachToItemData(itemData, powers, catalogue) {
  itemData.system ??= {};
  itemData.system.pouvoirs = add2eMagicClone(powers ?? []);
  itemData.flags ??= {};
  itemData.flags.add2e ??= {};
  itemData.flags.add2e.magicPowerCatalogue = {
    schema: ADD2E_MAGIC_CATALOGUE_SELECTION_SCHEMA,
    catalogueId: catalogue?.manifest?.catalogueId ?? catalogue?.manifest?.id ?? "add2e-gdm-magic-powers",
    catalogueVersion: catalogue?.manifest?.version ?? "",
    runtimeVersion: catalogue?.runtimeVersion ?? "",
    powerIds: (powers ?? []).map(power => power.catalogueId)
  };
}

async function add2eMagicBuilderCollectCreatorBases() {
  const result = { arme: [], armure: [] };
  for (const pack of game.packs ?? []) {
    if (String(pack.documentName ?? pack.metadata?.type ?? "") !== "Item") continue;
    const packKeys = [pack.collection, pack.metadata?.name, pack.metadata?.label, pack.title]
      .map(value => String(value ?? "").trim().toLowerCase());
    const isWeaponPack = packKeys.some(value => value === "armes" || value.endsWith(".armes"));
    const isArmorPack = packKeys.some(value => value === "armures" || value.endsWith(".armures"));
    if (!isWeaponPack && !isArmorPack) continue;
    let index;
    try { index = await pack.getIndex({ fields: ["name", "type", "img"] }); }
    catch (error) {
      console.warn("[ADD2E][OBJET_MAGIQUE][BASE_INDEX_ERROR]", { pack: pack.collection, error });
      continue;
    }
    const source = String(pack.title ?? pack.metadata?.label ?? pack.collection);
    for (const entry of index ?? []) {
      const type = String(entry.type ?? "").trim().toLowerCase();
      if ((type === "arme" && !isWeaponPack) || (type === "armure" && !isArmorPack)) continue;
      if (type !== "arme" && type !== "armure") continue;
      result[type].push({
        uuid: String(entry.uuid ?? `Compendium.${pack.collection}.${entry._id}`),
        name: String(entry.name ?? "Base"),
        source
      });
    }
  }
  for (const type of ["arme", "armure"]) {
    result[type].sort((left, right) => left.source.localeCompare(right.source, "fr") || left.name.localeCompare(right.name, "fr"));
  }
  return result;
}

function add2eMagicBuilderCreatorBaseOptions(entries) {
  const groups = new Map();
  for (const entry of entries ?? []) {
    if (!groups.has(entry.source)) groups.set(entry.source, []);
    groups.get(entry.source).push(entry);
  }
  return [...groups.entries()].map(([source, rows]) => {
    const options = rows.map(entry => `<option value="${add2eObjectMagicEscapeHtml(entry.uuid)}">${add2eObjectMagicEscapeHtml(entry.name)}</option>`).join("");
    return `<optgroup label="${add2eObjectMagicEscapeHtml(source)}">${options}</optgroup>`;
  }).join("");
}

function add2eMagicBuilderToggleCreatorType(form) {
  const root = form?.closest?.(".window-content") ?? form;
  const profileKey = String(add2eMagicCreatorField(form, "profile")?.value ?? "objet");
  const profile = ADD2E_MAGIC_CREATOR_PROFILES[profileKey] ?? ADD2E_MAGIC_CREATOR_PROFILES.objet;
  const weaponGroup = root?.querySelector?.('[data-add2e-base-group="arme"]');
  const armorGroup = root?.querySelector?.('[data-add2e-base-group="armure"]');
  const applicationGroup = root?.querySelector?.('[data-add2e-application-group]');
  const chargesGroup = root?.querySelector?.('[data-add2e-charges-group]');
  const rechargeGroup = root?.querySelector?.('[data-add2e-recharge-group]');
  if (weaponGroup) {
    weaponGroup.hidden = profileKey !== "arme";
    weaponGroup.style?.setProperty?.("display", profileKey === "arme" ? "" : "none", profileKey === "arme" ? "" : "important");
  }
  if (armorGroup) {
    armorGroup.hidden = profileKey !== "armure";
    armorGroup.style?.setProperty?.("display", profileKey === "armure" ? "" : "none", profileKey === "armure" ? "" : "important");
  }
  if (applicationGroup) applicationGroup.hidden = !["objet", "arme", "armure", "anneau", "baguette", "batonnet", "potion"].includes(profileKey);
  if (chargesGroup) chargesGroup.hidden = profile.charges !== true;
  if (rechargeGroup) rechargeGroup.hidden = profile.charges !== true;
  const application = add2eMagicCreatorField(form, "application");
  const current = add2eMagicCreatorField(form, "chargesValue");
  const maximum = add2eMagicCreatorField(form, "chargesMax");
  if (application && application.dataset.profile !== profileKey) {
    application.value = add2eMagicBuilderDefaultApplication(profile.itemType);
    application.dataset.profile = profileKey;
  }
  if (current && current.dataset.profile !== profileKey) {
    current.value = String(profile.defaultCharges ?? 0);
    current.dataset.profile = profileKey;
  }
  if (maximum && maximum.dataset.profile !== profileKey) {
    maximum.value = String(profile.defaultMax ?? 0);
    maximum.dataset.profile = profileKey;
  }
}

function add2eMagicBuilderBindCreator(form) {
  if (!form || form.dataset.add2eMagicCreatorBound === "1") return false;
  form.dataset.add2eMagicCreatorBound = "1";
  const profileSelect = add2eMagicCreatorField(form, "profile");
  form.addEventListener("input", event => {
    const target = event.target;
    if (target?.matches?.('[data-add2e-power-search]')) {
      add2eMagicCatalogueRenderAvailable(form, add2eMagicCreatorState(form));
    }
  });
  form.addEventListener("change", event => {
    const target = event.target;
    if (target?.matches?.('[data-add2e-power-category], [data-add2e-power-automation]')) {
      add2eMagicCatalogueRenderAvailable(form, add2eMagicCreatorState(form));
      return;
    }
    if (target === profileSelect || target?.matches?.('select[name="profile"]')) {
      add2eMagicBuilderToggleCreatorType(form);
      add2eMagicCatalogueRefreshCompatibility(form, { profileChanged: true }).catch(error => {
        console.error("[ADD2E][MAGIC_POWER_CATALOGUE][PROFILE_ERROR]", error);
        ui.notifications.error(error.message);
      });
    }
  });
  form.addEventListener("click", event => {
    const action = event.target?.closest?.("[data-action]");
    if (!action) return;
    const actionName = String(action.dataset.action ?? "");
    if (!actionName.includes("catalogue-power")) return;
    event.preventDefault();
    event.stopPropagation();
    if (actionName === "add-catalogue-power") {
      add2eMagicCatalogueAddSelected(form).catch(error => {
        console.error("[ADD2E][MAGIC_POWER_CATALOGUE][ADD_ERROR]", error);
        ui.notifications.error(error.message);
      });
    } else if (actionName === "edit-catalogue-power") {
      add2eMagicCatalogueEditSelected(form, action.dataset.powerUid).catch(error => {
        console.error("[ADD2E][MAGIC_POWER_CATALOGUE][EDIT_ERROR]", error);
        ui.notifications.error(error.message);
      });
    } else if (actionName === "remove-catalogue-power") {
      add2eMagicCatalogueRemoveSelected(form, action.dataset.powerUid);
    }
  });
  add2eMagicBuilderToggleCreatorType(form);
  add2eMagicCatalogueRefreshCompatibility(form).catch(error => {
    console.error("[ADD2E][MAGIC_POWER_CATALOGUE][LOAD_ERROR]", error);
    const status = form.querySelector('[data-add2e-power-status]');
    if (status) status.textContent = `Catalogue indisponible : ${error.message}`;
    const addButton = form.querySelector('[data-action="add-catalogue-power"]');
    if (addButton) addButton.disabled = true;
  });
  return true;
}

function add2eMagicBuilderCreateDialogV2Class(DialogV2) {
  return class Add2eMagicItemCreatorDialogV2 extends DialogV2 {
    _onRender(context, options) {
      super._onRender?.(context, options);
      queueMicrotask(() => this.add2eBindCreator());
      globalThis.requestAnimationFrame?.(() => this.add2eBindCreator());
    }
    add2eBindCreator() {
      return add2eMagicBuilderBindCreator(add2eMagicCreatorForm(this));
    }
  };
}

async function add2eMagicBuilderWaitCreatorDialog(DialogV2, config) {
  const CreatorDialogV2 = add2eMagicBuilderCreateDialogV2Class(DialogV2);
  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
      return value;
    };
    const buttons = (config.buttons ?? []).map(button => ({
      ...button,
      callback: async (...args) => {
        const value = await button.callback?.(...args);
        if (value === false) return false;
        return finish(value);
      }
    }));
    const dialog = new CreatorDialogV2({ ...config, buttons });
    dialog.addEventListener?.("close", () => finish(null), { once: true });
    const bind = () => dialog.add2eBindCreator?.();
    Promise.resolve(dialog.render({ force: true })).then(bind);
    queueMicrotask(bind);
    globalThis.setTimeout?.(bind, 50);
    globalThis.setTimeout?.(bind, 150);
  });
}

function add2eMagicBuilderCreatorSpellbookData(profile, name) {
  const ownerList = String(profile.spellbookOwnerList ?? "");
  return {
    name,
    type: "objet",
    img: profile.img,
    system: {
      nom: name,
      type: "objet",
      categorie: "objet_magique",
      sousType: "livre_de_sorts",
      quantite: 1,
      poids: 5,
      equipee: false,
      magique: true,
      consommable: false,
      description: "Livre de sorts indépendant. Il peut être placé dans un coffre, ramassé et consulté par un personnage compatible.",
      arcaneDocument: {
        schema: 1,
        kind: "spellbook",
        personal: false,
        ownerList,
        ownerActorUuid: "",
        spells: []
      },
      nom_non_identifie: "Livre de sorts"
    },
    effects: [],
    flags: {
      add2e: {
        arcaneDocumentKind: "spellbook",
        personalSpellbook: false,
        ownerActorUuid: "",
        ownerSpellList: ownerList,
        generatedBy: "migration-livres-parchemins-v1"
      }
    }
  };
}

function add2eMagicBuilderCreatorReadForm(button, dialog) {
  const form = button?.form
    ?? button?.element?.closest?.("form")
    ?? add2eMagicCreatorForm(dialog)?.closest?.("form")
    ?? dialog?.element?.querySelector?.("form");
  if (!form) return null;
  const data = Object.fromEntries(new FormData(form).entries());
  const profile = String(data.profile ?? "objet").trim();
  const baseUuid = profile === "arme"
    ? String(data.weaponBaseUuid ?? "").trim()
    : profile === "armure"
      ? String(data.armorBaseUuid ?? "").trim()
      : "";
  let cataloguePowers = [];
  try {
    const parsed = JSON.parse(String(data.cataloguePowersJson ?? "[]"));
    cataloguePowers = Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    ui.notifications.warn("La sélection des pouvoirs du catalogue est invalide.");
    return false;
  }
  return {
    profile,
    baseUuid,
    name: String(data.name ?? "").trim(),
    unidentifiedName: String(data.unidentifiedName ?? "").trim(),
    identified: data.identified === "on",
    cursed: data.cursed === "on",
    application: String(data.application ?? "").trim(),
    bonusToucher: add2eMagicNumber(data.bonusToucher, 0),
    bonusDegats: add2eMagicNumber(data.bonusDegats, 0),
    bonusCA: add2eMagicNumber(data.bonusCA, 0),
    caFixe: add2eMagicOptionalNumber(data.caFixe),
    chargesValue: Math.max(0, Math.trunc(add2eMagicNumber(data.chargesValue, 0))),
    chargesMax: Math.max(0, Math.trunc(add2eMagicNumber(data.chargesMax, 0))),
    rechargeable: data.rechargeable === "on",
    rechargeFormula: String(data.rechargeFormula ?? "").trim(),
    cataloguePowers
  };
}

function add2eMagicBuilderCreatorSanitizeBase(baseItem, profile, name) {
  const source = add2eMagicClone(baseItem.toObject?.() ?? {});
  delete source._id;
  delete source.folder;
  delete source.sort;
  delete source.ownership;
  delete source._stats;
  source.name = name;
  source.type = profile.itemType;
  source.img = baseItem.img || profile.img;
  source.system = add2eMagicClone(baseItem.system ?? {});
  source.effects = Array.isArray(source.effects) ? source.effects : [];
  source.flags = add2eMagicClone(baseItem.flags ?? {});
  source.flags.add2e ??= {};
  return source;
}

function add2eMagicBuilderCreatorEnchantSystem(itemData, profileKey, profile, result, baseItem = null) {
  const system = itemData.system ??= {};
  const type = profile.itemType;
  const baseStats = baseItem ? add2eMagicBuilderReadBaseStats(baseItem) : {
    bonusToucher: 0,
    bonusDegats: 0,
    bonusCA: 0,
    caFixe: null
  };
  const application = ["source", "porteur"].includes(result.application)
    ? result.application
    : add2eMagicBuilderDefaultApplication(type);
  system.nom = itemData.name;
  system.type = type;
  system.magique = true;
  system.identifie = result.identified;
  system.maudit = result.cursed;
  system.nom_non_identifie = result.unidentifiedName || (type === "arme" ? "Arme inconnue" : type === "armure" ? "Armure inconnue" : "Objet inconnu");
  system.equipee ??= false;
  system.tags = add2eMagicMergeUniqueValues(system.tags, profile.tags);
  system.effectTags = add2eMagicMergeUniqueValues(system.effectTags, profile.tags);
  const enchantement = {
    schema: 1,
    baseUuid: String(baseItem?.uuid ?? ""),
    baseName: String(baseItem?.name ?? ""),
    baseType: String(baseItem?.type ?? ""),
    application,
    bonusToucher: result.bonusToucher,
    bonusDegats: result.bonusDegats,
    bonusCA: result.bonusCA,
    caFixe: result.caFixe,
    baseStats
  };
  system.enchantement = enchantement;
  if (type === "arme") {
    const sourceMode = application === "source";
    system.bonus_hit = baseStats.bonusToucher + (sourceMode ? result.bonusToucher : 0);
    system.bonus_dom = baseStats.bonusDegats + (sourceMode ? result.bonusDegats : 0);
  } else {
    system.bonus_toucher = result.bonusToucher;
    system.bonus_degats = result.bonusDegats;
  }
  system.bonus_ac = baseStats.bonusCA + result.bonusCA;
  system.ca_fixe = result.caFixe ?? baseStats.caFixe ?? null;
  if (application === "porteur") {
    if (result.bonusToucher) system.effectTags = add2eMagicMergeUniqueValues(system.effectTags, `bonus_attaque:${add2eMagicSigned(result.bonusToucher)}`);
    if (result.bonusDegats) system.effectTags = add2eMagicMergeUniqueValues(system.effectTags, `bonus_degats:${add2eMagicSigned(result.bonusDegats)}`);
  }
  const max = profile.charges ? Math.max(result.chargesMax, result.chargesValue) : 0;
  const current = profile.charges ? Math.min(result.chargesValue, max) : 0;
  if (profile.charges || max > 0) {
    system.charges = {
      value: current,
      max,
      ...(result.rechargeable || profile.rechargeable ? {
        mode: "charges",
        recharge: "rechargeable",
        rechargeable: true,
        rechargeFormula: result.rechargeFormula || profile.rechargeFormula || "1d6"
      } : {})
    };
  }
  itemData.flags ??= {};
  itemData.flags.add2e ??= {};
  Object.assign(itemData.flags.add2e, {
    magicItemProfile: profileKey,
    magicItemBuilderVersion: ADD2E_MAGIC_ITEM_BUILDER_VERSION,
    kind: profile.sousType ?? profileKey,
    category: "objet_magique",
    ...(baseItem ? {
      baseItemUuid: baseItem.uuid,
      baseItemName: baseItem.name,
      baseItemType: baseItem.type
    } : {})
  });
  itemData.flags.add2e.magicItemBuilder = {
    version: ADD2E_MAGIC_ITEM_BUILDER_VERSION,
    generatedTags: application === "porteur"
      ? [
          result.bonusToucher ? `bonus_attaque:${add2eMagicSigned(result.bonusToucher)}` : "",
          result.bonusDegats ? `bonus_degats:${add2eMagicSigned(result.bonusDegats)}` : ""
        ].filter(Boolean)
      : []
  };
}

async function add2eMagicBuilderCreateMagicItem(directory = null) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return ui.notifications.error("DialogV2 est introuvable.");
  const bases = await add2eMagicBuilderCollectCreatorBases();
  const weaponOptions = add2eMagicBuilderCreatorBaseOptions(bases.arme);
  const armorOptions = add2eMagicBuilderCreatorBaseOptions(bases.armure);
  const profileOptions = Object.entries(ADD2E_MAGIC_CREATOR_PROFILES)
    .map(([key, profile]) => `<option value="${key}">${add2eObjectMagicEscapeHtml(profile.label)}</option>`)
    .join("");
  const result = await add2eMagicBuilderWaitCreatorDialog(DialogV2, {
    window: { title: "Créer un objet magique" },
    modal: true,
    rejectClose: false,
    content: `<div class="add2e-dialog add2e-magic-item-create-form" style="min-width:660px;padding:8px;display:grid;gap:8px;">
      <div class="form-group"><label>Type</label><select name="profile">${profileOptions}</select></div>
      <div class="form-group" data-add2e-base-group="arme" hidden><label>Arme de base</label><select name="weaponBaseUuid"><option value="">— Choisir une arme —</option>${weaponOptions}</select></div>
      <div class="form-group" data-add2e-base-group="armure" hidden><label>Armure de base</label><select name="armorBaseUuid"><option value="">— Choisir une armure —</option>${armorOptions}</select></div>
      <div class="form-group"><label>Nom</label><input name="name" type="text" value="Objet magique"></div>
      <div class="form-group"><label>Nom non identifié</label><input name="unidentifiedName" type="text" value="Objet inconnu"></div>
      <div class="form-group" style="display:flex;gap:18px;"><label><input name="identified" type="checkbox"> Identifié</label><label><input name="cursed" type="checkbox"> Maudit</label></div>
      <input name="application" type="hidden" value="porteur">
      <div data-add2e-application-group>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
          <div class="form-group"><label>Bonus au toucher</label><input name="bonusToucher" type="number" step="1" value="0"></div>
          <div class="form-group"><label>Bonus aux dégâts</label><input name="bonusDegats" type="number" step="1" value="0"></div>
          <div class="form-group"><label>Bonus de CA</label><input name="bonusCA" type="number" step="1" value="0"></div>
          <div class="form-group"><label>CA fixe</label><input name="caFixe" type="number" step="1" value=""></div>
        </div>
      </div>
      <div data-add2e-charges-group style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
        <div class="form-group"><label>Charges actuelles</label><input name="chargesValue" data-profile="objet" type="number" min="0" step="1" value="0"></div>
        <div class="form-group"><label>Charges maximales</label><input name="chargesMax" data-profile="objet" type="number" min="0" step="1" value="0"></div>
      </div>
      <div class="form-group" data-add2e-recharge-group style="display:flex;align-items:center;gap:12px;"><label><input name="rechargeable" type="checkbox"> Rechargeable</label><label style="flex:1;">Formule <input name="rechargeFormula" type="text" value="1d6"></label></div>
      <section data-add2e-power-section style="display:grid;gap:8px;border:1px solid var(--color-border-light-primary,#999);border-radius:7px;padding:9px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <h3 style="margin:0;flex:1;"><i class="fa-solid fa-wand-sparkles"></i> Pouvoirs magiques</h3>
          <span data-add2e-selected-count style="font-size:.8em;padding:2px 7px;border:1px solid currentColor;border-radius:999px;">0 sélectionné</span>
        </div>
        <p data-add2e-power-status style="margin:0;font-size:.84em;opacity:.78;">Chargement du catalogue…</p>
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:6px;">
          <input data-add2e-power-search type="search" placeholder="Rechercher un pouvoir">
          <select data-add2e-power-category><option value="">Toutes les catégories</option></select>
          <select data-add2e-power-automation><option value="">Toute automatisation</option></select>
        </div>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:end;">
          <label style="display:grid;gap:4px;"><span data-add2e-power-available-count>0 pouvoir compatible</span><select data-add2e-power-select></select></label>
          <button type="button" data-action="add-catalogue-power"><i class="fa-solid fa-plus"></i> Ajouter</button>
        </div>
        <div data-add2e-selected-powers style="display:grid;gap:6px;"></div>
        <input type="hidden" name="cataloguePowersJson" value="[]">
        <p style="margin:0;font-size:.8em;opacity:.7;">Les pouvoirs sélectionnés seront enregistrés dans le nouvel Item. Les artefacts et reliques restent exclus.</p>
      </section>
      <p style="margin:0;font-size:.85em;opacity:.8;">Arme et Armure exigent une base issue d'un compendium. Objet reste disponible et crée un objet magique générique.</p>
    </div>`,
    buttons: [
      {
        action: "create",
        label: "Créer l'objet magique",
        icon: "fa-solid fa-wand-magic-sparkles",
        default: true,
        callback: (_event, button, dialog) => add2eMagicBuilderCreatorReadForm(button, dialog)
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
  });
  if (!result || typeof result !== "object") return null;
  const profileKey = String(result.profile ?? "").trim();
  const profile = ADD2E_MAGIC_CREATOR_PROFILES[profileKey];
  if (!profile) return ui.notifications.error("Le type d'objet magique sélectionné est invalide.");
  let catalogueSelection;
  try { catalogueSelection = await add2eMagicCatalogueValidateSelection(result.cataloguePowers, profileKey); }
  catch (error) {
    ui.notifications.error(error.message);
    return null;
  }
  let baseItem = null;
  if (profile.baseType) {
    if (!result.baseUuid) {
      ui.notifications.warn(`Choisissez une ${profile.baseType} de base dans la liste.`);
      return null;
    }
    baseItem = await add2eMagicBuilderResolveItem(result.baseUuid);
    if (!baseItem || add2eMagicBuilderType(baseItem) !== profile.baseType || !String(baseItem.uuid ?? "").startsWith("Compendium.")) {
      ui.notifications.error(`La base sélectionnée doit être une ${profile.baseType} provenant d'un compendium.`);
      return null;
    }
  }
  const requestedName = String(result.name ?? "").trim();
  const name = (!requestedName || requestedName === "Objet magique")
    ? (baseItem ? `${baseItem.name} magique` : profile.label)
    : requestedName;
  const folder = directory?.currentFolder?.id ?? directory?.folder?.id ?? null;
  let itemData;
  if (profile.spellbookOwnerList) {
    itemData = add2eMagicBuilderCreatorSpellbookData(profile, name);
  } else if (baseItem) {
    itemData = add2eMagicBuilderCreatorSanitizeBase(baseItem, profile, name);
    add2eMagicBuilderCreatorEnchantSystem(itemData, profileKey, profile, result, baseItem);
  } else {
    itemData = {
      name,
      type: profile.itemType,
      img: profile.img,
      system: {
        nom: name,
        type: profile.itemType,
        categorie: "objet_magique",
        sousType: profile.sousType ?? "objet_magique",
        sous_type: profile.sousType ?? "objet_magique",
        quantite: 1,
        poids: 0,
        equipee: false,
        magique: true,
        consommable: profile.consumable === true,
        description: "",
        tags: [...(profile.tags ?? [])],
        effectTags: [...(profile.tags ?? [])]
      },
      effects: [],
      flags: { add2e: {} }
    };
    add2eMagicBuilderCreatorEnchantSystem(itemData, profileKey, profile, result, null);
    if (profileKey === "parchemin") {
      itemData.system.arcaneDocument = { schema: 1, kind: "spell-scroll", personal: false, spells: [] };
      itemData.flags.add2e.arcaneDocumentKind = "spell-scroll";
    }
  }
  add2eMagicCatalogueAttachToItemData(itemData, catalogueSelection.powers, catalogueSelection.catalogue);
  if (folder) itemData.folder = folder;
  const ItemClass = CONFIG?.Item?.documentClass ?? globalThis.Item;
  const created = await ItemClass.create(itemData, { renderSheet: true });
  ui.notifications.info(`${created?.name ?? name} a été créé avec ${catalogueSelection.powers.length} pouvoir${catalogueSelection.powers.length > 1 ? "s" : ""} du catalogue.`);
  return created;
}

function add2eMagicBuilderInstallDirectoryCreator(app, html) {
  queueMicrotask(() => {
    const root = html instanceof HTMLElement
      ? html
      : html?.[0] instanceof HTMLElement
        ? html[0]
        : app?.element;
    const current = root?.querySelector?.(".add2e-create-magic-item");
    if (!current || current.dataset.add2eUnifiedCreator === "true") return;
    const button = current.cloneNode(true);
    button.dataset.add2eUnifiedCreator = "true";
    button.title = "Créer un objet, une arme ou une armure magique";
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      add2eMagicBuilderCreateMagicItem(app).catch(error => {
        console.error("[ADD2E][OBJET_MAGIQUE][CREATE_ERROR]", error);
        ui.notifications.error(error?.message || "Erreur pendant la création de l'objet magique.");
      });
    });
    current.replaceWith(button);
  });
}

globalThis.add2eObjectPowerOnUsePath = add2eObjectPowerOnUsePath;
globalThis.add2eObjectPowerCost = add2eObjectPowerCost;
globalThis.add2eObjectPowerMaxCharges = add2eObjectPowerMaxCharges;
globalThis.add2eObjectPowerCurrentCharges = add2eObjectPowerCurrentCharges;
globalThis.add2eObjectPowerSetCharges = add2eObjectPowerSetCharges;
globalThis.add2eBuildVirtualObjectPowerSort = add2eBuildVirtualObjectPowerSort;
globalThis.add2eExecuteObjectMagicPower = add2eExecuteObjectMagicPower;
globalThis.add2eMagicItemEquippedOrUsable = add2eMagicItemEquippedOrUsable;
globalThis.add2eMagicObjectRawPowers = add2eMagicObjectRawPowers;
globalThis.add2eMagicObjectPowerArray = add2eMagicObjectPowerArray;
globalThis.add2eMagicObjectActivePowerEntries = add2eMagicObjectActivePowerEntries;
globalThis.add2eMagicReadNumber = add2eMagicReadNumber;
globalThis.add2eMagicObjectChargeInfo = add2eMagicObjectChargeInfo;
globalThis.add2eMagicLooksMagical = add2eMagicLooksMagical;
globalThis.add2eMagicPowerGeneratedId = add2eMagicPowerGeneratedId;
globalThis.add2eUiCollectObjectMagicGroups = add2eUiCollectObjectMagicGroups;
globalThis.add2eUiCollectObjectMagicPowers = add2eUiCollectObjectMagicPowers;
globalThis.add2eUiBuildObjectMagicSection = add2eUiBuildObjectMagicSection;
globalThis.add2eUiInjectObjectMagicSection = add2eUiInjectObjectMagicSection;
globalThis.ADD2E_MAGIC_ITEM_BUILDER_VERSION = ADD2E_MAGIC_ITEM_BUILDER_VERSION;
globalThis.add2eMagicBuilderChooseBase = add2eMagicBuilderChooseBase;
globalThis.add2eMagicBuilderDropBase = add2eMagicBuilderDropBase;
globalThis.add2eMagicBuilderClearBase = add2eMagicBuilderClearBase;
globalThis.add2eMagicBuilderDropPower = add2eMagicBuilderDropPower;
globalThis.add2eMagicBuilderRemovePower = add2eMagicBuilderRemovePower;
globalThis.add2eMagicBuilderApplyBase = add2eMagicBuilderApplyBase;
globalThis.add2eCreateMagicItem = add2eMagicBuilderCreateMagicItem;

Hooks.on("preUpdateItem", (item, change) => add2eMagicBuilderSyncUpdate(item, change));
Hooks.on("renderItemDirectory", add2eMagicBuilderInstallDirectoryCreator);
Hooks.on("renderSidebarTab", (app, html) => {
  const id = String(app?.options?.id ?? app?.id ?? app?.constructor?.name ?? "").toLowerCase();
  if (id.includes("item")) add2eMagicBuilderInstallDirectoryCreator(app, html);
});
Hooks.once("ready", () => {
  globalThis.add2eCreateMagicItem = add2eMagicBuilderCreateMagicItem;
});
