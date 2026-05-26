// scripts/add2e-action-hud.mjs
// ADD2E — HUD d'action rapide maison, indépendant d'Argon.
// Version : 2026-05-25-v27-effects-origin-filter-fix

const ADD2E_ACTION_HUD_VERSION = "2026-05-25-v27-effects-origin-filter-fix";
const TAG = "[ADD2E][ACTION_HUD]";
const HUD_ID = "add2e-action-hud";
const STYLE_ID = "add2e-action-hud-style";
const STORAGE_KEY = "add2e.actionHud.state.v27";

let hudActor = null;
let hudToken = null;
let activeTab = "attaques";
let dragging = false;
let resizing = false;
let suppressClickUntil = 0;
let manualIntentUntil = 0;
let state = null;

const TABS = ["attaques", "sorts", "capacites", "effets", "sauvegardes", "caracs"];
const CARACS = [
  ["force", "FOR", "Force", "fa-fist-raised", "force"],
  ["dexterite", "DEX", "Dextérité", "fa-running", "dexterite"],
  ["constitution", "CON", "Constitution", "fa-heart", "constitution"],
  ["intelligence", "INT", "Intelligence", "fa-brain", "intelligence"],
  ["sagesse", "SAG", "Sagesse", "fa-eye", "sagesse"],
  ["charisme", "CHA", "Charisme", "fa-comments", "charisme"]
];
const SAVES = [
  ["Paralysie", "Paralysie / poison / mort", "fa-shield-alt", "save0"],
  ["Pétrification", "Pétrification / métamorphose", "fa-mountain", "save1"],
  ["Baguettes", "Baguettes", "fa-magic", "save2"],
  ["Souffles", "Souffles", "fa-wind", "save3"],
  ["Sorts", "Sorts", "fa-scroll", "save4"]
];

function add2eHudNow() { return Date.now(); }
function esc(v) {
  try { return foundry.utils.escapeHTML(String(v ?? "")); }
  catch (_e) { return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
}
function arr(v) {
  if (v === undefined || v === null || v === "") return [];
  if (Array.isArray(v)) return v;
  if (v instanceof Set) return [...v];
  if (typeof v?.values === "function") return [...v.values()];
  if (typeof v?.[Symbol.iterator] === "function") return [...v];
  if (typeof v === "object") return Object.values(v);
  return [v];
}
function num(v, fallback = 0) {
  if (typeof v === "string") {
    const m = v.match(/-?\d+(?:[.,]\d+)?/);
    if (!m) return fallback;
    v = m[0].replace(",", ".");
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function norm(v) {
  return String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9:_-]+/g, "_");
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function hud() { return document.getElementById(HUD_ID); }
function currentActor() { return hudActor ?? canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null; }
function currentTokenFor(actor) {
  if (!actor) return null;
  return canvas?.tokens?.controlled?.find?.(t => t.actor?.id === actor.id) ?? actor.getActiveTokens?.()[0] ?? null;
}
function isCharacter(actor) { return String(actor?.type ?? "").toLowerCase() === "personnage"; }
function isMonster(actor) { return String(actor?.type ?? "").toLowerCase() === "monster"; }
function canUse(actor) { return !!actor && (game.user?.isGM || actor.isOwner || actor.testUserPermission?.(game.user, "OWNER")); }
function isRelevant(actor) { return isCharacter(actor) ? canUse(actor) : (isMonster(actor) ? game.user?.isGM === true : false); }

function defaultState() { return { left: 116, bottom: 22, width: 560, maxMenuHeight: 320, menuRetracted: false }; }
function loadState() {
  if (state) return state;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem("add2e.actionHud.state.v26") || localStorage.getItem("add2e.actionHud.state.v25") || "null");
    state = raw && typeof raw === "object" ? { ...defaultState(), ...raw } : defaultState();
  } catch (_e) { state = defaultState(); }
  return state;
}
function saveState(partial = {}) {
  Object.assign(loadState(), partial);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_e) {}
}
function headerHeight(el = hud()) { return Math.max(72, el?.querySelector?.(".a2e-hud-header")?.getBoundingClientRect?.().height || 96); }
function applyGeometry(el = hud(), force = false) {
  if (!el || (!force && (dragging || resizing))) return;
  const s = loadState();
  s.width = clamp(num(s.width, 560), 360, Math.max(380, window.innerWidth - 16));
  s.left = clamp(num(s.left, 116), 8, Math.max(8, window.innerWidth - s.width - 8));
  s.bottom = clamp(num(s.bottom, 22), 8, Math.max(8, window.innerHeight - headerHeight(el) - 8));
  s.maxMenuHeight = clamp(num(s.maxMenuHeight, 320), 90, Math.max(110, window.innerHeight - headerHeight(el) - 50));
  el.style.setProperty("left", `${Math.round(s.left)}px`, "important");
  el.style.setProperty("bottom", `${Math.round(s.bottom)}px`, "important");
  el.style.setProperty("top", "auto", "important");
  el.style.setProperty("right", "auto", "important");
  el.style.setProperty("width", `${Math.round(s.width)}px`, "important");
  el.style.setProperty("--a2e-hud-menu-max", `${Math.round(s.maxMenuHeight)}px`);
}
function saveGeometry(el = hud()) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  saveState({ left: Math.round(r.left), bottom: Math.round(Math.max(8, window.innerHeight - r.bottom)), width: Math.round(el.offsetWidth || r.width || 560) });
}
function setRetracted(el, retracted, persist = true) {
  if (!el) return;
  el.classList.toggle("collapsed", retracted);
  el.classList.toggle("a2e-hud-menu-retracted", retracted);
  const panel = el.querySelector(".a2e-hud-menu-panel");
  if (panel) retracted ? panel.style.setProperty("display", "none", "important") : panel.style.removeProperty("display");
  applyGeometry(el, true);
  if (persist) saveState({ menuRetracted: retracted });
}
function isRetracted(el = hud()) { return !!el?.classList?.contains("a2e-hud-menu-retracted") || !!el?.classList?.contains("collapsed"); }
function applyState(el) { setRetracted(el, loadState().menuRetracted === true, false); }

