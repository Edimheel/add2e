/**
 * ADD2E — Invisibilité aux Morts-Vivants
 * Clerc niveau 1
 * Version : 2026-09-17-shared-chat-card-v2
 *
 * Contrat onUse : true = consommé ; false = non consommé.
 */

console.log("%c[ADD2E][INVIS_MV] 2026-09-17-shared-chat-card-v2", "color:#b88924;font-weight:bold;");

const __add2eOnUseResult = await (async () => {
  function sourceItemFromContext() {
    if (typeof sort !== "undefined" && sort) return sort;
    if (typeof item !== "undefined" && item) return item;
    if (typeof this !== "undefined" && this?.documentName === "Item") return this;
    if (typeof spell !== "undefined" && spell) return spell;
    if (typeof args !== "undefined" && args?.[0]?.item) return args[0].item;
    return null;
  }

  function casterFromContext(sourceItem) {
    return (typeof actor !== "undefined" && actor) ? actor : sourceItem?.parent;
  }

  function casterTokenFor(caster) {
    return canvas.tokens?.controlled?.[0]
      ?? ((typeof token !== "undefined" && token) ? token : null)
      ?? caster?.getActiveTokens?.()[0]
      ?? null;
  }

  function tokensAuContact(a, b) {
    if (!a || !b || a.id === b.id) return true;
    try {
      const gridSize = canvas.grid?.size || 100;
      const aLeft = a.document.x / gridSize;
      const aTop = a.document.y / gridSize;
      const aRight = aLeft + (a.document.width || 1);
      const aBottom = aTop + (a.document.height || 1);
      const bLeft = b.document.x / gridSize;
      const bTop = b.document.y / gridSize;
      const bRight = bLeft + (b.document.width || 1);
      const bBottom = bTop + (b.document.height || 1);
      const gapX = Math.max(0, bLeft - aRight, aLeft - bRight);
      const gapY = Math.max(0, bTop - aBottom, aTop - bBottom);
      return gapX <= 0.01 && gapY <= 0.01;
    } catch (_err) {
      return false;
    }
  }

  function durationData(rounds) {
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    return time?.durationData?.(rounds) ?? {
      rounds,
      startRound: game.combat?.round ?? null,
      startTurn: game.combat?.turn ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    };
  }

  function timeFlags({ sourceItem, caster, targetActor, rounds }) {
    const tags = [
      "sort:invisibilite_aux_morts_vivants",
      "invisibilite:morts_vivants",
      "condition:morts_vivants",
      "cible:creature_touchee"
    ];
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    return time?.flags?.({
      source: "invisibilite-aux-morts-vivants.js",
      rounds,
      unit: "round",
      endMessage: "L’invisibilité aux morts-vivants de {actor} prend fin.",
      extra: {
        spellName: "Invisibilité aux Morts-Vivants",
        spellKey: "invisibilite_aux_morts_vivants",
        sourceItemUuid: sourceItem?.uuid ?? null,
        casterId: caster?.id ?? null,
        casterUuid: caster?.uuid ?? null,
        targetId: targetActor?.id ?? null,
        targetUuid: targetActor?.uuid ?? null,
        tags
      }
    }) ?? {
      timeEngine: { managed: true, unit: "round", totalRounds: rounds },
      roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage: "L’invisibilité aux morts-vivants de {actor} prend fin." },
      endMessage: "L’invisibilité aux morts-vivants de {actor} prend fin.",
      spellName: "Invisibilité aux Morts-Vivants",
      spellKey: "invisibilite_aux_morts_vivants",
      sourceItemUuid: sourceItem?.uuid ?? null,
      casterId: caster?.id ?? null,
      casterUuid: caster?.uuid ?? null,
      targetId: targetActor?.id ?? null,
      targetUuid: targetActor?.uuid ?? null,
      tags
    };
  }

  function effectData({ sourceItem, caster, targetActor }) {
    const rounds = 6;
    const tags = [
      "sort:invisibilite_aux_morts_vivants",
      "invisibilite:morts_vivants",
      "condition:morts_vivants",
      "cible:creature_touchee"
    ];

    return {
      name: "Invisibilité aux Morts-Vivants",
      img: sourceItem?.img || "systems/add2e/assets/icones/sorts/invisibilite-aux-morts-vivants.webp",
      origin: sourceItem?.uuid ?? null,
      disabled: false,
      transfer: false,
      duration: durationData(rounds),
      description: "La cible devient indétectable aux morts-vivants d’esprit faible. Durée : 6 rounds.",
      flags: {
        add2e: {
          ...timeFlags({ sourceItem, caster, targetActor, rounds }),
          tags
        }
      },
      changes: []
    };
  }

  function emitGmOperation(operation, payload) {
    if (!game.socket) return false;
    game.socket.emit("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation,
      payload: { ...(payload ?? {}), fromUserId: game.user.id, sentAt: Date.now() }
    });
    return true;
  }

  async function applyEffect(targetActor, data) {
    if (!targetActor) return false;

    if (game.user.isGM || targetActor.isOwner) {
      const oldIds = Array.from(targetActor.effects ?? [])
        .filter(e => (e.flags?.add2e?.tags ?? []).includes("sort:invisibilite_aux_morts_vivants"))
        .map(e => e.id)
        .filter(Boolean);
      if (oldIds.length) await targetActor.deleteEmbeddedDocuments("ActiveEffect", oldIds);
      await targetActor.createEmbeddedDocuments("ActiveEffect", [data]);
      return true;
    }

    const emitted = emitGmOperation("createActiveEffect", {
      actorUuid: targetActor.uuid,
      actorId: targetActor.id,
      effectData: data
    });

    if (!emitted) {
      ui.notifications.error("Invisibilité aux morts-vivants : socket indisponible, impossible de demander l’effet au MJ.");
      return false;
    }

    return true;
  }

  async function createChat({ caster, sourceItem, targetToken }) {
    if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
      throw new Error("Invisibilité aux morts-vivants : les constructeurs communs de cartes ADD2E sont indisponibles.");
    }
    const options = {
      actor: caster,
      title: sourceItem?.name ?? "Invisibilité aux Morts-Vivants",
      icon: "fas fa-eye-slash",
      variant: "spell",
      source: {
        name: caster?.name ?? "Lanceur",
        img: sourceItem?.img || caster?.img,
        type: "Sort divin"
      },
      target: {
        name: targetToken?.name ?? targetToken?.actor?.name ?? "Cible",
        img: targetToken?.actor?.img,
        type: "Créature touchée"
      },
      rows: [
        { label: "Durée", value: "6 rounds" },
        { label: "Effet", value: "Indétectable aux morts-vivants d’esprit faible" }
      ],
      message: `${targetToken?.name ?? targetToken?.actor?.name ?? "La cible"} devient indétectable aux morts-vivants d’esprit faible tant que l’effet persiste.`,
      trustedBodyHtml: "<p>Les morts-vivants plus puissants peuvent bénéficier d’un jet de protection lors de l’interaction.</p>",
      chatData: {
        speaker: ChatMessage.getSpeaker({ actor: caster, token: targetToken }),
        flags: {
          add2e: {
            chatCardType: "undead-invisibility",
            sourceItemUuid: sourceItem?.uuid ?? null,
            targetActorUuid: targetToken?.actor?.uuid ?? null,
            durationRounds: 6,
            version: "2026-09-17-shared-chat-card-v2"
          }
        }
      }
    };
    const preview = globalThis.add2eBuildChatCard(options);
    if (!String(preview ?? "").trim()) throw new Error("Invisibilité aux morts-vivants : carte ADD2E vide.");
    return globalThis.add2eCreateChatCard(options);
  }

  const sourceItem = sourceItemFromContext();
  if (!sourceItem) {
    ui.notifications.error("Invisibilité aux morts-vivants : sort introuvable.");
    return false;
  }

  const caster = casterFromContext(sourceItem);
  if (!caster) {
    ui.notifications.error("Invisibilité aux morts-vivants : lanceur introuvable.");
    return false;
  }

  const casterToken = casterTokenFor(caster);
  if (!casterToken) {
    ui.notifications.warn("Invisibilité aux morts-vivants : sélectionne le token du lanceur.");
    return false;
  }

  const targets = Array.from(game.user.targets ?? []);
  if (targets.length !== 1 || !targets[0]?.actor) {
    ui.notifications.warn("Invisibilité aux morts-vivants : cible exactement une créature touchée.");
    return false;
  }

  const targetToken = targets[0];
  if (!tokensAuContact(casterToken, targetToken)) {
    ui.notifications.warn("Invisibilité aux morts-vivants : la cible doit être au toucher.");
    return false;
  }

  const data = effectData({ sourceItem, caster, targetActor: targetToken.actor });
  const ok = await applyEffect(targetToken.actor, data);
  if (!ok) return false;

  try {
    await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX?.(targetToken, "divine");
    await globalThis.ADD2E_PLAY_SPELL_FX?.("invisibilite_aux_morts_vivants", { casterToken, targetToken });
  } catch (err) {
    console.warn("[ADD2E][INVIS_MV][VFX][IGNORED]", err);
  }

  await createChat({ caster, sourceItem, targetToken });

  console.log("[ADD2E][invisibilite-aux-morts-vivants.js][ONUSE_RESULT]", true);
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT] Le script onUse doit retourner true ou false.", { script: "invisibilite-aux-morts-vivants.js", result: __add2eOnUseResult });
  ui.notifications?.error?.("Invisibilité aux morts-vivants : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
