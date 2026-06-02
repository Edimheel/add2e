// ADD2E — Consommables hérités : composants de sorts et compatibilité API
// Version : 2026-06-02-legacy-consumables-components-only-v1
//
// La mécanique des projectiles n'est plus gérée ici.
// Elle est centralisée dans scripts/add2e/22a-vendor-core.mjs afin d'éviter
// deux wrappers d'attaque, deux registres de combat et deux récupérations concurrentes.

const ADD2E_CONSUMABLES_VERSION = "2026-06-02-legacy-consumables-components-only-v1";
globalThis.ADD2E_CONSUMABLES_VERSION = ADD2E_CONSUMABLES_VERSION;

function add2eConsumablesLog(...args) {
  if (globalThis.ADD2E_DEBUG_CONSUMABLES) console.log("[ADD2E][CONSUMABLES]", ...args);
}

function add2eAsArray(value) {
  if (Array.isArray(value)) return value.filter(v => v !== null && v !== undefined && String(v).trim() !== "");
  if (value === null || value === undefined) return [];
  if (typeof value === "string") return value.split(/[,;|]/g).map(v => v.trim()).filter(Boolean);
  return [value];
}

function add2eSlugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "_")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eTagsOf(item) {
  const sys = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [
    ...add2eAsArray(sys.tags),
    ...add2eAsArray(sys.effectTags),
    ...add2eAsArray(flags.tags)
  ].map(t => String(t).trim()).filter(Boolean);
}

function add2eHasTag(item, predicate) {
  return add2eTagsOf(item).some(predicate);
}

function add2eNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function add2eQuantity(item) {
  return add2eNumber(item?.system?.quantite ?? item?.system?.quantity ?? 0, 0);
}

function add2eUpdatePath(path, value) {
  return { [path]: value };
}

function add2eSettingBool(key) {
  try { return !!game.settings.get("add2e", key); }
  catch (_err) { return false; }
}

function add2eEscapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function add2eActorDocumentType(actor) {
  const candidates = [
    actor?.type,
    actor?._source?.type,
    actor?.baseActor?.type,
    actor?.document?.type,
    actor?.parent?.actor?.type
  ].filter(v => v !== null && v !== undefined && String(v).trim() !== "");

  for (const value of candidates) {
    const type = add2eSlugify(value);
    if (type) return type;
  }
  return "";
}

function add2eActorUsesProjectileInventory(actor) {
  if (!actor) return false;
  return add2eActorDocumentType(actor) === "personnage";
}

async function add2eDialogPopup({ title = "Information", content = "", modal = false } = {}) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (DialogV2?.alert) {
    await DialogV2.alert({ window: { title }, content, ok: { label: "Compris" }, modal });
    return true;
  }
  if (DialogV2?.confirm) {
    await DialogV2.confirm({ window: { title }, content, yes: { label: "Compris" }, no: { label: "Fermer" }, modal });
    return true;
  }
  ui.notifications?.info?.(String(content).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || title);
  return false;
}

async function add2eConsumablesAlert({ title = "Action impossible", message = "Action impossible.", icon = "fa-triangle-exclamation" } = {}) {
  const content = `
    <div class="add2e-dialog add2e-consumable-alert" style="display:flex;gap:12px;align-items:flex-start;">
      <div style="font-size:28px;color:#8a5a00;"><i class="fas ${icon}"></i></div>
      <div>
        <h3 style="margin:0 0 6px 0;">${add2eEscapeHtml(title)}</h3>
        <p style="margin:0;">${add2eEscapeHtml(message)}</p>
      </div>
    </div>`;
  return add2eDialogPopup({ title, content, modal: true });
}

export function add2eConsumablesSettings() {
  return {
    gestionComposantsSorts: add2eSettingBool("gestionComposantsSorts"),
    gestionProjectiles: add2eSettingBool("gestionProjectiles")
  };
}

export function add2eIsAmmunition(item) {
  if (!item) return false;
  const sys = item.system ?? {};
  if (String(sys.categorie ?? "").toLowerCase() === "munition") return true;
  if (String(sys.type ?? "").toLowerCase() === "munition") return true;
  return add2eHasTag(item, tag => String(tag).toLowerCase() === "munition" || String(tag).toLowerCase() === "trait:munition");
}

export function add2eIsSpellComponent(item) {
  if (!item) return false;
  const sys = item.system ?? {};
  if (String(sys.categorie ?? "").toLowerCase() === "composant_sort") return true;
  if (String(sys.sousType ?? sys.sous_type ?? "").toLowerCase() === "composant") return true;
  return add2eHasTag(item, tag => String(tag).toLowerCase() === "composant_sort" || String(tag).toLowerCase().startsWith("composant:"));
}

