// ADD2E — Consommables hérités : compatibilité API, projectiles et délégation composants.
// Version : 2026-06-14-legacy-consumables-delegate-components-v2
//
// Les composants de sort sont désormais toujours délégués au moteur central
// scripts/add2e/22e-consumables-core.mjs pour éviter deux mécaniques concurrentes.
// La mécanique des projectiles reste déléguée au cœur vendeur/projection.

import {
  add2eReserveSpellComponents as add2eCoreReserveSpellComponents,
  add2eRefundSpellComponents as add2eCoreRefundSpellComponents
} from "./22e-consumables-core.mjs";

const ADD2E_CONSUMABLES_VERSION = "2026-06-14-legacy-consumables-delegate-components-v2";
globalThis.ADD2E_CONSUMABLES_VERSION = ADD2E_CONSUMABLES_VERSION;

function add2eConsumablesLog(...args) {
  if (globalThis.ADD2E_DEBUG_CONSUMABLES) console.log("[ADD2E][CONSUMABLES]", ...args);
}

function add2eAsArray(value) {
  if (Array.isArray(value)) return value.filter(v => v !== null && v !== undefined && String(v).trim() !== "");
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") return value.split(/[,;|\n]+|\bet\b/gi).map(v => v.trim()).filter(Boolean);
  return [value];
}

function add2eFieldArray(value) {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eFieldArray).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["tags", "effectTags", "effecttags", "list", "items", "value", "material", "materials", "components"]) {
      if (value[key] !== undefined) return add2eFieldArray(value[key]);
    }
  }
  return add2eAsArray(value);
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
    ...add2eFieldArray(sys.tags),
    ...add2eFieldArray(sys.effectTags),
    ...add2eFieldArray(sys.effecttags),
    ...add2eFieldArray(flags.tags),
    ...add2eFieldArray(flags.effectTags),
    ...add2eFieldArray(flags.effecttags)
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
  const candidates = [actor?.type, actor?._source?.type, actor?.baseActor?.type, actor?.document?.type, actor?.parent?.actor?.type]
    .filter(v => v !== null && v !== undefined && String(v).trim() !== "");
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
  const name = add2eSlugify(item?.name);
  if (String(sys.categorie ?? "").toLowerCase() === "munition") return true;
  if (String(sys.type ?? "").toLowerCase() === "munition") return true;
  if (add2eHasTag(item, tag => {
    const t = String(tag).toLowerCase();
    return t === "munition" || t === "trait:munition" || t === "categorie:munition" || t.startsWith("munition:") || t.startsWith("projectile:");
  })) return true;
  return /\b(fleche|fleches|fleche_de|flèche|flèches|carreau|carreaux|trait|traits|bille|billes|pierre_de_fronde|pierres_de_fronde)\b/.test(name);
}

