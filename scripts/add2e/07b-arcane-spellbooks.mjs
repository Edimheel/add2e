// ADD2E — Documents arcaniques : livres de sorts et synchronisation.
import {
  VERSION,
  ARCANE_LISTS,
  BOOK_NAMES,
  BOOK_IMAGES,
  clone,
  norm,
  esc,
  listKey,
  listLabel,
  spellLevel,
  spellLists,
  actorArcaneLists,
  cleanEmbedded,
  arcaneData,
  isSpellbook,
  documentEntries,
  entryFromSpell,
  isKnownSpell,
  resolveSpell,
  arcaneChatCard,
  createArcaneChatMessage
} from "./07b-arcane-documents-core.mjs";
import { hydrateScroll } from "./07b-arcane-scrolls.mjs";

const SYNC_LOCKS = new Set();
const SYNC_TIMERS = new Map();
const DETACH_LOCKS = new Set();

function knownEntries(actor, list) {
  const wantedList = listKey(list);
  const seen = new Set();
  const entries = [];
  for (const spell of actor?.items ?? []) {
    if (!isKnownSpell(spell) || !spellLists(spell).includes(wantedList)) continue;
    const entry = entryFromSpell(spell, wantedList);
    if (!entry) continue;
    const unique = `${entry.key}|${wantedList}`;
    if (seen.has(unique)) continue;
    seen.add(unique);
    entries.push(entry);
  }
  return entries.sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, "fr"));
}

function personalBook(actor, list) {
  const wantedList = listKey(list);
  return Array.from(actor?.items ?? []).find(item => {
    if (!isSpellbook(item)) return false;
    const data = arcaneData(item);
    const ownerUuid = String(data.ownerActorUuid ?? item.flags?.add2e?.ownerActorUuid ?? "");
    return data.personal === true && listKey(data.ownerList) === wantedList && (!ownerUuid || ownerUuid === actor.uuid);
  }) ?? null;
}

async function ensurePersonalBook(actor, list) {
  const wantedList = listKey(list);
  if (!ARCANE_LISTS.has(wantedList)) return null;
  const spells = knownEntries(actor, wantedList);
  let book = personalBook(actor, wantedList);
  if (!book) {
    const name = BOOK_NAMES[wantedList];
    const [created] = await actor.createEmbeddedDocuments("Item", [{
      name,
      type: "objet",
      img: BOOK_IMAGES[wantedList] ?? "icons/svg/book.svg",
      system: {
        nom: name,
        type: "objet",
        categorie: "equipement",
        sousType: "livre_de_sorts",
        quantite: 1,
        poids: 5,
        equipee: false,
        magique: false,
        consommable: false,
        description: "Livre personnel contenant les sorts connus du personnage.",
        arcaneDocument: { schema: 1, kind: "spellbook", personal: true, ownerList: wantedList, ownerActorUuid: actor.uuid, spells }
      },
      effects: [],
      flags: { add2e: { arcaneDocumentKind: "spellbook", personalSpellbook: true, ownerActorUuid: actor.uuid, ownerSpellList: wantedList, generatedBy: VERSION } }
    }], { add2eInternal: true, add2eArcaneSync: true, render: false });
    return created ?? null;
  }
  const current = arcaneData(book);
  const next = { ...clone(current), schema: 1, kind: "spellbook", personal: true, ownerList: wantedList, ownerActorUuid: actor.uuid, spells };
  if (book.name !== BOOK_NAMES[wantedList] || JSON.stringify(current) !== JSON.stringify(next)) {
    await book.update({
      name: BOOK_NAMES[wantedList],
      "system.nom": BOOK_NAMES[wantedList],
      "system.arcaneDocument": next,
      "flags.add2e.arcaneDocumentKind": "spellbook",
      "flags.add2e.personalSpellbook": true,
      "flags.add2e.ownerActorUuid": actor.uuid,
      "flags.add2e.ownerSpellList": wantedList,
      "flags.add2e.generatedBy": VERSION
    }, { add2eInternal: true, add2eArcaneSync: true, render: false });
  }
  return book;
}

