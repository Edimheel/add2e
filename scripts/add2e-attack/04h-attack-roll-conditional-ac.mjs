// scripts/add2e-attack/04h-attack-roll-conditional-ac.mjs
// ADD2E — Adaptation contextuelle de la CA canonique pour les attaques.
// Compatible Foundry V13/V14/V15.

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
    try { raw.push(effect.getFlag("add2e", "tags")); } catch (_error) {}
    try { raw.push(effect.getFlag("add2e", "effectTags")); } catch (_error) {}
    try { raw.push(effect.getFlag("add2e", "sourceSpellName")); } catch (_error) {}
    try { raw.push(effect.getFlag("add2e", "spellName")); } catch (_error) {}
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

function add2eAttackArmorClassEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.resolveArmorClass !== "function") {
    throw new Error("Le résolveur canonique ADD2E de classe d’armure n’est pas disponible.");
  }
  return engine;
}

export function add2eAttackConditionalACSubtype({ arme, combatProfile, isDistance, hasTag }) {
  const tags = combatProfile?.tags instanceof Set ? combatProfile.tags : new Set(combatProfile?.tags ?? []);
  const has = (...values) => hasTag(tags, ...values);
  const weaponName = String(arme?.name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    combatProfile?.isProjectilePropulse
    || has("usage:projectile_propulse", "categorie:projectile_propulse", "trait:projectile_propulse", "type:projectile_propulse")
    || /\b(arc|arbalete|fronde|fleche|flechette|carreau|trait)\b/.test(weaponName)
  ) return { sousType: "projectile_propulse", label: "projectile propulsé", conditional: true };

  if (
    combatProfile?.isLancer
    || has("usage:lancer", "usage:jet", "usage:arme_de_jet", "categorie:projectile_lance", "trait:arme_de_jet", "type:arme_de_jet")
    || /\b(javelot|hachette|dague|couteau|pierre|lance)\b/.test(weaponName)
  ) return { sousType: "projectile_lance", label: "projectile lancé à la main", conditional: true };

  if (isDistance) return { sousType: "projectile_propulse", label: "projectile", conditional: true };
  return { sousType: "autres", label: "attaque de mêlée", conditional: true };
}

function add2eAttackIsProjectileSubtype(sousType) {
  return ["projectile_propulse", "projectile_lance", "projectile"].includes(add2eAttackNormalizeConditionalACText(sousType));
}

function add2eAttackArmorClassDetail({ normal, contextual, attackSubtype, positionInfo }) {
  const details = [];
  const normalCA = Number(normal?.caTotal);
  const finalCA = Number(contextual?.caTotal);
  if (contextual?.transformation) details.push(`Transformation : CA ${contextual.transformation.armorClass}`);
  if (positionInfo?.ignoresShield && Number(normal?.shieldBonus)) details.push(`Bouclier ignoré : ${normal.shieldBonus}`);
  if (positionInfo?.ignoresDex && Number(normal?.dex)) details.push(`Dextérité ignorée : ${normal.dex >= 0 ? "+" : ""}${normal.dex}`);
  const conditional = contextual?.conditionalFixed;
  if (conditional) details.push(`CA fixe ${conditional.ca} contre ${conditional.label}`);
  if (normalCA !== finalCA) details.push(`CA ${normalCA} → ${finalCA} (${attackSubtype.label})`);
  return details.join(" — ");
}

export function add2eAttackResolveConditionalFixedAC({ cible, arme, combatProfile, isDistance, positionInfo, caBefore, hasTag }) {
  const engine = add2eAttackArmorClassEngine();
  const attackSubtype = add2eAttackConditionalACSubtype({ arme, combatProfile, isDistance, hasTag });
  const normal = engine.resolveArmorClass(cible, {
    type: "attaque",
    source: "attack-roll-normal-ac",
    frontale: true,
    position: "front"
  });
  const context = {
    type: "attaque",
    sousType: attackSubtype.sousType,
    attackSubtype: attackSubtype.sousType,
    frontale: positionInfo?.isFront === true,
    position: positionInfo?.zone ?? "front",
    ignoresShield: positionInfo?.ignoresShield === true,
    ignoresDex: positionInfo?.ignoresDex === true,
    isDistance,
    contact: !isDistance,
    arme: arme?.name ?? "",
    sourceItem: arme,
    sourceItemId: arme?.id ?? null,
    source: "attack-roll-contextual-ac"
  };
  const contextual = engine.resolveArmorClass(cible, context);
  const normalCA = Number(normal.caTotal);
  const finalCA = Number(contextual.caTotal);
  const detail = add2eAttackArmorClassDetail({ normal, contextual, attackSubtype, positionInfo });

  return {
    applied: finalCA !== normalCA,
    ca: finalCA,
    normalCA,
    fixedCA: contextual.conditionalFixed?.ca ?? null,
    projectileBonus: Math.max(0, normalCA - finalCA),
    attackSubtype,
    context,
    details: {
      normal,
      contextual,
      suppliedCA: Number(caBefore)
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
  return ["magique", "magic", "arme_magique", "magic_weapon", "projectile_magique", "magic_projectile"].some(tag => tags.has(tag));
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
