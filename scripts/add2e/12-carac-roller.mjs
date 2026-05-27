// ============================================================
// ADD2E — Tirage et affectation des caractéristiques — Dialog V2
// Fichier externalisé depuis add2e.mjs.
// ============================================================

const ADD2E_CARAC_ROLLER_VERSION = "2026-05-27-carac-roller-dialog-v2-style-v2";

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
    }, { width: 560, height: "auto" });

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
    const valueCards = this.values.map((v, i) => `
      <button type="button"
        class="add2e-carac-value"
        data-idx="${i}"
        style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:58px;height:62px;padding:6px 10px;border:1px solid #b8935d;border-radius:10px;background:linear-gradient(180deg,#f5dfae 0%,#d3a967 100%);box-shadow:0 2px 7px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.55);color:#2b1b0d;cursor:pointer;font-weight:700;line-height:1;"
      >
        <span class="add2e-carac-score" style="font-size:1.35rem;line-height:1;">${v}</span>
        <span class="assigned-label" style="font-size:.72rem;min-height:.85rem;color:#5b3514;font-weight:800;letter-spacing:.04em;">—</span>
      </button>`).join("");

    return `
      <style>
        .add2e-carac-popup .add2e-carac-value:hover { filter: brightness(1.08); transform: translateY(-1px); }
        .add2e-carac-popup .add2e-carac-value.selected { outline: 3px solid #f0d27a !important; box-shadow: 0 0 0 2px #6b3ca0, 0 0 16px rgba(240,210,122,.55) !important; }
        .add2e-carac-popup .add2e-carac-value.used { opacity: .65 !important; background: linear-gradient(180deg,#7c766e 0%,#4d4945 100%) !important; color: #f4eadc !important; cursor: not-allowed !important; }
        .add2e-carac-popup .add2e-carac-value.used .assigned-label { color: #f0d27a !important; }
        .add2e-carac-popup .carac-class-list li { margin: 0 0 4px 0; }
        .add2e-carac-popup .carac-class-list b { color: #b879ff; }
        .add2e-carac-popup .carac-class-list .carac-ok { color: #42d681; font-weight: 800; }
      </style>
      <div class="add2e-carac-popup" data-add2e-carac-roller="${this._uid}" style="box-sizing:border-box;width:100%;padding:12px 14px 4px 14px;color:#f1e8dc;background:radial-gradient(circle at 85% 20%,rgba(151,87,255,.16),transparent 35%),linear-gradient(180deg,rgba(34,27,42,.96),rgba(17,14,22,.96));border-radius:8px;">
        <div style="border:1px solid rgba(214,176,116,.35);border-radius:10px;background:rgba(0,0,0,.18);padding:10px 12px;margin-bottom:12px;box-shadow:inset 0 0 16px rgba(0,0,0,.2);">
          <div style="font-size:1.02rem;font-weight:800;color:#f5dfae;margin-bottom:4px;">Affectation des caractéristiques</div>
          <div style="font-size:.88rem;line-height:1.35;color:#d8c9b4;">
            Cliquez sur une valeur, puis sur une caractéristique de la fiche. Cliquez sur une caractéristique déjà affectée pour la libérer.
          </div>
        </div>

        <div class="add2e-carac-values" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center;margin:0 0 14px 0;">
          ${valueCards}
        </div>

        <div id="classes-suggestions" style="margin:0 0 12px 0;padding:10px 12px;border:1px solid rgba(214,176,116,.28);border-radius:10px;background:rgba(0,0,0,.20);max-height:260px;overflow:auto;"></div>

        <div class="add2e-carac-apply" style="display:flex;justify-content:center;margin-top:10px;">
          <button type="button" class="apply-caracs-btn" style="min-width:170px;padding:8px 18px;border:1px solid #d8b16c;border-radius:8px;background:linear-gradient(180deg,#8e44ad 0%,#5d2c7d 100%);color:#fff7e8;font-weight:800;letter-spacing:.02em;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35);">Valider</button>
        </div>
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
    let html = '<div style="margin:0 0 8px 0;font-size:1rem;color:#f5dfae;font-weight:800;">Classes accessibles et valeur à placer :</div>';
    html += '<ul class="carac-class-list" style="padding-left:1.15em;margin:0;line-height:1.45;font-size:.96rem;">';

    for (const cls of classes) {
      const requis = Object.entries(cls.system?.caracs_min || {});
      const pool = [...values];
      const placements = [];
      let ok = true;

      for (const [carac, minRaw] of requis) {
        const min = Number(minRaw) || 0;
        const idx = pool.findIndex(val => val + add2eCaracRaceBonus(this.actor, carac) >= min);
        if (idx === -1) { ok = false; break; }
        placements.push(`<b>${ADD2E_CARAC_SHORT[carac] || add2eCaracEscapeHtml(carac)}</b> <span class="carac-ok">${pool[idx]}</span>`);
        pool.splice(idx, 1);
      }

      if (ok) html += `<li><b>${add2eCaracEscapeHtml(cls.name)}</b>${placements.length ? ` : ${placements.join(', ')}` : ''}</li>`;
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
