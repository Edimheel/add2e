// ADD2E — Foudre
// Compatible Foundry V13/V14/V15.
// Contrat onUse : true = sort consommé ; false = sort non consommé.

const __add2eLightningResult = await (async () => {
  const VERSION = "2026-08-12-canonical-lightning-v2";
  const DAMAGE_TYPE = "electricite";

  if (typeof globalThis.add2eRollSavingThrow !== "function") {
    ui.notifications?.error?.("Foudre : le résolveur canonique des jets de sauvegarde est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eApplyDamage !== "function") {
    ui.notifications?.error?.("Foudre : le résolveur canonique des dégâts est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications?.error?.("Foudre : les constructeurs communs de cartes ADD2E sont indisponibles.");
    return false;
  }

  const sourceItem = (typeof sort !== "undefined" && sort)
    || (typeof item !== "undefined" && item)
    || (typeof spell !== "undefined" && spell)
    || (typeof args !== "undefined" && args?.[0]?.item)
    || null;
  if (!sourceItem || String(sourceItem.type ?? "").toLowerCase() !== "sort") {
    ui.notifications?.error?.("Foudre : Item sort introuvable.");
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications?.error?.("Foudre : lanceur introuvable.");
    return false;
  }

  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster.id)
    ? token
    : canvas.tokens?.controlled?.find(placeable => placeable?.actor?.id === caster.id)
      ?? caster.getActiveTokens?.()[0]
      ?? null;
  if (!casterToken) {
    ui.notifications?.warn?.("Foudre : sélectionne le token du lanceur.");
    return false;
  }

  const resolveCasterLevel = () => {
    if (sourceItem.system?.isObjectPower === true) {
      const explicit = Number(sourceItem.system?.casterLevel);
      if (!Number.isInteger(explicit) || explicit < 1) {
        throw new Error("Foudre : niveau de lanceur explicite absent du pouvoir d’objet magique.");
      }
      return explicit;
    }
    const resolver = globalThis.add2eCanActorUseSpell;
    if (typeof resolver !== "function") {
      throw new Error("Foudre : le résolveur canonique de lancement des sorts est indisponible.");
    }
    const access = resolver(caster, sourceItem);
    const actorLevel = Number(access?.actorLevel);
    if (access?.ok !== true || !Number.isInteger(actorLevel) || actorLevel < 1) {
      throw new Error(`Foudre : niveau canonique du lanceur indisponible${access?.reason ? ` (${access.reason})` : ""}.`);
    }
    return actorLevel;
  };

  let casterLevel;
  try {
    casterLevel = resolveCasterLevel();
  } catch (error) {
    ui.notifications?.error?.(error?.message ?? "Foudre : niveau du lanceur indisponible.");
    return false;
  }

  const targets = Array.from(game.user?.targets ?? [])
    .filter(target => target?.actor && target.id !== casterToken.id);
  if (!targets.length) {
    ui.notifications?.warn?.("Foudre : cible les créatures prises dans la ligne de foudre.");
    return false;
  }

  const diceCount = Math.min(10, casterLevel);
  const formula = `${diceCount}d6`;
  const damageRoll = await new Roll(formula).evaluate();
  try {
    await game.dice3d?.showForRoll?.(damageRoll);
  } catch (_error) {}

  const saveResults = [];
  for (const targetToken of targets) {
    const save = await globalThis.add2eRollSavingThrow(targetToken.actor, "sorts", {
      source: "spell:foudre",
      sourceItem,
      caster,
      targetToken,
      createChat: false,
      showDice: true
    });
    if (!save?.ok) {
      ui.notifications?.error?.(`Foudre : jet de sauvegarde indisponible pour ${targetToken.name ?? targetToken.actor.name}.`);
      return false;
    }
    saveResults.push({ targetToken, save });
  }

  const applied = [];
  for (const { targetToken, save } of saveResults) {
    const resolution = await globalThis.add2eApplyDamage({
      cible: targetToken,
      montant: Number(damageRoll.total) || 0,
      type: DAMAGE_TYPE,
      details: `${sourceItem.name ?? "Foudre"} — décharge électrique`,
      sourceItem,
      lanceur: caster,
      save: {
        success: save.success === true,
        successMultiplier: 0.5,
        failureMultiplier: 1
      },
      actionTags: ["spell", "damage:electricite", "spell:foudre"]
    });
    const damage = Number(resolution?.amount);
    if (!resolution?.applied || !Number.isFinite(damage)) {
      ui.notifications?.error?.(`Foudre : impossible d’appliquer les dégâts à ${targetToken.name ?? targetToken.actor.name}.`);
      return false;
    }
    applied.push({ targetToken, save, damage });
  }

  try {
    await globalThis.ADD2E_PLAY_SPELL_FX?.("foudre", {
      casterToken,
      targetTokens: targets
    });
  } catch (_error) {}

  const rows = [
    { label: "Dégâts lancés", value: `${damageRoll.total} (${formula})` },
    ...applied.map(({ targetToken, save, damage }) => ({
      label: targetToken.name ?? targetToken.actor.name,
      value: `JP ${save.success ? "réussi" : "raté"} · ${damage} dégât${damage > 1 ? "s" : ""}`
    }))
  ];

  const card = {
    actor: caster,
    title: sourceItem.name ?? "Foudre",
    icon: "fas fa-bolt",
    variant: "damage",
    source: {
      name: caster.name,
      img: sourceItem.img ?? caster.img,
      type: "Sort profane",
      meta: `Niveau de lanceur ${casterLevel}`
    },
    target: {
      name: targets.map(target => target.name ?? target.actor.name).join(", "),
      img: targets.length === 1 ? targets[0].actor?.img : null,
      type: "Créatures dans la ligne",
      meta: ""
    },
    rows,
    message: "Chaque cible effectue son jet de protection contre les sorts ; une réussite réduit les dégâts de moitié.",
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls: [damageRoll, ...applied.map(entry => entry.save?.roll).filter(Boolean)],
      flags: {
        add2e: {
          chatCardType: "lightning-bolt",
          version: VERSION,
          sourceItemUuid: sourceItem.uuid ?? null,
          casterLevel,
          damageFormula: formula,
          damageTotal: Number(damageRoll.total) || 0,
          targetResults: applied.map(({ targetToken, save, damage }) => ({
            actorUuid: targetToken.actor?.uuid ?? null,
            tokenId: targetToken.id ?? null,
            saveSuccess: save.success === true,
            saveTotal: save.total ?? null,
            saveTarget: save.target ?? null,
            damage
          }))
        }
      }
    }
  };

  const preview = globalThis.add2eBuildChatCard(card);
  if (!String(preview ?? "").trim()) throw new Error("Foudre : carte de chat vide.");
  await globalThis.add2eCreateChatCard(card);
  return true;
})();

return __add2eLightningResult === true ? true : false;
