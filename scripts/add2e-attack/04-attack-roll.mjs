// scripts/add2e-attack/04-attack-roll.mjs
// ADD2E — Résolution des attaques et modificateurs d'action canoniques.
// Compatible Foundry V13/V14/V15.

import { plageToRollFormula } from "./01-core-helpers.mjs";
import { add2eApplyDamage } from "./02-damage.mjs";
import {
  add2eMeasureTokenGridDistance,
  add2eGetCombatStatProfile,
  add2eGetBackstabInfo,
  add2eGetAssassinationInfo,
  add2eGetBackArcInfo,
  add2eBuildManualPositionInfo,
  add2eBuildPositionAttackAdjustment,
  add2eResolveSelectedPositionInfo,
  add2eTagSetHas,
  add2eRollAssassinationForAttack,
  add2eConsumeOneUseWeaponAfterAttack,
  add2eGetAttackAbilityModifier
} from "./03-attack-rules.mjs";
import {
  add2eAttackReadStrictNumber as add2eReadStrictNumber
} from "./04c-attack-roll-state.mjs";
import {
  add2eAttackComputeCharacterDisplayedCA
} from "./04d-attack-roll-defense.mjs";
import {
  add2eAttackComputeActiveAttackModifiers
} from "./04e-attack-roll-modifiers.mjs";
import {
  add2eAttackOpenDialogV2,
  add2eBuildAttackDialogContent
} from "./04f-attack-roll-dialog.mjs";
import {
  add2eAttackMeasureContactAndDistance,
  add2eAttackValidateRange,
  add2eAttackBuildDistanceLabel,
  add2eAttackResolveRangeBand
} from "./04g-attack-roll-range.mjs";
import {
  add2eAttackResolveConditionalFixedAC,
  add2eAttackResolveMagicProjectileNegation
} from "./04h-attack-roll-conditional-ac.mjs";
import {
  add2eCreateAttackChatCards
} from "./04i-attack-roll-chat-card.mjs";

const ADD2E_ATTACK_VERSION = "2026-08-01-canonical-transformation-thac0-v5";
const ADD2E_ATTACK_SNAPSHOT_VERSION = "2026-07-24-attack-resolution-snapshot-v1";
const ADD2E_ATTACK_ROLL_INVOKE_DEDUPE_MS = 1500;

globalThis.ADD2E_ATTACK_VERSION = ADD2E_ATTACK_VERSION;
globalThis.__ADD2E_ATTACK_ROLL_INVOKE_KEYS ??= new Map();
globalThis.__ADD2E_ATTACK_DIAG_SEQ ??= 0;

function add2eAttackNextDiagId(prefix = "atk") {
  globalThis.__ADD2E_ATTACK_DIAG_SEQ = Number(globalThis.__ADD2E_ATTACK_DIAG_SEQ || 0) + 1;
  return `${prefix}-${Date.now()}-${globalThis.__ADD2E_ATTACK_DIAG_SEQ}`;
}

function add2ePruneTimedMap(map, ttlMs, now = Date.now()) {
  if (!(map instanceof Map)) return;
  for (const [key, timestamp] of map.entries()) {
    if ((now - Number(timestamp || 0)) > ttlMs) map.delete(key);
  }
}

function add2eBuildAttackInvocationKey({ actor, arme, cibleToken }) {
  const tokenDocument = cibleToken?.document ?? cibleToken;
  const targetKey = tokenDocument?.uuid ?? tokenDocument?.id ?? cibleToken?.id ?? cibleToken?.name ?? "target";
  return [
    game.user?.id ?? "user",
    actor?.id ?? actor?.name ?? "actor",
    arme?.id ?? arme?.name ?? "weapon",
    targetKey
  ].join("|");
}

function add2eEnterAttackInvocationGuard(key, diagId = null) {
  const now = Date.now();
  const map = globalThis.__ADD2E_ATTACK_ROLL_INVOKE_KEYS;
  add2ePruneTimedMap(map, ADD2E_ATTACK_ROLL_INVOKE_DEDUPE_MS, now);
  if (map?.has?.(key)) {
    console.warn("[ADD2E][ATTAQUE][ROLL][SKIP_DUPLICATE_INVOCATION]", { diagId, key, user: game.user?.name });
    return false;
  }
  map?.set?.(key, now);
  return true;
}

