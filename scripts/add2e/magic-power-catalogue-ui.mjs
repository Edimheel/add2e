// ADD2E — Sélecteur de pouvoirs du catalogue dans le générateur d'objets magiques.
// Le générateur demeure dans object-magic-powers.mjs.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.

const ADD2E_MAGIC_POWER_CATALOGUE_UI_VERSION = "2026-07-21-magic-power-catalogue-ui-v1";
const ADD2E_MAGIC_POWER_UI_STATES = new WeakMap();

function add2eMagicPowerUiEscape(value) {
  const text = String(value ?? "");
  try {
    if (typeof foundry?.utils?.escapeHTML === "function") return foundry.utils.escapeHTML(text);
  } catch (_error) {}
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function add2eMagicPowerUiNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eMagicPowerUiArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eMagicPowerUiArray);
  if (value instanceof Set) return [...value].flatMap(add2eMagicPowerUiArray);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  return [value];
}

function add2eMagicPowerUiClone(value) {
  try { return foundry.utils.deepClone(value); }
  catch (_error) {
    try { return structuredClone(value); }
    catch (_cloneError) { return JSON.parse(JSON.stringify(value ?? null)); }
  }
}

function add2eMagicPowerUiCreatorForm(appOrHtml) {
  const raw = appOrHtml?.element ?? appOrHtml ?? null;
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
      ?? null;
}

function add2eMagicPowerUiProfileContext(form) {
  const profile = String(form?.elements?.profile?.value ?? "objet").trim();
  const itemType = profile === "arme" ? "arme" : profile === "armure" ? "armure" : "objet";
  return { profile, itemType };
}

function add2eMagicPowerUiState(form) {
  if (!ADD2E_MAGIC_POWER_UI_STATES.has(form)) {
    ADD2E_MAGIC_POWER_UI_STATES.set(form, {
      catalogue: null,
      compatible: [],
      selected: [],
      sequence: 0,
      previousProfile: ""
    });
  }
  return ADD2E_MAGIC_POWER_UI_STATES.get(form);
}

function add2eMagicPowerUiAutomationLabel(value) {
  return ({
    automatic: "Automatique",
    assisted: "Assisté par le MD",
    manual: "Manuel",
    chat_card: "Carte de chat"
  })[add2eMagicPowerUiNormalize(value)] ?? String(value ?? "—");
}

function add2eMagicPowerUiCategoryLabel(value) {
  const normalized = add2eMagicPowerUiNormalize(value);
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
  return labels[normalized] ?? String(value ?? "Autre");
}

function add2eMagicPowerUiParameterInitial(schema, currentValue) {
  if (currentValue !== undefined) return currentValue;
  if (schema?.default !== undefined) return add2eMagicPowerUiClone(schema.default);
  if (schema?.value !== undefined) return add2eMagicPowerUiClone(schema.value);
  return undefined;
}

function add2eMagicPowerUiJsonValue(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2); }
  catch (_error) { return String(value); }
}

