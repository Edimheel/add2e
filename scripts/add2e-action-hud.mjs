// scripts/add2e-action-hud.mjs
// ADD2E — HUD d'action rapide sans ouvrir la fiche personnage
// Version : 2026-05-16-v5-move-resize
//
// Règle : le HUD ne réinvente pas les actions.
// - Attaque  -> globalThis.add2eAttackRoll({ actor, arme })
// - Sort     -> globalThis.add2eCastSpell({ actor, sort })
// - Capacité -> globalThis.add2eExecuteClassFeatureOnUse(actor, feature)
// - Carac / sauvegarde : même mécanique et même carte chat que la fiche personnage.

const ADD2E_ACTION_HUD_VERSION = "2026-05-16-v5-move-resize";
const TAG = "[ADD2E][ACTION_HUD]";
const HUD_ID = "add2e-action-hud";
const STYLE_ID = "add2e-action-hud-style";
const STORAGE_KEY = "add2e.actionHud.layout.v1";

let add2eHudActorId = null;
let add2eHudActiveTab = null;
let add2eHudCollapsed = false;
let add2eHudLayout = null;

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
  try {
    return foundry.utils.escapeHTML(String(value ?? ""));
  } catch (_e) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
}

function add2eHudArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return Object.values(value);
  return [value];
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

function add2eHudClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function add2eHudLoadLayout() {
  if (add2eHudLayout) return add2eHudLayout;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    add2eHudLayout = raw ? JSON.parse(raw) : {};
  } catch (_e) {
    add2eHudLayout = {};
  }
  return add2eHudLayout;
}

function add2eHudSaveLayout() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(add2eHudLayout ?? {}));
  } catch (_e) {}
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
    add2eHudLayout.left = left;
    add2eHudLayout.top = top;
    add2eHudLayout.width = width;
    add2eHudLayout.menuHeight = menuHeight;
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

function add2eHudIsEquipped(item) {
  const s = item?.system ?? {};
  return Boolean(s.equipee ?? s.equipped ?? s.estEquipee);
}

function add2eHudWeapons(actor) {
  return actor?.items?.filter?.(i => i.type === "arme" && add2eHudIsEquipped(i)) ?? [];
}

