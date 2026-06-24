// ============================================================
// ADD2E — Restrictions équipement génériques par tags harmonisés
// Version : 2026-06-24-thief-activity-equipment-status-v3
// Source principale : Items "classe" embarqués sur l'acteur.
// Schéma conseillé des tags d'équipement :
// - arme / armure / bouclier
// - type_arme:<type> / type_armure:<type> / type_bouclier:<type>
// - slug:<nom_normalise>
// Règle multiclassée AD&D 2e :
// - équipement : autorisé si au moins une classe l'autorise ;
// - activités de voleur : seulement avec armes et armures permises au voleur.
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
    ["type_arme_", "type_arme:"],
    ["famille_arme_", "type_arme:"],
    ["arme_", "type_arme:"],
    ["type_armure_", "type_armure:"],
    ["categorie_armure_", "type_armure:"],
    ["armure_", "type_armure:"],
    ["type_bouclier_", "type_bouclier:"],
    ["slug_", "slug:"]
  ];
  for (const [prefix, replacement] of variants) {
    if (tag.startsWith(prefix) && tag.length > prefix.length) target.add(replacement + tag.slice(prefix.length));
  }

  if (tag.startsWith("arme:")) target.add("type_arme:" + tag.slice(5));
  if (tag.startsWith("famille_arme:")) target.add("type_arme:" + tag.slice(13));
  if (tag.startsWith("armure:")) target.add("type_armure:" + tag.slice(7));
  if (tag.startsWith("categorie_armure:")) target.add("type_armure:" + tag.slice(17));
}

function add2ePushEquipTags(target, raw) {
  for (const tag of add2eToEquipArray(raw)) add2ePushEquipTag(target, tag);
}

