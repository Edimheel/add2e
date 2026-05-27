// ============================================================
// ADD2E — Tirage et affectation des caractéristiques — Dialog V2
// Fichier externalisé depuis add2e.mjs.
// ============================================================

const ADD2E_CARAC_ROLLER_VERSION = "2026-05-27-carac-roller-dialog-v2-independent-class-suggestions-v2";
const ADD2E_CARAC_DIALOG_WIDTH = 500;

const ADD2E_CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
const ADD2E_CARAC_SHORT = {
  force: "FOR",
  dexterite: "DEX",
  constitution: "CON",
  intelligence: "INT",
  sagesse: "SAG",
  charisme: "CHA"
};

const ADD2E_CLASS_TAG_COLOR_BY_SLUG = {
  assassin: ["#7b1e24", "#ffe1d8"],
  clerc: ["#375d89", "#e6f0ff"],
  druide: ["#2f6b3f", "#e3ffd9"],
  guerrier: ["#8a4b1d", "#fff0d6"],
  illusionniste: ["#5b3f95", "#f0e6ff"],
  magicien: ["#243c78", "#dbe7ff"],
  moine: ["#7b5a23", "#fff1c7"],
  paladin: ["#8b842b", "#fffad1"],
  ranger: ["#2d5f55", "#d8fff4"],
  voleur: ["#4f5158", "#eef0f4"]
};
const ADD2E_CLASS_TAG_COLORS = Object.values(ADD2E_CLASS_TAG_COLOR_BY_SLUG);

