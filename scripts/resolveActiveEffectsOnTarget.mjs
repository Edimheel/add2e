/**
 * Résout les effets actifs et raciaux présents sur une cible.
 * Compatible avec Add2eEffectsEngine :
 * - ActiveEffects
 * - tags des objets équipés
 * - tags des races/classes
 * - tags raciaux déduits de system.race
 *
 * Usage : await resolveActiveEffectsOnTarget(actor, "sommeil")
 * Retour : { annulé, résiste, details, pct, jet, bonus }
 */

function add2eNormalizeEffectType(effectType) {
  const raw = String(effectType ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, "_")
    .trim();

  if (["charme", "charm", "sommeil", "sleep"].includes(raw)) {
    return "charme_sommeil";
  }

  const aliasMagie = [
    "magie",
    "magic",
    "sort",
    "sorts",
    "baguette",
    "baguettes",
    "badine",
    "baton",
    "batons",
    "batonnet",
    "batonnets",
    "paralysie",
    "paralyse",
    "petrification",
    "petrifications",
    "petrify",
    "souffle"
  ];

  if (aliasMagie.some(type => raw.includes(type))) return "magie";
  if (raw.includes("poison")) return "poison";

  return raw;
}

function add2eGetActiveTagsForResolve(actor) {
  if (globalThis.Add2eEffectsEngine?.getActiveTags) {
    return globalThis.Add2eEffectsEngine.getActiveTags(actor);
  }

  const tags = [];

  if (actor?.effects) {
    for (const eff of actor.effects) {
      if (eff.disabled) continue;
      const effTags = eff.flags?.add2e?.tags || [];
      if (Array.isArray(effTags)) tags.push(...effTags);
    }
  }

  return [...new Set(tags.map(t => String(t).toLowerCase()))];
}

function add2eGetBonusSaveConstitutionForResolve(actor, effectType) {
  if (globalThis.Add2eEffectsEngine?.getBonusSaveConstitution) {
    return globalThis.Add2eEffectsEngine.getBonusSaveConstitution(actor, effectType);
  }

  const sys = actor?.system || {};

  const c =
    Number(sys.constitution || 0) ||
    (
      Number(sys.constitution_base || 0) +
      Number(sys.constitution_race || sys.bonus_caracteristiques?.constitution || 0)
    );

  return Math.max(0, Math.min(5, Math.floor(c / 3.5)));
}

async function resolveActiveEffectsOnTarget(actor, effectType) {
  if (!actor) {
    console.warn("[RESOLVE AE] Appel sans acteur.");
    return {
      annulé: false,
      résiste: false,
      details: "Aucune cible",
      pct: 0,
      jet: 0,
      bonus: 0
    };
  }

  const tags = add2eGetActiveTagsForResolve(actor);

  const effectNorm = String(effectType ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, "_")
    .trim();

  const typeSauvegarde = add2eNormalizeEffectType(effectType);

  console.log(`[RESOLVE AE] Tags actifs pour ${actor.name}:`, tags);
  console.log(`[RESOLVE AE] Effet demandé: ${effectType} -> ${typeSauvegarde}`);

  // 1. Immunité totale ou protection.
  const immuneKeys = new Set([effectNorm, typeSauvegarde]);

  for (const key of immuneKeys) {
    if (tags.includes(`immunite:${key}`) || tags.includes(`protection:${key}`)) {
      console.log(`[RESOLVE AE] ${actor.name} immunisé/protégé contre ${effectType}`);

      return {
        annulé: true,
        résiste: false,
        details: `Immunisé ou protégé contre ${effectType}`,
        pct: 0,
        jet: 0,
        bonus: 0
      };
    }
  }

  // 2. Résistance chiffrée resistance:type:valeur.
  let resistTag = null;

  for (const key of immuneKeys) {
    resistTag = tags.find(t => t.startsWith(`resistance:${key}:`));
    if (resistTag) break;
  }

  if (resistTag) {
    let pct = Number(resistTag.split(":")[2]) || 0;

    if (pct >= 0 && pct <= 1) pct *= 100;
    pct = Math.max(0, Math.min(100, pct));

    const jet = Math.ceil(Math.random() * 100);
    const reussite = jet <= pct;

    const result = {
      annulé: false,
      résiste: reussite,
      details: `Résistance ${pct}% ${reussite ? "réussie" : "échouée"} à ${effectType} (jet ${jet})`,
      pct,
      jet,
      bonus: 0
    };

    globalThis.add2eLastResistanceRoll = {
      found: true,
      resiste: reussite,
      type: effectNorm,
      matchedType: typeSauvegarde,
      tag: resistTag,
      pct,
      jet,
      details: result.details
    };

    console.log(
      `[RESOLVE AE] ${actor.name} ${reussite ? "résiste" : "échoue la résistance"} à ${effectType} (${pct}%, jet=${jet})`,
      result
    );

    try {
      const color = reussite ? "#1f8f3a" : "#b42318";
      const label = reussite ? "RÉSISTANCE RÉUSSIE" : "RÉSISTANCE ÉCHOUÉE";

      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `
          <div class="add2e-chat-card" style="border:1px solid #999; border-radius:6px; padding:8px; background:#fff;">
            <h3 style="margin:0 0 6px 0; color:#333;">Résistance raciale / magique</h3>
            <p style="margin:3px 0;"><b>${actor.name}</b> teste une résistance contre <b>${effectType}</b>.</p>
            <p style="margin:3px 0;"><b>Tag utilisé :</b> ${resistTag}</p>
            <p style="margin:3px 0;"><b>Chance :</b> ${pct}%</p>
            <p style="margin:3px 0;"><b>Jet d100 :</b> ${jet}</p>
            <p style="margin:6px 0 0 0; font-weight:bold; color:${color};">${label}</p>
          </div>
        `
      });
    } catch (e) {
      console.warn("[RESOLVE AE] Impossible de créer le message chat de résistance.", e);
    }

    return result;
  }

  // 3. Bonus de sauvegarde racial ou magique basé sur la Constitution.
  const bonusSave = add2eGetBonusSaveConstitutionForResolve(actor, effectType);

  if (bonusSave) {
    console.log(`[RESOLVE AE] Bonus de sauvegarde constitution appliqué (${typeSauvegarde}) : +${bonusSave}`);

    return {
      annulé: false,
      résiste: false,
      details: `Bonus de sauvegarde (${typeSauvegarde}) +${bonusSave}`,
      pct: 0,
      jet: 0,
      bonus: bonusSave
    };
  }

  // 4. Autres bonus numériques éventuels.
  let bonusNumerique = 0;

  if (globalThis.Add2eEffectsEngine?.getSaveBonusVs) {
    bonusNumerique += Number(globalThis.Add2eEffectsEngine.getSaveBonusVs(actor, effectType) || 0);
  }

  if (bonusNumerique) {
    return {
      annulé: false,
      résiste: false,
      details: `Bonus de sauvegarde (${typeSauvegarde}) ${bonusNumerique >= 0 ? "+" : ""}${bonusNumerique}`,
      pct: 0,
      jet: 0,
      bonus: bonusNumerique
    };
  }

  console.log(`[RESOLVE AE] Aucun effet spécial pour ${effectType} sur ${actor.name}.`);

  return {
    annulé: false,
    résiste: false,
    details: `Aucune immunité ni résistance active contre ${effectType}`,
    pct: 0,
    jet: 0,
    bonus: 0
  };
}

window.resolveActiveEffectsOnTarget = resolveActiveEffectsOnTarget;
globalThis.resolveActiveEffectsOnTarget = resolveActiveEffectsOnTarget;