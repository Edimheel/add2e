// amitie.js - applique l'effet "Amitié" sur la cible (ou le lanceur)

async function runAmitie(actor, sort) {
  // --- Récupération robuste de l'item du sort ---
  let _item = null;

  // priorité : paramètre sort passé par le système (comme pour Agrandissement)
  if (sort && sort.name) {
    _item = sort;
  }
  // fallback : variable globale item (selon la façon dont la macro est exécutée)
  else if (typeof item !== "undefined" && item?.name) {
    _item = item;
  }
  // autre fallback : arguments[0].item ou arguments[1] (compat divers)
  else if (arguments?.length > 0 && arguments[0]?.item) {
    _item = arguments[0].item;
  } else if (arguments?.length > 1 && arguments[1]?.name) {
    _item = arguments[1];
  }

  if (!_item) {
    ui.notifications.warn("Impossible de trouver l'item du sort Amitié.");
    return false; // => ne pas consommer le sort
  }

  // --- Récupération de l'acteur lanceur ---
  let sourceActor = actor ?? _item?.parent;
  if (!sourceActor) {
    ui.notifications.warn("Impossible de trouver l'acteur lanceur pour Amitié.");
    return false; // => ne pas consommer le sort
  }

  // --- Cible : premier target si présent, sinon le lanceur ---
  const targets = Array.from(game.user?.targets || []);
  const targetActor = targets[0]?.actor ?? sourceActor;

  if (!targetActor) {
    ui.notifications.warn("Impossible de déterminer la cible pour Amitié.");
    return false; // => ne pas consommer le sort
  }

  // --- Nettoyage des anciens effets "Amitié" ---
  const labelMatch = "amitie";
  const existing = targetActor.effects.filter(e =>
    (e.label || e.name || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .includes(labelMatch)
  );
  if (existing.length) {
    await targetActor.deleteEmbeddedDocuments("ActiveEffect", existing.map(e => e.id));
  }

  // --- Récupération des effets embarqués dans le sort ---
  let effects = [];
  if (_item.effects && typeof _item.effects.contents === "object") {
    // Collection EmbeddedDocuments (v10+)
    effects = Array.from(_item.effects.contents);
  } else if (Array.isArray(_item.effects)) {
    // Tableau brut
    effects = _item.effects;
  } else if (_item.data?.effects) {
    // Compat ancien format
    effects = _item.data.effects;
  }

  if (!effects.length) {
    ui.notifications.warn("Aucun effet à appliquer depuis le sort Amitié.");
    return false; // => ne pas consommer le sort
  }

  // --- Application des effets sur la cible ---
  for (let effect of effects) {
    let data = foundry.utils.duplicate(effect.toObject ? effect.toObject() : effect);
    // on s'assure que la cible est bien la bonne et qu'on ne transfère pas
    data.origin = _item.uuid ?? data.origin ?? "";
    await targetActor.createEmbeddedDocuments("ActiveEffect", [data]);
  }

  ui.notifications.info(`${targetActor.name} est maintenant sous l'effet d'Amitié.`);

  // Sort correctement lancé => ok pour décrémenter l'utilisation
  return true;
}

// Important : respecter le même schéma que "Agrandissement"
return runAmitie(actor, sort);
