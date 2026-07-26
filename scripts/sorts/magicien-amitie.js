/**
 * ADD2E — Amitié
 * Magicien niveau 1 — sauvegarde, zone et réaction sociale canoniques.
 * Compatible Foundry V13/V14/V15 — aucune fenêtre legacy.
 * Contrat onUse : true = sort consommé ; false = sort non consommé.
 */

const __add2eOnUseResult = await (async () => {
  const VERSION = "2026-07-26-canonical-reaction-v3";
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

  const effectsEngine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
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

  const casterLevel = Math.max(1, Math.trunc(number(
    globalThis.add2eSpellClassLevel?.(caster, { sourceItem })
      ?? Array.from(caster.items ?? []).find(entry => String(entry?.type ?? "").toLowerCase() === "classe" && /magicien/i.test(String(entry?.name ?? "")))?.system?.niveau
      ?? caster.system?.niveau
      ?? caster.system?.level,
    1
  )));
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

  const canvasPosition = event => {
    try {
      const point = event?.data?.getLocalPosition?.(canvas.stage)
        ?? event?.getLocalPosition?.(canvas.stage)
        ?? null;
      if (point) return { x: number(point.x), y: number(point.y) };
    } catch (_error) {}
    const original = event?.data?.originalEvent ?? event?.nativeEvent ?? event;
    const rect = canvas.app?.view?.getBoundingClientRect?.();
    if (!original || !rect) return null;
    return {
      x: ((original.clientX - rect.left) / rect.width) * canvas.dimensions.width,
      y: ((original.clientY - rect.top) / rect.height) * canvas.dimensions.height
    };
  };

  const emitGmOperation = (operation, payload) => {
    game.socket.emit("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation,
      payload
    });
  };

  const buildTemplateData = (center, requestId) => {
    const area = sceneArea();
    return {
      t: "circle",
      user: game.user.id,
      x: number(center.x),
      y: number(center.y),
      distance: number(area.sceneDistance),
      direction: 0,
      fillColor: "#b36bff",
      borderColor: "#fff2a8",
      flags: {
        add2e: {
          spell: CONFIG.slug,
          spellName: CONFIG.name,
          templateRequestId: requestId,
          areaMeasure: CONFIG.areaMeasure,
          areaDiameterInches,
          areaUnit: CONFIG.areaUnit,
          areaUsage: CONFIG.areaUsage,
          areaDiameterMeters: number(area.diameterMeters),
          areaDiameterSceneDistance: number(area.diameterSceneDistance),
          areaDiameterSceneUnit: area.sceneUnit,
          areaDiameterGridCells: number(area.diameterGridCells),
          areaRadiusMeters: number(area.radiusMeters),
          areaRadiusSceneDistance: number(area.radiusSceneDistance),
          areaRadiusGridCells: number(area.radiusGridCells),
          casterId: caster.id,
          casterUuid: caster.uuid,
          sourceItemId: sourceItem.id,
          sourceItemUuid: sourceItem.uuid
        }
      }
    };
  };

  const createPreview = async (center, requestId) => {
    const TemplateDocument = CONFIG.MeasuredTemplate?.documentClass ?? globalThis.CONFIG?.MeasuredTemplate?.documentClass;
    const TemplateObject = CONFIG.MeasuredTemplate?.objectClass ?? globalThis.CONFIG?.MeasuredTemplate?.objectClass;
    if (!TemplateDocument || !TemplateObject || !canvas.templates) return null;
    const document = new TemplateDocument(buildTemplateData(center, requestId), { parent: canvas.scene });
    const template = new TemplateObject(document);
    const layer = canvas.templates.preview ?? canvas.templates;
    await template.draw();
    layer.addChild(template);
    template.refresh?.();
    return template;
  };

  const persistTemplate = async (templateData, preview, requestId) => {
    try {
      const created = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [clone(templateData)]);
      preview?.destroy?.({ children: true });
      return { templateId: created?.[0]?.id ?? null, via: "direct" };
    } catch (error) {
      console.warn(`${TAG}[TEMPLATE_RELAY]`, error);
      emitGmOperation("createMeasuredTemplate", {
        sceneId: canvas.scene?.id ?? null,
        templateData,
        templateRequestId: requestId,
        spell: CONFIG.slug,
        spellName: CONFIG.name
      });
      setTimeout(() => preview?.destroy?.({ children: true }), 1500);
      return { templateId: null, via: "gm-relay" };
    }
  };

  const chooseZone = async requestId => {
    if (!canvas.ready || !canvas.stage || !canvas.templates || !canvas.scene) {
      ui.notifications.warn("Amitié : scène ou canevas indisponible.");
      return null;
    }
    const initial = casterToken
      ? tokenCenter(casterToken)
      : { x: canvas.dimensions.width / 2, y: canvas.dimensions.height / 2 };
    const preview = await createPreview(initial, requestId);
    const view = canvas.app?.view;
    const previousCursor = view?.style?.cursor ?? "";
    if (view?.style) view.style.cursor = "crosshair";
    canvas.templates.activate?.();
    ui.notifications.info("Amitié : cliquez sur la scène pour placer la zone, clic droit pour annuler.");

    return new Promise(resolve => {
      let finished = false;
      let current = { ...initial };
      const cleanup = () => {
        canvas.stage.off("mousemove", onMove);
        canvas.stage.off("mousedown", onConfirm);
        canvas.stage.off("rightdown", onCancel);
        if (view?.style) view.style.cursor = previousCursor;
      };
      const refresh = position => {
        if (!position) return;
        current = { x: number(position.x), y: number(position.y) };
        preview?.document?.updateSource?.(current);
        preview?.refresh?.();
      };
      const finish = async position => {
        if (finished) return;
        finished = true;
        cleanup();
        if (!position) {
          preview?.destroy?.({ children: true });
          resolve(null);
          return;
        }
        const templateData = buildTemplateData(position, requestId);
        const persisted = await persistTemplate(templateData, preview, requestId);
        resolve({
          x: position.x,
          y: position.y,
          sceneId: canvas.scene.id,
          templateRequestId: requestId,
          templateId: persisted.templateId,
          templateVia: persisted.via
        });
      };
      const onMove = event => {
        event?.stopPropagation?.();
        refresh(canvasPosition(event));
      };
      const onConfirm = event => {
        event?.stopPropagation?.();
        event?.data?.originalEvent?.preventDefault?.();
        refresh(canvasPosition(event) ?? current);
        void finish(current);
      };
      const onCancel = event => {
        event?.stopPropagation?.();
        event?.data?.originalEvent?.preventDefault?.();
        void finish(null);
      };
      canvas.stage.on("mousemove", onMove);
      canvas.stage.once("mousedown", onConfirm);
      canvas.stage.once("rightdown", onCancel);
      refresh(initial);
    });
  };

  const deleteTemplate = async zone => {
    if (!zone?.templateRequestId) return;
    const ids = Array.from(canvas.scene?.templates ?? [])
      .filter(template => template.id === zone.templateId || template.flags?.add2e?.templateRequestId === zone.templateRequestId)
      .map(template => template.id)
      .filter(Boolean);
    if (game.user.isGM && ids.length) {
      await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", ids);
      return;
    }
    emitGmOperation("deleteMeasuredTemplates", {
      sceneId: zone.sceneId,
      templateId: zone.templateId,
      templateRequestId: zone.templateRequestId,
      spell: CONFIG.slug,
      reason: "targets-resolved"
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
            templateId: zone.templateId,
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
  try {
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
            templateId: zone.templateId,
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
  } finally {
    try {
      await deleteTemplate(zone);
    } finally {
      canvas.tokens?.activate?.();
    }
  }

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
