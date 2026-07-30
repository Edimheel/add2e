// ADD2E — onUse Magicien : Lévitation.
// Compatible Foundry V13/V14/V15 — DialogV2 uniquement.
// La mécanique est matérialisée par un ActiveEffect et des modificateurs du moteur canonique.

return await (async () => {
  const VERSION = "2026-07-30-levitation-canonical-movement-v1";
  const TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][LEVITATION]";
  const SPELL = Object.freeze({
    name: "Lévitation",
    slug: "levitation",
    level: 2,
    rangeMetresPerLevel: 6,
    durationRoundsPerLevel: 10,
    selfVerticalSpeed: 6,
    otherVerticalSpeed: 3,
    capacityKgPerLevel: 50,
    imgFallback: "systems/add2e/assets/icones/sorts/magicien-levitation.webp"
  });

  const number = (value, fallback = 0) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
    if (value && typeof value === "object") {
      for (const key of ["value", "current", "actuel", "total", "base", "max"]) {
        if (value[key] !== undefined) {
          const parsed = number(value[key], NaN);
          if (Number.isFinite(parsed)) return parsed;
        }
      }
      return fallback;
    }
    const match = String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/,/g, ".")
      .match(/[+\-]?\d+(?:\.\d+)?/);
    const parsed = match ? Number(match[0]) : NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const norm = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const sourceSpell = (typeof item !== "undefined" && item)
    || (typeof sort !== "undefined" && sort)
    || (typeof sourceItem !== "undefined" && sourceItem)
    || (typeof args !== "undefined" && args?.[0]?.item)
    || null;

  const castDocument = (typeof sort !== "undefined" && sort)
    || (typeof args !== "undefined" && args?.[0]?.sort)
    || sourceSpell;

  const caster = (typeof actor !== "undefined" && actor)
    || sourceSpell?.parent
    || (typeof args !== "undefined" && args?.[0]?.actor)
    || null;

  function casterTokenFor(actorDocument) {
    const direct = (typeof token !== "undefined" && token?.actor?.id === actorDocument?.id) ? token : null;
    return direct
      ?? canvas?.tokens?.controlled?.find?.(candidate => candidate?.actor?.id === actorDocument?.id)
      ?? actorDocument?.getActiveTokens?.(true, true)?.[0]
      ?? null;
  }

  function actorClassLevel(actorDocument) {
    const explicitCasterLevel = number(
      castDocument?.system?.casterLevel
      ?? castDocument?.system?.niveauLanceur
      ?? castDocument?.system?.niveau_lanceur
      ?? castDocument?.flags?.add2e?.casterLevel,
      NaN
    );
    if (Number.isFinite(explicitCasterLevel) && explicitCasterLevel > 0) return Math.floor(explicitCasterLevel);

    const details = actorDocument?.system?.details_classe ?? {};
    const byDetails = number(
      details?.magicien?.niveau
      ?? details?.mage?.niveau
      ?? details?.illusionniste?.niveau,
      NaN
    );
    if (Number.isFinite(byDetails) && byDetails > 0) return Math.floor(byDetails);

    const classItem = Array.from(actorDocument?.items ?? []).find(candidate => {
      if (String(candidate?.type ?? "").toLowerCase() !== "classe") return false;
      return /magicien|mage|illusionniste/i.test(String(candidate?.name ?? ""));
    });
    const byItem = number(classItem?.system?.niveau ?? classItem?.system?.level, NaN);
    if (Number.isFinite(byItem) && byItem > 0) return Math.floor(byItem);

    return Math.max(1, Math.floor(number(actorDocument?.system?.niveau ?? actorDocument?.system?.level, 1)));
  }

  function magicPowerContext(actorDocument) {
    const virtual = castDocument?.system?.isPower === true || String((typeof args !== "undefined" && args?.[0]?.castMode) ?? "") === "power";
    if (!virtual) return { active: false, item: null, power: null, powerIndex: null, permanent: false };

    const sourceId = String(
      castDocument?.system?.sourceItemId
      ?? castDocument?.system?.sourceWeaponId
      ?? castDocument?.flags?.add2e?.sourceItemId
      ?? ""
    ).trim();
    const objectItem = sourceId ? actorDocument?.items?.get?.(sourceId) ?? null : null;
    const powerIndex = Math.max(0, Math.floor(number(castDocument?.system?.powerIndex ?? castDocument?.flags?.add2e?.powerIndex, 0)));
    const powers = objectItem?.system?.pouvoirs ?? objectItem?.system?.powers ?? [];
    const power = Array.isArray(powers) ? powers[powerIndex] ?? null : null;
    const chargeMode = norm(power?.chargesMode ?? power?.modeCharges ?? power?.mode_charges);
    const durationText = norm(power?.duree ?? power?.duration ?? power?.parameters?.duree ?? power?.parameters?.duration);
    const permanent = chargeMode === "permanent"
      || durationText.includes("tant_que_porte")
      || durationText.includes("permanent")
      || durationText.includes("illimite");
    return { active: true, item: objectItem, power, powerIndex, permanent };
  }

  function selectedTarget(casterActor, casterToken) {
    const selected = Array.from(game.user?.targets ?? []).filter(target => target?.actor);
    if (selected.length > 1) {
      ui.notifications.warn(`${SPELL.name} : sélectionnez au maximum une cible.`);
      return { valid: false, token: null, actor: null };
    }
    if (selected.length === 1) return { valid: true, token: selected[0], actor: selected[0].actor };
    return { valid: true, token: casterToken, actor: casterActor };
  }

  function unitToMetres(value, unit) {
    const key = norm(unit);
    if (["ft", "feet", "foot", "pied", "pieds", "pi"].includes(key)) return value * 0.3048;
    if (["km", "kilometre", "kilometres"].includes(key)) return value * 1000;
    return value;
  }

  function distanceMetres(leftToken, rightToken) {
    if (!leftToken || !rightToken) return 0;
    const leftScene = leftToken.document?.parent ?? leftToken.scene ?? null;
    const rightScene = rightToken.document?.parent ?? rightToken.scene ?? null;
    if (leftScene?.id && rightScene?.id && leftScene.id !== rightScene.id) return Number.POSITIVE_INFINITY;
    const scene = leftScene ?? rightScene ?? canvas?.scene ?? null;
    const size = number(scene?.grid?.size ?? canvas?.grid?.size, 100) || 100;
    const distance = number(scene?.grid?.distance ?? canvas?.scene?.grid?.distance, 1) || 1;
    const unit = scene?.grid?.units ?? canvas?.scene?.grid?.units ?? "m";
    const left = leftToken.center ?? {
      x: number(leftToken.document?.x ?? leftToken.x, 0) + (number(leftToken.document?.width ?? leftToken.width, 1) * size / 2),
      y: number(leftToken.document?.y ?? leftToken.y, 0) + (number(leftToken.document?.height ?? leftToken.height, 1) * size / 2)
    };
    const right = rightToken.center ?? {
      x: number(rightToken.document?.x ?? rightToken.x, 0) + (number(rightToken.document?.width ?? rightToken.width, 1) * size / 2),
      y: number(rightToken.document?.y ?? rightToken.y, 0) + (number(rightToken.document?.height ?? rightToken.height, 1) * size / 2)
    };
    return unitToMetres((Math.hypot(number(right.x) - number(left.x), number(right.y) - number(left.y)) / size) * distance, unit);
  }

  function bodyWeightKg(actorDocument) {
    const value = number(actorDocument?.system?.poids, NaN);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function carriedWeightKg(actorDocument, targetToken) {
    const compute = globalThis.add2eComputeMovement;
    if (typeof compute !== "function") {
      throw new Error("Le domaine canonique ADD2E du mouvement et de l’encombrement est indisponible.");
    }
    const result = compute(actorDocument, {
      token: targetToken?.document ?? targetToken ?? null,
      scene: targetToken?.document?.parent ?? targetToken?.scene ?? canvas?.scene ?? null,
      consumer: "spell-levitation-weight"
    });
    return Math.max(0, number(result?.poidsKg, 0));
  }

  async function askSavingThrow(targetName) {
    const DialogV2 = foundry?.applications?.api?.DialogV2;
    if (!DialogV2?.wait) throw new Error(`${SPELL.name} : DialogV2 est indisponible.`);
    return DialogV2.wait({
      window: { title: `${SPELL.name} — jet de protection`, icon: "fas fa-arrow-up" },
      modal: true,
      rejectClose: false,
      content: `<form class="add2e-dialog-v2"><p><b>${esc(targetName ?? "La cible")}</b> peut annuler l’effet par un jet de protection si elle n’est pas consentante.</p><p>Choisissez le résultat du jet ou appliquez directement l’effet à une cible consentante.</p></form>`,
      buttons: [
        { action: "failed", label: "Consentante / jet raté", icon: "fas fa-check", default: true, callback: () => "failed" },
        { action: "saved", label: "Jet réussi", icon: "fas fa-shield-halved", callback: () => "saved" },
        { action: "cancel", label: "Annuler", icon: "fas fa-times", callback: () => null }
      ],
      close: () => null
    });
  }

  function sourceIdentity(powerContext) {
    const sourceDocument = powerContext.item ?? sourceSpell ?? castDocument;
    return {
      document: sourceDocument,
      id: String(sourceDocument?.id ?? sourceDocument?._id ?? SPELL.slug),
      uuid: String(sourceDocument?.uuid ?? ""),
      name: String(sourceDocument?.name ?? SPELL.name),
      type: powerContext.active ? "objet_magique" : "spell"
    };
  }

  function matchingEffects(actorDocument, source) {
    return Array.from(actorDocument?.effects?.contents ?? actorDocument?.effects ?? []).filter(effect => {
      const flags = effect?.flags?.add2e ?? {};
      return norm(flags.spell) === SPELL.slug
        && (!source?.id || String(flags.sourceItemId ?? "") === String(source.id));
    });
  }

  async function refreshMovement(actorDocument) {
    if (actorDocument?.type !== "personnage") return null;
    const recalc = globalThis.add2eRecalcMoveXp;
    return typeof recalc === "function" ? recalc(actorDocument, { mode: "movement" }) : null;
  }

  async function removeEffects(actorDocument, effects) {
    const ids = effects.map(effect => effect?.id).filter(Boolean);
    if (ids.length) await actorDocument.deleteEmbeddedDocuments("ActiveEffect", [...new Set(ids)]);
    await refreshMovement(actorDocument);
  }

  function durationData(rounds, permanent) {
    if (permanent) return {};
    return {
      rounds,
      startRound: game.combat?.round ?? null,
      startTurn: game.combat?.turn ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    };
  }

  async function createEffect({ targetActor, casterActor, casterLevel, source, verticalSpeed, selfCast, capacityKg, totalWeightKg, weightKnown, durationRounds, permanent }) {
    const existing = Array.from(targetActor?.effects?.contents ?? targetActor?.effects ?? []).filter(effect => norm(effect?.flags?.add2e?.spell) === SPELL.slug);
    const existingIds = existing.map(effect => effect.id).filter(Boolean);
    if (existingIds.length) await targetActor.deleteEmbeddedDocuments("ActiveEffect", existingIds);

    const commonMetadata = {
      spell: SPELL.slug,
      modes: ["levitation", "vertical", "vertical-only"],
      movementMode: "levitation",
      verticalOnly: true,
      horizontalAllowed: false,
      verticalSpeedMetersPerRound: verticalSpeed,
      selfCast,
      capacityKg,
      targetWeightKg: weightKnown ? totalWeightKg : null,
      weightKnown
    };

    const modifiers = [
      {
        id: `spell:${source.id}:${SPELL.slug}:ground`,
        domain: "movement",
        target: "ground",
        operation: "set",
        value: 0,
        priority: 250,
        stacking: { mode: "exclusive", group: "magical-movement-mode" },
        conditions: { active: true },
        metadata: commonMetadata
      },
      {
        id: `spell:${source.id}:${SPELL.slug}:vertical`,
        domain: "movement",
        target: "vertical",
        operation: "set",
        value: verticalSpeed,
        priority: 250,
        stacking: { mode: "exclusive", group: "magical-vertical-movement" },
        conditions: { active: true },
        metadata: commonMetadata
      }
    ];

    const [effect] = await targetActor.createEmbeddedDocuments("ActiveEffect", [{
      name: SPELL.name,
      img: source.document?.img ?? sourceSpell?.img ?? SPELL.imgFallback,
      disabled: false,
      transfer: false,
      type: "base",
      system: {},
      changes: [],
      duration: durationData(durationRounds, permanent),
      description: `La cible lévite verticalement à ${verticalSpeed} m par round. Tout mouvement horizontal volontaire est impossible, sauf en prenant appui sur une surface.`,
      flags: {
        add2e: {
          version: VERSION,
          sourceType: source.type,
          sourceItemId: source.id,
          sourceItemUuid: source.uuid,
          sourceItemName: source.name,
          casterActorId: casterActor?.id ?? null,
          casterActorUuid: casterActor?.uuid ?? null,
          casterLevel,
          spell: SPELL.slug,
          effectType: "movement",
          permanent,
          durationRounds: permanent ? null : durationRounds,
          tags: [
            `sort:${SPELL.slug}`,
            "classe:magicien",
            "liste:magicien",
            "niveau:2",
            "type:movement",
            "etat:levitation",
            "movement-mode:levitation",
            "mouvement:vertical"
          ],
          movement: commonMetadata,
          modifiers
        }
      }
    }]);

    await refreshMovement(targetActor);
    return effect ?? null;
  }

  async function createCard({ casterActor, targetActor, source, outcome, variant, rows, message }) {
    const build = globalThis.add2eBuildChatCard;
    const create = globalThis.add2eCreateChatCard;
    if (typeof build !== "function" || typeof create !== "function") {
      throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
    }
    const options = {
      actor: casterActor,
      title: SPELL.name,
      icon: "fas fa-arrow-up",
      variant,
      source: {
        name: casterActor?.name ?? "Magicien",
        img: casterActor?.img,
        type: source.type === "objet_magique" ? `Objet magique — ${source.name}` : "Sort profane"
      },
      rows: [
        { label: "Cible", value: targetActor?.name ?? "—" },
        { label: "Résultat", value: outcome },
        ...rows
      ],
      message,
      chatData: {
        flags: {
          add2e: {
            spellEffect: SPELL.slug,
            version: VERSION,
            outcome: norm(outcome),
            targetActorId: targetActor?.id ?? null,
            sourceItemId: source.id
          }
        }
      }
    };
    const preview = build(options);
    if (!String(preview ?? "").trim()) throw new Error(`La carte ADD2E de ${SPELL.name} est vide.`);
    return create(options);
  }

  if (!caster || !sourceSpell) {
    ui.notifications.error(`${SPELL.name} : lanceur ou sort introuvable.`);
    return false;
  }

  const casterToken = casterTokenFor(caster);
  const target = selectedTarget(caster, casterToken);
  if (!target.valid || !target.actor) return false;

  const targetActor = target.actor;
  const targetToken = target.token;
  const selfCast = String(targetActor.id) === String(caster.id);
  const level = actorClassLevel(caster);
  const rangeMetres = SPELL.rangeMetresPerLevel * level;

  if (!selfCast) {
    if (!casterToken || !targetToken) {
      ui.notifications.warn(`${SPELL.name} : les tokens du lanceur et de la cible doivent être présents sur la scène.`);
      return false;
    }
    const distance = distanceMetres(casterToken, targetToken);
    if (!Number.isFinite(distance) || distance > rangeMetres + 0.001) {
      ui.notifications.warn(`${SPELL.name} : cible hors portée (${Number.isFinite(distance) ? distance.toFixed(1) : "—"} m / ${rangeMetres} m).`);
      return false;
    }
  }

  const powerContext = magicPowerContext(caster);
  const source = sourceIdentity(powerContext);
  const sourceEffects = matchingEffects(targetActor, source);
  if (powerContext.permanent && sourceEffects.length) {
    await removeEffects(targetActor, sourceEffects);
    await createCard({
      casterActor: caster,
      targetActor,
      source,
      outcome: "Effet désactivé",
      variant: "success",
      rows: [{ label: "Mouvement", value: "Le déplacement normal est rétabli." }],
      message: `${source.name} ne maintient plus la lévitation.`
    });
    console.log(`${TAG}[TOGGLE_OFF]`, { caster: caster.name, target: targetActor.name, source: source.name });
    return true;
  }

  if (!selfCast) {
    const saveResult = await askSavingThrow(targetActor.name);
    if (!saveResult) return false;
    if (saveResult === "saved") {
      await createCard({
        casterActor: caster,
        targetActor,
        source,
        outcome: "Jet de protection réussi",
        variant: "failure",
        rows: [{ label: "Effet", value: "Aucune lévitation n’est appliquée." }],
        message: `${targetActor.name} résiste à la lévitation.`
      });
      console.log(`${TAG}[SAVED]`, { caster: caster.name, target: targetActor.name });
      return true;
    }
  }

  const capacityKg = SPELL.capacityKgPerLevel * level;
  const bodyKg = bodyWeightKg(targetActor);
  const carriedKg = carriedWeightKg(targetActor, targetToken);
  const weightKnown = Number.isFinite(bodyKg);
  const totalWeightKg = weightKnown ? bodyKg + carriedKg : carriedKg;

  if (weightKnown && totalWeightKg > capacityKg + 0.001) {
    await createCard({
      casterActor: caster,
      targetActor,
      source,
      outcome: "Poids trop élevé",
      variant: "failure",
      rows: [
        { label: "Poids total", value: `${totalWeightKg.toFixed(1)} kg` },
        { label: "Capacité", value: `${capacityKg} kg` },
        { label: "Effet", value: "Aucune lévitation n’est appliquée." }
      ],
      message: `${targetActor.name} dépasse la masse maximale que le sort peut soulever.`
    });
    console.log(`${TAG}[OVERWEIGHT]`, { caster: caster.name, target: targetActor.name, capacityKg, totalWeightKg });
    return true;
  }

  const verticalSpeed = selfCast ? SPELL.selfVerticalSpeed : SPELL.otherVerticalSpeed;
  const durationRounds = SPELL.durationRoundsPerLevel * level;
  await createEffect({
    targetActor,
    casterActor: caster,
    casterLevel: level,
    source,
    verticalSpeed,
    selfCast,
    capacityKg,
    totalWeightKg,
    weightKnown,
    durationRounds,
    permanent: powerContext.permanent
  });

  await createCard({
    casterActor: caster,
    targetActor,
    source,
    outcome: "Lévitation appliquée",
    variant: "success",
    rows: [
      { label: "Déplacement", value: `vertical uniquement — ${verticalSpeed} m/round` },
      { label: "Horizontal", value: "0 m, sauf appui sur une surface" },
      { label: "Durée", value: powerContext.permanent ? "Tant que l’effet reste actif" : `${durationRounds} rounds (${level} tour${level > 1 ? "s" : ""})` },
      { label: "Capacité", value: `${capacityKg} kg` },
      { label: "Poids", value: weightKnown ? `${totalWeightKg.toFixed(1)} kg, équipement compris` : `poids corporel non renseigné ; ${carriedKg.toFixed(1)} kg d’équipement comptabilisé` }
    ],
    message: selfCast
      ? `${targetActor.name} contrôle sa montée et sa descente.`
      : `${caster.name} contrôle l’altitude de ${targetActor.name}.`
  });

  console.log(`${TAG}[DONE]`, {
    version: VERSION,
    caster: caster.name,
    target: targetActor.name,
    level,
    verticalSpeed,
    permanent: powerContext.permanent,
    weightKnown
  });
  return true;
})();