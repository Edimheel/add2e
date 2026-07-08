// scripts/add2e-attack/04h-attack-roll-conditional-ac.mjs
// ADD2E — CA conditionnelle pour les attaques.
// Version : 2026-07-08-transformation-ac-v2

function add2eAttackNormalizeConditionalACText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:_-]+/g, "_")
    .replace(/^_|_$/g, "");
}

function add2eAttackArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eAttackArray);
  if (value instanceof Set) return [...value];
  if (typeof value?.values === "function") return [...value.values()];
  if (typeof value === "object") return Object.values(value);
  return [value];
}

function add2eAttackReadNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || String(value).trim?.() === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function add2eAttackEffectOriginItem(actor, effect) {
  const flags = effect?.flags?.add2e ?? {};
  const directId = flags.sourceItemId ?? flags.itemId ?? flags.originItemId ?? flags.sourceSpellId ?? flags.spellId ?? null;
  if (directId && actor?.items?.get?.(directId)) return actor.items.get(directId);

  const origin = String(effect?.origin ?? "");
  const itemId = origin.match(/\.Item\.([A-Za-z0-9]{16})/)?.[1] ?? origin.match(/Item\.([A-Za-z0-9]{16})/)?.[1] ?? null;
  return itemId && actor?.items?.get?.(itemId) ? actor.items.get(itemId) : null;
}

function add2eAttackEffectList(actor) {
  return [
    ...add2eAttackArray(actor?.effects),
    ...add2eAttackArray(actor?.appliedEffects),
    ...add2eAttackArray(actor?.temporaryEffects)
  ].filter(effect => effect && effect.disabled !== true);
}

function add2eAttackCollectEffectTags(effect) {
  const flags = effect?.flags?.add2e ?? {};
  const raw = [
    effect?.name,
    effect?.label,
    flags.name,
    flags.label,
    flags.sourceName,
    flags.sourceSpellName,
    flags.spellName,
    flags.type,
    flags.category,
    flags.sourceType,
    flags.tags,
    flags.effectTags
  ];

  if (typeof effect?.getFlag === "function") {
    try { raw.push(effect.getFlag("add2e", "tags")); } catch (_e) {}
    try { raw.push(effect.getFlag("add2e", "effectTags")); } catch (_e) {}
    try { raw.push(effect.getFlag("add2e", "sourceSpellName")); } catch (_e) {}
    try { raw.push(effect.getFlag("add2e", "spellName")); } catch (_e) {}
  }

  return raw.flatMap(add2eAttackArray).map(add2eAttackNormalizeConditionalACText).filter(Boolean);
}

function add2eAttackIsShieldSpellText(value) {
  const text = add2eAttackNormalizeConditionalACText(value);
  return text === "bouclier" || text === "shield" || text.includes("sort_bouclier") || text.includes("spell_shield") || text.includes("bouclier_magique");
}

function add2eAttackTargetHasActiveShieldSpell(actor) {
  if (!actor) return false;

  for (const effect of add2eAttackEffectList(actor)) {
    const originItem = add2eAttackEffectOriginItem(actor, effect);
    const originType = String(originItem?.type ?? "").toLowerCase();
    const originName = originItem?.name ?? originItem?.system?.nom ?? "";
    const tags = add2eAttackCollectEffectTags(effect);

    if (add2eAttackIsShieldSpellText(effect?.name) || add2eAttackIsShieldSpellText(effect?.label)) return true;
    if (originType === "sort" && add2eAttackIsShieldSpellText(originName)) return true;
    if (tags.some(add2eAttackIsShieldSpellText)) return true;
  }

  return false;
}

function add2eAttackTransformationMeta(effect) {
  const meta = effect?.flags?.add2e?.capabilityTransformation;
  return meta && typeof meta === "object" ? meta : null;
}

function add2eAttackActiveTransformationAC(actor) {
  const candidates = add2eAttackEffectList(actor)
    .map(effect => ({ effect, meta: add2eAttackTransformationMeta(effect) }))
    .filter(entry => entry.meta?.kind === "form" && String(entry.meta?.sourceKey ?? "").trim())
    .map(entry => {
      const combat = entry.meta.combat && typeof entry.meta.combat === "object" ? entry.meta.combat : {};
      const armorClass = add2eAttackReadNumber(combat.armorClass, combat.ca, combat.ac, entry.meta.armorClass, entry.meta.ca, entry.meta.ac);
      const thac0 = add2eAttackReadNumber(combat.thac0, combat.thaco, entry.meta.thac0, entry.meta.thaco);
      return {
        effectId: entry.effect?.id ?? null,
        effectName: entry.effect?.name ?? "",
        sourceKey: String(entry.meta.sourceKey ?? ""),
        formKey: String(entry.meta.formKey ?? ""),
        category: String(entry.meta.category ?? ""),
        label: String(entry.meta.label ?? entry.effect?.name ?? "Transformation"),
        armorClass,
        thac0,
        movement: String(combat.movement ?? entry.meta.movement ?? ""),
        activatedAtTick: add2eAttackReadNumber(entry.meta.activatedAtTick) ?? -1
      };
    })
    .filter(entry => Number.isFinite(entry.armorClass))
    .sort((left, right) => right.activatedAtTick - left.activatedAtTick || String(right.effectId ?? "").localeCompare(String(left.effectId ?? "")));

  return candidates[0] ?? null;
}

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
  return { sousType: "autres", label: "attaque de mêlée", conditional: true };
}

function add2eAttackIsExplicitConditionalFixedAC(info, sousType) {
  const tag = String(info?.sourceTag ?? "").toLowerCase();
  if (!tag) return false;

  if (sousType === "projectile_lance") return tag.startsWith("ca_fixe_projectile_lance:") || tag.startsWith("ca_fixe_conditionnelle:projectile_lance:");
  if (sousType === "projectile_propulse") return tag.startsWith("ca_fixe_projectile_propulse:") || tag.startsWith("ca_fixe_conditionnelle:projectile_propulse:");
  if (sousType === "autres") return tag.startsWith("ca_fixe_autres:") || tag.startsWith("ca_fixe_conditionnelle:autres:");

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

  const transformation = add2eAttackActiveTransformationAC(cible);
  if (transformation) {
    const transformationCA = Number(transformation.armorClass);
    return {
      applied: transformationCA !== normalCA,
      ca: transformationCA,
      normalCA,
      fixedCA: null,
      attackSubtype,
      context: { ...context, transformation: true },
      details: {
        source: "capability-transformation:active-effect",
        transformation
      },
      detail: transformationCA !== normalCA
        ? `CA ${normalCA} → ${transformationCA} (${transformation.label})`
        : `CA de transformation ${transformationCA} (${transformation.label})`
    };
  }

  if (!add2eAttackTargetHasActiveShieldSpell(cible)) {
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
      ? `CA ${normalCA} → ${finalCA} contre ${attackSubtype.label} (Bouclier)`
      : `CA fixe ${fixedCA} non appliquée : la CA normale ${normalCA} reste meilleure`
  };
}
