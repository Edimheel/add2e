// ADD2E — Point d'entrée des écouteurs de feuille ApplicationV2.
// Les comportements sont répartis en modules fonctionnels sans modifier les sélecteurs ni l'ordre d'exécution.

import "./13d-actor-sheet-listeners-core.mjs";

const ADD2E_SHEET_LISTENER_RECOVERY_VERSION = "2026-07-05-sheet-tabs-force-ex-v1";

const ADD2E_SCROLL_WRITING_VERSION = "2026-07-13-known-spell-scroll-writing-v1";
const ADD2E_SCROLL_WRITING_LISTS = new Set(["magicien", "illusionniste"]);
let ADD2E_SCROLL_WRITING_INDEX_PROMISE = null;

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

function add2eScrollWritingNorm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eScrollWritingEsc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function add2eScrollWritingArray(value) {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(add2eScrollWritingArray);
  if (value instanceof Set) return [...value].flatMap(add2eScrollWritingArray);
  if (typeof value === "string") {
    return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
  }
  if (typeof value === "object") {
    for (const key of ["lists", "spellLists", "classes", "classe", "class", "items", "value", "values"]) {
      if (value[key] !== undefined) return add2eScrollWritingArray(value[key]);
    }
  }
  return [value];
}

function add2eScrollWritingListKey(value) {
  try {
    if (typeof globalThis.add2eNormalizeSpellKey === "function") {
      return globalThis.add2eNormalizeSpellKey(value);
    }
  } catch (_error) {}

  const key = add2eScrollWritingNorm(value);
  return ({
    wizard: "magicien",
    mage: "magicien",
    magician: "magicien",
    magic_user: "magicien",
    illusionist: "illusionniste"
  })[key] ?? key;
}

function add2eScrollWritingItemType(item) {
  return String(item?.type ?? "").toLowerCase();
}

function add2eScrollWritingLevel(item) {
  return Math.max(1, Number(
    item?.system?.niveau
    ?? item?.system?.level
    ?? item?.system?.niveau_sort
    ?? item?.system?.spellLevel
    ?? item?.level
    ?? 1
  ) || 1);
}

function add2eScrollWritingLists(item) {
  try {
    if (typeof globalThis.add2eGetSpellListsFromItem === "function") {
      return [...new Set(
        globalThis.add2eGetSpellListsFromItem(item)
          .map(add2eScrollWritingListKey)
          .filter(Boolean)
      )];
    }
  } catch (_error) {}

  const system = item?.system ?? {};
  const flags = item?.flags?.add2e ?? {};
  return [...new Set([
    flags.knownSpellLists,
    flags.learnedSpellLists,
    flags.grantedSpellLists,
    system.spellLists,
    system.lists,
    system.liste,
    system.liste_sort,
    system.listeSort,
    system.classe,
    system.class,
    item?.entries?.map?.(entry => entry?.key)
  ].flatMap(add2eScrollWritingArray).map(add2eScrollWritingListKey).filter(Boolean))];
}

function add2eScrollWritingActorLists(actor) {
  const lists = new Set();

  try {
    for (const entry of globalThis.add2eGetSpellcastingEntries?.(actor) ?? []) {
      const key = add2eScrollWritingListKey(entry?.key);
      if (ADD2E_SCROLL_WRITING_LISTS.has(key)) lists.add(key);
    }
  } catch (_error) {}

  for (const item of actor?.items ?? []) {
    if (add2eScrollWritingItemType(item) !== "classe") continue;
    const system = item.system ?? {};
    for (const value of [item.name, system.slug, system.label, system.nom, system.name]) {
      const key = add2eScrollWritingListKey(value);
      if (ADD2E_SCROLL_WRITING_LISTS.has(key)) lists.add(key);
    }
  }

  return [...lists];
}

function add2eScrollWritingSourceUuid(item) {
  return String(
    item?.flags?.core?.sourceId
    ?? item?._stats?.compendiumSource
    ?? item?.flags?.add2e?.sourceUuid
    ?? item?.flags?.add2e?.dropResolvedUuid
    ?? ""
  ).trim();
}

