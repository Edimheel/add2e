// scripts/add2e-action-hud.mjs
// ADD2E — HUD d'action rapide maison.
// Version : 2026-06-16-v45-equipment-tabs
// Le HUD reste une interface : les actions délèguent aux fonctions système.

const ADD2E_ACTION_HUD_VERSION = "2026-06-16-v45-equipment-tabs";
const HUD_ID = "add2e-action-hud";
const STYLE_ID = "add2e-action-hud-style";
const STORAGE_KEY = "add2e.actionHud.state.v45";
const LEGACY_STORAGE_KEYS = ["add2e.actionHud.state.v44"];
const TAG = "[ADD2E][ACTION_HUD]";
const EDGE_PAD = 0;
const HANDLE_VISIBLE = 42;

let hudActor = null;
let hudToken = null;
let activeTab = "attaques";
let selectedSpellGroup = null;
let dragging = false;
let resizing = false;
let manualIntentUntil = 0;
let state = null;

const TABS = ["attaques", "projectiles", "armures", "sorts", "capacites", "effets", "sauvegardes", "caracs"];
const CARACS = [
  ["force", "FOR", "Force", "fa-fist-raised"],
  ["dexterite", "DEX", "Dextérité", "fa-running"],
  ["constitution", "CON", "Constitution", "fa-heart"],
  ["intelligence", "INT", "Intelligence", "fa-brain"],
  ["sagesse", "SAG", "Sagesse", "fa-eye"],
  ["charisme", "CHA", "Charisme", "fa-comments"]
];
const SAVES = [
  ["Paralysie", "Paralysie / poison / mort", "fa-skull-crossbones"],
  ["Pétrification", "Pétrification / métamorphose", "fa-mountain"],
  ["Baguettes", "Baguettes", "fa-magic"],
  ["Souffles", "Souffles", "fa-wind"],
  ["Sorts", "Sorts", "fa-scroll"]
];

function esc(value) {
  try { return foundry.utils.escapeHTML(String(value ?? "")); }
  catch (_e) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }
}

