/**
 * ADD2E — Pierre Magique
 * Clerc niveau 1
 * Compatible Foundry V13/V14/V15.
 * Version : 2026-08-07-pierre-magique-resource-v2
 *
 * Le fichier d'origine indique durationRounds: 0.
 * La migration utilise donc le moteur de temps en durée spéciale, sans expiration automatique inventée.
 *
 * Contrat onUse : true = consommé ; false = non consommé.
 */

console.log("%c[ADD2E][PIERRE_MAGIQUE] 2026-08-07-pierre-magique-resource-v2", "color:#b88924;font-weight:bold;");

const __add2eOnUseResult = await (async () => {
  if (typeof globalThis.add2eDialogWait !== "function") {
    ui.notifications.error("Pierre Magique : l’API de fenêtre ADD2E est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications.error("Pierre Magique : les constructeurs de cartes ADD2E sont indisponibles.");
    return false;
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
      ?? ((typeof token !== "undefined" && token?.actor) ? token : null)
      ?? caster?.getActiveTokens?.()[0]
      ?? null;
  }

  function resourceEngine() {
    const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
    if (!engine || typeof engine.recoverResource !== "function") {
      throw new Error("Le domaine canonique ADD2E resource n’est pas disponible pour Pierre Magique.");
    }
    return engine;
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

  function magicStoneResource(caster, sourceItem, existing, qty) {
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
    return {
      id: `${existing.uuid ?? existing.id}:magic-stone-stack`,
      type: "generated-ammunition",
      label: existing.name,
      document: existing,
      actor: caster,
      item: existing,
      target: "quantity",
      get current() {
        return Math.max(0, Number(existing.system?.quantite ?? existing.system?.quantity ?? 0) || 0);
      },
      maximum: null,
      recovery: qty,
      source: {
        kind: "spell",
        id: String(sourceItem?.id ?? ""),
        uuid: String(sourceItem?.uuid ?? ""),
        name: String(sourceItem?.name ?? "Pierre Magique")
      },
      context: {
        consumer: "pierre-magique",
        casterId: String(caster?.id ?? ""),
        sourceItemId: String(sourceItem?.id ?? "")
      },
      write: next => existing.update({
        "system.quantite": next,
        "system.quantity": next,
        "system.tags": list,
        "system.description": "Pierres enchantées par le sort Pierre Magique. Durée spéciale, à suivre selon la règle validée par le MJ.",
        flags
      }, {
        add2eInternal: true,
        add2eReason: "magic-stone-resource-recovery",
        render: false
      })
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

    const existing = Array.from(caster.items ?? []).find(candidate =>
      candidate.type === "objet" && String(candidate.name ?? "").toLowerCase() === itemName.toLowerCase()
    );

    if (existing) {
      const recovered = await resourceEngine().recoverResource(
        magicStoneResource(caster, sourceItem, existing, qty),
        {
          amount: qty,
          reason: "magic-stone-created",
          consumer: "pierre-magique"
        }
      );
      if (!recovered.ok) throw new Error("La pile de pierres magiques n’a pas pu être augmentée.");
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
      .filter(effect => (effect.flags?.add2e?.tags ?? []).includes("sort:pierre_magique"))
      .map(effect => effect.id)
      .filter(Boolean);
    if (oldIds.length) await caster.deleteEmbeddedDocuments("ActiveEffect", oldIds);
    await caster.createEmbeddedDocuments("ActiveEffect", [data]);
    return true;
  }

  async function createChat({ caster, sourceItem, qty }) {
    const card = {
      actor: caster,
      title: sourceItem?.name ?? "Pierre Magique",
      icon: "fas fa-gem",
      variant: "spell",
      source: {
        name: caster?.name ?? "Lanceur",
        img: caster?.img ?? sourceItem?.img ?? "icons/svg/mystery-man.svg",
        type: "Sort divin"
      },
      rows: [
        { label: "Pierres créées", value: String(qty) },
        { label: "Dégâts", value: "1d4" },
        { label: "Durée", value: "Spéciale" }
      ],
      trustedBodyHtml: "<p>Les pierres créées sont des projectiles magiques. Aucune expiration automatique en rounds n’est appliquée tant que la durée exacte n’est pas validée dans le système.</p>",
      chatData: {
        speaker: ChatMessage.getSpeaker({ actor: caster })
      }
    };
    globalThis.add2eBuildChatCard(card);
    return globalThis.add2eCreateChatCard(card);
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

  const result = await globalThis.add2eDialogWait({
    add2eTheme: "parchment",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-pierre-magique-dialog"],
    window: { title: "Lancement : Pierre Magique" },
    content: `
      <form class="add2e-pierre-magique-form" style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">
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
        icon: "<i class='fas fa-gem'></i>",
        default: true,
        callback: (_event, button) => ({ qty: Number(button.form.elements.qty?.value || 3) })
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

  if (!result) return false;

  const qty = Math.max(1, Math.min(3, Math.floor(Number(result.qty) || 3)));

  await createOrUpdateStones({ caster, sourceItem, qty });
  await applyTrackingEffect(caster, trackingEffectData({ sourceItem, caster, qty }));

  try {
    const casterToken = casterTokenFor(caster);
    await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX?.(casterToken ?? caster, "divine");
    await globalThis.ADD2E_PLAY_SPELL_FX?.("pierre_magique", { casterToken });
  } catch (error) {
    console.warn("[ADD2E][PIERRE_MAGIQUE][VFX][IGNORED]", error);
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
