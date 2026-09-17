// ADD2E — Passage sans Traces
// Clerc niveau 1 — runtime spécialisé.
// Compatible Foundry V13/V14/V15.
// Contrat onUse : true = sort consommé ; false = sort non consommé.

const __add2ePassWithoutTraceResult = await (async () => {
  const VERSION = "2026-09-17-canonical-pass-without-trace-v2";
  const NAME = "Passage sans Traces";
  const ICON = "systems/add2e/assets/icones/sorts/passage-sans-traces.webp";
  const TAGS = Object.freeze([
    "sort:passage_sans_traces",
    "furtivite:aucune_trace",
    "deplacement",
    "anti:pistage"
  ]);
  const RULE = "Permet à la cible de se déplacer sans laisser d’empreintes, d’odeur ou de piste normalement exploitable.";

  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error(`${NAME} : l’API de fenêtre ADD2E est indisponible.`);
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error(`${NAME} : les constructeurs communs de cartes ADD2E sont indisponibles.`);
  }

  const effectsEngine = globalThis.ADD2E_EFFECTS;
  if (!effectsEngine || typeof effectsEngine.normalizeTag !== "function") {
    throw new Error(`${NAME} : le moteur canonique ADD2E est indisponible.`);
  }

  const sourceItem = (typeof sort !== "undefined" && sort)
    || (typeof item !== "undefined" && item)
    || (typeof spell !== "undefined" && spell)
    || (typeof args !== "undefined" && args?.[0]?.item)
    || (typeof this !== "undefined" && this?.documentName === "Item" ? this : null)
    || null;
  if (!sourceItem) {
    ui.notifications.error(`${NAME} : sort introuvable.`);
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications.error(`${NAME} : lanceur introuvable.`);
    return false;
  }

  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster.id)
    ? token
    : canvas.tokens?.controlled?.find(candidate => candidate?.actor?.id === caster.id)
      ?? caster.getActiveTokens?.()[0]
      ?? null;

  const targets = Array.from(game.user?.targets ?? []).filter(target => target?.actor);
  if (targets.length !== 1) {
    ui.notifications.warn(`${NAME} : cible exactement une créature.`);
    return false;
  }
  const targetToken = targets[0];

  function tokensAtContact(left, right) {
    if (!left || !right || left.id === right.id) return true;
    const gridSize = Number(canvas.dimensions?.size ?? canvas.grid?.size) || 100;
    const leftX = Number(left.document?.x) / gridSize;
    const leftY = Number(left.document?.y) / gridSize;
    const leftRight = leftX + (Number(left.document?.width) || 1);
    const leftBottom = leftY + (Number(left.document?.height) || 1);
    const rightX = Number(right.document?.x) / gridSize;
    const rightY = Number(right.document?.y) / gridSize;
    const rightRight = rightX + (Number(right.document?.width) || 1);
    const rightBottom = rightY + (Number(right.document?.height) || 1);
    const gapX = Math.max(0, rightX - leftRight, leftX - rightRight);
    const gapY = Math.max(0, rightY - leftBottom, leftY - rightBottom);
    return gapX <= 0.01 && gapY <= 0.01;
  }

  if (casterToken && !tokensAtContact(casterToken, targetToken)) {
    ui.notifications.warn(`${NAME} : la cible doit être au toucher.`);
    return false;
  }

  function casterLevel() {
    if (sourceItem?.system?.isObjectPower === true) {
      const explicit = Number(sourceItem.system?.casterLevel);
      if (!Number.isInteger(explicit) || explicit < 1) {
        throw new Error(`${NAME} : niveau de lanceur explicite absent du pouvoir d’objet magique.`);
      }
      return explicit;
    }
    if (typeof globalThis.add2eCanActorUseSpell !== "function") {
      throw new Error(`${NAME} : le résolveur canonique de lancement des sorts est indisponible.`);
    }
    const access = globalThis.add2eCanActorUseSpell(caster, sourceItem);
    const level = Number(access?.actorLevel);
    if (access?.ok !== true || !Number.isInteger(level) || level < 1) {
      throw new Error(`${NAME} : niveau canonique du lanceur indisponible${access?.reason ? ` (${access.reason})` : ""}.`);
    }
    return level;
  }

  const confirmed = await globalThis.add2eDialogWait({
    add2eTheme: "druid",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-pass-without-trace-dialog"],
    window: { title: `Lancement : ${sourceItem.name ?? NAME}` },
    content: `
      <form class="add2e-pass-without-trace-form">
        <p><b>Cible :</b> ${String(targetToken.name ?? targetToken.actor?.name ?? "Créature")}</p>
        <label style="display:flex;gap:6px;align-items:center;">
          <input type="checkbox" name="touchConfirmed" checked>
          Contact réussi ou cible consentante.
        </label>
        <p class="hint">${RULE}</p>
      </form>`,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "<i class='fas fa-shoe-prints'></i>",
        default: true,
        callback: (_event, button) => ({
          touchConfirmed: button.form?.elements?.touchConfirmed?.checked === true
        })
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "<i class='fas fa-times'></i>",
        callback: () => null
      }
    ],
    close: () => null
  });
  if (!confirmed?.touchConfirmed) return false;

  const level = casterLevel();
  const rounds = Math.max(1, level) * 10;
  const tags = [...new Set(TAGS.map(tag => effectsEngine.normalizeTag(tag)).filter(Boolean))];
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const endMessage = `L’effet de ${NAME} affectant {actor} prend fin.`;
  const timeFlags = time?.flags?.({
    source: "passage-sans-traces.js",
    rounds,
    unit: "round",
    endMessage,
    extra: {
      spellName: sourceItem.name ?? NAME,
      spellKey: "passage_sans_traces",
      sourceItemUuid: sourceItem.uuid ?? null,
      casterId: caster.id ?? null,
      casterUuid: caster.uuid ?? null,
      targetId: targetToken.actor.id ?? null,
      targetUuid: targetToken.actor.uuid ?? null,
      tags,
      version: VERSION
    }
  }) ?? {
    timeEngine: { managed: true, unit: "round", totalRounds: rounds },
    roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage },
    endMessage,
    spellName: sourceItem.name ?? NAME,
    spellKey: "passage_sans_traces",
    sourceItemUuid: sourceItem.uuid ?? null,
    casterId: caster.id ?? null,
    casterUuid: caster.uuid ?? null,
    targetId: targetToken.actor.id ?? null,
    targetUuid: targetToken.actor.uuid ?? null,
    tags,
    version: VERSION
  };
  const duration = time?.durationData?.(rounds) ?? {
    rounds,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };

  const effectData = {
    name: NAME,
    img: sourceItem.img || ICON,
    icon: sourceItem.img || ICON,
    origin: sourceItem.uuid ?? null,
    disabled: false,
    transfer: false,
    duration,
    description: RULE,
    flags: {
      add2e: {
        ...timeFlags,
        tags,
        effectTags: tags
      }
    },
    changes: []
  };

  const targetActor = targetToken.actor;
  let applied = false;
  if (game.user?.isGM || targetActor.isOwner) {
    await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    applied = true;
  } else if (game.socket?.emit) {
    game.socket.emit("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation: "createActiveEffect",
      payload: {
        actorUuid: targetActor.uuid,
        actorId: targetActor.id,
        sceneId: canvas.scene?.id ?? null,
        tokenId: targetToken.id ?? null,
        effectData,
        fromUserId: game.user?.id ?? null,
        sentAt: Date.now()
      }
    });
    applied = true;
  }
  if (!applied) {
    ui.notifications.error(`${NAME} : impossible d’appliquer l’effet à ${targetActor.name}.`);
    return false;
  }

  try {
    await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX?.(targetToken, "divine");
  } catch (error) {
    console.warn("[ADD2E][PASSAGE_SANS_TRACES][VFX_IGNORED]", error);
  }

  const card = {
    actor: caster,
    title: sourceItem.name ?? NAME,
    icon: "fas fa-shoe-prints",
    variant: "spell",
    source: {
      name: caster.name,
      img: caster.img,
      type: "Sort divin"
    },
    target: {
      name: targetToken.name ?? targetActor.name,
      img: targetActor.img,
      type: "Créature touchée"
    },
    rows: [
      { label: "Durée", value: `${rounds} round(s)` },
      { label: "Effet", value: "Aucune trace normalement exploitable" }
    ],
    trustedBodyHtml: `<p>${RULE}</p>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: {
        add2e: {
          chatCardType: "pass-without-trace",
          sourceItemUuid: sourceItem.uuid ?? null,
          targetActorUuid: targetActor.uuid ?? null,
          durationRounds: rounds,
          version: VERSION
        }
      }
    }
  };
  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error(`${NAME} : carte ADD2E vide.`);
  await globalThis.add2eCreateChatCard(card);
  return true;
})();

return __add2ePassWithoutTraceResult === true ? true : false;
