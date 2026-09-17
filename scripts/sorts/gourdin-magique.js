// ADD2E — Gourdin magique
// Clerc niveau 1 — runtime spécialisé.
// Compatible Foundry V13/V14/V15.
// Contrat onUse : true = sort consommé ; false = sort non consommé.

const __add2eMagicClubResult = await (async () => {
  const VERSION = "2026-09-17-canonical-magic-club-v2";
  const NAME = "Gourdin Magique";
  const ICON = "systems/add2e/assets/icones/sorts/gourdin-magique.webp";
  const TAGS = Object.freeze([
    "sort:gourdin_magique",
    "arme:magique",
    "arme:gourdin",
    "bonus_touche:gourdin:1",
    "bonus_degats:gourdin:1",
    "degats:magiques",
    "cible:gourdin"
  ]);
  const RULE = "Transforme un gourdin ou bâton de bois en arme magique temporaire, plus efficace contre les créatures de petite ou moyenne taille.";

  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("Gourdin Magique : l’API de fenêtre ADD2E est indisponible.");
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Gourdin Magique : les constructeurs communs de cartes ADD2E sont indisponibles.");
  }

  const effectsEngine = globalThis.ADD2E_EFFECTS;
  if (!effectsEngine || typeof effectsEngine.normalizeTag !== "function") {
    throw new Error("Gourdin Magique : le moteur canonique ADD2E est indisponible.");
  }

  const sourceItem = (typeof sort !== "undefined" && sort)
    || (typeof item !== "undefined" && item)
    || (typeof spell !== "undefined" && spell)
    || (typeof args !== "undefined" && args?.[0]?.item)
    || (typeof this !== "undefined" && this?.documentName === "Item" ? this : null)
    || null;
  if (!sourceItem) {
    ui.notifications.error(`${NAME} : sort introuvable.`);
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications.error(`${NAME} : lanceur introuvable.`);
    return false;
  }

  function casterLevel() {
    if (sourceItem?.system?.isObjectPower === true) {
      const explicit = Number(sourceItem.system?.casterLevel);
      if (!Number.isInteger(explicit) || explicit < 1) {
        throw new Error(`${NAME} : niveau de lanceur explicite absent du pouvoir d’objet magique.`);
      }
      return explicit;
    }

    if (typeof globalThis.add2eCanActorUseSpell !== "function") {
      throw new Error(`${NAME} : le résolveur canonique de lancement des sorts est indisponible.`);
    }
    const access = globalThis.add2eCanActorUseSpell(caster, sourceItem);
    const level = Number(access?.actorLevel);
    if (access?.ok !== true || !Number.isInteger(level) || level < 1) {
      throw new Error(`${NAME} : niveau canonique du lanceur indisponible${access?.reason ? ` (${access.reason})` : ""}.`);
    }
    return level;
  }

  function normalizedTags() {
    return [...new Set(TAGS.map(tag => effectsEngine.normalizeTag(tag)).filter(Boolean))];
  }

  function timeApi() {
    return game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  }

  function durationData(rounds) {
    const time = timeApi();
    return time?.durationData?.(rounds) ?? {
      rounds,
      startRound: game.combat?.round ?? null,
      startTurn: game.combat?.turn ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    };
  }

  function timeFlags(rounds, weapon) {
    const tags = normalizedTags();
    const time = timeApi();
    return time?.flags?.({
      source: "gourdin-magique.js",
      rounds,
      unit: "round",
      endMessage: "L’enchantement de Gourdin Magique prend fin pour {actor}.",
      extra: {
        spellName: sourceItem.name ?? NAME,
        spellKey: "gourdin_magique",
        sourceItemUuid: sourceItem.uuid ?? null,
        casterId: caster.id ?? null,
        casterUuid: caster.uuid ?? null,
        weaponId: weapon?.id ?? null,
        weaponName: weapon?.name ?? null,
        tags,
        version: VERSION
      }
    }) ?? {
      timeEngine: { managed: true, unit: "round", totalRounds: rounds },
      roundEngine: {
        managed: true,
        unit: "round",
        totalRounds: rounds,
        endMessage: "L’enchantement de Gourdin Magique prend fin pour {actor}."
      },
      spellName: sourceItem.name ?? NAME,
      spellKey: "gourdin_magique",
      sourceItemUuid: sourceItem.uuid ?? null,
      casterId: caster.id ?? null,
      casterUuid: caster.uuid ?? null,
      weaponId: weapon?.id ?? null,
      weaponName: weapon?.name ?? null,
      tags,
      version: VERSION
    };
  }

  function effectData(rounds, weapon) {
    const flags = timeFlags(rounds, weapon);
    const tags = flags.tags ?? normalizedTags();
    return {
      name: weapon ? `${NAME} : ${weapon.name}` : NAME,
      img: sourceItem.img || ICON,
      icon: sourceItem.img || ICON,
      origin: sourceItem.uuid ?? null,
      disabled: false,
      transfer: false,
      duration: durationData(rounds),
      description: RULE,
      flags: {
        add2e: {
          ...flags,
          tags,
          effectTags: tags,
          spell: {
            slug: "gourdin_magique",
            name: sourceItem.name ?? NAME,
            level: Number(sourceItem.system?.niveau) || 1,
            casterId: caster.id ?? null,
            casterUuid: caster.uuid ?? null,
            weaponId: weapon?.id ?? null,
            weaponName: weapon?.name ?? null,
            durationRounds: rounds
          }
        }
      },
      changes: []
    };
  }

  async function applyEffect(data) {
    if (game.user?.isGM || caster.isOwner) {
      await caster.createEmbeddedDocuments("ActiveEffect", [data]);
      return true;
    }
    if (!game.socket?.emit) return false;
    game.socket.emit("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation: "createActiveEffect",
      payload: {
        actorUuid: caster.uuid,
        actorId: caster.id,
        effectData: data,
        fromUserId: game.user?.id ?? null,
        sentAt: Date.now()
      }
    });
    return true;
  }

  async function playVfx() {
    try {
      const casterToken = canvas.tokens?.controlled?.find(candidate => candidate?.actor?.id === caster.id)
        ?? caster.getActiveTokens?.()[0]
        ?? null;
      await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX?.(casterToken ?? caster, "divine");
    } catch (error) {
      console.warn("[ADD2E][GOURDIN_MAGIQUE][VFX_IGNORED]", error);
    }
  }

  async function createChat(weapon, rounds) {
    const card = {
      actor: caster,
      title: sourceItem.name ?? NAME,
      icon: "fas fa-wand-magic-sparkles",
      variant: "spell",
      source: {
        name: caster.name,
        img: caster.img,
        type: "Sort divin"
      },
      target: {
        name: weapon?.name ?? "Arme à définir par le MJ",
        img: weapon?.img ?? sourceItem.img ?? ICON,
        type: "Gourdin ou bâton de bois"
      },
      rows: [
        { label: "Arme", value: weapon?.name ?? "À définir par le MJ" },
        { label: "Durée", value: `${rounds} round(s)` },
        { label: "Bonus", value: "+1 au toucher et aux dégâts avec le gourdin enchanté" }
      ],
      trustedBodyHtml: `<p>${RULE}</p>`,
      chatData: {
        speaker: ChatMessage.getSpeaker({ actor: caster }),
        flags: {
          add2e: {
            chatCardType: "magic-club",
            sourceItemUuid: sourceItem.uuid ?? null,
            weaponId: weapon?.id ?? null,
            durationRounds: rounds,
            version: VERSION
          }
        }
      }
    };
    const preview = globalThis.add2eBuildChatCard(card);
    if (!String(preview ?? "").trim()) throw new Error(`${NAME} : carte ADD2E vide.`);
    await globalThis.add2eCreateChatCard(card);
  }

  const weapons = Array.from(caster.items ?? []).filter(candidate => {
    if (String(candidate?.type ?? "").toLowerCase() !== "arme") return false;
    const name = String(candidate.name ?? "").toLowerCase();
    return name.includes("gourdin") || name.includes("bâton") || name.includes("baton") || name.includes("massue");
  });
  const options = weapons
    .map(weapon => `<option value="${weapon.id}">${String(weapon.name ?? "Arme")}</option>`)
    .join("");

  const result = await globalThis.add2eDialogWait({
    add2eTheme: "parchment",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-magic-club-dialog"],
    window: { title: `Lancement : ${sourceItem.name ?? NAME}` },
    content: `
      <form class="add2e-magic-club-form">
        <div class="form-group">
          <label><b>Arme de bois :</b></label>
          <select name="weaponId" style="width:100%;">
            ${options || '<option value="">Aucune arme trouvée — effet déclaratif</option>'}
          </select>
        </div>
        <p class="hint">${RULE}</p>
      </form>`,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "<i class='fas fa-wand-magic-sparkles'></i>",
        default: true,
        callback: (_event, button) => ({
          weaponId: String(button.form?.elements?.weaponId?.value ?? "")
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
  if (!result) return false;

  const weapon = result.weaponId ? caster.items?.get?.(result.weaponId) ?? null : null;
  const level = casterLevel();
  const rounds = Math.max(1, level);
  const applied = await applyEffect(effectData(rounds, weapon));
  if (!applied) {
    ui.notifications.error(`${NAME} : impossible d’appliquer l’effet au lanceur.`);
    return false;
  }

  await playVfx();
  await createChat(weapon, rounds);
  return true;
})();

return __add2eMagicClubResult === true ? true : false;