function add2eWeaponFamily(arme) {
  const sys = arme?.system ?? {};
  const raw = sys.famille_arme ?? sys.famille ?? sys.sousType ?? sys.sous_type ?? arme?.name ?? "";
  if (Array.isArray(raw)) return raw.map(add2eSlugify);
  return [add2eSlugify(raw)];
}

export function add2eGetWeaponRequiredAmmoType(arme) {
  const sys = arme?.system ?? {};
  const explicit = sys.munition_requise ?? sys.munitionRequise ?? sys.ammoType ?? sys.ammunitionType;
  if (explicit) return add2eSlugify(explicit);

  const tag = add2eTagsOf(arme).find(t => /^munition_requise:/i.test(String(t)) || /^ammo:/i.test(String(t)));
  if (tag) return add2eSlugify(String(tag).split(":").slice(1).join(":"));

  const haystack = [arme?.name, sys.nom, sys.type_arme, sys.categorie, sys.sousType, sys.sous_type, ...add2eWeaponFamily(arme), ...add2eTagsOf(arme)].join(" ").toLowerCase();
  if (/sarbacane/.test(haystack)) return "aiguille";
  if (/fronde/.test(haystack)) return "bille";
  if (/arquebuse|arme_a_feu|arme a feu/.test(haystack)) return "balle_arquebuse";
  if (/arbalete|arbalète/.test(haystack)) return "carreau";
  if (/\barc\b/.test(haystack)) return "fleche";
  return "";
}

function add2eAmmoType(item) {
  const sys = item?.system ?? {};
  return add2eSlugify(sys.munitionType ?? sys.munition_type ?? sys.sousType ?? sys.sous_type ?? sys.categorie ?? item?.name ?? "");
}

function add2eAmmoCompatibleWithRequired(item, required, arme = null) {
  if (!required) return false;
  const requiredSlug = add2eSlugify(required);
  const ammoType = add2eAmmoType(item);
  if (ammoType === requiredSlug) return true;
  if (requiredSlug === "carreau" && ammoType.startsWith("carreau")) return true;
  if (requiredSlug === "fleche" && ammoType.startsWith("fleche")) return true;
  if (requiredSlug === "bille" && ammoType.startsWith("bille")) return true;
  if (requiredSlug === "aiguille" && ammoType.includes("aiguille")) return true;

  const sys = item?.system ?? {};
  const compat = add2eAsArray(sys.compatibleArmes ?? sys.compatible_armes ?? sys.compatibleMunition ?? sys.compatible_munition).map(add2eSlugify);
  if (compat.includes(requiredSlug)) return true;

  const tags = add2eTagsOf(item).map(t => String(t).toLowerCase());
  if (tags.includes(`munition:${requiredSlug}`) || tags.includes(`compatible_munition:${requiredSlug}`) || tags.includes(`compatible:${requiredSlug}`)) return true;

  const weaponFamilies = add2eWeaponFamily(arme);
  if (weaponFamilies.some(f => tags.includes(`compatible:${f}`) || tags.includes(`compatible_arme:${f}`))) return true;
  return false;
}

export function add2eGetCompatibleProjectiles(actor, arme) {
  const required = add2eGetWeaponRequiredAmmoType(arme);
  if (!actor || !required) return [];
  return Array.from(actor.items ?? []).filter(item => add2eIsAmmunition(item) && add2eAmmoCompatibleWithRequired(item, required, arme));
}

export function add2eGetEquippedProjectileForWeapon(actor, arme) {
  const projectiles = add2eGetCompatibleProjectiles(actor, arme);
  return projectiles.find(p => p.system?.equipee === true || p.system?.equipped === true) ?? null;
}

export async function add2eEquipProjectile(actor, projectile) {
  if (!actor || !projectile) return false;
  if (!add2eIsAmmunition(projectile)) {
    await add2eConsumablesAlert({ title: "Munition invalide", message: `${projectile.name} n'est pas une munition.`, icon: "fa-bullseye" });
    return false;
  }

  const ammoType = add2eAmmoType(projectile);
  const updates = [];
  for (const item of actor.items ?? []) {
    if (!add2eIsAmmunition(item)) continue;
    if (add2eAmmoType(item) !== ammoType) continue;
    const expected = item.id === projectile.id;
    if (item.system?.equipee !== expected) updates.push({ _id: item.id, "system.equipee": expected });
  }

  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates, { add2eReason: "equip-projectile" });
  ui.notifications?.info?.(`${projectile.name} équipé dans le carquois.`);
  return true;
}

