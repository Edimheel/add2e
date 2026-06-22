// ADD2E — Actor sheet caracs, PV, onglets et rendu — full ApplicationV2

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant 13c.");

const ADD2E_EXCEPTIONAL_STRENGTH_INPUT_VERSION = "2026-05-29-force-ex-input-v2";
globalThis.ADD2E_EXCEPTIONAL_STRENGTH_INPUT_VERSION = ADD2E_EXCEPTIONAL_STRENGTH_INPUT_VERSION;

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
  const sys = actor?.system ?? {};
  const classItem = actor?.items?.find?.(i => i.type === "classe") ?? null;
  const classText = [
    sys.classe,
    sys.details_classe?.nom,
    sys.details_classe?.name,
    sys.details_classe?.label,
    classItem?.name,
    classItem?.system?.nom,
    classItem?.system?.name,
    classItem?.system?.label
  ].map(add2eNormalizeClassForExceptionalStrength).join(" ");
  return classText.includes("guerrier") || classText.includes("paladin") || classText.includes("ranger");
}

globalThis.Add2eActorSheet.prototype.autoSetCaracAjustements = async function autoSetCaracAjustements() {
  if (this._autoSetCaracsInProgress) return;
  if (!this.actor?.system) return;

  const s = this.actor.system;
  this._autoSetCaracsInProgress = true;

  try {
    const CARACS_LIST = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
    const baseUpdates = {};

    for (const c of CARACS_LIST) {
      const baseKey = `${c}_base`;
      if (typeof s[baseKey] !== "number" || isNaN(s[baseKey])) {
        baseUpdates[`system.${baseKey}`] = Number(s[c]) || 10;
      }
    }

    if (Object.keys(baseUpdates).length) await this.actor.update(baseUpdates, { add2eInternal: true });

    const totalCaracs = {};
    for (const c of CARACS_LIST) {
      const base = Number(this.actor.system?.[`${c}_base`] ?? s[`${c}_base`] ?? 10) || 10;
      const legacyRace = Number(this.actor.system?.[`${c}_race`] ?? s[`${c}_race`] ?? 0) || 0;
      const bonusCaracs = this.actor.system?.bonus_caracteristiques || s.bonus_caracteristiques || {};
      const bonusRace = Number(bonusCaracs?.[c] ?? 0) || 0;
      totalCaracs[c] = base + (bonusRace || legacyRace);
    }

    const allowExceptional =
      !!s.details_classe?.allowExceptionalStrength ||
      add2eActorCanUseExceptionalStrength(this.actor);

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
    for (const [k, v] of Object.entries(fullUpdate)) {
      if (foundry.utils.getProperty(this.actor, k) !== v) diff[k] = v;
    }

    if (Object.keys(diff).length) await this.actor.update(diff, { add2eInternal: true });
    if (typeof this.autoSetPointsDeCoup === "function") await this.autoSetPointsDeCoup();
  } catch (e) {
    console.error("[ADD2E] Erreur dans autoSetCaracAjustements()", e);
  } finally {
    this._autoSetCaracsInProgress = false;
  }
};

