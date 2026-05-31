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
      position: { width: width ?? 640 },
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
      width: width ?? 640,
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
            --a2e-line: #d5b15a;
            --a2e-red: #8f2d22;
            display: block;
            color: var(--a2e-ink);
            padding: 2px;
          }
          .add2e-attack-input,
          .add2e-attack-select {
            border: 1px solid var(--a2e-line) !important;
            border-radius: 8px !important;
            background: #fffaf0 !important;
            color: #24170a !important;
            font-weight: 900 !important;
            min-height: 32px !important;
            padding: 4px 7px !important;
          }
          .add2e-attack-pill {
            display: inline-flex;
            align-items: center;
            padding: 3px 8px;
            border: 1px solid #d1a13d;
            border-radius: 999px;
            background: #fff7da;
            color: #68420e;
            font-size: .78rem;
            font-weight: 850;
            line-height: 1.1;
            margin: 2px 3px 0 0;
          }
          .add2e-attack-pill.red {
            border-color: #d69a76;
            background: #fff1e9;
            color: var(--a2e-red);
          }
          .add2e-attack-label {
            font-size: .78rem;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: .03em;
            color: var(--a2e-brown);
          }
          .add2e-attack-help {
            margin-top: 1px;
            font-size: .76rem;
            line-height: 1.2;
            color: #71581d;
            font-weight: 700;
          }
          .add2e-check {
            display: flex;
            gap: 8px;
            align-items: center;
            padding: 8px 10px;
            border: 1px solid var(--a2e-line);
            border-radius: 10px;
            background: #fffdf4;
            cursor: pointer;
          }
          .add2e-check input[type="checkbox"] {
            width: 18px;
            height: 18px;
            accent-color: var(--a2e-red);
          }
          .add2e-check-title { font-weight: 900; color: var(--a2e-brown); }
          .add2e-check-meta { display: block; margin-top: 1px; font-size: .76rem; color: #71581d; font-weight: 800; }
          .add2e-position-result {
            margin-top: 5px;
            display: flex;
            justify-content: space-between;
            gap: 10px;
            color: #5d3d0d;
            font-size: .8rem;
            font-weight: 800;
          }
        </style>

        <form class="add2e-attack-form">
          <div style="display:flex;align-items:stretch;gap:8px;margin-bottom:8px;">
            <div style="flex:1;min-width:0;display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #d5b15a;border-radius:12px;background:linear-gradient(180deg,#fffdf5,#fff0c8);">
              <img src="${attackerImg}" alt="" style="width:56px !important;height:56px !important;max-width:56px !important;max-height:56px !important;min-width:56px !important;min-height:56px !important;object-fit:cover !important;display:block !important;border-radius:10px !important;border:2px solid #fff7dc !important;background:#2a1908 !important;box-shadow:0 2px 7px rgba(0,0,0,.25) !important;">
              <div style="min-width:0;">
                <div style="font-size:.72rem;font-weight:950;text-transform:uppercase;color:#5a3510;">Attaquant</div>
                <div style="font-size:1.04rem;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${attackerName}">${attackerName}</div>
                <div style="display:flex;align-items:center;gap:5px;margin-top:4px;">
                  <img src="${weaponImg}" alt="" style="width:20px !important;height:20px !important;max-width:20px !important;max-height:20px !important;object-fit:cover !important;display:inline-block !important;border-radius:5px !important;vertical-align:middle !important;">
                  <span class="add2e-attack-pill">${weaponName}</span>
                </div>
              </div>
            </div>

            <div style="width:34px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:950;color:#6b4312;">→</div>

            <div style="flex:1;min-width:0;display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #d69a76;border-radius:12px;background:linear-gradient(180deg,#fffdf5,#ffe8dc);">
              <img src="${targetImg}" alt="" style="width:56px !important;height:56px !important;max-width:56px !important;max-height:56px !important;min-width:56px !important;min-height:56px !important;object-fit:cover !important;display:block !important;border-radius:10px !important;border:2px solid #fff7dc !important;background:#2a1908 !important;box-shadow:0 2px 7px rgba(0,0,0,.25) !important;">
              <div style="min-width:0;">
                <div style="font-size:.72rem;font-weight:950;text-transform:uppercase;color:#8f2d22;">Cible</div>
                <div style="font-size:1.04rem;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${targetName}">${targetName}</div>
                <div style="margin-top:4px;">
                  <span class="add2e-attack-pill">${distanceLabel}</span>
                  <span class="add2e-attack-pill red">Auto : ${backLabel}</span>
                </div>
              </div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:minmax(0,1fr) 210px 84px;gap:8px;align-items:end;margin-bottom:8px;padding:9px 10px;border:1px solid #d5b15a;border-radius:12px;background:#fffdf4;">
            <div>
              <label class="add2e-attack-label" for="add2e-position-zone">Direction de l’attaque</label>
              <div class="add2e-attack-help">Choix manuel de l’angle réellement utilisé pour résoudre le bonus de position.</div>
            </div>
            <select id="add2e-position-zone" class="add2e-attack-select" style="width:210px !important;">
              <option value="front" selected>Face</option>
              <option value="flank">Flanc</option>
              <option value="rear-flank">Flanc arrière</option>
              <option value="rear">Dos</option>
              <option value="auto">Auto détecté (${backLabel})</option>
            </select>
            <div style="text-align:right;">
              <div class="add2e-attack-label" style="font-size:.68rem;">Auto</div>
              <span class="add2e-attack-pill red" style="margin-top:3px;">${backLabel}</span>
            </div>
            ${positionAttackAdjustment.details.length ? `
            <div class="add2e-position-result" style="grid-column:1 / -1;">
              <span>Effet de position</span>
              <span>${positionAttackAdjustment.details.map(add2eAttackEscapeHtml).join("<br>")}</span>
            </div>` : ""}
          </div>

          <div style="display:grid;grid-template-columns:minmax(0,1fr) 76px;gap:8px;align-items:center;margin-bottom:8px;padding:9px 10px;border:1px solid #d5b15a;border-radius:12px;background:#fffdf4;">
            <div>
              <label class="add2e-attack-label" for="add2e-bonus-attaque">Bonus / malus au toucher</label>
              <div class="add2e-attack-help">Valeur manuelle courte, par exemple -2, 0, +4.</div>
            </div>
            <input id="add2e-bonus-attaque" class="add2e-attack-input" type="number" value="0" step="1" style="width:76px !important;text-align:center !important;">
          </div>

          ${specialOptionsVisible ? `
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:8px;">
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
          <div style="display:grid;grid-template-columns:minmax(0,1fr) 76px;gap:8px;align-items:center;padding:9px 10px;border:1px solid #d5b15a;border-radius:12px;background:#fffdf4;">
            <div>
              <label class="add2e-attack-label" for="add2e-assassinat-mod">Modificateur assassinat</label>
              <div class="add2e-attack-help">Ajustement manuel du pourcentage d’assassinat.</div>
            </div>
            <input id="add2e-assassinat-mod" class="add2e-attack-input" type="number" value="0" step="1" style="width:76px !important;text-align:center !important;">
          </div>` : ""}
          ` : ""}
        </form>
      `;
}
