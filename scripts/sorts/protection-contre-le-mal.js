/**
 * ADD2E — Protection contre le Mal / Protection contre le Bien
 * Clerc niveau 1
 * Version : 2026-06-29-protection-auto-mode-persistent-ward-v3
 *
 * Contrat onUse : true = consommé ; false = non consommé.
 * Compatible Foundry V13/V14/V15. Aucun dialogue n'est requis :
 * la variante est déterminée par l'item réellement lancé.
 */

const ADD2E_PROTECTION_VFX_VERSION = "2026-06-29-protection-auto-mode-persistent-ward-v3";

const __add2eOnUseResult = await (async () => {
  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const normalize = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const toArray = value => {
    if (value === undefined || value === null || value === "") return [];
    if (Array.isArray(value)) return value.flatMap(toArray);
    if (value instanceof Set) return [...value];
    if (typeof value?.values === "function" && typeof value !== "string") return [...value.values()];
    return [value];
  };

  const chatStyleData = () => CONST.CHAT_MESSAGE_STYLES
    ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
    : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };

  const sourceItemFromContext = () => {
    if (typeof sort !== "undefined" && sort) return sort;
    if (typeof item !== "undefined" && item) return item;
    if (typeof this !== "undefined" && this?.documentName === "Item") return this;
    if (typeof spell !== "undefined" && spell) return spell;
    if (typeof args !== "undefined" && args?.[0]?.item) return args[0].item;
    return null;
  };

  const casterFromContext = sourceItem => (typeof actor !== "undefined" && actor) ? actor : sourceItem?.parent;

  const casterTokenFor = caster => canvas.tokens?.controlled?.find(tokenDoc => tokenDoc?.actor?.id === caster?.id)
    ?? ((typeof token !== "undefined" && token?.actor?.id === caster?.id) ? token : null)
    ?? caster?.getActiveTokens?.()[0]
    ?? null;

  const getLevel = actorDoc => {
    const candidates = [
      actorDoc?.system?.niveau,
      actorDoc?.system?.level,
      actorDoc?.system?.details?.niveau,
      actorDoc?.system?.details?.level,
      actorDoc?.system?.details_classe?.clerc?.niveau,
      actorDoc?.system?.details_classe?.niveau
    ];
    for (const raw of candidates) {
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0) return value;
    }
    const cleric = Array.from(actorDoc?.items ?? []).find(entry => entry?.type === "classe" && normalize(entry?.name).includes("clerc"));
    const clericLevel = Number(cleric?.system?.niveau ?? cleric?.system?.level);
    return Number.isFinite(clericLevel) && clericLevel > 0 ? clericLevel : 1;
  };

  const tokensAuContact = (a, b) => {
    if (!a || !b || a.id === b.id) return true;
    try {
      const gridSize = canvas.grid?.size || 100;
      const aLeft = a.document.x / gridSize;
      const aTop = a.document.y / gridSize;
      const aRight = aLeft + (a.document.width || 1);
      const aBottom = aTop + (a.document.height || 1);
      const bLeft = b.document.x / gridSize;
      const bTop = b.document.y / gridSize;
      const bRight = bLeft + (b.document.width || 1);
      const bBottom = bTop + (b.document.height || 1);
      const gapX = Math.max(0, bLeft - aRight, aLeft - bRight);
      const gapY = Math.max(0, bTop - aBottom, aTop - bBottom);
      return gapX <= 0.01 && gapY <= 0.01;
    } catch (_error) {
      return false;
    }
  };

  const roundDuration = level => {
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    return time?.toRounds?.("level*3", "round", { level }) ?? (Math.max(1, Number(level) || 1) * 3);
  };

  const durationData = rounds => {
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    return time?.durationData?.(rounds) ?? {
      rounds,
      startRound: game.combat?.round ?? null,
      startTurn: game.combat?.turn ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    };
  };

  const aeAddChange = (key, value, priority = 20) => {
    if (CONST.ACTIVE_EFFECT_CHANGE_TYPES) return { key, type: "add", phase: "final", value: String(value), priority };
    return { key, mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: String(value), priority };
  };

  const modeFromText = value => {
    const key = normalize(value);
    if (!key) return null;
    const hasGood = key.includes("protection_contre_le_bien") || key === "bien";
    const hasEvil = key.includes("protection_contre_le_mal") || key === "mal";
    if (hasGood === hasEvil) return null;
    return hasGood ? "bien" : "mal";
  };

  const resolveMode = sourceItem => {
    const flags = sourceItem?.flags?.add2e ?? {};
    const directValues = [
      sourceItem?.name,
      sourceItem?.system?.nom,
      flags?.reversibleActorEntry?.name,
      flags?.reversibleActorEntry?.displayName,
      flags?.reversibleActorEntry?.inverseName
    ];
    for (const value of directValues) {
      const resolved = modeFromText(value);
      if (resolved) return resolved;
    }

    const explicitMode = normalize(flags?.reversibleActorEntry?.mode);
    if (["inverse", "bien"].includes(explicitMode)) return "bien";
    if (["normal", "base", "mal"].includes(explicitMode)) return "mal";

    const remainingValues = [
      sourceItem?.system?.slug,
      sourceItem?.system?.spellKey,
      flags?.spellKey,
      flags?.slug,
      flags?.spellFamily?.kind,
      flags?.spellFamily?.reversibleMode
    ];
    for (const value of remainingValues) {
      const resolved = modeFromText(value);
      if (resolved) return resolved;
    }
    return null;
  };

  const modeData = mode => {
    const isGood = mode === "bien";
    return {
      key: isGood ? "bien" : "mal",
      label: isGood ? "Protection contre le Bien" : "Protection contre le Mal",
      spellKey: isGood ? "protection_contre_le_bien" : "protection_contre_le_mal",
      jb2aKey: isGood ? "jb2a.aura_themed.01.inward" : "jb2a.ward.rune.yellow",
      tags: isGood
        ? ["sort:protection_contre_le_bien", "protection:bien", "bonus_ca:2", "bonus_save_vs:bien:2", "barriere:creatures_invoquees", "malus_toucher_ennemi:2"]
        : ["sort:protection_contre_le_mal", "protection:mal", "bonus_ca:2", "bonus_save_vs:mal:2", "barriere:creatures_invoquees", "malus_toucher_ennemi:2"]
    };
  };

  const timeFlags = ({ sourceItem, caster, targetActor, modeInfo, rounds, level }) => {
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    const endMessage = modeInfo.key === "bien"
      ? "La protection contre le bien de {actor} prend fin."
      : "La protection contre le mal de {actor} prend fin.";
    const extra = {
      spellName: modeInfo.label,
      spellKey: modeInfo.spellKey,
      level,
      sourceItemUuid: sourceItem?.uuid ?? null,
      casterId: caster?.id ?? null,
      casterUuid: caster?.uuid ?? null,
      targetId: targetActor?.id ?? null,
      targetUuid: targetActor?.uuid ?? null,
      tags: modeInfo.tags
    };
    return time?.flags?.({
      source: "protection-contre-le-mal.js",
      rounds,
      unit: "round",
      endMessage,
      extra
    }) ?? {
      timeEngine: { managed: true, unit: "round", totalRounds: rounds },
      roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage },
      endMessage,
      ...extra
    };
  };

  const effectData = ({ sourceItem, caster, targetActor, modeInfo, level }) => {
    const rounds = roundDuration(level);
    return {
      name: modeInfo.label,
      img: sourceItem?.img || "systems/add2e/assets/icones/sorts/protection-contre-le-mal.webp",
      origin: sourceItem?.uuid ?? null,
      disabled: false,
      transfer: false,
      duration: durationData(rounds),
      description: `${modeInfo.label}. Bonus de +2 à la CA et aux jets de protection appropriés ; barrière contre les créatures enchantées ou invoquées. Durée : ${rounds} rounds.`,
      flags: {
        add2e: {
          ...timeFlags({ sourceItem, caster, targetActor, modeInfo, rounds, level }),
          tags: modeInfo.tags
        }
      },
      changes: [
        aeAddChange("system.bonus_ca", 2),
        aeAddChange("system.bonus_sauvegarde", 2)
      ]
    };
  };

  const effectIsProtection = effect => {
    const flags = effect?.flags?.add2e ?? {};
    const spellKey = normalize(flags?.spellKey ?? flags?.spell?.slug);
    const tags = toArray(flags?.tags).map(normalize);
    return ["protection_contre_le_mal", "protection_contre_le_bien"].includes(spellKey)
      || tags.includes("sort:protection_contre_le_mal")
      || tags.includes("sort:protection_contre_le_bien");
  };

  const vfxNameForToken = tokenDoc => {
    const sceneId = canvas?.scene?.id ?? "scene";
    const tokenId = tokenDoc?.document?.id ?? tokenDoc?.id ?? "token";
    return `add2e-protection-ward:${sceneId}:${tokenId}`;
  };

  const endProtectionWardForToken = tokenDoc => {
    if (!tokenDoc) return false;
    const name = vfxNameForToken(tokenDoc);
    try { globalThis.Sequencer?.EffectManager?.endEffects?.({ name, object: tokenDoc }); } catch (_error) {}
    try { globalThis.Sequencer?.EffectManager?.endEffects?.({ name }); } catch (_error) {}
    return true;
  };

  const registerProtectionWardHooks = () => {
    if (globalThis.ADD2E_PROTECTION_WARD_HOOKS_VERSION === ADD2E_PROTECTION_VFX_VERSION) return;
    globalThis.ADD2E_PROTECTION_WARD_HOOKS_VERSION = ADD2E_PROTECTION_VFX_VERSION;

    const stopWard = effect => {
      if (!effectIsProtection(effect)) return;
      for (const tokenDoc of effect?.parent?.getActiveTokens?.() ?? []) endProtectionWardForToken(tokenDoc);
    };

    Hooks.on("deleteActiveEffect", stopWard);
    Hooks.on("updateActiveEffect", (effect, changes) => {
      if (changes?.disabled === true || changes?.disabled === 1) stopWard(effect);
    });
  };

  const sequencerEntryExists = entry => {
    if (!entry || typeof Sequence !== "function") return false;
    try {
      const db = globalThis.Sequencer?.Database;
      if (typeof db?.getEntry === "function") return !!db.getEntry(entry);
      if (typeof db?.getPathsUnder === "function") {
        const parent = entry.split(".").slice(0, -1).join(".");
        return (db.getPathsUnder(parent) ?? []).includes(entry);
      }
    } catch (_error) {}
    return true;
  };

  const playProtectionWard = async (targetToken, modeInfo) => {
    if (!targetToken || typeof Sequence !== "function" || !canvas?.ready) return false;
    if (!sequencerEntryExists(modeInfo.jb2aKey)) return false;

    endProtectionWardForToken(targetToken);
    const name = vfxNameForToken(targetToken);
    try {
      await new Sequence()
        .effect()
        .file(modeInfo.jb2aKey)
        .attachTo(targetToken)
        .persist(true)
        .name(name)
        .belowTokens(false)
        .scaleToObject(1.5)
        .opacity(0.95)
        .play();
      return true;
    } catch (_error) {
      return false;
    }
  };

  const emitGmOperation = (operation, payload) => {
    if (!game.socket) return false;
    game.socket.emit("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation,
      payload: { ...(payload ?? {}), fromUserId: game.user.id, sentAt: Date.now() }
    });
    return true;
  };

  const applyEffect = async (targetActor, data) => {
    if (!targetActor) return false;
    if (game.user.isGM || targetActor.isOwner) {
      const oldIds = Array.from(targetActor.effects ?? [])
        .filter(effectIsProtection)
        .map(effect => effect.id)
        .filter(Boolean);
      if (oldIds.length) await targetActor.deleteEmbeddedDocuments("ActiveEffect", oldIds);
      await targetActor.createEmbeddedDocuments("ActiveEffect", [data]);
      return true;
    }

    const emitted = emitGmOperation("createActiveEffect", {
      actorUuid: targetActor.uuid,
      actorId: targetActor.id,
      effectData: data
    });
    if (!emitted) {
      ui.notifications.error("Protection : socket indisponible, impossible de demander l’effet au MJ.");
      return false;
    }
    return true;
  };

  const createChat = async ({ caster, sourceItem, targetToken, modeInfo, rounds }) => {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterTokenFor(caster) }),
      content: `
        <div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,#fffaf0 0%,#fff7df 100%);border:1.5px solid #e2bc63;overflow:hidden;padding:0;font-family:var(--font-primary);">
          <div style="background:linear-gradient(90deg,#6f4b12 0%,#b88924 100%);padding:8px 12px;color:white;display:flex;align-items:center;gap:10px;border-bottom:2px solid #8a611d;">
            <img src="${esc(caster?.img || "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
            <div style="line-height:1.2;flex:1;">
              <div style="font-weight:bold;font-size:1.05em;">${esc(caster?.name ?? "Lanceur")}</div>
              <div style="font-size:0.85em;opacity:0.95;">lance <b>${esc(modeInfo.label)}</b></div>
            </div>
            <div style="text-align:right;font-size:0.78em;opacity:0.95;">Sort divin</div>
            <img src="${esc(sourceItem?.img || "systems/add2e/assets/icones/sorts/protection-contre-le-mal.webp")}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
          </div>
          <div style="padding:10px;">
            <div style="margin-bottom:6px;font-size:0.95em;color:#6f4b12;"><b>Cible :</b> ${esc(targetToken?.name ?? targetToken?.actor?.name ?? "—")}</div>
            <div style="border:1px solid #e2bc63;background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:#6f4b12;">
              <div style="font-weight:bold;color:#2f8f46;">${esc(modeInfo.label.toUpperCase())} APPLIQUÉE</div>
              <div>Durée : <b>${esc(rounds)} rounds</b>.</div>
              <div>Bonus : <b>+2 CA</b> et <b>+2 sauvegardes</b> selon la protection.</div>
            </div>
            <details style="margin-top:8px;background:white;border:1px solid #e2bc63;border-radius:6px;">
              <summary style="cursor:pointer;color:#6f4b12;font-weight:600;padding:6px;">Règle appliquée</summary>
              <div style="padding:8px;font-size:0.85em;line-height:1.45;color:#6f4b12;">
                Protège la cible contre les contacts corporels des créatures enchantées ou invoquées, impose -2 aux attaques des créatures concernées et donne +2 aux jets de protection appropriés. Durée : 3 rounds par niveau du clerc.
              </div>
            </details>
          </div>
        </div>`,
      ...chatStyleData()
    });
  };

  const sourceItem = sourceItemFromContext();
  if (!sourceItem) {
    ui.notifications.error("Protection : sort introuvable.");
    return false;
  }

  const mode = resolveMode(sourceItem);
  if (!mode) {
    ui.notifications.error(`Protection : impossible d’identifier la variante lancée (« ${sourceItem.name ?? "sans nom"} »).`);
    return false;
  }
  const modeInfo = modeData(mode);

  const caster = casterFromContext(sourceItem);
  if (!caster) {
    ui.notifications.error(`${modeInfo.label} : lanceur introuvable.`);
    return false;
  }

  const casterToken = casterTokenFor(caster);
  if (!casterToken) {
    ui.notifications.warn(`${modeInfo.label} : sélectionne le token du lanceur.`);
    return false;
  }

  const targets = Array.from(game.user.targets ?? []);
  if (targets.length !== 1 || !targets[0]?.actor) {
    ui.notifications.warn(`${modeInfo.label} : cible exactement une créature touchée.`);
    return false;
  }

  const targetToken = targets[0];
  if (!tokensAuContact(casterToken, targetToken)) {
    ui.notifications.warn(`${modeInfo.label} : la cible doit être au toucher.`);
    return false;
  }

  registerProtectionWardHooks();
  const level = getLevel(caster);
  const rounds = roundDuration(level);
  const data = effectData({ sourceItem, caster, targetActor: targetToken.actor, modeInfo, level });
  const applied = await applyEffect(targetToken.actor, data);
  if (!applied) return false;

  await playProtectionWard(targetToken, modeInfo);
  await createChat({ caster, sourceItem, targetToken, modeInfo, rounds });
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  ui.notifications?.error?.("Protection : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
