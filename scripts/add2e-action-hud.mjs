// scripts/add2e-action-hud.mjs
// ADD2E — HUD d'action rapide maison.
// Version : 2026-05-28-v34-sheet-delegation-clean
// Principe : le HUD est une interface. Les jets et actions délèguent strictement aux fonctions de la feuille/système.

const ADD2E_ACTION_HUD_VERSION = "2026-05-28-v34-sheet-delegation-clean";
const HUD_ID = "add2e-action-hud";
const STYLE_ID = "add2e-action-hud-style";
const STORAGE_KEY = "add2e.actionHud.state.v34";
const TAG = "[ADD2E][ACTION_HUD]";

let hudActor = null;
let hudToken = null;
let activeTab = "attaques";
let selectedSpellGroup = null;
let dragging = false;
let resizing = false;
let manualIntentUntil = 0;
let state = null;

const TABS = ["attaques", "sorts", "capacites", "effets", "sauvegardes", "caracs"];
const CARACS = [["force", "FOR", "Force"], ["dexterite", "DEX", "Dextérité"], ["constitution", "CON", "Constitution"], ["intelligence", "INT", "Intelligence"], ["sagesse", "SAG", "Sagesse"], ["charisme", "CHA", "Charisme"]];
const SAVES = [["Paralysie", "Paralysie / poison / mort"], ["Pétrification", "Pétrification / métamorphose"], ["Baguettes", "Baguettes"], ["Souffles", "Souffles"], ["Sorts", "Sorts"]];

function esc(v) { try { return foundry.utils.escapeHTML(String(v ?? "")); } catch (_e) { return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); } }
function arr(v) { if (v === undefined || v === null || v === "") return []; if (Array.isArray(v)) return v; if (v instanceof Set) return [...v]; if (typeof v?.values === "function") return [...v.values()]; if (typeof v === "object") return Object.values(v); return [v]; }
function num(v, fallback = 0) { if (typeof v === "string") { const m = v.match(/-?\d+(?:[.,]\d+)?/); if (!m) return fallback; v = m[0].replace(",", "."); } const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function norm(v) { return String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9:_-]+/g, "_").replace(/^_|_$/g, ""); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function hud() { return document.getElementById(HUD_ID); }
function currentActor() { return hudActor ?? canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null; }
function tokenFor(actor) { return canvas?.tokens?.controlled?.find?.(t => t.actor?.id === actor?.id) ?? actor?.getActiveTokens?.()[0] ?? null; }
function canUse(actor) { return !!actor && (game.user?.isGM || actor.isOwner || actor.testUserPermission?.(game.user, "OWNER")); }
function relevant(actor) { const t = String(actor?.type ?? "").toLowerCase(); return t === "personnage" ? canUse(actor) : (t === "monster" ? game.user?.isGM === true : false); }

function defaultState() { return { left: 116, bottom: 22, width: 640, maxMenuHeight: 360, collapsed: false }; }
function loadState() { if (state) return state; try { state = { ...defaultState(), ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {}) }; } catch (_e) { state = defaultState(); } return state; }
function saveState(partial = {}) { Object.assign(loadState(), partial); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_e) {} }
function applyGeometry(el = hud(), force = false) {
  if (!el || (!force && (dragging || resizing))) return;
  const s = loadState();
  s.width = clamp(num(s.width, 640), 420, Math.max(440, window.innerWidth - 16));
  s.left = clamp(num(s.left, 116), 8, Math.max(8, window.innerWidth - s.width - 8));
  s.bottom = clamp(num(s.bottom, 22), 8, Math.max(8, window.innerHeight - 110));
  s.maxMenuHeight = clamp(num(s.maxMenuHeight, 360), 140, Math.max(160, window.innerHeight - 130));
  el.style.left = `${Math.round(s.left)}px`;
  el.style.bottom = `${Math.round(s.bottom)}px`;
  el.style.width = `${Math.round(s.width)}px`;
  el.style.setProperty("--a2e-hud-menu-max", `${Math.round(s.maxMenuHeight)}px`);
}
function setCollapsed(value, persist = true) { const el = hud(); if (!el) return; el.classList.toggle("collapsed", !!value); if (persist) saveState({ collapsed: !!value }); }

