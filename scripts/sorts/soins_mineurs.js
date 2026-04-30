// Soins mineurs.js - AD&D2
// Clerc niveau 1 — Nécromancie
// Version : soins uniquement
// Règle : soigne 1d8 points de vie, au toucher, permanent, aucun jet de protection.
// Compatible joueur + MJ via add2eApplyDamage si disponible.

return await (async () => {

  console.log("%c[ADD2E][SOINS MINEURS] SCRIPT CUSTOM", "color:#b88924;font-weight:bold;");

  // ======================================================
  // 0. STYLE CHAT — SORTS DE CLERC
  // ======================================================
  const ADD2E_CLERIC_CHAT = {
    main: "#b88924",
    dark: "#6f4b12",
    pale: "#fff7df",
    pale2: "#fffaf0",
    border: "#e2bc63",
    borderDark: "#8a611d",
    success: "#2f8f46",
    fail: "#b33a2e",
    muted: "#6b5a35"
  };

  function add2eEscapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function add2eSpellImg(src, fallback = "icons/magic/life/cross-flared-green.webp") {
    return add2eEscapeHtml(src || fallback);
  }

  function add2eClercCard({ caster, sourceItem, targetActor, resultHtml }) {
    const casterName = add2eEscapeHtml(caster?.name ?? "Lanceur");
    const targetName = add2eEscapeHtml(targetActor?.name ?? "Cible");
    const spellName = add2eEscapeHtml(sourceItem?.name ?? "Soins mineurs");

    return `
      <div class="add2e-spell-card add2e-spell-card-clerc" style="
        border-radius:12px;
        box-shadow:0 4px 10px #0002;
        background:linear-gradient(135deg,${ADD2E_CLERIC_CHAT.pale2} 0%,${ADD2E_CLERIC_CHAT.pale} 100%);
        border:1.5px solid ${ADD2E_CLERIC_CHAT.border};
        overflow:hidden;
        padding:0;
        font-family:var(--font-primary);
      ">
        <div style="
          background:linear-gradient(90deg,${ADD2E_CLERIC_CHAT.dark} 0%,${ADD2E_CLERIC_CHAT.main} 100%);
          padding:8px 12px;
          color:white;
          display:flex;
          align-items:center;
          gap:10px;
          border-bottom:2px solid ${ADD2E_CLERIC_CHAT.borderDark};
        ">
          <img src="${add2eSpellImg(caster?.img, "icons/svg/mystery-man.svg")}" style="
            width:36px;
            height:36px;
            border-radius:50%;
            border:2px solid #fff;
            object-fit:cover;
          ">

          <div style="line-height:1.2;flex:1;">
            <div style="font-weight:bold;font-size:1.05em;">${casterName}</div>
            <div style="font-size:0.85em;opacity:0.95;">
              lance <b>${spellName}</b>
            </div>
          </div>

          <img src="${add2eSpellImg(sourceItem?.img)}" style="
            width:32px;
            height:32px;
            border-radius:4px;
            background:#fff;
          ">
        </div>

        <div style="padding:10px;">
          <div style="margin-bottom:6px;font-size:0.95em;color:${ADD2E_CLERIC_CHAT.dark};">
            <b>Cible :</b> ${targetName}
          </div>

          ${resultHtml}

          <details style="
            margin-top:8px;
            background:white;
            border:1px solid ${ADD2E_CLERIC_CHAT.border};
            border-radius:6px;
          ">
            <summary style="
              cursor:pointer;
              color:${ADD2E_CLERIC_CHAT.dark};
              font-weight:600;
              padding:6px;
            ">
              Règle appliquée
            </summary>

            <div style="
              padding:8px;
              font-size:0.85em;
              line-height:1.45;
              color:${ADD2E_CLERIC_CHAT.dark};
            ">
              <div><b>Soins mineurs</b> — Clerc niveau 1, nécromancie.</div>
              <div>Portée : au toucher ; durée : permanente ; jet de protection : aucun.</div>
              <div>Effet automatisé : rend <b>1d8 points de vie</b>, sans dépasser les PV maximum.</div>
            </div>
          </details>
        </div>
      </div>
    `;
  }

  // ======================================================
  // 1. INITIALISATION ROBUSTE
  // ======================================================
  let sourceItem = null;

  if (typeof sort !== "undefined" && sort) sourceItem = sort;
  else if (typeof item !== "undefined" && item) sourceItem = item;
  else if (typeof this !== "undefined" && this?.documentName === "Item") sourceItem = this;

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

  // ======================================================
  // 5. CAS MORT : MESSAGE PERSONNALISÉ ET RETURN TRUE
  // ======================================================
  if (currentHP <= -11) {
    const resultHtml = `
      <div style="
        border:1px solid ${ADD2E_CLERIC_CHAT.fail};
        background:#fff5f2;
        border-radius:6px;
        padding:8px;
        text-align:center;
      ">
        <div style="font-weight:bold;color:${ADD2E_CLERIC_CHAT.fail};">Échec</div>
        <div style="color:${ADD2E_CLERIC_CHAT.dark};">
          <b>${add2eEscapeHtml(targetActor.name)}</b> est mort : Soins mineurs ne ressuscite pas.
        </div>
      </div>
    `;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      content: add2eClercCard({
        caster,
        sourceItem,
        targetActor,
        resultHtml
      }),
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });

    return true;
  }

  // ======================================================
  // 6. JET DE SOINS : 1d8
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
  // 7. APPLICATION DU SOIN
  // ======================================================
  if (soinEffectif > 0) {
    if (typeof add2eApplyDamage === "function") {
      await add2eApplyDamage({
        cible: targetToken,
        montant: -soinEffectif,
        type: "soin",
        details: `Soins mineurs : ${soinEffectif} PV rendus`,
        source: sourceItem.name,
        lanceur: caster,
        silent: true,
        noChat: true
      });
    } else {
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
  // 8. MESSAGE CHAT UNIQUE PERSONNALISÉ
  // ======================================================
  let resultHtml = "";

  if (soinEffectif <= 0) {
    resultHtml = `
      <div style="
        border:1px solid ${ADD2E_CLERIC_CHAT.border};
        background:#fffdf4;
        border-radius:6px;
        padding:8px;
        text-align:center;
      ">
        <div style="font-weight:bold;color:${ADD2E_CLERIC_CHAT.main};">
          Aucun soin nécessaire
        </div>
        <div style="color:${ADD2E_CLERIC_CHAT.dark};">
          ${add2eEscapeHtml(targetActor.name)} est déjà au maximum de ses points de vie.
        </div>
      </div>
    `;
  } else {
    resultHtml = `
      <div style="
        border:1px solid ${ADD2E_CLERIC_CHAT.border};
        background:#fffdf4;
        border-radius:6px;
        padding:8px;
        text-align:center;
      ">
        <div style="font-weight:bold;color:${ADD2E_CLERIC_CHAT.success};">
          SOINS APPLIQUÉS
        </div>

        <div style="font-size:1.05em;margin-top:4px;color:${ADD2E_CLERIC_CHAT.dark};">
          Jet : <b>${add2eEscapeHtml(roll.result)}</b> = <b>${soinBrut}</b>
        </div>

        <div style="margin-top:4px;color:${ADD2E_CLERIC_CHAT.dark};">
          PV rendus :
          <b style="color:${ADD2E_CLERIC_CHAT.success};">${soinEffectif}</b>
          ${
            soinEffectif < soinBrut
              ? `<span style="color:${ADD2E_CLERIC_CHAT.muted};"> (limité par les PV maximum)</span>`
              : ""
          }
        </div>

        <div style="margin-top:4px;color:${ADD2E_CLERIC_CHAT.dark};">
          ${currentHP} → <b>${newHP}</b> / ${maxHP}
        </div>
      </div>
    `;
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: add2eClercCard({
      caster,
      sourceItem,
      targetActor,
      resultHtml
    }),
    type: CONST.CHAT_MESSAGE_TYPES.OTHER
  });

  // ======================================================
  // 9. VFX OPTIONNEL
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

  // IMPORTANT :
  // Lumière retourne true après avoir créé son message personnalisé.
  // Soins mineurs doit faire pareil pour éviter le fallback générique du moteur.
  return true;
})();