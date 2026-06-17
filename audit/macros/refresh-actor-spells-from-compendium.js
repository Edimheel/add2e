// ADD2E — Rafraîchir les sorts d'un acteur depuis le compendium
// Version : 2026-06-17-refresh-actor-spells-from-compendium-v1
//
// Fonction :
// - met à jour les sorts déjà présents sur un ou plusieurs acteurs depuis le compendium add2e.sorts ;
// - conserve les préparations/mémorisations de l'acteur ;
// - ne crée pas de nouveaux sorts ;
// - ne supprime aucun sort ;
// - utile après réimport d'un compendium de sorts normalisé ;
// - DialogV2 uniquement.

(async () => {
  const VERSION = "2026-06-17-refresh-actor-spells-from-compendium-v1";
  const TAG = "[ADD2E][REFRESH_ACTOR_SPELLS]";
  const DEFAULT_PACK = "add2e.sorts";

  if (!game.user?.isGM) {
    ui.notifications.error("Seul le MJ peut rafraîchir les sorts d'un acteur.");
    return;
  }

  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications.error("DialogV2 introuvable.");
    return;
  }

  const clone = value => {
    try {
      if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
      if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
      return JSON.parse(JSON.stringify(value));
    } catch (_err) {
      return value;
    }
  };

  const slug = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  function makeKey(item) {
    const sys = item?.system ?? {};
    return [
      slug(item?.name ?? sys.nom),
      slug(item?.type ?? sys.type ?? "sort"),
      slug(sys.classe),
      String(sys.niveau ?? "")
    ].join("|");
  }

  function makeNameKey(item) {
    const sys = item?.system ?? {};
    return [slug(item?.name ?? sys.nom), slug(sys.classe), String(sys.niveau ?? "")].join("|");
  }

  function selectedActors() {
    const actors = [];
    for (const token of canvas?.tokens?.controlled ?? []) {
      if (token?.actor && !actors.some(a => a.id === token.actor.id)) actors.push(token.actor);
    }
    return actors;
  }

  function actorOptions() {
    const controlled = new Set(selectedActors().map(a => a.id));
    return game.actors
      .filter(actor => actor.type === "personnage")
      .sort((a, b) => a.name.localeCompare(b.name, "fr"))
      .map(actor => `<option value="${actor.id}" ${controlled.has(actor.id) ? "selected" : ""}>${actor.name}${controlled.has(actor.id) ? " — sélectionné" : ""}</option>`)
      .join("");
  }

  async function loadPackIndex(packId) {
    const pack = game.packs.get(packId);
    if (!pack) throw new Error(`Compendium introuvable : ${packId}`);
    if (pack.documentName !== "Item") throw new Error(`${packId} n'est pas un compendium d'objets.`);

    const docs = await pack.getDocuments();
    const byImportKey = new Map();
    const byNameKey = new Map();

    for (const doc of docs) {
      if (doc.type !== "sort") continue;
      const data = doc.toObject();
      const importKey = doc.flags?.add2e?.importKey || data.flags?.add2e?.importKey || makeKey(data);
      if (importKey && !byImportKey.has(importKey)) byImportKey.set(importKey, data);
      const nameKey = makeNameKey(data);
      if (nameKey && !byNameKey.has(nameKey)) byNameKey.set(nameKey, data);
    }

    return { byImportKey, byNameKey, count: docs.filter(d => d.type === "sort").length };
  }

  function buildUpdateFromCompendium(actorSpell, compendiumData) {
    const oldFlags = clone(actorSpell.flags ?? {});
    const oldAdd2eFlags = clone(actorSpell.flags?.add2e ?? {});
    const newSystem = clone(compendiumData.system ?? {});
    const newFlags = clone(compendiumData.flags ?? {});

    newFlags.add2e ??= {};

    for (const key of [
      "memorizedByList",
      "memorizedCount",
      "preparedByList",
      "preparedCount",
      "sourceActorId",
      "sourceClassId"
    ]) {
      if (oldAdd2eFlags[key] !== undefined) newFlags.add2e[key] = clone(oldAdd2eFlags[key]);
    }

    // Conserver les flags non add2e que Foundry ou des modules auraient ajoutés sur l'acteur.
    for (const [scope, value] of Object.entries(oldFlags)) {
      if (scope === "add2e") continue;
      if (newFlags[scope] === undefined) newFlags[scope] = clone(value);
    }

    return {
      _id: actorSpell.id,
      name: compendiumData.name || actorSpell.name,
      img: compendiumData.img || actorSpell.img,
      system: newSystem,
      flags: newFlags
    };
  }

  async function refreshActor(actor, packIndex, options) {
    const actorSpells = actor.items.filter(item => item.type === "sort");
    const updates = [];
    const missing = [];

    for (const spell of actorSpells) {
      const data = spell.toObject();
      const importKey = spell.flags?.add2e?.importKey || data.flags?.add2e?.importKey || makeKey(data);
      const nameKey = makeNameKey(data);
      const compendiumData = packIndex.byImportKey.get(importKey) || packIndex.byNameKey.get(nameKey);

      if (!compendiumData) {
        missing.push(spell.name);
        continue;
      }

      updates.push(buildUpdateFromCompendium(spell, compendiumData));
    }

    if (!options.dryRun && updates.length) {
      await actor.updateEmbeddedDocuments("Item", updates, { render: false });
      for (const app of Object.values(ui.windows ?? {})) {
        const appActor = app?.actor ?? app?.document ?? app?.object;
        if (appActor?.id === actor.id && app?.render) app.render(true);
      }
    }

    return { actor: actor.name, spells: actorSpells.length, updates: updates.length, missing };
  }

  const result = await DialogV2.wait({
    window: { title: "ADD2E — Rafraîchir les sorts d'acteur" },
    content: `
      <form>
        <div class="form-group">
          <label>Compendium source</label>
          <input type="text" name="packId" value="${DEFAULT_PACK}" style="width:100%;" />
        </div>
        <div class="form-group">
          <label>Acteurs à rafraîchir</label>
          <select name="actorIds" multiple size="10" style="width:100%;">
            ${actorOptions()}
          </select>
          <p class="notes">Les tokens sélectionnés sont précochés. Utilise Ctrl+clic pour plusieurs acteurs.</p>
        </div>
        <div class="form-group">
          <label><input type="checkbox" name="dryRun" checked /> Simulation seulement</label>
        </div>
        <p class="notes">Cette macro met à jour uniquement les sorts déjà présents sur l'acteur. Elle conserve les préparations/mémorisations.</p>
      </form>
    `,
    buttons: [
      {
        action: "refresh",
        label: "Rafraîchir",
        icon: "fas fa-sync",
        default: true,
        callback: (_event, button) => {
          const form = button.form;
          const ids = Array.from(form.elements.actorIds.selectedOptions).map(option => option.value);
          if (!ids.length) {
            ui.notifications.warn("Aucun acteur sélectionné.");
            return null;
          }
          return {
            packId: form.elements.packId.value || DEFAULT_PACK,
            actorIds: ids,
            dryRun: form.elements.dryRun.checked
          };
        }
      },
      { action: "cancel", label: "Annuler", icon: "fas fa-times", callback: () => null }
    ]
  });

  if (!result) return;

  try {
    const packIndex = await loadPackIndex(result.packId);
    const reports = [];
    for (const actorId of result.actorIds) {
      const actor = game.actors.get(actorId);
      if (!actor) continue;
      reports.push(await refreshActor(actor, packIndex, result));
    }

    console.group(`${TAG}[RESULT] ${VERSION}`);
    console.log({ pack: result.packId, packSpellCount: packIndex.count, dryRun: result.dryRun, reports });
    console.groupEnd();

    const totalUpdates = reports.reduce((sum, report) => sum + report.updates, 0);
    ui.notifications.info(`${result.dryRun ? "Simulation" : "Rafraîchissement"} terminé : ${totalUpdates} sort(s) à mettre à jour / mis à jour. Voir console.`);
  } catch (err) {
    console.error(`${TAG}[FATAL]`, err);
    ui.notifications.error(`Erreur rafraîchissement sorts : ${err.message}`);
  }
})();
