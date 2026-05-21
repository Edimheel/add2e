/**
 * ADD2E — Apaisement / Épouvante
 * Foundry V13/V14
 *
 * Contrat onUse : true = sort consommé, false = sort non consommé.
 * Apaisement : +4 aux JS contre peur magique pendant 1 tour.
 * Si la cible est déjà apeurée : nouveau JS avec +1 par niveau du clerc.
 * Épouvante : la cible touchée fuit au maximum de son déplacement, à l'opposé du clerc,
 * puis reçoit un effet de peur pendant 1 round par niveau.
 */

console.log("%c[ADD2E][APAISEMENT] V2026-05-21-EPOUVANTE-MOVE", "color:#b88924;font-weight:bold;");

const __add2eOnUseResult = await (async () => {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications.error("Apaisement : DialogV2 introuvable. Foundry V13/V14 requis.");
    return false;
  }

  const COLORS = {
    main: "#b88924",
    dark: "#6f4b12",
    pale: "#fff7df",
    pale2: "#fffaf0",
    border: "#e2bc63",
    success: "#2f8f46",
    fail: "#b33a2e",
    warn: "#b88924"
  };

  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const norm = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  const num = (value, fallback = 0) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value && typeof value === "object") {
      for (const key of ["actuel", "value", "valeur", "current", "max", "base", "vitesse", "movement", "metresTour", "donjonRoundMetres"]) {
        if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "object") return num(value[key], fallback);
      }
      return fallback;
    }
    const raw = String(value ?? "").trim();
    if (!raw) return fallback;
    const parsed = Number(raw.replace(/\s+/g, "").replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.+\-]/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  function chatStyleData() {
    return CONST.CHAT_MESSAGE_STYLES
      ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
      : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
  }

  function gmRelay(operation, payload) {
    const message = {
      type: "ADD2E_GM_OPERATION",
      operation,
      payload: { ...(payload ?? {}), fromUserId: game.user.id, sentAt: Date.now() }
    };
    console.log("[ADD2E][APAISEMENT][GM-RELAY] emit", message);
    game.socket?.emit("system.add2e", message);
  }

  function effectTags(effect) {
    const raw = effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? [];
    const list = Array.isArray(raw) ? raw : String(raw).split(/[,;\n]+/);
    return list.map(norm).filter(Boolean);
  }

  function findEffects(actorDoc, mode) {
    if (!actorDoc?.effects) return [];
    const wanted = mode === "epouvante"
      ? ["etat:epouvante", "etat:peur", "controle:fuite"]
      : ["etat:apaise", "bonus_js_peur:4", "bonus_save_vs:peur:4"];
    const wantedNorm = wanted.map(norm);

    return actorDoc.effects.filter(effect => {
      const name = norm(effect.name);
      const tags = effectTags(effect);
      if (mode === "epouvante") return name.includes("epouvante") || name.includes("peur") || wantedNorm.some(t => tags.includes(t));
      return name.includes("apaisement") || name.includes("apaise") || wantedNorm.some(t => tags.includes(t));
    });
  }

  async function createEffect(actorDoc, effectData) {
    if (!actorDoc) return false;
    if (game.user.isGM || actorDoc.isOwner) {
      await actorDoc.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return true;
    }
    if (!game.socket) {
      ui.notifications.error("Apaisement : socket indisponible, impossible de demander l’effet au MJ.");
      return false;
    }
    gmRelay("createActiveEffect", { actorUuid: actorDoc.uuid, actorId: actorDoc.id, effectData });
    return true;
  }

  async function deleteEffects(actorDoc, effects) {
    if (!effects?.length) return { deleted: 0, blocked: false };
    if (game.user.isGM || actorDoc.isOwner) {
      const ids = effects.map(e => e.id).filter(Boolean);
      if (ids.length) await actorDoc.deleteEmbeddedDocuments("ActiveEffect", ids);
      return { deleted: ids.length, blocked: false };
    }
    return { deleted: 0, blocked: true };
  }

  function tokensAtTouch(a, b) {
    if (!a || !b || a.id === b.id) return true;
    const grid = canvas.grid?.size || 100;
    const aLeft = a.document.x / grid;
    const aTop = a.document.y / grid;
    const aRight = aLeft + (a.document.width || 1);
    const aBottom = aTop + (a.document.height || 1);
    const bLeft = b.document.x / grid;
    const bTop = b.document.y / grid;
    const bRight = bLeft + (b.document.width || 1);
    const bBottom = bTop + (b.document.height || 1);
    const gapX = Math.max(0, bLeft - aRight, aLeft - bRight);
    const gapY = Math.max(0, bTop - aBottom, aTop - bBottom);
    return gapX <= 0.01 && gapY <= 0.01;
  }

  function unitToMeters(distance, unit) {
    const u = String(unit ?? "").toLowerCase();
    if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(u)) return distance * 0.3048;
    if (["km", "kilometre", "kilomètre", "kilometres", "kilomètres"].includes(u)) return distance * 1000;
    return distance;
  }

  function tokenCenter(tokenDoc) {
    const scene = tokenDoc?.parent ?? canvas?.scene;
    const grid = Number(scene?.grid?.size ?? canvas?.grid?.size ?? 100) || 100;
    return {
      x: Number(tokenDoc?.x ?? 0) + Number(tokenDoc?.width ?? 1) * grid / 2,
      y: Number(tokenDoc?.y ?? 0) + Number(tokenDoc?.height ?? 1) * grid / 2
    };
  }

  function maxMoveMeters(actorDoc) {
    if (!actorDoc) return 0;
    try {
      if (typeof globalThis.add2eComputeMovement === "function") {
        const computed = globalThis.add2eComputeMovement(actorDoc);
        const value = num(computed?.actuel ?? computed?.metresTour ?? computed?.vitesse, NaN);
        if (Number.isFinite(value) && value > 0) return value;
      }
    } catch (e) {
      console.warn("[ADD2E][APAISEMENT][EPOUVANTE][MOVE] add2eComputeMovement impossible", e);
    }

    const sys = actorDoc.system ?? {};
    for (const candidate of [
      sys.mouvement?.actuel,
      sys.mouvement?.metresTour,
      sys.mouvement?.vitesse,
      sys.movement,
      sys.vitesse_deplacement,
      sys.vitesse,
      sys.deplacement,
      sys["déplacement"]
    ]) {
      const value = num(candidate, NaN);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  }

  function fleeDestination(casterDoc, targetDoc, maxMeters) {
    const scene = targetDoc?.parent ?? canvas?.scene;
    const grid = Number(scene?.grid?.size ?? canvas?.grid?.size ?? 100) || 100;
    const gridDistance = Number(scene?.grid?.distance ?? canvas?.scene?.grid?.distance ?? 1) || 1;
    const gridUnits = scene?.grid?.units ?? canvas?.scene?.grid?.units ?? "m";
    const metersPerGrid = Math.max(0.01, unitToMeters(gridDistance, gridUnits));
    const maxPixels = Math.max(0, maxMeters) / metersPerGrid * grid;

    const c = tokenCenter(casterDoc);
    const t = tokenCenter(targetDoc);
    let dx = t.x - c.x;
    let dy = t.y - c.y;
    let len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len < 1) { dx = 1; dy = 0; len = 1; }

    const tokenWidthPx = Number(targetDoc.width ?? 1) * grid;
    const tokenHeightPx = Number(targetDoc.height ?? 1) * grid;
    let x = t.x + (dx / len) * maxPixels - tokenWidthPx / 2;
    let y = t.y + (dy / len) * maxPixels - tokenHeightPx / 2;

    x = Math.round(x / grid) * grid;
    y = Math.round(y / grid) * grid;

    const maxX = Math.max(0, Number(scene?.width ?? canvas?.dimensions?.width ?? x) - tokenWidthPx);
    const maxY = Math.max(0, Number(scene?.height ?? canvas?.dimensions?.height ?? y) - tokenHeightPx);
    x = Math.max(0, Math.min(maxX, x));
    y = Math.max(0, Math.min(maxY, y));

    const movedMeters = unitToMeters((Math.hypot(x - Number(targetDoc.x ?? 0), y - Number(targetDoc.y ?? 0)) / grid) * gridDistance, gridUnits);
    return { x, y, maxMeters: Math.round(maxMeters * 100) / 100, movedMeters: Math.round(movedMeters * 100) / 100 };
  }

  async function moveTokenForEpouvante(casterDoc, targetDoc, actorDoc) {
    const maxMeters = maxMoveMeters(actorDoc);
    if (!Number.isFinite(maxMeters) || maxMeters <= 0) {
      return { moved: false, requested: false, reason: "Déplacement maximum introuvable ou nul.", maxMeters: 0, movedMeters: 0 };
    }

    const dest = fleeDestination(casterDoc, targetDoc, maxMeters);
    if (Math.abs(dest.x - Number(targetDoc.x ?? 0)) < 1 && Math.abs(dest.y - Number(targetDoc.y ?? 0)) < 1) {
      return { moved: false, requested: false, reason: "La cible ne peut pas être éloignée davantage dans cette direction.", ...dest };
    }

    const updateData = {
      x: dest.x,
      y: dest.y,
      flags: {
        add2e: {
          epouvanteForcedMove: {
            casterTokenId: casterDoc?.id ?? null,
            movedAt: Date.now(),
            maxMeters: dest.maxMeters,
            movedMeters: dest.movedMeters
          },
          lastAllowedPosition: { x: dest.x, y: dest.y }
        }
      }
    };

    if (game.user.isGM) {
      await targetDoc.update(updateData, { add2eIgnoreMovement: true, add2eReason: "epouvante-forced-flee" });
      return { moved: true, requested: false, reason: "Déplacement appliqué.", ...dest };
    }

    gmRelay("updateToken", { sceneId: targetDoc.parent?.id ?? canvas.scene?.id, tokenId: targetDoc.id, updateData });
    return { moved: false, requested: true, reason: "Déplacement demandé au MJ.", ...dest };
  }

  async function saveVsSpells(actorDoc) {
    if (!actorDoc) return NaN;
    if (actorDoc.type === "monster") {
      try {
        const data = await actorDoc.sheet.getData();
        const val = Number(data?.calculatedSaves?.sorts);
        if (Number.isFinite(val) && val > 0) return val;
      } catch (e) {
        console.warn("[ADD2E][APAISEMENT] sauvegarde monstre impossible", e);
      }
    }
    for (const raw of [
      actorDoc.system?.sauvegarde_sortileges,
      actorDoc.system?.sauvegardes?.sortileges,
      actorDoc.system?.saves?.sorts,
      actorDoc.system?.calculatedSaves?.sorts
    ]) {
      const val = Number(raw);
      if (Number.isFinite(val) && val > 0) return val;
    }
    return NaN;
  }

  function spellCard({ caster, sourceItem, targetActor, title, resultHtml, mode }) {
    const casterName = esc(caster?.name ?? "Lanceur");
    const targetName = esc(targetActor?.name ?? "Cible");
    const spellName = esc(title || sourceItem?.name || "Apaisement");
    const modeLabel = mode === "epouvante" ? "Sort divin inversé" : "Sort divin";
    const casterImg = esc(caster?.img || "icons/svg/mystery-man.svg");
    const spellImg = esc(sourceItem?.img || "icons/magic/holy/barrier-shield-winged-blue.webp");

    return `
      <div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,${COLORS.pale2} 0%,${COLORS.pale} 100%);border:1.5px solid ${COLORS.border};overflow:hidden;font-family:var(--font-primary);">
        <div style="background:linear-gradient(90deg,${COLORS.dark} 0%,${COLORS.main} 100%);padding:8px 12px;color:white;display:flex;align-items:center;gap:10px;">
          <img src="${casterImg}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
          <div style="line-height:1.2;flex:1;"><div style="font-weight:bold;font-size:1.05em;">${casterName}</div><div style="font-size:0.85em;opacity:0.95;">lance <b>${spellName}</b></div></div>
          <div style="text-align:right;font-size:0.78em;opacity:0.95;">${esc(modeLabel)}</div>
          <img src="${spellImg}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
        </div>
        <div style="padding:10px;">
          <div style="margin-bottom:6px;font-size:0.95em;color:${COLORS.dark};"><b>Cible :</b> ${targetName}</div>
          ${resultHtml}
          <details style="margin-top:8px;background:white;border:1px solid ${COLORS.border};border-radius:6px;">
            <summary style="cursor:pointer;color:${COLORS.dark};font-weight:600;padding:6px;">Règle appliquée</summary>
            <div style="padding:8px;font-size:0.85em;line-height:1.45;color:${COLORS.dark};">
              <div><b>Apaisement</b> : +4 aux JS contre les attaques magiques provoquant la peur pendant 1 tour.</div>
              <div>Si la cible est déjà apeurée, elle peut retenter un JS avec +1 par niveau du clerc.</div>
              <div><b>Épouvante</b> : la cible fuit au maximum de son déplacement, à l'opposé du clerc, pendant 1 round par niveau.</div>
            </div>
          </details>
        </div>
      </div>`;
  }

  let sourceItem = (typeof item !== "undefined" && item) ? item : ((typeof sort !== "undefined" && sort) ? sort : this);
  if ((!sourceItem || !sourceItem.system) && typeof args !== "undefined" && args?.[0]?.item) sourceItem = args[0].item;
  if (!sourceItem) {
    ui.notifications.error("Apaisement : sort introuvable.");
    return false;
  }

  const casterTokenObj = canvas.tokens.controlled[0] ?? ((typeof token !== "undefined" && token) ? token : null);
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

  if (!tokensAtTouch(casterTokenObj, targetTokenObj)) {
    ui.notifications.warn("Apaisement : la cible doit être au toucher.");
    return false;
  }

  const casterLevel = Math.max(1, Number(caster.system?.niveau) || 1);

  const content = `
    <form class="add2e-apaisement-form" style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">
      <div class="form-group">
        <label style="font-weight:bold;">Version du sort :</label>
        <select name="mode" style="width:100%;">
          <option value="apaisement">Apaisement — protection contre la peur</option>
          <option value="epouvante">Épouvante — inverse du sort</option>
        </select>
      </div>
      <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" name="touchConfirmed" checked><span>La cible est consentante ou le contact a été réussi.</span></label>
      <div style="font-size:0.9em;color:#666;border-top:1px solid #ddd;padding-top:6px;">
        <div><b>Cible :</b> ${esc(targetActorDoc.name)}</div>
        <div><b>Niveau du clerc :</b> ${casterLevel}</div>
        <div><b>Apaisement :</b> +4 aux JS contre peur magique pendant 1 tour.</div>
        <div><b>Épouvante :</b> fuite immédiate au maximum du déplacement, puis peur pendant ${casterLevel} round(s).</div>
      </div>
    </form>`;

  const dialogResult = await DialogV2.wait({
    window: { title: "Lancement : Apaisement" },
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
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
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
  let resultHtml = "";

  if (mode === "apaisement") {
    const fearEffectsBefore = findEffects(targetActorDoc, "epouvante");
    let saveHtml = "";
    let deleteResult = { deleted: 0, blocked: false };

    if (fearEffectsBefore.length) {
      const saveVal = await saveVsSpells(targetActorDoc);
      if (Number.isFinite(saveVal) && saveVal > 0) {
        const roll = await new Roll(`1d20+${casterLevel}`).evaluate({ async: true });
        if (game.dice3d) await game.dice3d.showForRoll(roll);
        const success = roll.total >= saveVal;
        if (success) deleteResult = await deleteEffects(targetActorDoc, fearEffectsBefore);
        saveHtml = `<div style="margin-top:6px;border:1px solid ${success ? COLORS.success : COLORS.fail};background:${success ? "#f1fff4" : "#fff5f2"};border-radius:6px;padding:7px;text-align:center;color:${COLORS.dark};"><b style="color:${success ? COLORS.success : COLORS.fail};">${success ? "NOUVEAU JS RÉUSSI" : "NOUVEAU JS RATÉ"}</b><br>Jet : <b>${esc(roll.result)}</b> = <b>${roll.total}</b> contre ${saveVal}${success && deleteResult.deleted ? `<br>Effet de peur supprimé : <b>${deleteResult.deleted}</b>` : ""}${success && deleteResult.blocked ? `<br><span style="color:${COLORS.warn};">Suppression à effectuer par le MJ.</span>` : ""}</div>`;
      } else {
        saveHtml = `<div style="margin-top:6px;border:1px solid ${COLORS.warn};background:#fffdf4;border-radius:6px;padding:7px;text-align:center;color:${COLORS.dark};"><b>JS supplémentaire non automatisé</b><br>Sauvegarde contre les sortilèges introuvable. Bonus applicable : <b>+${casterLevel}</b>.</div>`;
      }
    }

    const created = await createEffect(targetActorDoc, {
      name: "Apaisement",
      img: sourceItem.img || "icons/magic/holy/barrier-shield-winged-blue.webp",
      origin: sourceItem.uuid,
      disabled: false,
      transfer: false,
      duration: { rounds: 10, startRound: game.combat?.round ?? null, startTurn: game.combat?.turn ?? null, startTime: game.time.worldTime },
      description: "Apaisement : +4 aux jets de protection contre les attaques magiques provoquant la peur pendant 1 tour.",
      flags: { add2e: { spellName: "Apaisement", mode: "apaisement", sourceItemUuid: sourceItem.uuid, casterId: caster.id, casterUuid: caster.uuid, tags: ["etat:apaise", "bonus_js_peur:4", "bonus_save_vs:peur:4"] } },
      changes: []
    });
    if (!created) return false;

    resultHtml = `<div style="border:1px solid ${COLORS.border};background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:${COLORS.dark};"><div style="font-weight:bold;color:${COLORS.success};">APAISEMENT APPLIQUÉ</div><div>Bonus : <b>+4</b> aux JS contre les attaques magiques provoquant la peur.</div><div>Durée : <b>1 tour</b> / 10 rounds.</div></div>${saveHtml}`;
  }

  if (mode === "epouvante") {
    const deleteResult = await deleteEffects(targetActorDoc, findEffects(targetActorDoc, "apaisement"));
    const moveResult = await moveTokenForEpouvante(casterTokenDoc, targetTokenDoc, targetActorDoc);

    const created = await createEffect(targetActorDoc, {
      name: "Épouvante",
      img: sourceItem.img || "icons/magic/control/fear-fright-monster-red.webp",
      origin: sourceItem.uuid,
      disabled: false,
      transfer: false,
      duration: { rounds: casterLevel, startRound: game.combat?.round ?? null, startTurn: game.combat?.turn ?? null, startTime: game.time.worldTime },
      description: `Épouvante : la victime touchée fuit le plus vite possible et le plus loin possible du clerc pendant ${casterLevel} round(s).`,
      flags: { add2e: { spellName: "Épouvante", mode: "epouvante", sourceItemUuid: sourceItem.uuid, casterId: caster.id, casterUuid: caster.uuid, tags: ["etat:epouvante", "etat:peur", "controle:fuite"] } },
      changes: []
    });
    if (!created) return false;

    const moveHtml = moveResult.requested
      ? `<div>Déplacement demandé au MJ : <b>${moveResult.movedMeters} m</b> / ${moveResult.maxMeters} m.</div>`
      : moveResult.moved
        ? `<div>Déplacement appliqué : <b>${moveResult.movedMeters} m</b> / ${moveResult.maxMeters} m.</div>`
        : `<div style="color:${COLORS.warn};">Déplacement automatique non appliqué : ${esc(moveResult.reason)}</div>`;

    resultHtml = `<div style="border:1px solid ${COLORS.fail};background:#fff5f2;border-radius:6px;padding:8px;text-align:center;color:${COLORS.dark};"><div style="font-weight:bold;color:${COLORS.fail};">ÉPOUVANTE APPLIQUÉE</div><div>La victime fuit le plus vite possible et le plus loin possible du clerc.</div>${moveHtml}<div>Durée : <b>${casterLevel}</b> round(s).</div>${deleteResult.deleted ? `<div>Apaisement annulé : <b>${deleteResult.deleted}</b> effet(s) supprimé(s).</div>` : ""}${deleteResult.blocked ? `<div style="color:${COLORS.warn};">Un effet d’Apaisement est présent : suppression à effectuer par le MJ si nécessaire.</div>` : ""}</div>`;
  }

  if (globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX) await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX(casterTokenObj, "divine");

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: spellCard({ caster, sourceItem, targetActor: targetActorDoc, title, resultHtml, mode }),
    ...chatStyleData()
  });

  console.log("[ADD2E][apaisement.js][ONUSE_RESULT]", true);
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT] Le script onUse doit retourner true ou false.", { script: "apaisement.js", result: __add2eOnUseResult });
  ui.notifications?.error?.(`${sourceItem?.name ?? item?.name ?? sort?.name ?? "Sort"} : le script onUse n'a pas retourné true/false.`);
  return false;
}

return __add2eOnUseResult;
