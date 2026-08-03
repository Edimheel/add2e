// scripts/add2e/item-sheet-registration.mjs
// ADD2E — Enregistrement strict des fiches d'items spécialisées.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.
// Version : 2026-08-03-canonical-power-source-v2

import { Add2eItemSheet } from "../add2e-item-sheet.mjs";
globalThis.Add2eItemSheet = Add2eItemSheet;

const POWER_FIELDS = ["pouvoirs", "powers", "pouvoirsMagiques", "magicalPowers"];
const MAGIC_ITEM_TYPES = new Set(["arme", "armure", "objet"]);
const EDITOR_VERSION = "2026-08-03-canonical-power-source-v2";
const NORMALIZER_VERSION = "2026-08-03-canonical-power-source-v2";
const BUILDER_MODIFIER_IDS = new Set([
  "magic-item-builder:attack:bonus",
  "magic-item-builder:damage:bonus",
  "magic-item-builder:armor-class:bonus",
  "magic-item-builder:armor-class:fixed"
]);
const BONUS_DEFINITIONS = Object.freeze({
  attack: Object.freeze({ marker: "attack", label: "Bonus au toucher", name: "Bonus magique au toucher", category: "combat", effectType: "attack_bonus" }),
  damage: Object.freeze({ marker: "damage", label: "Bonus aux dégâts", name: "Bonus magique aux dégâts", category: "combat", effectType: "damage_bonus" }),
  armor: Object.freeze({ marker: "armor-class", label: "Bonus de CA", name: "Bonus magique d’armure ou de bouclier", category: "defense", effectType: "armor_class_bonus" }),
  fixedArmor: Object.freeze({ marker: "armor-class-fixed", label: "CA fixe", name: "Classe d’armure magique fixe", category: "defense", effectType: "fixed_armor_class" })
});
const ATTACK_TYPES = new Set(["attack_bonus", "hit_bonus", "combat_bonus", "attack_damage_bonus", "weapon_magic_bonus"]);
const DAMAGE_TYPES = new Set(["damage_bonus", "combat_bonus", "attack_damage_bonus", "weapon_magic_bonus"]);
const ARMOR_TYPES = new Set(["armor_class_bonus", "armor_bonus", "ac_bonus", "defense_bonus", "protection_bonus"]);
const FIXED_ARMOR_TYPES = new Set([
  "fixed_armor_class", "armor_class_fixed", "armor_class_base", "fixed_ac", "ac_fixed",
  "classe_armure_fixe", "classe_armure_base", "ca_fixe", "ca_base", "defense_base"
]);

