// ADD2E — Effects Engine / primitives d’effets temporaires et configurés.
// Compatible Foundry V13/V14/V15 — API commune des fenêtres et cartes ADD2E.

import { add2eTimeEffectData } from "../add2e/19a-time-engine.mjs";
import {
  ADD2E_ABILITIES,
  abilityKey,
  canonicalKey,
  clone,
  escapeHtml,
  rawList,
  register,
  sourceStableKey
} from "./00-core-shared.mjs";

function potionContextActor(context = {}) {
  return context.actor ?? context.args?.[0]?.actor ?? null;
}

function potionContextItem(context = {}) {
  return context.sourceItem ?? context.item ?? context.args?.[0]?.sourceItem ?? context.args?.[0]?.item ?? null;
}

async function potionRoll(formula) {
  const roll = new Roll(String(formula || "0"));
  await roll.evaluate();
  return roll;
}

function potionRollTotal(roll) {
  return Number(roll?.total) || 0;
}

function potionTargets(actor, selfOnly = false) {
  if (selfOnly) return actor ? [actor] : [];
  const targets = Array.from(game.user?.targets ?? []).map(token => token.actor).filter(Boolean);
  return targets.length ? targets : (actor ? [actor] : []);
}

async function potionDuration(config = {}) {
  if (config.durationFormula) {
    const roll = await potionRoll(config.durationFormula);
    return {
      rounds: Math.max(0, potionRollTotal(roll) * (Number(config.durationMultiplier) || 1)),
      rolls: [roll]
    };
  }
  return {
    rounds: Math.max(0, Number(config.durationRounds) || 0),
    rolls: []
  };
}