function add2eHasUsefulValue(value) {
  if (value === true || value === false) return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

function add2eGetActorClassItems(actor) {
  return actor?.items?.filter?.(i => String(i?.type ?? "").toLowerCase() === "classe") ?? [];
}

function add2eActorIsMulticlass(actor) {
  return actor?.system?.multiclasse?.enabled === true || add2eGetActorClassItems(actor).length > 1;
}

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

function add2eGetActorClassSystem(actor) {
  return add2eClassSystemFromItem(add2eGetActorClassItem(actor), actor);
}

function add2eGetItemEquipTags(item) {
  const tags = new Set();
  const sys = item?.system ?? {};
  const documentType = String(item?.type ?? "").toLowerCase();
  const nameNorm = add2eNormalizeEquipTag(item?.name ?? sys.nom ?? "");

  add2ePushEquipTags(tags, sys.tags);
  add2ePushEquipTags(tags, sys.tag);
  add2ePushEquipTags(tags, sys.effectTags);
  add2ePushEquipTags(tags, sys.effecttags);
  add2ePushEquipTags(tags, sys.effets);
  add2ePushEquipTags(tags, sys.effects);
  add2ePushEquipTags(tags, item?.flags?.add2e?.tags);

  if (documentType === "arme" || documentType === "weapon") {
    tags.add("arme");
    if (nameNorm) tags.add(`slug:${nameNorm}`);
    add2ePushEquipTags(tags, sys.type_arme);
    add2ePushEquipTags(tags, sys.famille_arme);
  }

  if (documentType === "armure" || documentType === "armor") {
    const isShield =
      sys.bouclier === true ||
      tags.has("bouclier") ||
      tags.has("type_armure:bouclier") ||
      tags.has("type_bouclier:tour") ||
      tags.has("type_bouclier:lourd") ||
      tags.has("type_bouclier:rond") ||
      tags.has("type_bouclier:bois") ||
      nameNorm.includes("bouclier") ||
      add2eNormalizeEquipTag(sys.categorie ?? "").includes("bouclier");

    if (isShield) tags.add("bouclier");
    else tags.add("armure");

    if (nameNorm) tags.add(`slug:${nameNorm}`);
    add2ePushEquipTags(tags, sys.type_armure);
    add2ePushEquipTags(tags, sys.type_bouclier);
    add2ePushEquipTags(tags, sys.categorie);
  }

  return [...tags].filter(Boolean);
}

function add2eHasTagRestriction(restriction) {
  return !!restriction && (
    add2eToEquipArray(restriction.allowedTags).length > 0 ||
    add2eToEquipArray(restriction.forbiddenTags).length > 0 ||
    String(restriction.mode ?? "").toLowerCase().includes("tag")
  );
}

function add2eCheckItemTagRestriction(item, restriction = {}) {
  const itemTags = add2eGetItemEquipTags(item);
  const itemSet = new Set(itemTags);
  const allowedTags = add2eToEquipArray(restriction.allowedTags).map(add2eNormalizeEquipTag).filter(Boolean);
  const forbiddenTags = add2eToEquipArray(restriction.forbiddenTags).map(add2eNormalizeEquipTag).filter(Boolean);
  const overrideForbiddenTags = [
    ...add2eToEquipArray(restriction.overrideForbiddenTags),
    ...add2eToEquipArray(restriction.exceptionTags),
    ...add2eToEquipArray(restriction.alwaysAllowedTags),
    ...add2eToEquipArray(restriction.allowEvenIfForbiddenTags)
  ].map(add2eNormalizeEquipTag).filter(Boolean);

  const matchedOverride = overrideForbiddenTags.find(t => itemSet.has(t));
  const matchedAllowed = allowedTags.find(t => itemSet.has(t));
  const matchedForbidden = forbiddenTags.find(t => itemSet.has(t));

  if (matchedOverride) return { ok: true, reason: "override-forbidden", matchedForbidden: matchedForbidden ?? null, matchedAllowed: matchedOverride, matchedOverride, itemTags, allowedTags, forbiddenTags, overrideForbiddenTags };
  if (matchedAllowed) return { ok: true, reason: matchedForbidden ? "allowed-despite-forbidden-tag" : "allowed", matchedForbidden: matchedForbidden ?? null, matchedAllowed, matchedOverride: null, itemTags, allowedTags, forbiddenTags, overrideForbiddenTags };
  if (matchedForbidden) return { ok: false, reason: "forbidden", matchedForbidden, matchedAllowed: null, matchedOverride: null, itemTags, allowedTags, forbiddenTags, overrideForbiddenTags };
  if (!allowedTags.length) return { ok: false, reason: "empty-allow-list", matchedForbidden: null, matchedAllowed: null, matchedOverride: null, itemTags, allowedTags, forbiddenTags, overrideForbiddenTags };
  return { ok: false, reason: "no-match", matchedForbidden: null, matchedAllowed: null, matchedOverride: null, itemTags, allowedTags, forbiddenTags, overrideForbiddenTags };
}

function add2eItemNameNorm(item) {
  return add2eNormalizeEquipTag(item?.name ?? item?.system?.nom ?? "");
}

function add2eIsShield(item) {
  const tags = new Set(add2eGetItemEquipTags(item));
  const name = add2eItemNameNorm(item);
  return tags.has("bouclier") || tags.has("type_armure:bouclier") || name.includes("bouclier");
}

function add2eIsHelmet(item) {
  const tags = new Set(add2eGetItemEquipTags(item));
  const name = add2eItemNameNorm(item);
  return tags.has("heaume") || tags.has("casque") || name.includes("heaume") || name.includes("casque");
}

function add2eLegacyAllowsItemByNameOrTag(item, allowedRaw, kind) {
  const allowed = add2eToEquipArray(allowedRaw).map(add2eNormalizeEquipTag).filter(Boolean);
  const itemTags = new Set(add2eGetItemEquipTags(item));
  const itemName = add2eItemNameNorm(item);

  if (!allowed.length) return { ok: false, reason: "legacy-empty-allow" };
  if (allowed.includes("toutes") || allowed.includes("toute") || allowed.includes("all")) return { ok: true, reason: "legacy-all" };
  if (allowed.includes("aucune") || allowed.includes("aucun") || allowed.includes("none")) return { ok: false, reason: "legacy-none" };

  const matched = allowed.find(a =>
    itemTags.has(a) ||
    itemTags.has(`${kind}:${a}`) ||
    itemTags.has(`type_${kind}:${a}`) ||
    itemTags.has(`type_arme:${a}`) ||
    itemTags.has(`type_armure:${a}`) ||
    itemTags.has(`type_bouclier:${a}`) ||
    itemTags.has(`slug:${a}`) ||
    itemName === a
  );
  return matched ? { ok: true, reason: "legacy-match", matchedAllowed: matched } : { ok: false, reason: "legacy-no-match", allowed, itemTags: [...itemTags] };
}

function add2eCheckEquipmentAllowedForClassSystem(classe, item, kind) {
  const classeLabel = classe?.label || classe?.nom || classe?.name || classe?.__classItemName || "classe inconnue";
  if (kind === "arme") {
    const restriction = classe?.weaponRestriction ?? {};
    if (add2eHasTagRestriction(restriction)) return { ...add2eCheckItemTagRestriction(item, restriction), classe, classeLabel, mode: "weaponRestriction" };
    return { ...add2eLegacyAllowsItemByNameOrTag(item, classe?.armes_autorisees ?? classe?.weaponsAllowed ?? [], "arme"), classe, classeLabel, mode: "legacy-weapon" };
  }
  if (kind === "armure") {
    const restriction = classe?.armorRestriction ?? {};
    if (add2eHasTagRestriction(restriction)) return { ...add2eCheckItemTagRestriction(item, restriction), classe, classeLabel, mode: "armorRestriction" };
    if (add2eIsShield(item)) {
      const shieldAllowed = classe?.shieldAllowed === true || add2eToEquipArray(classe?.armorAllowed ?? classe?.armures_autorisees ?? []).map(add2eNormalizeEquipTag).some(v => ["toutes", "toute", "all", "bouclier", "boucliers"].includes(v));
      return { ok: !!shieldAllowed, reason: shieldAllowed ? "legacy-shield-allowed" : "legacy-shield-forbidden", classe, classeLabel, mode: "legacy-armor" };
    }
    return { ...add2eLegacyAllowsItemByNameOrTag(item, classe?.armorAllowed ?? classe?.armures_autorisees ?? [], "armure"), classe, classeLabel, mode: "legacy-armor" };
  }
  return { ok: true, reason: "no-kind", classe, classeLabel, mode: "none" };
}

function add2eCheckEquipmentAllowedForClass(actor, item, kind) {
  const classItems = add2eGetActorClassItems(actor);
  if (add2eActorIsMulticlass(actor) && classItems.length > 1) {
    const checks = classItems.map(cls => add2eCheckEquipmentAllowedForClassSystem(add2eClassSystemFromItem(cls, actor), item, kind));
    const allowed = checks.find(c => c.ok);
    return allowed
      ? { ...allowed, multiclass: true, allChecks: checks, reason: `multiclass-${kind}-allowed-by-${allowed.classeLabel}` }
      : { ...(checks[0] ?? { ok: false, reason: "multiclass-no-class" }), ok: false, multiclass: true, allChecks: checks, reason: `multiclass-${kind}-forbidden-all` };
  }
  return add2eCheckEquipmentAllowedForClassSystem(add2eGetActorClassSystem(actor), item, kind);
}

function add2eFindActorClassSystemByName(actor, className) {
  const wanted = add2eNormalizeEquipTag(className);
  const classItems = add2eGetActorClassItems(actor);
  const item = classItems.find(cls => {
    const sys = cls.system ?? {};
    return [cls.name, sys.label, sys.nom, sys.name, sys.classe].map(add2eNormalizeEquipTag).includes(wanted);
  });
  return item ? add2eClassSystemFromItem(item, actor) : null;
}

function add2eCheckEquippedItemsForClassActivity(actor, className) {
  const classe = add2eFindActorClassSystemByName(actor, className);
  if (!classe) return { ok: true, reason: "class-not-present", className, failures: [] };
  const failures = [];
  for (const item of actor?.items ?? []) {
    if (!item?.system?.equipee) continue;
    const type = String(item.type ?? "").toLowerCase();
    if (type !== "arme" && type !== "armure") continue;
    const kind = type === "arme" ? "arme" : "armure";
    const check = add2eCheckEquipmentAllowedForClassSystem(classe, item, kind);
    if (!check.ok) failures.push({ itemId: item.id, itemName: item.name, kind, check });
  }
  return failures.length ? { ok: false, reason: "equipped-items-not-allowed-for-class-activity", className, failures } : { ok: true, reason: "equipped-items-allowed-for-class-activity", className, failures: [] };
}

function add2eCheckThiefActivityEquipmentAllowed(actor) {
  return add2eCheckEquippedItemsForClassActivity(actor, "Voleur");
}

function add2eGetThiefActivityEquipmentStatus(actor) {
  const thiefClass = add2eFindActorClassSystemByName(actor, "Voleur");
  if (!thiefClass) {
    return {
      applies: false,
      ok: true,
      reason: "thief-class-not-present",
      className: "Voleur",
      failures: [],
      blockingItems: [],
      message: ""
    };
  }

  const check = add2eCheckThiefActivityEquipmentAllowed(actor);
  const failures = Array.isArray(check?.failures) ? check.failures : [];
  const blockingItems = failures.map(failure => ({
    id: failure.itemId ?? null,
    name: String(failure.itemName ?? "Équipement inconnu"),
    kind: failure.kind ?? null,
    reason: failure.check?.reason ?? null
  }));
  const listed = blockingItems.map(item => item.name).filter(Boolean).join(", ");

  return {
    applies: true,
    ok: check?.ok !== false,
    reason: check?.reason ?? "equipped-items-allowed-for-class-activity",
    className: "Voleur",
    failures,
    blockingItems,
    message: check?.ok === false
      ? `Les capacités de voleur sont indisponibles tant que l'équipement incompatible est porté${listed ? ` : ${listed}.` : "."}`
      : ""
  };
}

function add2eThiefClassLevel(actor, thiefClass) {
  const rawKey = thiefClass?.slug ?? thiefClass?.label ?? thiefClass?.nom ?? thiefClass?.name ?? thiefClass?.__classItemName ?? "Voleur";
  const key = add2eNormalizeEquipTag(rawKey);
  const levels = actor?.system?.niveaux_par_classe ?? {};
  if (key && levels[key] !== undefined) return Math.max(1, Number(levels[key]) || 1);
  return Math.max(1, Number(actor?.system?.niveau ?? 1) || 1);
}

function add2eThiefActivityRollContext(actor) {
  const thiefClass = add2eFindActorClassSystemByName(actor, "Voleur");
  if (!thiefClass || !actor) return actor;

  const system = {
    ...(actor.system ?? {}),
    classe: thiefClass.__classItemName ?? thiefClass.label ?? thiefClass.nom ?? thiefClass.name ?? "Voleur",
    details_classe: thiefClass,
    niveau: add2eThiefClassLevel(actor, thiefClass)
  };

  return new Proxy(actor, {
    get(target, property) {
      if (property === "system") return system;
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

function add2eInstallThiefActivityRollGuard() {
  if (globalThis.__ADD2E_THIEF_ACTIVITY_ROLL_GUARD_V1) return;
  globalThis.__ADD2E_THIEF_ACTIVITY_ROLL_GUARD_V1 = true;

  const install = () => {
    const original = globalThis.add2eRollThiefSkill;
    if (typeof original !== "function" || original.__add2eThiefActivityGuard) return;

    const guarded = async function add2eRollThiefSkillWithEquipmentGuard(actor, ...args) {
      const status = add2eGetThiefActivityEquipmentStatus(actor);
      if (status.applies && !status.ok) {
        ui.notifications?.warn?.(status.message || "Les capacités de voleur sont indisponibles avec l'équipement actuellement porté.");
        return false;
      }
      return original.call(this, add2eThiefActivityRollContext(actor), ...args);
    };
    guarded.__add2eThiefActivityGuard = true;
    guarded.__add2eThiefActivityOriginal = original;
    globalThis.add2eRollThiefSkill = guarded;
  };

  if (game?.ready) queueMicrotask(install);
  else Hooks.once("ready", install);
}

add2eInstallThiefActivityRollGuard();

globalThis.add2eNormalizeEquipTag = add2eNormalizeEquipTag;
globalThis.add2eToEquipArray = add2eToEquipArray;
globalThis.add2eGetActorClassSystem = add2eGetActorClassSystem;
globalThis.add2eGetActorClassItems = add2eGetActorClassItems;
globalThis.add2eGetItemEquipTags = add2eGetItemEquipTags;
globalThis.add2eCheckEquipmentAllowedForClass = add2eCheckEquipmentAllowedForClass;
globalThis.add2eCheckEquippedItemsForClassActivity = add2eCheckEquippedItemsForClassActivity;
globalThis.add2eCheckThiefActivityEquipmentAllowed = add2eCheckThiefActivityEquipmentAllowed;
globalThis.add2eGetThiefActivityEquipmentStatus = add2eGetThiefActivityEquipmentStatus;
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
try { globalThis.add2eFindActorClassSystemByName = add2eFindActorClassSystemByName; } catch (_e) {}
try { globalThis.add2eThiefClassLevel = add2eThiefClassLevel; } catch (_e) {}
try { globalThis.add2eThiefActivityRollContext = add2eThiefActivityRollContext; } catch (_e) {}