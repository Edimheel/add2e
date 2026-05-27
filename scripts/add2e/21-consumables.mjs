// ADD2E — Consommables : composants de sorts, projectiles et carquois
// Phase 2/3/4 dev-composant : réglages, carquois, drop de munitions, attaque projectile et restitution.

const ADD2E_CONSUMABLES_VERSION = "2026-05-26-dev-composant-phase4-projectiles-v3-dialogs";
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

function add2eDroppedQuantity(itemData) {
  const qty = add2eNumber(itemData?.system?.quantite ?? itemData?.system?.quantity ?? 1, 1);
  return Math.max(1, qty);
}

function add2eUpdatePath(path, value) {
  return { [path]: value };
}

function add2eSettingBool(key) {
  try { return !!game.settings.get("add2e", key); }
  catch (_err) { return false; }
}

async function add2eConsumablesAlert({ title = "Action impossible", message = "Action impossible.", icon = "fa-triangle-exclamation" } = {}) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  const content = `
    <div class="add2e-dialog add2e-consumable-alert" style="display:flex;gap:12px;align-items:flex-start;">
      <div style="font-size:28px;color:#8a5a00;"><i class="fas ${icon}"></i></div>
      <div>
        <h3 style="margin:0 0 6px 0;">${title}</h3>
        <p style="margin:0;">${message}</p>
      </div>
    </div>`;

  if (DialogV2?.alert) {
    try {
      await DialogV2.alert({
        window: { title },
        content,
        ok: { label: "Compris" },
        modal: true
      });
      return true;
    } catch (err) {
      console.warn("[ADD2E][CONSUMABLES][DIALOG_ALERT_ERROR]", err);
    }
  }

  ui.notifications?.warn?.(message);
  return false;
}