function add2eHudPreparedCount(sort) {
  return add2eHudNumber(
    sort?.getFlag?.("add2e", "memorizedCount") ??
    sort?.flags?.add2e?.memorizedCount ??
    sort?.system?.memorizedCount ??
    sort?.system?.prepared ??
    0,
    0
  );
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
    #${HUD_ID} {
      position: fixed;
      left: 116px;
      bottom: 22px;
      width: 760px;
      max-width: calc(100vw - 24px);
      min-width: 520px;
      z-index: 80;
      color: #f6e8bd;
      font-family: var(--font-primary, Signika, sans-serif);
      pointer-events: auto;
      user-select: none;
    }
    #${HUD_ID}.a2e-hud-dragging, #${HUD_ID}.a2e-hud-resizing { transition: none !important; }
    #${HUD_ID}.collapsed .a2e-hud-tabs, #${HUD_ID}.collapsed .a2e-hud-body { display: none; }
    #${HUD_ID} .a2e-hud-shell {
      position: relative;
      border: 1px solid #8a611d;
      border-radius: 14px;
      overflow: visible;
      background: radial-gradient(circle at 15% 0%, rgba(213,147,45,.28), transparent 36%), linear-gradient(145deg, rgba(32,25,16,.97), rgba(18,14,10,.96));
      box-shadow: 0 8px 26px rgba(0,0,0,.48), inset 0 0 0 1px rgba(255,230,160,.12);
      backdrop-filter: blur(3px);
    }
    #${HUD_ID} .a2e-hud-header {
      display: grid;
      grid-template-columns: 88px minmax(0, 1fr) 70px;
      gap: 8px;
      align-items: center;
      min-height: 86px;
      padding: 5px 8px;
      border-bottom: 1px solid rgba(184,137,36,.55);
      border-radius: 14px 14px 0 0;
      background: linear-gradient(180deg, rgba(78,48,18,.78), rgba(36,26,14,.62));
    }
    #${HUD_ID} .a2e-hud-drag-zone { cursor: move; }
    #${HUD_ID} .a2e-hud-portrait {
      width: 78px;
      height: 78px;
      align-self: center;
      border-radius: 10px;
      object-fit: cover;
      border: 2px solid #c4973f;
      background: #111;
      box-shadow: 0 2px 8px rgba(0,0,0,.45);
    }
    #${HUD_ID} .a2e-hud-main {
      min-width: 0;
      overflow: visible;
      display: grid;
      grid-template-columns: minmax(180px, 1fr) max-content;
      grid-template-rows: 24px 24px;
      column-gap: 12px;
      row-gap: 0;
      align-items: center;
      align-content: center;
    }
    #${HUD_ID} .a2e-hud-name {
      grid-column: 1;
      grid-row: 1;
      color: #fff4cf;
      font-size: 1.08em;
      font-weight: 900;
      line-height: 1.1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
    #${HUD_ID} .a2e-hud-subtitle {
      grid-column: 1;
      grid-row: 2;
      color: #d8bd78;
      font-size: .82em;
      font-weight: 750;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
    #${HUD_ID} .a2e-hud-metrics {
      grid-column: 2;
      grid-row: 1 / span 2;
      display: grid;
      grid-template-columns: max-content max-content max-content;
      gap: 5px;
      align-items: center;
      justify-content: end;
      width: max-content;
      max-width: none;
      overflow: visible;
      white-space: nowrap;
      flex-wrap: nowrap;
    }
    #${HUD_ID} .a2e-hud-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 24px;
      min-width: 0;
      max-width: none;
      padding: 1px 8px;
      border: 1px solid rgba(214,176,90,.75);
      border-radius: 999px;
      background: rgba(255,244,201,.12);
      color: #fff0bd;
      font-size: .76em;
      line-height: 1;
      font-weight: 900;
      white-space: nowrap;
      flex: 0 0 auto;
    }
    #${HUD_ID} .a2e-hud-controls {
      display: grid;
      grid-template-columns: 30px 30px;
      gap: 5px;
      justify-content: end;
      align-items: center;
    }
    #${HUD_ID} .a2e-hud-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: 1px solid rgba(214,176,90,.75);
      border-radius: 9px;
      background: rgba(255,244,201,.12);
      color: #ffe4a1;
      cursor: pointer;
    }
    #${HUD_ID} .a2e-hud-tabs {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      border-radius: 0 0 14px 14px;
      overflow: hidden;
      background: rgba(0,0,0,.22);
    }
    #${HUD_ID} .a2e-hud-tab {
      min-height: 34px;
      border: 0;
      border-right: 1px solid rgba(184,137,36,.32);
      background: transparent;
      color: #d8bd78;
      font-size: .78em;
      font-weight: 900;
      cursor: pointer;
    }
    #${HUD_ID} .a2e-hud-tab:last-child { border-right: 0; }
    #${HUD_ID} .a2e-hud-tab.active { color: #211307; background: linear-gradient(180deg,#f0c66d,#c78d2e); }
    #${HUD_ID} .a2e-hud-body {
      position: absolute;
      left: 0;
      right: 0;
      bottom: calc(100% + 8px);
      max-height: var(--a2e-hud-menu-height, 360px);
      overflow-y: auto;
      padding: 9px;
      border: 1px solid #8a611d;
      border-radius: 14px;
      background: radial-gradient(circle at 20% 0%, rgba(213,147,45,.24), transparent 34%), linear-gradient(145deg, rgba(28,22,15,.98), rgba(12,10,8,.97));
      box-shadow: 0 8px 24px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,230,160,.10);
    }
    #${HUD_ID} .a2e-hud-body:after {
      content: "";
      position: absolute;
      left: 50%;
      bottom: -8px;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 9px solid transparent;
      border-right: 9px solid transparent;
      border-top: 9px solid #8a611d;
    }
    #${HUD_ID} .a2e-hud-section { display: none; }
    #${HUD_ID} .a2e-hud-section.active { display: grid; gap: 7px; }
    #${HUD_ID} .a2e-hud-row {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      min-height: 48px;
      padding: 6px;
      border: 1px solid rgba(214,176,90,.38);
      border-radius: 10px;
      background: rgba(255,250,235,.07);
      user-select: text;
    }
    #${HUD_ID} .a2e-hud-row.compact { grid-template-columns: minmax(0, 1fr) auto; min-height: 38px; }
    #${HUD_ID} .a2e-hud-row img { width: 34px; height: 34px; border-radius: 7px; object-fit: cover; border: 1px solid rgba(214,176,90,.65); background: rgba(0,0,0,.25); }
    #${HUD_ID} .a2e-hud-row-title { color: #fff4cf; font-weight: 900; line-height: 1.08; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #${HUD_ID} .a2e-hud-row-meta { display: flex; flex-wrap: wrap; gap: 4px 8px; color: #c8ad6e; font-size: .76em; font-weight: 750; margin-top: 2px; }
    #${HUD_ID} .a2e-hud-action {
      min-width: 78px;
      min-height: 30px;
      padding: 4px 9px;
      border: 1px solid #d6b05a;
      border-radius: 9px;
      background: linear-gradient(180deg,#fff0bd,#d6a345);
      color: #211307;
      font-size: .8em;
      font-weight: 950;
      cursor: pointer;
      white-space: nowrap;
    }
    #${HUD_ID} .a2e-hud-action:disabled { opacity: .45; cursor: not-allowed; }
    #${HUD_ID} .a2e-hud-icon-btn:hover, #${HUD_ID} .a2e-hud-action:hover, #${HUD_ID} .a2e-hud-tab:hover { filter: brightness(1.15); transform: translateY(-1px); }
    #${HUD_ID} .a2e-hud-empty { padding: 12px; border: 1px dashed rgba(214,176,90,.45); border-radius: 10px; color: #c8ad6e; font-style: italic; text-align: center; }
    #${HUD_ID} .a2e-hud-ability-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
    #${HUD_ID} .a2e-hud-ability { display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center; padding: 7px; border: 1px solid rgba(214,176,90,.38); border-radius: 10px; background: rgba(255,250,235,.07); }
    #${HUD_ID} .a2e-hud-ability b { color:#fff4cf;font-size:1.15em; }
    #${HUD_ID} .a2e-hud-ability span { display:block;color:#c8ad6e;font-size:.76em;font-weight:800; }
    #${HUD_ID} .a2e-hud-resize {
      position: absolute;
      right: 4px;
      top: -11px;
      width: 18px;
      height: 18px;
      border: 1px solid rgba(214,176,90,.8);
      border-radius: 5px;
      background: rgba(20,14,8,.92);
      color: #ffe4a1;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: nwse-resize;
      font-size: 10px;
      z-index: 3;
    }
    @media (max-width: 900px) {
      #${HUD_ID} { left: 12px; right: 12px; width: calc(100vw - 24px); max-width: calc(100vw - 24px); min-width: 0; }
      #${HUD_ID} .a2e-hud-main { grid-template-columns: minmax(140px, 1fr) max-content; column-gap: 8px; }
      #${HUD_ID} .a2e-hud-pill { padding: 1px 6px; font-size: .72em; }
    }
    @media (max-width: 680px) {
      #${HUD_ID} .a2e-hud-header { grid-template-columns: 74px minmax(0,1fr) 64px; }
      #${HUD_ID} .a2e-hud-portrait { width:66px; height:66px; }
      #${HUD_ID} .a2e-hud-main { grid-template-columns: 1fr; grid-template-rows: 21px 19px 24px; }
      #${HUD_ID} .a2e-hud-metrics { grid-column: 1; grid-row: 3; justify-content: start; }
      #${HUD_ID} .a2e-hud-ability-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `;
  document.head.appendChild(style);
}

