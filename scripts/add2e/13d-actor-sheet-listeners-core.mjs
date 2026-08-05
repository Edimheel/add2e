// ADD2E — Actor sheet listeners : noyau d'orchestration ApplicationV2.

import {
  ADD2E_SHEET_ROLL_DELEGATION_VERSION,
  add2eEvaluateRollSafe,
  add2eRollSaveCard,
  add2eInstallHudSheetRollBridge
} from "./13d-actor-sheet-listeners-rolls.mjs";
import { add2eBindActorSheetSpellListeners } from "./13d-actor-sheet-listeners-spells.mjs";

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant activateListeners.");

globalThis.ADD2E_SHEET_ROLL_DELEGATION_VERSION = ADD2E_SHEET_ROLL_DELEGATION_VERSION;
// Le HUD possède déjà ses écouteurs locaux. On installe uniquement les API globales
// de jets, sans conserver le second écouteur document qui doublait les actions.
globalThis.__add2eHudSheetRollBridgeV1 = true;
add2eInstallHudSheetRollBridge();

const ADD2E_LISTENER_CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
const ADD2E_CONSTITUTION_RULES_VERSION = "2026-07-28-constitution-canonical-hit-points-v3";
const ADD2E_FIGHTER_HP_CLASSES = new Set(["guerrier", "paladin", "ranger"]);
const ADD2E_CONSTITUTION_CHECKS = Object.freeze({
  trauma: Object.freeze({
    key: "trauma",
    profileKey: "trauma",
    label: "Résistance aux traumatismes",
    shortLabel: "Choc traumatique",
    icon: "fas fa-heart-pulse",
    chatCardType: "constitution-trauma-check"
  }),
  resurrection: Object.freeze({
    key: "resurrection",
    profileKey: "resu",
    label: "Survie à la résurrection",
    shortLabel: "Résurrection",
    icon: "fas fa-hand-holding-heart",
    chatCardType: "constitution-resurrection-check"
  })
});

globalThis.ADD2E_CONSTITUTION_RULES_VERSION = ADD2E_CONSTITUTION_RULES_VERSION;

function add2eListenerNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function add2eListenerNaturalCarac(actor, carac) {
  const stored = actor?.flags?.add2e?.base_caracs?.[carac];
  if (Number.isFinite(Number(stored))) return add2eListenerNumber(stored, 10);

  const definitive = add2eListenerNumber(actor?.system?.[`${carac}_base`] ?? actor?.system?.[carac], 10);
  const rawRacial = add2eListenerNumber(actor?.flags?.add2e?.racialAbilityAdjustments?.[carac], 0);
  return Math.max(3, Math.min(18, definitive - rawRacial));
}

function add2eListenerAppliedRacialAdjustment(actor, carac, naturalValue) {
  const natural = add2eListenerNumber(naturalValue, 10);
  const raw = add2eListenerNumber(actor?.flags?.add2e?.racialAbilityAdjustments?.[carac], 0);
  if (raw > 0 && natural + raw > 18) return Math.max(0, 18 - natural);
  if (raw < 0 && natural + raw < 3) return Math.min(0, 3 - natural);
  return raw;
}

function add2eConstitutionEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.resolveAbilityDerived !== "function" || typeof engine.resolve !== "function") {
    throw new Error("Le moteur canonique ADD2E de Constitution n’est pas disponible.");
  }
  return engine;
}

