// ADD2E — onUse Magicien : Poigne électrique
// Version : 2026-05-27-groupe-a-v1
// Retour attendu : true = sort consommé, false = sort non consommé.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][POIGNE_ELECTRIQUE]";

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
    ui.notifications.error("Poigne électrique : sort introuvable.");
    return false;
  }

  if (!caster) {
    ui.notifications.error("Poigne électrique : lanceur introuvable.");
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
      source: "Poigne électrique",
      lanceur: caster,
      type: "electricite",
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
        source: "Poigne électrique",
        lanceurId: caster.id,
        lanceurUuid: caster.uuid,
        damageType: "electricite",
        silent: true
      });
      return true;
    }

    ui.notifications.error("Poigne électrique : impossible d’appliquer les dégâts.");
    return false;
  };

  const casterToken = getCasterToken();
  const targets = Array.from(game.user.targets ?? []).filter(t => t?.actor);

  if (!targets.length) {
    ui.notifications.warn("Poigne électrique : cible une créature touchée avant de lancer le sort.");
    return false;
  }

  if (targets.length > 1) {
    ui.notifications.warn("Poigne électrique : le sort ne se décharge que sur une seule créature touchée.");
    return false;
  }

  const targetToken = targets[0];
  const casterLevel = getCasterLevel();
  const roll = await new Roll(`1d8+${Math.max(1, casterLevel)}`).evaluate();
  const damage = asNumber(roll.total, 0);
  const ok = await applyDamageSafe(targetToken, damage);

  console.log(`${TAG}[START]`, {
    caster: caster.name,
    casterLevel,
    target: targetToken.name,
    formula: roll.formula,
    damage,
    applied: ok
  });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
    content: `
    <div class="add2e-spell-card add2e-magicien-sort" style="border:1px solid #3f6ea8;border-radius:8px;overflow:hidden;font-family:var(--font-primary);background:#f5faff;">
      <div style="background:linear-gradient(135deg,#275f9f,#173f6d);color:white;padding:6px 10px;font-weight:bold;display:flex;align-items:center;">
        <img src="${htmlEscape(spellData.img || 'icons/svg/lightning.svg')}" width="24" height="24" style="margin-right:8px;border:1px solid #fff;border-radius:4px;background:#fff;">
        ${htmlEscape(spellData.name || "Poigne électrique")}
      </div>
      <div style="padding:6px;background:#eaf4ff;font-size:0.9em;text-align:center;border-bottom:1px solid #b8d4ef;">
        ${htmlEscape(caster.name)} décharge sa poigne électrique sur <b>${htmlEscape(targetToken.name)}</b>.
      </div>
      <div style="padding:8px;text-align:center;">
        <div style="font-size:12px;color:#405d78;">Dégâts électriques : ${htmlEscape(roll.formula)}</div>
        <div style="font-size:22px;font-weight:900;color:#c0392b;">${damage}</div>
        <div style="font-size:12px;color:${ok ? '#1e7e34' : '#a94442'};">Application Foundry : ${ok ? 'réussie' : 'non appliquée'}</div>
      </div>
      <div style="padding:6px;font-size:12px;color:#314f6b;border-top:1px solid #b8d4ef;">
        Le sort se décharge lorsque le magicien touche la victime. Aucun effet si la victime touche elle-même le magicien.
      </div>
    </div>`
  });

  return true;
})();