function add2eItemsCollection() { return foundry?.documents?.collections?.Items ?? globalThis.Items; }
function add2eItemDocumentClass() { return foundry?.documents?.Item ?? globalThis.Item; }
function clone(value) { try { return foundry.utils.deepClone(value); } catch (_e) { try { return structuredClone(value); } catch (_e2) { return JSON.parse(JSON.stringify(value)); } } }
function esc(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function norm(value) { return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9:+*_.-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, ""); }
function list(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(list);
  if (value instanceof Set) return [...value].flatMap(list);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["value", "values", "list", "lists", "items", "entries", "tags", "effectTags", "targets", "types"]) {
      if (value[key] !== undefined && value[key] !== null) return list(value[key]);
    }
    return Object.values(value).flatMap(list);
  }
  return [value];
}
function format(value) { if (value == null || value === "") return "—"; if (typeof value !== "object") return String(value); try { return JSON.stringify(value, null, 2); } catch (_e) { return String(value); } }
function number(value, fallback = 0) { if (value == null || value === "") return fallback; const result = Number(String(value).replace(",", ".")); return Number.isFinite(result) ? result : fallback; }
function optionalNumber(value) { if (value == null || value === "") return null; const result = Number(String(value).replace(",", ".")); return Number.isFinite(result) ? result : null; }
function signed(value) { const result = number(value, 0); return `${result >= 0 ? "+" : ""}${result}`; }
function getProperty(object, path) { try { return foundry.utils.getProperty(object, path); } catch (_e) { return String(path).split(".").reduce((current, key) => current?.[key], object); } }
function setProperty(object, path, value) {
  try { return foundry.utils.setProperty(object, path, clone(value)); }
  catch (_e) {
    const parts = String(path).split(".");
    let current = object;
    while (parts.length > 1) { const key = parts.shift(); current[key] ??= {}; current = current[key]; }
    current[parts[0]] = clone(value);
    return true;
  }
}
function merge(base, update) { try { return foundry.utils.mergeObject(clone(base ?? {}), clone(update ?? {}), { inplace: false, insertKeys: true, overwrite: true, recursive: true }); } catch (_e) { return { ...(base ?? {}), ...(update ?? {}) }; } }
function expand(value) {
  try { return foundry.utils.expandObject(clone(value ?? {})); }
  catch (_e) {
    const result = {};
    for (const [path, entry] of Object.entries(value ?? {})) path.includes(".") ? setProperty(result, path, entry) : (result[path] = clone(entry));
    return result;
  }
}
function flattenedPaths(value) { const result = new Set(Object.keys(value ?? {})); try { for (const path of Object.keys(foundry.utils.flattenObject(value ?? {}))) result.add(path); } catch (_e) {} return [...result]; }
function mergeUnique(...values) {
  const seen = new Set();
  const result = [];
  for (const raw of values) for (const value of list(raw)) {
    const text = String(value ?? "").trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function defaultActorTokenLink(actor, data = {}) {
  const type = String(actor?.type ?? data?.type ?? "").trim().toLowerCase();
  if (type === "personnage") return true;
  if (["monstre", "monster"].includes(type)) return false;
  return null;
}
function defaultCharacterSightRange() { const distance = Number(canvas?.scene?.grid?.distance ?? game?.scenes?.active?.grid?.distance ?? 1); return Number.isFinite(distance) && distance > 0 ? distance * 5 : 5; }

function powerStore(item) {
  const system = item?.system ?? {};
  let fallback = null;
  for (const field of POWER_FIELDS) {
    const raw = system[field];
    let store = null;
    if (Array.isArray(raw)) store = { path: `system.${field}`, entries: raw, keys: raw.map((_value, index) => index), object: false };
    else if (raw && typeof raw === "object") { const keys = Object.keys(raw); store = { path: `system.${field}`, entries: keys.map(key => raw[key]), keys, object: true, raw }; }
    if (!store) continue;
    if (store.entries.length) return store;
    fallback ??= store;
  }
  return fallback ?? { path: "system.pouvoirs", entries: [], keys: [], object: false };
}
function rawPowers(system = {}) {
  for (const field of POWER_FIELDS) {
    const raw = system[field];
    if (Array.isArray(raw)) return raw.filter(entry => entry && typeof entry === "object");
    if (raw && typeof raw === "object") return Object.values(raw).filter(entry => entry && typeof entry === "object");
  }
  return [];
}
function powerField(system = {}) {
  for (const field of POWER_FIELDS) if (system[field] !== undefined) return field;
  return "pouvoirs";
}
function effectArray(power) {
  const raw = power?.effects;
  if (Array.isArray(raw)) return raw.filter(effect => effect && typeof effect === "object");
  if (raw && typeof raw === "object") return Object.values(raw).filter(effect => effect && typeof effect === "object");
  return [];
}
function firstOptional(...values) { for (const value of values) { const candidate = optionalNumber(value); if (candidate !== null) return candidate; } return null; }
function firstNonZero(...values) { for (const value of values) { const candidate = optionalNumber(value); if (candidate !== null && candidate !== 0) return candidate; } return null; }

function effectBonusValues(effect = {}) {
  const type = norm(effect.type ?? effect.kind ?? effect.category);
  const values = {};
  if (ATTACK_TYPES.has(type)) {
    const value = firstOptional(effect.attackBonus, effect.hitBonus, effect.bonusToucher, effect.toucher, type !== "damage_bonus" ? effect.bonus ?? effect.value : null);
    if (Number.isFinite(value) && value !== 0) values.attack = value;
  }
  if (DAMAGE_TYPES.has(type)) {
    const value = firstOptional(effect.damageBonus, effect.bonusDegats, effect.degats, type === "damage_bonus" ? effect.bonus ?? effect.value : null);
    if (Number.isFinite(value) && value !== 0) values.damage = value;
  }
  if (ARMOR_TYPES.has(type)) {
    const value = firstOptional(effect.bonus, effect.value, effect.amount, effect.armorClassBonus, effect.acBonus);
    if (Number.isFinite(value) && value !== 0) values.armor = Math.abs(value);
  }
  if (FIXED_ARMOR_TYPES.has(type)) {
    const value = firstOptional(effect.value, effect.amount, effect.armorClass, effect.armor_class, effect.ac, effect.ca, effect.fixedCA, effect.fixedAc, effect.base);
    if (Number.isFinite(value)) values.fixedArmor = value;
  }
  return values;
}
function powerBonusSummary(power) {
  const result = { attack: 0, damage: 0, armor: 0, fixedArmor: null };
  for (const effect of effectArray(power)) {
    const values = effectBonusValues(effect);
    result.attack += Number(values.attack) || 0;
    result.damage += Number(values.damage) || 0;
    result.armor += Number(values.armor) || 0;
    if (Number.isFinite(values.fixedArmor)) result.fixedArmor = result.fixedArmor === null ? values.fixedArmor : Math.min(result.fixedArmor, values.fixedArmor);
  }
  return result;
}
function itemPowerBonusSummary(item) {
  const result = { attack: 0, damage: 0, armor: 0, fixedArmor: null };
  for (const power of rawPowers(item?.system ?? {})) {
    const values = powerBonusSummary(power);
    result.attack += values.attack;
    result.damage += values.damage;
    result.armor += values.armor;
    if (Number.isFinite(values.fixedArmor)) result.fixedArmor = result.fixedArmor === null ? values.fixedArmor : Math.min(result.fixedArmor, values.fixedArmor);
  }
  return result;
}
function powerFieldValue(item, key) {
  const value = itemPowerBonusSummary(item)[String(key ?? "")];
  return value === null || value === undefined ? "" : value;
}
function powerValueLabel(power) {
  const values = powerBonusSummary(power);
  const labels = [];
  if (values.attack) labels.push(`${BONUS_DEFINITIONS.attack.label} ${signed(values.attack)}`);
  if (values.damage) labels.push(`${BONUS_DEFINITIONS.damage.label} ${signed(values.damage)}`);
  if (values.armor) labels.push(`${BONUS_DEFINITIONS.armor.label} ${signed(values.armor)}`);
  if (Number.isFinite(values.fixedArmor)) labels.push(`${BONUS_DEFINITIONS.fixedArmor.label} ${values.fixedArmor}`);
  return labels.join(" · ");
}

const CATEGORY_LABELS = { attribute: "Caractéristiques", charges: "Charges", combat: "Combat", consumable: "Consommable", control: "Contrôle", curse: "Malédiction", defense: "Défense", destruction: "Destruction", detection: "Détection", environment: "Environnement", healing: "Guérison", holy: "Sacré", illusion: "Illusion", immunity: "Immunité", light: "Lumière", movement: "Déplacement", negation: "Négation", poison: "Poison", protection: "Protection", random: "Aléatoire", ranged: "Distance", resistance: "Résistance", restriction: "Restriction", scroll: "Parchemin", social: "Social", spell: "Sort", summoning: "Invocation", survival: "Survie", transformation: "Transformation" };
function categoryLabel(value) { return CATEGORY_LABELS[norm(value)] ?? String(value ?? "Autre"); }
function automationLabel(value) { return ({ automatic: "Automatique", assisted: "Assisté par le MD", manual: "Manuel", chat_card: "Carte de chat" })[norm(value)] ?? String(value ?? "—"); }
function activationLabel(value) { if (!value) return "—"; if (typeof value === "string") return value; return [value.type, value.trigger].map(entry => String(entry ?? "").trim()).filter(Boolean).join(" — ") || "—"; }

function sheetPowers(item) {
  return powerStore(item).entries.map((power, index) => ({ power, index })).filter(entry => entry.power && typeof entry.power === "object").map(({ power, index }) => {
    const parameters = power.parameters && typeof power.parameters === "object" ? power.parameters : {};
    const effects = effectArray(power);
    const section = String(power.source?.section ?? "").trim();
    const page = String(power.source?.page ?? "").trim();
    const canonicalValueLabel = powerValueLabel(power);
    return {
      ...power,
      _add2eIndex: index,
      _add2eName: String(power.name ?? power.nom ?? power.label ?? `Pouvoir ${index + 1}`).trim(),
      _add2eCost: Math.max(0, Number(power.cout ?? power.cost ?? power.chargeCost ?? 0) || 0),
      _add2eKindLabel: power.catalogueId || power.kind === "catalogue" ? "Catalogue canonique" : "Sort lié",
      _add2eCategoryLabel: categoryLabel(power.category),
      _add2eAutomationLabel: automationLabel(power.automation),
      _add2eActivationLabel: activationLabel(power.activation),
      _add2eHasParameters: Object.keys(parameters).length > 0,
      _add2eParametersJson: format(parameters),
      _add2eHasEffects: effects.length > 0,
      _add2eEffectsJson: format(effects),
      _add2eSourceLabel: [section, page ? `page ${page}` : ""].filter(Boolean).join(", ") || "—",
      _add2eHasCanonicalValue: Boolean(canonicalValueLabel),
      _add2eCanonicalValueLabel: canonicalValueLabel
    };
  });
}

async function resolveItem(uuid) {
  const value = String(uuid ?? "").trim();
  if (!value) return null;
  try { const document = await fromUuid?.(value); if (document?.documentName === "Item") return document; } catch (_e) {}
  const id = value.split(".").at(-1);
  return game.items?.get?.(id) ?? game.actors?.contents?.flatMap(actor => actor.items?.contents ?? []).find(item => item.id === id) ?? null;
}

function resolveTemplates(value, parameters) {
  if (Array.isArray(value)) return value.map(entry => resolveTemplates(entry, parameters));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolveTemplates(entry, parameters)]));
  if (typeof value !== "string") return clone(value);
  const exact = value.match(/^@([A-Za-z0-9_]+)$/); if (exact && Object.hasOwn(parameters, exact[1])) return clone(parameters[exact[1]]);
  return value.replace(/@([A-Za-z0-9_]+)/g, (match, key) => Object.hasOwn(parameters, key) ? (typeof parameters[key] === "object" ? JSON.stringify(parameters[key]) : String(parameters[key])) : match);
}

