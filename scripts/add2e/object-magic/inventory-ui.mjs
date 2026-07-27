// ADD2E — Objets magiques : présentation dans la feuille de personnage.
// Compatible Foundry V13/V14/V15.

import { add2eObjectMagicEscapeHtml } from "./core.mjs";
import {
  add2eMagicItemEquippedOrUsable,
  add2eMagicObjectActivePowerEntries,
  add2eMagicObjectChargeInfo,
  add2eMagicPowerGeneratedId
} from "./power-runtime.mjs";

export function add2eUiCollectObjectMagicGroups(actor) {
  const groups = [];
  const itemSources = actor?.items?.filter?.(item => {
    const type = String(item?.type ?? "").toLowerCase();
    if (!["arme", "armure", "objet", "object", "magic", "objet_magique"].includes(type)) return false;
    return add2eMagicItemEquippedOrUsable(item) && add2eMagicObjectActivePowerEntries(item).length > 0;
  }) ?? [];
  for (const itemSource of itemSources) {
    const powerEntries = add2eMagicObjectActivePowerEntries(itemSource);
    if (!powerEntries.length) continue;
    const chargeInfo = add2eMagicObjectChargeInfo(itemSource, powerEntries.map(entry => entry.power));
    const maxGlobal = Number(chargeInfo.max) || 0;
    const isGlobal = maxGlobal > 0;
    const powers = [];
    for (const { power, index } of powerEntries) {
      const max = isGlobal
        ? maxGlobal
        : Number(power.max ?? power.maxCharges ?? power.chargesMax ?? power.charges_max ?? itemSource.system?.charges ?? 1) || 1;
      const charges = isGlobal
        ? chargeInfo.current
        : itemSource.getFlag?.("add2e", `charges_${index}`) ?? power.charges ?? itemSource.system?.charges ?? max;
      powers.push({
        id: add2eMagicPowerGeneratedId(itemSource, index),
        name: String(power.name || power.nom || power.label || itemSource.name || "Pouvoir").trim() || "Pouvoir",
        img: power.img || itemSource.img || "icons/svg/aura.svg",
        sourceItemId: itemSource.id,
        sourceName: itemSource.name || "Objet magique",
        sourceImg: itemSource.img || "icons/svg/item-bag.svg",
        niveau: Number(power.niveau ?? power.level ?? 1) || 1,
        description: power.description || power.desc || "",
        charges: Number(charges) || 0,
        max,
        cost: Number(power.cout ?? power.cost ?? 0) || 0
      });
    }
    groups.push({
      itemId: itemSource.id,
      itemName: itemSource.name || "Objet magique",
      itemImg: itemSource.img || "icons/svg/item-bag.svg",
      charges: chargeInfo.current,
      max: chargeInfo.max,
      chargeLabel: chargeInfo.label,
      powers: powers.sort((left, right) => String(left.name).localeCompare(String(right.name), "fr"))
    });
  }
  return groups.sort((left, right) => String(left.itemName).localeCompare(String(right.itemName), "fr"));
}

export function add2eUiCollectObjectMagicPowers(actor) {
  return add2eUiCollectObjectMagicGroups(actor).flatMap(group => group.powers);
}

export function add2eUiBuildObjectMagicSection(actor) {
  const groups = add2eUiCollectObjectMagicGroups(actor);
  const content = groups.length
    ? groups.map(group => {
        const rows = group.powers.length
          ? group.powers.map(power => `
            <tr class="add2e-object-magic-power-row" data-sort-id="${add2eObjectMagicEscapeHtml(power.id)}">
              <td style="width:46px;text-align:center;"><img class="sort-cast-img add2e-object-magic-cast" data-sort-id="${add2eObjectMagicEscapeHtml(power.id)}" src="${add2eObjectMagicEscapeHtml(power.img)}" title="Utiliser ${add2eObjectMagicEscapeHtml(power.name)}" style="width:32px;height:32px;border:1px solid #6f4b12;border-radius:6px;object-fit:cover;cursor:pointer;"></td>
              <td><strong>${add2eObjectMagicEscapeHtml(power.name)}</strong><br><small>Niveau ${Number(power.niveau) || 1}${power.cost ? ` — coût ${Number(power.cost)}` : ""}</small></td>
              <td class="a2e-small">${power.description || ""}</td>
            </tr>`).join("")
          : `<tr><td colspan="3" class="a2e-muted" style="text-align:center;padding:0.6em;">Aucun pouvoir détaillé.</td></tr>`;
        return `<div class="add2e-object-magic-group" data-item-id="${add2eObjectMagicEscapeHtml(group.itemId)}" style="border:1px solid #d9bf73;border-radius:9px;margin-bottom:8px;background:#fffdf6;overflow:hidden;">
          <div class="add2e-object-magic-header" style="display:flex;align-items:center;gap:8px;padding:7px 9px;background:#ead99d;border-bottom:1px solid #dac276;color:#3d2b0a;font-weight:900;">
            <img src="${add2eObjectMagicEscapeHtml(group.itemImg)}" alt="" style="width:28px;height:28px;border:1px solid #6f4b12;border-radius:6px;object-fit:cover;">
            <span style="flex:1;">${add2eObjectMagicEscapeHtml(group.itemName)}</span>
            <span title="Charges restantes / charges maximum" style="padding:2px 8px;border:1px solid #9f7a24;border-radius:999px;background:#fffaf0;white-space:nowrap;">Charges ${add2eObjectMagicEscapeHtml(group.chargeLabel)}</span>
          </div>
          <table class="a2e-table add2e-object-magic-table" style="margin:0;">
            <thead><tr><th style="width:46px;">Utiliser</th><th>Pouvoir</th><th>Description</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      }).join("")
    : `<div class="a2e-muted" style="text-align:center;padding:0.8em;border:1px solid #dac276;border-radius:9px;background:#fffdf6;">Aucun objet magique doté d’un pouvoir utilisable.</div>`;
  return `<section class="a2e-panel add2e-object-magic-panel"><h2><i class="fas fa-wand-sparkles"></i> Objets magiques</h2><div class="a2e-panel-body">${content}</div></section>`;
}

export function add2eUiInjectObjectMagicSection(spellContainer, actor) {
  if (!spellContainer || !actor) return;
  if (spellContainer.matches?.(".item, a.item, .sheet-tabs, .tabs, nav")) return;
  spellContainer.querySelectorAll(".add2e-object-magic-panel").forEach(element => element.remove());
  const wrapper = document.createElement("div");
  wrapper.innerHTML = add2eUiBuildObjectMagicSection(actor).trim();
  const panel = wrapper.firstElementChild;
  if (!panel) return;
  const summary = spellContainer.querySelector(".a2e-spellcasting-summary");
  const firstSpellPanel = [...spellContainer.querySelectorAll(".a2e-panel")]
    .find(candidate => candidate.querySelector?.("table.sort-table"));
  if (summary) spellContainer.insertBefore(panel, summary.nextElementSibling || firstSpellPanel || null);
  else if (firstSpellPanel) spellContainer.insertBefore(panel, firstSpellPanel);
  else spellContainer.insertBefore(panel, spellContainer.firstElementChild || null);
}
