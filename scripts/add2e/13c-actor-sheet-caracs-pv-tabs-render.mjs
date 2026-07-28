// ADD2E — Actor sheet caracs, onglets et rendu — full ApplicationV2
// La progression de classe provient de l’Item classe exact.
// Le calcul métier des points de vie appartient au service canonique de progression.
// Compatible Foundry V13/V14/V15.

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant 13c.");

const ADD2E_EXCEPTIONAL_STRENGTH_INPUT_VERSION = "2026-07-26-force-ex-canonical-derived-profile-v7";
const ADD2E_ABILITY_CONSUMER_VERSION = "2026-07-28-character-sheet-without-hit-point-calculator-v5";
globalThis.ADD2E_EXCEPTIONAL_STRENGTH_INPUT_VERSION = ADD2E_EXCEPTIONAL_STRENGTH_INPUT_VERSION;
globalThis.ADD2E_ABILITY_CONSUMER_VERSION = ADD2E_ABILITY_CONSUMER_VERSION;

function add2eV2Root(source) {
  if (!source) return null;
  const root = source.jquery ? source[0] : source;
  if (!root) return null;
  if (root.matches?.(".add2e-character-v3")) return root;
  return root.querySelector?.(".add2e-character-v3") || root;
}

function add2eV2Jq(source) {
  if (!source) return $();
  return source.jquery ? source : $(source);
}

function add2eSyncForceExSelects(root, actor) {
  if (!root || !actor?.system) return;
  const value = String(Math.max(0, Math.min(100, Number(actor.system.force_ex) || 0)));
  root.querySelectorAll?.("select[data-add2e-force-ex]")?.forEach(select => {
    select.value = value;
    select.dataset.currentForceEx = value;
  });
}

function add2eAbilityDerivedResolution(actor, ability, context = {}) {
  const engine = globalThis.ADD2E_EFFECTS;
  if (!engine || typeof engine.resolveAbilityDerived !== "function") {
    throw new Error("Le résolveur canonique ADD2E des ajustements de caractéristiques n’est pas disponible.");
  }
  return engine.resolveAbilityDerived(actor, ability, context);
}

async function add2eSetExceptionalStrength(actor, rawValue, { reason = "force-ex-selection" } = {}) {
  if (!actor?.system) return false;

  const selected = Math.trunc(Number(rawValue));
  const forceEx = Number.isFinite(selected) && selected >= 0 && selected <= 100 ? selected : 0;
  const forceDerived = add2eAbilityDerivedResolution(actor, "force", {
    source: "exceptional-strength-selection",
    consumer: "application-v2"
  });
  const allowed = forceDerived?.exceptionalStrength?.eligible === true;
  const stored = allowed ? forceEx : 0;

  if (Number(actor.system?.force_ex ?? 0) !== stored) {
    await actor.update({ "system.force_ex": stored }, {
      add2eInternal: true,
      add2eReason: reason,
      render: false
    });
  }

  const sheet = actor.sheet;
  if (typeof sheet?.autoSetCaracAjustements === "function") await sheet.autoSetCaracAjustements();
  return true;
}
globalThis.add2eSetExceptionalStrength = add2eSetExceptionalStrength;

function add2eClone(value) {
  if (typeof foundry?.utils?.deepClone === "function") return foundry.utils.deepClone(value);
  if (typeof foundry?.utils?.duplicate === "function") return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value ?? {}));
}

function add2eValuesEqual(left, right) {
  if (typeof foundry?.utils?.deepEqual === "function") return foundry.utils.deepEqual(left, right);
  return JSON.stringify(left) === JSON.stringify(right);
}

