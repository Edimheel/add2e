// ADD2E — Documents arcaniques : parchemins, lecture, consommation et écriture.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2 via l’API commune ADD2E.

import {
  VERSION,
  SCROLL_LISTS,
  clone,
  esc,
  listKey,
  listLabel,
  itemType,
  actorScrollLists,
  cleanEmbedded,
  arcaneData,
  arcaneKind,
  itemQuantity,
  documentEntries,
  entryFromSpell,
  spellLevel,
  spellLists,
  isKnownSpell,
  resolveSpell
} from "./07b-arcane-documents-core.mjs";
import { classSlug } from "./17b-multiclass-core.mjs";

const ADD2E_SCROLL_SCRIBING_VERSION = "2026-08-12-canonical-scroll-identity-v3";
const ADD2E_SCROLL_SCRIBE_CLASSES = new Set(["clerc", "druide", "magicien", "illusionniste"]);
const ADD2E_SCROLL_MATERIALS = Object.freeze({
  papyrus: Object.freeze({ key: "papyrus", label: "Papyrus", minimumCostPoPerSheet: 2, failureModifier: 5 }),
  parchemin: Object.freeze({ key: "parchemin", label: "Parchemin", minimumCostPoPerSheet: 4, failureModifier: 0 }),
  velin: Object.freeze({ key: "velin", label: "Vélin", minimumCostPoPerSheet: 8, failureModifier: -5 })
});

globalThis.ADD2E_SCROLL_SCRIBING_VERSION = ADD2E_SCROLL_SCRIBING_VERSION;

export async function hydrateScroll(item) {
  if (!item?.parent || item.parent.documentName !== "Actor" || itemType(item) !== "objet") return false;

  const existingData = arcaneData(item);
  if (String(existingData.kind ?? "").trim().toLowerCase() !== "spell-scroll") return false;

  const configuredList = listKey(existingData.ownerList ?? existingData.spellList ?? "");
  const list = SCROLL_LISTS.has(configuredList) ? configuredList : "";
  const updates = {};

  if (item.flags?.add2e?.arcaneDocumentKind !== "spell-scroll") {
    updates["flags.add2e.arcaneDocumentKind"] = "spell-scroll";
  }
  if (list && existingData.ownerList !== list) {
    updates["system.arcaneDocument.ownerList"] = list;
  }
  if (list && existingData.spellList !== list) {
    updates["system.arcaneDocument.spellList"] = list;
  }
  if (list && item.flags?.add2e?.arcaneSpellList !== list) {
    updates["flags.add2e.arcaneSpellList"] = list;
  }

  if (!Object.keys(updates).length) return false;
  await item.update(updates, { add2eInternal: true, add2eArcaneSync: true, render: false });
  return true;
}

function sourceClassDocument(actor, source) {
  const id = String(source?.classItemId ?? "").trim();
  if (!id) return null;
  const classDoc = actor?.items?.get?.(id) ?? null;
  return classDoc && itemType(classDoc) === "classe" ? classDoc : null;
}

function sourceClassKey(actor, source) {
  const classDoc = sourceClassDocument(actor, source);
  if (!classDoc) return "";
  const sourceSlug = String(source?.classSlug ?? "").trim();
  if (!sourceSlug) return "";
  const canonicalSlug = classSlug(classDoc);
  if (!canonicalSlug || canonicalSlug !== sourceSlug) {
    throw new Error(`Identité canonique incohérente pour la classe « ${classDoc.name ?? classDoc.id} » : ${sourceSlug || "slug absent"} ≠ ${canonicalSlug || "slug introuvable"}.`);
  }
  return ADD2E_SCROLL_SCRIBE_CLASSES.has(canonicalSlug) ? canonicalSlug : "";
}

function sourceClassLevel(actor, source) {
  if (typeof globalThis.add2eSpellClassLevel !== "function") {
    throw new Error("Le résolveur canonique du niveau de classe est indisponible.");
  }
  return Math.max(0, Math.trunc(Number(globalThis.add2eSpellClassLevel(actor, source)) || 0));
}

