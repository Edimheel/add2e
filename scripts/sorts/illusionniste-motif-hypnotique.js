// ADD2E — onUse Illusionniste : Motif hypnotique
// Version : 2026-07-24-canonical-mental-save-v1
// Compatible Foundry V13/V14/V15.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][ILLUSIONNISTE][MOTIF_HYPNOTIQUE]";
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
    ui.notifications.error("Motif hypnotique : source ou lanceur introuvable.");
    return false;
  }
  if (typeof globalThis.add2eRollSavingThrow !== "function") {
    await refund("Motif hypnotique : l’exécuteur canonique de sauvegardes est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    await refund("Motif hypnotique : le constructeur commun des cartes de chat est indisponible.");
    return false;
  }

  const targets = Array.from(game.user.targets ?? []).filter(target => target?.actor);
  if (!targets.length) {
    await refund("Motif hypnotique exige au moins une cible présente dans la zone de 3 pouces sur 3 pouces.");
    return false;
  }

  const hitDice = targetActor => {
    const system = targetActor?.system ?? {};
    const candidates = [
      system.hitDice,
      system.hit_dice,
      system.dv,
      system.des_de_vie,
      system.niveau,
      system.level,
      system.details?.niveau,
      system.details?.level
    ];
    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null || candidate === "") continue;
      if (typeof candidate === "number" && Number.isFinite(candidate)) return Math.max(1, candidate);
      const match = String(candidate).match(/\d+(?:[.,]\d+)?/);
      if (match) return Math.max(1, Number(match[0].replace(",", ".")) || 1);
    }
    return 1;
  };
  const targetRows = targets.map(targetToken => ({
    targetToken,
    hitDice: hitDice(targetToken.actor)
  }));
  const totalHitDice = targetRows.reduce((sum, entry) => sum + entry.hitDice, 0);
  if (totalHitDice > 24) {
    await refund(`Motif hypnotique : les cibles totalisent ${totalHitDice} DV, au-delà de la limite de 24 DV.`);
    return false;
  }

  const applyEffect = async (targetToken, effectData) => {
    const targetActor = targetToken.actor;
    if (game.user.isGM || targetActor.isOwner) {
      const existing = targetActor.effects?.filter?.(effect => effect.flags?.add2e?.spell === "motif_hypnotique") ?? [];
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
    ui.notifications.error(`Socket ADD2E indisponible : impossible d’appliquer Motif hypnotique à ${targetActor.name}.`);
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
  for (const entry of targetRows) {
    const save = await globalThis.add2eRollSavingThrow(entry.targetToken.actor, 4, {
      source: "spell:illusionniste_motif_hypnotique",
      sourceItem,
      caster,
      casterToken,
      targetToken: entry.targetToken,
      frontale: true,
      mental: true,
      effectType: "hypnose",
      tags: ["mental", "illusion", "hypnose", "motif_hypnotique"],
      createChat: false,
      showDice: true
    });
    if (!save?.ok) {
      await refund(`Motif hypnotique : aucune sauvegarde contre les sortilèges pour ${entry.targetToken.name}.`);
      return false;
    }
    results.push({ ...entry, save });
  }

  for (const result of results) {
    if (result.save.success) continue;
    const effectData = {
      name: "Fasciné par un motif hypnotique",
      img: sourceItem.img || "icons/magic/control/hypnosis-mesmerism-swirl.webp",
      origin: sourceItem.uuid,
      disabled: false,
      transfer: false,
      duration: {},
      description: `La créature fixe le motif maintenu par ${caster.name}. L’effet cesse lorsque la concentration n’est plus maintenue.`,
      flags: {
        add2e: {
          spell: "motif_hypnotique",
          sourceId: caster.id,
          sourceUuid: caster.uuid ?? null,
          sourceName: caster.name,
          concentration: {
            required: true,
            casterId: caster.id,
            casterUuid: caster.uuid ?? null
          },
          breakRules: {
            onDamage: true,
            onConcentrationEnd: true
          },
          tags: [
            "classe:illusionniste", "liste:illusionniste", "niveau:2",
            "sort:motif_hypnotique", "mental", "illusion", "hypnose",
            "etat:fascine", "concentration"
          ]
        }
      }
    };
    const applied = await applyEffect(result.targetToken, effectData);
    if (!applied) return false;
  }

  const rows = results.flatMap(result => [
    { label: result.targetToken.name, value: result.save.success ? "Résiste" : "Fasciné" },
    { label: `${result.targetToken.name} · DV`, value: result.hitDice },
    {
      label: `${result.targetToken.name} · jet`,
      value: `d20 ${result.save.d20} ${result.save.bonus >= 0 ? "+" : ""}${result.save.bonus} = ${result.save.total} / ${result.save.target}`
    },
    { label: `${result.targetToken.name} · modificateurs`, value: modifierDetails(result.save) }
  ]);
  rows.push(
    { label: "Total de DV ciblés", value: `${totalHitDice} / 24` },
    { label: "Zone", value: "3 pouces × 3 pouces AD&D" },
    { label: "Durée", value: "Tant que la concentration est maintenue" }
  );

  const options = {
    actor: caster,
    title: sourceItem.name || "Motif hypnotique",
    icon: "fas fa-wave-square",
    variant: results.some(result => !result.save.success) ? "failure" : "success",
    source: {
      name: caster.name,
      img: caster.img,
      type: "Illusion / Fantasme",
      meta: "Attaque mentale · 24 DV maximum"
    },
    rows,
    message: `${results.filter(result => !result.save.success).length} cible(s) fixent le motif ; ${results.filter(result => result.save.success).length} résistent.`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls: results.map(result => result.save.roll).filter(Boolean),
      flags: {
        add2e: {
          spell: "motif_hypnotique",
          sourceItemUuid: sourceItem.uuid,
          mentalAttack: true,
          concentration: true,
          totalHitDice,
          hitDiceLimit: 24,
          targetResults: results.map(result => ({
            tokenId: result.targetToken.id,
            actorUuid: result.targetToken.actor?.uuid ?? null,
            hitDice: result.hitDice,
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
  if (!String(preview ?? "").trim()) throw new Error("Motif hypnotique : carte de chat vide.");
  await globalThis.add2eCreateChatCard(options);
  return true;
})();