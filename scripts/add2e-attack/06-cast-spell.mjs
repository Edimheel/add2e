// scripts/add2e-attack/06-cast-spell.mjs
// ADD2E — Lancement de sorts, onUse, mémorisation, pouvoirs, parchemins et composants.
// Version : 2026-07-26-divine-wisdom-failure-v1

import { formatSortChamp, add2eGetSortField, add2eGetSortOnUsePath, add2eGetSortComponentsText } from "./01-core-helpers.mjs";
import "./05-jb2a-vfx.mjs";
import "../add2e/07b-arcane-documents.mjs";

const style = () => CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
const norm = value => String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

function listKeys(sortDoc) {
  try {
    if (typeof globalThis.add2eGetSpellListsFromItem === "function") return globalThis.add2eGetSpellListsFromItem(sortDoc).map(norm).filter(Boolean);
  } catch (_e) {}
  const system = sortDoc?.system ?? {};
  const flags = sortDoc?.flags?.add2e ?? {};
  const raw = [flags.learnedSpellLists, flags.knownSpellLists, flags.grantedSpellLists, system.spellLists, system.liste, system.liste_sort, system.listeSort, system.classe, system.class]
    .flatMap(value => Array.isArray(value) ? value : value ? [value] : []);
  return raw.flatMap(value => String(value ?? "").split(/[,;|\n]+/g)).map(norm).filter(Boolean);
}

function sourceKeys(sortDoc) {
  const flags = sortDoc?.flags?.add2e ?? {};
  return [sortDoc?.uuid, sortDoc?._stats?.compendiumSource, sortDoc?.flags?.core?.sourceId, flags.sourceUuid, flags.sourceId, flags.importKey, flags.foundryId, sortDoc?.id, sortDoc?._id]
    .map(value => String(value ?? "").trim())
    .filter(Boolean);
}

function resolveActorSpell(actorDoc, sortDoc) {
  if (!actorDoc?.items || !sortDoc) return sortDoc ?? null;
  if (sortDoc.system?.isPower) return sortDoc;
  if (sortDoc.parent?.id === actorDoc.id && actorDoc.items.get(sortDoc.id)) return sortDoc;
  for (const id of [sortDoc.id, sortDoc._id].map(value => String(value ?? "").trim()).filter(Boolean)) {
    const direct = actorDoc.items.get(id);
    if (direct) return direct;
  }
  const keys = new Set(sourceKeys(sortDoc));
  const importKey = String(sortDoc.flags?.add2e?.importKey ?? "").trim();
  const routedClass = norm(sortDoc.flags?.add2e?.routedClass ?? sortDoc.system?.classe ?? sortDoc.system?.class ?? "");
  const targetName = norm(sortDoc.name);
  const targetLevel = Number(sortDoc.system?.niveau ?? sortDoc.system?.level ?? 1) || 1;
  const targetLists = listKeys(sortDoc);
  const spells = Array.from(actorDoc.items ?? []).filter(item => String(item.type ?? "").toLowerCase() === "sort");
  let found = spells.find(item => sourceKeys(item).some(key => keys.has(key)));
  if (found) return found;
  found = spells.find(item => importKey && String(item.flags?.add2e?.importKey ?? "") === importKey);
  if (found) return found;
  found = spells.find(item => {
    if (norm(item.name) !== targetName) return false;
    if ((Number(item.system?.niveau ?? item.system?.level ?? 1) || 1) !== targetLevel) return false;
    const lists = listKeys(item);
    if (targetLists.length && !targetLists.some(key => lists.includes(key))) return false;
    if (routedClass && lists.length && !lists.includes(routedClass)) return false;
    return true;
  });
  if (found) return found;
  console.warn("[ADD2E][CAST_SPELL][RESOLVE_ACTOR_SPELL][FALLBACK_INPUT]", {
    actor: actorDoc.name,
    sort: sortDoc.name,
    sortId: sortDoc.id,
    importKey,
    routedClass,
    targetLevel,
    targetLists
  });
  return sortDoc;
}