globalThis.Add2eActorSheet.prototype.autoSetPointsDeCoup = async function autoSetPointsDeCoup({ syncCurrent = false, force = false, reason = "unknown" } = {}) {
  try {
    const actor = this.actor;
    if (!actor?.system) return;

    const s = actor.system;
    const lvl = Math.max(1, Number(s.niveau) || 1);
    const classeItem = actor.items?.find(i => i.type === "classe");
    const cls = classeItem?.system || s.details_classe || null;
    if (!cls) return;

    const hitDie = Number(cls.hitDie || 0);
    if (!Number.isFinite(hitDie) || hitDie <= 0) return;

    const conBonus = Number(s.con_pv || 0);
    let hpRolls = Array.isArray(s.hpRolls) ? [...s.hpRolls] : [];
    if (force) hpRolls = [];
    if (hpRolls.length < 1 || !Number.isFinite(hpRolls[0])) hpRolls[0] = hitDie;

    for (let i = 1; i < lvl; i++) {
      const cur = hpRolls[i];
      if (Number.isFinite(cur) && cur >= 1 && cur <= hitDie) continue;
      hpRolls[i] = 1 + Math.floor(Math.random() * hitDie);
    }

    let hpMax = 0;
    for (let i = 0; i < lvl; i++) hpMax += (i === 0 ? hitDie : (Number(hpRolls[i]) || 1)) + conBonus;
    if (!Number.isFinite(hpMax) || hpMax < 1) hpMax = 1;

    const sameHpRolls = foundry.utils.deepEqual
      ? foundry.utils.deepEqual(s.hpRolls ?? [], hpRolls)
      : JSON.stringify(s.hpRolls ?? []) === JSON.stringify(hpRolls);
    const up = {};
    if (!sameHpRolls) up["system.hpRolls"] = hpRolls;
    if (Number(s.points_de_coup) !== hpMax) up["system.points_de_coup"] = hpMax;
    if (syncCurrent && Number(s.pdv) !== hpMax) up["system.pdv"] = hpMax;
    if (!Object.keys(up).length) return;

    await actor.update(up, { add2eInternal: true, reason });
  } catch (e) {
    console.warn("[ADD2E][HP] Erreur autoSetPointsDeCoup :", e);
  }
};

globalThis.Add2eActorSheet.prototype._enableCaracClickAssign = function _enableCaracClickAssign(roller) {
  add2eV2Jq(this.element).find('.carac-drop-target').each((_i, el) => {
    el.classList.add("clickable");
    el.onclick = () => {
      const carac = el.dataset.carac;
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
  catch (_e) { return null; }
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
  try { sessionStorage.setItem(this._add2eTabStorageKey(), tab); } catch (_e) {}
  const hidden = this._add2eSheetRoot(html)?.querySelector?.(".a2e-active-tab-input");
  if (hidden) hidden.value = tab;
  return tab;
};

globalThis.Add2eActorSheet.prototype._add2eActivateTab = function _add2eActivateTab(tabName = null, html = null) {
  const root = this._add2eSheetRoot(html);
  if (!root) return;
  const tab = tabName || this._add2eActiveTab || this._add2eReadStoredTab() || "resume";
  this._add2eRememberActiveTab(root, tab);

  root.querySelectorAll(".sheet-tabs .item[data-tab], .a2e-tabs .item[data-tab]").forEach(el => {
    el.classList.toggle("active", el.dataset.tab === tab);
  });

  root.querySelectorAll(".sheet-body .tab[data-tab], .a2e-tab-content[data-tab]").forEach(el => {
    el.classList.toggle("active", el.dataset.tab === tab);
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
    root.addEventListener("pointerdown", ev => {
      const tabLink = ev.target.closest?.(".sheet-tabs .item[data-tab], .a2e-tabs .item[data-tab]");
      if (tabLink && root.contains(tabLink)) {
        this._add2eRememberActiveTab(root, tabLink.dataset.tab || "resume");
        return;
      }
      this._add2eRememberActiveTab(root);
    }, true);
    root.addEventListener("change", async ev => {
      this._add2eRememberActiveTab(root);
      const field = ev.target?.closest?.("[name='system.force_ex']");
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
    .on("click.add2e-tabs", ev => {
      ev.preventDefault();
      const tab = ev.currentTarget.dataset.tab || "resume";
      this._add2eActivateTab(tab, root);
    });
};

globalThis.Add2eActorSheet.prototype.render = function render(force = false, options = {}) {
  try { if (this.rendered) this._add2eRememberActiveTab(this.element); } catch (_e) {}

  const renderOptions = (typeof force === "object" && force !== null)
    ? force
    : { ...(options ?? {}), force: !!force };

  const result = this._add2eNativeRender(renderOptions);
  const refreshUi = () => {
    this._add2eActivateTab(this._add2eActiveTab || this._add2eReadStoredTab() || "resume");
    add2eSyncForceExSelects(this._add2eSheetRoot(this.element), this.actor);
    try { add2eEnhanceCharacterSheetUi(this, this.element); } catch (_err) {}
  };
  for (const delay of [0, 80, 220]) setTimeout(refreshUi, delay);
  return result;
};
