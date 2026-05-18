// scripts/actor-sheet.mjs
// ADD2E — Feuille acteur : classe principale et enregistrement.
// Découpage : les utilitaires, prérequis, compatibilités et persistance d'onglets
// sont dans scripts/actor-sheet/*.mjs.

import {
  add2eRaceAbilityValue,
  add2eToTextList,
  add2eToMultilineText,
  add2eGetAbilityBase,
  add2eUpdateFinalCaracsLocal,
  add2eCollectTagsFromItem
} from "./actor-sheet/utils.mjs";

import {
  add2eGetActorClassName,
  add2eGetActorClassSystem,
  add2eGetActorRaceName,
  add2eGetActorRaceSystem,
  add2eClassNameFromItem
} from "./actor-sheet/actor-identity.mjs";

import {
  add2eRaceIdentityTags,
  add2eCheckRaceClassCompatibility
} from "./actor-sheet/race-class-compatibility.mjs";

import {
  add2eProjectedAbilities,
  add2eCheckClassRequirements
} from "./actor-sheet/class-requirements.mjs";

import {
  add2eDeleteOwnedItemsOfType,
  add2eCreateOwnedClone,
  add2eDeleteActorEffectsBySourceType
} from "./actor-sheet/embedded-documents.mjs";

import {
  add2eInstallActorSheetTabPersistence
} from "./actor-sheet/tabs-persistence.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

// =====================================================
// FEUILLE ACTEUR ADD2E
// =====================================================

