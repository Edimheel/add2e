// ADD2E — Composants de sort : résolution unique, réservation transactionnelle et affichage HUD.
// Les sorts acteur générés portent leur profil matériel canonique dans system.composants_materiels.
// Les Items requis sont résolus par flags.add2e.slug et leur consommation par system.consommable.

import {
  GM_OPERATION_TYPE,
  isAmmunition,
  isComponent as vendorIsComponent,
  quantity,
  quantityUpdate,
  num,
  slug,
  esc
} from "./22a-vendor-core.mjs";

export const ADD2E_CONSUMABLES_VERSION = "2026-08-10-consumables-core-v20-canonical-components";
export const SOCKET_COMPONENT_RESULT = "ADD2E_SPELL_COMPONENT_RESULT";
export const GM_OPERATION_COMPONENT_RESERVE = "vendorReserveSpellComponents";
export const GM_OPERATION_COMPONENT_REFUND = "vendorRefundSpellComponents";
export const GM_OPERATION_COMPONENT_FINALIZE = "vendorFinalizeSpellComponents";

const HUD_ID = "add2e-action-hud";
const componentRequests = new Map();
let hudComponentObserver = null;
let hudComponentFrame = null;
let hudComponentPatching = false;
let zeroQuantityCleanupInstalled = false;
let hudComponentBadgesInstalled = false;

function componentSettingEnabled() {
  try {
    if (!game?.settings?.settings?.has?.("add2e.gestionComposantsSorts")) return true;
    return !!game.settings.get("add2e", "gestionComposantsSorts");
  } catch (_err) {
    return true;
  }
}

function componentResourceEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!engine
    || typeof engine.consumeResources !== "function"
    || typeof engine.recoverResources !== "function") {
    throw new Error("Le domaine canonique ADD2E resource n’est pas disponible pour les composants de sort.");
  }
  return engine;
}

async function componentAlert(message, title = "Composant manquant") {
  const clean = String(message || "Composant matériel manquant.").trim();
  if (typeof globalThis.add2eDialogAlert !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  return globalThis.add2eDialogAlert({
    add2eTheme: "wizard",
    add2eClasses: ["add2e-consumable-alert"],
    window: { title },
    content: `<div class="add2e-dialog add2e-consumable-alert">
      <h3 style="margin:0 0 0.45rem 0;"><i class="fas fa-pouch"></i> ${esc(title)}</h3>
      <p style="margin:0;">${esc(clean)}</p>
    </div>`
  });
}

function isSpellComponentItem(item) {
  return !!item && vendorIsComponent(item) === true;
}

function canonicalActorItemKey(item) {
  return slug(item?.flags?.add2e?.slug);
}

function isReusableComponentItem(item) {
  return item?.system?.consommable === false;
}

function isOnlyComponentCode(value) {
  const text = slug(value).replace(/_/g, "");
  return ["v", "s", "m", "vs", "vm", "sm", "vsm", "verbal", "somatique", "materiel", "materielle", "material"].includes(text);
}

function canonicalRequirementName(value) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return String(value.nom ?? value.slug ?? "").trim();
}

function canonicalRequirementKey(value, name = canonicalRequirementName(value)) {
  if (value && typeof value === "object" && !Array.isArray(value) && value.slug) return slug(value.slug);
  return slug(name);
}

function canonicalRequirementQuantity(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 1;
  return Math.max(1, Math.floor(num(value.quantite, 1)));
}

function canonicalRequirementConsumes(value) {
  return !(value && typeof value === "object" && !Array.isArray(value) && value.consomme === false);
}

function makeRequirement(value) {
  const name = canonicalRequirementName(value);
  if (!name || isOnlyComponentCode(name)) return null;
  const key = canonicalRequirementKey(value, name);
  if (!key) return null;
  return {
    name,
    key,
    quantity: canonicalRequirementQuantity(value),
    consume: canonicalRequirementConsumes(value)
  };
}

function addRequirement(out, value) {
  const requirement = makeRequirement(value);
  if (!requirement) return;
  const existing = out.find(entry => entry.key === requirement.key && entry.consume === requirement.consume && !entry.alternatives);
  if (existing) existing.quantity += requirement.quantity;
  else out.push(requirement);
}

function addAlternativeRequirement(out, alternatives) {
  const clean = [];
  for (const alternative of alternatives) {
    const requirement = makeRequirement(alternative);
    if (requirement && !clean.some(entry => entry.key === requirement.key && entry.consume === requirement.consume)) clean.push(requirement);
  }
  if (!clean.length) return;
  if (clean.length === 1) return addRequirement(out, clean[0]);
  out.push({
    name: clean.map(entry => entry.name).join(" ou "),
    key: clean.map(entry => entry.key).join("__or__"),
    quantity: 1,
    consume: clean.some(entry => entry.consume !== false),
    alternatives: clean
  });
}

