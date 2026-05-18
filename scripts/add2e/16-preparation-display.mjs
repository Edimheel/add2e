// ============================================================
// ADD2E — Affichage compact des emplacements de préparation
// V25 : affichage strict par type de magie dans Résumé + Sorts.
// Format voulu : Druide : N1 0/1 N2 0/0 ; Magicien : N1 0/1.
// Le panneau est toujours reconstruit au rendu pour éviter les restes
// quand la classe est remplacée puis redéposée.
// ============================================================

// ============================================================
// ADD2E — Sorts : affichage natif HBS
// Les anciennes injections visuelles V24–V30 ont été supprimées.
// Le HBS affiche les sous-listes ; ce fichier conserve uniquement
// les données, la validation et les boutons + / -.
// ============================================================

function add2eBindNativeHbsSpellPreparationControls(actor, root) {
  if (!actor || !root) return;

  root.querySelectorAll(".a2e-spell-entry-plus, .a2e-spell-entry-minus").forEach(btn => {
    btn.onclick = async ev => {
      ev.preventDefault();
      ev.stopPropagation();

      const sortId = btn.dataset.sortId;
      const entryKey = add2eNormalizeSpellKey(btn.dataset.entryKey);
      const sort = actor.items.get(sortId);
      if (!sort) return ui.notifications.warn("Sort introuvable.");

      const entry = add2eGetSpellcastingEntries(actor).find(e => add2eNormalizeSpellKey(e.key) === entryKey);
      if (!entry) return ui.notifications.warn("Type de préparation introuvable.");

      const check = add2eCanActorUseSpell(actor, sort);
      const sortLists = add2eGetSpellListsFromItem(sort);
      const spellLevel = Number(sort.system?.niveau ?? sort.system?.level ?? 1) || 1;
      const actorLevel = Math.max(1, Number(actor.system?.niveau ?? 1) || 1);
      const startsAt = Number(entry.startsAt ?? 1) || 1;
      const maxSpellLevel = Number(entry.maxSpellLevel ?? 0) || 0;

      if (!sortLists.includes(entryKey)) return ui.notifications.warn(`Ce sort n'appartient pas à la liste ${entry.label}.`);
      if (actorLevel < startsAt) return ui.notifications.warn(`${entry.label} n'est disponible qu'à partir du niveau ${startsAt}.`);
      if (maxSpellLevel && spellLevel > maxSpellLevel) return ui.notifications.warn(`${entry.label} ne permet pas les sorts de niveau ${spellLevel}.`);
      if (!check.ok && add2eNormalizeSpellKey(check.entry?.key) !== entryKey) return ui.notifications.warn("Ce sort n'est pas autorisé pour cette classe.");

      let cur = add2eGetMemorizedCountForEntry(sort, entry);
      const isPlus = btn.classList.contains("a2e-spell-entry-plus");

      if (isPlus) {
        const limit = add2eGetSlotsForEntryLevel(actor, entry, spellLevel);
        const total = add2eCountPreparedForEntryLevel(actor, entry, spellLevel);
        if (limit <= 0) return ui.notifications.warn(`Aucun emplacement ${entry.label} de niveau ${spellLevel} disponible.`);
        if (total >= limit) return ui.notifications.warn(`Limite atteinte : ${entry.label} niveau ${spellLevel} (${total}/${limit}).`);
        cur++;
      } else {
        if (cur <= 0) return ui.notifications.warn(`Aucun sort ${entry.label} à retirer.`);
        cur--;
      }

      await add2eSetMemorizedCountForEntry(sort, entry, cur);
      add2eRerenderActorSheet(actor);
    };
  });
}

Hooks.on("renderActorSheet", (app, html) => {
  const actor = app?.actor ?? app?.document;
  const root = html?.[0] ?? html;
  setTimeout(() => add2eBindNativeHbsSpellPreparationControls(actor, root), 20);
  for (const delay of [40, 120, 260]) {
    setTimeout(() => {
      try {
        if (actor?.type === "personnage") add2eEnhanceCharacterSheetUi(app, html);
      } catch (err) {
        console.warn("[ADD2E][OBJETS_MAGIQUES][UI] Injection après rendu impossible.", err);
      }
    }, delay);
  }
});

Hooks.on("renderApplication", (app, html) => {
  const actor = app?.actor ?? app?.document;
  const root = html?.[0] ?? html;
  setTimeout(() => add2eBindNativeHbsSpellPreparationControls(actor, root), 20);
  for (const delay of [40, 120, 260]) {
    setTimeout(() => {
      try {
        if (actor?.type === "personnage") add2eEnhanceCharacterSheetUi(app, html);
      } catch (err) {
        console.warn("[ADD2E][OBJETS_MAGIQUES][UI] Injection application impossible.", err);
      }
    }, delay);
  }
});

console.log("ADD2E | Spell preparation native HBS V31 loaded");

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.add2eBindNativeHbsSpellPreparationControls = add2eBindNativeHbsSpellPreparationControls; } catch (_e) {}