function add2eScrollWritingStableKey(item, list) {
  const configured = String(
    item?.flags?.add2e?.stableSpellKey
    ?? item?.flags?.add2e?.spellStableKey
    ?? ""
  ).trim();

  if (configured) return configured;
  return `${add2eScrollWritingListKey(list)}|${add2eScrollWritingLevel(item)}|${add2eScrollWritingNorm(item?.name)}`;
}

function add2eScrollWritingPackEntries(index) {
  if (!index) return [];
  if (Array.isArray(index.contents)) return index.contents;
  if (typeof index.values === "function") return [...index.values()];
  try { return [...index]; } catch (_error) { return []; }
}

async function add2eScrollWritingBuildIndex() {
  if (ADD2E_SCROLL_WRITING_INDEX_PROMISE) return ADD2E_SCROLL_WRITING_INDEX_PROMISE;

  ADD2E_SCROLL_WRITING_INDEX_PROMISE = (async () => {
    const candidates = [];

    for (const id of ["add2e.sorts", "world.sorts"]) {
      const pack = game.packs?.get?.(id);
      if (pack?.documentName !== "Item") continue;

      let index;
      try {
        index = await pack.getIndex({
          fields: [
            "name",
            "type",
            "system.niveau",
            "system.level",
            "system.spellLists",
            "system.liste",
            "system.classe",
            "flags.add2e.learnedSpellLists",
            "flags.add2e.knownSpellLists"
          ]
        });
      } catch (_error) {
        index = await pack.getIndex();
      }

      for (const entry of add2eScrollWritingPackEntries(index)) {
        if (add2eScrollWritingItemType(entry) !== "sort") continue;
        candidates.push({
          pack,
          id: entry._id,
          name: entry.name,
          level: add2eScrollWritingLevel(entry),
          lists: add2eScrollWritingLists(entry)
        });
      }
    }

    return candidates;
  })();

  return ADD2E_SCROLL_WRITING_INDEX_PROMISE;
}

async function add2eScrollWritingResolveCanonical(spell, compatibleLists) {
  const sourceUuid = add2eScrollWritingSourceUuid(spell);

  if (sourceUuid.startsWith("Compendium.") && typeof fromUuid === "function") {
    try {
      const document = await fromUuid(sourceUuid);
      if (document?.documentName === "Item" && add2eScrollWritingItemType(document) === "sort") {
        return document;
      }
    } catch (_error) {}
  }

  const wantedName = add2eScrollWritingNorm(spell?.name);
  const wantedLevel = add2eScrollWritingLevel(spell);
  const candidates = (await add2eScrollWritingBuildIndex()).filter(candidate =>
    add2eScrollWritingNorm(candidate.name) === wantedName
    && candidate.level === wantedLevel
  );

  const selected = candidates.find(candidate =>
    !compatibleLists.length
    || compatibleLists.some(list => candidate.lists.includes(list))
  ) ?? candidates[0] ?? null;

  return selected ? selected.pack.getDocument(selected.id) : null;
}

function add2eScrollWritingDocumentEntries(item) {
  try {
    const entries = globalThis.ADD2E_ARCANE_DOCUMENTS?.documentEntries?.(item);
    if (Array.isArray(entries)) return entries;
  } catch (_error) {}

  const document = item?.system?.arcaneDocument ?? {};
  const source = Array.isArray(document.spells)
    ? document.spells
    : document.spell
      ? [document.spell]
      : [];

  return source;
}

function add2eScrollWritingQuantity(item) {
  const value = item?.system?.quantite ?? item?.system?.quantity;
  if (value === undefined || value === null || value === "") return 1;
  return Math.max(0, Math.floor(Number(value) || 0));
}

function add2eScrollWritingIsSingleSpellScroll(item, spellKey) {
  if (add2eScrollWritingItemType(item) !== "objet") return false;

  const kind = String(
    item?.system?.arcaneDocument?.kind
    ?? item?.flags?.add2e?.arcaneDocumentKind
    ?? ""
  ).toLowerCase();

  if (kind !== "spell-scroll") return false;

  const entries = add2eScrollWritingDocumentEntries(item);
  return entries.length === 1 && String(entries[0]?.key ?? "") === String(spellKey);
}

