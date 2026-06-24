// ============================================================
// ADD2E — Actions d'équipement et usages d'armes centralisés
// Compatible Foundry V13/V14/V15.
// Les règles de classe et les tags restent dans 03-equipment-rules.mjs.
// ============================================================

const ADD2E_EQUIPMENT_ACTIONS_VERSION = "2026-06-24-equipment-actions-central-weapon-usage-v2";
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
 * Source unique de la classification métier des armes.
 *
 * - projectile propulsé : utilise une munition de carquois ;
 * - lancer : l'arme elle-même est dépensée ;
 * - hybride : contact et lancer ;
 * - contact : ne dépend jamais du carquois.
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
  const requiresEquippedProjectile = hasRange && !isThrown && !isContact;

  return {
    category,
    tags: [...tags],
    hasRange,
    isProjectilePropulse,
    isThrown,
    isContact,
    isHybrid,
    requiresEquippedProjectile,
    slot: isContact ? "contact" : "distance"
  };
}

/**
 * Rend les anciennes données projetées compatibles avec les consommateurs
 * historiques qui reconnaissent usage:lancer, sans utiliser le nom de l'arme.
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
  if (globalThis.__ADD2E_WEAPON_USAGE_NORMALIZATION_V2) return;
  globalThis.__ADD2E_WEAPON_USAGE_NORMALIZATION_V2 = true;

  Hooks.on("preUpdateItem", (item, changes = {}) => {
    if (!ADD2E_WEAPON_TYPES.has(String(item?.type ?? "").toLowerCase())) return;
    if (!add2eEquipmentChangesEquipped(changes)) return;

    const canonicalTags = add2eCanonicalWeaponUsageTags(item);
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
          const canonicalTags = add2eCanonicalWeaponUsageTags(item);
          if (canonicalTags) updates.push({ _id: item.id, "system.tags": canonicalTags });
        }
        if (updates.length) {
          await actor.updateEmbeddedDocuments("Item", updates, {
            add2eReason: "normalize-thrown-weapon-usage-tags"
          });
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
  return Boolean(item?.system?.deuxMains) || add2eEquipmentTagsForItem(item).includes("usage:deux_mains");
}

function add2eEquipmentIsAmmunition(item) {
  return globalThis.ADD2E_CONSUMABLES?.add2eIsAmmunition?.(item) === true;
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

function add2eWeaponStackQuantity(weapon) {
  const value = weapon?.system?.quantite ?? weapon?.system?.quantity;
  if (value === undefined || value === null || value === "") return 1;
  return Math.max(0, Math.floor(Number(value) || 0));
}

function add2eWeaponForContactAttack(weapon) {
  const system = {
    ...(weapon?.system ?? {}),
    portee_courte: 0,
    portee_moyenne: 0,
    portee_longue: 0,
    porteeCourte: 0,
    porteeMoyenne: 0,
    porteeLongue: 0
  };

  return new Proxy(weapon, {
    get(target, property, receiver) {
      if (property === "system") return system;
      return Reflect.get(target, property, receiver);
    }
  });
}

function add2eEscapeWeaponModeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

async function add2ePromptThrownWeaponMode(weapon) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications?.error?.("DialogV2 est indisponible pour choisir le mode d'attaque.");
    return null;
  }

  const name = add2eEscapeWeaponModeHtml(weapon?.name ?? "Arme");
  const image = add2eEscapeWeaponModeHtml(weapon?.img ?? "icons/svg/sword.svg");
  const content = `
    <section class="add2e-thrown-mode-dialog" style="box-sizing:border-box;width:430px;max-width:430px;color:#24170a;font-family:inherit;">
      <div style="display:flex;align-items:center;gap:8px;padding:7px;border:1px solid #d5b15a;border-radius:8px;background:#fff8dd;">
        <img src="${image}" alt="" style="width:42px;height:42px;object-fit:cover;border-radius:6px;border:1px solid #fff7dc;background:#2a1908;">
        <div style="min-width:0;">
          <div style="font-size:.62rem;font-weight:950;text-transform:uppercase;color:#5a3510;">Arme polyvalente</div>
          <div style="font-size:.95rem;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${name}">${name}</div>
        </div>
      </div>
      <p style="margin:10px 0 0;color:#5a3510;font-weight:800;line-height:1.35;">Choisis l'emploi de cette arme pour l'attaque.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px;">
        <div style="padding:7px;border:1px solid #d5b15a;border-radius:7px;background:#fffdf4;">
          <div style="font-weight:950;color:#5a3510;"><i class="fas fa-hand-fist"></i> Corps à corps</div>
          <div style="margin-top:3px;font-size:.82rem;color:#5b4b3c;">Aucune consommation. Portée de contact.</div>
        </div>
        <div style="padding:7px;border:1px solid #d69a76;border-radius:7px;background:#fff2e8;">
          <div style="font-weight:950;color:#8f2d22;"><i class="fas fa-bullseye"></i> Lancer</div>
          <div style="margin-top:3px;font-size:.82rem;color:#5b4b3c;">Une unité est dépensée et pourra être récupérée en fin de combat.</div>
        </div>
      </div>
    </section>`;

  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
      return value;
    };

    const dialog = new DialogV2({
      window: { title: `${weapon?.name ?? "Arme"} — mode d'attaque` },
      classes: ["add2e", "add2e-attack-dialog", "add2e-thrown-mode-dialog"],
      position: { width: 460, height: "auto" },
      content,
      buttons: [
        { action: "contact", label: "Corps à corps", default: true, callback: () => finish("contact") },
        { action: "throw", label: "Lancer", callback: () => finish("throw") },
        { action: "cancel", label: "Annuler", callback: () => finish(null) }
      ],
      default: "contact"
    });

    dialog.addEventListener?.("close", () => finish(null), { once: true });
    dialog.render({ force: true });
  });
}

async function add2eAlertThrownWeaponUnavailable(weapon) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  const message = `${weapon?.name ?? "Cette arme"} n'est plus disponible pour être lancée.`;
  if (DialogV2?.alert) {
    await DialogV2.alert({
      window: { title: "Arme de lancer indisponible" },
      content: `<p>${add2eEscapeWeaponModeHtml(message)}</p>`,
      ok: { label: "Compris" },
      modal: true
    });
    return;
  }
  ui.notifications?.warn?.(message);
}

async function add2eConsumeThrownWeapon(actor, weapon) {
  if (typeof globalThis.add2eConsumeThrownWeapon === "function") {
    return globalThis.add2eConsumeThrownWeapon(actor, weapon, 1);
  }
  return { ok: false, reason: "consumable-api-unavailable" };
}

function add2eInstallCentralEquipmentHandler() {
  globalThis.handleItemAction = handleItemAction;
  globalThis.add2eHandleItemAction = handleItemAction;
}

function add2eInstallCentralWeaponAttackBridge() {
  if (globalThis.__ADD2E_CENTRAL_WEAPON_ATTACK_BRIDGE_V2) return true;

  const current = globalThis.add2eAttackRoll;
  if (typeof current !== "function") return false;
  const original = typeof current.__add2eThrownWeaponAttackOriginal === "function"
    ? current.__add2eThrownWeaponAttackOriginal
    : current;
  if (original.__add2eCentralWeaponAttackBridge === true) return true;

  const guarded = async function add2eAttackRollWithCentralWeaponUsage(args = {}) {
    const actor = args.actor ?? (args.actorId ? game.actors?.get?.(args.actorId) : null);
    const weapon = args.arme ?? (actor && args.itemId ? actor.items?.get?.(args.itemId) : null);
    const profile = add2eGetWeaponUsageProfile(weapon);

    if (!actor || !weapon || !profile.isThrown) return original.call(this, args);

    const mode = profile.isHybrid ? await add2ePromptThrownWeaponMode(weapon) : "throw";
    if (!mode) return false;

    if (mode === "throw" && add2eWeaponStackQuantity(weapon) <= 0) {
      await add2eAlertThrownWeaponUnavailable(weapon);
      return false;
    }

    const attackArgs = mode === "contact"
      ? { ...args, actor, arme: add2eWeaponForContactAttack(weapon) }
      : { ...args, actor, arme: weapon };
    const result = await original.call(this, attackArgs);

    if (result === true && mode === "throw") {
      const consumption = await add2eConsumeThrownWeapon(actor, weapon);
      if (consumption?.ok === false) return false;
    }
    return result;
  };

  guarded.__add2eCentralWeaponAttackBridge = true;
  guarded.__add2eCentralWeaponAttackOriginal = original;
  globalThis.add2eAttackRoll = guarded;
  globalThis.__ADD2E_CENTRAL_WEAPON_ATTACK_BRIDGE_V2 = true;
  return true;
}

function add2eScheduleCentralRuntimeBridges() {
  const install = () => {
    add2eInstallCentralEquipmentHandler();
    add2eInstallCentralWeaponAttackBridge();
  };

  // 21-consumables installe ses anciens ponts à 0 et 100 ms.
  // Cette installation, antérieure au pont vendeur de 800 ms, les remplace
  // par le profil central sans modifier la chaîne arc/arbalète/fronde.
  window.setTimeout(install, 200);
  window.setTimeout(install, 500);
}

function add2eInstallEquipmentActions() {
  globalThis.add2eGetWeaponUsageProfile = add2eGetWeaponUsageProfile;
  globalThis.add2eHandleItemAction = handleItemAction;
  globalThis.handleItemAction = handleItemAction;
  globalThis.ADD2E_EQUIPMENT_ACTIONS_VERSION = ADD2E_EQUIPMENT_ACTIONS_VERSION;
  add2eInstallWeaponUsageNormalization();
  Hooks.once("ready", add2eScheduleCentralRuntimeBridges);
}

add2eInstallEquipmentActions();