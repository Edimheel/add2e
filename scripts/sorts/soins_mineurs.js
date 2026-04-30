// Soins mineurs.js - AD&D2
// Clerc niveau 1 — Nécromancie
// Version : soins uniquement
// Règle : soigne 1d8 points de vie, au toucher, permanent, aucun jet de protection.
// Compatible joueur + MJ via add2eApplyDamage si disponible.

return await (async () => {

  // ======================================================
  // 1. INITIALISATION ROBUSTE
  // ======================================================
  let sourceItem = null;

  if (typeof sort !== "undefined" && sort) sourceItem = sort;
  else if (typeof item !== "undefined" && item) sourceItem = item;
  else if (typeof this !== "undefined" && this.documentName === "Item") sourceItem = this;

  if (
    !sourceItem &&
    typeof arguments !== "undefined" &&
    arguments.length > 1 &&
    arguments[1]?.name
  ) {
    sourceItem = arguments[1];
  }

  if (!sourceItem) {
    ui.notifications.error("Soins mineurs : sort introuvable.");
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;

  if (!caster) {
    ui.notifications.error("Soins mineurs : lanceur introuvable.");
    return false;
  }

  // ======================================================
  // 2. CIBLE
  // ======================================================
  const targets = Array.from(game.user.targets);

  if (targets.length !== 1) {
    ui.notifications.warn("Soins mineurs : cible exactement une créature.");
    return false;
  }

  const targetToken = targets[0];
  const targetActor = targetToken?.actor;

  if (!targetActor) {
    ui.notifications.warn("Soins mineurs : cible sans acteur.");
    return false;
  }

  // ======================================================
  // 3. CONTRÔLE DU TOUCHER
  // ======================================================
  const casterToken = caster.getActiveTokens?.()[0];

  function add2eTokensAuContact(a, b) {
    if (!a || !b || a.id === b.id) return true;

    const gridSize = canvas.grid?.size || 100;

    const aLeft = a.document.x / gridSize;
    const aTop = a.document.y / gridSize;
    const aRight = aLeft + (a.document.width || 1);
    const aBottom = aTop + (a.document.height || 1);

    const bLeft = b.document.x / gridSize;
    const bTop = b.document.y / gridSize;
    const bRight = bLeft + (b.document.width || 1);
    const bBottom = bTop + (b.document.height || 1);

    const gapX = Math.max(0, bLeft - aRight, aLeft - bRight);
    const gapY = Math.max(0, bTop - aBottom, aTop - bBottom);

    return gapX <= 0.01 && gapY <= 0.01;
  }

  if (casterToken && targetToken && !add2eTokensAuContact(casterToken, targetToken)) {
    ui.notifications.warn("Soins mineurs : la cible doit être au toucher.");
    return false;
  }

  // ======================================================
  // 4. PV ACTUELS / PV MAX
  // ======================================================
  const sys = targetActor.system || {};

  const maxHP =
    Number(sys.points_de_coup) ||
    Number(sys.pv_max) ||
    Number(sys.points_de_vie) ||
    Number(sys.hp?.max) ||
    Number(sys.attributes?.hp?.max) ||
    0;

  if (!maxHP || maxHP <= 0) {
    ui.notifications.error(`Soins mineurs : impossible de déterminer les PV maximum de ${targetActor.name}.`);
    return false;
  }

  let currentHP = sys.pdv;

  if (
    currentHP === undefined ||
    currentHP === null ||
    currentHP === "" ||
    Number.isNaN(Number(currentHP))
  ) {
    currentHP = maxHP;
  } else {
    currentHP = Number(currentHP) || 0;
  }

  // Le sort ne ressuscite pas un mort.
  if (currentHP <= -11) {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      content: `
      <div class="add2e-spell-card" style="border-radius:12px;box-shadow:0 4px 10px #2ecc7144;background:#f3fff6;border:1.5px solid #27ae60;overflow:hidden;padding:0;">
        <div style="background:linear-gradient(90deg,#1f8f3a 0%,#27ae60 100%);padding:8px;color:white;display:flex;align-items:center;gap:10px;">
          <img src="${caster.img}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
          <div style="line-height:1.2;flex:1;">
            <div style="font-weight:bold;">${caster.name}</div>
            <div style="font-size:0.85em;opacity:0.9;">lance ${sourceItem.name}</div>
          </div>
          <img src="${sourceItem.img || "icons/magic/life/cross-green-white.webp"}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
        </div>
        <div style="padding:10px;text-align:center;">
          <div style="font-weight:bold;color:#b42318;">Échec</div>
          <div><b>${targetActor.name}</b> est mort : Soins mineurs ne ressuscite pas.</div>
        </div>
      </div>`
    });

    return false;
  }

  // ======================================================
  // 5. JET DE SOINS : 1d8
  // ======================================================
  const roll = await new Roll("1d8").evaluate({ async: true });

  if (game.dice3d) {
    await game.dice3d.showForRoll(roll);
  }

  const soinBrut = Number(roll.total) || 0;
  const manquePV = Math.max(0, maxHP - currentHP);
  const soinEffectif = Math.min(soinBrut, manquePV);
  const newHP = Math.min(maxHP, currentHP + soinEffectif);

  // ======================================================
  // 6. APPLICATION DU SOIN
  // ======================================================
  if (soinEffectif > 0) {
    if (typeof add2eApplyDamage === "function") {
      // Le moteur existant gère déjà :
      // - MJ : application directe
      // - joueur : demande au MJ via socket
      // montant négatif = soin
      await add2eApplyDamage({
        cible: targetToken,
        montant: -soinEffectif,
        type: "soin",
        details: `Soins mineurs : ${soinEffectif} PV rendus`
      });
    } else {
      // Fallback MJ uniquement
      if (!game.user.isGM) {
        ui.notifications.error("Soins mineurs : add2eApplyDamage indisponible côté joueur.");
        return false;
      }

      await targetActor.update({
        "system.pdv": newHP
      });
    }
  }

  // ======================================================
  // 7. MESSAGE CHAT UNIQUE
  // ======================================================
  let resultText = "";

  if (soinEffectif <= 0) {
    resultText = `
      <div style="border:1px solid #2980b9;background:#eef6ff;border-radius:6px;padding:7px;text-align:center;">
        <div style="font-weight:bold;color:#2980b9;">Aucun soin nécessaire</div>
        <div>${targetActor.name} est déjà au maximum de ses points de vie.</div>
      </div>`;
  } else {
    resultText = `
      <div style="border:1px solid #27ae60;background:#eafaf1;border-radius:6px;padding:7px;text-align:center;">
        <div style="font-weight:bold;color:#1f8f3a;">SOINS APPLIQUÉS</div>
        <div style="font-size:1.05em;margin-top:4px;">
          Jet : <b>${roll.result}</b> = <b>${soinBrut}</b>
        </div>
        <div style="margin-top:4px;">
          PV rendus : <b>${soinEffectif}</b>
          ${soinEffectif < soinBrut ? `<span style="color:#777;">(limité par les PV maximum)</span>` : ""}
        </div>
        <div style="margin-top:4px;">
          ${currentHP} → <b>${newHP}</b> / ${maxHP}
        </div>
      </div>`;
  }

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `
    <div class="add2e-spell-card" style="border-radius:12px;box-shadow:0 4px 10px #2ecc7144;background:linear-gradient(135deg,#f8fff9 0%,#eafaf1 100%);border:1.5px solid #27ae60;overflow:hidden;padding:0;font-family:var(--font-primary);">
      <div style="background:linear-gradient(90deg,#1f8f3a 0%,#27ae60 100%);padding:8px 12px;color:white;display:flex;align-items:center;gap:10px;border-bottom:2px solid #166534;">
        <img src="${caster.img}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
        <div style="line-height:1.2;flex:1;">
          <div style="font-weight:bold;font-size:1.05em;">${caster.name}</div>
          <div style="font-size:0.85em;opacity:0.9;">lance <b>${sourceItem.name}</b></div>
        </div>
        <img src="${sourceItem.img || "icons/magic/life/cross-green-white.webp"}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
      </div>

      <div style="padding:10px;">
        <div style="margin-bottom:6px;font-size:0.95em;color:#14532d;">
          <b>Cible :</b> ${targetActor.name}
        </div>

        ${resultText}

        <details style="margin-top:8px;background:#fff;border:1px solid #bbf7d0;border-radius:6px;">
          <summary style="cursor:pointer;color:#166534;font-weight:600;padding:6px;">Règle appliquée</summary>
          <div style="padding:8px;font-size:0.85em;line-height:1.45;">
            <div><b>Soins mineurs</b> — Clerc niveau 1, nécromancie.</div>
            <div>Portée : au toucher ; temps d’incantation : 5 segments ; durée : permanente ; jet de protection : aucun.</div>
            <div>Effet automatisé : rend <b>1d8 points de vie</b>, sans dépasser les PV maximum.</div>
          </div>
        </details>
      </div>
    </div>`
  });

  // ======================================================
  // 8. VFX OPTIONNEL
  // ======================================================
  if (typeof Sequence !== "undefined" && targetToken) {
    try {
      new Sequence()
        .effect()
        .file("jb2a.healing_generic.200px.green")
        .attachTo(targetToken)
        .scaleToObject(1.2)
        .opacity(0.85)
        .belowTokens(false)
        .play()
        .catch(() => {});
    } catch (e) {
      // VFX optionnel : aucune erreur bloquante.
    }
  }

  return true;
})();