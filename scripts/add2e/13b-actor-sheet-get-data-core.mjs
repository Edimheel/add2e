// ADD2E — Actor sheet getData : orchestrateur ApplicationV2.

import { add2ePrepareActorSheetBaseData } from "./13b-actor-sheet-get-data-base.mjs";
import { add2ePrepareActorSheetCombatData } from "./13b-actor-sheet-get-data-combat.mjs";
import { add2ePopulateActorSheetSpellData } from "./13b-actor-sheet-get-data-spells.mjs";

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant getData.");

const ADD2E_FORCE_EX_DIAGNOSTICS_VERSION = "2026-07-05-force-ex-selection-diagnostics-v2";

function add2eExceptionalStrengthValue(rawValue) {
  const value = Math.trunc(Number(rawValue));
  return Number.isFinite(value) && value >= 1 && value <= 100 ? value : 0;
}

function add2eExceptionalStrengthValues(currentValue = 0) {
  const selectedValue = add2eExceptionalStrengthValue(currentValue);
  return Array.from({ length: 100 }, (_unused, index) => {
    const value = index + 1;
    return {
      value,
      label: value === 100 ? "00" : String(value).padStart(2, "0"),
      selected: value === selectedValue
    };
  });
}

function add2eExceptionalStrengthTableKey(totalForce, forceEx, allowed) {
  if (Number(totalForce) !== 18 || !allowed) return Number(totalForce) || 0;
  if (forceEx >= 1 && forceEx <= 50) return "18/01-50";
  if (forceEx >= 51 && forceEx <= 75) return "18/51-75";
  if (forceEx >= 76 && forceEx <= 90) return "18/76-90";
  if (forceEx >= 91 && forceEx <= 99) return "18/91-99";
  if (forceEx === 100) return "18/00";
  return 18;
}

function add2eLogExceptionalStrengthState(actor, data) {
  if (!data?.canExceptionalStrength) return;

  const system = actor?.system ?? {};
  const base = Number(system.force_base ?? 10) || 10;
  const racialBonus = Number(system.bonus_caracteristiques?.force ?? system.force_race ?? 0) || 0;
  const total = base + racialBonus;
  const forceEx = add2eExceptionalStrengthValue(system.force_ex);
  const classes = Array.from(actor?.items ?? [])
    .filter(item => String(item?.type ?? "").toLowerCase() === "classe")
    .map(item => item?.name)
    .filter(Boolean);

  console.info("[ADD2E][FORCE_EX][GET_DATA]", {
    version: ADD2E_FORCE_EX_DIAGNOSTICS_VERSION,
    actor: actor?.name,
    classes,
    canExceptionalStrength: data.canExceptionalStrength === true,
    base,
    racialBonus,
    total,
    forceEx,
    tableKey: add2eExceptionalStrengthTableKey(total, forceEx, data.canExceptionalStrength === true),
    displayedBonuses: {
      toucher: system.force_bonus_toucher,
      degats: system.force_bonus_degats,
      poids: system.force_poids,
      ouvrir: system.force_ouvrir,
      tordre: system.force_tordre
    }
  });
}

function add2eSheetAllowedAlignments(actor, sys) {
  if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getActorAllowedAlignments === "function") {
    const fromEngine = Add2eEffectsEngine.getActorAllowedAlignments(actor);
    if (Array.isArray(fromEngine) && fromEngine.length) return fromEngine;
  }
  const fromActor = sys.alignements_autorises;
  if (Array.isArray(fromActor) && fromActor.length) return fromActor;
  const fromClass = sys.details_classe?.alignements_autorises;
  if (Array.isArray(fromClass) && fromClass.length) return fromClass;
  return [];
}

export function add2ePopulateActorSheetActiveEffectsData(actor, data) {
  data.activeEffectsList = actor.effects.map(eff => {
    let desc = eff.getFlag("core", "description") || eff.flags?.add2e?.desc || eff.description || "";
    if (!desc && eff.flags?.add2e?.tags) desc = "<small>" + eff.flags.add2e.tags.join(", ") + "</small>";
    let durationStr = "";
    if (typeof eff.duration?.remaining !== "undefined") durationStr = `${eff.duration.remaining} rounds`;
    else if (typeof eff.duration?.rounds !== "undefined") durationStr = `${eff.duration.rounds} rounds`;
    else if (typeof eff.duration?.seconds !== "undefined") durationStr = `${eff.duration.seconds} sec`;
    return {
      id: eff.id,
      name: eff.name || "",
      img: eff.img || "icons/svg/aura.svg",
      description: desc,
      duration: durationStr,
      sourceName: eff.parent?.name || eff.origin || ""
    };
  });
  return data.activeEffectsList;
}

globalThis.Add2eActorSheet.prototype.getData = async function getData() {
  const data = this._add2eNativeGetData();
  const state = add2ePrepareActorSheetBaseData({ sheet: this, data });

  const forceEx = add2eExceptionalStrengthValue(this.actor?.system?.force_ex);
  data.forceExCurrent = forceEx;
  data.forceExNoneSelected = forceEx === 0;
  data.forceExValues = data.canExceptionalStrength ? add2eExceptionalStrengthValues(forceEx) : [];
  add2eLogExceptionalStrengthState(this.actor, data);

  add2ePrepareActorSheetCombatData({
    actor: state.actor,
    data,
    sys: state.sys,
    progressionCourante: state.progressionCourante,
    isMonk: state.isMonk
  });

  add2ePopulateActorSheetSpellData({ actor: state.actor, data, items: state.items });
  add2ePopulateActorSheetActiveEffectsData(this.actor, data);

  data.alignementsDisponibles = add2eSheetAllowedAlignments(state.actor, state.sys);
  data.activeTab = this._add2eGetNativeActiveTab?.() || this._add2eActiveTab || this._add2eReadStoredTab?.() || "resume";
  this._add2ePreparedData = data;
  return data;
};