export async function add2eReserveProjectile(actor, arme) {
  const vendorApi = globalThis.ADD2E_VENDOR_PROJECTILES ?? game?.add2e?.vendorProjectiles;
  if (vendorApi?.spendProjectileForAttack) return vendorApi.spendProjectileForAttack({ actor, arme });
  return { ok: true, required: false, spent: 0, delegated: false };
}

export async function add2eConsumeProjectileReservation(_reservation) {
  return false;
}

export async function add2eRefundProjectileReservation(_reservation) {
  return false;
}

export async function add2eRegisterProjectileSpentInCombat(_actor, _projectile, _quantity = 1) {
  return false;
}

export async function add2eRestoreProjectilesAtCombatEnd(combat) {
  const vendorApi = globalThis.ADD2E_VENDOR_PROJECTILES ?? game?.add2e?.vendorProjectiles;
  if (vendorApi?.recoverProjectilesForCombat) return vendorApi.recoverProjectilesForCombat(combat);
  return false;
}

export function add2eResolveSpellMaterialComponents(sort) {
  const sys = sort?.system ?? {};
  const list = sys.composants_materiels ?? sys.composantsMateriels ?? sys.materialComponents ?? [];
  const components = add2eAsArray(list).map(entry => {
    if (typeof entry === "string") return { slug: add2eSlugify(entry), nom: entry, quantite: 1, consomme: true };
    const name = entry?.nom ?? entry?.name ?? entry?.label ?? entry?.slug ?? "Composant matériel";
    return {
      slug: add2eSlugify(entry?.slug ?? name),
      nom: String(name),
      quantite: Math.max(1, add2eNumber(entry?.quantite ?? entry?.quantity ?? 1, 1)),
      consomme: entry?.consomme !== false && entry?.consume !== false
    };
  }).filter(c => c.slug && c.consomme !== false);

  const compText = String(sys.composantes ?? sys.components ?? "").toUpperCase();
  if (!components.length && /\bM\b/.test(compText)) return [{ slug: "__manual__", nom: "Composant matériel non détaillé", quantite: 0, consomme: false, manual: true }];
  return components;
}

function add2eFindSpellComponentItem(actor, component) {
  if (!actor || !component || component.manual) return null;
  const slug = add2eSlugify(component.slug ?? component.nom);
  return Array.from(actor.items ?? []).find(item => {
    if (!add2eIsSpellComponent(item)) return false;
    const itemSlug = add2eSlugify(item.system?.slug ?? item.system?.composantSlug ?? item.name);
    if (itemSlug === slug) return true;
    return add2eTagsOf(item).some(tag => add2eSlugify(String(tag).replace(/^composant:/i, "")) === slug);
  }) ?? null;
}

export async function add2eReserveSpellComponents(actor, sort) {
  if (!add2eSettingBool("gestionComposantsSorts")) return null;
  const components = add2eResolveSpellMaterialComponents(sort);
  const detailed = components.filter(c => !c.manual && c.consomme !== false && c.quantite > 0);
  if (!detailed.length) return { blocked: false, actor, sort, components, reservations: [], manualOnly: components.some(c => c.manual) };

  const reservations = [];
  const missing = [];
  for (const component of detailed) {
    const item = add2eFindSpellComponentItem(actor, component);
    const available = add2eQuantity(item);
    if (!item || available < component.quantite) {
      missing.push(`${component.nom} x${component.quantite}`);
      continue;
    }
    reservations.push({ component, item, quantity: component.quantite, before: available });
  }

  if (missing.length) {
    const message = `Composant(s) manquant(s) : ${missing.join(", ")}.`;
    await add2eConsumablesAlert({ title: "Composant manquant", message, icon: "fa-pouch" });
    return { blocked: true, actor, sort, components, reservations: [], message };
  }

  for (const reservation of reservations) {
    await reservation.item.update(add2eUpdatePath("system.quantite", reservation.before - reservation.quantity), { add2eReason: "consume-spell-component" });
  }
  return { blocked: false, actor, sort, components, reservations };
}

export async function add2eRefundSpellComponents(reservation) {
  if (!reservation?.reservations?.length) return false;
  for (const row of reservation.reservations) {
    const item = row.item;
    if (!item) continue;
    const current = add2eQuantity(item);
    await item.update(add2eUpdatePath("system.quantite", current + row.quantity), { add2eReason: "refund-spell-component" });
  }
  return true;
}

async function add2eConsumablesResolveDropItemData(raw) {
  let itemData = raw?.data ?? null;
  if (!itemData && raw?.uuid) {
    const doc = await fromUuid(raw.uuid);
    if (doc instanceof Item) itemData = doc.toObject();
  }
  if (!itemData && raw?.pack && raw?.id) {
    const pack = game.packs.get(raw.pack);
    const ent = pack && await pack.getDocument(raw.id);
    if (ent instanceof Item) itemData = ent.toObject();
  }
  if (!itemData && raw?.pack && raw?._id) {
    const pack = game.packs.get(raw.pack);
    const ent = pack && await pack.getDocument(raw._id);
    if (ent instanceof Item) itemData = ent.toObject();
  }
  return itemData;
}

