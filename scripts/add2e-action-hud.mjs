// scripts/add2e-action-hud.mjs
// ADD2E — HUD d'action rapide maison, indépendant d'Argon.
// Version : 2026-05-25-v16-bottom-anchor-filter-passive-effects
//
// Source unique de vérité du HUD :
// - hors combat : clic token => HUD du token contrôlé ;
// - en combat : changement de tour => HUD du combattant actif si le HUD est déjà ouvert ;
// - combat tracker : clic combattant => HUD du combattant cliqué ;
// - les refresh updateActor/item/effect rafraîchissent l'acteur déjà affiché, jamais le token sélectionné.

const ADD2E_ACTION_HUD_VERSION = "2026-05-25-v16-bottom-anchor-filter-passive-effects";
const TAG = "[ADD2E][ACTION_HUD]";
const HUD_ID = "add2e-action-hud";
const STORAGE_KEY = "add2e.actionHud.state.v16";

let add2eHudActorId = null;
let add2eHudActiveTab = "attaques";
let add2eHudState = null;
let add2eHudDragging = false;
let add2eHudResizing = false;
let add2eHudSuppressClickUntil = 0;
let add2eHudManualIntentUntil = 0;
let add2eHudApplyScheduled = false;
let add2eHudPointerCaptureId = null;

const ADD2E_HUD_TABS = ["attaques", "sorts", "capacites", "effets", "sauvegardes", "caracs"];
const ADD2E_HUD_CARACS = [
  { key: "force", label: "FOR", title: "Force" },
  { key: "dexterite", label: "DEX", title: "Dextérité" },
  { key: "constitution", label: "CON", title: "Constitution" },
  { key: "intelligence", label: "INT", title: "Intelligence" },
  { key: "sagesse", label: "SAG", title: "Sagesse" },
  { key: "charisme", label: "CHA", title: "Charisme" }
];
const ADD2E_HUD_SAVE_NAMES = ["Paralysie", "Pétrification", "Baguettes", "Souffles", "Sorts"];
const ADD2E_HUD_SAVE_FULL_NAMES = ["Paralysie / poison / mort", "Pétrification / métamorphose", "Baguettes", "Souffles", "Sorts"];

function add2eHudEscape(value) {
  try { return foundry.utils.escapeHTML(String(value ?? "")); }
  catch (_e) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
}
function add2eHudArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value;
  if (value instanceof Set) return [...value];
  if (typeof value === "object") return Object.values(value);
  return [value];
}
function add2eHudNumber(value, fallback = 0) {
  if (typeof value === "string") {
    const m = value.match(/-?\d+(?:[.,]\d+)?/);
    if (!m) return fallback;
    value = m[0].replace(",", ".");
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function add2eHudClamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function add2eHudNow() { return Date.now(); }
function add2eHudElement() { return document.getElementById(HUD_ID); }
function add2eHudPanel(hud = add2eHudElement()) { return hud?.querySelector?.(".a2e-hud-menu-panel") ?? null; }
function add2eHudIsRetracted(hud = add2eHudElement()) { return Boolean(hud?.classList?.contains("collapsed") || hud?.classList?.contains("a2e-hud-menu-retracted")); }

function add2eHudDefaultState() {
  return { left: 116, top: Math.max(20, window.innerHeight - 360 - 22), width: 560, maxMenuHeight: 320, menuRetracted: false };
}
function add2eHudLoadState() {
  if (add2eHudState) return add2eHudState;
  try {
    const raw = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
      || localStorage.getItem("add2e.actionHud.state.v15")
      || localStorage.getItem("add2e.actionHud.state.v14")
      || localStorage.getItem("add2e.actionHud.state.v13")
      || localStorage.getItem("add2e.actionHud.state.v12")
      || localStorage.getItem("add2e.actionHud.state.v8")
      || "null"
    );
    if (raw && typeof raw === "object") {
      add2eHudState = {
        left: add2eHudClamp(Number(raw.left) || 116, 8, Math.max(8, window.innerWidth - 80)),
        top: add2eHudClamp(Number(raw.top) || 120, 8, Math.max(8, window.innerHeight - 80)),
        width: add2eHudClamp(Number(raw.width) || 560, 360, Math.max(380, window.innerWidth - 16)),
        maxMenuHeight: add2eHudClamp(Number(raw.maxMenuHeight) || 320, 110, Math.max(140, window.innerHeight - 130)),
        menuRetracted: raw.menuRetracted === true || raw.hudCollapsed === true
      };
      return add2eHudState;
    }
  } catch (_e) {}
  add2eHudState = add2eHudDefaultState();
  return add2eHudState;
}
function add2eHudSaveState(partial = {}) {
  const s = add2eHudLoadState();
  Object.assign(s, partial);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_e) {}
}

function add2eHudCanUseActor(actor) {
  if (!actor) return false;
  if (game.user?.isGM) return true;
  return actor.isOwner || actor.testUserPermission?.(game.user, "OWNER");
}
function add2eHudIsMonster(actor) { return String(actor?.type ?? "").toLowerCase() === "monster"; }
function add2eHudIsCharacter(actor) { return String(actor?.type ?? "").toLowerCase() === "personnage"; }
function add2eHudIsRelevant(actor) {
  if (!actor) return false;
  if (add2eHudIsCharacter(actor)) return add2eHudCanUseActor(actor);
  if (add2eHudIsMonster(actor)) return game.user?.isGM === true;
  return false;
}
function add2eHudSelectedActorAndToken() {
  const token = canvas?.tokens?.controlled?.[0] ?? null;
  return { actor: token?.actor ?? game.user?.character ?? null, token };
}
function add2eHudTokenForActor(actor) {
  if (!actor) return null;
  const selected = canvas?.tokens?.controlled?.find?.(t => t?.actor?.id === actor.id) ?? null;
  if (selected) return selected;
  const combatant = game.combat?.combatants?.find?.(c => c?.actor?.id === actor.id) ?? game.combat?.turns?.find?.(c => c?.actor?.id === actor.id) ?? null;
  const combatToken = add2eHudTokenFromCombatant(combatant);
  if (combatToken) return combatToken;
  return actor.getActiveTokens?.()[0] ?? null;
}
function add2eHudRerenderActor(actor, reason) {
  if (!actor || actor.id !== add2eHudActorId) return false;
  if (add2eHudDragging || add2eHudResizing) return false;
  return add2eRenderActionHud(actor, add2eHudTokenForActor(actor), { reason });
}