function effectValues(collection) { return arr(collection).filter(Boolean); }
function allActorEffects(actor) {
  const out = [];
  if (!actor) return out;
  for (const source of [actor.effects, actor.appliedEffects, actor.temporaryEffects]) out.push(...effectValues(source));
  try { out.push(...effectValues(actor.allApplicableEffects?.())); } catch (_e) {}
  return out;
}
function collectEffects(actor = currentActor(), token = hudToken) {
  const sources = [actor, token?.actor, canvas?.tokens?.controlled?.[0]?.actor, game.actors?.get?.(actor?.id)].filter(Boolean);
  const map = new Map();
  for (const a of sources) {
    for (const e of allActorEffects(a)) {
      const key = e.uuid || e.id || `${a.id ?? a.name}:${e.name}:${e.origin ?? ""}`;
      if (!map.has(key)) map.set(key, e);
    }
  }
  return [...map.values()];
}
function effectOriginItem(actor, effect) {
  const flags = effect?.flags?.add2e ?? {};
  const directId = flags.sourceItemId ?? flags.itemId ?? flags.originItemId ?? null;
  if (directId && actor?.items?.get?.(directId)) return actor.items.get(directId);
  const origin = String(effect?.origin ?? "");
  const itemId = origin.match(/\.Item\.([A-Za-z0-9]{16})/)?.[1] ?? origin.match(/Item\.([A-Za-z0-9]{16})/)?.[1] ?? null;
  return itemId && actor?.items?.get?.(itemId) ? actor.items.get(itemId) : null;
}
function isRaceOrClassEffect(actor, effect) {
  const item = effectOriginItem(actor, effect);
  const itemType = String(item?.type ?? "").toLowerCase();

  if (["sort", "arme", "armure", "objet", "object", "objet_magique", "magic", "equipment"].includes(itemType)) return false;
  if (["race", "classe", "class"].includes(itemType)) return true;

  const flags = effect?.flags?.add2e ?? {};
  const explicit = [
    flags.type,
    flags.category,
    flags.sourceType,
    flags.sourceItemType,
    ...arr(flags.tags),
    ...arr(flags.effectTags)
  ].map(norm).filter(Boolean);

  if (explicit.some(t => ["race", "racial", "raciaux", "raciale", "classe", "class", "class_feature"].includes(t))) return true;

  const name = norm(effect?.name ?? "");
  if (/effets_de_classe|effet_de_classe|class_feature/.test(name)) return true;

  return false;
}
function isSpellEffect(actor, effect) {
  const item = effectOriginItem(actor, effect);
  if (String(item?.type ?? "").toLowerCase() === "sort") return true;
  const flags = effect?.flags?.add2e ?? {};
  const tags = [flags.type, flags.category, flags.sourceType, flags.sourceItemType, ...arr(flags.tags), ...arr(flags.effectTags)].map(norm).filter(Boolean);
  if (tags.some(t => ["sort", "spell", "magie", "magique", "magical", "sortilege"].includes(t))) return true;
  return /benediction|aura_magique|nystul|malediction|protection|bouclier/.test(norm(effect?.name ?? ""));
}
function visibleEffects(actor = currentActor()) {
  return collectEffects(actor, hudToken).filter(e => e && e.disabled !== true).filter(e => !isRaceOrClassEffect(actor, e));
}
function effectDuration(effect, actor) {
  const d = effect?.duration ?? {};
  if (Number(d.rounds) > 0) return `${d.rounds} round${Number(d.rounds) > 1 ? "s" : ""}`;
  if (Number(d.turns) > 0) return `${d.turns} tour${Number(d.turns) > 1 ? "s" : ""}`;
  if (Number(d.seconds) > 0) return `${d.seconds} sec.`;
  if (d.combat) return "Combat";
  if (d.endTime) return "Temporaire";
  if (actor && isSpellEffect(actor, effect)) return "Sort actif";
  if (arr(effect?.statuses).length) return "État";
  return "Actif";
}

