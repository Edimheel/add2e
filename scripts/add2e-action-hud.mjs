// scripts/add2e-action-hud.mjs
// ADD2E — HUD d'action rapide maison.
// Point d'entrée conservé pour system.json.
// Le code historique est déplacé sans modification dans scripts/add2e-action-hud/core.mjs.

export {
  add2eRenderActionHud,
  add2eRefreshActionHud,
  add2eCloseActionHud
} from "./add2e-action-hud/core.mjs";

// ADD2E — Sous-onglets équipement intégrés au HUD.
// Version : 2026-06-16-hud-equipment-subtabs-v3-tags-only-ammo
// L'onglet principal Armes reste unique ; Armes / Projectiles / Armures sont des sous-onglets.

const ADD2E_HUD_EQUIPMENT_SUBTABS_VERSION = "2026-06-16-hud-equipment-subtabs-v3-tags-only-ammo";
const ADD2E_HUD_ID = "add2e-action-hud";
const ADD2E_HUD_EQUIPMENT_STYLE_ID = "add2e-action-hud-equipment-subtabs-style";
let add2eHudEquipmentSubtab = "armes";
let add2eHudEquipmentPatching = false;
let add2eHudEquipmentBodyObserver = null;
let add2eHudEquipmentHudObserver = null;
let add2eHudEquipmentObservedHud = null;
let add2eHudEquipmentScheduledFrame = null;

