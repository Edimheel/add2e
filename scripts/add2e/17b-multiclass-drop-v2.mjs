// ADD2E — Multiclassage : route directe des drops classe/race.
// Compatible Foundry V13/V14/V15 — fenêtres via l’API commune dialog-ui.mjs uniquement.

import { classItems, classSlug, itemLabel } from "./17b-multiclass-core.mjs";
import { currentRaceOrCompatibleAlternatives, raceCompatibleForMulticlass, worldItemsByType } from "./17b-multiclass-rules.mjs";
import { showClassDropChoiceDialog } from "./17b-multiclass-dialogs.mjs";
import { addClassAsMulticlass, applyClassAsMonoclass, applyRaceForMulticlass, replaceClassInMulticlass } from "./17b-multiclass-operations.mjs";

const ADD2E_DROP_PROGRESS_VERSION = "2026-08-10-direct-class-race-router-v6";
const DROP_PROGRESS = globalThis.ADD2E_DROP_PROGRESS instanceof Map ? globalThis.ADD2E_DROP_PROGRESS : new Map();
globalThis.ADD2E_DROP_PROGRESS = DROP_PROGRESS;
globalThis.ADD2E_DROP_PROGRESS_VERSION = ADD2E_DROP_PROGRESS_VERSION;

function dropProgressKey(actor) {
  return String(actor?.uuid ?? actor?.id ?? "");
}

function dropProgressEscape(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function dropProgressRoot(context) {
  return document.querySelector?.(`[data-add2e-drop-progress="${context?.id ?? ""}"]`) ?? null;
}

function dropProgressApplication(context) {
  return dropProgressRoot(context)?.closest?.(".application, .window-app") ?? null;
}

function dropProgressCloseButton(context) {
  const application = dropProgressApplication(context);
  return application?.querySelector?.('button[data-action="add2e-progress-close"], button[value="add2e-progress-close"]') ?? null;
}

function dropProgressRender(context) {
  const root = dropProgressRoot(context);
  if (!root) return false;
  const stage = root.querySelector?.("[data-add2e-drop-current]");
  const detail = root.querySelector?.("[data-add2e-drop-detail]");
  const bar = root.querySelector?.("[data-add2e-drop-bar]");
  const list = root.querySelector?.("[data-add2e-drop-steps]");
  if (stage) stage.textContent = context.stage || "Préparation…";
  if (detail) detail.textContent = context.detail || "Le personnage sera prêt à la fin de cette opération.";
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, Number(context.progress) || 0))}%`;
  if (list) {
    list.innerHTML = context.steps.map((entry, index) => {
      const current = index === context.steps.length - 1;
      const icon = entry.failed ? "fa-circle-xmark" : (current ? "fa-hourglass-half" : "fa-circle-check");
      const color = entry.failed ? "#a7281f" : (current ? "#805514" : "#237341");
      return `<li style="display:flex;gap:7px;align-items:flex-start;color:${color};"><i class="fas ${icon}" aria-hidden="true" style="margin-top:2px;"></i><span>${dropProgressEscape(entry.label)}</span></li>`;
    }).join("");
  }
  const closeButton = dropProgressCloseButton(context);
  if (closeButton) closeButton.disabled = context.finished !== true;
  return true;
}

function dropProgressWait() {
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  return globalThis.add2eDialogWait;
}

function dropProgressOpen(actor, { className = "" } = {}) {
  const key = dropProgressKey(actor);
  if (!key) return null;
  const existing = DROP_PROGRESS.get(key);
  if (existing) return existing;

  const context = {
    id: `add2e-drop-progress-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    key,
    actor,
    dialogPromise: null,
    finished: false,
    stage: "Analyse de la classe déposée…",
    detail: className ? `${className} pour ${actor?.name ?? "personnage"}.` : `Mise à jour de ${actor?.name ?? "personnage"}.`,
    progress: 4,
    steps: [{ label: "Analyse de la classe déposée" }]
  };
  DROP_PROGRESS.set(key, context);

  try {
    context.dialogPromise = Promise.resolve(dropProgressWait()({
      add2eTheme: "parchment",
      add2ePrimaryAction: "add2e-progress-close",
      add2eClasses: ["add2e-drop-progress-window"],
      window: { title: "Mise à jour du personnage", resizable: false },
      content: `
        <section data-add2e-drop-progress="${context.id}" style="min-width:460px;padding:12px 14px;border:1px solid #6d4a1f;border-radius:9px;background:linear-gradient(180deg,#fff8e6,#ead4a2);color:#2d2011;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">
            <i class="fas fa-user-gear" aria-hidden="true" style="font-size:1.5rem;color:#805514;"></i>
            <div><strong>Mise à jour du personnage</strong><br><small>${dropProgressEscape(actor?.name ?? "Personnage")}</small></div>
          </div>
          <div data-add2e-drop-current style="font-weight:800;">Analyse de la classe déposée…</div>
          <div data-add2e-drop-detail style="margin-top:3px;font-size:.86rem;">${dropProgressEscape(context.detail)}</div>
          <div style="height:7px;margin-top:10px;overflow:hidden;border-radius:999px;background:#c9ae72;"><div data-add2e-drop-bar style="width:4%;height:100%;background:#805514;transition:width .2s ease;"></div></div>
          <ol data-add2e-drop-steps style="display:grid;gap:4px;margin:11px 0 0;padding:0;list-style:none;font-size:.85rem;"></ol>
        </section>`,
      buttons: [{
        action: "add2e-progress-close",
        label: "Fermer",
        icon: "<i class='fas fa-check'></i>",
        default: true,
        callback: () => true
      }],
      modal: false,
      rejectClose: false,
      close: () => undefined
    })).catch(error => {
      console.error("[ADD2E][MULTICLASS][DROP_PROGRESS_DIALOG]", error);
      return undefined;
    });
    setTimeout(() => dropProgressRender(context), 0);
    setTimeout(() => dropProgressRender(context), 50);
  } catch (error) {
    DROP_PROGRESS.delete(key);
    throw error;
  }
  return context;
}

