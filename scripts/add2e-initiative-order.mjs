// scripts/add2e-initiative-order.mjs
// ADD2E — ordre, tri, cadence et navigation d'initiative.
// Règle : 1d6, le plus grand score agit en premier.

import { TAG, initiativeState } from "./add2e-initiative-constants.mjs";

const INACTIVE_STATUS_IDS = new Set(["dead", "defeated", "unconscious", "incapacitated", "inactive", "inactif", "mort", "inconscient", "hors-combat", "hors-jeu"]);
const TRUE_VALUES = new Set(["true", "1", "yes", "oui", "dead", "defeated", "inactive", "inactif", "mort", "inconscient", "hors-combat", "hors-jeu"]);
const HP_PATHS = ["system.pv.value", "system.pv.actuel", "system.pv.current", "system.hp.value", "system.hp.current", "system.points_de_vie.actuel", "system.pointsVie.actuel", "system.pdv_actuel", "system.pdv"];
const FLAG_PATHS = ["defeated", "isDefeated", "flags.core.defeated", "flags.add2e.defeated", "flags.add2e.inactif", "flags.add2e.inactive", "flags.add2e.horsJeu", "flags.add2e.horsCombat", "system.defeated", "system.inactif", "system.inactive", "system.horsJeu", "system.horsCombat", "system.etat.mort", "system.etat.inconscient"];
const MULTIPLE_ATTACK_ACTOR_FLAG = "multipleAttacks";
const MULTIPLE_ATTACK_PHASE_FLAG = "multipleAttackPhase";

const isCombatStarted = (combat = game.combat) => Boolean(combat?.started && Number(combat?.round ?? 0) > 0);
const combatKey = combat => String(combat?.id ?? "active-combat");
const combatRound = (combat = game.combat) => {
  const round = Number(combat?.round ?? 1);
  return Number.isFinite(round) && round > 0 ? Math.floor(round) : 1;
};

function getProperty(obj, path) {
  try { return globalThis.foundry?.utils?.getProperty ? foundry.utils.getProperty(obj, path) : path.split(".").reduce((value, key) => value?.[key], obj); }
  catch (_error) { return undefined; }
}

function duplicate(value) {
  try { return foundry.utils.deepClone(value ?? {}); }
  catch (_error) { return JSON.parse(JSON.stringify(value ?? {})); }
}

function safeSetting(namespace, key) {
  try { return game.settings?.get?.(namespace, key); }
  catch (_error) { return undefined; }
}

