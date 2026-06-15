// ADD2E — Consommables : composants de sort via relais MJ.
// Ce module expose l'API attendue par 06-cast-spell.mjs et prépare l'affichage sacoche/carquoi.

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

export const ADD2E_CONSUMABLES_VERSION = "2026-06-15-consumables-core-v11-delete-empty-components";
export const SOCKET_COMPONENT_RESULT = "ADD2E_SPELL_COMPONENT_RESULT";
export const GM_OPERATION_COMPONENT_RESERVE = "vendorReserveSpellComponents";
export const GM_OPERATION_COMPONENT_REFUND = "vendorRefundSpellComponents";

const asArray = value => Array.isArray(value)
  ? value
  : value === null || value === undefined || value === ""
    ? []
    : typeof value === "string"
      ? value.split(/[,;|\n]+|\bet\b/gi).map(v => v.trim()).filter(Boolean)
      : [value];

function deepClone(value) {
  try { return foundry.utils.deepClone(value); }
  catch (_err) {
    try { return foundry.utils.duplicate(value); }
    catch (_e) { return JSON.parse(JSON.stringify(value ?? null)); }
  }
}

function itemDataForRefund(item) {
  if (!item) return null;
  const data = typeof item.toObject === "function" ? item.toObject() : deepClone(item);
  if (!data || typeof data !== "object") return null;
  delete data._id;
  delete data._stats;
  return data;
}

function withQuantityOnItemData(itemData, value) {
  const data = deepClone(itemData);
  data.system ??= {};
  data.system.quantite = Math.max(0, Math.floor(num(value, 0)));
  return data;
}

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
    item?.name,
    system.nom,
    system.categorie,
    system.category,
    system.sousType,
    system.sous_type,
    system.type,
    system.subtype,
    system.kind,
    system.slot,
    system.slug,
    system.composant,
    system.component,
    system.composantSlug,
    system.componentSlug,
    flags.vendorKind,
    flags.kind,
    flags.slug,
    flags.componentSlug,
    ...toFieldArray(system.tags),
    ...toFieldArray(system.effectTags),
    ...toFieldArray(system.effecttags),
    ...toFieldArray(flags.tags),
    ...toFieldArray(flags.effectTags),
    ...toFieldArray(flags.effecttags)
  ].map(lower).filter(Boolean);
}

