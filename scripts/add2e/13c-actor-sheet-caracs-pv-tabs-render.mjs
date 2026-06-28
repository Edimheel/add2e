// ADD2E — Actor sheet caracs, PV, onglets et rendu — full ApplicationV2
// La progression de classe provient de l’Item classe exact.
// Compatible Foundry V13/V14/V15.

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant 13c.");

const ADD2E_EXCEPTIONAL_STRENGTH_INPUT_VERSION = "2026-06-25-force-ex-class-items-v3";
const ADD2E_HP_MODIFIERS_VERSION = "2026-06-28-generic-hp-modifiers-v1";
globalThis.ADD2E_EXCEPTIONAL_STRENGTH_INPUT_VERSION = ADD2E_EXCEPTIONAL_STRENGTH_INPUT_VERSION;
globalThis.ADD2E_HP_MODIFIERS_VERSION = ADD2E_HP_MODIFIERS_VERSION;

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
  root.querySelectorAll?.("select[name='system.force_ex']")?.forEach(select => {
    select.value = value;
    select.dataset.currentForceEx = value;
  });
}

function add2eNormalizeClassForExceptionalStrength(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f’']/g, "");
}

function add2eActorCanUseExceptionalStrength(actor) {
  const classItems = Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
  return classItems.some(classItem => {
    const text = [
      classItem?.name,
      classItem?.system?.slug,
      classItem?.system?.nom,
      classItem?.system?.name,
      classItem?.system?.label
    ].map(add2eNormalizeClassForExceptionalStrength).join(" ");
    return text.includes("guerrier") || text.includes("paladin") || text.includes("rodeur") || text.includes("ranger");
  });
}
globalThis.add2eActorCanUseExceptionalStrength = add2eActorCanUseExceptionalStrength;

function add2eClone(value) {
  if (typeof foundry?.utils?.deepClone === "function") return foundry.utils.deepClone(value);
  if (typeof foundry?.utils?.duplicate === "function") return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value ?? {}));
}

function add2eNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function add2eUpdateHas(changes, path) {
  if (Object.prototype.hasOwnProperty.call(changes ?? {}, path)) return true;
  return typeof foundry?.utils?.hasProperty === "function" && foundry.utils.hasProperty(changes ?? {}, path);
}

function add2eUpdateRead(changes, path) {
  if (Object.prototype.hasOwnProperty.call(changes ?? {}, path)) return changes[path];
  return foundry?.utils?.getProperty?.(changes ?? {}, path);
}

function add2eUpdateWrite(changes, path, value) {
  changes[path] = value;
}

function add2eHpModifierRegistry(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const registry = {};
  for (const [sourceId, raw] of Object.entries(source)) {
    const id = String(sourceId ?? "").trim();
    if (!id || !raw || typeof raw !== "object") continue;
    const amount = Math.trunc(add2eNumber(raw.amount ?? raw.value ?? raw.bonus, 0));
    if (!amount) continue;
    registry[id] = {
      ...add2eClone(raw),
      amount,
      label: String(raw.label ?? raw.name ?? id)
    };
  }
  return registry;
}

function add2eHpModifierTotal(registry) {
  return Object.values(add2eHpModifierRegistry(registry))
    .reduce((total, modifier) => total + add2eNumber(modifier.amount, 0), 0);
}

function add2eActorHpModifiers(actor) {
  return add2eHpModifierRegistry(
    actor?.getFlag?.("add2e", "hpModifiers")
      ?? actor?.flags?.add2e?.hpModifiers
      ?? {}
  );
}

function add2eActorHpModifierTotal(actor) {
  return add2eHpModifierTotal(add2eActorHpModifiers(actor));
}

function add2eFamiliarLegacyShare(actor, changes = null) {
  const value = changes && add2eUpdateHas(changes, "flags.add2e.familiarHpShare")
    ? add2eUpdateRead(changes, "flags.add2e.familiarHpShare")
    : actor?.getFlag?.("add2e", "familiarHpShare") ?? actor?.flags?.add2e?.familiarHpShare ?? null;
  if (!value || typeof value !== "object") return null;
  const linkId = String(value.linkId ?? actor?.getFlag?.("add2e", "familiar")?.linkId ?? actor?.flags?.add2e?.familiar?.linkId ?? "").trim();
  const amount = Math.max(0, Math.floor(add2eNumber(value.amount, 0)));
  return linkId ? { linkId, amount } : null;
}

function add2eFamiliarModifierSource(linkId) {
  return `familier:${String(linkId ?? "").trim()}`;
}

