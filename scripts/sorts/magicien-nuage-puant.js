// ADD2E — onUse Magicien : Nuage puant
// Version : 2026-07-23-canonical-save-chat-v8
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

  const num = (v, f = 0) => { const n = Number(v); return Number.isFinite(n) ? n : f; };
  const sourceItem = (() => { if (typeof item !== "undefined" && item) return item; if (typeof sort !== "undefined" && sort) return sort; if (typeof spell !== "undefined" && spell) return spell; if (typeof args !== "undefined" && args?.[0]?.item) return args[0].item; return null; })();
  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem?.parent;
  const casterToken = (() => { if (typeof token !== "undefined" && token?.actor?.id === caster?.id) return token; return canvas.tokens?.controlled?.find(t => t.actor?.id === caster?.id) ?? caster?.getActiveTokens?.()[0] ?? canvas.tokens?.controlled?.[0] ?? null; })();

  function casterLevel() {
    const d = caster?.system?.details_classe ?? {};
    const byClass = num(d.magicien?.niveau ?? d.mage?.niveau ?? d.illusionniste?.niveau, 0);
    if (byClass > 0) return byClass;
    const classItem = caster?.items?.find?.(i => String(i.type).toLowerCase() === "classe" && /magicien|mage|illusionniste/i.test(i.name ?? ""));
    return Math.max(1, num(classItem?.system?.niveau ?? classItem?.system?.level ?? caster?.system?.niveau ?? caster?.system?.level ?? caster?.system?.details?.niveau, 1));
  }

  function gridData() {
    const grid = canvas.scene?.grid ?? canvas.grid ?? {};
    const raw = num(grid.distance, 0);
    const units = String(grid.units ?? "").trim().toLowerCase();
    return { raw: raw > 0 ? raw : 1, units };
  }

  function metersPerGridCell() {
    const { raw, units } = gridData();
    if (/^(m|meter|meters|metre|metres|mètre|mètres)$/.test(units)) return raw;
    if (/^(ft|feet|foot|pied|pieds)$/.test(units)) return raw * 0.3048;
    if (raw > 1) return raw;
    return 1.5;
  }

  const gridSizePx = () => canvas.grid?.size || canvas.dimensions?.size || 100;
  const metersToPx = m => (m / metersPerGridCell()) * gridSizePx();
  const pxDistanceMeters = (a, b) => Math.hypot((b.x ?? 0) - (a.x ?? 0), (b.y ?? 0) - (a.y ?? 0)) / gridSizePx() * metersPerGridCell();

  function resolveSave(targetActor, level) {
    if (typeof globalThis.add2eResolveSavingThrow !== "function") {
      throw new Error("Le résolveur canonique ADD2E de sauvegardes est indisponible.");
    }
    const resolution = globalThis.add2eResolveSavingThrow(targetActor, 0, {
      source: `spell:${SPELL.slug}`,
      sourceItem,
      caster,
      casterLevel: level,
      frontale: true
    });
    if (!Number.isFinite(Number(resolution?.target)) || Number(resolution.target) <= 0) {
      throw new Error(`Aucune sauvegarde contre le poison pour ${targetActor?.name ?? "la cible"}.`);
    }
    return resolution;
  }

  async function rollSave(resolution) {
    const roll = await new Roll("1d20").evaluate();
    if (game.dice3d) await game.dice3d.showForRoll(roll);
    const d20 = Number(roll.total) || 0;
    const bonus = Number(resolution.bonus) || 0;
    const total = d20 + bonus;
    return {
      roll,
      d20,
      bonus,
      total,
      target: Number(resolution.target),
      success: total >= Number(resolution.target),
      resolution
    };
  }

  function browserEventToCanvasPoint(event) {
    const view = canvas.app?.view;
    const renderer = canvas.app?.renderer;
    if (!view || !renderer || typeof PIXI === "undefined") return null;
    const rect = view.getBoundingClientRect();
    const sx = renderer.screen?.width ? renderer.screen.width / rect.width : 1;
    const sy = renderer.screen?.height ? renderer.screen.height / rect.height : 1;
    const global = new PIXI.Point((event.clientX - rect.left) * sx, (event.clientY - rect.top) * sy);
    return canvas.stage?.worldTransform?.applyInverse(global) ?? null;
  }

  function resetRuler() {
    try { canvas.controls?.ruler?.reset?.(); } catch (_e) {}
  }

  function parentLayer() { return canvas.interface ?? canvas.controls ?? canvas.stage; }

  async function deleteOldTechnicalZones() {
    const scene = canvas.scene;
    if (!scene) return;
    if (game.user.isGM) {
      const templateIds = Array.from(scene.templates ?? []).filter(t => t.flags?.add2e?.spell === SPELL.slug).map(t => t.id).filter(Boolean);
      if (templateIds.length) await scene.deleteEmbeddedDocuments("MeasuredTemplate", templateIds);
      const drawingIds = Array.from(scene.drawings ?? []).filter(d => d.flags?.add2e?.spell === SPELL.slug).map(d => d.id).filter(Boolean);
      if (drawingIds.length) await scene.deleteEmbeddedDocuments("Drawing", drawingIds);
      return;
    }
    game.socket?.emit?.("system.add2e", { type: "ADD2E_GM_OPERATION", operation: "deleteMeasuredTemplates", payload: { sceneId: scene.id, spell: SPELL.slug } });
  }

  function drawPlacementMarker(g, point, valid) {
    g.clear();
    const color = valid ? 0x7aa85c : 0xb33a3a;
    g.lineStyle(3, color, 0.95);
    g.moveTo(point.x - 10, point.y);
    g.lineTo(point.x + 10, point.y);
    g.moveTo(point.x, point.y - 10);
    g.lineTo(point.x, point.y + 10);
    g.beginFill(color, 0.55);
    g.drawCircle(point.x, point.y, 4);
    g.endFill();
  }

  async function waitForPlacement() {
    const view = canvas.app?.view;
    const parent = parentLayer();
    if (!view || !parent || typeof PIXI === "undefined") return null;
    resetRuler();
    const previous = parent.getChildByName?.("add2e-nuage-puant-placement-marker");
    if (previous) previous.destroy({ children: true });
    const g = new PIXI.Graphics();
    g.name = "add2e-nuage-puant-placement-marker";
    g.zIndex = 100000;
    g.eventMode = "none";
    parent.sortableChildren = true;
    parent.addChild(g);
    const origin = casterToken.center ?? { x: casterToken.document.x, y: casterToken.document.y };
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
        if (!g.destroyed) g.destroy({ children: true });
        resolve(result);
      };
      const update = event => {
        const p = browserEventToCanvasPoint(event);
        if (!p) return;
        current = p;
        valid = pxDistanceMeters(origin, current) <= SPELL.rangeMeters + 0.001;
        drawPlacementMarker(g, current, valid);
      };
      function onMove(e) { update(e); }
      function onDown(e) { e.preventDefault(); e.stopPropagation(); if (e.button === 2) return cleanup(null); if (e.button !== 0) return; update(e); if (!valid) return ui.notifications.warn(`${SPELL.name} : point d’impact hors portée.`); cleanup({ point: current }); }
      function onContext(e) { e.preventDefault(); e.stopPropagation(); cleanup(null); }
      function onKey(e) { if (e.key !== "Escape") return; e.preventDefault(); e.stopPropagation(); cleanup(null); }
      drawPlacementMarker(g, current, valid);
      view.addEventListener("mousemove", onMove, true);
      view.addEventListener("mousedown", onDown, true);
      view.addEventListener("contextmenu", onContext, true);
      window.addEventListener("keydown", onKey, true);
    });
  }

  function tokenSamplePoints(t) {
    const x = t.document.x, y = t.document.y;
    const w = t.w ?? ((t.document.width || 1) * gridSizePx());
    const h = t.h ?? ((t.document.height || 1) * gridSizePx());
    return [{x:x+w/2,y:y+h/2},{x,y},{x:x+w,y},{x,y:y+h},{x:x+w,y:y+h},{x:x+w/2,y},{x:x+w/2,y:y+h},{x,y:y+h/2},{x:x+w,y:y+h/2}];
  }

  function tokensInCircle(center) {
    const radiusPx = metersToPx(SPELL.radiusMeters);
    return canvas.tokens.placeables
      .filter(t => t.visible && t.actor && t.id !== casterToken.id && t.actor.id !== caster?.id)
      .filter(t => tokenSamplePoints(t).some(p => Math.hypot(p.x - center.x, p.y - center.y) <= radiusPx));
  }

  async function createZoneControllerEffect(point, durationRounds) {
    const old = caster.effects?.filter?.(e => e.flags?.add2e?.spell === SPELL.slug && e.flags?.add2e?.zoneController === true) ?? [];
    for (const e of old) await e.delete();
    const requestId = foundry.utils.randomID();
    const created = await caster.createEmbeddedDocuments("ActiveEffect", [{
      name: `${SPELL.name} — zone active`,
      img: sourceItem?.img || SPELL.imgFallback,
      disabled: false,
      transfer: false,
      type: "base",
      system: {},
      changes: [],
      duration: { rounds: durationRounds, startRound: game.combat?.round ?? null, startTime: game.time?.worldTime ?? null, combat: game.combat?.id ?? null },
      description: "Contrôle la durée visuelle du nuage. Supprimer cet effet arrête l’animation.",
      flags: { add2e: { spell: SPELL.slug, zoneController: true, requestId, sceneId: canvas.scene?.id ?? null, x: point.x, y: point.y, radiusMeters: SPELL.radiusMeters } }
    }]);
    return created?.[0] ?? null;
  }

  function isControllerActive(effectId) {
    const effect = caster?.effects?.get?.(effectId);
    if (!effect || effect.disabled) return false;
    const duration = effect.duration ?? {};
    if (duration.remaining !== undefined && duration.remaining !== null && Number(duration.remaining) <= 0) return false;
    return true;
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
        const seq = new Sequence();
        let effect = seq.effect().file(file).atLocation(point).duration(SPELL.vfxChunkMs).fadeIn(300).fadeOut(550).opacity(0.85).belowTokens();
        if (typeof effect.scaleToObject === "function") effect = effect.scaleToObject(Math.max(2, radiusPx / gridSizePx()));
        else if (typeof effect.scale === "function") effect = effect.scale(Math.max(1.2, radiusPx / gridSizePx()));
        await seq.play();
        return true;
      } catch (_err) {}
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
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * radius * 0.82;
      const size = radius * (0.18 + Math.random() * 0.34);
      const g = new PIXI.Graphics();
      const color = [0x6f9f45, 0x8fbf64, 0x4f7f3a, 0x9fbf72, 0xb2c98a][Math.floor(Math.random() * 5)];
      g.beginFill(color, 0.15 + Math.random() * 0.16);
      g.drawCircle(0, 0, size);
      g.endFill();
      g.x = point.x + Math.cos(angle) * dist;
      g.y = point.y + Math.sin(angle) * dist;
      container.addChild(g);
      puffs.push({ g, baseX: g.x, baseY: g.y, speed: 0.0012 + Math.random() * 0.0022, drift: 7 + Math.random() * 18, phase: Math.random() * Math.PI * 2 });
    }

    const started = performance.now();
    const ticker = canvas.app?.ticker;
    const animate = () => {
      const elapsed = performance.now() - started;
      const life = Math.min(1, elapsed / durationMs);
      container.alpha = life < 0.12 ? life / 0.12 : life > 0.78 ? Math.max(0, (1 - life) / 0.22) : 1;
      for (const p of puffs) {
        const t = elapsed * p.speed + p.phase;
        p.g.x = p.baseX + Math.cos(t) * p.drift;
        p.g.y = p.baseY + Math.sin(t * 0.85) * p.drift;
        p.g.scale.set(1 + Math.sin(t * 1.7) * 0.07);
      }
      if (elapsed >= durationMs) {
        ticker?.remove?.(animate);
        if (!container.destroyed) container.destroy({ children: true });
      }
    };
    ticker?.add?.(animate);
    window.setTimeout(() => { ticker?.remove?.(animate); if (!container.destroyed) container.destroy({ children: true }); }, durationMs + 750);
    return true;
  }

  function startLoopingCloudVfx(point, controllerEffect) {
    const effectId = controllerEffect?.id;
    if (!effectId) return;
    const loopKey = `add2eNuagePuantLoop_${effectId}`;
    globalThis.ADD2E_ACTIVE_SPELL_VFX ??= {};
    if (globalThis.ADD2E_ACTIVE_SPELL_VFX[loopKey]) clearInterval(globalThis.ADD2E_ACTIVE_SPELL_VFX[loopKey]);

    const tick = async () => {
      if (!isControllerActive(effectId)) {
        const id = globalThis.ADD2E_ACTIVE_SPELL_VFX?.[loopKey];
        if (id) clearInterval(id);
        delete globalThis.ADD2E_ACTIVE_SPELL_VFX?.[loopKey];
        return;
      }
      const jb2aOk = await playOneJb2aFog(point);
      if (!jb2aOk) playOnePixiFog(point, SPELL.vfxChunkMs);
    };

    tick();
    globalThis.ADD2E_ACTIVE_SPELL_VFX[loopKey] = setInterval(tick, SPELL.vfxLoopMs);
  }

  async function applyNausea(targetActor, durationRounds) {
    if (!targetActor) return false;
    const existing = targetActor.effects?.filter?.(e => e.flags?.add2e?.spell === SPELL.slug && e.flags?.add2e?.zoneController !== true) ?? [];
    for (const e of existing) await e.delete();
    await targetActor.createEmbeddedDocuments("ActiveEffect", [{
      name: `${SPELL.name} — nausée`,
      img: sourceItem?.img || SPELL.imgFallback,
      disabled: false,
      transfer: false,
      type: "base",
      system: {},
      changes: [],
      duration: { rounds: durationRounds, startRound: game.combat?.round ?? null, startTime: game.time?.worldTime ?? null, combat: game.combat?.id ?? null },
      description: SPELL.description,
      flags: { add2e: { spell: SPELL.slug, tags: ["classe:magicien","liste:magicien","niveau:2","sort:nuage_puant","type:condition","etat:nausee","zone:nuage"] } }
    }]);
    return true;
  }

  async function chat(rows, durationRounds, level) {
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

  if (!sourceItem || !caster || !casterToken) { ui.notifications.warn(`${SPELL.name} : lanceur ou sort introuvable.`); return false; }
  await deleteOldTechnicalZones();
  const level = casterLevel();
  const durationRounds = Math.max(1, level);
  const placement = await waitForPlacement();
  if (!placement?.point) { ui.notifications.info(`${SPELL.name} : lancement annulé.`); return false; }

  const targets = tokensInCircle(placement.point);
  let prepared;
  try {
    prepared = targets.map(targetToken => ({
      targetToken,
      resolution: resolveSave(targetToken.actor, level)
    }));
  } catch (error) {
    console.error(`${TAG}[SAVE_RESOLUTION]`, error);
    ui.notifications.error(`${SPELL.name} : ${error.message}`);
    return false;
  }

  await deleteOldTechnicalZones();
  const controller = await createZoneControllerEffect(placement.point, durationRounds);
  startLoopingCloudVfx(placement.point, controller);
  const rows = [];
  for (const { targetToken, resolution } of prepared) {
    const save = await rollSave(resolution);
    if (!save.success) await applyNausea(targetToken.actor, durationRounds);
    rows.push({ name: targetToken.name, actorUuid: targetToken.actor.uuid, save });
  }
  await chat(rows, durationRounds, level);
  console.log(`${TAG}[DONE]`, { caster: caster.name, level, durationRounds, targets: rows });
  return true;
})();
