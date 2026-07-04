// Charme-Personne.js — ADD2E corrigé
// Version : 2026-07-04-periodic-charm-save-v4
// Compatible : Sorts, Objets (Bâton, Anneau...)
// Retour attendu : true = consommé, false = non consommé.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][CHARME_PERSONNE]";
  const PERIODIC_VERSION = "2026-07-04-charm-person-periodic-saves-v1";

  const htmlEscape = (value) => {
    const div = document.createElement("div");
    div.innerText = String(value ?? "");
    return div.innerHTML;
  };

  const getSourceItem = () => {
    if (typeof sort !== "undefined" && sort) return sort;
    if (typeof item !== "undefined" && item) return item;
    if (typeof spell !== "undefined" && spell) return spell;
    if (typeof this !== "undefined" && this?.documentName === "Item") return this;
    return null;
  };

  const sourceItem = getSourceItem();
  if (!sourceItem) {
    ui.notifications.error("Script Charme : source introuvable.");
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications.error("Script Charme : lanceur introuvable.");
    return false;
  }

  const refund = async (raison = "") => {
    if (raison) ui.notifications.warn(raison);

    try {
      if (sourceItem.type === "sort") return;

      const currentGlobal = await sourceItem.getFlag?.("add2e", "global_charges");
      if (currentGlobal !== undefined) {
        await sourceItem.setFlag("add2e", "global_charges", Number(currentGlobal) + 1);
        ui.notifications.info(`Charge restituée à ${sourceItem.name}.`);
        return;
      }

      if (sourceItem.system?.isPower && sourceItem.system?.sourceWeaponId) {
        const pItem = caster.items?.get(sourceItem.system.sourceWeaponId);
        const idx = sourceItem.system.powerIndex;
        const c = pItem?.getFlag?.("add2e", `charges_${idx}`);
        if (pItem && c !== undefined) {
          await pItem.setFlag("add2e", `charges_${idx}`, Number(c) + 1);
          ui.notifications.info("Charge restituée.");
        }
      }
    } catch (e) {
      console.warn(`${TAG}[REFUND_FAILED]`, e);
    }
  };

  const targets = Array.from(game.user.targets ?? []);
  if (!targets.length) {
    await refund("Vous devez cibler une créature.");
    return false;
  }

  if (!game.add2eCharmeHooksRegistered) {
    game.add2eCharmeHooksRegistered = true;

    const endCharmeVfx = (effect) => {
      const label = String(effect?.label || effect?.name || "").toLowerCase();
      if (!label.includes("charmé") && !label.includes("charme")) return;

      const effActor = effect.parent;
      const tokens = effActor?.getActiveTokens?.() || [];
      for (const t of tokens) {
        try {
          if (typeof Sequencer !== "undefined") {
            Sequencer.EffectManager.endEffects({ name: `charme-effect-${t.id}`, object: t });
          }
        } catch (e) {
          console.warn(`${TAG}[VFX_END_FAILED]`, e);
        }
      }
    };

    Hooks.on("deleteActiveEffect", endCharmeVfx);
    Hooks.on("updateActiveEffect", (effect, changes) => {
      if (changes?.disabled === true) endCharmeVfx(effect);
    });
  }

  const getSagesse = (a) => Number(a?.system?.sagesse ?? a?.system?.sagesse_base ?? a?.system?.sag_aff ?? a?.system?.abilities?.wis?.value ?? 0) || 0;
  const getIntelligence = (a) => Number(a?.system?.intelligence ?? a?.system?.intelligence_base ?? a?.system?.int_aff ?? a?.system?.abilities?.int?.value ?? 0) || 0;

  const currentTimeTick = () => {
    const fromApi = game.add2e?.time?.currentTick?.() ?? globalThis.ADD2E_TIME_ENGINE?.currentTick?.();
    const value = Number(fromApi);
    if (Number.isFinite(value) && value >= 0) return Math.floor(value);

    try {
      const setting = Number(game.settings?.get?.("add2e", "worldTimeTick"));
      if (Number.isFinite(setting) && setting >= 0) return Math.floor(setting);
    } catch (_error) {}

    return 0;
  };

  const charmSaveInterval = (intelligence) => {
    const value = Math.max(0, Math.floor(Number(intelligence) || 0));
    if (value <= 3) return { days: 90, label: "3 mois" };
    if (value <= 6) return { days: 60, label: "2 mois" };
    if (value <= 9) return { days: 30, label: "1 mois" };
    if (value <= 12) return { days: 21, label: "3 semaines" };
    if (value <= 14) return { days: 14, label: "2 semaines" };
    if (value <= 16) return { days: 7, label: "1 semaine" };
    if (value === 17) return { days: 3, label: "3 jours" };
    if (value === 18) return { days: 2, label: "2 jours" };
    return { days: 1, label: "1 jour" };
  };

  const charmPeriodicSaveData = (targetActor) => {
    const intelligence = getIntelligence(targetActor);
    const interval = charmSaveInterval(intelligence);
    const hours = interval.days * 24;
    let intervalTicks = Number(game.add2e?.time?.toRounds?.(hours, "hour"));
    if (!Number.isFinite(intervalTicks) || intervalTicks <= 0) intervalTicks = interval.days * 24 * 60;
    intervalTicks = Math.max(1, Math.floor(intervalTicks));

    const createdAtTick = currentTimeTick();
    return {
      version: PERIODIC_VERSION,
      enabled: true,
      kind: "charme_personne",
      spellName: sourceItem.name,
      intelligence,
      intervalDays: interval.days,
      intervalLabel: interval.label,
      intervalTicks,
      createdAtTick,
      nextSaveTick: createdAtTick + intervalTicks,
      lastSaveTick: null,
      attempts: 0,
      calendarAssumption: "1 mois = 30 jours de temps ADD2E"
    };
  };

  const getSaveVsSpell = (a) => {
    const sys = a?.system ?? {};
    const direct = Number(sys.sauvegardes?.sorts ?? sys.saves?.spells ?? sys.save_spells ?? NaN);
    if (Number.isFinite(direct) && direct > 0) return direct;

    const lvl = Number(sys.niveau ?? sys.level ?? 1) || 1;
    const cls = a?.items?.find?.(i => i.type === "classe");
    const st = cls?.system?.progression?.[lvl - 1]?.savingThrows;
    if (Array.isArray(st) && st[4] !== undefined) {
      const v = Number(st[4]);
      if (Number.isFinite(v) && v > 0) return v;
    }

    return 15;
  };

  const rollSaveVsSpell = async (targetActor, wisdomBonus = 0) => {
    const engine = globalThis.Add2eEffectsEngine;
    const bonusWisdom = Number(wisdomBonus) || 0;

    if (typeof engine?.rollActionSave === "function") {
      const result = await engine.rollActionSave(targetActor, "sorts", bonusWisdom);
      if (result?.canRoll) {
        return {
          total: Number(result.total) || 0,
          threshold: Number(result.threshold) || getSaveVsSpell(targetActor),
          success: result.success === true,
          wisdomBonus: bonusWisdom,
          racialBonus: Number(result.racialBonus) || 0,
          usedEngine: true
        };
      }
    }

    // Le seuil historique de secours est conservé lorsque l'acteur ne possède
    // aucune valeur de sauvegarde exploitable. Le bonus racial reste appliqué.
    const threshold = getSaveVsSpell(targetActor);
    const racialBonus = Number(engine?.getSaveBonus?.(targetActor, "sorts")) || 0;
    const totalBonus = bonusWisdom + racialBonus;
    const formula = totalBonus ? `1d20${totalBonus >= 0 ? "+" : ""}${totalBonus}` : "1d20";
    const roll = await new Roll(formula).evaluate();
    if (game.dice3d) await game.dice3d.showForRoll(roll);
    const total = Number(roll.total) || 0;
    return {
      total,
      threshold,
      success: total >= threshold,
      wisdomBonus: bonusWisdom,
      racialBonus,
      usedEngine: false
    };
  };

  const saveBonusLabel = (save) => {
    const details = [];
    const wisdom = Number(save?.wisdomBonus) || 0;
    const racial = Number(save?.racialBonus) || 0;
    if (wisdom) details.push(`${wisdom >= 0 ? "+" : ""}${wisdom} Sag`);
    if (racial) details.push(`${racial >= 0 ? "+" : ""}${racial} racial`);
    return details.length ? `(${details.join(" ; ")})` : "";
  };

  const createOrSocketEffect = async (targetToken, effectData) => {
    const targetActor = targetToken.actor;
    if (!targetActor) return false;

    if (game.user.isGM) {
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

  const removeExistingCharm = async (targetActor) => {
    const existing = targetActor?.effects?.find?.(e =>
      e.name === "Charmé" ||
      String(e.name ?? "").toLowerCase().includes("charme") ||
      (e.flags?.add2e?.tags || []).includes("charme")
    );

    if (!existing) return;

    // Correction importante : on ne tente plus deux suppressions successives.
    // Hors MJ, la suppression directe provoque souvent une erreur de permission ActorDelta.
    if (game.user.isGM) await existing.delete();
  };

  const playCharmVfx = async (targetToken) => {
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
    } catch (e) {
      console.warn(`${TAG}[VFX_FAILED]`, e);
    }
  };

  const spellImg = sourceItem.img || "icons/svg/mystery-man.svg";
  const casterImg = caster.img || "icons/svg/mystery-man.svg";

  console.log(`${TAG}[START]`, {
    sort: sourceItem.name,
    caster: caster.name,
    targets: targets.map(t => t.name)
  });

  for (const targetToken of targets) {
    const targetActor = targetToken.actor;
    if (!targetActor) continue;

    let resistanceCharme = null;
    if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.checkResistanceDetails === "function") {
      resistanceCharme = Add2eEffectsEngine.checkResistanceDetails(targetActor, "charme", { chat: false });
    }

    if (resistanceCharme?.resiste) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: caster }),
        content: `
        <div class="add2e-spell-card" style="border-radius:12px;box-shadow:0 4px 10px #9b59b644;background:linear-gradient(135deg,#fff0fa 0%,#f3e5f5 100%);border:1.5px solid #9b59b6;margin:0.3em 0;padding:0;font-family:var(--font-primary);overflow:hidden;">
          <div style="background:linear-gradient(90deg,#8e44ad 0%,#9b59b6 100%);padding:8px 12px;display:flex;align-items:center;gap:10px;color:white;border-bottom:2px solid #6c3483;">
            <img src="${htmlEscape(casterImg)}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
            <div style="line-height:1.2;">
              <div style="font-weight:bold;font-size:1.05em;">${htmlEscape(caster.name)}</div>
              <div style="font-size:0.85em;opacity:0.9;">active <span style="font-weight:bold;color:#f1c40f;">${htmlEscape(sourceItem.name)}</span></div>
            </div>
            <img src="${htmlEscape(spellImg)}" style="width:32px;height:32px;margin-left:auto;border-radius:4px;background:#fff;">
          </div>
          <div style="padding:10px;">
            <div style="margin-bottom:5px;font-size:0.95em;color:#4a235a;"><b>Cible :</b> ${htmlEscape(targetActor.name)}</div>
            <div style="border:1px solid #1f8f3a;background:#eafaf1;padding:7px;border-radius:5px;text-align:center;margin-bottom:5px;">
              <div style="color:#1f8f3a;font-weight:bold;">RÉSISTANCE RACIALE RÉUSSIE</div>
              <div style="font-size:0.9em;">${htmlEscape(targetActor.name)} résiste au charme.</div>
              <div style="font-size:0.85em;margin-top:4px;">Chance : <b>${resistanceCharme.pct}%</b> — Jet d100 : <b>${resistanceCharme.jet}</b></div>
              <div style="font-size:0.85em;font-style:italic;margin-top:3px;">Le sort ne l’affecte pas.</div>
            </div>
          </div>
        </div>`
      });
      continue;
    }

    let resistanceLine = "";
    if (resistanceCharme?.found && !resistanceCharme?.resiste) {
      resistanceLine = `
        <div style="border:1px solid #d35400;background:#fff4e6;padding:5px;border-radius:5px;text-align:center;margin-bottom:5px;">
          <div style="color:#d35400;font-weight:bold;">Résistance raciale échouée</div>
          <div style="font-size:0.85em;">Chance : <b>${resistanceCharme.pct}%</b> — Jet d100 : <b>${resistanceCharme.jet}</b></div>
        </div>`;
    }

    const wis = getSagesse(targetActor);
    const wisBonus = wis >= 15 ? wis - 14 : 0;
    const save = await rollSaveVsSpell(targetActor, wisBonus);
    const success = save.success;
    const saveDetails = saveBonusLabel(save);
    let chatContent = "";

    if (success) {
      chatContent = `
        ${resistanceLine}
        <div style="border:1px solid #27ae60;background:#eafaf1;padding:5px;border-radius:5px;text-align:center;margin-bottom:5px;">
          <div style="color:#27ae60;font-weight:bold;">🛡️ RÉSISTE AU CHARME</div>
          <div style="font-size:0.9em;">Jet total : <b>${save.total}</b> ${saveDetails} vs <b>${save.threshold}</b></div>
        </div>`;
    } else {
      const periodicSave = charmPeriodicSaveData(targetActor);
      chatContent = `
        ${resistanceLine}
        <div style="border:1px solid #c0392b;background:#fdedec;padding:5px;border-radius:5px;text-align:center;margin-bottom:5px;">
          <div style="color:#c0392b;font-weight:bold;">💖 CHARMÉ !</div>
          <div style="font-size:0.9em;">Jet total : <b>${save.total}</b> ${saveDetails} vs <b>${save.threshold}</b></div>
          <div style="font-size:0.85em;font-style:italic;margin-top:3px;">La cible considère le lanceur comme son ami.</div>
          <div style="font-size:0.82em;margin-top:5px;color:#6c3483;">Nouveau jet de sauvegarde dans <b>${htmlEscape(periodicSave.intervalLabel)}</b> (Intelligence ${periodicSave.intelligence}).</div>
        </div>`;

      await removeExistingCharm(targetActor);

      const effectData = {
        name: "Charmé",
        img: "icons/svg/status/heart.svg",
        icon: "icons/svg/status/heart.svg",
        origin: sourceItem.uuid,
        duration: {},
        disabled: false,
        flags: {
          add2e: {
            tags: ["charme", "mental", "sort:charme_personne"],
            sourceId: caster.id,
            sourceUuid: caster.uuid ?? null,
            sourceName: caster.name,
            spellName: sourceItem.name,
            charmPeriodicSave: periodicSave
          }
        }
      };

      await createOrSocketEffect(targetToken, effectData);
      await playCharmVfx(targetToken);
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      content: `
      <div class="add2e-spell-card" style="border-radius:12px;box-shadow:0 4px 10px #9b59b644;background:linear-gradient(135deg,#fff0fa 0%,#f3e5f5 100%);border:1.5px solid #9b59b6;margin:0.3em 0;padding:0;font-family:var(--font-primary);overflow:hidden;">
        <div style="background:linear-gradient(90deg,#8e44ad 0%,#9b59b6 100%);padding:8px 12px;display:flex;align-items:center;gap:10px;color:white;border-bottom:2px solid #6c3483;">
          <img src="${htmlEscape(casterImg)}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
          <div style="line-height:1.2;">
            <div style="font-weight:bold;font-size:1.05em;">${htmlEscape(caster.name)}</div>
            <div style="font-size:0.85em;opacity:0.9;">active <span style="font-weight:bold;color:#f1c40f;">${htmlEscape(sourceItem.name)}</span></div>
          </div>
          <img src="${htmlEscape(spellImg)}" style="width:32px;height:32px;margin-left:auto;border-radius:4px;background:#fff;">
        </div>
        <div style="padding:10px;">
          <div style="margin-bottom:5px;font-size:0.95em;color:#4a235a;"><b>Cible :</b> ${htmlEscape(targetActor.name)}</div>
          ${chatContent}
        </div>
      </div>`
    });
  }

  return true;
})();