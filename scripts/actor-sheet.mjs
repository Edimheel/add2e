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





// =====================================================
// ONGLET ACTIF — PERSISTANCE ROBUSTE V15
// =====================================================
// Problème corrigé : quand une action de feuille déclenche un rerender
// (équiper une arme, éditer un item, modifier un champ), Foundry reconstruit
// le HTML. On mémorise donc l'onglet AVANT toute action dans la feuille,
// puis on le restaure après chaque reconstruction du DOM.

const ADD2E_ACTOR_TAB_KEY = "add2e.actorSheet.activeTab.";
globalThis.ADD2E_ACTOR_TABS_LAST ??= {};

function add2eSheetActorId(sheet) {
  if (!sheet) return "unknown";

  const fromSheet =
    sheet.dataset?.actorId ||
    sheet.getAttribute?.("data-actor-id") ||
    sheet.closest?.("[data-actor-id]")?.dataset?.actorId ||
    sheet.closest?.("[data-document-id]")?.dataset?.documentId ||
    "";

  if (fromSheet) return String(fromSheet);

  const app = sheet.closest?.(".application, .app, .window-app");
  const appId = app?.dataset?.appid || app?.id || "";

  return appId ? `app:${appId}` : "unknown";
}

function add2eSheetStorageKeys(sheet) {
  const actorId = add2eSheetActorId(sheet);
  return [
    `${ADD2E_ACTOR_TAB_KEY}${actorId}`,
    `${ADD2E_ACTOR_TAB_KEY}last`
  ];
}

function add2eSheetCurrentTab(sheet) {
  if (!sheet) return "resume";

  return (
    sheet.querySelector(".a2e-tabs .item.active[data-tab]")?.dataset?.tab ||
    sheet.querySelector(".sheet-body .a2e-tab-content.active[data-tab]")?.dataset?.tab ||
    sheet.querySelector(".a2e-active-tab-input")?.value ||
    sheet.dataset?.activeTab ||
    "resume"
  );
}

function add2eSheetRememberTab(sheet, tabName = null) {
  if (!sheet) return;

  const tab = tabName || add2eSheetCurrentTab(sheet) || "resume";

  sheet.dataset.activeTab = tab;

  const hidden = sheet.querySelector(".a2e-active-tab-input");
  if (hidden) hidden.value = tab;

  for (const key of add2eSheetStorageKeys(sheet)) {
    try {
      sessionStorage.setItem(key, tab);
      localStorage.setItem(key, tab);
    } catch (e) {}
  }

  globalThis.ADD2E_ACTOR_TABS_LAST[add2eSheetActorId(sheet)] = tab;
  globalThis.ADD2E_ACTOR_TABS_LAST.last = tab;
}

function add2eSheetStoredTab(sheet) {
  if (!sheet) return "resume";

  const actorId = add2eSheetActorId(sheet);
  const keys = add2eSheetStorageKeys(sheet);

  return (
    globalThis.ADD2E_ACTOR_TABS_LAST[actorId] ||
    globalThis.ADD2E_ACTOR_TABS_LAST.last ||
    keys.map(k => {
      try { return sessionStorage.getItem(k); } catch (e) { return null; }
    }).find(Boolean) ||
    keys.map(k => {
      try { return localStorage.getItem(k); } catch (e) { return null; }
    }).find(Boolean) ||
    sheet.querySelector(".a2e-active-tab-input")?.value ||
    "resume"
  );
}

function add2eSheetActivateTab(sheet, tabName = "resume") {
  if (!sheet) return;

  const tab = tabName || "resume";

  sheet.dataset.activeTab = tab;

  const hidden = sheet.querySelector(".a2e-active-tab-input");
  if (hidden) hidden.value = tab;

  sheet.querySelectorAll(".a2e-tabs .item[data-tab]").forEach(link => {
    link.classList.toggle("active", link.dataset.tab === tab);
  });

  sheet.querySelectorAll(".sheet-body .a2e-tab-content[data-tab]").forEach(section => {
    section.classList.toggle("active", section.dataset.tab === tab);
  });
}

