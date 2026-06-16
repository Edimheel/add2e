// ADD2E — Extension du HUD : armes non équipées, projectiles et armures
// Version : 2026-06-16-hud-equipment-tabs-v1
//
// Ce module complète le HUD existant sans remplacer le fichier monolithique.
// Il garde les actions système et utilise add2eArmorerUsability pour conserver
// les contraintes de classe sur les armes et armures.

const ADD2E_HUD_EQUIPMENT_TABS_VERSION = "2026-06-16-hud-equipment-tabs-v1";
const HUD_ID = "add2e-action-hud";
const STYLE_ID = "add2e-action-hud-equipment-tabs-style";
const TAB_PROJECTILES = "projectiles";
const TAB_ARMURES = "armures";

let activeExtensionTab = null;
let observer = null;
let patching = false;

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

function lower(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function norm(value) {
  return lower(value).replace(/[’']/g, "").replace(/[^a-z0-9:_-]+/g, "_").replace(/^_|_$/g, "");
}

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
function itemType(item) { return String(item?.type ?? "").toLowerCase(); }
function getItem(actor, id) { return actor?.items?.get?.(id) ?? actorItems(actor).find(item => item.id === id || item._id === id) ?? null; }

function currentHudActor() {
  const check = globalThis.add2eHudCheck?.();
  const id = check?.actorId ?? null;
  const controlled = canvas?.tokens?.controlled ?? [];
  if (id) {
    const tokenActor = controlled.find(token => token?.actor?.id === id)?.actor ?? null;
    if (tokenActor) return tokenActor;
    const worldActor = game.actors?.get?.(id) ?? null;
    if (worldActor) return worldActor;
  }
  if (controlled.length === 1 && controlled[0]?.actor) return controlled[0].actor;
  return game.user?.character ?? null;
}

function itemEquipped(item) {
  const system = item?.system ?? {};
  return system.equipee === true || system.equipped === true || system.portee === true || system.worn === true || system.estEquipee === true;
}

function itemTags(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [
    item?.name, system.nom, system.categorie, system.category, system.type, system.sousType, system.sous_type,
    system.type_arme, system.famille, system.famille_arme, system.tags, system.effectTags, system.effecttags,
    flags.tags, flags.effectTags, flags.effecttags
  ].flatMap(arr).map(norm).filter(Boolean);
}

function quantity(item) {
  const system = item?.system ?? {};
  const value = system.quantite ?? system.quantity ?? system.qty ?? system.nombre ?? system.nb ?? system.uses?.value ?? system.charges?.value;
  return value === undefined || value === null || value === "" ? "—" : String(value);
}

function damage(item) {
  const system = item?.system ?? {};
  return system?.dégâts?.contre_moyen ?? system?.degats?.contre_moyen ?? system?.degats_moyen ?? system?.damage ?? system?.degats ?? system?.dmg ?? "—";
}

function range(item) {
  const system = item?.system ?? {};
  const values = [system.portee_courte ?? system.portee_short, system.portee_moyenne ?? system.portee_medium, system.portee_longue ?? system.portee_long]
    .filter(value => value !== undefined && value !== null && String(value) !== "");
  return values.length ? values.join(" / ") : "Contact";
}

function isPropelledWeapon(item) {
  const tags = itemTags(item);
  const name = norm(item?.name);
  const system = item?.system ?? {};
  return system.projectile_propulse === true || system.arme_a_projectile === true || tags.includes("projectile_propulse") || tags.includes("usage_projectile_propulse") || ["arc", "arbalete", "fronde"].some(key => name.includes(key));
}

function isAmmunitionItem(item) {
  if (!item) return false;
  if (typeof globalThis.add2eIsArmorerAmmunition === "function" && globalThis.add2eIsArmorerAmmunition(item)) return true;
  const system = item.system ?? {};
  const name = lower(item.name);
  const fields = [system.categorie, system.category, system.sousType, system.sous_type, system.type, system.subtype, system.kind, system.slot].map(lower).filter(Boolean);
  const tags = itemTags(item);
  const accepted = new Set(["munition", "munitions", "projectile", "projectiles", "ammo", "ammunition", "trait:munition", "trait:projectile", "categorie:munition", "categorie:projectile", "type:munition", "type:projectile"]);
  if (/\b(carquois|quiver|etui|etuis|étui|étuis|sac|sacoche|container|contenant|boite|boîte|bourse)\b/.test(name)) return false;
  if (fields.some(value => ["carquois", "quiver", "contenant", "container", "sac", "sacoche"].includes(value))) return false;
  if (tags.some(value => ["carquois", "quiver", "contenant", "container", "sac", "sacoche"].includes(value))) return false;
  if (fields.some(value => accepted.has(value))) return true;
  if (tags.some(value => accepted.has(value) || value.startsWith("munition:") || value.startsWith("projectile:"))) return true;
  return /\b(fleche|fleches|flèche|flèches|carreau|carreaux|trait|traits|bille|billes|pierre de fronde|pierres de fronde)\b/.test(name);
}

function projectileKeys(item) {
  const text = `${norm(item?.name)} ${itemTags(item).join(" ")}`;
  if (text.includes("arbalete")) return ["carreau", "carreaux", "bolt"];
  if (text.includes("arc")) return ["fleche", "fleches", "arrow"];
  if (text.includes("fronde")) return ["bille", "billes", "pierre", "pierres", "bullet"];
  return ["munition", "projectile", "ammo"];
}

function equippedProjectile(actor, weapon) {
  if (!isPropelledWeapon(weapon)) return null;
  const keys = projectileKeys(weapon).map(norm);
  const items = actorItems(actor).filter(item => item.id !== weapon.id && itemEquipped(item) && isAmmunitionItem(item) && keys.some(key => norm(item.name).includes(key) || itemTags(item).some(tag => tag.includes(key))));
  return items.find(item => quantity(item) !== "0") ?? items[0] ?? null;
}

function weapons(actor) {
  return actorItems(actor).filter(item => itemType(item) === "arme").sort((a, b) => Number(itemEquipped(b)) - Number(itemEquipped(a)) || String(a.name).localeCompare(String(b.name)));
}

function projectiles(actor) {
  return actorItems(actor).filter(isAmmunitionItem).sort((a, b) => Number(itemEquipped(b)) - Number(itemEquipped(a)) || String(a.name).localeCompare(String(b.name)));
}

function armors(actor) {
  return actorItems(actor).filter(item => itemType(item) === "armure").sort((a, b) => Number(itemEquipped(b)) - Number(itemEquipped(a)) || String(a.name).localeCompare(String(b.name)));
}

function usability(actor, item) {
  if (isAmmunitionItem(item)) return { usable: true, label: "Projectile", reason: "Munition équipable dans le carquois" };
  if (itemType(item) !== "arme" && itemType(item) !== "armure") return { usable: true, label: "Équipement", reason: "Objet hors restriction de classe" };
  if (typeof globalThis.add2eArmorerUsability === "function") return globalThis.add2eArmorerUsability(actor, item);
  return { usable: false, label: "Contrôle indisponible", reason: "La fonction de contraintes de classe n’est pas chargée" };
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
#${HUD_ID} .a2e-hud-tabs{grid-template-columns:repeat(9,1fr)!important}
#${HUD_ID} .row.hud-equip-row{grid-template-columns:42px minmax(0,1fr) auto auto}
#${HUD_ID} .hud-equip-row .attack-disabled{opacity:.38;cursor:not-allowed;filter:grayscale(.8)}
#${HUD_ID} .hud-blocked{color:#ffb1a8;border:1px solid rgba(190,55,45,.62);background:rgba(110,25,20,.42);padding:1px 6px;border-radius:999px}
#${HUD_ID} .hud-usable{color:#b8ffb8;border:1px solid rgba(80,180,80,.55);background:rgba(35,100,35,.35);padding:1px 6px;border-radius:999px}
#${HUD_ID} .hud-kind{color:#ffe4a1;border:1px solid rgba(214,176,90,.42);background:rgba(214,176,90,.12);padding:1px 6px;border-radius:999px}
`;
  document.head.appendChild(style);
}

function attackButton(item, enabled) {
  const classes = enabled ? "img-act" : "img-act attack-disabled";
  const title = enabled ? `Attaquer avec ${item.name}` : `${item.name} doit être équipé pour attaquer`;
  return `<button type="button" class="${classes}" ${enabled ? "data-action=\"attack\"" : ""} data-item-id="${esc(item.id)}" title="${esc(title)}"><img src="${esc(item.img || "icons/svg/sword.svg")}" alt=""></button>`;
}

function equipButton(item) {
  const equipped = itemEquipped(item);
  return `<button type="button" class="act" data-add2e-hud-action="toggle-equip" data-item-id="${esc(item.id)}">${equipped ? "Retirer" : "Équiper"}</button>`;
}

function weaponRow(actor, item) {
  const equipped = itemEquipped(item);
  const projectile = equippedProjectile(actor, item);
  const propelled = isPropelledWeapon(item);
  const use = usability(actor, item);
  const dmg = propelled && projectile ? `Dégâts projectile ${damage(projectile)}` : `Dégâts ${damage(item)}`;
  const ammo = propelled ? (projectile ? `<span class="ammo"><img src="${esc(projectile.img || "icons/svg/target.svg")}" alt="">${esc(projectile.name)} ×${esc(quantity(projectile))}</span>` : `<span class="ammo-missing">Aucune munition équipée</span>`) : "";
  const state = equipped ? `<span class="equip-ok">Équipée</span>` : `<span class="equip-off">Non équipée</span>`;
  const usable = use.usable ? `<span class="hud-usable">${esc(use.label ?? "Utilisable")}</span>` : `<span class="hud-blocked" title="${esc(use.reason)}">${esc(use.label ?? "Non utilisable")}</span>`;
  return `<div class="row hud-equip-row">${attackButton(item, equipped)}<div><div class="title">${esc(item.name)}</div><div class="meta"><span>${esc(dmg)}</span><span>Portée ${esc(range(item))}</span>${state}${usable}${ammo}</div></div>${equipButton(item)}</div>`;
}

function projectileRow(actor, item) {
  const equipped = itemEquipped(item);
  const qty = quantity(item);
  const state = equipped ? `<span class="equip-ok">Équipé</span>` : `<span class="equip-off">Non équipé</span>`;
  return `<div class="row hud-equip-row"><img src="${esc(item.img || "icons/svg/target.svg")}" alt=""><div><div class="title">${esc(item.name)}${qty !== "—" ? ` ×${esc(qty)}` : ""}</div><div class="meta"><span class="hud-kind">Projectile</span>${state}<span>Carquois</span></div></div>${equipButton(item)}</div>`;
}

function armorRow(actor, item) {
  const equipped = itemEquipped(item);
  const use = usability(actor, item);
  const state = equipped ? `<span class="equip-ok">Équipée</span>` : `<span class="equip-off">Non équipée</span>`;
  const usable = use.usable ? `<span class="hud-usable">${esc(use.label ?? "Utilisable")}</span>` : `<span class="hud-blocked" title="${esc(use.reason)}">${esc(use.label ?? "Non utilisable")}</span>`;
  const system = item.system ?? {};
  const ca = system.ca ?? system.ac ?? system.armorClass ?? system.base_ca ?? "—";
  return `<div class="row hud-equip-row"><img src="${esc(item.img || "icons/svg/shield.svg")}" alt=""><div><div class="title">${esc(item.name)}</div><div class="meta"><span>CA ${esc(ca)}</span>${state}${usable}</div></div>${equipButton(item)}</div>`;
}

function weaponPanel(actor) {
  const rows = weapons(actor);
  if (!rows.length) return `<div class="empty">Aucune arme.</div>`;
  return rows.map(item => weaponRow(actor, item)).join("");
}

function projectilePanel(actor) {
  const rows = projectiles(actor);
  if (!rows.length) return `<div class="empty">Aucun projectile dans le carquois.</div>`;
  return rows.map(item => projectileRow(actor, item)).join("");
}

function armorPanel(actor) {
  const rows = armors(actor);
  if (!rows.length) return `<div class="empty">Aucune armure.</div>`;
  return rows.map(item => armorRow(actor, item)).join("");
}

function ensureTab(nav, key, icon, label, afterKey = "attaques") {
  let button = nav.querySelector(`[data-add2e-hud-tab="${key}"]`);
  if (button) return button;
  button = document.createElement("button");
  button.type = "button";
  button.className = "a2e-hud-tab";
  button.dataset.add2eHudTab = key;
  button.innerHTML = `<i class="${icon}"></i> ${label}`;
  const after = nav.querySelector(`[data-tab="${afterKey}"], [data-add2e-hud-tab="${afterKey}"]`);
  if (after?.nextSibling) nav.insertBefore(button, after.nextSibling);
  else nav.appendChild(button);
  return button;
}

function ensureSection(panel, key) {
  let section = panel.querySelector(`section[data-add2e-hud-section="${key}"]`);
  if (section) return section;
  section = document.createElement("section");
  section.dataset.add2eHudSection = key;
  panel.appendChild(section);
  return section;
}

function setExtensionTab(element, key) {
  const panel = element.querySelector(".a2e-hud-panel");
  if (!panel) return;
  activeExtensionTab = key;
  element.querySelectorAll(".a2e-hud-tab").forEach(button => button.classList.remove("active"));
  element.querySelector(`[data-add2e-hud-tab="${key}"]`)?.classList.add("active");
  panel.querySelectorAll("section").forEach(section => section.classList.remove("active"));
  const section = ensureSection(panel, key);
  section.classList.add("active");
  renderExtensionSection(element, key);
}

function renderExtensionSection(element, key) {
  const actor = currentHudActor();
  const panel = element.querySelector(".a2e-hud-panel");
  if (!actor || !panel) return;
  const section = ensureSection(panel, key);
  if (key === TAB_PROJECTILES) section.innerHTML = projectilePanel(actor);
  if (key === TAB_ARMURES) section.innerHTML = armorPanel(actor);
}

function patchHud() {
  if (patching) return;
  const element = document.getElementById(HUD_ID);
  if (!element) return;
  const actor = currentHudActor();
  const panel = element.querySelector(".a2e-hud-panel");
  const nav = element.querySelector(".a2e-hud-tabs");
  if (!actor || !panel || !nav) return;

  patching = true;
  try {
    injectStyle();
    ensureTab(nav, TAB_PROJECTILES, "fas fa-bullseye", "Proj.", "attaques");
    ensureTab(nav, TAB_ARMURES, "fas fa-shield-alt", "Armures", TAB_PROJECTILES);

    const attackSection = panel.querySelector('section[data-section="attaques"]');
    if (attackSection && attackSection.dataset.add2eEquipmentPatched !== ADD2E_HUD_EQUIPMENT_TABS_VERSION) {
      attackSection.innerHTML = weaponPanel(actor);
      attackSection.dataset.add2eEquipmentPatched = ADD2E_HUD_EQUIPMENT_TABS_VERSION;
    }

    ensureSection(panel, TAB_PROJECTILES);
    ensureSection(panel, TAB_ARMURES);
    if (activeExtensionTab === TAB_PROJECTILES || activeExtensionTab === TAB_ARMURES) setExtensionTab(element, activeExtensionTab);
  } finally {
    patching = false;
  }
}

async function setEquipped(item, value) {
  await item.update({
    "system.equipee": value,
    "system.equipped": value,
    "system.estEquipee": value,
    "system.worn": value,
    "system.portee": value
  }, { add2eReason: "hud-equipment-tabs-toggle" });
}

async function toggleEquipFromHud(itemId) {
  const actor = currentHudActor();
  const item = getItem(actor, itemId);
  if (!actor || !item) return ui.notifications.warn("Objet introuvable dans le HUD.");
  const next = !itemEquipped(item);
  if (next && (itemType(item) === "arme" || itemType(item) === "armure")) {
    const use = usability(actor, item);
    if (!use.usable) return ui.notifications.warn(`${item.name} : ${use.reason ?? "non utilisable par la classe"}.`);
  }
  await setEquipped(item, next);
  globalThis.add2eRefreshActionHud?.();
  setTimeout(patchHud, 80);
}

function onDocumentClick(event) {
  const tab = event.target?.closest?.(`#${HUD_ID} [data-add2e-hud-tab]`);
  if (tab) {
    event.preventDefault();
    event.stopPropagation();
    const element = document.getElementById(HUD_ID);
    if (element) setExtensionTab(element, tab.dataset.add2eHudTab);
    return;
  }

  const action = event.target?.closest?.(`#${HUD_ID} [data-add2e-hud-action="toggle-equip"]`);
  if (action) {
    event.preventDefault();
    event.stopPropagation();
    toggleEquipFromHud(action.dataset.itemId);
  }
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver(() => setTimeout(patchHud, 0));
  observer.observe(document.body, { childList: true, subtree: true });
}

Hooks.once("ready", () => {
  document.addEventListener("click", onDocumentClick, true);
  startObserver();
  setTimeout(patchHud, 500);
});

for (const hookName of ["createItem", "updateItem", "deleteItem", "updateActor"]) {
  Hooks.on(hookName, doc => {
    const actor = doc?.parent ?? doc;
    const current = currentHudActor();
    if (actor?.id && current?.id === actor.id) setTimeout(patchHud, 100);
  });
}

try { globalThis.ADD2E_HUD_EQUIPMENT_TABS_VERSION = ADD2E_HUD_EQUIPMENT_TABS_VERSION; } catch (_e) {}
