// ADD2E — Actor sheet getData : orchestrateur ApplicationV2.

import { add2ePrepareActorSheetBaseData } from "./13b-actor-sheet-get-data-base.mjs";
import { add2ePrepareActorSheetCombatData } from "./13b-actor-sheet-get-data-combat.mjs";
import { add2ePopulateActorSheetSpellData } from "./13b-actor-sheet-get-data-spells.mjs";

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant getData.");

const ADD2E_THIEF_RACIAL_SYNC_FLAG = "__ADD2E_THIEF_RACIAL_SYNC_V2";
const ADD2E_THIEF_TWO_LINE_STYLE_ID = "add2e-thief-two-line-labels";

function add2eThiefNormalizeSkillKey(value) {
  try {
    const normalized = globalThis.add2eNormalizeThiefSkillKey?.(value);
    if (normalized) return String(normalized);
  } catch (_error) {}

  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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

function add2eThiefHasEntries(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

function add2eThiefRaceSystemSources(actor) {
  const raceItem = Array.from(actor?.items ?? []).find(item => String(item?.type ?? "").toLowerCase() === "race") ?? null;
  return [raceItem?.system, actor?.system?.details_race].filter(source => source && typeof source === "object");
}

function add2eGetAuthoritativeThiefRaceAdjustments(actor) {
  const nestedKeys = ["thief_adjustments", "thiefSkillAdjustments", "thief_bonuses", "thiefSkillBonuses"];
  const directKeys = ["thief_adjustments", "thiefSkillAdjustments", "thief_bonuses", "thiefSkillBonuses", "bonus_competences_voleur", "bonus_competence_voleur"];

  for (const source of add2eThiefRaceSystemSources(actor)) {
    const multiclassing = source.multiclassing;
    for (const key of nestedKeys) {
      if (add2eThiefHasEntries(multiclassing?.[key])) return multiclassing[key];
    }
  }

  for (const source of add2eThiefRaceSystemSources(actor)) {
    for (const key of directKeys) {
      if (add2eThiefHasEntries(source?.[key])) return source[key];
    }
  }

  return null;
}

function add2eThiefReadBonusValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") return Number(value) || 0;
  if (value && typeof value === "object") {
    return Number(value.value ?? value.bonus ?? value.mod ?? value.adjustment ?? value.valeur ?? value.malus ?? 0) || 0;
  }
  return 0;
}

function add2eThiefMapBonus(map, skillKey) {
  if (!map) return 0;
  const wanted = add2eThiefNormalizeSkillKey(skillKey);
  const accepts = rawKey => [wanted, "all", "toutes", "global", "*"].includes(add2eThiefNormalizeSkillKey(rawKey));
  let total = 0;

  if (Array.isArray(map)) {
    for (const entry of map) {
      if (!entry) continue;
      if (typeof entry === "object") {
        const rawKey = entry.key ?? entry.skill ?? entry.competence ?? entry.compétence ?? entry.name ?? entry.label ?? entry.id ?? "all";
        if (accepts(rawKey)) total += add2eThiefReadBonusValue(entry);
      }
    }
    return total;
  }

  if (typeof map !== "object") return 0;
  for (const [rawKey, rawValue] of Object.entries(map)) {
    if (accepts(rawKey)) total += add2eThiefReadBonusValue(rawValue);
  }
  return total;
}

function add2eThiefSigned(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : ""}${number}`;
}

function add2eIsRacialThiefBonus(entry) {
  return /^race(?:\s|—|-|$)/i.test(String(entry?.label ?? "").trim());
}

function add2eApplyAuthoritativeThiefRaceAdjustments(actor, rows) {
  const map = add2eGetAuthoritativeThiefRaceAdjustments(actor);
  if (!map || !Array.isArray(rows)) return rows;

  return rows.map(row => {
    if (!row || row.type === "multiplier") return row;

    const key = add2eThiefNormalizeSkillKey(row.key ?? row.label);
    const priorBonuses = Array.isArray(row.bonuses) ? row.bonuses : [];
    const inheritedRace = priorBonuses.filter(add2eIsRacialThiefBonus);
    const bonuses = priorBonuses.filter(entry => !add2eIsRacialThiefBonus(entry));
    const oldRaceTotal = inheritedRace.reduce((total, entry) => total + (Number(entry?.value) || 0), 0);
    const racialValue = add2eThiefMapBonus(map, key);
    if (racialValue !== 0) bonuses.push({ label: "Race", value: racialValue });

    const base = Number(row.base ?? 0) || 0;
    const oldFinal = Number(row.finalValue ?? row.value ?? base) || 0;
    const finalValue = Math.max(0, oldFinal - oldRaceTotal + racialValue);
    const bonusTotal = bonuses.reduce((total, entry) => total + (Number(entry?.value) || 0), 0);
    const breakdownTitle = [
      `Base ${base}%`,
      ...bonuses.map(entry => `${entry.label} ${add2eThiefSigned(entry.value)}%`)
    ].join(" | ");

    return {
      ...row,
      bonuses,
      bonusTotal,
      value: finalValue,
      finalValue,
      display: `${finalValue}%`,
      breakdownTitle
    };
  });
}

function add2eEscapeChat(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eInstallThiefRacialSynchronization() {
  if (globalThis[ADD2E_THIEF_RACIAL_SYNC_FLAG]) return;

  const originalSkills = globalThis.add2eGetActorThiefSkills;
  if (typeof originalSkills !== "function") return;

  globalThis[ADD2E_THIEF_RACIAL_SYNC_FLAG] = true;
  const synchronizedSkills = (actor, ...args) => add2eApplyAuthoritativeThiefRaceAdjustments(actor, originalSkills(actor, ...args));
  synchronizedSkills.__add2eThiefRacialSync = true;
  globalThis.add2eGetActorThiefSkills = synchronizedSkills;

  const originalTable = globalThis.add2eGetActorThiefSkillTable;
  if (typeof originalTable === "function") {
    globalThis.add2eGetActorThiefSkillTable = actor => synchronizedSkills(actor) ?? originalTable(actor);
  }

  const promptModifiers = globalThis.add2ePromptThiefSkillModifiers;
  if (typeof promptModifiers !== "function") return;

  globalThis.add2eRollThiefSkill = async function add2eRollThiefSkillWithRacialAdjustments(actor, key) {
    if (!actor) return ui.notifications.warn("Acteur introuvable."), false;

    const wanted = add2eThiefNormalizeSkillKey(key);
    const skill = synchronizedSkills(actor).find(entry => add2eThiefNormalizeSkillKey(entry?.key ?? entry?.label) === wanted) ?? null;
    if (!skill) return ui.notifications.warn("Compétence de voleur introuvable pour ce niveau."), false;
    if (skill.canRoll === false) return ui.notifications.info(`${skill.label} : ${skill.display}. Aucun jet automatique requis.`), false;

    const options = await promptModifiers(actor, skill);
    if (!options) return false;

    const situational = Number(options.mod || 0) || 0;
    const targetLevel = Number(options.targetLevel || 0) || 0;
    const targetPenalty = skill.key === "pickpocket" && targetLevel > 3 ? -5 * (targetLevel - 3) : 0;
    const finalValue = Math.max(0, Number(skill.value || 0) + situational + targetPenalty);
    const roll = await new Roll("1d100").evaluate({ async: true });
    if (game.dice3d) await game.dice3d.showForRoll(roll);

    const success = roll.total <= finalValue;
    const noticed = skill.key === "pickpocket" && roll.total >= finalValue + 21;
    const isAssassination = skill.key === "assassinat";
    const color = success ? "#1f8f4d" : "#b3261e";
    const details = [
      { label: "Base", value: skill.base },
      ...(skill.bonuses ?? []),
      ...(situational !== 0 ? [{ label: "Situation", value: situational }] : []),
      ...(targetPenalty !== 0 ? [{ label: `Cible niveau ${targetLevel}`, value: targetPenalty }] : [])
    ];
    const detailText = details.map(entry => `${add2eEscapeChat(entry.label)} ${add2eThiefSigned(entry.value)}%`).join(" ; ");

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="add2e-card-test" style="border-radius:12px;border:1px solid ${color};background:#fffdf6;padding:.75em 1em;font-family:var(--font-primary);"><div style="display:flex;align-items:center;gap:.6em;margin-bottom:.4em;"><i class="fas fa-mask" style="color:${color};font-size:1.5em;"></i><b style="color:${color};font-size:1.12em;">${add2eEscapeChat(skill.label)}</b><span style="margin-left:auto;color:#666;">${isAssassination ? "Compétence d’assassin" : "Compétence de voleur"}</span></div><div>Score final : <b>${finalValue}%</b> — Jet : <b>${roll.total}</b></div><div style="font-size:.9em;color:#555;margin-top:.35em;">${detailText}</div><div style="margin-top:.35em;font-weight:800;color:${color};">${success ? "Réussite" : "Échec"}</div>${isAssassination && success ? "<div style=\"margin-top:.25em;color:#1f8f4d;font-weight:700;\">Assassinat réussi : effet létal à appliquer selon les conditions de scène et l’arbitrage du MJ.</div>" : ""}${isAssassination && !success ? "<div style=\"margin-top:.25em;color:#b3261e;font-weight:700;\">Assassinat manqué.</div>" : ""}${noticed ? "<div style=\"margin-top:.25em;color:#b3261e;font-weight:700;\">La victime remarque la tentative de pickpocket.</div>" : ""}</div>`
    });
    return true;
  };
}

