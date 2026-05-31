// scripts/add2e-attack/04f-attack-roll-dialog.mjs
// ADD2E — Dialogue d'attaque.
// Compatible Foundry V13/V14/V15 : DialogV2 prioritaire, fallback Dialog conservé.

function add2eAttackFormAdapter(form) {
  return {
    find(selector) {
      const el = form?.querySelector?.(selector) ?? null;
      return {
        val: () => el?.value ?? "",
        is: (expr) => expr === ":checked" ? !!el?.checked : !!el?.matches?.(expr)
      };
    }
  };
}

function add2eAttackEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eAttackImage(entity, fallback = "icons/svg/mystery-man.svg") {
  return add2eAttackEscapeHtml(entity?.img ?? entity?.texture?.src ?? entity?.document?.texture?.src ?? fallback);
}

export async function add2eAttackOpenDialogV2({ title, content, width, classes, defaultAction, onOk }) {
  const DialogV2 = foundry.applications?.api?.DialogV2;

  if (DialogV2?.wait) {
    return await DialogV2.wait({
      window: { title },
      classes: classes ?? [],
      position: { width: width ?? 720 },
      content,
      buttons: [
        {
          action: "ok",
          label: "Lancer l'attaque",
          default: defaultAction === "ok",
          callback: async (event, button, dialog) => {
            const form = button?.form ?? dialog?.element?.querySelector?.("form") ?? document.querySelector("form.add2e-attack-form");
            return await onOk(add2eAttackFormAdapter(form));
          }
        },
        {
          action: "cancel",
          label: "Annuler",
          callback: () => false
        }
      ],
      default: defaultAction ?? "ok",
      rejectClose: false
    });
  }

  return await new Promise((resolve) => {
    new Dialog({
      title,
      content,
      buttons: {
        ok: {
          label: "Lancer l'attaque",
          callback: async (dlgHtml) => resolve(await onOk(dlgHtml))
        },
        cancel: { label: "Annuler", callback: () => resolve(false) }
      },
      default: defaultAction ?? "ok"
    }, {
      width: width ?? 720,
      classes: classes ?? []
    }).render(true);
  });
}

