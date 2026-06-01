// ADD2E — onUse Magicien : Toile d’araignée
// Version : 2026-05-28-magicien-attaque-n2-toile-araignee-zone-save-template-v3
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
  const metersToPx = m => (m / metersPerGridCell()) * gridSizePx();
  const pxDistanceMeters = (a,b) => Math.hypot((b.x??0)-(a.x??0),(b.y??0)-(a.y??0)) / gridSizePx() * metersPerGridCell();

  function saveTarget(actor, kind = "sort") {
    const sys = actor?.system ?? {};
    const keys = kind === "poison"
      ? ["sauvegardes.poison","sauvegardes.poisons","jets_sauvegarde.poison","jets_sauvegarde.poisons","jp.poison","jp.poisons","saves.poison","saves.poisons","save.poison","save.poisons","poison","poisons"]
      : ["sauvegardes.sort","sauvegardes.sorts","jets_sauvegarde.sort","jets_sauvegarde.sorts","jp.sort","jp.sorts","saves.spell","saves.spells","saves.sort","saves.sorts","save.spell","save.spells","save.sort","save.sorts","sort","sorts"];
    for (const k of keys) {
      const v = foundry.utils.getProperty(sys, k);
      const target = Number(v);
      if (Number.isFinite(target) && target > 0) return target;
    }
    return 20;
  }

  async function rollSave(actor, kind = "sort") {
    const target = saveTarget(actor, kind);
    const roll = await new Roll("1d20").evaluate({ async: true });
    return { total: roll.total, target, success: Number(roll.total) >= target, formula: roll.formula };
  }

  function browserEventToCanvasPoint(event) {
    const view = canvas.app?.view, renderer = canvas.app?.renderer;
    if (!view || !renderer || typeof PIXI === "undefined") return null;
    const rect = view.getBoundingClientRect();
    const sx = renderer.screen?.width ? renderer.screen.width / rect.width : 1;
    const sy = renderer.screen?.height ? renderer.screen.height / rect.height : 1;
    return canvas.stage?.worldTransform?.applyInverse(new PIXI.Point((event.clientX - rect.left) * sx, (event.clientY - rect.top) * sy)) ?? null;
  }
  function clearRuler() { try { canvas.controls?.ruler?.clear?.(); } catch (_e) {} try { canvas.controls?.ruler?.destroyChildren?.(); } catch (_e) {} }
  function parentLayer() { return canvas.interface ?? canvas.controls ?? canvas.stage; }

  function drawSquare(g, center, sideMeters, valid) {
    const size = metersToPx(sideMeters), x = center.x - size / 2, y = center.y - size / 2;
    g.clear();
    g.lineStyle(3, valid ? 0xd8d8e8 : 0xb33a3a, 0.95);
    g.beginFill(0xe8e8ff, 0.25);
    g.drawRoundedRect(x, y, size, size, 8);
    g.endFill();
    g.lineStyle(1, 0xffffff, 0.85);
    const step = Math.max(8, size / 6);
    for (let i = 0; i <= size; i += step) {
      g.moveTo(x + i, y); g.lineTo(x + size - i, y + size);
      g.moveTo(x, y + i); g.lineTo(x + size, y + size - i);
    }
  }

  async function waitForPlacement(level) {
    const view = canvas.app?.view, parent = parentLayer();
    if (!view || !parent || typeof PIXI === "undefined") return null;
    clearRuler();
    const previous = parent.getChildByName?.("add2e-toile-araignee-zone-preview");
    if (previous) previous.destroy({ children: true });
    const g = new PIXI.Graphics();
    g.name = "add2e-toile-araignee-zone-preview";
    g.zIndex = 100000;
    g.eventMode = "none";
    parent.sortableChildren = true;
    parent.addChild(g);
    const origin = casterToken.center ?? { x: casterToken.document.x, y: casterToken.document.y };
    const rangeMeters = 5 * Math.max(1, level);
    const sideMeters = 3 * Math.max(1, level);
    let current = { ...origin }, valid = true;
    const oldCursor = view.style.cursor;
    view.style.cursor = "crosshair";
    ui.notifications.info(`${SPELL.name} : place le centre de la toile, clic gauche pour valider, clic droit ou Échap pour annuler.`);
    return await new Promise(resolve => {
      let done = false;
      const cleanup = (result) => {
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
        valid = pxDistanceMeters(origin, current) <= rangeMeters + 0.001;
        drawSquare(g, current, sideMeters, valid);
      };
      function onMove(e) { update(e); }
      function onDown(e) { e.preventDefault(); e.stopPropagation(); if (e.button === 2) return cleanup(null); if (e.button !== 0) return; update(e); if (!valid) return ui.notifications.warn(`${SPELL.name} : point d’ancrage hors portée.`); cleanup({ point: current, sideMeters, rangeMeters }); }
      function onContext(e) { e.preventDefault(); e.stopPropagation(); cleanup(null); }
      function onKey(e) { if (e.key !== "Escape") return; e.preventDefault(); e.stopPropagation(); cleanup(null); }
      drawSquare(g, current, sideMeters, valid);
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
      flags: { add2e: { spell: SPELL.slug, spellName: SPELL.name, templateRequestId: requestId, durationRounds } }
    };
    if (game.user.isGM) await canvas.scene?.createEmbeddedDocuments?.("MeasuredTemplate", [templateData]);
    else game.socket?.emit?.("system.add2e", { type: "ADD2E_GM_OPERATION", operation: "createMeasuredTemplate", payload: { sceneId: canvas.scene?.id, spell: SPELL.slug, spellName: SPELL.name, templateRequestId: requestId, templateData } });
  }

  function tokenSamplePoints(t) {
    const x = t.document.x, y = t.document.y, w = t.w ?? ((t.document.width || 1) * gridSizePx()), h = t.h ?? ((t.document.height || 1) * gridSizePx());
    return [{x:x+w/2,y:y+h/2},{x,y},{x:x+w,y},{x,y:y+h},{x:x+w,y:y+h},{x:x+w/2,y},{x:x+w/2,y:y+h},{x,y:y+h/2},{x:x+w,y:y+h/2}];
  }
  function tokensInSquare(center, sideMeters) {
    const size = metersToPx(sideMeters), x1 = center.x - size / 2, y1 = center.y - size / 2, x2 = center.x + size / 2, y2 = center.y + size / 2;
    return canvas.tokens.placeables.filter(t => t.visible && t.actor && t.id !== casterToken.id && t.actor.id !== caster?.id).filter(t => tokenSamplePoints(t).some(p => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2));
  }

  async function playVfx(point, sideMeters) {
    if (typeof Sequence !== "undefined") {
      try { await new Sequence().effect().file("jb2a.web.01.white").atLocation(point).scaleToObject?.(Math.max(1.5, sideMeters / 3)).duration(9000).play(); } catch (err) { console.warn(`${TAG}[VFX_SEQUENCE_FAILED]`, err); }
    }
  }

  async function applyWebEffect(targetActor, state, durationRounds) {
    if (!targetActor || state === "free") return false;
    const existing = targetActor.effects?.filter?.(e => e.flags?.add2e?.spell === SPELL.slug) ?? [];
    for (const e of existing) await e.delete();
    const label = state === "trapped" ? "pris dans la toile" : "ralenti par la toile";
    await targetActor.createEmbeddedDocuments("ActiveEffect", [{ name: `${SPELL.name} — ${label}`, img: sourceItem?.img || SPELL.imgFallback, disabled: false, transfer: false, type: "base", system: {}, changes: [], duration: { rounds: durationRounds, startRound: game.combat?.round ?? null, startTime: game.time?.worldTime ?? null, combat: game.combat?.id ?? null }, description: SPELL.description, flags: { add2e: { spell: SPELL.slug, state, tags: ["classe:magicien","liste:magicien","niveau:2","sort:toile_d_araignee","type:terrain","etat:entrave","zone:toile"] } } }]);
    return true;
  }

  const stateFromSave = save => save.success ? "slowed" : "trapped";

  async function chat(rows, durationTurns, level) {
    const casterName = caster?.name ?? casterToken?.name ?? "Magicien";
    const casterImg = casterToken?.document?.texture?.src ?? caster?.img ?? "icons/svg/mystery-man.svg";
    const spellImg = sourceItem?.img || SPELL.imgFallback;
    const label = state => state === "trapped" ? "Prise" : state === "slowed" ? "Ralentie" : "Libre";
    const htmlRows = rows.length ? rows.map(r => `<tr><td style="padding:4px 6px;"><b>${esc(r.name)}</b></td><td style="padding:4px 6px;text-align:center;">${r.save.total}/${r.save.target}</td><td style="padding:4px 6px;text-align:center;">${label(r.state)}</td></tr>`).join("") : `<tr><td colspan="3" style="padding:6px;text-align:center;"><i>Aucune créature détectée dans la toile.</i></td></tr>`;
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }), content: `<div class="add2e-chat-card add2e-magicien-sort add2e-sort-toile-araignee" style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary);"><div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px;"><img src="${esc(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff;"><div style="flex:1;line-height:1.05;"><div style="font-weight:800;font-size:14px;">${esc(casterName)}</div><div style="font-size:12px;font-weight:700;">lance ${esc(SPELL.name)}</div></div><div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">Magicien niv. 2</div><img src="${esc(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;"></div><div style="padding:9px 10px 10px;background:#f6f0ff;"><div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;margin-bottom:7px;"><div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;text-align:center;">Zone de toile</div><table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:13px;"><thead><tr><th style="text-align:left;padding:4px 6px;">Créature</th><th>JP</th><th>État</th></tr></thead><tbody>${htmlRows}</tbody></table><p style="font-size:12px;text-align:center;margin:.5em 0 0;">Durée : ${durationTurns} tour${durationTurns>1?'s':''}. Zone : ${3 * level} m d’arête.</p></div><details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;"><summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Détails du sort</summary><div style="margin-top:5px;font-size:12px;line-height:1.35;"><p><b>École :</b> ${esc(SPELL.school)} — <b>Portée :</b> ${esc(SPELL.rangeText)} — <b>Zone :</b> ${esc(SPELL.areaText)}.</p><p><b>Composantes :</b> ${esc(SPELL.componentsText)} — <b>Incantation :</b> ${esc(SPELL.castingTimeText)} — <b>Jet de sauvegarde :</b> ${esc(SPELL.saveText)}.</p><p>${esc(SPELL.description)}</p></div></details></div></div>` });
  }

  if (!sourceItem || !caster || !casterToken) { ui.notifications.warn(`${SPELL.name} : lanceur ou sort introuvable.`); return false; }
  const level = casterLevel();
  const durationRounds = Math.max(1, level * 10);
  const durationTurns = Math.max(1, level);
  const placement = await waitForPlacement(level);
  if (!placement?.point) { ui.notifications.info(`${SPELL.name} : lancement annulé.`); return false; }
  await createSceneTemplate(placement.point, placement.sideMeters, durationRounds);
  await playVfx(placement.point, placement.sideMeters);
  const targets = tokensInSquare(placement.point, placement.sideMeters);
  const rows = [];
  for (const t of targets) {
    const save = await rollSave(t.actor, "sort");
    const state = stateFromSave(save);
    await applyWebEffect(t.actor, state, durationRounds);
    rows.push({ name: t.name, save, state });
  }
  await chat(rows, durationTurns, level);
  console.log(`${TAG}[DONE]`, { caster: caster.name, level, durationRounds, targets: rows });
  return true;
})();
