// scripts/add2e-attack/04f-attack-roll-dialog.mjs
// ADD2E — Dialogue d'attaque via l'API commune ADD2E.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2 via dialog-ui.mjs uniquement.

const ADD2E_ATTACK_DIALOG_VERSION = "2026-08-11-canonical-thief-rear-options-v9";

globalThis.ADD2E_ATTACK_DIALOG_VERSION = ADD2E_ATTACK_DIALOG_VERSION;

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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eAttackImage(entity, fallback = "icons/svg/mystery-man.svg") {
  return add2eAttackEscapeHtml(entity?.img ?? entity?.texture?.src ?? entity?.document?.texture?.src ?? fallback);
}

function add2eAttackCanonicalTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, "_");
}

function add2eAttackClassTags(actor) {
  const tags = new Set();
  for (const item of actor?.items ?? []) {
    if (String(item?.type ?? "").toLowerCase() !== "classe") continue;
    const rawTags = Array.isArray(item?.system?.tags) ? item.system.tags : [];
    for (const rawTag of rawTags) {
      const tag = add2eAttackCanonicalTag(rawTag);
      if (tag.startsWith("classe:")) tags.add(tag);
    }
  }
  return tags;
}

function add2eAttackIsThiefOrAssassin(actor) {
  const tags = add2eAttackClassTags(actor);
  return tags.has("classe:voleur") || tags.has("classe:assassin");
}

function add2eAttackIsAssassin(actor) {
  return add2eAttackClassTags(actor).has("classe:assassin");
}

function add2eAttackRoot(appOrElement) {
  const element = appOrElement?.element ?? appOrElement?.[0] ?? appOrElement ?? null;
  if (!element) return null;
  if (element.matches?.(".add2e-attack-form")) return element;
  return element.querySelector?.(".add2e-attack-form")
    ?? element.closest?.("dialog")?.querySelector?.(".add2e-attack-form")
    ?? element.closest?.(".application")?.querySelector?.(".add2e-attack-form")
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

function add2eBindAttackDialogInteractions(app, html) {
  const root = add2eAttackRoot(html) ?? add2eAttackRoot(app);
  if (!root) return false;

  const position = root.querySelector("#add2e-position-zone");
  if (position && position.dataset.add2eRearBound !== "1") {
    position.dataset.add2eRearBound = "1";
    position.addEventListener("change", () => add2eApplyRearOptions(root));
    position.addEventListener("input", () => add2eApplyRearOptions(root));
  }

  add2eApplyRearOptions(root);
  return true;
}

function add2eInstallAttackDialogBindings() {
  if (globalThis.__ADD2E_ATTACK_DIALOG_BINDINGS_V9) return;
  globalThis.__ADD2E_ATTACK_DIALOG_BINDINGS_V9 = true;
  Hooks.on("renderDialogV2", add2eBindAttackDialogInteractions);
  Hooks.on("renderApplicationV2", add2eBindAttackDialogInteractions);
}

export async function add2eAttackOpenDialogV2({ title, content, classes, defaultAction, onOk }) {
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible pour le dialogue d’attaque.");
  }

  const dialogClasses = Array.from(new Set([...(classes ?? []), "add2e-attack-dialog-compact"]));
  return globalThis.add2eDialogWait({
    add2eTheme: "parchment",
    add2ePrimaryAction: "attack",
    add2eClasses: dialogClasses,
    window: { title },
    content,
    buttons: [
      {
        action: "attack",
        label: "Lancer l'attaque",
        icon: "<i class='fas fa-dice-d20'></i>",
        default: defaultAction === "ok" || defaultAction === "attack",
        callback: async (_event, button) => {
          try {
            const form = button?.form ?? null;
            const root = add2eAttackRoot(form) ?? form;
            if (!root) throw new Error("Formulaire d’attaque introuvable.");
            return await onOk(add2eAttackFormAdapter(root));
          } catch (error) {
            console.error("[ADD2E][ATTAQUE][DIALOG][SUBMIT_ERROR]", error);
            ui.notifications?.error?.("Erreur lors de la résolution de l'attaque.");
            return false;
          }
        }
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "<i class='fas fa-times'></i>",
        callback: () => false
      }
    ],
    close: () => false
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

  const showBackstab = add2eAttackIsThiefOrAssassin(actor) && !!canUseBackstab;
  const showAssassination = add2eAttackIsAssassin(actor) && !!canUseAssassination;
  const hasRearSpecial = showBackstab || showAssassination;

  const allowedZones = new Set(["front", "flank", "rear-flank", "rear"]);
  const autoZone = allowedZones.has(String(backArcInfo?.zone ?? "")) ? String(backArcInfo.zone) : "front";
  const selected = zone => autoZone === zone ? " selected" : "";
  const rearHidden = autoZone === "rear" ? "" : " hidden";

  const rootStyle = "box-sizing:border-box;width:100%;max-width:640px;color:#24170a;font-family:inherit;";
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
  const optionsStyle = "display:flex;flex-direction:column;gap:4px;margin-top:6px;min-width:210px;overflow:visible;";
  const checkStyle = "display:flex;align-items:center;gap:6px;width:max-content;white-space:nowrap;font-size:.82rem;font-weight:900;color:#5a3510;line-height:1.15;";
  const checkInputStyle = "width:15px;height:15px;min-width:15px;margin:0;";

  return `
    <form class="add2e-attack-form" style="${rootStyle}">
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
        <div>
          <div style="${modifierBoxStyle}">
            <label for="add2e-bonus-attaque" style="${labelStyle}">Modificateurs</label>
            <input id="add2e-bonus-attaque" type="number" value="0" step="1" style="${inputStyle}">
          </div>
        </div>
        <div style="${boxStyle}">
          <label for="add2e-position-zone" style="${labelStyle}">Position</label>
          <select id="add2e-position-zone" style="${selectStyle}">
            <option value="front"${selected("front")}>Face</option>
            <option value="flank"${selected("flank")}>Flanc</option>
            <option value="rear-flank"${selected("rear-flank")}>Flanc arrière</option>
            <option value="rear"${selected("rear")}>Dos</option>
          </select>
          ${hasRearSpecial ? `<div style="${optionsStyle}">
            <div class="add2e-rear-specials"${rearHidden} style="display:flex;flex-direction:column;gap:4px;">
              ${showBackstab ? `<label style="${checkStyle}" title="Dos uniquement · +4 toucher · dégâts ×${backstabMultiplier}"><input type="checkbox" id="add2e-backstab" style="${checkInputStyle}"><span>Attaque sournoise</span></label>` : ""}
              ${showAssassination ? `<label style="${checkStyle}" title="Assassin uniquement · Dos uniquement · ${assassinationScore}% si l’attaque touche"><input type="checkbox" id="add2e-assassinat-confirm" style="${checkInputStyle}"><span>Assassinat</span></label>` : ""}
            </div>
          </div>` : ""}
        </div>
      </div>
    </form>`;
}

add2eInstallAttackDialogBindings();