function add2eFamiliarPenaltySource(linkId) {
  return `familier-penalite:${String(linkId ?? "").trim()}`;
}

function add2eApplyLegacyFamiliarShareToRegistry(actor, changes) {
  const share = add2eFamiliarLegacyShare(actor, changes);
  if (!share) return null;
  const registry = add2eActorHpModifiers(actor);
  const source = add2eFamiliarModifierSource(share.linkId);
  if (share.amount > 0) {
    registry[source] = {
      amount: share.amount,
      label: "Vitalité partagée du familier",
      kind: "familier",
      temporary: true,
      linkId: share.linkId
    };
  } else {
    delete registry[source];
  }
  add2eUpdateWrite(changes, "flags.add2e.hpModifiers", registry);
  return registry;
}

function add2eApplyLegacyFamiliarDeathPenaltyToRegistry(actor, changes) {
  const nextMax = add2eNumber(add2eUpdateRead(changes, "system.points_de_coup"), NaN);
  const previousMax = add2eNumber(actor?.system?.points_de_coup, NaN);
  const linkId = String(actor?.getFlag?.("add2e", "familiar")?.linkId ?? actor?.flags?.add2e?.familiar?.linkId ?? "").trim();
  const penalty = Number.isFinite(previousMax) && Number.isFinite(nextMax) ? Math.max(0, Math.floor(previousMax - nextMax)) : 0;
  if (!linkId || !penalty) return null;
  const registry = add2eActorHpModifiers(actor);
  registry[add2eFamiliarPenaltySource(linkId)] = {
    amount: -penalty,
    label: "Pénalité de mort du familier",
    kind: "familier",
    persistent: true,
    linkId
  };
  add2eUpdateWrite(changes, "flags.add2e.hpModifiers", registry);
  return registry;
}

function add2eApplyHpModifiersPreUpdate(actor, changes = {}, options = {}) {
  if (options?.add2eHpModifiersFinal === true) return;

  const previousRegistry = add2eActorHpModifiers(actor);
  const previousTotal = add2eHpModifierTotal(previousRegistry);
  let registryChanged = add2eUpdateHas(changes, "flags.add2e.hpModifiers");

  if (options?.add2eFamiliarHpShare === true) {
    add2eApplyLegacyFamiliarShareToRegistry(actor, changes);
    return;
  }

  if (options?.add2eFamiliarDeathPenalty === true) {
    add2eApplyLegacyFamiliarDeathPenaltyToRegistry(actor, changes);
    return;
  }

  if (options?.add2eHpModifiersMigration === true) return;

  const nextRegistry = registryChanged
    ? add2eHpModifierRegistry(add2eUpdateRead(changes, "flags.add2e.hpModifiers"))
    : previousRegistry;
  const nextTotal = add2eHpModifierTotal(nextRegistry);
  const nextMaxPresent = add2eUpdateHas(changes, "system.points_de_coup");
  const nextCurrentPresent = add2eUpdateHas(changes, "system.pdv");
  const previousMax = add2eNumber(actor?.system?.points_de_coup, NaN);
  const previousCurrent = add2eNumber(actor?.system?.pdv, NaN);

  if (registryChanged) {
    add2eUpdateWrite(changes, "flags.add2e.hpModifiers", nextRegistry);
    const delta = nextTotal - previousTotal;
    if (!nextMaxPresent && Number.isFinite(previousMax)) {
      add2eUpdateWrite(changes, "system.points_de_coup", Math.max(1, previousMax + delta));
    }
    if (!nextCurrentPresent && Number.isFinite(previousCurrent)) {
      add2eUpdateWrite(changes, "system.pdv", previousCurrent + delta);
    }
    return;
  }

  if (!nextMaxPresent || !previousTotal) return;
  const calculatedBaseMax = add2eNumber(add2eUpdateRead(changes, "system.points_de_coup"), NaN);
  if (!Number.isFinite(calculatedBaseMax)) return;
  add2eUpdateWrite(changes, "system.points_de_coup", Math.max(1, calculatedBaseMax + previousTotal));

  if (!nextCurrentPresent) return;
  const calculatedBaseCurrent = add2eNumber(add2eUpdateRead(changes, "system.pdv"), NaN);
  if (Number.isFinite(calculatedBaseCurrent)) add2eUpdateWrite(changes, "system.pdv", calculatedBaseCurrent + previousTotal);
}

