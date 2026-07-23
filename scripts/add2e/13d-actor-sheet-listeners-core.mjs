// ADD2E — Actor sheet listeners : noyau d'orchestration ApplicationV2.

import {
  ADD2E_SHEET_ROLL_DELEGATION_VERSION,
  add2eEvaluateRollSafe,
  add2eRollCharacteristicCard,
  add2eRollSaveCard,
  add2eInstallHudSheetRollBridge
} from "./13d-actor-sheet-listeners-rolls.mjs";
import { add2eBindActorSheetSpellListeners } from "./13d-actor-sheet-listeners-spells.mjs";

if (!globalThis.Add2eActorSheet) throw new Error("[ADD2E] Add2eActorSheet doit être chargé avant activateListeners.");

globalThis.ADD2E_SHEET_ROLL_DELEGATION_VERSION = ADD2E_SHEET_ROLL_DELEGATION_VERSION;
add2eInstallHudSheetRollBridge();

const ADD2E_LISTENER_CARACS = ["force", "dexterite", "constitution", "intelligence", "sagesse", "charisme"];

function add2eListenerNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function add2eListenerNaturalCarac(actor, carac) {
  const stored = actor?.flags?.add2e?.base_caracs?.[carac];
  if (Number.isFinite(Number(stored))) return add2eListenerNumber(stored, 10);

  const definitive = add2eListenerNumber(actor?.system?.[`${carac}_base`] ?? actor?.system?.[carac], 10);
  const rawRacial = add2eListenerNumber(actor?.flags?.add2e?.racialAbilityAdjustments?.[carac], 0);
  return Math.max(3, Math.min(18, definitive - rawRacial));
}

function add2eListenerAppliedRacialAdjustment(actor, carac, naturalValue) {
  const natural = add2eListenerNumber(naturalValue, 10);
  const raw = add2eListenerNumber(actor?.flags?.add2e?.racialAbilityAdjustments?.[carac], 0);
  if (raw > 0 && natural + raw > 18) return Math.max(0, 18 - natural);
  if (raw < 0 && natural + raw < 3) return Math.min(0, 3 - natural);
  return raw;
}

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
    ev.stopPropagation();
    this._add2eRememberActiveTab(html);

    const carac = String(ev.currentTarget.dataset.carac ?? "");
    if (!ADD2E_LISTENER_CARACS.includes(carac)) return;

    const isPlus = ev.currentTarget.classList.contains('plus');
    const currentNatural = add2eListenerNaturalCarac(this.actor, carac);
    const nextNatural = Math.max(3, Math.min(18, currentNatural + (isPlus ? 1 : -1)));
    if (nextNatural === currentNatural) return;

    const baseCaracs = {
      ...(this.actor.flags?.add2e?.base_caracs && typeof this.actor.flags.add2e.base_caracs === "object"
        ? foundry.utils.deepClone(this.actor.flags.add2e.base_caracs)
        : {})
    };
    baseCaracs[carac] = nextNatural;

    const appliedRacial = add2eListenerAppliedRacialAdjustment(this.actor, carac, nextNatural);
    const definitive = nextNatural + appliedRacial;
    const update = {
      "flags.add2e.base_caracs": baseCaracs,
      [`system.${carac}_base`]: definitive
    };
    if (carac === "force" && definitive !== 18) update["system.force_ex"] = 0;

    await this.actor.update(update, {
      add2eInternal: true,
      add2eReason: "ability-natural-manual-adjust",
      render: false
    });

    if (typeof this.autoSetCaracAjustements === "function") await this.autoSetCaracAjustements();
    await this.render(false);
  });

  html.find("select[data-add2e-force-ex]")
    .off('click.add2eForceEx')
    .on('click.add2eForceEx', ev => ev.stopPropagation());

  html.find("select[data-add2e-force-ex]").off('change.add2e').on('change.add2e', async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    this._add2eRememberActiveTab(html);

    const selected = Math.trunc(Number(ev.currentTarget.value));
    const forceEx = Number.isFinite(selected) && selected >= 0 && selected <= 100 ? selected : 0;
    if (typeof globalThis.add2eSetExceptionalStrength !== "function") {
      throw new Error("Le gestionnaire canonique de Force exceptionnelle n’est pas disponible.");
    }

    await globalThis.add2eSetExceptionalStrength(this.actor, forceEx, { reason: "force-ex-selection" });
    await this.render(false);
  });

  html.find('.roll-stat').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    await add2eRollCharacteristicCard(this.actor, ev.currentTarget.dataset.stat);
  });

  html.find('.roll-save').off('click.add2e').on('click.add2e', async ev => {
    ev.preventDefault();
    await add2eRollSaveCard(this.actor, Number(ev.currentTarget.dataset.save));
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

  html.find('.window-content [data-action]').off().on('click', async ev => {
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
    const roll = await add2eEvaluateRollSafe("1d6 + " + facteur);
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

  add2eBindActorSheetSpellListeners(this, html);

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