function itemEquipped(item) { const s = item?.system ?? {}; return s.equipee === true || s.equipped === true || s.portee === true || s.worn === true || s.estEquipee === true; }
function itemTags(item) { const s = item?.system ?? {}, f = item?.flags?.add2e ?? {}; return [item?.name, s.nom, s.categorie, s.category, s.type, s.sousType, s.sous_type, s.type_arme, s.famille, s.famille_arme, s.tags, s.effectTags, f.tags, f.effectTags].flatMap(arr).map(norm).filter(Boolean); }
function isPropelledWeapon(item) { const tags = itemTags(item), n = norm(item?.name), s = item?.system ?? {}; return s.projectile_propulse === true || s.arme_a_projectile === true || tags.includes("projectile_propulse") || tags.includes("usage_projectile_propulse") || ["arc", "arbalete", "fronde"].some(k => n.includes(k)); }
function projectileKeys(item) { const text = `${norm(item?.name)} ${itemTags(item).join(" ")}`; if (text.includes("arbalete")) return ["carreau", "carreaux", "bolt"]; if (text.includes("arc")) return ["fleche", "fleches", "arrow"]; if (text.includes("fronde")) return ["bille", "billes", "pierre", "pierres", "bullet"]; return ["munition", "projectile", "ammo"]; }
function quantity(item) { const s = item?.system ?? {}; const q = s.quantite ?? s.quantity ?? s.qty ?? s.nombre ?? s.nb ?? s.uses?.value ?? s.charges?.value; return q === undefined || q === null || q === "" ? "—" : String(q); }
function equippedProjectile(actor, weapon) { if (!actor || !isPropelledWeapon(weapon)) return null; const keys = projectileKeys(weapon).map(norm); const items = actor.items?.filter?.(i => i.id !== weapon.id && itemEquipped(i) && keys.some(k => norm(i.name).includes(k) || itemTags(i).some(t => t.includes(k)))) ?? []; return items.find(i => quantity(i) !== "0") ?? items[0] ?? null; }
function damage(item) { const s = item?.system ?? {}; return s?.dégâts?.contre_moyen ?? s?.degats?.contre_moyen ?? s?.degats_moyen ?? s?.damage ?? s?.degats ?? s?.dmg ?? "—"; }
function range(item) { const s = item?.system ?? {}; const p = [s.portee_courte ?? s.portee_short, s.portee_moyenne ?? s.portee_medium, s.portee_longue ?? s.portee_long].filter(v => v !== undefined && v !== null && String(v) !== ""); return p.length ? p.join(" / ") : "Contact"; }
function weapons(actor) { return actor?.items?.filter?.(i => String(i.type ?? "").toLowerCase() === "arme" && itemEquipped(i)) ?? []; }

function preparedCount(sort) { try { const n = Number(globalThis.add2eGetTotalMemorizedCount?.(sort)); if (Number.isFinite(n)) return n; } catch (_e) {} const f = sort?.flags?.add2e ?? {}, s = sort?.system ?? {}; for (const v of [sort?.getFlag?.("add2e", "memorizedCount"), f.memorizedCount, f.preparedCount, s.memorizedCount, s.preparedCount, s.prepared, s.memorise, s.memorized, s.memorisation?.value, s.memorisation, s.slots?.prepared, s.slots?.value]) { const n = num(v, NaN); if (Number.isFinite(n) && n > 0) return n; } return 0; }
function isObjectPowerSpell(sort) { const s = sort?.system ?? {}; if (s.isPower === true || s.isObjectPower === true || s.sourceWeaponId || s.sourceItemId || s.powerIndex !== undefined) return true; try { return globalThis.add2eIsObjectMagicSpellForPreparation?.(sort) === true; } catch (_e) { return false; } }
function spells(actor) { return actor?.items?.filter?.(i => String(i.type ?? "").toLowerCase() === "sort" && !isObjectPowerSpell(i) && preparedCount(i) > 0) ?? []; }
function spellLevel(sort) { return Math.max(0, num(sort?.system?.niveau ?? sort?.system?.level ?? sort?.system?.niveau_sort, 0)); }
function spellListLabel(sort) { const s = sort?.system ?? {}; const raw = [s.liste, s.list, s.spellList, s.classe, s.class, s.sourceClasse, s.casterClass, ...arr(s.lists), ...arr(s.listes), ...arr(s.classes)].map(v => String(v ?? "").trim()).find(Boolean) || "Mag"; const n = norm(raw); if (n.includes("clerc") || n.includes("pretre") || n.includes("priest")) return "Clerc"; if (n.includes("druid") || n.includes("druide")) return "Dru"; if (n.includes("ranger")) return "Rng"; if (n.includes("paladin")) return "Pal"; if (n.includes("mag") || n.includes("wizard") || n.includes("mage")) return "Mag"; return String(raw).slice(0, 6); }
function spellGroupKey(sort) { return `${spellListLabel(sort)}|${spellLevel(sort)}`; }
function spellComponents(sort) { return String(sort?.system?.composantes ?? sort?.system?.components ?? sort?.system?.componentes ?? "—").trim() || "—"; }

