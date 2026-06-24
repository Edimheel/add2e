// ADD2E — Consommables hérités : compatibilité API, projectiles et délégation composants.
// Version : 2026-06-24-projectile-exclusive-thrown-weapon-v3
//
// Les composants de sort sont désormais toujours délégués au moteur central
// scripts/add2e/22e-consumables-core.mjs pour éviter deux mécaniques concurrentes.
// La mécanique des projectiles reste déléguée au cœur vendeur/projection.

import {
  add2eReserveSpellComponents as add2eCoreReserveSpellComponents,
  add2eRefundSpellComponents as add2eCoreRefundSpellComponents
} from "./22e-consumables-core.mjs";

const ADD2E_CONSUMABLES_VERSION = "2026-06-24-projectile-exclusive-thrown-weapon-v3";
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

function add2eUsageTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
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

function add2eWeaponStackQuantity(item) {
  const value = item?.system?.quantite ?? item?.system?.quantity;
  if (value === undefined || value === null || value === "") return 1;
  return Math.max(0, Math.floor(add2eNumber(value, 0)));
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

  const updates = [];
  for (const item of actor.items ?? []) {
    if (!add2eIsAmmunition(item)) continue;
    const expected = item.id === projectile.id;
    if (item.system?.equipee !== expected) updates.push({ _id: item.id, "system.equipee": expected });
  }

  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates, { add2eReason: "equip-exclusive-projectile" });
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

export async function add2eRegisterProjectileSpentInCombat(actor, projectile, quantity = 1) {
  const vendorApi = globalThis.ADD2E_VENDOR_PROJECTILES ?? game?.add2e?.vendorProjectiles;
  if (!vendorApi?.recordProjectileSpent) return false;
  return vendorApi.recordProjectileSpent({ actor, projectile, quantity: Math.max(1, Math.floor(add2eNumber(quantity, 1))) });
}

export async function add2eConsumeThrownWeapon(actor, weapon, quantity = 1) {
  if (!actor || !weapon) return { ok: false, reason: "missing" };
  if (!add2eActorUsesProjectileInventory(actor)) return { ok: true, ignored: true, spent: 0 };

  const spent = Math.max(1, Math.floor(add2eNumber(quantity, 1)));
  const available = add2eWeaponStackQuantity(weapon);
  if (available < spent) {
    await add2eConsumablesAlert({
      title: "Arme de lancer indisponible",
      message: `${weapon.name} n'est plus disponible pour être lancée.`,
      icon: "fa-hand"
    });
    return { ok: false, reason: "empty", spent: 0 };
  }

  const remaining = Math.max(0, available - spent);
  await weapon.update({
    "system.quantite": remaining,
    "system.equipee": remaining > 0 ? weapon.system?.equipee === true : false
  }, { add2eReason: "thrown-weapon-spent" });

  await add2eRegisterProjectileSpentInCombat(actor, weapon, spent);
  return { ok: true, spent, remaining };
}

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

function add2eWeaponUsageTags(weapon) {
  return new Set(add2eTagsOf(weapon).map(add2eUsageTag).filter(Boolean));
}

function add2eWeaponHasThrownMode(weapon) {
  if (!weapon || !["arme", "weapon"].includes(String(weapon.type ?? "").toLowerCase())) return false;
  const sys = weapon.system ?? {};
  const tags = add2eWeaponUsageTags(weapon);
  return !!(
    sys.arme_de_jet === true ||
    sys.armeDeJet === true ||
    sys.isThrown === true ||
    Number(sys.portee_courte ?? sys.porteeCourte ?? 0) > 0 ||
    Number(sys.portee_moyenne ?? sys.porteeMoyenne ?? 0) > 0 ||
    Number(sys.portee_longue ?? sys.porteeLongue ?? 0) > 0 ||
    ["usage:lancer", "usage:jet", "usage:arme_de_jet", "categorie:projectile_lance", "trait:arme_de_jet", "type:arme_de_jet"].some(tag => tags.has(tag))
  );
}

function add2eWeaponHasContactMode(weapon) {
  if (!weapon || !["arme", "weapon"].includes(String(weapon.type ?? "").toLowerCase())) return false;
  const sys = weapon.system ?? {};
  const tags = add2eWeaponUsageTags(weapon);
  const explicitContact = !!(
    sys.arme_de_contact === true ||
    sys.armeDeContact === true ||
    sys.isMelee === true ||
    sys.corps_a_corps === true ||
    ["usage:corps_a_corps", "usage:contact", "categorie:corps_a_corps", "categorie:contact", "categorie:melee", "type:corps_a_corps", "type:contact", "type:melee"].some(tag => tags.has(tag))
  );
  if (explicitContact) return true;
  if (!add2eWeaponHasThrownMode(weapon)) return true;
  return !add2eGetWeaponRequiredAmmoType(weapon);
}

function add2eIsHybridThrownWeapon(weapon) {
  return add2eWeaponHasThrownMode(weapon) && add2eWeaponHasContactMode(weapon);
}

function add2eIsPureDistanceWeapon(weapon) {
  return add2eWeaponHasThrownMode(weapon) && !add2eWeaponHasContactMode(weapon);
}