function getCasterToken(actorDoc) {
  return canvas?.tokens?.controlled?.[0] ?? actorDoc?.getActiveTokens?.()?.[0] ?? null;
}

function onUseManagesSpellComponents(scriptPath, sortDoc) {
  const explicit = sortDoc?.flags?.add2e?.componentManagement ?? sortDoc?.system?.componentManagement ?? sortDoc?.system?.gestionComposants;
  if (["onUse", "onuse", "script", "manual", "manuel"].includes(String(explicit ?? "").trim())) return true;
  return norm(scriptPath).includes("benediction");
}

function renderApplication(app) {
  if (!app || typeof app.render !== "function") return;
  try { app.render({ force: true }); return; } catch (_e) {}
  try { app.render(true); return; } catch (_e) {}
  try { app.render(false); } catch (_e) {}
}

function actorSheetOpen(actorDoc) {
  if (!actorDoc?.id) return false;
  try {
    return Object.values(ui.windows ?? {}).some(app => {
      const document = app?.actor ?? app?.document ?? app?.object ?? null;
      return document?.documentName === "Actor" && String(document.id) === String(actorDoc.id);
    });
  } catch (_e) {
    return false;
  }
}

function updateMemorizedBadges(sortDoc, value) {
  const textValue = String(Math.max(0, Number(value) || 0));
  try {
    for (const root of document.querySelectorAll(".add2e-character-v3")) {
      const rows = root.querySelectorAll([
        `[data-item-id="${sortDoc.id}"]`,
        `[data-itemid="${sortDoc.id}"]`,
        `[data-id="${sortDoc.id}"]`,
        `[data-uuid="${sortDoc.uuid}"]`
      ].join(","));
      for (const row of rows) {
        for (const badge of row.querySelectorAll?.(".sort-memorize-badge, [data-memorized-count], [data-add2e-memorized-count]") ?? []) {
          badge.textContent = textValue;
          badge.dataset.memorizedCount = textValue;
          badge.dataset.add2eMemorizedCount = textValue;
        }
      }
    }
  } catch (error) {
    console.warn("[ADD2E][CAST_SPELL][UI_REFRESH][DOM_BADGE_FAILED]", error);
  }
}

async function refreshActorSpellSheets(actorDoc, sortDoc, value) {
  if (value !== undefined) updateMemorizedBadges(sortDoc, value);
  try {
    for (const app of Object.values(ui.windows ?? {})) {
      const document = app?.actor ?? app?.document ?? app?.object ?? null;
      const sameActor = document?.documentName === "Actor" && String(document.id) === String(actorDoc.id);
      const sameItem = document?.documentName === "Item" && String(document.id) === String(sortDoc.id);
      if (sameActor || sameItem) renderApplication(app);
    }
  } catch (_e) {}
  setTimeout(() => {
    if (value !== undefined) updateMemorizedBadges(sortDoc, value);
    if (!actorSheetOpen(actorDoc)) return;
    try {
      for (const app of Object.values(ui.windows ?? {})) {
        const document = app?.actor ?? app?.document ?? app?.object ?? null;
        const sameActor = document?.documentName === "Actor" && String(document.id) === String(actorDoc.id);
        const sameItem = document?.documentName === "Item" && String(document.id) === String(sortDoc.id);
        if (sameActor || sameItem) renderApplication(app);
      }
    } catch (_e) {}
  }, 80);
}

function clone(value) {
  try {
    return foundry?.utils?.deepClone ? foundry.utils.deepClone(value) : JSON.parse(JSON.stringify(value));
  } catch (_e) {
    return value;
  }
}

function validMemPath(path) {
  const normalized = norm(path);
  if (!normalized) return false;
  if (normalized.includes("max") || normalized.includes("maximum") || normalized.includes("total") || normalized.includes("capacity") || normalized.includes("capacite")) return false;
  if (normalized.includes("niveau_max") || normalized.includes("level_max")) return false;
  return true;
}

