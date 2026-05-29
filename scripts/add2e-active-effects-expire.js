// ============================================================================
// ADD2E — Gestion automatique de l’expiration des effets temporaires
// + synchronisation automatique des états vitaux Inconscient / Mort.
// Version : 2026-05-29-vital-status-visible-icons-v2
// ============================================================================

globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION = "2026-05-29-vital-status-visible-icons-v2";
console.log("[ADD2E][AUTO-REMOVE][VERSION]", globalThis.ADD2E_ACTIVE_EFFECTS_EXPIRE_VERSION);

const ADD2E_ICON_DEAD = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#8b0000" stroke="#ffe08a" stroke-width="4"/><path d="M32 9c-12 0-21 8-21 20 0 8 5 14 12 17v8h18v-8c7-3 12-9 12-17C53 17 44 9 32 9Z" fill="#101010" stroke="#fff0c0" stroke-width="2"/><circle cx="24" cy="30" r="5" fill="#ffefcf"/><circle cx="40" cy="30" r="5" fill="#ffefcf"/><path d="M29 39h6l-3-7Z" fill="#ffefcf"/><path d="M22 49h20M25 55h14" stroke="#ffefcf" stroke-width="4" stroke-linecap="round"/></svg>`);
const ADD2E_ICON_UNCONSCIOUS = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#c77b00" stroke="#fff0a8" stroke-width="4"/><path d="M18 38c2-9 9-15 14-15s12 6 14 15c-3 7-9 11-14 11s-11-4-14-11Z" fill="#1b160b" stroke="#fff4cf" stroke-width="2"/><path d="M22 31h8M34 31h8" stroke="#fff4cf" stroke-width="4" stroke-linecap="round"/><path d="M26 42c4 3 8 3 12 0" stroke="#fff4cf" stroke-width="3" stroke-linecap="round" fill="none"/><text x="41" y="20" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="#101010" stroke="#fff4cf" stroke-width="1">Z</text><text x="49" y="12" font-family="Arial, sans-serif" font-size="11" font-weight="900" fill="#101010" stroke="#fff4cf" stroke-width="1">Z</text></svg>`);

const ADD2E_VITAL_STATUS = {
  unconscious: {
    key: "unconscious",
    statusId: "unconscious",
    name: "Inconscient",
    icon: ADD2E_ICON_UNCONSCIOUS
  },
  dead: {
    key: "dead",
    statusId: "dead",
    name: "Mort",
    icon: ADD2E_ICON_DEAD
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

function add2eVitalEffectStatusSet(effect) {
  const statuses = effect?.statuses ?? effect?.system?.statuses ?? effect?.flags?.core?.statusId ?? [];
  return new Set(add2eVitalArray(statuses).map(add2eVitalNorm).filter(Boolean));
}

function add2eVitalEffectFlag(effect) {
  const flags = effect?.flags?.add2e ?? {};
  const values = [
    flags.vitalStatus,
    flags.status,
    flags.etat,
    typeof effect?.getFlag === "function" ? effect.getFlag("add2e", "vitalStatus") : null
  ];
  return values.map(add2eVitalNorm).find(v => v === "dead" || v === "unconscious" || v === "mort" || v === "inconscient") ?? "";
}

function add2eVitalEffectKind(effect) {
  const name = add2eVitalNorm(effect?.name ?? effect?.label ?? "");
  const icon = add2eVitalNorm(effect?.icon ?? effect?.img ?? "");
  const statuses = add2eVitalEffectStatusSet(effect);
  const flag = add2eVitalEffectFlag(effect);

  if (flag === "dead" || flag === "mort" || statuses.has("dead") || name === "mort" || icon.includes("skull")) return "dead";
  if (flag === "unconscious" || flag === "inconscient" || statuses.has("unconscious") || name === "inconscient" || icon.includes("unconscious")) return "unconscious";
  return null;
}

function add2eVitalFindEffect(actor, kind) {
  return add2eVitalArray(actor?.effects).find(e => add2eVitalEffectKind(e) === kind && e.disabled !== true) ?? null;
}

function add2eVitalHasEffect(actor, kind) {
  return !!add2eVitalFindEffect(actor, kind);
}

function add2eVitalEffectData(kind) {
  const cfg = ADD2E_VITAL_STATUS[kind];
  return {
    name: cfg.name,
    label: cfg.name,
    icon: cfg.icon,
    img: cfg.icon,
    disabled: false,
    transfer: false,
    statuses: [cfg.statusId],
    changes: [],
    flags: {
      add2e: {
        vitalStatus: cfg.key,
        autoVitalStatus: true,
        source: "add2e-vital-status-sync"
      },
      core: {
        statusId: cfg.statusId,
        overlay: true
      }
    }
  };
}

async function add2eVitalDeleteKinds(actor, kinds) {
  const wanted = new Set(kinds);
  const ids = add2eVitalArray(actor?.effects)
    .filter(e => e?.id && wanted.has(add2eVitalEffectKind(e)))
    .map(e => e.id);

  if (!ids.length) return;
  await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
}

async function add2eVitalEnsureKind(actor, kind) {
  if (!kind) return;
  const cfg = ADD2E_VITAL_STATUS[kind];
  const existing = add2eVitalFindEffect(actor, kind);

  if (!existing) {
    await actor.createEmbeddedDocuments("ActiveEffect", [add2eVitalEffectData(kind)]);
    return;
  }

  const updates = {};
  if (existing.name !== cfg.name) updates.name = cfg.name;
  if (existing.label !== cfg.name) updates.label = cfg.name;
  if (existing.icon !== cfg.icon) updates.icon = cfg.icon;
  if (existing.img !== cfg.icon) updates.img = cfg.icon;
  updates.statuses = [cfg.statusId];
  updates["flags.add2e.vitalStatus"] = cfg.key;
  updates["flags.add2e.autoVitalStatus"] = true;
  updates["flags.add2e.source"] = "add2e-vital-status-sync";
  updates["flags.core.statusId"] = cfg.statusId;
  updates["flags.core.overlay"] = true;

  await existing.update(updates);
}

async function add2eSyncActorVitalStatus(actor, { reason = "sync" } = {}) {
  if (!actor || !["personnage", "monster"].includes(String(actor.type ?? "").toLowerCase())) return false;
  if (!game.user?.isGM) return false;

  const lockKey = actor.uuid ?? actor.id;
  if (ADD2E_VITAL_SYNC_LOCK.has(lockKey)) return false;
  ADD2E_VITAL_SYNC_LOCK.add(lockKey);

  try {
    const desired = add2eVitalDesiredStatus(actor);
    const current = {
      unconscious: add2eVitalHasEffect(actor, "unconscious"),
      dead: add2eVitalHasEffect(actor, "dead")
    };

    if (desired === "dead") {
      if (current.unconscious) await add2eVitalDeleteKinds(actor, ["unconscious"]);
      await add2eVitalEnsureKind(actor, "dead");
    } else if (desired === "unconscious") {
      if (current.dead) await add2eVitalDeleteKinds(actor, ["dead"]);
      await add2eVitalEnsureKind(actor, "unconscious");
    } else {
      if (current.dead || current.unconscious) await add2eVitalDeleteKinds(actor, ["dead", "unconscious"]);
    }

    console.log("[ADD2E][VITAL_STATUS][SYNC]", {
      reason,
      actor: actor.name,
      actorId: actor.id,
      type: actor.type,
      hp: add2eVitalReadHP(actor),
      desired
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
