// ADD2E — Vendeur système : point d'entrée.
// Les boutiques sont découpées pour séparer la logique métier des interfaces ApplicationV2.

import {
  ADD2E_VENDOR_VERSION,
  VENDOR_SETTING,
  ensureVendorOnLaunch,
  registerRecoveryHooks,
  patchActorSheetMoney,
  patchAttackRollProjectileConsumption,
  registerGlobals,
  isVendorActor,
  isComponent,
  quantity,
  quantityUpdate,
  num,
  lower,
  slug
} from "./22a-vendor-core.mjs";

import {
  bindAllVendorTokens,
  patchVendorTokenClick,
  registerUiGlobals,
  registerVendorDirectoryButton
} from "./22b-vendor-app.mjs";

import {
  ADD2E_ARMORER_VERSION,
  ARMORER_SETTING,
  ensureArmorerOnLaunch,
  registerGlobals as registerArmorerGlobals,
  registerSockets as registerArmorerSockets,
  isArmorerActor
} from "./22c-armorer-core.mjs";

import {
  bindAllArmorerTokens,
  patchArmorerTokenClick,
  registerArmorerUiGlobals,
  registerArmorerDirectoryButton
} from "./22d-armorer-app.mjs";

const ADD2E_SHOP_TOKEN_PRESENTATION_VERSION = "2026-05-28-shop-token-name-lock-rotation-hide-actors-v2";
const ADD2E_VENDOR_COMPONENTS_BRIDGE_VERSION = "2026-05-28-vendor-components-gm-relay-v1";
const ADD2E_VENDOR_SOCKET_TYPE = "ADD2E_GM_OPERATION";
const ADD2E_COMPONENT_RESULT = "ADD2E_SPELL_COMPONENT_RESULT";
const ADD2E_COMPONENT_RESERVE = "vendorReserveSpellComponents";
const ADD2E_COMPONENT_REFUND = "vendorRefundSpellComponents";

function add2eShopTokenDisplayAlwaysValue() {
  return CONST?.TOKEN_DISPLAY_MODES?.ALWAYS ?? 50;
}

function add2eIsShopActor(actor) {
  return isVendorActor(actor) || isArmorerActor(actor);
}

function add2eAsArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") return value.split(/[,;|\n]+|\bet\b/gi).map(v => v.trim()).filter(Boolean);
  return [value];
}

function add2eComponentNameOnly(value) {
  const text = lower(value).replace(/[^a-z]/g, "");
  return ["v", "s", "m", "vs", "vm", "sm", "vsm", "verbal", "somatique", "materiel", "materielle", "material"].includes(text);
}

function add2ePushComponentRequirement(out, rawName, rawQty = 1) {
  const name = String(rawName ?? "").trim();
  if (!name || add2eComponentNameOnly(name)) return;
  const key = slug(name);
  if (!key) return;
  const qty = Math.max(1, Math.floor(num(rawQty, 1)));
  const existing = out.find(r => r.key === key);
  if (existing) existing.quantity += qty;
  else out.push({ name, key, quantity: qty });
}

function add2eCollectComponentRequirement(out, value) {
  if (value === null || value === undefined || value === "") return;
  if (Array.isArray(value)) {
    for (const entry of value) add2eCollectComponentRequirement(out, entry);
    return;
  }
  if (typeof value === "string") {
    for (const part of add2eAsArray(value)) add2ePushComponentRequirement(out, part, 1);
    return;
  }
  if (typeof value === "object") {
    const name = value.name ?? value.nom ?? value.label ?? value.item ?? value.component ?? value.composant ?? value.slug ?? value.id;
    const qty = value.quantity ?? value.quantite ?? value.qty ?? value.nombre ?? value.count ?? value.value ?? 1;
    if (name) add2ePushComponentRequirement(out, name, qty);
  }
}

function add2eSpellHasMaterialComponent(sort) {
  const system = sort?.system ?? {};
  const flags = sort?.flags?.add2e ?? {};
  const text = [system.composantes, system.components, flags.composantes, flags.components]
    .flatMap(add2eAsArray)
    .map(lower)
    .join(" ");
  return /(^|[^a-z])m([^a-z]|$)|materiel|matériel|material/.test(text);
}

