// ADD2E — onUse Magicien : Toile d’araignée
// Version : 2026-07-23-canonical-save-executor-v5
// Contrat : return true = sort consommé ; return false = sort non consommé.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][TOILE_ARAIGNEE]";
  const SPELL = {
    name: "Toile d’araignée",
    slug: "toile_d_araignee",
    level: 2,
    school: "Évocation",
    rangeText: "5 m/niveau",
    areaText: "cube de 3 m/niveau d’arête",
    saveText: "Spécial",
    castingTimeText: "2 segments",
    componentsText: "V, S, M",
    imgFallback: "systems/add2e/assets/icones/sorts/toile-d-araignee.webp",
    description: "Ce sort crée une masse de fils épais et collants semblables à une toile d’araignée. La toile doit s’accrocher à des points solides opposés, comme murs, arbres ou piliers, sinon elle s’effondre et disparaît. Les créatures prises dans la zone peuvent être immobilisées ou ralenties selon leur force et l’arbitrage du MD. Les fils sont inflammables et brûlent rapidement, ce qui peut blesser les créatures prises dedans."
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

  function metersPerGridCell() {
    const grid = canvas.scene?.grid ?? canvas.grid;
    const raw = num(grid?.distance, 0);
    const units = String(grid?.units ?? "").trim().toLowerCase();
    if (raw > 0 && /^(m|meter|meters|metre|metres|mètre|mètres)$/.test(units)) return raw;
    if (raw > 0 && /^(ft|feet|foot|pied|pieds)$/.test(units)) return raw * 0.3048;
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

  function drawSquare(graphics, center, sideMeters, valid) {
    const size = metersToPx(sideMeters);
    const x = center.x - size / 2;
    const y = center.y - size / 2;
    graphics.clear();
    graphics.lineStyle(3, valid ? 0xd8d8e8 : 0xb33a3a, 0.95);
    graphics.beginFill(0xe8e8ff, 0.25);
    graphics.drawRoundedRect(x, y, size, size, 8);
    graphics.endFill();
    graphics.lineStyle(1, 0xffffff, 0.85);
    const step = Math.max(8, size / 6);
    for (let offset = 0; offset <= size; offset += step) {
      graphics.moveTo(x + offset, y);
      graphics.lineTo(x + size - offset, y + size);
      graphics.moveTo(x, y + offset);
      graphics.lineTo(x + size, y + size - offset);
    }
  }

  async function waitForPlacement(level) {
    const view = canvas.app?.view;
    const parent = parentLayer();
    if (!view || !parent || typeof PIXI === "undefined") return null;

    resetRuler();
    const previous = parent.getChildByName?.("add2e-toile-araignee-zone-preview");
    if (previous) previous.destroy({ children: true });

    const graphics = new PIXI.Graphics();
    graphics.name = "add2e-toile-araignee-zone-preview";
    graphics.zIndex = 100000;
    graphics.eventMode = "none";
    parent.sortableChildren = true;
    parent.addChild(graphics);

    const origin = casterToken.center ?? {
      x: casterToken.document.x,
      y: casterToken.document.y
    };
    const rangeMeters = 5 * Math.max(1, level);
    const sideMeters = 3 * Math.max(1, level);
    let current = { ...origin };
    let valid = true;
    const oldCursor = view.style.cursor;
    view.style.cursor = "crosshair";
    ui.notifications.info(`${SPELL.name} : place le centre de la toile, clic gauche pour valider, clic droit ou Échap pour annuler.`);

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
        valid = pxDistanceMeters(origin, current) <= rangeMeters + 0.001;
        drawSquare(graphics, current, sideMeters, valid);
      };
      function onMove(event) { update(event); }
      function onDown(event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.button === 2) return cleanup(null);
        if (event.button !== 0) return;
        update(event);
        if (!valid) {
          ui.notifications.warn(`${SPELL.name} : point d’ancrage hors portée.`);
          return;
        }
        cleanup({ point: current, sideMeters, rangeMeters });
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

      drawSquare(graphics, current, sideMeters, valid);
      view.addEventListener("mousemove", onMove, true);
      view.addEventListener("mousedown", onDown, true);
      view.addEventListener("contextmenu", onContext, true);
      window.addEventListener("keydown", onKey, true);
    });
  }

  async function createSceneTemplate(point, sideMeters, durationRounds) {
    const requestId = foundry.utils.randomID();
    const templateData = {
      t: "rect",
      user: game.user.id,
      x: point.x,
      y: point.y,
      direction: 0,
      distance: sideMeters,
      width: sideMeters,
      fillColor: "#d8d8e8",
      flags: {
        add2e: {
          spell: SPELL.slug,
          spellName: SPELL.name,
          templateRequestId: requestId,
          durationRounds
        }
      }
    };

    if (game.user.isGM) {
      await canvas.scene?.createEmbeddedDocuments?.("MeasuredTemplate", [templateData]);
      return;
    }
    game.socket?.emit?.("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation: "createMeasuredTemplate",
      payload: {
        sceneId: canvas.scene?.id,
        spell: SPELL.slug,
        spellName: SPELL.name,
        templateRequestId: requestId,
        templateData
      }
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

  function tokensInSquare(center, sideMeters) {
    const size = metersToPx(sideMeters);
    const left = center.x - size / 2;
    const top = center.y - size / 2;
    const right = center.x + size / 2;
    const bottom = center.y + size / 2;
    return canvas.tokens.placeables
      .filter(entry => entry.visible && entry.actor && entry.id !== casterToken.id && entry.actor.id !== caster?.id)
      .filter(entry => tokenSamplePoints(entry).some(point =>
        point.x >= left && point.x <= right && point.y >= top && point.y <= bottom
      ));
  }

  async function playVfx(point, sideMeters) {
    if (typeof Sequence === "undefined") return;
    try {
      await new Sequence()
        .effect()
        .file("jb2a.web.01.white")
        .atLocation(point)
        .scaleToObject?.(Math.max(1.5, sideMeters / 3))
        .duration(9000)
        .play();
    } catch (error) {
      console.warn(`${TAG}[VFX_SEQUENCE_FAILED]`, error);
    }
  }

  async function applyWebEffect(targetActor, state, durationRounds) {
    if (!targetActor || state === "free") return false;
    const existing = targetActor.effects?.filter?.(effect => effect.flags?.add2e?.spell === SPELL.slug) ?? [];
    for (const effect of existing) await effect.delete();
    const label = state === "trapped" ? "pris dans la toile" : "ralenti par la toile";
    await targetActor.createEmbeddedDocuments("ActiveEffect", [{
      name: `${SPELL.name} — ${label}`,
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
          state,
          tags: [
            "classe:magicien",
            "liste:magicien",
            "niveau:2",
            "sort:toile_d_araignee",
            "type:terrain",
            "etat:entrave",
            "zone:toile"
          ]
        }
      }
    }]);
    return true;
  }

  const stateFromSave = save => save.success ? "slowed" : "trapped";
  const stateLabel = state => state === "trapped" ? "Prise" : state === "slowed" ? "Ralentie" : "Libre";

  async function createChat(rows, durationTurns, level) {
    if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
      throw new Error("Le constructeur commun des cartes de chat ADD2E est indisponible.");
    }

    const results = rows.length
      ? rows.map(row => `${row.name} : ${row.save.d20}${row.save.bonus ? ` ${row.save.bonus >= 0 ? "+" : ""}${row.save.bonus}` : ""} = ${row.save.total} / ${row.save.target} — ${stateLabel(row.state)}`).join(" ; ")
      : "Aucune créature détectée dans la toile.";

    const options = {
      actor: caster,
      title: SPELL.name,
      icon: "fas fa-spider",
      variant: "spell",
      source: {
        name: caster?.name ?? casterToken?.name ?? "Magicien",
        img: casterToken?.document?.texture?.src ?? caster?.img ?? "icons/svg/mystery-man.svg",
        type: `Magicien niveau ${level}`,
        meta: SPELL.school
      },
      rows: [
        { label: "Zone", value: `${3 * level} m d’arête` },
        { label: "Durée", value: `${durationTurns} tour${durationTurns > 1 ? "s" : ""}` },
        { label: "Sauvegarde", value: "Sortilèges — réussite : ralenti ; échec : pris" },
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
              saveType: row.save.resolution?.key ?? "sorts",
              d20: row.save.d20,
              bonus: row.save.bonus,
              total: row.save.total,
              target: row.save.target,
              success: row.save.success,
              state: row.state
            }))
          }
        }
      }
    };

    const preview = globalThis.add2eBuildChatCard(options);
    if (!String(preview ?? "").trim()) throw new Error("Toile d’araignée : carte de chat vide.");
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

  const level = casterLevel();
  const durationRounds = Math.max(1, level * 10);
  const durationTurns = Math.max(1, level);
  const placement = await waitForPlacement(level);
  if (!placement?.point) {
    ui.notifications.info(`${SPELL.name} : lancement annulé.`);
    return false;
  }

  const targets = tokensInSquare(placement.point, placement.sideMeters);
  const prepared = [];
  for (const targetToken of targets) {
    const save = await globalThis.add2eRollSavingThrow(targetToken.actor, 4, {
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
      ui.notifications.error(`${SPELL.name} : aucune sauvegarde contre les sortilèges pour ${targetToken.actor?.name ?? "la cible"}.`);
      return false;
    }
    prepared.push({ targetToken, save });
  }

  await createSceneTemplate(placement.point, placement.sideMeters, durationRounds);
  await playVfx(placement.point, placement.sideMeters);

  const rows = [];
  for (const { targetToken, save } of prepared) {
    const state = stateFromSave(save);
    await applyWebEffect(targetToken.actor, state, durationRounds);
    rows.push({
      name: targetToken.name,
      actorUuid: targetToken.actor.uuid,
      save,
      state
    });
  }

  await createChat(rows, durationTurns, level);
  console.log(`${TAG}[DONE]`, { caster: caster.name, level, durationRounds, targets: rows });
  return true;
})();