function arr(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(arr);
  if (value instanceof Set) return [...value];
  if (typeof value?.values === "function") return [...value.values()];
  if (typeof value === "object") return Object.values(value);
  return [value];
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

function norm(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9:_-]+/g, "_").replace(/^_|_$/g, "");
}
function lower(value) { return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function slug(value) { return lower(value).replace(/[’']/g, "_").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function hud() { return document.getElementById(HUD_ID); }
function currentActor() { return hudActor ?? canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null; }
function tokenFor(actor) { return canvas?.tokens?.controlled?.find?.(t => t.actor?.id === actor?.id) ?? actor?.getActiveTokens?.()[0] ?? null; }
function actorType(actor) { return norm(actor?.type ?? actor?._source?.type ?? actor?.baseActor?.type ?? ""); }
function canUse(actor) { return !!actor && (game.user?.isGM || actor.isOwner || actor.testUserPermission?.(game.user, "OWNER")); }
function isMonsterActor(actor) { return actorType(actor) === "monster"; }
function usesProjectileInventory(actor) { return actorType(actor) === "personnage"; }
function relevant(actor) {
  const type = actorType(actor);
  if (type === "personnage") return canUse(actor);
  if (type === "monster") return game.user?.isGM === true;
  return false;
}

function defaultState() { return { left: 80, top: 80, bottom: null, width: 720, maxMenuHeight: 380, collapsed: false }; }
function normalizeLoadedState(raw = {}) {
  const normalized = { ...defaultState(), ...(raw || {}) };
  normalized.width = num(normalized.width, 720);
  normalized.maxMenuHeight = num(normalized.maxMenuHeight ?? normalized.menuHeight, 380);
  normalized.left = num(normalized.left, 80);
  normalized.top = Number.isFinite(Number(normalized.top)) ? Number(normalized.top) : 80;
  normalized.bottom = null;
  return normalized;
}
function loadState() {
  if (state) return state;
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_e) { raw = null; }
  if (!raw) for (const key of LEGACY_STORAGE_KEYS) {
    try { raw = JSON.parse(localStorage.getItem(key) || "null"); } catch (_e) { raw = null; }
    if (raw) break;
  }
  state = normalizeLoadedState(raw);
  return state;
}
function saveState(partial = {}) { Object.assign(loadState(), partial); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_e) {} }
function resetHudPosition() { const collapsed = loadState().collapsed === true; state = { ...defaultState(), collapsed }; saveState(state); applyGeometry(hud(), true); return state; }
function applyGeometry(element = hud(), force = false) {
  if (!element || (!force && (dragging || resizing))) return;
  const current = loadState();
  const viewportWidth = Math.max(1, window.innerWidth || document.documentElement?.clientWidth || 1);
  const viewportHeight = Math.max(1, window.innerHeight || document.documentElement?.clientHeight || 1);
  const elementWidth = element.offsetWidth || current.width || 720;
  const elementHeight = element.offsetHeight || 110;
  current.width = clamp(num(current.width, 720), 380, Math.max(440, viewportWidth));
  current.left = clamp(num(current.left, 80), Math.min(EDGE_PAD, viewportWidth - HANDLE_VISIBLE), Math.max(EDGE_PAD, viewportWidth - Math.min(elementWidth, HANDLE_VISIBLE)));
  current.top = clamp(Number.isFinite(Number(current.top)) ? Number(current.top) : 80, EDGE_PAD, Math.max(EDGE_PAD, viewportHeight - Math.min(elementHeight, HANDLE_VISIBLE)));
  current.bottom = null;
  current.maxMenuHeight = clamp(num(current.maxMenuHeight, 380), 120, Math.max(160, viewportHeight - 60));
  element.style.left = `${Math.round(current.left)}px`;
  element.style.top = `${Math.round(current.top)}px`;
  element.style.bottom = "auto";
  element.style.right = "auto";
  element.style.width = `${Math.round(current.width)}px`;
  element.style.setProperty("--a2e-hud-menu-max", `${Math.round(current.maxMenuHeight)}px`);
}
function setCollapsed(value, persist = true) { const element = hud(); if (!element) return; element.classList.toggle("collapsed", !!value); if (persist) saveState({ collapsed: !!value }); }

function itemEquipped(item) {
  const s = item?.system ?? {};
  return s.equipee === true || s.equipped === true || s.portee === true || s.worn === true || s.estEquipee === true;
}
function itemTags(item) {
  const s = item?.system ?? {}, f = item?.flags?.add2e ?? {};
  return [item?.name, s.nom, s.categorie, s.category, s.type, s.sousType, s.sous_type, s.type_arme, s.famille, s.famille_arme, s.tags, s.effectTags, f.tags, f.effectTags].flatMap(arr).map(norm).filter(Boolean);
}
function isAmmunitionItem(item) {
  if (!item) return false;
  const s = item.system ?? {}, tags = itemTags(item), fields = [s.categorie, s.category, s.sousType, s.sous_type, s.type, s.kind].map(norm);
  if (fields.some(v => ["munition", "munitions", "projectile", "projectiles", "ammo", "ammunition"].includes(v))) return true;
  if (tags.some(t => ["munition", "munitions", "projectile", "projectiles", "trait_munition", "trait:munition", "trait_projectile", "trait:projectile"].includes(t) || t.startsWith("munition:") || t.startsWith("projectile:"))) return true;
  const name = lower(item.name);
  return /\b(fleche|fleches|flèche|flèches|carreau|carreaux|bille|billes|pierre de fronde|pierres de fronde|aiguille|aiguilles)\b/.test(name);
}
function isWeaponItem(item) { return ["arme", "weapon"].includes(String(item?.type ?? "").toLowerCase()) && !isAmmunitionItem(item); }
function isArmorItem(item) { return ["armure", "armor"].includes(String(item?.type ?? "").toLowerCase()); }
function add2eIsShieldLocal(item) { const tags = itemTags(item); const name = norm(item?.name); return tags.includes("bouclier") || tags.includes("categorie_armure:bouclier") || name.includes("bouclier"); }
function add2eIsHelmetLocal(item) { const tags = itemTags(item); const name = norm(item?.name); return tags.includes("heaume") || tags.includes("casque") || name.includes("heaume") || name.includes("casque"); }
function isPropelledWeapon(item) {
  const s = item?.system ?? {}, tags = itemTags(item), name = norm(item?.name);
  return s.projectile_propulse === true || s.arme_a_projectile === true || tags.includes("projectile_propulse") || tags.includes("usage_projectile_propulse") || tags.includes("usage:projectile_propulse") || ["arc", "arbalete", "arbalete", "fronde"].some(k => name.includes(k));
}
function weaponIsRanged(item) {
  const s = item?.system ?? {}, tags = itemTags(item);
  return isPropelledWeapon(item) || s.arme_de_jet === true || !!s.portee_courte || !!s.portee_moyenne || !!s.portee_longue || tags.includes("usage:distance") || tags.includes("usage_lancer") || tags.includes("usage:lancer");
}
function ammoType(item) { const s = item?.system ?? {}; return slug(s.munitionType ?? s.munition_type ?? s.sousType ?? s.sous_type ?? s.categorie ?? item?.name ?? ""); }
function projectileKeys(weapon) {
  const text = `${norm(weapon?.name)} ${itemTags(weapon).join(" ")}`;
  const explicit = norm(weapon?.system?.munition_requise ?? weapon?.system?.munitionRequise ?? weapon?.system?.ammoType ?? weapon?.system?.ammunitionType ?? "");
  if (explicit) return [explicit, explicit.replace(/s$/, "")];
  if (text.includes("arbalete")) return ["carreau", "carreaux", "bolt"];
  if (text.includes("arc")) return ["fleche", "fleches", "arrow"];
  if (text.includes("fronde")) return ["bille", "billes", "pierre", "pierres", "bullet"];
  return ["munition", "projectile", "ammo"];
}
function projectileCompatibleWithWeapon(projectile, weapon) {
  const keys = projectileKeys(weapon).map(norm).filter(Boolean);
  const text = `${norm(projectile?.name)} ${ammoType(projectile)} ${itemTags(projectile).join(" ")}`;
  return keys.some(key => text.includes(key) || key.includes(ammoType(projectile)) || ammoType(projectile).includes(key));
}
function quantity(item) { const s = item?.system ?? {}; const v = s.quantite ?? s.quantity ?? s.qty ?? s.nombre ?? s.nb ?? s.uses?.value ?? s.charges?.value; return v === undefined || v === null || v === "" ? "—" : String(v); }
function quantityNumber(item, fallback = 1) { const q = quantity(item); return q === "—" ? fallback : num(q, fallback); }
function damage(item) { const s = item?.system ?? {}; return s?.dégâts?.contre_moyen ?? s?.degats?.contre_moyen ?? s?.degats_moyen ?? s?.damage ?? s?.degats ?? s?.dmg ?? "—"; }
function range(item) { const s = item?.system ?? {}; const values = [s.portee_courte ?? s.portee_short, s.portee_moyenne ?? s.portee_medium, s.portee_longue ?? s.portee_long].filter(v => v !== undefined && v !== null && String(v) !== ""); return values.length ? values.join(" / ") : "Contact"; }
function weapons(actor) { return actor?.items?.filter?.(isWeaponItem) ?? []; }
function projectiles(actor) { return actor?.items?.filter?.(isAmmunitionItem) ?? []; }
function armors(actor) { return actor?.items?.filter?.(isArmorItem) ?? []; }
function equippedProjectile(actor, weapon) {
  if (!usesProjectileInventory(actor) || !isPropelledWeapon(weapon)) return null;
  return projectiles(actor).find(p => itemEquipped(p) && quantity(p) !== "0" && projectileCompatibleWithWeapon(p, weapon)) ?? projectiles(actor).find(p => itemEquipped(p) && quantity(p) !== "0") ?? null;
}
function checkEquipment(actor, item, kind) {
  if (isMonsterActor(actor)) return { ok: true, classeLabel: "Monstre", reason: "monster" };
  if (typeof globalThis.add2eCheckEquipmentAllowedForClass === "function") return globalThis.add2eCheckEquipmentAllowedForClass(actor, item, kind);
  return { ok: true, classeLabel: actor?.system?.classe || "classe", reason: "fallback" };
}
function equipmentReason(check, kind) {
  if (check.reason === "forbidden") return `tag interdit : ${check.matchedForbidden}`;
  return kind === "arme" ? "arme non autorisée par les restrictions de classe" : "protection non autorisée par les restrictions de classe";
}

function sumPreparedTree(value) { if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value); if (typeof value === "string") return Math.max(0, num(value, 0)); if (!value || typeof value !== "object") return 0; return Object.values(value).reduce((a, v) => a + sumPreparedTree(v), 0); }
function preparedCount(sort) {
  const f = sort?.flags?.add2e ?? {}, s = sort?.system ?? {};
  const values = [sort?.getFlag?.("add2e", "memorizedCount"), f.memorizedCount, f.preparedCount, s.memorizedCount, s.preparedCount, s.prepared, s.memorise, s.memorized, s.memorisation?.value, s.memorisation, s.slots?.prepared, s.slots?.value];
  let best = 0;
  for (const v of values) { const n = num(v, NaN); if (Number.isFinite(n) && n > best) best = n; }
  best = Math.max(best, sumPreparedTree(sort?.getFlag?.("add2e", "memorizedByList")), sumPreparedTree(f.memorizedByList), sumPreparedTree(f.preparedByList), sumPreparedTree(s.memorizedByList), sumPreparedTree(s.preparedByList));
  try { const total = Number(globalThis.add2eGetTotalMemorizedCount?.(sort)); if (Number.isFinite(total) && total > best) best = total; } catch (_e) {}
  return Math.max(0, best);
}
function isObjectPowerSpell(sort) { const s = sort?.system ?? {}; if (s.isPower === true || s.isObjectPower === true || s.sourceWeaponId || s.sourceItemId || s.powerIndex !== undefined) return true; try { return globalThis.add2eIsObjectMagicSpellForPreparation?.(sort) === true; } catch (_e) { return false; } }
function spells(actor) { return actor?.items?.filter?.(i => String(i.type ?? "").toLowerCase() === "sort" && !isObjectPowerSpell(i) && preparedCount(i) > 0) ?? []; }
function spellLevel(sort) { return Math.max(0, num(sort?.system?.niveau ?? sort?.system?.level ?? sort?.system?.niveau_sort, 0)); }
function spellListLabel(sort) { const s = sort?.system ?? {}; const raw = [s.liste, s.list, s.spellList, s.classe, s.class, s.sourceClasse, s.casterClass, ...arr(s.lists), ...arr(s.listes), ...arr(s.classes)].map(v => String(v ?? "").trim()).find(Boolean) || "Mag"; const n = norm(raw); if (n.includes("clerc") || n.includes("pretre") || n.includes("priest")) return "Clerc"; if (n.includes("druid") || n.includes("druide")) return "Dru"; if (n.includes("ranger")) return "Rng"; if (n.includes("paladin")) return "Pal"; if (n.includes("mag") || n.includes("wizard") || n.includes("mage")) return "Mag"; return String(raw).slice(0, 6); }
function spellGroupKey(sort) { return `${spellListLabel(sort)}|${spellLevel(sort)}`; }
function features(actor) { if (typeof globalThis.add2eGetActorActivableClassFeatures === "function") return globalThis.add2eGetActorActivableClassFeatures(actor, { includeLocked: false }) ?? []; return []; }
function effects(actor) { const map = new Map(); for (const e of arr(actor?.effects)) if (e && e.disabled !== true) map.set(e.id, e); return [...map.values()]; }
function ability(actor, key) { const direct = Number(actor?.system?.[key]); return Number.isFinite(direct) ? direct : num(actor?.system?.[`${key}_base`], 10); }
function savingThrows(actor) { const level = Math.max(1, num(actor?.system?.niveau, 1)); const row = actor?.system?.details_classe?.progression?.[level - 1]; const values = arr(row?.savingThrows || actor?.system?.sauvegardes || actor?.system?.savingThrows || []).map(v => num(v, 0)); return values.length >= 5 ? values.slice(0, 5) : [0, 0, 0, 0, 0]; }
function hp(actor) { return num(actor?.system?.pdv ?? actor?.system?.pv?.value ?? actor?.system?.hp?.value ?? actor?.system?.hp, 0); }
function hpMax(actor) { return num(actor?.system?.points_de_coup ?? actor?.system?.pv?.max ?? actor?.system?.hp?.max ?? actor?.system?.hpMax, hp(actor)); }
function armorClass(actor) { return actor?.system?.ca_total ?? actor?.system?.ca ?? actor?.system?.armorClass ?? actor?.system?.ac ?? "—"; }
function thaco(actor) { const direct = actor?.system?.thac0 ?? actor?.system?.thaco ?? actor?.system?.combat?.thac0; if (direct !== undefined && direct !== null && direct !== "") return direct; const level = Math.max(1, num(actor?.system?.niveau, 1)); return actor?.system?.details_classe?.progression?.[level - 1]?.thac0 ?? 20; }

function injectStyle() {
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
#${HUD_ID}{position:fixed;z-index:100;right:auto!important;bottom:auto!important;min-width:380px;color:#f6e8bd;font-family:var(--font-primary,Signika,sans-serif);pointer-events:auto;user-select:none;touch-action:none}
#${HUD_ID}.collapsed .a2e-hud-panel{display:none!important}
#${HUD_ID} .a2e-hud-shell{border:1px solid #8a611d;border-radius:14px;overflow:hidden;background:linear-gradient(145deg,rgba(32,25,16,.97),rgba(18,14,10,.96));box-shadow:0 8px 26px rgba(0,0,0,.48)}
#${HUD_ID} .a2e-hud-panel{max-height:var(--a2e-hud-menu-max,380px);overflow:auto;padding:9px;border-bottom:1px solid rgba(184,137,36,.45);background:rgba(0,0,0,.13)}
#${HUD_ID} section{display:none} #${HUD_ID} section.active{display:grid;gap:7px}
#${HUD_ID} .a2e-hud-tabs{display:grid;grid-template-columns:repeat(8,1fr);background:rgba(0,0,0,.18);border-bottom:1px solid rgba(184,137,36,.45)}
#${HUD_ID} .a2e-hud-tab{min-height:34px;border:0;border-right:1px solid rgba(184,137,36,.32);background:transparent;color:#d8bd78;font-size:.68em;font-weight:900;cursor:pointer}
#${HUD_ID} .a2e-hud-tab.active{color:#211307;background:linear-gradient(180deg,#f0c66d,#c78d2e)}
#${HUD_ID} .a2e-hud-header{display:grid;grid-template-columns:74px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:9px 10px;background:linear-gradient(180deg,rgba(78,48,18,.78),rgba(36,26,14,.62));cursor:move;touch-action:none}
#${HUD_ID} .portrait{width:64px;height:64px;border-radius:12px;object-fit:cover;border:2px solid #c4973f;background:#111}
#${HUD_ID} .name{color:#fff4cf;font-size:1.12em;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${HUD_ID} .sub{color:#d8bd78;font-size:.82em;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${HUD_ID} .pills{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px} #${HUD_ID} .pill{display:inline-flex;min-height:22px;padding:2px 7px;border:1px solid rgba(214,176,90,.75);border-radius:999px;background:rgba(255,244,201,.12);color:#fff0bd;font-size:.78em;font-weight:850}
#${HUD_ID} .icon{width:30px;height:30px;border:1px solid rgba(214,176,90,.75);border-radius:9px;background:rgba(255,244,201,.12);color:#ffe4a1;cursor:pointer} #${HUD_ID} .resize{cursor:nwse-resize!important}
#${HUD_ID} .row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:50px;padding:6px;border:1px solid rgba(214,176,90,.38);border-radius:10px;background:rgba(255,250,235,.07)}
#${HUD_ID} .row.compact{grid-template-columns:minmax(0,1fr) auto;min-height:38px} #${HUD_ID} .row.effect-row{grid-template-columns:42px minmax(0,1fr) auto}
#${HUD_ID} .row img{width:36px;height:36px;border-radius:7px;object-fit:cover;border:1px solid rgba(214,176,90,.65);background:rgba(0,0,0,.25)}
#${HUD_ID} .img-act{width:38px;height:38px;padding:0;border:1px solid rgba(214,176,90,.75);border-radius:8px;background:rgba(0,0,0,.22);cursor:pointer;display:flex;align-items:center;justify-content:center} #${HUD_ID} .img-act:disabled{opacity:.45;cursor:not-allowed} #${HUD_ID} .img-act:hover:not(:disabled){filter:brightness(1.22)} #${HUD_ID} .img-act img{width:34px;height:34px;border:0;border-radius:7px}
#${HUD_ID} .title{color:#fff4cf;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} #${HUD_ID} .meta{display:flex;flex-wrap:wrap;gap:4px 8px;color:#c8ad6e;font-size:.76em;font-weight:750;margin-top:2px}
#${HUD_ID} .equip-ok{color:#b8ffb8} #${HUD_ID} .equip-bad{color:#ffb1a8} #${HUD_ID} .state{min-width:70px;text-align:center;font-weight:950;border:1px solid rgba(214,176,90,.35);border-radius:999px;padding:2px 6px;background:rgba(0,0,0,.18)}
#${HUD_ID} .ammo{display:inline-flex;align-items:center;gap:4px;color:#b8ffb8} #${HUD_ID} .ammo-missing{color:#ffb1a8} #${HUD_ID} .ammo-free{color:#ffe4a1;border:1px solid rgba(214,176,90,.4);border-radius:999px;padding:1px 6px;background:rgba(214,176,90,.12)} #${HUD_ID} .ammo img{width:18px;height:18px;border-radius:4px;border:1px solid rgba(214,176,90,.4)}
#${HUD_ID} .act{min-width:78px;min-height:30px;padding:4px 9px;border:1px solid #d6b05a;border-radius:9px;background:linear-gradient(180deg,#fff0bd,#d6a345);color:#211307;font-size:.8em;font-weight:950;cursor:pointer;white-space:nowrap} #${HUD_ID} .danger{min-width:36px;width:36px;color:#ffd0c8;border-color:#b94735;background:linear-gradient(180deg,#7d241b,#42120d)} #${HUD_ID} .empty{padding:12px;border:1px dashed rgba(214,176,90,.45);border-radius:10px;color:#c8ad6e;font-style:italic;text-align:center}
#${HUD_ID} .spell-layout{display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px} #${HUD_ID} .spell-levels{display:flex;flex-wrap:wrap;gap:6px;padding-bottom:2px;border-bottom:1px solid rgba(214,176,90,.28)} #${HUD_ID} .spell-level{min-height:30px;padding:5px 10px;border:1px solid rgba(214,176,90,.55);border-radius:999px;background:rgba(214,176,90,.12);color:#ffe4a1;font-weight:950;font-size:.82em;cursor:pointer} #${HUD_ID} .spell-level.active{background:linear-gradient(180deg,#f0c66d,#c78d2e);color:#211307} #${HUD_ID} .spell-list{display:grid;gap:6px;max-height:260px;overflow-y:auto;padding-right:3px} #${HUD_ID} .spell-list-title{color:#ffe4a1;font-weight:950;font-size:.82em;margin:0 0 2px 2px}
#${HUD_ID} .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px} #${HUD_ID} .cell{display:grid;grid-template-columns:38px minmax(0,1fr);gap:8px;align-items:center;min-height:48px;padding:8px;border-radius:12px;border:1px solid rgba(214,176,90,.38);background:rgba(255,250,235,.07)} #${HUD_ID} .cell b{display:block;color:#ffe4a1;font-size:1.32em;font-weight:950;line-height:1.05;text-shadow:0 1px 2px rgba(0,0,0,.45)} #${HUD_ID} .roll-icon{width:36px;height:36px;min-width:36px;padding:0;border-radius:10px;border:1px solid rgba(214,176,90,.65);background:rgba(255,244,201,.12);color:#ffe4a1;cursor:pointer}
#${HUD_ID} button,#${HUD_ID} [data-action],#${HUD_ID} [data-tab]{user-select:auto;touch-action:auto}`;
  document.head.appendChild(style);
}

function stateHtml(item) { return `<span class="state ${itemEquipped(item) ? "equip-ok" : "equip-bad"}">${itemEquipped(item) ? "Équipé" : "Rangé"}</span>`; }
function weaponRows(actor) {
  const rows = weapons(actor).sort((a, b) => Number(itemEquipped(b)) - Number(itemEquipped(a)) || String(a.name).localeCompare(String(b.name)));
  if (!rows.length) return `<div class="empty">Aucune arme.</div>`;
  return rows.map(item => {
    const projectile = equippedProjectile(actor, item);
    const propelled = isPropelledWeapon(item);
    const dmg = propelled && projectile ? `Dégâts projectile ${damage(projectile)}` : `Dégâts ${damage(item)}`;
    const ammo = propelled ? (usesProjectileInventory(actor) ? (projectile ? `<span class="ammo"><img src="${esc(projectile.img || "icons/svg/target.svg")}" alt="">${esc(projectile.name)} ×${esc(quantity(projectile))}</span>` : `<span class="ammo-missing">Aucune munition équipée</span>`) : `<span class="ammo-free">Munition PNJ non suivie</span>`) : "";
    const canAttack = itemEquipped(item);
    return `<div class="row"><button type="button" class="img-act" ${canAttack ? "" : "disabled"} data-action="attack" data-item-id="${esc(item.id)}" title="${canAttack ? `Attaquer avec ${esc(item.name)}` : "Équipez l'arme avant d'attaquer"}"><img src="${esc(item.img || "icons/svg/sword.svg")}" alt=""></button><div><div class="title">${esc(item.name)}</div><div class="meta"><span>${esc(dmg)}</span><span>Portée ${esc(range(item))}</span>${ammo}</div></div><button type="button" class="act" data-action="toggle-weapon" data-item-id="${esc(item.id)}">${itemEquipped(item) ? "Retirer" : "Équiper"}</button></div>`;
  }).join("");
}
function projectileRows(actor) {
  const rows = projectiles(actor).sort((a, b) => Number(itemEquipped(b)) - Number(itemEquipped(a)) || String(a.name).localeCompare(String(b.name)));
  if (!rows.length) return `<div class="empty">Aucun projectile dans le carquois.</div>`;
  return rows.map(item => `<div class="row"><img src="${esc(item.img || "icons/svg/target.svg")}" alt=""><div><div class="title">${esc(item.name)}</div><div class="meta">${stateHtml(item)}<span>Type ${esc(ammoType(item) || "—")}</span><span>Dégâts ${esc(damage(item))}</span><span>Qté ${esc(quantity(item))}</span></div></div><button type="button" class="act" data-action="toggle-projectile" data-item-id="${esc(item.id)}">${itemEquipped(item) ? "Retirer" : "Équiper"}</button></div>`).join("");
}
function armorRows(actor) {
  const rows = armors(actor).sort((a, b) => Number(itemEquipped(b)) - Number(itemEquipped(a)) || String(a.name).localeCompare(String(b.name)));
  if (!rows.length) return `<div class="empty">Aucune armure, bouclier ou heaume.</div>`;
  return rows.map(item => {
    const kind = add2eIsShieldLocal(item) ? "Bouclier" : add2eIsHelmetLocal(item) ? "Heaume" : "Armure";
    const ac = item.system?.ac ?? item.system?.ca ?? "—";
    const bonus = item.system?.bonus_ac ?? item.system?.bonus_ca ?? item.system?.bonus_magique ?? 0;
    return `<div class="row"><img src="${esc(item.img || "icons/svg/shield.svg")}" alt=""><div><div class="title">${esc(item.name)}</div><div class="meta">${stateHtml(item)}<span>${kind}</span><span>CA ${esc(ac)}</span><span>Bonus ${esc(bonus)}</span></div></div><button type="button" class="act" data-action="toggle-armor" data-item-id="${esc(item.id)}">${itemEquipped(item) ? "Retirer" : "Équiper"}</button></div>`;
  }).join("");
}
function spellRows(actor) {
  const rows = spells(actor).sort((a, b) => String(spellListLabel(a)).localeCompare(String(spellListLabel(b))) || spellLevel(a) - spellLevel(b) || String(a.name).localeCompare(String(b.name)));
  if (!rows.length) return `<div class="empty">Aucun sort mémorisé.</div>`;
  const groups = new Map();
  for (const spell of rows) { const key = spellGroupKey(spell); if (!groups.has(key)) groups.set(key, { key, label: spellListLabel(spell), level: spellLevel(spell), items: [] }); groups.get(key).items.push(spell); }
  const list = [...groups.values()];
  if (!selectedSpellGroup || !groups.has(selectedSpellGroup)) selectedSpellGroup = list[0].key;
  const active = groups.get(selectedSpellGroup) ?? list[0];
  const buttons = list.map(g => `<button type="button" class="spell-level ${g.key === active.key ? "active" : ""}" data-action="select-spell-group" data-spell-group="${esc(g.key)}">${esc(g.label)} niv. ${esc(g.level || "—")} <span>${g.items.length}</span></button>`).join("");
  const spellsHtml = active.items.map(spell => `<div class="row"><button type="button" class="img-act" data-action="cast-spell" data-item-id="${esc(spell.id)}" title="Lancer ${esc(spell.name)}"><img src="${esc(spell.img || "icons/svg/book.svg")}" alt=""></button><div><div class="title">${esc(spell.name)}</div><div class="meta"><span>Mémorisé ${preparedCount(spell)}</span></div></div></div>`).join("");
  return `<div class="spell-layout"><div class="spell-levels">${buttons}</div><div class="spell-list"><div class="spell-list-title">${esc(active.label)} niveau ${esc(active.level || "—")}</div>${spellsHtml}</div></div>`;
}
function featureRows(actor) { const rows = features(actor); if (!rows.length) return `<div class="empty">Aucune capacité utilisable.</div>`; return rows.map((f, i) => `<div class="row compact"><div><div class="title">${esc(globalThis.add2eFeatureName?.(f) || f.name || f.label || f.nom || `Capacité ${i + 1}`)}</div><div class="meta"><span>Capacité de classe</span></div></div><button type="button" class="act" data-action="use-feature" data-feature-index="${i}">Utiliser</button></div>`).join(""); }
function effectRows(actor) { const rows = effects(actor); if (!rows.length) return `<div class="empty">Aucun effet actif.</div>`; return rows.map(e => `<div class="row effect-row"><img src="${esc(e.img || e.icon || "icons/svg/aura.svg")}" alt=""><div><div class="title">${esc(e.name)}</div><div class="meta"><span>Effet actif</span></div></div><button type="button" class="act danger" data-action="remove-effect" data-effect-id="${esc(e.id)}"><i class="fas fa-trash"></i></button></div>`).join(""); }
function saveRows(actor) { const values = savingThrows(actor); return `<div class="grid">${SAVES.map((s, i) => `<div class="cell"><button type="button" class="roll-icon" data-action="roll-save" data-save-index="${i}" title="Jet ${esc(s[1])}"><i class="fas ${s[2]}"></i></button><div><b>${esc(s[1])} ${esc(values[i] || "—")}</b></div></div>`).join("")}</div>`; }
function abilityRows(actor) { return `<div class="grid">${CARACS.map(c => `<div class="cell"><button type="button" class="roll-icon" data-action="roll-ability" data-ability="${c[0]}" title="Jet ${esc(c[1])}"><i class="fas ${c[3]}"></i></button><div><b>${c[1]} ${esc(ability(actor, c[0]))}</b></div></div>`).join("")}</div>`; }

function hudHtml(actor, token = null) {
  const img = token?.document?.texture?.src || actor.img || "icons/svg/mystery-man.svg";
  const isMonster = isMonsterActor(actor);
  const race = isMonster ? (actor.system?.type ?? "Monstre") : (actor.system?.race || actor.system?.details_race?.label || actor.items?.find?.(i => i.type === "race")?.name || "Race");
  const classe = isMonster ? (actor.system?.taille ?? actor.system?.size ?? "MJ") : (actor.system?.classe || actor.system?.details_classe?.label || actor.items?.find?.(i => i.type === "classe")?.name || "Classe");
  const niveau = isMonster ? (actor.system?.dv ?? actor.system?.hitDice ?? actor.system?.niveau ?? "—") : (actor.system?.niveau ?? "—");
  const tab = (key, icon, label) => `<button type="button" class="a2e-hud-tab ${activeTab === key ? "active" : ""}" data-tab="${key}"><i class="${icon}"></i> ${label}</button>`;
  const section = (key, html) => `<section class="${activeTab === key ? "active" : ""}" data-section="${key}">${html}</section>`;
  return `<div class="a2e-hud-shell" data-drag-handle="1"><div class="a2e-hud-panel">${section("attaques", weaponRows(actor))}${section("projectiles", projectileRows(actor))}${section("armures", armorRows(actor))}${section("sorts", spellRows(actor))}${section("capacites", featureRows(actor))}${section("effets", effectRows(actor))}${section("sauvegardes", saveRows(actor))}${section("caracs", abilityRows(actor))}</div><nav class="a2e-hud-tabs">${tab("attaques", "fas fa-swords", "Combat")}${tab("projectiles", "fas fa-bullseye", "Proj.")}${tab("armures", "fas fa-shield-alt", "Arm.")}${tab("sorts", "fas fa-book", "Sorts")}${tab("capacites", "fas fa-bolt", "Cap.")}${tab("effets", "fas fa-hourglass-half", "Effets")}${tab("sauvegardes", "fas fa-shield-alt", "Sauv.")}${tab("caracs", "fas fa-dice-d20", "Carac.")}</nav><div class="a2e-hud-header" data-drag-handle="1"><img class="portrait" src="${esc(img)}" alt=""><div><div class="name">${esc(actor.name)}</div><div class="sub">${esc(race)} — ${esc(classe)} ${isMonster ? "DV" : "niv."} ${esc(niveau)}</div><div class="pills"><span class="pill">PV ${hp(actor)} / ${hpMax(actor)}</span><span class="pill">CA ${esc(armorClass(actor))}</span><span class="pill">THAC0 ${esc(thaco(actor))}</span></div></div><button type="button" class="icon" data-action="toggle-collapse"><i class="fas fa-chevron-down"></i></button><button type="button" class="icon resize" data-resize-handle="1"><i class="fas fa-up-right-and-down-left-from-center"></i></button></div></div>`;
}

function renderHud(actor = null, token = null, { reason = "render" } = {}) {
  if (dragging || resizing) return false;
  injectStyle();
  const existing = hud();
  if (!relevant(actor)) { existing?.remove(); hudActor = null; hudToken = null; return false; }
  hudActor = actor; hudToken = token ?? tokenFor(actor);
  if (!TABS.includes(activeTab)) activeTab = "attaques";
  const element = existing ?? document.createElement("div");
  element.id = HUD_ID;
  element.innerHTML = hudHtml(actor, hudToken);
  if (!existing) document.body.appendChild(element);
  element.classList.toggle("collapsed", loadState().collapsed === true);
  applyGeometry(element, true);
  bindHudEvents(element, actor);
  return true;
}
function refreshHud(reason = "refresh") { const token = canvas?.tokens?.controlled?.[0] ?? null; return renderHud(token?.actor ?? game.user?.character ?? null, token, { reason }); }
function closeHud() { hud()?.remove(); hudActor = null; hudToken = null; }
function bindHudEvents(element, actor) {
  element.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", event => {
    event.preventDefault(); event.stopPropagation();
    const next = button.dataset.tab || "attaques";
    if (activeTab === next && !element.classList.contains("collapsed")) return setCollapsed(true, true);
    activeTab = next; renderHud(actor, tokenFor(actor), { reason: "tab" }); setCollapsed(false, true);
  }));
  element.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", event => handleAction(event, actor, button)));
}
async function handleAction(event, actor, button) {
  event.preventDefault(); event.stopPropagation();
  const action = button.dataset.action;
  try {
    if (action === "toggle-collapse") return setCollapsed(!hud()?.classList.contains("collapsed"), true);
    if (action === "select-spell-group") { selectedSpellGroup = button.dataset.spellGroup || selectedSpellGroup; return renderHud(actor, tokenFor(actor), { reason: "select-spell-group" }); }
    if (action === "attack") return sheetAttack(actor, button.dataset.itemId);
    if (action === "cast-spell") return sheetCastSpell(actor, button.dataset.itemId);
    if (action === "use-feature") return sheetUseFeature(actor, Number(button.dataset.featureIndex));
    if (action === "remove-effect") return removeEffect(actor, button.dataset.effectId);
    if (action === "roll-save") return sheetRollSave(actor, Number(button.dataset.saveIndex));
    if (action === "roll-ability") return sheetRollAbility(actor, button.dataset.ability);
    if (action === "toggle-weapon") return toggleWeapon(actor, button.dataset.itemId);
    if (action === "toggle-projectile") return toggleProjectile(actor, button.dataset.itemId);
    if (action === "toggle-armor") return toggleArmor(actor, button.dataset.itemId);
  } catch (error) {
    console.error(`${TAG}[ACTION_ERROR]`, { action, error });
    ui.notifications.error(`ADD2E HUD | Erreur action ${action}`);
  }
}
async function sheetAttack(actor, itemId) { const arme = actor?.items?.get?.(itemId); if (!arme) return ui.notifications.warn("Arme introuvable."); if (!itemEquipped(arme)) return ui.notifications.warn("Cette arme doit être équipée avant d'attaquer."); if (typeof globalThis.add2eAttackRoll !== "function") return ui.notifications.error("Fonction add2eAttackRoll introuvable."); return globalThis.add2eAttackRoll({ actor, arme }); }
async function sheetCastSpell(actor, itemId) { const sort = actor?.items?.get?.(itemId); if (!sort) return ui.notifications.warn("Sort introuvable."); if (typeof globalThis.add2eCastSpell !== "function") return ui.notifications.error("Fonction add2eCastSpell introuvable."); return globalThis.add2eCastSpell({ actor, sort }); }
async function sheetRollAbility(actor, carac) { if (typeof globalThis.add2eRollCharacteristicCard !== "function") return ui.notifications.error("Fonction add2eRollCharacteristicCard introuvable."); return globalThis.add2eRollCharacteristicCard(actor, carac); }
async function sheetRollSave(actor, index) { if (typeof globalThis.add2eRollSaveCard !== "function") return ui.notifications.error("Fonction add2eRollSaveCard introuvable."); return globalThis.add2eRollSaveCard(actor, index); }
async function sheetUseFeature(actor, index) { const feature = features(actor)[index]; if (!feature) return ui.notifications.warn("Capacité introuvable."); if (typeof globalThis.add2eExecuteClassFeatureOnUse !== "function") return ui.notifications.error("Fonction add2eExecuteClassFeatureOnUse introuvable."); return globalThis.add2eExecuteClassFeatureOnUse(actor, feature, null); }
async function toggleWeapon(actor, itemId) {
  const item = actor?.items?.get?.(itemId); if (!item || !isWeaponItem(item)) return ui.notifications.warn("Arme introuvable.");
  const already = itemEquipped(item);
  if (!already) {
    const check = checkEquipment(actor, item, "arme");
    if (!check.ok) return ui.notifications.error(`⚠️ Cette arme (« ${item.name} ») est interdite pour votre classe (${check.classeLabel}) — ${equipmentReason(check, "arme")}.`);
    const twoHands = item.system?.deuxMains === true || itemTags(item).includes("usage:deux_mains") || itemTags(item).includes("trait:deux_mains");
    if (twoHands) { const shield = armors(actor).find(i => itemEquipped(i) && add2eIsShieldLocal(i)); if (shield) return ui.notifications.error(`⚠️ Impossible d'équiper une arme à deux mains si un bouclier est équipé (${shield.name}).`); }
  }
  const ranged = weaponIsRanged(item);
  const updates = [];
  if (already) updates.push({ _id: item.id, "system.equipee": false });
  else {
    for (const other of weapons(actor)) if (other.id !== item.id && itemEquipped(other) && weaponIsRanged(other) === ranged) updates.push({ _id: other.id, "system.equipee": false });
    updates.push({ _id: item.id, "system.equipee": true });
  }
  await actor.updateEmbeddedDocuments("Item", updates);
  return renderHud(actor, tokenFor(actor), { reason: "toggle-weapon" });
}
async function toggleProjectile(actor, itemId) {
  const item = actor?.items?.get?.(itemId); if (!item || !isAmmunitionItem(item)) return ui.notifications.warn("Projectile introuvable.");
  if (!usesProjectileInventory(actor) && !game.user?.isGM) return ui.notifications.warn("Les projectiles ne sont suivis que pour les personnages.");
  if (!itemEquipped(item) && quantityNumber(item, 0) <= 0) return ui.notifications.warn(`${item.name} : quantité insuffisante.`);
  if (!itemEquipped(item) && typeof globalThis.add2eEquipProjectile === "function") { await globalThis.add2eEquipProjectile(actor, item); return renderHud(actor, tokenFor(actor), { reason: "toggle-projectile" }); }
  const type = ammoType(item);
  const updates = [];
  if (itemEquipped(item)) updates.push({ _id: item.id, "system.equipee": false });
  else {
    for (const other of projectiles(actor)) if (other.id !== item.id && itemEquipped(other) && ammoType(other) === type) updates.push({ _id: other.id, "system.equipee": false });
    updates.push({ _id: item.id, "system.equipee": true });
  }
  await actor.updateEmbeddedDocuments("Item", updates);
  return renderHud(actor, tokenFor(actor), { reason: "toggle-projectile" });
}
async function toggleArmor(actor, itemId) {
  const item = actor?.items?.get?.(itemId); if (!item || !isArmorItem(item)) return ui.notifications.warn("Armure introuvable.");
  const already = itemEquipped(item), isShield = add2eIsShieldLocal(item), isHelmet = add2eIsHelmetLocal(item), isArmor = !isShield && !isHelmet;
  if (!already) {
    const check = checkEquipment(actor, item, "armure");
    if (!check.ok) { const label = isShield ? "Ce bouclier" : isHelmet ? "Ce heaume" : "Cette armure"; return ui.notifications.error(`⚠️ ${label} (« ${item.name} ») est interdit pour votre classe (${check.classeLabel}) — ${equipmentReason(check, "armure")}.`); }
    if (isShield) { const twoHanded = weapons(actor).find(w => itemEquipped(w) && (w.system?.deuxMains === true || itemTags(w).includes("usage:deux_mains") || itemTags(w).includes("trait:deux_mains"))); if (twoHanded) return ui.notifications.error(`⚠️ Impossible d'équiper un bouclier avec une arme à deux mains (${twoHanded.name}) déjà équipée.`); }
  }
  const updates = [];
  if (already) updates.push({ _id: item.id, "system.equipee": false });
  else {
    for (const other of armors(actor)) if (other.id !== item.id && itemEquipped(other) && ((isArmor && !add2eIsShieldLocal(other) && !add2eIsHelmetLocal(other)) || (isShield && add2eIsShieldLocal(other)) || (isHelmet && add2eIsHelmetLocal(other)))) updates.push({ _id: other.id, "system.equipee": false });
    updates.push({ _id: item.id, "system.equipee": true });
  }
  await actor.updateEmbeddedDocuments("Item", updates);
  await refreshArmorClass(actor);
  return renderHud(actor, tokenFor(actor), { reason: "toggle-armor" });
}
async function refreshArmorClass(actor) {
  const equipped = armors(actor).filter(itemEquipped), armor = equipped.find(i => !add2eIsShieldLocal(i) && !add2eIsHelmetLocal(i)), shield = equipped.find(add2eIsShieldLocal), helmet = equipped.find(add2eIsHelmetLocal);
  let total = num(actor?.system?.ca_naturel ?? actor?.system?.ac_naturel ?? 10, 10);
  if (armor) total = num(armor.system?.ac ?? armor.system?.ca, total);
  if (shield) total -= num(shield.system?.ac ?? shield.system?.ca ?? shield.system?.bonus_ac ?? 1, 0);
  if (helmet) total -= num(helmet.system?.ac ?? helmet.system?.ca ?? helmet.system?.bonus_ac, 0);
  total += num(actor?.system?.dex_def, 0);
  await actor?.update?.({ "system.ca_total": total });
}
async function removeEffect(actor, effectId) {
  const effect = actor?.effects?.get?.(effectId); if (!effect) return ui.notifications.warn("Effet introuvable.");
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  const ok = DialogV2?.confirm ? await DialogV2.confirm({ window: { title: "Supprimer l'effet" }, content: `<p>Supprimer <strong>${esc(effect.name)}</strong> ?</p>`, yes: { label: "Supprimer", icon: "fas fa-trash" }, no: { label: "Annuler" } }) : true;
  if (!ok) return false;
  await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id]);
  return renderHud(actor, hudToken, { reason: "remove-effect" });
}

