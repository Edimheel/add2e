// scripts/add2e-attack/06-cast-spell.mjs
// ADD2E — Lancement de sorts, onUse, mémorisation et pouvoirs.

import { formatSortChamp } from "./01-core-helpers.mjs";
import "./05-jb2a-vfx.mjs";

/**
 * Lancer de sort (Script + Gestion Charges Objet)
 * VERSION : 2026-05-21-cast-spell-v17-no-generic-vfx-after-onuse
 *
 * Règle stricte :
 * - onUse === true  => le sort est réellement lancé, le coût reste consommé ;
 * - onUse === false => annulation / cible manquante / invalide, le coût est remboursé ;
 * - toute autre valeur => erreur stricte, coût remboursé, aucun fallback undefined.
 *
 * V17 :
 * - si un script onUse existe, il est seul responsable des VFX et du chat ;
 * - le VFX générique n'est joué que pour les sorts sans script onUse.
 */
export async function add2eCastSpell({ actor, sort } = {}) {
  if (!actor || !sort) {
    ui.notifications.warn("Lanceur ou sort introuvable.");
    return false;
  }

  console.log("[ADD2E][CAST_SPELL] Début", {
    actor: actor.name,
    sort: sort.name,
    sortId: sort.id,
    sortType: sort.type,
    isPower: !!sort.system?.isPower,
    onUse: sort.system?.onUse,
    onuse: sort.system?.onuse,
    on_use: sort.system?.on_use
  });

  let canCast = false;
  let labelCharge = "";
  let spellToUse = sort;
  let reservedCost = null;

  function add2eExtractScriptPath(raw) {
    if (!raw) return "";
    let value = raw;
    if (Array.isArray(value)) value = value.find(v => typeof v === "string" && v.includes(".js")) ?? value[0] ?? "";
    value = String(value ?? "").trim();
    if (value.includes(",")) {
      value = value.split(",").map(s => s.trim()).find(s => s.endsWith(".js")) ?? value.split(",")[0].trim();
    }
    return value;
  }

  function add2eGetCasterToken(actorDoc) {
    return canvas?.tokens?.controlled?.[0] ?? actorDoc?.getActiveTokens?.()?.[0] ?? null;
  }

  function add2eRenderApplication(app) {
    if (!app || typeof app.render !== "function") return;
    try { app.render({ force: true }); return; } catch (e) {}
    try { app.render(true); return; } catch (e) {}
    try { app.render(false); } catch (e) {}
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
    } catch (e) {
      console.warn("[ADD2E][CAST_SPELL][UI_REFRESH][DOM_BADGE_FAILED]", e);
    }
  }

  async function add2eRefreshActorSpellSheets(actorDoc, sortDoc, value) {
    add2eUpdateVisibleMemorizedBadges(actorDoc, sortDoc, value);
    try {
      for (const app of Object.values(ui.windows ?? {})) {
        const doc = app?.actor ?? app?.document ?? app?.object ?? null;
        const sameActor = doc?.documentName === "Actor" && String(doc.id) === String(actorDoc.id);
        const sameItem = doc?.documentName === "Item" && String(doc.id) === String(sortDoc.id);
        if (sameActor || sameItem) add2eRenderApplication(app);
      }
    } catch (e) {}

    setTimeout(() => {
      add2eUpdateVisibleMemorizedBadges(actorDoc, sortDoc, value);
      if (!add2eActorSheetIsAlreadyOpen(actorDoc)) return;
      try {
        for (const app of Object.values(ui.windows ?? {})) {
          const doc = app?.actor ?? app?.document ?? app?.object ?? null;
          const sameActor = doc?.documentName === "Actor" && String(doc.id) === String(actorDoc.id);
          const sameItem = doc?.documentName === "Item" && String(doc.id) === String(sortDoc.id);
          if (sameActor || sameItem) add2eRenderApplication(app);
        }
      } catch (e) {}
    }, 80);
  }

  function add2eDeepCloneForSpell(value) {
    if (value === undefined || value === null) return value;
    try {
      if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
      if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
      return JSON.parse(JSON.stringify(value));
    } catch (e) { return value; }
  }

  function add2eNormalizeSpellCounterPath(value) {
    return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function add2eIsMemorizedByListCounterPath(path) {
    const p = add2eNormalizeSpellCounterPath(path);
    if (!p) return false;
    if (p.includes("max") || p.includes("maximum") || p.includes("total") || p.includes("capacity") || p.includes("capacite")) return false;
    if (p.includes("niveau_max") || p.includes("level_max")) return false;
    return true;
  }

  function add2eAdjustMemorizedByListValue(rawByList, targetTotal) {
    const target = Math.max(0, Number(targetTotal) || 0);
    if (rawByList === undefined || rawByList === null || rawByList === "") return { changed: false, value: rawByList, beforeSum: 0, afterSum: 0, leaves: [] };
    if (typeof rawByList === "number") return { changed: rawByList !== target, value: target, beforeSum: Number(rawByList) || 0, afterSum: target, leaves: [{ path: "", before: Number(rawByList) || 0, after: target }] };
    if (typeof rawByList !== "object") return { changed: false, value: rawByList, beforeSum: 0, afterSum: 0, leaves: [] };

    const clone = add2eDeepCloneForSpell(rawByList);
    const leaves = [];
    function scan(obj, pathParts = []) {
      if (!obj || typeof obj !== "object") return;
      for (const [key, value] of Object.entries(obj)) {
        const nextPath = [...pathParts, key];
        const path = nextPath.join(".");
        if (typeof value === "number" && Number.isFinite(value) && add2eIsMemorizedByListCounterPath(path)) {
          leaves.push({ parent: obj, key, path, before: value });
          continue;
        }
        if (value && typeof value === "object" && !Array.isArray(value)) scan(value, nextPath);
      }
    }
    scan(clone, []);
    if (!leaves.length) return { changed: false, value: clone, beforeSum: 0, afterSum: 0, leaves: [] };

    const beforeSum = leaves.reduce((sum, leaf) => sum + (Number(leaf.parent[leaf.key]) || 0), 0);
    let delta = target - beforeSum;
    if (delta < 0) {
      let remaining = Math.abs(delta);
      for (const leaf of leaves) {
        if (remaining <= 0) break;
        const current = Math.max(0, Number(leaf.parent[leaf.key]) || 0);
        if (current <= 0) continue;
        const dec = Math.min(current, remaining);
        leaf.parent[leaf.key] = current - dec;
        remaining -= dec;
      }
    } else if (delta > 0) {
      const first = leaves[0];
      first.parent[first.key] = Math.max(0, Number(first.parent[first.key]) || 0) + delta;
    }
    const afterSum = leaves.reduce((sum, leaf) => sum + (Number(leaf.parent[leaf.key]) || 0), 0);
    const changed = afterSum !== beforeSum || beforeSum !== target;
    return { changed, value: clone, beforeSum, afterSum, leaves: leaves.map(leaf => ({ path: leaf.path, before: leaf.before, after: Number(leaf.parent[leaf.key]) || 0 })) };
  }

  async function add2eSetMemorizedCount(actorDoc, sortDoc, value, reason = "") {
    const next = Math.max(0, Number(value) || 0);
    const byListBefore = await sortDoc.getFlag("add2e", "memorizedByList");
    const byListSync = add2eAdjustMemorizedByListValue(byListBefore, next);
    const updateData = { "flags.add2e.memorizedCount": next };
    if (byListSync.changed) updateData["flags.add2e.memorizedByList"] = byListSync.value;
    await sortDoc.update(updateData);
    await add2eRefreshActorSpellSheets(actorDoc, sortDoc, next);
    const after = Number(await sortDoc.getFlag("add2e", "memorizedCount")) || 0;
    const byListAfter = await sortDoc.getFlag("add2e", "memorizedByList");
    console.log("[ADD2E][CAST_SPELL][MEMORIZED][SET]", { actor: actorDoc.name, sort: sortDoc.name, reason, wanted: next, after, memorizedByListSync: { changed: byListSync.changed, beforeSum: byListSync.beforeSum, afterSum: byListSync.afterSum, leaves: byListSync.leaves, before: byListBefore, after: byListAfter } });
    return after;
  }

  async function add2ePlayGenericCastVfx(actorDoc, sortDoc) {
    const casterToken = add2eGetCasterToken(actorDoc);
    if (!casterToken || !canvas?.ready) return;
    await globalThis.ADD2E_PLAY_SPELL_FX?.("default", { casterToken });
  }

  async function add2eRefundReservedCost(reason = "") {
    if (!reservedCost) return false;
    try {
      if (reservedCost.kind === "memorized") {
        const now = Number(await reservedCost.sort.getFlag("add2e", "memorizedCount")) || 0;
        if (now !== reservedCost.after) {
          console.warn("[ADD2E][CAST_SPELL][REFUND][MEMORIZED][SKIP_CHANGED]", { reason, sort: reservedCost.sort.name, before: reservedCost.before, after: reservedCost.after, now });
          await add2eRefreshActorSpellSheets(actor, reservedCost.sort, now);
          return false;
        }
        await add2eSetMemorizedCount(actor, reservedCost.sort, reservedCost.before, `refund:${reason}`);
        console.log("[ADD2E][CAST_SPELL][REFUND][MEMORIZED]", { reason, sort: reservedCost.sort.name, restored: reservedCost.before });
        return true;
      }

      if (reservedCost.kind === "power") {
        const { weapon, isGlobalMode, flagKey, before, after } = reservedCost;
        const now = Number(await weapon.getFlag("add2e", flagKey)) || 0;
        if (now !== after) {
          console.warn("[ADD2E][CAST_SPELL][REFUND][POWER][SKIP_CHANGED]", { reason, weapon: weapon.name, flagKey, before, after, now });
          return false;
        }
        await weapon.setFlag("add2e", flagKey, before);
        console.log("[ADD2E][CAST_SPELL][REFUND][POWER]", { reason, weapon: weapon.name, flagKey, isGlobalMode, restored: before });
        return true;
      }
    } catch (e) {
      console.error("[ADD2E][CAST_SPELL][REFUND][ERROR]", e, reservedCost);
    }
    return false;
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
    console.log("[ADD2E][CAST_SPELL][COST_RESERVED][POWER]", reservedCost);
    const baseName = sort.name.replace(/\s\(.*?\)$/, "").trim();
    const realSpell = game.items.find(i => i.type === "sort" && i.name.toLowerCase() === baseName.toLowerCase());
    if (realSpell) spellToUse = realSpell;
  } else {
    const mem = Number(await sort.getFlag("add2e", "memorizedCount")) || 0;
    if (mem <= 0) {
      ui.notifications.warn(`Le sort "${sort.name}" n'est plus mémorisé !`);
      console.warn("[ADD2E][CAST_SPELL][MEMORIZED][EMPTY]", { actor: actor.name, sort: sort.name, memorizedCount: mem });
      await add2eRefreshActorSpellSheets(actor, sort, 0);
      return false;
    }
    const newMem = Math.max(0, mem - 1);
    await add2eSetMemorizedCount(actor, sort, newMem, "reserve before onUse");
    reservedCost = { kind: "memorized", sort, before: mem, after: newMem };
    canCast = true;
    labelCharge = `<span style="color:#2980b9;">Reste : ${newMem}</span>`;
    console.log("[ADD2E][CAST_SPELL][COST_RESERVED][MEMORIZED]", { actor: actor.name, sort: sort.name, before: mem, after: newMem });
  }

  if (!canCast) return false;

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
        console.error("[ADD2E][CAST_SPELL][BAD_RETURN_STRICT]", { sort: spellToUse.name, result, message: "Le onUse doit retourner true ou false. Aucun fallback undefined : le coût réservé sera remboursé." });
        ui.notifications.error(`${spellToUse.name} : le script onUse doit retourner true ou false.`);
      }
      console.log("[ADD2E][CAST_SPELL][ONUSE_RESULT]", { sort: spellToUse.name, result, consumed: launched });
    } catch(e) {
      await add2eRefundReservedCost("erreur script");
      console.error("[ADD2E][CAST_SPELL][ONUSE][ERROR]", { sort: spellToUse.name, scriptPath, error: e });
      ui.notifications.error(`${spellToUse.name} : erreur dans le script onUse.`);
      return false;
    }
  }

  if (!launched) {
    await add2eRefundReservedCost("onUse false");
    console.log("[ADD2E][CAST_SPELL][NOT_CONSUMED]", { actor: actor.name, sort: spellToUse.name });
    return false;
  }

  if (!scriptExecuted) {
    await add2ePlayGenericCastVfx(actor, spellToUse);
    await add2eCreateFallbackSpellChat(actor, spellToUse, labelCharge);
  }

  await add2eRefreshActorSpellSheets(actor, sort, reservedCost?.kind === "memorized" ? reservedCost.after : undefined);

  console.log("[ADD2E][CAST_SPELL][CONSUMED]", { actor: actor.name, sort: spellToUse.name, reservedCost });
  return true;
}

globalThis.add2eCastSpell = add2eCastSpell;
globalThis.cast_spell = add2eCastSpell;
