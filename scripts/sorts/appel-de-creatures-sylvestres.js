/**
 * ADD2E — Appel de Créatures Sylvestres
 * Clerc niveau 4 — réaction sociale canonique.
 * Compatible Foundry V13/V14/V15 — DialogV2 uniquement.
 * Contrat onUse : true = sort consommé ; false = sort non consommé.
 */

const __add2eOnUseResult = await (async () => {
  const VERSION = "2026-07-26-charisma-reaction-v2";
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("Appel de Créatures Sylvestres : DialogV2 est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eRollCharismaReactionCard !== "function") {
    ui.notifications.error("Appel de Créatures Sylvestres : le jet canonique de réaction est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications.error("Appel de Créatures Sylvestres : les cartes communes ADD2E sont indisponibles.");
    return false;
  }

  const sourceItem = (typeof sort !== "undefined" && sort)
    || (typeof item !== "undefined" && item)
    || (typeof spell !== "undefined" && spell)
    || (typeof args !== "undefined" && args?.[0]?.item)
    || null;
  const caster = (typeof actor !== "undefined" && actor)
    || sourceItem?.parent
    || null;
  if (!sourceItem || !caster) {
    ui.notifications.error("Appel de Créatures Sylvestres : lanceur ou sort introuvable.");
    return false;
  }

  const casterLevel = Math.max(1, Math.trunc(Number(
    globalThis.add2eSpellClassLevel?.(caster, { sourceItem })
      ?? Array.from(caster.items ?? []).find(entry => String(entry?.type ?? "").toLowerCase() === "classe" && /clerc/i.test(String(entry?.name ?? "")))?.system?.niveau
      ?? caster.system?.niveau
      ?? caster.system?.level
      ?? 1
  ) || 1));

  const choice = await DialogV2.wait({
    window: { title: "Lancement : Appel de Créatures Sylvestres" },
    position: { width: 440 },
    add2eTheme: "cleric",
    add2eImg: sourceItem.img || "icons/magic/nature/wolf-paw-glow-small-teal-blue.webp",
    content: `<form style="display:flex;flex-direction:column;gap:8px;">
      <div class="form-group"><label>Environnement</label><select name="environment" style="width:100%;"><option value="Bois ou forêt">Bois ou forêt</option><option value="Clairière">Clairière</option><option value="Vallon">Vallon</option><option value="Forêt ancienne">Forêt ancienne</option><option value="Lieu féerique">Lieu féerique</option><option value="Autre">Autre</option></select></div>
      <div class="form-group"><label>Créatures présentes ou appelées <small>(facultatif)</small></label><input type="text" name="creatures" placeholder="Ex. satyres, dryades, pixies"></div>
      <div class="form-group"><label>Situation ou attitude</label><input type="text" name="label" value="Disposition des créatures sylvestres"></div>
      <div class="form-group"><label>Modificateur circonstanciel</label><input type="number" name="value" value="0" step="1"></div>
      <div class="form-group"><label>Note au MD <small>(facultatif)</small></label><textarea name="note" rows="3" placeholder="Alignement, demande formulée, danger local, comportement du groupe…"></textarea></div>
      <p style="margin:0;font-size:.84em;">Les créatures ne sont pas créées par le sort. Leur réaction dépend du Charisme canonique du lanceur, des effets actifs et de la circonstance indiquée.</p>
    </form>`,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "fa-solid fa-leaf",
        default: true,
        callback: (_event, button) => ({
          environment: String(button.form?.elements?.environment?.value ?? "Bois ou forêt").trim(),
          creatures: String(button.form?.elements?.creatures?.value ?? "").trim(),
          label: String(button.form?.elements?.label?.value ?? "").trim() || "Disposition des créatures sylvestres",
          value: Number(button.form?.elements?.value?.value ?? 0) || 0,
          note: String(button.form?.elements?.note?.value ?? "").trim()
        })
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ],
    rejectClose: false
  });
  if (!choice) return false;

  const details = [
    `Appel sylvestre — ${choice.environment}`,
    choice.creatures ? `Créatures : ${choice.creatures}` : "",
    choice.note ? `Note : ${choice.note}` : ""
  ].filter(Boolean).join(" ; ");
  const circumstance = choice.value
    ? { label: `${choice.label} (${details})`, value: choice.value }
    : details
      ? { label: details, value: 0 }
      : null;

  const result = await globalThis.add2eRollCharismaReactionCard(caster, {
    source: "spell:appel-de-creatures-sylvestres",
    sourceItem,
    casterLevel,
    spellKey: "appel_de_creatures_sylvestres",
    spellName: sourceItem.name || "Appel de Créatures Sylvestres",
    environment: choice.environment,
    creatures: choice.creatures,
    note: choice.note,
    circumstance
  });

  const message = result?.message;
  if (message?.update) {
    await message.update({
      "flags.add2e.spellKey": "appel_de_creatures_sylvestres",
      "flags.add2e.spellName": sourceItem.name || "Appel de Créatures Sylvestres",
      "flags.add2e.sourceItemUuid": sourceItem.uuid,
      "flags.add2e.casterLevel": casterLevel,
      "flags.add2e.environment": choice.environment,
      "flags.add2e.creatures": choice.creatures,
      "flags.add2e.note": choice.note,
      "flags.add2e.charismaConsumerVersion": VERSION
    });
  }

  return true;
})();

return __add2eOnUseResult;
