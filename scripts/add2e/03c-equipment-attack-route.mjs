// ============================================================
// ADD2E — Route unique des attaques d'équipement
// Compatible Foundry V13/V14/V15.
// Ce module est chargé après 03b et avant le vendeur.
// ============================================================

const ADD2E_EQUIPMENT_ATTACK_ROUTE_VERSION = "2026-06-24-attack-window-only-v1";

// add2e-attack.mjs est chargé avant ce module. On mémorise donc son noyau
// avant que les ponts legacy de consommables et vendeur ne l'enveloppent.
const ADD2E_ATTACK_CORE = globalThis.__ADD2E_ATTACK_ROLL_CORE
  ?? (typeof globalThis.add2eAttackRoll === "function" ? globalThis.add2eAttackRoll : null);

if (typeof ADD2E_ATTACK_CORE === "function") {
  globalThis.__ADD2E_ATTACK_ROLL_CORE = ADD2E_ATTACK_CORE;
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

function add2eSetWeaponMode(actorId, weaponId, mode) {
  if (!actorId || !weaponId) return "pending";
  const value = String(mode ?? "").toLowerCase();
  const normalized = value === "contact" || value === "throw" ? value : "pending";
  add2eWeaponModeStore().set(add2eWeaponModeKey(actorId, weaponId), normalized);
  return normalized;
}

function add2eTakeWeaponMode(actorId, weaponId, fallback = "contact") {
  const key = add2eWeaponModeKey(actorId, weaponId);
  const raw = add2eWeaponModeStore().get(key) ?? fallback;
  add2eWeaponModeStore().delete(key);
  return String(raw ?? "").toLowerCase() === "throw" ? "throw" : "contact";
}

function add2eAsArray(value) {
  if (Array.isArray(value)) return value.flatMap(add2eAsArray).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  return value === null || value === undefined || value === "" ? [] : [value];
}

function add2eNormalizeTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

function add2eContactTags(value) {
  const removed = new Set([
    "projectile_lance",
    "usage:lancer",
    "usage:jet",
    "usage:arme_de_jet",
    "categorie:projectile_lance",
    "trait:arme_de_jet",
    "type:arme_de_jet"
  ]);
  return add2eAsArray(value).filter(tag => !removed.has(add2eNormalizeTag(tag)));
}

function add2eContactWeaponProxy(weapon, actorId, weaponId) {
  const sourceSystem = weapon?.system ?? {};
  const contactSystem = {
    ...sourceSystem,
    categorie: "melee",
    category: "melee",
    arme_de_jet: false,
    armeDeJet: false,
    isThrown: false,
    portee_courte: 0,
    portee_moyenne: 0,
    portee_longue: 0,
    porteeCourte: 0,
    porteeMoyenne: 0,
    porteeLongue: 0,
    tags: add2eContactTags(sourceSystem.tags),
    effectTags: add2eContactTags(sourceSystem.effectTags),
    effecttags: add2eContactTags(sourceSystem.effecttags)
  };
  const key = add2eWeaponModeKey(actorId, weaponId);

  return new Proxy(weapon, {
    get(target, property, receiver) {
      if (property !== "system") return Reflect.get(target, property, receiver);
      return add2eWeaponModeStore().get(key) === "contact" ? contactSystem : sourceSystem;
    }
  });
}

function add2eItemQuantity(item) {
  const raw = item?.system?.quantite ?? item?.system?.quantity;
  if (raw === undefined || raw === null || raw === "") return 1;
  return Math.max(0, Math.floor(Number(raw) || 0));
}

function add2eUsageProfile(weapon) {
  const profile = globalThis.add2eGetWeaponUsageProfile?.(weapon);
  if (profile && typeof profile === "object") return profile;
  return {
    isProjectilePropulse: false,
    isThrown: false,
    isHybrid: false
  };
}

function add2eFindEquippedProjectile(actor, weapon) {
  const compatible = globalThis.add2eGetEquippedProjectileForWeapon?.(actor, weapon) ?? null;
  if (compatible) return compatible;

  const isAmmunition = globalThis.ADD2E_CONSUMABLES?.add2eIsAmmunition;
  return [...(actor?.items ?? [])].find(item =>
    item?.system?.equipee === true && typeof isAmmunition === "function" && isAmmunition(item)
  ) ?? null;
}

function add2eProjectileDamageWeaponProxy(weapon, projectile) {
  const weaponSystem = weapon?.system ?? {};
  const projectileSystem = projectile?.system ?? {};
  const system = {
    ...weaponSystem,
    degats: projectileSystem.degats ?? projectileSystem.dégâts ?? weaponSystem.degats,
    dégâts: projectileSystem.dégâts ?? projectileSystem.degats ?? weaponSystem.dégâts,
    type_degats: projectileSystem.type_degats ?? weaponSystem.type_degats
  };

  return new Proxy(weapon, {
    get(target, property, receiver) {
      if (property === "system") return system;
      return Reflect.get(target, property, receiver);
    }
  });
}

async function add2eSpendProjectile(actor, weapon) {
  const spend = globalThis.add2eSpendProjectileForAttack
    ?? game?.add2e?.vendorProjectiles?.spendProjectileForAttack
    ?? globalThis.ADD2E_VENDOR_PROJECTILES?.spendProjectileForAttack;
  if (typeof spend !== "function") return { ok: false, reason: "projectile-api-unavailable" };
  return spend({ actor, arme: weapon });
}

async function add2eConsumeThrownWeapon(actor, weapon) {
  const api = globalThis.ADD2E_CONSUMABLES ?? game?.add2e?.consumables;
  if (typeof api?.add2eConsumeThrownWeapon !== "function") {
    console.warn("[ADD2E][WEAPON_USAGE][THROW][NO_CONSUMABLE_API]", { actor: actor?.name, weapon: weapon?.name });
    return { ok: false, reason: "consumable-api-unavailable" };
  }
  return api.add2eConsumeThrownWeapon(actor, weapon, 1);
}

/**
 * Cette route est la seule route active après le démarrage. Elle appelle le
 * noyau d'attaque directement : le DialogV2 intermédiaire de 21-consumables
 * ne peut donc jamais recevoir l'action d'attaque.
 */
function add2eInstallFinalAttackRoute() {
  const core = globalThis.__ADD2E_ATTACK_ROLL_CORE ?? ADD2E_ATTACK_CORE;
  if (typeof core !== "function") return false;
  if (globalThis.add2eAttackRoll?.__add2eFinalAttackRouteV1 === true) return true;

  const routed = async function add2eAttackRollFromAttackWindow(args = {}) {
    const actor = args.actor ?? (args.actorId ? game.actors?.get?.(args.actorId) : null);
    const weapon = args.arme ?? (actor && args.itemId ? actor.items?.get?.(args.itemId) : null);
    if (!actor || !weapon) return core.call(this, args);

    const profile = add2eUsageProfile(weapon);
    const modeKey = add2eWeaponModeKey(actor.id, weapon.id);
    let attackWeapon = weapon;

    if (profile.isHybrid) {
      // "pending" laisse la fenêtre reconnaître l'arme hybride.
      // DialogV2 place ensuite "contact" ou "throw" dans cet état.
      add2eSetWeaponMode(actor.id, weapon.id, "pending");
      attackWeapon = add2eContactWeaponProxy(weapon, actor.id, weapon.id);
    } else if (profile.isProjectilePropulse) {
      const projectile = add2eFindEquippedProjectile(actor, weapon);
      if (!projectile || add2eItemQuantity(projectile) <= 0) {
        await add2eSpendProjectile(actor, weapon);
        return false;
      }
      attackWeapon = add2eProjectileDamageWeaponProxy(weapon, projectile);
    }

    try {
      const result = await core.call(this, { ...args, actor, arme: attackWeapon });
      if (result !== true) return result;

      if (profile.isProjectilePropulse) {
        const spent = await add2eSpendProjectile(actor, weapon);
        return spent?.ok === false ? false : result;
      }

      if (profile.isThrown) {
        const mode = profile.isHybrid
          ? add2eTakeWeaponMode(actor.id, weapon.id, "contact")
          : "throw";
        if (mode === "throw") {
          if (add2eItemQuantity(weapon) <= 0) {
            ui.notifications?.warn?.(`${weapon.name} n'est plus disponible pour être lancée.`);
            return false;
          }
          const spent = await add2eConsumeThrownWeapon(actor, weapon);
          return spent?.ok === false ? false : result;
        }
      }

      return result;
    } finally {
      if (profile.isHybrid) add2eWeaponModeStore().delete(modeKey);
    }
  };

  // Empêche le pont provisoire de 03b de s'ajouter ensuite à cette route.
  routed.__add2eWeaponUsageAttackBridge = true;
  routed.__add2eFinalAttackRouteV1 = true;
  routed.__add2eFinalAttackRouteCore = core;
  globalThis.add2eAttackRoll = routed;
  return true;
}

function add2eInstallRouteAfterLegacyBridges() {
  // 21-consumables : 0/100 ms. 22-vendor : 800 ms.
  window.setTimeout(add2eInstallFinalAttackRoute, 1000);
  window.setTimeout(add2eInstallFinalAttackRoute, 1300);
}

Hooks.once("ready", add2eInstallRouteAfterLegacyBridges);

globalThis.add2eSetTransientWeaponAttackMode = add2eSetWeaponMode;
globalThis.ADD2E_EQUIPMENT_ATTACK_ROUTE_VERSION = ADD2E_EQUIPMENT_ATTACK_ROUTE_VERSION;