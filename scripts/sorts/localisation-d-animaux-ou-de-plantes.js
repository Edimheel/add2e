// ADD2E — Localisation d’Animaux ou de Plantes
// Clerc niveau 1 — runtime spécialisé.
// Compatible Foundry V13/V14/V15 — fenêtres et cartes via les APIs communes ADD2E.
// Contrat onUse : true = sort consommé ; false = sort non consommé.

const __add2eAnimalPlantLocationResult = await (async () => {
  const VERSION = "2026-09-17-canonical-animal-plant-location-v1";
  const NAME = "Localisation d’Animaux ou de Plantes";
  const ICON = "systems/add2e/assets/icones/sorts/localisation-d-animaux-ou-de-plantes.webp";
  const RULE = "Permet au clerc de ressentir la direction vers un type précis d’animal ou de plante dans la portée du sort.";
  const TAGS = [
    "sort:localisation_animaux_plantes",
    "detection:animal",
    "detection:plante",
    "localisation"
  ];

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
    add2eClasses: ["add2e-animal-plant-location-dialog"],
    window: { title: `Lancement : ${sourceItem.name ?? NAME}` },
    content: `
      <form class="add2e-animal-plant-location-form">
        <div class="form-group">
          <label>Animal ou plante recherché</label>
          <div class="form-fields">
            <input type="text" name="typeRecherche" value="type précis">
          </div>
        </div>
        <p class="hint">${RULE}</p>
      </form>`,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "<i class='fas fa-location-dot'></i>",
        default: true,
        callback: (_event, button) => ({
          typeRecherche: String(button?.form?.elements?.typeRecherche?.value ?? "type précis").trim() || "type précis"
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
  if (!selection) return false;

  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const rounds = time?.toRounds?.("level", "round", { level }) ?? level;
  const duration = time?.durationData?.(rounds) ?? {
    rounds,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };
  const endMessage = "La localisation d’animaux ou de plantes de {actor} prend fin.";
  const timeFlags = time?.flags?.({
    source: "localisation-d-animaux-ou-de-plantes.js",
    rounds,
    unit: "round",
    endMessage,
    extra: {
      spellName: sourceItem.name ?? NAME,
      spellKey: "localisation_animaux_plantes",
      sourceItemUuid: sourceItem.uuid ?? null,
      casterId: caster.id ?? null,
      casterUuid: caster.uuid ?? null,
      casterLevel: level,
      detectionOptions: { typeRecherche: selection.typeRecherche },
      tags: TAGS
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
    name: sourceItem.name ?? NAME,
    img: sourceItem.img || ICON,
    origin: sourceItem.uuid ?? null,
    disabled: false,
    transfer: false,
    duration,
    description: RULE,
    flags: {
      add2e: {
        ...timeFlags,
        spellName: sourceItem.name ?? NAME,
        spellKey: "localisation_animaux_plantes",
        sourceItemUuid: sourceItem.uuid ?? null,
        casterId: caster.id ?? null,
        casterUuid: caster.uuid ?? null,
        casterLevel: level,
        detectionOptions: { typeRecherche: selection.typeRecherche },
        tags: [...new Set(TAGS.map(normalizeTag).filter(Boolean))],
        version: VERSION
      }
    },
    changes: []
  };

  if (game.user?.isGM || caster.isOwner) {
    await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);
  } else {
    if (!game.socket?.emit) {
      ui.notifications?.error?.(`${NAME} : relais MJ indisponible pour appliquer l’effet.`);
      return false;
    }
    game.socket.emit("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation: "createActiveEffect",
      payload: {
        actorUuid: caster.uuid,
        actorId: caster.id,
        effectData,
        fromUserId: game.user?.id ?? null,
        sentAt: Date.now()
      }
    });
  }

  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster.id)
    ? token
    : canvas.tokens?.controlled?.find(candidate => candidate?.actor?.id === caster.id)
      ?? caster.getActiveTokens?.()[0]
      ?? null;
  try {
    await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX?.(casterToken ?? caster, "detection");
  } catch (error) {
    console.warn("[ADD2E][LOCALISATION_ANIMAUX_PLANTES][VFX]", error);
  }

  const card = {
    actor: caster,
    title: sourceItem.name ?? NAME,
    icon: "fas fa-location-dot",
    variant: "spell",
    source: {
      name: caster.name,
      img: sourceItem.img || caster.img,
      type: "Sort divin",
      meta: `Niveau de lanceur ${level}`
    },
    rows: [
      { label: "Type recherché", value: selection.typeRecherche },
      { label: "Durée", value: `${rounds} rounds` },
      { label: "Résultat", value: "Direction annoncée par le MJ selon la scène" }
    ],
    message: `Le lanceur recherche « ${selection.typeRecherche} ». Le MJ indique la direction éventuelle dans la portée du sort.`,
    trustedBodyHtml: `<p>${RULE}</p>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: {
        add2e: {
          chatCardType: "animal-plant-location",
          version: VERSION,
          sourceItemUuid: sourceItem.uuid ?? null,
          casterLevel: level,
          durationRounds: rounds,
          typeRecherche: selection.typeRecherche
        }
      }
    }
  };
  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error(`${NAME} : carte ADD2E vide.`);
  await globalThis.add2eCreateChatCard(card);
  return true;
})();

return __add2eAnimalPlantLocationResult === true ? true : false;