function isKnownLooseComponentName(value) {
  const key = slug(value);
  if (!key) return false;
  const exact = new Set([
    "eau_benite", "eau_maudite", "eau_benite_ou_maudite", "eau_benite_maudite",
    "symbole_sacre", "gui", "encens", "poudre_d_argent", "poudre_d_or", "poudre_de_fer",
    "sable", "soufre", "phosphore", "ambre", "perle", "miroir"
  ]);
  if (exact.has(key)) return true;
  return /(^|_)(eau_benite|eau_maudite|symbole_sacre|encens|gui|soufre|phosphore|poudre_d_argent|poudre_d_or|poudre_de_fer)(_|$)/.test(key);
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

function isOnlyComponentCode(value) {
  const text = lower(value).replace(/[^a-z]/g, "");
  return ["v", "s", "m", "vs", "vm", "sm", "vsm", "verbal", "somatique", "materiel", "materielle", "material"].includes(text);
}

function cleanComponentName(value) {
  let text = String(value ?? "").trim();
  text = text.replace(/[()\[\]{}]/g, " ").replace(/\s+/g, " ").trim();
  text = text.replace(/[.!?;:]+$/g, "").trim();
  text = text.replace(/^d['’]\s*/i, "");
  text = text.replace(/^(un|une)?\s*peu\s+de\s+/i, "");
  text = text.replace(/^(un|une|du|de la|de l['’]?|des|le|la|les)\s+/i, "");
  text = text.replace(/^(quelques|plusieurs)\s+/i, "");
  text = text.replace(/^petit morceau de\s+/i, "");
  text = text.replace(/^morceau de\s+/i, "");
  text = text.replace(/^poignee de\s+/i, "");
  text = text.replace(/^poignée de\s+/i, "");
  return text.trim();
}

function rawRequirementName(value) {
  if (typeof value === "object" && value) return value.name ?? value.nom ?? value.label ?? value.item ?? value.itemName ?? value.component ?? value.composant ?? value.slug ?? value.id;
  return value;
}

function rawRequirementQuantity(value) {
  if (typeof value === "object" && value) return value.quantity ?? value.quantite ?? value.qty ?? value.nombre ?? value.count ?? value.value ?? 1;
  return 1;
}

function isStructuredAlternative(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const condition = lower(value.condition ?? value.conditions ?? value.note ?? value.notes ?? value.sourceCondition ?? "");
  if (condition.includes("alternative")) return true;
  if (/\bou\b/i.test(condition)) return true;
  const consommation = lower(value.consommation ?? value.consumption ?? value.consume ?? "");
  return consommation.includes("optionnel") && condition.length > 0;
}

function requirementKey(rawName) {
  const key = slug(cleanComponentName(rawName));
  if (key === "eau_benite_ou_maudite" || key === "eau_benite_maudite") return "eau_benite";
  return key;
}

function makeRequirement(rawName, rawQty = 1) {
  const name = cleanComponentName(rawName);
  if (!name || isOnlyComponentCode(name)) return null;
  const key = requirementKey(name);
  if (!key) return null;
  const qty = Math.max(1, Math.floor(num(rawQty, 1)));
  return { name, key, quantity: qty };
}

function addRequirement(out, rawName, rawQty = 1) {
  const req = makeRequirement(rawName, rawQty);
  if (!req) return;
  const existing = out.find(r => r.key === req.key && !r.alternatives);
  if (existing) existing.quantity += req.quantity;
  else out.push(req);
}

function addAlternativeRequirement(out, alternatives) {
  const clean = [];
  for (const alt of alternatives) {
    const req = makeRequirement(rawRequirementName(alt), rawRequirementQuantity(alt));
    if (!req) continue;
    if (!clean.some(r => r.key === req.key)) clean.push(req);
  }
  if (!clean.length) return;
  if (clean.length === 1) {
    addRequirement(out, clean[0].name, clean[0].quantity);
    return;
  }
  out.push({ name: clean.map(r => r.name).join(" ou "), key: clean.map(r => r.key).join("__or__"), quantity: 1, alternatives: clean });
}

function collectRequirement(out, value) {
  if (value === null || value === undefined || value === "") return;
  if (Array.isArray(value)) {
    const alternatives = value.filter(isStructuredAlternative);
    const alternativeKeys = new Set(alternatives.map(entry => `${rawRequirementName(entry)}|${rawRequirementQuantity(entry)}`));
    if (alternatives.length > 1) addAlternativeRequirement(out, alternatives);
    for (const entry of value) {
      const key = `${rawRequirementName(entry)}|${rawRequirementQuantity(entry)}`;
      if (alternatives.length > 1 && alternativeKeys.has(key)) continue;
      collectRequirement(out, entry);
    }
    return;
  }
  if (typeof value === "string") {
    for (const rawPart of asArray(value)) {
      const part = String(rawPart ?? "").replace(/[()\[\]{}]/g, " ").replace(/\s+/g, " ").trim();
      const alternatives = part.split(/\bou\b/gi).map(v => v.trim()).filter(Boolean);
      if (alternatives.length > 1) addAlternativeRequirement(out, alternatives);
      else addRequirement(out, part, 1);
    }
    return;
  }
  if (typeof value === "object") {
    const alternatives = value.alternatives ?? value.options ?? value.choix ?? value.auChoix ?? value.or;
    if (Array.isArray(alternatives) && alternatives.length) {
      addAlternativeRequirement(out, alternatives);
      return;
    }
    const name = rawRequirementName(value);
    const qty = rawRequirementQuantity(value);
    if (name) addRequirement(out, name, qty);
  }
}

function spellHasMaterialComponent(sort) {
  const system = sort?.system ?? {};
  const flags = sort?.flags?.add2e ?? {};
  const text = [system.composantes, system.components, system.componentes, flags.composantes, flags.components, flags.componentes]
    .flatMap(toFieldArray).map(lower).join(" ");
  return /(^|[^a-z])m([^a-z]|$)|materiel|matériel|material/.test(text);
}

function collectFields(out, fields) {
  for (const field of fields.filter(v => v !== undefined && v !== null && v !== "")) collectRequirement(out, field);
}

function spellComponentRequirements(sort) {
  const system = sort?.system ?? {};
  const flags = sort?.flags?.add2e ?? {};
  const out = [];
  const primaryFields = [system.composants_materiels, system.composantsMateriels, sort?.composants_materiels];
  const fallbackFields = [
    system.composants_requis,
    system.composantsMateriel,
    system.composant_materiel,
    system.composantMateriel,
    system.materiel,
    system.matériel,
    system.material,
    system.materialComponent,
    system.materialComponents,
    system.material_components,
    system.requiredComponents,
    system.componentsRequired,
    system.components?.material,
    system.components?.materials,
    system.components?.materialComponent,
    system.components?.materialComponents,
    system.composants_materiels_objets,
    sort?.materialComponents,
    sort?.composants_requis,
    sort?.composants_materiels_objets,
    flags.composants_requis,
    flags.composants,
    flags.components,
    flags.requiredComponents,
    flags.effectTags,
    flags.effecttags
  ];

  collectFields(out, primaryFields);
  if (!out.length) collectFields(out, fallbackFields);

  for (const tag of [...toFieldArray(system.tags), ...toFieldArray(system.effectTags), ...toFieldArray(system.effecttags), ...toFieldArray(flags.tags), ...toFieldArray(flags.effectTags), ...toFieldArray(flags.effecttags)]) {
    const text = String(tag ?? "").trim();
    if (/^composant[:_]/i.test(text)) addRequirement(out, text.replace(/^composant[:_]/i, ""), 1);
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
  if (base === "eau_benite") keys.add("eau_benite_ou_maudite");
  if (base === "eau_maudite") keys.add("eau_benite_ou_maudite");
  return Array.from(keys).filter(Boolean);
}

function componentKeys(item) {
  const keys = new Set();
  for (const field of itemTextFields(item)) for (const key of componentKeyVariants(field)) keys.add(key);
  return Array.from(keys).filter(Boolean);
}

function requirementKeys(requirement) {
  return componentKeyVariants(requirement?.key ?? requirement?.name);
}

function compatibleComponentKey(itemKey, requirementKey) {
  if (!itemKey || !requirementKey) return false;
  if (itemKey === requirementKey) return true;
  if (itemKey.includes(requirementKey) || requirementKey.includes(itemKey)) return true;
  if ((requirementKey === "eau_benite" || requirementKey === "eau_maudite") && (itemKey === "eau_benite_ou_maudite" || itemKey === "eau_benite_maudite")) return true;
  return false;
}

function findActorComponent(actor, requirement) {
  const items = Array.from(actor?.items ?? []).filter(isSpellComponentItem);
  const reqKeys = requirementKeys(requirement);
  const matches = items.filter(item => {
    const keys = componentKeys(item);
    return reqKeys.some(reqKey => keys.some(itemKey => compatibleComponentKey(itemKey, reqKey)));
  });
  return matches.find(item => quantity(item) >= Number(requirement?.quantity ?? 1)) ?? matches[0] ?? null;
}

function findActorComponentForRequirement(actor, requirement) {
  if (!requirement?.alternatives?.length) {
    const item = findActorComponent(actor, requirement);
    return item ? { item, requirement } : null;
  }
  for (const alternative of requirement.alternatives) {
    const item = findActorComponent(actor, alternative);
    if (item && quantity(item) >= alternative.quantity) return { item, requirement: alternative, group: requirement };
  }
  return null;
}

function sortByName(a, b) {
  return String(a?.name ?? "").localeCompare(String(b?.name ?? ""));
}

export function prepareActorSheetConsumables(data) {
  const items = Array.from(data?.actor?.items ?? []);
  const objets = Array.isArray(data?.listeObjets) && data.listeObjets.length ? data.listeObjets : items.filter(item => item.type === "objet");
  const carquois = objets.filter(item => isAmmunition(item) && quantity(item) > 0).sort(sortByName);
  const sacoche = objets.filter(item => isSpellComponentItem(item) && quantity(item) > 0).sort(sortByName);
  const divers = objets.filter(item => !isAmmunition(item) && !isSpellComponentItem(item)).sort(sortByName);
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
  if (!proto || proto.__add2eConsumablesSheetDataV2) return false;
  if (typeof proto.getData !== "function") return false;
  proto.__add2eConsumablesSheetDataV2 = true;
  const originalGetData = proto.getData;
  proto.getData = async function add2eConsumablesGetData(...args) {
    const data = await originalGetData.apply(this, args);
    return prepareActorSheetConsumables(data);
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
      itemId: entry.itemId,
      itemName: entry.itemName,
      itemData: entry.itemData,
      before: entry.before,
      after: entry.after,
      quantity: entry.quantity,
      requirement: entry.requirement,
      groupRequirement: entry.groupRequirement,
      deleted: entry.deleted === true
    }))
  };
}

async function deleteDepletedConsumedItems(actor, consumed) {
  const ids = consumed
    .filter(entry => entry.after <= 0 && entry.itemId && actor?.items?.get?.(entry.itemId))
    .map(entry => entry.itemId);
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return 0;
  await actor.deleteEmbeddedDocuments("Item", uniqueIds, { add2eReason: "spell-component-depleted-delete" });
  for (const entry of consumed) if (uniqueIds.includes(entry.itemId)) entry.deleted = true;
  return uniqueIds.length;
}

async function reserveSpellComponentsLocal(actor, sort, requirements = null) {
  if (!componentSettingEnabled()) return { ok: true, skipped: true, consumed: [] };
  const reqs = Array.isArray(requirements) && requirements.length ? requirements : spellComponentRequirements(sort);
  if (!reqs.length) {
    if (!spellHasMaterialComponent(sort)) return { ok: true, skipped: true, consumed: [] };
    return { ok: false, blocked: true, consumed: [], message: `${sort?.name ?? "Ce sort"} requiert une composante matérielle, mais aucun composant précis n'est déclaré sur le sort.` };
  }
  const consumed = [];
  for (const requirement of reqs) {
    const found = findActorComponentForRequirement(actor, requirement);
    const item = found?.item ?? null;
    const selectedRequirement = found?.requirement ?? requirement;
    const before = quantity(item);
    if (!item || before < selectedRequirement.quantity) {
      for (const entry of consumed.reverse()) await entry.item.update(quantityUpdate(entry.before), { add2eReason: "spell-component-reserve-rollback" });
      return { ok: false, blocked: true, consumed: [], missing: requirement, message: `${actor?.name ?? "Le lanceur"} n'a pas le composant requis : ${requirement.name} (${requirement.quantity}).` };
    }
    const after = before - selectedRequirement.quantity;
    const itemData = itemDataForRefund(item);
    await item.update(quantityUpdate(after), { add2eReason: "spell-component-reserved-gm" });
    consumed.push({ item, itemId: item.id, itemName: item.name, itemData, requirement: selectedRequirement, groupRequirement: found?.group, before, after, quantity: selectedRequirement.quantity, deleted: false });
  }
  await deleteDepletedConsumedItems(actor, consumed);
  return { ok: true, blocked: false, actorId: actor?.id, sortId: sort?.id, sortName: sort?.name, consumed };
}

async function refundSpellComponentsLocal(reservation) {
  const actor = game.actors?.get(reservation?.actorId);
  const entries = reservation?.consumed ?? [];
  if (!actor || !entries.length) return false;
  for (const entry of entries) {
    const item = actor.items?.get(entry.itemId) ?? Array.from(actor.items ?? []).find(i => i.name === entry.itemName && isSpellComponentItem(i));
    if (item) {
      await item.update(quantityUpdate(entry.before), { add2eReason: "spell-component-refund-gm" });
      continue;
    }
    if (entry.itemData) {
      await actor.createEmbeddedDocuments("Item", [withQuantityOnItemData(entry.itemData, entry.before)], { add2eReason: "spell-component-refund-recreate-gm" });
    }
  }
  return true;
}

function requestGmComponentOperation(operation, payload) {
  return new Promise(resolve => {
    if (!game.socket) return resolve({ ok: false, blocked: true, message: "Socket Foundry indisponible." });
    const requestId = payload.requestId ?? foundry.utils.randomID();
    let done = false;
    const finish = result => { if (done) return; done = true; try { game.socket.off?.("system.add2e", handler); } catch (_e) {} resolve(result); };
    const handler = data => {
      if (data?.type !== SOCKET_COMPONENT_RESULT) return;
      if (data.requestId !== requestId || data.userId !== game.user?.id) return;
      finish(data.result ?? { ok: false, blocked: true, message: "Réponse MJ invalide." });
    };
    game.socket.on?.("system.add2e", handler);
    window.setTimeout(() => finish({ ok: false, blocked: true, message: "Aucune réponse du MJ pour les composants de sort." }), 7000);
    game.socket.emit("system.add2e", { type: GM_OPERATION_TYPE, operation, payload: { ...payload, requestId, userId: game.user?.id } });
  });
}

export async function add2eReserveSpellComponents(actor, sort) {
  if (!componentSettingEnabled()) return { ok: true, skipped: true, consumed: [] };
  const result = game.user?.isGM
    ? await reserveSpellComponentsLocal(actor, sort)
    : await requestGmComponentOperation(GM_OPERATION_COMPONENT_RESERVE, {
      actorId: actor?.id,
      sortId: sort?.id,
      sortName: sort?.name,
      requirements: spellComponentRequirements(sort)
    });
  if (result?.blocked) await componentAlert(result.message || "Composant matériel manquant.");
  return result;
}

export async function add2eRefundSpellComponents(reservation) {
  if (!reservation?.consumed?.length) return false;
  if (game.user?.isGM) return refundSpellComponentsLocal(reservation);
  const result = await requestGmComponentOperation(GM_OPERATION_COMPONENT_REFUND, { reservation });
  return !!result?.ok;
}

export function registerGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.consumables = { ...(game.add2e.consumables ?? {}), add2eReserveSpellComponents, add2eRefundSpellComponents, prepareActorSheetConsumables };
  globalThis.ADD2E_CONSUMABLES = { ...(globalThis.ADD2E_CONSUMABLES ?? {}), ...game.add2e.consumables };
  globalThis.ADD2E_CONSUMABLES_VERSION = ADD2E_CONSUMABLES_VERSION;
  globalThis.add2eReserveSpellComponents = add2eReserveSpellComponents;
  globalThis.add2eRefundSpellComponents = add2eRefundSpellComponents;
  globalThis.add2ePrepareActorSheetConsumables = prepareActorSheetConsumables;
  patchActorSheetConsumablesData();
}

export function registerSockets() {
  if (globalThis.__ADD2E_CONSUMABLES_SOCKET_V1) return;
  globalThis.__ADD2E_CONSUMABLES_SOCKET_V1 = true;
  game.socket?.on?.("system.add2e", async data => {
    if (!game.user?.isGM) return;
    if (data?.type !== GM_OPERATION_TYPE) return;
    if (![GM_OPERATION_COMPONENT_RESERVE, GM_OPERATION_COMPONENT_REFUND].includes(data.operation)) return;
    const payload = data.payload ?? {};
    if (data.operation === GM_OPERATION_COMPONENT_RESERVE) {
      const actor = game.actors?.get(payload.actorId);
      const sort = actor?.items?.get(payload.sortId) ?? { id: payload.sortId, name: payload.sortName, system: {}, flags: {} };
      let result = { ok: false, blocked: true, message: "Acteur introuvable pour les composants de sort." };
      try { if (actor) result = await reserveSpellComponentsLocal(actor, sort, payload.requirements); }
      catch (err) { console.warn("[ADD2E][CONSUMABLES][COMPONENTS][RESERVE][GM]", err); result = { ok: false, blocked: true, message: err?.message || "Erreur MJ pendant la réservation des composants." }; }
      game.socket.emit("system.add2e", { type: SOCKET_COMPONENT_RESULT, requestId: payload.requestId, userId: payload.userId, result: serializableReservation(result) });
      return;
    }
    let ok = false;
    try { ok = await refundSpellComponentsLocal(payload.reservation); }
    catch (err) { console.warn("[ADD2E][CONSUMABLES][COMPONENTS][REFUND]", err); }
    game.socket.emit("system.add2e", { type: SOCKET_COMPONENT_RESULT, requestId: payload.requestId, userId: payload.userId, result: { ok } });
  });
}
