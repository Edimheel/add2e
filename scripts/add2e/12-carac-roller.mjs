// ========== CLASSE ROLLER CLICK-TO-ASSIGN ==========
class Add2eCaracRoller {
  constructor(sheet) {
    this.sheet = sheet;
    this.values = [];
    this.used = {};
    this.assigned = {};
    this.selectedIdx = null;
    this._dlgHtml = null;
    this.dialogRef = null;
    // Save the old base values for rollback
    this._oldValues = {};
    for (const c of CARACS) {
      this._oldValues[c] = sheet.actor.system[`${c}_base`];
    }
    this.render();
  }
  static rollCarac() {
    let rolls = [];
    for (let i = 0; i < 4; i++) rolls.push(Math.floor(Math.random() * 6) + 1);
    rolls.sort((a, b) => b - a);
    return rolls[0] + rolls[1] + rolls[2];
  }

  async render() {
  this.values = [];
  this.used = {};
  this.assigned = {};
  this.selectedIdx = null;
  let rolls = [];
  for (let i = 0; i < 7; i++) rolls.push(Add2eCaracRoller.rollCarac());
  rolls.sort((a, b) => b - a);
  this.values = rolls.slice(0, 6);

  // Génère le HTML du popup, mais laisse la zone guide vide (sera remplie dynamiquement)
  let html = `
    <style>
      .add2e-carac-popup { font-family: var(--font-primary); }
      .add2e-carac-values { display: flex; gap: 0.7em; justify-content: center; margin-bottom: 1em; }
      .add2e-carac-value { background: #e8d4b0; border-radius: 8px; padding: 0.5em 1em; font-size:1.3em; font-weight:bold; cursor: pointer; box-shadow: 0 2px 6px #0001; text-align:center; min-width:2.9em;}
      .add2e-carac-value.used { opacity: 0.55; background: #bbb; cursor: not-allowed;}
      .add2e-carac-value.selected { outline: 3px solid #8e44ad; background: #ffeaa7;}
      .add2e-carac-help { font-size: 0.97em; color: #88704b; text-align: center; margin-bottom: 1em;}
      .add2e-carac-apply { text-align: center; margin-top: 1em; }
      .add2e-carac-apply button { padding: 0.5em 1.3em; font-size: 1em; background: #8e44ad; color: #fff; border: none; border-radius: 6px; cursor: pointer;}
      .assigned-label { font-size: 0.85em; color: #164a1b; margin-top: 0.3em; display: block; font-weight: 500;}
      ul.class-short {margin:0.5em 0 0.2em 1em;padding-left:0.6em;}
      ul.class-short li {margin-bottom:0.1em;}
      .class-short .c {font-weight:bold;color:#6a3c99;}
      .class-short .carac {font-weight:bold;color:#194;}
    </style>
    <div class="add2e-carac-popup">
      <div class="add2e-carac-help">
        Cliquez sur une valeur, puis sur une caractéristique à assigner.<br>
        <b>Astuce :</b> Cliquez sur une carac déjà affectée pour la remplacer.
      </div>
      <div class="add2e-carac-values">
        ${this.values.map((v, i) => {
          let caracAffectee = Object.entries(this.assigned).find(([_, idx]) => idx === i);
          let short = caracAffectee ? caracAffectee[0].slice(0,3).toUpperCase() : "—";
          return `
            <div class="add2e-carac-value${this.used[i] ? ' used' : ''}" data-idx="${i}">
              ${v}
              <div class="assigned-label">${short}</div>
            </div>`;
        }).join("")}
      </div>
      <div id="classes-suggestions" style="margin:0.6em 0 0.1em 0.1em;"></div>
      <div class="add2e-carac-apply">
        <button class="apply-caracs-btn">Valider</button>
      </div>
    </div>
  `;

  let dialogRef = new Dialog({
    title: "Tirage des caractéristiques",
    content: html,
    render: dlgHtml => {
      this._dlgHtml = dlgHtml;
      this._setupClickHandlers();
      if (this.sheet) this.sheet._enableCaracClickAssign(this);
      this._updateCaracDisplay();
dlgHtml.find('.apply-caracs-btn').on('click', async ev => {
  const caracList = CARACS;
  if (!caracList.every(c => this.assigned[c] !== undefined)) {
    ui.notifications.warn("Toutes les caractéristiques doivent être affectées !");
    return;
  }

  // 1. Prépare les updates ET vérifie s’il y a des caracs > 18
  let updates = {};
  let overflows = [];
  for (let carac of caracList) {
    let idx = this.assigned[carac];
    if (typeof idx !== "undefined") {
      const base = this.values[idx];
      const bonusRacial = this.sheet.actor.system[`${carac}_race`] || 0;
      const total = base + bonusRacial;
      updates[`system.${carac}_base`] = base;
      if (total > 18) {
        overflows.push({
          carac,
          base,
          bonusRacial,
          total
        });
      }
    }
  }

  // 2. S’il y a des débordements, on confirme
  if (overflows.length) {
    let caracsTxt = overflows.map(o =>
      `<li><b>${CARAC_SHORT[o.carac]}</b> : base ${o.base} + bonus racial ${o.bonusRacial} = <span style="color:#e74c3c;font-weight:bold;">${o.total}</span> <b>→ 18</b></li>`
    ).join("");
    const confirmed = await Dialog.confirm({
      title: "Caractéristique supérieure à 18",
      content: `<p>Une ou plusieurs caractéristiques dépassent 18 après bonus racial.<br>
      Elles seront ramenées à 18 :</p><ul>${caracsTxt}</ul>
      <p>Confirmez-vous l’assignation ?</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: true
    });
    if (!confirmed) return;
    // Applique le cap à 18
    for (let o of overflows) {
      // On baisse la base pour que base + bonus == 18
      let cappedBase = 18 - o.bonusRacial;
      updates[`system.${o.carac}_base`] = Math.max(3, cappedBase); // Jamais <3
    }
  }

  // 3. Applique les updates
  await this.sheet.actor.update(updates);
  await this.sheet.actor.setFlag("add2e", "base_caracs", updates);
  if (typeof this.sheet.autoSetCaracAjustements === "function") {
    await this.sheet.autoSetCaracAjustements();
  }
  await this.sheet.render(false);
  ui.notifications.info("Affectation terminée !");
  dlgHtml.closest('.window-app').remove();
});


    },
    close: () => { this._restoreOldCaracs(); },
    buttons: { cancel: { label: "Annuler" } },
    default: "cancel"
  }, { width: 480, height: "auto" });

  dialogRef.render(true);
  this.dialogRef = dialogRef;

  // Affichage synthétique des classes accessibles (remplit la div juste après affichage)
  this.classesSynthese().then(synth => {
    if (this._dlgHtml) this._dlgHtml.find('#classes-suggestions').html(synth);
  });

  // Force la popup à l’avant-plan
  setTimeout(() => {
    const dialogEl = document.querySelector('.window-app.dialog');
    if (dialogEl && dialogEl.querySelector('.add2e-carac-popup')) {
      dialogEl.style.zIndex = 9999;
    }
  }, 60);
}

  _setupClickHandlers() {
    this._dlgHtml.find('.add2e-carac-value').off('click').on('click', ev => {
      const idx = Number(ev.currentTarget.dataset.idx);
      if (this.used[idx]) return;
      this.selectedIdx = idx;
      this._dlgHtml.find('.add2e-carac-value').removeClass('selected');
      $(ev.currentTarget).addClass('selected');
      $('.carac-drop-target').addClass('assignable');
    });
  }

  // Affichage synthétique des classes accessibles selon la répartition possible des valeurs
async classesSynthese() {
  let classes = game.items.filter(i => i.type === "classe");

  // Si aucune classe dans le monde, charge depuis le compendium
  if (!classes.length) {
    const pack = game.packs.get("add2e.classes");
    if (!pack) {
      console.error("[ADD2e] Compendium 'add2e.classes' introuvable !");
      return "<em>Compendium des classes introuvable.</em>";
    }
    const content = await pack.getDocuments();
    classes = content.filter(i => i.type === "classe");
  }

  if (!classes.length) return "<em>Aucune classe trouvée</em>";

  const values = [...this.values].sort((a, b) => b - a); // scores décroissants
  const caracShort = { force:'FOR', dexterite:'DEX', constitution:'CON', intelligence:'INT', sagesse:'SAG', charisme:'CHA' };
  let html = '<div style="margin:0.6em 0 0.2em 0.1em;font-size:1.05em;"><b>Classes accessibles et valeur à placer :</b></div>';
  html += '<ul style="padding-left:1.1em;line-height:1.5em;font-size:1.05em;">';

  for (const cls of classes) {
    const caracsMin = cls.system.caracs_min || {};
    const requis = Object.entries(caracsMin);

    let valeursDisponibles = [...values];
    let match = true;
    let caracPlacements = [];

    for (let [carac, min] of requis) {
      const idx = valeursDisponibles.findIndex(val => val >= min);
      if (idx === -1) {
        match = false;
        break;
      }
      const val = valeursDisponibles[idx];
      caracPlacements.push(`<b>${caracShort[carac] || carac}</b> <span style="color:#219150;font-weight:bold">${val}</span>`);
      valeursDisponibles.splice(idx, 1); // empêche la réutilisation
    }

    if (match) {
      html += `<li><b style="color:#6a3c99">${cls.name}</b> : ${caracPlacements.join(', ')}</li>`;
    }
  }

  html += '</ul>';
  return html;
}



assignToCarac(caracName) {
  if (this.selectedIdx === null) return;
  let idx = this.selectedIdx;
  // Unassign any carac that was already using this value
  if (Object.values(this.assigned).includes(idx)) {
    const prevCarac = Object.keys(this.assigned).find(cn => this.assigned[cn] === idx);
    if (prevCarac) this.unassignCarac(prevCarac);
  }
  // Unassign previous value from caracName
  if (this.assigned[caracName] !== undefined) {
    const prevIdx = this.assigned[caracName];
    delete this.used[prevIdx];
    this._dlgHtml.find(`.add2e-carac-value[data-idx=${prevIdx}]`).removeClass('used');
  }
  this.assigned[caracName] = idx;
  this.used[idx] = caracName;
  this._dlgHtml.find(`.add2e-carac-value[data-idx=${idx}]`).addClass('used');
  this.selectedIdx = null;
  this._dlgHtml.find('.add2e-carac-value').removeClass('selected');
  $('.carac-drop-target').removeClass('assignable');
  this._updateCaracDisplay();
  this._updateAssignLabels();
  if (this._dlgHtml) {
    // Correction ici : appel direct, sans surcouche de texte
    this.classesSynthese().then(html => {
      this._dlgHtml.find('#classes-suggestions').html(html);
    });
  }
  this._setupClickHandlers();
}

unassignCarac(caracName) {
  if (this.assigned[caracName] !== undefined) {
    const idx = this.assigned[caracName];
    delete this.assigned[caracName];
    delete this.used[idx];
    this._dlgHtml.find(`.add2e-carac-value[data-idx=${idx}]`).removeClass('used');
    this._updateCaracDisplay();
    this._updateAssignLabels();
    if (this._dlgHtml) {
      // Correction ici : appel direct, sans surcouche de texte
      this.classesSynthese().then(html => {
        this._dlgHtml.find('#classes-suggestions').html(html);
      });
    }
    this._setupClickHandlers();
  }
}

_updateCaracDisplay() {
  for (const c of CARACS) {
    const el = this.sheet.element.find(`.carac-drop-target[data-carac="${c}"]`);
    const bonusRacial = this.sheet.actor.system[`${c}_race`] || 0;
    let html = '';
    if (this.assigned[c] !== undefined) {
      const base = this.values[this.assigned[c]];
      const total = base + bonusRacial;
      html = `<span style="font-size:1.22em;font-weight:bold;">${total}</span>
        <div style="font-size:0.40em;line-height:1.2em;color:#777;margin-top:1px;">
          <span style="color:#555;">base : </span>${base}<br>
          <span style="color:#555;">bonus : </span><span style="color:${bonusRacial>0?'#1abc9c':'#e74c3c'};">
            ${bonusRacial>0?'+':''}${bonusRacial}
          </span>
        </div>`;
      el.addClass('carac-assigned').html(html);
    } else {
      const base = this._oldValues[c];
      const total = base + bonusRacial;
      html = `<span style="font-size:1.22em;font-weight:bold;">${total}</span>
        <div style="font-size:0.40em;line-height:1.2em;color:#777;margin-top:1px;">
          <span style="color:#555;">base : </span>${base}<br>
          <span style="color:#555;">bonus : </span><span style="color:${bonusRacial>0?'#1abc9c':'#e74c3c'};">
            ${bonusRacial>0?'+':''}${bonusRacial}
          </span>
        </div>`;
      el.removeClass('carac-assigned').html(html);
    }
  }
}


_updateAssignLabels() {
  for (let i = 0; i < this.values.length; i++) {
    let carac = null;
    for (let c of CARACS) {
      if (this.assigned[c] === i) carac = c;
    }
    let txt = carac ? carac.slice(0,3).toUpperCase() : "—";
    let el = this._dlgHtml.find(`.add2e-carac-value[data-idx=${i}] .assigned-label`);
    if (el.length) el.html(txt);
  }
}
async suggestClassesAndPlacements() {
  let classes = game.items.filter(i => i.type === "classe");

  if (!classes.length) {
    const pack = game.packs.get("add2e.classes"); // Vérifie bien l'ID exact
    if (!pack) {
      console.error("[ADD2e] Compendium 'add2e.classes' introuvable !");
      return "<em>Compendium des classes introuvable.</em>";
    }
    const content = await pack.getDocuments();
    classes = content.filter(i => i.type === "classe");
  }
  const caracs = CARACS.reduce((acc, c) => {
    const base = this.assigned[c] !== undefined ? this.values[this.assigned[c]] : 0;
    acc[c] = base + (this.sheet.actor.system[`${c}_race`] || 0);
    return acc;
  }, {});
  // Valeurs non attribuées
  const nonAttribuees = this.values.filter((v, i) => !Object.values(this.assigned).includes(i));
  let suggestions = [];
  for (const cls of classes) {
    const caracsMin = cls.system.caracs_min || {};
    let preReqOk = true, preReqManquantes = [];
    for (let [carac, min] of Object.entries(caracsMin)) {
      const current = caracs[carac] || 0;
      if (current >= min) continue;
      const possible = nonAttribuees.some(val => val >= min);
      if (!possible) preReqOk = false;
      preReqManquantes.push({carac, min, possible});
    }
    // Texte selon situation
    if (Object.keys(caracsMin).length === 0) {
      suggestions.push(`<li><b>${cls.name}</b> : <span style="color:green;">✔️ Pas de prérequis</span></li>`);
    } else if (preReqOk && preReqManquantes.length === 0) {
      suggestions.push(`<li><b style="color:green;">${cls.name}</b> : <span style="color:green;">✔️ Tous les prérequis remplis</span></li>`);
    } else if (preReqOk) {
      // Liste les prérequis à placer
      let txt = preReqManquantes.map(pr =>
        pr.possible
          ? `Placez au moins <b>${pr.min}</b> en <b>${pr.carac.toUpperCase()}</b>`
          : `<span style="color:red">Impossible d’avoir ${pr.min} en ${pr.carac.toUpperCase()}</span>`
      ).join(", ");
      suggestions.push(`<li><b>${cls.name}</b> : ${txt}</li>`);
    } else {
      suggestions.push(`<li style="color:#aaa;"><del>${cls.name}</del> : <span style="color:#aaa;">Prérequis inatteignables avec ce tirage</span></li>`);
    }
  }
  return `<ul style="margin-left:1em;">${suggestions.join("\n")}</ul>`;
}

  _restoreOldCaracs() {
    // Quand on annule ou ferme, on restaure les valeurs initiales
    for (const c of CARACS) {
      this.sheet.actor.update({ [`system.${c}_base`]: this._oldValues[c] });
      // Restaure l'affichage sur la fiche
      this.sheet.element.find(`.carac-drop-target[data-carac="${c}"]`)
        .removeClass('carac-assigned')
        .text(this._oldValues[c]);
    }
  }
}
window.Add2eCaracRoller = Add2eCaracRoller;

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.Add2eCaracRoller = Add2eCaracRoller; } catch (_e) {}
