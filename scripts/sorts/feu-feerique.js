// ADD2E — Feu Féerique
// Compatible Foundry V13/V14/V15.
// Contrat onUse : true = sort consommé ; false = sort non consommé.

const __add2eFaerieFireResult = await (async () => {
  const VERSION = "2026-09-16-canonical-faerie-fire-v1";
  const CONFIG = Object.freeze({
    name: "Feu Féerique",
    slug: "feu-feerique",
    rangeMeters: 24,
    durationFormula: "level*4",
    icon: "systems/add2e/assets/icones/sorts/feu-feerique.webp",
    tags: [
      "sort:feu_feerique",
      "etat:revele",
      "bonus_touche_recu:2",
      "anti:invisibilite",
      "lumiere:faible"
    ],
    rule: "Entoure les cibles d’une lueur pâle qui les rend visibles et plus faciles à frapper. L’effet ne blesse pas et ne gêne pas la vision."
  });

  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

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
    ui.notifications?.error?.("Feu Féerique : sort introuvable.");
    return false;
  }

  const caster = typeof actor !== "undefined" && actor ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications?.error?.("Feu Féerique : lanceur introuvable.");
    return false;
  }

  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("Feu Féerique : l’API de fenêtre ADD2E est indisponible.");
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Feu Féerique : les constructeurs communs de cartes ADD2E sont indisponibles.");
  }

  const resolveCasterLevel = () => {
    if (sourceItem.system?.isObjectPower === true) {
      const explicit = Number(sourceItem.system?.casterLevel);
      if (!Number.isInteger(explicit) || explicit < 1) {
        throw new Error("Feu Féerique : niveau de lanceur explicite absent du pouvoir d’objet magique.");
      }
      return explicit;
    }

    const resolver = globalThis.add2eCanActorUseSpell;
    if (typeof resolver !== "function") {
      throw new Error("Feu Féerique : le résolveur canonique de lancement des sorts est indisponible.");
    }
    const access = resolver(caster, sourceItem);
    const level = Number(access?.actorLevel);
    if (access?.ok !== true || !Number.isInteger(level) || level < 1) {
      throw new Error(`Feu Féerique : niveau canonique du lanceur indisponible${access?.reason ? ` (${access.reason})` : ""}.`);
    }
    return level;
  };

  const unitToMeters = value => {
    const unit = String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (["m", "metre", "metres", "meter", "meters"].includes(unit)) return 1;
    if (["ft", "foot", "feet", "pied", "pieds", "pi"].includes(unit)) return 0.3048;
    if (["yd", "yard", "yards", "verge", "verges"].includes(unit)) return 0.9144;
    if (["km", "kilometre", "kilometres", "kilometer", "kilometers"].includes(unit)) return 1000;
    throw new Error(`Feu Féerique : unité de grille Foundry non supportée (${String(value ?? "vide")}).`);
  };

  const distanceMeters = (tokenA, tokenB) => {
    if (!tokenA || !tokenB) return null;
    const gridDistance = Number(canvas.scene?.grid?.distance);
    if (!(gridDistance > 0)) throw new Error("Feu Féerique : distance de grille Foundry invalide.");
    const metersPerSceneUnit = unitToMeters(canvas.scene?.grid?.units);

    if (typeof canvas.grid?.measurePath === "function") {
      const measured = canvas.grid.measurePath([
        { x: tokenA.center.x, y: tokenA.center.y },
        { x: tokenB.center.x, y: tokenB.center.y }
      ]);
      const sceneDistance = Number(measured?.distance)
        || Number(measured?.cost)
        || Number(measured?.segments?.[0]?.distance)
        || 0;
      if (sceneDistance > 0) return sceneDistance * metersPerSceneUnit;
    }

    const gridSize = Number(canvas.grid?.size ?? canvas.scene?.grid?.size);
    if (!(gridSize > 0)) throw new Error("Feu Féerique : taille de grille Foundry invalide.");
    const pixels = Math.hypot(tokenA.center.x - tokenB.center.x, tokenA.center.y - tokenB.center.y);
    return (pixels / gridSize) * gridDistance * metersPerSceneUnit;
  };

  const casterToken = canvas.tokens?.controlled?.find(tokenDoc => tokenDoc?.actor?.id === caster.id)
    ?? (typeof token !== "undefined" && token?.actor?.id === caster.id ? token : null)
    ?? caster.getActiveTokens?.()[0]
    ?? null;

  const targets = Array.from(game.user?.targets ?? []).filter(targetToken => targetToken?.actor);
  if (!targets.length) {
    ui.notifications?.warn?.("Feu Féerique : cible au moins une créature.");
    return false;
  }

  if (casterToken) {
    const outOfRange = targets.filter(targetToken => {
      const distance = distanceMeters(casterToken, targetToken);
      return Number.isFinite(distance) && distance > CONFIG.rangeMeters + 1e-6;
    });
    if (outOfRange.length) {
      ui.notifications?.warn?.(`Feu Féerique : cible hors de portée (${outOfRange.map(targetToken => targetToken.name).join(", ")}).`);
      return false;
    }
  }

  const confirmed = await globalThis.add2eDialogWait({
    add2eTheme: "druid",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-faerie-fire-dialog"],
    window: { title: `Lancement : ${sourceItem.name ?? CONFIG.name}` },
    content: `
      <form class="add2e-faerie-fire-form">
        <p><b>Cibles :</b> ${targets.map(targetToken => escapeHtml(targetToken.name)).join(", ")}</p>
        <p><b>Portée :</b> ${CONFIG.rangeMeters} m</p>
        <p>${escapeHtml(CONFIG.rule)}</p>
      </form>`,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "<i class='fas fa-wand-magic-sparkles'></i>",
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

  const level = resolveCasterLevel();
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const rounds = time?.toRounds?.(CONFIG.durationFormula, "round", { level }) ?? (level * 4);
  const duration = time?.durationData?.(rounds) ?? {
    rounds,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };
  const timeFlags = time?.flags?.({
    source: "feu-feerique.js",
    rounds,
    unit: "round",
    endMessage: "Le Feu Féerique entourant {actor} prend fin.",
    extra: {
      spellName: sourceItem.name ?? CONFIG.name,
      spellKey: "feu_feerique",
      sourceItemUuid: sourceItem.uuid ?? null,
      casterId: caster.id,
      casterUuid: caster.uuid,
      tags: CONFIG.tags
    }
  }) ?? {};

  const createEffect = async targetToken => {
    const targetActor = targetToken.actor;
    const effectData = {
      name: CONFIG.name,
      img: sourceItem.img || CONFIG.icon,
      icon: sourceItem.img || CONFIG.icon,
      origin: sourceItem.uuid ?? null,
      disabled: false,
      transfer: false,
      duration,
      description: sourceItem.system?.description || CONFIG.rule,
      flags: {
        add2e: {
          ...timeFlags,
          tags: CONFIG.tags,
          spellName: sourceItem.name ?? CONFIG.name,
          sourceItemUuid: sourceItem.uuid ?? null,
          casterId: caster.id,
          casterUuid: caster.uuid,
          targetId: targetActor.id,
          targetUuid: targetActor.uuid,
          durationRounds: rounds,
          version: VERSION
        }
      },
      changes: []
    };

    if (game.user?.isGM || targetActor.isOwner) {
      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return true;
    }
    if (!game.socket) return false;
    game.socket.emit("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation: "createActiveEffect",
      payload: {
        actorId: targetActor.id,
        actorUuid: targetActor.uuid,
        sceneId: canvas.scene?.id ?? null,
        tokenId: targetToken.id,
        effectData,
        fromUserId: game.user?.id ?? null
      }
    });
    return true;
  };

  const playVfx = async targetToken => {
    try {
      await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX?.(targetToken, "bless");
      if (!targetToken?.center || !canvas?.ready) return;
      if (typeof canvas.ping === "function") {
        canvas.ping(targetToken.center, { style: "pulse", color: "#b88924", size: 96, duration: 700 });
      } else if (typeof canvas.controls?.ping === "function") {
        canvas.controls.ping(targetToken.center, { style: "pulse", color: "#b88924", size: 96, duration: 700 });
      }
      canvas.interface?.createScrollingText?.(targetToken.center, "✦", {
        anchor: CONST.TEXT_ANCHOR_POINTS?.CENTER ?? 0,
        direction: CONST.TEXT_ANCHOR_POINTS?.TOP ?? 1,
        distance: 0.8,
        fontSize: 28,
        fill: "#f5d37a",
        stroke: "#3a2608",
        strokeThickness: 4,
        duration: 900
      });
    } catch (error) {
      console.warn("[ADD2E][FEU_FEERIQUE][VFX]", error);
    }
  };

  const applied = [];
  const failed = [];
  for (const targetToken of targets) {
    try {
      const ok = await createEffect(targetToken);
      if (!ok) {
        failed.push(targetToken.name);
        continue;
      }
      applied.push(targetToken.name);
      await playVfx(targetToken);
    } catch (error) {
      console.error("[ADD2E][FEU_FEERIQUE][EFFECT]", { target: targetToken.name, error });
      failed.push(targetToken.name);
    }
  }

  if (!applied.length) {
    ui.notifications?.error?.("Feu Féerique : aucun effet n’a pu être appliqué.");
    return false;
  }

  const options = {
    actor: caster,
    title: sourceItem.name ?? CONFIG.name,
    icon: "fas fa-sparkles",
    variant: "spell",
    source: {
      name: caster.name,
      img: sourceItem.img || caster.img,
      type: "Sort divin",
      meta: `Niveau de lanceur ${level}`
    },
    rows: [
      { label: "Portée", value: `${CONFIG.rangeMeters} m` },
      { label: "Durée", value: `${rounds} round(s)` },
      { label: "Cibles affectées", value: applied.length },
      { label: "Bonus au toucher reçu", value: "+2" }
    ],
    message: `${applied.join(", ")} ${applied.length > 1 ? "sont entourés" : "est entouré"} d’une lueur féerique.`,
    trustedBodyHtml: `
      <div class="add2e-faerie-fire-results">
        <p><b>Affectés :</b> ${applied.map(escapeHtml).join(", ")}</p>
        ${failed.length ? `<p><b>Non appliqués :</b> ${failed.map(escapeHtml).join(", ")}</p>` : ""}
        <details>
          <summary>Règle appliquée</summary>
          <div style="padding-top:6px;">${sourceItem.system?.description || escapeHtml(CONFIG.rule)}</div>
        </details>
      </div>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: {
        add2e: {
          chatCardType: "faerie-fire",
          sourceItemUuid: sourceItem.uuid ?? null,
          casterLevel: level,
          durationRounds: rounds,
          rangeMeters: CONFIG.rangeMeters,
          affectedTargets: targets.filter(targetToken => applied.includes(targetToken.name)).map(targetToken => targetToken.actor?.uuid).filter(Boolean),
          version: VERSION
        }
      }
    }
  };

  const preview = globalThis.add2eBuildChatCard(options);
  if (!String(preview ?? "").trim()) throw new Error("Feu Féerique : carte ADD2E vide.");
  await globalThis.add2eCreateChatCard(options);
  return true;
})();

return __add2eFaerieFireResult === true ? true : false;