function add2eReadSystemNumber(system, ...paths) {
  for (const path of paths) {
    let value = system?.[path];
    if (value === undefined && typeof foundry?.utils?.getProperty === "function") value = foundry.utils.getProperty(system, path);
    const number = add2eReadStrictNumber(value);
    if (number !== null) return { value: number, path };
  }
  return { value: null, path: null };
}

function add2eResolveAttackTokenActor(tokenLike) {
  const tokenObject = tokenLike?.object ?? tokenLike;
  const tokenDocument = tokenObject?.document ?? tokenLike?.document ?? tokenLike;
  return [
    tokenDocument?.actor,
    tokenObject?.actor,
    tokenDocument?.actorId ? game.actors?.get?.(tokenDocument.actorId) : null,
    tokenObject?.actorId ? game.actors?.get?.(tokenObject.actorId) : null
  ].find(Boolean) ?? null;
}

function add2eResolveAttackSourceToken(actor) {
  const controlled = canvas?.tokens?.controlled ?? [];
  return controlled.find(token => token?.actor?.id === actor?.id || token?.document?.actorId === actor?.id)
    ?? actor?.getActiveTokens?.()?.[0]
    ?? actor?.token?.object
    ?? actor?.token
    ?? null;
}

function add2eResolveAttackThac0(actor) {
  const system = actor.system || {};
  const transformation = globalThis.add2eGetCapabilityTransformationCombatProfile?.(actor) ?? null;
  const transformationThac0 = add2eReadStrictNumber(transformation?.thac0);
  if (transformationThac0 !== null) return transformationThac0;

  if (actor.type === "personnage") {
    const classItem = actor.items?.find(item => item.type === "classe");
    const level = Number(system.niveau) || 1;
    const progression = Array.isArray(classItem?.system?.progression) ? classItem.system.progression[level - 1] : null;
    if (progression?.thac0 !== undefined && progression?.thac0 !== null && progression?.thac0 !== "") {
      const thac0 = add2eReadStrictNumber(progression.thac0);
      if (thac0 !== null) return thac0;
      ui.notifications.error(`${actor.name} : progression de classe invalide, thac0 non numérique au niveau ${level}.`);
      console.error("[ADD2E][ATTAQUE][THAC0][INVALID_CLASS_PROGRESSION]", { actor: actor.name, classItem: classItem?.name, level, value: progression.thac0 });
      return null;
    }

    const thac0 = add2eReadStrictNumber(system.thac0);
    if (thac0 !== null) return thac0;
    ui.notifications.error(`${actor.name} : THAC0 absent. Corrige system.thac0 ou la progression de classe.`);
    console.error("[ADD2E][ATTAQUE][THAC0][MISSING_PERSONNAGE]", { actor: actor.name, classItem: classItem?.name });
    return null;
  }

  const thac0 = add2eReadStrictNumber(system.thac0);
  if (thac0 !== null) return thac0;
  ui.notifications.error(`${actor.name} : THAC0 monstre absent. Corrige le JSON du monstre : system.thac0.`);
  console.error("[ADD2E][ATTAQUE][THAC0][MISSING_MONSTER]", { actor: actor.name });
  return null;
}