async function add2eSetActorHpModifier(actor, sourceId, modifier = {}, { reason = "hp-modifier" } = {}) {
  if (!actor || !String(sourceId ?? "").trim()) return false;
  const source = String(sourceId).trim();
  const registry = add2eActorHpModifiers(actor);
  const amount = Math.trunc(add2eNumber(modifier.amount ?? modifier.value ?? modifier.bonus, 0));
  if (!amount) delete registry[source];
  else registry[source] = {
    ...add2eClone(registry[source] ?? {}),
    ...add2eClone(modifier),
    amount,
    label: String(modifier.label ?? modifier.name ?? registry[source]?.label ?? source)
  };
  await actor.update({ "flags.add2e.hpModifiers": registry }, {
    add2eHpModifiers: true,
    add2eReason: reason
  });
  return true;
}

async function add2eRemoveActorHpModifier(actor, sourceId, options = {}) {
  return add2eSetActorHpModifier(actor, sourceId, { amount: 0 }, options);
}

async function add2eRecalculateActorHpModifiers(actor, { reason = "hp-modifier-recalculate" } = {}) {
  if (!actor?.system) return false;
  const classes = Array.from(actor.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
  if (classes.length > 1 && typeof globalThis.add2eSyncMulticlassHp === "function") {
    await globalThis.add2eSyncMulticlassHp(actor, { syncCurrent: false, reason });
    return true;
  }
  if (typeof actor.sheet?.autoSetPointsDeCoup === "function") {
    await actor.sheet.autoSetPointsDeCoup({ syncCurrent: false, reason });
    return true;
  }
  return false;
}

async function add2eMigrateLegacyFamiliarHpShare(actor) {
  if (!game.user?.isGM || !actor?.system) return false;
  const share = add2eFamiliarLegacyShare(actor);
  if (!share?.amount) return false;
  const source = add2eFamiliarModifierSource(share.linkId);
  const currentRegistry = add2eActorHpModifiers(actor);
  if (currentRegistry[source]) return false;

  const beforeMax = add2eNumber(actor.system.points_de_coup, NaN);
  const beforeCurrent = add2eNumber(actor.system.pdv, NaN);
  const nextRegistry = {
    ...currentRegistry,
    [source]: {
      amount: share.amount,
      label: "Vitalité partagée du familier",
      kind: "familier",
      temporary: true,
      linkId: share.linkId
    }
  };
  await actor.update({ "flags.add2e.hpModifiers": nextRegistry }, {
    add2eHpModifiersMigration: true,
    add2eReason: "migrate-legacy-familiar-hp-share"
  });

  const recalculated = await add2eRecalculateActorHpModifiers(actor, { reason: "migrate-legacy-familiar-hp-share" });
  if (!recalculated || !Number.isFinite(beforeMax) || !Number.isFinite(beforeCurrent)) return recalculated;
  const delta = add2eNumber(actor.system.points_de_coup, beforeMax) - beforeMax;
  if (!delta) return true;
  await actor.update({ "system.pdv": beforeCurrent + delta }, {
    add2eHpModifiersFinal: true,
    add2eReason: "migrate-legacy-familiar-hp-current"
  });
  return true;
}

function add2eInstallHpModifierRegistry() {
  if (globalThis.__ADD2E_HP_MODIFIER_REGISTRY_VERSION__ === ADD2E_HP_MODIFIERS_VERSION) return;
  globalThis.__ADD2E_HP_MODIFIER_REGISTRY_VERSION__ = ADD2E_HP_MODIFIERS_VERSION;

  Hooks.on("preUpdateActor", add2eApplyHpModifiersPreUpdate);
  Hooks.once("ready", () => {
    if (!game.user?.isGM) return;
    setTimeout(() => {
      for (const actor of game.actors?.contents ?? []) {
        add2eMigrateLegacyFamiliarHpShare(actor).catch(error => console.warn("[ADD2E][HP_MODIFIERS][MIGRATION]", { actor: actor?.name, error }));
      }
    }, 200);
  });

  globalThis.add2eGetActorHpModifiers = actor => add2eClone(add2eActorHpModifiers(actor));
  globalThis.add2eGetActorHpModifierTotal = actor => add2eActorHpModifierTotal(actor);
  globalThis.add2eSetActorHpModifier = add2eSetActorHpModifier;
  globalThis.add2eRemoveActorHpModifier = add2eRemoveActorHpModifier;
  globalThis.add2eRecalculateActorHpModifiers = add2eRecalculateActorHpModifiers;
}

add2eInstallHpModifierRegistry();

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

    if (Object.keys(baseUpdates).length) await this.actor.update(baseUpdates, { add2eInternal: true });

    const totalCaracs = {};
    for (const carac of CARACS_LIST) {
      const base = Number(this.actor.system?.[`${carac}_base`] ?? s[`${carac}_base`] ?? 10) || 10;
      const legacyRace = Number(this.actor.system?.[`${carac}_race`] ?? s[`${carac}_race`] ?? 0) || 0;
      const bonusCaracs = this.actor.system?.bonus_caracteristiques || s.bonus_caracteristiques || {};
      const bonusRace = Number(bonusCaracs?.[carac] ?? 0) || 0;
      totalCaracs[carac] = base + (bonusRace || legacyRace);
    }

    const allowExceptional = add2eActorCanUseExceptionalStrength(this.actor);

    let forceKey = totalCaracs.force;
    const forceEx = Number(s.force_ex || 0);
    if (totalCaracs.force === 18 && allowExceptional) {
      if (forceEx >= 1 && forceEx <= 50) forceKey = "18/01-50";
      else if (forceEx >= 51 && forceEx <= 75) forceKey = "18/51-75";
      else if (forceEx >= 76 && forceEx <= 90) forceKey = "18/76-90";
      else if (forceEx >= 91 && forceEx <= 99) forceKey = "18/91-99";
      else if (forceEx === 100) forceKey = "18/00";
    }

    const forceBonus = (typeof FORCE_TABLE !== "undefined" && FORCE_TABLE?.[forceKey]) || { toucher: 0, degats: 0, poids: 0, ouvrir: "—", tordre: "—" };
    const dexBonus = (typeof DEXTERITE_TABLE !== "undefined" && DEXTERITE_TABLE?.[totalCaracs.dexterite]) || { att: 0, def: 0 };
    const conBonus = (typeof CONSTITUTION_TABLE !== "undefined" && CONSTITUTION_TABLE?.[totalCaracs.constitution]) || { pv: 0, trauma: 0, resu: 0 };
    const intBonus = (typeof INTELLIGENCE_TABLE !== "undefined" && INTELLIGENCE_TABLE?.[totalCaracs.intelligence]) || { langues: 0, chance_sort: 0, min_sort: 0, max_sort: 0, sort_par_niveau: 0 };
    const sagBonus = (typeof SAGESSE_TABLE !== "undefined" && SAGESSE_TABLE?.[totalCaracs.sagesse]) || { magie: 0, sort_suppl: 0, echec: 0 };
    const chaBonus = (typeof CHARISME_TABLE !== "undefined" && CHARISME_TABLE?.[totalCaracs.charisme]) || { compagnons: 0, loy: 0, react: 0 };

    const fullUpdate = {
      "system.for_aff": totalCaracs.force,
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
      "system.con_trauma": Number(conBonus.trauma || 0),
      "system.con_resu": Number(conBonus.resu || 0),
      "system.int_langues": Number(intBonus.langues || 0),
      "system.int_chance_sort": Number(intBonus.chance_sort || 0),
      "system.int_min_sort": Number(intBonus.min_sort || 0),
      "system.int_max_sort": Number(intBonus.max_sort || 0),
      "system.int_sort_par_niveau": Number(intBonus.sort_par_niveau || 0),
      "system.sag_magie": Number(sagBonus.magie || 0),
      "system.sag_sort_suppl": Number(sagBonus.sort_suppl || 0),
      "system.sag_echec": Number(sagBonus.echec || 0),
      "system.cha_compagnons": Number(chaBonus.compagnons || 0),
      "system.cha_loy": Number(chaBonus.loy || 0),
      "system.cha_react": Number(chaBonus.react || 0)
    };

    const diff = {};
    for (const [path, value] of Object.entries(fullUpdate)) {
      if (foundry.utils.getProperty(this.actor, path) !== value) diff[path] = value;
    }

    if (Object.keys(diff).length) await this.actor.update(diff, { add2eInternal: true });
    if (typeof this.autoSetPointsDeCoup === "function") await this.autoSetPointsDeCoup();
  } catch (error) {
    console.error("[ADD2E] Erreur dans autoSetCaracAjustements()", error);
  } finally {
    this._autoSetCaracsInProgress = false;
  }
};