function add2eHudFindItem(actor, itemId) { return actor?.items?.get?.(itemId) ?? actor?.items?.find?.(i => String(i.id ?? i._id) === String(itemId)) ?? null; }
function add2eHudIsEquipped(item) {
  const s = item?.system ?? {};
  return s.equipee === true || s.equipped === true || s.portee === true || s.worn === true || s.estEquipee === true;
}
function add2eHudPreparedCount(sort) {
  try {
    const n = Number(globalThis.add2eGetTotalMemorizedCount?.(sort));
    if (Number.isFinite(n)) return n;
  } catch (_e) {}
  const f = sort?.flags?.add2e ?? {}, s = sort?.system ?? {};
  for (const v of [sort?.getFlag?.("add2e", "memorizedCount"), f.memorizedCount, f.preparedCount, s.memorizedCount, s.preparedCount, s.prepared, s.memorise, s.memorized, s.prepared?.value, s.memorisation?.value, s.memorisation, s.slots?.prepared, s.slots?.value]) {
    const n = add2eHudNumber(v, NaN);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}
function add2eHudIsObjectPowerSpell(sort) {
  const s = sort?.system ?? {};
  if (s.isPower === true || s.isObjectPower === true || s.sourceWeaponId || s.sourceItemId || s.powerIndex !== undefined) return true;
  try { return globalThis.add2eIsObjectMagicSpellForPreparation?.(sort) === true; } catch (_e) { return false; }
}
function add2eHudWeapons(actor) { return actor?.items?.filter?.(i => String(i.type ?? "").toLowerCase() === "arme" && add2eHudIsEquipped(i)) ?? []; }
function add2eHudSpells(actor) { return actor?.items?.filter?.(i => String(i.type ?? "").toLowerCase() === "sort" && !add2eHudIsObjectPowerSpell(i) && add2eHudPreparedCount(i) > 0) ?? []; }
function add2eHudFeatureHasScript(f) { return Boolean(f?.activable === true || f?.usable === true || f?.onUse || f?.onuse || f?.on_use || f?.script || f?.macro || f?.action); }
function add2eHudClassFeatures(actor) {
  const level = Math.max(1, add2eHudNumber(actor?.system?.niveau, 1));
  const d = actor?.system?.details_classe ?? {};
  const raw = d.classFeatures ?? d.capacitesClasse ?? actor?.system?.classFeatures ?? actor?.system?.capacites ?? actor?.system?.capacitesSpeciales ?? [];
  const fromClass = actor?.items?.filter?.(i => String(i.type ?? "").toLowerCase() === "classe")?.flatMap(i => add2eHudArray(i.system?.classFeatures ?? i.system?.capacitesClasse)) ?? [];
  const seen = new Set();
  return [...add2eHudArray(raw), ...fromClass]
    .filter(f => f && typeof f === "object" && add2eHudFeatureHasScript(f))
    .map((f, index) => ({ ...f, __index: f.__index ?? index }))
    .filter(f => add2eHudIsMonster(actor) || (level >= add2eHudNumber(f.minLevel ?? f.minimumLevel ?? f.niveauMin ?? f.level ?? f.niveau ?? 1, 1) && level <= add2eHudNumber(f.maxLevel ?? f.maximumLevel ?? f.niveauMax ?? f.max ?? 999, 999)))
    .filter(f => { const key = String(f.id ?? f.slug ?? f.name ?? f.label ?? f.nom ?? f.__index); if (seen.has(key)) return false; seen.add(key); return true; });
}
function add2eHudNormalize(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9:_-]+/g, "_");
}
function add2eHudEffectTags(effect) {
  const flags = effect?.flags?.add2e ?? {};
  const raw = [effect?.name, flags.type, flags.category, flags.source, flags.sourceType, flags.sourceItemType, flags.sourceItemId, ...(add2eHudArray(flags.tags)), ...(add2eHudArray(flags.effectTags)), ...(add2eHudArray(effect?.statuses))];
  return raw.map(add2eHudNormalize).filter(Boolean);
}
function add2eHudEffectOriginItem(actor, effect) {
  const flags = effect?.flags?.add2e ?? {};
  const directId = flags.sourceItemId ?? flags.itemId ?? flags.originItemId ?? null;
  if (directId && actor?.items?.get?.(directId)) return actor.items.get(directId);
  const origin = String(effect?.origin ?? "");
  const itemId = origin.match(/\.Item\.([A-Za-z0-9]{16})/)?.[1] ?? origin.match(/Item\.([A-Za-z0-9]{16})/)?.[1] ?? null;
  if (itemId && actor?.items?.get?.(itemId)) return actor.items.get(itemId);
  return null;
}
function add2eHudIsRaceOrClassEffect(actor, effect) {
  const tags = new Set(add2eHudEffectTags(effect));
  const joined = [...tags].join(" ");
  if (tags.has("race") || tags.has("racial") || tags.has("raciaux") || tags.has("raciale") || tags.has("classe") || tags.has("class") || tags.has("class_feature")) return true;
  if (joined.includes("race:") || joined.includes("source:race") || joined.includes("type:race") || joined.includes("classe:") || joined.includes("source:classe") || joined.includes("type:classe")) return true;
  const item = add2eHudEffectOriginItem(actor, effect);
  const itemType = String(item?.type ?? "").toLowerCase();
  if (["race", "classe", "class"].includes(itemType)) return true;
  const origin = add2eHudNormalize(effect?.origin ?? "");
  if (origin.includes("race") || origin.includes("classe") || origin.includes("class")) return true;
  return false;
}
function add2eHudEffectHasDuration(effect) {
  const d = effect?.duration ?? {};
  const values = [d.rounds, d.turns, d.seconds, d.startRound, d.startTurn, d.startTime, d.combat, d.endTime];
  return values.some(v => v !== undefined && v !== null && v !== "" && !(Number(v) === 0 && [d.rounds, d.turns, d.seconds].includes(v)));
}
function add2eHudIsPermanentEffect(effect, actor = null) {
  const tags = add2eHudEffectTags(effect).join(" ");
  if (actor && add2eHudIsRaceOrClassEffect(actor, effect)) return true;
  if (effect?.transfer === true) return true;
  if (tags.includes("permanent") || tags.includes("passif") || tags.includes("passive") || tags.includes("racial") || tags.includes("raciale") || tags.includes("raciaux") || tags.includes("classe") || tags.includes("class_feature")) return true;
  if (!add2eHudEffectHasDuration(effect) && !add2eHudArray(effect?.statuses).length) return true;
  return false;
}
function add2eHudTemporaryEffects(actor) {
  return [...(actor?.effects ?? [])]
    .filter(e => e && e.disabled !== true)
    .filter(e => !add2eHudIsPermanentEffect(e, actor));
}
function add2eHudAbilityValue(actor, key) {
  const direct = Number(actor?.system?.[key]);
  if (Number.isFinite(direct)) return direct;
  return add2eHudNumber(actor?.system?.[`${key}_base`], 10)
    + add2eHudNumber(actor?.system?.bonus_caracteristiques?.[key] ?? actor?.system?.[`${key}_race`], 0)
    + add2eHudNumber(actor?.system?.bonus_divers_caracteristiques?.[key] ?? actor?.system?.[`${key}_bonus`], 0);
}
function add2eHudSavingThrows(actor) {
  const level = Math.max(1, add2eHudNumber(actor?.system?.niveau, 1));
  const row = actor?.system?.details_classe?.progression?.[level - 1];
  const arr = add2eHudArray(row?.savingThrows || actor?.system?.sauvegardes || actor?.system?.savingThrows || []).map(v => add2eHudNumber(v, 0));
  return arr.length >= 5 ? arr.slice(0, 5) : [0, 0, 0, 0, 0];
}
function add2eHudHp(actor) { return add2eHudNumber(actor?.system?.pdv ?? actor?.system?.pv?.value ?? actor?.system?.hp?.value ?? actor?.system?.hp, 0); }
function add2eHudHpMax(actor) { return add2eHudNumber(actor?.system?.points_de_coup ?? actor?.system?.pv?.max ?? actor?.system?.hp?.max ?? actor?.system?.hpMax, add2eHudHp(actor)); }
function add2eHudThaco(actor) {
  const direct = actor?.system?.thac0 ?? actor?.system?.thaco ?? actor?.system?.combat?.thac0;
  if (direct !== undefined && direct !== null && direct !== "") return direct;
  const level = Math.max(1, add2eHudNumber(actor?.system?.niveau, 1));
  const row = actor?.system?.details_classe?.progression?.[level - 1];
  return row?.thac0 ?? row?.thaco ?? 20;
}
function add2eHudArmorClass(actor) { return actor?.system?.ca_total ?? actor?.system?.ca ?? actor?.system?.armorClass ?? actor?.system?.ac ?? "—"; }
function add2eHudDamageText(item) { const s = item?.system ?? item ?? {}; return s?.dégâts?.contre_moyen ?? s?.degats?.contre_moyen ?? s?.degats_moyen ?? s?.damage ?? s?.degats ?? s?.dmg ?? "—"; }
function add2eHudRangeText(item) {
  const s = item?.system ?? item ?? {};
  const parts = [s.portee_courte ?? s.portee_short, s.portee_moyenne ?? s.portee_medium, s.portee_longue ?? s.portee_long].filter(v => v !== undefined && v !== null && String(v) !== "");
  return parts.length ? parts.join(" / ") : "Contact";
}
function add2eHudEffectDurationText(effect) {
  const d = effect?.duration ?? {};
  if (Number(d.rounds) > 0) return `${d.rounds} round${Number(d.rounds) > 1 ? "s" : ""}`;
  if (Number(d.turns) > 0) return `${d.turns} tour${Number(d.turns) > 1 ? "s" : ""}`;
  if (Number(d.seconds) > 0) return `${d.seconds} sec.`;
  if (d.combat) return "Combat";
  if (d.endTime) return "Temporaire";
  if (add2eHudArray(effect?.statuses).length) return "État";
  return "Temporaire";
}

