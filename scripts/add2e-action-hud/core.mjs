// ADD2E — cœur d'interface du HUD d'action.
// Les données métier, styles et hooks sont isolés dans des modules dédiés.

import {
  ADD2E_ACTION_HUD_VERSION,
  EDGE_PAD,
  HANDLE_VISIBLE,
  HUD_ID,
  LEGACY_STORAGE_KEYS,
  STORAGE_KEY,
  TAG,
  TABS,
  actorItems,
  clamp,
  controlledRelevantTokens,
  esc,
  getItem,
  hud,
  hudTargetFromControlledSelection,
  isMonsterActor,
  num,
  relevant,
  tokenFor
} from "./shared.mjs";
import { equipmentRows, featureRows, features, itemEquipped, spellRows, weaponRows } from "./inventory.mjs";
import { abilityRows, armorClass, effectDisplayName, effectRows, effects, hp, hpMax, saveRows, thaco } from "./effects.mjs";
import { injectStyle } from "./styles.mjs";
import { installActionHudRuntime } from "./runtime.mjs";

let hudActor = null;
let hudToken = null;
let activeTab = "attaques";
let selectedSpellGroup = null;
let dragging = false;
let resizing = false;
let manualIntentUntil = 0;
let state = null;
let canvasTokenClickBound = false;

