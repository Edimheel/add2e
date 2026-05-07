/**
 * ADD2E — Sort BÉNÉDICTION / MALÉDICTION
 * Clerc niveau 1 — Conjuration/Appel
 *
 * Effet : +1 au moral et +1 aux jets d'attaque des alliés dans la zone.
 * Inverse : Malédiction, -1 au moral et -1 aux jets d'attaque.
 * Durée : 6 rounds.
 * Portée : 18 m.
 * Zone : 5 × 5.
 * Jet de sauvegarde : aucun.
 *
 * Compatible MJ + joueur via relais MJ générique ADD2E_GM_OPERATION.
 * return false = le sort ne doit pas être consommé.
 * return true  = le sort est réellement lancé.
 */

const __add2eOnUseResult = await (async () => {

  console.log("%c[ADD2E][BENEDICTION] SCRIPT CUSTOM", "color:#b88924;font-weight:bold;");

  // ======================================================
  // 0. STYLE CHAT — SORTS DE CLERC
  // ======================================================
  const ADD2E_CLERIC_CHAT = {
    main: "#b88924",
    dark: "#6f4b12",
    pale: "#fff7df",
    pale2: "#fffaf0",
    border: "#e2bc63",
    borderDark: "#8a611d",
    success: "#2f8f46",
    fail: "#b33a2e",
    muted: "#6b5a35"
  };

  function add2eEscapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function add2eSpellImg(src, fallback = "icons/magic/holy/prayer-hands-glowing-yellow.webp") {
    return add2eEscapeHtml(src || fallback);
  }

  function add2eClercCard({ caster, sourceItem, modeLabel, targetsLabel, resultHtml }) {
    const casterName = add2eEscapeHtml(caster?.name ?? "Lanceur");
    const spellName = add2eEscapeHtml(sourceItem?.name ?? "Bénédiction");

    return `
      <div class="add2e-spell-card add2e-spell-card-clerc" style="
        border-radius:12px;
        box-shadow:0 4px 10px #0002;
        background:linear-gradient(135deg,${ADD2E_CLERIC_CHAT.pale2} 0%,${ADD2E_CLERIC_CHAT.pale} 100%);
        border:1.5px solid ${ADD2E_CLERIC_CHAT.border};
        overflow:hidden;
        padding:0;
        font-family:var(--font-primary);
      ">
        <div style="
          background:linear-gradient(90deg,${ADD2E_CLERIC_CHAT.dark} 0%,${ADD2E_CLERIC_CHAT.main} 100%);
          padding:8px 12px;
          color:white;
          display:flex;
          align-items:center;
          gap:10px;
          border-bottom:2px solid ${ADD2E_CLERIC_CHAT.borderDark};
        ">
          <img src="${add2eSpellImg(caster?.img, "icons/svg/mystery-man.svg")}" style="
            width:36px;
            height:36px;
            border-radius:50%;
            border:2px solid #fff;
            object-fit:cover;
          ">

          <div style="line-height:1.2;flex:1;">
            <div style="font-weight:bold;font-size:1.05em;">${casterName}</div>
            <div style="font-size:0.85em;opacity:0.95;">
              lance <b>${spellName}</b>
            </div>
          </div>

          <img src="${add2eSpellImg(sourceItem?.img)}" style="
            width:32px;
            height:32px;
            border-radius:4px;
            background:#fff;
          ">
        </div>

        <div style="padding:10px;">
          <div style="margin-bottom:6px;font-size:0.95em;color:${ADD2E_CLERIC_CHAT.dark};">
            <b>Mode :</b> ${add2eEscapeHtml(modeLabel)}<br>
            <b>Cible(s) :</b> ${targetsLabel}
          </div>

          ${resultHtml}

          <details style="
            margin-top:8px;
            background:white;
            border:1px solid ${ADD2E_CLERIC_CHAT.border};
            border-radius:6px;
          ">
            <summary style="
              cursor:pointer;
              color:${ADD2E_CLERIC_CHAT.dark};
              font-weight:600;
              padding:6px;
            ">
              Règle appliquée
            </summary>

            <div style="
              padding:8px;
              font-size:0.85em;
              line-height:1.45;
              color:${ADD2E_CLERIC_CHAT.dark};
            ">
              <div><b>Bénédiction</b> — Clerc niveau 1, conjuration/appel.</div>
              <div>Portée : 18 m ; zone d'effet : 5 × 5 ; durée : 6 rounds ; jet de sauvegarde : aucun.</div>
              <div>Effet : <b>+1 au moral</b> et <b>+1 aux jets d'attaque</b> des alliés dans la zone.</div>
              <div>Inverse : <b>Malédiction</b>, avec un malus de -1 au moral et aux jets d'attaque.</div>
            </div>
          </details>
        </div>
      </div>
    `;
  }

  function add2eEmitGmOperation(operation, payload) {
    if (!game.socket) return false;

    const message = {
      type: "ADD2E_GM_OPERATION",
      operation,
      payload: {
        ...(payload ?? {}),
        fromUserId: game.user.id,
        sentAt: Date.now()
      }
    };

    console.log("[ADD2E][BENEDICTION][GM-RELAY] emit :", message);
    game.socket.emit("system.add2e", message);
    return true;
  }

  async function add2eCreateEffectOnActor(targetActor, effectData) {
    if (!targetActor) return false;

    if (game.user.isGM || targetActor.isOwner) {
      // Nettoyage local pour éviter les doublons du même sort ou de son inverse.
      const oldIds = targetActor.effects
        .filter(e => {
          const tags = e.flags?.add2e?.tags ?? [];
          return Array.isArray(tags) && (
            tags.includes("etat:benediction") ||
            tags.includes("etat:malediction")
          );
        })
        .map(e => e.id);

      if (oldIds.length) {
        await targetActor.deleteEmbeddedDocuments("ActiveEffect", oldIds);
      }

      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return true;
    }

    const emitted = add2eEmitGmOperation("createActiveEffect", {
      actorUuid: targetActor.uuid,
      actorId: targetActor.id,
      effectData
    });

    if (!emitted) {
      ui.notifications.error("Bénédiction : impossible de contacter le MJ pour créer l'effet actif.");
      return false;
    }

    return true;
  }

  function add2eDistanceMeters(tokenA, tokenB) {
    try {
      if (!tokenA || !tokenB) return 0;

      const distance = canvas.grid.measureDistances(
        [{ ray: new Ray(tokenA.center, tokenB.center) }],
        { gridSpaces: true }
      )[0];

      return Number(distance) || 0;
    } catch (e) {
      console.warn("[ADD2E][BENEDICTION] mesure distance impossible", e);
      return 0;
    }
  }

  // ======================================================
  // 1. INITIALISATION ROBUSTE
  // ======================================================
  let sourceItem = null;

  if (typeof sort !== "undefined" && sort) sourceItem = sort;
  else if (typeof item !== "undefined" && item) sourceItem = item;
  else if (typeof this !== "undefined" && this?.documentName === "Item") sourceItem = this;

  if (
    !sourceItem &&
    typeof arguments !== "undefined" &&
    arguments.length > 1 &&
    arguments[1]?.name
  ) {
    sourceItem = arguments[1];
  }

  if (!sourceItem) {
    ui.notifications.error("Bénédiction : sort introuvable.");
    return false;
  }

  const casterToken =
    canvas.tokens.controlled[0]
    ?? ((typeof token !== "undefined" && token) ? token : null);

  if (!casterToken) {
    ui.notifications.warn("Bénédiction : sélectionne le token du lanceur.");
    return false;
  }

  const caster = casterToken.actor ?? ((typeof actor !== "undefined" && actor) ? actor : sourceItem.parent);

  if (!caster) {
    ui.notifications.error("Bénédiction : lanceur introuvable.");
    return false;
  }

  // ======================================================
  // 2. CIBLES
  // ======================================================
  const targets = Array.from(game.user.targets ?? []);

  if (!targets.length) {
    ui.notifications.warn("Bénédiction : cible au moins une créature dans la zone.");
    return false;
  }

  const invalidTargets = targets.filter(t => !t?.actor);

  if (invalidTargets.length) {
    ui.notifications.warn("Bénédiction : une cible n'a pas d'acteur.");
    return false;
  }

  const maxRange = 18;
  const outOfRange = targets.filter(t => add2eDistanceMeters(casterToken, t) > maxRange);

  if (outOfRange.length) {
    ui.notifications.warn(
      `Bénédiction : cible hors de portée (${outOfRange.map(t => t.name).join(", ")}).`
    );
    return false;
  }

  // ======================================================
  // 3. DIALOGUE SIMPLE
  // ======================================================
  const DialogV2 = foundry.applications?.api?.DialogV2;

  const targetNamesHtml = targets
    .map(t => `<li>${add2eEscapeHtml(t.name)}</li>`)
    .join("");

  let mode = null;

  if (DialogV2) {
    const dialogResult = await DialogV2.wait({
      window: {
        title: "Lancement : Bénédiction"
      },
      content: `
        <form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">
          <div class="form-group">
            <label style="font-weight:bold;">Effet :</label>
            <select name="mode" style="width:100%;">
              <option value="benediction">Bénédiction (+1 attaque, +1 moral)</option>
              <option value="malediction">Malédiction (-1 attaque, -1 moral)</option>
            </select>
          </div>

          <div style="font-size:0.9em;color:#666;border-top:1px solid #ddd;padding-top:6px;">
            <div><b>Durée :</b> 6 rounds</div>
            <div><b>Portée :</b> 18 m</div>
            <div><b>Cibles :</b></div>
            <ul style="margin:4px 0 0 16px;padding:0;">${targetNamesHtml}</ul>
          </div>
        </form>
      `,
      buttons: [
        {
          action: "cast",
          label: "Lancer",
          icon: "fa-solid fa-hands-praying",
          default: true,
          callback: (event, button) => {
            return {
              mode: String(button.form.elements.mode?.value || "benediction")
            };
          }
        },
        {
          action: "cancel",
          label: "Annuler",
          icon: "fa-solid fa-xmark",
          callback: () => null
        }
      ],
      rejectClose: false
    });

    if (!dialogResult) return false;
    mode = dialogResult.mode;
  } else {
    const result = await new Promise(resolve => {
      new Dialog({
        title: "Lancement : Bénédiction",
        content: `
          <form>
            <div class="form-group">
              <label>Effet :</label>
              <select name="mode">
                <option value="benediction">Bénédiction (+1 attaque, +1 moral)</option>
                <option value="malediction">Malédiction (-1 attaque, -1 moral)</option>
              </select>
            </div>
          </form>
        `,
        buttons: {
          cast: {
            label: "Lancer",
            callback: html => resolve({
              mode: String(html.find('[name="mode"]').val() || "benediction")
            })
          },
          cancel: {
            label: "Annuler",
            callback: () => resolve(null)
          }
        },
        close: () => resolve(null),
        default: "cast"
      }).render(true);
    });

    if (!result) return false;
    mode = result.mode;
  }

  const isCurse = mode === "malediction";
  const bonusValue = isCurse ? -1 : 1;
  const modeLabel = isCurse ? "Malédiction" : "Bénédiction";
  const effectName = isCurse ? "Malédiction" : "Bénédiction";
  const icon = sourceItem.img || (isCurse
    ? "icons/magic/control/debuff-energy-hold-pink.webp"
    : "icons/magic/holy/prayer-hands-glowing-yellow.webp");

  const durationData = {
    rounds: 6,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time.worldTime
  };


  function add2eAEAddChange(key, value, priority = 20) {
    if (CONST.ACTIVE_EFFECT_CHANGE_TYPES) {
      return {
        key,
        type: "add",
        phase: "final",
        value: String(value),
        priority
      };
    }

    return {
      key,
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      value: String(value),
      priority
    };
  }

  const effectData = {
    name: effectName,
    img: icon,
    origin: sourceItem.uuid,
    disabled: false,
    transfer: false,
    duration: durationData,
    description: isCurse
      ? "Malus de -1 au moral et aux jets d'attaque."
      : "Bonus de +1 au moral et aux jets d'attaque.",
    flags: {
      add2e: {
        spellName: sourceItem.name,
        casterId: caster.id,
        casterUuid: caster.uuid,
        tags: isCurse
          ? [
              "etat:malediction",
              "malus_attaque:1",
              "malus_moral:1",
              "bonus_attaque:-1",
              "bonus_moral:-1"
            ]
          : [
              "etat:benediction",
              "bonus_attaque:1",
              "bonus_moral:1"
            ]
      }
    },
    changes: [
      add2eAEAddChange("system.bonus_attaque", bonusValue),
      add2eAEAddChange("system.bonus_moral", bonusValue)
    ]
  };

  // ======================================================
  // 4. APPLICATION DES EFFETS
  // ======================================================
  const applied = [];
  const failed = [];

  for (const targetToken of targets) {
    const ok = await add2eCreateEffectOnActor(targetToken.actor, foundry.utils.deepClone(effectData));

    if (ok) applied.push(targetToken);
    else failed.push(targetToken);
  }

  if (!applied.length) {
    ui.notifications.error("Bénédiction : aucun effet n'a pu être appliqué.");
    return false;
  }

  // ======================================================
  // 5. MESSAGE CHAT UNIQUE
  // ======================================================
  const appliedHtml = applied
    .map(t => `<li>${add2eEscapeHtml(t.name)}</li>`)
    .join("");

  const failedHtml = failed.length
    ? `<div style="margin-top:6px;color:${ADD2E_CLERIC_CHAT.fail};">
        Non appliqué : ${failed.map(t => add2eEscapeHtml(t.name)).join(", ")}
      </div>`
    : "";

  const resultHtml = `
    <div style="
      border:1px solid ${ADD2E_CLERIC_CHAT.border};
      background:#fffdf4;
      border-radius:6px;
      padding:8px;
    ">
      <div style="text-align:center;font-weight:bold;color:${isCurse ? ADD2E_CLERIC_CHAT.fail : ADD2E_CLERIC_CHAT.success};">
        ${add2eEscapeHtml(modeLabel.toUpperCase())} APPLIQUÉE
      </div>
      <div style="margin-top:6px;color:${ADD2E_CLERIC_CHAT.dark};">
        <b>Effet :</b> ${bonusValue > 0 ? "+1" : "-1"} au moral et aux jets d'attaque.
      </div>
      <div style="margin-top:6px;color:${ADD2E_CLERIC_CHAT.dark};">
        <b>Durée :</b> 6 rounds.
      </div>
      <div style="margin-top:6px;color:${ADD2E_CLERIC_CHAT.dark};">
        <b>Créatures affectées :</b>
        <ul style="margin:4px 0 0 16px;padding:0;">${appliedHtml}</ul>
      </div>
      ${failedHtml}
    </div>
  `;

  if (globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX) await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX(casterTokenObj ?? casterToken ?? caster, "divine");

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: add2eClercCard({
      caster,
      sourceItem,
      modeLabel,
      targetsLabel: applied.map(t => add2eEscapeHtml(t.name)).join(", "),
      resultHtml
    }),
      ...(CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 })});

  console.log("[ADD2E][benediction.js][ONUSE_RESULT]", true);
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT] Le script onUse doit retourner true ou false.", {
    script: "benediction.js",
    result: __add2eOnUseResult
  });
  ui.notifications?.error?.(`${sourceItem?.name ?? item?.name ?? sort?.name ?? "Sort"} : le script onUse n'a pas retourné true/false.`);
  return false;
}

return __add2eOnUseResult;
