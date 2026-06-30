// ADD2E — Soins mineurs / Blessures mineures (Clerc niveau 1)
// Compatible Foundry V13/V14/V15.
// Deux sorts distincts : aucun choix de facette.

const __add2eMinorCureResult = await (async () => {
  const CURE = "Soins mineurs";
  const WOUNDS = "Blessures mineures";
  const FORMULA = "1d8";
  const FALLBACK_ICON = "systems/add2e/assets/icones/sorts/soins-mineurs.webp";
  const COLORS = {
    main: "#b88924",
    dark: "#6f4b12",
    pale: "#fff7df",
    pale2: "#fffaf0",
    border: "#e2bc63",
    borderDark: "#8a611d",
    success: "#2f8f46",
    fail: "#b33a2e"
  };

  const norm = value => String(value ?? "")
    .trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  const chatStyle = () => CONST.CHAT_MESSAGE_STYLES
    ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
    : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };

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

  const family = spell.flags?.add2e?.spellFamily ?? {};
  const reversibleEntry = spell.flags?.add2e?.reversibleActorEntry ?? {};
  const inverseFamily = family.kind === "inverse"
    || family.reversibleMode === "inverse"
    || reversibleEntry.mode === "inverse";
  const names = [spell.name, spell.system?.nom, spell.system?.label, spell.system?.slug].map(norm);
  const namedWounds = names.includes("blessures_mineures") || names.includes("blessure_mineure");
  const namedCure = names.includes("soins_mineurs") || names.includes("soin_mineur");
  const isWounds = inverseFamily || namedWounds;
  const isCure = !isWounds && namedCure;
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
    ?? (canvas?.tokens?.controlled ?? []).find(tokenDoc => tokenDoc?.actor?.id === caster.id || tokenDoc?.document?.actorId === caster.id)
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

  async function createAdd2eSpellCard({ title, targetName, status, resultHtml, rule }) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      content: `<div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,${COLORS.pale2} 0%,${COLORS.pale} 100%);border:1.5px solid ${COLORS.border};overflow:hidden;padding:0;font-family:var(--font-primary);">
        <div style="background:linear-gradient(90deg,${COLORS.dark} 0%,${COLORS.main} 100%);padding:8px 12px;color:#fff;display:flex;align-items:center;gap:10px;border-bottom:2px solid ${COLORS.borderDark};">
          <img src="${esc(caster.img ?? "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
          <div style="line-height:1.2;flex:1;"><div style="font-weight:bold;font-size:1.05em;">${esc(caster.name ?? "Lanceur")}</div><div style="font-size:.85em;opacity:.95;">lance <b>${esc(title)}</b></div></div>
          <img src="${esc(spell.img ?? FALLBACK_ICON)}" style="width:32px;height:32px;border-radius:4px;background:#fff;object-fit:cover;">
        </div>
        <div style="padding:10px;color:${COLORS.dark};">
          <div style="margin-bottom:7px;font-size:.95em;"><b>Cible :</b> ${esc(targetName)}</div>
          <div style="border:1px solid ${COLORS.border};background:#fffdf4;border-radius:7px;padding:8px;text-align:center;">${resultHtml}</div>
          <details style="margin-top:8px;background:#fff;border:1px solid ${COLORS.border};border-radius:6px;"><summary style="cursor:pointer;color:${COLORS.dark};font-weight:600;padding:6px;">Règle appliquée</summary><div style="padding:8px;font-size:.85em;line-height:1.45;">${esc(rule)}</div></details>
        </div>
      </div>`,
      ...chatStyle()
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
    await createAdd2eSpellCard({
      title: CURE,
      targetName: target.name,
      status: "SOINS MINEURS",
      resultHtml: `<div style="font-weight:900;color:${COLORS.success};">SOINS RÉUSSIS</div><div style="margin-top:4px;">Jet : <b>1d8</b> = <b>${Number(healing.total) || 0}</b></div><div>PV rendus : <b>${restored}</b>${restored < (Number(healing.total) || 0) ? " (limite par le maximum)" : ""}</div><div style="font-size:.84em;color:#6b5a35;margin-top:4px;">${before} → ${after} PV</div>`,
      rule: "Au toucher, le sort rend 1d8 points de vie sans dépasser le maximum normal. Il n’affecte pas les morts-vivants ni les créatures sans corps matériel."
    });
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
      id, _id: id, type: "arme", name: WOUNDS, img: spell.img ?? FALLBACK_ICON,
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
  await createAdd2eSpellCard({
    title: WOUNDS,
    targetName: target.name,
    status: "BLESSURES MINEURES",
    resultHtml: `<div style="font-weight:900;color:${COLORS.fail};">BLESSURES INFLIGÉES</div><div style="margin-top:4px;">Jet : <b>1d8</b> = <b>${Number(damage.total) || 0}</b></div><div>Dégâts infligés : <b>${Number(damage.total) || 0}</b></div>`,
    rule: "La forme inversée inflige 1d8 dégâts au toucher. Contre un monstre, le système résout toujours un jet de toucher normal."
  });
  return true;
})();

return __add2eMinorCureResult;