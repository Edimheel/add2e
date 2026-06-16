/**
 * scripts/add2e.mjs
 * Point d'entrée ADD2E.
 * Fichier découpé en modules dans scripts/add2e/*.mjs.
 */
import "./add2e-initiative.mjs";
import "./add2e/00-legacy-global-helpers.mjs";
import "./add2e/spell-dialog-ui.mjs";
import "./add2e/item-sheet-registration.mjs";
import "./add2e/handlebars-helpers.mjs";
import "./add2e/character-sheet-templates.mjs";
import "./add2e/monster-sheet-capabilities.mjs";
import "./add2e/01-macros-base-caracs.mjs";
import "./add2e/02-spell-sync.mjs";
import "./add2e/02b-spell-sync-dedupe.mjs";
import "./add2e/03-equipment-rules.mjs";
import "./add2e/04-class-active-abilities.mjs";
import "./add2e/object-magic-powers.mjs";
import "./add2e/06-class-effects-thief.mjs";
import "./add2e/07-spellcasting-rules.mjs";
import "./add2e/09-race-class-drop.mjs";
import "./add2e/10-monk-rules.mjs";
import "./add2e/11-character-data-prep.mjs";
import "./add2e/12-carac-roller.mjs";
import "./add2e/13-actor-sheet-legacy.mjs";
import "./add2e/14-item-sheets.mjs";
import "./add2e/15-validation-sockets.mjs";
import "./add2e/16-preparation-display.mjs";
import "./add2e/17-movement-xp.mjs";
import "./add2e/17b-multiclass.mjs";
import "./add2e/17c-multiclass-mechanics.mjs";
import "./add2e/18-token-state-overlay.mjs";
import "./add2e/20-session-xp.mjs";
import "./add2e/21-consumables.mjs";
import "./add2e/24-player-trades.mjs";

const ADD2E_HUD_EQUIPMENT_TABS_PATCH_VERSION = "2026-06-16-hud-equipment-tabs-v53-patch";
const ADD2E_HUD_ID = "add2e-action-hud";
const ADD2E_HUD_PATCH_STYLE_ID = "add2e-action-hud-equipment-tabs-patch-style";
let add2eHudPatchObserver = null;
let add2eHudPatchActiveTab = null;
let add2eHudPatchBusy = false;