function add2eHudInjectStyle() {
  document.getElementById("add2e-action-hud-style")?.remove();
  const style = document.createElement("style");
  style.id = "add2e-action-hud-style";
  style.textContent = `
    #${HUD_ID}{position:fixed;z-index:100;color:#f6e8bd;font-family:var(--font-primary,Signika,sans-serif);pointer-events:auto;min-width:360px;resize:none;right:auto!important;bottom:auto!important;touch-action:none;user-select:none;}
    #${HUD_ID}.collapsed .a2e-hud-menu-panel,#${HUD_ID}.a2e-hud-menu-retracted .a2e-hud-menu-panel{display:none!important;}
    #${HUD_ID}.collapsed .a2e-hud-icon-btn i,#${HUD_ID}.a2e-hud-menu-retracted .a2e-hud-icon-btn i{transform:rotate(180deg);}
    #${HUD_ID} .a2e-hud-shell{display:flex;flex-direction:column;justify-content:flex-end;border:1px solid #8a611d;border-radius:14px;overflow:hidden;background:radial-gradient(circle at 15% 0%,rgba(213,147,45,.28),transparent 36%),linear-gradient(145deg,rgba(32,25,16,.97),rgba(18,14,10,.96));box-shadow:0 8px 26px rgba(0,0,0,.48),inset 0 0 0 1px rgba(255,230,160,.12);}
    #${HUD_ID} .a2e-hud-menu-panel{flex:0 1 auto!important;min-height:0!important;max-height:var(--a2e-hud-menu-max,320px)!important;padding:9px!important;overflow-y:auto!important;border-bottom:1px solid rgba(184,137,36,.45);background:rgba(0,0,0,.12);display:block!important;}
    #${HUD_ID} .a2e-hud-section{display:none!important;} #${HUD_ID} .a2e-hud-section.active{display:grid!important;gap:7px!important;align-content:start!important;margin-top:0!important;}
    #${HUD_ID} .a2e-hud-tabs{flex:0 0 auto;display:grid;grid-template-columns:repeat(6,1fr);border-bottom:1px solid rgba(184,137,36,.45);background:rgba(0,0,0,.18);} #${HUD_ID} .a2e-hud-tab{min-height:34px;border:0;border-right:1px solid rgba(184,137,36,.32);background:transparent;color:#d8bd78;font-size:.74em;font-weight:900;cursor:pointer;} #${HUD_ID} .a2e-hud-tab.active{color:#211307;background:linear-gradient(180deg,#f0c66d,#c78d2e);}
    #${HUD_ID} .a2e-hud-header{flex:0 0 auto;display:grid;grid-template-columns:74px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:9px 10px;background:linear-gradient(180deg,rgba(78,48,18,.78),rgba(36,26,14,.62));cursor:move;user-select:none;}
    #${HUD_ID} .a2e-hud-header *{pointer-events:auto;} #${HUD_ID} .a2e-hud-header[data-drag-handle="1"]{touch-action:none;}
    #${HUD_ID} .a2e-hud-portrait{width:64px;height:64px;border-radius:12px;object-fit:cover;border:2px solid #c4973f;background:#111;} #${HUD_ID} .a2e-hud-name{color:#fff4cf;font-size:1.12em;font-weight:900;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;} #${HUD_ID} .a2e-hud-subtitle{color:#d8bd78;font-size:.82em;font-weight:700;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    #${HUD_ID} .a2e-hud-metrics{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;} #${HUD_ID} .a2e-hud-pill{display:inline-flex;align-items:center;justify-content:center;min-height:22px;padding:2px 7px;border:1px solid rgba(214,176,90,.75);border-radius:999px;background:rgba(255,244,201,.12);color:#fff0bd;font-size:.78em;font-weight:850;white-space:nowrap;}
    #${HUD_ID} .a2e-hud-icon-btn,#${HUD_ID} .a2e-hud-resize{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:1px solid rgba(214,176,90,.75);border-radius:9px;background:rgba(255,244,201,.12);color:#ffe4a1;cursor:pointer;} #${HUD_ID} .a2e-hud-resize{cursor:nwse-resize!important;}
    #${HUD_ID} .a2e-hud-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:48px;padding:6px;border:1px solid rgba(214,176,90,.38);border-radius:10px;background:rgba(255,250,235,.07);} #${HUD_ID} .a2e-hud-row.compact{grid-template-columns:minmax(0,1fr) auto;min-height:38px;} #${HUD_ID} .a2e-hud-row img{width:34px;height:34px;border-radius:7px;object-fit:cover;border:1px solid rgba(214,176,90,.65);background:rgba(0,0,0,.25);}
    #${HUD_ID} .a2e-hud-row-title{color:#fff4cf;font-weight:900;line-height:1.08;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;} #${HUD_ID} .a2e-hud-row-meta{display:flex;flex-wrap:wrap;gap:4px 8px;color:#c8ad6e;font-size:.76em;font-weight:750;margin-top:2px;} #${HUD_ID} .a2e-hud-action{min-width:78px;min-height:30px;padding:4px 9px;border:1px solid #d6b05a;border-radius:9px;background:linear-gradient(180deg,#fff0bd,#d6a345);color:#211307;font-size:.8em;font-weight:950;cursor:pointer;white-space:nowrap;} #${HUD_ID} .a2e-hud-action:disabled{opacity:.45;cursor:not-allowed;}
    #${HUD_ID} .a2e-hud-empty{padding:12px;border:1px dashed rgba(214,176,90,.45);border-radius:10px;color:#c8ad6e;font-style:italic;text-align:center;}
    #${HUD_ID} .a2e-hud-ability-grid,#${HUD_ID} .a2e-hud-save-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;}
    #${HUD_ID} .a2e-hud-ability,#${HUD_ID} .a2e-hud-save-cell{display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center;padding:7px;border:1px solid rgba(214,176,90,.38);border-radius:10px;background:rgba(255,250,235,.07);min-height:50px;}
    #${HUD_ID} .a2e-hud-ability b,#${HUD_ID} .a2e-hud-save-cell b{color:#fff4cf;font-size:1.15em;} #${HUD_ID} .a2e-hud-ability span,#${HUD_ID} .a2e-hud-save-cell span{display:block;color:#c8ad6e;font-size:.76em;font-weight:800;} #${HUD_ID} .a2e-hud-save-cell b{font-size:1.02em;}
    #${HUD_ID} button,#${HUD_ID} [data-hud-tab],#${HUD_ID} [data-action]{user-select:auto;touch-action:auto;} @media(max-width:760px){#${HUD_ID}{left:8px!important;right:8px;width:auto!important;min-width:0;max-width:calc(100vw - 16px)!important;}#${HUD_ID} .a2e-hud-ability-grid,#${HUD_ID} .a2e-hud-save-grid{grid-template-columns:repeat(2,1fr);}}
  `;
  document.head.appendChild(style);
}

