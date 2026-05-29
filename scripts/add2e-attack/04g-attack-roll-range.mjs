// scripts/add2e-attack/04g-attack-roll-range.mjs
// ADD2E — Portée, distance et contact pour les attaques.

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
  } catch (e) {
    console.warn("ADD2E | Erreur mesure distance/contact :", e);
    distanceCible = 0;
    auContact = false;
  }

  return { distanceCible, auContact };
}

export function add2eAttackValidateRange({ arme, distanceCible, auContact }) {
  const isDistanceWeapon = (arme.system.portee_courte ?? 0) > 0;

  if (!isDistanceWeapon && !auContact) {
    ui.notifications.error("Cible trop éloignée pour une arme de contact.");
    return { ok: false, isDistanceWeapon };
  }

  if (isDistanceWeapon) {
    const porteeLongue = Number(arme.system.portee_longue) || 0;
    if (porteeLongue > 0 && distanceCible > porteeLongue) {
      ui.notifications.error("Cible hors de portée.");
      return { ok: false, isDistanceWeapon };
    }
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
  const isDistance = (arme.system.portee_courte ?? 0) > 0;

  if (isDistance) {
    const pC = Number(arme.system.portee_courte) || 0;
    const pM = Number(arme.system.portee_moyenne) || 0;
    const pL = Number(arme.system.portee_longue) || 0;
    if (srcToken && cibleToken) {
      try { dist = measureDistance(srcToken, cibleToken, { gridSpaces: true }); } catch (e) { dist = 0; }
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

  return { dist, malusPortee, descPortee, typePortee, isDistance };
}
