// scripts/actor-sheet.mjs

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

// =====================================================
// OUTILS
// =====================================================

function add2eRaceAbilityValue(adjustments, shortKey, longKey) {
  return Number(adjustments?.[shortKey] ?? adjustments?.[longKey] ?? 0);
}

function add2eToTextList(value) {
  if (!value) return "";

  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    return Object.values(value).filter(Boolean).join(", ");
  }

  return String(value);
}

function add2eToMultilineText(value) {
  if (!value) return "";

  if (Array.isArray(value)) {
    return value.filter(Boolean).join("\n");
  }

  if (typeof value === "object") {
    return Object.values(value).filter(Boolean).join("\n");
  }

  return String(value);
}

function add2eNormalizeTags(raw) {
  const result = [];

  const add = (v) => {
    if (!v) return;

    if (Array.isArray(v)) {
      for (const x of v) add(x);
      return;
    }

    if (v instanceof Set) {
      for (const x of Array.from(v)) add(x);
      return;
    }

    if (typeof v === "object") {
      if (Array.isArray(v.value)) add(v.value);
      else if (Array.isArray(v.tags)) add(v.tags);
      else if (Array.isArray(v.list)) add(v.list);
      else if (typeof v.value === "string") add(v.value);
      return;
    }

    String(v)
      .split(/[,;]+/)
      .map(t => t.trim())
      .filter(Boolean)
      .forEach(t => result.push(t));
  };

  add(raw);

  return [...new Set(result)];
}

async function add2eUpdateFinalCaracsLocal(actor) {
  if (!actor) return;

  const CARACS = [
    "force",
    "dexterite",
    "constitution",
    "intelligence",
    "sagesse",
    "charisme"
  ];

  const updates = {};

  for (const c of CARACS) {
    const base = Number(getProperty(actor.system, `${c}_base`) ?? 10);
    const bonusRace = Number(getProperty(actor.system, `bonus_caracteristiques.${c}`) ?? 0);
    const bonusDivers = Number(getProperty(actor.system, `bonus_divers_caracteristiques.${c}`) ?? 0);

    updates[`system.${c}`] = base + bonusRace + bonusDivers;
  }

  await actor.update(updates);
}

// =====================================================
// FEUILLE ACTEUR ADD2E
// =====================================================

export class Add2eActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "actor", "personnage"],
      template: "systems/add2e/templates/actor/character-sheet.hbs",
      width: 800,
      height: 900
    });
  }

  async getData(opts) {
    const ctx = await super.getData(opts);

    ctx.actor = this.actor;
    ctx.system = this.actor.system;
    ctx.items = this.actor.items?.contents ?? [];
    ctx.isGM = game.user.isGM;

    return ctx;
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

      const adjustments =
        item.system?.abilityAdjustments ||
        item.system?.data?.abilityAdjustments ||
        item.system?.bonus_caracteristiques ||
        {};

      const engineTags =
        globalThis.Add2eEffectsEngine?.getRacialTagsForRace?.(raceName) ?? [];

      const itemTags = [
        ...add2eNormalizeTags(item.system?.tags),
        ...add2eNormalizeTags(item.system?.effectTags),
        ...add2eNormalizeTags(item.flags?.add2e?.tags)
      ];

      const racialTags = [...new Set([...engineTags, ...itemTags])];

      const maj = {
        "system.race": raceName,

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
          add2eToTextList(item.system?.languages ?? item.system?.langues),

        "system.special_racial":
          add2eToMultilineText(item.system?.specialAbilities ?? item.system?.special_racial)
      };

      console.log("[add2e] Application race :", {
        race: raceName,
        maj,
        racialTags
      });

      await this.actor.update(maj);
      await this.actor.setFlag("add2e", "racialTags", racialTags);

      await add2eUpdateFinalCaracsLocal(this.actor);

      ui.notifications.info(`Race "${raceName}" appliquée au personnage avec ses effets raciaux.`);
      return;
    }

    // =====================================================
    // DROP CLASSE
    // =====================================================
    if (item.type !== "classe") {
      return;
    }

    const classeSystem = foundry.utils.deepClone(item.system ?? {});

    const maj = {
      "system.classe": item.name,
      "system.nom": this.actor.name,
      "system.niveau": 1,

      "system.points_de_coup":
        Number(item.system?.hitDie ?? item.system?.dv ?? 8),

      "system.special":
        add2eToMultilineText(item.system?.specialAbilities ?? item.system?.special),

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

      // Données complètes de classe conservées pour les moteurs :
      // sauvegardes, progression, sorts, armes autorisées, armures, etc.
      "system.details_classe": {
        ...classeSystem,
        name: item.name,
        label: item.name
      }
    };

    console.log("[add2e] Application classe :", {
      classe: item.name,
      maj
    });

    await this.actor.update(maj);

    ui.notifications.info(`Classe "${item.name}" appliquée au personnage.`);
  }
}

globalThis.Add2eActorSheet = Add2eActorSheet;

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