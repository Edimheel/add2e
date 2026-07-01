// ============================================================
// ADD2E — Helpers globaux encore utilisés par la feuille legacy
// ============================================================

const ADD2E_LEGACY_GLOBAL_HELPERS_VERSION = "2026-07-01-legacy-global-helpers-v7-adnd-tactical-distance";
globalThis.ADD2E_LEGACY_GLOBAL_HELPERS_VERSION = ADD2E_LEGACY_GLOBAL_HELPERS_VERSION;
console.log("[ADD2E][LEGACY_GLOBAL_HELPERS][VERSION]", ADD2E_LEGACY_GLOBAL_HELPERS_VERSION);

const ADD2E_SHEET_IMAGE_FALLBACK = "icons/svg/item-bag.svg";
const ADD2E_SHEET_MISSING_IMAGES = globalThis.ADD2E_SHEET_MISSING_IMAGES instanceof Set
  ? globalThis.ADD2E_SHEET_MISSING_IMAGES
  : new Set();
globalThis.ADD2E_SHEET_MISSING_IMAGES = ADD2E_SHEET_MISSING_IMAGES;

function add2eSheetImageSource(image) {
  return String(image?.currentSrc || image?.getAttribute?.("src") || "").trim();
}

function add2eSheetImageSourceKeys(source) {
  const value = String(source ?? "").trim();
  if (!value) return [];

  const keys = new Set([value]);
  try { keys.add(new URL(value, document.baseURI).href); }
  catch (_e) {}
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

  for (const key of add2eSheetImageSourceKeys(source)) {
    ADD2E_SHEET_MISSING_IMAGES.add(key);
  }

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

// Le listener est posé une seule fois sur document, en capture. Il s'exécute
// avant un éventuel onerror ou listener ajouté sur l'image par une feuille,
// puis bloque la propagation : aucune erreur d'image ne peut provoquer render().
if (!globalThis.__ADD2E_SHEET_IMAGE_ERROR_CAPTURE_V5) {
  globalThis.__ADD2E_SHEET_IMAGE_ERROR_CAPTURE_V5 = true;

  document.addEventListener("error", event => {
    const image = event.target;
    if (!add2eIsCharacterSheetImage(image)) return;

    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    add2eApplySheetImageFallback(image);
  }, true);
}

function add2eRegisterSheetImageFallbacks(root) {
  if (!root?.find) return;

  root.find("img[src]").each((_index, image) => {
    if (!image || String(image.tagName ?? "").toLowerCase() !== "img") return;

    image.loading = "lazy";
    image.decoding = "async";

    // Après la première 404, une nouvelle feuille n'essaie plus l'URL
    // absente : elle reçoit directement l'icône locale.
    if (add2eIsKnownMissingSheetImage(image)) {
      add2eApplySheetImageFallback(image);
      return;
    }

    if (image.complete && image.naturalWidth === 0) {
      add2eApplySheetImageFallback(image);
    }
  });
}

globalThis.add2eRegisterSheetImageFallbacks = add2eRegisterSheetImageFallbacks;

function add2eLegacyNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_");
}

// ============================================================
// ADD2E — Conversion générique des distances de scène
// Les unités physiques restent physiques. L'unité `adnd-inch` est une unité
// tactique du manuel : 3 m pour une zone, 3 m/intérieur ou 9 m/extérieur pour
// une portée. Les cases et pixels sont toujours des valeurs dérivées.
// ============================================================

