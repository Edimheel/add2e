// ADD2E — onUse Magicien : Peur
// Version : 2026-05-28-magicien-attaque-n2-peur-cone-v2
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
    description: "Ce sort projette devant le magicien une vague de terreur. Les créatures prises dans la zone doivent réussir un jet de protection contre les sorts, ou fuir le lanceur aussi vite que possible. Les objets tenus peuvent être lâchés selon l’arbitrage du MD."
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
  function browserEventToCanvasPoint(event) {
    const view = canvas.app?.view, renderer = canvas.app?.renderer;
    if (!view || !renderer || typeof PIXI === "undefined") return null;
    const rect = view.getBoundingClientRect();
    const sx = renderer.screen?.width ? renderer.screen.width / rect.width : 1;
    const sy = renderer.screen?.height ? renderer.screen.height / rect.height : 1;
    const global = new PIXI.Point((event.clientX - rect.left) * sx, (event.clientY - rect.top) * sy);
    return canvas.stage?.worldTransform?.applyInverse(global) ?? null;
  }
  function clearRuler() { try { canvas.controls?.ruler?.clear?.(); } catch (_e) {} try { canvas.controls?.ruler?.destroyChildren?.(); } catch (_e) {} }
  function parentLayer() { return canvas.interface ?? canvas.controls ?? canvas.stage; }
  function canvasRadiansToFoundryRotation(rad) { return (rad * 180 / Math.PI + 90 + 360) % 360; }
  function foundryRotationToCanvasRadians(deg) { return (n(deg,0) - 90) * Math.PI / 180; }
  function angleDiffDegrees(a,b) { return Math.abs(((b - a + 540) % 360) - 180); }

  function drawCone(g, directionDeg) {
    const c = casterToken.center ?? { x: casterToken.document.x, y: casterToken.document.y };
    const r = metersToPx(SPELL.coneDistanceMeters);
    const dir = foundryRotationToCanvasRadians(directionDeg);
    const half = (SPELL.coneAngle / 2) * Math.PI / 180;
    const start = dir - half, end = dir + half;
    g.clear();
    g.lineStyle(3, 0x8e63c7, 0.95);
    g.beginFill(0x6c31b5, 0.24);
    g.moveTo(c.x, c.y); g.arc(c.x, c.y, r, start, end); g.lineTo(c.x, c.y); g.endFill();
    g.lineStyle(2, 0xd8c3ff, 0.9);
    g.moveTo(c.x, c.y); g.lineTo(c.x + Math.cos(start) * r, c.y + Math.sin(start) * r);
    g.moveTo(c.x, c.y); g.lineTo(c.x + Math.cos(end) * r, c.y + Math.sin(end) * r);
  }

  async function waitForConePlacement() {
    const view = canvas.app?.view, parent = parentLayer();
    if (!view || !parent || typeof PIXI === "undefined") return null;
    clearRuler();
    const previous = parent.getChildByName?.("add2e-peur-cone");
    if (previous) previous.destroy({ children: true });
    const g = new PIXI.Graphics(); g.name = "add2e-peur-cone"; g.zIndex = 100000; g.eventMode = "none"; parent.sortableChildren = true; parent.addChild(g);
    const c = casterToken.center ?? { x: casterToken.document.x, y: casterToken.document.y };
    let direction = n(casterToken.document?.rotation, 0);
    const oldCursor = view.style.cursor; view.style.cursor = "crosshair";
    ui.notifications.info(`${SPELL.name} : oriente le cône, clic gauche pour valider, clic droit ou Échap pour annuler.`);
    return await new Promise(resolve => {
      let done = false;
      const cleanup = (result, keep=false) => {
        if (done) return; done = true;
        view.removeEventListener("mousemove", onMove, true); view.removeEventListener("mousedown", onDown, true); view.removeEventListener("contextmenu", onContext, true); window.removeEventListener("keydown", onKey, true);
        view.style.cursor = oldCursor; clearRuler();
        if (keep) window.setTimeout(() => { if (!g.destroyed) g.destroy({ children:true }); clearRuler(); }, 6000); else if (!g.destroyed) g.destroy({ children:true });
        resolve(result);
      };
      const update = e => { const p = browserEventToCanvasPoint(e); if (!p) return; direction = canvasRadiansToFoundryRotation(Math.atan2(p.y - c.y, p.x - c.x)); drawCone(g, direction); };
      function onMove(e){ update(e); }
      function onDown(e){ e.preventDefault(); e.stopPropagation(); if (e.button === 2) return cleanup(null); if (e.button !== 0) return; update(e); cleanup({ direction }, true); }
      function onContext(e){ e.preventDefault(); e.stopPropagation(); cleanup(null); }
      function onKey(e){ if (e.key !== "Escape") return; e.preventDefault(); e.stopPropagation(); cleanup(null); }
      drawCone(g, direction);
      view.addEventListener("mousemove", onMove, true); view.addEventListener("mousedown", onDown, true); view.addEventListener("contextmenu", onContext, true); window.addEventListener("keydown", onKey, true);
    });
  }

  function tokenSamplePoints(t) {
    const x = t.document.x, y = t.document.y, w = t.w ?? ((t.document.width || 1) * gridSizePx()), h = t.h ?? ((t.document.height || 1) * gridSizePx());
    return [{x:x+w/2,y:y+h/2},{x,y},{x:x+w,y},{x,y:y+h},{x:x+w,y:y+h},{x:x+w/2,y},{x:x+w/2,y:y+h},{x,y:y+h/2},{x:x+w,y:y+h/2}];
  }
  function bearingToPoint(point) { const c = casterToken.center ?? { x: casterToken.document.x, y: casterToken.document.y }; return (Math.atan2(point.y - c.y, point.x - c.x) * 180 / Math.PI + 90 + 360) % 360; }
  function pointInCone(point, direction) { const c = casterToken.center ?? { x: casterToken.document.x, y: casterToken.document.y }; const dist = Math.hypot(point.x - c.x, point.y - c.y); return dist <= metersToPx(SPELL.coneDistanceMeters) && angleDiffDegrees(direction, bearingToPoint(point)) <= SPELL.coneAngle / 2; }
  function tokensInCone(direction) { return canvas.tokens.placeables.filter(t => t.visible && t.actor && t.id !== casterToken.id && t.actor.id !== caster?.id).filter(t => tokenSamplePoints(t).some(p => pointInCone(p, direction))); }

  async function playVfx(direction) {
    if (typeof Sequence !== "undefined") {
      try { await new Sequence().effect().file("jb2a.fear.01.purple").atLocation(casterToken).rotate(direction).duration(2500).play(); return true; } catch (err) { console.warn(`${TAG}[VFX_SEQUENCE_FAILED]`, err); }
    }
    return false;
  }

  async function askResults(targets, durationRounds) {
    const DialogV2 = foundry?.applications?.api?.DialogV2;
    if (!DialogV2?.wait) { ui.notifications.error(`${SPELL.name} : DialogV2 indisponible.`); return null; }
    const rows = targets.map(t => `<label style="display:grid;grid-template-columns:34px 1fr 120px;gap:8px;align-items:center;border:1px solid #8e63c7;border-radius:7px;background:#fffaff;padding:6px;margin-bottom:5px;"><img src="${esc(t.document?.texture?.src || t.actor?.img || 'icons/svg/mystery-man.svg')}" style="width:32px;height:32px;border-radius:5px;object-fit:cover;"><span style="font-weight:900;color:#2d2144;">${esc(t.name)}</span><select name="target.${esc(t.id)}" style="width:100%;"><option value="failed">JP raté</option><option value="saved">JP réussi</option></select></label>`).join("");
    return await DialogV2.wait({ window: { title: SPELL.name, icon: "fas fa-ghost" }, modal: true, rejectClose: false, content: `<form style="min-width:430px;max-width:560px;font-family:var(--font-primary);color:#2d2144;"><section style="border:1px solid #8e63c7;border-radius:9px;background:#f6f0ff;padding:8px;margin-bottom:8px;text-align:center;"><b style="color:#6c31b5;text-transform:uppercase;">Peur</b><br><span style="font-size:12px;">Cibles détectées dans le cône. Durée : ${durationRounds} round${durationRounds>1?'s':''}.</span></section>${rows}</form>`, buttons: [{ action: "apply", label: "Appliquer", icon: "fas fa-check", default: true, callback: (_e,_b,dialog) => { const form = dialog.element?.querySelector("form"); const data = new FormData(form); return Object.fromEntries(targets.map(t => [t.id, data.get(`target.${t.id}`) || "failed"])); } }, { action: "cancel", label: "Annuler", icon: "fas fa-times", callback: () => null }] });
  }

  async function applyFear(targetActor, sourceItem, durationRounds) {
    if (!targetActor) return false;
    const existing = targetActor.effects?.filter?.(e => e.flags?.add2e?.spell === SPELL.slug) ?? [];
    for (const e of existing) await e.delete();
    await targetActor.createEmbeddedDocuments("ActiveEffect", [{ name: `${SPELL.name} — effrayé`, img: sourceItem?.img || SPELL.imgFallback, disabled: false, transfer: false, type: "base", system: {}, changes: [], duration: { rounds: durationRounds, startRound: game.combat?.round ?? null, startTime: game.time?.worldTime ?? null, combat: game.combat?.id ?? null }, description: SPELL.description, flags: { add2e: { spell: SPELL.slug, tags: ["classe:magicien","liste:magicien","niveau:2","sort:peur","type:condition","etat:peur","fuite"] } } }]);
    return true;
  }

  async function chat(targets, results, durationRounds) {
    const casterName = caster?.name ?? casterToken?.name ?? "Magicien";
    const casterImg = casterToken?.document?.texture?.src ?? caster?.img ?? "icons/svg/mystery-man.svg";
    const spellImg = sourceItem?.img || SPELL.imgFallback;
    const rows = targets.length ? targets.map(t => `<tr><td style="padding:4px 6px;"><b>${esc(t.name)}</b></td><td style="padding:4px 6px;text-align:center;">${results[t.id] === 'failed' ? 'Fuit' : 'Résiste'}</td></tr>`).join("") : `<tr><td colspan="2" style="padding:6px;text-align:center;"><i>Aucune créature détectée dans le cône.</i></td></tr>`;
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }), content: `<div class="add2e-chat-card add2e-magicien-sort add2e-sort-peur" style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary);"><div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px;"><img src="${esc(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff;"><div style="flex:1;line-height:1.05;"><div style="font-weight:800;font-size:14px;">${esc(casterName)}</div><div style="font-size:12px;font-weight:700;">lance ${esc(SPELL.name)}</div></div><div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">Magicien niv. 2</div><img src="${esc(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;"></div><div style="padding:9px 10px 10px;background:#f6f0ff;"><div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;margin-bottom:7px;"><div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;text-align:center;">Terreur magique</div><table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:13px;"><thead><tr><th style="text-align:left;padding:4px 6px;">Créature</th><th>Résultat</th></tr></thead><tbody>${rows}</tbody></table>${durationRounds ? `<p style="font-size:12px;text-align:center;margin:.5em 0 0;">Durée des effets : ${durationRounds} round${durationRounds>1?'s':''}.</p>` : ''}</div><details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;"><summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Détails du sort</summary><div style="margin-top:5px;font-size:12px;line-height:1.35;"><p><b>École :</b> ${esc(SPELL.school)} — <b>Portée :</b> ${esc(SPELL.rangeText)} — <b>Zone :</b> ${esc(SPELL.areaText)}.</p><p><b>Composantes :</b> ${esc(SPELL.componentsText)} — <b>Incantation :</b> ${esc(SPELL.castingTimeText)} — <b>Jet de sauvegarde :</b> ${esc(SPELL.saveText)}.</p><p>${esc(SPELL.description)}</p></div></details></div></div>` });
  }

  if (!sourceItem || !caster || !casterToken) { ui.notifications.warn(`${SPELL.name} : lanceur ou sort introuvable.`); return false; }
  const level = casterLevel();
  const durationRounds = Math.max(1, level);
  const placement = await waitForConePlacement();
  if (!placement) { ui.notifications.info(`${SPELL.name} : lancement annulé.`); return false; }
  await playVfx(placement.direction);
  const targets = tokensInCone(placement.direction);
  let results = {};
  if (targets.length) {
    results = await askResults(targets, durationRounds);
    if (!results) return false;
    for (const t of targets) if (results[t.id] === "failed") await applyFear(t.actor, sourceItem, durationRounds);
  }
  await chat(targets, results, durationRounds);
  console.log(`${TAG}[DONE]`, { caster: caster.name, level, durationRounds, direction: placement.direction, targets: targets.map(t => t.name), results });
  return true;
})();
