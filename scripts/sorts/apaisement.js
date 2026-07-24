/**
 * ADD2E — Apaisement / Épouvante
 * Clerc niveau 1
 * Version : 2026-07-24-apaisement-canonical-save-v6
 * Compatible Foundry V13/V14/V15.
 *
 * Contrat onUse : true = sort consommé, false = sort non consommé.
 * Chaque item lance exclusivement sa propre variante.
 */

const __add2eOnUseResult = await (async () => {
  const norm = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  const number = (value, fallback = null) => {
    if (value === undefined || value === null || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const sourceItem = (() => {
    if (typeof item !== "undefined" && item) return item;
    if (typeof sort !== "undefined" && sort) return sort;
    if (typeof spell !== "undefined" && spell) return spell;
    if (typeof args !== "undefined" && args?.[0]?.item) return args[0].item;
    return null;
  })();

  const resolveSpellMode = itemDoc => {
    const exact = value => {
      const key = norm(value);
      if (key === "epouvante") return "epouvante";
      if (key === "apaisement") return "apaisement";
      return null;
    };
    const byName = exact(itemDoc?.name);
    if (byName) return byName;
    const candidates = [
      itemDoc?.system?.nom,
      itemDoc?.system?.label,
      itemDoc?.system?.slug,
      itemDoc?.system?.spellKey,
      itemDoc?.system?.sortKey,
      itemDoc?.flags?.add2e?.spellKey,
      itemDoc?.flags?.add2e?.slug,
      itemDoc?.flags?.add2e?.variantKey,
      itemDoc?.flags?.add2e?.reversible?.key,
      itemDoc?.flags?.add2e?.reversible?.variant
    ];
    const modes = new Set(candidates.map(exact).filter(Boolean));
    return modes.size === 1 ? [...modes][0] : null;
  };

  if (!sourceItem) {
    ui.notifications.error("Apaisement / Épouvante : sort introuvable.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications.error("Apaisement / Épouvante : constructeur commun des cartes de chat indisponible.");
    return false;
  }

  const mode = resolveSpellMode(sourceItem);
  if (!mode) {
    ui.notifications.error(`Apaisement / Épouvante : impossible d’identifier la variante « ${sourceItem.name ?? "sans nom"} ».`);
    return false;
  }

  const title = mode === "epouvante" ? "Épouvante" : "Apaisement";
  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  const casterToken = (() => {
    if (typeof token !== "undefined" && token?.actor?.id === caster?.id) return token;
    return canvas.tokens?.controlled?.find(entry => entry.actor?.id === caster?.id)
      ?? caster?.getActiveTokens?.()[0]
      ?? null;
  })();

  if (!caster || !casterToken) {
    ui.notifications.warn(`${title} : sélectionne le token du lanceur.`);
    return false;
  }

  const targets = [...(game.user?.targets ?? [])];
  if (targets.length !== 1) {
    ui.notifications.warn(`${title} : cible exactement une créature.`);
    return false;
  }
  const targetToken = targets[0];
  const targetActor = targetToken?.actor ?? null;
  if (!targetActor) {
    ui.notifications.warn(`${title} : la cible ne possède pas d’acteur.`);
    return false;
  }

  const casterLevel = (() => {
    const classItem = Array.from(caster.items ?? []).find(entry =>
      String(entry?.type ?? "").toLowerCase() === "classe"
      && /clerc|cleric/i.test(String(entry?.name ?? entry?.system?.label ?? ""))
    );
    return Math.max(1, number(
      classItem?.system?.niveau
        ?? classItem?.system?.level
        ?? caster?.system?.details_classe?.clerc?.niveau
        ?? caster?.system?.niveau
        ?? caster?.system?.level,
      1
    ));
  })();

  const tokenDocument = value => value?.document?.documentName === "Token"
    ? value.document
    : value?.documentName === "Token"
      ? value
      : null;

  const casterTokenDoc = tokenDocument(casterToken);
  const targetTokenDoc = tokenDocument(targetToken);

  const tokensAtTouch = (left, right) => {
    const leftDoc = tokenDocument(left);
    const rightDoc = tokenDocument(right);
    if (!leftDoc || !rightDoc || leftDoc.id === rightDoc.id) return true;
    const grid = Number(canvas.grid?.size ?? canvas.scene?.grid?.size ?? 100) || 100;
    const leftBounds = {
      x1: Number(leftDoc.x ?? 0) / grid,
      y1: Number(leftDoc.y ?? 0) / grid,
      x2: Number(leftDoc.x ?? 0) / grid + Number(leftDoc.width ?? 1),
      y2: Number(leftDoc.y ?? 0) / grid + Number(leftDoc.height ?? 1)
    };
    const rightBounds = {
      x1: Number(rightDoc.x ?? 0) / grid,
      y1: Number(rightDoc.y ?? 0) / grid,
      x2: Number(rightDoc.x ?? 0) / grid + Number(rightDoc.width ?? 1),
      y2: Number(rightDoc.y ?? 0) / grid + Number(rightDoc.height ?? 1)
    };
    return Math.max(0, rightBounds.x1 - leftBounds.x2, leftBounds.x1 - rightBounds.x2) <= 0.01
      && Math.max(0, rightBounds.y1 - leftBounds.y2, leftBounds.y1 - rightBounds.y2) <= 0.01;
  };

  if (!tokensAtTouch(casterToken, targetToken)) {
    ui.notifications.warn(`${title} : la cible doit être au toucher.`);
    return false;
  }

  const timeApi = () => game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const durationData = rounds => timeApi()?.durationData?.(rounds)
    ?? {
      rounds,
      startRound: game.combat?.round ?? null,
      startTurn: game.combat?.turn ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    };

  const timeFlags = ({ rounds, endMessage, extra = {} }) => timeApi()?.flags?.({
    source: "apaisement.js",
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

  const effectTags = effect => {
    const raw = effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? [];
    const list = Array.isArray(raw) ? raw : String(raw).split(/[,;|\n]+/g);
    return list.map(norm).filter(Boolean);
  };

  const findEffects = wanted => {
    const keys = wanted.map(norm);
    return Array.from(targetActor.effects ?? []).filter(effect => {
      if (effect?.disabled) return false;
      const tags = effectTags(effect);
      const name = norm(effect?.name);
      return keys.some(key => tags.includes(key) || name.includes(key));
    });
  };

  const gmRelay = (operation, payload) => game.socket?.emit("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation,
    payload: {
      ...(payload ?? {}),
      fromUserId: game.user?.id,
      sentAt: Date.now()
    }
  });

  const createEffect = async effectData => {
    if (game.user?.isGM || targetActor.isOwner) {
      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return true;
    }
    if (!game.socket) return false;
    gmRelay("createActiveEffect", {
      actorUuid: targetActor.uuid,
      actorId: targetActor.id,
      sceneId: targetTokenDoc?.parent?.id ?? canvas.scene?.id,
      tokenId: targetTokenDoc?.id ?? null,
      effectData
    });
    return true;
  };

  const deleteEffects = async effects => {
    const ids = Array.from(effects ?? []).map(effect => effect?.id).filter(Boolean);
    if (!ids.length) return { deleted: 0, blocked: false };
    if (game.user?.isGM || targetActor.isOwner) {
      await targetActor.deleteEmbeddedDocuments("ActiveEffect", ids);
      return { deleted: ids.length, blocked: false };
    }
    return { deleted: 0, blocked: true };
  };

  const getThac0 = actorDoc => {
    const classItems = Array.from(actorDoc?.items ?? []).filter(entry => String(entry?.type ?? "").toLowerCase() === "classe");
    const candidates = [];
    for (const classItem of classItems) {
      const level = Math.max(1, number(classItem?.system?.niveau ?? classItem?.system?.level, 1));
      const progression = Array.isArray(classItem?.system?.progression) ? classItem.system.progression : [];
      const row = progression.find(entry => Number(entry?.niveau ?? entry?.level) === level)
        ?? progression[Math.max(0, Math.min(progression.length - 1, level - 1))]
        ?? null;
      const thac0 = number(row?.thac0, null);
      if (Number.isFinite(thac0)) candidates.push(thac0);
    }
    return candidates.length ? Math.min(...candidates) : number(actorDoc?.system?.thac0, 20);
  };

  const getTargetCA = actorDoc => {
    const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
    if (typeof engine?.getMagicPassiveDefense === "function") {
      const details = engine.getMagicPassiveDefense(actorDoc, {
        source: "spell-touch-attack",
        attacker: caster?.name,
        weapon: sourceItem?.name ?? title
      });
      const total = number(details?.caTotal, null);
      if (Number.isFinite(total)) return total;
    }
    return number(actorDoc?.system?.armorClass ?? actorDoc?.system?.ca_total ?? actorDoc?.system?.ca, 10);
  };

  const rollTouchAttack = async () => {
    const thac0 = getThac0(caster);
    const ca = getTargetCA(targetActor);
    const threshold = thac0 - ca;
    const roll = await new Roll("1d20").evaluate();
    try { await game.dice3d?.showForRoll?.(roll); } catch (_error) {}
    const d20 = Number(roll.total) || 0;
    return {
      roll,
      d20,
      thac0,
      ca,
      threshold,
      success: d20 === 20 || (d20 !== 1 && d20 >= threshold)
    };
  };

  const targetIsConsentingCharacter = mode === "apaisement" && targetActor.type === "personnage";
  const touch = targetIsConsentingCharacter ? null : await rollTouchAttack();

  const postCard = async ({ outcome, variant, rows = [], rolls = [], extraFlags = {} }) => {
    const options = {
      actor: caster,
      title,
      icon: mode === "epouvante" ? "fas fa-ghost" : "fas fa-shield-heart",
      variant,
      source: {
        name: caster.name,
        img: caster.img,
        type: mode === "epouvante" ? "Sort divin inversé" : "Sort divin",
        meta: `Clerc niveau ${casterLevel}`
      },
      rows: [
        { label: "Cible", value: targetToken.name ?? targetActor.name },
        ...rows
      ],
      message: outcome,
      chatData: {
        speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
        rolls: rolls.filter(Boolean),
        flags: {
          add2e: {
            spell: mode,
            sourceItemUuid: sourceItem.uuid ?? null,
            targetActorUuid: targetActor.uuid ?? null,
            targetTokenId: targetToken.id ?? null,
            ...extraFlags
          }
        }
      }
    };
    const preview = globalThis.add2eBuildChatCard(options);
    if (!String(preview ?? "").trim()) throw new Error(`${title} : carte de chat vide.`);
    await globalThis.add2eCreateChatCard(options);
  };

  if (touch && !touch.success) {
    await postCard({
      outcome: "Le contact est manqué : aucun effet n’est appliqué.",
      variant: "failure",
      rows: [
        { label: "Jet de toucher", value: `d20 ${touch.d20} / seuil ${touch.threshold}` },
        { label: "Calcul", value: `THAC0 ${touch.thac0} - CA ${touch.ca}` }
      ],
      rolls: [touch.roll],
      extraFlags: { touchSuccess: false }
    });
    return true;
  }

  const touchRows = touch ? [
    { label: "Jet de toucher", value: `d20 ${touch.d20} / seuil ${touch.threshold}` },
    { label: "Calcul", value: `THAC0 ${touch.thac0} - CA ${touch.ca}` }
  ] : [{ label: "Contact", value: "Cible consentante" }];

  if (mode === "apaisement") {
    if (typeof globalThis.add2eRollSavingThrow !== "function") {
      ui.notifications.error("Apaisement : exécuteur canonique des sauvegardes indisponible.");
      return false;
    }

    const fearEffects = findEffects(["etat:epouvante", "etat:peur", "controle:fuite", "fuite"]);
    let renewedSave = null;
    let removed = { deleted: 0, blocked: false };
    if (fearEffects.length) {
      renewedSave = await globalThis.add2eRollSavingThrow(targetActor, "sorts", {
        source: "spell:apaisement:renewed-fear-save",
        sourceItem,
        caster,
        targetToken,
        frontale: true,
        mental: true,
        effectType: "peur",
        tags: ["mental", "peur", "effroi"],
        saveModifiers: [{
          id: `${sourceItem.uuid ?? sourceItem.id}:renewed-fear-save`,
          value: casterLevel,
          target: "peur",
          label: `Apaisement — bonus du niveau du clerc (+${casterLevel})`,
          stacking: { mode: "stack", group: null },
          source: {
            kind: "spell",
            id: sourceItem.id ?? "apaisement",
            uuid: sourceItem.uuid ?? "",
            name: sourceItem.name ?? "Apaisement"
          }
        }],
        createChat: false,
        showDice: true
      });
      if (!renewedSave?.ok) {
        ui.notifications.warn(`Apaisement : sauvegarde contre les sortilèges introuvable pour ${targetActor.name}.`);
        return false;
      }
      if (renewedSave.success) removed = await deleteEffects(fearEffects);
    }

    const rounds = 10;
    const endMessage = "L’apaisement de {actor} prend fin.";
    const modifier = {
      id: `${sourceItem.uuid ?? sourceItem.id}:save:peur:+4`,
      domain: "save",
      target: "peur",
      operation: "add",
      value: 4,
      priority: 100,
      stacking: { mode: "highest", group: "save:peur:apaisement" },
      conditions: {},
      source: {
        kind: "spell",
        id: sourceItem.id ?? "apaisement",
        uuid: sourceItem.uuid ?? "",
        name: sourceItem.name ?? "Apaisement"
      },
      metadata: {
        label: "Apaisement : +4 contre la peur",
        producer: "spell:apaisement",
        effectType: "peur"
      }
    };
    const flags = timeFlags({
      rounds,
      endMessage,
      extra: {
        spellName: "Apaisement",
        spellKey: "apaisement",
        mode,
        sourceItemUuid: sourceItem.uuid ?? null,
        casterId: caster.id ?? null,
        casterUuid: caster.uuid ?? null,
        targetId: targetActor.id ?? null,
        targetUuid: targetActor.uuid ?? null,
        tags: ["sort:apaisement", "etat:apaise"],
        modifiers: [modifier]
      }
    });
    const created = await createEffect({
      name: "Apaisement",
      img: sourceItem.img || "icons/magic/holy/barrier-shield-winged-blue.webp",
      origin: sourceItem.uuid ?? null,
      disabled: false,
      transfer: false,
      duration: durationData(rounds),
      description: "Apaisement : +4 aux jets de protection contre les attaques magiques provoquant la peur pendant 1 tour.",
      flags: { add2e: flags },
      changes: []
    });
    if (!created) {
      ui.notifications.error("Apaisement : impossible d’appliquer l’effet.");
      return false;
    }

    const rows = [
      ...touchRows,
      { label: "Effet", value: "+4 aux sauvegardes contre la peur" },
      { label: "Durée", value: "1 tour / 10 rounds" }
    ];
    if (renewedSave) {
      rows.push({
        label: "Nouvelle sauvegarde",
        value: `d20 ${renewedSave.d20} ${renewedSave.bonus >= 0 ? "+" : ""}${renewedSave.bonus} = ${renewedSave.total} / ${renewedSave.target} — ${renewedSave.success ? "réussite" : "échec"}`
      });
      if (removed.deleted) rows.push({ label: "Peur retirée", value: removed.deleted });
      if (removed.blocked) rows.push({ label: "Peur", value: "Suppression à effectuer par le MJ" });
    }

    await globalThis.ADD2E_PLAY_SPELL_FX?.("apaisement", { casterToken, targetToken });
    await postCard({
      outcome: renewedSave?.success
        ? "La cible est apaisée et surmonte l’effet de peur en cours."
        : "La cible bénéficie de la protection d’Apaisement.",
      variant: "success",
      rows,
      rolls: [touch?.roll, renewedSave?.roll],
      extraFlags: {
        canonicalSaveModifier: true,
        renewedSaveSuccess: renewedSave?.success ?? null,
        durationRounds: rounds
      }
    });
    return true;
  }

  const previousApaisement = findEffects(["etat:apaise", "apaisement"]);
  const removed = await deleteEffects(previousApaisement);
  const fleeExecutor = game.add2e?.forceFleeToken ?? globalThis.add2eForceFleeToken;
  if (typeof fleeExecutor !== "function") {
    ui.notifications.error("Épouvante : moteur commun de fuite ADD2E indisponible.");
    return false;
  }

  const flee = await fleeExecutor({
    sourceToken: casterTokenDoc,
    targetToken: targetTokenDoc,
    actor: targetActor,
    reason: "spell:epouvante:forced-flee",
    flagKey: "epouvanteForcedMove",
    allowGridFallback: true,
    currentRound: Number(game.combat?.round ?? 0) || null
  });
  if (flee?.fatal) {
    ui.notifications.error(`Épouvante : ${flee.reason}`);
    return false;
  }

  const rounds = casterLevel;
  const endMessage = "L’épouvante de {actor} prend fin.";
  const flags = timeFlags({
    rounds,
    endMessage,
    extra: {
      spellName: "Épouvante",
      spellKey: "epouvante",
      mode,
      sourceItemUuid: sourceItem.uuid ?? null,
      casterId: caster.id ?? null,
      casterUuid: caster.uuid ?? null,
      casterName: caster.name,
      targetId: targetActor.id ?? null,
      targetUuid: targetActor.uuid ?? null,
      tags: [
        "sort:epouvante",
        "etat:epouvante",
        "etat:peur",
        "controle:fuite",
        "fuite",
        "mouvement:eloignement_obligatoire"
      ]
    }
  });
  const created = await createEffect({
    name: "Épouvante",
    img: sourceItem.img || "icons/magic/control/fear-fright-monster-red.webp",
    origin: sourceItem.uuid ?? caster.uuid ?? null,
    disabled: false,
    transfer: false,
    duration: durationData(rounds),
    description: `Épouvante : la victime fuit le plus vite et le plus loin possible du clerc pendant ${rounds} round(s).`,
    flags: { add2e: flags },
    changes: []
  });
  if (!created) {
    ui.notifications.error("Épouvante : impossible d’appliquer l’effet.");
    return false;
  }

  const fleeText = flee.moved
    ? `${Number(flee.movedMeters ?? 0).toFixed(1)} m déplacés`
    : flee.requested
      ? `${Number(flee.movedMeters ?? 0).toFixed(1)} m demandés au MJ`
      : flee.reason ?? "Aucun déplacement possible";

  await globalThis.ADD2E_PLAY_SPELL_FX?.("epouvante", { casterToken, targetToken });
  await postCard({
    outcome: "La cible est frappée d’épouvante et fuit le lanceur.",
    variant: "failure",
    rows: [
      ...touchRows,
      { label: "Fuite initiale", value: fleeText },
      { label: "Durée", value: `${rounds} round${rounds > 1 ? "s" : ""}` },
      ...(removed.deleted ? [{ label: "Apaisement retiré", value: removed.deleted }] : [])
    ],
    rolls: [touch?.roll],
    extraFlags: {
      forcedFlee: true,
      fleeMoved: flee.moved === true,
      fleeRequested: flee.requested === true,
      fleeMeters: flee.movedMeters ?? null,
      durationRounds: rounds
    }
  });
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT] Le script onUse doit retourner true ou false.", {
    script: "apaisement.js",
    result: __add2eOnUseResult
  });
  ui.notifications?.error?.("Apaisement : le script onUse n'a pas retourné true/false.");
  return false;
}
return __add2eOnUseResult;