// ============================================================================
// ADD2E — Gestion automatique de l’expiration des effets temporaires
// + synchronisation automatique des états vitaux Inconscient / Mort.
// Version : 2026-05-29-vital-status-single-custom-effect-v5
// ============================================================================

globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION = "2026-05-29-vital-status-single-custom-effect-v5";
console.log("[ADD2E][AUTO-REMOVE][VERSION]", globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION);

const ADD2E_VITAL_STATUS = {
  unconscious: {
    key: "unconscious",
    name: "Inconscient",
    icon: "icons/svg/daze.svg"
  },
  dead: {
    key: "dead",
    name: "Mort",
    icon: "icons/svg/blood.svg"
  }
};

const ADD2E_VITAL_SYNC_LOCK = new Set();

function add2eVitalArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eVitalArray);
  if (value instanceof Set) return [...value];
  if (typeof value?.values === "function") return [...value.values()];
  if (typeof value === "object") return Object.values(value);
  return [value];
}

function add2eVitalNorm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:_-]+/g, "_")
    .replace(/^_|_$/g, "");
}

function add2eVitalNumber(value, fallback = NaN) {
  if (typeof value === "string") {
    const m = value.match(/-?\d+(?:[.,]\d+)?/);
    if (!m) return fallback;
    value = m[0].replace(",", ".");
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function add2eVitalReadHP(actor) {
  const sys = actor?.system ?? {};
  const raw = sys.pdv ?? sys.pv?.value ?? sys.hp?.value ?? sys.hp;
  const fallback = sys.points_de_coup ?? sys.pv?.max ?? sys.hp?.max ?? 0;
  return add2eVitalNumber(raw, add2eVitalNumber(fallback, 0));
}

function add2eVitalDesiredStatus(actor) {
  const type = String(actor?.type ?? "").toLowerCase();
  const hp = add2eVitalReadHP(actor);

  if (type === "monster") return hp <= 0 ? "dead" : null;
  if (type === "personnage") {
    if (hp <= -11) return "dead";
    if (hp <= 0) return "unconscious";
    return null;
  }

  return null;
}

function add2eVitalEffectStatuses(effect) {
  return new Set(add2eVitalArray(effect?.statuses ?? effect?.system?.statuses ?? effect?.flags?.core?.statusId ?? []).map(add2eVitalNorm).filter(Boolean));
}

function add2eVitalEffectFlag(effect) {
  const flags = effect?.flags?.add2e ?? {};
  const values = [
    flags.vitalStatus,
    flags.status,
    flags.etat,
    typeof effect?.getFlag === "function" ? effect.getFlag("add2e", "vitalStatus") : null
  ];
  return values.map(add2eVitalNorm).find(v => ["dead", "unconscious", "mort", "inconscient"].includes(v)) ?? "";
}

function add2eVitalEffectKind(effect) {
  const name = add2eVitalNorm(effect?.name ?? effect?.label ?? "");
  const icon = add2eVitalNorm(effect?.icon ?? effect?.img ?? "");
  const statuses = add2eVitalEffectStatuses(effect);
  const flag = add2eVitalEffectFlag(effect);

  if (flag === "dead" || flag === "mort") return "dead";
  if (flag === "unconscious" || flag === "inconscient") return "unconscious";

  if (name === "mort" || name === "dead" || name === "etat_mort") return "dead";
  if (name === "inconscient" || name === "unconscious" || name === "etat_inconscient") return "unconscious";

  if (statuses.has("dead") || statuses.has("mort")) return "dead";
  if (statuses.has("unconscious") || statuses.has("inconscient")) return "unconscious";

  if (icon.includes("skull") || icon.includes("blood")) return "dead";
  if (icon.includes("unconscious") || icon.includes("daze")) return "unconscious";

  return null;
}

function add2eVitalEffectData(kind) {
  const cfg = ADD2E_VITAL_STATUS[kind];
  return {
    name: cfg.name,
    icon: cfg.icon,
    disabled: false,
    transfer: false,
    changes: [],
    duration: {},
    flags: {
      add2e: {
        vitalStatus: cfg.key,
        autoVitalStatus: true,
        source: "add2e-vital-status-sync"
      }
    }
  };
}

async function add2eVitalDeleteAllVitalEffects(actor) {
  const ids = add2eVitalArray(actor?.effects)
    .filter(e => e?.id && add2eVitalEffectKind(e))
    .map(e => e.id);

  if (!ids.length) return 0;
  await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
  return ids.length;
}

async function add2eVitalCreateKind(actor, kind) {
  if (!kind) return false;
  await actor.createEmbeddedDocuments("ActiveEffect", [add2eVitalEffectData(kind)]);
  return true;
}

async function add2eSyncActorVitalStatus(actor, { reason = "sync" } = {}) {
  if (!actor || !["personnage", "monster"].includes(String(actor.type ?? "").toLowerCase())) return false;
  if (!game.user?.isGM) return false;

  const lockKey = actor.uuid ?? actor.id;
  if (ADD2E_VITAL_SYNC_LOCK.has(lockKey)) return false;
  ADD2E_VITAL_SYNC_LOCK.add(lockKey);

  try {
    const desired = add2eVitalDesiredStatus(actor);
    const before = add2eVitalArray(actor?.effects).filter(e => add2eVitalEffectKind(e)).map(e => ({ id: e.id, name: e.name, kind: add2eVitalEffectKind(e), icon: e.icon }));

    const deleted = await add2eVitalDeleteAllVitalEffects(actor);
    if (desired) await add2eVitalCreateKind(actor, desired);

    console.log("[ADD2E][VITAL_STATUS][SYNC]", {
      reason,
      actor: actor.name,
      actorId: actor.id,
      type: actor.type,
      hp: add2eVitalReadHP(actor),
      desired,
      deleted,
      before
    });

    return true;
  } catch (err) {
    console.error("[ADD2E][VITAL_STATUS][ERROR]", { actor: actor?.name, reason, err });
    return false;
  } finally {
    ADD2E_VITAL_SYNC_LOCK.delete(lockKey);
  }
}

globalThis.add2eSyncActorVitalStatus = add2eSyncActorVitalStatus;

Hooks.on("updateActor", async (actor, changed, options, userId) => {
  if (!game.user?.isGM) return;
  const hpChanged = foundry.utils.hasProperty(changed, "system.pdv") ||
    foundry.utils.hasProperty(changed, "system.pv") ||
    foundry.utils.hasProperty(changed, "system.hp") ||
    foundry.utils.hasProperty(changed, "system.points_de_coup");
  if (!hpChanged) return;
  window.setTimeout(() => add2eSyncActorVitalStatus(actor, { reason: "updateActor:hp" }), 30);
});

Hooks.once("ready", () => {
  if (!game.user?.isGM) return;
  window.setTimeout(() => {
    for (const actor of game.actors ?? []) add2eSyncActorVitalStatus(actor, { reason: "ready-scan" });
  }, 500);
});

Hooks.on("updateCombat", async (combat, changed, options, userId) => {
  if (!("round" in changed) && !("turn" in changed)) return;

  const currentRound = combat.round ?? 0;
  console.log("[ADD2E][AUTO-REMOVE] updateCombat déclenché :", { round: currentRound, changed });

  try {
    const combatants = combat.combatants || [];

    for (const combatant of combatants) {
      if (!combatant) continue;

      const actor = combatant.actor;
      if (!actor) {
        console.warn("[ADD2E][AUTO-REMOVE] combatant sans actor :", combatant);
        continue;
      }

      const toDelete = [];

      for (const effect of Array.from(actor.effects ?? [])) {
        if (!effect) continue;
        if (add2eVitalEffectKind(effect)) continue;

        const dur = effect.duration || {};

        if (effect.disabled) continue;
        if (typeof dur.rounds !== "number" || isNaN(dur.rounds)) continue;

        const totalRounds = dur.rounds;
        let startRound = dur.startRound;

        if (typeof startRound !== "number" || isNaN(startRound)) {
          try {
            if (!actor.effects.get(effect.id)) continue;
            await effect.update({ "duration.startRound": currentRound });
            startRound = currentRound;
          } catch (err) {
            const msg = String(err?.message || err || "");
            if (msg.includes("does not exist") || msg.includes("n'existe pas")) {
              console.warn("[ADD2E][AUTO-REMOVE][STALE_UPDATE] Effet déjà absent pendant l'initialisation startRound", {
                actor: actor.name,
                effectId: effect.id,
                effectName: effect.name
              });
              continue;
            }
            throw err;
          }
        }

        const elapsed = Math.max(0, currentRound - startRound);
        const remaining = totalRounds - elapsed;

        if (remaining <= 0) toDelete.push(effect.id);
      }

      const validIds = toDelete.filter(id => id && actor.effects.get(id));
      if (!validIds.length) continue;

      console.log("[ADD2E][AUTO-REMOVE] Suppression auto des effets expirés", {
        actor: actor.name,
        ids: validIds
      });

      for (const effectId of validIds) {
        if (!actor.effects.get(effectId)) continue;

        try {
          await actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
        } catch (err) {
          const msg = String(err?.message || err || "");
          if (msg.includes("does not exist") || msg.includes("n'existe pas")) {
            console.warn("[ADD2E][AUTO-REMOVE][ALREADY_GONE] Effet déjà absent, suppression ignorée", {
              actor: actor.name,
              effectId,
              err
            });
            continue;
          }

          console.error("[ADD2E][AUTO-REMOVE][DELETE_ERROR] Suppression impossible", {
            actor: actor.name,
            effectId,
            err
          });
        }
      }
    }
  } catch (err) {
    console.error("[ADD2E][AUTO-REMOVE] ERREUR dans updateCombat(auto-remove-effects) :", err);
  }
});