const ADD2E_DISTANCE_UNIT_METERS = Object.freeze({
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
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
  const normalized = add2eLegacyNormalize(value).replace(/_/g, "");
  return ["range", "portee", "portee_sort", "spellrange"].includes(normalized) ? "range" : "area";
}

function add2eSceneDistanceEnvironment(value) {
  const normalized = add2eLegacyNormalize(value).replace(/_/g, "");
  return ["exterior", "outside", "outdoor", "exterieur", "dehors"].includes(normalized) ? "exterior" : "interior";
}

function add2eSceneDistanceUnit(value, fallback = "ft") {
  const normalized = add2eLegacyNormalize(value).replace(/_/g, "");
  if (["adndinch", "adndtacticalinch", "tacticalinch", "tacticalinches", "pouceadnd", "poucetactique", "poucestactiques"].includes(normalized)) return "adnd-inch";
  if (["in", "inch", "inches", "pouce", "pouces"].includes(normalized)) return "in";
  if (["ft", "foot", "feet", "pied", "pieds"].includes(normalized)) return "ft";
  if (["yd", "yard", "yards", "verge", "verges"].includes(normalized)) return "yd";
  if (["m", "meter", "meters", "metre", "metres"].includes(normalized)) return "m";
  if (["km", "kilometer", "kilometers", "kilometre", "kilometres"].includes(normalized)) return "km";
  if (["mi", "mile", "miles"].includes(normalized)) return "mi";
  return ADD2E_DISTANCE_UNIT_METERS[fallback] || fallback === "adnd-inch" ? fallback : "ft";
}

function add2eSceneDistanceUnitLabel(unit) {
  return ({ "adnd-inch": "\"", in: "po", ft: "pi", yd: "yd", m: "m", km: "km", mi: "mi" })[unit] ?? unit;
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

/**
 * Retourne la même distance sous trois formes cohérentes :
 * - sceneDistance : valeur à passer à MeasuredTemplate.distance ;
 * - gridCells : nombre réel de cases, éventuellement fractionnaire ;
 * - pixels : rayon à utiliser pour les tests géométriques sur le canvas.
 */
function add2eSceneDistance({
  scene = canvas?.scene ?? null,
  distance = 0,
  unit = "ft",
  usage = "area",
  environment = "interior"
} = {}) {
  const sourceDistance = Math.max(0, add2eSceneDistanceNumber(distance, 0));
  const sourceUnit = add2eSceneDistanceUnit(unit);
  const resolvedUsage = add2eSceneDistanceUsage(usage);
  const resolvedEnvironment = add2eSceneDistanceEnvironment(environment);
  const sourceMeters = add2eDistanceMeters(sourceDistance, sourceUnit, { usage: resolvedUsage, environment: resolvedEnvironment });
  const sceneUnit = add2eSceneDistanceUnit(scene?.grid?.units ?? scene?.grid?.unit ?? "ft");
  const sceneDistance = add2eConvertSceneDistance(sourceMeters, "m", sceneUnit, { usage: resolvedUsage, environment: resolvedEnvironment });
  const gridDistance = Math.max(0.000001, add2eSceneDistanceNumber(scene?.grid?.distance, 1));
  const gridSize = Math.max(1, add2eSceneDistanceNumber(scene?.grid?.size ?? canvas?.grid?.size, 100));
  const gridCells = sceneDistance / gridDistance;

  return {
    sourceDistance,
    sourceUnit,
    sourceLabel: sourceUnit === "adnd-inch" ? `${sourceDistance}\"` : `${sourceDistance} ${add2eSceneDistanceUnitLabel(sourceUnit)}`,
    sourceMeters,
    tactical: sourceUnit === "adnd-inch" ? {
      usage: resolvedUsage,
      environment: resolvedEnvironment,
      metersPerInch: add2eTacticalInchMeters({ usage: resolvedUsage, environment: resolvedEnvironment })
    } : null,
    sceneDistance,
    sceneUnit,
    sceneLabel: `${Math.round(sceneDistance * 1000) / 1000} ${add2eSceneDistanceUnitLabel(sceneUnit)}`,
    gridDistance,
    gridSize,
    gridCells,
    pixels: gridCells * gridSize
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

function add2eLegacyArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(add2eLegacyArray).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
  if (value && typeof value === "object") {
    for (const key of ["value", "values", "list", "lists", "items", "allowed", "alignments", "alignements"]) {
      if (value[key] !== undefined) return add2eLegacyArray(value[key]);
    }
  }
  return [value];
}

function add2eClassAllowedAlignmentsFallback(classSystem = {}) {
  const sources = [
    classSystem.alignements_autorises,
    classSystem.alignementsAutorises,
    classSystem.allowedAlignments,
    classSystem.alignmentsAllowed,
    classSystem.alignements,
    classSystem.alignments,
    classSystem.alignment,
    classSystem.alignement
  ];

  const out = [];
  for (const src of sources) out.push(...add2eLegacyArray(src));

  const tags = add2eLegacyArray(classSystem.requirementTags);
  for (const raw of tags) {
    const tag = add2eLegacyNormalize(raw);
    const parts = tag.split(":");
    if (parts[0] !== "prerequis" || parts[1] !== "alignement") continue;
    if (parts[2] === "allow" && parts[3]) out.push(parts.slice(3).join(":"));
  }

  return [...new Set(out.map(v => String(v ?? "").trim()).filter(Boolean))];
}

if (typeof globalThis.add2eClassAllowedAlignments !== "function") {
  globalThis.add2eClassAllowedAlignments = add2eClassAllowedAlignmentsFallback;
}

if (typeof globalThis.add2ePickClassAlignment !== "function") {
  globalThis.add2ePickClassAlignment = function add2ePickClassAlignment(actor, classSystem = {}) {
    const allowed = globalThis.add2eClassAllowedAlignments?.(classSystem) ?? [];
    const current = String(actor?.system?.alignement ?? "").trim();
    const currentNorm = add2eLegacyNormalize(current);

    if (allowed.length) {
      const match = allowed.find(a => add2eLegacyNormalize(a) === currentNorm);
      if (match) return current;
      return allowed[0];
    }

    return current;
  };
}

if (typeof globalThis.add2eRegisterImgPicker !== "function") {
  globalThis.add2eRegisterImgPicker = function add2eRegisterImgPicker(html, sheet) {
    const root = html?.jquery ? html : $(html);
    if (!root?.find) return;

    // Fallback local uniquement : aucune écriture d'Actor/Item et aucun render().
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

// ============================================================
// ADD2E — Helpers d'écriture propres pour scripts onUse
// Un seul protocole socket : ADD2E_GM_OPERATION.
// La réception MJ reste centralisée dans scripts/add2e/15-validation-sockets.mjs.
// ============================================================

const ADD2E_SPELL_GM_HELPERS_VERSION = "2026-05-24-spell-gm-helpers-v1";
globalThis.ADD2E_SPELL_GM_HELPERS_VERSION = ADD2E_SPELL_GM_HELPERS_VERSION;

function add2eHasDirectActorWrite(actorDoc) {
  if (!actorDoc) return false;
  if (game.user?.isGM) return true;
  return !!actorDoc.isOwner || actorDoc.testUserPermission?.(game.user, "OWNER") === true;
}

function add2eReadHpMax(actorDoc) {
  const sys = actorDoc?.system ?? {};
  return Number(sys.points_de_coup)
    || Number(sys.pv_max)
    || Number(sys.points_de_vie)
    || Number(sys.hp?.max)
    || Number(sys.attributes?.hp?.max)
    || 0;
}

function add2eReadHpCurrent(actorDoc, max = 0) {
  const sys = actorDoc?.system ?? {};
  for (const raw of [sys.pdv, sys.pv, sys.hp?.value, sys.attributes?.hp?.value]) {
    if (raw === undefined || raw === null || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return Number(max) || 0;
}

async function add2eApplyDamageDirect({ actorDoc, montant = 0, type = "degats", details = "" } = {}) {
  if (!actorDoc) return false;
  const amount = Math.abs(Number(montant) || 0);
  if (!amount) return true;

  const isHeal = String(type ?? "").toLowerCase().includes("soin") || Number(montant) < 0;
  const max = add2eReadHpMax(actorDoc);
  const current = add2eReadHpCurrent(actorDoc, max);
  const next = isHeal ? Math.min(max || current + amount, current + amount) : current - amount;

  await actorDoc.update({ "system.pdv": next }, { add2eReason: "spell-apply-damage", add2eDetails: details });
  console.log("[ADD2E][SPELL_GM_HELPERS][APPLY_DAMAGE_DIRECT]", { actor: actorDoc.name, type, montant, current, max, next, details });
  return true;
}

function add2ePayloadFromTarget(cible, data = {}) {
  const tokenDoc = cible?.document ?? cible?.token?.document ?? null;
  const actorDoc = cible?.actor ?? cible;
  return {
    actorId: actorDoc?.id ?? tokenDoc?.actorId ?? null,
    actorUuid: actorDoc?.uuid ?? null,
    sceneId: tokenDoc?.parent?.id ?? canvas?.scene?.id ?? null,
    tokenId: tokenDoc?.id ?? null,
    ...data
  };
}

function add2eEmitGMOperation(operation, payload = {}) {
  const activeGM = game.users?.activeGM ?? game.users?.find?.(u => u.active && u.isGM) ?? null;
  if (!game.socket || (!game.user?.isGM && !activeGM)) return false;
  game.socket.emit("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation,
    payload: { ...payload, fromUserId: game.user.id, sentAt: Date.now() }
  });
  console.log("[ADD2E][SPELL_GM_HELPERS][GM_OPERATION_EMIT]", { operation, payload });
  return true;
}

if (typeof globalThis.add2eApplyDamage !== "function") {
  globalThis.add2eApplyDamage = async function add2eApplyDamage({ cible, montant = 0, type = "degats", details = "" } = {}) {
    const actorDoc = cible?.actor ?? cible;
    if (!actorDoc) return false;
    if (add2eHasDirectActorWrite(actorDoc)) return await add2eApplyDamageDirect({ actorDoc, montant, type, details });

    const ok = add2eEmitGMOperation("applyDamage", add2ePayloadFromTarget(cible, { montant, type, details }));
    if (!ok) ui.notifications?.error(`ADD2E : aucun MJ actif pour appliquer ${details || type}.`);
    return ok;
  };
}

if (typeof globalThis.add2eDeleteActiveEffects !== "function") {
  globalThis.add2eDeleteActiveEffects = async function add2eDeleteActiveEffects({ actor, effects = [], ids = [], tags = [], names = [] } = {}) {
    const actorDoc = actor;
    if (!actorDoc) return { deleted: 0, blocked: true };
    const wantedIds = [...ids, ...effects.map(e => e?.id).filter(Boolean)].filter(Boolean);

    if (add2eHasDirectActorWrite(actorDoc)) {
      let finalIds = [...wantedIds];
      if (tags.length || names.length) {
        const tagNorms = tags.map(add2eLegacyNormalize);
        const nameNorms = names.map(add2eLegacyNormalize);
        for (const effect of actorDoc.effects ?? []) {
          const eTags = add2eLegacyArray(effect.flags?.add2e?.tags ?? effect.getFlag?.("add2e", "tags") ?? []).map(add2eLegacyNormalize);
          const eName = add2eLegacyNormalize(effect.name);
          if (tagNorms.some(t => eTags.includes(t)) || nameNorms.some(n => eName.includes(n))) finalIds.push(effect.id);
        }
      }
      finalIds = [...new Set(finalIds)].filter(Boolean);
      if (finalIds.length) await actorDoc.deleteEmbeddedDocuments("ActiveEffect", finalIds);
      return { deleted: finalIds.length, blocked: false };
    }

    const ok = add2eEmitGMOperation("deleteActiveEffects", {
      actorUuid: actorDoc.uuid,
      actorId: actorDoc.id,
      effectIds: wantedIds,
      tags,
      names
    });
    return { deleted: 0, blocked: !ok, relayed: ok };
  };
}

console.log("[ADD2E][SPELL_GM_HELPERS][READY]", ADD2E_SPELL_GM_HELPERS_VERSION);
