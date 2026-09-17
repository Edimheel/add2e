/**
 * ADD2E — Amitié
 * Magicien niveau 1 — sauvegarde, zone et réaction sociale canoniques.
 * Compatible Foundry V13/V14/V15 — aucune fenêtre legacy ni MeasuredTemplate.
 * Contrat onUse : true = sort consommé ; false = sort non consommé.
 */

const __add2eOnUseResult = await (async () => {
  const VERSION = "2026-09-17-canonical-canvas-zone-v4";
  const TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][AMITIE]";
  const CONFIG = Object.freeze({
    name: "Amitié",
    slug: "amitie",
    level: 1,
    school: "Enchantement/Charme",
    areaUnit: "adnd-inch",
    areaUsage: "area",
    areaMeasure: "diameter",
    img: "systems/add2e/assets/icones/sorts/magicien-amitie.webp",
    fallbackImg: "icons/magic/control/hypnosis-mesmerism-eye.webp"
  });

  const sourceItem = (typeof sort !== "undefined" && sort)
    || (typeof item !== "undefined" && item)
    || (typeof spell !== "undefined" && spell)
    || (typeof args !== "undefined" && args?.[0]?.item)
    || null;
  const caster = (typeof actor !== "undefined" && actor)
    || sourceItem?.parent
    || null;
  const suppliedToken = (typeof token !== "undefined" && token)
    || (typeof args !== "undefined" && args?.[0]?.token)
    || null;

  if (!sourceItem || !caster) {
    ui.notifications.error("Amitié : lanceur ou sort introuvable.");
    return false;
  }
  if (typeof globalThis.add2eRollSavingThrow !== "function") {
    ui.notifications.error("Amitié : l’exécuteur canonique de sauvegardes est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications.error("Amitié : les cartes communes ADD2E sont indisponibles.");
    return false;
  }
  if (typeof globalThis.add2eRollContextualReactionCard !== "function") {
    ui.notifications.error("Amitié : le contrôleur canonique de réaction contextuelle est indisponible.");
    return false;
  }

  const effectsEngine = globalThis.ADD2E_EFFECTS;
  if (!effectsEngine || typeof effectsEngine.resolveAbilityDerived !== "function" || typeof effectsEngine.createModifier !== "function") {
    ui.notifications.error("Amitié : le moteur canonique des effets est indisponible.");
    return false;
  }
  const timeEngine = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  if (!timeEngine || typeof timeEngine.durationData !== "function") {
    ui.notifications.error("Amitié : le moteur canonique de durée est indisponible.");
    return false;
  }

  const clone = value => {
    if (typeof foundry?.utils?.deepClone === "function") return foundry.utils.deepClone(value);
    return JSON.parse(JSON.stringify(value));
  };
  const number = (value, fallback = 0) => {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  };
  const signed = value => `${Number(value) > 0 ? "+" : ""}${Number(value) || 0}`;
  const randomId = () => foundry.utils.randomID?.(16)
    ?? globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 16)
    ?? `amitie_${Date.now()}`;
  const spellImg = sourceItem.img || CONFIG.img || CONFIG.fallbackImg;

  const resolveCasterLevel = () => {
    if (sourceItem?.system?.isObjectPower === true) {
      const explicit = Number(sourceItem.system?.casterLevel);
      if (!Number.isInteger(explicit) || explicit < 1) {
        throw new Error("Amitié : niveau de lanceur explicite absent du pouvoir d’objet magique.");
      }
      return explicit;
    }
    if (typeof globalThis.add2eCanActorUseSpell !== "function") {
      throw new Error("Amitié : le résolveur canonique de lancement des sorts est indisponible.");
    }
    const access = globalThis.add2eCanActorUseSpell(caster, sourceItem);
    const level = Number(access?.actorLevel);
    if (access?.ok !== true || !Number.isInteger(level) || level < 1) {
      throw new Error(`Amitié : niveau canonique du lanceur indisponible${access?.reason ? ` (${access.reason})` : ""}.`);
    }
    return level;
  };

  let casterLevel;
  try {
    casterLevel = resolveCasterLevel();
  } catch (error) {
    ui.notifications.error(error?.message ?? "Amitié : niveau du lanceur indisponible.");
    return false;
  }

  const durationRounds = casterLevel;
  const casterToken = suppliedToken
    ?? canvas.tokens?.controlled?.find(entry => entry.actor?.id === caster.id)
    ?? caster.getActiveTokens?.()[0]
    ?? null;

  const areaDiameterInches = 1 + casterLevel;
  const fallbackArea = () => {
    const diameterMeters = areaDiameterInches * 3;
    const radiusMeters = diameterMeters / 2;
    const scene = canvas.scene;
    const sceneUnitKey = String(scene?.grid?.units ?? "m").trim().toLowerCase();
    const metric = ["m", "metre", "metres", "meter", "meters"].includes(sceneUnitKey);
    const sceneUnit = metric ? "m" : "ft";
    const radiusSceneDistance = metric ? radiusMeters : radiusMeters / 0.3048;
    const gridDistance = Math.max(0.000001, number(scene?.grid?.distance, 1));
    const gridSize = Math.max(1, number(scene?.grid?.size ?? canvas.grid?.size, 100));
    return {
      sourceDistance: areaDiameterInches,
      sourceUnit: CONFIG.areaUnit,
      measure: CONFIG.areaMeasure,
      diameterMeters,
      radiusMeters,
      sceneDistance: radiusSceneDistance,
      radiusSceneDistance,
      diameterSceneDistance: radiusSceneDistance * 2,
      radiusGridCells: radiusSceneDistance / gridDistance,
      diameterGridCells: (radiusSceneDistance * 2) / gridDistance,
      radiusPixels: (radiusSceneDistance / gridDistance) * gridSize,
      pixels: (radiusSceneDistance / gridDistance) * gridSize,
      sceneUnit,
      gridDistance,
      gridSize
    };
  };
  const sceneArea = () => {
    if (typeof globalThis.add2eSceneDistance === "function") {
      const resolved = globalThis.add2eSceneDistance({
        scene: canvas.scene,
        distance: areaDiameterInches,
        unit: CONFIG.areaUnit,
        usage: CONFIG.areaUsage,
        measure: CONFIG.areaMeasure
      });
      if (Number.isFinite(Number(resolved?.sceneDistance)) && Number.isFinite(Number(resolved?.pixels))) {
        return {
          ...resolved,
          radiusPixels: number(resolved.radiusPixels ?? resolved.pixels),
          radiusSceneDistance: number(resolved.radiusSceneDistance ?? resolved.sceneDistance),
          diameterSceneDistance: number(resolved.diameterSceneDistance, number(resolved.sceneDistance) * 2),
          radiusGridCells: number(resolved.radiusGridCells ?? resolved.gridCells),
          diameterGridCells: number(resolved.diameterGridCells, number(resolved.gridCells) * 2)
        };
      }
    }
    return fallbackArea();
  };

  const tokenCenter = tokenDocOrPlaceable => {
    const placeable = tokenDocOrPlaceable?.object ?? tokenDocOrPlaceable;
    if (placeable?.center) return { x: number(placeable.center.x), y: number(placeable.center.y) };
    const document = tokenDocOrPlaceable?.document ?? tokenDocOrPlaceable;
    const gridSize = number(canvas.scene?.grid?.size ?? canvas.grid?.size, 100);
    return {
      x: number(document?.x) + (Math.max(1, number(document?.width, 1)) * gridSize) / 2,
      y: number(document?.y) + (Math.max(1, number(document?.height, 1)) * gridSize) / 2
    };
  };

  const canvasElement = () => canvas?.app?.canvas ?? canvas?.app?.view ?? null;
  const canvasPosition = event => {
    if (typeof canvas?.canvasCoordinatesFromClient !== "function") {
      throw new Error("Amitié : conversion canonique des coordonnées canvas indisponible.");
    }
    return canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
  };
  const placementDiameterClientPixels = (center, diameterCanvasPixels) => {
    if (typeof canvas?.clientCoordinatesFromCanvas !== "function") return null;
    const clientCenter = canvas.clientCoordinatesFromCanvas(center);
    const clientEdge = canvas.clientCoordinatesFromCanvas({
      x: center.x + diameterCanvasPixels / 2,
      y: center.y
    });
    const radius = Math.hypot(clientEdge.x - clientCenter.x, clientEdge.y - clientCenter.y);
    return Number.isFinite(radius) && radius > 0 ? radius * 2 : null;
  };

  const emitGmOperation = (operation, payload) => {
    game.socket?.emit?.("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation,
      payload
    });
  };

  const chooseZone = async requestId => {
    if (!canvas?.ready || !canvas?.scene) {
      ui.notifications.warn("Amitié : scène ou canevas indisponible.");
      return null;
    }
    const view = canvasElement();
    if (!view) throw new Error("Amitié : élément canvas introuvable.");

    const area = sceneArea();
    const radiusPixels = number(area.radiusPixels ?? area.pixels);
    if (!(radiusPixels > 0)) throw new Error("Amitié : rayon de zone canonique invalide.");
    const diameterCanvasPixels = radiusPixels * 2;
    const initial = casterToken
      ? tokenCenter(casterToken)
      : { x: canvas.dimensions.width / 2, y: canvas.dimensions.height / 2 };

    const marker = document.createElement("div");
    marker.dataset.add2eFriendshipPlacement = "1";
    Object.assign(marker.style, {
      position: "fixed",
      zIndex: "100000",
      pointerEvents: "none",
      boxSizing: "border-box",
      border: "2px solid rgba(255, 242, 168, 0.98)",
      borderRadius: "50%",
      background: "rgba(179, 107, 255, 0.18)",
      boxShadow: "0 0 0 1px rgba(179,107,255,.9) inset",
      display: "none"
    });
    document.body.appendChild(marker);

    const previousCursor = view.style.cursor;
    view.style.cursor = "crosshair";
    ui.notifications.info("Amitié : cliquez sur la scène pour placer la zone, clic droit ou Échap pour annuler.");

    return new Promise(resolve => {
      let finished = false;
      let current = { ...initial };

      const cleanup = result => {
        if (finished) return;
        finished = true;
        view.removeEventListener("pointermove", onMove, true);
        view.removeEventListener("pointerdown", onPointerDown, true);
        view.removeEventListener("contextmenu", onContextMenu, true);
        window.removeEventListener("keydown", onKeyDown, true);
        view.style.cursor = previousCursor;
        marker.remove();
        resolve(result);
      };

      const refresh = eventOrPoint => {
        const position = eventOrPoint?.clientX !== undefined ? canvasPosition(eventOrPoint) : eventOrPoint;
        if (!position) return null;
        current = { x: number(position.x), y: number(position.y) };
        const diameter = placementDiameterClientPixels(current, diameterCanvasPixels);
        if (diameter && typeof canvas?.clientCoordinatesFromCanvas === "function") {
          const clientCenter = canvas.clientCoordinatesFromCanvas(current);
          marker.style.width = `${diameter}px`;
          marker.style.height = `${diameter}px`;
          marker.style.left = `${clientCenter.x - diameter / 2}px`;
          marker.style.top = `${clientCenter.y - diameter / 2}px`;
          marker.style.display = "block";
        }
        return current;
      };

      function onMove(event) {
        refresh(event);
      }
      function onPointerDown(event) {
        if (event.button !== 0 && event.button !== 2) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (event.button === 2) return cleanup(null);
        const position = refresh(event);
        cleanup(position ? {
          x: position.x,
          y: position.y,
          sceneId: canvas.scene.id,
          templateRequestId: requestId,
          templateId: null,
          templateVia: "native-canvas-preview"
        } : null);
      }
      function onContextMenu(event) {
        event.preventDefault();
        event.stopPropagation();
        cleanup(null);
      }
      function onKeyDown(event) {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        cleanup(null);
      }

      refresh(initial);
      view.addEventListener("pointermove", onMove, true);
      view.addEventListener("pointerdown", onPointerDown, true);
      view.addEventListener("contextmenu", onContextMenu, true);
      window.addEventListener("keydown", onKeyDown, true);
    });
  };

  const targetsInZone = zone => {
    const area = sceneArea();
    const radiusPixels = number(area.radiusPixels ?? area.pixels);
    const casterTokenId = casterToken?.id ?? casterToken?.document?.id ?? null;
    return (canvas.tokens?.placeables ?? [])
      .filter(target => target?.actor && target.id !== casterTokenId)
      .filter(target => {
        const center = tokenCenter(target);
        return Math.hypot(center.x - zone.x, center.y - zone.y) <= radiusPixels;
      });
  };

  const hasAnimalIntelligence = targetActor => {
    const intelligence = effectsEngine.resolveAbilityDerived(targetActor, "intelligence", {
      source: "spell:amitie",
      sourceItem,
      caster,
      targetActor
    });
    return Number(intelligence?.total) <= 2;
  };

  const buildReactionEffect = (targetToken, modifierValue, saveResult, zone) => {
    const favorable = modifierValue > 0;
    const modifierId = `${sourceItem.id || CONFIG.slug}:${caster.id}:${targetToken.actor.id}:reaction`;
    const modifier = effectsEngine.createModifier({
      id: modifierId,
      domain: "reaction",
      target: "encounter",
      operation: "add",
      value: modifierValue,
      priority: Date.now(),
      stacking: {
        mode: "unique-source",
        group: `amitie:${caster.id}:${targetToken.actor.id}`
      },
      conditions: {},
      source: {
        kind: "spell",
        id: sourceItem.id || CONFIG.slug,
        uuid: sourceItem.uuid || `Actor.${caster.id}.Item.${sourceItem.id || CONFIG.slug}`,
        name: sourceItem.name || CONFIG.name
      },
      duration: { rounds: durationRounds },
      metadata: {
        label: favorable ? "Amitié — impression favorable" : "Amitié — irritation",
        direction: "incoming",
        sourceActorId: caster.id,
        sourceActorUuid: caster.uuid,
        sourceActorName: caster.name,
        targetActorId: targetToken.actor.id,
        targetActorUuid: targetToken.actor.uuid,
        spellKey: CONFIG.slug,
        spellName: sourceItem.name || CONFIG.name,
        saveSuccess: saveResult.success === true
      }
    });

    return {
      name: favorable ? "Amitié — impression favorable" : "Amitié — irritation",
      img: spellImg,
      disabled: false,
      transfer: false,
      type: "base",
      system: {},
      changes: [],
      duration: timeEngine.durationData(durationRounds),
      description: favorable
        ? `${targetToken.name} est favorablement impressionné par ${caster.name}.`
        : `${targetToken.name} se montre irrité par la présence de ${caster.name}.`,
      flags: {
        add2e: {
          modifiers: [modifier],
          tags: [
            "classe:magicien",
            "liste:magicien",
            "niveau:1",
            "sort:amitie",
            "type:charme",
            "type:social",
            favorable ? "reaction:favorable" : "reaction:irritee",
            `reaction_modifier:${modifierValue}`,
            `caster:${caster.id}`,
            `duree_rounds:${durationRounds}`
          ],
          spell: {
            slug: CONFIG.slug,
            name: sourceItem.name || CONFIG.name,
            casterId: caster.id,
            casterUuid: caster.uuid,
            casterName: caster.name,
            targetActorId: targetToken.actor.id,
            targetActorUuid: targetToken.actor.uuid,
            reactionModifier: modifierValue,
            saveRoll: saveResult.roll?.total ?? null,
            saveTotal: saveResult.total ?? null,
            saveTarget: saveResult.target ?? null,
            durationRounds,
            templateRequestId: zone.templateRequestId,
            templateId: null,
            templateSceneId: zone.sceneId,
            sourceItemId: sourceItem.id,
            sourceItemUuid: sourceItem.uuid,
            version: VERSION
          }
        }
      }
    };
  };

  const applyEffect = async (targetToken, effectData) => {
    if (game.user.isGM || targetToken.actor.isOwner) {
      await targetToken.actor.createEmbeddedDocuments("ActiveEffect", [clone(effectData)]);
      return true;
    }
    emitGmOperation("createActiveEffect", {
      actorUuid: targetToken.actor.uuid,
      actorId: targetToken.actor.id,
      sceneId: canvas.scene?.id ?? null,
      tokenId: targetToken.document?.id ?? targetToken.id,
      effectData
    });
    return true;
  };

  const resolveTarget = async (targetToken, zone) => {
    if (hasAnimalIntelligence(targetToken.actor)) {
      return {
        targetToken,
        status: "ignored",
        label: "Intelligence animale ou inférieure : non affecté",
        modifier: 0,
        rolls: []
      };
    }

    const save = await globalThis.add2eRollSavingThrow(targetToken.actor, 4, {
      source: "spell:amitie",
      sourceItem,
      caster,
      targetToken,
      frontale: true,
      createChat: false,
      showDice: true
    });
    if (!save?.ok) {
      return {
        targetToken,
        status: "manual",
        label: "Sauvegarde contre les sortilèges indisponible",
        modifier: 0,
        save,
        rolls: [save?.roll].filter(Boolean)
      };
    }

    const modifierRoll = await new Roll(save.success ? "1d4" : "2d4").evaluate();
    const modifierValue = (save.success ? -1 : 1) * Math.max(1, Math.trunc(number(modifierRoll.total, 1)));
    const effectData = buildReactionEffect(targetToken, modifierValue, save, zone);
    await applyEffect(targetToken, effectData);

    return {
      targetToken,
      status: save.success ? "resisted" : "affected",
      label: save.success ? "Résiste et s’irrite" : "Impression favorable",
      modifier: modifierValue,
      save,
      modifierRoll,
      rolls: [save.roll, modifierRoll].filter(Boolean)
    };
  };

  const requestId = randomId();
  const zone = await chooseZone(requestId);
  if (!zone) return false;

  const results = [];
  for (const targetToken of targetsInZone(zone)) {
    results.push(await resolveTarget(targetToken, zone));
  }

  const area = sceneArea();
  const rows = [
    { label: "Zone", value: `${areaDiameterInches}\" AD&D de diamètre` },
    { label: "Durée", value: `${durationRounds} round${durationRounds > 1 ? "s" : ""}` },
    ...results.map(result => ({
      label: result.targetToken?.name ?? result.targetToken?.actor?.name ?? "Créature",
      value: result.modifier
        ? `${result.label} (${signed(result.modifier)})`
        : result.label
    })),
    { label: "Réaction contextuelle", value: "Cibler une créature puis utiliser le bouton Réaction de la ligne Charisme." }
  ];
  if (!results.length) rows.splice(2, 0, { label: "Créatures affectées", value: "Aucune" });

  const card = {
    actor: caster,
    title: sourceItem.name || CONFIG.name,
    icon: "fas fa-face-smile",
    variant: results.some(result => result.status === "affected") ? "success" : "neutral",
    source: {
      name: caster.name,
      img: casterToken?.document?.texture?.src ?? caster.img,
      type: `Magicien niveau ${casterLevel}`
    },
    rows,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls: results.flatMap(result => result.rolls ?? []),
      flags: {
        add2e: {
          chatCardType: "spell-amitie-reaction",
          charismaConsumerVersion: VERSION,
          spellKey: CONFIG.slug,
          sourceItemUuid: sourceItem.uuid,
          casterUuid: caster.uuid,
          casterLevel,
          durationRounds,
          areaDiameterInches,
          areaDiameterMeters: number(area.diameterMeters),
          templateRequestId: zone.templateRequestId,
          templateId: null,
          results: results.map(result => ({
            targetActorUuid: result.targetToken?.actor?.uuid ?? null,
            targetTokenId: result.targetToken?.id ?? null,
            status: result.status,
            modifier: result.modifier,
            saveSuccess: result.save?.success ?? null,
            saveTotal: result.save?.total ?? null,
            saveTarget: result.save?.target ?? null
          }))
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(card);
  await globalThis.add2eCreateChatCard(card);

  console.log(`${TAG}[DONE]`, {
    actor: caster.name,
    casterLevel,
    targetCount: results.length,
    results: results.map(result => ({
      target: result.targetToken?.name,
      status: result.status,
      modifier: result.modifier
    }))
  });
  return true;
})();

return __add2eOnUseResult;