export function responsibleGM() {
  if (!game.user?.isGM) return false;
  const activeGM = game.users?.activeGM ?? Array.from(game.users ?? []).find(user => user.active && user.isGM) ?? null;
  return !activeGM || activeGM.id === game.user.id;
}

export function actorDead(actor) {
  if (!actor) return false;
  const system = actor.system ?? {};
  const values = [system.pdv, system.hp?.value, system.attributes?.hp?.value, system.points_de_vie?.value, system.vie?.value];
  const hp = values.map(value => value === undefined || value === null || value === "" ? NaN : Number(value)).find(Number.isFinite);
  const actorType = norm(actor.type);
  const deathThreshold = ["personnage", "pnj"].includes(actorType) ? -11 : 0;
  if (Number.isFinite(hp) && hp <= deathThreshold) return true;
  const directStatus = norm(actor.getFlag?.("add2e", "vitalStatus") ?? actor.flags?.add2e?.vitalStatus ?? system.vitalStatus ?? system.etat ?? system.status ?? "");
  if (["dead", "mort", "deceased"].includes(directStatus)) return true;
  return Array.from(actor.effects ?? []).some(effect => {
    if (effect?.disabled === true) return false;
    const statuses = Array.from(effect?.statuses ?? []).map(norm);
    const label = norm(`${effect?.name ?? ""} ${effect?.label ?? ""} ${effect?.flags?.add2e?.kind ?? ""}`);
    return statuses.some(status => ["dead", "mort", "deceased"].includes(status)) || label === "dead" || label === "mort" || label.includes("status_dead") || label.includes("etat_mort");
  });
}

export function actorHostile(actor) {
  if (!actor) return false;
  const hostile = CONST?.TOKEN_DISPOSITIONS?.HOSTILE ?? -1;
  try {
    const tokens = actor.getActiveTokens?.(true, true) ?? actor.getActiveTokens?.() ?? [];
    if (Array.from(tokens).some(token => Number(token?.document?.disposition ?? token?.disposition) === hostile)) return true;
  } catch (_error) {}
  return Number(actor.prototypeToken?.disposition) === hostile || Number(actor.token?.disposition) === hostile;
}

export async function detachPersonalSpellbooks(actor, { reason = "loot-death" } = {}) {
  if (!actor?.items || !responsibleGM()) return { detached: 0 };
  const lockKey = actor.uuid ?? actor.id;
  if (DETACH_LOCKS.has(lockKey)) return { detached: 0, locked: true };
  DETACH_LOCKS.add(lockKey);
  try {
    let detached = 0;
    for (const book of Array.from(actor.items).filter(isSpellbook)) {
      const current = arcaneData(book);
      if (current.personal !== true && book.flags?.add2e?.personalSpellbook !== true) continue;
      const next = { ...clone(current), schema: 1, kind: "spellbook", personal: false, ownerActorUuid: "", spells: documentEntries(book) };
      await book.update({
        "system.arcaneDocument": next,
        "system.magique": true,
        "system.consommable": false,
        "flags.add2e.arcaneDocumentKind": "spellbook",
        "flags.add2e.personalSpellbook": false,
        "flags.add2e.ownerActorUuid": "",
        "flags.add2e.detachedForLoot": true,
        "flags.add2e.detachedForLootReason": reason,
        "flags.add2e.detachedForLootAt": new Date().toISOString()
      }, { add2eInternal: true, add2eArcaneSync: true, add2eArcaneLootDetach: true, render: false });
      detached += 1;
    }
    if (detached > 0 || actor.getFlag?.("add2e", "arcaneBooksDetachedForLoot") !== true) {
      await actor.update({
        "flags.add2e.arcaneBooksDetachedForLoot": true,
        "flags.add2e.isLootCorpse": true,
        "flags.add2e.arcaneBooksDetachedAt": new Date().toISOString(),
        "flags.add2e.arcaneBooksDetachedReason": reason
      }, { add2eInternal: true, add2eArcaneLootDetach: true, render: false });
    }
    return { detached };
  } finally {
    DETACH_LOCKS.delete(lockKey);
  }
}

