// scripts/add2e-action-hud.mjs
<<<<<<< HEAD
// ADD2E — HUD d'action rapide sans ouvrir la fiche personnage
// Version : 2026-05-16-v9-capture-spell-click
//
// Principe :
// - le HUD affiche uniquement les armes équipées et les sorts réellement mémorisés ;
// - les attaques/sorts/capacités appellent les mécaniques existantes du système ;
// - le clic de lancement de sort est intercepté en phase capture, comme le patch console validé,
//   pour empêcher toute ouverture parasite de la fiche acteur fermée.

const ADD2E_ACTION_HUD_VERSION = "2026-05-16-v9-capture-spell-click";
const TAG = "[ADD2E][ACTION_HUD]";
const HUD_ID = "add2e-action-hud";
const STYLE_ID = "add2e-action-hud-style";
const STORAGE_KEY = "add2e.actionHud.layout.v1";

let add2eHudActorId = null;
let add2eHudActiveTab = null;
let add2eHudCollapsed = false;
let add2eHudLayout = null;
let add2eHudCaptureInstalled = false;
let add2eHudRenderPatchInstalled = false;

const add2eHudRenderGuard = { actorId: null, until: 0 };

const ADD2E_HUD_CARACS = [
  { key: "force", label: "FOR", title: "Force", icon: "fa-dumbbell", color: "#4ab878" },
  { key: "dexterite", label: "DEX", title: "Dextérité", icon: "fa-running", color: "#f3aa3c" },
  { key: "constitution", label: "CON", title: "Constitution", icon: "fa-heartbeat", color: "#e74c3c" },
  { key: "intelligence", label: "INT", title: "Intelligence", icon: "fa-brain", color: "#2980b9" },
  { key: "sagesse", label: "SAG", title: "Sagesse", icon: "fa-eye", color: "#9b59b6" },
  { key: "charisme", label: "CHA", title: "Charisme", icon: "fa-theater-masks", color: "#e056fd" }
];

const ADD2E_HUD_SAVE_NAMES = ["Paralysie", "Pétrification", "Baguettes", "Souffles", "Sorts"];
const ADD2E_HUD_SAVE_FULL_NAMES = ["Paralysie / poison / mort", "Pétrification / métamorphose", "Baguettes", "Souffles", "Sorts"];
const ADD2E_HUD_SAVE_ICONS = ["fa-skull-crossbones", "fa-mountain", "fa-magic", "fa-fire", "fa-scroll"];
const ADD2E_HUD_SAVE_COLORS = ["#c48642", "#6394e8", "#b12f95", "#e67e22", "#a173d9"];

function add2eHudEscape(value) {
  try { return foundry.utils.escapeHTML(String(value ?? "")); }
  catch (_e) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
}

function add2eHudNumber(value, fallback = 0) {
  if (typeof value === "string") {
    const m = value.match(/-?\d+/);
    if (!m) return fallback;
    value = m[0];
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function add2eHudArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return Object.values(value);
  return [value];
}

function add2eHudClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function add2eHudSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function add2eHudLoadLayout() {
  if (add2eHudLayout) return add2eHudLayout;
  try { add2eHudLayout = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch (_e) { add2eHudLayout = {}; }
  return add2eHudLayout;
}

function add2eHudSaveLayout() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(add2eHudLayout ?? {})); } catch (_e) {}
}

function add2eHudResetLayout() {
  add2eHudLayout = {};
  try { localStorage.removeItem(STORAGE_KEY); } catch (_e) {}
  add2eRefreshActionHud();
}

function add2eHudApplyLayout(hud) {
  const layout = add2eHudLoadLayout();
  const width = add2eHudClamp(Number(layout.width) || 760, 520, Math.max(560, window.innerWidth - 24));
  const menuHeight = add2eHudClamp(Number(layout.menuHeight) || 360, 180, Math.max(220, window.innerHeight - 170));

  hud.style.width = `${width}px`;
  hud.style.setProperty("--a2e-hud-menu-height", `${menuHeight}px`);

  if (Number.isFinite(Number(layout.left)) && Number.isFinite(Number(layout.top))) {
    const left = add2eHudClamp(Number(layout.left), 4, Math.max(4, window.innerWidth - width - 4));
    const top = add2eHudClamp(Number(layout.top), 4, Math.max(4, window.innerHeight - 96));
    hud.style.left = `${left}px`;
    hud.style.top = `${top}px`;
    hud.style.bottom = "auto";
    hud.style.right = "auto";
    Object.assign(add2eHudLayout, { left, top, width, menuHeight });
    add2eHudSaveLayout();
  } else {
    hud.style.left = "116px";
    hud.style.bottom = "22px";
    hud.style.top = "auto";
    hud.style.right = "auto";
  }
}

function add2eHudCanUseActor(actor) {
  if (!actor) return false;
  if (game.user.isGM) return true;
  return actor.isOwner || actor.testUserPermission?.(game.user, "OWNER");
}

function add2eHudSelectedActorAndToken() {
  const token = canvas?.tokens?.controlled?.[0] ?? null;
  return { actor: token?.actor ?? game.user.character ?? null, token };
}

function add2eHudIsRelevant(actor) {
  return actor && actor.type === "personnage" && add2eHudCanUseActor(actor);
}

function add2eHudFindItem(actor, itemId) {
  if (!actor || !itemId) return null;
  return actor.items?.get?.(itemId) ?? actor.items?.find?.(i => String(i.id ?? i._id) === String(itemId)) ?? null;
}

function add2eHudActorForItemId(itemId) {
  if (!itemId) return null;

  const selectedActor = canvas?.tokens?.controlled?.[0]?.actor;
  if (selectedActor?.items?.get?.(itemId) && add2eHudCanUseActor(selectedActor)) return selectedActor;

  const userActor = game.user.character;
  if (userActor?.items?.get?.(itemId) && add2eHudCanUseActor(userActor)) return userActor;

  return game.actors.find(a =>
    a.type === "personnage" &&
    a.items?.get?.(itemId) &&
    add2eHudCanUseActor(a)
  ) ?? null;
}

function add2eHudIsEquipped(item) {
  const s = item?.system ?? {};
  return Boolean(s.equipee ?? s.equipped ?? s.estEquipee);
}

function add2eHudWeapons(actor) {
  return actor?.items?.filter?.(i => i.type === "arme" && add2eHudIsEquipped(i)) ?? [];
}

function add2eHudSumMemorizedByList(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (!value || typeof value !== "object") return 0;
  let total = 0;
  for (const child of Object.values(value)) total += add2eHudSumMemorizedByList(child);
  return total;
}

function add2eHudMemorizedState(sort) {
  const flags = sort?.flags?.add2e ?? {};
  const memorizedCount = flags.memorizedCount === undefined || flags.memorizedCount === null
    ? 0
    : Math.max(0, add2eHudNumber(flags.memorizedCount, 0));
  const byListTotal = flags.memorizedByList === undefined || flags.memorizedByList === null
    ? 0
    : Math.max(0, add2eHudSumMemorizedByList(flags.memorizedByList));

  return {
    memorizedCount,
    byListTotal,
    count: Math.max(memorizedCount, byListTotal)
  };
}

function add2eHudPreparedCount(sort) {
  return add2eHudMemorizedState(sort).count;
}

async function add2eHudSyncMemorizedCountBeforeCast(sort) {
  const state = add2eHudMemorizedState(sort);

  if (state.memorizedCount <= 0 && state.byListTotal > 0) {
    await sort.update({ "flags.add2e.memorizedCount": state.byListTotal });
    console.log(`${TAG}[SPELL_MEM_SYNC_BEFORE_CAST]`, {
      sort: sort.name,
      memorizedCountBefore: state.memorizedCount,
      memorizedByListTotal: state.byListTotal,
      memorizedCountAfter: state.byListTotal
    });
    return state.byListTotal;
  }

  return state.count;
}

function add2eHudSpells(actor) {
  return actor?.items?.filter?.(i => i.type === "sort" && add2eHudPreparedCount(i) > 0) ?? [];
}

function add2eHudClassFeatures(actor) {
  const details = actor?.system?.details_classe ?? {};
  const raw = details.classFeatures ?? details.capacitesClasse ?? actor?.system?.classFeatures ?? [];
  return add2eHudArray(raw)
    .map((feature, index) => ({ ...feature, __index: index }))
    .filter(feature => feature?.activable === true);
}

function add2eHudAbilityValue(actor, key) {
  const direct = Number(actor?.system?.[key]);
  if (Number.isFinite(direct)) return direct;
  const base = add2eHudNumber(actor?.system?.[`${key}_base`], 10);
  const race = add2eHudNumber(actor?.system?.bonus_caracteristiques?.[key], 0);
  const divers = add2eHudNumber(actor?.system?.bonus_divers_caracteristiques?.[key], 0);
  return base + race + divers;
}

function add2eHudSavingThrows(actor) {
  const level = Math.max(1, add2eHudNumber(actor?.system?.niveau, 1));
  const row = actor?.system?.details_classe?.progression?.[level - 1];
  const saves = row?.savingThrows || actor?.system?.sauvegardes || [];
  const arr = add2eHudArray(saves).map(v => add2eHudNumber(v, 0));
  return arr.length >= 5 ? arr.slice(0, 5) : [0, 0, 0, 0, 0];
}

function add2eHudHp(actor) {
  return add2eHudNumber(actor?.system?.pdv ?? actor?.system?.pv?.value ?? actor?.system?.hp?.value, 0);
}

function add2eHudHpMax(actor) {
  return add2eHudNumber(actor?.system?.points_de_coup ?? actor?.system?.pv?.max ?? actor?.system?.hp?.max, 0);
}

function add2eHudThaco(actor) {
  const direct = actor?.system?.thac0 ?? actor?.system?.thaco ?? actor?.system?.combat?.thac0;
  if (direct !== undefined && direct !== null && direct !== "") return direct;
  const level = Math.max(1, add2eHudNumber(actor?.system?.niveau, 1));
  const row = actor?.system?.details_classe?.progression?.[level - 1];
  return row?.thac0 ?? row?.thaco ?? 20;
}

function add2eHudDamageText(arme) {
  const s = arme?.system ?? {};
  return s?.dégâts?.contre_moyen ?? s?.degats?.contre_moyen ?? s?.degats_moyen ?? s?.damage ?? "—";
}

function add2eHudRangeText(arme) {
  const s = arme?.system ?? {};
  const parts = [s.portee_courte ?? s.portee_short, s.portee_moyenne ?? s.portee_medium, s.portee_longue ?? s.portee_long]
    .filter(v => v !== undefined && v !== null && String(v) !== "");
  return parts.length ? parts.join(" / ") : "—";
}

