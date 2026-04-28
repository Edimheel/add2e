/**
 * Calcule le bonus de sauvegarde constitution pour un nain.
 * Bonus : +1 par tranche de 3.5 pts de constitution totale, max +5.
 * @param {Actor} actor
 * @returns {number}
 */
function getBonusSaveConstitution(actor) {
  let c = Number(actor.system?.constitution_base || 0) + Number(actor.system?.constitution_race || 0);
  let bonus = Math.min(5, Math.floor(c / 3.5));
  console.log(`[RESOLVE AE][BONUS NAIN] Calcul bonus constitution: ${c} => +${bonus}`);
  return bonus;
}

/**
 * Résout l'effet des ActiveEffects présents sur une cible pour un effet donné (immunités, résistances, protections, bonus nain...).
 * Usage : await resolveActiveEffectsOnTarget(actor, "sommeil")
 * @param {Actor} actor - Cible à vérifier
 * @param {string} effectType - Type d'effet à traiter ("sommeil", "charme", "missile_magique", "poison", etc.)
 * @returns {Promise<object>} - { annulé: bool, résiste: bool, details: string, pct: number, jet: number, bonus?: number }
 */
async function resolveActiveEffectsOnTarget(actor, effectType) {
  if (!actor) {
    console.warn("[RESOLVE AE] Appel sans acteur.");
    return { annulé: false, résiste: false, details: "Aucune cible", pct: 0, jet: 0 };
  }

  // 1. Récupère tous les tags add2e des effets actifs
  let tags = [];
  for (let eff of actor.effects) {
    let effTags = [];
    if (eff.flags?.add2e?.tags) {
      try {
        effTags = Array.from(eff.flags.add2e.tags);
      } catch {
        effTags = eff.flags.add2e.tags;
      }
    }
    if (effTags && typeof effTags[Symbol.iterator] === 'function') {
      tags.push(...Array.from(effTags));
    }
  }
  tags = [...new Set(tags)];
  console.log(`[RESOLVE AE] Tags actifs pour ${actor.name}:`, tags);

  // 2. Immunité totale ou protection
  if (tags.includes(`immunite:${effectType}`) || tags.includes(`protection:${effectType}`)) {
    console.log(`[RESOLVE AE] ${actor.name} immunisé ou protégé contre ${effectType}`);
    return {
      annulé: true,
      résiste: false,
      details: `Immunisé ou protégé contre ${effectType}`,
      pct: 0,
      jet: 0
    };
  }

  // 3. Résistance chiffrée (resistance:x:valeur)
  const resistTag = tags.find(t => t.startsWith(`resistance:${effectType}:`));
  if (resistTag) {
    const pct = Number(resistTag.split(":")[2]) || 0;
    const jet = Math.ceil(Math.random() * 100);
    if (jet <= pct) {
      console.log(`[RESOLVE AE] ${actor.name} résiste à ${effectType} (${pct}% réussi, jet=${jet})`);
      return {
        annulé: false,
        résiste: true,
        details: `Résistance ${pct}% réussie à ${effectType} (jet ${jet})`,
        pct, jet
      };
    } else {
      console.log(`[RESOLVE AE] ${actor.name} échoue la résistance à ${effectType} (${pct}% jet=${jet})`);
      return {
        annulé: false,
        résiste: false,
        details: `Résistance ${pct}% échouée à ${effectType} (jet ${jet})`,
        pct, jet
      };
    }
  }

  // 4. Bonus de sauvegarde racial (Nain) : sort/magie/poison
let bonusSave = 0;
let typeSauvegarde = effectType.toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/\s/g, "");

// Regroupe tous les types qui doivent être “magie”
const aliasMagie = [
  "magie", "sort", "sorts", "baguette", "baguettes", "bâton", "baton", "batons", "bâtonnet", "bâtonnets", "badine", "charme", "petrification", "petrifications", "petrify", "paralysie", "paralysisie", "paralyse", "souffle"
];

if (aliasMagie.some(type => typeSauvegarde.includes(type))) typeSauvegarde = "magie";
if (typeSauvegarde === "poison") typeSauvegarde = "poison";


  if (tags.includes(`bonus_save_vs:${typeSauvegarde}:const`)) {
    bonusSave = getBonusSaveConstitution(actor);
    console.log(`[RESOLVE AE] Bonus racial nain appliqué (${typeSauvegarde}) : +${bonusSave}`);
    return {
      annulé: false,
      résiste: false,
      details: `Bonus racial de sauvegarde (${typeSauvegarde}) +${bonusSave}`,
      pct: 0,
      jet: 0,
      bonus: bonusSave
    };
  }

  // 5. Aucun effet bloquant/résistant/bonus
  console.log(`[RESOLVE AE] Aucun effet spécial pour ${effectType} sur ${actor.name}.`);
  return {
    annulé: false,
    résiste: false,
    details: `Aucune immunité ni résistance active contre ${effectType}`,
    pct: 0,
    jet: 0
  };
}

// Ajoute à l'espace global Foundry pour usage direct (macro ou script)
window.resolveActiveEffectsOnTarget = resolveActiveEffectsOnTarget;