function add2eMagicPowerUiParameterControl(name, schema = {}, currentValue) {
  const type = add2eMagicPowerUiNormalize(schema.type);
  const value = add2eMagicPowerUiParameterInitial(schema, currentValue);
  const escapedName = add2eMagicPowerUiEscape(name);
  const required = schema.required === true ? " <span style=\"color:#a40000\">*</span>" : "";
  const label = `${add2eMagicPowerUiEscape(name)}${required}`;
  const common = `name="${escapedName}" data-add2e-parameter-type="${add2eMagicPowerUiEscape(type)}"`;

  if (type === "boolean") {
    return `<label class="form-group" style="display:flex;align-items:center;gap:8px;"><input ${common} type="checkbox" ${value === true ? "checked" : ""}> <span>${label}</span></label>`;
  }

  if (type === "fixed" || type === "fixed_list") {
    return `<div class="form-group"><label>${label}</label><input ${common} type="hidden" value="${add2eMagicPowerUiEscape(add2eMagicPowerUiJsonValue(value))}"><div style="padding:6px 8px;border:1px solid var(--color-border-light-primary,#999);border-radius:4px;opacity:.85;">${add2eMagicPowerUiEscape(add2eMagicPowerUiJsonValue(value) || "Valeur imposée")}</div></div>`;
  }

  if (type === "choice" && Array.isArray(schema.values)) {
    const options = schema.values.map(entry => {
      const selected = String(entry) === String(value) ? " selected" : "";
      return `<option value="${add2eMagicPowerUiEscape(entry)}"${selected}>${add2eMagicPowerUiEscape(entry)}</option>`;
    }).join("");
    return `<div class="form-group"><label>${label}</label><select ${common}>${options}</select></div>`;
  }

  if (type === "choice_list" && Array.isArray(schema.values)) {
    const selectedValues = new Set(add2eMagicPowerUiArray(value).map(String));
    const options = schema.values.map(entry => `<option value="${add2eMagicPowerUiEscape(entry)}"${selectedValues.has(String(entry)) ? " selected" : ""}>${add2eMagicPowerUiEscape(entry)}</option>`).join("");
    return `<div class="form-group"><label>${label}</label><select ${common} multiple size="${Math.min(7, Math.max(3, schema.values.length))}">${options}</select></div>`;
  }

  const numericTypes = new Set(["integer", "number", "percentage", "percentage_per_use"]);
  if (numericTypes.has(type)) {
    const min = Number.isFinite(Number(schema.min)) ? ` min="${Number(schema.min)}"` : "";
    const max = Number.isFinite(Number(schema.max)) ? ` max="${Number(schema.max)}"` : "";
    const step = type === "integer" ? "1" : "any";
    return `<div class="form-group"><label>${label}</label><input ${common} type="number" step="${step}"${min}${max} value="${add2eMagicPowerUiEscape(value ?? "")}"></div>`;
  }

  const jsonTypes = new Set([
    "object", "effect_list", "effect_table", "spell_list", "form_list", "save_rule",
    "percentage_or_save", "percentage_or_table", "number_or_table", "weight_or_table",
    "formula_or_table"
  ]);
  if (jsonTypes.has(type)) {
    return `<div class="form-group"><label>${label}</label><textarea ${common} rows="3" placeholder="Valeur ou JSON">${add2eMagicPowerUiEscape(add2eMagicPowerUiJsonValue(value))}</textarea></div>`;
  }

  const listTypes = new Set(["tag_list", "string_list", "integer_list"]);
  if (listTypes.has(type)) {
    return `<div class="form-group"><label>${label}</label><input ${common} type="text" value="${add2eMagicPowerUiEscape(add2eMagicPowerUiArray(value).join(", "))}" placeholder="Valeurs séparées par des virgules"></div>`;
  }

  return `<div class="form-group"><label>${label}</label><input ${common} type="text" value="${add2eMagicPowerUiEscape(add2eMagicPowerUiJsonValue(value))}"></div>`;
}

function add2eMagicPowerUiReadParameter(input, schema = {}) {
  const type = add2eMagicPowerUiNormalize(schema.type);
  if (type === "boolean") return input.checked === true;
  if (type === "choice_list") return [...input.selectedOptions].map(option => option.value);
  if (type === "fixed" || type === "fixed_list") return add2eMagicPowerUiClone(schema.value);

  const raw = String(input.value ?? "").trim();
  if (!raw) return undefined;

  if (["integer", "number", "percentage", "percentage_per_use"].includes(type)) {
    const number = Number(raw.replace(",", "."));
    return Number.isFinite(number) ? number : undefined;
  }
  if (["tag_list", "string_list"].includes(type)) return add2eMagicPowerUiArray(raw).map(String);
  if (type === "integer_list") return add2eMagicPowerUiArray(raw).map(Number).filter(Number.isFinite);
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

function add2eMagicPowerUiValidateParameters(power, parameters) {
  const missing = [];
  for (const [name, schema] of Object.entries(power.parameters ?? {})) {
    if (schema?.required !== true) continue;
    const value = parameters[name];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) missing.push(name);
  }
  const alternatives = add2eMagicPowerUiArray(power.validation?.requiresOneOf);
  if (alternatives.length && !alternatives.some(name => {
    const value = parameters[name];
    return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length);
  })) {
    missing.push(`un des paramètres suivants : ${alternatives.join(", ")}`);
  }
  return missing;
}

