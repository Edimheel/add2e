// ============================================================
// ADD2E — Restrictions équipement génériques par tags canoniques
// Version : 2026-08-10-canonical-equipment-restrictions-v12-reconcile-all
// Source principale : Items "classe" embarqués sur l'acteur.
// Schéma canonique des tags d'équipement :
// - arme / armure / bouclier
// - type_arme:<type> / type_armure:<type> / type_bouclier:<type>
// Règle multiclassée AD&D 2e :
// - équipement : autorisé si au moins une classe l'autorise ;
// - activités de voleur : test indépendant sur l'armure de corps équipée
//   et le tag exact type_armure:cuir.
// Les acteurs monster ne sont pas soumis aux restrictions de classe.
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

function add2eEquipmentEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine
    || typeof engine.isShieldItem !== "function"
    || typeof engine.isHelmetItem !== "function"
    || typeof engine.itemEquipped !== "function") {
    throw new Error("Le profil canonique d’équipement ADD2E n’est pas installé.");
  }
  return engine;
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
    for (const key of ["value", "list", "lists", "items", "tags", "effectTags", "allowedTags", "forbiddenTags"]) {
      if (value[key] !== undefined && value[key] !== null) return add2eToEquipArray(value[key]);
    }
  }
  return [];
}

function add2ePushEquipTag(target, rawTag) {
  const tag = add2eNormalizeEquipTag(rawTag);
  if (tag) target.add(tag);
}

function add2ePushEquipTags(target, raw) {
  for (const tag of add2eToEquipArray(raw)) add2ePushEquipTag(target, tag);
}

function add2eGetActorClassItems(actor) {
  return actor?.items?.filter?.(i => String(i?.type ?? "").toLowerCase() === "classe") ?? [];
}

function add2eActorIsMulticlass(actor) {
  return add2eGetActorClassItems(actor).length > 1;
}

function add2eActorBypassesClassEquipmentRestrictions(actor) {
  return String(actor?.type ?? "").toLowerCase() === "monster";
}

function add2eGetActorClassItem(actor) {
  const classItems = add2eGetActorClassItems(actor);
  return classItems.length === 1 ? classItems[0] : null;
}

function add2eClassSystemFromItem(classItem) {
  const itemSystem = add2eDeepClone(classItem?.system ?? {}) || {};
  itemSystem.__classItemId = classItem?.id ?? null;
  itemSystem.__classItemName = classItem?.name ?? null;
  return itemSystem;
}

function add2eGetActorClassSystem(actor) {
  return add2eClassSystemFromItem(add2eGetActorClassItem(actor));
}

function add2eIsShield(item) {
  return add2eEquipmentEngine().isShieldItem(item) === true;
}

function add2eIsHelmet(item) {
  return add2eEquipmentEngine().isHelmetItem(item) === true;
}