export class Add2eActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "actor", "personnage"],
      template: "systems/add2e/templates/actor/character-sheet.hbs",
      width: 1050,
      height: 900
    });
  }

  async getData(opts) {
    const ctx = await super.getData(opts);

    ctx.actor = this.actor;
    ctx.system = this.actor.system;
    ctx.items = this.actor.items?.contents ?? [];
    ctx.isGM = game.user.isGM;

    ctx.activeTab = this.actor.getFlag("add2e", "activeSheetTab") || this._add2eActiveTab || "resume";

    return ctx;
  }

  // =====================================================
  // ONGLET CLASSIQUE PERSISTANT
  // =====================================================

  _add2eRoot(html = null) {
    const element = html ?? this.element;
    if (!element) return null;

    if (element instanceof HTMLElement) return element;
    if (element.jquery && element[0] instanceof HTMLElement) return element[0];
    if (element[0] instanceof HTMLElement) return element[0];
    if (element.querySelector) return element;

    return null;
  }

  _add2eSheetRoot(html = null) {
    const root = this._add2eRoot(html);
    if (!root) return null;

    if (root.matches?.(".add2e-character-v3")) return root;
    return root.querySelector?.(".add2e-character-v3") ?? null;
  }

  _add2eActivateTab(tabName = "resume", html = null) {
    const sheet = this._add2eSheetRoot(html);
    if (!sheet) return;

    const tab = tabName || "resume";
    this._add2eActiveTab = tab;

    const hidden = sheet.querySelector(".a2e-active-tab-input");
    if (hidden) hidden.value = tab;

    sheet.querySelectorAll(".a2e-tabs .item[data-tab]").forEach(link => {
      link.classList.toggle("active", link.dataset.tab === tab);
    });

    sheet.querySelectorAll(".sheet-body .a2e-tab-content[data-tab]").forEach(section => {
      section.classList.toggle("active", section.dataset.tab === tab);
    });
  }

  _add2eBindTabs(html = null) {
    const sheet = this._add2eSheetRoot(html);
    if (!sheet) return;

    const initialTab =
      this.actor.getFlag("add2e", "activeSheetTab") ||
      this._add2eActiveTab ||
      sheet.querySelector(".a2e-tabs .item.active[data-tab]")?.dataset?.tab ||
      "resume";

    this._add2eActivateTab(initialTab, sheet);

    if (sheet.dataset.add2eTabsDelegated === "1") return;
    sheet.dataset.add2eTabsDelegated = "1";

    sheet.addEventListener("click", event => {
      const link = event.target.closest?.(".a2e-tabs .item[data-tab]");
      if (!link || !sheet.contains(link)) return;

      event.preventDefault();

      const tab = link.dataset.tab || "resume";
      this._add2eActivateTab(tab, sheet);

      if (this.actor?.isOwner) {
        this.actor.setFlag("add2e", "activeSheetTab", tab).catch(err => {
          console.warn("[ADD2E][TABS] Impossible de mémoriser l’onglet actif.", err);
        });
      }
    });
  }

  activateListeners(html) {
    super.activateListeners?.(html);
    this._add2eBindTabs(html);
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    this._add2eBindTabs(this.element);
  }

  async _onDropItem(event, data) {
    console.log("[add2e] DROP ITEM :", data);

    let item = null;

    if (data?.uuid) {
      item = await fromUuid(data.uuid);
    }

    if (!item) {
      ui.notifications.warn("Objet déposé introuvable.");
      return;
    }

    // =====================================================
    // DROP RACE
    // =====================================================
    if (item.type === "race") {
      const raceName = item.name;
      const raceSystem = foundry.utils.deepClone(item.system ?? {});
      const droppedRaceTags = [
        ...add2eRaceIdentityTags(raceName, raceSystem),
        ...add2eCollectTagsFromItem(item)
      ].filter(Boolean);
      raceSystem.appliedTags = droppedRaceTags;

      const currentClassName = add2eGetActorClassName(this.actor);
      const currentClassSystem = add2eGetActorClassSystem(this.actor);

      const compat = add2eCheckRaceClassCompatibility({
        raceName,
        raceSystem,
        className: currentClassName,
        classSystem: currentClassSystem,
        actor: this.actor
      });

      if (!compat.ok) {
        ui.notifications.error(compat.reason);
        console.warn("[ADD2E][DROP RACE][REFUS COMPATIBILITE]", {
          actor: this.actor.name,
          race: raceName,
          classe: currentClassName,
          compat
        });
        return;
      }

      const projectedAbilities = add2eProjectedAbilities(this.actor, raceSystem);
      const requirements = add2eCheckClassRequirements({
        actor: this.actor,
        className: currentClassName,
        classSystem: currentClassSystem,
        projectedAbilities
      });

      if (!requirements.ok) {
        ui.notifications.error(requirements.reason);
        console.warn("[ADD2E][DROP RACE][REFUS PREREQUIS CLASSE]", {
          actor: this.actor.name,
          race: raceName,
          classe: currentClassName,
          projectedAbilities,
          requirements
        });
        return;
      }

      const adjustments =
        raceSystem?.abilityAdjustments ||
        raceSystem?.data?.abilityAdjustments ||
        raceSystem?.bonus_caracteristiques ||
        {};

      const racialTags = droppedRaceTags;

      const bases = {};
      for (const c of ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"]) {
        bases[c] = add2eGetAbilityBase(this.actor, c);
      }

      await add2eDeleteOwnedItemsOfType(this.actor, "race");
      await add2eDeleteActorEffectsBySourceType(this.actor, "race");

      const raceDetails = {
        ...raceSystem,
        name: raceName,
        label: raceName,
        uuid: item.uuid ?? "",
        sourceId: item.id ?? "",
        appliedTags: racialTags,
        compatibilityChecked: compat,
        requirementsChecked: requirements
      };

      const maj = {
        "system.race": raceName,
        "system.details_race": raceDetails,

        "system.force_base": bases.force,
        "system.dexterite_base": bases.dexterite,
        "system.constitution_base": bases.constitution,
        "system.intelligence_base": bases.intelligence,
        "system.sagesse_base": bases.sagesse,
        "system.charisme_base": bases.charisme,

        "system.bonus_caracteristiques.force":
          add2eRaceAbilityValue(adjustments, "str", "force"),

        "system.bonus_caracteristiques.dexterite":
          add2eRaceAbilityValue(adjustments, "dex", "dexterite"),

        "system.bonus_caracteristiques.constitution":
          add2eRaceAbilityValue(adjustments, "con", "constitution"),

        "system.bonus_caracteristiques.intelligence":
          add2eRaceAbilityValue(adjustments, "int", "intelligence"),

        "system.bonus_caracteristiques.sagesse":
          add2eRaceAbilityValue(adjustments, "wis", "sagesse"),

        "system.bonus_caracteristiques.charisme":
          add2eRaceAbilityValue(adjustments, "cha", "charisme"),

        "system.langues":
          add2eToTextList(raceSystem?.languages ?? raceSystem?.langues),

        "system.special_racial":
          add2eToMultilineText(raceSystem?.specialAbilities ?? raceSystem?.special_racial ?? raceSystem?.capacites),

        "system.vitesse_deplacement":
          raceSystem?.speed ?? raceSystem?.vitesse ?? raceSystem?.movement ?? raceSystem?.vitesse_deplacement ?? this.actor.system?.vitesse_deplacement ?? ""
      };

      console.log("[ADD2E][DROP RACE][APPLICATION ATOMIQUE]", {
        actor: this.actor.name,
        ancienneRace: add2eGetActorRaceName(this.actor),
        nouvelleRace: raceName,
        classeActuelle: currentClassName,
        compat,
        bases,
        maj,
        racialTags,
        requirements
      });

      await this.actor.update(maj);
      await this.actor.setFlag("add2e", "racialTags", racialTags);
      await this.actor.setFlag("add2e", "raceClassCompatibility", compat);
      await this.actor.setFlag("add2e", "classRequirements", requirements);

      await add2eCreateOwnedClone(this.actor, item, "race");
      await add2eUpdateFinalCaracsLocal(this.actor);

      ui.notifications.info(`Race "${raceName}" appliquée. ${compat.reason}`);
      return;
    }

    // =====================================================
    // DROP CLASSE
    // =====================================================
    if (item.type !== "classe") {
      return;
    }

    const classeSystem = foundry.utils.deepClone(item.system ?? {});
    const currentRaceName = add2eGetActorRaceName(this.actor);
    const currentRaceSystem = add2eGetActorRaceSystem(this.actor);

    const compat = add2eCheckRaceClassCompatibility({
      raceName: currentRaceName,
      raceSystem: currentRaceSystem,
      className: add2eClassNameFromItem(item),
      classSystem: classeSystem,
      actor: this.actor
    });

    if (!compat.ok) {
      ui.notifications.error(compat.reason);
      console.warn("[ADD2E][DROP CLASSE][REFUS COMPATIBILITE]", {
        actor: this.actor.name,
        race: currentRaceName,
        raceSystem: currentRaceSystem,
        classe: item.name,
        classSystem: classeSystem,
        compat
      });
      return;
    }

    const requirements = add2eCheckClassRequirements({
      actor: this.actor,
      className: add2eClassNameFromItem(item),
      classSystem: classeSystem
    });

    if (!requirements.ok) {
      ui.notifications.error(requirements.reason);
      console.warn("[ADD2E][DROP CLASSE][REFUS PREREQUIS]", {
        actor: this.actor.name,
        race: currentRaceName,
        classe: item.name,
        requirements
      });
      return;
    }

    await add2eDeleteOwnedItemsOfType(this.actor, "classe");
    await add2eDeleteActorEffectsBySourceType(this.actor, "classe");

    const classTags = add2eCollectTagsFromItem(item);

    const maj = {
      "system.classe": item.name,
      "system.nom": this.actor.name,
      "system.niveau": 1,

      "system.points_de_coup":
        Number(item.system?.hitDie ?? item.system?.dv ?? 8),

      "system.special":
        add2eToMultilineText(item.system?.specialAbilities ?? item.system?.special ?? item.system?.capacites),

      "system.alignement":
        Array.isArray(item.system?.alignment)
          ? item.system.alignment[0]
          : (item.system?.alignment ?? ""),

      "system.armure_portee":
        add2eToTextList(item.system?.armorAllowed ?? item.system?.armures_autorisees),

      "system.bouclier":
        item.system?.shieldAllowed ? "Oui" : "Non",

      "system.pv_par_niveau":
        item.system?.hdPerLevel ?? "",

      "system.principale":
        item.system?.primaryAbility ?? "",

      "system.xp_progression":
        item.system?.progression ? JSON.stringify(item.system.progression) : "",

      "system.details_classe": {
        ...classeSystem,
        name: item.name,
        label: item.name,
        appliedTags: classTags,
        compatibilite_race: compat,
        requirementsChecked: requirements
      }
    };

    console.log("[ADD2E][DROP CLASSE][APPLICATION ATOMIQUE]", {
      actor: this.actor.name,
      raceActuelle: currentRaceName,
      classe: item.name,
      compat,
      requirements,
      maj,
      classTags
    });

    await this.actor.update(maj);
    await this.actor.setFlag("add2e", "classTags", classTags);
    await this.actor.setFlag("add2e", "raceClassCompatibility", compat);
    await this.actor.setFlag("add2e", "classRequirements", requirements);

    await add2eCreateOwnedClone(this.actor, item, "classe");

    ui.notifications.info(`Classe "${item.name}" appliquée. ${compat.reason}`);
  }
}

globalThis.Add2eActorSheet = Add2eActorSheet;

if (game?.ready) {
  add2eInstallActorSheetTabPersistence();
} else {
  Hooks.once("ready", add2eInstallActorSheetTabPersistence);
}

// =====================================================
// ENREGISTREMENT FEUILLE ACTEUR
// =====================================================

Hooks.once("init", () => {
  console.log("[add2e] Hook init : override ActorSheet");

  try {
    Actors.unregisterSheet("core", ActorSheet);
  } catch (e) {
    console.warn("[add2e] Impossible de désenregistrer la feuille core ActorSheet :", e);
  }

  Actors.registerSheet("add2e", Add2eActorSheet, {
    types: ["personnage", "monster"],
    makeDefault: true,
    label: "ADD2e Descartes (FR)"
  });

  console.log("[add2e] Feuille acteur ADD2E enregistrée.");
});