function scrollScribingProfiles(actor) {
  if (typeof globalThis.add2eGetSpellcastingEntries !== "function") {
    throw new Error("Le résolveur canonique des listes de sorts est indisponible.");
  }
  const entries = globalThis.add2eGetSpellcastingEntries(actor);
  if (!Array.isArray(entries)) {
    throw new Error(`Les traditions canoniques sont invalides pour « ${actor?.name ?? "acteur"} ».`);
  }
  const byList = new Map();
  for (const entry of entries) {
    const list = listKey(entry?.key);
    if (!SCROLL_LISTS.has(list)) continue;
    const sources = Array.isArray(entry?.sources) ? entry.sources : [];
    for (const source of sources) {
      const classKey = sourceClassKey(actor, source);
      if (!classKey) continue;
      const classLevel = sourceClassLevel(actor, source);
      if (classLevel < 7) continue;
      const current = byList.get(list);
      if (!current || classLevel > current.classLevel) {
        byList.set(list, {
          list,
          label: listLabel(list),
          entry,
          source,
          classKey,
          classLevel,
          classItem: sourceClassDocument(actor, source)
        });
      }
    }
  }
  return [...byList.values()].sort((left, right) => left.label.localeCompare(right.label, "fr"));
}

function scribingCandidates(actor, profile) {
  if (typeof globalThis.add2eGetSpellAccessEntryDetails !== "function") {
    throw new Error("Le résolveur canonique d’accès aux sorts est indisponible.");
  }
  const candidates = [];
  for (const spell of actor?.items ?? []) {
    if (itemType(spell) !== "sort" || !isKnownSpell(spell)) continue;
    if (typeof globalThis.add2eIsRegularPreparableSpell === "function" && !globalThis.add2eIsRegularPreparableSpell(spell)) continue;
    if (!spellLists(spell).map(listKey).includes(profile.list)) continue;
    const level = spellLevel(spell);
    const access = globalThis.add2eGetSpellAccessEntryDetails(actor, {
      ...profile.entry,
      key: profile.list,
      sources: [profile.source]
    }, level);
    if (!access?.ok) continue;
    const entry = entryFromSpell(spell, profile.list);
    if (entry) candidates.push({ spell, entry });
  }
  return candidates.sort((left, right) => left.entry.level - right.entry.level || left.entry.name.localeCompare(right.entry.name, "fr"));
}

function scrollDialogWait(options) {
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  return globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2eClasses: ["add2e-arcane-scroll-dialog"],
    ...options
  });
}

async function selectScribingProfile(actor, profiles) {
  if (profiles.length === 1) return profiles[0];
  const options = profiles.map((profile, index) => `<option value="${index}">${esc(profile.label)} — ${esc(profile.classItem?.name ?? profile.classKey)} niveau ${profile.classLevel}</option>`).join("");
  const selected = await scrollDialogWait({
    add2ePrimaryAction: "select",
    window: { title: "Écrire un parchemin — liste" },
    modal: true,
    rejectClose: false,
    content: `<form class="add2e-select-scroll-list" style="min-width:520px;padding:8px;">
      <p>Choisissez la tradition utilisée pour écrire le parchemin.</p>
      <label style="display:grid;gap:5px;"><b>Liste de sorts</b><select name="profileIndex">${options}</select></label>
    </form>`,
    buttons: [
      {
        action: "select",
        label: "Continuer",
        icon: "fa-solid fa-scroll",
        default: true,
        callback: (_event, button) => Number(button?.form?.elements?.profileIndex?.value ?? -1)
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => -1 }
    ]
  });
  return Number.isInteger(selected) && selected >= 0 ? profiles[selected] ?? null : null;
}

