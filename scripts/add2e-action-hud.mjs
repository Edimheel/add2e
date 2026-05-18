// scripts/add2e-action-hud.mjs
// ADD2E — HUD d'action rapide maison, indépendant d'Argon.
// Version : 2026-05-18-v5-draggable-resizable-upward
//
// Règle : le HUD ne réinvente pas les actions.
// - Attaque  -> globalThis.add2eAttackRoll({ actor, arme })
// - Sort     -> globalThis.add2eCastSpell({ actor, sort })
// - Capacité -> globalThis.add2eExecuteClassFeatureOnUse(actor, feature)

const ADD2E_ACTION_HUD_VERSION = "2026-05-18-v5-draggable-resizable-upward";
const TAG = "[ADD2E][ACTION_HUD]";
const HUD_ID = "add2e-action-hud";
const STORAGE_KEY = "add2e.actionHud.state.v5";

let add2eHudActorId = null;
let add2eHudActiveTab = "attaques";
let add2eHudCollapsed = false;
let add2eHudState = null;

const ADD2E_HUD_CARACS = [
  { key: "force", label: "FOR", title: "Force", icon: "fa-dumbbell", color: "#4ab878" },
  { key: "dexterite", label: "DEX", title: "Dextérité", icon: "fa-running", color: "#f3aa3c" },
  { key: "constitution", label: "CON", title: "Constitution", icon: "fa-heartbeat", color: "#e74c3c" },
  { key: "intelligence", label: "INT", title: "Intelligence", icon: "fa-brain", color: "#2980b9" },
  { key: "sagesse", label: "SAG", title: "Sagesse", icon: "fa-eye", color: "#9b59b6" },
  { key: "charisme", label: "CHA", title: "Charisme", icon: "fa-theater-masks", color: "#e056fd" }
];

const ADD2E_HUD_SAVE_NAMES = ["Paralysie", "Pétrification", "Baguettes", "Souffles", "Sorts"];
const ADD2E_HUD_SAVE_FULL_NAMES = [
  "Paralysie / poison / mort",
  "Pétrification / métamorphose",
  "Baguettes",
  "Souffles",
  "Sorts"
];
const ADD2E_HUD_SAVE_ICONS = ["fa-skull-crossbones", "fa-mountain", "fa-magic", "fa-fire", "fa-scroll"];
const ADD2E_HUD_SAVE_COLORS = ["#c48642", "#6394e8", "#b12f95", "#e67e22", "#a173d9"];

function add2eHudEscape(value) {
  try { return foundry.utils.escapeHTML(String(value ?? "")); }
  catch (_e) {
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

function add2eHudDefaultState() {
  const width = 560;
  const height = 360;
  return {
    left: 116,
    top: Math.max(20, window.innerHeight - height - 22),
    width,
    height
  };
}

function add2eHudLoadState() {
  if (add2eHudState) return add2eHudState;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (raw && typeof raw === "object") {
      add2eHudState = {
        left: add2eHudClamp(Number(raw.left) || 116, 0, Math.max(0, window.innerWidth - 220)),
        top: add2eHudClamp(Number(raw.top) || 120, 0, Math.max(0, window.innerHeight - 120)),
        width: add2eHudClamp(Number(raw.width) || 560, 360, Math.max(380, window.innerWidth - 20)),
        height: add2eHudClamp(Number(raw.height) || 360, 220, Math.max(260, window.innerHeight - 20))
      };
      return add2eHudState;
    }
  } catch (_e) {}
  add2eHudState = add2eHudDefaultState();
  return add2eHudState;
}

function add2eHudSaveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(add2eHudState)); }
  catch (_e) {}
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
  const all = actor?.items?.filter?.(i => i.type === "arme") ?? [];
  const equipped = all.filter(add2eHudIsEquipped);
  return equipped.length ? equipped : all;
}

