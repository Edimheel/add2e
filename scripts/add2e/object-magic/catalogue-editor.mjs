// ADD2E — Objets magiques : éditeur et validation du catalogue de pouvoirs.
// Compatible Foundry V13/V14/V15 — API commune des fenêtres ADD2E.

import {
  ADD2E_MAGIC_CATALOGUE_POWER_SCHEMA,
  ADD2E_MAGIC_CATALOGUE_SELECTION_SCHEMA,
  ADD2E_MAGIC_CREATOR_STATES,
  add2eMagicClone,
  add2eObjectMagicEscapeHtml,
  add2eObjectMagicNormalizeTag,
  add2eObjectMagicToArray
} from "./core.mjs";
import { ADD2E_MAGIC_CREATOR_PROFILES } from "./profiles.mjs";
import { add2eObjectPowerOnUsePath } from "./power-runtime.mjs";

export function add2eMagicCatalogueAutomationLabel(value) {
  return ({
    automatic: "Automatique",
    assisted: "Assisté par le MD",
    manual: "Manuel",
    chat_card: "Carte de chat"
  })[add2eObjectMagicNormalizeTag(value)] ?? String(value ?? "—");
}

export function add2eMagicCatalogueCategoryLabel(value) {
  const labels = {
    attribute: "Caractéristiques",
    charges: "Charges",
    combat: "Combat",
    consumable: "Consommable",
    control: "Contrôle",
    curse: "Malédiction",
    defense: "Défense",
    destruction: "Destruction",
    detection: "Détection",
    environment: "Environnement",
    healing: "Guérison",
    holy: "Sacré",
    illusion: "Illusion",
    immunity: "Immunité",
    light: "Lumière",
    movement: "Déplacement",
    negation: "Négation",
    poison: "Poison",
    protection: "Protection",
    random: "Aléatoire",
    ranged: "Distance",
    resistance: "Résistance",
    restriction: "Restriction",
    scroll: "Parchemin",
    social: "Social",
    spell: "Sort",
    summoning: "Invocation",
    survival: "Survie",
    transformation: "Transformation"
  };
  return labels[add2eObjectMagicNormalizeTag(value)] ?? String(value ?? "Autre");
}

export function add2eMagicCreatorForm(dialogOrElement) {
  const raw = dialogOrElement?.element ?? dialogOrElement ?? null;
  const element = raw?.jquery
    ? raw[0]
    : raw?.querySelector
      ? raw
      : raw?.[0]?.querySelector
        ? raw[0]
        : null;
  return element?.matches?.(".add2e-magic-item-create-form")
    ? element
    : element?.querySelector?.(".add2e-magic-item-create-form")
      ?? element?.closest?.("dialog")?.querySelector?.(".add2e-magic-item-create-form")
      ?? null;
}

export function add2eMagicCreatorField(form, name) {
  return form?.elements?.[name] ?? form?.querySelector?.(`[name="${name}"]`) ?? null;
}

export function add2eMagicCreatorState(form) {
  if (!ADD2E_MAGIC_CREATOR_STATES.has(form)) {
    ADD2E_MAGIC_CREATOR_STATES.set(form, {
      catalogue: null,
      compatible: [],
      selected: [],
      sequence: 0,
      previousProfile: ""
    });
  }
  return ADD2E_MAGIC_CREATOR_STATES.get(form);
}

function add2eMagicCreatorProfileContext(form) {
  const profile = String(add2eMagicCreatorField(form, "profile")?.value ?? "objet").trim();
  const definition = ADD2E_MAGIC_CREATOR_PROFILES[profile] ?? ADD2E_MAGIC_CREATOR_PROFILES.objet;
  return { profile, itemType: definition.itemType };
}

function add2eMagicCatalogueParameterInitial(schema, currentValue) {
  if (currentValue !== undefined) return currentValue;
  if (schema?.default !== undefined) return add2eMagicClone(schema.default);
  if (schema?.value !== undefined) return add2eMagicClone(schema.value);
  return undefined;
}

function add2eMagicCatalogueJsonValue(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2); }
  catch (_error) { return String(value); }
}