function add2eHudWeaponRows(actor) {
  const weapons = add2eHudWeapons(actor);
  if (!weapons.length) return `<div class="a2e-hud-empty">Aucune arme équipée.</div>`;
  return weapons.map(arme => {
    const id = add2eHudEscape(arme.id);
    const name = add2eHudEscape(arme.name);
    const img = add2eHudEscape(arme.img || "icons/svg/sword.svg");
    return `
      <div class="a2e-hud-row" data-item-id="${id}">
        <img src="${img}" alt="${name}">
        <div>
          <div class="a2e-hud-row-title">${name}</div>
          <div class="a2e-hud-row-meta"><span>Équipée</span><span>Dégâts ${add2eHudEscape(add2eHudDamageText(arme))}</span><span>Portée ${add2eHudEscape(add2eHudRangeText(arme))}</span></div>
        </div>
        <button type="button" class="a2e-hud-action" data-action="attack" data-item-id="${id}">Attaquer</button>
      </div>
    `;
  }).join("");
}

function add2eHudSpellRows(actor) {
  const spells = add2eHudSpells(actor);
  if (!spells.length) return `<div class="a2e-hud-empty">Aucun sort mémorisé.</div>`;
  return spells.map(sort => {
    const id = add2eHudEscape(sort.id);
    const name = add2eHudEscape(sort.name);
    const img = add2eHudEscape(sort.img || "icons/svg/book.svg");
    const niv = add2eHudEscape(sort.system?.niveau ?? sort.system?.level ?? "—");
    const school = add2eHudEscape(sort.system?.école ?? sort.system?.ecole ?? "");
    const prepared = add2eHudPreparedCount(sort);
    return `
      <div class="a2e-hud-row" data-item-id="${id}">
        <img src="${img}" alt="${name}">
        <div>
          <div class="a2e-hud-row-title">${name}</div>
          <div class="a2e-hud-row-meta"><span>Niv. ${niv}</span>${school ? `<span>${school}</span>` : ""}<span>Mémorisé ${prepared}</span></div>
        </div>
        <button type="button" class="a2e-hud-action" data-action="cast-spell" data-item-id="${id}">Lancer</button>
      </div>
    `;
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
    return `
      <div class="a2e-hud-row compact" data-feature-index="${idx}">
        <div>
          <div class="a2e-hud-row-title">${name}</div>
          <div class="a2e-hud-row-meta">${locked ? `<span>Niveau requis ${min}${max !== 999 ? `-${max}` : ""}</span>` : `<span>Disponible</span>`}${uses ? `<span>${uses}</span>` : ""}</div>
        </div>
        <button type="button" class="a2e-hud-action" data-action="use-feature" data-feature-index="${idx}" ${locked ? "disabled" : ""}>Utiliser</button>
      </div>
    `;
  }).join("");
}

