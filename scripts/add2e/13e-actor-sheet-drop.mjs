// ADD2E — Actor sheet drop — chargeur court
// Version : 2026-06-16-actor-drop-anywhere-projectile-normalize-v1
//
// Le contenu historique est conservé dans 13e-actor-sheet-drop-legacy-full.mjs.
// Ce fichier garde le point d'intégration du drop acteur et ajoute les correctifs ciblés.

import "./13e-actor-sheet-drop-legacy-full.mjs";

const ADD2E_ACTOR_SHEET_DROP_PATCH_VERSION = "2026-06-16-actor-drop-anywhere-projectile-normalize-v1";
globalThis.ADD2E_ACTOR_SHEET_DROP_PATCH_VERSION = ADD2E_ACTOR_SHEET_DROP_PATCH_VERSION;

function add2eDropPatchClone(value) {
  if (value === undefined || value === null) return value;
  try { return foundry.utils.deepClone(value); } catch (_e) {}
  try { return foundry.utils.duplicate(value); } catch (_e) {}
  return JSON.parse(JSON.stringify(value));
}

function add2eDropPatchArray(value) {
  if (Array.isArray(value)) return value.flatMap(add2eDropPatchArray).filter(v => v !== null && v !== undefined && String(v).trim() !== "");
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") return Object.values(value).flatMap(add2eDropPatchArray).filter(v => v !== null && v !== undefined && String(v).trim() !== "");
  return [value];
}

function add2eDropPatchSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eDropPatchTextFields(itemData) {
  const sys = itemData?.system ?? {};
  const flags = itemData?.flags?.add2e ?? {};
  return [
    itemData?.type,
    itemData?.name,
    sys.nom,
    sys.categorie,
    sys.category,
    sys.type,
    sys.sousType,
    sys.sous_type,
    sys.subtype,
    sys.kind,
    sys.slot,
    sys.type_arme,
    sys.famille_arme,
    sys.munitionType,
    sys.munition_type,
    sys.tags,
    sys.effectTags,
    sys.effecttags,
    flags.tags,
    flags.effectTags,
    flags.effecttags,
    flags.kind,
    flags.vendorKind,
    flags.category,
    flags.categorie,
    flags.type,
    flags.sousType,
    flags.sous_type
  ].flatMap(add2eDropPatchArray).map(add2eDropPatchSlug).filter(Boolean);
}

function add2eDropPatchAmmoName(value) {
  const text = add2eDropPatchSlug(value);
  return /(^|_)(fleche|fleches|carreau|carreaux|trait|traits|bille|billes|pierre_de_fronde|pierres_de_fronde)(_|$)/.test(text);
}

function add2eDropPatchAmmoType(itemData) {
  const fields = add2eDropPatchTextFields(itemData);
  const joined = fields.join(" ");
  const explicit = add2eDropPatchSlug(itemData?.system?.munitionType ?? itemData?.system?.munition_type ?? itemData?.system?.sousType ?? itemData?.system?.sous_type ?? "");
  if (explicit && !["munition", "munitions", "projectile", "projectiles"].includes(explicit)) return explicit;
  if (/(^|_)(carreau|carreaux)(_|$)/.test(joined)) return "carreau";
  if (/(^|_)(bille|billes|pierre_de_fronde|pierres_de_fronde)(_|$)/.test(joined)) return "bille";
  if (/(^|_)(trait|traits)(_|$)/.test(joined)) return "trait";
  if (/(^|_)(fleche|fleches)(_|$)/.test(joined)) return "fleche";
  return "projectile";
}

function add2eDropPatchIsThrownWeapon(itemData) {
  if (String(itemData?.type ?? "").toLowerCase() !== "arme") return false;
  if (add2eDropPatchAmmoName(itemData?.name)) return false;
  const sys = itemData?.system ?? {};
  const fields = add2eDropPatchTextFields(itemData);
  const name = add2eDropPatchSlug(itemData?.name);
  return sys.arme_de_jet === true
    || sys.jet === true
    || fields.some(field => ["arme_de_jet", "usage_lancer", "usage:lancer", "usage_jet", "arme:jet", "type_arme:jet", "type_arme:arme_de_jet"].includes(field))
    || /(dague|poignard|javelot|javeline|hache_de_jet|marteau_de_jet|couteau_de_jet|lance)/.test(name);
}

function add2eDropPatchLooksLikeProjectile(itemData) {
  if (!itemData) return false;
  const documentType = String(itemData.type ?? "").toLowerCase();
  if (!["arme", "objet"].includes(documentType)) return false;
  if (add2eDropPatchIsThrownWeapon(itemData)) return false;
  const fields = add2eDropPatchTextFields(itemData);
  if (add2eDropPatchAmmoName(itemData.name)) return true;
  return fields.some(field =>
    field === "munition" ||
    field === "munitions" ||
    field === "projectile" ||
    field === "projectiles" ||
    field === "ammo" ||
    field === "ammunition" ||
    field === "trait:munition" ||
    field === "trait:projectile" ||
    field === "categorie:munition" ||
    field === "categorie:projectile" ||
    field === "type:munition" ||
    field === "type:projectile" ||
    field.startsWith("munition:") ||
    field.startsWith("projectile:")
  );
}

