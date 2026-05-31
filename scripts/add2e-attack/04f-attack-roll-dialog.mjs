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

function add2eAttackNormalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s\-]+/g, "_");
}

function add2eAttackClassNames(actor) {
  const details = actor?.system?.details_classe ?? {};
  return [
    actor?.system?.classe,
    details?.label,
    details?.name,
    details?.nom,
    details?.classe,
    details?.slug
  ].map(add2eAttackNormalizeText).filter(Boolean);
}

function add2eAttackIsThiefOrAssassin(actor) {
  return add2eAttackClassNames(actor).some(n => n.includes("voleur") || n.includes("assassin"));
}

function add2eAttackIsAssassin(actor) {
  return add2eAttackClassNames(actor).some(n => n.includes("assassin"));
}

export async function add2eAttackOpenDialogV2({ title, content, width, classes, defaultAction, onOk }) {
  const DialogV2 = foundry.applications?.api?.DialogV2;

  if (DialogV2?.wait) {
    return await DialogV2.wait({
      window: { title },
      classes: classes ?? [],
      position: { width: width ?? 560 },
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
      width: width ?? 560,
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
  const attackerImg = add2eAttackImage(actor);
  const targetImg = add2eAttackImage(cible);
  const weaponImg = add2eAttackImage(arme, "icons/svg/sword.svg");
  const backstabMultiplier = add2eAttackEscapeHtml(backstabInfo?.multiplier ?? "");
  const assassinationScore = add2eAttackEscapeHtml(assassinationInfo?.score ?? "0");
  const showBackstabForClass = !!canUseBackstab && add2eAttackIsThiefOrAssassin(actor);
  const showAssassinationForClass = !!canUseAssassination && add2eAttackIsAssassin(actor);
  const hasRearSpecial = showBackstabForClass || showAssassinationForClass;
  const allowedZones = new Set(["front", "flank", "rear-flank", "rear"]);
  const autoZone = allowedZones.has(String(backArcInfo?.zone ?? "")) ? String(backArcInfo.zone) : "front";
  const isRearSelected = autoZone === "rear";
  const rearDisplay = isRearSelected ? "grid" : "none";
  const selected = (zone) => autoZone === zone ? " selected" : "";

  return `
        <style>
          form.add2e-attack-form {
            --a2e-ink: #24170a;
            --a2e-brown: #5a3510;
            --a2e-line: #d5b15a;
            --a2e-red: #8f2d22;
            display: block;
            color: var(--a2e-ink);
            padding: 0;
          }
          .add2e-attack-input,
          .add2e-attack-select {
            border: 1px solid var(--a2e-line) !important;
            border-radius: 7px !important;
            background: #fffaf0 !important;
            color: #24170a !important;
            font-weight: 900 !important;
            min-height: 28px !important;
            padding: 3px 6px !important;
          }
          .add2e-attack-label {
            font-size: .72rem;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: .03em;
            color: var(--a2e-brown);
          }
          .add2e-inline-check {
            display: flex;
            align-items: center;
            gap: 6px;
            min-height: 28px;
            padding: 3px 6px;
            border: 1px solid var(--a2e-line);
            border-radius: 7px;
            background: #fffdf4;
            font-weight: 900;
            color: var(--a2e-brown);
            cursor: pointer;
          }
          .add2e-inline-check input[type="checkbox"] {
            width: 16px;
            height: 16px;
            accent-color: var(--a2e-red);
          }
          .add2e-rear-specials {
            display: none;
            gap: 5px;
            align-items: stretch;
          }
        </style>

        <form class="add2e-attack-form">
          <div style="display:flex;align-items:stretch;gap:6px;margin-bottom:6px;">
            <div style="flex:1;min-width:0;display:flex;align-items:center;gap:6px;padding:6px;border:1px solid #d5b15a;border-radius:10px;background:linear-gradient(180deg,#fffdf5,#fff0c8);">
              <img src="${attackerImg}" alt="" style="width:44px !important;height:44px !important;max-width:44px !important;max-height:44px !important;min-width:44px !important;min-height:44px !important;object-fit:cover !important;display:block !important;border-radius:8px !important;border:2px solid #fff7dc !important;background:#2a1908 !important;box-shadow:0 2px 6px rgba(0,0,0,.22) !important;">
              <div style="min-width:0;">
                <div style="font-size:.66rem;font-weight:950;text-transform:uppercase;color:#5a3510;">Attaquant</div>
                <div style="font-size:.96rem;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${attackerName}">${attackerName}</div>
                <div style="display:flex;align-items:center;gap:4px;margin-top:2px;font-size:.82rem;font-weight:900;color:#5a3510;">
                  <img src="${weaponImg}" alt="" style="width:17px !important;height:17px !important;max-width:17px !important;max-height:17px !important;object-fit:cover !important;display:inline-block !important;border-radius:4px !important;vertical-align:middle !important;">
                  <span>${weaponName}</span>
                </div>
              </div>
            </div>

            <div style="width:24px;display:flex;align-items:center;justify-content:center;font-size:1.15rem;font-weight:950;color:#6b4312;">→</div>

            <div style="flex:1;min-width:0;display:flex;align-items:center;gap:6px;padding:6px;border:1px solid #d69a76;border-radius:10px;background:linear-gradient(180deg,#fffdf5,#ffe8dc);">
              <img src="${targetImg}" alt="" style="width:44px !important;height:44px !important;max-width:44px !important;max-height:44px !important;min-width:44px !important;min-height:44px !important;object-fit:cover !important;display:block !important;border-radius:8px !important;border:2px solid #fff7dc !important;background:#2a1908 !important;box-shadow:0 2px 6px rgba(0,0,0,.22) !important;">
              <div style="min-width:0;">
                <div style="font-size:.66rem;font-weight:950;text-transform:uppercase;color:#8f2d22;">Cible</div>
                <div style="font-size:.96rem;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${targetName}">${targetName}</div>
              </div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:auto 180px;gap:7px;align-items:center;margin-bottom:6px;padding:6px 8px;border:1px solid #d5b15a;border-radius:10px;background:#fffdf4;">
            <label class="add2e-attack-label" for="add2e-position-zone" style="white-space:nowrap;">Position</label>
            <select id="add2e-position-zone" class="add2e-attack-select" style="width:180px !important;" onchange="var f=this.closest('form');var rear=this.value==='rear';var blocks=f&&f.querySelectorAll('.add2e-rear-specials');blocks&&blocks.forEach(function(b){b.style.display=rear?'grid':'none';});if(!rear&&f){f.querySelectorAll('#add2e-backstab,#add2e-assassinat-confirm').forEach(function(c){c.checked=false;});}">
              <option value="front"${selected("front")}>Face</option>
              <option value="flank"${selected("flank")}>Flanc</option>
              <option value="rear-flank"${selected("rear-flank")}>Flanc arrière</option>
              <option value="rear"${selected("rear")}>Dos</option>
            </select>
          </div>

          <div style="display:grid;grid-template-columns:auto 64px minmax(0,1fr);gap:7px;align-items:start;margin-bottom:6px;padding:6px 8px;border:1px solid #d5b15a;border-radius:10px;background:#fffdf4;">
            <label class="add2e-attack-label" for="add2e-bonus-attaque" style="white-space:nowrap;margin-top:6px;">Modificateurs</label>
            <input id="add2e-bonus-attaque" class="add2e-attack-input" type="number" value="0" step="1" style="width:64px !important;text-align:center !important;">
            ${hasRearSpecial ? `
            <div class="add2e-rear-specials" style="display:${rearDisplay};grid-template-columns:1fr;">
              ${showBackstabForClass ? `
              <label class="add2e-inline-check" title="Dos uniquement · +4 toucher · dégâts ×${backstabMultiplier}">
                <input type="checkbox" id="add2e-backstab">
                <span>Attaque sournoise</span>
              </label>` : ""}
              ${showAssassinationForClass ? `
              <label class="add2e-inline-check" title="Assassin uniquement · Dos uniquement · ${assassinationScore}% si l’attaque touche">
                <input type="checkbox" id="add2e-assassinat-confirm">
                <span>Assassinat</span>
              </label>` : ""}
            </div>` : ""}
          </div>
        </form>
      `;
}