const boolSetting = value => typeof value === "boolean" ? value : null;
function objectBool(value, keys) {
  if (!value || typeof value !== "object") return null;
  for (const key of keys) {
    const parsed = boolSetting(value[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function skipInactiveRotationEnabled() {
  const keys = ["skipDefeated", "skipDefeatedCombatants", "skipInactive", "skipInactiveCombatants"];
  const fromConfig = objectBool(safeSetting("core", "combatTrackerConfig"), keys);
  if (fromConfig !== null) return fromConfig;
  for (const key of keys) {
    const parsed = boolSetting(safeSetting("core", key));
    if (parsed !== null) return parsed;
  }
  return false;
}

function statusSetHasInactive(statuses) {
  if (!statuses) return false;
  for (const status of statuses) if (INACTIVE_STATUS_IDS.has(String(status?.id ?? status ?? "").toLowerCase())) return true;
  return false;
}

function effectsHaveInactiveStatus(document) {
  return Array.from(document?.effects ?? []).some(effect => {
    if (effect?.disabled) return false;
    if (statusSetHasInactive(effect?.statuses)) return true;
    return INACTIVE_STATUS_IDS.has(String(effect?.statuses?.first?.() ?? effect?.statusId ?? effect?.id ?? effect?.name ?? "").toLowerCase());
  });
}

const valueMeansInactive = value => value === true || (typeof value === "string" && TRUE_VALUES.has(value.trim().toLowerCase()));
const documentHasInactiveFlag = document => Boolean(document && FLAG_PATHS.some(path => valueMeansInactive(getProperty(document, path))));

function actorHp(actor) {
  for (const path of HP_PATHS) {
    const raw = getProperty(actor, path);
    if (raw === undefined || raw === null || raw === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return { path, value };
  }
  return { path: null, value: null };
}

export function isInactiveCombatant(combatant) {
  if (!combatant) return false;
  const token = combatant.token ?? null;
  const actor = combatant.actor ?? token?.actor ?? null;
  const hp = actorHp(actor);
  return Boolean(
    documentHasInactiveFlag(combatant)
    || documentHasInactiveFlag(token)
    || documentHasInactiveFlag(actor)
    || statusSetHasInactive(combatant.statuses)
    || statusSetHasInactive(token?.statuses)
    || statusSetHasInactive(actor?.statuses)
    || effectsHaveInactiveStatus(combatant)
    || effectsHaveInactiveStatus(token)
    || effectsHaveInactiveStatus(actor)
    || (hp.value !== null && hp.value <= 0)
  );
}

export function initiativeValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const stableCombatantSort = combatant => Number.isFinite(Number(combatant?.sort)) ? Number(combatant.sort) : Number.MAX_SAFE_INTEGER;
export function compareInitiativeHighFirst(left, right) {
  const leftInitiative = initiativeValue(left?.initiative);
  const rightInitiative = initiativeValue(right?.initiative);
  if (leftInitiative === null && rightInitiative === null) {
    const bySort = stableCombatantSort(left) - stableCombatantSort(right);
    return bySort || String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
  }
  if (leftInitiative === null) return 1;
  if (rightInitiative === null) return -1;
  if (leftInitiative !== rightInitiative) return rightInitiative - leftInitiative;
  const bySort = stableCombatantSort(left) - stableCombatantSort(right);
  return bySort || String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
}

export const getCombatOrder = (combat = game.combat) => Array.from(combat?.combatants ?? []).sort(compareInitiativeHighFirst);
export function initiativeTieGroup(combatant, combat = game.combat) {
  const score = initiativeValue(combatant?.initiative);
  return score === null ? [] : getCombatOrder(combat).filter(entry => initiativeValue(entry?.initiative) === score);
}

const activeCombatantId = combat => combat?.current?.combatantId ?? combat?.combatant?.id ?? null;
function numericTurnIndex(combat = game.combat, turns = getCombatOrder(combat)) {
  if (!turns.length) return 0;
  const raw = Number(combat?.turn ?? combat?.current?.turn ?? 0);
  return Math.max(0, Math.min(turns.length - 1, Number.isFinite(raw) ? Math.floor(raw) : 0));
}

export function combatTurnIndex(combat = game.combat, turns = getCombatOrder(combat)) {
  if (!turns.length) return 0;
  const activeId = activeCombatantId(combat);
  const index = activeId ? turns.findIndex(combatant => combatant.id === activeId) : -1;
  return index >= 0 ? index : numericTurnIndex(combat, turns);
}

function setLocalTurn(combat, turns, index) {
  if (!combat || !turns?.length || !isCombatStarted(combat)) return false;
  const safe = Math.max(0, Math.min(turns.length - 1, Number(index) || 0));
  combat.turns = turns;
  combat.turn = safe;
  if (combat.current && typeof combat.current === "object") {
    combat.current.turn = safe;
    combat.current.combatantId = turns[safe]?.id ?? combat.current.combatantId;
  }
  return true;
}

function firstEligibleIndex(turns) {
  if (!turns.length || !skipInactiveRotationEnabled()) return 0;
  const index = turns.findIndex(combatant => !isInactiveCombatant(combatant));
  return index >= 0 ? index : 0;
}

function resolveNextActiveTurn(turns, current, direction) {
  let next = current;
  let roundDelta = 0;
  for (let attempt = 0; attempt < turns.length; attempt += 1) {
    next += direction;
    if (next >= turns.length) { next = 0; roundDelta += 1; }
    else if (next < 0) { next = turns.length - 1; roundDelta -= 1; }
    if (!isInactiveCombatant(turns[next])) return { index: next, roundDelta };
  }
  return { index: current, roundDelta: 0 };
}

function localIndex(combat, turns, first) {
  if (first) return firstEligibleIndex(turns);
  const current = combatTurnIndex(combat, turns);
  return skipInactiveRotationEnabled() && isInactiveCombatant(turns[current]) ? resolveNextActiveTurn(turns, current, 1).index : current;
}

export function applyLocalOrder(combat = game.combat, { first = false, reason = "local-order" } = {}) {
  if (!combat || !isCombatStarted(combat)) return false;
  const turns = getCombatOrder(combat);
  if (!turns.length) return false;
  const index = localIndex(combat, turns, first);
  const applied = setLocalTurn(combat, turns, index);
  if (applied) Hooks.callAll("add2eInitiativeOrderApplied", combat, { reason, turn: index, combatantId: turns[index]?.id ?? null });
  return applied;
}

export function currentCombatant(combat = game.combat) {
  if (!isCombatStarted(combat)) return null;
  const turns = Array.isArray(combat.turns) && combat.turns.length ? combat.turns : getCombatOrder(combat);
  return turns[combatTurnIndex(combat, turns)] ?? null;
}

export const tokenFromCombatant = combatant => combatant?.token?.object ?? (combatant?.tokenId ? canvas?.tokens?.get?.(combatant.tokenId) : null) ?? null;

function normalizeSlug(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}

const classItems = actor => Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
const classSlug = item => {
  const system = item?.system ?? {};
  return normalizeSlug(system.slug ?? system.label ?? system.nom ?? system.name ?? item?.name ?? "");
};

function classLevel(actor, item, classCount = classItems(actor).length) {
  for (const path of ["system.niveau", "system.level", "system.niveau_classe", "system.classLevel", "flags.add2e.niveau", "flags.add2e.level"]) {
    const value = Number(getProperty(item, path));
    if (Number.isFinite(value) && value > 0) return Math.floor(value);
  }
  for (const path of [
    `system.classProgression.${item?.id}.level`, `system.classProgression.${item?.id}.niveau`,
    `system.classes.${item?.id}.level`, `system.classes.${item?.id}.niveau`
  ]) {
    const value = Number(getProperty(actor, path));
    if (Number.isFinite(value) && value > 0) return Math.floor(value);
  }
  if (classCount <= 1) {
    const value = Number(actor?.system?.niveau ?? actor?.system?.level ?? 1);
    if (Number.isFinite(value) && value > 0) return Math.floor(value);
  }
  return 1;
}

function itemTextValues(item) {
  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [
    item?.name, system.slug, system.type, system.type_arme, system.categorie, system.category, system.groupe,
    system.weaponType, system.mode, system.usage, flags.usage, flags.weaponType,
    ...(Array.isArray(system.tags) ? system.tags : []),
    ...(Array.isArray(system.effectTags) ? system.effectTags : []),
    ...(Array.isArray(flags.tags) ? flags.tags : [])
  ].map(normalizeSlug).filter(Boolean);
}

function weaponIsProjectileOrRanged(weapon) {
  const system = weapon?.system ?? {};
  if (system.isProjectilePropulse === true || system.projectile === true || system.distance === true || system.ranged === true) return true;
  return /projectile|distance|ranged|arc|arbalete|fleche|carreau|fronde|javelot|lance_pierre/.test(itemTextValues(weapon).join(" "));
}

function weaponIsUnarmed(weapon) {
  const system = weapon?.system ?? {};
  if (system.unarmed === true || system.mainsNues === true || weapon?.flags?.add2e?.unarmed === true) return true;
  return /main_nue|mains_nues|poing|pugilat|unarmed|sans_arme/.test(itemTextValues(weapon).join(" "));
}

function effectRules(effect) {
  const raw = effect?.flags?.add2e?.rules;
  if (Array.isArray(raw)) return raw.filter(rule => rule && typeof rule === "object");
  if (!raw || typeof raw !== "object") return [];
  return Array.isArray(raw.rules) ? raw.rules.filter(rule => rule && typeof rule === "object") : [raw];
}

function weaponRateOfFireModifier(actor, weapon) {
  if (!actor || !weapon || !weaponIsProjectileOrRanged(weapon)) return null;
  const weaponId = String(weapon.id ?? "");
  const weaponUuid = String(weapon.uuid ?? "");
  const candidates = [];
  for (const effect of actor?.effects?.contents ?? actor?.effects ?? []) {
    if (!effect || effect.disabled) continue;
    const flags = effect.flags?.add2e ?? {};
    const sourceItemId = String(flags.sourceItemId ?? "");
    const sourceItemUuid = String(flags.sourceItemUuid ?? "");
    if (!(weaponId && sourceItemId === weaponId) && !(weaponUuid && sourceItemUuid === weaponUuid)) continue;
    for (const rule of effectRules(effect)) {
      if (normalizeSlug(rule.type ?? rule.kind ?? rule.category ?? "") !== "rate_of_fire_modifier") continue;
      const multiplier = Number(rule.multiplier ?? rule.value ?? 1);
      if (!Number.isFinite(multiplier) || multiplier <= 1) continue;
      candidates.push({
        multiplier,
        autoReload: rule.autoReload !== false,
        initiativeRule: String(rule.initiativeRule ?? "").trim(),
        effectId: effect.id ?? null,
        effectName: effect.name ?? "",
        sourceItemId,
        sourceItemUuid,
        rule
      });
    }
  }
  return candidates.sort((left, right) => right.multiplier - left.multiplier)[0] ?? null;
}

function greatestCommonDivisor(left, right) {
  let a = Math.max(1, Math.abs(Math.trunc(Number(left) || 1)));
  let b = Math.max(1, Math.abs(Math.trunc(Number(right) || 1)));
  while (b) [a, b] = [b, a % b];
  return a;
}

function parseAttackRate(value) {
  if (value && typeof value === "object") {
    const direct = value.ratio ?? value.value ?? value.valeur ?? value.rate ?? value.attacksPerRound ?? value.attaquesParRound;
    if (direct !== undefined && direct !== null && direct !== value) return parseAttackRate(direct);
    const numerator = Math.max(1, Math.floor(Number(value.numerator ?? value.num ?? value.attacks ?? value.attaques ?? 1) || 1));
    const denominator = Math.max(1, Math.floor(Number(value.denominator ?? value.den ?? value.rounds ?? 1) || 1));
    return { numerator, denominator, label: `${numerator}/${denominator}` };
  }
  const text = String(value ?? "1/1").trim();
  const match = text.match(/^(\d+)\s*[\/:]\s*(\d+)$/);
  if (match) {
    const numerator = Math.max(1, Number(match[1]) || 1);
    const denominator = Math.max(1, Number(match[2]) || 1);
    return { numerator, denominator, label: `${match[1]}/${match[2]}` };
  }
  const numeric = Number(text.replace(",", "."));
  if (Number.isFinite(numeric) && numeric > 0) {
    const numerator = Math.max(1, Math.floor(numeric));
    return { numerator, denominator: 1, label: `${numerator}/1` };
  }
  return { numerator: 1, denominator: 1, label: "1/1" };
}

function multiplyAttackRate(rate, multiplier) {
  const parsed = parseAttackRate(rate);
  const factor = Number(multiplier);
  if (!Number.isFinite(factor) || factor <= 0) return parsed;
  const precision = Math.min(3, Math.max(0, String(factor).split(".")[1]?.length ?? 0));
  const scale = 10 ** precision;
  const numerator = parsed.numerator * Math.max(1, Math.round(factor * scale));
  const denominator = parsed.denominator * scale;
  const divisor = greatestCommonDivisor(numerator, denominator);
  const reducedNumerator = Math.max(1, Math.floor(numerator / divisor));
  const reducedDenominator = Math.max(1, Math.floor(denominator / divisor));
  return { numerator: reducedNumerator, denominator: reducedDenominator, label: `${reducedNumerator}/${reducedDenominator}` };
}

function attacksThisRound(rate, round, sequenceStartRound = 1) {
  const parsed = parseAttackRate(rate);
  if (parsed.denominator <= 1) return Math.max(1, parsed.numerator);
  const base = Math.floor(parsed.numerator / parsed.denominator);
  const extra = parsed.numerator % parsed.denominator;
  const offset = ((Math.max(1, round) - Math.max(1, sequenceStartRound)) % parsed.denominator + parsed.denominator) % parsed.denominator;
  return Math.max(1, base + (extra > 0 && offset >= parsed.denominator - extra ? 1 : 0));
}

function warriorRate(slug, level) {
  if (slug.includes("ranger") || slug.includes("rodeur")) {
    if (level >= 15) return "2/1";
    if (level >= 8) return "3/2";
    return "1/1";
  }
  if (slug.includes("guerrier") || slug.includes("fighter") || slug.includes("paladin")) {
    if (level >= 13) return "2/1";
    if (level >= 7) return "3/2";
  }
  return "1/1";
}

function monkRate(level) {
  if (level >= 16) return "4/1";
  if (level >= 14) return "3/1";
  if (level >= 11) return "5/2";
  if (level >= 9) return "2/1";
  if (level >= 6) return "3/2";
  if (level >= 4) return "5/4";
  return "1/1";
}

function actorAttackProfile(actor, { weapon = null, combat = game.combat, state = null } = {}) {
  if (!actor || actor.type !== "personnage") return null;
  const classes = classItems(actor);
  if (!classes.length) return null;
  const unarmed = weaponIsUnarmed(weapon);
  const ranged = weaponIsProjectileOrRanged(weapon);
  const rateOfFire = weaponRateOfFireModifier(actor, weapon);
  let best = null;
  for (const item of classes) {
    const slug = classSlug(item);
    const level = classLevel(actor, item, classes.length);
    let rate = "1/1";
    let source = null;
    if (slug.includes("moine") || slug.includes("monk")) {
      if (!unarmed) continue;
      rate = monkRate(level);
      source = "moine";
    } else if (!ranged && (slug.includes("guerrier") || slug.includes("fighter") || slug.includes("paladin") || slug.includes("ranger") || slug.includes("rodeur"))) {
      rate = warriorRate(slug, level);
      source = slug.includes("ranger") || slug.includes("rodeur") ? "ranger" : "guerrier";
    }
    const parsed = parseAttackRate(rate);
    if (parsed.numerator <= parsed.denominator) continue;
    const sequenceStartRound = Math.max(1, Math.floor(Number(state?.sequenceStartRound ?? combatRound(combat)) || combatRound(combat)));
    const total = attacksThisRound(parsed, combatRound(combat), sequenceStartRound);
    const score = parsed.numerator / parsed.denominator;
    if (!best || score > best.score) best = { rate: parsed, ratio: parsed.label, total, classSlug: slug, level, source, score };
  }
  if (!rateOfFire) return best;
  const baseRate = best?.rate ?? parseAttackRate("1/1");
  const modifiedRate = multiplyAttackRate(baseRate, rateOfFire.multiplier);
  const sequenceStartRound = Math.max(1, Math.floor(Number(state?.sequenceStartRound ?? combatRound(combat)) || combatRound(combat)));
  const total = attacksThisRound(modifiedRate, combatRound(combat), sequenceStartRound);
  if (total <= 1) return best;
  return {
    rate: modifiedRate,
    ratio: modifiedRate.label,
    total,
    classSlug: best?.classSlug ?? null,
    level: best?.level ?? null,
    source: best?.source ? `${best.source}+objet-magique` : "objet-magique",
    score: modifiedRate.numerator / modifiedRate.denominator,
    rateOfFire
  };
}

function readMultipleAttackState(actor, combat = game.combat) {
  const all = actor?.getFlag?.("add2e", MULTIPLE_ATTACK_ACTOR_FLAG) ?? actor?.flags?.add2e?.[MULTIPLE_ATTACK_ACTOR_FLAG] ?? {};
  const state = all?.[combatKey(combat)] ?? null;
  return state && typeof state === "object" ? state : null;
}

async function writeMultipleAttackState(actor, combat, state) {
  if (!actor?.setFlag || !combat) return null;
  const all = duplicate(actor.getFlag?.("add2e", MULTIPLE_ATTACK_ACTOR_FLAG) ?? actor.flags?.add2e?.[MULTIPLE_ATTACK_ACTOR_FLAG] ?? {});
  all[combatKey(combat)] = state;
  await actor.setFlag("add2e", MULTIPLE_ATTACK_ACTOR_FLAG, all);
  return state;
}

function currentMultipleAttackPhase(combat = game.combat) {
  const phase = combat?.getFlag?.("add2e", MULTIPLE_ATTACK_PHASE_FLAG) ?? combat?.flags?.add2e?.[MULTIPLE_ATTACK_PHASE_FLAG] ?? null;
  return phase && typeof phase === "object" ? phase : null;
}

const phaseIsExtra = (combat = game.combat, round = combatRound(combat)) => {
  const phase = currentMultipleAttackPhase(combat);
  return phase?.phase === "extra" && Number(phase.round) === Number(round);
};

function stateForRound(actor, combat = game.combat, profile = null) {
  const round = combatRound(combat);
  const previous = readMultipleAttackState(actor, combat);
  const sequenceStartRound = Math.max(1, Math.floor(Number(previous?.sequenceStartRound ?? round) || round));
  const used = Number(previous?.round) === round ? Math.max(0, Math.floor(Number(previous?.used ?? 0) || 0)) : 0;
  const total = profile?.total ?? 1;
  return { previous, round, sequenceStartRound, used, total, pending: Math.max(0, total - used) };
}

function pendingExtraCount(actor, combat = game.combat) {
  const state = readMultipleAttackState(actor, combat);
  return !state || Number(state.round) !== combatRound(combat) ? 0 : Math.max(0, Math.floor(Number(state.pending ?? 0) || 0));
}

function pendingExtraIndexes(turns, combat = game.combat, { afterIndex = -1 } = {}) {
  const indexes = [];
  for (let index = Math.max(0, afterIndex + 1); index < turns.length; index += 1) {
    const combatant = turns[index];
    if (combatant?.actor && !isInactiveCombatant(combatant) && pendingExtraCount(combatant.actor, combat) > 0) indexes.push(index);
  }
  return indexes;
}

const attackCountText = count => {
  const number = Math.max(0, Math.floor(Number(count) || 0));
  return `${number} attaque${number > 1 ? "s" : ""}`;
};
const usedText = (used, total) => {
  const current = Math.max(0, Math.floor(Number(used) || 0));
  const maximum = Math.max(1, Math.floor(Number(total) || 1));
  return `${current}/${maximum} attaque${maximum > 1 ? "s" : ""} utilisée${current > 1 ? "s" : ""}`;
};

function multipleAttackMessage(actor, state, context = "status") {
  const name = actor?.name ?? "Acteur";
  const used = Math.max(0, Math.floor(Number(state?.used) || 0));
  const total = Math.max(1, Math.floor(Number(state?.total) || 1));
  const pending = Math.max(0, Math.floor(Number(state?.pending) || 0));
  const ratio = String(state?.ratio ?? state?.label ?? "").trim();
  const summary = `${name} : ${usedText(used, total)}, ${attackCountText(pending)} restante${pending > 1 ? "s" : ""} ce round${ratio ? ` — rythme ${ratio}` : ""}.`;
  if (context === "normal-pending") return `Attaque enregistrée — ${summary} Prochaine attaque en fin de round.`;
  if (context === "normal-done") return `Attaque enregistrée — ${summary} Toutes les attaques du round sont utilisées.`;
  if (context === "blocked-normal") return `Attaque normale déjà utilisée — ${summary} Attends la phase d’attaque supplémentaire en fin de round.`;
  if (context === "extra-turn") return `Attaque supplémentaire — ${summary} C’est à ${name} de jouer maintenant.`;
  if (context === "extra-recorded") return pending > 0 ? `Attaque supplémentaire enregistrée — ${summary}` : `Attaque supplémentaire enregistrée — ${summary} Toutes les attaques du round sont utilisées.`;
  if (context === "blocked-extra") return `Aucune attaque restante — ${summary}`;
  if (context === "wrong-magic-weapon") return `Cadence magique liée à une autre arme — ${summary}`;
  return summary;
}

async function setMultipleAttackPhase(combat, data = {}) {
  if (!combat?.setFlag) return false;
  try { await combat.setFlag("add2e", MULTIPLE_ATTACK_PHASE_FLAG, data); return true; }
  catch (error) { console.warn(`${TAG}[MULTI_ATTACK][PHASE_SET_ERROR]`, error); return false; }
}

async function updateTurn(combat, index, round = combatRound(combat)) {
  const turns = getCombatOrder(combat);
  if (!turns.length || !isCombatStarted(combat)) return combat;
  const safeIndex = Math.max(0, Math.min(turns.length - 1, Number(index) || 0));
  const safeRound = Math.max(1, Math.floor(Number(round) || 1));
  await combat.update({ round: safeRound, turn: safeIndex }, { add2eInitiativeNavigation: true });
  setLocalTurn(combat, turns, safeIndex);
  selectCurrentToken(combat);
  globalThis.add2eSyncActionHudToCombatant?.(combat, { reason: "turn" });
  Hooks.callAll("add2eInitiativeTurnChanged", combat, { round: safeRound, turn: safeIndex, combatantId: turns[safeIndex]?.id ?? null });
  return combat;
}

async function enterExtraAttackPhase(combat, turns, index, round = combatRound(combat)) {
  const safeIndex = Math.max(0, Math.min(turns.length - 1, Number(index) || 0));
  const combatant = turns[safeIndex];
  await setMultipleAttackPhase(combat, { phase: "extra", round, combatantId: combatant?.id ?? null, updatedAt: Date.now() });
  const state = readMultipleAttackState(combatant?.actor, combat);
  ui.notifications?.info?.(state ? multipleAttackMessage(combatant?.actor, state, "extra-turn") : `${combatant?.name ?? "Cet acteur"} dispose d’une attaque supplémentaire.`);
  return updateTurn(combat, safeIndex, round);
}

const leaveExtraAttackPhase = (combat, round = combatRound(combat)) => setMultipleAttackPhase(combat, { phase: "normal", round, updatedAt: Date.now() });
function magicRateWeaponMismatch(state, weapon) {
  const requiredId = String(state?.rateSourceItemId ?? "");
  return Boolean(requiredId && Number(state?.rateOfFireMultiplier ?? 1) > 1 && String(weapon?.id ?? "") !== requiredId);
}

export function add2eCanActorWeaponAttackNow(actor, { weapon = null, combat = game.combat, notify = false } = {}) {
  if (!actor || !combat?.started) return true;
  const current = currentCombatant(combat);
  if (!current?.actor || String(current.actor.id) !== String(actor.id)) return true;
  const currentState = readMultipleAttackState(actor, combat);
  if (Number(currentState?.round) === combatRound(combat) && currentState?.used > 0 && magicRateWeaponMismatch(currentState, weapon)) {
    if (notify) ui.notifications?.warn?.(multipleAttackMessage(actor, currentState, "wrong-magic-weapon"));
    return false;
  }
  const profile = actorAttackProfile(actor, { weapon, combat, state: currentState });
  if (!profile) return true;
  const state = stateForRound(actor, combat, profile);
  const messageState = { ...currentState, round: state.round, total: state.total, used: state.used, pending: state.pending, ratio: profile.ratio, label: profile.ratio };
  if (phaseIsExtra(combat, state.round)) {
    if (pendingExtraCount(actor, combat) > 0) return true;
    if (notify) ui.notifications?.warn?.(multipleAttackMessage(actor, messageState, "blocked-extra"));
    return false;
  }
  if (state.used <= 0) return true;
  if (notify) ui.notifications?.warn?.(multipleAttackMessage(actor, messageState, "blocked-normal"));
  return false;
}

export async function add2eRecordWeaponAttack(actor, { weapon = null, combat = game.combat } = {}) {
  if (!actor || !combat?.started) return null;
  const current = currentCombatant(combat);
  if (!current?.actor || String(current.actor.id) !== String(actor.id)) return null;
  const previous = readMultipleAttackState(actor, combat);
  if (Number(previous?.round) === combatRound(combat) && previous?.used > 0 && magicRateWeaponMismatch(previous, weapon)) return previous;
  const profile = actorAttackProfile(actor, { weapon, combat, state: previous });
  if (!profile) return null;
  const round = combatRound(combat);
  const sequenceStartRound = Math.max(1, Math.floor(Number(previous?.sequenceStartRound ?? round) || round));
  const used = (Number(previous?.round) === round ? Math.max(0, Math.floor(Number(previous?.used ?? 0) || 0)) : 0) + 1;
  const state = {
    round,
    sequenceStartRound,
    total: profile.total,
    used,
    pending: Math.max(0, profile.total - used),
    ratio: profile.ratio,
    label: profile.ratio,
    phase: phaseIsExtra(combat, round) ? "extra" : "normal",
    source: profile.source,
    classSlug: profile.classSlug,
    classLevel: profile.level,
    weaponId: weapon?.id ?? null,
    weaponName: weapon?.name ?? null,
    rateOfFireMultiplier: profile.rateOfFire?.multiplier ?? null,
    rateAutoReload: profile.rateOfFire?.autoReload ?? null,
    rateInitiativeRule: profile.rateOfFire?.initiativeRule ?? "",
    rateSourceItemId: profile.rateOfFire?.sourceItemId ?? null,
    rateSourceItemUuid: profile.rateOfFire?.sourceItemUuid ?? null,
    updatedAt: Date.now()
  };
  await writeMultipleAttackState(actor, combat, state);
  if (state.total > 1) {
    const context = state.phase === "extra" ? "extra-recorded" : state.pending > 0 ? "normal-pending" : "normal-done";
    ui.notifications?.info?.(multipleAttackMessage(actor, state, context));
  }
  globalThis.add2eSyncActionHudToCombatant?.(combat, { reason: "multiple-attack" });
  return state;
}

export function add2eMultipleAttackHudStatus(actor, combat = game.combat) {
  if (!actor || !combat?.started) return null;
  const state = readMultipleAttackState(actor, combat);
  if (!state || Number(state.round) !== combatRound(combat)) return null;
  const total = Math.max(1, Math.floor(Number(state.total ?? 1) || 1));
  if (total <= 1) return null;
  const used = Math.max(0, Math.floor(Number(state.used ?? 0) || 0));
  const pending = Math.max(0, Math.floor(Number(state.pending ?? 0) || 0));
  const extra = phaseIsExtra(combat, combatRound(combat)) && pending > 0;
  return {
    label: extra ? "Attaque supplémentaire à jouer" : pending > 0 ? "Attaque supplémentaire en attente" : "Attaques du round terminées",
    detail: `${usedText(used, total)} — ${attackCountText(pending)} restante${pending > 1 ? "s" : ""}${extra ? " — joue maintenant" : pending > 0 ? " — en fin de round" : ""}`,
    ratio: String(state.ratio ?? "1/1"),
    css: extra ? "extra" : pending > 0 ? "pending" : "used"
  };
}

export function selectCurrentToken(combat = game.combat) {
  if (!isCombatStarted(combat)) return false;
  const token = tokenFromCombatant(currentCombatant(combat));
  if (!token?.control) return false;
  try { token.control({ releaseOthers: true }); return true; }
  catch (error) { console.warn(`${TAG}[TOKEN_SELECT][ERROR]`, error); return false; }
}

export function scheduleLocalSync(combat = game.combat, { delay = 120, selectToken = false, reason = "sync" } = {}) {
  if (!combat) return;
  clearTimeout(initiativeState.localSyncTimer);
  initiativeState.localSyncTimer = setTimeout(() => {
    applyLocalOrder(combat, { reason });
    if (selectToken) selectCurrentToken(combat);
  }, delay);
}

export async function forceFirstInitiativeTurn(combat = game.combat) {
  if (!combat || !isCombatStarted(combat)) return combat;
  const turns = getCombatOrder(combat);
  if (!turns.length) return combat;
  await leaveExtraAttackPhase(combat, combatRound(combat));
  setLocalTurn(combat, turns, firstEligibleIndex(turns));
  selectCurrentToken(combat);
  return combat;
}

export async function advanceInitiativeTurn(combat = game.combat, step = 1) {
  if (!combat || !isCombatStarted(combat)) return combat;
  const turns = getCombatOrder(combat);
  if (!turns.length) return combat;
  const current = numericTurnIndex(combat, turns);
  const direction = step >= 0 ? 1 : -1;
  let next = current + direction;
  let round = combatRound(combat);
  const skipInactive = skipInactiveRotationEnabled();
  if (direction > 0 && phaseIsExtra(combat, round)) {
    const actor = turns[current]?.actor ?? null;
    if (actor && pendingExtraCount(actor, combat) > 0) return updateTurn(combat, current, round);
    const remaining = pendingExtraIndexes(turns, combat, { afterIndex: current });
    if (remaining.length) return enterExtraAttackPhase(combat, turns, remaining[0], round);
    await leaveExtraAttackPhase(combat, round + 1);
    return updateTurn(combat, firstEligibleIndex(turns), round + 1);
  }
  let wrappedForward = false;
  if (skipInactive) {
    const resolved = resolveNextActiveTurn(turns, current, direction);
    next = resolved.index;
    wrappedForward = direction > 0 && resolved.roundDelta > 0;
    round = Math.max(1, round + resolved.roundDelta);
  } else if (next >= turns.length) { next = 0; wrappedForward = direction > 0; round += 1; }
  else if (next < 0) { next = turns.length - 1; round = Math.max(1, round - 1); }
  if (wrappedForward) {
    const pending = pendingExtraIndexes(turns, combat, { afterIndex: -1 });
    if (pending.length) return enterExtraAttackPhase(combat, turns, pending[0], combatRound(combat));
    await leaveExtraAttackPhase(combat, round);
  } else if (direction < 0) await leaveExtraAttackPhase(combat, round);
  return updateTurn(combat, next, round);
}

export async function sortInitiativeHighFirst(combat = game.combat) {
  if (!combat || initiativeState.sorting) return false;
  const combatants = Array.from(combat.combatants ?? []);
  if (!combatants.length || !isCombatStarted(combat)) return false;
  const turns = getCombatOrder(combat);
  const updates = turns.map((combatant, index) => ({ _id: combatant.id, sort: index })).filter(update => {
    const current = combatants.find(combatant => combatant.id === update._id);
    return current && Number(current.sort) !== Number(update.sort);
  });
  initiativeState.sorting = true;
  try {
    if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates, { add2eInitiativeSort: true });
    applyLocalOrder(combat, { reason: "sort-high-first" });
    return true;
  } catch (error) {
    console.error(`${TAG}[SORT_HIGH_FIRST][ERROR]`, error);
    return false;
  } finally {
    initiativeState.sorting = false;
  }
}

export function scheduleInitiativeSort(combat = game.combat) {
  if (!combat) return;
  clearTimeout(initiativeState.sortTimer);
  initiativeState.sortTimer = setTimeout(() => sortInitiativeHighFirst(combat), 100);
}
