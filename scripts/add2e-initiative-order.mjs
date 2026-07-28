// scripts/add2e-initiative-order.mjs
// ADD2E — ordre, tri et navigation d'initiative.
// Règle : 1d6, le plus grand score agit en premier.
// Le fichier lit les états inactifs, mais ne les modifie jamais.

import { ADD2E_INITIATIVE_VERSION, TAG, initiativeState } from "./add2e-initiative-constants.mjs";

const INACTIVE_STATUS_IDS = new Set(["dead", "defeated", "unconscious", "incapacitated", "inactive", "inactif", "mort", "inconscient", "hors-combat", "hors-jeu"]);
const TRUE_VALUES = new Set(["true", "1", "yes", "oui", "dead", "defeated", "inactive", "inactif", "mort", "inconscient", "hors-combat", "hors-jeu"]);
const HP_PATHS = ["system.pv.value", "system.pv.actuel", "system.pv.current", "system.hp.value", "system.hp.current", "system.points_de_vie.actuel", "system.pointsVie.actuel", "system.pdv_actuel", "system.pdv"];
const FLAG_PATHS = ["defeated", "isDefeated", "flags.core.defeated", "flags.add2e.defeated", "flags.add2e.inactif", "flags.add2e.inactive", "flags.add2e.horsJeu", "flags.add2e.horsCombat", "system.defeated", "system.inactif", "system.inactive", "system.horsJeu", "system.horsCombat", "system.etat.mort", "system.etat.inconscient"];
const MULTIPLE_ATTACK_ACTOR_FLAG = "multipleAttacks";
const MULTIPLE_ATTACK_PHASE_FLAG = "multipleAttackPhase";

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

