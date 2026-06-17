/**
 * ADD2E — Invisibilité aux Animaux
 * Clerc niveau 1
 * Version : 2026-06-02-invisibilite-animaux-time-engine-v1
 *
 * Contrat onUse : true = consommé ; false = non consommé.
 */

console.log("%c[ADD2E][INVIS_ANIMAUX] 2026-06-02-invisibilite-animaux-time-engine-v1", "color:#b88924;font-weight:bold;");

const __add2eOnUseResult = await (async () => {
  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function chatStyleData() {
    return CONST.CHAT_MESSAGE_STYLES
      ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
      : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
  }

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

  function getLevel(actorDoc) {
    const candidates = [
      actorDoc?.system?.niveau,
      actorDoc?.system?.level,
      actorDoc?.system?.details?.niveau,
      actorDoc?.system?.details?.level,
      actorDoc?.system?.details_classe?.niveau
    ];
    for (const raw of candidates) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 1;
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

  function roundDuration(level) {
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    return time?.toRounds?.("10+level", "round", { level }) ?? (10 + Math.max(1, Number(level) || 1));
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

  function timeFlags({ sourceItem, caster, targetActor, rounds, level }) {
    const tags = [
      "sort:invisibilite_aux_animaux",
      "invisibilite:animaux",
      "condition:animaux",
      "cible:creature_touchee"
    ];
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    return time?.flags?.({
      source: "invisibilite-aux-animaux.js",
      rounds,
      unit: "round",
      endMessage: "L’invisibilité aux animaux de {actor} prend fin.",
      extra: {
        spellName: "Invisibilité aux Animaux",
        spellKey: "invisibilite_aux_animaux",
        level,
        sourceItemUuid: sourceItem?.uuid ?? null,
        casterId: caster?.id ?? null,
        casterUuid: caster?.uuid ?? null,
        targetId: targetActor?.id ?? null,
        targetUuid: targetActor?.uuid ?? null,
        tags
      }
    }) ?? {
      timeEngine: { managed: true, unit: "round", totalRounds: rounds },
      roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage: "L’invisibilité aux animaux de {actor} prend fin." },
      endMessage: "L’invisibilité aux animaux de {actor} prend fin.",
      spellName: "Invisibilité aux Animaux",
      spellKey: "invisibilite_aux_animaux",
      level,
      sourceItemUuid: sourceItem?.uuid ?? null,
      casterId: caster?.id ?? null,
      casterUuid: caster?.uuid ?? null,
      targetId: targetActor?.id ?? null,
      targetUuid: targetActor?.uuid ?? null,
      tags
    };
  }

  function effectData({ sourceItem, caster, targetActor, level }) {
    const rounds = roundDuration(level);
    const tags = [
      "sort:invisibilite_aux_animaux",
      "invisibilite:animaux",
      "condition:animaux",
      "cible:creature_touchee"
    ];

    return {
      name: "Invisibilité aux Animaux",
      img: sourceItem?.img || "systems/add2e/assets/icones/sorts/invisibilite-aux-animaux.webp",
      origin: sourceItem?.uuid ?? null,
      disabled: false,
      transfer: false,
      duration: durationData(rounds),
      description: `La cible devient indétectable aux animaux normaux d’intelligence faible. Durée : ${rounds} rounds.`,
      flags: {
        add2e: {
          ...timeFlags({ sourceItem, caster, targetActor, rounds, level }),
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
        .filter(e => (e.flags?.add2e?.tags ?? []).includes("sort:invisibilite_aux_animaux"))
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
      ui.notifications.error("Invisibilité aux animaux : socket indisponible, impossible de demander l’effet au MJ.");
      return false;
    }

    return true;
  }

  async function createChat({ caster, sourceItem, targetToken, rounds }) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      content: `
        <div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,#fffaf0 0%,#fff7df 100%);border:1.5px solid #e2bc63;overflow:hidden;padding:0;font-family:var(--font-primary);">
          <div style="background:linear-gradient(90deg,#6f4b12 0%,#b88924 100%);padding:8px 12px;color:white;display:flex;align-items:center;gap:10px;border-bottom:2px solid #8a611d;">
            <img src="${esc(caster?.img || "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
            <div style="line-height:1.2;flex:1;">
              <div style="font-weight:bold;font-size:1.05em;">${esc(caster?.name ?? "Lanceur")}</div>
              <div style="font-size:0.85em;opacity:0.95;">lance <b>${esc(sourceItem?.name ?? "Invisibilité aux Animaux")}</b></div>
            </div>
            <div style="text-align:right;font-size:0.78em;opacity:0.95;">Sort divin</div>
            <img src="${esc(sourceItem?.img || "systems/add2e/assets/icones/sorts/invisibilite-aux-animaux.webp")}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
          </div>
          <div style="padding:10px;">
            <div style="margin-bottom:6px;font-size:0.95em;color:#6f4b12;"><b>Cible :</b> ${esc(targetToken?.name ?? targetToken?.actor?.name ?? "—")}</div>
            <div style="border:1px solid #e2bc63;background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:#6f4b12;">
              <div style="font-weight:bold;color:#2f8f46;">INVISIBILITÉ AUX ANIMAUX APPLIQUÉE</div>
              <div>Durée : <b>${esc(rounds)} rounds</b>.</div>
              <div>Les animaux normaux d’intelligence faible ne détectent plus la cible tant que l’effet persiste.</div>
            </div>
            <details style="margin-top:8px;background:white;border:1px solid #e2bc63;border-radius:6px;">
              <summary style="cursor:pointer;color:#6f4b12;font-weight:600;padding:6px;">Règle appliquée</summary>
              <div style="padding:8px;font-size:0.85em;line-height:1.45;color:#6f4b12;">
                Rend la créature touchée indétectable aux animaux normaux d’intelligence faible. Les créatures magiques ou très intelligentes ne sont pas concernées.
              </div>
            </details>
          </div>
        </div>`,
      ...chatStyleData()
    });
  }

  const sourceItem = sourceItemFromContext();
  if (!sourceItem) {
    ui.notifications.error("Invisibilité aux animaux : sort introuvable.");
    return false;
  }

  const caster = casterFromContext(sourceItem);
  if (!caster) {
    ui.notifications.error("Invisibilité aux animaux : lanceur introuvable.");
    return false;
  }

  const casterToken = casterTokenFor(caster);
  if (!casterToken) {
    ui.notifications.warn("Invisibilité aux animaux : sélectionne le token du lanceur.");
    return false;
  }

  const targets = Array.from(game.user.targets ?? []);
  if (targets.length !== 1 || !targets[0]?.actor) {
    ui.notifications.warn("Invisibilité aux animaux : cible exactement une créature touchée.");
    return false;
  }

  const targetToken = targets[0];
  if (!tokensAuContact(casterToken, targetToken)) {
    ui.notifications.warn("Invisibilité aux animaux : la cible doit être au toucher.");
    return false;
  }

  const level = getLevel(caster);
  const rounds = roundDuration(level);
  const data = effectData({ sourceItem, caster, targetActor: targetToken.actor, level });
  const ok = await applyEffect(targetToken.actor, data);
  if (!ok) return false;

  try {
    await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX?.(targetToken, "divine");
    await globalThis.ADD2E_PLAY_SPELL_FX?.("invisibilite_aux_animaux", { casterToken, targetToken });
  } catch (err) {
    console.warn("[ADD2E][INVIS_ANIMAUX][VFX][IGNORED]", err);
  }

  await createChat({ caster, sourceItem, targetToken, rounds });

  console.log("[ADD2E][invisibilite-aux-animaux.js][ONUSE_RESULT]", true);
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT] Le script onUse doit retourner true ou false.", { script: "invisibilite-aux-animaux.js", result: __add2eOnUseResult });
  ui.notifications?.error?.("Invisibilité aux animaux : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
