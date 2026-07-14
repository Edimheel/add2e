// ADD2E — Actor sheet drop — chargeur court
// Version : 2026-07-14-magic-item-identification-name-sync-v1
//
// Le contenu de la mécanique de drop est dans 13e-actor-sheet-drop-legacy-full.mjs.
// Ce chargeur synchronise également le nom visible des objets magiques identifiés/non identifiés.

function add2eIdentificationGetProperty(source, path) {
  try {
    if (foundry?.utils?.getProperty) return foundry.utils.getProperty(source, path);
  } catch (_error) {}
  return String(path).split(".").reduce((value, key) => value?.[key], source);
}

function add2eIdentificationHasProperty(source, path) {
  try {
    if (foundry?.utils?.hasProperty) return foundry.utils.hasProperty(source, path);
  } catch (_error) {}
  const parts = String(path).split(".");
  let value = source;
  for (const key of parts) {
    if (!value || !Object.prototype.hasOwnProperty.call(value, key)) return false;
    value = value[key];
  }
  return true;
}

function add2eIdentificationMagicItem(item, source = null) {
  const system = source?.system ?? item?.system ?? {};
  const flags = source?.flags?.add2e ?? item?.flags?.add2e ?? {};
  const tags = [system.tags, system.effectTags]
    .flatMap(value => Array.isArray(value) ? value : (value ? [value] : []))
    .map(value => String(value ?? "").toLowerCase());

  return system.magique === true
    || system.magic === true
    || flags.isMagicItem === true
    || String(system.categorie ?? "").toLowerCase().includes("magique")
    || tags.some(tag => tag.includes("objet_magique") || tag.includes("magique"));
}

function add2eIdentificationGenericName(item, source = null) {
  const system = source?.system ?? item?.system ?? {};
  return String(
    system.nom_non_identifie
    ?? system.unidentifiedName
    ?? system.sousType
    ?? system.sous_type
    ?? "Objet magique"
  ).trim() || "Objet magique";
}

function add2eIdentificationTrueName(item, source = null) {
  const system = source?.system ?? item?.system ?? {};
  return String(
    system.nom
    ?? system.nom_reel
    ?? system.trueName
    ?? source?.name
    ?? item?.name
    ?? "Objet magique"
  ).trim() || "Objet magique";
}

Hooks.on("preCreateItem", (item, data, options, userId) => {
  if (item?.parent?.documentName !== "Actor") return;
  if (!add2eIdentificationMagicItem(item, data)) return;

  const identified = data?.system?.identifie === true || data?.system?.identified === true;
  const genericName = add2eIdentificationGenericName(item, data);
  const trueName = add2eIdentificationTrueName(item, data);
  const update = {
    "system.nom": trueName,
    name: identified ? trueName : genericName
  };

  item.updateSource(update);

  console.log("[ADD2E][IDENTIFICATION][PRE_CREATE]", {
    actor: item.parent?.name,
    sourceName: data?.name,
    trueName,
    genericName,
    identified,
    visibleName: update.name,
    userId,
    options
  });
});

Hooks.on("preUpdateItem", (item, changed, options, userId) => {
  if (item?.parent?.documentName !== "Actor") return;
  if (!add2eIdentificationMagicItem(item)) return;

  const identificationChanged = add2eIdentificationHasProperty(changed, "system.identifie")
    || add2eIdentificationHasProperty(changed, "system.identified");
  const nameChanged = Object.prototype.hasOwnProperty.call(changed ?? {}, "name");
  if (!identificationChanged && !nameChanged) return;

  const identified = identificationChanged
    ? (add2eIdentificationGetProperty(changed, "system.identifie") === true
      || add2eIdentificationGetProperty(changed, "system.identified") === true)
    : (item.system?.identifie === true || item.system?.identified === true);

  const genericName = add2eIdentificationGenericName(item);
  let trueName = String(item.system?.nom ?? item.system?.nom_reel ?? item.system?.trueName ?? "").trim();

  if (!trueName) {
    const currentName = String(item.name ?? "").trim();
    trueName = currentName && currentName !== genericName ? currentName : "Objet magique";
    foundry.utils.setProperty(changed, "system.nom", trueName);
  }

  if (nameChanged && identified) {
    const requestedName = String(changed.name ?? "").trim();
    if (requestedName) {
      trueName = requestedName;
      foundry.utils.setProperty(changed, "system.nom", requestedName);
    }
  }

  changed.name = identified ? trueName : genericName;

  console.log("[ADD2E][IDENTIFICATION][PRE_UPDATE]", {
    actor: item.parent?.name,
    itemId: item.id,
    currentName: item.name,
    trueName,
    genericName,
    identified,
    visibleName: changed.name,
    identificationChanged,
    nameChanged,
    userId,
    options
  });
});

Hooks.on("createItem", (item, options, userId) => {
  if (item?.parent?.documentName !== "Actor" || !add2eIdentificationMagicItem(item)) return;
  console.log("[ADD2E][IDENTIFICATION][CREATED]", {
    actor: item.parent?.name,
    itemId: item.id,
    name: item.name,
    trueName: item.system?.nom,
    genericName: add2eIdentificationGenericName(item),
    identified: item.system?.identifie === true || item.system?.identified === true,
    userId,
    options
  });
});

Hooks.on("updateItem", (item, changed, options, userId) => {
  if (item?.parent?.documentName !== "Actor" || !add2eIdentificationMagicItem(item)) return;
  if (!add2eIdentificationHasProperty(changed, "system.identifie")
    && !add2eIdentificationHasProperty(changed, "system.identified")
    && !Object.prototype.hasOwnProperty.call(changed ?? {}, "name")) return;

  console.log("[ADD2E][IDENTIFICATION][UPDATED]", {
    actor: item.parent?.name,
    itemId: item.id,
    name: item.name,
    trueName: item.system?.nom,
    genericName: add2eIdentificationGenericName(item),
    identified: item.system?.identifie === true || item.system?.identified === true,
    changed,
    userId,
    options
  });

  item.parent?.sheet?.render?.({ force: true });
});

import "./13e-actor-sheet-drop-legacy-full.mjs";
