// ADD2E — onUse Magicien : Nuage puant
// Version : 2026-07-23-canonical-save-executor-v9
// Contrat : return true = sort consommé ; return false = sort non consommé.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][NUAGE_PUANT]";
  const SPELL = {
    name: "Nuage puant",
    slug: "nuage_puant",
    level: 2,
    school: "Évocation",
    rangeText: "30 m",
    areaText: "cube de 6 m d’arête",
    saveText: "Poison, annule",
    castingTimeText: "2 segments",
    componentsText: "V, S, M",
    rangeMeters: 30,
    radiusMeters: 3,
    vfxLoopMs: 2800,
    vfxChunkMs: 3600,
    imgFallback: "systems/add2e/assets/icones/sorts/nuage-puant.webp",
    description: "Ce sort crée une masse de vapeurs nauséabondes qui rend les créatures présentes incapables d’agir normalement si elles ratent leur jet de protection contre le poison. Les créatures affectées chancellent, sont prises de nausées et ne peuvent pas attaquer tant qu’elles restent dans le nuage et pendant un court temps après en être sorties. Le nuage dérive selon le vent et peut être dissipé par un vent fort."
  };

  const num = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
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

  function casterLevel() {
    const details = caster?.system?.details_classe ?? {};
    const byClass = num(details.magicien?.niveau ?? details.mage?.niveau ?? details.illusionniste?.niveau, 0);
    if (byClass > 0) return byClass;
    const classItem = caster?.items?.find?.(entry =>
      String(entry.type).toLowerCase() === "classe"
      && /magicien|mage|illusionniste/i.test(entry.name ?? "")
    );
    return Math.max(1, num(
      classItem?.system?.niveau
        ?? classItem?.system?.level
        ?? caster?.system?.niveau
        ?? caster?.system?.level
        ?? caster?.system?.details?.niveau,
      1
    ));
  }

  function gridData() {
    const grid = canvas.scene?.grid ?? canvas.grid ?? {};
    const raw = num(grid.distance, 0);
    return {
      raw: raw > 0 ? raw : 1,
      units: String(grid.units ?? "").trim().toLowerCase()
    };
  }

  function metersPerGridCell() {
    const { raw, units } = gridData();
    if (/^(m|meter|meters|metre|metres|mètre|mètres)$/.test(units)) return raw;
    if (/^(ft|feet|foot|pied|pieds)$/.test(units)) return raw * 0.3048;
    if (raw > 1) return raw;
    return 1.5;
  }

  const gridSizePx = () => canvas.grid?.size || canvas.dimensions?.size || 100;
  const metersToPx = meters => (meters / metersPerGridCell()) * gridSizePx();
  const pxDistanceMeters = (from, to) =>
    Math.hypot((to.x ?? 0) - (from.x ?? 0), (to.y ?? 0) - (from.y ?? 0))
    / gridSizePx()
    * metersPerGridCell();

  function browserEventToCanvasPoint(event) {
    const view = canvas.app?.view;
    const renderer = canvas.app?.renderer;
    if (!view || !renderer || typeof PIXI === "undefined") return null;
    const rect = view.getBoundingClientRect();
    const scaleX = renderer.screen?.width ? renderer.screen.width / rect.width : 1;
    const scaleY = renderer.screen?.height ? renderer.screen.height / rect.height : 1;
    const point = new PIXI.Point(
      (event.clientX - rect.left) * scaleX,
      (event.clientY - rect.top) * scaleY
    );
    return canvas.stage?.worldTransform?.applyInverse(point) ?? null;
  }

  function resetRuler() {
    try { canvas.controls?.ruler?.reset?.(); } catch (_error) {}
  }

  function parentLayer() {
    return canvas.interface ?? canvas.controls ?? canvas.stage;
  }

  async function deleteOldTechnicalZones() {
    const scene = canvas.scene;
    if (!scene) return;
    if (game.user.isGM) {
      const templateIds = Array.from(scene.templates ?? [])
        .filter(template => template.flags?.add2e?.spell === SPELL.slug)
        .map(template => template.id)
        .filter(Boolean);
      if (templateIds.length) await scene.deleteEmbeddedDocuments("MeasuredTemplate", templateIds);

      const drawingIds = Array.from(scene.drawings ?? [])
        .filter(drawing => drawing.flags?.add2e?.spell === SPELL.slug)
        .map(drawing => drawing.id)
        .filter(Boolean);
      if (drawingIds.length) await scene.deleteEmbeddedDocuments("Drawing", drawingIds);
      return;
    }

    game.socket?.emit?.("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation: "deleteMeasuredTemplates",
      payload: { sceneId: scene.id, spell: SPELL.slug }
    });
  }

  function drawPlacementMarker(graphics, point, valid) {
    graphics.clear();
    const color = valid ? 0x7aa85c : 0xb33a3a;
    graphics.lineStyle(3, color, 0.95);
    graphics.moveTo(point.x - 10, point.y);
    graphics.lineTo(point.x + 10, point.y);
    graphics.moveTo(point.x, point.y - 10);
    graphics.lineTo(point.x, point.y + 10);
    graphics.beginFill(color, 0.55);
    graphics.drawCircle(point.x, point.y, 4);
    graphics.endFill();
  }

  async function waitForPlacement() {
    const view = canvas.app?.view;
    const parent = parentLayer();
    if (!view || !parent || typeof PIXI === "undefined") return null;

    resetRuler();
    const previous = parent.getChildByName?.("add2e-nuage-puant-placement-marker");
    if (previous) previous.destroy({ children: true });

    const graphics = new PIXI.Graphics();
    graphics.name = "add2e-nuage-puant-placement-marker";
    graphics.zIndex = 100000;
    graphics.eventMode = "none";
    parent.sortableChildren = true;
    parent.addChild(graphics);

    const origin = casterToken.center ?? {
      x: casterToken.document.x,
      y: casterToken.document.y
    };
    let current = { ...origin };
    let valid = true;
    const oldCursor = view.style.cursor;
    view.style.cursor = "crosshair";
    ui.notifications.info(`${SPELL.name} : place le centre du nuage, clic gauche pour valider, clic droit ou Échap pour annuler.`);

    return await new Promise(resolve => {
      let done = false;
      const cleanup = result => {
        if (done) return;
        done = true;
        view.removeEventListener("mousemove", onMove, true);
        view.removeEventListener("mousedown", onDown, true);
        view.removeEventListener("contextmenu", onContext, true);
        window.removeEventListener("keydown", onKey, true);
        view.style.cursor = oldCursor;
        resetRuler();
        if (!graphics.destroyed) graphics.destroy({ children: true });
        resolve(result);
      };
      const update = event => {
        const point = browserEventToCanvasPoint(event);
        if (!point) return;
        current = point;
        valid = pxDistanceMeters(origin, current) <= SPELL.rangeMeters + 0.001;
        drawPlacementMarker(graphics, current, valid);
      };
      function onMove(event) { update(event); }
      function onDown(event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.button === 2) return cleanup(null);
        if (event.button !== 0) return;
        update(event);
        if (!valid) {
          ui.notifications.warn(`${SPELL.name} : point d’impact hors portée.`);
          return;
        }
        cleanup({ point: current });
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

      drawPlacementMarker(graphics, current, valid);
      view.addEventListener("mousemove", onMove, true);
      view.addEventListener("mousedown", onDown, true);
      view.addEventListener("contextmenu", onContext, true);
      window.addEventListener("keydown", onKey, true);
    });
  }

  function tokenSamplePoints(tokenPlaceable) {
    const x = tokenPlaceable.document.x;
    const y = tokenPlaceable.document.y;
    const width = tokenPlaceable.w ?? ((tokenPlaceable.document.width || 1) * gridSizePx());
    const height = tokenPlaceable.h ?? ((tokenPlaceable.document.height || 1) * gridSizePx());
    return [
      { x: x + width / 2, y: y + height / 2 },
      { x, y },
      { x: x + width, y },
      { x, y: y + height },
      { x: x + width, y: y + height },
      { x: x + width / 2, y },
      { x: x + width / 2, y: y + height },
      { x, y: y + height / 2 },
      { x: x + width, y: y + height / 2 }
    ];
  }

  function tokensInCircle(center) {
    const radiusPx = metersToPx(SPELL.radiusMeters);
    return canvas.tokens.placeables
      .filter(entry => entry.visible && entry.actor && entry.id !== casterToken.id && entry.actor.id !== caster?.id)
      .filter(entry => tokenSamplePoints(entry).some(point =>
        Math.hypot(point.x - center.x, point.y - center.y) <= radiusPx
      ));
  }

  async function createZoneControllerEffect(point, durationRounds) {
    const oldEffects = caster.effects?.filter?.(effect =>
      effect.flags?.add2e?.spell === SPELL.slug
      && effect.flags?.add2e?.zoneController === true
    ) ?? [];
    for (const effect of oldEffects) await effect.delete();

    const requestId = foundry.utils.randomID();
    const created = await caster.createEmbeddedDocuments("ActiveEffect", [{
      name: `${SPELL.name} — zone active`,
      img: sourceItem?.img || SPELL.imgFallback,
      disabled: false,
      transfer: false,
      type: "base",
      system: {},
      changes: [],
      duration: {
        rounds: durationRounds,
        startRound: game.combat?.round ?? null,
        startTime: game.time?.worldTime ?? null,
        combat: game.combat?.id ?? null
      },
      description: "Contrôle la durée visuelle du nuage. Supprimer cet effet arrête l’animation.",
      flags: {
        add2e: {
          spell: SPELL.slug,
          zoneController: true,
          requestId,
          sceneId: canvas.scene?.id ?? null,
          x: point.x,
          y: point.y,
          radiusMeters: SPELL.radiusMeters
        }
      }
    }]);
    return created?.[0] ?? null;
  }

  function isControllerActive(effectId) {
    const effect = caster?.effects?.get?.(effectId);
    if (!effect || effect.disabled) return false;
    const remaining = effect.duration?.remaining;
    return remaining === undefined || remaining === null || Number(remaining) > 0;
  }

  async function playOneJb2aFog(point) {
    if (typeof Sequence === "undefined") return false;
    const radiusPx = metersToPx(SPELL.radiusMeters);
    const files = [
      "jb2a.fog_cloud.02.green",
      "jb2a.fog_cloud.01.green",
      "jb2a.smoke.puff.centered.green",
      "jb2a.smoke.puff.centered.grey"
    ];

    for (const file of files) {
      try {
        const sequence = new Sequence();
        let effect = sequence
          .effect()
          .file(file)
          .atLocation(point)
          .duration(SPELL.vfxChunkMs)
          .fadeIn(300)
          .fadeOut(550)
          .opacity(0.85)
          .belowTokens();
        if (typeof effect.scaleToObject === "function") {
          effect = effect.scaleToObject(Math.max(2, radiusPx / gridSizePx()));
        } else if (typeof effect.scale === "function") {
          effect = effect.scale(Math.max(1.2, radiusPx / gridSizePx()));
        }
        await sequence.play();
        return true;
      } catch (_error) {}
    }
    return false;
  }

  function playOnePixiFog(point, durationMs = 3600) {
    const parent = parentLayer();
    if (!parent || typeof PIXI === "undefined") return false;

    const radius = metersToPx(SPELL.radiusMeters);
    const container = new PIXI.Container();
    container.name = `add2e-nuage-puant-cloud-vfx-${foundry.utils.randomID()}`;
    container.zIndex = 99999;
    container.eventMode = "none";
    container.alpha = 0.95;
    parent.sortableChildren = true;
    parent.addChild(container);

    const puffs = [];
    for (let index = 0; index < 18; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * radius * 0.82;
      const size = radius * (0.18 + Math.random() * 0.34);
      const graphics = new PIXI.Graphics();
      const colors = [0x6f9f45, 0x8fbf64, 0x4f7f3a, 0x9fbf72, 0xb2c98a];
      const color = colors[Math.floor(Math.random() * colors.length)];
      graphics.beginFill(color, 0.15 + Math.random() * 0.16);
      graphics.drawCircle(0, 0, size);
      graphics.endFill();
      graphics.x = point.x + Math.cos(angle) * distance;
      graphics.y = point.y + Math.sin(angle) * distance;
      container.addChild(graphics);
      puffs.push({
        graphics,
        baseX: graphics.x,
        baseY: graphics.y,
        speed: 0.0012 + Math.random() * 0.0022,
        drift: 7 + Math.random() * 18,
        phase: Math.random() * Math.PI * 2
      });
    }

    const started = performance.now();
    const ticker = canvas.app?.ticker;
    const animate = () => {
      const elapsed = performance.now() - started;
      const life = Math.min(1, elapsed / durationMs);
      container.alpha = life < 0.12
        ? life / 0.12
        : life > 0.78
          ? Math.max(0, (1 - life) / 0.22)
          : 1;

      for (const puff of puffs) {
        const time = elapsed * puff.speed + puff.phase;
        puff.graphics.x = puff.baseX + Math.cos(time) * puff.drift;
        puff.graphics.y = puff.baseY + Math.sin(time * 0.85) * puff.drift;
        puff.graphics.scale.set(1 + Math.sin(time * 1.7) * 0.07);
      }

      if (elapsed >= durationMs) {
        ticker?.remove?.(animate);
        if (!container.destroyed) container.destroy({ children: true });
      }
    };

    ticker?.add?.(animate);
    window.setTimeout(() => {
      ticker?.remove?.(animate);
      if (!container.destroyed) container.destroy({ children: true });
    }, durationMs + 750);
    return true;
  }

  function startLoopingCloudVfx(point, controllerEffect) {
    const effectId = controllerEffect?.id;
    if (!effectId) return;

    const loopKey = `add2eNuagePuantLoop_${effectId}`;
    globalThis.ADD2E_ACTIVE_SPELL_VFX ??= {};
    if (globalThis.ADD2E_ACTIVE_SPELL_VFX[loopKey]) {
      clearInterval(globalThis.ADD2E_ACTIVE_SPELL_VFX[loopKey]);
    }

    const tick = async () => {
      if (!isControllerActive(effectId)) {
        const intervalId = globalThis.ADD2E_ACTIVE_SPELL_VFX?.[loopKey];
        if (intervalId) clearInterval(intervalId);
        delete globalThis.ADD2E_ACTIVE_SPELL_VFX?.[loopKey];
        return;
      }
      const jb2aOk = await playOneJb2aFog(point);
      if (!jb2aOk) playOnePixiFog(point, SPELL.vfxChunkMs);
    };

    void tick();
    globalThis.ADD2E_ACTIVE_SPELL_VFX[loopKey] = setInterval(() => void tick(), SPELL.vfxLoopMs);
  }

  async function applyNausea(targetActor, durationRounds) {
    if (!targetActor) return false;
    const existing = targetActor.effects?.filter?.(effect =>
      effect.flags?.add2e?.spell === SPELL.slug
      && effect.flags?.add2e?.zoneController !== true
    ) ?? [];
    for (const effect of existing) await effect.delete();

    await targetActor.createEmbeddedDocuments("ActiveEffect", [{
      name: `${SPELL.name} — nausée`,
      img: sourceItem?.img || SPELL.imgFallback,
      disabled: false,
      transfer: false,
      type: "base",
      system: {},
      changes: [],
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
          tags: [
            "classe:magicien",
            "liste:magicien",
            "niveau:2",
            "sort:nuage_puant",
            "type:condition",
            "etat:nausee",
            "zone:nuage"
          ]
        }
      }
    }]);
    return true;
  }

  async function createChat(rows, durationRounds, level) {
    if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
      throw new Error("Le constructeur commun des cartes de chat ADD2E est indisponible.");
    }

    const results = rows.length
      ? rows.map(row => `${row.name} : ${row.save.d20}${row.save.bonus ? ` ${row.save.bonus >= 0 ? "+" : ""}${row.save.bonus}` : ""} = ${row.save.total} / ${row.save.target} — ${row.save.success ? "Résiste" : "Nausée"}`).join(" ; ")
      : "Aucune créature détectée dans le nuage.";

    const options = {
      actor: caster,
      title: SPELL.name,
      icon: "fas fa-smog",
      variant: "spell",
      source: {
        name: caster?.name ?? casterToken?.name ?? "Magicien",
        img: casterToken?.document?.texture?.src ?? caster?.img ?? "icons/svg/mystery-man.svg",
        type: `Magicien niveau ${level}`,
        meta: SPELL.school
      },
      rows: [
        { label: "Portée", value: SPELL.rangeText },
        { label: "Zone", value: SPELL.areaText },
        { label: "Durée", value: `${durationRounds} round${durationRounds > 1 ? "s" : ""}` },
        { label: "Sauvegarde", value: "Poison — réussite : effet annulé" },
        { label: "Résultats", value: results }
      ],
      message: SPELL.description,
      chatData: {
        speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
        rolls: rows.map(row => row.save.roll).filter(Boolean),
        flags: {
          add2e: {
            spell: SPELL.slug,
            sourceItemUuid: sourceItem?.uuid ?? null,
            saveResolverVersion: globalThis.ADD2E_SAVE_RESOLVER_VERSION ?? null,
            saveResults: rows.map(row => ({
              actorUuid: row.actorUuid,
              saveType: row.save.resolution?.key ?? "mort_paralysie",
              d20: row.save.d20,
              bonus: row.save.bonus,
              total: row.save.total,
              target: row.save.target,
              success: row.save.success,
              state: row.save.success ? "resiste" : "nausee"
            }))
          }
        }
      }
    };

    const preview = globalThis.add2eBuildChatCard(options);
    if (!String(preview ?? "").trim()) throw new Error("Nuage puant : carte de chat vide.");
    return globalThis.add2eCreateChatCard(options);
  }

  if (!sourceItem || !caster || !casterToken) {
    ui.notifications.warn(`${SPELL.name} : lanceur ou sort introuvable.`);
    return false;
  }
  if (typeof globalThis.add2eRollSavingThrow !== "function") {
    ui.notifications.error(`${SPELL.name} : l’exécuteur canonique de sauvegardes est indisponible.`);
    return false;
  }

  await deleteOldTechnicalZones();
  const level = casterLevel();
  const durationRounds = Math.max(1, level);
  const placement = await waitForPlacement();
  if (!placement?.point) {
    ui.notifications.info(`${SPELL.name} : lancement annulé.`);
    return false;
  }

  const targets = tokensInCircle(placement.point);
  const prepared = [];
  for (const targetToken of targets) {
    const save = await globalThis.add2eRollSavingThrow(targetToken.actor, 0, {
      source: `spell:${SPELL.slug}`,
      sourceItem,
      caster,
      casterLevel: level,
      targetToken,
      frontale: true,
      createChat: false,
      showDice: true
    });
    if (!save?.ok) {
      ui.notifications.error(`${SPELL.name} : aucune sauvegarde contre le poison pour ${targetToken.actor?.name ?? "la cible"}.`);
      return false;
    }
    prepared.push({ targetToken, save });
  }

  await deleteOldTechnicalZones();
  const controller = await createZoneControllerEffect(placement.point, durationRounds);
  startLoopingCloudVfx(placement.point, controller);

  const rows = [];
  for (const { targetToken, save } of prepared) {
    if (!save.success) await applyNausea(targetToken.actor, durationRounds);
    rows.push({
      name: targetToken.name,
      actorUuid: targetToken.actor.uuid,
      save
    });
  }

  await createChat(rows, durationRounds, level);
  console.log(`${TAG}[DONE]`, { caster: caster.name, level, durationRounds, targets: rows });
  return true;
})();