async function add2eDropPatchResolveRawItemData(event) {
  let raw = null;
  try { raw = JSON.parse(event?.dataTransfer?.getData("text/plain") || "{}"); }
  catch (_e) { return null; }
  if (raw?.type !== "Item") return null;

  try {
    if (raw.pack && raw.id) {
      const pack = game.packs.get(raw.pack);
      const doc = pack ? await pack.getDocument(raw.id) : null;
      if (doc instanceof Item) return doc.toObject();
    }
    if (raw.uuid) {
      const doc = await fromUuid(raw.uuid);
      if (doc instanceof Item) return doc.toObject();
    }
  } catch (_e) {}

  return raw.data ?? null;
}

async function add2eDropPatchNormalizeProjectileOnActor(actor, sourceData) {
  if (!actor || !add2eDropPatchLooksLikeProjectile(sourceData)) return false;
  const name = String(sourceData?.name ?? "").trim();
  if (!name) return false;

  const sourceType = String(sourceData?.type ?? "").toLowerCase();
  const item = [...(actor.items ?? [])].reverse().find(candidate =>
    String(candidate.name ?? "").trim() === name &&
    String(candidate.type ?? "").toLowerCase() === sourceType
  ) ?? [...(actor.items ?? [])].reverse().find(candidate => String(candidate.name ?? "").trim() === name);

  if (!item) return false;

  const ammoType = add2eDropPatchAmmoType(sourceData);
  const currentTags = new Set([
    ...add2eDropPatchArray(item.system?.tags),
    ...add2eDropPatchArray(item.flags?.add2e?.tags),
    "munition",
    "projectile",
    "trait:munition",
    `munition:${ammoType}`,
    `projectile:${ammoType}`
  ].map(String).filter(Boolean));

  const update = {
    "system.categorie": "munition",
    "system.category": "munition",
    "system.type": "munition",
    "system.sousType": ammoType,
    "system.sous_type": ammoType,
    "system.munitionType": ammoType,
    "system.munition_type": ammoType,
    "system.tags": [...currentTags],
    "flags.add2e.kind": "projectile",
    "flags.add2e.vendorKind": "projectile",
    "flags.add2e.category": "munition",
    "flags.add2e.projectile": true,
    "flags.add2e.ammunition": true,
    "flags.add2e.tags": [...currentTags]
  };

  await item.update(update, { add2eInternal: true, add2eDropProjectileNormalize: true, render: false });
  return true;
}

function add2eDropPatchGetRoot(sheet) {
  const element = sheet?.element;
  if (!element) return null;
  return element.jquery ? element[0] : element;
}

function add2eDropPatchIsItemDrag(event) {
  try {
    const raw = JSON.parse(event?.dataTransfer?.getData("text/plain") || "{}");
    return raw?.type === "Item";
  } catch (_e) {
    return false;
  }
}

function add2eDropPatchBindAnywhere(sheet) {
  const root = add2eDropPatchGetRoot(sheet);
  if (!root || root.dataset.add2eDropAnywhereBound === "1") return;
  root.dataset.add2eDropAnywhereBound = "1";

  root.addEventListener("dragover", event => {
    if (!add2eDropPatchIsItemDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, true);

  root.addEventListener("drop", async event => {
    if (!add2eDropPatchIsItemDrag(event)) return;
    if (event.__add2eDropAnywhereHandled) return;
    event.__add2eDropAnywhereHandled = true;
    event.preventDefault();
    event.stopPropagation();
    await sheet._onDrop(event);
  }, true);
}

(function installAdd2eDropPatch() {
  const cls = globalThis.Add2eActorSheet;
  if (!cls?.prototype || cls.prototype.__add2eDropPatchV1) return;
  cls.prototype.__add2eDropPatchV1 = true;

  const previousOnDrop = cls.prototype._onDrop;
  cls.prototype._onDrop = async function add2ePatchedOnDrop(event) {
    const sourceData = await add2eDropPatchResolveRawItemData(event);
    const result = await previousOnDrop.call(this, event);
    if (result) {
      await add2eDropPatchNormalizeProjectileOnActor(this.actor ?? this.document, sourceData);
      try { this.render(false); } catch (_e) {}
    }
    return result;
  };

  const previousOnRender = cls.prototype._onRender;
  cls.prototype._onRender = async function add2ePatchedOnRender(context, options = {}) {
    const result = await previousOnRender.call(this, context, options);
    add2eDropPatchBindAnywhere(this);
    return result;
  };
})();

console.log("[ADD2E][DROP][PATCH]", ADD2E_ACTOR_SHEET_DROP_PATCH_VERSION);