export function add2eBuildAttackDialogContent({
  actor,
  arme,
  cible,
  attackDistanceLabel,
  backArcInfo,
  positionAttackAdjustment,
  specialOptionsVisible,
  canUseBackstab,
  backstabInfo,
  canUseAssassination,
  assassinationInfo
}) {
  const attackerName = add2eAttackEscapeHtml(actor?.name ?? "Attaquant");
  const targetName = add2eAttackEscapeHtml(cible?.name ?? "Cible");
  const weaponName = add2eAttackEscapeHtml(arme?.name ?? "Arme");
  const distanceLabel = add2eAttackEscapeHtml(attackDistanceLabel ?? "Contact");
  const backLabel = add2eAttackEscapeHtml(backArcInfo?.label ?? "Face");
  const attackerImg = add2eAttackImage(actor);
  const targetImg = add2eAttackImage(cible);
  const weaponImg = add2eAttackImage(arme, "icons/svg/sword.svg");

  return `
        <style>
          .add2e-attack-form {
            --a2e-gold: #d7a537;
            --a2e-gold-dark: #8a5a12;
            --a2e-brown: #3b2410;
            --a2e-ink: #21170b;
            --a2e-soft: #fff5d8;
            --a2e-paper: #fff9e8;
            --a2e-red: #8f2d22;
            --a2e-green: #1f6f3c;
            display: grid;
            gap: 12px;
            color: var(--a2e-ink);
            padding: 2px;
          }
          .add2e-attack-banner {
            position: relative;
            overflow: hidden;
            border-radius: 16px;
            border: 1px solid rgba(215, 165, 55, .75);
            background: linear-gradient(135deg, #2b1608 0%, #6f4211 48%, #d9a33a 100%);
            color: #fff8e6;
            padding: 14px 16px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, .22);
          }
          .add2e-attack-banner::after {
            content: "";
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at top right, rgba(255, 255, 255, .26), transparent 34%);
            pointer-events: none;
          }
          .add2e-attack-banner-title {
            position: relative;
            z-index: 1;
            font-size: 1.18rem;
            font-weight: 950;
            letter-spacing: .03em;
            text-transform: uppercase;
          }
          .add2e-attack-banner-subtitle {
            position: relative;
            z-index: 1;
            margin-top: 3px;
            font-size: .86rem;
            font-weight: 800;
            color: #ffe7a6;
          }
          .add2e-duel-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 52px minmax(0, 1fr);
            gap: 10px;
            align-items: stretch;
          }
          .add2e-duel-card {
            display: grid;
            grid-template-columns: 70px minmax(0, 1fr);
            gap: 12px;
            min-height: 104px;
            border: 1px solid rgba(215, 165, 55, .7);
            border-radius: 15px;
            background: linear-gradient(180deg, #fffdf5 0%, #fff0c4 100%);
            padding: 10px;
            box-shadow: 0 5px 14px rgba(80, 48, 10, .14);
          }
          .add2e-duel-card.target {
            background: linear-gradient(180deg, #fffdf5 0%, #ffe5d9 100%);
            border-color: rgba(143, 45, 34, .38);
          }
          .add2e-portrait-wrap {
            position: relative;
            width: 70px;
            height: 84px;
            border-radius: 13px;
            overflow: hidden;
            background: #26180c;
            border: 2px solid rgba(255, 255, 255, .9);
            box-shadow: 0 3px 10px rgba(0, 0, 0, .25);
          }
          .add2e-portrait-wrap img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }
          .add2e-duel-role {
            font-size: .74rem;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: .04em;
            color: var(--a2e-gold-dark);
          }
          .add2e-duel-card.target .add2e-duel-role { color: var(--a2e-red); }
          .add2e-duel-name {
            margin-top: 2px;
            font-size: 1.22rem;
            line-height: 1.05;
            font-weight: 950;
            color: var(--a2e-brown);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .add2e-weapon-line {
            display: flex;
            align-items: center;
            gap: 7px;
            margin-top: 9px;
          }
          .add2e-weapon-icon {
            width: 28px;
            height: 28px;
            border-radius: 8px;
            object-fit: cover;
            border: 1px solid rgba(138, 90, 18, .35);
            background: #fff8e6;
          }
          .add2e-pill-row {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 9px;
          }
          .add2e-attack-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 9px;
            border: 1px solid rgba(215, 165, 55, .85);
            border-radius: 999px;
            background: #fff8de;
            font-size: .82rem;
            font-weight: 900;
            color: #6b4511;
            line-height: 1;
          }
          .add2e-attack-pill.danger {
            border-color: rgba(143, 45, 34, .35);
            background: #fff0e8;
            color: var(--a2e-red);
          }
          .add2e-attack-arrow {
            align-self: center;
            justify-self: center;
            width: 46px;
            height: 46px;
            display: grid;
            place-items: center;
            border-radius: 999px;
            background: linear-gradient(135deg, #3b2410, #9a6318);
            color: #fff5d8;
            font-size: 1.7rem;
            font-weight: 950;
            box-shadow: 0 5px 14px rgba(0, 0, 0, .22);
          }
          .add2e-section {
            border: 1px solid rgba(215, 165, 55, .65);
            border-radius: 14px;
            background: linear-gradient(180deg, #fffdf6 0%, #fff3cc 100%);
            padding: 11px 12px;
            box-shadow: 0 3px 10px rgba(80, 48, 10, .09);
          }
          .add2e-field-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 160px;
            gap: 12px;
            align-items: center;
          }
          .add2e-field-main label, .add2e-check-title {
            font-weight: 950;
            color: var(--a2e-brown);
          }
          .add2e-field-help {
            margin-top: 3px;
            font-size: .8rem;
            color: #7a6227;
            font-weight: 750;
            line-height: 1.3;
          }
          .add2e-number-input, .add2e-select-input {
            width: 100%;
            border: 1px solid rgba(215, 165, 55, .85);
            border-radius: 11px;
            background: #fffaf0;
            padding: 8px 10px;
            font-weight: 950;
            text-align: center;
            color: var(--a2e-ink);
            box-shadow: inset 0 1px 4px rgba(80, 48, 10, .12);
          }
          .add2e-select-input { text-align: left; }
          .add2e-position-result {
            margin-top: 8px;
            display: flex;
            justify-content: space-between;
            gap: 10px;
            color: #5d3d0d;
            font-size: .86rem;
            font-weight: 850;
          }
          .add2e-special-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .add2e-check {
            display: grid;
            grid-template-columns: 26px minmax(0, 1fr);
            gap: 10px;
            align-items: center;
            border: 1px solid rgba(215, 165, 55, .7);
            border-radius: 14px;
            background: linear-gradient(180deg, #fffdf6 0%, #fff0d7 100%);
            padding: 11px 12px;
            cursor: pointer;
          }
          .add2e-check:hover {
            border-color: var(--a2e-gold-dark);
            box-shadow: 0 4px 12px rgba(80, 48, 10, .15);
          }
          .add2e-check input[type="checkbox"] {
            width: 20px;
            height: 20px;
            accent-color: var(--a2e-red);
          }
          .add2e-check-meta {
            margin-top: 2px;
            font-size: .82rem;
            color: #6b5a2a;
            font-weight: 800;
          }
          @media (max-width: 680px) {
            .add2e-duel-row { grid-template-columns: 1fr; }
            .add2e-attack-arrow { transform: rotate(90deg); }
            .add2e-field-row { grid-template-columns: 1fr; }
            .add2e-special-grid { grid-template-columns: 1fr; }
          }
        </style>

        <form class="add2e-attack-form">
          <div class="add2e-attack-banner">
            <div class="add2e-attack-banner-title">Préparation de l’attaque</div>
            <div class="add2e-attack-banner-subtitle">Choisis les bonus, la position réelle et les options spéciales avant de lancer le jet.</div>
          </div>

          <div class="add2e-duel-row">
            <div class="add2e-duel-card attacker">
              <div class="add2e-portrait-wrap"><img src="${attackerImg}" alt=""></div>
              <div>
                <div class="add2e-duel-role">Attaquant</div>
                <div class="add2e-duel-name" title="${attackerName}">${attackerName}</div>
                <div class="add2e-weapon-line">
                  <img class="add2e-weapon-icon" src="${weaponImg}" alt="">
                  <span class="add2e-attack-pill">${weaponName}</span>
                </div>
              </div>
            </div>

            <div class="add2e-attack-arrow">→</div>

            <div class="add2e-duel-card target">
              <div class="add2e-portrait-wrap"><img src="${targetImg}" alt=""></div>
              <div>
                <div class="add2e-duel-role">Cible</div>
                <div class="add2e-duel-name" title="${targetName}">${targetName}</div>
                <div class="add2e-pill-row">
                  <span class="add2e-attack-pill">${distanceLabel}</span>
                  <span class="add2e-attack-pill danger">Position : Face</span>
                  <span class="add2e-attack-pill" title="Diagnostic uniquement">Auto : ${backLabel}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="add2e-section">
            <div class="add2e-field-row">
              <div class="add2e-field-main">
                <label for="add2e-bonus-attaque">Modificateur au toucher</label>
                <div class="add2e-field-help">Bonus ou malus manuel appliqué au jet d’attaque.</div>
              </div>
              <input id="add2e-bonus-attaque" class="add2e-number-input" type="number" value="0" step="1">
            </div>
          </div>

          <div class="add2e-section">
            <div class="add2e-field-row">
              <div class="add2e-field-main">
                <label for="add2e-position-zone">Position réelle</label>
                <div class="add2e-field-help">Par défaut : Face. L’auto-détection reste indicative pour éviter les faux dos dus à l’image du token.</div>
              </div>
              <select id="add2e-position-zone" class="add2e-select-input">
                <option value="front" selected>Face</option>
                <option value="flank">Flanc</option>
                <option value="rear-flank">Flanc arrière</option>
                <option value="rear">Dos</option>
                <option value="auto">Auto détecté (${backLabel})</option>
              </select>
            </div>
            ${positionAttackAdjustment.details.length ? `
            <div class="add2e-position-result">
              <span>Effet de position</span>
              <span>${positionAttackAdjustment.details.map(add2eAttackEscapeHtml).join("<br>")}</span>
            </div>
            ` : ""}
          </div>

          ${specialOptionsVisible ? `
          <div class="add2e-special-grid">
            ${canUseBackstab ? `
            <label class="add2e-check">
              <input type="checkbox" id="add2e-backstab">
              <span><span class="add2e-check-title">Attaque sournoise</span><span class="add2e-check-meta">+4 toucher · dégâts ×${add2eAttackEscapeHtml(backstabInfo?.multiplier ?? "")}</span></span>
            </label>` : ""}
            ${canUseAssassination ? `
            <label class="add2e-check">
              <input type="checkbox" id="add2e-assassinat-confirm">
              <span><span class="add2e-check-title">Assassinat</span><span class="add2e-check-meta">${add2eAttackEscapeHtml(assassinationInfo?.score ?? "0")}% si l’attaque touche</span></span>
            </label>` : ""}
          </div>
          ${canUseAssassination ? `
          <div class="add2e-section">
            <div class="add2e-field-row">
              <div class="add2e-field-main">
                <label for="add2e-assassinat-mod">Modificateur assassinat</label>
                <div class="add2e-field-help">Ajustement manuel du pourcentage d’assassinat.</div>
              </div>
              <input id="add2e-assassinat-mod" class="add2e-number-input" type="number" value="0" step="1">
            </div>
          </div>` : ""}
          ` : ""}
        </form>
      `;
}
