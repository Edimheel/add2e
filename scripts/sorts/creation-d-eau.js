/**
 * ADD2E — Création d’eau / Destruction d’eau
 * Compatible Foundry V13/V14/V15.
 * Version : 2026-08-07-canonical-resource-v2
 */

const __add2eOnUseResult = await (async () => {
  if (typeof globalThis.add2eDialogWait !== "function") {
    ui.notifications?.error?.("Création d’eau : l’API de fenêtre ADD2E est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications?.error?.("Création d’eau : les constructeurs de cartes ADD2E sont indisponibles.");
    return false;
  }

  const norm = value => String(value ?? "")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "_").replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_").replace(/^_+|_+$/g, "");

  function resourceEngine() {
    const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
    if (!engine || typeof engine.recoverResource !== "function") {
      throw new Error("Le domaine canonique ADD2E resource n’est pas disponible pour Création d’eau.");
    }
    return engine;
  }

  const sourceItem = (typeof sort !== "undefined" && sort)
    ?? (typeof item !== "undefined" && item)
    ?? (typeof args !== "undefined" && args?.[0]?.item)
    ?? null;
  const caster = (typeof actor !== "undefined" && actor) ?? sourceItem?.parent ?? null;
  if (!sourceItem || !caster) {
    ui.notifications?.error?.("Création d’eau : sort ou lanceur introuvable.");
    return false;
  }

  const reversible = sourceItem.flags?.add2e?.reversibleActorEntry ?? sourceItem.system?.reversibleActorEntry ?? {};
  const entryMode = norm(typeof reversible === "object" ? reversible.mode : reversible);
  const sourceName = norm(sourceItem.name ?? sourceItem.system?.nom);
  const mode = ["inverse", "inversee", "invers", "reversed"].includes(entryMode)
    || /(?:destruction|detruction).*eau/.test(sourceName)
    ? "destroy"
    : "create";
  const modeLabel = mode === "destroy" ? "Destruction d’eau" : "Création d’eau";

  const level = Math.max(1, Number(caster.system?.niveau) || 1);
  const maxLitres = level * 15;
  const maxOutres = Math.max(1, Math.floor(maxLitres / 5));
  const dialogResult = await globalThis.add2eDialogWait({
    add2eTheme: "parchment",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-creation-eau-dialog"],
    window: { title: `Lancement : ${modeLabel}` },
    content: `<form class="add2e-creation-eau-form" style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">
      <div class="form-group"><label style="font-weight:bold;">Effet :</label><div style="padding:6px 0;">${modeLabel}</div></div>
      <div class="form-group"><label style="font-weight:bold;">Nombre d’outres de 5 L :</label><input type="number" name="nbOutres" value="${maxOutres}" min="1" max="${maxOutres}" step="1" style="width:100%;"><p style="margin:3px 0 0;color:#666;font-size:.85em;">Maximum : ${maxOutres} outre(s), soit ${maxLitres} L au niveau ${level}.</p></div>
    </form>`,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "<i class='fas fa-droplet'></i>",
        default: true,
        callback: (_event, button) => ({ nbOutres: Number(button.form.elements.nbOutres?.value || 0) })
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "<i class='fas fa-times'></i>",
        callback: () => null
      }
    ],
    close: () => null
  });
  if (!dialogResult) return false;

  const nbOutres = Math.floor(Number(dialogResult.nbOutres) || 0);
  const litres = nbOutres * 5;
  if (!Number.isFinite(nbOutres) || nbOutres <= 0 || nbOutres > maxOutres || litres > maxLitres) {
    ui.notifications?.warn?.(`Création d’eau : quantité invalide (maximum ${maxLitres} L).`);
    return false;
  }

  let itemCreated = null;
  let itemUpdated = null;
  if (mode === "create") {
    const itemName = "Outre d’eau (5 L)";
    const existing = caster.items?.find(entry => entry.type === "objet" && norm(entry.name) === norm(itemName)) ?? null;
    try {
      if (existing) {
        const resource = {
          id: `${existing.uuid ?? existing.id}:water-skin-stack`,
          type: "generated-consumable",
          label: existing.name,
          document: existing,
          actor: caster,
          item: existing,
          target: "quantity",
          get current() {
            return Math.max(0, Number(existing.system?.quantite ?? existing.system?.quantity ?? 0) || 0);
          },
          maximum: null,
          recovery: nbOutres,
          source: {
            kind: "spell",
            id: String(sourceItem.id ?? ""),
            uuid: String(sourceItem.uuid ?? ""),
            name: String(sourceItem.name ?? "Création d’eau")
          },
          context: {
            consumer: "creation-d-eau",
            casterId: String(caster.id ?? ""),
            volumeUnitLitres: 5
          },
          write: next => existing.update({
            "system.quantite": next,
            "system.volume_litres": next * 5,
            "system.description": `Outres contenant de l’eau claire et potable créée par Création d’eau. Quantité : ${next} outre(s) de 5 L, soit ${next * 5} L.`
          }, {
            add2eInternal: true,
            add2eReason: "create-water-resource-recovery",
            render: false
          })
        };
        const recovered = await resourceEngine().recoverResource(resource, {
          amount: nbOutres,
          reason: "create-water",
          consumer: "creation-d-eau"
        });
        if (!recovered.ok) throw new Error("La pile d’outres n’a pas pu être augmentée.");
        itemUpdated = existing;
      } else {
        const created = await caster.createEmbeddedDocuments("Item", [{
          name: itemName,
          type: "objet",
          img: "icons/consumables/drinks/water-jug-blue.webp",
          system: {
            nom: itemName,
            description: `Outres contenant de l’eau claire et potable créée par Création d’eau. Quantité : ${nbOutres} outre(s) de 5 L, soit ${litres} L.`,
            quantite: nbOutres,
            unite: "outre",
            volume_litres: litres,
            poids: 0,
            valeur: 0,
            equipee: false,
            tags: ["sort:creation-d-eau", "objet:outre_eau", "eau:potable", "volume_unitaire_litres:5"]
          },
          flags: { add2e: { createdBySpell: "Création d’eau", spellUuid: sourceItem.uuid ?? null, casterUuid: caster.uuid ?? null, volumeUnitaireLitres: 5, quantityAdded: nbOutres, litresAdded: litres, createdAt: Date.now() } }
        }]);
        itemCreated = created?.[0] ?? null;
      }
    } catch (error) {
      console.error("[ADD2E][CREATION_D_EAU][OBJECT_FAILED]", error);
      ui.notifications?.error?.("Création d’eau : impossible de créer ou de mettre à jour les outres.");
      return false;
    }
    if (!itemCreated && !itemUpdated) return false;
  }

  const casterToken = canvas.tokens?.controlled?.[0] ?? caster.getActiveTokens?.()[0] ?? null;
  try {
    await globalThis.ADD2E_PLAY_SPELL_FX?.(mode === "destroy" ? "destruction_eau" : "aquagenese", {
      casterToken: casterToken ?? caster,
      jb2aOptions: { maxFiles: 1, scaleToObject: 1.25, opacity: 0.85 }
    });
  } catch (error) {
    console.warn("[ADD2E][CREATION_D_EAU][VFX][IGNORED]", error);
  }

  const itemLine = itemCreated
    ? `Équipement créé : ${itemCreated.name} × ${nbOutres}.`
    : itemUpdated
      ? `Équipement mis à jour : ${itemUpdated.name} +${nbOutres}.`
      : "Aucun équipement créé.";
  const card = {
    actor: caster,
    title: modeLabel,
    icon: "fas fa-droplet",
    variant: "spell",
    source: {
      name: caster.name,
      img: caster.img ?? sourceItem.img ?? "icons/svg/mystery-man.svg",
      type: "Sort divin"
    },
    rows: [
      { label: "Quantité", value: `${litres} L (${nbOutres} outre(s))` },
      { label: "Maximum", value: `${maxLitres} L` },
      { label: "Inventaire", value: itemLine }
    ],
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster })
    }
  };
  globalThis.add2eBuildChatCard(card);
  await globalThis.add2eCreateChatCard(card);

  console.log("[ADD2E][creation-d-eau.js][ONUSE_RESULT]", { mode, nbOutres, litres });
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT]", { script: "creation-d-eau.js", result: __add2eOnUseResult });
  ui.notifications?.error?.("Création d’eau : le script onUse n’a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
