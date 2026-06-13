// ADD2E — Multiclassage : DialogV2
// Version : 2026-06-13-multiclass-dialogs-v1

import { classItems, classSlug, esc, itemLabel, norm, systemRace } from "./17b-multiclass-core.mjs";
import { classRaceMaxLevel, monoClassOptionsForDroppedClass, raceCandidatesForClass, raceCompatibleForMulticlass, raceMatchesClassRules, raceAllowsClassSet, classPrerequisitesOk } from "./17b-multiclass-rules.mjs";

export async function dialogAlert(title, content) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (DialogV2?.alert) return DialogV2.alert({ window: { title }, content, ok: { label: "Compris" }, modal: true });
  ui.notifications.warn(String(content ?? "").replace(/<[^>]+>/g, " "));
  return false;
}

function installDialogButtonTheme() {
  if (document.getElementById("add2e-multiclass-button-theme-split")) return;
  const style = document.createElement("style");
  style.id = "add2e-multiclass-button-theme-split";
  style.textContent = `.application.add2e-multiclass-dialog button[data-action="validate"]{background:linear-gradient(180deg,#2fa447,#176b2a)!important;border:1px solid #0d4b1b!important;color:#fff8df!important;font-weight:900!important;border-radius:10px!important}.application.add2e-multiclass-dialog button[data-action="cancel"]{background:linear-gradient(180deg,#b94838,#711f17)!important;border:1px solid #55150f!important;color:#fff3ea!important;font-weight:900!important;border-radius:10px!important}`;
  document.head.appendChild(style);
}

export async function dialogWait({ title, content, buttons, classes = [] }) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    await dialogAlert(title, `${content}<p><b>DialogV2.wait indisponible : action annulée.</b></p>`);
    return { action: "cancel" };
  }
  installDialogButtonTheme();
  return DialogV2.wait({ classes, window: { title }, content, buttons, modal: true, rejectClose: false, close: () => ({ action: "cancel" }) });
}

function racePalette(raceName) {
  const key = norm(raceName);
  const palettes = {
    humain: ["#10291c", "#9ee7a8", "#2f9e54", "#176034", "#0b3d20"],
    demi_elfe: ["#10253a", "#a7ddff", "#3d8ee6", "#1c5a9a", "#0c345d"],
    elfe: ["#12280f", "#c8f58b", "#64b83b", "#2e6f1d", "#183f10"],
    gnome: ["#2c1837", "#e2b6ff", "#a45bd8", "#67308c", "#3b1456"],
    nain: ["#2d2110", "#f1c77d", "#bd7834", "#744114", "#3d230b"],
    demi_orque: ["#2b1a0a", "#ffb25f", "#d45b1f", "#823113", "#451807"],
    halfelin: ["#2c2609", "#e7dd72", "#b69b2f", "#6d5b17", "#3b320c"]
  };
  return palettes[key] ?? ["#261500", "#f6e7a8", "#d7a94d", "#7b4300", "#3b2308"];
}

function tileHtml({ value, classesText, raceText, checked = false }) {
  const [color, bg1, bg2, border, selected] = racePalette(raceText);
  return `<label style="position:relative;display:grid;grid-template-columns:24px 1fr;gap:8px;align-items:center;min-height:58px;padding:8px 9px;border:2px solid ${border};border-radius:12px;background:linear-gradient(135deg,${bg1},${bg2});color:${color};cursor:pointer;"><input type="radio" name="add2eChoice" value="${esc(value)}" ${checked ? "checked" : ""} style="width:20px;height:20px;margin:0;accent-color:${selected};cursor:pointer;"><span style="display:grid;gap:1px;text-align:left;"><strong style="font-size:1rem;line-height:1.08;">${esc(classesText)}</strong><span style="font-size:.84rem;line-height:1.05;font-weight:900;text-transform:uppercase;letter-spacing:.04em;">${esc(raceText)}</span></span></label>`;
}

function replacementClassNames(actor, droppedClassData, replaceSlug) {
  return classItems(actor).filter(cls => classSlug(cls) !== replaceSlug).map(cls => cls.name).concat(itemLabel(droppedClassData, "Classe")).filter((name, index, arr) => arr.findIndex(other => norm(other) === norm(name)) === index);
}

function raceCompatibleForReplacement(actor, droppedClassData, replaceSlug, raceData) {
  const names = replacementClassNames(actor, droppedClassData, replaceSlug);
  if (names.map(norm).filter(Boolean).length <= 1) return true;
  return raceAllowsClassSet(raceData, names) && raceMatchesClassRules(raceData, droppedClassData) && classPrerequisitesOk(actor, droppedClassData, raceData, { notify: false });
}