async function add2eWriteKnownSpellToScroll(actor, spell) {
  if (!actor || !spell || add2eScrollWritingItemType(spell) !== "sort") return false;

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

  const actorLists = add2eScrollWritingActorLists(actor);
  const compatibleLists = add2eScrollWritingLists(spell)
    .filter(list => ADD2E_SCROLL_WRITING_LISTS.has(list) && actorLists.includes(list));

  if (!compatibleLists.length) {
    ui.notifications.warn(`${spell.name} n'est pas un sort connu de Magicien ou d'Illusionniste pour ${actor.name}.`);
    return false;
  }

  const sourceDocument = await add2eScrollWritingResolveCanonical(spell, compatibleLists);
  if (!sourceDocument) {
    ui.notifications.error(`${spell.name} est introuvable dans le compendium add2e.sorts.`);
    return false;
  }

  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.confirm) {
    ui.notifications.error("DialogV2 est introuvable.");
    return false;
  }

  const listLabel = compatibleLists
    .map(list => list === "illusionniste" ? "Illusionniste" : "Magicien")
    .join(" / ");

  const confirmed = await DialogV2.confirm({
    window: { title: `Écrire un parchemin — ${sourceDocument.name}` },
    modal: true,
    content: `
      <div class="add2e-dialog" style="min-width:520px;padding:8px;">
        <p><b>${add2eScrollWritingEsc(actor.name)}</b> va écrire un parchemin contenant <b>${add2eScrollWritingEsc(sourceDocument.name)}</b>.</p>
        <p>Niveau : <b>${add2eScrollWritingLevel(sourceDocument)}</b> — liste : <b>${add2eScrollWritingEsc(listLabel)}</b>.</p>
        <p>Le parchemin sera ajouté à l'équipement et pourra être lancé une fois sans préparation ni composant.</p>
        <p><em>Cette version ne consomme encore ni support vierge, ni plume, ni encre magique.</em></p>
      </div>
    `,
    yes: {
      label: "Écrire le parchemin",
      icon: "fa-solid fa-pen-nib"
    },
    no: {
      label: "Annuler",
      icon: "fa-solid fa-xmark"
    }
  });

  if (!confirmed) return false;

  if (game.combat?.started === true) {
    ui.notifications.warn("Le combat a commencé : l'écriture du parchemin est annulée.");
    return false;
  }

  const primaryList = compatibleLists[0];
  const spellKey = add2eScrollWritingStableKey(sourceDocument, primaryList);
  const entry = {
    key: spellKey,
    name: sourceDocument.name,
    level: add2eScrollWritingLevel(sourceDocument),
    lists: compatibleLists,
    sourceUuid: sourceDocument.uuid,
    img: sourceDocument.img || spell.img || "icons/svg/book.svg"
  };

  const existing = Array.from(actor.items ?? []).find(item =>
    add2eScrollWritingIsSingleSpellScroll(item, spellKey)
  ) ?? null;

  let scroll;
  let quantity;

  if (existing) {
    quantity = add2eScrollWritingQuantity(existing) + 1;
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

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="add2e-chat-card" style="border:1px solid #75552b;border-radius:8px;background:#fff8e7;padding:8px;">
        <h3 style="margin:0 0 6px;">Parchemin écrit</h3>
        <p><b>${add2eScrollWritingEsc(sourceDocument.name)}</b> a été inscrit sur un parchemin.</p>
        <p>Quantité disponible : <b>${quantity}</b>.</p>
      </div>
    `
  });

  globalThis.add2eRerenderActorSheet?.(actor, true);
  return true;
}

function add2eAnnotateSpellRowsForScrollWriting(data, actor) {
  const actorLists = add2eScrollWritingActorLists(actor);
  const combatStarted = game.combat?.started === true;

  for (const level of data?.add2eSpellLevels ?? []) {
    for (const group of level?.groups ?? []) {
      for (const spell of group?.sorts ?? []) {
        const compatible = add2eScrollWritingLists(spell)
          .filter(list => ADD2E_SCROLL_WRITING_LISTS.has(list) && actorLists.includes(list));

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