const ADD2E_MAGIC_PARAMETER_LABELS = Object.freeze({
  movement_mode: "Mode de déplacement",
  speed: "Vitesse",
  ignore_encumbrance: "Ignorer l’encombrement",
  threshold: "Seuil",
  step: "Valeur d’un palier",
  penalty_per_step: "Pénalité par palier",
  step_rounding: "Calcul des paliers",
  weight_unit: "Unité de charge",
  duration: "Durée",
  range: "Portée",
  distance: "Distance",
  capacity: "Capacité",
  charge_cost: "Coût en charges",
  caster_level: "Niveau de lanceur",
  spell_uuid: "Sort lié",
  spell_name: "Nom du sort",
  target: "Cible",
  targets: "Cibles",
  formula: "Formule",
  amount: "Valeur",
  value: "Valeur",
  multiplier: "Multiplicateur",
  chance: "Probabilité",
  percentage: "Pourcentage",
  save: "Jet de sauvegarde",
  affects_carried: "Affecte l’équipement transporté",
  activation_time: "Temps d’activation",
  command_words: "Mots de commande"
});

const ADD2E_MAGIC_OPTION_LABELS = Object.freeze({
  ground: "Marche",
  flight: "Vol",
  fly: "Vol",
  swim: "Nage",
  underwater: "Déplacement sous-marin",
  ascent: "Ascension",
  descent: "Descente",
  vertical: "Déplacement vertical",
  climb: "Escalade",
  levitate: "Lévitation",
  water_walk: "Marche sur l’eau",
  air_walk: "Marche dans les airs",
  burrow: "Fouissement",
  floor: "Paliers complets uniquement",
  ceil: "Toute fraction compte comme un palier",
  round: "Arrondi au palier le plus proche",
  gp: "Pièces d’or (po)",
  self: "Soi-même",
  creature: "Une créature",
  touch: "Au contact",
  yes: "Oui",
  no: "Non"
});

