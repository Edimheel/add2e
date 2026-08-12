// ADD2E — Point d'entrée des écouteurs de feuille ApplicationV2.
// Les comportements sont répartis en modules fonctionnels sans modifier les sélecteurs ni l'ordre d'exécution.

import "./13d-actor-sheet-listeners-core.mjs";
import {
  ARCANE_LISTS,
  actorArcaneLists,
  arcaneKind,
  documentEntries,
  entryFromSpell,
  itemQuantity,
  itemType,
  listLabel,
  resolveSpell,
  spellLevel,
  spellLists,
  stableSpellKey
} from "./07b-arcane-documents-core.mjs";

const ADD2E_SHEET_LISTENER_RECOVERY_VERSION = "2026-07-05-sheet-tabs-force-ex-v1";
const ADD2E_SCROLL_WRITING_VERSION = "2026-08-12-canonical-arcane-core-v4";

globalThis.ADD2E_SHEET_LISTENER_RECOVERY_VERSION = ADD2E_SHEET_LISTENER_RECOVERY_VERSION;
globalThis.ADD2E_SCROLL_WRITING_VERSION = ADD2E_SCROLL_WRITING_VERSION;

function add2eListenerRoot(sheet, html) {
  if (typeof sheet?._add2eSheetRoot === "function") return sheet._add2eSheetRoot(html);
  const root = html?.jquery ? html[0] : html;
  return root ?? null;
}

function add2eInstallSheetListenerRecovery() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto || typeof proto._add2eBindPersistentTabs === "function") return;

  proto._add2eBindPersistentTabs = function _add2eBindPersistentTabs(html) {
    const root = add2eListenerRoot(this, html);
    if (!root) return;

    const initialTab = this._add2eActiveTab || this._add2eReadStoredTab?.() || "resume";
    this._add2eActivateTab?.(initialTab, root);

    if (root.dataset.add2eTabsForceExBound === "1") return;
    root.dataset.add2eTabsForceExBound = "1";

    root.addEventListener("pointerdown", event => {
      const tabLink = event.target?.closest?.(".sheet-tabs .item[data-tab], .a2e-tabs .item[data-tab]");
      if (tabLink && root.contains(tabLink)) {
        this._add2eRememberActiveTab?.(root, tabLink.dataset.tab || "resume");
        return;
      }
      this._add2eRememberActiveTab?.(root);
    }, true);

    root.addEventListener("change", event => {
      const field = event.target?.closest?.("select[data-add2e-force-ex]");
      if (!field || !root.contains(field)) {
        this._add2eRememberActiveTab?.(root);
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      this._add2eRememberActiveTab?.(root);

      const value = Math.max(0, Math.min(100, Math.trunc(Number(field.value) || 0)));
      field.value = String(value);
      field.dataset.currentForceEx = String(value);

      Promise.resolve(
        globalThis.add2eSetExceptionalStrength?.(this.actor, value, { reason: "force-ex-selection" })
      ).then(saved => {
        if (saved === false) return;
        this._add2eActivateTab?.(this._add2eActiveTab || this._add2eReadStoredTab?.() || "resume", root);
        if (this.rendered) this.render(false);
      }).catch(error => {
        console.error("[ADD2E][FORCE_EX][SET_ERROR]", { actor: this.actor?.name, error });
      });
    }, true);

    root.querySelectorAll(".sheet-tabs .item[data-tab], .a2e-tabs .item[data-tab]").forEach(tabLink => {
      tabLink.addEventListener("click", event => {
        event.preventDefault();
        this._add2eActivateTab?.(tabLink.dataset.tab || "resume", root);
      });
    });
  };
}

function add2eScrollWritingEsc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function add2eScrollWritingIsSingleSpellScroll(item, spellKey) {
  if (itemType(item) !== "objet" || arcaneKind(item) !== "spell-scroll") return false;
  const entries = documentEntries(item);
  return entries.length === 1 && String(entries[0]?.key ?? "") === String(spellKey);
}

async function add2eScrollWritingResolveCanonical(spell, compatibleLists) {
  const entry = entryFromSpell(spell);
  if (!entry) return null;
  return resolveSpell({ ...entry, lists: [...compatibleLists] });
}