function add2eGetItemEquipTags(item) {
  const tags = new Set();
  const sys = item?.system ?? {};
  const documentType = String(item?.type ?? "").toLowerCase();

  add2ePushEquipTags(tags, sys.tags);
  add2ePushEquipTags(tags, item?.flags?.add2e?.tags);

  if (documentType === "arme" || documentType === "weapon") {
    tags.add("arme");
    const weaponType = add2eNormalizeEquipTag(sys.type_arme);
    if (weaponType) tags.add(`type_arme:${weaponType}`);
    for (const rawFamily of add2eToEquipArray(sys.famille_arme)) {
      const weaponFamily = add2eNormalizeEquipTag(rawFamily);
      if (weaponFamily) tags.add(`type_arme:${weaponFamily}`);
    }
  }

  if (documentType === "armure" || documentType === "armor") {
    if (add2eIsShield(item)) tags.add("bouclier");
    else if (add2eIsHelmet(item)) tags.add("casque");
    else tags.add("armure");

    const armorType = add2eNormalizeEquipTag(sys.type_armure);
    const shieldType = add2eNormalizeEquipTag(sys.type_bouclier);
    const category = add2eNormalizeEquipTag(sys.categorie);
    const structure = add2eNormalizeEquipTag(sys.structure);
    if (armorType) tags.add(`type_armure:${armorType}`);
    if (shieldType) tags.add(`type_bouclier:${shieldType}`);
    if (category) tags.add(`categorie_armure:${category}`);
    if (structure) tags.add(`structure:${structure}`);
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

function add2eCheckEquipmentAllowedForClassSystem(classe, item, kind) {
  const classeLabel = classe?.label || classe?.nom || classe?.name || classe?.__classItemName || "classe inconnue";
  if (kind === "arme") {
    const restriction = classe?.weaponRestriction ?? null;
    if (!add2eHasTagRestriction(restriction)) {
      throw new Error(`${classeLabel} : weaponRestriction canonique absente ou invalide.`);
    }
    return { ...add2eCheckItemTagRestriction(item, restriction), classe, classeLabel, mode: "weaponRestriction" };
  }
  if (kind === "armure") {
    const restriction = classe?.armorRestriction ?? null;
    if (!add2eHasTagRestriction(restriction)) {
      throw new Error(`${classeLabel} : armorRestriction canonique absente ou invalide.`);
    }
    return { ...add2eCheckItemTagRestriction(item, restriction), classe, classeLabel, mode: "armorRestriction" };
  }
  return { ok: true, reason: "no-kind", classe, classeLabel, mode: "none" };
}

function add2eCheckEquipmentAllowedForClass(actor, item, kind) {
  if (add2eActorBypassesClassEquipmentRestrictions(actor)) {
    return { ok: true, reason: "monster-unrestricted", actorType: "monster", kind, classe: null, classeLabel: null, mode: "monster-bypass" };
  }

  const classItems = add2eGetActorClassItems(actor);
  if (add2eActorIsMulticlass(actor)) {
    const checks = classItems.map(cls => add2eCheckEquipmentAllowedForClassSystem(add2eClassSystemFromItem(cls), item, kind));
    const allowed = checks.find(c => c.ok);
    return allowed
      ? { ...allowed, multiclass: true, allChecks: checks, reason: `multiclass-${kind}-allowed-by-${allowed.classeLabel}` }
      : { ...(checks[0] ?? { ok: false, reason: "multiclass-no-class" }), ok: false, multiclass: true, allChecks: checks, reason: `multiclass-${kind}-forbidden-all` };
  }
  return add2eCheckEquipmentAllowedForClassSystem(add2eGetActorClassSystem(actor), item, kind);
}

function add2eIsWeaponItem(item) {
  return ["arme", "weapon"].includes(String(item?.type ?? "").toLowerCase());
}

function add2eIsArmorItem(item) {
  return ["armure", "armor"].includes(String(item?.type ?? "").toLowerCase());
}

function add2eEquipmentRestrictionKind(item) {
  if (add2eIsWeaponItem(item)) return "arme";
  if (add2eIsArmorItem(item)) return "armure";
  return "";
}

function add2eGetForbiddenEquippedItems(actor) {
  if (add2eActorBypassesClassEquipmentRestrictions(actor)) return [];
  if (!add2eGetActorClassItems(actor).length) return [];

  const engine = add2eEquipmentEngine();
  const failures = [];
  for (const item of actor?.items ?? []) {
    const kind = add2eEquipmentRestrictionKind(item);
    if (!kind || engine.itemEquipped(item) !== true) continue;
    const check = add2eCheckEquipmentAllowedForClass(actor, item, kind);
    if (!check.ok) failures.push({ item, kind, check });
  }
  return failures;
}

async function add2eReconcileEquippedItemsForClass(actor) {
  if (!actor?.items || !actor?.updateEmbeddedDocuments) return { updated: [], failures: [] };

  const failures = add2eGetForbiddenEquippedItems(actor);
  const updates = failures
    .map(({ item }) => item?.id ? { _id: item.id, "system.equipee": false } : null)
    .filter(Boolean);

  if (updates.length) {
    await actor.updateEmbeddedDocuments("Item", updates, {
      add2eInternal: true,
      add2eReason: "class-equipment-reconcile"
    });
  }
  return { updated: updates.map(update => update._id), failures };
}

function add2eGetPendingEquippedState(changes) {
  if (!changes || typeof changes !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(changes, "system.equipee")) return changes["system.equipee"];
  if (changes.system && Object.prototype.hasOwnProperty.call(changes.system, "equipee")) return changes.system.equipee;
  return undefined;
}

function add2eInstallClassEquipmentGuard() {
  if (globalThis.__ADD2E_CLASS_EQUIPMENT_GUARD_V2) return;
  globalThis.__ADD2E_CLASS_EQUIPMENT_GUARD_V2 = true;

  const queuedActors = new Set();
  const schedule = actor => {
    if (!actor?.id || queuedActors.has(actor.id)) return;
    queuedActors.add(actor.id);
    queueMicrotask(async () => {
      try {
        await add2eReconcileEquippedItemsForClass(actor);
      } finally {
        queuedActors.delete(actor.id);
      }
    });
  };

  Hooks.on("preUpdateItem", (item, changes) => {
    if (add2eGetPendingEquippedState(changes) !== true) return;

    const kind = add2eEquipmentRestrictionKind(item);
    if (!kind) return;

    const actor = item.parent;
    if (!actor || add2eActorBypassesClassEquipmentRestrictions(actor) || !add2eGetActorClassItems(actor).length) return;
    const check = add2eCheckEquipmentAllowedForClass(actor, item, kind);
    if (check.ok) return;

    const classLabel = check.multiclass
      ? add2eGetActorClassItems(actor).map(cls => cls.name).filter(Boolean).join(" / ")
      : check.classeLabel;
    const equipmentLabel = kind === "arme" ? "arme" : (add2eIsShield(item) ? "bouclier" : (add2eIsHelmet(item) ? "casque" : "armure"));
    ui.notifications?.warn?.(`Cet équipement (« ${item.name} », ${equipmentLabel}) est interdit pour ${classLabel || "la classe de cet acteur"}.`);
    return false;
  });

  const scheduleForRelatedItem = item => {
    const type = String(item?.type ?? "").toLowerCase();
    if (type === "classe" || add2eEquipmentRestrictionKind(item)) schedule(item?.parent);
  };

  Hooks.on("createItem", scheduleForRelatedItem);
  Hooks.on("updateItem", scheduleForRelatedItem);
  Hooks.on("deleteItem", scheduleForRelatedItem);

  const reconcileAllActors = () => {
    for (const actor of game?.actors?.contents ?? []) schedule(actor);
  };

  if (game?.ready) reconcileAllActors();
  else Hooks.once("ready", reconcileAllActors);
}

function add2eIsThiefActivityClassItem(item) {
  if (String(item?.type ?? "").toLowerCase() !== "classe") return false;
  const system = item?.system ?? {};
  if (system.thiefSkillMechanic?.enabled === true || system.assassinSkillMechanic?.enabled === true) return true;
  const progression = Array.isArray(system.progression) ? system.progression : [];
  return progression.some(row => row?.thiefSkills && typeof row.thiefSkills === "object" && !Array.isArray(row.thiefSkills));
}

function add2eThiefActivityClassItems(actor) {
  return add2eGetActorClassItems(actor).filter(add2eIsThiefActivityClassItem);
}

function add2eIsThiefActivityBodyArmor(item) {
  if (!add2eEquipmentEngine().itemEquipped(item)) return false;
  if (!["armure", "armor"].includes(String(item?.type ?? "").toLowerCase())) return false;
  return !add2eIsShield(item) && !add2eIsHelmet(item);
}

function add2eCheckThiefActivityEquipmentAllowed(actor) {
  const classItems = add2eThiefActivityClassItems(actor);
  const className = classItems.map(item => item.name).filter(Boolean).join(" / ") || "Compétence de voleur";
  if (!classItems.length) return { ok: true, reason: "thief-activity-class-not-present", className, failures: [] };

  const classe = add2eClassSystemFromItem(classItems[0]);
  const failures = [];
  for (const item of actor?.items ?? []) {
    if (!add2eIsThiefActivityBodyArmor(item)) continue;

    const itemTags = add2eGetItemEquipTags(item);
    if (itemTags.includes("type_armure:cuir")) continue;

    failures.push({
      itemId: item.id,
      itemName: item.name,
      kind: "armure",
      check: {
        ok: false,
        reason: "thief-activity-body-armor-not-leather",
        classe,
        classeLabel: className,
        itemTags,
        requiredTag: "type_armure:cuir",
        mode: "thief-body-armor-tag"
      }
    });
  }

  return failures.length
    ? { ok: false, reason: "equipped-body-armor-without-thief-leather-tag", className, failures }
    : { ok: true, reason: "no-equipped-body-armor-or-exact-leather-tag", className, failures: [] };
}

function add2eGetThiefActivityEquipmentStatus(actor) {
  const classItems = add2eThiefActivityClassItems(actor);
  const className = classItems.map(item => item.name).filter(Boolean).join(" / ") || "Compétence de voleur";
  if (!classItems.length) {
    return {
      applies: false,
      ok: true,
      reason: "thief-activity-class-not-present",
      className,
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
    reason: check?.reason ?? "equipped-items-allowed-for-thief-activity",
    className,
    failures,
    blockingItems,
    message: check?.ok === false
      ? `Les capacités de voleur sont indisponibles tant que l'équipement incompatible est porté${listed ? ` : ${listed}.` : "."}`
      : ""
  };
}

add2eInstallClassEquipmentGuard();

globalThis.add2eNormalizeEquipTag = add2eNormalizeEquipTag;
globalThis.add2eToEquipArray = add2eToEquipArray;
globalThis.add2eGetActorClassSystem = add2eGetActorClassSystem;
globalThis.add2eGetActorClassItems = add2eGetActorClassItems;
globalThis.add2eGetItemEquipTags = add2eGetItemEquipTags;
globalThis.add2eCheckEquipmentAllowedForClass = add2eCheckEquipmentAllowedForClass;
globalThis.add2eCheckThiefActivityEquipmentAllowed = add2eCheckThiefActivityEquipmentAllowed;
globalThis.add2eGetThiefActivityEquipmentStatus = add2eGetThiefActivityEquipmentStatus;
try { globalThis.add2eDeepClone = add2eDeepClone; } catch (_e) {}
try { globalThis.add2ePushEquipTag = add2ePushEquipTag; } catch (_e) {}
try { globalThis.add2ePushEquipTags = add2ePushEquipTags; } catch (_e) {}
try { globalThis.add2eGetActorClassItem = add2eGetActorClassItem; } catch (_e) {}
try { globalThis.add2eHasTagRestriction = add2eHasTagRestriction; } catch (_e) {}
try { globalThis.add2eCheckItemTagRestriction = add2eCheckItemTagRestriction; } catch (_e) {}
try { globalThis.add2eIsShield = add2eIsShield; } catch (_e) {}
try { globalThis.add2eIsHelmet = add2eIsHelmet; } catch (_e) {}
try { globalThis.add2eCheckEquipmentAllowedForClassSystem = add2eCheckEquipmentAllowedForClassSystem; } catch (_e) {}
try { globalThis.add2eIsWeaponItem = add2eIsWeaponItem; } catch (_e) {}
try { globalThis.add2eIsArmorItem = add2eIsArmorItem; } catch (_e) {}
try { globalThis.add2eEquipmentRestrictionKind = add2eEquipmentRestrictionKind; } catch (_e) {}
try { globalThis.add2eGetForbiddenEquippedItems = add2eGetForbiddenEquippedItems; } catch (_e) {}
try { globalThis.add2eReconcileEquippedItemsForClass = add2eReconcileEquippedItemsForClass; } catch (_e) {}
