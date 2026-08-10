// scripts/add2e-attack/06-cast-spell.mjs
// ADD2E — Lancement de sorts, onUse, mémorisation, pouvoirs, parchemins et composants.
// Version : 2026-08-10-strict-memorized-resource-cast-v6

import { formatSortChamp, add2eGetSortField, add2eGetSortOnUsePath, add2eGetSortComponentsText } from "./01-core-helpers.mjs";
import "./05-jb2a-vfx.mjs";
import "../add2e/07b-arcane-documents.mjs";

const norm = value => String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

class Add2eCastAbort extends Error {
  constructor(reason, message = "", notified = false) {
    super(message || reason || "Lancement annulé.");
    this.name = "Add2eCastAbort";
    this.reason = String(reason || "cast-aborted");
    this.notified = notified === true;
  }
}

function add2eCastResourceEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!engine
    || typeof engine.checkResourceAvailability !== "function"
    || typeof engine.consumeResource !== "function"
    || typeof engine.transactResources !== "function") {
    throw new Error("Le domaine canonique ADD2E resource n’est pas disponible pour le lancement de sorts.");
  }
  return engine;
}

function add2eCastConsumablesApi() {
  const api = globalThis.ADD2E_CONSUMABLES;
  if (!api
    || typeof api.add2eReserveSpellComponents !== "function"
    || typeof api.add2eRefundSpellComponents !== "function"
    || typeof api.add2eFinalizeSpellComponents !== "function") {
    throw new Error("Le propriétaire canonique ADD2E des composants de sort est indisponible.");
  }
  return api;
}

function add2eResolveOwnedMemorizedSpell(actorDoc, sortDoc) {
  if (!actorDoc?.items || !sortDoc) return null;
  if (sortDoc?.system?.isPower === true) return sortDoc;
  const id = String(sortDoc.id ?? "").trim();
  if (!id || String(sortDoc?.parent?.id ?? "") !== String(actorDoc.id ?? "")) return null;
  const owned = actorDoc.items.get(id) ?? null;
  return owned && String(owned.type ?? "").toLowerCase() === "sort" ? owned : null;
}

function getCasterToken(actorDoc) {
  return canvas?.tokens?.controlled?.[0] ?? actorDoc?.getActiveTokens?.()?.[0] ?? null;
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

function add2eCanonicalCasterLevel(actorDoc, sortDoc) {
  if (actorDoc?.type === "personnage"
    && typeof globalThis.add2eGetSpellEntryForSpell === "function"
    && typeof globalThis.add2eGetSpellAccessEntryDetails === "function"
    && typeof globalThis.add2eSpellClassLevel === "function") {
    const entry = globalThis.add2eGetSpellEntryForSpell(actorDoc, sortDoc);
    if (entry) {
      const spellLevel = Number(sortDoc?.system?.niveau) || 1;
      const access = globalThis.add2eGetSpellAccessEntryDetails(actorDoc, entry, spellLevel);
      const source = access?.eligibleSources?.[0] ?? entry?.sources?.[0] ?? null;
      const level = source ? Number(globalThis.add2eSpellClassLevel(actorDoc, source)) : 0;
      if (Number.isFinite(level) && level > 0) return Math.floor(level);
    }
  }
  const monsterLevel = actorDoc?.type === "monster" ? Number(actorDoc.system?.niveau) : 0;
  return Number.isFinite(monsterLevel) && monsterLevel > 0 ? Math.floor(monsterLevel) : 1;
}

async function fallbackChat(actorDoc, sortDoc, chargeLabel = "") {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  const info = sortDoc.system ?? {};
  const level = add2eCanonicalCasterLevel(actorDoc, sortDoc);
  const fields = [
    ["Portée", "portee"],
    ["Durée", "duree"],
    ["Cible", "cible"],
    ["Temps d’incantation", "temps_incantation"]
  ];
  const description = add2eGetSortField(info, "description", "");
  const card = {
    actor: actorDoc,
    title: sortDoc.name,
    icon: "fas fa-hat-wizard",
    variant: "spell",
    source: {
      name: actorDoc.name,
      img: actorDoc.img,
      type: chargeLabel || "Sort"
    },
    rows: fields.map(([label, key]) => ({
      label,
      value: formatSortChamp(add2eGetSortField(info, key), level) || "—"
    })),
    trustedBodyHtml: description || "",
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: actorDoc })
    }
  };
  globalThis.add2eBuildChatCard(card);
  return globalThis.add2eCreateChatCard(card);
}

