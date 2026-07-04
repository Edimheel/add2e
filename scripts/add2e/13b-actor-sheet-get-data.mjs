// ADD2E — Point d'entrée getData de la feuille ApplicationV2.
// Les comportements restent répartis en modules fonctionnels.

import "./13b-actor-sheet-get-data-core.mjs";

const ADD2E_THIEF_SHEET_BRIDGE_FLAG = "__ADD2E_THIEF_SHEET_BRIDGE_V4";
const ADD2E_THIEF_TWO_LINE_STYLE_ID = "add2e-thief-two-line-labels";
const ADD2E_THIEF_DIAG_CACHE = new Map();

function add2eNormalizeThiefRaceReference(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eActorRaceReferences(actor) {
  const storedRace = actor?.system?.race;
  const details = actor?.system?.details_race ?? {};
  const fromStored = storedRace && typeof storedRace === "object"
    ? [storedRace.id, storedRace._id, storedRace.uuid, storedRace.slug, storedRace.name, storedRace.nom, storedRace.label]
    : [storedRace];

  return [
    ...fromStored,
    actor?.system?.raceId,
    actor?.system?.race_id,
    details.id,
    details._id,
    details.slug,
    details.name,
    details.nom,
    details.label
  ].map(value => String(value ?? "").trim()).filter(Boolean);
}

function add2eThiefRaceItem(actor) {
  const races = Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "race");
  if (!races.length) return null;

  const references = add2eActorRaceReferences(actor);
  const byId = races.find(item => references.some(reference => [item.id, item.uuid].includes(reference)));
  if (byId) return byId;

  const referenceKeys = new Set(references.map(add2eNormalizeThiefRaceReference).filter(Boolean));
  const byIdentity = races.find(item => {
    const system = item?.system ?? {};
    const keys = [item?.name, system.slug, system.name, system.nom, system.label]
      .map(add2eNormalizeThiefRaceReference)
      .filter(Boolean);
    return keys.some(key => referenceKeys.has(key));
  });

  return byIdentity ?? races[0];
}

function add2eHasThiefRaceEntries(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

function add2eActiveRaceThiefAdjustments(actor) {
  const item = add2eThiefRaceItem(actor);
  const details = actor?.system?.details_race ?? {};
  const sources = [item?.system, details].filter(source => source && typeof source === "object");
  const keys = [
    "thief_adjustments",
    "thiefSkillAdjustments",
    "thief_bonuses",
    "thiefSkillBonuses",
    "bonus_competences_voleur",
    "bonus_competence_voleur"
  ];

  for (const source of sources) {
    for (const key of keys) {
      if (add2eHasThiefRaceEntries(source[key])) return source[key];
    }
    for (const key of keys) {
      if (add2eHasThiefRaceEntries(source.multiclassing?.[key])) return source.multiclassing[key];
    }
  }
  return null;
}

function add2eNormalizeThiefSkillKey(value) {
  try {
    const normalized = globalThis.add2eNormalizeThiefSkillKey?.(value);
    if (normalized) return String(normalized);
  } catch (_error) {}

  const raw = add2eNormalizeThiefRaceReference(value);
  return {
    pick_pockets: "pickpocket",
    pick_pocket: "pickpocket",
    open_locks: "crochetage_serrures",
    find_remove_traps: "detection_pieges",
    move_silently: "deplacement_silencieux",
    hide_in_shadows: "dissimulation",
    hear_noise: "ecoute",
    detect_noise: "ecoute",
    climb_walls: "escalade",
    backstab: "frappe_dans_le_dos",
    read_languages: "lecture_langues"
  }[raw] ?? raw;
}

function add2eReadThiefAdjustmentValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") return Number(value) || 0;
  if (value && typeof value === "object") return Number(value.value ?? value.bonus ?? value.mod ?? value.adjustment ?? value.valeur ?? value.malus ?? 0) || 0;
  return 0;
}

function add2eActiveRaceThiefBonus(map, skillKey) {
  if (!map) return 0;
  const wanted = add2eNormalizeThiefSkillKey(skillKey);
  const matches = rawKey => [wanted, "all", "toutes", "global", "*"].includes(add2eNormalizeThiefSkillKey(rawKey));
  let total = 0;

  if (Array.isArray(map)) {
    for (const entry of map) {
      if (!entry || typeof entry !== "object") continue;
      const key = entry.key ?? entry.skill ?? entry.competence ?? entry.compétence ?? entry.name ?? entry.label ?? entry.id ?? "all";
      if (matches(key)) total += add2eReadThiefAdjustmentValue(entry);
    }
    return total;
  }

  if (typeof map !== "object") return 0;
  for (const [key, value] of Object.entries(map)) {
    if (matches(key)) total += add2eReadThiefAdjustmentValue(value);
  }
  return total;
}

function add2eIsRaceThiefBonus(entry) {
  return /^race(?:\s|—|-|$)/i.test(String(entry?.label ?? "").trim());
}