export async function restorePersonalBookSync(actor, { reason = "actor-restored" } = {}) {
  if (!actor || actor.getFlag?.("add2e", "arcaneBooksDetachedForLoot") !== true || !responsibleGM()) return false;
  await actor.update({
    "flags.add2e.arcaneBooksDetachedForLoot": false,
    "flags.add2e.isLootCorpse": false,
    "flags.add2e.arcaneBooksDetachedReason": reason
  }, { add2eInternal: true, add2eArcaneLootDetach: true, render: false });
  await syncActorSpellbooks(actor, { reason });
  return true;
}

export async function syncActorSpellbooks(actor, { reason = "sync" } = {}) {
  if (!actor || actor.type !== "personnage" || !actor.items) return { books: 0, scrolls: 0 };
  const lockKey = actor.uuid ?? actor.id;
  if (SYNC_LOCKS.has(lockKey)) return { books: 0, scrolls: 0, locked: true };
  SYNC_LOCKS.add(lockKey);
  try {
    const lists = actorArcaneLists(actor);
    const detachedForLoot = actor.getFlag?.("add2e", "arcaneBooksDetachedForLoot") === true;
    let books = 0;
    let scrolls = 0;
    if (!detachedForLoot) {
      for (const list of lists) if (await ensurePersonalBook(actor, list)) books += 1;
    }
    for (const book of Array.from(actor.items).filter(isSpellbook)) {
      const data = arcaneData(book);
      const ownerUuid = String(data.ownerActorUuid ?? "");
      if (data.personal === true && ownerUuid && ownerUuid !== actor.uuid) {
        await book.update({
          "system.arcaneDocument.personal": false,
          "system.arcaneDocument.ownerActorUuid": "",
          "flags.add2e.personalSpellbook": false,
          "flags.add2e.ownerActorUuid": ""
        }, { add2eInternal: true, add2eArcaneSync: true, render: false });
      }
    }
    for (const item of Array.from(actor.items)) if (await hydrateScroll(item)) scrolls += 1;
    console.info("[ADD2E][ARCANE_DOCUMENTS][SYNC]", { version: VERSION, actor: actor.name, reason, lists, books, scrolls, detachedForLoot });
    return { books, scrolls, detachedForLoot };
  } finally {
    SYNC_LOCKS.delete(lockKey);
  }
}

export function scheduleSync(actor, reason) {
  if (!actor?.id) return;
  const key = actor.uuid ?? actor.id;
  if (SYNC_TIMERS.has(key)) clearTimeout(SYNC_TIMERS.get(key));
  SYNC_TIMERS.set(key, setTimeout(() => {
    SYNC_TIMERS.delete(key);
    syncActorSpellbooks(actor, { reason }).catch(error => console.error("[ADD2E][ARCANE_DOCUMENTS][SYNC_ERROR]", { actor: actor.name, reason, error }));
  }, 60));
}

function actorIntelligence(actor) {
  const system = actor?.system ?? {};
  const direct = Number(system.intelligence ?? system.intelligence_total ?? system.intelligenceTotal);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
  return Math.floor((Number(system.intelligence_base) || 10) + (Number(system.intelligence_race) || 0) + (Number(system.bonus_caracteristiques?.intelligence) || 0));
}

function learningChance(actor) {
  const intelligence = Math.max(3, Math.min(18, actorIntelligence(actor)));
  const tableChance = Number(globalThis.INTELLIGENCE_TABLE?.[intelligence]?.chance_sort);
  if (Number.isFinite(tableChance)) return Math.max(0, Math.min(100, tableChance));
  return ({ 9: 35, 10: 45, 11: 45, 12: 45, 13: 55, 14: 55, 15: 65, 16: 65, 17: 75, 18: 85 })[intelligence] ?? 0;
}

