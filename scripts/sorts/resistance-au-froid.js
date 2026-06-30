// ADD2E — Résistance au froid (Clerc niveau 1)
// Compatible Foundry V13/V14/V15.
// Le moteur de lancement gère déjà le slot mémorisé : true le conserve, false le restitue.

const __add2eColdResistanceResult = await (async () => {
  const CONFIG = Object.freeze({
    name: "Résistance au froid",
    slug: "resistance_au_froid",
    naturalColdLimit: -18,
    tags: [
      "sort:resistance_au_froid",
      "etat:resistance_froid",
      "resistance:froid",
      "bonus_save_vs:froid:3",
      "reduction_degats:froid:echec:moitie",
      "reduction_degats:froid:reussite:quart",
      "temperature:froid_naturel:-18"
    ]
  });

  const escapeHtml = value => String(value ?? "")
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
    ui.notifications?.error?.("Résistance au froid : sort introuvable.");
    return false;
  }

  const caster = typeof actor !== "undefined" && actor ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications?.error?.("Résistance au froid : lanceur introuvable.");
    return false;
  }

  const casterToken = typeof token !== "undefined" && token
    ? token
    : typeof args !== "undefined" && args?.[0]?.token
      ? args[0].token
      : globalThis.canvas?.tokens?.controlled?.find(entry => entry?.actor?.id === caster.id)
        ?? caster.getActiveTokens?.()[0]
        ?? null;

  const getClericLevel = actorDoc => {
    const classItems = [...(actorDoc?.items ?? [])].filter(entry => String(entry?.type ?? "").toLowerCase() === "classe");
    const cleric = classItems.find(entry => {
      const tags = [
        entry.name,
        entry.system?.nom,
        entry.system?.label,
        entry.system?.classe,
        entry.system?.tags,
        entry.flags?.add2e?.tags
      ].flatMap(value => Array.isArray(value) ? value : [value]).map(normalize);
      return tags.some(value => value === "clerc" || value.includes("classe:clerc") || value.includes("clerc"));
    });

    const values = cleric
      ? [cleric.system?.niveau, cleric.system?.level, cleric.system?.details?.niveau, cleric.system?.details?.level]
      : [actorDoc?.system?.niveau, actorDoc?.system?.level, actorDoc?.system?.details?.niveau, actorDoc?.system?.details?.level];

    for (const value of values) {
      const level = Number(value);
      if (Number.isFinite(level) && level > 0) return Math.floor(level);
    }
    return 1;
  };

  const tokenBounds = tokenDoc => {
    const object = tokenDoc?.object ?? tokenDoc;
    const gridSize = Number(globalThis.canvas?.grid?.size) || 100;
    const document = object?.document ?? tokenDoc?.document ?? tokenDoc ?? {};
    const x = Number(object?.x ?? document?.x ?? 0);
    const y = Number(object?.y ?? document?.y ?? 0);
    const width = Number(object?.w ?? (Number(document?.width ?? 1) * gridSize));
    const height = Number(object?.h ?? (Number(document?.height ?? 1) * gridSize));
    return { x, y, width, height };
  };

  const areInContact = (first, second) => {
    if (!first || !second) return false;
    if (first === second || first?.id === second?.id || first?.document?.id === second?.document?.id) return true;
    const a = tokenBounds(first);
    const b = tokenBounds(second);
    const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width));
    const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height));
    return gapX <= 1 && gapY <= 1;
  };

  const selectedTargets = Array.from(game.user?.targets ?? []);
  if (selectedTargets.length > 1) {
    ui.notifications?.warn?.("Résistance au froid : sélectionne une seule cible.");
    return false;
  }

  const targetToken = selectedTargets[0] ?? casterToken;
  const targetActor = targetToken?.actor ?? caster;
  if (!targetActor) {
    ui.notifications?.error?.("Résistance au froid : cible introuvable.");
    return false;
  }

  const selfCast = targetActor.id === caster.id;
  if (!selfCast) {
    if (!casterToken || !targetToken) {
      ui.notifications?.warn?.("Résistance au froid : le lanceur et la cible doivent être présents sur la scène pour vérifier le contact.");
      return false;
    }
    if (!areInContact(casterToken, targetToken)) {
      ui.notifications?.warn?.("Résistance au froid : la cible doit être au contact.");
      return false;
    }
  }

  const level = getClericLevel(caster);
  const rounds = level * 10;
  const timeEngine = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const duration = timeEngine?.durationData?.(rounds) ?? {
    rounds,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };

  const timeFlags = timeEngine?.flags?.({
    source: "resistance-au-froid.js",
    rounds,
    unit: "round",
    endMessage: "La résistance au froid de {actor} prend fin.",
    extra: {
      spellKey: CONFIG.slug,
      spellName: CONFIG.name,
      level,
      casterId: caster.id,
      casterUuid: caster.uuid,
      targetId: targetActor.id,
      targetUuid: targetActor.uuid,
      tags: CONFIG.tags
    }
  }) ?? {
    timeEngine: { managed: true, unit: "round", totalRounds: rounds },
    roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage: "La résistance au froid de {actor} prend fin." },
    endMessage: "La résistance au froid de {actor} prend fin.",
    spellKey: CONFIG.slug,
    spellName: CONFIG.name,
    level,
    casterId: caster.id,
    casterUuid: caster.uuid,
    targetId: targetActor.id,
    targetUuid: targetActor.uuid
  };

  const existingIds = [...(targetActor.effects ?? [])]
    .filter(effect => {
      if (effect.disabled) return false;
      const tags = effect.flags?.add2e?.tags ?? effect.getFlag?.("add2e", "tags") ?? [];
      return Array.isArray(tags) && tags.map(normalize).includes(`sort:${CONFIG.slug}`);
    })
    .map(effect => effect.id)
    .filter(Boolean);

  const useDirectDocumentUpdate = game.user?.isGM || targetActor.isOwner;
  if (existingIds.length) {
    if (useDirectDocumentUpdate) {
      await targetActor.deleteEmbeddedDocuments("ActiveEffect", existingIds);
    } else if (game.socket) {
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
    } else {
      ui.notifications?.error?.("Résistance au froid : socket indisponible, effet existant non remplaçable.");
      return false;
    }
  }

  const effectData = {
    name: CONFIG.name,
    img: sourceItem.img ?? "icons/magic/defensive/shield-barrier-glowing-blue.webp",
    origin: sourceItem.uuid ?? null,
    disabled: false,
    transfer: false,
    changes: [],
    duration,
    description: `Résistance au froid de ${caster.name}. Durée : ${level} tour(s).`,
    flags: {
      add2e: {
        ...timeFlags,
        tags: CONFIG.tags,
        sourceSpell: sourceItem.name ?? CONFIG.name,
        sourceSpellId: sourceItem.id ?? null,
        sourceSpellKey: CONFIG.slug,
        casterId: caster.id,
        casterUuid: caster.uuid,
        effectType: "cold_resistance",
        durationTours: level,
        naturalColdLimit: CONFIG.naturalColdLimit,
        saveBonusVsCold: 3,
        failedSaveMultiplier: 0.5,
        successfulSaveMultiplier: 0.25
      }
    }
  };

  if (useDirectDocumentUpdate) {
    try {
      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    } catch (_error) {
      ui.notifications?.error?.("Résistance au froid : impossible de créer l'effet.");
      return false;
    }
  } else if (game.socket) {
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
    ui.notifications?.error?.("Résistance au froid : socket indisponible.");
    return false;
  }

  const targetLabel = targetToken?.name ?? targetActor.name;
  const card = `
    <div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,#fffaf0,#fff7df);border:1.5px solid #e2bc63;overflow:hidden;padding:0;font-family:var(--font-primary);">
      <div style="background:linear-gradient(90deg,#6f4b12,#b88924);padding:8px 12px;color:#fff;display:flex;align-items:center;gap:10px;border-bottom:2px solid #8a611d;">
        <img src="${escapeHtml(casterToken?.document?.texture?.src ?? caster.img ?? "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
        <div style="line-height:1.2;flex:1;">
          <div style="font-weight:bold;font-size:1.05em;">${escapeHtml(caster.name)}</div>
          <div style="font-size:.85em;opacity:.95;">lance <b>${escapeHtml(sourceItem.name ?? CONFIG.name)}</b></div>
        </div>
        <div style="text-align:right;font-size:.78em;opacity:.95;">Sort divin</div>
        <img src="${escapeHtml(sourceItem.img ?? "icons/magic/defensive/shield-barrier-glowing-blue.webp")}" style="width:32px;height:32px;border-radius:4px;background:#fff;object-fit:cover;">
      </div>
      <div style="padding:10px;color:#6f4b12;">
        <div style="margin-bottom:7px;font-size:.95em;"><b>Cible :</b> ${escapeHtml(targetLabel)}</div>
        <div style="text-align:center;border:1px solid #e2bc63;border-radius:7px;padding:8px;background:#fffdf7;">
          <b style="color:#2f6f9f;">RÉSISTANCE AU FROID</b>
          <div style="margin-top:4px;font-size:.9em;"><b>Durée :</b> ${level} tour(s) (${rounds} rounds) · <b>Portée :</b> toucher · <b>JS :</b> aucun</div>
        </div>
        <div style="margin-top:7px;padding:7px 8px;border-left:4px solid #2f6f9f;background:#eef7ff;border-radius:4px;font-size:.88em;line-height:1.35;">
          Froid naturel jusqu’à <b>${CONFIG.naturalColdLimit} °C</b>. Contre un froid magique ou plus intense : <b>+3</b> au jet de protection ; dégâts réduits de moitié si le jet échoue, au quart s’il réussit.
        </div>
        <details style="margin-top:8px;background:#fffdf5;border:1px solid #e2bc63;border-radius:6px;">
          <summary style="cursor:pointer;color:#6f4b12;font-weight:600;padding:6px;">Règle appliquée</summary>
          <div style="padding:8px;font-size:.85em;line-height:1.45;">Un effet temporaire unique est posé sur la cible. Le moteur d’effets lit ses tags pour résoudre les dégâts de froid entrants et retire automatiquement l’effet à la fin de la durée.</div>
        </details>
      </div>
    </div>`;

  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      content: card,
      ...chatStyle()
    });
  } catch (_error) {
    ui.notifications?.warn?.("Résistance au froid : effet appliqué, mais carte de chat indisponible.");
  }

  return true;
})();

return __add2eColdResistanceResult === true ? true : false;
