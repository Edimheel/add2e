// ADD2E — onUse Magicien : Identification
// Version : 2026-08-09-identification-icon-selection-v2
// Retour attendu : true = sort consommé, false = sort non consommé.

const __add2eIdentificationResult = await (async () => {
  const IDENTIFIABLE_ITEM_TYPES = new Set(["objet", "arme", "armure"]);

  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const sourceItem =
    ((typeof sort !== "undefined" && sort) ? sort : null)
    ?? ((typeof item !== "undefined" && item) ? item : null)
    ?? ((typeof this !== "undefined" && this?.documentName === "Item") ? this : null)
    ?? ((typeof args !== "undefined" && args?.[0]?.item) ? args[0].item : null);

  const caster =
    ((typeof actor !== "undefined" && actor) ? actor : null)
    ?? sourceItem?.parent
    ?? null;

  if (!sourceItem || !caster) {
    ui.notifications.error("Identification : lanceur ou sort introuvable.");
    return false;
  }

  if (typeof globalThis.add2eDialogWait !== "function") {
    ui.notifications.error("Identification : l’API de fenêtre ADD2E est indisponible.");
    return false;
  }

  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications.error("Identification : l’API commune des cartes de chat ADD2E est indisponible.");
    return false;
  }

  const isMagicItem = candidate => {
    const sys = candidate?.system ?? {};
    const flags = candidate?.flags?.add2e ?? {};
    const tags = [
      ...(Array.isArray(sys.tags) ? sys.tags : []),
      ...(Array.isArray(sys.effectTags) ? sys.effectTags : [])
    ].map(value => String(value ?? "").toLowerCase());

    return sys.magique === true
      || sys.magic === true
      || flags.isMagicItem === true
      || String(sys.categorie ?? "").toLowerCase() === "objet_magique"
      || tags.some(tag => tag.includes("objet_magique") || tag.includes("magique"));
  };

  const isIdentified = candidate => candidate?.system?.identifie === true
    || candidate?.system?.identified === true
    || candidate?.getFlag?.("add2e", "identified") === true;

  const isIdentifiableItem = candidate => {
    const type = String(candidate?.type ?? "").trim().toLowerCase();
    return IDENTIFIABLE_ITEM_TYPES.has(type)
      && isMagicItem(candidate)
      && !isIdentified(candidate);
  };

  const genericName = candidate => String(
    candidate?.system?.nom_non_identifie
    ?? candidate?.system?.unidentifiedName
    ?? candidate?.system?.sousType
    ?? "Objet magique"
  ).trim() || "Objet magique";

  const trueName = candidate => String(
    candidate?.system?.nom
    ?? candidate?.system?.nom_reel
    ?? candidate?.system?.trueName
    ?? candidate?.name
    ?? "Objet magique"
  ).trim() || "Objet magique";

  const candidates = (caster.items?.contents ?? Array.from(caster.items ?? []))
    .filter(isIdentifiableItem)
    .sort((a, b) => genericName(a).localeCompare(genericName(b), "fr"));

  if (!candidates.length) {
    ui.notifications.warn(`${caster.name} ne possède aucun objet magique non identifié pouvant être identifié.`);
    return false;
  }

  const choices = candidates.map((candidate, index) => {
    const itemId = escapeHtml(candidate.id);
    const name = escapeHtml(genericName(candidate));
    const image = escapeHtml(candidate.img || "icons/svg/item-bag.svg");
    const type = escapeHtml(String(candidate.type ?? "objet"));
    return `
      <label style="display:grid;grid-template-columns:54px minmax(0,1fr) 20px;gap:9px;align-items:center;min-height:62px;padding:6px 8px;border:1px solid var(--a2e-dialog-border);border-radius:8px;background:var(--a2e-dialog-paper-light);cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.10);">
        <img src="${image}" alt="" style="display:block;width:50px;height:50px;min-width:50px;max-width:50px;border:1px solid var(--a2e-dialog-border);border-radius:6px;object-fit:cover;background:#fff;">
        <span style="display:grid;gap:2px;min-width:0;">
          <strong style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--a2e-dialog-dark);font-size:.98rem;">${name}</strong>
          <small style="opacity:.72;text-transform:capitalize;">${type}</small>
        </span>
        <input type="radio" name="itemId" value="${itemId}"${index === 0 ? " checked" : ""} required style="margin:0;justify-self:center;">
      </label>
    `;
  }).join("");

  const selectedId = await globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "identify",
    add2eClasses: ["add2e-identification-window"],
    window: {
      title: "ADD2E — Identification"
    },
    position: { width: 720 },
    content: `
      <form class="add2e-identification-form" style="display:grid;gap:9px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 9px;border:1px solid var(--a2e-dialog-border);border-radius:8px;background:var(--a2e-dialog-paper-dark);">
          <strong style="color:var(--a2e-dialog-dark);">Objet à identifier</strong>
          <span style="font-size:.82rem;opacity:.78;">${candidates.length} objet${candidates.length > 1 ? "s" : ""}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;max-height:430px;overflow:auto;padding:1px;">
          ${choices}
        </div>
        <p class="hint" style="margin:0;">Seuls les objets, armes et armures magiques non identifiés portés par ${escapeHtml(caster.name)} sont proposés.</p>
      </form>
    `,
    buttons: [
      {
        action: "identify",
        label: "Identifier",
        icon: "<i class='fas fa-wand-magic-sparkles'></i>",
        default: true,
        callback: (_event, button) => button.form?.querySelector?.('input[name="itemId"]:checked')?.value || false
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

  if (!selectedId) return false;

  const targetItem = caster.items?.get?.(selectedId) ?? candidates.find(candidate => candidate.id === selectedId);
  if (!targetItem || !isIdentifiableItem(targetItem)) {
    ui.notifications.error("Identification : l’objet sélectionné est introuvable, déjà identifié ou n’est pas un équipement magique identifiable.");
    return false;
  }

  const oldName = genericName(targetItem);
  const revealedName = trueName(targetItem);

  const updateData = {
    name: revealedName,
    "system.identifie": true,
    "flags.add2e.identified": true,
    "flags.add2e.identifiedBy": caster.uuid,
    "flags.add2e.identifiedAt": Date.now()
  };

  if (targetItem.system?.identified !== undefined) {
    updateData["system.identified"] = true;
  }

  await targetItem.update(updateData);
  caster.sheet?.render?.(false);

  const casterToken =
    ((typeof token !== "undefined" && token) ? token : null)
    ?? canvas.tokens?.controlled?.find?.(controlled => controlled.actor?.id === caster.id)
    ?? caster.getActiveTokens?.()[0]
    ?? null;

  await globalThis.ADD2E_PLAY_SPELL_FX?.("identification", { casterToken });

  const card = {
    actor: caster,
    title: "Identification — Objet identifié",
    icon: "fas fa-magnifying-glass-sparkles",
    variant: "magic",
    source: {
      name: caster.name,
      img: caster.img,
      type: sourceItem.name || "Identification"
    },
    target: {
      name: revealedName,
      img: targetItem.img || "icons/svg/item-bag.svg",
      type: "Objet magique"
    },
    rows: [
      { label: "Avant identification", value: oldName },
      { label: "Objet révélé", value: revealedName }
    ],
    message: "Ses propriétés magiques sont désormais révélées.",
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken })
    }
  };

  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) {
    throw new Error("Identification : la carte de chat ADD2E est vide.");
  }
  await globalThis.add2eCreateChatCard(card);

  console.log("[ADD2E][IDENTIFICATION][SUCCESS]", {
    actor: caster.name,
    actorId: caster.id,
    itemId: targetItem.id,
    itemType: targetItem.type,
    oldName,
    revealedName
  });

  return true;
})();

if (__add2eIdentificationResult !== true && __add2eIdentificationResult !== false) {
  console.error("[ADD2E][IDENTIFICATION][BAD_RETURN]", __add2eIdentificationResult);
  ui.notifications.error("Identification : le script onUse n’a pas retourné true ou false.");
  return false;
}

return __add2eIdentificationResult;