function add2eSheetRestoreTab(sheet) {
  if (!sheet) return;

  const tab = add2eSheetStoredTab(sheet) || "resume";

  add2eSheetActivateTab(sheet, tab);
  add2eSheetRememberTab(sheet, tab);
}

function add2eRestoreAllActorSheetTabs() {
  for (const sheet of document.querySelectorAll(".add2e-character-v3")) {
    add2eSheetRestoreTab(sheet);
  }
}

function add2eInstallActorSheetTabPersistence() {
  if (globalThis.ADD2E_ACTOR_SHEET_TABS_V15_INSTALLED) return;
  globalThis.ADD2E_ACTOR_SHEET_TABS_V15_INSTALLED = true;

  // 1) Mémorise l'onglet courant AVANT n'importe quel clic dans la fiche
  //    (équiper une arme, supprimer, modifier, lancer un sort, etc.).
  document.addEventListener("pointerdown", event => {
    const sheet = event.target.closest?.(".add2e-character-v3");
    if (!sheet) return;

    const tabLink = event.target.closest?.(".a2e-tabs .item[data-tab]");
    if (tabLink) {
      add2eSheetActivateTab(sheet, tabLink.dataset.tab || "resume");
      add2eSheetRememberTab(sheet, tabLink.dataset.tab || "resume");
      return;
    }

    add2eSheetRememberTab(sheet);
  }, true);

  // 2) Clic direct sur les onglets.
  document.addEventListener("click", event => {
    const link = event.target.closest?.(".add2e-character-v3 .a2e-tabs .item[data-tab]");
    if (!link) return;

    event.preventDefault();

    const sheet = link.closest(".add2e-character-v3");
    const tab = link.dataset.tab || "resume";

    add2eSheetActivateTab(sheet, tab);
    add2eSheetRememberTab(sheet, tab);

    const actorId = add2eSheetActorId(sheet);
    const actor = game.actors?.get(actorId);
    if (actor?.isOwner) {
      actor.setFlag("add2e", "activeSheetTab", tab).catch(() => {});
    }
  }, true);

  // 3) Avant toute saisie, garde l'onglet courant.
  document.addEventListener("change", event => {
    const sheet = event.target.closest?.(".add2e-character-v3");
    if (sheet) add2eSheetRememberTab(sheet);
  }, true);

  document.addEventListener("submit", event => {
    const sheet = event.target.closest?.(".add2e-character-v3");
    if (sheet) add2eSheetRememberTab(sheet);
  }, true);

  // 4) Restaure après les hooks Foundry classiques.
  const delayedRestore = () => {
    requestAnimationFrame(() => {
      add2eRestoreAllActorSheetTabs();
      setTimeout(add2eRestoreAllActorSheetTabs, 30);
      setTimeout(add2eRestoreAllActorSheetTabs, 120);
    });
  };

  Hooks.on("renderAdd2eActorSheet", delayedRestore);
  Hooks.on("renderActorSheet", delayedRestore);
  Hooks.on("renderApplication", delayedRestore);
  Hooks.on("updateActor", delayedRestore);
  Hooks.on("updateItem", delayedRestore);
  Hooks.on("createItem", delayedRestore);
  Hooks.on("deleteItem", delayedRestore);

  // 5) Restaure après reconstruction DOM, même si aucun hook spécialisé ne passe.
  const observer = new MutationObserver(() => delayedRestore());
  observer.observe(document.body, { childList: true, subtree: true });

  delayedRestore();

  console.log("[ADD2E][TABS] Persistance robuste V15 installée.");
}

if (game?.ready) {
  add2eInstallActorSheetTabPersistence();
} else {
  Hooks.once("ready", add2eInstallActorSheetTabPersistence);
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
