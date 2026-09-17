// ADD2E — Amitié avec les Animaux
// Clerc niveau 1 — runtime spécialisé.
// Compatible Foundry V13/V14/V15 — fenêtres et cartes via les APIs communes ADD2E.
// Contrat onUse : true = sort consommé ; false = sort non consommé.

const __add2eAnimalFriendshipResult = await (async () => {
  const VERSION = "2026-09-17-canonical-animal-friendship-v1";
  const NAME = "Amitié avec les Animaux";
  const TAGS = [
    "sort:amitie_avec_les_animaux",
    "etat:animal_amical",
    "controle:animal",
    "relation:animal",
    "cible:animal"
  ];
  const RULE = "Permet au clerc de gagner la confiance d’un animal normal si ses intentions sont réellement amicales. L’animal devient calme et peut suivre le clerc tant qu’il est bien traité.";
  const ICON = "systems/add2e/assets/icones/sorts/amitie-avec-les-animaux.webp";

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

  const targets = Array.from(game.user?.targets ?? []).filter(target => target?.actor);
  if (targets.length !== 1) {
    ui.notifications?.warn?.(`${NAME} : cible exactement une créature.`);
    return false;
  }
  const targetToken = targets[0];
  const targetActor = targetToken.actor;

  const confirmation = await globalThis.add2eDialogWait({
    add2eTheme: "druid",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-animal-friendship-dialog"],
    window: { title: `Lancement : ${sourceItem.name ?? NAME}` },
    content: `
      <form class="add2e-animal-friendship-form">
        <p><b>Cible :</b> ${String(targetToken.name ?? targetActor.name ?? "Créature")}</p>
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
        icon: "<i class='fas fa-paw'></i>",
        default: true,
        callback: (_event, button) => ({
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
  if (!confirmation?.touchConfirmed) return false;

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
    name: "Amitié animale",
    img: sourceItem.img || ICON,
    origin: sourceItem.uuid ?? null,
    disabled: false,
    transfer: false,
    duration: {},
    description: RULE,
    flags: {
      add2e: {
        spellName: sourceItem.name ?? NAME,
        sourceItemUuid: sourceItem.uuid ?? null,
        casterId: caster.id ?? null,
        casterUuid: caster.uuid ?? null,
        targetId: targetActor.id ?? null,
        targetUuid: targetActor.uuid ?? null,
        tags: [...new Set(TAGS.map(normalizeTag).filter(Boolean))],
        version: VERSION
      }
    },
    changes: []
  };

  if (game.user?.isGM || targetActor.isOwner) {
    await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  } else {
    if (!game.socket?.emit) {
      ui.notifications?.error?.(`${NAME} : relais MJ indisponible pour appliquer l’effet.`);
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
    if (targetToken?.center && canvas?.ready) {
      if (typeof canvas.ping === "function") {
        canvas.ping(targetToken.center, { style: "pulse", size: 96, duration: 700 });
      } else if (typeof canvas.controls?.ping === "function") {
        canvas.controls.ping(targetToken.center, { style: "pulse", size: 96, duration: 700 });
      }
    }
  } catch (error) {
    console.warn("[ADD2E][AMITIE_ANIMAUX][VFX]", error);
  }

  const card = {
    actor: caster,
    title: sourceItem.name ?? NAME,
    icon: "fas fa-paw",
    variant: "spell",
    source: {
      name: caster.name,
      img: sourceItem.img || caster.img,
      type: "Sort divin"
    },
    target: {
      name: targetToken.name ?? targetActor.name,
      img: targetActor.img,
      type: "Créature ciblée"
    },
    rows: [
      { label: "Effet", value: "Amitié animale" },
      { label: "Durée", value: "Spéciale / jusqu’à suppression" },
      { label: "Validation", value: "Intentions réellement amicales : décision du MJ" }
    ],
    message: `${targetToken.name ?? targetActor.name} reçoit l’effet d’Amitié animale.`,
    trustedBodyHtml: `<p>${RULE}</p>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      flags: {
        add2e: {
          chatCardType: "animal-friendship",
          version: VERSION,
          sourceItemUuid: sourceItem.uuid ?? null,
          targetActorUuid: targetActor.uuid ?? null
        }
      }
    }
  };

  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error(`${NAME} : carte ADD2E vide.`);
  await globalThis.add2eCreateChatCard(card);
  return true;
})();

return __add2eAnimalFriendshipResult === true ? true : false;