async function add2eMagicPowerUiConfigurePower(power, existingParameters = {}) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("DialogV2 est introuvable.");
    return null;
  }

  const parameterEntries = Object.entries(power.parameters ?? {});
  if (!parameterEntries.length) return {};
  const controls = parameterEntries.map(([name, schema]) =>
    add2eMagicPowerUiParameterControl(name, schema, existingParameters?.[name])
  ).join("");

  const result = await DialogV2.wait({
    window: { title: `Configurer — ${power.label}` },
    modal: true,
    rejectClose: false,
    content: `<div class="add2e-dialog add2e-magic-power-parameter-form" style="min-width:560px;padding:10px;display:grid;gap:8px;">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <strong>${add2eMagicPowerUiEscape(power.label)}</strong>
        <span style="font-size:.8em;padding:2px 7px;border:1px solid currentColor;border-radius:999px;">${add2eMagicPowerUiEscape(add2eMagicPowerUiCategoryLabel(power.category))}</span>
        <span style="font-size:.8em;padding:2px 7px;border:1px solid currentColor;border-radius:999px;">${add2eMagicPowerUiEscape(add2eMagicPowerUiAutomationLabel(power.automation))}</span>
      </div>
      <p style="margin:0;opacity:.8;">Source : ${add2eMagicPowerUiEscape(power.source?.section ?? "Guide du Maître")}${power.source?.page ? `, page ${add2eMagicPowerUiEscape(power.source.page)}` : ""}</p>
      ${controls}
      <p style="margin:0;font-size:.82em;opacity:.75;">Les champs complexes acceptent une valeur simple ou du JSON. Les paramètres marqués d’un astérisque sont obligatoires.</p>
    </div>`,
    buttons: [
      {
        action: "save",
        label: "Ajouter le pouvoir",
        icon: "fa-solid fa-check",
        default: true,
        callback: (_event, button, dialog) => {
          const root = button?.form ?? dialog?.element;
          const parameters = {};
          for (const [name, schema] of parameterEntries) {
            const input = root?.querySelector?.(`[name="${CSS.escape(name)}"]`);
            if (!input) continue;
            const value = add2eMagicPowerUiReadParameter(input, schema);
            if (value !== undefined) parameters[name] = value;
          }
          const missing = add2eMagicPowerUiValidateParameters(power, parameters);
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

function add2eMagicPowerUiSelectedPayload(state) {
  return state.selected.map(entry => ({
    catalogueId: entry.power.id,
    label: entry.power.label,
    category: entry.power.category,
    automation: entry.power.automation,
    parameters: add2eMagicPowerUiClone(entry.parameters),
    source: add2eMagicPowerUiClone(entry.power.source ?? {})
  }));
}

function add2eMagicPowerUiSyncHidden(form, state) {
  const hidden = form.querySelector('[name="cataloguePowersJson"]');
  if (hidden) hidden.value = JSON.stringify(add2eMagicPowerUiSelectedPayload(state));
}

function add2eMagicPowerUiFilteredPowers(section, state) {
  const search = add2eMagicPowerUiNormalize(section.querySelector('[data-add2e-power-search]')?.value);
  const category = String(section.querySelector('[data-add2e-power-category]')?.value ?? "");
  const automation = String(section.querySelector('[data-add2e-power-automation]')?.value ?? "");
  return state.compatible.filter(power => {
    if (category && String(power.category) !== category) return false;
    if (automation && String(power.automation) !== automation) return false;
    if (!search) return true;
    const haystack = add2eMagicPowerUiNormalize(`${power.label} ${power.id} ${power.category} ${power.automation}`);
    return haystack.includes(search);
  });
}

function add2eMagicPowerUiRenderAvailable(form, state) {
  const section = form.querySelector('[data-add2e-power-section]');
  const select = section?.querySelector?.('[data-add2e-power-select]');
  if (!section || !select) return;

  const powers = add2eMagicPowerUiFilteredPowers(section, state);
  const groups = new Map();
  for (const power of powers) {
    const category = String(power.category ?? "other");
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(power);
  }
  select.innerHTML = [...groups.entries()]
    .sort(([left], [right]) => add2eMagicPowerUiCategoryLabel(left).localeCompare(add2eMagicPowerUiCategoryLabel(right), "fr"))
    .map(([category, entries]) => `<optgroup label="${add2eMagicPowerUiEscape(add2eMagicPowerUiCategoryLabel(category))}">${entries
      .sort((left, right) => String(left.label).localeCompare(String(right.label), "fr"))
      .map(power => `<option value="${add2eMagicPowerUiEscape(power.id)}">${add2eMagicPowerUiEscape(power.label)} — ${add2eMagicPowerUiEscape(add2eMagicPowerUiAutomationLabel(power.automation))}</option>`)
      .join("")}</optgroup>`)
    .join("");
  const count = section.querySelector('[data-add2e-power-available-count]');
  if (count) count.textContent = `${powers.length} pouvoir${powers.length > 1 ? "s" : ""} compatible${powers.length > 1 ? "s" : ""}`;
}

function add2eMagicPowerUiParameterSummary(parameters = {}) {
  const entries = Object.entries(parameters);
  if (!entries.length) return "Aucun paramètre";
  return entries.map(([key, value]) => {
    const display = Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value);
    return `${key}: ${display}`;
  }).join(" · ");
}

function add2eMagicPowerUiRenderSelected(form, state) {
  const section = form.querySelector('[data-add2e-power-section]');
  const container = section?.querySelector?.('[data-add2e-selected-powers]');
  if (!container) return;
  container.innerHTML = state.selected.length
    ? state.selected.map(entry => `<article data-add2e-selected-power="${add2eMagicPowerUiEscape(entry.uid)}" style="border:1px solid var(--color-border-light-primary,#999);border-radius:6px;padding:7px;display:grid;gap:5px;">
        <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;">
          <strong style="flex:1;">${add2eMagicPowerUiEscape(entry.power.label)}</strong>
          <span style="font-size:.76em;padding:1px 6px;border:1px solid currentColor;border-radius:999px;">${add2eMagicPowerUiEscape(add2eMagicPowerUiCategoryLabel(entry.power.category))}</span>
          <span style="font-size:.76em;padding:1px 6px;border:1px solid currentColor;border-radius:999px;">${add2eMagicPowerUiEscape(add2eMagicPowerUiAutomationLabel(entry.power.automation))}</span>
          <button type="button" data-action="edit-catalogue-power" data-power-uid="${add2eMagicPowerUiEscape(entry.uid)}" title="Configurer"><i class="fa-solid fa-pen"></i></button>
          <button type="button" data-action="remove-catalogue-power" data-power-uid="${add2eMagicPowerUiEscape(entry.uid)}" title="Retirer"><i class="fa-solid fa-trash"></i></button>
        </div>
        <small style="opacity:.8;overflow-wrap:anywhere;">${add2eMagicPowerUiEscape(add2eMagicPowerUiParameterSummary(entry.parameters))}</small>
      </article>`).join("")
    : `<p style="margin:0;opacity:.72;text-align:center;padding:7px;">Aucun pouvoir sélectionné.</p>`;
  const count = section.querySelector('[data-add2e-selected-count]');
  if (count) count.textContent = `${state.selected.length} sélectionné${state.selected.length > 1 ? "s" : ""}`;
  add2eMagicPowerUiSyncHidden(form, state);
}

function add2eMagicPowerUiRefreshFilters(form, state) {
  const section = form.querySelector('[data-add2e-power-section]');
  if (!section) return;
  const categorySelect = section.querySelector('[data-add2e-power-category]');
  const automationSelect = section.querySelector('[data-add2e-power-automation]');
  const currentCategory = categorySelect?.value ?? "";
  const currentAutomation = automationSelect?.value ?? "";

  const categories = [...new Set(state.compatible.map(power => String(power.category ?? "")).filter(Boolean))]
    .sort((left, right) => add2eMagicPowerUiCategoryLabel(left).localeCompare(add2eMagicPowerUiCategoryLabel(right), "fr"));
  if (categorySelect) {
    categorySelect.innerHTML = `<option value="">Toutes les catégories</option>${categories.map(category => `<option value="${add2eMagicPowerUiEscape(category)}">${add2eMagicPowerUiEscape(add2eMagicPowerUiCategoryLabel(category))}</option>`).join("")}`;
    categorySelect.value = categories.includes(currentCategory) ? currentCategory : "";
  }

  const automations = [...new Set(state.compatible.map(power => String(power.automation ?? "")).filter(Boolean))]
    .sort((left, right) => add2eMagicPowerUiAutomationLabel(left).localeCompare(add2eMagicPowerUiAutomationLabel(right), "fr"));
  if (automationSelect) {
    automationSelect.innerHTML = `<option value="">Tous les niveaux d’automatisation</option>${automations.map(automation => `<option value="${add2eMagicPowerUiEscape(automation)}">${add2eMagicPowerUiEscape(add2eMagicPowerUiAutomationLabel(automation))}</option>`).join("")}`;
    automationSelect.value = automations.includes(currentAutomation) ? currentAutomation : "";
  }
}

async function add2eMagicPowerUiRefreshCompatibility(form, { profileChanged = false } = {}) {
  const state = add2eMagicPowerUiState(form);
  const context = add2eMagicPowerUiProfileContext(form);
  const loader = globalThis.add2eLoadMagicPowerCatalogue;
  const compatibleLoader = globalThis.add2eGetCompatibleMagicPowers;
  if (typeof loader !== "function" || typeof compatibleLoader !== "function") {
    throw new Error("Le chargeur du catalogue de pouvoirs est indisponible.");
  }

  state.catalogue ??= await loader();
  state.compatible = await compatibleLoader(context);
  const compatibleIds = new Set(state.compatible.map(power => power.id));
  if (profileChanged) state.selected = state.selected.filter(entry => compatibleIds.has(entry.power.id));
  state.previousProfile = context.profile;
  add2eMagicPowerUiRefreshFilters(form, state);
  add2eMagicPowerUiRenderAvailable(form, state);
  add2eMagicPowerUiRenderSelected(form, state);

  const section = form.querySelector('[data-add2e-power-section]');
  const status = section?.querySelector?.('[data-add2e-power-status]');
  if (status) status.textContent = `${state.catalogue.counts?.standardPowers ?? 0} pouvoirs standards chargés — artefacts exclus.`;
}

async function add2eMagicPowerUiAddSelected(form) {
  const state = add2eMagicPowerUiState(form);
  const select = form.querySelector('[data-add2e-power-select]');
  const power = state.compatible.find(entry => entry.id === select?.value);
  if (!power) {
    ui.notifications.warn("Sélectionnez un pouvoir compatible.");
    return;
  }
  const parameters = await add2eMagicPowerUiConfigurePower(power, {});
  if (parameters === null) return;
  state.sequence += 1;
  state.selected.push({
    uid: `${power.id}-${state.sequence}`,
    power,
    parameters
  });
  add2eMagicPowerUiRenderSelected(form, state);
}

async function add2eMagicPowerUiEditSelected(form, uid) {
  const state = add2eMagicPowerUiState(form);
  const entry = state.selected.find(selected => selected.uid === uid);
  if (!entry) return;
  const parameters = await add2eMagicPowerUiConfigurePower(entry.power, entry.parameters);
  if (parameters === null) return;
  entry.parameters = parameters;
  add2eMagicPowerUiRenderSelected(form, state);
}

function add2eMagicPowerUiRemoveSelected(form, uid) {
  const state = add2eMagicPowerUiState(form);
  state.selected = state.selected.filter(entry => entry.uid !== uid);
  add2eMagicPowerUiRenderSelected(form, state);
}

function add2eMagicPowerUiBind(form) {
  if (!form || form.dataset.add2eMagicPowerCatalogueUiBound === "1") return;
  form.dataset.add2eMagicPowerCatalogueUiBound = "1";

  form.addEventListener("input", event => {
    const target = event.target;
    if (target?.matches?.('[data-add2e-power-search]')) add2eMagicPowerUiRenderAvailable(form, add2eMagicPowerUiState(form));
  });
  form.addEventListener("change", event => {
    const target = event.target;
    if (target?.matches?.('[data-add2e-power-category], [data-add2e-power-automation]')) {
      add2eMagicPowerUiRenderAvailable(form, add2eMagicPowerUiState(form));
      return;
    }
    if (target?.matches?.('select[name="profile"]')) {
      add2eMagicPowerUiRefreshCompatibility(form, { profileChanged: true }).catch(error => {
        console.error("[ADD2E][MAGIC_POWER_CATALOGUE_UI][PROFILE_ERROR]", error);
        ui.notifications.error(error.message);
      });
    }
  });
  form.addEventListener("click", event => {
    const action = event.target?.closest?.("[data-action]");
    if (!action) return;
    const actionName = String(action.dataset.action ?? "");
    if (!actionName.includes("catalogue-power")) return;
    event.preventDefault();
    event.stopPropagation();
    if (actionName === "add-catalogue-power") {
      add2eMagicPowerUiAddSelected(form).catch(error => {
        console.error("[ADD2E][MAGIC_POWER_CATALOGUE_UI][ADD_ERROR]", error);
        ui.notifications.error(error.message);
      });
    } else if (actionName === "edit-catalogue-power") {
      add2eMagicPowerUiEditSelected(form, action.dataset.powerUid).catch(error => {
        console.error("[ADD2E][MAGIC_POWER_CATALOGUE_UI][EDIT_ERROR]", error);
        ui.notifications.error(error.message);
      });
    } else if (actionName === "remove-catalogue-power") {
      add2eMagicPowerUiRemoveSelected(form, action.dataset.powerUid);
    }
  });
}

async function add2eMagicPowerUiInstall(appOrHtml) {
  const form = add2eMagicPowerUiCreatorForm(appOrHtml);
  if (!form || form.querySelector('[data-add2e-power-section]')) return false;

  const section = document.createElement("section");
  section.dataset.add2ePowerSection = "1";
  section.setAttribute("data-add2e-power-section", "");
  section.style.cssText = "display:grid;gap:8px;border:1px solid var(--color-border-light-primary,#999);border-radius:7px;padding:9px;";
  section.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <h3 style="margin:0;flex:1;"><i class="fa-solid fa-wand-sparkles"></i> Pouvoirs magiques</h3>
      <span data-add2e-selected-count style="font-size:.8em;padding:2px 7px;border:1px solid currentColor;border-radius:999px;">0 sélectionné</span>
    </div>
    <p data-add2e-power-status style="margin:0;font-size:.84em;opacity:.78;">Chargement du catalogue…</p>
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:6px;">
      <input data-add2e-power-search type="search" placeholder="Rechercher un pouvoir">
      <select data-add2e-power-category><option value="">Toutes les catégories</option></select>
      <select data-add2e-power-automation><option value="">Toute automatisation</option></select>
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:end;">
      <label style="display:grid;gap:4px;"><span data-add2e-power-available-count>0 pouvoir compatible</span><select data-add2e-power-select></select></label>
      <button type="button" data-action="add-catalogue-power"><i class="fa-solid fa-plus"></i> Ajouter</button>
    </div>
    <div data-add2e-selected-powers style="display:grid;gap:6px;"></div>
    <input type="hidden" name="cataloguePowersJson" value="[]">
    <p style="margin:0;font-size:.8em;opacity:.7;">Cette étape prépare la sélection et les paramètres. Leur écriture définitive dans l’Item sera raccordée à l’étape 4.</p>`;

  const note = [...form.querySelectorAll("p")].find(element => element.textContent?.includes("Arme et Armure exigent"));
  if (note) form.insertBefore(section, note);
  else form.append(section);

  add2eMagicPowerUiBind(form);
  try {
    await add2eMagicPowerUiRefreshCompatibility(form);
  } catch (error) {
    console.error("[ADD2E][MAGIC_POWER_CATALOGUE_UI][LOAD_ERROR]", error);
    const status = section.querySelector('[data-add2e-power-status]');
    if (status) status.textContent = `Catalogue indisponible : ${error.message}`;
    const button = section.querySelector('[data-action="add-catalogue-power"]');
    if (button) button.disabled = true;
  }
  return true;
}

globalThis.ADD2E_MAGIC_POWER_CATALOGUE_UI_VERSION = ADD2E_MAGIC_POWER_CATALOGUE_UI_VERSION;
globalThis.add2eMagicPowerUiInstall = add2eMagicPowerUiInstall;

Hooks.on("renderApplicationV2", (app, html) => {
  queueMicrotask(() => add2eMagicPowerUiInstall(html).catch(error => {
    console.error("[ADD2E][MAGIC_POWER_CATALOGUE_UI][RENDER_ERROR]", error);
  }));
  globalThis.requestAnimationFrame?.(() => add2eMagicPowerUiInstall(app).catch(error => {
    console.error("[ADD2E][MAGIC_POWER_CATALOGUE_UI][RENDER_ERROR]", error);
  }));
});