async function editCanonical(definition, current = {}) {
  const configure = globalThis.add2eMagicCatalogueConfigurePower;
  if (typeof configure !== "function") {
    ui.notifications.error("L’éditeur canonique lisible des pouvoirs est indisponible.");
    return null;
  }
  return configure(definition, current);
}
async function editLegacy(power) {
  const DialogV2 = foundry?.applications?.api?.DialogV2; if (!DialogV2?.wait) return ui.notifications.error("DialogV2 est introuvable."), null;
  const name = String(power.name ?? power.nom ?? power.label ?? "Pouvoir").trim() || "Pouvoir", description = String(power.description ?? power.desc ?? ""), cost = Math.max(0, Number(power.cout ?? power.cost ?? power.chargeCost ?? 0) || 0);
  return DialogV2.wait({ window: { title: `Modifier — ${name}` }, modal: true, rejectClose: false, content: `<div class="add2e-dialog" style="min-width:520px;padding:10px;display:grid;gap:8px"><label>Nom affiché<input name="name" value="${esc(name)}"></label><label>Coût en charges<input name="cost" type="number" min="0" step="1" value="${cost}"></label><label>Description<textarea name="description" rows="6">${esc(description)}</textarea></label><p>Le sort lié et son script d’exécution sont conservés.</p></div>`, buttons: [{ action: "save", label: "Enregistrer", icon: "fa-solid fa-check", default: true, callback: (_event, button, dialog) => { const root = button?.form ?? dialog?.element, nextName = String(root?.querySelector('[name="name"]')?.value ?? "").trim(); if (!nextName) { ui.notifications.warn("Le nom du pouvoir est obligatoire."); return false; } return { name: nextName, cost: Math.max(0, Math.trunc(Number(root?.querySelector('[name="cost"]')?.value ?? 0) || 0)), description: String(root?.querySelector('[name="description"]')?.value ?? "") }; } }, { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }] });
}
async function storePower(item, store, index, power) {
  if (store.object) { const next = clone(store.raw), key = store.keys[index]; if (key === undefined) return false; next[key] = power; await item.update({ [store.path]: next }, { add2eMagicItemBuilder: true, add2eMagicPowerSheetEditor: true }); }
  else { const next = store.entries.map(clone); if (!next[index]) return false; next[index] = power; await item.update({ [store.path]: next }, { add2eMagicItemBuilder: true, add2eMagicPowerSheetEditor: true }); }
  return true;
}
async function editPower(itemUuid, powerIndex) {
  const item = await resolveItem(itemUuid); if (!item) return ui.notifications.error("L’objet magique est introuvable."), false; if (item.isOwner === false) return ui.notifications.warn("Tu ne peux pas modifier cet objet."), false;
  const store = powerStore(item), index = Number(powerIndex), power = Number.isInteger(index) ? store.entries[index] : null; if (!power || typeof power !== "object") return ui.notifications.error("Le pouvoir sélectionné est introuvable."), false;
  let next;
  if (power.catalogueId) {
    if (typeof globalThis.add2eLoadMagicPowerCatalogue !== "function") return ui.notifications.error("Le catalogue de pouvoirs est indisponible."), false;
    const catalogue = await globalThis.add2eLoadMagicPowerCatalogue(), definition = catalogue?.powerById?.get?.(String(power.catalogueId)); if (!definition) return ui.notifications.error(`Pouvoir inconnu : ${power.catalogueId}.`), false;
    const parameters = await editCanonical(definition, power.parameters ?? {}); if (parameters === null) return false;
    next = { ...clone(power), schema: Number(power.schema ?? 2) || 2, kind: "catalogue", catalogueId: definition.id, name: definition.label, label: definition.label, category: definition.category, automation: definition.automation, activation: clone(definition.activation ?? {}), parameters: clone(parameters), effects: resolveTemplates(definition.effects ?? [], parameters), effectTemplates: clone(definition.effects ?? []), compatibility: clone(definition.compatibility ?? {}), validation: clone(definition.validation ?? {}), source: clone(definition.source ?? {}), catalogue: { ...clone(power.catalogue ?? {}), id: catalogue?.manifest?.catalogueId ?? catalogue?.manifest?.id ?? "add2e-gdm-magic-powers", version: catalogue?.manifest?.version ?? "", runtimeVersion: catalogue?.runtimeVersion ?? "" } };
  } else {
    const edited = await editLegacy(power); if (!edited || typeof edited !== "object") return false;
    next = { ...clone(power), name: edited.name, nom: edited.name, label: edited.name, description: edited.description, cout: edited.cost, cost: edited.cost };
  }
  if (!await storePower(item, store, index, next)) return false;
  ui.notifications.info(`${next.name ?? next.nom ?? "Pouvoir"} a été mis à jour.`); item.sheet?.render?.({ force: true }); return true;
}