function add2eHudSaveRows(actor) {
  const saves = add2eHudSavingThrows(actor);
  return ADD2E_HUD_SAVE_FULL_NAMES.map((label, idx) => {
    const value = saves[idx] || "—";
    return `
      <div class="a2e-hud-row compact">
        <div><div class="a2e-hud-row-title">${add2eHudEscape(label)}</div><div class="a2e-hud-row-meta"><span>Seuil ${add2eHudEscape(value)} ou plus</span></div></div>
        <button type="button" class="a2e-hud-action" data-action="roll-save" data-save-index="${idx}">Jet</button>
      </div>
    `;
  }).join("");
}

function add2eHudAbilityRows(actor) {
  return `<div class="a2e-hud-ability-grid">${ADD2E_HUD_CARACS.map(carac => {
    const value = add2eHudAbilityValue(actor, carac.key);
    return `
      <div class="a2e-hud-ability">
        <div><b>${carac.label} ${value}</b><span>${add2eHudEscape(carac.title)}</span></div>
        <button type="button" class="a2e-hud-action" data-action="roll-ability" data-ability="${carac.key}">Jet</button>
      </div>
    `;
  }).join("")}</div>`;
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
  const body = add2eHudActiveTab ? `
    <div class="a2e-hud-body">
      ${section("attaques", add2eHudWeaponRows(actor))}
      ${section("sorts", add2eHudSpellRows(actor))}
      ${section("capacites", add2eHudFeatureRows(actor))}
      ${section("sauvegardes", add2eHudSaveRows(actor))}
      ${section("caracs", add2eHudAbilityRows(actor))}
    </div>` : "";

  return `
    <div class="a2e-hud-shell">
      ${body}
      <div class="a2e-hud-resize" data-resize-hud="1" title="Redimensionner le HUD"><i class="fas fa-up-right-and-down-left-from-center"></i></div>
      <div class="a2e-hud-header">
        <img class="a2e-hud-portrait a2e-hud-drag-zone" src="${add2eHudEscape(img)}" alt="${add2eHudEscape(actor.name)}" title="Glisser pour déplacer">
        <div class="a2e-hud-main a2e-hud-drag-zone" title="Glisser pour déplacer — double-clic pour réinitialiser">
          <div class="a2e-hud-name">${add2eHudEscape(actor.name)}</div>
          <div class="a2e-hud-subtitle">${add2eHudEscape(race)} — ${add2eHudEscape(classe)} niv. ${add2eHudEscape(niveau)}</div>
          <div class="a2e-hud-metrics">
            <span class="a2e-hud-pill">PV ${add2eHudHp(actor)} / ${add2eHudHpMax(actor)}</span>
            <span class="a2e-hud-pill">CA ${add2eHudEscape(ac)}</span>
            <span class="a2e-hud-pill">THAC0 ${add2eHudEscape(thaco)}</span>
          </div>
        </div>
        <div class="a2e-hud-controls">
          <button type="button" class="a2e-hud-icon-btn" data-action="reset-layout" title="Réinitialiser position/taille"><i class="fas fa-crosshairs"></i></button>
          <button type="button" class="a2e-hud-icon-btn" data-action="toggle-collapse" title="Réduire / agrandir"><i class="fas fa-chevron-down"></i></button>
        </div>
      </div>
      <nav class="a2e-hud-tabs">
        ${tab("attaques", "fas fa-swords", "Attaques")}
        ${tab("sorts", "fas fa-book", "Sorts")}
        ${tab("capacites", "fas fa-bolt", "Capacités")}
        ${tab("sauvegardes", "fas fa-shield-alt", "Sauv.")}
        ${tab("caracs", "fas fa-dice-d20", "Carac.")}
      </nav>
    </div>`;
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
      try {
        if (action === "reset-layout") return add2eHudResetLayout();
        if (action === "toggle-collapse") {
          add2eHudCollapsed = !add2eHudCollapsed;
          if (add2eHudCollapsed) add2eHudActiveTab = null;
          add2eRefreshActionHud();
          return;
        }
        if (action === "attack") return add2eHudAttack(actor, btn.dataset.itemId);
        if (action === "cast-spell") return add2eHudCastSpell(actor, btn.dataset.itemId);
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
  hud.querySelector(".a2e-hud-drag-zone")?.addEventListener("dblclick", ev => {
    ev.preventDefault();
    add2eHudResetLayout();
  });
}

function add2eBindHudDragHandle(hud, handle) {
  handle.addEventListener("pointerdown", ev => {
    if (ev.button !== 0) return;
    if (ev.target.closest?.("button, a, input, select, textarea, [data-action], [data-resize-hud]")) return;

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

    add2eHudLayout = {
      ...(add2eHudLoadLayout() ?? {}),
      left,
      top: hud.getBoundingClientRect().top,
      width: Math.round(width),
      menuHeight: Math.round(menuHeight)
    };
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

async function add2eHudCastSpell(actor, itemId) {
  const sort = add2eHudFindItem(actor, itemId);
  if (!sort) return ui.notifications.warn("Sort introuvable.");
  if (typeof globalThis.add2eCastSpell !== "function") {
    ui.notifications.error("Fonction add2eCastSpell introuvable.");
    console.warn(`${TAG}[MISSING] add2eCastSpell`);
    return;
  }
  return globalThis.add2eCastSpell({ actor, sort });
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
  const caracIcon = data?.icon || "fa-dice-d20";
  const caracColor = data?.color || "#6c4e95";
  const reussite = roll.total <= val;
  const htmlCard = `
    <div class="add2e-card-test" style="border-radius:13px; box-shadow:0 2px 10px #b5e7c388; background:linear-gradient(100deg,#f9fcfa 90%,#e4fbf1 100%); border:1.4px solid ${caracColor}; max-width:420px; padding:0.85em 1.1em 0.8em 1.1em; font-family: var(--font-primary);">
      <div style="display:flex; align-items:center; gap:0.7em; margin-bottom:0.5em;"><i class="fas ${caracIcon}" style="font-size:2em;color:${caracColor};"></i><span style="font-size:1.17em; font-weight:bold; color:${caracColor};">${label}</span><span style="margin-left:auto; font-size:1em; font-weight:500; color:#666;">Test de caractéristique</span></div>
      <div style="font-size:1.11em; margin-bottom:0.25em;">Seuil&nbsp;: <b>${val}</b>&nbsp;&nbsp;|&nbsp;&nbsp;Résultat&nbsp;: <b>${roll.total}</b></div>
      <div style="margin:0.2em 0 0.1em 0; font-size:1.1em;"><span style="font-weight:600; color:${reussite ? "#1cb360" : "#c34040"};">${reussite ? "✔️ Réussite" : "❌ Échec"}</span></div>
    </div>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: htmlCard });
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
    try {
      const analyse = Add2eEffectsEngine.analyze?.(actor, { type: "save", vsType: nom, frontale: true }) ?? {};
      bonusSave = Number(analyse.bonus_save || 0);
    } catch (e) {
      console.warn("[ADD2E][SAVE] Erreur analyse effets de sauvegarde", e);
    }
  }
  const totalJet = Number(roll.total || 0) + bonusSave;
  const icon = ADD2E_HUD_SAVE_ICONS[idx] || "fa-dice-d20";
  const color = ADD2E_HUD_SAVE_COLORS[idx] || "#6c4e95";
  const reussite = totalJet >= valeur;
  const htmlCard = `
    <div class="add2e-card-test" style="border-radius:13px; box-shadow:0 2px 10px #cfdfff88; background:linear-gradient(100deg,#f9fafd 90%,#e6e8fb 100%); border:1.4px solid ${color}; max-width:420px; padding:0.85em 1.1em 0.8em 1.1em; font-family: var(--font-primary);">
      <div style="display:flex; align-items:center; gap:0.7em; margin-bottom:0.5em;"><i class="fas ${icon}" style="font-size:2em;color:${color};"></i><span style="font-size:1.12em; font-weight:bold; color:${color};">${nom}</span><span style="margin-left:auto; font-size:1em; font-weight:500; color:#666;">Jet de sauvegarde</span></div>
      <div style="font-size:1.09em; margin-bottom:0.25em;">Seuil&nbsp;: <b>${valeur}</b>&nbsp;&nbsp;|&nbsp;&nbsp;Résultat&nbsp;: <b>${roll.total}</b>${bonusSave ? `&nbsp;&nbsp;|&nbsp;&nbsp;Effets&nbsp;: <b>${bonusSave >= 0 ? "+" : ""}${bonusSave}</b> → <b>${totalJet}</b>` : ""}</div>
      <div style="margin:0.2em 0 0.1em 0; font-size:1.1em;"><span style="font-weight:600; color:${reussite ? "#1cb360" : "#c34040"};">${reussite ? "✔️ Réussite" : "❌ Échec"}</span></div>
    </div>`;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: htmlCard });
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

Hooks.on("controlToken", () => window.setTimeout(add2eRefreshActionHud, 60));
Hooks.on("canvasReady", () => window.setTimeout(add2eRefreshActionHud, 150));
Hooks.once("ready", () => window.setTimeout(add2eRefreshActionHud, 300));

Hooks.on("updateActor", actor => {
  if (actor?.id === add2eHudActorId) window.setTimeout(add2eRefreshActionHud, 60);
});

for (const hookName of ["createItem", "updateItem", "deleteItem", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
  Hooks.on(hookName, doc => {
    const actor = doc?.parent;
    if (actor?.id === add2eHudActorId) window.setTimeout(add2eRefreshActionHud, 60);
  });
}

export { add2eRenderActionHud, add2eRefreshActionHud, add2eCloseActionHud };
