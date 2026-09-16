// ADD2E — ESP (Lecture de pensées)
// Compatible Foundry V13/V14/V15.
// Contrat onUse : true = sort consommé ; false = sort non consommé.

const __add2eEspResult = await (async () => {
  const VERSION = "2026-09-16-canonical-esp-v1";
  const SPELL_KEY = "esp";

  const sourceItem = typeof item !== "undefined" && item
    ? item
    : typeof sort !== "undefined" && sort
      ? sort
      : typeof spell !== "undefined" && spell
        ? spell
        : typeof args !== "undefined" && args?.[0]?.item
          ? args[0].item
          : typeof this !== "undefined" && this?.documentName === "Item"
            ? this
            : null;
  if (!sourceItem?.system) {
    ui.notifications?.error?.("ESP : sort introuvable.");
    return false;
  }

  const caster = typeof actor !== "undefined" && actor ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications?.error?.("ESP : lanceur introuvable.");
    return false;
  }

  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("ESP : les constructeurs communs de cartes ADD2E sont indisponibles.");
  }

  const resolveCasterLevel = () => {
    if (sourceItem.system?.isObjectPower === true) {
      const explicit = Number(sourceItem.system?.casterLevel);
      if (!Number.isInteger(explicit) || explicit < 1) {
        throw new Error("ESP : niveau de lanceur explicite absent du pouvoir d’objet magique.");
      }
      return explicit;
    }

    const resolver = globalThis.add2eCanActorUseSpell;
    if (typeof resolver !== "function") {
      throw new Error("ESP : le résolveur canonique de lancement des sorts est indisponible.");
    }
    const access = resolver(caster, sourceItem);
    const level = Number(access?.actorLevel);
    if (access?.ok !== true || !Number.isInteger(level) || level < 1) {
      throw new Error(`ESP : niveau canonique du lanceur indisponible${access?.reason ? ` (${access.reason})` : ""}.`);
    }
    return level;
  };

  const level = resolveCasterLevel();
  const rangeMeters = Math.min(27, 1.5 * level);
  const rounds = level;
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const duration = time?.durationData?.(rounds) ?? {
    rounds,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };
  const timeFlags = time?.flags?.({
    source: "esp.js",
    rounds,
    unit: "round",
    endMessage: "La concentration ESP de {actor} prend fin.",
    extra: {
      spellName: sourceItem.name ?? "ESP",
      spellKey: SPELL_KEY,
      sourceItemUuid: sourceItem.uuid ?? null,
      casterId: caster.id,
      casterUuid: caster.uuid,
      tags: ["sort:esp", "divination", "lecture_pensee", "concentration"]
    }
  }) ?? {};

  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster.id ? token : null)
    ?? (canvas?.tokens?.controlled ?? []).find(tokenDoc => tokenDoc?.actor?.id === caster.id)
    ?? caster.getActiveTokens?.()[0]
    ?? null;

  game.add2e ??= {};
  if (game.add2e.espHookVersion !== VERSION) {
    game.add2e.espHookVersion = VERSION;
    const cleanup = effect => {
      const payload = effect?.flags?.add2e?.espPayload;
      if (!payload?.sequencerId || typeof Sequencer === "undefined") return;
      try {
        Sequencer.EffectManager.endEffects({ name: payload.sequencerId });
      } catch (error) {
        console.warn("[ADD2E][ESP][VFX_CLEANUP]", error);
      }
    };
    Hooks.on("deleteActiveEffect", cleanup);
    Hooks.on("updateActiveEffect", (effect, changes) => {
      if (changes?.disabled === true) cleanup(effect);
    });
  }

  const sequencerId = `ESP-Aura-${caster.id}-${Date.now()}`;
  if (typeof Sequence !== "undefined" && casterToken) {
    try {
      await new Sequence()
        .effect()
        .file("modules/JB2A_DnD5e/Library/Generic/Energy/Shimmer01_01_Regular_Blue_400x400.webm")
        .attachTo(casterToken)
        .scaleToObject(1.5)
        .persist()
        .name(sequencerId)
        .fadeIn(500)
        .fadeOut(500)
        .play();
    } catch (error) {
      console.warn("[ADD2E][ESP][VFX]", error);
    }
  }

  const effectData = {
    name: "ESP (Lecture de pensées)",
    img: sourceItem.img || "systems/add2e/assets/icones/sorts/esp.webp",
    icon: sourceItem.img || "systems/add2e/assets/icones/sorts/esp.webp",
    origin: sourceItem.uuid ?? null,
    disabled: false,
    transfer: false,
    duration,
    description: "Peut sonder les pensées de surface d’une créature par round. Bloqué par le plomb.",
    flags: {
      add2e: {
        ...timeFlags,
        tags: ["sort:esp", "divination", "lecture_pensee", "concentration"],
        sourceItemUuid: sourceItem.uuid ?? null,
        casterId: caster.id,
        casterUuid: caster.uuid,
        casterLevel: level,
        rangeMeters,
        durationRounds: rounds,
        espPayload: { sequencerId },
        version: VERSION
      }
    },
    changes: []
  };

  if (game.user?.isGM || caster.isOwner) {
    await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);
  } else if (game.socket) {
    game.socket.emit("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation: "createActiveEffect",
      payload: {
        actorId: caster.id,
        actorUuid: caster.uuid,
        sceneId: canvas.scene?.id ?? null,
        tokenId: casterToken?.id ?? null,
        effectData,
        fromUserId: game.user?.id ?? null
      }
    });
  } else {
    ui.notifications?.error?.("ESP : relais MJ indisponible pour appliquer l’effet.");
    return false;
  }

  const incantationRaw = sourceItem.system?.temps_incantation;
  const incantation = incantationRaw && typeof incantationRaw === "object"
    ? `${incantationRaw.valeur ?? incantationRaw.value ?? "—"}${incantationRaw.unite ? ` ${incantationRaw.unite}` : ""}`
    : String(incantationRaw ?? "—");

  const options = {
    actor: caster,
    title: sourceItem.name || "ESP",
    icon: "fas fa-brain",
    variant: "spell",
    source: {
      name: caster.name,
      img: sourceItem.img || caster.img,
      type: "Divination",
      meta: `Niveau de lanceur ${level}`
    },
    rows: [
      { label: "Portée", value: `${rangeMeters} m` },
      { label: "Durée", value: `${rounds} round(s)` },
      { label: "Lecture", value: "1 créature / round" },
      { label: "Incantation", value: incantation }
    ],
    message: `${caster.name} se concentre pour sonder les pensées de surface à portée.`,
    trustedBodyHtml: `
      <div class="add2e-esp-results">
        <p><b>ESP actif.</b> Le plomb bloque la lecture des pensées.</p>
        <details>
          <summary>Détails du sort</summary>
          <div style="padding-top:6px;">${sourceItem.system?.description || "<em>Aucune description.</em>"}</div>
        </details>
      </div>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: {
        add2e: {
          chatCardType: "esp",
          sourceItemUuid: sourceItem.uuid ?? null,
          casterLevel: level,
          rangeMeters,
          durationRounds: rounds,
          version: VERSION
        }
      }
    }
  };

  const preview = globalThis.add2eBuildChatCard(options);
  if (!String(preview ?? "").trim()) throw new Error("ESP : carte ADD2E vide.");
  await globalThis.add2eCreateChatCard(options);
  return true;
})();

return __add2eEspResult === true ? true : false;