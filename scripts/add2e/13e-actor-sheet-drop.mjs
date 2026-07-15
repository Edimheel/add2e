// ADD2E — Actor sheet drop — chargeur court
// Version : 2026-07-15-magic-item-identification-type-scope-v4
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
  const itemType = String(source?.type ?? item?.type ?? "").trim().toLowerCase();
  if (!["arme", "armure", "objet"].includes(itemType)) return false;

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

function add2eIdentificationIsIdentified(item, source = null) {
  const system = source?.system ?? item?.system ?? {};
  return system.identifie === true
    || system.identified === true
    || item?.getFlag?.("add2e", "identified") === true;
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

function add2eIdentificationFindActorItem(itemId, root = null) {
  const actorId = root?.dataset?.actorId
    ?? root?.closest?.("[data-actor-id]")?.dataset?.actorId
    ?? "";
  if (actorId) {
    const actor = game.actors?.get?.(actorId);
    const item = actor?.items?.get?.(itemId);
    if (item) return item;
  }

  for (const actor of game.actors ?? []) {
    const item = actor?.items?.get?.(itemId);
    if (item) return item;
  }
  return null;
}

function add2eIdentificationBlockOpen(item, source = "unknown") {
  if (game.user?.isGM) return false;
  if (!item || !add2eIdentificationMagicItem(item) || add2eIdentificationIsIdentified(item)) return false;

  console.warn("[ADD2E][IDENTIFICATION][OPEN_BLOCKED]", {
    source,
    actor: item.parent?.name,
    actorId: item.parent?.id,
    itemId: item.id,
    visibleName: item.name,
    genericName: add2eIdentificationGenericName(item),
    identified: false,
    user: game.user?.name,
    userId: game.user?.id
  });

  ui.notifications.warn("Cet objet doit être identifié avant de pouvoir être examiné.");
  return true;
}

function add2eInstallUnidentifiedItemOpenGuard() {
  if (globalThis.__add2eUnidentifiedItemOpenGuardV2) return;
  globalThis.__add2eUnidentifiedItemOpenGuardV2 = true;

  document.addEventListener("click", event => {
    if (game.user?.isGM) return;

    const trigger = event.target?.closest?.(
      ".objet-edit, .armure-edit, .arme-edit, [data-action='edit'], [data-action='open'], [data-action='item-edit'], [data-action='item-open']"
    );
    if (!trigger) return;

    const row = trigger.closest?.(".item, [data-item-id]");
    const itemId = String(
      trigger.dataset?.itemId
      ?? row?.dataset?.itemId
      ?? row?.dataset?.itemid
      ?? ""
    ).trim();
    if (!itemId) return;

    const item = add2eIdentificationFindActorItem(itemId, trigger);
    if (!add2eIdentificationBlockOpen(item, "dom-click")) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);
}

function add2eInstallItemSheetRenderGuard() {
  if (globalThis.__add2eUnidentifiedItemSheetRenderGuardV1) return;

  const classes = [
    globalThis.Add2eObjetSheet,
    globalThis.Add2eArmeSheet,
    globalThis.Add2eArmureSheet
  ].filter(Boolean);

  if (!classes.length) {
    console.warn("[ADD2E][IDENTIFICATION][RENDER_GUARD_WAIT] Feuilles Item ApplicationV2 indisponibles.");
    return;
  }

  let patched = 0;
  for (const SheetClass of classes) {
    const proto = SheetClass?.prototype;
    if (!proto || proto.__add2eUnidentifiedRenderGuardV1) continue;

    const originalRender = proto.render;
    if (typeof originalRender !== "function") continue;

    proto.__add2eUnidentifiedRenderGuardV1 = true;
    proto.__add2eOriginalRenderBeforeIdentificationGuard = originalRender;

    proto.render = function add2eRenderWithIdentificationGuard(options = {}) {
      const item = this.item ?? this.document ?? this.object ?? null;
      if (add2eIdentificationBlockOpen(item, "sheet-render")) return this;
      return originalRender.call(this, options);
    };

    patched += 1;
  }

  if (patched > 0) {
    globalThis.__add2eUnidentifiedItemSheetRenderGuardV1 = true;
    console.log("[ADD2E][IDENTIFICATION][RENDER_GUARD_READY]", {
      patched,
      classes: classes.map(cls => cls.name)
    });
  }
}

add2eInstallUnidentifiedItemOpenGuard();
Hooks.once("ready", add2eInstallItemSheetRenderGuard);

Hooks.on("preCreateItem", (item, data, options, userId) => {
  if (item?.parent?.documentName !== "Actor") return;
  if (!add2eIdentificationMagicItem(item, data)) return;

  const identified = add2eIdentificationIsIdentified(item, data);
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
    : add2eIdentificationIsIdentified(item);

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
    identified: add2eIdentificationIsIdentified(item),
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
    identified: add2eIdentificationIsIdentified(item),
    changed,
    userId,
    options
  });

  item.parent?.sheet?.render?.({ force: true });
});

import "./13e-actor-sheet-drop-legacy-full.mjs";
