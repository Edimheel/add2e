/**
 * ADD2E — Détection de la magie — Clerc niveau 1
 * Version : 2026-05-21-clerc-v1
 *
 * Règle clerc :
 * - Portée : 3"
 * - Durée : 1 tour
 * - Zone : 1" de large, 3" de long, dans la direction regardée
 * - Rotation possible : 60° par round
 * - Le clerc distingue seulement magie faible ou forte
 * - Blocage : pierre 30 cm+, métal 3 cm+, bois 90 cm+
 */

console.log("%c[ADD2E][DETECTION_MAGIE][CLERC] 2026-05-21-clerc-v1", "color:#b88924;font-weight:bold;");

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

  let sourceItem = null;
  if (typeof sort !== "undefined" && sort) sourceItem = sort;
  else if (typeof item !== "undefined" && item) sourceItem = item;
  else if (typeof this !== "undefined" && this?.documentName === "Item") sourceItem = this;
  else if (typeof args !== "undefined" && args?.[0]?.item) sourceItem = args[0].item;

  if (!sourceItem) {
    ui.notifications.error("Détection de la magie : sort introuvable.");
    return false;
  }

  const caster =
    (typeof actor !== "undefined" && actor)
      ? actor
      : sourceItem.parent;

  if (!caster) {
    ui.notifications.error("Détection de la magie : lanceur introuvable.");
    return false;
  }

  const casterToken = canvas.tokens.controlled[0] ?? ((typeof token !== "undefined" && token) ? token : null);

  const existing = caster.effects.find(e =>
    e.name === "Détection de la magie" ||
    e.flags?.add2e?.spellKey === "detection_magie_clerc"
  );

  if (existing) await existing.delete();

  const durationRounds = 10;

  const effectData = {
    name: "Détection de la magie",
    img: sourceItem.img || "systems/add2e/assets/icones/sorts/detection-magie-violet.webp",
    icon: sourceItem.img || "systems/add2e/assets/icones/sorts/detection-magie-violet.webp",
    origin: sourceItem.uuid,
    disabled: false,
    transfer: false,
    duration: {
      rounds: durationRounds,
      startRound: game.combat?.round ?? null,
      startTurn: game.combat?.turn ?? null,
      startTime: game.time.worldTime
    },
    description: "Détection de la magie cléricale : le clerc perçoit les émanations magiques faibles ou fortes dans un cône rectangulaire de 1\" de large sur 3\" de long, dans la direction regardée.",
    flags: {
      add2e: {
        spellKey: "detection_magie_clerc",
        spellName: "Détection de la magie",
        spellList: "cleric",
        school: "divination",
        sourceItemUuid: sourceItem.uuid,
        casterId: caster.id,
        casterUuid: caster.uuid,
        range: "3\"",
        area: "1\" de large, 3\" de long",
        duration: "1 tour",
        rotationPerRound: "60°",
        detectionDetail: "faible_ou_forte_uniquement",
        blockedBy: {
          stoneCm: 30,
          metalCm: 3,
          woodCm: 90
        },
        tags: [
          "sort:clerc",
          "niveau:1",
          "divination",
          "detection:magie",
          "detection:faible_ou_forte",
          "zone:1x3",
          "rotation:60_par_round"
        ]
      }
    },
    changes: []
  };

  await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);

  if (typeof Sequence !== "undefined" && casterToken) {
    try {
      await new Sequence()
        .effect()
        .file("jb2a.magic_signs.circle.02.blue")
        .atLocation(casterToken)
        .attachTo(casterToken)
        .scaleToObject(1.2)
        .belowTokens(true)
        .fadeIn(400)
        .fadeOut(400)
        .duration(2200)
        .play();
    } catch (e) {
      console.warn("[ADD2E][DETECTION_MAGIE][CLERC][VFX] Animation ignorée", e);
    }
  }

  const detailsData = [
    { label: "Liste", val: "Clerc" },
    { label: "Niveau", val: "1" },
    { label: "Durée", val: "1 tour / 10 rounds" },
    { label: "Portée", val: "3\"" },
    { label: "Zone", val: "1\" de large × 3\" de long" },
    { label: "Orientation", val: "direction regardée, 60°/round" },
    { label: "Information", val: "magie faible ou forte uniquement" }
  ];

  const chatContent = `
    <div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,#fffaf0 0%,#fff7df 100%);border:1.5px solid #e2bc63;margin:0.3em 0;padding:0;font-family:var(--font-primary);overflow:hidden;">
      <div style="background:linear-gradient(90deg,#6f4b12 0%,#b88924 100%);padding:8px 12px;display:flex;align-items:center;gap:10px;color:white;border-bottom:2px solid #8a611d;">
        <img src="${esc(caster.img || "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
        <div style="line-height:1.2;flex:1;">
          <div style="font-weight:bold;font-size:1.05em;">${esc(caster.name)}</div>
          <div style="font-size:0.85em;opacity:0.95;">lance <b>${esc(sourceItem.name)}</b></div>
        </div>
        <div style="text-align:right;font-size:0.78em;opacity:0.95;">Sort divin</div>
        <img src="${esc(sourceItem.img || "systems/add2e/assets/icones/sorts/detection-magie-violet.webp")}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
      </div>

      <div style="padding:10px;">
        <div style="background:#fffdf4;border:1px solid #e2bc63;border-radius:6px;padding:7px;text-align:center;margin-bottom:8px;color:#6f4b12;">
          <div style="font-weight:bold;color:#2f8f46;">DÉTECTION ACTIVE</div>
          <div>Le clerc perçoit uniquement si la magie est <b>faible</b> ou <b>forte</b>.</div>
        </div>

        <details style="background:#fff;border:1px solid #e2bc63;border-radius:6px;">
          <summary style="cursor:pointer;color:#6f4b12;font-weight:600;font-size:0.9em;padding:6px 10px;background:#fff7df;border-radius:6px;list-style:none;">
            Règle appliquée
          </summary>
          <div style="padding:8px;">
            <table style="width:100%;font-size:0.85em;border-spacing:0;margin-bottom:10px;color:#333;border-bottom:1px solid #eee;">
              ${detailsData.map((d, i) => `
                <tr style="${i % 2 === 0 ? "background:#fffaf0;" : ""}">
                  <td style="color:#6f4b12;font-weight:600;padding:2px 5px;width:42%;">${esc(d.label)}</td>
                  <td style="text-align:right;padding:2px 5px;">${esc(d.val)}</td>
                </tr>`).join("")}
            </table>
            <div style="color:#6f4b12;font-size:0.9em;line-height:1.4;text-align:justify;">
              <b>Limites :</b> les murs de pierre de 30 cm ou plus, 3 cm ou plus de métal, ou 90 cm ou plus de bois bloquent la détection. Le script pose l’état de détection ; l’identification exacte des auras reste arbitrée par le MJ selon les objets et créatures présents.
            </div>
          </div>
        </details>
      </div>
    </div>`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: chatContent,
    ...chatStyleData()
  });

  console.log("[ADD2E][detect_magic.js][ONUSE_RESULT]", true);
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT] Le script onUse doit retourner true ou false.", {
    script: "detect_magic.js",
    result: __add2eOnUseResult
  });
  ui.notifications?.error?.("Détection de la magie : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