function add2eMagicCatalogueHumanize(value) {
  const text = String(value ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!text) return "Paramètre";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function add2eMagicCatalogueParameterLabel(name, schema = {}) {
  const explicit = String(schema.label ?? schema.title ?? "").trim();
  if (explicit) return explicit;
  return ADD2E_MAGIC_PARAMETER_LABELS[add2eObjectMagicNormalizeTag(name)] ?? add2eMagicCatalogueHumanize(name);
}

function add2eMagicCatalogueParameterDescription(name, schema = {}, type = "") {
  const explicit = String(schema.description ?? schema.help ?? schema.hint ?? "").trim();
  if (explicit) return explicit;
  if (type === "boolean") return `Cochez cette option pour activer « ${add2eMagicCatalogueParameterLabel(name, schema)} ».`;
  if (type === "choice") return "Choisissez la valeur correspondant à la règle de l’objet.";
  if (type === "choice_list") return "Sélectionnez une ou plusieurs valeurs correspondant à la règle de l’objet.";
  if (["integer", "number", "percentage", "percentage_per_use"].includes(type)) return "Saisissez la valeur numérique indiquée par la règle de l’objet.";
  if (["tag_list", "string_list", "integer_list"].includes(type)) return "Saisissez plusieurs valeurs séparées par des virgules.";
  if (["object", "effect_list", "effect_table", "spell_list", "form_list", "save_rule", "percentage_or_save", "percentage_or_table", "number_or_table", "weight_or_table", "formula_or_table"].includes(type)) return "Saisissez une valeur simple ou une structure JSON conforme à la règle.";
  return "Saisissez la valeur demandée par la règle de ce pouvoir.";
}

function add2eMagicCatalogueParameterPlaceholder(schema = {}, fallback = "") {
  return String(schema.placeholder ?? schema.example ?? fallback ?? "").trim();
}

function add2eMagicCatalogueParameterUnit(schema = {}) {
  return String(schema.unit ?? schema.units ?? "").trim();
}

function add2eMagicCatalogueOptionLabel(entry, schema = {}) {
  const key = String(entry ?? "");
  const explicit = schema.optionLabels?.[key] ?? schema.labels?.[key];
  if (explicit !== undefined && explicit !== null && String(explicit).trim()) return String(explicit).trim();
  return ADD2E_MAGIC_OPTION_LABELS[add2eObjectMagicNormalizeTag(key)] ?? add2eMagicCatalogueHumanize(key);
}

function add2eMagicCatalogueParameterLimits(schema = {}) {
  const parts = [];
  if (Number.isFinite(Number(schema.min))) parts.push(`minimum ${Number(schema.min)}`);
  if (Number.isFinite(Number(schema.max))) parts.push(`maximum ${Number(schema.max)}`);
  return parts.join(" · ");
}

function add2eMagicCatalogueControlShell(name, schema, type, controlHtml) {
  const label = add2eMagicCatalogueParameterLabel(name, schema);
  const required = schema.required === true ? ' <span style="color:#a40000" aria-label="obligatoire">*</span>' : "";
  const description = add2eMagicCatalogueParameterDescription(name, schema, type);
  const unit = add2eMagicCatalogueParameterUnit(schema);
  const limits = add2eMagicCatalogueParameterLimits(schema);
  return `<section class="add2e-magic-parameter" style="border:1px solid var(--color-border-light-primary,#a98b52);border-radius:8px;padding:10px;display:grid;gap:6px;">
    <label style="font-weight:700;display:flex;gap:6px;align-items:center;flex-wrap:wrap;" for="add2e-power-${add2eObjectMagicEscapeHtml(name)}">
      <span>${add2eObjectMagicEscapeHtml(label)}${required}</span>
      ${unit ? `<span style="font-size:.8em;font-weight:600;opacity:.72;">(${add2eObjectMagicEscapeHtml(unit)})</span>` : ""}
    </label>
    <div style="font-size:.88em;line-height:1.35;opacity:.82;">${add2eObjectMagicEscapeHtml(description)}</div>
    ${controlHtml}
    ${limits ? `<small style="opacity:.7;">${add2eObjectMagicEscapeHtml(limits)}</small>` : ""}
  </section>`;
}

export function add2eMagicCatalogueParameterControl(name, schema = {}, currentValue) {
  const type = add2eObjectMagicNormalizeTag(schema.type);
  const value = add2eMagicCatalogueParameterInitial(schema, currentValue);
  const escapedName = add2eObjectMagicEscapeHtml(name);
  const controlId = `add2e-power-${escapedName}`;
  const common = `id="${controlId}" name="${escapedName}" data-add2e-parameter-type="${add2eObjectMagicEscapeHtml(type)}"`;
  let html = "";

  if (type === "boolean") {
    html = `<label style="display:flex;align-items:center;gap:9px;padding:6px 0;font-weight:600;"><input ${common} type="checkbox" ${value === true ? "checked" : ""}> <span>${value === true ? "Option activée" : "Activer cette option"}</span></label>`;
    return add2eMagicCatalogueControlShell(name, schema, type, html);
  }
  if (type === "fixed" || type === "fixed_list") {
    const display = add2eMagicCatalogueJsonValue(value) || "Valeur imposée";
    html = `<input ${common} type="hidden" value="${add2eObjectMagicEscapeHtml(display)}"><div style="padding:7px 9px;border:1px solid var(--color-border-light-primary,#999);border-radius:5px;opacity:.9;">${add2eObjectMagicEscapeHtml(display)}</div>`;
    return add2eMagicCatalogueControlShell(name, schema, type, html);
  }
  if (type === "choice" && Array.isArray(schema.values)) {
    const options = schema.values.map(entry => `<option value="${add2eObjectMagicEscapeHtml(entry)}"${String(entry) === String(value) ? " selected" : ""}>${add2eObjectMagicEscapeHtml(add2eMagicCatalogueOptionLabel(entry, schema))}</option>`).join("");
    html = `<select ${common}>${options}</select>`;
    return add2eMagicCatalogueControlShell(name, schema, type, html);
  }
  if (type === "choice_list" && Array.isArray(schema.values)) {
    const selectedValues = new Set(add2eObjectMagicToArray(value).map(String));
    const options = schema.values.map(entry => `<option value="${add2eObjectMagicEscapeHtml(entry)}"${selectedValues.has(String(entry)) ? " selected" : ""}>${add2eObjectMagicEscapeHtml(add2eMagicCatalogueOptionLabel(entry, schema))}</option>`).join("");
    html = `<select ${common} multiple size="${Math.min(7, Math.max(3, schema.values.length))}">${options}</select>`;
    return add2eMagicCatalogueControlShell(name, schema, type, html);
  }
  const numericTypes = new Set(["integer", "number", "percentage", "percentage_per_use"]);
  if (numericTypes.has(type)) {
    const min = Number.isFinite(Number(schema.min)) ? ` min="${Number(schema.min)}"` : "";
    const max = Number.isFinite(Number(schema.max)) ? ` max="${Number(schema.max)}"` : "";
    const placeholder = add2eMagicCatalogueParameterPlaceholder(schema);
    html = `<input ${common} type="number" step="${type === "integer" ? "1" : "any"}"${min}${max}${placeholder ? ` placeholder="${add2eObjectMagicEscapeHtml(placeholder)}"` : ""} value="${add2eObjectMagicEscapeHtml(value ?? "")}">`;
    return add2eMagicCatalogueControlShell(name, schema, type, html);
  }
  const jsonTypes = new Set([
    "object", "effect_list", "effect_table", "spell_list", "form_list", "save_rule",
    "percentage_or_save", "percentage_or_table", "number_or_table", "weight_or_table",
    "formula_or_table"
  ]);
  if (jsonTypes.has(type)) {
    const placeholder = add2eMagicCatalogueParameterPlaceholder(schema, "Valeur ou JSON");
    html = `<textarea ${common} rows="3" placeholder="${add2eObjectMagicEscapeHtml(placeholder)}">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueJsonValue(value))}</textarea>`;
    return add2eMagicCatalogueControlShell(name, schema, type, html);
  }
  const listTypes = new Set(["tag_list", "string_list", "integer_list"]);
  if (listTypes.has(type)) {
    const placeholder = add2eMagicCatalogueParameterPlaceholder(schema, "Valeurs séparées par des virgules");
    html = `<input ${common} type="text" value="${add2eObjectMagicEscapeHtml(add2eObjectMagicToArray(value).join(", "))}" placeholder="${add2eObjectMagicEscapeHtml(placeholder)}">`;
    return add2eMagicCatalogueControlShell(name, schema, type, html);
  }
  const placeholder = add2eMagicCatalogueParameterPlaceholder(schema);
  html = `<input ${common} type="text" value="${add2eObjectMagicEscapeHtml(add2eMagicCatalogueJsonValue(value))}"${placeholder ? ` placeholder="${add2eObjectMagicEscapeHtml(placeholder)}"` : ""}>`;
  return add2eMagicCatalogueControlShell(name, schema, type, html);
}

function add2eMagicCatalogueReadParameter(input, schema = {}) {
  const type = add2eObjectMagicNormalizeTag(schema.type);
  if (type === "boolean") return input.checked === true;
  if (type === "choice_list") return [...input.selectedOptions].map(option => option.value);
  if (type === "fixed" || type === "fixed_list") return add2eMagicClone(schema.value);
  const raw = String(input.value ?? "").trim();
  if (!raw) return undefined;
  if (["integer", "number", "percentage", "percentage_per_use"].includes(type)) {
    const number = Number(raw.replace(",", "."));
    return Number.isFinite(number) ? number : undefined;
  }
  if (["tag_list", "string_list"].includes(type)) return add2eObjectMagicToArray(raw).map(String);
  if (type === "integer_list") return add2eObjectMagicToArray(raw).map(Number).filter(Number.isFinite);
  if (["formula_or_integer", "integer_or_null", "number_or_formula", "number_or_distance"].includes(type)) {
    const number = Number(raw.replace(",", "."));
    return Number.isFinite(number) ? number : raw;
  }
  if ([
    "object", "effect_list", "effect_table", "spell_list", "form_list", "save_rule",
    "percentage_or_save", "percentage_or_table", "number_or_table", "weight_or_table",
    "formula_or_table"
  ].includes(type)) {
    try { return JSON.parse(raw); }
    catch (_error) { return raw; }
  }
  return raw;
}

export function add2eMagicCatalogueValidateParameters(power, parameters) {
  const missing = [];
  for (const [name, schema] of Object.entries(power.parameters ?? {})) {
    if (schema?.required !== true) continue;
    const value = parameters[name];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) {
      missing.push(add2eMagicCatalogueParameterLabel(name, schema));
    }
  }
  const alternatives = add2eObjectMagicToArray(power.validation?.requiresOneOf);
  if (alternatives.length && !alternatives.some(name => {
    const value = parameters[name];
    return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length);
  })) {
    const labels = alternatives.map(name => add2eMagicCatalogueParameterLabel(name, power.parameters?.[name] ?? {}));
    missing.push(`un des champs suivants : ${labels.join(", ")}`);
  }
  return missing;
}