function add2eHudPreparedCount(sort) {
  try {
    if (typeof globalThis.add2eGetTotalMemorizedCount === "function") return globalThis.add2eGetTotalMemorizedCount(sort);
  } catch (_e) {}
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
  const spells = actor?.items?.filter?.(i => i.type === "sort") ?? [];
  const usable = spells.filter(s => {
    if (typeof globalThis.add2eIsObjectMagicSpellForPreparation === "function" && globalThis.add2eIsObjectMagicSpellForPreparation(s)) return false;
    return true;
  });
  const prepared = usable.filter(s => add2eHudPreparedCount(s) > 0);
  return prepared.length ? prepared : usable;
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
  if (document.getElementById("add2e-action-hud-style")) return;
  const style = document.createElement("style");
  style.id = "add2e-action-hud-style";
  style.textContent = `
    #${HUD_ID} {
      position: fixed;
      z-index: 100;
      color: #f6e8bd;
      font-family: var(--font-primary, Signika, sans-serif);
      pointer-events: auto;
      min-width: 360px;
      min-height: 220px;
      resize: none;
    }
    #${HUD_ID}.collapsed .a2e-hud-menu-panel { display:none; }
    #${HUD_ID} .a2e-hud-shell {
      height: 100%;
      display: flex;
      flex-direction: column;
      border: 1px solid #8a611d;
      border-radius: 14px;
      overflow: hidden;
      background: radial-gradient(circle at 15% 0%, rgba(213,147,45,.28), transparent 36%), linear-gradient(145deg, rgba(32,25,16,.97), rgba(18,14,10,.96));
      box-shadow: 0 8px 26px rgba(0,0,0,.48), inset 0 0 0 1px rgba(255,230,160,.12);
      backdrop-filter: blur(3px);
    }
    #${HUD_ID} .a2e-hud-menu-panel {
      flex: 1 1 auto;
      min-height: 0;
      padding: 9px;
      overflow-y: auto;
      border-bottom:1px solid rgba(184,137,36,.45);
      background:rgba(0,0,0,.12);
    }
    #${HUD_ID} .a2e-hud-section { display:none; }
    #${HUD_ID} .a2e-hud-section.active { display:grid;gap:7px; }
    #${HUD_ID} .a2e-hud-tabs {
      flex: 0 0 auto;
      display:grid;grid-template-columns:repeat(5,1fr);border-bottom:1px solid rgba(184,137,36,.45);background:rgba(0,0,0,.18);
    }
    #${HUD_ID} .a2e-hud-tab {
      min-height:34px;border:0;border-right:1px solid rgba(184,137,36,.32);background:transparent;color:#d8bd78;
      font-size:.78em;font-weight:900;cursor:pointer;
    }
    #${HUD_ID} .a2e-hud-tab.active { color:#211307;background:linear-gradient(180deg,#f0c66d,#c78d2e); }
    #${HUD_ID} .a2e-hud-header {
      flex: 0 0 auto;
      display:grid;
      grid-template-columns:74px minmax(0,1fr) auto auto;
      gap:10px;
      align-items:center;
      padding:9px 10px;
      background:linear-gradient(180deg, rgba(78,48,18,.78), rgba(36,26,14,.62));
      cursor: move;
      user-select: none;
    }
    #${HUD_ID} .a2e-hud-portrait {
      width:64px;height:64px;border-radius:12px;object-fit:cover;
      border:2px solid #c4973f;background:#111;box-shadow:0 2px 8px rgba(0,0,0,.45);
      pointer-events:none;
    }
    #${HUD_ID} .a2e-hud-name { color:#fff4cf;font-size:1.12em;font-weight:900;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
    #${HUD_ID} .a2e-hud-subtitle { color:#d8bd78;font-size:.82em;font-weight:700;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
    #${HUD_ID} .a2e-hud-metrics { display:flex;flex-wrap:wrap;gap:4px;margin-top:5px; }
    #${HUD_ID} .a2e-hud-pill {
      display:inline-flex;align-items:center;justify-content:center;min-height:22px;padding:2px 7px;
      border:1px solid rgba(214,176,90,.75);border-radius:999px;background:rgba(255,244,201,.12);
      color:#fff0bd;font-size:.78em;font-weight:850;white-space:nowrap;
    }
    #${HUD_ID} .a2e-hud-icon-btn,
    #${HUD_ID} .a2e-hud-resize {
      display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;
      border:1px solid rgba(214,176,90,.75);border-radius:9px;background:rgba(255,244,201,.12);color:#ffe4a1;cursor:pointer;
    }
    #${HUD_ID} .a2e-hud-resize { cursor:nwse-resize; }
    #${HUD_ID} .a2e-hud-row {
      display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:48px;padding:6px;
      border:1px solid rgba(214,176,90,.38);border-radius:10px;background:rgba(255,250,235,.07);
    }
    #${HUD_ID} .a2e-hud-row.compact { grid-template-columns:minmax(0,1fr) auto;min-height:38px; }
    #${HUD_ID} .a2e-hud-row img { width:34px;height:34px;border-radius:7px;object-fit:cover;border:1px solid rgba(214,176,90,.65);background:rgba(0,0,0,.25); }
    #${HUD_ID} .a2e-hud-row-title { color:#fff4cf;font-weight:900;line-height:1.08;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
    #${HUD_ID} .a2e-hud-row-meta { display:flex;flex-wrap:wrap;gap:4px 8px;color:#c8ad6e;font-size:.76em;font-weight:750;margin-top:2px; }
    #${HUD_ID} .a2e-hud-action {
      min-width:78px;min-height:30px;padding:4px 9px;border:1px solid #d6b05a;border-radius:9px;
      background:linear-gradient(180deg,#fff0bd,#d6a345);color:#211307;font-size:.8em;font-weight:950;cursor:pointer;white-space:nowrap;
    }
    #${HUD_ID} .a2e-hud-action:disabled { opacity:.45;cursor:not-allowed; }
    #${HUD_ID} .a2e-hud-icon-btn:hover,
    #${HUD_ID} .a2e-hud-action:hover,
    #${HUD_ID} .a2e-hud-tab:hover { filter:brightness(1.15);transform:translateY(-1px); }
    #${HUD_ID} .a2e-hud-empty { padding:12px;border:1px dashed rgba(214,176,90,.45);border-radius:10px;color:#c8ad6e;font-style:italic;text-align:center; }
    #${HUD_ID} .a2e-hud-ability-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:7px; }
    #${HUD_ID} .a2e-hud-ability {
      display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center;padding:7px;
      border:1px solid rgba(214,176,90,.38);border-radius:10px;background:rgba(255,250,235,.07);
    }
    #${HUD_ID} .a2e-hud-ability b { color:#fff4cf;font-size:1.15em; }
    #${HUD_ID} .a2e-hud-ability span { display:block;color:#c8ad6e;font-size:.76em;font-weight:800; }
    @media (max-width:760px) {
      #${HUD_ID} { left:8px !important; right:8px; width:auto !important; min-width:0; }
      #${HUD_ID} .a2e-hud-ability-grid { grid-template-columns:repeat(2,1fr); }
    }
  `;
  document.head.appendChild(style);
}

