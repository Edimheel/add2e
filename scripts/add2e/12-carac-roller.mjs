// ADD2E — Tirage et affectation des caractéristiques — Dialog V2
const ADD2E_CARAC_ROLLER_VERSION = "2026-07-05-carac-roller-plan-search-v8";
const ADD2E_CARAC_DIALOG_WIDTH = 600;
const ADD2E_CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
const ADD2E_CARAC_SHORT = { force: "FOR", dexterite: "DEX", constitution: "CON", intelligence: "INT", sagesse: "SAG", charisme: "CHA" };
const ADD2E_CLASS_TAG_COLOR_BY_SLUG = {
  assassin: ["#7b1e24", "#ffe1d8"], clerc: ["#375d89", "#e6f0ff"], druide: ["#2f6b3f", "#e3ffd9"],
  guerrier: ["#8a4b1d", "#fff0d6"], illusionniste: ["#5b3f95", "#f0e6ff"], magicien: ["#243c78", "#dbe7ff"],
  moine: ["#7b5a23", "#fff1c7"], paladin: ["#8b842b", "#fffad1"], ranger: ["#2d5f55", "#d8fff4"], voleur: ["#4f5158", "#eef0f4"]
};
const ADD2E_CLASS_TAG_COLORS = Object.values(ADD2E_CLASS_TAG_COLOR_BY_SLUG);