function add2eSignedThiefPercent(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : ""}${number}%`;
}

function add2eApplyActiveRaceThiefAdjustments(actor, rows) {
  const map = add2eActiveRaceThiefAdjustments(actor);
  if (!Array.isArray(rows)) return [];

  return rows.map(row => {
    if (!row || row.type === "multiplier") return row;

    const inherited = Array.isArray(row.bonuses) ? row.bonuses : [];
    const inheritedRace = inherited.filter(add2eIsRaceThiefBonus);
    const bonuses = inherited.filter(entry => !add2eIsRaceThiefBonus(entry));
    const oldRaceTotal = inheritedRace.reduce((total, entry) => total + (Number(entry?.value) || 0), 0);
    const raceValue = add2eActiveRaceThiefBonus(map, row.key ?? row.label);
    if (raceValue !== 0) bonuses.push({ label: "Race", value: raceValue });

    const base = Number(row.base ?? 0) || 0;
    const oldFinal = Number(row.finalValue ?? row.value ?? base) || 0;
    const finalValue = Math.max(0, oldFinal - oldRaceTotal + raceValue);
    const bonusTotal = bonuses.reduce((total, entry) => total + (Number(entry?.value) || 0), 0);
    const breakdown = [`Base ${base}%`, ...bonuses.map(entry => `${entry.label} ${add2eSignedThiefPercent(entry.value)}`)];

    return {
      ...row,
      bonuses,
      bonusTotal,
      value: finalValue,
      finalValue,
      display: `${finalValue}%`,
      breakdownTitle: breakdown.join(" | ")
    };
  });
}

function add2eThiefRaceDiagnostic(actor) {
  const selected = add2eThiefRaceItem(actor);
  const allRaces = Array.from(actor?.items ?? [])
    .filter(item => String(item?.type ?? "").toLowerCase() === "race")
    .map(item => ({
      id: item.id,
      name: item.name,
      slug: item.system?.slug ?? "",
      thief_adjustments: item.system?.thief_adjustments ?? null
    }));

  return {
    actor: actor?.name ?? "",
    actorId: actor?.id ?? "",
    actorRaceReference: actor?.system?.race ?? "",
    selectedRace: selected?.name ?? "",
    selectedRaceId: selected?.id ?? "",
    selectedRaceSlug: selected?.system?.slug ?? "",
    thief_adjustments: add2eActiveRaceThiefAdjustments(actor),
    actorRaceItems: allRaces
  };
}

function add2eLogThiefRows(actor, rows) {
  if (globalThis.ADD2E_DEBUG_THIEF_RACIAL !== true) return;

  const source = add2eThiefRaceDiagnostic(actor);
  const view = rows.map(row => ({
    key: row?.key ?? "",
    base: row?.base ?? 0,
    bonusTotal: row?.bonusTotal ?? 0,
    bonuses: Array.isArray(row?.bonuses) ? row.bonuses.map(entry => `${entry?.label ?? "Bonus"} ${add2eSignedThiefPercent(entry?.value)}`).join(" | ") : "",
    finalValue: row?.finalValue ?? row?.value ?? 0
  }));
  const signature = JSON.stringify({ source, view });
  const cacheKey = String(actor?.uuid ?? actor?.id ?? source.selectedRace ?? "thief");
  if (ADD2E_THIEF_DIAG_CACHE.get(cacheKey) === signature) return;
  ADD2E_THIEF_DIAG_CACHE.set(cacheKey, signature);

  console.info("[ADD2E][THIEF_DIAG][SOURCE]", source);
  console.table(view);
}

function add2eCanonicalThiefRows(actor, originalSkills) {
  const rows = add2eApplyActiveRaceThiefAdjustments(actor, Array.from(originalSkills(actor) ?? []));
  add2eLogThiefRows(actor, rows);
  return rows;
}

function add2eEscapeThiefChat(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function add2eRollActiveRaceThiefSkill(actor, key, getSkills) {
  if (!actor) return ui.notifications.warn("Acteur introuvable."), false;
  const wanted = add2eNormalizeThiefSkillKey(key);
  const skill = getSkills(actor).find(entry => add2eNormalizeThiefSkillKey(entry?.key ?? entry?.label) === wanted) ?? null;
  if (!skill) return ui.notifications.warn("Compétence de voleur introuvable pour ce niveau."), false;
  if (skill.canRoll === false) return ui.notifications.info(`${skill.label} : ${skill.display}. Aucun jet automatique requis.`), false;

  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return ui.notifications.error("DialogV2 est indisponible."), false;

  const isPickpocket = skill.key === "pickpocket";
  const options = await DialogV2.wait({
    window: { title: `Jet de ${skill.label}` },
    content: `<form class="add2e-thief-roll-dialog"><div style="margin-bottom:.6em;"><b>${add2eEscapeThiefChat(skill.label)}</b><br><span>Score actuel : ${skill.display}</span></div><div style="margin-bottom:.6em;"><label>Modificateur situationnel</label><input type="number" name="mod" value="0" step="1" style="width:5em;"></div>${isPickpocket ? '<div style="margin-bottom:.6em;"><label>Niveau de la cible</label><input type="number" name="targetLevel" value="" min="0" step="1" style="width:5em;"><p style="margin:.3em 0 0;color:#666;font-size:.9em;">Pickpocket : −5 % par niveau de la cible au-dessus du niveau 3.</p></div>' : ""}</form>`,
    buttons: [
      { action: "roll", label: "Lancer", default: true, callback: (_event, button) => ({ mod: Number(button.form?.elements?.mod?.value ?? 0) || 0, targetLevel: Number(button.form?.elements?.targetLevel?.value ?? 0) || 0 }) },
      { action: "cancel", label: "Annuler", callback: () => null }
    ],
    rejectClose: false
  });
  if (!options) return false;

  const situational = Number(options.mod ?? 0) || 0;
  const targetLevel = Number(options.targetLevel ?? 0) || 0;
  const targetPenalty = isPickpocket && targetLevel > 3 ? -5 * (targetLevel - 3) : 0;
  const finalValue = Math.max(0, Number(skill.value ?? 0) + situational + targetPenalty);
  const roll = await new Roll("1d100").evaluate({ async: true });
  if (game.dice3d) await game.dice3d.showForRoll(roll);

  const success = roll.total <= finalValue;
  const color = success ? "#1f8f4d" : "#b3261e";
  const details = [{ label: "Base", value: skill.base }, ...(skill.bonuses ?? []), ...(situational ? [{ label: "Situation", value: situational }] : []), ...(targetPenalty ? [{ label: `Cible niveau ${targetLevel}`, value: targetPenalty }] : [])];
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="add2e-card-test" style="border-radius:12px;border:1px solid ${color};background:#fffdf6;padding:.75em 1em;font-family:var(--font-primary);"><b style="color:${color};font-size:1.12em;">${add2eEscapeThiefChat(skill.label)}</b><div>Score final : <b>${finalValue}%</b> — Jet : <b>${roll.total}</b></div><div style="font-size:.9em;color:#555;margin-top:.35em;">${details.map(entry => `${add2eEscapeThiefChat(entry.label)} ${add2eSignedThiefPercent(entry.value)}`).join(" ; ")}</div><div style="margin-top:.35em;font-weight:800;color:${color};">${success ? "Réussite" : "Échec"}</div></div>`
  });
  return true;
}