function actorKnows(actor, entry, list) {
  const wantedList = listKey(list);
  return Array.from(actor?.items ?? []).some(item => isKnownSpell(item) && spellLevel(item) === entry.level && norm(item.name) === norm(entry.name) && spellLists(item).includes(wantedList));
}

async function addKnownSpell(actor, sourceDocument, entry, lists, metadata) {
  const allowedLists = [...new Set(lists.map(listKey).filter(list => ARCANE_LISTS.has(list)))];
  if (!allowedLists.length) return null;
  let existing = Array.from(actor.items).find(item => isKnownSpell(item) && spellLevel(item) === entry.level && norm(item.name) === norm(entry.name)) ?? null;
  if (existing) {
    const mergedLists = [...new Set([...spellLists(existing), ...allowedLists])];
    await existing.update({
      "system.spellLists": mergedLists,
      "flags.add2e.learnedSpellLists": mergedLists,
      "flags.add2e.knownSpellLists": mergedLists,
      "flags.add2e.manuallyLearnedSpell": true,
      "flags.add2e.lastLearnedSpellList": allowedLists[0] ?? mergedLists[0] ?? "",
      "flags.add2e.learnedFromSpellbookUuid": metadata.bookUuid,
      "flags.add2e.learnedFromSpellbookName": metadata.bookName,
      "flags.add2e.spellbookCopyRoll": metadata.roll,
      "flags.add2e.spellbookCopyChance": metadata.chance
    }, { add2eInternal: true, add2eArcaneCopy: true, render: false });
    return existing;
  }
  const data = cleanEmbedded(sourceDocument.toObject());
  data.system ??= {};
  data.flags ??= {};
  data.flags.core ??= {};
  data.flags.add2e ??= {};
  data.system.spellLists = allowedLists;
  data.flags.core.sourceId = sourceDocument.uuid;
  data.flags.add2e.learnedSpellLists = allowedLists;
  data.flags.add2e.knownSpellLists = allowedLists;
  data.flags.add2e.manuallyLearnedSpell = true;
  data.flags.add2e.lastLearnedSpellList = allowedLists[0] ?? "";
  data.flags.add2e.learnedFromSpellbookUuid = metadata.bookUuid;
  data.flags.add2e.learnedFromSpellbookName = metadata.bookName;
  data.flags.add2e.spellbookCopyRoll = metadata.roll;
  data.flags.add2e.spellbookCopyChance = metadata.chance;
  const [created] = await actor.createEmbeddedDocuments("Item", [data], { add2eInternal: true, add2eArcaneCopy: true, render: false });
  return created ?? null;
}

