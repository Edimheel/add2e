// ============================================================
// ADD2E — Capacités activables de classe : exécution on_use
// ============================================================
function add2eToClassFeatureArray(value) {
  if (Array.isArray(value)) return value.filter(v => v && typeof v === "object");
  if (value && typeof value === "object") return Object.values(value).filter(v => v && typeof v === "object");
  return [];
}

function add2eFeatureMinLevel(feature) {
  return Number(feature?.minLevel ?? feature?.minimumLevel ?? feature?.niveauMin ?? feature?.level ?? feature?.niveau ?? 1) || 1;
}

function add2eFeatureMaxLevel(feature) {
  const raw = feature?.maxLevel ?? feature?.maximumLevel ?? feature?.niveauMax ?? feature?.max;
  if (raw === undefined || raw === null || raw === "") return 999;
  return Number(raw) || 999;
}

function add2eGetActorClassFeatures(actor) {
  const sys = actor?.system ?? {};
  const details = sys.details_classe ?? {};
  const candidates =
    details.classFeatures ??
    details.capacitesClasse ??
    sys.classFeatures ??
    sys.capacitesClasse ??
    [];
  return add2eToClassFeatureArray(candidates);
}

function add2eGetActorActivableClassFeatures(actor, { includeLocked = true } = {}) {
  const level = Number(actor?.system?.niveau ?? 1) || 1;
  return add2eGetActorClassFeatures(actor).filter(f => {
    if (f?.activable !== true) return false;
    if (includeLocked) return true;
    return level >= add2eFeatureMinLevel(f) && level <= add2eFeatureMaxLevel(f);
  });
}

function add2eDatasetValue(dataset, keys) {
  if (!dataset) return undefined;
  for (const k of keys) {
    if (dataset[k] !== undefined && dataset[k] !== null && String(dataset[k]).trim() !== "") return dataset[k];
  }
  return undefined;
}

function add2eFeatureName(feature) {
  return String(feature?.name ?? feature?.label ?? feature?.title ?? feature?.nom ?? "").trim();
}

function add2eFeatureOnUse(feature) {
  return String(feature?.on_use ?? feature?.onUse ?? feature?.script ?? feature?.macro ?? "").trim();
}

function add2eFindClassFeatureFromElement(actor, element) {
  const allFeatures = add2eGetActorClassFeatures(actor);
  const activeFeatures = add2eGetActorActivableClassFeatures(actor);
  const el = element instanceof HTMLElement ? element : element?.[0];
  if (!el) return null;

  const holder = el.closest?.("[data-feature-index], [data-feature-name], [data-feature-id], [data-feature-key], [data-on-use]") ?? el;
  const ds = holder?.dataset ?? el?.dataset ?? {};

  const rawIndex = add2eDatasetValue(ds, ["featureIndex", "index", "idx"]);
  if (rawIndex !== undefined) {
    const idx = Number(rawIndex);
    if (Number.isInteger(idx)) {
      const byOriginalIndex = allFeatures[idx];
      if (byOriginalIndex?.activable === true) return byOriginalIndex;
      const byActiveIndex = activeFeatures[idx];
      if (byActiveIndex) return byActiveIndex;
    }
  }

  const rawOnUse = add2eDatasetValue(ds, ["onUse", "onuse", "on_use"]);
  if (rawOnUse !== undefined) {
    const wanted = String(rawOnUse).trim();
    const byScript = activeFeatures.find(f => add2eFeatureOnUse(f) === wanted);
    if (byScript) return byScript;
  }

  const rawId = add2eDatasetValue(ds, ["featureId", "featureKey", "id", "key"]);
  if (rawId !== undefined) {
    const wanted = add2eNormalizeEquipTag(rawId);
    const byId = activeFeatures.find(f => {
      const values = [f.id, f._id, f.key, f.slug, f.name, f.label, f.title, f.nom]
        .map(add2eNormalizeEquipTag)
        .filter(Boolean);
      return values.includes(wanted);
    });
    if (byId) return byId;
  }

  const rawName = add2eDatasetValue(ds, ["featureName", "name", "feature", "nom"]);
  if (rawName !== undefined) {
    const wanted = add2eNormalizeEquipTag(rawName);
    const byName = activeFeatures.find(f => add2eNormalizeEquipTag(add2eFeatureName(f)) === wanted);
    if (byName) return byName;
  }

  let cursor = el;
  for (let depth = 0; cursor && depth < 8; depth++, cursor = cursor.parentElement) {
    const text = add2eNormalizeEquipTag(cursor.textContent ?? "");
    if (!text || text === "utiliser") continue;

    const matches = activeFeatures.filter(f => {
      const n = add2eNormalizeEquipTag(add2eFeatureName(f));
      return n && text.includes(n);
    });

    if (matches.length === 1) return matches[0];
  }

  if (activeFeatures.length === 1) return activeFeatures[0];
  return null;
}

