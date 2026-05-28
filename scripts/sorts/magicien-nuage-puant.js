// ADD2E — onUse Magicien : Nuage puant
// Version : 2026-05-28-magicien-attaque-n2-nuage-puant-vfx-cloud-v4
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
    imgFallback: "systems/add2e/assets/icones/sorts/nuage-puant.webp",
    description: "Ce sort crée une masse de vapeurs nauséabondes qui rend les créatures présentes incapables d’agir normalement si elles ratent leur jet de protection contre le poison. Les créatures affectées chancellent, sont prises de nausées et ne peuvent pas attaquer tant qu’elles restent dans le nuage et pendant un court temps après en être sorties. Le nuage dérive selon le vent et peut être dissipé par un vent fort."
  };

  const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
  const num = (v,f=0) => { const n = Number(v); return Number.isFinite(n) ? n : f; };
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

  function metersToSceneDistance(meters) {
    const { units } = gridData();
    if (/^(ft|feet|foot|pied|pieds)$/.test(units)) return meters / 0.3048;
    return meters;
  }

  const gridSizePx = () => canvas.grid?.size || canvas.dimensions?.size || 100;
  const metersToPx = m => (m / metersPerGridCell()) * gridSizePx();
  const pxDistanceMeters = (a, b) => Math.hypot((b.x ?? 0) - (a.x ?? 0), (b.y ?? 0) - (a.y ?? 0)) / gridSizePx() * metersPerGridCell();

  function saveTarget(actor, kind = "poison") {
    const sys = actor?.system ?? {};
    const keys = kind === "poison"
      ? ["sauvegardes.poison","sauvegardes.poisons","sauvegardes.paralysie_poison_mort","sauvegardes.paralysiePoisonMort","jets_sauvegarde.poison","jets_sauvegarde.poisons","jp.poison","jp.poisons","saves.poison","saves.poisons","save.poison","save.poisons","poison","poisons"]
      : ["sauvegardes.sort","sauvegardes.sorts","jets_sauvegarde.sort","jets_sauvegarde.sorts","jp.sort","jp.sorts","saves.spell","saves.spells","saves.sort","saves.sorts","save.spell","save.spells","save.sort","save.sorts","sort","sorts"];
    for (const k of keys) {
      const value = foundry.utils.getProperty(sys, k);
      const target = Number(value);
      if (Number.isFinite(target) && target > 0) return target;
    }
    return 20;
  }

  async function rollSave(actor, kind = "poison") {
    const target = saveTarget(actor, kind);
    const roll = await new Roll("1d20").evaluate({ async: true });
    return { total: Number(roll.total) || 0, target, success: Number(roll.total) >= target, formula: roll.formula };
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

  function clearRuler() {
    try { canvas.controls?.ruler?.clear?.(); } catch (_e) {}
    try { canvas.controls?.ruler?.destroyChildren?.(); } catch (_e) {}
  }

  function parentLayer() { return canvas.interface ?? canvas.controls ?? canvas.stage; }

  function drawPreview(g, point, valid) {
    const r = metersToPx(SPELL.radiusMeters);
    g.clear();
    g.lineStyle(3, valid ? 0x5a8f3a : 0xb33a3a, 0.95);
    g.beginFill(0x7aa85c, 0.28);
    g.drawCircle(point.x, point.y, r);
    g.endFill();
    g.lineStyle(1, 0xe8ffd6, 0.8);
    g.drawCircle(point.x, point.y, Math.max(4, r * 0.55));
  }

  async function waitForPlacement() {
    const view = canvas.app?.view;
    const parent = parentLayer();
    if (!view || !parent || typeof PIXI === "undefined") return null;
    clearRuler();
    const previous = parent.getChildByName?.("add2e-nuage-puant-zone-preview");
    if (previous) previous.destroy({ children: true });
    const g = new PIXI.Graphics();
    g.name = "add2e-nuage-puant-zone-preview";
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
        clearRuler();
        if (!g.destroyed) g.destroy({ children: true });
        resolve(result);
      };
      const update = event => {
        const p = browserEventToCanvasPoint(event);
        if (!p) return;
        current = p;
        valid = pxDistanceMeters(origin, current) <= SPELL.rangeMeters + 0.001;
        drawPreview(g, current, valid);
      };
      function onMove(e) { update(e); }
      function onDown(e) {
        e.preventDefault(); e.stopPropagation();
        if (e.button === 2) return cleanup(null);
        if (e.button !== 0) return;
        update(e);
        if (!valid) return ui.notifications.warn(`${SPELL.name} : point d’impact hors portée.`);
        cleanup({ point: current });
      }
      function onContext(e) { e.preventDefault(); e.stopPropagation(); cleanup(null); }
      function onKey(e) { if (e.key !== "Escape") return; e.preventDefault(); e.stopPropagation(); cleanup(null); }
      drawPreview(g, current, valid);
      view.addEventListener("mousemove", onMove, true);
      view.addEventListener("mousedown", onDown, true);
      view.addEventListener("contextmenu", onContext, true);
      window.addEventListener("keydown", onKey, true);
    });
  }

  async function createLocalDrawingFog(point, durationRounds) {
    const scene = canvas.scene;
    if (!scene) return;
    const requestId = foundry.utils.randomID();
    const radiusPx = metersToPx(SPELL.radiusMeters);
    const drawingData = {
      x: point.x - radiusPx,
      y: point.y - radiusPx,
      rotation: 0,
      hidden: false,
      locked: false,
      fillType: 1,
      fillColor: "#5f8f42",
      fillAlpha: 0.18,
      strokeColor: "#2f5f2f",
      strokeAlpha: 0.45,
      strokeWidth: 1,
      shape: { type: "e", width: radiusPx * 2, height: radiusPx * 2 },
      flags: { add2e: { spell: SPELL.slug, spellName: SPELL.name, templateRequestId: requestId, drawingFallback: true, vfxCloud: true, durationRounds } }
    };
    if (game.user.isGM) await scene.createEmbeddedDocuments("Drawing", [drawingData]);
    else game.socket?.emit?.("system.add2e", { type: "ADD2E_GM_OPERATION", operation: "createMeasuredTemplate", payload: { sceneId: scene.id, spell: SPELL.slug, spellName: SPELL.name, templateRequestId: requestId, visibleDrawing: true, drawingColor: "#5f8f42", drawingAlpha: 0.18, templateData: { t: "circle", user: game.user.id, x: point.x, y: point.y, distance: metersToSceneDistance(SPELL.radiusMeters), fillColor: "#5f8f42", flags: { add2e: { spell: SPELL.slug, spellName: SPELL.name, templateRequestId: requestId, visibleDrawing: true } } } } });
  }

  async function createSceneTemplate(point, durationRounds) {
    const requestId = foundry.utils.randomID();
    const templateData = {
      t: "circle",
      user: game.user.id,
      x: point.x,
      y: point.y,
      direction: 0,
      distance: metersToSceneDistance(SPELL.radiusMeters),
      fillColor: "#7aa85c",
      flags: { add2e: { spell: SPELL.slug, spellName: SPELL.name, templateRequestId: requestId, durationRounds, visibleDrawing: true } }
    };
    if (game.user.isGM) {
      await canvas.scene?.createEmbeddedDocuments?.("MeasuredTemplate", [templateData]);
      await createLocalDrawingFog(point, durationRounds);
    } else {
      game.socket?.emit?.("system.add2e", { type: "ADD2E_GM_OPERATION", operation: "createMeasuredTemplate", payload: { sceneId: canvas.scene?.id, spell: SPELL.slug, spellName: SPELL.name, templateRequestId: requestId, visibleDrawing: true, drawingColor: "#5f8f42", drawingAlpha: 0.18, templateData } });
    }
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

  async function playJb2aFog(point) {
    if (typeof Sequence === "undefined") return false;
    const radiusPx = metersToPx(SPELL.radiusMeters);
    const files = [
      "jb2a.fog_cloud.02.green",
      "jb2a.fog_cloud.01.green",
      "jb2a.cloud_of_daggers.fog.green",
      "jb2a.smoke.puff.centered.green",
      "jb2a.smoke.puff.centered.grey"
    ];
    for (const file of files) {
      try {
        const seq = new Sequence();
        let effect = seq.effect().file(file).atLocation(point).duration(9000).fadeIn(800).fadeOut(1200).opacity(0.85).belowTokens();
        if (typeof effect.scaleToObject === "function") effect = effect.scaleToObject(Math.max(2, radiusPx / gridSizePx()));
        else if (typeof effect.scale === "function") effect = effect.scale(Math.max(1.2, radiusPx / gridSizePx()));
        await seq.play();
        console.log(`${TAG}[VFX_JB2A]`, { file });
        return true;
      } catch (err) {
        console.warn(`${TAG}[VFX_JB2A_FAILED]`, { file, err });
      }
    }
    return false;
  }

  function playPixiFog(point) {
    const parent = canvas.interface ?? canvas.controls ?? canvas.stage;
    if (!parent || typeof PIXI === "undefined") return false;
    const previous = parent.getChildByName?.("add2e-nuage-puant-cloud-vfx");
    if (previous) previous.destroy({ children: true });

    const radius = metersToPx(SPELL.radiusMeters);
    const container = new PIXI.Container();
    container.name = "add2e-nuage-puant-cloud-vfx";
    container.zIndex = 99999;
    container.eventMode = "none";
    container.alpha = 0.95;
    parent.sortableChildren = true;
    parent.addChild(container);

    const puffs = [];
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * radius * 0.78;
      const size = radius * (0.22 + Math.random() * 0.32);
      const g = new PIXI.Graphics();
      const color = [0x6f9f45, 0x8fbf64, 0x4f7f3a, 0xb2c98a][Math.floor(Math.random() * 4)];
      g.beginFill(color, 0.18 + Math.random() * 0.18);
      g.drawCircle(0, 0, size);
      g.endFill();
      g.x = point.x + Math.cos(angle) * dist;
      g.y = point.y + Math.sin(angle) * dist;
      g.blendMode = PIXI.BLEND_MODES.NORMAL;
      container.addChild(g);
      puffs.push({ g, baseX: g.x, baseY: g.y, angle, speed: 0.002 + Math.random() * 0.003, drift: 5 + Math.random() * 13, phase: Math.random() * Math.PI * 2 });
    }

    const started = performance.now();
    const duration = 9000;
    const ticker = canvas.app?.ticker;
    const animate = () => {
      const elapsed = performance.now() - started;
      const life = Math.min(1, elapsed / duration);
      container.alpha = life < 0.12 ? life / 0.12 : life > 0.82 ? Math.max(0, (1 - life) / 0.18) : 1;
      for (const p of puffs) {
        const t = elapsed * p.speed + p.phase;
        p.g.x = p.baseX + Math.cos(t) * p.drift;
        p.g.y = p.baseY + Math.sin(t * 0.85) * p.drift;
        p.g.scale.set(1 + Math.sin(t * 1.7) * 0.06);
      }
      if (elapsed >= duration) {
        ticker?.remove?.(animate);
        if (!container.destroyed) container.destroy({ children: true });
      }
    };
    ticker?.add?.(animate);
    window.setTimeout(() => {
      ticker?.remove?.(animate);
      if (!container.destroyed) container.destroy({ children: true });
    }, duration + 500);
    return true;
  }

  async function playVfx(point) {
    const jb2aOk = await playJb2aFog(point);
    if (!jb2aOk) playPixiFog(point);
  }

  async function applyNausea(targetActor, durationRounds) {
    if (!targetActor) return false;
    const existing = targetActor.effects?.filter?.(e => e.flags?.add2e?.spell === SPELL.slug) ?? [];
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

  async function chat(rows, durationRounds) {
    const casterName = caster?.name ?? casterToken?.name ?? "Magicien";
    const casterImg = casterToken?.document?.texture?.src ?? caster?.img ?? "icons/svg/mystery-man.svg";
    const spellImg = sourceItem?.img || SPELL.imgFallback;
    const htmlRows = rows.length
      ? rows.map(r => `<tr><td style="padding:4px 6px;"><b>${esc(r.name)}</b></td><td style="padding:4px 6px;text-align:center;">${r.save.total}/${r.save.target}</td><td style="padding:4px 6px;text-align:center;">${r.save.success ? "Résiste" : "Nausée"}</td></tr>`).join("")
      : `<tr><td colspan="3" style="padding:6px;text-align:center;"><i>Aucune créature détectée dans le nuage.</i></td></tr>`;
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }), content: `
      <div class="add2e-chat-card add2e-magicien-sort add2e-sort-nuage-puant" style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px;"><img src="${esc(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff;"><div style="flex:1;line-height:1.05;"><div style="font-weight:800;font-size:14px;">${esc(casterName)}</div><div style="font-size:12px;font-weight:700;">lance ${esc(SPELL.name)}</div></div><div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">Magicien niv. 2</div><img src="${esc(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;"></div>
        <div style="padding:9px 10px 10px;background:#f6f0ff;"><div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;margin-bottom:7px;"><div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;text-align:center;">Vapeurs nauséabondes</div><table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:13px;"><thead><tr><th style="text-align:left;padding:4px 6px;">Créature</th><th>JP poison</th><th>Effet</th></tr></thead><tbody>${htmlRows}</tbody></table><p style="font-size:12px;text-align:center;margin:.5em 0 0;">Durée du nuage : ${durationRounds} round${durationRounds > 1 ? "s" : ""}.</p></div>
        <details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;"><summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Détails du sort</summary><div style="margin-top:5px;font-size:12px;line-height:1.35;"><p><b>École :</b> ${esc(SPELL.school)} — <b>Portée :</b> ${esc(SPELL.rangeText)} — <b>Zone :</b> ${esc(SPELL.areaText)}.</p><p><b>Composantes :</b> ${esc(SPELL.componentsText)} — <b>Incantation :</b> ${esc(SPELL.castingTimeText)} — <b>Jet de sauvegarde :</b> ${esc(SPELL.saveText)}.</p><p>${esc(SPELL.description)}</p></div></details></div>
      </div>` });
  }

  if (!sourceItem || !caster || !casterToken) { ui.notifications.warn(`${SPELL.name} : lanceur ou sort introuvable.`); return false; }
  const level = casterLevel();
  const durationRounds = Math.max(1, level);
  const placement = await waitForPlacement();
  if (!placement?.point) { ui.notifications.info(`${SPELL.name} : lancement annulé.`); return false; }
  await createSceneTemplate(placement.point, durationRounds);
  await playVfx(placement.point);
  const targets = tokensInCircle(placement.point);
  const rows = [];
  for (const t of targets) {
    const save = await rollSave(t.actor, "poison");
    if (!save.success) await applyNausea(t.actor, durationRounds);
    rows.push({ name: t.name, save });
  }
  await chat(rows, durationRounds);
  console.log(`${TAG}[DONE]`, { caster: caster.name, level, durationRounds, targets: rows });
  return true;
})();
