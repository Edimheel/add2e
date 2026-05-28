// ADD2E — onUse Magicien : Missile magique
// Version : 2026-05-28-groupe-a-portee-zone-charte-v1
// Contrat : return true = sort consommé ; return false = sort non consommé.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][MISSILE_MAGIQUE]";
  const SPELL = {
    name: "Missile magique",
    slug: "missile_magique",
    level: 1,
    school: "Évocation",
    rangeText: "45 m + 1,5 m par niveau",
    areaText: "une ou plusieurs créatures dans la portée",
    saveText: "Aucun",
    castingTimeText: "1 segment",
    damageType: "force",
    imgFallback: "systems/add2e/assets/icones/sorts/missile_magique.webp"
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

  function casterLevel(caster, sourceItem) {
    if (sourceItem?.system?.isPower) return Math.max(1, n(sourceItem.system.niveau, 1));
    const details = caster?.system?.details_classe ?? {};
    const byClass = n(details.magicien?.niveau ?? details.mage?.niveau ?? details.illusionniste?.niveau, 0);
    if (byClass > 0) return byClass;
    const classItem = caster?.items?.find?.(i => String(i.type).toLowerCase() === "classe" && /magicien|mage|illusionniste/i.test(i.name ?? ""));
    const byItem = n(classItem?.system?.niveau ?? classItem?.system?.level, 0);
    return byItem > 0 ? byItem : Math.max(1, n(caster?.system?.niveau ?? caster?.system?.level ?? caster?.system?.details?.niveau, 1));
  }

  function spellRange(level) {
    return 45 + 1.5 * Math.max(1, level);
  }

  function sceneDistanceBetween(a, b) {
    const gridSize = canvas.grid?.size || 100;
    const sceneDistance = n(canvas.scene?.grid?.distance, 1);
    const ax = a?.x ?? 0;
    const ay = a?.y ?? 0;
    const bx = b?.x ?? 0;
    const by = b?.y ?? 0;
    return Math.hypot(bx - ax, by - ay) / gridSize * sceneDistance;
  }

  function tokenDistance(sourceToken, targetToken) {
    const sourceCenter = sourceToken.center ?? { x: sourceToken.document.x, y: sourceToken.document.y };
    const targetCenter = targetToken.center ?? { x: targetToken.document.x, y: targetToken.document.y };
    return sceneDistanceBetween(sourceCenter, targetCenter);
  }

  function emitGmOperation(operation, payload) {
    game.socket?.emit?.("system.add2e", { type: "ADD2E_GM_OPERATION", operation, payload });
  }

  async function refundObjectChargeIfNeeded(sourceItem, caster, reason = "") {
    if (reason) ui.notifications.warn(reason);
    try {
      if (!sourceItem?.system?.isPower || !sourceItem?.system?.sourceWeaponId) return false;
      const weapon = caster.items?.get(sourceItem.system.sourceWeaponId);
      if (!weapon) return false;

      const currentGlobal = await weapon.getFlag?.("add2e", "global_charges");
      if (currentGlobal !== undefined) {
        await weapon.setFlag("add2e", "global_charges", n(currentGlobal) + 1);
        ui.notifications.info(`Charge restituée à ${weapon.name}.`);
        return true;
      }

      const idx = sourceItem.system.powerIndex;
      const currentIndiv = await weapon.getFlag?.("add2e", `charges_${idx}`);
      if (currentIndiv !== undefined) {
        await weapon.setFlag("add2e", `charges_${idx}`, n(currentIndiv) + 1);
        ui.notifications.info("Charge restituée.");
        return true;
      }
    } catch (err) {
      console.warn(`${TAG}[REFUND_FAILED]`, err);
    }
    return false;
  }

  function isShieldedAgainstMagicMissile(targetActor) {
    return targetActor?.effects?.some?.(effect => {
      const tags = Array.isArray(effect.flags?.add2e?.tags) ? effect.flags.add2e.tags : [];
      const name = String(effect.name || effect.label || "").toLowerCase();
      return tags.includes("immunite:missile_magique")
        || tags.includes("missile_magique:immunite")
        || tags.includes("bouclier")
        || name.includes("bouclier");
    }) === true;
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
      details: `${SPELL.name} — ${amount} dégât${amount > 1 ? "s" : ""} de force`,
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
        await targetToken.actor.update({ "system.pdv": current - amount }, { add2eReason: "missile-magique" });
        return true;
      }
    }

    emitGmOperation("applyDamage", payload);
    return true;
  }

  async function playMissileVfx(sourceToken, targetToken, missileIndex) {
    if (typeof Sequence === "undefined" || !sourceToken || !targetToken) return;
    try {
      await new Sequence()
        .effect()
        .file("jb2a.magic_missile.purple")
        .atLocation(sourceToken)
        .stretchTo(targetToken)
        .randomizeMirrorY()
        .delay(missileIndex * 160)
        .missed(false)
        .play();
    } catch (err) {
      console.warn(`${TAG}[VFX_FAILED]`, err);
    }
  }

  async function askDistribution({ candidates, nbMissiles, selectedIds, sourceItem, range }) {
    const DialogV2 = foundry?.applications?.api?.DialogV2;
    if (!DialogV2?.wait) {
      ui.notifications.error("Missile magique : DialogV2 indisponible.");
      return null;
    }

    const defaultDistribution = new Map();
    const selectedCandidates = candidates.filter(t => selectedIds.has(t.id));
    const preferred = selectedCandidates.length ? selectedCandidates : candidates.slice(0, 1);
    let remaining = nbMissiles;
    for (const t of preferred) {
      if (remaining <= 0) break;
      defaultDistribution.set(t.id, 1);
      remaining--;
    }
    if (preferred.length === 1 && remaining > 0) defaultDistribution.set(preferred[0].id, (defaultDistribution.get(preferred[0].id) || 0) + remaining);

    const rows = candidates.map(t => {
      const selected = selectedIds.has(t.id);
      const value = defaultDistribution.get(t.id) || 0;
      return `
        <div class="add2e-mm-target" style="display:grid;grid-template-columns:34px minmax(0,1fr) 54px;gap:8px;align-items:center;padding:5px;border:1px solid #8e63c7;border-radius:6px;background:#fffaff;margin-bottom:5px;">
          <img src="${esc(t.document?.texture?.src || t.actor?.img || 'icons/svg/mystery-man.svg')}" style="width:30px;height:30px;border-radius:4px;object-fit:cover;background:#fff;">
          <label style="font-weight:800;color:#2d2144;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(t.name)}${selected ? ' <span style="font-weight:600;color:#6c31b5;">— ciblée</span>' : ''}<br><span style="font-size:11px;font-weight:600;color:#4a2e78;">${tokenDistance(candidates.__sourceToken, t).toFixed(1)} m / ${range.toFixed(1)} m</span></label>
          <input type="number" name="target.${esc(t.id)}" min="0" max="${nbMissiles}" value="${value}" style="width:50px;text-align:center;">
        </div>`;
    }).join("");

    const content = `
      <form class="add2e-mm-dialog" style="font-family:var(--font-primary);color:#2d2144;">
        <div style="border:1px solid #8e63c7;border-radius:8px;background:#f6f0ff;padding:8px;margin-bottom:8px;">
          <div style="font-weight:900;color:#6c31b5;text-align:center;text-transform:uppercase;letter-spacing:.3px;">${nbMissiles} missile${nbMissiles > 1 ? "s" : ""} à répartir</div>
          <div style="font-size:12px;text-align:center;margin-top:4px;">Portée vérifiée : ${range.toFixed(1)} m. Les cibles hors portée ne sont pas proposées.</div>
        </div>
        ${rows}
        <p style="font-size:12px;margin:.4em 0 0 0;color:#4a2e78;">Tous les missiles assignés touchent automatiquement, sauf immunité active comme Bouclier.</p>
      </form>`;

    return await DialogV2.wait({
      window: { title: "Missile magique — répartition" },
      content,
      modal: true,
      rejectClose: false,
      buttons: [
        {
          action: "cast",
          label: "Lancer",
          icon: "fas fa-magic",
          default: true,
          callback: (_event, _button, dialog) => {
            const form = dialog.element?.querySelector?.("form");
            const data = new FormData(form);
            const result = {};
            let total = 0;
            for (const t of candidates) {
              const value = Math.max(0, Math.floor(Number(data.get(`target.${t.id}`)) || 0));
              if (value > 0) {
                result[t.id] = value;
                total += value;
              }
            }
            if (total <= 0) {
              ui.notifications.warn("Aucun missile assigné.");
              return null;
            }
            if (total > nbMissiles) {
              ui.notifications.warn(`Trop de missiles assignés : ${total}/${nbMissiles}.`);
              return null;
            }
            return { result, total };
          }
        },
        { action: "cancel", label: "Annuler", icon: "fas fa-times", callback: () => null }
      ]
    });
  }

  async function createChat({ caster, sourceItem, sourceToken, summaries, totalAssigned, nbMissiles, range }) {
    const casterName = caster?.name ?? sourceToken?.name ?? "Magicien";
    const casterImg = sourceToken?.document?.texture?.src ?? caster?.img ?? "icons/svg/mystery-man.svg";
    const spellImg = sourceItem?.img || SPELL.imgFallback || "icons/svg/magic.svg";
    const rows = summaries.length
      ? summaries.map(m => `<tr><td style="padding:4px 6px;"><b>${esc(m.name)}</b></td><td style="text-align:center;padding:4px 6px;">${m.nb}</td><td style="padding:4px 6px;">${m.rolls.map(esc).join(" + ")}</td><td style="padding:4px 6px;text-align:right;"><b>${m.dmg}</b></td></tr>`).join("")
      : `<tr><td colspan="4" style="padding:6px;text-align:center;"><i>Aucun missile résolu.</i></td></tr>`;
    const unused = Math.max(0, nbMissiles - totalAssigned);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster, token: sourceToken }),
      content: `
        <div class="add2e-chat-card add2e-magicien-sort add2e-sort-missile-magique"
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
              <div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;text-align:center;">Projectiles de force</div>
              <p style="margin:.35em 0;font-size:13px;line-height:1.35;"><b>${totalAssigned}</b> missile${totalAssigned > 1 ? "s" : ""} lancé${totalAssigned > 1 ? "s" : ""}. ${unused ? `<b>${unused}</b> non assigné${unused > 1 ? "s" : ""}.` : ""}</p>
              <table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:13px;">
                <thead><tr><th style="text-align:left;padding:4px 6px;">Cible</th><th>Qté</th><th>Dés</th><th style="text-align:right;padding:4px 6px;">Dégâts</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            <details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;margin-top:7px;">
              <summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Paramètres du sort</summary>
              <div style="margin-top:5px;font-size:12px;line-height:1.35;">
                <p><b>École :</b> ${esc(SPELL.school)} — <b>Portée :</b> ${esc(SPELL.rangeText)} = ${range.toFixed(1)} m.</p>
                <p><b>Zone :</b> ${esc(SPELL.areaText)} — <b>Incantation :</b> ${esc(SPELL.castingTimeText)} — <b>Jet de sauvegarde :</b> ${esc(SPELL.saveText)}.</p>
                <p>Les cibles hors portée sont exclues avant la répartition. Bouclier annule les missiles magiques.</p>
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
    await refundObjectChargeIfNeeded(sourceItem, caster, `${SPELL.name} : lanceur ou token lanceur introuvable.`);
    return false;
  }

  const level = casterLevel(caster, sourceItem);
  const range = spellRange(level);
  const nbMissiles = Math.min(5, 1 + Math.floor((level - 1) / 2));
  const selectedIds = new Set(Array.from(game.user.targets ?? []).map(t => t.id));

  const candidates = canvas.tokens.placeables
    .filter(t => t.visible && t.actor && t.id !== sourceToken.id && t.actor.id !== caster.id)
    .map(t => ({ token: t, distance: tokenDistance(sourceToken, t) }))
    .filter(entry => entry.distance <= range)
    .sort((a, b) => {
      const sa = selectedIds.has(a.token.id) ? 0 : 1;
      const sb = selectedIds.has(b.token.id) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return String(a.token.name).localeCompare(String(b.token.name));
    })
    .map(entry => entry.token);
  candidates.__sourceToken = sourceToken;

  if (!candidates.length) {
    await refundObjectChargeIfNeeded(sourceItem, caster, `${SPELL.name} : aucune cible visible à portée (${range.toFixed(1)} m).`);
    return false;
  }

  const distribution = await askDistribution({ candidates, nbMissiles, selectedIds, sourceItem, range });
  if (!distribution) {
    await refundObjectChargeIfNeeded(sourceItem, caster);
    return false;
  }

  const summaries = [];
  let globalMissileIndex = 0;
  for (const [tokenId, countRaw] of Object.entries(distribution.result)) {
    const count = Math.max(0, Math.floor(Number(countRaw) || 0));
    if (!count) continue;
    const targetToken = canvas.tokens.get(tokenId);
    if (!targetToken?.actor) continue;

    if (isShieldedAgainstMagicMissile(targetToken.actor)) {
      summaries.push({ name: targetToken.name, nb: count, dmg: 0, rolls: ["Immunisé — Bouclier"] });
      continue;
    }

    const rolls = [];
    let dmg = 0;
    for (let i = 0; i < count; i++) {
      await playMissileVfx(sourceToken, targetToken, globalMissileIndex++);
      const roll = await new Roll("1d4+1").evaluate({ async: true });
      rolls.push(String(roll.total));
      dmg += Number(roll.total) || 0;
    }
    await applyDamage(targetToken, dmg, caster, sourceItem);
    summaries.push({ name: targetToken.name, nb: count, dmg, rolls });
  }

  await createChat({ caster, sourceItem, sourceToken, summaries, totalAssigned: distribution.total, nbMissiles, range });

  console.log(`${TAG}[DONE]`, {
    caster: caster.name,
    level,
    range,
    nbMissiles,
    totalAssigned: distribution.total,
    summaries
  });

  return true;
})();
