// ADD2E — Objets magiques : créateur unifié d'Items.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.

import {
  ADD2E_MAGIC_ITEM_BUILDER_VERSION,
  add2eMagicClone,
  add2eMagicMergeUniqueValues,
  add2eMagicNumber,
  add2eMagicOptionalNumber,
  add2eMagicSigned,
  add2eObjectMagicEscapeHtml,
  add2eObjectMagicNormalizeTag
} from "./core.mjs";
import { ADD2E_MAGIC_CREATOR_PROFILES } from "./profiles.mjs";
import {
  add2eMagicBuilderDefaultApplication,
  add2eMagicBuilderReadBaseStats,
  add2eMagicBuilderResolveItem,
  add2eMagicBuilderType
} from "./enchantment-builder.mjs";
import {
  add2eMagicCatalogueAddSelected,
  add2eMagicCatalogueAttachToItemData,
  add2eMagicCatalogueEditSelected,
  add2eMagicCatalogueRefreshCompatibility,
  add2eMagicCatalogueRemoveSelected,
  add2eMagicCatalogueRenderAvailable,
  add2eMagicCatalogueValidateSelection,
  add2eMagicCreatorField,
  add2eMagicCreatorForm,
  add2eMagicCreatorState
} from "./catalogue-editor.mjs";

const ADD2E_MAGIC_ARMOR_BONUS_POWER_TYPES = new Set([
  "armor_class_bonus",
  "armor_bonus",
  "ac_bonus",
  "defense_bonus",
  "protection_bonus"
]);

let hooksInstalled = false;

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

function add2eMagicBuilderArmorPowerType(effect) {
  return ADD2E_MAGIC_ARMOR_BONUS_POWER_TYPES.has(
    add2eObjectMagicNormalizeTag(effect?.type ?? effect?.kind ?? effect?.category)
  );
}

function add2eMagicBuilderTemplateParameterKeys(value, keys = new Set()) {
  if (Array.isArray(value)) {
    value.forEach(entry => add2eMagicBuilderTemplateParameterKeys(entry, keys));
    return keys;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach(entry => add2eMagicBuilderTemplateParameterKeys(entry, keys));
    return keys;
  }
  if (typeof value !== "string") return keys;
  for (const match of value.matchAll(/@([A-Za-z0-9_]+)/g)) keys.add(match[1]);
  return keys;
}

function add2eMagicBuilderCanonicalizeArmorBonusPowers(powers = []) {
  const normalized = add2eMagicClone(powers ?? []);
  const bonuses = [];
  for (const power of normalized) {
    const effects = Array.isArray(power?.effects) ? power.effects : [];
    const templates = Array.isArray(power?.effectTemplates) ? power.effectTemplates : [];
    const armorEffects = effects.filter(add2eMagicBuilderArmorPowerType);
    const armorTemplates = templates.filter(add2eMagicBuilderArmorPowerType);
    for (const effect of armorEffects) {
      const value = add2eMagicOptionalNumber(
        effect?.bonus
        ?? effect?.value
        ?? effect?.amount
        ?? effect?.armorClassBonus
        ?? effect?.acBonus
      );
      if (Number.isFinite(value) && value !== 0) bonuses.push(Math.abs(value));
    }
    if (!armorEffects.length && !armorTemplates.length) continue;
    power.effects = effects.filter(effect => !add2eMagicBuilderArmorPowerType(effect));
    power.effectTemplates = templates.filter(effect => !add2eMagicBuilderArmorPowerType(effect));
    const parameterKeys = add2eMagicBuilderTemplateParameterKeys(armorTemplates);
    if (power.parameters && typeof power.parameters === "object" && !Array.isArray(power.parameters)) {
      for (const key of parameterKeys) delete power.parameters[key];
    }
    power.canonicalizedEffects = add2eMagicMergeUniqueValues(power.canonicalizedEffects, "armor-class");
  }
  return { powers: normalized, bonuses };
}

function add2eMagicBuilderResolveArmorBonusSource(result, powers = []) {
  const canonical = add2eMagicBuilderCanonicalizeArmorBonusPowers(powers);
  if (canonical.bonuses.length > 1) {
    throw new Error("Le bonus de CA est défini par plusieurs pouvoirs. Conservez un seul pouvoir de bonus d’armure.");
  }
  const powerBonus = canonical.bonuses[0] ?? 0;
  const fieldBonus = Math.abs(add2eMagicNumber(result?.bonusCA, 0));
  if (fieldBonus && powerBonus && fieldBonus !== powerBonus) {
    throw new Error(`Le bonus de CA du champ (${fieldBonus}) diffère de celui du pouvoir (${powerBonus}). Utilisez une seule valeur.`);
  }
  return {
    result: {
      ...result,
      bonusCA: powerBonus || fieldBonus
    },
    powers: canonical.powers
  };
}