function isEquipped(item) {
  const s = item?.system ?? {};
  return s.equipee === true || s.equipped === true || s.portee === true || s.worn === true || s.estEquipee === true;
}
function preparedCount(sort) {
  try { const n = Number(globalThis.add2eGetTotalMemorizedCount?.(sort)); if (Number.isFinite(n)) return n; } catch (_e) {}
  const f = sort?.flags?.add2e ?? {}, s = sort?.system ?? {};
  for (const v of [sort?.getFlag?.("add2e", "memorizedCount"), f.memorizedCount, f.preparedCount, s.memorizedCount, s.preparedCount, s.prepared, s.memorise, s.memorized, s.prepared?.value, s.memorisation?.value, s.memorisation, s.slots?.prepared, s.slots?.value]) {
    const n = num(v, NaN);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}
function isObjectPowerSpell(sort) {
  const s = sort?.system ?? {};
  if (s.isPower === true || s.isObjectPower === true || s.sourceWeaponId || s.sourceItemId || s.powerIndex !== undefined) return true;
  try { return globalThis.add2eIsObjectMagicSpellForPreparation?.(sort) === true; } catch (_e) { return false; }
}
function weapons(actor) { return actor?.items?.filter?.(i => String(i.type ?? "").toLowerCase() === "arme" && isEquipped(i)) ?? []; }
function spells(actor) { return actor?.items?.filter?.(i => String(i.type ?? "").toLowerCase() === "sort" && !isObjectPowerSpell(i) && preparedCount(i) > 0) ?? []; }
function featureHasScript(f) { return !!(f?.activable === true || f?.usable === true || f?.onUse || f?.onuse || f?.on_use || f?.script || f?.macro || f?.action); }
function classFeatures(actor) {
  const level = Math.max(1, num(actor?.system?.niveau, 1));
  const d = actor?.system?.details_classe ?? {};
  const raw = d.classFeatures ?? d.capacitesClasse ?? actor?.system?.classFeatures ?? actor?.system?.capacites ?? actor?.system?.capacitesSpeciales ?? [];
  const fromClass = actor?.items?.filter?.(i => String(i.type ?? "").toLowerCase() === "classe")?.flatMap(i => arr(i.system?.classFeatures ?? i.system?.capacitesClasse)) ?? [];
  const seen = new Set();
  return [...arr(raw), ...fromClass]
    .filter(f => f && typeof f === "object" && featureHasScript(f))
    .map((f, i) => ({ ...f, __index: f.__index ?? i }))
    .filter(f => isMonster(actor) || (level >= num(f.minLevel ?? f.minimumLevel ?? f.niveauMin ?? f.level ?? f.niveau ?? 1, 1) && level <= num(f.maxLevel ?? f.maximumLevel ?? f.niveauMax ?? f.max ?? 999, 999)))
    .filter(f => { const k = String(f.id ?? f.slug ?? f.name ?? f.label ?? f.nom ?? f.__index); if (seen.has(k)) return false; seen.add(k); return true; });
}
function abilityValue(actor, key) {
  const direct = Number(actor?.system?.[key]);
  if (Number.isFinite(direct)) return direct;
  return num(actor?.system?.[`${key}_base`], 10) + num(actor?.system?.bonus_caracteristiques?.[key] ?? actor?.system?.[`${key}_race`], 0) + num(actor?.system?.bonus_divers_caracteristiques?.[key] ?? actor?.system?.[`${key}_bonus`], 0);
}
function savingThrows(actor) {
  const level = Math.max(1, num(actor?.system?.niveau, 1));
  const row = actor?.system?.details_classe?.progression?.[level - 1];
  const values = arr(row?.savingThrows || actor?.system?.sauvegardes || actor?.system?.savingThrows || []).map(v => num(v, 0));
  return values.length >= 5 ? values.slice(0, 5) : [0, 0, 0, 0, 0];
}
function hp(actor) { return num(actor?.system?.pdv ?? actor?.system?.pv?.value ?? actor?.system?.hp?.value ?? actor?.system?.hp, 0); }
function hpMax(actor) { return num(actor?.system?.points_de_coup ?? actor?.system?.pv?.max ?? actor?.system?.hp?.max ?? actor?.system?.hpMax, hp(actor)); }
function thaco(actor) {
  const direct = actor?.system?.thac0 ?? actor?.system?.thaco ?? actor?.system?.combat?.thac0;
  if (direct !== undefined && direct !== null && direct !== "") return direct;
  const level = Math.max(1, num(actor?.system?.niveau, 1));
  const row = actor?.system?.details_classe?.progression?.[level - 1];
  return row?.thac0 ?? row?.thaco ?? 20;
}
function armorClass(actor) { return actor?.system?.ca_total ?? actor?.system?.ca ?? actor?.system?.armorClass ?? actor?.system?.ac ?? "—"; }
function damageText(item) { const s = item?.system ?? item ?? {}; return s?.dégâts?.contre_moyen ?? s?.degats?.contre_moyen ?? s?.degats_moyen ?? s?.damage ?? s?.degats ?? s?.dmg ?? "—"; }
function rangeText(item) {
  const s = item?.system ?? item ?? {};
  const parts = [s.portee_courte ?? s.portee_short, s.portee_moyenne ?? s.portee_medium, s.portee_longue ?? s.portee_long].filter(v => v !== undefined && v !== null && String(v) !== "");
  return parts.length ? parts.join(" / ") : "Contact";
}

function injectStyle() {
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
#${HUD_ID}{position:fixed;z-index:100;color:#f6e8bd;font-family:var(--font-primary,Signika,sans-serif);pointer-events:auto;min-width:360px;right:auto!important;top:auto!important;touch-action:none;user-select:none}
#${HUD_ID}.collapsed .a2e-hud-menu-panel,#${HUD_ID}.a2e-hud-menu-retracted .a2e-hud-menu-panel{display:none!important}
#${HUD_ID} .a2e-hud-shell{display:flex;flex-direction:column;justify-content:flex-end;border:1px solid #8a611d;border-radius:14px;overflow:hidden;background:linear-gradient(145deg,rgba(32,25,16,.97),rgba(18,14,10,.96));box-shadow:0 8px 26px rgba(0,0,0,.48)}
#${HUD_ID} .a2e-hud-menu-panel{max-height:var(--a2e-hud-menu-max,320px)!important;padding:9px!important;overflow-y:auto!important;border-bottom:1px solid rgba(184,137,36,.45);background:rgba(0,0,0,.12)}
#${HUD_ID} .a2e-hud-section{display:none!important}#${HUD_ID} .a2e-hud-section.active{display:grid!important;gap:7px!important;align-content:start!important}
#${HUD_ID} .a2e-hud-tabs{display:grid;grid-template-columns:repeat(6,1fr);border-bottom:1px solid rgba(184,137,36,.45);background:rgba(0,0,0,.18)}#${HUD_ID} .a2e-hud-tab{min-height:34px;border:0;border-right:1px solid rgba(184,137,36,.32);background:transparent;color:#d8bd78;font-size:.74em;font-weight:900;cursor:pointer}#${HUD_ID} .a2e-hud-tab.active{color:#211307;background:linear-gradient(180deg,#f0c66d,#c78d2e)}
#${HUD_ID} .a2e-hud-header{display:grid;grid-template-columns:74px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:9px 10px;background:linear-gradient(180deg,rgba(78,48,18,.78),rgba(36,26,14,.62));cursor:move;user-select:none}#${HUD_ID} .a2e-hud-portrait{width:64px;height:64px;border-radius:12px;object-fit:cover;border:2px solid #c4973f;background:#111}#${HUD_ID} .a2e-hud-name{color:#fff4cf;font-size:1.12em;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#${HUD_ID} .a2e-hud-subtitle{color:#d8bd78;font-size:.82em;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${HUD_ID} .a2e-hud-metrics{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}#${HUD_ID} .a2e-hud-pill{display:inline-flex;min-height:22px;padding:2px 7px;border:1px solid rgba(214,176,90,.75);border-radius:999px;background:rgba(255,244,201,.12);color:#fff0bd;font-size:.78em;font-weight:850;white-space:nowrap}
#${HUD_ID} .a2e-hud-icon-btn,#${HUD_ID} .a2e-hud-resize{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:1px solid rgba(214,176,90,.75);border-radius:9px;background:rgba(255,244,201,.12);color:#ffe4a1;cursor:pointer}#${HUD_ID} .a2e-hud-resize{cursor:nwse-resize!important}
#${HUD_ID} .a2e-hud-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:48px;padding:6px;border:1px solid rgba(214,176,90,.38);border-radius:10px;background:rgba(255,250,235,.07)}#${HUD_ID} .a2e-hud-row.compact{grid-template-columns:minmax(0,1fr) auto;min-height:38px}#${HUD_ID} .a2e-hud-row img{width:34px;height:34px;border-radius:7px;object-fit:cover;border:1px solid rgba(214,176,90,.65);background:rgba(0,0,0,.25)}#${HUD_ID} .a2e-hud-effect-row.spell-effect{background:linear-gradient(135deg,rgba(72,48,142,.42),rgba(34,24,76,.22));border-color:rgba(157,126,255,.72)}
#${HUD_ID} .a2e-hud-row-title{color:#fff4cf;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#${HUD_ID} .a2e-hud-row-meta{display:flex;flex-wrap:wrap;gap:4px 8px;color:#c8ad6e;font-size:.76em;font-weight:750;margin-top:2px}#${HUD_ID} .a2e-hud-action{min-width:78px;min-height:30px;padding:4px 9px;border:1px solid #d6b05a;border-radius:9px;background:linear-gradient(180deg,#fff0bd,#d6a345);color:#211307;font-size:.8em;font-weight:950;cursor:pointer;white-space:nowrap}#${HUD_ID} .a2e-hud-empty{padding:12px;border:1px dashed rgba(214,176,90,.45);border-radius:10px;color:#c8ad6e;font-style:italic;text-align:center}
#${HUD_ID} .a2e-hud-ability-grid,#${HUD_ID} .a2e-hud-save-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}#${HUD_ID} .a2e-hud-ability,#${HUD_ID} .a2e-hud-save-cell{display:grid;grid-template-columns:36px minmax(0,1fr);gap:8px;align-items:center;min-height:62px;padding:8px;border-radius:12px;border:1px solid rgba(214,176,90,.38);background:rgba(255,250,235,.07)}#${HUD_ID} .a2e-hud-roll-icon{width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:11px;background:rgba(0,0,0,.26);border:1px solid rgba(255,255,255,.22);color:#fff2c0;cursor:pointer}#${HUD_ID} .a2e-hud-roll-icon:hover{filter:brightness(1.18)}#${HUD_ID} .a2e-hud-cell-main b{display:block;color:#fff;font-size:1.28em;line-height:1.05;text-shadow:0 1px 2px rgba(0,0,0,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${HUD_ID} .carac-force{background:linear-gradient(135deg,rgba(135,40,28,.55),rgba(58,24,18,.25))}#${HUD_ID} .carac-dexterite{background:linear-gradient(135deg,rgba(42,112,59,.55),rgba(20,54,36,.25))}#${HUD_ID} .carac-constitution{background:linear-gradient(135deg,rgba(151,89,28,.55),rgba(77,45,18,.25))}#${HUD_ID} .carac-intelligence{background:linear-gradient(135deg,rgba(45,79,151,.55),rgba(18,37,77,.25))}#${HUD_ID} .carac-sagesse{background:linear-gradient(135deg,rgba(96,62,151,.55),rgba(48,31,80,.25))}#${HUD_ID} .carac-charisme{background:linear-gradient(135deg,rgba(147,50,116,.55),rgba(80,23,61,.25))}
#${HUD_ID} button,#${HUD_ID} [data-hud-tab],#${HUD_ID} [data-action]{user-select:auto;touch-action:auto}`;
  document.head.appendChild(style);
}

function weaponRows(actor) {
  const rows = weapons(actor);
  if (!rows.length) return `<div class="a2e-hud-empty">Aucune arme équipée.</div>`;
  return rows.map(i => `<div class="a2e-hud-row"><img src="${esc(i.img || "icons/svg/sword.svg")}" alt=""><div><div class="a2e-hud-row-title">${esc(i.name)}</div><div class="a2e-hud-row-meta"><span>Équipée</span><span>Dégâts ${esc(damageText(i))}</span><span>Portée ${esc(rangeText(i))}</span></div></div><button type="button" class="a2e-hud-action" data-action="attack" data-item-id="${esc(i.id)}">Attaquer</button></div>`).join("");
}
function spellRows(actor) {
  const rows = spells(actor);
  if (!rows.length) return `<div class="a2e-hud-empty">Aucun sort préparé.</div>`;
  return rows.map(i => `<div class="a2e-hud-row"><img src="${esc(i.img || "icons/svg/book.svg")}" alt=""><div><div class="a2e-hud-row-title">${esc(i.name)}</div><div class="a2e-hud-row-meta"><span>Niv. ${esc(i.system?.niveau ?? i.system?.level ?? "—")}</span><span>Préparé ${preparedCount(i)}</span></div></div><button type="button" class="a2e-hud-action" data-action="cast-spell" data-item-id="${esc(i.id)}">Lancer</button></div>`).join("");
}
function featureRows(actor) {
  const rows = classFeatures(actor);
  if (!rows.length) return `<div class="a2e-hud-empty">Aucune capacité utilisable.</div>`;
  return rows.map(f => `<div class="a2e-hud-row compact"><div><div class="a2e-hud-row-title">${esc(f.name ?? f.label ?? f.nom ?? `Capacité ${Number(f.__index) + 1}`)}</div><div class="a2e-hud-row-meta"><span>Utilisable</span></div></div><button type="button" class="a2e-hud-action" data-action="use-feature" data-feature-index="${esc(f.__index)}">Utiliser</button></div>`).join("");
}
function effectRows(actor) {
  const rows = visibleEffects(actor);
  if (!rows.length) return `<div class="a2e-hud-empty">Aucun effet actif.</div>`;
  return rows.map(e => {
    const spell = isSpellEffect(actor, e);
    const item = effectOriginItem(actor, e);
    const img = e.img || e.icon || item?.img || (spell ? "icons/svg/aura.svg" : "icons/svg/statuses.svg");
    return `<div class="a2e-hud-row a2e-hud-effect-row ${spell ? "spell-effect" : ""}"><img src="${esc(img)}" alt=""><div><div class="a2e-hud-row-title">${esc(e.name ?? "Effet")}</div><div class="a2e-hud-row-meta"><span>${spell ? "Sort" : "Effet"}</span><span>${esc(effectDuration(e, actor))}</span>${item?.name ? `<span>${esc(item.name)}</span>` : ""}</div></div><button type="button" class="a2e-hud-action" data-action="open-effect" data-effect-id="${esc(e.id)}">Voir</button></div>`;
  }).join("");
}
function saveRows(actor) {
  const values = savingThrows(actor);
  return `<div class="a2e-hud-save-grid">${SAVES.map((s, i) => `<div class="a2e-hud-save-cell save-${s[3]}" title="${esc(s[1])}"><button type="button" class="a2e-hud-roll-icon" data-action="roll-save" data-save-index="${i}" aria-label="Jet ${esc(s[0])}"><i class="fas ${s[2]}"></i></button><div class="a2e-hud-cell-main"><b>${esc(s[0])} ${esc(values[i] || "—")}</b></div></div>`).join("")}</div>`;
}
function abilityRows(actor) {
  return `<div class="a2e-hud-ability-grid">${CARACS.map(c => `<div class="a2e-hud-ability carac-${c[4]}" title="${esc(c[2])}"><button type="button" class="a2e-hud-roll-icon" data-action="roll-ability" data-ability="${c[0]}" aria-label="Jet ${esc(c[2])}"><i class="fas ${c[3]}"></i></button><div class="a2e-hud-cell-main"><b>${c[1]} ${abilityValue(actor, c[0])}</b></div></div>`).join("")}</div>`;
}
function hudHtml(actor, token = null) {
  const img = token?.document?.texture?.src || actor.img || "icons/svg/mystery-man.svg";
  const monster = isMonster(actor);
  const race = monster ? (actor.system?.type ?? actor.system?.race ?? "Monstre") : (actor.system?.race || actor.system?.details_race?.label || actor.items?.find?.(i => i.type === "race")?.name || "Race");
  const classe = monster ? (actor.system?.taille ?? actor.system?.size ?? actor.system?.alignment ?? "MJ") : (actor.system?.classe || actor.system?.details_classe?.label || actor.items?.find?.(i => i.type === "classe")?.name || "Classe");
  const niveau = monster ? (actor.system?.dv ?? actor.system?.hitDice ?? actor.system?.niveau ?? "—") : (actor.system?.niveau ?? "—");
  const tab = (key, icon, label) => `<button type="button" class="a2e-hud-tab ${activeTab === key ? "active" : ""}" data-hud-tab="${key}"><i class="${icon}"></i> ${label}</button>`;
  const section = (key, html) => `<section class="a2e-hud-section ${activeTab === key ? "active" : ""}" data-hud-section="${key}">${html}</section>`;
  return `<div class="a2e-hud-shell"><div class="a2e-hud-menu-panel">${section("attaques", weaponRows(actor))}${section("sorts", spellRows(actor))}${section("capacites", featureRows(actor))}${section("effets", effectRows(actor))}${section("sauvegardes", saveRows(actor))}${section("caracs", abilityRows(actor))}</div><nav class="a2e-hud-tabs">${tab("attaques", "fas fa-swords", "Armes")}${tab("sorts", "fas fa-book", "Sorts")}${tab("capacites", "fas fa-bolt", "Capacités")}${tab("effets", "fas fa-hourglass-half", "Effets")}${tab("sauvegardes", "fas fa-shield-alt", "Sauv.")}${tab("caracs", "fas fa-dice-d20", "Carac.")}</nav><div class="a2e-hud-header" data-drag-handle="1"><img class="a2e-hud-portrait" src="${esc(img)}" alt="${esc(actor.name)}"><div><div class="a2e-hud-name">${esc(actor.name)}</div><div class="a2e-hud-subtitle">${esc(race)} — ${esc(classe)} ${monster ? "DV" : "niv."} ${esc(niveau)}</div><div class="a2e-hud-metrics"><span class="a2e-hud-pill">PV ${hp(actor)} / ${hpMax(actor)}</span><span class="a2e-hud-pill">CA ${esc(armorClass(actor))}</span><span class="a2e-hud-pill">THAC0 ${esc(thaco(actor))}</span></div></div><button type="button" class="a2e-hud-icon-btn" data-action="toggle-collapse" title="Réduire / agrandir"><i class="fas fa-chevron-down"></i></button><button type="button" class="a2e-hud-resize" data-resize-handle="1" title="Redimensionner"><i class="fas fa-up-right-and-down-left-from-center"></i></button></div></div>`;
}

function add2eRenderActionHud(actor = null, token = null, { reason = "render" } = {}) {
  if (dragging || resizing) return false;
  injectStyle();
  const existing = hud();
  if (!isRelevant(actor)) { existing?.remove(); hudActor = null; hudToken = null; return false; }
  hudActor = actor;
  hudToken = token ?? currentTokenFor(actor);
  if (!TABS.includes(activeTab)) activeTab = "attaques";
  const el = existing ?? document.createElement("div");
  el.id = HUD_ID;
  el.innerHTML = hudHtml(actor, hudToken);
  if (!existing) document.body.appendChild(el);
  applyState(el);
  bindHudEvents(el, actor);
  console.log(`${TAG}[RENDER]`, { reason, actor: actor.name, actorId: actor.id, token: hudToken?.name ?? null, effectsAll: collectEffects(actor, hudToken).map(e => e.name), effectsVisible: visibleEffects(actor).map(e => e.name) });
  return true;
}
function add2eRefreshActionHud(reason = "refresh") {
  const token = canvas?.tokens?.controlled?.[0] ?? null;
  return add2eRenderActionHud(token?.actor ?? game.user?.character ?? null, token, { reason });
}
function add2eCloseActionHud() { hud()?.remove(); hudActor = null; hudToken = null; }

function bindHudEvents(el, actor) {
  el.querySelectorAll("[data-hud-tab]").forEach(btn => btn.addEventListener("click", ev => {
    ev.preventDefault();
    ev.stopPropagation();
    const clicked = btn.dataset.hudTab || "attaques";
    if (activeTab === clicked && !isRetracted(el)) return setRetracted(el, true, true);
    activeTab = clicked;
    add2eRenderActionHud(actor, currentTokenFor(actor), { reason: "tab" });
    window.setTimeout(() => setRetracted(hud(), false, true), 0);
  }));
  el.querySelectorAll("[data-action]").forEach(btn => btn.addEventListener("click", async ev => {
    if (add2eHudNow() < suppressClickUntil) { ev.preventDefault(); ev.stopPropagation(); return; }
    ev.preventDefault();
    ev.stopPropagation();
    const action = btn.dataset.action;
    try {
      if (action === "toggle-collapse") return setRetracted(el, !isRetracted(el), true);
      if (action === "attack") return attack(actor, btn.dataset.itemId);
      if (action === "cast-spell") return castSpell(actor, btn.dataset.itemId);
      if (action === "use-feature") return useFeature(actor, btn.dataset.featureIndex);
      if (action === "open-effect") return openEffect(actor, btn.dataset.effectId);
      if (action === "roll-save") return rollSave(actor, Number(btn.dataset.saveIndex));
      if (action === "roll-ability") return rollAbility(actor, btn.dataset.ability);
    } catch (err) { console.error(`${TAG}[ACTION_ERROR]`, { action, actor: actor?.name, err }); ui.notifications.error(`ADD2E HUD | Erreur pendant l'action : ${action}`); }
  }));
}

function pointerForbidden(target) { return !!target?.closest?.("button,a,input,select,textarea,[data-action],[data-hud-tab],[data-resize-handle]"); }
function preventPointer(ev) { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.(); suppressClickUntil = add2eHudNow() + 450; }
function startResize(ev) {
  const handle = ev.target?.closest?.("[data-resize-handle]");
  const el = ev.target?.closest?.(`#${HUD_ID}`);
  if (!handle || !el || ev.button !== 0) return false;
  preventPointer(ev);
  resizing = true;
  const start = { x: ev.clientX, y: ev.clientY, ...loadState() };
  const move = e => {
    const s = loadState();
    s.width = clamp(start.width + e.clientX - start.x, 360, Math.max(360, window.innerWidth - s.left - 8));
    s.maxMenuHeight = clamp(start.maxMenuHeight + e.clientY - start.y, 90, Math.max(110, window.innerHeight - headerHeight(el) - 50));
    applyGeometry(el, true);
  };
  const up = () => { window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", up, true); window.removeEventListener("pointercancel", up, true); resizing = false; saveGeometry(el); applyGeometry(el, true); };
  window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", up, true); window.addEventListener("pointercancel", up, true);
  return true;
}
function startDrag(ev) {
  const el = ev.target?.closest?.(`#${HUD_ID}`);
  const handle = ev.target?.closest?.("[data-drag-handle]");
  if (!el || !handle || ev.button !== 0 || pointerForbidden(ev.target)) return;
  preventPointer(ev);
  dragging = true;
  const s0 = loadState();
  const start = { x: ev.clientX, y: ev.clientY, left: num(s0.left, 116), bottom: num(s0.bottom, 22) };
  const move = e => {
    const s = loadState();
    s.left = clamp(start.left + e.clientX - start.x, 8, Math.max(8, window.innerWidth - (el.offsetWidth || s.width) - 8));
    s.bottom = clamp(start.bottom - (e.clientY - start.y), 8, Math.max(8, window.innerHeight - headerHeight(el) - 8));
    applyGeometry(el, true);
    saveState({ left: Math.round(s.left), bottom: Math.round(s.bottom), width: Math.round(el.offsetWidth || el.getBoundingClientRect().width || s.width) });
  };
  const up = () => { window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", up, true); window.removeEventListener("pointercancel", up, true); saveGeometry(el); dragging = false; applyGeometry(el, true); };
  window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", up, true); window.addEventListener("pointercancel", up, true);
}
function pointerDown(ev) { if (startResize(ev)) return; startDrag(ev); }

async function attack(actor, itemId) {
  const item = actor?.items?.get?.(itemId);
  if (!item) return ui.notifications.warn("Arme introuvable.");
  if (!isEquipped(item)) return ui.notifications.warn("Cette arme n'est pas équipée.");
  if (typeof globalThis.add2eAttackRoll !== "function") return ui.notifications.error("Fonction add2eAttackRoll introuvable.");
  return globalThis.add2eAttackRoll({ actor, arme: item });
}
async function castSpell(actor, itemId) {
  const sort = actor?.items?.get?.(itemId);
  if (!sort) return ui.notifications.warn("Sort introuvable.");
  if (preparedCount(sort) <= 0) return ui.notifications.warn("Ce sort n'est pas préparé.");
  if (typeof globalThis.add2eCastSpell !== "function") return ui.notifications.error("Fonction add2eCastSpell introuvable.");
  return globalThis.add2eCastSpell({ actor, sort });
}
async function useFeature(actor, featureIndex) {
  const feature = classFeatures(actor).find(f => String(f.__index) === String(featureIndex));
  if (!feature) return ui.notifications.warn("Capacité introuvable ou non utilisable.");
  if (typeof globalThis.add2eExecuteClassFeatureOnUse === "function") return globalThis.add2eExecuteClassFeatureOnUse(actor, feature, null);
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<b>${esc(actor.name)}</b> utilise <b>${esc(feature.name ?? feature.label ?? feature.nom ?? "Capacité")}</b>` });
}
async function openEffect(actor, effectId) {
  const effect = collectEffects(actor, hudToken).find(e => String(e.id) === String(effectId));
  if (!effect) return ui.notifications.warn("Effet introuvable.");
  if (effect.sheet?.render) return effect.sheet.render(true);
  return ui.notifications.warn("La fiche de cet effet ne peut pas être ouverte.");
}
async function rollAbility(actor, carac) {
  if (typeof globalThis.add2eRollCharacteristicCard === "function") return globalThis.add2eRollCharacteristicCard(actor, carac);
  return ui.notifications.warn("Moteur de jet de caractéristique introuvable.");
}
async function rollSave(actor, idx) {
  if (typeof globalThis.add2eRollSaveCard === "function") return globalThis.add2eRollSaveCard(actor, idx);
  return ui.notifications.warn("Moteur de jet de sauvegarde introuvable.");
}

function currentCombatant(combat = game.combat) {
  if (!combat) return null;
  const id = combat.current?.combatantId ?? combat.combatantId ?? null;
  return (id ? combat.combatants?.get?.(id) : null) ?? combat.combatant ?? combat.turns?.[Number(combat.current?.turn ?? combat.turn)] ?? null;
}
function tokenFromCombatant(combatant) {
  if (!combatant) return null;
  return combatant.token?.object ?? (combatant.tokenId ? canvas?.tokens?.get?.(combatant.tokenId) : null) ?? null;
}
function renderCombatant(combatant, { forceOpen = false, reason = "combatant" } = {}) {
  if (!combatant?.actor) return false;
  if (!forceOpen && !hud()) return false;
  return add2eRenderActionHud(combatant.actor, tokenFromCombatant(combatant), { reason });
}
function followCurrentCombatant(combat = game.combat, { forceOpen = false, reason = "combat-follow" } = {}) {
  if (add2eHudNow() < manualIntentUntil && !reason.includes("force")) return false;
  return renderCombatant(currentCombatant(combat), { forceOpen, reason });
}
function scheduleCombatFollow(combat = game.combat, options = {}) { for (const d of [60, 160, 320]) window.setTimeout(() => followCurrentCombatant(combat, options), d); }
function isCombatTurnChange(changes = {}) {
  return foundry.utils.hasProperty(changes, "turn") || foundry.utils.hasProperty(changes, "round") || foundry.utils.hasProperty(changes, "current") || foundry.utils.hasProperty(changes, "current.turn") || foundry.utils.hasProperty(changes, "current.round") || foundry.utils.hasProperty(changes, "current.combatantId") || foundry.utils.hasProperty(changes, "combatantId");
}
function combatantFromTrackerElement(el, combat = game.combat) {
  const row = el?.closest?.("[data-combatant-id], [data-combatant], .combatant, li");
  if (!row || !combat) return null;
  const id = row.dataset?.combatantId ?? row.dataset?.combatant ?? row.dataset?.documentId ?? row.dataset?.id ?? row.getAttribute?.("data-combatant-id") ?? row.id?.replace(/^combatant-/, "");
  return (id ? combat.combatants?.get?.(id) : null) ?? (id ? combat.turns?.find?.(c => c.id === id) : null) ?? null;
}
function bindCombatTracker(app, html) {
  const root = html?.jquery ? html[0] : html;
  if (!root?.addEventListener || root.dataset?.add2eHudTrackerBound === "1") return;
  root.dataset.add2eHudTrackerBound = "1";
  root.addEventListener("click", ev => {
    const c = combatantFromTrackerElement(ev.target, app?.viewed ?? app?.combat ?? game.combat);
    if (!c) return;
    manualIntentUntil = add2eHudNow() + 750;
    renderCombatant(c, { forceOpen: true, reason: "combat-tracker-click" });
  }, true);
}

Hooks.once("init", () => {
  game.add2e = game.add2e ?? {};
  game.add2e.actionHudVersion = ADD2E_ACTION_HUD_VERSION;
  game.add2e.openActionHud = (actor = null) => { const token = canvas?.tokens?.controlled?.[0] ?? null; return add2eRenderActionHud(actor ?? token?.actor ?? game.user?.character, actor ? currentTokenFor(actor) : token, { reason: "api-open" }); };
  game.add2e.closeActionHud = add2eCloseActionHud;
  game.add2e.refreshActionHud = () => hudActor ? add2eRenderActionHud(hudActor, hudToken, { reason: "api-refresh-current" }) : add2eRefreshActionHud("api-refresh");
  game.add2e.followCurrentCombatantHud = () => followCurrentCombatant(game.combat, { forceOpen: true, reason: "api-force-combatant" });
  Object.assign(globalThis, {
    add2eRenderActionHud,
    add2eRefreshActionHud,
    add2eCloseActionHud,
    add2eHudFollowCurrentCombatant: game.add2e.followCurrentCombatantHud,
    add2eHudForceOpen: () => setRetracted(hud(), false, true),
    add2eHudForceRetract: () => setRetracted(hud(), true, true),
    add2eHudAllEffects: () => collectEffects(currentActor(), hudToken).map(e => ({ id: e.id, name: e.name, disabled: e.disabled, img: e.img || e.icon, origin: e.origin, originItem: effectOriginItem(currentActor(), e)?.name ?? null, originType: effectOriginItem(currentActor(), e)?.type ?? null, flags: e.flags?.add2e ?? {}, duration: e.duration ?? {} })),
    add2eHudVisibleEffects: () => visibleEffects(currentActor()).map(e => ({ id: e.id, name: e.name, disabled: e.disabled, img: e.img || e.icon, origin: e.origin, originItem: effectOriginItem(currentActor(), e)?.name ?? null, originType: effectOriginItem(currentActor(), e)?.type ?? null, flags: e.flags?.add2e ?? {}, duration: e.duration ?? {} })),
    add2eHudFixDebug: () => ({ version: ADD2E_ACTION_HUD_VERSION, hud: !!hud(), actorId: hudActor?.id ?? null, actor: currentActor()?.name ?? null, activeTab, state: loadState(), selected: canvas?.tokens?.controlled?.map?.(t => t.name) ?? [], effectsAll: collectEffects(currentActor(), hudToken).map(e => ({ name: e.name, originItem: effectOriginItem(currentActor(), e)?.name ?? null, originType: effectOriginItem(currentActor(), e)?.type ?? null, hiddenRaceClass: isRaceOrClassEffect(currentActor(), e) })), effectsVisible: visibleEffects(currentActor()).map(e => e.name), dragging, resizing }),
    add2eHudCheck: () => ({ version: ADD2E_ACTION_HUD_VERSION, actorId: hudActor?.id ?? null, actor: currentActor()?.name ?? null, activeTab, retracted: loadState().menuRetracted, attackRoll: typeof globalThis.add2eAttackRoll, castSpell: typeof globalThis.add2eCastSpell, featureOnUse: typeof globalThis.add2eExecuteClassFeatureOnUse, hud: !!hud() })
  });
  console.log(`${TAG}[INIT]`, ADD2E_ACTION_HUD_VERSION);
});

Hooks.on("controlToken", () => { manualIntentUntil = add2eHudNow() + 500; window.setTimeout(() => add2eRefreshActionHud("controlToken"), 60); });
Hooks.on("canvasReady", () => window.setTimeout(() => add2eRefreshActionHud("canvasReady"), 150));
Hooks.once("ready", () => {
  document.addEventListener("pointerdown", pointerDown, true);
  window.addEventListener("resize", () => applyGeometry(hud(), true));
  const observer = new MutationObserver(() => { if (!dragging && !resizing) window.requestAnimationFrame(() => applyGeometry(hud())); });
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => add2eRefreshActionHud("ready"), 300);
});
Hooks.on("renderCombatTracker", bindCombatTracker);
Hooks.on("updateCombat", (combat, changes) => { if (isCombatTurnChange(changes ?? {})) scheduleCombatFollow(combat, { forceOpen: false, reason: "updateCombat" }); });
Hooks.on("combatTurn", combat => scheduleCombatFollow(combat, { forceOpen: false, reason: "combatTurn" }));
Hooks.on("combatRound", combat => scheduleCombatFollow(combat, { forceOpen: false, reason: "combatRound" }));
Hooks.on("combatStart", combat => scheduleCombatFollow(combat, { forceOpen: false, reason: "combatStart" }));
Hooks.on("updateActor", actor => { if (actor?.id === hudActor?.id && !dragging && !resizing) window.setTimeout(() => add2eRenderActionHud(currentActor() ?? actor, hudToken, { reason: "updateActor-current" }), 60); });
for (const hookName of ["createItem", "updateItem", "deleteItem", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
  Hooks.on(hookName, doc => {
    const actor = doc?.parent;
    if ((actor?.id === hudActor?.id || actor?.id === currentActor()?.id) && !dragging && !resizing) window.setTimeout(() => add2eRenderActionHud(currentActor() ?? actor, hudToken, { reason: `${hookName}-current` }), 60);
  });
}

export { add2eRenderActionHud, add2eRefreshActionHud, add2eCloseActionHud };