export async function add2eMagicCatalogueConfigurePower(power, existingParameters = {}) {
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  const parameterEntries = Object.entries(power.parameters ?? {});
  if (!parameterEntries.length) return {};
  const controls = parameterEntries.map(([name, schema]) =>
    add2eMagicCatalogueParameterControl(name, schema, existingParameters?.[name])
  ).join("");
  const summary = String(power.description ?? power.summary ?? power.help ?? "").trim();
  const result = await globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "save",
    add2eClasses: ["add2e-magic-power-configuration-window"],
    window: { title: `Configurer — ${power.label}` },
    modal: true,
    content: `<form class="add2e-magic-power-parameter-form" style="min-width:620px;max-width:760px;padding:12px;display:grid;gap:10px;">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <strong style="font-size:1.06em;">${add2eObjectMagicEscapeHtml(power.label)}</strong>
        <span style="font-size:.8em;padding:2px 7px;border:1px solid currentColor;border-radius:999px;">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueCategoryLabel(power.category))}</span>
        <span style="font-size:.8em;padding:2px 7px;border:1px solid currentColor;border-radius:999px;">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueAutomationLabel(power.automation))}</span>
      </div>
      ${summary ? `<p style="margin:0;line-height:1.4;">${add2eObjectMagicEscapeHtml(summary)}</p>` : ""}
      <p style="margin:0;opacity:.78;">Source : ${add2eObjectMagicEscapeHtml(power.source?.section ?? "Guide du Maître")}${power.source?.page ? `, page ${add2eObjectMagicEscapeHtml(power.source.page)}` : ""}</p>
      ${controls}
      <p style="margin:0;font-size:.82em;opacity:.75;">Les champs marqués d’un astérisque sont obligatoires.</p>
    </form>`,
    buttons: [
      {
        action: "save",
        label: "Enregistrer",
        icon: "<i class='fas fa-check'></i>",
        default: true,
        callback: (_event, button) => {
          const root = button?.form;
          const parameters = {};
          for (const [name, schema] of parameterEntries) {
            const escaped = globalThis.CSS?.escape ? CSS.escape(name) : String(name).replace(/["\\]/g, "\\$&");
            const input = root?.querySelector?.(`[name="${escaped}"]`);
            if (!input) continue;
            const value = add2eMagicCatalogueReadParameter(input, schema);
            if (value !== undefined) parameters[name] = value;
          }
          const missing = add2eMagicCatalogueValidateParameters(power, parameters);
          if (missing.length) {
            ui.notifications.warn(`Champs obligatoires manquants : ${missing.join(", ")}.`);
            return false;
          }
          return parameters;
        }
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "<i class='fas fa-times'></i>",
        callback: () => null
      }
    ],
    close: () => null
  });
  return result && typeof result === "object" ? result : null;
}

