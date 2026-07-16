// ADD2E — OnUse générique : Contre-poison
// Compatible Foundry V13/V14/V15.
// Utilisé par le sort et par les objets magiques qui reprennent ce sort.
// Retour attendu : true = utilisation consommée, false = utilisation non consommée.

try {
  const Engine = globalThis.ADD2E_EFFECTS_ENGINE;
  const sourceActor = actor ?? token?.actor ?? args?.[0]?.actor ?? null;
  const sourceItem = item ?? args?.[0]?.item ?? args?.[0]?.sourceItem ?? null;

  if (!sourceActor) {
    ui.notifications?.warn?.("Contre-poison : acteur introuvable.");
    return false;
  }

  const targetedActors = Array.from(game.user?.targets ?? [])
    .map(target => target?.actor)
    .filter(Boolean);
  const targets = targetedActors.length ? targetedActors : [sourceActor];

  const poisonMatchers = new Set([
    "etat:poison",
    "etat_poison",
    "poison",
    "empoisonne",
    "empoisonnee",
    "condition:poison",
    "condition_poison"
  ]);

  const normalize = value => {
    if (Engine?.normalizeTag) return Engine.normalizeTag(value);
    return String(value ?? "").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/\s+/g, "_");
  };

  let removed = 0;
  const affected = [];

  for (const targetActor of targets) {
    const effectIds = [];

    for (const effect of targetActor.effects ?? []) {
      if (!effect || effect.disabled) continue;

      const tags = [];
      if (Engine?.addEffectTagsInto) Engine.addEffectTagsInto(tags, effect);
      else {
        tags.push(...(effect.flags?.add2e?.tags ?? []));
        tags.push(...(effect.flags?.add2e?.effectTags ?? []));
      }

      const normalizedTags = tags.map(normalize);
      const normalizedName = normalize(effect.name ?? "");

      const isPoison = normalizedTags.some(tag =>
        poisonMatchers.has(tag)
        || tag.includes("etat:poison")
        || tag.includes("condition:poison")
        || tag === "retire:poison"
      ) || normalizedName.includes("poison") || normalizedName.includes("empoison");

      if (isPoison) effectIds.push(effect.id);
    }

    if (effectIds.length) {
      await targetActor.deleteEmbeddedDocuments("ActiveEffect", effectIds);
      removed += effectIds.length;
      affected.push(targetActor.name);
    }
  }

  const sourceName = sourceItem?.name ?? "Contre-poison";
  const targetNames = targets.map(target => target.name).join(", ");
  const resultText = removed > 0
    ? `${removed} effet(s) de poison retiré(s).`
    : "Aucun effet de poison actif n’a été trouvé.";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: sourceActor, token }),
    content: `
      <div class="add2e-chat-card add2e-objet-magique">
        <header class="card-header flexrow">
          <img src="${sourceItem?.img ?? "icons/consumables/potions/potion-bottle-corked-green.webp"}"
               width="36" height="36" alt="${sourceName}">
          <h3>${sourceName}</h3>
        </header>
        <div class="card-content">
          <p><strong>Cible :</strong> ${targetNames}</p>
          <p><strong>Résultat :</strong> ${resultText}</p>
        </div>
      </div>`
  });

  if (removed > 0) ui.notifications?.info?.(`Contre-poison : ${removed} effet(s) retiré(s).`);
  else ui.notifications?.info?.("Contre-poison : aucun effet de poison actif.");

  return true;
} catch (error) {
  console.error("[ADD2E][SORT][CONTRE_POISON]", error);
  ui.notifications?.error?.("Erreur lors de l’exécution de Contre-poison.");
  return false;
}
