/* ADD2E — Paladin : Détection du mal
 * Source canonique : classFeature de l'Item classe Paladin.
 * Règle : détection du mal à 20 m, à volonté, avec concentration.
 * Compatible Foundry V13/V14/V15.
 */

const ADD2E_PALADIN_DETECTION_MAL_VERSION = "2026-08-12-canonical-alignment-range-v3";
globalThis.ADD2E_PALADIN_DETECTION_MAL_VERSION = ADD2E_PALADIN_DETECTION_MAL_VERSION;

const paladin = (typeof actor !== "undefined" && actor) ? actor : null;
if (!paladin) {
  ui.notifications.error("Détection du mal : acteur introuvable.");
  return false;
}

const buildChatCard = globalThis.add2eBuildChatCard;
const createChatCard = globalThis.add2eCreateChatCard;
if (typeof buildChatCard !== "function" || typeof createChatCard !== "function") {
  throw new Error("Les constructeurs communs de cartes ADD2E ne sont pas disponibles.");
}

const normalize = value => String(value ?? "")
  .trim()
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const escapeHtml = value => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const unitToMeters = value => {
  const key = normalize(value);
  if (["m", "metre", "metres", "meter", "meters"].includes(key)) return 1;
  if (["ft", "foot", "feet", "pied", "pieds", "pi"].includes(key)) return 0.3048;
  if (["yd", "yard", "yards", "verge", "verges"].includes(key)) return 0.9144;
  if (["km", "kilometre", "kilometres", "kilometer", "kilometers"].includes(key)) return 1000;
  throw new Error(`Détection du mal : unité de grille Foundry non supportée (${String(value ?? "vide")}).`);
};

const casterToken = canvas.tokens?.controlled?.find(tokenDoc => tokenDoc.actor?.id === paladin.id)
  ?? paladin.getActiveTokens?.()[0]
  ?? null;

const targetTokens = Array.from(game.user?.targets ?? []);
const rangeMeters = 20;
const results = [];

let gridMetrics = null;
if (casterToken && targetTokens.length) {
  try {
    const gridSize = Number(canvas.grid?.size ?? canvas.scene?.grid?.size);
    const gridDistance = Number(canvas.scene?.grid?.distance);
    if (!(gridSize > 0) || !(gridDistance > 0)) {
      throw new Error("Détection du mal : configuration de grille Foundry invalide.");
    }
    const metersPerGridSpace = gridDistance * unitToMeters(canvas.scene?.grid?.units);
    gridMetrics = { gridSize, metersPerGridSpace };
  } catch (error) {
    console.error("[ADD2E][PALADIN_DETECTION_MAL][SCENE_GRID]", {
      scene: canvas.scene?.name,
      error
    });
    ui.notifications.error(error.message);
    return false;
  }
}

for (const targetToken of targetTokens) {
  const targetActor = targetToken?.actor ?? null;
  if (!targetActor) continue;

  let distanceMeters = null;
  let inRange = null;
  if (casterToken && gridMetrics) {
    const dx = Number(targetToken.center?.x ?? 0) - Number(casterToken.center?.x ?? 0);
    const dy = Number(targetToken.center?.y ?? 0) - Number(casterToken.center?.y ?? 0);
    const pixelDistance = Math.hypot(dx, dy);
    distanceMeters = (pixelDistance / gridMetrics.gridSize) * gridMetrics.metersPerGridSpace;
    inRange = distanceMeters <= rangeMeters + 1e-6;
  }

  const alignmentRaw = targetActor.system?.alignement;
  const alignment = normalize(alignmentRaw);
  const knownAlignment = Boolean(alignment);
  const evil = knownAlignment && alignment.includes("mauvais");

  results.push({
    name: targetToken.name ?? targetActor.name ?? "Cible",
    distanceMeters,
    inRange,
    knownAlignment,
    evil
  });
}

const resultHtml = results.length
  ? `<ul>${results.map(result => {
      const distanceLabel = Number.isFinite(result.distanceMeters)
        ? `${result.distanceMeters.toFixed(1)} m`
        : "distance non mesurable";
      if (result.inRange === false) {
        return `<li><b>${escapeHtml(result.name)}</b> — hors de portée (${escapeHtml(distanceLabel)}).</li>`;
      }
      if (!result.knownAlignment) {
        return `<li><b>${escapeHtml(result.name)}</b> — alignement canonique non renseigné ; résultat à déterminer par le MD.</li>`;
      }
      return `<li><b>${escapeHtml(result.name)}</b> — ${result.evil ? "présence mauvaise détectée" : "aucune présence mauvaise détectée"}${Number.isFinite(result.distanceMeters) ? ` (${escapeHtml(distanceLabel)})` : ""}.</li>`;
    }).join("")}</ul>`
  : "<p>Aucune cible sélectionnée. Le paladin se concentre pour localiser toute présence mauvaise dans un rayon de 20 m ; le MD indique ce qui est perçu.</p>";

const cardOptions = {
  actor: paladin,
  title: "Détection du mal",
  icon: "fas fa-eye",
  variant: "ability",
  rows: [
    { label: "Portée", value: "20 mètres" },
    { label: "Activation", value: "À volonté, avec concentration" }
  ],
  message: `${paladin.name} se concentre pour détecter la présence du mal et en déterminer la position.`,
  trustedBodyHtml: resultHtml,
  chatData: {
    speaker: ChatMessage.getSpeaker({ actor: paladin }),
    flags: {
      add2e: {
        sourceCapacite: "paladin-detection-mal",
        rangeMeters,
        requiresConcentration: true,
        version: ADD2E_PALADIN_DETECTION_MAL_VERSION
      }
    }
  }
};

const preview = buildChatCard(cardOptions);
if (!String(preview ?? "").trim()) {
  throw new Error("Détection du mal : carte ADD2E vide.");
}
await createChatCard(cardOptions);
return true;
