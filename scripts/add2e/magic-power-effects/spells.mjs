// ADD2E — Pouvoirs d'objets magiques / sorts liés et sélecteur de compendium.

import {
  INTERNAL_ON_USE, SPELL_PACK_ID, clone, esc, executionResult, getSpellIndexPromise,
  hasValue, merge, norm, number, powerArray, powerName, setSpellIndexPromise
} from "./runtime.mjs";
import { actorToken, powerContext } from "./targeting.mjs";

export function onUsePath(document) {
  return String(
    document?.onUse ?? document?.onuse ?? document?.on_use ?? document?.script ?? document?.macro
    ?? document?.system?.onUse ?? document?.system?.onuse ?? document?.system?.on_use ?? document?.system?.script
    ?? ""
  ).trim();
}

export async function executeScript(actor, item, power, index, path, linkedSpell = null) {
  if (!path || path === INTERNAL_ON_USE) return null;
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const code = await response.text();
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  const source = linkedSpell ?? item;
  const token = actorToken(actor);
  const scope = {
    actor,
    item: source,
    sourceItem: item,
    objectItem: item,
    sort: linkedSpell,
    linkedSpell,
    token,
    power,
    pouvoir: power,
    powerIndex: index,
    isObjectPower: true
  };
  const args = [{ ...scope, scope }];
  const runner = new AsyncFunction(
    "actor", "item", "sourceItem", "objectItem", "sort", "linkedSpell", "token", "power", "pouvoir", "powerIndex", "scope", "args",
    "game", "ui", "ChatMessage", "Roll", "foundry", "canvas",
    code
  );
  const result = await runner(actor, source, item, item, linkedSpell, linkedSpell, token, power, power, index,
    scope, args, game, ui, ChatMessage, Roll, foundry, canvas);
  return executionResult(result === false ? "failed" : "success", { handled: "linked-script", path, ok: result !== false });
}

const spellLevel = spell => Math.max(1, Number(spell?.system?.niveau ?? spell?.system?.level ?? spell?.niveau ?? spell?.level ?? 1) || 1);

function packIndexEntries(index) {
  if (!index) return [];
  if (Array.isArray(index.contents)) return index.contents;
  if (typeof index.values === "function") return [...index.values()];
  try { return [...index]; } catch (_error) { return []; }
}

export async function spellIndex({ force = false } = {}) {
  if (force) setSpellIndexPromise(null);
  if (getSpellIndexPromise()) return getSpellIndexPromise();
  return setSpellIndexPromise((async () => {
    const pack = game.packs?.get?.(SPELL_PACK_ID);
    if (!pack || String(pack.documentName ?? pack.metadata?.type ?? "") !== "Item") return [];
    let index;
    try { index = await pack.getIndex({ fields: ["name", "type", "img", "system.niveau", "system.level"] }); }
    catch (_error) {
      try { index = await pack.getIndex(); } catch (_indexError) { return []; }
    }
    return packIndexEntries(index)
      .filter(entry => String(entry?.type ?? "").toLowerCase() === "sort")
      .map(entry => ({
        uuid: `Compendium.${SPELL_PACK_ID}.${entry._id}`,
        name: String(entry.name ?? "Sort"),
        img: entry.img ?? "icons/svg/book.svg",
        level: spellLevel(entry),
        source: String(pack.title ?? pack.metadata?.label ?? SPELL_PACK_ID)
      }))
      .sort((left, right) => Number(left.level) - Number(right.level) || left.name.localeCompare(right.name, "fr"));
  })());
}

export function spellOptions(entries, selectedUuid = "", selectedName = "") {
  const selectedUuidText = String(selectedUuid ?? "").trim();
  const wantedName = norm(selectedName);
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.source)) groups.set(entry.source, []);
    groups.get(entry.source).push(entry);
  }
  const html = [...groups.entries()].map(([source, spells]) => {
    const options = spells.map(entry => {
      const selected = entry.uuid === selectedUuidText || (!selectedUuidText && wantedName && norm(entry.name) === wantedName);
      return `<option value="${esc(entry.uuid)}" data-spell-name="${esc(entry.name)}"${selected ? " selected" : ""}>Niv. ${Number(entry.level) || 1} — ${esc(entry.name)}</option>`;
    }).join("");
    return `<optgroup label="${esc(source)}">${options}</optgroup>`;
  }).join("");
  return `<option value="">— Choisir un sort du compendium —</option>${html}`;
}

