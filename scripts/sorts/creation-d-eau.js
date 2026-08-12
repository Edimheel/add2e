/**
 * ADD2E — Création d’eau / Destruction d’eau
 * Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2 via l’API commune ADD2E.
 */

const __add2eOnUseResult = await (async () => {
  const VERSION = "2026-08-12-canonical-water-spell-v3";

  if (typeof globalThis.add2eDialogWait !== "function") {
    ui.notifications?.error?.("Création d’eau : l’API de fenêtre ADD2E est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications?.error?.("Création d’eau : les constructeurs de cartes ADD2E sont indisponibles.");
    return false;
  }

  const norm = value => String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "_")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  function resourceEngine() {
    const engine = globalThis.ADD2E_EFFECTS;
    if (!engine || typeof engine.recoverResource !== "function") {
      throw new Error("Le domaine canonique ADD2E resource n’est pas disponible pour Création d’eau.");
    }
    return engine;
  }

  function resolveMode(sourceItem) {
    const family = sourceItem?.flags?.add2e?.spellFamily ?? {};
    const kind = String(family.kind ?? "").trim().toLowerCase();
    const reversibleMode = String(family.reversibleMode ?? "").trim().toLowerCase();
    if (kind === "base") return "create";
    if (kind === "inverse" && reversibleMode === "inverse") return "destroy";
    if (sourceItem?.system?.isObjectPower === true) return "create";
    return null;
  }

  function resolveCasterLevel(caster, sourceItem) {
    if (sourceItem?.system?.isObjectPower === true) {
      const explicit = Number(sourceItem.system?.casterLevel);
      if (!Number.isInteger(explicit) || explicit < 1) {
        throw new Error("Création d’eau : niveau de lanceur explicite absent du pouvoir d’objet magique.");
      }
      return explicit;
    }
    const resolver = globalThis.add2eCanActorUseSpell;
    if (typeof resolver !== "function") {
      throw new Error("Création d’eau : le résolveur canonique de lancement des sorts est indisponible.");
    }
    const access = resolver(caster, sourceItem);
    const actorLevel = Number(access?.actorLevel);
    if (access?.ok !== true || !Number.isInteger(actorLevel) || actorLevel < 1) {
      throw new Error(`Création d’eau : niveau canonique du lanceur indisponible${access?.reason ? ` (${access.reason})` : ""}.`);
    }
    return actorLevel;
  }

  const sourceItem = (typeof sort !== "undefined" && sort)
    || (typeof item !== "undefined" && item)
    || (typeof spell !== "undefined" && spell)
    || (typeof args !== "undefined" && args?.[0]?.item)
    || null;
  if (!sourceItem || String(sourceItem.type ?? "").toLowerCase() !== "sort") {
    ui.notifications?.error?.("Création d’eau : Item sort introuvable.");
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications?.error?.("Création d’eau : lanceur introuvable.");
    return false;
  }

  const mode = resolveMode(sourceItem);
  if (!mode) {
    ui.notifications?.error?.("Création d’eau / Destruction d’eau : métadonnées canoniques de famille absentes ou incohérentes.");
    return false;
  }
  const modeLabel = mode === "destroy" ? "Destruction d’eau" : "Création d’eau";

  let level;
  try {
    level = resolveCasterLevel(caster, sourceItem);
  } catch (error) {
    ui.notifications?.error?.(error?.message ?? `${modeLabel} : niveau du lanceur indisponible.`);
    return false;
  }

  const maxLitres = level * 15;
  const maxOutres = Math.floor(maxLitres / 5);
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
        callback: (_event, button) => ({
          nbOutres: Number(button?.form?.elements?.nbOutres?.value ?? 0)
        })
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

  const nbOutres = Math.floor(Number(dialogResult.nbOutres));
  const litres = nbOutres * 5;
  if (!Number.isFinite(nbOutres) || nbOutres <= 0 || nbOutres > maxOutres || litres > maxLitres) {
    ui.notifications?.warn?.(`${modeLabel} : quantité invalide (maximum ${maxLitres} L).`);
    return false;
  }

  let itemCreated = null;
  let itemUpdated = null;
  if (mode === "create") {
    const itemName = "Outre d’eau (5 L)";
    const existing = caster.items?.find(entry => {
      if (String(entry?.type ?? "").toLowerCase() !== "objet") return false;
      const tags = Array.isArray(entry.system?.tags) ? entry.system.tags.map(norm) : [];
      return tags.includes("objet_outre_eau");
    }) ?? null;

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
            return Math.max(0, Number(existing.system?.quantite) || 0);
          },
          maximum: null,
          recovery: nbOutres,
          source: {
            kind: "spell",
            id: String(sourceItem.id ?? ""),
            uuid: String(sourceItem.uuid ?? ""),
            name: String(sourceItem.name ?? modeLabel)
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
        if (!recovered?.ok) throw new Error("La pile d’outres n’a pas pu être augmentée.");
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
          flags: {
            add2e: {
              createdBySpell: "Création d’eau",
              spellUuid: sourceItem.uuid ?? null,
              casterUuid: caster.uuid ?? null,
              volumeUnitaireLitres: 5,
              quantityAdded: nbOutres,
              litresAdded: litres,
              createdAt: Date.now()
            }
          }
        }]);
        itemCreated = created?.[0] ?? null;
      }
    } catch (_error) {
      ui.notifications?.error?.("Création d’eau : impossible de créer ou de mettre à jour les outres.");
      return false;
    }
    if (!itemCreated && !itemUpdated) return false;
  }

  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster.id)
    ? token
    : canvas.tokens?.controlled?.find(placeable => placeable?.actor?.id === caster.id)
      ?? caster.getActiveTokens?.()[0]
      ?? null;

  try {
    await globalThis.ADD2E_PLAY_SPELL_FX?.(mode === "destroy" ? "destruction_eau" : "aquagenese", {
      casterToken: casterToken ?? caster,
      jb2aOptions: { maxFiles: 1, scaleToObject: 1.25, opacity: 0.85 }
    });
  } catch (_error) {}

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
      img: sourceItem.img ?? caster.img ?? "icons/svg/mystery-man.svg",
      type: "Sort divin",
      meta: `Niveau de lanceur ${level}`
    },
    rows: [
      { label: "Quantité", value: `${litres} L (${nbOutres} outre(s))` },
      { label: "Maximum", value: `${maxLitres} L` },
      { label: "Inventaire", value: itemLine }
    ],
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: {
        add2e: {
          chatCardType: "create-destroy-water",
          version: VERSION,
          mode,
          casterLevel: level,
          litres,
          units: nbOutres,
          sourceItemUuid: sourceItem.uuid ?? null
        }
      }
    }
  };
  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error(`${modeLabel} : carte de chat vide.`);
  await globalThis.add2eCreateChatCard(card);

  return true;
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  ui.notifications?.error?.("Création d’eau : le script onUse n’a pas retourné true/false.");
  return false;
}

return __add2eOnUseResult;