async function add2ePromptThrownWeaponMode(weapon) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications?.error?.("DialogV2 est indisponible pour choisir le mode d'attaque.");
    return null;
  }

  const name = add2eEscapeHtml(weapon?.name ?? "Arme");
  const image = add2eEscapeHtml(weapon?.img ?? "icons/svg/sword.svg");
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

async function add2eRestoreHybridWeaponEquipment(actor, itemId, beforeEquipped) {
  const hybrid = actor?.items?.get?.(itemId) ?? null;
  if (!hybrid?.system?.equipee) return false;

  const updates = [];
  for (const weapon of actor.items ?? []) {
    if (!weapon || weapon.id === hybrid.id || !["arme", "weapon"].includes(String(weapon.type ?? "").toLowerCase())) continue;

    if (add2eWeaponHasContactMode(weapon)) {
      if (weapon.system?.equipee === true) updates.push({ _id: weapon.id, "system.equipee": false });
      continue;
    }

    if (beforeEquipped?.has?.(weapon.id) && add2eIsPureDistanceWeapon(weapon) && weapon.system?.equipee !== true) {
      updates.push({ _id: weapon.id, "system.equipee": true });
    }
  }

  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates, { add2eReason: "hybrid-thrown-weapon-equipment" });
  return updates.length > 0;
}

function add2eInstallProjectileEquipmentBridge() {
  const original = globalThis.handleItemAction;
  if (typeof original !== "function" || original.__add2eProjectileEquipmentBridge === true) return false;

  const guarded = async function add2eHandleItemActionWithProjectileBridge(args = {}) {
    const actor = args?.actor ?? null;
    const action = String(args?.action ?? "").toLowerCase();
    const item = actor?.items?.get?.(args?.itemId) ?? null;

    if (action === "equip" && actor && item && add2eIsAmmunition(item)) {
      if (item.system?.equipee === true) {
        await item.update({ "system.equipee": false }, { add2eReason: "unequip-projectile" });
      } else {
        await add2eEquipProjectile(actor, item);
      }
      args?.sheet?._add2eRememberActiveTab?.();
      args?.sheet?.render?.(false);
      return true;
    }

    const hybridEquipment = action === "equip" && actor && item && !item.system?.equipee && add2eIsHybridThrownWeapon(item);
    const beforeEquipped = hybridEquipment
      ? new Set(Array.from(actor.items ?? []).filter(entry => entry?.system?.equipee === true).map(entry => entry.id))
      : null;

    const result = await original.call(this, args);
    if (hybridEquipment) await add2eRestoreHybridWeaponEquipment(actor, item.id, beforeEquipped);
    return result;
  };

  guarded.__add2eProjectileEquipmentBridge = true;
  guarded.__add2eProjectileEquipmentOriginal = original;
  globalThis.handleItemAction = guarded;
  return true;
}

function add2eInstallThrownWeaponAttackBridge() {
  const original = globalThis.add2eAttackRoll;
  if (typeof original !== "function" || original.__add2eThrownWeaponAttackBridge === true) return false;

  const guarded = async function add2eAttackRollWithThrownWeaponModes(args = {}) {
    const actor = args.actor ?? (args.actorId ? game.actors?.get?.(args.actorId) : null);
    const weapon = args.arme ?? (actor && args.itemId ? actor.items?.get?.(args.itemId) : null);
    if (!actor || !weapon || !add2eIsHybridThrownWeapon(weapon)) return original.call(this, args);

    const mode = await add2ePromptThrownWeaponMode(weapon);
    if (!mode) return false;

    if (mode === "throw" && add2eActorUsesProjectileInventory(actor) && add2eWeaponStackQuantity(weapon) <= 0) {
      await add2eConsumablesAlert({
        title: "Arme de lancer indisponible",
        message: `${weapon.name} n'est plus disponible pour être lancée.`,
        icon: "fa-hand"
      });
      return false;
    }

    const attackArgs = mode === "contact"
      ? { ...args, actor, arme: add2eWeaponForContactAttack(weapon) }
      : { ...args, actor, arme: weapon };
    const result = await original.call(this, attackArgs);

    if (result === true && mode === "throw") await add2eConsumeThrownWeapon(actor, weapon, 1);
    return result;
  };

  guarded.__add2eThrownWeaponAttackBridge = true;
  guarded.__add2eThrownWeaponAttackOriginal = original;
  globalThis.add2eAttackRoll = guarded;
  return true;
}

function add2eInstallConsumableRuntimeBridges() {
  add2eInstallProjectileEquipmentBridge();
  add2eInstallThrownWeaponAttackBridge();
}

function add2eWrapAttackRollForProjectiles() {
  globalThis.__ADD2E_ATTACK_PROJECTILES_WRAPPED = "delegated-to-22a-vendor-core-and-thrown-weapon-bridge";
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
  add2eConsumeThrownWeapon,
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
globalThis.add2eRegisterProjectileSpentInCombat = add2eRegisterProjectileSpentInCombat;
globalThis.add2eConsumeThrownWeapon = add2eConsumeThrownWeapon;
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
  window.setTimeout(add2eInstallConsumableRuntimeBridges, 0);
  window.setTimeout(add2eInstallConsumableRuntimeBridges, 100);
  add2eConsumablesLog("ready", ADD2E_CONSUMABLES_VERSION, add2eConsumablesSettings());
});