function magicItemType(source) { return String(source?.type ?? "").trim().toLowerCase(); }
function itemHasMagicSignals(source) {
  const system = source?.system ?? {}, enchantment = system.enchantement, charges = system.charges;
  return MAGIC_ITEM_TYPES.has(magicItemType(source)) && Boolean(system.magique === true || system.magic === true || (enchantment && typeof enchantment === "object" && !Array.isArray(enchantment)) || rawPowers(system).length || number(charges?.max, 0) > 0 || number(charges?.value, 0) > 0 || source?.flags?.add2e?.magicItemProfile || source?.flags?.add2e?.magicPowerCatalogue || source?.flags?.add2e?.magicItemBuilder);
}
function enchantmentFromSource(source) {
  const system = source?.system ?? {}, type = magicItemType(source), raw = system.enchantement && typeof system.enchantement === "object" && !Array.isArray(system.enchantement) ? clone(system.enchantement) : {};
  const application = ["source", "porteur"].includes(String(raw.application ?? "").trim()) ? String(raw.application).trim() : type === "arme" ? "source" : "porteur";
  const bonusToucher = number(raw.bonusToucher ?? raw.bonus_toucher, 0), bonusDegats = number(raw.bonusDegats ?? raw.bonus_degats, 0), bonusCA = number(raw.bonusCA ?? raw.bonus_ca, 0), caFixe = optionalNumber(raw.caFixe ?? raw.ca_fixe);
  const currentHit = firstOptional(system.bonus_hit, system.bonus_toucher, system.hit_bonus, system.attack_bonus), currentDamage = firstOptional(system.bonus_dom, system.bonus_degats, system.damage_bonus, system.degats_bonus), currentCA = firstOptional(system.bonus_ac, system.bonus_ca, system.ac_bonus, system.ca_bonus);
  const rawBase = raw.baseStats && typeof raw.baseStats === "object" ? raw.baseStats : {};
  return { ...raw, schema: 2, baseUuid: String(raw.baseUuid ?? source?.flags?.add2e?.baseItemUuid ?? "").trim(), baseName: String(raw.baseName ?? source?.flags?.add2e?.baseItemName ?? "").trim(), baseType: String(raw.baseType ?? source?.flags?.add2e?.baseItemType ?? "").trim(), application, bonusToucher, bonusDegats, bonusCA, caFixe, baseStats: { bonusToucher: number(rawBase.bonusToucher, currentHit === null ? 0 : type === "arme" && application === "source" ? currentHit - bonusToucher : currentHit), bonusDegats: number(rawBase.bonusDegats, currentDamage === null ? 0 : type === "arme" && application === "source" ? currentDamage - bonusDegats : currentDamage), bonusCA: number(rawBase.bonusCA, currentCA === null ? 0 : currentCA - bonusCA), caFixe: optionalNumber(rawBase.caFixe) } };
}
function passivePower(power) {
  const automation = norm(power?.automation); if (automation && automation !== "automatic") return false;
  const type = norm(power?.activation?.type), trigger = norm(power?.activation?.trigger); if (["configured-result", "configured_result", "result-configured", "result_configured"].includes(trigger)) return false;
  if (["passive", "automatic", "always_on", "permanent"].includes(type)) return true;
  const activation = `${type} ${trigger}`; return ["equipped", "equip", "worn", "carried", "porte", "portee", "attack", "damage", "hit", "projectile", "target", "drawn"].some(token => activation.includes(token));
}
function targetMatchers(effect = {}, power = {}) {
  const parameters = power?.parameters && typeof power.parameters === "object" ? power.parameters : {}, ignored = new Set(["self", "owner", "porteur", "source", "target", "cible", "all", "tout", "any"]);
  const candidates = [effect.targetAny, effect.targets, effect.target, effect.against, effect.creature, effect.creatures, effect.creatureType, effect.creatureTypes, effect.race, effect.races, effect.enemy, effect.enemies, effect.targetType, effect.targetTypes, parameters.targetAny, parameters.targets, parameters.target, parameters.against, parameters.creature, parameters.creatures, parameters.creatureType, parameters.creatureTypes, parameters.race, parameters.races, parameters.enemy, parameters.enemies, parameters.targetType, parameters.targetTypes];
  return [...new Set(candidates.flatMap(list).map(norm).filter(entry => entry && !ignored.has(entry)))];
}
function compatibilityTags(effect = {}, power = {}) {
  const type = norm(effect.type ?? effect.kind ?? effect.category), targets = targetMatchers(effect, power);
  if (!type || !targets.length) return [];
  const alreadyCompiled = new Set(["attack_bonus", "hit_bonus", "damage_bonus", "combat_bonus", "attack_damage_bonus", "weapon_magic_bonus", "conditional_attack_bonus", "conditional_damage_bonus", "armor_class_bonus", "armor_bonus", "ac_bonus", "defense_bonus", "protection_bonus", "conditional_armor_bonus", "negate_magic_projectile"]);
  if (alreadyCompiled.has(type)) return [];
  const attackSpecific = (type.includes("attack") || type.includes("attaque") || type.includes("hit") || type.includes("touche")) && (type.includes("multiplier") || type.includes("against") || type.includes("creature") || type.includes("race") || type.endsWith("_vs"));
  const damageSpecific = (type.includes("damage") || type.includes("degat")) && (type.includes("multiplier") || type.includes("against") || type.includes("creature") || type.includes("race") || type.endsWith("_vs"));
  if (!attackSpecific && !damageSpecific) return [];
  const value = firstOptional(effect.bonus, effect.value, effect.amount, effect.attackBonus, effect.hitBonus, effect.damageBonus, effect.bonusToucher, effect.bonusDegats, effect.multiplier, effect.factor, effect.coefficient, power?.parameters?.bonus, power?.parameters?.value, power?.parameters?.amount, power?.parameters?.multiplier, power?.parameters?.factor);
  if (!Number.isFinite(value) || value === 0) return [];
  return targets.flatMap(target => [attackSpecific ? `bonus_touche_vs:${target}:${value}` : "", damageSpecific ? `bonus_degats_vs:${target}:${value}` : ""]).filter(Boolean);
}
function normalizePowerCompatibility(power) {
  if (!power || typeof power !== "object" || !passivePower(power)) return clone(power);
  const effects = effectArray(power);
  if (!effects.length) return clone(power);
  let changed = false;
  const normalizedEffects = effects.map(effect => {
    if (!effect || typeof effect !== "object") return effect;
    const tags = compatibilityTags(effect, power); if (!tags.length) return clone(effect);
    const merged = mergeUnique(effect.tags, effect.effectTags, tags); changed = true;
    return { ...clone(effect), tags: merged, effectTags: merged };
  });
  return changed ? { ...clone(power), effects: normalizedEffects } : clone(power);
}
function normalizedCharges(system = {}) {
  const raw = system.charges; if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  let value = Math.max(0, Math.trunc(number(raw.value ?? raw.current ?? raw.actuel, 0))), max = Math.max(0, Math.trunc(number(raw.max ?? raw.maximum, 0))); if (value > max) max = value; value = Math.min(value, max);
  return { ...clone(raw), value, max, ...(raw.rechargeable === true || raw.recharge === "rechargeable" ? { rechargeable: true, recharge: "rechargeable", rechargeFormula: String(raw.rechargeFormula ?? raw.formula ?? "1d6").trim() || "1d6" } : {}) };
}

