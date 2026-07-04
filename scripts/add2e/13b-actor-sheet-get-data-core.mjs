// ADD2E — Actor sheet getData : orchestrateur ApplicationV2.

import { add2ePrepareActorSheetBaseData } from "./13b-actor-sheet-get-data-base.mjs";
import { add2ePrepareActorSheetCombatData } from "./13b-actor-sheet-get-data-combat.mjs";
import { add2ePopulateActorSheetSpellData } from "./13b-actor-sheet-get-data-spells.mjs";

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant getData.");

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
  this._add2ePreparedData = data;
  return data;
};
