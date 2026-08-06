// ADD2E — Résolution sociale canonique : réactions, compagnons et loyauté.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2 uniquement.

import { add2eEvaluateRollSafe } from "./13d-actor-sheet-listeners-rolls.mjs";

const ADD2E_SOCIAL_RESOLUTION_VERSION = "2026-08-06-add2e-dialogs-player-social-cards-v4";
const ADD2E_AMITIE_REACTION_VERSION = ADD2E_SOCIAL_RESOLUTION_VERSION;

const ADD2E_LOYALTY_SITUATIONS = Object.freeze({
  general: Object.freeze({
    key: "general",
    label: "Test général",
    consequence: "Déloyauté, désobéissance ou lâcheté selon la situation."
  }),
  corruption: Object.freeze({ key: "corruption", label: "Corruption", consequence: "Coopération" }),
  testimony_against_lord: Object.freeze({
    key: "testimony_against_lord",
    label: "Témoigner contre le seigneur",
    consequence: "Témoigne"
  }),
  opportunity_theft: Object.freeze({
    key: "opportunity_theft",
    label: "Possibilité de vol",
    consequence: "Vol"
  }),
  left_alone_desertion: Object.freeze({
    key: "left_alone_desertion",
    label: "Laissé seul face à un potentiel de désertion",
    consequence: "Désertion"
  }),
  abandoned: Object.freeze({ key: "abandoned", label: "Abandonné", consequence: "Désertion" }),
  dangerous_order: Object.freeze({ key: "dangerous_order", label: "Ordre dangereux", consequence: "Refus" }),
  heroic_order: Object.freeze({ key: "heroic_order", label: "Ordre héroïque", consequence: "Refus" }),
  dangerous_heroic_order: Object.freeze({
    key: "dangerous_heroic_order",
    label: "Ordre dangereux et héroïque",
    consequence: "Refus"
  }),
  save_group: Object.freeze({
    key: "save_group",
    label: "Ordre de sauver des membres du groupe",
    consequence: "Refus"
  }),
  save_lord: Object.freeze({
    key: "save_lord",
    label: "Ordre de sauver le seigneur",
    consequence: "Refus"
  }),
  dangerous_opponent: Object.freeze({
    key: "dangerous_opponent",
    label: "Combat contre un adversaire dangereux",
    consequence: "Fuite"
  }),
  lord_incapacitated_or_dead: Object.freeze({
    key: "lord_incapacitated_or_dead",
    label: "Seigneur immobilisé ou mort",
    consequence: "Fuite"
  }),
  surrender_offer: Object.freeze({
    key: "surrender_offer",
    label: "Offre de reddition",
    consequence: "Reddition"
  }),
  surrounded_superior_enemy: Object.freeze({
    key: "surrounded_superior_enemy",
    label: "Encerclé par un ennemi supérieur",
    consequence: "Reddition"
  }),
  use_personal_magic_item: Object.freeze({
    key: "use_personal_magic_item",
    label: "Ordre d’utiliser un objet magique personnel",
    consequence: "Refus"
  })
});

globalThis.ADD2E_SOCIAL_RESOLUTION_VERSION = ADD2E_SOCIAL_RESOLUTION_VERSION;
globalThis.ADD2E_AMITIE_REACTION_VERSION = ADD2E_AMITIE_REACTION_VERSION;
globalThis.ADD2E_CHARISMA_RULES_VERSION = ADD2E_SOCIAL_RESOLUTION_VERSION;

function add2eSocialEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (
    !engine
    || typeof engine.resolveAbilityDerived !== "function"
    || typeof engine.collect !== "function"
    || typeof engine.resolve !== "function"
    || typeof engine.createModifier !== "function"
  ) {
    throw new Error("Le moteur canonique ADD2E des réactions et de la loyauté est indisponible.");
  }
  return engine;
}

function add2eSocialEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eSocialNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eSocialSigned(value, suffix = "") {
  const number = Number(value) || 0;
  return `${number > 0 ? "+" : ""}${number}${suffix}`;
}

function add2eSocialArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eSocialArray);
  if (value instanceof Set) return [...value].flatMap(add2eSocialArray);
  return [value];
}