function collectRequirement(out, value) {
  if (value === null || value === undefined || value === "") return;

  if (Array.isArray(value)) {
    for (const entry of value) collectRequirement(out, entry);
    return;
  }

  if (typeof value === "string") {
    for (const rawPart of value.split(/[,;|\n]+/g).map(part => part.trim()).filter(Boolean)) {
      const alternatives = rawPart.split(/\bou\b/gi).map(entry => entry.trim()).filter(Boolean);
      if (alternatives.length > 1) addAlternativeRequirement(out, alternatives);
      else addRequirement(out, rawPart);
    }
    return;
  }

  if (typeof value === "object") {
    if (Array.isArray(value.alternatives) && value.alternatives.length) {
      addAlternativeRequirement(out, value.alternatives);
      return;
    }
    addRequirement(out, value);
  }
}

function spellHasMaterialComponent(sort) {
  const raw = sort?.system?.composantes;
  const values = Array.isArray(raw) ? raw : String(raw ?? "").split(/[,;|/\s]+/g);
  return values.some(value => String(value ?? "").trim().toUpperCase() === "M");
}

function spellComponentRequirements(sort) {
  const out = [];
  collectRequirement(out, sort?.system?.composants_materiels);
  return out;
}

function matchingActorComponents(actor, requirement) {
  const requiredKey = String(requirement?.key ?? "").trim();
  if (!requiredKey) return [];
  return [...(actor?.items ?? [])].filter(item => canonicalActorItemKey(item) === requiredKey);
}

function findActorComponent(actor, requirement) {
  const matches = matchingActorComponents(actor, requirement);
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
    const consume = selectedRequirement.consume !== false && !isReusableComponentItem(found?.item);
    return {
      name: requirement.name,
      key: requirement.key,
      quantity: requirement.quantity,
      alternatives: requirement.alternatives ?? null,
      consume,
      available: !!found,
      itemId: found?.item?.id ?? null,
      itemName: found?.item?.name ?? null,
      selectedName: selectedRequirement.name,
      selectedQuantity: selectedRequirement.quantity
    };
  });
}

function sortByName(a, b) { return String(a?.name ?? "").localeCompare(String(b?.name ?? "")); }

function sortComponentsForActor(items) {
  return items.sort((a, b) => {
    const aReusable = isReusableComponentItem(a);
    const bReusable = isReusableComponentItem(b);
    return aReusable === bReusable ? sortByName(a, b) : aReusable ? 1 : -1;
  });
}

export function prepareActorSheetConsumables(data) {
  const items = [...(data?.actor?.items ?? [])];
  const objects = Array.isArray(data?.listeObjets) && data.listeObjets.length ? data.listeObjets : items.filter(item => item.type === "objet");
  const carquois = objects.filter(item => isAmmunition(item) && quantity(item) > 0).sort(sortByName);
  const sacoche = sortComponentsForActor(objects.filter(item => isSpellComponentItem(item) && quantity(item) > 0));
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
    const ids = [...(actor.items ?? [])]
      .filter(item => String(item?.type ?? "").toLowerCase() === "objet")
      .filter(isSpellComponentItem)
      .filter(item => !isReusableComponentItem(item) && quantity(item) <= 0)
      .map(item => item.id)
      .filter(Boolean);
    if (!ids.length) continue;
    await actor.deleteEmbeddedDocuments("Item", [...new Set(ids)], { add2eReason: "spell-component-zero-ready-cleanup" });
    deleted += ids.length;
  }
  return deleted;
}

function installZeroQuantityComponentCleanup() {
  if (zeroQuantityCleanupInstalled) return false;
  zeroQuantityCleanupInstalled = true;
  Hooks.once("ready", () => window.setTimeout(() => {
    cleanupExistingZeroQuantityComponents().catch(err => console.warn("[ADD2E][CONSUMABLES][ZERO_READY_CLEANUP_FAILED]", err));
  }, 750));
  return true;
}

function projectedComponentQuantity(projected, item) {
  if (!item?.id) return 0;
  return projected.has(item.id) ? projected.get(item.id) : quantity(item);
}

function findProjectedComponentForRequirement(actor, requirement, projected) {
  const candidates = requirement?.alternatives?.length ? requirement.alternatives : [requirement];
  for (const candidate of candidates) {
    const required = Math.max(1, Math.floor(Number(candidate?.quantity ?? 1) || 1));
    const item = matchingActorComponents(actor, candidate)
      .find(component => projectedComponentQuantity(projected, component) >= required) ?? null;
    if (item) return { item, requirement: candidate, group: requirement?.alternatives?.length ? requirement : null };
  }
  return null;
}