function add2eHudInjectStyle() {
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${HUD_ID}{position:fixed;left:116px;bottom:22px;width:760px;max-width:calc(100vw - 24px);min-width:520px;z-index:80;color:#f6e8bd;font-family:var(--font-primary,Signika,sans-serif);pointer-events:auto;user-select:none;}
    #${HUD_ID}.a2e-hud-dragging,#${HUD_ID}.a2e-hud-resizing{transition:none!important;}#${HUD_ID}.collapsed .a2e-hud-tabs,#${HUD_ID}.collapsed .a2e-hud-body{display:none;}
    #${HUD_ID} .a2e-hud-shell{position:relative;border:1px solid #8a611d;border-radius:14px;overflow:visible;background:radial-gradient(circle at 15% 0%,rgba(213,147,45,.28),transparent 36%),linear-gradient(145deg,rgba(32,25,16,.97),rgba(18,14,10,.96));box-shadow:0 8px 26px rgba(0,0,0,.48),inset 0 0 0 1px rgba(255,230,160,.12);backdrop-filter:blur(3px);}
    #${HUD_ID} .a2e-hud-header{display:grid;grid-template-columns:88px minmax(0,1fr) 70px;gap:8px;align-items:center;min-height:86px;padding:5px 8px;border-bottom:1px solid rgba(184,137,36,.55);border-radius:14px 14px 0 0;background:linear-gradient(180deg,rgba(78,48,18,.78),rgba(36,26,14,.62));}
    #${HUD_ID} .a2e-hud-drag-zone{cursor:move;}#${HUD_ID} .a2e-hud-portrait{width:78px;height:78px;align-self:center;border-radius:10px;object-fit:cover;border:2px solid #c4973f;background:#111;box-shadow:0 2px 8px rgba(0,0,0,.45);}
    #${HUD_ID} .a2e-hud-main{min-width:0;overflow:visible;display:grid;grid-template-columns:minmax(180px,1fr) max-content;grid-template-rows:24px 24px;column-gap:12px;row-gap:0;align-items:center;align-content:center;}
    #${HUD_ID} .a2e-hud-name{grid-column:1;grid-row:1;color:#fff4cf;font-size:1.08em;font-weight:900;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}#${HUD_ID} .a2e-hud-subtitle{grid-column:1;grid-row:2;color:#d8bd78;font-size:.82em;font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}
    #${HUD_ID} .a2e-hud-metrics{grid-column:2;grid-row:1/span 2;display:grid;grid-template-columns:max-content max-content max-content;gap:5px;align-items:center;justify-content:end;width:max-content;max-width:none;overflow:visible;white-space:nowrap;}#${HUD_ID} .a2e-hud-pill{display:inline-flex;align-items:center;justify-content:center;height:24px;min-width:0;max-width:none;padding:1px 8px;border:1px solid rgba(214,176,90,.75);border-radius:999px;background:rgba(255,244,201,.12);color:#fff0bd;font-size:.76em;line-height:1;font-weight:900;white-space:nowrap;}
    #${HUD_ID} .a2e-hud-controls{display:grid;grid-template-columns:30px 30px;gap:5px;justify-content:end;align-items:center;}#${HUD_ID} .a2e-hud-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:1px solid rgba(214,176,90,.75);border-radius:9px;background:rgba(255,244,201,.12);color:#ffe4a1;cursor:pointer;}
    #${HUD_ID} .a2e-hud-tabs{display:grid;grid-template-columns:repeat(5,1fr);border-radius:0 0 14px 14px;overflow:hidden;background:rgba(0,0,0,.22);}#${HUD_ID} .a2e-hud-tab{min-height:34px;border:0;border-right:1px solid rgba(184,137,36,.32);background:transparent;color:#d8bd78;font-size:.78em;font-weight:900;cursor:pointer;}#${HUD_ID} .a2e-hud-tab:last-child{border-right:0;}#${HUD_ID} .a2e-hud-tab.active{color:#211307;background:linear-gradient(180deg,#f0c66d,#c78d2e);}
    #${HUD_ID} .a2e-hud-body{position:absolute;left:0;right:0;bottom:calc(100% + 8px);max-height:var(--a2e-hud-menu-height,360px);overflow-y:auto;padding:9px;border:1px solid #8a611d;border-radius:14px;background:radial-gradient(circle at 20% 0%,rgba(213,147,45,.24),transparent 34%),linear-gradient(145deg,rgba(28,22,15,.98),rgba(12,10,8,.97));box-shadow:0 8px 24px rgba(0,0,0,.55),inset 0 0 0 1px rgba(255,230,160,.10);}#${HUD_ID} .a2e-hud-body:after{content:"";position:absolute;left:50%;bottom:-8px;transform:translateX(-50%);width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:9px solid #8a611d;}
    #${HUD_ID} .a2e-hud-section{display:none;}#${HUD_ID} .a2e-hud-section.active{display:grid;gap:7px;}#${HUD_ID} .a2e-hud-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:48px;padding:6px;border:1px solid rgba(214,176,90,.38);border-radius:10px;background:rgba(255,250,235,.07);user-select:text;}#${HUD_ID} .a2e-hud-row.compact{grid-template-columns:minmax(0,1fr) auto;min-height:38px;}#${HUD_ID} .a2e-hud-row img{width:34px;height:34px;border-radius:7px;object-fit:cover;border:1px solid rgba(214,176,90,.65);background:rgba(0,0,0,.25);}
    #${HUD_ID} .a2e-hud-row-title{color:#fff4cf;font-weight:900;line-height:1.08;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}#${HUD_ID} .a2e-hud-row-meta{display:flex;flex-wrap:wrap;gap:4px 8px;color:#c8ad6e;font-size:.76em;font-weight:750;margin-top:2px;}#${HUD_ID} .a2e-hud-action{min-width:78px;min-height:30px;padding:4px 9px;border:1px solid #d6b05a;border-radius:9px;background:linear-gradient(180deg,#fff0bd,#d6a345);color:#211307;font-size:.8em;font-weight:950;cursor:pointer;white-space:nowrap;}#${HUD_ID} .a2e-hud-action:disabled{opacity:.45;cursor:not-allowed;}
    #${HUD_ID} .a2e-hud-icon-btn:hover,#${HUD_ID} .a2e-hud-action:hover,#${HUD_ID} .a2e-hud-tab:hover{filter:brightness(1.15);transform:translateY(-1px);}#${HUD_ID} .a2e-hud-empty{padding:12px;border:1px dashed rgba(214,176,90,.45);border-radius:10px;color:#c8ad6e;font-style:italic;text-align:center;}#${HUD_ID} .a2e-hud-ability-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;}#${HUD_ID} .a2e-hud-ability{display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center;padding:7px;border:1px solid rgba(214,176,90,.38);border-radius:10px;background:rgba(255,250,235,.07);}#${HUD_ID} .a2e-hud-ability b{color:#fff4cf;font-size:1.15em;}#${HUD_ID} .a2e-hud-ability span{display:block;color:#c8ad6e;font-size:.76em;font-weight:800;}#${HUD_ID} .a2e-hud-resize{position:absolute;right:4px;top:-11px;width:18px;height:18px;border:1px solid rgba(214,176,90,.8);border-radius:5px;background:rgba(20,14,8,.92);color:#ffe4a1;display:flex;align-items:center;justify-content:center;cursor:nwse-resize;font-size:10px;z-index:3;}
    @media(max-width:900px){#${HUD_ID}{left:12px;right:12px;width:calc(100vw - 24px);max-width:calc(100vw - 24px);min-width:0;}#${HUD_ID} .a2e-hud-main{grid-template-columns:minmax(140px,1fr) max-content;column-gap:8px;}#${HUD_ID} .a2e-hud-pill{padding:1px 6px;font-size:.72em;}}@media(max-width:680px){#${HUD_ID} .a2e-hud-header{grid-template-columns:74px minmax(0,1fr) 64px;}#${HUD_ID} .a2e-hud-portrait{width:66px;height:66px;}#${HUD_ID} .a2e-hud-main{grid-template-columns:1fr;grid-template-rows:21px 19px 24px;}#${HUD_ID} .a2e-hud-metrics{grid-column:1;grid-row:3;justify-content:start;}#${HUD_ID} .a2e-hud-ability-grid{grid-template-columns:repeat(2,1fr);}}
  `;
  document.head.appendChild(style);
}

function add2eHudWeaponRows(actor) {
  const weapons = add2eHudWeapons(actor);
  if (!weapons.length) return `<div class="a2e-hud-empty">Aucune arme équipée.</div>`;
  return weapons.map(arme => `<div class="a2e-hud-row" data-item-id="${add2eHudEscape(arme.id)}"><img src="${add2eHudEscape(arme.img || "icons/svg/sword.svg")}" alt="${add2eHudEscape(arme.name)}"><div><div class="a2e-hud-row-title">${add2eHudEscape(arme.name)}</div><div class="a2e-hud-row-meta"><span>Équipée</span><span>Dégâts ${add2eHudEscape(add2eHudDamageText(arme))}</span><span>Portée ${add2eHudEscape(add2eHudRangeText(arme))}</span></div></div><button type="button" class="a2e-hud-action" data-action="attack" data-item-id="${add2eHudEscape(arme.id)}">Attaquer</button></div>`).join("");
}

function add2eHudSpellRows(actor) {
  const spells = add2eHudSpells(actor);
  if (!spells.length) return `<div class="a2e-hud-empty">Aucun sort mémorisé.</div>`;
  return spells.map(sort => {
    const state = add2eHudMemorizedState(sort);
    const niv = add2eHudEscape(sort.system?.niveau ?? sort.system?.level ?? "—");
    const school = add2eHudEscape(sort.system?.école ?? sort.system?.ecole ?? "");
    return `<div class="a2e-hud-row" data-item-id="${add2eHudEscape(sort.id)}"><img src="${add2eHudEscape(sort.img || "icons/svg/book.svg")}" alt="${add2eHudEscape(sort.name)}"><div><div class="a2e-hud-row-title">${add2eHudEscape(sort.name)}</div><div class="a2e-hud-row-meta"><span>Niv. ${niv}</span>${school ? `<span>${school}</span>` : ""}<span>Mémorisé ${state.count}</span></div></div><button type="button" class="a2e-hud-action" data-action="cast-spell" data-item-id="${add2eHudEscape(sort.id)}">Lancer</button></div>`;
  }).join("");
}

function add2eHudFeatureRows(actor) {
  const features = add2eHudClassFeatures(actor);
  if (!features.length) return `<div class="a2e-hud-empty">Aucune capacité activable.</div>`;
  const actorLevel = add2eHudNumber(actor.system?.niveau, 1);
  return features.map(feature => {
    const idx = add2eHudEscape(feature.__index);
    const name = add2eHudEscape(feature.name ?? feature.label ?? feature.nom ?? `Capacité ${feature.__index + 1}`);
    const min = add2eHudNumber(feature.minLevel ?? feature.minimumLevel ?? feature.niveauMin ?? 1, 1);
    const maxRaw = feature.maxLevel ?? feature.maximumLevel ?? feature.niveauMax ?? "";
    const max = maxRaw === "" || maxRaw === undefined || maxRaw === null ? 999 : add2eHudNumber(maxRaw, 999);
    const locked = actorLevel < min || actorLevel > max;
    const uses = add2eHudEscape(feature.uses?.label ?? feature.usesLabel ?? "");
    return `<div class="a2e-hud-row compact" data-feature-index="${idx}"><div><div class="a2e-hud-row-title">${name}</div><div class="a2e-hud-row-meta">${locked ? `<span>Niveau requis ${min}${max !== 999 ? `-${max}` : ""}</span>` : `<span>Disponible</span>`}${uses ? `<span>${uses}</span>` : ""}</div></div><button type="button" class="a2e-hud-action" data-action="use-feature" data-feature-index="${idx}" ${locked ? "disabled" : ""}>Utiliser</button></div>`;
  }).join("");
}

function add2eHudSaveRows(actor) {
  const saves = add2eHudSavingThrows(actor);
  return ADD2E_HUD_SAVE_FULL_NAMES.map((label, idx) => `<div class="a2e-hud-row compact"><div><div class="a2e-hud-row-title">${add2eHudEscape(label)}</div><div class="a2e-hud-row-meta"><span>Seuil ${add2eHudEscape(saves[idx] || "—")} ou plus</span></div></div><button type="button" class="a2e-hud-action" data-action="roll-save" data-save-index="${idx}">Jet</button></div>`).join("");
}

function add2eHudAbilityRows(actor) {
  return `<div class="a2e-hud-ability-grid">${ADD2E_HUD_CARACS.map(carac => `<div class="a2e-hud-ability"><div><b>${carac.label} ${add2eHudAbilityValue(actor, carac.key)}</b><span>${add2eHudEscape(carac.title)}</span></div><button type="button" class="a2e-hud-action" data-action="roll-ability" data-ability="${carac.key}">Jet</button></div>`).join("")}</div>`;
}

function add2eHudHtml(actor, token = null) {
  const img = token?.document?.texture?.src || actor.img || "icons/svg/mystery-man.svg";
  const race = actor.system?.race || actor.system?.details_race?.label || actor.items?.find?.(i => i.type === "race")?.name || "Race";
  const classe = actor.system?.classe || actor.system?.details_classe?.label || actor.items?.find?.(i => i.type === "classe")?.name || "Classe";
  const niveau = actor.system?.niveau ?? "—";
  const ac = actor.system?.ca_total ?? actor.system?.ca ?? "—";
  const thaco = add2eHudThaco(actor);
  const tab = (key, icon, label) => `<button type="button" class="a2e-hud-tab ${add2eHudActiveTab === key ? "active" : ""}" data-hud-tab="${key}"><i class="${icon}"></i> ${label}</button>`;
  const section = (key, html) => `<section class="a2e-hud-section ${add2eHudActiveTab === key ? "active" : ""}" data-hud-section="${key}">${html}</section>`;
  const body = add2eHudActiveTab ? `<div class="a2e-hud-body">${section("attaques", add2eHudWeaponRows(actor))}${section("sorts", add2eHudSpellRows(actor))}${section("capacites", add2eHudFeatureRows(actor))}${section("sauvegardes", add2eHudSaveRows(actor))}${section("caracs", add2eHudAbilityRows(actor))}</div>` : "";
  return `<div class="a2e-hud-shell">${body}<div class="a2e-hud-resize" data-resize-hud="1" title="Redimensionner le HUD"><i class="fas fa-up-right-and-down-left-from-center"></i></div><div class="a2e-hud-header"><img class="a2e-hud-portrait a2e-hud-drag-zone" src="${add2eHudEscape(img)}" alt="${add2eHudEscape(actor.name)}" title="Glisser pour déplacer"><div class="a2e-hud-main a2e-hud-drag-zone" title="Glisser pour déplacer — double-clic pour réinitialiser"><div class="a2e-hud-name">${add2eHudEscape(actor.name)}</div><div class="a2e-hud-subtitle">${add2eHudEscape(race)} — ${add2eHudEscape(classe)} niv. ${add2eHudEscape(niveau)}</div><div class="a2e-hud-metrics"><span class="a2e-hud-pill">PV ${add2eHudHp(actor)} / ${add2eHudHpMax(actor)}</span><span class="a2e-hud-pill">CA ${add2eHudEscape(ac)}</span><span class="a2e-hud-pill">THAC0 ${add2eHudEscape(thaco)}</span></div></div><div class="a2e-hud-controls"><button type="button" class="a2e-hud-icon-btn" data-action="reset-layout" title="Réinitialiser position/taille"><i class="fas fa-crosshairs"></i></button><button type="button" class="a2e-hud-icon-btn" data-action="toggle-collapse" title="Réduire / agrandir"><i class="fas fa-chevron-down"></i></button></div></div><nav class="a2e-hud-tabs">${tab("attaques", "fas fa-swords", "Attaques")}${tab("sorts", "fas fa-book", "Sorts")}${tab("capacites", "fas fa-bolt", "Capacités")}${tab("sauvegardes", "fas fa-shield-alt", "Sauv.")}${tab("caracs", "fas fa-dice-d20", "Carac.")}</nav></div>`;
}

function add2eRenderActionHud(actor = null, token = null) {
  add2eHudInjectStyle();
  const existing = document.getElementById(HUD_ID);
  if (!add2eHudIsRelevant(actor)) {
    existing?.remove();
    add2eHudActorId = null;
    return;
  }
  add2eHudActorId = actor.id;
  const hud = existing ?? document.createElement("div");
  hud.id = HUD_ID;
  hud.classList.toggle("collapsed", add2eHudCollapsed);
  hud.innerHTML = add2eHudHtml(actor, token);
  if (!existing) document.body.appendChild(hud);
  add2eHudApplyLayout(hud);
  add2eBindHudEvents(hud, actor);
}

function add2eRefreshActionHud() {
  const { actor, token } = add2eHudSelectedActorAndToken();
  add2eRenderActionHud(actor, token);
}

function add2eRefreshActionHudSoon() {
  for (const delay of [0, 100, 250, 600, 1200]) window.setTimeout(add2eRefreshActionHud, delay);
}

function add2eCloseActionHud() {
  document.getElementById(HUD_ID)?.remove();
  add2eHudActorId = null;
}

function add2eBindHudEvents(hud, actor) {
  hud.querySelectorAll("[data-hud-tab]").forEach(btn => {
    btn.addEventListener("click", ev => {
      ev.preventDefault();
      const nextTab = btn.dataset.hudTab || "attaques";
      add2eHudActiveTab = add2eHudActiveTab === nextTab ? null : nextTab;
      add2eRefreshActionHud();
    });
  });

  hud.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const action = btn.dataset.action;
      if (action === "cast-spell") return; // géré en capture globale, comme le patch console validé

      try {
        if (action === "reset-layout") return add2eHudResetLayout();
        if (action === "toggle-collapse") {
          add2eHudCollapsed = !add2eHudCollapsed;
          if (add2eHudCollapsed) add2eHudActiveTab = null;
          add2eRefreshActionHud();
          return;
        }
        if (action === "attack") return add2eHudAttack(actor, btn.dataset.itemId);
        if (action === "use-feature") return add2eHudUseFeature(actor, btn.dataset.featureIndex);
        if (action === "roll-save") return add2eHudRollSaveLikeSheet(actor, Number(btn.dataset.saveIndex));
        if (action === "roll-ability") return add2eHudRollAbilityLikeSheet(actor, btn.dataset.ability);
      } catch (err) {
        console.error(`${TAG}[ACTION_ERROR]`, { action, actor: actor?.name, err });
        ui.notifications.error(`ADD2E HUD | Erreur pendant l'action : ${action}`);
      }
    });
  });

  hud.querySelectorAll(".a2e-hud-drag-zone").forEach(el => add2eBindHudDragHandle(hud, el));
  hud.querySelector("[data-resize-hud]")?.addEventListener("pointerdown", ev => add2eStartHudResize(ev, hud));
  hud.querySelector(".a2e-hud-drag-zone")?.addEventListener("dblclick", ev => { ev.preventDefault(); add2eHudResetLayout(); });
}

