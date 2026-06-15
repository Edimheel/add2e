// ============================================================
// ADD2E — Restrictions équipement génériques par tags
// Version : 2026-06-10-multiclass-equipment-restrictions-v1
// Source principale : Items "classe" embarqués sur l'acteur.
// Multiclassage AD&D 2e :
// - armes : autorisées si au moins une classe les autorise ;
// - armures/boucliers : la restriction la plus stricte s'applique.
// ============================================================
function add2eDeepClone(value) {
  if (value === undefined || value === null) return value;
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function add2eNormalizeEquipTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_");
}

function add2eToEquipArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(v => add2eToEquipArray(v)).filter(v => v !== null && v !== undefined && String(v).trim() !== "");
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return [];
    return s.split(/[,;\n|]+/).map(x => x.trim()).filter(Boolean);
  }
  if (value && typeof value === "object") {
    for (const key of ["value", "list", "lists", "items", "tags", "effectTags", "allowedTags", "forbiddenTags", "armorAllowed", "armures_autorisees", "weaponsAllowed", "armes_autorisees"]) {
      if (value[key] !== undefined && value[key] !== null) return add2eToEquipArray(value[key]);
    }
  }
  return [];
}

function add2ePushEquipTag(target, rawTag) {
  const tag = add2eNormalizeEquipTag(rawTag);
  if (!tag) return;
  target.add(tag);
  const variants = [
    ["categorie_armure_", "categorie_armure:"], ["type_armure_exact_", "type_armure_exact:"], ["type_armure_", "type_armure:"],
    ["type_arme_", "type_arme:"], ["famille_arme_", "famille_arme:"], ["degat_", "degat:"], ["usage_", "usage:"],
    ["armure_", "armure:"], ["arme_", "arme:"]
  ];
  for (const [prefix, replacement] of variants) if (tag.startsWith(prefix) && tag.length > prefix.length) target.add(replacement + tag.slice(prefix.length));
}

function add2ePushEquipTags(target, raw) { for (const tag of add2eToEquipArray(raw)) add2ePushEquipTag(target, tag); }
function add2eHasUsefulValue(value) { if (value === true || value === false) return true; if (Array.isArray(value)) return value.length > 0; if (typeof value === "string") return value.trim() !== ""; if (value && typeof value === "object") return Object.keys(value).length > 0; return false; }

function add2eGetActorClassItems(actor) { return actor?.items?.filter?.(i => String(i?.type ?? "").toLowerCase() === "classe") ?? []; }
function add2eActorIsMulticlass(actor) { return actor?.system?.multiclasse?.enabled === true || add2eGetActorClassItems(actor).length > 1; }

function add2eGetActorClassItem(actor) {
  const classItems = add2eGetActorClassItems(actor);
  if (!classItems.length) return null;
  const details = actor?.system?.details_classe ?? {};
  const wanted = add2eNormalizeEquipTag(actor?.system?.classe || details.label || details.nom || details.name || details.classe || "");
  if (wanted && !wanted.includes("_")) {
    const found = classItems.find(i => {
      const sys = i.system ?? {};
      const names = [i.name, sys.label, sys.nom, sys.name, sys.classe].map(add2eNormalizeEquipTag).filter(Boolean);
      return names.includes(wanted);
    });
    if (found) return found;
  }
  return classItems[0] ?? null;
}

function add2eClassSystemFromItem(classItem, actor = null) {
  const itemSystem = add2eDeepClone(classItem?.system ?? {}) || {};
  const details = actor && !add2eActorIsMulticlass(actor) ? add2eDeepClone(actor?.system?.details_classe ?? {}) || {} : {};
  const merged = foundry?.utils?.mergeObject ? foundry.utils.mergeObject(details, itemSystem, { inplace: false, recursive: true }) : { ...details, ...itemSystem };
  const ruleFields = ["weaponRestriction", "armorRestriction", "armorAllowed", "armures_autorisees", "weaponsAllowed", "armes_autorisees", "shieldAllowed", "tags"];
  for (const field of ruleFields) if (add2eHasUsefulValue(itemSystem[field])) merged[field] = add2eDeepClone(itemSystem[field]);
  merged.__classItemId = classItem?.id ?? null;
  merged.__classItemName = classItem?.name ?? null;
  return merged;
}

function add2eGetActorClassSystem(actor) { return add2eClassSystemFromItem(add2eGetActorClassItem(actor), actor); }

