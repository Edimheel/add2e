// ADD2E — Enchevêtrement
// Clerc niveau 1 — runtime spécialisé.
// Compatible Foundry V13/V14/V15 — sauvegardes, fenêtres et cartes via les APIs communes ADD2E.
// Contrat onUse : true = sort consommé ; false = sort non consommé.

const __add2eEntangleResult = await (async () => {
  const VERSION = "2026-09-17-canonical-entangle-v1";
  const NAME = "Enchevêtrement";
  const ICON = "systems/add2e/assets/icones/sorts/enchevetrement.webp";
  const RANGE_METERS = 24;
  const DURATION_ROUNDS = 10;
  const RULE = "Anime et épaissit la végétation d’une zone pour immobiliser les créatures présentes. Un jet réussi réduit l’effet à un fort ralentissement. Cible les tokens présents dans la zone avant le lancement.";
  const FULL = Object.freeze({
    name: "Enchevêtré / ralenti",
    tags: [
      "sort:enchevetrement",
      "etat:entrave",
      "controle:zone",
      "terrain:vegetation",
      "malus_deplacement:fort"
    ],
    description: RULE
  });
  const SAVED = Object.freeze({
    name: "Enchevêtrement — ralenti",
    tags: [
      "sort:enchevetrement",
      "etat:ralenti",
      "controle:zone",
      "terrain:vegetation",
      "malus_deplacement:leger"
    ],
    description: "Jet de protection réussi : la cible n'est pas immobilisée, mais la végétation gêne fortement son déplacement."
  });

  if (typeof globalThis.add2eDialogWait !== "function") {
    ui.notifications?.error?.(`${NAME} : l’API de fenêtre ADD2E est indisponible.`);
    return false;
  }
  if (typeof globalThis.add2eRollSavingThrow !== "function") {
    ui.notifications?.error?.(`${NAME} : l’exécuteur canonique de sauvegardes est indisponible.`);
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
  if (!targets.length) {
    ui.notifications?.warn?.(`${NAME} : cible au moins une créature.`);
    return false;
  }

  const unitToMeters = value => {
    const unit = String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (["m", "metre", "metres", "meter", "meters"].includes(unit)) return 1;
    if (["ft", "foot", "feet", "pied", "pieds", "pi"].includes(unit)) return 0.3048;
    if (["yd", "yard", "yards", "verge", "verges"].includes(unit)) return 0.9144;
    if (["km", "kilometre", "kilometres", "kilometer", "kilometers"].includes(unit)) return 1000;
    return 1;
  };

  const distanceMeters = (left, right) => {
    const gridDistance = Number(canvas.scene?.grid?.distance) || 1;
    const metersPerSceneUnit = unitToMeters(canvas.scene?.grid?.units);
    if (typeof canvas.grid?.measurePath === "function") {
      const measured = canvas.grid.measurePath([
        { x: left.center.x, y: left.center.y },
        { x: right.center.x, y: right.center.y }
      ]);
      const sceneDistance = Number(measured?.distance)
        || Number(measured?.cost)
        || Number(measured?.segments?.[0]?.distance)
        || 0;
      if (sceneDistance > 0) return sceneDistance * metersPerSceneUnit;
    }
    if (typeof canvas.grid?.measureDistances === "function" && typeof Ray !== "undefined") {
      const measured = canvas.grid.measureDistances([{ ray: new Ray(left.center, right.center) }], { gridSpaces: true })?.[0];
      if (Number.isFinite(Number(measured))) return Number(measured) * metersPerSceneUnit;
    }
    const gridSize = Number(canvas.grid?.size ?? canvas.scene?.grid?.size) || 100;
    return (Math.hypot(left.center.x - right.center.x, left.center.y - right.center.y) / gridSize) * gridDistance * metersPerSceneUnit;
  };

  const outOfRange = targets.filter(target => distanceMeters(casterToken, target) > RANGE_METERS + 1e-6);
  if (outOfRange.length) {
    ui.notifications?.warn?.(`${NAME} : cible hors de portée (${outOfRange.map(target => target.name).join(", ")}).`);
    return false;
  }

  const confirmed = await globalThis.add2eDialogWait({
    add2eTheme: "druid",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-entangle-dialog"],
    window: { title: `Lancement : ${sourceItem.name ?? NAME}` },
    content: `
      <form class="add2e-entangle-form">
        <p><b>Cibles :</b> ${targets.map(target => String(target.name ?? target.actor.name)).join(", ")}</p>
        <p><b>Portée :</b> ${RANGE_METERS} m</p>
        <p class="hint">${RULE}</p>
      </form>`,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "<i class='fas fa-seedling'></i>",
        default: true,
        callback: () => true
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "<i class='fas fa-times'></i>",
        callback: () => false
      }
    ],
    close: () => false
  });
  if (confirmed !== true) return false;

  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const duration = time?.durationData?.(DURATION_ROUNDS) ?? {
    rounds: DURATION_ROUNDS,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
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

  const createEffect = async (targetToken, mode, save) => {
    const targetActor = targetToken.actor;
    const endMessage = `L’effet d’Enchevêtrement affectant {actor} prend fin.`;
    const timeFlags = time?.flags?.({
      source: "enchevetrement.js",
      rounds: DURATION_ROUNDS,
      unit: "round",
      endMessage,
      extra: {
        spellName: sourceItem.name ?? NAME,
        spellKey: "enchevetrement",
        sourceItemUuid: sourceItem.uuid ?? null,
        casterId: caster.id ?? null,
        casterUuid: caster.uuid ?? null,
        targetId: targetActor.id ?? null,
        targetUuid: targetActor.uuid ?? null,
        saveSuccess: save?.success === true,
        tags: mode.tags
      }
    }) ?? {
      timeEngine: { managed: true, unit: "round", totalRounds: DURATION_ROUNDS },
      roundEngine: { managed: true, unit: "round", totalRounds: DURATION_ROUNDS, endMessage },
      endMessage
    };
    const effectData = {
      name: mode.name,
      img: sourceItem.img || ICON,
      origin: sourceItem.uuid ?? null,
      disabled: false,
      transfer: false,
      duration,
      description: mode.description,
      flags: {
        add2e: {
          ...timeFlags,
          spellName: sourceItem.name ?? NAME,
          spellKey: "enchevetrement",
          sourceItemUuid: sourceItem.uuid ?? null,
          casterId: caster.id ?? null,
          casterUuid: caster.uuid ?? null,
          targetId: targetActor.id ?? null,
          targetUuid: targetActor.uuid ?? null,
          saveSuccess: save?.success === true,
          tags: [...new Set(mode.tags.map(normalizeTag).filter(Boolean))],
          version: VERSION
        }
      },
      changes: []
    };

    if (game.user?.isGM || targetActor.isOwner) {
      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return true;
    }
    if (!game.socket?.emit) return false;
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
    return true;
  };

  const results = [];
  for (const targetToken of targets) {
    const save = await globalThis.add2eRollSavingThrow(targetToken.actor, "sorts", {
      source: "spell:enchevetrement",
      sourceItem,
      caster,
      targetToken,
      createChat: false,
      showDice: true
    });
    if (!save?.ok) {
      ui.notifications?.error?.(`${NAME} : sauvegarde indisponible pour ${targetToken.name ?? targetToken.actor.name}.`);
      return false;
    }
    const mode = save.success === true ? SAVED : FULL;
    const applied = await createEffect(targetToken, mode, save);
    if (!applied) {
      ui.notifications?.error?.(`${NAME} : impossible d’appliquer l’effet à ${targetToken.name ?? targetToken.actor.name}.`);
      return false;
    }
    results.push({ targetToken, save, mode });
    try {
      await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX?.(targetToken, "bless");
    } catch (_error) {}
  }

  const card = {
    actor: caster,
    title: sourceItem.name ?? NAME,
    icon: "fas fa-seedling",
    variant: "spell",
    source: {
      name: caster.name,
      img: sourceItem.img || caster.img,
      type: "Sort divin"
    },
    target: {
      name: targets.map(target => target.name ?? target.actor.name).join(", "),
      img: targets.length === 1 ? targets[0].actor?.img : null,
      type: "Créatures dans la zone"
    },
    rows: [
      { label: "Portée", value: `${RANGE_METERS} m` },
      { label: "Durée", value: `${DURATION_ROUNDS} rounds` },
      ...results.map(({ targetToken, save }) => ({
        label: targetToken.name ?? targetToken.actor.name,
        value: save.success ? "JP réussi — ralenti" : "JP raté — entravé"
      }))
    ],
    message: "Un jet de protection réussi réduit l’effet à un ralentissement ; un échec applique l’entrave complète.",
    trustedBodyHtml: `<p>${RULE}</p>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls: results.map(result => result.save?.roll).filter(Boolean),
      flags: {
        add2e: {
          chatCardType: "entangle",
          version: VERSION,
          sourceItemUuid: sourceItem.uuid ?? null,
          durationRounds: DURATION_ROUNDS,
          rangeMeters: RANGE_METERS,
          targets: results.map(({ targetToken, save }) => ({
            actorUuid: targetToken.actor?.uuid ?? null,
            tokenId: targetToken.id ?? null,
            saveSuccess: save.success === true,
            saveTotal: save.total ?? null,
            saveTarget: save.target ?? null
          }))
        }
      }
    }
  };
  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error(`${NAME} : carte ADD2E vide.`);
  await globalThis.add2eCreateChatCard(card);
  return true;
})();

return __add2eEntangleResult === true ? true : false;