function add2eHudEquipEsc(value) {
  try { return foundry.utils.escapeHTML(String(value ?? "")); }
  catch (_e) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
}
function add2eHudEquipArr(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eHudEquipArr);
  if (value instanceof Set) return [...value];
  if (typeof value?.values === "function") return [...value.values()];
  if (typeof value === "object") return Object.values(value);
  return [value];
}
function add2eHudEquipLower(value) { return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function add2eHudEquipNorm(value) { return add2eHudEquipLower(value).replace(/[’']/g, "").replace(/[^a-z0-9:_-]+/g, "_").replace(/^_|_$/g, ""); }
function add2eHudEquipSlug(value) { return add2eHudEquipLower(value).replace(/[’']/g, "_").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
function add2eHudEquipNum(value, fallback = 0) {
  if (typeof value === "string") {
    const match = value.match(/-?\d+(?:[.,]\d+)?/);
    if (!match) return fallback;
    value = match[0].replace(",", ".");
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
function add2eHudEquipActorItems(actor) { return Array.from(actor?.items ?? []).filter(item => item && item.type); }
function add2eHudEquipGetItem(actor, id) { return actor?.items?.get?.(id) ?? add2eHudEquipActorItems(actor).find(item => item.id === id || item._id === id) ?? null; }
function add2eHudEquipItemEquipped(item) { const s = item?.system ?? {}; return s.equipee === true || s.equipped === true || s.portee === true || s.worn === true || s.estEquipee === true; }
function add2eHudEquipRawTags(item) {
  const s = item?.system ?? {}, f = item?.flags?.add2e ?? {};
  const tags = [s.tags, s.effectTags, s.effecttags, f.tags, f.effectTags, f.effecttags].flatMap(add2eHudEquipArr).map(add2eHudEquipNorm).filter(Boolean);
  try { tags.push(...(globalThis.add2eGetItemEquipTags?.(item) ?? []).map(add2eHudEquipNorm)); } catch (_e) {}
  return [...new Set(tags)].filter(Boolean);
}
function add2eHudEquipAllTags(item) {
  const s = item?.system ?? {}, f = item?.flags?.add2e ?? {};
  const tags = [
    item?.type, item?.name, s.nom, s.categorie, s.category, s.type, s.sousType, s.sous_type, s.subtype, s.kind, s.slot,
    s.type_arme, s.famille_arme, s.type_armure, s.type_bouclier, s.tags, s.effectTags, s.effecttags,
    f.tags, f.effectTags, f.effecttags, f.vendorKind, f.kind, f.category, f.categorie, f.type, f.sousType, f.sous_type
  ].flatMap(add2eHudEquipArr).map(add2eHudEquipNorm).filter(Boolean);
  try { tags.push(...(globalThis.add2eGetItemEquipTags?.(item) ?? []).map(add2eHudEquipNorm)); } catch (_e) {}
  return [...new Set(tags)].filter(Boolean);
}
function add2eHudEquipItemTags(item) { return add2eHudEquipAllTags(item); }
function add2eHudEquipIsContainerLike(item) {
  const text = add2eHudEquipAllTags(item).join(" ");
  return text.includes("carquois") || text.includes("quiver") || text.includes("container") || text.includes("contenant") || text.includes("sacoche");
}
function add2eHudEquipIsPropelledWeapon(item) {
  const s = item?.system ?? {}, tags = add2eHudEquipAllTags(item), name = add2eHudEquipNorm(item?.name);
  return s.projectile_propulse === true || s.arme_a_projectile === true || tags.includes("projectile_propulse") || tags.includes("usage_projectile_propulse") || ["arc", "arbalete", "fronde"].some(key => name.includes(key));
}
function add2eHudEquipIsThrownWeapon(item) {
  if (String(item?.type ?? "").toLowerCase() !== "arme") return false;
  if (add2eHudEquipIsPropelledWeapon(item)) return false;
  const s = item?.system ?? {};
  const tags = add2eHudEquipAllTags(item);
  return s.arme_de_jet === true || s.jet === true || tags.some(tag => ["arme_de_jet", "usage_lancer", "usage:lancer", "usage_jet", "arme:jet", "type_arme:jet", "type_arme:arme_de_jet"].includes(tag));
}
function add2eHudEquipTagMarksAmmo(tag) {
  return tag === "munition"
    || tag === "munitions"
    || tag === "projectile"
    || tag === "projectiles"
    || tag === "ammo"
    || tag === "ammunition"
    || tag === "trait:munition"
    || tag === "trait:projectile"
    || tag === "categorie:munition"
    || tag === "categorie:projectile"
    || tag === "type:munition"
    || tag === "type:projectile"
    || tag === "type_arme:munition"
    || tag === "type_arme:projectile"
    || tag.startsWith("munition:")
    || tag.startsWith("projectile:");
}
function add2eHudEquipIsAmmunition(item) {
  if (!item || add2eHudEquipIsContainerLike(item)) return false;
  if (add2eHudEquipIsThrownWeapon(item)) return false;
  return add2eHudEquipRawTags(item).some(add2eHudEquipTagMarksAmmo);
}
function add2eHudEquipWeapons(actor) { return add2eHudEquipActorItems(actor).filter(item => String(item.type ?? "").toLowerCase() === "arme" && !add2eHudEquipIsAmmunition(item)).sort((a, b) => Number(add2eHudEquipItemEquipped(b)) - Number(add2eHudEquipItemEquipped(a)) || String(a.name).localeCompare(String(b.name))); }
function add2eHudEquipProjectiles(actor) { return add2eHudEquipActorItems(actor).filter(add2eHudEquipIsAmmunition).sort((a, b) => Number(add2eHudEquipItemEquipped(b)) - Number(add2eHudEquipItemEquipped(a)) || String(a.name).localeCompare(String(b.name))); }
function add2eHudEquipArmors(actor) { return add2eHudEquipActorItems(actor).filter(item => String(item.type ?? "").toLowerCase() === "armure").sort((a, b) => Number(add2eHudEquipItemEquipped(b)) - Number(add2eHudEquipItemEquipped(a)) || String(a.name).localeCompare(String(b.name))); }
function add2eHudEquipWeaponIsRanged(item) { const s = item?.system ?? {}, tags = add2eHudEquipAllTags(item); return add2eHudEquipIsPropelledWeapon(item) || add2eHudEquipIsThrownWeapon(item) || s.arme_de_jet === true || !!s.portee_courte || !!s.portee_moyenne || !!s.portee_longue || tags.includes("usage:distance") || tags.includes("usage_lancer") || tags.includes("usage:lancer"); }
function add2eHudEquipTagValue(tags, prefixes) { for (const tag of tags) for (const prefix of prefixes) if (tag.startsWith(prefix) && tag.length > prefix.length) return tag.slice(prefix.length); return ""; }
function add2eHudEquipProjectileKeys(item) {
  const tags = add2eHudEquipAllTags(item);
  const explicit = add2eHudEquipNorm(item?.system?.munition_requise ?? item?.system?.munitionRequise ?? item?.system?.ammoType ?? item?.system?.ammunitionType ?? "") || add2eHudEquipTagValue(tags, ["munition_requise:", "ammo_type:", "ammunition_type:"]);
  return explicit ? [explicit] : ["munition", "projectile", "ammo"];
}
function add2eHudEquipAmmoType(item) {
  const tags = add2eHudEquipRawTags(item);
  return add2eHudEquipTagValue(tags, ["munition:", "projectile:", "ammo:", "ammunition:"]) || add2eHudEquipSlug(item?.system?.munitionType ?? item?.system?.munition_type ?? item?.system?.sousType ?? item?.system?.sous_type ?? item?.system?.categorie ?? item?.system?.category ?? "projectile");
}
function add2eHudEquipProjectileCompatible(projectile, weapon) {
  const keys = add2eHudEquipProjectileKeys(weapon).map(add2eHudEquipNorm);
  const ammo = add2eHudEquipAmmoType(projectile);
  const tags = add2eHudEquipRawTags(projectile);
  return keys.some(key => key === "munition" || key === "projectile" || key === "ammo" || ammo === key || tags.includes(`munition:${key}`) || tags.includes(`projectile:${key}`));
}
function add2eHudEquipEquippedProjectile(actor, weapon) {
  if (!add2eHudEquipIsPropelledWeapon(weapon)) return null;
  const equipped = add2eHudEquipProjectiles(actor).filter(p => add2eHudEquipItemEquipped(p) && add2eHudEquipQuantity(p) !== "0");
  return equipped.find(p => add2eHudEquipProjectileCompatible(p, weapon)) ?? (equipped.length === 1 ? equipped[0] : null);
}
function add2eHudEquipIsShield(item) { try { if (globalThis.add2eIsShield?.(item)) return true; } catch (_e) {} const tags = add2eHudEquipAllTags(item), name = add2eHudEquipNorm(item?.name); return tags.includes("bouclier") || tags.includes("type_armure:bouclier") || name.includes("bouclier"); }
function add2eHudEquipIsHelmet(item) { try { if (globalThis.add2eIsHelmet?.(item)) return true; } catch (_e) {} const tags = add2eHudEquipAllTags(item), name = add2eHudEquipNorm(item?.name); return tags.includes("heaume") || tags.includes("casque") || name.includes("heaume") || name.includes("casque"); }
function add2eHudEquipQuantity(item) { const s = item?.system ?? {}; const value = s.quantite ?? s.quantity ?? s.qty ?? s.nombre ?? s.nb ?? s.uses?.value ?? s.charges?.value; return value === undefined || value === null || value === "" ? "—" : String(value); }
function add2eHudEquipQuantityNumber(item, fallback = 1) { const q = add2eHudEquipQuantity(item); return q === "—" ? fallback : add2eHudEquipNum(q, fallback); }
function add2eHudEquipDamage(item) { const s = item?.system ?? {}; return s?.dégâts?.contre_moyen ?? s?.degats?.contre_moyen ?? s?.degats_moyen ?? s?.damage ?? s?.degats ?? s?.dmg ?? "—"; }
function add2eHudEquipRange(item) { const s = item?.system ?? {}; const values = [s.portee_courte ?? s.portee_short, s.portee_moyenne ?? s.portee_medium, s.portee_longue ?? s.portee_long].filter(value => value !== undefined && value !== null && String(value) !== ""); return values.length ? values.join(" / ") : "Contact"; }
function add2eHudEquipCurrentActor() {
  const check = globalThis.add2eHudCheck?.();
  const actorId = check?.actorId;
  if (actorId) return (canvas?.tokens?.controlled ?? []).find(token => token?.actor?.id === actorId)?.actor ?? game.actors?.get?.(actorId) ?? null;
  if ((canvas?.tokens?.controlled ?? []).length === 1) return canvas.tokens.controlled[0].actor;
  return game.user?.character ?? null;
}
function add2eHudEquipCheckEquipment(actor, item, kind) {
  if (String(actor?.type ?? "").toLowerCase() === "monster") return { ok: true, classeLabel: "Monstre" };
  if (typeof globalThis.add2eCheckEquipmentAllowedForClass === "function") return globalThis.add2eCheckEquipmentAllowedForClass(actor, item, kind);
  return { ok: true, classeLabel: actor?.system?.classe || "classe", reason: "fallback" };
}
function add2eHudEquipStateHtml(item) { return `<span class="state ${add2eHudEquipItemEquipped(item) ? "equip-ok" : "equip-bad"}">${add2eHudEquipItemEquipped(item) ? "Équipé" : "Rangé"}</span>`; }
function add2eHudEquipProjectileBadge(projectile) { if (!projectile) return ""; return `<span class="ammo-inline" title="Projectile équipé">${add2eHudEquipEsc(projectile.name)} ×${add2eHudEquipEsc(add2eHudEquipQuantity(projectile))}</span>`; }
function add2eHudEquipWeaponRow(actor, item) {
  const projectile = add2eHudEquipEquippedProjectile(actor, item);
  const propelled = add2eHudEquipIsPropelledWeapon(item);
  const thrown = add2eHudEquipIsThrownWeapon(item);
  const dmg = propelled && projectile ? `Dégâts projectile ${add2eHudEquipDamage(projectile)}` : `Dégâts ${add2eHudEquipDamage(item)}`;
  const equipped = add2eHudEquipItemEquipped(item);
  const ammo = propelled ? (projectile ? `<span class="ammo"><img src="${add2eHudEquipEsc(projectile.img || "icons/svg/target.svg")}" alt="">${add2eHudEquipEsc(projectile.name)} ×${add2eHudEquipEsc(add2eHudEquipQuantity(projectile))}</span>` : `<span class="ammo-missing">Aucune munition équipée</span>`) : "";
  const titleBadge = propelled && projectile ? ` ${add2eHudEquipProjectileBadge(projectile)}` : (thrown && add2eHudEquipQuantity(item) !== "—" ? ` <span class="ammo-inline">×${add2eHudEquipEsc(add2eHudEquipQuantity(item))}</span>` : "");
  return `<div class="row equipment-row"><button type="button" class="img-act" ${equipped ? "" : "disabled"} data-add2e-hud-equipment-action="attack" data-item-id="${add2eHudEquipEsc(item.id)}" title="${equipped ? `Attaquer avec ${add2eHudEquipEsc(item.name)}` : "Équipez l'arme avant d'attaquer"}"><img src="${add2eHudEquipEsc(item.img || "icons/svg/sword.svg")}" alt=""></button><div><div class="title">${add2eHudEquipEsc(item.name)}${titleBadge}</div><div class="meta">${add2eHudEquipStateHtml(item)}<span>${add2eHudEquipEsc(dmg)}</span><span>Portée ${add2eHudEquipEsc(add2eHudEquipRange(item))}</span>${ammo}</div></div><button type="button" class="act" data-add2e-hud-equipment-action="toggle-weapon" data-item-id="${add2eHudEquipEsc(item.id)}">${equipped ? "Retirer" : "Équiper"}</button></div>`;
}
function add2eHudEquipProjectileRow(item) { return `<div class="row equipment-row"><img src="${add2eHudEquipEsc(item.img || "icons/svg/target.svg")}" alt=""><div><div class="title">${add2eHudEquipEsc(item.name)}</div><div class="meta">${add2eHudEquipStateHtml(item)}<span>Type ${add2eHudEquipEsc(add2eHudEquipAmmoType(item) || "—")}</span><span>Dégâts ${add2eHudEquipEsc(add2eHudEquipDamage(item))}</span><span>Qté ${add2eHudEquipEsc(add2eHudEquipQuantity(item))}</span></div></div><button type="button" class="act" data-add2e-hud-equipment-action="toggle-projectile" data-item-id="${add2eHudEquipEsc(item.id)}">${add2eHudEquipItemEquipped(item) ? "Retirer" : "Équiper"}</button></div>`; }
function add2eHudEquipArmorRow(item) { const kind = add2eHudEquipIsShield(item) ? "Bouclier" : add2eHudEquipIsHelmet(item) ? "Heaume" : "Armure"; return `<div class="row equipment-row"><img src="${add2eHudEquipEsc(item.img || "icons/svg/shield.svg")}" alt=""><div><div class="title">${add2eHudEquipEsc(item.name)}</div><div class="meta">${add2eHudEquipStateHtml(item)}<span>${kind}</span><span>CA ${add2eHudEquipEsc(item.system?.ac ?? item.system?.ca ?? "—")}</span></div></div><button type="button" class="act" data-add2e-hud-equipment-action="toggle-armor" data-item-id="${add2eHudEquipEsc(item.id)}">${add2eHudEquipItemEquipped(item) ? "Retirer" : "Équiper"}</button></div>`; }
function add2eHudEquipEnsureStyle() {
  if (document.getElementById(ADD2E_HUD_EQUIPMENT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = ADD2E_HUD_EQUIPMENT_STYLE_ID;
  style.textContent = `#${ADD2E_HUD_ID} .a2e-hud-equipment-subtabs{display:flex;flex-wrap:wrap;gap:6px;padding-bottom:2px;border-bottom:1px solid rgba(214,176,90,.28)}#${ADD2E_HUD_ID} .a2e-hud-equipment-subtab{min-height:30px;padding:5px 10px;border:1px solid rgba(214,176,90,.55);border-radius:999px;background:rgba(214,176,90,.12);color:#ffe4a1;font-weight:950;font-size:.82em;cursor:pointer}#${ADD2E_HUD_ID} .a2e-hud-equipment-subtab.active{background:linear-gradient(180deg,#f0c66d,#c78d2e);color:#211307}#${ADD2E_HUD_ID} .a2e-hud-equipment-list{display:grid;gap:6px;max-height:260px;overflow-y:auto;padding-right:3px}#${ADD2E_HUD_ID} .img-act:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(.6)}#${ADD2E_HUD_ID} .state{min-width:70px;text-align:center;font-weight:950;border:1px solid rgba(214,176,90,.35);border-radius:999px;padding:2px 6px;background:rgba(0,0,0,.18)}#${ADD2E_HUD_ID} .equip-bad{color:#ffb1a8}#${ADD2E_HUD_ID} .ammo-inline{display:inline-flex;align-items:center;margin-left:6px;padding:1px 6px;border:1px solid rgba(80,180,80,.55);border-radius:999px;background:rgba(35,100,35,.35);color:#b8ffb8;font-size:.82em;font-weight:900;vertical-align:middle}`;
  document.head.appendChild(style);
}
function add2eHudEquipSubtabButton(key, label, count) { return `<button type="button" class="a2e-hud-equipment-subtab ${add2eHudEquipmentSubtab === key ? "active" : ""}" data-add2e-hud-equipment-subtab="${key}">${label} <span>${count}</span></button>`; }
function add2eHudEquipRenderContent(actor) {
  const weaponRows = add2eHudEquipWeapons(actor);
  const projectileRows = add2eHudEquipProjectiles(actor);
  const armorRows = add2eHudEquipArmors(actor);
  if (!["armes", "projectiles", "armures"].includes(add2eHudEquipmentSubtab)) add2eHudEquipmentSubtab = "armes";
  const tabs = `<div class="a2e-hud-equipment-subtabs">${add2eHudEquipSubtabButton("armes", "Armes", weaponRows.length)}${add2eHudEquipSubtabButton("projectiles", "Projectiles", projectileRows.length)}${add2eHudEquipSubtabButton("armures", "Armures", armorRows.length)}</div>`;
  let list = "";
  if (add2eHudEquipmentSubtab === "projectiles") list = projectileRows.map(add2eHudEquipProjectileRow).join("") || `<div class="empty">Aucun projectile dans le carquois.</div>`;
  else if (add2eHudEquipmentSubtab === "armures") list = armorRows.map(add2eHudEquipArmorRow).join("") || `<div class="empty">Aucune armure, bouclier ou heaume.</div>`;
  else list = weaponRows.map(item => add2eHudEquipWeaponRow(actor, item)).join("") || `<div class="empty">Aucune arme.</div>`;
  return `<div class="spell-layout">${tabs}<div class="a2e-hud-equipment-list">${list}</div></div>`;
}
function add2eHudEquipRender() {
  if (add2eHudEquipmentPatching) return;
  const root = document.getElementById(ADD2E_HUD_ID);
  const actor = add2eHudEquipCurrentActor();
  if (!root || !actor) return;
  add2eHudEquipmentPatching = true;
  try {
    add2eHudEquipEnsureStyle();
    const attackSection = root.querySelector('[data-section="attaques"]');
    if (attackSection) attackSection.innerHTML = add2eHudEquipRenderContent(actor);
  } finally { add2eHudEquipmentPatching = false; }
}
function add2eHudEquipWatchHud(root) {
  if (add2eHudEquipmentObservedHud === root) return;
  add2eHudEquipmentHudObserver?.disconnect?.();
  add2eHudEquipmentObservedHud = root;
  if (!root) return;
  add2eHudEquipmentHudObserver = new MutationObserver(() => add2eHudEquipScheduleRender());
  add2eHudEquipmentHudObserver.observe(root, { childList: true });
}
function add2eHudEquipScheduleRender() {
  if (add2eHudEquipmentScheduledFrame !== null) return;
  const raf = globalThis.requestAnimationFrame ?? (fn => setTimeout(fn, 16));
  add2eHudEquipmentScheduledFrame = raf(() => {
    add2eHudEquipmentScheduledFrame = null;
    add2eHudEquipWatchHud(document.getElementById(ADD2E_HUD_ID));
    add2eHudEquipRender();
  });
}
async function add2eHudEquipAttack(actor, item) {
  if (!item) return ui.notifications.warn("Arme introuvable.");
  if (!add2eHudEquipItemEquipped(item)) return ui.notifications.warn("Cette arme doit être équipée avant d'attaquer.");
  if (typeof globalThis.add2eAttackRoll !== "function") return ui.notifications.error("Fonction add2eAttackRoll introuvable.");
  return globalThis.add2eAttackRoll({ actor, arme: item });
}
async function add2eHudEquipToggleWeapon(actor, item) {
  if (!item) return ui.notifications.warn("Arme introuvable.");
  const already = add2eHudEquipItemEquipped(item);
  if (!already) {
    const check = add2eHudEquipCheckEquipment(actor, item, "arme");
    if (!check.ok) return ui.notifications.error(`⚠️ Cette arme (« ${item.name} ») est interdite pour votre classe (${check.classeLabel}) — ${check.reason ?? "restriction de classe"}.`);
    const twoHands = item.system?.deuxMains === true || add2eHudEquipAllTags(item).includes("usage:deux_mains") || add2eHudEquipAllTags(item).includes("trait:deux_mains");
    if (twoHands) { const shield = add2eHudEquipArmors(actor).find(i => add2eHudEquipItemEquipped(i) && add2eHudEquipIsShield(i)); if (shield) return ui.notifications.error(`⚠️ Impossible d'équiper une arme à deux mains si un bouclier est équipé (${shield.name}).`); }
  }
  const ranged = add2eHudEquipWeaponIsRanged(item);
  const updates = [];
  if (already) updates.push({ _id: item.id, "system.equipee": false });
  else {
    for (const other of add2eHudEquipWeapons(actor)) if (other.id !== item.id && add2eHudEquipItemEquipped(other) && add2eHudEquipWeaponIsRanged(other) === ranged) updates.push({ _id: other.id, "system.equipee": false });
    updates.push({ _id: item.id, "system.equipee": true });
  }
  await actor.updateEmbeddedDocuments("Item", updates);
}
async function add2eHudEquipToggleProjectile(actor, item) {
  if (!item) return ui.notifications.warn("Projectile introuvable.");
  if (!add2eHudEquipItemEquipped(item) && add2eHudEquipQuantityNumber(item, 0) <= 0) return ui.notifications.warn(`${item.name} : quantité insuffisante.`);
  if (!add2eHudEquipItemEquipped(item) && typeof globalThis.add2eEquipProjectile === "function") return globalThis.add2eEquipProjectile(actor, item);
  await actor.updateEmbeddedDocuments("Item", [{ _id: item.id, "system.equipee": !add2eHudEquipItemEquipped(item) }]);
}
async function add2eHudEquipToggleArmor(actor, item) {
  if (!item) return ui.notifications.warn("Armure introuvable.");
  const already = add2eHudEquipItemEquipped(item);
  const shield = add2eHudEquipIsShield(item), helmet = add2eHudEquipIsHelmet(item), bodyArmor = !shield && !helmet;
  if (!already) {
    const check = add2eHudEquipCheckEquipment(actor, item, "armure");
    if (!check.ok) return ui.notifications.error(`⚠️ ${shield ? "Ce bouclier" : helmet ? "Ce heaume" : "Cette armure"} (« ${item.name} ») est interdit pour votre classe (${check.classeLabel}) — ${check.reason ?? "restriction de classe"}.`);
    if (shield) { const twoHanded = add2eHudEquipWeapons(actor).find(w => add2eHudEquipItemEquipped(w) && (w.system?.deuxMains === true || add2eHudEquipAllTags(w).includes("usage:deux_mains") || add2eHudEquipAllTags(w).includes("trait:deux_mains"))); if (twoHanded) return ui.notifications.error(`⚠️ Impossible d'équiper un bouclier avec une arme à deux mains (${twoHanded.name}) déjà équipée.`); }
  }
  const updates = [];
  if (already) updates.push({ _id: item.id, "system.equipee": false });
  else {
    for (const other of add2eHudEquipArmors(actor)) if (other.id !== item.id && add2eHudEquipItemEquipped(other) && ((bodyArmor && !add2eHudEquipIsShield(other) && !add2eHudEquipIsHelmet(other)) || (shield && add2eHudEquipIsShield(other)) || (helmet && add2eHudEquipIsHelmet(other)))) updates.push({ _id: other.id, "system.equipee": false });
    updates.push({ _id: item.id, "system.equipee": true });
  }
  await actor.updateEmbeddedDocuments("Item", updates);
  try { await globalThis.add2eRecomputeArmorClass?.(actor); } catch (_e) {}
}
function add2eHudEquipInstall() {
  document.addEventListener("click", async event => {
    const subtab = event.target?.closest?.("[data-add2e-hud-equipment-subtab]");
    if (subtab) {
      event.preventDefault();
      event.stopPropagation();
      add2eHudEquipmentSubtab = subtab.dataset.add2eHudEquipmentSubtab || "armes";
      add2eHudEquipRender();
      return;
    }
    const button = event.target?.closest?.("[data-add2e-hud-equipment-action]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const actor = add2eHudEquipCurrentActor();
    if (!actor) return ui.notifications.warn("Acteur HUD introuvable.");
    const item = add2eHudEquipGetItem(actor, button.dataset.itemId);
    if (button.dataset.add2eHudEquipmentAction === "attack") await add2eHudEquipAttack(actor, item);
    if (button.dataset.add2eHudEquipmentAction === "toggle-weapon") await add2eHudEquipToggleWeapon(actor, item);
    if (button.dataset.add2eHudEquipmentAction === "toggle-projectile") await add2eHudEquipToggleProjectile(actor, item);
    if (button.dataset.add2eHudEquipmentAction === "toggle-armor") await add2eHudEquipToggleArmor(actor, item);
    setTimeout(() => { globalThis.add2eRefreshActionHud?.(); add2eHudEquipScheduleRender(); }, 80);
  }, true);
  add2eHudEquipmentBodyObserver = new MutationObserver(mutations => {
    if (mutations.some(mutation => Array.from(mutation.addedNodes ?? []).some(node => node?.id === ADD2E_HUD_ID || node?.querySelector?.(`#${ADD2E_HUD_ID}`)))) add2eHudEquipScheduleRender();
  });
  add2eHudEquipmentBodyObserver.observe(document.body, { childList: true });
  game.add2e = game.add2e ?? {};
  game.add2e.actionHudEquipmentTabsVersion = ADD2E_HUD_EQUIPMENT_SUBTABS_VERSION;
  const previousCheck = globalThis.add2eHudCheck;
  if (typeof previousCheck === "function" && !previousCheck.__add2eEquipmentSubtabsWrapped) {
    const wrapped = () => ({ ...previousCheck(), equipmentSubtabs: ADD2E_HUD_EQUIPMENT_SUBTABS_VERSION });
    wrapped.__add2eEquipmentSubtabsWrapped = true;
    globalThis.add2eHudCheck = wrapped;
  }
  add2eHudEquipScheduleRender();
  console.log("[ADD2E][HUD_EQUIPMENT_SUBTABS][INIT]", ADD2E_HUD_EQUIPMENT_SUBTABS_VERSION);
}

if (game?.ready) add2eHudEquipInstall();
else Hooks.once("ready", add2eHudEquipInstall);
