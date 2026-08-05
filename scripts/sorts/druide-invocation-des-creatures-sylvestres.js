/**
 * ADD2E — Invocation des créatures sylvestres
 * Druide niveau 4 — disposition favorable et réaction canonique à la loyauté.
 * Compatible Foundry V13/V14/V15 — DialogV2 uniquement.
 * Contrat onUse : true = sort consommé ; false = sort non consommé.
 */

const __add2eOnUseResult = await (async () => {
  const VERSION = "2026-08-05-canonical-sylvan-loyalty-v2";
  const sourceItem = (typeof sort !== "undefined" && sort)
    || (typeof item !== "undefined" && item)
    || (typeof spell !== "undefined" && spell)
    || (typeof args !== "undefined" && args?.[0]?.item)
    || null;
  const caster = (typeof actor !== "undefined" && actor)
    || sourceItem?.parent
    || null;
  const DialogV2 = foundry.applications?.api?.DialogV2;

  if (!sourceItem || !caster) {
    ui.notifications.error("Invocation des créatures sylvestres : lanceur ou sort introuvable.");
    return false;
  }
  if (!DialogV2?.wait) {
    ui.notifications.error("Invocation des créatures sylvestres : DialogV2 est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications.error("Invocation des créatures sylvestres : les cartes communes ADD2E sont indisponibles.");
    return false;
  }
  if (typeof globalThis.add2eRollCharismaLoyaltyCard !== "function") {
    ui.notifications.error("Invocation des créatures sylvestres : le résolveur canonique de loyauté est indisponible.");
    return false;
  }

  const escape = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const choice = await DialogV2.wait({
    window: { title: `Lancement : ${sourceItem.name}` },
    position: { width: 480 },
    content: `<form style="display:flex;flex-direction:column;gap:8px;">
      <div class="form-group"><label>Environnement extérieur</label><input type="text" name="environment" value="Forêt ou région sauvage"></div>
      <div class="form-group"><label>Créatures présentes ou appelées</label><input type="text" name="creatures" placeholder="Ex. dryades, pixies, satyres"></div>
      <label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" name="fight"> Leur demander de combattre</label>
      <div class="form-group"><label>Relations et circonstances</label><input type="text" name="label" value="Rapports avec les créatures invoquées"></div>
      <div class="form-group"><label>Modificateur de loyauté</label><input type="number" name="value" value="0" step="1"></div>
      <div class="form-group"><label>Note au MD</label><textarea name="note" rows="3" placeholder="Alignement mauvais dans le groupe, danger, demande formulée…"></textarea></div>
      <p style="margin:0;font-size:.84em;">Les créatures sont favorablement disposées. Un jet de loyauté est effectué uniquement si elles sont sollicitées pour combattre.</p>
    </form>`,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "fa-solid fa-leaf",
        default: true,
        callback: (_event, button) => ({
          environment: String(button.form?.elements?.environment?.value ?? "").trim() || "Extérieur",
          creatures: String(button.form?.elements?.creatures?.value ?? "").trim(),
          fight: button.form?.elements?.fight?.checked === true,
          label: String(button.form?.elements?.label?.value ?? "").trim() || "Rapports avec les créatures invoquées",
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

  const subjectLabel = [
    choice.creatures || "Créatures sylvestres invoquées",
    choice.environment
  ].filter(Boolean).join(" — ");

  if (choice.fight) {
    const situation = typeof globalThis.add2eLoyaltySituation === "function"
      ? globalThis.add2eLoyaltySituation({
        key: "dangerous_order",
        label: "Demande de combattre",
        consequence: "Refus"
      })
      : { key: "dangerous_order", label: "Demande de combattre", consequence: "Refus" };
    const result = await globalThis.add2eRollCharismaLoyaltyCard(caster, {
      title: `${sourceItem.name} — réaction à la loyauté`,
      source: "spell:invocation-des-creatures-sylvestres",
      sourceItem,
      spellKey: "invocation_des_creatures_sylvestres",
      spellName: sourceItem.name,
      subjectLabel,
      situation,
      circumstance: choice.value ? { label: choice.label, value: choice.value } : null,
      environment: choice.environment,
      creatures: choice.creatures,
      note: choice.note
    });

    if (result?.message?.update) {
      await result.message.update({
        "flags.add2e.spellKey": "invocation_des_creatures_sylvestres",
        "flags.add2e.spellName": sourceItem.name,
        "flags.add2e.sourceItemUuid": sourceItem.uuid,
        "flags.add2e.environment": choice.environment,
        "flags.add2e.creatures": choice.creatures,
        "flags.add2e.note": choice.note,
        "flags.add2e.requestedCombat": true,
        "flags.add2e.sylvanLoyaltyVersion": VERSION
      });
    }
    return true;
  }

  const card = {
    actor: caster,
    title: sourceItem.name,
    icon: "fas fa-leaf",
    variant: "success",
    source: {
      name: caster.name,
      img: caster.img,
      type: "Invocation druidique"
    },
    rows: [
      { label: "Environnement", value: choice.environment },
      { label: "Créatures", value: choice.creatures || "Déterminées par le MD selon la région" },
      { label: "Disposition", value: "Favorablement disposées envers le druide" },
      { label: "Demande de combattre", value: "Non" },
      { label: "Sauvegardes et présence", value: "À résoudre selon les conditions décrites par le sort" },
      choice.note ? { label: "Note au MD", value: escape(choice.note) } : null
    ].filter(Boolean),
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      flags: {
        add2e: {
          chatCardType: "spell-sylvan-creatures-invocation",
          spellKey: "invocation_des_creatures_sylvestres",
          spellName: sourceItem.name,
          sourceItemUuid: sourceItem.uuid,
          environment: choice.environment,
          creatures: choice.creatures,
          note: choice.note,
          requestedCombat: false,
          sylvanLoyaltyVersion: VERSION
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(card);
  await globalThis.add2eCreateChatCard(card);
  return true;
})();

return __add2eOnUseResult;