function builderModifierValue(source, key) {
  const modifiers = Array.isArray(source?.flags?.add2e?.modifiers) ? source.flags.add2e.modifiers : [];
  const id = ({ attack: "magic-item-builder:attack:bonus", damage: "magic-item-builder:damage:bonus", armor: "magic-item-builder:armor-class:bonus", fixedArmor: "magic-item-builder:armor-class:fixed" })[key];
  const modifier = modifiers.find(entry => entry?.id === id) ?? null;
  if (!modifier) return null;
  if (key === "fixedArmor") return optionalNumber(modifier?.value?.max);
  const value = optionalNumber(modifier.value);
  return key === "armor" && Number.isFinite(value) ? Math.abs(value) : value;
}
function legacyMagicBonusValues(source, enchantment) {
  const system = source?.system ?? {}, type = magicItemType(source), base = enchantment.baseStats ?? {};
  const currentHit = firstOptional(system.bonus_hit, system.bonus_toucher, system.hit_bonus, system.attack_bonus);
  const currentDamage = firstOptional(system.bonus_dom, system.bonus_degats, system.damage_bonus, system.degats_bonus);
  const currentArmor = firstOptional(system.bonus_ac, system.bonus_ca, system.ac_bonus, system.ca_bonus);
  const currentFixed = firstOptional(system.ca_fixe, system.caFixe, system.fixedCA, system.fixed_ac, system.ac_fixe, system.acFixe);
  const attack = firstNonZero(enchantment.bonusToucher, builderModifierValue(source, "attack"), type === "arme" && currentHit !== null ? currentHit - number(base.bonusToucher, 0) : currentHit);
  const damage = firstNonZero(enchantment.bonusDegats, builderModifierValue(source, "damage"), type === "arme" && currentDamage !== null ? currentDamage - number(base.bonusDegats, 0) : currentDamage);
  const armor = firstNonZero(enchantment.bonusCA, builderModifierValue(source, "armor"), currentArmor !== null ? currentArmor - number(base.bonusCA, 0) : null);
  const fixedModifier = builderModifierValue(source, "fixedArmor");
  const fixedArmor = firstOptional(enchantment.caFixe, fixedModifier, currentFixed !== null && currentFixed !== optionalNumber(base.caFixe) ? currentFixed : null);
  return {
    attack: Number.isFinite(attack) && attack !== 0 ? attack : null,
    damage: Number.isFinite(damage) && damage !== 0 ? damage : null,
    armor: Number.isFinite(armor) && armor !== 0 ? Math.abs(armor) : null,
    fixedArmor: Number.isFinite(fixedArmor) ? fixedArmor : null
  };
}
function powerMarkers(power) { return list(power?.canonicalizedEffects).map(value => norm(value).replace(/_/g, "-")).filter(Boolean); }
function generatedEffect(key, value) {
  if (key === "attack") return { type: BONUS_DEFINITIONS.attack.effectType, attackBonus: Number(value) };
  if (key === "damage") return { type: BONUS_DEFINITIONS.damage.effectType, damageBonus: Number(value) };
  if (key === "armor") return { type: BONUS_DEFINITIONS.armor.effectType, bonus: Math.abs(Number(value)) };
  return { type: BONUS_DEFINITIONS.fixedArmor.effectType, value: Number(value) };
}
function generatedPower(key, value) {
  const definition = BONUS_DEFINITIONS[key];
  return {
    schema: 2,
    kind: "catalogue",
    name: definition.name,
    label: definition.name,
    category: definition.category,
    automation: "automatic",
    activation: { type: "passive", trigger: "equipped" },
    parameters: {},
    effects: [generatedEffect(key, value)],
    compatibility: {},
    validation: {},
    source: { section: "Migration canonique ADD2E" }
  };
}
function ensurePowerValue(powers, key, value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return powers;
  const alreadyStored = powers.some(power => {
    const summary = powerBonusSummary(power);
    return key === "fixedArmor" ? Number.isFinite(summary.fixedArmor) : Number(summary[key]) !== 0;
  });
  if (alreadyStored) return powers;
  const marker = BONUS_DEFINITIONS[key].marker;
  const markerIndex = powers.findIndex(power => powerMarkers(power).includes(marker));
  if (markerIndex >= 0) {
    const power = clone(powers[markerIndex]);
    power.effects = [...effectArray(power), generatedEffect(key, value)];
    power.canonicalizedEffects = powerMarkers(power).filter(entry => entry !== marker);
    powers[markerIndex] = power;
    return powers;
  }
  powers.push(generatedPower(key, value));
  return powers;
}
function removeBuilderModifiers(source) {
  const modifiers = Array.isArray(source?.flags?.add2e?.modifiers) ? source.flags.add2e.modifiers : [];
  return modifiers.filter(modifier => !BUILDER_MODIFIER_IDS.has(String(modifier?.id ?? "")) && modifier?.metadata?.producer !== "magic-item-builder");
}
function cleanLegacyMagicTags(system = {}, generatedTags = []) {
  const generated = new Set(list(generatedTags).map(value => String(value ?? "").trim().toLowerCase()).filter(Boolean));
  return list(system.effectTags ?? system.effets ?? system.effects)
    .map(value => String(value ?? "").trim())
    .filter(Boolean)
    .filter(tag => !generated.has(tag.toLowerCase()))
    .filter(tag => !/^(bonus_attaque|bonus_toucher|bonus_degats):[+-]?\d/i.test(tag));
}