function add2eHudWeaponRows(actor) {
  const rows = add2eHudWeapons(actor);
  if (!rows.length) return `<div class="a2e-hud-empty">Aucune arme équipée.</div>`;
  return rows.map(i => `<div class="a2e-hud-row" data-item-id="${add2eHudEscape(i.id)}"><img src="${add2eHudEscape(i.img || "icons/svg/sword.svg")}" alt=""><div><div class="a2e-hud-row-title">${add2eHudEscape(i.name)}</div><div class="a2e-hud-row-meta"><span>Équipée</span><span>Dégâts ${add2eHudEscape(add2eHudDamageText(i))}</span><span>Portée ${add2eHudEscape(add2eHudRangeText(i))}</span></div></div><button type="button" class="a2e-hud-action" data-action="attack" data-item-id="${add2eHudEscape(i.id)}">Attaquer</button></div>`).join("");
}
function add2eHudSpellRows(actor) {
  const rows = add2eHudSpells(actor);
  if (!rows.length) return `<div class="a2e-hud-empty">Aucun sort préparé.</div>`;
  return rows.map(i => `<div class="a2e-hud-row" data-item-id="${add2eHudEscape(i.id)}"><img src="${add2eHudEscape(i.img || "icons/svg/book.svg")}" alt=""><div><div class="a2e-hud-row-title">${add2eHudEscape(i.name)}</div><div class="a2e-hud-row-meta"><span>Niv. ${add2eHudEscape(i.system?.niveau ?? i.system?.level ?? "—")}</span><span>Préparé ${add2eHudPreparedCount(i)}</span></div></div><button type="button" class="a2e-hud-action" data-action="cast-spell" data-item-id="${add2eHudEscape(i.id)}">Lancer</button></div>`).join("");
}
function add2eHudFeatureRows(actor) {
  const rows = add2eHudClassFeatures(actor);
  if (!rows.length) return `<div class="a2e-hud-empty">Aucune capacité utilisable.</div>`;
  return rows.map(f => `<div class="a2e-hud-row compact" data-feature-index="${add2eHudEscape(f.__index)}"><div><div class="a2e-hud-row-title">${add2eHudEscape(f.name ?? f.label ?? f.nom ?? `Capacité ${Number(f.__index) + 1}`)}</div><div class="a2e-hud-row-meta"><span>Utilisable</span></div></div><button type="button" class="a2e-hud-action" data-action="use-feature" data-feature-index="${add2eHudEscape(f.__index)}">Utiliser</button></div>`).join("");
}
function add2eHudEffectRows(actor) {
  const rows = add2eHudTemporaryEffects(actor);
  if (!rows.length) return `<div class="a2e-hud-empty">Aucun effet temporaire actif.</div>`;
  return rows.map(e => `<div class="a2e-hud-row compact" data-effect-id="${add2eHudEscape(e.id)}"><div><div class="a2e-hud-row-title">${add2eHudEscape(e.name ?? "Effet")}</div><div class="a2e-hud-row-meta"><span>${add2eHudEscape(add2eHudEffectDurationText(e))}</span>${add2eHudArray(e.statuses).length ? `<span>${add2eHudEscape(add2eHudArray(e.statuses).join(", "))}</span>` : ""}</div></div><button type="button" class="a2e-hud-action" data-action="open-effect" data-effect-id="${add2eHudEscape(e.id)}">Voir</button></div>`).join("");
}
function add2eHudSaveRows(actor) {
  const saves = add2eHudSavingThrows(actor);
  return `<div class="a2e-hud-save-grid">${ADD2E_HUD_SAVE_FULL_NAMES.map((label, idx) => `<div class="a2e-hud-save-cell"><div><b>${add2eHudEscape(saves[idx] || "—")}</b><span>${add2eHudEscape(label)}</span></div><button type="button" class="a2e-hud-action" data-action="roll-save" data-save-index="${idx}">Jet</button></div>`).join("")}</div>`;
}
function add2eHudAbilityRows(actor) {
  return `<div class="a2e-hud-ability-grid">${ADD2E_HUD_CARACS.map(c => `<div class="a2e-hud-ability"><div><b>${c.label} ${add2eHudAbilityValue(actor, c.key)}</b><span>${add2eHudEscape(c.title)}</span></div><button type="button" class="a2e-hud-action" data-action="roll-ability" data-ability="${c.key}">Jet</button></div>`).join("")}</div>`;
}
function add2eHudHtml(actor, token = null) {
  const img = token?.document?.texture?.src || actor.img || "icons/svg/mystery-man.svg";
  const isMonster = add2eHudIsMonster(actor);
  const race = isMonster ? (actor.system?.type ?? actor.system?.race ?? "Monstre") : (actor.system?.race || actor.system?.details_race?.label || actor.items?.find?.(i => i.type === "race")?.name || "Race");
  const classe = isMonster ? (actor.system?.taille ?? actor.system?.size ?? actor.system?.alignment ?? "MJ") : (actor.system?.classe || actor.system?.details_classe?.label || actor.items?.find?.(i => i.type === "classe")?.name || "Classe");
  const niveau = isMonster ? (actor.system?.dv ?? actor.system?.hitDice ?? actor.system?.niveau ?? "—") : (actor.system?.niveau ?? "—");
  const tab = (key, icon, label) => `<button type="button" class="a2e-hud-tab ${add2eHudActiveTab === key ? "active" : ""}" data-hud-tab="${key}"><i class="${icon}"></i> ${label}</button>`;
  const section = (key, html) => `<section class="a2e-hud-section ${add2eHudActiveTab === key ? "active" : ""}" data-hud-section="${key}">${html}</section>`;
  return `<div class="a2e-hud-shell"><div class="a2e-hud-menu-panel">${section("attaques", add2eHudWeaponRows(actor))}${section("sorts", add2eHudSpellRows(actor))}${section("capacites", add2eHudFeatureRows(actor))}${section("effets", add2eHudEffectRows(actor))}${section("sauvegardes", add2eHudSaveRows(actor))}${section("caracs", add2eHudAbilityRows(actor))}</div><nav class="a2e-hud-tabs">${tab("attaques", "fas fa-swords", "Armes")}${tab("sorts", "fas fa-book", "Sorts")}${tab("capacites", "fas fa-bolt", "Capacités")}${tab("effets", "fas fa-hourglass-half", "Effets")}${tab("sauvegardes", "fas fa-shield-alt", "Sauv.")}${tab("caracs", "fas fa-dice-d20", "Carac.")}</nav><div class="a2e-hud-header" data-drag-handle="1"><img class="a2e-hud-portrait" src="${add2eHudEscape(img)}" alt="${add2eHudEscape(actor.name)}"><div><div class="a2e-hud-name">${add2eHudEscape(actor.name)}</div><div class="a2e-hud-subtitle">${add2eHudEscape(race)} — ${add2eHudEscape(classe)} ${isMonster ? "DV" : "niv."} ${add2eHudEscape(niveau)}</div><div class="a2e-hud-metrics"><span class="a2e-hud-pill">PV ${add2eHudHp(actor)} / ${add2eHudHpMax(actor)}</span><span class="a2e-hud-pill">CA ${add2eHudEscape(add2eHudArmorClass(actor))}</span><span class="a2e-hud-pill">THAC0 ${add2eHudEscape(add2eHudThaco(actor))}</span></div></div><button type="button" class="a2e-hud-icon-btn" data-action="toggle-collapse" title="Réduire / agrandir"><i class="fas fa-chevron-down"></i></button><button type="button" class="a2e-hud-resize" data-resize-handle="1" title="Redimensionner"><i class="fas fa-up-right-and-down-left-from-center"></i></button></div></div>`;
}