async function selectScribingSpells(actor, profile, candidates) {
  const rows = candidates.map((candidate, index) => `<label style="display:grid;grid-template-columns:28px minmax(240px,1fr) 80px;gap:8px;align-items:center;padding:5px 6px;border-bottom:1px solid #d5c7a6;">
    <input type="checkbox" value="${index}">
    <span><b>${esc(candidate.entry.name)}</b></span>
    <span>Niv. ${candidate.entry.level}</span>
  </label>`).join("");
  const materialOptions = Object.values(ADD2E_SCROLL_MATERIALS).map(material => `<option value="${material.key}">${material.label} — ${material.minimumCostPoPerSheet} po minimum/feuille — ${material.failureModifier >= 0 ? "+" : ""}${material.failureModifier}% échec</option>`).join("");
  return scrollDialogWait({
    add2ePrimaryAction: "scribe",
    window: { title: `Écrire un parchemin — ${profile.label}` },
    modal: true,
    rejectClose: false,
    content: `<form class="add2e-scribe-scroll" style="min-width:700px;max-height:680px;overflow:auto;padding:8px;">
      <p><b>${esc(actor.name)}</b> — ${esc(profile.classItem?.name ?? profile.classKey)} niveau <b>${profile.classLevel}</b>.</p>
      <p>Sélectionnez de 1 à 7 sorts. Chaque niveau de sort exige un jour complet de travail. Le coût du support est indicatif et n’est pas déduit automatiquement.</p>
      <div style="display:grid;grid-template-columns:28px minmax(240px,1fr) 80px;gap:8px;font-weight:800;padding:5px 6px;background:#eadfca;"><span></span><span>Sort</span><span>Niveau</span></div>
      ${rows}
      <label style="display:grid;gap:5px;margin-top:10px;"><b>Support</b><select name="material">${materialOptions}</select></label>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;"><input type="checkbox" name="specialFeather"><span>Une plume fraîche et vierge provenant d’une créature étrange ou magique est disponible.</span></label>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-top:6px;"><input type="checkbox" name="specialInk"><span>L’encre spéciale propre aux sorts sélectionnés est préparée.</span></label>
    </form>`,
    buttons: [
      {
        action: "scribe",
        label: "Commencer la transcription",
        icon: "fa-solid fa-feather-pointed",
        default: true,
        callback: (_event, button) => {
          const form = button?.form;
          if (!form) return null;
          return {
            indexes: [...form.querySelectorAll('input[type="checkbox"][value]:checked')].map(input => Number(input.value)).filter(Number.isInteger),
            material: String(form.elements?.material?.value ?? "parchemin"),
            specialFeather: form.elements?.specialFeather?.checked === true,
            specialInk: form.elements?.specialInk?.checked === true
          };
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
  });
}

function scrollFailureChance(spellLevelValue, casterLevel, material) {
  return Math.max(0, Math.min(100, 20 + Number(spellLevelValue) - Number(casterLevel) + Number(material?.failureModifier ?? 0)));
}

async function createScribingChatCard(actor, profile, material, attempts, createdScroll, totalDays) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  const failed = attempts.find(attempt => !attempt.success) ?? null;
  const rows = [
    { label: "Tradition", value: `${profile.label} — ${profile.classItem?.name ?? profile.classKey} niveau ${profile.classLevel}` },
    { label: "Support", value: `${material.label} — ${material.minimumCostPoPerSheet} po minimum par feuille — modificateur ${material.failureModifier >= 0 ? "+" : ""}${material.failureModifier}%` },
    { label: "Temps requis", value: `${totalDays} jour(s) complet(s)` },
    ...attempts.map(attempt => ({
      label: `${attempt.entry.name} (N${attempt.entry.level})`,
      value: `d100 ${attempt.total} — échec ${attempt.failureChance}% — ${attempt.success ? "réussite" : "échec"}`
    }))
  ];
  const card = {
    actor,
    title: failed ? "Écriture d’un parchemin — transcription interrompue" : "Écriture d’un parchemin — réussite",
    icon: "fas fa-feather-pointed",
    variant: failed ? "failure" : "success",
    source: {
      name: createdScroll?.name ?? actor.name,
      img: createdScroll?.img ?? actor.img,
      type: createdScroll ? "Parchemin" : "Transcription"
    },
    rows,
    message: createdScroll
      ? `${documentEntries(createdScroll).length} sort(s) ont été inscrits sur le parchemin.${failed ? " L’échec empêche toute inscription supplémentaire sur ce parchemin." : ""}`
      : "La première transcription a échoué : aucun parchemin utilisable n’a été créé.",
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: attempts.map(attempt => attempt.roll),
      flags: {
        add2e: {
          scrollScribing: true,
          scrollScribingVersion: ADD2E_SCROLL_SCRIBING_VERSION,
          list: profile.list,
          casterLevel: profile.classLevel,
          material: material.key,
          totalDays,
          failed: Boolean(failed),
          createdScrollId: createdScroll?.id ?? null
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(card);
  return globalThis.add2eCreateChatCard(card);
}

export async function scribeScroll(actor) {
  if (!actor?.items || actor.type !== "personnage") return false;
  if (!actor.isOwner && !game.user?.isGM) {
    ui.notifications.warn("Vous ne pouvez pas écrire un parchemin pour cet acteur.");
    return false;
  }

  const profiles = scrollScribingProfiles(actor);
  if (!profiles.length) {
    ui.notifications.warn("L’écriture de parchemins exige une classe de Clerc, Druide, Magicien ou Illusionniste de niveau 7 minimum.");
    return false;
  }
  const profile = await selectScribingProfile(actor, profiles);
  if (!profile) return false;
  const candidates = scribingCandidates(actor, profile);
  if (!candidates.length) {
    ui.notifications.warn(`${actor.name} ne possède aucun sort ${profile.label} actuellement accessible à inscrire.`);
    return false;
  }

  const selection = await selectScribingSpells(actor, profile, candidates);
  if (!selection) return false;
  if (!selection.specialFeather || !selection.specialInk) {
    ui.notifications.warn("La plume spéciale et l’encre appropriée sont toutes deux obligatoires.");
    return false;
  }
  if (!selection.indexes.length) {
    ui.notifications.warn("Sélectionnez au moins un sort.");
    return false;
  }
  if (selection.indexes.length > 7) {
    ui.notifications.warn("Un parchemin ne peut contenir plus de sept sorts.");
    return false;
  }

  const material = ADD2E_SCROLL_MATERIALS[selection.material] ?? ADD2E_SCROLL_MATERIALS.parchemin;
  const selected = selection.indexes.map(index => candidates[index]).filter(Boolean).slice(0, 7);
  const attempts = [];
  const successfulEntries = [];
  let totalDays = 0;

  for (const candidate of selected) {
    const days = Math.max(1, Number(candidate.entry.level) || 1);
    totalDays += days;
    const failureChance = scrollFailureChance(candidate.entry.level, profile.classLevel, material);
    const roll = await new Roll("1d100").evaluate();
    const total = Number(roll.total) || 100;
    const success = total > failureChance;
    attempts.push({ entry: clone(candidate.entry), roll, total, failureChance, success, days });
    if (!success) break;
    successfulEntries.push(clone(candidate.entry));
  }

  let createdScroll = null;
  const failed = attempts.find(attempt => !attempt.success) ?? null;
  if (successfulEntries.length) {
    const singleName = successfulEntries.length === 1 ? successfulEntries[0].name : "";
    const name = singleName ? `Parchemin — ${singleName}` : `Parchemin de sorts — ${profile.label}`;
    const timestamp = new Date().toISOString();
    const [created] = await actor.createEmbeddedDocuments("Item", [{
      name,
      type: "objet",
      img: "icons/sundries/scrolls/scroll-bound-sealed-red.webp",
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
        description: `Parchemin écrit par ${actor.name} selon la liste ${profile.label}.`,
        arcaneDocument: {
          schema: 1,
          kind: "spell-scroll",
          personal: false,
          ownerList: profile.list,
          spellList: profile.list,
          spells: successfulEntries,
          scribing: {
            version: ADD2E_SCROLL_SCRIBING_VERSION,
            writerActorUuid: actor.uuid,
            writerActorName: actor.name,
            classItemId: profile.classItem?.id ?? "",
            className: profile.classItem?.name ?? profile.classKey,
            casterLevel: profile.classLevel,
            material: clone(material),
            specialFeatherConfirmed: true,
            specialInkConfirmed: true,
            totalDays,
            closedByFailure: Boolean(failed),
            failedSpell: failed ? clone(failed.entry) : null,
            attempts: attempts.map(attempt => ({
              entry: clone(attempt.entry),
              total: attempt.total,
              failureChance: attempt.failureChance,
              success: attempt.success,
              days: attempt.days
            })),
            createdAt: timestamp
          }
        }
      },
      effects: [],
      flags: {
        add2e: {
          arcaneDocumentKind: "spell-scroll",
          arcaneSpellList: profile.list,
          generatedBy: VERSION,
          scrollScribingVersion: ADD2E_SCROLL_SCRIBING_VERSION,
          scribedByActorUuid: actor.uuid,
          scribedByActorName: actor.name,
          scribingClosedByFailure: Boolean(failed)
        }
      }
    }], { add2eInternal: true, add2eArcaneScroll: true, add2eScrollScribing: true, render: false });
    createdScroll = created ?? null;
  }

  await createScribingChatCard(actor, profile, material, attempts, createdScroll, totalDays);
  globalThis.add2eRerenderActorSheet?.(actor, true);
  if (createdScroll) ui.notifications.info(`${createdScroll.name} a été créé avec ${successfulEntries.length} sort(s).`);
  else ui.notifications.warn("La transcription a échoué avant la création d’un parchemin utilisable.");
  return Boolean(createdScroll);
}

async function selectScrollSpell(scroll, candidates) {
  if (candidates.length === 1) return candidates[0];
  const options = candidates.map((candidate, index) => `<option value="${index}">${esc(candidate.entry.name)} — niveau ${candidate.entry.level} — ${esc(candidate.lists.map(listLabel).join(" / "))}</option>`).join("");
  const selected = await scrollDialogWait({
    add2ePrimaryAction: "cast",
    window: { title: `Lire ${scroll.name}` },
    modal: true,
    rejectClose: false,
    content: `<form class="add2e-cast-scroll" style="min-width:520px;padding:8px;"><p>Le lancement ne consomme ni sort mémorisé ni composante.</p><label style="display:grid;gap:5px;"><b>Sort</b><select name="spellIndex">${options}</select></label></form>`,
    buttons: [
      {
        action: "cast",
        label: "Lancer le sort",
        icon: "fa-solid fa-scroll",
        default: true,
        callback: (_event, button) => Number(button?.form?.elements?.spellIndex?.value ?? -1)
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => -1 }
    ]
  });
  return Number.isInteger(selected) && selected >= 0 ? candidates[selected] ?? null : null;
}

export async function castScroll(actor, scroll) {
  if (!actor || !scroll) return false;
  if (arcaneKind(scroll) !== "spell-scroll") await hydrateScroll(scroll);
  const entries = documentEntries(scroll);
  if (!entries.length) {
    ui.notifications.warn(`${scroll.name} ne contient aucun sort exploitable.`);
    return false;
  }
  const usableLists = actorScrollLists(actor);
  const candidates = entries.map(entry => ({ entry, lists: entry.lists.filter(list => SCROLL_LISTS.has(list) && usableLists.includes(list)) })).filter(candidate => candidate.lists.length);
  if (!candidates.length) {
    ui.notifications.warn(`${actor.name} ne peut pas lire les sorts contenus dans ${scroll.name}.`);
    return false;
  }
  const selected = await selectScrollSpell(scroll, candidates);
  if (!selected) return false;
  const sourceDocument = await resolveSpell(selected.entry);
  if (!sourceDocument) {
    ui.notifications.error(`${selected.entry.name} est introuvable dans le compendium add2e.sorts.`);
    return false;
  }
  const data = cleanEmbedded(sourceDocument.toObject());
  data._id = foundry.utils.randomID();
  data.system ??= {};
  data.flags ??= {};
  data.flags.add2e ??= {};
  data.system.scrollCast = true;
  data.flags.add2e.scrollCast = true;
  data.flags.add2e.scrollSourceItemId = scroll.id;
  data.flags.add2e.scrollSpellKey = selected.entry.key;
  const virtualSpell = new CONFIG.Item.documentClass(data, { parent: actor });
  if (typeof globalThis.add2eCastSpell !== "function") {
    ui.notifications.error("Le moteur add2eCastSpell est introuvable.");
    return false;
  }
  return globalThis.add2eCastSpell({ actor, sort: virtualSpell, mode: "scroll", sourceItem: scroll, sourceSpellKey: selected.entry.key });
}

function scrollResourceEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!engine || typeof engine.consumeResource !== "function") {
    throw new Error("Le domaine canonique ADD2E resource n’est pas disponible pour les parchemins.");
  }
  return engine;
}

function scrollSpellResource(actor, scroll, spellKey) {
  const sourceData = arcaneData(scroll);
  const entries = documentEntries(scroll);
  const selectedIndex = entries.findIndex(entry => entry.key === spellKey);
  if (selectedIndex < 0) return null;
  const selected = entries[selectedIndex];

  return {
    id: `${scroll.uuid ?? scroll.id}:scroll-spell:${String(spellKey)}`,
    type: "scroll-spell",
    label: `${scroll.name} — ${selected.name}`,
    document: scroll,
    actor,
    item: scroll,
    target: String(spellKey),
    current: 1,
    maximum: 1,
    cost: 1,
    recovery: 0,
    source: {
      kind: "scroll",
      id: String(scroll.id ?? ""),
      uuid: String(scroll.uuid ?? ""),
      name: String(scroll.name ?? "Parchemin")
    },
    context: {
      spellKey: String(spellKey),
      spellName: selected.name,
      consumer: "07b-arcane-scrolls"
    },
    write: async next => {
      if (Number(next) > 0) return 1;
      if (!actor.items?.get?.(scroll.id)) throw new Error(`Le parchemin « ${scroll.name} » n’est plus présent sur l’acteur.`);

      const liveEntries = documentEntries(scroll);
      const liveIndex = liveEntries.findIndex(entry => entry.key === spellKey);
      if (liveIndex < 0) throw new Error(`Le sort « ${selected.name} » n’est plus présent sur ${scroll.name}.`);
      const remaining = liveEntries.filter((_entry, index) => index !== liveIndex);
      const count = itemQuantity(scroll);

      if (liveEntries.length === 1) {
        if (count > 1) {
          await scroll.update({ "system.quantite": count - 1 }, { add2eInternal: true, add2eArcaneScroll: true, add2eResource: true, render: false });
        } else {
          await actor.deleteEmbeddedDocuments("Item", [scroll.id], { add2eInternal: true, add2eArcaneScroll: true, add2eResource: true, render: false });
        }
        return 0;
      }

      if (count > 1) {
        await scroll.update({ "system.quantite": count - 1 }, { add2eInternal: true, add2eArcaneScroll: true, add2eResource: true, render: false });
        if (remaining.length) {
          const partial = cleanEmbedded(scroll.toObject());
          partial.name = `${scroll.name} (entamé)`;
          partial.system ??= {};
          partial.system.quantite = 1;
          partial.system.arcaneDocument = { ...clone(sourceData), schema: 1, kind: "spell-scroll", spells: remaining };
          await actor.createEmbeddedDocuments("Item", [partial], { add2eInternal: true, add2eArcaneScroll: true, add2eResource: true, render: false });
        }
        return 0;
      }

      if (remaining.length) {
        await scroll.update({
          "system.arcaneDocument": { ...clone(sourceData), schema: 1, kind: "spell-scroll", spells: remaining }
        }, { add2eInternal: true, add2eArcaneScroll: true, add2eResource: true, render: false });
      } else {
        await actor.deleteEmbeddedDocuments("Item", [scroll.id], { add2eInternal: true, add2eArcaneScroll: true, add2eResource: true, render: false });
      }
      return 0;
    }
  };
}

export async function consumeScrollSpell(actor, scroll, spellKey) {
  if (!actor || !scroll || !actor.items?.get?.(scroll.id)) return false;
  const resource = scrollSpellResource(actor, scroll, spellKey);
  if (!resource) return false;
  const result = await scrollResourceEngine().consumeResource(resource, {
    cost: 1,
    reason: "consume-scroll-spell",
    consumer: "07b-arcane-scrolls"
  });
  return result?.ok === true;
}
