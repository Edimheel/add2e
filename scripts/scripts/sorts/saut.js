// saut.js - applique l'effet de saut amélioré sur la cible (ou le lanceur)

let _item = null;
if (typeof item !== "undefined" && item?.name) {
  _item = item;
} else if (arguments?.length > 1 && arguments[1]?.name) {
  _item = arguments[1];
} else {
  ui.notifications.warn("Impossible de trouver l'item du sort Saut.");
  return false;
}

let sourceActor = actor ?? _item?.parent;
if (!sourceActor) {
  ui.notifications.warn("Impossible de trouver l'acteur lanceur pour Saut.");
  return false;
}

// Cible : premier target si présent, sinon lanceur
let targets = Array.from(game.user?.targets || []);
let targetActor = targets[0]?.actor ?? sourceActor;

// Nettoyage
const existing = targetActor.effects.filter(e =>
  (e.label || e.name || "").toLowerCase().includes("saut")
);
if (existing.length) {
  await targetActor.deleteEmbeddedDocuments("ActiveEffect", existing.map(e => e.id));
}

// Récupération effets
let effects = [];
if (_item.effects && typeof _item.effects.contents === "object") {
  effects = Array.from(_item.effects.contents);
} else if (Array.isArray(_item.effects)) {
  effects = _item.effects;
} else if (_item.data?.effects) {
  effects = _item.data.effects;
}
if (!effects.length) {
  ui.notifications.warn("Aucun effet à appliquer depuis le sort Saut.");
  return false;
}

// Application
for (let effect of effects) {
  let data = foundry.utils.duplicate(effect.toObject ? effect.toObject() : effect);
  await targetActor.createEmbeddedDocuments("ActiveEffect", [data]);
}

ui.notifications.info(`${targetActor.name} peut effectuer des sauts prodigieux.`);
return true;