function add2eChangeSetsEquippedTrue(changes) {
  if (!changes) return false;
  if (changes.system?.equipee === true || changes.system?.equipped === true) return true;
  if (foundry?.utils?.hasProperty?.(changes, "system.equipee")) return foundry.utils.getProperty(changes, "system.equipee") === true;
  if (foundry?.utils?.hasProperty?.(changes, "system.equipped")) return foundry.utils.getProperty(changes, "system.equipped") === true;
  return false;
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

function add2eSameAmmunitionIdentity(a, b) {
  return add2eIsAmmunition(a)
    && add2eIsAmmunition(b)
    && String(a?.type ?? "") === String(b?.type ?? "")
    && add2eSlugify(a?.name) === add2eSlugify(b?.name);
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
    ui.notifications?.warn?.(`${projectile.name} n'est pas une munition.`);
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
  if (!add2eSettingBool("gestionProjectiles")) return null;
  const required = add2eGetWeaponRequiredAmmoType(arme);
  if (!required) return null;

  const projectile = add2eGetEquippedProjectileForWeapon(actor, arme);
  if (!projectile) return { blocked: true, message: `Aucun projectile équipé pour ${arme?.name ?? "cette arme"}.`, actor, arme, required };

  const quantity = add2eQuantity(projectile);
  if (quantity <= 0) return { blocked: true, message: `${projectile.name} : il n'en reste plus dans le carquois.`, actor, arme, projectile, required };

  return { blocked: false, actor, arme, projectile, required, quantity: 1, before: quantity };
}

export async function add2eConsumeProjectileReservation(reservation) {
  if (!reservation || reservation.blocked || !reservation.projectile) return false;
  const projectile = reservation.projectile;
  const quantity = Math.max(1, add2eNumber(reservation.quantity, 1));
  const before = add2eQuantity(projectile);
  const after = Math.max(0, before - quantity);
  await projectile.update(add2eUpdatePath("system.quantite", after), { add2eReason: "consume-projectile" });
  await add2eRegisterProjectileSpentInCombat(reservation.actor, projectile, quantity);
  return true;
}

export async function add2eRefundProjectileReservation(reservation) {
  if (!reservation || reservation.blocked || !reservation.projectile) return false;
  const projectile = reservation.projectile;
  const quantity = Math.max(1, add2eNumber(reservation.quantity, 1));
  const current = add2eQuantity(projectile);
  await projectile.update(add2eUpdatePath("system.quantite", current + quantity), { add2eReason: "refund-projectile" });
  return true;
}

function add2eProjectileRegistryKey(actor, projectile) {
  return `${actor?.id ?? "actor"}.${projectile?.id ?? "item"}`;
}

export async function add2eRegisterProjectileSpentInCombat(actor, projectile, quantity = 1) {
  if (!game.combat || !actor || !projectile) return false;
  const combat = game.combat;
  const registry = foundry.utils.deepClone(combat.getFlag("add2e", "projectilesDepenses") ?? {});
  const key = add2eProjectileRegistryKey(actor, projectile);
  const rate = projectile.system?.recuperable === false ? 0 : add2eNumber(projectile.system?.taux_recuperation, 0.6);

  const row = registry[key] ?? {
    actorId: actor.id,
    actorName: actor.name,
    itemId: projectile.id,
    itemName: projectile.name,
    ammunitionType: add2eAmmoType(projectile),
    spent: 0,
    restoreRate: rate,
    recoverable: projectile.system?.recuperable !== false
  };

  row.spent = add2eNumber(row.spent, 0) + Math.max(1, add2eNumber(quantity, 1));
  row.restoreRate = rate;
  row.recoverable = projectile.system?.recuperable !== false;
  registry[key] = row;
  await combat.setFlag("add2e", "projectilesDepenses", registry);
  return true;
}

function add2eBuildRestoreRows(combat) {
  const registry = combat?.getFlag?.("add2e", "projectilesDepenses") ?? {};
  return Object.values(registry).map(row => {
    const spent = add2eNumber(row.spent, 0);
    const rate = row.recoverable === false ? 0 : add2eNumber(row.restoreRate, 0.6);
    return { ...row, spent, restoreRate: rate, restored: Math.floor(spent * rate) };
  }).filter(row => row.spent > 0);
}

async function add2eConfirmRestoreProjectiles(rows) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.confirm) {
    ui.notifications?.warn?.("Projectiles dépensés détectés, mais DialogV2 est indisponible pour la restitution.");
    return false;
  }

  const lines = rows.map(row => `<li><strong>${row.actorName}</strong> — ${row.itemName} : ${row.spent} tiré(s) → ${row.restored} récupéré(s)</li>`).join("");
  const content = `<div class="add2e-dialog"><p>Projectiles utilisés pendant le combat :</p><ul>${lines}</ul><p>Restituer les projectiles récupérables ?</p></div>`;
  try {
    return !!await DialogV2.confirm({
      window: { title: "ADD2E — Restitution des projectiles" },
      content,
      yes: { label: "Restituer" },
      no: { label: "Ignorer" },
      modal: true
    });
  } catch (err) {
    console.warn("[ADD2E][CONSUMABLES][RESTORE_DIALOG_ERROR]", err);
    return false;
  }
}

export async function add2eRestoreProjectilesAtCombatEnd(combat) {
  if (!add2eSettingBool("gestionProjectiles")) return false;
  const rows = add2eBuildRestoreRows(combat);
  if (!rows.length) return false;
  const accepted = await add2eConfirmRestoreProjectiles(rows);
  if (!accepted) return false;

  for (const row of rows) {
    if (row.restored <= 0) continue;
    const actor = game.actors?.get(row.actorId);
    const item = actor?.items?.get(row.itemId);
    if (!item) continue;
    const current = add2eQuantity(item);
    await item.update(add2eUpdatePath("system.quantite", current + row.restored), { add2eReason: "restore-projectiles-combat-end" });
  }
  return true;
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

async function add2eTryMergeDroppedAmmunition(sheet, event) {
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
  ui.notifications?.info?.(`${existing.name} : quantité ${current} → ${current + added}.`);
  sheet.render?.(false);
  return true;
}

function add2eWrapActorSheetDropForAmmunition() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto || proto.__add2eAmmunitionDropMergeV1) return;
  if (typeof proto._onDrop !== "function") return;

  proto.__add2eAmmunitionDropMergeV1 = true;
  const originalOnDrop = proto._onDrop;
  proto._onDrop = async function add2eAmmunitionDropMerge(event) {
    const merged = await add2eTryMergeDroppedAmmunition(this, event);
    if (merged) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return true;
    }
    return originalOnDrop.call(this, event);
  };
}