function add2eMagicCatalogueSelectedPayload(state) {
  return state.selected.map(entry => ({
    catalogueId: entry.power.id,
    parameters: add2eMagicClone(entry.parameters)
  }));
}

function add2eMagicCatalogueSyncHidden(form, state) {
  const hidden = add2eMagicCreatorField(form, "cataloguePowersJson");
  if (hidden) hidden.value = JSON.stringify(add2eMagicCatalogueSelectedPayload(state));
}

function add2eMagicCatalogueFilteredPowers(section, state) {
  const search = add2eObjectMagicNormalizeTag(section.querySelector('[data-add2e-power-search]')?.value);
  const category = String(section.querySelector('[data-add2e-power-category]')?.value ?? "");
  const automation = String(section.querySelector('[data-add2e-power-automation]')?.value ?? "");
  return state.compatible.filter(power => {
    if (category && String(power.category) !== category) return false;
    if (automation && String(power.automation) !== automation) return false;
    if (!search) return true;
    const haystack = add2eObjectMagicNormalizeTag(`${power.label} ${power.id} ${power.category} ${power.automation}`);
    return haystack.includes(search);
  });
}

export function add2eMagicCatalogueRenderAvailable(form, state) {
  const section = form.querySelector('[data-add2e-power-section]');
  const select = section?.querySelector?.('[data-add2e-power-select]');
  if (!section || !select) return;
  const powers = add2eMagicCatalogueFilteredPowers(section, state);
  const groups = new Map();
  for (const power of powers) {
    const category = String(power.category ?? "other");
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(power);
  }
  select.innerHTML = [...groups.entries()]
    .sort(([left], [right]) => add2eMagicCatalogueCategoryLabel(left).localeCompare(add2eMagicCatalogueCategoryLabel(right), "fr"))
    .map(([category, entries]) => `<optgroup label="${add2eObjectMagicEscapeHtml(add2eMagicCatalogueCategoryLabel(category))}">${entries
      .sort((left, right) => String(left.label).localeCompare(String(right.label), "fr"))
      .map(power => `<option value="${add2eObjectMagicEscapeHtml(power.id)}">${add2eObjectMagicEscapeHtml(power.label)} — ${add2eObjectMagicEscapeHtml(add2eMagicCatalogueAutomationLabel(power.automation))}</option>`)
      .join("")}</optgroup>`)
    .join("");
  const count = section.querySelector('[data-add2e-power-available-count]');
  if (count) count.textContent = `${powers.length} pouvoir${powers.length > 1 ? "s" : ""} compatible${powers.length > 1 ? "s" : ""}`;
}

