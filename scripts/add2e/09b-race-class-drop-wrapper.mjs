// ============================================================
// ADD2E — Auto-compatibilité race / classe au drop — wrapper
// Version : 2026-06-16-race-class-drop-split-v5-stat-explain
// ============================================================

import {
  ADD2E_RACE_CLASS_DROP_VERSION,
  add2eResolveDropCompatibilityWithPopup,
  checkClassStatMin,
  add2eApplyRaceItemDataToActor,
  add2eRaceCandidateLabel,
  add2eRaceMatchesClassRules
} from "./09a-race-class-drop-core.mjs";

function add2eDropWrapperNorm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eDropWrapperCloneItemData(itemLike) {
  if (!itemLike) return null;
  const data = typeof itemLike.toObject === "function" ? itemLike.toObject() : foundry.utils.deepClone(itemLike);
  if (!data || typeof data !== "object") return null;
  delete data._id;
  delete data._stats;
  return data;
}

function add2eClassHasRaceRestrictions(classData) {
  const races = (classData?.system ?? classData ?? {})?.raceRestriction?.races;
  return !!(races && typeof races === "object" && Object.keys(races).length);
}

async function add2eResolveRaceClassDropItemData(raw) {
  if (!raw || raw.type !== "Item") return null;

  if (typeof globalThis.add2eResolveDropItemDataCompendiumFirst === "function") {
    const resolved = await globalThis.add2eResolveDropItemDataCompendiumFirst(raw);
    if (resolved) return resolved;
  }

  if (raw.pack && raw.id) {
    const pack = game.packs.get(raw.pack);
    const ent = pack && await pack.getDocument(raw.id);
    if (ent instanceof Item) return ent.toObject();
  }

  if (raw.uuid && String(raw.uuid).startsWith("Compendium.")) {
    const doc = await fromUuid(raw.uuid);
    if (doc instanceof Item) return doc.toObject();
  }

  const fallbackType = String(raw.data?.type ?? "").toLowerCase();
  const fallbackName = add2eDropWrapperNorm(raw.data?.name ?? "");
  if (fallbackName && ["race", "classe"].includes(fallbackType)) {
    const packIds = fallbackType === "race" ? ["add2e.races"] : ["add2e.classes"];
    for (const packId of packIds) {
      const pack = game.packs.get(packId);
      if (!pack) continue;
      const index = await pack.getIndex({ fields: ["name", "type", "system.slug", "system.label"] });
      const entry = index.find(e => add2eDropWrapperNorm(e.name) === fallbackName);
      if (!entry) continue;
      const ent = await pack.getDocument(entry._id);
      if (ent instanceof Item) return ent.toObject();
    }
  }

  if (raw.uuid) {
    const doc = await fromUuid(raw.uuid);
    if (doc instanceof Item) return doc.toObject();
  }

  return raw.data ?? null;
}

