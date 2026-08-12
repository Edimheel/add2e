/**
 * ADD2E — Sort BÉNÉDICTION / MALÉDICTION
 * Clerc niveau 1 — Conjuration/Appel
 * Compatible Foundry V13/V14/V15.
 *
 * Contrat onUse : true = sort consommé, false = sort non consommé.
 * Chaque Item de famille lance exclusivement son propre effet.
 * Les composants sont réservés, consommés et remboursés exclusivement par
 * 06-cast-spell.mjs + 22e-consumables-core.mjs.
 */

const __add2eOnUseResult = await (async () => {
  const VERSION = "2026-08-12-canonical-spell-family-mode-v7";

  function add2eResolveSpellMode(sourceItem) {
    const family = sourceItem?.flags?.add2e?.spellFamily ?? {};
    const kind = String(family.kind ?? "").trim().toLowerCase();
    const reversibleMode = String(family.reversibleMode ?? "").trim().toLowerCase();
    if (kind === "base") return "benediction";
    if (kind === "inverse" && reversibleMode === "inverse") return "malediction";
    if (sourceItem?.system?.isObjectPower === true) return "benediction";
    return null;
  }

  function add2eEmitGmOperation(operation, payload) {
    if (!game.socket) return false;
    game.socket.emit("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation,
      payload: { ...(payload ?? {}), fromUserId: game.user.id, sentAt: Date.now() }
    });
    return true;
  }

  async function add2eCreateEffectOnActor(targetActor, effectData) {
    if (!targetActor) return false;
    if (game.user.isGM || targetActor.isOwner) {
      const oldIds = targetActor.effects
        .filter(effect => {
          const tags = effect.flags?.add2e?.tags ?? [];
          return Array.isArray(tags) && (tags.includes("etat:benediction") || tags.includes("etat:malediction"));
        })
        .map(effect => effect.id);
      if (oldIds.length) await targetActor.deleteEmbeddedDocuments("ActiveEffect", oldIds);
      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return true;
    }
    const emitted = add2eEmitGmOperation("createActiveEffect", {
      actorUuid: targetActor.uuid,
      actorId: targetActor.id,
      effectData
    });
    if (!emitted) ui.notifications.error("Bénédiction / Malédiction : impossible de contacter le MJ pour créer l'effet actif.");
    return emitted;
  }

  function add2eSceneUnitsToMeters(distance) {
    const value = Number(distance);
    if (!Number.isFinite(value)) return Infinity;
    const unit = String(canvas.scene?.grid?.units ?? "m").trim().toLowerCase();
    if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(unit)) return value * 0.3048;
    if (["yd", "yard", "yards", "verge", "verges"].includes(unit)) return value * 0.9144;
    if (["km", "kilometre", "kilomètre", "kilometres", "kilomètres"].includes(unit)) return value * 1000;
    return value;
  }

  function add2eDistanceMeters(tokenA, tokenB) {
    try {
      if (!tokenA || !tokenB) return Infinity;
      if (canvas.grid?.measurePath) {
        const result = canvas.grid.measurePath([tokenA.center, tokenB.center], { gridSpaces: true });
        return add2eSceneUnitsToMeters(result?.distance ?? result?.gridDistance ?? result);
      }
      const distance = canvas.grid?.measureDistances?.([{ ray: new Ray(tokenA.center, tokenB.center) }], { gridSpaces: true })?.[0];
      return add2eSceneUnitsToMeters(distance);
    } catch (_error) {
      return Infinity;
    }
  }

  function add2eDurationData(rounds) {
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    return time?.durationData?.(rounds) ?? {
      rounds,
      startRound: game.combat?.round ?? null,
      startTurn: game.combat?.turn ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    };
  }

  function add2eTimeFlags({ sourceItem, caster, effectName, isCurse, durationRounds, tags }) {
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    return time?.flags?.({
      source: "benediction.js",
      rounds: durationRounds,
      unit: "round",
      endMessage: isCurse ? "La malédiction de {actor} prend fin." : "La bénédiction de {actor} prend fin.",
      extra: {
        spellName: effectName,
        spellKey: isCurse ? "malediction" : "benediction",
        sourceItemUuid: sourceItem?.uuid ?? null,
        casterId: caster?.id ?? null,
        casterUuid: caster?.uuid ?? null,
        tags
      }
    }) ?? {
      timeEngine: { managed: true, unit: "round", totalRounds: durationRounds },
      roundEngine: {
        managed: true,
        unit: "round",
        totalRounds: durationRounds,
        endMessage: isCurse ? "La malédiction de {actor} prend fin." : "La bénédiction de {actor} prend fin."
      },
      endMessage: isCurse ? "La malédiction de {actor} prend fin." : "La bénédiction de {actor} prend fin.",
      spellName: effectName,
      spellKey: isCurse ? "malediction" : "benediction",
      sourceItemUuid: sourceItem?.uuid ?? null,
      casterId: caster?.id ?? null,
      casterUuid: caster?.uuid ?? null,
      tags
    };
  }

  function add2eCanonicalModifiers({ sourceItem, modeLabel, bonusValue }) {
    const spellKey = bonusValue < 0 ? "malediction" : "benediction";
    const source = {
      kind: "spell",
      id: String(sourceItem?.id ?? spellKey),
      uuid: String(sourceItem?.uuid ?? ""),
      name: String(sourceItem?.name ?? modeLabel)
    };
    return [
      {
        id: `${spellKey}:attack:toucher`,
        domain: "attack",
        target: "toucher",
        operation: "add",
        value: bonusValue,
        priority: 100,
        stacking: { mode: "replace", group: "spell:benediction:attack" },
        conditions: { active: true },
        source,
        metadata: {
          label: `${modeLabel} — jets d’attaque`,
          producer: "benediction.js",
          temporary: true
        }
      },
      {
        id: `${spellKey}:morale:score`,
        domain: "morale",
        target: "score",
        operation: "add",
        value: bonusValue,
        priority: 100,
        stacking: { mode: "replace", group: "spell:benediction:morale" },
        conditions: { active: true },
        source,
        metadata: {
          label: `${modeLabel} — moral`,
          producer: "benediction.js",
          temporary: true
        }
      }
    ];
  }

  const sourceItem = (typeof sort !== "undefined" && sort)
    || (typeof item !== "undefined" && item)
    || (typeof spell !== "undefined" && spell)
    || (typeof args !== "undefined" && args?.[0]?.item)
    || null;
  if (!sourceItem || String(sourceItem.type ?? "").toLowerCase() !== "sort") {
    ui.notifications.error("Bénédiction / Malédiction : Item sort introuvable.");
    return false;
  }

  const mode = add2eResolveSpellMode(sourceItem);
  if (!mode) {
    ui.notifications.error("Bénédiction / Malédiction : métadonnées canoniques de famille absentes ou incohérentes.");
    return false;
  }

  const isCurse = mode === "malediction";
  const modeLabel = isCurse ? "Malédiction" : "Bénédiction";
  const componentName = isCurse ? "Eau maudite" : "Eau bénite";
  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications.error(`${modeLabel} : lanceur introuvable.`);
    return false;
  }

  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster.id)
    ? token
    : canvas.tokens?.controlled?.find(placeable => placeable?.actor?.id === caster.id)
      ?? caster.getActiveTokens?.()[0]
      ?? null;
  if (!casterToken) {
    ui.notifications.warn(`${modeLabel} : sélectionne le token du lanceur.`);
    return false;
  }

  const targets = Array.from(game.user.targets ?? []);
  if (!targets.length) {
    ui.notifications.warn(`${modeLabel} : cible au moins une créature dans la zone.`);
    return false;
  }
  if (targets.some(target => !target?.actor)) {
    ui.notifications.warn(`${modeLabel} : une cible n'a pas d'acteur.`);
    return false;
  }

  const maxRangeMeters = 18;
  const outOfRange = targets.filter(target => add2eDistanceMeters(casterToken, target) > maxRangeMeters);
  if (outOfRange.length) {
    ui.notifications.warn(`${modeLabel} : cible hors de portée (${outOfRange.map(target => target.name).join(", ")}).`);
    return false;
  }

  const bonusValue = isCurse ? -1 : 1;
  const effectName = modeLabel;
  const icon = sourceItem.img || (isCurse
    ? "icons/magic/control/debuff-energy-hold-pink.webp"
    : "icons/magic/holy/prayer-hands-glowing-yellow.webp");
  const durationRounds = 6;
  const tags = [isCurse ? "etat:malediction" : "etat:benediction"];

  const effectData = {
    name: effectName,
    img: icon,
    origin: sourceItem.uuid,
    disabled: false,
    transfer: false,
    duration: add2eDurationData(durationRounds),
    description: isCurse
      ? "Malus de -1 au moral et aux jets d'attaque."
      : "Bonus de +1 au moral et aux jets d'attaque.",
    flags: {
      add2e: {
        ...add2eTimeFlags({ sourceItem, caster, effectName, isCurse, durationRounds, tags }),
        tags,
        modifiers: add2eCanonicalModifiers({ sourceItem, modeLabel, bonusValue })
      }
    },
    changes: []
  };

  const applied = [];
  const failed = [];
  for (const targetToken of targets) {
    const ok = await add2eCreateEffectOnActor(targetToken.actor, foundry.utils.deepClone(effectData));
    if (ok) applied.push(targetToken);
    else failed.push(targetToken);
  }

  if (!applied.length) {
    ui.notifications.error(`${modeLabel} : aucun effet n'a pu être appliqué.`);
    return false;
  }

  await globalThis.ADD2E_PLAY_SPELL_FX?.(isCurse ? "malediction" : "benediction", {
    casterToken,
    targetTokens: applied,
    launchOptions: isCurse
      ? { text: "MALÉDICTION", color: "#6a2d7a", size: 130, fontSize: 24, duration: 900, durationText: 1200 }
      : { text: "BÉNÉDICTION", color: "#ffd76a", size: 130, fontSize: 24, duration: 900, durationText: 1200 },
    targetOptions: isCurse
      ? { text: "−1", color: "#6a2d7a", size: 90, fontSize: 36, duration: 800, durationText: 1000 }
      : { text: "+1", color: "#ffd76a", size: 90, fontSize: 36, duration: 800, durationText: 1000 }
  });

  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
  }

  const card = {
    actor: caster,
    title: modeLabel,
    icon: isCurse ? "fas fa-cloud-bolt" : "fas fa-hands-praying",
    variant: isCurse ? "failure" : "success",
    source: {
      name: sourceItem.name ?? modeLabel,
      img: sourceItem.img,
      type: "Sort de clerc"
    },
    rows: [
      { label: "Lanceur", value: caster.name },
      { label: "Composant", value: componentName },
      { label: "Effet", value: `${bonusValue > 0 ? "+1" : "-1"} au moral et aux jets d'attaque` },
      { label: "Durée", value: `${durationRounds} rounds` },
      { label: "Créatures affectées", value: applied.map(target => target.name).join(", ") },
      ...(failed.length ? [{ label: "Non appliqué", value: failed.map(target => target.name).join(", ") }] : [])
    ],
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      flags: {
        add2e: {
          chatCardType: "benediction-malediction",
          version: VERSION,
          spellKey: isCurse ? "malediction" : "benediction",
          modifierValue: bonusValue,
          durationRounds,
          targetActorUuids: applied.map(target => target.actor?.uuid).filter(Boolean),
          failedTargetActorUuids: failed.map(target => target.actor?.uuid).filter(Boolean)
        }
      }
    }
  };
  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error("Bénédiction / Malédiction : carte de chat vide.");
  await globalThis.add2eCreateChatCard(card);

  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  ui.notifications?.error?.("Bénédiction : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;