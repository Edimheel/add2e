// serviteur_invisible.js - applique l'état "Serviteur invisible" au lanceur (pour suivi)

let _item = null;
if (typeof item !== "undefined" && item?.name) {
  _item = item;
} else if (arguments?.length > 1 && arguments[1]?.name) {
  _item = arguments[1];
} else {
  ui.notifications.warn("Impossible de trouver l'item du sort Serviteur invisible.");
  return false;
}

let sourceActor = actor ?? _item?.parent;
if (!sourceActor) {
  ui.notifications.warn("Impossible de trouver l'acteur lanceur pour Serviteur invisible.");
  return false;
}

// Nettoyage
const existing = sourceActor.effects.filter(e =>
  (e.label || e.name || "").toLowerCase().includes("serviteur invisible")
);
if (existing.length) {
  await sourceActor.deleteEmbeddedDocuments("ActiveEffect", existing.map(e => e.id));
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
  ui.notifications.warn("Aucun effet à appliquer depuis le sort Serviteur invisible.");
  return false;
}

// Application
for (let effect of effects) {
  let data = foundry.utils.duplicate(effect.toObject ? effect.toObject() : effect);
  await sourceActor.createEmbeddedDocuments("ActiveEffect", [data]);
}

ui.notifications.info(`${sourceActor.name} est assisté par un serviteur invisible.`);
return true;
