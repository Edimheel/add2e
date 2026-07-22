// ADD2E — Pouvoirs d'objets magiques / orchestration d'exécution et liaison aux feuilles.

import {
  INTERNAL_ON_USE, cleanPower, effectHandler, effectTypes, executionResult, itemUsable,
  norm, normalizeExecutionResult, passivePower, powerArray, powerName
} from "./runtime.mjs";
import { resolveExecutionParameters } from "./runtime.mjs";
import { powerContext, resolveTargets } from "./targeting.mjs";
import { syncItem, findGenerated } from "./passive-effects.mjs";
import { createCard, confirmPower, parameterRows } from "./chat.mjs";
import { linkedPower, linkedSpellEffect } from "./spells.mjs";

async function assisted(actor, item, power, unresolvedTypes = []) {
  const targets = resolveTargets(actor, power, {}, resolveExecutionParameters(power, {})).actors;
  await createCard(actor, item, power, {
    variant: "ability",
    rows: parameterRows(power),
    message: "Résolution assistée : appliquez les choix, jets, sauvegardes ou conséquences indiqués par le pouvoir et sa source.",
    targets
  });
  return executionResult("assisted", { ok: true, handled: "assisted", complete: false, unresolvedTypes, targets });
}

function powerCost(power) {
  const linked = linkedSpellEffect(power);
  const value = Number(power?.cout ?? power?.cost ?? power?.chargeCost ?? power?.parameters?.chargeCost ?? linked?.chargeCost);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

async function executeRegisteredEffects(actor, item, power, index, sheet = null) {
  const results = [];
  const unresolvedTypes = [];
  for (const effect of power.effects ?? []) {
    const type = norm(effect?.type ?? effect?.kind ?? effect?.category);
    const handler = effectHandler(type);
    if (!handler) {
      if (type) unresolvedTypes.push(type);
      continue;
    }
    const result = normalizeExecutionResult(await handler(powerContext(actor, item, power, index, effect, sheet)), {
      handled: type,
      complete: true
    });
    results.push(result);
    if (result.status === "cancelled" || (result.ok === false && result.status === "failed")) break;
  }
  const successes = results.filter(result => result.ok && result.status !== "assisted");
  const cancelled = results.find(result => result.status === "cancelled");
  const failed = results.find(result => result.status === "failed" && !result.ok);
  if (cancelled) return executionResult("cancelled", { ...cancelled, results, unresolvedTypes, consumeCharges: false });
  if (failed && !successes.length) return executionResult("failed", { ...failed, results, unresolvedTypes, consumeCharges: false });
  if (successes.length) {
    return executionResult("success", {
      ok: true,
      handled: successes.map(result => result.handled).filter(Boolean).join(","),
      complete: unresolvedTypes.length === 0 && results.every(result => result.complete !== false),
      chargesManaged: results.some(result => result.chargesManaged === true),
      consumeCharges: results.every(result => result.consumeCharges !== false),
      results,
      unresolvedTypes
    });
  }
  if (results.some(result => result.status === "assisted")) return executionResult("assisted", { ok: false, complete: false, results, unresolvedTypes });
  return executionResult("skipped", { ok: false, complete: false, results, unresolvedTypes });
}

export async function executePower(actor, item, power, index = 0, sheet = null) {
  if (!actor || !item || power?.kind !== "catalogue") {
    ui.notifications.error("Pouvoir du catalogue introuvable.");
    return false;
  }
  if (!itemUsable(item)) {
    ui.notifications.warn(`${item.name} doit être équipé ou utilisable.`);
    return false;
  }
  const clean = cleanPower(power);
  if (!await confirmPower(actor, item, clean)) return false;
  const linked = !!linkedSpellEffect(clean);
  const cost = powerCost(clean);
  const current = linked ? 0 : Number(globalThis.add2eObjectPowerCurrentCharges?.(item, clean, index)) || 0;
  if (!linked && cost > 0 && current < cost) {
    ui.notifications.warn(`${item.name} n'a pas assez de charges.`);
    return false;
  }
  try {
    let result;
    if (passivePower(clean)) {
      await syncItem(item);
      await createCard(actor, item, clean, {
        title: "Pouvoir passif",
        rows: parameterRows(clean),
        message: "Ce pouvoir est appliqué automatiquement par l'ActiveEffect lié à l'objet."
      });
      result = executionResult("success", { handled: "passive" });
    } else {
      result = normalizeExecutionResult(await linkedPower(actor, item, clean, index));
      if (result.status === "skipped") result = await executeRegisteredEffects(actor, item, clean, index, sheet);
      if (result.status === "cancelled") return false;
      if (linked && !result.ok) return false;
      if (!result.ok) result = await assisted(actor, item, clean, result.unresolvedTypes ?? effectTypes(clean));
    }
    if (result.ok && cost > 0 && result.chargesManaged !== true && result.consumeCharges !== false) {
      await globalThis.add2eObjectPowerSetCharges?.(item, clean, index, current - cost);
    }
    if (result.ok) {
      sheet?._add2eRememberActiveTab?.();
      sheet?.render?.(false);
      return true;
    }
    return false;
  } catch (error) {
    console.error("[ADD2E][MAGIC_POWER_EFFECTS][EXECUTION]", {
      actor: actor.name,
      item: item.name,
      power: powerName(clean, item),
      error
    });
    ui.notifications.error(`Erreur pendant l'utilisation de ${powerName(clean, item)} : ${error.message}`);
    return false;
  }
}

export function installEntriesBridge() {
  if (globalThis.__add2eMagicCatalogueEntriesBridgeV4) return;
  globalThis.__add2eMagicCatalogueEntriesBridgeV4 = true;
  const original = globalThis.add2eMagicObjectActivePowerEntries;
  globalThis.add2eMagicObjectActivePowerEntries = item => {
    const rows = typeof original === "function" ? [...(original(item) ?? [])] : [];
    const indexes = new Set(rows.map(entry => Number(entry?.index)).filter(Number.isFinite));
    powerArray(item).forEach((power, index) => {
      if (power.kind !== "catalogue" || indexes.has(index)) return;
      const presented = foundry.utils.deepClone(power);
      presented.onUse ||= INTERNAL_ON_USE;
      presented.onuse ||= presented.onUse;
      presented.on_use ||= presented.onUse;
      rows.push({ power: presented, index });
    });
    return rows.sort((left, right) => Number(left.index) - Number(right.index));
  };
}

function rootOf(app, html) {
  return html instanceof HTMLElement ? html
    : html?.[0] instanceof HTMLElement ? html[0]
      : app?.element instanceof HTMLElement ? app.element
        : app?.element?.[0] instanceof HTMLElement ? app.element[0] : null;
}

export function bindSheet(app, html) {
  const actor = app?.actor ?? app?.document ?? app?.object;
  const root = rootOf(app, html);
  if (actor?.documentName !== "Actor" || !root || root.dataset.add2eMagicCatalogueExecutionBound === "1") return;
  root.dataset.add2eMagicCatalogueExecutionBound = "1";
  root.addEventListener("click", async event => {
    const control = event.target?.closest?.(".sort-cast-img, .add2e-object-magic-cast");
    if (!control || !root.contains(control)) return;
    const resolved = findGenerated(actor, control.dataset?.sortId ?? control.getAttribute?.("data-sort-id"));
    if (!resolved) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    await executePower(actor, resolved.item, resolved.power, resolved.index, app);
  }, true);
}
