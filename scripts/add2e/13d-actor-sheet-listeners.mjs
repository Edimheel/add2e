// ADD2E — Actor sheet listeners — full ApplicationV2

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant activateListeners.");

globalThis.Add2eActorSheet.prototype.activateListeners = function activateListeners(html) {
  const self = this;
  html = html?.jquery ? html : $(html);

  add2eRegisterImgPicker?.(html, this);
  this._add2eBindPersistentTabs(html);
  add2eEnhanceCharacterSheetUi?.(this, html);

  html.find('.effect-edit').off('click.add2e').on('click.add2e', ev => {
    ev.preventDefault();
    const effectId = $(ev.currentTarget).data('effect-id');
    const effect = this.actor.effects.get(effectId);
    if (effect) effect.sheet.render(true);
  });

  html.find('.effect-delete').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    this._add2eRememberActiveTab(html);
    const effectId = $(ev.currentTarget).data('effect-id');
    if (effectId) await this.actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
    this.render(false);
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
    const baseCaracs = {};
    for (const c of CARACS) baseCaracs[c] = typeof this.actor.system?.[`${c}_base`] === "number" ? this.actor.system[`${c}_base`] : 10;
    await this.actor.setFlag("add2e", "base_caracs", baseCaracs);

    if (typeof this.autoSetCaracAjustements === "function") await this.autoSetCaracAjustements();
    const recalculatedBonuses = this.calcCaracBonuses ? this.calcCaracBonuses() : {};
    if (recalculatedBonuses && Object.keys(recalculatedBonuses).length) await this.actor.update(recalculatedBonuses);
    this.render(false);
  });

  html.find('.roll-stat').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    const carac = ev.currentTarget.dataset.stat;
    const label = carac?.toUpperCase() || 'Caractéristique';
    const val = Number(this.actor.system[carac]) || 10;
    const roll = new Roll('1d20');
    await roll.evaluate();
    if (game.dice3d) await game.dice3d.showForRoll(roll);
    const reussite = roll.total <= val;
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="add2e-card-test"><b>${label}</b><br>Seuil : <b>${val}</b> | Jet : <b>${roll.total}</b><br><b>${reussite ? "Réussite" : "Échec"}</b></div>`
    });
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
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="add2e-card-test"><b>${nom}</b><br>Seuil : <b>${valeur}</b> | Jet : <b>${roll.total}</b><br><b>${roll.total >= valeur ? "Réussite" : "Échec"}</b></div>`
    });
  });

  html.find('.add2e-thief-skill-roll').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    await add2eRollThiefSkill(this.actor, $(ev.currentTarget).data('thief-skill-key'));
  });

  html.find('.arme-img-attack, .arme-thaco-roll').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    const itemId = $(ev.currentTarget).data("item-id");
    const arme = this.actor.items.get(itemId);
    if (arme) await globalThis.add2eAttackRoll?.({ actor: this.actor, arme });
  });

  html.find('.arme-img-attack, .sort-cast-img').attr('draggable', 'true').off('dragstart.add2e').on('dragstart.add2e', ev => {
    const itemId = $(ev.currentTarget).data("item-id") || $(ev.currentTarget).data('sort-id');
    const item = this.actor.items.get(itemId);
    if (!item) return;
    ev.originalEvent.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid: item.uuid }));
  });

  html.find('[data-action]').off('click.add2eAction').on('click.add2eAction', async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    this._add2eRememberActiveTab(html);
    const $el = $(ev.currentTarget);
    const action = $el.data('action');
    const itemId = $el.data('item-id');

    const feature = typeof add2eFindClassFeatureFromElement === "function" ? add2eFindClassFeatureFromElement(this.actor, ev.currentTarget) : null;
    const actionNorm = String(action ?? "").trim().toLowerCase();
    const looksLikeFeature = feature && (actionNorm.includes("feature") || actionNorm.includes("capacite") || actionNorm.includes("capacité") || actionNorm === "use" || actionNorm === "utiliser");
    if (looksLikeFeature) return add2eExecuteClassFeatureOnUse(this.actor, feature, this);

    await handleItemAction({ actor: this.actor, action, itemId, sheet: this });
  });

  html.find('.roll-initiative-btn').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    const arme = this.actor.items.find(i => i.type === "arme" && i.system.equipee);
    const facteur = arme ? (Number(arme.system.facteur_rapidité) || 0) : 0;
    const roll = new Roll(`1d6 + ${facteur}`);
    await roll.evaluate();
    await this.actor.update({ "system.initiative": roll.total });
    const token = this.actor.getActiveTokens()[0];
    if (token && game.combat) {
      const combatant = game.combat.combatants.find(c => c.tokenId === token.id);
      if (combatant) {
        await combatant.update({ initiative: roll.total });
        await triInitiativeAscendant?.();
      }
    }
    roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), flavor: `Initiative (facteur arme ${facteur >= 0 ? "+" : ""}${facteur})` });
  });

  html.find('input[name="actor.name"], input[name="name"]').off('change.add2e').on("change.add2e", async ev => {
    const newName = ev.target.value.trim();
    if (!newName || newName === this.actor.name) return;
    await this.actor.update({ name: newName, "prototypeToken.name": newName });
    for (const t of this.actor.getActiveTokens()) if (t.document && t.document.name !== newName) await t.document.update({ name: newName });
    this.render(false);
  });

  html.find('.roll-caracs-btn').off('click.add2e').on('click.add2e', ev => {
    ev.preventDefault();
    if (typeof Add2eCaracRoller !== "undefined") new Add2eCaracRoller(this);
    else ui.notifications.warn("Le module de tirage de caractéristiques n'est pas chargé !");
  });

  html.find('.armure-equip, .objet-equip').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    this._add2eRememberActiveTab(html);
    const li = $(ev.currentTarget).closest(".item");
    const itemId = $(ev.currentTarget).data("item-id") || li.data("itemId");
    await handleItemAction({ actor: this.actor, action: "equip", itemId, sheet: this });
  });

  html.find('.armure-edit, .objet-edit, .sort-edit').off('click.add2e').on('click.add2e', ev => {
    ev.preventDefault();
    ev.stopPropagation();
    const itemId = $(ev.currentTarget).data("item-id") || $(ev.currentTarget).data('sort-id') || $(ev.currentTarget).closest(".item").data("itemId");
    const item = self.actor.items.get(itemId);
    if (item) item.sheet.render(true);
  });

  html.find('.armure-delete, .objet-delete, .sort-delete').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    const itemId = $(ev.currentTarget).data("item-id") || $(ev.currentTarget).data('sort-id') || $(ev.currentTarget).closest(".item").data("itemId");
    if (itemId) await self.actor.deleteEmbeddedDocuments("Item", [itemId]);
    self.render(false);
  });

  html.find('.objet-create').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    await Item.create({ name: "Nouvel Objet", type: "objet", img: "icons/containers/bags/sack-cloth-tan.webp", system: { quantite: 1, poids: 0, equipee: false } }, { parent: this.actor });
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

  html.find('.toggle-sort-desc-chat').off('click.add2e').on('click.add2e', function(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    html.find(`#desc-chat-${$(this).data('sort-id')}`).slideToggle(160);
    return false;
  });

  html.find('.sort-memorize-plus, .sort-memorize-minus').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    const $btn = $(ev.currentTarget);
    const sort = this.actor.items.get($btn.data('sort-id'));
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
      if (actorLevel < Number(requestedEntry.startsAt || 1)) return ui.notifications.warn(`${requestedEntry.label || "Cette ligne de sorts"} n'est disponible qu'à partir du niveau ${requestedEntry.startsAt}.`);
      if (Number(requestedEntry.maxSpellLevel || 0) && niv > Number(requestedEntry.maxSpellLevel || 0)) return ui.notifications.warn(`${requestedEntry.label || "Cette ligne de sorts"} ne permet pas les sorts de niveau ${niv}.`);
      check = { ok: true, reason: "ok", entry: requestedEntry };
    }

    if (!check.ok) return ui.notifications.warn(`Ce sort n'est pas autorisé pour cette classe.`);
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

  html.off("click.add2eSortCast").on("click.add2eSortCast", ".sort-cast, .sort-cast-img, .add2e-object-magic-cast", async function(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    const sortId = String(this.dataset?.sortId || this.getAttribute?.("data-sort-id") || $(this).data("sort-id") || "").trim();
    const sort = self.actor.items.get(sortId);
    if (!sort) return ui.notifications.warn("Impossible de retrouver les données de ce sort ou pouvoir d'objet magique.");
    if (typeof globalThis.add2eCastSpell === "function") {
      await globalThis.add2eCastSpell({ actor: self.actor, sort });
      self.render(false);
    } else ui.notifications.error("La fonction add2eCastSpell est introuvable.");
    return false;
  });

  html.find('.file-picker').off('click.add2e').on('click.add2e', ev => {
    const target = $(ev.currentTarget).data('target');
    new FilePicker({
      type: "image",
      current: this.actor?.img || "icons/svg/mystery-man.svg",
      callback: path => {
        if (target) this.actor.update({ [target]: path });
        else majImageToken(this.actor, path);
        html.find('input[name="img"]').val(path);
        html.find('img[alt="Icône"], img[alt="Image du monstre"]').attr('src', path);
      }
    }).render(true);
  });

  this.autoSetCaracAjustements();
};