function duplicate(value) {
  try { return foundry.utils.deepClone(value ?? {}); }
  catch (_err) { return JSON.parse(JSON.stringify(value ?? {})); }
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
  if (fromConfig !== null) return fromConfig;
  for (const key of keys) {
    const parsed = boolSetting(safeSetting("core", key));
    if (parsed !== null) return parsed;
  }
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

export function isInactiveCombatant(combatant) {
  if (!combatant) return false;
  const tokenDoc = combatant.token ?? null;
  const actor = combatant.actor ?? tokenDoc?.actor ?? null;
  const hp = actorHp(actor);
  return Boolean(
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
}

export function initiativeValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function stableCombatantSort(combatant) {
  const value = Number(combatant?.sort);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

export function compareInitiativeHighFirst(a, b) {
  const ai = initiativeValue(a?.initiative);
  const bi = initiativeValue(b?.initiative);
  if (ai === null && bi === null) {
    const bySort = stableCombatantSort(a) - stableCombatantSort(b);
    return bySort || String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
  }
  if (ai === null) return 1;
  if (bi === null) return -1;
  if (ai !== bi) return bi - ai;
  const bySort = stableCombatantSort(a) - stableCombatantSort(b);
  return bySort || String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
}

export function getCombatOrder(combat = game.combat) {
  return Array.from(combat?.combatants ?? []).sort(compareInitiativeHighFirst);
}

export function initiativeTieGroup(combatant, combat = game.combat) {
  const score = initiativeValue(combatant?.initiative);
  if (score === null) return [];
  return getCombatOrder(combat).filter(entry => initiativeValue(entry?.initiative) === score);
}

function activeCombatantId(combat = game.combat) {
  return combat?.current?.combatantId ?? combat?.combatant?.id ?? null;
}

export function combatTurnIndex(combat = game.combat, turns = getCombatOrder(combat)) {
  if (!turns.length) return 0;
  const activeId = activeCombatantId(combat);
  const activeIndex = activeId ? turns.findIndex(c => c.id === activeId) : -1;
  if (activeIndex >= 0) return activeIndex;
  return numericTurnIndex(combat, turns);
}

function numericTurnIndex(combat = game.combat, turns = getCombatOrder(combat)) {
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
  if (skipInactiveRotationEnabled() && isInactiveCombatant(turns[current])) return resolveNextActiveTurn(turns, current, 1).index;
  return current;
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

export function tokenFromCombatant(combatant) {
  return combatant?.token?.object ?? (combatant?.tokenId ? canvas?.tokens?.get?.(combatant.tokenId) : null) ?? null;
}

function normalizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function classItems(actor) {
  return Array.from(actor?.items ?? []).filter(item => String(item?.type ?? "").toLowerCase() === "classe");
}

function classSlug(item) {
  const sys = item?.system ?? {};
  return normalizeSlug(sys.slug ?? sys.label ?? sys.nom ?? sys.name ?? item?.name ?? "");
}

function classLevel(actor, item, classCount = classItems(actor).length) {
  const itemPaths = ["system.niveau", "system.level", "system.niveau_classe", "system.classLevel", "flags.add2e.niveau", "flags.add2e.level"];
  for (const path of itemPaths) {
    const n = Number(getProperty(item, path));
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  const actorPaths = [
    `system.classProgression.${item?.id}.level`,
    `system.classProgression.${item?.id}.niveau`,
    `system.classes.${item?.id}.level`,
    `system.classes.${item?.id}.niveau`
  ];
  for (const path of actorPaths) {
    const n = Number(getProperty(actor, path));
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  if (classCount <= 1) {
    const n = Number(actor?.system?.niveau ?? actor?.system?.level ?? 1);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return 1;
}

function itemTextValues(item) {
  const sys = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [
    item?.name,
    sys.slug,
    sys.type,
    sys.type_arme,
    sys.categorie,
    sys.category,
    sys.groupe,
    sys.weaponType,
    sys.mode,
    sys.usage,
    flags.usage,
    flags.weaponType,
    ...(Array.isArray(sys.tags) ? sys.tags : []),
    ...(Array.isArray(sys.effectTags) ? sys.effectTags : []),
    ...(Array.isArray(flags.tags) ? flags.tags : [])
  ].map(normalizeSlug).filter(Boolean);
}

function weaponIsProjectileOrRanged(weapon) {
  const sys = weapon?.system ?? {};
  if (sys.isProjectilePropulse === true || sys.projectile === true || sys.distance === true || sys.ranged === true) return true;
  const values = itemTextValues(weapon).join(" ");
  return /projectile|distance|ranged|arc|arbalete|fleche|carreau|fronde|javelot|lance_pierre/.test(values);
}

function weaponIsUnarmed(weapon) {
  const sys = weapon?.system ?? {};
  if (sys.unarmed === true || sys.mainsNues === true || weapon?.flags?.add2e?.unarmed === true) return true;
  const values = itemTextValues(weapon).join(" ");
  return /main_nue|mains_nues|poing|pugilat|unarmed|sans_arme/.test(values);
}

function effectRules(effect) {
  const raw = effect?.flags?.add2e?.rules;
  if (Array.isArray(raw)) return raw.filter(rule => rule && typeof rule === "object");
  if (!raw || typeof raw !== "object") return [];
  return Array.isArray(raw.rules)
    ? raw.rules.filter(rule => rule && typeof rule === "object")
    : [raw];
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
      const type = normalizeSlug(rule.type ?? rule.kind ?? rule.category ?? "");
      if (type !== "rate_of_fire_modifier") continue;
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

  if (!candidates.length) return null;
  return candidates.sort((left, right) => right.multiplier - left.multiplier)[0];
}

function greatestCommonDivisor(left, right) {
  let a = Math.max(1, Math.abs(Math.trunc(Number(left) || 1)));
  let b = Math.max(1, Math.abs(Math.trunc(Number(right) || 1)));
  while (b) [a, b] = [b, a % b];
  return a;
}

function multiplyAttackRate(rate, multiplier) {
  const parsed = parseAttackRate(rate);
  const factor = Number(multiplier);
  if (!Number.isFinite(factor) || factor <= 0) return parsed;
  const precision = Math.min(3, Math.max(0, String(factor).split(".")[1]?.length ?? 0));
  const scale = 10 ** precision;
  const factorNumerator = Math.max(1, Math.round(factor * scale));
  const numerator = parsed.numerator * factorNumerator;
  const denominator = parsed.denominator * scale;
  const divisor = greatestCommonDivisor(numerator, denominator);
  const reducedNumerator = Math.max(1, Math.floor(numerator / divisor));
  const reducedDenominator = Math.max(1, Math.floor(denominator / divisor));
  return { numerator: reducedNumerator, denominator: reducedDenominator, label: `${reducedNumerator}/${reducedDenominator}` };
}

function parseAttackRate(value) {
  if (value && typeof value === "object") {
    const direct = value.ratio ?? value.value ?? value.valeur ?? value.rate ?? value.attacksPerRound ?? value.attaquesParRound;
    if (direct !== undefined && direct !== null && direct !== value) return parseAttackRate(direct);
    const numerator = Number(value.numerator ?? value.num ?? value.attacks ?? value.attaques ?? 1);
    const denominator = Number(value.denominator ?? value.den ?? value.rounds ?? 1);
    return { numerator: Math.max(1, Math.floor(numerator || 1)), denominator: Math.max(1, Math.floor(denominator || 1)), label: `${Math.max(1, Math.floor(numerator || 1))}/${Math.max(1, Math.floor(denominator || 1))}` };
  }
  const text = String(value ?? "1/1").trim();
  const match = text.match(/^(\d+)\s*[\/:]\s*(\d+)$/);
  if (match) return { numerator: Math.max(1, Number(match[1]) || 1), denominator: Math.max(1, Number(match[2]) || 1), label: `${match[1]}/${match[2]}` };
  const numeric = Number(text.replace(",", "."));
  if (Number.isFinite(numeric) && numeric > 0) return { numerator: Math.max(1, Math.floor(numeric)), denominator: 1, label: `${Math.max(1, Math.floor(numeric))}/1` };
  return { numerator: 1, denominator: 1, label: "1/1" };
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

function combatKey(combat) {
  return String(combat?.id ?? "active-combat");
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

function phaseIsExtra(combat = game.combat, round = combatRound(combat)) {
  const phase = currentMultipleAttackPhase(combat);
  return phase?.phase === "extra" && Number(phase.round) === Number(round);
}

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
  if (!state || Number(state.round) !== combatRound(combat)) return 0;
  return Math.max(0, Math.floor(Number(state.pending ?? 0) || 0));
}

function pendingExtraIndexes(turns, combat = game.combat, { afterIndex = -1 } = {}) {
  const indexes = [];
  for (let index = Math.max(0, afterIndex + 1); index < turns.length; index += 1) {
    const combatant = turns[index];
    if (!combatant?.actor || isInactiveCombatant(combatant)) continue;
    if (pendingExtraCount(combatant.actor, combat) > 0) indexes.push(index);
  }
  return indexes;
}

function attackCountText(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return `${n} attaque${n > 1 ? "s" : ""}`;
}

function usedText(used, total) {
  const u = Math.max(0, Math.floor(Number(used) || 0));
  const t = Math.max(1, Math.floor(Number(total) || 1));
  return `${u}/${t} attaque${t > 1 ? "s" : ""} utilisée${u > 1 ? "s" : ""}`;
}

function multipleAttackMessage(actor, state, context = "status") {
  const name = actor?.name ?? "Acteur";
  const used = Math.max(0, Math.floor(Number(state?.used) || 0));
  const total = Math.max(1, Math.floor(Number(state?.total) || 1));
  const pending = Math.max(0, Math.floor(Number(state?.pending) || 0));
  const ratio = String(state?.ratio ?? state?.label ?? "").trim();
  const ratioText = ratio ? ` — rythme ${ratio}` : "";
  const summary = `${name} : ${usedText(used, total)}, ${attackCountText(pending)} restante${pending > 1 ? "s" : ""} ce round${ratioText}.`;

  if (context === "normal-pending") return `Attaque enregistrée — ${summary} Prochaine attaque en fin de round.`;
  if (context === "normal-done") return `Attaque enregistrée — ${summary} Toutes les attaques du round sont utilisées.`;
  if (context === "blocked-normal") return `Attaque normale déjà utilisée — ${summary} Attends la phase d’attaque supplémentaire en fin de round.`;
  if (context === "extra-turn") return `Attaque supplémentaire — ${summary} C’est à ${name} de jouer maintenant.`;
  if (context === "extra-recorded") return pending > 0
    ? `Attaque supplémentaire enregistrée — ${summary}`
    : `Attaque supplémentaire enregistrée — ${summary} Toutes les attaques du round sont utilisées.`;
  if (context === "blocked-extra") return `Aucune attaque restante — ${summary}`;
  if (context === "wrong-magic-weapon") return `Cadence magique liée à une autre arme — ${summary}`;
  return summary;
}

async function setMultipleAttackPhase(combat, data = {}) {
  if (!combat?.setFlag) return false;
  try {
    await combat.setFlag("add2e", MULTIPLE_ATTACK_PHASE_FLAG, data);
    return true;
  } catch (err) {
    console.warn(`${TAG}[MULTI_ATTACK][PHASE_SET_ERROR]`, err);
    return false;
  }
}

async function enterExtraAttackPhase(combat, turns, index, round = combatRound(combat)) {
  const safeIndex = Math.max(0, Math.min(turns.length - 1, Number(index) || 0));
  const combatant = turns[safeIndex];
  await setMultipleAttackPhase(combat, { phase: "extra", round, combatantId: combatant?.id ?? null, updatedAt: Date.now() });
  const state = readMultipleAttackState(combatant?.actor, combat);
  if (state) ui.notifications?.info?.(multipleAttackMessage(combatant?.actor, state, "extra-turn"));
  else ui.notifications?.info?.(`${combatant?.name ?? "Cet acteur"} dispose d’une attaque supplémentaire.`);
  return updateTurn(combat, safeIndex, round);
}

async function leaveExtraAttackPhase(combat, round = combatRound(combat)) {
  return setMultipleAttackPhase(combat, { phase: "normal", round, updatedAt: Date.now() });
}

function magicRateWeaponMismatch(state, weapon) {
  const requiredId = String(state?.rateSourceItemId ?? "");
  if (!requiredId || Number(state?.rateOfFireMultiplier ?? 1) <= 1) return false;
  return String(weapon?.id ?? "") !== requiredId;
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
  const usedBefore = Number(previous?.round) === round ? Math.max(0, Math.floor(Number(previous?.used ?? 0) || 0)) : 0;
  const used = usedBefore + 1;
  const pending = Math.max(0, profile.total - used);
  const state = {
    round,
    sequenceStartRound,
    total: profile.total,
    used,
    pending,
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
    const context = state.phase === "extra" ? "extra-recorded" : (state.pending > 0 ? "normal-pending" : "normal-done");
    ui.notifications?.info?.(multipleAttackMessage(actor, state, context));
  }
  if (typeof globalThis.add2eSyncActionHudToCombatant === "function") globalThis.add2eSyncActionHudToCombatant(combat, { reason: "multiple-attack" });
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
    label: extra ? "Attaque supplémentaire à jouer" : (pending > 0 ? "Attaque supplémentaire en attente" : "Attaques du round terminées"),
    detail: `${usedText(used, total)} — ${attackCountText(pending)} restante${pending > 1 ? "s" : ""}${extra ? " — joue maintenant" : (pending > 0 ? " — en fin de round" : "")}`,
    ratio: String(state.ratio ?? "1/1"),
    css: extra ? "extra" : (pending > 0 ? "pending" : "used")
  };
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

export function scheduleLocalSync(combat = game.combat, { delay = 120, selectToken = false, reason = "sync" } = {}) {
  if (!combat) return;
  clearTimeout(initiativeState.localSyncTimer);
  initiativeState.localSyncTimer = setTimeout(() => {
    applyLocalOrder(combat, { reason });
    if (selectToken) selectCurrentToken(combat);
  }, delay);
}

async function updateTurn(combat, index, round = combatRound(combat)) {
  const turns = getCombatOrder(combat);
  if (!turns.length || !isCombatStarted(combat)) return combat;
  const safeIndex = Math.max(0, Math.min(turns.length - 1, Number(index) || 0));
  const safeRound = Math.max(1, Math.floor(Number(round) || 1));
  await combat.update({ round: safeRound, turn: safeIndex }, { add2eInitiativeNavigation: true });
  setLocalTurn(combat, turns, safeIndex);
  selectCurrentToken(combat);
  if (typeof globalThis.add2eSyncActionHudToCombatant === "function") globalThis.add2eSyncActionHudToCombatant(combat, { reason: "turn" });
  Hooks.callAll("add2eInitiativeTurnChanged", combat, { round: safeRound, turn: safeIndex, combatantId: turns[safeIndex]?.id ?? null });
  return combat;
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
    const currentActor = turns[current]?.actor ?? null;
    if (currentActor && pendingExtraCount(currentActor, combat) > 0) return updateTurn(combat, current, round);
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
  } else if (direction < 0) {
    await leaveExtraAttackPhase(combat, round);
  }

  return updateTurn(combat, next, round);
}

export async function sortInitiativeHighFirst(combat = game.combat) {
  if (!combat || initiativeState.sorting) return false;
  const combatants = Array.from(combat.combatants ?? []);
  if (!combatants.length || !isCombatStarted(combat)) return false;
  const turns = getCombatOrder(combat);
  const updates = turns.map((c, index) => ({ _id: c.id, sort: index })).filter(update => {
    const current = combatants.find(c => c.id === update._id);
    return current && Number(current.sort) !== Number(update.sort);
  });
  initiativeState.sorting = true;
  try {
    if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates, { add2eInitiativeSort: true });
    applyLocalOrder(combat, { reason: "sort-high-first" });
    return true;
  } catch (err) {
    console.error(`${TAG}[SORT_HIGH_FIRST][ERROR]`, err);
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

export function patchNativeSort(target) {
  if (!target || typeof target._sortCombatants !== "function") return false;
  if (target._sortCombatants.__add2eHighFirst === ADD2E_INITIATIVE_VERSION) return true;
  const original = target._sortCombatants.__add2eOriginal ?? target._sortCombatants;
  target._sortCombatants = function add2eSortCombatantsHighFirst(a, b) {
    if (game?.system?.id === "add2e") return compareInitiativeHighFirst(a, b);
    return original.call(this, a, b);
  };
  target._sortCombatants.__add2eHighFirst = ADD2E_INITIATIVE_VERSION;
  target._sortCombatants.__add2eOriginal = original;
  return true;
}

export function installCombatPatch() {
  if (initiativeState.patched) return true;
  const proto = globalThis.Combat?.prototype;
  if (!proto) return false;
  patchNativeSort(proto);
  patchNativeSort(globalThis.Combat);
  if (proto.setupTurns && proto.setupTurns.__add2eHighFirstSetup !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.setupTurns.__add2eOriginal ?? proto.setupTurns;
    proto.setupTurns = function add2eSetupTurnsHighFirst(...args) {
      const result = original.apply(this, args);
      if (game?.system?.id === "add2e") setLocalTurnsOnly(this, getCombatOrder(this));
      return result;
    };
    proto.setupTurns.__add2eHighFirstSetup = ADD2E_INITIATIVE_VERSION;
    proto.setupTurns.__add2eOriginal = original;
  }
  if (proto.startCombat && proto.startCombat.__add2eHighFirstStart !== ADD2E_INITIATIVE_VERSION) {
    const original = proto.startCombat.__add2eOriginal ?? proto.startCombat;
    proto.startCombat = async function add2eStartCombatHighFirst(...args) {
      const result = await original.apply(this, args);
      if (game?.system?.id === "add2e") scheduleLocalSync(this, { delay: 40, selectToken: true, reason: "startCombat" });
      return result;
    };
    proto.startCombat.__add2eHighFirstStart = ADD2E_INITIATIVE_VERSION;
    proto.startCombat.__add2eOriginal = original;
  }
  initiativeState.patched = true;
  return true;
}
