// ADD2E — Multiclassage : route unique des drops classe/race
// ApplicationV2 / DialogV2 uniquement.

import { classItems, classSlug, cloneItemData, itemLabel } from "./17b-multiclass-core.mjs";
import { currentRaceOrCompatibleAlternatives, raceCompatibleForMulticlass, worldItemsByType } from "./17b-multiclass-rules.mjs";
import { showClassDropChoiceDialog } from "./17b-multiclass-dialogs.mjs";
import { addClassAsMulticlass, applyClassAsMonoclass, applyRaceForMulticlass, replaceClassInMulticlass } from "./17b-multiclass-operations.mjs";

const ADD2E_DROP_PROGRESS_VERSION = "2026-07-03-class-drop-spell-transaction-v2";
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
  return true;
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
    dialog: null,
    stage: "Analyse de la classe déposée…",
    detail: className ? `${className} pour ${actor?.name ?? "personnage"}.` : `Mise à jour de ${actor?.name ?? "personnage"}.`,
    progress: 4,
    steps: [{ label: "Analyse de la classe déposée" }]
  };
  DROP_PROGRESS.set(key, context);

  const DialogV2 = foundry?.applications?.api?.DialogV2 ?? null;
  if (DialogV2) {
    try {
      context.dialog = new DialogV2({
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
        // DialogV2 impose un bouton. Le pied est masqué après rendu : la fenêtre reste informative.
        buttons: [{ action: "add2e-progress-technical", label: "Fermer", callback: () => undefined }],
        modal: false,
        rejectClose: false,
        close: () => undefined
      }, { width: 530, height: "auto" });
      context.dialog.render({ force: true });
      setTimeout(() => {
        const root = dropProgressRoot(context);
        const application = root?.closest?.(".application, .window-app, .app, .dialog") ?? null;
        for (const footer of application?.querySelectorAll?.(".form-footer, .dialog-buttons, footer") ?? []) footer.style.display = "none";
        dropProgressRender(context);
      }, 0);
    } catch (_error) {
      context.dialog = null;
    }
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
  dropProgressRender(context);
  setTimeout(() => dropProgressRender(context), 0);
  DROP_PROGRESS.delete(key);
  setTimeout(() => context.dialog?.close?.({ force: true }), success ? 700 : 1000);
  return true;
}

async function dropProgressRefreshSheet(sheet, actor) {
  dropProgressUpdate(actor, "Actualisation complète de la feuille…", { progress: 94 });
  const rendered = typeof sheet?._add2eNativeRender === "function"
    ? sheet._add2eNativeRender(true)
    : sheet?.render?.({ force: true });
  await Promise.resolve(rendered);
  await new Promise(resolve => setTimeout(resolve, 0));
}

function dropSpellNorm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function dropIsAutomaticClassSpell(item) {
  if (String(item?.type ?? "").toLowerCase() !== "sort") return false;
  const flags = item?.flags?.add2e ?? {};
  return flags.autoGrantedSpellSync === true || !!flags.autoGrantedByClassId || !!flags.autoGrantedByClass;
}

function dropAutomaticSpellSourceId(item) {
  const flags = item?.flags?.add2e ?? {};
  return String(flags.autoGrantedByClassId ?? flags.sourceClassId ?? flags.sourceItemId ?? flags.classId ?? "").trim();
}

function dropAutomaticSpellSourceName(item) {
  const flags = item?.flags?.add2e ?? {};
  return dropSpellNorm(flags.autoGrantedByClass ?? flags.sourceClass ?? flags.sourceClasse ?? flags.className ?? flags.classSlug ?? "");
}

function dropGeneratedSpellBelongsToAutomaticSource(item, sourceIds, sourceNames) {
  const flags = item?.flags?.add2e ?? {};
  const family = flags.spellFamily ?? {};
  if (family.generated !== true) return false;
  const sourceId = String(family.sourceItemId ?? family.sourceId ?? "").trim();
  const sourceName = dropSpellNorm(family.sourceItemName ?? family.sourceName ?? "");
  return (sourceId && sourceIds.has(sourceId)) || (sourceName && sourceNames.has(sourceName));
}

