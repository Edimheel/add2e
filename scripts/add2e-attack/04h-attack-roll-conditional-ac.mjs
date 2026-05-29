// scripts/add2e-attack/04h-attack-roll-conditional-ac.mjs
// ADD2E — CA conditionnelle pour les attaques.
// Version : 2026-05-29-no-generic-fixed-ac-for-melee-v1

export function add2eAttackConditionalACSubtype({ arme, combatProfile, isDistance, hasTag }) {
  const tags = combatProfile?.tags instanceof Set ? combatProfile.tags : new Set(combatProfile?.tags ?? []);
  const has = (...values) => hasTag(tags, ...values);
  const weaponName = String(arme?.name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    combatProfile?.isProjectilePropulse ||
    has("usage:projectile_propulse", "categorie:projectile_propulse", "trait:projectile_propulse", "type:projectile_propulse") ||
    /\b(arc|arbalete|fronde|fleche|flechette|carreau|trait)\b/.test(weaponName)
  ) {
    return { sousType: "projectile_propulse", label: "projectile propulsé", conditional: true };
  }

  if (
    combatProfile?.isLancer ||
    has("usage:lancer", "usage:jet", "usage:arme_de_jet", "categorie:projectile_lance", "trait:arme_de_jet", "type:arme_de_jet") ||
    /\b(javelot|hachette|dague|couteau|pierre|lance)\b/.test(weaponName)
  ) {
    return { sousType: "projectile_lance", label: "projectile lancé à la main", conditional: true };
  }

  if (isDistance) return { sousType: "projectile_propulse", label: "projectile", conditional: true };
  return { sousType: "autres", label: "attaque de mêlée", conditional: false };
}

function add2eAttackIsExplicitConditionalFixedAC(info, sousType) {
  const tag = String(info?.sourceTag ?? "").toLowerCase();
  if (!tag) return false;

  if (sousType === "projectile_lance") return tag.startsWith("ca_fixe_projectile_lance:") || tag.startsWith("ca_fixe_conditionnelle:projectile_lance:");
  if (sousType === "projectile_propulse") return tag.startsWith("ca_fixe_projectile_propulse:") || tag.startsWith("ca_fixe_conditionnelle:projectile_propulse:");

  return tag.startsWith(`ca_fixe_conditionnelle:${sousType}:`);
}

export function add2eAttackResolveConditionalFixedAC({ cible, arme, combatProfile, isDistance, positionInfo, caBefore, hasTag }) {
  const normalCA = Number(caBefore);
  const attackSubtype = add2eAttackConditionalACSubtype({ arme, combatProfile, isDistance, hasTag });
  const context = {
    type: "attaque",
    sousType: attackSubtype.sousType,
    frontale: !!positionInfo?.isFront,
    arme: arme?.name ?? "",
    source: "attack-roll"
  };

  if (!attackSubtype.conditional) {
    return {
      applied: false,
      ca: caBefore,
      normalCA,
      fixedCA: null,
      attackSubtype,
      context,
      details: null,
      detail: ""
    };
  }

  let fixedInfo = null;
  let fixedCA = null;

  try {
    if (typeof Add2eEffectsEngine !== "undefined") {
      if (typeof Add2eEffectsEngine.getConditionalFixedCA === "function") {
        fixedInfo = Add2eEffectsEngine.getConditionalFixedCA(cible, context);
        fixedCA = Number(fixedInfo?.ca);
      } else if (typeof Add2eEffectsEngine.analyze === "function") {
        const analyzed = Add2eEffectsEngine.analyze(cible, context);
        fixedInfo = analyzed?.ca_fixe_details ?? analyzed ?? null;
        fixedCA = Number(analyzed?.ca_fixe);
      }
    }
  } catch (err) {
    console.warn("[ADD2E][ATTAQUE][CA_CONDITIONNELLE][ERROR]", err);
  }

  if (!Number.isFinite(fixedCA) || !add2eAttackIsExplicitConditionalFixedAC(fixedInfo, attackSubtype.sousType)) {
    return {
      applied: false,
      ca: caBefore,
      normalCA,
      fixedCA: Number.isFinite(fixedCA) ? fixedCA : null,
      attackSubtype,
      context,
      details: fixedInfo,
      detail: ""
    };
  }

  const finalCA = Number.isFinite(normalCA) ? Math.min(normalCA, fixedCA) : fixedCA;
  const applied = finalCA !== normalCA;

  return {
    applied,
    ca: finalCA,
    normalCA,
    fixedCA,
    attackSubtype,
    context,
    details: fixedInfo,
    detail: applied
      ? `CA ${normalCA} → ${finalCA} contre ${attackSubtype.label}`
      : `CA fixe ${fixedCA} non appliquée : la CA normale ${normalCA} reste meilleure`
  };
}
