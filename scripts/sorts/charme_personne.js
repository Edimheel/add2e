// Charme-personne — ADD2E
// Version : 2026-07-04-generic-periodic-save-v7
// Compatible Foundry V13/V14/V15.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][CHARME_PERSONNE]";
  const PERIODIC_SAVE_VERSION = "2026-07-04-periodic-save-generic-v1";
  const escape = value => {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
  };
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
    } catch (error) { console.warn(`${TAG}[REFUND_FAILED]`, error); }
  };

  const targets = Array.from(game.user.targets ?? []);
  if (!targets.length) {
    await refund("Vous devez cibler une créature.");
    return false;
  }

  if (!game.add2eCharmeHooksRegistered) {
    game.add2eCharmeHooksRegistered = true;
    const stopVfx = effect => {
      const label = String(effect?.name ?? effect?.label ?? "").toLowerCase();
      if (!label.includes("charmé") && !label.includes("charme")) return;
      if (typeof Sequencer === "undefined") return;
      for (const token of effect?.parent?.getActiveTokens?.() ?? []) {
        try { Sequencer.EffectManager.endEffects({ name: `charme-effect-${token.id}`, object: token }); }
        catch (error) { console.warn(`${TAG}[VFX_END_FAILED]`, error); }
      }
    };
    Hooks.on("deleteActiveEffect", stopVfx);
    Hooks.on("updateActiveEffect", (effect, changed) => { if (changed?.disabled === true) stopVfx(effect); });
  }

  const ability = (targetActor, fields, key) => {
    const system = targetActor?.system ?? {};
    for (const field of fields) {
      const value = Number(system[field]);
      if (Number.isFinite(value)) return value;
    }
    return Number(system.abilities?.[key]?.value ?? 0) || 0;
  };
  const intelligence = targetActor => ability(targetActor, ["intelligence", "intelligence_base", "int_aff"], "int");
  const wisdom = targetActor => ability(targetActor, ["sagesse", "sagesse_base", "sag_aff"], "wis");
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
  const threshold = targetActor => {
    const system = targetActor?.system ?? {};
    const direct = Number(system.sauvegardes?.sorts ?? system.saves?.spells ?? system.save_spells ?? NaN);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const level = Number(system.niveau ?? system.level ?? 1) || 1;
    const classItem = targetActor?.items?.find?.(entry => entry.type === "classe");
    const value = Number(classItem?.system?.progression?.[level - 1]?.savingThrows?.[4]);
    return Number.isFinite(value) && value > 0 ? value : 15;
  };
  const rollSave = async targetActor => {
    const wisdomBonus = wisdom(targetActor) >= 15 ? wisdom(targetActor) - 14 : 0;
    const engine = globalThis.Add2eEffectsEngine;
    if (typeof engine?.rollActionSave === "function") {
      const result = await engine.rollActionSave(targetActor, "sorts", wisdomBonus);
      if (result?.canRoll) return { total: Number(result.total) || 0, threshold: Number(result.threshold) || threshold(targetActor), success: result.success === true, wisdomBonus, racialBonus: Number(result.racialBonus) || 0 };
    }
    const racialBonus = Number(engine?.getSaveBonus?.(targetActor, "sorts")) || 0;
    const modifier = wisdomBonus + racialBonus;
    const roll = await new Roll(`1d20${modifier >= 0 ? "+" : ""}${modifier}`).evaluate({ async: true });
    if (game.dice3d) await game.dice3d.showForRoll(roll);
    const total = Number(roll.total) || 0;
    const saveThreshold = threshold(targetActor);
    return { total, threshold: saveThreshold, success: total >= saveThreshold, wisdomBonus, racialBonus };
  };
  const saveDetails = save => {
    const values = [];
    if (save.wisdomBonus) values.push(`${save.wisdomBonus >= 0 ? "+" : ""}${save.wisdomBonus} Sag`);
    if (save.racialBonus) values.push(`${save.racialBonus >= 0 ? "+" : ""}${save.racialBonus} racial`);
    return values.length ? `(${values.join(" ; ")})` : "";
  };
  const card = (targetName, body) => `<div class="add2e-spell-card" style="border-radius:12px;box-shadow:0 4px 10px #9b59b644;background:linear-gradient(135deg,#fff0fa 0%,#f3e5f5 100%);border:1.5px solid #9b59b6;margin:0.3em 0;overflow:hidden;font-family:var(--font-primary);"><div style="background:linear-gradient(90deg,#8e44ad 0%,#9b59b6 100%);padding:8px 12px;display:flex;align-items:center;gap:10px;color:white;"><img src="${escape(caster.img || "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;"><div><div style="font-weight:bold;">${escape(caster.name)}</div><div style="font-size:.85em;">active <b>${escape(sourceItem.name)}</b></div></div><img src="${escape(sourceItem.img || "icons/svg/mystery-man.svg")}" style="width:32px;height:32px;margin-left:auto;border-radius:4px;background:#fff;"></div><div style="padding:10px;"><div style="margin-bottom:5px;color:#4a235a;"><b>Cible :</b> ${escape(targetName)}</div>${body}</div></div>`;
  const applyEffect = async (targetToken, effectData) => {
    const targetActor = targetToken.actor;
    if (game.user.isGM) { await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]); return true; }
    if (game.socket) {
      game.socket.emit("system.add2e", { type: "applyActiveEffect", actorId: targetActor.id, actorUuid: targetActor.uuid, sceneId: canvas.scene?.id, tokenId: targetToken.id, effectData });
      return true;
    }
    ui.notifications.error("Socket ADD2E indisponible : impossible d'appliquer l'effet Charmé.");
    return false;
  };
  const playVfx = async targetToken => {
    if (typeof Sequence === "undefined") return;
    try {
      if (typeof Sequencer !== "undefined") Sequencer.EffectManager.endEffects({ name: `charme-effect-${targetToken.id}`, object: targetToken });
      await new Sequence().effect().file("jb2a.cast_generic.02.blue").attachTo(targetToken).persist(true).name(`charme-effect-${targetToken.id}`).scaleToObject(1.5).opacity(0.8).belowTokens(false).play();
    } catch (error) { console.warn(`${TAG}[VFX_FAILED]`, error); }
  };

  for (const targetToken of targets) {
    const targetActor = targetToken.actor;
    if (!targetActor) continue;
    const resistance = globalThis.Add2eEffectsEngine?.checkResistanceDetails?.(targetActor, "charme", { chat: false }) ?? null;
    if (resistance?.resiste) {
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caster }), content: card(targetActor.name, `<div style="border:1px solid #1f8f3a;background:#eafaf1;padding:7px;border-radius:5px;text-align:center;"><b style="color:#1f8f3a;">RÉSISTANCE RACIALE RÉUSSIE</b><div>${escape(targetActor.name)} résiste au charme.</div><div style="font-size:.85em;">Chance : <b>${resistance.pct}%</b> — Jet d100 : <b>${resistance.jet}</b></div></div>`) });
      continue;
    }
    const racialLine = resistance?.found ? `<div style="border:1px solid #d35400;background:#fff4e6;padding:5px;border-radius:5px;text-align:center;margin-bottom:5px;"><b style="color:#d35400;">Résistance raciale échouée</b><div style="font-size:.85em;">Chance : <b>${resistance.pct}%</b> — Jet d100 : <b>${resistance.jet}</b></div></div>` : "";
    const save = await rollSave(targetActor);
    if (save.success) {
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caster }), content: card(targetActor.name, `${racialLine}<div style="border:1px solid #27ae60;background:#eafaf1;padding:7px;border-radius:5px;text-align:center;"><b style="color:#27ae60;">RÉSISTE AU CHARME</b><div>Jet total : <b>${save.total}</b> ${saveDetails(save)} vs <b>${save.threshold}</b></div></div>`) });
      continue;
    }
    const periodicSave = periodicSaveData(targetActor);
    if (game.user.isGM) {
      const existing = targetActor.effects?.find?.(effect => (effect.flags?.add2e?.tags ?? []).includes("charme"));
      if (existing) await existing.delete();
    }
    await applyEffect(targetToken, {
      name: "Charmé",
      img: "icons/svg/status/heart.svg",
      icon: "icons/svg/status/heart.svg",
      origin: sourceItem.uuid,
      duration: {},
      disabled: false,
      flags: { add2e: { tags: ["charme", "mental", "sort:charme_personne"], sourceId: caster.id, sourceUuid: caster.uuid ?? null, sourceName: caster.name, spellName: sourceItem.name, periodicSave } }
    });
    await playVfx(targetToken);
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caster }), content: card(targetActor.name, `${racialLine}<div style="border:1px solid #c0392b;background:#fdedec;padding:7px;border-radius:5px;text-align:center;"><b style="color:#c0392b;">CHARMÉ !</b><div>Jet total : <b>${save.total}</b> ${saveDetails(save)} vs <b>${save.threshold}</b></div><div style="font-style:italic;font-size:.85em;">La cible considère le lanceur comme son ami.</div><div style="font-size:.82em;margin-top:5px;color:#6c3483;"><b>Durée :</b> spéciale. Nouveau jet de sauvegarde dans <b>${escape(periodicSave.intervalLabel)}</b> (Intelligence ${periodicSave.chat.details[0].value}).</div></div>`) });
  }

  return true;
})();