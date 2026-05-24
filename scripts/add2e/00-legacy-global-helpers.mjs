// ============================================================
// ADD2E — Helpers globaux encore utilisés par la feuille legacy
// ============================================================

const ADD2E_LEGACY_GLOBAL_HELPERS_VERSION = "2026-05-24-legacy-global-helpers-v2-player-spell-damage-relay";
globalThis.ADD2E_LEGACY_GLOBAL_HELPERS_VERSION = ADD2E_LEGACY_GLOBAL_HELPERS_VERSION;
console.log("[ADD2E][LEGACY_GLOBAL_HELPERS][VERSION]", ADD2E_LEGACY_GLOBAL_HELPERS_VERSION);

function add2eLegacyNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_");
}

function add2eLegacyArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(add2eLegacyArray).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
  if (value && typeof value === "object") {
    for (const key of ["value", "values", "list", "lists", "items", "allowed", "alignments", "alignements"]) {
      if (value[key] !== undefined) return add2eLegacyArray(value[key]);
    }
  }
  return [value];
}

function add2eClassAllowedAlignmentsFallback(classSystem = {}) {
  const sources = [
    classSystem.alignements_autorises,
    classSystem.alignementsAutorises,
    classSystem.allowedAlignments,
    classSystem.alignmentsAllowed,
    classSystem.alignements,
    classSystem.alignments,
    classSystem.alignment,
    classSystem.alignement
  ];

  const out = [];
  for (const src of sources) out.push(...add2eLegacyArray(src));

  const tags = add2eLegacyArray(classSystem.requirementTags);
  for (const raw of tags) {
    const tag = add2eLegacyNormalize(raw);
    const parts = tag.split(":");
    if (parts[0] !== "prerequis" || parts[1] !== "alignement") continue;
    if (parts[2] === "allow" && parts[3]) out.push(parts.slice(3).join(":"));
  }

  return [...new Set(out.map(v => String(v ?? "").trim()).filter(Boolean))];
}

if (typeof globalThis.add2eClassAllowedAlignments !== "function") {
  globalThis.add2eClassAllowedAlignments = add2eClassAllowedAlignmentsFallback;
}

if (typeof globalThis.add2ePickClassAlignment !== "function") {
  globalThis.add2ePickClassAlignment = function add2ePickClassAlignment(actor, classSystem = {}) {
    const allowed = globalThis.add2eClassAllowedAlignments?.(classSystem) ?? [];
    const current = String(actor?.system?.alignement ?? "").trim();
    const currentNorm = add2eLegacyNormalize(current);

    if (allowed.length) {
      const match = allowed.find(a => add2eLegacyNormalize(a) === currentNorm);
      if (match) return current;
      return allowed[0];
    }

    return current;
  };
}

if (typeof globalThis.add2eRegisterImgPicker !== "function") {
  globalThis.add2eRegisterImgPicker = function add2eRegisterImgPicker(html, sheet) {
    const root = html?.jquery ? html : $(html);
    if (!root?.find) return;

    const actor = sheet?.actor ?? sheet?.document;
    if (!actor) return;

    root.find("img[data-edit], .profile-img[data-edit], .actor-img[data-edit]")
      .off("click.add2e-img-picker")
      .on("click.add2e-img-picker", ev => {
        ev.preventDefault();
        const target = ev.currentTarget;
        const field = target.dataset.edit || target.getAttribute("data-edit") || "img";
        const current = foundry.utils.getProperty(actor, field) || target.getAttribute("src") || actor.img || "icons/svg/mystery-man.svg";

        new FilePicker({
          type: "image",
          current,
          callback: async path => {
            const update = {};
            update[field] = path;
            await actor.update(update);
          },
          top: sheet?.position?.top + 40,
          left: sheet?.position?.left + 10
        }).browse(current);
      });
  };
}

// ============================================================
// ADD2E — Dégâts / soins compatibles joueur via socket MJ
// ============================================================

const ADD2E_PLAYER_SPELL_DAMAGE_RELAY_VERSION = "2026-05-24-player-spell-damage-relay-v1";
globalThis.ADD2E_PLAYER_SPELL_DAMAGE_RELAY_VERSION = ADD2E_PLAYER_SPELL_DAMAGE_RELAY_VERSION;

function add2eReadHpMax(actorDoc) {
  const sys = actorDoc?.system ?? {};
  return Number(sys.points_de_coup)
    || Number(sys.pv_max)
    || Number(sys.points_de_vie)
    || Number(sys.hp?.max)
    || Number(sys.attributes?.hp?.max)
    || 0;
}