function features(actor) { if (typeof globalThis.add2eGetActorActivableClassFeatures === "function") return globalThis.add2eGetActorActivableClassFeatures(actor, { includeLocked: false }) ?? []; return []; }
function effects(actor) { const map = new Map(); for (const e of arr(actor?.effects)) if (e && e.disabled !== true) map.set(e.id, e); return [...map.values()]; }
function ability(actor, key) { const direct = Number(actor?.system?.[key]); if (Number.isFinite(direct)) return direct; return num(actor?.system?.[`${key}_base`], 10); }
function savingThrows(actor) { const lvl = Math.max(1, num(actor?.system?.niveau, 1)); const row = actor?.system?.details_classe?.progression?.[lvl - 1]; const values = arr(row?.savingThrows || actor?.system?.sauvegardes || actor?.system?.savingThrows || []).map(v => num(v, 0)); return values.length >= 5 ? values.slice(0, 5) : [0, 0, 0, 0, 0]; }
function hp(actor) { return num(actor?.system?.pdv ?? actor?.system?.pv?.value ?? actor?.system?.hp?.value ?? actor?.system?.hp, 0); }
function hpMax(actor) { return num(actor?.system?.points_de_coup ?? actor?.system?.pv?.max ?? actor?.system?.hp?.max ?? actor?.system?.hpMax, hp(actor)); }
function armorClass(actor) { return actor?.system?.ca_total ?? actor?.system?.ca ?? actor?.system?.armorClass ?? actor?.system?.ac ?? "—"; }
function thaco(actor) { const direct = actor?.system?.thac0 ?? actor?.system?.thaco ?? actor?.system?.combat?.thac0; if (direct !== undefined && direct !== null && direct !== "") return direct; const lvl = Math.max(1, num(actor?.system?.niveau, 1)); return actor?.system?.details_classe?.progression?.[lvl - 1]?.thac0 ?? 20; }