function add2eHudInstallCaptureCastHandler() {
  if (add2eHudCaptureInstalled) return;
  add2eHudCaptureInstalled = true;

  document.addEventListener("click", async ev => {
    const button = ev.target.closest?.(`#${HUD_ID} [data-action='cast-spell']`);
    if (!button) return;

    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();

    const itemId = button.dataset.itemId;
    const actor = add2eHudActorForItemId(itemId);
    const sort = actor?.items?.get?.(itemId);

    if (!actor || !sort) {
      ui.notifications.warn("HUD : acteur ou sort introuvable.");
      console.warn(`${TAG}[CAPTURE_CAST_MISSING]`, { actor, itemId, sort });
      return false;
    }

    return add2eHudCastSpell(actor, itemId, button);
  }, true);

  console.log(`${TAG}[CAPTURE_CAST_HANDLER_INSTALLED]`);
}

function add2eBindHudDragHandle(hud, handle) {
  handle.addEventListener("pointerdown", ev => {
    if (ev.button !== 0) return;
    if (ev.target.closest?.("button,a,input,select,textarea,[data-action],[data-resize-hud]")) return;
    ev.preventDefault();
    const rect = hud.getBoundingClientRect();
    const startX = ev.clientX;
    const startY = ev.clientY;
    const startLeft = rect.left;
    const startTop = rect.top;
    const width = rect.width;
    const height = rect.height;
    hud.classList.add("a2e-hud-dragging");
    handle.setPointerCapture?.(ev.pointerId);
    const move = moveEv => {
      const left = add2eHudClamp(startLeft + moveEv.clientX - startX, 4, Math.max(4, window.innerWidth - width - 4));
      const top = add2eHudClamp(startTop + moveEv.clientY - startY, 4, Math.max(4, window.innerHeight - height - 4));
      hud.style.left = `${left}px`;
      hud.style.top = `${top}px`;
      hud.style.bottom = "auto";
      hud.style.right = "auto";
      add2eHudLayout = { ...(add2eHudLoadLayout() ?? {}), left, top, width: Math.round(width), menuHeight: Number(add2eHudLoadLayout().menuHeight) || 360 };
    };
    const up = upEv => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      hud.classList.remove("a2e-hud-dragging");
      try { handle.releasePointerCapture?.(upEv.pointerId); } catch (_e) {}
      add2eHudSaveLayout();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up, { once: true });
  });
}