function add2eMagicCatalogueParameterSummary(power, parameters = {}) {
  const entries = Object.entries(parameters);
  if (!entries.length) return "Aucun paramètre";
  return entries.map(([key, value]) => {
    const schema = power?.parameters?.[key] ?? {};
    const label = add2eMagicCatalogueParameterLabel(key, schema);
    const display = Array.isArray(value)
      ? value.map(entry => add2eMagicCatalogueOptionLabel(entry, schema)).join(", ")
      : typeof value === "object"
        ? JSON.stringify(value)
        : schema?.optionLabels?.[String(value)] !== undefined || ADD2E_MAGIC_OPTION_LABELS[add2eObjectMagicNormalizeTag(value)]
          ? add2eMagicCatalogueOptionLabel(value, schema)
          : String(value);
    const unit = add2eMagicCatalogueParameterUnit(schema);
    return `${label} : ${display}${unit && value !== "" ? ` ${unit}` : ""}`;
  }).join(" · ");
}

function add2eMagicCatalogueRenderSelected(form, state) {
  const section = form.querySelector('[data-add2e-power-section]');
  const container = section?.querySelector?.('[data-add2e-selected-powers]');
  if (!container) return;
  container.innerHTML = state.selected.length
    ? state.selected.map(entry => `<article data-add2e-selected-power="${add2eObjectMagicEscapeHtml(entry.uid)}" style="border:1px solid var(--color-border-light-primary,#999);border-radius:6px;padding:7px;display:grid;gap:5px;">
        <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;">
          <strong style="flex:1;">${add2eObjectMagicEscapeHtml(entry.power.label)}</strong>
          <span style="font-size:.76em;padding:1px 6px;border:1px solid currentColor;border-radius:999px;">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueCategoryLabel(entry.power.category))}</span>
          <span style="font-size:.76em;padding:1px 6px;border:1px solid currentColor;border-radius:999px;">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueAutomationLabel(entry.power.automation))}</span>
          <button type="button" data-action="edit-catalogue-power" data-power-uid="${add2eObjectMagicEscapeHtml(entry.uid)}" title="Configurer"><i class="fa-solid fa-pen"></i></button>
          <button type="button" data-action="remove-catalogue-power" data-power-uid="${add2eObjectMagicEscapeHtml(entry.uid)}" title="Retirer"><i class="fa-solid fa-trash"></i></button>
        </div>
        <small style="opacity:.8;overflow-wrap:anywhere;">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueParameterSummary(entry.power, entry.parameters))}</small>
      </article>`).join("")
    : `<p style="margin:0;opacity:.72;text-align:center;padding:7px;">Aucun pouvoir sélectionné.</p>`;
  const count = section.querySelector('[data-add2e-selected-count]');
  if (count) count.textContent = `${state.selected.length} sélectionné${state.selected.length > 1 ? "s" : ""}`;
  add2eMagicCatalogueSyncHidden(form, state);
}

