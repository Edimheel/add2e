// ADD2E — Détection de la magie — Foundry V13/V14/V15, DialogV2.
// Version : 2026-07-14-inventory-detection-v3
// Retour attendu : true = sort consommé, false = sort non consommé.

const __add2eDetectionMagieResult = await (async () => {
  const DialogV2 = foundry?.applications?.api?.DialogV2 ?? globalThis.DialogV2;

  const caster =
    ((typeof actor !== "undefined" && actor) ? actor : null)
    ?? ((typeof item !== "undefined" && item?.parent) ? item.parent : null)
    ?? ((typeof sort !== "undefined" && sort?.parent) ? sort.parent : null)
    ?? null;

  const sourceItem =
    ((typeof sort !== "undefined" && sort) ? sort : null)
    ?? ((typeof item !== "undefined" && item) ? item : null)
    ?? null;

  const casterToken =
    ((typeof token !== "undefined" && token) ? token : null)
    ?? canvas.tokens?.controlled?.find?.(candidate => candidate.actor?.id === caster?.id)
    ?? caster?.getActiveTokens?.()[0]
    ?? null;

  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const norm = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const chatStyleData = () => CONST.CHAT_MESSAGE_STYLES
    ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
    : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };

  if (!caster || !sourceItem) {
    ui.notifications.error("Détection de la magie : lanceur ou sort introuvable.");
    return false;
  }

  if (!DialogV2?.wait) {
    ui.notifications.error("Détection de la magie : DialogV2 est indisponible.");
    return false;
  }

  const isMagicItem = candidate => {
    const system = candidate?.system ?? {};
    const flags = candidate?.flags?.add2e ?? {};
    const tags = [system.tags, system.effectTags]
      .flatMap(value => Array.isArray(value) ? value : (value ? [value] : []))
      .map(norm);

    return system.magique === true
      || system.magic === true
      || flags.isMagicItem === true
      || norm(system.categorie) === "objet_magique"
      || tags.some(tag => tag.includes("objet_magique") || tag.includes("magique"));
  };

  const isIdentified = candidate => candidate?.system?.identifie === true
    || candidate?.system?.identified === true
    || candidate?.getFlag?.("add2e", "identified") === true;

  const visibleName = candidate => {
    if (isIdentified(candidate)) {
      return String(candidate?.system?.nom ?? candidate?.name ?? "Objet").trim() || "Objet";
    }

    return String(
      candidate?.system?.nom_non_identifie
      ?? candidate?.system?.unidentifiedName
      ?? candidate?.system?.sousType
      ?? candidate?.system?.sous_type
      ?? candidate?.name
      ?? "Objet"
    ).trim() || "Objet";
  };

  const magicIntensity = candidate => {
    const system = candidate?.system ?? {};
    const explicit = String(system.intensite_magique ?? system.magicIntensity ?? "").trim();
    if (explicit) return explicit;

    const rarity = norm(system.rarete);
    if (["tres_rare", "legendaire", "artefact"].includes(rarity)) return "forte";
    return "faible";
  };

  const falseAuraFor = candidate => {
    for (const effect of caster.effects ?? []) {
      if (effect.disabled) continue;
      const flags = effect.flags?.add2e ?? {};
      const magicAura = flags.magicAura ?? {};
      const spell = flags.spell ?? {};
      const itemId = String(magicAura.itemId ?? spell.itemId ?? "");
      const itemUuid = String(magicAura.itemUuid ?? spell.itemUuid ?? "");
      const matches = itemId === candidate.id || (itemUuid && itemUuid === candidate.uuid);
      if (!matches) continue;
      if (magicAura.detectedAsMagical === true) return true;
      if (norm(spell.slug) === "aura_magique_de_nystul") return true;
    }
    return false;
  };

  const inventory = (caster.items?.contents ?? Array.from(caster.items ?? []))
    .filter(candidate => ["arme", "armure", "objet"].includes(String(candidate?.type ?? "").toLowerCase()))
    .sort((a, b) => visibleName(a).localeCompare(visibleName(b), "fr"));

  if (!inventory.length) {
    ui.notifications.warn(`${caster.name} ne possède aucun objet à examiner.`);
    return false;
  }

  const options = inventory.map(candidate =>
    `<option value="${esc(candidate.id)}">${esc(visibleName(candidate))}</option>`
  ).join("");

  const selection = await DialogV2.wait({
    window: {
      title: "ADD2E — Détection de la magie",
      icon: "fa-solid fa-eye"
    },
    position: { width: 560 },
    content: `
      <form class="add2e-detection-magie-form">
        <div class="form-group">
          <label>Éléments à examiner</label>
          <div class="form-fields">
            <select name="mode" required>
              <option value="bag">Tout le sac de ${esc(caster.name)}</option>
              <option value="item">Un objet précis</option>
            </select>
          </div>
        </div>

        <div class="form-group add2e-detection-object-choice" style="display:none;">
          <label>Objet</label>
          <div class="form-fields">
            <select name="itemId">${options}</select>
          </div>
        </div>

        <p class="hint">
          Le sort révèle uniquement les objets qui émettent une aura magique. Il n’identifie pas l’objet.
        </p>
      </form>
    `,
    buttons: [
      {
        action: "cancel",
        label: "Annuler",
        icon: "fa-solid fa-xmark"
      },
      {
        action: "detect",
        label: "Détecter",
        icon: "fa-solid fa-magnifying-glass",
        default: true,
        callback: (_event, button) => ({
          mode: button.form?.elements?.mode?.value ?? "bag",
          itemId: button.form?.elements?.itemId?.value ?? ""
        })
      }
    ],
    render: (_event, dialog) => {
      const root = dialog?.element ?? dialog;
      const mode = root?.querySelector?.('select[name="mode"]');
      const group = root?.querySelector?.(".add2e-detection-object-choice");
      const refresh = () => {
        if (group) group.style.display = mode?.value === "item" ? "" : "none";
      };
      mode?.addEventListener?.("change", refresh);
      refresh();
    },
    close: () => null
  });

  if (!selection) return false;

  const inspected = selection.mode === "item"
    ? inventory.filter(candidate => candidate.id === selection.itemId)
    : inventory;

  if (!inspected.length) {
    ui.notifications.warn("Détection de la magie : aucun objet valide n’a été sélectionné.");
    return false;
  }

  const results = inspected.flatMap(candidate => {
    const falseAura = falseAuraFor(candidate);
    const magical = isMagicItem(candidate) || falseAura;
    if (!magical) return [];

    return [{
      id: candidate.id,
      name: visibleName(candidate),
      img: candidate.img || "icons/svg/item-bag.svg",
      falseAura,
      intensity: magicIntensity(candidate)
    }];
  });

  const resultContent = results.length
    ? `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th></th>
            <th style="text-align:left;">Aura détectée</th>
            <th style="text-align:right;">Intensité</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(result => `
            <tr>
              <td style="padding:4px 6px;width:36px;">
                <img src="${esc(result.img)}" style="width:28px;height:28px;object-fit:cover;border-radius:4px;">
              </td>
              <td style="padding:4px 6px;"><b>${esc(result.name)}</b></td>
              <td style="padding:4px 6px;text-align:right;"><b>${esc(result.intensity)}</b></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `
    : `<p style="margin:0;text-align:center;"><b>Aucune aura magique détectée.</b></p>`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
    content: `
      <div class="add2e-chat-card add2e-magicien-sort add2e-sort-detection-magie" style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px;">
          <img src="${esc(caster.img || "icons/svg/mystery-man.svg")}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff;">
          <div style="flex:1;line-height:1.1;">
            <div style="font-weight:800;font-size:14px;">${esc(caster.name)}</div>
            <div style="font-size:12px;font-weight:700;">lance ${esc(sourceItem.name || "Détection de la magie")}</div>
          </div>
          <img src="${esc(sourceItem.img || "icons/svg/aura.svg")}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;">
        </div>

        <div style="padding:10px;">
          <div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;">
            <div style="color:#6c31b5;font-weight:900;text-align:center;margin-bottom:7px;">PERCEPTION MAGIQUE</div>
            ${resultContent}
          </div>
          <p style="margin:7px 0 0;font-size:12px;">
            Les objets sans aura ne sont pas révélés. Un objet non identifié conserve son nom générique.
          </p>
        </div>
      </div>
    `,
    ...chatStyleData()
  });

  await globalThis.ADD2E_PLAY_SPELL_FX?.("detection_magie", { casterToken });

  console.log("[ADD2E][DETECTION_MAGIE][INVENTORY_RESULT]", {
    caster: caster.name,
    mode: selection.mode,
    inspectedCount: inspected.length,
    detected: results
  });

  return true;
})();

if (__add2eDetectionMagieResult !== true && __add2eDetectionMagieResult !== false) {
  console.error("[ADD2E][DETECTION_MAGIE][BAD_RETURN]", __add2eDetectionMagieResult);
  ui.notifications.error("Détection de la magie : le script onUse n’a pas retourné true ou false.");
  return false;
}

return __add2eDetectionMagieResult;