function add2eStartHudResize(ev, hud) {
  if (ev.button !== 0) return;
  ev.preventDefault();
  ev.stopPropagation();
  const rect = hud.getBoundingClientRect();
  const startX = ev.clientX;
  const startY = ev.clientY;
  const startWidth = rect.width;
  const startMenuHeight = Number(add2eHudLoadLayout().menuHeight) || 360;
  hud.classList.add("a2e-hud-resizing");
  ev.currentTarget.setPointerCapture?.(ev.pointerId);
  const move = moveEv => {
    const width = add2eHudClamp(startWidth + moveEv.clientX - startX, 520, Math.max(560, window.innerWidth - 24));
    const menuHeight = add2eHudClamp(startMenuHeight - (moveEv.clientY - startY), 180, Math.max(220, window.innerHeight - 170));
    const left = add2eHudClamp(hud.getBoundingClientRect().left, 4, Math.max(4, window.innerWidth - width - 4));
    hud.style.width = `${width}px`;
    hud.style.left = `${left}px`;
    hud.style.setProperty("--a2e-hud-menu-height", `${menuHeight}px`);
    add2eHudLayout = { ...(add2eHudLoadLayout() ?? {}), left, top: hud.getBoundingClientRect().top, width: Math.round(width), menuHeight: Math.round(menuHeight) };
  };
  const up = upEv => {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    hud.classList.remove("a2e-hud-resizing");
    try { ev.currentTarget.releasePointerCapture?.(upEv.pointerId); } catch (_e) {}
    add2eHudSaveLayout();
    add2eRefreshActionHud();
  };
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", up, { once: true });
}

async function add2eHudAttack(actor, itemId) {
  const arme = add2eHudFindItem(actor, itemId);
  if (!arme) return ui.notifications.warn("Arme introuvable.");
  if (typeof globalThis.add2eAttackRoll !== "function") {
    ui.notifications.error("Fonction add2eAttackRoll introuvable.");
    console.warn(`${TAG}[MISSING] add2eAttackRoll`);
    return;
  }
  return globalThis.add2eAttackRoll({ actor, arme });
}

function add2eHudGetSheetDocument(sheet) {
  return sheet?.actor ?? sheet?.document ?? sheet?.object ?? null;
}

function add2eHudIsSheetRendered(sheet) {
  if (!sheet) return false;
  if (sheet.rendered === true) return true;
  const el = sheet.element;
  if (el instanceof HTMLElement) return document.body.contains(el);
  if (el?.[0] instanceof HTMLElement) return document.body.contains(el[0]);
  return false;
}

function add2eHudShouldBlockRender(sheet) {
  if (!add2eHudRenderGuard.actorId || Date.now() > add2eHudRenderGuard.until) return false;
  const doc = add2eHudGetSheetDocument(sheet);
  if (!doc || doc.documentName !== "Actor") return false;
  if (String(doc.id) !== String(add2eHudRenderGuard.actorId)) return false;
  return !add2eHudIsSheetRendered(sheet);
}

function add2eHudPatchRenderPrototype(proto, label) {
  if (!proto || typeof proto.render !== "function") return;
  if (proto.render.__add2eHudCapturePatched) return;

  const original = proto.render;
  const patched = function(...args) {
    if (add2eHudShouldBlockRender(this)) {
      console.log(`${TAG}[SHEET_RENDER_BLOCKED]`, {
        label,
        actor: add2eHudGetSheetDocument(this)?.name,
        args
      });
      return this;
    }
    return original.apply(this, args);
  };

  patched.__add2eHudCapturePatched = true;
  patched.__add2eHudCaptureOriginal = original;
  proto.render = patched;
  console.log(`${TAG}[PATCH_RENDER]`, label);
}

function add2eHudInstallRenderGuardPatches(actor = null) {
  if (!add2eHudRenderPatchInstalled) {
    add2eHudRenderPatchInstalled = true;
    try { add2eHudPatchRenderPrototype(foundry?.applications?.api?.ApplicationV2?.prototype, "ApplicationV2"); } catch (_e) {}
    try { add2eHudPatchRenderPrototype(globalThis.Application?.prototype, "ApplicationV1"); } catch (_e) {}
    try { add2eHudPatchRenderPrototype(globalThis.ActorSheet?.prototype, "ActorSheet"); } catch (_e) {}
  }

  try { add2eHudPatchRenderPrototype(actor?.sheet?.constructor?.prototype, "actor.sheet.constructor"); } catch (_e) {}
}

function add2eHudArmRenderGuard(actor, duration = 3200) {
  add2eHudInstallRenderGuardPatches(actor);
  add2eHudRenderGuard.actorId = actor?.id ?? null;
  add2eHudRenderGuard.until = Date.now() + duration;
}

async function add2eHudCastSpell(actor, itemId, button = null) {
  let sort = add2eHudFindItem(actor, itemId);
  if (!sort) return ui.notifications.warn("Sort introuvable.");

  if (typeof globalThis.add2eCastSpell !== "function") {
    ui.notifications.error("Fonction add2eCastSpell introuvable.");
    console.warn(`${TAG}[MISSING] add2eCastSpell`);
    return false;
  }

  let available = add2eHudPreparedCount(sort);
  if (available <= 0) {
    ui.notifications.warn(`Le sort "${sort.name}" n'est plus mémorisé.`);
    add2eRefreshActionHudSoon();
    return false;
  }

  button?.setAttribute?.("disabled", "disabled");

  try {
    available = await add2eHudSyncMemorizedCountBeforeCast(sort);
    if (available <= 0) {
      ui.notifications.warn(`Le sort "${sort.name}" n'est plus mémorisé.`);
      add2eRefreshActionHudSoon();
      return false;
    }

    sort = add2eHudFindItem(actor, itemId) ?? sort;
    add2eHudArmRenderGuard(actor, 3200);

    const result = await globalThis.add2eCastSpell({ actor, sort });
    await add2eHudSleep(120);

    const refreshedSort = add2eHudFindItem(actor, itemId) ?? sort;
    console.log(`${TAG}[CAST_RESULT]`, {
      actor: actor.name,
      sort: sort.name,
      result,
      stateAfter: add2eHudMemorizedState(refreshedSort),
      flags: refreshedSort?.flags?.add2e ?? null
    });

    add2eRefreshActionHudSoon();
    return result;
  } catch (err) {
    console.error(`${TAG}[CAST_ERROR]`, err);
    ui.notifications.error("HUD : erreur pendant le lancement du sort.");
    return false;
  } finally {
    window.setTimeout(() => { if (add2eHudRenderGuard.actorId === actor?.id) add2eHudRenderGuard.actorId = null; }, 3300);
    window.setTimeout(() => button?.removeAttribute?.("disabled"), 300);
  }
}

async function add2eHudUseFeature(actor, featureIndex) {
  const features = add2eHudClassFeatures(actor);
  const feature = features.find(f => String(f.__index) === String(featureIndex));
  if (!feature) return ui.notifications.warn("Capacité introuvable.");
  if (typeof globalThis.add2eExecuteClassFeatureOnUse !== "function") {
    ui.notifications.error("Fonction add2eExecuteClassFeatureOnUse introuvable.");
    console.warn(`${TAG}[MISSING] add2eExecuteClassFeatureOnUse`);
    return;
  }
  return globalThis.add2eExecuteClassFeatureOnUse(actor, feature, null);
}

async function add2eHudRollAbilityLikeSheet(actor, carac) {
  const data = ADD2E_HUD_CARACS.find(c => c.key === carac);
  const label = carac?.toUpperCase() || "Caractéristique";
  const val = Number(actor.system?.[carac]) || 10;
  const roll = new Roll("1d20");
  await roll.evaluate();
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  const icon = data?.icon || "fa-dice-d20";
  const color = data?.color || "#6c4e95";
  const ok = roll.total <= val;
  const html = `<div class="add2e-card-test" style="border-radius:13px;box-shadow:0 2px 10px #b5e7c388;background:linear-gradient(100deg,#f9fcfa 90%,#e4fbf1 100%);border:1.4px solid ${color};max-width:420px;padding:.85em 1.1em .8em 1.1em;font-family:var(--font-primary);"><div style="display:flex;align-items:center;gap:.7em;margin-bottom:.5em;"><i class="fas ${icon}" style="font-size:2em;color:${color};"></i><span style="font-size:1.17em;font-weight:bold;color:${color};">${label}</span><span style="margin-left:auto;font-size:1em;font-weight:500;color:#666;">Test de caractéristique</span></div><div style="font-size:1.11em;margin-bottom:.25em;">Seuil&nbsp;: <b>${val}</b>&nbsp;&nbsp;|&nbsp;&nbsp;Résultat&nbsp;: <b>${roll.total}</b></div><div style="margin:.2em 0 .1em 0;font-size:1.1em;"><span style="font-weight:600;color:${ok ? "#1cb360" : "#c34040"};">${ok ? "✔️ Réussite" : "❌ Échec"}</span></div></div>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: html });
}

async function add2eHudRollSaveLikeSheet(actor, idx) {
  const saves = actor.system?.details_classe?.progression?.[actor.system.niveau - 1]?.savingThrows || actor.system?.sauvegardes || [];
  const nom = ADD2E_HUD_SAVE_NAMES[idx] || "Jet";
  const valeur = Number(saves[idx]);
  if (!valeur) return ui.notifications.warn("Aucune valeur pour ce jet.");
  const roll = new Roll("1d20");
  await roll.evaluate();
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  let bonusSave = 0;
  if (typeof Add2eEffectsEngine !== "undefined") {
    try { bonusSave = Number(Add2eEffectsEngine.analyze?.(actor, { type: "save", vsType: nom, frontale: true })?.bonus_save || 0); }
    catch (e) { console.warn("[ADD2E][SAVE] Erreur analyse effets de sauvegarde", e); }
  }
  const totalJet = Number(roll.total || 0) + bonusSave;
  const icon = ADD2E_HUD_SAVE_ICONS[idx] || "fa-dice-d20";
  const color = ADD2E_HUD_SAVE_COLORS[idx] || "#6c4e95";
  const ok = totalJet >= valeur;
  const html = `<div class="add2e-card-test" style="border-radius:13px;box-shadow:0 2px 10px #cfdfff88;background:linear-gradient(100deg,#f9fafd 90%,#e6e8fb 100%);border:1.4px solid ${color};max-width:420px;padding:.85em 1.1em .8em 1.1em;font-family:var(--font-primary);"><div style="display:flex;align-items:center;gap:.7em;margin-bottom:.5em;"><i class="fas ${icon}" style="font-size:2em;color:${color};"></i><span style="font-size:1.12em;font-weight:bold;color:${color};">${nom}</span><span style="margin-left:auto;font-size:1em;font-weight:500;color:#666;">Jet de sauvegarde</span></div><div style="font-size:1.09em;margin-bottom:.25em;">Seuil&nbsp;: <b>${valeur}</b>&nbsp;&nbsp;|&nbsp;&nbsp;Résultat&nbsp;: <b>${roll.total}</b>${bonusSave ? `&nbsp;&nbsp;|&nbsp;&nbsp;Effets&nbsp;: <b>${bonusSave >= 0 ? "+" : ""}${bonusSave}</b> → <b>${totalJet}</b>` : ""}</div><div style="margin:.2em 0 .1em 0;font-size:1.1em;"><span style="font-weight:600;color:${ok ? "#1cb360" : "#c34040"};">${ok ? "✔️ Réussite" : "❌ Échec"}</span></div></div>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: html });
}

