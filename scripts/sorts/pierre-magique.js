/**
 * ADD2E — Pierre Magique
 * Clerc niveau 1
 * Version : 2026-06-06-pierre-magique-time-engine-v1
 *
 * Le fichier d'origine indique durationRounds: 0.
 * La migration utilise donc le moteur de temps en durée spéciale, sans expiration automatique inventée.
 *
 * Contrat onUse : true = consommé ; false = non consommé.
 */

console.log("%c[ADD2E][PIERRE_MAGIQUE] 2026-06-06-pierre-magique-time-engine-v1", "color:#b88924;font-weight:bold;");

const __add2eOnUseResult = await (async () => {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications.error("Pierre Magique : DialogV2 introuvable.");
    return false;
  }

  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function chatStyleData() {
    return CONST.CHAT_MESSAGE_STYLES
      ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
      : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
  }

  function sourceItemFromContext() {
    if (typeof sort !== "undefined" && sort) return sort;
    if (typeof item !== "undefined" && item) return item;
    if (typeof this !== "undefined" && this?.documentName === "Item") return this;
    if (typeof spell !== "undefined" && spell) return spell;
    if (typeof args !== "undefined" && args?.[0]?.item) return args[0].item;
    return null;
  }

  function casterFromContext(sourceItem) {
    return (typeof actor !== "undefined" && actor) ? actor : sourceItem?.parent;
  }

  function casterTokenFor(caster) {
    return canvas.tokens?.controlled?.[0]
      ?? ((typeof token !== "undefined" && token) ? token : null)
      ?? caster?.getActiveTokens?.()[0]
      ?? null;
  }

  function tags() {
    return [
      "sort:pierre_magique",
      "projectile:magique",
      "degats:1d4",
      "arme:projectile",
      "munition:pierre_magique",
      "duree:speciale"
    ];
  }

  function timeFlags({ sourceItem, caster, qty }) {
    const list = tags();
    const time = game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
    return time?.flags?.({
      source: "pierre-magique.js",
      rounds: 0,
      unit: "special",
      silentExpiration: true,
      extra: {
        spellName: "Pierre Magique",
        spellKey: "pierre_magique",
        sourceItemUuid: sourceItem?.uuid ?? null,
        casterId: caster?.id ?? null,
        casterUuid: caster?.uuid ?? null,
        quantity: qty,
        durationSpecial: true,
        tags: list
      }
    }) ?? {
      timeEngine: { managed: false, unit: "special", totalRounds: 0 },
      roundEngine: { managed: false, unit: "special", totalRounds: 0, silentExpiration: true },
      silentExpiration: true,
      spellName: "Pierre Magique",
      spellKey: "pierre_magique",
      sourceItemUuid: sourceItem?.uuid ?? null,
      casterId: caster?.id ?? null,
      casterUuid: caster?.uuid ?? null,
      quantity: qty,
      durationSpecial: true,
      tags: list
    };
  }

  function trackingEffectData({ sourceItem, caster, qty }) {
    return {
      name: "Pierre Magique",
      img: sourceItem?.img || "systems/add2e/assets/icones/sorts/pierre-magique.webp",
      origin: sourceItem?.uuid ?? null,
      disabled: false,
      transfer: false,
      duration: {},
      description: `Le lanceur a enchanté ${qty} pierre(s) magique(s). Durée spéciale : aucune expiration automatique en rounds n'est appliquée tant que la durée exacte n'est pas validée dans le système.`,
      flags: {
        add2e: {
          ...timeFlags({ sourceItem, caster, qty }),
          tags: tags()
        }
      },
      changes: []
    };
  }

  async function createOrUpdateStones({ caster, sourceItem, qty }) {
    const itemName = "Pierre magique";
    const list = tags();
    const flags = {
      add2e: {
        ...timeFlags({ sourceItem, caster, qty }),
        createdBySpell: "Pierre Magique",
        spellUuid: sourceItem?.uuid ?? null,
        casterUuid: caster?.uuid ?? null,
        tags: list
      }
    };

    const existing = Array.from(caster.items ?? []).find(i =>
      i.type === "objet" && String(i.name ?? "").toLowerCase() === itemName.toLowerCase()
    );

    if (existing) {
      const currentQty = Number(existing.system?.quantite ?? existing.system?.quantity ?? 0) || 0;
      await existing.update({
        "system.quantite": currentQty + qty,
        "system.quantity": currentQty + qty,
        "system.tags": list,
        "system.description": "Pierres enchantées par le sort Pierre Magique. Durée spéciale, à suivre selon la règle validée par le MJ.",
        flags
      });
      return existing;
    }

    const created = await caster.createEmbeddedDocuments("Item", [{
      name: itemName,
      type: "objet",
      img: sourceItem?.img || "systems/add2e/assets/icones/sorts/pierre-magique.webp",
      system: {
        nom: itemName,
        description: "Pierres enchantées par le sort Pierre Magique. Durée spéciale, à suivre selon la règle validée par le MJ.",
        quantite: qty,
        quantity: qty,
        equipee: false,
        tags: list
      },
      flags
    }]);

    return created?.[0] ?? null;
  }

  async function applyTrackingEffect(caster, data) {
    const oldIds = Array.from(caster.effects ?? [])
      .filter(e => (e.flags?.add2e?.tags ?? []).includes("sort:pierre_magique"))
      .map(e => e.id)
      .filter(Boolean);
    if (oldIds.length) await caster.deleteEmbeddedDocuments("ActiveEffect", oldIds);
    await caster.createEmbeddedDocuments("ActiveEffect", [data]);
    return true;
  }

  async function createChat({ caster, sourceItem, qty }) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      content: `
        <div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,#fffaf0 0%,#fff7df 100%);border:1.5px solid #e2bc63;overflow:hidden;padding:0;font-family:var(--font-primary);">
          <div style="background:linear-gradient(90deg,#6f4b12 0%,#b88924 100%);padding:8px 12px;color:white;display:flex;align-items:center;gap:10px;border-bottom:2px solid #8a611d;">
            <img src="${esc(caster?.img || "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
            <div style="line-height:1.2;flex:1;">
              <div style="font-weight:bold;font-size:1.05em;">${esc(caster?.name ?? "Lanceur")}</div>
              <div style="font-size:0.85em;opacity:0.95;">lance <b>${esc(sourceItem?.name ?? "Pierre Magique")}</b></div>
            </div>
            <div style="text-align:right;font-size:0.78em;opacity:0.95;">Sort divin</div>
            <img src="${esc(sourceItem?.img || "systems/add2e/assets/icones/sorts/pierre-magique.webp")}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
          </div>
          <div style="padding:10px;">
            <div style="border:1px solid #e2bc63;background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:#6f4b12;">
              <div style="font-weight:bold;color:#2f8f46;">PIERRES MAGIQUES CRÉÉES</div>
              <div>Quantité : <b>${esc(qty)}</b>.</div>
              <div>Durée : <b>spéciale / non expirée automatiquement</b>.</div>
            </div>
            <details style="margin-top:8px;background:white;border:1px solid #e2bc63;border-radius:6px;">
              <summary style="cursor:pointer;color:#6f4b12;font-weight:600;padding:6px;">Règle appliquée</summary>
              <div style="padding:8px;font-size:0.85em;line-height:1.45;color:#6f4b12;">
                Enchante jusqu'à trois petites pierres pouvant être lancées comme projectiles magiques. Le fichier d'origine ne définit pas de durée en rounds ; le suivi est donc marqué comme durée spéciale.
              </div>
            </details>
          </div>
        </div>`,
      ...chatStyleData()
    });
  }

  const sourceItem = sourceItemFromContext();
  if (!sourceItem) {
    ui.notifications.error("Pierre Magique : sort introuvable.");
    return false;
  }

  const caster = casterFromContext(sourceItem);
  if (!caster) {
    ui.notifications.error("Pierre Magique : lanceur introuvable.");
    return false;
  }

  if (!game.user.isGM && !caster.isOwner) {
    ui.notifications.error("Pierre Magique : tu dois être propriétaire de l'acteur pour créer les pierres dans son inventaire.");
    return false;
  }

  const result = await DialogV2.wait({
    window: { title: "Lancement : Pierre Magique" },
    add2eTheme: "cleric",
    add2eImg: sourceItem.img || "systems/add2e/assets/icones/sorts/pierre-magique.webp",
    content: `
      <form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">
        <div class="form-group">
          <label style="font-weight:bold;">Nombre de pierres :</label>
          <input type="number" name="qty" value="3" min="1" max="3" step="1" style="width:100%;">
        </div>
        <div style="font-size:0.9em;color:#6f4b12;border-top:1px solid #e2bc63;padding-top:6px;">
          Le sort crée des pierres magiques dans l'inventaire et pose un effet de suivi sans expiration automatique.
        </div>
      </form>`,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "fa-solid fa-gem",
        default: true,
        callback: (event, button) => ({ qty: Number(button.form.elements.qty?.value || 3) })
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });

  if (!result) return false;

  const qty = Math.max(1, Math.min(3, Math.floor(Number(result.qty) || 3)));

  await createOrUpdateStones({ caster, sourceItem, qty });
  await applyTrackingEffect(caster, trackingEffectData({ sourceItem, caster, qty }));

  try {
    const casterToken = casterTokenFor(caster);
    await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX?.(casterToken ?? caster, "divine");
    await globalThis.ADD2E_PLAY_SPELL_FX?.("pierre_magique", { casterToken });
  } catch (err) {
    console.warn("[ADD2E][PIERRE_MAGIQUE][VFX][IGNORED]", err);
  }

  await createChat({ caster, sourceItem, qty });

  console.log("[ADD2E][pierre-magique.js][ONUSE_RESULT]", true);
  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT] Le script onUse doit retourner true ou false.", { script: "pierre-magique.js", result: __add2eOnUseResult });
  ui.notifications?.error?.("Pierre Magique : le script onUse n'a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