function add2eProjectileHitBonus(projectile) {
  const s = projectile?.system ?? {};
  return add2eNumber(s.bonus_hit ?? s.bonus_toucher ?? s.bonusToucher ?? s.attackBonus ?? 0, 0);
}

function add2eProjectileDamageBonus(projectile) {
  const s = projectile?.system ?? {};
  return add2eNumber(s.bonus_dom ?? s.bonus_degats ?? s.bonusDégâts ?? s.damageBonus ?? 0, 0);
}

function add2ePatchWeaponBonusDuringProjectileAttack(arme, projectile) {
  const hitBonus = add2eProjectileHitBonus(projectile);
  const damageBonus = add2eProjectileDamageBonus(projectile);
  const engine = globalThis.Add2eEffectsEngine;
  const restoreFns = [];

  if (engine && typeof engine.getMagicWeaponBonus === "function") {
    const original = engine.getMagicWeaponBonus;
    engine.getMagicWeaponBonus = function add2eProjectileMagicWeaponBonus(item, kind, ...rest) {
      const base = add2eNumber(original.call(this, item, kind, ...rest), 0);
      const same = item === arme || item?.id === arme?.id || item?.uuid === arme?.uuid;
      if (!same) return base;
      const k = String(kind ?? "").toLowerCase();
      if (k.includes("hit") || k.includes("touch")) return base + hitBonus;
      if (k.includes("damage") || k.includes("dom") || k.includes("deg")) return base + damageBonus;
      return base;
    };
    restoreFns.push(() => { engine.getMagicWeaponBonus = original; });
  } else {
    const oldHit = arme?.system?.bonus_hit;
    const oldDom = arme?.system?.bonus_dom;
    try {
      arme.system.bonus_hit = add2eNumber(oldHit, 0) + hitBonus;
      arme.system.bonus_dom = add2eNumber(oldDom, 0) + damageBonus;
      restoreFns.push(() => { arme.system.bonus_hit = oldHit; arme.system.bonus_dom = oldDom; });
    } catch (err) {
      console.warn("[ADD2E][PROJECTILES][PATCH_BONUS]", err);
    }
  }

  return () => {
    for (const fn of restoreFns.reverse()) {
      try { fn(); } catch (err) { console.warn("[ADD2E][PROJECTILES][RESTORE_BONUS]", err); }
    }
  };
}

async function add2eNotifyProjectileUsed(_actor, _arme, _reservation) {
  return;
}

function add2eResolveAttackActorAndWeapon(args = {}) {
  let actor = args.actor ?? null;
  let arme = args.arme ?? null;
  if (!actor && args.actorId) actor = game.actors?.get?.(args.actorId) ?? null;
  if (!arme && args.itemId && actor) arme = actor.items?.get?.(args.itemId) ?? null;
  return { actor, arme };
}

function add2eProjectileDialogTitle(reservation) {
  if (!reservation?.projectile) return "Projectile non équipé";
  return "Carquois vide";
}