async function add2eExecuteClassFeatureOnUse(actor, feature, sheet = null) {
  if (!actor) {
    ui.notifications.error("Capacité de classe : acteur introuvable.");
    return false;
  }

  if (!feature) {
    ui.notifications.error("Capacité de classe introuvable dans les données de l'acteur.");
    return false;
  }

  const level = Number(actor.system?.niveau ?? 1) || 1;
  const min = add2eFeatureMinLevel(feature);
  const max = add2eFeatureMaxLevel(feature);
  const name = add2eFeatureName(feature) || "Capacité";

  if (level < min || level > max) {
    ui.notifications.warn(`La capacité « ${name} » n'est pas disponible au niveau ${level}.`);
    return false;
  }

  const onUse = add2eFeatureOnUse(feature);
  if (!onUse) {
    ui.notifications.warn(`La capacité « ${name} » n'a pas de script on_use.`);
    return false;
  }

  try {
    const url = onUse.includes("?") ? `${onUse}&cb=${Date.now()}` : `${onUse}?cb=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

    const code = await response.text();
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const runner = new AsyncFunction(
      "actor",
      "feature",
      "item",
      "sort",
      "game",
      "ui",
      "ChatMessage",
      "Roll",
      "foundry",
      "canvas",
      code
    );

    const result = await runner(actor, feature, feature, null, game, ui, ChatMessage, Roll, foundry, canvas);

    console.log("[ADD2E][CAPACITE][ON_USE]", {
      actor: actor.name,
      feature: name,
      onUse,
      result
    });

    sheet?._add2eRememberActiveTab?.();
    sheet?.render?.(false);
    return result !== false;
  } catch (err) {
    console.error("[ADD2E][CAPACITE][ON_USE][ERREUR]", { actor: actor.name, feature: name, onUse, err });
    ui.notifications.error(`Erreur pendant l'utilisation de « ${name} » : ${err.message}`);
    return false;
  }
}

async function add2eUseClassFeatureFromElement(actor, element, sheet = null) {
  const feature = add2eFindClassFeatureFromElement(actor, element);
  return add2eExecuteClassFeatureOnUse(actor, feature, sheet);
}

globalThis.add2eGetActorClassFeatures = add2eGetActorClassFeatures;
globalThis.add2eGetActorActivableClassFeatures = add2eGetActorActivableClassFeatures;
globalThis.add2eUseClassFeatureFromElement = add2eUseClassFeatureFromElement;

globalThis.add2eExecuteClassFeatureOnUse = add2eExecuteClassFeatureOnUse;

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.add2eToClassFeatureArray = add2eToClassFeatureArray; } catch (_e) {}
try { globalThis.add2eFeatureMinLevel = add2eFeatureMinLevel; } catch (_e) {}
try { globalThis.add2eFeatureMaxLevel = add2eFeatureMaxLevel; } catch (_e) {}
try { globalThis.add2eGetActorClassFeatures = add2eGetActorClassFeatures; } catch (_e) {}
try { globalThis.add2eGetActorActivableClassFeatures = add2eGetActorActivableClassFeatures; } catch (_e) {}
try { globalThis.add2eDatasetValue = add2eDatasetValue; } catch (_e) {}
try { globalThis.add2eFeatureName = add2eFeatureName; } catch (_e) {}
try { globalThis.add2eFeatureOnUse = add2eFeatureOnUse; } catch (_e) {}
try { globalThis.add2eFindClassFeatureFromElement = add2eFindClassFeatureFromElement; } catch (_e) {}
try { globalThis.add2eExecuteClassFeatureOnUse = add2eExecuteClassFeatureOnUse; } catch (_e) {}
try { globalThis.add2eUseClassFeatureFromElement = add2eUseClassFeatureFromElement; } catch (_e) {}
