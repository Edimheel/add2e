// scripts/add2e-attack/04-attack-roll.mjs
// ADD2E — Résolution des attaques.
// Version : 2026-05-30-attack-roll-gm-create-only-dedupe-v7

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
  add2eGetAttackAbilityModifier,
  add2eAttackAbilityLabel
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
  add2eAttackResolveConditionalFixedAC
} from "./04h-attack-roll-conditional-ac.mjs";
import {
  add2eBuildAttackChatCard
} from "./04i-attack-roll-chat-card.mjs";

const ADD2E_ATTACK_GM_DETAIL_CHAT = "ADD2E_ATTACK_GM_DETAIL_CHAT";
const ADD2E_ATTACK_GM_CHAT_VERSION = "2026-05-30-attack-roll-gm-create-only-dedupe-v7";
const ADD2E_ATTACK_GM_DETAIL_DEDUPE_MS = 4000;

globalThis.__ADD2E_ATTACK_GM_DETAIL_HANDLED_IDS ??= new Map();

function add2eAttackHtmlEscape(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function add2eAttackHash(value) {
  const text = String(value ?? "");
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function add2ePruneGmDetailDedupe(now = Date.now()) {
  const map = globalThis.__ADD2E_ATTACK_GM_DETAIL_HANDLED_IDS;
  if (!(map instanceof Map)) return;
  for (const [key, ts] of map.entries()) {
    if ((now - Number(ts || 0)) > ADD2E_ATTACK_GM_DETAIL_DEDUPE_MS) map.delete(key);
  }
}

function add2eReadSystemNumber(system, ...paths) {
  for (const path of paths) {
    let value = system?.[path];
    if (value === undefined && typeof foundry?.utils?.getProperty === "function") value = foundry.utils.getProperty(system, path);
    const n = add2eReadStrictNumber(value);
    if (n !== null) return { value: n, path };
  }
  return { value: null, path: null };
}

function add2eResolveAttackTokenActor(tokenLike) {
  const tokenObject = tokenLike?.object ?? tokenLike;
  const tokenDocument = tokenObject?.document ?? tokenLike?.document ?? tokenLike;

  const candidates = [
    tokenDocument?.actor,
    tokenObject?.actor,
    tokenDocument?.actorId ? game.actors?.get?.(tokenDocument.actorId) : null,
    tokenObject?.actorId ? game.actors?.get?.(tokenObject.actorId) : null
  ].filter(Boolean);

  return candidates[0] ?? null;
}

function add2eResolveAttackSourceToken(actor) {
  const controlled = canvas?.tokens?.controlled ?? [];
  const controlledMatch = controlled.find(t => t?.actor?.id === actor?.id || t?.document?.actorId === actor?.id);
  if (controlledMatch) return controlledMatch;

  const active = actor?.getActiveTokens?.()?.[0];
  if (active) return active;

  return actor?.token?.object ?? actor?.token ?? null;
}

function add2eGetGmWhisperIds() {
  const recipients = ChatMessage.getWhisperRecipients?.("GM") ?? [];
  const fromRecipients = recipients.map(u => u.id).filter(Boolean);
  if (fromRecipients.length) return fromRecipients;
  return Array.from(game.users ?? []).filter(u => u.isGM).map(u => u.id).filter(Boolean);
}

function add2eBuildGmDetailAttackMessageId({ actor, content, sourceUserId }) {
  return `gm-detail-${add2eAttackHash([sourceUserId ?? game.user?.id ?? "", actor?.id ?? actor?.name ?? "", content ?? ""].join("|"))}`;
}

async function add2eCreateGmAttackChatMessage(payload = {}) {
  if (!game.user?.isGM) return false;
  if (!payload.content) {
    console.warn("[ADD2E][ATTAQUE][GM_DETAIL][EMPTY_CONTENT]", { payload });
    return false;
  }

  const now = Date.now();
  add2ePruneGmDetailDedupe(now);

  const attackMessageId = payload.flags?.add2e?.attackMessageId
    ?? add2eBuildGmDetailAttackMessageId({
      actor: payload.speaker?.actor ? game.actors?.get?.(payload.speaker.actor) : null,
      content: payload.content,
      sourceUserId: payload.flags?.add2e?.attackSourceUserId
    });
  const handled = globalThis.__ADD2E_ATTACK_GM_DETAIL_HANDLED_IDS;

  if (attackMessageId && handled?.has?.(attackMessageId)) {
    console.warn("[ADD2E][ATTAQUE][GM_DETAIL][SKIP_DUPLICATE]", {
      version: ADD2E_ATTACK_GM_CHAT_VERSION,
      attackMessageId,
      user: game.user?.name
    });
    return false;
  }

  if (attackMessageId) handled?.set?.(attackMessageId, now);

  await ChatMessage.create({
    speaker: payload.speaker ?? ChatMessage.getSpeaker(),
    content: payload.content,
    avatar: payload.avatar,
    whisper: add2eGetGmWhisperIds(),
    blind: false,
    flags: {
      ...(payload.flags ?? {}),
      add2e: {
        ...(payload.flags?.add2e ?? {}),
        attackChatVisibility: "gm-only",
        attackChatVisibilityVersion: globalThis.ADD2E_ATTACK_CHAT_VISIBILITY_VERSION ?? ADD2E_ATTACK_GM_CHAT_VERSION,
        attackGmChatVersion: ADD2E_ATTACK_GM_CHAT_VERSION,
        attackGmCreatedBy: game.user?.id ?? null,
        attackMessageId
      }
    }
  });
  return true;
}

async function add2eRouteGmAttackChat({ actor, content, avatar }) {
  const whisper = add2eGetGmWhisperIds();
  const attackMessageId = add2eBuildGmDetailAttackMessageId({ actor, content, sourceUserId: game.user?.id });
  const messageData = {
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    avatar,
    whisper,
    blind: false,
    flags: {
      add2e: {
        attackChatVisibility: "gm-only",
        attackChatVisibilityVersion: globalThis.ADD2E_ATTACK_CHAT_VISIBILITY_VERSION ?? ADD2E_ATTACK_GM_CHAT_VERSION,
        attackGmChatVersion: ADD2E_ATTACK_GM_CHAT_VERSION,
        attackMessageId,
        attackSourceUserId: game.user?.id ?? null
      }
    }
  };

  console.log("[ADD2E][ATTAQUE][GM_DETAIL][ROUTE]", {
    version: ADD2E_ATTACK_GM_CHAT_VERSION,
    user: game.user?.name,
    isGM: game.user?.isGM,
    whisper,
    actor: actor?.name,
    hasContent: !!content,
    attackMessageId,
    route: game.user?.isGM ? "CREATE_BY_GM" : "REQUEST_TO_GM"
  });

  if (!content) return false;

  if (game.user?.isGM) {
    console.log("[ADD2E][ATTAQUE][GM_DETAIL][CREATE_BY_GM]", {
      version: ADD2E_ATTACK_GM_CHAT_VERSION,
      actor: actor?.name,
      user: game.user?.name,
      attackMessageId
    });
    return add2eCreateGmAttackChatMessage(messageData);
  }

  game.socket?.emit?.("system.add2e", {
    type: ADD2E_ATTACK_GM_DETAIL_CHAT,
    payload: messageData
  });
  return true;
}

function add2eRegisterGmAttackChatRelay() {
  const register = () => {
    if (!game?.socket?.on) return false;
    if (globalThis.__ADD2E_ATTACK_GM_DETAIL_SOCKET === ADD2E_ATTACK_GM_CHAT_VERSION) return true;
    globalThis.__ADD2E_ATTACK_GM_DETAIL_SOCKET = ADD2E_ATTACK_GM_CHAT_VERSION;

    game.socket.on("system.add2e", async (data = {}) => {
      if (data?.type !== ADD2E_ATTACK_GM_DETAIL_CHAT) return;

      console.log("[ADD2E][ATTAQUE][GM_DETAIL][SOCKET_RECEIVED]", {
        version: ADD2E_ATTACK_GM_CHAT_VERSION,
        user: game.user?.name,
        isGM: game.user?.isGM,
        hasContent: !!data?.payload?.content,
        attackMessageId: data?.payload?.flags?.add2e?.attackMessageId ?? null
      });

      if (!game.user?.isGM) return;

      console.log("[ADD2E][ATTAQUE][GM_DETAIL][CREATE_BY_GM]", {
        version: ADD2E_ATTACK_GM_CHAT_VERSION,
        user: game.user?.name,
        fromSocket: true,
        attackMessageId: data?.payload?.flags?.add2e?.attackMessageId ?? null
      });
      await add2eCreateGmAttackChatMessage(data.payload ?? {});
    });

    console.log("[ADD2E][ATTAQUE][GM_DETAIL][SOCKET_REGISTERED]", {
      version: ADD2E_ATTACK_GM_CHAT_VERSION,
      user: game.user?.name,
      isGM: game.user?.isGM
    });
    return true;
  };

  if (register()) return;
  Hooks.once("ready", register);
  setTimeout(register, 250);
  setTimeout(register, 1000);
  setTimeout(register, 2500);
}

function add2eResolveAttackThac0(actor) {
  const sys = actor.system || {};

  if (actor.type === "personnage") {
    const classeItem = actor.items?.find(i => i.type === "classe");
    const niv = Number(sys.niveau) || 1;
    const prog = Array.isArray(classeItem?.system?.progression) ? classeItem.system.progression[niv - 1] : null;

    if (prog && prog.thac0 !== undefined && prog.thac0 !== null && prog.thac0 !== "") {
      const thaco = add2eReadStrictNumber(prog.thac0);
      if (thaco === null) {
        ui.notifications.error(`${actor.name} : progression de classe invalide, thac0 non numérique au niveau ${niv}.`);
        console.error("[ADD2E][ATTAQUE][THAC0][INVALID_CLASS_PROGRESSION]", { acteur: actor.name, classe: classeItem?.name, niveau: niv, valeur: prog.thac0, progression: prog });
        return null;
      }
      return thaco;
    }

    const thaco = add2eReadStrictNumber(sys.thac0);
    if (thaco === null) {
      ui.notifications.error(`${actor.name} : THAC0 absent. Corrige system.thac0 ou la progression de classe.`);
      console.error("[ADD2E][ATTAQUE][THAC0][MISSING_PERSONNAGE]", { acteur: actor.name, attendu: "system.thac0 ou item classe system.progression[niveau-1].thac0", system: sys, classe: classeItem?.name, classeSystem: classeItem?.system });
      return null;
    }
    return thaco;
  }

  const thaco = add2eReadStrictNumber(sys.thac0);
  if (thaco === null) {
    ui.notifications.error(`${actor.name} : THAC0 monstre absent. Corrige le JSON du monstre : system.thac0.`);
    console.error("[ADD2E][ATTAQUE][THAC0][MISSING_MONSTER]", { acteur: actor.name, attendu: "system.thac0", system: sys });
    return null;
  }
  return thaco;
}

function add2eResolveTargetArmorClass({ cible, actor, arme, isTouchAttack }) {
  const sysCible = cible.system || {};
  const nomCible = cible.name;
  let caBaseCible = null;
  let caSourceCible = "";
  let caComputedDetails = null;

  if (cible.type === "personnage") {
    if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getMagicPassiveDefense === "function") {
      caComputedDetails = Add2eEffectsEngine.getMagicPassiveDefense(cible, { source: "attack-roll", attacker: actor?.name, weapon: arme?.name });
      caComputedDetails.stored = { ca: sysCible.ca, armorClass: sysCible.armorClass, ca_total: sysCible.ca_total, ca_naturel: sysCible.ca_naturel };
      caSourceCible = "effects-engine:magic-passive-defense";
      caBaseCible = caComputedDetails.caTotal;
    } else {
      caComputedDetails = add2eAttackComputeCharacterDisplayedCA(cible);
      caSourceCible = "computed-token-scene:armor+dexDefense+shield";
      caBaseCible = caComputedDetails.caTotal;
    }

    const storedNums = Object.fromEntries(Object.entries(caComputedDetails.stored).map(([k, v]) => [k, add2eReadStrictNumber(v)]));
    if (storedNums.ca_total !== null && storedNums.ca_total !== caBaseCible) {
      console.warn("[ADD2E][ATTAQUE][CA][TOKEN_STORED_CA_STALE][V25]", { cible: nomCible, attaqueContact: isTouchAttack, caUtilisee: caBaseCible, formule: caComputedDetails, valeursStockeesSurToken: caComputedDetails.stored, note: "system.ca_total du token est ignoré car il ne correspond pas à la CA affichée/calculée." });
    }
  } else {
    const acRead = add2eReadSystemNumber(
      sysCible,
      "armorClass",
      "ca_total",
      "ca",
      "ac",
      "ca_naturel",
      "defense.armorClass",
      "defense.ca",
      "combat.armorClass",
      "combat.ca"
    );
    caSourceCible = acRead.path ? `system.${acRead.path}` : "system.armorClass|ca_total|ca|ac";
    caBaseCible = acRead.value;
  }

  if (caBaseCible === null) {
    ui.notifications.error(`${nomCible} : CA absente. Corrige le JSON / les données acteur : ${caSourceCible}.`);
    console.error("[ADD2E][ATTAQUE][CA][MISSING_OR_INVALID]", { cible: nomCible, type: cible.type, attendu: caSourceCible, attaqueContact: isTouchAttack, valeurs: { ca: sysCible.ca, armorClass: sysCible.armorClass, ac: sysCible.ac, ca_total: sysCible.ca_total, ca_naturel: sysCible.ca_naturel }, system: sysCible });
    return null;
  }

  return { caBaseCible, caSourceCible, caComputedDetails };
}

function add2eResolveArmorAdjustment({ cible, arme, caBaseCible }) {
  let typeArmureCible = caBaseCible;

  if (cible.items) {
    const armurePortee = cible.items.find(i => i.type === "armure" && i.system.equipee && !i.name.toLowerCase().includes("bouclier") && !i.name.toLowerCase().includes("heaume") && !i.name.toLowerCase().includes("casque"));
    if (armurePortee && typeof armurePortee.system.ac === "number") typeArmureCible = Number(armurePortee.system.ac);
  }

  typeArmureCible = Math.max(2, Math.min(10, Math.round(Number(typeArmureCible))));

  let ajustementCA = 0;
  if (Array.isArray(arme.system.ajustement_ca)) {
    let idx = typeArmureCible - 2;
    if (idx < 0) idx = 0;
    if (idx > 8) idx = 8;
    if (idx < arme.system.ajustement_ca.length) ajustementCA = Number(arme.system.ajustement_ca[idx]) || 0;
  }

  return ajustementCA;
}

/**
 * Script principal d'attaque AD&D2e
 */
export async function add2eAttackRoll({ actor, arme, actorId, itemId }) {
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
  if (!cible) {
    console.error("[ADD2E][ATTAQUE][TARGET][NO_ACTOR]", { cibleToken, document: cibleToken?.document });
    return ui.notifications.warn("La cible sélectionnée n'a pas d'acteur utilisable.");
  }

  console.log("[ADD2E][ATTAQUE][TARGET][RESOLVED]", {
    foundry: game?.version ?? game?.release?.version,
    token: cibleToken?.name ?? cibleToken?.document?.name,
    actor: cible?.name,
    actorType: cible?.type,
    actorId: cible?.id,
    tokenActorId: cibleToken?.actor?.id ?? null,
    documentActorId: cibleToken?.document?.actor?.id ?? null,
    tokenDocumentActorId: cibleToken?.document?.actorId ?? null,
    armorValues: {
      armorClass: cible?.system?.armorClass,
      ca_total: cible?.system?.ca_total,
      ca: cible?.system?.ca,
      ac: cible?.system?.ac,
      ca_naturel: cible?.system?.ca_naturel
    }
  });

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

  return await add2eAttackOpenDialogV2({
    title: "Bonus/Malus d’attaque",
    content: dialogContent,
    width: 660,
    classes: ["add2e", "add2e-attack-dialog"],
    defaultAction: "ok",
    onOk: async (dlgHtml) => {
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

      let bonusHit = Number(arme.system.bonus_hit || 0);
      let bonusDom = Number(arme.system.bonus_dom || 0);
      if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getMagicWeaponBonus === "function") {
        bonusHit = Add2eEffectsEngine.getMagicWeaponBonus(arme, "hit");
        bonusDom = Add2eEffectsEngine.getMagicWeaponBonus(arme, "damage");
      }

      let modCaracToucher = 0;
      let modCaracDegats = 0;
      const combatProfile = add2eGetCombatStatProfile(arme);
      const modCaracToucherLabel = add2eAttackAbilityLabel(combatProfile.toucherCarac);
      if (combatProfile.toucherCarac) modCaracToucher = add2eGetAttackAbilityModifier(actor, combatProfile.toucherCarac, "toucher");
      if (combatProfile.degatsCarac) modCaracDegats = add2eGetAttackAbilityModifier(actor, combatProfile.degatsCarac, "degats");

      const { bonusToucheEffets, bonusDegatsEffets, bonusRacialVs, targetTags } = add2eAttackComputeActiveAttackModifiers({ actor, cible, combatProfile });
      if (bonusDegatsEffets !== 0) console.log("[ADD2E][ATTAQUE][BONUS DEGATS VS CIBLE]", { acteur: actor.name, cible: cible?.name, targetTags: [...targetTags], bonusDegatsEffets });

      const bonusAttaqueSournoise = useBackstab ? 4 : 0;
      const bonusPositionToucher = !useBackstab ? (Number(activePositionAttackAdjustment.hitBonus) || 0) : 0;
      const totalBonusToucher = modCaracToucher + bonusHit + malusPortee + userBonus + bonusToucheEffets + bonusRacialVs + bonusAttaqueSournoise + bonusPositionToucher;
      const totalBonusDegats = modCaracDegats + bonusDom + (Number(bonusDegatsEffets) || 0);

      const isTouchAttack = add2eTagSetHas(combatProfile.tags, "arme:toucher", "type_arme:toucher", "attaque:toucher", "attaque_speciale:toucher", "attaque_speciale:contact") || /\b(toucher|touch)\b/i.test(String(arme?.name ?? ""));
      const sysCible = cible.system || {};
      const nomCible = cible.name;
      const tailleCible = (sysCible.taille || sysCible.size || "M").toUpperCase();

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
      const valeurPourToucher = thaco - caFinaleCible - ajustementCA;
      const roll = await (new Roll("1d20")).evaluate();
      if (game.dice3d) await game.dice3d.showForRoll(roll);
      await new Promise(r => setTimeout(r, 300));

      const d20 = roll.total;
      const totalAuToucher = d20 + totalBonusToucher;
      const seuilFinalD20 = valeurPourToucher - totalBonusToucher;
      const finalResult = (d20 === 20) || (d20 !== 1 && d20 >= seuilFinalD20);

      let degats = 0;
      let degatsAvantMultiplicateur = 0;
      let formulaDegats = "1d6";
      let detailsDegats = "";
      const backstabMultiplier = useBackstab ? Math.max(1, Number(backstabInfo.multiplier) || 1) : 1;
      let assassinatResult = null;

      if (finalResult) {
        const isGrand = ["G", "L", "LARGE"].includes(tailleCible);
        let rawDmg = isGrand ? arme.system.dégâts?.contre_grand : arme.system.dégâts?.contre_moyen;
        if (!rawDmg) rawDmg = "1d6";
        formulaDegats = plageToRollFormula(rawDmg);
        if (totalBonusDegats !== 0) formulaDegats += (totalBonusDegats > 0 ? `+${totalBonusDegats}` : `${totalBonusDegats}`);
        const rDmg = await (new Roll(formulaDegats)).evaluate();
        if (game.dice3d) await game.dice3d.showForRoll(rDmg);
        await new Promise(r => setTimeout(r, 300));
        degatsAvantMultiplicateur = Math.max(1, rDmg.total);
        degats = backstabMultiplier > 1 ? Math.max(1, degatsAvantMultiplicateur * backstabMultiplier) : degatsAvantMultiplicateur;
        detailsDegats = backstabMultiplier > 1 ? `${rDmg.result} × ${backstabMultiplier}` : rDmg.result;
        if (useAssassination) assassinatResult = await add2eRollAssassinationForAttack({ actor, score: assassinationInfo.score, situational: assassinatMod });
        if (cible) await add2eApplyDamage({ cible, montant: degats, source: arme.name, lanceur: actor, silent: true });
      }

      const conditionalACLine = conditionalFixedAC?.detail
        ? `<div><b>CA conditionnelle :</b> ${add2eAttackHtmlEscape(conditionalFixedAC.detail)}</div>`
        : "";

      const chatContent = add2eBuildAttackChatCard({
        actor,
        arme,
        cible,
        nomCible,
        chatImg,
        descPortee,
        typePortee,
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
        conditionalACLine,
        valeurPourToucher,
        modCaracToucherLabel,
        modCaracToucher,
        bonusHit,
        bonusToucheEffets,
        malusPortee,
        userBonus,
        useAssassination,
        ajustementCA
      });

      await add2eRouteGmAttackChat({ actor, content: chatContent, avatar: chatImg });
      await add2eConsumeOneUseWeaponAfterAttack(actor, arme);
      console.log("[ADD2E][ATTAQUE][CA_CONDITIONNELLE]", {
        cible: cible?.name,
        arme: arme?.name,
        position: activePositionInfo?.label,
        caBaseCible,
        caSourceCible: acData.caSourceCible,
        caAvantPosition,
        caAvantConditionnelle,
        caFinaleCible,
        conditionalFixedAC
      });
      return true;
    }
  });
}

add2eRegisterGmAttackChatRelay();
globalThis.add2eAttackRoll = add2eAttackRoll;
