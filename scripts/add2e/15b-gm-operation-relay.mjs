// ADD2E — Relais MJ central pour ADD2E_GM_OPERATION.
// Préparation du futur split interne : effets, scène, tokens, projectiles.

Hooks.once("ready", () => {
  if (globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED) return;
  globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED = true;

  const VENDOR_SCOPE = "add2e";
  const PROJECTILE_FLAG = "projectilesDepensesCombat";

  console.log("%c[ADD2E][GM-RELAY] Relais MJ générique chargé", "color:#27ae60;font-weight:bold;");

  function isResponsibleGM() {
    if (!game.user.isGM) return false;
    if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
    return game.users.activeGM?.id === game.user.id;
  }

  function resolveScene(sceneId) {
    return game.scenes.get(sceneId) || canvas.scene || game.scenes.active || null;
  }

  async function resolveActor(payload) {
    if (payload.actorUuid) {
      try {
        const doc = await fromUuid(payload.actorUuid);
        if (doc) return doc;
      } catch (e) {
        console.warn("[ADD2E][GM-RELAY] actorUuid non résolu :", payload.actorUuid, e);
      }
    }

    if (payload.sceneId && payload.tokenId) {
      const scene = resolveScene(payload.sceneId);
      const tokenDoc = scene?.tokens?.get(payload.tokenId);
      if (tokenDoc?.actor) return tokenDoc.actor;
    }

    if (payload.actorId) return game.actors.get(payload.actorId) ?? null;
    return null;
  }

  // -----------------------------------------------------
  // 15b-1 futur : dégâts et effets
  // -----------------------------------------------------
  function relayArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.flatMap(relayArray).filter(Boolean);
    if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
    return [value];
  }

  function relayNormalize(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/[\s\-]+/g, "_")
      .replace(/_+/g, "_");
  }

  async function applyDamage(payload) {
    const targetActor = await resolveActor(payload);
    if (!targetActor) return console.warn("[ADD2E][GM-RELAY][applyDamage] acteur introuvable :", payload);

    const sys = targetActor.system ?? {};
    const amount = Math.abs(Number(payload.montant) || 0);
    if (!amount) return;

    const max = Number(sys.points_de_coup) || Number(sys.pv_max) || Number(sys.points_de_vie) || Number(sys.hp?.max) || Number(sys.attributes?.hp?.max) || 0;
    const current = [sys.pdv, sys.pv, sys.hp?.value, sys.attributes?.hp?.value]
      .map(v => Number(v))
      .find(v => Number.isFinite(v)) ?? max;
    const isHeal = String(payload.type ?? "").toLowerCase().includes("soin") || Number(payload.montant) < 0;
    const next = isHeal ? Math.min(max || current + amount, current + amount) : current - amount;

    await targetActor.update({ "system.pdv": next }, { add2eReason: "gm-relay-apply-damage", add2eDetails: payload.details });
  }

  async function deleteActiveEffects(payload) {
    const targetActor = await resolveActor(payload);
    if (!targetActor) return console.warn("[ADD2E][GM-RELAY][deleteActiveEffects] acteur introuvable :", payload);

    const ids = new Set(relayArray(payload.effectIds).filter(Boolean));
    const tagNorms = relayArray(payload.tags).map(relayNormalize);
    const nameNorms = relayArray(payload.names).map(relayNormalize);

    if (tagNorms.length || nameNorms.length) {
      for (const effect of targetActor.effects ?? []) {
        const tags = relayArray(effect.flags?.add2e?.tags ?? effect.getFlag?.("add2e", "tags") ?? []).map(relayNormalize);
        const name = relayNormalize(effect.name);
        if (tagNorms.some(t => tags.includes(t)) || nameNorms.some(n => name.includes(n))) ids.add(effect.id);
      }
    }

    const finalIds = [...ids].filter(Boolean);
    if (finalIds.length) await targetActor.deleteEmbeddedDocuments("ActiveEffect", finalIds);
  }

  // -----------------------------------------------------
  // 15b-2 futur : scène, templates, lumières
  // -----------------------------------------------------
  function measuredTemplates(scene, payload) {
    if (!scene) return [];
    const requestId = payload.templateRequestId ?? payload.requestId ?? null;
    const templateId = payload.templateId ?? null;
    const spell = payload.spell ?? null;

    return Array.from(scene.templates ?? []).filter(t => {
      if (templateId && t.id === templateId) return true;
      if (requestId && (t.flags?.add2e?.templateRequestId === requestId || t.getFlag?.("add2e", "templateRequestId") === requestId)) return true;
      if (spell && t.flags?.add2e?.spell === spell && requestId && t.flags?.add2e?.templateRequestId === requestId) return true;
      return false;
    });
  }

  async function createMeasuredTemplate(payload) {
    const scene = resolveScene(payload.sceneId);
    if (!scene) return console.warn("[ADD2E][GM-RELAY][createMeasuredTemplate] scène introuvable :", payload);

    const templateData = foundry.utils.deepClone(payload.templateData ?? {});
    const requestId = payload.templateRequestId ?? templateData.flags?.add2e?.templateRequestId ?? null;
    if (requestId && measuredTemplates(scene, { templateRequestId: requestId }).length) return;

    templateData.flags ??= {};
    templateData.flags.add2e ??= {};
    if (requestId) templateData.flags.add2e.templateRequestId = requestId;
    if (payload.spell) templateData.flags.add2e.spell = payload.spell;
    if (payload.spellName) templateData.flags.add2e.spellName = payload.spellName;

    await scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
  }

  async function deleteMeasuredTemplates(payload) {
    const scene = resolveScene(payload.sceneId);
    if (!scene) return console.warn("[ADD2E][GM-RELAY][deleteMeasuredTemplates] scène introuvable :", payload);

    const ids = measuredTemplates(scene, payload).map(t => t.id).filter(Boolean);
    if (ids.length) await scene.deleteEmbeddedDocuments("MeasuredTemplate", ids);
  }

  async function createAmbientLight(payload) {
    const scene = resolveScene(payload.sceneId);
    if (!scene) return console.warn("[ADD2E][GM-RELAY][createAmbientLight] scène introuvable :", payload);

    const lightData = {
      x: Number(payload.x ?? 0),
      y: Number(payload.y ?? 0),
      rotation: Number(payload.rotation ?? 0),
      walls: payload.walls !== false,
      vision: payload.vision === true,
      config: {
        dim: Number(payload.dim ?? 6),
        bright: Number(payload.bright ?? 3),
        angle: Number(payload.angle ?? 360),
        color: payload.color ?? "#fffec4",
        alpha: Number(payload.alpha ?? 0.5),
        coloration: Number(payload.coloration ?? 1),
        luminosity: Number(payload.luminosity ?? 0.5),
        attenuation: Number(payload.attenuation ?? 0.5),
        animation: payload.animation ?? { type: "torch", speed: 2, intensity: 2, reverse: false }
      },
      flags: { add2e: foundry.utils.duplicate(payload.flags?.add2e ?? {}) }
    };

    await scene.createEmbeddedDocuments("AmbientLight", [lightData]);
  }

  async function deleteAmbientLight(payload) {
    const scene = resolveScene(payload.sceneId);
    if (!scene) return console.warn("[ADD2E][GM-RELAY][deleteAmbientLight] scène introuvable :", payload);

    const light = Array.from(scene.lights ?? []).find(l => {
      if (payload.lightId && l.id === payload.lightId) return true;
      if (payload.requestId && (l.flags?.add2e?.requestId === payload.requestId || l.getFlag?.("add2e", "requestId") === payload.requestId)) return true;
      return false;
    });

    if (light) await light.delete();
  }

  // -----------------------------------------------------
  // 15b-3 futur : tokens, effets actifs, projectiles
  // -----------------------------------------------------
  async function updateToken(payload) {
    const scene = resolveScene(payload.sceneId);
    const tokenDoc = scene?.tokens?.get(payload.tokenId);
    if (!scene || !tokenDoc) return console.warn("[ADD2E][GM-RELAY][updateToken] scène/token introuvable :", payload);
    await tokenDoc.update(payload.updateData ?? {});
  }

  async function createActiveEffect(payload) {
    const targetActor = await resolveActor(payload);
    if (!targetActor) return console.warn("[ADD2E][GM-RELAY][createActiveEffect] acteur introuvable :", payload);

    const effectData = foundry.utils.duplicate(payload.effectData ?? {});
    delete effectData._id;
    await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  }

  async function vendorRecordProjectileSpent(payload) {
    const combat = game.combats?.get?.(payload.combatId) ?? game.combat;
    if (!combat?.getFlag || !combat?.setFlag) return console.warn("[ADD2E][GM-RELAY][vendorRecordProjectileSpent] combat introuvable :", payload);

    const actorId = payload.actorId ?? null;
    const itemKey = payload.itemId ?? payload.itemName ?? null;
    const qty = Math.max(1, Math.floor(Number(payload.quantity ?? 1) || 1));
    if (!actorId || !itemKey) return console.warn("[ADD2E][GM-RELAY][vendorRecordProjectileSpent] payload incomplet :", payload);

    const spent = foundry.utils.deepClone(await combat.getFlag(VENDOR_SCOPE, PROJECTILE_FLAG) ?? {});
    spent[actorId] ??= { actorId, actorName: payload.actorName ?? "", items: {} };
    spent[actorId].actorName = payload.actorName ?? spent[actorId].actorName ?? "";
    spent[actorId].items ??= {};
    spent[actorId].items[itemKey] ??= { itemId: payload.itemId ?? null, itemName: payload.itemName ?? "Projectile", img: payload.img ?? null, spent: 0 };
    spent[actorId].items[itemKey].spent = Math.max(0, Number(spent[actorId].items[itemKey].spent ?? 0)) + qty;
    spent[actorId].items[itemKey].itemId = payload.itemId ?? spent[actorId].items[itemKey].itemId ?? null;
    spent[actorId].items[itemKey].itemName = payload.itemName ?? spent[actorId].items[itemKey].itemName ?? "Projectile";
    spent[actorId].items[itemKey].img = payload.img ?? spent[actorId].items[itemKey].img ?? null;

    await combat.setFlag(VENDOR_SCOPE, PROJECTILE_FLAG, spent);
  }

  game.socket.on("system.add2e", async data => {
    console.log("[ADD2E SOCKET][RECU]", { user: game.user.name, isGM: game.user.isGM, data });

    if (data?.type === "applyActiveEffect") {
      if (!game.user.isGM) return;
      const targetActor = await resolveActor(data);
      if (!targetActor) return console.warn("[ADD2E SOCKET][applyActiveEffect] ACTEUR CIBLE INTROUVABLE", data);
      const effectData = foundry.utils.deepClone(data.effectData || {});
      if (!effectData.name && effectData.label) effectData.name = effectData.label;
      if (!effectData.label && effectData.name) effectData.label = effectData.name;
      effectData.flags ??= {};
      effectData.flags.add2e ??= {};
      effectData.flags.add2e.appliedBySocket = true;
      effectData.flags.add2e.appliedByGM = game.user.id;
      effectData.flags.add2e.appliedAt = Date.now();
      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return;
    }

    if (!data || data.type !== "ADD2E_GM_OPERATION") return;
    if (!isResponsibleGM()) return;

    const operation = data.operation;
    const payload = data.payload ?? {};
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

    const handler = routes[operation];
    if (!handler) return console.warn("[ADD2E][GM-RELAY] opération inconnue :", operation, payload);
    await handler(payload);
  });
});