function primary(event) { return event.button === undefined || event.button === 0; }
function pointerClient(event) { const touch = event.touches?.[0] ?? event.changedTouches?.[0] ?? null; return { x: touch?.clientX ?? event.clientX ?? 0, y: touch?.clientY ?? event.clientY ?? 0 }; }
function dragEvents(event) { if (event.type === "mousedown") return { move: "mousemove", up: "mouseup" }; if (event.type === "touchstart") return { move: "touchmove", up: "touchend" }; return { move: "pointermove", up: "pointerup" }; }
function startResize(event) {
  const handle = event.target?.closest?.("[data-resize-handle]"), element = event.target?.closest?.(`#${HUD_ID}`);
  if (!handle || !element || !primary(event)) return false;
  event.preventDefault(); event.stopPropagation(); resizing = true;
  const events = dragEvents(event), startState = loadState(), startPoint = pointerClient(event), start = { x: startPoint.x, y: startPoint.y, width: startState.width, maxMenuHeight: startState.maxMenuHeight, left: startState.left, top: startState.top };
  const move = e => { e.preventDefault?.(); const point = pointerClient(e), current = loadState(); current.width = clamp(start.width + point.x - start.x, 380, Math.max(440, window.innerWidth)); current.maxMenuHeight = clamp(start.maxMenuHeight + point.y - start.y, 120, Math.max(160, window.innerHeight - 60)); applyGeometry(element, true); };
  const up = () => { window.removeEventListener(events.move, move, true); window.removeEventListener(events.up, up, true); resizing = false; const current = loadState(); saveState({ width: element.offsetWidth || current.width, maxMenuHeight: current.maxMenuHeight, left: current.left, top: current.top }); applyGeometry(element, true); };
  window.addEventListener(events.move, move, true); window.addEventListener(events.up, up, true); return true;
}
function startDrag(event) {
  const element = event.target?.closest?.(`#${HUD_ID}`), handle = event.target?.closest?.("[data-drag-handle]");
  if (!element || !handle || !primary(event) || event.target.closest?.("button,a,input,select,textarea,[data-action],[data-tab],[data-resize-handle]")) return false;
  event.preventDefault(); event.stopPropagation(); dragging = true; manualIntentUntil = Date.now() + 1200;
  const events = dragEvents(event), state0 = loadState(), startPoint = pointerClient(event), start = { x: startPoint.x, y: startPoint.y, left: state0.left, top: state0.top };
  const move = e => { e.preventDefault?.(); const point = pointerClient(e), current = loadState(), width = element.offsetWidth || current.width || 720, height = element.offsetHeight || 110; current.left = clamp(start.left + point.x - start.x, Math.min(EDGE_PAD, window.innerWidth - HANDLE_VISIBLE), Math.max(EDGE_PAD, window.innerWidth - Math.min(width, HANDLE_VISIBLE))); current.top = clamp(start.top + point.y - start.y, EDGE_PAD, Math.max(EDGE_PAD, window.innerHeight - Math.min(height, HANDLE_VISIBLE))); applyGeometry(element, true); saveState({ left: Math.round(current.left), top: Math.round(current.top), bottom: null }); };
  const up = () => { window.removeEventListener(events.move, move, true); window.removeEventListener(events.up, up, true); dragging = false; applyGeometry(element, true); };
  window.addEventListener(events.move, move, true); window.addEventListener(events.up, up, true); return true;
}
function pointerDown(event) { if (startResize(event)) return; startDrag(event); }
function currentCombatant(combat = game.combat) { if (!combat) return null; const id = combat.current?.combatantId ?? combat.combatantId ?? null; return (id ? combat.combatants?.get?.(id) : null) ?? combat.combatant ?? combat.turns?.[Number(combat.current?.turn ?? combat.turn)] ?? null; }
function tokenFromCombatant(combatant) { return combatant?.token?.object ?? (combatant?.tokenId ? canvas?.tokens?.get?.(combatant.tokenId) : null) ?? null; }
function followCombat(combat = game.combat, forceOpen = false) { if (Date.now() < manualIntentUntil) return false; const combatant = currentCombatant(combat); if (!combatant?.actor || (!forceOpen && !hud())) return false; return renderHud(combatant.actor, tokenFromCombatant(combatant), { reason: "combat" }); }

