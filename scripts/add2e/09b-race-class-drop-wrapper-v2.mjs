// ============================================================
// ADD2E — Auto-compatibilité race / classe au drop — wrapper V2
// Version : 2026-06-16-race-class-drop-split-v8-class-minimums-only
// ============================================================

import {
  ADD2E_RACE_CLASS_DROP_VERSION,
  add2eResolveDropCompatibilityWithPopup,
  checkClassStatMin,
  add2eApplyRaceItemDataToActor,
  add2eApplyClassItemDataToActor,
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

function add2eDropWrapperEsc(value) {
  return foundry?.utils?.escapeHTML ? foundry.utils.escapeHTML(String(value ?? "")) : String(value ?? "");
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

function add2eActorHasClass(actor) {
  return actor?.items?.some?.(i => String(i.type || "").toLowerCase() === "classe") === true;
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
  if (raceName) return { name: raceName, type: "race", system: foundry.utils.deepClone(sys.details_race ?? { name: raceName, label: raceName }), flags: {} };
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
  try { return checkClassStatMin(actor, classData, raceData, alignmentCandidate, { silent: true, ignoreLevelMax: true }) === true; }
  catch (err) {
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

function add2eClassMinRows(actor, classData) {
  const mins = (classData?.system ?? {})?.caracs_min ?? {};
  return Object.entries(mins).map(([carac, rawMin]) => {
    const min = Number(rawMin);
    if (!Number.isFinite(min)) return null;
    const current = add2eDropStatValue(actor, carac);
    return { carac, current, min, ok: current >= min, manque: Math.max(0, min - current) };
  }).filter(Boolean);
}

function add2eCaracLabel(carac) {
  const labels = { force: "FOR", dexterite: "DEX", constitution: "CON", intelligence: "INT", sagesse: "SAG", charisme: "CHA" };
  return labels[add2eDropWrapperNorm(carac)] ?? String(carac ?? "").toUpperCase();
}

function add2eRacePalette(raceName) {
  const key = add2eDropWrapperNorm(raceName);
  const palettes = {
    humain: ["#10291c", "#9ee7a8", "#2f9e54", "#176034", "#0b3d20"],
    demi_elfe: ["#10253a", "#a7ddff", "#3d8ee6", "#1c5a9a", "#0c345d"],
    elfe: ["#12280f", "#c8f58b", "#64b83b", "#2e6f1d", "#183f10"],
    gnome: ["#2c1837", "#e2b6ff", "#a45bd8", "#67308c", "#3b1456"],
    nain: ["#2d2110", "#f1c77d", "#bd7834", "#744114", "#3d230b"],
    demi_orque: ["#2b1a0a", "#ffb25f", "#d45b1f", "#823113", "#451807"],
    halfelin: ["#2c2609", "#e7dd72", "#b69b2f", "#6d5b17", "#3b320c"]
  };
  return palettes[key] ?? ["#261500", "#f6e7a8", "#d7a94d", "#7b4300", "#3b2308"];
}

function add2eClassRaceTileHtml({ value, className, raceName, checked = false }) {
  const [color, bg1, bg2, border, selected] = add2eRacePalette(raceName);
  return `<label style="position:relative;display:grid;grid-template-columns:24px 1fr;gap:8px;align-items:center;min-height:58px;padding:8px 9px;border:2px solid ${border};border-radius:12px;background:linear-gradient(135deg,${bg1},${bg2});color:${color};cursor:pointer;"><input type="radio" name="add2eChoice" value="${add2eDropWrapperEsc(value)}" ${checked ? "checked" : ""} style="width:20px;height:20px;margin:0;accent-color:${selected};cursor:pointer;"><span style="display:grid;gap:1px;text-align:left;"><strong style="font-size:1rem;line-height:1.08;">${add2eDropWrapperEsc(className)}</strong><span style="font-size:.84rem;line-height:1.05;font-weight:900;text-transform:uppercase;letter-spacing:.04em;">${add2eDropWrapperEsc(raceName)}</span></span></label>`;
}

function add2eClassMinimumCard(actor, classData) {
  const rows = add2eClassMinRows(actor, classData);
  const chips = rows.map(row => {
    const color = row.ok ? "#176034" : "#8a1f16";
    const bg = row.ok ? "#e7f5df" : "#fff1c9";
    const detail = row.ok ? "OK" : `+${row.manque} requis`;
    return `<div style="border:1px solid #b98224;border-radius:10px;background:${bg};padding:8px;display:grid;gap:3px;">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><strong style="font-size:1rem;">${add2eDropWrapperEsc(add2eCaracLabel(row.carac))}</strong><span style="font-weight:900;color:${color};">${row.current} → ${row.min}</span></div>
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><span style="font-size:.72rem;font-weight:800;color:#6a4b16;">actuel ${row.current}</span><span style="font-size:.78rem;font-weight:900;color:${color};">${detail}</span></div>
    </div>`;
  }).join("");

  return `<div style="border:2px solid #7b4300;border-radius:13px;background:linear-gradient(135deg,#f6e7a8,#d7a94d);color:#261500;padding:10px;display:grid;gap:8px;box-shadow:0 2px 8px rgba(0,0,0,.16);">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;"><strong style="font-size:1.08rem;">${add2eDropWrapperEsc(classData.name)}</strong><span style="font-size:.86rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em;">minimum requis</span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px;">${chips}</div>
  </div>`;
}

async function add2eDialogStatFailure(actor, classData) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  const card = add2eClassMinimumCard(actor, classData);
  const content = `
    <div class="add2e-multiclass-choice" style="display:grid;gap:9px;min-width:600px;max-width:760px;color:#2b1c0d;">
      <div style="border:1px solid #5c3b12;border-radius:12px;background:linear-gradient(180deg,#3b2612,#1c1208);padding:9px 12px;">
        <h2 style="margin:0;color:#f9df9a;font-size:1rem;text-transform:uppercase;border:0;">Prérequis de classe insuffisants</h2>
        <p style="margin:4px 0 0;color:#fff2c4;font-weight:800;">Les caractéristiques de l’acteur ne remplissent pas encore les minimums de la classe déposée.</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;">
        <div style="border:1px solid #c59a3d;border-radius:10px;background:#fffaf0;padding:8px;"><b>Acteur</b><br>${add2eDropWrapperEsc(actor.name)}</div>
        <div style="border:1px solid #c59a3d;border-radius:10px;background:#fffaf0;padding:8px;"><b>Classe déposée</b><br>${add2eDropWrapperEsc(classData.name)}</div>
      </div>
      <div style="border:1px solid #9d6b18;border-radius:10px;background:#fff1c9;color:#5d3607;padding:9px 11px;font-weight:800;">
        Corrige les valeurs indiquées ci-dessous, puis redépose la classe. La fenêtre suivante proposera les combinaisons classe/race valides.
      </div>
      ${card}
    </div>
  `;

  if (DialogV2?.wait) return DialogV2.wait({
    classes: ["add2e-multiclass-dialog"],
    window: { title: "ADD2E — Prérequis de classe" },
    content,
    buttons: [{ action: "ok", label: "Corriger les caractéristiques", default: true, callback: () => true }],
    modal: true,
    rejectClose: false,
    close: () => true
  });
  if (DialogV2?.alert) return DialogV2.alert({ window: { title: "ADD2E — Prérequis de classe" }, content, ok: { label: "Corriger les caractéristiques" }, modal: true });
  ui.notifications.warn(`Caractéristiques insuffisantes pour ${classData.name}.`);
  return false;
}

async function add2eDialogChooseClassRaceTile(actor, classData, candidates, reason) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("DialogV2 est indisponible : impossible de choisir une combinaison classe/race.");
    return null;
  }

  let checked = false;
  const tiles = candidates.map((race, index) => {
    const raceName = add2eRaceCandidateLabel(race);
    const tile = add2eClassRaceTileHtml({ value: `race-${index}`, className: classData.name, raceName, checked: !checked });
    checked = true;
    return tile;
  }).join("\n");

  const content = `
    <div class="add2e-multiclass-choice" style="display:grid;gap:8px;min-width:580px;max-width:720px;color:#2b1c0d;">
      <div style="border:1px solid #5c3b12;border-radius:12px;background:linear-gradient(180deg,#3b2612,#1c1208);padding:8px 11px;">
        <h2 style="margin:0;color:#f9df9a;font-size:1rem;text-transform:uppercase;border:0;">Choisis ton évolution</h2>
        <p style="margin:4px 0 0;color:#fff2c4;font-weight:800;">La classe déposée nécessite une race compatible. Le choix applique directement la race et la classe.</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;">
        <div><b>Acteur</b><br>${add2eDropWrapperEsc(actor.name)}</div>
        <div><b>Classe déposée</b><br>${add2eDropWrapperEsc(classData.name)}</div>
        <div><b>Situation</b><br>${reason === "missing-race" ? "Aucune race" : "Race à choisir"}</div>
      </div>
      <div style="display:grid;gap:6px;">
        <div style="font-weight:900;color:#5b3512;text-transform:uppercase;font-size:.78rem;letter-spacing:.04em;">Créer le personnage</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:7px;">${tiles}</div>
      </div>
    </div>
  `;

  const readChoice = (_event, button, dialog) => {
    const form = button?.form ?? dialog?.element?.querySelector?.("form") ?? document.querySelector?.(".add2e-multiclass-choice")?.closest?.("form");
    const raw = form?.elements?.add2eChoice?.value ?? dialog?.element?.querySelector?.('input[name="add2eChoice"]:checked')?.value ?? "cancel";
    if (!raw.startsWith("race-")) return null;
    return candidates[Number(raw.split("-")[1]) || 0] ?? null;
  };

  return DialogV2.wait({
    classes: ["add2e-multiclass-dialog"],
    window: { title: "ADD2E — Classe et race" },
    content,
    buttons: [
      { action: "validate", label: "Valider", default: true, callback: readChoice },
      { action: "cancel", label: "Annuler", callback: () => null }
    ],
    modal: true,
    rejectClose: false,
    close: () => null
  });
}

async function add2eApplyRaceAndClassFromChoice(actor, classData, raceData, sheet, alignmentCandidate) {
  await add2eApplyRaceItemDataToActor(actor, raceData, sheet, { notify: true, reason: "class-drop-tile-race-choice" });
  await add2eApplyClassItemDataToActor(actor, classData, sheet, { notify: true, reason: "class-drop-tile-class-choice", alignmentCandidate });
  sheet?.render?.(false);
}

async function add2eEnsureCompatibleRaceForClassDrop(actor, classData, sheet) {
  if (!actor || !classData || classData.type !== "classe") return { ok: true, handled: false };
  if (add2eActorHasClass(actor)) return { ok: true, handled: false, existingClass: true };

  const alignmentCandidate = typeof globalThis.add2ePickClassAlignment === "function"
    ? globalThis.add2ePickClassAlignment(actor, classData.system ?? {})
    : actor.system?.alignement ?? "";

  if (!add2eClassHasRaceRestrictions(classData)) return { ok: true, handled: false, noRaceRestriction: true };

  const currentRace = add2eActorCurrentRaceData(actor);
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
    await add2eDialogStatFailure(actor, classData);
    return { ok: false, handled: true, reason: "stat-prerequisites" };
  }

  if (!candidates.length) {
    ui.notifications.warn(`Aucune race compatible trouvée dans le compendium pour ${classData.name}.`);
    return { ok: false, handled: true, reason: "no-compatible-race" };
  }

  const selectedRace = await add2eDialogChooseClassRaceTile(actor, classData, candidates, currentRace ? "incompatible-race" : "missing-race");
  if (!selectedRace) return { ok: false, handled: true, reason: "cancelled" };

  await add2eApplyRaceAndClassFromChoice(actor, classData, selectedRace, sheet, alignmentCandidate);
  return { ok: true, handled: true, selectedRace, appliedClass: true };
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
        return raceResult.ok === true;
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
  console.log("[ADD2E][DROP][POPUP] Wrapper compatibilité race/classe installé.", ADD2E_RACE_CLASS_DROP_VERSION, "class-minimums-only");
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