function injectStyle() {
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
#${HUD_ID}{position:fixed;z-index:100;right:auto!important;top:auto!important;min-width:420px;color:#f6e8bd;font-family:var(--font-primary,Signika,sans-serif);pointer-events:auto;user-select:none}
#${HUD_ID}.collapsed .a2e-hud-panel{display:none!important}
#${HUD_ID} .a2e-hud-shell{border:1px solid #8a611d;border-radius:14px;overflow:hidden;background:linear-gradient(145deg,rgba(32,25,16,.97),rgba(18,14,10,.96));box-shadow:0 8px 26px rgba(0,0,0,.48)}
#${HUD_ID} .a2e-hud-panel{max-height:var(--a2e-hud-menu-max,360px);overflow:auto;padding:9px;border-bottom:1px solid rgba(184,137,36,.45);background:rgba(0,0,0,.13)}
#${HUD_ID} section{display:none}#${HUD_ID} section.active{display:grid;gap:7px}
#${HUD_ID} .a2e-hud-tabs{display:grid;grid-template-columns:repeat(6,1fr);background:rgba(0,0,0,.18);border-bottom:1px solid rgba(184,137,36,.45)}
#${HUD_ID} .a2e-hud-tab{min-height:34px;border:0;border-right:1px solid rgba(184,137,36,.32);background:transparent;color:#d8bd78;font-size:.74em;font-weight:900;cursor:pointer}#${HUD_ID} .a2e-hud-tab.active{color:#211307;background:linear-gradient(180deg,#f0c66d,#c78d2e)}
#${HUD_ID} .a2e-hud-header{display:grid;grid-template-columns:74px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:9px 10px;background:linear-gradient(180deg,rgba(78,48,18,.78),rgba(36,26,14,.62));cursor:move}
#${HUD_ID} .portrait{width:64px;height:64px;border-radius:12px;object-fit:cover;border:2px solid #c4973f;background:#111}#${HUD_ID} .name{color:#fff4cf;font-size:1.12em;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#${HUD_ID} .sub{color:#d8bd78;font-size:.82em;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${HUD_ID} .pills{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}#${HUD_ID} .pill{display:inline-flex;min-height:22px;padding:2px 7px;border:1px solid rgba(214,176,90,.75);border-radius:999px;background:rgba(255,244,201,.12);color:#fff0bd;font-size:.78em;font-weight:850}
#${HUD_ID} .icon{width:30px;height:30px;border:1px solid rgba(214,176,90,.75);border-radius:9px;background:rgba(255,244,201,.12);color:#ffe4a1;cursor:pointer}#${HUD_ID} .resize{cursor:nwse-resize!important}
#${HUD_ID} .row{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:46px;padding:6px;border:1px solid rgba(214,176,90,.38);border-radius:10px;background:rgba(255,250,235,.07)}#${HUD_ID} .row.compact{grid-template-columns:minmax(0,1fr) auto;min-height:38px}
#${HUD_ID} .row img{width:34px;height:34px;border-radius:7px;object-fit:cover;border:1px solid rgba(214,176,90,.65);background:rgba(0,0,0,.25)}#${HUD_ID} .title{color:#fff4cf;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#${HUD_ID} .meta{display:flex;flex-wrap:wrap;gap:4px 8px;color:#c8ad6e;font-size:.76em;font-weight:750;margin-top:2px}
#${HUD_ID} .act{min-width:78px;min-height:30px;padding:4px 9px;border:1px solid #d6b05a;border-radius:9px;background:linear-gradient(180deg,#fff0bd,#d6a345);color:#211307;font-size:.8em;font-weight:950;cursor:pointer;white-space:nowrap}#${HUD_ID} .danger{min-width:36px;width:36px;color:#ffd0c8;border-color:#b94735;background:linear-gradient(180deg,#7d241b,#42120d)}
#${HUD_ID} .empty{padding:12px;border:1px dashed rgba(214,176,90,.45);border-radius:10px;color:#c8ad6e;font-style:italic;text-align:center}
#${HUD_ID} .spell-layout{display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px}#${HUD_ID} .spell-levels{display:flex;flex-wrap:wrap;gap:6px;padding-bottom:2px;border-bottom:1px solid rgba(214,176,90,.28)}#${HUD_ID} .spell-level{min-height:30px;padding:5px 10px;border:1px solid rgba(214,176,90,.55);border-radius:999px;background:rgba(214,176,90,.12);color:#ffe4a1;font-weight:950;font-size:.82em;cursor:pointer}#${HUD_ID} .spell-level.active{background:linear-gradient(180deg,#f0c66d,#c78d2e);color:#211307}#${HUD_ID} .spell-list{display:grid;gap:6px;max-height:260px;overflow-y:auto;padding-right:3px}#${HUD_ID} .spell-list-title{color:#ffe4a1;font-weight:950;font-size:.82em;margin:0 0 2px 2px}
#${HUD_ID} .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}#${HUD_ID} .cell{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;min-height:50px;padding:8px;border-radius:12px;border:1px solid rgba(214,176,90,.38);background:rgba(255,250,235,.07)}#${HUD_ID} .cell b{display:block;color:#fff;font-size:1.16em;line-height:1.05}#${HUD_ID} .cell span{display:block;color:#c8ad6e;font-size:.74em;font-weight:800}
#${HUD_ID} button,#${HUD_ID} [data-action],#${HUD_ID} [data-tab]{user-select:auto;touch-action:auto}`;
  document.head.appendChild(style);
}