function add2eSocialModifierIdentity(modifier) {
  const source = modifier?.source ?? {};
  return JSON.stringify([
    modifier?.id ?? "",
    modifier?.domain ?? "",
    modifier?.target ?? "",
    modifier?.operation ?? "",
    modifier?.value ?? null,
    source.uuid ?? source.id ?? source.name ?? ""
  ]);
}

function add2eSocialDeduplicateModifiers(modifiers = []) {
  const seen = new Set();
  return modifiers.filter(modifier => {
    if (!modifier || typeof modifier !== "object") return false;
    const identity = add2eSocialModifierIdentity(modifier);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function add2eSocialSourceMatches(modifier, sourceActor) {
  const metadata = modifier?.metadata ?? {};
  const sourceUuid = String(metadata.sourceActorUuid ?? metadata.casterUuid ?? "").trim();
  const sourceId = String(metadata.sourceActorId ?? metadata.casterId ?? "").trim();
  if (sourceUuid && sourceUuid !== String(sourceActor?.uuid ?? "")) return false;
  if (sourceId && sourceId !== String(sourceActor?.id ?? "")) return false;
  return Boolean(sourceUuid || sourceId);
}

function add2eSocialCircumstance(context = {}) {
  const raw = context?.circumstance;
  if (!raw || typeof raw !== "object") return null;
  const value = Number(raw.value ?? raw.amount ?? raw.bonus ?? raw.modifier);
  if (!Number.isFinite(value) || value === 0) return null;
  return {
    label: String(raw.label ?? raw.name ?? "Circonstance").trim() || "Circonstance",
    value
  };
}

function add2eSocialContribution(entry) {
  const contribution = Number(entry?.contribution);
  if (Number.isFinite(contribution)) return contribution;
  const modifier = entry?.modifier ?? entry;
  return Number(modifier?.value) || 0;
}

function add2eSocialModifierLabel(entry) {
  const modifier = entry?.modifier ?? entry;
  const label = String(modifier?.metadata?.label ?? modifier?.source?.name ?? "Modificateur").trim() || "Modificateur";
  const operation = String(modifier?.operation ?? "add");
  const value = add2eSocialContribution(entry);
  if (operation === "set") return `${label} → ${value}`;
  if (operation === "multiply") return `${label} ×${value}`;
  if (operation === "minmax") return `${label} (limite)`;
  return `${label} ${add2eSocialSigned(value)}`;
}

function add2eSocialAppliedLabels(resolution) {
  const labels = add2eSocialArray(resolution?.applied)
    .map(add2eSocialModifierLabel)
    .filter(Boolean);
  return labels.length ? labels.join(" ; ") : "Aucun";
}

function add2eCollectIncomingReactionModifiers(sourceActor, targetActor, context = {}) {
  if (!sourceActor?.system || !targetActor?.system) return [];
  const engine = add2eSocialEngine();
  const collected = engine.collect(targetActor, {
    ...context,
    actor: targetActor,
    sourceActor,
    targetActor,
    actionType: "reaction",
    charismaDomain: "reaction",
    charismaTarget: "encounter",
    reactionTarget: "encounter",
    source: context.source ?? "contextual-reaction"
  });

  return collected.filter(modifier => {
    const domain = add2eSocialNormalize(modifier?.domain);
    const target = add2eSocialNormalize(modifier?.target);
    const direction = add2eSocialNormalize(modifier?.metadata?.direction ?? modifier?.metadata?.perspective);
    if (domain !== "reaction" || !["encounter", "all"].includes(target)) return false;
    if (!["incoming", "toward_source", "towards_source"].includes(direction)) return false;
    return add2eSocialSourceMatches(modifier, sourceActor);
  });
}

function add2eCollectSubjectLoyaltyModifiers(leaderActor, subjectActor, context = {}) {
  if (!leaderActor?.system || !subjectActor?.system) return [];
  const engine = add2eSocialEngine();
  const collected = engine.collect(subjectActor, {
    ...context,
    actor: subjectActor,
    leaderActor,
    sourceActor: leaderActor,
    targetActor: subjectActor,
    subjectActor,
    actionType: "morale",
    moraleTarget: "loyalty",
    charismaDomain: "morale",
    charismaTarget: "loyalty",
    source: context.source ?? "charisma-loyalty"
  });

  return collected.filter(modifier => {
    const domain = add2eSocialNormalize(modifier?.domain);
    const target = add2eSocialNormalize(modifier?.target);
    return domain === "morale" && ["loyalty", "all"].includes(target);
  });
}

function add2eResolveSocialDomain(actor, {
  domain,
  target,
  base,
  context = {},
  extraModifiers = [],
  rounding = "floor"
} = {}) {
  if (!actor?.system) throw new Error("Acteur introuvable pour la résolution sociale.");
  const engine = add2eSocialEngine();
  const resolutionContext = {
    ...context,
    actor,
    sourceActor: context.sourceActor ?? actor,
    actionType: domain,
    charismaDomain: domain,
    charismaTarget: target,
    moraleTarget: domain === "morale" ? target : context.moraleTarget,
    reactionTarget: domain === "reaction" ? target : context.reactionTarget,
    source: context.source ?? `charisma:${domain}:${target}`
  };
  const modifiers = [
    ...engine.collect(actor, resolutionContext),
    ...add2eSocialArray(extraModifiers)
  ];
  const circumstance = add2eSocialCircumstance(context);
  if (circumstance) {
    modifiers.push(engine.createModifier({
      id: `${actor.id}:social:${domain}:${target}:circumstance`,
      domain,
      target,
      operation: "add",
      value: circumstance.value,
      priority: 1000,
      stacking: { mode: "stack", group: null },
      conditions: {},
      source: {
        kind: "context",
        id: `${domain}:${target}:circumstance`,
        uuid: actor.uuid ?? "",
        name: circumstance.label
      },
      metadata: {
        label: circumstance.label,
        transient: true,
        circumstance: true
      }
    }));
  }

  const canonicalModifiers = add2eSocialDeduplicateModifiers(modifiers);
  const resolution = engine.resolve(actor, {
    domain,
    target,
    base,
    rounding,
    modifiers: canonicalModifiers,
    context: resolutionContext
  });
  return { engine, resolution, circumstance, modifiers: canonicalModifiers, context: resolutionContext };
}

function add2eResolveCharismaFollowers(actor, context = {}) {
  const engine = add2eSocialEngine();
  const charisma = engine.resolveAbilityDerived(actor, "charisme", {
    ...context,
    source: context.source ?? "charisma-followers",
    consumer: "followers-maximum"
  });
  const base = Math.max(0, Math.trunc(Number(charisma?.profile?.compagnons) || 0));
  const { resolution } = add2eResolveSocialDomain(actor, {
    domain: "resource",
    target: "followers-max",
    base,
    context: {
      ...context,
      source: context.source ?? "charisma-followers"
    }
  });
  const maximum = Math.max(0, Math.trunc(Number(resolution?.total) || 0));
  return {
    version: ADD2E_SOCIAL_RESOLUTION_VERSION,
    charisma,
    base,
    maximum,
    adjustment: maximum - base,
    resolution
  };
}

function add2eResolveIncomingReaction(sourceActor, targetActor, context = {}) {
  const engine = add2eSocialEngine();
  const modifiers = add2eCollectIncomingReactionModifiers(sourceActor, targetActor, context);
  const resolution = engine.resolve(targetActor, {
    domain: "reaction",
    target: "encounter",
    base: 0,
    rounding: "floor",
    modifiers,
    context: {
      ...context,
      actor: targetActor,
      sourceActor,
      targetActor,
      actionType: "reaction",
      reactionTarget: "encounter",
      source: context.source ?? "contextual-reaction"
    }
  });

  return {
    version: ADD2E_SOCIAL_RESOLUTION_VERSION,
    sourceActor,
    targetActor,
    modifiers,
    adjustment: Math.trunc(Number(resolution?.total) || 0),
    resolution
  };
}

function add2eResolveCharismaReaction(actor, context = {}) {
  const engine = add2eSocialEngine();
  const targetActor = context.targetActor ?? null;
  const charisma = engine.resolveAbilityDerived(actor, "charisme", {
    ...context,
    source: context.source ?? "charisma-reaction",
    consumer: "encounter-reaction"
  });
  const charismaAdjustment = Math.trunc(Number(charisma?.profile?.react) || 0);
  const incomingModifiers = targetActor
    ? add2eCollectIncomingReactionModifiers(actor, targetActor, context)
    : [];
  const domainResult = add2eResolveSocialDomain(actor, {
    domain: "reaction",
    target: "encounter",
    base: charismaAdjustment,
    extraModifiers: incomingModifiers,
    context: {
      ...context,
      sourceActor: actor,
      targetActor,
      source: context.source ?? "charisma-reaction"
    }
  });
  const adjustment = Math.trunc(Number(domainResult.resolution?.total) || 0);
  const circumstanceValue = Number(domainResult.circumstance?.value) || 0;
  return {
    version: ADD2E_SOCIAL_RESOLUTION_VERSION,
    actor,
    targetActor,
    targetActors: add2eSocialArray(context.targetActors).filter(Boolean),
    charisma,
    charismaAdjustment,
    permanentAdjustment: adjustment - charismaAdjustment - circumstanceValue,
    circumstance: domainResult.circumstance,
    adjustment,
    incomingModifiers,
    initialAttitude: String(context.initialAttitude ?? "").trim(),
    resolution: domainResult.resolution
  };
}

function add2eCharismaReactionOutcome(total) {
  const value = Math.trunc(Number(total) || 0);
  if (value <= 5) return { key: "violently-hostile", label: "Violemment hostile", variant: "failure" };
  if (value <= 25) return { key: "hostile", label: "Hostile", variant: "failure" };
  if (value <= 45) return { key: "uncertain-negative", label: "Incertaine, tendance négative", variant: "neutral" };
  if (value <= 55) return { key: "neutral", label: "Neutre ou indifférente", variant: "neutral" };
  if (value <= 75) return { key: "uncertain-positive", label: "Incertaine, tendance positive", variant: "neutral" };
  if (value <= 95) return { key: "friendly", label: "Amicale", variant: "success" };
  return { key: "extremely-friendly", label: "Extrêmement amicale et enthousiaste", variant: "success" };
}

function add2eSocialTargetLabel(context = {}, singular = "Cible") {
  const explicit = String(context.targetLabel ?? "").trim();
  if (explicit) return explicit;
  if (context.targetActor?.name) return String(context.targetActor.name);
  const targets = add2eSocialArray(context.targetActors).filter(Boolean);
  if (targets.length === 1) return String(targets[0]?.name ?? singular);
  if (targets.length > 1) return `Groupe ciblé (${targets.length})`;
  return "Réaction générale";
}

async function add2eRollCharismaReactionCard(actor, context = {}) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  const reaction = add2eResolveCharismaReaction(actor, context);
  const roll = await add2eEvaluateRollSafe("1d100");
  const rawRoll = Math.trunc(Number(roll.total) || 0);
  const total = rawRoll + reaction.adjustment;
  const outcome = add2eCharismaReactionOutcome(total);
  const targetLabel = add2eSocialTargetLabel(context);
  const adjustedRollLabel = reaction.adjustment
    ? `${rawRoll} ${add2eSocialSigned(reaction.adjustment)} = ${total}`
    : String(total);
  const card = {
    actor,
    title: String(context.title ?? "Réaction initiale"),
    icon: "fas fa-comments",
    variant: outcome.variant,
    source: {
      name: actor.name,
      img: actor.img,
      type: "Réaction"
    },
    rows: [
      { label: "Cible", value: targetLabel },
      reaction.initialAttitude ? { label: "Attitude initiale", value: reaction.initialAttitude } : null,
      { label: "Jet", value: adjustedRollLabel },
      { label: "Réaction", value: outcome.label }
    ].filter(Boolean),
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [roll],
      flags: {
        add2e: {
          chatCardType: "charisma-reaction-check",
          charismaRulesVersion: ADD2E_SOCIAL_RESOLUTION_VERSION,
          rawRoll,
          total,
          adjustment: reaction.adjustment,
          charismaAdjustment: reaction.charismaAdjustment,
          permanentAdjustment: reaction.permanentAdjustment,
          appliedModifiers: add2eSocialAppliedLabels(reaction.resolution),
          circumstance: reaction.circumstance,
          initialAttitude: reaction.initialAttitude || null,
          outcome: outcome.key,
          actorUuid: actor.uuid,
          targetActorUuid: context.targetActor?.uuid ?? null,
          targetActorUuids: add2eSocialArray(context.targetActors).map(target => target?.uuid).filter(Boolean),
          targetLabel
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(card);
  const message = await globalThis.add2eCreateChatCard(card);
  return { ...reaction, roll, rawRoll, total, outcome, targetLabel, message };
}

function add2eLoyaltySituation(value) {
  const rawKey = value && typeof value === "object" ? value.key : value;
  const key = add2eSocialNormalize(rawKey || "general");
  const canonical = ADD2E_LOYALTY_SITUATIONS[key] ?? ADD2E_LOYALTY_SITUATIONS.general;
  if (!value || typeof value !== "object") return canonical;
  return {
    key: canonical.key,
    label: String(value.label ?? canonical.label).trim() || canonical.label,
    consequence: String(value.consequence ?? canonical.consequence).trim() || canonical.consequence
  };
}

function add2eLoyaltyBand(score) {
  const value = Math.trunc(Number(score) || 0);
  if (value < 1) {
    return {
      key: "none",
      label: "Aucune",
      description: "Cherche à tuer, capturer, blesser ou déserter à la première opportunité."
    };
  }
  if (value <= 25) {
    return {
      key: "disloyal",
      label: "Déloyal",
      description: "Cherche toujours à satisfaire son propre intérêt, quelles que soient les circonstances."
    };
  }
  if (value <= 50) {
    return {
      key: "weak",
      label: "Faible",
      description: "Cherche à satisfaire son intérêt au premier signe de faiblesse."
    };
  }
  if (value <= 75) {
    return {
      key: "average",
      label: "Moyenne",
      description: "Soutient si le danger n’est pas trop grand."
    };
  }
  if (value <= 100) {
    return {
      key: "loyal",
      label: "Loyal",
      description: "Cherche toujours à défendre la cause de son seigneur, même en courant de grands risques."
    };
  }
  return {
    key: "fanatic",
    label: "Fanatique",
    description: "Sert le seigneur sans poser de question et est prêt à sacrifier sa vie sans hésitation."
  };
}

function add2eLoyaltyPlayerResult(success, consequence) {
  if (success) return "Loyal et obéissant.";
  const key = add2eSocialNormalize(consequence);
  if (key === "refus") return "Refuse l’ordre.";
  if (key === "fuite") return "Prend la fuite.";
  if (key === "desertion") return "Déserte.";
  if (key === "reddition") return "Se rend.";
  if (key === "vol") return "Vole dès que possible.";
  if (key === "cooperation") return "Coopère avec l’autre camp.";
  if (key === "temoigne") return "Témoigne contre son seigneur.";
  return "N’obéit pas.";
}

function add2eResolveCharismaLoyalty(actor, context = {}) {
  const engine = add2eSocialEngine();
  const subjectActor = context.subjectActor ?? context.targetActor ?? null;
  const charisma = engine.resolveAbilityDerived(actor, "charisme", {
    ...context,
    source: context.source ?? "charisma-loyalty",
    consumer: "loyalty"
  });
  const charismaAdjustment = Math.trunc(Number(charisma?.profile?.loy) || 0);
  const baseChance = 50 + charismaAdjustment;
  const subjectModifiers = subjectActor
    ? add2eCollectSubjectLoyaltyModifiers(actor, subjectActor, context)
    : [];
  const domainResult = add2eResolveSocialDomain(actor, {
    domain: "morale",
    target: "loyalty",
    base: baseChance,
    extraModifiers: subjectModifiers,
    context: {
      ...context,
      leaderActor: actor,
      sourceActor: actor,
      targetActor: subjectActor,
      subjectActor,
      source: context.source ?? "charisma-loyalty"
    }
  });
  const rawThreshold = Math.trunc(Number(domainResult.resolution?.total) || 0);
  const threshold = Math.max(0, Math.min(100, rawThreshold));
  const circumstanceValue = Number(domainResult.circumstance?.value) || 0;
  return {
    version: ADD2E_SOCIAL_RESOLUTION_VERSION,
    actor,
    subjectActor,
    charisma,
    base: 50,
    charismaAdjustment,
    baseChance,
    permanentAdjustment: rawThreshold - baseChance - circumstanceValue,
    circumstance: domainResult.circumstance,
    situation: add2eLoyaltySituation(context.situation),
    band: add2eLoyaltyBand(rawThreshold),
    threshold,
    rawThreshold,
    subjectModifiers,
    resolution: domainResult.resolution
  };
}

async function add2eRollCharismaLoyaltyCard(actor, context = {}) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  const loyalty = add2eResolveCharismaLoyalty(actor, context);
  const roll = await add2eEvaluateRollSafe("1d100");
  const total = Math.trunc(Number(roll.total) || 0);
  const success = total <= loyalty.threshold;
  const consequence = success
    ? "Loyauté, obédience ou moral maintenu."
    : loyalty.situation.consequence;
  const playerResult = add2eLoyaltyPlayerResult(success, consequence);
  const subjectLabel = String(
    context.subjectLabel
    ?? loyalty.subjectActor?.name
    ?? context.targetLabel
    ?? "Compagnon, suivant ou groupe"
  ).trim();
  const card = {
    actor,
    title: String(context.title ?? `Test de loyauté — ${success ? "Réussite" : "Échec"}`),
    icon: "fas fa-people-group",
    variant: success ? "success" : "failure",
    source: {
      name: actor.name,
      img: actor.img,
      type: "Loyauté"
    },
    rows: [
      { label: "Sujet", value: subjectLabel },
      { label: "Jet", value: `${total} / ${loyalty.threshold}` },
      { label: "Résultat", value: playerResult }
    ],
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [roll],
      flags: {
        add2e: {
          chatCardType: "charisma-loyalty-check",
          charismaRulesVersion: ADD2E_SOCIAL_RESOLUTION_VERSION,
          success,
          total,
          threshold: loyalty.threshold,
          rawThreshold: loyalty.rawThreshold,
          charismaAdjustment: loyalty.charismaAdjustment,
          circumstance: loyalty.circumstance,
          loyaltyBand: loyalty.band.key,
          loyaltySituation: loyalty.situation.key,
          consequence,
          playerResult,
          actorUuid: actor.uuid,
          subjectActorUuid: loyalty.subjectActor?.uuid ?? null,
          subjectLabel
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(card);
  const message = await globalThis.add2eCreateChatCard(card);
  return { ...loyalty, roll, total, success, consequence, playerResult, subjectLabel, message };
}

async function add2eRollContextualReactionCard(sourceActor, targetActor = null, context = {}) {
  const result = await add2eRollCharismaReactionCard(sourceActor, {
    ...context,
    sourceActor,
    targetActor
  });
  const incomingReaction = targetActor
    ? add2eResolveIncomingReaction(sourceActor, targetActor, context)
    : null;
  return { ...result, incomingReaction };
}

async function add2ePromptContextualReaction(sourceActor, targetActor = null, context = {}) {
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  const targetLabel = add2eSocialTargetLabel({
    ...context,
    targetActor,
    targetActors: context.targetActors
  });

  return globalThis.add2eDialogWait({
    add2eTheme: "parchment",
    add2ePrimaryAction: "roll",
    add2eClasses: ["add2e-social-reaction-window"],
    window: { title: "Réaction initiale" },
    position: { width: 430 },
    content: `<form class="add2e-social-reaction-form" style="display:flex;flex-direction:column;gap:8px;">
      <p style="margin:0;font-size:.85em;"><b>Interlocuteur :</b> ${add2eSocialEscape(sourceActor?.name ?? "Personnage")}</p>
      <p style="margin:0;font-size:.85em;"><b>Cible :</b> ${add2eSocialEscape(targetLabel)}</p>
      <div class="form-group"><label>Attitude initiale ou contexte</label><input type="text" name="initialAttitude" placeholder="Ex. prudente, méfiante, négociation"></div>
      <div class="form-group"><label>Circonstance</label><input type="text" name="label" placeholder="Ex. offre généreuse"></div>
      <div class="form-group"><label>Modificateur</label><input type="number" name="value" value="0" step="1"></div>
      <p style="margin:0;font-size:.85em;">Les objets, effets actifs et effets contextuels dirigés vers l’interlocuteur sont résolus automatiquement.</p>
    </form>`,
    buttons: [
      {
        action: "roll",
        label: "Lancer",
        icon: "fa-solid fa-dice-d20",
        default: true,
        callback: (_event, button) => {
          const value = Number(button.form?.elements?.value?.value ?? 0) || 0;
          return {
            targetLabel,
            initialAttitude: String(button.form?.elements?.initialAttitude?.value ?? "").trim(),
            circumstance: value ? {
              label: String(button.form?.elements?.label?.value ?? "").trim() || "Circonstance",
              value
            } : null
          };
        }
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ],
    close: () => null
  });
}

function add2eLoyaltySituationOptions() {
  return Object.values(ADD2E_LOYALTY_SITUATIONS)
    .map(entry => `<option value="${add2eSocialEscape(entry.key)}">${add2eSocialEscape(entry.label)} — échec : ${add2eSocialEscape(entry.consequence)}</option>`)
    .join("");
}

async function add2ePromptCharismaLoyalty(actor, subjectActor = null, context = {}) {
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  const subjectLabel = String(
    context.subjectLabel
    ?? subjectActor?.name
    ?? (add2eSocialArray(context.targetActors).length > 1
      ? `Groupe ciblé (${add2eSocialArray(context.targetActors).length})`
      : "Compagnon, suivant ou groupe")
  ).trim();

  return globalThis.add2eDialogWait({
    add2eTheme: "parchment",
    add2ePrimaryAction: "roll",
    add2eClasses: ["add2e-social-loyalty-window"],
    window: { title: "Loyauté, obédience ou moral" },
    position: { width: 500 },
    content: `<form class="add2e-social-loyalty-form" style="display:flex;flex-direction:column;gap:8px;">
      <p style="margin:0;font-size:.85em;"><b>Seigneur ou commandant :</b> ${add2eSocialEscape(actor?.name ?? "Personnage")}</p>
      <p style="margin:0;font-size:.85em;"><b>Sujet :</b> ${add2eSocialEscape(subjectLabel)}</p>
      <div class="form-group"><label>Situation</label><select name="situation" style="width:100%;">${add2eLoyaltySituationOptions()}</select></div>
      <div class="form-group"><label>Circonstance</label><input type="text" name="label" placeholder="Ex. solde exceptionnelle, mauvais traitement"></div>
      <div class="form-group"><label>Modificateur</label><input type="number" name="value" value="0" step="1"></div>
      <p style="margin:0;font-size:.85em;">Base 50 % ± ajustement de Charisme. Les objets, effets actifs et modificateurs de moral du sujet sont ajoutés automatiquement.</p>
    </form>`,
    buttons: [
      {
        action: "roll",
        label: "Lancer",
        icon: "fa-solid fa-dice-d20",
        default: true,
        callback: (_event, button) => {
          const value = Number(button.form?.elements?.value?.value ?? 0) || 0;
          return {
            subjectLabel,
            situation: add2eLoyaltySituation(button.form?.elements?.situation?.value),
            circumstance: value ? {
              label: String(button.form?.elements?.label?.value ?? "").trim() || "Circonstance",
              value
            } : null
          };
        }
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ],
    close: () => null
  });
}

globalThis.ADD2E_LOYALTY_SITUATIONS = ADD2E_LOYALTY_SITUATIONS;
globalThis.add2eResolveCharismaFollowers = add2eResolveCharismaFollowers;
globalThis.add2eCollectIncomingReactionModifiers = add2eCollectIncomingReactionModifiers;
globalThis.add2eResolveIncomingReaction = add2eResolveIncomingReaction;
globalThis.add2eResolveCharismaReaction = add2eResolveCharismaReaction;
globalThis.add2eRollCharismaReactionCard = add2eRollCharismaReactionCard;
globalThis.add2eRollContextualReactionCard = add2eRollContextualReactionCard;
globalThis.add2ePromptContextualReaction = add2ePromptContextualReaction;
globalThis.add2eCollectSubjectLoyaltyModifiers = add2eCollectSubjectLoyaltyModifiers;
globalThis.add2eResolveCharismaLoyalty = add2eResolveCharismaLoyalty;
globalThis.add2eRollCharismaLoyaltyCard = add2eRollCharismaLoyaltyCard;
globalThis.add2ePromptCharismaLoyalty = add2ePromptCharismaLoyalty;
globalThis.add2eLoyaltySituation = add2eLoyaltySituation;
globalThis.add2eLoyaltyBand = add2eLoyaltyBand;