function dropAutomaticSpellClasses(actor) {
  return classItems(actor).filter(classDoc => {
    try {
      const lists = globalThis.add2eSpellSyncClassLists?.(classDoc) ?? [];
      return Array.isArray(lists) && lists.length > 0;
    } catch (_error) {
      return false;
    }
  });
}

function dropClassSpellLevel(actor, classDoc) {
  const resolved = Number(globalThis.add2eSpellClassLevel?.(actor, classDoc));
  if (Number.isFinite(resolved) && resolved >= 1) return Math.floor(resolved);
  return Math.max(1, Number(classDoc?.system?.niveau ?? actor?.system?.niveau ?? 1) || 1);
}

function dropClassMaxSpellLevel(actor, classDoc) {
  const level = dropClassSpellLevel(actor, classDoc);
  const max = Number(globalThis.add2eSpellSyncMaxSpellLevel?.(classDoc, level));
  return Number.isFinite(max) && max > 0 ? Math.floor(max) : 0;
}

function dropClassHasAutomaticSpells(actor, classDoc) {
  const classId = String(classDoc?.id ?? "");
  const className = dropSpellNorm(classDoc?.name ?? classDoc?.system?.label ?? classDoc?.system?.slug ?? "");
  return actor?.items?.some?.(item => {
    if (!dropIsAutomaticClassSpell(item)) return false;
    const sourceId = dropAutomaticSpellSourceId(item);
    const sourceName = dropAutomaticSpellSourceName(item);
    return (classId && sourceId === classId) || (className && sourceName === className);
  }) === true;
}

async function dropDeleteLiveItems(actor, ids, reason) {
  const live = [...new Set((ids ?? []).map(id => String(id ?? "").trim()).filter(id => actor?.items?.has?.(id)))];
  if (!live.length) return 0;
  try {
    await actor.deleteEmbeddedDocuments("Item", live, {
      add2eInternal: true,
      add2eClassDropSpellTransaction: true,
      add2eReason: reason,
      render: false
    });
    return live.length;
  } catch (error) {
    if (!/does not exist/i.test(String(error?.message ?? error))) throw error;
  }

  let deleted = 0;
  for (const id of live) {
    if (!actor?.items?.has?.(id)) continue;
    try {
      await actor.deleteEmbeddedDocuments("Item", [id], {
        add2eInternal: true,
        add2eClassDropSpellTransaction: true,
        add2eReason: reason,
        render: false
      });
      deleted += 1;
    } catch (error) {
      if (!/does not exist/i.test(String(error?.message ?? error))) throw error;
    }
  }
  return deleted;
}

async function purgeAutomaticClassSpellsForDrop(actor) {
  const automatic = Array.from(actor?.items ?? []).filter(dropIsAutomaticClassSpell);
  const sourceIds = new Set(automatic.map(dropAutomaticSpellSourceId).filter(Boolean));
  const sourceNames = new Set(automatic.map(dropAutomaticSpellSourceName).filter(Boolean));
  const ids = Array.from(actor?.items ?? [])
    .filter(item => dropIsAutomaticClassSpell(item) || dropGeneratedSpellBelongsToAutomaticSource(item, sourceIds, sourceNames))
    .map(item => item.id)
    .filter(Boolean);
  return dropDeleteLiveItems(actor, ids, "class-drop-spell-transaction-purge");
}