function add2eGetItemEquipTags(item) {
  const tags = new Set();
  const sys = item?.system ?? {};
  const type = String(item?.type ?? "").toLowerCase();
  add2ePushEquipTags(tags, sys.tags); add2ePushEquipTags(tags, sys.tag); add2ePushEquipTags(tags, sys.effectTags); add2ePushEquipTags(tags, sys.effecttags); add2ePushEquipTags(tags, sys.effets); add2ePushEquipTags(tags, sys.effects); add2ePushEquipTags(tags, item?.flags?.add2e?.tags);
  const nameNorm = add2eNormalizeEquipTag(item?.name ?? sys.nom ?? "");
  const catNorm = add2eNormalizeEquipTag(sys.categorie ?? sys.category ?? "");
  const typeNorm = add2eNormalizeEquipTag(sys.type ?? sys.type_arme ?? sys.type_armure ?? "");
  const familleNorm = add2eNormalizeEquipTag(sys.famille ?? sys.famille_arme ?? "");
  const props = add2eToEquipArray(sys.proprietes ?? sys.properties ?? sys.type_degats ?? sys["type_dégâts"] ?? sys.degats ?? sys["dégâts"]);

  if (type === "arme" || type === "weapon") {
    tags.add("arme");
    if (nameNorm) { tags.add(`arme:${nameNorm}`); tags.add(`type_arme:${nameNorm}`); }
    if (typeNorm) tags.add(`type_arme:${typeNorm}`);
    if (familleNorm) tags.add(`famille_arme:${familleNorm}`);
    for (const p of props) {
      const prop = add2eNormalizeEquipTag(p); if (!prop) continue;
      tags.add(prop); tags.add(`arme:${prop}`);
      if (prop.includes("contondant")) tags.add("degat:contondant");
      if (prop.includes("tranchant")) tags.add("degat:tranchant");
      if (prop.includes("perforant") || prop.includes("pointu")) tags.add("degat:perforant");
      if (prop.includes("distance") || prop.includes("projectile")) tags.add("usage:distance");
      if (prop.includes("lancer") || prop.includes("jet")) tags.add("usage:lancer");
      if (prop.includes("deux_mains") || prop.includes("2_mains")) tags.add("usage:deux_mains");
      if (prop.includes("corps_a_corps") || prop.includes("melee")) tags.add("usage:corps_a_corps");
    }
    const damageText = add2eNormalizeEquipTag(sys.type_degats ?? sys["type_dégâts"] ?? "");
    if (damageText.includes("contondant")) tags.add("degat:contondant");
    if (damageText.includes("tranchant")) tags.add("degat:tranchant");
    if (damageText.includes("perforant") || damageText.includes("pointu")) tags.add("degat:perforant");
    if (sys.deuxMains === true) tags.add("usage:deux_mains");
    if (sys.arme_de_jet === true || sys.portee_courte || sys.portee_moyenne || sys.portee_longue) tags.add("usage:distance");
  }

  if (type === "armure" || type === "armor") {
    tags.add("armure");
    if (nameNorm) { tags.add(`armure:${nameNorm}`); tags.add(`type_armure:${nameNorm}`); }
    if (catNorm) { tags.add(`armure:${catNorm}`); tags.add(`categorie_armure:${catNorm}`); }
    if (typeNorm) tags.add(`type_armure:${typeNorm}`);
    if (nameNorm.includes("bouclier") || catNorm.includes("bouclier")) { tags.add("bouclier"); tags.add("armure:bouclier"); tags.add("categorie_armure:bouclier"); }
    if (nameNorm.includes("heaume") || nameNorm.includes("casque") || catNorm.includes("heaume") || catNorm.includes("casque")) { tags.add("heaume"); tags.add("casque"); }
    for (const p of props) {
      const prop = add2eNormalizeEquipTag(p); if (!prop) continue;
      tags.add(prop); tags.add(`armure:${prop}`);
      if (prop.includes("legere")) tags.add("categorie_armure:legere");
      if (prop.includes("moyenne")) tags.add("categorie_armure:moyenne");
      if (prop.includes("lourde")) tags.add("categorie_armure:lourde");
      if (prop.includes("bouclier")) { tags.add("bouclier"); tags.add("categorie_armure:bouclier"); }
    }
  }
  return [...tags].filter(Boolean);
}

function add2eHasTagRestriction(restriction) { return !!restriction && (add2eToEquipArray(restriction.allowedTags).length > 0 || add2eToEquipArray(restriction.forbiddenTags).length > 0 || String(restriction.mode ?? "").toLowerCase().includes("tag")); }

