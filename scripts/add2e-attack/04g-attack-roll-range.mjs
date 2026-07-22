// scripts/add2e-attack/04g-attack-roll-range.mjs
// ADD2E — Portée, distance et contact pour les attaques.

export const ADD2E_ATTACK_RANGE_VERSION = "2026-07-22-magic-weapon-range-v2";

function add2eAttackRangeNormalize(value) {
  return String(value ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}

function add2eAttackRangeNumber(system, ...keys) {
  for (const key of keys) {
    const value = Number(system?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function add2eAttackRangeRuleArray(raw) {
  if (Array.isArray(raw)) return raw.filter(rule => rule && typeof rule === "object");
  if (raw && typeof raw === "object") return Array.isArray(raw.rules) ? raw.rules : [raw];
  return [];
}

function add2eAttackRangeActor(arme) {
  const parent = arme?.parent ?? arme?.actor ?? null;
  return parent?.documentName === "Actor" ? parent : null;
}

function add2eAttackRangeMagicRules(arme) {
  const actor = add2eAttackRangeActor(arme);
  if (!actor || !arme?.id) return [];
  const rules = [];
  for (const effect of actor.effects ?? []) {
    if (effect?.disabled || effect?.flags?.add2e?.magicItemCatalogueEffect !== true) continue;
    if (String(effect?.flags?.add2e?.sourceItemId ?? "") !== String(arme.id)) continue;
    rules.push(...add2eAttackRangeRuleArray(effect?.flags?.add2e?.rules));
  }
  return rules;
}

function add2eAttackRangeScaleToMaximum(ranges, maximum) {
  const max = Number(maximum);
  if (!Number.isFinite(max) || max <= 0) return ranges;
  const currentMax = ranges.longue || ranges.moyenne || ranges.courte;
  if (!(currentMax > 0)) return { courte: max, moyenne: max, longue: max };
  const factor = max / currentMax;
  return {
    courte: ranges.courte > 0 ? ranges.courte * factor : 0,
    moyenne: ranges.moyenne > 0 ? ranges.moyenne * factor : 0,
    longue: ranges.longue > 0 ? max : 0
  };
}

function add2eAttackApplyMagicRangeRules(arme, base) {
  let ranges = { ...base };
  let allShort = false;
  const details = [];

  for (const rule of add2eAttackRangeMagicRules(arme)) {
    const type = add2eAttackRangeNormalize(rule?.type ?? rule?.kind ?? rule?.category ?? "");
    if (type === "thrown_range_override") {
      const value = Number(rule?.value ?? rule?.range ?? rule?.distance);
      if (Number.isFinite(value) && value > 0) {
        ranges = add2eAttackRangeScaleToMaximum(ranges, value);
        details.push(`Portée de lancer imposée : ${value}`);
      }
      continue;
    }
    if (type !== "range_modifier") continue;

    const mode = add2eAttackRangeNormalize(rule?.mode ?? "");
    const value = Number(rule?.value ?? rule?.range ?? rule?.distance);
    if (mode === "multiply" && Number.isFinite(value) && value > 0) {
      ranges = {
        courte: ranges.courte * value,
        moyenne: ranges.moyenne * value,
        longue: ranges.longue * value
      };
      details.push(`Portées multipliées par ${value}`);
    } else if (mode === "override" && Number.isFinite(value) && value > 0) {
      ranges = add2eAttackRangeScaleToMaximum(ranges, value);
      details.push(`Portée maximale imposée : ${value}`);
    } else if (mode === "all_short") {
      allShort = true;
      if (Number.isFinite(value) && value > 0) ranges = add2eAttackRangeScaleToMaximum(ranges, value);
      details.push("Toutes les portées sont traitées comme une portée courte");
    }
  }

  const clean = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(Number(value).toFixed(4)) : 0;
  return {
    courte: clean(ranges.courte),
    moyenne: clean(ranges.moyenne),
    longue: clean(ranges.longue),
    allShort,
    details
  };
}

function add2eAttackRangeValues(arme) {
  const system = arme?.system ?? {};
  const base = {
    courte: add2eAttackRangeNumber(system, "portee_courte", "porteeCourte", "portee_short", "porteeShort", "short_range", "shortRange"),
    moyenne: add2eAttackRangeNumber(system, "portee_moyenne", "porteeMoyenne", "portee_medium", "porteeMedium", "medium_range", "mediumRange"),
    longue: add2eAttackRangeNumber(system, "portee_longue", "porteeLongue", "portee_long", "porteeLong", "long_range", "longRange")
  };
  const resolved = add2eAttackApplyMagicRangeRules(arme, base);

  // Le profil d'attaque existant lit les clés canoniques après la validation
  // de portée. La normalisation reste locale à l'attaque et ne modifie pas
  // le document Item ni le compendium.
  if (resolved.courte > 0 && !(Number(system.portee_courte) > 0)) system.portee_courte = resolved.courte;
  if (resolved.moyenne > 0 && !(Number(system.portee_moyenne) > 0)) system.portee_moyenne = resolved.moyenne;
  if (resolved.longue > 0 && !(Number(system.portee_longue) > 0)) system.portee_longue = resolved.longue;

  return resolved;
}

export function add2eAttackMeasureContactAndDistance({ srcToken, cibleToken, measureDistance }) {
  let distanceCible = 0;
  let auContact = false;

  try {
    if (srcToken && cibleToken) {
      distanceCible = measureDistance(srcToken, cibleToken, { gridSpaces: true });
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
  } catch (error) {
    console.warn("ADD2E | Erreur mesure distance/contact :", error);
    distanceCible = 0;
    auContact = false;
  }

  return { distanceCible, auContact };
}

export function add2eAttackValidateRange({ arme, distanceCible, auContact }) {
  const { courte, moyenne, longue } = add2eAttackRangeValues(arme);
  const isDistanceWeapon = courte > 0;
  const maximum = longue || moyenne || courte;

  if (!isDistanceWeapon && !auContact) {
    ui.notifications.error("Cible trop éloignée pour une arme de contact.");
    return { ok: false, isDistanceWeapon };
  }

  if (isDistanceWeapon && maximum > 0 && distanceCible > maximum) {
    ui.notifications.error("Cible hors de portée.");
    return { ok: false, isDistanceWeapon };
  }

  return { ok: true, isDistanceWeapon };
}

export function add2eAttackBuildDistanceLabel({ auContact, isDistanceWeapon, distanceCible }) {
  return auContact
    ? "Contact"
    : (isDistanceWeapon ? `${Number(distanceCible || 0).toFixed(1)} cases` : "Hors contact");
}

export function add2eAttackResolveRangeBand({ arme, srcToken, cibleToken, auContact, measureDistance }) {
  let dist = 0;
  let malusPortee = 0;
  let descPortee = "";
  let typePortee = "Contact";
  const { courte: pC, moyenne: pM, longue: pL, allShort } = add2eAttackRangeValues(arme);
  const isDistance = pC > 0;
  const maximum = pL || pM || pC;

  if (isDistance) {
    if (srcToken && cibleToken) {
      try { dist = measureDistance(srcToken, cibleToken, { gridSpaces: true }); }
      catch (_error) { dist = 0; }
    }
    if (auContact) { descPortee = "Contact"; typePortee = "Contact"; }
    else if (allShort && dist <= maximum) { descPortee = "Courte"; typePortee = "Courte"; }
    else if (dist <= pC) { descPortee = "Courte"; typePortee = "Courte"; }
    else if (pM > 0 && dist <= pM) { descPortee = "Moyenne"; typePortee = "Moyenne"; malusPortee = -2; }
    else if (pL > 0 && dist <= pL) { descPortee = "Longue"; typePortee = "Longue"; malusPortee = -5; }
    else { descPortee = "Hors de portée"; typePortee = "Loin"; }
  } else {
    dist = 1;
    descPortee = "Contact";
    typePortee = "Contact";
  }

  return { dist, malusPortee, descPortee, typePortee, isDistance };
}

globalThis.ADD2E_ATTACK_RANGE_VERSION = ADD2E_ATTACK_RANGE_VERSION;
