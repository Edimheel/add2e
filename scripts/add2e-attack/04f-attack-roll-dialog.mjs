// scripts/add2e-attack/04f-attack-roll-dialog.mjs
// ADD2E — Dialogue d'attaque ApplicationV2 / DialogV2.
// Compatible Foundry V13/V14/V15.

const ADD2E_ATTACK_DIALOG_VERSION = "2026-06-24-mixed-weapon-explicit-tags-v5";
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
    .replace(/"/g, "&quot;")
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

function add2eAttackArray(value) {
  if (Array.isArray(value)) return value.flatMap(add2eAttackArray).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  return value === null || value === undefined || value === "" ? [] : [value];
}

function add2eAttackUsageTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, "_")
    .replace(/^usage_/, "usage:");
}

/**
 * La fenêtre ne déduit rien : elle lit uniquement les tags explicites de l'objet.
 * Une arme mixte doit donc porter usage:contact et usage:lancer dans son JSON.
 */
function add2eAttackExplicitUsageTags(weapon) {
  const system = weapon?.system ?? {};
  const direct = globalThis.add2eGetItemEquipTags?.(weapon);
  return new Set([
    ...add2eAttackArray(direct),
    ...add2eAttackArray(system.tags),
    ...add2eAttackArray(system.effectTags),
    ...add2eAttackArray(system.effecttags),
    ...add2eAttackArray(weapon?.flags?.add2e?.tags)
  ].map(add2eAttackUsageTag).filter(Boolean));
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

function add2eAttackEmbeddedClassNames(actor) {
  const names = new Set(add2eAttackClassNames(actor));
  for (const item of actor?.items ?? []) {
    if (String(item?.type ?? "").toLowerCase() !== "classe") continue;
    const system = item.system ?? {};
    for (const value of [item.name, system.label, system.name, system.nom, system.classe, system.slug]) {
      const name = add2eAttackNormalizeText(value);
      if (name) names.add(name);
    }
  }
  return [...names];
}

function add2eAttackIsThiefOrAssassin(actor) {
  return add2eAttackEmbeddedClassNames(actor).some(name => name.includes("voleur") || name.includes("assassin"));
}

function add2eAttackIsAssassin(actor) {
  return add2eAttackEmbeddedClassNames(actor).some(name => name.includes("assassin"));
}

function add2eAttackIsBackstabKey(value) {
  const key = add2eAttackNormalizeText(value);
  return key === "frappe_dans_le_dos" ||
    key === "attaque_dans_le_dos" ||
    key === "attaque_sournoise" ||
    key === "backstab" ||
    key === "sneak_attack" ||
    (key.includes("dos") && (key.includes("frappe") || key.includes("attaque"))) ||
    (key.includes("sournoise") && key.includes("attaque"));
}

function add2eAttackFindThiefClassItem(actor) {
  return [...(actor?.items ?? [])].find(item => {
    if (String(item?.type ?? "").toLowerCase() !== "classe") return false;
    const system = item.system ?? {};
    return [item.name, system.label, system.name, system.nom, system.classe, system.slug]
      .map(add2eAttackNormalizeText)
      .some(name => name.includes("voleur") || name.includes("assassin"));
  }) ?? null;
}

function add2eAttackClassLevel(actor, classItem) {
  const levels = actor?.system?.niveaux_par_classe ?? {};
  const system = classItem?.system ?? {};
  const keys = [classItem?.name, system.label, system.name, system.nom, system.classe, system.slug]
    .map(add2eAttackNormalizeText)
    .filter(Boolean);

  for (const key of keys) {
    if (levels[key] !== undefined && levels[key] !== null && levels[key] !== "") {
      return Math.max(1, Number(levels[key]) || 1);
    }
  }
  for (const [key, value] of Object.entries(levels)) {
    if (keys.includes(add2eAttackNormalizeText(key))) return Math.max(1, Number(value) || 1);
  }
  return Math.max(1, Number(classItem?.system?.niveau ?? classItem?.system?.level ?? actor?.system?.niveau ?? 1) || 1);
}

function add2eAttackGetEmbeddedBackstabSkill(actor) {
  const classItem = add2eAttackFindThiefClassItem(actor);
  if (!classItem) return null;

  const system = classItem.system ?? {};
  const level = add2eAttackClassLevel(actor, classItem);
  const progression = Array.isArray(system.progression) ? system.progression : [];
  const row = progression.find((entry, index) => Number(entry?.niveau ?? entry?.level ?? index + 1) === level) ?? null;
  if (!row) return null;

  const labels = Array.isArray(system.skillLabels)
    ? system.skillLabels
    : Array.isArray(system.thiefSkillOrder) ? system.thiefSkillOrder : [];
  const values = Array.isArray(row.skills) ? row.skills : [];
  const index = labels.findIndex(add2eAttackIsBackstabKey);
  const structured = row.thiefSkills && typeof row.thiefSkills === "object" ? row.thiefSkills : {};

  let rawValue = index >= 0 ? values[index] : undefined;
  let label = index >= 0 ? labels[index] : "Frappe dans le dos";

  if (rawValue === undefined) {
    for (const [key, value] of Object.entries(structured)) {
      if (!add2eAttackIsBackstabKey(key)) continue;
      rawValue = value;
      label = key;
      break;
    }
  }
  if (rawValue === undefined) {
    for (const key of ["backstabMultiplier", "backstab_multiplier", "frappeDansLeDos", "frappe_dans_le_dos", "attaqueDansLeDos", "attaque_dans_le_dos", "attaqueSournoise", "attaque_sournoise"]) {
      if (row[key] === undefined) continue;
      rawValue = row[key];
      break;
    }
  }

  const multiplier = Number(rawValue) || 0;
  if (multiplier <= 1) return null;
  return {
    key: "frappe_dans_le_dos",
    label: String(label || "Frappe dans le dos"),
    base: multiplier,
    value: multiplier,
    finalValue: multiplier,
    display: `×${multiplier}`,
    type: "multiplier",
    canRoll: false,
    sourceClass: classItem.name,
    sourceClassLevel: level
  };
}

function add2eInstallMulticlassBackstabSkillBridge() {
  const resolver = globalThis.add2eGetActorThiefSkills;
  if (typeof resolver !== "function" || resolver.__add2eMulticlassBackstabBridge === true) return false;

  const bridged = function add2eGetActorThiefSkillsWithEmbeddedBackstab(actor, ...args) {
    const rows = Array.isArray(resolver.call(this, actor, ...args)) ? resolver.call(this, actor, ...args) : [];
    const embeddedBackstab = add2eAttackGetEmbeddedBackstabSkill(actor);
    if (!embeddedBackstab) return rows;
    return [...rows.filter(row => !add2eAttackIsBackstabKey(row?.key ?? row?.label)), embeddedBackstab];
  };

  bridged.__add2eMulticlassBackstabBridge = true;
  bridged.__add2eMulticlassBackstabOriginal = resolver;
  globalThis.add2eGetActorThiefSkills = bridged;
  return true;
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

function add2eApplyWeaponMode(root) {
  const container = add2eAttackRoot(root) ?? root;
  const checkbox = container?.querySelector?.("#add2e-weapon-throw");
  if (!container || !checkbox) return false;

  globalThis.add2eSetTransientWeaponAttackMode?.(
    container.dataset?.add2eActorId,
    container.dataset?.add2eWeaponId,
    checkbox.checked ? "throw" : "contact"
  );
  return true;
}

function add2eForceDialogSize(appOrElement) {
  const element = appOrElement?.element ?? appOrElement ?? null;
  for (const root of new Set([element, element?.closest?.("dialog"), element?.closest?.(".application")].filter(Boolean))) {
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
      if (!root) return false;

      const position = root.querySelector("#add2e-position-zone");
      if (position && position.dataset.add2eRearBound !== "1") {
        position.dataset.add2eRearBound = "1";
        position.addEventListener("change", () => add2eApplyRearOptions(root));
        position.addEventListener("input", () => add2eApplyRearOptions(root));
      }

      const throwCheckbox = root.querySelector("#add2e-weapon-throw");
      if (throwCheckbox && throwCheckbox.dataset.add2eWeaponModeBound !== "1") {
        throwCheckbox.dataset.add2eWeaponModeBound = "1";
        throwCheckbox.addEventListener("change", () => add2eApplyWeaponMode(root));
        throwCheckbox.addEventListener("input", () => add2eApplyWeaponMode(root));
      }

      add2eApplyRearOptions(root);
      add2eApplyWeaponMode(root);
      return true;
    }
  };
}

export async function add2eAttackOpenDialogV2({ title, content, width, classes, defaultAction, onOk }) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications?.error?.("DialogV2 est indisponible pour lancer l'attaque.");
    return false;
  }

  const Add2eAttackDialogV2 = add2eCreateAttackDialogV2Class(DialogV2);
  const dialogClasses = Array.from(new Set([...(classes ?? []), "add2e-attack-dialog-compact"]));

  return new Promise(resolve => {
    let settled = false;
    let submitting = false;
    const finish = value => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
      return value;
    };

    const dialog = new Add2eAttackDialogV2({
      window: { title },
      classes: dialogClasses,
      position: { width: width ?? ADD2E_ATTACK_DIALOG_WIDTH, height: "auto" },
      content,
      buttons: [
        {
          action: "ok",
          label: "Lancer l'attaque",
          default: defaultAction === "ok",
          callback: async (_event, button, dlg) => {
            if (submitting) return false;
            submitting = true;
            try {
              const root = button?.form?.querySelector?.(".add2e-attack-form")
                ?? add2eAttackRoot(dlg)
                ?? document.querySelector(".add2e-attack-form");
              add2eApplyWeaponMode(root);
              return finish(await onOk(add2eAttackFormAdapter(root)));
            } catch (error) {
              console.error("[ADD2E][ATTAQUE][DIALOG][SUBMIT_ERROR]", error);
              ui.notifications?.error?.("Erreur lors de la résolution de l'attaque.");
              return finish(false);
            }
          }
        },
        { action: "cancel", label: "Annuler", callback: () => finish(false) }
      ],
      default: defaultAction ?? "ok"
    });

    dialog.addEventListener?.("close", () => {
      if (!submitting) finish(false);
    }, { once: true });

    Promise.resolve(dialog.render({ force: true })).then(() => dialog.add2eBindAttackDialog?.());
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

  const usageTags = add2eAttackExplicitUsageTags(arme);
  const showWeaponThrow = usageTags.has("usage:contact") && usageTags.has("usage:lancer");

  const showBackstab = add2eAttackIsThiefOrAssassin(actor) && !!canUseBackstab;
  const showAssassination = add2eAttackIsAssassin(actor) && !!canUseAssassination;
  const hasRearSpecial = showBackstab || showAssassination;

  const allowedZones = new Set(["front", "flank", "rear-flank", "rear"]);
  const autoZone = allowedZones.has(String(backArcInfo?.zone ?? "")) ? String(backArcInfo.zone) : "front";
  const selected = zone => autoZone === zone ? " selected" : "";
  const rearHidden = autoZone === "rear" ? "" : " hidden";

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
  const optionsStyle = "display:flex;flex-direction:column;gap:4px;margin-top:6px;min-width:210px;overflow:visible;";
  const checkStyle = "display:flex;align-items:center;gap:6px;width:max-content;white-space:nowrap;font-size:.82rem;font-weight:900;color:#5a3510;line-height:1.15;";
  const checkInputStyle = "width:15px;height:15px;min-width:15px;margin:0;";

  const throwOption = showWeaponThrow
    ? `<label style="${checkStyle}" title="Décoché : attaque au contact, sans consommation. Coché : l'arme est lancée et une unité est consommée après l'attaque."><input type="checkbox" id="add2e-weapon-throw" style="${checkInputStyle}"><span>Lancer l'arme</span></label>`
    : "";

  return `
    <div class="add2e-attack-form" data-add2e-actor-id="${add2eAttackEscapeHtml(actor?.id ?? "")}" data-add2e-weapon-id="${add2eAttackEscapeHtml(arme?.id ?? "")}" style="${rootStyle}">
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
          ${(showWeaponThrow || hasRearSpecial) ? `<div style="${optionsStyle}">
            ${throwOption}
            ${hasRearSpecial ? `<div class="add2e-rear-specials"${rearHidden} style="display:flex;flex-direction:column;gap:4px;">
              ${showBackstab ? `<label style="${checkStyle}" title="Dos uniquement · +4 toucher · dégâts ×${backstabMultiplier}"><input type="checkbox" id="add2e-backstab" style="${checkInputStyle}"><span>Attaque sournoise</span></label>` : ""}
              ${showAssassination ? `<label style="${checkStyle}" title="Assassin uniquement · Dos uniquement · ${assassinationScore}% si l’attaque touche"><input type="checkbox" id="add2e-assassinat-confirm" style="${checkInputStyle}"><span>Assassinat</span></label>` : ""}
            </div>` : ""}
          </div>` : ""}
        </div>
      </div>
    </div>`;
}

if (game?.ready) setTimeout(add2eInstallMulticlassBackstabSkillBridge, 0);
else Hooks.once("ready", () => setTimeout(add2eInstallMulticlassBackstabSkillBridge, 0));