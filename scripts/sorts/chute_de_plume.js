// ADD2E — Chute de plume
// Compatible Foundry V13/V14/V15.
// Contrat onUse : true = sort consommé ; false = sort non consommé.

const __add2eFeatherFallResult = await (async () => {
  const VERSION = "2026-09-16-canonical-feather-fall-v1";
  const SPELL_KEY = "chute_de_plume";

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
    ui.notifications?.warn?.("Chute de plume : sort introuvable.");
    return false;
  }

  const caster = typeof actor !== "undefined" && actor ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications?.warn?.("Chute de plume : lanceur introuvable.");
    return false;
  }

  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Chute de plume : les constructeurs communs de cartes ADD2E sont indisponibles.");
  }

  const resolveCasterLevel = () => {
    if (sourceItem.system?.isObjectPower === true) {
      const explicit = Number(sourceItem.system?.casterLevel);
      if (!Number.isInteger(explicit) || explicit < 1) {
        throw new Error("Chute de plume : niveau de lanceur explicite absent du pouvoir d’objet magique.");
      }
      return explicit;
    }

    const resolver = globalThis.add2eCanActorUseSpell;
    if (typeof resolver !== "function") {
      throw new Error("Chute de plume : le résolveur canonique de lancement des sorts est indisponible.");
    }
    const access = resolver(caster, sourceItem);
    const level = Number(access?.actorLevel);
    if (access?.ok !== true || !Number.isInteger(level) || level < 1) {
      throw new Error(`Chute de plume : niveau canonique du lanceur indisponible${access?.reason ? ` (${access.reason})` : ""}.`);
    }
    return level;
  };

  const level = resolveCasterLevel();
  const rounds = Math.max(1, level);
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const duration = time?.durationData?.(rounds) ?? {
    rounds,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };
  const timeFlags = time?.flags?.({
    source: "chute_de_plume.js",
    rounds,
    unit: "round",
    endMessage: "La chute ralentie de {actor} prend fin.",
    extra: {
      spellName: sourceItem.name ?? "Chute de plume",
      spellKey: SPELL_KEY,
      sourceItemUuid: sourceItem.uuid ?? null,
      casterId: caster.id,
      casterUuid: caster.uuid,
      tags: ["sort:chute_de_plume", "chute_plume", "immunite:degats_chute"]
    }
  }) ?? {};

  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster.id ? token : null)
    ?? caster.getActiveTokens?.()[0]
    ?? canvas?.tokens?.controlled?.find(tokenDoc => tokenDoc?.actor?.id === caster.id)
    ?? null;

  let targets = Array.from(game.user?.targets ?? []).filter(targetToken => targetToken?.actor);
  let appliedOnSelf = false;
  if (!targets.length) {
    if (!casterToken) {
      ui.notifications?.warn?.("Chute de plume : aucune cible et aucun token du lanceur trouvé.");
      return false;
    }
    targets = [casterToken];
    appliedOnSelf = true;
  }

  if (targets.length > level) {
    ui.notifications?.warn?.(`Chute de plume : ${targets.length} cibles, maximum conseillé ${level} (niveau ${level}).`);
  }

  game.add2e ??= {};
  game.add2e.featherFallDissipated ??= new Set();
  if (game.add2e.featherFallHookVersion !== VERSION) {
    game.add2e.featherFallHookVersion = VERSION;
    const postDissipateCard = async effect => {
      const payload = effect?.flags?.add2e?.featherPayload;
      if (!payload) return;
      const key = String(effect?.uuid ?? effect?.id ?? `${effect?.parent?.id ?? "actor"}:${payload.itemUuid ?? "spell"}`);
      if (game.add2e.featherFallDissipated.has(key)) return;
      game.add2e.featherFallDissipated.add(key);

      const parentActor = effect.parent ?? null;
      const options = {
        actor: parentActor,
        title: "Chute de plume — effet dissipé",
        icon: "fas fa-feather",
        variant: "time",
        source: {
          name: effect.name ?? "Chute de plume",
          img: effect.img ?? effect.icon ?? "icons/magic/air/wind-feather-falling-purple.webp",
          type: "Fin d’effet"
        },
        rows: [
          { label: "Créature", value: parentActor?.name ?? "Créature" },
          { label: "État", value: "La chute n’est plus ralentie" }
        ],
        message: `${parentActor?.name ?? "La créature"} n’est plus sous l’effet de Chute de plume.`,
        chatData: {
          speaker: ChatMessage.getSpeaker({ actor: parentActor ?? null }),
          flags: { add2e: { chatCardType: "feather-fall-end", version: VERSION } }
        }
      };
      const preview = globalThis.add2eBuildChatCard(options);
      if (!String(preview ?? "").trim()) return;
      await globalThis.add2eCreateChatCard(options);
    };

    Hooks.on("deleteActiveEffect", effect => {
      postDissipateCard(effect).catch(error => console.warn("[ADD2E][CHUTE_DE_PLUME][END_CARD]", error));
    });
    Hooks.on("updateActiveEffect", (effect, changes) => {
      if (changes?.disabled === true) {
        postDissipateCard(effect).catch(error => console.warn("[ADD2E][CHUTE_DE_PLUME][END_CARD]", error));
      }
    });
  }

  const deleteExistingByOrigin = async targetActor => {
    const ids = Array.from(targetActor?.effects ?? [])
      .filter(effect => effect?.origin === sourceItem.uuid)
      .map(effect => effect.id)
      .filter(Boolean);
    if (!ids.length) return true;

    if (game.user?.isGM || targetActor.isOwner) {
      await targetActor.deleteEmbeddedDocuments("ActiveEffect", ids);
      return true;
    }
    if (!game.socket) return false;
    game.socket.emit("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation: "deleteActiveEffects",
      payload: {
        actorId: targetActor.id,
        actorUuid: targetActor.uuid,
        effectIds: ids,
        fromUserId: game.user?.id ?? null
      }
    });
    return true;
  };

  const applyEffect = async targetToken => {
    const targetActor = targetToken.actor;
    const effectData = {
      name: "Chute de plume",
      img: sourceItem.img || "icons/magic/air/wind-feather-falling-purple.webp",
      icon: sourceItem.img || "icons/magic/air/wind-feather-falling-purple.webp",
      origin: sourceItem.uuid,
      disabled: false,
      transfer: false,
      duration,
      description: "Tombe lentement. Aucun dégât de chute.",
      changes: [],
      flags: {
        add2e: {
          ...timeFlags,
          tags: ["sort:chute_de_plume", "chute_plume", "immunite:degats_chute"],
          sourceItemUuid: sourceItem.uuid ?? null,
          casterId: caster.id,
          casterUuid: caster.uuid,
          casterLevel: level,
          durationRounds: rounds,
          featherPayload: {
            castBy: caster.id,
            castByName: caster.name,
            itemUuid: sourceItem.uuid
          },
          version: VERSION
        }
      }
    };

    if (!(await deleteExistingByOrigin(targetActor))) return false;
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
        tokenId: targetToken.id ?? null,
        effectData,
        fromUserId: game.user?.id ?? null
      }
    });
    return true;
  };

  const applied = [];
  const appliedUuids = [];
  for (const targetToken of targets) {
    if (!targetToken?.actor) continue;
    const ok = await applyEffect(targetToken);
    if (!ok) continue;
    applied.push(targetToken.name ?? targetToken.actor.name ?? "Cible");
    if (targetToken.actor.uuid) appliedUuids.push(targetToken.actor.uuid);

    if (game.modules.get("sequencer")?.active && typeof Sequence !== "undefined") {
      try {
        await new Sequence()
          .effect()
          .file("jb2a.feathers.01.purple")
          .atLocation(targetToken)
          .scaleToObject(1.2)
          .duration(3000)
          .fadeOut(500)
          .play();
      } catch (error) {
        console.warn("[ADD2E][CHUTE_DE_PLUME][VFX]", error);
      }
    }
  }

  if (!applied.length) {
    ui.notifications?.error?.("Chute de plume : aucun effet n’a pu être appliqué.");
    return false;
  }

  const formatField = value => {
    if (typeof globalThis.formatSortChamp === "function") return globalThis.formatSortChamp(value, level);
    if (value && typeof value === "object") {
      const raw = value.valeur ?? value.value ?? "—";
      return `${raw}${value.unite ? ` ${value.unite}` : ""}`;
    }
    return String(value ?? "—");
  };

  const options = {
    actor: caster,
    title: sourceItem.name ?? "Chute de plume",
    icon: "fas fa-feather",
    variant: "spell",
    source: {
      name: caster.name,
      img: sourceItem.img || caster.img,
      type: "Altération",
      meta: `Niveau de lanceur ${level}`
    },
    rows: [
      { label: "Durée", value: `${rounds} round(s)` },
      { label: "Cibles", value: `${applied.length} / ${level} conseillé` },
      { label: "Portée", value: formatField(sourceItem.system?.portee) },
      { label: "Incantation", value: formatField(sourceItem.system?.temps_incantation) }
    ],
    message: appliedOnSelf
      ? `${caster.name} ralentit sa propre chute.`
      : `${applied.join(", ")} ${applied.length > 1 ? "voient" : "voit"} leur chute ralentie.`,
    trustedBodyHtml: `
      <div class="add2e-feather-fall-results">
        <p><b>Protégés :</b> ${applied.join(", ")}</p>
        <p>Aucun dégât de chute tant que l’effet reste actif.</p>
        <details>
          <summary>Description</summary>
          <div style="padding-top:6px;">${sourceItem.system?.description || "<em>Aucune description.</em>"}</div>
        </details>
      </div>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: {
        add2e: {
          chatCardType: "feather-fall",
          sourceItemUuid: sourceItem.uuid ?? null,
          casterLevel: level,
          durationRounds: rounds,
          affectedActorUuids: appliedUuids,
          version: VERSION
        }
      }
    }
  };

  const preview = globalThis.add2eBuildChatCard(options);
  if (!String(preview ?? "").trim()) throw new Error("Chute de plume : carte ADD2E vide.");
  await globalThis.add2eCreateChatCard(options);
  return true;
})();

return __add2eFeatherFallResult === true ? true : false;