async function selectBookSpells(actor, book, candidates, chance) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return null;
  const rows = candidates.map((candidate, index) => `
    <label style="display:grid;grid-template-columns:28px 1fr 75px 150px;gap:8px;align-items:center;padding:5px 6px;border-bottom:1px solid #d5c7a6;">
      <input type="checkbox" value="${index}">
      <span><b>${esc(candidate.entry.name)}</b></span>
      <span>Niv. ${candidate.entry.level}</span>
      <span>${esc(candidate.lists.map(listLabel).join(" / "))}</span>
    </label>`).join("");
  return DialogV2.wait({
    window: { title: `Copier depuis ${book.name}` },
    modal: true,
    rejectClose: false,
    content: `<form class="add2e-copy-spellbook" style="min-width:680px;max-height:650px;overflow:auto;padding:8px;">
      <p><b>${esc(actor.name)}</b> peut tenter de copier tous les sorts sélectionnés.</p>
      <p>Intelligence : <b>${actorIntelligence(actor)}</b> — chance par sort : <b>${chance}%</b>. Aucune limite de nombre n’est appliquée.</p>
      <div style="display:grid;grid-template-columns:28px 1fr 75px 150px;gap:8px;font-weight:800;padding:5px 6px;background:#eadfca;"><span></span><span>Sort</span><span>Niveau</span><span>Livre personnel</span></div>
      ${rows}</form>`,
    buttons: [
      {
        action: "copy",
        label: "Copier les sorts sélectionnés",
        icon: "fa-solid fa-copy",
        default: true,
        callback: (_event, button, dialog) => {
          const element = dialog?.element?.jquery ? dialog.element[0] : dialog?.element;
          const form = button?.form ?? element?.querySelector?.("form.add2e-copy-spellbook");
          if (!form) return null;
          return [...form.querySelectorAll('input[type="checkbox"]:checked')].map(input => Number(input.value)).filter(Number.isInteger);
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark" }
    ]
  });
}

export async function copySpellbook(actor, book, requestedSpellKey = "") {
  if (!actor || !book || !isSpellbook(book)) return false;
  await syncActorSpellbooks(actor, { reason: "before-copy" });
  const compatibleActorLists = actorArcaneLists(actor);
  if (!compatibleActorLists.length) {
    ui.notifications.warn(`${actor.name} n'est ni Magicien ni Illusionniste.`);
    return false;
  }
  const candidates = [];
  for (const entry of documentEntries(book)) {
    const compatible = entry.lists.filter(list => compatibleActorLists.includes(list));
    const unknown = compatible.filter(list => !actorKnows(actor, entry, list));
    if (unknown.length) candidates.push({ entry, lists: unknown });
  }
  if (!candidates.length) {
    ui.notifications.info("Aucun sort compatible et inconnu à copier dans ce livre.");
    return false;
  }
  const chance = learningChance(actor);
  const requestedKey = String(requestedSpellKey ?? "").trim();
  const individualCopy = Boolean(requestedKey);
  let selected;
  if (individualCopy) {
    const candidateIndex = candidates.findIndex(candidate => String(candidate.entry.key) === requestedKey);
    if (candidateIndex < 0) {
      ui.notifications.info("Ce sort est déjà connu ou n'est pas compatible avec ce personnage.");
      return false;
    }
    selected = [candidateIndex];
  } else {
    selected = await selectBookSpells(actor, book, candidates, chance);
  }
  if (!selected?.length) return false;
  const copied = [];
  const failed = [];
  const errors = [];
  for (const index of selected) {
    const candidate = candidates[index];
    if (!candidate) continue;
    const roll = await new Roll("1d100").evaluate();
    const total = Number(roll.total) || 100;
    const success = total <= chance;
    try {
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: arcaneChatCard({
          actor,
          title: "Test de compréhension",
          source: `${candidate.entry.name} — ${book.name}`,
          result: success ? "Réussite" : "Échec",
          details: [`Résultat : <b>${total}</b>`, `Chance : <b>${chance}%</b>`],
          status: success ? "success" : "failure",
          icon: "fa-dice-d20",
          image: book.img
        })
      });
    } catch (error) {
      console.warn("[ADD2E][ARCANE_DOCUMENTS][BOOK_COPY_ROLL_MESSAGE_FAILED]", { actor: actor.name, book: book.name, spell: candidate.entry.name, total, chance, error });
    }
    if (!success) {
      failed.push({ entry: candidate.entry, roll: total });
      continue;
    }
    const sourceDocument = await resolveSpell(candidate.entry);
    if (!sourceDocument) {
      errors.push({ entry: candidate.entry, message: "absent du compendium add2e.sorts" });
      continue;
    }
    const created = await addKnownSpell(actor, sourceDocument, candidate.entry, candidate.lists, { bookUuid: book.uuid, bookName: book.name, roll: total, chance });
    if (created) copied.push({ ...candidate, roll: total });
    else errors.push({ entry: candidate.entry, message: "création impossible" });
  }
  try { await globalThis.add2eExpandActorSpellFamilies?.(actor); } catch (_error) {}
  try { await globalThis.add2eRemoveDuplicateActorSpells?.(actor, "spellbook-copy"); } catch (_error) {}
  await syncActorSpellbooks(actor, { reason: "after-copy" });
  const copiedRows = copied.length ? copied.map(result => `<b>${esc(result.entry.name)}</b> — ${result.roll}/${chance} — ${esc(result.lists.map(listLabel).join(" / "))}`) : ["Aucun sort copié."];
  const failedRows = failed.length ? failed.map(result => `${esc(result.entry.name)} — ${result.roll}/${chance}`) : ["Aucun échec de compréhension."];
  const errorRows = errors.length ? errors.map(result => `${esc(result.entry.name)} — ${esc(result.message)}`) : [];
  await createArcaneChatMessage({
    actor,
    title: individualCopy ? "Copie d'un sort depuis un livre" : "Copie d'un livre de sorts",
    source: book.name,
    result: copied.length
      ? individualCopy
        ? `${copied[0].entry.name} a été ajouté au livre personnel et à la liste des sorts.`
        : `${copied.length} sort(s) ajouté(s) au livre personnel et à la liste des sorts.`
      : "Aucun sort n'a été ajouté.",
    details: [
      `<b>Réussites (${copied.length})</b> : ${copiedRows.join(" ; ")}`,
      `<b>Échecs (${failed.length})</b> : ${failedRows.join(" ; ")}`,
      ...(errorRows.length ? [`<b>Erreurs (${errors.length})</b> : ${errorRows.join(" ; ")}`] : [])
    ],
    status: copied.length ? "success" : "failure",
    icon: "fa-book-open",
    image: book.img
  });
  globalThis.add2eRerenderActorSheet?.(actor, true);
  return copied.length > 0;
}

