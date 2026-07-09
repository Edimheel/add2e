// scripts/add2e-initiative-order.mjs
// ADD2E — ordre, tri et navigation d'initiative.
// Règle : 1d6, le plus petit score agit en premier.
// Le fichier lit les états inactifs, mais ne les modifie jamais.

import { ADD2E_INITIATIVE_VERSION, TAG, initiativeState, escapeHtml } from "./add2e-initiative-constants.mjs";

const INACTIVE_STATUS_IDS = new Set(["dead", "defeated", "unconscious", "incapacitated", "inactive", "inactif", "mort", "inconscient", "hors-combat", "hors-jeu"]);
const TRUE_VALUES = new Set(["true", "1", "yes", "oui", "dead", "defeated", "inactive", "inactif", "mort", "inconscient", "hors-combat", "hors-jeu"]);
const HP_PATHS = ["system.pv.value", "system.pv.actuel", "system.pv.current", "system.hp.value", "system.hp.current", "system.points_de_vie.actuel", "system.pointsVie.actuel", "system.pdv_actuel", "system.pdv"];
const FLAG_PATHS = ["defeated", "isDefeated", "flags.core.defeated", "flags.add2e.defeated", "flags.add2e.inactif", "flags.add2e.inactive", "flags.add2e.horsJeu", "flags.add2e.horsCombat", "system.defeated", "system.inactif", "system.inactive", "system.horsJeu", "system.horsCombat", "system.etat.mort", "system.etat.inconscient"];
const ADD2E_MULTIPLE_ATTACK_ACTOR_FLAG = "multipleAttacks";
const ADD2E_MULTIPLE_ATTACK_PHASE_FLAG = "multipleAttackPhase";
const ADD2E_MULTIPLE_ATTACK_CHAT_KEYS = "__ADD2E_MULTIPLE_ATTACK_CHAT_KEYS__";
const ADD2E_MULTIPLE_ATTACK_LOCAL_KEYS = "__ADD2E_MULTIPLE_ATTACK_LOCAL_KEYS__";
const MARTIAL_WEAPON_CLASSES = new Set(["guerrier", "fighter", "paladin", "ranger", "rodeur"]);
const MONK_CLASS_SLUGS = new Set(["moine", "monk"]);
const ATTACK_RATE_PATHS = [
  "attacksPerRound",
  "attacks_per_round",
  "attaquesParRound",
  "attaques_par_round",
  "attaquesRound",
  "attaques_round",
  "attaqueParRound",
  "attaque_par_round",
  "nombreAttaques",
  "nombre_attaques",
  "nbAttaques",
  "nb_attaques",
  "combat.attacksPerRound",
  "combat.attacks_per_round",
  "combat.attaquesParRound",
  "combat.attaques_par_round"
];
const UNARMED_ATTACK_RATE_PATHS = [
  "unarmedAttacksPerRound",
  "unarmed_attacks_per_round",
  "mainsNuesAttacksPerRound",
  "mains_nues_attacks_per_round",
  "attaquesMainsNuesParRound",
  "attaques_mains_nues_par_round",
  "combat.unarmedAttacksPerRound",
  "combat.mainsNuesAttacksPerRound",
  "combat.attaquesMainsNuesParRound"
];

function isCombatStarted(combat = game.combat) {
  return Boolean(combat?.started && Number(combat?.round ?? 0) > 0);
}

function getProperty(obj, path) {
  try {
    return globalThis.foundry?.utils?.getProperty ? foundry.utils.getProperty(obj, path) : path.split(".").reduce((o, k) => o?.[k], obj);
  } catch (_err) {
    return undefined;
  }
}

function safeSetting(namespace, key) {
  try { return game.settings?.get?.(namespace, key); } catch (_err) { return undefined; }
}

function boolSetting(value) {
  return typeof value === "boolean" ? value : null;
}

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
  const trackerConfig = safeSetting("core", "combatTrackerConfig");
  const fromConfig = objectBool(trackerConfig, keys);
  if (fromConfig !== null) {
    console.log(`${TAG}[INACTIVE][OPTION]`, { source: "core.combatTrackerConfig", value: fromConfig, trackerConfig });
    return fromConfig;
  }
  for (const key of keys) {
    const parsed = boolSetting(safeSetting("core", key));
    if (parsed !== null) {
      console.log(`${TAG}[INACTIVE][OPTION]`, { source: `core.${key}`, value: parsed });
      return parsed;
    }
  }
  console.log(`${TAG}[INACTIVE][OPTION]`, { source: "not-found", value: false, trackerConfig });
  return false;
}

function statusSetHasInactive(statuses) {
  if (!statuses) return false;
  for (const status of statuses) {
    const id = String(status?.id ?? status ?? "").toLowerCase();
    if (INACTIVE_STATUS_IDS.has(id)) return true;
  }
  return false;
}

function effectsHaveInactiveStatus(document) {
  return Array.from(document?.effects ?? []).some(effect => {
    if (effect?.disabled) return false;
    if (statusSetHasInactive(effect?.statuses)) return true;
    const id = String(effect?.statuses?.first?.() ?? effect?.statusId ?? effect?.id ?? effect?.name ?? "").toLowerCase();
    return INACTIVE_STATUS_IDS.has(id);
  });
}

function valueMeansInactive(value) {
  if (value === true) return true;
  if (typeof value === "string") return TRUE_VALUES.has(value.trim().toLowerCase());
  return false;
}