function add2eHudEsc(value) {
  try { return foundry.utils.escapeHTML(String(value ?? "")); }
  catch (_e) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
}
function add2eHudArr(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eHudArr);
  if (value instanceof Set) return [...value];
  if (typeof value?.values === "function") return [...value.values()];
  if (typeof value === "object") return Object.values(value);
  return [value];
}
function add2eHudLower(value) { return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function add2eHudNorm(value) { return add2eHudLower(value).replace(/[’']/g, "").replace(/[^a-z0-9:_-]+/g, "_").replace(/^_|_$/g, ""); }
function add2eHudNum(value, fallback = 0) {
  if (typeof value === "string") {
    const match = value.match(/-?\d+(?:[.,]\d+)?/);
    if (!match) return fallback;
    value = match[0].replace(",", ".");
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
function add2eHudSlug(value) { return add2eHudLower(value).replace(/[’']/g, "_").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
function add2eHudActorItems(actor) { return Array.from(actor?.items ?? []).filter(item => item && item.type); }
function add2eHudGetItem(actor, id) { return actor?.items?.get?.(id) ?? add2eHudActorItems(actor).find(item => item.id === id || item._id === id) ?? null; }
function add2eHudItemEquipped(item) {
  const system = item?.system ?? {};
  return system.equipee === true || system.equipped === true || system.portee === true || system.worn === true || system.estEquipee === true;
}
function add2eHudItemTags(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [item?.name, system.nom, system.categorie, system.category, system.type, system.sousType, system.sous_type, system.subtype, system.kind, system.slot, system.type_arme, system.famille, system.famille_arme, system.tags, system.effectTags, system.effecttags, flags.tags, flags.effectTags, flags.effecttags].flatMap(add2eHudArr).map(add2eHudNorm).filter(Boolean);
}
function add2eHudQuantity(item) {
  const system = item?.system ?? {};
  const value = system.quantite ?? system.quantity ?? system.qty ?? system.nombre ?? system.nb ?? system.uses?.value ?? system.charges?.value;
  return value === undefined || value === null || value === "" ? "—" : String(value);
}
function add2eHudQuantityNumber(item, fallback = 1) { const q = add2eHudQuantity(item); return q === "—" ? fallback : add2eHudNum(q, fallback); }
function add2eHudDamage(item) {
  const system = item?.system ?? {};
  return system?.dégâts?.contre_moyen ?? system?.degats?.contre_moyen ?? system?.degats_moyen ?? system?.damage ?? system?.degats ?? system?.dmg ?? "—";
}\nfunction add2eHudRange(item) {
  const system = item?.system ?? {};
  const values = [system.portee_courte ?? system.portee_short, system.portee_moyenne ?? system.portee_medium, system.portee_longue ?? system.portee_long].filter(value => value !== undefined && value !== null && String(value) !== "");
  return values.length ? values.join(" / ") : "Contact";
}
function add2eHudIsAmmunition(item) {
  if (!item) return false;
  if (typeof globalThis.add2eIsArmorerAmmunition === "function" && globalThis.add2eIsArmorerAmmunition(item)) return true;
  const system = item.system ?? {};
  const name = add2eHudLower(item.name);
  const fields = [system.categorie, system.category, system.sousType, system.sous_type, system.type, system.subtype, system.kind, system.slot].map(add2eHudLower).filter(Boolean);
  const tags = add2eHudItemTags(item);
  if (/\b(carquois|quiver|etui|etuis|étui|étuis|sac|sacoche|container|contenant|boite|boîte|bourse)\b/.test(name)) return false;
  if (fields.concat(tags).some(value => ["carquois", "quiver", "contenant", "container", "sac", "sacoche"].includes(value))) return false;
  if (fields.concat(tags).some(value => ["munition", "munitions", "projectile", "projectiles", "ammo", "ammunition", "trait:munition", "trait:projectile", "categorie:munition", "categorie:projectile", "type:munition", "type:projectile"].includes(value) || value.startsWith("munition:") || value.startsWith("projectile:"))) return true;
  return /\b(fleche|fleches|flèche|flèches|carreau|carreaux|trait|traits|bille|billes|pierre de fronde|pierres de fronde)\b/.test(name);
}
function add2eHudIsWeapon(item) { return String(item?.type ?? "").toLowerCase() === "arme" && !add2eHudIsAmmunition(item); }
function add2eHudIsArmor(item) { return String(item?.type ?? "").toLowerCase() === "armure"; }
function add2eHudIsShield(item) { const tags = add2eHudItemTags(item), name = add2eHudNorm(item?.name); return tags.includes("bouclier") || tags.includes("categorie_armure:bouclier") || name.includes("bouclier"); }
function add2eHudIsHelmet(item) { const tags = add2eHudItemTags(item), name = add2eHudNorm(item?.name); return tags.includes("heaume") || tags.includes("casque") || name.includes("heaume") || name.includes("casque"); }
function add2eHudIsPropelledWeapon(item) {
  const system = item?.system ?? {}, tags = add2eHudItemTags(item), name = add2eHudNorm(item?.name);
  return system.projectile_propulse === true || system.arme_a_projectile === true || tags.includes("projectile_propulse") || tags.includes("usage_projectile_propulse") || ["arc", "arbalete", "fronde"].some(key => name.includes(key));
}
function add2eHudWeaponIsRanged(item) {
  const system = item?.system ?? {}, tags = add2eHudItemTags(item);
  return add2eHudIsPropelledWeapon(item) || system.arme_de_jet === true || !!system.portee_courte || !!system.portee_moyenne || !!system.portee_longue || tags.includes("usage:distance") || tags.includes("usage_lancer") || tags.includes("usage:lancer");
}
function add2eHudAmmoType(item) {
  const system = item?.system ?? {};
  return add2eHudSlug(system.munitionType ?? system.munition_type ?? system.sousType ?? system.sous_type ?? system.categorie ?? item?.name ?? "");
}
function add2eHudProjectileKeys(weapon) {
  const text = `${add2eHudNorm(weapon?.name)} ${add2eHudItemTags(weapon).join(" ")}`;
  const explicit = add2eHudNorm(weapon?.system?.munition_requise ?? weapon?.system?.munitionRequise ?? weapon?.system?.ammoType ?? weapon?.system?.ammunitionType ?? "");
  if (explicit) return [explicit, explicit.replace(/s$/, "")];
  if (text.includes("arbalete")) return ["carreau", "carreaux", "bolt"];
  if (text.includes("arc")) return ["fleche", "fleches", "arrow"];
  if (text.includes("fronde")) return ["bille", "billes", "pierre", "pierres", "bullet"];
  return ["munition", "projectile", "ammo"];
}
function add2eHudProjectileCompatible(projectile, weapon) {
  const keys = add2eHudProjectileKeys(weapon).map(add2eHudNorm);
  const text = `${add2eHudNorm(projectile?.name)} ${add2eHudAmmoType(projectile)} ${add2eHudItemTags(projectile).join(" ")}`;
  return keys.some(key => text.includes(key) || key.includes(add2eHudAmmoType(projectile)) || add2eHudAmmoType(projectile).includes(key));
}
function add2eHudWeapons(actor) { return add2eHudActorItems(actor).filter(add2eHudIsWeapon).sort((a, b) => Number(add2eHudItemEquipped(b)) - Number(add2eHudItemEquipped(a)) || String(a.name).localeCompare(String(b.name))); }
function add2eHudProjectiles(actor) { return add2eHudActorItems(actor).filter(add2eHudIsAmmunition).sort((a, b) => Number(add2eHudItemEquipped(b)) - Number(add2eHudItemEquipped(a)) || String(a.name).localeCompare(String(b.name))); }
function add2eHudArmors(actor) { return add2eHudActorItems(actor).filter(add2eHudIsArmor).sort((a, b) => Number(add2eHudItemEquipped(b)) - Number(add2eHudItemEquipped(a)) || String(a.name).localeCompare(String(b.name))); }
function add2eHudEquippedProjectile(actor, weapon) {
  if (!add2eHudIsPropelledWeapon(weapon)) return null;
  return add2eHudProjectiles(actor).find(item => add2eHudItemEquipped(item) && add2eHudQuantity(item) !== "0" && add2eHudProjectileCompatible(item, weapon)) ?? add2eHudProjectiles(actor).find(item => add2eHudItemEquipped(item) && add2eHudQuantity(item) !== "0") ?? null;
}
function add2eHudCheckEquipment(actor, item, kind) {
  if (String(actor?.type ?? "").toLowerCase() === "monster") return { ok: true, classeLabel: "Monstre" };
  if (typeof globalThis.add2eCheckEquipmentAllowedForClass === "function") return globalThis.add2eCheckEquipmentAllowedForClass(actor, item, kind);
  if (typeof globalThis.add2eArmorerUsability === "function") {
    const result = globalThis.add2eArmorerUsability(actor, item);
    return { ok: result?.usable !== false, classeLabel: result?.label ?? actor?.system?.classe ?? "classe", reason: result?.reason ?? "armurier" };
  }
  return { ok: true, classeLabel: actor?.system?.classe ?? "classe" };
}
function add2eHudCurrentActor() {
  const check = globalThis.add2eHudCheck?.();
  const id = check?.actorId ?? null;
  if (id) return canvas?.tokens?.controlled?.find(token => token?.actor?.id === id)?.actor ?? game.actors?.get?.(id) ?? null;
  return canvas?.tokens?.controlled?.length === 1 ? canvas.tokens.controlled[0].actor : game.user?.character ?? null;
}
function add2eHudStateHtml(item) { return `<span class="state ${add2eHudItemEquipped(item) ? "equip-ok" : "equip-bad"}">${add2eHudItemEquipped(item) ? "Équipé" : "Rangé"}</span>`; }
function add2eHudWeaponRow(actor, item) {
  const projectile = add2eHudEquippedProjectile(actor, item);
  const propelled = add2eHudIsPropelledWeapon(item);
  const dmg = propelled && projectile ? `Dégâts projectile ${add2eHudDamage(projectile)}` : `Dégâts ${add2eHudDamage(item)}`;
  const ammo = propelled ? (projectile ? `<span class="ammo"><img src="${add2eHudEsc(projectile.img || "icons/svg/target.svg")}" alt="">${add2eHudEsc(projectile.name)} ×${add2eHudEsc(add2eHudQuantity(projectile))}</span>` : `<span class="ammo-missing">Aucune munition équipée</span>`) : "";
  const enabled = add2eHudItemEquipped(item);
  return `<div class="row equipment-row"><button type="button" class="img-act" ${enabled ? "" : "disabled"} data-add2e-hud-patch-action="attack" data-item-id="${add2eHudEsc(item.id)}" title="${enabled ? `Attaquer avec ${add2eHudEsc(item.name)}` : "Équipez l'arme avant d'attaquer"}"><img src="${add2eHudEsc(item.img || "icons/svg/sword.svg")}" alt=""></button><div><div class="title">${add2eHudEsc(item.name)}</div><div class="meta">${add2eHudStateHtml(item)}<span>${add2eHudEsc(dmg)}</span><span>Portée ${add2eHudEsc(add2eHudRange(item))}</span>${ammo}</div></div><button type="button" class="act" data-add2e-hud-patch-action="toggle-weapon" data-item-id="${add2eHudEsc(item.id)}">${enabled ? "Retirer" : "Équiper"}</button></div>`;
}
function add2eHudProjectileRow(item) {
  return `<div class="row equipment-row"><img src="${add2eHudEsc(item.img || "icons/svg/target.svg")}" alt=""><div><div class="title">${add2eHudEsc(item.name)}</div><div class="meta">${add2eHudStateHtml(item)}<span>Type ${add2eHudEsc(add2eHudAmmoType(item) || "—")}</span><span>Dégâts ${add2eHudEsc(add2eHudDamage(item))}</span><span>Qté ${add2eHudEsc(add2eHudQuantity(item))}</span></div></div><button type="button" class="act" data-add2e-hud-patch-action="toggle-projectile" data-item-id="${add2eHudEsc(item.id)}">${add2eHudItemEquipped(item) ? "Retirer" : "Équiper"}</button></div>`;
}
function add2eHudArmorRow(item) {
  const kind = add2eHudIsShield(item) ? "Bouclier" : add2eHudIsHelmet(item) ? "Heaume" : "Armure";
  const ac = item.system?.ac ?? item.system?.ca ?? "—";
  const bonus = item.system?.bonus_ac ?? item.system?.bonus_ca ?? item.system?.bonus_magique ?? 0;
  return `<div class="row equipment-row"><img src="${add2eHudEsc(item.img || "icons/svg/shield.svg")}" alt=""><div><div class="title">${add2eHudEsc(item.name)}</div><div class="meta">${add2eHudStateHtml(item)}<span>${kind}</span><span>CA ${add2eHudEsc(ac)}</span><span>Bonus ${add2eHudEsc(bonus)}</span></div></div><button type="button" class="act" data-add2e-hud-patch-action="toggle-armor" data-item-id="${add2eHudEsc(item.id)}">${add2eHudItemEquipped(item) ? "Retirer" : "Équiper"}</button></div>`;
}
function add2eHudPatchSection(root, key, html) {
  const panel = root.querySelector(".a2e-hud-panel");
  if (!panel) return null;
  let section = panel.querySelector(`[data-add2e-hud-patch-section="${key}"]`);
  if (!section) { section = document.createElement("section"); section.dataset.add2eHudPatchSection = key; panel.appendChild(section); }
  section.innerHTML = html;
  return section;
}
function add2eHudPatchTab(root, key, icon, label, afterKey = "attaques") {
  const nav = root.querySelector(".a2e-hud-tabs");
  if (!nav) return null;
  let tab = nav.querySelector(`[data-add2e-hud-patch-tab="${key}"]`);
  if (!tab) {
    tab = document.createElement("button");
    tab.type = "button";
    tab.className = "a2e-hud-tab";
    tab.dataset.add2eHudPatchTab = key;
    tab.innerHTML = `<i class="${icon}"></i> ${label}`;
    const after = nav.querySelector(`[data-tab="${afterKey}"], [data-add2e-hud-patch-tab="${afterKey}"]`);
    if (after?.nextSibling) nav.insertBefore(tab, after.nextSibling); else nav.appendChild(tab);
  }
  return tab;
}
function add2eHudPatchApplyActive(root) {
  const active = add2eHudPatchActiveTab;
  root.querySelectorAll(".a2e-hud-tab").forEach(tab => tab.classList.toggle("active", (tab.dataset.add2eHudPatchTab || tab.dataset.tab) === active));
  root.querySelectorAll("section").forEach(section => section.classList.toggle("active", (section.dataset.add2eHudPatchSection || section.dataset.section) === active));
}
function add2eHudRenderPatch() {
  if (add2eHudPatchBusy) return;
  const root = document.getElementById(ADD2E_HUD_ID);
  const actor = add2eHudCurrentActor();
  if (!root || !actor) return;
  add2eHudPatchBusy = true;
  try {
    if (!document.getElementById(ADD2E_HUD_PATCH_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = ADD2E_HUD_PATCH_STYLE_ID;
      style.textContent = `#${ADD2E_HUD_ID} .a2e-hud-tabs{grid-template-columns:repeat(9,1fr)!important}#${ADD2E_HUD_ID} .row.equipment-row{grid-template-columns:42px minmax(0,1fr) auto}#${ADD2E_HUD_ID} .img-act:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(.6)}#${ADD2E_HUD_ID} .state{min-width:70px;text-align:center;font-weight:950;border:1px solid rgba(214,176,90,.35);border-radius:999px;padding:2px 6px;background:rgba(0,0,0,.18)}#${ADD2E_HUD_ID} .equip-bad{color:#ffb1a8}`;
      document.head.appendChild(style);
    }
    add2eHudPatchTab(root, "projectiles", "fas fa-bullseye", "Proj.", "attaques");
    add2eHudPatchTab(root, "armures", "fas fa-shield-alt", "Arm.", "projectiles");
    const weaponSection = root.querySelector('[data-section="attaques"]');
    if (weaponSection) {
      const rows = add2eHudWeapons(actor);
      weaponSection.innerHTML = rows.length ? rows.map(item => add2eHudWeaponRow(actor, item)).join("") : `<div class="empty">Aucune arme.</div>`;
    }
    const projectiles = add2eHudProjectiles(actor);
    add2eHudPatchSection(root, "projectiles", projectiles.length ? projectiles.map(add2eHudProjectileRow).join("") : `<div class="empty">Aucun projectile dans le carquois.</div>`);
    const armors = add2eHudArmors(actor);
    add2eHudPatchSection(root, "armures", armors.length ? armors.map(add2eHudArmorRow).join("") : `<div class="empty">Aucune armure, bouclier ou heaume.</div>`);
    if (add2eHudPatchActiveTab) add2eHudPatchApplyActive(root);
  } finally {
    add2eHudPatchBusy = false;
  }
}
async function add2eHudPatchAttack(actor, item) {
  if (!item) return ui.notifications.warn("Arme introuvable.");
  if (!add2eHudItemEquipped(item)) return ui.notifications.warn("Cette arme doit être équipée avant d'attaquer.");
  if (typeof globalThis.add2eAttackRoll !== "function") return ui.notifications.error("Fonction add2eAttackRoll introuvable.");
  return globalThis.add2eAttackRoll({ actor, arme: item });
}
async function add2eHudPatchToggleWeapon(actor, item) {
  if (!item || !add2eHudIsWeapon(item)) return ui.notifications.warn("Arme introuvable.");
  const already = add2eHudItemEquipped(item);
  if (!already) {
    const check = add2eHudCheckEquipment(actor, item, "arme");
    if (!check.ok) return ui.notifications.error(`⚠️ Cette arme (« ${item.name} ») est interdite pour votre classe (${check.classeLabel}) — ${check.reason ?? "restriction de classe"}.`);
    const twoHands = item.system?.deuxMains === true || add2eHudItemTags(item).includes("usage:deux_mains") || add2eHudItemTags(item).includes("trait:deux_mains");
    if (twoHands) { const shield = add2eHudArmors(actor).find(candidate => add2eHudItemEquipped(candidate) && add2eHudIsShield(candidate)); if (shield) return ui.notifications.error(`⚠️ Impossible d'équiper une arme à deux mains si un bouclier est équipé (${shield.name}).`); }
  }
  const ranged = add2eHudWeaponIsRanged(item), updates = [];
  if (already) updates.push({ _id: item.id, "system.equipee": false });
  else {
    for (const other of add2eHudWeapons(actor)) if (other.id !== item.id && add2eHudItemEquipped(other) && add2eHudWeaponIsRanged(other) === ranged) updates.push({ _id: other.id, "system.equipee": false });
    updates.push({ _id: item.id, "system.equipee": true });
  }
  await actor.updateEmbeddedDocuments("Item", updates);
}
async function add2eHudPatchToggleProjectile(actor, item) {
  if (!item || !add2eHudIsAmmunition(item)) return ui.notifications.warn("Projectile introuvable.");
  if (!add2eHudItemEquipped(item) && add2eHudQuantityNumber(item, 0) <= 0) return ui.notifications.warn(`${item.name} : quantité insuffisante.`);
  if (!add2eHudItemEquipped(item) && typeof globalThis.add2eEquipProjectile === "function") return globalThis.add2eEquipProjectile(actor, item);
  const type = add2eHudAmmoType(item), updates = [];
  if (add2eHudItemEquipped(item)) updates.push({ _id: item.id, "system.equipee": false });
  else {
    for (const other of add2eHudProjectiles(actor)) if (other.id !== item.id && add2eHudItemEquipped(other) && add2eHudAmmoType(other) === type) updates.push({ _id: other.id, "system.equipee": false });
    updates.push({ _id: item.id, "system.equipee": true });
  }
  await actor.updateEmbeddedDocuments("Item", updates);
}
async function add2eHudPatchToggleArmor(actor, item) {
  if (!item || !add2eHudIsArmor(item)) return ui.notifications.warn("Armure introuvable.");
  const already = add2eHudItemEquipped(item), isShield = add2eHudIsShield(item), isHelmet = add2eHudIsHelmet(item), isArmor = !isShield && !isHelmet;
  if (!already) {
    const check = add2eHudCheckEquipment(actor, item, "armure");
    if (!check.ok) return ui.notifications.error(`⚠️ ${isShield ? "Ce bouclier" : isHelmet ? "Ce heaume" : "Cette armure"} (« ${item.name} ») est interdit pour votre classe (${check.classeLabel}) — ${check.reason ?? "restriction de classe"}.`);
    if (isShield) { const twoHanded = add2eHudWeapons(actor).find(weapon => add2eHudItemEquipped(weapon) && (weapon.system?.deuxMains === true || add2eHudItemTags(weapon).includes("usage:deux_mains") || add2eHudItemTags(weapon).includes("trait:deux_mains"))); if (twoHanded) return ui.notifications.error(`⚠️ Impossible d'équiper un bouclier avec une arme à deux mains (${twoHanded.name}) déjà équipée.`); }
  }
  const updates = [];
  if (already) updates.push({ _id: item.id, "system.equipee": false });
  else {
    for (const other of add2eHudArmors(actor)) if (other.id !== item.id && add2eHudItemEquipped(other) && ((isArmor && !add2eHudIsShield(other) && !add2eHudIsHelmet(other)) || (isShield && add2eHudIsShield(other)) || (isHelmet && add2eHudIsHelmet(other)))) updates.push({ _id: other.id, "system.equipee": false });
    updates.push({ _id: item.id, "system.equipee": true });
  }
  await actor.updateEmbeddedDocuments("Item", updates);
  if (typeof globalThis.add2eRecomputeArmorClass === "function") await globalThis.add2eRecomputeArmorClass(actor);
}
function add2eHudPatchInstallFeatureFilter() {
  const original = globalThis.add2eGetActorActivableClassFeatures;
  if (typeof original !== "function" || original.__add2eHudClassFiltered) return;
  const splitClassTokens = value => String(value ?? "").split(/[\/,;+&|]+|\s+et\s+|\s+-\s+/i).map(add2eHudNorm).filter(Boolean);
  const actorClassKeys = actor => {
    const keys = new Set(), system = actor?.system ?? {}, add = value => splitClassTokens(value).forEach(key => keys.add(key));
    [system.classe, system.class, system.details_classe?.label, system.details_classe?.name, system.details_classe?.slug, system.details_classe?.classe].forEach(add);
    for (const item of add2eHudActorItems(actor).filter(candidate => String(candidate?.type ?? "").toLowerCase() === "classe")) [item.name, item.system?.label, item.system?.slug, item.system?.classe, item.system?.class].forEach(add);
    return keys;
  };
  const featureClassKeys = feature => {
    const keys = new Set(), system = feature?.system ?? {}, flags = feature?.flags?.add2e ?? feature?.add2e ?? {}, add = value => splitClassTokens(value).forEach(key => keys.add(key));
    [feature?.classe, feature?.class, feature?.sourceClasse, feature?.sourceClass, feature?.classSlug, feature?.classeSlug, system.classe, system.class, system.sourceClasse, system.sourceClass, system.classSlug, flags.classe, flags.class, flags.sourceClasse, flags.sourceClass, flags.classSlug, flags.classeSlug].forEach(add);
    for (const tag of [...add2eHudItemTags(feature), ...add2eHudArr(feature?.tags).map(add2eHudNorm), ...add2eHudArr(feature?.effectTags).map(add2eHudNorm)]) { const match = String(tag).match(/^(?:classe|class|source_classe|source_class)[:_ -]+(.+)$/); if (match?.[1]) add(match[1]); }
    return keys;
  };
  const featureName = feature => String(globalThis.add2eFeatureName?.(feature) || feature?.name || feature?.label || feature?.nom || feature?.title || "").trim();
  const featureLooksLikeThief = feature => /(voleur|thief|attaque_sournoise|backstab|crochetage|crocheter|serrure|serrures|vol_a_la_tire|pick_pocket|pickpocket|desamorcer|desamorcage|detecter_les_pieges|detecter_pieges|se_cacher|deplacement_silencieux|mouvement_silencieux|entendre_bruit|lire_langues|escalade|grimper)/.test(add2eHudNorm(`${featureName(feature)} ${JSON.stringify(feature?.flags?.add2e ?? {})} ${JSON.stringify(feature?.system?.tags ?? [])} ${JSON.stringify(feature?.system?.effectTags ?? [])}`));
  const filtered = function(actor, options = {}) {
    const rows = add2eHudArr(original.call(this, actor, options));
    const actorKeys = actorClassKeys(actor);
    if (!actorKeys.size) return rows;
    const hasThiefClass = [...actorKeys].some(key => ["voleur", "thief", "barde", "bard", "assassin"].includes(key));
    return rows.filter(feature => {
      const keys = featureClassKeys(feature);
      if (keys.size) return [...keys].some(key => actorKeys.has(key));
      return hasThiefClass || !featureLooksLikeThief(feature);
    });
  };
  filtered.__add2eHudClassFiltered = true;
  filtered.__add2eOriginal = original;
  globalThis.add2eGetActorActivableClassFeatures = filtered;
}
function add2eHudPatchInstall() {
  add2eHudPatchInstallFeatureFilter();
  document.addEventListener("click", async event => {
    const tab = event.target?.closest?.("[data-add2e-hud-patch-tab]");
    if (tab) { event.preventDefault(); event.stopPropagation(); add2eHudPatchActiveTab = tab.dataset.add2eHudPatchTab; add2eHudRenderPatch(); add2eHudPatchApplyActive(document.getElementById(ADD2E_HUD_ID)); return; }
    if (event.target?.closest?.(`#${ADD2E_HUD_ID} [data-tab]`)) add2eHudPatchActiveTab = null;
    const button = event.target?.closest?.("[data-add2e-hud-patch-action]");
    if (!button) return;
    event.preventDefault(); event.stopPropagation();
    const actor = add2eHudCurrentActor(), item = add2eHudGetItem(actor, button.dataset.itemId);
    if (!actor) return ui.notifications.warn("Acteur HUD introuvable.");
    if (button.dataset.add2eHudPatchAction === "attack") await add2eHudPatchAttack(actor, item);
    if (button.dataset.add2eHudPatchAction === "toggle-weapon") await add2eHudPatchToggleWeapon(actor, item);
    if (button.dataset.add2eHudPatchAction === "toggle-projectile") await add2eHudPatchToggleProjectile(actor, item);
    if (button.dataset.add2eHudPatchAction === "toggle-armor") await add2eHudPatchToggleArmor(actor, item);
    setTimeout(() => { globalThis.add2eRefreshActionHud?.(); add2eHudRenderPatch(); }, 80);
  }, true);
  add2eHudPatchObserver = new MutationObserver(() => setTimeout(add2eHudRenderPatch, 0));
  add2eHudPatchObserver.observe(document.body, { childList: true, subtree: true });
  const oldCheck = globalThis.add2eHudCheck;
  if (typeof oldCheck === "function" && !oldCheck.__add2eHudEquipmentPatched) {
    const wrapped = () => ({ ...oldCheck(), equipmentTabsPatch: ADD2E_HUD_EQUIPMENT_TABS_PATCH_VERSION });
    wrapped.__add2eHudEquipmentPatched = true;
    globalThis.add2eHudCheck = wrapped;
  }
  game.add2e = game.add2e ?? {};
  game.add2e.actionHudEquipmentTabsVersion = ADD2E_HUD_EQUIPMENT_TABS_PATCH_VERSION;
  setTimeout(add2eHudRenderPatch, 300);
  console.log("[ADD2E][HUD_EQUIPMENT_TABS][INIT]", ADD2E_HUD_EQUIPMENT_TABS_PATCH_VERSION);
}
Hooks.once("ready", add2eHudPatchInstall);
