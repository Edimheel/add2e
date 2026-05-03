/**
 * ADD2E — Soins mineurs (N1) — onUse (Joueur) — Compatible Hook Ready V13
 * - Choix : Soins (vert) / Blessure (violet)
 * - Soins : 1d8 PV (appliqué via applyDamage avec montant négatif)
 * - Blessure : JS (contre sorts par défaut) ; dégâts 1d8 uniquement si JS raté (montant positif)
 * - VFX : vert soins / violet dégâts
 * - Permissions : si pas owner => socket system.add2e (type: "applyDamage")
 *
 * Dépendances optionnelles : Sequencer + JB2A
 */

(async () => {
  const ITEM_NAME = "Soins mineurs";

  // ---------------------------
  // 0) Contexte
  // ---------------------------
  const sourceItem =
    (typeof item !== "undefined" && item?.name) ? item :
    (arguments?.length && arguments[0]?.item) ? arguments[0].item :
    (this?.name ? this : null);

  const casterActor =
    (typeof actor !== "undefined" && actor?.id) ? actor :
    (arguments?.length && arguments[0]?.actor) ? arguments[0].actor :
    sourceItem?.parent ?? null;

  if (!sourceItem || !casterActor) {
    ui.notifications.warn(`[${ITEM_NAME}] Contexte item/actor introuvable.`);
    return false;
  }

  // ---------------------------
  // 1) Cible (1 seule)
  // ---------------------------
  const targets = (() => {
    const t = Array.from(game.user?.targets ?? []);
    if (t.length) return t.map(tok => tok.actor).filter(Boolean);
    const wfTargets = arguments?.[0]?.targets ?? [];
    return wfTargets.map(t => t?.actor ?? t).filter(a => a?.id);
  })();

  if (!targets.length) {
    ui.notifications.warn(`[${ITEM_NAME}] Aucune cible sélectionnée.`);
    return false;
  }
  if (targets.length > 1) {
    ui.notifications.warn(`[${ITEM_NAME}] Ce sort gère 1 seule cible (touché).`);
    return false;
  }

  const targetActor = targets[0];
  const targetToken = canvas.tokens?.placeables?.find(t => t.actor?.id === targetActor.id);

  // ---------------------------
  // 2) Choix Soins / Blessure
  // ---------------------------
  const choice = await new Promise(resolve => {
    new Dialog({
      title: `${ITEM_NAME} — Choisir le mode`,
      content: `<p>Choisis la facette du sort :</p>`,
      buttons: {
        heal: { label: "Soins (vert)", callback: () => resolve("heal") },
        harm: { label: "Blessure (violet)", callback: () => resolve("harm") }
      },
      default: "heal",
      close: () => resolve(null)
    }).render(true);
  });
  if (!choice) return false;

  // ---------------------------
  // 3) Dice
  // ---------------------------
  const roll = await new Roll("1d8").evaluate();
  const amount = Number(roll.total) || 0;

  // ---------------------------
  // 4) Socket (réutilise ton système)
  // ---------------------------
  const canDirectUpdate = (a) => a?.isOwner === true;

  async function sendApplyDamageToGM(actorId, montant) {
    // Utilise le helper déjà installé dans ton ready hook si présent
    if (game.add2e?.requestGM) {
      game.add2e.requestGM({ type: "applyDamage", actorId, montant });
      return;
    }
    // fallback direct
    game.socket?.emit("system.add2e", { type: "applyDamage", actorId, montant });
  }

  // ---------------------------
  // 5) VFX
  // ---------------------------
  async function playEphemeralVFX(tint /* "green"|"violet" */) {
    const hasSequencer = !!game.modules.get("sequencer")?.active && typeof Sequence !== "undefined";
    if (hasSequencer && targetToken) {
      const file =
        tint === "green"
          ? "jb2a.healing_generic.200px.green"
          : "jb2a.energy_strands.range.standard.purple";

      try {
        await new Sequence()
          .effect()
          .atLocation(targetToken)
          .file(file)
          .scale(0.9)
          .opacity(0.9)
          .fadeIn(150)
          .fadeOut(250)
          .duration(1500)
          .play();
        return;
      } catch (e) {
        console.warn(`[${ITEM_NAME}] VFX Sequencer fallback.`, e);
      }
    }
    if (targetToken) canvas.pings?.ping(targetToken.center, { duration: 600, size: 1.2 });
  }

  // ---------------------------
  // 6) Application PV locale (owner) : schéma add2e + cap max
  // ---------------------------
  async function applyDeltaHPDirect(actorDoc, montant) {
    // Dans ton hook : hpPath = system.pdv ou system.points_de_coup
    const hpPath = actorDoc.system?.pdv !== undefined ? "system.pdv" : "system.points_de_coup";
    const maxPath = (hpPath === "system.pdv") ? "system.pdv_max" : "system.points_de_coup_max";

    const current = Number(foundry.utils.getProperty(actorDoc, hpPath)) || 0;
    let next = current - Number(montant); // même convention que ton hook (dégâts = +, soins = -)

    // Cap au max uniquement si soin (montant négatif => next monte)
    if (Number(montant) < 0) {
      let maxHp = Number(foundry.utils.getProperty(actorDoc, maxPath));

      // fallback si stocké en sous-champ .max
      if (!Number.isFinite(maxHp)) {
        const maxPath2 = (hpPath === "system.pdv") ? "system.pdv.max" : "system.points_de_coup.max";
        maxHp = Number(foundry.utils.getProperty(actorDoc, maxPath2));
      }

      if (Number.isFinite(maxHp)) next = Math.min(next, maxHp);
    }

    await actorDoc.update({ [hpPath]: next });
    return { hpPath, current, next };
  }

  // ---------------------------
  // 7) SOINS
  // ---------------------------
  if (choice === "heal") {
    await playEphemeralVFX("green");

    const montant = -amount; // soins => négatif (convention de ton hook)

    if (canDirectUpdate(targetActor)) {
      const res = await applyDeltaHPDirect(targetActor, montant);

      ChatMessage.create({
        content:
          `<b>${ITEM_NAME}</b> : ${casterActor.name} soigne ${targetActor.name} de <b>${amount}</b> PV. ` +
          `(Jet: ${roll.result})<br><small>PV: ${res.current} → ${res.next}</small>`
      });
    } else {
      await sendApplyDamageToGM(targetActor.id, montant);

      ChatMessage.create({
        content:
          `<b>${ITEM_NAME}</b> : ${casterActor.name} demande au MJ d’appliquer <b>${amount}</b> PV à ${targetActor.name}. ` +
          `(Jet: ${roll.result})`
      });
    }

    return true;
  }

  // ---------------------------
  // 8) BLESSURE : JS puis dégâts si raté
  // ---------------------------
  await playEphemeralVFX("violet");

  let saveSucceeded = false;

  try {
    // Tente de lire une valeur JS add2e si dispo (sinon fallback “raté” comme avant)
    // Tu peux ajuster le path si ton système expose un champ stable.
    const saveValue = foundry.utils.getProperty(targetActor, "system.saves.spells.value");

    if (typeof saveValue === "number") {
      const saveRoll = await new Roll("1d20").evaluate();
      saveSucceeded = (saveRoll.total <= saveValue);

      ChatMessage.create({
        content:
          `<b>${ITEM_NAME} (Blessure)</b> : ${targetActor.name} fait un JS contre sorts ` +
          `d20=${saveRoll.total} vs ${saveValue} → <b>${saveSucceeded ? "RÉUSSI" : "RATÉ"}</b>.`
      });
    } else {
      const saveRoll = await new Roll("1d20").evaluate();
      saveSucceeded = false;

      ChatMessage.create({
        content:
          `<b>${ITEM_NAME} (Blessure)</b> : JS non résolu automatiquement (valeur introuvable). ` +
          `Jet d20=${saveRoll.total}. Considéré <b>RATÉ</b> (fallback).`
      });
    }
  } catch (e) {
    console.warn(`[${ITEM_NAME}] Échec jet de sauvegarde, fallback raté.`, e);
    saveSucceeded = false;
  }

  if (saveSucceeded) {
    ChatMessage.create({ content: `<b>${ITEM_NAME} (Blessure)</b> : aucun dégât (JS réussi).` });
    return true;
  }

  // JS raté => dégâts (montant positif)
  const montant = amount;

  if (canDirectUpdate(targetActor)) {
    const res = await applyDeltaHPDirect(targetActor, montant);

    ChatMessage.create({
      content:
        `<b>${ITEM_NAME} (Blessure)</b> : ${casterActor.name} inflige <b>${amount}</b> dégâts à ${targetActor.name} (JS raté). ` +
        `(Jet: ${roll.result})<br><small>PV: ${res.current} → ${res.next}</small>`
    });
  } else {
    await sendApplyDamageToGM(targetActor.id, montant);

    ChatMessage.create({
      content:
        `<b>${ITEM_NAME} (Blessure)</b> : ${casterActor.name} demande au MJ d’appliquer <b>${amount}</b> dégâts à ${targetActor.name} (JS raté). ` +
        `(Jet: ${roll.result})`
    });
  }

  return true;
})();