function add2eHudWeaponRows(actor) {
  const weapons = add2eHudWeapons(actor);
  if (!weapons.length) return `<div class="a2e-hud-empty">Aucune arme disponible.</div>`;
  return weapons.map(arme => {
    const id = add2eHudEscape(arme.id);
    const name = add2eHudEscape(arme.name);
    const img = add2eHudEscape(arme.img || "icons/svg/sword.svg");
    const equipped = add2eHudIsEquipped(arme) ? "Équipée" : "Non équipée";
    return `<div class="a2e-hud-row" data-item-id="${id}">
      <img src="${img}" alt="${name}">
      <div><div class="a2e-hud-row-title">${name}</div><div class="a2e-hud-row-meta"><span>${equipped}</span><span>Dégâts ${add2eHudEscape(add2eHudDamageText(arme))}</span><span>Portée ${add2eHudEscape(add2eHudRangeText(arme))}</span></div></div>
      <button type="button" class="a2e-hud-action" data-action="attack" data-item-id="${id}">Attaquer</button>
    </div>`;
  }).join("");
}

function add2eHudSpellRows(actor) {
  const spells = add2eHudSpells(actor);
  if (!spells.length) return `<div class="a2e-hud-empty">Aucun sort disponible.</div>`;
  return spells.map(sort => {
    const id = add2eHudEscape(sort.id);
    const name = add2eHudEscape(sort.name);
    const img = add2eHudEscape(sort.img || "icons/svg/book.svg");
    const niv = add2eHudEscape(sort.system?.niveau ?? sort.system?.level ?? "—");
    const school = add2eHudEscape(sort.system?.école ?? sort.system?.ecole ?? "");
    const prepared = add2eHudPreparedCount(sort);
    return `<div class="a2e-hud-row" data-item-id="${id}">
      <img src="${img}" alt="${name}">
      <div><div class="a2e-hud-row-title">${name}</div><div class="a2e-hud-row-meta"><span>Niv. ${niv}</span>${school ? `<span>${school}</span>` : ""}${prepared > 0 ? `<span>Préparé ${prepared}</span>` : `<span>Disponible</span>`}</div></div>
      <button type="button" class="a2e-hud-action" data-action="cast-spell" data-item-id="${id}">Lancer</button>
    </div>`;
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
    return `<div class="a2e-hud-row compact" data-feature-index="${idx}">
      <div><div class="a2e-hud-row-title">${name}</div><div class="a2e-hud-row-meta">${locked ? `<span>Niveau requis ${min}${max !== 999 ? `-${max}` : ""}</span>` : `<span>Disponible</span>`}${uses ? `<span>${uses}</span>` : ""}</div></div>
      <button type="button" class="a2e-hud-action" data-action="use-feature" data-feature-index="${idx}" ${locked ? "disabled" : ""}>Utiliser</button>
    </div>`;
  }).join("");
}

