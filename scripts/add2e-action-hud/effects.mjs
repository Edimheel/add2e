// ADD2E — sauvegardes et statistiques du HUD d'action.

import { CARACS, SAVES, TAG, esc, num } from "./shared.mjs";

function saveSigned(value) { const numeric = Number(value) || 0; return `${numeric >= 0 ? "+" : ""}${numeric}`; }
function saveSourceLabel(resolution) {
  const selected = resolution?.targetResolution?.selected;
  if (selected?.kind === "class") return [selected.className, selected.classLevel ? `niveau ${selected.classLevel}` : ""].filter(Boolean).join(" · ");
  return selected?.name ?? "Valeur de l’acteur";
}
function savingThrowResolutions(actor) {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  const resolver = typeof globalThis.add2eResolveSavingThrow === "function" ? globalThis.add2eResolveSavingThrow : (typeof engine?.resolveSavingThrow === "function" ? engine.resolveSavingThrow.bind(engine) : null);
  if (!resolver) {
    console.error(`${TAG}[SAVES][RESOLVER_MISSING]`, { actor: actor?.name ?? null });
    return SAVES.map((save, index) => ({ index, label: save[1], icon: save[2], theme: save[3], targetDisplay: "—", bonus: 0, bonusDisplay: "±0", sourceLabel: "Résolveur indisponible", available: false }));
  }
  return SAVES.map((save, index) => {
    const resolution = resolver(actor, index, { source: "action-hud-save-display", consumer: "action-hud", frontale: true });
    const target = Number(resolution?.target);
    const bonus = Number(resolution?.bonus) || 0;
    const available = Number.isFinite(target) && target > 0;
    return { index, label: resolution?.label ?? save[1], icon: resolution?.definition?.icon?.replace(/^fas\s+/, "") ?? save[2], theme: save[3], targetDisplay: available ? String(target) : "—", bonus, bonusDisplay: saveSigned(bonus), sourceLabel: saveSourceLabel(resolution), available };
  });
}
export function saveRows(actor) {
  return `<div class="save-grid">${savingThrowResolutions(actor).map(row => {
    const modifierClass = row.bonus > 0 ? "positive" : row.bonus < 0 ? "negative" : "neutral";
    const title = row.available ? `${row.label} · seuil ${row.targetDisplay} · bonus ${row.bonusDisplay} · ${row.sourceLabel}` : `${row.label} · valeur indisponible`;
    return `<div class="save-card save-card-${esc(row.theme)}" title="${esc(title)}"><button type="button" class="save-roll-icon" data-action="roll-save" data-save-index="${row.index}" title="Jet de ${esc(row.label)}"><i class="fas ${esc(row.icon)}"></i></button><span class="save-name">${esc(row.label)}</span><span class="save-hint">D20 total égal ou supérieur</span><span class="save-score"><strong>${esc(row.targetDisplay)}</strong><small>seuil</small></span><span class="save-mod ${modifierClass}" title="Bonus ou malus appliqué au D20">${esc(row.bonusDisplay)}</span></div>`;
  }).join("")}</div>`;
}
function ability(actor, key) { const direct = Number(actor?.system?.[key]); return Number.isFinite(direct) ? direct : num(actor?.system?.[`${key}_base`], 10); }
export function abilityRows(actor) { return `<div class="grid">${CARACS.map(carac => `<div class="cell"><button type="button" class="roll-icon" data-action="roll-ability" data-ability="${carac[0]}" title="Jet ${esc(carac[1])}"><i class="fas ${carac[3]}"></i></button><div><b>${carac[1]} ${esc(ability(actor, carac[0]))}</b></div></div>`).join("")}</div>`; }
export function hp(actor) { return num(actor?.system?.pdv ?? actor?.system?.pv?.value ?? actor?.system?.hp?.value ?? actor?.system?.hp, 0); }
export function hpMax(actor) { return num(actor?.system?.points_de_coup ?? actor?.system?.pv?.max ?? actor?.system?.hp?.max ?? actor?.system?.hpMax, hp(actor)); }
export function armorClass(actor) { return actor?.system?.ca_total ?? actor?.system?.ca ?? actor?.system?.armorClass ?? actor?.system?.ac ?? "—"; }
export function thaco(actor) {
  const direct = actor?.system?.thac0 ?? actor?.system?.thaco ?? actor?.system?.combat?.thac0;
  if (direct !== undefined && direct !== null && direct !== "") return direct;
  const level = Math.max(1, num(actor?.system?.niveau, 1));
  return actor?.system?.details_classe?.progression?.[level - 1]?.thac0 ?? 20;
}
