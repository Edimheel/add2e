// ADD2E — Effects Engine / progression et capacités du moine.
// Extraction fonctionnelle sans changement de règle.

const register = (Engine, methods) => Object.defineProperties(
  Engine,
  Object.fromEntries(Object.entries(methods).map(([name, value]) => [
    name,
    { value, configurable: true, writable: true }
  ]))
);

export function installEffectsEngineMonk(Engine) {
  register(Engine, {
    getMonkClassItem(actor) {
      return this.getEmbeddedClassItems(actor).find(item => {
        const system = item?.system ?? {};
        const label = this.normalizeKey(system?.label || system?.slug || system?.nom || system?.name || item?.name || "");
        const tags = this.toArray(system?.tags).map(tag => this.normalizeTag(tag));
        return label.includes("moine") || tags.includes("classe:moine") || tags.includes("classe_moine");
      }) ?? null;
    },

    getActorClassSystem(actor) {
      return this.getMonkClassItem(actor)?.system
        ?? actor?.items?.find?.(item => String(item.type || "").toLowerCase() === "classe")?.system
        ?? actor?.system?.details_classe
        ?? null;
    },

    isMonk(actor) {
      const monk = this.getMonkClassItem(actor);
      if (monk) return true;
      const classSystem = this.getActorClassSystem(actor);
      const label = this.normalizeKey(
        classSystem?.label || classSystem?.name || classSystem?.nom || actor?.system?.classe || ""
      );
      return label.includes("moine") || this.hasTag(actor, "classe:moine");
    },

    getClassProgressionEntry(actor, field = "progression") {
      const classSystem = this.getActorClassSystem(actor);
      const classItem = this.getMonkClassItem(actor) ?? this.getEmbeddedClassItems(actor)[0] ?? null;
      const level = this.getEmbeddedClassLevel(classItem) ?? this.getActorLevel(actor);
      const progression = classSystem?.[field] ?? classSystem?.progression ?? [];
      if (!Array.isArray(progression) || !progression.length) return null;
      return progression.find(entry => Number(entry?.niveau ?? entry?.level) === level)
        ?? progression[Math.max(0, Math.min(progression.length - 1, level - 1))]
        ?? null;
    },

    getMonkProgression(actor) {
      if (!this.isMonk(actor)) return null;
      const monk = this.getMonkClassItem(actor);
      if (monk) {
        const level = this.getEmbeddedClassLevel(monk);
        const rule = {
          progression: Array.isArray(monk.system?.monkProgression) && monk.system.monkProgression.length ? "monkProgression" : "progression",
          source: {
            actor,
            classItemId: monk.id,
            classItemUuid: monk.uuid,
            className: monk.name,
            classLevel: level
          }
        };
        return this.getClassProgressionEntryForPassiveRule(rule, { actor }) ?? null;
      }
      return this.getClassProgressionEntry(actor, "monkProgression") ?? this.getClassProgressionEntry(actor, "progression");
    },

    getMonkArmorClass(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.monkAC ?? progression?.caMoine ?? progression?.ca_moine);
      return Number.isFinite(value) ? value : null;
    },

    getMonkMove(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.move ?? progression?.movement ?? progression?.mouvement ?? progression?.monkMove ?? progression?.monkMovement);
      return Number.isFinite(value) ? value : null;
    },

    getMonkOpenDoors(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.openDoors ?? progression?.ouvrir_portes);
      return Number.isFinite(value) ? value : null;
    },

    getMonkUnarmedDamage(actor) {
      const progression = this.getMonkProgression(actor);
      return String(progression?.unarmedDamage ?? progression?.main_nue ?? progression?.degatsMainNue ?? progression?.damage ?? "").trim();
    },

    getMonkUnarmedDamageParts(actor) {
      let raw = this.getMonkUnarmedDamage(actor);
      if (raw && typeof raw === "object") raw = raw.raw ?? raw.value ?? raw.contre_moyen ?? raw.medium ?? raw.moyen;
      const parts = String(raw || "1d6/1d3").split(/[\/|]/).map(part => part.trim()).filter(Boolean);
      const moyen = parts[0] || "1d6";
      const grand = parts[1] || moyen;
      return { raw: `${moyen} / ${grand}`, compact: `${moyen}/${grand}`, moyen, grand };
    },

    getMonkAttacksPerRound(actor) {
      const progression = this.getMonkProgression(actor);
      return String(progression?.attacksPerRound ?? progression?.attaquesParRound ?? progression?.attaques_par_round ?? "").trim();
    },

    getMonkStunParalyze(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.unarmedStunMargin ?? progression?.stunMargin ?? progression?.stunParalyze ?? progression?.etourdissement ?? progression?.paralysie);
      return Number.isFinite(value) ? value : 0;
    },

    getMonkSlowFall(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.slowFall ?? progression?.chute_ralentie);
      return Number.isFinite(value) ? value : 0;
    },

    getMonkSlowFallText(actor) {
      const progression = this.getMonkProgression(actor);
      const text = String(progression?.slowFallText ?? progression?.chuteRalentieTexte ?? progression?.chute_ralentie_texte ?? "").trim();
      if (text) return text;
      const value = this.getMonkSlowFall(actor);
      return value > 0 ? `${value} m si à proximité d’un mur` : "—";
    },

    getMonkSelfHealPerDay(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.selfHealPerDay ?? progression?.auto_soin);
      return Number.isFinite(value) ? value : 0;
    },

    getMonkWeaponDamageBonus(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.monkWeaponDamageBonus ?? progression?.bonusDegatsArme ?? progression?.bonus_degats_arme);
      return Number.isFinite(value) ? value : (this.isMonk(actor) ? Math.floor((this.getEmbeddedClassLevel(this.getMonkClassItem(actor)) ?? this.getActorLevel(actor)) / 2) : 0);
    },

    hasMonkDiseaseImmunity(actor) {
      return this.hasImmunity(actor, "maladie");
    },

    getMonkProgressionTags(actor) {
      const progression = this.getMonkProgression(actor);
      return progression ? this.toArray(progression.tags).map(tag => this.normalizeTag(tag)).filter(Boolean) : [];
    },

    getMonkResistCharmSuggestion(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.resistCharmSuggestion ?? progression?.resistance_charme_suggestion);
      return Number.isFinite(value) ? value : 0;
    },

    getMonkResistESP(actor) {
      const progression = this.getMonkProgression(actor);
      const value = Number(progression?.resistESP ?? progression?.resistance_esp);
      return Number.isFinite(value) ? value : 0;
    },

    hasMonkQuiveringPalm(actor) {
      const progression = this.getMonkProgression(actor);
      return !!progression?.quiveringPalm
        || this.hasTag(actor, "moine:paume_palpitante")
        || this.hasTag(actor, "paume_palpitante");
    },

    getMonkMartialProgression(actor) {
      const progression = this.getMonkProgression(actor);
      if (!progression) return null;
      const damage = this.getMonkUnarmedDamageParts(actor);
      const classItem = this.getMonkClassItem(actor);
      const level = this.getEmbeddedClassLevel(classItem) ?? this.getActorLevel(actor);
      return {
        level,
        title: progression.title ?? "",
        armorClass: this.getMonkArmorClass(actor),
        move: this.getMonkMove(actor),
        openDoors: this.getMonkOpenDoors(actor),
        unarmedDamage: damage.raw,
        unarmedDamageCompact: damage.compact,
        unarmedDamageMedium: damage.moyen,
        unarmedDamageLarge: damage.grand,
        weaponDamageBonus: this.getMonkWeaponDamageBonus(actor),
        attacksPerRound: this.getMonkAttacksPerRound(actor) || "1",
        stunParalyze: this.getMonkStunParalyze(actor),
        slowFall: this.getMonkSlowFall(actor),
        slowFallText: this.getMonkSlowFallText(actor),
        source: {
          classItemId: classItem?.id ?? null,
          classItemUuid: classItem?.uuid ?? null,
          className: classItem?.name ?? "Moine"
        }
      };
    },

    isMonkUnarmedWeapon(weapon) {
      const system = weapon?.system ?? {};
      const values = [
        weapon?.name,
        system.nom,
        system.type_arme,
        system.famille_arme,
        system.categorie,
        system.sourceCapacite,
        system.tags,
        system.effectTags,
        weapon?.flags?.add2e?.tags,
        weapon?.flags?.add2e?.sourceCapacite
      ];
      const tags = new Set();
      for (const value of values) this.addTagsInto(tags, value);
      const normalized = [...tags].map(tag => this.normalizeTag(tag));
      return normalized.includes("main_nue")
        || normalized.includes("arme:main_nue")
        || normalized.includes("type_arme:main_nue")
        || normalized.includes("famille_arme:main_nue")
        || normalized.includes("combat:mains_nues")
        || normalized.includes("main_nue_moine");
    },

    getMonkUnarmedStunInfo(actor, context = {}) {
      if (!this.isMonk(actor) || !this.isMonkUnarmedWeapon(context.weapon ?? context.arme)) return { applies: false, reason: "not-monk-unarmed" };
      if (context.finalResult !== true) return { applies: false, reason: "miss" };

      const progression = this.getMonkProgression(actor);
      const requiredMargin = Math.max(1, Number(progression?.unarmedStunMargin ?? progression?.stunMargin ?? 5) || 5);
      const d20 = Number(context.d20);
      const threshold = Number(context.threshold ?? context.seuilFinalD20);
      const total = Number(context.total ?? context.totalAuToucher);
      const requiredTotal = Number(context.requiredTotal ?? context.valeurPourToucher);
      const margin = Number.isFinite(total) && Number.isFinite(requiredTotal)
        ? total - requiredTotal
        : (Number.isFinite(d20) && Number.isFinite(threshold) ? d20 - threshold : NaN);

      const applies = Number.isFinite(margin) && margin >= requiredMargin;
      const durationFormula = String(progression?.unarmedStunDuration ?? "1d6 rounds").match(/\d+d\d+(?:[+-]\d+)?/i)?.[0] ?? "1d6";
      return {
        applies,
        reason: applies ? "margin" : "insufficient-margin",
        margin,
        requiredMargin,
        durationFormula,
        label: "Stunned",
        progression
      };
    },

    getFoundryStatusEffectData(statusId = "stunned") {
      const wanted = this.normalizeTag(statusId);
      const effects = Array.from(CONFIG?.statusEffects ?? []);
      const status = effects.find(effect => this.normalizeTag(effect?.id ?? effect?.statusId ?? effect?.name ?? effect?.label) === wanted)
        ?? effects.find(effect => this.toArray(effect?.statuses).map(value => this.normalizeTag(value)).includes(wanted))
        ?? null;
      const label = String(status?.name ?? status?.label ?? status?.id ?? statusId);
      const icon = String(status?.img ?? status?.icon ?? "icons/svg/daze.svg");
      return { status, label, icon };
    },

    buildMonkUnarmedStunEffect({ rounds = 1 } = {}) {
      const status = this.getFoundryStatusEffectData("stunned");
      const duration = {
        rounds,
        startRound: game.combat?.round ?? null,
        startTurn: game.combat?.turn ?? null,
        startTime: game.time?.worldTime ?? null,
        combat: game.combat?.id ?? null
      };
      return {
        name: status.label,
        img: status.icon,
        icon: status.icon,
        disabled: false,
        transfer: false,
        statuses: ["stunned"],
        duration,
        flags: {
          core: {
            statusId: "stunned",
            overlay: false
          }
        },
        changes: foundry.utils.deepClone(status.status?.changes ?? [])
      };
    },

    async applyMonkUnarmedStun({ attacker, target, weapon, context = {} } = {}) {
      if (!attacker || !target || !weapon) return { applied: false, reason: "missing-context" };
      const info = this.getMonkUnarmedStunInfo(attacker, { ...context, weapon });
      if (!info.applies) return { applied: false, ...info };

      const roll = await new Roll(info.durationFormula).evaluate();
      if (game.dice3d) await game.dice3d.showForRoll(roll);
      const rounds = Math.max(1, Number(roll.total) || 1);
      const effectData = this.buildMonkUnarmedStunEffect({ rounds });
      const oldIds = Array.from(target.effects ?? [])
        .filter(effect => {
          const statuses = effect.statuses instanceof Set ? [...effect.statuses] : this.toArray(effect.statuses);
          const coreStatusId = effect.flags?.core?.statusId ?? effect.getFlag?.("core", "statusId");
          const oldCustomTags = this.toArray(effect.flags?.add2e?.tags ?? effect.getFlag?.("add2e", "tags") ?? []).map(tag => this.normalizeTag(tag));
          return statuses.map(value => this.normalizeTag(value)).includes("stunned")
            || this.normalizeTag(coreStatusId) === "stunned"
            || oldCustomTags.includes("moine:etourdissement_main_nue");
        })
        .map(effect => effect.id)
        .filter(Boolean);

      if (game.user?.isGM || target.isOwner) {
        if (oldIds.length) await target.deleteEmbeddedDocuments("ActiveEffect", oldIds, { add2eInternal: true, add2eReason: "foundry-stunned-refresh" });
        await target.createEmbeddedDocuments("ActiveEffect", [effectData], { add2eInternal: true, add2eReason: "foundry-stunned" });
      } else {
        game.socket?.emit?.("system.add2e", {
          type: "ADD2E_GM_OPERATION",
          operation: "deleteActiveEffects",
          payload: { actorId: target.id, actorUuid: target.uuid, statuses: ["stunned"], tags: ["moine:etourdissement_main_nue"] }
        });
        game.socket?.emit?.("system.add2e", {
          type: "ADD2E_GM_OPERATION",
          operation: "createActiveEffect",
          payload: { actorId: target.id, actorUuid: target.uuid, effectData }
        });
      }

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: `<div class="add2e-chat-card" style="border:1px solid #8b5e20;border-radius:10px;background:#fff7df;padding:.65em .8em;"><h3 style="margin:0 0 .35em 0;">Combat à mains nues du moine</h3><div><b>${attacker?.name ?? "Le moine"}</b> étourdit <b>${target?.name ?? "la cible"}</b> pour <b>${rounds}</b> round(s).</div><div style="font-size:.9em;margin-top:.25em;">Marge : ${info.margin} / ${info.requiredMargin} requise.</div></div>`,
        flags: { add2e: { monkUnarmedStun: true, rounds, margin: info.margin, requiredMargin: info.requiredMargin } }
      });

      return { applied: true, rounds, roll, ...info };
    },

    async handleMonkUnarmedAttackResolved(context = {}) {
      return this.applyMonkUnarmedStun({
        attacker: context.actor,
        target: context.cible,
        weapon: context.arme,
        context: {
          finalResult: context.finalResult,
          d20: context.d20,
          seuilFinalD20: context.seuilFinalD20,
          totalAuToucher: context.totalAuToucher,
          valeurPourToucher: context.valeurPourToucher
        }
      });
    },

    getMonkSummary(actor) {
      const martial = this.getMonkMartialProgression(actor);
      if (!martial) return null;
      return {
        ...martial,
        selfHealPerDay: this.getMonkSelfHealPerDay(actor),
        resistCharmSuggestion: this.getMonkResistCharmSuggestion(actor),
        resistESP: this.getMonkResistESP(actor),
        quiveringPalm: this.hasMonkQuiveringPalm(actor),
        activeCapabilities: this.getActiveClassFeatures(actor)
      };
    }
  });
}
