// ADD2E — Purification / Corruption de l'eau et des aliments
// Compatible Foundry V13/V14/V15.
// Le moteur de lancement réserve déjà le sort mémorisé : true le conserve, false le restitue.

const __add2ePurificationResult = await (async () => {
  const normalize = value => String(value ?? "").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const chatStyle = () => CONST.CHAT_MESSAGE_STYLES
    ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
    : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };

  const sourceItem = typeof sort !== "undefined" && sort
    ? sort
    : typeof item !== "undefined" && item
      ? item
      : typeof spell !== "undefined" && spell
        ? spell
        : typeof args !== "undefined" && args?.[0]?.item
          ? args[0].item
          : typeof this !== "undefined" && this?.documentName === "Item"
            ? this
            : null;

  if (!sourceItem) {
    ui.notifications.error("Purification / Corruption : sort introuvable.");
    return false;
  }

  const caster = typeof actor !== "undefined" && actor ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications.error("Purification / Corruption : lanceur introuvable.");
    return false;
  }

  const flags = sourceItem.flags?.add2e ?? {};
  const values = [
    sourceItem.name,
    sourceItem.system?.nom,
    sourceItem.system?.slug,
    sourceItem.system?.spellKey,
    sourceItem.system?.reversibleMode,
    flags.spellKey,
    flags.slug,
    flags.reversibleActorEntry?.name,
    flags.reversibleActorEntry?.displayName,
    flags.reversibleActorEntry?.mode,
    flags.spellFamily?.reversibleMode
  ];

  let mode = null;
  for (const value of values) {
    const key = normalize(value);
    if (key.includes("corruption")) {
      mode = "corruption";
      break;
    }
    if (key.includes("purification")) {
      mode = "purification";
      break;
    }
  }

  if (!mode) {
    const reversibleMode = normalize(flags.reversibleActorEntry?.mode ?? flags.spellFamily?.reversibleMode ?? sourceItem.system?.reversibleMode);
    if (["inverse", "corruption"].includes(reversibleMode)) mode = "corruption";
    if (["normal", "base", "purification"].includes(reversibleMode)) mode = "purification";
  }

  if (!mode) {
    ui.notifications.error(`Purification / Corruption : variante introuvable pour « ${sourceItem.name ?? "sans nom"} ».`);
    return false;
  }

  const isCorruption = mode === "corruption";
  const modeInfo = isCorruption
    ? {
        label: "Corruption de l'eau et des aliments",
        resultLabel: "CORRUPTION",
        targetLabel: "Eau et aliments désignés",
        rule: "La nourriture et l'eau concernées sont corrompues. L'eau devient impropre à la boisson ; le Maître du Donjon applique les conséquences matérielles exactes.",
        accent: "#8f3b2e"
      }
    : {
        label: "Purification de l'eau et des aliments",
        resultLabel: "PURIFICATION",
        targetLabel: "Eau et aliments désignés",
        rule: "La nourriture et l'eau concernées sont purifiées. Le Maître du Donjon applique les conséquences matérielles exactes.",
        accent: "#2f8f46"
      };

  const casterToken = canvas?.tokens?.controlled?.find(tokenDoc => tokenDoc?.actor?.id === caster.id)
    ?? (typeof token !== "undefined" && token?.actor?.id === caster.id ? token : null)
    ?? caster.getActiveTokens?.()[0]
    ?? null;

  const card = `
    <div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,#fffaf0,#fff7df);border:1.5px solid #e2bc63;overflow:hidden;padding:0;font-family:var(--font-primary);">
      <div style="background:linear-gradient(90deg,#6f4b12,#b88924);padding:8px 12px;color:#fff;display:flex;align-items:center;gap:10px;border-bottom:2px solid #8a611d;">
        <img src="${escapeHtml(caster.img || "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
        <div style="line-height:1.2;flex:1;">
          <div style="font-weight:bold;font-size:1.05em;">${escapeHtml(caster.name)}</div>
          <div style="font-size:.85em;opacity:.95;">lance <b>${escapeHtml(modeInfo.label)}</b></div>
        </div>
        <div style="text-align:right;font-size:.78em;opacity:.95;">Sort divin</div>
        <img src="${escapeHtml(sourceItem.img || "icons/magic/holy/prayer-hands-glowing-yellow.webp")}" style="width:32px;height:32px;border-radius:4px;background:#fff;object-fit:cover;">
      </div>
      <div style="padding:10px;color:#6f4b12;">
        <div style="margin-bottom:7px;font-size:.95em;"><b>Cible :</b> ${escapeHtml(modeInfo.targetLabel)}</div>
        <div style="text-align:center;border:1px solid #e2bc63;border-radius:7px;padding:8px;background:#fffdf7;">
          <b style="color:${modeInfo.accent};">${escapeHtml(modeInfo.resultLabel)}</b>
          <div style="margin-top:4px;font-size:.9em;">Portée : <b>3&quot;</b> · Zone : <b>27 dm³ / niveau</b> dans une surface de <b>1&quot; de côté</b> · Durée : <b>Permanente</b></div>
        </div>
        <div style="margin-top:7px;padding:7px 8px;border-left:4px solid ${modeInfo.accent};background:#fff9e9;border-radius:4px;font-size:.88em;line-height:1.35;">${escapeHtml(modeInfo.rule)}</div>
      </div>
    </div>`;

  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      content: card,
      ...chatStyle()
    });
  } catch (_error) {
    ui.notifications.error(`${modeInfo.label} : impossible de créer la carte de chat.`);
    return false;
  }

  return true;
})();

return __add2ePurificationResult === true ? true : false;
