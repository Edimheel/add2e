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

function add2eAttackDialogClasses(classes) {
  return Array.from(new Set([...(classes ?? []), "add2e-attack-dialog-compact"]));
}

function add2eGetDialogRoot(dialog) {
  const element = dialog?.element ?? null;
  return element?.closest?.("dialog") ?? element?.closest?.(".application") ?? element;
}

function add2eUpdateRearSpecialVisibility(rootOrForm) {
  const container = rootOrForm?.matches?.("form.add2e-attack-form")
    ? rootOrForm
    : (rootOrForm?.querySelector?.("form.add2e-attack-form") ?? rootOrForm);
  const select = container?.querySelector?.("#add2e-position-zone");
  if (!select) return;

  const rear = select.value === "rear";
  const blocks = container.querySelectorAll?.(".add2e-rear-specials") ?? [];
  for (const block of blocks) {
    block.style.setProperty("display", rear ? "flex" : "none", "important");
    block.style.setProperty("flex-direction", "column", "important");
  }

  if (!rear) {
    container.querySelectorAll?.("#add2e-backstab,#add2e-assassinat-confirm")?.forEach(c => {
      c.checked = false;
    });
  }
}

window.add2eAttackToggleRearSpecials = function add2eAttackToggleRearSpecials(form) {
  add2eUpdateRearSpecialVisibility(form);
};

function add2eAttachAttackDialogEvents(dialog) {
  const root = add2eGetDialogRoot(dialog);
  const form = root?.querySelector?.("form.add2e-attack-form");
  const select = form?.querySelector?.("#add2e-position-zone");
  if (!form || !select || select.dataset.add2eRearToggleBound === "1") {
    add2eUpdateRearSpecialVisibility(root);
    return;
  }

  select.dataset.add2eRearToggleBound = "1";
  select.addEventListener("change", () => add2eUpdateRearSpecialVisibility(form));
  select.addEventListener("input", () => add2eUpdateRearSpecialVisibility(form));
  add2eUpdateRearSpecialVisibility(form);
}

function add2eForceAttackDialogSize(dialog, width = 480) {
  try {
    dialog?.setPosition?.({ width, height: "auto" });

    const element = dialog?.element ?? null;
    const roots = [
      element,
      element?.closest?.("dialog"),
      element?.closest?.(".application"),
      element?.closest?.(".window-app"),
      element?.closest?.(".app"),
      element?.closest?.(".dialog")
    ].filter(Boolean);

    for (const root of new Set(roots)) {
      root.style.setProperty("width", `${width}px`, "important");
      root.style.setProperty("min-width", `${width}px`, "important");
      root.style.setProperty("max-width", `${width}px`, "important");
      root.style.setProperty("height", "auto", "important");
      root.style.setProperty("min-height", "0", "important");
      root.style.setProperty("max-height", "none", "important");
    }

    add2eAttachAttackDialogEvents(dialog);

    const measured = add2eGetDialogRoot(dialog);
    if (measured) {
      const cs = getComputedStyle(measured);
      console.log("[ADD2E][ATTAQUE][DIALOG_SIZE]", {
        requested: width,
        tag: measured.tagName,
        classes: measured.className,
        inlineWidth: measured.style.width,
        inlineMinWidth: measured.style.minWidth,
        computedWidth: cs.width,
        computedMinWidth: cs.minWidth,
        rectWidth: measured.getBoundingClientRect?.().width ?? null
      });
    }
  } catch (err) {
    console.warn("[ADD2E][ATTAQUE][DIALOG_SIZE][ERROR]", err);
  }
}

