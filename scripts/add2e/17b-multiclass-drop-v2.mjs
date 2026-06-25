// ADD2E — Multiclassage : route unique des drops classe/race
// ApplicationV2 / DialogV2 uniquement.

import { classItems, classSlug, cloneItemData, itemLabel } from "./17b-multiclass-core.mjs";
import { currentRaceOrCompatibleAlternatives, raceCompatibleForMulticlass, worldItemsByType } from "./17b-multiclass-rules.mjs";
import { showClassDropChoiceDialog } from "./17b-multiclass-dialogs.mjs";
import { addClassAsMulticlass, applyClassAsMonoclass, applyRaceForMulticlass, replaceClassInMulticlass } from "./17b-multiclass-operations.mjs";

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

  // Le wrapper race/classe existant choisit une race compatible avec DialogV2
  // lorsqu'elle est nécessaire. Cette route retourne alors déjà la classe créée.
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

  const created = await globalThis.add2eApplyClassItemDataToActor?.(actor, classData, sheet, {
    alignmentCandidate: alignment,
    notify: true,
    reason: "first-class-safe-drop"
  });
  return !!created;
}

export function installDropWrapper() {
  const SheetClass = globalThis.Add2eActorSheet;
  if (!SheetClass?.prototype?._onDrop) return false;
  if (SheetClass.prototype._add2eMulticlassWrapped === "item-progression-v2") return true;
  const original = SheetClass.prototype._onDrop;
  SheetClass.prototype._onDrop = async function add2eMulticlassDropWrapped(event, data = null) {
    const actor = this.actor;
    if (!actor || actor.type !== "personnage") return original.call(this, event, data);
    const itemData = await resolveDroppedItemData(event, data);
    if (!itemData || !["classe", "race"].includes(itemData.type)) return original.call(this, event, data);

    if (itemData.type === "classe") {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const existing = classItems(actor);
      if (!existing.length) return applyFirstClassSafely(this, itemData);

      const choice = await showClassDropChoiceDialog(actor, itemData, currentRaceOrCompatibleAlternatives);
      if (choice?.action === "monoclass" && choice.option) return applyClassAsMonoclass(actor, choice.option, this);
      if (choice?.action === "multiclass" && choice.option) return addClassAsMulticlass(actor, choice.option, this);
      if (choice?.action === "replace-class" && choice.option) return replaceClassInMulticlass(actor, choice.option, this);
      ui.notifications.info("Drop de classe annulé.");
      return false;
    }

    if (itemData.type === "race" && classItems(actor).length > 1) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return applyRaceForMulticlass(actor, itemData, this);
    }
    return original.call(this, event, data);
  };
  SheetClass.prototype._add2eMulticlassWrapped = "item-progression-v2";
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