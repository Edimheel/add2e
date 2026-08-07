// ADD2E — Résolution compendium-first des drops personnage
// Version : 2026-08-07-thrown-weapon-stack-drop-v4
//
// Module court chargé après le drop historique. Il force la résolution depuis
// le compendium avant que les validateurs race/classe ne lisent raw.data.
// Les armes de jet strictement identiques sont fusionnées en une pile d'inventaire.

import { add2eGetWeaponUsageProfile } from "./03b-equipment-actions.mjs";

const ADD2E_DROP_COMPENDIUM_RESOLVER_VERSION = "2026-08-07-thrown-weapon-stack-drop-v4";
globalThis.ADD2E_DROP_COMPENDIUM_RESOLVER_VERSION = ADD2E_DROP_COMPENDIUM_RESOLVER_VERSION;

function add2eDropResolverNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eDropResolverToItemData(doc) {
  if (!(doc instanceof Item)) return null;
  const data = doc.toObject();
  data.flags = data.flags ?? {};
  data.flags.add2e = data.flags.add2e ?? {};
  data.flags.add2e.dropResolvedFromCompendium = !!doc.pack;
  data.flags.add2e.dropResolvedUuid = doc.uuid;
  if (doc.pack) {
    data.pack = doc.pack;
    data.uuid = doc.uuid;
  }
  return data;
}

function add2eDropResolverIsThrownWeapon(item) {
  if (!item || !["arme", "weapon"].includes(String(item.type ?? "").toLowerCase())) return false;
  return add2eGetWeaponUsageProfile(item)?.isThrown === true;
}

function add2eDropResolverWeaponQuantity(item) {
  const raw = item?.system?.quantite ?? item?.system?.quantity;
  if (raw === undefined || raw === null || raw === "") return 1;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 1;
}

function add2eDropResolverSourceUuid(item) {
  return String(
    item?.flags?.add2e?.dropResolvedUuid
    ?? item?.getFlag?.("add2e", "dropResolvedUuid")
    ?? (String(item?.uuid ?? "").startsWith("Compendium.") ? item.uuid : "")
  ).trim();
}

function add2eDropResolverThrownWeaponSignature(item) {
  const system = item?.system ?? {};
  const profile = add2eGetWeaponUsageProfile(item);
  return JSON.stringify({
    type: String(item?.type ?? "").toLowerCase(),
    name: add2eDropResolverNormalize(item?.name ?? system.nom ?? ""),
    category: profile?.category ?? "",
    isThrown: profile?.isThrown === true,
    isHybrid: profile?.isHybrid === true,
    damage: system.dégâts ?? system.degats ?? system.damage ?? system.damages ?? null,
    damageType: system.type_degats ?? system.typeDegats ?? system.damageType ?? null,
    bonusHit: system.bonus_hit ?? system.bonusHit ?? 0,
    bonusDamage: system.bonus_dom ?? system.bonus_degats ?? system.bonusDamage ?? 0,
    speed: system.facteur_rapidité ?? system.facteur_rapidite ?? system.speedFactor ?? null,
    rangeShort: system.portee_courte ?? system.porteeCourte ?? null,
    rangeMedium: system.portee_moyenne ?? system.porteeMoyenne ?? null,
    rangeLong: system.portee_longue ?? system.porteeLongue ?? null,
    twoHanded: system.deuxMains === true,
    magic: system.magique === true || system.magic === true,
    identified: system.identifie === true || system.identified === true
  });
}

function add2eDropResolverSameThrownWeapon(a, b) {
  if (!add2eDropResolverIsThrownWeapon(a) || !add2eDropResolverIsThrownWeapon(b)) return false;
  const sourceA = add2eDropResolverSourceUuid(a);
  const sourceB = add2eDropResolverSourceUuid(b);
  if (sourceA && sourceB) return sourceA === sourceB;
  return add2eDropResolverThrownWeaponSignature(a) === add2eDropResolverThrownWeaponSignature(b);
}

async function add2eDropResolverMergeThrownWeapon(actor, itemData, raw = {}) {
  if (!actor || actor.type !== "personnage" || !add2eDropResolverIsThrownWeapon(itemData)) return false;

  const actorUuid = String(actor.uuid ?? `Actor.${actor.id ?? ""}`);
  const sourceUuid = String(raw?.uuid ?? itemData?.uuid ?? "");
  if (sourceUuid.startsWith(`${actorUuid}.Item.`)) return false;

  const matches = Array.from(actor.items ?? []).filter(item => add2eDropResolverSameThrownWeapon(item, itemData));
  if (!matches.length) return false;

  const target = matches[0];
  const extras = matches.slice(1);
  const added = Math.max(1, add2eDropResolverWeaponQuantity(itemData));
  const current = matches.reduce((total, item) => total + Math.max(1, add2eDropResolverWeaponQuantity(item)), 0);
  const total = current + added;
  const equipped = matches.some(item => item.system?.equipee === true || item.system?.equipped === true)
    || itemData?.system?.equipee === true
    || itemData?.system?.equipped === true;

  await target.update({
    "system.quantite": total,
    "system.equipee": equipped
  }, {
    add2eReason: "merge-thrown-weapon-drop",
    add2eInternal: true
  });

  const extraIds = extras.map(item => item.id).filter(Boolean);
  if (extraIds.length) {
    await actor.deleteEmbeddedDocuments("Item", extraIds, {
      add2eReason: "merge-thrown-weapon-drop-duplicates",
      add2eInternal: true
    });
  }

  ui.notifications?.info?.(`${target.name} : ${total} exemplaire(s) dans la pile.`);
  return true;
}

