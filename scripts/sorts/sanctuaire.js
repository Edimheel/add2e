// ADD2E — Sanctuaire (Clerc niveau 1)
// Compatible Foundry V13/V14/V15.
// Contrat onUse : true = sort consommé ; false = sort non consommé.

const __add2eSanctuaryResult = await (async () => {
  const CONFIG = Object.freeze({
    name: "Sanctuaire",
    slug: "sanctuaire",
    roundsFormula: "2+level",
    icon: "systems/add2e/assets/icones/sorts/sanctuaire.webp",
    actionGate: Object.freeze({
      kind: "save_gate",
      scope: "target",
      actions: ["attaque"],
      saveType: "sorts",
      onFailure: "block",
      label: "Le sanctuaire impose un jet de protection contre les sorts avant cette attaque.",
      onUse: "systems/add2e/scripts/sorts/sanctuaire.js",
      onUseMode: "actionGateResolved"
    }),
    ownerAttackBlock: Object.freeze({
      kind: "block_action",
      scope: "owner",
      actions: ["attaque"],
      label: "Le bénéficiaire de Sanctuaire ne peut accomplir aucune action offensive."
    }),
    tags: [
      "sort:sanctuaire",
      "etat:sanctuaire",
      "defense:sanctuaire",
      "condition:aucune_action_offensive"
    ]
  });

  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const normalize = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const chatStyle = () => CONST.CHAT_MESSAGE_STYLES
    ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
    : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };

  const actionEvent = typeof args !== "undefined" ? args?.[0] ?? null : null;
  if (actionEvent?.add2eMode === CONFIG.actionGate.onUseMode) {
    const gate = actionEvent.actionGate ?? {};
    const action = actionEvent.action ?? {};
    const effectFlags = actionEvent.effectFlags ?? actionEvent.effect?.flags?.add2e ?? {};
    const attacker = action.actor ?? action.sourceActor ?? null;
    const targetActor = action.targetActor ?? null;
    const targetToken = action.targetToken ?? null;
    const save = gate.save ?? null;
    const allowed = gate.allowed !== false;

    if (!attacker || !targetActor) return false;

    const casterName = effectFlags.casterName ?? "Clerc";
    const casterImg = effectFlags.casterImg ?? "icons/svg/mystery-man.svg";
    const spellImg = effectFlags.sourceSpellImg ?? CONFIG.icon;
    const targetName = targetToken?.name ?? targetActor.name ?? "Cible";
    const saveText = save?.canRoll
      ? `${save.total} / ${save.threshold}${save.bonus ? ` (${save.bonus >= 0 ? "+" : ""}${save.bonus})` : ""}`
      : "indisponible";
    const title = allowed ? "SANCTUAIRE FRANCHI" : "ATTAQUE BLOQUÉE PAR SANCTUAIRE";
    const accent = allowed ? "#2f8f46" : "#b33a2e";
    const conclusion = allowed
      ? `${attacker.name} réussit son jet de protection et peut attaquer ${targetName}.`
      : `${attacker.name} échoue à son jet de protection et doit ignorer ${targetName}.`;
    const ruleText = allowed
      ? "La sauvegarde contre les sorts est réussie : l’attaque ciblée est autorisée."
      : "La sauvegarde contre les sorts est échouée : l’attaque ciblée est annulée. Les effets de zone ne sont pas arrêtés par cette protection.";

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker, token: action.sourceToken ?? null }),
      content: `
        <div class="add2e-chat-card add2e-spell-card add2e-spell-card-clerc add2e-sanctuary-resolution" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,#fffaf0,#fff7df);border:1.5px solid #e2bc63;overflow:hidden;padding:0;font-family:var(--font-primary);">
          <div style="background:linear-gradient(90deg,#6f4b12,#b88924);padding:8px 12px;color:#fff;display:flex;align-items:center;gap:10px;border-bottom:2px solid #8a611d;">
            <img src="${esc(casterImg)}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
            <div style="line-height:1.2;flex:1;">
              <div style="font-weight:bold;font-size:1.05em;">${esc(casterName)}</div>
              <div style="font-size:.85em;opacity:.95;">a protégé <b>${esc(targetName)}</b> par Sanctuaire</div>
            </div>
            <div style="text-align:right;font-size:.78em;opacity:.95;">Sort divin</div>
            <img src="${esc(spellImg)}" style="width:32px;height:32px;border-radius:4px;background:#fff;object-fit:cover;">
          </div>
          <div style="padding:10px;color:#6f4b12;">
            <div style="text-align:center;border:1px solid ${accent};border-radius:7px;padding:8px;background:#fffdf7;color:${accent};font-weight:900;">${title}</div>
            <table style="width:100%;border-collapse:collapse;margin-top:7px;font-size:.9em;">
              <tbody>
                <tr><td style="padding:4px 6px;"><b>Attaquant</b></td><td style="padding:4px 6px;text-align:right;">${esc(attacker.name)}</td></tr>
                <tr><td style="padding:4px 6px;"><b>Cible protégée</b></td><td style="padding:4px 6px;text-align:right;">${esc(targetName)}</td></tr>
                <tr><td style="padding:4px 6px;"><b>Jet de protection contre les sorts</b></td><td style="padding:4px 6px;text-align:right;">${esc(saveText)}</td></tr>
              </tbody>
            </table>
            <div style="margin-top:7px;padding:7px 8px;border-left:4px solid ${accent};background:#fffdf7;border-radius:4px;font-size:.88em;line-height:1.35;">${esc(conclusion)}</div>
            <details style="margin-top:8px;background:#fffdf5;border:1px solid #e2bc63;border-radius:6px;">
              <summary style="cursor:pointer;color:#6f4b12;font-weight:600;padding:6px;">Règle appliquée</summary>
              <div style="padding:8px;font-size:.85em;line-height:1.45;">${esc(ruleText)}</div>
            </details>
          </div>
        </div>`,
      ...chatStyle()
    });
    return true;
  }

  const sourceItem = typeof sort !== "undefined" && sort
    ? sort
    : typeof item !== "undefined" && item
      ? item
      : typeof spell !== "undefined" && spell
        ? spell
        : typeof args !== "undefined" && args?.[0]?.item
          ? args[0].item
          : typeof this !== "undefined" && this?.documentName === "Item"
            ? this
            : null;
  if (!sourceItem) {
    ui.notifications?.error?.("Sanctuaire : sort introuvable.");
    return false;
  }

  const caster = typeof actor !== "undefined" && actor ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications?.error?.("Sanctuaire : lanceur introuvable.");
    return false;
  }

  const casterToken = canvas.tokens?.controlled?.find(tokenDoc => tokenDoc?.actor?.id === caster.id)
    ?? (typeof token !== "undefined" && token?.actor?.id === caster.id ? token : null)
    ?? caster.getActiveTokens?.()[0]
    ?? null;
  if (!casterToken) {
    ui.notifications?.warn?.("Sanctuaire : sélectionne le token du lanceur.");
    return false;
  }

  const classItems = [...(caster.items ?? [])].filter(entry => String(entry?.type ?? "").toLowerCase() === "classe");
  const cleric = classItems.find(entry => {
    const values = [entry.name, entry.system?.nom, entry.system?.label, entry.system?.slug, entry.system?.tags, entry.flags?.add2e?.tags]
      .flatMap(value => Array.isArray(value) ? value : [value])
      .map(normalize);
    return values.some(value => value === "clerc" || value.includes("classe:clerc") || value.includes("clerc"));
  });
  const level = [
    cleric?.system?.niveau,
    cleric?.system?.level,
    cleric?.system?.details?.niveau,
    cleric?.system?.details?.level,
    caster.system?.details_classe?.clerc?.niveau,
    caster.system?.details_classe?.clerc?.level,
    caster.system?.classes?.clerc?.niveau,
    caster.system?.classes?.clerc?.level,
    caster.system?.multiclass?.clerc?.niveau,
    caster.system?.multiclass?.clerc?.level,
    caster.system?.niveau,
    caster.system?.level
  ].map(Number).find(value => Number.isFinite(value) && value > 0) ?? 1;

  const selectedTargets = Array.from(game.user?.targets ?? []);
  if (selectedTargets.length !== 1 || !selectedTargets[0]?.actor) {
    ui.notifications?.warn?.("Sanctuaire : cible exactement une créature touchée.");
    return false;
  }

  const targetToken = selectedTargets[0];
  const targetActor = targetToken.actor;
  const tokenBounds = tokenDoc => {
    const object = tokenDoc?.object ?? tokenDoc;
    const gridSize = Number(canvas?.grid?.size) || 100;
    const document = object?.document ?? tokenDoc?.document ?? tokenDoc ?? {};
    return {
      x: Number(object?.x ?? document?.x ?? 0),
      y: Number(object?.y ?? document?.y ?? 0),
      width: Number(object?.w ?? Number(document?.width ?? 1) * gridSize),
      height: Number(object?.h ?? Number(document?.height ?? 1) * gridSize)
    };
  };
  const first = tokenBounds(casterToken);
  const second = tokenBounds(targetToken);
  const gapX = Math.max(0, Math.max(first.x, second.x) - Math.min(first.x + first.width, second.x + second.width));
  const gapY = Math.max(0, Math.max(first.y, second.y) - Math.min(first.y + first.height, second.y + second.height));
  if (casterToken.id !== targetToken.id && (gapX > 1 || gapY > 1)) {
    ui.notifications?.warn?.("Sanctuaire : la cible doit être au toucher.");
    return false;
  }

  const rounds = (game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE)?.toRounds?.(CONFIG.roundsFormula, "round", { level })
    ?? (2 + level);
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const duration = time?.durationData?.(rounds) ?? {
    rounds,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };
  const casterImg = casterToken.document?.texture?.src ?? caster.img ?? "icons/svg/mystery-man.svg";
  const spellImg = sourceItem.img ?? CONFIG.icon;
  const timeFlags = time?.flags?.({
    source: "sanctuaire.js",
    rounds,
    unit: "round",
    endMessage: "Le sanctuaire protégeant {actor} prend fin.",
    extra: {
      spellName: CONFIG.name,
      spellKey: CONFIG.slug,
      level,
      sourceItemUuid: sourceItem.uuid ?? null,
      casterId: caster.id,
      casterUuid: caster.uuid,
      targetId: targetActor.id,
      targetUuid: targetActor.uuid,
      tags: CONFIG.tags
    }
  }) ?? {
    timeEngine: { managed: true, unit: "round", totalRounds: rounds },
    roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage: "Le sanctuaire protégeant {actor} prend fin." },
    endMessage: "Le sanctuaire protégeant {actor} prend fin.",
    spellName: CONFIG.name,
    spellKey: CONFIG.slug,
    level,
    sourceItemUuid: sourceItem.uuid ?? null,
    casterId: caster.id,
    casterUuid: caster.uuid,
    targetId: targetActor.id,
    targetUuid: targetActor.uuid
  };

  const effectData = {
    name: CONFIG.name,
    img: spellImg,
    origin: sourceItem.uuid ?? null,
    disabled: false,
    transfer: false,
    changes: [],
    duration,
    description: `Les adversaires doivent réussir un jet de protection contre les sorts avant d’attaquer la cible. Le bénéficiaire ne peut accomplir aucune action offensive. Durée : ${rounds} rounds.`,
    flags: {
      add2e: {
        ...timeFlags,
        tags: CONFIG.tags,
        rules: [CONFIG.actionGate, CONFIG.ownerAttackBlock],
        sourceSpell: sourceItem.name ?? CONFIG.name,
        sourceSpellId: sourceItem.id ?? null,
        sourceSpellKey: CONFIG.slug,
        sourceSpellImg: spellImg,
        casterId: caster.id,
        casterUuid: caster.uuid,
        casterName: caster.name,
        casterImg,
        targetId: targetActor.id,
        targetUuid: targetActor.uuid,
        effectType: "sanctuary"
      }
    }
  };

  const existingIds = [...(targetActor.effects ?? [])]
    .filter(effect => (effect.flags?.add2e?.tags ?? []).map(normalize).includes(`sort:${CONFIG.slug}`))
    .map(effect => effect.id)
    .filter(Boolean);
  const direct = game.user?.isGM || targetActor.isOwner;

  if (direct) {
    if (existingIds.length) await targetActor.deleteEmbeddedDocuments("ActiveEffect", existingIds);
    await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  } else if (game.socket) {
    if (existingIds.length) {
      game.socket.emit("system.add2e", {
        type: "ADD2E_GM_OPERATION",
        operation: "deleteActiveEffects",
        payload: {
          actorUuid: targetActor.uuid,
          actorId: targetActor.id,
          effectIds: existingIds,
          tags: [`sort:${CONFIG.slug}`],
          fromUserId: game.user.id
        }
      });
    }
    game.socket.emit("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation: "createActiveEffect",
      payload: {
        actorUuid: targetActor.uuid,
        actorId: targetActor.id,
        effectData,
        fromUserId: game.user.id
      }
    });
  } else {
    ui.notifications?.error?.("Sanctuaire : socket indisponible.");
    return false;
  }

  try {
    await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX?.(targetToken, "protection");
    await globalThis.ADD2E_PLAY_SPELL_FX?.(CONFIG.slug, { casterToken, targetToken });
  } catch {}

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
    content: `
      <div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,#fffaf0,#fff7df);border:1.5px solid #e2bc63;overflow:hidden;padding:0;font-family:var(--font-primary);">
        <div style="background:linear-gradient(90deg,#6f4b12,#b88924);padding:8px 12px;color:#fff;display:flex;align-items:center;gap:10px;border-bottom:2px solid #8a611d;">
          <img src="${esc(casterImg)}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
          <div style="line-height:1.2;flex:1;"><div style="font-weight:bold;font-size:1.05em;">${esc(caster.name)}</div><div style="font-size:.85em;opacity:.95;">lance <b>${esc(sourceItem.name ?? CONFIG.name)}</b></div></div>
          <div style="text-align:right;font-size:.78em;opacity:.95;">Sort divin</div>
          <img src="${esc(spellImg)}" style="width:32px;height:32px;border-radius:4px;background:#fff;object-fit:cover;">
        </div>
        <div style="padding:10px;color:#6f4b12;">
          <div style="margin-bottom:7px;font-size:.95em;"><b>Cible :</b> ${esc(targetToken.name ?? targetActor.name)}</div>
          <div style="text-align:center;border:1px solid #e2bc63;border-radius:7px;padding:8px;background:#fffdf7;"><b style="color:#2f8f46;">SANCTUAIRE APPLIQUÉ</b><div style="margin-top:4px;font-size:.9em;"><b>Durée :</b> ${rounds} rounds · <b>Portée :</b> toucher · <b>JS :</b> aucun</div></div>
          <div style="margin-top:7px;padding:7px 8px;border-left:4px solid #2f8f46;background:#f0faf2;border-radius:4px;font-size:.88em;line-height:1.35;">Toute créature qui tente d’attaquer la cible doit réussir un jet de protection contre les sorts. Le bénéficiaire ne peut accomplir aucune action offensive.</div>
          <details style="margin-top:8px;background:#fffdf5;border:1px solid #e2bc63;border-radius:6px;"><summary style="cursor:pointer;color:#6f4b12;font-weight:600;padding:6px;">Règle appliquée</summary><div style="padding:8px;font-size:.85em;line-height:1.45;">En cas d’échec au jet, l’attaquant doit ignorer la cible. Les effets de zone, tels qu’une boule de feu ou une tempête de glace, ne sont pas arrêtés par Sanctuaire.</div></details>
        </div>
      </div>`,
    ...chatStyle()
  });

  return true;
})();

return __add2eSanctuaryResult === true ? true : false;