function adjustMemorizedByList(rawByList, targetTotal) {
  const target = Math.max(0, Number(targetTotal) || 0);
  if (rawByList === undefined || rawByList === null || rawByList === "") return { changed: false, value: rawByList, beforeSum: 0, afterSum: 0, leaves: [] };
  if (typeof rawByList === "number") return { changed: rawByList !== target, value: target, beforeSum: Number(rawByList) || 0, afterSum: target, leaves: [{ path: "", before: Number(rawByList) || 0, after: target }] };
  if (typeof rawByList !== "object") return { changed: false, value: rawByList, beforeSum: 0, afterSum: 0, leaves: [] };
  const value = clone(rawByList);
  const leaves = [];
  function scan(object, pathParts = []) {
    if (!object || typeof object !== "object") return;
    for (const [key, current] of Object.entries(object)) {
      const next = [...pathParts, key];
      const path = next.join(".");
      if (typeof current === "number" && Number.isFinite(current) && validMemPath(path)) {
        leaves.push({ parent: object, key, path, before: current });
        continue;
      }
      if (current && typeof current === "object" && !Array.isArray(current)) scan(current, next);
    }
  }
  scan(value);
  if (!leaves.length) return { changed: false, value, beforeSum: 0, afterSum: 0, leaves: [] };
  const beforeSum = leaves.reduce((sum, leaf) => sum + (Number(leaf.parent[leaf.key]) || 0), 0);
  const delta = target - beforeSum;
  if (delta < 0) {
    let remaining = Math.abs(delta);
    for (const leaf of leaves) {
      if (remaining <= 0) break;
      const current = Math.max(0, Number(leaf.parent[leaf.key]) || 0);
      const decrement = Math.min(current, remaining);
      leaf.parent[leaf.key] = current - decrement;
      remaining -= decrement;
    }
  } else if (delta > 0) {
    leaves[0].parent[leaves[0].key] = Math.max(0, Number(leaves[0].parent[leaves[0].key]) || 0) + delta;
  }
  const afterSum = leaves.reduce((sum, leaf) => sum + (Number(leaf.parent[leaf.key]) || 0), 0);
  return {
    changed: afterSum !== beforeSum || beforeSum !== target,
    value,
    beforeSum,
    afterSum,
    leaves: leaves.map(leaf => ({ path: leaf.path, before: leaf.before, after: Number(leaf.parent[leaf.key]) || 0 }))
  };
}

async function setMemorizedCount(actorDoc, sortDoc, value, reason = "") {
  const next = Math.max(0, Number(value) || 0);
  const byListBefore = await sortDoc.getFlag("add2e", "memorizedByList");
  const byListSync = adjustMemorizedByList(byListBefore, next);
  const updateData = { "flags.add2e.memorizedCount": next };
  if (byListSync.changed) updateData["flags.add2e.memorizedByList"] = byListSync.value;
  await sortDoc.update(updateData);
  await refreshActorSpellSheets(actorDoc, sortDoc, next);
  const after = Number(await sortDoc.getFlag("add2e", "memorizedCount")) || 0;
  console.log("[ADD2E][CAST_SPELL][MEMORIZED][SET]", { actor: actorDoc.name, sort: sortDoc.name, sortId: sortDoc.id, reason, wanted: next, after, byListSync });
  return after;
}

async function fallbackChat(actorDoc, sortDoc, chargeLabel = "") {
  const info = sortDoc.system ?? {};
  const level = Number(actorDoc.system?.niveau) || Number(info.niveau) || 1;
  const rows = ["portee", "duree", "cible", "temps_incantation"]
    .map(key => `<tr><td>${key}</td><td>${formatSortChamp(add2eGetSortField(info, key), level) || "-"}</td></tr>`)
    .join("");
  const description = add2eGetSortField(info, "description", "");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actorDoc }),
    content: `<div class="add2e-spell-card"><h3>${sortDoc.name} ${chargeLabel}</h3><table>${rows}</table><div>${description || ""}</div></div>`,
    ...style()
  });
}