function magicItemNormalization(source) {
  if (!itemHasMagicSignals(source)) return null;
  const system = source.system ?? {};
  const enchantment = enchantmentFromSource(source);
  const type = magicItemType(source);
  const base = enchantment.baseStats;
  const legacy = legacyMagicBonusValues(source, enchantment);
  const field = powerField(system);
  let powers = rawPowers(system).map(normalizePowerCompatibility);
  for (const key of ["attack", "damage", "armor", "fixedArmor"]) powers = ensurePowerValue(powers, key, legacy[key]);

  const cleanEnchantment = {
    ...clone(enchantment),
    schema: 2,
    bonusToucher: 0,
    bonusDegats: 0,
    bonusCA: 0,
    caFixe: null,
    baseStats: clone(base)
  };
  const currentBuilder = source?.flags?.add2e?.magicItemBuilder && typeof source.flags.add2e.magicItemBuilder === "object" ? source.flags.add2e.magicItemBuilder : {};
  const patch = {};
  setProperty(patch, "system.enchantement", cleanEnchantment);
  setProperty(patch, `system.${field}`, powers);
  setProperty(patch, "system.magique", true);
  if (type === "arme") {
    setProperty(patch, "system.bonus_hit", number(base.bonusToucher, 0));
    setProperty(patch, "system.bonus_dom", number(base.bonusDegats, 0));
  } else {
    setProperty(patch, "system.bonus_toucher", 0);
    setProperty(patch, "system.bonus_degats", 0);
  }
  setProperty(patch, "system.bonus_ac", number(base.bonusCA, 0));
  setProperty(patch, "system.bonus_ca", number(base.bonusCA, 0));
  setProperty(patch, "system.ca_fixe", optionalNumber(base.caFixe));
  setProperty(patch, "system.caFixe", optionalNumber(base.caFixe));
  setProperty(patch, "system.effectTags", cleanLegacyMagicTags(system, currentBuilder.generatedTags));
  const charges = normalizedCharges(system); if (charges) setProperty(patch, "system.charges", charges);
  setProperty(patch, "flags.add2e.modifiers", removeBuilderModifiers(source));
  setProperty(patch, "flags.add2e.magicItemBuilder", { ...clone(currentBuilder), version: NORMALIZER_VERSION, generatedTags: [], generatedModifiers: [] });
  setProperty(patch, "flags.add2e.magicItemBuilderVersion", NORMALIZER_VERSION);
  return patch;
}
function shouldNormalizeUpdate(change = {}) {
  const prefixes = ["system.enchantement", "system.bonus_hit", "system.bonus_dom", "system.bonus_toucher", "system.bonus_degats", "system.bonus_ac", "system.bonus_ca", "system.ca_fixe", "system.caFixe", "system.charges", "system.magique", "system.magic", ...POWER_FIELDS.map(field => `system.${field}`), "flags.add2e.modifiers", "flags.add2e.magicItemBuilder", "flags.add2e.magicPowerCatalogue"];
  return flattenedPaths(change).some(path => prefixes.some(prefix => path === prefix || path.startsWith(`${prefix}.`)));
}
function normalizeMagicItemCreate(item) {
  const source = clone(item?.toObject?.() ?? item?._source ?? {}); if (!MAGIC_ITEM_TYPES.has(magicItemType(source))) return;
  const patch = magicItemNormalization(source); if (patch && Object.keys(patch).length) item.updateSource(patch);
}
function normalizeMagicItemUpdate(item, change = {}, options = {}) {
  if (options?.add2eMagicItemDataNormalizer === true || !MAGIC_ITEM_TYPES.has(String(item?.type ?? "").toLowerCase()) || !shouldNormalizeUpdate(change)) return;
  const source = clone(item?.toObject?.() ?? item?._source ?? {}), merged = merge(source, expand(change)), patch = magicItemNormalization(merged); if (!patch) return;
  for (const key of Object.keys(change)) if (["system.enchantement.", "system.bonus_hit", "system.bonus_dom", "system.bonus_toucher", "system.bonus_degats", "system.bonus_ac", "system.bonus_ca", "system.ca_fixe", "system.caFixe", "system.effectTags", "system.charges", "system.magique", "flags.add2e.modifiers", "flags.add2e.magicItemBuilder", "flags.add2e.magicItemBuilderVersion"].some(prefix => key === prefix || key.startsWith(prefix))) delete change[key];
  const normalized = merge(expand(change), patch); for (const key of Object.keys(change)) delete change[key]; Object.assign(change, normalized); options.add2eMagicItemDataNormalizer = true;
}
async function migrateCanonicalPowerSources() {
  if (!game.user?.isGM) return;
  const activeGM = game.users?.activeGM ?? Array.from(game.users ?? []).find(user => user.active && user.isGM);
  if (activeGM && String(activeGM.id) !== String(game.user.id)) return;
  const documents = [...Array.from(game.items ?? []), ...Array.from(game.actors ?? []).flatMap(actor => Array.from(actor.items ?? []))];
  for (const item of documents) {
    const source = clone(item?.toObject?.() ?? item?._source ?? {});
    const patch = magicItemNormalization(source);
    if (!patch) continue;
    try { await item.update(patch, { add2eMagicItemDataNormalizer: true, add2eMagicItemBuilder: true, add2eInternal: true, render: false }); }
    catch (error) { console.error("[ADD2E][MAGIC_ITEM][POWER_SOURCE_MIGRATION]", { item: item?.name, itemId: item?.id, error }); }
  }
}
function renderPowerBackedFields(app, html) {
  const item = app?.document ?? app?.item ?? app?.object ?? null;
  if (item?.documentName !== "Item" || !MAGIC_ITEM_TYPES.has(String(item.type ?? "").toLowerCase())) return;
  queueMicrotask(() => {
    const root = html instanceof HTMLElement ? html : html?.[0] instanceof HTMLElement ? html[0] : app?.element?.jquery ? app.element[0] : app?.element;
    if (!root?.querySelectorAll) return;
    const fields = {
      bonusToucher: "attack",
      bonusDegats: "damage",
      bonusCA: "armor",
      caFixe: "fixedArmor"
    };
    for (const [fieldName, key] of Object.entries(fields)) {
      for (const field of root.querySelectorAll(`[name="system.enchantement.${fieldName}"]`)) {
        const value = powerFieldValue(item, key);
        field.value = value === null || value === undefined ? "" : String(value);
        field.setAttribute("value", field.value);
        field.disabled = true;
        field.readOnly = true;
        field.setAttribute("aria-readonly", "true");
        field.title = "Valeur fournie par le pouvoir canonique. Modifiez le pouvoir pour changer ce bonus.";
      }
    }
  });
}