async function add2eLoadRaceCandidatesFromCompendium() {
  const pack = game.packs.get("add2e.races");
  if (!pack) {
    console.warn("[ADD2E][DROP][RACE_CLASSE][RACES_PACK_MISSING] add2e.races introuvable.");
    return [];
  }

  const races = [];
  const index = await pack.getIndex({ fields: ["name", "type", "system.slug", "system.label"] });
  for (const entry of index) {
    if (entry.type && String(entry.type).toLowerCase() !== "race") continue;
    const doc = await pack.getDocument(entry._id);
    if (!(doc instanceof Item)) continue;
    const data = doc.toObject();
    data.flags = data.flags ?? {};
    data.flags.add2e = data.flags.add2e ?? {};
    data.flags.add2e.dropResolvedFromCompendium = true;
    data.flags.add2e.dropResolvedUuid = doc.uuid;
    data.pack = doc.pack;
    data.uuid = doc.uuid;
    races.push(data);
  }

  const seen = new Set();
  return races.filter(race => {
    const key = add2eDropWrapperNorm(race.name ?? race.system?.label ?? race.system?.slug ?? "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function add2eActorCurrentRaceData(actor) {
  const raceItem = actor?.items?.find?.(i => String(i.type || "").toLowerCase() === "race");
  if (raceItem) return add2eDropWrapperCloneItemData(raceItem);

  const sys = actor?.system ?? {};
  const raceName = sys.race ?? sys.details_race?.name ?? sys.details_race?.label ?? "";
  if (raceName) {
    return {
      name: raceName,
      type: "race",
      system: foundry.utils.deepClone(sys.details_race ?? { name: raceName, label: raceName }),
      flags: {}
    };
  }

  return null;
}

function add2eRaceRuleAllowsClass(raceData, classData) {
  if (!raceData) return false;
  try { return add2eRaceMatchesClassRules(raceData, classData) === true; }
  catch (err) {
    console.warn("[ADD2E][DROP][RACE_CLASSE][RACE_RULE_ERROR]", { classe: classData?.name, race: raceData?.name, err });
    return false;
  }
}

function add2eRacePassesClassDrop(actor, classData, raceData, alignmentCandidate) {
  if (!raceData) return false;
  try {
    return checkClassStatMin(actor, classData, raceData, alignmentCandidate, { silent: true, ignoreLevelMax: true }) === true;
  } catch (err) {
    console.warn("[ADD2E][DROP][RACE_CLASSE][RACE_CHECK_ERROR]", { actor: actor?.name, classe: classData?.name, race: raceData?.name, err });
    return false;
  }
}

function add2eDropStatValue(actor, carac) {
  const sys = actor?.system ?? {};
  const raw = sys[`${carac}_base`] ?? sys[carac] ?? 10;
  const value = Number(raw?.value ?? raw?.total ?? raw);
  return Number.isFinite(value) ? value : 10;
}

function add2eDropRaceBonusValue(raceData, carac) {
  const raw = (raceData?.system ?? {})?.bonus_caracteristiques?.[carac] ?? 0;
  const value = Number(raw?.value ?? raw?.total ?? raw);
  return Number.isFinite(value) ? value : 0;
}

function add2eDropMissingCaracs(actor, classData, raceData) {
  const mins = (classData?.system ?? {})?.caracs_min ?? {};
  return Object.entries(mins).map(([carac, rawMin]) => {
    const min = Number(rawMin);
    if (!Number.isFinite(min)) return null;
    const total = add2eDropStatValue(actor, carac) + add2eDropRaceBonusValue(raceData, carac);
    return total < min ? { carac, total, min } : null;
  }).filter(Boolean);
}

async function add2eDialogStatFailure(actor, classData, races) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  const rows = races.map(race => {
    const missing = add2eDropMissingCaracs(actor, classData, race);
    const detail = missing.length
      ? missing.map(m => `${foundry.utils.escapeHTML(m.carac)} ${m.total} / ${m.min}`).join(", ")
      : "prérequis non satisfaits";
    return `<li><strong>${foundry.utils.escapeHTML(add2eRaceCandidateLabel(race))}</strong> : caractéristiques insuffisantes (${detail}).</li>`;
  }).join("");

  const content = `
    <div class="add2e-race-class-choice" style="min-width:420px;max-width:620px;">
      <p><strong>La classe ${foundry.utils.escapeHTML(classData.name)} possède au moins une race compatible.</strong></p>
      <p>Le blocage vient des caractéristiques actuelles de l’acteur, pas de la compatibilité raciale.</p>
      <ul>${rows}</ul>
    </div>
  `;

  if (DialogV2?.alert) return DialogV2.alert({ window: { title: "ADD2E — Prérequis insuffisants" }, content, ok: { label: "OK" }, modal: true });
  if (DialogV2?.wait) return DialogV2.wait({ window: { title: "ADD2E — Prérequis insuffisants" }, content, buttons: [{ action: "ok", label: "OK", default: true, callback: () => true }], modal: true, rejectClose: false });
  ui.notifications.warn(`Race compatible trouvée pour ${classData.name}, mais caractéristiques insuffisantes.`);
  return false;
}

async function add2eDialogChooseCompatibleRace(actor, classData, candidates, reason) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("DialogV2 est indisponible : impossible de choisir une race compatible.");
    return null;
  }

  const buttons = candidates.map((race, index) => ({
    action: `race-${index}`,
    label: add2eRaceCandidateLabel(race),
    callback: () => index
  }));
  buttons.push({ action: "cancel", label: "Annuler", default: true, callback: () => null });

  const list = candidates
    .map(race => `<li><strong>${foundry.utils.escapeHTML(add2eRaceCandidateLabel(race))}</strong></li>`)
    .join("");

  const selectedIndex = await DialogV2.wait({
    window: { title: `Choisir une race pour ${classData.name}` },
    content: `
      <div class="add2e-race-class-choice" style="min-width:360px;max-width:520px;">
        <p>La classe <strong>${foundry.utils.escapeHTML(classData.name)}</strong> nécessite une race compatible.</p>
        <p>${reason === "missing-race" ? "Aucune race n’est présente sur l’acteur." : "La race actuelle n’est pas compatible avec cette classe."}</p>
        <p>Races compatibles trouvées dans le compendium <strong>add2e.races</strong> :</p>
        <ul>${list}</ul>
      </div>
    `,
    buttons,
    modal: true,
    rejectClose: false
  });

  return Number.isInteger(selectedIndex) ? candidates[selectedIndex] : null;
}