function dropProgressUpdate(actor, label, { progress = null, detail = "" } = {}) {
  const context = DROP_PROGRESS.get(dropProgressKey(actor));
  if (!context) return false;
  const text = String(label ?? "").trim();
  if (text && context.steps.at(-1)?.label !== text) context.steps.push({ label: text });
  if (text) context.stage = text;
  if (Number.isFinite(Number(progress))) context.progress = Number(progress);
  if (detail) context.detail = String(detail);
  dropProgressRender(context);
  setTimeout(() => dropProgressRender(context), 0);
  return true;
}

function dropProgressActive(actor) {
  return DROP_PROGRESS.has(dropProgressKey(actor));
}

function dropProgressFinish(actor, { success = true, message = "" } = {}) {
  const key = dropProgressKey(actor);
  const context = DROP_PROGRESS.get(key);
  if (!context) return false;
  const label = success ? "Personnage prêt." : "Opération interrompue.";
  context.steps.push({ label: message || label, failed: !success });
  context.stage = message || label;
  context.detail = success
    ? "La feuille a été actualisée. Le personnage peut maintenant être utilisé."
    : "Aucune action supplémentaire n’est en cours.";
  context.progress = 100;
  context.finished = true;
  dropProgressRender(context);
  const delay = success ? 500 : 800;
  setTimeout(() => {
    const closeButton = dropProgressCloseButton(context);
    if (closeButton) {
      closeButton.disabled = false;
      closeButton.click();
    } else {
      dropProgressApplication(context)?.querySelector?.('[data-action="close"]')?.click?.();
    }
    DROP_PROGRESS.delete(key);
  }, delay);
  return true;
}

async function dropProgressRefreshSheet(sheet, actor) {
  dropProgressUpdate(actor, "Actualisation complète de la feuille…", { progress: 96 });
  const rendered = typeof sheet?._add2eNativeRender === "function"
    ? sheet._add2eNativeRender(true)
    : sheet?.render?.({ force: true });
  await Promise.resolve(rendered);
  await new Promise(resolve => setTimeout(resolve, 0));
}

