/**
 * ADD2E — Sort BÉNÉDICTION / MALÉDICTION
 * Clerc niveau 1 — Conjuration/Appel
 * Version : 2026-06-21-benediction-derived-mode-v1
 *
 * Effet : +1 au moral et +1 aux jets d'attaque des alliés dans la zone.
 * Inverse : Malédiction, -1 au moral et -1 aux jets d'attaque.
 * Composant : Bénédiction consomme Eau bénite ; Malédiction consomme Eau maudite.
 */

const __add2eOnUseResult = await (async () => {
  const VERSION = "2026-06-21-benediction-derived-mode-v1";
  console.log(`%c[ADD2E][BENEDICTION] ${VERSION}`, "color:#b88924;font-weight:bold;");

  const ADD2E_CLERIC_CHAT = {
    main: "#b88924",
    dark: "#6f4b12",
    pale: "#fff7df",
    pale2: "#fffaf0",
    border: "#e2bc63",
    borderDark: "#8a611d",
    success: "#2f8f46",
    fail: "#b33a2e"
  };

  function add2eEscapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function add2eNormalize(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "_")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function add2eQuantity(item) {
    return Math.max(0, Math.floor(Number(item?.system?.quantite ?? item?.system?.quantity ?? 0) || 0));
  }

  function add2eSpellImg(src, fallback = "icons/magic/holy/prayer-hands-glowing-yellow.webp") {
    return add2eEscapeHtml(src || fallback);
  }

  function add2eClercCard({ caster, sourceItem, modeLabel, targetsLabel, resultHtml, componentName }) {
    const casterName = add2eEscapeHtml(caster?.name ?? "Lanceur");
    const spellName = add2eEscapeHtml(sourceItem?.name ?? "Bénédiction");
    return `
      <div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,${ADD2E_CLERIC_CHAT.pale2} 0%,${ADD2E_CLERIC_CHAT.pale} 100%);border:1.5px solid ${ADD2E_CLERIC_CHAT.border};overflow:hidden;padding:0;font-family:var(--font-primary);">
        <div style="background:linear-gradient(90deg,${ADD2E_CLERIC_CHAT.dark} 0%,${ADD2E_CLERIC_CHAT.main} 100%);padding:8px 12px;color:white;display:flex;align-items:center;gap:10px;border-bottom:2px solid ${ADD2E_CLERIC_CHAT.borderDark};">
          <img src="${add2eSpellImg(caster?.img, "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
          <div style="line-height:1.2;flex:1;">
            <div style="font-weight:bold;font-size:1.05em;">${casterName}</div>
            <div style="font-size:0.85em;opacity:0.95;">lance <b>${spellName}</b></div>
          </div>
          <img src="${add2eSpellImg(sourceItem?.img)}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
        </div>
        <div style="padding:10px;">
          <div style="margin-bottom:6px;font-size:0.95em;color:${ADD2E_CLERIC_CHAT.dark};"><b>Mode :</b> ${add2eEscapeHtml(modeLabel)}<br><b>Composant consommé :</b> ${add2eEscapeHtml(componentName)}<br><b>Cible(s) :</b> ${targetsLabel}</div>
          ${resultHtml}
          <details style="margin-top:8px;background:white;border:1px solid ${ADD2E_CLERIC_CHAT.border};border-radius:6px;">
            <summary style="cursor:pointer;color:${ADD2E_CLERIC_CHAT.dark};font-weight:600;padding:6px;">Règle appliquée</summary>
            <div style="padding:8px;font-size:0.85em;line-height:1.45;color:${ADD2E_CLERIC_CHAT.dark};">
              <div><b>Bénédiction</b> — Clerc niveau 1, conjuration/appel.</div>
              <div>Portée : 18 m ; zone d'effet : 5 × 5 ; durée : 6 rounds ; jet de sauvegarde : aucun.</div>
              <div>Effet : <b>+1 au moral</b> et <b>+1 aux jets d'attaque</b> des alliés dans la zone.</div>
              <div>Inverse : <b>Malédiction</b>, avec un malus de -1 au moral et aux jets d'attaque.</div>
            </div>
          </details>
        </div>
      </div>`;
  }

  function add2eEmitGmOperation(operation, payload) {
    if (!game.socket) return false;
    game.socket.emit("system.add2e", { type: "ADD2E_GM_OPERATION", operation, payload: { ...(payload ?? {}), fromUserId: game.user.id, sentAt: Date.now() } });
    return true;
  }

  async function add2eCreateEffectOnActor(targetActor, effectData) {
    if (!targetActor) return false;
    if (game.user.isGM || targetActor.isOwner) {
      const oldIds = targetActor.effects
        .filter(e => {
          const tags = e.flags?.add2e?.tags ?? [];
          return Array.isArray(tags) && (tags.includes("etat:benediction") || tags.includes("etat:malediction"));
        })
        .map(e => e.id);
      if (oldIds.length) await targetActor.deleteEmbeddedDocuments("ActiveEffect", oldIds);
      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return true;
    }
    const emitted = add2eEmitGmOperation("createActiveEffect", { actorUuid: targetActor.uuid, actorId: targetActor.id, effectData });
    if (!emitted) ui.notifications.error("Bénédiction : impossible de contacter le MJ pour créer l'effet actif.");
    return emitted;
  }

  function add2eDistanceMeters(tokenA, tokenB) {
    try {
      if (!tokenA || !tokenB) return 0;
      if (canvas.grid?.measurePath) {
        const result = canvas.grid.measurePath([tokenA.center, tokenB.center], { gridSpaces: true });
        return Number(result?.distance ?? result?.gridDistance ?? result) || 0;
      }
      const distance = canvas.grid.measureDistances([{ ray: new Ray(tokenA.center, tokenB.center) }], { gridSpaces: true })[0];
      return Number(distance) || 0;
    } catch (e) {
      console.warn("[ADD2E][BENEDICTION] mesure distance impossible", e);
      return 0;
    }
  }

  function add2eDurationData(rounds) {
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    return time?.durationData?.(rounds) ?? {
      rounds,
      startRound: game.combat?.round ?? null,
      startTurn: game.combat?.turn ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    };
  }

  function add2eTimeFlags({ sourceItem, caster, effectName, isCurse, durationRounds }) {
    const tags = isCurse
      ? ["etat:malediction", "malus_attaque:1", "malus_moral:1", "bonus_attaque:-1", "bonus_moral:-1"]
      : ["etat:benediction", "bonus_attaque:1", "bonus_moral:1"];
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    return time?.flags?.({
      source: "benediction.js",
      rounds: durationRounds,
      unit: "round",
      endMessage: isCurse ? "La malédiction de {actor} prend fin." : "La bénédiction de {actor} prend fin.",
      extra: {
        spellName: effectName,
        spellKey: isCurse ? "malediction" : "benediction",
        sourceItemUuid: sourceItem?.uuid ?? null,
        casterId: caster?.id ?? null,
        casterUuid: caster?.uuid ?? null,
        tags
      }
    }) ?? {
      timeEngine: { managed: true, unit: "round", totalRounds: durationRounds },
      roundEngine: { managed: true, unit: "round", totalRounds: durationRounds, endMessage: isCurse ? "La malédiction de {actor} prend fin." : "La bénédiction de {actor} prend fin." },
      endMessage: isCurse ? "La malédiction de {actor} prend fin." : "La bénédiction de {actor} prend fin.",
      spellName: effectName,
      spellKey: isCurse ? "malediction" : "benediction",
      sourceItemUuid: sourceItem?.uuid ?? null,
      casterId: caster?.id ?? null,
      casterUuid: caster?.uuid ?? null,
      tags
    };
  }

  async function add2eManualConsumeSelectedComponent(caster, componentName) {
    const wanted = add2eNormalize(componentName);
    const exactShared = "eau_benite_ou_maudite";
    const legacyShared = "eau_benite_maudite";

    const item = Array.from(caster?.items ?? []).find(i => {
      if (String(i?.type ?? "").toLowerCase() !== "objet") return false;
      const keys = [i.name, i.system?.nom, i.system?.slug, i.system?.composantSlug, i.system?.componentSlug]
        .map(add2eNormalize)
        .filter(Boolean);
      return keys.some(k => k === wanted || k === exactShared || k === legacyShared);
    }) ?? null;

    const before = add2eQuantity(item);
    if (!item || before < 1) {
      const msg = `${caster?.name ?? "Le lanceur"} n'a pas le composant requis : ${componentName} (1).`;
      ui.notifications.warn(msg);
      return { ok: false, blocked: true, consumed: [], message: msg };
    }

    const after = Math.max(0, before - 1);
    await item.update({ "system.quantite": after }, { add2eReason: "benediction-selected-component-exact" });
    console.log("[ADD2E][BENEDICTION][COMPONENT_EXACT_CONSUMED]", { componentName, item: item.name, before, after });
    return {
      ok: true,
      blocked: false,
      actorId: caster?.id,
      sortName: componentName,
      consumed: [{ itemId: item.id, itemName: item.name, before, after, quantity: 1, requirement: { name: componentName, key: wanted, quantity: 1 } }]
    };
  }

  async function add2eReserveSelectedComponent(caster, _sourceItem, componentName, _modeLabel) {
    return add2eManualConsumeSelectedComponent(caster, componentName);
  }

  let sourceItem = null;
  if (typeof sort !== "undefined" && sort) sourceItem = sort;
  else if (typeof item !== "undefined" && item) sourceItem = item;
  else if (typeof this !== "undefined" && this?.documentName === "Item") sourceItem = this;
  if (!sourceItem && typeof arguments !== "undefined" && arguments.length > 1 && arguments[1]?.name) sourceItem = arguments[1];
  if (!sourceItem) { ui.notifications.error("Bénédiction : sort introuvable."); return false; }

  const casterToken = canvas.tokens.controlled[0] ?? ((typeof token !== "undefined" && token) ? token : null);
  if (!casterToken) { ui.notifications.warn("Bénédiction : sélectionne le token du lanceur."); return false; }

  const caster = casterToken.actor ?? ((typeof actor !== "undefined" && actor) ? actor : sourceItem.parent);
  if (!caster) { ui.notifications.error("Bénédiction : lanceur introuvable."); return false; }

  const targets = Array.from(game.user.targets ?? []);
  if (!targets.length) { ui.notifications.warn("Bénédiction : cible au moins une créature dans la zone."); return false; }
  const invalidTargets = targets.filter(t => !t?.actor);
  if (invalidTargets.length) { ui.notifications.warn("Bénédiction : une cible n'a pas d'acteur."); return false; }

  const maxRange = 18;
  const outOfRange = targets.filter(t => add2eDistanceMeters(casterToken, t) > maxRange);
  if (outOfRange.length) { ui.notifications.warn(`Bénédiction : cible hors de portée (${outOfRange.map(t => t.name).join(", ")}).`); return false; }

  const reversibleMode = String(sourceItem.flags?.add2e?.reversibleActorEntry?.mode ?? "").trim().toLowerCase();
  const forcedMode = reversibleMode === "inverse" ? "malediction" : reversibleMode === "normal" ? "benediction" : "";
  const forcedModeLabel = forcedMode === "malediction" ? "Malédiction" : "Bénédiction";

  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2?.wait) { ui.notifications.error("Bénédiction : DialogV2 est requis."); return false; }

  const targetNamesHtml = targets.map(t => `<li>${add2eEscapeHtml(t.name)}</li>`).join("");
  const modeField = forcedMode
    ? `<div class="form-group"><label style="font-weight:bold;">Effet :</label><div style="padding:6px 0;">${add2eEscapeHtml(forcedModeLabel)}</div></div>`
    : `<div class="form-group"><label style="font-weight:bold;">Effet :</label><select name="mode" style="width:100%;"><option value="benediction">Bénédiction (+1 attaque, +1 moral)</option><option value="malediction">Malédiction (-1 attaque, -1 moral)</option></select></div>`;
  const dialogResult = await DialogV2.wait({
    window: { title: `Lancement : ${forcedMode ? forcedModeLabel : "Bénédiction"}` },
    add2eTheme: "cleric",
    add2eImg: sourceItem.img || "icons/magic/holy/prayer-hands-glowing-yellow.webp",
    content: `<form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">${modeField}<div style="font-size:0.9em;color:#666;border-top:1px solid #ddd;padding-top:6px;"><div><b>Durée :</b> 6 rounds</div><div><b>Portée :</b> 18 m</div><div><b>Cibles :</b></div><ul style="margin:4px 0 0 16px;padding:0;">${targetNamesHtml}</ul></div></form>`,
    buttons: [
      { action: "cast", label: "Lancer", icon: "fa-solid fa-hands-praying", default: true, callback: (_event, button) => ({ mode: forcedMode || String(button.form.elements.mode?.value || "benediction") }) },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });
  if (!dialogResult) return false;

  const mode = forcedMode || dialogResult.mode;
  const isCurse = mode === "malediction";
  const bonusValue = isCurse ? -1 : 1;
  const modeLabel = isCurse ? "Malédiction" : "Bénédiction";
  const componentName = isCurse ? "Eau maudite" : "Eau bénite";
  const effectName = modeLabel;
  const icon = sourceItem.img || (isCurse ? "icons/magic/control/debuff-energy-hold-pink.webp" : "icons/magic/holy/prayer-hands-glowing-yellow.webp");
  const durationRounds = 6;
  const tags = isCurse
    ? ["etat:malediction", "malus_attaque:1", "malus_moral:1", "bonus_attaque:-1", "bonus_moral:-1"]
    : ["etat:benediction", "bonus_attaque:1", "bonus_moral:1"];

  const componentReservation = await add2eReserveSelectedComponent(caster, sourceItem, componentName, modeLabel);
  if (componentReservation?.blocked) return false;

  async function refundSelectedComponent(reason = "") {
    if (!componentReservation?.consumed?.length) return false;
    const actorDoc = game.actors?.get(componentReservation.actorId) ?? caster;
    const entry = componentReservation.consumed[0];
    const item = actorDoc?.items?.get(entry.itemId);
    if (!item) return false;
    await item.update({ "system.quantite": entry.before }, { add2eReason: `benediction-selected-component-refund:${reason}` });
    console.log("[ADD2E][BENEDICTION][COMPONENT_REFUND]", { reason, componentName, item: item.name, before: entry.after, after: entry.before });
    return true;
  }

  function add2eAEAddChange(key, value, priority = 20) {
    if (CONST.ACTIVE_EFFECT_CHANGE_TYPES) return { key, type: "add", phase: "final", value: String(value), priority };
    return { key, mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: String(value), priority };
  }

  const effectData = {
    name: effectName,
    img: icon,
    origin: sourceItem.uuid,
    disabled: false,
    transfer: false,
    duration: add2eDurationData(durationRounds),
    description: isCurse ? "Malus de -1 au moral et aux jets d'attaque." : "Bonus de +1 au moral et aux jets d'attaque.",
    flags: {
      add2e: {
        ...add2eTimeFlags({ sourceItem, caster, effectName, isCurse, durationRounds }),
        tags
      }
    },
    changes: [add2eAEAddChange("system.bonus_attaque", bonusValue), add2eAEAddChange("system.bonus_moral", bonusValue)]
  };

  const applied = [];
  const failed = [];
  for (const targetToken of targets) {
    const ok = await add2eCreateEffectOnActor(targetToken.actor, foundry.utils.deepClone(effectData));
    if (ok) applied.push(targetToken);
    else failed.push(targetToken);
  }

  if (!applied.length) {
    await refundSelectedComponent("aucun effet applique");
    ui.notifications.error("Bénédiction : aucun effet n'a pu être appliqué.");
    return false;
  }

  const appliedHtml = applied.map(t => `<li>${add2eEscapeHtml(t.name)}</li>`).join("");
  const failedHtml = failed.length ? `<div style="margin-top:6px;color:${ADD2E_CLERIC_CHAT.fail};">Non appliqué : ${failed.map(t => add2eEscapeHtml(t.name)).join(", ")}</div>` : "";
  const resultHtml = `<div style="border:1px solid ${ADD2E_CLERIC_CHAT.border};background:#fffdf4;border-radius:6px;padding:8px;"><div style="text-align:center;font-weight:bold;color:${isCurse ? ADD2E_CLERIC_CHAT.fail : ADD2E_CLERIC_CHAT.success};">${add2eEscapeHtml(modeLabel.toUpperCase())} APPLIQUÉE</div><div style="margin-top:6px;color:${ADD2E_CLERIC_CHAT.dark};"><b>Effet :</b> ${bonusValue > 0 ? "+1" : "-1"} au moral et aux jets d'attaque.</div><div style="margin-top:6px;color:${ADD2E_CLERIC_CHAT.dark};"><b>Durée :</b> 6 rounds.</div><div style="margin-top:6px;color:${ADD2E_CLERIC_CHAT.dark};"><b>Créatures affectées :</b><ul style="margin:4px 0 0 16px;padding:0;">${appliedHtml}</ul></div>${failedHtml}</div>`;

  await globalThis.ADD2E_PLAY_SPELL_FX?.(isCurse ? "malediction" : "benediction", {
    casterToken,
    targetTokens: applied,
    launchOptions: isCurse
      ? { text: "MALÉDICTION", color: "#6a2d7a", size: 130, fontSize: 24, duration: 900, durationText: 1200 }
      : { text: "BÉNÉDICTION", color: "#ffd76a", size: 130, fontSize: 24, duration: 900, durationText: 1200 },
    targetOptions: isCurse
      ? { text: "−1", color: "#6a2d7a", size: 90, fontSize: 36, duration: 800, durationText: 1000 }
      : { text: "+1", color: "#ffd76a", size: 90, fontSize: 36, duration: 800, durationText: 1000 }
  });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: add2eClercCard({ caster, sourceItem, modeLabel, targetsLabel: applied.map(t => add2eEscapeHtml(t.name)).join(", "), resultHtml, componentName }),
    ...(CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 })
  });

  console.log("[ADD2E][benediction.js][ONUSE_RESULT]", true);
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT] Le script onUse doit retourner true/false.", { script: "benediction.js", result: __add2eOnUseResult });
  ui.notifications?.error?.("Bénédiction : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