function add2eDivineCastingSource(actor, sort) {
  if (!actor || !sort || typeof globalThis.add2eIsRegularPreparableSpell !== "function") return null;
  if (globalThis.add2eIsRegularPreparableSpell(sort) === false) return null;
  if (typeof globalThis.add2eGetSpellEntryForSpell !== "function") {
    throw new Error("Le propriétaire canonique des entrées de sorts ADD2E est indisponible.");
  }
  const entry = globalThis.add2eGetSpellEntryForSpell(actor, sort) ?? null;
  const sources = Array.isArray(entry?.sources) && entry.sources.length ? entry.sources : entry ? [entry] : [];
  for (const source of sources) {
    const classItem = actor.items?.get?.(source?.classItemId) ?? null;
    const casting = classItem?.system?.spellcasting ?? {};
    if (casting.enabled !== true || norm(casting.mode) !== "divine") continue;
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

function add2ePowerSource(item, sort) {
  const index = Math.floor(Number(sort?.system?.powerIndex));
  if (!Number.isFinite(index) || index < 0) {
    throw new Error(`Indice de pouvoir canonique invalide pour « ${sort?.name ?? item?.name ?? "Pouvoir"} ».`);
  }
  const raw = item?.system?.pouvoirs;
  const powers = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.values(raw)
      : [];
  const power = powers[index] ?? null;
  if (!power) {
    throw new Error(`Pouvoir source introuvable à l’indice ${index} sur « ${item?.name ?? "Objet magique"} ».`);
  }
  return { power, index };
}

function add2ePowerResource(actor, item, sort) {
  if (typeof globalThis.add2eGetObjectPowerResource !== "function") {
    throw new Error("Le propriétaire canonique de la ressource de pouvoir d’objet magique est indisponible.");
  }
  const { power, index } = add2ePowerSource(item, sort);
  return globalThis.add2eGetObjectPowerResource(actor, item, power, index, {
    consumer: "06-cast-spell",
    label: `${item.name} — ${sort.name}`,
    context: {
      spellId: sort.id,
      spellName: sort.name
    }
  });
}

function add2eMemorizationResource(actor, sort) {
  if (typeof globalThis.add2eGetSpellEntryForSpell !== "function"
    || typeof globalThis.add2eGetSpellMemorizationResource !== "function") {
    throw new Error("Le propriétaire canonique de la mémorisation des sorts n’est pas disponible.");
  }
  const entry = globalThis.add2eGetSpellEntryForSpell(actor, sort);
  if (!entry) throw new Error(`Aucune liste de mémorisation canonique n’est disponible pour « ${sort.name} ».`);
  return {
    entry,
    descriptor: globalThis.add2eGetSpellMemorizationResource(sort, entry, {
      cost: 1,
      consumer: "06-cast-spell",
      reason: "spell-cast-memorization"
    })
  };
}

export async function add2eCastSpell({ actor, sort, mode = "memorized", sourceItem = null, sourceSpellKey = "" } = {}) {
  if (!actor || !sort) {
    ui.notifications.warn("Lanceur ou sort introuvable.");
    return false;
  }

  const castMode = norm(mode || "memorized");
  const scrollCast = castMode === "scroll";
  const inputSort = sort;

  if (!scrollCast) {
    sort = add2eResolveOwnedMemorizedSpell(actor, sort);
    if (!sort) {
      ui.notifications.warn("Le lancement mémorisé exige l’Item sort exact appartenant à cet acteur.");
      return false;
    }
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

  const resourceEngine = add2eCastResourceEngine();
  let spellToUse = sort;
  let resource = null;
  let reservedCost = null;
  let componentReservation = null;
  let labelCharge = "";

  async function refundComponents(reason = "") {
    if (!componentReservation) return false;
    const api = add2eCastConsumablesApi();
    const refunded = await api.add2eRefundSpellComponents(componentReservation);
    if (refunded) console.log("[ADD2E][CAST_SPELL][REFUND][COMPONENTS]", { reason, sort: spellToUse?.name });
    componentReservation = null;
    return Boolean(refunded);
  }

  async function finalizeComponents(reason = "") {
    if (!componentReservation) return true;
    const reservation = componentReservation;
    componentReservation = null;
    const api = add2eCastConsumablesApi();
    const finalized = await api.add2eFinalizeSpellComponents(reservation);
    if (!finalized) {
      console.error("[ADD2E][CAST_SPELL][FINALIZE][COMPONENTS_FAILED]", { reason, actor: actor.name, sort: spellToUse?.name, reservation });
      ui.notifications.error("Les composants ont été consommés, mais la suppression des piles épuisées doit être vérifiée par le MJ.");
    }
    return Boolean(finalized);
  }

  async function reserveComponents() {
    if (scrollCast || sort.system?.isPower) return true;
    const api = add2eCastConsumablesApi();
    componentReservation = await api.add2eReserveSpellComponents(actor, spellToUse);
    if (componentReservation?.blocked) {
      const blockedMessage = componentReservation.message;
      componentReservation = null;
      ui.notifications.warn(blockedMessage || "Composant matériel manquant.");
      return false;
    }
    return true;
  }

  if (scrollCast) {
    labelCharge = "Parchemin";
  } else if (sort.system?.isPower) {
    const weapon = actor.items.get(sort.system.sourceWeaponId ?? sort.system.sourceItemId);
    if (!weapon) {
      ui.notifications.error("Objet source introuvable.");
      return false;
    }
    const power = add2ePowerResource(actor, weapon, sort);
    const cost = power.cost;
    if (cost > 0) {
      resource = power.descriptor;
      const availability = resourceEngine.checkResourceAvailability(resource, {
        cost,
        consumer: "06-cast-spell:power-check"
      });
      if (!availability.ok) {
        ui.notifications.warn(`L'objet ${weapon.name} n'a plus assez de charges (${availability.current}/${availability.cost} req).`);
        return false;
      }
      reservedCost = {
        kind: "power",
        weapon,
        max: power.maximum,
        cost,
        potion: add2ePowerIsPotion(weapon),
        before: availability.current,
        after: Math.max(0, availability.current - availability.cost)
      };
      labelCharge = `Charges : ${reservedCost.after}/${power.maximum}`;
    } else {
      labelCharge = "Sans dépense de charge";
    }
    const baseName = sort.name.replace(/\s\(.*?\)$/, "").trim();
    const realSpell = game.items.find(item => item.type === "sort" && item.name.toLowerCase() === baseName.toLowerCase());
    if (realSpell) spellToUse = realSpell;
  } else {
    const memory = add2eMemorizationResource(actor, sort);
    resource = memory.descriptor;
    const availability = resourceEngine.checkResourceAvailability(resource, {
      cost: 1,
      consumer: "06-cast-spell:memorization-check"
    });
    if (!availability.ok) {
      ui.notifications.warn(`Le sort "${sort.name}" n'est plus mémorisé !`);
      await refreshActorSpellSheets(actor, sort, availability.current);
      return false;
    }
    reservedCost = {
      kind: "memorized",
      sort,
      entry: memory.entry,
      before: availability.current,
      after: Math.max(0, availability.current - availability.cost)
    };
    labelCharge = `Reste : ${reservedCost.after}`;
  }

  if (!await reserveComponents()) return false;

  const divineFailure = await add2eResolveDivineCastingFailure(actor, sort, castMode);
  if (divineFailure.failed) {
    if (!resource) {
      await refundComponents("échec divin sans ressource");
      console.error("[ADD2E][CAST_SPELL][DIVINE_FAILURE_RESOURCE_MISSING]", {
        actor: actor.name,
        sort: sort.name,
        sortId: sort.id,
        castMode
      });
      ui.notifications.error("L’échec divin a été résolu, mais la ressource mémorisée du sort est introuvable.");
      return false;
    }
    const consumed = await resourceEngine.consumeResource(resource, {
      reason: "divine-spell-failure",
      consumer: "06-cast-spell:divine-failure"
    });
    if (!consumed.ok) {
      await refundComponents("échec divin non consommé");
      ui.notifications.error("L’échec divin a été résolu, mais le sort mémorisé n’a pas pu être consommé.");
      return false;
    }
    const state = consumed.resources?.[0];
    if (state) {
      reservedCost.before = state.before;
      reservedCost.after = state.after;
    }
    try {
      await finalizeComponents("échec divin");
    } catch (error) {
      console.error("[ADD2E][CAST_SPELL][DIVINE_FAILURE][COMPONENT_FINALIZE_ERROR]", error);
      ui.notifications.error(error.message || "Les composants consommés n’ont pas pu être finalisés.");
    }
    await refreshActorSpellSheets(actor, sort, reservedCost?.kind === "memorized" ? reservedCost.after : undefined);
    return false;
  }

  let scriptExecuted = false;

  async function executeValidatedCast() {
    const scriptPath = add2eGetSortOnUsePath(spellToUse);
    if (scriptPath) {
      scriptExecuted = true;
      const response = await fetch(scriptPath, { cache: "no-store" });
      if (!response.ok) {
        ui.notifications.error(`${spellToUse.name} : script onUse introuvable.`);
        throw new Add2eCastAbort("script-missing", `${spellToUse.name} : script onUse introuvable.`, true);
      }

      const code = await response.text();
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const casterToken = getCasterToken(actor);
      const actualSourceItem = sort.system?.isPower === true
        ? sourceItem ?? reservedCost?.weapon ?? actor.items.get(sort.system.sourceWeaponId ?? sort.system.sourceItemId) ?? spellToUse
        : spellToUse;
      const executionItem = sort.system?.isPower === true ? actualSourceItem : spellToUse;
      const args = [{
        actor,
        item: executionItem,
        sort,
        token: casterToken,
        sourceItem: actualSourceItem,
        scrollItem: scrollCast ? sourceItem : null,
        castMode
      }];
      const fn = new AsyncFunction("actor", "item", "sort", "token", "args", "sourceItem", code);
      const result = await fn.call(executionItem, actor, executionItem, sort, casterToken, args, actualSourceItem);
      console.log("[ADD2E][CAST_SPELL][ONUSE_RESULT]", { sort: spellToUse.name, result, consumed: result === true, castMode });

      if (result === false) throw new Add2eCastAbort("onuse-false");
      if (result !== true) {
        ui.notifications.error(`${spellToUse.name} : le script onUse doit retourner true ou false.`);
        throw new Add2eCastAbort("onuse-invalid-result", `${spellToUse.name} : résultat onUse invalide.`, true);
      }
    }

    if (scrollCast) {
      const consumeScrollSpell = globalThis.ADD2E_ARCANE_DOCUMENTS?.consumeScrollSpell;
      if (typeof consumeScrollSpell !== "function") {
        throw new Error("Le propriétaire canonique des parchemins ADD2E est indisponible.");
      }
      const consumed = await consumeScrollSpell(
        actor,
        sourceItem,
        sourceSpellKey || sort.flags?.add2e?.scrollSpellKey
      );
      if (!consumed) {
        console.error("[ADD2E][CAST_SPELL][SCROLL_CONSUME_ERROR]", { actor: actor.name, scroll: sourceItem?.name, scrollId: sourceItem?.id, sourceSpellKey });
        ui.notifications.error("Le sort a été lancé, mais le parchemin n'a pas pu être consommé.");
        throw new Add2eCastAbort("scroll-consume-failed", "Le parchemin n’a pas pu être consommé.", true);
      }
      labelCharge = "Parchemin consommé";
    }

    if (!scriptExecuted) {
      await globalThis.ADD2E_PLAY_SPELL_FX?.("default", { casterToken: getCasterToken(actor) });
      await fallbackChat(actor, spellToUse, labelCharge);
    }
    return true;
  }

  try {
    if (resource) {
      const transaction = await resourceEngine.transactResources(resource, async states => {
        const state = states?.[0];
        if (state) {
          reservedCost.before = state.before;
          reservedCost.after = state.after;
          labelCharge = reservedCost.kind === "power"
            ? `Charges : ${state.after}/${state.maximum}`
            : `Reste : ${state.after}`;
        }
        return executeValidatedCast();
      }, {
        reason: reservedCost?.kind === "power" ? "magic-power-cast" : "spell-cast-memorization",
        consumer: "06-cast-spell"
      });
      if (!transaction.ok) {
        await refundComponents("ressource devenue indisponible");
        const state = transaction.resources?.[0];
        ui.notifications.warn(state
          ? `${state.label} n’est plus disponible (${state.current}/${state.cost}).`
          : "La ressource nécessaire n’est plus disponible.");
        return false;
      }
    } else {
      await executeValidatedCast();
    }
  } catch (error) {
    await refundComponents(error?.reason ?? "erreur lancement");
    if (!(error instanceof Add2eCastAbort)) {
      console.error("[ADD2E][CAST_SPELL][EXECUTION_ERROR]", { sort: spellToUse.name, castMode, error });
      ui.notifications.error(`${spellToUse.name} : erreur dans le script onUse.`);
    } else if (!error.notified && error.reason !== "onuse-false") {
      ui.notifications.warn(error.message || "Le lancement a été annulé.");
    }
    return false;
  }

  try {
    await finalizeComponents("lancement réussi");
  } catch (error) {
    console.error("[ADD2E][CAST_SPELL][COMPONENT_FINALIZE_ERROR]", error);
    ui.notifications.error(error.message || "Les composants consommés n’ont pas pu être finalisés.");
  }

  if (reservedCost?.kind === "power" && reservedCost.potion && reservedCost.after <= 0) {
    const potionId = reservedCost.weapon.id;
    const potionName = reservedCost.weapon.name;
    try {
      await actor.deleteEmbeddedDocuments("Item", [potionId], { add2eInternal: true, add2eReason: "potion-empty", render: false });
      reservedCost.deleted = true;
      ui.notifications.info(`${potionName} est vide et a été retirée de l'inventaire.`);
    } catch (error) {
      console.error("[ADD2E][CAST_SPELL][POTION_DELETE_FAILED]", { actor: actor.name, potionId, potionName, error });
      ui.notifications.error(`${potionName} est vide, mais n’a pas pu être retirée de l’inventaire.`);
    }
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