async function ensureFirstClassSpells(actor) {
  const docs = classItems(actor);
  if (docs.length !== 1) return false;
  const classDoc = docs[0];
  const lists = globalThis.add2eSpellSyncClassLists?.(classDoc) ?? [];
  if (!Array.isArray(lists) || !lists.length) return false;
  const hasOwned = actor.items?.some?.(item =>
    String(item?.type ?? "").toLowerCase() === "sort"
    && (String(item?.flags?.add2e?.autoGrantedByClassId ?? "") === String(classDoc.id)
      || String(item?.flags?.add2e?.autoGrantedByClass ?? "") === String(classDoc.name))
  ) === true;
  if (hasOwned) return true;
  const sync = globalThis.add2eSyncActorSpellsFromClass;
  if (typeof sync !== "function") throw new Error("Synchroniseur automatique de sorts introuvable.");
  dropProgressUpdate(actor, `Synchronisation des sorts ${classDoc.name}…`, {
    progress: 72,
    detail: "Ajout des sorts manquants depuis le cache canonique."
  });
  await sync(actor, classDoc, {
    mode: "missing",
    showWait: false,
    forceCacheRefresh: false,
    preserveMemorization: true,
    add2eReason: "first-class-drop-spell-sync"
  });
  return true;
}

async function finalizeClassHitPoints(actor) {
  const recalculate = globalThis.add2eRecalculateHitPoints;
  if (typeof recalculate !== "function") {
    throw new Error("Le recalcul canonique ADD2E des points de vie est indisponible.");
  }
  dropProgressUpdate(actor, "Recalcul des points de vie…", {
    progress: 90,
    detail: "Recalcul du maximum puis remise des PV courants au nouveau maximum."
  });
  await recalculate(actor, { force: false, reason: "class-drop-finalize" });
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (typeof engine?.readMaximumHitPoints !== "function" || typeof engine?.setHitPoints !== "function") {
    throw new Error("Le mutateur canonique ADD2E des points de vie est indisponible.");
  }
  const maximum = Number(engine.readMaximumHitPoints(actor));
  if (!Number.isFinite(maximum) || maximum < 1) throw new Error("PV maximum canoniques invalides après changement de classe.");
  if (Number(engine.readHitPoints?.(actor)) !== maximum) {
    await engine.setHitPoints(actor, {
      current: maximum,
      reason: "class-drop-refill-to-maximum",
      updateOptions: {
        add2eMulticlassInternal: true,
        add2eClassDrop: true,
        render: false
      }
    });
  }
  return maximum;
}

export function compatibleMulticlassClassCandidates(actor, preferredClassData = null) {
  const output = [];
  const seen = new Set();
  for (const cls of [preferredClassData, ...worldItemsByType("classe")].filter(Boolean)) {
    const slug = classSlug(cls);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    if (currentRaceOrCompatibleAlternatives(actor, race => raceCompatibleForMulticlass(actor, cls, race)).length) output.push(cls);
  }
  return output.sort((left, right) => itemLabel(left, "Classe").localeCompare(itemLabel(right, "Classe"), game.i18n?.lang ?? "fr"));
}

async function applyFirstClassSafely(sheet, classData) {
  const actor = sheet?.actor;
  if (!actor || classItems(actor).length) return false;

  dropProgressUpdate(actor, "Vérification de la race et des prérequis…", { progress: 16 });
  const ensureRace = globalThis.add2eEnsureCompatibleRaceForClassDrop;
  if (typeof ensureRace !== "function") {
    throw new Error("Le service canonique ADD2E de compatibilité race/classe est indisponible.");
  }
  const raceResult = await ensureRace(actor, classData, sheet);
  if (raceResult?.handled) return raceResult.ok === true;
  if (raceResult?.ok === false) return false;

  const alignment = typeof globalThis.add2ePickClassAlignment === "function"
    ? globalThis.add2ePickClassAlignment(actor, classData.system ?? {})
    : actor.system?.alignement ?? "";
  const check = globalThis.checkClassStatMin;
  if (typeof check !== "function") {
    throw new Error("Le validateur canonique ADD2E des prérequis de classe est indisponible.");
  }
  if (!check(actor, classData, null, alignment, { silent: false, ignoreLevelMax: true })) return false;

  dropProgressUpdate(actor, "Création de la classe et recalcul du personnage…", { progress: 38 });
  const applyClass = globalThis.add2eApplyClassItemDataToActor;
  if (typeof applyClass !== "function") {
    throw new Error("Le mutateur canonique ADD2E de classe est indisponible.");
  }
  const created = await applyClass(actor, classData, sheet, {
    alignmentCandidate: alignment,
    notify: true,
    reason: "first-class-safe-drop"
  });
  if (!created) return false;
  await ensureFirstClassSpells(actor);
  return true;
}

