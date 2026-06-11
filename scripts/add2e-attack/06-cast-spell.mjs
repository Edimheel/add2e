// scripts/add2e-attack/06-cast-spell.mjs
// ADD2E — Lancement de sorts, onUse, mémorisation, pouvoirs et composants.
// Version : 2026-06-11-cast-spell-v20-memorized-by-list

import { formatSortChamp } from "./01-core-helpers.mjs";
import "./05-jb2a-vfx.mjs";

export async function add2eCastSpell({ actor, sort } = {}) {
  if (!actor || !sort) {
    ui.notifications.warn("Lanceur ou sort introuvable.");
    return false;
  }

  let canCast = false;
  let labelCharge = "";
  let spellToUse = sort;
  let reservedCost = null;
  let componentReservation = null;

  function add2eExtractScriptPath(raw) {
    if (!raw) return "";
    let value = raw;
    if (Array.isArray(value)) value = value.find(v => typeof v === "string" && v.includes(".js")) ?? value[0] ?? "";
    value = String(value ?? "").trim();
    if (value.includes(",")) value = value.split(",").map(s => s.trim()).find(s => s.endsWith(".js")) ?? value.split(",")[0].trim();
    return value;
  }

  function add2eGetCasterToken(actorDoc) {
    return canvas?.tokens?.controlled?.[0] ?? actorDoc?.getActiveTokens?.()?.[0] ?? null;
  }

  function add2eRenderApplication(app) {
    if (!app || typeof app.render !== "function") return;
    try { app.render({ force: true }); return; } catch (_e) {}
    try { app.render(true); return; } catch (_e) {}
    try { app.render(false); } catch (_e) {}
  }

  function add2eActorSheetIsAlreadyOpen(actorDoc) {
    if (!actorDoc?.id) return false;
    try {
      for (const app of Object.values(ui.windows ?? {})) {
        const doc = app?.actor ?? app?.document ?? app?.object ?? null;
        if (doc?.documentName === "Actor" && String(doc.id) === String(actorDoc.id)) return true;
      }
    } catch (_e) {}
    return false;
  }

  function add2eUpdateVisibleMemorizedBadges(actorDoc, sortDoc, value) {
    const textValue = String(Math.max(0, Number(value) || 0));
    try {
      const roots = Array.from(document.querySelectorAll(".add2e-character-v3"));
      for (const root of roots) {
        const rows = Array.from(root.querySelectorAll([
          `[data-sort-id="${sortDoc.id}"]`,
          `[data-item-id="${sortDoc.id}"]`,
          `[data-itemid="${sortDoc.id}"]`,
          `[data-id="${sortDoc.id}"]`,
          `[data-uuid="${sortDoc.uuid}"]`
        ].join(",")));
        for (const row of rows) {
          const badges = row.querySelectorAll?.(".sort-memorize-badge, [data-memorized-count], [data-add2e-memorized-count]") ?? [];
          for (const badge of badges) {
            badge.textContent = textValue;
            badge.dataset.memorizedCount = textValue;
            badge.dataset.add2eMemorizedCount = textValue;
          }
        }
      }
    } catch (_e) {}
  }

  async function add2eRefreshActorSpellSheets(actorDoc, sortDoc, value) {
    if (value !== undefined) add2eUpdateVisibleMemorizedBadges(actorDoc, sortDoc, value);
    try {
      for (const app of Object.values(ui.windows ?? {})) {
        const doc = app?.actor ?? app?.document ?? app?.object ?? null;
        const sameActor = doc?.documentName === "Actor" && String(doc.id) === String(actorDoc.id);
        const sameItem = doc?.documentName === "Item" && String(doc.id) === String(sortDoc.id);
        if (sameActor || sameItem) add2eRenderApplication(app);
      }
    } catch (_e) {}

    setTimeout(() => {
      if (value !== undefined) add2eUpdateVisibleMemorizedBadges(actorDoc, sortDoc, value);
      if (!add2eActorSheetIsAlreadyOpen(actorDoc)) return;
      try {
        for (const app of Object.values(ui.windows ?? {})) {
          const doc = app?.actor ?? app?.document ?? app?.object ?? null;
          const sameActor = doc?.documentName === "Actor" && String(doc.id) === String(actorDoc.id);
          const sameItem = doc?.documentName === "Item" && String(doc.id) === String(sortDoc.id);
          if (sameActor || sameItem) add2eRenderApplication(app);
        }
      } catch (_e) {}
    }, 80);
  }

  function add2eGetSpellEntry(actorDoc, sortDoc) {
    if (typeof globalThis.add2eGetSpellEntryForSpell === "function") {
      try { return globalThis.add2eGetSpellEntryForSpell(actorDoc, sortDoc); } catch (_e) {}
    }
    return null;
  }

  function add2eGetMemorizedCount(sortDoc, entry) {
    if (entry && typeof globalThis.add2eGetMemorizedCountForEntry === "function") {
      return Math.max(0, Number(globalThis.add2eGetMemorizedCountForEntry(sortDoc, entry)) || 0);
    }
    if (typeof globalThis.add2eGetTotalMemorizedCount === "function") {
      return Math.max(0, Number(globalThis.add2eGetTotalMemorizedCount(sortDoc)) || 0);
    }
    const byList = sortDoc?.flags?.add2e?.memorizedByList ?? {};
    if (byList && typeof byList === "object") return Object.values(byList).reduce((sum, v) => sum + (Number(v) || 0), 0);
    return Math.max(0, Number(sortDoc?.flags?.add2e?.memorizedCount ?? 0) || 0);
  }

  async function add2eSetMemorizedCount(actorDoc, sortDoc, value, reason = "", entry = null) {
    const next = Math.max(0, Number(value) || 0);
    if (entry && typeof globalThis.add2eSetMemorizedCountForEntry === "function") {
      await globalThis.add2eSetMemorizedCountForEntry(sortDoc, entry, next);
      await add2eRefreshActorSpellSheets(actorDoc, sortDoc, next);
      return next;
    }

    const updateData = { "flags.add2e.memorizedCount": next };
    await sortDoc.update(updateData);
    await add2eRefreshActorSpellSheets(actorDoc, sortDoc, next);
    return next;
  }

  async function add2ePlayGenericCastVfx(actorDoc, sortDoc) {
    const casterToken = add2eGetCasterToken(actorDoc);
    if (!casterToken || !canvas?.ready) return;
    await globalThis.ADD2E_PLAY_SPELL_FX?.("default", { casterToken });
  }

  async function add2eRefundReservedComponents(reason = "") {
    if (!componentReservation) return false;
    try {
      const refunded = await globalThis.ADD2E_CONSUMABLES?.add2eRefundSpellComponents?.(componentReservation);
      componentReservation = null;
      return !!refunded;
    } catch (e) {
      console.error("[ADD2E][CAST_SPELL][REFUND][COMPONENTS][ERROR]", e, componentReservation);
      return false;
    }
  }

  async function add2eRefundReservedCost(reason = "") {
    await add2eRefundReservedComponents(reason);
    if (!reservedCost) return false;
    try {
      if (reservedCost.kind === "memorized") {
        const now = add2eGetMemorizedCount(reservedCost.sort, reservedCost.entry);
        if (now !== reservedCost.after) {
          await add2eRefreshActorSpellSheets(actor, reservedCost.sort, now);
          return false;
        }
        await add2eSetMemorizedCount(actor, reservedCost.sort, reservedCost.before, `refund:${reason}`, reservedCost.entry);
        return true;
      }

      if (reservedCost.kind === "power") {
        const { weapon, flagKey, before, after } = reservedCost;
        const now = Number(await weapon.getFlag("add2e", flagKey)) || 0;
        if (now !== after) return false;
        await weapon.setFlag("add2e", flagKey, before);
        return true;
      }
    } catch (e) {
      console.error("[ADD2E][CAST_SPELL][REFUND][ERROR]", e, reservedCost);
    }
    return false;
  }

  async function add2eReserveComponentsAfterCost() {
    if (sort.system?.isPower) return true;
    const api = globalThis.ADD2E_CONSUMABLES;
    if (!api?.add2eReserveSpellComponents) return true;
    componentReservation = await api.add2eReserveSpellComponents(actor, spellToUse);
    if (componentReservation?.blocked) {
      const message = componentReservation.message || "Composant matériel manquant.";
      await add2eRefundReservedCost("composants manquants");
      ui.notifications.warn(message);
      return false;
    }
    return true;
  }

  async function add2eCreateFallbackSpellChat(actorDoc, sortDoc, chargeLabel = "") {
    const info = sortDoc.system ?? {};
    const niveauPerso = Number(actorDoc.system?.niveau) || Number(info.niveau) || 1;
    const details = [
      { label: "Portée", val: formatSortChamp(info.portee, niveauPerso) },
      { label: "Durée", val: formatSortChamp(info.duree, niveauPerso) },
      { label: "Cible", val: formatSortChamp(info.cible, niveauPerso) },
      { label: "Incant.", val: formatSortChamp(info.temps_incantation, niveauPerso) }
    ];
    const htmlMsg = `<div class="add2e-spell-card" style="border-radius:12px;box-shadow:0 2px 10px #715aab33;background:linear-gradient(100deg,#f8f6fc 90%,#e8def8 100%);border:1.5px solid #9373c7;margin:0.3em 0 0.2em 0;max-width:440px;padding:0.5em 1.3em 0.5em 1em;font-family:var(--font-primary);"><div style="display:flex;align-items:center;gap:0.7em;"><img src="${sortDoc.img || "icons/svg/book.svg"}" alt="" style="width:46px;height:46px;border-radius:7px;box-shadow:0 1px 4px #0002;object-fit:contain;"><span style="font-size:1.18em;font-weight:bold;color:#6841a2;">${sortDoc.name}</span><span style="margin-left:auto;color:#8e44ad;font-size:0.97em;font-weight:600;">Niv. ${info.niveau || "-"}</span><span style="font-size:0.9em;font-weight:bold;margin-left:5px;">${chargeLabel}</span></div><table style="margin:0.3em 0 0.3em 0;width:100%;font-size:0.98em;">${details.map(d => `<tr><td style="color:#8571a5;font-weight:600;width:120px;">${d.label}</td><td style="color:#222;font-weight:500;">${d.val || "-"}</td></tr>`).join("")}</table><details open style="margin-top:0.2em;background:#eee8fa;border-radius:6px;border:1px solid #e1d2fb;"><summary style="cursor:pointer;color:#6a3c99;font-size:1em;font-weight:600;">Description</summary><div style="color:#48307a;font-size:0.99em;margin-top:0.3em;margin-bottom:0.2em;padding:0.15em 0.4em 0.25em 0.2em;">${info.description || "<em>Aucune description.</em>"}</div></details></div>`;
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: actorDoc }), content: htmlMsg, ...(CONST.CHAT_MESSAGE_STYLES ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER } : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 }) });
  }

  if (sort.system?.isPower) {
    const weapon = actor.items.get(sort.system.sourceWeaponId);
    if (!weapon) { ui.notifications.error("Objet source introuvable."); return false; }
    const maxChargesGlobal = Number(weapon.system?.max_charges || 0);
    const isGlobalMode = maxChargesGlobal > 0;
    let current = 0;
    let max = 0;
    let flagKey = "";
    if (isGlobalMode) {
      flagKey = "global_charges";
      const val = await weapon.getFlag("add2e", flagKey);
      max = maxChargesGlobal;
      current = (val !== undefined && val !== null) ? Number(val) : max;
    } else {
      flagKey = `charges_${sort.system.powerIndex}`;
      const val = await weapon.getFlag("add2e", flagKey);
      max = Number(sort.system.max || 1);
      current = (val !== undefined && val !== null) ? Number(val) : max;
    }
    const cost = Number(sort.system.cost || 1);
    if (current < cost) { ui.notifications.warn(`L'objet ${weapon.name} n'a plus assez de charges (${current}/${cost} req).`); return false; }
    const newCharges = current - cost;
    await weapon.setFlag("add2e", flagKey, newCharges);
    reservedCost = { kind: "power", weapon, isGlobalMode, flagKey, before: current, after: newCharges, max, cost };
    canCast = true;
    labelCharge = `<span style="color:#d35400;">Charges : ${newCharges}/${max}</span>`;
    const baseName = sort.name.replace(/\s\(.*?\)$/, "").trim();
    const realSpell = game.items.find(i => i.type === "sort" && i.name.toLowerCase() === baseName.toLowerCase());
    if (realSpell) spellToUse = realSpell;
  } else {
    const entry = add2eGetSpellEntry(actor, sort);
    if (!entry) {
      ui.notifications.warn(`Le sort "${sort.name}" n'est pas autorisé pour ce lanceur.`);
      return false;
    }
    const mem = add2eGetMemorizedCount(sort, entry);
    if (mem <= 0) {
      ui.notifications.warn(`Le sort "${sort.name}" n'est plus mémorisé !`);
      await add2eRefreshActorSpellSheets(actor, sort, 0);
      return false;
    }
    const newMem = Math.max(0, mem - 1);
    await add2eSetMemorizedCount(actor, sort, newMem, "reserve before onUse", entry);
    reservedCost = { kind: "memorized", sort, entry, before: mem, after: newMem };
    canCast = true;
    labelCharge = `<span style="color:#2980b9;">Reste : ${newMem}</span>`;
  }

  if (!canCast) return false;
  if (!await add2eReserveComponentsAfterCost()) return false;

  const info = spellToUse.system ?? {};
  const scriptPath = add2eExtractScriptPath(info.onUse || info.onuse || info.on_use);
  let launched = true;
  let scriptExecuted = false;

  if (scriptPath) {
    scriptExecuted = true;
    try {
      const response = await fetch(scriptPath, { cache: "no-store" });
      if (!response.ok) {
        await add2eRefundReservedCost("script introuvable");
        ui.notifications.error(`${spellToUse.name} : script onUse introuvable.`);
        console.error("[ADD2E][CAST_SPELL][ONUSE][FETCH_FAILED]", { sort: spellToUse.name, scriptPath, status: response.status, statusText: response.statusText });
        return false;
      }
      const code = await response.text();
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const casterToken = add2eGetCasterToken(actor);
      const fn = new AsyncFunction("actor", "item", "sort", "token", "args", "sourceItem", code);
      const result = await fn.call(spellToUse, actor, spellToUse, sort, casterToken, [{ actor, item: spellToUse, sort, token: casterToken, sourceItem: spellToUse }], spellToUse);
      if (result === true) launched = true;
      else if (result === false) launched = false;
      else {
        launched = false;
        ui.notifications.error(`${spellToUse.name} : le script onUse doit retourner true ou false.`);
      }
    } catch(e) {
      await add2eRefundReservedCost("erreur script");
      console.error("[ADD2E][CAST_SPELL][ONUSE][ERROR]", { sort: spellToUse.name, scriptPath, error: e });
      ui.notifications.error(`${spellToUse.name} : erreur dans le script onUse.`);
      return false;
    }
  }

  if (!launched) {
    await add2eRefundReservedCost("onUse false");
    return false;
  }

  componentReservation = null;

  if (!scriptExecuted) {
    await add2ePlayGenericCastVfx(actor, spellToUse);
    await add2eCreateFallbackSpellChat(actor, spellToUse, labelCharge);
  }

  await add2eRefreshActorSpellSheets(actor, sort, reservedCost?.kind === "memorized" ? reservedCost.after : undefined);
  return true;
}

globalThis.add2eCastSpell = add2eCastSpell;
globalThis.cast_spell = add2eCastSpell;
