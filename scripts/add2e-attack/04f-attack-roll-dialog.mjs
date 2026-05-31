// scripts/add2e-attack/04f-attack-roll-dialog.mjs
// ADD2E — Dialogue d'attaque.
// Compatible Foundry V13/V14/V15 : DialogV2 prioritaire, fallback Dialog conservé.

const ADD2E_ATTACK_DIALOG_VERSION = "2026-05-31-attack-dialog-inline-layout-1";
const ADD2E_ATTACK_DIALOG_WIDTH = 480;

function add2eAttackFormAdapter(root) {
  return {
    find(selector) {
      const el = root?.querySelector?.(selector) ?? null;
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

function add2eAttackRoot(appOrElement) {
  const element = appOrElement?.element ?? appOrElement ?? null;
  return element?.querySelector?.(".add2e-attack-form")
    ?? element?.closest?.("dialog")?.querySelector?.(".add2e-attack-form")
    ?? null;
}

function add2eApplyRearOptions(root) {
  const container = add2eAttackRoot(root) ?? root;
  const select = container?.querySelector?.("#add2e-position-zone");
  if (!container || !select) return false;

  const isRear = select.value === "rear";
  for (const block of container.querySelectorAll(".add2e-rear-specials")) block.hidden = !isRear;
  if (!isRear) {
    for (const input of container.querySelectorAll("#add2e-backstab,#add2e-assassinat-confirm")) input.checked = false;
  }
  return true;
}

function add2eForceDialogSize(appOrElement) {
  const element = appOrElement?.element ?? appOrElement ?? null;
  const roots = [element, element?.closest?.("dialog"), element?.closest?.(".application")].filter(Boolean);
  for (const root of new Set(roots)) {
    root.style.setProperty("width", `${ADD2E_ATTACK_DIALOG_WIDTH}px`, "important");
    root.style.setProperty("min-width", `${ADD2E_ATTACK_DIALOG_WIDTH}px`, "important");
    root.style.setProperty("max-width", `${ADD2E_ATTACK_DIALOG_WIDTH}px`, "important");
    root.style.setProperty("height", "auto", "important");
    root.style.setProperty("min-height", "0", "important");
  }
}

function add2eCreateAttackDialogV2Class(DialogV2) {
  return class Add2eAttackDialogV2 extends DialogV2 {
    _onRender(context, options) {
      super._onRender?.(context, options);
      this.add2eBindAttackDialog();
    }

    add2eBindAttackDialog() {
      this.setPosition?.({ width: ADD2E_ATTACK_DIALOG_WIDTH, height: "auto" });
      add2eForceDialogSize(this);

      const root = add2eAttackRoot(this);
      const select = root?.querySelector?.("#add2e-position-zone");
      if (!root || !select) return false;

      if (select.dataset.add2eRearBound !== "1") {
        select.dataset.add2eRearBound = "1";
        select.addEventListener("change", () => add2eApplyRearOptions(root));
        select.addEventListener("input", () => add2eApplyRearOptions(root));
      }
      return add2eApplyRearOptions(root);
    }
  };
}

export async function add2eAttackOpenDialogV2({ title, content, width, classes, defaultAction, onOk }) {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  const dialogClasses = add2eAttackDialogClasses(classes);

  if (DialogV2) {
    const Add2eAttackDialogV2 = add2eCreateAttackDialogV2Class(DialogV2);
    return await new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
        return value;
      };

      const dialog = new Add2eAttackDialogV2({
        window: { title },
        classes: dialogClasses,
        position: { width: ADD2E_ATTACK_DIALOG_WIDTH, height: "auto" },
        content,
        buttons: [
          {
            action: "ok",
            label: "Lancer l'attaque",
            default: defaultAction === "ok",
            callback: async (event, button, dlg) => {
              const root = button?.form?.querySelector?.(".add2e-attack-form")
                ?? add2eAttackRoot(dlg)
                ?? document.querySelector(".add2e-attack-form");
              return finish(await onOk(add2eAttackFormAdapter(root)));
            }
          },
          { action: "cancel", label: "Annuler", callback: () => finish(false) }
        ],
        default: defaultAction ?? "ok"
      });

      console.log("[ADD2E][ATTAQUE][DIALOG_VERSION]", ADD2E_ATTACK_DIALOG_VERSION);
      dialog.addEventListener?.("close", () => finish(false), { once: true });
      const rendered = dialog.render({ force: true });
      Promise.resolve(rendered).then(() => dialog.add2eBindAttackDialog?.());
      setTimeout(() => dialog.add2eBindAttackDialog?.(), 0);
      setTimeout(() => dialog.add2eBindAttackDialog?.(), 50);
      setTimeout(() => dialog.add2eBindAttackDialog?.(), 150);
    });
  }

  return await new Promise((resolve) => {
    new Dialog({
      title,
      content,
      buttons: {
        ok: {
          label: "Lancer l'attaque",
          callback: async (dlgHtml) => {
            const root = dlgHtml?.[0]?.querySelector?.(".add2e-attack-form") ?? dlgHtml?.find?.(".add2e-attack-form")?.[0] ?? dlgHtml;
            return resolve(await onOk(add2eAttackFormAdapter(root)));
          }
        },
        cancel: { label: "Annuler", callback: () => resolve(false) }
      },
      default: defaultAction ?? "ok"
    }, { width: ADD2E_ATTACK_DIALOG_WIDTH, classes: dialogClasses }).render(true);
  });
}