function add2eHudInsidePosition(hud, left, top) {
  const margin = 8, rect = hud.getBoundingClientRect();
  return { left: add2eHudClamp(left, margin, Math.max(margin, window.innerWidth - rect.width - margin)), top: add2eHudClamp(top, margin, Math.max(margin, window.innerHeight - rect.height - margin)) };
}
function add2eHudApplyPosition(hud, left, top) { hud.style.setProperty("left", `${Math.round(left)}px`, "important"); hud.style.setProperty("top", `${Math.round(top)}px`, "important"); hud.style.setProperty("right", "auto", "important"); hud.style.setProperty("bottom", "auto", "important"); }
function add2eHudApplyGeometry(hud, { constrain = true } = {}) {
  if (!hud || add2eHudDragging || add2eHudResizing) return;
  const s = add2eHudLoadState();
  hud.style.setProperty("width", `${Math.round(s.width)}px`, "important");
  hud.style.setProperty("--a2e-hud-menu-max", `${Math.round(s.maxMenuHeight)}px`);
  const pos = constrain ? add2eHudInsidePosition(hud, s.left, s.top) : { left: s.left, top: s.top };
  add2eHudApplyPosition(hud, pos.left, pos.top);
}
function add2eHudKeepInside(hud, { save = true } = {}) {
  if (!hud || add2eHudDragging || add2eHudResizing) return;
  const r = hud.getBoundingClientRect();
  const pos = add2eHudInsidePosition(hud, r.left, r.top);
  add2eHudApplyPosition(hud, pos.left, pos.top);
  if (save) add2eHudSaveState({ left: Math.round(pos.left), top: Math.round(pos.top), width: Math.round(hud.offsetWidth || r.width || 560) });
}
function add2eHudPreserveBottom(hud, bottom, { save = true } = {}) {
  if (!hud || add2eHudDragging || add2eHudResizing) return;
  const r = hud.getBoundingClientRect();
  const desiredTop = add2eHudClamp(Number(bottom), 8 + r.height, window.innerHeight - 8) - r.height;
  const pos = add2eHudInsidePosition(hud, r.left, desiredTop);
  add2eHudApplyPosition(hud, pos.left, pos.top);
  if (save) add2eHudSaveState({ left: Math.round(pos.left), top: Math.round(pos.top), width: Math.round(hud.offsetWidth || r.width || 560) });
}
function add2eHudSetRetracted(hud, retracted, { save = true } = {}) {
  if (!hud) return;
  const bottom = hud.getBoundingClientRect().bottom;
  const panel = add2eHudPanel(hud);
  hud.classList.toggle("collapsed", retracted);
  hud.classList.toggle("a2e-hud-menu-retracted", retracted);
  if (panel) { if (retracted) panel.style.setProperty("display", "none", "important"); else panel.style.removeProperty("display"); }
  requestAnimationFrame(() => add2eHudPreserveBottom(hud, bottom, { save }));
  if (save) add2eHudSaveState({ menuRetracted: retracted });
}
function add2eHudApplyState(hud) { add2eHudApplyGeometry(hud); add2eHudSetRetracted(hud, add2eHudLoadState().menuRetracted === true, { save: false }); }