export async function viewSpellbook(book, actor = null) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait || !book) return false;
  const entries = documentEntries(book);
  const actorLists = actor ? actorArcaneLists(actor) : [];
  const showCopyActions = Boolean(actor && arcaneData(book).personal !== true);
  const actionHeader = showCopyActions ? "<th style=\"width:90px;\">Action</th>" : "";
  const emptyColspan = showCopyActions ? 5 : 4;
  const rows = entries.length ? entries.map(entry => {
    let actionCell = "";
    if (showCopyActions) {
      const compatibleLists = entry.lists.filter(list => actorLists.includes(list));
      const unknownLists = compatibleLists.filter(list => !actorKnows(actor, entry, list));
      if (!compatibleLists.length) {
        actionCell = '<td style="text-align:center;"><span title="Liste de sort incompatible" style="opacity:.55;"><i class="fas fa-ban"></i></span></td>';
      } else if (!unknownLists.length) {
        actionCell = '<td style="text-align:center;"><span title="Sort déjà connu"><i class="fas fa-check"></i></span></td>';
      } else {
        actionCell = `<td style="text-align:center;">
          <button
            type="button"
            data-add2e-arcane-action="copy-book-entry"
            data-item-id="${esc(book.id)}"
            data-actor-id="${esc(actor.id)}"
            data-spell-key="${esc(entry.key)}"
            title="Copier uniquement ${esc(entry.name)} dans le livre personnel"
            style="width:34px;height:30px;cursor:pointer;"
          ><i class="fas fa-copy"></i></button>
        </td>`;
      }
    }
    return `<tr>
      <td><img src="${esc(entry.img)}" width="28" height="28" style="object-fit:cover;border-radius:4px;"></td>
      <td><b>${esc(entry.name)}</b></td>
      <td>${entry.level}</td>
      <td>${esc(entry.lists.map(listLabel).join(" / "))}</td>
      ${actionCell}
    </tr>`;
  }).join("") : `<tr><td colspan="${emptyColspan}"><em>Aucun sort inscrit.</em></td></tr>`;
  await DialogV2.wait({
    window: { title: book.name },
    modal: true,
    rejectClose: false,
    content: `<div style="min-width:680px;max-height:650px;overflow:auto;padding:8px;">
      ${showCopyActions ? `<p>Chaque bouton <i class="fas fa-copy"></i> tente uniquement la copie du sort correspondant.</p>` : ""}
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr><th></th><th>Sort</th><th>Niveau</th><th>Liste</th>${actionHeader}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`,
    buttons: [{ action: "close", label: "Fermer", icon: "fa-solid fa-check", default: true }]
  });
  return true;
}
