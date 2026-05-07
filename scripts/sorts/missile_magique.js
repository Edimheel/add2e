// Missile Magique.js — ADD2E corrigé multi-cibles
// Version : 2026-05-05-v3-multi-target
// Retour attendu : true = consommé, false = non consommé.
// Objectif : permettre de répartir plusieurs missiles sur plusieurs cibles visibles.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][MISSILE_MAGIQUE][MULTI]";

  const htmlEscape = (value) => {
    const div = document.createElement("div");
    div.innerText = String(value ?? "");
    return div.innerHTML;
  };

  const asNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const getSourceItem = () => {
    if (typeof item !== "undefined" && item) return item;
    if (typeof sort !== "undefined" && sort) return sort;
    if (typeof spell !== "undefined" && spell) return spell;
    if (typeof this !== "undefined" && this?.documentName === "Item") return this;
    return null;
  };

  const spellData = getSourceItem();
  const sourceRef = (typeof sort !== "undefined" && sort) ? sort : spellData;

  if (!spellData) {
    ui.notifications.error("Missile magique : sort introuvable.");
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : spellData.parent;

  if (!caster) {
    ui.notifications.error("Missile magique : lanceur introuvable.");
    return false;
  }

  const refund = async (raison = "") => {
    if (raison) ui.notifications.warn(raison);

    try {
      if (sourceRef?.system?.isPower && sourceRef?.system?.sourceWeaponId) {
        const weapon = caster.items?.get(sourceRef.system.sourceWeaponId);
        if (!weapon) return;

        const currentGlobal = await weapon.getFlag?.("add2e", "global_charges");
        if (currentGlobal !== undefined) {
          await weapon.setFlag("add2e", "global_charges", asNumber(currentGlobal) + 1);
          ui.notifications.info(`Charge restituée à ${weapon.name}.`);
          return;
        }

        const idx = sourceRef.system.powerIndex;
        const currentIndiv = await weapon.getFlag?.("add2e", `charges_${idx}`);
        if (currentIndiv !== undefined) {
          await weapon.setFlag("add2e", `charges_${idx}`, asNumber(currentIndiv) + 1);
          ui.notifications.info("Charge restituée.");
        }
      }
    } catch (e) {
      console.warn(`${TAG}[REFUND_FAILED]`, e);
    }
  };

  const getCasterLevel = () => {
    if (sourceRef?.system?.isPower) return Math.max(1, asNumber(sourceRef.system.niveau, 1));

    const details = caster.system?.details_classe ?? {};
    const byKey = asNumber(details.magicien?.niveau ?? details.mage?.niveau ?? details.illusionniste?.niveau, 0);
    if (byKey > 0) return byKey;

    const classItem = caster.items?.find?.(i => {
      if (i.type !== "classe") return false;
      const n = String(i.name || "").toLowerCase();
      return n.includes("magicien") || n.includes("mage") || n.includes("illusionniste");
    });

    const clsLvl = asNumber(classItem?.system?.niveau ?? classItem?.system?.level, 0);
    if (clsLvl > 0) return clsLvl;

    return Math.max(1, asNumber(caster.system?.niveau ?? caster.system?.level, 1));
  };

  const getCasterToken = () => {
    if (typeof token !== "undefined" && token?.actor?.id === caster.id) return token;

    const controlled = canvas.tokens?.controlled?.find(t => t.actor?.id === caster.id);
    if (controlled) return controlled;

    const active = caster.getActiveTokens?.()[0];
    if (active) return active;

    return canvas.tokens?.placeables?.find(t => t.actor?.id === caster.id) ?? null;
  };

  const getHpPath = (targetActor) => {
    const candidates = [
      ["system.pdv", targetActor.system?.pdv],
      ["system.pv", targetActor.system?.pv],
      ["system.hp.value", targetActor.system?.hp?.value],
      ["system.hitPoints.value", targetActor.system?.hitPoints?.value]
    ];

    return candidates.find(([, v]) => Number.isFinite(Number(v))) ?? null;
  };

  const applyDamageSafe = async (targetToken, amount) => {
    const targetActor = targetToken?.actor;
    if (!targetActor || amount <= 0) return false;

    if (typeof add2eApplyDamage === "function") {
      await add2eApplyDamage({
        cible: targetActor,
        montant: amount,
        source: "Missile Magique",
        lanceur: caster,
        type: "force",
        silent: true
      });
      return true;
    }

    if (typeof globalThis.add2eApplyDamage === "function") {
      await globalThis.add2eApplyDamage({
        cible: targetActor,
        montant: amount,
        source: "Missile Magique",
        lanceur: caster,
        type: "force",
        silent: true
      });
      return true;
    }

    const found = getHpPath(targetActor);

    if (game.user.isGM && found) {
      const [path, value] = found;
      await targetActor.update({ [path]: Math.max(0, asNumber(value) - amount) });
      return true;
    }

    if (game.socket) {
      game.socket.emit("system.add2e", {
        type: "applyDamage",
        actorId: targetActor.id,
        actorUuid: targetActor.uuid,
        sceneId: canvas.scene?.id,
        tokenId: targetToken.id,
        tokenUuid: targetToken.document?.uuid,
        montant: amount,
        damage: amount,
        source: "Missile Magique",
        lanceurId: caster.id,
        lanceurUuid: caster.uuid,
        damageType: "force",
        silent: true
      });
      return true;
    }

    ui.notifications.error("Impossible d’appliquer les dégâts : fonction add2eApplyDamage absente et socket indisponible.");
    return false;
  };

  const playMissileVfx = async (sourceToken, targetToken, missileIndex) => {
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
    } catch (e) {
      console.warn(`${TAG}[VFX_FAILED]`, e);
    }
  };

  const isShieldedAgainstMagicMissile = (targetActor) => {
    return targetActor.effects?.some(e => {
      const tags = e.flags?.add2e?.tags || [];
      const name = String(e.name || e.label || "").toLowerCase();
      return tags.includes("immunite:missile_magique") ||
        tags.includes("missile_magique:immunite") ||
        tags.includes("bouclier") ||
        name.includes("bouclier");
    });
  };

  const casterLevel = getCasterLevel();

  // AD&D2 : 1 missile au niveau 1, +1 tous les 2 niveaux, maximum 5 missiles.
  const nbMissiles = Math.min(5, 1 + Math.floor((casterLevel - 1) / 2));
  const sourceToken = getCasterToken();
  const targetedIds = new Set(Array.from(game.user.targets ?? []).map(t => t.id));

  // Important : on affiche toutes les cibles visibles, pas seulement les cibles déjà sélectionnées.
  // Cela permet de répartir les missiles sur plusieurs cibles différentes depuis le dialogue.
  let candidates = canvas.tokens.placeables
    .filter(t => t.visible && t.actor && t.id !== sourceToken?.id && t.actor.id !== caster.id)
    .sort((a, b) => {
      const ta = targetedIds.has(a.id) ? 0 : 1;
      const tb = targetedIds.has(b.id) ? 0 : 1;
      if (ta !== tb) return ta - tb;

      if (sourceToken?.center && a.center && b.center) {
        const da = Math.hypot(a.center.x - sourceToken.center.x, a.center.y - sourceToken.center.y);
        const db = Math.hypot(b.center.x - sourceToken.center.x, b.center.y - sourceToken.center.y);
        if (da !== db) return da - db;
      }

      return String(a.name).localeCompare(String(b.name));
    });

  if (!candidates.length) {
    await refund("Aucune cible visible disponible.");
    return false;
  }

  const defaultDistribution = new Map();
  const selectedCandidates = candidates.filter(t => targetedIds.has(t.id));
  const preferred = selectedCandidates.length ? selectedCandidates : candidates.slice(0, 1);

  let remainingDefault = nbMissiles;
  for (const t of preferred) {
    if (remainingDefault <= 0) break;
    defaultDistribution.set(t.id, 1);
    remainingDefault--;
  }

  if (preferred.length === 1 && remainingDefault > 0) {
    defaultDistribution.set(preferred[0].id, (defaultDistribution.get(preferred[0].id) || 0) + remainingDefault);
  }

  let content = `
    <div style="font-family:var(--font-primary);">
      <div style="text-align:center;margin-bottom:10px;color:#4a148c;">
        <img src="${htmlEscape(spellData.img || 'icons/svg/magic.svg')}" width="32" height="32" style="vertical-align:middle;margin-right:5px;border-radius:4px;">
        <b>${nbMissiles}</b> Missile${nbMissiles > 1 ? "s" : ""} à répartir
      </div>

      <div style="font-size:12px;margin-bottom:8px;padding:6px;border:1px solid #d7bde2;background:#faf5ff;border-radius:5px;">
        Les cibles déjà sélectionnées sont affichées en premier. Tu peux répartir les missiles sur plusieurs cibles visibles.
      </div>

      <form class="missile-form">`;

  for (const t of candidates) {
    const selected = targetedIds.has(t.id);
    const val = defaultDistribution.get(t.id) || 0;
    const border = selected ? "2px solid #8e44ad" : "1px solid #d8cce2";
    const label = selected ? " — cible sélectionnée" : "";

    content += `
      <div style="display:flex;align-items:center;margin-bottom:4px;background:${selected ? '#f0e4ff' : '#f8f4fb'};padding:4px;border-radius:4px;border:${border};">
        <img src="${htmlEscape(t.document?.texture?.src || t.actor?.img || 'icons/svg/mystery-man.svg')}" width="28" height="28" style="margin-right:8px;border:1px solid #aaa;background:#fff;">
        <label style="flex:1;font-weight:600;font-size:0.9em;">${htmlEscape(t.name)}<span style="font-weight:400;color:#6a3c99;">${label}</span></label>
        <input type="number" data-id="${t.id}" min="0" max="${nbMissiles}" value="${val}" style="width:48px;text-align:center;font-weight:bold;">
      </div>`;
  }

  content += `
      </form>
      <div style="margin-top:8px;font-size:12px;color:#5f4b66;">
        Total autorisé : <b>${nbMissiles}</b>. Tous les missiles assignés touchent automatiquement, sauf immunité active.
      </div>
    </div>`;

  const distribution = await new Promise(resolve => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      resolve(v);
    };

    new Dialog({
      title: "Missiles Magiques — répartition multi-cibles",
      content,
      buttons: {
        fire: {
          label: `<i class="fas fa-magic"></i> Lancer`,
          callback: (html) => {
            const result = {};
            let totalAssigne = 0;

            html.find('input[type="number"]').each((i, el) => {
              const tid = String(el.dataset.id || $(el).data("id"));
              const val = Math.max(0, Math.floor(Number($(el).val()) || 0));

              if (val > 0) {
                result[tid] = val;
                totalAssigne += val;
              }
            });

            if (totalAssigne === 0) {
              ui.notifications.warn("Aucun missile assigné.");
              return finish(null);
            }

            if (totalAssigne > nbMissiles) {
              ui.notifications.warn(`Trop de missiles assignés : ${totalAssigne}/${nbMissiles}.`);
              return finish(null);
            }

            finish({ result, totalAssigne });
          }
        },
        cancel: {
          label: "Annuler",
          callback: () => finish(null)
        }
      },
      default: "fire",
      close: () => finish(null)
    }).render(true);
  });

  if (!distribution) {
    await refund();
    return false;
  }

  const { result, totalAssigne } = distribution;
  const missilesSummary = [];
  let globalMissileIndex = 0;

  console.log(`${TAG}[START]`, {
    caster: caster.name,
    casterLevel,
    nbMissiles,
    totalAssigne,
    distribution: result
  });

  for (const [tokenId, countRaw] of Object.entries(result)) {
    const count = Math.max(0, Math.floor(Number(countRaw) || 0));
    if (!count) continue;

    const targetToken = canvas.tokens.get(tokenId);
    if (!targetToken?.actor) continue;

    const targetActor = targetToken.actor;

    if (isShieldedAgainstMagicMissile(targetActor)) {
      missilesSummary.push({
        name: targetToken.name,
        nb: count,
        dmg: 0,
        rolls: ["Immunisé — Bouclier"]
      });
      continue;
    }

    const rolls = [];
    let dmgTotal = 0;

    for (let i = 0; i < count; i++) {
      await playMissileVfx(sourceToken, targetToken, globalMissileIndex++);

      const r = await new Roll("1d4+1").evaluate();
      rolls.push(r.total);
      dmgTotal += asNumber(r.total);
    }

    await applyDamageSafe(targetToken, dmgTotal);

    missilesSummary.push({
      name: targetToken.name,
      nb: count,
      dmg: dmgTotal,
      rolls
    });
  }

  const rows = missilesSummary.map(m => `
    <tr style="border-bottom:1px solid #eee;">
      <td style="padding:4px;font-weight:bold;color:#4a148c;">${htmlEscape(m.name)}</td>
      <td style="text-align:center;">${m.nb}</td>
      <td style="font-size:0.85em;color:#666;">${m.rolls.map(htmlEscape).join(" + ")}</td>
      <td style="text-align:right;font-weight:bold;color:#c0392b;">${m.dmg}</td>
    </tr>`).join("");

  const unused = Math.max(0, nbMissiles - totalAssigne);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: sourceToken }),
    content: `
    <div class="add2e-spell-card" style="border:1px solid #8e44ad;border-radius:8px;overflow:hidden;font-family:var(--font-primary);background:#fff;">
      <div style="background:linear-gradient(135deg,#7b1fa2,#4a148c);color:white;padding:6px 10px;font-weight:bold;display:flex;align-items:center;">
        <img src="${htmlEscape(spellData.img || 'icons/svg/magic.svg')}" width="24" height="24" style="margin-right:8px;border:1px solid #fff;border-radius:4px;">
        ${htmlEscape(spellData.name || "Missile Magique")}
      </div>
      <div style="padding:5px;background:#f3e5f5;font-size:0.9em;text-align:center;border-bottom:1px solid #e1bee7;">
        <b>${totalAssigne}</b> missile${totalAssigne > 1 ? "s" : ""} lancé${totalAssigne > 1 ? "s" : ""} sur <b>${missilesSummary.length}</b> cible${missilesSummary.length > 1 ? "s" : ""}.
        ${unused ? `<br><span style="color:#8a5a00;">${unused} missile${unused > 1 ? "s" : ""} non assigné${unused > 1 ? "s" : ""}.</span>` : ""}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:0.9em;">
        <tr style="background:#eee;color:#555;">
          <th style="text-align:left;padding:4px;">Cible</th>
          <th>Qté</th>
          <th>Dés</th>
          <th style="text-align:right;">Dégâts</th>
        </tr>
        ${rows || `<tr><td colspan="4" style="padding:6px;text-align:center;"><i>Aucun missile résolu.</i></td></tr>`}
      </table>
    </div>`
  });

  return true;
})();