function add2eDropResolverNormalizeThrownWeaponQuantity(itemData) {
  if (!add2eDropResolverIsThrownWeapon(itemData)) return itemData;
  itemData.system = itemData.system ?? {};
  itemData.system.quantite = Math.max(1, add2eDropResolverWeaponQuantity(itemData));
  return itemData;
}

async function add2eResolveDropItemDataCompendiumFirst(raw) {
  if (!raw || raw.type !== "Item") return null;

  if (raw.pack && raw.id) {
    const pack = game.packs.get(raw.pack);
    const doc = pack ? await pack.getDocument(raw.id) : null;
    const data = add2eDropResolverToItemData(doc);
    if (data) return data;
  }

  if (raw.uuid && String(raw.uuid).startsWith("Compendium.")) {
    const doc = await fromUuid(raw.uuid);
    const data = add2eDropResolverToItemData(doc);
    if (data) return data;
  }

  const fallbackType = String(raw.data?.type ?? "").toLowerCase();
  const fallbackName = String(raw.data?.name ?? "").trim();
  if (fallbackName && ["race", "classe"].includes(fallbackType)) {
    const packIds = fallbackType === "race" ? ["add2e.races"] : ["add2e.classes"];
    const wanted = add2eDropResolverNormalize(fallbackName);

    for (const packId of packIds) {
      const pack = game.packs.get(packId);
      if (!pack) continue;
      const index = await pack.getIndex();
      const entry = index.find(e => add2eDropResolverNormalize(e.name) === wanted);
      if (!entry) continue;
      const doc = await pack.getDocument(entry._id);
      const data = add2eDropResolverToItemData(doc);
      if (data) return data;
    }
  }

  if (raw.uuid) {
    const doc = await fromUuid(raw.uuid);
    const data = add2eDropResolverToItemData(doc);
    if (data) return data;
  }

  return raw.data ?? null;
}

function add2eDropResolverBuildSyntheticEvent(event, raw, itemData) {
  const syntheticRaw = {
    ...raw,
    data: itemData,
    pack: itemData?.pack ?? raw.pack,
    id: itemData?._id ?? raw.id,
    uuid: itemData?.uuid ?? raw.uuid
  };

  return {
    ...event,
    preventDefault: event.preventDefault?.bind(event),
    stopPropagation: event.stopPropagation?.bind(event),
    dataTransfer: {
      ...event.dataTransfer,
      getData: type => type === "text/plain" ? JSON.stringify(syntheticRaw) : event.dataTransfer?.getData?.(type)
    }
  };
}

function add2eInstallDropCompendiumFirstWrapper() {
  const SheetClass = globalThis.Add2eActorSheet;
  if (!SheetClass?.prototype?._onDrop) return false;
  if (SheetClass.prototype.__add2eDropCompendiumFirstWrapped) return true;

  const original = SheetClass.prototype._onDrop;
  SheetClass.prototype._onDrop = async function add2eDropCompendiumFirstWrapped(event) {
    let raw = null;
    try {
      raw = JSON.parse(event.dataTransfer?.getData("text/plain") || "{}");
      if (raw?.type === "Item") {
        const itemData = add2eDropResolverNormalizeThrownWeaponQuantity(
          await add2eResolveDropItemDataCompendiumFirst(raw)
        );
        if (itemData) {
          if (await add2eDropResolverMergeThrownWeapon(this.actor, itemData, raw)) return false;
          const syntheticEvent = add2eDropResolverBuildSyntheticEvent(event, raw, itemData);
          return original.call(this, syntheticEvent);
        }
      }
    } catch (err) {
      console.warn("[ADD2E][DROP][COMPENDIUM_FIRST] Résolution compendium impossible, fallback drop natif.", err);
    }
    return original.call(this, event);
  };

  SheetClass.prototype.__add2eDropCompendiumFirstWrapped = true;
  console.log("[ADD2E][DROP][COMPENDIUM_FIRST][READY]", ADD2E_DROP_COMPENDIUM_RESOLVER_VERSION);
  return true;
}

if (!add2eInstallDropCompendiumFirstWrapper()) {
  Hooks.once("ready", () => {
    if (!add2eInstallDropCompendiumFirstWrapper()) {
      setTimeout(add2eInstallDropCompendiumFirstWrapper, 250);
      setTimeout(add2eInstallDropCompendiumFirstWrapper, 1000);
    }
  });
}

try { globalThis.add2eResolveDropItemDataCompendiumFirst = add2eResolveDropItemDataCompendiumFirst; } catch (_e) {}
try { globalThis.add2eInstallDropCompendiumFirstWrapper = add2eInstallDropCompendiumFirstWrapper; } catch (_e) {}