function add2eDivineCastingSource(actor, sort) {
  if (!actor || !sort || globalThis.add2eIsRegularPreparableSpell?.(sort) === false) return null;
  const entry = globalThis.add2eGetSpellEntryForSpell?.(actor, sort) ?? null;
  const sources = Array.isArray(entry?.sources) && entry.sources.length ? entry.sources : entry ? [entry] : [];
  for (const source of sources) {
    const classItem = actor.items?.get?.(source?.classItemId) ?? null;
    const casting = classItem?.system?.spellcasting ?? {};
    if (norm(casting.mode ?? classItem?.system?.casterType) !== "divine") continue;
    if (casting.enabled === false) continue;
    return { entry, source, classItem, casting };
  }
  return null;
}

async function add2eCreateDivineFailureCard(actor, sort, roll, failurePercent, wisdomScore, source) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  const total = Number(roll?.total) || 0;
  const card = {
    actor,
    title: `Échec du lancement divin — ${sort.name}`,
    icon: "fas fa-hands-praying",
    variant: "failure",
    source: {
      name: source?.classItem?.name ?? actor.name,
      img: source?.classItem?.img ?? actor.img,
      type: "Sort divin"
    },
    rows: [
      { label: "Jet d’échec", value: `${total} / ${failurePercent}` },
      { label: "Sagesse", value: String(wisdomScore) },
      { label: "Effet", value: "Le sort est perdu sans produire d’effet." }
    ],
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: roll ? [roll] : [],
      flags: {
        add2e: {
          divineSpellFailure: true,
          spellId: sort.id,
          spellName: sort.name,
          failurePercent,
          wisdomScore,
          rollTotal: total,
          version: "2026-07-26-divine-wisdom-failure-v1"
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(card);
  return globalThis.add2eCreateChatCard(card);
}

async function add2eResolveDivineCastingFailure(actor, sort, castMode) {
  if (castMode === "scroll" || sort?.system?.isPower === true) return { applies: false, failed: false };
  const source = add2eDivineCastingSource(actor, sort);
  if (!source) return { applies: false, failed: false };
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!engine || typeof engine.resolveAbilityDerived !== "function") {
    throw new Error("Le résolveur canonique ADD2E des profils dérivés n’est pas disponible.");
  }
  const derived = engine.resolveAbilityDerived(actor, "sagesse", {
    source: "divine-spell-cast",
    consumer: "06-cast-spell"
  });
  const failurePercent = Math.max(0, Math.min(100, Number(derived?.profile?.echec) || 0));
  if (failurePercent <= 0) return { applies: true, failed: false, failurePercent, derived, source };
  const roll = await new Roll("1d100").evaluate();
  const failed = (Number(roll.total) || 100) <= failurePercent;
  if (failed) await add2eCreateDivineFailureCard(actor, sort, roll, failurePercent, Number(derived?.total) || 0, source);
  return { applies: true, failed, failurePercent, derived, source, roll };
}

function add2ePowerIsPotion(item) {
  if (String(item?.type ?? "").toLowerCase() !== "objet") return false;
  const system = item?.system ?? {};
  const values = [
    system.sousType,
    system.sous_type,
    system.typeObjet,
    system.type_objet,
    system.categorie,
    system.category,
    ...(Array.isArray(system.tags) ? system.tags : [system.tags]),
    ...(Array.isArray(system.effectTags) ? system.effectTags : [system.effectTags]),
    item?.flags?.add2e?.itemFamily,
    item?.flags?.add2e?.kind
  ].map(norm).filter(Boolean);
  return values.some(value => value === "potion" || value.startsWith("potion_") || value.endsWith("_potion") || value.includes("sous_type_potion"));
}

function add2ePowerGlobalMax(item, sort) {
  const values = [
    item?.system?.charges?.max,
    item?.system?.charges?.maximum,
    item?.system?.max_charges,
    item?.system?.maxCharges,
    item?.system?.chargesMax,
    sort?.system?.max
  ];
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}

async function add2ePowerReadCurrent(item, flagKey, max, isGlobal) {
  if (isGlobal) {
    const canonical = item?.system?.charges?.value
      ?? item?.system?.charges?.current
      ?? item?.system?.charges?.actuel
      ?? item?.system?.charges?.remaining;
    if (canonical !== undefined && canonical !== null && canonical !== "") {
      const number = Number(canonical);
      if (Number.isFinite(number)) return Math.max(0, Math.min(number, max));
    }
  }
  const flag = await item.getFlag("add2e", flagKey);
  if (flag !== undefined && flag !== null && flag !== "") {
    const number = Number(flag);
    if (Number.isFinite(number)) return Math.max(0, isGlobal ? Math.min(number, max) : number);
  }
  return max;
}

async function add2ePowerWriteCurrent(item, flagKey, value, max, isGlobal) {
  const next = Math.max(0, isGlobal ? Math.min(Number(value) || 0, max) : Number(value) || 0);
  if (isGlobal && item?.system?.charges && typeof item.system.charges === "object") {
    await item.update({ "system.charges.value": next }, { add2eInternal: true, add2eReason: "object-power-charge", render: false });
  }
  await item.setFlag("add2e", flagKey, next);
  return next;
}

export async function add2eCastSpell({ actor, sort, mode = "memorized", sourceItem = null, sourceSpellKey = "" } = {}) {
  if (!actor || !sort) {
    ui.notifications.warn("Lanceur ou sort introuvable.");
    return false;
  }

  const castMode = norm(mode || "memorized");
  const scrollCast = castMode === "scroll";
  const inputSort = sort;

  if (!scrollCast) sort = resolveActorSpell(actor, sort);
  if (!sort) {
    ui.notifications.warn("Sort introuvable sur l'acteur.");
    return false;
  }

  if (scrollCast && (!sourceItem || sourceItem.parent?.id !== actor.id)) {
    ui.notifications.warn("Le parchemin source est introuvable sur l'acteur.");
    return false;
  }

  const tags = globalThis.Add2eEffectsEngine?.getActiveTags?.(actor) ?? [];
  const components = add2eGetSortComponentsText(sort);
  const requiresVerbal = /(^|[,;\s])V([,;\s]|$)/i.test(components);
  const silenced = tags.some(tag => ["etat:silence", "silence:verbal", "anti_sort:verbal"].includes(String(tag)));

  if (!scrollCast && requiresVerbal && silenced) {
    ui.notifications.warn(`${sort.name} exige une composante verbale et le lanceur est sous Silence.`);
    return false;
  }

  console.log("[ADD2E][CAST_SPELL][ENTER]", {
    actor: actor.name,
    inputSort: inputSort.name,
    inputSortId: inputSort.id,
    sort: sort.name,
    sortId: sort.id,
    castMode,
    sourceItemId: sourceItem?.id ?? null,
    resolvedOnActor: sort.parent?.id === actor.id,
    onUsePath: add2eGetSortOnUsePath(sort)
  });

  let spellToUse = sort;
  let reservedCost = null;
  let componentReservation = null;
  let labelCharge = "";

  async function refundComponents(reason = "") {
    if (!componentReservation) return false;
    const refunded = await globalThis.ADD2E_CONSUMABLES?.add2eRefundSpellComponents?.(componentReservation);
    if (refunded) console.log("[ADD2E][CAST_SPELL][REFUND][COMPONENTS]", { reason, sort: spellToUse?.name });
    componentReservation = null;
    return Boolean(refunded);
  }

  async function refundCost(reason = "") {
    await refundComponents(reason);
    if (!reservedCost) return false;
    if (reservedCost.kind === "memorized") {
      const now = Number(await reservedCost.sort.getFlag("add2e", "memorizedCount")) || 0;
      if (now !== reservedCost.after) {
        await refreshActorSpellSheets(actor, reservedCost.sort, now);
        return false;
      }
      await setMemorizedCount(actor, reservedCost.sort, reservedCost.before, `refund:${reason}`);
      return true;
    }
    if (reservedCost.kind === "power") {
      const now = await add2ePowerReadCurrent(reservedCost.weapon, reservedCost.flagKey, reservedCost.max, reservedCost.isGlobal);
      if (now !== reservedCost.after) return false;
      await add2ePowerWriteCurrent(reservedCost.weapon, reservedCost.flagKey, reservedCost.before, reservedCost.max, reservedCost.isGlobal);
      return true;
    }
    return false;
  }

  async function reserveComponents() {
    if (scrollCast || sort.system?.isPower) return true;
    const api = globalThis.ADD2E_CONSUMABLES;
    if (!api?.add2eReserveSpellComponents) return true;
    const scriptPath = add2eGetSortOnUsePath(spellToUse);
    if (onUseManagesSpellComponents(scriptPath, spellToUse)) return true;
    componentReservation = await api.add2eReserveSpellComponents(actor, spellToUse);
    if (componentReservation?.blocked) {
      await refundCost("composants manquants");
      ui.notifications.warn(componentReservation.message || "Composant matériel manquant.");
      return false;
    }
    return true;
  }

  if (scrollCast) {
    labelCharge = `<span style="color:#7b4b20;">Parchemin</span>`;
  } else if (sort.system?.isPower) {
    const weapon = actor.items.get(sort.system.sourceWeaponId ?? sort.system.sourceItemId);
    if (!weapon) {
      ui.notifications.error("Objet source introuvable.");
      return false;
    }
    const rawCost = sort.system.cost ?? sort.system.cout;
    const cost = rawCost === undefined || rawCost === null || rawCost === "" ? 1 : Math.max(0, Math.floor(Number(rawCost) || 0));
    if (cost > 0) {
      const maxGlobal = add2ePowerGlobalMax(weapon, sort);
      const isGlobal = maxGlobal > 0;
      const flagKey = isGlobal ? "global_charges" : `charges_${sort.system.powerIndex}`;
      const max = isGlobal ? maxGlobal : Number(sort.system.max || 1);
      const current = await add2ePowerReadCurrent(weapon, flagKey, max, isGlobal);
      if (current < cost) {
        ui.notifications.warn(`L'objet ${weapon.name} n'a plus assez de charges (${current}/${cost} req).`);
        return false;
      }
      const after = Math.max(0, current - cost);
      await add2ePowerWriteCurrent(weapon, flagKey, after, max, isGlobal);
      reservedCost = { kind: "power", weapon, flagKey, before: current, after, max, cost, isGlobal, potion: add2ePowerIsPotion(weapon) };
      labelCharge = `<span style="color:#d35400;">Charges : ${after}/${max}</span>`;
    } else {
      labelCharge = `<span style="color:#6b4b8a;">Sans dépense de charge</span>`;
    }
    const baseName = sort.name.replace(/\s\(.*?\)$/, "").trim();
    const realSpell = game.items.find(item => item.type === "sort" && item.name.toLowerCase() === baseName.toLowerCase());
    if (realSpell) spellToUse = realSpell;
  } else {
    const memorized = Number(await sort.getFlag("add2e", "memorizedCount")) || 0;
    if (memorized <= 0) {
      ui.notifications.warn(`Le sort "${sort.name}" n'est plus mémorisé !`);
      await refreshActorSpellSheets(actor, sort, 0);
      return false;
    }
    const after = Math.max(0, memorized - 1);
    await setMemorizedCount(actor, sort, after, "reserve before onUse");
    reservedCost = { kind: "memorized", sort, before: memorized, after };
    labelCharge = `<span style="color:#2980b9;">Reste : ${after}</span>`;
  }

  if (!await reserveComponents()) return false;

  const divineFailure = await add2eResolveDivineCastingFailure(actor, sort, castMode);
  if (divineFailure.failed) {
    componentReservation = null;
    await refreshActorSpellSheets(actor, sort, reservedCost?.kind === "memorized" ? reservedCost.after : undefined);
    return false;
  }

  const scriptPath = add2eGetSortOnUsePath(spellToUse);
  let launched = true;
  let scriptExecuted = false;

  if (scriptPath) {
    scriptExecuted = true;
    try {
      const response = await fetch(scriptPath, { cache: "no-store" });
      if (!response.ok) {
        await refundCost("script introuvable");
        ui.notifications.error(`${spellToUse.name} : script onUse introuvable.`);
        return false;
      }

      const code = await response.text();
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const casterToken = getCasterToken(actor);
      const actualSourceItem = spellToUse;
      const args = [{
        actor,
        item: spellToUse,
        sort,
        token: casterToken,
        sourceItem: actualSourceItem,
        scrollItem: scrollCast ? sourceItem : null,
        castMode
      }];
      const fn = new AsyncFunction("actor", "item", "sort", "token", "args", "sourceItem", code);
      const result = await fn.call(spellToUse, actor, spellToUse, sort, casterToken, args, actualSourceItem);

      if (result === true) launched = true;
      else if (result === false) launched = false;
      else {
        launched = false;
        ui.notifications.error(`${spellToUse.name} : le script onUse doit retourner true ou false.`);
      }

      console.log("[ADD2E][CAST_SPELL][ONUSE_RESULT]", { sort: spellToUse.name, result, consumed: launched, castMode });
    } catch (error) {
      await refundCost("erreur script");
      console.error("[ADD2E][CAST_SPELL][ONUSE][ERROR]", { sort: spellToUse.name, scriptPath, castMode, error });
      ui.notifications.error(`${spellToUse.name} : erreur dans le script onUse.`);
      return false;
    }
  }

  if (!launched) {
    await refundCost("onUse false");
    return false;
  }

  componentReservation = null;

  if (scrollCast) {
    const consumed = await globalThis.ADD2E_ARCANE_DOCUMENTS?.consumeScrollSpell?.(
      actor,
      sourceItem,
      sourceSpellKey || sort.flags?.add2e?.scrollSpellKey
    );
    if (!consumed) {
      console.error("[ADD2E][CAST_SPELL][SCROLL_CONSUME_ERROR]", { actor: actor.name, scroll: sourceItem?.name, scrollId: sourceItem?.id, sourceSpellKey });
      ui.notifications.error("Le sort a été lancé, mais le parchemin n'a pas pu être consommé.");
    } else {
      labelCharge = `<span style="color:#7b4b20;">Parchemin consommé</span>`;
    }
  }

  if (reservedCost?.kind === "power" && reservedCost.potion && reservedCost.after <= 0) {
    const potionId = reservedCost.weapon.id;
    const potionName = reservedCost.weapon.name;
    await actor.deleteEmbeddedDocuments("Item", [potionId], { add2eInternal: true, add2eReason: "potion-empty", render: false });
    reservedCost.deleted = true;
    ui.notifications.info(`${potionName} est vide et a été retirée de l'inventaire.`);
  }

  if (!scriptExecuted) {
    await globalThis.ADD2E_PLAY_SPELL_FX?.("default", { casterToken: getCasterToken(actor) });
    await fallbackChat(actor, spellToUse, labelCharge);
  }

  await refreshActorSpellSheets(actor, scrollCast ? sourceItem : sort, reservedCost?.kind === "memorized" ? reservedCost.after : undefined);
  console.log("[ADD2E][CAST_SPELL][CONSUMED]", {
    actor: actor.name,
    sort: spellToUse.name,
    sortId: sort.id,
    castMode,
    sourceItemId: sourceItem?.id ?? null,
    reservedCost
  });
  return true;
}

globalThis.add2eCastSpell = add2eCastSpell;
globalThis.cast_spell = add2eCastSpell;
