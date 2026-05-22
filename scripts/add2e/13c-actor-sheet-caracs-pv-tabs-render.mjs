// ADD2E — Actor sheet caracs, PV, onglets et rendu extraits de 13-actor-sheet-legacy.mjs


if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant autoSetCaracAjustements.");

globalThis.Add2eActorSheet.prototype.autoSetCaracAjustements = async function autoSetCaracAjustements() {
  if (this._autoSetCaracsInProgress) return;
  if (!this.actor || !this.actor.system) return;

  const s = this.actor.system;
  this._autoSetCaracsInProgress = true;

  try {
    // ============================
    // 1) Initialisation des *_base
    // ============================
    const CARACS_LIST = ["force","dexterite","constitution","intelligence","sagesse","charisme"];
    let baseUpdates = {};

    for (const c of CARACS_LIST) {
      const baseKey = `${c}_base`;
      if (typeof s[baseKey] !== "number" || isNaN(s[baseKey])) {
        baseUpdates[`system.${baseKey}`] = Number(s[c]) || 10;
      }
    }

    if (Object.keys(baseUpdates).length > 0) {
      await this.actor.update(baseUpdates);
    }

    // =====================================
    // 2) Totaux caracs (base + bonus race)
    //    (compat: *_race OU bonus_caracteristiques.*)
    // =====================================
    const totalCaracs = {};
    for (const c of CARACS_LIST) {
      const base = Number(this.actor.system?.[`${c}_base`] ?? s[`${c}_base`] ?? 10) || 10;

      // compat anciens champs "*_race"
      const legacyRace = Number(this.actor.system?.[`${c}_race`] ?? s[`${c}_race`] ?? 0) || 0;

      // champ actuel dans ta feuille: bonus_caracteristiques.force etc.
      const bonusCaracs = this.actor.system?.bonus_caracteristiques || s.bonus_caracteristiques || {};
      const bonusRace = Number(bonusCaracs?.[c] ?? 0) || 0;

      totalCaracs[c] = base + (bonusRace || legacyRace);
    }

    // Valeurs d'affichage (utilisées dans _fullUpdate)
    const forAff = totalCaracs.force;
    const dexAff = totalCaracs.dexterite;
    const conAff = totalCaracs.constitution;
    const intAff = totalCaracs.intelligence;
    const sagAff = totalCaracs.sagesse;
    const chaAff = totalCaracs.charisme;

    // ============================
    // 3) FORCE (inclut 18/xx)
    // ============================
    // Normalisation robuste (accents, apostrophes)
    const classeStr = String(s.classe || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f’']/g, "");

    // Flag porté par la classe (si tu le stockes dans details_classe)
    const allowExFromClass =
      !!(s.details_classe?.allowExceptionalStrength || s.details_classe?.allowExceptionalStrength === true);

    // Compat rétro : si pas de flag, on garde l'ancien test par nom
    const allowExLegacy =
      classeStr.includes("guerrier") || classeStr.includes("paladin") || classeStr.includes("rodeur") || classeStr.includes("ranger");

    const allowExceptional = allowExFromClass || allowExLegacy;

    let valForce = totalCaracs.force;
    let forceEx = Number(s.force_ex || 0);
    let forceKey = valForce;

    if (valForce === 18 && allowExceptional) {
      if (forceEx >= 1 && forceEx <= 50)       forceKey = "18/01-50";
      else if (forceEx >= 51 && forceEx <= 75) forceKey = "18/51-75";
      else if (forceEx >= 76 && forceEx <= 90) forceKey = "18/76-90";
      else if (forceEx >= 91 && forceEx <= 99) forceKey = "18/91-99";
      else if (forceEx === 100)                forceKey = "18/00";
    }

    // IMPORTANT: évite ReferenceError
    let forceBonus = { toucher: 0, degats: 0, poids: 0, ouvrir: "—", tordre: "—" };
    if (typeof FORCE_TABLE !== "undefined" && FORCE_TABLE && FORCE_TABLE[forceKey]) {
      forceBonus = FORCE_TABLE[forceKey];
    }

    const forBonusToucher = Number(forceBonus.toucher || 0);
    const forBonusDegats  = Number(forceBonus.degats  || 0);

    // Compat ancienne feuille vs nouvelle (tu affiches désormais force_poids/ouvrir/tordre)
    const forcePoids  = forceBonus.poids ?? 0;
    const forceOuvrir = forceBonus.ouvrir ?? "—";
    const forceTordre = forceBonus.tordre ?? "—";

    // (Legacy) certains endroits de ton code utilisaient "force_bonus_porte" / charges
    const forBonusPorte = forceOuvrir;

    // Charge max (si tu avais déjà ces champs ailleurs; fallback neutre sinon)
    const chargeMax      = (typeof forcePoids === "number") ? forcePoids : 0;
    const chargeMaxBench = (typeof forcePoids === "number") ? forcePoids : 0;

    // ============================
    // 4) AUTRES TABLES (si présentes)
    // ============================
    const dexBonus = (typeof DEXTERITE_TABLE !== "undefined" && DEXTERITE_TABLE?.[dexAff]) || { att: 0, def: 0 };
    const conBonus = (typeof CONSTITUTION_TABLE !== "undefined" && CONSTITUTION_TABLE?.[conAff]) || { pv: 0, trauma: 0, resu: 0 };
    const intBonus = (typeof INTELLIGENCE_TABLE !== "undefined" && INTELLIGENCE_TABLE?.[intAff]) || { langues: 0, chance_sort: 0, min_sort: 0, max_sort: 0, sort_par_niveau: 0 };
    const sagBonus = (typeof SAGESSE_TABLE !== "undefined" && SAGESSE_TABLE?.[sagAff]) || { magie: 0, sort_suppl: 0, echec: 0 };
    const chaBonus = (typeof CHARISME_TABLE !== "undefined" && CHARISME_TABLE?.[chaAff]) || { compagnons: 0, loy: 0, react: 0 };

    // ============================
    // 5) Update global + diff
    // ============================
    const _fullUpdate = {
      // Affichages
      "system.for_aff": forAff,
      "system.dex_aff": dexAff,
      "system.con_aff": conAff,
      "system.int_aff": intAff,
      "system.sag_aff": sagAff,
      "system.cha_aff": chaAff,

      // Force (nouveaux champs affichés sur ta feuille)
      "system.force_bonus_toucher": forBonusToucher,
      "system.force_bonus_degats": forBonusDegats,
      "system.force_poids": forcePoids,
      "system.force_ouvrir": forceOuvrir,
      "system.force_tordre": forceTordre,

      // Legacy/compat (si tu as encore des usages ailleurs)
      "system.force_bonus_porte": forBonusPorte,
      "system.charge_max": chargeMax,
      "system.charge_max_bench": chargeMaxBench,

      // Dex / Con / Int / Sag / Cha (si tu les exploites ailleurs)
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

    const _getProp = foundry?.utils?.getProperty;
    const _diff = {};
    for (const [k, v] of Object.entries(_fullUpdate)) {
      const cur = _getProp ? _getProp(this.actor, k) : undefined;
      if (cur !== v) _diff[k] = v;
    }

    if (Object.keys(_diff).length) await this.actor.update(_diff);

    // ============================
    // 6) PV auto (si présent)
    // ============================
    if (typeof this.autoSetPointsDeCoup === "function") {
      await this.autoSetPointsDeCoup();
    }

  } catch (e) {
    console.error("[ADD2E] Erreur dans autoSetCaracAjustements()", e);
  } finally {
    this._autoSetCaracsInProgress = false;
  }

};

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant autoSetPointsDeCoup.");

globalThis.Add2eActorSheet.prototype.autoSetPointsDeCoup = async function autoSetPointsDeCoup({ syncCurrent = false, force = false, reason = "unknown" } = {}) {
  try {
    const actor = this.actor;
    if (!actor?.system) return;

    const s = actor.system;
    const lvl = Math.max(1, Number(s.niveau) || 1);

    // Classe (priorité: item "classe", sinon details_classe)
    const classeItem = actor.items?.find(i => i.type === "classe");
    const cls = classeItem?.system || s.details_classe || null;
    if (!cls) return;

    const hitDie = Number(cls.hitDie || 0);
    if (!Number.isFinite(hitDie) || hitDie <= 0) return;

    // Bonus CON par niveau (calculé par autoSetCaracAjustements -> system.con_pv)
    const conBonus = Number(s.con_pv || 0);

    // Jets mémorisés : hpRolls[i] = jet du niveau (i+1)
    let hpRolls = Array.isArray(s.hpRolls) ? [...s.hpRolls] : [];
    if (force) hpRolls = [];

    // Niveau 1 : max du dé
    if (hpRolls.length < 1 || !Number.isFinite(hpRolls[0])) {
      hpRolls[0] = hitDie;
    }

    // Niveaux 2+ : jet 1..hitDie
    for (let i = 1; i < lvl; i++) {
      const cur = hpRolls[i];
      if (Number.isFinite(cur) && cur >= 1 && cur <= hitDie) continue;

      // Jet sûr sans parseur de formule
      const roll = 1 + Math.floor(Math.random() * hitDie);
      hpRolls[i] = roll;
    }

    // Calcul PV max selon votre règle
    let hpMax = 0;
    for (let i = 0; i < lvl; i++) {
      const diePart = (i === 0) ? hitDie : (Number(hpRolls[i]) || 1);
      hpMax += diePart + conBonus;
    }

    if (!Number.isFinite(hpMax) || hpMax < 1) hpMax = 1;

    const up = {
      "system.hpRolls": hpRolls,
      "system.points_de_coup": hpMax
    };
    if (syncCurrent) up["system.pdv"] = hpMax;

    await actor.update(up, { add2eInternal: true });

  } catch (e) {
    console.warn("[ADD2E][HP] Erreur autoSetPointsDeCoup :", e);
  }

};

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant _enableCaracClickAssign.");

globalThis.Add2eActorSheet.prototype._enableCaracClickAssign = function _enableCaracClickAssign(roller) {
  this.element.find('.carac-drop-target').each((i, el) => {
  el.classList.add("clickable");
  el.onclick = ev => {
    const carac = el.dataset.carac;
    if (roller.assigned[carac] !== undefined) {
      roller.unassignCarac(carac); 
    } else {
      roller.assignToCarac(carac);
    }
  };
  });
  
 
};

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant _add2eTabStorageKey.");

globalThis.Add2eActorSheet.prototype._add2eTabStorageKey = function _add2eTabStorageKey() {
    return `add2e.actor.${this.actor?.id || "unknown"}.activeTab`;
  
};

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant _add2eReadStoredTab.");

globalThis.Add2eActorSheet.prototype._add2eReadStoredTab = function _add2eReadStoredTab() {
    try {
      return sessionStorage.getItem(this._add2eTabStorageKey()) || null;
    } catch (e) {
      return null;
    }
  
};

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant _add2eSheetRoot.");

globalThis.Add2eActorSheet.prototype._add2eSheetRoot = function _add2eSheetRoot(html = null) {
    const source = html ?? this.element;
    if (!source) return null;

    const root = source.jquery ? source[0] : source;
    if (!root) return null;

    if (root.matches?.(".add2e-character-v3")) return root;
    if (root.querySelector?.(".add2e-character-v3")) return root.querySelector(".add2e-character-v3");
    if (root.matches?.("form.sheet.actor.add2e")) return root;
    if (root.querySelector?.("form.sheet.actor.add2e")) return root.querySelector("form.sheet.actor.add2e");

    return root;
  
};

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant _add2eCurrentTabFromHtml.");

globalThis.Add2eActorSheet.prototype._add2eCurrentTabFromHtml = function _add2eCurrentTabFromHtml(html = null) {
    const root = this._add2eSheetRoot(html);
    if (!root) return this._add2eActiveTab || this._add2eReadStoredTab() || "resume";

    return (
      this._add2eGetNativeActiveTab?.() ||
      root.querySelector(".sheet-tabs .item.active[data-tab]")?.dataset?.tab ||
      root.querySelector(".a2e-tabs .item.active[data-tab]")?.dataset?.tab ||
      root.querySelector(".sheet-body .tab.active[data-tab]")?.dataset?.tab ||
      root.querySelector(".a2e-tab-content.active[data-tab]")?.dataset?.tab ||
      root.querySelector(".a2e-active-tab-input")?.value ||
      this._add2eActiveTab ||
      this._add2eReadStoredTab() ||
      "resume"
    );
  
};

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant _add2eRememberActiveTab.");

globalThis.Add2eActorSheet.prototype._add2eRememberActiveTab = function _add2eRememberActiveTab(html = null, explicitTab = null) {
    const tab = explicitTab || this._add2eCurrentTabFromHtml(html) || "resume";
    this._add2eActiveTab = tab;
    this._add2eSetNativeActiveTab?.(tab);

    try {
      sessionStorage.setItem(this._add2eTabStorageKey(), tab);
    } catch (e) {}

    const root = this._add2eSheetRoot(html);
    const hidden = root?.querySelector?.(".a2e-active-tab-input");
    if (hidden) hidden.value = tab;

    return tab;
  
};

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant _add2eActivateTab.");

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
  
};

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant _add2eBindPersistentTabs.");

globalThis.Add2eActorSheet.prototype._add2eBindPersistentTabs = function _add2eBindPersistentTabs(html) {
    const root = this._add2eSheetRoot(html);
    if (!root) return;

    const initial = this._add2eGetNativeActiveTab?.() || this._add2eActiveTab || this._add2eReadStoredTab() || "resume";
    this._add2eActivateTab(initial, root);
    setTimeout(() => this._add2eActivateTab(this._add2eActiveTab || this._add2eReadStoredTab() || "resume"), 0);

    // Capture avant les handlers d'action : mémorise l'onglet courant avant equip/delete/update/render.
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
      root.addEventListener("change", () => this._add2eRememberActiveTab(root), true);
    }

    $(root).find(".sheet-tabs .item[data-tab], .a2e-tabs .item[data-tab]")
      .off("click.add2e-tabs")
      .on("click.add2e-tabs", ev => {
        ev.preventDefault();
        const tab = ev.currentTarget.dataset.tab || "resume";
        this._add2eActivateTab(tab, root);
      });

    $(root)
      .off("mousedown.add2e-tab-memory change.add2e-tab-memory keydown.add2e-tab-memory")
      .on("mousedown.add2e-tab-memory change.add2e-tab-memory keydown.add2e-tab-memory", () => {
        this._add2eRememberActiveTab(root);
      });
  
};

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant render.");

globalThis.Add2eActorSheet.prototype.render = function render(force=false, options={}) {
    try {
      if (this.rendered) this._add2eRememberActiveTab(this.element);
    } catch (e) {}
    const result = ActorSheet.prototype.render.call(this, force, options);
    const refreshUi = () => {
      this._add2eActivateTab(this._add2eActiveTab || this._add2eReadStoredTab() || "resume");
      try {
        add2eEnhanceCharacterSheetUi(this, this.element);
      } catch (_err) {}
    };
    for (const delay of [0, 80, 220]) setTimeout(refreshUi, delay);
    return result;
  
};