function add2eSameAmmunitionIdentity(a, b) {
  return add2eIsAmmunition(a)
    && add2eIsAmmunition(b)
    && String(a?.type ?? "") === String(b?.type ?? "")
    && add2eSlugify(a?.name) === add2eSlugify(b?.name);
}

function add2eDroppedQuantity(itemData) {
  const qty = add2eNumber(itemData?.system?.quantite ?? itemData?.system?.quantity ?? 1, 1);
  return Math.max(1, qty);
}

export async function add2eTryMergeDroppedAmmunition(sheet, event) {
  if (!sheet?.actor) return false;

  let raw;
  try { raw = JSON.parse(event?.dataTransfer?.getData("text/plain") || "{}"); }
  catch (_err) { return false; }

  if (raw?.type !== "Item") return false;
  const itemData = await add2eConsumablesResolveDropItemData(raw);
  if (!itemData || !add2eIsAmmunition(itemData)) return false;

  const existing = Array.from(sheet.actor.items ?? []).find(item => add2eSameAmmunitionIdentity(item, itemData)) ?? null;
  if (!existing) return false;

  const current = add2eQuantity(existing);
  const added = add2eDroppedQuantity(itemData);
  await existing.update({ "system.quantite": current + added }, { add2eReason: "merge-ammunition-drop" });
  ui.notifications?.info?.(`${existing.name} : +${added} ajouté(s) au carquois.`);
  return true;
}

function add2eWrapActorSheetDropForAmmunition() {
  if (globalThis.__ADD2E_CONSUMABLES_DROP_WRAP_V1) return;
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto || typeof proto._onDrop !== "function") return;
  globalThis.__ADD2E_CONSUMABLES_DROP_WRAP_V1 = true;

  const original = proto._onDrop;
  proto._onDrop = async function add2eConsumablesDropWrapper(event, ...args) {
    if (await add2eTryMergeDroppedAmmunition(this, event)) return false;
    return original.call(this, event, ...args);
  };
}

function add2eWrapAttackRollForProjectiles() {
  globalThis.__ADD2E_ATTACK_PROJECTILES_WRAPPED = "disabled-in-21-consumables-use-22a-vendor-core";
  return false;
}

const api = {
  version: ADD2E_CONSUMABLES_VERSION,
  add2eConsumablesSettings,
  add2eIsAmmunition,
  add2eIsSpellComponent,
  add2eGetWeaponRequiredAmmoType,
  add2eGetCompatibleProjectiles,
  add2eGetEquippedProjectileForWeapon,
  add2eEquipProjectile,
  add2eReserveProjectile,
  add2eConsumeProjectileReservation,
  add2eRefundProjectileReservation,
  add2eRegisterProjectileSpentInCombat,
  add2eRestoreProjectilesAtCombatEnd,
  add2eResolveSpellMaterialComponents,
  add2eReserveSpellComponents,
  add2eRefundSpellComponents,
  add2eTryMergeDroppedAmmunition,
  add2eWrapAttackRollForProjectiles,
  add2eActorUsesProjectileInventory,
  add2eActorDocumentType
};

globalThis.ADD2E_CONSUMABLES = api;
globalThis.add2eGetCompatibleProjectiles = add2eGetCompatibleProjectiles;
globalThis.add2eGetEquippedProjectileForWeapon = add2eGetEquippedProjectileForWeapon;
globalThis.add2eEquipProjectile = add2eEquipProjectile;
globalThis.add2eReserveProjectile = add2eReserveProjectile;
globalThis.add2eConsumeProjectileReservation = add2eConsumeProjectileReservation;
globalThis.add2eReserveSpellComponents = add2eReserveSpellComponents;
globalThis.add2eRefundSpellComponents = add2eRefundSpellComponents;
globalThis.add2eTryMergeDroppedAmmunition = add2eTryMergeDroppedAmmunition;
globalThis.add2eActorUsesProjectileInventory = add2eActorUsesProjectileInventory;
globalThis.add2eActorDocumentType = add2eActorDocumentType;

Hooks.once("ready", () => {
  add2eWrapActorSheetDropForAmmunition();
  game.add2e = game.add2e ?? {};
  game.add2e.consumables = api;
  game.add2e.consumablesVersion = ADD2E_CONSUMABLES_VERSION;
  add2eConsumablesLog("ready", ADD2E_CONSUMABLES_VERSION, add2eConsumablesSettings());
});