function buildSpellComponentConsumptionPlan(actor, sort, requirements = null) {
  if (String(actor?.type ?? "").toLowerCase() === "pnj") return { ok: true, blocked: false, skipped: true, allocations: [] };
  if (!componentSettingEnabled()) return { ok: true, skipped: true, allocations: [] };
  const requirementsToReserve = Array.isArray(requirements) && requirements.length ? requirements : spellComponentRequirements(sort);
  if (!requirementsToReserve.length) {
    if (!spellHasMaterialComponent(sort)) return { ok: true, skipped: true, allocations: [] };
    return {
      ok: false,
      blocked: true,
      allocations: [],
      message: `${sort?.name ?? "Ce sort"} requiert une composante matérielle, mais aucun composant précis n'est déclaré dans system.composants_materiels.`
    };
  }

  const projected = new Map();
  const allocations = new Map();
  for (const requirement of requirementsToReserve) {
    const found = findProjectedComponentForRequirement(actor, requirement, projected);
    if (!found?.item) {
      return {
        ok: false,
        blocked: true,
        allocations: [],
        missing: requirement,
        message: `${actor?.name ?? "Le lanceur"} n'a pas le composant requis : ${requirement.name} (${requirement.quantity}).`
      };
    }
    const selectedRequirement = found.requirement;
    if (selectedRequirement.consume === false || isReusableComponentItem(found.item)) continue;

    const required = Math.max(1, Math.floor(Number(selectedRequirement.quantity ?? 1) || 1));
    const item = found.item;
    const current = projectedComponentQuantity(projected, item);
    projected.set(item.id, current - required);

    const allocation = allocations.get(item.id) ?? {
      item,
      itemId: item.id,
      itemName: item.name,
      before: quantity(item),
      quantity: 0,
      requirements: []
    };
    allocation.quantity += required;
    allocation.after = allocation.before - allocation.quantity;
    allocation.requirements.push({ requirement: selectedRequirement, groupRequirement: found.group ?? null });
    allocations.set(item.id, allocation);
  }

  return { ok: true, blocked: false, skipped: false, allocations: [...allocations.values()] };
}

function componentResourceDescriptor(actor, allocation, mode = "consume") {
  const item = allocation?.item ?? actor?.items?.get?.(allocation?.itemId) ?? null;
  if (!item) throw new Error("Composant de sort introuvable pour la transaction resource.");
  const refund = mode === "recover";
  return {
    id: `${item.uuid ?? item.id}:spell-component`,
    type: "spell-component",
    label: item.name,
    document: item,
    actor,
    item,
    target: String(item.id ?? "component"),
    get current() { return quantity(item); },
    maximum: refund ? Math.max(0, Number(allocation.before) || 0) : null,
    cost: refund ? 0 : Math.max(0, Number(allocation.quantity) || 0),
    recovery: refund ? Math.max(0, Number(allocation.quantity) || 0) : 0,
    source: {
      kind: "spell-component",
      id: String(item.id ?? ""),
      uuid: String(item.uuid ?? ""),
      name: String(item.name ?? "Composant")
    },
    context: {
      actorId: String(actor?.id ?? ""),
      itemId: String(item.id ?? ""),
      consumer: refund ? "22e-consumables-core:refund" : "22e-consumables-core:reserve"
    },
    write: next => item.update(quantityUpdate(next), {
      add2eReason: refund ? "spell-component-refund-resource" : "spell-component-reserve-resource",
      render: false
    })
  };
}

async function reserveSpellComponentsLocal(actor, sort, requirements = null) {
  const plan = buildSpellComponentConsumptionPlan(actor, sort, requirements);
  if (!plan.ok || plan.skipped) {
    return {
      ...plan,
      consumed: [],
      actorId: actor?.id,
      sortId: sort?.id,
      sortName: sort?.name
    };
  }
  if (!plan.allocations.length) {
    return { ok: true, blocked: false, actorId: actor?.id, sortId: sort?.id, sortName: sort?.name, consumed: [] };
  }

  const descriptors = plan.allocations.map(allocation => componentResourceDescriptor(actor, allocation, "consume"));
  const transaction = await componentResourceEngine().consumeResources(descriptors, {
    reason: "spell-component-reserve",
    consumer: "22e-consumables-core"
  });
  if (!transaction.ok) {
    const unavailable = transaction.resources?.[0] ?? null;
    return {
      ok: false,
      blocked: true,
      consumed: [],
      actorId: actor?.id,
      sortId: sort?.id,
      sortName: sort?.name,
      message: unavailable
        ? `${actor?.name ?? "Le lanceur"} n'a plus assez de ${unavailable.label} (${unavailable.current}/${unavailable.cost}).`
        : "Les composants matériels nécessaires ne sont plus disponibles."
    };
  }

  const allocationsByItem = new Map(plan.allocations.map(allocation => [String(allocation.itemId), allocation]));
  const consumed = (transaction.resources ?? []).map(state => {
    const allocation = allocationsByItem.get(String(state.item?.id ?? state.target ?? ""));
    const first = allocation?.requirements?.[0] ?? {};
    return {
      itemId: allocation?.itemId ?? state.item?.id ?? null,
      itemName: allocation?.itemName ?? state.label,
      requirement: first.requirement ?? null,
      groupRequirement: first.groupRequirement ?? null,
      before: state.before,
      after: state.after,
      quantity: Math.max(0, Number(allocation?.quantity ?? state.cost) || 0),
      deleted: false
    };
  });
  return { ok: true, blocked: false, actorId: actor?.id, sortId: sort?.id, sortName: sort?.name, consumed };
}

