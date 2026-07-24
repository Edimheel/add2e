// ADD2E — onUse Illusionniste : Suggestion de masse
// Version : 2026-07-24-canonical-mental-save-v2
// Compatible Foundry V13/V14/V15 — DialogV2 uniquement.
// Contrat : true = sort consommé ; false = sort non consommé.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][ILLUSIONNISTE][SUGGESTION_DE_MASSE]";
  const sourceItem = (() => {
    if (typeof item !== "undefined" && item) return item;
    if (typeof sort !== "undefined" && sort) return sort;
    if (typeof spell !== "undefined" && spell) return spell;
    if (typeof args !== "undefined" && args?.[0]?.item) return args[0].item;
    return null;
  })();
  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem?.parent;
  const casterToken = (() => {
    if (typeof token !== "undefined" && token?.actor?.id === caster?.id) return token;
    return canvas.tokens?.controlled?.find(entry => entry.actor?.id === caster?.id)
      ?? caster?.getActiveTokens?.()[0]
      ?? null;
  })();

  const refund = async reason => {
    if (reason) ui.notifications.warn(reason);
    try {
      if (sourceItem?.type === "sort") return;
      const globalCharges = await sourceItem?.getFlag?.("add2e", "global_charges");
      if (globalCharges !== undefined) {
        await sourceItem.setFlag("add2e", "global_charges", Number(globalCharges) + 1);
        ui.notifications.info(`Charge restituée à ${sourceItem.name}.`);
        return;
      }
      if (sourceItem?.system?.isPower && sourceItem.system.sourceWeaponId) {
        const parentItem = caster?.items?.get(sourceItem.system.sourceWeaponId);
        const index = sourceItem.system.powerIndex;
        const charges = await parentItem?.getFlag?.("add2e", `charges_${index}`);
        if (parentItem && charges !== undefined) {
          await parentItem.setFlag("add2e", `charges_${index}`, Number(charges) + 1);
          ui.notifications.info("Charge restituée.");
        }
      }
    } catch (error) {
      console.warn(`${TAG}[REFUND_FAILED]`, error);
    }
  };

  if (!sourceItem || !caster) {
    ui.notifications.error("Suggestion de masse : source ou lanceur introuvable.");
    return false;
  }
  if (typeof globalThis.add2eRollSavingThrow !== "function") {
    await refund("Suggestion de masse : l’exécuteur canonique de sauvegardes est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    await refund("Suggestion de masse : le constructeur commun des cartes de chat est indisponible.");
    return false;
  }

  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    await refund("Suggestion de masse : DialogV2 est indisponible.");
    return false;
  }

  const casterLevel = (() => {
    const details = caster.system?.details_classe ?? {};
    const direct = Number(details.illusionniste?.niveau);
    if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
    const classItem = Array.from(caster.items ?? []).find(entry =>
      String(entry?.type ?? "").toLowerCase() === "classe"
      && /illusionniste/i.test(String(entry?.name ?? entry?.system?.label ?? ""))
    );
    return Math.max(1, Math.floor(Number(
      classItem?.system?.niveau
        ?? classItem?.system?.level
        ?? caster.system?.niveau
        ?? caster.system?.level
        ?? 1
    ) || 1));
  })();

  const targets = Array.from(game.user?.targets ?? []).filter(target => target?.actor);
  if (!targets.length) {
    await refund("Suggestion de masse exige au moins une cible.");
    return false;
  }
  if (targets.length > casterLevel) {
    await refund(`Suggestion de masse : ${targets.length} cibles sélectionnées, maximum ${casterLevel} au niveau actuel.`);
    return false;
  }

  const suggestion = await DialogV2.wait({
    window: { title: "Suggestion de masse", icon: "fas fa-comments" },
    modal: true,
    rejectClose: false,
    content: `
      <form class="add2e-mass-suggestion-form">
        <div class="form-group stacked">
          <label>Suggestion commune</label>
          <textarea name="suggestion" rows="5" required placeholder="Formulez la même suggestion pour toutes les cibles."></textarea>
          <p class="hint">La formulation doit pouvoir être comprise et rester raisonnable. Le MD demeure l’arbitre de sa validité.</p>
        </div>
        <div class="form-group">
          <label>Cibles</label>
          <div class="form-fields"><span>${targets.map(target => target.name).join(", ")}</span></div>
        </div>
      </form>`,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "fas fa-wand-magic-sparkles",
        default: true,
        callback: (_event, _button, dialog) => {
          const value = String(dialog.element?.querySelector('[name="suggestion"]')?.value ?? "").trim();
          if (!value) {
            ui.notifications.warn("La suggestion commune doit être formulée.");
            return false;
          }
          return value;
        }
      },
      { action: "cancel", label: "Annuler", icon: "fas fa-times", callback: () => null }
    ]
  });
  if (!suggestion || suggestion === false) {
    await refund("Suggestion de masse annulée.");
    return false;
  }

  const durationTurns = 4 + (4 * casterLevel);
  const durationRounds = durationTurns * 10;
  const singleTargetPenalty = targets.length === 1 ? -2 : 0;
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const endMessage = "La suggestion de masse affectant {actor} prend fin.";

  const effectDuration = time?.durationData?.(durationRounds) ?? {
    rounds: durationRounds,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };
  const effectFlags = targetActor => time?.flags?.({
    source: "illusionniste-suggestion-de-masse.js",
    rounds: durationRounds,
    unit: "round",
    endMessage,
    extra: {
      spell: "suggestion_de_masse",
      suggestion,
      sourceItemUuid: sourceItem.uuid ?? null,
      casterId: caster.id ?? null,
      casterUuid: caster.uuid ?? null,
      casterName: caster.name,
      targetId: targetActor.id ?? null,
      targetUuid: targetActor.uuid ?? null,
      tags: [
        "classe:illusionniste",
        "liste:illusionniste",
        "niveau:6",
        "sort:suggestion_de_masse",
        "mental",
        "enchantement",
        "charme",
        "suggestion",
        "etat:suggestion"
      ]
    }
  }) ?? {
    timeEngine: { managed: true, unit: "round", totalRounds: durationRounds },
    roundEngine: { managed: true, unit: "round", totalRounds: durationRounds, endMessage },
    endMessage,
    spell: "suggestion_de_masse",
    suggestion,
    sourceItemUuid: sourceItem.uuid ?? null,
    casterId: caster.id ?? null,
    casterUuid: caster.uuid ?? null,
    casterName: caster.name,
    targetId: targetActor.id ?? null,
    targetUuid: targetActor.uuid ?? null,
    tags: [
      "classe:illusionniste",
      "liste:illusionniste",
      "niveau:6",
      "sort:suggestion_de_masse",
      "mental",
      "enchantement",
      "charme",
      "suggestion",
      "etat:suggestion"
    ]
  };

  const applyEffect = async (targetToken, effectData) => {
    const targetActor = targetToken.actor;
    if (game.user?.isGM || targetActor.isOwner) {
      const existing = Array.from(targetActor.effects ?? []).filter(effect => effect.flags?.add2e?.spell === "suggestion_de_masse");
      if (existing.length) await targetActor.deleteEmbeddedDocuments("ActiveEffect", existing.map(effect => effect.id));
      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return true;
    }
    if (!game.socket) return false;
    game.socket.emit("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation: "createActiveEffect",
      payload: {
        actorUuid: targetActor.uuid,
        actorId: targetActor.id,
        sceneId: targetToken.document?.parent?.id ?? canvas.scene?.id,
        tokenId: targetToken.id,
        effectData,
        fromUserId: game.user?.id,
        sentAt: Date.now()
      }
    });
    return true;
  };

  const modifierDetails = save => {
    const applied = save?.resolution?.bonusResolution?.applied ?? [];
    return applied.length
      ? applied.map(entry => {
          const modifier = entry?.modifier ?? entry;
          const value = Number(modifier?.value) || 0;
          const label = modifier?.metadata?.label ?? modifier?.source?.name ?? "Modificateur";
          return `${label} ${value >= 0 ? "+" : ""}${value}`;
        }).join(" ; ")
      : "Aucun";
  };

  const results = [];
  for (const targetToken of targets) {
    const save = await globalThis.add2eRollSavingThrow(targetToken.actor, "sorts", {
      source: "spell:illusionniste_suggestion_de_masse",
      sourceItem,
      caster,
      casterToken,
      targetToken,
      frontale: true,
      mental: true,
      effectType: "suggestion",
      tags: ["mental", "enchantement", "charme", "suggestion", "suggestion_de_masse"],
      saveModifiers: singleTargetPenalty ? [{
        id: `${sourceItem.uuid ?? sourceItem.id}:single-target-penalty`,
        value: singleTargetPenalty,
        target: "suggestion",
        label: "Suggestion de masse sur une cible : −2",
        stacking: { mode: "stack", group: null },
        source: {
          kind: "spell",
          id: sourceItem.id ?? "suggestion_de_masse",
          uuid: sourceItem.uuid ?? "",
          name: sourceItem.name ?? "Suggestion de masse"
        }
      }] : [],
      createChat: false,
      showDice: true
    });
    if (!save?.ok) {
      await refund(`Suggestion de masse : aucune sauvegarde contre les sortilèges pour ${targetToken.name}.`);
      return false;
    }
    results.push({ targetToken, save, applied: false });
  }

  for (const result of results) {
    if (result.save.success) continue;
    const targetActor = result.targetToken.actor;
    const effectData = {
      name: "Suggestion de masse",
      img: sourceItem.img || "icons/magic/control/hypnosis-mesmerism-swirl.webp",
      origin: sourceItem.uuid ?? caster.uuid ?? null,
      disabled: false,
      transfer: false,
      duration: effectDuration,
      description: `Suggestion commune de ${caster.name} : ${suggestion}`,
      flags: { add2e: effectFlags(targetActor) },
      changes: []
    };
    result.applied = await applyEffect(result.targetToken, effectData);
    if (!result.applied) {
      ui.notifications.error(`Suggestion de masse : impossible d’appliquer l’effet à ${targetActor.name}.`);
      return false;
    }
  }

  const rows = results.flatMap(result => [
    { label: result.targetToken.name, value: result.save.success ? "Résiste" : "Suggestion appliquée" },
    {
      label: `${result.targetToken.name} · jet`,
      value: `d20 ${result.save.d20} ${result.save.bonus >= 0 ? "+" : ""}${result.save.bonus} = ${result.save.total} / ${result.save.target}`
    },
    { label: `${result.targetToken.name} · modificateurs`, value: modifierDetails(result.save) }
  ]);
  rows.push(
    { label: "Suggestion commune", value: suggestion },
    { label: "Cibles", value: `${targets.length} / ${casterLevel}` },
    { label: "Portée", value: "3 pouces AD&D" },
    { label: "Durée", value: `${durationTurns} tours / ${durationRounds} rounds` },
    { label: "Malus cible unique", value: singleTargetPenalty ? "−2" : "Non applicable" }
  );

  const options = {
    actor: caster,
    title: sourceItem.name || "Suggestion de masse",
    icon: "fas fa-comments",
    variant: results.some(result => !result.save.success) ? "failure" : "success",
    source: {
      name: caster.name,
      img: caster.img,
      type: "Enchantement / Charme",
      meta: `Illusionniste niveau ${casterLevel}`
    },
    rows,
    message: `${results.filter(result => !result.save.success).length} cible(s) suivent la suggestion ; ${results.filter(result => result.save.success).length} résistent.`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls: results.map(result => result.save.roll).filter(Boolean),
      flags: {
        add2e: {
          spell: "suggestion_de_masse",
          sourceItemUuid: sourceItem.uuid ?? null,
          suggestion,
          mentalAttack: true,
          durationTurns,
          durationRounds,
          targetLimit: casterLevel,
          singleTargetPenalty,
          targetResults: results.map(result => ({
            tokenId: result.targetToken.id,
            actorUuid: result.targetToken.actor?.uuid ?? null,
            d20: result.save.d20,
            bonus: result.save.bonus,
            total: result.save.total,
            target: result.save.target,
            success: result.save.success,
            effectApplied: result.applied,
            resolverVersion: result.save.version
          }))
        }
      }
    }
  };
  const preview = globalThis.add2eBuildChatCard(options);
  if (!String(preview ?? "").trim()) throw new Error("Suggestion de masse : carte de chat vide.");
  await globalThis.add2eCreateChatCard(options);
  return true;
})();