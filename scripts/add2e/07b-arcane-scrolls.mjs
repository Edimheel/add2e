// ADD2E — Documents arcaniques : parchemins.
import {
  VERSION,
  SCROLL_LISTS,
  clone,
  norm,
  esc,
  listKey,
  listLabel,
  itemType,
  actorScrollLists,
  cleanEmbedded,
  arcaneData,
  arcaneKind,
  containerList,
  itemQuantity,
  documentEntries,
  entryFromSpell,
  resolveSpell,
  resolveSpellByName
} from "./07b-arcane-documents-core.mjs";

function scrollSpellName(item) {
  const system = item?.system ?? {};
  const data = arcaneData(item);
  const explicit = data.spellName ?? system.spellName ?? system.sortNom ?? system.nomSort ?? (typeof system.sort === "string" ? system.sort : "") ?? (typeof system.spell === "string" ? system.spell : "");
  if (String(explicit ?? "").trim()) return String(explicit).trim();
  const match = String(item?.name ?? "").trim().match(/^parchemin(?:\s+de\s+sort)?\s*[-—:]?\s*(?:de\s+|d['’])?(.+)$/iu);
  const candidate = match?.[1]?.trim() ?? "";
  return SCROLL_LISTS.has(listKey(candidate)) ? "" : candidate;
}

export async function hydrateScroll(item) {
  if (!item?.parent || item.parent.documentName !== "Actor" || itemType(item) !== "objet" || !norm(item.name).startsWith("parchemin")) return false;
  const existingData = arcaneData(item);
  const list = containerList(item);
  const existingEntries = documentEntries(item);
  if (arcaneKind(item) === "spell-scroll") {
    const needsList = list && !existingData.ownerList && !existingData.spellList;
    if (!needsList) return false;
    await item.update({
      "system.arcaneDocument.ownerList": list,
      "system.arcaneDocument.spellList": list,
      "flags.add2e.arcaneSpellList": list
    }, { add2eInternal: true, add2eArcaneSync: true, render: false });
    return true;
  }
  let entries = existingEntries;
  if (!entries.length) {
    const name = scrollSpellName(item);
    if (name) {
      const spell = await resolveSpellByName(name);
      if (spell && norm(spell.name) === norm(name)) {
        const entry = entryFromSpell(spell, list);
        if (entry) entries = [entry];
      }
    }
  }
  await item.update({
    "system.sousType": String(item.system?.sousType ?? "").trim() || "parchemin_de_sort",
    "system.magique": true,
    "system.consommable": true,
    "system.arcaneDocument": { ...clone(existingData), schema: 1, kind: "spell-scroll", personal: false, ...(list ? { ownerList: list, spellList: list } : {}), spells: entries },
    "flags.add2e.arcaneDocumentKind": "spell-scroll",
    ...(list ? { "flags.add2e.arcaneSpellList": list } : {}),
    "flags.add2e.generatedBy": VERSION
  }, { add2eInternal: true, add2eArcaneSync: true, render: false });
  return true;
}

async function selectScrollSpell(scroll, candidates) {
  if (candidates.length === 1) return candidates[0];
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return null;
  const options = candidates.map((candidate, index) => `<option value="${index}">${esc(candidate.entry.name)} — niveau ${candidate.entry.level} — ${esc(candidate.lists.map(listLabel).join(" / "))}</option>`).join("");
  const selected = await DialogV2.wait({
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
        callback: (_event, button, dialog) => {
          const element = dialog?.element?.jquery ? dialog.element[0] : dialog?.element;
          const form = button?.form ?? element?.querySelector?.("form.add2e-cast-scroll");
          return Number(form?.elements?.spellIndex?.value ?? -1);
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark" }
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

export async function consumeScrollSpell(actor, scroll, spellKey) {
  if (!actor || !scroll || !actor.items?.get?.(scroll.id)) return false;
  const sourceData = arcaneData(scroll);
  const entries = documentEntries(scroll);
  const selectedIndex = entries.findIndex(entry => entry.key === spellKey);
  if (selectedIndex < 0) return false;
  const remaining = entries.filter((_entry, index) => index !== selectedIndex);
  const count = itemQuantity(scroll);
  if (entries.length === 1) {
    if (count > 1) {
      await scroll.update({ "system.quantite": count - 1 }, { add2eInternal: true, add2eArcaneScroll: true, render: false });
    } else {
      await actor.deleteEmbeddedDocuments("Item", [scroll.id], { add2eInternal: true, add2eArcaneScroll: true, render: false });
    }
    return true;
  }
  if (count > 1) {
    await scroll.update({ "system.quantite": count - 1 }, { add2eInternal: true, add2eArcaneScroll: true, render: false });
    if (remaining.length) {
      const partial = cleanEmbedded(scroll.toObject());
      partial.name = `${scroll.name} (entamé)`;
      partial.system ??= {};
      partial.system.quantite = 1;
      partial.system.arcaneDocument = { ...clone(sourceData), schema: 1, kind: "spell-scroll", spells: remaining };
      await actor.createEmbeddedDocuments("Item", [partial], { add2eInternal: true, add2eArcaneScroll: true, render: false });
    }
    return true;
  }
  if (remaining.length) {
    await scroll.update({ "system.arcaneDocument": { ...clone(sourceData), schema: 1, kind: "spell-scroll", spells: remaining } }, { add2eInternal: true, add2eArcaneScroll: true, render: false });
  } else {
    await actor.deleteEmbeddedDocuments("Item", [scroll.id], { add2eInternal: true, add2eArcaneScroll: true, render: false });
  }
  return true;
}
