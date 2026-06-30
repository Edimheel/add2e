// ADD2E — Soins mineurs / Blessures mineures (Clerc niveau 1)
// Compatible Foundry V13/V14/V15.
// Les deux sorts sont distincts : aucun choix de facette.

const __add2eMinorCureResult = await (async () => {
  const CURE = "Soins mineurs";
  const WOUNDS = "Blessures mineures";
  const FORMULA = "1d8";

  const norm = value => String(value ?? "")
    .trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  const spell = typeof sourceItem !== "undefined" && sourceItem
    ? sourceItem
    : typeof sort !== "undefined" && sort
      ? sort
      : typeof item !== "undefined" && item
        ? item
        : null;
  const caster = typeof actor !== "undefined" && actor ? actor : spell?.parent ?? null;
  if (!spell || !caster) {
    ui.notifications?.error?.("Sort ou lanceur introuvable.");
    return false;
  }

  const names = [spell.name, spell.system?.nom, spell.system?.label].map(norm);
  const isWounds = names.includes("blessures_mineures") || names.includes("blessure_mineure");
  const isCure = names.includes("soins_mineurs") || names.includes("soin_mineur");
  const label = isWounds ? WOUNDS : CURE;
  if (!isWounds && !isCure) {
    ui.notifications?.error?.(`Sort non reconnu : ${spell.name ?? "sans nom"}.`);
    return false;
  }

  const targets = Array.from(game.user?.targets ?? []).filter(tokenDoc => tokenDoc?.actor);
  if (targets.length !== 1) {
    ui.notifications?.warn?.(`${label} : cible exactement une créature.`);
    return false;
  }
  const targetToken = targets[0];
  const target = targetToken.actor;
  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster.id ? token : null)
    ?? (canvas?.tokens?.controlled ?? []).find(tokenDoc => tokenDoc?.actor?.id === caster.id)
    ?? caster.getActiveTokens?.()[0]
    ?? null;

  const bounds = tokenDoc => {
    const object = tokenDoc?.object ?? tokenDoc;
    const document = object?.document ?? tokenDoc?.document ?? tokenDoc ?? {};
    const grid = Number(canvas?.grid?.size) || 100;
    return {
      x: Number(object?.x ?? document?.x ?? 0),
      y: Number(object?.y ?? document?.y ?? 0),
      w: Number(object?.w ?? Number(document?.width ?? 1) * grid),
      h: Number(object?.h ?? Number(document?.height ?? 1) * grid)
    };
  };
  const atTouch = (first, second) => {
    if (!first || !second) return false;
    if (first === second || first?.id === second?.id || first?.document?.id === second?.document?.id) return true;
    const a = bounds(first);
    const b = bounds(second);
    const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
    const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
    return gapX <= 1 && gapY <= 1;
  };

  if (target.id !== caster.id && (!casterToken || !atTouch(casterToken, targetToken))) {
    ui.notifications?.warn?.(`${label} : la cible doit être au toucher.`);
    return false;
  }

  const tags = actorDoc => {
    const engineTags = globalThis.Add2eEffectsEngine?.getContextTags?.(actorDoc)
      ?? globalThis.Add2eEffectsEngine?.getActiveTags?.(actorDoc)
      ?? [];
    return [
      ...engineTags, actorDoc?.type, actorDoc?.system?.tags,
      actorDoc?.system?.effectTags, actorDoc?.system?.type_monstre
    ].flatMap(value => Array.isArray(value) ? value : String(value ?? "").split(/[,;|\n]+/g)).map(norm);
  };
  const cannotHeal = actorDoc => tags(actorDoc).some(tag =>
    tag.includes("mort_vivant") || tag.includes("undead") || tag.includes("incorporel")
    || tag.includes("incorporeal") || tag.includes("immateriel") || tag.includes("ethereal")
  );
  const isMonster = ["monstre", "monster"].includes(norm(target.type));

  async function roll(formula) {
    const result = await new Roll(formula).evaluate();
    if (game.dice3d) await game.dice3d.showForRoll(result);
    return result;
  }

  async function card(title, text, harmful = false) {
    const color = harmful ? "#84372e" : "#2f6f3e";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      content: `<div class="add2e-chat-card" style="border:1px solid ${color};border-radius:8px;overflow:hidden;background:#fffdf7;font-family:var(--font-primary);"><header style="background:${color};color:#fff;padding:8px 10px;display:flex;gap:8px;align-items:center;"><img src="${esc(spell.img ?? "icons/svg/d20.svg")}" style="width:30px;height:30px;border-radius:4px;"><b>${esc(title)}</b></header><div style="padding:9px;line-height:1.4;">${text}</div></div>`,
      ...(CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 })
    });
  }

  if (isCure) {
    if (cannotHeal(target)) {
      ui.notifications?.warn?.(`${CURE} : cette cible ne peut pas recevoir de soins vitaux.`);
      return false;
    }
    const healing = await roll(FORMULA);
    const max = Number(target.system?.points_de_coup ?? target.system?.pdv_max);
    const before = Number(target.system?.pdv ?? 0);
    if (!Number.isFinite(max)) {
      ui.notifications?.error?.(`${CURE} : PV maximum introuvables.`);
      return false;
    }
    const restored = Math.min(Math.max(0, Number(healing.total) || 0), Math.max(0, max - before));
    const after = before + restored;
    if (game.user?.isGM || target.isOwner) {
      await target.update({ "system.pdv": after }, { add2eReason: "soins-mineurs" });
      await globalThis.add2eSyncActorVitalStatus?.(target, { reason: "soins-mineurs" });
    } else if (typeof game.add2e?.requestGM === "function") {
      game.add2e.requestGM({ type: "applyDamage", actorId: target.id, montant: -restored });
    } else {
      ui.notifications?.error?.(`${CURE} : droits insuffisants pour soigner ${target.name}.`);
      return false;
    }
    await globalThis.ADD2E_PLAY_SPELL_FX?.("divine", { casterToken, targetToken });
    await card(CURE, `<b>${esc(target.name)}</b> récupère <b>${restored}</b> PV (${before} → ${after}).<br><small>Jet : ${esc(healing.result)}.</small>`);
    return true;
  }

  if (isMonster) {
    const attack = globalThis.add2eAttackRoll;
    if (typeof attack !== "function") {
      ui.notifications?.error?.(`${WOUNDS} : routine d’attaque indisponible.`);
      return false;
    }
    const id = foundry.utils.randomID();
    const touchTags = [
      "arme:toucher", "type_arme:toucher", "attaque:toucher", "attaque_speciale:contact",
      "usage:contact", "sort:blessures_mineures", "mod_carac:toucher:none", "mod_carac:degats:none"
    ];
    const touchWeapon = {
      id, _id: id, type: "arme", name: WOUNDS, img: spell.img,
      system: {
        nom: WOUNDS, equipee: true, equipped: true, categorie: "contact", category: "contact",
        type_arme: "toucher", type_degats: "magique", degats: FORMULA,
        dégâts: { contre_moyen: FORMULA, contre_grand: FORMULA },
        bonus_hit: 0, bonus_dom: 0, portee_courte: 0, portee_moyenne: 0, portee_longue: 0,
        tags: touchTags, effectTags: touchTags
      },
      flags: { add2e: { tags: touchTags } }
    };
    return (await attack({ actor: caster, arme: touchWeapon, token: casterToken, targetToken })) === true;
  }

  const damage = await roll(FORMULA);
  if (typeof globalThis.add2eApplyDamage !== "function") {
    ui.notifications?.error?.(`${WOUNDS} : routine de dégâts indisponible.`);
    return false;
  }
  await globalThis.add2eApplyDamage({
    cible: targetToken,
    montant: Number(damage.total) || 0,
    type: "magique",
    details: WOUNDS
  });
  await card(WOUNDS, `<b>${esc(target.name)}</b> reçoit <b>${Number(damage.total) || 0}</b> dégâts.<br><small>Jet : ${esc(damage.result)}.</small>`, true);
  return true;
})();

return __add2eMinorCureResult;