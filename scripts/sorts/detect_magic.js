// ADD2E — Détection de la magie — Clerc niveau 1
// Version : 2026-07-14-detection-sac-dialog-v3
// Retour attendu : true = sort consommé, false = sort non consommé.

console.log("%c[ADD2E][DETECTION_MAGIE][CLERC] 2026-07-14-detection-sac-dialog-v3", "color:#b88924;font-weight:bold;");

const __add2eOnUseResult = await (async () => {
  const DialogV2 = foundry?.applications?.api?.DialogV2 ?? globalThis.DialogV2;

  const esc = value => String(value ?? "")
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
    ui.notifications.error("Détection de la magie : lanceur ou sort introuvable.");
    return false;
  }

  if (!DialogV2?.wait) {
    ui.notifications.error("Détection de la magie : DialogV2 est indisponible.");
    return false;
  }

  const inventory = (caster.items?.contents ?? Array.from(caster.items ?? []))
    .filter(candidate => ["arme", "armure", "objet"].includes(String(candidate?.type ?? "").toLowerCase()))
    .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "fr"));

  if (!inventory.length) {
    ui.notifications.warn(`${caster.name} ne possède aucun objet à examiner dans son sac.`);
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

  const detectionStrength = candidate => {
    const sys = candidate?.system ?? {};
    const explicit = String(sys.intensite_magique ?? sys.magicIntensity ?? "").trim();
    if (explicit) return explicit;

    const rarity = String(sys.rarete ?? "").toLowerCase();
    if (["très rare", "tres rare", "légendaire", "legendaire", "artefact"].includes(rarity)) return "forte";
    return "faible";
  };

  const objectOptions = inventory.map(candidate => `
    <option value="${esc(candidate.id)}">${esc(visibleName(candidate))}</option>
  `).join("");

  const selection = await DialogV2.wait({
    window: {
      title: "ADD2E — Détection de la magie",
      icon: "fa-solid fa-wand-magic-sparkles"
    },
    position: { width: 560 },
    content: `
      <form class="add2e-detection-magie-form">
        <div class="form-group">
          <label>Zone à examiner</label>
          <div class="form-fields">
            <select name="mode" required>
              <option value="bag">Tout le sac de ${esc(caster.name)}</option>
              <option value="item">Un objet précis</option>
            </select>
          </div>
        </div>

        <div class="form-group add2e-detection-item-choice" style="display:none;">
          <label>Objet à examiner</label>
          <div class="form-fields">
            <select name="itemId">${objectOptions}</select>
          </div>
        </div>

        <p class="hint">
          La détection révèle uniquement si une aura magique est présente et son intensité. Elle n’identifie pas l’objet.
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
        callback: (_event, button) => {
          const form = button.form;
          const mode = form?.elements?.mode?.value ?? "bag";
          const itemId = form?.elements?.itemId?.value ?? "";
          return { mode, itemId };
        }
      }
    ],
    render: (_event, dialog) => {
      const root = dialog?.element ?? dialog;
      const modeField = root?.querySelector?.('select[name="mode"]');
      const itemGroup = root?.querySelector?.(".add2e-detection-item-choice");
      const refresh = () => {
        if (itemGroup) itemGroup.style.display = modeField?.value === "item" ? "" : "none";
      };
      modeField?.addEventListener?.("change", refresh);
      refresh();
    },
    close: () => null
  });

  if (!selection) return false;

  const inspectedItems = selection.mode === "item"
    ? inventory.filter(candidate => candidate.id === selection.itemId)
    : inventory;

  if (!inspectedItems.length) {
    ui.notifications.warn("Détection de la magie : aucun objet valide n’a été sélectionné.");
    return false;
  }

  const results = inspectedItems.map(candidate => ({
    id: candidate.id,
    name: visibleName(candidate),
    img: candidate.img || "icons/svg/item-bag.svg",
    magical: isMagicItem(candidate),
    strength: isMagicItem(candidate) ? detectionStrength(candidate) : "aucune"
  }));

  const casterToken =
    ((typeof token !== "undefined" && token) ? token : null)
    ?? canvas.tokens?.controlled?.find?.(controlled => controlled.actor?.id === caster.id)
    ?? caster.getActiveTokens?.()[0]
    ?? null;

  const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const durationRounds = time?.toRounds?.(1, "tour") ?? 10;
  const durationData = time?.durationData?.(durationRounds) ?? {
    rounds: durationRounds,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time.worldTime,
    combat: game.combat?.id ?? null
  };
  const timeFlags = time?.flags?.({
    source: "detect_magic.js",
    rounds: durationRounds,
    unit: "round",
    endMessage: "La détection de la magie de {actor} se dissipe."
  }) ?? {
    timeEngine: { managed: true, unit: "round", totalRounds: durationRounds },
    roundEngine: { managed: true, unit: "round", totalRounds: durationRounds, endMessage: "La détection de la magie de {actor} se dissipe." },
    endMessage: "La détection de la magie de {actor} se dissipe."
  };

  const effectIcon = sourceItem.img || "systems/add2e/assets/icones/sorts/detection-magie-violet.webp";
  const effectData = {
    name: "Détection de la magie",
    img: effectIcon,
    icon: effectIcon,
    origin: sourceItem.uuid,
    disabled: false,
    transfer: false,
    duration: durationData,
    description: "Le lanceur perçoit les émanations magiques sans identifier les objets.",
    flags: {
      add2e: {
        ...timeFlags,
        spellKey: "detection_magie_clerc",
        spellName: "Détection de la magie",
        spellList: "cleric",
        school: "divination",
        sourceItemUuid: sourceItem.uuid,
        casterId: caster.id,
        casterUuid: caster.uuid,
        range: "3\"",
        area: "1\" de large, 3\" de long",
        duration: "1 tour",
        durationRounds,
        rotationPerRound: "60°",
        detectionDetail: "faible_ou_forte_uniquement",
        blockedBy: { stoneCm: 30, metalCm: 3, woodCm: 90 },
        inspectedInventoryMode: selection.mode,
        inspectedItemIds: inspectedItems.map(candidate => candidate.id),
        detectedMagicItemIds: results.filter(entry => entry.magical).map(entry => entry.id),
        tags: ["sort:clerc", "niveau:1", "divination", "detection:magie", "detection:faible_ou_forte"]
      }
    },
    changes: []
  };

  const existing = caster.effects.find(effect =>
    effect.name === "Détection de la magie"
    || effect.flags?.add2e?.spellKey === "detection_magie_clerc"
  );

  if (existing) await existing.update(effectData);
  else await caster.createEmbeddedDocuments("ActiveEffect", [effectData]);

  const resultRows = results.map(entry => `
    <tr>
      <td style="padding:4px 6px;width:36px;">
        <img src="${esc(entry.img)}" style="width:28px;height:28px;object-fit:cover;border-radius:4px;">
      </td>
      <td style="padding:4px 6px;"><b>${esc(entry.name)}</b></td>
      <td style="padding:4px 6px;text-align:center;">
        ${entry.magical ? '<b style="color:#6c31b5;">Aura magique</b>' : '<span style="color:#666;">Aucune aura</span>'}
      </td>
      <td style="padding:4px 6px;text-align:right;"><b>${esc(entry.strength)}</b></td>
    </tr>
  `).join("");

  const chatContent = `
    <div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,#fffaf0 0%,#fff7df 100%);border:1.5px solid #e2bc63;margin:0.3em 0;padding:0;font-family:var(--font-primary);overflow:hidden;">
      <div style="background:linear-gradient(90deg,#6f4b12 0%,#b88924 100%);padding:8px 12px;display:flex;align-items:center;gap:10px;color:white;border-bottom:2px solid #8a611d;">
        <img src="${esc(caster.img || "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
        <div style="line-height:1.2;flex:1;">
          <div style="font-weight:bold;font-size:1.05em;">${esc(caster.name)}</div>
          <div style="font-size:0.85em;opacity:0.95;">lance <b>${esc(sourceItem.name)}</b></div>
        </div>
        <img src="${esc(effectIcon)}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
      </div>
      <div style="padding:10px;">
        <div style="background:#fffdf4;border:1px solid #e2bc63;border-radius:6px;padding:7px;text-align:center;margin-bottom:8px;color:#6f4b12;">
          <div style="font-weight:bold;color:#2f8f46;">DÉTECTION ACTIVE</div>
          <div>${selection.mode === "bag" ? `Le contenu du sac de ${esc(caster.name)} est examiné.` : "Un objet du sac est examiné."}</div>
          <div>La véritable identité et les pouvoirs des objets ne sont pas révélés.</div>
        </div>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2bc63;border-radius:6px;overflow:hidden;">
          <thead>
            <tr style="background:#fff7df;">
              <th></th>
              <th style="text-align:left;padding:5px;">Objet examiné</th>
              <th style="text-align:center;padding:5px;">Résultat</th>
              <th style="text-align:right;padding:5px;">Intensité</th>
            </tr>
          </thead>
          <tbody>${resultRows}</tbody>
        </table>
      </div>
    </div>`;

  await globalThis.ADD2E_PLAY_SPELL_FX?.("detection_magie", { casterToken });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
    content: chatContent,
    ...chatStyleData()
  });

  console.log("[ADD2E][DETECTION_MAGIE][RESULT]", {
    caster: caster.name,
    mode: selection.mode,
    inspected: results.map(entry => ({ id: entry.id, name: entry.name, magical: entry.magical, strength: entry.strength }))
  });

  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT]", { script: "detect_magic.js", result: __add2eOnUseResult });
  ui.notifications.error("Détection de la magie : le script onUse n’a pas retourné true ou false.");
  return false;
}

return __add2eOnUseResult;