function weaponRows(actor) {
  const rows = weapons(actor);
  if (!rows.length) return `<div class="empty">Aucune arme équipée.</div>`;
  return rows.map(i => {
    const projectile = equippedProjectile(actor, i);
    const propelled = isPropelledWeapon(i);
    const dmg = propelled && projectile ? `Dégâts projectile ${damage(projectile)}` : `Dégâts ${damage(i)}`;
    const ammo = propelled ? (projectile ? `<span>Munition ${esc(projectile.name)} ×${esc(quantity(projectile))}</span>` : `<span>Aucune munition équipée</span>`) : "";
    return `<div class="row"><img src="${esc(i.img || "icons/svg/sword.svg")}" alt=""><div><div class="title">${esc(i.name)}</div><div class="meta"><span>${esc(dmg)}</span><span>Portée ${esc(range(i))}</span>${ammo}</div></div><button type="button" class="act" data-action="attack" data-item-id="${esc(i.id)}">Attaquer</button></div>`;
  }).join("");
}
function spellRows(actor) {
  const rows = spells(actor).sort((a, b) => String(spellListLabel(a)).localeCompare(String(spellListLabel(b))) || spellLevel(a) - spellLevel(b) || String(a.name).localeCompare(String(b.name)));
  if (!rows.length) return `<div class="empty">Aucun sort mémorisé.</div>`;
  const groups = new Map();
  for (const s of rows) { const key = spellGroupKey(s); if (!groups.has(key)) groups.set(key, { key, label: spellListLabel(s), level: spellLevel(s), items: [] }); groups.get(key).items.push(s); }
  const list = [...groups.values()];
  if (!selectedSpellGroup || !groups.has(selectedSpellGroup)) selectedSpellGroup = list[0].key;
  const active = groups.get(selectedSpellGroup) ?? list[0];
  const buttons = list.map(g => `<button type="button" class="spell-level ${g.key === active.key ? "active" : ""}" data-action="select-spell-group" data-spell-group="${esc(g.key)}">${esc(g.label)} niv. ${esc(g.level || "—")} <span>${g.items.length}</span></button>`).join("");
  const spellsHtml = active.items.map(s => `<div class="row"><img src="${esc(s.img || "icons/svg/book.svg")}" alt=""><div><div class="title">${esc(s.name)}</div><div class="meta"><span>Mémorisé ${preparedCount(s)}</span><span>Comp. ${esc(spellComponents(s))}</span></div></div><button type="button" class="act" data-action="cast-spell" data-item-id="${esc(s.id)}">Lancer</button></div>`).join("");
  return `<div class="spell-layout"><div class="spell-levels">${buttons}</div><div class="spell-list"><div class="spell-list-title">${esc(active.label)} niveau ${esc(active.level || "—")}</div>${spellsHtml}</div></div>`;
}
function featureRows(actor) {
  const rows = features(actor);
  if (!rows.length) return `<div class="empty">Aucune capacité utilisable.</div>`;
  return rows.map((f, i) => `<div class="row compact"><div><div class="title">${esc(globalThis.add2eFeatureName?.(f) || f.name || f.label || f.nom || `Capacité ${i + 1}`)}</div><div class="meta"><span>Capacité de classe</span></div></div><button type="button" class="act" data-action="use-feature" data-feature-index="${i}">Utiliser</button></div>`).join("");
}
function effectRows(actor) {
  const rows = effects(actor);
  if (!rows.length) return `<div class="empty">Aucun effet actif.</div>`;
  return rows.map(e => `<div class="row"><img src="${esc(e.img || e.icon || "icons/svg/aura.svg")}" alt=""><div><div class="title">${esc(e.name)}</div><div class="meta"><span>Effet actif</span></div></div><button type="button" class="act danger" data-action="remove-effect" data-effect-id="${esc(e.id)}"><i class="fas fa-trash"></i></button></div>`).join("");
}
function saveRows(actor) { const values = savingThrows(actor); return `<div class="grid">${SAVES.map((s, i) => `<div class="cell"><div><b>${esc(s[0])} ${esc(values[i] || "—")}</b><span>${esc(s[1])}</span></div><button type="button" class="act" data-action="roll-save" data-save-index="${i}">Jet</button></div>`).join("")}</div>`; }
function abilityRows(actor) { return `<div class="grid">${CARACS.map(c => `<div class="cell"><div><b>${c[1]} ${esc(ability(actor, c[0]))}</b><span>${esc(c[2])}</span></div><button type="button" class="act" data-action="roll-ability" data-ability="${c[0]}">Jet</button></div>`).join("")}</div>`; }

