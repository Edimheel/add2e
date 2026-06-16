// scripts/add2e-action-hud/equipment-tabs.mjs
// ADD2E — Extension des onglets équipement du HUD.
// Version : 2026-06-16-hud-equipment-tabs-v1
// Ajoute Projectiles et Armures sans modifier la géométrie du HUD historique.

const PATCH_VERSION = "2026-06-16-hud-equipment-tabs-v1";
const HUD_ID = "add2e-action-hud";
const STYLE_ID = "add2e-action-hud-equipment-tabs-style";
const TAG = "[ADD2E][HUD_EQUIPMENT_TABS]";

let patching = false;
let activePatchTab = null;
let observer = null;

function esc(value) {
  try { return foundry.utils.escapeHTML(String(value ?? "")); }
  catch (_e) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
}
function arr(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(arr);
  if (value instanceof Set) return [...value];
  if (typeof value?.values === "function") return [...value.values()];
  if (typeof value === "object") return Object.values(value);
  return [value];
}
function lower(value) { return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function norm(value) { return lower(value).replace(/[’']/g, "").replace(/[^a-z0-9:_-]+/g, "_").replace(/^_|_$/g, ""); }
function slug(value) { return lower(value).replace(/[’']/g, "_").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
function num(value, fallback = 0) {
  if (typeof value === "string") {
    const match = value.match(/-?\d+(?:[.,]\d+)?/);
    if (!match) return fallback;
    value = match[0].replace(",", ".");
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
function actorItems(actor) { return Array.from(actor?.items ?? []).filter(item => item && item.type); }
function getItem(actor, id) { return actor?.items?.get?.(id) ?? actorItems(actor).find(item => item.id === id || item._id === id) ?? null; }
function itemEquipped(item) { const s = item?.system ?? {}; return s.equipee === true || s.equipped === true || s.portee === true || s.worn === true || s.estEquipee === true; }
function itemTags(item) {
  const s = item?.system ?? {}, f = item?.flags?.add2e ?? {};
  const tags = [item?.name, s.nom, s.categorie, s.category, s.type, s.sousType, s.sous_type, s.subtype, s.kind, s.slot, s.type_arme, s.famille_arme, s.type_armure, s.type_bouclier, s.tags, s.effectTags, s.effecttags, f.tags, f.effectTags, f.effecttags].flatMap(arr).map(norm).filter(Boolean);
  try { tags.push(...(globalThis.add2eGetItemEquipTags?.(item) ?? []).map(norm)); } catch (_e) {}
  return [...new Set(tags)].filter(Boolean);
}
function isContainerLike(item) { const text = itemTags(item).join(" "); const name = norm(item?.name); return text.includes("carquois") || text.includes("quiver") || text.includes("container") || text.includes("contenant") || text.includes("sacoche") || name.includes("carquois") || name.includes("sacoche"); }
function isAmmunitionItem(item) {
  if (!item || isContainerLike(item)) return false;
  try { if (globalThis.add2eIsArmorerAmmunition?.(item) === true) return true; } catch (_e) {}
  const s = item.system ?? {};
  const name = lower(item.name);
  const fields = [s.categorie, s.category, s.sousType, s.sous_type, s.type, s.subtype, s.kind, s.slot].map(lower).filter(Boolean);
  const tags = itemTags(item);
  const accepted = new Set(["munition", "munitions", "projectile", "projectiles", "ammo", "ammunition", "trait:munition", "trait:projectile", "categorie:munition", "categorie:projectile", "type:munition", "type:projectile"]);
  if (fields.concat(tags).some(value => accepted.has(value) || value.startsWith("munition:") || value.startsWith("projectile:"))) return true;
  return /\b(fleche|fleches|flèche|flèches|carreau|carreaux|trait|traits|bille|billes|pierre de fronde|pierres de fronde)\b/.test(name);
}
function weapons(actor) { return actorItems(actor).filter(item => String(item.type ?? "").toLowerCase() === "arme" && !isAmmunitionItem(item)).sort((a, b) => Number(itemEquipped(b)) - Number(itemEquipped(a)) || String(a.name).localeCompare(String(b.name))); }
function projectiles(actor) { return actorItems(actor).filter(isAmmunitionItem).sort((a, b) => Number(itemEquipped(b)) - Number(itemEquipped(a)) || String(a.name).localeCompare(String(b.name))); }
function armors(actor) { return actorItems(actor).filter(item => String(item.type ?? "").toLowerCase() === "armure").sort((a, b) => Number(itemEquipped(b)) - Number(itemEquipped(a)) || String(a.name).localeCompare(String(b.name))); }
function isPropelledWeapon(item) { const s = item?.system ?? {}, tags = itemTags(item), name = norm(item?.name); return s.projectile_propulse === true || s.arme_a_projectile === true || tags.includes("projectile_propulse") || tags.includes("usage_projectile_propulse") || ["arc", "arbalete", "fronde"].some(key => name.includes(key)); }
function weaponIsRanged(item) { const s = item?.system ?? {}, tags = itemTags(item); return isPropelledWeapon(item) || s.arme_de_jet === true || !!s.portee_courte || !!s.portee_moyenne || !!s.portee_longue || tags.includes("usage:distance") || tags.includes("usage_lancer") || tags.includes("usage:lancer"); }
function projectileKeys(item) { const text = `${norm(item?.name)} ${itemTags(item).join(" ")}`; const explicit = norm(item?.system?.munition_requise ?? item?.system?.munitionRequise ?? item?.system?.ammoType ?? item?.system?.ammunitionType ?? ""); if (explicit) return [explicit, explicit.replace(/s$/, "")]; if (text.includes("arbalete")) return ["carreau", "carreaux", "bolt"]; if (text.includes("arc")) return ["fleche", "fleches", "arrow"]; if (text.includes("fronde")) return ["bille", "billes", "pierre", "pierres", "bullet"]; return ["munition", "projectile", "ammo"]; }
function ammoType(item) { const s = item?.system ?? {}; return slug(s.munitionType ?? s.munition_type ?? s.sousType ?? s.sous_type ?? s.categorie ?? item?.name ?? ""); }
function projectileCompatible(projectile, weapon) { const keys = projectileKeys(weapon).map(norm); const text = `${norm(projectile?.name)} ${ammoType(projectile)} ${itemTags(projectile).join(" ")}`; return keys.some(key => text.includes(key) || key.includes(ammoType(projectile)) || ammoType(projectile).includes(key)); }
function equippedProjectile(actor, weapon) { if (!isPropelledWeapon(weapon)) return null; return projectiles(actor).find(p => itemEquipped(p) && quantity(p) !== "0" && projectileCompatible(p, weapon)) ?? projectiles(actor).find(p => itemEquipped(p) && quantity(p) !== "0") ?? null; }
function isShield(item) { try { if (globalThis.add2eIsShield?.(item)) return true; } catch (_e) {} const tags = itemTags(item), name = norm(item?.name); return tags.includes("bouclier") || tags.includes("type_armure:bouclier") || name.includes("bouclier"); }
function isHelmet(item) { try { if (globalThis.add2eIsHelmet?.(item)) return true; } catch (_e) {} const tags = itemTags(item), name = norm(item?.name); return tags.includes("heaume") || tags.includes("casque") || name.includes("heaume") || name.includes("casque"); }
function quantity(item) { const s = item?.system ?? {}; const value = s.quantite ?? s.quantity ?? s.qty ?? s.nombre ?? s.nb ?? s.uses?.value ?? s.charges?.value; return value === undefined || value === null || value === "" ? "—" : String(value); }
function quantityNumber(item, fallback = 1) { const q = quantity(item); return q === "—" ? fallback : num(q, fallback); }
function damage(item) { const s = item?.system ?? {}; return s?.dégâts?.contre_moyen ?? s?.degats?.contre_moyen ?? s?.degats_moyen ?? s?.damage ?? s?.degats ?? s?.dmg ?? "—"; }
function range(item) { const s = item?.system ?? {}; const values = [s.portee_courte ?? s.portee_short, s.portee_moyenne ?? s.portee_medium, s.portee_longue ?? s.portee_long].filter(value => value !== undefined && value !== null && String(value) !== ""); return values.length ? values.join(" / ") : "Contact"; }
function currentActor() {
  const check = globalThis.add2eHudCheck?.();
  const actorId = check?.actorId;
  if (actorId) return (canvas?.tokens?.controlled ?? []).find(token => token?.actor?.id === actorId)?.actor ?? game.actors?.get?.(actorId) ?? null;
  if ((canvas?.tokens?.controlled ?? []).length === 1) return canvas.tokens.controlled[0].actor;
  return game.user?.character ?? null;
}
function checkEquipment(actor, item, kind) { if (String(actor?.type ?? "").toLowerCase() === "monster") return { ok: true, classeLabel: "Monstre" }; if (typeof globalThis.add2eCheckEquipmentAllowedForClass === "function") return globalThis.add2eCheckEquipmentAllowedForClass(actor, item, kind); return { ok: true, classeLabel: actor?.system?.classe || "classe", reason: "fallback" }; }
function stateHtml(item) { return `<span class="state ${itemEquipped(item) ? "equip-ok" : "equip-bad"}">${itemEquipped(item) ? "Équipé" : "Rangé"}</span>`; }
function weaponRow(actor, item) {
  const projectile = equippedProjectile(actor, item);
  const propelled = isPropelledWeapon(item);
  const dmg = propelled && projectile ? `Dégâts projectile ${damage(projectile)}` : `Dégâts ${damage(item)}`;
  const equipped = itemEquipped(item);
  const ammo = propelled ? (projectile ? `<span class="ammo"><img src="${esc(projectile.img || "icons/svg/target.svg")}" alt="">${esc(projectile.name)} ×${esc(quantity(projectile))}</span>` : `<span class="ammo-missing">Aucune munition équipée</span>`) : "";
  return `<div class="row equipment-row"><button type="button" class="img-act" ${equipped ? "" : "disabled"} data-add2e-hud-equipment-action="attack" data-item-id="${esc(item.id)}" title="${equipped ? `Attaquer avec ${esc(item.name)}` : "Équipez l'arme avant d'attaquer"}"><img src="${esc(item.img || "icons/svg/sword.svg")}" alt=""></button><div><div class="title">${esc(item.name)}</div><div class="meta">${stateHtml(item)}<span>${esc(dmg)}</span><span>Portée ${esc(range(item))}</span>${ammo}</div></div><button type="button" class="act" data-add2e-hud-equipment-action="toggle-weapon" data-item-id="${esc(item.id)}">${equipped ? "Retirer" : "Équiper"}</button></div>`;
}
function projectileRow(item) { return `<div class="row equipment-row"><img src="${esc(item.img || "icons/svg/target.svg")}" alt=""><div><div class="title">${esc(item.name)}</div><div class="meta">${stateHtml(item)}<span>Type ${esc(ammoType(item) || "—")}</span><span>Dégâts ${esc(damage(item))}</span><span>Qté ${esc(quantity(item))}</span></div></div><button type="button" class="act" data-add2e-hud-equipment-action="toggle-projectile" data-item-id="${esc(item.id)}">${itemEquipped(item) ? "Retirer" : "Équiper"}</button></div>`; }
function armorRow(item) { const kind = isShield(item) ? "Bouclier" : isHelmet(item) ? "Heaume" : "Armure"; return `<div class="row equipment-row"><img src="${esc(item.img || "icons/svg/shield.svg")}" alt=""><div><div class="title">${esc(item.name)}</div><div class="meta">${stateHtml(item)}<span>${kind}</span><span>CA ${esc(item.system?.ac ?? item.system?.ca ?? "—")}</span></div></div><button type="button" class="act" data-add2e-hud-equipment-action="toggle-armor" data-item-id="${esc(item.id)}">${itemEquipped(item) ? "Retirer" : "Équiper"}</button></div>`; }
function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `#${HUD_ID} .a2e-hud-tabs{grid-template-columns:repeat(9,1fr)!important}#${HUD_ID} .img-act:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(.6)}#${HUD_ID} .state{min-width:70px;text-align:center;font-weight:950;border:1px solid rgba(214,176,90,.35);border-radius:999px;padding:2px 6px;background:rgba(0,0,0,.18)}#${HUD_ID} .equip-bad{color:#ffb1a8}`;
  document.head.appendChild(style);
}
function ensureTab(root, key, icon, label, afterKey) {
  const nav = root.querySelector(".a2e-hud-tabs");
  if (!nav) return;
  let tab = nav.querySelector(`[data-add2e-hud-equipment-tab="${key}"]`);
  if (!tab) {
    tab = document.createElement("button");
    tab.type = "button";
    tab.className = "a2e-hud-tab";
    tab.dataset.add2eHudEquipmentTab = key;
    tab.innerHTML = `<i class="${icon}"></i> ${label}`;
    const after = nav.querySelector(`[data-tab="${afterKey}"], [data-add2e-hud-equipment-tab="${afterKey}"]`);
    if (after?.nextSibling) nav.insertBefore(tab, after.nextSibling);
    else nav.appendChild(tab);
  }
}
function ensureSection(root, key, html) {
  const panel = root.querySelector(".a2e-hud-panel");
  if (!panel) return;
  let section = panel.querySelector(`[data-add2e-hud-equipment-section="${key}"]`);
  if (!section) {
    section = document.createElement("section");
    section.dataset.add2eHudEquipmentSection = key;
    panel.appendChild(section);
  }
  section.innerHTML = html;
}
function applyActive(root) {
  if (!activePatchTab) return;
  root.querySelectorAll(".a2e-hud-tab").forEach(tab => tab.classList.toggle("active", (tab.dataset.add2eHudEquipmentTab || tab.dataset.tab) === activePatchTab));
  root.querySelectorAll("section").forEach(section => section.classList.toggle("active", (section.dataset.add2eHudEquipmentSection || section.dataset.section) === activePatchTab));
}
function renderEquipmentTabs() {
  if (patching) return;
  const root = document.getElementById(HUD_ID);
  const actor = currentActor();
  if (!root || !actor) return;
  patching = true;
  try {
    ensureStyle();
    ensureTab(root, "projectiles", "fas fa-bullseye", "Proj.", "attaques");
    ensureTab(root, "armures", "fas fa-shield-alt", "Arm.", "projectiles");
    const attackSection = root.querySelector('[data-section="attaques"]');
    if (attackSection) attackSection.innerHTML = weapons(actor).map(item => weaponRow(actor, item)).join("") || `<div class="empty">Aucune arme.</div>`;
    ensureSection(root, "projectiles", projectiles(actor).map(projectileRow).join("") || `<div class="empty">Aucun projectile dans le carquois.</div>`);
    ensureSection(root, "armures", armors(actor).map(armorRow).join("") || `<div class="empty">Aucune armure, bouclier ou heaume.</div>`);
    applyActive(root);
  } finally { patching = false; }
}
async function attack(actor, item) { if (!item) return ui.notifications.warn("Arme introuvable."); if (!itemEquipped(item)) return ui.notifications.warn("Cette arme doit être équipée avant d'attaquer."); if (typeof globalThis.add2eAttackRoll !== "function") return ui.notifications.error("Fonction add2eAttackRoll introuvable."); return globalThis.add2eAttackRoll({ actor, arme: item }); }
async function toggleWeapon(actor, item) {
  if (!item) return ui.notifications.warn("Arme introuvable.");
  const already = itemEquipped(item);
  if (!already) {
    const check = checkEquipment(actor, item, "arme");
    if (!check.ok) return ui.notifications.error(`⚠️ Cette arme (« ${item.name} ») est interdite pour votre classe (${check.classeLabel}) — ${check.reason ?? "restriction de classe"}.`);
    const twoHands = item.system?.deuxMains === true || itemTags(item).includes("usage:deux_mains") || itemTags(item).includes("trait:deux_mains");
    if (twoHands) { const shield = armors(actor).find(i => itemEquipped(i) && isShield(i)); if (shield) return ui.notifications.error(`⚠️ Impossible d'équiper une arme à deux mains si un bouclier est équipé (${shield.name}).`); }
  }
  const ranged = weaponIsRanged(item);
  const updates = [];
  if (already) updates.push({ _id: item.id, "system.equipee": false });
  else {
    for (const other of weapons(actor)) if (other.id !== item.id && itemEquipped(other) && weaponIsRanged(other) === ranged) updates.push({ _id: other.id, "system.equipee": false });
    updates.push({ _id: item.id, "system.equipee": true });
  }
  await actor.updateEmbeddedDocuments("Item", updates);
}
async function toggleProjectile(actor, item) {
  if (!item) return ui.notifications.warn("Projectile introuvable.");
  if (!itemEquipped(item) && quantityNumber(item, 0) <= 0) return ui.notifications.warn(`${item.name} : quantité insuffisante.`);
  if (!itemEquipped(item) && typeof globalThis.add2eEquipProjectile === "function") return globalThis.add2eEquipProjectile(actor, item);
  await actor.updateEmbeddedDocuments("Item", [{ _id: item.id, "system.equipee": !itemEquipped(item) }]);
}
async function toggleArmor(actor, item) {
  if (!item) return ui.notifications.warn("Armure introuvable.");
  const already = itemEquipped(item);
  const shield = isShield(item), helmet = isHelmet(item), bodyArmor = !shield && !helmet;
  if (!already) {
    const check = checkEquipment(actor, item, "armure");
    if (!check.ok) return ui.notifications.error(`⚠️ ${shield ? "Ce bouclier" : helmet ? "Ce heaume" : "Cette armure"} (« ${item.name} ») est interdit pour votre classe (${check.classeLabel}) — ${check.reason ?? "restriction de classe"}.`);
    if (shield) { const twoHanded = weapons(actor).find(w => itemEquipped(w) && (w.system?.deuxMains === true || itemTags(w).includes("usage:deux_mains") || itemTags(w).includes("trait:deux_mains"))); if (twoHanded) return ui.notifications.error(`⚠️ Impossible d'équiper un bouclier avec une arme à deux mains (${twoHanded.name}) déjà équipée.`); }
  }
  const updates = [];
  if (already) updates.push({ _id: item.id, "system.equipee": false });
  else {
    for (const other of armors(actor)) if (other.id !== item.id && itemEquipped(other) && ((bodyArmor && !isShield(other) && !isHelmet(other)) || (shield && isShield(other)) || (helmet && isHelmet(other)))) updates.push({ _id: other.id, "system.equipee": false });
    updates.push({ _id: item.id, "system.equipee": true });
  }
  await actor.updateEmbeddedDocuments("Item", updates);
  try { await globalThis.add2eRecomputeArmorClass?.(actor); } catch (_e) {}
}
function install() {
  document.addEventListener("click", async event => {
    const tab = event.target?.closest?.("[data-add2e-hud-equipment-tab]");
    if (tab) {
      event.preventDefault();
      event.stopPropagation();
      activePatchTab = tab.dataset.add2eHudEquipmentTab;
      renderEquipmentTabs();
      applyActive(document.getElementById(HUD_ID));
      return;
    }
    if (event.target?.closest?.(`#${HUD_ID} [data-tab]`)) activePatchTab = null;
    const button = event.target?.closest?.("[data-add2e-hud-equipment-action]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const actor = currentActor();
    const item = getItem(actor, button.dataset.itemId);
    if (!actor) return ui.notifications.warn("Acteur HUD introuvable.");
    if (button.dataset.add2eHudEquipmentAction === "attack") await attack(actor, item);
    if (button.dataset.add2eHudEquipmentAction === "toggle-weapon") await toggleWeapon(actor, item);
    if (button.dataset.add2eHudEquipmentAction === "toggle-projectile") await toggleProjectile(actor, item);
    if (button.dataset.add2eHudEquipmentAction === "toggle-armor") await toggleArmor(actor, item);
    setTimeout(() => { globalThis.add2eRefreshActionHud?.(); renderEquipmentTabs(); }, 80);
  }, true);
  observer = new MutationObserver(() => setTimeout(renderEquipmentTabs, 0));
  observer.observe(document.body, { childList: true, subtree: true });
  game.add2e = game.add2e ?? {};
  game.add2e.actionHudEquipmentTabsVersion = PATCH_VERSION;
  const previousCheck = globalThis.add2eHudCheck;
  if (typeof previousCheck === "function" && !previousCheck.__add2eEquipmentTabsWrapped) {
    const wrapped = () => ({ ...previousCheck(), equipmentTabs: PATCH_VERSION });
    wrapped.__add2eEquipmentTabsWrapped = true;
    globalThis.add2eHudCheck = wrapped;
  }
  setTimeout(renderEquipmentTabs, 300);
  console.log(`${TAG}[INIT]`, PATCH_VERSION);
}

if (game?.ready) install();
else Hooks.once("ready", install);