function add2eInstallThiefTwoLineLabels() {
  document.getElementById(ADD2E_THIEF_TWO_LINE_STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = ADD2E_THIEF_TWO_LINE_STYLE_ID;
  style.textContent = `
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-card,
    .add2e-character-v2-app .add2e-character-v3 button.a2e-thief-skill-card,
    .add2e-character-v3 .a2e-thief-skill-card,
    .add2e-character-v3 button.a2e-thief-skill-card {
      grid-template-rows:30px 18px 18px !important;
      min-height:88px !important;
    }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-name,
    .add2e-character-v3 .a2e-thief-skill-name {
      font-size:.72em !important;
      line-height:1.05 !important;
      white-space:normal !important;
      overflow:visible !important;
      text-overflow:clip !important;
      overflow-wrap:anywhere !important;
    }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-total,
    .add2e-character-v3 .a2e-thief-skill-total { font-size:1.02em !important; }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-detail,
    .add2e-character-v3 .a2e-thief-skill-detail { font-size:.66em !important; }
  `;
  document.head.appendChild(style);
}

function add2eBootThiefSheetSynchronization() {
  add2eInstallThiefRacialSynchronization();
  window.setTimeout(add2eInstallThiefTwoLineLabels, 0);
}

if (game?.ready) add2eBootThiefSheetSynchronization();
else Hooks.once("ready", add2eBootThiefSheetSynchronization);

globalThis.Add2eActorSheet.prototype.getData = async function getData() {
  const data = this._add2eNativeGetData();
  const state = add2ePrepareActorSheetBaseData({ sheet: this, data });

  add2ePrepareActorSheetCombatData({
    actor: state.actor,
    data,
    sys: state.sys,
    progressionCourante: state.progressionCourante,
    isMonk: state.isMonk
  });

  add2ePopulateActorSheetSpellData({ actor: state.actor, data, items: state.items });

  data.activeEffectsList = this.actor.effects.map(eff => {
    let desc = eff.getFlag("core", "description") || eff.flags?.add2e?.desc || eff.description || "";
    if (!desc && eff.flags?.add2e?.tags) desc = "<small>" + eff.flags.add2e.tags.join(", ") + "</small>";
    let durationStr = "";
    if (typeof eff.duration?.remaining !== "undefined") durationStr = `${eff.duration.remaining} rounds`;
    else if (typeof eff.duration?.rounds !== "undefined") durationStr = `${eff.duration.rounds} rounds`;
    else if (typeof eff.duration?.seconds !== "undefined") durationStr = `${eff.duration.seconds} sec`;
    return { id: eff.id, name: eff.name || "", img: eff.img || "icons/svg/aura.svg", description: desc, duration: durationStr, sourceName: eff.parent?.name || eff.origin || "" };
  });

  data.alignementsDisponibles = (state.sys.alignements_autorises && Array.isArray(state.sys.alignements_autorises)) ? state.sys.alignements_autorises : [];
  data.activeTab = this._add2eGetNativeActiveTab?.() || this._add2eActiveTab || this._add2eReadStoredTab?.() || "resume";
  return data;
};
