// ============================================================
// ADD2E — Utilitaires transversaux de feuille et de scène.
// Aucun calcul métier de classe, d'alignement, de PV ou d'effet ne vit ici.
// Compatible Foundry V13/V14/V15.
// ============================================================

const ADD2E_GLOBAL_UTILITIES_VERSION = "2026-08-13-global-utilities-v11-local-state";

const ADD2E_SHEET_IMAGE_FALLBACK = "icons/svg/item-bag.svg";
const ADD2E_SHEET_MISSING_IMAGES = new Set();

function add2eNormalizeUtilityKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_");
}

function add2eSheetImageSource(image) {
  return String(image?.currentSrc || image?.getAttribute?.("src") || "").trim();
}

function add2eSheetImageSourceKeys(source) {
  const value = String(source ?? "").trim();
  if (!value) return [];
  const keys = new Set([value]);
  try { keys.add(new URL(value, document.baseURI).href); }
  catch (_error) {}
  return [...keys];
}

function add2eIsKnownMissingSheetImage(image) {
  return add2eSheetImageSourceKeys(add2eSheetImageSource(image))
    .some(key => ADD2E_SHEET_MISSING_IMAGES.has(key));
}

function add2eIsCharacterSheetImage(image) {
  if (!image || String(image.tagName ?? "").toLowerCase() !== "img") return false;
  return Boolean(image.closest?.(".add2e-character-v3, .add2e-character-v2-app, #add2e-personnage"));
}

function add2eApplySheetImageFallback(image) {
  if (!image || String(image.tagName ?? "").toLowerCase() !== "img") return;
  if (image.dataset.add2eImageFallbackApplied === "true") return;

  const source = add2eSheetImageSource(image);
  if (source === ADD2E_SHEET_IMAGE_FALLBACK || source.endsWith(`/${ADD2E_SHEET_IMAGE_FALLBACK}`)) return;
  for (const key of add2eSheetImageSourceKeys(source)) ADD2E_SHEET_MISSING_IMAGES.add(key);

  image.dataset.add2eImageFallbackApplied = "true";
  image.dataset.add2eImageFallbackSource = source;
  image.removeAttribute("onerror");
  image.onerror = null;
  image.removeAttribute("srcset");
  image.removeAttribute("sizes");
  image.loading = "lazy";
  image.decoding = "async";
  image.alt ||= "Image indisponible";
  image.src = ADD2E_SHEET_IMAGE_FALLBACK;
}

document.addEventListener("error", event => {
  const image = event.target;
  if (!add2eIsCharacterSheetImage(image)) return;
  event.preventDefault?.();
  event.stopImmediatePropagation?.();
  add2eApplySheetImageFallback(image);
}, true);

function add2eRegisterSheetImageFallbacks(root) {
  if (!root?.find) return;
  root.find("img[src]").each((_index, image) => {
    if (!image || String(image.tagName ?? "").toLowerCase() !== "img") return;
    image.loading = "lazy";
    image.decoding = "async";
    if (add2eIsKnownMissingSheetImage(image) || (image.complete && image.naturalWidth === 0)) {
      add2eApplySheetImageFallback(image);
    }
  });
}

globalThis.add2eRegisterSheetImageFallbacks = add2eRegisterSheetImageFallbacks;

// ============================================================
// ADD2E — Conversion générique des distances de scène.
// ============================================================

const ADD2E_DISTANCE_UNIT_METERS = Object.freeze({
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  cm: 0.01,
  m: 1,
  km: 1000,
  mi: 1609.344
});

const ADD2E_TACTICAL_INCH_METERS = Object.freeze({
  area: 3,
  rangeInterior: 3,
  rangeExterior: 9
});

