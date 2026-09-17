// ADD2E — Endurance de la Chaleur / Endurance du Froid
// Clerc niveau 1 — runtime spécialisé.
// Compatible Foundry V13/V14/V15 — fenêtres et cartes via les APIs communes ADD2E.
// Contrat onUse : true = sort consommé ; false = sort non consommé.

const __add2eTemperatureEnduranceResult = await (async () => {
  const VERSION = "2026-09-17-canonical-temperature-endurance-v1";
  const NAME = "Endurance de la Chaleur/Endurance du Froid";
  const ICON = "systems/add2e/assets/icones/sorts/endurance-de-la-chaleur-endurance-du-froid.webp";
  const RULE = "Protège une créature contre les températures extrêmes naturelles et réduit les effets de froid ou chaleur magiques selon la version choisie.";
  const MODES = Object.freeze({
    froid: Object.freeze({
      key: "froid",
      label: "Endurance du Froid",
      effectName: "Endurance du Froid",
      tags: [
        "sort:endurance_chaleur_froid",
        "protection:froid",
        "resistance:froid:100",
        "bonus_save_vs:froid:2",
        "protection:temperature"
      ]
    }),
    chaleur: Object.freeze({
      key: "chaleur",
      label: "Endurance de la Chaleur",
      effectName: "Endurance de la Chaleur",
      tags: [
        "sort:endurance_chaleur_froid",
        "protection:chaleur",
        "resistance:chaleur:100",
        "bonus_save_vs:chaleur:2",
        "protection:temperature"
      ]
    })
  });

  if (typeof globalThis.add2eDialogWait !== "function") {
    ui.notifications?.error?.(`${NAME} : l’API de fenêtre ADD2E est indisponible.`);
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications?.error?.(`${NAME} : les constructeurs communs de cartes ADD2E sont indisponibles.`);
    return false;
  }

  const sourceItem = (typeof sort !== "undefined" && sort)
    || (typeof item !== "undefined" && item)
    || (typeof spell !== "undefined" && spell)
    || (typeof args !== "undefined" && args?.[0]?.item)
    || (typeof this !== "undefined" && this?.documentName === "Item" ? this : null)
    || null;
  if (!sourceItem) {
    ui.notifications?.error?.(`${NAME} : sort introuvable.`);
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications?.error?.(`${NAME} : lanceur introuvable.`);
    return false;
  }

  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster.id)
    ? token
    : canvas.tokens?.controlled?.find(candidate => candidate?.actor?.id === caster.id)
      ?? caster.getActiveTokens?.()[0]
      ?? null;
  if (!casterToken) {
    ui.notifications?.warn?.(`${NAME} : sélectionne le token du lanceur.`);
    return false;
  }

  const targets = Array.from(game.user?.targets ?? []).filter(target => target?.actor);
  if (targets.length !== 1) {
    ui.notifications?.warn?.(`${NAME} : cible exactement une créature.`);
    return false;
  }
  const targetToken = targets[0];
  const targetActor = targetToken.actor;

  const tokensAtTouch = (left, right) => {
    if (!left || !right || left.id === right.id) return true;
    const gridSize = Number(canvas.grid?.size ?? canvas.scene?.grid?.size ?? 100) || 100;
    const leftDoc = left.document ?? left;
    const rightDoc = right.document ?? right;
    const leftBounds = {
      x1: Number(leftDoc.x ?? 0) / gridSize,
      y1: Number(leftDoc.y ?? 0) / gridSize,
      x2: Number(leftDoc.x ?? 0) / gridSize + Number(leftDoc.width ?? 1),
      y2: Number(leftDoc.y ?? 0) / gridSize + Number(leftDoc.height ?? 1)
    };
    const rightBounds = {
      x1: Number(rightDoc.x ?? 0) / gridSize,
      y1: Number(rightDoc.y ?? 0) / gridSize,
      x2: Number(rightDoc.x ?? 0) / gridSize + Number(rightDoc.width ?? 1),
      y2: Number(rightDoc.y ?? 0) / gridSize + Number(rightDoc.height ?? 1)
    };
    return Math.max(0, rightBounds.x1 - leftBounds.x2, leftBounds.x1 - rightBounds.x2) <= 0.01
      && Math.max(0, rightBounds.y1 - leftBounds.y2, leftBounds.y1 - rightBounds.y2) <= 0.01;
  };

  if (!tokensAtTouch(casterToken, targetToken)) {
    ui.notifications?.warn?.(`${NAME} : la cible doit être au toucher.`);
    return false;
  }

  const resolveCasterLevel = () => {
    if (sourceItem.system?.isObjectPower === true) {
      const explicit = Number(sourceItem.system?.casterLevel);
      if (!Number.isInteger(explicit) || explicit < 1) {
        throw new Error(`${NAME} : niveau de lanceur explicite absent du pouvoir d’objet magique.`);
      }
      return explicit;
    }
    const resolver = globalThis.add2eCanActorUseSpell;
    if (typeof resolver !== "function") {
      throw new Error(`${NAME} : le résolveur canonique de lancement des sorts est indisponible.`);
    }
    const access = resolver(caster, sourceItem);
    const level = Number(access?.actorLevel);
    if (access?.ok !== true || !Number.isInteger(level) || level < 1) {
      throw new Error(`${NAME} : niveau canonique du lanceur indisponible${access?.reason ? ` (${access.reason})` : ""}.`);
    }
    return level;
  };

  let level;
  try {
    level = resolveCasterLevel();
  } catch (error) {
    ui.notifications?.error?.(error?.message ?? `${NAME} : niveau du lanceur indisponible.`);
    return false;
  }

  const selection = await globalThis.add2eDialogWait({
    add2eTheme: "druid",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-temperature-endurance-dialog"],
    window: { title: `Lancement : ${sourceItem.name ?? NAME}` },
    content: `
      <form class="add2e-temperature-endurance-form">
        <div class="form-group">
          <label>Version du sort</label>
          <div class="form-fields">
            <select name="mode">
              <option value="froid">Endurance du Froid</option>
              <option value="chaleur">Endurance de la Chaleur</option>
            </select>
          </div>
        </div>
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
        icon: "<i class='fas fa-temperature-half'></i>",
        default: true,
        callback: (_event, button) => ({
          mode: String(button?.form?.elements?.mode?.value ?? "froid"),
          touchConfirmed: !!button?.form?.elements?.touchConfirmed?.checked
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
  if (!selection?.touchConfirmed) return false;

  const mode = MODES[selection.mode] ?? MODES.froid;
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const rounds = time?.toRounds?.("level*10", "round", { level }) ?? level * 10;
  const duration = time?.durationData?.(rounds) ?? {
    rounds,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };
  const endMessage = `${mode.label} protégeant {actor} prend fin.`;
  const timeFlags = time?.flags?.({
    source: "endurance-de-la-chaleur-endurance-du-froid.js",
    rounds,
    unit: "round",
    endMessage,
    extra: {
      spellName: mode.label,
      spellKey: "endurance_chaleur_froid",
      mode: mode.key,
      sourceItemUuid: sourceItem.uuid ?? null,
      casterId: caster.id ?? null,
      casterUuid: caster.uuid ?? null,
      targetId: targetActor.id ?? null,
      targetUuid: targetActor.uuid ?? null,
      casterLevel: level,
      tags: mode.tags
    }
  }) ?? {
    timeEngine: { managed: true, unit: "round", totalRounds: rounds },
    roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage },
    endMessage
  };

  const normalizeTag = value => {
    const engine = globalThis.ADD2E_EFFECTS;
    if (typeof engine?.normalizeTag === "function") return engine.normalizeTag(value);
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/\s+/g, "_");
  };

  const effectData = {
    name: mode.effectName,
    img: sourceItem.img || ICON,
    origin: sourceItem.uuid ?? null,
    disabled: false,
    transfer: false,
    duration,
    description: RULE,
    flags: {
      add2e: {
        ...timeFlags,
        spellName: mode.label,
        spellKey: "endurance_chaleur_froid",
        mode: mode.key,
        sourceItemUuid: sourceItem.uuid ?? null,
        casterId: caster.id ?? null,
        casterUuid: caster.uuid ?? null,
        targetId: targetActor.id ?? null,
        targetUuid: targetActor.uuid ?? null,
        casterLevel: level,
        tags: [...new Set(mode.tags.map(normalizeTag).filter(Boolean))],
        version: VERSION
      }
    },
    changes: []
  };

  if (game.user?.isGM || targetActor.isOwner) {
    await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  } else {
    if (!game.socket?.emit) {
      ui.notifications?.error?.(`${mode.label} : relais MJ indisponible pour appliquer l’effet.`);
      return false;
    }
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
  }

  try {
    await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX?.(targetToken, "divine");
  } catch (error) {
    console.warn("[ADD2E][ENDURANCE_TEMPERATURE][VFX]", error);
  }

  const card = {
    actor: caster,
    title: mode.label,
    icon: mode.key === "froid" ? "fas fa-snowflake" : "fas fa-sun",
    variant: "spell",
    source: {
      name: caster.name,
      img: sourceItem.img || caster.img,
      type: "Sort divin",
      meta: `Niveau de lanceur ${level}`
    },
    target: {
      name: targetToken.name ?? targetActor.name,
      img: targetActor.img,
      type: "Créature touchée"
    },
    rows: [
      { label: "Version", value: mode.label },
      { label: "Durée", value: `${rounds} rounds` },
      { label: "Protection", value: mode.key === "froid" ? "Froid" : "Chaleur" }
    ],
    message: `${targetToken.name ?? targetActor.name} bénéficie de ${mode.label}.`,
    trustedBodyHtml: `<p>${RULE}</p>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: {
        add2e: {
          chatCardType: "temperature-endurance",
          version: VERSION,
          mode: mode.key,
          sourceItemUuid: sourceItem.uuid ?? null,
          targetActorUuid: targetActor.uuid ?? null,
          casterLevel: level,
          durationRounds: rounds
        }
      }
    }
  };
  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error(`${mode.label} : carte ADD2E vide.`);
  await globalThis.add2eCreateChatCard(card);
  return true;
})();

return __add2eTemperatureEnduranceResult === true ? true : false;
