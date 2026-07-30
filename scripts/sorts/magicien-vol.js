// ADD2E — onUse Magicien : Vol.
// Compatible Foundry V13/V14/V15.
// La mécanique est matérialisée par un ActiveEffect et des modificateurs du moteur canonique.

return await (async () => {
  const VERSION = "2026-07-30-flight-canonical-movement-v1";
  const TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][VOL]";
  const SPELL = Object.freeze({
    name: "Vol",
    slug: "vol",
    level: 3,
    horizontalSpeed: 36,
    ascentSpeed: 18,
    descentSpeed: 72,
    underwaterSpeed: 27,
    durationRoundsPerTurn: 10,
    imgFallback: "systems/add2e/assets/icones/sorts/magicien-vol.webp"
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

  function gridCellMetres(scene) {
    const distance = number(scene?.grid?.distance ?? canvas?.scene?.grid?.distance, 1.5) || 1.5;
    return Math.max(1.5, unitToMetres(distance, scene?.grid?.units ?? canvas?.scene?.grid?.units ?? "m"));
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
    if (typeof recalc !== "function") {
      throw new Error("Le domaine canonique ADD2E du mouvement et de l’encombrement est indisponible.");
    }
    return recalc(actorDocument, { mode: "movement" });
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

  async function rollSecretDuration(level, permanent) {
    if (permanent) return { extraTurns: null, turns: null, rounds: null };
    const roll = await new Roll("1d6").evaluate();
    const extraTurns = Math.max(1, Math.floor(number(roll.total, 1)));
    const turns = Math.max(1, level) + extraTurns;
    return { extraTurns, turns, rounds: turns * SPELL.durationRoundsPerTurn };
  }

  async function createEffect({ targetActor, casterActor, casterLevel, source, durationRounds, permanent }) {
    const existing = Array.from(targetActor?.effects?.contents ?? targetActor?.effects ?? []).filter(effect => norm(effect?.flags?.add2e?.spell) === SPELL.slug);
    const existingIds = existing.map(effect => effect.id).filter(Boolean);
    if (existingIds.length) await targetActor.deleteEmbeddedDocuments("ActiveEffect", existingIds);

    const commonMetadata = {
      spell: SPELL.slug,
      modes: ["flight", "vol"],
      movementMode: "flight",
      horizontalSpeedMetersPerRound: SPELL.horizontalSpeed,
      ascentSpeedMetersPerRound: SPELL.ascentSpeed,
      descentSpeedMetersPerRound: SPELL.descentSpeed,
      underwaterSpeedMetersPerRound: SPELL.underwaterSpeed,
      manoeuvrabilityClass: "B",
      ignoresEncumbrance: true
    };

    const modifiers = [
      {
        id: `spell:${source.id}:${SPELL.slug}:ground`,
        domain: "movement",
        target: "ground",
        operation: "set",
        value: SPELL.horizontalSpeed,
        priority: 300,
        stacking: { mode: "exclusive", group: "magical-movement-mode" },
        conditions: { active: true },
        metadata: commonMetadata
      },
      {
        id: `spell:${source.id}:${SPELL.slug}:ground-underwater`,
        domain: "movement",
        target: "ground",
        operation: "set",
        value: SPELL.underwaterSpeed,
        priority: 310,
        stacking: { mode: "exclusive", group: "magical-movement-mode" },
        conditions: {
          active: true,
          environments: ["underwater", "sous_eau", "sous-eau", "aquatique"]
        },
        metadata: { ...commonMetadata, modes: ["flight", "vol", "underwater", "sous-eau"], environment: "underwater" }
      },
      {
        id: `spell:${source.id}:${SPELL.slug}:flight`,
        domain: "movement",
        target: "flight",
        operation: "set",
        value: SPELL.horizontalSpeed,
        priority: 300,
        stacking: { mode: "exclusive", group: "magical-flight-speed" },
        conditions: { active: true },
        metadata: commonMetadata
      },
      {
        id: `spell:${source.id}:${SPELL.slug}:ascent`,
        domain: "movement",
        target: "ascent",
        operation: "set",
        value: SPELL.ascentSpeed,
        priority: 300,
        stacking: { mode: "exclusive", group: "magical-ascent-speed" },
        conditions: { active: true },
        metadata: commonMetadata
      },
      {
        id: `spell:${source.id}:${SPELL.slug}:descent`,
        domain: "movement",
        target: "descent",
        operation: "set",
        value: SPELL.descentSpeed,
        priority: 300,
        stacking: { mode: "exclusive", group: "magical-descent-speed" },
        conditions: { active: true },
        metadata: commonMetadata
      },
      {
        id: `spell:${source.id}:${SPELL.slug}:underwater`,
        domain: "movement",
        target: "underwater",
        operation: "set",
        value: SPELL.underwaterSpeed,
        priority: 310,
        stacking: { mode: "exclusive", group: "magical-underwater-speed" },
        conditions: { active: true },
        metadata: { ...commonMetadata, modes: ["flight", "vol", "underwater", "sous-eau"] }
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
      description: `La cible vole à ${SPELL.horizontalSpeed} m par round, monte à ${SPELL.ascentSpeed} m, descend à ${SPELL.descentSpeed} m et se déplace sous l’eau à ${SPELL.underwaterSpeed} m par round.`,
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
            "niveau:3",
            "type:movement",
            "etat:vol",
            "movement-mode:flight",
            "mouvement:aerien",
            "manoeuvrabilite:B"
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
      icon: "fas fa-feather-pointed",
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

  if (typeof globalThis.add2eRecalcMoveXp !== "function") {
    throw new Error("Le domaine canonique ADD2E du mouvement et de l’encombrement est indisponible.");
  }

  const casterToken = casterTokenFor(caster);
  const target = selectedTarget(caster, casterToken);
  if (!target.valid || !target.actor) return false;

  const targetActor = target.actor;
  const targetToken = target.token;
  const selfCast = String(targetActor.id) === String(caster.id);
  if (!selfCast) {
    if (!casterToken || !targetToken) {
      ui.notifications.warn(`${SPELL.name} : les tokens du lanceur et de la cible doivent être présents sur la scène.`);
      return false;
    }
    const scene = casterToken.document?.parent ?? casterToken.scene ?? canvas?.scene ?? null;
    const touchRange = gridCellMetres(scene);
    const distance = distanceMetres(casterToken, targetToken);
    if (!Number.isFinite(distance) || distance > touchRange + 0.001) {
      ui.notifications.warn(`${SPELL.name} : la cible doit être au contact (${Number.isFinite(distance) ? distance.toFixed(1) : "—"} m / ${touchRange.toFixed(1)} m).`);
      return false;
    }
  }

  const level = actorClassLevel(caster);
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
      message: `${source.name} ne maintient plus le vol.`
    });
    console.log(`${TAG}[TOGGLE_OFF]`, { caster: caster.name, target: targetActor.name, source: source.name });
    return true;
  }

  const duration = await rollSecretDuration(level, powerContext.permanent);
  await createEffect({
    targetActor,
    casterActor: caster,
    casterLevel: level,
    source,
    durationRounds: duration.rounds,
    permanent: powerContext.permanent
  });

  await createCard({
    casterActor: caster,
    targetActor,
    source,
    outcome: "Vol appliqué",
    variant: "success",
    rows: [
      { label: "Vol", value: `${SPELL.horizontalSpeed} m/round — manœuvrabilité B` },
      { label: "Montée", value: `${SPELL.ascentSpeed} m/round` },
      { label: "Descente", value: `${SPELL.descentSpeed} m/round` },
      { label: "Sous l’eau", value: `${SPELL.underwaterSpeed} m/round, sans pénalité d’encombrement` },
      { label: "Durée", value: powerContext.permanent ? "Tant que l’effet reste actif" : `${level} tour${level > 1 ? "s" : ""} + 1d6 tours — tirage secret` }
    ],
    message: `${targetActor.name} contrôle pleinement sa direction de vol.`
  });

  console.log(`${TAG}[DONE]`, {
    version: VERSION,
    caster: caster.name,
    target: targetActor.name,
    level,
    permanent: powerContext.permanent,
    durationSecret: !powerContext.permanent
  });
  return true;
})();