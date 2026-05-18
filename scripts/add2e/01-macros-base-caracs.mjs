async function createAdd2eMacro(data, slot) {
  let item = null;
  if (data.uuid) item = await fromUuid(data.uuid);
  if (!item || !item.type || !item.parent || item.parent.documentName !== "Actor") {
    ui.notifications.warn("Impossible de créer la macro : objet ou acteur introuvable.");
    console.warn("[ADD2e DEBUG] Impossible de créer la macro, item =", item);
    return;
  }
  // --- ARME ---
  if (item.type === "arme") {
    const uuid = item.uuid;
    const command = `
(async () => {
  const arme = await fromUuid("${uuid}");
  const actor = arme?.parent;
  if (actor && arme) {
    add2eAttackRoll({ actor, arme });
  } else {
    ui.notifications.warn("Arme ou personnage introuvable !");
  }
})();
    `.trim();

    let macro = await Macro.create({
      name: `[Attaque] ${item.parent.name} - ${item.name}`,
      type: "script",
      img: item.img || "icons/svg/sword.svg",
      command
    }, { renderSheet: false });
    game.user.assignHotbarMacro(macro, slot);
  }
  // --- SORT ---
  else if (item.type === "sort") {
    const uuid = item.uuid;
    const command = `
(async () => {
  const sort = await fromUuid("${uuid}");
  const actor = sort?.parent;
  if (actor && sort) {
    ui.notifications.info("Sort " + sort.name + " lancé pour " + actor.name + " !");
    // Tu peux mettre ici ta logique custom si besoin
  } else {
    ui.notifications.warn("Sort ou personnage introuvable !");
  }
})();
    `.trim();

    let macro = await Macro.create({
      name: `[Sort] ${item.parent.name} - ${item.name}`,
      type: "script",
      img: item.img || "icons/svg/book.svg",
      command
    }, { renderSheet: false });
    game.user.assignHotbarMacro(macro, slot);
  }
  // --- AUTRE TYPE ---
  else {
    ui.notifications.warn(`Type d'item non supporté pour macro : ${item.type}`);
    console.warn("[ADD2e DEBUG] Type d'item non supporté :", item.type, item);
  }
}

async function add2e_saveBaseCaracs(actor) {
  const CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
  let baseCaracs = {};
  for (const c of CARACS) {
    baseCaracs[c] = typeof actor.system?.[`${c}_base`] === "number" ? actor.system[`${c}_base`] : 10;
  }
 await actor.setFlag("add2e", "base_caracs", baseCaracs);
}

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.createAdd2eMacro = createAdd2eMacro; } catch (_e) {}
try { globalThis.add2e_saveBaseCaracs = add2e_saveBaseCaracs; } catch (_e) {}
