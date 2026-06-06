/**
 * ADD2E — Injonction
 * Clerc niveau 1 — Enchantement/Charme
 * Version : 2026-06-02-injonction-time-engine-v1
 *
 * Contrat onUse : true = consommé ; false = non consommé.
 */

console.log("%c[ADD2E][INJONCTION] 2026-06-02-injonction-time-engine-v1", "color:#b88924;font-weight:bold;");

const __add2eOnUseResult = await (async () => {
  try {
    const DialogV2 = foundry.applications?.api?.DialogV2;
    if (!DialogV2) {
      ui.notifications.error("Injonction : DialogV2 introuvable. Foundry V13/V14 requis.");
      return false;
    }

    const COLORS = {
      main: "#b88924",
      dark: "#6f4b12",
      pale: "#fff7df",
      pale2: "#fffaf0",
      border: "#e2bc63",
      success: "#2f8f46",
      fail: "#b33a2e",
      warn: "#b88924"
    };

    const esc = value => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");

    const norm = value => String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    function chatStyleData() {
      return CONST.CHAT_MESSAGE_STYLES
        ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
        : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
    }

    function sourceItemFromContext() {
      if (typeof sort !== "undefined" && sort) return sort;
      if (typeof item !== "undefined" && item) return item;
      if (typeof sourceItem !== "undefined" && sourceItem) return sourceItem;
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

    function distanceMeters(tokenA, tokenB) {
      try {
        if (!tokenA || !tokenB) return 0;
        const gridSize = Number(canvas.grid?.size || canvas.scene?.grid?.size || 100) || 100;
        const gridDistance = Number(canvas.scene?.grid?.distance ?? 1) || 1;
        const dx = Number(tokenA.center?.x ?? tokenA.document?.x ?? 0) - Number(tokenB.center?.x ?? tokenB.document?.x ?? 0);
        const dy = Number(tokenA.center?.y ?? tokenA.document?.y ?? 0) - Number(tokenB.center?.y ?? tokenB.document?.y ?? 0);
        return (Math.hypot(dx, dy) / gridSize) * gridDistance;
      } catch (_e) {
        return 0;
      }
    }

    async function getSaveVsSpells(actorDoc) {
      const candidates = [
        actorDoc?.system?.sauvegarde_sortileges,
        actorDoc?.system?.sauvegardes?.sortileges,
        actorDoc?.system?.sauvegardes?.sorts,
        actorDoc?.system?.saves?.sorts,
        actorDoc?.system?.calculatedSaves?.sorts
      ];
      for (const raw of candidates) {
        const val = Number(raw);
        if (Number.isFinite(val) && val > 0) return val;
      }
      try {
        const data = await actorDoc?.sheet?.getData?.();
        const val = Number(data?.calculatedSaves?.sorts);
        if (Number.isFinite(val) && val > 0) return val;
      } catch (_e) {}
      return NaN;
    }

    async function rollSaveIfNeeded(targetActor, saveMode) {
      if (saveMode === "none") return { applicable: false, success: false, html: "" };
      const saveTarget = await getSaveVsSpells(targetActor);
      if (!Number.isFinite(saveTarget)) {
        return {
          applicable: true,
          success: false,
          html: `<div style="color:${COLORS.warn};">Jet de protection non automatisé : valeur introuvable. Effet appliqué, à ajuster par le MJ si nécessaire.</div>`
        };
      }
      const roll = await new Roll("1d20").evaluate({ async: true });
      if (game.dice3d) await game.dice3d.showForRoll(roll);
      const success = roll.total >= saveTarget;
      return {
        applicable: true,
        success,
        html: `<div>Jet de protection contre les sorts : <b>${esc(roll.total)}</b> / seuil ${esc(saveTarget)} — <b style="color:${success ? COLORS.success : COLORS.fail};">${success ? "réussi" : "raté"}</b>.</div>`
      };
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

    function timeFlags({ sourceItem, caster, commandWord }) {
      const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
      return time?.flags?.({
        source: "injonction.js",
        rounds: 1,
        unit: "round",
        endMessage: `L’injonction imposant « ${commandWord} » à {actor} prend fin.`,
        extra: {
          spellName: "Injonction",
          spellKey: "injonction",
          sourceItemUuid: sourceItem?.uuid ?? null,
          casterId: caster?.id ?? null,
          casterUuid: caster?.uuid ?? null,
          commandWord,
          tags: ["sort:injonction", "controle:ordre", "etat:injonction", "duree:1_round", "cible:creature"]
        }
      }) ?? {
        timeEngine: { managed: true, unit: "round", totalRounds: 1 },
        roundEngine: { managed: true, unit: "round", totalRounds: 1, endMessage: `L’injonction imposant « ${commandWord} » à {actor} prend fin.` },
        endMessage: `L’injonction imposant « ${commandWord} » à {actor} prend fin.`,
        spellName: "Injonction",
        spellKey: "injonction",
        sourceItemUuid: sourceItem?.uuid ?? null,
        casterId: caster?.id ?? null,
        casterUuid: caster?.uuid ?? null,
        commandWord,
        tags: ["sort:injonction", "controle:ordre", "etat:injonction", "duree:1_round", "cible:creature"]
      };
    }

    function effectData({ sourceItem, caster, commandWord }) {
      return {
        name: `Injonction : ${commandWord}`,
        img: sourceItem?.img || "systems/add2e/assets/icones/sorts/injonction.webp",
        origin: sourceItem?.uuid ?? null,
        disabled: false,
        transfer: false,
        duration: durationData(1),
        description: `La cible est soumise à l'injonction : ${commandWord}. Durée : 1 round.`,
        flags: {
          add2e: {
            ...timeFlags({ sourceItem, caster, commandWord }),
            tags: [
              "sort:injonction",
              "controle:ordre",
              "etat:injonction",
              "duree:1_round",
              "cible:creature"
            ]
          }
        },
        changes: []
      };
    }

    async function createOrRelayEffect(targetActor, data) {
      if (!targetActor) return false;
      if (game.user.isGM || targetActor.isOwner) {
        const old = targetActor.effects
          .filter(e => (e.flags?.add2e?.tags ?? []).includes("etat:injonction"))
          .map(e => e.id);
        if (old.length) await targetActor.deleteEmbeddedDocuments("ActiveEffect", old);
        await targetActor.createEmbeddedDocuments("ActiveEffect", [data]);
        return true;
      }
      if (!game.socket) return false;
      game.socket.emit("system.add2e", {
        type: "ADD2E_GM_OPERATION",
        operation: "createActiveEffect",
        payload: { actorUuid: targetActor.uuid, actorId: targetActor.id, effectData: data, fromUserId: game.user.id, sentAt: Date.now() }
      });
      return true;
    }

    async function playFx(targetToken, casterToken) {
      try {
        await globalThis.ADD2E_PLAY_SPELL_FX?.("injonction", {
          casterToken,
          targetToken: targetToken ?? null,
          jb2aOptions: { maxFiles: 2, scaleToObject: 1.25, opacity: 0.9 }
        });
      } catch (e) {
        console.warn("[ADD2E][INJONCTION][VFX][IGNORED]", e);
      }
    }

    async function createChat({ caster, sourceItem, targetToken, commandWord, saveResult, applied }) {
      const resultHtml = applied
        ? `<div style="border:1px solid ${COLORS.border};background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:${COLORS.dark};"><div style="font-weight:bold;color:${COLORS.success};">INJONCTION APPLIQUÉE</div><div>Ordre : <b>${esc(commandWord)}</b></div>${saveResult.html || ""}<div>Durée : <b>1 round</b></div></div>`
        : `<div style="border:1px solid ${COLORS.border};background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:${COLORS.dark};"><div style="font-weight:bold;color:${COLORS.fail};">INJONCTION RÉSISTÉE</div><div>Ordre : <b>${esc(commandWord)}</b></div>${saveResult.html || ""}</div>`;

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: caster }),
        content: `
          <div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,${COLORS.pale2} 0%,${COLORS.pale} 100%);border:1.5px solid ${COLORS.border};overflow:hidden;padding:0;font-family:var(--font-primary);">
            <div style="background:linear-gradient(90deg,${COLORS.dark} 0%,${COLORS.main} 100%);padding:8px 12px;color:white;display:flex;align-items:center;gap:10px;border-bottom:2px solid #8a611d;">
              <img src="${esc(caster?.img || "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
              <div style="line-height:1.2;flex:1;">
                <div style="font-weight:bold;font-size:1.05em;">${esc(caster.name)}</div>
                <div style="font-size:0.85em;opacity:0.95;">lance <b>${esc(sourceItem.name)}</b></div>
              </div>
              <div style="text-align:right;font-size:0.78em;opacity:0.95;">Sort divin</div>
              <img src="${esc(sourceItem?.img || "systems/add2e/assets/icones/sorts/injonction.webp")}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
            </div>
            <div style="padding:10px;">
              <div style="margin-bottom:6px;font-size:0.95em;color:${COLORS.dark};"><b>Cible :</b> ${esc(targetToken?.name ?? targetToken?.actor?.name ?? "—")}</div>
              ${resultHtml}
              <details style="margin-top:8px;background:white;border:1px solid ${COLORS.border};border-radius:6px;">
                <summary style="cursor:pointer;color:${COLORS.dark};font-weight:600;padding:6px;">Règle appliquée</summary>
                <div style="padding:8px;font-size:0.85em;line-height:1.45;color:${COLORS.dark};">
                  <div><b>Injonction</b> — Clerc niveau 1, enchantement/charme.</div>
                  <div>Portée : 1" ; durée : 1 round ; zone : une créature ; composante : V ; temps d'incantation : 1 segment.</div>
                  <div>Le clerc prononce un ordre clair d’un seul mot dans une langue comprise par la cible. Certaines créatures intelligentes ou puissantes ont droit à un jet de protection.</div>
                </div>
              </details>
            </div>
          </div>`,
        ...chatStyleData()
      });
    }

    const sourceItem = sourceItemFromContext();
    if (!sourceItem) {
      ui.notifications.error("Injonction : sort introuvable.");
      return false;
    }

    const caster = casterFromContext(sourceItem);
    if (!caster) {
      ui.notifications.error("Injonction : lanceur introuvable.");
      return false;
    }

    const casterToken = casterTokenFor(caster);
    const targets = Array.from(game.user.targets ?? []);
    if (targets.length !== 1 || !targets[0]?.actor) {
      ui.notifications.warn("Injonction : cible exactement une créature.");
      return false;
    }

    const targetToken = targets[0];
    const rangeMeters = 3;
    if (casterToken && distanceMeters(casterToken, targetToken) > rangeMeters) {
      ui.notifications.warn("Injonction : cible hors de portée.");
      return false;
    }

    const dialogResult = await DialogV2.wait({
      window: { title: "Lancement : Injonction" },
      add2eTheme: "cleric",
      add2eImg: sourceItem.img || "systems/add2e/assets/icones/sorts/injonction.webp",
      content: `
        <form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">
          <div class="form-group">
            <label style="font-weight:bold;">Ordre d’un seul mot :</label>
            <input type="text" name="commandWord" value="Halte" maxlength="24" style="width:100%;">
          </div>
          <div class="form-group">
            <label style="font-weight:bold;">Jet de protection :</label>
            <select name="saveMode" style="width:100%;">
              <option value="auto">Automatique si la sauvegarde de la cible est connue</option>
              <option value="none">Aucun jet automatisé</option>
            </select>
          </div>
          <div style="font-size:0.9em;color:#6f4b12;border-top:1px solid #e2bc63;padding-top:6px;">
            L’ordre doit tenir en un seul mot. En cas de réussite au jet de protection, aucun effet n’est posé.
          </div>
        </form>`,
      buttons: [
        {
          action: "cast",
          label: "Lancer",
          icon: "fa-solid fa-gavel",
          default: true,
          callback: (event, button) => ({
            commandWord: String(button.form.elements.commandWord?.value || "Halte").trim(),
            saveMode: String(button.form.elements.saveMode?.value || "auto")
          })
        },
        { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
      ],
      rejectClose: false
    });

    if (!dialogResult) return false;

    const commandWord = dialogResult.commandWord || "Halte";
    if (norm(commandWord).split("_").filter(Boolean).length > 1) {
      ui.notifications.warn("Injonction : l’ordre doit être un seul mot.");
      return false;
    }

    const saveResult = await rollSaveIfNeeded(targetToken.actor, dialogResult.saveMode);
    const applied = !(saveResult.applicable && saveResult.success);

    if (applied) {
      const ok = await createOrRelayEffect(targetToken.actor, effectData({ sourceItem, caster, commandWord }));
      if (!ok) {
        ui.notifications.error("Injonction : impossible d’appliquer l’effet actif.");
        return false;
      }
    }

    await playFx(applied ? targetToken : casterToken, casterToken);
    await createChat({ caster, sourceItem, targetToken, commandWord, saveResult, applied });

    console.log("[ADD2E][injonction.js][ONUSE_RESULT]", true);
    return true;
  } catch (e) {
    console.error("[ADD2E][INJONCTION][FATAL]", e);
    ui.notifications.error("Injonction : erreur dans le script. Voir console.");
    return false;
  }
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT] Le script onUse doit retourner true ou false.", { script: "injonction.js", result: __add2eOnUseResult });
  ui.notifications?.error?.("Injonction : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
