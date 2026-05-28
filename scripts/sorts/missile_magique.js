// ADD2E — onUse Magicien : Missile magique
// Version : 2026-05-28-groupe-a-dialogv2-cartes-v3
// Contrat : return true = sort consommé ; return false = sort non consommé.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][MISSILE_MAGIQUE]";
  const SPELL = {
    name: "Missile magique",
    slug: "missile_magique",
    level: 1,
    school: "Évocation",
    rangeText: "6\" + 1\"/niveau",
    areaText: "une créature ou plus dans 1 m²",
    saveText: "Aucun",
    castingTimeText: "1 segment",
    componentsText: "V, S",
    damageType: "force",
    imgFallback: "systems/add2e/assets/icones/sorts/missile_magique.webp",
    description: "Ce sort crée un ou plusieurs projectiles magiques qui partent du bout des doigts du magicien et touchent à coup sûr leurs cibles. Chaque projectile cause de 2 à 5 (1d4+1) points de dégâts. Quand le magicien peut créer plusieurs projectiles, il peut choisir de tirer sur une ou plusieurs cibles dans les limites de la zone d’effet. Pour chaque niveau du magicien, la portée augmente de 1\". Pour chaque tranche de 2 niveaux, le magicien peut créer un nouveau projectile : 2 au niveau 3, 3 au niveau 5, 4 au niveau 7, 5 au niveau 9, 6 au niveau 11, etc."
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
    if (sourceItem?.system?.isPower) return Math.max(1, n(sourceItem.system.niveau ?? sourceItem.system.level, 1));
    const details = caster?.system?.details_classe ?? {};
    const byClass = n(details.magicien?.niveau ?? details.mage?.niveau ?? details.illusionniste?.niveau, 0);
    if (byClass > 0) return byClass;
    const classItem = caster?.items?.find?.(i => String(i.type).toLowerCase() === "classe" && /magicien|mage|illusionniste/i.test(i.name ?? ""));
    const byItem = n(classItem?.system?.niveau ?? classItem?.system?.level, 0);
    return byItem > 0 ? byItem : Math.max(1, n(caster?.system?.niveau ?? caster?.system?.level ?? caster?.system?.details?.niveau, 1));
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

  function gridSizePx() {
    return canvas.grid?.size || canvas.dimensions?.size || 100;
  }

  function spellRangeMeters(level) {
    return (6 + Math.max(1, level)) * 3;
  }

  function tokenDistanceMeters(sourceToken, targetToken) {
    const s = sourceToken.center ?? { x: sourceToken.document.x, y: sourceToken.document.y };
    const t = targetToken.center ?? { x: targetToken.document.x, y: targetToken.document.y };
    return Math.hypot((t.x ?? 0) - (s.x ?? 0), (t.y ?? 0) - (s.y ?? 0)) / gridSizePx() * metersPerGridCell();
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
        return true;
      }
      const idx = sourceItem.system.powerIndex;
      const currentIndiv = await weapon.getFlag?.("add2e", `charges_${idx}`);
      if (currentIndiv !== undefined) {
        await weapon.setFlag("add2e", `charges_${idx}`, n(currentIndiv) + 1);
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
      details: `${SPELL.name} — ${amount} dégât${amount > 1 ? "s" : ""}`,
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
        .play();
    } catch (err) {
      console.warn(`${TAG}[VFX_FAILED]`, err);
    }
  }

  async function askDistribution({ candidates, nbMissiles, selectedIds, sourceToken, rangeMeters }) {
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
      const value = defaultDistribution.get(t.id) || 0;
      const distance = tokenDistanceMeters(sourceToken, t);
      return `
        <article class="add2e-mm-card" data-token-id="${esc(t.id)}" style="display:grid;grid-template-columns:38px 1fr 102px;gap:8px;align-items:center;border:1px solid #8e63c7;border-radius:8px;background:#fffaff;padding:7px;margin-bottom:6px;box-shadow:0 1px 3px rgba(0,0,0,.12);">
          <img src="${esc(t.document?.texture?.src || t.actor?.img || 'icons/svg/mystery-man.svg')}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;background:#fff;">
          <div style="min-width:0;">
            <div style="font-weight:900;color:#2d2144;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(t.name)}</div>
            <div style="font-size:11px;color:#4a2e78;">${distance.toFixed(1)} m / ${rangeMeters.toFixed(1)} m</div>
          </div>
          <div style="display:grid;grid-template-columns:28px 42px 28px;gap:3px;align-items:center;">
            <button type="button" data-add2e-mm-delta="-1" data-target="${esc(t.id)}" style="height:26px;border-radius:5px;border:1px solid #8e63c7;background:#f6f0ff;color:#4a2e78;font-weight:900;">−</button>
            <input type="number" name="target.${esc(t.id)}" min="0" max="${nbMissiles}" value="${value}" style="height:26px;width:42px;text-align:center;font-weight:900;border:1px solid #8e63c7;border-radius:5px;background:#fff;">
            <button type="button" data-add2e-mm-delta="1" data-target="${esc(t.id)}" style="height:26px;border-radius:5px;border:1px solid #8e63c7;background:#f6f0ff;color:#4a2e78;font-weight:900;">+</button>
          </div>
        </article>`;
    }).join("");

    const content = `
      <form class="add2e-dialog-v2 add2e-mm-dialog-v2" style="min-width:440px;max-width:560px;font-family:var(--font-primary);color:#2d2144;">
        <section style="display:flex;align-items:center;gap:10px;border:1px solid #8e63c7;border-radius:10px;background:#f6f0ff;padding:9px;margin-bottom:8px;">
          <img src="${esc(SPELL.imgFallback)}" style="width:42px;height:42px;border-radius:6px;object-fit:cover;background:#fff;border:1px solid #8e63c7;">
          <div style="flex:1;">
            <div style="font-weight:900;color:#6c31b5;text-transform:uppercase;letter-spacing:.3px;">Missile magique</div>
            <div style="font-size:12px;">Répartis ${nbMissiles} missile${nbMissiles > 1 ? "s" : ""} entre les cibles à portée.</div>
          </div>
          <div style="text-align:center;border:1px solid #8e63c7;border-radius:8px;background:#fffaff;padding:5px 8px;min-width:70px;">
            <div style="font-size:10px;text-transform:uppercase;color:#4a2e78;font-weight:800;">Restants</div>
            <div class="add2e-mm-remaining" style="font-size:22px;font-weight:900;color:#6c31b5;">${nbMissiles}</div>
          </div>
        </section>
        <section style="max-height:360px;overflow:auto;padding-right:2px;">${rows}</section>
        <p style="font-size:12px;margin:.4em 0 0;color:#4a2e78;">Les cibles hors portée ne sont pas listées. Bouclier annule les missiles reçus.</p>
      </form>`;

    return await DialogV2.wait({
      window: { title: "Missile magique", icon: "fas fa-magic" },
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
            if (!form) return null;
            const result = {};
            let total = 0;
            for (const t of candidates) {
              const input = form.querySelector(`[name="target.${CSS.escape(t.id)}"]`);
              const value = Math.max(0, Math.floor(Number(input?.value) || 0));
              if (value > 0) {
                result[t.id] = value;
                total += value;
              }
            }
            if (total <= 0) {
              ui.notifications.warn("Aucun missile assigné.");
              return null;
            }
            if (total !== nbMissiles) {
              ui.notifications.warn(`Répartition incorrecte : ${total}/${nbMissiles} missile(s).`);
              return null;
            }
            return { result, total };
          }
        },
        { action: "cancel", label: "Annuler", icon: "fas fa-times", callback: () => null }
      ],
      render: (_event, dialog) => {
        const form = dialog.element?.querySelector?.("form");
        if (!form) return;
        const refresh = () => {
          const inputs = Array.from(form.querySelectorAll('input[name^="target."]'));
          const total = inputs.reduce((sum, input) => sum + Math.max(0, Math.floor(Number(input.value) || 0)), 0);
          const remaining = form.querySelector(".add2e-mm-remaining");
          if (remaining) {
            remaining.textContent = String(Math.max(0, nbMissiles - total));
            remaining.style.color = total === nbMissiles ? "#1f7a35" : "#6c31b5";
          }
        };
        form.addEventListener("click", event => {
          const button = event.target?.closest?.("[data-add2e-mm-delta]");
          if (!button) return;
          event.preventDefault();
          const targetId = button.dataset.target;
          const input = form.querySelector(`[name="target.${CSS.escape(targetId)}"]`);
          if (!input) return;
          const delta = Number(button.dataset.add2eMmDelta) || 0;
          input.value = String(Math.max(0, Math.min(nbMissiles, Math.floor(Number(input.value) || 0) + delta)));
          refresh();
        });
        form.addEventListener("input", refresh);
        refresh();
      }
    });
  }

  async function createChat({ caster, sourceItem, sourceToken, summaries, totalAssigned, rangeMeters }) {
    const casterName = caster?.name ?? sourceToken?.name ?? "Magicien";
    const casterImg = sourceToken?.document?.texture?.src ?? caster?.img ?? "icons/svg/mystery-man.svg";
    const spellImg = sourceItem?.img || SPELL.imgFallback || "icons/svg/magic.svg";
    const rows = summaries.length
      ? summaries.map(m => `<tr><td style="padding:4px 6px;"><b>${esc(m.name)}</b></td><td style="text-align:center;padding:4px 6px;">${m.nb}</td><td style="padding:4px 6px;text-align:right;"><b>${m.dmg}</b></td></tr>`).join("")
      : `<tr><td colspan="3" style="padding:6px;text-align:center;"><i>Aucun missile résolu.</i></td></tr>`;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster, token: sourceToken }),
      content: `
        <div class="add2e-chat-card add2e-magicien-sort add2e-sort-missile-magique" style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary);">
          <div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px;">
            <img src="${esc(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff;" />
            <div style="flex:1;line-height:1.05;"><div style="font-weight:800;font-size:14px;">${esc(casterName)}</div><div style="font-size:12px;font-weight:700;">lance ${esc(SPELL.name)}</div></div>
            <div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">Magicien niv. 1</div>
            <img src="${esc(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;" />
          </div>
          <div style="padding:9px 10px 10px 10px;background:#f6f0ff;">
            <div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;margin-bottom:7px;">
              <div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;text-align:center;">Projectiles magiques</div>
              <p style="margin:.35em 0;font-size:13px;line-height:1.35;"><b>${totalAssigned}</b> missile${totalAssigned > 1 ? "s" : ""} lancé${totalAssigned > 1 ? "s" : ""}.</p>
              <table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:13px;">
                <thead><tr><th style="text-align:left;padding:4px 6px;">Cible</th><th>Missiles</th><th style="text-align:right;padding:4px 6px;">Dégâts</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            <details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;margin-top:7px;">
              <summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Détails du sort</summary>
              <div style="margin-top:5px;font-size:12px;line-height:1.35;">
                <p><b>École :</b> ${esc(SPELL.school)} — <b>Portée :</b> ${esc(SPELL.rangeText)} (${rangeMeters.toFixed(1)} m) — <b>Zone :</b> ${esc(SPELL.areaText)}.</p>
                <p><b>Composantes :</b> ${esc(SPELL.componentsText)} — <b>Incantation :</b> ${esc(SPELL.castingTimeText)} — <b>Jet de sauvegarde :</b> ${esc(SPELL.saveText)}.</p>
                <p>${esc(SPELL.description)}</p>
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
  const rangeMeters = spellRangeMeters(level);
  const nbMissiles = 1 + Math.floor((Math.max(1, level) - 1) / 2);
  const selectedIds = new Set(Array.from(game.user.targets ?? []).map(t => t.id));

  const candidates = canvas.tokens.placeables
    .filter(t => t.visible && t.actor && t.id !== sourceToken.id && t.actor.id !== caster.id)
    .map(t => ({ token: t, distance: tokenDistanceMeters(sourceToken, t) }))
    .filter(entry => entry.distance <= rangeMeters + 0.001)
    .sort((a, b) => {
      const sa = selectedIds.has(a.token.id) ? 0 : 1;
      const sb = selectedIds.has(b.token.id) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return String(a.token.name).localeCompare(String(b.token.name));
    })
    .map(entry => entry.token);

  if (!candidates.length) {
    await refundObjectChargeIfNeeded(sourceItem, caster, `${SPELL.name} : aucune cible visible à portée.`);
    return false;
  }

  const distribution = await askDistribution({ candidates, nbMissiles, selectedIds, sourceToken, rangeMeters });
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
      summaries.push({ name: targetToken.name, nb: count, dmg: 0 });
      continue;
    }

    let dmg = 0;
    for (let i = 0; i < count; i++) {
      await playMissileVfx(sourceToken, targetToken, globalMissileIndex++);
      const roll = await new Roll("1d4+1").evaluate({ async: true });
      dmg += Number(roll.total) || 0;
    }
    await applyDamage(targetToken, dmg, caster, sourceItem);
    summaries.push({ name: targetToken.name, nb: count, dmg });
  }

  await createChat({ caster, sourceItem, sourceToken, summaries, totalAssigned: distribution.total, rangeMeters });

  console.log(`${TAG}[DONE]`, {
    version: "2026-05-28-groupe-a-dialogv2-cartes-v3",
    caster: caster.name,
    level,
    metersPerGridCell: metersPerGridCell(),
    rangeMeters,
    rangeCells: rangeMeters / metersPerGridCell(),
    candidates: candidates.map(t => ({ name: t.name, distanceMeters: tokenDistanceMeters(sourceToken, t) })),
    totalAssigned: distribution.total
  });

  return true;
})();