function add2eHudSaveRows(actor) {
  const saves = add2eHudSavingThrows(actor);
  return ADD2E_HUD_SAVE_FULL_NAMES.map((label, idx) => {
    const value = saves[idx] || "—";
    return `<div class="a2e-hud-row compact">
      <div><div class="a2e-hud-row-title">${add2eHudEscape(label)}</div><div class="a2e-hud-row-meta"><span>Seuil ${add2eHudEscape(value)} ou plus</span></div></div>
      <button type="button" class="a2e-hud-action" data-action="roll-save" data-save-index="${idx}">Jet</button>
    </div>`;
  }).join("");
}

function add2eHudAbilityRows(actor) {
  return `<div class="a2e-hud-ability-grid">${ADD2E_HUD_CARACS.map(carac => {
    const value = add2eHudAbilityValue(actor, carac.key);
    return `<div class="a2e-hud-ability"><div><b>${carac.label} ${value}</b><span>${add2eHudEscape(carac.title)}</span></div><button type="button" class="a2e-hud-action" data-action="roll-ability" data-ability="${carac.key}">Jet</button></div>`;
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

  return `<div class="a2e-hud-shell">
    <div class="a2e-hud-menu-panel">
      ${section("attaques", add2eHudWeaponRows(actor))}
      ${section("sorts", add2eHudSpellRows(actor))}
      ${section("capacites", add2eHudFeatureRows(actor))}
      ${section("sauvegardes", add2eHudSaveRows(actor))}
      ${section("caracs", add2eHudAbilityRows(actor))}
    </div>
    <nav class="a2e-hud-tabs">
      ${tab("attaques", "fas fa-swords", "Attaques")}
      ${tab("sorts", "fas fa-book", "Sorts")}
      ${tab("capacites", "fas fa-bolt", "Capacités")}
      ${tab("sauvegardes", "fas fa-shield-alt", "Sauv.")}
      ${tab("caracs", "fas fa-dice-d20", "Carac.")}
    </nav>
    <div class="a2e-hud-header" data-drag-handle="1">
      <img class="a2e-hud-portrait" src="${add2eHudEscape(img)}" alt="${add2eHudEscape(actor.name)}">
      <div><div class="a2e-hud-name">${add2eHudEscape(actor.name)}</div><div class="a2e-hud-subtitle">${add2eHudEscape(race)} — ${add2eHudEscape(classe)} niv. ${add2eHudEscape(niveau)}</div><div class="a2e-hud-metrics"><span class="a2e-hud-pill">PV ${add2eHudHp(actor)} / ${add2eHudHpMax(actor)}</span><span class="a2e-hud-pill">CA ${add2eHudEscape(ac)}</span><span class="a2e-hud-pill">THAC0 ${add2eHudEscape(thaco)}</span></div></div>
      <button type="button" class="a2e-hud-icon-btn" data-action="toggle-collapse" title="Réduire / agrandir"><i class="fas fa-chevron-down"></i></button>
      <button type="button" class="a2e-hud-resize" data-resize-handle="1" title="Redimensionner"><i class="fas fa-up-right-and-down-left-from-center"></i></button>
    </div>
  </div>`;
}

function add2eHudApplyGeometry(hud) {
  const s = add2eHudLoadState();
  hud.style.left = `${s.left}px`;
  hud.style.top = `${s.top}px`;
  hud.style.width = `${s.width}px`;
  hud.style.height = `${s.height}px`;
}

function add2eHudConstrainState() {
  const s = add2eHudLoadState();
  s.width = add2eHudClamp(s.width, 360, Math.max(380, window.innerWidth - 20));
  s.height = add2eHudClamp(s.height, 220, Math.max(260, window.innerHeight - 20));
  s.left = add2eHudClamp(s.left, 0, Math.max(0, window.innerWidth - 80));
  s.top = add2eHudClamp(s.top, 0, Math.max(0, window.innerHeight - 80));
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
  add2eHudConstrainState();
  add2eHudApplyGeometry(hud);
  hud.innerHTML = add2eHudHtml(actor, token);
  if (!existing) document.body.appendChild(hud);
  add2eBindHudEvents(hud, actor);
  add2eBindHudDragResize(hud);
}

function add2eRefreshActionHud() {
  const { actor, token } = add2eHudSelectedActorAndToken();
  add2eRenderActionHud(actor, token);
}

function add2eCloseActionHud() {
  document.getElementById(HUD_ID)?.remove();
  add2eHudActorId = null;
}

function add2eBindHudDragResize(hud) {
  const header = hud.querySelector("[data-drag-handle]");
  const resize = hud.querySelector("[data-resize-handle]");
  const startPointer = (ev, mode) => {
    if (ev.button !== 0) return;
    if (ev.target.closest?.("button") && mode === "drag") return;
    ev.preventDefault();
    ev.stopPropagation();

    const s = add2eHudLoadState();
    const start = { x: ev.clientX, y: ev.clientY, left: s.left, top: s.top, width: s.width, height: s.height };

    const move = e => {
      if (mode === "drag") {
        s.left = start.left + (e.clientX - start.x);
        s.top = start.top + (e.clientY - start.y);
      } else {
        s.width = start.width + (e.clientX - start.x);
        s.height = start.height + (e.clientY - start.y);
      }
      add2eHudConstrainState();
      add2eHudApplyGeometry(hud);
    };

    const up = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      add2eHudSaveState();
    };

    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
  };

  header?.addEventListener("pointerdown", ev => startPointer(ev, "drag"));
  resize?.addEventListener("pointerdown", ev => startPointer(ev, "resize"));
}

function add2eBindHudEvents(hud, actor) {
  hud.querySelectorAll("[data-hud-tab]").forEach(btn => {
    btn.addEventListener("click", ev => {
      ev.preventDefault();
      add2eHudActiveTab = btn.dataset.hudTab || "attaques";
      add2eRefreshActionHud();
    });
  });

  hud.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const action = btn.dataset.action;
      try {
        if (action === "toggle-collapse") {
          add2eHudCollapsed = !add2eHudCollapsed;
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
}

async function add2eHudAttack(actor, itemId) {
  const arme = add2eHudFindItem(actor, itemId);
  if (!arme) return ui.notifications.warn("Arme introuvable.");
  if (typeof globalThis.add2eAttackRoll !== "function") return ui.notifications.error("Fonction add2eAttackRoll introuvable.");
  return globalThis.add2eAttackRoll({ actor, arme });
}

async function add2eHudCastSpell(actor, itemId) {
  const sort = add2eHudFindItem(actor, itemId);
  if (!sort) return ui.notifications.warn("Sort introuvable.");
  if (typeof globalThis.add2eCastSpell !== "function") return ui.notifications.error("Fonction add2eCastSpell introuvable.");
  return globalThis.add2eCastSpell({ actor, sort });
}

async function add2eHudUseFeature(actor, featureIndex) {
  const features = add2eHudClassFeatures(actor);
  const feature = features.find(f => String(f.__index) === String(featureIndex));
  if (!feature) return ui.notifications.warn("Capacité introuvable.");
  if (typeof globalThis.add2eExecuteClassFeatureOnUse !== "function") return ui.notifications.error("Fonction add2eExecuteClassFeatureOnUse introuvable.");
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
  const htmlCard = `<div class="add2e-card-test" style="border-radius:13px;box-shadow:0 2px 10px #b5e7c388;background:linear-gradient(100deg,#f9fcfa 90%,#e4fbf1 100%);border:1.4px solid ${caracColor};max-width:420px;padding:.85em 1.1em;font-family:var(--font-primary);"><div style="display:flex;align-items:center;gap:.7em;margin-bottom:.5em;"><i class="fas ${caracIcon}" style="font-size:2em;color:${caracColor};"></i><span style="font-size:1.17em;font-weight:bold;color:${caracColor};">${label}</span><span style="margin-left:auto;font-size:1em;font-weight:500;color:#666;">Test de caractéristique</span></div><div style="font-size:1.11em;margin-bottom:.25em;">Seuil&nbsp;: <b>${val}</b>&nbsp;&nbsp;|&nbsp;&nbsp;Résultat&nbsp;: <b>${roll.total}</b></div><div style="margin:.2em 0 .1em 0;font-size:1.1em;"><span style="font-weight:600;color:${reussite ? "#1cb360" : "#c34040"};">${reussite ? "✔️ Réussite" : "❌ Échec"}</span></div></div>`;
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
    } catch (e) { console.warn("[ADD2E][SAVE] Erreur analyse effets de sauvegarde", e); }
  }
  const totalJet = Number(roll.total || 0) + bonusSave;
  const icon = ADD2E_HUD_SAVE_ICONS[idx] || "fa-dice-d20";
  const color = ADD2E_HUD_SAVE_COLORS[idx] || "#6c4e95";
  const reussite = totalJet >= valeur;
  const htmlCard = `<div class="add2e-card-test" style="border-radius:13px;box-shadow:0 2px 10px #cfdfff88;background:linear-gradient(100deg,#f9fafd 90%,#e6e8fb 100%);border:1.4px solid ${color};max-width:420px;padding:.85em 1.1em;font-family:var(--font-primary);"><div style="display:flex;align-items:center;gap:.7em;margin-bottom:.5em;"><i class="fas ${icon}" style="font-size:2em;color:${color};"></i><span style="font-size:1.12em;font-weight:bold;color:${color};">${nom}</span><span style="margin-left:auto;font-size:1em;font-weight:500;color:#666;">Jet de sauvegarde</span></div><div style="font-size:1.09em;margin-bottom:.25em;">Seuil&nbsp;: <b>${valeur}</b>&nbsp;&nbsp;|&nbsp;&nbsp;Résultat&nbsp;: <b>${roll.total}</b>${bonusSave ? `&nbsp;&nbsp;|&nbsp;&nbsp;Effets&nbsp;: <b>${bonusSave >= 0 ? "+" : ""}${bonusSave}</b> → <b>${totalJet}</b>` : ""}</div><div style="margin:.2em 0 .1em 0;font-size:1.1em;"><span style="font-weight:600;color:${reussite ? "#1cb360" : "#c34040"};">${reussite ? "✔️ Réussite" : "❌ Échec"}</span></div></div>`;
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
  console.log(`${TAG}[INIT]`, ADD2E_ACTION_HUD_VERSION);
});

Hooks.on("controlToken", () => window.setTimeout(add2eRefreshActionHud, 60));
Hooks.on("canvasReady", () => window.setTimeout(add2eRefreshActionHud, 150));
Hooks.once("ready", () => window.setTimeout(add2eRefreshActionHud, 300));
Hooks.on("updateActor", actor => { if (actor?.id === add2eHudActorId) window.setTimeout(add2eRefreshActionHud, 60); });
for (const hookName of ["createItem", "updateItem", "deleteItem", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
  Hooks.on(hookName, doc => {
    const actor = doc?.parent;
    if (actor?.id === add2eHudActorId) window.setTimeout(add2eRefreshActionHud, 60);
  });
}

export { add2eRenderActionHud, add2eRefreshActionHud, add2eCloseActionHud };