export async function chooseSpell(currentUuid = "", currentName = "") {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) throw new Error("DialogV2 est indisponible.");
  const entries = await spellIndex();
  if (!entries.length) {
    ui.notifications.warn(`Le compendium ${SPELL_PACK_ID} ne contient aucun Item de type sort disponible.`);
    return null;
  }
  return DialogV2.wait({
    window: { title: "Choisir le sort équivalent" },
    modal: true,
    rejectClose: false,
    content: `<div class="add2e-dialog" style="min-width:620px;padding:10px;display:grid;gap:8px;"><p style="margin:0;">Choisissez dans le compendium ADD2E le sort que l'objet pourra lancer.</p><select name="spellUuid" size="14" style="width:100%;">${spellOptions(entries, currentUuid, currentName)}</select></div>`,
    buttons: [
      {
        action: "select",
        label: "Utiliser ce sort",
        icon: "fa-solid fa-wand-magic-sparkles",
        default: true,
        callback: (_event, button, dialog) => {
          const root = button?.form ?? dialog?.element;
          const select = root?.querySelector?.('[name="spellUuid"]');
          const uuid = String(select?.value ?? "").trim();
          const name = String(select?.selectedOptions?.[0]?.dataset?.spellName ?? "").trim();
          return uuid ? { uuid, name } : null;
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
  });
}

export async function resolveSpell(reference = {}) {
  const uuid = String(reference.spellUuid ?? reference.uuid ?? reference.sourceUuid ?? reference.sourceId ?? "").trim();
  const allowedPrefix = `Compendium.${SPELL_PACK_ID}.`;
  if (uuid) {
    if (!uuid.startsWith(allowedPrefix) || typeof fromUuid !== "function") return null;
    try {
      const document = await fromUuid(uuid);
      return document?.documentName === "Item" && String(document.type ?? "").toLowerCase() === "sort" ? document : null;
    } catch (_error) { return null; }
  }
  const name = norm(reference.spellName ?? reference.name ?? reference.nom ?? "");
  if (!name) return null;
  const entry = (await spellIndex()).find(candidate => norm(candidate.name) === name);
  if (!entry || typeof fromUuid !== "function") return null;
  try {
    const document = await fromUuid(entry.uuid);
    return document?.documentName === "Item" && String(document.type ?? "").toLowerCase() === "sort" ? document : null;
  } catch (_error) { return null; }
}

export function linkedSpellEffect(power) {
  return (power?.effects ?? []).find(effect => norm(effect?.type ?? effect?.kind) === "linked_spell") ?? null;
}

function cleanSpellSource(spell) {
  const data = clone(spell?.toObject?.() ?? spell ?? {});
  delete data._id;
  delete data.folder;
  delete data.sort;
  delete data.ownership;
  delete data._stats;
  for (const effect of data.effects ?? []) {
    delete effect._id;
    delete effect.folder;
    delete effect.sort;
    delete effect._stats;
  }
  return data;
}

const linkedSpellCost = (power, effect) => {
  const value = number(effect?.chargeCost, power?.parameters?.chargeCost, power?.chargeCost, power?.cost, power?.cout);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
};

function buildVirtualSpell(actor, item, power, index, effect, spell) {
  let data = cleanSpellSource(spell);
  const overrides = effect?.overrides && typeof effect.overrides === "object" && !Array.isArray(effect.overrides) ? clone(effect.overrides) : {};
  const topLevelOverride = ["system", "flags", "name", "img", "effects", "type"]
    .some(key => Object.prototype.hasOwnProperty.call(overrides, key));
  if (Object.keys(overrides).length) data = topLevelOverride ? merge(data, overrides) : { ...data, system: merge(data.system ?? {}, overrides) };
  data._id = foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2, 18);
  data.type = "sort";
  data.name = String(data.name ?? spell.name ?? effect.spellName ?? powerName(power, item));
  data.img = data.img || spell.img || item.img || "icons/svg/book.svg";
  data.system ??= {};
  data.flags ??= {};
  data.flags.add2e ??= {};
  const casterLevel = number(effect?.casterLevel, power?.parameters?.casterLevel);
  const activationTime = effect?.activationTime ?? power?.parameters?.activationTime;
  const cost = linkedSpellCost(power, effect);
  const max = Math.max(1, Number(item.system?.charges?.max ?? item.system?.max_charges ?? item.system?.maxCharges ?? item.system?.chargesMax ?? 1) || 1);
  Object.assign(data.system, {
    isPower: true,
    isObjectPower: true,
    sourceItemId: item.id,
    sourceWeaponId: item.id,
    sourceItemName: item.name,
    powerIndex: index,
    cost,
    cout: cost,
    max,
    linkedSpellUuid: spell.uuid ?? effect.spellUuid ?? ""
  });
  if (Number.isFinite(casterLevel) && casterLevel > 0) {
    data.system.casterLevel = casterLevel;
    data.system.niveauLanceur = casterLevel;
    data.system.niveau_lanceur = casterLevel;
    data.flags.add2e.casterLevel = casterLevel;
  }
  if (hasValue(activationTime)) data.system.temps_incantation = activationTime;
  Object.assign(data.flags.add2e, {
    sourceType: "objet_magique",
    sourceItemId: item.id,
    sourceItemName: item.name,
    magicPowerId: power.catalogueId ?? power.id ?? "",
    powerIndex: index,
    linkedSpellUuid: spell.uuid ?? effect.spellUuid ?? ""
  });
  return new CONFIG.Item.documentClass(data, { parent: actor });
}

async function persistSpellChoice(item, index, selection) {
  if (!item || !selection?.uuid || !Number.isInteger(Number(index))) return false;
  const powers = powerArray(item).map(clone);
  const stored = powers[Number(index)];
  if (!stored) return false;
  stored.parameters ??= {};
  stored.parameters.spellUuid = selection.uuid;
  stored.parameters.spellName = selection.name;
  if (Array.isArray(stored.effects)) {
    stored.effects = stored.effects.map(effect => norm(effect?.type ?? effect?.kind) === "linked_spell"
      ? { ...effect, spellUuid: selection.uuid, spellName: selection.name } : effect);
  }
  await item.update({ "system.pouvoirs": powers }, {
    add2eMagicPowerEffectsAdapter: true,
    add2eMagicPowerExecution: true,
    render: false
  });
  return true;
}

export async function linkedSpellHandler(context) {
  const { actor, item, power, index, effect } = context;
  let reference = {
    spellUuid: effect?.spellUuid ?? power?.parameters?.spellUuid,
    spellName: effect?.spellName ?? power?.parameters?.spellName
  };
  let spell = await resolveSpell(reference);
  if (!spell) {
    const selection = await chooseSpell(reference.spellUuid, reference.spellName);
    if (!selection) return executionResult("cancelled", { handled: "linked-spell", chargesManaged: true, consumeCharges: false });
    reference = { spellUuid: selection.uuid, spellName: selection.name };
    spell = await resolveSpell(reference);
    if (!spell) throw new Error(`Le sort « ${selection.name || selection.uuid} » est introuvable.`);
    effect.spellUuid = selection.uuid;
    effect.spellName = selection.name;
    power.parameters ??= {};
    power.parameters.spellUuid = selection.uuid;
    power.parameters.spellName = selection.name;
    await persistSpellChoice(item, index, selection);
  }
  if (typeof globalThis.add2eCastSpell !== "function") throw new Error("Le moteur add2eCastSpell est indisponible.");
  const virtualSpell = buildVirtualSpell(actor, item, power, index, effect, spell);
  const launched = await globalThis.add2eCastSpell({ actor, sort: virtualSpell, mode: "power", sourceItem: item });
  return executionResult(launched === true ? "success" : "failed", {
    ok: launched === true,
    handled: "linked-spell",
    chargesManaged: true,
    consumeCharges: false,
    spellUuid: spell.uuid,
    spellName: spell.name
  });
}

export async function linkedPower(actor, item, power, index) {
  const linkedEffect = linkedSpellEffect(power);
  if (linkedEffect) return linkedSpellHandler(powerContext(actor, item, power, index, linkedEffect));
  const direct = onUsePath(power) || onUsePath(power.linkedSpell);
  if (direct) return executeScript(actor, item, power, index, direct);
  const linked = power.linkedSpell;
  if (!linked) return null;
  const spell = await resolveSpell(linked);
  const path = onUsePath(spell);
  return path ? executeScript(actor, item, power, index, path, spell) : null;
}

function rootOf(app, html) {
  return html instanceof HTMLElement ? html
    : html?.[0] instanceof HTMLElement ? html[0]
      : app?.element instanceof HTMLElement ? app.element
        : app?.element?.[0] instanceof HTMLElement ? app.element[0] : null;
}

const MAGIC_PARAMETER_UI_VERSION = "2026-07-22-magic-parameter-ui-v1";

function ensureMagicParameterStyles() {
  globalThis.ADD2E_SPELL_DIALOG_UI?.ensureStyles?.();
  const id = "add2e-magic-parameter-ui-style";
  const previous = document.getElementById(id);
  if (previous?.dataset?.version === MAGIC_PARAMETER_UI_VERSION) return;
  previous?.remove();
  const style = document.createElement("style");
  style.id = id;
  style.dataset.version = MAGIC_PARAMETER_UI_VERSION;
  style.textContent = `
.application.add2e-spell-dialog-window .add2e-magic-power-parameter-form{min-width:0!important;padding:0!important;display:grid!important;gap:10px!important}
.application.add2e-spell-dialog-window .add2e-magic-power-parameter-form>.form-group{display:grid!important;grid-template-columns:minmax(170px,220px) minmax(0,1fr)!important;align-items:center!important;gap:10px!important;padding:8px 10px!important;margin:0!important;border:1px solid var(--a2e-border,#c99a36)!important;border-radius:9px!important;background:rgba(255,253,244,.86)!important}
.application.add2e-spell-dialog-window .add2e-magic-power-parameter-form>.form-group label{font-weight:900!important;color:var(--a2e-dark,#6f4b12)!important}
.application.add2e-spell-dialog-window .add2e-magic-power-parameter-form input:not([type="hidden"]),.application.add2e-spell-dialog-window .add2e-magic-power-parameter-form select,.application.add2e-spell-dialog-window .add2e-magic-power-parameter-form textarea{width:100%!important;min-height:36px!important;border:1px solid var(--a2e-border,#c99a36)!important;border-radius:8px!important;background:#fffaf0!important;color:var(--a2e-text,#2d2011)!important;padding:6px 8px!important}
.application.add2e-spell-dialog-window .add2e-magic-power-parameter-form textarea{min-height:76px!important;resize:vertical!important}
.application.add2e-spell-dialog-window .dialog-buttons button{border:1px solid var(--a2e-border,#c99a36)!important;border-radius:9px!important;background:#fffaf0!important;color:var(--a2e-text,#2d2011)!important;font-weight:850!important}
.application.add2e-spell-dialog-window .dialog-buttons button.default,.application.add2e-spell-dialog-window .dialog-buttons button[data-action="save"]{background:linear-gradient(180deg,var(--a2e-main,#b88924),var(--a2e-dark,#6f4b12))!important;color:#fff!important}
@media(max-width:760px){.application.add2e-spell-dialog-window .add2e-magic-power-parameter-form>.form-group{grid-template-columns:1fr!important}}
`;
  document.head.append(style);
}

function styleMagicParameterWindow(root, form) {
  ensureMagicParameterStyles();
  const windowRoot = form?.closest?.(".application") ?? root;
  if (!(windowRoot instanceof HTMLElement)) return;
  const theme = globalThis.ADD2E_SPELL_DIALOG_UI?.themes?.cleric ?? {
    bg: "#fffaf0", accent: "#f3e6c8", dark: "#6f4b12", main: "#b88924", border: "#c99a36", text: "#2d2011"
  };
  windowRoot.classList.add("add2e-spell-dialog-window");
  for (const [key, value] of Object.entries({
    "--a2e-bg": theme.bg,
    "--a2e-accent": theme.accent,
    "--a2e-dark": theme.dark,
    "--a2e-main": theme.main,
    "--a2e-border": theme.border,
    "--a2e-text": theme.text
  })) windowRoot.style.setProperty(key, value);
}

const PARAMETER_LABELS = Object.freeze({
  ability: "Caractéristique",
  characteristic: "Caractéristique",
  attribute: "Caractéristique",
  stat: "Caractéristique",
  score: "Valeur",
  value: "Valeur imposée",
  amount: "Valeur",
  bonus: "Bonus",
  penalty: "Malus",
  modifier: "Modificateur",
  duration: "Durée",
  range: "Portée",
  radius: "Rayon",
  distance: "Distance",
  area: "Zone d’effet",
  shape: "Forme de la zone",
  target: "Cible",
  targets: "Cibles",
  damage: "Dégâts",
  damageformula: "Formule de dégâts",
  damagetype: "Type de dégâts",
  type: "Type",
  condition: "État",
  effect: "Effet",
  effects: "Effets",
  resistance: "Résistance",
  resistancetype: "Type de résistance",
  immunity: "Immunité",
  immunitytype: "Type d’immunité",
  save: "Jet de sauvegarde",
  savetype: "Type de sauvegarde",
  savemodifier: "Modificateur de sauvegarde",
  spelluuid: "Sort équivalent",
  spellname: "Nom du sort",
  casterlevel: "Niveau du lanceur",
  activationtime: "Temps d’activation",
  chargecost: "Coût en charges",
  charges: "Charges",
  uses: "Utilisations",
  frequency: "Fréquence",
  interval: "Intervalle",
  percentage: "Pourcentage",
  chance: "Chance",
  formula: "Formule",
  table: "Table",
  movementtype: "Type de déplacement",
  speed: "Vitesse",
  multiplier: "Multiplicateur",
  armorclass: "Classe d’armure",
  description: "Description",
  notes: "Précisions",
  unit: "Unité"
});

const PARAMETER_VALUES = Object.freeze({
  force: "Force",
  strength: "Force",
  str: "Force",
  dexterite: "Dextérité",
  dexterity: "Dextérité",
  dex: "Dextérité",
  constitution: "Constitution",
  con: "Constitution",
  intelligence: "Intelligence",
  int: "Intelligence",
  sagesse: "Sagesse",
  wisdom: "Sagesse",
  wis: "Sagesse",
  charisme: "Charisme",
  charisma: "Charisme",
  cha: "Charisme",
  permanent: "Permanente",
  automatic: "Automatique",
  assisted: "Assisté par le MD",
  manual: "Manuel",
  none: "Aucun",
  self: "Porteur",
  wearer: "Porteur",
  equipped: "Équipé",
  fire: "Feu",
  cold: "Froid",
  electricity: "Électricité",
  lightning: "Foudre",
  acid: "Acide",
  poison: "Poison",
  magic: "Magie",
  physical: "Physique"
});

const CHARACTERISTICS = Object.freeze([
  ["force", "Force"],
  ["dexterite", "Dextérité"],
  ["constitution", "Constitution"],
  ["intelligence", "Intelligence"],
  ["sagesse", "Sagesse"],
  ["charisme", "Charisme"]
]);

function parameterKey(value) {
  return norm(value).replace(/_/g, "");
}

function parameterLabel(name) {
  return PARAMETER_LABELS[parameterKey(name)] ?? "Paramètre";
}

function parameterValueLabel(value) {
  const key = norm(value);
  return PARAMETER_VALUES[key] ?? String(value ?? "");
}

function parameterGroup(control) {
  return control?.closest?.(".form-group") ?? control?.parentElement ?? null;
}

function localizeControlLabel(control) {
  const group = parameterGroup(control);
  const label = group?.querySelector?.("label");
  if (!label) return;
  const required = label.querySelector("span")?.outerHTML ?? (label.textContent?.includes("*") ? ' <span style="color:#a40000">*</span>' : "");
  label.innerHTML = `${esc(parameterLabel(control.name))}${required}`;
}

function localizeSelectOptions(select) {
  for (const option of select?.options ?? []) {
    if (!option.value) continue;
    option.textContent = parameterValueLabel(option.value);
  }
}

function canonicalCharacteristic(value) {
  const key = norm(value);
  if (["force", "strength", "str"].includes(key)) return "force";
  if (["dexterite", "dexterity", "dex"].includes(key)) return "dexterite";
  if (["constitution", "con"].includes(key)) return "constitution";
  if (["intelligence", "int"].includes(key)) return "intelligence";
  if (["sagesse", "wisdom", "wis"].includes(key)) return "sagesse";
  if (["charisme", "charisma", "cha"].includes(key)) return "charisme";
  return "";
}

function replaceCharacteristicControl(form) {
  const current = form.querySelector('[name="ability"], [name="characteristic"], [name="attribute"], [name="stat"]');
  if (!current || current.tagName === "SELECT" && current.dataset.add2eFrenchCharacteristic === "1") return current;
  const select = document.createElement("select");
  for (const attribute of current.attributes ?? []) {
    if (["name", "type", "value"].includes(attribute.name)) continue;
    select.setAttribute(attribute.name, attribute.value);
  }
  select.name = current.name;
  select.dataset.add2eFrenchCharacteristic = "1";
  select.style.width = "100%";
  select.innerHTML = `<option value="">— Choisir une caractéristique —</option>${CHARACTERISTICS
    .map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}`;
  select.value = canonicalCharacteristic(current.value);
  current.replaceWith(select);
  localizeControlLabel(select);
  return select;
}

function replaceCharacteristicValueControl(form) {
  const characteristic = form.querySelector('[name="ability"], [name="characteristic"], [name="attribute"], [name="stat"]');
  const current = form.querySelector('[name="value"]');
  if (!characteristic || !current || current.type === "number" && current.dataset.add2eFrenchAbilityValue === "1") return current;
  const input = document.createElement("input");
  for (const attribute of current.attributes ?? []) {
    if (["type", "value", "rows"].includes(attribute.name)) continue;
    input.setAttribute(attribute.name, attribute.value);
  }
  input.type = "number";
  input.step = "1";
  input.name = current.name;
  input.dataset.add2eFrenchAbilityValue = "1";
  input.style.width = "100%";
  input.value = Number.isFinite(Number(current.value)) ? String(Number(current.value)) : "";
  current.replaceWith(input);
  localizeControlLabel(input);
  return input;
}

function localizeDurationControl(form) {
  const current = form.querySelector('[name="duration"]');
  if (!current || current.dataset.add2eFrenchDuration === "1") return;
  current.dataset.add2eFrenchDuration = "1";
  const stored = String(current.value ?? "").trim();
  const visible = document.createElement("input");
  visible.type = "text";
  visible.value = norm(stored) === "permanent" ? "Permanente" : stored;
  visible.placeholder = "Permanente, 1 tour, 10 minutes…";
  visible.style.width = "100%";
  visible.dataset.add2eDurationDisplay = "1";
  if ("type" in current) current.type = "hidden";
  current.hidden = true;
  current.style.display = "none";
  const sync = () => {
    const value = String(visible.value ?? "").trim();
    current.value = norm(value) === "permanente" ? "permanent" : value;
  };
  visible.addEventListener("input", sync);
  current.insertAdjacentElement("afterend", visible);
  sync();
  localizeControlLabel(current);
}

function localizeParameterForm(form) {
  for (const control of form.querySelectorAll('[data-add2e-parameter-type][name]')) {
    localizeControlLabel(control);
    if (control.tagName === "SELECT") localizeSelectOptions(control);
  }
  replaceCharacteristicControl(form);
  replaceCharacteristicValueControl(form);
  localizeDurationControl(form);
}

function missingRequiredLabels(form) {
  const missing = [];
  for (const control of form.querySelectorAll('[data-add2e-parameter-type][name]')) {
    const label = parameterGroup(control)?.querySelector?.("label");
    if (!label?.textContent?.includes("*")) continue;
    const value = control instanceof HTMLSelectElement && control.multiple
      ? [...control.selectedOptions].map(option => option.value).filter(Boolean)
      : control.type === "checkbox"
        ? control.checked
        : String(control.value ?? "").trim();
    if (value === false || value === "" || Array.isArray(value) && !value.length) missing.push(parameterLabel(control.name));
  }
  return [...new Set(missing)];
}

function bindFrenchValidation(root, form) {
  if (root.dataset.add2eFrenchPowerValidation === "1") return;
  root.dataset.add2eFrenchPowerValidation = "1";
  root.addEventListener("click", event => {
    const button = event.target instanceof Element ? event.target.closest('button[data-action="save"]') : null;
    if (!button) return;
    const missing = missingRequiredLabels(form);
    if (!missing.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ui.notifications.warn(`Paramètres obligatoires manquants : ${missing.join(", ")}.`);
  }, true);
}

function localizeParameterSummaryText(value) {
  return String(value ?? "").split(" · ").map(entry => {
    const separator = entry.indexOf(":");
    if (separator < 0) return entry;
    const key = entry.slice(0, separator).trim();
    const raw = entry.slice(separator + 1).trim();
    return `${parameterLabel(key)} : ${parameterValueLabel(raw)}`;
  }).join(" · ");
}

function localizeCreatorSummaries(form) {
  for (const summary of form.querySelectorAll('[data-add2e-selected-powers] small')) {
    summary.textContent = localizeParameterSummaryText(summary.textContent);
  }
}

function enhanceMagicItemCreator(root) {
  const form = root?.matches?.(".add2e-magic-item-create-form") ? root : root?.querySelector?.(".add2e-magic-item-create-form");
  if (!form) return;
  localizeCreatorSummaries(form);
  const container = form.querySelector('[data-add2e-selected-powers]');
  if (!container || container.dataset.add2eFrenchObserver === "1") return;
  container.dataset.add2eFrenchObserver = "1";
  const observer = new MutationObserver(() => localizeCreatorSummaries(form));
  observer.observe(container, { childList: true, subtree: true, characterData: true });
}

export async function enhanceSpellParameterDialog(app, html) {
  const root = rootOf(app, html);
  if (!root) return;
  enhanceMagicItemCreator(root);
  const form = root.matches?.(".add2e-magic-power-parameter-form") ? root : root.querySelector?.(".add2e-magic-power-parameter-form");
  if (!form) return;
  styleMagicParameterWindow(root, form);
  localizeParameterForm(form);
  bindFrenchValidation(root, form);
  if (form.dataset.add2eSpellSelectorBound === "1") return;
  const input = form.querySelector('input[name="spellUuid"]');
  if (!input) return;
  form.dataset.add2eSpellSelectorBound = "1";
  const entries = await spellIndex();
  const spellNameInput = form.querySelector('[name="spellName"]');
  const select = document.createElement("select");
  select.name = "spellUuid";
  select.dataset.add2eParameterType = "uuid";
  select.style.width = "100%";
  select.innerHTML = spellOptions(entries, input.value, spellNameInput?.value ?? "");
  input.replaceWith(select);
  localizeControlLabel(select);
  const syncName = () => {
    const name = String(select.selectedOptions?.[0]?.dataset?.spellName ?? "").trim();
    if (spellNameInput && name) spellNameInput.value = name;
  };
  select.addEventListener("change", syncName);
  if (select.value) syncName();
}
