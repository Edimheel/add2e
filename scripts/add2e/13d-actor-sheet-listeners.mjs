// ADD2E — Actor sheet listeners restaurés V1 — full ApplicationV2
// Logique V1 conservée. Aucun appel ActorSheet.prototype.activateListeners.

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant activateListeners.");

globalThis.Add2eActorSheet.prototype.activateListeners = function activateListeners(html) {
  html = html?.jquery ? html : $(html);
  const self = this;

  add2eRegisterImgPicker(html, this);
  this._add2eBindPersistentTabs(html);
  add2eEnhanceCharacterSheetUi(this, html);

  // -- Gestion des effets actifs
  html.find('.effect-edit').off().on('click', ev => {
    ev.preventDefault();
    const effectId = $(ev.currentTarget).data('effect-id');
    const effect = this.actor.effects.get(effectId);
    if (effect) effect.sheet.render(true);
  });

  html.find('.effect-delete').off().on('click', async ev => {
    ev.preventDefault();
    this._add2eRememberActiveTab(html);
    const effectId = $(ev.currentTarget).data('effect-id');
    if (effectId) {
      await this.actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
      this.render(false);
    }
  });

  html.find('.carac-btn').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    this._add2eRememberActiveTab(html);
    const carac = ev.currentTarget.dataset.carac;
    const isPlus = ev.currentTarget.classList.contains('plus');
    let baseVal = Number(this.actor.system[`${carac}_base`] || 10);
    baseVal = Math.max(3, Math.min(18, baseVal + (isPlus ? 1 : -1)));
    await this.actor.update({ [`system.${carac}_base`]: baseVal });

    const CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];
    let baseCaracs = {};
    for (const c of CARACS) {
      baseCaracs[c] = typeof this.actor.system?.[`${c}_base`] === "number" ? this.actor.system[`${c}_base`] : 10;
    }
    await this.actor.setFlag("add2e", "base_caracs", baseCaracs);

    if (typeof this.autoSetCaracAjustements === "function") await this.autoSetCaracAjustements();
    const recalculatedBonuses = this.calcCaracBonuses ? this.calcCaracBonuses() : {};
    if (recalculatedBonuses && Object.keys(recalculatedBonuses).length) await this.actor.update(recalculatedBonuses);
    await this.render(false);
  });

  html.find('.roll-stat').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    const carac = ev.currentTarget.dataset.stat;
    const label = carac?.toUpperCase() || 'Caractéristique';
    const val = Number(this.actor.system[carac]) || 10;
    const roll = new Roll('1d20');
    await roll.evaluate();
    if (game.dice3d) await game.dice3d.showForRoll(roll);

    const caracIcon = {
      force: "fa-dumbbell",
      dexterite: "fa-running",
      constitution: "fa-heartbeat",
      intelligence: "fa-brain",
      sagesse: "fa-eye",
      charisme: "fa-theater-masks"
    }[carac] || "fa-dice-d20";
    const caracColor = {
      force: "#4ab878",
      dexterite: "#f3aa3c",
      constitution: "#e74c3c",
      intelligence: "#2980b9",
      sagesse: "#9b59b6",
      charisme: "#e056fd"
    }[carac] || "#6c4e95";
    const reussite = roll.total <= val;

    const htmlCard = `
      <div class="add2e-card-test" style="border-radius:13px; box-shadow:0 2px 10px #b5e7c388; background:linear-gradient(100deg,#f9fcfa 90%,#e4fbf1 100%); border:1.4px solid ${caracColor}; max-width:420px; padding:0.85em 1.1em 0.8em 1.1em; font-family: var(--font-primary);">
        <div style="display:flex; align-items:center; gap:0.7em; margin-bottom:0.5em;"><i class="fas ${caracIcon}" style="font-size:2em;color:${caracColor};"></i><span style="font-size:1.17em; font-weight:bold; color:${caracColor};">${label}</span><span style="margin-left:auto; font-size:1em; font-weight:500; color:#666;">Test de caractéristique</span></div>
        <div style="font-size:1.11em; margin-bottom:0.25em;">Seuil&nbsp;: <b>${val}</b>&nbsp;&nbsp;|&nbsp;&nbsp;Résultat&nbsp;: <b>${roll.total}</b></div>
        <div style="margin:0.2em 0 0.1em 0; font-size:1.1em;"><span style="font-weight:600; color:${reussite ? "#1cb360" : "#c34040"};">${reussite ? "✔️ Réussite" : "❌ Échec"}</span></div>
      </div>`;

    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: htmlCard });
  });

  html.find('.roll-save').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    const idx = Number(ev.currentTarget.dataset.save);
    const saves = this.actor.system.details_classe?.progression?.[this.actor.system.niveau - 1]?.savingThrows || this.actor.system.sauvegardes || [];
    const noms = ["Paralysie", "Pétrification", "Baguettes", "Souffles", "Sorts"];
    const nom = noms[idx] || "Jet";
    const valeur = Number(saves[idx]);
    if (!valeur) return ui.notifications.warn("Aucune valeur pour ce jet.");

    const roll = new Roll('1d20');
    await roll.evaluate();
    if (game.dice3d) await game.dice3d.showForRoll(roll);

    let bonusSave = 0;
    if (typeof Add2eEffectsEngine !== "undefined") {
      try {
        const analyse = Add2eEffectsEngine.analyze?.(this.actor, { type: "save", vsType: nom, frontale: true }) ?? {};
        bonusSave = Number(analyse.bonus_save || 0);
      } catch (e) {
        console.warn("[ADD2E][SAVE] Erreur analyse effets de sauvegarde", e);
      }
    }

    const totalJet = Number(roll.total || 0) + bonusSave;
    const saveIcons = ["fa-skull-crossbones","fa-mountain","fa-magic","fa-fire","fa-scroll"];
    const icon = saveIcons[idx] || "fa-dice-d20";
    const colors = ["#c48642","#6394e8","#b12f95","#e67e22","#a173d9"];
    const color = colors[idx] || "#6c4e95";
    const reussite = totalJet >= valeur;

    const htmlCard = `
      <div class="add2e-card-test" style="border-radius:13px; box-shadow:0 2px 10px #cfdfff88; background:linear-gradient(100deg,#f9fafd 90%,#e6e8fb 100%); border:1.4px solid ${color}; max-width:420px; padding:0.85em 1.1em 0.8em 1.1em; font-family: var(--font-primary);">
        <div style="display:flex; align-items:center; gap:0.7em; margin-bottom:0.5em;"><i class="fas ${icon}" style="font-size:2em;color:${color};"></i><span style="font-size:1.12em; font-weight:bold; color:${color};">${nom}</span><span style="margin-left:auto; font-size:1em; font-weight:500; color:#666;">Jet de sauvegarde</span></div>
        <div style="font-size:1.09em; margin-bottom:0.25em;">Seuil&nbsp;: <b>${valeur}</b>&nbsp;&nbsp;|&nbsp;&nbsp;Résultat&nbsp;: <b>${roll.total}</b>${bonusSave ? `&nbsp;&nbsp;|&nbsp;&nbsp;Effets&nbsp;: <b>${bonusSave >= 0 ? "+" : ""}${bonusSave}</b> → <b>${totalJet}</b>` : ""}</div>
        <div style="margin:0.2em 0 0.1em 0; font-size:1.1em;"><span style="font-weight:600; color:${reussite ? "#1cb360" : "#c34040"};">${reussite ? "✔️ Réussite" : "❌ Échec"}</span></div>
      </div>`;

    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: htmlCard });
  });

  html.find('.add2e-thief-skill-roll').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    const key = $(ev.currentTarget).data('thief-skill-key');
    await add2eRollThiefSkill(this.actor, key);
  });

  html.find('.arme-img-attack').off('click').on('click', async ev => {
    const itemId = $(ev.currentTarget).data("item-id");
    const arme = this.actor.items.get(itemId);
    if (!arme) return;
    await globalThis.add2eAttackRoll({ actor: this.actor, arme });
  });

  html.find('.arme-img-attack').attr('draggable', 'true').off('dragstart').on('dragstart', ev => {
    const itemId = $(ev.currentTarget).data("item-id");
    const item = this.actor.items.get(itemId);
    if (!item) return;
    ev.originalEvent.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid: item.uuid }));
  });

  html.find('[data-action]').off().on('click', async ev => {
    ev.stopPropagation();
    this._add2eRememberActiveTab(html);

    const $el = $(ev.currentTarget);
    const action = $el.data('action');
    const itemId = $el.data('item-id');
    const sortId = $el.data('sort-id');

    const actionNorm = String(action ?? "").trim().toLowerCase();
    const hasFeatureMarker =
      $el.data("feature-index") !== undefined ||
      $el.data("feature-name") !== undefined ||
      $el.data("feature-id") !== undefined ||
      $el.data("feature-key") !== undefined ||
      $el.data("on-use") !== undefined ||
      $el.closest("[data-feature-index], [data-feature-name], [data-feature-id], [data-feature-key], [data-on-use]").length > 0;

    const candidateFeature = add2eFindClassFeatureFromElement(this.actor, ev.currentTarget);
    const looksLikeFeatureUse =
      hasFeatureMarker ||
      actionNorm.includes("feature") ||
      actionNorm.includes("capacite") ||
      actionNorm.includes("capacité") ||
      actionNorm === "use-class-feature" ||
      actionNorm === "class-feature-use" ||
      (candidateFeature && !itemId && !sortId && (
        actionNorm === "use" ||
        actionNorm === "utiliser" ||
        actionNorm.includes("use") ||
        String($el.text() ?? "").trim().toLowerCase().includes("utiliser")
      ));

    if (looksLikeFeatureUse && candidateFeature) {
      await add2eExecuteClassFeatureOnUse(this.actor, candidateFeature, this);
      return;
    }

    if (looksLikeFeatureUse && !candidateFeature) {
      console.warn("[ADD2E][CAPACITE][CLICK] Bouton détecté mais capacité introuvable", {
        action,
        dataset: { ...($el[0]?.dataset ?? {}) },
        text: $el.text?.(),
        features: add2eGetActorActivableClassFeatures(this.actor).map(f => ({
          name: add2eFeatureName(f),
          on_use: add2eFeatureOnUse(f)
        }))
      });
      ui.notifications.warn("Capacité de classe introuvable pour ce bouton. Voir console [ADD2E][CAPACITE][CLICK].");
      return;
    }

    await handleItemAction({ actor: this.actor, action, itemId, sheet: this });
  });

  html.find('.add2e-feature-use, button, a, .a2e-btn').off('click.add2eFeatureFallback').on('click.add2eFeatureFallback', async ev => {
    const $el = $(ev.currentTarget);
    if ($el.data('item-id') || $el.data('sort-id')) return;

    const label = String($el.text?.() ?? "").trim().toLowerCase();
    const action = String($el.data('action') ?? "").trim().toLowerCase();
    const hasFeatureMarker =
      $el.hasClass('add2e-feature-use') ||
      $el.data("feature-index") !== undefined ||
      $el.data("feature-name") !== undefined ||
      $el.data("feature-id") !== undefined ||
      $el.data("feature-key") !== undefined ||
      $el.data("on-use") !== undefined;

    if (!hasFeatureMarker && !label.includes("utiliser") && !action.includes("feature") && !action.includes("capacite") && !action.includes("capacité")) return;

    const feature = add2eFindClassFeatureFromElement(this.actor, ev.currentTarget);
    if (!feature) return;

    ev.preventDefault();
    ev.stopPropagation();
    this._add2eRememberActiveTab(html);
    await add2eExecuteClassFeatureOnUse(this.actor, feature, this);
  });

  html.find('.roll-initiative-btn').off().on('click', async ev => {
    ev.preventDefault();
    const arme = this.actor.items.find(i => i.type === "arme" && i.system.equipee);
    const facteur = arme ? (Number(arme.system.facteur_rapidité) || 0) : 0;
    const roll = new Roll("1d6 + " + facteur);
    await roll.evaluate();
    await this.actor.update({ "system.initiative": roll.total });

    const token = this.actor.getActiveTokens()[0];
    if (token && game.combat) {
      const combatant = game.combat.combatants.find(c => c.tokenId === token.id);
      if (combatant) {
        await combatant.update({ initiative: roll.total });
        await triInitiativeAscendant();
      }
    }
    roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), flavor: `Initiative (facteur arme ${facteur >= 0 ? "+" : ""}${facteur})` });
  });

  html.find('.arme-thaco-roll').off().on('click', async ev => {
    const itemId = $(ev.currentTarget).data("item-id");
    const arme = this.actor.items.get(itemId);
    if (!arme) return;
    await add2eAttackRoll({ actor: this.actor, arme });
  });

  html.find('input[name="actor.name"]').off('change.add2e').on("change.add2e", async ev => {
    const newName = ev.target.value.trim();
    if (newName && newName !== this.actor.name) {
      await this.actor.update({ name: newName });
      this.render(false);
    }
  });

  html.find('.roll-caracs-btn').off('click.add2e').on('click.add2e', ev => {
    ev.preventDefault();
    if (typeof Add2eCaracRoller !== "undefined") new Add2eCaracRoller(this);
    else ui.notifications.warn("Le module de tirage de caractéristiques n'est pas chargé !");
  });

  html.find('.armure-equip').off().on('click', async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    this._add2eRememberActiveTab(html);
    const itemId = $(ev.currentTarget).data("item-id");
    await handleItemAction({ actor: this.actor, action: "equip", itemId, itemType: "armure", sheet: this });
  });

  html.find('.armure-edit').off().on('click', ev => {
    const itemId = $(ev.currentTarget).data("item-id");
    const item = this.actor.items.get(itemId);
    if (item) item.sheet.render(true);
  });

  html.find('.armure-delete').off().on('click', async ev => {
    const itemId = $(ev.currentTarget).data("item-id");
    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
    this.render(false);
  });

  html.find('.objet-create').off("click").on("click", async ev => {
    ev.preventDefault();
    await Item.create({ name: "Nouvel Objet", type: "objet", img: "icons/containers/bags/sack-cloth-tan.webp", system: { quantite: 1, poids: 0, equipee: false } }, { parent: this.actor });
  });

  html.find('.objet-equip').off("click").on("click", async ev => {
    ev.preventDefault();
    const li = $(ev.currentTarget).closest(".item");
    const itemId = li.data("itemId");
    const item = this.actor.items.get(itemId);
    if (!item) return;

    const newState = !item.system.equipee;
    await item.update({"system.equipee": newState});

    if (newState) {
      const scriptPath = item.system.onUse || item.system.onuse;
      if (scriptPath) {
        try {
          const response = await fetch(scriptPath);
          if (response.ok) {
            const code = await response.text();
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const fn = new AsyncFunction("actor", "item", "sort", code);
            await fn(this.actor, item, null);
            ui.notifications.info(`${item.name} : Activé`);
          } else {
            console.warn(`[ADD2e] Script introuvable : ${scriptPath}`);
          }
        } catch(e) {
          console.error(`[ADD2e] Erreur script objet :`, e);
          ui.notifications.error(`Erreur script sur ${item.name}`);
        }
      }
    } else {
      const effectsToDelete = this.actor.effects.filter(e => e.origin === item.uuid).map(e => e.id);
      if (effectsToDelete.length > 0) {
        await this.actor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete);
        ui.notifications.info(`${item.name} : Désactivé (Effets retirés)`);
      }
    }

    this.render(false);
  });

  html.find('.objet-edit').off("click").on("click", ev => {
    ev.preventDefault();
    const li = $(ev.currentTarget).closest(".item");
    const itemId = li.data("itemId");
    const item = this.actor.items.get(itemId);
    if (item) item.sheet.render(true);
  });

  html.find('.objet-delete').off("click").on("click", async ev => {
    ev.preventDefault();
    const li = $(ev.currentTarget).closest(".item");
    const itemId = li.data("itemId");
    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  });

  html.find('input[name="system.niveau"]').off('change.add2e').on("change.add2e", async ev => {
    let v = parseInt(ev.target.value, 10) || 1;
    const clamp = add2eClampLevelToClassMax(this.actor, v, null, { notify: true });
    v = clamp.level;
    ev.target.value = v;
    await this.actor.update({ "system.niveau": v });
    try { await add2eSyncMonkUnarmedWeapon(this.actor); } catch (e) { console.warn("[ADD2E][MOINE] Sync niveau échoué", e); }
    try { await add2eSyncClassPassiveEffect(this.actor); } catch (e) { console.warn("[ADD2E][CLASSE][EFFETS] Sync niveau échoué", e); }
    this.render(false);
  });

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

  html.find('.sort-memorize-plus, .sort-memorize-minus')
    .off('click')
    .on('click', async ev => {
      ev.preventDefault();
      ev.stopPropagation();

      const $btn = $(ev.currentTarget);
      const sortId = $btn.data('sort-id');
      const sort = this.actor.items.get(sortId);
      if (!sort) return;

      const isPlus = $btn.hasClass('sort-memorize-plus');
      const niv = Number(sort.system?.niveau ?? sort.system?.level ?? 1) || 1;
      const requestedEntryKey = add2eNormalizeSpellKey($btn.data('spell-entry-key') || $btn.attr('data-spell-entry-key') || "");

      let check = add2eCanActorUseSpell(this.actor, sort);

      if (requestedEntryKey) {
        const entries = add2eGetSpellcastingEntries(this.actor);
        const sortLists = add2eGetSpellListsFromItem(sort);
        const requestedEntry = entries.find(e => add2eNormalizeSpellKey(e.key) === requestedEntryKey) || null;

        if (!requestedEntry || !sortLists.includes(requestedEntryKey)) return ui.notifications.warn(`Ce sort ne peut pas être préparé comme ${requestedEntry?.label || requestedEntryKey}.`);

        const actorLevel = Math.max(1, Number(this.actor?.system?.niveau) || 1);
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
        const limit = add2eGetSlotsForEntryLevel(this.actor, entry, niv);
        const total = add2eCountPreparedForEntryLevel(this.actor, entry, niv);
        if (limit <= 0) return ui.notifications.warn(`Aucun emplacement ${entry.label} de niveau ${niv} disponible.`);
        if (total >= limit) return ui.notifications.warn(`Limite atteinte : ${entry.label} niveau ${niv} (${total}/${limit}).`);
        cur++;
      } else {
        if (cur > 0) cur--;
        else return ui.notifications.warn(`Aucun emplacement ${entry.label} à libérer.`);
      }

      await add2eSetMemorizedCountForEntry(sort, entry, cur);
      add2eRerenderActorSheet(this.actor);
    });

  html
    .off("click.add2eSortCast")
    .on("click.add2eSortCast", ".sort-cast, .sort-cast-img, .add2e-object-magic-cast", async function(ev) {
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

  html.find('.sort-cast-img')
    .off('dragstart')
    .on('dragstart', ev => {
      const sortId = $(ev.currentTarget).data('sort-id');
      const item = this.actor.items.get(sortId);
      if (!item) return;
      ev.originalEvent.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid: item.uuid }));
    });

  html.find('.file-picker').off().on('click', ev => {
    const target = $(ev.currentTarget).data('target');
    new FilePicker({
      type: "image",
      current: this.actor?.img || this.item?.img || "icons/svg/mystery-man.svg",
      callback: path => {
        if (this.item) this.item.update({ [target]: path });
        else majImageToken(this.actor, path);
        html.find('input[name="img"]').val(path);
        html.find('img[alt="Icône"], img[alt="Image du monstre"]').attr('src', path);
      }
    }).render(true);
  });

  html.find('input[name="name"]').off('change.add2e').on("change.add2e", async ev => {
    const newName = ev.target.value.trim();
    if (newName && newName !== this.actor.name) {
      await this.actor.update({ name: newName });
      await this.actor.update({ "prototypeToken.name": newName });
      for (let t of this.actor.getActiveTokens()) {
        if (t.document && t.document.name !== newName) await t.document.update({ name: newName });
      }
      this.render(false);
    }
  });

  this.autoSetCaracAjustements();
};