function hudHtml(actor, token = null) {
  const img = token?.document?.texture?.src || actor.img || "icons/svg/mystery-man.svg";
  const isMonster = String(actor.type).toLowerCase() === "monster";
  const race = isMonster ? (actor.system?.type ?? "Monstre") : (actor.system?.race || actor.system?.details_race?.label || actor.items?.find?.(i => i.type === "race")?.name || "Race");
  const classe = isMonster ? (actor.system?.taille ?? actor.system?.size ?? "MJ") : (actor.system?.classe || actor.system?.details_classe?.label || actor.items?.find?.(i => i.type === "classe")?.name || "Classe");
  const niveau = isMonster ? (actor.system?.dv ?? actor.system?.hitDice ?? actor.system?.niveau ?? "—") : (actor.system?.niveau ?? "—");
  const tab = (key, icon, label) => `<button type="button" class="a2e-hud-tab ${activeTab === key ? "active" : ""}" data-tab="${key}"><i class="${icon}"></i> ${label}</button>`;
  const section = (key, html) => `<section class="${activeTab === key ? "active" : ""}" data-section="${key}">${html}</section>`;
  return `<div class="a2e-hud-shell"><div class="a2e-hud-panel">${section("attaques", weaponRows(actor))}${section("sorts", spellRows(actor))}${section("capacites", featureRows(actor))}${section("effets", effectRows(actor))}${section("sauvegardes", saveRows(actor))}${section("caracs", abilityRows(actor))}</div><nav class="a2e-hud-tabs">${tab("attaques", "fas fa-swords", "Armes")}${tab("sorts", "fas fa-book", "Sorts")}${tab("capacites", "fas fa-bolt", "Capacités")}${tab("effets", "fas fa-hourglass-half", "Effets")}${tab("sauvegardes", "fas fa-shield-alt", "Sauv.")}${tab("caracs", "fas fa-dice-d20", "Carac.")}</nav><div class="a2e-hud-header" data-drag-handle="1"><img class="portrait" src="${esc(img)}" alt=""><div><div class="name">${esc(actor.name)}</div><div class="sub">${esc(race)} — ${esc(classe)} ${isMonster ? "DV" : "niv."} ${esc(niveau)}</div><div class="pills"><span class="pill">PV ${hp(actor)} / ${hpMax(actor)}</span><span class="pill">CA ${esc(armorClass(actor))}</span><span class="pill">THAC0 ${esc(thaco(actor))}</span></div></div><button type="button" class="icon" data-action="toggle-collapse"><i class="fas fa-chevron-down"></i></button><button type="button" class="icon resize" data-resize-handle="1"><i class="fas fa-up-right-and-down-left-from-center"></i></button></div></div>`;
}

function renderHud(actor = null, token = null, { reason = "render" } = {}) {
  if (dragging || resizing) return false;
  injectStyle();
  const existing = hud();
  if (!relevant(actor)) { existing?.remove(); hudActor = null; hudToken = null; return false; }
  hudActor = actor;
  hudToken = token ?? tokenFor(actor);
  if (!TABS.includes(activeTab)) activeTab = "attaques";
  const el = existing ?? document.createElement("div");
  el.id = HUD_ID;
  el.innerHTML = hudHtml(actor, hudToken);
  if (!existing) document.body.appendChild(el);
  el.classList.toggle("collapsed", loadState().collapsed === true);
  applyGeometry(el, true);
  bindHudEvents(el, actor);
  console.log(`${TAG}[RENDER]`, { version: ADD2E_ACTION_HUD_VERSION, reason, actor: actor.name, actorId: actor.id, activeTab });
  return true;
}
function refreshHud(reason = "refresh") { const token = canvas?.tokens?.controlled?.[0] ?? null; return renderHud(token?.actor ?? game.user?.character ?? null, token, { reason }); }
function closeHud() { hud()?.remove(); hudActor = null; hudToken = null; }

