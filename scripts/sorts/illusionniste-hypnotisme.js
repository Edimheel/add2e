// ADD2E — onUse Illusionniste : Hypnotisme
// Version : 2026-07-24-canonical-mental-save-v1
// Compatible Foundry V13/V14/V15 — DialogV2 uniquement.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][ILLUSIONNISTE][HYPNOTISME]";
  const sourceItem = typeof item !== "undefined" && item
    ? item
    : (typeof sort !== "undefined" && sort
      ? sort
      : (typeof spell !== "undefined" && spell ? spell : null));
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
    ui.notifications.error("Hypnotisme : source ou lanceur introuvable.");
    return false;
  }
  if (typeof globalThis.add2eRollSavingThrow !== "function") {
    await refund("Hypnotisme : l’exécuteur canonique de sauvegardes est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    await refund("Hypnotisme : le constructeur commun des cartes de chat est indisponible.");
    return false;
  }

  const targets = Array.from(game.user.targets ?? []).filter(target => target?.actor);
  if (targets.length < 1 || targets.length > 6) {
    await refund("Hypnotisme exige de cibler entre une et six créatures.");
    return false;
  }

  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    await refund("Hypnotisme : DialogV2 est indisponible.");
    return false;
  }
  const suggestion = await DialogV2.wait({
    window: { title: "Hypnotisme", icon: "fas fa-eye" },
    modal: true,
    rejectClose: false,
    content: `
      <form class="add2e-hypnotisme-form">
        <div class="form-group stacked">
          <label>Suggestion formulée</label>
          <textarea name="suggestion" rows="4" required placeholder="Décrivez la suggestion donnée aux créatures hypnotisées."></textarea>
          <p class="hint">La réussite du sort n’est révélée qu’après que la suggestion a été formulée.</p>
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
            ui.notifications.warn("La suggestion doit être formulée.");
            return false;
          }
          return value;
        }
      },
      { action: "cancel", label: "Annuler", icon: "fas fa-times", callback: () => null }
    ]
  });
  if (!suggestion || suggestion === false) {
    await refund("Hypnotisme annulé.");
    return false;
  }

  const level = (() => {
    const details = caster.system?.details_classe ?? {};
    const direct = Number(details.illusionniste?.niveau);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const classItem = caster.items?.find?.(entry =>
      String(entry.type).toLowerCase() === "classe" && /illusionniste/i.test(entry.name ?? "")
    );
    return Math.max(1, Number(classItem?.system?.niveau ?? classItem?.system?.level ?? caster.system?.niveau ?? 1) || 1);
  })();
  const durationRounds = 1 + level;

  const applyEffect = async (targetToken, effectData) => {
    const targetActor = targetToken.actor;
    if (game.user.isGM || targetActor.isOwner) {
      const existing = targetActor.effects?.filter?.(effect => effect.flags?.add2e?.spell === "hypnotisme") ?? [];
      for (const effect of existing) await effect.delete();
      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return true;
    }
    if (game.socket) {
      game.socket.emit("system.add2e", {
        type: "applyActiveEffect",
        actorId: targetActor.id,
        actorUuid: targetActor.uuid,
        sceneId: canvas.scene?.id,
        tokenId: targetToken.id,
        effectData
      });
      return true;
    }
    ui.notifications.error(`Socket ADD2E indisponible : impossible d’appliquer Hypnotisme à ${targetActor.name}.`);
    return false;
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
    const save = await globalThis.add2eRollSavingThrow(targetToken.actor, 4, {
      source: "spell:illusionniste_hypnotisme",
      sourceItem,
      caster,
      casterToken,
      targetToken,
      frontale: true,
      mental: true,
      effectType: "hypnose",
      tags: ["mental", "hypnose", "hypnotisme", "suggestion"],
      createChat: false,
      showDice: true
    });
    if (!save?.ok) {
      await refund(`Hypnotisme : aucune sauvegarde contre les sortilèges pour ${targetToken.name}.`);
      return false;
    }
    results.push({ targetToken, save });
  }

  for (const result of results) {
    if (result.save.success) continue;
    const effectData = {
      name: "Hypnotisé",
      img: sourceItem.img || "icons/magic/control/hypnosis-mesmerism-eye.webp",
      origin: sourceItem.uuid,
      disabled: false,
      transfer: false,
      duration: {
        rounds: durationRounds,
        startRound: game.combat?.round ?? null,
        startTime: game.time?.worldTime ?? null,
        combat: game.combat?.id ?? null
      },
      description: `Suggestion formulée par ${caster.name} : ${suggestion}`,
      flags: {
        add2e: {
          spell: "hypnotisme",
          sourceId: caster.id,
          sourceUuid: caster.uuid ?? null,
          sourceName: caster.name,
          suggestion,
          tags: [
            "classe:illusionniste", "liste:illusionniste", "niveau:1",
            "sort:hypnotisme", "mental", "hypnose", "etat:hypnotise", "suggestion"
          ]
        }
      }
    };
    const applied = await applyEffect(result.targetToken, effectData);
    if (!applied) return false;
  }

  const rows = results.flatMap(result => [
    { label: result.targetToken.name, value: result.save.success ? "Résiste" : "Hypnotisé" },
    {
      label: `${result.targetToken.name} · jet`,
      value: `d20 ${result.save.d20} ${result.save.bonus >= 0 ? "+" : ""}${result.save.bonus} = ${result.save.total} / ${result.save.target}`
    },
    { label: `${result.targetToken.name} · modificateurs`, value: modifierDetails(result.save) }
  ]);
  rows.push(
    { label: "Suggestion", value: suggestion },
    { label: "Durée", value: `${durationRounds} rounds` },
    { label: "Portée de règle", value: "3 pouces AD&D" }
  );

  const options = {
    actor: caster,
    title: sourceItem.name || "Hypnotisme",
    icon: "fas fa-eye",
    variant: results.some(result => !result.save.success) ? "failure" : "success",
    source: {
      name: caster.name,
      img: caster.img,
      type: "Enchantement / Charme",
      meta: "Attaque mentale · Illusionniste"
    },
    rows,
    message: `${results.filter(result => !result.save.success).length} cible(s) sont hypnotisées ; ${results.filter(result => result.save.success).length} résistent.`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls: results.map(result => result.save.roll).filter(Boolean),
      flags: {
        add2e: {
          spell: "hypnotisme",
          sourceItemUuid: sourceItem.uuid,
          suggestion,
          mentalAttack: true,
          durationRounds,
          targetResults: results.map(result => ({
            tokenId: result.targetToken.id,
            actorUuid: result.targetToken.actor?.uuid ?? null,
            d20: result.save.d20,
            bonus: result.save.bonus,
            total: result.save.total,
            target: result.save.target,
            success: result.save.success,
            resolverVersion: result.save.version
          }))
        }
      }
    }
  };
  const preview = globalThis.add2eBuildChatCard(options);
  if (!String(preview ?? "").trim()) throw new Error("Hypnotisme : carte de chat vide.");
  await globalThis.add2eCreateChatCard(options);
  return true;
})();