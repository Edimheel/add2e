/**
 * ADD2E — Sort BÉNÉDICTION / MALÉDICTION
 * Clerc niveau 1 — Conjuration/Appel
 * Version : 2026-08-07-canonical-component-resource-v4
 *
 * Contrat onUse : true = sort consommé, false = sort non consommé.
 * Chaque item lance exclusivement son propre effet : aucun choix de variante.
 * Composant : Bénédiction consomme Eau bénite ; Malédiction consomme Eau maudite.
 */

const __add2eOnUseResult = await (async () => {
  const VERSION = "2026-08-07-canonical-component-resource-v4";
  console.log(`%c[ADD2E][BENEDICTION] ${VERSION}`, "color:#b88924;font-weight:bold;");

  function add2eNormalize(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "_")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function add2eResolveSpellMode(sourceItem) {
    const modeForValue = value => {
      const key = add2eNormalize(value);
      if (key === "benediction" || key === "normal") return "benediction";
      if (key === "malediction" || key === "inverse") return "malediction";
      return null;
    };

    const candidates = [
      sourceItem?.name,
      sourceItem?.system?.nom,
      sourceItem?.system?.label,
      sourceItem?.system?.slug,
      sourceItem?.system?.spellKey,
      sourceItem?.system?.sortKey,
      sourceItem?.flags?.add2e?.reversibleActorEntry?.mode,
      sourceItem?.flags?.add2e?.spellFamily?.reversibleMode,
      sourceItem?.flags?.add2e?.spellKey,
      sourceItem?.flags?.add2e?.slug
    ];
    const modes = new Set(candidates.map(modeForValue).filter(Boolean));
    return modes.size === 1 ? Array.from(modes)[0] : null;
  }

  function add2eQuantity(item) {
    return Math.max(0, Math.floor(Number(item?.system?.quantite ?? item?.system?.quantity ?? 0) || 0));
  }

  function add2eResourceEngine() {
    const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
    if (!engine
      || typeof engine.consumeResource !== "function"
      || typeof engine.recoverResource !== "function") {
      throw new Error("Le domaine canonique ADD2E resource n’est pas disponible pour les composants de Bénédiction / Malédiction.");
    }
    return engine;
  }

  function add2eComponentResource(caster, component, componentName) {
    return {
      id: `${component.uuid ?? component.id}:spell-component:${add2eNormalize(componentName)}`,
      type: "spell-component",
      label: component.name,
      document: component,
      actor: caster,
      item: component,
      target: add2eNormalize(componentName),
      get current() {
        return add2eQuantity(component);
      },
      maximum: null,
      cost: 1,
      recovery: 1,
      source: {
        kind: "spell-component",
        id: String(component.id ?? ""),
        uuid: String(component.uuid ?? ""),
        name: String(component.name ?? componentName)
      },
      context: {
        componentName,
        consumer: "benediction"
      },
      write: next => {
        const update = {};
        if (component.system?.quantite !== undefined) update["system.quantite"] = next;
        if (component.system?.quantity !== undefined) update["system.quantity"] = next;
        if (!Object.keys(update).length) update["system.quantite"] = next;
        return component.update(update, {
          add2eInternal: true,
          add2eReason: "benediction-selected-component-resource",
          render: false
        });
      }
    };
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

  function add2eDistanceMeters(tokenA, tokenB) {
    try {
      if (!tokenA || !tokenB) return 0;
      if (canvas.grid?.measurePath) {
        const result = canvas.grid.measurePath([tokenA.center, tokenB.center], { gridSpaces: true });
        return Number(result?.distance ?? result?.gridDistance ?? result) || 0;
      }
      const distance = canvas.grid.measureDistances([{ ray: new Ray(tokenA.center, tokenB.center) }], { gridSpaces: true })[0];
      return Number(distance) || 0;
    } catch (error) {
      console.warn("[ADD2E][BENEDICTION] mesure distance impossible", error);
      return 0;
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

  async function add2eManualConsumeSelectedComponent(caster, componentName) {
    const wanted = add2eNormalize(componentName);
    const component = Array.from(caster?.items ?? []).find(candidate => {
      if (String(candidate?.type ?? "").toLowerCase() !== "objet") return false;
      const keys = [
        candidate.name,
        candidate.system?.nom,
        candidate.system?.slug,
        candidate.system?.composantSlug,
        candidate.system?.componentSlug
      ].map(add2eNormalize).filter(Boolean);
      return keys.includes(wanted);
    }) ?? null;

    const before = add2eQuantity(component);
    if (!component || before < 1) {
      const message = `${caster?.name ?? "Le lanceur"} n'a pas le composant requis : ${componentName} (1).`;
      ui.notifications.warn(message);
      return { ok: false, blocked: true, consumed: [], message };
    }

    const resource = add2eComponentResource(caster, component, componentName);
    const consumed = await add2eResourceEngine().consumeResource(resource, {
      cost: 1,
      reason: "benediction-selected-component-exact",
      consumer: "benediction"
    });
    if (!consumed.ok) {
      const message = `${caster?.name ?? "Le lanceur"} n'a plus le composant requis : ${componentName} (1).`;
      ui.notifications.warn(message);
      return { ok: false, blocked: true, consumed: [], message };
    }

    const state = consumed.resources?.[0] ?? null;
    const after = Math.max(0, Number(state?.after ?? add2eQuantity(component)) || 0);
    console.log("[ADD2E][BENEDICTION][COMPONENT_EXACT_CONSUMED]", { componentName, item: component.name, before, after });
    return {
      ok: true,
      blocked: false,
      actorId: caster?.id,
      sortName: componentName,
      resource,
      consumed: [{
        itemId: component.id,
        itemName: component.name,
        before,
        after,
        quantity: 1,
        requirement: { name: componentName, key: wanted, quantity: 1 }
      }]
    };
  }

  let sourceItem = null;
  if (typeof sort !== "undefined" && sort) sourceItem = sort;
  else if (typeof item !== "undefined" && item) sourceItem = item;
  else if (typeof this !== "undefined" && this?.documentName === "Item") sourceItem = this;
  if (!sourceItem && typeof arguments !== "undefined" && arguments.length > 1 && arguments[1]?.name) sourceItem = arguments[1];
  if (!sourceItem) {
    ui.notifications.error("Bénédiction / Malédiction : sort introuvable.");
    return false;
  }

  const mode = add2eResolveSpellMode(sourceItem);
  if (!mode) {
    ui.notifications.error(`Bénédiction / Malédiction : impossible d’identifier le sort lancé (« ${sourceItem.name ?? "sans nom"} »). Le lancement est annulé pour éviter d’appliquer le mauvais effet.`);
    return false;
  }

  const isCurse = mode === "malediction";
  const modeLabel = isCurse ? "Malédiction" : "Bénédiction";
  const componentName = isCurse ? "Eau maudite" : "Eau bénite";
  const casterToken = canvas.tokens.controlled[0] ?? ((typeof token !== "undefined" && token) ? token : null);
  if (!casterToken) {
    ui.notifications.warn(`${modeLabel} : sélectionne le token du lanceur.`);
    return false;
  }

  const caster = casterToken.actor ?? ((typeof actor !== "undefined" && actor) ? actor : sourceItem.parent);
  if (!caster) {
    ui.notifications.error(`${modeLabel} : lanceur introuvable.`);
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

  const maxRange = 18;
  const outOfRange = targets.filter(target => add2eDistanceMeters(casterToken, target) > maxRange);
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
  const componentReservation = await add2eManualConsumeSelectedComponent(caster, componentName);
  if (componentReservation?.blocked) return false;

  async function refundSelectedComponent(reason = "") {
    if (!componentReservation?.resource || !componentReservation?.consumed?.length) return false;
    const refunded = await add2eResourceEngine().recoverResource(componentReservation.resource, {
      amount: 1,
      reason: `benediction-selected-component-refund:${reason}`,
      consumer: "benediction"
    });
    if (!refunded.ok) return false;
    const entry = componentReservation.consumed[0];
    const state = refunded.resources?.[0] ?? null;
    console.log("[ADD2E][BENEDICTION][COMPONENT_REFUND]", {
      reason,
      componentName,
      item: entry.itemName,
      before: entry.after,
      after: state?.after ?? entry.before
    });
    return true;
  }

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
    await refundSelectedComponent("aucun effet applique");
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
      { label: "Composant consommé", value: componentName },
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
          spellKey: isCurse ? "malediction" : "benediction",
          modifierValue: bonusValue,
          durationRounds,
          targetActorUuids: applied.map(target => target.actor?.uuid).filter(Boolean),
          failedTargetActorUuids: failed.map(target => target.actor?.uuid).filter(Boolean)
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(card);
  await globalThis.add2eCreateChatCard(card);

  console.log("[ADD2E][benediction.js][ONUSE_RESULT]", true);
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT] Le script onUse doit retourner true/false.", {
    script: "benediction.js",
    result: __add2eOnUseResult
  });
  ui.notifications?.error?.("Bénédiction : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