function bindHudEvents(el, actor) {
  el.querySelectorAll("[data-tab]").forEach(btn => btn.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); const next = btn.dataset.tab || "attaques"; if (activeTab === next && !el.classList.contains("collapsed")) return setCollapsed(true, true); activeTab = next; renderHud(actor, tokenFor(actor), { reason: "tab" }); setCollapsed(false, true); }));
  el.querySelectorAll("[data-action]").forEach(btn => btn.addEventListener("click", ev => handleAction(ev, actor, btn)));
}
async function handleAction(ev, actor, btn) {
  ev.preventDefault(); ev.stopPropagation();
  const action = btn.dataset.action;
  try {
    if (action === "toggle-collapse") return setCollapsed(!hud()?.classList.contains("collapsed"), true);
    if (action === "select-spell-group") { selectedSpellGroup = btn.dataset.spellGroup || selectedSpellGroup; return renderHud(actor, tokenFor(actor), { reason: "select-spell-group" }); }
    if (action === "attack") return sheetAttack(actor, btn.dataset.itemId);
    if (action === "cast-spell") return sheetCastSpell(actor, btn.dataset.itemId);
    if (action === "use-feature") return sheetUseFeature(actor, Number(btn.dataset.featureIndex));
    if (action === "remove-effect") return removeEffect(actor, btn.dataset.effectId);
    if (action === "roll-save") return sheetRollSave(actor, Number(btn.dataset.saveIndex));
    if (action === "roll-ability") return sheetRollAbility(actor, btn.dataset.ability);
  } catch (err) { console.error(`${TAG}[ACTION_ERROR]`, { action, err }); ui.notifications.error(`ADD2E HUD | Erreur action ${action}`); }
}

async function sheetAttack(actor, itemId) { const arme = actor?.items?.get?.(itemId); if (!arme) return ui.notifications.warn("Arme introuvable."); if (typeof globalThis.add2eAttackRoll !== "function") return ui.notifications.error("Fonction add2eAttackRoll introuvable."); return globalThis.add2eAttackRoll({ actor, arme }); }
async function sheetCastSpell(actor, itemId) { const sort = actor?.items?.get?.(itemId); if (!sort) return ui.notifications.warn("Sort introuvable."); if (typeof globalThis.add2eCastSpell !== "function") return ui.notifications.error("Fonction add2eCastSpell introuvable."); return globalThis.add2eCastSpell({ actor, sort }); }
async function sheetRollAbility(actor, carac) { if (typeof globalThis.add2eRollCharacteristicCard !== "function") return ui.notifications.error("Fonction add2eRollCharacteristicCard introuvable."); return globalThis.add2eRollCharacteristicCard(actor, carac); }
async function sheetRollSave(actor, idx) { if (typeof globalThis.add2eRollSaveCard !== "function") return ui.notifications.error("Fonction add2eRollSaveCard introuvable."); return globalThis.add2eRollSaveCard(actor, idx); }
async function sheetUseFeature(actor, index) { const feature = features(actor)[index]; if (!feature) return ui.notifications.warn("Capacité introuvable."); if (typeof globalThis.add2eExecuteClassFeatureOnUse !== "function") return ui.notifications.error("Fonction add2eExecuteClassFeatureOnUse introuvable."); return globalThis.add2eExecuteClassFeatureOnUse(actor, feature, null); }
async function removeEffect(actor, effectId) { const effect = actor?.effects?.get?.(effectId); if (!effect) return ui.notifications.warn("Effet introuvable."); const DialogV2 = foundry?.applications?.api?.DialogV2; const ok = DialogV2?.confirm ? await DialogV2.confirm({ window: { title: "Supprimer l'effet" }, content: `<p>Supprimer <strong>${esc(effect.name)}</strong> ?</p>`, yes: { label: "Supprimer", icon: "fas fa-trash" }, no: { label: "Annuler" } }) : true; if (!ok) return false; await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id]); return renderHud(actor, hudToken, { reason: "remove-effect" }); }

function startResize(ev) { const handle = ev.target?.closest?.("[data-resize-handle]"); const el = ev.target?.closest?.(`#${HUD_ID}`); if (!handle || !el || ev.button !== 0) return false; ev.preventDefault(); ev.stopPropagation(); resizing = true; const start = { x: ev.clientX, y: ev.clientY, ...loadState() }; const move = e => { const s = loadState(); s.width = clamp(start.width + e.clientX - start.x, 420, Math.max(440, window.innerWidth - s.left - 8)); s.maxMenuHeight = clamp(start.maxMenuHeight + e.clientY - start.y, 140, Math.max(160, window.innerHeight - 130)); applyGeometry(el, true); }; const up = () => { window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", up, true); resizing = false; saveState({ width: el.offsetWidth || loadState().width }); applyGeometry(el, true); }; window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", up, true); return true; }
function startDrag(ev) { const el = ev.target?.closest?.(`#${HUD_ID}`); const handle = ev.target?.closest?.("[data-drag-handle]"); if (!el || !handle || ev.button !== 0 || ev.target.closest?.("button,a,input,select,textarea,[data-action],[data-tab],[data-resize-handle]")) return; ev.preventDefault(); ev.stopPropagation(); dragging = true; const s0 = loadState(); const start = { x: ev.clientX, y: ev.clientY, left: s0.left, bottom: s0.bottom }; const move = e => { const s = loadState(); s.left = clamp(start.left + e.clientX - start.x, 8, Math.max(8, window.innerWidth - (el.offsetWidth || s.width) - 8)); s.bottom = clamp(start.bottom - (e.clientY - start.y), 8, Math.max(8, window.innerHeight - 110)); applyGeometry(el, true); saveState({ left: Math.round(s.left), bottom: Math.round(s.bottom) }); }; const up = () => { window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", up, true); dragging = false; applyGeometry(el, true); }; window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", up, true); }
function pointerDown(ev) { if (startResize(ev)) return; startDrag(ev); }