export function add2eBuildAttackDialogContent({ actor, arme, cible, backArcInfo, canUseBackstab, backstabInfo, canUseAssassination, assassinationInfo }) {
  console.log("[ADD2E][ATTAQUE][DIALOG_BUILD_VERSION]", ADD2E_ATTACK_DIALOG_VERSION);

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
  const selected = (zone) => autoZone === zone ? " selected" : "";
  const rearHidden = isRearSelected ? "" : " hidden";

  const rootStyle = "box-sizing:border-box;width:456px;max-width:456px;color:#24170a;font-family:inherit;";
  const topRowStyle = "box-sizing:border-box;display:flex;align-items:stretch;gap:6px;margin:0 0 8px 0;width:100%;";
  const cardStyle = "box-sizing:border-box;flex:1 1 0;min-width:0;height:58px;display:flex;align-items:center;gap:6px;padding:5px;border:1px solid #d5b15a;border-radius:7px;background:#fff8dd;overflow:hidden;";
  const targetCardStyle = "box-sizing:border-box;flex:1 1 0;min-width:0;height:58px;display:flex;align-items:center;gap:6px;padding:5px;border:1px solid #d69a76;border-radius:7px;background:#fff2e8;overflow:hidden;";
  const portraitStyle = "width:36px !important;height:36px !important;min-width:36px !important;max-width:36px !important;min-height:36px !important;max-height:36px !important;object-fit:cover !important;display:block !important;border-radius:6px !important;border:1px solid #fff7dc !important;background:#2a1908 !important;";
  const titleStyle = "font-size:.58rem;font-weight:950;text-transform:uppercase;color:#5a3510;line-height:1;white-space:nowrap;";
  const targetTitleStyle = "font-size:.58rem;font-weight:950;text-transform:uppercase;color:#8f2d22;line-height:1;white-space:nowrap;";
  const nameStyle = "font-size:.82rem;font-weight:950;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
  const weaponRowStyle = "display:flex;align-items:center;gap:3px;margin-top:2px;font-size:.68rem;font-weight:900;color:#5a3510;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
  const weaponImgStyle = "width:13px !important;height:13px !important;min-width:13px !important;max-width:13px !important;object-fit:cover !important;display:inline-block !important;border-radius:2px !important;";
  const bodyGridStyle = "box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:6px;align-items:start;width:100%;";
  const boxStyle = "box-sizing:border-box;padding:6px;border:1px solid #d5b15a;border-radius:7px;background:#fffdf4;overflow:visible;";
  const modifierBoxStyle = "box-sizing:border-box;margin-left:28px;padding:6px;border:1px solid #d5b15a;border-radius:7px;background:#fffdf4;display:flex;align-items:center;gap:8px;height:44px;";
  const labelStyle = "font-size:.72rem;font-weight:950;text-transform:uppercase;letter-spacing:.02em;color:#5a3510;white-space:nowrap;line-height:1;";
  const inputStyle = "box-sizing:border-box;width:52px !important;min-width:52px !important;height:30px !important;text-align:center !important;border:1px solid #d5b15a !important;border-radius:6px !important;background:#fffaf0 !important;color:#24170a !important;font-weight:900 !important;padding:2px 5px !important;";
  const selectStyle = "box-sizing:border-box;width:100% !important;height:32px !important;border:1px solid #d5b15a !important;border-radius:6px !important;background:#fffaf0 !important;color:#24170a !important;font-weight:900 !important;padding:2px 5px !important;margin-top:4px;";
  const rearStyle = "display:flex;flex-direction:column;gap:4px;margin-top:6px;min-width:210px;overflow:visible;";
  const checkStyle = "display:flex;align-items:center;gap:6px;width:max-content;white-space:nowrap;font-size:.82rem;font-weight:900;color:#5a3510;line-height:1.15;";
  const checkInputStyle = "width:15px;height:15px;min-width:15px;margin:0;";

  return `
    <div class="add2e-attack-form" style="${rootStyle}">
      <div style="${topRowStyle}">
        <div style="${cardStyle}">
          <img src="${attackerImg}" alt="" style="${portraitStyle}">
          <div style="min-width:0;overflow:hidden;">
            <div style="${titleStyle}">Attaquant</div>
            <div style="${nameStyle}" title="${attackerName}">${attackerName}</div>
            <div style="${weaponRowStyle}"><img src="${weaponImg}" alt="" style="${weaponImgStyle}"><span style="overflow:hidden;text-overflow:ellipsis;">${weaponName}</span></div>
          </div>
        </div>
        <div style="width:14px;min-width:14px;display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:950;color:#6b4312;">→</div>
        <div style="${targetCardStyle}">
          <img src="${targetImg}" alt="" style="${portraitStyle}">
          <div style="min-width:0;overflow:hidden;">
            <div style="${targetTitleStyle}">Cible</div>
            <div style="${nameStyle}" title="${targetName}">${targetName}</div>
          </div>
        </div>
      </div>

      <div style="${bodyGridStyle}">
        <div style="${modifierBoxStyle}">
          <label for="add2e-bonus-attaque" style="${labelStyle}">Modificateurs</label>
          <input id="add2e-bonus-attaque" type="number" value="0" step="1" style="${inputStyle}">
        </div>
        <div style="${boxStyle}">
          <label for="add2e-position-zone" style="${labelStyle}">Position</label>
          <select id="add2e-position-zone" style="${selectStyle}">
            <option value="front"${selected("front")}>Face</option>
            <option value="flank"${selected("flank")}>Flanc</option>
            <option value="rear-flank"${selected("rear-flank")}>Flanc arrière</option>
            <option value="rear"${selected("rear")}>Dos</option>
          </select>
          ${hasRearSpecial ? `<div class="add2e-rear-specials"${rearHidden} style="${rearStyle}">
            ${showBackstabForClass ? `<label style="${checkStyle}" title="Dos uniquement · +4 toucher · dégâts ×${backstabMultiplier}"><input type="checkbox" id="add2e-backstab" style="${checkInputStyle}"><span style="white-space:nowrap;">Attaque sournoise</span></label>` : ""}
            ${showAssassinationForClass ? `<label style="${checkStyle}" title="Assassin uniquement · Dos uniquement · ${assassinationScore}% si l’attaque touche"><input type="checkbox" id="add2e-assassinat-confirm" style="${checkInputStyle}"><span style="white-space:nowrap;">Assassinat</span></label>` : ""}
          </div>` : ""}
        </div>
      </div>
    </div>`;
}
