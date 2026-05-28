// ADD2E — onUse Magicien : Nuage puant
// Version : 2026-05-28-magicien-attaque-n2-nuage-puant-zone-v2
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
    saveText: "Spécial",
    castingTimeText: "2 segments",
    componentsText: "V, S, M",
    rangeMeters: 30,
    radiusMeters: 3,
    imgFallback: "systems/add2e/assets/icones/sorts/nuage-puant.webp",
    description: "Ce sort crée une masse de vapeurs nauséabondes qui rend les créatures présentes incapables d’agir normalement si elles ratent leur jet de protection contre le poison. Les créatures affectées chancellent, sont prises de nausées et ne peuvent pas attaquer tant qu’elles restent dans le nuage et pendant un court temps après en être sorties. Le nuage dérive selon le vent et peut être dissipé par un vent fort."
  };

  const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
  const n = (v,f=0) => { const x = Number(v); return Number.isFinite(x) ? x : f; };
  const sourceItem = (() => { if (typeof item !== "undefined" && item) return item; if (typeof sort !== "undefined" && sort) return sort; if (typeof spell !== "undefined" && spell) return spell; if (typeof args !== "undefined" && args?.[0]?.item) return args[0].item; return null; })();
  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem?.parent;
  const casterToken = (() => { if (typeof token !== "undefined" && token?.actor?.id === caster?.id) return token; return canvas.tokens?.controlled?.find(t => t.actor?.id === caster?.id) ?? caster?.getActiveTokens?.()[0] ?? canvas.tokens?.controlled?.[0] ?? null; })();

  function casterLevel() {
    const d = caster?.system?.details_classe ?? {};
    const byClass = n(d.magicien?.niveau ?? d.mage?.niveau ?? d.illusionniste?.niveau, 0);
    if (byClass > 0) return byClass;
    const classItem = caster?.items?.find?.(i => String(i.type).toLowerCase() === "classe" && /magicien|mage|illusionniste/i.test(i.name ?? ""));
    return Math.max(1, n(classItem?.system?.niveau ?? classItem?.system?.level ?? caster?.system?.niveau ?? caster?.system?.level ?? caster?.system?.details?.niveau, 1));
  }

  function metersPerGridCell() {
    const grid = canvas.scene?.grid ?? canvas.grid;
    const raw = n(grid?.distance, 0);
    const units = String(grid?.units ?? "").trim().toLowerCase();
    if (raw > 0 && /^(m|meter|meters|metre|metres|mètre|mètres)$/.test(units)) return raw;
    if (raw > 0 && /^(ft|feet|foot|pied|pieds)$/.test(units)) return raw * 0.3048;
    if (raw > 1) return raw;
    return 1.5;
  }
  function gridSizePx() { return canvas.grid?.size || canvas.dimensions?.size || 100; }
  function metersToPx(m) { return (m / metersPerGridCell()) * gridSizePx(); }
  function pxDistanceMeters(a, b) { return Math.hypot((b.x ?? 0) - (a.x ?? 0), (b.y ?? 0) - (a.y ?? 0)) / gridSizePx() * metersPerGridCell(); }
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
  function clearRuler() { try { canvas.controls?.ruler?.clear?.(); } catch (_e) {} try { canvas.controls?.ruler?.destroyChildren?.(); } catch (_e) {} }
  function parentLayer() { return canvas.interface ?? canvas.controls ?? canvas.stage; }

  function drawCircle(g, point, valid) {
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
    const previous = parent.getChildByName?.("add2e-nuage-puant-zone");
    if (previous) previous.destroy({ children: true });
    const g = new PIXI.Graphics();
    g.name = "add2e-nuage-puant-zone";
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
      const cleanup = (result, keep = false) => {
        if (done) return;
        done = true;
        view.removeEventListener("mousemove", onMove, true);
        view.removeEventListener("mousedown", onDown, true);
        view.removeEventListener("contextmenu", onContext, true);
        window.removeEventListener("keydown", onKey, true);
        view.style.cursor = oldCursor;
        clearRuler();
        if (keep) window.setTimeout(() => { if (!g.destroyed) g.destroy({ children: true }); clearRuler(); }, 9000);
        else if (!g.destroyed) g.destroy({ children: true });
        resolve(result);
      };
      const update = event => {
        const p = browserEventToCanvasPoint(event);
        if (!p) return;
        current = p;
        valid = pxDistanceMeters(origin, current) <= SPELL.rangeMeters + 0.001;
        drawCircle(g, current, valid);
      };
      function onMove(e) { update(e); }
      function onDown(e) { e.preventDefault(); e.stopPropagation(); if (e.button === 2) return cleanup(null); if (e.button !== 0) return; update(e); if (!valid) { ui.notifications.warn(`${SPELL.name} : point d’impact hors portée.`); return; } cleanup({ point: current, overlay: g }, true); }
      function onContext(e) { e.preventDefault(); e.stopPropagation(); cleanup(null); }
      function onKey(e) { if (e.key !== "Escape") return; e.preventDefault(); e.stopPropagation(); cleanup(null); }
      drawCircle(g, current, valid);
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
    const r = metersToPx(SPELL.radiusMeters);
    return canvas.tokens.placeables.filter(t => t.visible && t.actor && t.id !== casterToken.id && t.actor.id !== caster?.id).filter(t => tokenSamplePoints(t).some(p => Math.hypot(p.x - center.x, p.y - center.y) <= r));
  }

  async function playVfx(point) {
    if (typeof Sequence !== "undefined") {
      try { await new Sequence().effect().file("jb2a.fog_cloud.01.green").atLocation(point).scaleToObject?.(2.5).duration(9000).play(); return true; } catch (err) { console.warn(`${TAG}[VFX_SEQUENCE_FAILED]`, err); }
    }
    return false;
  }

  async function askResults(targets, durationRounds) {
    const DialogV2 = foundry?.applications?.api?.DialogV2;
    if (!DialogV2?.wait) { ui.notifications.error(`${SPELL.name} : DialogV2 indisponible.`); return null; }
    const rows = targets.map(t => `
      <label style="display:grid;grid-template-columns:34px 1fr 120px;gap:8px;align-items:center;border:1px solid #8e63c7;border-radius:7px;background:#fffaff;padding:6px;margin-bottom:5px;">
        <img src="${esc(t.document?.texture?.src || t.actor?.img || 'icons/svg/mystery-man.svg')}" style="width:32px;height:32px;border-radius:5px;object-fit:cover;">
        <span style="font-weight:900;color:#2d2144;">${esc(t.name)}</span>
        <select name="target.${esc(t.id)}" style="width:100%;"><option value="failed">JP raté</option><option value="saved">JP réussi</option></select>
      </label>`).join("");
    return await DialogV2.wait({ window: { title: SPELL.name, icon: "fas fa-cloud" }, modal: true, rejectClose: false,
      content: `<form style="min-width:430px;max-width:560px;font-family:var(--font-primary);color:#2d2144;"><section style="border:1px solid #8e63c7;border-radius:9px;background:#f6f0ff;padding:8px;margin-bottom:8px;text-align:center;"><b style="color:#6c31b5;text-transform:uppercase;">Nuage puant</b><br><span style="font-size:12px;">Cibles détectées dans la zone. Durée du nuage : ${durationRounds} round${durationRounds>1?'s':''}.</span></section>${rows}</form>`,
      buttons: [
        { action: "apply", label: "Appliquer", icon: "fas fa-check", default: true, callback: (_e,_b,dialog) => { const form = dialog.element?.querySelector("form"); const data = new FormData(form); return Object.fromEntries(targets.map(t => [t.id, data.get(`target.${t.id}`) || "failed"])); } },
        { action: "cancel", label: "Annuler", icon: "fas fa-times", callback: () => null }
      ]
    });
  }

  async function applyNausea(targetActor, sourceItem, durationRounds) {
    if (!targetActor) return false;
    const existing = targetActor.effects?.filter?.(e => e.flags?.add2e?.spell === SPELL.slug) ?? [];
    for (const e of existing) await e.delete();
    await targetActor.createEmbeddedDocuments("ActiveEffect", [{ name: `${SPELL.name} — nausée`, img: sourceItem?.img || SPELL.imgFallback, disabled: false, transfer: false, type: "base", system: {}, changes: [], duration: { rounds: durationRounds, startRound: game.combat?.round ?? null, startTime: game.time?.worldTime ?? null, combat: game.combat?.id ?? null }, description: SPELL.description, flags: { add2e: { spell: SPELL.slug, tags: ["classe:magicien","liste:magicien","niveau:2","sort:nuage_puant","type:condition","etat:nausee","zone:nuage"] } } }]);
    return true;
  }

  async function chat(targets, results, durationRounds) {
    const casterName = caster?.name ?? casterToken?.name ?? "Magicien";
    const casterImg = casterToken?.document?.texture?.src ?? caster?.img ?? "icons/svg/mystery-man.svg";
    const spellImg = sourceItem?.img || SPELL.imgFallback;
    const rows = targets.length ? targets.map(t => `<tr><td style="padding:4px 6px;"><b>${esc(t.name)}</b></td><td style="padding:4px 6px;text-align:center;">${results[t.id] === 'failed' ? 'Nausée' : 'Résiste'}</td></tr>`).join("") : `<tr><td colspan="2" style="padding:6px;text-align:center;"><i>Aucune créature détectée dans le nuage.</i></td></tr>`;
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }), content: `
      <div class="add2e-chat-card add2e-magicien-sort add2e-sort-nuage-puant" style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px;"><img src="${esc(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff;"><div style="flex:1;line-height:1.05;"><div style="font-weight:800;font-size:14px;">${esc(casterName)}</div><div style="font-size:12px;font-weight:700;">lance ${esc(SPELL.name)}</div></div><div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">Magicien niv. 2</div><img src="${esc(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;"></div>
        <div style="padding:9px 10px 10px;background:#f6f0ff;"><div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;margin-bottom:7px;"><div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;text-align:center;">Vapeurs nauséabondes</div><table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:13px;"><thead><tr><th style="text-align:left;padding:4px 6px;">Créature</th><th>Effet</th></tr></thead><tbody>${rows}</tbody></table></div>
        <details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;"><summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Détails du sort</summary><div style="margin-top:5px;font-size:12px;line-height:1.35;"><p><b>École :</b> ${esc(SPELL.school)} — <b>Portée :</b> ${esc(SPELL.rangeText)} — <b>Zone :</b> ${esc(SPELL.areaText)}.</p><p><b>Composantes :</b> ${esc(SPELL.componentsText)} — <b>Incantation :</b> ${esc(SPELL.castingTimeText)} — <b>Jet de sauvegarde :</b> ${esc(SPELL.saveText)}.</p><p>${esc(SPELL.description)}</p></div></details></div>
      </div>` });
  }

  if (!sourceItem || !caster || !casterToken) { ui.notifications.warn(`${SPELL.name} : lanceur ou sort introuvable.`); return false; }
  const level = casterLevel();
  const durationRounds = Math.max(1, level);
  const placement = await waitForPlacement();
  if (!placement?.point) { ui.notifications.info(`${SPELL.name} : lancement annulé.`); return false; }
  await playVfx(placement.point);
  const targets = tokensInCircle(placement.point);
  let results = {};
  if (targets.length) {
    results = await askResults(targets, durationRounds);
    if (!results) return false;
    for (const t of targets) if (results[t.id] === "failed") await applyNausea(t.actor, sourceItem, durationRounds);
  }
  await chat(targets, results, durationRounds);
  console.log(`${TAG}[DONE]`, { caster: caster.name, level, durationRounds, targets: targets.map(t => t.name), results });
  return true;
})();
