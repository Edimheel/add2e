/**
 * ADD2E — Création d’eau / Destruction d’eau
 * Compatible Foundry V13/V14/V15 — DialogV2 uniquement.
 */

const __add2eOnUseResult = await (async () => {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications?.error?.("Création d’eau : DialogV2 introuvable.");
    return false;
  }

  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
  const norm = value => String(value ?? "")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "_").replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  const chatStyle = () => CONST.CHAT_MESSAGE_STYLES
    ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
    : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };

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
  const dialogResult = await DialogV2.wait({
    window: { title: `Lancement : ${modeLabel}` },
    add2eTheme: "cleric",
    add2eImg: sourceItem.img || "icons/magic/water/orb-water-blue.webp",
    content: `<form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">
      <div class="form-group"><label style="font-weight:bold;">Effet :</label><div style="padding:6px 0;">${esc(modeLabel)}</div></div>
      <div class="form-group"><label style="font-weight:bold;">Nombre d’outres de 5 L :</label><input type="number" name="nbOutres" value="${maxOutres}" min="1" max="${maxOutres}" step="1" style="width:100%;"><p style="margin:3px 0 0;color:#666;font-size:.85em;">Maximum : ${maxOutres} outre(s), soit ${maxLitres} L au niveau ${level}.</p></div>
    </form>`,
    buttons: [
      { action: "cast", label: "Lancer", icon: "fa-solid fa-droplet", default: true, callback: (_event, button) => ({ nbOutres: Number(button.form.elements.nbOutres?.value || 0) }) },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
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
        const next = Math.max(0, Number(existing.system?.quantite) || 0) + nbOutres;
        await existing.update({
          "system.quantite": next,
          "system.volume_litres": next * 5,
          "system.description": `Outres contenant de l’eau claire et potable créée par Création d’eau. Quantité : ${next} outre(s) de 5 L, soit ${next * 5} L.`
        });
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
    ? `Équipement créé : <b>${esc(itemCreated.name)}</b> × ${nbOutres}.`
    : itemUpdated
      ? `Équipement mis à jour : <b>${esc(itemUpdated.name)}</b> +${nbOutres}.`
      : "Aucun équipement créé.";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<div class="add2e-spell-card add2e-spell-card-clerc" style="border:1px solid #e2bc63;border-radius:8px;overflow:hidden;background:#fffaf0;"><div style="padding:8px 10px;background:#6f4b12;color:#fff;font-weight:bold;display:flex;gap:8px;align-items:center;"><img src="${esc(sourceItem.img || "icons/magic/water/orb-water-blue.webp")}" style="width:28px;height:28px;border-radius:4px;"><span>${esc(caster.name)} — ${esc(modeLabel)}</span></div><div style="padding:9px;color:#6f4b12;"><div><b>Quantité :</b> ${litres} L (${nbOutres} outre(s)).</div><div><b>Maximum :</b> ${maxLitres} L.</div><div style="margin-top:5px;">${itemLine}</div></div></div>`,
    ...chatStyle()
  });

  console.log("[ADD2E][creation-d-eau.js][ONUSE_RESULT]", { mode, nbOutres, litres });
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT]", { script: "creation-d-eau.js", result: __add2eOnUseResult });
  ui.notifications?.error?.("Création d’eau : le script onUse n’a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;