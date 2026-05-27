// ADD2E — Relais MJ central pour ADD2E_GM_OPERATION.

import {
  ADD2E_GM_OPERATION,
  ADD2E_SOCKET,
  isResponsibleGM
} from "./15b0-gm-relay-common.mjs";

import {
  applyDamage,
  applyLegacyActiveEffect,
  createActiveEffect,
  deleteActiveEffects
} from "./15b1-gm-relay-effects.mjs";

import {
  createAmbientLight,
  createMeasuredTemplate,
  deleteAmbientLight,
  deleteMeasuredTemplates,
  updateToken
} from "./15b2-gm-relay-scene-documents.mjs";

import { vendorRecordProjectileSpent } from "./15b3-gm-relay-projectiles.mjs";

Hooks.once("ready", () => {
  if (globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED) return;
  globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED = true;

  console.log("%c[ADD2E][GM-RELAY] Relais MJ générique chargé", "color:#27ae60;font-weight:bold;");

  const routes = {
    applyDamage,
    deleteActiveEffects,
    createMeasuredTemplate,
    deleteMeasuredTemplates,
    createAmbientLight,
    deleteAmbientLight,
    updateToken,
    createActiveEffect,
    vendorRecordProjectileSpent
  };

  game.socket.on(ADD2E_SOCKET, async data => {
    console.log("[ADD2E SOCKET][RECU]", {
      user: game.user.name,
      isGM: game.user.isGM,
      data
    });

    if (data?.type === "applyActiveEffect") {
      if (!game.user.isGM) return;
      await applyLegacyActiveEffect(data);
      return;
    }

    if (!data || data.type !== ADD2E_GM_OPERATION) return;
    if (!isResponsibleGM()) return;

    const operation = data.operation;
    const payload = data.payload ?? {};
    const handler = routes[operation];

    if (!handler) {
      console.warn("[ADD2E][GM-RELAY] opération inconnue :", operation, payload);
      return;
    }

    await handler(payload);
  });
});
