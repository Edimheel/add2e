console.log("%c[ADD2E][TENSER] v14.2 (Follow Fix)", "color:#a173d9;font-weight:bold;");

return await (async () => {
  let _item = null;
  if (typeof item !== "undefined" && item?.name) _item = item;
  else if (typeof arguments !== "undefined" && arguments?.length > 1 && arguments[1]?.name) _item = arguments[1];
  if (!_item) return ui.notifications.warn("Sort introuvable.");

  const caster = actor ?? _item?.parent;
  if (!caster) return ui.notifications.warn("Lanceur introuvable.");
  if (!canvas?.scene) return ui.notifications.warn("Aucune scène active.");

  const casterToken = canvas.tokens?.controlled?.find(t => t.actor?.id === caster.id) ?? caster?.getActiveTokens?.(true, true)?.[0] ?? null;
  if (!casterToken?.document) return ui.notifications.warn("Le lanceur doit avoir un token sur la scène.");

  const sceneId = canvas.scene.id;
  const emitToGM = (payload) => {
    if (game.add2e?.requestGM) return game.add2e.requestGM(payload);
    return game.socket?.emit("system.add2e", payload);
  };

  const info = _item.system ?? {};
  const niveauPerso = Number(caster.system?.niveau ?? caster.system?.attributes?.level?.value ?? 1) || 1;
  const dureeRounds = (3 + niveauPerso) * 10;
  const capaciteKg  = niveauPerso * 50;

  const durationData = {
    rounds: dureeRounds,
    startRound: game.combat?.round ?? null,
    startTurn:  game.combat?.turn  ?? null
  };

  const discImg = _item.img || "icons/magic/movement/chevrons-down-yellow.webp";

  // Calcul Offset
  const gridSize = canvas.grid?.size ?? 100;
  const tokenW = Number(casterToken.document.width ?? 1);
  const paddingPx = Math.max(4, Math.floor(gridSize * 0.05));
  const offsetX = (gridSize * tokenW) + paddingPx;
  const offsetY = 0;
  const discX = Number(casterToken.document.x) + offsetX;
  const discY = Number(casterToken.document.y) + offsetY;

  // Purge silencieuse
  try {
    const existing = caster.effects?.find(e => (e?.name || "") === "Disque flottant de Tenser") ?? null;
    if (existing) {
      const p = existing.flags?.add2e?.tenserPayload;
      try {
        const flags = foundry.utils.duplicate(existing.flags || {});
        flags.add2e = flags.add2e || {};
        flags.add2e.tenserPayload = flags.add2e.tenserPayload || {};
        flags.add2e.tenserPayload.__silentCleanup = true;
        await existing.update({ flags }, { _fromSync: true });
      } catch (e) {}
      if (p?.sceneId && p?.discTokenId) {
        emitToGM({ type: "deleteToken", sceneId: p.sceneId, tokenId: p.discTokenId, fromUserId: game.user.id });
      }
      await existing.delete();
    }
  } catch (e) {}

  // Token Data avec Flags
  const tokenData = {
    name: `Disque de ${caster.name}`,
    x: discX, y: discY, elevation: casterToken.document.elevation ?? 0,
    width: 1, height: 1, alpha: 0.9, lockRotation: true, actorId: null,
    img: discImg, texture: { src: discImg, scaleX: 0.8, scaleY: 0.8 },
    disposition: 1, scale: 0.8,
    flags: {
      add2e: {
        spellName: "Disque flottant de Tenser",
        summonedBy: caster.id,
        summonFollow: {
          kind: "tenser",
          casterTokenId: casterToken.document.id, // ID du token à suivre
          offsetX: offsetX,
          offsetY: offsetY,
          sceneId: sceneId
        }
      }
    }
  };

  const formatVal = (val) => {
    if (typeof globalThis.formatSortChamp === "function") return globalThis.formatSortChamp(val, niveauPerso);
    if (typeof val === "object" && val !== null) return (val.valeur || "") + " " + (val.unite || "");
    return val || "-";
  };

  const chatContent = `
    <div class="add2e-spell-card" style="border-radius:12px; box-shadow:0 4px 10px #715aab44; background:linear-gradient(135deg, #fdfbfd 0%, #f4efff 100%); border:1.5px solid #9373c7; margin:0.3em 0; padding:0; font-family:var(--font-primary); overflow:hidden;">
      <div style="background:linear-gradient(90deg, #6a3c99 0%, #8e44ad 100%); padding:8px 12px; display:flex; align-items:center; gap:10px; color:white; border-bottom:2px solid #5e35b1;">
        <img src="${caster.img}" style="width:36px; height:36px; border-radius:50%; border:2px solid #fff; object-fit:cover;">
        <div><div style="font-weight:bold; font-size:1.05em;">${caster.name}</div><div style="font-size:0.85em; opacity:0.9;">lance <span style="font-weight:bold; color:#f1c40f;">${_item.name}</span></div></div>
        <img src="${_item.img}" style="width:32px; height:32px; margin-left:auto; border-radius:4px; background:#fff;">
      </div>
      <div style="padding:10px;"><div style="background:#eafaf1; border:1px solid #ccebd9; border-radius:6px; padding:6px; text-align:center;"><span style="color:#27ae60; font-weight:bold; font-size:1.1em;">💿 Disque invoqué</span><div style="font-size:0.85em; color:#555; margin-top:2px;">Capacité : ${capaciteKg} kg</div></div></div>
    </div>
  `;

  const effectData = {
    name: "Disque flottant de Tenser",
    icon: discImg,
    origin: _item.uuid,
    duration: durationData,
    description: `Maintient le disque (${capaciteKg} kg max).`,
    flags: {
      add2e: {
        tenserPayload: {
          discTokenId: null,
          sceneId,
          capacityKg: capaciteKg,
          casterTokenId: casterToken.document.id,
          offsetX, offsetY
        }
      }
    }
  };

  const payload = {
    type: "gmCreateDoc",
    op: "gmCreateDoc",
    documentType: "Token",
    sceneId,
    documentData: tokenData,
    effectActorId: caster.id,
    effectData,
    linkFlagPath: "add2e.tenserPayload.discTokenId",
    chatData: { actorId: caster.id, content: chatContent, style: CONST.CHAT_MESSAGE_STYLES.OTHER },
    fromUserId: game.user.id
  };

  emitToGM(payload);
  return true;
})();