function documentHasInactiveFlag(document) {
  if (!document) return false;
  return FLAG_PATHS.some(path => valueMeansInactive(getProperty(document, path)));
}

function actorHp(actor) {
  for (const path of HP_PATHS) {
    const raw = getProperty(actor, path);
    if (raw === undefined || raw === null || raw === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return { path, value };
  }
  return { path: null, value: null };
}

function clone(value) {
  try { return foundry.utils.deepClone(value ?? {}); }
  catch (_err) { return JSON.parse(JSON.stringify(value ?? {})); }
}

function normalizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function classSlug(item) {
  const system = item?.system ?? {};
  return normalizeSlug(system.slug ?? system.label ?? system.nom ?? system.name ?? item?.name ?? "");
}

function classLevel(actor, item) {
  const values = [item?.system?.niveau, item?.system?.level, item?.system?.niveau_classe, actor?.system?.niveau];
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return Math.floor(numeric);
  }
  return 1;
}

function actorClassItems(actor) {
  return Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
}

function progressionRows(item) {
  return Array.isArray(item?.system?.progression) ? item.system.progression : [];
}

function progressionRowFor(item, level) {
  const rows = progressionRows(item);
  return rows.find(row => Number(row?.niveau ?? row?.level) === level)
    ?? rows[Math.max(0, level - 1)]
    ?? {};
}

function valueAtAnyPath(source, paths) {
  for (const path of paths) {
    const direct = source?.[path];
    const nested = direct === undefined ? getProperty(source, path) : direct;
    if (nested !== undefined && nested !== null && nested !== "") return nested;
  }
  return null;
}

function parseAttackRate(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return { numerator: Math.max(1, Math.floor(value)), denominator: 1, text: `${Math.max(1, Math.floor(value))}/1` };
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const direct = value.ratio ?? value.value ?? value.valeur ?? value.rate ?? value.attacksPerRound ?? value.attaquesParRound;
    if (direct !== undefined && direct !== null && direct !== value) return parseAttackRate(direct);
    const numerator = Number(value.numerator ?? value.num ?? value.attaques ?? value.attacks);
    const denominator = Number(value.denominator ?? value.den ?? value.rounds ?? value.roundsPerCycle);
    if (Number.isFinite(numerator) && numerator > 0 && Number.isFinite(denominator) && denominator > 0) {
      return { numerator: Math.floor(numerator), denominator: Math.floor(denominator), text: `${Math.floor(numerator)}/${Math.floor(denominator)}` };
    }
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const fraction = raw.match(/(\d+)\s*\/\s*(\d+)/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (numerator > 0 && denominator > 0) return { numerator, denominator, text: `${numerator}/${denominator}` };
  }
  const numeric = raw.match(/\d+/);
  if (numeric) {
    const value = Number(numeric[0]);
    if (value > 0) return { numerator: value, denominator: 1, text: `${value}/1` };
  }
  return null;
}

function attacksThisRound(rate, round, sequenceStartRound) {
  const parsed = parseAttackRate(rate);
  if (!parsed) return 1;
  const numerator = Math.max(1, Math.floor(parsed.numerator));
  const denominator = Math.max(1, Math.floor(parsed.denominator));
  const base = Math.floor(numerator / denominator);
  const remainder = numerator % denominator;
  if (denominator <= 1 || remainder <= 0) return Math.max(1, base);
  const cyclePosition = ((Math.max(1, round) - Math.max(1, sequenceStartRound)) % denominator + denominator) % denominator + 1;
  const hasExtra = cyclePosition > denominator - remainder;
  return Math.max(1, base + (hasExtra ? 1 : 0));
}

function rateAverage(rate) {
  const parsed = parseAttackRate(rate);
  return parsed ? parsed.numerator / parsed.denominator : 1;
}

function weaponTokens(weapon) {
  const system = weapon?.system ?? {};
  const flags = weapon?.flags?.add2e ?? {};
  return [
    weapon?.name,
    system.type,
    system.type_arme,
    system.weaponType,
    system.categorie,
    system.category,
    system.type_degats,
    system.typeDegats,
    system.damageType,
    system.usage,
    flags.usage,
    flags.weaponType,
    ...(Array.isArray(system.tags) ? system.tags : []),
    ...(Array.isArray(system.effectTags) ? system.effectTags : []),
    ...(Array.isArray(flags.tags) ? flags.tags : [])
  ].map(normalizeSlug).filter(Boolean);
}

function isUnarmedWeapon(weapon) {
  const tokens = weaponTokens(weapon);
  if (weapon?.system?.unarmed === true || weapon?.system?.mainsNues === true || weapon?.flags?.add2e?.unarmed === true) return true;
  return tokens.some(token => /main(s)?_nue(s)?|poing|pugilat|martial|unarmed|sans_arme|coup_de_poing/.test(token));
}

function isMartialMeleeWeapon(weapon) {
  if (!weapon) return true;
  const tokens = weaponTokens(weapon);
  const hasMissile = tokens.some(token => /distance|projectile|munition|arc|arbalete|fronde|javelot|fleche|carreau/.test(token));
  if (hasMissile) return false;
  const damageType = tokens.some(token => /tranch|contond|slash|bludge|taille|ecras|contusion/.test(token));
  return damageType || tokens.some(token => /melee|melee|contact|corps_a_corps|arme/.test(token));
}

