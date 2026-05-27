// ============================================================
// ADD2E — Tirage et affectation des caractéristiques — Dialog V2
// Fichier externalisé depuis add2e.mjs.
// ============================================================

const ADD2E_CARAC_ROLLER_VERSION = "2026-05-27-carac-roller-dialog-v2-v1";

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

  render() {
    const DialogV2 = add2eCaracDialogV2();
    if (!DialogV2) {
      ui.notifications.error("Dialog V2 est introuvable : tirage des caractéristiques impossible.");
      console.error("[ADD2E][CARAC_ROLLER] DialogV2 introuvable.");
      return;
    }

    const rolls = Array.from({ length: 7 }, () => Add2eCaracRoller.rollCarac()).sort((a, b) => b - a);
    this.values = rolls.slice(0, 6);
    this.used = {};
    this.assigned = {};
    this.selectedIdx = null;
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
    }, { width: 520, height: "auto" });

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
      this.classesSynthese().then(html => this._setClassesHtml(html));
    }, 0);

    console.log("[ADD2E][CARAC_ROLLER][OPEN]", {
      version: ADD2E_CARAC_ROLLER_VERSION,
      actor: this.actor?.name,
      values: this.values
    });
  }

  _buildContent() {
    return `
      <style>
        .add2e-carac-popup { font-family: var(--font-primary); }
        .add2e-carac-values { display:flex; gap:0.7em; justify-content:center; margin-bottom:1em; flex-wrap:wrap; }
        .add2e-carac-value { background:#e8d4b0; border:1px solid #b89255; border-radius:8px; padding:0.5em 1em; font-size:1.3em; font-weight:bold; cursor:pointer; box-shadow:0 2px 6px #0001; text-align:center; min-width:2.9em; }
        .add2e-carac-value.used { opacity:0.55; background:#bbb; cursor:not-allowed; }
        .add2e-carac-value.selected { outline:3px solid #8e44ad; background:#ffeaa7; }
        .add2e-carac-help { font-size:0.97em; color:#88704b; text-align:center; margin-bottom:1em; }
        .add2e-carac-apply { text-align:center; margin-top:1em; }
        .add2e-carac-apply button { padding:0.5em 1.3em; font-size:1em; background:#8e44ad; color:#fff; border:0; border-radius:6px; cursor:pointer; }
        .assigned-label { font-size:0.85em; color:#164a1b; margin-top:0.3em; display:block; font-weight:500; }
      </style>
      <div class="add2e-carac-popup" data-add2e-carac-roller="${this._uid}">
        <div class="add2e-carac-help">
          Cliquez sur une valeur, puis sur une caractéristique à assigner.<br>
          <b>Astuce :</b> cliquez sur une caractéristique déjà affectée pour la libérer.
        </div>
        <div class="add2e-carac-values">
          ${this.values.map((v, i) => `<div class="add2e-carac-value" data-idx="${i}">${v}<div class="assigned-label">—</div></div>`).join("")}
        </div>
        <div id="classes-suggestions" style="margin:0.6em 0 0.1em 0.1em;"></div>
        <div class="add2e-carac-apply"><button type="button" class="apply-caracs-btn">Valider</button></div>
      </div>
    `;
  }

  _bindDialogEvents() {
    this._dlgRoot.querySelectorAll(".add2e-carac-value").forEach(el => {
      el.addEventListener("click", ev => {
        ev.preventDefault();
        const idx = Number(el.dataset.idx);
        if (this.used[idx]) return;
        this.selectedIdx = idx;
        this._updateAssignLabels();
      });
    });

    this._dlgRoot.querySelector(".apply-caracs-btn")?.addEventListener("click", ev => {
      ev.preventDefault();
      this.apply();
    });
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
    const carac = ev.currentTarget?.dataset?.carac;
    if (!ADD2E_CARACS.includes(carac)) return;
    if (this.assigned[carac] !== undefined) this.unassignCarac(carac);
    else this.assignToCarac(carac);
  }

  assignToCarac(caracName) {
    if (this.selectedIdx === null) return;
    const idx = this.selectedIdx;

    const previousCarac = Object.keys(this.assigned).find(c => this.assigned[c] === idx);
    if (previousCarac) this.unassignCarac(previousCarac);

    if (this.assigned[caracName] !== undefined) delete this.used[this.assigned[caracName]];

    this.assigned[caracName] = idx;
    this.used[idx] = caracName;
    this.selectedIdx = null;
    this._refreshUi();
  }

  unassignCarac(caracName) {
    if (this.assigned[caracName] === undefined) return;
    const idx = this.assigned[caracName];
    delete this.assigned[caracName];
    delete this.used[idx];
    this._refreshUi();
  }

  _refreshUi() {
    this._updateCaracDisplay();
    this._updateAssignLabels();
    this._setClassesHtml("<em>Actualisation...</em>");
    this.classesSynthese().then(html => this._setClassesHtml(html));
  }

  _updateAssignLabels() {
    if (!this._dlgRoot) return;
    this._dlgRoot.querySelectorAll(".add2e-carac-value").forEach(el => {
      const idx = Number(el.dataset.idx);
      const carac = Object.keys(this.assigned).find(c => this.assigned[c] === idx) ?? null;
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

  async classesSynthese() {
    let classes = game.items?.filter?.(i => i.type === "classe") ?? [];
    if (!classes.length) {
      const pack = game.packs.get("add2e.classes");
      if (!pack) return "<em>Compendium des classes introuvable.</em>";
      classes = (await pack.getDocuments()).filter(i => i.type === "classe");
    }
    if (!classes.length) return "<em>Aucune classe trouvée</em>";

    const values = [...this.values].sort((a, b) => b - a);
    let html = '<div style="margin:0.6em 0 0.2em 0.1em;font-size:1.05em;"><b>Classes accessibles et valeur à placer :</b></div>';
    html += '<ul style="padding-left:1.1em;line-height:1.5em;font-size:1.05em;">';

    for (const cls of classes) {
      const requis = Object.entries(cls.system?.caracs_min || {});
      const pool = [...values];
      const placements = [];
      let ok = true;

      for (const [carac, minRaw] of requis) {
        const min = Number(minRaw) || 0;
        const idx = pool.findIndex(val => val + add2eCaracRaceBonus(this.actor, carac) >= min);
        if (idx === -1) { ok = false; break; }
        placements.push(`<b>${ADD2E_CARAC_SHORT[carac] || add2eCaracEscapeHtml(carac)}</b> <span style="color:#219150;font-weight:bold">${pool[idx]}</span>`);
        pool.splice(idx, 1);
      }

      if (ok) html += `<li><b style="color:#6a3c99">${add2eCaracEscapeHtml(cls.name)}</b>${placements.length ? ` : ${placements.join(', ')}` : ''}</li>`;
    }

    html += '</ul>';
    return html;
  }

  _setClassesHtml(html) {
    const el = this._dlgRoot?.querySelector("#classes-suggestions");
    if (el) el.innerHTML = html;
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
    this._unbindSheetTargets();
    this.dialogRef?.close?.();
  }

  _onDialogClosed() {
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
