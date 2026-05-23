// scripts/add2e-attack/02-damage.mjs
// ADD2E — Application des dégâts.

export const ADD2E_DAMAGE_VERSION = "2026-05-23-cold-resistance-v1";

function add2eDamageNormTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, "_");
}

function add2eDamagePushTags(out, value) {
  if (!out || value === undefined || value === null || value === "") return;
  if (Array.isArray(value)) return value.forEach(v => add2eDamagePushTags(out, v));
  if (value instanceof Set) return [...value].forEach(v => add2eDamagePushTags(out, v));
  if (typeof value === "object") return Object.values(value).forEach(v => add2eDamagePushTags(out, v));
  if (typeof value !== "string") return;
  for (const part of value.split(/[,;|]/)) {
    const tag = add2eDamageNormTag(part);
    if (tag) out.add(tag);
  }
}

function add2eDamageActiveTags(actor) {
  const tags = new Set();
  add2eDamagePushTags(tags, actor?.system?.tags);
  add2eDamagePushTags(tags, actor?.system?.effectTags);
  add2eDamagePushTags(tags, actor?.flags?.add2e?.tags);
  for (const effect of actor?.effects ?? []) {
    if (effect.disabled) continue;
    add2eDamagePushTags(tags, effect.flags?.add2e?.tags ?? effect.getFlag?.("add2e", "tags") ?? []);
  }
  if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getActiveTags === "function") {
    add2eDamagePushTags(tags, Add2eEffectsEngine.getActiveTags(actor) ?? []);
  }
  return tags;
}

function add2eDamageIsCold(type, details) {
  const t = add2eDamageNormTag(type);
  const d = add2eDamageNormTag(details);
  return ["froid", "cold", "degat:froid", "degats:froid", "degat_froid", "degats_froid"].includes(t) || d.includes("froid") || d.includes("cold");
}

function add2eDamageReadPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function add2eDamageSaveVsSpells(actor) {
  const sys = actor?.system ?? {};
  if (Array.isArray(sys.sauvegardes)) {
    const n = add2eDamageReadPositiveNumber(sys.sauvegardes[4]);
    if (n !== null) return n;
  }
  const candidates = [
    sys.sauvegarde_sortileges,
    sys.sauvegarde_sorts,
    sys.sauvegardes?.sortileges,
    sys.sauvegardes?.sorts,
    sys.saves?.sorts,
    sys.calculatedSaves?.sorts,
    sys.jp_sort,
    sys.jp_sorts,
    sys.jp?.sorts,
    sys.jp?.sortileges
  ];
  for (const raw of candidates) {
    const n = add2eDamageReadPositiveNumber(raw);
    if (n !== null) return n;
  }
  return NaN;
}

function add2eDamageColdSaveBonus(tags) {
  let bonus = 0;
  for (const tag of tags) {
    let match = tag.match(/^bonus_(?:js|save)_vs:froid:(-?\d+)$/);
    if (!match) match = tag.match(/^bonus_(?:js|save)_vs_froid_(-?\d+)$/);
    if (!match) match = tag.match(/^bonus:sauvegarde:froid(?::(-?\d+))?$/);
    if (!match) continue;
    const n = match[1] === undefined ? 3 : Number(match[1]);
    if (Number.isFinite(n)) bonus = Math.max(bonus, n);
  }
  return bonus || 3;
}

async function add2eDamageRollSave(actor, bonus) {
  const saveVal = add2eDamageSaveVsSpells(actor);
  if (!Number.isFinite(saveVal) || saveVal <= 0) {
    return { canRoll: false, saveVal: NaN, total: 0, success: false, bonus };
  }
  const b = Number(bonus) || 0;
  const roll = await new Roll(b ? `1d20${b >= 0 ? "+" : ""}${b}` : "1d20").evaluate({ async: true });
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  return {
    canRoll: true,
    saveVal,
    total: Number(roll.total) || 0,
    success: (Number(roll.total) || 0) >= saveVal,
    bonus: b,
    roll
  };
}

async function add2eDamageResolveColdResistance(actor, amount, type, details) {
  if (!actor || amount <= 0 || !add2eDamageIsCold(type, details)) return { amount, applied: false };

  const tags = add2eDamageActiveTags(actor);
  const protectedByColdResistance = tags.has("resistance:froid") ||
    tags.has("resistance_froid") ||
    tags.has("etat:resistance_froid") ||
    tags.has("sort:resistance_au_froid");

  if (!protectedByColdResistance) return { amount, applied: false };

  const bonus = add2eDamageColdSaveBonus(tags);
  const save = await add2eDamageRollSave(actor, bonus);
  const reduced = save.canRoll && save.success
    ? Math.max(1, Math.floor(amount / 4))
    : Math.max(1, Math.floor(amount / 2));

  return { amount: reduced, applied: true, original: amount, save, bonus };
}