export function installEnginePrimitives(Engine) {
  register(Engine, {
    async createTimedEffect({
      actor,
      name,
      img = null,
      sourceItem = null,
      rounds = 0,
      unit = "round",
      description = "",
      tags = [],
      rules = [],
      modifiers = [],
      changes = [],
      endMessage = null,
      silentExpiration = false,
      extraFlags = {}
    } = {}) {
      if (!actor) throw new Error("Acteur introuvable pour l’effet temporaire.");
      const canonicalModifiers = rawList(modifiers).map((modifier, index) => this.createModifier(modifier, {
        source: {
          kind: canonicalKey(extraFlags?.sourceType ?? sourceItem?.type ?? "effect") || "effect",
          id: String(sourceItem?.id ?? `${name || "effect"}-${index}`),
          uuid: String(sourceItem?.uuid ?? ""),
          name: String(sourceItem?.name ?? name ?? "Effet")
        }
      }));
      const data = add2eTimeEffectData({
        name,
        img: img || sourceItem?.img || "icons/svg/aura.svg",
        origin: sourceItem?.uuid ?? null,
        rounds,
        unit,
        description,
        tags,
        changes,
        source: "objet_magique",
        caster: actor,
        sourceItem,
        endMessage,
        silentExpiration,
        extraFlags: {
          rules: clone(rules),
          modifiers: clone(canonicalModifiers),
          genericEffect: true,
          ...clone(extraFlags)
        }
      });
      const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
      return effect ?? null;
    },

    async createTimedCharacteristicEffect({
      actor,
      characteristic,
      value,
      displayValue = null,
      profile = {},
      priority = 100,
      rules = [],
      changes = [],
      ...options
    } = {}) {
      const ability = abilityKey(characteristic);
      if (!actor || !ADD2E_ABILITIES.has(ability) || value === undefined || value === null || value === "") {
        throw new Error("Override de caractéristique invalide.");
      }
      const sourceItem = options.sourceItem ?? null;
      const source = {
        kind: canonicalKey(options.extraFlags?.sourceType ?? sourceItem?.type ?? "effect") || "effect",
        id: String(sourceItem?.id ?? options.extraFlags?.sourceItemId ?? `${options.name ?? "effect"}:${ability}`),
        uuid: String(sourceItem?.uuid ?? options.extraFlags?.sourceItemUuid ?? ""),
        name: String(sourceItem?.name ?? options.name ?? "Effet de caractéristique")
      };
      const modifier = this.createModifier({
        id: `${sourceStableKey(source)}:${ability}:set`,
        domain: "ability",
        target: ability,
        operation: "set",
        value: Number(value),
        priority,
        stacking: { mode: "replace", group: `ability:${ability}:override` },
        source,
        metadata: {
          label: source.name,
          displayValue: displayValue ?? value,
          profile: clone(profile)
        }
      });
      return this.createTimedEffect({
        ...options,
        actor,
        rules,
        changes,
        modifiers: [...rawList(options.modifiers), modifier],
        extraFlags: {
          ...(options.extraFlags ?? {}),
          characteristicEffect: true,
          characteristic: ability,
          characteristicValue: value,
          characteristicDisplayValue: displayValue ?? value,
          characteristicProfile: clone(profile)
        }
      });
    },

    async postGenericEffectChat(actor, title, html, item = null, rolls = []) {
      if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
        throw new Error("Les constructeurs de carte de chat ADD2E ne sont pas disponibles.");
      }
      const container = document.createElement("div");
      container.innerHTML = String(html ?? "");
      const message = String(container.textContent ?? "").replace(/\s+/g, " ").trim();
      const chatRolls = rawList(rolls).filter(Boolean);
      const options = {
        actor,
        title,
        icon: "fas fa-wand-magic-sparkles",
        variant: "magic",
        source: {
          name: item?.name ?? actor?.name ?? "Source",
          img: item?.img ?? actor?.img ?? "icons/svg/aura.svg",
          type: item ? "Objet" : "Acteur"
        },
        message,
        chatData: {
          speaker: ChatMessage.getSpeaker({ actor }),
          rolls: chatRolls
        }
      };
      globalThis.add2eBuildChatCard(options);
      return globalThis.add2eCreateChatCard(options);
    },

    async applyConfiguredEffect(context, config = {}) {
      const actor = potionContextActor(context);
      const item = potionContextItem(context);
      if (!actor) return false;

      if (config.kind === "healing") {
        const roll = await potionRoll(config.formula);
        const total = potionRollTotal(roll);
        if (typeof this.applyHitPointHealing !== "function") {
          throw new Error("Le propriétaire canonique ADD2E des points de vie est indisponible pour les soins configurés.");
        }
        const healing = await this.applyHitPointHealing(actor, total, {
          reason: "potion-healing"
        });
        await this.postGenericEffectChat(
          actor,
          config.name,
          `<p>Points de vie : <b>${healing.before} → ${healing.after}</b>.</p><p>Soins effectifs : <b>${healing.effective}</b>.</p>`,
          item,
          [roll]
        );
        return true;
      }

      if (config.kind === "age") {
        const roll = await potionRoll(config.formula);
        const total = potionRollTotal(roll);
        const system = actor.system ?? {};
        const target = [
          ["system.age", system.age],
          ["system.details.age", system.details?.age],
          ["system.age_actuel", system.age_actuel]
        ].find(([, current]) => Number.isFinite(Number(current)));
        if (target) {
          const [path, before] = target;
          const after = Math.max(0, Number(before) - total);
          await actor.update({ [path]: after }, { add2eInternal: true, add2eReason: "potion-age" });
          await this.postGenericEffectChat(actor, config.name, `<p>Âge : <b>${before} → ${after}</b>.</p>`, item, [roll]);
        } else {
          await this.postGenericEffectChat(actor, config.name, `<p>Réduction d’âge à appliquer : <b>${total}</b> an(s).</p>`, item, [roll]);
        }
        return true;
      }

      if (config.kind === "deception") {
        await this.createTimedEffect({
          actor,
          name: config.name,
          img: item?.img || "icons/svg/aura.svg",
          sourceItem: item,
          description: config.description || "",
          tags: ["objet_magique", "potion", `potion:${config.slug}`, "tromperie"],
          rules: [{ kind: "deception", apparentEffect: config.apparentEffect || "soins" }],
          extraFlags: { potion: true, potionSlug: config.slug, deceptivePotion: true }
        });
        await this.postGenericEffectChat(actor, config.name, "<p>Le consommateur croit que la potion a produit l’effet attendu. Aucun bénéfice réel n’est appliqué.</p>", item);
        return true;
      }

      if (config.kind === "heroism") {
        const level = this.getActorLevel(actor);
        if (level >= Number(config.maxLevelExclusive ?? Infinity)) {
          ui.notifications.warn(`${config.name} est sans effet sur un personnage de niveau ${level}.`);
          return false;
        }
        const row = (config.levelTable ?? []).find(entry => level >= Number(entry.min) && level <= Number(entry.max));
        if (!row) return false;
        const temporaryHpRoll = await potionRoll(row.hpDice);
        const temporaryHp = potionRollTotal(temporaryHpRoll);
        const duration = await potionDuration(config);
        await this.createTimedEffect({
          actor,
          name: config.name,
          img: item?.img || "icons/svg/aura.svg",
          sourceItem: item,
          rounds: duration.rounds,
          description: config.description || "",
          tags: ["objet_magique", "potion", `potion:${config.slug}`, ...(config.tags ?? [])],
          rules: [
            { kind: "temporary_levels", value: Number(row.bonus) || 0 },
            { kind: "temporary_hp", value: temporaryHp }
          ],
          endMessage: `L’effet ${config.name} prend fin sur {actor}.`,
          extraFlags: { potion: true, potionSlug: config.slug, temporaryLevels: Number(row.bonus) || 0, temporaryHp }
        });
        await this.postGenericEffectChat(
          actor,
          config.name,
          `<p>Niveaux temporaires : <b>+${Number(row.bonus) || 0}</b>.</p><p>Points de vie temporaires : <b>${temporaryHp}</b>.</p>${duration.rounds ? `<p>Durée : <b>${duration.rounds} round(s).</b></p>` : ""}`,
          item,
          [temporaryHpRoll, ...duration.rolls]
        );
        return true;
      }

      const duration = await potionDuration(config);
      const targets = potionTargets(actor, config.selfOnly === true);
      if (!targets.length) return false;
      if (config.confirm === true) {
        if (typeof globalThis.add2eDialogConfirm !== "function") {
          throw new Error("L’API de fenêtre ADD2E est indisponible.");
        }
        const accepted = await globalThis.add2eDialogConfirm({
          add2eTheme: "wizard",
          add2ePrimaryAction: "yes",
          add2eClasses: ["add2e-configured-effect-confirm"],
          window: { title: config.name || "Effet" },
          modal: true,
          content: `<div class="add2e-dialog"><p><b>${escapeHtml(config.name || "Effet")}</b></p><p>Cible(s) : <b>${escapeHtml(targets.map(target => target.name).join(", "))}</b></p>${config.saveNote ? `<p>${escapeHtml(config.saveNote)}</p>` : ""}<p>Appliquer l’effet ?</p></div>`,
          yes: { label: "Appliquer", icon: "<i class='fas fa-check'></i>" },
          no: { label: "Annuler", icon: "<i class='fas fa-times'></i>" }
        });
        if (!accepted) return false;
      }
      for (const target of targets) {
        await this.createTimedEffect({
          actor: target,
          name: config.name,
          img: item?.img || "icons/svg/aura.svg",
          sourceItem: item,
          rounds: duration.rounds,
          description: config.description || config.rule || "",
          tags: ["objet_magique", "potion", `potion:${config.slug}`, ...(config.tags ?? [])],
          rules: config.rules ?? [],
          modifiers: config.modifiers ?? [],
          endMessage: config.endMessage ?? `L’effet ${config.name} prend fin sur {actor}.`,
          extraFlags: { potion: true, potionSlug: config.slug, ...(config.extraFlags ?? {}) }
        });
      }
      await this.postGenericEffectChat(
        actor,
        config.name,
        `<p>Effet appliqué à : <b>${escapeHtml(targets.map(target => target.name).join(", "))}</b>.</p>${duration.rounds ? `<p>Durée : <b>${duration.rounds} round(s).</b></p>` : ""}${config.rule ? `<p>${escapeHtml(config.rule)}</p>` : ""}`,
        item,
        duration.rolls
      );
      return true;
    }
  });
}
