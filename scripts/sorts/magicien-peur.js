// ADD2E — onUse Magicien : Peur
// Version : 2026-07-24-canonical-mental-save-cone-v3
// Compatible Foundry V13/V14/V15.
// Contrat : return true = sort consommé ; return false = sort non consommé.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][PEUR]";
  const SPELL = {
    name: "Peur",
    slug: "peur",
    level: 2,
    school: "Illusion/Fantasme",
    rangeText: "0",
    areaText: "cône de peur devant le lanceur",
    saveText: "Annule",
    castingTimeText: "2 segments",
    componentsText: "V, S, M",
    coneDistanceMeters: 18,
    coneAngle: 60,
    imgFallback: "systems/add2e/assets/icones/sorts/peur.webp",
    description: "Les créatures prises dans la zone doivent réussir une sauvegarde contre les sortilèges ou fuir le lanceur aussi vite que possible."
  };

  const number = (value, fallback = 0) => {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  };
  const sourceItem = (() => {
    if (typeof item !== "undefined" && item) return item;
    if (typeof sort !== "undefined" && sort) return sort;
    if (typeof spell !== "undefined" && spell) return spell;
    if (typeof args !== "undefined" && args?.[0]?.item) return args[0].item;
    return null;
  })();
  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem?.parent;
  const casterToken = (() => {
    if (typeof token !== "undefined" && token?.actor?.id === caster?.id) return token;
    return canvas.tokens?.controlled?.find(entry => entry.actor?.id === caster?.id)
      ?? caster?.getActiveTokens?.()[0]
      ?? canvas.tokens?.controlled?.[0]
      ?? null;
  })();

  const refund = async reason => {
    if (reason) ui.notifications.warn(reason);
    try {
      if (sourceItem?.type === "sort") return;
      const globalCharges = await sourceItem?.getFlag?.("add2e", "global_charges");
      if (globalCharges !== undefined) {
        await sourceItem.setFlag("add2e", "global_charges", Number(globalCharges) + 1);
        ui.notifications.info(`Charge restituée à ${sourceItem.name}.`);
        return;
      }
      if (sourceItem?.system?.isPower && sourceItem.system.sourceWeaponId) {
        const parentItem = caster?.items?.get(sourceItem.system.sourceWeaponId);
        const index = sourceItem.system.powerIndex;
        const charges = await parentItem?.getFlag?.("add2e", `charges_${index}`);
        if (parentItem && charges !== undefined) {
          await parentItem.setFlag("add2e", `charges_${index}`, Number(charges) + 1);
          ui.notifications.info("Charge restituée.");
        }
      }
    } catch (error) {
      console.warn(`${TAG}[REFUND_FAILED]`, error);
    }
  };

  if (!sourceItem || !caster || !casterToken) {
    ui.notifications.warn(`${SPELL.name} : lanceur ou sort introuvable.`);
    return false;
  }
  if (typeof globalThis.add2eRollSavingThrow !== "function") {
    await refund(`${SPELL.name} : l’exécuteur canonique de sauvegardes est indisponible.`);
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    await refund(`${SPELL.name} : le constructeur commun des cartes de chat est indisponible.`);
    return false;
  }

  const casterLevel = () => {
    const details = caster?.system?.details_classe ?? {};
    const byClass = number(details.magicien?.niveau ?? details.mage?.niveau ?? details.illusionniste?.niveau, 0);
    if (byClass > 0) return byClass;
    const classItem = caster?.items?.find?.(entry =>
      String(entry.type).toLowerCase() === "classe" && /magicien|mage|illusionniste/i.test(entry.name ?? "")
    );
    return Math.max(1, number(
      classItem?.system?.niveau
        ?? classItem?.system?.level
        ?? caster?.system?.niveau
        ?? caster?.system?.level
        ?? caster?.system?.details?.niveau,
      1
    ));
  };

  const metersPerGridCell = () => {
    const grid = canvas.scene?.grid ?? canvas.grid;
    const raw = number(grid?.distance, 0);
    const units = String(grid?.units ?? "").trim().toLowerCase();
    if (raw > 0 && /^(m|meter|meters|metre|metres|mètre|mètres)$/.test(units)) return raw;
    if (raw > 0 && /^(ft|feet|foot|pied|pieds)$/.test(units)) return raw * 0.3048;
    if (raw > 1) return raw;
    return 1.5;
  };
  const gridSizePx = () => canvas.grid?.size || canvas.dimensions?.size || 100;
  const metersToPx = meters => (meters / metersPerGridCell()) * gridSizePx();
  const browserEventToCanvasPoint = event => {
    const view = canvas.app?.view;
    const renderer = canvas.app?.renderer;
    if (!view || !renderer || typeof PIXI === "undefined") return null;
    const rect = view.getBoundingClientRect();
    const scaleX = renderer.screen?.width ? renderer.screen.width / rect.width : 1;
    const scaleY = renderer.screen?.height ? renderer.screen.height / rect.height : 1;
    const global = new PIXI.Point(
      (event.clientX - rect.left) * scaleX,
      (event.clientY - rect.top) * scaleY
    );
    return canvas.stage?.worldTransform?.applyInverse(global) ?? null;
  };
  const resetRuler = () => {
    try {
      canvas.controls?.ruler?.reset?.();
    } catch (_error) {}
  };
  const parentLayer = () => canvas.interface ?? canvas.controls ?? canvas.stage;
  const canvasRadiansToFoundryRotation = radians => (radians * 180 / Math.PI + 90 + 360) % 360;
  const foundryRotationToCanvasRadians = degrees => (number(degrees, 0) - 90) * Math.PI / 180;
  const angleDiffDegrees = (left, right) => Math.abs(((right - left + 540) % 360) - 180);

  const drawCone = (graphics, directionDegrees) => {
    const center = casterToken.center ?? { x: casterToken.document.x, y: casterToken.document.y };
    const radius = metersToPx(SPELL.coneDistanceMeters);
    const direction = foundryRotationToCanvasRadians(directionDegrees);
    const half = (SPELL.coneAngle / 2) * Math.PI / 180;
    const start = direction - half;
    const end = direction + half;
    graphics.clear();
    graphics.lineStyle(3, 0x8e63c7, 0.95);
    graphics.beginFill(0x6c31b5, 0.24);
    graphics.moveTo(center.x, center.y);
    graphics.arc(center.x, center.y, radius, start, end);
    graphics.lineTo(center.x, center.y);
    graphics.endFill();
    graphics.lineStyle(2, 0xd8c3ff, 0.9);
    graphics.moveTo(center.x, center.y);
    graphics.lineTo(center.x + Math.cos(start) * radius, center.y + Math.sin(start) * radius);
    graphics.moveTo(center.x, center.y);
    graphics.lineTo(center.x + Math.cos(end) * radius, center.y + Math.sin(end) * radius);
  };

  const waitForConePlacement = async () => {
    const view = canvas.app?.view;
    const parent = parentLayer();
    if (!view || !parent || typeof PIXI === "undefined") return null;
    resetRuler();
    const previous = parent.getChildByName?.("add2e-peur-cone");
    if (previous) previous.destroy({ children: true });
    const graphics = new PIXI.Graphics();
    graphics.name = "add2e-peur-cone";
    graphics.zIndex = 100000;
    graphics.eventMode = "none";
    parent.sortableChildren = true;
    parent.addChild(graphics);

    const center = casterToken.center ?? { x: casterToken.document.x, y: casterToken.document.y };
    let direction = number(casterToken.document?.rotation, 0);
    const oldCursor = view.style.cursor;
    view.style.cursor = "crosshair";
    ui.notifications.info(`${SPELL.name} : oriente le cône, clic gauche pour valider, clic droit ou Échap pour annuler.`);

    return new Promise(resolve => {
      let done = false;
      const cleanup = (result, keep = false) => {
        if (done) return;
        done = true;
        view.removeEventListener("mousemove", onMove, true);
        view.removeEventListener("mousedown", onDown, true);
        view.removeEventListener("contextmenu", onContext, true);
        window.removeEventListener("keydown", onKey, true);
        view.style.cursor = oldCursor;
        resetRuler();
        if (keep) {
          window.setTimeout(() => {
            if (!graphics.destroyed) graphics.destroy({ children: true });
            resetRuler();
          }, 6000);
        } else if (!graphics.destroyed) {
          graphics.destroy({ children: true });
        }
        resolve(result);
      };
      const update = event => {
        const point = browserEventToCanvasPoint(event);
        if (!point) return;
        direction = canvasRadiansToFoundryRotation(Math.atan2(point.y - center.y, point.x - center.x));
        drawCone(graphics, direction);
      };
      function onMove(event) { update(event); }
      function onDown(event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.button === 2) return cleanup(null);
        if (event.button !== 0) return;
        update(event);
        cleanup({ direction }, true);
      }
      function onContext(event) {
        event.preventDefault();
        event.stopPropagation();
        cleanup(null);
      }
      function onKey(event) {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        cleanup(null);
      }
      drawCone(graphics, direction);
      view.addEventListener("mousemove", onMove, true);
      view.addEventListener("mousedown", onDown, true);
      view.addEventListener("contextmenu", onContext, true);
      window.addEventListener("keydown", onKey, true);
    });
  };

  const tokenSamplePoints = target => {
    const x = target.document.x;
    const y = target.document.y;
    const width = target.w ?? ((target.document.width || 1) * gridSizePx());
    const height = target.h ?? ((target.document.height || 1) * gridSizePx());
    return [
      { x: x + width / 2, y: y + height / 2 },
      { x, y }, { x: x + width, y }, { x, y: y + height }, { x: x + width, y: y + height },
      { x: x + width / 2, y }, { x: x + width / 2, y: y + height },
      { x, y: y + height / 2 }, { x: x + width, y: y + height / 2 }
    ];
  };
  const bearingToPoint = point => {
    const center = casterToken.center ?? { x: casterToken.document.x, y: casterToken.document.y };
    return (Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI + 90 + 360) % 360;
  };
  const pointInCone = (point, direction) => {
    const center = casterToken.center ?? { x: casterToken.document.x, y: casterToken.document.y };
    const distance = Math.hypot(point.x - center.x, point.y - center.y);
    return distance <= metersToPx(SPELL.coneDistanceMeters)
      && angleDiffDegrees(direction, bearingToPoint(point)) <= SPELL.coneAngle / 2;
  };
  const tokensInCone = direction => canvas.tokens.placeables
    .filter(target => target.visible && target.actor && target.id !== casterToken.id && target.actor.id !== caster?.id)
    .filter(target => tokenSamplePoints(target).some(point => pointInCone(point, direction)));

  const playVfx = async direction => {
    if (typeof Sequence === "undefined") return;
    try {
      await new Sequence()
        .effect()
        .file("jb2a.fear.01.purple")
        .atLocation(casterToken)
        .rotate(direction)
        .duration(2500)
        .play();
    } catch (error) {
      console.warn(`${TAG}[VFX_SEQUENCE_FAILED]`, error);
    }
  };

  const applyFear = async (targetToken, durationRounds) => {
    const targetActor = targetToken.actor;
    const effectData = {
      name: `${SPELL.name} — effrayé`,
      img: sourceItem?.img || SPELL.imgFallback,
      disabled: false,
      transfer: false,
      duration: {
        rounds: durationRounds,
        startRound: game.combat?.round ?? null,
        startTime: game.time?.worldTime ?? null,
        combat: game.combat?.id ?? null
      },
      description: SPELL.description,
      flags: {
        add2e: {
          spell: SPELL.slug,
          sourceId: caster.id,
          sourceUuid: caster.uuid ?? null,
          sourceName: caster.name,
          tags: [
            "classe:magicien", "liste:magicien", "niveau:2", "sort:peur",
            "mental", "type:condition", "etat:peur", "fuite"
          ]
        }
      }
    };

    if (game.user.isGM || targetActor.isOwner) {
      const existing = targetActor.effects?.filter?.(effect => effect.flags?.add2e?.spell === SPELL.slug) ?? [];
      for (const effect of existing) await effect.delete();
      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return true;
    }
    if (game.socket) {
      game.socket.emit("system.add2e", {
        type: "applyActiveEffect",
        actorId: targetActor.id,
        actorUuid: targetActor.uuid,
        sceneId: canvas.scene?.id,
        tokenId: targetToken.id,
        effectData
      });
      return true;
    }
    ui.notifications.error(`Socket ADD2E indisponible : impossible d’appliquer ${SPELL.name}.`);
    return false;
  };

  const modifierDetails = save => {
    const applied = save?.resolution?.bonusResolution?.applied ?? [];
    return applied.length
      ? applied.map(entry => {
          const modifier = entry?.modifier ?? entry;
          const value = Number(modifier?.value) || 0;
          const label = modifier?.metadata?.label ?? modifier?.source?.name ?? "Modificateur";
          return `${label} ${value >= 0 ? "+" : ""}${value}`;
        }).join(" ; ")
      : "Aucun";
  };

  const createCard = async (results, durationRounds) => {
    const rows = results.length
      ? results.flatMap(result => [
          { label: result.targetToken.name, value: result.save.success ? "Résiste" : "Fuit" },
          { label: `${result.targetToken.name} · jet`, value: `d20 ${result.save.d20} ${result.save.bonus >= 0 ? "+" : ""}${result.save.bonus} = ${result.save.total} / ${result.save.target}` },
          { label: `${result.targetToken.name} · modificateurs`, value: modifierDetails(result.save) }
        ])
      : [{ label: "Cibles", value: "Aucune créature détectée dans le cône" }];
    rows.push({ label: "Durée", value: `${durationRounds} round${durationRounds > 1 ? "s" : ""}` });

    const options = {
      actor: caster,
      title: SPELL.name,
      icon: "fas fa-ghost",
      variant: results.some(result => !result.save.success) ? "failure" : "success",
      source: {
        name: caster.name,
        img: caster.img,
        type: SPELL.school,
        meta: "Attaque mentale · cône de 18 m"
      },
      rows,
      message: results.length
        ? `${results.filter(result => !result.save.success).length} cible(s) fuient ; ${results.filter(result => result.save.success).length} résistent.`
        : "Aucune créature n’est prise dans le cône.",
      chatData: {
        speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
        rolls: results.map(result => result.save.roll).filter(Boolean),
        flags: {
          add2e: {
            spell: SPELL.slug,
            sourceItemUuid: sourceItem.uuid,
            mentalAttack: true,
            saveType: "sorts",
            durationRounds,
            targetResults: results.map(result => ({
              tokenId: result.targetToken.id,
              actorUuid: result.targetToken.actor?.uuid ?? null,
              d20: result.save.d20,
              bonus: result.save.bonus,
              total: result.save.total,
              target: result.save.target,
              success: result.save.success,
              resolverVersion: result.save.version
            }))
          }
        }
      }
    };
    const preview = globalThis.add2eBuildChatCard(options);
    if (!String(preview ?? "").trim()) throw new Error(`${SPELL.name} : carte de chat vide.`);
    await globalThis.add2eCreateChatCard(options);
  };

  const level = casterLevel();
  const durationRounds = Math.max(1, level);
  const placement = await waitForConePlacement();
  if (!placement) {
    await refund(`${SPELL.name} : lancement annulé.`);
    return false;
  }

  await playVfx(placement.direction);
  const targets = tokensInCone(placement.direction);
  const results = [];
  for (const targetToken of targets) {
    const save = await globalThis.add2eRollSavingThrow(targetToken.actor, 4, {
      source: "spell:magicien_peur",
      sourceItem,
      caster,
      targetToken,
      frontale: true,
      mental: true,
      effectType: "peur",
      tags: ["mental", "peur", "effroi"],
      createChat: false,
      showDice: true
    });
    if (!save?.ok) {
      await refund(`${SPELL.name} : aucune sauvegarde contre les sortilèges pour ${targetToken.name}.`);
      return false;
    }
    results.push({ targetToken, save });
  }

  for (const result of results) {
    if (!result.save.success) {
      const applied = await applyFear(result.targetToken, durationRounds);
      if (!applied) return false;
    }
  }
  await createCard(results, durationRounds);
  return true;
})();