function currentCombatant(combat = game.combat) { if (!combat) return null; const id = combat.current?.combatantId ?? combat.combatantId ?? null; return (id ? combat.combatants?.get?.(id) : null) ?? combat.combatant ?? combat.turns?.[Number(combat.current?.turn ?? combat.turn)] ?? null; }
function tokenFromCombatant(c) { return c?.token?.object ?? (c?.tokenId ? canvas?.tokens?.get?.(c.tokenId) : null) ?? null; }
function followCombat(combat = game.combat, forceOpen = false) { if (Date.now() < manualIntentUntil) return false; const c = currentCombatant(combat); if (!c?.actor || (!forceOpen && !hud())) return false; return renderHud(c.actor, tokenFromCombatant(c), { reason: "combat" }); }

Hooks.once("init", () => { game.add2e = game.add2e ?? {}; game.add2e.actionHudVersion = ADD2E_ACTION_HUD_VERSION; game.add2e.openActionHud = (actor = null) => { const token = canvas?.tokens?.controlled?.[0] ?? null; return renderHud(actor ?? token?.actor ?? game.user?.character, actor ? tokenFor(actor) : token, { reason: "api-open" }); }; game.add2e.closeActionHud = closeHud; game.add2e.refreshActionHud = () => hudActor ? renderHud(hudActor, hudToken, { reason: "api-refresh-current" }) : refreshHud("api-refresh"); Object.assign(globalThis, { add2eRenderActionHud: renderHud, add2eRefreshActionHud: refreshHud, add2eCloseActionHud: closeHud, add2eHudCheck: () => ({ version: ADD2E_ACTION_HUD_VERSION, actor: currentActor()?.name ?? null, actorId: currentActor()?.id ?? null, activeTab, selectedSpellGroup, attackRoll: typeof globalThis.add2eAttackRoll, castSpell: typeof globalThis.add2eCastSpell, rollCarac: typeof globalThis.add2eRollCharacteristicCard, rollSave: typeof globalThis.add2eRollSaveCard, featureUse: typeof globalThis.add2eExecuteClassFeatureOnUse, hud: !!hud() }) }); console.log(`${TAG}[INIT]`, ADD2E_ACTION_HUD_VERSION); });
Hooks.once("ready", () => { document.addEventListener("pointerdown", pointerDown, true); window.addEventListener("resize", () => applyGeometry(hud(), true)); setTimeout(() => refreshHud("ready"), 300); });
Hooks.on("controlToken", () => { manualIntentUntil = Date.now() + 500; setTimeout(() => refreshHud("controlToken"), 60); });
Hooks.on("canvasReady", () => setTimeout(() => refreshHud("canvasReady"), 150));
Hooks.on("updateCombat", combat => setTimeout(() => followCombat(combat, false), 80));
Hooks.on("combatTurn", combat => setTimeout(() => followCombat(combat, false), 80));
Hooks.on("combatRound", combat => setTimeout(() => followCombat(combat, false), 80));
Hooks.on("updateActor", actor => { if (actor?.id === hudActor?.id && !dragging && !resizing) setTimeout(() => renderHud(actor, hudToken, { reason: "updateActor" }), 80); });
for (const hookName of ["createItem", "updateItem", "deleteItem", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) Hooks.on(hookName, doc => { const actor = doc?.parent; if (actor?.id === hudActor?.id && !dragging && !resizing) setTimeout(() => renderHud(actor, hudToken, { reason: hookName }), 80); });

export { renderHud as add2eRenderActionHud, refreshHud as add2eRefreshActionHud, closeHud as add2eCloseActionHud };
