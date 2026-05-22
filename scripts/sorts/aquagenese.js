/**
 * ADD2E — Sort AQUAGENÈSE
 * Foundry V13/V14
 * Version : 2026-05-22-v2-chat-style-v13-v14
 */

console.log("%c[ADD2E][AQUAGENESE] SCRIPT CUSTOM CLERC v2", "color:#b88924;font-weight:bold;");

const __add2eOnUseResult = await (async () => {
  const DialogV2 = foundry.applications?.api?.DialogV2;

  if (!DialogV2) {
    ui.notifications.error("Aquagenèse : DialogV2 est introuvable. Ce script nécessite Foundry V13/V14.");
    return false;
  }

  const ADD2E_CLERIC_CHAT = {
    main: "#b88924",
    dark: "#6f4b12",
    pale: "#fff7df",
    pale2: "#fffaf0",
    border: "#e2bc63",
    borderDark: "#8a611d",
    success: "#2f8f46",
    warning: "#b88924",
    fail: "#b33a2e",
    muted: "#6b5a35"
  };

  function chatStyleData() {
    return CONST.CHAT_MESSAGE_STYLES
      ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
      : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
  }

  function add2eEscapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function add2eSpellImg(src, fallback = "icons/magic/water/orb-water-blue.webp") {
    return add2eEscapeHtml(src || fallback);
  }

  function add2eFormatLitres(value) {
    const n = Number(value) || 0;
    if (Number.isInteger(n)) return `${n} L`;
    return `${Math.round(n * 10) / 10} L`;
  }

  function add2eClercCard({ caster, sourceItem, mode, nbOutres, litres, maxLitres, itemCreated, itemUpdated }) {
    const casterName = add2eEscapeHtml(caster?.name ?? "Lanceur");
    const spellName = add2eEscapeHtml(sourceItem?.name ?? "Aquagenèse");
    const modeLabel = mode === "destroy" ? "Destruction d’eau" : "Création d’eau";
    const modeColor = mode === "destroy" ? ADD2E_CLERIC_CHAT.warning : ADD2E_CLERIC_CHAT.success;
    const litresTxt = add2eEscapeHtml(add2eFormatLitres(litres));
    const maxTxt = add2eEscapeHtml(add2eFormatLitres(maxLitres));

    let itemHtml = "";
    if (itemCreated) {
      itemHtml = `<div style="margin-top:6px;color:${ADD2E_CLERIC_CHAT.dark};">Équipement créé : <b>${add2eEscapeHtml(itemCreated.name)}</b> × ${nbOutres}</div>`;
    } else if (itemUpdated) {
      itemHtml = `<div style="margin-top:6px;color:${ADD2E_CLERIC_CHAT.dark};">Équipement mis à jour : <b>${add2eEscapeHtml(itemUpdated.name)}</b> +${nbOutres}</div>`;
    }

    return `
      <div class="add2e-spell-card add2e-spell-card-clerc add2e-spell-card-aquagenese" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,${ADD2E_CLERIC_CHAT.pale2} 0%,${ADD2E_CLERIC_CHAT.pale} 100%);border:1.5px solid ${ADD2E_CLERIC_CHAT.border};overflow:hidden;padding:0;font-family:var(--font-primary);">
        <div style="background:linear-gradient(90deg,${ADD2E_CLERIC_CHAT.dark} 0%,${ADD2E_CLERIC_CHAT.main} 100%);padding:8px 12px;color:white;display:flex;align-items:center;gap:10px;border-bottom:2px solid ${ADD2E_CLERIC_CHAT.borderDark};">
          <img src="${add2eSpellImg(caster?.img, "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
          <div style="line-height:1.2;flex:1;">
            <div style="font-weight:bold;font-size:1.05em;">${casterName}</div>
            <div style="font-size:0.85em;opacity:0.95;">lance <b>${spellName}</b></div>
          </div>
          <img src="${add2eSpellImg(sourceItem?.img)}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
        </div>
        <div style="padding:10px;">
          <div style="border:1px solid ${ADD2E_CLERIC_CHAT.border};background:#ffffff;border-radius:6px;padding:8px;text-align:center;">
            <div style="font-weight:bold;color:${modeColor};font-size:1.08em;">${modeLabel}</div>
            <div style="margin-top:5px;color:${ADD2E_CLERIC_CHAT.dark};">Outres concernées : <b>${nbOutres}</b> × 5 L</div>
            <div style="margin-top:3px;color:${ADD2E_CLERIC_CHAT.dark};">Quantité totale : <b>${litresTxt}</b></div>
            <div style="margin-top:3px;color:${ADD2E_CLERIC_CHAT.muted};font-size:0.9em;">Maximum autorisé : ${maxTxt}, soit 15 L × niveau du clerc.</div>
            ${itemHtml}
          </div>
          <details style="margin-top:8px;background:white;border:1px solid ${ADD2E_CLERIC_CHAT.border};border-radius:6px;">
            <summary style="cursor:pointer;color:${ADD2E_CLERIC_CHAT.dark};font-weight:600;padding:6px;">Règle appliquée</summary>
            <div style="padding:8px;font-size:0.85em;line-height:1.45;color:${ADD2E_CLERIC_CHAT.dark};">
              <div><b>Aquagenèse</b> — Clerc niveau 1, altération.</div>
              <div>Portée : 9 m ; durée : permanente ; jet de protection : aucun.</div>
              <div>Effet automatisé : crée de l’eau claire et potable à raison de <b>15 litres par niveau du clerc</b>.</div>
              <div>Restriction : l’effet ne peut pas être produit à l’intérieur d’un être vivant.</div>
              <div>Inverse : destruction d’eau, même quantité.</div>
            </div>
          </details>
        </div>
      </div>`;
  }

  let sourceItem = null;
  if (typeof sort !== "undefined" && sort) sourceItem = sort;
  else if (typeof item !== "undefined" && item) sourceItem = item;
  else if (typeof this !== "undefined" && this?.documentName === "Item") sourceItem = this;
  else if (typeof args !== "undefined" && args?.[0]?.item) sourceItem = args[0].item;

  if (!sourceItem) { ui.notifications.error("Aquagenèse : sort introuvable."); return false; }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) { ui.notifications.error("Aquagenèse : lanceur introuvable."); return false; }

  const casterToken = canvas.tokens?.controlled?.[0]
    ?? ((typeof token !== "undefined" && token) ? token : null)
    ?? caster.getActiveTokens?.()[0]
    ?? null;

  const niveau = Math.max(1, Number(caster.system?.niveau) || 1);
  const maxLitres = niveau * 15;
  const maxOutres = Math.max(1, Math.floor(maxLitres / 5));

  const dialogContent = `
    <form class="add2e-aquagenese-form" style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">
      <div class="form-group"><label style="font-weight:bold;">Effet :</label><select name="mode" style="width:100%;"><option value="create">Créer de l’eau claire et potable</option><option value="destroy">Inverse : détruire de l’eau</option></select></div>
      <div class="form-group"><label style="font-weight:bold;">Nombre d’outres de 5 L :</label><input type="number" name="nbOutres" value="${maxOutres}" min="1" max="${maxOutres}" step="1" style="width:100%;"><p style="margin:3px 0 0 0;color:#666;font-size:0.85em;">Maximum : ${maxOutres} outre(s), soit ${maxLitres} L au niveau ${niveau}.</p></div>
    </form>`;

  const dialogResult = await DialogV2.wait({
    window: { title: "Lancement : Aquagenèse" },
    add2eTheme: "cleric",
    add2eImg: sourceItem.img || "icons/magic/water/orb-water-blue.webp",
    content: dialogContent,
    buttons: [
      { action: "cast", label: "Lancer", icon: "fa-solid fa-droplet", default: true, callback: (event, button) => ({ mode: String(button.form.elements.mode?.value || "create"), nbOutres: Number(button.form.elements.nbOutres?.value || 0) }) },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });

  if (!dialogResult) return false;

  const mode = dialogResult.mode === "destroy" ? "destroy" : "create";
  const nbOutres = Math.floor(Number(dialogResult.nbOutres) || 0);
  const litres = nbOutres * 5;

  if (!Number.isFinite(nbOutres) || nbOutres <= 0) { ui.notifications.warn("Aquagenèse : nombre d’outres invalide."); return false; }
  if (nbOutres > maxOutres || litres > maxLitres) { ui.notifications.warn(`Aquagenèse : quantité maximale dépassée (${maxOutres} outre(s), ${maxLitres} L au niveau ${niveau}).`); return false; }

  let itemCreated = null;
  let itemUpdated = null;

  if (mode === "create") {
    const itemName = "Outre d’eau (5 L)";
    const existing = caster.items?.find(i => i.type === "objet" && String(i.name || "").toLowerCase() === itemName.toLowerCase());
    try {
      if (existing) {
        const currentQty = Number(existing.system?.quantite) || 0;
        const newQty = currentQty + nbOutres;
        await existing.update({
          "system.quantite": newQty,
          "system.volume_litres": newQty * 5,
          "system.description": `Outres contenant de l’eau claire et potable créée par Aquagenèse. Quantité : ${newQty} outre(s) de 5 L, soit ${add2eFormatLitres(newQty * 5)}.`
        });
        itemUpdated = existing;
      } else {
        const created = await caster.createEmbeddedDocuments("Item", [{
          name: itemName,
          type: "objet",
          img: "icons/consumables/drinks/water-jug-blue.webp",
          system: {
            nom: itemName,
            description: `Outres contenant de l’eau claire et potable créée par Aquagenèse. Quantité : ${nbOutres} outre(s) de 5 L, soit ${add2eFormatLitres(litres)}.`,
            quantite: nbOutres,
            unite: "outre",
            volume_litres: litres,
            poids: 0,
            valeur: 0,
            equipee: false,
            tags: ["sort:aquagenese", "objet:outre_eau", "eau:potable", "volume_unitaire_litres:5"]
          },
          flags: { add2e: { createdBySpell: "Aquagenèse", spellUuid: sourceItem.uuid ?? null, casterUuid: caster.uuid ?? null, volumeUnitaireLitres: 5, quantityAdded: nbOutres, litresAdded: litres, createdAt: Date.now() } }
        }]);
        itemCreated = created?.[0] ?? null;
      }
    } catch (e) {
      console.error("[ADD2E][AQUAGENESE] Échec création / mise à jour de l’objet Outre d’eau.", e);
      ui.notifications.error("Aquagenèse : impossible de créer ou mettre à jour l’objet Outre d’eau. Le sort n’est pas consommé.");
      return false;
    }

    if (!itemCreated && !itemUpdated) {
      ui.notifications.error("Aquagenèse : l’objet Outre d’eau n’a pas été créé ou mis à jour. Le sort n’est pas consommé.");
      return false;
    }
  }

  await globalThis.ADD2E_PLAY_SPELL_FX?.(mode === "destroy" ? "destruction_eau" : "aquagenese", { casterToken });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: add2eClercCard({ caster, sourceItem, mode, nbOutres, litres, maxLitres, itemCreated, itemUpdated }),
    ...chatStyleData()
  });

  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT] Le script onUse doit retourner true ou false.", { script: "aquagenese.js", result: __add2eOnUseResult });
  ui.notifications?.error?.("Aquagenèse : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
