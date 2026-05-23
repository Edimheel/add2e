// scripts/add2e-attack/04-attack-roll.mjs
// ADD2E — Résolution des attaques.

import { plageToRollFormula } from "./01-core-helpers.mjs";
import { add2eApplyDamage } from "./02-damage.mjs";
import {
  add2eNormalizeAttackTag,
  add2eMeasureTokenGridDistance,
  add2eGetCombatStatProfile,
  add2eGetBackstabInfo,
  add2eGetAssassinationInfo,
  add2eGetBackArcInfo,
  add2eBuildManualPositionInfo,
  add2eBuildPositionAttackAdjustment,
  add2eAttackIsThiefLikeClass,
  add2eGetActorClassSystemForAttack,
  add2eResolveSelectedPositionInfo,
  add2eTagSetHas,
  add2eTagSetMatches,
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

function add2eAttackFormAdapter(form) {
  return {
    find(selector) {
      const el = form?.querySelector?.(selector) ?? null;
      return {
        val: () => el?.value ?? "",
        is: (expr) => expr === ":checked" ? !!el?.checked : !!el?.matches?.(expr)
      };
    }
  };
}

async function add2eAttackOpenDialogV2({ title, content, width, classes, defaultAction, onOk }) {
  const DialogV2 = foundry.applications?.api?.DialogV2;

  if (DialogV2?.wait) {
    return await DialogV2.wait({
      window: { title, classes: classes ?? [] },
      position: { width: width ?? 660 },
      content,
      buttons: [
        {
          action: "ok",
          label: "Lancer l'attaque",
          default: defaultAction === "ok",
          callback: async (event, button, dialog) => {
            const form = button?.form ?? dialog?.element?.querySelector?.("form") ?? document.querySelector("form.add2e-attack-form");
            return await onOk(add2eAttackFormAdapter(form));
          }
        },
        {
          action: "cancel",
          label: "Annuler",
          callback: () => false
        }
      ],
      default: defaultAction ?? "ok",
      rejectClose: false
    });
  }

  return await new Promise((resolve) => {
    new Dialog({
      title,
      content,
      buttons: {
        ok: {
          label: "Lancer l'attaque",
          callback: async (dlgHtml) => resolve(await onOk(dlgHtml))
        },
        cancel: { label: "Annuler", callback: () => resolve(false) }
      },
      default: defaultAction ?? "ok"
    }, {
      width: width ?? 660,
      classes: classes ?? []
    }).render(true);
  });
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

  const srcToken = actor?.token?.object ?? actor.getActiveTokens()[0];
  const chatImg = srcToken?.document.texture.src || actor.img;

  const cibleToken = Array.from(game.user.targets)[0];
  const cible = cibleToken ? cibleToken.actor : null;
  if (!cibleToken) return ui.notifications.warn("Aucune cible sélectionnée !");

const isDistanceWeapon = (arme.system.portee_courte ?? 0) > 0;

let distanceCible = 0;
let auContact = false;

try {
  if (srcToken && cibleToken) {
    distanceCible = add2eMeasureTokenGridDistance(srcToken, cibleToken, { gridSpaces: true });
    const gridSize = canvas.grid.size;
    const sLeft = srcToken.document.x / gridSize;
    const sTop = srcToken.document.y / gridSize;
    const sRight = sLeft + (srcToken.document.width || 1);
    const sBottom = sTop + (srcToken.document.height || 1);
    const tLeft = cibleToken.document.x / gridSize;
    const tTop = cibleToken.document.y / gridSize;
    const tRight = tLeft + (cibleToken.document.width || 1);
    const tBottom = tTop + (cibleToken.document.height || 1);
    const gapX = Math.max(0, tLeft - sRight, sLeft - tRight);
    const gapY = Math.max(0, tTop - sBottom, sTop - tBottom);
    auContact = gapX <= 0.01 && gapY <= 0.01;
  }
} catch (e) {
  console.warn("ADD2E | Erreur mesure distance/contact :", e);
  distanceCible = 0;
  auContact = false;
}

if (!isDistanceWeapon && !auContact) {
  ui.notifications.error("Cible trop éloignée pour une arme de contact.");
  return;
}

if (isDistanceWeapon) {
  const porteeLongue = Number(arme.system.portee_longue) || 0;
  if (porteeLongue > 0 && distanceCible > porteeLongue) {
    ui.notifications.error("Cible hors de portée.");
    return;
  }
}

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

  const attackDistanceLabel = auContact
    ? "Contact"
    : (isDistanceWeapon ? `${Number(distanceCible || 0).toFixed(1)} cases` : "Hors contact");

  const specialOptionsVisible = canUseBackstab || canUseAssassination || backstabInfo.available || assassinationInfo.available;

  const dialogContent = `
        <style>
          .add2e-attack-form { --a2e-gold: #b88924; --a2e-dark: #5d3d0d; --a2e-line: #d9bf73; --a2e-bg: #fff8df; display: grid; gap: 8px; color: #2f250c; }
          .add2e-attack-top { display: grid; grid-template-columns: 1fr 36px 1fr; gap: 8px; align-items: center; }
          .add2e-attack-box { border: 1px solid var(--a2e-line); border-radius: 9px; background: #fffdf4; padding: 8px 10px; }
          .add2e-attack-label { font-size: .76rem; font-weight: 900; text-transform: uppercase; color: var(--a2e-dark); }
          .add2e-attack-name { font-size: 1.05rem; font-weight: 900; margin-top: 2px; }
          .add2e-attack-pill { display: inline-flex; margin-top: 5px; padding: 2px 7px; border: 1px solid #d4af55; border-radius: 999px; background: #fff3c7; font-weight: 800; color: var(--a2e-dark); }
          .add2e-attack-arrow { text-align: center; font-size: 1.7rem; color: var(--a2e-dark); }
          .add2e-attack-line { display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid var(--a2e-line); border-radius: 9px; background: #fffdf4; padding: 8px 10px; }
          .add2e-attack-line label, .add2e-check-title { font-weight: 900; color: #3b2a0f; }
          .add2e-attack-line input[type="number"] { width: 74px; border: 1px solid var(--a2e-line); border-radius: 7px; background: #fffaf0; padding: 5px 7px; font-weight: 900; text-align: center; }
          .add2e-special-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .add2e-check { display: grid; grid-template-columns: 24px 1fr; gap: 8px; align-items: center; border: 1px solid var(--a2e-line); border-radius: 9px; background: #fff8e8; padding: 9px 10px; }
          .add2e-check input[type="checkbox"] { width: 18px; height: 18px; }
          .add2e-check-meta { margin-top: 2px; font-size: .86rem; color: #6b5a2a; font-weight: 800; }
        </style>

        <form class="add2e-attack-form">
          <div class="add2e-attack-top">
            <div class="add2e-attack-box">
              <div class="add2e-attack-label">Attaquant</div>
              <div class="add2e-attack-name">${actor.name}</div>
              <span class="add2e-attack-pill">${arme.name}</span>
            </div>
            <div class="add2e-attack-arrow">→</div>
            <div class="add2e-attack-box">
              <div class="add2e-attack-label">Cible</div>
              <div class="add2e-attack-name">${cible?.name ?? "Cible"}</div>
              <span class="add2e-attack-pill">${attackDistanceLabel}</span>
              <span class="add2e-attack-pill">Position : Face</span>
              <span class="add2e-attack-pill" title="Diagnostic uniquement">Auto : ${backArcInfo.label}</span>
            </div>
          </div>

          <div class="add2e-attack-line">
            <label for="add2e-bonus-attaque">Modificateur au toucher</label>
            <input id="add2e-bonus-attaque" type="number" value="0" step="1">
          </div>

          <div class="add2e-attack-line">
            <label for="add2e-position-zone">Position réelle</label>
            <select id="add2e-position-zone" style="width:160px;border:1px solid var(--a2e-line);border-radius:7px;background:#fffaf0;padding:5px 7px;font-weight:900;">
              <option value="front" selected>Face</option>
              <option value="flank">Flanc</option>
              <option value="rear-flank">Flanc arrière</option>
              <option value="rear">Dos</option>
              <option value="auto">Auto détecté (${backArcInfo.label})</option>
            </select>
          </div>

          <div style="margin:-4px 0 6px 0;font-size:.78rem;color:#6b5a2a;font-weight:800;line-height:1.25;">
            La position automatique est un diagnostic. Par défaut la résolution applique Face pour éviter les faux dos liés à la rotation des images de token.
          </div>

          ${positionAttackAdjustment.details.length ? `
          <div class="add2e-attack-line" style="font-weight:800;color:#5d3d0d;align-items:flex-start;">
            <span>Position</span>
            <span style="text-align:right;">${positionAttackAdjustment.details.join("<br>")}</span>
          </div>
          ` : ""}

          ${specialOptionsVisible ? `
          <div class="add2e-special-grid">
            ${canUseBackstab ? `
            <label class="add2e-check">
              <input type="checkbox" id="add2e-backstab">
              <span><span class="add2e-check-title">Attaque sournoise</span><span class="add2e-check-meta">+4 toucher · dégâts ×${backstabInfo.multiplier}</span></span>
            </label>` : ""}
            ${canUseAssassination ? `
            <label class="add2e-check">
              <input type="checkbox" id="add2e-assassinat-confirm">
              <span><span class="add2e-check-title">Assassinat</span><span class="add2e-check-meta">${assassinationInfo.score}% si l’attaque touche</span></span>
            </label>` : ""}
          </div>
          ${canUseAssassination ? `<div class="add2e-attack-line"><label for="add2e-assassinat-mod">Modificateur assassinat</label><input id="add2e-assassinat-mod" type="number" value="0" step="1"></div>` : ""}
          ` : ""}
        </form>
      `;

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
            const categorieArme = arme.system.categorie || "melee";

            let dist = 0, malusPortee = 0, descPortee = "", typePortee = "Contact";
            const isDistance = (arme.system.portee_courte ?? 0) > 0;

            if (isDistance) {
              const pC = Number(arme.system.portee_courte) || 0;
              const pM = Number(arme.system.portee_moyenne) || 0;
              const pL = Number(arme.system.portee_longue) || 0;
              if (srcToken && cibleToken) {
                try { dist = add2eMeasureTokenGridDistance(srcToken, cibleToken, { gridSpaces: true }); } catch (e) { dist = 0; }
              }
              if (auContact) { descPortee = "Contact"; typePortee = "Contact"; }
              else if (dist <= pC) { descPortee = "Courte"; typePortee = "Courte"; }
              else if (dist <= pM) { descPortee = "Moyenne"; typePortee = "Moyenne"; malusPortee = -2; }
              else if (dist <= pL) { descPortee = "Longue"; typePortee = "Longue"; malusPortee = -5; }
              else { descPortee = "Hors de portée"; typePortee = "Loin"; }
            } else {
              dist = 1;
              descPortee = "Contact";
              typePortee = "Contact";
            }

            const sys = actor.system || {};
            let thaco = null;
            if (actor.type === "personnage") {
              const classeItem = actor.items?.find(i => i.type === "classe");
              const niv = Number(sys.niveau) || 1;
              const prog = Array.isArray(classeItem?.system?.progression) ? classeItem.system.progression[niv - 1] : null;
              if (prog && prog.thac0 !== undefined && prog.thac0 !== null && prog.thac0 !== "") {
                thaco = add2eReadStrictNumber(prog.thac0);
                if (thaco === null) {
                  ui.notifications.error(`${actor.name} : progression de classe invalide, thac0 non numérique au niveau ${niv}.`);
                  console.error("[ADD2E][ATTAQUE][THAC0][INVALID_CLASS_PROGRESSION]", { acteur: actor.name, classe: classeItem?.name, niveau: niv, valeur: prog.thac0, progression: prog });
                  return false;
                }
              } else {
                thaco = add2eReadStrictNumber(sys.thac0);
                if (thaco === null) {
                  ui.notifications.error(`${actor.name} : THAC0 absent. Corrige system.thac0 ou la progression de classe.`);
                  console.error("[ADD2E][ATTAQUE][THAC0][MISSING_PERSONNAGE]", { acteur: actor.name, attendu: "system.thac0 ou item classe system.progression[niveau-1].thac0", system: sys, classe: classeItem?.name, classeSystem: classeItem?.system });
                  return false;
                }
              }
            } else {
              thaco = add2eReadStrictNumber(sys.thac0);
              if (thaco === null) {
                ui.notifications.error(`${actor.name} : THAC0 monstre absent. Corrige le JSON du monstre : system.thac0.`);
                console.error("[ADD2E][ATTAQUE][THAC0][MISSING_MONSTER]", { acteur: actor.name, attendu: "system.thac0", system: sys });
                return false;
              }
            }

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

            let { bonusToucheEffets, bonusDegatsEffets, bonusRacialVs, targetTags } = add2eAttackComputeActiveAttackModifiers({ actor, cible, combatProfile });
            if (bonusDegatsEffets !== 0) console.log("[ADD2E][ATTAQUE][BONUS DEGATS VS CIBLE]", { acteur: actor.name, cible: cible?.name, targetTags: [...targetTags], bonusDegatsEffets });

let bonusDetails = [];
if (modCaracToucher !== 0) bonusDetails.push({ label: "Caractéristique", value: modCaracToucher });
if (bonusHit !== 0) bonusDetails.push({ label: "Arme", value: bonusHit });
if (malusPortee !== 0) bonusDetails.push({ label: "Portée", value: malusPortee });
if (userBonus !== 0) bonusDetails.push({ label: "Bonus temporaire", value: userBonus });
if (bonusToucheEffets !== 0) bonusDetails.push({ label: "Effets actifs", value: bonusToucheEffets });
if (bonusRacialVs !== 0) bonusDetails.push({ label: "Bonus racial / ennemi", value: bonusRacialVs });
if (bonusDegatsEffets !== 0) bonusDetails.push({ label: "Bonus dégâts vs cible", value: bonusDegatsEffets });
const bonusAttaqueSournoise = useBackstab ? 4 : 0;
if (bonusAttaqueSournoise !== 0) bonusDetails.push({ label: "Attaque sournoise", value: bonusAttaqueSournoise });
const bonusPositionToucher = !useBackstab ? (Number(activePositionAttackAdjustment.hitBonus) || 0) : 0;
if (bonusPositionToucher !== 0) bonusDetails.push({ label: "Position", value: bonusPositionToucher });
let totalBonusToucher = modCaracToucher + bonusHit + malusPortee + userBonus + bonusToucheEffets + bonusRacialVs + bonusAttaqueSournoise + bonusPositionToucher;
let totalBonusDegats = modCaracDegats + bonusDom + (Number(bonusDegatsEffets) || 0);

            const isTouchAttack = add2eTagSetHas(combatProfile.tags, "arme:toucher", "type_arme:toucher", "attaque:toucher", "attaque_speciale:toucher", "attaque_speciale:contact") || /\b(toucher|touch)\b/i.test(String(arme?.name ?? ""));
            let sysCible = cible.system || {};
            let nomCible = cible.name;
            let tailleCible = (sysCible.taille || sysCible.size || "M").toUpperCase();
            let caBaseCible = null;
            let caFinaleCible = null;
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
              caSourceCible = "system.armorClass";
              caBaseCible = add2eReadStrictNumber(sysCible.armorClass);
            }

            if (caBaseCible === null) {
              ui.notifications.error(`${nomCible} : CA absente. Corrige le JSON / les données acteur : ${caSourceCible}.`);
              console.error("[ADD2E][ATTAQUE][CA][MISSING_OR_INVALID]", { cible: nomCible, type: cible.type, attendu: caSourceCible, attaqueContact: isTouchAttack, valeurs: { ca: sysCible.ca, armorClass: sysCible.armorClass, ca_total: sysCible.ca_total, ca_naturel: sysCible.ca_naturel }, system: sysCible });
              return false;
            }

            caFinaleCible = caBaseCible;
            const caAvantPosition = caFinaleCible;
            if (activePositionAttackAdjustment.caAdjustment !== 0) caFinaleCible += activePositionAttackAdjustment.caAdjustment;

            let typeArmureCible = caBaseCible;
            if (cible.items) {
              const armurePortee = cible.items.find(i => i.type === "armure" && i.system.equipee && !i.name.toLowerCase().includes("bouclier") && !i.name.toLowerCase().includes("heaume") && !i.name.toLowerCase().includes("casque"));
              if (armurePortee && typeof armurePortee.system.ac === "number") typeArmureCible = Number(armurePortee.system.ac);
            }
            typeArmureCible = Math.max(2, Math.min(10, Math.round(Number(typeArmureCible))));

            let ajustementCA = 0;
            if (Array.isArray(arme.system.ajustement_ca)) {
              let idx = typeArmureCible - 2;
              if (idx < 0) idx = 0; if (idx > 8) idx = 8;
              if (idx < arme.system.ajustement_ca.length) ajustementCA = Number(arme.system.ajustement_ca[idx]) || 0;
            }

            let valeurPourToucher = thaco - caFinaleCible - ajustementCA;
            const roll = await (new Roll("1d20")).evaluate();
            if (game.dice3d) await game.dice3d.showForRoll(roll);
            await new Promise(r => setTimeout(r, 300));

            const d20 = roll.total;
            const totalAuToucher = d20 + totalBonusToucher;
            const seuilFinalD20 = valeurPourToucher - totalBonusToucher;
            const estTouche = (d20 === 20) || (d20 !== 1 && d20 >= seuilFinalD20);
            const finalResult = estTouche;

            let degats = 0;
            let degatsAvantMultiplicateur = 0;
            let formulaDegats = "1d6";
            let detailsDegats = "";
            let typeDegats = arme.system.type_degats || "contondant";
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

            const colorResult = finalResult ? "#2ecc71" : "#e74c3c";
            const textResult = finalResult ? "TOUCHÉ !" : "Raté.";
            const iconResult = finalResult ? "fa-check" : "fa-times";
            const signeBonus = totalBonusToucher >= 0 ? "+" : "";
            const calculSimple = `<b>${d20}</b> <span style="color:#888;font-size:0.8em;">(d20)</span> ${signeBonus} ${totalBonusToucher} = <b style="font-size:1.1em;">${totalAuToucher}</b>`;

            let chatContent = `<div class="add2e-chat-card" style="font-family:var(--font-primary); background:#fff; border:1px solid #aaa; border-radius:5px; padding:5px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><div style="text-align:center;"><img src="${actor.img || 'icons/svg/mystery-man.svg'}" style="width:48px;height:48px;border-radius:5px;border:1px solid #333;"><div style="font-weight:bold; font-size:0.9em; margin-top:2px;">${actor.name}</div><div style="font-size:0.8em; color:#666;">${arme.name}</div></div><div style="font-size:2em; color:#aaa;">&rarr;</div><div style="text-align:center;"><img src="${cible.img || 'icons/svg/mystery-man.svg'}" style="width:48px;height:48px;border-radius:5px;border:1px solid #333;"><div style="font-weight:bold; font-size:0.9em; margin-top:2px;">${nomCible}</div></div></div><div style="text-align:center; font-size:1em; margin-bottom:10px;">${actor.name} tente de frapper <b>${nomCible}</b> avec sa <b>${arme.name}</b> !</div><div style="text-align:center; color:#666; font-size:0.9em; margin-bottom:5px;">Portée: <b>${descPortee}</b> — ${typePortee}</div><div style="background:#f1f5f9; padding:8px; border-radius:5px; text-align:center; margin-bottom:10px; font-size:1.1em;"><i class="fas fa-dice-d20"></i> ${calculSimple}</div><div style="text-align:center; margin-bottom:10px;">Seuil à atteindre au d20 : <span style="font-weight:bold; color:#d35400;">${seuilFinalD20}</span></div><div style="text-align:center; margin-bottom:10px; font-size:1.4em; font-weight:bold; color:${colorResult};"><i class="fas ${iconResult}"></i> ${textResult}</div>${finalResult ? `<div style="text-align:center; border-top:1px dashed #ccc; padding-top:5px; margin-bottom:10px;"><span style="font-size:1.2em;">Dégâts : <b>${degats}</b></span><div style="font-size:0.8em; color:#7f8c8d;">(${formulaDegats} -> ${detailsDegats})</div>${useBackstab ? `<div style="font-size:0.9em;color:#7a4b00;font-weight:700;margin-top:0.25em;">Attaque sournoise : dégâts ×${backstabMultiplier}</div>` : ""}${activePositionAttackAdjustment.details.length ? `<div style="font-size:0.82em;color:#6b5a2a;font-weight:700;margin-top:0.25em;">Position : ${activePositionAttackAdjustment.details.join(" · ")}</div>` : ""}</div>` : ''}${assassinatResult ? `<div style="border:1px solid ${assassinatResult.success ? "#1f8f4d" : "#b3261e"}; background:${assassinatResult.success ? "#eefaf2" : "#fff1f0"}; border-radius:6px; padding:7px; margin-bottom:10px; text-align:center;"><div style="font-weight:900;color:${assassinatResult.success ? "#1f8f4d" : "#b3261e"};">Assassinat ${assassinatResult.success ? "réussi" : "échoué"}</div><div style="font-size:0.92em;">Jet : <b>${assassinatResult.total}</b> / Score : <b>${assassinatResult.finalScore}%</b></div><div style="font-size:0.82em;color:#666;">${assassinationInfo.breakdownTitle}${assassinatResult.situational ? ` | Situation ${assassinatResult.situational >= 0 ? "+" : ""}${assassinatResult.situational}%` : ""}</div></div>` : ""}<details style="margin-top:8px; font-size:1.05em; color:#333;"><summary style="cursor:pointer; font-weight:bold; font-size:1.1em;">Détails simples du jet</summary><div style="margin-top:8px; line-height:1.55; background:#f8fafc; border:1px solid #d0d7de; border-radius:6px; padding:8px;"><div><b>Base THAC0 :</b> ${thaco}</div><div><b>Classe d’armure cible :</b> ${caFinaleCible}${activePositionAttackAdjustment.caAdjustment ? ` <span style="color:#7a4b00;">(position : ${caAvantPosition} → ${caFinaleCible})</span>` : ""}</div>${activePositionAttackAdjustment.details.length ? `<div><b>Position :</b> ${activePositionAttackAdjustment.details.join(" ; ")}</div>` : ""}<div><b>Seuil sans modificateur :</b> ${valeurPourToucher}</div><hr style="margin:6px 0;"><div><b>Modificateur ${modCaracToucherLabel} :</b> ${modCaracToucher >= 0 ? "+" : ""}${modCaracToucher}</div><div><b>Modificateur magique arme :</b> ${bonusHit >= 0 ? "+" : ""}${bonusHit}</div><div><b>Modificateur effets actifs :</b> ${bonusToucheEffets >= 0 ? "+" : ""}${bonusToucheEffets}</div><div><b>Modificateur portée :</b> ${malusPortee >= 0 ? "+" : ""}${malusPortee} (${descPortee})</div><div><b>Modificateur temporaire :</b> ${userBonus >= 0 ? "+" : ""}${userBonus}</div>${useBackstab ? `<div><b>Attaque sournoise :</b> +4 toucher, dégâts ×${backstabMultiplier}</div>` : ""}${useAssassination ? `<div><b>Assassinat :</b> ${assassinationInfo.score}%${assassinatMod ? ` (${assassinatMod >= 0 ? "+" : ""}${assassinatMod} situation)` : ""}</div>` : ""}<div><b>Modificateur armure / arme :</b> ${ajustementCA >= 0 ? "+" : ""}${ajustementCA}</div><hr style="margin:6px 0;"><div style="font-size:1.15em;"><b>Total modificateur :</b><span style="font-weight:bold; color:#2563eb;"> ${totalBonusToucher >= 0 ? "+" : ""}${totalBonusToucher}</span></div><div style="font-size:1.15em;"><b>Seuil final au d20 :</b><span style="font-weight:bold; color:#15803d;"> ${seuilFinalD20}</span></div></div></details></div>`;

            await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: chatContent, avatar: chatImg });
            await add2eConsumeOneUseWeaponAfterAttack(actor, arme);
            return true;
          }
    });
}

globalThis.add2eAttackRoll = add2eAttackRoll;
