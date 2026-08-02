// ADD2E — effets actifs, sauvegardes et statistiques du HUD d'action.

import { add2eInstallHudSheetRollBridge } from "../add2e/13d-actor-sheet-listeners-rolls.mjs";
import { CARACS, SAVES, actorEffects, esc, getItem, lower, num, tokenFor } from "./shared.mjs";

add2eInstallHudSheetRollBridge();

export function effectDisplayName(effect) {
  const name = String(effect?.name ?? effect?.label ?? effect?._source?.name ?? effect?._source?.label ?? "").trim();
  if (!name) return "";
  if (["activeeffect", "active effect", "effet actif", "effect"].includes(lower(name))) return "";
  return name;
}

function finiteNumber(value) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric : null; }
function formatDurationSeconds(totalSeconds) {
  const total = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  if (total <= 0) return "0 s";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours} h${minutes ? ` ${minutes} min` : ""}`;
  if (minutes > 0) return `${minutes} min${seconds ? ` ${seconds} s` : ""}`;
  return `${seconds} s`;
}
function formatDurationRounds(rounds, turns = 0) {
  const roundCount = Math.max(0, Math.ceil(Number(rounds) || 0));
  const turnCount = Math.max(0, Math.ceil(Number(turns) || 0));
  if (roundCount <= 0 && turnCount <= 0) return "0 round";
  const roundLabel = `${roundCount} round${roundCount > 1 ? "s" : ""}`;
  return turnCount > 0 ? `${roundLabel}, ${turnCount} tour${turnCount > 1 ? "s" : ""}` : roundLabel;
}
function effectDurationLabel(effect) {
  const flags = effect?.flags?.add2e ?? {};
  const duration = effect?.duration ?? {};
  const label = String(flags.remainingLabel ?? flags.durationLabel ?? duration.label ?? duration.remainingLabel ?? "").trim();
  if (label) return `Durée ${label}`;
  const remainingFlag = finiteNumber(flags.remainingSeconds ?? flags.remaining ?? flags.remainingDuration);
  if (remainingFlag !== null) return `Durée ${formatDurationSeconds(remainingFlag)}`;
  const remainingRoundsFlag = finiteNumber(flags.remainingRounds ?? flags.roundsRemaining);
  if (remainingRoundsFlag !== null) return `Durée ${formatDurationRounds(remainingRoundsFlag, finiteNumber(flags.remainingTurns ?? flags.turnsRemaining) ?? 0)}`;
  const remaining = finiteNumber(duration.remaining);
  if (remaining !== null) return duration.type === "turns" || duration.type === "rounds" ? `Durée ${formatDurationRounds(remaining)}` : `Durée ${formatDurationSeconds(remaining)}`;
  const rounds = finiteNumber(duration.rounds);
  if (rounds !== null) {
    const startRound = finiteNumber(duration.startRound);
    const currentRound = finiteNumber(game.combat?.round);
    const elapsedRounds = startRound !== null && currentRound !== null ? Math.max(0, currentRound - startRound) : 0;
    return `Durée ${formatDurationRounds(Math.max(0, rounds - elapsedRounds), finiteNumber(duration.turns) ?? 0)}`;
  }
  const seconds = finiteNumber(duration.seconds);
  if (seconds !== null) {
    const startTime = finiteNumber(duration.startTime);
    const worldTime = finiteNumber(game.time?.worldTime);
    const elapsedSeconds = startTime !== null && worldTime !== null ? Math.max(0, worldTime - startTime) : 0;
    return `Durée ${formatDurationSeconds(Math.max(0, seconds - elapsedSeconds))}`;
  }
  const turns = finiteNumber(duration.turns);
  if (turns !== null) return `Durée ${formatDurationRounds(0, turns)}`;
  return "Durée —";
}
function effectOriginItem(actor, effect) {
  const flags = effect?.flags?.add2e ?? {};
  const candidates = [flags.itemId, flags.sourceItemId, flags.originItemId, effect?.originItemId, effect?.sourceItemId].filter(Boolean);
  const origin = String(effect?.origin ?? effect?._source?.origin ?? "");
  candidates.push(...[...origin.matchAll(/Item\.([A-Za-z0-9]+)/g)].map(match => match[1]).reverse());
  for (const id of candidates) { const item = getItem(actor, id); if (item) return item; }
  return null;
}
function isHudActiveEffect(actor, effect) {
  if (!effect || !effectDisplayName(effect)) return false;
  if (effect.disabled === true || effect.isSuppressed === true || effect.active === false) return false;
  const item = effectOriginItem(actor, effect);
  const itemType = String(item?.type ?? "").toLowerCase();
  const flags = effect?.flags?.add2e ?? {};
  const sourceType = lower(flags.sourceType ?? flags.type ?? flags.kind ?? effect?.sourceType ?? "");
  return !(itemType === "race" || itemType === "classe" || sourceType === "race" || sourceType === "classe" || flags.race === true || flags.classe === true || flags.classFeature === true || flags.racial === true);
}
function addActorEmbeddedEffects(map, actor) {
  for (const effect of actorEffects(actor)) {
    if (!isHudActiveEffect(actor, effect)) continue;
    map.set(effect?.uuid ?? effect?.id ?? effect?._id ?? effectDisplayName(effect), effect);
  }
}
export function effects(actor) {
  const map = new Map();
  addActorEmbeddedEffects(map, actor);
  const tokenActor = tokenFor(actor)?.actor ?? null;
  if (tokenActor && tokenActor !== actor) addActorEmbeddedEffects(map, tokenActor);
  return [...map.values()].sort((a, b) => effectDisplayName(a).localeCompare(effectDisplayName(b)));
}
export function effectRows(actor) {
  const rows = effects(actor);
  if (!rows.length) return `<div class="empty">Aucun effet actif.</div>`;
  return rows.map(effect => `<div class="row effect-row"><img src="${esc(effect.img || effect.icon || "icons/svg/aura.svg")}" alt=""><div><div class="title">${esc(effectDisplayName(effect))}</div><div class="meta"><span>${esc(effectDurationLabel(effect))}</span></div></div><button type="button" class="act danger" data-action="remove-effect" data-effect-id="${esc(effect.id ?? effect._id ?? "")}"><i class="fas fa-trash"></i></button></div>`).join("");
}
function saveSigned(value) { const numeric = Number(value) || 0; return `${numeric >= 0 ? "+" : ""}${numeric}`; }
function saveSourceLabel(resolution) {
  const selected = resolution?.targetResolution?.selected;
  if (selected?.kind === "class") return [selected.className, selected.classLevel ? `niveau ${selected.classLevel}` : ""].filter(Boolean).join(" · ");
  return selected?.name ?? "Valeur de l’acteur";
}
function savingThrowResolutions(actor) {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (typeof engine?.resolveSavingThrow !== "function") {
    throw new Error("[ADD2E][ACTION_HUD][SAVES] Le résolveur canonique de sauvegardes n'est pas installé sur le moteur d'effets.");
  }
  return SAVES.map((save, index) => {
    const resolution = engine.resolveSavingThrow(actor, index, {
      source: "action-hud-save-display",
      consumer: "action-hud",
      frontale: true
    });
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
