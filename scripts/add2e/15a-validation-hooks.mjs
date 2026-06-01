// ADD2E — Validation hooks et compatibilité legacy.

Hooks.once("ready", () => {
  add2eRegisterClassItemSheet();

  const clearClassSheetCache = (item) => {
    if (!item || item.type !== "classe") return;

    if (item._sheet && !(item._sheet instanceof Add2eItemSheet)) {
      console.warn("[ADD2E][SHEETS] Cache de fiche classe incorrect vidé", {
        item: item.name,
        cachedSheet: item._sheet?.constructor?.name,
        expected: Add2eItemSheet?.name
      });
      item._sheet = null;
    }
  };

  for (const item of game.items ?? []) clearClassSheetCache(item);

  for (const actor of game.actors ?? []) {
    for (const item of actor.items ?? []) clearClassSheetCache(item);
  }

  console.log("[ADD2E][SHEETS] Contrôle Item.classe", {
    importedClassSheet: Add2eItemSheet?.name,
    exampleWorldClassSheet: game.items.find(i => i.type === "classe")?.sheet?.constructor?.name ?? null,
    exampleEmbeddedClassSheet: game.actors.find(a => a.items?.some(i => i.type === "classe"))?.items?.find(i => i.type === "classe")?.sheet?.constructor?.name ?? null
  });
});

Hooks.on("preCreateItem", (itemData, options, userId) => {
  if (itemData.type === "sort" && Array.isArray(itemData.effects)) {
    for (let eff of itemData.effects) {
      eff.transfer = false;
      eff.disabled = true;
    }
  }
});

async function rollInitiativeD6(combatants) {
  if (!combatants.length) return;

  for (const comb of combatants) {
    const roll = await new Roll("1d6").evaluate({ async: true });

    if (comb.actor) await comb.actor.update({ "system.initiative": roll.total });
    await comb.update({ initiative: roll.total });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: comb.actor }),
      content: `Initiative : <b>${roll.total}</b> (1d6)`,
      flavor: "Initiative"
    });
  }
}

Hooks.on("deleteItem", async (item, options, userId) => {
  if (game.user.id !== userId) return;
  if (!item.parent || item.parent.documentName !== "Actor") return;

  const actor = item.parent;
  const effectsToDelete = actor.effects
    .filter(e => item.type === "classe" ? add2eShouldDeleteEffectForClassPurge(e, [item]) : e.origin === item.uuid)
    .map(e => e.id);

  if (effectsToDelete.length > 0) {
    console.log(`[ADD2e] Suppression des effets liés à l'objet supprimé : ${item.name}`);
    await actor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete);
    ui.notifications.info(`Les effets de ${item.name} se sont dissipés.`);
  }
});

try { globalThis.rollInitiativeD6 = rollInitiativeD6; } catch (_e) {}
