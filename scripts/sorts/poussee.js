/**
 * ADD2E — Sort Poussée.
 * Sauvegarde, carte de chat et compatibilité Foundry V13/V14/V15.
 */

const ADD2E_PUSH_VERSION = "2026-07-23-canonical-save-executor-v4";
console.log("[ADD2E][POUSSÉE][VERSION]", ADD2E_PUSH_VERSION);

return await (async () => {
  let sourceItem = null;
  if (typeof sort !== "undefined" && sort) sourceItem = sort;
  else if (typeof item !== "undefined" && item) sourceItem = item;
  else if (typeof this !== "undefined" && this?.documentName === "Item") sourceItem = this;

  if (!sourceItem) {
    ui.notifications.error("Poussée : source introuvable.");
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications.error("Poussée : lanceur introuvable.");
    return false;
  }

  const refund = async (reason = "") => {
    if (reason) ui.notifications.warn(reason);
    if (sourceItem.type !== "sort") {
      const currentGlobal = sourceItem.getFlag("add2e", "global_charges");
      if (currentGlobal !== undefined) {
        await sourceItem.setFlag("add2e", "global_charges", Number(currentGlobal || 0) + 1);
      }
    }
  };

  const targets = Array.from(game.user?.targets ?? []).filter(target => target?.actor);
  if (!targets.length) {
    await refund("Poussée : cible au moins une créature.");
    return false;
  }

  if (typeof globalThis.add2eRollSavingThrow !== "function") {
    await refund("Poussée : l’exécuteur canonique de sauvegardes est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    await refund("Poussée : le constructeur commun des cartes de chat est indisponible.");
    return false;
  }

  const casterLevel = sourceItem.type === "sort"
    ? Number(caster.system?.details_classe?.magicien?.niveau ?? caster.system?.niveau ?? 1) || 1
    : Number(sourceItem.system?.niveau ?? 6) || 6;
  const maxWeightKg = casterLevel * 25;
  const forceValue = casterLevel;
  const iconImg = sourceItem.img || "systems/add2e/assets/icones/sorts/poussee.webp";

  const preparedTargets = [];
  for (const targetToken of targets) {
    const save = await globalThis.add2eRollSavingThrow(targetToken.actor, 4, {
      source: "spell:poussee",
      sourceItem,
      caster,
      casterLevel,
      frontale: true,
      targetToken,
      createChat: false,
      showDice: true
    });
    if (!save?.ok) {
      await refund(`Poussée : aucune sauvegarde contre les sortilèges pour ${targetToken.actor.name}.`);
      return false;
    }
    preparedTargets.push({ targetToken, targetActor: targetToken.actor, save });
  }

  for (const { targetToken, targetActor, save } of preparedTargets) {
    const success = save.success;

    if (typeof Sequence !== "undefined") {
      new Sequence()
        .effect()
        .file("jb2a.gust_of_wind.very_fast.grey")
        .atLocation(caster)
        .stretchTo(targetToken)
        .missed(success)
        .effect()
        .file("jb2a.impact.004.blue")
        .atLocation(targetToken)
        .delay(200)
        .scale(0.5)
        .playIf(!success)
        .play()
        .catch(() => {});
    }

    if (!success) {
      const effectData = {
        name: "Déséquilibré (Poussée)",
        icon: iconImg,
        img: iconImg,
        origin: sourceItem.uuid,
        duration: { rounds: 1 },
        disabled: false,
        description: "La créature a perdu l'équilibre et ne peut pas attaquer ce round-ci.",
        flags: { add2e: { tags: ["stun", "incapacitated", "perturbe_equilibre"] } }
      };

      if (game.socket) {
        game.socket.emit("system.add2e", {
          type: "applyActiveEffect",
          actorId: targetActor.id,
          effectData
        });
      } else {
        await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      }
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

    const cardOptions = {
      actor: caster,
      title: sourceItem.name ?? "Poussée",
      icon: "fas fa-wind",
      variant: success ? "success" : "failure",
      source: {
        name: caster.name,
        img: caster.img,
        type: `Niveau ${casterLevel}`,
        meta: `Force ${forceValue} · cible < ${maxWeightKg} kg`
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
        { label: "Modificateurs", value: modifierDetail }
      ],
      message: success
        ? "La cible résiste et maintient son équilibre."
        : "La cible est déséquilibrée et perd sa prochaine attaque.",
      chatData: {
        speaker: ChatMessage.getSpeaker({ actor: caster }),
        rolls: [save.roll],
        flags: {
          add2e: {
            spell: "poussee",
            saveType: save.resolution?.key,
            saveTarget: save.target,
            saveBonus: save.bonus,
            saveTotal: save.total,
            saveSuccess: success,
            saveResolverVersion: save.version,
            sourceItemUuid: sourceItem.uuid,
            targetActorUuid: targetActor.uuid
          }
        }
      }
    };

    const preview = globalThis.add2eBuildChatCard(cardOptions);
    if (!String(preview ?? "").trim()) throw new Error("Poussée : carte de chat vide.");
    await globalThis.add2eCreateChatCard(cardOptions);
  }

  return true;
})();