function add2eMagicCatalogueRefreshFilters(form, state) {
  const section = form.querySelector('[data-add2e-power-section]');
  if (!section) return;
  const categorySelect = section.querySelector('[data-add2e-power-category]');
  const automationSelect = section.querySelector('[data-add2e-power-automation]');
  const currentCategory = categorySelect?.value ?? "";
  const currentAutomation = automationSelect?.value ?? "";
  const categories = [...new Set(state.compatible.map(power => String(power.category ?? "")).filter(Boolean))]
    .sort((left, right) => add2eMagicCatalogueCategoryLabel(left).localeCompare(add2eMagicCatalogueCategoryLabel(right), "fr"));
  if (categorySelect) {
    categorySelect.innerHTML = `<option value="">Toutes les catégories</option>${categories.map(category => `<option value="${add2eObjectMagicEscapeHtml(category)}">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueCategoryLabel(category))}</option>`).join("")}`;
    categorySelect.value = categories.includes(currentCategory) ? currentCategory : "";
  }
  const automations = [...new Set(state.compatible.map(power => String(power.automation ?? "")).filter(Boolean))]
    .sort((left, right) => add2eMagicCatalogueAutomationLabel(left).localeCompare(add2eMagicCatalogueAutomationLabel(right), "fr"));
  if (automationSelect) {
    automationSelect.innerHTML = `<option value="">Tous les niveaux d’automatisation</option>${automations.map(automation => `<option value="${add2eObjectMagicEscapeHtml(automation)}">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueAutomationLabel(automation))}</option>`).join("")}`;
    automationSelect.value = automations.includes(currentAutomation) ? currentAutomation : "";
  }
}

export async function add2eMagicCatalogueRefreshCompatibility(form, { profileChanged = false } = {}) {
  const state = add2eMagicCreatorState(form);
  const context = add2eMagicCreatorProfileContext(form);
  if (typeof globalThis.add2eLoadMagicPowerCatalogue !== "function" || typeof globalThis.add2eGetCompatibleMagicPowers !== "function") {
    throw new Error("Le chargeur du catalogue de pouvoirs est indisponible.");
  }
  state.catalogue ??= await globalThis.add2eLoadMagicPowerCatalogue();
  state.compatible = await globalThis.add2eGetCompatibleMagicPowers(context);
  const compatibleIds = new Set(state.compatible.map(power => power.id));
  if (profileChanged) state.selected = state.selected.filter(entry => compatibleIds.has(entry.power.id));
  state.previousProfile = context.profile;
  add2eMagicCatalogueRefreshFilters(form, state);
  add2eMagicCatalogueRenderAvailable(form, state);
  add2eMagicCatalogueRenderSelected(form, state);
  const status = form.querySelector('[data-add2e-power-status]');
  if (status) status.textContent = `${state.catalogue.counts?.standardPowers ?? 0} pouvoirs standards chargés — artefacts exclus.`;
}

export async function add2eMagicCatalogueAddSelected(form) {
  const state = add2eMagicCreatorState(form);
  const select = form.querySelector('[data-add2e-power-select]');
  const power = state.compatible.find(entry => entry.id === select?.value);
  if (!power) {
    ui.notifications.warn("Sélectionnez un pouvoir compatible.");
    return;
  }
  const parameters = await add2eMagicCatalogueConfigurePower(power, {});
  if (parameters === null) return;
  state.sequence += 1;
  state.selected.push({ uid: `${power.id}-${state.sequence}`, power, parameters });
  add2eMagicCatalogueRenderSelected(form, state);
}

export async function add2eMagicCatalogueEditSelected(form, uid) {
  const state = add2eMagicCreatorState(form);
  const entry = state.selected.find(selected => selected.uid === uid);
  if (!entry) return;
  const parameters = await add2eMagicCatalogueConfigurePower(entry.power, entry.parameters);
  if (parameters === null) return;
  entry.parameters = parameters;
  add2eMagicCatalogueRenderSelected(form, state);
}

export function add2eMagicCatalogueRemoveSelected(form, uid) {
  const state = add2eMagicCreatorState(form);
  state.selected = state.selected.filter(entry => entry.uid !== uid);
  add2eMagicCatalogueRenderSelected(form, state);
}

function add2eMagicCatalogueResolveTemplates(value, parameters) {
  if (Array.isArray(value)) return value.map(entry => add2eMagicCatalogueResolveTemplates(entry, parameters));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, add2eMagicCatalogueResolveTemplates(entry, parameters)]));
  }
  if (typeof value !== "string") return add2eMagicClone(value);
  const exact = value.match(/^@([A-Za-z0-9_]+)$/);
  if (exact && Object.prototype.hasOwnProperty.call(parameters, exact[1])) return add2eMagicClone(parameters[exact[1]]);
  return value.replace(/@([A-Za-z0-9_]+)/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(parameters, key)) return match;
    const replacement = parameters[key];
    return typeof replacement === "object" ? JSON.stringify(replacement) : String(replacement);
  });
}

