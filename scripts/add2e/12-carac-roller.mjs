// ============================================================
// ADD2E — Tirage et affectation des caractéristiques — Dialog V2
// Fichier externalisé depuis add2e.mjs.
// ============================================================

const ADD2E_CARAC_ROLLER_VERSION = "2026-05-27-carac-roller-dialog-v2-tags-reroll-v1";

const ADD2E_CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
const ADD2E_CARAC_SHORT = {
  force: "FOR",
  dexterite: "DEX",
  constitution: "CON",
  intelligence: "INT",
  sagesse: "SAG",
  charisme: "CHA"
};

function add2eCaracEscapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function add2eCaracDialogV2() {
  return foundry?.applications?.api?.DialogV2 ?? null;
}

function add2eCaracSheetRoot(sheet) {
  const source = sheet?.element;
  const root = source?.jquery ? source[0] : source;
  if (!root) return null;
  return root.querySelector?.(".add2e-character-v3") || root.querySelector?.("form.sheet.actor.add2e") || root;
}

function add2eCaracRaceBonus(actor, carac) {
  const sys = actor?.system ?? {};
  return Number(sys.bonus_caracteristiques?.[carac] ?? sys[`${carac}_race`] ?? 0) || 0;
}

function add2eCaracBaseValue(actor, carac) {
  return Number(actor?.system?.[`${carac}_base`] ?? actor?.system?.[carac] ?? 10) || 10;
}