function add2eSpellComponentRequirements(sort) {
  const system = sort?.system ?? {};
  const flags = sort?.flags?.add2e ?? {};
  const out = [];
  const fields = [
    system.composants_requis,
    system.composantsMateriels,
    system.composants_materiels,
    system.composant_materiel,
    system.composantMateriel,
    system.materiel,
    system.matériel,
    system.material,
    system.materialComponent,
    system.materialComponents,
    system.requiredComponents,
    system.componentsRequired,
    flags.composants_requis,
    flags.composants,
    flags.components,
    flags.requiredComponents
  ];
  for (const field of fields) add2eCollectComponentRequirement(out, field);
  for (const tag of [...add2eAsArray(system.tags), ...add2eAsArray(system.effectTags), ...add2eAsArray(flags.tags)]) {
    const text = String(tag ?? "").trim();
    if (/^composant[:_]/i.test(text)) add2ePushComponentRequirement(out, text.replace(/^composant[:_]/i, ""), 1);
  }
  return out;
}

function add2eComponentKeys(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [
    item?.name,
    system.nom,
    system.slug,
    system.composant,
    system.component,
    flags.slug,
    flags.componentSlug,
    ...(Array.isArray(system.tags) ? system.tags : []),
    ...(Array.isArray(system.effectTags) ? system.effectTags : []),
    ...(Array.isArray(flags.tags) ? flags.tags : [])
  ].map(v => slug(String(v ?? "").replace(/^composant[:_]/i, ""))).filter(Boolean);
}

function add2eFindActorComponent(actor, requirement) {
  const items = Array.from(actor?.items ?? []).filter(isComponent);
  return items.find(item => add2eComponentKeys(item).includes(requirement.key))
    ?? items.find(item => add2eComponentKeys(item).some(key => key && (key.includes(requirement.key) || requirement.key.includes(key))))
    ?? null;
}

async function add2eReserveSpellComponentsLocal(actor, sort, requirements = null) {
  const reqs = Array.isArray(requirements) && requirements.length ? requirements : add2eSpellComponentRequirements(sort);
  if (!reqs.length) {
    if (!add2eSpellHasMaterialComponent(sort)) return { ok: true, skipped: true, consumed: [] };
    return { ok: false, blocked: true, consumed: [], message: `${sort?.name ?? "Ce sort"} requiert une composante matérielle, mais aucun composant précis n'est déclaré sur le sort.` };
  }

  const consumed = [];
  for (const requirement of reqs) {
    const item = add2eFindActorComponent(actor, requirement);
    const before = quantity(item);
    if (!item || before < requirement.quantity) {
      for (const entry of consumed.reverse()) await entry.item.update(quantityUpdate(entry.before), { add2eReason: "spell-component-reserve-rollback" });
      return { ok: false, blocked: true, consumed: [], missing: requirement, message: `${actor?.name ?? "Le lanceur"} n'a pas le composant requis : ${requirement.name} (${requirement.quantity}).` };
    }
    const after = before - requirement.quantity;
    await item.update(quantityUpdate(after), { add2eReason: "spell-component-reserved-gm" });
    consumed.push({ item, itemId: item.id, itemName: item.name, requirement, before, after, quantity: requirement.quantity });
  }

  return { ok: true, blocked: false, actorId: actor?.id, sortId: sort?.id, sortName: sort?.name, consumed };
}

async function add2eRefundSpellComponentsLocal(reservation) {
  const actor = game.actors?.get(reservation?.actorId);
  const entries = reservation?.consumed ?? [];
  if (!actor || !entries.length) return false;
  for (const entry of entries) {
    const item = actor.items?.get(entry.itemId) ?? Array.from(actor.items ?? []).find(i => i.name === entry.itemName && isComponent(i));
    if (item) await item.update(quantityUpdate(entry.before), { add2eReason: "spell-component-refund-gm" });
  }
  return true;
}

function add2eSerializableComponentReservation(result) {
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
      before: entry.before,
      after: entry.after,
      quantity: entry.quantity,
      requirement: entry.requirement
    }))
  };
}

function add2eRequestComponentOperation(operation, payload) {
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
      if (data?.type !== ADD2E_COMPONENT_RESULT) return;
      if (data.requestId !== requestId || data.userId !== game.user?.id) return;
      finish(data.result ?? { ok: false, blocked: true, message: "Réponse MJ invalide." });
    };
    game.socket.on?.("system.add2e", handler);
    window.setTimeout(() => finish({ ok: false, blocked: true, message: "Aucune réponse du MJ pour les composants de sort." }), 7000);
    game.socket.emit("system.add2e", { type: ADD2E_VENDOR_SOCKET_TYPE, operation, payload: { ...payload, requestId, userId: game.user?.id } });
  });
}

