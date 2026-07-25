// ADD2E — Livres de sorts personnels, copie et apprentissage.
// Compatible Foundry V13/V14/V15. DialogV2 uniquement.

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
  resolveSpell
} from "./07b-arcane-documents-core.mjs";
import { hydrateScroll } from "./07b-arcane-scrolls.mjs";

const SYNC_LOCKS = new Set();
const SYNC_TIMERS = new Map();
const DETACH_LOCKS = new Set();
const SPELLBOOK_DIALOGS = new Map();
const ADD2E_SPELL_LEARNING_VERSION = "2026-07-26-canonical-intelligence-learning-v2";

globalThis.ADD2E_SPELL_LEARNING_VERSION = ADD2E_SPELL_LEARNING_VERSION;

function actorKnownEntries(actor, list) {
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

function spellbookOwnerUuid(book) {
  const data = arcaneData(book);
  return String(data.ownerActorUuid ?? book?.flags?.add2e?.ownerActorUuid ?? "").trim();
}

function isCanonicalPersonalBook(actor, book, list = "") {
  if (!actor || !book || !isSpellbook(book)) return false;
  const data = arcaneData(book);
  const wantedList = listKey(list || data.ownerList || book?.flags?.add2e?.ownerSpellList);
  return data.personal === true
    && ARCANE_LISTS.has(wantedList)
    && listKey(data.ownerList) === wantedList
    && spellbookOwnerUuid(book) === actor.uuid;
}

function personalBook(actor, list) {
  const wantedList = listKey(list);
  return Array.from(actor?.items ?? []).find(item => isCanonicalPersonalBook(actor, item, wantedList)) ?? null;
}

async function externalizeForeignPersonalBook(actor, book, { reason = "ownership-normalization" } = {}) {
  if (!actor || !book || !isSpellbook(book)) return false;
  const current = arcaneData(book);
  const flaggedPersonal = current.personal === true || book.flags?.add2e?.personalSpellbook === true;
  if (!flaggedPersonal || isCanonicalPersonalBook(actor, book)) return false;
  const next = {
    ...clone(current),
    schema: 1,
    kind: "spellbook",
    personal: false,
    ownerActorUuid: "",
    spells: documentEntries(book).map(clone)
  };
  await book.update({
    "system.arcaneDocument": next,
    "system.magique": true,
    "system.consommable": false,
    "flags.add2e.arcaneDocumentKind": "spellbook",
    "flags.add2e.personalSpellbook": false,
    "flags.add2e.ownerActorUuid": "",
    "flags.add2e.spellbookOwnershipNormalized": true,
    "flags.add2e.spellbookOwnershipReason": reason,
    "flags.add2e.spellbookOwnershipNormalizedAt": new Date().toISOString()
  }, { add2eInternal: true, add2eArcaneSync: true, render: false });
  return true;
}

async function ensurePersonalBook(actor, list) {
  const wantedList = listKey(list);
  if (!ARCANE_LISTS.has(wantedList)) return null;
  const spells = actorKnownEntries(actor, wantedList);
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
        arcaneDocument: {
          schema: 1,
          kind: "spellbook",
          personal: true,
          ownerList: wantedList,
          ownerActorUuid: actor.uuid,
          spells
        }
      },
      effects: [],
      flags: {
        add2e: {
          arcaneDocumentKind: "spellbook",
          personalSpellbook: true,
          ownerActorUuid: actor.uuid,
          ownerSpellList: wantedList,
          generatedBy: VERSION
        }
      }
    }], { add2eInternal: true, add2eArcaneSync: true, render: false });
    return created ?? null;
  }

  const current = arcaneData(book);
  const next = {
    ...clone(current),
    schema: 1,
    kind: "spellbook",
    personal: true,
    ownerList: wantedList,
    ownerActorUuid: actor.uuid,
    spells
  };
  const expectedName = BOOK_NAMES[wantedList];
  if (book.name !== expectedName || JSON.stringify(current) !== JSON.stringify(next)) {
    await book.update({
      name: expectedName,
      "system.nom": expectedName,
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
  const hp = [
    system.pdv,
    system.hp?.value,
    system.attributes?.hp?.value,
    system.points_de_vie?.value,
    system.vie?.value
  ].map(value => value === null || value === undefined || value === "" ? NaN : Number(value)).find(Number.isFinite);
  const actorType = norm(actor.type);
  const deathThreshold = ["personnage", "pnj"].includes(actorType) ? -11 : 0;
  if (Number.isFinite(hp) && hp <= deathThreshold) return true;
  const directStatus = norm(actor.getFlag?.("add2e", "vitalStatus") ?? actor.flags?.add2e?.vitalStatus ?? system.vitalStatus ?? system.etat ?? system.status ?? "");
  if (["dead", "mort", "deceased"].includes(directStatus)) return true;
  return Array.from(actor.effects ?? []).some(effect => {
    if (effect?.disabled === true) return false;
    const statuses = Array.from(effect?.statuses ?? []).map(norm);
    const label = norm(`${effect?.name ?? ""} ${effect?.label ?? ""} ${effect?.flags?.add2e?.kind ?? ""}`);
    return statuses.some(status => ["dead", "mort", "deceased"].includes(status))
      || label === "dead"
      || label === "mort"
      || label.includes("status_dead")
      || label.includes("etat_mort");
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
      const next = {
        ...clone(current),
        schema: 1,
        kind: "spellbook",
        personal: false,
        ownerActorUuid: "",
        spells: documentEntries(book).map(clone)
      };
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
    let normalizedBooks = 0;
    let books = 0;
    let scrolls = 0;

    for (const book of Array.from(actor.items).filter(isSpellbook)) {
      if (await externalizeForeignPersonalBook(actor, book, { reason })) normalizedBooks += 1;
    }

    if (!detachedForLoot) {
      for (const list of lists) if (await ensurePersonalBook(actor, list)) books += 1;
    }
    for (const item of Array.from(actor.items)) if (await hydrateScroll(item)) scrolls += 1;
    return { books, scrolls, normalizedBooks, detachedForLoot, reason };
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

function intelligenceLearningProfile(actor) {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!engine || typeof engine.resolveAbilityDerived !== "function") {
    throw new Error("Le résolveur canonique ADD2E des profils dérivés n’est pas disponible.");
  }
  const derived = engine.resolveAbilityDerived(actor, "intelligence", {
    source: "spellbook-learning",
    consumer: "arcane-spellbooks"
  });
  const profile = derived?.profile ?? {};
  const rawMaximum = profile.max_sort;
  const unlimited = ["tous", "all", "unlimited", "illimite", "illimité"].includes(norm(rawMaximum));
  return {
    derived,
    score: Number(derived?.total) || 0,
    chance: Math.max(0, Math.min(100, Number(profile.chance_sort) || 0)),
    minimum: Math.max(0, Number(profile.min_sort) || 0),
    maximum: unlimited ? Infinity : Math.max(0, Number(rawMaximum) || 0),
    maximumLabel: unlimited ? "Tous" : String(Math.max(0, Number(rawMaximum) || 0)),
    maximumSpellLevel: Math.max(0, Number(profile.niveau_sort_max) || 0),
    languages: Math.max(0, Number(profile.langues) || 0),
    profile
  };
}

function actorKnows(actor, entry, list) {
  const wantedList = listKey(list);
  return Array.from(actor?.items ?? []).some(item =>
    isKnownSpell(item)
    && spellLevel(item) === entry.level
    && norm(item.name) === norm(entry.name)
    && spellLists(item).includes(wantedList)
  );
}

function knownCount(actor, list, level) {
  const wantedList = listKey(list);
  const wantedLevel = Number(level) || 1;
  return Array.from(actor?.items ?? []).filter(item =>
    isKnownSpell(item)
    && spellLevel(item) === wantedLevel
    && spellLists(item).includes(wantedList)
  ).length;
}

function learningHistory(actor) {
  const raw = actor?.getFlag?.("add2e", "spellLearningAttempts") ?? actor?.flags?.add2e?.spellLearningAttempts ?? {};
  return raw && typeof raw === "object" && !Array.isArray(raw) ? clone(raw) : {};
}

function learningRecord(history, list, level, key) {
  return history?.[listKey(list)]?.[String(Number(level) || 1)]?.[String(key ?? "")] ?? null;
}

async function storeLearningRecord(actor, list, entry, result) {
  const history = learningHistory(actor);
  const key = listKey(list);
  const level = String(Number(entry.level) || 1);
  history[key] ??= {};
  history[key][level] ??= {};
  const previous = history[key][level][entry.key] ?? {};
  history[key][level][entry.key] = {
    attempts: Math.max(0, Number(previous.attempts) || 0) + 1,
    lastRoll: Number(result.roll) || 0,
    chance: Number(result.chance) || 0,
    success: result.success === true,
    at: new Date().toISOString(),
    sourceBookUuid: String(result.book?.uuid ?? ""),
    sourceBookName: String(result.book?.name ?? "")
  };
  await actor.setFlag("add2e", "spellLearningAttempts", history);
}

function learningEligibility(actor, entry, lists, profile, history = learningHistory(actor)) {
  const allowedLists = [];
  const blocked = [];
  for (const rawList of lists) {
    const list = listKey(rawList);
    const count = knownCount(actor, list, entry.level);
    if (Number.isFinite(profile.maximum) && count >= profile.maximum) {
      blocked.push({ list, reason: "maximum", count });
      continue;
    }
    const previous = learningRecord(history, list, entry.level, entry.key);
    if (previous?.success === false && count >= profile.minimum) {
      blocked.push({ list, reason: "failed-once", count });
      continue;
    }
    allowedLists.push(list);
  }

  if (allowedLists.length) return { ok: true, reason: "ok", lists: allowedLists, blocked };
  const maximumBlocked = blocked.some(entryBlock => entryBlock.reason === "maximum");
  return {
    ok: false,
    reason: maximumBlocked ? "maximum" : "failed-once",
    lists: [],
    blocked,
    message: maximumBlocked
      ? `Maximum de ${profile.maximumLabel} sorts connus atteint pour ce niveau.`
      : "Ce sort a déjà été refusé et le minimum réglementaire de sorts connus est atteint."
  };
}

async function addKnownSpell(actor, sourceDocument, entry, lists, metadata) {
  const allowedLists = [...new Set(lists.map(listKey).filter(list => ARCANE_LISTS.has(list)))];
  if (!allowedLists.length) return null;
  const existing = Array.from(actor.items).find(item =>
    isKnownSpell(item)
    && spellLevel(item) === entry.level
    && norm(item.name) === norm(entry.name)
  ) ?? null;

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
      "flags.add2e.spellbookCopyChance": metadata.chance,
      "flags.add2e.spellLearningVersion": ADD2E_SPELL_LEARNING_VERSION
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
  data.flags.add2e.spellLearningVersion = ADD2E_SPELL_LEARNING_VERSION;
  const [created] = await actor.createEmbeddedDocuments("Item", [data], { add2eInternal: true, add2eArcaneCopy: true, render: false });
  return created ?? null;
}

async function createLearningRollMessage({ actor, book, entry, roll, total, profile, success, reason = "" }) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  const comparison = success ? "≤" : ">";
  const list = Array.from(entry?.lists ?? []).map(listLabel).join(" / ") || "Sort";
  const resultLabel = success ? "Ajouté aux sorts connus" : "Sort non compris";
  const card = {
    actor,
    title: success ? "Apprentissage réussi" : "Apprentissage échoué",
    icon: "fas fa-book-open-reader",
    variant: success ? "success" : "failure",
    source: {
      name: entry.name,
      img: entry.img || book.img,
      type: `${list} · niveau ${entry.level}`
    },
    rows: [
      { label: "Jet d’apprentissage", value: `${total} ${comparison} ${profile.chance} %` },
      { label: "Intelligence", value: String(profile.score) },
      { label: "Livre", value: book.name },
      { label: "Résultat", value: resultLabel }
    ],
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: roll ? [roll] : [],
      flags: {
        add2e: {
          chatCardType: "arcane-spell-learning",
          success,
          total,
          chance: profile.chance,
          spellName: entry.name,
          spellLevel: entry.level,
          bookUuid: book.uuid,
          learningReason: reason,
          spellLearningVersion: ADD2E_SPELL_LEARNING_VERSION
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(card);
  return globalThis.add2eCreateChatCard(card);
}

function candidateSourceEntries(source) {
  return (Array.isArray(source) ? source : documentEntries(source)).map(entry => clone(entry));
}

function compatibleCandidates(actor, source, profile) {
  const compatibleActorLists = actorArcaneLists(actor);
  const history = learningHistory(actor);
  const candidates = [];
  for (const entry of candidateSourceEntries(source)) {
    const unknownLists = entry.lists
      .map(listKey)
      .filter(list => compatibleActorLists.includes(list))
      .filter(list => !actorKnows(actor, entry, list));
    if (!unknownLists.length) continue;
    const eligibility = learningEligibility(actor, entry, unknownLists, profile, history);
    candidates.push({ entry, lists: unknownLists, eligibility });
  }
  return candidates;
}

async function selectSpellbookCandidates(actor, book, candidates, profile) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) throw new Error("DialogV2 est introuvable.");
  const rows = candidates.map((candidate, index) => {
    const enabled = candidate.eligibility.ok;
    const reason = enabled ? "" : candidate.eligibility.message;
    return `<label style="display:grid;grid-template-columns:28px minmax(220px,1fr) 70px 150px;gap:8px;align-items:center;padding:5px 6px;border-bottom:1px solid #d5c7a6;${enabled ? "" : "opacity:.55;"}">
      <input type="checkbox" value="${index}" ${enabled ? "" : "disabled"}>
      <span><b>${esc(candidate.entry.name)}</b>${reason ? `<br><small>${esc(reason)}</small>` : ""}</span>
      <span>Niv. ${candidate.entry.level}</span>
      <span>${esc(candidate.lists.map(listLabel).join(" / "))}</span>
    </label>`;
  }).join("");

  return DialogV2.wait({
    window: { title: `Copier depuis ${book.name}` },
    modal: true,
    rejectClose: false,
    content: `<form class="add2e-copy-spellbook" style="min-width:700px;max-height:650px;overflow:auto;padding:8px;">
      <p><b>${esc(actor.name)}</b> peut tenter de copier les sorts sélectionnés.</p>
      <p>Intelligence : <b>${profile.score}</b> — chance : <b>${profile.chance}%</b> — minimum : <b>${profile.minimum}</b> — maximum : <b>${profile.maximumLabel}</b> par niveau — niveau maximal : <b>${profile.maximumSpellLevel}</b>.</p>
      <div style="display:grid;grid-template-columns:28px minmax(220px,1fr) 70px 150px;gap:8px;font-weight:800;padding:5px 6px;background:#eadfca;"><span></span><span>Sort</span><span>Niveau</span><span>Liste</span></div>
      ${rows}
    </form>`,
    buttons: [
      {
        action: "copy",
        label: "Copier les sorts sélectionnés",
        icon: "fa-solid fa-copy",
        default: true,
        callback: (_event, button, dialog) => {
          const element = dialog?.element?.jquery ? dialog.element[0] : dialog?.element;
          const form = button?.form ?? element?.querySelector?.("form.add2e-copy-spellbook");
          return form
            ? [...form.querySelectorAll('input[type="checkbox"]:checked')].map(input => Number(input.value)).filter(Number.isInteger)
            : null;
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
  });
}

export async function copySpellbook(actor, book, requestedSpellKey = "") {
  if (!actor || !book || !isSpellbook(book)) return false;

  const sourceEntries = documentEntries(book).map(entry => clone(entry));
  const sourceBook = {
    id: book.id,
    uuid: book.uuid,
    name: book.name,
    img: book.img
  };
  if (!sourceEntries.length) {
    ui.notifications.info("Ce livre ne contient aucun sort à copier.");
    return false;
  }

  await externalizeForeignPersonalBook(actor, book, { reason: "before-copy" });
  await syncActorSpellbooks(actor, { reason: "before-copy" });
  const compatibleActorLists = actorArcaneLists(actor);
  if (!compatibleActorLists.length) {
    ui.notifications.warn(`${actor.name} n’est ni Magicien ni Illusionniste.`);
    return false;
  }

  const profile = intelligenceLearningProfile(actor);
  const candidates = compatibleCandidates(actor, sourceEntries, profile);
  if (!candidates.length) {
    ui.notifications.info("Aucun sort compatible et inconnu à copier dans ce livre.");
    return false;
  }

  let selected = [];
  const requestedKey = String(requestedSpellKey ?? "").trim();
  if (requestedKey) {
    const index = candidates.findIndex(candidate => String(candidate.entry.key) === requestedKey);
    if (index < 0) {
      ui.notifications.info("Ce sort est déjà connu ou n’est pas compatible avec ce personnage.");
      return false;
    }
    if (!candidates[index].eligibility.ok) {
      ui.notifications.warn(candidates[index].eligibility.message);
      return false;
    }
    selected = [index];
  } else {
    selected = await selectSpellbookCandidates(actor, sourceBook, candidates, profile);
  }
  if (!selected?.length) return false;

  const copied = [];
  const failed = [];
  const blocked = [];
  const errors = [];

  for (const index of selected) {
    const candidate = candidates[index];
    if (!candidate) continue;
    const currentEligibility = learningEligibility(actor, candidate.entry, candidate.lists, profile);
    if (!currentEligibility.ok) {
      blocked.push(`${candidate.entry.name} — ${currentEligibility.message}`);
      continue;
    }

    const roll = await new Roll("1d100").evaluate();
    const total = Number(roll.total) || 100;
    const success = total <= profile.chance;
    for (const list of currentEligibility.lists) {
      await storeLearningRecord(actor, list, candidate.entry, {
        roll: total,
        chance: profile.chance,
        success,
        book: sourceBook
      });
    }

    if (!success) {
      failed.push(candidate.entry.name);
      await createLearningRollMessage({ actor, book: sourceBook, entry: candidate.entry, roll, total, profile, success: false, reason: "Le sort n’est pas compris." });
      continue;
    }

    try {
      const sourceDocument = await resolveSpell(candidate.entry);
      if (!sourceDocument) throw new Error("Sort source introuvable dans le compendium des sorts.");
      await addKnownSpell(actor, sourceDocument, candidate.entry, currentEligibility.lists, {
        bookUuid: sourceBook.uuid,
        bookName: sourceBook.name,
        roll: total,
        chance: profile.chance
      });
      copied.push(candidate.entry.name);
      await createLearningRollMessage({ actor, book: sourceBook, entry: candidate.entry, roll, total, profile, success: true, reason: "Le sort est ajouté aux sorts connus." });
    } catch (error) {
      errors.push(`${candidate.entry.name} — ${error?.message ?? error}`);
      console.error("[ADD2E][ARCANE_DOCUMENTS][COPY_ERROR]", { actor: actor.name, book: sourceBook.name, entry: candidate.entry, error });
    }
  }

  await syncActorSpellbooks(actor, { reason: "after-copy" });
  globalThis.add2eRerenderActorSheet?.(actor, true);

  const summary = [];
  if (copied.length) summary.push(`${copied.length} sort(s) appris`);
  if (failed.length) summary.push(`${failed.length} échec(s)`);
  if (blocked.length) summary.push(`${blocked.length} tentative(s) bloquée(s)`);
  if (errors.length) summary.push(`${errors.length} erreur(s)`);
  ui.notifications.info(summary.join(" · ") || "Aucune copie effectuée.");
  if (errors.length) ui.notifications.warn(errors.join(" ; "));
  return copied.length > 0;
}

function spellbookRows(book, actor = null) {
  const profile = actor ? intelligenceLearningProfile(actor) : null;
  const candidatesByKey = actor && profile
    ? new Map(compatibleCandidates(actor, book, profile).map(candidate => [candidate.entry.key, candidate]))
    : new Map();
  return documentEntries(book).map(entry => {
    const candidate = candidatesByKey.get(entry.key);
    const status = actor
      ? actorKnows(actor, entry, candidate?.lists?.[0] ?? entry.lists[0])
        ? "Déjà connu"
        : candidate?.eligibility?.ok
          ? "Disponible"
          : candidate?.eligibility?.message ?? "Non compatible"
      : "";
    return `<div style="display:grid;grid-template-columns:34px minmax(220px,1fr) 70px 160px;gap:8px;align-items:center;padding:6px;border-bottom:1px solid rgba(117,85,43,.25);">
      <img src="${esc(entry.img || "icons/svg/book.svg")}" alt="" style="width:30px;height:30px;object-fit:cover;">
      <span><b>${esc(entry.name)}</b>${status ? `<br><small>${esc(status)}</small>` : ""}</span>
      <span>Niv. ${entry.level}</span>
      <span>${esc(entry.lists.map(listLabel).join(" / "))}</span>
    </div>`;
  }).join("");
}

export async function viewSpellbook(book, actor = null) {
  if (!book || !isSpellbook(book)) return false;
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) throw new Error("DialogV2 est introuvable.");
  const key = book.uuid ?? book.id;
  const previous = SPELLBOOK_DIALOGS.get(key);
  try { previous?.close?.(); } catch (_error) {}

  const result = await DialogV2.wait({
    window: { title: book.name },
    modal: false,
    rejectClose: false,
    content: `<div class="add2e-spellbook-view" style="min-width:680px;max-height:650px;overflow:auto;padding:8px;">
      <p><b>${esc(book.name)}</b></p>
      ${spellbookRows(book, actor) || "<p>Aucun sort inscrit.</p>"}
    </div>`,
    buttons: [
      ...(actor ? [{ action: "copy", label: "Copier un ou plusieurs sorts", icon: "fa-solid fa-copy", callback: () => "copy" }] : []),
      { action: "close", label: "Fermer", icon: "fa-solid fa-xmark", default: !actor, callback: () => "close" }
    ]
  });
  SPELLBOOK_DIALOGS.delete(key);
  if (result === "copy" && actor) return copySpellbook(actor, book);
  return true;
}

export async function refreshSpellbookDialog(application, book, actor) {
  try {
    const app = application && typeof application.render === "function" ? application : null;
    app?.render?.(false);
  } catch (_error) {}
  globalThis.add2eRerenderActorSheet?.(actor, true);
  return Boolean(book);
}
