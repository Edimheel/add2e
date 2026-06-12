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
  slug
} from "./22a-vendor-core.mjs";

export const ADD2E_CONSUMABLES_VERSION = "2026-06-12-consumables-core-v6-remove-zero-components";
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

function itemTextFields(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [
    item?.name,
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
    flags.vendorKind,
    flags.kind,
    flags.slug,
    flags.componentSlug,
    ...asArray(system.tags),
    ...asArray(system.effectTags),
    ...asArray(flags.tags)
  ].map(lower).filter(Boolean);
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
  return false;
}

function isOnlyComponentCode(value) {
  const text = lower(value).replace(/[^a-z]/g, "");
  return ["v", "s", "m", "vs", "vm", "sm", "vsm", "verbal", "somatique", "materiel", "materielle", "material"].includes(text);
}

function cleanComponentName(value) {
  let text = String(value ?? "").trim();
  text = text.replace(/[.!?;:]+$/g, "").trim();
  text = text.replace(/^d['’]\s*/i, "");
  text = text.replace(/^(un|une)?\s*peu\s+de\s+/i, "");
  text = text.replace(/^(un|une|du|de la|de l['’]?|des|le|la|les)\s+/i, "");
  text = text.replace(/^(quelques|plusieurs)\s+/i, "");
  text = text.replace(/^petit morceau de\s+/i, "");
  text = text.replace(/^morceau de\s+/i, "");
  return text.trim();
}

function rawRequirementName(value) {
  if (typeof value === "object" && value) return value.name ?? value.nom ?? value.label ?? value.item ?? value.component ?? value.composant ?? value.slug ?? value.id;
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

function makeRequirement(rawName, rawQty = 1) {
  const name = cleanComponentName(rawName);
  if (!name || isOnlyComponentCode(name)) return null;
  const key = slug(name);
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
    const segments = value.split(/[,;|\n]+|\bet\b/gi).map(v => v.trim()).filter(Boolean);
    for (const segment of segments) {
      const alternatives = segment.split(/\bou\b/gi).map(v => v.trim()).filter(Boolean);
      if (alternatives.length > 1) addAlternativeRequirement(out, alternatives);
      else addRequirement(out, segment, 1);
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
  const text = [system.composantes, system.components, flags.composantes, flags.components].flatMap(asArray).map(lower).join(" ");
  return /(^|[^a-z])m([^a-z]|$)|materiel|matériel|material/.test(text);
}

function spellComponentRequirements(sort) {
  const system = sort?.system ?? {};
  const flags = sort?.flags?.add2e ?? {};
  const out = [];
  const fields = [
    system.composants_requis,
    system.composants_materiels,
    system.composants_materiels_objets,
    system.composantsMateriels,
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
    flags.composants_requis,
    flags.composants,
    flags.components,
    flags.requiredComponents
  ];
  for (const field of fields) collectRequirement(out, field);
  for (const tag of [...asArray(system.tags), ...asArray(system.effectTags), ...asArray(flags.tags)]) {
    const text = String(tag ?? "").trim();
    if (/^composant[:_]/i.test(text)) addRequirement(out, text.replace(/^composant[:_]/i, ""), 1);
  }
  return out;
}

function componentKeys(item) {
  return itemTextFields(item).map(v => slug(String(v ?? "").replace(/^(composant|component|spell_component)[:_]/i, ""))).filter(Boolean);
}

function findActorComponent(actor, requirement) {
  const items = Array.from(actor?.items ?? []).filter(isSpellComponentItem);
  return items.find(item => componentKeys(item).includes(requirement.key))
    ?? items.find(item => componentKeys(item).some(key => key && (key.includes(requirement.key) || requirement.key.includes(key))))
    ?? null;
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
  const carquois = objets.filter(isAmmunition).sort(sortByName);
  const sacoche = objets.filter(isSpellComponentItem).sort(sortByName);
  const divers = objets.filter(item => !isAmmunition(item) && !isSpellComponentItem(item)).sort(sortByName);
  data.listeCarquois = carquois;
  data.listeSacocheComposants = sacoche;
  data.listeObjetsDivers = divers;
  data.add2eConsumablesSummary = { carquoisCount: carquois.length, sacocheCount: sacoche.length, objetsDiversCount: divers.length, carquoisQuantity: carquois.reduce((sum, item) => sum + quantity(item), 0), sacocheQuantity: sacoche.reduce((sum, item) => sum + quantity(item), 0) };
  return data;
}

export function patchActorSheetConsumablesData() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto || proto.__add2eConsumablesSheetDataV2) return false;
  if (typeof proto.getData !== "function") return false;
  proto.__add2eConsumablesSheetDataV2 = true;
  const originalGetData = proto.getData;
  proto.getData = async function add2eConsumablesGetData(...args) { const data = await originalGetData.apply(this, args); return prepareActorSheetConsumables(data); };
  return true;
}

function serializableReservation(result) {
  return { ok: !!result?.ok, blocked: !!result?.blocked, skipped: !!result?.skipped, message: result?.message, missing: result?.missing, actorId: result?.actorId, sortId: result?.sortId, sortName: result?.sortName, consumed: (result?.consumed ?? []).map(entry => ({ itemId: entry.itemId, itemName: entry.itemName, before: entry.before, after: entry.after, quantity: entry.quantity, requirement: entry.requirement })) };
}

async function reserveSpellComponentsLocal(actor, sort, requirements = null) {
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
    await item.update(quantityUpdate(after), { add2eReason: "spell-component-reserved-gm" });
    consumed.push({ item, itemId: item.id, itemName: item.name, requirement: selectedRequirement, groupRequirement: found?.group, before, after, quantity: selectedRequirement.quantity });
  }
  for (const entry of consumed) if (entry.after <= 0 && actor.items?.has?.(entry.itemId)) await entry.item.delete({ add2eReason: "spell-component-zero-removed" });
  console.log("[ADD2E][CONSUMABLES][COMPONENTS][RESERVED][GM]", { actor: actor?.name, sort: sort?.name, consumed: consumed.map(c => ({ item: c.itemName, before: c.before, after: c.after })) });
  return { ok: true, blocked: false, actorId: actor?.id, sortId: sort?.id, sortName: sort?.name, consumed };
}

async function refundSpellComponentsLocal(reservation) {
  const actor = game.actors?.get(reservation?.actorId);
  const entries = reservation?.consumed ?? [];
  if (!actor || !entries.length) return false;
  for (const entry of entries) {
    const item = actor.items?.get(entry.itemId) ?? Array.from(actor.items ?? []).find(i => i.name === entry.itemName && isSpellComponentItem(i));
    if (item) await item.update(quantityUpdate(entry.before), { add2eReason: "spell-component-refund-gm" });
  }
  console.log("[ADD2E][CONSUMABLES][COMPONENTS][REFUND][GM]", { actor: actor?.name, sort: reservation?.sortName, count: entries.length });
  return true;
}

function requestGmComponentOperation(operation, payload) {
  return new Promise(resolve => {
    if (!game.socket) return resolve({ ok: false, blocked: true, message: "Socket Foundry indisponible." });
    const requestId = payload.requestId ?? foundry.utils.randomID();
    let done = false;
    const finish = result => { if (done) return; done = true; try { game.socket.off?.("system.add2e", handler); } catch (_e) {} resolve(result); };
    const handler = data => { if (data?.type !== SOCKET_COMPONENT_RESULT) return; if (data.requestId !== requestId || data.userId !== game.user?.id) return; finish(data.result ?? { ok: false, blocked: true, message: "Réponse MJ invalide." }); };
    game.socket.on?.("system.add2e", handler);
    window.setTimeout(() => finish({ ok: false, blocked: true, message: "Aucune réponse du MJ pour les composants de sort." }), 7000);
    game.socket.emit("system.add2e", { type: GM_OPERATION_TYPE, operation, payload: { ...payload, requestId, userId: game.user?.id } });
  });
}

export async function add2eReserveSpellComponents(actor, sort) {
  if (game.user?.isGM) return reserveSpellComponentsLocal(actor, sort);
  const requirements = spellComponentRequirements(sort);
  if (!requirements.length && !spellHasMaterialComponent(sort)) return { ok: true, skipped: true, consumed: [] };
  return requestGmComponentOperation(GM_OPERATION_COMPONENT_RESERVE, { actorId: actor?.id, sortId: sort?.id, sortName: sort?.name, requirements });
}

export async function add2eRefundSpellComponents(reservation) {
  if (!reservation?.consumed?.length) return false;
  if (game.user?.isGM) return refundSpellComponentsLocal(reservation);
  const result = await requestGmComponentOperation(GM_OPERATION_COMPONENT_REFUND, { reservation });
  return !!result?.ok;
}

export function registerGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.consumables = { add2eReserveSpellComponents, add2eRefundSpellComponents, prepareActorSheetConsumables };
  globalThis.ADD2E_CONSUMABLES = game.add2e.consumables;
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
    catch (err) { console.warn("[ADD2E][CONSUMABLES][COMPONENTS][REFUND][GM]", err); }
    game.socket.emit("system.add2e", { type: SOCKET_COMPONENT_RESULT, requestId: payload.requestId, userId: payload.userId, result: { ok } });
  });
}
