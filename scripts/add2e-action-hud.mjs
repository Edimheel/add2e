// scripts/add2e-action-hud.mjs
// ADD2E — HUD d'action rapide maison, indépendant d'Argon.
// Version : 2026-05-19-v7-actions-utilisables-strict
//
// Le HUD affiche uniquement :
// - les armes équipées ;
// - les sorts préparés ;
// - les capacités réellement utilisables.

const ADD2E_ACTION_HUD_VERSION = "2026-05-19-v7-actions-utilisables-strict";
const TAG = "[ADD2E][ACTION_HUD]";
const HUD_ID = "add2e-action-hud";
const STORAGE_KEY = "add2e.actionHud.state.v7";

let add2eHudActorId = null;
let add2eHudActiveTab = "attaques";
let add2eHudCollapsed = false;
let add2eHudState = null;

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
  if (value instanceof Set) return [...value];
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
  return {
    left: 116,
    top: Math.max(20, window.innerHeight - 330 - 22),
    width: 560,
    maxMenuHeight: 300
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
        maxMenuHeight: add2eHudClamp(Number(raw.maxMenuHeight) || 300, 110, Math.max(140, window.innerHeight - 130))
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

function add2eHudIsMonster(actor) {
  return String(actor?.type ?? "").toLowerCase() === "monster";
}

function add2eHudIsCharacter(actor) {
  return String(actor?.type ?? "").toLowerCase() === "personnage";
}

function add2eHudIsRelevant(actor) {
  if (!actor) return false;
  if (add2eHudIsCharacter(actor)) return add2eHudCanUseActor(actor);
  if (add2eHudIsMonster(actor)) return game.user.isGM;
  return false;
}

function add2eHudFindItem(actor, itemId) {
  if (!actor || !itemId) return null;
  return actor.items?.get?.(itemId) ?? actor.items?.find?.(i => String(i.id ?? i._id) === String(itemId)) ?? null;
}

function add2eHudIsEquipped(item) {
  const s = item?.system ?? {};
  return s.equipee === true || s.equipped === true || s.portee === true || s.worn === true || s.estEquipee === true;
}

function add2eHudPreparedCount(sort) {
  try {
    if (typeof globalThis.add2eGetTotalMemorizedCount === "function") {
      const n = Number(globalThis.add2eGetTotalMemorizedCount(sort));
      if (Number.isFinite(n)) return n;
    }
  } catch (_e) {}

  const flags = sort?.flags?.add2e ?? {};
  const system = sort?.system ?? {};
  const candidates = [
    sort?.getFlag?.("add2e", "memorizedCount"),
    flags.memorizedCount,
    flags.preparedCount,
    system.memorizedCount,
    system.preparedCount,
    system.prepared,
    system.memorise,
    system.memorized,
    system.prepare,
    system.prepared?.value,
    system.memorisation?.value,
    system.memorisation,
    system.slots?.prepared,
    system.slots?.value
  ];

  for (const value of candidates) {
    const n = add2eHudNumber(value, NaN);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function add2eHudIsObjectPowerSpell(sort) {
  const s = sort?.system ?? {};
  if (s.isPower === true || s.isObjectPower === true) return true;
  if (s.sourceWeaponId || s.sourceItemId || s.powerIndex !== undefined) return true;
  try {
    if (typeof globalThis.add2eIsObjectMagicSpellForPreparation === "function" && globalThis.add2eIsObjectMagicSpellForPreparation(sort)) return true;
  } catch (_e) {}
  return false;
}

function add2eHudWeapons(actor) {
  return (actor?.items?.filter?.(i => String(i.type ?? "").toLowerCase() === "arme" && add2eHudIsEquipped(i)) ?? []);
}

function add2eHudSpells(actor) {
  return (actor?.items?.filter?.(i => {
    if (String(i.type ?? "").toLowerCase() !== "sort") return false;
    if (add2eHudIsObjectPowerSpell(i)) return false;
    return add2eHudPreparedCount(i) > 0;
  }) ?? []);
}

function add2eHudFeatureMin(feature) {
  return add2eHudNumber(feature?.minLevel ?? feature?.minimumLevel ?? feature?.niveauMin ?? feature?.level ?? feature?.niveau ?? 1, 1);
}

function add2eHudFeatureMax(feature) {
  const raw = feature?.maxLevel ?? feature?.maximumLevel ?? feature?.niveauMax ?? feature?.max;
  if (raw === undefined || raw === null || raw === "") return 999;
  return add2eHudNumber(raw, 999);
}

function add2eHudFeatureHasScript(feature) {
  return Boolean(
    feature?.activable === true ||
    feature?.usable === true ||
    feature?.onUse ||
    feature?.onuse ||
    feature?.on_use ||
    feature?.script ||
    feature?.macro ||
    feature?.action
  );
}

function add2eHudClassFeatures(actor) {
  const level = Math.max(1, add2eHudNumber(actor?.system?.niveau, 1));
  let raw = [];

  if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getActiveClassFeatures === "function") {
    try { raw = Add2eEffectsEngine.getActiveClassFeatures(actor) ?? []; }
    catch (err) { console.warn(`${TAG}[FEATURES_ENGINE_ERROR]`, err); }
  }

  if (!raw.length) {
    const details = actor?.system?.details_classe ?? {};
    raw = details.classFeatures ?? details.capacitesClasse ?? actor?.system?.classFeatures ?? actor?.system?.capacites ?? actor?.system?.capacitesSpeciales ?? [];
  }

  const fromClassItem = actor?.items?.filter?.(i => String(i.type ?? "").toLowerCase() === "classe")
    ?.flatMap(i => add2eHudArray(i.system?.classFeatures ?? i.system?.capacitesClasse)) ?? [];

  const features = [...add2eHudArray(raw), ...fromClassItem]
    .filter(f => f && typeof f === "object")
    .map((feature, index) => ({ ...feature, __index: feature.__index ?? index }))
    .filter(feature => {
      if (!add2eHudFeatureHasScript(feature)) return false;
      const min = add2eHudFeatureMin(feature);
      const max = add2eHudFeatureMax(feature);
      return add2eHudIsMonster(actor) || (level >= min && level <= max);
    });

  const seen = new Set();
  return features.filter(feature => {
    const key = String(feature.id ?? feature.slug ?? feature.name ?? feature.label ?? feature.nom ?? feature.__index);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function add2eHudHp(actor) {
  return add2eHudNumber(actor?.system?.pdv ?? actor?.system?.pv?.value ?? actor?.system?.hp?.value ?? actor?.system?.hp, 0);
}

function add2eHudHpMax(actor) {
  return add2eHudNumber(actor?.system?.points_de_coup ?? actor?.system?.pv?.max ?? actor?.system?.hp?.max ?? actor?.system?.hpMax, add2eHudHp(actor));
}

function add2eHudThaco(actor) {
  const direct = actor?.system?.thac0 ?? actor?.system?.thaco ?? actor?.system?.combat?.thac0;
  if (direct !== undefined && direct !== null && direct !== "") return direct;
  const level = Math.max(1, add2eHudNumber(actor?.system?.niveau, 1));
  const row = actor?.system?.details_classe?.progression?.[level - 1];
  return row?.thac0 ?? row?.thaco ?? 20;
}

function add2eHudArmorClass(actor) {
  return actor?.system?.ca_total ?? actor?.system?.ca ?? actor?.system?.armorClass ?? actor?.system?.ac ?? "—";
}

function add2eHudDamageText(arme) {
  const s = arme?.system ?? arme ?? {};
  return s?.dégâts?.contre_moyen ?? s?.degats?.contre_moyen ?? s?.degats_moyen ?? s?.damage ?? s?.degats ?? s?.dmg ?? "—";
}

function add2eHudRangeText(arme) {
  const s = arme?.system ?? arme ?? {};
  const parts = [s.portee_courte ?? s.portee_short, s.portee_moyenne ?? s.portee_medium, s.portee_longue ?? s.portee_long]
    .filter(v => v !== undefined && v !== null && String(v) !== "");
  return parts.length ? parts.join(" / ") : "Contact";
}

function add2eHudInjectStyle() {
  if (document.getElementById("add2e-action-hud-style")) return;
  const style = document.createElement("style");
  style.id = "add2e-action-hud-style";
  style.textContent = `
    #${HUD_ID} { position:fixed; z-index:100; color:#f6e8bd; font-family:var(--font-primary, Signika, sans-serif); pointer-events:auto; min-width:360px; resize:none; }
    #${HUD_ID}.collapsed .a2e-hud-menu-panel { display:none !important; }
    #${HUD_ID} .a2e-hud-shell { display:flex; flex-direction:column; justify-content:flex-end; border:1px solid #8a611d; border-radius:14px; overflow:hidden; background:radial-gradient(circle at 15% 0%, rgba(213,147,45,.28), transparent 36%), linear-gradient(145deg, rgba(32,25,16,.97), rgba(18,14,10,.96)); box-shadow:0 8px 26px rgba(0,0,0,.48), inset 0 0 0 1px rgba(255,230,160,.12); backdrop-filter:blur(3px); }
    #${HUD_ID} .a2e-hud-menu-panel { flex:0 1 auto !important; min-height:0 !important; max-height:var(--a2e-hud-menu-max, 300px) !important; padding:9px !important; overflow-y:auto !important; border-bottom:1px solid rgba(184,137,36,.45); background:rgba(0,0,0,.12); display:block !important; }
    #${HUD_ID} .a2e-hud-section { display:none !important; }
    #${HUD_ID} .a2e-hud-section.active { display:grid !important; gap:7px !important; align-content:start !important; margin-top:0 !important; }
    #${HUD_ID} .a2e-hud-tabs { flex:0 0 auto; display:grid; grid-template-columns:repeat(3,1fr); border-bottom:1px solid rgba(184,137,36,.45); background:rgba(0,0,0,.18); }
    #${HUD_ID} .a2e-hud-tab { min-height:34px; border:0; border-right:1px solid rgba(184,137,36,.32); background:transparent; color:#d8bd78; font-size:.8em; font-weight:900; cursor:pointer; }
    #${HUD_ID} .a2e-hud-tab.active { color:#211307; background:linear-gradient(180deg,#f0c66d,#c78d2e); }
    #${HUD_ID} .a2e-hud-header { flex:0 0 auto; display:grid; grid-template-columns:74px minmax(0,1fr) auto auto; gap:10px; align-items:center; padding:9px 10px; background:linear-gradient(180deg, rgba(78,48,18,.78), rgba(36,26,14,.62)); cursor:move; user-select:none; }
    #${HUD_ID} .a2e-hud-portrait { width:64px; height:64px; border-radius:12px; object-fit:cover; border:2px solid #c4973f; background:#111; box-shadow:0 2px 8px rgba(0,0,0,.45); pointer-events:none; }
    #${HUD_ID} .a2e-hud-name { color:#fff4cf; font-size:1.12em; font-weight:900; line-height:1.1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    #${HUD_ID} .a2e-hud-subtitle { color:#d8bd78; font-size:.82em; font-weight:700; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    #${HUD_ID} .a2e-hud-metrics { display:flex; flex-wrap:wrap; gap:4px; margin-top:5px; }
    #${HUD_ID} .a2e-hud-pill { display:inline-flex; align-items:center; justify-content:center; min-height:22px; padding:2px 7px; border:1px solid rgba(214,176,90,.75); border-radius:999px; background:rgba(255,244,201,.12); color:#fff0bd; font-size:.78em; font-weight:850; white-space:nowrap; }
    #${HUD_ID} .a2e-hud-icon-btn, #${HUD_ID} .a2e-hud-resize { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border:1px solid rgba(214,176,90,.75); border-radius:9px; background:rgba(255,244,201,.12); color:#ffe4a1; cursor:pointer; }
    #${HUD_ID} .a2e-hud-resize { cursor:nwse-resize; }
    #${HUD_ID} .a2e-hud-row { display:grid; grid-template-columns:38px minmax(0,1fr) auto; gap:8px; align-items:center; min-height:48px; padding:6px; border:1px solid rgba(214,176,90,.38); border-radius:10px; background:rgba(255,250,235,.07); }
    #${HUD_ID} .a2e-hud-row.compact { grid-template-columns:minmax(0,1fr) auto; min-height:38px; }
    #${HUD_ID} .a2e-hud-row img { width:34px; height:34px; border-radius:7px; object-fit:cover; border:1px solid rgba(214,176,90,.65); background:rgba(0,0,0,.25); }
    #${HUD_ID} .a2e-hud-row-title { color:#fff4cf; font-weight:900; line-height:1.08; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    #${HUD_ID} .a2e-hud-row-meta { display:flex; flex-wrap:wrap; gap:4px 8px; color:#c8ad6e; font-size:.76em; font-weight:750; margin-top:2px; }
    #${HUD_ID} .a2e-hud-action { min-width:78px; min-height:30px; padding:4px 9px; border:1px solid #d6b05a; border-radius:9px; background:linear-gradient(180deg,#fff0bd,#d6a345); color:#211307; font-size:.8em; font-weight:950; cursor:pointer; white-space:nowrap; }
    #${HUD_ID} .a2e-hud-action:disabled { opacity:.45; cursor:not-allowed; }
    #${HUD_ID} .a2e-hud-empty { padding:12px; border:1px dashed rgba(214,176,90,.45); border-radius:10px; color:#c8ad6e; font-style:italic; text-align:center; }
    @media (max-width:760px) { #${HUD_ID} { left:8px !important; right:8px; width:auto !important; min-width:0; } }
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
    return `<div class="a2e-hud-row" data-item-id="${id}"><img src="${img}" alt="${name}"><div><div class="a2e-hud-row-title">${name}</div><div class="a2e-hud-row-meta"><span>Équipée</span><span>Dégâts ${add2eHudEscape(add2eHudDamageText(arme))}</span><span>Portée ${add2eHudEscape(add2eHudRangeText(arme))}</span></div></div><button type="button" class="a2e-hud-action" data-action="attack" data-item-id="${id}">Attaquer</button></div>`;
  }).join("");
}

function add2eHudSpellRows(actor) {
  const spells = add2eHudSpells(actor);
  if (!spells.length) return `<div class="a2e-hud-empty">Aucun sort préparé.</div>`;

  return spells.map(sort => {
    const id = add2eHudEscape(sort.id);
    const name = add2eHudEscape(sort.name);
    const img = add2eHudEscape(sort.img || "icons/svg/book.svg");
    const niv = add2eHudEscape(sort.system?.niveau ?? sort.system?.level ?? "—");
    const school = add2eHudEscape(sort.system?.école ?? sort.system?.ecole ?? "");
    const prepared = add2eHudPreparedCount(sort);
    return `<div class="a2e-hud-row" data-item-id="${id}"><img src="${img}" alt="${name}"><div><div class="a2e-hud-row-title">${name}</div><div class="a2e-hud-row-meta"><span>Niv. ${niv}</span>${school ? `<span>${school}</span>` : ""}<span>Préparé ${prepared}</span></div></div><button type="button" class="a2e-hud-action" data-action="cast-spell" data-item-id="${id}">Lancer</button></div>`;
  }).join("");
}

function add2eHudFeatureRows(actor) {
  const features = add2eHudClassFeatures(actor);
  if (!features.length) return `<div class="a2e-hud-empty">Aucune capacité utilisable.</div>`;

  return features.map(feature => {
    const idx = add2eHudEscape(feature.__index);
    const name = add2eHudEscape(feature.name ?? feature.label ?? feature.nom ?? `Capacité ${Number(feature.__index) + 1}`);
    const uses = add2eHudEscape(feature.uses?.label ?? feature.usesLabel ?? feature.resume ?? feature.shortDescription ?? "");
    return `<div class="a2e-hud-row compact" data-feature-index="${idx}"><div><div class="a2e-hud-row-title">${name}</div><div class="a2e-hud-row-meta"><span>Utilisable</span>${uses ? `<span>${uses}</span>` : ""}</div></div><button type="button" class="a2e-hud-action" data-action="use-feature" data-feature-index="${idx}">Utiliser</button></div>`;
  }).join("");
}

function add2eHudHtml(actor, token = null) {
  const img = token?.document?.texture?.src || actor.img || "icons/svg/mystery-man.svg";
  const isMonster = add2eHudIsMonster(actor);
  const race = isMonster ? (actor.system?.type ?? actor.system?.race ?? "Monstre") : (actor.system?.race || actor.system?.details_race?.label || actor.items?.find?.(i => i.type === "race")?.name || "Race");
  const classe = isMonster ? (actor.system?.taille ?? actor.system?.size ?? actor.system?.alignment ?? "MJ") : (actor.system?.classe || actor.system?.details_classe?.label || actor.items?.find?.(i => i.type === "classe")?.name || "Classe");
  const niveau = isMonster ? (actor.system?.dv ?? actor.system?.hitDice ?? actor.system?.niveau ?? "—") : (actor.system?.niveau ?? "—");
  const ac = add2eHudArmorClass(actor);
  const thaco = add2eHudThaco(actor);
  const tab = (key, icon, label) => `<button type="button" class="a2e-hud-tab ${add2eHudActiveTab === key ? "active" : ""}" data-hud-tab="${key}"><i class="${icon}"></i> ${label}</button>`;
  const section = (key, html) => `<section class="a2e-hud-section ${add2eHudActiveTab === key ? "active" : ""}" data-hud-section="${key}">${html}</section>`;

  return `<div class="a2e-hud-shell"><div class="a2e-hud-menu-panel">${section("attaques", add2eHudWeaponRows(actor))}${section("sorts", add2eHudSpellRows(actor))}${section("capacites", add2eHudFeatureRows(actor))}</div><nav class="a2e-hud-tabs">${tab("attaques", "fas fa-swords", "Armes")}${tab("sorts", "fas fa-book", "Sorts")}${tab("capacites", "fas fa-bolt", "Capacités")}</nav><div class="a2e-hud-header" data-drag-handle="1"><img class="a2e-hud-portrait" src="${add2eHudEscape(img)}" alt="${add2eHudEscape(actor.name)}"><div><div class="a2e-hud-name">${add2eHudEscape(actor.name)}</div><div class="a2e-hud-subtitle">${add2eHudEscape(race)} — ${add2eHudEscape(classe)} ${isMonster ? "DV" : "niv."} ${add2eHudEscape(niveau)}</div><div class="a2e-hud-metrics"><span class="a2e-hud-pill">PV ${add2eHudHp(actor)} / ${add2eHudHpMax(actor)}</span><span class="a2e-hud-pill">CA ${add2eHudEscape(ac)}</span><span class="a2e-hud-pill">THAC0 ${add2eHudEscape(thaco)}</span></div></div><button type="button" class="a2e-hud-icon-btn" data-action="toggle-collapse" title="Réduire / agrandir"><i class="fas fa-chevron-down"></i></button><button type="button" class="a2e-hud-resize" data-resize-handle="1" title="Redimensionner"><i class="fas fa-up-right-and-down-left-from-center"></i></button></div></div>`;
}

function add2eHudApplyGeometry(hud) {
  const s = add2eHudLoadState();
  hud.style.left = `${s.left}px`;
  hud.style.top = `${s.top}px`;
  hud.style.width = `${s.width}px`;
  hud.style.removeProperty("height");
  hud.style.setProperty("--a2e-hud-menu-max", `${s.maxMenuHeight}px`);
}

function add2eHudConstrainState() {
  const s = add2eHudLoadState();
  s.width = add2eHudClamp(s.width, 360, Math.max(380, window.innerWidth - 20));
  s.maxMenuHeight = add2eHudClamp(s.maxMenuHeight, 110, Math.max(140, window.innerHeight - 130));
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
  if (!["attaques", "sorts", "capacites"].includes(add2eHudActiveTab)) add2eHudActiveTab = "attaques";
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
    const start = { x: ev.clientX, y: ev.clientY, left: s.left, top: s.top, width: s.width, maxMenuHeight: s.maxMenuHeight };
    const move = e => {
      if (mode === "drag") {
        s.left = start.left + (e.clientX - start.x);
        s.top = start.top + (e.clientY - start.y);
      } else {
        s.width = start.width + (e.clientX - start.x);
        s.maxMenuHeight = start.maxMenuHeight + (e.clientY - start.y);
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
  const features = add2eHudClassFeatures(actor);
  const feature = features.find(f => String(f.__index) === String(featureIndex));
  if (!feature) return ui.notifications.warn("Capacité introuvable ou non utilisable.");
  if (typeof globalThis.add2eExecuteClassFeatureOnUse !== "function") {
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<b>${add2eHudEscape(actor.name)}</b> utilise <b>${add2eHudEscape(feature.name ?? feature.label ?? feature.nom ?? "Capacité")}</b>` });
  }
  return globalThis.add2eExecuteClassFeatureOnUse(actor, feature, null);
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
  globalThis.add2eRenderActionHud = add2eRenderActionHud;
  globalThis.add2eRefreshActionHud = add2eRefreshActionHud;
  globalThis.add2eCloseActionHud = add2eCloseActionHud;
  globalThis.add2eHudCheck = () => ({
    version: ADD2E_ACTION_HUD_VERSION,
    actorId: add2eHudActorId,
    activeTab: add2eHudActiveTab,
    attackRoll: typeof globalThis.add2eAttackRoll,
    castSpell: typeof globalThis.add2eCastSpell,
    featureOnUse: typeof globalThis.add2eExecuteClassFeatureOnUse,
    hud: !!document.getElementById(HUD_ID)
  });
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
