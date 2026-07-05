// ============================================================
// ADD2E — Tirage et affectation des caractéristiques — Dialog V2
// ============================================================
const ADD2E_CARAC_ROLLER_VERSION = "2026-07-05-carac-roller-independent-classes-v9";
const ADD2E_CARAC_DIALOG_WIDTH = 600;
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
  return root?.querySelector?.(".add2e-character-v3") || root?.querySelector?.("form.sheet.actor.add2e") || root || null;
}

function add2eCaracRaceBonus(actor, carac) {
  const system = actor?.system ?? {};
  return Number(system.bonus_caracteristiques?.[carac] ?? system[`${carac}_race`] ?? 0) || 0;
}

function add2eCaracBaseValue(actor, carac) {
  return Number(actor?.system?.[`${carac}_base`] ?? actor?.system?.[carac] ?? 10) || 10;
}

function add2eClassColorIndex(name) {
  let hash = 0;
  for (const character of String(name ?? "")) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
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
    this._classesPromise = null;
    this._classSuggestionGeneration = 0;
    this._dialogEventsBound = false;
    this._uid = `add2e-carac-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this._sheetTargetHandler = this._onSheetTargetClick.bind(this);
    this._dialogClickHandler = this._onDialogClick.bind(this);
    this._oldValues = Object.fromEntries(ADD2E_CARACS.map(carac => [carac, add2eCaracBaseValue(this.actor, carac)]));
    this.render();
  }

  static rollCarac() {
    const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1).sort((left, right) => right - left);
    return dice[0] + dice[1] + dice[2];
  }

  _rollValues() {
    this.values = Array.from({ length: 7 }, () => Add2eCaracRoller.rollCarac())
      .sort((left, right) => right - left)
      .slice(0, 6);
    this.used = {};
    this.assigned = {};
    this.selectedIdx = null;
  }

  render() {
    const DialogV2 = add2eCaracDialogV2();
    if (!DialogV2) {
      ui.notifications.error("Dialog V2 est introuvable : tirage des caractéristiques impossible.");
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
      if (!this._dlgRoot) return;
      this._hideNativeFooter();
      this._lockDialogGeometry();
      this._bindDialogEvents();
      this._bindSheetTargets();
      this._updateCaracDisplay();
      this._updateAssignLabels();
      this._keepDialogOnTop();
      this._startKeepOnTop();
      this._refreshClassSuggestions();
    }, 0);
  }

  _valueCardsHtml() {
    return this.values.map((value, index) => `
      <button type="button" class="add2e-carac-value" data-idx="${index}" title="Cliquer pour sélectionner. Si la valeur est affectée, cliquer pour la libérer."
        style="display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:1px!important;min-width:46px!important;height:48px!important;padding:4px 7px!important;border:1px solid #7a4d21!important;border-radius:8px!important;background:linear-gradient(180deg,#fff1c8 0%,#d7a95e 100%)!important;box-shadow:0 2px 5px rgba(50,25,8,.38),inset 0 1px 0 rgba(255,255,255,.7)!important;color:#2b1b0d!important;cursor:pointer!important;font-weight:800!important;line-height:1!important;">
        <span class="add2e-carac-score" style="font-size:1.12rem!important;line-height:1!important;">${value}</span>
        <span class="assigned-label" style="font-size:.62rem!important;min-height:.72rem!important;color:#5b3514!important;font-weight:900!important;letter-spacing:.04em!important;">—</span>
      </button>`).join("");
  }

  _buildContent() {
    return `
      <style>
        .add2e-carac-popup .add2e-carac-value:hover { filter:brightness(1.06); transform:translateY(-1px); }
        .add2e-carac-popup .add2e-carac-value.selected { outline:2px solid #8d1f1f!important; box-shadow:0 0 0 2px #e2c178,0 0 10px rgba(120,40,20,.45)!important; }
        .add2e-carac-popup .add2e-carac-value.used { opacity:.82!important; background:linear-gradient(180deg,#8b7b63 0%,#5f533f 100%)!important; color:#fff2d0!important; }
        .add2e-carac-popup .add2e-carac-value.used .assigned-label { color:#ffe19b!important; }
        .add2e-carac-popup .add2e-class-suggestion:hover { filter:brightness(1.13); transform:translateY(-1px); }
      </style>
      <div class="add2e-carac-popup" data-add2e-carac-roller="${this._uid}" style="box-sizing:border-box!important;width:100%!important;min-width:100%!important;max-width:100%!important;padding:10px!important;color:#2a1b0d!important;background:linear-gradient(180deg,#efe0bc 0%,#d8bd82 100%)!important;border:2px solid #5a3418!important;border-radius:8px!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.35)!important;">
        <div style="border:1px solid #8a6330!important;border-radius:8px!important;background:rgba(255,247,218,.62)!important;padding:8px 10px!important;margin-bottom:9px!important;box-shadow:inset 0 0 10px rgba(90,52,24,.15)!important;">
          <div style="font-size:.96rem!important;font-weight:900!important;color:#5b1e16!important;margin-bottom:3px!important;">Affectation des caractéristiques</div>
          <div style="font-size:.78rem!important;line-height:1.25!important;color:#3b2a19!important;">Cliquez sur une valeur puis une caractéristique. Cliquez une valeur déjà affectée pour la libérer. Cliquez une classe pour ses prérequis.</div>
        </div>
        <div class="add2e-carac-values" style="display:flex!important;flex-wrap:wrap!important;gap:7px!important;justify-content:center!important;align-items:center!important;margin:0 0 9px 0!important;">${this._valueCardsHtml()}</div>
        <div id="classes-suggestions" style="margin:0 0 9px 0!important;padding:8px 10px!important;border:1px solid #8a6330!important;border-radius:8px!important;background:rgba(43,28,13,.10)!important;max-height:360px!important;overflow:auto!important;"></div>
        <div class="add2e-carac-actions" style="display:flex!important;justify-content:center!important;align-items:center!important;gap:10px!important;margin-top:8px!important;">
          <button type="button" class="add2e-carac-action reroll reroll-caracs-btn" style="min-width:110px!important;padding:6px 12px!important;border-radius:7px!important;font-weight:900!important;cursor:pointer!important;box-shadow:0 2px 5px rgba(0,0,0,.25)!important;border:1px solid #775122!important;background:linear-gradient(180deg,#f6dfad,#d19b4c)!important;color:#2d1c0b!important;">Relancer</button>
          <button type="button" class="add2e-carac-action validate apply-caracs-btn" style="min-width:110px!important;padding:6px 12px!important;border-radius:7px!important;font-weight:900!important;cursor:pointer!important;box-shadow:0 2px 5px rgba(0,0,0,.25)!important;border:1px solid #6e1414!important;background:linear-gradient(180deg,#a7372d,#6e1714)!important;color:#fff1d5!important;">Valider</button>
          <button type="button" class="add2e-carac-action cancel cancel-caracs-btn" style="min-width:110px!important;padding:6px 12px!important;border-radius:7px!important;font-weight:900!important;cursor:pointer!important;box-shadow:0 2px 5px rgba(0,0,0,.25)!important;border:1px solid #6a5640!important;background:linear-gradient(180deg,#7b6c5c,#4f463b)!important;color:#fff1d5!important;">Annuler</button>
        </div>
      </div>`;
  }

  _dialogWindowElement() {
    return this._dlgRoot?.closest?.(".application, .window-app, .app, .dialog") ?? null;
  }

  _hideNativeFooter() {
    for (const footer of this._dialogWindowElement()?.querySelectorAll?.(".form-footer, .dialog-buttons, footer") ?? []) {
      if (!footer.closest("[data-add2e-carac-roller]")) footer.style.display = "none";
    }
  }

  _lockDialogGeometry() {
    const windowElement = this._dialogWindowElement();
    if (!windowElement) return;
    const width = `${ADD2E_CARAC_DIALOG_WIDTH}px`;
    windowElement.style.setProperty("width", width, "important");
    windowElement.style.setProperty("min-width", width, "important");
    windowElement.style.setProperty("max-width", width, "important");
    const content = this._dlgRoot?.closest?.(".window-content, .application-content") ?? this._dlgRoot?.parentElement;
    content?.style?.setProperty("width", "100%", "important");
    content?.style?.setProperty("box-sizing", "border-box", "important");
  }

  _keepDialogOnTop() {
    const windowElement = this._dialogWindowElement();
    if (!windowElement) return;
    windowElement.style.zIndex = "2147483000";
    windowElement.dataset.add2eAlwaysOnTop = "carac-roller";
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
    if (this._dialogEventsBound || !this._dlgRoot) return;
    this._dialogEventsBound = true;
    this._dlgRoot.addEventListener("click", this._dialogClickHandler);
  }

  _onDialogClick(event) {
    const button = event.target?.closest?.("button");
    if (!button || !this._dlgRoot?.contains(button)) return;

    if (button.matches(".add2e-class-suggestion")) {
      event.preventDefault();
      this._keepDialogOnTop();
      const plan = this._suggestionPlans.get(button.dataset.planKey);
      if (plan) this.applyClassSuggestion(plan);
      return;
    }

    if (button.matches(".add2e-carac-value")) {
      event.preventDefault();
      this._keepDialogOnTop();
      const index = Number(button.dataset.idx);
      if (this.used[index]) this.unassignCarac(this.used[index]);
      else {
        this.selectedIdx = index;
        this._updateAssignLabels();
      }
      return;
    }

    if (button.matches(".apply-caracs-btn")) {
      event.preventDefault();
      this.apply();
      return;
    }

    if (button.matches(".reroll-caracs-btn")) {
      event.preventDefault();
      this.reroll();
      return;
    }

    if (button.matches(".cancel-caracs-btn")) {
      event.preventDefault();
      this.cancel();
    }
  }

  reroll() {
    this._rollValues();
    const valuesRoot = this._dlgRoot?.querySelector(".add2e-carac-values");
    if (valuesRoot) valuesRoot.innerHTML = this._valueCardsHtml();
    this._updateCaracDisplay();
    this._updateAssignLabels();
    this._setClassesHtml("<em>Actualisation...</em>");
    this._refreshClassSuggestions();
  }

  _sheetTargets() {
    return Array.from(add2eCaracSheetRoot(this.sheet)?.querySelectorAll?.('.carac-drop-target[data-carac]') ?? []);
  }

  _bindSheetTargets() {
    for (const element of this._sheetTargets()) {
      element.onclick = null;
      element.classList.add("clickable");
      element.dataset.add2eCaracRoller = this._uid;
      element.removeEventListener("click", this._sheetTargetHandler);
      element.addEventListener("click", this._sheetTargetHandler);
    }
    this._updatePendingSheetBorders();
  }

  _unbindSheetTargets() {
    for (const element of this._sheetTargets()) {
      if (element.dataset.add2eCaracRoller !== this._uid) continue;
      element.removeEventListener("click", this._sheetTargetHandler);
      element.classList.remove("clickable", "assignable", "carac-assigned", "add2e-carac-pending");
      element.style.outline = "";
      element.style.outlineOffset = "";
      element.style.boxShadow = "";
      delete element.dataset.add2eCaracRoller;
    }
  }

  _updatePendingSheetBorders() {
    for (const element of this._sheetTargets()) {
      const carac = element.dataset?.carac;
      if (!ADD2E_CARACS.includes(carac)) continue;
      const pending = this.assigned[carac] === undefined;
      element.classList.toggle("add2e-carac-pending", pending);
      element.style.outline = pending ? "2px solid #c01818" : "";
      element.style.outlineOffset = pending ? "2px" : "";
      element.style.boxShadow = pending ? "0 0 0 2px rgba(192,24,24,.22),0 0 10px rgba(192,24,24,.45)" : "";
    }
  }

  _onSheetTargetClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const carac = event.currentTarget?.dataset?.carac;
    if (!ADD2E_CARACS.includes(carac)) return;
    if (this.assigned[carac] !== undefined) this.unassignCarac(carac);
    else this.assignToCarac(carac);
  }

  assignToCarac(carac) {
    if (this.selectedIdx === null) return;
    const index = this.selectedIdx;
    const previous = Object.keys(this.assigned).find(key => Number(this.assigned[key]) === index);
    if (previous) delete this.assigned[previous];
    if (this.assigned[carac] !== undefined) delete this.used[this.assigned[carac]];
    this.assigned[carac] = index;
    this.used[index] = carac;
    this.selectedIdx = null;
    this._refreshUi();
  }

  applyClassSuggestion(plan) {
    if (!plan?.assignments) return;
    for (const [carac, rawIndex] of Object.entries(plan.assignments)) {
      const index = Number(rawIndex);
      if (!ADD2E_CARACS.includes(carac) || !Number.isFinite(index)) continue;
      const previous = Object.keys(this.assigned).find(key => key !== carac && Number(this.assigned[key]) === index);
      if (previous) delete this.assigned[previous];
      if (this.assigned[carac] !== undefined && Number(this.assigned[carac]) !== index) delete this.used[this.assigned[carac]];
      this.assigned[carac] = index;
      this.used[index] = carac;
    }
    for (const [index, carac] of Object.entries({ ...this.used })) {
      if (this.assigned[carac] === undefined || Number(this.assigned[carac]) !== Number(index)) delete this.used[index];
    }
    this.selectedIdx = null;
    this._refreshUi();
  }

  unassignCarac(carac) {
    if (this.assigned[carac] === undefined) return;
    delete this.used[this.assigned[carac]];
    delete this.assigned[carac];
    this.selectedIdx = null;
    this._refreshUi();
  }

  _refreshUi() {
    this._updateCaracDisplay();
    this._updateAssignLabels();
    this._setClassesHtml("<em>Actualisation...</em>");
    this._refreshClassSuggestions();
  }

  _updateAssignLabels() {
    this._dlgRoot?.querySelectorAll(".add2e-carac-value").forEach(element => {
      const index = Number(element.dataset.idx);
      const carac = Object.keys(this.assigned).find(key => Number(this.assigned[key]) === index) ?? null;
      element.classList.toggle("used", Boolean(carac));
      element.classList.toggle("selected", this.selectedIdx === index);
      const label = element.querySelector(".assigned-label");
      if (label) label.textContent = carac ? ADD2E_CARAC_SHORT[carac] : "—";
    });
    this._sheetTargets().forEach(element => element.classList.toggle("assignable", this.selectedIdx !== null));
    this._updatePendingSheetBorders();
  }

  _updateCaracDisplay() {
    for (const carac of ADD2E_CARACS) {
      const element = this._sheetTargets().find(target => target.dataset.carac === carac);
      if (!element) continue;
      const bonus = add2eCaracRaceBonus(this.actor, carac);
      const base = this.assigned[carac] !== undefined ? this.values[this.assigned[carac]] : this._oldValues[carac];
      element.classList.toggle("carac-assigned", this.assigned[carac] !== undefined);
      element.innerHTML = `<span style="font-size:1.22em;font-weight:bold;">${base + bonus}</span><div style="font-size:.40em;line-height:1.2em;color:#777;margin-top:1px;"><span style="color:#555;">base : </span>${base}<br><span style="color:#555;">bonus : </span><span style="color:${bonus > 0 ? "#1abc9c" : bonus < 0 ? "#e74c3c" : "#777"};">${bonus > 0 ? "+" : ""}${bonus}</span></div>`;
    }
    this._updatePendingSheetBorders();
  }

  _classSuggestionPlan(cls) {
    const requis = Object.entries(cls.system?.caracs_min || {})
      .map(([carac, value]) => ({ carac, min: Number(value) || 0 }))
      .filter(entry => ADD2E_CARACS.includes(entry.carac) && entry.min > 0)
      .sort((left, right) => right.min - left.min || left.carac.localeCompare(right.carac, "fr"));

    // Chaque classe est évaluée indépendamment sur l'intégralité du tirage.
    // Aucune valeur n'est retirée pour les autres classes proposées.
    const searchPlan = (position, availableIndexes, assignments) => {
      if (position >= requis.length) return assignments;
      const requirement = requis[position];
      const options = availableIndexes
        .filter(index => this.values[index] >= requirement.min)
        .sort((left, right) => {
          const leftSlack = this.values[left] - requirement.min;
          const rightSlack = this.values[right] - requirement.min;
          return leftSlack - rightSlack || left - right;
        });

      for (const index of options) {
        const result = searchPlan(
          position + 1,
          availableIndexes.filter(candidate => candidate !== index),
          { ...assignments, [requirement.carac]: index }
        );
        if (result) return result;
      }
      return null;
    };

    const assignments = searchPlan(0, this.values.map((_, index) => index), {});
    if (!assignments) return null;

    const placements = requis.map(requirement => {
      const index = assignments[requirement.carac];
      return `<span style="display:inline-flex!important;gap:1px!important;align-items:center!important;"><b>${ADD2E_CARAC_SHORT[requirement.carac]}</b><span class="carac-ok" style="color:#d8ffd4!important;font-weight:900!important;">${this.values[index]}</span></span>`;
    });
    return { className: cls.name, placements, assignments };
  }

  _classTagStyle(name) {
    const [background, foreground] = ADD2E_CLASS_TAG_COLOR_BY_SLUG[add2eCaracSlug(name)] ?? ADD2E_CLASS_TAG_COLORS[add2eClassColorIndex(name)];
    return `display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-start!important;width:100%!important;min-width:0!important;max-width:100%!important;gap:4px!important;border-radius:10px!important;padding:7px 5px!important;cursor:pointer!important;font-size:.74rem!important;line-height:1.08!important;white-space:normal!important;margin:0!important;min-height:82px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.24),0 1px 4px rgba(0,0,0,.26)!important;border:1px solid rgba(40,20,8,.55)!important;background:linear-gradient(180deg,${background},${background}dd)!important;color:${foreground}!important;`;
  }

  async _loadClassSuggestions() {
    if (!this._classesPromise) {
      this._classesPromise = (async () => {
        const pack = game?.packs?.get?.("add2e.classes");
        if (!pack) return [];
        try {
          return Array.from(await pack.getDocuments())
            .filter(document => String(document?.type ?? "").toLowerCase() === "classe")
            .sort((left, right) => String(left?.name ?? "").localeCompare(String(right?.name ?? ""), "fr"));
        } catch (error) {
          console.error("[ADD2E][CARAC_ROLLER][CLASSES_COMPENDIUM]", error);
          return [];
        }
      })();
    }
    return this._classesPromise;
  }

  async classesSynthese() {
    const classes = await this._loadClassSuggestions();
    if (!classes.length) return "<em>Le compendium ADD2E des classes est introuvable ou vide.</em>";

    this._suggestionPlans.clear();
    let cards = "";
    let count = 0;
    for (const cls of classes) {
      const plan = this._classSuggestionPlan(cls);
      if (!plan) continue;
      const key = `plan-${count}`;
      this._suggestionPlans.set(key, plan);
      count += 1;
      const detail = plan.placements.length
        ? `<span class="class-requis" style="display:flex!important;flex-wrap:wrap!important;justify-content:center!important;gap:3px!important;width:100%!important;font-size:.68rem!important;line-height:1.05!important;margin-top:2px!important;text-align:center!important;">${plan.placements.join(" ")}</span>`
        : '<span class="class-no-requis" style="display:block!important;width:100%!important;font-size:.56rem!important;line-height:1.05!important;margin-top:2px!important;text-align:center!important;color:rgba(255,255,255,.82)!important;font-style:italic!important;font-weight:700!important;">Aucun prérequis</span>';
      cards += `<button type="button" class="add2e-class-suggestion" data-plan-key="${key}" title="Auto-affecter les prérequis" style="${this._classTagStyle(cls.name)}"><b class="class-name" style="display:block!important;width:100%!important;min-height:2.1em!important;overflow:visible!important;text-overflow:clip!important;white-space:normal!important;overflow-wrap:anywhere!important;text-align:center!important;font-weight:900!important;line-height:1.05!important;color:inherit!important;">${add2eCaracEscapeHtml(cls.name)}</b>${detail}</button>`;
    }

    const heading = `<div style="margin:0 0 6px!important;font-size:.82rem!important;color:#5b1e16!important;font-weight:900!important;">Classes possibles : ${count}<span style="font-size:.68rem!important;font-weight:700!important;color:#6a4a28!important;"> / ${classes.length} chargée${classes.length > 1 ? "s" : ""}</span></div>`;
    const body = count ? cards : "<em>Aucune classe ne correspond à ce tirage.</em>";
    return `${heading}<div class="add2e-class-tags" style="display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:7px!important;align-items:stretch!important;width:100%!important;">${body}</div>`;
  }

  async _refreshClassSuggestions() {
    const generation = ++this._classSuggestionGeneration;
    try {
      const html = await this.classesSynthese();
      if (generation === this._classSuggestionGeneration && this._dlgRoot?.isConnected) this._setClassesHtml(html);
    } catch (_error) {
      if (generation === this._classSuggestionGeneration && this._dlgRoot?.isConnected) this._setClassesHtml("<em>Impossible de charger le compendium ADD2E des classes.</em>");
    }
  }

  _setClassesHtml(html) {
    const element = this._dlgRoot?.querySelector("#classes-suggestions");
    if (element) element.innerHTML = html;
    this._keepDialogOnTop();
  }

  async _confirmOverflows(overflows) {
    const DialogV2 = add2eCaracDialogV2();
    return DialogV2.confirm({
      window: { title: "Caractéristique supérieure à 18" },
      content: `<p>Une ou plusieurs caractéristiques dépassent 18 après bonus racial.</p><ul>${overflows.map(entry => `<li><b>${ADD2E_CARAC_SHORT[entry.carac]}</b> : base ${entry.base} + bonus racial ${entry.bonusRacial} = <span style="color:#e74c3c;font-weight:bold;">${entry.total}</span> <b>→ 18</b></li>`).join("")}</ul><p>Elles seront ramenées à 18. Confirmez-vous l’affectation ?</p>`,
      yes: { label: "Confirmer" },
      no: { label: "Revenir" },
      rejectClose: false
    });
  }

  async apply() {
    if (!ADD2E_CARACS.every(carac => this.assigned[carac] !== undefined)) {
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

    if (overflows.length && !await this._confirmOverflows(overflows)) return;
    for (const overflow of overflows) {
      const cappedBase = Math.max(3, 18 - overflow.bonusRacial);
      updates[`system.${overflow.carac}_base`] = cappedBase;
      baseCaracs[overflow.carac] = cappedBase;
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
    const updates = Object.fromEntries(ADD2E_CARACS.map(carac => [`system.${carac}_base`, this._oldValues[carac]]));
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