async function add2eReserveSpellComponents(actor, sort) {
  if (game.user?.isGM) return add2eReserveSpellComponentsLocal(actor, sort);
  const requirements = add2eSpellComponentRequirements(sort);
  if (!requirements.length && !add2eSpellHasMaterialComponent(sort)) return { ok: true, skipped: true, consumed: [] };
  return add2eRequestComponentOperation(ADD2E_COMPONENT_RESERVE, { actorId: actor?.id, sortId: sort?.id, sortName: sort?.name, requirements });
}

async function add2eRefundSpellComponents(reservation) {
  if (!reservation?.consumed?.length) return false;
  if (game.user?.isGM) return add2eRefundSpellComponentsLocal(reservation);
  const result = await add2eRequestComponentOperation(ADD2E_COMPONENT_REFUND, { reservation });
  return !!result?.ok;
}

function registerSpellComponentSockets() {
  if (globalThis.__ADD2E_VENDOR_COMPONENT_SOCKET_V1) return;
  globalThis.__ADD2E_VENDOR_COMPONENT_SOCKET_V1 = true;

  game.socket?.on?.("system.add2e", async data => {
    if (!game.user?.isGM) return;
    if (data?.type !== ADD2E_VENDOR_SOCKET_TYPE) return;
    const payload = data.payload ?? {};
    if (data.operation === ADD2E_COMPONENT_RESERVE) {
      const actor = game.actors?.get(payload.actorId);
      const sort = actor?.items?.get(payload.sortId) ?? { id: payload.sortId, name: payload.sortName, system: {}, flags: {} };
      let result = { ok: false, blocked: true, message: "Acteur introuvable pour les composants de sort." };
      try { if (actor) result = await add2eReserveSpellComponentsLocal(actor, sort, payload.requirements); }
      catch (err) { result = { ok: false, blocked: true, message: err?.message || "Erreur MJ pendant la réservation des composants." }; }
      game.socket.emit("system.add2e", { type: ADD2E_COMPONENT_RESULT, requestId: payload.requestId, userId: payload.userId, result: add2eSerializableComponentReservation(result) });
      return;
    }
    if (data.operation === ADD2E_COMPONENT_REFUND) {
      let ok = false;
      try { ok = await add2eRefundSpellComponentsLocal(payload.reservation); }
      catch (err) { console.warn("[ADD2E][COMPONENTS][REFUND][GM]", err); }
      game.socket.emit("system.add2e", { type: ADD2E_COMPONENT_RESULT, requestId: payload.requestId, userId: payload.userId, result: { ok } });
    }
  });
}

function registerSpellComponentGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.consumables = { add2eReserveSpellComponents, add2eRefundSpellComponents };
  globalThis.ADD2E_CONSUMABLES = game.add2e.consumables;
  globalThis.ADD2E_VENDOR_COMPONENTS_BRIDGE_VERSION = ADD2E_VENDOR_COMPONENTS_BRIDGE_VERSION;
  globalThis.add2eReserveSpellComponents = add2eReserveSpellComponents;
  globalThis.add2eRefundSpellComponents = add2eRefundSpellComponents;
}