async function rebuildAutomaticClassSpellsAfterDrop(actor) {
  const sources = dropAutomaticSpellClasses(actor);
  const sync = globalThis.add2eSyncActorSpellsFromClass;
  if (sources.length && typeof sync !== "function") throw new Error("Synchroniseur automatique de sorts introuvable.");

  let imported = 0;
  let updated = 0;
  let deleted = 0;
  let rebuiltClasses = 0;
  const details = [];

  for (let index = 0; index < sources.length; index += 1) {
    const classDoc = sources[index];
    const level = dropClassSpellLevel(actor, classDoc);
    const maxSpellLevel = dropClassMaxSpellLevel(actor, classDoc);
    if (maxSpellLevel < 1) {
      details.push(`${classDoc.name} : aucun niveau de sort disponible`);
      continue;
    }
    if (dropClassHasAutomaticSpells(actor, classDoc)) {
      details.push(`${classDoc.name} : déjà rechargé`);
      continue;
    }

    const progress = 66 + Math.round(((index + 1) / Math.max(1, sources.length)) * 20);
    dropProgressUpdate(actor, `Rechargement des sorts ${classDoc.name}…`, {
      progress,
      detail: `Compendium, familles réversibles et déduplication pour ${classDoc.name}.`
    });
    const result = await sync(actor, classDoc, {
      mode: "replace",
      actorLevel: level,
      minSpellLevel: 1,
      showWait: true,
      forceCacheRefresh: true,
      forceCacheRefreshExplicit: true,
      preserveMemorization: false,
      add2eClassDropSpellTransaction: true
    });
    imported += Math.max(0, Number(result?.imported ?? 0) || 0);
    updated += Math.max(0, Number(result?.updated ?? 0) || 0);
    deleted += Math.max(0, Number(result?.deleted ?? 0) || 0);
    rebuiltClasses += 1;
    details.push(`${classDoc.name} : ${Math.max(0, Number(result?.imported ?? 0) || 0)} sort(s) chargé(s)`);
  }

  const automaticSpellCount = Array.from(actor?.items ?? []).filter(dropIsAutomaticClassSpell).length;
  return { sources, imported, updated, deleted, rebuiltClasses, automaticSpellCount, details };
}

async function runClassSpellTransaction(actor) {
  dropProgressUpdate(actor, "Purge des sorts automatiques de la classe précédente…", {
    progress: 48,
    detail: "Les sorts fournis automatiquement par une ancienne classe sont retirés avant la mise à jour."
  });
  const purged = await purgeAutomaticClassSpellsForDrop(actor);
  await new Promise(resolve => setTimeout(resolve, 0));
  return { purged };
}

async function completeClassSpellTransaction(actor, initial = {}) {
  dropProgressUpdate(actor, "Vérification et rechargement des sorts de classe…", {
    progress: 62,
    detail: "Chaque classe de sort automatique encore présente doit posséder ses propres Items de sort."
  });
  const rebuilt = await rebuildAutomaticClassSpellsAfterDrop(actor);
  dropProgressUpdate(actor, "Sorts de classe vérifiés…", {
    progress: 90,
    detail: rebuilt.sources.length
      ? `${rebuilt.automaticSpellCount} sort(s) automatique(s) présents. ${rebuilt.details.join(" · ")}`
      : "Aucune classe à sort automatique restante."
  });
  return { ...initial, ...rebuilt };
}

try { globalThis.add2eDropProgressBegin = dropProgressOpen; } catch (_error) {}
try { globalThis.add2eDropProgressUpdate = dropProgressUpdate; } catch (_error) {}
try { globalThis.add2eDropProgressIsActive = dropProgressActive; } catch (_error) {}
try { globalThis.add2eDropProgressFinish = dropProgressFinish; } catch (_error) {}

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

async function resolveDroppedItemData(event, data = null) {
  const editor = foundry?.applications?.ux?.TextEditor?.implementation;
  const raw = data ?? editor?.getDragEventData?.(event) ?? null;
  if (!raw) return null;
  if (raw.system && ["classe", "race"].includes(raw.type)) return cloneItemData(raw);
  if (raw.data?.system && ["classe", "race"].includes(raw.data.type)) return cloneItemData(raw.data);
  if (raw.uuid) {
    const doc = await fromUuid(raw.uuid).catch(() => null);
    if (doc instanceof Item) return cloneItemData(doc);
  }
  if (raw.pack && (raw.id || raw._id)) {
    const pack = game.packs.get(raw.pack);
    const doc = pack ? await pack.getDocument(raw.id ?? raw._id).catch(() => null) : null;
    if (doc instanceof Item) return cloneItemData(doc);
  }
  return null;
}

