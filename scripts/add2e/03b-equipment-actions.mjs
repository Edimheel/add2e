// ============================================================
// ADD2E — Actions d'équipement centralisées
// Compatible Foundry V13/V14/V15.
// Les règles de classe et les tags restent dans 03-equipment-rules.mjs.
// ============================================================

const ADD2E_EQUIPMENT_ACTIONS_VERSION = "2026-06-24-equipment-actions-hybrid-weapons-v1";
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
 * Décrit l'usage métier d'une arme depuis ses données, sans utiliser son nom.
 * Une arme hybride possède simultanément les capacités contact et lancer.
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
    category === "projectile_lance" || has(
      "projectile_lance",
      "usage:lancer",
      "usage:jet",
      "usage:arme_de_jet",
      "categorie:projectile_lance",
      "trait:arme_de_jet",
      "type:arme_de_jet"
    )
  );

  const isContact = category === "melee" || category === "contact" || category === "corps_a_corps" || has(
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

  return {
    category,
    tags: [...tags],
    hasRange,
    isProjectilePropulse,
    isThrown,
    isContact,
    isHybrid: isThrown && isContact,
    slot: isContact ? "contact" : "distance"
  };
}

function add2eHybridCanonicalTags(item) {
  const profile = add2eGetWeaponUsageProfile(item);
  if (!profile.isHybrid) return null;

  const current = add2eEquipmentArray(item?.system?.tags);
  const normalized = new Set(current.map(add2eEquipmentNormalize));
  let changed = false;
  for (const tag of ["usage:contact", "usage:lancer"]) {
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

function add2eInstallHybridWeaponTagNormalization() {
  if (globalThis.__ADD2E_HYBRID_WEAPON_TAG_NORMALIZATION_V1) return;
  globalThis.__ADD2E_HYBRID_WEAPON_TAG_NORMALIZATION_V1 = true;

  Hooks.on("preUpdateItem", (item, changes = {}) => {
    if (!ADD2E_WEAPON_TYPES.has(String(item?.type ?? "").toLowerCase())) return;
    if (!add2eEquipmentChangesEquipped(changes)) return;

    const canonicalTags = add2eHybridCanonicalTags(item);
    if (!canonicalTags) return;
    if (changes.system && typeof changes.system === "object") changes.system.tags = canonicalTags;
    else changes["system.tags"] = canonicalTags;
  });

  Hooks.once("ready", () => {
    if (!game.user?.isGM) return;
    window.setTimeout(async () => {
      for (const actor of game.actors ?? []) {
        if (actor?.type !== "personnage") continue;
        const updates = [];
        for (const item of actor.items ?? []) {
          if (!ADD2E_WEAPON_TYPES.has(String(item?.type ?? "").toLowerCase())) continue;
          if (item.system?.equipee !== true) continue;
          const canonicalTags = add2eHybridCanonicalTags(item);
          if (canonicalTags) updates.push({ _id: item.id, "system.tags": canonicalTags });
        }
        if (updates.length) {
          await actor.updateEmbeddedDocuments("Item", updates, { add2eReason: "normalize-hybrid-thrown-contact-weapon-tags" });
        }
      }
    }, 0);
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
  return item?.system?.deuxMains === true || add2eEquipmentTagsForItem(item).includes("usage:deux_mains");
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
  const canonicalTags = add2eHybridCanonicalTags(item);
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
    ADD2E_ARMOR_TYPES.has(String(other?.type ?? "").toLowerCase()) && other?.system?.equipee === true
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

  if (effectiveType === "objet") {
    await item.update({ "system.equipee": item.system?.equipee !== true }, { add2eReason: "toggle-object-equipment" });
    add2eRefreshEquipmentSheet(sheet);
    return true;
  }

  if (effectiveType === "arme") return add2eHandleWeaponEquip(actor, item, sheet);
  if (effectiveType === "armure") return add2eHandleArmorEquip(actor, item, sheet);
  return false;
}

function add2eInstallEquipmentActions() {
  globalThis.add2eGetWeaponUsageProfile = add2eGetWeaponUsageProfile;
  globalThis.add2eHandleItemAction = handleItemAction;
  globalThis.handleItemAction = handleItemAction;
  globalThis.ADD2E_EQUIPMENT_ACTIONS_VERSION = ADD2E_EQUIPMENT_ACTIONS_VERSION;
  add2eInstallHybridWeaponTagNormalization();
}

add2eInstallEquipmentActions();