function add2eSceneDistanceNumber(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function add2eSceneDistanceUsage(value) {
  const normalized = add2eNormalizeUtilityKey(value).replace(/_/g, "");
  return ["range", "portee", "portee_sort", "spellrange"].includes(normalized) ? "range" : "area";
}

function add2eSceneDistanceEnvironment(value) {
  const normalized = add2eNormalizeUtilityKey(value).replace(/_/g, "");
  return ["exterior", "outside", "outdoor", "exterieur", "dehors"].includes(normalized) ? "exterior" : "interior";
}

function add2eSceneDistanceMeasure(value) {
  const normalized = add2eNormalizeUtilityKey(value).replace(/_/g, "");
  return ["diameter", "diametre", "diametere", "diam"].includes(normalized) ? "diameter" : "radius";
}

function add2eSceneDistanceUnit(value, fallback = "ft") {
  const normalized = add2eNormalizeUtilityKey(value).replace(/_/g, "");
  if (["adndinch", "adndtacticalinch", "tacticalinch", "tacticalinches", "pouceadnd", "poucetactique", "poucestactiques"].includes(normalized)) return "adnd-inch";
  if (["in", "inch", "inches", "pouce", "pouces"].includes(normalized)) return "in";
  if (["ft", "foot", "feet", "pied", "pieds"].includes(normalized)) return "ft";
  if (["yd", "yard", "yards", "verge", "verges"].includes(normalized)) return "yd";
  if (["cm", "centimeter", "centimeters", "centimetre", "centimetres"].includes(normalized)) return "cm";
  if (["m", "meter", "meters", "metre", "metres"].includes(normalized)) return "m";
  if (["km", "kilometer", "kilometers", "kilometre", "kilometres"].includes(normalized)) return "km";
  if (["mi", "mile", "miles"].includes(normalized)) return "mi";
  return (fallback === "adnd-inch" || ADD2E_DISTANCE_UNIT_METERS[fallback]) ? fallback : "ft";
}

function add2eSceneDistanceUnitLabel(unit) {
  return ({ "adnd-inch": "\"", in: "po", ft: "pi", yd: "yd", cm: "cm", m: "m", km: "km", mi: "mi" })[unit] ?? unit;
}

function add2eTacticalInchMeters({ usage = "area", environment = "interior" } = {}) {
  const resolvedUsage = add2eSceneDistanceUsage(usage);
  const resolvedEnvironment = add2eSceneDistanceEnvironment(environment);
  if (resolvedUsage === "range") {
    return resolvedEnvironment === "exterior"
      ? ADD2E_TACTICAL_INCH_METERS.rangeExterior
      : ADD2E_TACTICAL_INCH_METERS.rangeInterior;
  }
  return ADD2E_TACTICAL_INCH_METERS.area;
}

function add2eDistanceMeters(value, unit = "ft", options = {}) {
  const source = add2eSceneDistanceNumber(value, NaN);
  const resolvedUnit = add2eSceneDistanceUnit(unit);
  if (!Number.isFinite(source)) return NaN;
  if (resolvedUnit === "adnd-inch") return source * add2eTacticalInchMeters(options);
  return source * ADD2E_DISTANCE_UNIT_METERS[resolvedUnit];
}

function add2eConvertSceneDistance(value, fromUnit = "ft", toUnit = "ft", options = {}) {
  const meters = add2eDistanceMeters(value, fromUnit, options);
  const target = add2eSceneDistanceUnit(toUnit);
  if (!Number.isFinite(meters)) return NaN;
  if (target === "adnd-inch") return meters / add2eTacticalInchMeters(options);
  return meters / ADD2E_DISTANCE_UNIT_METERS[target];
}

function add2eSceneDistance({
  scene = canvas?.scene ?? null,
  distance = 0,
  unit = "ft",
  usage = "area",
  environment = "interior",
  measure = "radius"
} = {}) {
  const sourceDistance = Math.max(0, add2eSceneDistanceNumber(distance, 0));
  const sourceUnit = add2eSceneDistanceUnit(unit);
  const resolvedUsage = add2eSceneDistanceUsage(usage);
  const resolvedEnvironment = add2eSceneDistanceEnvironment(environment);
  const resolvedMeasure = add2eSceneDistanceMeasure(measure);
  const measureMeters = add2eDistanceMeters(sourceDistance, sourceUnit, { usage: resolvedUsage, environment: resolvedEnvironment });
  const radiusMeters = resolvedMeasure === "diameter" ? measureMeters / 2 : measureMeters;
  const diameterMeters = radiusMeters * 2;
  const sceneUnit = add2eSceneDistanceUnit(scene?.grid?.units ?? scene?.grid?.unit ?? "ft");
  const radiusSceneDistance = add2eConvertSceneDistance(radiusMeters, "m", sceneUnit, { usage: resolvedUsage, environment: resolvedEnvironment });
  const diameterSceneDistance = add2eConvertSceneDistance(diameterMeters, "m", sceneUnit, { usage: resolvedUsage, environment: resolvedEnvironment });
  const gridDistance = Math.max(0.000001, add2eSceneDistanceNumber(scene?.grid?.distance, 1));
  const gridSize = Math.max(1, add2eSceneDistanceNumber(scene?.grid?.size ?? canvas?.grid?.size, 100));
  const radiusGridCells = radiusSceneDistance / gridDistance;
  const diameterGridCells = diameterSceneDistance / gridDistance;
  const radiusPixels = radiusGridCells * gridSize;
  const diameterPixels = diameterGridCells * gridSize;

  return {
    sourceDistance,
    sourceUnit,
    sourceLabel: sourceUnit === "adnd-inch" ? `${sourceDistance}\"` : `${sourceDistance} ${add2eSceneDistanceUnitLabel(sourceUnit)}`,
    measure: resolvedMeasure,
    measureMeters,
    sourceMeters: measureMeters,
    tactical: sourceUnit === "adnd-inch" ? {
      usage: resolvedUsage,
      environment: resolvedEnvironment,
      metersPerInch: add2eTacticalInchMeters({ usage: resolvedUsage, environment: resolvedEnvironment })
    } : null,
    radiusMeters,
    diameterMeters,
    sceneDistance: radiusSceneDistance,
    gridCells: radiusGridCells,
    pixels: radiusPixels,
    sceneUnit,
    sceneLabel: `${Math.round(radiusSceneDistance * 1000) / 1000} ${add2eSceneDistanceUnitLabel(sceneUnit)}`,
    gridDistance,
    gridSize,
    radiusSceneDistance,
    radiusGridCells,
    radiusPixels,
    diameterSceneDistance,
    diameterGridCells,
    diameterPixels
  };
}

globalThis.add2eConvertSceneDistance = add2eConvertSceneDistance;
globalThis.add2eSceneDistance = add2eSceneDistance;
globalThis.add2eTacticalInchMeters = add2eTacticalInchMeters;

Hooks.once("ready", () => {
  game.add2e ??= {};
  game.add2e.scene ??= {};
  game.add2e.scene.convertDistance = add2eConvertSceneDistance;
  game.add2e.scene.distance = add2eSceneDistance;
  game.add2e.scene.tacticalInchMeters = add2eTacticalInchMeters;
});

if (typeof globalThis.add2eRegisterImgPicker !== "function") {
  globalThis.add2eRegisterImgPicker = function add2eRegisterImgPicker(html, sheet) {
    const root = html?.jquery ? html : $(html);
    if (!root?.find) return;

    add2eRegisterSheetImageFallbacks(root);
    const actor = sheet?.actor ?? sheet?.document;
    if (!actor) return;

    root.find("img[data-edit], .profile-img[data-edit], .actor-img[data-edit]")
      .off("click.add2e-img-picker")
      .on("click.add2e-img-picker", ev => {
        ev.preventDefault();
        const target = ev.currentTarget;
        const field = target.dataset.edit || target.getAttribute("data-edit") || "img";
        const current = foundry.utils.getProperty(actor, field) || target.getAttribute("src") || actor.img || "icons/svg/mystery-man.svg";

        new FilePicker({
          type: "image",
          current,
          callback: async path => {
            const update = {};
            update[field] = path;
            await actor.update(update);
          },
          top: sheet?.position?.top + 40,
          left: sheet?.position?.left + 10
        }).browse(current);
      });
  };
}
