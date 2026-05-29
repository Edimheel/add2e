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

export async function add2eAttackOpenDialogV2({ title, content, width, classes, defaultAction, onOk }) {
  const DialogV2 = foundry.applications?.api?.DialogV2;

  if (DialogV2?.wait) {
    return await DialogV2.wait({
      window: { title },
      classes: classes ?? [],
      position: { width: width ?? 660 },
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
      width: width ?? 660,
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
  return `
        <style>
          .add2e-attack-form { --a2e-gold: #b88924; --a2e-dark: #5d3d0d; --a2e-line: #d9bf73; --a2e-bg: #fff8df; display: grid; gap: 8px; color: #2f250c; }
          .add2e-attack-top { display: grid; grid-template-columns: 1fr 36px 1fr; gap: 8px; align-items: center; }
          .add2e-attack-box { border: 1px solid var(--a2e-line); border-radius: 9px; background: #fffdf4; padding: 8px 10px; }
          .add2e-attack-label { font-size: .76rem; font-weight: 900; text-transform: uppercase; color: var(--a2e-dark); }
          .add2e-attack-name { font-size: 1.05rem; font-weight: 900; margin-top: 2px; }
          .add2e-attack-pill { display: inline-flex; margin-top: 5px; padding: 2px 7px; border: 1px solid #d4af55; border-radius: 999px; background: #fff3c7; font-weight: 800; color: var(--a2e-dark); }
          .add2e-attack-arrow { text-align: center; font-size: 1.7rem; color: var(--a2e-dark); }
          .add2e-attack-line { display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid var(--a2e-line); border-radius: 9px; background: #fffdf4; padding: 8px 10px; }
          .add2e-attack-line label, .add2e-check-title { font-weight: 900; color: #3b2a0f; }
          .add2e-attack-line input[type="number"] { width: 74px; border: 1px solid var(--a2e-line); border-radius: 7px; background: #fffaf0; padding: 5px 7px; font-weight: 900; text-align: center; }
          .add2e-special-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .add2e-check { display: grid; grid-template-columns: 24px 1fr; gap: 8px; align-items: center; border: 1px solid var(--a2e-line); border-radius: 9px; background: #fff8e8; padding: 9px 10px; }
          .add2e-check input[type="checkbox"] { width: 18px; height: 18px; }
          .add2e-check-meta { margin-top: 2px; font-size: .86rem; color: #6b5a2a; font-weight: 800; }
        </style>

        <form class="add2e-attack-form">
          <div class="add2e-attack-top">
            <div class="add2e-attack-box">
              <div class="add2e-attack-label">Attaquant</div>
              <div class="add2e-attack-name">${actor.name}</div>
              <span class="add2e-attack-pill">${arme.name}</span>
            </div>
            <div class="add2e-attack-arrow">→</div>
            <div class="add2e-attack-box">
              <div class="add2e-attack-label">Cible</div>
              <div class="add2e-attack-name">${cible?.name ?? "Cible"}</div>
              <span class="add2e-attack-pill">${attackDistanceLabel}</span>
              <span class="add2e-attack-pill">Position : Face</span>
              <span class="add2e-attack-pill" title="Diagnostic uniquement">Auto : ${backArcInfo.label}</span>
            </div>
          </div>

          <div class="add2e-attack-line">
            <label for="add2e-bonus-attaque">Modificateur au toucher</label>
            <input id="add2e-bonus-attaque" type="number" value="0" step="1">
          </div>

          <div class="add2e-attack-line">
            <label for="add2e-position-zone">Position réelle</label>
            <select id="add2e-position-zone" style="width:160px;border:1px solid var(--a2e-line);border-radius:7px;background:#fffaf0;padding:5px 7px;font-weight:900;">
              <option value="front" selected>Face</option>
              <option value="flank">Flanc</option>
              <option value="rear-flank">Flanc arrière</option>
              <option value="rear">Dos</option>
              <option value="auto">Auto détecté (${backArcInfo.label})</option>
            </select>
          </div>

          <div style="margin:-4px 0 6px 0;font-size:.78rem;color:#6b5a2a;font-weight:800;line-height:1.25;">
            La position automatique est un diagnostic. Par défaut la résolution applique Face pour éviter les faux dos liés à la rotation des images de token.
          </div>

          ${positionAttackAdjustment.details.length ? `
          <div class="add2e-attack-line" style="font-weight:800;color:#5d3d0d;align-items:flex-start;">
            <span>Position</span>
            <span style="text-align:right;">${positionAttackAdjustment.details.join("<br>")}</span>
          </div>
          ` : ""}

          ${specialOptionsVisible ? `
          <div class="add2e-special-grid">
            ${canUseBackstab ? `
            <label class="add2e-check">
              <input type="checkbox" id="add2e-backstab">
              <span><span class="add2e-check-title">Attaque sournoise</span><span class="add2e-check-meta">+4 toucher · dégâts ×${backstabInfo.multiplier}</span></span>
            </label>` : ""}
            ${canUseAssassination ? `
            <label class="add2e-check">
              <input type="checkbox" id="add2e-assassinat-confirm">
              <span><span class="add2e-check-title">Assassinat</span><span class="add2e-check-meta">${assassinationInfo.score}% si l’attaque touche</span></span>
            </label>` : ""}
          </div>
          ${canUseAssassination ? `<div class="add2e-attack-line"><label for="add2e-assassinat-mod">Modificateur assassinat</label><input id="add2e-assassinat-mod" type="number" value="0" step="1"></div>` : ""}
          ` : ""}
        </form>
      `;
}
