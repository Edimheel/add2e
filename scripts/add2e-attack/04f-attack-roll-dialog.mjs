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
      position: { width: width ?? 680 },
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
      width: width ?? 680,
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
  const backstabMultiplier = add2eAttackEscapeHtml(backstabInfo?.multiplier ?? "");
  const assassinationScore = add2eAttackEscapeHtml(assassinationInfo?.score ?? "0");

  return `
        <style>
          form.add2e-attack-form {
            --a2e-ink: #24170a;
            --a2e-brown: #5a3510;
            --a2e-gold: #c99222;
            --a2e-line: #d5b15a;
            --a2e-paper: #fff8e4;
            --a2e-panel: #fffdf4;
            --a2e-red: #8f2d22;
            display: grid;
            gap: 10px;
            color: var(--a2e-ink);
            padding: 2px;
          }
          .add2e-attack-vs {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 40px minmax(0, 1fr);
            gap: 10px;
            align-items: center;
          }
          .add2e-attack-card {
            display: grid;
            grid-template-columns: 64px minmax(0, 1fr);
            gap: 10px;
            align-items: center;
            min-height: 86px;
            padding: 9px;
            border: 1px solid var(--a2e-line);
            border-radius: 12px;
            background: linear-gradient(180deg, #fffdf5, #fff0c8);
            box-shadow: 0 2px 8px rgba(70, 40, 10, .12);
          }
          .add2e-attack-card.target {
            background: linear-gradient(180deg, #fffdf5, #ffe8dc);
            border-color: #d69a76;
          }
          .add2e-attack-role {
            font-size: .72rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: .04em;
            color: var(--a2e-brown);
          }
          .add2e-attack-card.target .add2e-attack-role { color: var(--a2e-red); }
          .add2e-attack-name {
            margin-top: 1px;
            font-size: 1.12rem;
            line-height: 1.05;
            font-weight: 900;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
          }
          .add2e-attack-pills {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin-top: 6px;
          }
          .add2e-attack-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            max-width: 100%;
            padding: 3px 8px;
            border: 1px solid #d1a13d;
            border-radius: 999px;
            background: #fff7da;
            color: #68420e;
            font-size: .78rem;
            font-weight: 850;
            line-height: 1.1;
          }
          .add2e-attack-pill.red {
            border-color: #d69a76;
            background: #fff1e9;
            color: var(--a2e-red);
          }
          .add2e-attack-arrow {
            width: 36px;
            height: 36px;
            display: grid;
            place-items: center;
            border-radius: 999px;
            background: #6b4312;
            color: #fff7dc;
            font-size: 1.3rem;
            font-weight: 900;
          }
          .add2e-attack-section {
            padding: 9px 10px;
            border: 1px solid var(--a2e-line);
            border-radius: 12px;
            background: var(--a2e-panel);
          }
          .add2e-attack-field {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 130px;
            gap: 10px;
            align-items: center;
          }
          .add2e-attack-label {
            font-weight: 900;
            color: var(--a2e-brown);
          }
          .add2e-attack-help {
            margin-top: 2px;
            font-size: .78rem;
            line-height: 1.25;
            color: #71581d;
            font-weight: 700;
          }
          .add2e-attack-form input[type="number"].add2e-attack-input,
          .add2e-attack-form select.add2e-attack-select {
            width: 100%;
            min-height: 34px;
            border: 1px solid var(--a2e-line);
            border-radius: 8px;
            background: #fffaf0 !important;
            color: #24170a !important;
            padding: 5px 8px;
            font-weight: 900;
          }
          .add2e-attack-form input[type="number"].add2e-attack-input { text-align: center; }
          .add2e-special-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .add2e-check {
            display: grid;
            grid-template-columns: 24px minmax(0, 1fr);
            gap: 9px;
            align-items: center;
            padding: 9px 10px;
            border: 1px solid var(--a2e-line);
            border-radius: 12px;
            background: #fffdf4;
            cursor: pointer;
          }
          .add2e-check input[type="checkbox"] {
            width: 18px;
            height: 18px;
            accent-color: var(--a2e-red);
          }
          .add2e-check-title { font-weight: 900; color: var(--a2e-brown); }
          .add2e-check-meta { display: block; margin-top: 1px; font-size: .78rem; color: #71581d; font-weight: 800; }
          .add2e-position-result {
            margin-top: 7px;
            display: flex;
            justify-content: space-between;
            gap: 10px;
            color: #5d3d0d;
            font-size: .82rem;
            font-weight: 800;
          }
          @media (max-width: 640px) {
            .add2e-attack-vs { grid-template-columns: 1fr; }
            .add2e-attack-arrow { transform: rotate(90deg); justify-self: center; }
            .add2e-attack-field, .add2e-special-grid { grid-template-columns: 1fr; }
          }
        </style>

        <form class="add2e-attack-form">
          <div class="add2e-attack-vs">
            <div class="add2e-attack-card attacker">
              <img src="${attackerImg}" alt="" style="width:64px !important;height:64px !important;max-width:64px !important;max-height:64px !important;min-width:64px !important;min-height:64px !important;object-fit:cover !important;display:block !important;border-radius:10px !important;border:2px solid #fff7dc !important;background:#2a1908 !important;box-shadow:0 2px 7px rgba(0,0,0,.25) !important;">
              <div>
                <div class="add2e-attack-role">Attaquant</div>
                <div class="add2e-attack-name" title="${attackerName}">${attackerName}</div>
                <div class="add2e-attack-pills">
                  <img src="${weaponImg}" alt="" style="width:22px !important;height:22px !important;max-width:22px !important;max-height:22px !important;object-fit:cover !important;display:inline-block !important;border-radius:6px !important;vertical-align:middle !important;">
                  <span class="add2e-attack-pill">${weaponName}</span>
                </div>
              </div>
            </div>

            <div class="add2e-attack-arrow">→</div>

            <div class="add2e-attack-card target">
              <img src="${targetImg}" alt="" style="width:64px !important;height:64px !important;max-width:64px !important;max-height:64px !important;min-width:64px !important;min-height:64px !important;object-fit:cover !important;display:block !important;border-radius:10px !important;border:2px solid #fff7dc !important;background:#2a1908 !important;box-shadow:0 2px 7px rgba(0,0,0,.25) !important;">
              <div>
                <div class="add2e-attack-role">Cible</div>
                <div class="add2e-attack-name" title="${targetName}">${targetName}</div>
                <div class="add2e-attack-pills">
                  <span class="add2e-attack-pill">${distanceLabel}</span>
                  <span class="add2e-attack-pill red">Position : Face</span>
                  <span class="add2e-attack-pill">Auto : ${backLabel}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="add2e-attack-section">
            <div class="add2e-attack-field">
              <div>
                <label class="add2e-attack-label" for="add2e-bonus-attaque">Modificateur au toucher</label>
                <div class="add2e-attack-help">Bonus ou malus manuel appliqué au jet d’attaque.</div>
              </div>
              <input id="add2e-bonus-attaque" class="add2e-attack-input" type="number" value="0" step="1">
            </div>
          </div>

          <div class="add2e-attack-section">
            <div class="add2e-attack-field">
              <div>
                <label class="add2e-attack-label" for="add2e-position-zone">Position réelle</label>
                <div class="add2e-attack-help">Par défaut : Face. L’auto-détection reste indicative pour éviter les faux dos liés à l’image du token.</div>
              </div>
              <select id="add2e-position-zone" class="add2e-attack-select">
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
            </div>` : ""}
          </div>

          ${specialOptionsVisible ? `
          <div class="add2e-special-grid">
            ${canUseBackstab ? `
            <label class="add2e-check">
              <input type="checkbox" id="add2e-backstab">
              <span><span class="add2e-check-title">Attaque sournoise</span><span class="add2e-check-meta">+4 toucher · dégâts ×${backstabMultiplier}</span></span>
            </label>` : ""}
            ${canUseAssassination ? `
            <label class="add2e-check">
              <input type="checkbox" id="add2e-assassinat-confirm">
              <span><span class="add2e-check-title">Assassinat</span><span class="add2e-check-meta">${assassinationScore}% si l’attaque touche</span></span>
            </label>` : ""}
          </div>
          ${canUseAssassination ? `
          <div class="add2e-attack-section">
            <div class="add2e-attack-field">
              <div>
                <label class="add2e-attack-label" for="add2e-assassinat-mod">Modificateur assassinat</label>
                <div class="add2e-attack-help">Ajustement manuel du pourcentage d’assassinat.</div>
              </div>
              <input id="add2e-assassinat-mod" class="add2e-attack-input" type="number" value="0" step="1">
            </div>
          </div>` : ""}
          ` : ""}
        </form>
      `;
}
