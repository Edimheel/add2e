// scripts/add2e-attack/04f-attack-roll-dialog.mjs
// ADD2E — Dialogue d'attaque.
// Compatible Foundry V13/V14/V15 : DialogV2 prioritaire, fallback Dialog conservé.

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

  return `
    <style>
      dialog.add2e-attack-dialog-compact,.application.add2e-attack-dialog-compact{width:480px!important;min-width:480px!important;max-width:480px!important;height:auto!important;min-height:0!important;}
      .add2e-attack-dialog-compact .window-content,.add2e-attack-dialog-compact .standard-form{padding:6px!important;overflow:visible!important;}
      .add2e-attack-dialog-compact .dialog-buttons,.add2e-attack-dialog-compact footer,.add2e-attack-dialog-compact .form-footer{display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important;margin-top:6px!important;padding:0!important;}
      .add2e-attack-form{--a2e-line:#d5b15a;--a2e-brown:#5a3510;display:block;max-width:456px;color:#24170a;}
      .add2e-combatants{display:flex;align-items:stretch;gap:3px;margin-bottom:4px;}
      .add2e-card{flex:1 1 0;min-width:0;display:flex;align-items:center;gap:3px;padding:3px;border:1px solid var(--a2e-line);border-radius:7px;background:#fff8dd;}
      .add2e-card.target{border-color:#d69a76;background:#fff2e8;}
      .add2e-card img.portrait{width:32px!important;height:32px!important;min-width:32px!important;object-fit:cover!important;border-radius:6px!important;}
      .add2e-title{font-size:.56rem;font-weight:950;text-transform:uppercase;color:var(--a2e-brown);}
      .add2e-name{font-size:.78rem;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .add2e-weapon{display:flex;align-items:center;gap:2px;font-size:.66rem;font-weight:900;color:var(--a2e-brown);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .add2e-weapon img{width:12px!important;height:12px!important;}
      .add2e-row{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:4px;align-items:start;}
      .add2e-box{padding:4px 5px;border:1px solid var(--a2e-line);border-radius:7px;background:#fffdf4;overflow:visible!important;}
      .add2e-modifiers{margin-left:28px;display:flex;align-items:center;gap:5px;}
      .add2e-attack-label{font-size:.66rem;font-weight:950;text-transform:uppercase;letter-spacing:.02em;color:var(--a2e-brown);white-space:nowrap;}
      .add2e-attack-input,.add2e-attack-select{border:1px solid var(--a2e-line)!important;border-radius:6px!important;background:#fffaf0!important;color:#24170a!important;font-weight:900!important;min-height:26px!important;padding:2px 5px!important;}
      #add2e-bonus-attaque{width:48px!important;min-width:48px!important;text-align:center!important;}
      #add2e-position-zone{width:100%!important;}
      .add2e-rear-specials{display:flex;flex-direction:column!important;gap:2px;margin-top:4px;min-width:210px;overflow:visible!important;}
      .add2e-rear-specials[hidden]{display:none!important;}
      .add2e-inline-check{display:flex;align-items:center;gap:5px;width:max-content!important;white-space:nowrap!important;font-size:.78rem;font-weight:900;color:var(--a2e-brown);}
      .add2e-inline-check span{white-space:nowrap!important;}
      .add2e-inline-check input{width:14px;height:14px;min-width:14px;}
    </style>
    <div class="add2e-attack-form">
      <div class="add2e-combatants">
        <div class="add2e-card"><img class="portrait" src="${attackerImg}" alt=""><div><div class="add2e-title">Attaquant</div><div class="add2e-name" title="${attackerName}">${attackerName}</div><div class="add2e-weapon"><img src="${weaponImg}" alt=""><span>${weaponName}</span></div></div></div>
        <div style="width:12px;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:950;color:#6b4312;">→</div>
        <div class="add2e-card target"><img class="portrait" src="${targetImg}" alt=""><div><div class="add2e-title" style="color:#8f2d22;">Cible</div><div class="add2e-name" title="${targetName}">${targetName}</div></div></div>
      </div>
      <div class="add2e-row">
        <div class="add2e-box add2e-modifiers"><label class="add2e-attack-label" for="add2e-bonus-attaque">Modificateurs</label><input id="add2e-bonus-attaque" class="add2e-attack-input" type="number" value="0" step="1"></div>
        <div class="add2e-box"><label class="add2e-attack-label" for="add2e-position-zone">Position</label><select id="add2e-position-zone" class="add2e-attack-select"><option value="front"${selected("front")}>Face</option><option value="flank"${selected("flank")}>Flanc</option><option value="rear-flank"${selected("rear-flank")}>Flanc arrière</option><option value="rear"${selected("rear")}>Dos</option></select>${hasRearSpecial ? `<div class="add2e-rear-specials"${isRearSelected ? "" : " hidden"}>${showBackstabForClass ? `<label class="add2e-inline-check" title="Dos uniquement · +4 toucher · dégâts ×${backstabMultiplier}"><input type="checkbox" id="add2e-backstab"><span>Attaque sournoise</span></label>` : ""}${showAssassinationForClass ? `<label class="add2e-inline-check" title="Assassin uniquement · Dos uniquement · ${assassinationScore}% si l’attaque touche"><input type="checkbox" id="add2e-assassinat-confirm"><span>Assassinat</span></label>` : ""}</div>` : ""}</div>
      </div>
    </div>`;
}