async function runClassDropWithProgress(sheet, itemData) {
  const actor = sheet.actor;
  dropProgressOpen(actor, { className: itemLabel(itemData, "Classe") });
  let result = false;
  try {
    dropProgressUpdate(actor, "Analyse de la classe déposée…", { progress: 8 });
    const existing = classItems(actor);
    if (!existing.length) {
      result = await applyFirstClassSafely(sheet, itemData);
    } else {
      dropProgressUpdate(actor, "Choix de l’évolution du personnage…", { progress: 18, detail: "Choisis le mode mono-classe, multiclassage ou remplacement." });
      const choice = await showClassDropChoiceDialog(actor, itemData, currentRaceOrCompatibleAlternatives);
      if (choice?.action === "monoclass" && choice.option) {
        dropProgressUpdate(actor, "Passage en monoclasse et recalcul…", { progress: 36 });
        result = await applyClassAsMonoclass(actor, choice.option, sheet);
      } else if (choice?.action === "multiclass" && choice.option) {
        dropProgressUpdate(actor, "Ajout de la classe au multiclassage…", { progress: 36 });
        result = await addClassAsMulticlass(actor, choice.option, sheet);
      } else if (choice?.action === "replace-class" && choice.option) {
        dropProgressUpdate(actor, "Remplacement de la classe et recalcul…", { progress: 36 });
        result = await replaceClassInMulticlass(actor, choice.option, sheet);
      } else {
        ui.notifications.info("Drop de classe annulé.");
      }
    }

    if (!result) {
      dropProgressFinish(actor, { success: false, message: "Drop de classe annulé ou refusé." });
      return false;
    }

    await globalThis.add2eSyncClassProgressionSummary?.(actor, { reason: "class-drop-final-summary" });
    await finalizeClassHitPoints(actor);
    await dropProgressRefreshSheet(sheet, actor);
    dropProgressFinish(actor, { success: true });
    return true;
  } catch (error) {
    dropProgressFinish(actor, { success: false, message: "Échec de la mise à jour du personnage." });
    throw error;
  }
}

async function runMulticlassRaceDropWithProgress(sheet, itemData) {
  const actor = sheet.actor;
  dropProgressOpen(actor, { className: itemLabel(itemData, "Race") });
  try {
    dropProgressUpdate(actor, "Vérification de la compatibilité de race…", { progress: 20 });
    dropProgressUpdate(actor, "Application de la nouvelle race et recalcul…", { progress: 48 });
    const result = await applyRaceForMulticlass(actor, itemData, sheet);
    if (!result) {
      dropProgressFinish(actor, { success: false, message: "Changement de race annulé ou refusé." });
      return false;
    }
    await dropProgressRefreshSheet(sheet, actor);
    dropProgressFinish(actor, { success: true });
    return true;
  } catch (error) {
    dropProgressFinish(actor, { success: false, message: "Échec du changement de race." });
    throw error;
  }
}

export async function routeClassRaceDrop(sheet, itemData) {
  const actor = sheet?.actor;
  if (!actor || actor.type !== "personnage") return undefined;
  const type = String(itemData?.type ?? "").toLowerCase();
  if (!itemData || !["classe", "race"].includes(type)) return undefined;

  if (type === "classe") return runClassDropWithProgress(sheet, itemData);
  if (type === "race" && classItems(actor).length > 1) return runMulticlassRaceDropWithProgress(sheet, itemData);
  return undefined;
}

try { globalThis.add2eDropProgressBegin = dropProgressOpen; } catch (_error) {}
try { globalThis.add2eDropProgressUpdate = dropProgressUpdate; } catch (_error) {}
try { globalThis.add2eDropProgressIsActive = dropProgressActive; } catch (_error) {}
try { globalThis.add2eDropProgressFinish = dropProgressFinish; } catch (_error) {}
try { globalThis.add2eRouteClassRaceDrop = routeClassRaceDrop; } catch (_error) {}
