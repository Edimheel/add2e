// ADD2E — Sanctuaire (Clerc niveau 1)
// Compatible Foundry V13/V14/V15.
// Contrat onUse : true = sort consommé ; false = sort non consommé.

const __add2eSanctuaryResult = await (async () => {
  const VERSION = "2026-08-12-canonical-sanctuary-v4";
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

  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications?.error?.("Sanctuaire : les constructeurs communs de cartes ADD2E sont indisponibles.");
    return false;
  }

  const normalize = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const createCard = async options => {
    const preview = globalThis.add2eBuildChatCard(options);
    if (!String(preview ?? "").trim()) throw new Error("Sanctuaire : carte de chat vide.");
    return globalThis.add2eCreateChatCard(options);
  };

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
    const spellImg = effectFlags.sourceSpellImg ?? CONFIG.icon;
    const targetName = targetToken?.name ?? targetActor.name ?? "Cible";
    const saveText = save?.canRoll
      ? `${save.total} / ${save.threshold}${save.bonus ? ` (${save.bonus >= 0 ? "+" : ""}${save.bonus})` : ""}`
      : "indisponible";
    const conclusion = allowed
      ? `${attacker.name} réussit son jet de protection et peut attaquer ${targetName}.`
      : `${attacker.name} échoue à son jet de protection et doit ignorer ${targetName}.`;

    await createCard({
      actor: attacker,
      title: allowed ? "Sanctuaire franchi" : "Attaque bloquée par Sanctuaire",
      icon: "fas fa-shield-halved",
      variant: allowed ? "success" : "failure",
      source: {
        name: casterName,
        img: spellImg,
        type: "Sanctuaire",
        meta: `Protège ${targetName}`
      },
      target: {
        name: attacker.name,
        img: attacker.img,
        type: "Attaquant",
        meta: ""
      },
      rows: [
        { label: "Cible protégée", value: targetName },
        { label: "Jet de protection contre les sorts", value: saveText },
        { label: "Résultat", value: allowed ? "Attaque autorisée" : "Attaque annulée" }
      ],
      message: conclusion,
      chatData: {
        speaker: ChatMessage.getSpeaker({ actor: attacker, token: action.sourceToken ?? null }),
        flags: {
          add2e: {
            chatCardType: "sanctuary-gate",
            version: VERSION,
            allowed,
            attackerUuid: attacker.uuid,
            targetActorUuid: targetActor.uuid,
            saveTotal: save?.total ?? null,
            saveThreshold: save?.threshold ?? null,
            saveBonus: save?.bonus ?? 0
          }
        }
      }
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

  const resolveCasterLevel = () => {
    if (sourceItem.system?.isObjectPower === true) {
      const explicit = Number(sourceItem.system?.casterLevel);
      if (!Number.isInteger(explicit) || explicit < 1) {
        throw new Error("Sanctuaire : niveau de lanceur explicite absent du pouvoir d’objet magique.");
      }
      return explicit;
    }
    const resolver = globalThis.add2eCanActorUseSpell;
    if (typeof resolver !== "function") {
      throw new Error("Sanctuaire : le résolveur canonique de lancement des sorts est indisponible.");
    }
    const access = resolver(caster, sourceItem);
    const actorLevel = Number(access?.actorLevel);
    if (access?.ok !== true || !Number.isInteger(actorLevel) || actorLevel < 1) {
      throw new Error(`Sanctuaire : niveau canonique du lanceur indisponible${access?.reason ? ` (${access.reason})` : ""}.`);
    }
    return actorLevel;
  };

  const level = resolveCasterLevel();

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

  await createCard({
    actor: caster,
    title: sourceItem.name ?? CONFIG.name,
    icon: "fas fa-shield-halved",
    variant: "success",
    source: {
      name: caster.name,
      img: spellImg,
      type: "Sort divin",
      meta: `Niveau de lanceur ${level}`
    },
    target: {
      name: targetToken.name ?? targetActor.name,
      img: targetActor.img,
      type: "Cible protégée",
      meta: ""
    },
    rows: [
      { label: "Durée", value: `${rounds} rounds` },
      { label: "Portée", value: "Toucher" },
      { label: "Jet de protection", value: "Aucun au lancement" }
    ],
    message: "Toute créature qui tente d’attaquer la cible doit réussir un jet de protection contre les sorts. Le bénéficiaire ne peut accomplir aucune action offensive.",
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: {
        add2e: {
          chatCardType: "sanctuary-cast",
          version: VERSION,
          sourceItemUuid: sourceItem.uuid,
          casterLevel: level,
          targetActorUuid: targetActor.uuid,
          durationRounds: rounds
        }
      }
    }
  });

  return true;
})();

return __add2eSanctuaryResult === true ? true : false;