function add2eConstitutionNormalize(value) {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (typeof engine?.normalizeTag === "function") {
    return String(engine.normalizeTag(value) ?? "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eConstitutionClassKey(classDocument) {
  const system = classDocument?.system ?? {};
  const candidates = [system.slug, system.key, system.label, system.nom, system.name, classDocument?.name];
  for (const candidate of candidates) {
    const key = add2eConstitutionNormalize(candidate);
    if (["guerrier", "fighter", "warrior"].includes(key)) return "guerrier";
    if (key === "paladin") return "paladin";
    if (key === "ranger") return "ranger";
  }
  return add2eConstitutionNormalize(candidates.find(value => String(value ?? "").trim()) ?? "classe");
}

function add2eResolveConstitutionHitPointProgression(actor, classDocument) {
  if (!actor?.system || !classDocument?.system) return null;
  const engine = add2eConstitutionEngine();
  const system = classDocument.system;
  const level = Math.max(1, Math.floor(Number(system.niveau ?? system.level) || 1));
  const configuredHitDie = Math.floor(Number(system.hitDie) || 0);
  if (!Number.isFinite(configuredHitDie) || configuredHitDie < 1) return null;

  const classKey = add2eConstitutionClassKey(classDocument);
  const fighterClass = ADD2E_FIGHTER_HP_CLASSES.has(classKey);
  const constitution = engine.resolveAbilityDerived(actor, "constitution", {
    source: "hit-points-calculation",
    consumer: "actor-sheet-hit-points",
    classItemId: classDocument.id,
    classItemUuid: classDocument.uuid,
    classKey
  });
  const normalBonus = Math.trunc(Number(constitution?.profile?.pv) || 0);
  const fighterBonus = Math.trunc(Number(constitution?.profile?.pv_guerrier) || 0);

  if (classKey === "ranger") {
    return {
      classKey,
      className: classDocument.name,
      fighterClass: true,
      level,
      dieSize: 8,
      hitDice: Math.min(11, level + 1),
      fixedLevels: Math.max(0, level - 10),
      fixedHitPointsPerLevel: 2,
      constitutionBonusPerDie: fighterBonus,
      constitution
    };
  }

  if (classKey === "guerrier" || classKey === "paladin") {
    return {
      classKey,
      className: classDocument.name,
      fighterClass: true,
      level,
      dieSize: configuredHitDie,
      hitDice: Math.min(9, level),
      fixedLevels: Math.max(0, level - 9),
      fixedHitPointsPerLevel: 3,
      constitutionBonusPerDie: fighterBonus,
      constitution
    };
  }

  return {
    classKey,
    className: classDocument.name,
    fighterClass,
    level,
    dieSize: configuredHitDie,
    hitDice: level,
    fixedLevels: 0,
    fixedHitPointsPerLevel: 0,
    constitutionBonusPerDie: normalBonus,
    constitution
  };
}

function add2eConstitutionCheckDefinition(check) {
  const key = add2eConstitutionNormalize(check);
  if (["trauma", "traumatisme", "choc", "choc_traumatique"].includes(key)) return ADD2E_CONSTITUTION_CHECKS.trauma;
  if (["resurrection", "resu", "rappel_a_la_vie", "survie_resurrection"].includes(key)) return ADD2E_CONSTITUTION_CHECKS.resurrection;
  return null;
}

async function add2eRollConstitutionCheckCard(actor, check, context = {}) {
  if (!actor?.system) throw new Error("Acteur introuvable pour le test de Constitution.");
  const definition = add2eConstitutionCheckDefinition(check);
  if (!definition) throw new Error(`Test de Constitution inconnu : ${String(check ?? "vide")}.`);
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }

  const engine = add2eConstitutionEngine();
  const constitution = engine.resolveAbilityDerived(actor, "constitution", {
    ...context,
    source: context.source ?? `constitution-check:${definition.key}`,
    consumer: "actor-sheet-constitution-check",
    actionType: "save",
    saveType: definition.key
  });
  const baseChance = Math.max(0, Math.min(100, Math.trunc(Number(constitution?.profile?.[definition.profileKey]) || 0)));
  const resolution = engine.resolve(actor, {
    domain: "save",
    target: definition.key,
    base: baseChance,
    rounding: "floor",
    context: {
      ...context,
      actor,
      actionType: "save",
      saveType: definition.key,
      constitutionCheck: definition.key,
      source: context.source ?? `constitution-check:${definition.key}`
    }
  });
  const threshold = Math.max(0, Math.min(100, Math.trunc(Number(resolution?.total) || 0)));
  const roll = await add2eEvaluateRollSafe("1d100");
  const total = Math.trunc(Number(roll.total) || 0);
  const success = total <= threshold;
  const adjustment = threshold - baseChance;
  const comparison = success ? "≤" : ">";

  const card = {
    actor,
    title: definition.label,
    icon: definition.icon,
    variant: success ? "success" : "failure",
    source: {
      name: actor.name,
      img: actor.img,
      type: `Constitution ${constitution?.total ?? "—"}`
    },
    rows: [
      { label: "Chance de base", value: `${baseChance} %` },
      { label: "Ajustements", value: adjustment ? `${adjustment > 0 ? "+" : ""}${adjustment} %` : "Aucun" },
      { label: "Seuil final", value: `${threshold} %` },
      { label: "Jet", value: `${total} ${comparison} ${threshold}` },
      { label: "Résultat", value: success ? "Réussite" : "Échec" }
    ],
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [roll],
      flags: {
        add2e: {
          chatCardType: definition.chatCardType,
          constitutionRulesVersion: ADD2E_CONSTITUTION_RULES_VERSION,
          check: definition.key,
          success,
          total,
          baseChance,
          threshold,
          adjustment,
          constitution: Number(constitution?.total) || null
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(card);
  const message = await globalThis.add2eCreateChatCard(card);
  return { success, total, baseChance, threshold, adjustment, roll, message, resolution, constitution };
}

globalThis.add2eResolveConstitutionHitPointProgression = add2eResolveConstitutionHitPointProgression;
globalThis.add2eRollConstitutionCheckCard = add2eRollConstitutionCheckCard;
globalThis.add2eRollTraumaticShockCard = (actor, context = {}) => add2eRollConstitutionCheckCard(actor, "trauma", context);
globalThis.add2eRollResurrectionSurvivalCard = (actor, context = {}) => add2eRollConstitutionCheckCard(actor, "resurrection", context);

globalThis.Add2eActorSheet.prototype.activateListeners = function activateListeners(html) {
  html = html?.jquery ? html : $(html);

  add2eRegisterImgPicker(html, this);
  this._add2eBindPersistentTabs(html);
  add2eEnhanceCharacterSheetUi(this, html);

  // -- Gestion des effets actifs
  html.find('.effect-edit').off().on('click', ev => {
    ev.preventDefault();
    const effectId = $(ev.currentTarget).data('effect-id');
    const effect = this.actor.effects.get(effectId);
    if (effect) effect.sheet.render(true);
  });

  html.find('.effect-delete').off().on('click', async ev => {
    ev.preventDefault();
    this._add2eRememberActiveTab(html);
    const effectId = $(ev.currentTarget).data('effect-id');
    if (effectId) {
      await this.actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
      this.render(false);
    }
  });

  html.find('.carac-btn').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    this._add2eRememberActiveTab(html);

    const carac = String(ev.currentTarget.dataset.carac ?? "");
    if (!ADD2E_LISTENER_CARACS.includes(carac)) return;

    const isPlus = ev.currentTarget.classList.contains('plus');
    const currentNatural = add2eListenerNaturalCarac(this.actor, carac);
    const nextNatural = Math.max(3, Math.min(18, currentNatural + (isPlus ? 1 : -1)));
    if (nextNatural === currentNatural) return;

    const baseCaracs = {
      ...(this.actor.flags?.add2e?.base_caracs && typeof this.actor.flags.add2e.base_caracs === "object"
        ? foundry.utils.deepClone(this.actor.flags.add2e.base_caracs)
        : {})
    };
    baseCaracs[carac] = nextNatural;

    const appliedRacial = add2eListenerAppliedRacialAdjustment(this.actor, carac, nextNatural);
    const definitive = nextNatural + appliedRacial;
    const update = {
      "flags.add2e.base_caracs": baseCaracs,
      [`system.${carac}_base`]: definitive
    };
    if (carac === "force" && definitive !== 18) update["system.force_ex"] = 0;

    await this.actor.update(update, {
      add2eInternal: true,
      add2eReason: "ability-natural-manual-adjust",
      render: false
    });

    if (typeof this.autoSetCaracAjustements === "function") await this.autoSetCaracAjustements();
    await this.render(false);
  });

  html.find("select[data-add2e-force-ex]")
    .off('click.add2eForceEx')
    .on('click.add2eForceEx', ev => ev.stopPropagation());

  html.find("select[data-add2e-force-ex]").off('change.add2e').on('change.add2e', async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    this._add2eRememberActiveTab(html);

    const selected = Math.trunc(Number(ev.currentTarget.value));
    const forceEx = Number.isFinite(selected) && selected >= 0 && selected <= 100 ? selected : 0;
    if (typeof globalThis.add2eSetExceptionalStrength !== "function") {
      throw new Error("Le gestionnaire canonique de Force exceptionnelle n’est pas disponible.");
    }

    await globalThis.add2eSetExceptionalStrength(this.actor, forceEx, { reason: "force-ex-selection" });
    await this.render(false);
  });

  html.find('.roll-stat').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    if (typeof globalThis.add2eRollCharacteristicCard !== "function") {
      throw new Error("L’exécuteur canonique ADD2E de caractéristiques n’est pas disponible.");
    }
    await globalThis.add2eRollCharacteristicCard(this.actor, ev.currentTarget.dataset.stat, {
      source: "actor-sheet-ability-roll"
    });
  });

  html.find('.roll-save').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    await add2eRollSaveCard(this.actor, Number(ev.currentTarget.dataset.save));
  });

  html.find('.add2e-constitution-check').off('click.add2eConstitutionCheck').on('click.add2eConstitutionCheck', async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    this._add2eRememberActiveTab(html);
    const check = String(ev.currentTarget.dataset.check ?? "").trim();
    try {
      await add2eRollConstitutionCheckCard(this.actor, check, { source: "actor-sheet-constitution-check" });
    } catch (error) {
      console.error("[ADD2E][CONSTITUTION][CHECK_ERROR]", { actor: this.actor?.name, check, error });
      ui.notifications.error(error?.message || "Erreur pendant le test de Constitution.");
    }
  });

  html.find('.add2e-charisma-check').off('click.add2eCharismaCheck').on('click.add2eCharismaCheck', async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    this._add2eRememberActiveTab(html);
    const check = add2eConstitutionNormalize(ev.currentTarget.dataset.check);
    const targetTokens = Array.from(game.user?.targets ?? []).filter(token => token?.actor);
    const targetActors = targetTokens.map(token => token.actor);
    const targetActor = targetActors.length === 1 ? targetActors[0] : null;

    try {
      if (check === "loyalty" || check === "loyaute") {
        if (
          typeof globalThis.add2ePromptCharismaLoyalty !== "function"
          || typeof globalThis.add2eRollCharismaLoyaltyCard !== "function"
        ) {
          throw new Error("Le contrôleur canonique ADD2E de loyauté est indisponible.");
        }
        const options = await globalThis.add2ePromptCharismaLoyalty(this.actor, targetActor, { targetActors });
        if (!options) return;
        await globalThis.add2eRollCharismaLoyaltyCard(this.actor, {
          source: "actor-sheet-charisma-loyalty",
          subjectActor: targetActor,
          targetActors,
          ...options
        });
      } else if (check === "reaction") {
        if (
          typeof globalThis.add2ePromptContextualReaction !== "function"
          || typeof globalThis.add2eRollContextualReactionCard !== "function"
        ) {
          throw new Error("Le contrôleur canonique ADD2E de réaction est indisponible.");
        }
        const options = await globalThis.add2ePromptContextualReaction(this.actor, targetActor, { targetActors });
        if (!options) return;
        await globalThis.add2eRollContextualReactionCard(this.actor, targetActor, {
          source: "actor-sheet-charisma-reaction",
          targetActors,
          ...options
        });
      } else {
        throw new Error(`Test de Charisme inconnu : ${check || "vide"}.`);
      }
    } catch (error) {
      console.error("[ADD2E][CHARISME][CHECK_ERROR]", {
        actor: this.actor?.name,
        check,
        targets: targetActors.map(target => target?.name).filter(Boolean),
        error
      });
      ui.notifications.error(error?.message || "Erreur pendant le test de Charisme.");
    }
  });

  html.find('.add2e-thief-skill-roll').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    const key = $(ev.currentTarget).data('thief-skill-key');
    await add2eRollThiefSkill(this.actor, key);
  });

  html.find('.arme-img-attack').off('click').on('click', async ev => {
    const itemId = $(ev.currentTarget).data("item-id");
    const arme = this.actor.items.get(itemId);
    if (!arme) return;
    await globalThis.add2eAttackRoll({ actor: this.actor, arme });
  });

  html.find('.arme-img-attack').attr('draggable', 'true').off('dragstart').on('dragstart', ev => {
    const itemId = $(ev.currentTarget).data("item-id");
    const item = this.actor.items.get(itemId);
    if (!item) return;
    ev.originalEvent.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid: item.uuid }));
  });

  html.find('.window-content [data-action]').off().on('click', async ev => {
    ev.stopPropagation();
    this._add2eRememberActiveTab(html);

    const $el = $(ev.currentTarget);
    const action = $el.data('action');
    const itemId = $el.data('item-id');
    const sortId = $el.data('sort-id');

    const actionNorm = String(action ?? "").trim().toLowerCase();
    const hasFeatureMarker =
      $el.data("feature-index") !== undefined ||
      $el.data("feature-name") !== undefined ||
      $el.data("feature-id") !== undefined ||
      $el.data("feature-key") !== undefined ||
      $el.data("on-use") !== undefined ||
      $el.closest("[data-feature-index], [data-feature-name], [data-feature-id], [data-feature-key], [data-on-use]").length > 0;

    const candidateFeature = add2eFindClassFeatureFromElement(this.actor, ev.currentTarget);
    const looksLikeFeatureUse =
      hasFeatureMarker ||
      actionNorm.includes("feature") ||
      actionNorm.includes("capacite") ||
      actionNorm.includes("capacité") ||
      actionNorm === "use-class-feature" ||
      actionNorm === "class-feature-use" ||
      (candidateFeature && !itemId && !sortId && (
        actionNorm === "use" ||
        actionNorm === "utiliser" ||
        actionNorm.includes("use") ||
        String($el.text() ?? "").trim().toLowerCase().includes("utiliser")
      ));

    if (looksLikeFeatureUse && candidateFeature) {
      await add2eExecuteClassFeatureOnUse(this.actor, candidateFeature, this);
      return;
    }

    if (looksLikeFeatureUse && !candidateFeature) {
      console.warn("[ADD2E][CAPACITE][CLICK] Bouton détecté mais capacité introuvable", {
        action,
        dataset: { ...($el[0]?.dataset ?? {}) },
        text: $el.text?.(),
        features: add2eGetActorActivableClassFeatures(this.actor).map(f => ({
          name: add2eFeatureName(f),
          on_use: add2eFeatureOnUse(f)
        }))
      });
      ui.notifications.warn("Capacité de classe introuvable pour ce bouton. Voir console [ADD2E][CAPACITE][CLICK].");
      return;
    }

    await handleItemAction({ actor: this.actor, action, itemId, sheet: this });
  });

  html.find('.add2e-feature-use, button, a, .a2e-btn').off('click.add2eFeatureFallback').on('click.add2eFeatureFallback', async ev => {
    const $el = $(ev.currentTarget);
    if ($el.data('item-id') || $el.data('sort-id')) return;

    const label = String($el.text?.() ?? "").trim().toLowerCase();
    const action = String($el.data('action') ?? "").trim().toLowerCase();
    const hasFeatureMarker =
      $el.hasClass('add2e-feature-use') ||
      $el.data("feature-index") !== undefined ||
      $el.data("feature-name") !== undefined ||
      $el.data("feature-id") !== undefined ||
      $el.data("feature-key") !== undefined ||
      $el.data("on-use") !== undefined;

    if (!hasFeatureMarker && !label.includes("utiliser") && !action.includes("feature") && !action.includes("capacite") && !action.includes("capacité")) return;

    const feature = add2eFindClassFeatureFromElement(this.actor, ev.currentTarget);
    if (!feature) return;

    ev.preventDefault();
    ev.stopPropagation();
    this._add2eRememberActiveTab(html);
    await add2eExecuteClassFeatureOnUse(this.actor, feature, this);
  });

  html.find('.roll-initiative-btn').off().on('click', async ev => {
    ev.preventDefault();
    const arme = this.actor.items.find(i => i.type === "arme" && i.system.equipee);
    const facteur = arme ? (Number(arme.system.facteur_rapidité) || 0) : 0;
    const roll = await add2eEvaluateRollSafe("1d6 + " + facteur);
    await this.actor.update({ "system.initiative": roll.total });

    const token = this.actor.getActiveTokens()[0];
    if (token && game.combat) {
      const combatant = game.combat.combatants.find(c => c.tokenId === token.id);
      if (combatant) {
        await combatant.update({ initiative: roll.total });
        await triInitiativeAscendant();
      }
    }
    roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), flavor: `Initiative (facteur arme ${facteur >= 0 ? "+" : ""}${facteur})` });
  });

  html.find('.arme-thaco-roll').off().on('click', async ev => {
    const itemId = $(ev.currentTarget).data("item-id");
    const arme = this.actor.items.get(itemId);
    if (!arme) return;
    await add2eAttackRoll({ actor: this.actor, arme });
  });

  html.find('input[name="actor.name"]').off('change.add2e').on("change.add2e", async ev => {
    const newName = ev.target.value.trim();
    if (newName && newName !== this.actor.name) {
      await this.actor.update({ name: newName });
      this.render(false);
    }
  });

  html.find('.roll-caracs-btn').off('click.add2e').on('click.add2e', ev => {
    ev.preventDefault();
    if (typeof Add2eCaracRoller !== "undefined") new Add2eCaracRoller(this);
    else ui.notifications.warn("Le module de tirage de caractéristiques n'est pas chargé !");
  });

  html.find('.armure-equip').off().on('click', async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    this._add2eRememberActiveTab(html);
    const itemId = $(ev.currentTarget).data("item-id");
    await handleItemAction({ actor: this.actor, action: "equip", itemId, itemType: "armure", sheet: this });
  });

  html.find('.armure-edit').off().on('click', ev => {
    const itemId = $(ev.currentTarget).data("item-id");
    const item = this.actor.items.get(itemId);
    if (item) item.sheet.render(true);
  });

  html.find('.armure-delete').off().on('click', async ev => {
    const itemId = $(ev.currentTarget).data("item-id");
    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
    this.render(false);
  });

  html.find('.objet-create').off("click").on("click", async ev => {
    ev.preventDefault();
    await Item.create({ name: "Nouvel Objet", type: "objet", img: "icons/containers/bags/sack-cloth-tan.webp", system: { quantite: 1, poids: 0, equipee: false } }, { parent: this.actor });
  });

  html.find('.objet-equip').off("click").on("click", async ev => {
    ev.preventDefault();
    const li = $(ev.currentTarget).closest(".item");
    const itemId = li.data("itemId");
    const item = this.actor.items.get(itemId);
    if (!item) return;

    const newState = !item.system.equipee;
    await item.update({"system.equipee": newState});

    if (newState) {
      const scriptPath = item.system.onUse || item.system.onuse;
      if (scriptPath) {
        try {
          const response = await fetch(scriptPath);
          if (response.ok) {
            const code = await response.text();
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const fn = new AsyncFunction("actor", "item", "sort", code);
            await fn(this.actor, item, null);
            ui.notifications.info(`${item.name} : Activé`);
          } else {
            console.warn(`[ADD2e] Script introuvable : ${scriptPath}`);
          }
        } catch(e) {
          console.error(`[ADD2e] Erreur script objet :`, e);
          ui.notifications.error(`Erreur script sur ${item.name}`);
        }
      }
    } else {
      const effectsToDelete = this.actor.effects.filter(e => e.origin === item.uuid).map(e => e.id);
      if (effectsToDelete.length > 0) {
        await this.actor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete);
        ui.notifications.info(`${item.name} : Désactivé (Effets retirés)`);
      }
    }

    this.render(false);
  });

  html.find('.objet-edit').off("click").on("click", ev => {
    ev.preventDefault();
    const li = $(ev.currentTarget).closest(".item");
    const itemId = li.data("itemId");
    const item = this.actor.items.get(itemId);
    if (item) item.sheet.render(true);
  });

  html.find('.objet-delete').off("click").on("click", async ev => {
    ev.preventDefault();
    const li = $(ev.currentTarget).closest(".item");
    const itemId = li.data("itemId");
    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  });

  html.find('input[name="system.niveau"]').off('change.add2e').on("change.add2e", async ev => {
    let v = parseInt(ev.target.value, 10) || 1;
    const clamp = add2eClampLevelToClassMax(this.actor, v, null, { notify: true });
    v = clamp.level;
    ev.target.value = v;
    await this.actor.update({ "system.niveau": v });
    try { await add2eSyncMonkUnarmedWeapon(this.actor); } catch (e) { console.warn("[ADD2E][MOINE] Sync niveau échoué", e); }
    try { await add2eSyncClassPassiveEffect(this.actor); } catch (e) { console.warn("[ADD2E][CLASSE][EFFETS] Sync niveau échoué", e); }
    this.render(false);
  });

  add2eBindActorSheetSpellListeners(this, html);

  html.find('.file-picker').off().on('click', ev => {
    const target = $(ev.currentTarget).data('target');
    new FilePicker({
      type: "image",
      current: this.actor?.img || this.item?.img || "icons/svg/mystery-man.svg",
      callback: path => {
        if (this.item) this.item.update({ [target]: path });
        else majImageToken(this.actor, path);
        html.find('input[name="img"]').val(path);
        html.find('img[alt="Icône"], img[alt="Image du monstre"]').attr('src', path);
      }
    }).render(true);
  });

  html.find('input[name="name"]').off('change.add2e').on("change.add2e", async ev => {
    const newName = ev.target.value.trim();
    if (newName && newName !== this.actor.name) {
      await this.actor.update({ name: newName });
      await this.actor.update({ "prototypeToken.name": newName });
      for (let t of this.actor.getActiveTokens()) {
        if (t.document && t.document.name !== newName) await t.document.update({ name: newName });
      }
      this.render(false);
    }
  });

  this.autoSetCaracAjustements();
};
