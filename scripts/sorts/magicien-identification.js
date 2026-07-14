// ADD2E — onUse Magicien : Identification
// Version : 2026-07-14-identification-objets-magiques-v1
// Retour attendu : true = sort consommé, false = sort non consommé.

const __add2eIdentificationResult = await (async () => {
  const DialogV2 = foundry?.applications?.api?.DialogV2 ?? globalThis.DialogV2;

  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const chatStyleData = () => CONST.CHAT_MESSAGE_STYLES
    ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
    : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };

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

  if (!DialogV2) {
    ui.notifications.error("Identification : DialogV2 est indisponible.");
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
    .filter(candidate => isMagicItem(candidate) && !isIdentified(candidate))
    .sort((a, b) => genericName(a).localeCompare(genericName(b), "fr"));

  if (!candidates.length) {
    ui.notifications.warn(`${caster.name} ne possède aucun objet magique non identifié.`);
    return false;
  }

  const options = candidates.map(candidate => `
    <option value="${escapeHtml(candidate.id)}">
      ${escapeHtml(genericName(candidate))}
    </option>
  `).join("");

  const selectedId = await DialogV2.wait({
    window: {
      title: "ADD2E — Identification",
      icon: "fa-solid fa-magnifying-glass-sparkles"
    },
    position: { width: 520 },
    content: `
      <form class="add2e-identification-form">
        <div class="form-group">
          <label>Objet à identifier</label>
          <div class="form-fields">
            <select name="itemId" required>${options}</select>
          </div>
          <p class="hint">Seuls les objets magiques non identifiés portés par ${escapeHtml(caster.name)} sont proposés.</p>
        </div>
      </form>
    `,
    buttons: [
      {
        action: "cancel",
        label: "Annuler",
        icon: "fa-solid fa-xmark"
      },
      {
        action: "identify",
        label: "Identifier",
        icon: "fa-solid fa-wand-magic-sparkles",
        default: true,
        callback: (_event, button) => button.form?.elements?.itemId?.value || false
      }
    ],
    close: () => null
  });

  if (!selectedId) return false;

  const targetItem = caster.items?.get?.(selectedId) ?? candidates.find(candidate => candidate.id === selectedId);
  if (!targetItem || !isMagicItem(targetItem)) {
    ui.notifications.error("Identification : l’objet sélectionné est introuvable ou n’est pas magique.");
    return false;
  }

  if (isIdentified(targetItem)) {
    ui.notifications.warn(`${targetItem.name} est déjà identifié.`);
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

  const content = `
    <div class="add2e-chat-card add2e-magicien-sort" style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary);">
      <div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px;">
        <img src="${escapeHtml(caster.img || "icons/svg/mystery-man.svg")}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff;">
        <div style="flex:1;line-height:1.1;">
          <div style="font-weight:800;font-size:14px;">${escapeHtml(caster.name)}</div>
          <div style="font-size:12px;font-weight:700;">lance ${escapeHtml(sourceItem.name || "Identification")}</div>
        </div>
        <img src="${escapeHtml(sourceItem.img || "icons/svg/book.svg")}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;">
      </div>
      <div style="padding:10px;background:#f6f0ff;">
        <div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:9px;text-align:center;">
          <div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;">Objet identifié</div>
          <p style="margin:6px 0 0;"><b>${escapeHtml(oldName)}</b> est révélé comme étant :</p>
          <p style="margin:5px 0 0;font-size:1.1em;"><b>${escapeHtml(revealedName)}</b></p>
          <p style="margin:7px 0 0;">Ses pouvoirs magiques sont désormais accessibles.</p>
        </div>
      </div>
    </div>
  `;

  await globalThis.ADD2E_PLAY_SPELL_FX?.("identification", { casterToken });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
    content,
    ...chatStyleData()
  });

  console.log("[ADD2E][IDENTIFICATION][SUCCESS]", {
    actor: caster.name,
    actorId: caster.id,
    itemId: targetItem.id,
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