async function add2eWriteKnownSpellToScroll(actor, spell) {
  if (!actor || !spell || itemType(spell) !== "sort") return false;

  if (game.combat?.started === true) {
    ui.notifications.warn("L'écriture d'un parchemin est impossible pendant un combat.");
    return false;
  }

  if (
    spell.system?.isPower === true
    || spell.system?.isObjectPower === true
    || spell.system?.isCapacity === true
    || spell.flags?.add2e?.spellFamily?.generated === true
  ) {
    ui.notifications.warn("Ce pouvoir ou cette variante ne peut pas être écrit sur un parchemin.");
    return false;
  }

  const actorLists = actorArcaneLists(actor);
  const compatibleLists = spellLists(spell)
    .filter(list => ARCANE_LISTS.has(list) && actorLists.includes(list));

  if (!compatibleLists.length) {
    ui.notifications.warn(`${spell.name} n'est pas un sort connu de Magicien ou d'Illusionniste pour ${actor.name}.`);
    return false;
  }

  const sourceDocument = await add2eScrollWritingResolveCanonical(spell, compatibleLists);
  if (!sourceDocument) {
    ui.notifications.error(`${spell.name} est introuvable dans le compendium add2e.sorts pour son niveau et sa liste.`);
    return false;
  }

  const canonicalLevel = spellLevel(sourceDocument);
  if (canonicalLevel < 1) {
    ui.notifications.error(`${sourceDocument.name} ne possède pas de niveau canonique system.niveau.`);
    return false;
  }

  if (typeof globalThis.add2eDialogConfirm !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }

  const listText = compatibleLists.map(listLabel).join(" / ");
  const confirmed = await globalThis.add2eDialogConfirm({
    add2eTheme: "wizard",
    add2ePrimaryAction: "yes",
    add2eClasses: ["add2e-scroll-writing-dialog"],
    window: { title: `Écrire un parchemin — ${sourceDocument.name}` },
    modal: true,
    content: `
      <div class="add2e-scroll-writing-content" style="min-width:520px;padding:8px;">
        <p><b>${add2eScrollWritingEsc(actor.name)}</b> va écrire un parchemin contenant <b>${add2eScrollWritingEsc(sourceDocument.name)}</b>.</p>
        <p>Niveau : <b>${canonicalLevel}</b> — liste : <b>${add2eScrollWritingEsc(listText)}</b>.</p>
        <p>Le parchemin sera ajouté à l'équipement et pourra être lancé une fois sans préparation ni composant.</p>
        <p><em>Cette version ne consomme encore ni support vierge, ni plume, ni encre magique.</em></p>
      </div>
    `,
    yes: {
      label: "Écrire le parchemin",
      icon: "<i class='fas fa-pen-nib'></i>"
    },
    no: {
      label: "Annuler",
      icon: "<i class='fas fa-times'></i>"
    }
  });

  if (!confirmed) return false;

  if (game.combat?.started === true) {
    ui.notifications.warn("Le combat a commencé : l'écriture du parchemin est annulée.");
    return false;
  }

  const primaryList = compatibleLists[0];
  const spellKey = stableSpellKey(sourceDocument, primaryList);
  if (!spellKey) {
    throw new Error(`Clé canonique introuvable pour le sort « ${sourceDocument.name} ».`);
  }

  const entry = {
    key: spellKey,
    name: sourceDocument.name,
    level: canonicalLevel,
    lists: [...compatibleLists],
    sourceUuid: sourceDocument.uuid,
    img: sourceDocument.img || spell.img || "icons/svg/book.svg"
  };

  const existing = Array.from(actor.items ?? []).find(item =>
    add2eScrollWritingIsSingleSpellScroll(item, spellKey)
  ) ?? null;

  let scroll;
  let quantity;

  if (existing) {
    quantity = itemQuantity(existing) + 1;
    await existing.update({
      "system.quantite": quantity,
      "flags.add2e.lastWrittenByActorUuid": actor.uuid,
      "flags.add2e.lastWrittenAt": new Date().toISOString()
    }, {
      add2eInternal: true,
      add2eArcaneScroll: true,
      render: false
    });
    scroll = existing;
  } else {
    const name = `Parchemin de sort — ${sourceDocument.name}`;
    const [created] = await actor.createEmbeddedDocuments("Item", [{
      name,
      type: "objet",
      img: sourceDocument.img || spell.img || "icons/sundries/scrolls/scroll-runed-brown.webp",
      system: {
        nom: name,
        type: "objet",
        categorie: "equipement",
        sousType: "parchemin_de_sort",
        quantite: 1,
        poids: 0,
        equipee: false,
        magique: true,
        consommable: true,
        description: `Parchemin à usage unique contenant le sort ${sourceDocument.name}.`,
        arcaneDocument: {
          schema: 1,
          kind: "spell-scroll",
          personal: false,
          createdByActorUuid: actor.uuid,
          createdFromSpellUuid: sourceDocument.uuid,
          spells: [entry]
        }
      },
      effects: [],
      flags: {
        add2e: {
          arcaneDocumentKind: "spell-scroll",
          generatedBy: ADD2E_SCROLL_WRITING_VERSION,
          writtenByActorUuid: actor.uuid,
          writtenFromSpellUuid: sourceDocument.uuid,
          writtenAt: new Date().toISOString()
        }
      }
    }], {
      add2eInternal: true,
      add2eArcaneScroll: true,
      render: false
    });

    scroll = created ?? null;
    quantity = scroll ? 1 : 0;
  }

  if (!scroll) {
    ui.notifications.error("La création du parchemin a échoué.");
    return false;
  }

  const build = globalThis.add2eBuildChatCard;
  const create = globalThis.add2eCreateChatCard;
  if (typeof build !== "function" || typeof create !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  const card = {
    actor,
    title: "Parchemin écrit",
    icon: "fas fa-scroll",
    variant: "success",
    source: {
      name: actor.name,
      img: actor.img,
      type: "Écriture de parchemin"
    },
    rows: [
      { label: "Sort", value: sourceDocument.name },
      { label: "Liste", value: listText },
      { label: "Quantité disponible", value: quantity }
    ],
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor })
    }
  };
  build(card);
  await create(card);

  globalThis.add2eRerenderActorSheet?.(actor, true);
  return true;
}

