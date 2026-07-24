// Charme-personne — ADD2E
// Version : 2026-07-24-canonical-mental-save-executor-v8
// Compatible Foundry V13/V14/V15.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][CHARME_PERSONNE]";
  const PERIODIC_SAVE_VERSION = "2026-07-04-periodic-save-generic-v1";
  const sourceItem = typeof sort !== "undefined" && sort
    ? sort
    : (typeof item !== "undefined" && item
      ? item
      : (typeof spell !== "undefined" && spell
        ? spell
        : (typeof this !== "undefined" && this?.documentName === "Item" ? this : null)));
  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem?.parent;
  if (!sourceItem || !caster) {
    ui.notifications.error("Charme-personne : source ou lanceur introuvable.");
    return false;
  }

  const refund = async reason => {
    if (reason) ui.notifications.warn(reason);
    try {
      if (sourceItem.type === "sort") return;
      const globalCharges = await sourceItem.getFlag?.("add2e", "global_charges");
      if (globalCharges !== undefined) {
        await sourceItem.setFlag("add2e", "global_charges", Number(globalCharges) + 1);
        ui.notifications.info(`Charge restituée à ${sourceItem.name}.`);
        return;
      }
      if (sourceItem.system?.isPower && sourceItem.system?.sourceWeaponId) {
        const parentItem = caster.items?.get(sourceItem.system.sourceWeaponId);
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

  const targets = Array.from(game.user.targets ?? []).filter(target => target?.actor);
  if (!targets.length) {
    await refund("Vous devez cibler une créature.");
    return false;
  }
  if (typeof globalThis.add2eRollSavingThrow !== "function") {
    await refund("Charme-personne : l’exécuteur canonique de sauvegardes est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    await refund("Charme-personne : le constructeur commun des cartes de chat est indisponible.");
    return false;
  }

  if (!game.add2eCharmeHooksRegistered) {
    game.add2eCharmeHooksRegistered = true;
    const stopVfx = effect => {
      const label = String(effect?.name ?? effect?.label ?? "").toLowerCase();
      if (!label.includes("charmé") && !label.includes("charme")) return;
      if (typeof Sequencer === "undefined") return;
      for (const token of effect?.parent?.getActiveTokens?.() ?? []) {
        try {
          Sequencer.EffectManager.endEffects({ name: `charme-effect-${token.id}`, object: token });
        } catch (error) {
          console.warn(`${TAG}[VFX_END_FAILED]`, error);
        }
      }
    };
    Hooks.on("deleteActiveEffect", stopVfx);
    Hooks.on("updateActiveEffect", (effect, changed) => {
      if (changed?.disabled === true) stopVfx(effect);
    });
  }

  const readAbility = (targetActor, fields, key) => {
    const system = targetActor?.system ?? {};
    for (const field of fields) {
      const value = Number(system[field]);
      if (Number.isFinite(value)) return value;
    }
    return Number(system.abilities?.[key]?.value ?? 0) || 0;
  };
  const intelligence = targetActor =>
    readAbility(targetActor, ["intelligence", "intelligence_base", "int_aff"], "int");
  const currentTick = () => {
    const fromApi = Number(game.add2e?.time?.currentTick?.() ?? globalThis.ADD2E_TIME_ENGINE?.currentTick?.());
    if (Number.isFinite(fromApi) && fromApi >= 0) return Math.floor(fromApi);
    try {
      const setting = Number(game.settings?.get?.("add2e", "worldTimeTick"));
      if (Number.isFinite(setting) && setting >= 0) return Math.floor(setting);
    } catch (_error) {}
    return 0;
  };
  const interval = value => {
    const score = Math.max(0, Math.floor(Number(value) || 0));
    if (score <= 3) return { days: 90, label: "3 mois" };
    if (score <= 6) return { days: 60, label: "2 mois" };
    if (score <= 9) return { days: 30, label: "1 mois" };
    if (score <= 12) return { days: 21, label: "3 semaines" };
    if (score <= 14) return { days: 14, label: "2 semaines" };
    if (score <= 16) return { days: 7, label: "1 semaine" };
    if (score === 17) return { days: 3, label: "3 jours" };
    if (score === 18) return { days: 2, label: "2 jours" };
    return { days: 1, label: "1 jour" };
  };
  const periodicSaveData = targetActor => {
    const score = intelligence(targetActor);
    const duration = interval(score);
    let ticks = Number(game.add2e?.time?.toRounds?.(duration.days * 24, "hour"));
    if (!Number.isFinite(ticks) || ticks <= 0) ticks = duration.days * 24 * 60;
    ticks = Math.max(1, Math.floor(ticks));
    const createdAtTick = currentTick();
    return {
      version: PERIODIC_SAVE_VERSION,
      enabled: true,
      kind: "saving-throw",
      sourceName: sourceItem.name,
      intervalDays: duration.days,
      intervalLabel: duration.label,
      intervalTicks: ticks,
      createdAtTick,
      nextSaveTick: createdAtTick + ticks,
      lastSaveTick: null,
      attempts: 0,
      calendarAssumption: "1 mois = 30 jours de temps ADD2E",
      save: {
        category: "sorts",
        label: "Sorts",
        context: { mental: true, effectType: "charme", source: "spell:charme_personne:periodic" },
        bonus: { mode: "score-minus", ability: "sagesse", minimum: 15, subtract: 14, label: "Sag" }
      },
      resolution: { onSuccess: "delete-effect", onFailure: "keep-effect" },
      cleanup: { sequencerEffectNames: ["charme-effect-{tokenId}"] },
      chat: {
        title: "Sauvegarde périodique",
        sourceName: sourceItem.name,
        successHeading: "CHARME ROMPU",
        failureHeading: "CHARME MAINTENU",
        successText: "{actor} réussit son jet et se libère du charme.",
        failureText: "{actor} reste charmé. Prochain jet dans {interval}.",
        details: [{ label: "Intelligence", value: score }]
      }
    };
  };

  const effectsEngine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  const applyEffect = async (targetToken, effectData) => {
    const targetActor = targetToken.actor;
    if (game.user.isGM || targetActor.isOwner) {
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
    ui.notifications.error("Socket ADD2E indisponible : impossible d'appliquer l'effet Charmé.");
    return false;
  };
  const playVfx = async targetToken => {
    if (typeof Sequence === "undefined") return;
    try {
      if (typeof Sequencer !== "undefined") {
        Sequencer.EffectManager.endEffects({ name: `charme-effect-${targetToken.id}`, object: targetToken });
      }
      await new Sequence()
        .effect()
        .file("jb2a.cast_generic.02.blue")
        .attachTo(targetToken)
        .persist(true)
        .name(`charme-effect-${targetToken.id}`)
        .scaleToObject(1.5)
        .opacity(0.8)
        .belowTokens(false)
        .play();
    } catch (error) {
      console.warn(`${TAG}[VFX_FAILED]`, error);
    }
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
  const createCard = async ({ targetActor, resistance, save = null, outcome, periodicSave = null }) => {
    const resistanceText = resistance?.found
      ? `${Number(resistance.pct) || 0}% · d100 ${Number(resistance.jet) || 0} · ${resistance.resiste ? "réussie" : "échouée"}`
      : "Aucune";
    const rows = [
      { label: "Cible", value: targetActor.name },
      { label: "Résistance raciale", value: resistanceText }
    ];
    if (save?.ok) {
      rows.push(
        { label: "D20", value: save.d20 },
        { label: "Bonus de sauvegarde", value: `${save.bonus >= 0 ? "+" : ""}${save.bonus}` },
        { label: "Total", value: save.total },
        { label: "Seuil", value: save.target },
        { label: "Modificateurs", value: modifierDetails(save) }
      );
    }
    if (periodicSave) {
      rows.push({
        label: "Prochaine sauvegarde",
        value: `${periodicSave.intervalLabel} · Intelligence ${periodicSave.chat.details[0].value}`
      });
    }

    const outcomeData = {
      racial: {
        variant: "success",
        message: `${targetActor.name} résiste au charme grâce à sa résistance raciale.`
      },
      saved: {
        variant: "success",
        message: `${targetActor.name} réussit sa sauvegarde mentale et résiste au charme.`
      },
      charmed: {
        variant: "failure",
        message: `${targetActor.name} est charmé et considère le lanceur comme son ami.`
      }
    }[outcome];

    const options = {
      actor: caster,
      title: sourceItem.name || "Charme-personne",
      icon: "fas fa-heart",
      variant: outcomeData.variant,
      source: {
        name: caster.name,
        img: caster.img,
        type: "Enchantement / Charme",
        meta: "Attaque mentale"
      },
      target: {
        name: targetActor.name,
        img: targetActor.img,
        type: "Créature",
        meta: save?.resolution?.targetResolution?.selected?.className
          ?? save?.resolution?.targetResolution?.source
          ?? ""
      },
      rows,
      message: outcomeData.message,
      chatData: {
        speaker: ChatMessage.getSpeaker({ actor: caster }),
        rolls: save?.roll ? [save.roll] : [],
        flags: {
          add2e: {
            spell: "charme_personne",
            sourceItemUuid: sourceItem.uuid,
            targetActorUuid: targetActor.uuid,
            outcome,
            resistanceFound: resistance?.found === true,
            resistancePercent: resistance?.pct ?? null,
            resistanceRoll: resistance?.jet ?? null,
            resistanceSuccess: resistance?.resiste === true,
            saveType: save?.resolution?.key ?? null,
            saveTarget: save?.target ?? null,
            saveBonus: save?.bonus ?? null,
            saveTotal: save?.total ?? null,
            saveSuccess: save?.success ?? null,
            saveMental: true,
            saveResolverVersion: save?.version ?? null,
            periodicSave: periodicSave ?? null
          }
        }
      }
    };
    const preview = globalThis.add2eBuildChatCard(options);
    if (!String(preview ?? "").trim()) throw new Error("Charme-personne : carte de chat vide.");
    await globalThis.add2eCreateChatCard(options);
  };

  const prepared = [];
  for (const targetToken of targets) {
    const targetActor = targetToken.actor;
    const resistance = effectsEngine?.checkResistanceDetails?.(targetActor, "charme", { chat: false }) ?? null;
    if (resistance?.resiste) {
      prepared.push({ targetToken, targetActor, resistance, save: null });
      continue;
    }

    const save = await globalThis.add2eRollSavingThrow(targetActor, 4, {
      source: "spell:charme_personne",
      sourceItem,
      caster,
      targetToken,
      frontale: true,
      mental: true,
      effectType: "charme",
      tags: ["mental", "charme"],
      createChat: false,
      showDice: true
    });
    if (!save?.ok) {
      await refund(`Charme-personne : aucune sauvegarde contre les sortilèges pour ${targetActor.name}.`);
      return false;
    }
    prepared.push({ targetToken, targetActor, resistance, save });
  }

  for (const entry of prepared) {
    const { targetToken, targetActor, resistance, save } = entry;
    if (resistance?.resiste) {
      await createCard({ targetActor, resistance, outcome: "racial" });
      continue;
    }
    if (save.success) {
      await createCard({ targetActor, resistance, save, outcome: "saved" });
      continue;
    }

    const periodicSave = periodicSaveData(targetActor);
    if (game.user.isGM || targetActor.isOwner) {
      const existing = targetActor.effects?.find?.(effect =>
        (effect.flags?.add2e?.tags ?? []).includes("charme")
      );
      if (existing) await existing.delete();
    }
    const applied = await applyEffect(targetToken, {
      name: "Charmé",
      img: "icons/svg/status/heart.svg",
      origin: sourceItem.uuid,
      duration: {},
      disabled: false,
      transfer: false,
      flags: {
        add2e: {
          tags: ["charme", "mental", "sort:charme_personne"],
          sourceId: caster.id,
          sourceUuid: caster.uuid ?? null,
          sourceName: caster.name,
          spellName: sourceItem.name,
          periodicSave
        }
      }
    });
    if (!applied) return false;
    await playVfx(targetToken);
    await createCard({ targetActor, resistance, save, outcome: "charmed", periodicSave });
  }

  return true;
})();