globalThis.Add2eActorSheet.prototype.autoSetCaracAjustements = async function autoSetCaracAjustements() {
  if (this._autoSetCaracsInProgress) return;
  if (!this.actor?.system) return;

  const s = this.actor.system;
  this._autoSetCaracsInProgress = true;

  try {
    const CARACS_LIST = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
    const baseUpdates = {};

    for (const carac of CARACS_LIST) {
      const baseKey = `${carac}_base`;
      if (typeof s[baseKey] !== "number" || Number.isNaN(s[baseKey])) {
        baseUpdates[`system.${baseKey}`] = Number(s[carac]) || 10;
      }
    }

    if (Object.keys(baseUpdates).length) {
      await this.actor.update(baseUpdates, { add2eInternal: true, add2eReason: "ability-base-initialize" });
    }

    const derived = Object.fromEntries(CARACS_LIST.map(carac => [
      carac,
      add2eAbilityDerivedResolution(this.actor, carac, {
        source: "actor-sheet-characteristics",
        consumer: "application-v2"
      })
    ]));
    const totalCaracs = Object.fromEntries(CARACS_LIST.map(carac => [carac, derived[carac].total]));
    const forceDerived = derived.force;
    const storedForceEx = forceDerived.exceptionalStrength?.eligible === true
      ? Math.max(0, Math.min(100, Math.trunc(Number(this.actor.system?.force_ex) || 0)))
      : 0;
    const forceBonus = forceDerived.profile;
    const dexBonus = derived.dexterite.profile;
    const conBonus = derived.constitution.profile;
    const intBonus = derived.intelligence.profile;
    const sagBonus = derived.sagesse.profile;
    const chaBonus = derived.charisme.profile;

    const fullUpdate = {
      "system.force_ex": storedForceEx,
      "system.for_aff": forceDerived.displayValue,
      "system.dex_aff": totalCaracs.dexterite,
      "system.con_aff": totalCaracs.constitution,
      "system.int_aff": totalCaracs.intelligence,
      "system.sag_aff": totalCaracs.sagesse,
      "system.cha_aff": totalCaracs.charisme,
      "system.force_bonus_toucher": Number(forceBonus.toucher || 0),
      "system.force_bonus_degats": Number(forceBonus.degats || 0),
      "system.force_poids": forceBonus.poids ?? 0,
      "system.force_ouvrir": forceBonus.ouvrir ?? "—",
      "system.force_tordre": forceBonus.tordre ?? "—",
      "system.force_bonus_porte": forceBonus.ouvrir ?? "—",
      "system.charge_max": typeof forceBonus.poids === "number" ? forceBonus.poids : 0,
      "system.charge_max_bench": typeof forceBonus.poids === "number" ? forceBonus.poids : 0,
      "system.dex_att": Number(dexBonus.att || 0),
      "system.dex_def": Number(dexBonus.def || 0),
      "system.con_pv": Number(conBonus.pv || 0),
      "system.con_pv_guerrier": Number(conBonus.pv_guerrier ?? conBonus.pv ?? 0),
      "system.con_trauma": Number(conBonus.trauma || 0),
      "system.con_resu": Number(conBonus.resu || 0),
      "system.con_poison": Number(conBonus.poison || 0),
      "system.con_regeneration": conBonus.regeneration ?? null,
      "system.int_langues": Number(intBonus.langues || 0),
      "system.int_chance_sort": Number(intBonus.chance_sort || 0),
      "system.int_min_sort": Number(intBonus.min_sort || 0),
      "system.int_max_sort": intBonus.max_sort ?? 0,
      "system.int_sort_par_niveau": intBonus.sort_par_niveau ?? 0,
      "system.int_niveau_sort_max": Number(intBonus.niveau_sort_max || 0),
      "system.int_immunites_illusions": add2eClone(Array.isArray(intBonus.immunitesIllusions) ? intBonus.immunitesIllusions : []),
      "system.sag_magie": Number(sagBonus.magie || 0),
      "system.sag_bonus_sorts_par_niveau": add2eClone(sagBonus.bonusSortsParNiveau ?? {}),
      "system.sag_echec": Number(sagBonus.echec || 0),
      "system.sag_immunites_sorts": add2eClone(Array.isArray(sagBonus.immunitesSorts) ? sagBonus.immunitesSorts : []),
      "system.cha_compagnons": Number(chaBonus.compagnons || 0),
      "system.cha_loy": Number(chaBonus.loy || 0),
      "system.cha_react": Number(chaBonus.react || 0)
    };

    const diff = {};
    for (const [path, value] of Object.entries(fullUpdate)) {
      if (!add2eValuesEqual(foundry.utils.getProperty(this.actor, path), value)) diff[path] = value;
    }
    if (Object.prototype.hasOwnProperty.call(this.actor.system ?? {}, "sag_sort_suppl")) diff["system.-=sag_sort_suppl"] = null;
    if (Object.prototype.hasOwnProperty.call(this.actor.system ?? {}, "sagesse_sorts_bonus")) diff["system.-=sagesse_sorts_bonus"] = null;

    if (Object.keys(diff).length) {
      await this.actor.update(diff, { add2eInternal: true, add2eReason: "ability-derived-recalculate" });
    }
    if (typeof globalThis.add2eRecalculateHitPoints === "function") {
      await globalThis.add2eRecalculateHitPoints(this.actor, { reason: "ability-derived-recalculate" });
    }
  } catch (error) {
    console.error("[ADD2E] Erreur dans autoSetCaracAjustements()", error);
  } finally {
    this._autoSetCaracsInProgress = false;
  }
};