async function add2eEnforceShopTokenPresentation() {
  if (!game.user?.isGM) return false;

  const displayName = add2eShopTokenDisplayAlwaysValue();
  const actorUpdates = [];

  for (const actor of game.actors ?? []) {
    if (!add2eIsShopActor(actor)) continue;
    const update = {};
    if (actor.prototypeToken?.displayName !== displayName) update["prototypeToken.displayName"] = displayName;
    if (actor.prototypeToken?.lockRotation !== true) update["prototypeToken.lockRotation"] = true;
    if (actor.ownership?.default !== 0) update["ownership.default"] = 0;
    if (!Object.keys(update).length) continue;
    await actor.update(update, { add2eReason: "shop-token-presentation" }).catch(err => console.warn("[ADD2E][SHOP_TOKEN][ACTOR]", actor.name, err));
    actorUpdates.push(actor.name);
  }

  const sceneUpdates = [];
  for (const scene of game.scenes ?? []) {
    const updates = [];
    for (const tokenDoc of scene.tokens ?? []) {
      const actor = game.actors?.get?.(tokenDoc.actorId) ?? tokenDoc.actor ?? null;
      if (!add2eIsShopActor(actor)) continue;
      const update = { _id: tokenDoc.id };
      let changed = false;
      if (tokenDoc.displayName !== displayName) { update.displayName = displayName; changed = true; }
      if (tokenDoc.lockRotation !== true) { update.lockRotation = true; changed = true; }
      if (changed) updates.push(update);
    }
    if (!updates.length) continue;
    await scene.updateEmbeddedDocuments("Token", updates, { add2eReason: "shop-token-presentation" }).catch(err => console.warn("[ADD2E][SHOP_TOKEN][SCENE]", scene.name, err));
    sceneUpdates.push({ scene: scene.name, count: updates.length });
  }

  game.add2e = game.add2e ?? {};
  game.add2e.shopTokenPresentationVersion = ADD2E_SHOP_TOKEN_PRESENTATION_VERSION;
  globalThis.ADD2E_SHOP_TOKEN_PRESENTATION_VERSION = ADD2E_SHOP_TOKEN_PRESENTATION_VERSION;

  console.log("[ADD2E][SHOP_TOKEN][PRESENTATION]", {
    version: ADD2E_SHOP_TOKEN_PRESENTATION_VERSION,
    displayName,
    lockRotation: true,
    actorUpdates,
    sceneUpdates
  });

  return true;
}

function add2eHideShopActorsFromPlayers() {
  if (globalThis.__ADD2E_HIDE_SHOP_ACTORS_FROM_PLAYERS_V2) return;
  globalThis.__ADD2E_HIDE_SHOP_ACTORS_FROM_PLAYERS_V2 = true;
  Hooks.on("renderActorDirectory", (_app, html) => {
    if (game.user?.isGM) return;
    const root = html?.jquery ? html[0] : html;
    if (!root?.querySelectorAll) return;
    for (const actor of game.actors ?? []) {
      if (!add2eIsShopActor(actor)) continue;
      const selector = `[data-document-id="${actor.id}"], [data-entry-id="${actor.id}"], [data-actor-id="${actor.id}"]`;
      for (const node of root.querySelectorAll(selector)) node.remove();
    }
  });
}

Hooks.once("init", () => {
  game.settings.register("add2e", VENDOR_SETTING, {
    name: "ADD2E — Création du vendeur système",
    hint: "Version du vendeur de composants, projectiles et équipements créé automatiquement.",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register("add2e", ARMORER_SETTING, {
    name: "ADD2E — Création de l’armurier système",
    hint: "Version de l’armurier d’armes et armures créé automatiquement.",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  registerVendorDirectoryButton();
  registerArmorerDirectoryButton();
  add2eHideShopActorsFromPlayers();
});

Hooks.once("ready", async () => {
  registerGlobals();
  registerSpellComponentGlobals();
  registerSpellComponentSockets();
  registerUiGlobals();
  registerArmorerGlobals();
  registerArmorerUiGlobals();
  registerArmorerSockets();

  await ensureVendorOnLaunch().catch(err => console.warn("[ADD2E][VENDOR][AUTO_CREATE]", err));
  await ensureArmorerOnLaunch().catch(err => console.warn("[ADD2E][ARMORER][AUTO_CREATE]", err));
  await add2eEnforceShopTokenPresentation().catch(err => console.warn("[ADD2E][SHOP_TOKEN][PRESENTATION]", err));

  registerRecoveryHooks();
  patchActorSheetMoney();
  patchVendorTokenClick();
  patchArmorerTokenClick();

  window.setTimeout(bindAllVendorTokens, 500);
  window.setTimeout(bindAllArmorerTokens, 500);
  window.setTimeout(patchAttackRollProjectileConsumption, 800);
  window.setTimeout(patchAttackRollProjectileConsumption, 2000);

  console.log("[ADD2E][VENDOR][VERSION]", ADD2E_VENDOR_VERSION);
  console.log("[ADD2E][VENDOR][COMPONENTS_BRIDGE]", ADD2E_VENDOR_COMPONENTS_BRIDGE_VERSION);
  console.log("[ADD2E][ARMORER][VERSION]", ADD2E_ARMORER_VERSION);
});