function currentActor() {
  if (hudActor) return hudActor;
  const controlled = controlledRelevantTokens();
  if (controlled.length === 1) return controlled[0].actor;
  return game.user?.character ?? null;
}
function defaultState() { return { left: 80, bottom: 80, top: null, width: 680, maxMenuHeight: 380, collapsed: false }; }
function normalizeLoadedState(raw = {}) {
  const normalized = { ...defaultState(), ...(raw || {}) };
  const viewportHeight = Math.max(1, window.innerHeight || document.documentElement?.clientHeight || 1);
  normalized.width = num(normalized.width, 680);
  normalized.maxMenuHeight = num(normalized.maxMenuHeight ?? normalized.menuHeight, 380);
  normalized.left = num(normalized.left, 80);
  if (Number.isFinite(Number(normalized.bottom))) normalized.bottom = Number(normalized.bottom);
  else if (Number.isFinite(Number(normalized.top))) normalized.bottom = Math.max(EDGE_PAD, viewportHeight - Number(normalized.top) - 110);
  else normalized.bottom = 80;
  normalized.top = null;
  return normalized;
}
function loadState() {
  if (state) return state;
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_error) { raw = null; }
  if (!raw) {
    for (const key of LEGACY_STORAGE_KEYS) {
      try { raw = JSON.parse(localStorage.getItem(key) || "null"); } catch (_error) { raw = null; }
      if (raw) break;
    }
  }
  state = normalizeLoadedState(raw);
  return state;
}
function saveState(partial = {}) {
  Object.assign(loadState(), partial);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_error) {}
}
export function resetHudPosition() {
  const collapsed = loadState().collapsed === true;
  state = { ...defaultState(), collapsed };
  saveState(state);
  applyGeometry(hud(), true);
  return state;
}
export function applyGeometry(element = hud(), force = false) {
  if (!element || (!force && (dragging || resizing))) return;
  const current = loadState();
  const viewportWidth = Math.max(1, window.innerWidth || document.documentElement?.clientWidth || 1);
  const viewportHeight = Math.max(1, window.innerHeight || document.documentElement?.clientHeight || 1);
  const elementWidth = element.offsetWidth || current.width || 680;
  const elementHeight = element.offsetHeight || 110;
  const minLeft = Math.min(EDGE_PAD, viewportWidth - HANDLE_VISIBLE);
  const maxLeft = Math.max(EDGE_PAD, viewportWidth - Math.min(elementWidth, HANDLE_VISIBLE));
  const maxBottom = Math.max(EDGE_PAD, viewportHeight - Math.min(elementHeight, HANDLE_VISIBLE));
  current.width = clamp(num(current.width, 680), 380, Math.max(420, viewportWidth));
  current.left = clamp(num(current.left, 80), minLeft, maxLeft);
  current.bottom = clamp(num(current.bottom, 80), EDGE_PAD, maxBottom);
  current.top = null;
  current.maxMenuHeight = clamp(num(current.maxMenuHeight, 380), 120, Math.max(160, viewportHeight - 60));
  element.style.left = `${Math.round(current.left)}px`;
  element.style.top = "auto";
  element.style.bottom = `${Math.round(current.bottom)}px`;
  element.style.right = "auto";
  element.style.width = `${Math.round(current.width)}px`;
  element.style.setProperty("--a2e-hud-menu-max", `${Math.round(current.maxMenuHeight)}px`);
}
function setCollapsed(value, persist = true) {
  const element = hud();
  if (!element) return;
  element.classList.toggle("collapsed", !!value);
  if (persist) saveState({ collapsed: !!value });
  applyGeometry(element, true);
}
function hudHtml(actor, token = null) {
  const img = token?.document?.texture?.src || actor.img || "icons/svg/mystery-man.svg";
  const isMonster = isMonsterActor(actor);
  const race = isMonster ? (actor.system?.type ?? "Monstre") : (actor.system?.race || actor.system?.details_race?.label || actorItems(actor).find(item => item.type === "race")?.name || "Race");
  const classe = isMonster ? (actor.system?.taille ?? actor.system?.size ?? "MJ") : (actor.system?.classe || actor.system?.details_classe?.label || actorItems(actor).find(item => item.type === "classe")?.name || "Classe");
  const niveau = isMonster ? (actor.system?.dv ?? actor.system?.hitDice ?? actor.system?.niveau ?? "—") : (actor.system?.niveau ?? "—");
  const spellContent = spellRows(actor, selectedSpellGroup);
  selectedSpellGroup = spellContent.selectedGroup;
  const tab = (key, icon, label) => `<button type="button" class="a2e-hud-tab ${activeTab === key ? "active" : ""}" data-tab="${key}"><i class="${icon}"></i> ${label}</button>`;
  const section = (key, html) => `<section class="${activeTab === key ? "active" : ""}" data-section="${key}">${html}</section>`;
  return `<div class="a2e-hud-shell" data-drag-handle="1"><div class="a2e-hud-panel">${section("attaques", weaponRows(actor))}${section("sorts", spellContent.html)}${section("capacites", featureRows(actor))}${section("equipement", equipmentRows(actor))}${section("effets", effectRows(actor))}${section("sauvegardes", saveRows(actor))}${section("caracs", abilityRows(actor))}</div><nav class="a2e-hud-tabs">${tab("attaques", "fas fa-swords", "Armes")}${tab("sorts", "fas fa-book", "Sorts")}${tab("capacites", "fas fa-bolt", "Capacités")}${tab("equipement", "fas fa-box-open", "Équipement")}${tab("effets", "fas fa-hourglass-half", "Effets")}${tab("sauvegardes", "fas fa-shield-alt", "Sauv.")}${tab("caracs", "fas fa-dice-d20", "Carac.")}</nav><div class="a2e-hud-header" data-drag-handle="1"><img class="portrait" src="${esc(img)}" alt=""><div><div class="name">${esc(actor.name)}</div><div class="sub">${esc(race)} — ${esc(classe)} ${isMonster ? "DV" : "niv."} ${esc(niveau)}</div><div class="pills"><span class="pill">PV ${hp(actor)} / ${hpMax(actor)}</span><span class="pill">CA ${esc(armorClass(actor))}</span><span class="pill">THAC0 ${esc(thaco(actor))}</span></div></div><button type="button" class="icon" data-action="toggle-collapse"><i class="fas fa-chevron-down"></i></button><button type="button" class="icon resize" data-resize-handle="1"><i class="fas fa-up-right-and-down-left-from-center"></i></button></div></div>`;
}
export function renderHud(actor = null, token = null, { reason = "render" } = {}) {
  if (dragging || resizing) return false;
  injectStyle();
  const existing = hud();
  if (!relevant(actor)) {
    existing?.remove();
    hudActor = null;
    hudToken = null;
    return false;
  }
  hudActor = actor;
  hudToken = token ?? tokenFor(actor);
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
export function refreshHud(reason = "refresh", options = {}) {
  const target = options?.token?.actor && relevant(options.token.actor) ? { actor: options.token.actor, token: options.token, ambiguous: false } : hudTargetFromControlledSelection({ allowCharacterFallback: options.allowCharacterFallback !== false });
  if (!target.actor) {
    if (!target.ambiguous && options.closeWhenEmpty === true) closeHud();
    return false;
  }
  return renderHud(target.actor, target.token, { reason });
}
export function closeHud() { hud()?.remove(); hudActor = null; hudToken = null; }
function bindDirectHudPointerEvents(element) {
  if (!element || element.__add2eDirectDragBindingV54) return;
  element.__add2eDirectDragBindingV54 = true;
  element.addEventListener("pointerdown", pointerDown, true);
  element.addEventListener("mousedown", pointerDown, true);
  element.addEventListener("touchstart", pointerDown, { capture: true, passive: false });
}
function bindHudEvents(element, actor) {
  bindDirectHudPointerEvents(element);
  element.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", event => {
    event.preventDefault(); event.stopPropagation();
    const next = button.dataset.tab || "attaques";
    if (activeTab === next && !element.classList.contains("collapsed")) return setCollapsed(true, true);
    activeTab = next;
    renderHud(actor, tokenFor(actor), { reason: "tab" });
    setCollapsed(false, true);
  }));
  element.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", event => handleAction(event, actor, button)));
}
async function declareInitiativeAction(actor, itemId, kind) {
  const item = getItem(actor, itemId);
  if (!item) return ui.notifications.warn("Action d'initiative introuvable.");
  if (typeof globalThis.add2eDeclareInitiativeAction !== "function") return ui.notifications.error("Service canonique de déclaration d'initiative indisponible.");
  await globalThis.add2eDeclareInitiativeAction(actor, { kind, item });
  return renderHud(actor, hudToken, { reason: `declare-initiative-${kind}` });
}
async function handleAction(event, actor, button) {
  event.preventDefault(); event.stopPropagation();
  const action = button.dataset.action;
  try {
    if (action === "toggle-collapse") return setCollapsed(!hud()?.classList.contains("collapsed"), true);
    if (action === "select-spell-group") { selectedSpellGroup = button.dataset.spellGroup || selectedSpellGroup; return renderHud(actor, tokenFor(actor), { reason: "select-spell-group" }); }
    if (action === "declare-initiative-weapon") return declareInitiativeAction(actor, button.dataset.itemId, "weapon");
    if (action === "declare-initiative-spell") return declareInitiativeAction(actor, button.dataset.itemId, "spell");
    if (action === "attack") return sheetAttack(actor, button.dataset.itemId);
    if (action === "cast-spell") return sheetCastSpell(actor, button.dataset.itemId);
    if (action === "use-feature") return sheetUseFeature(actor, Number(button.dataset.featureIndex));
    if (action === "toggle-equipment") return toggleEquipment(actor, button.dataset.itemId);
    if (action === "remove-effect") return removeEffect(actor, button.dataset.effectId);
    if (action === "roll-save") return sheetRollSave(actor, Number(button.dataset.saveIndex));
    if (action === "roll-ability") return sheetRollAbility(actor, button.dataset.ability);
  } catch (error) {
    console.error(`${TAG}[ACTION_ERROR]`, { action, error });
    ui.notifications.error(`ADD2E HUD | Erreur action ${action}`);
  }
}
async function sheetAttack(actor, itemId) {
  const weapon = getItem(actor, itemId);
  if (!weapon) return ui.notifications.warn("Arme introuvable.");
  if (typeof globalThis.add2eAttackRoll !== "function") return ui.notifications.error("Fonction add2eAttackRoll introuvable.");
  return globalThis.add2eAttackRoll({ actor, arme: weapon });
}
async function sheetCastSpell(actor, itemId) {
  const spell = getItem(actor, itemId);
  if (!spell) return ui.notifications.warn("Sort introuvable.");
  if (typeof globalThis.add2eCastSpell !== "function") return ui.notifications.error("Fonction add2eCastSpell introuvable.");
  return globalThis.add2eCastSpell({ actor, sort: spell });
}
async function sheetRollAbility(actor, ability) {
  if (typeof globalThis.add2eRollCharacteristicCard !== "function") return ui.notifications.error("Fonction add2eRollCharacteristicCard introuvable.");
  return globalThis.add2eRollCharacteristicCard(actor, ability);
}
async function sheetRollSave(actor, index) {
  if (typeof globalThis.add2eRollSaveCard !== "function") return ui.notifications.error("Fonction add2eRollSaveCard introuvable.");
  return globalThis.add2eRollSaveCard(actor, index);
}
async function sheetUseFeature(actor, index) {
  const feature = features(actor)[index];
  if (!feature) return ui.notifications.warn("Capacité introuvable.");
  if (typeof globalThis.add2eExecuteClassFeatureOnUse !== "function") return ui.notifications.error("Fonction add2eExecuteClassFeatureOnUse introuvable.");
  return globalThis.add2eExecuteClassFeatureOnUse(actor, feature, null);
}
async function toggleEquipment(actor, itemId) {
  const item = getItem(actor, itemId);
  if (!item) return ui.notifications.warn("Équipement introuvable.");
  const next = !itemEquipped(item);
  await item.update({ "system.equipee": next, "system.equipped": next, "system.estEquipee": next, "system.worn": next }, { add2eReason: "hud-toggle-equipment" });
  return renderHud(actor, hudToken, { reason: "toggle-equipment" });
}
async function removeEffect(actor, effectId) {
  const effect = actor?.effects?.get?.(effectId) ?? effects(actor).find(entry => String(entry.id ?? entry._id ?? "") === String(effectId));
  if (!effect) return ui.notifications.warn("Effet introuvable.");
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  const confirmed = DialogV2?.confirm ? await DialogV2.confirm({ window: { title: "Supprimer l'effet" }, content: `<p>Supprimer <strong>${esc(effectDisplayName(effect))}</strong> ?</p>`, yes: { label: "Supprimer", icon: "fas fa-trash" }, no: { label: "Annuler" } }) : true;
  if (!confirmed) return false;
  if (actor?.effects?.get?.(effect.id)) await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id]);
  else if (typeof effect.delete === "function") await effect.delete();
  return renderHud(actor, hudToken, { reason: "remove-effect" });
}
function primary(event) { return event.button === undefined || event.button === 0; }
function pointerClient(event) { const touch = event.touches?.[0] ?? event.changedTouches?.[0] ?? null; return { x: touch?.clientX ?? event.clientX ?? 0, y: touch?.clientY ?? event.clientY ?? 0 }; }
function dragEvents(event) { if (event.type === "mousedown") return { move: "mousemove", up: "mouseup" }; if (event.type === "touchstart") return { move: "touchmove", up: "touchend" }; return { move: "pointermove", up: "pointerup" }; }
function startResize(event) {
  const handle = event.target?.closest?.("[data-resize-handle]");
  const element = event.target?.closest?.(`#${HUD_ID}`);
  if (!handle || !element || !primary(event)) return false;
  event.preventDefault(); event.stopPropagation(); resizing = true;
  const events = dragEvents(event); const startState = loadState(); const startPoint = pointerClient(event);
  const start = { x: startPoint.x, y: startPoint.y, width: startState.width, maxMenuHeight: startState.maxMenuHeight, bottom: startState.bottom };
  const move = moveEvent => { moveEvent.preventDefault?.(); const point = pointerClient(moveEvent); const current = loadState(); current.width = clamp(start.width + point.x - start.x, 380, Math.max(420, window.innerWidth)); current.maxMenuHeight = clamp(start.maxMenuHeight + point.y - start.y, 120, Math.max(160, window.innerHeight - 60)); current.bottom = start.bottom; applyGeometry(element, true); };
  const up = () => { window.removeEventListener(events.move, move, true); window.removeEventListener(events.up, up, true); resizing = false; const current = loadState(); saveState({ width: element.offsetWidth || current.width, maxMenuHeight: current.maxMenuHeight, left: current.left, bottom: current.bottom, top: null }); applyGeometry(element, true); };
  window.addEventListener(events.move, move, true); window.addEventListener(events.up, up, true); return true;
}
function startDrag(event) {
  const element = event.target?.closest?.(`#${HUD_ID}`); const handle = event.target?.closest?.("[data-drag-handle]");
  if (!element || !handle || !primary(event) || event.target.closest?.("button,a,input,select,textarea,[data-action],[data-tab],[data-resize-handle]")) return false;
  event.preventDefault(); event.stopPropagation(); dragging = true; manualIntentUntil = Date.now() + 1200;
  const events = dragEvents(event); const initial = loadState(); const point = pointerClient(event); const start = { x: point.x, y: point.y, left: initial.left, bottom: initial.bottom };
  const move = moveEvent => { moveEvent.preventDefault?.(); const currentPoint = pointerClient(moveEvent); const current = loadState(); const width = element.offsetWidth || current.width || 680; const height = element.offsetHeight || 110; current.left = clamp(start.left + currentPoint.x - start.x, Math.min(EDGE_PAD, window.innerWidth - HANDLE_VISIBLE), Math.max(EDGE_PAD, window.innerWidth - Math.min(width, HANDLE_VISIBLE))); current.bottom = clamp(start.bottom - (currentPoint.y - start.y), EDGE_PAD, Math.max(EDGE_PAD, window.innerHeight - Math.min(height, HANDLE_VISIBLE))); current.top = null; applyGeometry(element, true); saveState({ left: Math.round(current.left), bottom: Math.round(current.bottom), top: null }); };
  const up = () => { window.removeEventListener(events.move, move, true); window.removeEventListener(events.up, up, true); dragging = false; applyGeometry(element, true); };
  window.addEventListener(events.move, move, true); window.addEventListener(events.up, up, true); return true;
}
export function pointerDown(event) { if (dragging || resizing) return; if (startResize(event)) return; startDrag(event); }
function tokenFromCanvasPointer(event) {
  let object = event?.target ?? null;
  for (let guard = 0; object && guard < 12; guard += 1) { if (object?.actor && object?.document) return object; if (object?.object?.actor && object?.object?.document) return object.object; object = object.parent ?? null; }
  return null;
}
function onCanvasTokenPointerDown(event) {
  if (dragging || resizing) return;
  const token = tokenFromCanvasPointer(event);
  if (!token?.controlled || !token.actor || !relevant(token.actor)) return;
  const controlled = controlledRelevantTokens();
  if (controlled.length <= 1) return;
  manualIntentUntil = Date.now() + 500;
  renderHud(token.actor, token, { reason: "controlled-token-click" });
}
export function bindCanvasControlledTokenClick() { if (canvasTokenClickBound || !canvas?.stage?.on) return; canvasTokenClickBound = true; canvas.stage.on("pointerdown", onCanvasTokenPointerDown); }
export function setManualIntent(duration = 500) { manualIntentUntil = Date.now() + Math.max(0, Number(duration) || 0); }
export function followCombat(combat = game.combat, forceOpen = false) {
  if (Date.now() < manualIntentUntil) return false;
  const combatant = globalThis.add2eGetCurrentCombatant?.(combat) ?? combat?.combatant ?? null;
  if (!combatant?.actor || (!forceOpen && !hud())) return false;
  const token = combatant?.token?.object ?? (combatant?.tokenId ? canvas?.tokens?.get?.(combatant.tokenId) : null) ?? null;
  return renderHud(combatant.actor, token, { reason: "canonical-combat" });
}
export function getRuntimeState() { return { actor: hudActor ?? currentActor(), token: hudToken, activeTab, selectedSpellGroup, dragging, resizing }; }

installActionHudRuntime({ renderHud, refreshHud, closeHud, resetHudPosition, applyGeometry, pointerDown, bindCanvasControlledTokenClick, setManualIntent, followCombat, getRuntimeState });

export { renderHud as add2eRenderActionHud, refreshHud as add2eRefreshActionHud, closeHud as add2eCloseActionHud };
export { ADD2E_ACTION_HUD_VERSION };
