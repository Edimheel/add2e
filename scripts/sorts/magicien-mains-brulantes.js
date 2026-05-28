// ADD2E — onUse Magicien : Mains brûlantes
// Version : 2026-05-28-groupe-a-portee-zone-charte-v1
// Contrat : return true = sort consommé ; return false = sort non consommé.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][MAINS_BRULANTES]";
  const SPELL = {
    name: "Mains brûlantes",
    slug: "mains_brulantes",
    level: 1,
    school: "Altération",
    rangeText: "0",
    areaText: "cône frontal de 120°, longueur 1 m",
    saveText: "Aucun",
    castingTimeText: "1 segment",
    damageType: "feu",
    coneDistance: 1,
    coneAngle: 120,
    imgFallback: "systems/add2e/assets/icones/sorts/mains-brulantes.webp"
  };

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function n(value, fallback = 0) {
    const out = Number(value);
    return Number.isFinite(out) ? out : fallback;
  }

  function sourceItemFromContext() {
    if (typeof item !== "undefined" && item) return item;
    if (typeof sort !== "undefined" && sort) return sort;
    if (typeof spell !== "undefined" && spell) return spell;
    if (typeof args !== "undefined" && args?.[0]?.item) return args[0].item;
    if (typeof this !== "undefined" && this?.documentName === "Item") return this;
    return null;
  }

  function casterFromContext(sourceItem) {
    return (typeof actor !== "undefined" && actor) ? actor : sourceItem?.parent;
  }

  function casterTokenFor(caster) {
    if (typeof token !== "undefined" && token?.actor?.id === caster?.id) return token;
    return canvas.tokens?.controlled?.find(t => t.actor?.id === caster?.id)
      ?? caster?.getActiveTokens?.()[0]
      ?? canvas.tokens?.controlled?.[0]
      ?? null;
  }

  function casterLevel(caster) {
    const details = caster?.system?.details_classe ?? {};
    const byClass = n(details.magicien?.niveau ?? details.mage?.niveau ?? details.illusionniste?.niveau, 0);
    if (byClass > 0) return byClass;
    const classItem = caster?.items?.find?.(i => String(i.type).toLowerCase() === "classe" && /magicien|mage|illusionniste/i.test(i.name ?? ""));
    const byItem = n(classItem?.system?.niveau ?? classItem?.system?.level, 0);
    return byItem > 0 ? byItem : Math.max(1, n(caster?.system?.niveau ?? caster?.system?.level ?? caster?.system?.details?.niveau, 1));
  }

  function gridDistanceBetween(a, b) {
    const gridSize = canvas.grid?.size || 100;
    const sceneDistance = n(canvas.scene?.grid?.distance, 1);
    const dx = (b.x ?? 0) - (a.x ?? 0);
    const dy = (b.y ?? 0) - (a.y ?? 0);
    return Math.hypot(dx, dy) / gridSize * sceneDistance;
  }

  function angleDiffDegrees(a, b) {
    let d = ((b - a + 540) % 360) - 180;
    return Math.abs(d);
  }

  function tokenBearingFromFacing(sourceToken, targetToken) {
    const sx = sourceToken.center?.x ?? (sourceToken.document.x + sourceToken.w / 2);
    const sy = sourceToken.center?.y ?? (sourceToken.document.y + sourceToken.h / 2);
    const tx = targetToken.center?.x ?? (targetToken.document.x + targetToken.w / 2);
    const ty = targetToken.center?.y ?? (targetToken.document.y + targetToken.h / 2);
    const radians = Math.atan2(ty - sy, tx - sx);
    return (radians * 180 / Math.PI + 90 + 360) % 360;
  }

  function tokensInCone(sourceToken) {
    const sourceCenter = sourceToken.center ?? { x: sourceToken.document.x, y: sourceToken.document.y };
    const direction = n(sourceToken.document?.rotation, 0);
    const half = SPELL.coneAngle / 2;
    return canvas.tokens.placeables
      .filter(t => t.visible && t.actor && t.id !== sourceToken.id && t.actor.id !== sourceToken.actor?.id)
      .filter(t => {
        const targetCenter = t.center ?? { x: t.document.x, y: t.document.y };
        const distance = gridDistanceBetween(sourceCenter, targetCenter);
        if (distance > SPELL.coneDistance) return false;
        const bearing = tokenBearingFromFacing(sourceToken, t);
        return angleDiffDegrees(direction, bearing) <= half;
      });
  }

  function emitGmOperation(operation, payload) {
    game.socket?.emit?.("system.add2e", { type: "ADD2E_GM_OPERATION", operation, payload });
  }

  async function createConeTemplate(sourceToken, sourceItem) {
    const templateRequestId = foundry.utils.randomID();
    const templateData = {
      t: "cone",
      user: game.user.id,
      x: sourceToken.center?.x ?? sourceToken.document.x,
      y: sourceToken.center?.y ?? sourceToken.document.y,
      direction: n(sourceToken.document?.rotation, 0),
      distance: SPELL.coneDistance,
      angle: SPELL.coneAngle,
      fillColor: game.user.color ?? "#8e63c7",
      flags: {
        add2e: {
          spell: SPELL.slug,
          spellName: SPELL.name,
          sourceItemId: sourceItem?.id ?? null,
          sourceItemUuid: sourceItem?.uuid ?? null,
          templateRequestId
        }
      }
    };

    if (game.user.isGM) {
      await canvas.scene?.createEmbeddedDocuments?.("MeasuredTemplate", [templateData]);
    } else {
      emitGmOperation("createMeasuredTemplate", {
        sceneId: canvas.scene?.id,
        spell: SPELL.slug,
        spellName: SPELL.name,
        templateRequestId,
        templateData
      });
    }
  }

  async function applyDamage(targetToken, amount, caster, sourceItem) {
    if (!targetToken?.actor || amount <= 0) return false;
    const payload = {
      actorUuid: targetToken.actor.uuid,
      actorId: targetToken.actor.id,
      sceneId: canvas.scene?.id,
      tokenId: targetToken.document?.id ?? targetToken.id,
      montant: amount,
      type: SPELL.damageType,
      details: `${SPELL.name} — ${amount} dégât${amount > 1 ? "s" : ""} de feu`,
      sourceItemId: sourceItem?.id ?? null,
      sourceItemUuid: sourceItem?.uuid ?? null,
      casterId: caster?.id ?? null,
      casterUuid: caster?.uuid ?? null
    };

    if (typeof globalThis.add2eApplyDamage === "function") {
      await globalThis.add2eApplyDamage({ cible: targetToken, montant: amount, type: SPELL.damageType, details: payload.details });
      return true;
    }

    if (game.user.isGM || targetToken.actor.isOwner) {
      const sys = targetToken.actor.system ?? {};
      const current = [sys.pdv, sys.pv, sys.hp?.value, sys.attributes?.hp?.value].map(Number).find(Number.isFinite);
      if (current !== undefined) {
        await targetToken.actor.update({ "system.pdv": current - amount }, { add2eReason: "mains-brulantes" });
        return true;
      }
    }

    emitGmOperation("applyDamage", payload);
    return true;
  }

  async function createChat({ caster, sourceItem, sourceToken, affected, damage }) {
    const casterName = caster?.name ?? sourceToken?.name ?? "Magicien";
    const casterImg = sourceToken?.document?.texture?.src ?? caster?.img ?? "icons/svg/mystery-man.svg";
    const spellImg = sourceItem?.img || SPELL.imgFallback || "icons/svg/fire.svg";
    const rows = affected.length
      ? affected.map(t => `<tr><td style="padding:4px 6px;"><b>${esc(t.name)}</b></td><td style="padding:4px 6px;text-align:right;"><b>${damage}</b></td></tr>`).join("")
      : `<tr><td colspan="2" style="padding:6px;text-align:center;"><i>Aucune créature détectée automatiquement dans le cône.</i></td></tr>`;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster, token: sourceToken }),
      content: `
        <div class="add2e-chat-card add2e-magicien-sort add2e-sort-mains-brulantes"
             style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary);">
          <div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px;">
            <img src="${esc(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff;" />
            <div style="flex:1;line-height:1.05;">
              <div style="font-weight:800;font-size:14px;">${esc(casterName)}</div>
              <div style="font-size:12px;font-weight:700;">lance ${esc(SPELL.name)}</div>
            </div>
            <div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">Magicien niv. 1</div>
            <img src="${esc(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;" />
          </div>
          <div style="padding:9px 10px 10px 10px;background:#f6f0ff;">
            <div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;margin-bottom:7px;">
              <div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;text-align:center;">Cône de flammes</div>
              <p style="margin:.35em 0;font-size:13px;line-height:1.35;"><b>Zone :</b> ${esc(SPELL.areaText)} depuis le lanceur. <b>Portée :</b> ${esc(SPELL.rangeText)}.</p>
              <p style="margin:.35em 0;font-size:13px;line-height:1.35;"><b>Dégâts :</b> ${damage} point${damage > 1 ? "s" : ""} de feu par créature dans la zone. <b>Jet de sauvegarde :</b> aucun.</p>
              <table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:13px;">
                <thead><tr><th style="text-align:left;padding:4px 6px;">Créature dans le cône</th><th style="text-align:right;padding:4px 6px;">Dégâts</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            <details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;margin-top:7px;">
              <summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Paramètres du sort</summary>
              <div style="margin-top:5px;font-size:12px;line-height:1.35;">
                <p><b>École :</b> ${esc(SPELL.school)} — <b>Incantation :</b> ${esc(SPELL.castingTimeText)}.</p>
                <p>Les matières inflammables dans la zone peuvent s’enflammer selon l’arbitrage du MD.</p>
              </div>
            </details>
          </div>
        </div>`
    });
  }

  const sourceItem = sourceItemFromContext();
  const caster = casterFromContext(sourceItem);
  const sourceToken = casterTokenFor(caster);

  if (!sourceItem) {
    ui.notifications.warn(`${SPELL.name} : sort introuvable.`);
    return false;
  }
  if (!caster || !sourceToken) {
    ui.notifications.warn(`${SPELL.name} : lanceur ou token lanceur introuvable.`);
    return false;
  }

  const level = casterLevel(caster);
  const damage = Math.max(1, level);
  const affected = tokensInCone(sourceToken);

  console.log(`${TAG}[START]`, {
    caster: caster.name,
    token: sourceToken.name,
    level,
    damage,
    range: SPELL.rangeText,
    coneDistance: SPELL.coneDistance,
    coneAngle: SPELL.coneAngle,
    affected: affected.map(t => t.name)
  });

  await createConeTemplate(sourceToken, sourceItem);
  for (const targetToken of affected) await applyDamage(targetToken, damage, caster, sourceItem);
  await createChat({ caster, sourceItem, sourceToken, affected, damage });

  return true;
})();