class Add2eCaracRoller {
  constructor(sheet) {
    this.sheet = sheet;
    this.actor = sheet?.actor ?? sheet?.document ?? null;
    this.values = [];
    this.used = {};
    this.assigned = {};
    this.selectedIdx = null;
    this.dialogRef = null;
    this._dlgRoot = null;
    this._applied = false;
    this._closing = false;
    this._keepOnTopTimer = null;
    this._suggestionPlans = new Map();
    this._uid = `add2e-carac-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this._sheetTargetHandler = this._onSheetTargetClick.bind(this);
    this._oldValues = {};

    for (const c of ADD2E_CARACS) this._oldValues[c] = add2eCaracBaseValue(this.actor, c);
    this.render();
  }

  static rollCarac() {
    const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1).sort((a, b) => b - a);
    return rolls[0] + rolls[1] + rolls[2];
  }

  _rollValues() {
    const rolls = Array.from({ length: 7 }, () => Add2eCaracRoller.rollCarac()).sort((a, b) => b - a);
    this.values = rolls.slice(0, 6);
    this.used = {};
    this.assigned = {};
    this.selectedIdx = null;
  }

  render() {
    const DialogV2 = add2eCaracDialogV2();
    if (!DialogV2) {
      ui.notifications.error("Dialog V2 est introuvable : tirage des caractéristiques impossible.");
      console.error("[ADD2E][CARAC_ROLLER] DialogV2 introuvable.");
      return;
    }

    this._rollValues();
    this._applied = false;
    this._closing = false;

    this.dialogRef = new DialogV2({
      window: { title: "Tirage des caractéristiques" },
      content: this._buildContent(),
      buttons: [
        {
          action: "cancel",
          label: "Annuler",
          default: true,
          callback: () => this.cancel()
        }
      ],
      close: () => this._onDialogClosed()
    }, { width: 460, height: "auto" });

    this.dialogRef.render({ force: true });

    setTimeout(() => {
      this._dlgRoot = document.querySelector(`[data-add2e-carac-roller="${this._uid}"]`);
      if (!this._dlgRoot) {
        console.warn("[ADD2E][CARAC_ROLLER] Racine de dialogue introuvable.");
        return;
      }
      this._bindDialogEvents();
      this._bindSheetTargets();
      this._updateCaracDisplay();
      this._updateAssignLabels();
      this._keepDialogOnTop();
      this._startKeepOnTop();
      this.classesSynthese().then(html => this._setClassesHtml(html));
    }, 0);

    console.log("[ADD2E][CARAC_ROLLER][OPEN]", {
      version: ADD2E_CARAC_ROLLER_VERSION,
      actor: this.actor?.name,
      values: this.values
    });
  }

  _valueCardsHtml() {
    return this.values.map((v, i) => `
      <button type="button"
        class="add2e-carac-value"
        data-idx="${i}"
        title="Cliquer pour sélectionner. Si la valeur est affectée, cliquer pour la libérer."
        style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-width:46px;height:48px;padding:4px 7px;border:1px solid #b8935d;border-radius:8px;background:linear-gradient(180deg,#f5dfae 0%,#d3a967 100%);box-shadow:0 2px 6px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.55);color:#2b1b0d;cursor:pointer;font-weight:700;line-height:1;"
      >
        <span class="add2e-carac-score" style="font-size:1.12rem;line-height:1;">${v}</span>
        <span class="assigned-label" style="font-size:.62rem;min-height:.72rem;color:#5b3514;font-weight:800;letter-spacing:.04em;">—</span>
      </button>`).join("");
  }

  _buildContent() {
    return `
      <style>
        .add2e-carac-popup .add2e-carac-value:hover { filter: brightness(1.08); transform: translateY(-1px); }
        .add2e-carac-popup .add2e-carac-value.selected { outline: 2px solid #f0d27a !important; box-shadow: 0 0 0 2px #6b3ca0, 0 0 12px rgba(240,210,122,.55) !important; }
        .add2e-carac-popup .add2e-carac-value.used { opacity: .70 !important; background: linear-gradient(180deg,#7c766e 0%,#4d4945 100%) !important; color: #f4eadc !important; cursor: pointer !important; }
        .add2e-carac-popup .add2e-carac-value.used .assigned-label { color: #f0d27a !important; }
        .add2e-carac-popup .add2e-class-tags { display:flex; flex-wrap:wrap; gap:5px; align-items:flex-start; }
        .add2e-carac-popup .add2e-class-suggestion { display:inline-flex; align-items:center; gap:4px; border: 1px solid rgba(184,121,255,.35); border-radius: 999px; background: rgba(93,44,125,.28); color: #f1e8dc; padding: 3px 8px; cursor: pointer; font-size: .78rem; line-height: 1.2; white-space: nowrap; max-width: 100%; }
        .add2e-carac-popup .add2e-class-suggestion:hover { background: rgba(142,68,173,.48); border-color: #d8b16c; }
        .add2e-carac-popup .add2e-class-suggestion b { color: #d9b2ff; }
        .add2e-carac-popup .carac-ok { color: #42d681; font-weight: 800; }
        .add2e-carac-popup .carac-locked { color: #f0d27a; font-weight: 800; }
      </style>
      <div class="add2e-carac-popup" data-add2e-carac-roller="${this._uid}" style="box-sizing:border-box;width:100%;padding:8px 10px 2px 10px;color:#f1e8dc;background:radial-gradient(circle at 85% 20%,rgba(151,87,255,.14),transparent 35%),linear-gradient(180deg,rgba(34,27,42,.96),rgba(17,14,22,.96));border-radius:8px;">
        <div style="border:1px solid rgba(214,176,116,.32);border-radius:8px;background:rgba(0,0,0,.18);padding:7px 9px;margin-bottom:9px;box-shadow:inset 0 0 12px rgba(0,0,0,.18);">
          <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;">
            <div style="font-size:.94rem;font-weight:800;color:#f5dfae;">Affectation des caractéristiques</div>
            <button type="button" class="reroll-caracs-btn" style="padding:3px 8px;border:1px solid #d8b16c;border-radius:999px;background:rgba(0,0,0,.24);color:#f5dfae;font-size:.76rem;font-weight:800;cursor:pointer;">Relancer</button>
          </div>
          <div style="font-size:.78rem;line-height:1.25;color:#d8c9b4;margin-top:3px;">
            Cliquez sur une valeur puis une caractéristique. Cliquez une valeur déjà affectée pour la libérer. Cliquez une classe pour ses prérequis.
          </div>
        </div>

        <div class="add2e-carac-values" style="display:flex;flex-wrap:wrap;gap:7px;justify-content:center;align-items:center;margin:0 0 9px 0;">
          ${this._valueCardsHtml()}
        </div>

        <div id="classes-suggestions" style="margin:0 0 8px 0;padding:8px 10px;border:1px solid rgba(214,176,116,.26);border-radius:8px;background:rgba(0,0,0,.20);max-height:150px;overflow:auto;"></div>

        <div class="add2e-carac-apply" style="display:flex;justify-content:center;margin-top:7px;">
          <button type="button" class="apply-caracs-btn" style="min-width:140px;padding:6px 14px;border:1px solid #d8b16c;border-radius:7px;background:linear-gradient(180deg,#8e44ad 0%,#5d2c7d 100%);color:#fff7e8;font-weight:800;letter-spacing:.02em;cursor:pointer;box-shadow:0 2px 7px rgba(0,0,0,.32);">Valider</button>
        </div>
      </div>
    `;
  }

  _dialogWindowElement() {
    return this._dlgRoot?.closest?.(".application, .window-app, .app, .dialog") ?? null;
  }

  _keepDialogOnTop() {
    const win = this._dialogWindowElement();
    if (!win) return;
    win.style.zIndex = "2147483000";
    win.dataset.add2eAlwaysOnTop = "carac-roller";
  }

  _startKeepOnTop() {
    this._stopKeepOnTop();
    this._keepOnTopTimer = setInterval(() => this._keepDialogOnTop(), 350);
  }

  _stopKeepOnTop() {
    if (this._keepOnTopTimer) clearInterval(this._keepOnTopTimer);
    this._keepOnTopTimer = null;
  }

  _bindDialogEvents() {
    this._dlgRoot.querySelectorAll(".add2e-carac-value").forEach(el => {
      el.addEventListener("click", ev => {
        ev.preventDefault();
        this._keepDialogOnTop();
        const idx = Number(el.dataset.idx);
        if (this.used[idx]) {
          this.unassignCarac(this.used[idx]);
          return;
        }
        this.selectedIdx = idx;
        this._updateAssignLabels();
      });
    });

    this._dlgRoot.querySelector(".apply-caracs-btn")?.addEventListener("click", ev => {
      ev.preventDefault();
      this._keepDialogOnTop();
      this.apply();
    });

    this._dlgRoot.querySelector(".reroll-caracs-btn")?.addEventListener("click", ev => {
      ev.preventDefault();
      this.reroll();
    });
  }

  _bindClassSuggestionEvents() {
    if (!this._dlgRoot) return;
    this._dlgRoot.querySelectorAll(".add2e-class-suggestion[data-plan-key]").forEach(btn => {
      btn.addEventListener("click", ev => {
        ev.preventDefault();
        ev.stopPropagation();
        this._keepDialogOnTop();
        const plan = this._suggestionPlans.get(btn.dataset.planKey);
        if (!plan) return;
        this.applyClassSuggestion(plan);
      });
    });
  }

  reroll() {
    this._rollValues();
    const valuesRoot = this._dlgRoot?.querySelector(".add2e-carac-values");
    if (valuesRoot) valuesRoot.innerHTML = this._valueCardsHtml();
    this._bindDialogEvents();
    this._updateCaracDisplay();
    this._updateAssignLabels();
    this._keepDialogOnTop();
    this._setClassesHtml("<em>Actualisation...</em>");
    this.classesSynthese().then(html => this._setClassesHtml(html));
    ui.notifications.info("Nouveau tirage effectué.");
  }

  _sheetTargets() {
    const root = add2eCaracSheetRoot(this.sheet);
    return Array.from(root?.querySelectorAll?.('.carac-drop-target[data-carac]') ?? []);
  }

  _bindSheetTargets() {
    for (const el of this._sheetTargets()) {
      el.onclick = null;
      el.classList.add("clickable");
      el.dataset.add2eCaracRoller = this._uid;
      el.removeEventListener("click", this._sheetTargetHandler);
      el.addEventListener("click", this._sheetTargetHandler);
    }
  }

  _unbindSheetTargets() {
    for (const el of this._sheetTargets()) {
      if (el.dataset.add2eCaracRoller === this._uid) {
        el.removeEventListener("click", this._sheetTargetHandler);
        el.classList.remove("clickable", "assignable", "carac-assigned");
        delete el.dataset.add2eCaracRoller;
      }
    }
  }

  _onSheetTargetClick(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    this._keepDialogOnTop();
    const carac = ev.currentTarget?.dataset?.carac;
    if (!ADD2E_CARACS.includes(carac)) return;
    if (this.assigned[carac] !== undefined) this.unassignCarac(carac);
    else this.assignToCarac(carac);
  }

  assignToCarac(caracName) {
    if (this.selectedIdx === null) return;
    const idx = this.selectedIdx;

    const previousCarac = Object.keys(this.assigned).find(c => Number(this.assigned[c]) === idx);
    if (previousCarac) this.unassignCarac(previousCarac);

    if (this.assigned[caracName] !== undefined) delete this.used[this.assigned[caracName]];

    this.assigned[caracName] = idx;
    this.used[idx] = caracName;
    this.selectedIdx = null;
    this._refreshUi();
  }

  applyClassSuggestion(plan) {
    if (!plan?.assignments) return;

    for (const [carac, idx] of Object.entries(plan.assignments)) {
      if (!ADD2E_CARACS.includes(carac)) continue;
      const numericIdx = Number(idx);
      if (!Number.isFinite(numericIdx)) continue;

      const previousCaracUsingValue = Object.keys(this.assigned).find(c => c !== carac && Number(this.assigned[c]) === numericIdx);
      if (previousCaracUsingValue) delete this.assigned[previousCaracUsingValue];

      if (this.assigned[carac] !== undefined && Number(this.assigned[carac]) !== numericIdx) {
        delete this.used[this.assigned[carac]];
      }

      this.assigned[carac] = numericIdx;
      this.used[numericIdx] = carac;
    }

    for (const [idx, carac] of Object.entries({ ...this.used })) {
      if (this.assigned[carac] === undefined || Number(this.assigned[carac]) !== Number(idx)) delete this.used[idx];
    }

    this.selectedIdx = null;
    ui.notifications.info(`Prérequis ${plan.className} affectés.`);
    this._refreshUi();
  }

  unassignCarac(caracName) {
    if (this.assigned[caracName] === undefined) return;
    const idx = this.assigned[caracName];
    delete this.assigned[caracName];
    delete this.used[idx];
    this.selectedIdx = null;
    this._refreshUi();
  }

  _refreshUi() {
    this._updateCaracDisplay();
    this._updateAssignLabels();
    this._keepDialogOnTop();
    this._setClassesHtml("<em>Actualisation...</em>");
    this.classesSynthese().then(html => this._setClassesHtml(html));
  }

  _updateAssignLabels() {
    if (!this._dlgRoot) return;
    this._dlgRoot.querySelectorAll(".add2e-carac-value").forEach(el => {
      const idx = Number(el.dataset.idx);
      const carac = Object.keys(this.assigned).find(c => Number(this.assigned[c]) === idx) ?? null;
      el.classList.toggle("used", Boolean(carac));
      el.classList.toggle("selected", this.selectedIdx === idx);
      const label = el.querySelector(".assigned-label");
      if (label) label.textContent = carac ? ADD2E_CARAC_SHORT[carac] : "—";
    });
    this._sheetTargets().forEach(el => el.classList.toggle("assignable", this.selectedIdx !== null));
  }

  _updateCaracDisplay() {
    for (const c of ADD2E_CARACS) {
      const el = this._sheetTargets().find(target => target.dataset.carac === c);
      if (!el) continue;
      const bonusRacial = add2eCaracRaceBonus(this.actor, c);
      const base = this.assigned[c] !== undefined ? this.values[this.assigned[c]] : this._oldValues[c];
      const total = base + bonusRacial;
      el.classList.toggle("carac-assigned", this.assigned[c] !== undefined);
      el.innerHTML = `<span style="font-size:1.22em;font-weight:bold;">${total}</span>
        <div style="font-size:0.40em;line-height:1.2em;color:#777;margin-top:1px;">
          <span style="color:#555;">base : </span>${base}<br>
          <span style="color:#555;">bonus : </span><span style="color:${bonusRacial > 0 ? '#1abc9c' : bonusRacial < 0 ? '#e74c3c' : '#777'};">${bonusRacial > 0 ? '+' : ''}${bonusRacial}</span>
        </div>`;
    }
  }

  _usedIndexesForRequiredCaracs(requis) {
    const requiredCaracs = new Set(requis.map(([carac]) => carac));
    return new Set(Object.entries(this.assigned)
      .filter(([carac, idx]) => requiredCaracs.has(carac) && idx !== undefined && idx !== null)
      .map(([, idx]) => Number(idx)));
  }

  _classSuggestionPlan(cls) {
    const requis = Object.entries(cls.system?.caracs_min || {});
    const lockedRequiredIndexes = this._usedIndexesForRequiredCaracs(requis);
    const pool = this.values
      .map((value, idx) => ({ value, idx }))
      .filter(entry => !lockedRequiredIndexes.has(entry.idx))
      .sort((a, b) => b.value - a.value);

    const placements = [];
    const assignments = {};

    for (const [carac, minRaw] of requis) {
      const min = Number(minRaw) || 0;
      const bonus = add2eCaracRaceBonus(this.actor, carac);

      if (this.assigned[carac] !== undefined) {
        const assignedIdx = Number(this.assigned[carac]);
        const assignedBase = Number(this.values[assignedIdx]) || 0;
        const assignedTotal = assignedBase + bonus;
        if (assignedTotal < min) return null;
        assignments[carac] = assignedIdx;
        placements.push(`<b>${ADD2E_CARAC_SHORT[carac] || add2eCaracEscapeHtml(carac)}</b><span class="carac-locked">${assignedBase}</span>`);
        continue;
      }

      const idx = pool.findIndex(entry => entry.value + bonus >= min);
      if (idx === -1) return null;
      const picked = pool[idx];
      assignments[carac] = picked.idx;
      placements.push(`<b>${ADD2E_CARAC_SHORT[carac] || add2eCaracEscapeHtml(carac)}</b><span class="carac-ok">${picked.value}</span>`);
      pool.splice(idx, 1);
    }

    return { className: cls.name, placements, assignments };
  }

  async classesSynthese() {
    let classes = game.items?.filter?.(i => i.type === "classe") ?? [];
    if (!classes.length) {
      const pack = game.packs.get("add2e.classes");
      if (!pack) return "<em>Compendium des classes introuvable.</em>";
      classes = (await pack.getDocuments()).filter(i => i.type === "classe");
    }
    if (!classes.length) return "<em>Aucune classe trouvée</em>";

    this._suggestionPlans.clear();

    let html = '<div style="margin:0 0 6px 0;font-size:.82rem;color:#f5dfae;font-weight:800;">Classes possibles :</div>';
    html += '<div class="add2e-class-tags">';

    let count = 0;
    for (const cls of classes) {
      const plan = this._classSuggestionPlan(cls);
      if (!plan) continue;
      const key = `plan-${count}`;
      this._suggestionPlans.set(key, plan);
      count++;
      const detail = plan.placements.length ? `<span style="display:inline-flex;gap:3px;align-items:center;">${plan.placements.join(' ')}</span>` : "";
      html += `<button type="button" class="add2e-class-suggestion" data-plan-key="${key}" title="Auto-affecter les prérequis"><b>${add2eCaracEscapeHtml(cls.name)}</b>${detail}</button>`;
    }

    html += count ? '</div>' : '<em>Aucune classe ne correspond à cette affectation.</em></div>';
    return html;
  }

  _setClassesHtml(html) {
    const el = this._dlgRoot?.querySelector("#classes-suggestions");
    if (el) el.innerHTML = html;
    this._bindClassSuggestionEvents();
    this._keepDialogOnTop();
  }

  async _confirmOverflows(overflows) {
    const DialogV2 = add2eCaracDialogV2();
    const caracsTxt = overflows.map(o => `<li><b>${ADD2E_CARAC_SHORT[o.carac]}</b> : base ${o.base} + bonus racial ${o.bonusRacial} = <span style="color:#e74c3c;font-weight:bold;">${o.total}</span> <b>→ 18</b></li>`).join("");
    return DialogV2.confirm({
      window: { title: "Caractéristique supérieure à 18" },
      content: `<p>Une ou plusieurs caractéristiques dépassent 18 après bonus racial.</p><ul>${caracsTxt}</ul><p>Elles seront ramenées à 18. Confirmez-vous l’affectation ?</p>`,
      yes: { label: "Confirmer" },
      no: { label: "Revenir" },
      rejectClose: false
    });
  }

  async apply() {
    if (!ADD2E_CARACS.every(c => this.assigned[c] !== undefined)) {
      ui.notifications.warn("Toutes les caractéristiques doivent être affectées.");
      return;
    }

    const updates = {};
    const baseCaracs = {};
    const overflows = [];

    for (const carac of ADD2E_CARACS) {
      const base = Number(this.values[this.assigned[carac]]) || 10;
      const bonusRacial = add2eCaracRaceBonus(this.actor, carac);
      const total = base + bonusRacial;
      if (total > 18) overflows.push({ carac, base, bonusRacial, total });
      updates[`system.${carac}_base`] = base;
      baseCaracs[carac] = base;
    }

    if (overflows.length) {
      const confirmed = await this._confirmOverflows(overflows);
      if (!confirmed) return;
      for (const o of overflows) {
        const cappedBase = Math.max(3, 18 - o.bonusRacial);
        updates[`system.${o.carac}_base`] = cappedBase;
        baseCaracs[o.carac] = cappedBase;
      }
    }

    await this.actor.update(updates);
    await this.actor.setFlag("add2e", "base_caracs", baseCaracs);
    if (typeof this.sheet?.autoSetCaracAjustements === "function") await this.sheet.autoSetCaracAjustements();

    this._applied = true;
    this._unbindSheetTargets();
    ui.notifications.info("Affectation terminée.");
    await this.sheet?.render?.(false);
    this._closeDialogOnly();
  }

  cancel() {
    this._restoreOldCaracs();
    this._closeDialogOnly();
  }

  async _restoreOldCaracs() {
    if (this._applied || !this.actor) return;
    const updates = {};
    for (const c of ADD2E_CARACS) updates[`system.${c}_base`] = this._oldValues[c];
    await this.actor.update(updates);
    if (typeof this.sheet?.autoSetCaracAjustements === "function") await this.sheet.autoSetCaracAjustements();
    this._updateCaracDisplay();
  }

  _closeDialogOnly() {
    if (this._closing) return;
    this._closing = true;
    this._stopKeepOnTop();
    this._unbindSheetTargets();
    this.dialogRef?.close?.();
  }

  _onDialogClosed() {
    this._stopKeepOnTop();
    if (!this._applied && !this._closing) {
      this._closing = true;
      this._restoreOldCaracs();
    }
    this._unbindSheetTargets();
  }
}

globalThis.Add2eCaracRoller = Add2eCaracRoller;
globalThis.ADD2E_CARAC_ROLLER_VERSION = ADD2E_CARAC_ROLLER_VERSION;
console.log("[ADD2E][CARAC_ROLLER][VERSION]", ADD2E_CARAC_ROLLER_VERSION);