function add2eCheckItemTagRestriction(item, restriction = {}) {
  const itemTags = add2eGetItemEquipTags(item);
  const itemSet = new Set(itemTags);
  const allowedTags = add2eToEquipArray(restriction.allowedTags).map(add2eNormalizeEquipTag).filter(Boolean);
  const forbiddenTags = add2eToEquipArray(restriction.forbiddenTags).map(add2eNormalizeEquipTag).filter(Boolean);
  const overrideForbiddenTags = [...add2eToEquipArray(restriction.overrideForbiddenTags), ...add2eToEquipArray(restriction.exceptionTags), ...add2eToEquipArray(restriction.alwaysAllowedTags), ...add2eToEquipArray(restriction.allowEvenIfForbiddenTags)].map(add2eNormalizeEquipTag).filter(Boolean);
  const matchedOverride = overrideForbiddenTags.find(t => itemSet.has(t));
  const matchedAllowed = allowedTags.find(t => itemSet.has(t));
  const matchedForbidden = forbiddenTags.find(t => itemSet.has(t));
  if (matchedOverride) return { ok: true, reason: "override-forbidden", matchedForbidden: matchedForbidden ?? null, matchedAllowed: matchedOverride, matchedOverride, itemTags, allowedTags, forbiddenTags, overrideForbiddenTags };
  if (matchedAllowed) return { ok: true, reason: matchedForbidden ? "allowed-despite-forbidden-tag" : "allowed", matchedForbidden: matchedForbidden ?? null, matchedAllowed, matchedOverride: null, itemTags, allowedTags, forbiddenTags, overrideForbiddenTags };
  if (matchedForbidden) return { ok: false, reason: "forbidden", matchedForbidden, matchedAllowed: null, matchedOverride: null, itemTags, allowedTags, forbiddenTags, overrideForbiddenTags };
  if (!allowedTags.length) return { ok: true, reason: "no-allowed-tags", matchedForbidden: null, matchedAllowed: null, matchedOverride: null, itemTags, allowedTags, forbiddenTags, overrideForbiddenTags };
  return { ok: false, reason: "no-match", matchedForbidden: null, matchedAllowed: null, matchedOverride: null, itemTags, allowedTags, forbiddenTags, overrideForbiddenTags };
}

function add2eItemNameNorm(item) { return add2eNormalizeEquipTag(item?.name ?? item?.system?.nom ?? ""); }
function add2eIsShield(item) { const tags = new Set(add2eGetItemEquipTags(item)); const name = add2eItemNameNorm(item); return tags.has("bouclier") || tags.has("categorie_armure:bouclier") || name.includes("bouclier"); }
function add2eIsHelmet(item) { const tags = new Set(add2eGetItemEquipTags(item)); const name = add2eItemNameNorm(item); return tags.has("heaume") || tags.has("casque") || name.includes("heaume") || name.includes("casque"); }

function add2eLegacyAllowsItemByNameOrTag(item, allowedRaw, kind) {
  const allowed = add2eToEquipArray(allowedRaw).map(add2eNormalizeEquipTag).filter(Boolean);
  const itemTags = new Set(add2eGetItemEquipTags(item));
  const itemName = add2eItemNameNorm(item);
  const cat = add2eNormalizeEquipTag(item?.system?.categorie ?? item?.system?.category ?? "");
  if (!allowed.length) return { ok: true, reason: "legacy-empty-allow" };
  if (allowed.includes("toutes") || allowed.includes("toute") || allowed.includes("all")) return { ok: true, reason: "legacy-all" };
  if (allowed.includes("aucune") || allowed.includes("aucun") || allowed.includes("none")) return { ok: false, reason: "legacy-none" };
  const matched = allowed.find(a => itemTags.has(a) || itemTags.has(`${kind}:${a}`) || itemTags.has(`type_${kind}:${a}`) || itemTags.has(`categorie_${kind}:${a}`) || itemTags.has(`categorie_armure:${a}`) || itemTags.has(`type_arme:${a}`) || itemTags.has(`famille_arme:${a}`) || itemName.includes(a) || (cat && cat.includes(a)));
  return matched ? { ok: true, reason: "legacy-match", matchedAllowed: matched } : { ok: false, reason: "legacy-no-match", allowed, itemTags: [...itemTags] };
}