export function add2eRegisterClassItemSheet() {
  const options = { types: ["classe"], makeDefault: true, canConfigure: true, canBeDefault: true, label: "ADD2E | Fiche Classe" }, ItemsCollection = add2eItemsCollection();
  if (ItemsCollection?.registerSheet) ItemsCollection.registerSheet("add2e", Add2eItemSheet, options); else console.warn("[ADD2E][SHEETS] Collection Items introuvable : fiche classe non enregistrée.");
  const DSC = globalThis.DocumentSheetConfig ?? foundry?.applications?.apps?.DocumentSheetConfig, ItemDocument = add2eItemDocumentClass();
  if (DSC?.registerSheet && ItemDocument) { try { DSC.registerSheet(ItemDocument, "add2e", Add2eItemSheet, options); } catch (error) { console.warn("[ADD2E][SHEETS] DocumentSheetConfig classe non appliqué, fallback Items.registerSheet conservé.", error); } }
  console.log("[ADD2E][SHEETS] Fiche Item.classe enregistrée :", Add2eItemSheet?.name);
}
function registerHelper() {
  if (typeof Handlebars === "undefined") return;
  Handlebars.registerHelper("add2eMagicSheetPowers", item => sheetPowers(item));
  Handlebars.registerHelper("add2eMagicPowerFieldValue", (item, key) => powerFieldValue(item, key));
}

