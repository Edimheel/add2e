// ADD2E — Définition métier de l’armurier sur le moteur SHOP commun.
// Les armes, armures et projectiles restent dans leurs compendiums.
// Compatible Foundry V13/V14/V15.

import {
  VENDOR_SCOPE,
  num,
  slug,
  quantity,
  isAmmunition,
  registerShopDefinition,
  getShopType,
  createShopActor,
  ensureShopActor
} from "./22a-vendor-core.mjs";

export const ADD2E_ARMORER_VERSION = "2026-08-08-armorer-v8-definition-only";
export const ARMORER_SETTING = "armorerCreationVersion";

const ARMORER_SCOPE = VENDOR_SCOPE;
const ARMORER_NAME = "Armurier";
const ARMORER_FOLDER = "ADD2E — Boutique";
const ARMORER_TOKEN_IMG = "icons/environment/settlement/blacksmith.webp";

const isArmorerAmmunition = item => isAmmunition(item);
const defaultStock = item => isArmorerAmmunition(item) ? 40 : item?.type === "arme" ? 5 : 4;

export function armorerKind(item) {
  const kind = item?._shop?.kind;
  if (kind === "projectile" || isArmorerAmmunition(item)) return "Projectile";
  if (kind === "weapon" || item?.type === "arme") return "Arme";
  if (kind === "armor" || item?.type === "armure") return "Armure";
  return "Article";
}

registerShopDefinition({
  id: "armorer",
  label: ARMORER_NAME,
  actorName: ARMORER_NAME,
  folder: ARMORER_FOLDER,
  tokenImg: ARMORER_TOKEN_IMG,
  setting: ARMORER_SETTING,
  actorFlags: { isArmorer: true },
  defaultMoney: { po: 1000 },
  sources: [
    {
      id: "weapons",
      packs: ["add2e.armes", "world.armes"],
      discover: /\barmes?\b|weapons?/i,
      accept: item => item?.type === "arme" && !isArmorerAmmunition(item),
      kind: "weapon",
      defaultStock: 5
    },
    {
      id: "projectiles",
      packs: ["add2e.armes", "world.armes"],
      discover: /\barmes?\b|weapons?/i,
      accept: item => isArmorerAmmunition(item),
      kind: "projectile",
      defaultStock: 40
    },
    {
      id: "armors",
      packs: ["add2e.armures", "world.armures"],
      discover: /armures?|armor|armour/i,
      accept: item => item?.type === "armure",
      kind: "armor",
      defaultStock: 4
    }
  ],
  legacyItemPredicate: item => item?.getFlag?.(ARMORER_SCOPE, "armorerItem") === true || item?.flags?.add2e?.armorerItem === true,
  legacyStockMaximum: item => Math.max(
    quantity(item),
    Math.floor(num(
      item?.getFlag?.(ARMORER_SCOPE, "armorerStockMax") ?? item?.flags?.add2e?.armorerStockMax,
      defaultStock(item)
    ))
  ),
  catalogIdentity: (item, kind) => `${kind}:${slug(item?.name)}`
});

export function findArmorer() {
  return Array.from(game.actors ?? []).find(actor => getShopType(actor) === "armorer" || actor?.name === ARMORER_NAME) ?? null;
}

async function ensureFolder() {
  if (!game.user?.isGM) return null;
  return Array.from(game.folders ?? []).find(folder => folder.type === "Actor" && folder.name === ARMORER_FOLDER)
    ?? Folder.create({ name: ARMORER_FOLDER, type: "Actor", color: "#69431a" }, { add2eReason: "armorer-folder-create" });
}

export async function moveToFolder(armorer = null) {
  if (!game.user?.isGM) return false;
  armorer = armorer ?? findArmorer();
  if (!armorer) return false;
  const folder = await ensureFolder();
  if (folder && armorer.folder?.id !== folder.id && armorer.folder !== folder.id) {
    await armorer.update({ folder: folder.id }, { add2eReason: "armorer-folder-move" });
  }
  return true;
}

export async function updateTokenSize(armorer = null) {
  if (!game.user?.isGM) return false;
  armorer = armorer ?? findArmorer();
  if (!armorer) return false;
  await armorer.update({
    img: ARMORER_TOKEN_IMG,
    "prototypeToken.width": 2,
    "prototypeToken.height": 2,
    "prototypeToken.texture.src": ARMORER_TOKEN_IMG,
    "flags.add2e.armorerVersion": ADD2E_ARMORER_VERSION,
    "flags.add2e.shopType": "armorer"
  }, { add2eReason: "armorer-token-image-size" });
  return true;
}

export async function createArmorer({ force = false } = {}) {
  const existing = findArmorer();
  if (existing && !force) {
    await moveToFolder(existing);
    await updateTokenSize(existing);
    await ensureStock(existing);
    return existing;
  }

  const armorer = await createShopActor("armorer", { force });
  if (armorer) {
    await updateTokenSize(armorer);
    if (game.settings?.settings?.has?.(`add2e.${ARMORER_SETTING}`)) {
      await game.settings.set("add2e", ARMORER_SETTING, ADD2E_ARMORER_VERSION);
    }
  }
  return armorer;
}

export async function ensureStock(armorer) {
  if (!armorer) return 0;
  const items = await ensureShopActor(armorer, "armorer");
  return items.length;
}

export function usabilityForActor(actor, item) {
  if (!actor || !item) {
    return { state: "neutral", usable: true, label: "Aucun acteur acheteur", reason: "Aucun acteur acheteur" };
  }
  if (isArmorerAmmunition(item)) {
    return { state: "usable", usable: true, label: "Projectile", reason: "Munition rangée dans le carquois" };
  }
  if (!["arme", "armure"].includes(String(item.type ?? "").toLowerCase())) {
    return { state: "neutral", usable: true, label: "Article", reason: "Article hors armurerie" };
  }
  if (typeof globalThis.add2eCheckEquipmentAllowedForClass !== "function") {
    throw new Error("Le résolveur canonique des restrictions d’équipement ADD2E est indisponible.");
  }
  const kind = item.type === "arme" ? "arme" : "armure";
  const check = globalThis.add2eCheckEquipmentAllowedForClass(actor, item, kind);
  return {
    state: check?.ok ? "usable" : "unusable",
    usable: check?.ok === true,
    label: check?.ok ? "Utilisable" : "Non utilisable",
    reason: check?.reason ?? "Restriction de classe"
  };
}

export function registerGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.armorerVersion = ADD2E_ARMORER_VERSION;
  globalThis.ADD2E_ARMORER_VERSION = ADD2E_ARMORER_VERSION;
}