globalThis.Add2eActorSheet.prototype.autoSetPointsDeCoup = async function autoSetPointsDeCoup({ syncCurrent = false, force = false, reason = "unknown" } = {}) {
  try {
    const actor = this.actor;
    if (!actor?.system) return;

    const classes = Array.from(actor.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
    if (classes.length !== 1) return;

    const classDoc = classes[0];
    const cls = classDoc.system ?? null;
    if (!cls) return;

    const level = Math.max(1, Number(cls.niveau ?? cls.level) || 1);
    const hitDie = Number(cls.hitDie || 0);
    if (!Number.isFinite(hitDie) || hitDie <= 0) return;

    const s = actor.system;
    const conBonus = Number(s.con_pv || 0);
    let hpRolls = Array.isArray(s.hpRolls) ? [...s.hpRolls] : [];
    if (force) hpRolls = [];
    if (hpRolls.length < 1 || !Number.isFinite(hpRolls[0])) hpRolls[0] = hitDie;

    for (let index = 1; index < level; index += 1) {
      const current = hpRolls[index];
      if (Number.isFinite(current) && current >= 1 && current <= hitDie) continue;
      hpRolls[index] = 1 + Math.floor(Math.random() * hitDie);
    }

    let hpMax = 0;
    for (let index = 0; index < level; index += 1) hpMax += (index === 0 ? hitDie : (Number(hpRolls[index]) || 1)) + conBonus;
    if (!Number.isFinite(hpMax) || hpMax < 1) hpMax = 1;

    const sameHpRolls = foundry.utils.deepEqual
      ? foundry.utils.deepEqual(s.hpRolls ?? [], hpRolls)
      : JSON.stringify(s.hpRolls ?? []) === JSON.stringify(hpRolls);
    const updates = {};
    if (!sameHpRolls) updates["system.hpRolls"] = hpRolls;
    if (Number(s.points_de_coup) !== hpMax) updates["system.points_de_coup"] = hpMax;
    if (syncCurrent && Number(s.pdv) !== hpMax) updates["system.pdv"] = hpMax;
    if (!Object.keys(updates).length) return;

    await actor.update(updates, { add2eInternal: true, reason });
  } catch (error) {
    console.warn("[ADD2E][HP] Erreur autoSetPointsDeCoup :", error);
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

globalThis.Add2eActorSheet.prototype._add2eBindPersistentTabs = function _add2eBindPersistentTabs(html) {
  const root = this._add2eSheetRoot(html);
  if (!root) return;

  const initial = this._add2eActiveTab || this._add2eReadStoredTab() || "resume";
  this._add2eActivateTab(initial, root);
  add2eSyncForceExSelects(root, this.actor);

  if (root.dataset.add2eTabsCaptureBound !== "1") {
    root.dataset.add2eTabsCaptureBound = "1";
    root.addEventListener("pointerdown", event => {
      const tabLink = event.target.closest?.(".sheet-tabs .item[data-tab], .a2e-tabs .item[data-tab]");
      if (tabLink && root.contains(tabLink)) {
        this._add2eRememberActiveTab(root, tabLink.dataset.tab || "resume");
        return;
      }
      this._add2eRememberActiveTab(root);
    }, true);

    root.addEventListener("change", async event => {
      this._add2eRememberActiveTab(root);
      const field = event.target?.closest?.("[name='system.force_ex']");
      if (!field) return;
      const value = Math.max(0, Math.min(100, Number(field.value) || 0));
      field.value = String(value);
      field.dataset.currentForceEx = String(value);
      await this.actor.update({ "system.force_ex": value });
      if (typeof this.autoSetCaracAjustements === "function") await this.autoSetCaracAjustements();
      add2eSyncForceExSelects(root, this.actor);
      if (this.rendered) this.render(false);
    }, true);
  }

  add2eV2Jq(root).find(".sheet-tabs .item[data-tab], .a2e-tabs .item[data-tab]")
    .off("click.add2e-tabs")
    .on("click.add2e-tabs", event => {
      event.preventDefault();
      const tab = event.currentTarget.dataset.tab || "resume";
      this._add2eActivateTab(tab, root);
    });
};

globalThis.Add2eActorSheet.prototype.render = function render(force = false, options = {}) {
  try { if (this.rendered) this._add2eRememberActiveTab(this.element); } catch (_error) {}

  const renderOptions = (typeof force === "object" && force !== null)
    ? force
    : { ...(options ?? {}), force: !!force };

  const result = this._add2eNativeRender(renderOptions);
  const refreshUi = () => {
    this._add2eActivateTab(this._add2eActiveTab || this._add2eReadStoredTab() || "resume");
    add2eSyncForceExSelects(this._add2eSheetRoot(this.element), this.actor);
    try { add2eEnhanceCharacterSheetUi(this, this.element); } catch (_error) {}
  };
  for (const delay of [0, 80, 220]) setTimeout(refreshUi, delay);
  return result;
};
