/**
 * ADD2E — Sort COMPRÉHENSION DES LANGUES.
 * Source canonique : Item sort du compendium ADD2E.
 * Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2 via l'API ADD2E commune.
 */

const ADD2E_COMPREHENSION_LANGUES_VERSION = "2026-08-12-canonical-spell-runtime-v3";
console.log("[ADD2E][COMPREHENSION_LANGUES][VERSION]", ADD2E_COMPREHENSION_LANGUES_VERSION);

return await (async () => {
  const spell = (typeof sort !== "undefined" && sort)
    ? sort
    : ((typeof item !== "undefined" && item?.type === "sort") ? item : null);

  if (!spell || String(spell.type ?? "").toLowerCase() !== "sort") {
    ui.notifications.error("Compréhension des langues : Item sort canonique introuvable.");
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : spell.parent;
  if (!caster) {
    ui.notifications.error("Compréhension des langues : lanceur introuvable.");
    return false;
  }

  const resolveCasterLevel = () => {
    if (spell.system?.isObjectPower === true) {
      const configured = Number(spell.system?.casterLevel);
      if (!Number.isInteger(configured) || configured < 1) {
        throw new Error("Compréhension des langues : casterLevel canonique absent du pouvoir d’objet magique.");
      }
      return configured;
    }

    if (typeof globalThis.add2eCanActorUseSpell !== "function") {
      throw new Error("Compréhension des langues : résolveur canonique d’accès aux sorts indisponible.");
    }
    const access = globalThis.add2eCanActorUseSpell(caster, spell);
    if (access?.ok !== true) {
      throw new Error(`Compréhension des langues : accès canonique au sort refusé (${access?.reason ?? "raison inconnue"}).`);
    }
    const level = Number(access.actorLevel);
    if (!Number.isInteger(level) || level < 1) {
      throw new Error("Compréhension des langues : niveau canonique du lanceur invalide.");
    }
    return level;
  };

  let casterLevel;
  try {
    casterLevel = resolveCasterLevel();
  } catch (error) {
    console.error("[ADD2E][COMPREHENSION_LANGUES][CASTER_LEVEL]", {
      actor: caster.name,
      spell: spell.name,
      error
    });
    ui.notifications.error(error.message);
    return false;
  }

  if (typeof globalThis.add2eDialogWait !== "function") {
    ui.notifications.error("L’API de fenêtre ADD2E est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications.error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
    return false;
  }

  const durationRounds = casterLevel * 5;
  const info = spell.system ?? {};
  const configuredEffects = Array.from(spell.effects ?? []);
  if (!configuredEffects.length) {
    ui.notifications.error("Compréhension des langues : ActiveEffect canonique absent de l’Item sort.");
    return false;
  }

  const choice = await globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-comprehension-langues-window"],
    window: { title: spell.name ?? "Compréhension des langues" },
    content: `
      <div class="add2e-comprehension-langues-content" style="display:grid;gap:.7em;min-width:420px;">
        <p style="margin:0;">Le sort permet de lire un texte autrement incompréhensible ou de comprendre les paroles d’une créature touchée.</p>
        <div class="form-group">
          <label for="add2e-comprehension-langues-note">Texte, langue ou créature concerné(e)</label>
          <input id="add2e-comprehension-langues-note" name="note" type="text" autocomplete="off" placeholder="Optionnel">
        </div>
        <p class="a2e-muted" style="margin:0;">Durée : ${durationRounds} rounds (${casterLevel} × 5).</p>
      </div>`,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "<i class='fas fa-hat-wizard'></i>",
        default: true,
        callback: (_event, button) => ({
          note: String(button?.form?.elements?.note?.value ?? "").trim()
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

  if (!choice) return false;

  const effects = configuredEffects.map(effect => {
    const data = foundry.utils.deepClone(effect.toObject());
    delete data._id;
    delete data._stats;
    delete data.folder;
    delete data.sort;
    data.name = String(data.name ?? spell.name ?? "Compréhension des langues");
    data.img = data.img || spell.img || "icons/svg/book.svg";
    data.origin = spell.uuid;
    data.disabled = false;
    data.transfer = false;
    data.duration = {
      ...(data.duration && typeof data.duration === "object" ? data.duration : {}),
      rounds: durationRounds,
      startRound: game.combat?.round ?? null,
      startTurn: game.combat?.turn ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    };
    data.description = String(info.description ?? data.description ?? "");
    data.flags ??= {};
    data.flags.add2e ??= {};
    data.flags.add2e = {
      ...data.flags.add2e,
      sourceSpellId: spell.id,
      sourceSpellUuid: spell.uuid,
      casterLevel,
      durationRounds,
      ...(choice.note ? { comprehensionTarget: choice.note } : {})
    };
    return data;
  });

  if (game.user?.isGM || caster.isOwner) {
    await caster.createEmbeddedDocuments("ActiveEffect", effects);
  } else if (game.socket) {
    for (const effectData of effects) {
      game.socket.emit("system.add2e", {
        type: "ADD2E_GM_OPERATION",
        operation: "createActiveEffect",
        payload: {
          actorId: caster.id,
          actorUuid: caster.uuid,
          sceneId: canvas.scene?.id,
          tokenId: (typeof token !== "undefined" ? token?.id : null) ?? null,
          effectData
        }
      });
    }
  } else {
    ui.notifications.error("Compréhension des langues : relais MJ ADD2E indisponible pour appliquer l’effet.");
    return false;
  }

  const card = {
    actor: caster,
    title: spell.name ?? "Compréhension des langues",
    icon: "fas fa-language",
    variant: "spell",
    source: {
      name: caster.name,
      img: caster.img,
      type: `Magicien niveau ${casterLevel}`
    },
    rows: [
      { label: "Portée", value: String(info.portee ?? "au toucher") },
      { label: "Durée", value: `${durationRounds} rounds` },
      { label: "Cible", value: choice.note || String(info.zone_effet ?? info.cible ?? "Texte ou créature touchée") },
      { label: "Jet de sauvegarde", value: String(info.jet_sauvegarde ?? "aucun") }
    ],
    message: "Le lanceur peut comprendre le texte ou les paroles concernés pendant la durée du sort.",
    trustedBodyHtml: String(info.description ?? ""),
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      flags: {
        add2e: {
          spell: "comprehension_des_langues",
          casterLevel,
          durationRounds,
          sourceItemUuid: spell.uuid,
          targetNote: choice.note || "",
          version: ADD2E_COMPREHENSION_LANGUES_VERSION
        }
      }
    }
  };

  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) {
    throw new Error("Compréhension des langues : carte ADD2E vide.");
  }
  await globalThis.add2eCreateChatCard(card);
  return true;
})();
