/**
 * ADD2E — Protection contre le Mal / Protection contre le Bien
 * Clerc niveau 1
 * Version : 2026-06-06-protection-mal-time-engine-v1
 *
 * Contrat onUse : true = consommé ; false = non consommé.
 */

console.log("%c[ADD2E][PROTECTION_MAL] 2026-06-06-protection-mal-time-engine-v1", "color:#b88924;font-weight:bold;");

const __add2eOnUseResult = await (async () => {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications.error("Protection contre le Mal : DialogV2 introuvable.");
    return false;
  }

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

  function casterTokenFor(caster) {
    return canvas.tokens?.controlled?.[0]
      ?? ((typeof token !== "undefined" && token) ? token : null)
      ?? caster?.getActiveTokens?.()[0]
      ?? null;
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
    return time?.toRounds?.("level*3", "round", { level }) ?? (Math.max(1, Number(level) || 1) * 3);
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

  function aeAddChange(key, value, priority = 20) {
    if (CONST.ACTIVE_EFFECT_CHANGE_TYPES) return { key, type: "add", phase: "final", value: String(value), priority };
    return { key, mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: String(value), priority };
  }

  function modeData(mode) {
    const isGood = mode === "bien";
    return {
      key: isGood ? "bien" : "mal",
      label: isGood ? "Protection contre le Bien" : "Protection contre le Mal",
      spellKey: isGood ? "protection_contre_le_bien" : "protection_contre_le_mal",
      tags: isGood
        ? ["sort:protection_contre_le_bien", "protection:bien", "bonus_ca:2", "bonus_save_vs:bien:2", "barriere:creatures_invoquees", "malus_toucher_ennemi:2"]
        : ["sort:protection_contre_le_mal", "protection:mal", "bonus_ca:2", "bonus_save_vs:mal:2", "barriere:creatures_invoquees", "malus_toucher_ennemi:2"]
    };
  }

  function timeFlags({ sourceItem, caster, targetActor, modeInfo, rounds, level }) {
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    const endMessage = modeInfo.key === "bien"
      ? "La protection contre le bien de {actor} prend fin."
      : "La protection contre le mal de {actor} prend fin.";

    return time?.flags?.({
      source: "protection-contre-le-mal.js",
      rounds,
      unit: "round",
      endMessage,
      extra: {
        spellName: modeInfo.label,
        spellKey: modeInfo.spellKey,
        level,
        sourceItemUuid: sourceItem?.uuid ?? null,
        casterId: caster?.id ?? null,
        casterUuid: caster?.uuid ?? null,
        targetId: targetActor?.id ?? null,
        targetUuid: targetActor?.uuid ?? null,
        tags: modeInfo.tags
      }
    }) ?? {
      timeEngine: { managed: true, unit: "round", totalRounds: rounds },
      roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage },
      endMessage,
      spellName: modeInfo.label,
      spellKey: modeInfo.spellKey,
      level,
      sourceItemUuid: sourceItem?.uuid ?? null,
      casterId: caster?.id ?? null,
      casterUuid: caster?.uuid ?? null,
      targetId: targetActor?.id ?? null,
      targetUuid: targetActor?.uuid ?? null,
      tags: modeInfo.tags
    };
  }

  function effectData({ sourceItem, caster, targetActor, modeInfo, level }) {
    const rounds = roundDuration(level);
    return {
      name: modeInfo.label,
      img: sourceItem?.img || "systems/add2e/assets/icones/sorts/protection-contre-le-mal.webp",
      origin: sourceItem?.uuid ?? null,
      disabled: false,
      transfer: false,
      duration: durationData(rounds),
      description: `${modeInfo.label}. Bonus de +2 à la CA et aux jets de protection appropriés ; barrière contre les créatures enchantées ou invoquées. Durée : ${rounds} rounds.`,
      flags: {
        add2e: {
          ...timeFlags({ sourceItem, caster, targetActor, modeInfo, rounds, level }),
          tags: modeInfo.tags
        }
      },
      changes: [
        aeAddChange("system.bonus_ca", 2),
        aeAddChange("system.bonus_sauvegarde", 2)
      ]
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
    const removeTags = ["sort:protection_contre_le_mal", "sort:protection_contre_le_bien"];

    if (game.user.isGM || targetActor.isOwner) {
      const oldIds = Array.from(targetActor.effects ?? [])
        .filter(e => {
          const tags = e.flags?.add2e?.tags ?? [];
          return Array.isArray(tags) && removeTags.some(t => tags.includes(t));
        })
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
      ui.notifications.error("Protection contre le Mal : socket indisponible, impossible de demander l’effet au MJ.");
      return false;
    }

    return true;
  }

  async function createChat({ caster, sourceItem, targetToken, modeInfo, rounds }) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      content: `
        <div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,#fffaf0 0%,#fff7df 100%);border:1.5px solid #e2bc63;overflow:hidden;padding:0;font-family:var(--font-primary);">
          <div style="background:linear-gradient(90deg,#6f4b12 0%,#b88924 100%);padding:8px 12px;color:white;display:flex;align-items:center;gap:10px;border-bottom:2px solid #8a611d;">
            <img src="${esc(caster?.img || "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
            <div style="line-height:1.2;flex:1;">
              <div style="font-weight:bold;font-size:1.05em;">${esc(caster?.name ?? "Lanceur")}</div>
              <div style="font-size:0.85em;opacity:0.95;">lance <b>${esc(modeInfo.label)}</b></div>
            </div>
            <div style="text-align:right;font-size:0.78em;opacity:0.95;">Sort divin</div>
            <img src="${esc(sourceItem?.img || "systems/add2e/assets/icones/sorts/protection-contre-le-mal.webp")}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
          </div>
          <div style="padding:10px;">
            <div style="margin-bottom:6px;font-size:0.95em;color:#6f4b12;"><b>Cible :</b> ${esc(targetToken?.name ?? targetToken?.actor?.name ?? "—")}</div>
            <div style="border:1px solid #e2bc63;background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:#6f4b12;">
              <div style="font-weight:bold;color:#2f8f46;">${esc(modeInfo.label.toUpperCase())} APPLIQUÉE</div>
              <div>Durée : <b>${esc(rounds)} rounds</b>.</div>
              <div>Bonus : <b>+2 CA</b> et <b>+2 sauvegardes</b> selon la protection.</div>
            </div>
            <details style="margin-top:8px;background:white;border:1px solid #e2bc63;border-radius:6px;">
              <summary style="cursor:pointer;color:#6f4b12;font-weight:600;padding:6px;">Règle appliquée</summary>
              <div style="padding:8px;font-size:0.85em;line-height:1.45;color:#6f4b12;">
                Protège la cible contre les contacts corporels des créatures enchantées ou invoquées, impose -2 aux attaques des créatures concernées et donne +2 aux jets de protection appropriés. Durée : 3 rounds par niveau du clerc.
              </div>
            </details>
          </div>
        </div>`,
      ...chatStyleData()
    });
  }

  const sourceItem = sourceItemFromContext();
  if (!sourceItem) {
    ui.notifications.error("Protection contre le Mal : sort introuvable.");
    return false;
  }

  const caster = casterFromContext(sourceItem);
  if (!caster) {
    ui.notifications.error("Protection contre le Mal : lanceur introuvable.");
    return false;
  }

  const casterToken = casterTokenFor(caster);
  if (!casterToken) {
    ui.notifications.warn("Protection contre le Mal : sélectionne le token du lanceur.");
    return false;
  }

  const targets = Array.from(game.user.targets ?? []);
  if (targets.length !== 1 || !targets[0]?.actor) {
    ui.notifications.warn("Protection contre le Mal : cible exactement une créature touchée.");
    return false;
  }

  const targetToken = targets[0];
  if (!tokensAuContact(casterToken, targetToken)) {
    ui.notifications.warn("Protection contre le Mal : la cible doit être au toucher.");
    return false;
  }

  const result = await DialogV2.wait({
    window: { title: "Lancement : Protection" },
    add2eTheme: "cleric",
    add2eImg: sourceItem.img || "systems/add2e/assets/icones/sorts/protection-contre-le-mal.webp",
    content: `
      <form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">
        <div class="form-group">
          <label style="font-weight:bold;">Version :</label>
          <select name="mode" style="width:100%;">
            <option value="mal">Protection contre le Mal</option>
            <option value="bien">Protection contre le Bien</option>
          </select>
        </div>
        <div style="font-size:0.9em;color:#6f4b12;border-top:1px solid #e2bc63;padding-top:6px;">
          Durée : 3 rounds par niveau. Cible au toucher : ${esc(targetToken.name)}.
        </div>
      </form>`,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "fa-solid fa-shield-halved",
        default: true,
        callback: (event, button) => ({ mode: String(button.form.elements.mode?.value || "mal") })
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });

  if (!result) return false;

  const level = getLevel(caster);
  const modeInfo = modeData(result.mode === "bien" ? "bien" : "mal");
  const rounds = roundDuration(level);
  const data = effectData({ sourceItem, caster, targetActor: targetToken.actor, modeInfo, level });
  const ok = await applyEffect(targetToken.actor, data);
  if (!ok) return false;

  try {
    await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX?.(targetToken, "protection");
    await globalThis.ADD2E_PLAY_SPELL_FX?.("protection", { casterToken, targetToken });
  } catch (err) {
    console.warn("[ADD2E][PROTECTION_MAL][VFX][IGNORED]", err);
  }

  await createChat({ caster, sourceItem, targetToken, modeInfo, rounds });

  console.log("[ADD2E][protection-contre-le-mal.js][ONUSE_RESULT]", true);
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT] Le script onUse doit retourner true ou false.", { script: "protection-contre-le-mal.js", result: __add2eOnUseResult });
  ui.notifications?.error?.("Protection contre le Mal : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