function add2eWrapAttackRollForProjectiles() {
  if (globalThis.__ADD2E_ATTACK_PROJECTILES_WRAPPED) return;
  if (typeof globalThis.add2eAttackRoll !== "function") return;
  globalThis.__ADD2E_ATTACK_PROJECTILES_WRAPPED = true;

  const originalAttackRoll = globalThis.add2eAttackRoll;
  globalThis.add2eAttackRoll = async function add2eAttackRollWithProjectiles(args = {}) {
    const { actor, arme } = add2eResolveAttackActorAndWeapon(args);
    const reservation = await add2eReserveProjectile(actor, arme);
    if (reservation?.blocked) {
      await add2eConsumablesAlert({
        title: add2eProjectileDialogTitle(reservation),
        message: reservation.message || "Projectile indisponible.",
        icon: "fa-bullseye"
      });
      return false;
    }
    if (!reservation?.projectile) return await originalAttackRoll.call(this, args);

    const restoreBonus = add2ePatchWeaponBonusDuringProjectileAttack(arme, reservation.projectile);
    let result = false;
    try { result = await originalAttackRoll.call(this, args); }
    finally { restoreBonus?.(); }

    if (result === true) {
      await add2eConsumeProjectileReservation(reservation);
      await add2eNotifyProjectileUsed(actor, arme, reservation);
    }
    return result;
  };
}

function add2eRegisterConsumableHooks() {
  if (globalThis.__ADD2E_CONSUMABLES_HOOKS_REGISTERED) return;
  globalThis.__ADD2E_CONSUMABLES_HOOKS_REGISTERED = true;

  Hooks.on("combatStart", async combat => {
    if (!add2eSettingBool("gestionProjectiles")) return;
    try { await combat.setFlag("add2e", "projectilesDepenses", {}); }
    catch (err) { console.warn("[ADD2E][CONSUMABLES][COMBAT_START]", err); }
  });

  Hooks.on("updateCombat", async (combat, changes) => {
    if (!add2eSettingBool("gestionProjectiles")) return;
    if (!changes || changes.round !== 1) return;
    if (combat.getFlag("add2e", "projectilesDepenses")) return;
    try { await combat.setFlag("add2e", "projectilesDepenses", {}); }
    catch (err) { console.warn("[ADD2E][CONSUMABLES][COMBAT_ROUND_INIT]", err); }
  });

  Hooks.on("deleteCombat", async combat => {
    if (!add2eSettingBool("gestionProjectiles")) return;
    try { await add2eRestoreProjectilesAtCombatEnd(combat); }
    catch (err) { console.warn("[ADD2E][CONSUMABLES][COMBAT_END_RESTORE]", err); }
  });

  Hooks.on("updateItem", async (item, changes, _options, userId) => {
    if (globalThis.__ADD2E_CONSUMABLES_EQUIP_GUARD) return;
    if (userId !== game.user?.id) return;
    if (!add2eIsAmmunition(item)) return;
    if (!add2eChangeSetsEquippedTrue(changes)) return;
    const actor = item.parent;
    if (!actor?.items || !actor?.updateEmbeddedDocuments) return;
    try {
      globalThis.__ADD2E_CONSUMABLES_EQUIP_GUARD = true;
      await add2eEquipProjectile(actor, item);
    } catch (err) {
      console.warn("[ADD2E][CONSUMABLES][EQUIP_PROJECTILE_HOOK]", err);
    } finally {
      globalThis.__ADD2E_CONSUMABLES_EQUIP_GUARD = false;
    }
  });
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
  add2eWrapAttackRollForProjectiles
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

Hooks.once("init", () => add2eRegisterConsumableHooks());
Hooks.once("ready", () => {
  add2eWrapActorSheetDropForAmmunition();
  add2eWrapAttackRollForProjectiles();
  game.add2e = game.add2e ?? {};
  game.add2e.consumables = api;
  game.add2e.consumablesVersion = ADD2E_CONSUMABLES_VERSION;
  add2eConsumablesLog("ready", ADD2E_CONSUMABLES_VERSION, add2eConsumablesSettings());
});
