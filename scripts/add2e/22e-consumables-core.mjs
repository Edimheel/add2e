// ADD2E — Composants de sort : résolution unique, réservation transactionnelle et affichage HUD.
// Les sorts acteur générés (normal, inverse et variantes) portent leur propre profil matériel.
// Cette source résolue est utilisée à la fois par le lancement, la feuille et le HUD.

import {
  GM_OPERATION_TYPE,
  isAmmunition,
  isComponent as vendorIsComponent,
  quantity,
  quantityUpdate,
  num,
  lower,
  slug,
  esc
} from "./22a-vendor-core.mjs";

export const ADD2E_CONSUMABLES_VERSION = "2026-06-24-consumables-core-v16-resolved-hud-materials";
export const SOCKET_COMPONENT_RESULT = "ADD2E_SPELL_COMPONENT_RESULT";
export const GM_OPERATION_COMPONENT_RESERVE = "vendorReserveSpellComponents";
export const GM_OPERATION_COMPONENT_REFUND = "vendorRefundSpellComponents";
export const GM_OPERATION_COMPONENT_FINALIZE = "vendorFinalizeSpellComponents";

const HUD_ID = "add2e-action-hud";
let hudComponentObserver = null;
let hudComponentFrame = null;
let hudComponentPatching = false;

const asArray = value => Array.isArray(value)
  ? value
  : value === null || value === undefined || value === ""
    ? []
    : typeof value === "string"
      ? value.split(/[,;|\n]+|\bet\b/gi).map(v => v.trim()).filter(Boolean)
      : [value];

function toFieldArray(value) {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(toFieldArray).filter(Boolean);
  if (typeof value === "object") {
    for (const key of ["tags", "effectTags", "effecttags", "list", "items", "value", "material", "materials", "components"]) {
      if (value[key] !== undefined) return toFieldArray(value[key]);
    }
  }
  return asArray(value);
}

function componentSettingEnabled() {
  try {
    if (!game?.settings?.settings?.has?.("add2e.gestionComposantsSorts")) return true;
    return !!game.settings.get("add2e", "gestionComposantsSorts");
  } catch (_err) {
    return true;
  }
}

async function componentAlert(message, title = "Composant manquant") {
  const clean = String(message || "Composant matériel manquant.").trim();
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  const content = `<div class="add2e-dialog add2e-consumable-alert">
    <h3 style="margin:0 0 0.45rem 0;"><i class="fas fa-pouch"></i> ${esc(title)}</h3>
    <p style="margin:0;">${esc(clean)}</p>
  </div>`;
  if (DialogV2?.alert) {
    await DialogV2.alert({ window: { title }, content, ok: { label: "Compris" }, modal: true });
    return true;
  }
  if (DialogV2?.confirm) {
    await DialogV2.confirm({ window: { title }, content, yes: { label: "Compris" }, no: { label: "Fermer" }, modal: true });
    return true;
  }
  ui.notifications?.warn?.(clean);
  return false;
}

function itemTextFields(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [
    item?.name, system.nom, system.categorie, system.category, system.sousType, system.sous_type,
    system.type, system.subtype, system.kind, system.slot, system.slug, system.composant,
    system.component, system.composantSlug, system.componentSlug, flags.vendorKind, flags.kind,
    flags.slug, flags.componentSlug, ...toFieldArray(system.tags), ...toFieldArray(system.effectTags),
    ...toFieldArray(system.effecttags), ...toFieldArray(flags.tags), ...toFieldArray(flags.effectTags),
    ...toFieldArray(flags.effecttags)
  ].map(lower).filter(Boolean);
}

function isSacredSymbolName(value) {
  const key = slug(value);
  return key === "symbole_sacre" || key === "holy_symbol" || key === "symbole_saint"
    || key.startsWith("symbole_sacre_") || key.startsWith("holy_symbol_");
}

function isSacredSymbolItem(item) {
  const system = item?.system ?? {};
  return [item?.name, system.nom, system.slug, system.composantSlug, system.componentSlug].some(isSacredSymbolName);
}

function isKnownLooseComponentName(value) {
  const key = slug(value);
  if (!key) return false;
  const exact = new Set([
    "eau_benite", "eau_maudite", "eau_benite_ou_maudite", "eau_benite_maudite",
    "symbole_sacre", "gui", "encens", "poudre_d_argent", "poudre_d_or", "poudre_de_fer",
    "sable", "soufre", "phosphore", "ambre", "perle", "miroir", "plume", "petite_plume"
  ]);
  if (exact.has(key)) return true;
  return /(^|_)(eau_benite|eau_maudite|symbole_sacre|encens|gui|soufre|phosphore|poudre_d_argent|poudre_d_or|poudre_de_fer|plume|ambre|perle|miroir)(_|$)/.test(key);
}