function add2eResolveTargetArmorClass({ cible, actor, arme, isTouchAttack }) {
  const system = cible.system || {};
  let caBaseCible = null;
  let caSourceCible = "";
  let caComputedDetails = null;

  if (cible.type === "personnage") {
    const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
    if (typeof engine?.getMagicPassiveDefense === "function") {
      caComputedDetails = engine.getMagicPassiveDefense(cible, { source: "attack-roll", attacker: actor?.name, weapon: arme?.name });
      caComputedDetails.stored = { ca: system.ca, armorClass: system.armorClass, ca_naturel: system.ca_naturel };
      caSourceCible = "effects-engine:magic-passive-defense";
      caBaseCible = caComputedDetails.caTotal;
    } else {
      caComputedDetails = add2eAttackComputeCharacterDisplayedCA(cible);
      caSourceCible = "computed-token-scene:armor+dexDefense+shield";
      caBaseCible = caComputedDetails.caTotal;
    }
  } else {
    const read = add2eReadSystemNumber(
      system,
      "armorClass",
      "ca",
      "ac",
      "ca_naturel",
      "defense.armorClass",
      "defense.ca",
      "combat.armorClass",
      "combat.ca"
    );
    caSourceCible = read.path ? `system.${read.path}` : "system.armorClass|ca|ac";
    caBaseCible = read.value;
  }

  if (caBaseCible === null) {
    ui.notifications.error(`${cible.name} : CA absente. Corrige le JSON / les données acteur : ${caSourceCible}.`);
    console.error("[ADD2E][ATTAQUE][CA][MISSING_OR_INVALID]", { cible: cible.name, type: cible.type, source: caSourceCible, isTouchAttack });
    return null;
  }
  return { caBaseCible, caSourceCible, caComputedDetails };
}

function add2eResolveArmorAdjustment({ cible, arme, caBaseCible }) {
  let armorType = caBaseCible;
  if (cible.items) {
    const wornArmor = cible.items.find(item => item.type === "armure"
      && item.system.equipee
      && !item.name.toLowerCase().includes("bouclier")
      && !item.name.toLowerCase().includes("heaume")
      && !item.name.toLowerCase().includes("casque"));
    if (wornArmor && typeof wornArmor.system.ac === "number") armorType = Number(wornArmor.system.ac);
  }

  armorType = Math.max(2, Math.min(10, Math.round(Number(armorType))));
  if (!Array.isArray(arme.system.ajustement_ca)) return 0;
  const index = Math.max(0, Math.min(8, armorType - 2));
  return index < arme.system.ajustement_ca.length ? Number(arme.system.ajustement_ca[index]) || 0 : 0;
}

function add2eCombatEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.createModifier !== "function" || typeof engine.resolve !== "function") {
    throw new Error("Le résolveur canonique ADD2E des modificateurs de combat n’est pas disponible.");
  }
  return engine;
}