function add2eRenderActionHud(actor = null, token = null, { reason = "render", preserveBottom = null } = {}) {
  if (add2eHudDragging || add2eHudResizing) return false;
  add2eHudInjectStyle();
  const existing = add2eHudElement();
  const bottomAnchor = Number.isFinite(Number(preserveBottom)) ? Number(preserveBottom) : existing?.getBoundingClientRect?.().bottom;
  if (!add2eHudIsRelevant(actor)) { existing?.remove(); add2eHudActorId = null; return false; }
  add2eHudActorId = actor.id;
  if (!ADD2E_HUD_TABS.includes(add2eHudActiveTab)) add2eHudActiveTab = "attaques";
  const hud = existing ?? document.createElement("div");
  hud.id = HUD_ID;
  hud.innerHTML = add2eHudHtml(actor, token);
  if (!existing) document.body.appendChild(hud);
  add2eHudApplyState(hud);
  add2eBindHudEvents(hud, actor);
  if (Number.isFinite(Number(bottomAnchor))) requestAnimationFrame(() => add2eHudPreserveBottom(hud, Number(bottomAnchor), { save: true }));
  console.log(`${TAG}[RENDER]`, { reason, actor: actor.name, token: token?.name ?? null });
  return true;
}
function add2eRefreshActionHud(reason = "refresh") {
  const { actor, token } = add2eHudSelectedActorAndToken();
  return add2eRenderActionHud(actor, token, { reason });
}
function add2eCloseActionHud() { add2eHudElement()?.remove(); add2eHudActorId = null; }

function add2eHudCurrentCombatant(combat = game.combat) {
  if (!combat) return null;
  const id = combat.current?.combatantId ?? combat.combatantId ?? null;
  return (id ? combat.combatants?.get?.(id) : null) ?? combat.combatant ?? combat.turns?.[Number(combat.current?.turn ?? combat.turn)] ?? null;
}
function add2eHudTokenFromCombatant(combatant) {
  if (!combatant) return null;
  return combatant.token?.object ?? (combatant.tokenId ? canvas?.tokens?.get?.(combatant.tokenId) : null) ?? (combatant.token?.id ? canvas?.tokens?.get?.(combatant.token.id) : null) ?? null;
}
function add2eHudRenderCombatant(combatant, { forceOpen = false, reason = "combatant" } = {}) {
  if (!combatant?.actor) return false;
  if (!forceOpen && !add2eHudElement()) return false;
  return add2eRenderActionHud(combatant.actor, add2eHudTokenFromCombatant(combatant), { reason });
}
function add2eHudFollowCurrentCombatant(combat = game.combat, { forceOpen = false, reason = "combat-follow" } = {}) {
  if (add2eHudNow() < add2eHudManualIntentUntil && !reason.includes("force")) return false;
  return add2eHudRenderCombatant(add2eHudCurrentCombatant(combat), { forceOpen, reason });
}
function add2eHudScheduleCombatFollow(combat = game.combat, options = {}) { for (const delay of [60, 160, 320]) window.setTimeout(() => add2eHudFollowCurrentCombatant(combat, options), delay); }
function add2eHudIsCombatTurnChange(changes = {}) {
  return foundry.utils.hasProperty(changes, "turn") || foundry.utils.hasProperty(changes, "round") || foundry.utils.hasProperty(changes, "current") || foundry.utils.hasProperty(changes, "current.turn") || foundry.utils.hasProperty(changes, "current.round") || foundry.utils.hasProperty(changes, "current.combatantId") || foundry.utils.hasProperty(changes, "combatantId");
}
function add2eHudCombatantFromTrackerElement(el, combat = game.combat) {
  const row = el?.closest?.("[data-combatant-id], [data-combatant], .combatant, li");
  if (!row || !combat) return null;
  const id = row.dataset?.combatantId ?? row.dataset?.combatant ?? row.dataset?.documentId ?? row.dataset?.id ?? row.getAttribute?.("data-combatant-id") ?? row.id?.replace(/^combatant-/, "");
  return (id ? combat.combatants?.get?.(id) : null) ?? (id ? combat.turns?.find?.(c => c.id === id) : null) ?? null;
}
function add2eHudBindCombatTracker(app, html) {
  const root = html?.jquery ? html[0] : html;
  if (!root?.addEventListener || root.dataset?.add2eHudTrackerBound === "1") return;
  root.dataset.add2eHudTrackerBound = "1";
  root.addEventListener("click", ev => {
    const combatant = add2eHudCombatantFromTrackerElement(ev.target, app?.viewed ?? app?.combat ?? game.combat);
    if (!combatant) return;
    add2eHudManualIntentUntil = add2eHudNow() + 750;
    add2eHudRenderCombatant(combatant, { forceOpen: true, reason: "combat-tracker-click" });
  }, true);
}