export async function add2eAttackOpenDialogV2({ title, content, width, classes, defaultAction, onOk }) {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  const compactWidth = 480;
  const dialogClasses = add2eAttackDialogClasses(classes);

  if (DialogV2) {
    return await new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
        return value;
      };

      const dialog = new DialogV2({
        window: { title },
        classes: dialogClasses,
        content,
        buttons: [
          {
            action: "ok",
            label: "Lancer l'attaque",
            default: defaultAction === "ok",
            callback: async (event, button, dlg) => {
              const form = button?.form ?? dlg?.element?.querySelector?.("form") ?? document.querySelector("form.add2e-attack-form");
              return finish(await onOk(add2eAttackFormAdapter(form)));
            }
          },
          {
            action: "cancel",
            label: "Annuler",
            callback: () => finish(false)
          }
        ],
        default: defaultAction ?? "ok"
      });

      dialog.addEventListener?.("close", () => finish(false), { once: true });
      dialog.render({ force: true });
      setTimeout(() => add2eForceAttackDialogSize(dialog, compactWidth), 0);
      setTimeout(() => add2eForceAttackDialogSize(dialog, compactWidth), 50);
      setTimeout(() => add2eForceAttackDialogSize(dialog, compactWidth), 150);
      setTimeout(() => add2eForceAttackDialogSize(dialog, compactWidth), 300);
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
      width: compactWidth,
      classes: dialogClasses
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
  const rearDisplay = isRearSelected ? "flex" : "none";
  const selected = (zone) => autoZone === zone ? " selected" : "";

  return `
        <style>
          dialog.add2e-attack-dialog-compact,
          .add2e-attack-dialog-compact,
          .application.add2e-attack-dialog-compact,
          .window-app.add2e-attack-dialog-compact,
          .dialog.add2e-attack-dialog-compact {
            width: 480px !important;
            min-width: 480px !important;
            max-width: 480px !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
          }
          .add2e-attack-dialog-compact .window-content,
          .add2e-attack-dialog-compact .standard-form {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 480px !important;
            height: auto !important;
            min-height: 0 !important;
            padding: 6px !important;
            overflow: visible !important;
          }
          .add2e-attack-dialog-compact .dialog-buttons,
          .add2e-attack-dialog-compact footer,
          .add2e-attack-dialog-compact .form-footer {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 6px !important;
            margin-top: 6px !important;
            padding: 0 !important;
          }
          .add2e-attack-dialog-compact button {
            min-height: 32px !important;
            padding: 4px 8px !important;
          }
          form.add2e-attack-form {
            --a2e-ink: #24170a;
            --a2e-brown: #5a3510;
            --a2e-line: #d5b15a;
            --a2e-red: #8f2d22;
            display: block;
            width: 100%;
            max-width: 456px;
            color: var(--a2e-ink);
            padding: 0;
            margin: 0;
          }
          .add2e-attack-input,
          .add2e-attack-select {
            border: 1px solid var(--a2e-line) !important;
            border-radius: 6px !important;
            background: #fffaf0 !important;
            color: #24170a !important;
            font-weight: 900 !important;
            min-height: 26px !important;
            padding: 2px 5px !important;
          }
          .add2e-attack-label {
            font-size: .66rem;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: .02em;
            color: var(--a2e-brown);
          }
          .add2e-inline-check {
            display: flex;
            align-items: center;
            gap: 5px;
            width: max-content !important;
            min-width: max-content !important;
            max-width: none !important;
            min-height: 24px;
            padding: 1px 2px;
            font-size: .78rem;
            line-height: 1.05;
            font-weight: 900;
            color: var(--a2e-brown);
            cursor: pointer;
            white-space: nowrap !important;
          }
          .add2e-inline-check span {
            display: inline-block;
            white-space: nowrap !important;
            width: max-content !important;
            min-width: max-content !important;
          }
          .add2e-inline-check input[type="checkbox"] {
            width: 14px;
            height: 14px;
            min-width: 14px;
            accent-color: var(--a2e-red);
          }
          .add2e-rear-specials {
            display: none;
            flex-direction: column !important;
            gap: 2px;
            margin-top: 4px;
            min-width: 210px;
            overflow: visible !important;
          }
        </style>

        <form class="add2e-attack-form">
          <div style="display:flex;align-items:stretch;gap:3px;margin-bottom:4px;">
            <div style="flex:1 1 0;min-width:0;display:flex;align-items:center;gap:3px;padding:3px;border:1px solid #d5b15a;border-radius:7px;background:linear-gradient(180deg,#fffdf5,#fff0c8);">
              <img src="${attackerImg}" alt="" style="width:32px !important;height:32px !important;max-width:32px !important;max-height:32px !important;min-width:32px !important;min-height:32px !important;object-fit:cover !important;display:block !important;border-radius:6px !important;border:1px solid #fff7dc !important;background:#2a1908 !important;box-shadow:0 1px 3px rgba(0,0,0,.18) !important;">
              <div style="min-width:0;">
                <div style="font-size:.56rem;font-weight:950;text-transform:uppercase;color:#5a3510;">Attaquant</div>
                <div style="font-size:.78rem;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${attackerName}">${attackerName}</div>
                <div style="display:flex;align-items:center;gap:2px;margin-top:0;font-size:.66rem;font-weight:900;color:#5a3510;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  <img src="${weaponImg}" alt="" style="width:12px !important;height:12px !important;max-width:12px !important;max-height:12px !important;object-fit:cover !important;display:inline-block !important;border-radius:2px !important;vertical-align:middle !important;">
                  <span style="overflow:hidden;text-overflow:ellipsis;">${weaponName}</span>
                </div>
              </div>
            </div>

            <div style="width:12px;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:950;color:#6b4312;">→</div>

            <div style="flex:1 1 0;min-width:0;display:flex;align-items:center;gap:3px;padding:3px;border:1px solid #d69a76;border-radius:7px;background:linear-gradient(180deg,#fffdf5,#ffe8dc);">
              <img src="${targetImg}" alt="" style="width:32px !important;height:32px !important;max-width:32px !important;max-height:32px !important;min-width:32px !important;min-height:32px !important;object-fit:cover !important;display:block !important;border-radius:6px !important;border:1px solid #fff7dc !important;background:#2a1908 !important;box-shadow:0 1px 3px rgba(0,0,0,.18) !important;">
              <div style="min-width:0;">
                <div style="font-size:.56rem;font-weight:950;text-transform:uppercase;color:#8f2d22;">Cible</div>
                <div style="font-size:.78rem;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${targetName}">${targetName}</div>
              </div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:4px;align-items:start;margin-bottom:0;">
            <div style="min-width:0;display:flex;align-items:center;gap:5px;padding:4px 5px;border:1px solid #d5b15a;border-radius:7px;background:#fffdf4;">
              <label class="add2e-attack-label" for="add2e-bonus-attaque" style="white-space:nowrap;margin:0;">Modificateurs</label>
              <input id="add2e-bonus-attaque" class="add2e-attack-input" type="number" value="0" step="1" style="width:48px !important;min-width:48px !important;text-align:center !important;">
            </div>

            <div style="padding:4px 5px;border:1px solid #d5b15a;border-radius:7px;background:#fffdf4;overflow:visible !important;">
              <label class="add2e-attack-label" for="add2e-position-zone" style="display:block;margin-bottom:2px;white-space:nowrap;">Position</label>
              <select id="add2e-position-zone" class="add2e-attack-select" style="width:100% !important;" onchange="if(window.add2eAttackToggleRearSpecials) window.add2eAttackToggleRearSpecials(this.closest('form'))">
                <option value="front"${selected("front")}>Face</option>
                <option value="flank"${selected("flank")}>Flanc</option>
                <option value="rear-flank"${selected("rear-flank")}>Flanc arrière</option>
                <option value="rear"${selected("rear")}>Dos</option>
              </select>
              ${hasRearSpecial ? `
              <div class="add2e-rear-specials" style="display:${rearDisplay};flex-direction:column !important;">
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
          </div>
        </form>
      `;
}