async function add2eEnsureCompatibleRaceForClassDrop(actor, classData, sheet) {
  if (!actor || !classData || classData.type !== "classe") return { ok: true, handled: false };

  const alignmentCandidate = typeof globalThis.add2ePickClassAlignment === "function"
    ? globalThis.add2ePickClassAlignment(actor, classData.system ?? {})
    : actor.system?.alignement ?? "";

  const currentRace = add2eActorCurrentRaceData(actor);
  if (currentRace && add2eRacePassesClassDrop(actor, classData, currentRace, alignmentCandidate)) {
    return { ok: true, handled: false, currentRaceOk: true };
  }

  if (!add2eClassHasRaceRestrictions(classData)) {
    return { ok: true, handled: false, noRaceRestriction: true };
  }

  const races = await add2eLoadRaceCandidatesFromCompendium();
  const raciallyCompatible = races.filter(race => add2eRaceRuleAllowsClass(race, classData));
  const candidates = raciallyCompatible.filter(race => add2eRacePassesClassDrop(actor, classData, race, alignmentCandidate));

  console.log("[ADD2E][DROP][RACE_CLASSE][COMPATIBLE_RACES]", {
    actor: actor.name,
    classe: classData.name,
    currentRace: currentRace?.name ?? null,
    pack: "add2e.races",
    raciallyCompatible: raciallyCompatible.map(r => r.name),
    candidates: candidates.map(r => ({ name: r.name, uuid: r.flags?.add2e?.dropResolvedUuid ?? r.uuid ?? null }))
  });

  if (!candidates.length && raciallyCompatible.length) {
    await add2eDialogStatFailure(actor, classData, raciallyCompatible);
    return { ok: false, handled: true, reason: "stat-prerequisites" };
  }

  if (!candidates.length) {
    ui.notifications.warn(`Aucune race compatible trouvée dans le compendium pour ${classData.name}.`);
    return { ok: false, handled: true, reason: "no-compatible-race" };
  }

  const selectedRace = await add2eDialogChooseCompatibleRace(actor, classData, candidates, currentRace ? "incompatible-race" : "missing-race");
  if (!selectedRace) return { ok: false, handled: true, reason: "cancelled" };

  await add2eApplyRaceItemDataToActor(actor, selectedRace, sheet, {
    notify: true,
    reason: currentRace ? "class-drop-race-replace-compatible" : "class-drop-race-missing-compatible"
  });

  return { ok: true, handled: false, selectedRace };
}

function add2eInstallDropCompatibilityPopupWrapper() {
  const SheetClass = globalThis.Add2eActorSheet;
  if (!SheetClass?.prototype?._onDrop) return false;
  if (SheetClass.prototype._add2eDropCompatPopupWrapped) return true;

  const original = SheetClass.prototype._onDrop;
  SheetClass.prototype._onDrop = async function add2eDropCompatPopupWrapped(event) {
    let raw = null;
    let itemData = null;
    try {
      raw = JSON.parse(event.dataTransfer?.getData("text/plain") || "{}");
      itemData = await add2eResolveRaceClassDropItemData(raw);
    } catch (e) {
      console.warn("[ADD2E][DROP][RACE_CLASSE] Impossible de lire les données de drop.", e);
    }

    if (itemData?.type === "classe") {
      const raceResult = await add2eEnsureCompatibleRaceForClassDrop(this.actor, itemData, this);
      if (!raceResult.ok || raceResult.handled) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    }

    if (itemData && ["classe", "race"].includes(itemData.type)) {
      const resolved = await add2eResolveDropCompatibilityWithPopup(this.actor, itemData, this);
      console.log("[ADD2E][DROP][RACE_CLASSE][RESOLVED]", {
        ...resolved,
        sourceCompendium: itemData.flags?.add2e?.dropResolvedFromCompendium === true,
        sourceUuid: itemData.flags?.add2e?.dropResolvedUuid ?? itemData.uuid ?? null
      });
      if (!resolved.ok || resolved.handled) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    }

    return original.call(this, event);
  };

  SheetClass.prototype._add2eDropCompatPopupWrapped = true;
  console.log("[ADD2E][DROP][POPUP] Wrapper compatibilité race/classe installé.", ADD2E_RACE_CLASS_DROP_VERSION, "compendium-first", "race-choice", "stat-explain");
  return true;
}

Hooks.once("ready", () => {
  if (!add2eInstallDropCompatibilityPopupWrapper()) {
    setTimeout(add2eInstallDropCompatibilityPopupWrapper, 250);
    setTimeout(add2eInstallDropCompatibilityPopupWrapper, 1000);
  }
});

try { globalThis.add2eResolveRaceClassDropItemData = add2eResolveRaceClassDropItemData; } catch (_e) {}
try { globalThis.add2eLoadRaceCandidatesFromCompendium = add2eLoadRaceCandidatesFromCompendium; } catch (_e) {}
try { globalThis.add2eEnsureCompatibleRaceForClassDrop = add2eEnsureCompatibleRaceForClassDrop; } catch (_e) {}
try { globalThis.add2eInstallDropCompatibilityPopupWrapper = add2eInstallDropCompatibilityPopupWrapper; } catch (_e) {}