function add2eCaracEscapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function add2eCaracSlug(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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

function add2eClassColorIndex(name) {
  const text = String(name ?? "");
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return Math.abs(hash) % ADD2E_CLASS_TAG_COLORS.length;
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
      buttons: [{ action: "add2e-technical-cancel", label: "Annuler", default: true, callback: () => this.cancel() }],
      close: () => this._onDialogClosed()
    }, { width: ADD2E_CARAC_DIALOG_WIDTH, height: "auto" });

    this.dialogRef.render({ force: true });

    setTimeout(() => {
      this._dlgRoot = document.querySelector(`[data-add2e-carac-roller="${this._uid}"]`);
      if (!this._dlgRoot) return console.warn("[ADD2E][CARAC_ROLLER] Racine de dialogue introuvable.");
      this._hideNativeFooter();
      this._lockDialogGeometry();
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
      <button type="button" class="add2e-carac-value" data-idx="${i}" title="Cliquer pour sélectionner. Si la valeur est affectée, cliquer pour la libérer."
        style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-width:46px;height:48px;padding:4px 7px;border:1px solid #7a4d21;border-radius:8px;background:linear-gradient(180deg,#fff1c8 0%,#d7a95e 100%);box-shadow:0 2px 5px rgba(50,25,8,.38), inset 0 1px 0 rgba(255,255,255,.7);color:#2b1b0d;cursor:pointer;font-weight:800;line-height:1;">
        <span class="add2e-carac-score" style="font-size:1.12rem;line-height:1;">${v}</span>
        <span class="assigned-label" style="font-size:.62rem;min-height:.72rem;color:#5b3514;font-weight:900;letter-spacing:.04em;">—</span>
      </button>`).join("");
  }

  _buildContent() {
    return `
      <style>
        .add2e-carac-popup .add2e-carac-value:hover { filter: brightness(1.06); transform: translateY(-1px); }
        .add2e-carac-popup .add2e-carac-value.selected { outline: 2px solid #8d1f1f !important; box-shadow: 0 0 0 2px #e2c178, 0 0 10px rgba(120,40,20,.45) !important; }
        .add2e-carac-popup .add2e-carac-value.used { opacity: .82 !important; background: linear-gradient(180deg,#8b7b63 0%,#5f533f 100%) !important; color: #fff2d0 !important; cursor: pointer !important; }
        .add2e-carac-popup .add2e-carac-value.used .assigned-label { color: #ffe19b !important; }
        .add2e-carac-popup .add2e-class-tags { display:grid !important; grid-template-columns:repeat(5,minmax(0,1fr)) !important; gap:7px !important; align-items:stretch !important; width:100% !important; }
        .add2e-carac-popup .add2e-class-suggestion { display:flex !important; flex-direction:column !important; align-items:center !important; justify-content:flex-start !important; width:100% !important; min-width:0 !important; max-width:100% !important; gap:3px !important; border-radius:10px !important; padding:5px 5px !important; cursor:pointer !important; font-size:.74rem !important; line-height:1.08 !important; white-space:normal !important; margin:0 !important; min-height:48px !important; box-shadow:inset 0 1px 0 rgba(255,255,255,.24), 0 1px 4px rgba(0,0,0,.26) !important; }
        .add2e-carac-popup .add2e-class-suggestion:hover { filter: brightness(1.13); transform: translateY(-1px); }
        .add2e-carac-popup .add2e-class-suggestion .class-name { display:block !important; width:100% !important; overflow:hidden !important; text-overflow:ellipsis !important; white-space:nowrap !important; text-align:center !important; font-weight:900 !important; color:inherit !important; }
        .add2e-carac-popup .add2e-class-suggestion .class-requis { display:flex !important; flex-wrap:wrap !important; justify-content:center !important; gap:3px !important; align-items:center !important; width:100% !important; font-size:.58rem !important; line-height:1.05 !important; opacity:.96 !important; }
        .add2e-carac-popup .add2e-class-suggestion .class-requis span { display:inline-flex !important; gap:1px !important; align-items:center !important; }
        .add2e-carac-popup .carac-ok { color: #d8ffd4; font-weight: 900; }
        .add2e-carac-popup .carac-locked { color: #ffe19b; font-weight: 900; }
        .add2e-carac-popup .class-no-requis { color: rgba(255,255,255,.82); font-style: italic; font-weight: 700; }
        .add2e-carac-popup .add2e-carac-action { min-width:110px; padding:6px 12px; border-radius:7px; font-weight:900; cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,.25); }
        .add2e-carac-popup .add2e-carac-action.reroll { border:1px solid #775122; background:linear-gradient(180deg,#f6dfad,#d19b4c); color:#2d1c0b; }
        .add2e-carac-popup .add2e-carac-action.validate { border:1px solid #6e1414; background:linear-gradient(180deg,#a7372d,#6e1714); color:#fff1d5; }
        .add2e-carac-popup .add2e-carac-action.cancel { border:1px solid #6a5640; background:linear-gradient(180deg,#7b6c5c,#4f463b); color:#fff1d5; }
      </style>
      <div class="add2e-carac-popup" data-add2e-carac-roller="${this._uid}" style="box-sizing:border-box;width:100%;min-width:100%;max-width:100%;padding:10px;color:#2a1b0d;background:linear-gradient(180deg,#efe0bc 0%,#d8bd82 100%);border:2px solid #5a3418;border-radius:8px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.35);">
        <div style="border:1px solid #8a6330;border-radius:8px;background:rgba(255,247,218,.62);padding:8px 10px;margin-bottom:9px;box-shadow:inset 0 0 10px rgba(90,52,24,.15);">
          <div style="font-size:.96rem;font-weight:900;color:#5b1e16;margin-bottom:3px;">Affectation des caractéristiques</div>
          <div style="font-size:.78rem;line-height:1.25;color:#3b2a19;">
            Cliquez sur une valeur puis une caractéristique. Cliquez une valeur déjà affectée pour la libérer. Cliquez une classe pour ses prérequis.
          </div>
        </div>
        <div class="add2e-carac-values" style="display:flex;flex-wrap:wrap;gap:7px;justify-content:center;align-items:center;margin:0 0 9px 0;">${this._valueCardsHtml()}</div>
        <div id="classes-suggestions" style="margin:0 0 9px 0;padding:8px 10px;border:1px solid #8a6330;border-radius:8px;background:rgba(43,28,13,.10);max-height:160px;overflow:auto;"></div>
        <div class="add2e-carac-actions" style="display:flex;justify-content:center;align-items:center;gap:10px;margin-top:8px;">
          <button type="button" class="add2e-carac-action reroll reroll-caracs-btn">Relancer</button>
          <button type="button" class="add2e-carac-action validate apply-caracs-btn">Valider</button>
          <button type="button" class="add2e-carac-action cancel cancel-caracs-btn">Annuler</button>
        </div>
      </div>`;
  }

  _dialogWindowElement() {
    return this._dlgRoot?.closest?.(".application, .window-app, .app, .dialog") ?? null;
  }

  _hideNativeFooter() {
    const win = this._dialogWindowElement();
    if (!win) return;
    for (const footer of win.querySelectorAll(".form-footer, .dialog-buttons, footer")) {
      if (!footer.closest("[data-add2e-carac-roller]")) footer.style.display = "none";
    }
  }

  _lockDialogGeometry() {
    const win = this._dialogWindowElement();
    if (!win) return;
    const width = `${ADD2E_CARAC_DIALOG_WIDTH}px`;
    win.style.setProperty("width", width, "important");
    win.style.setProperty("min-width", width, "important");
    win.style.setProperty("max-width", width, "important");
    const content = this._dlgRoot?.closest?.(".window-content, .application-content") ?? this._dlgRoot?.parentElement ?? null;
    if (content) {
      content.style.setProperty("width", "100%", "important");
      content.style.setProperty("box-sizing", "border-box", "important");
    }
  }

  _keepDialogOnTop() {
    const win = this._dialogWindowElement();
    if (!win) return;
    win.style.zIndex = "2147483000";
    win.dataset.add2eAlwaysOnTop = "carac-roller";
    this._hideNativeFooter();
    this._lockDialogGeometry();
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
        if (this.used[idx]) return this.unassignCarac(this.used[idx]);
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
    this._dlgRoot.querySelector(".cancel-caracs-btn")?.addEventListener("click", ev => {
      ev.preventDefault();
      this.cancel();
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
        if (plan) this.applyClassSuggestion(plan);
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
    this._updatePendingSheetBorders();
  }

  _unbindSheetTargets() {
    for (const el of this._sheetTargets()) {
      if (el.dataset.add2eCaracRoller === this._uid) {
        el.removeEventListener("click", this._sheetTargetHandler);
        el.classList.remove("clickable", "assignable", "carac-assigned", "add2e-carac-pending");
        el.style.outline = "";
        el.style.outlineOffset = "";
        el.style.boxShadow = "";
        delete el.dataset.add2eCaracRoller;
      }
    }
  }

  _updatePendingSheetBorders() {
    for (const el of this._sheetTargets()) {
      const carac = el.dataset?.carac;
      if (!ADD2E_CARACS.includes(carac)) continue;
      const pending = this.assigned[carac] === undefined;
      el.classList.toggle("add2e-carac-pending", pending);
      el.style.outline = pending ? "2px solid #c01818" : "";
      el.style.outlineOffset = pending ? "2px" : "";
      el.style.boxShadow = pending ? "0 0 0 2px rgba(192,24,24,.22), 0 0 10px rgba(192,24,24,.45)" : "";
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
      const numericIdx = Number(idx);
      if (!ADD2E_CARACS.includes(carac) || !Number.isFinite(numericIdx)) continue;
      const previousCaracUsingValue = Object.keys(this.assigned).find(c => c !== carac && Number(this.assigned[c]) === numericIdx);
      if (previousCaracUsingValue) delete this.assigned[previousCaracUsingValue];
      if (this.assigned[carac] !== undefined && Number(this.assigned[carac]) !== numericIdx) delete this.used[this.assigned[carac]];
      this.assigned[carac] = numericIdx;
      this.used[numericIdx] = carac;
    }

    for (const [idx, carac] of Object.entries({ ...this.used })) {
      if (this.assigned[carac] === undefined || Number(this.assigned[carac]) !== Number(idx)) delete this.used[idx];
    }

    this.selectedIdx = null;
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
    this._updatePendingSheetBorders();
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
    this._updatePendingSheetBorders();
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
    this._updatePendingSheetBorders();
  }

  _classSuggestionPlan(cls) {
    const requis = Object.entries(cls.system?.caracs_min || {})
      .map(([carac, minRaw]) => ({ carac, min: Number(minRaw) || 0 }))
      .filter(r => ADD2E_CARACS.includes(r.carac) && r.min > 0)
      .sort((a, b) => b.min - a.min);

    const pool = this.values.map((value, idx) => ({ value, idx })).sort((a, b) => b.value - a.value);
    const placements = [];
    const assignments = {};

    for (const req of requis) {
      const bonus = add2eCaracRaceBonus(this.actor, req.carac);
      const idx = pool.findIndex(entry => entry.value + bonus >= req.min);
      if (idx === -1) return null;
      const picked = pool[idx];
      assignments[req.carac] = picked.idx;
      placements.push(`<span><b>${ADD2E_CARAC_SHORT[req.carac] || add2eCaracEscapeHtml(req.carac)}</b><span class="carac-ok">${picked.value}</span></span>`);
      pool.splice(idx, 1);
    }

    return { className: cls.name, placements, assignments };
  }

  _classTagStyle(className) {
    const slug = add2eCaracSlug(className);
    const [bg, fg] = ADD2E_CLASS_TAG_COLOR_BY_SLUG[slug] ?? ADD2E_CLASS_TAG_COLORS[add2eClassColorIndex(className)];
    return `border:1px solid rgba(40,20,8,.55);background:linear-gradient(180deg,${bg},${bg}dd);color:${fg};`;
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

    let html = '<div style="margin:0 0 6px 0;font-size:.82rem;color:#5b1e16;font-weight:900;">Classes possibles :</div>';
    html += '<div class="add2e-class-tags" style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;align-items:stretch;width:100%;">';

    let count = 0;
    for (const cls of classes) {
      const plan = this._classSuggestionPlan(cls);
      if (!plan) continue;
      const key = `plan-${count}`;
      this._suggestionPlans.set(key, plan);
      count++;
      const detail = plan.placements.length
        ? `<div class="class-requis" style="display:flex;flex-wrap:wrap;justify-content:center;gap:3px;width:100%;font-size:.58rem;line-height:1.05;margin-top:2px;">${plan.placements.join(' ')}</div>`
        : `<div class="class-requis class-no-requis" style="display:block;width:100%;font-size:.56rem;line-height:1.05;margin-top:2px;text-align:center;">Aucun prérequis</div>`;
      html += `<button type="button" class="add2e-class-suggestion" data-plan-key="${key}" title="Auto-affecter les prérequis" style="${this._classTagStyle(cls.name)}"><b class="class-name">${add2eCaracEscapeHtml(cls.name)}</b>${detail}</button>`;
    }

    html += count ? "</div>" : '<em>Aucune classe ne correspond à ce tirage.</em></div>';
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

  async cancel() {
    await this._restoreOldCaracs();
    this._closeDialogOnly();
  }

  async _restoreOldCaracs() {
    if (this._applied || !this.actor) return;
    this.assigned = {};
    this.used = {};
    this.selectedIdx = null;
    this._updateCaracDisplay();
    this._updateAssignLabels();
    const updates = {};
    for (const c of ADD2E_CARACS) updates[`system.${c}_base`] = this._oldValues[c];
    await this.actor.update(updates);
    if (typeof this.sheet?.autoSetCaracAjustements === "function") await this.sheet.autoSetCaracAjustements();
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