function readAttackRateFromClassData(item, level, weapon) {
  const row = progressionRowFor(item, level);
  const system = item?.system ?? {};
  const sources = [row, system];
  const unarmed = isUnarmedWeapon(weapon);

  for (const source of sources) {
    const specific = unarmed ? valueAtAnyPath(source, UNARMED_ATTACK_RATE_PATHS) : null;
    const rate = parseAttackRate(specific);
    if (rate) return { ...rate, source: "class-data", restriction: unarmed ? "unarmed" : "weapon" };
  }
  for (const source of sources) {
    const generic = valueAtAnyPath(source, ATTACK_RATE_PATHS);
    const rate = parseAttackRate(generic);
    if (rate) return { ...rate, source: "class-data", restriction: "any" };
  }
  return null;
}

function canonicalWarriorRate(slug, level, weapon) {
  if (!MARTIAL_WEAPON_CLASSES.has(slug) || !isMartialMeleeWeapon(weapon)) return null;
  if (slug === "ranger" || slug === "rodeur") {
    if (level >= 15) return parseAttackRate("2/1");
    if (level >= 8) return parseAttackRate("3/2");
    return parseAttackRate("1/1");
  }
  if (level >= 13) return parseAttackRate("2/1");
  if (level >= 7) return parseAttackRate("3/2");
  return parseAttackRate("1/1");
}

function canonicalMonkRate(slug, level, weapon) {
  if (!MONK_CLASS_SLUGS.has(slug) || !isUnarmedWeapon(weapon)) return null;
  if (level >= 16) return parseAttackRate("4/1");
  if (level >= 14) return parseAttackRate("3/1");
  if (level >= 11) return parseAttackRate("5/2");
  if (level >= 9) return parseAttackRate("2/1");
  if (level >= 6) return parseAttackRate("3/2");
  if (level >= 4) return parseAttackRate("5/4");
  return parseAttackRate("1/1");
}

function classAttackCandidates(actor, weapon, combat = game.combat, state = null) {
  const round = combatRound(combat);
  const start = Math.max(1, Math.floor(Number(state?.sequenceStartRound ?? round) || round));
  const candidates = [];

  for (const item of actorClassItems(actor)) {
    const slug = classSlug(item);
    const level = classLevel(actor, item);
    const dataRate = readAttackRateFromClassData(item, level, weapon);
    const canonicalRate = dataRate ?? canonicalMonkRate(slug, level, weapon) ?? canonicalWarriorRate(slug, level, weapon);
    if (!canonicalRate) continue;

    const total = attacksThisRound(canonicalRate, round, start);
    candidates.push({
      total,
      average: rateAverage(canonicalRate),
      ratio: canonicalRate.text,
      eligible: true,
      label: canonicalRate.denominator > 1
        ? `${canonicalRate.text} — ${total} attaque${total > 1 ? "s" : ""} ce round`
        : `${total}/1`,
      source: item.name ?? slug,
      slug,
      level,
      restriction: canonicalRate.restriction ?? (dataRate ? "class-data" : MONK_CLASS_SLUGS.has(slug) ? "unarmed" : "weapon")
    });
  }

  return candidates;
}

function actorAttackProfile(actor, weapon, combat = game.combat, state = null) {
  if (actor?.type !== "personnage") return { total: 1, ratio: "1/1", eligible: false, label: "1/1", source: null };
  const candidates = classAttackCandidates(actor, weapon, combat, state);
  return candidates.sort((a, b) => b.total - a.total || b.average - a.average || b.level - a.level)[0]
    ?? { total: 1, ratio: "1/1", eligible: false, label: "1/1", source: null };
}

function multipleAttackStates(actor) {
  const raw = actor?.getFlag?.("add2e", ADD2E_MULTIPLE_ATTACK_ACTOR_FLAG) ?? actor?.flags?.add2e?.[ADD2E_MULTIPLE_ATTACK_ACTOR_FLAG] ?? {};
  return raw && typeof raw === "object" && !Array.isArray(raw) ? clone(raw) : {};
}

function combatKey(combat = game.combat) {
  return String(combat?.id ?? "active-combat");
}

function multipleAttackPhase(combat = game.combat) {
  const phase = combat?.getFlag?.("add2e", ADD2E_MULTIPLE_ATTACK_PHASE_FLAG) ?? combat?.flags?.add2e?.[ADD2E_MULTIPLE_ATTACK_PHASE_FLAG] ?? {};
  return phase && typeof phase === "object" ? phase : {};
}

async function setMultipleAttackPhase(combat, data = {}) {
  if (!combat?.setFlag) return false;
  try {
    await combat.setFlag("add2e", ADD2E_MULTIPLE_ATTACK_PHASE_FLAG, data);
    return true;
  } catch (err) {
    console.warn(`${TAG}[MULTI_ATTACK][PHASE_SET_ERROR]`, err);
    return false;
  }
}

function phaseIsExtra(combat = game.combat, round = combatRound(combat)) {
  const phase = multipleAttackPhase(combat);
  return phase?.phase === "extra" && Number(phase.round) === Number(round);
}