async function refundSpellComponentsLocal(reservation) {
  const actor = game.actors?.get(reservation?.actorId);
  if (!actor) return false;
  const allocations = [];
  for (const entry of reservation?.consumed ?? []) {
    const item = actor.items?.get(entry.itemId);
    if (!item) return false;
    allocations.push({
      item,
      itemId: item.id,
      itemName: item.name,
      before: Math.max(0, Number(entry.before) || 0),
      after: Math.max(0, Number(entry.after) || 0),
      quantity: Math.max(0, Number(entry.quantity) || 0)
    });
  }
  if (!allocations.length) return true;
  const result = await componentResourceEngine().recoverResources(
    allocations.map(allocation => componentResourceDescriptor(actor, allocation, "recover")),
    { reason: "spell-component-refund", consumer: "22e-consumables-core" }
  );
  return result.ok === true;
}

function finishComponentRequest(requestId, result) {
  const pending = componentRequests.get(requestId);
  if (!pending) return false;
  componentRequests.delete(requestId);
  window.clearTimeout(pending.timeout);
  pending.resolve(result);
  return true;
}

function requestGmComponentOperation(operation, payload) {
  return new Promise(resolve => {
    if (!game.socket) return resolve({ ok: false, blocked: true, message: "Socket Foundry indisponible." });
    const requestId = payload.requestId ?? foundry.utils.randomID();
    const timeout = window.setTimeout(() => {
      finishComponentRequest(requestId, { ok: false, blocked: true, message: "Aucune réponse du MJ pour les composants de sort." });
    }, 7000);
    componentRequests.set(requestId, { resolve, timeout });
    game.socket.emit("system.add2e", {
      type: GM_OPERATION_TYPE,
      operation,
      payload: { ...payload, requestId, userId: game.user?.id }
    });
  });
}

export function handleSpellComponentResult(data = {}) {
  if (data?.type !== SOCKET_COMPONENT_RESULT || data.userId !== game.user?.id || !data.requestId) return false;
  return finishComponentRequest(data.requestId, data.result ?? { ok: false, blocked: true, message: "Réponse MJ invalide." });
}

function emitComponentResult(payload, result) {
  game.socket?.emit?.("system.add2e", {
    type: SOCKET_COMPONENT_RESULT,
    requestId: payload?.requestId,
    userId: payload?.userId,
    result
  });
}

export async function handleReserveSpellComponentsOperation(payload = {}) {
  const actor = game.actors?.get(payload.actorId);
  const sort = actor?.items?.get(payload.sortId) ?? { id: payload.sortId, name: payload.sortName, system: {}, flags: {} };
  let result = { ok: false, blocked: true, message: "Acteur introuvable pour les composants de sort." };
  try {
    if (actor) result = await reserveSpellComponentsLocal(actor, sort, payload.requirements);
  } catch (error) {
    console.warn("[ADD2E][CONSUMABLES][COMPONENTS][RESERVE][GM]", error);
    result = { ok: false, blocked: true, message: error?.message || "Erreur MJ pendant la réservation des composants." };
  }
  const serialized = serializableReservation(result);
  emitComponentResult(payload, serialized);
  return serialized;
}

export async function handleRefundSpellComponentsOperation(payload = {}) {
  let ok = false;
  try {
    ok = await refundSpellComponentsLocal(payload.reservation);
  } catch (error) {
    console.warn("[ADD2E][CONSUMABLES][COMPONENTS][REFUND][GM]", error);
  }
  const result = { ok };
  emitComponentResult(payload, result);
  return result;
}

export async function handleFinalizeSpellComponentsOperation(payload = {}) {
  let ok = false;
  try {
    ok = await finalizeSpellComponentsLocal(payload.reservation);
  } catch (error) {
    console.warn("[ADD2E][CONSUMABLES][COMPONENTS][FINALIZE][GM]", error);
  }
  const result = { ok };
  emitComponentResult(payload, result);
  return result;
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
  if (hudComponentBadgesInstalled) return false;
  hudComponentBadgesInstalled = true;
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