function add2eBindHudEvents(hud, actor) {
  hud.querySelectorAll("[data-hud-tab]").forEach(btn => btn.addEventListener("click", ev => {
    ev.preventDefault();
    ev.stopPropagation();
    const clicked = btn.dataset.hudTab || "attaques";
    const currentHud = add2eHudElement() ?? hud;
    const bottom = currentHud?.getBoundingClientRect?.().bottom;
    if (add2eHudActiveTab === clicked && !add2eHudIsRetracted(currentHud)) {
      add2eHudSetRetracted(currentHud, true, { save: true });
      return;
    }
    add2eHudActiveTab = clicked;
    add2eRenderActionHud(actor, add2eHudTokenForActor(actor), { reason: "tab", preserveBottom: bottom });
    window.setTimeout(() => {
      const h = add2eHudElement();
      add2eHudSetRetracted(h, false, { save: true });
      if (Number.isFinite(Number(bottom))) requestAnimationFrame(() => add2eHudPreserveBottom(h, Number(bottom), { save: true }));
    }, 0);
  }));
  hud.querySelectorAll("[data-action]").forEach(btn => btn.addEventListener("click", async ev => {
    if (add2eHudNow() < add2eHudSuppressClickUntil) { ev.preventDefault(); ev.stopPropagation(); return; }
    ev.preventDefault(); ev.stopPropagation();
    const action = btn.dataset.action;
    try {
      if (action === "toggle-collapse") return add2eHudSetRetracted(hud, !add2eHudIsRetracted(hud));
      if (action === "attack") return add2eHudAttack(actor, btn.dataset.itemId);
      if (action === "cast-spell") return add2eHudCastSpell(actor, btn.dataset.itemId);
      if (action === "use-feature") return add2eHudUseFeature(actor, btn.dataset.featureIndex);
      if (action === "open-effect") return add2eHudOpenEffect(actor, btn.dataset.effectId);
      if (action === "roll-save") return add2eHudRollSaveLikeSheet(actor, Number(btn.dataset.saveIndex));
      if (action === "roll-ability") return add2eHudRollAbilityLikeSheet(actor, btn.dataset.ability);
    } catch (err) { console.error(`${TAG}[ACTION_ERROR]`, { action, actor: actor?.name, err }); ui.notifications.error(`ADD2E HUD | Erreur pendant l'action : ${action}`); }
  }));
}
function add2eHudPointerForbidden(target) { return Boolean(target?.closest?.("button,a,input,select,textarea,[data-action],[data-hud-tab],[data-resize-handle]")); }
function add2eHudPreventPointer(ev) { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.(); add2eHudSuppressClickUntil = add2eHudNow() + 450; }
function add2eHudStartResize(ev) {
  const handle = ev.target?.closest?.("[data-resize-handle]"), hud = ev.target?.closest?.(`#${HUD_ID}`);
  if (!handle || !hud || ev.button !== 0) return false;
  add2eHudPreventPointer(ev); add2eHudResizing = true; add2eHudPointerCaptureId = ev.pointerId;
  try { handle.setPointerCapture?.(ev.pointerId); } catch (_e) {}
  const start = { x: ev.clientX, y: ev.clientY, ...add2eHudLoadState(), rect: hud.getBoundingClientRect() };
  const move = e => { const s = add2eHudLoadState(); s.width = add2eHudClamp(start.width + e.clientX - start.x, 360, Math.max(360, window.innerWidth - start.rect.left - 8)); s.maxMenuHeight = add2eHudClamp(start.maxMenuHeight + e.clientY - start.y, 110, Math.max(140, window.innerHeight - start.rect.top - 8)); hud.style.setProperty("width", `${Math.round(s.width)}px`, "important"); hud.style.setProperty("--a2e-hud-menu-max", `${Math.round(s.maxMenuHeight)}px`); add2eHudApplyPosition(hud, start.rect.left, start.rect.top); };
  const up = () => { window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", up, true); window.removeEventListener("pointercancel", up, true); add2eHudResizing = false; add2eHudPointerCaptureId = null; const r = hud.getBoundingClientRect(); add2eHudSaveState({ left: Math.round(r.left), top: Math.round(r.top), width: Math.round(hud.offsetWidth || r.width || 560), maxMenuHeight: Math.round(add2eHudLoadState().maxMenuHeight) }); add2eHudKeepInside(hud); };
  window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", up, true); window.addEventListener("pointercancel", up, true); return true;
}
function add2eHudStartDrag(ev) {
  const hud = ev.target?.closest?.(`#${HUD_ID}`);
  const handle = ev.target?.closest?.("[data-drag-handle]");
  if (!hud || !handle || ev.button !== 0 || add2eHudPointerForbidden(ev.target)) return;
  add2eHudPreventPointer(ev); add2eHudDragging = true; add2eHudPointerCaptureId = ev.pointerId;
  try { handle.setPointerCapture?.(ev.pointerId); } catch (_e) {}
  const r = hud.getBoundingClientRect(); const start = { x: ev.clientX, y: ev.clientY, left: r.left, top: r.top };
  const move = e => { const p = add2eHudInsidePosition(hud, start.left + e.clientX - start.x, start.top + e.clientY - start.y); add2eHudApplyPosition(hud, p.left, p.top); };
  const up = () => { window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", up, true); window.removeEventListener("pointercancel", up, true); add2eHudDragging = false; add2eHudPointerCaptureId = null; const nr = hud.getBoundingClientRect(); add2eHudSaveState({ left: Math.round(nr.left), top: Math.round(nr.top), width: Math.round(hud.offsetWidth || nr.width || 560) }); };
  window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", up, true); window.addEventListener("pointercancel", up, true);
}
function add2eHudPointerDown(ev) { if (add2eHudStartResize(ev)) return; add2eHudStartDrag(ev); }
function add2eHudWindowResize() { const hud = add2eHudElement(); if (hud) add2eHudApplyState(hud); }
function add2eHudScheduleApplyState() {
  if (add2eHudDragging || add2eHudResizing || add2eHudApplyScheduled) return;
  add2eHudApplyScheduled = true;
  requestAnimationFrame(() => { add2eHudApplyScheduled = false; if (add2eHudDragging || add2eHudResizing) return; const hud = add2eHudElement(); if (hud) add2eHudApplyState(hud); });
}

async function add2eHudAttack(actor, itemId) {
  const arme = add2eHudFindItem(actor, itemId);
  if (!arme) return ui.notifications.warn("Arme introuvable.");
  if (!add2eHudIsEquipped(arme)) return ui.notifications.warn("Cette arme n'est pas équipée.");
  if (typeof globalThis.add2eAttackRoll !== "function") return ui.notifications.error("Fonction add2eAttackRoll introuvable.");
  return globalThis.add2eAttackRoll({ actor, arme });
}
async function add2eHudCastSpell(actor, itemId) {
  const sort = add2eHudFindItem(actor, itemId);
  if (!sort) return ui.notifications.warn("Sort introuvable.");
  if (add2eHudPreparedCount(sort) <= 0) return ui.notifications.warn("Ce sort n'est pas préparé.");
  if (typeof globalThis.add2eCastSpell !== "function") return ui.notifications.error("Fonction add2eCastSpell introuvable.");
  return globalThis.add2eCastSpell({ actor, sort });
}
async function add2eHudUseFeature(actor, featureIndex) {
  const feature = add2eHudClassFeatures(actor).find(f => String(f.__index) === String(featureIndex));
  if (!feature) return ui.notifications.warn("Capacité introuvable ou non utilisable.");
  if (typeof globalThis.add2eExecuteClassFeatureOnUse === "function") return globalThis.add2eExecuteClassFeatureOnUse(actor, feature, null);
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<b>${add2eHudEscape(actor.name)}</b> utilise <b>${add2eHudEscape(feature.name ?? feature.label ?? feature.nom ?? "Capacité")}</b>` });
}
async function add2eHudOpenEffect(actor, effectId) {
  const effect = actor?.effects?.get?.(effectId) ?? actor?.effects?.find?.(e => String(e.id) === String(effectId));
  if (!effect) return ui.notifications.warn("Effet introuvable.");
  if (effect.sheet?.render) return effect.sheet.render(true);
  return ui.notifications.warn("La fiche de cet effet ne peut pas être ouverte.");
}
async function add2eHudRollAbilityLikeSheet(actor, carac) {
  const data = ADD2E_HUD_CARACS.find(c => c.key === carac); const val = add2eHudAbilityValue(actor, carac); const roll = await new Roll("1d20").evaluate({ async: true }); if (game.dice3d) await game.dice3d.showForRoll(roll);
  const ok = roll.total <= val; return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="add2e-card-test"><b>${data?.label || carac}</b> seuil ${val} | résultat <b>${roll.total}</b> — <b>${ok ? "Réussite" : "Échec"}</b></div>` });
}
async function add2eHudRollSaveLikeSheet(actor, idx) {
  const saves = add2eHudSavingThrows(actor); const seuil = Number(saves[idx]); if (!seuil) return ui.notifications.warn("Aucune valeur pour ce jet."); const roll = await new Roll("1d20").evaluate({ async: true }); if (game.dice3d) await game.dice3d.showForRoll(roll);
  let bonus = 0; try { bonus = Number(Add2eEffectsEngine?.analyze?.(actor, { type: "save", vsType: ADD2E_HUD_SAVE_NAMES[idx], frontale: true })?.bonus_save || 0); } catch (_e) {}
  const total = Number(roll.total || 0) + bonus; return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="add2e-card-test"><b>${ADD2E_HUD_SAVE_NAMES[idx]}</b> seuil ${seuil} | résultat <b>${roll.total}</b>${bonus ? ` + ${bonus} = <b>${total}</b>` : ""} — <b>${total >= seuil ? "Réussite" : "Échec"}</b></div>` });
}

Hooks.once("init", () => {
  game.add2e = game.add2e ?? {};
  game.add2e.actionHudVersion = ADD2E_ACTION_HUD_VERSION;
  game.add2e.openActionHud = (actor = null) => { const s = add2eHudSelectedActorAndToken(); return add2eRenderActionHud(actor ?? s.actor, actor ? add2eHudTokenForActor(actor) : s.token, { reason: "api-open" }); };
  game.add2e.closeActionHud = add2eCloseActionHud;
  game.add2e.refreshActionHud = () => add2eHudActorId ? add2eHudRerenderActor(game.actors.get(add2eHudActorId), "api-refresh-current") : add2eRefreshActionHud("api-refresh");
  game.add2e.followCurrentCombatantHud = () => add2eHudFollowCurrentCombatant(game.combat, { forceOpen: true, reason: "api-force-combatant" });
  Object.assign(globalThis, {
    add2eRenderActionHud,
    add2eRefreshActionHud,
    add2eCloseActionHud,
    add2eHudFollowCurrentCombatant: game.add2e.followCurrentCombatantHud,
    add2eHudForceOpen: () => add2eHudSetRetracted(add2eHudElement(), false),
    add2eHudForceRetract: () => add2eHudSetRetracted(add2eHudElement(), true),
    add2eHudFixDebug: () => ({ version: ADD2E_ACTION_HUD_VERSION, hud: !!add2eHudElement(), actorId: add2eHudActorId, actor: game.actors.get(add2eHudActorId)?.name ?? null, activeTab: add2eHudActiveTab, state: add2eHudLoadState(), combatant: add2eHudCurrentCombatant(game.combat)?.name ?? null, selected: canvas?.tokens?.controlled?.map?.(t => t.name) ?? [], dragging: add2eHudDragging, resizing: add2eHudResizing }),
    add2eHudCheck: () => ({ version: ADD2E_ACTION_HUD_VERSION, actorId: add2eHudActorId, actor: game.actors.get(add2eHudActorId)?.name ?? null, activeTab: add2eHudActiveTab, retracted: add2eHudLoadState().menuRetracted, attackRoll: typeof globalThis.add2eAttackRoll, castSpell: typeof globalThis.add2eCastSpell, featureOnUse: typeof globalThis.add2eExecuteClassFeatureOnUse, hud: !!add2eHudElement() })
  });
  console.log(`${TAG}[INIT]`, ADD2E_ACTION_HUD_VERSION);
});

Hooks.on("controlToken", () => { add2eHudManualIntentUntil = add2eHudNow() + 500; window.setTimeout(() => add2eRefreshActionHud("controlToken"), 60); });
Hooks.on("canvasReady", () => window.setTimeout(() => add2eRefreshActionHud("canvasReady"), 150));
Hooks.once("ready", () => {
  document.addEventListener("pointerdown", add2eHudPointerDown, true);
  window.addEventListener("resize", add2eHudWindowResize);
  const observer = new MutationObserver(add2eHudScheduleApplyState); observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => add2eRefreshActionHud("ready"), 300);
});
Hooks.on("renderCombatTracker", add2eHudBindCombatTracker);
Hooks.on("updateCombat", (combat, changes) => { if (add2eHudIsCombatTurnChange(changes ?? {})) add2eHudScheduleCombatFollow(combat, { forceOpen: false, reason: "updateCombat" }); });
Hooks.on("combatTurn", combat => add2eHudScheduleCombatFollow(combat, { forceOpen: false, reason: "combatTurn" }));
Hooks.on("combatRound", combat => add2eHudScheduleCombatFollow(combat, { forceOpen: false, reason: "combatRound" }));
Hooks.on("combatStart", combat => add2eHudScheduleCombatFollow(combat, { forceOpen: false, reason: "combatStart" }));
Hooks.on("updateActor", actor => { if (actor?.id === add2eHudActorId && !add2eHudDragging && !add2eHudResizing) window.setTimeout(() => add2eHudRerenderActor(actor, "updateActor-current"), 60); });
for (const hookName of ["createItem", "updateItem", "deleteItem", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
  Hooks.on(hookName, doc => {
    const actor = doc?.parent;
    if (actor?.id === add2eHudActorId && !add2eHudDragging && !add2eHudResizing) window.setTimeout(() => add2eHudRerenderActor(actor, `${hookName}-current`), 60);
  });
}

export { add2eRenderActionHud, add2eRefreshActionHud, add2eCloseActionHud };