async function add2eDamageColdChat(actor, info) {
  if (!info?.applied) return;
  const saveLine = info.save?.canRoll
    ? `Jet de protection contre les sorts : <b>${info.save.total}</b> / seuil <b>${info.save.saveVal}</b> avec bonus <b>+${info.bonus}</b>`
    : "Jet de protection indisponible : dégâts réduits de moitié.";
  const resultLine = info.save?.canRoll && info.save.success
    ? "Jet réussi : dégâts de froid réduits au quart."
    : "Jet échoué : dégâts de froid réduits de moitié.";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="add2e-chat-card add2e-cold-resistance-card" style="font-family:var(--font-primary);background:#eef7ff;border:1px solid #5aa3d8;border-radius:8px;padding:9px;color:#15344a;">
        <div style="font-weight:900;color:#1f6f9f;font-size:1.05em;margin-bottom:5px;">RÉSISTANCE AU FROID</div>
        <div><b>${actor?.name ?? "La cible"}</b> bénéficie d'une protection contre le froid.</div>
        <div style="margin-top:5px;">${saveLine}</div>
        <div style="margin-top:5px;font-weight:800;">${resultLine}</div>
        <div style="margin-top:5px;">Dégâts : <b>${info.original}</b> → <b>${info.amount}</b></div>
      </div>`
  });
}

export async function add2eApplyDamage({ cible, montant, type = "", details = "" }) {
  if (!cible) {
    ui.notifications.error("Pas de cible !");
    return;
  }

  const baseDmg = Number(montant) || 0;

  if (!game.user.isGM) {
    if (!game.socket) {
      ui.notifications.error("Socket Foundry indisponible (game.socket).");
      return;
    }

    game.socket.emit("system.add2e", {
      type: "applyDamageFlag",
      tokenId: cible.token?.id || (cible instanceof Token ? cible.id : null),
      actorId: cible.actor?.id || cible.id,
      flagData: {
        montant: baseDmg,
        type,
        details,
        source: "attack",
        fromUserId: game.user.id,
        timestamp: Date.now()
      }
    });

    ui.notifications.info(`Dégâts (${baseDmg}) envoyés au MJ.`);
    return;
  }

  const actor = cible.actor || cible;
  const cold = await add2eDamageResolveColdResistance(actor, baseDmg, type, details);
  const dmg = cold.amount;

  const maxHP = Number(actor.system?.points_de_coup) || 0;
  let currentHP = actor.system?.pdv;
  if (currentHP === undefined || currentHP === null || currentHP === "" || isNaN(Number(currentHP))) {
    currentHP = maxHP;
  } else {
    currentHP = Number(currentHP) || 0;
  }

  const newHP = currentHP - dmg;
  await actor.update({ "system.pdv": newHP });
  await add2eDamageColdChat(actor, cold);

  try {
    const DEAD_STATUS = "dead";
    const UNCONSCIOUS_STATUS = "unconscious";
    const toggleStatus = async (id, options) => {
      if (!id) return;
      await actor.toggleStatusEffect(id, options);
    };

    if (newHP <= -11) {
      await toggleStatus(UNCONSCIOUS_STATUS, { active: false, overlay: false });
      await toggleStatus(DEAD_STATUS, { active: true, overlay: true });
    } else if (newHP <= 0) {
      await toggleStatus(DEAD_STATUS, { active: false, overlay: false });
      await toggleStatus(UNCONSCIOUS_STATUS, { active: true, overlay: true });
    } else {
      await toggleStatus(DEAD_STATUS, { active: false, overlay: false });
      await toggleStatus(UNCONSCIOUS_STATUS, { active: false, overlay: false });
    }
  } catch (e) {
    console.warn("ADD2E SOCKET | Erreur mise à jour overlay HP :", e);
  }

  ui.notifications.info(`${actor.name} prend ${dmg} dégât(s).`);
}

globalThis.add2eApplyDamage = add2eApplyDamage;
globalThis.ADD2E_DAMAGE_VERSION = ADD2E_DAMAGE_VERSION;
