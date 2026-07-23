/**
 * ADD2E — Effets raciaux Kender et Insulte.
 * Compatible Foundry V13/V14/V15.
 */

window.applyKenderEffects = async function(actor, item) {
  const typeItem = item?.type || "race";
  const itemUuid = item.uuid || null;
  const itemName = item.name || typeItem;

  if (!actor) {
    ui.notifications.warn(`Aucun acteur ciblé pour appliquer les effets de la ${typeItem}.`);
    return;
  }

  console.log("[ADD2E][KENDER][EFFECTS_CURRENT]", {
    actor: actor.name,
    effects: actor.effects.contents.map(effect => ({ id: effect.id, name: effect.name, origin: effect.origin || null }))
  });

  const toDelete = [];
  for (const effect of actor.effects.contents) {
    const origin = effect.origin || "";
    const isOtherRaceOrigin = origin.startsWith("Actor.") && origin !== itemUuid;
    const isDuplicateName = (item.system?.effects || []).some(candidate => candidate.name === effect.name && origin !== itemUuid);
    if (isOtherRaceOrigin || isDuplicateName) toDelete.push(effect.id);
  }

  if (toDelete.length) await actor.deleteEmbeddedDocuments("ActiveEffect", toDelete);

  const effects = item.system?.effects || [];
  if (!Array.isArray(effects) || !effects.length) {
    ui.notifications.warn(`Aucun effet trouvé sur l’item ${itemName}. Vérifie le JSON de la race.`);
    return;
  }

  let count = 0;
  for (const effect of effects) {
    try {
      const exists = actor.effects.contents.some(current => current.name === effect.name && current.origin === itemUuid);
      if (exists) continue;

      const effectData = foundry.utils.deepClone(effect);
      effectData.img = effectData.img || effectData.icon || "icons/svg/aura.svg";
      delete effectData.icon;
      effectData.origin = itemUuid || null;

      const created = await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      if (created?.length) count += 1;
    } catch (error) {
      console.error("[ADD2E][KENDER][EFFECT_CREATE_ERROR]", { actor: actor.name, effect: effect?.name, error });
    }
  }

  if (count > 0) ui.notifications.info(`Traits kenders appliqués à ${actor.name}.`);
  else ui.notifications.info("Aucun nouveau trait kender à appliquer.");
};

window.kenderTaunt = async function(actor) {
  if (!actor) return ui.notifications.warn("Insulte kender : acteur introuvable.");

  const targets = Array.from(game.user?.targets ?? []).filter(target => target?.actor);
  if (targets.length !== 1) return ui.notifications.warn("Insulte kender : cible exactement une créature.");

  if (typeof globalThis.add2eRollSavingThrow !== "function") {
    return ui.notifications.error("Insulte kender : l’exécuteur canonique de sauvegardes est indisponible.");
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    return ui.notifications.error("Insulte kender : le constructeur commun des cartes de chat est indisponible.");
  }

  const targetToken = targets[0];
  const targetActor = targetToken.actor;
  const save = await globalThis.add2eRollSavingThrow(targetActor, 4, {
    source: "race:kender-taunt",
    actor,
    caster: actor,
    targetToken,
    frontale: true,
    createChat: false,
    showDice: true
  });
  if (!save?.ok) {
    return ui.notifications.warn(`Insulte kender : aucune sauvegarde contre les sortilèges pour ${targetActor.name}.`);
  }

  let durationRounds = 0;
  if (!save.success) {
    durationRounds = Number((await new Roll("1d10").evaluate()).total) || 1;
    await targetActor.createEmbeddedDocuments("ActiveEffect", [{
      name: "Enragé (Insulte Kender)",
      img: "icons/svg/explosion.svg",
      origin: actor.uuid,
      disabled: false,
      transfer: false,
      duration: {
        rounds: durationRounds,
        startRound: game.combat?.round ?? null,
        startTurn: game.combat?.turn ?? null,
        startTime: game.time?.worldTime ?? null,
        combat: game.combat?.id ?? null
      },
      description: "La cible doit attaquer le Kender, subit -2 au toucher et baisse sa garde.",
      changes: [
        { key: "system.bonus_toucher", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: -2, priority: 20 },
        { key: "system.ca_total", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: 2, priority: 20 }
      ],
      flags: {
        add2e: {
          tags: ["etat:enrage", "target:kender"],
          source: "race:kender-taunt",
          sourceActorUuid: actor.uuid,
          targetActorUuid: targetActor.uuid
        },
        core: { statusId: "enrage", overlay: true }
      }
    }]);
  }

  const applied = save.resolution?.bonusResolution?.applied ?? [];
  const modifierDetail = applied.length
    ? applied.map(entry => {
        const modifier = entry?.modifier ?? entry;
        const value = Number(modifier?.value) || 0;
        const label = modifier?.metadata?.label ?? modifier?.source?.name ?? "Modificateur";
        return `${label} ${value >= 0 ? "+" : ""}${value}`;
      }).join(" ; ")
    : "Aucun";

  const options = {
    actor,
    title: "Insulte Kender",
    icon: "fas fa-face-grin-tongue",
    variant: save.success ? "success" : "failure",
    source: {
      name: actor.name,
      img: actor.img,
      type: "Capacité raciale",
      meta: "Kender"
    },
    target: {
      name: targetActor.name,
      img: targetActor.img,
      type: "Sauvegarde contre les sortilèges",
      meta: save.resolution?.targetResolution?.selected?.className ?? save.resolution?.targetResolution?.source ?? ""
    },
    rows: [
      { label: "D20", value: save.d20 },
      { label: "Bonus de sauvegarde", value: `${save.bonus >= 0 ? "+" : ""}${save.bonus}` },
      { label: "Total", value: save.total },
      { label: "Seuil", value: save.target },
      { label: "Modificateurs", value: modifierDetail },
      { label: "Durée", value: save.success ? "Aucun effet" : `${durationRounds} round${durationRounds > 1 ? "s" : ""}` }
    ],
    message: save.success
      ? `${targetActor.name} reste de marbre face aux moqueries.`
      : `${targetActor.name} devient fou de rage et doit attaquer le Kender.`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [save.roll],
      flags: {
        add2e: {
          ability: "kender-taunt",
          saveType: save.resolution?.key,
          saveTarget: save.target,
          saveBonus: save.bonus,
          saveTotal: save.total,
          saveSuccess: save.success,
          saveResolverVersion: save.version,
          durationRounds,
          sourceActorUuid: actor.uuid,
          targetActorUuid: targetActor.uuid
        }
      }
    }
  };

  const preview = globalThis.add2eBuildChatCard(options);
  if (!String(preview ?? "").trim()) throw new Error("Insulte kender : carte de chat vide.");
  await globalThis.add2eCreateChatCard(options);
  return { ...save, durationRounds };
};