Hooks.once("init", () => {
  game.add2e = game.add2e ?? {};
  game.add2e.actionHudVersion = ADD2E_ACTION_HUD_VERSION;
  game.add2e.openActionHud = (actor = null) => { const token = canvas?.tokens?.controlled?.[0] ?? null; return renderHud(actor ?? token?.actor ?? game.user?.character, actor ? tokenFor(actor) : token, { reason: "api-open" }); };
  game.add2e.closeActionHud = closeHud;
  game.add2e.refreshActionHud = () => hudActor ? renderHud(hudActor, hudToken, { reason: "api-refresh-current" }) : refreshHud("api-refresh");
  game.add2e.resetActionHudPosition = resetHudPosition;
  Object.assign(globalThis, { add2eRenderActionHud: renderHud, add2eRefreshActionHud: refreshHud, add2eCloseActionHud: closeHud, add2eResetActionHudPosition: resetHudPosition, add2eHudCheck: () => ({ version: ADD2E_ACTION_HUD_VERSION, actor: currentActor()?.name ?? null, actorId: currentActor()?.id ?? null, activeTab, selectedSpellGroup, attackRoll: typeof globalThis.add2eAttackRoll, castSpell: typeof globalThis.add2eCastSpell, rollCarac: typeof globalThis.add2eRollCharacteristicCard, rollSave: typeof globalThis.add2eRollSaveCard, featureUse: typeof globalThis.add2eExecuteClassFeatureOnUse, equipmentCheck: typeof globalThis.add2eCheckEquipmentAllowedForClass, hud: !!hud() }) });
  console.log(`${TAG}[INIT]`, ADD2E_ACTION_HUD_VERSION);
});
Hooks.once("ready", () => { document.addEventListener("pointerdown", pointerDown, true); document.addEventListener("mousedown", pointerDown, true); document.addEventListener("touchstart", pointerDown, true); window.addEventListener("resize", () => applyGeometry(hud(), true)); setTimeout(() => refreshHud("ready"), 300); });
Hooks.on("controlToken", () => { manualIntentUntil = Date.now() + 500; setTimeout(() => refreshHud("controlToken"), 60); });
Hooks.on("canvasReady", () => setTimeout(() => refreshHud("canvasReady"), 150));
Hooks.on("updateCombat", combat => setTimeout(() => followCombat(combat, false), 80));
Hooks.on("combatTurn", combat => setTimeout(() => followCombat(combat, false), 80));
Hooks.on("combatRound", combat => setTimeout(() => followCombat(combat, false), 80));
Hooks.on("updateActor", actor => { if (actor?.id === hudActor?.id && !dragging && !resizing) setTimeout(() => renderHud(actor, hudToken, { reason: "updateActor" }), 80); });
for (const hookName of ["createItem", "updateItem", "deleteItem", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) Hooks.on(hookName, doc => { const actor = doc?.parent; if (actor?.id === hudActor?.id && !dragging && !resizing) setTimeout(() => renderHud(actor, hudToken, { reason: hookName }), 80); });

export { renderHud as add2eRenderActionHud, refreshHud as add2eRefreshActionHud, closeHud as add2eCloseActionHud };