Hooks.once("init", () => {
  game.add2e = game.add2e ?? {};
  game.add2e.actionHudVersion = ADD2E_ACTION_HUD_VERSION;
  game.add2e.openActionHud = (actor = null) => {
    const selected = add2eHudSelectedActorAndToken();
    add2eRenderActionHud(actor ?? selected.actor, selected.token);
  };
  game.add2e.closeActionHud = add2eCloseActionHud;
  game.add2e.refreshActionHud = add2eRefreshActionHud;
  game.add2e.resetActionHudLayout = add2eHudResetLayout;
  console.log(`${TAG}[INIT]`, ADD2E_ACTION_HUD_VERSION);
});

Hooks.once("ready", () => {
  add2eHudInstallCaptureCastHandler();
  add2eHudInstallRenderGuardPatches();
  window.setTimeout(add2eRefreshActionHud, 300);
});

Hooks.on("controlToken", () => window.setTimeout(add2eRefreshActionHud, 60));
Hooks.on("canvasReady", () => window.setTimeout(add2eRefreshActionHud, 150));
Hooks.on("updateActor", actor => { if (actor?.id === add2eHudActorId) window.setTimeout(add2eRefreshActionHud, 60); });

for (const hookName of ["createItem", "updateItem", "deleteItem", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
  Hooks.on(hookName, doc => {
    const actor = doc?.parent;
    if (actor?.id === add2eHudActorId) window.setTimeout(add2eRefreshActionHud, 60);
  });
}

export { add2eRenderActionHud, add2eRefreshActionHud, add2eCloseActionHud };
=======
// ADD2E — HUD d'action rapide maison.
// Version : 2026-06-01-v42-drag-mouse-fallback
// Le HUD reste une interface : les actions délèguent aux fonctions système.

const ADD2E_ACTION_HUD_VERSION="2026-06-01-v42-drag-mouse-fallback";
const HUD_ID="add2e-action-hud";
const STYLE_ID="add2e-action-hud-style";
const STORAGE_KEY="add2e.actionHud.state.v42";
const LEGACY_STORAGE_KEYS=["add2e.actionHud.state.v40","add2e.actionHud.state.v39","add2e.actionHud.state.v34","add2e.actionHud.layout.v1"];
const TAG="[ADD2E][ACTION_HUD]";
let hudActor=null,hudToken=null,activeTab="attaques",selectedSpellGroup=null,dragging=false,resizing=false,manualIntentUntil=0,state=null;
const TABS=["attaques","sorts","capacites","effets","sauvegardes","caracs"];
const CARACS=[["force","FOR","Force","fa-fist-raised"],["dexterite","DEX","Dextérité","fa-running"],["constitution","CON","Constitution","fa-heart"],["intelligence","INT","Intelligence","fa-brain"],["sagesse","SAG","Sagesse","fa-eye"],["charisme","CHA","Charisme","fa-comments"]];
const SAVES=[["Paralysie","Paralysie / poison / mort","fa-skull-crossbones"],["Pétrification","Pétrification / métamorphose","fa-mountain"],["Baguettes","Baguettes","fa-magic"],["Souffles","Souffles","fa-wind"],["Sorts","Sorts","fa-scroll"]];

function esc(v){try{return foundry.utils.escapeHTML(String(v??""));}catch(_e){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");}}
function arr(v){if(v===undefined||v===null||v==="")return[];if(Array.isArray(v))return v.flatMap(arr);if(v instanceof Set)return[...v];if(typeof v?.values==="function")return[...v.values()];if(typeof v==="object")return Object.values(v);return[v];}
function num(v,fallback=0){if(typeof v==="string"){const m=v.match(/-?\d+(?:[.,]\d+)?/);if(!m)return fallback;v=m[0].replace(",",".");}const n=Number(v);return Number.isFinite(n)?n:fallback;}
function norm(v){return String(v??"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"").replace(/[^a-z0-9:_-]+/g,"_").replace(/^_|_$/g,"");}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function hud(){return document.getElementById(HUD_ID);}
function currentActor(){return hudActor??canvas?.tokens?.controlled?.[0]?.actor??game.user?.character??null;}
function tokenFor(actor){return canvas?.tokens?.controlled?.find?.(t=>t.actor?.id===actor?.id)??actor?.getActiveTokens?.()[0]??null;}
function actorType(actor){return norm(actor?.type??actor?._source?.type??actor?.baseActor?.type??"");}
function canUse(actor){return!!actor&&(game.user?.isGM||actor.isOwner||actor.testUserPermission?.(game.user,"OWNER"));}
function isMonsterActor(actor){return actorType(actor)==="monster";}
function usesProjectileInventory(actor){return actorType(actor)==="personnage";}
function relevant(actor){const t=actorType(actor);return t==="personnage"?canUse(actor):(t==="monster"?game.user?.isGM===true:false);}

function defaultState(){return{left:116,top:null,bottom:22,width:640,maxMenuHeight:360,collapsed:false};}
function normalizeLoadedState(raw={}){const s={...defaultState(),...(raw||{})};s.width=num(s.width,640);s.maxMenuHeight=num(s.maxMenuHeight??s.menuHeight,360);s.left=num(s.left,116);if(Number.isFinite(Number(s.top)))s.top=Number(s.top);else if(Number.isFinite(Number(s.bottom)))s.top=Math.max(8,window.innerHeight-110-Number(s.bottom));else s.top=null;return s;}
function loadState(){if(state)return state;let raw=null;try{raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");}catch(_e){raw=null;}if(!raw){for(const key of LEGACY_STORAGE_KEYS){try{raw=JSON.parse(localStorage.getItem(key)||"null");}catch(_e){raw=null;}if(raw)break;}}state=normalizeLoadedState(raw);return state;}
function saveState(partial={}){Object.assign(loadState(),partial);try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(_e){}}
function applyGeometry(el=hud(),force=false){if(!el||(!force&&(dragging||resizing)))return;const s=loadState();s.width=clamp(num(s.width,640),420,Math.max(440,window.innerWidth-16));s.left=clamp(num(s.left,116),8,Math.max(8,window.innerWidth-s.width-8));const fallbackTop=Math.max(8,window.innerHeight-(el.offsetHeight||110)-num(s.bottom,22));s.top=clamp(Number.isFinite(Number(s.top))?Number(s.top):fallbackTop,8,Math.max(8,window.innerHeight-48));s.maxMenuHeight=clamp(num(s.maxMenuHeight,360),140,Math.max(160,window.innerHeight-130));el.style.left=`${Math.round(s.left)}px`;el.style.top=`${Math.round(s.top)}px`;el.style.bottom="auto";el.style.right="auto";el.style.width=`${Math.round(s.width)}px`;el.style.setProperty("--a2e-hud-menu-max",`${Math.round(s.maxMenuHeight)}px`);}
function setCollapsed(value,persist=true){const el=hud();if(!el)return;el.classList.toggle("collapsed",!!value);if(persist)saveState({collapsed:!!value});}

function itemEquipped(item){const s=item?.system??{};return s.equipee===true||s.equipped===true||s.portee===true||s.worn===true||s.estEquipee===true;}
function itemTags(item){const s=item?.system??{},f=item?.flags?.add2e??{};return[item?.name,s.nom,s.categorie,s.category,s.type,s.sousType,s.sous_type,s.type_arme,s.famille,s.famille_arme,s.tags,s.effectTags,f.tags,f.effectTags].flatMap(arr).map(norm).filter(Boolean);}
function isContainerLike(item){const t=itemTags(item).join(" "),n=norm(item?.name);return t.includes("sacoche")||t.includes("component")||t.includes("composant")||n.includes("sacoche")||n.includes("composant");}
function isPropelledWeapon(item){const tags=itemTags(item),n=norm(item?.name),s=item?.system??{};return s.projectile_propulse===true||s.arme_a_projectile===true||tags.includes("projectile_propulse")||tags.includes("usage_projectile_propulse")||["arc","arbalete","fronde"].some(k=>n.includes(k));}
function projectileKeys(item){const text=`${norm(item?.name)} ${itemTags(item).join(" ")}`;if(text.includes("arbalete"))return["carreau","carreaux","bolt"];if(text.includes("arc"))return["fleche","fleches","arrow"];if(text.includes("fronde"))return["bille","billes","pierre","pierres","bullet"];return["munition","projectile","ammo"];}
function quantity(item){const s=item?.system??{},q=s.quantite??s.quantity??s.qty??s.nombre??s.nb??s.uses?.value??s.charges?.value;return q===undefined||q===null||q===""?"—":String(q);}
function quantityNumber(item,fallback=1){const q=quantity(item);return q==="—"?fallback:num(q,fallback);}
function equippedProjectile(actor,weapon){if(!usesProjectileInventory(actor)||!isPropelledWeapon(weapon))return null;const keys=projectileKeys(weapon).map(norm);const items=actor.items?.filter?.(i=>i.id!==weapon.id&&itemEquipped(i)&&keys.some(k=>norm(i.name).includes(k)||itemTags(i).some(t=>t.includes(k))))??[];return items.find(i=>quantity(i)!=="0")??items[0]??null;}
function damage(item){const s=item?.system??{};return s?.dégâts?.contre_moyen??s?.degats?.contre_moyen??s?.degats_moyen??s?.damage??s?.degats??s?.dmg??"—";}
function range(item){const s=item?.system??{};const p=[s.portee_courte??s.portee_short,s.portee_moyenne??s.portee_medium,s.portee_longue??s.portee_long].filter(v=>v!==undefined&&v!==null&&String(v)!=="");return p.length?p.join(" / "):"Contact";}
function weapons(actor){return actor?.items?.filter?.(i=>String(i.type??"").toLowerCase()==="arme"&&itemEquipped(i))??[];}

function sumPreparedTree(value){if(typeof value==="number"&&Number.isFinite(value))return Math.max(0,value);if(typeof value==="string")return Math.max(0,num(value,0));if(!value||typeof value!=="object")return 0;let total=0;for(const child of Object.values(value))total+=sumPreparedTree(child);return total;}
function preparedCount(sort){const f=sort?.flags?.add2e??{},s=sort?.system??{};const directValues=[sort?.getFlag?.("add2e","memorizedCount"),f.memorizedCount,f.preparedCount,s.memorizedCount,s.preparedCount,s.prepared,s.memorise,s.memorized,s.memorisation?.value,s.memorisation,s.slots?.prepared,s.slots?.value];let best=0;for(const v of directValues){const n=num(v,NaN);if(Number.isFinite(n)&&n>best)best=n;}best=Math.max(best,sumPreparedTree(sort?.getFlag?.("add2e","memorizedByList")),sumPreparedTree(f.memorizedByList),sumPreparedTree(f.preparedByList),sumPreparedTree(s.memorizedByList),sumPreparedTree(s.preparedByList));try{const n=Number(globalThis.add2eGetTotalMemorizedCount?.(sort));if(Number.isFinite(n)&&n>best)best=n;}catch(_e){}return Math.max(0,best);}
function isObjectPowerSpell(sort){const s=sort?.system??{};if(s.isPower===true||s.isObjectPower===true||s.sourceWeaponId||s.sourceItemId||s.powerIndex!==undefined)return true;try{return globalThis.add2eIsObjectMagicSpellForPreparation?.(sort)===true;}catch(_e){return false;}}
function spells(actor){return actor?.items?.filter?.(i=>String(i.type??"").toLowerCase()==="sort"&&!isObjectPowerSpell(i)&&preparedCount(i)>0)??[];}
function spellLevel(sort){return Math.max(0,num(sort?.system?.niveau??sort?.system?.level??sort?.system?.niveau_sort,0));}
function spellListLabel(sort){const s=sort?.system??{};const raw=[s.liste,s.list,s.spellList,s.classe,s.class,s.sourceClasse,s.casterClass,...arr(s.lists),...arr(s.listes),...arr(s.classes)].map(v=>String(v??"").trim()).find(Boolean)||"Mag";const n=norm(raw);if(n.includes("clerc")||n.includes("pretre")||n.includes("priest"))return"Clerc";if(n.includes("druid")||n.includes("druide"))return"Dru";if(n.includes("ranger"))return"Rng";if(n.includes("paladin"))return"Pal";if(n.includes("mag")||n.includes("wizard")||n.includes("mage"))return"Mag";return String(raw).slice(0,6);}
function spellGroupKey(sort){return`${spellListLabel(sort)}|${spellLevel(sort)}`;}
function spellComponents(sort){return String(sort?.system?.composantes??sort?.system?.components??sort?.system?.componentes??"—").trim()||"—";}
function materialComponentNames(sort){const s=sort?.system??{};const raw=s.composantsMateriels??s.composants_materiels??s.composantsMateriel??s.composantMateriel??s.composant_materiel??s.materiel??s.materialComponents??s.material_components??s.components?.material??s.components?.materials??s.composants;return arr(raw).flatMap(v=>typeof v==="string"?v.split(/[,;|\n]+/):[v?.name??v?.nom??v?.label??v?.itemName??v?.component??v?.composant??""]).map(v=>String(v??"").trim()).filter(Boolean);}
function actorHasComponent(actor,componentName){const wanted=norm(componentName);if(!wanted)return false;return!!actor?.items?.find?.(i=>{const q=quantityNumber(i,1);if(q<=0)return false;const n=norm(i.name??i.system?.nom??"");const tags=itemTags(i);const type=String(i.type??"").toLowerCase();const ok=type==="objet"||type==="equipment"||tags.some(t=>t.includes("composant")||t.includes("component"))||isContainerLike(i);return ok&&(n.includes(wanted)||wanted.includes(n)||tags.some(t=>t.includes(wanted)||wanted.includes(t)));});}
function spellComponentBadges(actor,sort){const base=`<span>Comp. ${esc(spellComponents(sort))}</span>`;const names=materialComponentNames(sort);const needsMaterial=/(^|[^a-z])m([^a-z]|$)/.test(norm(spellComponents(sort)))||names.length>0;if(!needsMaterial)return base;if(!names.length)return`${base}<span class="component-bad">M non détaillé</span>`;return`${base}${names.map(name=>`<span class="${actorHasComponent(actor,name)?"component-ok":"component-bad"}">${esc(name)}</span>`).join("")}`;}

function features(actor){if(typeof globalThis.add2eGetActorActivableClassFeatures==="function")return globalThis.add2eGetActorActivableClassFeatures(actor,{includeLocked:false})??[];return[];}
function effects(actor){const map=new Map();for(const e of arr(actor?.effects))if(e&&e.disabled!==true)map.set(e.id,e);return[...map.values()];}
function ability(actor,key){const direct=Number(actor?.system?.[key]);return Number.isFinite(direct)?direct:num(actor?.system?.[`${key}_base`],10);}
function savingThrows(actor){const lvl=Math.max(1,num(actor?.system?.niveau,1));const row=actor?.system?.details_classe?.progression?.[lvl-1];const values=arr(row?.savingThrows||actor?.system?.sauvegardes||actor?.system?.savingThrows||[]).map(v=>num(v,0));return values.length>=5?values.slice(0,5):[0,0,0,0,0];}
function hp(actor){return num(actor?.system?.pdv??actor?.system?.pv?.value??actor?.system?.hp?.value??actor?.system?.hp,0);}
function hpMax(actor){return num(actor?.system?.points_de_coup??actor?.system?.pv?.max??actor?.system?.hp?.max??actor?.system?.hpMax,hp(actor));}
function armorClass(actor){return actor?.system?.ca_total??actor?.system?.ca??actor?.system?.armorClass??actor?.system?.ac??"—";}
function thaco(actor){const direct=actor?.system?.thac0??actor?.system?.thaco??actor?.system?.combat?.thac0;if(direct!==undefined&&direct!==null&&direct!=="")return direct;const lvl=Math.max(1,num(actor?.system?.niveau,1));return actor?.system?.details_classe?.progression?.[lvl-1]?.thac0??20;}

function injectStyle(){document.getElementById(STYLE_ID)?.remove();const style=document.createElement("style");style.id=STYLE_ID;style.textContent=`#${HUD_ID}{position:fixed;z-index:100;right:auto!important;bottom:auto!important;min-width:420px;color:#f6e8bd;font-family:var(--font-primary,Signika,sans-serif);pointer-events:auto;user-select:none}#${HUD_ID}.collapsed .a2e-hud-panel{display:none!important}#${HUD_ID} .a2e-hud-shell{border:1px solid #8a611d;border-radius:14px;overflow:hidden;background:linear-gradient(145deg,rgba(32,25,16,.97),rgba(18,14,10,.96));box-shadow:0 8px 26px rgba(0,0,0,.48)}#${HUD_ID} .a2e-hud-panel{max-height:var(--a2e-hud-menu-max,360px);overflow:auto;padding:9px;border-bottom:1px solid rgba(184,137,36,.45);background:rgba(0,0,0,.13)}#${HUD_ID} section{display:none}#${HUD_ID} section.active{display:grid;gap:7px}#${HUD_ID} .a2e-hud-tabs{display:grid;grid-template-columns:repeat(6,1fr);background:rgba(0,0,0,.18);border-bottom:1px solid rgba(184,137,36,.45)}#${HUD_ID} .a2e-hud-tab{min-height:34px;border:0;border-right:1px solid rgba(184,137,36,.32);background:transparent;color:#d8bd78;font-size:.74em;font-weight:900;cursor:pointer}#${HUD_ID} .a2e-hud-tab.active{color:#211307;background:linear-gradient(180deg,#f0c66d,#c78d2e)}#${HUD_ID} .a2e-hud-header{display:grid;grid-template-columns:74px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:9px 10px;background:linear-gradient(180deg,rgba(78,48,18,.78),rgba(36,26,14,.62));cursor:move}#${HUD_ID} .portrait{width:64px;height:64px;border-radius:12px;object-fit:cover;border:2px solid #c4973f;background:#111}#${HUD_ID} .name{color:#fff4cf;font-size:1.12em;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#${HUD_ID} .sub{color:#d8bd78;font-size:.82em;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#${HUD_ID} .pills{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}#${HUD_ID} .pill{display:inline-flex;min-height:22px;padding:2px 7px;border:1px solid rgba(214,176,90,.75);border-radius:999px;background:rgba(255,244,201,.12);color:#fff0bd;font-size:.78em;font-weight:850}#${HUD_ID} .icon{width:30px;height:30px;border:1px solid rgba(214,176,90,.75);border-radius:9px;background:rgba(255,244,201,.12);color:#ffe4a1;cursor:pointer}#${HUD_ID} .resize{cursor:nwse-resize!important}#${HUD_ID} .row{display:grid;grid-template-columns:42px minmax(0,1fr);gap:8px;align-items:center;min-height:50px;padding:6px;border:1px solid rgba(214,176,90,.38);border-radius:10px;background:rgba(255,250,235,.07)}#${HUD_ID} .row.compact{grid-template-columns:minmax(0,1fr) auto;min-height:38px}#${HUD_ID} .row.effect-row{grid-template-columns:42px minmax(0,1fr) auto}#${HUD_ID} .row img{width:36px;height:36px;border-radius:7px;object-fit:cover;border:1px solid rgba(214,176,90,.65);background:rgba(0,0,0,.25)}#${HUD_ID} .img-act{width:38px;height:38px;padding:0;border:1px solid rgba(214,176,90,.75);border-radius:8px;background:rgba(0,0,0,.22);cursor:pointer;display:flex;align-items:center;justify-content:center}#${HUD_ID} .img-act:hover{filter:brightness(1.22)}#${HUD_ID} .img-act img{width:34px;height:34px;border:0;border-radius:7px}#${HUD_ID} .title{color:#fff4cf;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#${HUD_ID} .meta{display:flex;flex-wrap:wrap;gap:4px 8px;color:#c8ad6e;font-size:.76em;font-weight:750;margin-top:2px}#${HUD_ID} .component-ok{color:#b8ffb8;border:1px solid rgba(80,180,80,.55);background:rgba(35,100,35,.35);padding:1px 6px;border-radius:999px}#${HUD_ID} .component-bad{color:#ffb1a8;border:1px solid rgba(190,55,45,.62);background:rgba(110,25,20,.42);padding:1px 6px;border-radius:999px}#${HUD_ID} .ammo{display:inline-flex;align-items:center;gap:4px;color:#b8ffb8}#${HUD_ID} .ammo-missing{color:#ffb1a8}#${HUD_ID} .ammo-free{color:#ffe4a1;border:1px solid rgba(214,176,90,.4);border-radius:999px;padding:1px 6px;background:rgba(214,176,90,.12)}#${HUD_ID} .ammo img{width:18px;height:18px;border-radius:4px;border:1px solid rgba(214,176,90,.4)}#${HUD_ID} .act{min-width:78px;min-height:30px;padding:4px 9px;border:1px solid #d6b05a;border-radius:9px;background:linear-gradient(180deg,#fff0bd,#d6a345);color:#211307;font-size:.8em;font-weight:950;cursor:pointer;white-space:nowrap}#${HUD_ID} .danger{min-width:36px;width:36px;color:#ffd0c8;border-color:#b94735;background:linear-gradient(180deg,#7d241b,#42120d)}#${HUD_ID} .empty{padding:12px;border:1px dashed rgba(214,176,90,.45);border-radius:10px;color:#c8ad6e;font-style:italic;text-align:center}#${HUD_ID} .spell-layout{display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px}#${HUD_ID} .spell-levels{display:flex;flex-wrap:wrap;gap:6px;padding-bottom:2px;border-bottom:1px solid rgba(214,176,90,.28)}#${HUD_ID} .spell-level{min-height:30px;padding:5px 10px;border:1px solid rgba(214,176,90,.55);border-radius:999px;background:rgba(214,176,90,.12);color:#ffe4a1;font-weight:950;font-size:.82em;cursor:pointer}#${HUD_ID} .spell-level.active{background:linear-gradient(180deg,#f0c66d,#c78d2e);color:#211307}#${HUD_ID} .spell-list{display:grid;gap:6px;max-height:260px;overflow-y:auto;padding-right:3px}#${HUD_ID} .spell-list-title{color:#ffe4a1;font-weight:950;font-size:.82em;margin:0 0 2px 2px}#${HUD_ID} .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}#${HUD_ID} .cell{display:grid;grid-template-columns:38px minmax(0,1fr);gap:8px;align-items:center;min-height:48px;padding:8px;border-radius:12px;border:1px solid rgba(214,176,90,.38);background:rgba(255,250,235,.07)}#${HUD_ID} .cell b{display:block;color:#ffe4a1;font-size:1.32em;font-weight:950;line-height:1.05;text-shadow:0 1px 2px rgba(0,0,0,.45)}#${HUD_ID} .roll-icon{width:36px;height:36px;min-width:36px;padding:0;border-radius:10px;border:1px solid rgba(214,176,90,.65);background:rgba(255,244,201,.12);color:#ffe4a1;cursor:pointer}#${HUD_ID} .roll-icon:hover{filter:brightness(1.2)}#${HUD_ID} button,#${HUD_ID} [data-action],#${HUD_ID} [data-tab]{user-select:auto;touch-action:auto}`;document.head.appendChild(style);}

function weaponRows(actor){const rows=weapons(actor);if(!rows.length)return`<div class="empty">Aucune arme équipée.</div>`;return rows.map(i=>{const projectile=equippedProjectile(actor,i),propelled=isPropelledWeapon(i);const dmg=propelled&&projectile?`Dégâts projectile ${damage(projectile)}`:`Dégâts ${damage(i)}`;const ammo=propelled?(usesProjectileInventory(actor)?(projectile?`<span class="ammo"><img src="${esc(projectile.img||"icons/svg/target.svg")}" alt="">${esc(projectile.name)} ×${esc(quantity(projectile))}</span>`:`<span class="ammo-missing">Aucune munition équipée</span>`):`<span class="ammo-free">Munition PNJ non suivie</span>`):"";return`<div class="row"><button type="button" class="img-act" data-action="attack" data-item-id="${esc(i.id)}" title="Attaquer avec ${esc(i.name)}"><img src="${esc(i.img||"icons/svg/sword.svg")}" alt=""></button><div><div class="title">${esc(i.name)}</div><div class="meta"><span>${esc(dmg)}</span><span>Portée ${esc(range(i))}</span>${ammo}</div></div></div>`;}).join("");}
function spellRows(actor){const rows=spells(actor).sort((a,b)=>String(spellListLabel(a)).localeCompare(String(spellListLabel(b)))||spellLevel(a)-spellLevel(b)||String(a.name).localeCompare(String(b.name)));if(!rows.length)return`<div class="empty">Aucun sort mémorisé.</div>`;const groups=new Map();for(const s of rows){const key=spellGroupKey(s);if(!groups.has(key))groups.set(key,{key,label:spellListLabel(s),level:spellLevel(s),items:[]});groups.get(key).items.push(s);}const list=[...groups.values()];if(!selectedSpellGroup||!groups.has(selectedSpellGroup))selectedSpellGroup=list[0].key;const active=groups.get(selectedSpellGroup)??list[0];const buttons=list.map(g=>`<button type="button" class="spell-level ${g.key===active.key?"active":""}" data-action="select-spell-group" data-spell-group="${esc(g.key)}">${esc(g.label)} niv. ${esc(g.level||"—")} <span>${g.items.length}</span></button>`).join("");const spellsHtml=active.items.map(s=>`<div class="row"><button type="button" class="img-act" data-action="cast-spell" data-item-id="${esc(s.id)}" title="Lancer ${esc(s.name)}"><img src="${esc(s.img||"icons/svg/book.svg")}" alt=""></button><div><div class="title">${esc(s.name)}</div><div class="meta"><span>Mémorisé ${preparedCount(s)}</span>${spellComponentBadges(actor,s)}</div></div></div>`).join("");return`<div class="spell-layout"><div class="spell-levels">${buttons}</div><div class="spell-list"><div class="spell-list-title">${esc(active.label)} niveau ${esc(active.level||"—")}</div>${spellsHtml}</div></div>`;}
function featureRows(actor){const rows=features(actor);if(!rows.length)return`<div class="empty">Aucune capacité utilisable.</div>`;return rows.map((f,i)=>`<div class="row compact"><div><div class="title">${esc(globalThis.add2eFeatureName?.(f)||f.name||f.label||f.nom||`Capacité ${i+1}`)}</div><div class="meta"><span>Capacité de classe</span></div></div><button type="button" class="act" data-action="use-feature" data-feature-index="${i}">Utiliser</button></div>`).join("");}
function effectRows(actor){const rows=effects(actor);if(!rows.length)return`<div class="empty">Aucun effet actif.</div>`;return rows.map(e=>`<div class="row effect-row"><img src="${esc(e.img||e.icon||"icons/svg/aura.svg")}" alt=""><div><div class="title">${esc(e.name)}</div><div class="meta"><span>Effet actif</span></div></div><button type="button" class="act danger" data-action="remove-effect" data-effect-id="${esc(e.id)}"><i class="fas fa-trash"></i></button></div>`).join("");}
function saveRows(actor){const values=savingThrows(actor);return`<div class="grid">${SAVES.map((s,i)=>`<div class="cell"><button type="button" class="roll-icon" data-action="roll-save" data-save-index="${i}" title="Jet ${esc(s[1])}"><i class="fas ${s[2]}"></i></button><div><b>${esc(s[1])} ${esc(values[i]||"—")}</b></div></div>`).join("")}</div>`;}
function abilityRows(actor){return`<div class="grid">${CARACS.map(c=>`<div class="cell"><button type="button" class="roll-icon" data-action="roll-ability" data-ability="${c[0]}" title="Jet ${esc(c[1])}"><i class="fas ${c[3]}"></i></button><div><b>${c[1]} ${esc(ability(actor,c[0]))}</b></div></div>`).join("")}</div>`;}

function hudHtml(actor,token=null){const img=token?.document?.texture?.src||actor.img||"icons/svg/mystery-man.svg";const isMonster=isMonsterActor(actor);const race=isMonster?(actor.system?.type??"Monstre"):(actor.system?.race||actor.system?.details_race?.label||actor.items?.find?.(i=>i.type==="race")?.name||"Race");const classe=isMonster?(actor.system?.taille??actor.system?.size??"MJ"):(actor.system?.classe||actor.system?.details_classe?.label||actor.items?.find?.(i=>i.type==="classe")?.name||"Classe");const niveau=isMonster?(actor.system?.dv??actor.system?.hitDice??actor.system?.niveau??"—"):(actor.system?.niveau??"—");const tab=(key,icon,label)=>`<button type="button" class="a2e-hud-tab ${activeTab===key?"active":""}" data-tab="${key}"><i class="${icon}"></i> ${label}</button>`;const section=(key,html)=>`<section class="${activeTab===key?"active":""}" data-section="${key}">${html}</section>`;return`<div class="a2e-hud-shell"><div class="a2e-hud-panel">${section("attaques",weaponRows(actor))}${section("sorts",spellRows(actor))}${section("capacites",featureRows(actor))}${section("effets",effectRows(actor))}${section("sauvegardes",saveRows(actor))}${section("caracs",abilityRows(actor))}</div><nav class="a2e-hud-tabs">${tab("attaques","fas fa-swords","Armes")}${tab("sorts","fas fa-book","Sorts")}${tab("capacites","fas fa-bolt","Capacités")}${tab("effets","fas fa-hourglass-half","Effets")}${tab("sauvegardes","fas fa-shield-alt","Sauv.")}${tab("caracs","fas fa-dice-d20","Carac.")}</nav><div class="a2e-hud-header" data-drag-handle="1"><img class="portrait" src="${esc(img)}" alt=""><div><div class="name">${esc(actor.name)}</div><div class="sub">${esc(race)} — ${esc(classe)} ${isMonster?"DV":"niv."} ${esc(niveau)}</div><div class="pills"><span class="pill">PV ${hp(actor)} / ${hpMax(actor)}</span><span class="pill">CA ${esc(armorClass(actor))}</span><span class="pill">THAC0 ${esc(thaco(actor))}</span></div></div><button type="button" class="icon" data-action="toggle-collapse"><i class="fas fa-chevron-down"></i></button><button type="button" class="icon resize" data-resize-handle="1"><i class="fas fa-up-right-and-down-left-from-center"></i></button></div></div>`;}
function renderHud(actor=null,token=null,{reason="render"}={}){if(dragging||resizing)return false;injectStyle();const existing=hud();if(!relevant(actor)){existing?.remove();hudActor=null;hudToken=null;return false;}hudActor=actor;hudToken=token??tokenFor(actor);if(!TABS.includes(activeTab))activeTab="attaques";const el=existing??document.createElement("div");el.id=HUD_ID;el.innerHTML=hudHtml(actor,hudToken);if(!existing)document.body.appendChild(el);el.classList.toggle("collapsed",loadState().collapsed===true);applyGeometry(el,true);bindHudEvents(el,actor);console.log(`${TAG}[RENDER]`,{version:ADD2E_ACTION_HUD_VERSION,reason,actor:actor.name,actorId:actor.id,activeTab});return true;}
function refreshHud(reason="refresh"){const token=canvas?.tokens?.controlled?.[0]??null;return renderHud(token?.actor??game.user?.character??null,token,{reason});}
function closeHud(){hud()?.remove();hudActor=null;hudToken=null;}
function bindHudEvents(el,actor){el.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",ev=>{ev.preventDefault();ev.stopPropagation();const next=btn.dataset.tab||"attaques";if(activeTab===next&&!el.classList.contains("collapsed"))return setCollapsed(true,true);activeTab=next;renderHud(actor,tokenFor(actor),{reason:"tab"});setCollapsed(false,true);}));el.querySelectorAll("[data-action]").forEach(btn=>btn.addEventListener("click",ev=>handleAction(ev,actor,btn)));}
async function handleAction(ev,actor,btn){ev.preventDefault();ev.stopPropagation();const action=btn.dataset.action;try{if(action==="toggle-collapse")return setCollapsed(!hud()?.classList.contains("collapsed"),true);if(action==="select-spell-group"){selectedSpellGroup=btn.dataset.spellGroup||selectedSpellGroup;return renderHud(actor,tokenFor(actor),{reason:"select-spell-group"});}if(action==="attack")return sheetAttack(actor,btn.dataset.itemId);if(action==="cast-spell")return sheetCastSpell(actor,btn.dataset.itemId);if(action==="use-feature")return sheetUseFeature(actor,Number(btn.dataset.featureIndex));if(action==="remove-effect")return removeEffect(actor,btn.dataset.effectId);if(action==="roll-save")return sheetRollSave(actor,Number(btn.dataset.saveIndex));if(action==="roll-ability")return sheetRollAbility(actor,btn.dataset.ability);}catch(err){console.error(`${TAG}[ACTION_ERROR]`,{action,err});ui.notifications.error(`ADD2E HUD | Erreur action ${action}`);}}
async function sheetAttack(actor,itemId){const arme=actor?.items?.get?.(itemId);if(!arme)return ui.notifications.warn("Arme introuvable.");if(typeof globalThis.add2eAttackRoll!=="function")return ui.notifications.error("Fonction add2eAttackRoll introuvable.");return globalThis.add2eAttackRoll({actor,arme});}
async function sheetCastSpell(actor,itemId){const sort=actor?.items?.get?.(itemId);if(!sort)return ui.notifications.warn("Sort introuvable.");if(typeof globalThis.add2eCastSpell!=="function")return ui.notifications.error("Fonction add2eCastSpell introuvable.");return globalThis.add2eCastSpell({actor,sort});}
async function sheetRollAbility(actor,carac){if(typeof globalThis.add2eRollCharacteristicCard!=="function")return ui.notifications.error("Fonction add2eRollCharacteristicCard introuvable.");return globalThis.add2eRollCharacteristicCard(actor,carac);}
async function sheetRollSave(actor,idx){if(typeof globalThis.add2eRollSaveCard!=="function")return ui.notifications.error("Fonction add2eRollSaveCard introuvable.");return globalThis.add2eRollSaveCard(actor,idx);}
async function sheetUseFeature(actor,index){const feature=features(actor)[index];if(!feature)return ui.notifications.warn("Capacité introuvable.");if(typeof globalThis.add2eExecuteClassFeatureOnUse!=="function")return ui.notifications.error("Fonction add2eExecuteClassFeatureOnUse introuvable.");return globalThis.add2eExecuteClassFeatureOnUse(actor,feature,null);}
async function removeEffect(actor,effectId){const effect=actor?.effects?.get?.(effectId);if(!effect)return ui.notifications.warn("Effet introuvable.");const DialogV2=foundry?.applications?.api?.DialogV2;const ok=DialogV2?.confirm?await DialogV2.confirm({window:{title:"Supprimer l'effet"},content:`<p>Supprimer <strong>${esc(effect.name)}</strong> ?</p>`,yes:{label:"Supprimer",icon:"fas fa-trash"},no:{label:"Annuler"}}):true;if(!ok)return false;await actor.deleteEmbeddedDocuments("ActiveEffect",[effect.id]);return renderHud(actor,hudToken,{reason:"remove-effect"});}

function primary(ev){return ev.button===undefined||ev.button===0;}
function startResize(ev){const handle=ev.target?.closest?.("[data-resize-handle]"),el=ev.target?.closest?.(`#${HUD_ID}`);if(!handle||!el||!primary(ev))return false;ev.preventDefault();ev.stopPropagation();resizing=true;const moveEvent=ev.type==="mousedown"?"mousemove":"pointermove",upEvent=ev.type==="mousedown"?"mouseup":"pointerup";const startState=loadState();const start={x:ev.clientX,y:ev.clientY,width:startState.width,maxMenuHeight:startState.maxMenuHeight,left:startState.left,top:startState.top};const move=e=>{const s=loadState();s.width=clamp(start.width+e.clientX-start.x,420,Math.max(440,window.innerWidth-start.left-8));s.maxMenuHeight=clamp(start.maxMenuHeight+e.clientY-start.y,140,Math.max(160,window.innerHeight-start.top-48));applyGeometry(el,true);};const up=()=>{window.removeEventListener(moveEvent,move,true);window.removeEventListener(upEvent,up,true);resizing=false;const s=loadState();saveState({width:el.offsetWidth||s.width,maxMenuHeight:s.maxMenuHeight,left:s.left,top:s.top});applyGeometry(el,true);};window.addEventListener(moveEvent,move,true);window.addEventListener(upEvent,up,true);return true;}
function startDrag(ev){const el=ev.target?.closest?.(`#${HUD_ID}`),handle=ev.target?.closest?.("[data-drag-handle]");if(!el||!handle||!primary(ev)||ev.target.closest?.("button,a,input,select,textarea,[data-action],[data-tab],[data-resize-handle]"))return false;ev.preventDefault();ev.stopPropagation();dragging=true;const moveEvent=ev.type==="mousedown"?"mousemove":"pointermove",upEvent=ev.type==="mousedown"?"mouseup":"pointerup";const s0=loadState();const start={x:ev.clientX,y:ev.clientY,left:s0.left,top:s0.top};console.log(`${TAG}[DRAG_START]`,{version:ADD2E_ACTION_HUD_VERSION,eventType:ev.type,left:start.left,top:start.top});const move=e=>{const s=loadState();const width=el.offsetWidth||s.width,height=el.offsetHeight||110;s.left=clamp(start.left+e.clientX-start.x,8,Math.max(8,window.innerWidth-width-8));s.top=clamp(start.top+e.clientY-start.y,8,Math.max(8,window.innerHeight-Math.min(height,48)));applyGeometry(el,true);saveState({left:Math.round(s.left),top:Math.round(s.top),bottom:null});};const up=()=>{window.removeEventListener(moveEvent,move,true);window.removeEventListener(upEvent,up,true);dragging=false;applyGeometry(el,true);};window.addEventListener(moveEvent,move,true);window.addEventListener(upEvent,up,true);return true;}
function pointerDown(ev){if(startResize(ev))return;startDrag(ev);}
function currentCombatant(combat=game.combat){if(!combat)return null;const id=combat.current?.combatantId??combat.combatantId??null;return(id?combat.combatants?.get?.(id):null)??combat.combatant??combat.turns?.[Number(combat.current?.turn??combat.turn)]??null;}
function tokenFromCombatant(c){return c?.token?.object??(c?.tokenId?canvas?.tokens?.get?.(c.tokenId):null)??null;}
function followCombat(combat=game.combat,forceOpen=false){if(Date.now()<manualIntentUntil)return false;const c=currentCombatant(combat);if(!c?.actor||(!forceOpen&&!hud()))return false;return renderHud(c.actor,tokenFromCombatant(c),{reason:"combat"});}

Hooks.once("init",()=>{game.add2e=game.add2e??{};game.add2e.actionHudVersion=ADD2E_ACTION_HUD_VERSION;game.add2e.openActionHud=(actor=null)=>{const token=canvas?.tokens?.controlled?.[0]??null;return renderHud(actor??token?.actor??game.user?.character,actor?tokenFor(actor):token,{reason:"api-open"});};game.add2e.closeActionHud=closeHud;game.add2e.refreshActionHud=()=>hudActor?renderHud(hudActor,hudToken,{reason:"api-refresh-current"}):refreshHud("api-refresh");Object.assign(globalThis,{add2eRenderActionHud:renderHud,add2eRefreshActionHud:refreshHud,add2eCloseActionHud:closeHud,add2eHudCheck:()=>({version:ADD2E_ACTION_HUD_VERSION,actor:currentActor()?.name??null,actorId:currentActor()?.id??null,activeTab,selectedSpellGroup,attackRoll:typeof globalThis.add2eAttackRoll,castSpell:typeof globalThis.add2eCastSpell,rollCarac:typeof globalThis.add2eRollCharacteristicCard,rollSave:typeof globalThis.add2eRollSaveCard,featureUse:typeof globalThis.add2eExecuteClassFeatureOnUse,hud:!!hud()})});console.log(`${TAG}[INIT]`,ADD2E_ACTION_HUD_VERSION);});
Hooks.once("ready",()=>{document.addEventListener("pointerdown",pointerDown,true);document.addEventListener("mousedown",pointerDown,true);window.addEventListener("resize",()=>applyGeometry(hud(),true));setTimeout(()=>refreshHud("ready"),300);});
Hooks.on("controlToken",()=>{manualIntentUntil=Date.now()+500;setTimeout(()=>refreshHud("controlToken"),60);});
Hooks.on("canvasReady",()=>setTimeout(()=>refreshHud("canvasReady"),150));
Hooks.on("updateCombat",combat=>setTimeout(()=>followCombat(combat,false),80));
Hooks.on("combatTurn",combat=>setTimeout(()=>followCombat(combat,false),80));
Hooks.on("combatRound",combat=>setTimeout(()=>followCombat(combat,false),80));
Hooks.on("updateActor",actor=>{if(actor?.id===hudActor?.id&&!dragging&&!resizing)setTimeout(()=>renderHud(actor,hudToken,{reason:"updateActor"}),80);});
for(const hookName of["createItem","updateItem","deleteItem","createActiveEffect","updateActiveEffect","deleteActiveEffect"])Hooks.on(hookName,doc=>{const actor=doc?.parent;if(actor?.id===hudActor?.id&&!dragging&&!resizing)setTimeout(()=>renderHud(actor,hudToken,{reason:hookName}),80);});

export{renderHud as add2eRenderActionHud,refreshHud as add2eRefreshActionHud,closeHud as add2eCloseActionHud};
>>>>>>> 3de7e039a4779c6b7a3f9a95f22618004cb090d3