function add2eMagicCatalogueStoredPower(power, parameters, catalogue) {
  const onUse = add2eObjectPowerOnUsePath(power);
  return {
    schema: ADD2E_MAGIC_CATALOGUE_POWER_SCHEMA,
    kind: "catalogue",
    catalogueId: power.id,
    name: power.label,
    label: power.label,
    category: power.category,
    automation: power.automation,
    activation: add2eMagicClone(power.activation ?? {}),
    parameters: add2eMagicClone(parameters),
    effects: add2eMagicCatalogueResolveTemplates(power.effects ?? [], parameters),
    effectTemplates: add2eMagicClone(power.effects ?? []),
    compatibility: add2eMagicClone(power.compatibility ?? {}),
    validation: add2eMagicClone(power.validation ?? {}),
    source: add2eMagicClone(power.source ?? {}),
    catalogue: {
      id: catalogue?.manifest?.catalogueId ?? catalogue?.manifest?.id ?? "add2e-gdm-magic-powers",
      version: catalogue?.manifest?.version ?? "",
      runtimeVersion: catalogue?.runtimeVersion ?? ""
    },
    ...(onUse ? { onUse, onuse: onUse, on_use: onUse } : {})
  };
}

export async function add2eMagicCatalogueValidateSelection(selection, profileKey) {
  if (!Array.isArray(selection) || !selection.length) return { powers: [], catalogue: null };
  if (typeof globalThis.add2eLoadMagicPowerCatalogue !== "function") throw new Error("Le catalogue de pouvoirs est indisponible.");
  const catalogue = await globalThis.add2eLoadMagicPowerCatalogue();
  const profile = ADD2E_MAGIC_CREATOR_PROFILES[profileKey];
  const compatible = await globalThis.add2eGetCompatibleMagicPowers({ profile: profileKey, itemType: profile.itemType });
  const compatibleIds = new Set(compatible.map(power => power.id));
  const powers = [];
  for (const raw of selection) {
    const catalogueId = String(raw?.catalogueId ?? "").trim();
    const definition = catalogue.powerById?.get?.(catalogueId);
    if (!definition) throw new Error(`Pouvoir de catalogue inconnu : ${catalogueId || "identifiant vide"}.`);
    if (!compatibleIds.has(catalogueId)) throw new Error(`Le pouvoir « ${definition.label} » n'est pas compatible avec le profil ${profile.label}.`);
    const parameters = raw?.parameters && typeof raw.parameters === "object" && !Array.isArray(raw.parameters)
      ? add2eMagicClone(raw.parameters)
      : {};
    const missing = add2eMagicCatalogueValidateParameters(definition, parameters);
    if (missing.length) throw new Error(`Paramètres manquants pour « ${definition.label} » : ${missing.join(", ")}.`);
    powers.push(add2eMagicCatalogueStoredPower(definition, parameters, catalogue));
  }
  return { powers, catalogue };
}

export function add2eMagicCatalogueAttachToItemData(itemData, powers, catalogue) {
  itemData.system ??= {};
  itemData.system.pouvoirs = add2eMagicClone(powers ?? []);
  itemData.flags ??= {};
  itemData.flags.add2e ??= {};
  itemData.flags.add2e.magicPowerCatalogue = {
    schema: ADD2E_MAGIC_CATALOGUE_SELECTION_SCHEMA,
    catalogueId: catalogue?.manifest?.catalogueId ?? catalogue?.manifest?.id ?? "add2e-gdm-magic-powers",
    catalogueVersion: catalogue?.manifest?.version ?? "",
    runtimeVersion: catalogue?.runtimeVersion ?? "",
    powerIds: (powers ?? []).map(power => power.catalogueId)
  };
}

globalThis.add2eMagicCatalogueConfigurePower = add2eMagicCatalogueConfigurePower;
globalThis.add2eMagicCatalogueParameterControl = add2eMagicCatalogueParameterControl;
globalThis.add2eMagicCatalogueParameterLabel = add2eMagicCatalogueParameterLabel;
globalThis.add2eMagicCatalogueValidateParameters = add2eMagicCatalogueValidateParameters;