function add2eReadHpCurrent(actorDoc, max = 0) {
  const sys = actorDoc?.system ?? {};
  const candidates = [
    sys.pdv,
    sys.pv,
    sys.hp?.value,
    sys.attributes?.hp?.value
  ];
  for (const raw of candidates) {
    if (raw === undefined || raw === null || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return Number(max) || 0;
}

function add2eResolveDamageActor(payload = {}) {
  if (payload.actorId) {
    const actorById = game.actors?.get?.(payload.actorId);
    if (actorById) return actorById;
  }
  if (payload.sceneId && payload.tokenId) {
    const scene = game.scenes?.get?.(payload.sceneId) ?? canvas?.scene ?? null;
    const tokenDoc = scene?.tokens?.get?.(payload.tokenId) ?? null;
    if (tokenDoc?.actor) return tokenDoc.actor;
  }
  return null;
}

async function add2eApplyDamageDirect({ actorDoc, montant = 0, type = "degats", details = "" } = {}) {
  if (!actorDoc) return false;
  const amount = Math.abs(Number(montant) || 0);
  if (!amount) return true;

  const isHeal = String(type ?? "").toLowerCase().includes("soin") || Number(montant) < 0;
  const max = add2eReadHpMax(actorDoc);
  const current = add2eReadHpCurrent(actorDoc, max);
  const next = isHeal ? Math.min(max || current + amount, current + amount) : current - amount;

  await actorDoc.update({ "system.pdv": next }, { add2eReason: "spell-damage-relay", add2eDetails: details });
  console.log("[ADD2E][DAMAGE_RELAY][APPLIED]", {
    actor: actorDoc.name,
    type,
    montant,
    amount,
    current,
    max,
    next,
    details
  });
  return true;
}

function add2eDamagePayloadFromTarget(cible, data = {}) {
  const tokenDoc = cible?.document ?? cible?.token?.document ?? null;
  const actorDoc = cible?.actor ?? cible;
  return {
    actorId: actorDoc?.id ?? tokenDoc?.actorId ?? null,
    actorUuid: actorDoc?.uuid ?? null,
    sceneId: tokenDoc?.parent?.id ?? canvas?.scene?.id ?? null,
    tokenId: tokenDoc?.id ?? null,
    ...data
  };
}

if (typeof globalThis.add2eApplyDamage !== "function") {
  globalThis.add2eApplyDamage = async function add2eApplyDamage({ cible, montant = 0, type = "degats", details = "" } = {}) {
    const actorDoc = cible?.actor ?? cible;
    if (!actorDoc) return false;

    const canDirect = game.user?.isGM || actorDoc.isOwner || actorDoc.testUserPermission?.(game.user, "OWNER") === true;
    if (canDirect) return await add2eApplyDamageDirect({ actorDoc, montant, type, details });

    const activeGM = game.users?.activeGM ?? game.users?.find?.(u => u.active && u.isGM) ?? null;
    if (!activeGM || !game.socket) {
      ui.notifications?.error(`ADD2E : aucun MJ actif pour appliquer ${details || type}.`);
      return false;
    }

    const payload = add2eDamagePayloadFromTarget(cible, { montant, type, details, fromUserId: game.user.id, sentAt: Date.now() });
    console.log("[ADD2E][DAMAGE_RELAY][EMIT]", payload);
    game.socket.emit("system.add2e", { type: "ADD2E_APPLY_DAMAGE", payload });
    return true;
  };
}

Hooks.once("ready", () => {
  if (globalThis.ADD2E_PLAYER_SPELL_DAMAGE_RELAY_REGISTERED) return;
  globalThis.ADD2E_PLAYER_SPELL_DAMAGE_RELAY_REGISTERED = true;

  game.socket?.on("system.add2e", async data => {
    if (!data || data.type !== "ADD2E_APPLY_DAMAGE") return;
    if (!game.user?.isGM) return;

    const payload = data.payload ?? {};
    const actorDoc = add2eResolveDamageActor(payload);
    if (!actorDoc) {
      console.warn("[ADD2E][DAMAGE_RELAY][ACTOR_NOT_FOUND]", payload);
      return;
    }

    await add2eApplyDamageDirect({
      actorDoc,
      montant: payload.montant,
      type: payload.type,
      details: payload.details
    }).catch(err => console.error("[ADD2E][DAMAGE_RELAY][ERROR]", err, payload));
  });

  console.log("[ADD2E][DAMAGE_RELAY][READY]", ADD2E_PLAYER_SPELL_DAMAGE_RELAY_VERSION);
});
