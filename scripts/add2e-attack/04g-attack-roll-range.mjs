// scripts/add2e-attack/04g-attack-roll-range.mjs
// ADD2E — Portée, distance et contact pour les attaques.

function add2eAttackRangeNumber(system, ...keys) {
  for (const key of keys) {
    const value = Number(system?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function add2eAttackRangeValues(arme) {
  const system = arme?.system ?? {};
  const courte = add2eAttackRangeNumber(system, "portee_courte", "porteeCourte", "portee_short", "porteeShort", "short_range", "shortRange");
  const moyenne = add2eAttackRangeNumber(system, "portee_moyenne", "porteeMoyenne", "portee_medium", "porteeMedium", "medium_range", "mediumRange");
  const longue = add2eAttackRangeNumber(system, "portee_longue", "porteeLongue", "portee_long", "porteeLong", "long_range", "longRange");

  // Le profil d'attaque existant lit les clés canoniques après la validation
  // de portée. La normalisation reste locale à l'attaque et ne modifie pas
  // le document Item ni le compendium.
  if (courte > 0 && !(Number(system.portee_courte) > 0)) system.portee_courte = courte;
  if (moyenne > 0 && !(Number(system.portee_moyenne) > 0)) system.portee_moyenne = moyenne;
  if (longue > 0 && !(Number(system.portee_longue) > 0)) system.portee_longue = longue;

  return { courte, moyenne, longue };
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
  const { courte, longue } = add2eAttackRangeValues(arme);
  const isDistanceWeapon = courte > 0;

  if (!isDistanceWeapon && !auContact) {
    ui.notifications.error("Cible trop éloignée pour une arme de contact.");
    return { ok: false, isDistanceWeapon };
  }

  if (isDistanceWeapon && longue > 0 && distanceCible > longue) {
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
  const { courte: pC, moyenne: pM, longue: pL } = add2eAttackRangeValues(arme);
  const isDistance = pC > 0;

  if (isDistance) {
    if (srcToken && cibleToken) {
      try { dist = measureDistance(srcToken, cibleToken, { gridSpaces: true }); }
      catch (_error) { dist = 0; }
    }
    if (auContact) { descPortee = "Contact"; typePortee = "Contact"; }
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