function readActorMultipleAttackState(actor, combat = game.combat) {
  const key = combatKey(combat);
  const round = combatRound(combat);
  const states = multipleAttackStates(actor);
  const stored = states[key] && typeof states[key] === "object" ? states[key] : {};
  const sequenceStartRound = Math.max(1, Math.floor(Number(stored.sequenceStartRound ?? round) || round));
  const state = Number(stored.round) === round
    ? { ...stored, sequenceStartRound }
    : { sequenceStartRound, round, used: 0, pending: 0, total: 1, pendingNotice: false };
  return { key, states, state, round };
}

async function writeActorMultipleAttackState(actor, combat, state) {
  if (!actor?.setFlag) return false;
  const key = combatKey(combat);
  const states = multipleAttackStates(actor);
  states[key] = { ...state, updatedAt: Date.now() };
  try {
    await actor.setFlag("add2e", ADD2E_MULTIPLE_ATTACK_ACTOR_FLAG, states);
    return true;
  } catch (err) {
    console.warn(`${TAG}[MULTI_ATTACK][ACTOR_STATE_SET_ERROR]`, { actor: actor?.name, err });
    return false;
  }
}

function actorMatchesCombatant(actor, combatant) {
  return Boolean(actor && combatant && (String(combatant.actor?.id ?? combatant.actorId ?? "") === String(actor.id ?? "")));
}

function ownerAndGmUserIds(actor) {
  const ids = [];
  for (const user of game.users ?? []) {
    if (!user?.active) continue;
    if (user.isGM) { ids.push(user.id); continue; }
    try {
      if (actor?.testUserPermission?.(user, "OWNER")) ids.push(user.id);
    } catch (_err) {
      const level = Number(actor?.ownership?.[user.id] ?? actor?.ownership?.default ?? 0);
      if (level >= 3) ids.push(user.id);
    }
  }
  return [...new Set(ids.filter(Boolean))];
}

function multipleAttackChatKeys() {
  globalThis[ADD2E_MULTIPLE_ATTACK_CHAT_KEYS] ??= new Set();
  return globalThis[ADD2E_MULTIPLE_ATTACK_CHAT_KEYS];
}

function multipleAttackLocalKeys() {
  globalThis[ADD2E_MULTIPLE_ATTACK_LOCAL_KEYS] ??= new Set();
  return globalThis[ADD2E_MULTIPLE_ATTACK_LOCAL_KEYS];
}

async function createMultipleAttackChat(actor, combat, content, keySuffix) {
  const key = `${combat?.id ?? "combat"}:${combatRound(combat)}:${actor?.id ?? "actor"}:${keySuffix}`;
  const seen = multipleAttackChatKeys();
  if (seen.has(key)) return false;
  seen.add(key);
  const whisper = ownerAndGmUserIds(actor);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    whisper: whisper.length ? whisper : undefined,
    flags: { add2e: { multipleAttackNotice: true, combatId: combat?.id ?? null, round: combatRound(combat), actorId: actor?.id ?? null } }
  });
  return true;
}

async function announcePendingExtraAttack(actor, combat, pending) {
  const safeName = escapeHtml(actor?.name ?? "Acteur");
  await createMultipleAttackChat(
    actor,
    combat,
    `<div class="add2e-card-test"><b>Attaque supplémentaire en attente</b><br>${safeName} aura ${pending} attaque${pending > 1 ? "s" : ""} supplémentaire${pending > 1 ? "s" : ""} en fin de round.</div>`,
    "pending"
  );
  if (actor?.isOwner) ui.notifications?.info?.(`${actor.name} : ${pending} attaque${pending > 1 ? "s" : ""} supplémentaire${pending > 1 ? "s" : ""} en fin de round.`);
}

async function announceExtraAttackTurn(combat, combatant) {
  const actor = combatant?.actor ?? null;
  if (!actor || !game.user?.isGM) return false;
  const pending = getPendingExtraAttackCount(actor, combat);
  if (pending <= 0) return false;
  const safeName = escapeHtml(actor.name);
  await createMultipleAttackChat(
    actor,
    combat,
    `<div class="add2e-card-test"><b>Round ${combatRound(combat)} — Attaque supplémentaire</b><br>C’est à ${safeName} : ${pending} attaque${pending > 1 ? "s" : ""} supplémentaire${pending > 1 ? "s" : ""} disponible${pending > 1 ? "s" : ""}.</div>`,
    `turn-${combatant.id}-${pending}`
  );
  return true;
}

export function add2eNotifyExtraAttackTurnLocal(combat = game.combat) {
  if (!combat || !phaseIsExtra(combat)) return false;
  const combatant = currentCombatant(combat);
  const actor = combatant?.actor ?? null;
  if (!actor?.isOwner) return false;
  const pending = getPendingExtraAttackCount(actor, combat);
  if (pending <= 0) return false;
  const key = `${combat.id}:${combatRound(combat)}:${combatant.id}:local:${pending}`;
  const seen = multipleAttackLocalKeys();
  if (seen.has(key)) return false;
  seen.add(key);
  ui.notifications?.info?.(`${actor.name} : attaque supplémentaire disponible.`);
  return true;
}

function getPendingExtraAttackCount(actor, combat = game.combat) {
  const { state } = readActorMultipleAttackState(actor, combat);
  return Math.max(0, Math.floor(Number(state.pending ?? 0) || 0));
}