export function add2eIsSpellComponent(item) {
  if (!item) return false;
  const sys = item.system ?? {};
  const fields = [
    item.name,
    sys.nom,
    sys.categorie,
    sys.category,
    sys.sousType,
    sys.sous_type,
    sys.type,
    sys.subtype,
    sys.slug,
    sys.composantSlug,
    sys.componentSlug,
    ...add2eTagsOf(item)
  ].map(add2eSlugify).filter(Boolean);
  if (fields.some(v => v === "composant" || v === "component" || v === "composant_sort" || v === "composants_sort" || v === "composant_de_sort" || v === "spell_component" || v === "material_component")) return true;
  if (fields.some(v => v.startsWith("composant_") || v.startsWith("composant:") || v.startsWith("component_") || v.startsWith("spell_component_"))) return true;
  return false;
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
  return weaponFamilies.some(f => tags.includes(`compatible:${f}`) || tags.includes(`compatible_arme:${f}`));
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

export async function add2eConsumeProjectileReservation(_reservation) { return false; }
export async function add2eRefundProjectileReservation(_reservation) { return false; }
export async function add2eRegisterProjectileSpentInCombat(_actor, _projectile, _quantity = 1) { return false; }

export async function add2eRestoreProjectilesAtCombatEnd(combat) {
  const vendorApi = globalThis.ADD2E_VENDOR_PROJECTILES ?? game?.add2e?.vendorProjectiles;
  if (vendorApi?.recoverProjectilesForCombat) return vendorApi.recoverProjectilesForCombat(combat);
  return false;
}

function add2eCleanComponentName(value) {
  return String(value ?? "").trim()
    .replace(/[()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[.!?;:]+$/g, "")
    .replace(/^d['’]\s*/i, "")
    .replace(/^(un|une)?\s*peu\s+de\s+/i, "")
    .replace(/^(un|une|du|de la|de l['’]?|des|le|la|les)\s+/i, "")
    .replace(/^(quelques|plusieurs)\s+/i, "")
    .replace(/^petit morceau de\s+/i, "")
    .replace(/^morceau de\s+/i, "")
    .trim();
}

function add2eComponentEntry(raw, quantity = 1, consume = true) {
  const nom = add2eCleanComponentName(raw);
  if (!nom) return null;
  const text = add2eSlugify(nom).replace(/[^a-z]/g, "");
  if (["v", "s", "m", "vs", "vm", "sm", "vsm", "verbal", "somatique", "materiel", "materielle", "material"].includes(text)) return null;
  return { slug: add2eSlugify(nom), nom, quantite: Math.max(1, Number(quantity) || 1), consomme: consume !== false };
}

export function add2eResolveSpellMaterialComponents(sort) {
  const sys = sort?.system ?? {};
  const flags = sort?.flags?.add2e ?? {};
  const fields = [
    sys.composants_materiels,
    sys.composantsMateriels,
    sys.composants_requis,
    sys.composantsMateriel,
    sys.composant_materiel,
    sys.composantMateriel,
    sys.materiel,
    sys.matériel,
    sys.material,
    sys.materialComponent,
    sys.materialComponents,
    sys.material_components,
    sys.requiredComponents,
    sys.componentsRequired,
    sys.components?.material,
    sys.components?.materials,
    sys.composants_materiels_objets,
    flags.composants_requis,
    flags.composants,
    flags.components,
    flags.requiredComponents
  ];
  const components = [];
  const add = entry => {
    if (entry === null || entry === undefined || entry === "") return;
    if (Array.isArray(entry)) { for (const row of entry) add(row); return; }
    if (typeof entry === "string") {
      for (const part of add2eAsArray(entry)) {
        const alternatives = String(part).replace(/[()\[\]{}]/g, " ").split(/\bou\b/gi).map(v => v.trim()).filter(Boolean);
        if (alternatives.length > 1) {
          const clean = alternatives.map(v => add2eComponentEntry(v)).filter(Boolean);
          if (clean.length > 1) components.push({ slug: clean.map(v => v.slug).join("__or__"), nom: clean.map(v => v.nom).join(" ou "), quantite: 1, consomme: true, alternatives: clean });
          else if (clean[0]) components.push(clean[0]);
        } else {
          const c = add2eComponentEntry(part);
          if (c) components.push(c);
        }
      }
      return;
    }
    if (typeof entry === "object") {
      const alternatives = entry.alternatives ?? entry.options ?? entry.choix ?? entry.auChoix ?? entry.or;
      if (Array.isArray(alternatives) && alternatives.length) { add(alternatives); return; }
      const name = entry.nom ?? entry.name ?? entry.label ?? entry.item ?? entry.itemName ?? entry.component ?? entry.composant ?? entry.slug;
      const c = add2eComponentEntry(name, entry.quantite ?? entry.quantity ?? entry.qty ?? entry.nombre ?? entry.count ?? 1, entry.consomme ?? entry.consume ?? true);
      if (c) components.push(c);
    }
  };
  for (const field of fields) add(field);
  const unique = [];
  for (const c of components.filter(c => c.slug && c.consomme !== false)) if (!unique.some(u => u.slug === c.slug)) unique.push(c);
  const compText = String(sys.composantes ?? sys.components ?? "").toUpperCase();
  if (!unique.length && /\bM\b/.test(compText)) return [{ slug: "__manual__", nom: "Composant matériel non détaillé", quantite: 0, consomme: false, manual: true }];
  return unique;
}

export async function add2eReserveSpellComponents(actor, sort) {
  return add2eCoreReserveSpellComponents(actor, sort);
}

export async function add2eRefundSpellComponents(reservation) {
  return add2eCoreRefundSpellComponents(reservation);
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
  return add2eIsAmmunition(a) && add2eIsAmmunition(b) && String(a?.type ?? "") === String(b?.type ?? "") && add2eSlugify(a?.name) === add2eSlugify(b?.name);
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

globalThis.ADD2E_CONSUMABLES = { ...(globalThis.ADD2E_CONSUMABLES ?? {}), ...api };
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
  game.add2e.consumables = { ...(game.add2e.consumables ?? {}), ...api };
  game.add2e.consumablesVersion = ADD2E_CONSUMABLES_VERSION;
  globalThis.ADD2E_CONSUMABLES = { ...(globalThis.ADD2E_CONSUMABLES ?? {}), ...game.add2e.consumables };
  add2eConsumablesLog("ready", ADD2E_CONSUMABLES_VERSION, add2eConsumablesSettings());
});