globalThis.Add2eActorSheet.prototype._enableCaracClickAssign = function _enableCaracClickAssign(roller) {
  add2eV2Jq(this.element).find(".carac-drop-target").each((_index, element) => {
    element.classList.add("clickable");
    element.onclick = () => {
      const carac = element.dataset.carac;
      if (roller.assigned[carac] !== undefined) roller.unassignCarac(carac);
      else roller.assignToCarac(carac);
    };
  });
};

globalThis.Add2eActorSheet.prototype._add2eTabStorageKey = function _add2eTabStorageKey() {
  return `add2e.actor.${this.actor?.id || "unknown"}.activeTab`;
};

globalThis.Add2eActorSheet.prototype._add2eReadStoredTab = function _add2eReadStoredTab() {
  try { return sessionStorage.getItem(this._add2eTabStorageKey()) || null; }
  catch (_error) { return null; }
};

globalThis.Add2eActorSheet.prototype._add2eSheetRoot = function _add2eSheetRoot(html = null) {
  return add2eV2Root(html ?? this.element);
};

globalThis.Add2eActorSheet.prototype._add2eCurrentTabFromHtml = function _add2eCurrentTabFromHtml(html = null) {
  const root = this._add2eSheetRoot(html);
  if (!root) return this._add2eActiveTab || this._add2eReadStoredTab() || "resume";
  return root.querySelector(".a2e-tabs .item.active[data-tab]")?.dataset?.tab
    || root.querySelector(".sheet-body .a2e-tab-content.active[data-tab]")?.dataset?.tab
    || root.querySelector(".a2e-active-tab-input")?.value
    || this._add2eActiveTab
    || this._add2eReadStoredTab()
    || "resume";
};

globalThis.Add2eActorSheet.prototype._add2eRememberActiveTab = function _add2eRememberActiveTab(html = null, explicitTab = null) {
  const tab = explicitTab || this._add2eCurrentTabFromHtml(html) || "resume";
  this._add2eActiveTab = tab;
  this._add2eSetNativeActiveTab?.(tab);
  try { sessionStorage.setItem(this._add2eTabStorageKey(), tab); } catch (_error) {}
  const hidden = this._add2eSheetRoot(html)?.querySelector?.(".a2e-active-tab-input");
  if (hidden) hidden.value = tab;
  return tab;
};

globalThis.Add2eActorSheet.prototype._add2eActivateTab = function _add2eActivateTab(tabName = null, html = null) {
  const root = this._add2eSheetRoot(html);
  if (!root) return;
  const tab = tabName || this._add2eActiveTab || this._add2eReadStoredTab() || "resume";
  this._add2eRememberActiveTab(root, tab);

  root.querySelectorAll(".sheet-tabs .item[data-tab], .a2e-tabs .item[data-tab]").forEach(element => {
    element.classList.toggle("active", element.dataset.tab === tab);
  });

  root.querySelectorAll(".sheet-body .tab[data-tab], .a2e-tab-content[data-tab]").forEach(element => {
    element.classList.toggle("active", element.dataset.tab === tab);
  });

  add2eSyncForceExSelects(root, this.actor);
};
