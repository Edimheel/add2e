/**
 * ADD2E — Sort APAISEMENT / ÉPOUVANTE
 * Foundry V13/V14
 *
 * Règle automatisée d'après le Manuel des Joueurs :
 * - Apaisement : au toucher, +4 aux JS contre les attaques magiques provoquant la peur pendant 1 tour.
 * - Si la cible est déjà sous l'emprise d'une peur, elle peut retenter un JS avec +1 par niveau du clerc.
 * - Inverse, Épouvante : la victime touchée fuit le plus vite et le plus loin possible du clerc pendant 1 round par niveau.
 * - Apaisement et Épouvante s'annulent mutuellement.
 *
 * Côté joueur : utilise le relais MJ générique ADD2E_GM_OPERATION pour créer les ActiveEffects
 * si le joueur ne possède pas la cible.
 */

console.log("%c[ADD2E][APAISEMENT] V13/V14-GM-RELAY", "color:#b88924;font-weight:bold;");

const __add2eOnUseResult = await (async () => {
  const DialogV2 = foundry.applications?.api?.DialogV2;

  if (!DialogV2) {
    ui.notifications.error("DialogV2 est introuvable. Ce script nécessite Foundry V13/V14.");
    return false;
  }

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
    warn: "#b88924",
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

  function add2eSpellImg(src, fallback = "icons/magic/holy/barrier-shield-winged-blue.webp") {
    return add2eEscapeHtml(src || fallback);
  }

  function add2eClercCard({ caster, sourceItem, targetActor, title, resultHtml, mode }) {
    const casterName = add2eEscapeHtml(caster?.name ?? "Lanceur");
    const targetName = add2eEscapeHtml(targetActor?.name ?? "Cible");
    const spellName = add2eEscapeHtml(title || sourceItem?.name || "Apaisement");
    const modeLabel = mode === "epouvante" ? "Sort divin inversé" : "Sort divin";

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

          <div style="text-align:right;font-size:0.78em;opacity:0.95;">${modeLabel}</div>
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
              <div><b>Apaisement</b> — Clerc niveau 1, abjuration, réversible.</div>
              <div>Portée : au toucher ; temps d’incantation : 4 segments ; zone d’effet : créature touchée.</div>
              <div>Apaisement : +4 aux jets de protection contre les attaques magiques provoquant la peur pendant 1 tour.</div>
              <div>Si la cible est déjà sous l’emprise d’une peur, elle peut retenter un jet de protection avec +1 par niveau du clerc.</div>
              <div>Inverse : Épouvante fait fuir la victime touchée pendant 1 round par niveau du clerc.</div>
            </div>
          </details>
        </div>
      </div>
    `;
  }

  function add2eNormalizeKey(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/\s+/g, "_");
  }

  function add2eEffectTags(effect) {
    const tags = [];
    const raw = effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? [];

    if (Array.isArray(raw)) tags.push(...raw);
    else if (typeof raw === "string") tags.push(...raw.split(/[,;\n]+/));

    return tags.map(add2eNormalizeKey).filter(Boolean);
  }

  function add2eFindEffects(actorDoc, mode) {
    if (!actorDoc?.effects) return [];

    const wanted = mode === "epouvante"
      ? ["etat:epouvante", "etat:peur", "controle:fuite"]
      : ["etat:apaise", "bonus_js_peur:4", "bonus_save_vs:peur:4"];

    return actorDoc.effects.filter(effect => {
      const name = add2eNormalizeKey(effect.name);
      const tags = add2eEffectTags(effect);

      if (mode === "epouvante") {
        return name.includes("epouvante") || name.includes("peur") || wanted.some(t => tags.includes(add2eNormalizeKey(t)));
      }

      return name.includes("apaisement") || name.includes("apaise") || wanted.some(t => tags.includes(add2eNormalizeKey(t)));
    });
  }

  function add2eIsResponsableGM() {
    if (!game.user.isGM) return false;
    if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
    return game.users.activeGM?.id === game.user.id;
  }

  function add2eEmitGMOperation(operation, payload) {
    const message = {
      type: "ADD2E_GM_OPERATION",
      operation,
      payload: {
        ...(payload ?? {}),
        fromUserId: game.user.id,
        sentAt: Date.now()
      }
    };

    console.log("[ADD2E][APAISEMENT][GM-RELAY] emit :", message);
    game.socket?.emit("system.add2e", message);
  }

  async function add2eCreateEffectOnActor(actorDoc, effectData) {
    if (!actorDoc) return false;

    if (game.user.isGM || actorDoc.isOwner) {
      await actorDoc.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return true;
    }

    if (!game.socket) {
      ui.notifications.error("Apaisement : socket indisponible, impossible de demander l’effet au MJ.");
      return false;
    }

    add2eEmitGMOperation("createActiveEffect", {
      actorUuid: actorDoc.uuid,
      actorId: actorDoc.id,
      effectData
    });

    return true;
  }

  async function add2eTryDeleteEffects(actorDoc, effects) {
    if (!effects?.length) return { deleted: 0, blocked: false };

    if (game.user.isGM || actorDoc.isOwner) {
      const ids = effects.map(e => e.id).filter(Boolean);
      if (ids.length) await actorDoc.deleteEmbeddedDocuments("ActiveEffect", ids);
      return { deleted: ids.length, blocked: false };
    }

    return { deleted: 0, blocked: true };
  }

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

  async function add2eGetSaveVsSpells(actorDoc) {
    if (!actorDoc) return NaN;

    if (actorDoc.type === "monster") {
      try {
        const sheetData = await actorDoc.sheet.getData();
        const val = Number(sheetData?.calculatedSaves?.sorts);
        if (Number.isFinite(val) && val > 0) return val;
      } catch (e) {
        console.warn("[ADD2E][APAISEMENT] sauvegarde monstre impossible via sheet.getData", e);
      }
    }

    const candidates = [
      actorDoc.system?.sauvegarde_sortileges,
      actorDoc.system?.sauvegardes?.sortileges,
      actorDoc.system?.saves?.sorts,
      actorDoc.system?.calculatedSaves?.sorts
    ];

    for (const raw of candidates) {
      const val = Number(raw);
      if (Number.isFinite(val) && val > 0) return val;
    }

    return NaN;
  }

  // ======================================================
  // 1. INITIALISATION
  // ======================================================
  let sourceItem =
    (typeof item !== "undefined" && item)
      ? item
      : ((typeof sort !== "undefined" && sort) ? sort : this);

  if ((!sourceItem || !sourceItem.system) && typeof args !== "undefined" && args?.[0]?.item) {
    sourceItem = args[0].item;
  }

  if (!sourceItem) {
    ui.notifications.error("Apaisement : sort introuvable.");
    return false;
  }

  const casterTokenObj =
    canvas.tokens.controlled[0]
    ?? ((typeof token !== "undefined" && token) ? token : null);

  if (!casterTokenObj) {
    ui.notifications.warn("Sélectionne le token du lanceur avant d’utiliser Apaisement.");
    return false;
  }

  const casterTokenDoc = casterTokenObj.document;
  const caster = casterTokenObj.actor ?? sourceItem.parent ?? actor;

  if (!caster) {
    ui.notifications.error("Apaisement : lanceur introuvable.");
    return false;
  }

  const targets = Array.from(game.user.targets ?? []);

  if (targets.length !== 1) {
    ui.notifications.warn("Apaisement : cible exactement une créature.");
    return false;
  }

  const targetTokenObj = targets[0];
  const targetTokenDoc = targetTokenObj.document;
  const targetActorDoc = targetTokenObj.actor;

  if (!targetActorDoc) {
    ui.notifications.warn("Apaisement : cible sans acteur.");
    return false;
  }

  if (!add2eTokensAuContact(casterTokenObj, targetTokenObj)) {
    ui.notifications.warn("Apaisement : la cible doit être au toucher.");
    return false;
  }

  const casterLevel = Math.max(1, Number(caster.system?.niveau) || 1);

  // ======================================================
  // 2. DIALOGUE
  // ======================================================
  const content = `
    <form class="add2e-apaisement-form" style="font-family:var(--font-primary); display:flex; flex-direction:column; gap:8px;">
      <div class="form-group">
        <label style="font-weight:bold;">Version du sort :</label>
        <select name="mode" style="width:100%;">
          <option value="apaisement">Apaisement — protection contre la peur</option>
          <option value="epouvante">Épouvante — inverse du sort</option>
        </select>
      </div>

      <label style="display:flex;align-items:center;gap:6px;">
        <input type="checkbox" name="touchConfirmed" checked>
        <span>La cible est consentante ou le contact a été réussi.</span>
      </label>

      <div style="font-size:0.9em; color:#666; border-top:1px solid #ddd; padding-top:6px;">
        <div><b>Cible :</b> ${add2eEscapeHtml(targetActorDoc.name)}</div>
        <div><b>Niveau du clerc :</b> ${casterLevel}</div>
        <div><b>Apaisement :</b> +4 aux JS contre peur magique pendant 1 tour.</div>
        <div><b>Épouvante :</b> fuite pendant ${casterLevel} round(s).</div>
      </div>
    </form>
  `;

  const dialogResult = await DialogV2.wait({
    window: {
      title: "Lancement : Apaisement"
    },
    content,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "fa-solid fa-hands-praying",
        default: true,
        callback: (event, button) => ({
          mode: String(button.form.elements.mode?.value || "apaisement"),
          touchConfirmed: !!button.form.elements.touchConfirmed?.checked
        })
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ],
    rejectClose: false
  });

  if (!dialogResult) return false;

  if (!dialogResult.touchConfirmed) {
    ui.notifications.warn("Apaisement : le contact n’est pas confirmé. Le sort n’est pas lancé.");
    return false;
  }

  const mode = dialogResult.mode === "epouvante" ? "epouvante" : "apaisement";
  const title = mode === "epouvante" ? "Épouvante" : "Apaisement";

  // ======================================================
  // 3. APPLICATION
  // ======================================================
  let resultHtml = "";

  if (mode === "apaisement") {
    const oppositeEffects = add2eFindEffects(targetActorDoc, "epouvante");
    const deleteResult = await add2eTryDeleteEffects(targetActorDoc, oppositeEffects);

    const fearEffects = add2eFindEffects(targetActorDoc, "epouvante");
    let saveHtml = "";

    if (fearEffects.length) {
      const saveVal = await add2eGetSaveVsSpells(targetActorDoc);

      if (Number.isFinite(saveVal) && saveVal > 0) {
        const roll = await new Roll(`1d20+${casterLevel}`).evaluate({ async: true });
        if (game.dice3d) await game.dice3d.showForRoll(roll);

        const success = roll.total >= saveVal;

        let removedFear = { deleted: 0, blocked: false };
        if (success) {
          removedFear = await add2eTryDeleteEffects(targetActorDoc, fearEffects);
        }

        saveHtml = `
          <div style="margin-top:6px;border:1px solid ${success ? ADD2E_CLERIC_CHAT.success : ADD2E_CLERIC_CHAT.fail};background:${success ? "#f1fff4" : "#fff5f2"};border-radius:6px;padding:7px;text-align:center;color:${ADD2E_CLERIC_CHAT.dark};">
            <div style="font-weight:bold;color:${success ? ADD2E_CLERIC_CHAT.success : ADD2E_CLERIC_CHAT.fail};">
              ${success ? "NOUVEAU JS RÉUSSI" : "NOUVEAU JS RATÉ"}
            </div>
            <div>Jet : <b>${add2eEscapeHtml(roll.result)}</b> = <b>${roll.total}</b> contre ${saveVal}</div>
            ${success && removedFear.deleted ? `<div>Effet de peur supprimé : <b>${removedFear.deleted}</b></div>` : ""}
            ${success && removedFear.blocked ? `<div style="color:${ADD2E_CLERIC_CHAT.warn};">Réussite : l’effet de peur doit être supprimé par le MJ.</div>` : ""}
          </div>
        `;
      } else {
        saveHtml = `
          <div style="margin-top:6px;border:1px solid ${ADD2E_CLERIC_CHAT.warn};background:#fffdf4;border-radius:6px;padding:7px;text-align:center;color:${ADD2E_CLERIC_CHAT.dark};">
            <div style="font-weight:bold;color:${ADD2E_CLERIC_CHAT.warn};">JS supplémentaire non automatisé</div>
            <div>La sauvegarde contre les sortilèges de la cible est introuvable.</div>
            <div>Bonus applicable : <b>+${casterLevel}</b>.</div>
          </div>
        `;
      }
    }

    const effectData = {
      name: "Apaisement",
      img: sourceItem.img || "icons/magic/holy/barrier-shield-winged-blue.webp",
      origin: sourceItem.uuid,
      disabled: false,
      transfer: false,
      duration: {
        rounds: 10,
        startRound: game.combat?.round ?? null,
        startTurn: game.combat?.turn ?? null,
        startTime: game.time.worldTime
      },
      description: "Apaisement : +4 aux jets de protection contre les attaques magiques provoquant la peur pendant 1 tour.",
      flags: {
        add2e: {
          spellName: "Apaisement",
          mode: "apaisement",
          sourceItemUuid: sourceItem.uuid,
          casterId: caster.id,
          casterUuid: caster.uuid,
          tags: [
            "etat:apaise",
            "bonus_js_peur:4",
            "bonus_save_vs:peur:4"
          ]
        }
      },
      changes: []
    };

    const created = await add2eCreateEffectOnActor(targetActorDoc, effectData);

    if (!created) return false;

    resultHtml = `
      <div style="border:1px solid ${ADD2E_CLERIC_CHAT.border};background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:${ADD2E_CLERIC_CHAT.dark};">
        <div style="font-weight:bold;color:${ADD2E_CLERIC_CHAT.success};">APAISEMENT APPLIQUÉ</div>
        <div>Bonus : <b>+4</b> aux jets de protection contre les attaques magiques provoquant la peur.</div>
        <div>Durée : <b>1 tour</b> / 10 rounds.</div>
        ${deleteResult.deleted ? `<div>Épouvante annulée : <b>${deleteResult.deleted}</b> effet(s) supprimé(s).</div>` : ""}
        ${deleteResult.blocked ? `<div style="color:${ADD2E_CLERIC_CHAT.warn};">Un effet d’Épouvante est présent : suppression à effectuer par le MJ si nécessaire.</div>` : ""}
      </div>
      ${saveHtml}
    `;
  }

  if (mode === "epouvante") {
    const oppositeEffects = add2eFindEffects(targetActorDoc, "apaisement");
    const deleteResult = await add2eTryDeleteEffects(targetActorDoc, oppositeEffects);

    const effectData = {
      name: "Épouvante",
      img: sourceItem.img || "icons/magic/control/fear-fright-monster-red.webp",
      origin: sourceItem.uuid,
      disabled: false,
      transfer: false,
      duration: {
        rounds: casterLevel,
        startRound: game.combat?.round ?? null,
        startTurn: game.combat?.turn ?? null,
        startTime: game.time.worldTime
      },
      description: `Épouvante : la victime touchée fuit le plus vite possible et le plus loin possible du clerc pendant ${casterLevel} round(s).`,
      flags: {
        add2e: {
          spellName: "Épouvante",
          mode: "epouvante",
          sourceItemUuid: sourceItem.uuid,
          casterId: caster.id,
          casterUuid: caster.uuid,
          tags: [
            "etat:epouvante",
            "etat:peur",
            "controle:fuite"
          ]
        }
      },
      changes: []
    };

    const created = await add2eCreateEffectOnActor(targetActorDoc, effectData);

    if (!created) return false;

    resultHtml = `
      <div style="border:1px solid ${ADD2E_CLERIC_CHAT.fail};background:#fff5f2;border-radius:6px;padding:8px;text-align:center;color:${ADD2E_CLERIC_CHAT.dark};">
        <div style="font-weight:bold;color:${ADD2E_CLERIC_CHAT.fail};">ÉPOUVANTE APPLIQUÉE</div>
        <div>La victime touchée fuit le plus vite possible et le plus loin possible du clerc.</div>
        <div>Durée : <b>${casterLevel}</b> round(s).</div>
        ${deleteResult.deleted ? `<div>Apaisement annulé : <b>${deleteResult.deleted}</b> effet(s) supprimé(s).</div>` : ""}
        ${deleteResult.blocked ? `<div style="color:${ADD2E_CLERIC_CHAT.warn};">Un effet d’Apaisement est présent : suppression à effectuer par le MJ si nécessaire.</div>` : ""}
      </div>
    `;
  }

  // ======================================================
  // 4. MESSAGE CHAT
  // ======================================================
  if (globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX) await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX(casterTokenObj ?? casterToken ?? caster, "divine");

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: add2eClercCard({
      caster,
      sourceItem,
      targetActor: targetActorDoc,
      title,
      resultHtml,
      mode
    }),
      ...(CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 })});

  console.log("[ADD2E][apaisement.js][ONUSE_RESULT]", true);
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT] Le script onUse doit retourner true ou false.", {
    script: "apaisement.js",
    result: __add2eOnUseResult
  });
  ui.notifications?.error?.(`${sourceItem?.name ?? item?.name ?? sort?.name ?? "Sort"} : le script onUse n'a pas retourné true/false.`);
  return false;
}

return __add2eOnUseResult;
