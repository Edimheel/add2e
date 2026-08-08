// ADD2E — onUse canonique : Force
// Sort de magicien niveau 2 — portée au toucher, durée 6 tours/niveau.
// Compatible Foundry V13/V14/V15 — moteur de caractéristiques, temps et UI communs ADD2E.

return await (async () => {
  const VERSION = "2026-08-08-force-foundry-v1";
  const SPELL_SLUG = "force";

  const normalize = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const toArray = value => {
    if (Array.isArray(value)) return value.flatMap(toArray).filter(Boolean);
    if (value instanceof Set) return [...value].flatMap(toArray).filter(Boolean);
    if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
    return value === undefined || value === null || value === "" ? [] : [value];
  };

  const escapeHtml = value => {
    const text = String(value ?? "");
    try {
      if (typeof foundry?.utils?.escapeHTML === "function") return foundry.utils.escapeHTML(text);
    } catch (_error) {}
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  const showAlert = async ({ title = "Force", content = "", theme = "wizard" } = {}) => {
    if (typeof globalThis.add2eDialogAlert !== "function") {
      throw new Error("Force : l’API de fenêtre ADD2E est indisponible.");
    }
    await globalThis.add2eDialogAlert({
      add2eTheme: theme,
      window: { title },
      content
    });
  };

  const spellItem = (typeof item !== "undefined" && item)
    || (typeof sort !== "undefined" && sort)
    || (Array.isArray(typeof args !== "undefined" ? args : null) ? args[0]?.item ?? args[0]?.sort : null)
    || null;
  const caster = (typeof actor !== "undefined" && actor)
    || spellItem?.parent
    || (Array.isArray(typeof args !== "undefined" ? args : null) ? args[0]?.actor : null)
    || null;

  if (!caster || !spellItem) {
    await showAlert({
      title: "Force — source introuvable",
      content: "<p>Le lanceur ou le sort Force est introuvable.</p>",
      theme: "danger"
    });
    return false;
  }

  const runtimeArgs = Array.isArray(typeof args !== "undefined" ? args : null) ? args : [];
  const virtualPower = spellItem?.system?.isPower === true
    || spellItem?.system?.isObjectPower === true
    || Boolean(spellItem?.system?.sourceObjectItemId)
    || Boolean(spellItem?.system?.sourceItemId)
    || Boolean(spellItem?.system?.powerId);

  let sourceObject = null;
  if (virtualPower) {
    const explicitSource = (typeof sourceItem !== "undefined" && sourceItem) ? sourceItem : null;
    if (explicitSource && explicitSource !== spellItem && explicitSource?.documentName === "Item") sourceObject = explicitSource;
    if (!sourceObject && explicitSource && explicitSource !== spellItem && explicitSource?.type !== "sort") sourceObject = explicitSource;

    for (const id of [
      spellItem?.system?.sourceObjectItemId,
      spellItem?.system?.sourceItemId,
      spellItem?.system?.sourceWeaponId
    ]) {
      const sourceId = String(id ?? "").trim();
      if (!sourceObject && sourceId) sourceObject = caster.items?.get?.(sourceId) ?? null;
    }

    if (!sourceObject && spellItem?.parent?.documentName === "Actor" && spellItem?.type !== "sort") {
      sourceObject = spellItem;
    }
  }

  const sourcePowers = toArray(sourceObject?.system?.pouvoirs ?? sourceObject?.system?.powers)
    .filter(entry => entry && typeof entry === "object");
  const powerIndex = Number(spellItem?.system?.powerIndex ?? runtimeArgs[0]?.powerIndex);
  const powerId = String(spellItem?.system?.powerId ?? spellItem?.system?.powerKey ?? "").trim();
  const sourcePower = Number.isInteger(powerIndex) && powerIndex >= 0
    ? sourcePowers[powerIndex] ?? runtimeArgs[0]?.power ?? runtimeArgs[0]?.pouvoir ?? null
    : sourcePowers.find(entry => String(entry?.id ?? entry?.key ?? "") === powerId)
      ?? runtimeArgs[0]?.power
      ?? runtimeArgs[0]?.pouvoir
      ?? null;

  const objectTags = [
    sourceObject?.system?.tags,
    sourceObject?.system?.effectTags,
    sourceObject?.flags?.add2e?.tags,
    sourcePower?.tags,
    sourcePower?.effectTags,
    spellItem?.system?.tags,
    spellItem?.system?.effectTags,
    spellItem?.flags?.add2e?.tags
  ].flatMap(toArray).map(normalize).filter(Boolean);
  const objectTagSet = new Set(objectTags);
  const isGiantStrengthPotion = objectTagSet.has("objet_potion_de_force_de_geant");

  const delegateGiantStrengthPotion = async () => {
    const candidates = [
      sourcePower?.objetMagicOnUse,
      sourcePower?.fallbackOnUse,
      sourceObject?.system?.objetMagicOnUse,
      sourceObject?.system?.fallbackOnUse,
      "systems/add2e/scripts/objets_magiques/potion_de_force_de_geant.js"
    ]
      .map(value => String(value ?? "").trim())
      .filter(Boolean);
    const dedicatedPath = candidates.find(path => normalize(path).includes("potion_de_force_de_geant"))
      ?? "systems/add2e/scripts/objets_magiques/potion_de_force_de_geant.js";
    const requestPath = dedicatedPath.startsWith("/") ? dedicatedPath : `/${dedicatedPath}`;
    const response = await fetch(`${requestPath}?cb=${Date.now()}`);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const code = await response.text();
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const scope = {
      actor: caster,
      item: sourceObject,
      sourceItem: sourceObject,
      sort: spellItem,
      power: sourcePower,
      pouvoir: sourcePower,
      powerIndex: Number.isInteger(powerIndex) ? powerIndex : 0,
      isObjectPower: true
    };
    const runner = new AsyncFunction(
      "actor", "item", "sourceItem", "sort", "power", "pouvoir", "powerIndex",
      "scope", "args", "game", "ui", "ChatMessage", "Roll", "foundry", "canvas",
      code
    );
    return runner(
      caster,
      sourceObject,
      sourceObject,
      spellItem,
      sourcePower,
      sourcePower,
      Number.isInteger(powerIndex) ? powerIndex : 0,
      scope,
      runtimeArgs,
      game,
      ui,
      ChatMessage,
      Roll,
      foundry,
      canvas
    );
  };

  if (virtualPower) {
    if (isGiantStrengthPotion) return await delegateGiantStrengthPotion();

    await showAlert({
      title: "Force — source d’objet incohérente",
      theme: "danger",
      content: `<p><b>${escapeHtml(sourceObject?.name ?? "Objet magique")}</b> référence le sort Force sans être identifié comme une potion de force de géant.</p><p>L’utilisation est annulée afin de ne pas appliquer les règles du sort à un objet magique dont les règles sont différentes.</p>`
    });
    return false;
  }

  if (typeof globalThis.add2eCanonicalClassStates !== "function") {
    throw new Error("Force : le moteur canonique des classes ADD2E est indisponible.");
  }
  if (typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Force : l’API commune de carte de chat ADD2E est indisponible.");
  }

  const effectsEngine = globalThis.ADD2E_EFFECTS;
  if (typeof effectsEngine?.resolveAbilityDerived !== "function") {
    throw new Error("Force : le résolveur canonique des caractéristiques ADD2E est indisponible.");
  }

  const timeEngine = game?.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE;
  if (typeof timeEngine?.toRounds !== "function"
      || typeof timeEngine?.effectData !== "function"
      || typeof timeEngine?.createTimedActiveEffect !== "function") {
    throw new Error("Force : le moteur temporel ADD2E est indisponible.");
  }

  const casterClasses = globalThis.add2eCanonicalClassStates(caster);
  const magicienState = casterClasses.find(state => normalize(state?.slug ?? state?.name) === "magicien") ?? null;
  const casterLevel = Math.max(0, Math.floor(Number(magicienState?.level) || 0));
  if (casterLevel < 1) {
    await showAlert({
      title: "Force — niveau de lanceur",
      theme: "danger",
      content: "<p>Le niveau de magicien est introuvable dans les Items classe du lanceur.</p>"
    });
    return false;
  }

  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster?.id ? token : null)
    || runtimeArgs[0]?.token
    || canvas?.tokens?.controlled?.find?.(entry => entry?.actor?.id === caster?.id)
    || caster?.getActiveTokens?.()?.[0]
    || null;
  if (!casterToken) {
    await showAlert({
      title: "Force — portée",
      theme: "danger",
      content: "<p>Le lanceur doit disposer d’un token sur la scène pour vérifier la portée au toucher.</p>"
    });
    return false;
  }

  const targets = Array.from(game.user?.targets ?? []).filter(entry => entry?.actor);
  if (targets.length !== 1) {
    await showAlert({
      title: "Force — cible",
      content: "<p>Sélectionne exactement <b>une personne</b> à toucher avec le sort Force.</p>"
    });
    return false;
  }

  const targetToken = targets[0];
  const targetActor = targetToken.actor;

  const gridSize = Number(canvas?.grid?.size ?? canvas?.dimensions?.size ?? 100) || 100;
  const tokenCenter = tokenObject => {
    if (tokenObject?.center && Number.isFinite(Number(tokenObject.center.x)) && Number.isFinite(Number(tokenObject.center.y))) {
      return { x: Number(tokenObject.center.x), y: Number(tokenObject.center.y) };
    }
    const document = tokenObject?.document ?? tokenObject;
    return {
      x: Number(document?.x ?? 0) + (Number(document?.width ?? 1) * gridSize / 2),
      y: Number(document?.y ?? 0) + (Number(document?.height ?? 1) * gridSize / 2)
    };
  };
  const tokenDimensions = tokenObject => {
    const document = tokenObject?.document ?? tokenObject;
    return {
      width: Math.max(0.01, Number(document?.width ?? 1) || 1),
      height: Math.max(0.01, Number(document?.height ?? 1) || 1)
    };
  };
  const touchGapSpaces = (fromToken, toToken) => {
    const from = tokenCenter(fromToken);
    const to = tokenCenter(toToken);
    const fromSize = tokenDimensions(fromToken);
    const toSize = tokenDimensions(toToken);
    const dx = Math.abs(to.x - from.x) / gridSize;
    const dy = Math.abs(to.y - from.y) / gridSize;
    const gapX = Math.max(0, dx - ((fromSize.width + toSize.width) / 2));
    const gapY = Math.max(0, dy - ((fromSize.height + toSize.height) / 2));
    return Math.max(gapX, gapY);
  };

  const contactGap = touchGapSpaces(casterToken, targetToken);
  if (contactGap > 0.01) {
    await showAlert({
      title: "Force — hors de portée",
      content: `<p><b>${escapeHtml(targetToken.name ?? targetActor.name)}</b> n’est pas au contact du lanceur. Rapproche les tokens avant de lancer Force.</p>`
    });
    return false;
  }

  const classDice = Object.freeze({
    guerrier: 8,
    paladin: 8,
    ranger: 8,
    barde: 8,
    clerc: 6,
    druide: 6,
    voleur: 6,
    assassin: 6,
    magicien: 4,
    illusionniste: 4,
    moine: 4
  });

  const targetClasses = globalThis.add2eCanonicalClassStates(targetActor);
  const classCandidates = targetClasses
    .map(state => {
      const slug = normalize(state?.slug ?? state?.name);
      return {
        ...state,
        slug,
        sides: Number(classDice[slug]) || 0
      };
    })
    .filter(state => state.sides > 0);

  if (!classCandidates.length) {
    await showAlert({
      title: "Force — classe de la cible",
      theme: "danger",
      content: `<p>La classe de <b>${escapeHtml(targetActor.name)}</b> ne permet pas de déterminer le dé d’augmentation du sort Force à partir des Items classe canoniques.</p>`
    });
    return false;
  }

  const dieSides = Math.max(...classCandidates.map(state => state.sides));
  const selectedClasses = classCandidates.filter(state => state.sides === dieSides);
  const allClassLabels = targetClasses.map(state => state?.name ?? state?.slug).filter(Boolean);
  const selectedClassLabels = selectedClasses.map(state => state?.name ?? state?.slug).filter(Boolean);

  const before = effectsEngine.resolveAbilityDerived(targetActor, "force", {
    source: "spell-force-before"
  });
  const beforeScore = Math.max(3, Math.min(18, Math.trunc(Number(before?.score) || 3)));
  const beforePercentile = Math.max(0, Math.min(100, Math.trunc(Number(before?.exceptionalStrength?.percentile) || 0)));
  const exceptionalEligible = targetClasses.some(state =>
    ["guerrier", "paladin", "ranger"].includes(normalize(state?.slug ?? state?.name))
  );

  const roll = await new Roll(`1d${dieSides}`).evaluate();
  const gain = Math.max(1, Math.trunc(Number(roll.total) || 1));
  const rawAfter = beforeScore + gain;

  let forceRule;
  if (exceptionalEligible && (beforeScore >= 18 || rawAfter > 18)) {
    const excessPoints = beforeScore >= 18 ? gain : Math.max(0, rawAfter - 18);
    const percentile = Math.min(100, beforePercentile + (excessPoints * 10));
    forceRule = {
      id: `spell:${SPELL_SLUG}:exceptional`,
      kind: "characteristic-override",
      characteristic: "force",
      value: 18,
      label: "Force — augmentation magique",
      displayValue: percentile === 100 ? "18/00" : `18/${String(percentile).padStart(2, "0")}`,
      profile: {
        exceptionalStrength: { percentile }
      }
    };
  } else {
    forceRule = {
      id: `spell:${SPELL_SLUG}:bonus`,
      kind: "characteristic-bonus",
      characteristic: "force",
      value: gain,
      label: "Force — augmentation magique"
    };
  }

  const durationTurns = 6 * casterLevel;
  const durationRounds = timeEngine.toRounds(durationTurns, "turn", { level: casterLevel });
  const spellName = String(spellItem?.name ?? "Force").trim() || "Force";

  const effectData = timeEngine.effectData({
    name: spellName,
    img: spellItem?.img ?? "icons/svg/upgrade.svg",
    origin: spellItem?.uuid ?? null,
    rounds: durationTurns,
    unit: "turn",
    description: "Le sort augmente temporairement la Force de la personne touchée selon sa classe.",
    tags: [
      `sort:${SPELL_SLUG}`,
      "classe:magicien",
      "liste:magicien",
      "niveau:2",
      "type:condition",
      "ecole:alteration",
      "effet:force"
    ],
    source: "spell",
    caster,
    sourceItem: spellItem,
    endMessage: `Le sort Force prend fin sur ${targetActor.name}.`,
    extraFlags: {
      version: VERSION,
      level: casterLevel,
      spell: {
        slug: SPELL_SLUG,
        name: spellName,
        level: 2,
        school: "Altération"
      },
      spellKey: SPELL_SLUG,
      spellName,
      sourceType: "spell",
      sourceItemId: spellItem?.id ?? null,
      sourceItemUuid: spellItem?.uuid ?? null,
      sourceName: spellName,
      rules: [forceRule],
      forceSpell: {
        die: `1d${dieSides}`,
        gain,
        selectedClasses: selectedClasses.map(state => state.slug),
        allClasses: targetClasses.map(state => normalize(state?.slug ?? state?.name)).filter(Boolean),
        exceptionalEligible,
        beforeScore,
        beforePercentile
      }
    }
  });

  const created = await timeEngine.createTimedActiveEffect(targetActor, effectData);
  if (!created?.ok || !created?.effect) {
    await showAlert({
      title: "Force — effet",
      theme: "danger",
      content: `<p>L’effet de Force n’a pas pu être créé sur <b>${escapeHtml(targetActor.name)}</b>.</p>`
    });
    return false;
  }

  const after = effectsEngine.resolveAbilityDerived(targetActor, "force", {
    source: "spell-force-after"
  });

  const strengthLabel = resolution => {
    const score = Math.max(3, Math.min(18, Math.trunc(Number(resolution?.score) || 3)));
    const percentile = Math.max(0, Math.min(100, Math.trunc(Number(resolution?.exceptionalStrength?.percentile) || 0)));
    if (score === 18 && percentile > 0) {
      return percentile === 100 ? "18/00" : `18/${String(percentile).padStart(2, "0")}`;
    }
    return String(score);
  };

  const sourceImage = casterToken?.document?.texture?.src ?? caster?.img ?? "icons/svg/mystery-man.svg";
  const targetImage = targetToken?.document?.texture?.src ?? targetActor?.img ?? "icons/svg/mystery-man.svg";

  await globalThis.add2eCreateChatCard({
    actor: caster,
    title: spellName,
    icon: "fas fa-hand-fist",
    variant: "spell",
    source: {
      name: caster.name ?? "Magicien",
      img: sourceImage,
      type: "Sort profane",
      meta: `Magicien niveau ${casterLevel}`
    },
    target: {
      name: targetActor.name ?? "Cible",
      img: targetImage,
      type: "Personne touchée",
      meta: allClassLabels.join(" / ")
    },
    rows: [
      {
        label: "Classe retenue",
        value: `${selectedClassLabels.join(" / ")} — 1d${dieSides}`
      },
      {
        label: "Augmentation",
        value: `+${gain}`
      },
      {
        label: "Force avant",
        value: strengthLabel(before)
      },
      {
        label: "Force après",
        value: strengthLabel(after)
      },
      {
        label: "Durée",
        value: `${durationTurns} tours (${durationRounds} rounds)`
      },
      {
        label: "Jet de protection",
        value: "Aucun"
      }
    ],
    message: exceptionalEligible && Number(after?.exceptionalStrength?.percentile) > 0
      ? "La Force exceptionnelle est résolue par le moteur canonique ADD2E."
      : "L’augmentation de Force est résolue par le moteur canonique ADD2E."
  });

  return true;
})();
