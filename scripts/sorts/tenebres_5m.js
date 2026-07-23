/**
 * ADD2E — Sort Ténèbres 5 m.
 * Compatible Foundry V13/V14/V15 — DialogV2 et sauvegardes canoniques.
 */

return await (async () => {
  const VERSION = "2026-07-23-dialog-v2-canonical-save-executor-v15";
  const sourceItem = (typeof item !== "undefined" && item)
    || (typeof sort !== "undefined" && sort)
    || (typeof spell !== "undefined" && spell)
    || (typeof args !== "undefined" && args?.[0]?.item)
    || null;
  if (!sourceItem) {
    ui.notifications.warn("Ténèbres : sort introuvable.");
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  const casterToken = canvas.tokens?.controlled?.find(tokenDoc => tokenDoc.actor?.id === caster?.id)
    ?? ((typeof token !== "undefined" && token?.actor?.id === caster?.id) ? token : null)
    ?? caster?.getActiveTokens?.()[0]
    ?? null;
  if (!caster || !casterToken) {
    ui.notifications.warn("Ténèbres : le lanceur doit avoir un token sur la scène.");
    return false;
  }

  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("Ténèbres : DialogV2 est indisponible.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications.error("Ténèbres : le constructeur commun des cartes de chat est indisponible.");
    return false;
  }

  const info = sourceItem.system ?? {};
  const casterLevel = Number(caster.system?.niveau) || 1;
  const durationRounds = Math.max(
    1,
    Math.trunc(Number(sourceItem.system?.duree?.rounds ?? 10) || 10) + casterLevel
  );
  const radiusMeters = 5;
  const spellLabel = "Ténèbres";
  const spellIcon = sourceItem.img || "icons/magic/unholy/projectile-smoke-black.webp";
  const durationData = {
    rounds: durationRounds,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };
  const lightConfig = {
    dim: radiusMeters,
    bright: 0,
    luminosity: -0.05,
    color: "#000000",
    alpha: 0.70,
    animation: { type: "none" }
  };

  if (!globalThis.add2eLightHookRegistered) {
    globalThis.add2eLightHookRegistered = true;

    const cleanUpLight = async effect => {
      const flagData = effect.flags?.add2e?.lightPayload;
      if (!flagData) return;

      if (flagData.type === "ambient" && flagData.lightId && canvas.scene) {
        try {
          await canvas.scene.deleteEmbeddedDocuments("AmbientLight", [flagData.lightId]);
          ui.notifications.info("La zone de ténèbres au sol s’est dissipée.");
        } catch (_error) {}
      }

      if (flagData.type === "token" && flagData.tokenId) {
        const targetToken = canvas.tokens?.get?.(flagData.tokenId)
          ?? canvas.tokens?.placeables?.find?.(entry => entry.id === flagData.tokenId)
          ?? null;
        if (targetToken && flagData.originalLight) {
          try {
            await targetToken.document.update({
              light: foundry.utils.deepClone(flagData.originalLight)
            });
            ui.notifications.info(`Les ténèbres autour de ${targetToken.name} se dissipent.`);
          } catch (_error) {}
        }
        if (flagData.blindEffectId) {
          const targetActor = targetToken?.actor
            ?? game.actors?.get?.(flagData.actorId)
            ?? null;
          if (targetActor) {
            try {
              await targetActor.deleteEmbeddedDocuments("ActiveEffect", [flagData.blindEffectId]);
            } catch (_error) {}
          }
        }
      }
    };

    Hooks.on("deleteActiveEffect", cleanUpLight);
    Hooks.on("updateActiveEffect", (effect, changes) => {
      if (changes.disabled === true) void cleanUpLight(effect);
    });
  }

  const choice = await DialogV2.wait({
    window: { title: "Lancement : Ténèbres 5 m" },
    position: { width: 380 },
    add2eTheme: "magic",
    add2eImg: spellIcon,
    content: `<form style="display:grid;gap:10px;font-family:var(--font-primary);">
      <div class="form-group">
        <label style="font-weight:800;">Cible du sort</label>
        <select name="mode" style="width:100%;">
          <option value="offensif">Créature ciblée</option>
          <option value="objet">Zone au sol</option>
        </select>
      </div>
      <p style="margin:0;font-size:.9em;">Crée une zone d’obscurité de ${radiusMeters} m de rayon. Une créature porteuse reste visible au centre ; une sauvegarde contre les sortilèges détermine si elle est aveuglée.</p>
    </form>`,
    buttons: [
      {
        action: "cast",
        label: "Lancer",
        icon: "fa-solid fa-hand-sparkles",
        default: true,
        callback: (_event, button) => ({
          mode: String(button.form?.elements?.mode?.value ?? "offensif")
        })
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "fa-solid fa-xmark",
        callback: () => null
      }
    ],
    rejectClose: false
  });
  if (!choice) return false;

  let cardTarget = null;
  let cardMessage = "";
  let saveResult = null;
  let createdLightId = null;
  let blindEffectId = null;

  if (choice.mode === "objet") {
    if (!game.modules.get("warpgate")?.active) {
      ui.notifications.error("Ténèbres : le module Warpgate est requis pour placer la zone au sol.");
      return false;
    }

    const crosshair = await warpgate.crosshairs.show({
      size: 1,
      icon: spellIcon,
      label: spellLabel
    });
    if (crosshair.cancelled) return false;

    const created = await canvas.scene.createEmbeddedDocuments("AmbientLight", [{
      x: crosshair.x,
      y: crosshair.y,
      config: lightConfig
    }]);
    createdLightId = created?.[0]?.id ?? null;
    if (!createdLightId) return false;

    await caster.createEmbeddedDocuments("ActiveEffect", [{
      name: `Sort : ${spellLabel} (Maintenu)`,
      img: spellIcon,
      origin: sourceItem.uuid,
      disabled: false,
      transfer: false,
      duration: durationData,
      flags: {
        add2e: {
          spell: "tenebres_5m",
          lightPayload: { type: "ambient", lightId: createdLightId }
        }
      }
    }]);

    cardMessage = `Une zone de ténèbres de ${radiusMeters} m de rayon est placée au sol.`;
  } else {
    const targets = Array.from(game.user?.targets ?? []).filter(target => target?.actor);
    if (targets.length !== 1) {
      ui.notifications.warn("Ténèbres : cible exactement une créature.");
      return false;
    }
    if (typeof globalThis.add2eRollSavingThrow !== "function") {
      ui.notifications.error("Ténèbres : l’exécuteur canonique de sauvegardes est indisponible.");
      return false;
    }

    const targetToken = targets[0];
    const targetActor = targetToken.actor;
    saveResult = await globalThis.add2eRollSavingThrow(targetActor, 4, {
      source: "spell:tenebres_5m",
      sourceItem,
      caster,
      casterLevel,
      targetToken,
      frontale: true,
      createChat: false,
      showDice: true
    });
    if (!saveResult?.ok) {
      ui.notifications.warn(`Ténèbres : aucune sauvegarde contre les sortilèges pour ${targetActor.name}.`);
      return false;
    }

    const blinded = !saveResult.success;
    saveResult.blinded = blinded;

    const originalLight = foundry.utils.deepClone(
      targetToken.document.light?.toObject?.()
        ?? targetToken.document.light
        ?? {}
    );
    await targetToken.document.update({ light: lightConfig });

    if (blinded) {
      const createdBlind = await targetActor.createEmbeddedDocuments("ActiveEffect", [{
        name: "Aveuglé (Ténèbres)",
        img: "icons/svg/daze.svg",
        origin: sourceItem.uuid,
        disabled: false,
        transfer: false,
        duration: durationData,
        changes: [{
          key: "system.conditions.blinded",
          mode: CONST.ACTIVE_EFFECT_MODES.ADD,
          value: true,
          priority: 20
        }],
        statuses: ["blinded"],
        flags: {
          add2e: {
            spell: "tenebres_5m",
            sourceItemUuid: sourceItem.uuid
          }
        }
      }]);
      blindEffectId = createdBlind?.[0]?.id ?? null;
    }

    await caster.createEmbeddedDocuments("ActiveEffect", [{
      name: `${spellLabel} sur ${targetToken.name}`,
      img: spellIcon,
      origin: sourceItem.uuid,
      disabled: false,
      transfer: false,
      duration: durationData,
      flags: {
        add2e: {
          spell: "tenebres_5m",
          lightPayload: {
            type: "token",
            tokenId: targetToken.id,
            actorId: targetActor.id,
            originalLight,
            blindEffectId
          }
        }
      }
    }]);

    cardTarget = {
      name: targetActor.name,
      img: targetActor.img,
      type: "Sauvegarde contre les sortilèges",
      meta: saveResult.resolution?.targetResolution?.selected?.className
        ?? saveResult.resolution?.targetResolution?.source
        ?? ""
    };
    cardMessage = blinded
      ? `${targetActor.name} est enveloppé par les ténèbres et aveuglé.`
      : `${targetActor.name} est enveloppé par les ténèbres mais résiste à l’aveuglement.`;
  }

  const rows = [
    { label: "Rayon", value: `${radiusMeters} m` },
    { label: "Durée", value: `${durationRounds} rounds` },
    { label: "Mode", value: choice.mode === "objet" ? "Zone au sol" : "Créature porteuse" }
  ];
  if (saveResult) {
    rows.push(
      { label: "D20", value: saveResult.d20 },
      { label: "Bonus de sauvegarde", value: `${saveResult.bonus >= 0 ? "+" : ""}${saveResult.bonus}` },
      { label: "Total", value: saveResult.total },
      { label: "Seuil", value: saveResult.target }
    );
  }

  const chatData = {
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
    flags: {
      add2e: {
        spell: "tenebres_5m",
        version: VERSION,
        mode: choice.mode,
        sourceItemUuid: sourceItem.uuid,
        ambientLightId: createdLightId,
        blindEffectId,
        saveType: saveResult?.resolution?.key ?? null,
        saveTarget: saveResult?.target ?? null,
        saveBonus: saveResult?.bonus ?? null,
        saveTotal: saveResult?.total ?? null,
        saveSuccess: saveResult?.success ?? null,
        saveResolverVersion: saveResult?.version ?? null
      }
    }
  };
  if (saveResult?.roll) chatData.rolls = [saveResult.roll];

  const options = {
    actor: caster,
    title: spellLabel,
    icon: "fas fa-circle-half-stroke",
    variant: saveResult?.blinded ? "failure" : "spell",
    source: {
      name: caster.name,
      img: caster.img,
      type: `Niveau ${casterLevel}`,
      meta: String(info.école ?? info.ecole ?? "Altération")
    },
    target: cardTarget,
    rows,
    message: cardMessage,
    chatData
  };

  const preview = globalThis.add2eBuildChatCard(options);
  if (!String(preview ?? "").trim()) throw new Error("Ténèbres : carte de chat vide.");
  await globalThis.add2eCreateChatCard(options);
  return true;
})();