globalThis.add2eRegisterClassItemSheet = add2eRegisterClassItemSheet;
globalThis.add2eMagicBuilderEditPower = editPower;
globalThis.add2eMagicBuilderSheetPowers = sheetPowers;
globalThis.add2eMagicPowerFieldValue = powerFieldValue;
globalThis.add2eNormalizeMagicItemData = async itemOrUuid => {
  const item = itemOrUuid?.documentName === "Item" ? itemOrUuid : await resolveItem(itemOrUuid); if (!item) return false;
  const patch = magicItemNormalization(clone(item.toObject?.() ?? item._source ?? {})); if (!patch) return false;
  await item.update(patch, { add2eMagicItemDataNormalizer: true, add2eMagicItemBuilder: true, add2eInternal: true }); return true;
};
globalThis.ADD2E_MAGIC_POWER_SHEET_EDITOR_VERSION = EDITOR_VERSION;
globalThis.ADD2E_MAGIC_ITEM_DATA_NORMALIZER_VERSION = NORMALIZER_VERSION;
registerHelper();

Hooks.on("preCreateActor", (actor, data = {}) => {
  const type = String(actor?.type ?? data?.type ?? "").trim().toLowerCase(), actorLink = defaultActorTokenLink(actor, data); if (actorLink === null) return;
  const prototypeToken = { actorLink }; if (type === "personnage") prototypeToken.sight = { enabled: true, angle: 270, range: defaultCharacterSightRange() }; actor.updateSource({ prototypeToken });
});
Hooks.on("preCreateItem", item => normalizeMagicItemCreate(item));
Hooks.on("preUpdateItem", (item, change, options = {}) => normalizeMagicItemUpdate(item, change, options));
Hooks.on("renderApplicationV2", renderPowerBackedFields);
Hooks.on("renderItemSheet", renderPowerBackedFields);
Hooks.once("init", () => { registerHelper(); console.log("ADD2e | Initialisation du système..."); add2eRegisterClassItemSheet(); });
Hooks.once("ready", () => { migrateCanonicalPowerSources().catch(error => console.error("[ADD2E][MAGIC_ITEM][POWER_SOURCE_MIGRATION_READY]", error)); });
