// scripts/add2e-action-hud.mjs
// ADD2E — HUD d'action rapide maison.
// Version : 2026-06-15-v51-equipment-sheet-objects-only
// Le HUD reste une interface : les actions délèguent aux fonctions système.

const ADD2E_ACTION_HUD_VERSION = "2026-06-15-v51-equipment-sheet-objects-only";
const HUD_ID = "add2e-action-hud";
const STYLE_ID = "add2e-action-hud-style";
const STORAGE_KEY = "add2e.actionHud.state.v46";
const LEGACY_STORAGE_KEYS = ["add2e.actionHud.state.v45", "add2e.actionHud.state.v44", "add2e.actionHud.state.v43"];
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
let canvasTokenClickBound = false;

const TABS = ["attaques", "sorts", "capacites", "equipement", "effets", "sauvegardes", "caracs"];
const COINS = [
  ["pp", "PP"],
  ["po", "PO"],
  ["pe", "PE"],
  ["pa", "PA"],
  ["pc", "PC"]
];
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
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
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

function lower(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function norm(value) {
  return lower(value)
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:_-]+/g, "_")
    .replace(/^_|_$/g, "");
}

function slug(value) {
  return lower(value)
    .replace(/[’']/g, "_")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function hud() { return document.getElementById(HUD_ID); }
function actorItems(actor) { return Array.from(actor?.items ?? []).filter(item => item && item.type); }
function actorEffects(actor) { return Array.from(actor?.effects ?? []).filter(Boolean); }
function getItem(actor, id) { return actor?.items?.get?.(id) ?? actorItems(actor).find(item => item.id === id || item._id === id) ?? null; }
function controlledRelevantTokens() { return (canvas?.tokens?.controlled ?? []).filter(token => token?.actor && relevant(token.actor)); }
function currentActor() {
  if (hudActor) return hudActor;
  const controlled = controlledRelevantTokens();
  if (controlled.length === 1) return controlled[0].actor;
  return game.user?.character ?? null;
}
function tokenFor(actor) { return canvas?.tokens?.controlled?.find?.(token => token.actor?.id === actor?.id) ?? actor?.getActiveTokens?.()[0] ?? null; }
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
function hudTargetFromControlledSelection({ allowCharacterFallback = true } = {}) {
  const controlled = controlledRelevantTokens();
  if (controlled.length === 1) return { actor: controlled[0].actor, token: controlled[0], ambiguous: false };
  if (controlled.length > 1) return { actor: null, token: null, ambiguous: true };
  const character = allowCharacterFallback ? game.user?.character : null;
  if (character && relevant(character)) return { actor: character, token: tokenFor(character), ambiguous: false };
  return { actor: null, token: null, ambiguous: false };
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
  try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch (_e) { raw = null; }
  if (!raw) {
    for (const key of LEGACY_STORAGE_KEYS) {
      try { raw = JSON.parse(localStorage.getItem(key) || "null"); } catch (_e) { raw = null; }
      if (raw) break;
    }
  }
  state = normalizeLoadedState(raw);
  return state;
}
function saveState(partial = {}) {
  Object.assign(loadState(), partial);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_e) {}
}
function resetHudPosition() {
  const collapsed = loadState().collapsed === true;
  state = { ...defaultState(), collapsed };
  saveState(state);
  applyGeometry(hud(), true);
  return state;
}
function applyGeometry(element = hud(), force = false) {
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

function itemEquipped(item) {
  const system = item?.system ?? {};
  return system.equipee === true || system.equipped === true || system.portee === true || system.worn === true || system.estEquipee === true;
}
function itemTags(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [
    item?.name, system.nom, system.categorie, system.category, system.type, system.sousType, system.sous_type,
    system.type_arme, system.famille, system.famille_arme, system.tags, system.effectTags, flags.tags, flags.effectTags
  ].flatMap(arr).map(norm).filter(Boolean);
}
function itemTextFields(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [
    item?.name, system.categorie, system.category, system.sousType, system.sous_type, system.type,
    system.subtype, system.kind, system.slot, system.slug, system.composant, system.component,
    flags.vendorKind, flags.kind, flags.slug, flags.componentSlug,
    ...arr(system.tags), ...arr(system.effectTags), ...arr(flags.tags), ...arr(flags.effectTags)
  ].map(lower).filter(Boolean);
}
function isContainerLike(item) {
  const text = itemTags(item).join(" ");
  const name = norm(item?.name);
  return text.includes("sacoche") || text.includes("component") || text.includes("composant") || name.includes("sacoche") || name.includes("composant");
}
function isSpellComponentItem(item) {
  if (!item) return false;
  const fields = itemTextFields(item);
  if (fields.some(v => v === "component" || v === "composant" || v === "composants")) return true;
  if (fields.some(v => v === "composant_sort" || v === "composants_sort" || v === "composant_de_sort" || v === "composants_de_sort")) return true;
  if (fields.some(v => v === "spell_component" || v === "spell_components" || v === "material_component" || v === "material_components")) return true;
  if (fields.some(v => v.startsWith("composant:") || v.startsWith("component:") || v.startsWith("spell_component:"))) return true;
  if (fields.some(v => v.includes("composant") && v.includes("sort"))) return true;
  if (fields.some(v => v.includes("spell") && v.includes("component"))) return true;
  return isContainerLike(item);
}
function isOnlyComponentCode(value) {
  const text = lower(value).replace(/[^a-z]/g, "");
  return ["v", "s", "m", "vs", "vm", "sm", "vsm", "verbal", "somatique", "materiel", "materielle", "material"].includes(text);
}
function isBadComponentName(value) {
  const text = lower(value);
  if (!text || isOnlyComponentCode(text)) return true;
  if (/manuel|joueur|optionnel|optional|alternative|requise|requis|required|creation|création|destruction|composantes?|components?/.test(text)) return true;
  if (text.length > 48) return true;
  if (text.split(/\s+/).length > 5) return true;
  return false;
}
function addComponentRequirement(out, rawName, rawQty = 1) {
  const name = String(rawName ?? "").trim();
  if (isBadComponentName(name)) return;
  const key = slug(name);
  if (!key) return;
  const quantity = Math.max(1, Math.floor(num(rawQty, 1)));
  const existing = out.find(requirement => requirement.key === key);
  if (existing) existing.quantity += quantity;
  else out.push({ name, key, quantity });
}
function collectComponentRequirement(out, value) {
  if (value === null || value === undefined || value === "") return;
  if (Array.isArray(value)) {
    for (const entry of value) collectComponentRequirement(out, entry);
    return;
  }
  if (typeof value === "string") {
    for (const part of value.split(/[,;|\n]+|\bet\b/gi).map(part => part.trim()).filter(Boolean)) addComponentRequirement(out, part, 1);
    return;
  }
  if (typeof value === "object") {
    const name = value.name ?? value.nom ?? value.label ?? value.item ?? value.itemName ?? value.component ?? value.composant ?? value.slug ?? value.id;
    const quantity = value.quantity ?? value.quantite ?? value.qty ?? value.nombre ?? value.count ?? value.value ?? 1;
    if (name) addComponentRequirement(out, name, quantity);
  }
}
function componentRequirements(sort) {
  const system = sort?.system ?? {};
  const flags = sort?.flags?.add2e ?? {};
  const out = [];
  const fields = [
    system.composants_requis, system.composantsMateriels, system.composants_materiels,
    system.composantsMateriel, system.composant_materiel, system.composantMateriel,
    system.requiredComponents, system.componentsRequired, flags.composants_requis, flags.requiredComponents
  ];
  for (const field of fields) collectComponentRequirement(out, field);
  for (const tag of [...arr(system.tags), ...arr(system.effectTags), ...arr(flags.tags), ...arr(flags.effectTags)]) {
    const text = String(tag ?? "").trim();
    if (/^composant[:_]/i.test(text)) addComponentRequirement(out, text.replace(/^composant[:_]/i, ""), 1);
    if (/^component[:_]/i.test(text)) addComponentRequirement(out, text.replace(/^component[:_]/i, ""), 1);
    if (/^spell_component[:_]/i.test(text)) addComponentRequirement(out, text.replace(/^spell_component[:_]/i, ""), 1);
  }
  return out;
}
function componentKeys(item) {
  return itemTextFields(item)
    .map(value => slug(String(value ?? "").replace(/^(composant|component|spell_component)[:_]/i, "")))
    .filter(Boolean);
}
function findActorComponent(actor, requirement) {
  const items = actorItems(actor).filter(item => isSpellComponentItem(item) && quantityNumber(item, 0) >= requirement.quantity);
  return items.find(item => componentKeys(item).includes(requirement.key))
    ?? items.find(item => componentKeys(item).some(key => key && (key.includes(requirement.key) || requirement.key.includes(key))))
    ?? null;
}
function spellComponentBadges(actor, sort) {
  const requirements = componentRequirements(sort);
  if (!requirements.length) return "";
  return `<span class="component-title">Composants</span>${requirements.map(requirement => {
    const owned = !!findActorComponent(actor, requirement);
    const quantityLabel = requirement.quantity > 1 ? ` ×${requirement.quantity}` : "";
    return `<span class="${owned ? "component-ok" : "component-bad"}">${esc(requirement.name)}${quantityLabel}</span>`;
  }).join("")}`;
}

function isPropelledWeapon(item) {
  const tags = itemTags(item);
  const name = norm(item?.name);
  const system = item?.system ?? {};
  return system.projectile_propulse === true || system.arme_a_projectile === true || tags.includes("projectile_propulse") || tags.includes("usage_projectile_propulse") || ["arc", "arbalete", "fronde"].some(key => name.includes(key));
}
function isAmmunitionItem(item) {
  const system = item?.system ?? {};
  const name = lower(item?.name);
  const fields = [system.categorie, system.category, system.sousType, system.sous_type, system.type, system.subtype, system.kind, system.slot].map(lower).filter(Boolean);
  const tags = itemTags(item);
  const accepted = new Set([
    "munition", "munitions", "projectile", "projectiles", "ammo", "ammunition",
    "trait:munition", "trait:projectile", "categorie:munition", "categorie:projectile",
    "type:munition", "type:projectile"
  ]);
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
function quantity(item) {
  const system = item?.system ?? {};
  const value = system.quantite ?? system.quantity ?? system.qty ?? system.nombre ?? system.nb ?? system.uses?.value ?? system.charges?.value;
  return value === undefined || value === null || value === "" ? "—" : String(value);
}
function quantityNumber(item, fallback = 1) {
  const value = quantity(item);
  return value === "—" ? fallback : num(value, fallback);
}
function equippedProjectile(actor, weapon) {
  if (!usesProjectileInventory(actor) || !isPropelledWeapon(weapon)) return null;
  const keys = projectileKeys(weapon).map(norm);
  const items = actorItems(actor).filter(item => item.id !== weapon.id && itemEquipped(item) && keys.some(key => norm(item.name).includes(key) || itemTags(item).some(tag => tag.includes(key))));
  return items.find(item => quantity(item) !== "0") ?? items[0] ?? null;
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
function weapons(actor) { return actorItems(actor).filter(item => String(item.type ?? "").toLowerCase() === "arme" && itemEquipped(item)); }

function moneyRaw(actor) {
  const flag = actor?.getFlag?.("add2e", "monnaie");
  if (flag && typeof flag === "object") return flag;
  const system = actor?.system ?? {};
  return system.monnaie ?? system.argent ?? system.currency ?? {};
}
function moneyAmount(actor, key) { return Math.max(0, Math.floor(num(moneyRaw(actor)?.[key], 0))); }
function moneyPanel(actor) {
  return `<div class="money-row"><span class="money-title">Argent</span>${COINS.map(([key, label]) => `<span class="money-pill">${label} ${esc(moneyAmount(actor, key))}</span>`).join("")}</div>`;
}
function equipmentTypeLabel(item) {
  const type = String(item?.type ?? "").toLowerCase();
  if (type === "arme") return "Arme";
  if (type === "armure") return "Armure";
  return "Équipement";
}
function isSheetEquipmentObject(item) {
  if (String(item?.type ?? "").toLowerCase() !== "objet") return false;
  return !isAmmunitionItem(item) && !isSpellComponentItem(item);
}
function equipmentItems(actor) {
  return actorItems(actor)
    .filter(isSheetEquipmentObject)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
function equipmentRows(actor) {
  const rows = equipmentItems(actor);
  const body = rows.length ? rows.map(item => {
    const equipped = itemEquipped(item);
    const qty = quantity(item);
    const qtyLabel = qty !== "—" ? ` ×${esc(qty)}` : "";
    return `<div class="row equipment-row"><img src="${esc(item.img || "icons/svg/item-bag.svg")}" alt=""><div><div class="title">${esc(item.name)}${qtyLabel}</div><div class="meta"><span>${esc(equipmentTypeLabel(item))}</span><span class="${equipped ? "equip-ok" : "equip-off"}">${equipped ? "Équipé" : "Non équipé"}</span></div></div><button type="button" class="act" data-action="toggle-equipment" data-item-id="${esc(item.id)}">${equipped ? "Retirer" : "Équiper"}</button></div>`;
  }).join("") : `<div class="empty">Aucun équipement.</div>`;
  return `${moneyPanel(actor)}${body}`;
}

function sumPreparedTree(value) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === "string") return Math.max(0, num(value, 0));
  if (!value || typeof value !== "object") return 0;
  let total = 0;
  for (const child of Object.values(value)) total += sumPreparedTree(child);
  return total;
}
function preparedCount(sort) {
  const flags = sort?.flags?.add2e ?? {};
  const system = sort?.system ?? {};
  const directValues = [
    sort?.getFlag?.("add2e", "memorizedCount"), flags.memorizedCount, flags.preparedCount,
    system.memorizedCount, system.preparedCount, system.prepared, system.memorise, system.memorized,
    system.memorisation?.value, system.memorisation, system.slots?.prepared, system.slots?.value
  ];
  let best = 0;
  for (const value of directValues) {
    const numeric = num(value, NaN);
    if (Number.isFinite(numeric) && numeric > best) best = numeric;
  }
  best = Math.max(
    best,
    sumPreparedTree(sort?.getFlag?.("add2e", "memorizedByList")),
    sumPreparedTree(flags.memorizedByList),
    sumPreparedTree(flags.preparedByList),
    sumPreparedTree(system.memorizedByList),
    sumPreparedTree(system.preparedByList)
  );
  try {
    const total = Number(globalThis.add2eGetTotalMemorizedCount?.(sort));
    if (Number.isFinite(total) && total > best) best = total;
  } catch (_e) {}
  return Math.max(0, best);
}
function isObjectPowerSpell(sort) {
  const system = sort?.system ?? {};
  if (system.isPower === true || system.isObjectPower === true || system.sourceWeaponId || system.sourceItemId || system.powerIndex !== undefined) return true;
  try { return globalThis.add2eIsObjectMagicSpellForPreparation?.(sort) === true; }
  catch (_e) { return false; }
}
function spells(actor) { return actorItems(actor).filter(item => String(item.type ?? "").toLowerCase() === "sort" && !isObjectPowerSpell(item) && preparedCount(item) > 0); }
function spellLevel(sort) { return Math.max(0, num(sort?.system?.niveau ?? sort?.system?.level ?? sort?.system?.niveau_sort, 0)); }
function spellListLabel(sort) {
  const system = sort?.system ?? {};
  const raw = [system.liste, system.list, system.spellList, system.classe, system.class, system.sourceClasse, system.casterClass, ...arr(system.lists), ...arr(system.listes), ...arr(system.classes)]
    .map(value => String(value ?? "").trim()).find(Boolean) || "Mag";
  const normalized = norm(raw);
  if (normalized.includes("clerc") || normalized.includes("pretre") || normalized.includes("priest")) return "Clerc";
  if (normalized.includes("druid") || normalized.includes("druide")) return "Dru";
  if (normalized.includes("ranger")) return "Rng";
  if (normalized.includes("paladin")) return "Pal";
  if (normalized.includes("mag") || normalized.includes("wizard") || normalized.includes("mage")) return "Mag";
  return String(raw).slice(0, 6);
}
function spellGroupKey(sort) { return `${spellListLabel(sort)}|${spellLevel(sort)}`; }
function features(actor) {
  if (typeof globalThis.add2eGetActorActivableClassFeatures === "function") return globalThis.add2eGetActorActivableClassFeatures(actor, { includeLocked: false }) ?? [];
  return [];
}

function effectDisplayName(effect) {
  const name = String(effect?.name ?? effect?.label ?? effect?._source?.name ?? effect?._source?.label ?? "").trim();
  if (!name) return "";
  if (["activeeffect", "active effect", "effet actif", "effect"].includes(lower(name))) return "";
  return name;
}
function finiteNumber(value) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : null; }
function formatDurationSeconds(totalSeconds) {
  const total = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  if (total <= 0) return "0 s";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours} h${minutes ? ` ${minutes} min` : ""}`;
  if (minutes > 0) return `${minutes} min${seconds ? ` ${seconds} s` : ""}`;
  return `${seconds} s`;
}
function formatDurationRounds(rounds, turns = 0) {
  const r = Math.max(0, Math.ceil(Number(rounds) || 0));
  const t = Math.max(0, Math.ceil(Number(turns) || 0));
  if (r <= 0 && t <= 0) return "0 round";
  const roundLabel = `${r} round${r > 1 ? "s" : ""}`;
  return t > 0 ? `${roundLabel}, ${t} tour${t > 1 ? "s" : ""}` : roundLabel;
}
function effectDurationLabel(effect) {
  const flags = effect?.flags?.add2e ?? {};
  const duration = effect?.duration ?? {};
  const label = String(flags.remainingLabel ?? flags.durationLabel ?? duration.label ?? duration.remainingLabel ?? "").trim();
  if (label) return `Durée ${label}`;
  const remainingFlag = finiteNumber(flags.remainingSeconds ?? flags.remaining ?? flags.remainingDuration);
  if (remainingFlag !== null) return `Durée ${formatDurationSeconds(remainingFlag)}`;
  const remainingRoundsFlag = finiteNumber(flags.remainingRounds ?? flags.roundsRemaining);
  if (remainingRoundsFlag !== null) return `Durée ${formatDurationRounds(remainingRoundsFlag, finiteNumber(flags.remainingTurns ?? flags.turnsRemaining) ?? 0)}`;
  const remaining = finiteNumber(duration.remaining);
  if (remaining !== null) return (duration.type === "turns" || duration.type === "rounds") ? `Durée ${formatDurationRounds(remaining)}` : `Durée ${formatDurationSeconds(remaining)}`;
  const rounds = finiteNumber(duration.rounds);
  if (rounds !== null) {
    const startRound = finiteNumber(duration.startRound);
    const currentRound = finiteNumber(game.combat?.round);
    const elapsedRounds = startRound !== null && currentRound !== null ? Math.max(0, currentRound - startRound) : 0;
    return `Durée ${formatDurationRounds(Math.max(0, rounds - elapsedRounds), finiteNumber(duration.turns) ?? 0)}`;
  }
  const seconds = finiteNumber(duration.seconds);
  if (seconds !== null) {
    const startTime = finiteNumber(duration.startTime);
    const worldTime = finiteNumber(game.time?.worldTime);
    const elapsedSeconds = startTime !== null && worldTime !== null ? Math.max(0, worldTime - startTime) : 0;
    return `Durée ${formatDurationSeconds(Math.max(0, seconds - elapsedSeconds))}`;
  }
  const turns = finiteNumber(duration.turns);
  if (turns !== null) return `Durée ${formatDurationRounds(0, turns)}`;
  return "Durée —";
}
function effectKey(effect) { return effect?.uuid ?? effect?.id ?? effect?._id ?? effectDisplayName(effect); }
function effectOriginItem(actor, effect) {
  const flags = effect?.flags?.add2e ?? {};
  const candidates = [flags.itemId, flags.sourceItemId, flags.originItemId, effect?.originItemId, effect?.sourceItemId].filter(Boolean);
  const origin = String(effect?.origin ?? effect?._source?.origin ?? "");
  const matches = [...origin.matchAll(/Item\.([A-Za-z0-9]+)/g)].map(match => match[1]);
  candidates.push(...matches.reverse());
  for (const id of candidates) {
    const item = getItem(actor, id);
    if (item) return item;
  }
  return null;
}
function effectIsFromRaceOrClass(actor, effect) {
  const item = effectOriginItem(actor, effect);
  const itemType = String(item?.type ?? "").toLowerCase();
  const flags = effect?.flags?.add2e ?? {};
  const sourceType = lower(flags.sourceType ?? flags.type ?? flags.kind ?? effect?.sourceType ?? "");
  return itemType === "race" || itemType === "classe" || sourceType === "race" || sourceType === "classe" || flags.race === true || flags.classe === true || flags.classFeature === true || flags.racial === true;
}
function isHudActiveEffect(actor, effect) {
  if (!effect || !effectDisplayName(effect)) return false;
  if (effect.disabled === true || effect.isSuppressed === true || effect.active === false) return false;
  if (effectIsFromRaceOrClass(actor, effect)) return false;
  return true;
}
function addActorEmbeddedEffects(map, actor) {
  for (const effect of actorEffects(actor)) {
    if (!isHudActiveEffect(actor, effect)) continue;
    map.set(effectKey(effect), effect);
  }
}
function effects(actor) {
  const map = new Map();
  addActorEmbeddedEffects(map, actor);
  const tokenActor = tokenFor(actor)?.actor ?? null;
  if (tokenActor && tokenActor !== actor) addActorEmbeddedEffects(map, tokenActor);
  return [...map.values()].sort((a, b) => effectDisplayName(a).localeCompare(effectDisplayName(b)));
}

function ability(actor, key) {
  const direct = Number(actor?.system?.[key]);
  return Number.isFinite(direct) ? direct : num(actor?.system?.[`${key}_base`], 10);
}
function savingThrows(actor) {
  const level = Math.max(1, num(actor?.system?.niveau, 1));
  const row = actor?.system?.details_classe?.progression?.[level - 1];
  const values = arr(row?.savingThrows || actor?.system?.sauvegardes || actor?.system?.savingThrows || []).map(value => num(value, 0));
  return values.length >= 5 ? values.slice(0, 5) : [0, 0, 0, 0, 0];
}
function hp(actor) { return num(actor?.system?.pdv ?? actor?.system?.pv?.value ?? actor?.system?.hp?.value ?? actor?.system?.hp, 0); }
function hpMax(actor) { return num(actor?.system?.points_de_coup ?? actor?.system?.pv?.max ?? actor?.system?.hp?.max ?? actor?.system?.hpMax, hp(actor)); }
function armorClass(actor) { return actor?.system?.ca_total ?? actor?.system?.ca ?? actor?.system?.armorClass ?? actor?.system?.ac ?? "—"; }
function thaco(actor) {
  const direct = actor?.system?.thac0 ?? actor?.system?.thaco ?? actor?.system?.combat?.thac0;
  if (direct !== undefined && direct !== null && direct !== "") return direct;
  const level = Math.max(1, num(actor?.system?.niveau, 1));
  return actor?.system?.details_classe?.progression?.[level - 1]?.thac0 ?? 20;
}

function injectStyle() {
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
#${HUD_ID}{position:fixed;z-index:100;right:auto!important;top:auto!important;min-width:380px;color:#f6e8bd;font-family:var(--font-primary,Signika,sans-serif);pointer-events:auto;user-select:none;touch-action:none}
#${HUD_ID}.collapsed .a2e-hud-panel{display:none!important}
#${HUD_ID} .a2e-hud-shell{border:1px solid #8a611d;border-radius:14px;overflow:hidden;background:linear-gradient(145deg,rgba(32,25,16,.97),rgba(18,14,10,.96));box-shadow:0 8px 26px rgba(0,0,0,.48)}
#${HUD_ID} .a2e-hud-panel{max-height:var(--a2e-hud-menu-max,380px);overflow:auto;padding:9px;border-bottom:1px solid rgba(184,137,36,.45);background:rgba(0,0,0,.13)}
#${HUD_ID} section{display:none}#${HUD_ID} section.active{display:grid;gap:7px}
#${HUD_ID} .a2e-hud-tabs{display:grid;grid-template-columns:repeat(7,1fr);background:rgba(0,0,0,.18);border-bottom:1px solid rgba(184,137,36,.45)}
#${HUD_ID} .a2e-hud-tab{min-height:34px;border:0;border-right:1px solid rgba(184,137,36,.32);background:transparent;color:#d8bd78;font-size:.69em;font-weight:900;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${HUD_ID} .a2e-hud-tab.active{color:#211307;background:linear-gradient(180deg,#f0c66d,#c78d2e)}
#${HUD_ID} .a2e-hud-header{display:grid;grid-template-columns:74px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:9px 10px;background:linear-gradient(180deg,rgba(78,48,18,.78),rgba(36,26,14,.62));cursor:move;touch-action:none}
#${HUD_ID} .portrait{width:64px;height:64px;border-radius:12px;object-fit:cover;border:2px solid #c4973f;background:#111}
#${HUD_ID} .name{color:#fff4cf;font-size:1.12em;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#${HUD_ID} .sub{color:#d8bd78;font-size:.82em;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${HUD_ID} .pills{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}#${HUD_ID} .pill{display:inline-flex;min-height:22px;padding:2px 7px;border:1px solid rgba(214,176,90,.75);border-radius:999px;background:rgba(255,244,201,.12);color:#fff0bd;font-size:.78em;font-weight:850}
#${HUD_ID} .icon{width:30px;height:30px;border:1px solid rgba(214,176,90,.75);border-radius:9px;background:rgba(255,244,201,.12);color:#ffe4a1;cursor:pointer}#${HUD_ID} .resize{cursor:nwse-resize!important}
#${HUD_ID} .row{display:grid;grid-template-columns:42px minmax(0,1fr);gap:8px;align-items:center;min-height:50px;padding:6px;border:1px solid rgba(214,176,90,.38);border-radius:10px;background:rgba(255,250,235,.07)}
#${HUD_ID} .row.compact{grid-template-columns:minmax(0,1fr) auto;min-height:38px}#${HUD_ID} .row.effect-row,#${HUD_ID} .row.equipment-row{grid-template-columns:42px minmax(0,1fr) auto}
#${HUD_ID} .row img{width:36px;height:36px;border-radius:7px;object-fit:cover;border:1px solid rgba(214,176,90,.65);background:rgba(0,0,0,.25)}
#${HUD_ID} .img-act{width:38px;height:38px;padding:0;border:1px solid rgba(214,176,90,.75);border-radius:8px;background:rgba(0,0,0,.22);cursor:pointer;display:flex;align-items:center;justify-content:center}#${HUD_ID} .img-act:hover{filter:brightness(1.22)}#${HUD_ID} .img-act img{width:34px;height:34px;border:0;border-radius:7px}
#${HUD_ID} .title{color:#fff4cf;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#${HUD_ID} .meta{display:flex;flex-wrap:wrap;gap:4px 8px;color:#c8ad6e;font-size:.76em;font-weight:750;margin-top:2px}
#${HUD_ID} .component-title{color:#ffe4a1;border:1px solid rgba(214,176,90,.42);background:rgba(214,176,90,.12);padding:1px 6px;border-radius:999px}#${HUD_ID} .component-ok{color:#b8ffb8;border:1px solid rgba(80,180,80,.55);background:rgba(35,100,35,.35);padding:1px 6px;border-radius:999px}#${HUD_ID} .component-bad{color:#ffb1a8;border:1px solid rgba(190,55,45,.62);background:rgba(110,25,20,.42);padding:1px 6px;border-radius:999px}
#${HUD_ID} .ammo{display:inline-flex;align-items:center;gap:4px;color:#b8ffb8}#${HUD_ID} .ammo-missing{color:#ffb1a8}#${HUD_ID} .ammo-free{color:#ffe4a1;border:1px solid rgba(214,176,90,.4);border-radius:999px;padding:1px 6px;background:rgba(214,176,90,.12)}#${HUD_ID} .ammo img{width:18px;height:18px;border-radius:4px;border:1px solid rgba(214,176,90,.4)}
#${HUD_ID} .money-row{display:flex;flex-wrap:wrap;gap:5px;padding:6px;border:1px solid rgba(214,176,90,.38);border-radius:10px;background:rgba(0,0,0,.18)}#${HUD_ID} .money-title{color:#ffe4a1;font-weight:950;margin-right:3px}#${HUD_ID} .money-pill{border:1px solid rgba(214,176,90,.55);border-radius:999px;padding:2px 7px;background:rgba(214,176,90,.12);color:#fff0bd;font-weight:900;font-size:.78em}#${HUD_ID} .equip-ok{color:#b8ffb8}#${HUD_ID} .equip-off{color:#ffcf91}
#${HUD_ID} .act{min-width:78px;min-height:30px;padding:4px 9px;border:1px solid #d6b05a;border-radius:9px;background:linear-gradient(180deg,#fff0bd,#d6a345);color:#211307;font-size:.8em;font-weight:950;cursor:pointer;white-space:nowrap}#${HUD_ID} .danger{min-width:36px;width:36px;color:#ffd0c8;border-color:#b94735;background:linear-gradient(180deg,#7d241b,#42120d)}#${HUD_ID} .empty{padding:12px;border:1px dashed rgba(214,176,90,.45);border-radius:10px;color:#c8ad6e;font-style:italic;text-align:center}
#${HUD_ID} .spell-layout{display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px}#${HUD_ID} .spell-levels{display:flex;flex-wrap:wrap;gap:6px;padding-bottom:2px;border-bottom:1px solid rgba(214,176,90,.28)}#${HUD_ID} .spell-level{min-height:30px;padding:5px 10px;border:1px solid rgba(214,176,90,.55);border-radius:999px;background:rgba(214,176,90,.12);color:#ffe4a1;font-weight:950;font-size:.82em;cursor:pointer}#${HUD_ID} .spell-level.active{background:linear-gradient(180deg,#f0c66d,#c78d2e);color:#211307}#${HUD_ID} .spell-list{display:grid;gap:6px;max-height:260px;overflow-y:auto;padding-right:3px}#${HUD_ID} .spell-list-title{color:#ffe4a1;font-weight:950;font-size:.82em;margin:0 0 2px 2px}
#${HUD_ID} .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}#${HUD_ID} .cell{display:grid;grid-template-columns:38px minmax(0,1fr);gap:8px;align-items:center;min-height:48px;padding:8px;border-radius:12px;border:1px solid rgba(214,176,90,.38);background:rgba(255,250,235,.07)}#${HUD_ID} .cell b{display:block;color:#ffe4a1;font-size:1.32em;font-weight:950;line-height:1.05;text-shadow:0 1px 2px rgba(0,0,0,.45)}#${HUD_ID} .roll-icon{width:36px;height:36px;min-width:36px;padding:0;border-radius:10px;border:1px solid rgba(214,176,90,.65);background:rgba(255,244,201,.12);color:#ffe4a1;cursor:pointer}#${HUD_ID} .roll-icon:hover{filter:brightness(1.2)}#${HUD_ID} button,#${HUD_ID} [data-action],#${HUD_ID} [data-tab]{user-select:auto;touch-action:auto}`;
  document.head.appendChild(style);
}

function weaponRows(actor) {
  const rows = weapons(actor);
  if (!rows.length) return `<div class="empty">Aucune arme équipée.</div>`;
  return rows.map(item => {
    const projectile = equippedProjectile(actor, item);
    const propelled = isPropelledWeapon(item);
    const dmg = propelled && projectile ? `Dégâts projectile ${damage(projectile)}` : `Dégâts ${damage(item)}`;
    const ammo = propelled
      ? (usesProjectileInventory(actor)
        ? (projectile ? `<span class="ammo"><img src="${esc(projectile.img || "icons/svg/target.svg")}" alt="">${esc(projectile.name)} ×${esc(quantity(projectile))}</span>` : `<span class="ammo-missing">Aucune munition équipée</span>`)
        : `<span class="ammo-free">Munition PNJ non suivie</span>`)
      : "";
    return `<div class="row"><button type="button" class="img-act" data-action="attack" data-item-id="${esc(item.id)}" title="Attaquer avec ${esc(item.name)}"><img src="${esc(item.img || "icons/svg/sword.svg")}" alt=""></button><div><div class="title">${esc(item.name)}</div><div class="meta"><span>${esc(dmg)}</span><span>Portée ${esc(range(item))}</span>${ammo}</div></div></div>`;
  }).join("");
}
function spellRows(actor) {
  const rows = spells(actor).sort((a, b) => String(spellListLabel(a)).localeCompare(String(spellListLabel(b))) || spellLevel(a) - spellLevel(b) || String(a.name).localeCompare(String(b.name)));
  if (!rows.length) return `<div class="empty">Aucun sort mémorisé.</div>`;
  const groups = new Map();
  for (const spell of rows) {
    const key = spellGroupKey(spell);
    if (!groups.has(key)) groups.set(key, { key, label: spellListLabel(spell), level: spellLevel(spell), items: [] });
    groups.get(key).items.push(spell);
  }
  const list = [...groups.values()];
  if (!selectedSpellGroup || !groups.has(selectedSpellGroup)) selectedSpellGroup = list[0].key;
  const active = groups.get(selectedSpellGroup) ?? list[0];
  const buttons = list.map(group => `<button type="button" class="spell-level ${group.key === active.key ? "active" : ""}" data-action="select-spell-group" data-spell-group="${esc(group.key)}">${esc(group.label)} niv. ${esc(group.level || "—")} <span>${group.items.length}</span></button>`).join("");
  const spellsHtml = active.items.map(spell => `<div class="row"><button type="button" class="img-act" data-action="cast-spell" data-item-id="${esc(spell.id)}" title="Lancer ${esc(spell.name)}"><img src="${esc(spell.img || "icons/svg/book.svg")}" alt=""></button><div><div class="title">${esc(spell.name)}</div><div class="meta"><span>Mémorisé ${preparedCount(spell)}</span>${spellComponentBadges(actor, spell)}</div></div></div>`).join("");
  return `<div class="spell-layout"><div class="spell-levels">${buttons}</div><div class="spell-list"><div class="spell-list-title">${esc(active.label)} niveau ${esc(active.level || "—")}</div>${spellsHtml}</div></div>`;
}
function featureRows(actor) {
  const rows = features(actor);
  if (!rows.length) return `<div class="empty">Aucune capacité utilisable.</div>`;
  return rows.map((feature, index) => `<div class="row compact"><div><div class="title">${esc(globalThis.add2eFeatureName?.(feature) || feature.name || feature.label || feature.nom || `Capacité ${index + 1}`)}</div><div class="meta"><span>Capacité de classe</span></div></div><button type="button" class="act" data-action="use-feature" data-feature-index="${index}">Utiliser</button></div>`).join("");
}
function effectRows(actor) {
  const rows = effects(actor);
  if (!rows.length) return `<div class="empty">Aucun effet actif.</div>`;
  return rows.map(effect => `<div class="row effect-row"><img src="${esc(effect.img || effect.icon || "icons/svg/aura.svg")}" alt=""><div><div class="title">${esc(effectDisplayName(effect))}</div><div class="meta"><span>${esc(effectDurationLabel(effect))}</span></div></div><button type="button" class="act danger" data-action="remove-effect" data-effect-id="${esc(effect.id ?? effect._id ?? "")}"><i class="fas fa-trash"></i></button></div>`).join("");
}
function saveRows(actor) {
  const values = savingThrows(actor);
  return `<div class="grid">${SAVES.map((save, index) => `<div class="cell"><button type="button" class="roll-icon" data-action="roll-save" data-save-index="${index}" title="Jet ${esc(save[1])}"><i class="fas ${save[2]}"></i></button><div><b>${esc(save[1])} ${esc(values[index] || "—")}</b></div></div>`).join("")}</div>`;
}
function abilityRows(actor) {
  return `<div class="grid">${CARACS.map(carac => `<div class="cell"><button type="button" class="roll-icon" data-action="roll-ability" data-ability="${carac[0]}" title="Jet ${esc(carac[1])}"><i class="fas ${carac[3]}"></i></button><div><b>${carac[1]} ${esc(ability(actor, carac[0]))}</b></div></div>`).join("")}</div>`;
}
function hudHtml(actor, token = null) {
  const img = token?.document?.texture?.src || actor.img || "icons/svg/mystery-man.svg";
  const isMonster = isMonsterActor(actor);
  const race = isMonster ? (actor.system?.type ?? "Monstre") : (actor.system?.race || actor.system?.details_race?.label || actorItems(actor).find(item => item.type === "race")?.name || "Race");
  const classe = isMonster ? (actor.system?.taille ?? actor.system?.size ?? "MJ") : (actor.system?.classe || actor.system?.details_classe?.label || actorItems(actor).find(item => item.type === "classe")?.name || "Classe");
  const niveau = isMonster ? (actor.system?.dv ?? actor.system?.hitDice ?? actor.system?.niveau ?? "—") : (actor.system?.niveau ?? "—");
  const tab = (key, icon, label) => `<button type="button" class="a2e-hud-tab ${activeTab === key ? "active" : ""}" data-tab="${key}"><i class="${icon}"></i> ${label}</button>`;
  const section = (key, html) => `<section class="${activeTab === key ? "active" : ""}" data-section="${key}">${html}</section>`;
  return `<div class="a2e-hud-shell" data-drag-handle="1"><div class="a2e-hud-panel">${section("attaques", weaponRows(actor))}${section("sorts", spellRows(actor))}${section("capacites", featureRows(actor))}${section("equipement", equipmentRows(actor))}${section("effets", effectRows(actor))}${section("sauvegardes", saveRows(actor))}${section("caracs", abilityRows(actor))}</div><nav class="a2e-hud-tabs">${tab("attaques", "fas fa-swords", "Armes")}${tab("sorts", "fas fa-book", "Sorts")}${tab("capacites", "fas fa-bolt", "Capacités")}${tab("equipement", "fas fa-box-open", "Équipement")}${tab("effets", "fas fa-hourglass-half", "Effets")}${tab("sauvegardes", "fas fa-shield-alt", "Sauv.")}${tab("caracs", "fas fa-dice-d20", "Carac.")}</nav><div class="a2e-hud-header" data-drag-handle="1"><img class="portrait" src="${esc(img)}" alt=""><div><div class="name">${esc(actor.name)}</div><div class="sub">${esc(race)} — ${esc(classe)} ${isMonster ? "DV" : "niv."} ${esc(niveau)}</div><div class="pills"><span class="pill">PV ${hp(actor)} / ${hpMax(actor)}</span><span class="pill">CA ${esc(armorClass(actor))}</span><span class="pill">THAC0 ${esc(thaco(actor))}</span></div></div><button type="button" class="icon" data-action="toggle-collapse"><i class="fas fa-chevron-down"></i></button><button type="button" class="icon resize" data-resize-handle="1"><i class="fas fa-up-right-and-down-left-from-center"></i></button></div></div>`;
}
function renderHud(actor = null, token = null, { reason = "render" } = {}) {
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
function refreshHud(reason = "refresh", options = {}) {
  const target = options?.token?.actor && relevant(options.token.actor)
    ? { actor: options.token.actor, token: options.token, ambiguous: false }
    : hudTargetFromControlledSelection({ allowCharacterFallback: options.allowCharacterFallback !== false });
  if (!target.actor) {
    if (!target.ambiguous && options.closeWhenEmpty === true) closeHud();
    return false;
  }
  return renderHud(target.actor, target.token, { reason });
}
function closeHud() { hud()?.remove(); hudActor = null; hudToken = null; }
function bindDirectHudPointerEvents(element) {
  if (!element || element.__add2eDirectDragBindingV51) return;
  element.__add2eDirectDragBindingV51 = true;
  element.addEventListener("pointerdown", pointerDown, true);
  element.addEventListener("mousedown", pointerDown, true);
  element.addEventListener("touchstart", pointerDown, { capture: true, passive: false });
}
function bindHudEvents(element, actor) {
  bindDirectHudPointerEvents(element);
  element.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    const next = button.dataset.tab || "attaques";
    if (activeTab === next && !element.classList.contains("collapsed")) return setCollapsed(true, true);
    activeTab = next;
    renderHud(actor, tokenFor(actor), { reason: "tab" });
    setCollapsed(false, true);
  }));
  element.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", event => handleAction(event, actor, button)));
}
async function handleAction(event, actor, button) {
  event.preventDefault();
  event.stopPropagation();
  const action = button.dataset.action;
  try {
    if (action === "toggle-collapse") return setCollapsed(!hud()?.classList.contains("collapsed"), true);
    if (action === "select-spell-group") { selectedSpellGroup = button.dataset.spellGroup || selectedSpellGroup; return renderHud(actor, tokenFor(actor), { reason: "select-spell-group" }); }
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
  const arme = getItem(actor, itemId);
  if (!arme) return ui.notifications.warn("Arme introuvable.");
  if (typeof globalThis.add2eAttackRoll !== "function") return ui.notifications.error("Fonction add2eAttackRoll introuvable.");
  return globalThis.add2eAttackRoll({ actor, arme });
}
async function sheetCastSpell(actor, itemId) {
  const sort = getItem(actor, itemId);
  if (!sort) return ui.notifications.warn("Sort introuvable.");
  if (typeof globalThis.add2eCastSpell !== "function") return ui.notifications.error("Fonction add2eCastSpell introuvable.");
  return globalThis.add2eCastSpell({ actor, sort });
}
async function sheetRollAbility(actor, carac) {
  if (typeof globalThis.add2eRollCharacteristicCard !== "function") return ui.notifications.error("Fonction add2eRollCharacteristicCard introuvable.");
  return globalThis.add2eRollCharacteristicCard(actor, carac);
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
  await item.update({
    "system.equipee": next,
    "system.equipped": next,
    "system.estEquipee": next,
    "system.worn": next
  }, { add2eReason: "hud-toggle-equipment" });
  return renderHud(actor, hudToken, { reason: "toggle-equipment" });
}
async function removeEffect(actor, effectId) {
  const effect = actor?.effects?.get?.(effectId) ?? effects(actor).find(e => String(e.id ?? e._id ?? "") === String(effectId));
  if (!effect) return ui.notifications.warn("Effet introuvable.");
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  const ok = DialogV2?.confirm ? await DialogV2.confirm({
    window: { title: "Supprimer l'effet" },
    content: `<p>Supprimer <strong>${esc(effectDisplayName(effect))}</strong> ?</p>`,
    yes: { label: "Supprimer", icon: "fas fa-trash" },
    no: { label: "Annuler" }
  }) : true;
  if (!ok) return false;
  if (actor?.effects?.get?.(effect.id)) await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id]);
  else if (typeof effect.delete === "function") await effect.delete();
  return renderHud(actor, hudToken, { reason: "remove-effect" });
}
function primary(event) { return event.button === undefined || event.button === 0; }
function pointerClient(event) {
  const touch = event.touches?.[0] ?? event.changedTouches?.[0] ?? null;
  return { x: touch?.clientX ?? event.clientX ?? 0, y: touch?.clientY ?? event.clientY ?? 0 };
}
function dragEvents(event) {
  if (event.type === "mousedown") return { move: "mousemove", up: "mouseup" };
  if (event.type === "touchstart") return { move: "touchmove", up: "touchend" };
  return { move: "pointermove", up: "pointerup" };
}
function startResize(event) {
  const handle = event.target?.closest?.("[data-resize-handle]");
  const element = event.target?.closest?.(`#${HUD_ID}`);
  if (!handle || !element || !primary(event)) return false;
  event.preventDefault();
  event.stopPropagation();
  resizing = true;
  const events = dragEvents(event);
  const startState = loadState();
  const startPoint = pointerClient(event);
  const start = { x: startPoint.x, y: startPoint.y, width: startState.width, maxMenuHeight: startState.maxMenuHeight, left: startState.left, bottom: startState.bottom };
  const move = moveEvent => {
    moveEvent.preventDefault?.();
    const point = pointerClient(moveEvent);
    const current = loadState();
    current.width = clamp(start.width + point.x - start.x, 380, Math.max(420, window.innerWidth));
    current.maxMenuHeight = clamp(start.maxMenuHeight + point.y - start.y, 120, Math.max(160, window.innerHeight - 60));
    current.bottom = start.bottom;
    applyGeometry(element, true);
  };
  const up = () => {
    window.removeEventListener(events.move, move, true);
    window.removeEventListener(events.up, up, true);
    resizing = false;
    const current = loadState();
    saveState({ width: element.offsetWidth || current.width, maxMenuHeight: current.maxMenuHeight, left: current.left, bottom: current.bottom, top: null });
    applyGeometry(element, true);
  };
  window.addEventListener(events.move, move, true);
  window.addEventListener(events.up, up, true);
  return true;
}
function startDrag(event) {
  const element = event.target?.closest?.(`#${HUD_ID}`);
  const handle = event.target?.closest?.("[data-drag-handle]");
  if (!element || !handle || !primary(event) || event.target.closest?.("button,a,input,select,textarea,[data-action],[data-tab],[data-resize-handle]")) return false;
  event.preventDefault();
  event.stopPropagation();
  dragging = true;
  manualIntentUntil = Date.now() + 1200;
  const events = dragEvents(event);
  const state0 = loadState();
  const startPoint = pointerClient(event);
  const start = { x: startPoint.x, y: startPoint.y, left: state0.left, bottom: state0.bottom };
  const move = moveEvent => {
    moveEvent.preventDefault?.();
    const point = pointerClient(moveEvent);
    const current = loadState();
    const width = element.offsetWidth || current.width || 680;
    const height = element.offsetHeight || 110;
    const minLeft = Math.min(EDGE_PAD, window.innerWidth - HANDLE_VISIBLE);
    const maxLeft = Math.max(EDGE_PAD, window.innerWidth - Math.min(width, HANDLE_VISIBLE));
    const maxBottom = Math.max(EDGE_PAD, window.innerHeight - Math.min(height, HANDLE_VISIBLE));
    current.left = clamp(start.left + point.x - start.x, minLeft, maxLeft);
    current.bottom = clamp(start.bottom - (point.y - start.y), EDGE_PAD, maxBottom);
    current.top = null;
    applyGeometry(element, true);
    saveState({ left: Math.round(current.left), bottom: Math.round(current.bottom), top: null });
  };
  const up = () => {
    window.removeEventListener(events.move, move, true);
    window.removeEventListener(events.up, up, true);
    dragging = false;
    applyGeometry(element, true);
  };
  window.addEventListener(events.move, move, true);
  window.addEventListener(events.up, up, true);
  return true;
}
function pointerDown(event) {
  if (dragging || resizing) return;
  if (startResize(event)) return;
  startDrag(event);
}
function tokenFromCanvasPointer(event) {
  let object = event?.target ?? null;
  for (let guard = 0; object && guard < 12; guard += 1) {
    if (object?.actor && object?.document) return object;
    if (object?.object?.actor && object?.object?.document) return object.object;
    object = object.parent ?? null;
  }
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
function bindCanvasControlledTokenClick() {
  if (canvasTokenClickBound || !canvas?.stage?.on) return;
  canvasTokenClickBound = true;
  canvas.stage.on("pointerdown", onCanvasTokenPointerDown);
}
function currentCombatant(combat = game.combat) {
  if (!combat) return null;
  const id = combat.current?.combatantId ?? combat.combatantId ?? null;
  return (id ? combat.combatants?.get?.(id) : null) ?? combat.combatant ?? combat.turns?.[Number(combat.current?.turn ?? combat.turn)] ?? null;
}
function tokenFromCombatant(combatant) { return combatant?.token?.object ?? (combatant?.tokenId ? canvas?.tokens?.get?.(combatant.tokenId) : null) ?? null; }
function followCombat(combat = game.combat, forceOpen = false) {
  if (Date.now() < manualIntentUntil) return false;
  const combatant = currentCombatant(combat);
  if (!combatant?.actor || (!forceOpen && !hud())) return false;
  return renderHud(combatant.actor, tokenFromCombatant(combatant), { reason: "combat" });
}

Hooks.once("init", () => {
  game.add2e = game.add2e ?? {};
  game.add2e.actionHudVersion = ADD2E_ACTION_HUD_VERSION;
  game.add2e.openActionHud = (actor = null) => {
    const target = actor ? { actor, token: tokenFor(actor) } : hudTargetFromControlledSelection({ allowCharacterFallback: true });
    return renderHud(target.actor, target.token, { reason: "api-open" });
  };
  game.add2e.closeActionHud = closeHud;
  game.add2e.refreshActionHud = () => hudActor ? renderHud(hudActor, hudToken, { reason: "api-refresh-current" }) : refreshHud("api-refresh");
  game.add2e.resetActionHudPosition = resetHudPosition;
  Object.assign(globalThis, {
    add2eRenderActionHud: renderHud,
    add2eRefreshActionHud: refreshHud,
    add2eCloseActionHud: closeHud,
    add2eResetActionHudPosition: resetHudPosition,
    add2eHudCheck: () => ({
      version: ADD2E_ACTION_HUD_VERSION,
      actor: currentActor()?.name ?? null,
      actorId: currentActor()?.id ?? null,
      controlledTokens: controlledRelevantTokens().map(token => ({ id: token.id, actor: token.actor?.name ?? null, actorId: token.actor?.id ?? null })),
      activeTab,
      selectedSpellGroup,
      attackRoll: typeof globalThis.add2eAttackRoll,
      castSpell: typeof globalThis.add2eCastSpell,
      rollCarac: typeof globalThis.add2eRollCharacteristicCard,
      rollSave: typeof globalThis.add2eRollSaveCard,
      featureUse: typeof globalThis.add2eExecuteClassFeatureOnUse,
      hud: !!hud()
    })
  });
  console.log(`${TAG}[INIT]`, ADD2E_ACTION_HUD_VERSION);
});
Hooks.once("ready", () => {
  document.addEventListener("pointerdown", pointerDown, true);
  document.addEventListener("mousedown", pointerDown, true);
  document.addEventListener("touchstart", pointerDown, true);
  window.addEventListener("resize", () => applyGeometry(hud(), true));
  setTimeout(() => {
    bindCanvasControlledTokenClick();
    refreshHud("ready", { allowCharacterFallback: true, closeWhenEmpty: false });
  }, 300);
});
Hooks.on("controlToken", (token, controlled) => {
  manualIntentUntil = Date.now() + 500;
  setTimeout(() => {
    bindCanvasControlledTokenClick();
    if (controlled && token?.actor && relevant(token.actor)) return renderHud(token.actor, token, { reason: "controlToken-selected" });
    return refreshHud("controlToken", { allowCharacterFallback: true, closeWhenEmpty: true });
  }, 60);
});
Hooks.on("canvasReady", () => setTimeout(() => { bindCanvasControlledTokenClick(); refreshHud("canvasReady", { allowCharacterFallback: true, closeWhenEmpty: false }); }, 150));
Hooks.on("updateCombat", combat => setTimeout(() => followCombat(combat, false), 80));
Hooks.on("combatTurn", combat => setTimeout(() => followCombat(combat, false), 80));
Hooks.on("combatRound", combat => setTimeout(() => followCombat(combat, false), 80));
Hooks.on("updateActor", actor => { if (actor?.id === hudActor?.id && !dragging && !resizing) setTimeout(() => renderHud(actor, hudToken, { reason: "updateActor" }), 80); });
for (const hookName of ["createItem", "updateItem", "deleteItem", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
  Hooks.on(hookName, doc => {
    const actor = doc?.parent;
    if (actor?.id === hudActor?.id && !dragging && !resizing) setTimeout(() => renderHud(actor, hudToken, { reason: hookName }), 80);
  });
}

export { renderHud as add2eRenderActionHud, refreshHud as add2eRefreshActionHud, closeHud as add2eCloseActionHud };
