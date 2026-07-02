// ADD2E — Actor sheet listeners : sorts, mémorisation et pouvoirs d'objets.

export function add2eBindActorSheetSpellListeners(sheet, html) {
  const self = sheet;
  const actorId = String(sheet.actor?.id ?? "");

  // 16-preparation-display.mjs résout le sort depuis le bouton après un rendu.
  // L'acteur de la feuille est donc inscrit explicitement, sans dépendre du token sélectionné.
  if (actorId) {
    html.attr("data-actor-id", actorId);
    html.find(".a2e-spell-entry-plus, .a2e-spell-entry-minus, .sort-memorize-plus, .sort-memorize-minus").attr("data-actor-id", actorId);
  }

  html.find('.toggle-sort-desc-chat').off('click').on('click', function(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    const sortId = $(this).data('sort-id');
    const descRow = html.find(`#desc-chat-${sortId}`);
    descRow.slideToggle(160);
    return false;
  });

  html.find('.sort-edit').off().on('click', function(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    const sortId = $(this).data('sort-id');
    const sort = self.actor.items.get(sortId);
    if (sort) sort.sheet.render(true);
    return false;
  });

  html.find('.sort-delete').off().on('click', async function(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    const sortId = $(this).data('sort-id');
    await self.actor.deleteEmbeddedDocuments("Item", [sortId]);
    add2eRerenderActorSheet(self.actor);
    return false;
  });

  html.find('.sort-memorize-plus, .sort-memorize-minus').off('click').on('click', async ev => {
    ev.preventDefault();
    ev.stopPropagation();

    const $btn = $(ev.currentTarget);
    const sortId = $btn.data('sort-id');
    const sort = sheet.actor.items.get(sortId);
    if (!sort) return;

    const isPlus = $btn.hasClass('sort-memorize-plus');
    const niv = Number(sort.system?.niveau ?? sort.system?.level ?? 1) || 1;
    const requestedEntryKey = add2eNormalizeSpellKey($btn.data('spell-entry-key') || $btn.attr('data-spell-entry-key') || "");

    let check = add2eCanActorUseSpell(sheet.actor, sort);

    if (requestedEntryKey) {
      const entries = add2eGetSpellcastingEntries(sheet.actor);
      const sortLists = add2eGetSpellListsFromItem(sort);
      const requestedEntry = entries.find(e => add2eNormalizeSpellKey(e.key) === requestedEntryKey) || null;

      if (!requestedEntry || !sortLists.includes(requestedEntryKey)) return ui.notifications.warn(`Ce sort ne peut pas être préparé comme ${requestedEntry?.label || requestedEntryKey}.`);

      const actorLevel = Math.max(1, Number(sheet.actor?.system?.niveau) || 1);
      const startsAt = Number(requestedEntry.startsAt || 1);
      const maxLevel = Number(requestedEntry.maxSpellLevel || 0);

      if (actorLevel < startsAt) return ui.notifications.warn(`${requestedEntry.label || "Cette ligne de sorts"} n'est disponible qu'à partir du niveau ${startsAt}.`);
      if (maxLevel && niv > maxLevel) return ui.notifications.warn(`${requestedEntry.label || "Cette ligne de sorts"} ne permet pas les sorts de niveau ${niv}.`);

      check = { ok: true, reason: "ok", entry: requestedEntry };
    }

    if (!check.ok) {
      const entry = check.entry;
      if (check.reason === "start") return ui.notifications.warn(`${entry?.label || "Cette ligne de sorts"} n'est disponible qu'à partir du niveau ${entry?.startsAt}.`);
      if (check.reason === "max-level") return ui.notifications.warn(`${entry?.label || "Cette ligne de sorts"} ne permet pas les sorts de niveau ${niv}.`);
      return ui.notifications.warn(`Ce sort n'est pas autorisé pour cette classe.`);
    }

    const entry = check.entry;
    let cur = add2eGetMemorizedCountForEntry(sort, entry);

    if (isPlus) {
      const limit = add2eGetSlotsForEntryLevel(sheet.actor, entry, niv);
      const total = add2eCountPreparedForEntryLevel(sheet.actor, entry, niv);
      if (limit <= 0) return ui.notifications.warn(`Aucun emplacement ${entry.label} de niveau ${niv} disponible.`);
      if (total >= limit) return ui.notifications.warn(`Limite atteinte : ${entry.label} niveau ${niv} (${total}/${limit}).`);
      cur++;
    } else {
      if (cur > 0) cur--;
      else return ui.notifications.warn(`Aucun emplacement ${entry.label} à libérer.`);
    }

    await add2eSetMemorizedCountForEntry(sort, entry, cur);
    add2eRerenderActorSheet(sheet.actor);
  });

  html.off("click.add2eSortCast").on("click.add2eSortCast", ".sort-cast, .sort-cast-img, .add2e-object-magic-cast", async function(ev) {
    ev.preventDefault();
    ev.stopPropagation();

    const sortId = String(this.dataset?.sortId || this.getAttribute?.("data-sort-id") || $(this).data("sort-id") || "").trim();
    const debug = !!globalThis.ADD2E_DEBUG_OBJETS_MAGIQUES;

    if (debug) {
      console.group("[ADD2E][OBJETS_MAGIQUES][CLICK]");
      console.log("element", this);
      console.log("sortId", sortId);
    }

    if (!sortId) {
      if (debug) console.groupEnd();
      ui.notifications.warn("Impossible de lancer : identifiant du sort introuvable.");
      return false;
    }

    let sort = self.actor.items.get(sortId) ?? null;
    if (debug) console.log("Sort réel trouvé", !!sort, sort);

    if (!sort) {
      const itemSources = self.actor.items.filter(i => {
        if (!["arme", "armure", "objet", "object", "magic", "objet_magique"].includes(String(i.type || "").toLowerCase())) return false;
        if (typeof add2eMagicItemEquippedOrUsable === "function") {
          if (!add2eMagicItemEquippedOrUsable(i)) return false;
        } else if (i.system?.equipee === false) return false;
        const pouvoirs = typeof add2eMagicObjectPowerArray === "function" ? add2eMagicObjectPowerArray(i) : [];
        return pouvoirs.length > 0;
      });

      if (debug) console.log("Sources objets magiques candidates", itemSources.map(i => ({ id: i.id, name: i.name, type: i.type })));

      for (const itemSource of itemSources) {
        const pouvoirs = typeof add2eMagicObjectPowerArray === "function" ? add2eMagicObjectPowerArray(itemSource) : [];

        for (let idx = 0; idx < pouvoirs.length; idx++) {
          const generatedId = typeof add2eMagicPowerGeneratedId === "function" ? add2eMagicPowerGeneratedId(itemSource, idx) : itemSource.id.substring(0, 14) + idx.toString().padStart(2, "0");
          if (generatedId !== sortId) continue;

          if (typeof add2eBuildVirtualObjectPowerSort === "function") {
            sort = add2eBuildVirtualObjectPowerSort(self.actor, itemSource, pouvoirs[idx], idx);
          } else {
            const p = pouvoirs[idx];
            const onUse = String(p?.onUse ?? p?.onuse ?? p?.on_use ?? p?.script ?? "").trim();
            const cost = Math.max(0, Number(p?.cout ?? p?.cost ?? 0) || 0);
            const maxGlobal = Number(itemSource.system?.charges?.max ?? itemSource.system?.max_charges ?? 0) || 0;
            const isGlobal = maxGlobal > 0;
            const max = cost <= 0 ? 1 : (isGlobal ? maxGlobal : (Number(p?.max ?? p?.charges ?? 1) || 1));

            sort = new Item({
              _id: generatedId,
              name: String(p?.name ?? p?.nom ?? itemSource.name ?? "Pouvoir"),
              type: "sort",
              img: p?.img || itemSource.img,
              system: {
                niveau: Number(p?.niveau ?? p?.level ?? 1) || 1,
                école: p?.ecole || p?.["école"] || "Magique",
                description: p?.description || "",
                composantes: "Objet",
                temps_incantation: p?.activation || "Objet magique",
                isPower: true,
                isObjectPower: true,
                sourceWeaponId: itemSource.id,
                sourceItemId: itemSource.id,
                sourceItemName: itemSource.name,
                powerIndex: idx,
                cost,
                cout: cost,
                max,
                isGlobalCharge: isGlobal,
                onUse,
                onuse: onUse,
                on_use: onUse
              },
              flags: { add2e: { memorizedCount: cost <= 0 ? 1 : max, originalOnUse: onUse, sourceType: "objet_magique", sourceItemId: itemSource.id, sourceItemName: itemSource.name, powerIndex: idx } }
            }, { parent: self.actor });

            sort.getFlag = (scope, key) => {
              if (scope !== "add2e") return null;
              if (key === "memorizedCount") return cost <= 0 ? 1 : max;
              if (key === "originalOnUse") return onUse;
              return sort.flags?.add2e?.[key] ?? null;
            };
          }
          break;
        }
        if (sort) break;
      }
    }

    if (sort) {
      if (typeof globalThis.add2eCastSpell === "function") {
        if (debug) console.groupEnd();
        await globalThis.add2eCastSpell({ actor: self.actor, sort });
        self.render(false);
      } else {
        if (debug) console.groupEnd();
        ui.notifications.error("La fonction add2eCastSpell est introuvable.");
      }
    } else {
      if (debug) {
        console.warn("Aucun sort/pouvoir retrouvé pour", sortId);
        console.groupEnd();
      }
      ui.notifications.warn("Impossible de retrouver les données de ce sort ou pouvoir d'objet magique.");
    }
    return false;
  });

  html.find('.sort-cast-img').off('dragstart').on('dragstart', ev => {
    const sortId = $(ev.currentTarget).data('sort-id');
    const item = sheet.actor.items.get(sortId);
    if (!item) return;
    ev.originalEvent.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid: item.uuid }));
  });
}
