// ADD2E — Objets magiques : éditeur et validation du catalogue de pouvoirs.
// Compatible Foundry V13/V14/V15 — DialogV2.

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

function add2eMagicCatalogueParameterControl(name, schema = {}, currentValue) {
  const type = add2eObjectMagicNormalizeTag(schema.type);
  const value = add2eMagicCatalogueParameterInitial(schema, currentValue);
  const escapedName = add2eObjectMagicEscapeHtml(name);
  const required = schema.required === true ? ' <span style="color:#a40000">*</span>' : "";
  const label = `${add2eObjectMagicEscapeHtml(name)}${required}`;
  const common = `name="${escapedName}" data-add2e-parameter-type="${add2eObjectMagicEscapeHtml(type)}"`;
  if (type === "boolean") {
    return `<label class="form-group" style="display:flex;align-items:center;gap:8px;"><input ${common} type="checkbox" ${value === true ? "checked" : ""}> <span>${label}</span></label>`;
  }
  if (type === "fixed" || type === "fixed_list") {
    return `<div class="form-group"><label>${label}</label><input ${common} type="hidden" value="${add2eObjectMagicEscapeHtml(add2eMagicCatalogueJsonValue(value))}"><div style="padding:6px 8px;border:1px solid var(--color-border-light-primary,#999);border-radius:4px;opacity:.85;">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueJsonValue(value) || "Valeur imposée")}</div></div>`;
  }
  if (type === "choice" && Array.isArray(schema.values)) {
    const options = schema.values.map(entry => `<option value="${add2eObjectMagicEscapeHtml(entry)}"${String(entry) === String(value) ? " selected" : ""}>${add2eObjectMagicEscapeHtml(entry)}</option>`).join("");
    return `<div class="form-group"><label>${label}</label><select ${common}>${options}</select></div>`;
  }
  if (type === "choice_list" && Array.isArray(schema.values)) {
    const selectedValues = new Set(add2eObjectMagicToArray(value).map(String));
    const options = schema.values.map(entry => `<option value="${add2eObjectMagicEscapeHtml(entry)}"${selectedValues.has(String(entry)) ? " selected" : ""}>${add2eObjectMagicEscapeHtml(entry)}</option>`).join("");
    return `<div class="form-group"><label>${label}</label><select ${common} multiple size="${Math.min(7, Math.max(3, schema.values.length))}">${options}</select></div>`;
  }
  const numericTypes = new Set(["integer", "number", "percentage", "percentage_per_use"]);
  if (numericTypes.has(type)) {
    const min = Number.isFinite(Number(schema.min)) ? ` min="${Number(schema.min)}"` : "";
    const max = Number.isFinite(Number(schema.max)) ? ` max="${Number(schema.max)}"` : "";
    return `<div class="form-group"><label>${label}</label><input ${common} type="number" step="${type === "integer" ? "1" : "any"}"${min}${max} value="${add2eObjectMagicEscapeHtml(value ?? "")}"></div>`;
  }
  const jsonTypes = new Set([
    "object", "effect_list", "effect_table", "spell_list", "form_list", "save_rule",
    "percentage_or_save", "percentage_or_table", "number_or_table", "weight_or_table",
    "formula_or_table"
  ]);
  if (jsonTypes.has(type)) {
    return `<div class="form-group"><label>${label}</label><textarea ${common} rows="3" placeholder="Valeur ou JSON">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueJsonValue(value))}</textarea></div>`;
  }
  const listTypes = new Set(["tag_list", "string_list", "integer_list"]);
  if (listTypes.has(type)) {
    return `<div class="form-group"><label>${label}</label><input ${common} type="text" value="${add2eObjectMagicEscapeHtml(add2eObjectMagicToArray(value).join(", "))}" placeholder="Valeurs séparées par des virgules"></div>`;
  }
  return `<div class="form-group"><label>${label}</label><input ${common} type="text" value="${add2eObjectMagicEscapeHtml(add2eMagicCatalogueJsonValue(value))}"></div>`;
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

function add2eMagicCatalogueValidateParameters(power, parameters) {
  const missing = [];
  for (const [name, schema] of Object.entries(power.parameters ?? {})) {
    if (schema?.required !== true) continue;
    const value = parameters[name];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) missing.push(name);
  }
  const alternatives = add2eObjectMagicToArray(power.validation?.requiresOneOf);
  if (alternatives.length && !alternatives.some(name => {
    const value = parameters[name];
    return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length);
  })) {
    missing.push(`un des paramètres suivants : ${alternatives.join(", ")}`);
  }
  return missing;
}

async function add2eMagicCatalogueConfigurePower(power, existingParameters = {}) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("DialogV2 est introuvable.");
    return null;
  }
  const parameterEntries = Object.entries(power.parameters ?? {});
  if (!parameterEntries.length) return {};
  const controls = parameterEntries.map(([name, schema]) =>
    add2eMagicCatalogueParameterControl(name, schema, existingParameters?.[name])
  ).join("");
  const result = await DialogV2.wait({
    window: { title: `Configurer — ${power.label}` },
    modal: true,
    rejectClose: false,
    content: `<div class="add2e-dialog add2e-magic-power-parameter-form" style="min-width:560px;padding:10px;display:grid;gap:8px;">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <strong>${add2eObjectMagicEscapeHtml(power.label)}</strong>
        <span style="font-size:.8em;padding:2px 7px;border:1px solid currentColor;border-radius:999px;">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueCategoryLabel(power.category))}</span>
        <span style="font-size:.8em;padding:2px 7px;border:1px solid currentColor;border-radius:999px;">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueAutomationLabel(power.automation))}</span>
      </div>
      <p style="margin:0;opacity:.8;">Source : ${add2eObjectMagicEscapeHtml(power.source?.section ?? "Guide du Maître")}${power.source?.page ? `, page ${add2eObjectMagicEscapeHtml(power.source.page)}` : ""}</p>
      ${controls}
      <p style="margin:0;font-size:.82em;opacity:.75;">Les champs complexes acceptent une valeur simple ou du JSON. Les paramètres marqués d’un astérisque sont obligatoires.</p>
    </div>`,
    buttons: [
      {
        action: "save",
        label: "Enregistrer",
        icon: "fa-solid fa-check",
        default: true,
        callback: (_event, button, dialog) => {
          const root = button?.form ?? dialog?.element;
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
            ui.notifications.warn(`Paramètres obligatoires manquants : ${missing.join(", ")}.`);
            return false;
          }
          return parameters;
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
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

function add2eMagicCatalogueParameterSummary(parameters = {}) {
  const entries = Object.entries(parameters);
  if (!entries.length) return "Aucun paramètre";
  return entries.map(([key, value]) => {
    const display = Array.isArray(value)
      ? value.join(", ")
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
    return `${key}: ${display}`;
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
        <small style="opacity:.8;overflow-wrap:anywhere;">${add2eObjectMagicEscapeHtml(add2eMagicCatalogueParameterSummary(entry.parameters))}</small>
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