function pendingExtraCombatantIndexes(turns, combat, { afterIndex = -1 } = {}) {
  const indexes = [];
  for (let index = Math.max(0, afterIndex + 1); index < turns.length; index += 1) {
    const combatant = turns[index];
    const actor = combatant?.actor ?? null;
    if (!actor || isInactiveCombatant(combatant)) continue;
    if (getPendingExtraAttackCount(actor, combat) > 0) indexes.push(index);
  }
  return indexes;
}

async function enterExtraAttackPhase(combat, turns, index) {
  const combatant = turns[index] ?? null;
  await setMultipleAttackPhase(combat, { phase: "extra", round: combatRound(combat), combatantId: combatant?.id ?? null, startedAt: Date.now() });
  return updateTurn(combat, index, combatRound(combat), { extraAttackPhase: true });
}

async function leaveExtraAttackPhase(combat, nextRound) {
  await setMultipleAttackPhase(combat, { phase: "normal", round: nextRound, updatedAt: Date.now() });
}

export function isInactiveCombatant(combatant) {
  if (!combatant) return false;
  const tokenDoc = combatant.token ?? null;
  const actor = combatant.actor ?? tokenDoc?.actor ?? null;
  const hp = actorHp(actor);
  const inactive = Boolean(
    documentHasInactiveFlag(combatant) ||
    documentHasInactiveFlag(tokenDoc) ||
    documentHasInactiveFlag(actor) ||
    statusSetHasInactive(combatant.statuses) ||
    statusSetHasInactive(tokenDoc?.statuses) ||
    statusSetHasInactive(actor?.statuses) ||
    effectsHaveInactiveStatus(combatant) ||
    effectsHaveInactiveStatus(tokenDoc) ||
    effectsHaveInactiveStatus(actor) ||
    (hp.value !== null && hp.value <= 0)
  );
  console.log(`${TAG}[INACTIVE][CHECK]`, { combatant: combatant?.name ?? combatant?.id ?? null, combatantId: combatant?.id ?? null, actor: actor?.name ?? null, inactive, defeated: combatant?.defeated ?? null, coreDefeated: combatant?.flags?.core?.defeated ?? null, hpPath: hp.path, hpValue: hp.value });
  return inactive;
}

export function initiativeValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function compareCombatantsAscending(a, b) {
  const ai = initiativeValue(a?.initiative);
  const bi = initiativeValue(b?.initiative);
  if (ai === null && bi === null) return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
  if (ai === null) return 1;
  if (bi === null) return -1;
  if (ai !== bi) return ai - bi;
  return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
}

export function sortedCombatants(combat = game.combat) {
  return Array.from(combat?.combatants ?? []).sort(compareCombatantsAscending);
}

function activeCombatantId(combat = game.combat) {
  return combat?.current?.combatantId ?? combat?.combatant?.id ?? null;
}

export function combatTurnIndex(combat = game.combat, turns = sortedCombatants(combat)) {
  if (!turns.length) return 0;
  const activeId = activeCombatantId(combat);
  const activeIndex = activeId ? turns.findIndex(c => c.id === activeId) : -1;
  if (activeIndex >= 0) return activeIndex;
  return numericTurnIndex(combat, turns);
}

function numericTurnIndex(combat = game.combat, turns = sortedCombatants(combat)) {
  if (!turns.length) return 0;
  const raw = Number(combat?.turn ?? combat?.current?.turn ?? 0);
  return Math.max(0, Math.min(turns.length - 1, Number.isFinite(raw) ? Math.floor(raw) : 0));
}

function combatRound(combat = game.combat) {
  const round = Number(combat?.round ?? 1);
  return Number.isFinite(round) && round > 0 ? Math.floor(round) : 1;
}

function setLocalTurnsOnly(combat, turns) {
  if (!combat || !turns?.length) return false;
  combat.turns = turns;
  return true;
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
  const index = turns.findIndex(c => !isInactiveCombatant(c));
  return index >= 0 ? index : 0;
}

function resolveNextActiveTurn(turns, current, direction) {
  let next = current;
  let roundDelta = 0;
  const skipped = [];
  for (let attempt = 0; attempt < turns.length; attempt += 1) {
    next += direction;
    if (next >= turns.length) { next = 0; roundDelta += 1; }
    else if (next < 0) { next = turns.length - 1; roundDelta -= 1; }
    const candidate = turns[next];
    if (!isInactiveCombatant(candidate)) {
      console.log(`${TAG}[INACTIVE][NEXT]`, { currentIndex: current, selectedIndex: next, selected: candidate?.name ?? candidate?.id ?? null, direction, roundDelta, skipped });
      return { index: next, roundDelta };
    }
    skipped.push({ index: next, name: candidate?.name ?? candidate?.id ?? null });
  }
  console.log(`${TAG}[INACTIVE][NEXT][ALL_SKIPPED]`, { currentIndex: current, direction, skipped });
  return { index: current, roundDelta: 0 };
}

function localIndex(combat, turns, first) {
  if (first) return firstEligibleIndex(turns);
  const current = combatTurnIndex(combat, turns);
  if (skipInactiveRotationEnabled() && isInactiveCombatant(turns[current])) return resolveNextActiveTurn(turns, current, 1).index;
  return current;
}