function isSpellComponentItem(item) {
  if (!item) return false;
  if (vendorIsComponent(item)) return true;
  const fields = itemTextFields(item);
  if (fields.some(v => v === "component" || v === "composant" || v === "composants")) return true;
  if (fields.some(v => v === "composant_sort" || v === "composants_sort" || v === "composant_de_sort" || v === "composants_de_sort")) return true;
  if (fields.some(v => v === "spell_component" || v === "spell_components" || v === "material_component" || v === "material_components")) return true;
  if (fields.some(v => v.startsWith("composant:") || v.startsWith("component:") || v.startsWith("spell_component:"))) return true;
  if (fields.some(v => v.includes("composant") && v.includes("sort"))) return true;
  if (fields.some(v => v.includes("spell") && v.includes("component"))) return true;
  return isKnownLooseComponentName(item?.name) || isKnownLooseComponentName(item?.system?.nom);
}

function booleanValue(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (value === undefined || value === null || value === "") return null;
  const text = lower(value);
  if (["true", "1", "yes", "oui", "on"].includes(text)) return true;
  if (["false", "0", "no", "non", "off"].includes(text)) return false;
  return null;
}

function componentRequirementConsumes(value, fallback = true) {
  if (!value || typeof value !== "object") return fallback;
  if (isSacredSymbolName(rawRequirementName(value))) return false;
  const reusable = booleanValue(value.reutilisable ?? value.réutilisable ?? value.reusable);
  if (reusable === true) return false;
  const explicit = booleanValue(value.consomme ?? value.consume ?? value.consumable ?? value.consomable ?? value.estConsommable);
  if (explicit !== null) return explicit;
  const mode = lower(value.consommation ?? value.consumption ?? "");
  if (!mode) return fallback;
  return !(/^(non|reutilisable)$/.test(mode) || /reutilis|non[\s_-]*consomm|sans[\s_-]*consomm|permanent/.test(mode));
}

function isReusableComponentItem(item) {
  if (!item) return false;
  if (isSacredSymbolItem(item)) return true;
  const system = item.system ?? {};
  const flags = item.flags?.add2e ?? {};
  const reusable = booleanValue(system.reutilisable ?? system.réutilisable ?? system.reusable ?? flags.reutilisable ?? flags.réutilisable ?? flags.reusable);
  if (reusable === true) return true;
  const consumable = booleanValue(system.consommable ?? system.consumable ?? system.consomme ?? system.consume ?? flags.consommable ?? flags.consumable ?? flags.consomme ?? flags.consume);
  if (consumable !== null) return consumable === false;
  const mode = lower(system.consommation ?? system.consumption ?? flags.consommation ?? flags.consumption ?? "");
  if (/^(non|reutilisable)$/.test(mode) || /reutilis|non[\s_-]*consomm|sans[\s_-]*consomm|permanent/.test(mode)) return true;
  return itemTextFields(item).some(value => /reutilis|non[\s_-]*consomm|sans[\s_-]*consomm/.test(value));
}

function isOnlyComponentCode(value) {
  const text = lower(value).replace(/[^a-z]/g, "");
  return ["v", "s", "m", "vs", "vm", "sm", "vsm", "verbal", "somatique", "materiel", "materielle", "material"].includes(text);
}