function add2eCheckEquipmentAllowedForClassSystem(classe, item, kind) {
  const classeLabel = classe.label || classe.nom || classe.name || classe.__classItemName || "classe inconnue";
  if (kind === "arme") {
    const restriction = classe.weaponRestriction ?? {};
    if (add2eHasTagRestriction(restriction)) return { ...add2eCheckItemTagRestriction(item, restriction), classe, classeLabel, mode: "weaponRestriction" };
    return { ...add2eLegacyAllowsItemByNameOrTag(item, classe.armes_autorisees ?? classe.weaponsAllowed ?? [], "arme"), classe, classeLabel, mode: "legacy-weapon" };
  }
  if (kind === "armure") {
    const restriction = classe.armorRestriction ?? {};
    if (add2eHasTagRestriction(restriction)) return { ...add2eCheckItemTagRestriction(item, restriction), classe, classeLabel, mode: "armorRestriction" };
    if (add2eIsShield(item)) {
      const shieldAllowed = classe.shieldAllowed === true || add2eToEquipArray(classe.armorAllowed ?? classe.armures_autorisees ?? []).map(add2eNormalizeEquipTag).some(v => ["toutes", "toute", "all", "bouclier", "boucliers"].includes(v));
      return { ok: !!shieldAllowed, reason: shieldAllowed ? "legacy-shield-allowed" : "legacy-shield-forbidden", classe, classeLabel, mode: "legacy-armor" };
    }
    return { ...add2eLegacyAllowsItemByNameOrTag(item, classe.armorAllowed ?? classe.armures_autorisees ?? [], "armure"), classe, classeLabel, mode: "legacy-armor" };
  }
  return { ok: true, reason: "no-kind", classe, classeLabel, mode: "none" };
}

function add2eCheckEquipmentAllowedForClass(actor, item, kind) {
  const classItems = add2eGetActorClassItems(actor);
  if (add2eActorIsMulticlass(actor) && classItems.length > 1) {
    const checks = classItems.map(cls => add2eCheckEquipmentAllowedForClassSystem(add2eClassSystemFromItem(cls, actor), item, kind));
    if (kind === "arme") {
      const allowed = checks.find(c => c.ok);
      return allowed ? { ...allowed, multiclass: true, allChecks: checks, reason: `multiclass-weapon-allowed-by-${allowed.classeLabel}` } : { ...(checks[0] ?? { ok: false, reason: "multiclass-no-class" }), ok: false, multiclass: true, allChecks: checks, reason: "multiclass-weapon-forbidden-all" };
    }
    if (kind === "armure") {
      const denied = checks.find(c => !c.ok);
      return denied ? { ...denied, multiclass: true, allChecks: checks, reason: `multiclass-armor-forbidden-by-${denied.classeLabel}` } : { ...(checks[0] ?? { ok: true, reason: "multiclass-no-class" }), ok: true, multiclass: true, allChecks: checks, reason: "multiclass-armor-allowed-all" };
    }
  }
  return add2eCheckEquipmentAllowedForClassSystem(add2eGetActorClassSystem(actor), item, kind);
}

globalThis.add2eNormalizeEquipTag = add2eNormalizeEquipTag;
globalThis.add2eToEquipArray = add2eToEquipArray;
globalThis.add2eGetActorClassSystem = add2eGetActorClassSystem;
globalThis.add2eGetActorClassItems = add2eGetActorClassItems;
globalThis.add2eGetItemEquipTags = add2eGetItemEquipTags;
globalThis.add2eCheckEquipmentAllowedForClass = add2eCheckEquipmentAllowedForClass;
try { globalThis.add2eDeepClone = add2eDeepClone; } catch (_e) {}
try { globalThis.add2ePushEquipTag = add2ePushEquipTag; } catch (_e) {}
try { globalThis.add2ePushEquipTags = add2ePushEquipTags; } catch (_e) {}
try { globalThis.add2eHasUsefulValue = add2eHasUsefulValue; } catch (_e) {}
try { globalThis.add2eGetActorClassItem = add2eGetActorClassItem; } catch (_e) {}
try { globalThis.add2eHasTagRestriction = add2eHasTagRestriction; } catch (_e) {}
try { globalThis.add2eCheckItemTagRestriction = add2eCheckItemTagRestriction; } catch (_e) {}
try { globalThis.add2eItemNameNorm = add2eItemNameNorm; } catch (_e) {}
try { globalThis.add2eIsShield = add2eIsShield; } catch (_e) {}
try { globalThis.add2eIsHelmet = add2eIsHelmet; } catch (_e) {}
try { globalThis.add2eLegacyAllowsItemByNameOrTag = add2eLegacyAllowsItemByNameOrTag; } catch (_e) {}
try { globalThis.add2eCheckEquipmentAllowedForClassSystem = add2eCheckEquipmentAllowedForClassSystem; } catch (_e) {}