export function applyLocalOrder(combat = game.combat, { first = false, reason = "local-order" } = {}) {
  if (!combat || !isCombatStarted(combat)) return false;
  const turns = sortedCombatants(combat);
  if (!turns.length) return false;
  const index = localIndex(combat, turns, first);
  console.log(`${TAG}[INACTIVE][APPLY_LOCAL]`, { reason, round: combat?.round ?? null, previousTurn: combat?.turn ?? null, selectedIndex: index, selected: turns[index]?.name ?? turns[index]?.id ?? null });
  return setLocalTurn(combat, turns, index);
}

export function currentCombatant(combat = game.combat) {
  if (!isCombatStarted(combat)) return null;
  const turns = Array.isArray(combat.turns) && combat.turns.length ? combat.turns : sortedCombatants(combat);
  return turns[combatTurnIndex(combat, turns)] ?? null;
}

export function tokenFromCombatant(combatant) {
  return combatant?.token?.object ?? (combatant?.tokenId ? canvas?.tokens?.get?.(combatant.tokenId) : null) ?? null;
}

export function selectCurrentToken(combat = game.combat) {
  if (!isCombatStarted(combat)) return false;
  const combatant = currentCombatant(combat);
  const token = tokenFromCombatant(combatant);
  if (!token?.control) return false;
  try {
    token.control({ releaseOthers: true });
    return true;
  } catch (err) {
    console.warn(`${TAG}[TOKEN_SELECT][ERROR]`, err);
    return false;
  }
}

export function add2eCanActorWeaponAttackNow(actor, { weapon = null, combat = game.combat, notify = false } = {}) {
  if (!combat?.started || actor?.type !== "personnage") return true;
  const combatant = currentCombatant(combat);
  if (!actorMatchesCombatant(actor, combatant)) return true;

  const { state } = readActorMultipleAttackState(actor, combat);
  const profile = actorAttackProfile(actor, weapon, combat, state);
  const used = Math.max(0, Math.floor(Number(state.used ?? 0) || 0));
  const pending = Math.max(0, Math.floor(Number(state.pending ?? Math.max(0, profile.total - used)) || 0));

  if (phaseIsExtra(combat)) {
    if (pending > 0) return true;
    if (notify) ui.notifications?.warn?.(`${actor.name} n’a plus d’attaque supplémentaire ce round.`);
    return false;
  }

  if (used <= 0) return true;
  if (notify) ui.notifications?.warn?.(`${actor.name} a déjà utilisé son attaque normale. L’attaque supplémentaire se fera en fin de round.`);
  return false;
}

export async function add2eRecordWeaponAttack(actor, { weapon = null, combat = game.combat } = {}) {
  if (!combat?.started || actor?.type !== "personnage") return null;
  const { state, round } = readActorMultipleAttackState(actor, combat);
  const profile = actorAttackProfile(actor, weapon, combat, state);
  const used = Math.max(0, Math.floor(Number(state.used ?? 0) || 0)) + 1;
  const pending = Math.max(0, Math.floor(Number(profile.total ?? 1) - used));
  const nextState = {
    ...state,
    round,
    total: Math.max(1, Math.floor(Number(profile.total ?? 1) || 1)),
    ratio: profile.ratio,
    label: profile.label,
    source: profile.source,
    restriction: profile.restriction,
    used,
    pending,
    phase: phaseIsExtra(combat) ? "extra" : "normal"
  };

  const shouldAnnouncePending = !phaseIsExtra(combat) && pending > 0 && nextState.pendingNotice !== true;
  if (shouldAnnouncePending) nextState.pendingNotice = true;
  await writeActorMultipleAttackState(actor, combat, nextState);

  if (shouldAnnouncePending) await announcePendingExtraAttack(actor, combat, pending);
  if (typeof globalThis.add2eSyncActionHudToCombatant === "function") globalThis.add2eSyncActionHudToCombatant(combat, { reason: "multiple-attack" });
  return nextState;
}

export function add2eMultipleAttackHudStatus(actor, combat = game.combat) {
  if (!combat?.started || actor?.type !== "personnage") return null;
  const combatant = currentCombatant(combat);
  if (!actorMatchesCombatant(actor, combatant)) return null;
  const { state } = readActorMultipleAttackState(actor, combat);
  const used = Math.max(0, Math.floor(Number(state.used ?? 0) || 0));
  const pending = Math.max(0, Math.floor(Number(state.pending ?? 0) || 0));
  const ratio = String(state.label || state.ratio || "1/1");

  if (phaseIsExtra(combat) && pending > 0) {
    return { phase: "extra", label: "Attaque supplémentaire", detail: `${pending} attaque${pending > 1 ? "s" : ""} restante${pending > 1 ? "s" : ""} ce round`, ratio, css: "extra" };
  }
  if (!phaseIsExtra(combat) && pending > 0) {
    return { phase: "pending", label: "Attaque supplémentaire en attente", detail: "Disponible en fin de round", ratio, css: "pending" };
  }
  if (!phaseIsExtra(combat) && used > 0) {
    return { phase: "used", label: "Attaque utilisée", detail: "Aucune attaque immédiate restante", ratio, css: "used" };
  }
  return null;
}