function add2eInstallThiefSheetBridge() {
  const originalSkills = globalThis.add2eGetActorThiefSkills;
  if (typeof originalSkills !== "function") return;

  const synchronizedSkills = actor => add2eCanonicalThiefRows(actor, originalSkills);
  globalThis.add2eGetActorThiefSkills = synchronizedSkills;
  globalThis.add2eGetActorThiefSkillTable = actor => synchronizedSkills(actor);
  globalThis.add2eRollThiefSkill = (actor, key) => add2eRollActiveRaceThiefSkill(actor, key, synchronizedSkills);
}

function add2eInstallThiefTwoLineLabels() {
  document.getElementById(ADD2E_THIEF_TWO_LINE_STYLE_ID)?.remove();

  const style = document.createElement("style");
  style.id = ADD2E_THIEF_TWO_LINE_STYLE_ID;
  style.textContent = `
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-card,
    .add2e-character-v2-app .add2e-character-v3 button.a2e-thief-skill-card,
    .add2e-character-v3 .a2e-thief-skill-card,
    .add2e-character-v3 button.a2e-thief-skill-card { grid-template-rows:32px 18px 18px !important; min-height:88px !important; }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-name,
    .add2e-character-v3 .a2e-thief-skill-name { font-size:.70em !important; line-height:1.05 !important; white-space:normal !important; overflow:visible !important; text-overflow:clip !important; overflow-wrap:anywhere !important; }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-total,
    .add2e-character-v3 .a2e-thief-skill-total { font-size:1.02em !important; }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-detail,
    .add2e-character-v3 .a2e-thief-skill-detail { font-size:.66em !important; }
  `;
  document.head.appendChild(style);
}

function add2eBootThiefSheetBridge() {
  if (globalThis[ADD2E_THIEF_SHEET_BRIDGE_FLAG]) return;
  globalThis[ADD2E_THIEF_SHEET_BRIDGE_FLAG] = true;
  globalThis.ADD2E_DEBUG_THIEF_RACIAL ??= true;

  add2eInstallThiefSheetBridge();
  add2eInstallThiefTwoLineLabels();
  for (const delay of [50, 180]) window.setTimeout(add2eInstallThiefTwoLineLabels, delay);
  Hooks.on("renderActorSheet", () => {
    for (const delay of [0, 60, 180]) window.setTimeout(add2eInstallThiefTwoLineLabels, delay);
  });
}

if (game?.ready) add2eBootThiefSheetBridge();
else Hooks.once("ready", add2eBootThiefSheetBridge);