function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function slug(value) { return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
function dialogV2() { return foundry?.applications?.api?.DialogV2 ?? null; }
function sheetRoot(sheet) { const root = sheet?.element?.jquery ? sheet.element[0] : sheet?.element; return root?.querySelector?.(".add2e-character-v3") || root?.querySelector?.("form.sheet.actor.add2e") || root || null; }
function raceBonus(actor, carac) { const system = actor?.system ?? {}; return Number(system.bonus_caracteristiques?.[carac] ?? system[`${carac}_race`] ?? 0) || 0; }
function baseValue(actor, carac) { return Number(actor?.system?.[`${carac}_base`] ?? actor?.system?.[carac] ?? 10) || 10; }
function colorIndex(name) { let hash = 0; for (const char of String(name ?? "")) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0; return Math.abs(hash) % ADD2E_CLASS_TAG_COLORS.length; }

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
    this._eventsBound = false;
    this._uid = `add2e-carac-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this._sheetTargetHandler = this._onSheetTargetClick.bind(this);
    this._dialogClickHandler = this._onDialogClick.bind(this);
    this._oldValues = Object.fromEntries(ADD2E_CARACS.map(carac => [carac, baseValue(this.actor, carac)]));
    this.render();
  }

  static rollCarac() { const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1).sort((a, b) => b - a); return dice[0] + dice[1] + dice[2]; }

  _rollValues() { this.values = Array.from({ length: 7 }, () => Add2eCaracRoller.rollCarac()).sort((a, b) => b - a).slice(0, 6); this.used = {}; this.assigned = {}; this.selectedIdx = null; }

  render() {
    const DialogV2 = dialogV2();
    if (!DialogV2) return ui.notifications.error("Dialog V2 est introuvable : tirage des caractéristiques impossible.");
    this._rollValues();
    this._applied = false;
    this._closing = false;
    this.dialogRef = new DialogV2({
      window: { title: "Tirage des caractéristiques" },
      content: this._content(),
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
      this._startKeepOnTop();
      this._refreshClassSuggestions();
    }, 0);
  }

  _valueCards() {
    return this.values.map((value, index) => `<button type="button" class="add2e-carac-value" data-idx="${index}" title="Cliquer pour sélectionner. Si la valeur est affectée, cliquer pour la libérer."><strong>${value}</strong><span class="assigned-label">—</span></button>`).join("");
  }

  _content() {
    return `<style>
      .add2e-carac-popup{box-sizing:border-box;width:100%;padding:10px;color:#2a1b0d;background:linear-gradient(180deg,#efe0bc,#d8bd82);border:2px solid #5a3418;border-radius:8px}.add2e-carac-popup button{cursor:pointer}.add2e-carac-intro,#classes-suggestions{border:1px solid #8a6330;border-radius:8px;background:rgba(255,247,218,.62);padding:8px 10px}.add2e-carac-values{display:flex;flex-wrap:wrap;justify-content:center;gap:7px;margin:9px 0}.add2e-carac-value{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-width:46px;height:48px;padding:4px 7px;border:1px solid #7a4d21;border-radius:8px;background:linear-gradient(180deg,#fff1c8,#d7a95e);color:#2b1b0d}.add2e-carac-value strong{font-size:1.12rem}.assigned-label{font-size:.62rem;min-height:.72rem;color:#5b3514;font-weight:900}.add2e-carac-value.selected{outline:2px solid #8d1f1f!important}.add2e-carac-value.used{opacity:.82;background:linear-gradient(180deg,#8b7b63,#5f533f);color:#fff2d0}.add2e-carac-value.used .assigned-label{color:#ffe19b}.add2e-class-tags{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;width:100%}.add2e-class-suggestion{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;min-height:82px;padding:7px 5px;border-radius:10px;font-size:.74rem;line-height:1.08}.add2e-class-suggestion:hover{filter:brightness(1.13);transform:translateY(-1px)}.class-name{display:block;width:100%;min-height:2.1em;white-space:normal;overflow-wrap:anywhere;text-align:center;font-weight:900;line-height:1.05}.carac-ok{color:#d8ffd4;font-weight:900}.class-no-requis{color:rgba(255,255,255,.82);font-style:italic;font-weight:700}.add2e-carac-actions{display:flex;justify-content:center;gap:10px;margin-top:8px}.add2e-carac-action{min-width:110px;padding:6px 12px;border-radius:7px;font-weight:900}.reroll{border:1px solid #775122;background:linear-gradient(180deg,#f6dfad,#d19b4c);color:#2d1c0b}.validate{border:1px solid #6e1414;background:linear-gradient(180deg,#a7372d,#6e1714);color:#fff1d5}.cancel{border:1px solid #6a5640;background:linear-gradient(180deg,#7b6c5c,#4f463b);color:#fff1d5}
    </style><div class="add2e-carac-popup" data-add2e-carac-roller="${this._uid}"><div class="add2e-carac-intro"><div style="font-size:.96rem;font-weight:900;color:#5b1e16">Affectation des caractéristiques</div><div style="font-size:.78rem;line-height:1.25">Cliquez sur une valeur puis une caractéristique. Cliquez une valeur déjà affectée pour la libérer. Cliquez une classe pour ses prérequis.</div></div><div class="add2e-carac-values">${this._valueCards()}</div><div id="classes-suggestions" style="max-height:360px;overflow:auto"></div><div class="add2e-carac-actions"><button type="button" class="add2e-carac-action reroll reroll-caracs-btn">Relancer</button><button type="button" class="add2e-carac-action validate apply-caracs-btn">Valider</button><button type="button" class="add2e-carac-action cancel cancel-caracs-btn">Annuler</button></div></div>`;
  }

  _window() { return this._dlgRoot?.closest?.(".application,.window-app,.app,.dialog") ?? null; }
  _hideNativeFooter() { for (const footer of this._window()?.querySelectorAll?.(".form-footer,.dialog-buttons,footer") ?? []) if (!footer.closest("[data-add2e-carac-roller]")) footer.style.display = "none"; }
  _lockDialogGeometry() { const win = this._window(); if (!win) return; const width = `${ADD2E_CARAC_DIALOG_WIDTH}px`; for (const property of ["width", "min-width", "max-width"]) win.style.setProperty(property, width, "important"); const content = this._dlgRoot?.closest?.(".window-content,.application-content") ?? this._dlgRoot?.parentElement; content?.style?.setProperty("width", "100%", "important"); }
  _keepDialogOnTop() { const win = this._window(); if (!win) return; win.style.zIndex = "2147483000"; win.dataset.add2eAlwaysOnTop = "carac-roller"; this._hideNativeFooter(); this._lockDialogGeometry(); }
  _startKeepOnTop() { this._stopKeepOnTop(); this._keepOnTopTimer = setInterval(() => this._keepDialogOnTop(), 350); }
  _stopKeepOnTop() { if (this._keepOnTopTimer) clearInterval(this._keepOnTopTimer); this._keepOnTopTimer = null; }

  _bindDialogEvents() { if (this._eventsBound || !this._dlgRoot) return; this._eventsBound = true; this._dlgRoot.addEventListener("click", this._dialogClickHandler); }
  _onDialogClick(event) {
    const button = event.target?.closest?.("button");
    if (!button || !this._dlgRoot?.contains(button)) return;
    if (button.matches(".add2e-class-suggestion")) { event.preventDefault(); const plan = this._suggestionPlans.get(button.dataset.planKey); if (plan) this.applyClassSuggestion(plan); return; }
    if (button.matches(".add2e-carac-value")) { event.preventDefault(); const index = Number(button.dataset.idx); if (this.used[index]) this.unassignCarac(this.used[index]); else { this.selectedIdx = index; this._updateAssignLabels(); } return; }
    if (button.matches(".apply-caracs-btn")) { event.preventDefault(); this.apply(); return; }
    if (button.matches(".reroll-caracs-btn")) { event.preventDefault(); this.reroll(); return; }
    if (button.matches(".cancel-caracs-btn")) { event.preventDefault(); this.cancel(); }
  }

  reroll() { this._rollValues(); const values = this._dlgRoot?.querySelector(".add2e-carac-values"); if (values) values.innerHTML = this._valueCards(); this._updateCaracDisplay(); this._updateAssignLabels(); this._setClasses("<em>Actualisation...</em>"); this._refreshClassSuggestions(); }

  _sheetTargets() { return Array.from(sheetRoot(this.sheet)?.querySelectorAll?.('.carac-drop-target[data-carac]') ?? []); }
  _bindSheetTargets() { for (const element of this._sheetTargets()) { element.onclick = null; element.classList.add("clickable"); element.dataset.add2eCaracRoller = this._uid; element.removeEventListener("click", this._sheetTargetHandler); element.addEventListener("click", this._sheetTargetHandler); } this._updatePendingSheetBorders(); }
  _unbindSheetTargets() { for (const element of this._sheetTargets()) { if (element.dataset.add2eCaracRoller !== this._uid) continue; element.removeEventListener("click", this._sheetTargetHandler); element.classList.remove("clickable", "assignable", "carac-assigned", "add2e-carac-pending"); element.style.outline = ""; element.style.outlineOffset = ""; element.style.boxShadow = ""; delete element.dataset.add2eCaracRoller; } }
  _updatePendingSheetBorders() { for (const element of this._sheetTargets()) { const carac = element.dataset?.carac; if (!ADD2E_CARACS.includes(carac)) continue; const pending = this.assigned[carac] === undefined; element.classList.toggle("add2e-carac-pending", pending); element.style.outline = pending ? "2px solid #c01818" : ""; element.style.outlineOffset = pending ? "2px" : ""; element.style.boxShadow = pending ? "0 0 0 2px rgba(192,24,24,.22),0 0 10px rgba(192,24,24,.45)" : ""; } }
  _onSheetTargetClick(event) { event.preventDefault(); event.stopPropagation(); const carac = event.currentTarget?.dataset?.carac; if (!ADD2E_CARACS.includes(carac)) return; if (this.assigned[carac] !== undefined) this.unassignCarac(carac); else this.assignToCarac(carac); }

  assignToCarac(carac) { if (this.selectedIdx === null) return; const index = this.selectedIdx; const previous = Object.keys(this.assigned).find(key => Number(this.assigned[key]) === index); if (previous) delete this.assigned[previous]; if (this.assigned[carac] !== undefined) delete this.used[this.assigned[carac]]; this.assigned[carac] = index; this.used[index] = carac; this.selectedIdx = null; this._refreshUi(); }
  applyClassSuggestion(plan) { if (!plan?.assignments) return; for (const [carac, rawIndex] of Object.entries(plan.assignments)) { const index = Number(rawIndex); if (!ADD2E_CARACS.includes(carac) || !Number.isFinite(index)) continue; const previous = Object.keys(this.assigned).find(key => key !== carac && Number(this.assigned[key]) === index); if (previous) delete this.assigned[previous]; if (this.assigned[carac] !== undefined && Number(this.assigned[carac]) !== index) delete this.used[this.assigned[carac]]; this.assigned[carac] = index; this.used[index] = carac; } for (const [index, carac] of Object.entries({ ...this.used })) if (this.assigned[carac] === undefined || Number(this.assigned[carac]) !== Number(index)) delete this.used[index]; this.selectedIdx = null; this._refreshUi(); }
  unassignCarac(carac) { if (this.assigned[carac] === undefined) return; delete this.used[this.assigned[carac]]; delete this.assigned[carac]; this.selectedIdx = null; this._refreshUi(); }
  _refreshUi() { this._updateCaracDisplay(); this._updateAssignLabels(); this._setClasses("<em>Actualisation...</em>"); this._refreshClassSuggestions(); }
  _updateAssignLabels() { this._dlgRoot?.querySelectorAll(".add2e-carac-value").forEach(element => { const index = Number(element.dataset.idx); const carac = Object.keys(this.assigned).find(key => Number(this.assigned[key]) === index) ?? null; element.classList.toggle("used", Boolean(carac)); element.classList.toggle("selected", this.selectedIdx === index); const label = element.querySelector(".assigned-label"); if (label) label.textContent = carac ? ADD2E_CARAC_SHORT[carac] : "—"; }); this._sheetTargets().forEach(element => element.classList.toggle("assignable", this.selectedIdx !== null)); this._updatePendingSheetBorders(); }
  _updateCaracDisplay() { for (const carac of ADD2E_CARACS) { const element = this._sheetTargets().find(target => target.dataset.carac === carac); if (!element) continue; const bonus = raceBonus(this.actor, carac); const base = this.assigned[carac] !== undefined ? this.values[this.assigned[carac]] : this._oldValues[carac]; element.classList.toggle("carac-assigned", this.assigned[carac] !== undefined); element.innerHTML = `<span style="font-size:1.22em;font-weight:bold;">${base + bonus}</span><div style="font-size:.40em;line-height:1.2em;color:#777;margin-top:1px;"><span style="color:#555;">base : </span>${base}<br><span style="color:#555;">bonus : </span><span style="color:${bonus > 0 ? "#1abc9c" : bonus < 0 ? "#e74c3c" : "#777"};">${bonus > 0 ? "+" : ""}${bonus}</span></div>`; } this._updatePendingSheetBorders(); }

  _classSuggestionPlan(cls) {
    const requis = Object.entries(cls.system?.caracs_min || {}).map(([carac, value]) => ({ carac, min: Number(value) || 0 })).filter(entry => ADD2E_CARACS.includes(entry.carac) && entry.min > 0).sort((left, right) => right.min - left.min || left.carac.localeCompare(right.carac, "fr"));
    const search = (position, available, assignments) => {
      if (position >= requis.length) return assignments;
      const requirement = requis[position];
      const bonus = raceBonus(this.actor, requirement.carac);
      const options = available.filter(index => this.values[index] + bonus >= requirement.min).sort((left, right) => (this.values[left] + bonus - requirement.min) - (this.values[right] + bonus - requirement.min) || left - right);
      for (const index of options) { const result = search(position + 1, available.filter(candidate => candidate !== index), { ...assignments, [requirement.carac]: index }); if (result) return result; }
      return null;
    };
    const assignments = search(0, this.values.map((_, index) => index), {});
    if (!assignments) return null;
    const placements = requis.map(requirement => `<span style="display:inline-flex;gap:1px;align-items:center;"><b>${ADD2E_CARAC_SHORT[requirement.carac]}</b><span class="carac-ok">${this.values[assignments[requirement.carac]]}</span></span>`);
    return { className: cls.name, placements, assignments };
  }

  _classStyle(name) { const [background, foreground] = ADD2E_CLASS_TAG_COLOR_BY_SLUG[slug(name)] ?? ADD2E_CLASS_TAG_COLORS[colorIndex(name)]; return `display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;min-height:82px;padding:7px 5px;border-radius:10px;border:1px solid rgba(40,20,8,.55);background:linear-gradient(180deg,${background},${background}dd);color:${foreground}`; }
  async _classes() { if (!this._classesPromise) this._classesPromise = (async () => { const pack = game?.packs?.get?.("add2e.classes"); if (!pack) return []; try { return Array.from(await pack.getDocuments()).filter(document => String(document?.type ?? "").toLowerCase() === "classe").sort((left, right) => String(left?.name ?? "").localeCompare(String(right?.name ?? ""), "fr")); } catch (error) { console.error("[ADD2E][CARAC_ROLLER][CLASSES_COMPENDIUM]", error); return []; } })(); return this._classesPromise; }
  async _classHtml() { const classes = await this._classes(); if (!classes.length) return "<em>Le compendium ADD2E des classes est introuvable ou vide.</em>"; this._suggestionPlans.clear(); let count = 0; let cards = ""; for (const cls of classes) { const plan = this._classSuggestionPlan(cls); if (!plan) continue; const key = `plan-${count++}`; this._suggestionPlans.set(key, plan); const detail = plan.placements.length ? `<span style="display:flex;flex-wrap:wrap;justify-content:center;gap:3px;width:100%;font-size:.68rem;text-align:center;">${plan.placements.join(" ")}</span>` : '<span class="class-no-requis">Aucun prérequis</span>'; cards += `<button type="button" class="add2e-class-suggestion" data-plan-key="${key}" title="Auto-affecter les prérequis" style="${this._classStyle(cls.name)}"><b class="class-name">${esc(cls.name)}</b>${detail}</button>`; } return `<div style="margin:0 0 6px;font-size:.82rem;color:#5b1e16;font-weight:900;">Classes possibles : ${count}<span style="font-size:.68rem;font-weight:700;color:#6a4a28;"> / ${classes.length} chargée${classes.length > 1 ? "s" : ""}</span></div><div class="add2e-class-tags">${cards || "<em>Aucune classe ne correspond à ce tirage.</em>"}</div>`; }
  async _refreshClassSuggestions() { const generation = ++this._classSuggestionGeneration; try { const html = await this._classHtml(); if (generation === this._classSuggestionGeneration && this._dlgRoot?.isConnected) this._setClasses(html); } catch (_error) { if (generation === this._classSuggestionGeneration && this._dlgRoot?.isConnected) this._setClasses("<em>Impossible de charger le compendium ADD2E des classes.</em>"); } }
  _setClasses(html) { const element = this._dlgRoot?.querySelector("#classes-suggestions"); if (element) element.innerHTML = html; this._keepDialogOnTop(); }

  async _confirmOverflows(overflows) { const DialogV2 = dialogV2(); return DialogV2.confirm({ window: { title: "Caractéristique supérieure à 18" }, content: `<p>Une ou plusieurs caractéristiques dépassent 18 après bonus racial.</p><ul>${overflows.map(entry => `<li><b>${ADD2E_CARAC_SHORT[entry.carac]}</b> : base ${entry.base} + bonus racial ${entry.bonusRacial} = <span style="color:#e74c3c;font-weight:bold;">${entry.total}</span> <b>→ 18</b></li>`).join("")}</ul><p>Elles seront ramenées à 18. Confirmez-vous l’affectation ?</p>`, yes: { label: "Confirmer" }, no: { label: "Revenir" }, rejectClose: false }); }
  async apply() { if (!ADD2E_CARACS.every(carac => this.assigned[carac] !== undefined)) return ui.notifications.warn("Toutes les caractéristiques doivent être affectées."); const updates = {}; const baseCaracs = {}; const overflows = []; for (const carac of ADD2E_CARACS) { const base = Number(this.values[this.assigned[carac]]) || 10; const bonusRacial = raceBonus(this.actor, carac); const total = base + bonusRacial; if (total > 18) overflows.push({ carac, base, bonusRacial, total }); updates[`system.${carac}_base`] = base; baseCaracs[carac] = base; } if (overflows.length && !await this._confirmOverflows(overflows)) return; for (const overflow of overflows) { const cappedBase = Math.max(3, 18 - overflow.bonusRacial); updates[`system.${overflow.carac}_base`] = cappedBase; baseCaracs[overflow.carac] = cappedBase; } await this.actor.update(updates); await this.actor.setFlag("add2e", "base_caracs", baseCaracs); if (typeof this.sheet?.autoSetCaracAjustements === "function") await this.sheet.autoSetCaracAjustements(); this._applied = true; this._unbindSheetTargets(); ui.notifications.info("Affectation terminée."); await this.sheet?.render?.(false); this._closeDialogOnly(); }
  async cancel() { await this._restoreOldCaracs(); this._closeDialogOnly(); }
  async _restoreOldCaracs() { if (this._applied || !this.actor) return; this.assigned = {}; this.used = {}; this.selectedIdx = null; this._updateCaracDisplay(); this._updateAssignLabels(); await this.actor.update(Object.fromEntries(ADD2E_CARACS.map(carac => [`system.${carac}_base`, this._oldValues[carac]]))); if (typeof this.sheet?.autoSetCaracAjustements === "function") await this.sheet.autoSetCaracAjustements(); }
  _closeDialogOnly() { if (this._closing) return; this._closing = true; this._stopKeepOnTop(); this._unbindSheetTargets(); this.dialogRef?.close?.(); }
  _onDialogClosed() { this._stopKeepOnTop(); if (!this._applied && !this._closing) { this._closing = true; this._restoreOldCaracs(); } this._unbindSheetTargets(); }
}

globalThis.Add2eCaracRoller = Add2eCaracRoller;
globalThis.ADD2E_CARAC_ROLLER_VERSION = ADD2E_CARAC_ROLLER_VERSION;
console.log("[ADD2E][CARAC_ROLLER][VERSION]", ADD2E_CARAC_ROLLER_VERSION);
