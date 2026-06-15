// ============================================================
// ADD2E — Garde-fou des bases de caractéristiques après bonus racial
// Version : 2026-06-15-racial-base-guard-v1
//
// Objectif : appliquer au drop de race la même logique que le tirage
// des caractéristiques : si base + bonus racial dépasse 18, la base
// est ramenée à 18 - bonus racial, et flags.add2e.base_caracs reste
// synchronisé.
// ============================================================

const ADD2E_RACIAL_BASE_GUARD_VERSION = "2026-06-15-racial-base-guard-v1";
const ADD2E_RACIAL_BASE_GUARD_CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
const ADD2E_RACIAL_BASE_GUARD_PENDING = new Set();

globalThis.ADD2E_RACIAL_BASE_GUARD_VERSION = ADD2E_RACIAL_BASE_GUARD_VERSION;

function add2eRacialGuardNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function add2eRacialGuardBaseFor(actor, carac, flagBase) {
  const flagged = add2eRacialGuardNumber(flagBase?.[carac], NaN);
  if (Number.isFinite(flagged)) return flagged;
  return add2eRacialGuardNumber(actor?.system?.[`${carac}_base`] ?? actor?.system?.[carac], 10);
}

function add2eRacialGuardBonusFor(actor, carac) {
  return add2eRacialGuardNumber(actor?.system?.bonus_caracteristiques?.[carac] ?? actor?.system?.[`${carac}_race`], 0);
}

function add2eRacialGuardCorrectBase(base, racialBonus) {
  let fixed = add2eRacialGuardNumber(base, 10);
  const bonus = add2eRacialGuardNumber(racialBonus, 0);

  if (fixed + bonus > 18) fixed = Math.max(3, 18 - bonus);
  if (fixed + bonus < 3) fixed = Math.min(18, 3 - bonus);

  return Math.max(3, Math.min(18, Math.floor(fixed)));
}

function add2eRacialGuardShouldRun(changes = {}) {
  const sys = changes.system ?? {};
  return Object.prototype.hasOwnProperty.call(sys, "bonus_caracteristiques")
    || Object.prototype.hasOwnProperty.call(sys, "race")
    || Object.prototype.hasOwnProperty.call(sys, "details_race");
}

async function add2eRepairRacialAbilityBases(actor, { render = false } = {}) {
  if (!actor?.system || actor.type !== "personnage") return false;
  if (ADD2E_RACIAL_BASE_GUARD_PENDING.has(actor.id)) return false;

  ADD2E_RACIAL_BASE_GUARD_PENDING.add(actor.id);

  try {
    const flagBase = foundry.utils.deepClone(actor.getFlag("add2e", "base_caracs") ?? {});
    const nextFlagBase = { ...flagBase };
    const updates = {};
    const report = [];

    for (const carac of ADD2E_RACIAL_BASE_GUARD_CARACS) {
      const baseKey = `${carac}_base`;
      const systemBase = add2eRacialGuardNumber(actor.system?.[baseKey] ?? actor.system?.[carac], 10);
      const base = add2eRacialGuardBaseFor(actor, carac, flagBase);
      const racialBonus = add2eRacialGuardBonusFor(actor, carac);
      const fixedBase = add2eRacialGuardCorrectBase(base, racialBonus);

      if (systemBase !== fixedBase) updates[`system.${baseKey}`] = fixedBase;
      if (add2eRacialGuardNumber(nextFlagBase[carac], NaN) !== fixedBase) nextFlagBase[carac] = fixedBase;

      if (base !== fixedBase || systemBase !== fixedBase) {
        report.push({ carac, base, systemBase, racialBonus, fixedBase, total: fixedBase + racialBonus });
      }
    }

    if (Object.keys(updates).length) {
      await actor.update(updates, { add2eInternal: true, add2eReason: "racial-base-guard" });
    }

    const flagChanged = ADD2E_RACIAL_BASE_GUARD_CARACS.some(carac => add2eRacialGuardNumber(flagBase?.[carac], NaN) !== add2eRacialGuardNumber(nextFlagBase?.[carac], NaN));
    if (flagChanged) await actor.setFlag("add2e", "base_caracs", nextFlagBase);

    if (Object.keys(updates).length || flagChanged) {
      const sheet = Object.values(ui.windows ?? {}).find(w => w.actor?.id === actor.id) ?? actor.sheet;
      if (typeof sheet?.autoSetCaracAjustements === "function") await sheet.autoSetCaracAjustements();
      if (render) actor.sheet?.render?.(false);
      if (report.length && globalThis.ADD2E_DEBUG_RACE_CLASSE === true) {
        console.log("[ADD2E][RACIAL_BASE_GUARD][FIXED]", { actor: actor.name, report });
      }
      return true;
    }

    return false;
  } finally {
    ADD2E_RACIAL_BASE_GUARD_PENDING.delete(actor.id);
  }
}

Hooks.on("updateActor", (actor, changes, _options, _userId) => {
  if (!add2eRacialGuardShouldRun(changes)) return;
  setTimeout(() => add2eRepairRacialAbilityBases(actor, { render: actor.sheet?.rendered === true }).catch(err => {
    console.warn("[ADD2E][RACIAL_BASE_GUARD][ERROR]", err);
  }), 0);
});

try { globalThis.add2eRepairRacialAbilityBases = add2eRepairRacialAbilityBases; } catch (_e) {}
console.log("[ADD2E][RACIAL_BASE_GUARD][VERSION]", ADD2E_RACIAL_BASE_GUARD_VERSION);
