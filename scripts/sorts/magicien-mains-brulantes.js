// ADD2E — onUse Magicien : Mains brûlantes
// Version : 2026-05-27-groupe-a-v1
// Retour attendu : true = sort consommé, false = sort non consommé.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][MAINS_BRULANTES]";

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
  const caster = (typeof actor !== "undefined" && actor) ? actor : spellData?.parent;

  if (!spellData) {
    ui.notifications.error("Mains brûlantes : sort introuvable.");
    return false;
  }

  if (!caster) {
    ui.notifications.error("Mains brûlantes : lanceur introuvable.");
    return false;
  }

  const getCasterLevel = () => {
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

    return Math.max(1, asNumber(caster.system?.niveau ?? caster.system?.level ?? caster.system?.details?.niveau, 1));
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

    return candidates.find(([, value]) => Number.isFinite(Number(value))) ?? null;
  };

  const applyDamageSafe = async (targetToken, amount) => {
    const targetActor = targetToken?.actor;
    if (!targetActor || amount <= 0) return false;

    const payload = {
      cible: targetActor,
      montant: amount,
      source: "Mains brûlantes",
      lanceur: caster,
      type: "feu",
      silent: true
    };

    if (typeof add2eApplyDamage === "function") {
      await add2eApplyDamage(payload);
      return true;
    }

    if (typeof globalThis.add2eApplyDamage === "function") {
      await globalThis.add2eApplyDamage(payload);
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
        source: "Mains brûlantes",
        lanceurId: caster.id,
        lanceurUuid: caster.uuid,
        damageType: "feu",
        silent: true
      });
      return true;
    }

    ui.notifications.error("Mains brûlantes : impossible d’appliquer les dégâts.");
    return false;
  };

  const casterToken = getCasterToken();
  const targets = Array.from(game.user.targets ?? []).filter(t => t?.actor);

  if (!targets.length) {
    ui.notifications.warn("Mains brûlantes : cible les créatures prises dans l’arc de flammes avant de lancer le sort.");
    return false;
  }

  const casterLevel = getCasterLevel();
  const damage = Math.max(1, casterLevel);
  const applied = [];

  console.log(`${TAG}[START]`, {
    caster: caster.name,
    casterLevel,
    damage,
    targets: targets.map(t => t.name)
  });

  for (const targetToken of targets) {
    const ok = await applyDamageSafe(targetToken, damage);
    applied.push({ name: targetToken.name, damage, ok });
  }

  const rows = applied.map(r => `
    <tr style="border-bottom:1px solid #eee;">
      <td style="padding:4px;font-weight:bold;color:#7a2d00;">${htmlEscape(r.name)}</td>
      <td style="padding:4px;text-align:center;">${r.ok ? "Oui" : "Non"}</td>
      <td style="padding:4px;text-align:right;font-weight:bold;color:#c0392b;">${r.damage}</td>
    </tr>`).join("");

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
    content: `
    <div class="add2e-spell-card add2e-magicien-sort" style="border:1px solid #c46b22;border-radius:8px;overflow:hidden;font-family:var(--font-primary);background:#fffaf4;">
      <div style="background:linear-gradient(135deg,#b64000,#7a2200);color:white;padding:6px 10px;font-weight:bold;display:flex;align-items:center;">
        <img src="${htmlEscape(spellData.img || 'icons/svg/fire.svg')}" width="24" height="24" style="margin-right:8px;border:1px solid #fff;border-radius:4px;background:#fff;">
        ${htmlEscape(spellData.name || "Mains brûlantes")}
      </div>
      <div style="padding:6px;background:#fff0df;font-size:0.9em;text-align:center;border-bottom:1px solid #f0c18f;">
        Flammes en éventail : <b>${damage}</b> point${damage > 1 ? "s" : ""} de dégâts de feu par cible. Aucun jet de protection.
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:0.9em;">
        <tr style="background:#f6e2ce;color:#573000;">
          <th style="text-align:left;padding:4px;">Cible</th>
          <th>Appliqué</th>
          <th style="text-align:right;">Dégâts</th>
        </tr>
        ${rows}
      </table>
      <div style="padding:6px;font-size:12px;color:#5f3b18;border-top:1px solid #f0c18f;">
        Les matières inflammables dans la zone peuvent s’enflammer selon l’arbitrage du MD.
      </div>
    </div>`
  });

  return true;
})();