function add2eAnnotateSpellRowsForScrollWriting(data, actor) {
  const actorLists = actorArcaneLists(actor);
  const combatStarted = game.combat?.started === true;

  for (const level of data?.add2eSpellLevels ?? []) {
    for (const group of level?.groups ?? []) {
      for (const spell of group?.sorts ?? []) {
        const compatible = spellLists(spell)
          .filter(list => ARCANE_LISTS.has(list) && actorLists.includes(list));

        const eligible = spell?.isRegularSpell !== false
          && !spell?.isObjectPower
          && !spell?.isCapacity
          && compatible.length > 0;

        spell.canWriteScroll = eligible;
        spell.writeScrollBlockedCombat = eligible && combatStarted;
        spell.scrollWritingGroupKey = compatible[0] ?? "";
      }
    }
  }

  return data;
}

function add2eInstallScrollWritingDataPatch() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto || proto.__add2eScrollWritingDataV1 || typeof proto.getData !== "function") return false;

  proto.__add2eScrollWritingDataV1 = true;
  const originalGetData = proto.getData;

  proto.getData = async function add2eScrollWritingGetData(...args) {
    const data = await originalGetData.apply(this, args);
    return add2eAnnotateSpellRowsForScrollWriting(data, this.actor ?? data?.actor);
  };

  return true;
}

function add2eInstallScrollWritingListeners() {
  const proto = globalThis.Add2eActorSheet?.prototype;
  if (!proto || proto.__add2eScrollWritingListenersV1 || typeof proto.activateListeners !== "function") return false;

  proto.__add2eScrollWritingListenersV1 = true;
  const originalActivateListeners = proto.activateListeners;

  proto.activateListeners = function add2eScrollWritingActivateListeners(html) {
    const result = originalActivateListeners.call(this, html);
    const jq = html?.jquery ? html : $(html);

    jq.find(".add2e-create-scroll-from-spell")
      .off("click.add2eCreateScroll")
      .on("click.add2eCreateScroll", async event => {
        event.preventDefault();
        event.stopPropagation();

        const itemId = String(event.currentTarget?.dataset?.sortId ?? "").trim();
        const spell = this.actor?.items?.get?.(itemId) ?? null;

        if (!spell) {
          ui.notifications.warn("Sort introuvable pour l'écriture du parchemin.");
          return false;
        }

        this._add2eRememberActiveTab?.(jq);

        try {
          await add2eWriteKnownSpellToScroll(this.actor, spell);
        } catch (error) {
          console.error("[ADD2E][SCROLL_WRITING][ERROR]", {
            actor: this.actor?.name,
            spell: spell.name,
            error
          });
          ui.notifications.error(error?.message || "Erreur pendant l'écriture du parchemin.");
        }

        return false;
      });

    return result;
  };

  return true;
}

add2eInstallSheetListenerRecovery();
add2eInstallScrollWritingDataPatch();
add2eInstallScrollWritingListeners();

globalThis.add2eWriteKnownSpellToScroll = add2eWriteKnownSpellToScroll;