function cleanComponentName(value) {
  let text = String(value ?? "").trim();
  text = text.replace(/[()\[\]{}]/g, " ").replace(/\s+/g, " ").trim();
  text = text.replace(/[.!?;:]+$/g, "").trim().replace(/^d['’]\s*/i, "");
  text = text.replace(/^(un|une)?\s*peu\s+de\s+/i, "").replace(/^(un|une|du|de la|de l['’]?|des|le|la|les)\s+/i, "");
  text = text.replace(/^(quelques|plusieurs)\s+/i, "").replace(/^petit morceau de\s+/i, "").replace(/^morceau de\s+/i, "");
  return text.replace(/^poignee de\s+/i, "").replace(/^poignée de\s+/i, "").trim();
}

function rawRequirementName(value) {
  if (typeof value === "object" && value) return value.name ?? value.nom ?? value.label ?? value.item ?? value.itemName ?? value.component ?? value.composant ?? value.slug ?? value.id;
  return value;
}

function rawRequirementQuantity(value) {
  return typeof value === "object" && value ? (value.quantity ?? value.quantite ?? value.qty ?? value.nombre ?? value.count ?? value.value ?? 1) : 1;
}

function isStructuredAlternative(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const condition = lower(value.condition ?? value.conditions ?? value.note ?? value.notes ?? value.sourceCondition ?? "");
  if (condition.includes("alternative") || /\bou\b/i.test(condition)) return true;
  return lower(value.consommation ?? value.consumption ?? value.consume ?? "").includes("optionnel") && condition.length > 0;
}

function requirementKey(rawName) {
  const key = slug(cleanComponentName(rawName));
  return key === "eau_benite_ou_maudite" || key === "eau_benite_maudite" ? "eau_benite" : key;
}

function makeRequirement(rawName, rawQty = 1, consume = true) {
  const name = cleanComponentName(rawName);
  if (!name || isOnlyComponentCode(name)) return null;
  const key = requirementKey(name);
  if (!key) return null;
  return { name, key, quantity: Math.max(1, Math.floor(num(rawQty, 1))), consume: !isSacredSymbolName(name) && consume !== false };
}

function addRequirement(out, rawName, rawQty = 1, consume = true) {
  const requirement = makeRequirement(rawName, rawQty, consume);
  if (!requirement) return;
  const existing = out.find(entry => entry.key === requirement.key && entry.consume === requirement.consume && !entry.alternatives);
  if (existing) existing.quantity += requirement.quantity;
  else out.push(requirement);
}

function addAlternativeRequirement(out, alternatives) {
  const clean = [];
  for (const alternative of alternatives) {
    const requirement = makeRequirement(rawRequirementName(alternative), rawRequirementQuantity(alternative), componentRequirementConsumes(alternative));
    if (requirement && !clean.some(entry => entry.key === requirement.key && entry.consume === requirement.consume)) clean.push(requirement);
  }
  if (!clean.length) return;
  if (clean.length === 1) return addRequirement(out, clean[0].name, clean[0].quantity, clean[0].consume);
  out.push({ name: clean.map(entry => entry.name).join(" ou "), key: clean.map(entry => entry.key).join("__or__"), quantity: 1, alternatives: clean });
}

function collectRequirement(out, value) {
  if (value === null || value === undefined || value === "") return;
  if (Array.isArray(value)) {
    const alternatives = value.filter(isStructuredAlternative);
    const alternativeKeys = new Set(alternatives.map(entry => `${rawRequirementName(entry)}|${rawRequirementQuantity(entry)}`));
    if (alternatives.length > 1) addAlternativeRequirement(out, alternatives);
    for (const entry of value) {
      if (alternatives.length > 1 && alternativeKeys.has(`${rawRequirementName(entry)}|${rawRequirementQuantity(entry)}`)) continue;
      collectRequirement(out, entry);
    }
    return;
  }
  if (typeof value === "string") {
    for (const rawPart of String(value).split(/[,;|\n]+/).map(part => part.trim()).filter(Boolean)) {
      const part = String(rawPart ?? "").replace(/[()\[\]{}]/g, " ").replace(/\s+/g, " ").trim();
      const alternatives = part.split(/\bou\b/gi).map(entry => entry.trim()).filter(Boolean);
      if (alternatives.length > 1) addAlternativeRequirement(out, alternatives);
      else addRequirement(out, part, 1);
    }
    return;
  }
  if (typeof value === "object") {
    const alternatives = value.alternatives ?? value.options ?? value.choix ?? value.auChoix ?? value.or;
    if (Array.isArray(alternatives) && alternatives.length) return addAlternativeRequirement(out, alternatives);
    const name = rawRequirementName(value);
    if (name) addRequirement(out, name, rawRequirementQuantity(value), componentRequirementConsumes(value));
  }
}

function spellHasMaterialComponent(sort) {
  const system = sort?.system ?? {};
  const flags = sort?.flags?.add2e ?? {};
  const text = [system.composantes, system.components, system.componentes, flags.composantes, flags.components, flags.componentes].flatMap(toFieldArray).map(lower).join(" ");
  return /(^|[^a-z])m([^a-z]|$)|materiel|matériel|material/.test(text);
}

function collectFields(out, fields) {
  for (const field of fields.filter(value => value !== undefined && value !== null && value !== "")) collectRequirement(out, field);
}

function spellComponentRequirements(sort) {
  const system = sort?.system ?? {};
  const flags = sort?.flags?.add2e ?? {};
  const out = [];
  const explicitProfileFields = [
    system.composants_materiels, system.composantsMateriels, system.composants_materiels_objets,
    sort?.composants_materiels, sort?.composants_materiels_objets
  ];
  const fallbackFields = [
    system.composants_requis, system.composantsMateriel, system.composant_materiel, system.composantMateriel,
    system.materiel, system.matériel, system.material, system.materialComponent, system.materialComponents,
    system.material_components, system.requiredComponents, system.componentsRequired, system.components?.material,
    system.components?.materials, system.components?.materialComponent, system.components?.materialComponents,
    sort?.materialComponents, sort?.composants_requis, flags.composants_requis, flags.composants,
    flags.components, flags.requiredComponents, flags.effectTags, flags.effecttags
  ];
  for (const field of explicitProfileFields) {
    if (field === undefined || field === null || field === "") continue;
    const profileRequirements = [];
    collectRequirement(profileRequirements, field);
    if (!profileRequirements.length) continue;
    out.push(...profileRequirements);
    break;
  }
  if (!out.length) collectFields(out, fallbackFields);
  if (!out.length) {
    for (const tag of [
      ...toFieldArray(system.tags), ...toFieldArray(system.effectTags), ...toFieldArray(system.effecttags),
      ...toFieldArray(flags.tags), ...toFieldArray(flags.effectTags), ...toFieldArray(flags.effecttags)
    ]) {
      const text = String(tag ?? "").trim();
      if (/^composant[:_]/i.test(text)) addRequirement(out, text.replace(/^composant[:_]/i, ""), 1);
      if (/^component[:_]/i.test(text)) addRequirement(out, text.replace(/^component[:_]/i, ""), 1);
      if (/^spell_component[:_]/i.test(text)) addRequirement(out, text.replace(/^spell_component[:_]/i, ""), 1);
    }
  }
  return out;
}

function componentKeyVariants(value) {
  const base = slug(cleanComponentName(String(value ?? "").replace(/^(composant|component|spell_component)[:_]/i, "")));
  const keys = new Set();
  if (base) keys.add(base);
  if (base.endsWith("s") && base.length > 4) keys.add(base.replace(/s+$/g, ""));
  if (base === "eau_benite_ou_maudite" || base === "eau_benite_maudite" || (base.includes("eau_benite") && base.includes("maudite"))) {
    keys.add("eau_benite");
    keys.add("eau_maudite");
    keys.add("eau_benite_ou_maudite");
    keys.add("eau_benite_maudite");
  }
  return [...keys].filter(Boolean);
}

function componentKeys(item) {
  const keys = new Set();
  for (const field of itemTextFields(item)) for (const key of componentKeyVariants(field)) keys.add(key);
  return [...keys].filter(Boolean);
}

function requirementKeys(requirement) { return componentKeyVariants(requirement?.key ?? requirement?.name); }

function compatibleComponentKey(itemKey, requirementKey) {
  if (!itemKey || !requirementKey) return false;
  if (itemKey === requirementKey) return true;
  const waterKeys = new Set(["eau_benite", "eau_maudite", "eau_benite_ou_maudite", "eau_benite_maudite"]);
  if (waterKeys.has(itemKey) || waterKeys.has(requirementKey)) {
    return (requirementKey === "eau_benite" || requirementKey === "eau_maudite") && (itemKey === "eau_benite_ou_maudite" || itemKey === "eau_benite_maudite");
  }
  return itemKey.includes(requirementKey) || requirementKey.includes(itemKey);
}

function findActorComponent(actor, requirement) {
  const reqKeys = requirementKeys(requirement);
  const matches = [...(actor?.items ?? [])].filter(isSpellComponentItem).filter(item => {
    const keys = componentKeys(item);
    return reqKeys.some(reqKey => keys.some(itemKey => compatibleComponentKey(itemKey, reqKey)));
  });
  return matches.find(item => quantity(item) >= Number(requirement?.quantity ?? 1)) ?? matches[0] ?? null;
}

function findActorComponentForRequirement(actor, requirement) {
  if (!requirement?.alternatives?.length) {
    const item = findActorComponent(actor, requirement);
    return item && quantity(item) >= Number(requirement?.quantity ?? 1) ? { item, requirement } : null;
  }
  for (const alternative of requirement.alternatives) {
    const item = findActorComponent(actor, alternative);
    if (item && quantity(item) >= Number(alternative.quantity ?? 1)) return { item, requirement: alternative, group: requirement };
  }
  return null;
}

export function add2eGetSpellComponentStatus(actor, sort) {
  return spellComponentRequirements(sort).map(requirement => {
    const found = findActorComponentForRequirement(actor, requirement);
    const selectedRequirement = found?.requirement ?? requirement;
    return {
      name: requirement.name,
      key: requirement.key,
      quantity: requirement.quantity,
      alternatives: requirement.alternatives ?? null,
      consume: selectedRequirement.consume !== false,
      available: !!found,
      itemId: found?.item?.id ?? null,
      itemName: found?.item?.name ?? null,
      selectedName: selectedRequirement.name,
      selectedQuantity: selectedRequirement.quantity
    };
  });
}

function sortByName(a, b) { return String(a?.name ?? "").localeCompare(String(b?.name ?? "")); }

function reusableComponentRequirementKeys(actor) {
  const keys = new Set();
  for (const sort of [...(actor?.items ?? [])].filter(item => String(item?.type ?? "").toLowerCase() === "sort")) {
    for (const requirement of spellComponentRequirements(sort)) {
      for (const candidate of requirement.alternatives?.length ? requirement.alternatives : [requirement]) {
        if (candidate?.consume !== false) continue;
        for (const key of requirementKeys(candidate)) keys.add(key);
      }
    }
  }
  return keys;
}

function isReusableComponentForActor(item, reusableKeys) {
  if (isReusableComponentItem(item)) return true;
  if (!reusableKeys?.size) return false;
  const keys = componentKeys(item);
  return keys.some(itemKey => [...reusableKeys].some(requirementKey => compatibleComponentKey(itemKey, requirementKey)));
}

function sortComponentsForActor(actor, items) {
  const reusableKeys = reusableComponentRequirementKeys(actor);
  return items.sort((a, b) => {
    const aReusable = isReusableComponentForActor(a, reusableKeys);
    const bReusable = isReusableComponentForActor(b, reusableKeys);
    return aReusable === bReusable ? sortByName(a, b) : aReusable ? 1 : -1;
  });
}

export function prepareActorSheetConsumables(data) {
  const items = [...(data?.actor?.items ?? [])];
  const objects = Array.isArray(data?.listeObjets) && data.listeObjets.length ? data.listeObjets : items.filter(item => item.type === "objet");
  const carquois = objects.filter(item => isAmmunition(item) && quantity(item) > 0).sort(sortByName);
  const sacoche = sortComponentsForActor(data?.actor, objects.filter(item => isSpellComponentItem(item) && quantity(item) > 0));
  const divers = objects.filter(item => !isAmmunition(item) && !isSpellComponentItem(item)).sort(sortByName);
  data.listeCarquois = carquois;
  data.listeSacocheComposants = sacoche;
  data.listeObjetsDivers = divers;
  data.add2eConsumablesSummary = {
    carquoisCount: carquois.length,
    sacocheCount: sacoche.length,
    objetsDiversCount: divers.length,
    carquoisQuantity: carquois.reduce((sum, item) => sum + quantity(item), 0),
    sacocheQuantity: sacoche.reduce((sum, item) => sum + quantity(item), 0)
  };
  return data;
}

export function patchActorSheetConsumablesData() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto || proto.__add2eConsumablesSheetDataV2 || typeof proto.getData !== "function") return false;
  proto.__add2eConsumablesSheetDataV2 = true;
  const originalGetData = proto.getData;
  proto.getData = async function add2eConsumablesGetData(...args) {
    return prepareActorSheetConsumables(await originalGetData.apply(this, args));
  };
  return true;
}

function serializableReservation(result) {
  return {
    ok: !!result?.ok,
    blocked: !!result?.blocked,
    skipped: !!result?.skipped,
    message: result?.message,
    missing: result?.missing,
    actorId: result?.actorId,
    sortId: result?.sortId,
    sortName: result?.sortName,
    consumed: (result?.consumed ?? []).map(entry => ({
      itemId: entry.itemId, itemName: entry.itemName, before: entry.before, after: entry.after,
      quantity: entry.quantity, requirement: entry.requirement, groupRequirement: entry.groupRequirement,
      deleted: entry.deleted === true
    }))
  };
}

async function finalizeSpellComponentsLocal(reservation) {
  const actor = game.actors?.get(reservation?.actorId);
  if (!actor) return false;
  const ids = [...new Set((reservation?.consumed ?? []).filter(entry => Number(entry?.after) <= 0 && entry?.itemId).map(entry => entry.itemId).filter(itemId => {
    const item = actor.items?.get(itemId);
    return !!item && quantity(item) <= 0;
  }))];
  if (!ids.length) return true;
  await actor.deleteEmbeddedDocuments("Item", ids, { add2eReason: "spell-component-finalized-delete" });
  return true;
}

async function cleanupExistingZeroQuantityComponents() {
  if (!game.user?.isGM) return 0;
  let deleted = 0;
  for (const actor of game.actors ?? []) {
    const ids = [...(actor.items ?? [])].filter(item => String(item?.type ?? "").toLowerCase() === "objet" && isSpellComponentItem(item) && quantity(item) <= 0).map(item => item.id).filter(Boolean);
    if (!ids.length) continue;
    await actor.deleteEmbeddedDocuments("Item", [...new Set(ids)], { add2eReason: "spell-component-zero-ready-cleanup" });
    deleted += ids.length;
  }
  return deleted;
}

function installZeroQuantityComponentCleanup() {
  if (globalThis.__ADD2E_CONSUMABLES_ZERO_CLEANUP_V1) return false;
  globalThis.__ADD2E_CONSUMABLES_ZERO_CLEANUP_V1 = true;
  Hooks.once("ready", () => window.setTimeout(() => {
    cleanupExistingZeroQuantityComponents().catch(err => console.warn("[ADD2E][CONSUMABLES][ZERO_READY_CLEANUP_FAILED]", err));
  }, 750));
  return true;
}

async function reserveSpellComponentsLocal(actor, sort, requirements = null) {
  if (!componentSettingEnabled()) return { ok: true, skipped: true, consumed: [] };
  const requirementsToReserve = Array.isArray(requirements) && requirements.length ? requirements : spellComponentRequirements(sort);
  if (!requirementsToReserve.length) {
    if (!spellHasMaterialComponent(sort)) return { ok: true, skipped: true, consumed: [] };
    return { ok: false, blocked: true, consumed: [], message: `${sort?.name ?? "Ce sort"} requiert une composante matérielle, mais aucun composant précis n'est déclaré sur le sort.` };
  }
  const consumed = [];
  for (const requirement of requirementsToReserve) {
    const found = findActorComponentForRequirement(actor, requirement);
    const item = found?.item ?? null;
    const selectedRequirement = found?.requirement ?? requirement;
    const before = quantity(item);
    if (!item || before < selectedRequirement.quantity) {
      for (const entry of [...consumed].reverse()) {
        const live = actor?.items?.get?.(entry.itemId);
        if (live && quantity(live) === entry.after) await live.update(quantityUpdate(entry.before), { add2eReason: "spell-component-reserve-rollback" });
      }
      return { ok: false, blocked: true, consumed: [], missing: requirement, message: `${actor?.name ?? "Le lanceur"} n'a pas le composant requis : ${requirement.name} (${requirement.quantity}).` };
    }
    if (selectedRequirement.consume === false || isReusableComponentItem(item)) continue;
    const after = before - selectedRequirement.quantity;
    await item.update(quantityUpdate(after), { add2eReason: "spell-component-reserved-gm" });
    consumed.push({ itemId: item.id, itemName: item.name, requirement: selectedRequirement, groupRequirement: found?.group, before, after, quantity: selectedRequirement.quantity, deleted: false });
  }
  return { ok: true, blocked: false, actorId: actor?.id, sortId: sort?.id, sortName: sort?.name, consumed };
}

async function refundSpellComponentsLocal(reservation) {
  const actor = game.actors?.get(reservation?.actorId);
  if (!actor) return false;
  for (const entry of [...(reservation?.consumed ?? [])].reverse()) {
    const item = actor.items?.get(entry.itemId);
    if (!item || quantity(item) !== Number(entry.after)) return false;
    await item.update(quantityUpdate(entry.before), { add2eReason: "spell-component-refund-gm" });
  }
  return true;
}

function requestGmComponentOperation(operation, payload) {
  return new Promise(resolve => {
    if (!game.socket) return resolve({ ok: false, blocked: true, message: "Socket Foundry indisponible." });
    const requestId = payload.requestId ?? foundry.utils.randomID();
    let done = false;
    const finish = result => {
      if (done) return;
      done = true;
      try { game.socket.off?.("system.add2e", handler); } catch (_e) {}
      resolve(result);
    };
    const handler = data => {
      if (data?.type !== SOCKET_COMPONENT_RESULT || data.requestId !== requestId || data.userId !== game.user?.id) return;
      finish(data.result ?? { ok: false, blocked: true, message: "Réponse MJ invalide." });
    };
    game.socket.on?.("system.add2e", handler);
    window.setTimeout(() => finish({ ok: false, blocked: true, message: "Aucune réponse du MJ pour les composants de sort." }), 7000);
    game.socket.emit("system.add2e", { type: GM_OPERATION_TYPE, operation, payload: { ...payload, requestId, userId: game.user?.id } });
  });
}

export async function add2eReserveSpellComponents(actor, sort) {
  if (!componentSettingEnabled()) return { ok: true, skipped: true, consumed: [] };
  const result = game.user?.isGM ? await reserveSpellComponentsLocal(actor, sort) : await requestGmComponentOperation(GM_OPERATION_COMPONENT_RESERVE, {
    actorId: actor?.id,
    sortId: sort?.id,
    sortName: sort?.name,
    requirements: spellComponentRequirements(sort)
  });
  if (result?.blocked) await componentAlert(result.message || "Composant matériel manquant.");
  return result;
}

export async function add2eRefundSpellComponents(reservation) {
  if (!reservation?.consumed?.length) return true;
  if (game.user?.isGM) return refundSpellComponentsLocal(reservation);
  return !!(await requestGmComponentOperation(GM_OPERATION_COMPONENT_REFUND, { reservation }))?.ok;
}

export async function add2eFinalizeSpellComponents(reservation) {
  if (!reservation?.consumed?.length) return true;
  if (game.user?.isGM) return finalizeSpellComponentsLocal(reservation);
  return !!(await requestGmComponentOperation(GM_OPERATION_COMPONENT_FINALIZE, { reservation }))?.ok;
}

function hudActor() {
  const actorId = globalThis.add2eHudCheck?.()?.actorId;
  const controlled = canvas?.tokens?.controlled ?? [];
  if (actorId) {
    const tokenActor = (canvas?.tokens?.placeables ?? []).find(token => token?.actor?.id === actorId)?.actor ?? controlled.find(token => token?.actor?.id === actorId)?.actor ?? null;
    return tokenActor ?? game.actors?.get?.(actorId) ?? null;
  }
  return controlled.length === 1 ? controlled[0]?.actor ?? null : game.user?.character ?? null;
}

function componentBadgeSignature(statuses) {
  return statuses.map(status => [status.key, status.quantity, status.available, status.itemId ?? ""].join("|")).join(";");
}

function buildHudComponentBadges(statuses) {
  const wrapper = document.createElement("span");
  wrapper.className = "add2e-hud-components-resolved";
  wrapper.dataset.add2eComponentSignature = componentBadgeSignature(statuses);
  const title = document.createElement("span");
  title.className = "component-title";
  title.textContent = "Composants";
  wrapper.append(title);
  for (const status of statuses) {
    const badge = document.createElement("span");
    badge.className = status.available ? "component-ok" : "component-bad";
    badge.textContent = `${status.name}${status.quantity > 1 && !status.alternatives ? ` ×${status.quantity}` : ""}`;
    badge.title = status.available ? "Composant disponible" : "Composant manquant ou quantité insuffisante";
    wrapper.append(badge);
  }
  return wrapper;
}

function patchHudComponentBadges() {
  if (hudComponentPatching) return;
  const root = document.getElementById(HUD_ID);
  const actor = hudActor();
  if (!root || !actor) return;
  hudComponentPatching = true;
  try {
    for (const button of root.querySelectorAll('[data-action="cast-spell"][data-item-id]')) {
      const sort = actor.items?.get?.(button.dataset.itemId) ?? null;
      const meta = button.closest(".row")?.querySelector(".meta");
      if (!sort || !meta) continue;
      const statuses = add2eGetSpellComponentStatus(actor, sort);
      const signature = componentBadgeSignature(statuses);
      const existing = meta.querySelector(":scope > .add2e-hud-components-resolved");
      if (existing?.dataset?.add2eComponentSignature === signature) continue;
      for (const stale of meta.querySelectorAll(":scope > .component-title, :scope > .component-ok, :scope > .component-bad, :scope > .add2e-hud-components-resolved")) stale.remove();
      if (statuses.length) meta.append(buildHudComponentBadges(statuses));
    }
  } finally {
    hudComponentPatching = false;
  }
}

function scheduleHudComponentBadges() {
  if (hudComponentFrame !== null) return;
  const raf = globalThis.requestAnimationFrame ?? (callback => setTimeout(callback, 16));
  hudComponentFrame = raf(() => {
    hudComponentFrame = null;
    patchHudComponentBadges();
  });
}

function installHudComponentBadges() {
  if (globalThis.__ADD2E_CONSUMABLES_HUD_COMPONENTS_V1) return false;
  globalThis.__ADD2E_CONSUMABLES_HUD_COMPONENTS_V1 = true;
  const observe = () => {
    if (hudComponentObserver || !document.body) return;
    hudComponentObserver = new MutationObserver(() => {
      if (!hudComponentPatching) scheduleHudComponentBadges();
    });
    hudComponentObserver.observe(document.body, { childList: true, subtree: true });
    scheduleHudComponentBadges();
  };
  if (document.body) observe();
  else Hooks.once("ready", observe);
  return true;
}

export function registerGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.consumables = {
    ...(game.add2e.consumables ?? {}),
    add2eReserveSpellComponents,
    add2eRefundSpellComponents,
    add2eFinalizeSpellComponents,
    add2eGetSpellComponentStatus,
    prepareActorSheetConsumables
  };
  globalThis.ADD2E_CONSUMABLES = { ...(globalThis.ADD2E_CONSUMABLES ?? {}), ...game.add2e.consumables };
  globalThis.ADD2E_CONSUMABLES_VERSION = ADD2E_CONSUMABLES_VERSION;
  globalThis.add2eReserveSpellComponents = add2eReserveSpellComponents;
  globalThis.add2eRefundSpellComponents = add2eRefundSpellComponents;
  globalThis.add2eFinalizeSpellComponents = add2eFinalizeSpellComponents;
  globalThis.add2eGetSpellComponentStatus = add2eGetSpellComponentStatus;
  globalThis.add2ePrepareActorSheetConsumables = prepareActorSheetConsumables;
  patchActorSheetConsumablesData();
  installZeroQuantityComponentCleanup();
  installHudComponentBadges();
}

export function registerSockets() {
  if (globalThis.__ADD2E_CONSUMABLES_SOCKET_V1) return;
  globalThis.__ADD2E_CONSUMABLES_SOCKET_V1 = true;
  game.socket?.on?.("system.add2e", async data => {
    if (!game.user?.isGM || data?.type !== GM_OPERATION_TYPE) return;
    if (![GM_OPERATION_COMPONENT_RESERVE, GM_OPERATION_COMPONENT_REFUND, GM_OPERATION_COMPONENT_FINALIZE].includes(data.operation)) return;
    const payload = data.payload ?? {};
    if (data.operation === GM_OPERATION_COMPONENT_RESERVE) {
      const actor = game.actors?.get(payload.actorId);
      const sort = actor?.items?.get(payload.sortId) ?? { id: payload.sortId, name: payload.sortName, system: {}, flags: {} };
      let result = { ok: false, blocked: true, message: "Acteur introuvable pour les composants de sort." };
      try {
        if (actor) result = await reserveSpellComponentsLocal(actor, sort, payload.requirements);
      } catch (err) {
        console.warn("[ADD2E][CONSUMABLES][COMPONENTS][RESERVE][GM]", err);
        result = { ok: false, blocked: true, message: err?.message || "Erreur MJ pendant la réservation des composants." };
      }
      game.socket.emit("system.add2e", { type: SOCKET_COMPONENT_RESULT, requestId: payload.requestId, userId: payload.userId, result: serializableReservation(result) });
      return;
    }
    let ok = false;
    try {
      ok = data.operation === GM_OPERATION_COMPONENT_REFUND ? await refundSpellComponentsLocal(payload.reservation) : await finalizeSpellComponentsLocal(payload.reservation);
    } catch (err) {
      console.warn("[ADD2E][CONSUMABLES][COMPONENTS][TRANSACTION]", { operation: data.operation, err });
    }
    game.socket.emit("system.add2e", { type: SOCKET_COMPONENT_RESULT, requestId: payload.request_id ?? payload.requestId, userId: payload.userId, result: { ok } });
  });
}
