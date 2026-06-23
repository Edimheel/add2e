/**
 * ADD2E — Détection de la magie
 * Clerc niveau 1
 * Version : 2026-06-06-detection-magie-time-engine-v1
 *
 * Contrat onUse : true = consommé ; false = non consommé.
 */

console.log("%c[ADD2E][DETECTION_MAGIE] 2026-06-06-detection-magie-time-engine-v1", "color:#b88924;font-weight:bold;");

const __add2eOnUseResult = await (async () => {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications.error("Détection de la magie : DialogV2 introuvable.");
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

  function timeFlags({ sourceItem, caster, rounds, direction }) {
    const tags = [
      "sort:detection_de_la_magie",
      "detection:magie",
      "sens:magie",
      "aura:magique",
      "concentration"
    ];
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    return time?.flags?.({
      source: "detection-de-la-magie.js",
      rounds,
      unit: "round",
      endMessage: "La détection de la magie de {actor} prend fin.",
      extra: {
        spellName: "Détection de la magie",
        spellKey: "detection_de_la_magie",
        sourceItemUuid: sourceItem?.uuid ?? null,
        casterId: caster?.id ?? null,
        casterUuid: caster?.uuid ?? null,
        direction,
        tags
      }
    }) ?? {
      timeEngine: { managed: true, unit: "round", totalRounds: rounds },
      roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage: "La détection de la magie de {actor} prend fin." },
      endMessage: "La détection de la magie de {actor} prend fin.",
      spellName: "Détection de la magie",
      spellKey: "detection_de_la_magie",
      sourceItemUuid: sourceItem?.uuid ?? null,
      casterId: caster?.id ?? null,
      casterUuid: caster?.uuid ?? null,
      direction,
      tags
    };
  }

  function effectData({ sourceItem, caster, direction }) {
    const rounds = 10;
    const tags = [
      "sort:detection_de_la_magie",
      "detection:magie",
      "sens:magie",
      "aura:magique",
      "concentration"
    ];

    return {
      name: "Détection de la magie",
      img: "icons/svg/aura.svg",
      origin: sourceItem?.uuid ?? null,
      disabled: false,
      transfer: false,
      duration: durationData(rounds),
      description: `Le lanceur perçoit les émanations magiques dans la direction observée : ${direction}. Durée : 10 rounds.`,
      flags: {
        add2e: {
          ...timeFlags({ sourceItem, caster, rounds, direction }),
          tags
        }
      },
      changes: []
    };
  }

  async function applyEffect(caster, data) {
    if (!caster) return false;
    const oldIds = Array.from(caster.effects ?? [])
      .filter(e => {
        const tags = e.flags?.add2e?.tags ?? [];
        return Array.isArray(tags) && (tags.includes("sort:detection_de_la_magie") || tags.includes("detection:magie"));
      })
      .map(e => e.id)
      .filter(Boolean);
    if (oldIds.length) await caster.deleteEmbeddedDocuments("ActiveEffect", oldIds);
    await caster.createEmbeddedDocuments("ActiveEffect", [data]);
    return true;
  }

  async function createChat({ caster, sourceItem, direction }) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      content: `
        <div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,#fffaf0 0%,#fff7df 100%);border:1.5px solid #e2bc63;overflow:hidden;padding:0;font-family:var(--font-primary);">
          <div style="background:linear-gradient(90deg,#6f4b12 0%,#b88924 100%);padding:8px 12px;color:white;display:flex;align-items:center;gap:10px;border-bottom:2px solid #8a611d;">
            <img src="${esc(caster?.img || "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
            <div style="line-height:1.2;flex:1;">
              <div style="font-weight:bold;font-size:1.05em;">${esc(caster?.name ?? "Lanceur")}</div>
              <div style="font-size:0.85em;opacity:0.95;">lance <b>${esc(sourceItem?.name ?? "Détection de la magie")}</b></div>
            </div>
            <div style="text-align:right;font-size:0.78em;opacity:0.95;">Sort divin</div>
            <img src="${esc(sourceItem?.img || "systems/add2e/assets/icones/sorts/detection-magie.webp")}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
          </div>
          <div style="padding:10px;">
            <div style="border:1px solid #e2bc63;background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:#6f4b12;">
              <div style="font-weight:bold;color:#2f8f46;">DÉTECTION DE LA MAGIE ACTIVE</div>
              <div>Durée : <b>10 rounds</b>.</div>
              <div>Direction / zone : <b>${esc(direction)}</b>.</div>
            </div>
            <details style="margin-top:8px;background:white;border:1px solid #e2bc63;border-radius:6px;">
              <summary style="cursor:pointer;color:#6f4b12;font-weight:600;padding:6px;">Règle appliquée</summary>
              <div style="padding:8px;font-size:0.85em;line-height:1.45;color:#6f4b12;">
                Permet de percevoir les émanations magiques dans la direction du regard et d’estimer leur intensité. Les obstacles importants peuvent bloquer la détection selon l’arbitrage du MJ.
              </div>
            </details>
          </div>
        </div>`,
      ...chatStyleData()
    });
  }

  const sourceItem = sourceItemFromContext();
  if (!sourceItem) {
    ui.notifications.error("Détection de la magie : sort introuvable.");
    return false;
  }

  const caster = casterFromContext(sourceItem);
  if (!caster) {
    ui.notifications.error("Détection de la magie : lanceur introuvable.");
    return false;
  }

  const casterToken = casterTokenFor(caster);

  const result = await DialogV2.wait({
    window: { title: "Lancement : Détection de la magie" },
    add2eTheme: "cleric",
    add2eImg: sourceItem.img || "systems/add2e/assets/icones/sorts/detection-magie.webp",
    content: `
      <form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">
        <div class="form-group">
          <label style="font-weight:bold;">Direction / zone observée :</label>
          <input type="text" name="direction" value="devant le lanceur" style="width:100%;">
        </div>
        <div style="font-size:0.9em;color:#6f4b12;border-top:1px solid #e2bc63;padding-top:6px;">
          L’effet est posé sur le lanceur pour 10 rounds.
        </div>
      </form>`,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "fa-solid fa-eye",
        default: true,
        callback: (event, button) => ({ direction: String(button.form.elements.direction?.value || "devant le lanceur") })
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });

  if (!result) return false;

  const direction = String(result.direction || "devant le lanceur");
  const data = effectData({ sourceItem, caster, direction });
  const ok = await applyEffect(caster, data);
  if (!ok) return false;

  try {
    await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX?.(casterToken ?? caster, "detection");
    await globalThis.ADD2E_PLAY_SPELL_FX?.("detection_magie", { casterToken });
  } catch (err) {
    console.warn("[ADD2E][DETECTION_MAGIE][VFX][IGNORED]", err);
  }

  await createChat({ caster, sourceItem, direction });

  console.log("[ADD2E][detection-de-la-magie.js][ONUSE_RESULT]", true);
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT] Le script onUse doit retourner true ou false.", { script: "detection-de-la-magie.js", result: __add2eOnUseResult });
  ui.notifications?.error?.("Détection de la magie : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;