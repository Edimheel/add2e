// ============================================================
// ADD2E — Actions d'équipement et profils d'armes
// Compatible Foundry V13/V14/V15.
// Les restrictions de classe restent dans 03-equipment-rules.mjs.
// ============================================================

const ADD2E_EQUIPMENT_ACTIONS_VERSION = "2026-06-24-equipment-actions-attack-window-v3";
const ADD2E_WEAPON_TYPES = new Set(["arme", "weapon"]);
const ADD2E_ARMOR_TYPES = new Set(["armure", "armor"]);

function add2eEquipmentNormalize(value) {
  if (typeof globalThis.add2eNormalizeEquipTag === "function") return globalThis.add2eNormalizeEquipTag(value);
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

function add2eEquipmentArray(value) {
  if (Array.isArray(value)) return value.flatMap(add2eEquipmentArray).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(part => part.trim()).filter(Boolean);
  return value === null || value === undefined || value === "" ? [] : [value];
}

function add2eEquipmentTags(item) {
  const fromRules = globalThis.add2eGetItemEquipTags?.(item);
  if (Array.isArray(fromRules)) return new Set(fromRules.map(add2eEquipmentNormalize).filter(Boolean));

  const system = item?.system ?? {};
  return new Set([
    ...add2eEquipmentArray(system.tags),
    ...add2eEquipmentArray(system.effectTags),
    ...add2eEquipmentArray(item?.flags?.add2e?.tags)
  ].map(add2eEquipmentNormalize).filter(Boolean));
}

function add2eEquipmentHasRange(weapon) {
  const system = weapon?.system ?? {};
  return [
    system.portee_courte,
    system.portee_moyenne,
    system.portee_longue,
    system.porteeCourte,
    system.porteeMoyenne,
    system.porteeLongue
  ].some(value => Number(value) > 0);
}

/**
 * Source unique de classification métier des armes.
 * - projectile propulsé : carquois ;
 * - arme lancée : l'arme elle-même ;
 * - arme hybride : contact ou lancer ;
 * - arme de contact : jamais de carquois.
 */
export function add2eGetWeaponUsageProfile(weapon) {
  const system = weapon?.system ?? {};
  const tags = add2eEquipmentTags(weapon);
  const category = add2eEquipmentNormalize(system.categorie ?? system.category ?? "");
  const has = (...values) => values.some(value => tags.has(add2eEquipmentNormalize(value)));
  const hasRange = add2eEquipmentHasRange(weapon);

  const isProjectilePropulse = category === "projectile_propulse" || has(
    "projectile_propulse",
    "usage:projectile_propulse",
    "categorie:projectile_propulse",
    "trait:projectile_propulse",
    "type:projectile_propulse",
    "arme:projectile_propulse"
  );

  const isThrown = !isProjectilePropulse && (
    system.arme_de_jet === true ||
    system.armeDeJet === true ||
    system.isThrown === true ||
    category === "projectile_lance" ||
    has(
      "projectile_lance",
      "usage:lancer",
      "usage:jet",
      "usage:arme_de_jet",
      "categorie:projectile_lance",
      "trait:arme_de_jet",
      "type:arme_de_jet"
    )
  );

  const isContact = system.arme_de_contact === true ||
    system.armeDeContact === true ||
    system.isMelee === true ||
    system.corps_a_corps === true ||
    category === "melee" ||
    category === "contact" ||
    category === "corps_a_corps" ||
    has(
      "melee",
      "contact",
      "corps_a_corps",
      "usage:contact",
      "usage:corps_a_corps",
      "categorie:melee",
      "categorie:contact",
      "categorie:corps_a_corps",
      "type:melee",
      "type:contact",
      "type:corps_a_corps"
    ) || (!isProjectilePropulse && !isThrown && !hasRange);

  const isHybrid = isThrown && isContact;
  return {
    category,
    tags: [...tags],
    hasRange,
    isProjectilePropulse,
    isThrown,
    isContact,
    isHybrid,
    requiresEquippedProjectile: hasRange && !isThrown && !isContact,
    slot: isContact ? "contact" : "distance"
  };
}

/**
 * Compatibilité avec les contrôles historiques du carquois.
 * La normalisation est réalisée à l'équipement, sans migration d'acteurs au démarrage.
 */
function add2eCanonicalWeaponUsageTags(item) {
  const profile = add2eGetWeaponUsageProfile(item);
  if (!profile.isThrown) return null;

  const current = add2eEquipmentArray(item?.system?.tags);
  const normalized = new Set(current.map(add2eEquipmentNormalize));
  const required = ["usage:lancer"];
  if (profile.isHybrid) required.push("usage:contact");

  let changed = false;
  for (const tag of required) {
    if (normalized.has(tag)) continue;
    current.push(tag);
    normalized.add(tag);
    changed = true;
  }
  return changed ? current : null;
}

function add2eEquipmentChangesEquipped(changes = {}) {
  return changes["system.equipee"] !== undefined ||
    changes["system.equipped"] !== undefined ||
    changes?.system?.equipee !== undefined ||
    changes?.system?.equipped !== undefined;
}

function add2eInstallWeaponUsageNormalization() {
  if (globalThis.__ADD2E_WEAPON_USAGE_NORMALIZATION_V3) return;
  globalThis.__ADD2E_WEAPON_USAGE_NORMALIZATION_V3 = true;

  Hooks.on("preUpdateItem", (item, changes = {}) => {
    if (!ADD2E_WEAPON_TYPES.has(String(item?.type ?? "").toLowerCase())) return;
    if (!add2eEquipmentChangesEquipped(changes)) return;

    const canonicalTags = add2eCanonicalWeaponUsageTags(item);
    if (!canonicalTags) return;
    if (changes.system && typeof changes.system === "object") changes.system.tags = canonicalTags;
    else changes["system.tags"] = canonicalTags;
  });
}

function add2eRefreshEquipmentSheet(sheet) {
  sheet?._add2eRememberActiveTab?.();
  sheet?.render?.(false);
}

function add2eEffectiveItemType(item, itemType) {
  const type = String(itemType ?? item?.type ?? "").toLowerCase();
  if (type === "weapon") return "arme";
  if (type === "armor") return "armure";
  return type;
}

function add2eEquipmentClassCheck(actor, item, kind) {
  const check = globalThis.add2eCheckEquipmentAllowedForClass?.(actor, item, kind);
  return check && typeof check === "object"
    ? check
    : { ok: true, reason: "class-check-unavailable", classeLabel: "classe inconnue", classe: null };
}

function add2eEquipmentTagsForItem(item) {
  const tags = globalThis.add2eGetItemEquipTags?.(item);
  return Array.isArray(tags) ? tags : [...add2eEquipmentTags(item)];
}

function add2eEquipmentIsShield(item) {
  return globalThis.add2eIsShield?.(item) === true;
}

function add2eEquipmentIsHelmet(item) {
  return globalThis.add2eIsHelmet?.(item) === true;
}

function add2eEquipmentIsTwoHanded(item) {
  return Boolean(item?.system?.deuxMains) || add2eEquipmentTagsForItem(item).includes("usage:deux_mains");
}

function add2eEquipmentIsAmmunition(item) {
  if (globalThis.ADD2E_CONSUMABLES?.add2eIsAmmunition?.(item) === true) return true;
  const system = item?.system ?? {};
  const tags = add2eEquipmentTags(item);
  return String(system.categorie ?? "").toLowerCase() === "munition" ||
    tags.has("munition") ||
    tags.has("categorie:munition");
}

async function add2eHandleAmmunitionEquip(actor, item, sheet) {
  if (item.system?.equipee === true) {
    await item.update({ "system.equipee": false }, { add2eReason: "unequip-projectile" });
  } else if (typeof globalThis.add2eEquipProjectile === "function") {
    await globalThis.add2eEquipProjectile(actor, item);
  } else {
    await item.update({ "system.equipee": true }, { add2eReason: "equip-projectile" });
  }
  add2eRefreshEquipmentSheet(sheet);
  return true;
}

async function add2eHandleWeaponEquip(actor, item, sheet) {
  const check = add2eEquipmentClassCheck(actor, item, "arme");
  if (!check.ok) {
    const reason = check.reason === "forbidden"
      ? `tag interdit : ${check.matchedForbidden}`
      : "arme non autorisée par les restrictions de classe";
    ui.notifications?.error?.(`⚠️ Cette arme (« ${item.name} ») est interdite pour votre classe (${check.classeLabel}) — ${reason}.`);
    return false;
  }

  if (item.system?.equipee === true) {
    await item.update({ "system.equipee": false }, { add2eReason: "unequip-weapon" });
    add2eRefreshEquipmentSheet(sheet);
    return true;
  }

  if (add2eEquipmentIsTwoHanded(item)) {
    const shield = actor.items?.find?.(other =>
      ADD2E_ARMOR_TYPES.has(String(other?.type ?? "").toLowerCase()) &&
      other?.system?.equipee === true &&
      add2eEquipmentIsShield(other)
    ) ?? null;

    if (shield) {
      ui.notifications?.error?.(`⚠️ Impossible d'équiper une arme à deux mains si un bouclier est équipé (${shield.name}).`);
      return false;
    }
  }

  const slot = add2eGetWeaponUsageProfile(item).slot;
  for (const other of actor.items ?? []) {
    if (!other || other.id === item.id) continue;
    if (!ADD2E_WEAPON_TYPES.has(String(other.type ?? "").toLowerCase())) continue;
    if (other.system?.equipee !== true) continue;
    if (add2eGetWeaponUsageProfile(other).slot !== slot) continue;
    await other.update({ "system.equipee": false }, { add2eReason: "equip-weapon-slot-exclusivity" });
  }

  const update = { "system.equipee": true };
  const canonicalTags = add2eCanonicalWeaponUsageTags(item);
  if (canonicalTags) update["system.tags"] = canonicalTags;
  await item.update(update, { add2eReason: "equip-weapon" });
  add2eRefreshEquipmentSheet(sheet);
  return true;
}

async function add2eHandleArmorEquip(actor, item, sheet) {
  const alreadyEquipped = item.system?.equipee === true;
  const isShield = add2eEquipmentIsShield(item);
  const isHelmet = add2eEquipmentIsHelmet(item);
  const isArmor = !isShield && !isHelmet;
  const check = add2eEquipmentClassCheck(actor, item, "armure");

  const classLabel = String(check.classe?.label || check.classe?.nom || check.classe?.name || check.classeLabel || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f’']/g, "");
  const isMonk = classLabel.includes("moine");
  const allowed = (globalThis.add2eToEquipArray?.(check.classe?.armorAllowed ?? check.classe?.armures_autorisees ?? []) ?? [])
    .map(add2eEquipmentNormalize);

  if (globalThis.add2eHasTagRestriction?.(check.classe?.armorRestriction) !== true && isMonk && allowed.includes("aucune")) {
    ui.notifications?.error?.("⚠️ Les Moines ne peuvent jamais porter d’armure !");
    return false;
  }

  if (isShield) {
    const twoHanded = actor.items?.find?.(other =>
      ADD2E_WEAPON_TYPES.has(String(other?.type ?? "").toLowerCase()) &&
      other?.system?.equipee === true &&
      add2eEquipmentIsTwoHanded(other)
    ) ?? null;

    if (twoHanded) {
      ui.notifications?.error?.(`⚠️ Impossible d'équiper un bouclier avec une arme à deux mains (${twoHanded.name}) déjà équipée.`);
      return false;
    }
  }

  if (alreadyEquipped) {
    await item.update({ "system.equipee": false }, { add2eReason: "unequip-armor" });
  } else {
    if (!check.ok) {
      const reason = check.reason === "forbidden"
        ? `tag interdit : ${check.matchedForbidden}`
        : "protection non autorisée par les restrictions de classe";
      const typeLabel = isShield ? "Ce bouclier" : isHelmet ? "Ce heaume" : "Cette armure";
      ui.notifications?.error?.(`⚠️ ${typeLabel} (« ${item.name} ») est interdit pour votre classe (${check.classeLabel}) — ${reason}.`);
      return false;
    }

    for (const other of actor.items ?? []) {
      if (!other || other.id === item.id) continue;
      if (!ADD2E_ARMOR_TYPES.has(String(other.type ?? "").toLowerCase())) continue;
      if (
        (isArmor && !add2eEquipmentIsShield(other) && !add2eEquipmentIsHelmet(other)) ||
        (isShield && add2eEquipmentIsShield(other)) ||
        (isHelmet && add2eEquipmentIsHelmet(other))
      ) {
        await other.update({ "system.equipee": false }, { add2eReason: "equip-armor-slot-exclusivity" });
      }
    }

    if (isShield) {
      for (const weapon of actor.items ?? []) {
        if (!ADD2E_WEAPON_TYPES.has(String(weapon?.type ?? "").toLowerCase())) continue;
        if (weapon?.system?.equipee !== true || !add2eEquipmentIsTwoHanded(weapon)) continue;
        await weapon.update({ "system.equipee": false }, { add2eReason: "equip-shield-unequip-two-handed-weapon" });
        ui.notifications?.warn?.("Arme à deux mains déséquipée car un bouclier est équipé.");
      }
    }

    await item.update({ "system.equipee": true }, { add2eReason: "equip-armor" });
  }

  const equippedArmors = [...(actor.items ?? [])].filter(other =>
    ADD2E_ARMOR_TYPES.has(String(other?.type ?? "").toLowerCase()) &&
    other?.system?.equipee === true
  );
  const armor = equippedArmors.find(other => !add2eEquipmentIsShield(other) && !add2eEquipmentIsHelmet(other));
  const shield = equippedArmors.find(add2eEquipmentIsShield);
  const helmet = equippedArmors.find(add2eEquipmentIsHelmet);

  let caTotal = actor.system?.ca_naturel || 10;
  if (armor) caTotal = Number(armor.system?.ac);
  if (shield) caTotal -= Number(shield.system?.ac);
  if (helmet) caTotal -= Number(helmet.system?.ac);
  caTotal += actor.system?.dex_def || 0;

  await actor.update({ "system.ca_total": caTotal }, { add2eReason: "recalculate-armor-class" });
  add2eRefreshEquipmentSheet(sheet);
  return true;
}

export async function handleItemAction({ actor, action, itemId, itemType, sheet } = {}) {
  if (!actor || !action || !itemId) return false;
  const item = actor.items?.get?.(itemId) ?? null;
  if (!item) return false;

  const effectiveType = add2eEffectiveItemType(item, itemType);
  if (action === "edit") {
    item.sheet?.render?.(true);
    return true;
  }

  if (action === "delete") {
    await actor.deleteEmbeddedDocuments("Item", [item.id], { add2eReason: "delete-item" });
    add2eRefreshEquipmentSheet(sheet);
    return true;
  }

  if (action !== "equip") return false;
  if (add2eEquipmentIsAmmunition(item)) return add2eHandleAmmunitionEquip(actor, item, sheet);

  if (effectiveType === "objet") {
    await item.update({ "system.equipee": item.system?.equipee !== true }, { add2eReason: "toggle-object-equipment" });
    add2eRefreshEquipmentSheet(sheet);
    return true;
  }

  if (effectiveType === "arme") return add2eHandleWeaponEquip(actor, item, sheet);
  if (effectiveType === "armure") return add2eHandleArmorEquip(actor, item, sheet);
  return false;
}

function add2eWeaponModeStore() {
  if (!(globalThis.__ADD2E_WEAPON_ATTACK_MODES_V1 instanceof Map)) {
    globalThis.__ADD2E_WEAPON_ATTACK_MODES_V1 = new Map();
  }
  return globalThis.__ADD2E_WEAPON_ATTACK_MODES_V1;
}

function add2eWeaponModeKey(actorId, weaponId) {
  return `${String(actorId ?? "")}|${String(weaponId ?? "")}`;
}

function add2eSetTransientWeaponAttackMode(actorId, weaponId, mode) {
  const normalized = String(mode ?? "").toLowerCase() === "throw" ? "throw" : "contact";
  if (!actorId || !weaponId) return normalized;
  add2eWeaponModeStore().set(add2eWeaponModeKey(actorId, weaponId), normalized);
  return normalized;
}

function add2eTakeTransientWeaponAttackMode(actorId, weaponId, fallback) {
  const key = add2eWeaponModeKey(actorId, weaponId);
  const mode = add2eWeaponModeStore().get(key) ?? fallback;
  add2eWeaponModeStore().delete(key);
  return String(mode ?? "").toLowerCase() === "throw" ? "throw" : "contact";
}

function add2eRemoveLegacyThrownAttackBridge() {
  const current = globalThis.add2eAttackRoll;
  const original = current?.__add2eThrownWeaponAttackOriginal;
  if (typeof original !== "function") return false;
  globalThis.add2eAttackRoll = original;
  return true;
}

function add2eWeaponWithCanonicalUsageTags(weapon) {
  const canonicalTags = add2eCanonicalWeaponUsageTags(weapon);
  if (!canonicalTags) return weapon;
  const system = { ...(weapon?.system ?? {}), tags: canonicalTags };
  return new Proxy(weapon, {
    get(target, property, receiver) {
      if (property === "system") return system;
      return Reflect.get(target, property, receiver);
    }
  });
}

function add2eReadWeaponStackQuantity(weapon) {
  const value = weapon?.system?.quantite ?? weapon?.system?.quantity;
  if (value === undefined || value === null || value === "") return 1;
  return Math.max(0, Math.floor(Number(value) || 0));
}

async function add2eConsumeThrownWeaponAfterAttack(actor, weapon) {
  const api = globalThis.ADD2E_CONSUMABLES ?? game?.add2e?.consumables;
  if (typeof api?.add2eConsumeThrownWeapon !== "function") {
    console.warn("[ADD2E][WEAPON_USAGE][THROW][NO_CONSUMABLE_API]", { actor: actor?.name, weapon: weapon?.name });
    return { ok: false, reason: "consumable-api-unavailable" };
  }
  return api.add2eConsumeThrownWeapon(actor, weapon, 1);
}

/**
 * La fenêtre d'attaque porte le choix contact/lancer.
 * Ce pont ne crée aucune fenêtre et ne consomme qu'après un lancer validé.
 */
function add2eInstallWeaponUsageAttackBridge() {
  const current = globalThis.add2eAttackRoll;
  if (typeof current !== "function" || current.__add2eWeaponUsageAttackBridge === true) return false;

  const guarded = async function add2eAttackRollWithWeaponUsage(args = {}) {
    const actor = args.actor ?? (args.actorId ? game.actors?.get?.(args.actorId) : null);
    const weapon = args.arme ?? (actor && args.itemId ? actor.items?.get?.(args.itemId) : null);
    const profile = add2eGetWeaponUsageProfile(weapon);

    if (!actor || !weapon || !profile.isThrown) return current.call(this, args);

    const defaultMode = profile.isHybrid ? "contact" : "throw";
    add2eSetTransientWeaponAttackMode(actor.id, weapon.id, defaultMode);

    try {
      const weaponForAttack = add2eWeaponWithCanonicalUsageTags(weapon);
      const result = await current.call(this, { ...args, actor, arme: weaponForAttack });
      const mode = add2eTakeTransientWeaponAttackMode(actor.id, weapon.id, defaultMode);
      if (result !== true || mode !== "throw") return result;

      if (add2eReadWeaponStackQuantity(weapon) <= 0) {
        ui.notifications?.warn?.(`${weapon.name} n'est plus disponible pour être lancée.`);
        return false;
      }

      const consumed = await add2eConsumeThrownWeaponAfterAttack(actor, weapon);
      return consumed?.ok === false ? false : result;
    } finally {
      add2eWeaponModeStore().delete(add2eWeaponModeKey(actor.id, weapon.id));
    }
  };

  guarded.__add2eWeaponUsageAttackBridge = true;
  guarded.__add2eWeaponUsageAttackOriginal = current;
  globalThis.add2eAttackRoll = guarded;
  return true;
}

function add2eScheduleWeaponUsageIntegration() {
  // 21-consumables conserve ses API, mais ses anciens ponts à 0/100 ms
  // ne doivent plus ouvrir de seconde fenêtre.
  window.setTimeout(add2eRemoveLegacyThrownAttackBridge, 200);
  window.setTimeout(add2eRemoveLegacyThrownAttackBridge, 500);

  // Le vendeur installe son pont de carquois à 800 ms. Il reste actif pour
  // les armes propulsées ; ce pont extérieur gère ensuite les armes lancées.
  window.setTimeout(add2eInstallWeaponUsageAttackBridge, 900);
  window.setTimeout(add2eInstallWeaponUsageAttackBridge, 1100);
}

function add2eInstallEquipmentActions() {
  globalThis.add2eGetWeaponUsageProfile = add2eGetWeaponUsageProfile;
  globalThis.add2eSetTransientWeaponAttackMode = add2eSetTransientWeaponAttackMode;
  globalThis.add2eHandleItemAction = handleItemAction;
  globalThis.handleItemAction = handleItemAction;
  globalThis.ADD2E_EQUIPMENT_ACTIONS_VERSION = ADD2E_EQUIPMENT_ACTIONS_VERSION;
  add2eInstallWeaponUsageNormalization();
  Hooks.once("ready", add2eScheduleWeaponUsageIntegration);
}

add2eInstallEquipmentActions();