// resistance.js - applique le bonus de sauvegarde sur la cible (ou le lanceur)

let _item = null;
if (typeof item !== "undefined" && item?.name) {
  _item = item;
} else if (arguments?.length > 1 && arguments[1]?.name) {
  _item = arguments[1];
} else {
  ui.notifications.warn("Impossible de trouver l'item du sort Résistance.");
  return false;
}

let sourceActor = actor ?? _item?.parent;
if (!sourceActor) {
  ui.notifications.warn("Impossible de trouver l'acteur lanceur pour Résistance.");
  return false;
}

// Cible : premier target si présent, sinon lanceur
let targets = Array.from(game.user?.targets || []);
let targetActor = targets[0]?.actor ?? sourceActor;

// Nettoyage
const existing = targetActor.effects.filter(e =>
  (e.label || e.name || "").toLowerCase().includes("résistance") ||
  (e.label || e.name || "").toLowerCase().includes("resistance")
);
if (existing.length) {
  await targetActor.deleteEmbeddedDocuments("ActiveEffect", existing.map(e => e.id));
}

// Récupération effets (peut être dans effects OU via flags.add2e.tags)
let effects = [];
if (_item.effects && typeof _item.effects.contents === "object") {
  effects = Array.from(_item.effects.contents);
} else if (Array.isArray(_item.effects)) {
  effects = _item.effects;
} else if (_item.data?.effects) {
  effects = _item.data.effects;
}

if (!effects.length && _item.system?.flags?.add2e?.tags) {
  // Si tu veux, tu peux créer dynamiquement un ActiveEffect ici à partir des tags
  const effectData = {
    label: "Résistance",
    icon: _item.img,
    flags: { add2e: { tags: _item.system.flags.add2e.tags } },
    duration: { rounds: 10, startRound: null }
  };
  effects = [effectData];
}

if (!effects.length) {
  ui.notifications.warn("Aucun effet à appliquer depuis le sort Résistance.");
  return false;
}

// Application
for (let effect of effects) {
  let data = foundry.utils.duplicate(effect.toObject ? effect.toObject() : effect);
  await targetActor.createEmbeddedDocuments("ActiveEffect", [data]);
}

ui.notifications.info(`${targetActor.name} bénéficie d'un bonus de Résistance.`);
return true;
