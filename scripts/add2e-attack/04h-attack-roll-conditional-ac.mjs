// scripts/add2e-attack/04h-attack-roll-conditional-ac.mjs
// ADD2E — CA conditionnelle pour les attaques.
// Version : 2026-07-23-canonical-projectile-defense-v1

function add2eAttackNormalizeConditionalACText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:+_.-]+/g, "_")
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
    const number = Number(String(value).replace(",", "."));
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
  const seen = new Set();
  return [
    ...add2eAttackArray(actor?.effects),
    ...add2eAttackArray(actor?.appliedEffects),
    ...add2eAttackArray(actor?.temporaryEffects)
  ].filter(effect => {
    const key = String(effect?.uuid ?? effect?.id ?? "");
    if (!effect || effect.disabled === true || effect.isSuppressed === true || effect.active === false) return false;
    if (key && seen.has(key)) return false;
    if (key) seen.add(key);
    return true;
  });
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

function add2eAttackActiveEffectTags(actor) {
  const tags = new Set();
  for (const effect of add2eAttackEffectList(actor)) {
    for (const tag of add2eAttackCollectEffectTags(effect)) tags.add(tag);
  }
  return tags;
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

function add2eAttackIsProjectileSubtype(sousType) {
  return ["projectile_propulse", "projectile_lance", "projectile"].includes(add2eAttackNormalizeConditionalACText(sousType));
}

function add2eAttackTaggedNumber(tag, prefix) {
  if (!String(tag).startsWith(prefix)) return null;
  return add2eAttackReadNumber(String(tag).slice(prefix.length));
}

function add2eAttackProjectileArmorBonus(actor, attackSubtype) {
  if (!add2eAttackIsProjectileSubtype(attackSubtype?.sousType)) return { value: 0, sourceTags: [] };
  let value = 0;
  const sourceTags = [];
  for (const tag of add2eAttackActiveEffectTags(actor)) {
    const direct = add2eAttackTaggedNumber(tag, "bonus_ca_projectile:");
    const conditional = add2eAttackTaggedNumber(tag, "bonus_ca_conditionnel:projectile:");
    const amount = Number.isFinite(direct) ? direct : conditional;
    if (!Number.isFinite(amount)) continue;
    value += amount;
    sourceTags.push(tag);
  }
  return { value, sourceTags };
}

function add2eAttackIsExplicitConditionalFixedAC(info, sousType) {
  const tag = String(info?.sourceTag ?? "").toLowerCase();
  if (!tag) return false;

  if (sousType === "projectile_lance") return tag.startsWith("ca_fixe_projectile_lance:") || tag.startsWith("ca_fixe_conditionnelle:projectile_lance:");
  if (sousType === "projectile_propulse") return tag.startsWith("ca_fixe_projectile_propulse:") || tag.startsWith("ca_fixe_conditionnelle:projectile_propulse:");
  if (sousType === "autres") return tag.startsWith("ca_fixe_autres:") || tag.startsWith("ca_fixe_conditionnelle:autres:");

  return tag.startsWith(`ca_fixe_conditionnelle:${sousType}:`);
}

function add2eAttackConditionalACDetail({ normalCA, projectileCA, projectileBonus, fixedCA, finalCA, attackSubtype, transformation }) {
  const details = [];
  if (transformation) {
    details.push(normalCA !== Number(transformation.armorClass)
      ? `CA ${normalCA} → ${Number(transformation.armorClass)} (${transformation.label})`
      : `CA de transformation ${Number(transformation.armorClass)} (${transformation.label})`);
  }
  if (projectileBonus > 0) details.push(`CA ${transformation ? Number(transformation.armorClass) : normalCA} → ${projectileCA} contre ${attackSubtype.label} (bonus ${projectileBonus})`);
  if (Number.isFinite(fixedCA)) {
    details.push(finalCA === fixedCA
      ? `CA ${projectileCA} → ${fixedCA} contre ${attackSubtype.label} (Bouclier)`
      : `CA fixe ${fixedCA} non appliquée : la CA ${projectileCA} reste meilleure`);
  }
  return details.join(" — ");
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
  const baseCA = transformation ? Number(transformation.armorClass) : normalCA;
  const projectile = add2eAttackProjectileArmorBonus(cible, attackSubtype);
  const projectileBonus = Math.max(0, Number(projectile.value) || 0);
  const projectileCA = Number.isFinite(baseCA) ? baseCA - projectileBonus : baseCA;

  if (transformation) {
    const detail = add2eAttackConditionalACDetail({
      normalCA,
      projectileCA,
      projectileBonus,
      fixedCA: null,
      finalCA: projectileCA,
      attackSubtype,
      transformation
    });
    return {
      applied: projectileCA !== normalCA,
      ca: projectileCA,
      normalCA,
      fixedCA: null,
      projectileBonus,
      attackSubtype,
      context: { ...context, transformation: true },
      details: {
        source: "capability-transformation:active-effect",
        transformation,
        projectile
      },
      detail
    };
  }

  let fixedInfo = null;
  let fixedCA = null;
  if (add2eAttackTargetHasActiveShieldSpell(cible)) {
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
  }

  const explicitFixed = Number.isFinite(fixedCA) && add2eAttackIsExplicitConditionalFixedAC(fixedInfo, attackSubtype.sousType);
  const finalCA = explicitFixed && Number.isFinite(projectileCA) ? Math.min(projectileCA, fixedCA) : projectileCA;
  const detail = add2eAttackConditionalACDetail({
    normalCA,
    projectileCA,
    projectileBonus,
    fixedCA: explicitFixed ? fixedCA : null,
    finalCA,
    attackSubtype,
    transformation: null
  });

  return {
    applied: finalCA !== normalCA,
    ca: finalCA,
    normalCA,
    fixedCA: Number.isFinite(fixedCA) ? fixedCA : null,
    projectileBonus,
    attackSubtype,
    context,
    details: {
      fixedInfo,
      projectile,
      explicitFixed
    },
    detail
  };
}

function add2eAttackWeaponTagSet(arme, combatProfile) {
  const tags = new Set();
  for (const raw of [
    combatProfile?.tags,
    combatProfile?.tagSet,
    arme?.system?.tags,
    arme?.system?.effectTags,
    arme?.flags?.add2e?.tags,
    arme?.flags?.add2e?.effectTags
  ]) {
    for (const value of add2eAttackArray(raw)) {
      const tag = add2eAttackNormalizeConditionalACText(value);
      if (tag) tags.add(tag);
    }
  }
  return tags;
}

function add2eAttackIsMagicalProjectileWeapon(arme, combatProfile) {
  const system = arme?.system ?? {};
  const flags = arme?.flags?.add2e ?? {};
  const enchantment = system.enchantement && typeof system.enchantement === "object" ? system.enchantement : null;
  const powers = system.pouvoirs ?? system.powers ?? [];
  const hasPowers = Array.isArray(powers) ? powers.length > 0 : powers && typeof powers === "object" ? Object.keys(powers).length > 0 : false;
  if (system.magique === true || system.magic === true || flags.magicItemBuilder || flags.magicPowerCatalogue || hasPowers) return true;
  if (enchantment && (
    String(enchantment.baseUuid ?? "").trim()
    || Number(enchantment.bonusToucher ?? enchantment.bonus_toucher ?? 0) !== 0
    || Number(enchantment.bonusDegats ?? enchantment.bonus_degats ?? 0) !== 0
  )) return true;
  const tags = add2eAttackWeaponTagSet(arme, combatProfile);
  return ["magique", "magic", "arme_magique", "magic_weapon", "projectile_magique", "magic_projectile"]
    .some(tag => tags.has(tag));
}

function add2eAttackMagicProjectileNegationCandidates(cible) {
  const candidates = [];
  for (const tag of add2eAttackActiveEffectTags(cible)) {
    if (!tag.startsWith("negate_magic_projectile:")) continue;
    const parts = tag.split(":");
    const chance = Math.max(0, Math.min(100, add2eAttackReadNumber(parts.at(-1)) ?? 0));
    const arc = parts.length > 2 ? add2eAttackNormalizeConditionalACText(parts[1]) || "any" : "any";
    if (chance > 0) candidates.push({ tag, arc, chance });
  }
  return candidates.sort((left, right) => right.chance - left.chance);
}

export async function add2eAttackResolveMagicProjectileNegation({ cible, arme, combatProfile, isDistance, positionInfo, hasTag }) {
  const attackSubtype = add2eAttackConditionalACSubtype({ arme, combatProfile, isDistance, hasTag });
  if (!add2eAttackIsProjectileSubtype(attackSubtype.sousType)) {
    return { eligible: false, negated: false, reason: "not-projectile", attackSubtype, detail: "" };
  }
  if (!add2eAttackIsMagicalProjectileWeapon(arme, combatProfile)) {
    return { eligible: false, negated: false, reason: "not-magical-projectile", attackSubtype, detail: "" };
  }
  const candidates = add2eAttackMagicProjectileNegationCandidates(cible)
    .filter(candidate => candidate.arc !== "front" || positionInfo?.isFront === true);
  if (!candidates.length) {
    return { eligible: false, negated: false, reason: "no-applicable-negation", attackSubtype, detail: "" };
  }

  const selected = candidates[0];
  const roll = await new Roll("1d100").evaluate();
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  const total = Number(roll.total) || 0;
  const negated = total <= selected.chance;
  return {
    eligible: true,
    negated,
    reason: negated ? "negated" : "chance-failed",
    chance: selected.chance,
    roll: total,
    arc: selected.arc,
    sourceTag: selected.tag,
    attackSubtype,
    detail: negated
      ? `Projectile magique annulé : ${total} ≤ ${selected.chance}%`
      : `Négation du projectile magique échouée : ${total} > ${selected.chance}%`
  };
}
