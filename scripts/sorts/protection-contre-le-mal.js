// ADD2E — Protection contre le Mal / Protection contre le Bien
// Compatible Foundry V13/V14/V15.

const ADD2E_PROTECTION_VFX_VERSION = "2026-06-30-protection-visible-aura-scale-v9";

const __add2eProtectionResult = await (async () => {
  const normalize = value => String(value ?? "").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "")
    .replace(/[^a-z0-9:]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  const escapeHtml = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
  const chatStyle = () => CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
  const sourceItem = typeof sort !== "undefined" && sort ? sort : typeof item !== "undefined" && item ? item : typeof spell !== "undefined" && spell ? spell : typeof args !== "undefined" && args?.[0]?.item ? args[0].item : typeof this !== "undefined" && this?.documentName === "Item" ? this : null;
  if (!sourceItem) return ui.notifications.error("Protection : sort introuvable."), false;

  const caster = typeof actor !== "undefined" && actor ? actor : sourceItem.parent;
  if (!caster) return ui.notifications.error("Protection : lanceur introuvable."), false;
  const casterToken = canvas.tokens?.controlled?.find(t => t?.actor?.id === caster.id) ?? (typeof token !== "undefined" && token?.actor?.id === caster.id ? token : null) ?? caster.getActiveTokens?.()[0] ?? null;
  if (!casterToken) return ui.notifications.warn("Protection : sélectionne le token du lanceur."), false;

  const flags = sourceItem.flags?.add2e ?? {};
  const values = [sourceItem.name, sourceItem.system?.nom, sourceItem.system?.slug, sourceItem.system?.spellKey, flags.spellKey, flags.slug, flags.reversibleActorEntry?.name, flags.reversibleActorEntry?.displayName];
  let mode = null;
  for (const value of values) {
    const key = normalize(value);
    if (key.includes("protection_contre_le_bien") || key === "bien") { mode = "bien"; break; }
    if (key.includes("protection_contre_le_mal") || key === "mal") { mode = "mal"; break; }
  }
  if (!mode) {
    const reversibleMode = normalize(flags.reversibleActorEntry?.mode ?? flags.spellFamily?.reversibleMode);
    if (["inverse", "bien"].includes(reversibleMode)) mode = "bien";
    if (["normal", "base", "mal"].includes(reversibleMode)) mode = "mal";
  }
  if (!mode) return ui.notifications.error(`Protection : variante introuvable pour « ${sourceItem.name ?? "sans nom"} ».`), false;

  const isGood = mode === "bien";
  const modeInfo = {
    label: isGood ? "Protection contre le Bien" : "Protection contre le Mal",
    spellKey: isGood ? "protection_contre_le_bien" : "protection_contre_le_mal",
    vfx: isGood
      ? "jb2a.aura_themed.01.inward"
      : "modules/JB2A_DnD5e/Library/Generic/Template/Circle/Aura/AuraThemedOutwardCompleteCold01_01_Regular_Blue_700x700.webm",
    vfxScale: isGood ? 1.1 : 1.75,
    alignmentLabel: isGood ? "bonnes" : "mauvaises",
    tags: isGood ? ["sort:protection_contre_le_bien", "protection:bien", "bonus_save:2", "malus_attaque_vs:bon:2"] : ["sort:protection_contre_le_mal", "protection:mal", "bonus_save:2", "malus_attaque_vs:mauvais:2"],
    rule: isGood ? { kind: "block_action", action: "attaque", requireContact: true, subjectAllTags: ["creature:enchantee", "alignement:mauvais"], actionAllTags: ["type_arme:naturelle"], label: "La barrière magique tient cette créature enchantée mauvaise à distance." } : { kind: "block_action", action: "attaque", requireContact: true, subjectAnyTags: ["creature:enchantee", "creature:animal", "creature:invoquee"], actionAllTags: ["type_arme:naturelle"], label: "La barrière magique empêche cette attaque naturelle de toucher la cible." },
    barrierText: isGood ? "Les attaques naturelles au contact des créatures enchantées mauvaises sont bloquées." : "Les attaques naturelles au contact des créatures enchantées, des animaux et des monstres invoqués sont bloquées."
  };

  const targets = Array.from(game.user.targets ?? []);
  const targetToken = targets.length === 1 ? targets[0] : null;
  if (!targetToken?.actor) return ui.notifications.warn(`${modeInfo.label} : cible exactement une créature touchée.`), false;
  const grid = canvas.grid?.size || 100;
  const sourceDoc = casterToken.document;
  const targetDoc = targetToken.document;
  const inTouch = casterToken.id === targetToken.id || (Math.max(0, targetDoc.x / grid - (sourceDoc.x / grid + (sourceDoc.width || 1)), sourceDoc.x / grid - (targetDoc.x / grid + (targetDoc.width || 1))) <= .01 && Math.max(0, targetDoc.y / grid - (sourceDoc.y / grid + (sourceDoc.height || 1)), sourceDoc.y / grid - (targetDoc.y / grid + (targetDoc.height || 1))) <= .01);
  if (!inTouch) return ui.notifications.warn(`${modeInfo.label} : la cible doit être au toucher.`), false;

  const positive = value => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
  };
  const cleric = Array.from(caster.items ?? []).find(entry => entry?.type === "classe" && [entry.name, entry.system?.label, entry.system?.nom, entry.system?.slug].map(normalize).some(key => key === "clerc" || key.includes("clerc")));
  const level = [cleric?.system?.niveau, cleric?.system?.level, caster.system?.details_classe?.clerc?.niveau, caster.system?.details_classe?.clerc?.level, caster.system?.classes?.clerc?.niveau, caster.system?.classes?.clerc?.level, caster.system?.multiclass?.clerc?.niveau, caster.system?.multiclass?.clerc?.level, caster.system?.niveaux?.clerc, caster.flags?.add2e?.multiclass?.clerc?.niveau, caster.flags?.add2e?.multiclass?.clerc?.level, caster.system?.niveau, caster.system?.level, caster.system?.details?.niveau, caster.system?.details?.level].map(positive).find(Number.isFinite) ?? 1;
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const rounds = time?.toRounds?.("level*3", "round", { level }) ?? level * 3;
  const endMessage = isGood ? "La protection contre le bien de {actor} prend fin." : "La protection contre le mal de {actor} prend fin.";
  const duration = time?.durationData?.(rounds) ?? { rounds, startRound: game.combat?.round ?? null, startTurn: game.combat?.turn ?? null, startTime: game.time?.worldTime ?? null, combat: game.combat?.id ?? null };
  const timeFlags = time?.flags?.({ source: "protection-contre-le-mal.js", rounds, unit: "round", endMessage, extra: {} }) ?? { timeEngine: { managed: true, unit: "round", totalRounds: rounds }, roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage }, endMessage };
  const effectData = { name: modeInfo.label, img: sourceItem.img || "systems/add2e/assets/icones/sorts/protection-contre-le-mal.webp", origin: sourceItem.uuid ?? null, disabled: false, transfer: false, duration, changes: [], description: `${modeInfo.label}. Attaques de l'alignement concerné : –2 ; jets de protection : +2. ${modeInfo.barrierText} Durée : ${rounds} rounds.`, flags: { add2e: { ...timeFlags, spellName: modeInfo.label, spellKey: modeInfo.spellKey, level, sourceItemUuid: sourceItem.uuid ?? null, casterId: caster.id, casterUuid: caster.uuid ?? null, targetId: targetToken.actor.id, targetUuid: targetToken.actor.uuid ?? null, tags: modeInfo.tags, rules: [modeInfo.rule] } } };

  const isProtection = effect => {
    const effectFlags = effect?.flags?.add2e ?? {};
    const spellKey = normalize(effectFlags.spellKey ?? effectFlags.spell?.slug);
    const tags = Array.isArray(effectFlags.tags) ? effectFlags.tags.map(normalize) : [];
    return ["protection_contre_le_mal", "protection_contre_le_bien"].includes(spellKey) || tags.includes("sort:protection_contre_le_mal") || tags.includes("sort:protection_contre_le_bien");
  };
  const priorIds = Array.from(targetToken.actor.effects ?? []).filter(isProtection).map(effect => effect.id).filter(Boolean);
  if (game.user.isGM || targetToken.actor.isOwner) {
    if (priorIds.length) await targetToken.actor.deleteEmbeddedDocuments("ActiveEffect", priorIds);
    await targetToken.actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  } else {
    if (!game.socket) return ui.notifications.error("Protection : socket indisponible."), false;
    game.socket.emit("system.add2e", { type: "ADD2E_GM_OPERATION", operation: "createActiveEffect", payload: { actorUuid: targetToken.actor.uuid, actorId: targetToken.actor.id, effectData, fromUserId: game.user.id, sentAt: Date.now() } });
  }

  const effectName = `add2e-protection-ward:${canvas.scene?.id ?? "scene"}:${targetToken.id}`;
  const stopVfx = tokenDoc => {
    const name = `add2e-protection-ward:${canvas.scene?.id ?? "scene"}:${tokenDoc?.id ?? tokenDoc?.document?.id ?? ""}`;
    try { globalThis.Sequencer?.EffectManager?.endEffects?.({ name, object: tokenDoc }); } catch (_error) {}
    try { globalThis.Sequencer?.EffectManager?.endEffects?.({ name }); } catch (_error) {}
  };
  if (globalThis.ADD2E_PROTECTION_WARD_HOOKS_VERSION !== ADD2E_PROTECTION_VFX_VERSION) {
    globalThis.ADD2E_PROTECTION_WARD_HOOKS_VERSION = ADD2E_PROTECTION_VFX_VERSION;
    const clearWard = effect => {
      if (!isProtection(effect)) return;
      for (const activeToken of effect.parent?.getActiveTokens?.() ?? []) stopVfx(activeToken);
    };
    Hooks.on("deleteActiveEffect", clearWard);
    Hooks.on("updateActiveEffect", (effect, changes) => { if (changes?.disabled === true || changes?.disabled === 1) clearWard(effect); });
  }
  try {
    const isDirectFile = modeInfo.vfx.includes("/");
    const available = isDirectFile || typeof globalThis.Sequencer?.Database?.getEntry !== "function" || !!globalThis.Sequencer.Database.getEntry(modeInfo.vfx);
    if (available && typeof Sequence !== "undefined") {
      stopVfx(targetToken);
      await new Sequence()
        .effect()
        .file(modeInfo.vfx)
        .attachTo(targetToken)
        .persist(true)
        .name(effectName)
        .belowTokens(false)
        .scaleToObject(modeInfo.vfxScale, { uniform: true, considerTokenScale: true })
        .opacity(.95)
        .play();
    }
  } catch (_error) {}

  const card = `<div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,#fffaf0,#fff7df);border:1.5px solid #e2bc63;overflow:hidden;padding:0;font-family:var(--font-primary);"><div style="background:linear-gradient(90deg,#6f4b12,#b88924);padding:8px 12px;color:#fff;display:flex;align-items:center;gap:10px;border-bottom:2px solid #8a611d;"><img src="${escapeHtml(caster.img || "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;"><div style="line-height:1.2;flex:1;"><div style="font-weight:bold;font-size:1.05em;">${escapeHtml(caster.name)}</div><div style="font-size:.85em;opacity:.95;">lance <b>${escapeHtml(modeInfo.label)}</b></div></div><img src="${escapeHtml(sourceItem.img || "systems/add2e/assets/icones/sorts/protection-contre-le-mal.webp")}" style="width:32px;height:32px;border-radius:4px;background:#fff;object-fit:cover;"></div><div style="padding:10px;color:#6f4b12;"><div style="margin-bottom:7px;font-size:.95em;"><b>Cible :</b> ${escapeHtml(targetToken.name ?? targetToken.actor.name)}</div><div style="text-align:center;border:1px solid #e2bc63;border-radius:7px;padding:8px;background:#fffdf7;"><b>${escapeHtml(modeInfo.label.toUpperCase())}</b><br>Durée : <b>${rounds} rounds</b></div><div style="display:flex;gap:6px;margin-top:7px;"><span style="flex:1;text-align:center;border:1px solid #e2bc63;border-radius:5px;padding:5px;background:#fff;"><b>Attaques ${escapeHtml(modeInfo.alignmentLabel)}</b><br><b>–2</b></span><span style="flex:1;text-align:center;border:1px solid #e2bc63;border-radius:5px;padding:5px;background:#fff;"><b>Jets de protection</b><br><b>+2</b></span></div><div style="margin-top:7px;padding:7px 8px;border-left:4px solid #b88924;background:#fff9e9;border-radius:4px;font-size:.88em;line-height:1.35;">${escapeHtml(modeInfo.barrierText)}</div></div></div>`;
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }), content: card, ...chatStyle() });
  return true;
})();

return __add2eProtectionResult === true ? true : false;
