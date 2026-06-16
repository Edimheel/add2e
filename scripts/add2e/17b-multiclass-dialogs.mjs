// ADD2E — Multiclassage : DialogV2
// Version : 2026-06-16-multiclass-dialogs-class-minimum-tiles-v3

import { classItems, classSlug, esc, itemLabel, norm, systemRace } from "./17b-multiclass-core.mjs";
import { classRaceMaxLevel, monoClassOptionsForDroppedClass, raceCandidatesForClass, raceCompatibleForMulticlass, raceMatchesClassRules, raceAllowsClassSet, classPrerequisitesOk } from "./17b-multiclass-rules.mjs";

export async function dialogAlert(title, content, { classes = ["add2e-multiclass-alert"], okLabel = "OK" } = {}) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (DialogV2?.alert) return DialogV2.alert({ window: { title }, content, ok: { label: okLabel }, modal: true, classes });
  if (DialogV2?.wait) {
    return DialogV2.wait({
      classes,
      window: { title },
      content,
      buttons: [{ action: "ok", label: okLabel, default: true, callback: () => true }],
      modal: true,
      rejectClose: false,
      close: () => true
    });
  }
  ui.notifications.warn(String(content ?? "").replace(/<[^>]+>/g, " "));
  return false;
}

function installDialogButtonTheme() {
  if (document.getElementById("add2e-multiclass-button-theme-split")) return;
  const style = document.createElement("style");
  style.id = "add2e-multiclass-button-theme-split";
  style.textContent = `
.application.add2e-multiclass-dialog button[data-action="validate"]{background:linear-gradient(180deg,#2fa447,#176b2a)!important;border:1px solid #0d4b1b!important;color:#fff8df!important;font-weight:900!important;border-radius:10px!important}
.application.add2e-multiclass-dialog button[data-action="cancel"]{background:linear-gradient(180deg,#b94838,#711f17)!important;border:1px solid #55150f!important;color:#fff3ea!important;font-weight:900!important;border-radius:10px!important}
.application.add2e-multiclass-alert .window-content{background:linear-gradient(135deg,#fff8df,#ead49a)!important;color:#2b1c0d!important}
.application.add2e-multiclass-alert button[data-action="ok"],
.application.add2e-multiclass-alert button.default,
.application.add2e-multiclass-alert footer button{background:linear-gradient(180deg,#2fa447,#176b2a)!important;border:1px solid #0d4b1b!important;color:#fff8df!important;font-weight:900!important;border-radius:10px!important;min-width:96px!important}
.add2e-level-cap-dialog{display:grid;gap:10px;min-width:420px;max-width:560px;color:#2b1c0d;font-family:var(--font-primary, Signika, sans-serif)}
.add2e-level-cap-dialog .cap-head{border:1px solid #6f4515;border-radius:12px;background:linear-gradient(180deg,#4b2b0f,#1f1207);padding:10px 12px;color:#ffe39d;box-shadow:0 2px 8px rgba(0,0,0,.25)}
.add2e-level-cap-dialog .cap-head h2{margin:0;border:0;color:#ffe39d;font-size:1.08rem;text-transform:uppercase;letter-spacing:.04em}
.add2e-level-cap-dialog .cap-head p{margin:5px 0 0;color:#fff3cf;font-weight:700}
.add2e-level-cap-dialog .cap-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.add2e-level-cap-dialog .cap-card{border:1px solid #c59a3d;border-radius:10px;background:#fffaf0;padding:8px 10px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.55)}
.add2e-level-cap-dialog .cap-card span{display:block;color:#6b470f;font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
.add2e-level-cap-dialog .cap-card b{font-size:1.05rem;color:#2b1c0d}
.add2e-level-cap-dialog .cap-warning{border:1px solid #9d2d25;border-radius:10px;background:#ffe5df;color:#7b1f18;padding:9px 11px;font-weight:800}
`;
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

function sectionHtml(title, tiles) {
  if (!tiles.length) return "";
  return `<div style="display:grid;gap:6px;"><div style="font-weight:900;color:#5b3512;text-transform:uppercase;font-size:.78rem;letter-spacing:.04em;">${esc(title)}</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:7px;">${tiles.join("\n")}</div></div>`;
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

function add2eStatValue(actor, carac) {
  const sys = actor?.system ?? {};
  const raw = sys[`${carac}_base`] ?? sys[carac] ?? 10;
  const value = Number(raw?.value ?? raw?.total ?? raw);
  return Number.isFinite(value) ? value : 10;
}

function add2eCaracLabel(carac) {
  const labels = { force: "FOR", dexterite: "DEX", constitution: "CON", intelligence: "INT", sagesse: "SAG", charisme: "CHA" };
  return labels[norm(carac)] ?? String(carac ?? "").toUpperCase();
}

function add2eClassMinimumRows(actor, classData) {
  const mins = (classData?.system ?? {})?.caracs_min ?? {};
  return Object.entries(mins).map(([carac, rawMin]) => {
    const min = Number(rawMin);
    if (!Number.isFinite(min)) return null;
    const current = add2eStatValue(actor, carac);
    return { carac, current, min, ok: current >= min, manque: Math.max(0, min - current) };
  }).filter(Boolean);
}

function add2eMinimumTile(row) {
  const ok = row.ok;
  const border = ok ? "#2e6f1d" : "#9d2d25";
  const bg = ok ? "#e7f5df" : "#fff1c9";
  const valueColor = ok ? "#176034" : "#8a1f16";
  const status = ok ? "OK" : `+${row.manque} requis`;
  return `<div style="border:2px solid ${border};border-radius:12px;background:${bg};padding:9px 10px;display:grid;gap:4px;box-shadow:0 1px 4px rgba(0,0,0,.12);">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><strong style="font-size:1.05rem;color:#2b1c0d;">${esc(add2eCaracLabel(row.carac))}</strong><span style="font-weight:900;color:${valueColor};font-size:1.02rem;">${esc(row.current)} → ${esc(row.min)}</span></div>
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><span style="font-size:.76rem;font-weight:800;color:#6a4b16;">actuel ${esc(row.current)}</span><span style="font-size:.82rem;font-weight:900;color:${valueColor};">${esc(status)}</span></div>
  </div>`;
}

function add2eStatFailureBody(actor, droppedClassData, _currentRaceOrCompatibleAlternatives, _isAlreadyMulticlass) {
  const rows = add2eClassMinimumRows(actor, droppedClassData);
  if (!rows.length) return `<div style="padding:12px;border:1px solid #8f2a20;border-radius:10px;background:#f0c6b4;color:#6b1b12;font-weight:900;">Aucune option valide pour cette classe.</div>`;
  const missingRows = rows.filter(r => !r.ok);
  const tiles = rows.map(add2eMinimumTile).join("\n");
  const message = missingRows.length
    ? "Les caractéristiques de l’acteur ne remplissent pas les minimums de la classe déposée."
    : "Les minimums de caractéristiques sont remplis, mais aucune option valide n’a été trouvée.";
  return `<div style="display:grid;gap:8px;padding:12px;border:1px solid #9d6b18;border-radius:10px;background:#fff1c9;color:#5d3607;font-weight:800;">
    <p style="margin:0;"><strong>${esc(message)}</strong></p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:7px;">${tiles}</div>
  </div>`;
}

export async function showClassDropChoiceDialog(actor, droppedClassData, currentRaceOrCompatibleAlternatives) {
  const existingClasses = classItems(actor);
  const isAlreadyMulticlass = existingClasses.length > 1;
  const current = existingClasses.map(c => c.name).join(" / ") || actor.system?.classe || "Aucune";
  const raceName = itemLabel(systemRace(actor), "Race");
  const droppedName = itemLabel(droppedClassData, "Classe");

  const addOptions = isAlreadyMulticlass
    ? []
    : raceCandidatesForClass(actor, droppedClassData).map(raceData => ({ classData: droppedClassData, raceData }));
  const replacementOptions = isAlreadyMulticlass ? replacementOptionsForDroppedClass(actor, droppedClassData, currentRaceOrCompatibleAlternatives) : [];
  const monoOptions = monoClassOptionsForDroppedClass(actor, droppedClassData);

  let checked = false;
  const markChecked = () => {
    if (checked) return false;
    checked = true;
    return true;
  };

  const replacementTiles = replacementOptions.map((option, i) => tileHtml({
    value: `replace:${i}`,
    classesText: finalClassTextForReplace(actor, option),
    raceText: itemLabel(option.raceData, "Race"),
    checked: markChecked()
  }));
  const monoTiles = monoOptions.map((option, i) => tileHtml({
    value: `monoclass:${i}`,
    classesText: droppedName,
    raceText: itemLabel(option.raceData, "Race"),
    checked: markChecked()
  }));
  const addTiles = addOptions.map((option, i) => tileHtml({
    value: `multiclass:${i}`,
    classesText: finalClassTextForAdd(actor, option.classData),
    raceText: itemLabel(option.raceData, "Race"),
    checked: markChecked()
  }));

  const sections = [
    sectionHtml("Remplacer une classe du multiclassage", replacementTiles),
    sectionHtml("Passer en monoclasse", monoTiles),
    sectionHtml("Ajouter en multiclassage", addTiles)
  ].filter(Boolean).join("\n");

  const body = sections || add2eStatFailureBody(actor, droppedClassData, currentRaceOrCompatibleAlternatives, isAlreadyMulticlass);
  const hint = isAlreadyMulticlass
    ? "Ce personnage est déjà multiclassé : choisis soit une classe à remplacer, soit une bascule en monoclasse."
    : "Choisis une évolution : monoclasse ou multiclassage si la race le permet.";

  const content = `<div class="add2e-multiclass-choice" style="display:grid;gap:8px;min-width:580px;max-width:720px;color:#2b1c0d;"><div style="border:1px solid #5c3b12;border-radius:12px;background:linear-gradient(180deg,#3b2612,#1c1208);padding:8px 11px;"><h2 style="margin:0;color:#f9df9a;font-size:1rem;text-transform:uppercase;border:0;">Choisis ton évolution</h2><p style="margin:4px 0 0;color:#fff2c4;font-weight:800;">${esc(hint)}</p></div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;"><div><b>Classe actuelle</b><br>${esc(current)}</div><div><b>Classe déposée</b><br>${esc(droppedName)}</div><div><b>Race actuelle</b><br>${esc(raceName)}</div></div>${body}</div>`;
  const readChoice = (_event, button, dialog) => {
    const form = button?.form ?? dialog?.element?.querySelector?.("form") ?? document.querySelector?.(".add2e-multiclass-choice")?.closest?.("form");
    const raw = form?.elements?.add2eChoice?.value ?? dialog?.element?.querySelector?.('input[name="add2eChoice"]:checked')?.value ?? "cancel";
    if (raw.startsWith("monoclass:")) return { action: "monoclass", option: monoOptions[Number(raw.split(":")[1]) || 0] ?? null };
    if (raw.startsWith("multiclass:")) return { action: "multiclass", option: addOptions[Number(raw.split(":")[1]) || 0] ?? null };
    if (raw.startsWith("replace:")) return { action: "replace-class", option: replacementOptions[Number(raw.split(":")[1]) || 0] ?? null };
    return { action: "cancel" };
  };
  return dialogWait({ title: "ADD2E — Classe ou multiclassage", content, classes: ["add2e-multiclass-dialog"], buttons: [{ action: "validate", label: "Valider", default: true, callback: readChoice }, { action: "cancel", label: "Annuler", callback: () => ({ action: "cancel" }) }] });
}

export async function notifyLevelCap(actor, slug, requestedLevel, appliedLevel, payload) {
  if (!game.user?.isGM || !(Number(requestedLevel) > Number(appliedLevel))) return false;
  installDialogButtonTheme();
  const row = payload?.["system.classes"]?.find(cls => cls.slug === slug) ?? null;
  const className = row?.name ?? slug;
  const maxLevel = row?.levelMaxRace ?? appliedLevel;
  const raceName = itemLabel(systemRace(actor), "Race");
  const content = `
    <div class="add2e-level-cap-dialog">
      <div class="cap-head">
        <h2>Niveau maximum atteint</h2>
        <p>La limite raciale empêche cette progression.</p>
      </div>
      <div class="cap-grid">
        <div class="cap-card"><span>Classe</span><b>${esc(className)}</b></div>
        <div class="cap-card"><span>Race</span><b>${esc(raceName)}</b></div>
        <div class="cap-card"><span>Niveau demandé</span><b>${esc(requestedLevel)}</b></div>
        <div class="cap-card"><span>Niveau appliqué</span><b>${esc(appliedLevel)}</b></div>
      </div>
      <div class="cap-warning">${esc(className)} ne peut pas dépasser le niveau ${esc(maxLevel)} pour cette race.</div>
    </div>`;
  return dialogAlert("ADD2E — Niveau maximum atteint", content, { classes: ["add2e-multiclass-alert"], okLabel: "OK" });
}