export function replacementOptionsForDroppedClass(actor, droppedClassData, currentRaceOrCompatibleAlternatives) {
  const droppedSlug = classSlug(droppedClassData);
  const existing = classItems(actor).filter(cls => classSlug(cls) !== droppedSlug);
  const out = [];
  const seen = new Set();
  for (const replacedClass of existing) {
    const replaceSlug = classSlug(replacedClass);
    const raceChoices = currentRaceOrCompatibleAlternatives(actor, race => raceCompatibleForReplacement(actor, droppedClassData, replaceSlug, race));
    for (const raceData of raceChoices) {
      const raceKey = norm(itemLabel(raceData, "Race"));
      const key = `${replaceSlug}|${droppedSlug}|${raceKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ action: "replace-class", classData: droppedClassData, replacedClassId: replacedClass.id, replacedClassName: replacedClass.name, replacedClassSlug: replaceSlug, raceData, needsRaceChange: raceKey !== norm(itemLabel(systemRace(actor), "Race")), label: `Remplacer ${replacedClass.name} par ${itemLabel(droppedClassData, "Classe")} avec ${itemLabel(raceData, "Race")}` });
    }
  }
  return out;
}

function finalClassTextForAdd(actor, classData) {
  const slug = classSlug(classData);
  const names = classItems(actor).filter(c => classSlug(c) !== slug).map(c => c.name);
  names.push(itemLabel(classData, "Classe"));
  return names.filter((name, index, arr) => arr.findIndex(n => norm(n) === norm(name)) === index).join(" - ");
}

function finalClassTextForReplace(actor, option) {
  const names = classItems(actor).filter(c => c.id !== option.replacedClassId && classSlug(c) !== option.replacedClassSlug).map(c => c.name);
  names.push(itemLabel(option.classData, "Classe"));
  return names.filter((name, index, arr) => arr.findIndex(n => norm(n) === norm(name)) === index).join(" - ");
}

export async function showClassDropChoiceDialog(actor, droppedClassData, currentRaceOrCompatibleAlternatives) {
  const current = classItems(actor).map(c => c.name).join(" / ") || actor.system?.classe || "Aucune";
  const raceName = itemLabel(systemRace(actor), "Race");
  const droppedName = itemLabel(droppedClassData, "Classe");
  const options = raceCandidatesForClass(actor, droppedClassData).map(raceData => ({ classData: droppedClassData, raceData }));
  const replacementOptions = classItems(actor).length > 1 ? replacementOptionsForDroppedClass(actor, droppedClassData, currentRaceOrCompatibleAlternatives) : [];
  const monoOptions = monoClassOptionsForDroppedClass(actor, droppedClassData);
  const tiles = [];
  for (let i = 0; i < options.length; i++) tiles.push(tileHtml({ value: `multiclass:${i}`, classesText: finalClassTextForAdd(actor, options[i].classData), raceText: itemLabel(options[i].raceData, "Race"), checked: i === 0 }));
  for (let i = 0; i < replacementOptions.length; i++) tiles.push(tileHtml({ value: `replace:${i}`, classesText: finalClassTextForReplace(actor, replacementOptions[i]), raceText: itemLabel(replacementOptions[i].raceData, "Race"), checked: !tiles.length && i === 0 }));
  for (let i = 0; i < monoOptions.length; i++) tiles.push(tileHtml({ value: `monoclass:${i}`, classesText: droppedName, raceText: itemLabel(monoOptions[i].raceData, "Race"), checked: !tiles.length && i === 0 }));
  const body = tiles.length ? tiles.join("\n") : `<div style="padding:12px;border:1px solid #8f2a20;border-radius:10px;background:#f0c6b4;color:#6b1b12;font-weight:900;">Aucune option valide pour cette classe.</div>`;
  const content = `<div class="add2e-multiclass-choice" style="display:grid;gap:8px;min-width:580px;max-width:720px;color:#2b1c0d;"><div style="border:1px solid #5c3b12;border-radius:12px;background:linear-gradient(180deg,#3b2612,#1c1208);padding:8px 11px;"><h2 style="margin:0;color:#f9df9a;font-size:1rem;text-transform:uppercase;border:0;">Choisis ton évolution</h2></div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;"><div><b>Classe actuelle</b><br>${esc(current)}</div><div><b>Classe déposée</b><br>${esc(droppedName)}</div><div><b>Race actuelle</b><br>${esc(raceName)}</div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:7px;">${body}</div></div>`;
  const readChoice = (_event, button, dialog) => {
    const form = button?.form ?? dialog?.element?.querySelector?.("form") ?? document.querySelector?.(".add2e-multiclass-choice")?.closest?.("form");
    const raw = form?.elements?.add2eChoice?.value ?? dialog?.element?.querySelector?.('input[name="add2eChoice"]:checked')?.value ?? "cancel";
    if (raw.startsWith("monoclass:")) return { action: "monoclass", option: monoOptions[Number(raw.split(":")[1]) || 0] ?? null };
    if (raw.startsWith("multiclass:")) return { action: "multiclass", option: options[Number(raw.split(":")[1]) || 0] ?? null };
    if (raw.startsWith("replace:")) return { action: "replace-class", option: replacementOptions[Number(raw.split(":")[1]) || 0] ?? null };
    return { action: "cancel" };
  };
  return dialogWait({ title: "ADD2E — Classe ou multiclassage", content, classes: ["add2e-multiclass-dialog"], buttons: [{ action: "validate", label: "Valider", default: true, callback: readChoice }, { action: "cancel", label: "Annuler", callback: () => ({ action: "cancel" }) }] });
}

export async function notifyLevelCap(actor, slug, requestedLevel, appliedLevel, payload) {
  if (!game.user?.isGM || !(Number(requestedLevel) > Number(appliedLevel))) return false;
  const row = payload?.["system.classes"]?.find(cls => cls.slug === slug) ?? null;
  const className = row?.name ?? slug;
  const maxLevel = row?.levelMaxRace ?? appliedLevel;
  const raceName = itemLabel(systemRace(actor), "Race");
  return dialogAlert("ADD2E — Niveau maximum atteint", `<p><b>${esc(className)}</b> ne peut pas dépasser le niveau <b>${esc(maxLevel)}</b> pour la race <b>${esc(raceName)}</b>.</p><p>Le niveau demandé <b>${esc(requestedLevel)}</b> a été ramené à <b>${esc(appliedLevel)}</b>.</p>`);
}