function add2eDeduplicateCombatModifiers(modifiers = []) {
  const seen = new Set();
  return modifiers.filter(modifier => {
    if (!modifier || typeof modifier !== "object") return false;
    const source = modifier.source ?? {};
    const key = JSON.stringify([
      modifier.id,
      modifier.domain,
      modifier.target,
      modifier.operation,
      modifier.value,
      modifier.priority,
      modifier.stacking?.mode,
      modifier.stacking?.group,
      source.uuid ?? source.id ?? source.name ?? ""
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function add2eCombatResolutionCandidates(resolution) {
  const candidates = [];
  for (const entry of resolution?.applied ?? []) if (entry?.modifier) candidates.push(entry.modifier);
  for (const entry of resolution?.rejected ?? []) if (entry?.modifier) candidates.push(entry.modifier);
  return add2eDeduplicateCombatModifiers(candidates);
}

function add2eCreateSituationModifier(engine, { id, value, label, actor, metadata = {} }) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return null;
  return engine.createModifier({
    id,
    domain: "attack",
    target: "toucher",
    operation: "add",
    value: amount,
    priority: 200,
    stacking: { mode: "stack", group: null },
    source: {
      kind: "attack-action",
      id: actor?.id ?? "attack-action",
      uuid: actor?.uuid ?? "",
      name: actor?.name ?? "Action d’attaque"
    },
    metadata: { label, producer: "attack-action", ...metadata }
  });
}

function add2eResolveFinalCombatModifiers({
  actor,
  cible,
  arme,
  combatProfile,
  persistentAttack,
  persistentDamage,
  actionContext,
  userBonus,
  rangeModifier,
  backstabBonus,
  positionBonus,
  armorAdjustment
}) {
  const engine = add2eCombatEngine();
  const abilityModifiers = {
    toucher: {
      ability: combatProfile?.toucherCarac ?? null,
      value: combatProfile?.toucherCarac ? add2eGetAttackAbilityModifier(actor, combatProfile.toucherCarac, "toucher") : 0
    },
    degats: {
      ability: combatProfile?.degatsCarac ?? null,
      value: combatProfile?.degatsCarac ? add2eGetAttackAbilityModifier(actor, combatProfile.degatsCarac, "degats") : 0
    }
  };
  const context = {
    ...actionContext,
    actor,
    target: cible,
    targetActor: cible,
    sourceItem: arme,
    sourceItemId: arme?.id ?? null,
    item: arme,
    weaponType: arme?.system?.famille_arme ?? arme?.system?.type_arme ?? arme?.system?.type ?? null,
    weaponTags: combatProfile?.tags ?? [],
    combatProfile,
    actionTags: combatProfile?.tags ?? [],
    abilityModifiers
  };
  const isPassiveAggregate = modifier => String(modifier?.source?.kind ?? "").replace(/-/g, "_") === "passive_rules";
  const collected = typeof engine.collect === "function" ? engine.collect(actor, context) : [];
  const attackModifiers = [
    ...add2eCombatResolutionCandidates(persistentAttack).filter(modifier => !isPassiveAggregate(modifier)),
    ...collected
  ];
  const damageModifiers = [
    ...add2eCombatResolutionCandidates(persistentDamage).filter(modifier => !isPassiveAggregate(modifier)),
    ...collected
  ];

  const passive = typeof engine.getPassiveCombatModifiers === "function"
    ? engine.getPassiveCombatModifiers(actor, context)
    : { toucher: 0, degats: 0, details: [] };
  const passiveSource = {
    kind: "passive-rules",
    id: actor?.id ?? "passive-rules",
    uuid: actor?.uuid ?? "",
    name: "Règles passives"
  };
  if (Number(passive?.toucher)) attackModifiers.push(engine.createModifier({
    id: `${actor.id}:attack:passive-rules:action`,
    domain: "attack",
    target: "toucher",
    operation: "add",
    value: Number(passive.toucher),
    priority: 100,
    stacking: { mode: "stack", group: null },
    source: passiveSource,
    metadata: { label: passive.details?.filter(detail => /toucher|attaque/i.test(detail)).join(" ; ") || "Règles passives au toucher" }
  }));
  if (Number(passive?.degats)) damageModifiers.push(engine.createModifier({
    id: `${actor.id}:damage:passive-rules:action`,
    domain: "damage",
    target: "degats",
    operation: "add",
    value: Number(passive.degats),
    priority: 100,
    stacking: { mode: "stack", group: null },
    source: passiveSource,
    metadata: { label: passive.details?.filter(detail => /degat|damage/i.test(detail)).join(" ; ") || "Règles passives aux dégâts" }
  }));

  for (const modifier of [
    add2eCreateSituationModifier(engine, { id: `${actor.id}:attack:manual`, value: userBonus, label: "Bonus/malus saisi", actor }),
    add2eCreateSituationModifier(engine, { id: `${actor.id}:attack:range`, value: rangeModifier, label: "Portée", actor, metadata: { rangeBand: actionContext.rangeBand } }),
    add2eCreateSituationModifier(engine, { id: `${actor.id}:attack:backstab`, value: backstabBonus, label: "Attaque dans le dos", actor }),
    add2eCreateSituationModifier(engine, { id: `${actor.id}:attack:position`, value: positionBonus, label: "Position", actor, metadata: { position: actionContext.position } }),
    add2eCreateSituationModifier(engine, { id: `${actor.id}:attack:armor-adjustment`, value: armorAdjustment, label: "Ajustement arme/armure", actor, metadata: { armorClass: actionContext.armorClass } })
  ]) if (modifier) attackModifiers.push(modifier);

  const shared = { item: arme, targetActor: cible, context };
  const attackResolution = engine.resolve(actor, {
    ...shared,
    domain: "attack",
    target: "toucher",
    base: 0,
    modifiers: add2eDeduplicateCombatModifiers(attackModifiers)
  });
  const damageResolution = engine.resolve(actor, {
    ...shared,
    domain: "damage",
    target: "degats",
    base: 0,
    modifiers: add2eDeduplicateCombatModifiers(damageModifiers)
  });

  return { attackResolution, damageResolution };
}

function add2eSnapshotMetadata(metadata = {}) {
  const result = {};
  for (const key of ["label", "rangeBand", "ability", "producer", "position", "armorClass"]) {
    const value = metadata?.[key];
    if (["string", "number", "boolean"].includes(typeof value)) result[key] = value;
  }
  return Object.freeze(result);
}

function add2eSnapshotResolution(resolution) {
  const applied = (resolution?.applied ?? []).map(entry => {
    const modifier = entry?.modifier ?? {};
    const source = modifier?.source ?? {};
    const contribution = Number.isFinite(Number(entry?.contribution)) ? Number(entry.contribution) : Number(modifier?.value) || 0;
    const metadata = add2eSnapshotMetadata(modifier?.metadata ?? {});
    return Object.freeze({
      id: String(modifier?.id ?? ""),
      label: String(metadata.label ?? source.name ?? modifier?.id ?? "Modificateur"),
      contribution,
      operation: String(modifier?.operation ?? "add"),
      source: Object.freeze({
        kind: String(source.kind ?? ""),
        id: String(source.id ?? ""),
        name: String(source.name ?? "")
      }),
      metadata
    });
  });

  return Object.freeze({
    domain: String(resolution?.domain ?? ""),
    target: String(resolution?.target ?? ""),
    base: Number(resolution?.base) || 0,
    total: Number(resolution?.total) || 0,
    applied: Object.freeze(applied)
  });
}

function add2eBuildAttackSnapshot({
  diagId,
  distanceCible,
  descPortee,
  typePortee,
  malusPortee,
  activePositionInfo,
  caAvantPosition,
  caAvantConditionnelle,
  caFinaleCible,
  thaco,
  valeurPourToucher,
  seuilFinalD20,
  d20,
  totalBonusToucher,
  totalAuToucher,
  finalResult,
  degats,
  formulaDegats,
  detailsDegats,
  totalBonusDegats,
  attackResolution,
  damageResolution,
  conditionalDetails,
  assassinatResult
}) {
  return Object.freeze({
    version: ADD2E_ATTACK_SNAPSHOT_VERSION,
    diagId: String(diagId),
    range: Object.freeze({
      distance: Number(distanceCible) || 0,
      description: String(descPortee ?? "Contact"),
      band: String(typePortee ?? "Contact"),
      modifier: Number(malusPortee) || 0
    }),
    position: Object.freeze({
      label: String(activePositionInfo?.label ?? "Face"),
      zone: String(activePositionInfo?.zone ?? "front"),
      caBefore: Number(caAvantPosition),
      caAfterPosition: Number(caAvantConditionnelle),
      caFinal: Number(caFinaleCible)
    }),
    threshold: Object.freeze({
      thac0: Number(thaco) || 0,
      armorClass: Number(caFinaleCible) || 0,
      base: Number(valeurPourToucher) || 0,
      final: Number(seuilFinalD20) || 0
    }),
    roll: Object.freeze({
      d20: Number(d20) || 0,
      bonus: Number(totalBonusToucher) || 0,
      total: Number(totalAuToucher) || 0
    }),
    result: Object.freeze({
      hit: finalResult === true,
      natural20: Number(d20) === 20,
      natural1: Number(d20) === 1
    }),
    damage: Object.freeze({
      amount: Number(degats) || 0,
      formula: String(formulaDegats ?? ""),
      details: String(detailsDegats ?? ""),
      bonus: Number(totalBonusDegats) || 0
    }),
    attackResolution: add2eSnapshotResolution(attackResolution),
    damageResolution: add2eSnapshotResolution(damageResolution),
    conditionalDetails: Object.freeze((conditionalDetails ?? []).map(value => String(value)).filter(Boolean)),
    assassination: Object.freeze({
      resolved: !!assassinatResult,
      success: assassinatResult?.success === true,
      roll: assassinatResult?.total ?? null,
      score: assassinatResult?.finalScore ?? null
    })
  });
}

export async function add2eAttackRoll({ actor, arme, actorId, itemId }) {
  const diagId = add2eAttackNextDiagId("attack-roll");
  if (!actor && actorId) actor = game.actors.get(actorId);
  if (!arme && itemId && actor) arme = actor.items.get(itemId);
  if (!actor) return ui.notifications.warn("Acteur introuvable !");
  if (!arme) return ui.notifications.warn("Arme introuvable !");
  if (!arme.system.equipee) return ui.notifications.warn(`L'arme "${arme.name}" n'est pas équipée !`);

  const srcToken = add2eResolveAttackSourceToken(actor);
  const chatImg = srcToken?.document?.texture?.src || srcToken?.texture?.src || actor.img;
  const cibleToken = Array.from(game.user.targets ?? [])[0];
  if (!cibleToken) return ui.notifications.warn("Aucune cible sélectionnée !");
  const cible = add2eResolveAttackTokenActor(cibleToken);
  if (!cible) return ui.notifications.warn("La cible sélectionnée n'a pas d'acteur utilisable.");

  const invocationKey = add2eBuildAttackInvocationKey({ actor, arme, cibleToken });
  if (!add2eEnterAttackInvocationGuard(invocationKey, diagId)) return false;

  const { distanceCible, auContact } = add2eAttackMeasureContactAndDistance({
    srcToken,
    cibleToken,
    measureDistance: add2eMeasureTokenGridDistance
  });
  const rangeValidation = add2eAttackValidateRange({ arme, distanceCible, auContact });
  if (!rangeValidation.ok) return false;

  const preCombatProfile = add2eGetCombatStatProfile(arme);
  const backstabInfo = add2eGetBackstabInfo(actor);
  const assassinationInfo = add2eGetAssassinationInfo(actor, cible);
  const backArcInfo = add2eGetBackArcInfo(srcToken, cibleToken);
  const defaultPositionInfo = add2eBuildManualPositionInfo("front", backArcInfo);
  const positionAttackAdjustment = add2eBuildPositionAttackAdjustment(cible, defaultPositionInfo);
  const specialAttackWeaponCompatible = !preCombatProfile.isProjectilePropulse;
  const specialAttackPositionCompatible = auContact;
  const canUseBackstab = backstabInfo.available && backstabInfo.multiplier > 1 && specialAttackWeaponCompatible && specialAttackPositionCompatible;
  const canUseAssassination = assassinationInfo.available && assassinationInfo.score > 0 && specialAttackWeaponCompatible && specialAttackPositionCompatible;
  const attackDistanceLabel = add2eAttackBuildDistanceLabel({ auContact, isDistanceWeapon: rangeValidation.isDistanceWeapon, distanceCible });
  const specialOptionsVisible = canUseBackstab || canUseAssassination || backstabInfo.available || assassinationInfo.available;

  const dialogContent = add2eBuildAttackDialogContent({
    actor,
    arme,
    cible,
    attackDistanceLabel,
    backArcInfo,
    positionAttackAdjustment,
    specialOptionsVisible,
    canUseBackstab,
    backstabInfo,
    canUseAssassination,
    assassinationInfo
  });

  return add2eAttackOpenDialogV2({
    title: "Bonus/Malus d’attaque",
    content: dialogContent,
    width: 460,
    classes: ["add2e", "add2e-attack-dialog"],
    defaultAction: "ok",
    onOk: async dlgHtml => {
      const userBonus = Number(dlgHtml.find("#add2e-bonus-attaque").val()) || 0;
      const selectedPositionZone = String(dlgHtml.find("#add2e-position-zone").val() || "front");
      const activePositionInfo = add2eResolveSelectedPositionInfo(selectedPositionZone, backArcInfo);
      const activePositionAttackAdjustment = add2eBuildPositionAttackAdjustment(cible, activePositionInfo);
      const useBackstab = canUseBackstab && activePositionInfo.isBehind && !!dlgHtml.find("#add2e-backstab").is(":checked");
      const useAssassination = canUseAssassination && activePositionInfo.isBehind && !!dlgHtml.find("#add2e-assassinat-confirm").is(":checked");
      const assassinatMod = Number(dlgHtml.find("#add2e-assassinat-mod").val()) || 0;

      const { malusPortee, descPortee, typePortee, isDistance } = add2eAttackResolveRangeBand({
        arme,
        srcToken,
        cibleToken,
        auContact,
        measureDistance: add2eMeasureTokenGridDistance
      });

      const thaco = add2eResolveAttackThac0(actor);
      if (thaco === null) return false;

      const combatProfile = add2eGetCombatStatProfile(arme);
      const modifierState = add2eAttackComputeActiveAttackModifiers({ actor, cible, arme, combatProfile });

      const bonusAttaqueSournoise = useBackstab ? 4 : 0;
      const bonusPositionToucher = !useBackstab ? Number(activePositionAttackAdjustment.hitBonus) || 0 : 0;
      const isTouchAttack = add2eTagSetHas(
        combatProfile.tags,
        "arme:toucher",
        "type_arme:toucher",
        "attaque:toucher",
        "attaque_speciale:toucher",
        "attaque_speciale:contact"
      ) || /\b(toucher|touch)\b/i.test(String(arme?.name ?? ""));
      const systemTarget = cible.system || {};
      const nomCible = cible.name;
      const tailleCible = (systemTarget.taille || systemTarget.size || "M").toUpperCase();

      const acData = add2eResolveTargetArmorClass({ cible, actor, arme, isTouchAttack });
      if (!acData) return false;
      const caBaseCible = acData.caBaseCible;
      let caFinaleCible = caBaseCible;
      const caAvantPosition = caFinaleCible;
      if (activePositionAttackAdjustment.caAdjustment !== 0) caFinaleCible += activePositionAttackAdjustment.caAdjustment;
      const caAvantConditionnelle = caFinaleCible;
      const conditionalFixedAC = add2eAttackResolveConditionalFixedAC({
        cible,
        arme,
        combatProfile,
        isDistance,
        positionInfo: activePositionInfo,
        caBefore: caFinaleCible,
        hasTag: add2eTagSetHas
      });
      caFinaleCible = conditionalFixedAC.ca;

      const ajustementCA = add2eResolveArmorAdjustment({ cible, arme, caBaseCible });
      const actionContext = {
        type: "attaque",
        actionType: "attaque",
        ruleScope: "owner",
        contact: auContact,
        distance: distanceCible,
        range: distanceCible,
        rangeBand: typePortee,
        position: activePositionInfo.zone,
        frontale: activePositionInfo.isFront === true,
        isDistance,
        armorClass: caBaseCible,
        armorAdjustment: ajustementCA,
        source: "attack-roll"
      };
      const finalModifiers = add2eResolveFinalCombatModifiers({
        actor,
        cible,
        arme,
        combatProfile,
        persistentAttack: modifierState.attackResolution,
        persistentDamage: modifierState.damageResolution,
        actionContext,
        userBonus,
        rangeModifier: malusPortee,
        backstabBonus: bonusAttaqueSournoise,
        positionBonus: bonusPositionToucher,
        armorAdjustment: ajustementCA
      });

      const totalBonusToucher = Number(finalModifiers.attackResolution.total) || 0;
      const totalBonusDegats = Number(finalModifiers.damageResolution.total) || 0;
      const targetTags = modifierState.targetTags ?? new Set();
      const valeurPourToucher = thaco - caFinaleCible;
      const roll = await new Roll("1d20").evaluate();
      if (game.dice3d) await game.dice3d.showForRoll(roll);
      await new Promise(resolve => setTimeout(resolve, 300));

      const d20 = roll.total;
      const totalAuToucher = d20 + totalBonusToucher;
      const seuilFinalD20 = valeurPourToucher - totalBonusToucher;
      let finalResult = d20 === 20 || (d20 !== 1 && d20 >= seuilFinalD20);
      let magicProjectileNegation = { eligible: false, negated: false, reason: "attack-missed", detail: "" };

      if (finalResult) {
        magicProjectileNegation = await add2eAttackResolveMagicProjectileNegation({
          cible,
          arme,
          combatProfile,
          isDistance,
          positionInfo: activePositionInfo,
          hasTag: add2eTagSetHas
        });
        if (magicProjectileNegation.negated === true) finalResult = false;
      }

      let degats = 0;
      let formulaDegats = "1d6";
      let detailsDegats = "";
      const backstabMultiplier = useBackstab ? Math.max(1, Number(backstabInfo.multiplier) || 1) : 1;
      let assassinatResult = null;

      if (finalResult) {
        const isLarge = ["G", "L", "LARGE"].includes(tailleCible);
        const rawDamage = (isLarge ? arme.system.dégâts?.contre_grand : arme.system.dégâts?.contre_moyen) || "1d6";
        formulaDegats = plageToRollFormula(rawDamage);
        if (totalBonusDegats !== 0) formulaDegats += totalBonusDegats > 0 ? `+${totalBonusDegats}` : `${totalBonusDegats}`;
        const damageRoll = await new Roll(formulaDegats).evaluate();
        if (game.dice3d) await game.dice3d.showForRoll(damageRoll);
        await new Promise(resolve => setTimeout(resolve, 300));
        const damageBeforeMultiplier = Math.max(1, damageRoll.total);
        degats = backstabMultiplier > 1 ? Math.max(1, damageBeforeMultiplier * backstabMultiplier) : damageBeforeMultiplier;
        detailsDegats = backstabMultiplier > 1 ? `${damageRoll.result} × ${backstabMultiplier}` : damageRoll.result;
        if (useAssassination) assassinatResult = await add2eRollAssassinationForAttack({ actor, score: assassinationInfo.score, situational: assassinatMod });

        const applied = await add2eApplyDamage({
          cible,
          montant: degats,
          source: arme.name,
          sourceItem: arme,
          lanceur: actor,
          silent: true
        });
        const appliedDamage = Number(applied?.amount);
        if (Number.isFinite(appliedDamage) && appliedDamage >= 0) degats = appliedDamage;
      }

      const conditionalDetails = [
        conditionalFixedAC?.detail ? `CA conditionnelle : ${conditionalFixedAC.detail}` : "",
        magicProjectileNegation?.eligible && magicProjectileNegation?.detail
          ? `Défense contre projectile magique : ${magicProjectileNegation.detail}`
          : ""
      ].filter(Boolean);

      const snapshot = add2eBuildAttackSnapshot({
        diagId,
        distanceCible,
        descPortee,
        typePortee,
        malusPortee,
        activePositionInfo,
        caAvantPosition,
        caAvantConditionnelle,
        caFinaleCible,
        thaco,
        valeurPourToucher,
        seuilFinalD20,
        d20,
        totalBonusToucher,
        totalAuToucher,
        finalResult,
        degats,
        formulaDegats,
        detailsDegats,
        totalBonusDegats,
        attackResolution: finalModifiers.attackResolution,
        damageResolution: finalModifiers.damageResolution,
        conditionalDetails,
        assassinatResult
      });

      console.log("[ADD2E][ATTAQUE][CANONICAL_RESOLUTION]", {
        version: ADD2E_ATTACK_VERSION,
        diagId,
        actor: actor.name,
        target: cible.name,
        weapon: arme.name,
        totalBonusToucher,
        totalBonusDegats,
        snapshot,
        attackResolution: finalModifiers.attackResolution,
        damageResolution: finalModifiers.damageResolution,
        targetTags: [...targetTags]
      });

      await add2eCreateAttackChatCards({
        actor,
        arme,
        cible,
        nomCible,
        chatImg,
        d20,
        totalBonusToucher,
        totalAuToucher,
        seuilFinalD20,
        finalResult,
        degats,
        formulaDegats,
        detailsDegats,
        useBackstab,
        backstabMultiplier,
        activePositionAttackAdjustment,
        assassinatResult,
        assassinationInfo,
        assassinatMod,
        thaco,
        caFinaleCible,
        caAvantPosition,
        caAvantConditionnelle,
        valeurPourToucher,
        malusPortee,
        userBonus,
        useAssassination,
        ajustementCA,
        snapshot
      });
      await add2eConsumeOneUseWeaponAfterAttack(actor, arme);
      return true;
    }
  });
}

globalThis.add2eAttackRoll = add2eAttackRoll;