export function add2ePatchMultipleAttackTracker(html, combat = game.combat) {
  const root = html?.jquery ? html[0] : html instanceof HTMLElement ? html : html?.[0] ?? document;
  if (!root?.querySelectorAll) return false;

  const styleId = "add2e-multiple-attack-tracker-style";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      #combat-tracker .add2e-extra-attack-badge,.combat-tracker .add2e-extra-attack-badge{display:inline-flex;align-items:center;gap:3px;margin-left:6px;padding:1px 6px;border-radius:999px;border:1px solid #d9bf73;background:#6f201a;color:#fff2bd;font-size:.72em;font-weight:900;white-space:nowrap}
      #combat-tracker [data-add2e-extra-attack="1"],.combat-tracker [data-add2e-extra-attack="1"]{box-shadow:inset 3px 0 0 #d9bf73}
    `;
    document.head.appendChild(style);
  }

  for (const badge of root.querySelectorAll(".add2e-extra-attack-badge")) badge.remove();
  for (const row of root.querySelectorAll('[data-add2e-extra-attack="1"]')) delete row.dataset.add2eExtraAttack;

  if (!phaseIsExtra(combat)) return true;
  const combatant = currentCombatant(combat);
  if (!combatant) return true;
  const row = root.querySelector(`[data-combatant-id="${combatant.id}"]`) ?? root.querySelector(`[data-combatant-id='${combatant.id}']`);
  if (!row) return false;
  row.dataset.add2eExtraAttack = "1";
  const pending = getPendingExtraAttackCount(combatant.actor, combat);
  const target = row.querySelector(".token-name") ?? row.querySelector(".combatant-name") ?? row.querySelector("h4") ?? row;
  target.insertAdjacentHTML("beforeend", `<span class="add2e-extra-attack-badge"><i class="fas fa-crosshairs"></i> Attaque +${pending > 1 ? ` ×${pending}` : ""}</span>`);
  return true;
}

export function scheduleLocalSync(combat = game.combat, { delay = 120, selectToken = false, reason = "sync" } = {}) {
  if (!combat) return;
  clearTimeout(initiativeState.localSyncTimer);
  initiativeState.localSyncTimer = setTimeout(() => {
    applyLocalOrder(combat, { reason });
    if (selectToken) selectCurrentToken(combat);
    add2eNotifyExtraAttackTurnLocal(combat);
  }, delay);
}

async function updateTurn(combat, index, round = combatRound(combat), { extraAttackPhase = false } = {}) {
  const turns = sortedCombatants(combat);
  if (!turns.length || !isCombatStarted(combat)) return combat;
  const safeIndex = Math.max(0, Math.min(turns.length - 1, Number(index) || 0));
  const safeRound = Math.max(1, Math.floor(Number(round) || 1));
  const target = turns[safeIndex];
  console.log(`${TAG}[INACTIVE][UPDATE_TURN]`, { round: safeRound, turn: safeIndex, target: target?.name ?? target?.id ?? null, targetInactive: isInactiveCombatant(target), extraAttackPhase });
  await combat.update({ round: safeRound, turn: safeIndex }, { add2eInitiativeNavigation: true });
  setLocalTurn(combat, turns, safeIndex);
  selectCurrentToken(combat);
  if (extraAttackPhase) await announceExtraAttackTurn(combat, target);
  add2eNotifyExtraAttackTurnLocal(combat);
  add2ePatchMultipleAttackTracker(ui?.combat?.element ?? document, combat);
  if (typeof globalThis.add2eSyncActionHudToCombatant === "function") globalThis.add2eSyncActionHudToCombatant(combat, { reason: extraAttackPhase ? "extra-attack" : "turn" });
  return combat;
}

export async function forceFirstSortedTurn(combat = game.combat) {
  if (!combat || !isCombatStarted(combat)) return combat;
  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;
  await leaveExtraAttackPhase(combat, combatRound(combat));
  setLocalTurn(combat, turns, firstEligibleIndex(turns));
  selectCurrentToken(combat);
  return combat;
}

export async function advanceSortedTurn(combat = game.combat, step = 1) {
  if (!combat || !isCombatStarted(combat)) return combat;
  const turns = sortedCombatants(combat);
  if (!turns.length) return combat;
  const current = numericTurnIndex(combat, turns);
  const direction = step >= 0 ? 1 : -1;
  let next = current + direction;
  let round = combatRound(combat);
  const skipInactive = skipInactiveRotationEnabled();
  const phase = multipleAttackPhase(combat);
  console.log(`${TAG}[INACTIVE][ADVANCE]`, { round, currentIndex: current, current: turns[current]?.name ?? turns[current]?.id ?? null, direction, skipInactive, currentInactive: isInactiveCombatant(turns[current]), multipleAttackPhase: phase });

  if (direction > 0 && phaseIsExtra(combat, round)) {
    const currentActor = turns[current]?.actor ?? null;
    if (currentActor && getPendingExtraAttackCount(currentActor, combat) > 0) return enterExtraAttackPhase(combat, turns, current);
    const pendingAfter = pendingExtraCombatantIndexes(turns, combat, { afterIndex: current });
    if (pendingAfter.length) return enterExtraAttackPhase(combat, turns, pendingAfter[0]);
    round += 1;
    await leaveExtraAttackPhase(combat, round);
    return updateTurn(combat, firstEligibleIndex(turns), round);
  }

  if (direction > 0) {
    let wrapped = false;
    if (skipInactive) {
      const resolved = resolveNextActiveTurn(turns, current, direction);
      next = resolved.index;
      wrapped = resolved.roundDelta > 0;
      round = Math.max(1, round + resolved.roundDelta);
    } else if (next >= turns.length) { next = 0; round += 1; wrapped = true; }

    if (wrapped) {
      const pending = pendingExtraCombatantIndexes(turns, combat, { afterIndex: -1 });
      if (pending.length) return enterExtraAttackPhase(combat, turns, pending[0]);
      await leaveExtraAttackPhase(combat, round);
    }
    return updateTurn(combat, next, round);
  }

  await leaveExtraAttackPhase(combat, round);
  if (skipInactive) {
    const resolved = resolveNextActiveTurn(turns, current, direction);
    next = resolved.index;
    round = Math.max(1, round + resolved.roundDelta);
  } else if (next < 0) { next = turns.length - 1; round = Math.max(1, round - 1); }
  return updateTurn(combat, next, round);
}

export async function sortInitiativeAscending(combat = game.combat) {
  if (!combat || initiativeState.sorting) return false;
  const combatants = Array.from(combat.combatants ?? []);
  if (!combatants.length || !isCombatStarted(combat)) return false;
  const turns = sortedCombatants(combat);
  const updates = turns.map((c, index) => ({ _id: c.id, sort: index })).filter(update => {
    const current = combatants.find(c => c.id === update._id);
    return current && Number(current.sort) !== Number(update.sort);
  });
  initiativeState.sorting = true;
  try {
    if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates, { add2eInitiativeSort: true });
    applyLocalOrder(combat, { reason: "sort" });
    return true;
  } catch (err) {
    console.error(`${TAG}[SORT_ASC][ERROR]`, err);
    return false;
  } finally {
    initiativeState.sorting = false;
  }
}

export function scheduleInitiativeSort(combat = game.combat) {
  if (!combat) return;
  clearTimeout(initiativeState.sortTimer);
  initiativeState.sortTimer = setTimeout(() => sortInitiativeAscending(combat), 100);
}

export function patchNativeSort(target) {
  if (!target || typeof target._sortCombatants !== "function") return false;
  if (target._sortCombatants.__add2eLowFirst === ADD2E_INITIATIVE_VERSION) return true;
  const original = target._sortCombatants.__add2eOriginal ?? target._sortCombatants;
  target._sortCombatants = function add2eSortCombatantsLowFirst(a, b) {
    if (game?.system?.id === "add2e") return compareCombatantsAscending(a, b);
    return original.call(this, a, b);
  };
  target._sortCombatants.__add2eLowFirst = ADD2E_INITIATIVE_VERSION;
  target._sortCombatants.__add2eOriginal = original;
  return true;
}

export function installCombatPatch() {
  if (initiativeState.patched) return true;
  const proto = globalThis.Combat?.prototype;
  if (!proto) return false;
  patchNativeSort(proto);
  patchNativeSort(globalThis.Combat);
  if (proto.setupTurns && proto.setupTurns.__add2eLowFirstSetup !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.setupTurns.__add2eOriginal ?? proto.setupTurns;
    proto.setupTurns = function add2eSetupTurnsLowFirst(...args) {
      const result = original.apply(this, args);
      if (game?.system?.id === "add2e") setLocalTurnsOnly(this, sortedCombatants(this));
      return result;
    };
    proto.setupTurns.__add2eLowFirstSetup = ADD2E_INITIATIVE_VERSION;
    proto.setupTurns.__add2eOriginal = original;
  }
  if (proto.startCombat && proto.startCombat.__add2eLowFirstStart !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.startCombat.__add2eOriginal ?? proto.startCombat;
    proto.startCombat = async function add2eStartCombatLowFirst(...args) {
      const result = await original.apply(this, args);
      if (game?.system?.id === "add2e") scheduleLocalSync(this, { delay: 40, selectToken: true, reason: "startCombat" });
      return result;
    };
    proto.startCombat.__add2eLowFirstStart = ADD2E_INITIATIVE_VERSION;
    proto.startCombat.__add2eOriginal = original;
  }
  if (proto.nextTurn && proto.nextTurn.__add2eLowFirstNext !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.nextTurn.__add2eOriginal ?? proto.nextTurn;
    proto.nextTurn = function add2eNextTurnLowFirst(...args) {
      if (game?.system?.id !== "add2e") return original.apply(this, args);
      return advanceSortedTurn(this, 1);
    };
    proto.nextTurn.__add2eLowFirstNext = ADD2E_INITIATIVE_VERSION;
    proto.nextTurn.__add2eOriginal = original;
  }
  if (proto.previousTurn && proto.previousTurn.__add2eLowFirstPrevious !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.previousTurn.__add2eOriginal ?? proto.previousTurn;
    proto.previousTurn = function add2ePreviousTurnLowFirst(...args) {
      if (game?.system?.id !== "add2e") return original.apply(this, args);
      return advanceSortedTurn(this, -1);
    };
    proto.previousTurn.__add2eLowFirstPrevious = ADD2E_INITIATIVE_VERSION;
    proto.previousTurn.__add2eOriginal = original;
  }
  initiativeState.patched = true;
  return true;
}

globalThis.add2eCanActorWeaponAttackNow = add2eCanActorWeaponAttackNow;
globalThis.add2eRecordWeaponAttack = add2eRecordWeaponAttack;
globalThis.add2eMultipleAttackHudStatus = add2eMultipleAttackHudStatus;
globalThis.add2ePatchMultipleAttackTracker = add2ePatchMultipleAttackTracker;
globalThis.add2eNotifyExtraAttackTurnLocal = add2eNotifyExtraAttackTurnLocal;
