// ADD2E — onUse Magicien : Suggestion
// Version : 2026-07-26-suggestion-single-result-card-v2
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2.
// Retour attendu : true = sort/pouvoir consommé, false = coût restitué.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][SUGGESTION]";
  const spellDocument = (typeof sort !== "undefined" && sort)
    ? sort
    : ((typeof item !== "undefined" && item) ? item : null);
  const caster = (typeof actor !== "undefined" && actor) ? actor : spellDocument?.parent;

  if (!spellDocument || !caster) {
    ui.notifications.error("Suggestion : source ou lanceur introuvable.");
    return false;
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    ui.notifications.error("Suggestion : les constructeurs communs de cartes ADD2E sont indisponibles.");
    return false;
  }

  const norm = value => String(value ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "").replace(/[^a-z0-9:+*_.-]+/g, "_")
    .replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  const list = value => {
    if (value == null || value === "") return [];
    if (Array.isArray(value)) return value.flatMap(list);
    if (value instanceof Set) return [...value].flatMap(list);
    if (typeof value === "string") return value.split(/[,;|\n]+/g).map(entry => entry.trim()).filter(Boolean);
    return [value];
  };
  const number = (...values) => {
    for (const value of values) {
      if (value === undefined || value === null || value === "") continue;
      const result = Number(String(value).replace(",", "."));
      if (Number.isFinite(result)) return result;
    }
    return null;
  };
  const escape = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  const objectItemId = spellDocument.system?.sourceItemId
    ?? spellDocument.system?.sourceWeaponId
    ?? spellDocument.flags?.add2e?.sourceItemId;
  const objectItem = objectItemId ? caster.items?.get?.(objectItemId) ?? null : null;
  const powerIndex = Number(spellDocument.system?.powerIndex ?? spellDocument.flags?.add2e?.powerIndex);
  const rawPowers = objectItem?.system?.pouvoirs
    ?? objectItem?.system?.powers
    ?? objectItem?.system?.pouvoirsMagiques
    ?? objectItem?.system?.magicalPowers
    ?? [];
  const powers = Array.isArray(rawPowers)
    ? rawPowers
    : rawPowers && typeof rawPowers === "object" ? Object.values(rawPowers) : [];
  const sourcePower = Number.isInteger(powerIndex) ? powers[powerIndex] ?? null : null;
  const powerEffects = Array.isArray(sourcePower?.effects) ? sourcePower.effects : [];
  const suggestionEffect = powerEffects.find(effect => norm(effect?.type ?? effect?.kind) === "suggestion")
    ?? powerEffects.find(effect => norm(effect?.type ?? effect?.kind) === "linked_spell")
    ?? {};
  const parameters = sourcePower?.parameters && typeof sourcePower.parameters === "object"
    ? sourcePower.parameters
    : {};
  const sourceDocument = objectItem ?? spellDocument;
  const isObjectPower = spellDocument.system?.isObjectPower === true
    || spellDocument.system?.isPower === true
    || !!objectItem;

  const casterLevel = Math.max(1, Math.floor(number(
    spellDocument.system?.casterLevel,
    spellDocument.system?.niveauLanceur,
    spellDocument.system?.niveau_lanceur,
    spellDocument.flags?.add2e?.casterLevel,
    caster.system?.niveau,
    caster.system?.level,
    caster.system?.details?.niveau,
    1
  ) ?? 1));

  const selectedTargets = Array.from(game.user?.targets ?? []).filter(target => target?.actor);
  if (!selectedTargets.length) {
    ui.notifications.warn("Suggestion exige au moins une cible sélectionnée.");
    return false;
  }

  const configuredMaxTargets = number(parameters.maxTargets, suggestionEffect.maxTargets);
  const maximumTargets = Number.isFinite(configuredMaxTargets)
    ? Math.max(1, Math.floor(configuredMaxTargets))
    : (isObjectPower ? selectedTargets.length : 1);
  if (selectedTargets.length > maximumTargets) {
    ui.notifications.warn(`Suggestion accepte au maximum ${maximumTargets} cible(s) dans ce contexte.`);
    return false;
  }
  const targets = selectedTargets.slice(0, maximumTargets);

  const distanceValue = value => {
    if (value == null || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "object") return number(value.value, value.amount, value.distance, value.range);
    const match = String(value).match(/-?\d+(?:[.,]\d+)?/);
    return match ? Number(match[0].replace(",", ".")) : null;
  };
  const casterToken = (typeof token !== "undefined" && token)
    ? token
    : args?.[0]?.token
      ?? canvas?.tokens?.controlled?.find?.(entry => entry.actor?.id === caster.id)
      ?? caster.getActiveTokens?.()?.[0]
      ?? null;
  const measureDistance = targetToken => {
    if (!casterToken || !targetToken || casterToken === targetToken) return 0;
    try {
      const measured = Number(globalThis.add2eMeasureTokenGridDistance?.(casterToken, targetToken));
      if (Number.isFinite(measured)) return measured;
    } catch (_error) {}
    const source = casterToken.center ?? { x: casterToken.x ?? 0, y: casterToken.y ?? 0 };
    const target = targetToken.center ?? { x: targetToken.x ?? 0, y: targetToken.y ?? 0 };
    try {
      const measured = Number(canvas?.grid?.measurePath?.([source, target])?.distance);
      if (Number.isFinite(measured)) return measured;
    } catch (_error) {}
    const pixels = Math.hypot(Number(target.x) - Number(source.x), Number(target.y) - Number(source.y));
    const gridSize = Number(canvas?.scene?.grid?.size ?? canvas?.grid?.size ?? 1) || 1;
    const gridDistance = Number(canvas?.scene?.grid?.distance ?? 1) || 1;
    return pixels / gridSize * gridDistance;
  };
  const maximumRange = distanceValue(
    parameters.range
    ?? suggestionEffect.range
    ?? spellDocument.system?.portee
    ?? spellDocument.system?.portée
    ?? 3
  );
  if (Number.isFinite(maximumRange) && casterToken) {
    const outOfRange = targets.filter(target => Number(measureDistance(target)) > maximumRange);
    if (outOfRange.length) {
      ui.notifications.warn(`Cible(s) hors de portée de Suggestion : ${outOfRange.map(target => target.name).join(", ")}.`);
      return false;
    }
  }

  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("Suggestion : DialogV2 est indisponible.");
    return false;
  }
  const choice = await DialogV2.wait({
    window: { title: `Suggestion — ${sourceDocument.name}` },
    modal: true,
    rejectClose: false,
    content: `
      <form class="add2e-dialog add2e-suggestion-dialog" style="min-width:520px;padding:10px;display:grid;gap:10px;">
        <p style="margin:0;">Formulez la suggestion adressée à ${escape(targets.map(target => target.name).join(", "))}.</p>
        <div class="form-group" style="display:grid;gap:4px;">
          <label for="add2e-suggestion-text"><strong>Suggestion prononcée</strong></label>
          <textarea id="add2e-suggestion-text" name="suggestion" rows="4" required></textarea>
        </div>
        <label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" name="understands" checked> La cible comprend la langue employée.</label>
        <label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" name="reasonable" checked> La formulation semble raisonnable et n’ordonne pas directement une action nuisible.</label>
        <div class="form-group" style="display:grid;grid-template-columns:1fr 90px;align-items:center;gap:8px;">
          <label for="add2e-suggestion-save-modifier">Ajustement circonstanciel au jet de protection</label>
          <input id="add2e-suggestion-save-modifier" type="number" name="saveModifier" value="0" step="1">
        </div>
        <p style="margin:0;font-size:.85em;">Une suggestion particulièrement raisonnable peut recevoir un malus de −1, −2, etc. au jet de protection, selon le MD.</p>
      </form>`,
    buttons: [
      {
        action: "apply",
        label: "Prononcer la suggestion",
        icon: "fa-solid fa-comments",
        default: true,
        callback: (_event, button, dialog) => {
          const form = button?.form ?? dialog?.element?.querySelector?.("form");
          const suggestion = String(form?.querySelector?.('[name="suggestion"]')?.value ?? "").trim();
          if (!suggestion) {
            ui.notifications.warn("La suggestion doit être formulée.");
            return null;
          }
          return {
            suggestion,
            understands: form?.querySelector?.('[name="understands"]')?.checked === true,
            reasonable: form?.querySelector?.('[name="reasonable"]')?.checked === true,
            saveModifier: Number(form?.querySelector?.('[name="saveModifier"]')?.value ?? 0) || 0
          };
        }
      },
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ]
  });
  if (!choice) return false;

  const durationRounds = (() => {
    const raw = parameters.duration ?? suggestionEffect.duration;
    if (raw && typeof raw === "object") {
      const value = number(raw.value, raw.amount, raw.duration, raw.rounds);
      const unit = raw.unit ?? raw.units ?? raw.type ?? "round";
      const resolved = Number(game.add2e?.time?.toRounds?.(value, unit, { level: casterLevel }));
      if (Number.isFinite(resolved) && resolved > 0) return Math.max(1, Math.floor(resolved));
    }
    return Math.max(10, (6 + (6 * casterLevel)) * 10);
  })();

  const incomingLabel = result => String(result?.label ?? result?.details ?? "Défense passive").trim();
  const incomingDetail = result => {
    if (!result || result.kind === "none") return "";
    if (result.kind === "resistance") {
      const status = result.blocked ? "réussie" : "échouée";
      return `${incomingLabel(result)} ${Number(result.pct) || 0}% — jet ${Number(result.roll) || 0} : résistance ${status}`;
    }
    return incomingLabel(result);
  };

  const buildCard = async ({ results, invalidReason = "" }) => {
    const rolls = results.map(result => result.save?.roll).filter(Boolean);
    const rows = results.map(result => {
      const save = result.save;
      const passive = incomingDetail(result.incoming);
      let detail;
      if (result.outcome === "immune") {
        detail = `Immunité — ${passive || incomingLabel(result.resistance)} : effet annulé`;
      } else if (result.outcome === "resisted") {
        detail = `${passive || "Résistance réussie"} : effet annulé`;
      } else if (result.outcome === "racial") {
        detail = `Résistance au charme réussie (${Number(result.resistance?.jet) || 0}/${Number(result.resistance?.pct) || 0} %) : effet annulé`;
      } else if (result.outcome === "saved") {
        detail = `${passive ? `${passive} ; ` : ""}Sauvegarde réussie — ${save.total} contre ${save.target} : effet annulé`;
      } else if (result.outcome === "affected") {
        detail = `${passive ? `${passive} ; ` : ""}Sauvegarde échouée — suggestion active pour ${durationRounds} rounds`;
      } else {
        detail = invalidReason || "Aucun effet";
      }
      return { label: result.targetActor.name, value: detail };
    });
    const affected = results.some(result => result.outcome === "affected");
    const card = {
      actor: caster,
      title: sourceDocument.name || "Suggestion",
      icon: "fas fa-comments",
      variant: affected ? "ability" : "success",
      source: {
        name: caster.name,
        img: caster.img,
        type: isObjectPower ? "Pouvoir d’objet magique" : "Enchantement / Charme",
        meta: `Suggestion · portée ${Number.isFinite(maximumRange) ? maximumRange : 3}`
      },
      rows: [
        { label: "Formulation", value: choice.suggestion },
        { label: "Durée", value: `${durationRounds} rounds ADD2E` },
        { label: "Ajustement de sauvegarde", value: `${choice.saveModifier >= 0 ? "+" : ""}${choice.saveModifier}` },
        ...rows
      ],
      message: invalidReason || (affected
        ? "La suggestion est appliquée uniquement aux cibles dont toutes les défenses ont échoué."
        : "La suggestion n’affecte aucune cible."),
      chatData: {
        speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
        rolls,
        flags: {
          add2e: {
            spell: "suggestion",
            sourceItemUuid: sourceDocument.uuid ?? null,
            objectItemUuid: objectItem?.uuid ?? null,
            powerIndex: Number.isInteger(powerIndex) ? powerIndex : null,
            targetActorUuids: results.map(result => result.targetActor.uuid),
            suggestion: choice.suggestion,
            understands: choice.understands,
            reasonable: choice.reasonable,
            saveModifier: choice.saveModifier,
            durationRounds,
            singleResultCard: true,
            outcomes: results.map(result => ({
              actorUuid: result.targetActor.uuid,
              outcome: result.outcome,
              incomingKind: result.incoming?.kind ?? "none",
              incomingBlocked: result.incoming?.blocked === true
            }))
          }
        }
      }
    };
    const preview = globalThis.add2eBuildChatCard(card);
    if (!String(preview ?? "").trim()) throw new Error("Suggestion : carte de chat vide.");
    await globalThis.add2eCreateChatCard(card);
  };

  if (!choice.understands || !choice.reasonable) {
    const invalidReason = !choice.understands
      ? "La cible ne comprend pas la langue : la suggestion n’a aucun effet."
      : "La formulation est directement nuisible ou manifestement déraisonnable : le sort est annulé sans effet.";
    await buildCard({
      results: targets.map(targetToken => ({
        targetToken,
        targetActor: targetToken.actor,
        incoming: null,
        save: null,
        resistance: null,
        outcome: "invalid"
      })),
      invalidReason
    });
    return true;
  }

  if (typeof globalThis.add2eRollSavingThrow !== "function") {
    ui.notifications.error("Suggestion : l’exécuteur canonique de sauvegardes est indisponible.");
    return false;
  }

  const effectsEngine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  const resolveIncoming = globalThis.add2eResolveIncomingActiveEffect;
  const incomingTags = ["etat:suggestion", "suggestion", "mental", "charme", "sort:suggestion"];
  const prepared = [];

  for (const targetToken of targets) {
    const targetActor = targetToken.actor;
    const incoming = typeof resolveIncoming === "function"
      ? resolveIncoming(targetActor, {
          effect: null,
          data: null,
          tags: new Set(incomingTags),
          keys: new Set(["suggestion"]),
          name: "Suggestion"
        })
      : { blocked: false, kind: "none", pct: 0, roll: 0, label: "" };

    if (incoming?.blocked === true) {
      prepared.push({
        targetToken,
        targetActor,
        incoming,
        resistance: null,
        save: null,
        outcome: incoming.kind === "resistance" ? "resisted" : "immune"
      });
      continue;
    }

    const resistance = effectsEngine?.checkResistanceDetails?.(targetActor, "charme", { chat: false }) ?? null;
    if (resistance?.immunise === true) {
      prepared.push({ targetToken, targetActor, incoming, resistance, save: null, outcome: "immune" });
      continue;
    }
    if (resistance?.resiste === true) {
      prepared.push({ targetToken, targetActor, incoming, resistance, save: null, outcome: "racial" });
      continue;
    }

    const saveModifiers = choice.saveModifier === 0 ? [] : [{
      id: `${sourceDocument.id ?? "suggestion"}:${targetActor.id}:circumstance`,
      target: "sorts",
      value: choice.saveModifier,
      label: "Caractère raisonnable de la suggestion",
      source: "spell:suggestion"
    }];
    const save = await globalThis.add2eRollSavingThrow(targetActor, 4, {
      source: "spell:suggestion",
      sourceItem: sourceDocument,
      caster,
      targetToken,
      frontale: true,
      mental: true,
      effectType: "suggestion",
      tags: ["mental", "suggestion", "charme", ...list(parameters.targetAny ?? suggestionEffect.targetAny).map(norm)],
      saveModifiers,
      createChat: false,
      showDice: true
    });
    if (!save?.ok) {
      ui.notifications.error(`Suggestion : sauvegarde contre les sortilèges indisponible pour ${targetActor.name}.`);
      return false;
    }
    prepared.push({
      targetToken,
      targetActor,
      incoming,
      resistance,
      save,
      outcome: save.success ? "saved" : "affected"
    });
  }

  const applyEffect = async entry => {
    const { targetToken, targetActor } = entry;
    const effectKey = `${sourceDocument.uuid ?? sourceDocument.id}:${caster.uuid ?? caster.id}:suggestion`;
    const existingIds = Array.from(targetActor.effects ?? [])
      .filter(effect => String(effect.flags?.add2e?.suggestionKey ?? "") === effectKey)
      .map(effect => effect.id)
      .filter(Boolean);
    if ((game.user?.isGM || targetActor.isOwner) && existingIds.length) {
      await targetActor.deleteEmbeddedDocuments("ActiveEffect", existingIds, {
        add2eInternal: true,
        add2eReason: "replace-suggestion"
      });
    }

    const tags = ["etat:suggestion", "suggestion", "mental", "charme", "sort:suggestion"];
    const extraFlags = {
      suggestionKey: effectKey,
      sourceId: caster.id,
      sourceUuid: caster.uuid ?? null,
      sourceName: caster.name,
      sourceItemUuid: sourceDocument.uuid ?? null,
      objectItemUuid: objectItem?.uuid ?? null,
      powerIndex: Number.isInteger(powerIndex) ? powerIndex : null,
      suggestion: choice.suggestion,
      tags,
      effectTags: tags,
      incomingEffectResolutionBypass: true,
      incomingEffectPreResolved: true,
      rules: [{ type: "state_condition", condition: "suggestion", mental: true, instruction: choice.suggestion }]
    };
    const effectData = typeof game.add2e?.time?.effectData === "function"
      ? game.add2e.time.effectData({
          name: "Sous suggestion",
          img: sourceDocument.img || "icons/svg/aura.svg",
          origin: sourceDocument.uuid ?? null,
          rounds: durationRounds,
          unit: "round",
          description: choice.suggestion,
          tags,
          changes: [],
          source: isObjectPower ? "magic-item" : "spell",
          sourceItem: sourceDocument,
          extraFlags
        })
      : {
          name: "Sous suggestion",
          img: sourceDocument.img || "icons/svg/aura.svg",
          origin: sourceDocument.uuid ?? null,
          disabled: false,
          transfer: false,
          duration: {
            rounds: durationRounds,
            startRound: game.combat?.round ?? null,
            startTurn: game.combat?.turn ?? null,
            startTime: game.time?.worldTime ?? null,
            combat: game.combat?.id ?? null
          },
          description: choice.suggestion,
          changes: [],
          flags: { add2e: extraFlags }
        };

    if (game.user?.isGM || targetActor.isOwner) {
      if (typeof game.add2e?.time?.createTimedActiveEffect === "function") {
        await game.add2e.time.createTimedActiveEffect(targetActor, effectData, {
          add2eSkipIncomingEffectResolution: true,
          add2eInternal: true,
          add2eReason: "suggestion-pre-resolved"
        });
      } else {
        await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData], {
          add2eSkipIncomingEffectResolution: true,
          add2eInternal: true,
          add2eReason: "suggestion-pre-resolved"
        });
      }
      return true;
    }

    if (game.socket) {
      game.socket.emit("system.add2e", {
        type: "applyActiveEffect",
        actorId: targetActor.id,
        actorUuid: targetActor.uuid,
        sceneId: canvas.scene?.id,
        tokenId: targetToken.id,
        effectData,
        options: {
          add2eSkipIncomingEffectResolution: true,
          add2eInternal: true,
          add2eReason: "suggestion-pre-resolved"
        }
      });
      return true;
    }
    return false;
  };

  for (const entry of prepared) {
    if (entry.outcome !== "affected") continue;
    if (!await applyEffect(entry)) {
      ui.notifications.error(`Suggestion : impossible d’appliquer l’effet à ${entry.targetActor.name}.`);
      return false;
    }
  }

  await buildCard({ results: prepared });
  console.log(`${TAG}[RESOLVED]`, {
    caster: caster.name,
    source: sourceDocument.name,
    objectItem: objectItem?.name ?? null,
    targets: prepared.map(entry => ({
      name: entry.targetActor.name,
      outcome: entry.outcome,
      incomingKind: entry.incoming?.kind ?? "none",
      incomingBlocked: entry.incoming?.blocked === true
    })),
    durationRounds
  });
  return true;
})();