function add2eMagicBuilderCanonicalDefenseModifiers(itemData, profileKey, type, result, baseStats) {
  itemData.flags ??= {};
  itemData.flags.add2e ??= {};
  const current = Array.isArray(itemData.flags.add2e.modifiers)
    ? add2eMagicClone(itemData.flags.add2e.modifiers)
    : [];
  const retained = current.filter(modifier => modifier?.metadata?.producer !== "magic-item-builder");
  const generated = [];
  const target = type === "armure" ? "naturel" : "total";
  const sourceKind = type === "armure" ? "armor" : "equipment";
  const defenseBonus = Number(baseStats?.bonusCA ?? 0) + Number(result?.bonusCA ?? 0);
  if (Number.isFinite(defenseBonus) && defenseBonus !== 0) {
    generated.push({
      id: "magic-item-builder:armor-class:bonus",
      domain: "armor-class",
      target,
      operation: "add",
      value: -Math.abs(defenseBonus),
      priority: 100,
      stacking: { mode: "stack", group: null },
      conditions: { equipped: true },
      source: { kind: sourceKind, name: itemData.name },
      metadata: {
        label: `${itemData.name} — bonus de CA`,
        producer: "magic-item-builder",
        profile: profileKey
      }
    });
  }
  const fixedRaw = result?.caFixe ?? baseStats?.caFixe ?? null;
  const fixedCA = fixedRaw === null || fixedRaw === undefined || fixedRaw === "" ? null : Number(fixedRaw);
  if (Number.isFinite(fixedCA)) {
    generated.push({
      id: "magic-item-builder:armor-class:fixed",
      domain: "armor-class",
      target,
      operation: "minmax",
      value: { max: fixedCA },
      priority: 300,
      stacking: { mode: "lowest", group: `armor-class:${target}:fixed-equipment` },
      conditions: { equipped: true },
      source: { kind: sourceKind, name: itemData.name },
      metadata: {
        label: `${itemData.name} — CA fixe ${fixedCA}`,
        producer: "magic-item-builder",
        profile: profileKey
      }
    });
  }
  itemData.flags.add2e.modifiers = [...retained, ...generated];
  return generated.map(modifier => modifier.id);
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
    schema: 2,
    baseUuid: String(baseItem?.uuid ?? ""),
    baseName: String(baseItem?.name ?? ""),
    baseType: String(baseItem?.type ?? ""),
    application,
    bonusToucher: result.bonusToucher,
    bonusDegats: result.bonusDegats,
    bonusCA: 0,
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
  for (const key of [
    "bonus_ac", "bonus_ca", "ca_bonus", "ac_bonus", "protectionBonus", "protection_bonus",
    "ca_fixe", "caFixe", "fixedCA", "fixed_ac", "ac_fixe", "acFixe"
  ]) delete system[key];
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
  const generatedModifierIds = add2eMagicBuilderCanonicalDefenseModifiers(itemData, profileKey, type, result, baseStats);
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
      : [],
    generatedModifiers: generatedModifierIds
  };
}

export async function add2eMagicBuilderCreateMagicItem(directory = null) {
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
  let canonical;
  try { canonical = add2eMagicBuilderResolveArmorBonusSource(result, catalogueSelection.powers); }
  catch (error) {
    ui.notifications.error(error.message);
    return null;
  }
  const canonicalResult = canonical.result;
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
    add2eMagicBuilderCreatorEnchantSystem(itemData, profileKey, profile, canonicalResult, baseItem);
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
    add2eMagicBuilderCreatorEnchantSystem(itemData, profileKey, profile, canonicalResult, null);
    if (profileKey === "parchemin") {
      itemData.system.arcaneDocument = { schema: 1, kind: "spell-scroll", personal: false, spells: [] };
      itemData.flags.add2e.arcaneDocumentKind = "spell-scroll";
    }
  }
  add2eMagicCatalogueAttachToItemData(itemData, canonical.powers, catalogueSelection.catalogue);
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

export function installMagicItemCreatorHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  Hooks.on("renderItemDirectory", add2eMagicBuilderInstallDirectoryCreator);
  Hooks.on("renderSidebarTab", (app, html) => {
    const id = String(app?.options?.id ?? app?.id ?? app?.constructor?.name ?? "").toLowerCase();
    if (id.includes("item")) add2eMagicBuilderInstallDirectoryCreator(app, html);
  });
  Hooks.once("ready", () => {
    globalThis.add2eCreateMagicItem = add2eMagicBuilderCreateMagicItem;
  });
}
