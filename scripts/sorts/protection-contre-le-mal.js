// ADD2E — Protection contre le Mal / Protection contre le Bien
<<<<<<< Updated upstream
// Version : 2026-06-29-protection-generic-action-rule-v5
// Compatible Foundry V13/V14/V15.

const ADD2E_PROTECTION_VFX_VERSION = "2026-06-29-protection-generic-action-rule-v5";
=======
<<<<<<< HEAD
// Version : 2026-06-29-protection-manuel-effects-v4
// Compatible Foundry V13/V14/V15.

const ADD2E_PROTECTION_VFX_VERSION = "2026-06-29-protection-manuel-effects-v4";
=======
// Version : 2026-06-29-protection-generic-action-rule-v5
// Compatible Foundry V13/V14/V15.

const ADD2E_PROTECTION_VFX_VERSION = "2026-06-29-protection-generic-action-rule-v5";
>>>>>>> da5d0e7c2888427a76bfe6ef5fcbc6e3e3577148
>>>>>>> Stashed changes

const __add2eOnUseResult = await (async () => {
  const normalize = value => String(value ?? "").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9:]+/g, "_")
    .replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  const toArray = value => value === undefined || value === null || value === "" ? []
    : Array.isArray(value) ? value.flatMap(toArray)
      : value instanceof Set ? [...value]
        : typeof value?.values === "function" && typeof value !== "string" ? [...value.values()]
          : [value];
  const esc = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
  const style = () => CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
  const sourceItem = typeof sort !== "undefined" && sort ? sort
    : typeof item !== "undefined" && item ? item
      : typeof spell !== "undefined" && spell ? spell
        : typeof args !== "undefined" && args?.[0]?.item ? args[0].item : null;
  if (!sourceItem) { ui.notifications.error("Protection : sort introuvable."); return false; }

  const actorDoc = typeof actor !== "undefined" && actor ? actor : sourceItem.parent;
  if (!actorDoc) { ui.notifications.error("Protection : lanceur introuvable."); return false; }
  const casterToken = canvas.tokens?.controlled?.find(t => t?.actor?.id === actorDoc.id)
    ?? (typeof token !== "undefined" && token?.actor?.id === actorDoc.id ? token : null)
    ?? actorDoc.getActiveTokens?.()[0] ?? null;
  if (!casterToken) { ui.notifications.warn("Protection : sélectionne le token du lanceur."); return false; }

  const flags = sourceItem.flags?.add2e ?? {};
  const identifyMode = value => {
    const key = normalize(value);
    const good = key.includes("protection_contre_le_bien") || key === "bien";
    const evil = key.includes("protection_contre_le_mal") || key === "mal";
    return good === evil ? null : (good ? "bien" : "mal");
  };
  let mode = null;
  for (const value of [sourceItem.name, sourceItem.system?.nom, flags?.reversibleActorEntry?.name, flags?.reversibleActorEntry?.displayName, sourceItem.system?.slug, sourceItem.system?.spellKey, flags?.spellKey, flags?.slug]) {
    mode = identifyMode(value);
    if (mode) break;
  }
  if (!mode) {
    const reversibleMode = normalize(flags?.reversibleActorEntry?.mode ?? flags?.spellFamily?.reversibleMode);
    if (["inverse", "bien"].includes(reversibleMode)) mode = "bien";
    if (["normal", "base", "mal"].includes(reversibleMode)) mode = "mal";
  }
  if (!mode) { ui.notifications.error(`Protection : variante introuvable pour « ${sourceItem.name ?? "sans nom"} ».`); return false; }

  const isGood = mode === "bien";
  const modeInfo = {
    key: isGood ? "bien" : "mal",
    label: isGood ? "Protection contre le Bien" : "Protection contre le Mal",
    spellKey: isGood ? "protection_contre_le_bien" : "protection_contre_le_mal",
    jb2aKey: isGood ? "jb2a.aura_themed.01.inward" : "jb2a.ward.rune.yellow",
    tags: isGood
<<<<<<< Updated upstream
=======
<<<<<<< HEAD
      ? ["sort:protection_contre_le_bien", "protection:bien", "bonus_save:2", "malus_attaque_vs:bon:2", "barriere_contact:creature_enchantee_mauvaise:naturelle"]
      : ["sort:protection_contre_le_mal", "protection:mal", "bonus_save:2", "malus_attaque_creature_mauvaise:2", "barriere_contact:creature_enchantee_ou_invoquee:naturelle"]
=======
>>>>>>> Stashed changes
      ? ["sort:protection_contre_le_bien", "protection:bien", "bonus_save:2", "malus_attaque_vs:bon:2"]
      : ["sort:protection_contre_le_mal", "protection:mal", "bonus_save:2", "malus_attaque_vs:mauvais:2"],
    rules: [{
      kind: "block_action",
      action: "attaque",
      requireContact: true,
      subjectAnyTags: ["creature:enchantee", "creature:invoquee"],
      actionAllTags: ["type_arme:naturelle"],
      label: "La barrière magique empêche cette attaque naturelle de toucher la cible."
    }]
<<<<<<< Updated upstream
=======
>>>>>>> da5d0e7c2888427a76bfe6ef5fcbc6e3e3577148
>>>>>>> Stashed changes
  };

  const targets = Array.from(game.user.targets ?? []);
  if (targets.length !== 1 || !targets[0]?.actor) { ui.notifications.warn(`${modeInfo.label} : cible exactement une créature touchée.`); return false; }
  const targetToken = targets[0];
  const gridSize = canvas.grid?.size || 100;
  const a = casterToken.document, b = targetToken.document;
  const touch = casterToken.id === targetToken.id || (
    Math.max(0, b.x / gridSize - (a.x / gridSize + (a.width || 1)), a.x / gridSize - (b.x / gridSize + (b.width || 1))) <= .01 &&
    Math.max(0, b.y / gridSize - (a.y / gridSize + (a.height || 1)), a.y / gridSize - (b.y / gridSize + (b.height || 1))) <= .01
  );
  if (!touch) { ui.notifications.warn(`${modeInfo.label} : la cible doit être au toucher.`); return false; }

  const level = (() => {
    for (const value of [actorDoc.system?.niveau, actorDoc.system?.level, actorDoc.system?.details?.niveau, actorDoc.system?.details?.level]) {
      const number = Number(value); if (Number.isFinite(number) && number > 0) return number;
    }
    return 1;
  })();
  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const rounds = time?.toRounds?.("level*3", "round", { level }) ?? Math.max(1, level) * 3;
  const duration = time?.durationData?.(rounds) ?? { rounds, startRound: game.combat?.round ?? null, startTurn: game.combat?.turn ?? null, startTime: game.time?.worldTime ?? null, combat: game.combat?.id ?? null };
  const endMessage = isGood ? "La protection contre le bien de {actor} prend fin." : "La protection contre le mal de {actor} prend fin.";
  const timeFlags = time?.flags?.({ source: "protection-contre-le-mal.js", rounds, unit: "round", endMessage, extra: {} }) ?? { timeEngine: { managed: true, unit: "round", totalRounds: rounds }, roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage }, endMessage };
  const effectData = {
    name: modeInfo.label,
    img: sourceItem.img || "systems/add2e/assets/icones/sorts/protection-contre-le-mal.webp",
    origin: sourceItem.uuid ?? null,
    disabled: false,
    transfer: false,
    duration,
<<<<<<< Updated upstream
    description: `${modeInfo.label}. Attaques de l'alignement concerné : –2 ; jets de protection : +2. Les attaques naturelles au contact des créatures enchantées ou invoquées sont bloquées. Durée : ${rounds} rounds.`,
    flags: { add2e: { ...timeFlags, spellName: modeInfo.label, spellKey: modeInfo.spellKey, level, sourceItemUuid: sourceItem.uuid ?? null, casterId: actorDoc.id ?? null, casterUuid: actorDoc.uuid ?? null, targetId: targetToken.actor.id ?? null, targetUuid: targetToken.actor.uuid ?? null, tags: modeInfo.tags, rules: modeInfo.rules } },
=======
<<<<<<< HEAD
    description: `${modeInfo.label}. Attaques de l’alignement concerné : –2 ; jets de protection : +2. Durée : ${rounds} rounds.`,
    flags: { add2e: { ...timeFlags, spellName: modeInfo.label, spellKey: modeInfo.spellKey, level, sourceItemUuid: sourceItem.uuid ?? null, casterId: actorDoc.id ?? null, casterUuid: actorDoc.uuid ?? null, targetId: targetToken.actor.id ?? null, targetUuid: targetToken.actor.uuid ?? null, tags: modeInfo.tags } },
=======
    description: `${modeInfo.label}. Attaques de l’alignement concerné : –2 ; jets de protection : +2. Les attaques naturelles au contact des créatures enchantées ou invoquées sont bloquées. Durée : ${rounds} rounds.`,
    flags: { add2e: { ...timeFlags, spellName: modeInfo.label, spellKey: modeInfo.spellKey, level, sourceItemUuid: sourceItem.uuid ?? null, casterId: actorDoc.id ?? null, casterUuid: actorDoc.uuid ?? null, targetId: targetToken.actor.id ?? null, targetUuid: targetToken.actor.uuid ?? null, tags: modeInfo.tags, rules: modeInfo.rules } },
>>>>>>> da5d0e7c2888427a76bfe6ef5fcbc6e3e3577148
>>>>>>> Stashed changes
    changes: []
  };

  const isProtection = effect => {
    const activeFlags = effect?.flags?.add2e ?? {};
    const spellKey = normalize(activeFlags.spellKey ?? activeFlags.spell?.slug);
<<<<<<< Updated upstream
    const activeTags = toArray(activeFlags.tags).map(normalize);
    return ["protection_contre_le_mal", "protection_contre_le_bien"].includes(spellKey) || activeTags.includes("sort:protection_contre_le_mal") || activeTags.includes("sort:protection_contre_le_bien");
=======
<<<<<<< HEAD
    const tags = toArray(activeFlags.tags).map(normalize);
    return ["protection_contre_le_mal", "protection_contre_le_bien"].includes(spellKey) || tags.includes("sort:protection_contre_le_mal") || tags.includes("sort:protection_contre_le_bien");
=======
    const activeTags = toArray(activeFlags.tags).map(normalize);
    return ["protection_contre_le_mal", "protection_contre_le_bien"].includes(spellKey) || activeTags.includes("sort:protection_contre_le_mal") || activeTags.includes("sort:protection_contre_le_bien");
>>>>>>> da5d0e7c2888427a76bfe6ef5fcbc6e3e3577148
>>>>>>> Stashed changes
  };
  const removeIds = Array.from(targetToken.actor.effects ?? []).filter(isProtection).map(effect => effect.id).filter(Boolean);
  if (game.user.isGM || targetToken.actor.isOwner) {
    if (removeIds.length) await targetToken.actor.deleteEmbeddedDocuments("ActiveEffect", removeIds);
    await targetToken.actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  } else {
<<<<<<< Updated upstream
    if (!game.socket) { ui.notifications.error("Protection : socket indisponible."); return false; }
    game.socket.emit("system.add2e", { type: "ADD2E_GM_OPERATION", operation: "createActiveEffect", payload: { actorUuid: targetToken.actor.uuid, actorId: targetToken.actor.id, effectData, fromUserId: game.user.id, sentAt: Date.now() } });
=======
<<<<<<< HEAD
    game.socket?.emit?.("system.add2e", { type: "ADD2E_GM_OPERATION", operation: "createActiveEffect", payload: { actorUuid: targetToken.actor.uuid, actorId: targetToken.actor.id, effectData, fromUserId: game.user.id, sentAt: Date.now() } });
>>>>>>> Stashed changes
  }

  const vfxName = `add2e-protection-ward:${canvas.scene?.id ?? "scene"}:${targetToken.document?.id ?? targetToken.id}`;
  const endVfx = tokenDoc => {
    if (!tokenDoc) return;
    const name = `add2e-protection-ward:${canvas.scene?.id ?? "scene"}:${tokenDoc.document?.id ?? tokenDoc.id}`;
    try { globalThis.Sequencer?.EffectManager?.endEffects?.({ name, object: tokenDoc }); } catch (_error) {}
    try { globalThis.Sequencer?.EffectManager?.endEffects?.({ name }); } catch (_error) {}
  };
  if (globalThis.ADD2E_PROTECTION_WARD_HOOKS_VERSION !== ADD2E_PROTECTION_VFX_VERSION) {
    globalThis.ADD2E_PROTECTION_WARD_HOOKS_VERSION = ADD2E_PROTECTION_VFX_VERSION;
    const stopWard = effect => {
      if (!isProtection(effect)) return;
      for (const activeToken of effect.parent?.getActiveTokens?.() ?? []) endVfx(activeToken);
    };
<<<<<<< Updated upstream
    Hooks.on("deleteActiveEffect", stopWard);
    Hooks.on("updateActiveEffect", (effect, changes) => { if (changes?.disabled === true || changes?.disabled === 1) stopWard(effect); });
=======
    Hooks.on("deleteActiveEffect", endWard);
    Hooks.on("updateActiveEffect", (effect, changes) => { if (changes?.disabled === true || changes?.disabled === 1) endWard(effect); });
=======
    if (!game.socket) { ui.notifications.error("Protection : socket indisponible."); return false; }
    game.socket.emit("system.add2e", { type: "ADD2E_GM_OPERATION", operation: "createActiveEffect", payload: { actorUuid: targetToken.actor.uuid, actorId: targetToken.actor.id, effectData, fromUserId: game.user.id, sentAt: Date.now() } });
  }

  const vfxName = `add2e-protection-ward:${canvas.scene?.id ?? "scene"}:${targetToken.document?.id ?? targetToken.id}`;
  const endVfx = tokenDoc => {
    if (!tokenDoc) return;
    const name = `add2e-protection-ward:${canvas.scene?.id ?? "scene"}:${tokenDoc.document?.id ?? tokenDoc.id}`;
    try { globalThis.Sequencer?.EffectManager?.endEffects?.({ name, object: tokenDoc }); } catch (_error) {}
    try { globalThis.Sequencer?.EffectManager?.endEffects?.({ name }); } catch (_error) {}
  };
  if (globalThis.ADD2E_PROTECTION_WARD_HOOKS_VERSION !== ADD2E_PROTECTION_VFX_VERSION) {
    globalThis.ADD2E_PROTECTION_WARD_HOOKS_VERSION = ADD2E_PROTECTION_VFX_VERSION;
    const stopWard = effect => {
      if (!isProtection(effect)) return;
      for (const activeToken of effect.parent?.getActiveTokens?.() ?? []) endVfx(activeToken);
    };
    Hooks.on("deleteActiveEffect", stopWard);
    Hooks.on("updateActiveEffect", (effect, changes) => { if (changes?.disabled === true || changes?.disabled === 1) stopWard(effect); });
>>>>>>> da5d0e7c2888427a76bfe6ef5fcbc6e3e3577148
>>>>>>> Stashed changes
  }
  try {
    const database = globalThis.Sequencer?.Database;
    const available = typeof database?.getEntry === "function" ? !!database.getEntry(modeInfo.jb2aKey) : true;
    if (available && typeof Sequence !== "undefined") {
<<<<<<< Updated upstream
      endVfx(targetToken);
      await new Sequence().effect().file(modeInfo.jb2aKey).attachTo(targetToken).persist(true).name(vfxName).belowTokens(false).scaleToObject(1.5).opacity(.95).play();
=======
<<<<<<< HEAD
      try { globalThis.Sequencer?.EffectManager?.endEffects?.({ name: visualName, object: targetToken }); } catch (_error) {}
      try { globalThis.Sequencer?.EffectManager?.endEffects?.({ name: visualName }); } catch (_error) {}
      await new Sequence().effect().file(modeInfo.jb2aKey).attachTo(targetToken).persist(true).name(visualName).belowTokens(false).scaleToObject(1.5).opacity(.95).play();
=======
      endVfx(targetToken);
      await new Sequence().effect().file(modeInfo.jb2aKey).attachTo(targetToken).persist(true).name(vfxName).belowTokens(false).scaleToObject(1.5).opacity(.95).play();
>>>>>>> da5d0e7c2888427a76bfe6ef5fcbc6e3e3577148
>>>>>>> Stashed changes
    }
  } catch (_error) {}

  const alignment = isGood ? "bonnes" : "mauvaises";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actorDoc, token: casterToken }),
    content: `<div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;overflow:hidden;border:1px solid #e2bc63;background:#fffaf0;font-family:var(--font-primary);"><div style="padding:8px 12px;background:linear-gradient(90deg,#6f4b12,#b88924);color:#fff;display:flex;gap:10px;align-items:center;"><img src="${esc(actorDoc.img || "icons/svg/mystery-man.svg")}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;"><div style="flex:1"><b>${esc(actorDoc.name)}</b><br><span style="font-size:.85em">lance ${esc(modeInfo.label)}</span></div><img src="${esc(sourceItem.img || "systems/add2e/assets/icones/sorts/protection-contre-le-mal.webp")}" style="width:30px;height:30px;border-radius:4px;"></div><div style="padding:10px;color:#6f4b12"><div><b>Cible :</b> ${esc(targetToken.name ?? targetToken.actor.name)}</div><div style="margin-top:6px;text-align:center;border:1px solid #e2bc63;border-radius:6px;padding:7px"><b>${esc(modeInfo.label.toUpperCase())}</b><br>Durée : <b>${rounds} rounds</b><br>Attaques ${alignment} : <b>–2</b> ; jets de protection : <b>+2</b>.</div></div></div>`,
    ...style()
  });
  return true;
})();

return __add2eOnUseResult === true ? true : false;