async function applyFirstClassSafely(sheet, classData) {
  const actor = sheet?.actor;
  if (!actor || classItems(actor).length) return false;

  dropProgressUpdate(actor, "Vérification de la race et des prérequis…", { progress: 16 });
  const raceResult = await globalThis.add2eEnsureCompatibleRaceForClassDrop?.(actor, classData, sheet);
  if (raceResult?.handled) return raceResult.ok === true;
  if (raceResult?.ok === false) return false;

  const alignment = typeof globalThis.add2ePickClassAlignment === "function"
    ? globalThis.add2ePickClassAlignment(actor, classData.system ?? {})
    : actor.system?.alignement ?? "";
  const valid = typeof globalThis.checkClassStatMin === "function"
    ? globalThis.checkClassStatMin(actor, classData, null, alignment, { silent: false, ignoreLevelMax: true })
    : true;
  if (!valid) return false;

  dropProgressUpdate(actor, "Création de la classe et recalcul du personnage…", { progress: 38 });
  const created = await globalThis.add2eApplyClassItemDataToActor?.(actor, classData, sheet, {
    alignmentCandidate: alignment,
    notify: true,
    reason: "first-class-safe-drop"
  });
  return !!created;
}

async function runClassDropWithProgress(sheet, itemData) {
  const actor = sheet.actor;
  dropProgressOpen(actor, { className: itemLabel(itemData, "Classe") });
  let result = false;
  try {
    dropProgressUpdate(actor, "Analyse de la classe déposée…", { progress: 8 });
    const preTransaction = await runClassSpellTransaction(actor);
    const existing = classItems(actor);
    if (!existing.length) {
      result = await applyFirstClassSafely(sheet, itemData);
    } else {
      dropProgressUpdate(actor, "Choix de l’évolution du personnage…", { progress: 18, detail: "Choisis le mode mono-classe, multiclassage ou remplacement." });
      const choice = await showClassDropChoiceDialog(actor, itemData, currentRaceOrCompatibleAlternatives);
      if (choice?.action === "monoclass" && choice.option) {
        dropProgressUpdate(actor, "Retour en monoclassage : purge et recalcul…", { progress: 36 });
        result = await applyClassAsMonoclass(actor, choice.option, sheet);
      } else if (choice?.action === "multiclass" && choice.option) {
        dropProgressUpdate(actor, "Ajout de la classe au multiclassage…", { progress: 36 });
        result = await addClassAsMulticlass(actor, choice.option, sheet);
      } else if (choice?.action === "replace-class" && choice.option) {
        dropProgressUpdate(actor, "Remplacement de la classe : purge et recalcul…", { progress: 36 });
        result = await replaceClassInMulticlass(actor, choice.option, sheet);
      } else {
        ui.notifications.info("Drop de classe annulé.");
      }
    }

    if (!result) {
      dropProgressFinish(actor, { success: false, message: "Drop de classe annulé ou refusé." });
      return false;
    }

    await completeClassSpellTransaction(actor, preTransaction);
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

export function installDropWrapper() {
  const SheetClass = globalThis.Add2eActorSheet;
  if (!SheetClass?.prototype?._onDrop) return false;
  if (SheetClass.prototype._add2eMulticlassWrapped === "item-progression-v3-drop-progress") return true;
  const original = SheetClass.prototype._onDrop;
  SheetClass.prototype._onDrop = async function add2eMulticlassDropWrapped(event, data = null) {
    const actor = this.actor;
    if (!actor || actor.type !== "personnage") return original.call(this, event, data);
    const itemData = await resolveDroppedItemData(event, data);
    if (!itemData || !["classe", "race"].includes(itemData.type)) return original.call(this, event, data);

    if (itemData.type === "classe") {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return runClassDropWithProgress(this, itemData);
    }

    if (itemData.type === "race" && classItems(actor).length > 1) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return runMulticlassRaceDropWithProgress(this, itemData);
    }
    return original.call(this, event, data);
  };
  SheetClass.prototype._add2eMulticlassWrapped = "item-progression-v3-drop-progress";
  return true;
}

export function installDropWrapperDeferred() {
  setTimeout(() => {
    if (!installDropWrapper()) {
      setTimeout(installDropWrapper, 500);
      setTimeout(installDropWrapper, 1500);
    }
  }, 0);
}
