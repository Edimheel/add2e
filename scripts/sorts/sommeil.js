// Sommeil.js — ADD2E
// Magicien niveau 1
// Version : 2026-09-17-native-canvas-placement-v5
// Retour attendu : true = consommé, false = non consommé.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][SOMMEIL]";
  const VERSION = "2026-09-17-native-canvas-placement-v5";

  function getDV(actorDoc) {
    if (actorDoc?.system?.hitDice) {
      const match = String(actorDoc.system.hitDice).match(/^(\d+)/);
      if (match) return parseInt(match[1], 10);
    }

    const type = String(actorDoc?.type ?? "").toLowerCase();
    if (["personnage", "pj"].includes(type)) {
      const levels = Array.from(actorDoc?.items ?? [])
        .filter(itemDoc => String(itemDoc?.type ?? "").toLowerCase() === "classe")
        .map(itemDoc => Number(itemDoc?.system?.niveau))
        .filter(level => Number.isInteger(level) && level > 0);
      return levels.length ? Math.max(...levels) : 0;
    }

    if (type === "pnj") {
      const level = Number(actorDoc?.system?.niveau);
      return Number.isInteger(level) && level > 0 ? level : 0;
    }

    return 0;
  }

  function getDVCategorie(dv, hitDiceStr) {
    let add = 0;
    if (typeof hitDiceStr === "string") {
      if (hitDiceStr.includes("+1")) add = 0.25;
      if (hitDiceStr.includes("+2")) add = 0.5;
      if (hitDiceStr.includes("+3")) add = 0.75;
      if (hitDiceStr.includes("+4")) add = 0.99;
    }

    const dvEff = dv + add;
    if (dvEff <= 1) return "1";
    if (dvEff <= 2) return "2";
    if (dvEff <= 3) return "3";
    if (dvEff <= 4) return "4";
    if (dvEff < 5) return "4+";
    return "HIGH";
  }

  function htmlEscape(value) {
    const div = document.createElement("div");
    div.innerText = String(value ?? "");
    return div.innerHTML;
  }

  function getSourceItem() {
    if (typeof sort !== "undefined" && sort) return sort;
    if (typeof item !== "undefined" && item) return item;
    if (typeof spell !== "undefined" && spell) return spell;
    if (typeof this !== "undefined" && this?.documentName === "Item") return this;
    return null;
  }

  function casterLevel(actorDoc, sourceItem) {
    if (sourceItem?.system?.isObjectPower === true) {
      const explicit = Number(sourceItem.system?.casterLevel);
      if (!Number.isInteger(explicit) || explicit < 1) {
        throw new Error("Sommeil : niveau de lanceur explicite absent du pouvoir d’objet magique.");
      }
      return explicit;
    }

    const resolver = globalThis.add2eCanActorUseSpell;
    if (typeof resolver !== "function") {
      throw new Error("Sommeil : le résolveur canonique de lancement des sorts est indisponible.");
    }
    const access = resolver(actorDoc, sourceItem);
    const level = Number(access?.actorLevel);
    if (access?.ok !== true || !Number.isInteger(level) || level < 1) {
      throw new Error(`Sommeil : niveau canonique du lanceur indisponible${access?.reason ? ` (${access.reason})` : ""}.`);
    }
    return level;
  }

  function timeApi() {
    return game.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  }

  function sleepRounds(level) {
    const time = timeApi();
    return time?.toRounds?.("level*5", "round", { level }) ?? (Math.max(1, Number(level) || 1) * 5);
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

  function sleepTags(rounds) {
    return [
      "classe:magicien",
      "liste:magicien",
      "niveau:1",
      "sort:sommeil",
      "ecole:enchantement_charme",
      "etat:sommeil",
      "sommeil",
      "controle:inconscient",
      "duree:5_rounds_par_niveau",
      `duree_rounds:${rounds}`
    ];
  }

  function timeFlags({ sourceItem, caster, targetActor, rounds }) {
    const tags = sleepTags(rounds);
    const time = timeApi();
    return time?.flags?.({
      source: "sommeil.js",
      rounds,
      unit: "round",
      endMessage: "Le sommeil magique de {actor} prend fin.",
      extra: {
        spellName: "Sommeil",
        spellKey: "sommeil",
        spellList: "wizard",
        sourceItemUuid: sourceItem?.uuid ?? null,
        casterId: caster?.id ?? null,
        casterUuid: caster?.uuid ?? null,
        targetId: targetActor?.id ?? null,
        targetUuid: targetActor?.uuid ?? null,
        tags
      }
    }) ?? {
      timeEngine: { managed: true, unit: "round", totalRounds: rounds },
      roundEngine: { managed: true, unit: "round", totalRounds: rounds, endMessage: "Le sommeil magique de {actor} prend fin." },
      endMessage: "Le sommeil magique de {actor} prend fin.",
      spellName: "Sommeil",
      spellKey: "sommeil",
      spellList: "wizard",
      sourceItemUuid: sourceItem?.uuid ?? null,
      casterId: caster?.id ?? null,
      casterUuid: caster?.uuid ?? null,
      targetId: targetActor?.id ?? null,
      targetUuid: targetActor?.uuid ?? null,
      tags
    };
  }

  function registerSleepHooks() {
    game.add2e ??= {};
    if (game.add2e.sleepHooksVersion === VERSION) return;
    game.add2e.sleepHooksVersion = VERSION;

    const endSleepVfx = effect => {
      const tags = effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? [];
      const list = Array.isArray(tags) ? tags : String(tags).split(/[,;|\n]+/);
      const isSleep = String(effect?.label || effect?.name || "").toLowerCase().includes("sommeil")
        || list.includes("sort:sommeil")
        || list.includes("etat:sommeil");
      if (!isSleep) return;
      const tokens = effect?.parent?.getActiveTokens?.() || [];
      for (const tokenDoc of tokens) {
        try {
          if (typeof Sequencer !== "undefined") {
            Sequencer.EffectManager.endEffects({ name: `sleep-effect-${tokenDoc.id}`, object: tokenDoc });
          }
        } catch (error) {
          console.warn(`${TAG}[VFX_END_FAILED]`, error);
        }
      }
    };

    Hooks.on("deleteActiveEffect", endSleepVfx);
    Hooks.on("updateActiveEffect", (effect, changes) => {
      if (changes?.disabled === true) endSleepVfx(effect);
    });
  }

  function emitGmOperation(operation, payload) {
    if (!game.socket?.emit) return false;
    game.socket.emit("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation,
      payload: {
        ...(payload ?? {}),
        fromUserId: game.user?.id ?? null,
        sentAt: Date.now()
      }
    });
    return true;
  }

  async function createOrSocketEffect(targetToken, effectData) {
    const targetActor = targetToken.actor;
    if (!targetActor) return false;

    if (game.user.isGM || targetActor.isOwner) {
      const oldIds = Array.from(targetActor.effects ?? [])
        .filter(effect => {
          const tags = effect.flags?.add2e?.tags ?? [];
          return Array.isArray(tags) && (tags.includes("sort:sommeil") || tags.includes("etat:sommeil"));
        })
        .map(effect => effect.id)
        .filter(Boolean);
      if (oldIds.length) await targetActor.deleteEmbeddedDocuments("ActiveEffect", oldIds);
      const created = await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return Array.isArray(created) ? created.length > 0 : Boolean(created);
    }

    return emitGmOperation("createActiveEffect", {
      actorId: targetActor.id,
      actorUuid: targetActor.uuid,
      sceneId: canvas.scene?.id,
      tokenId: targetToken.id,
      effectData
    });
  }

  async function playSleepVfx(targetToken) {
    if (typeof Sequence === "undefined") return;

    const candidates = [];
    if (game.modules.get("jb2a_patreon")?.active) {
      candidates.push("modules/jb2a_patreon/Library/1st_Level/Sleep/Cloud01_01_Dark_OrangePurple_400x400.webm");
    }
    if (game.modules.get("jb2a_free")?.active) {
      candidates.push("modules/jb2a_free/Library/1st_Level/Sleep/Cloud01_01_Dark_OrangePurple_400x400.webm");
    }
    candidates.push("jb2a.sleep.01.dark_purple");

    for (const file of candidates) {
      try {
        await new Sequence()
          .effect()
          .file(file)
          .attachTo(targetToken)
          .persist(true)
          .name(`sleep-effect-${targetToken.id}`)
          .belowTokens(true)
          .scale(0.5)
          .opacity(0.6)
          .play();
        return;
      } catch (error) {
        console.warn(`${TAG}[VFX_FAILED]`, { file, error });
      }
    }
  }

  function buildSleepEffect({ sourceItem, caster, targetActor, rounds }) {
    const flags = timeFlags({ sourceItem, caster, targetActor, rounds });
    const tags = flags.tags ?? sleepTags(rounds);
    return {
      name: "Sommeil",
      img: sourceItem.img || "icons/svg/sleep.svg",
      icon: sourceItem.img || "icons/svg/sleep.svg",
      origin: sourceItem.uuid,
      disabled: false,
      transfer: false,
      duration: durationData(rounds),
      description: `La créature est plongée dans un sommeil magique pendant ${rounds} round(s), sauf réveil par les moyens prévus par la règle ou décision du MJ.`,
      flags: {
        add2e: {
          ...flags,
          tags,
          spell: {
            slug: "sommeil",
            name: "Sommeil",
            level: 1,
            school: "Enchantement/Charme",
            casterId: caster?.id ?? null,
            casterUuid: caster?.uuid ?? null,
            targetId: targetActor?.id ?? null,
            targetUuid: targetActor?.uuid ?? null,
            durationRounds: rounds
          }
        }
      },
      changes: []
    };
  }

  async function createResultCard({ caster, sourceItem, level, rounds, listResults, affectedTokens }) {
    if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
      throw new Error("Sommeil : les constructeurs communs de cartes ADD2E sont indisponibles.");
    }

    const resultHtml = listResults.map(entry => `
      <div style="display:flex;justify-content:space-between;gap:12px;border-bottom:1px dashed #bbb;padding:2px 0;">
        <span>${htmlEscape(entry.name)}</span>
        <strong style="color:${entry.color};">${htmlEscape(entry.status)}</strong>
      </div>`).join("");
    const description = sourceItem.system?.description || "Description indisponible.";
    const options = {
      actor: caster,
      title: sourceItem.name || "Sommeil",
      icon: "fas fa-bed",
      variant: "spell",
      source: {
        name: caster.name,
        img: sourceItem.img || caster.img,
        type: "Enchantement / Charme",
        meta: `Niveau de lanceur ${level}`
      },
      rows: [
        { label: "Durée", value: `${rounds} round(s)` },
        { label: "Cibles affectées", value: affectedTokens.length },
        { label: "Cibles évaluées", value: listResults.length }
      ],
      message: affectedTokens.length
        ? `${affectedTokens.map(tokenDoc => tokenDoc.name).join(", ")} ${affectedTokens.length > 1 ? "sont plongés" : "est plongé"} dans un sommeil magique.`
        : "Aucune cible n’est plongée dans le sommeil.",
      trustedBodyHtml: `
        <div class="add2e-sleep-results">
          ${resultHtml || "<em>Aucune cible.</em>"}
          <details style="margin-top:8px;">
            <summary>Détails du sort</summary>
            <div style="padding-top:6px;">${description}</div>
          </details>
        </div>`,
      chatData: {
        speaker: ChatMessage.getSpeaker({ actor: caster }),
        flags: {
          add2e: {
            chatCardType: "sleep-spell",
            spell: "sommeil",
            sourceItemUuid: sourceItem.uuid ?? null,
            casterLevel: level,
            durationRounds: rounds,
            affectedActorUuids: affectedTokens.map(tokenDoc => tokenDoc.actor?.uuid).filter(Boolean),
            version: VERSION
          }
        }
      }
    };

    const preview = globalThis.add2eBuildChatCard(options);
    if (!String(preview ?? "").trim()) throw new Error("Sommeil : carte ADD2E vide.");
    return globalThis.add2eCreateChatCard(options);
  }

  function sleepCanvasElement() {
    return canvas?.app?.canvas ?? canvas?.app?.view ?? null;
  }

  function sleepCanvasPointFromClient(event) {
    if (typeof canvas?.canvasCoordinatesFromClient !== "function") {
      throw new Error("Sommeil : conversion canonique des coordonnées canvas indisponible.");
    }
    return canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
  }

  function sleepPlacementDiameterClientPx(center, diameterCanvasPx) {
    if (typeof canvas?.clientCoordinatesFromCanvas !== "function") return null;
    const clientCenter = canvas.clientCoordinatesFromCanvas(center);
    const clientEdge = canvas.clientCoordinatesFromCanvas({
      x: center.x + (diameterCanvasPx / 2),
      y: center.y
    });
    const radius = Math.hypot(clientEdge.x - clientCenter.x, clientEdge.y - clientCenter.y);
    return Number.isFinite(radius) && radius > 0 ? radius * 2 : null;
  }

  async function chooseSleepCenter() {
    if (!canvas?.ready || !canvas?.scene) {
      throw new Error("Sommeil : aucun canvas de scène actif pour placer la zone.");
    }
    const view = sleepCanvasElement();
    if (!view) throw new Error("Sommeil : élément canvas introuvable.");

    const gridSize = Number(canvas.dimensions?.size ?? canvas.grid?.size);
    if (!Number.isFinite(gridSize) || gridSize <= 0) {
      throw new Error("Sommeil : taille de grille canonique indisponible.");
    }

    const diameterCanvasPx = gridSize * 3;
    const marker = document.createElement("div");
    marker.dataset.add2eSleepPlacement = "1";
    Object.assign(marker.style, {
      position: "fixed",
      zIndex: "100000",
      pointerEvents: "none",
      boxSizing: "border-box",
      border: "2px solid rgba(98, 72, 160, 0.95)",
      borderRadius: "50%",
      background: "rgba(98, 72, 160, 0.14)",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.55) inset",
      display: "none"
    });
    document.body.appendChild(marker);

    const previousCursor = view.style.cursor;
    view.style.cursor = "crosshair";
    ui.notifications.info("Sommeil : place le centre de la zone, clic gauche pour valider, clic droit ou Échap pour annuler.");

    return new Promise(resolve => {
      let finished = false;

      const cleanup = result => {
        if (finished) return;
        finished = true;
        view.removeEventListener("pointermove", onMove, true);
        view.removeEventListener("pointerdown", onPointerDown, true);
        view.removeEventListener("contextmenu", onContextMenu, true);
        window.removeEventListener("keydown", onKeyDown, true);
        view.style.cursor = previousCursor;
        marker.remove();
        resolve(result);
      };

      const updateMarker = event => {
        const point = sleepCanvasPointFromClient(event);
        const diameter = sleepPlacementDiameterClientPx(point, diameterCanvasPx);
        if (!diameter) return point;
        const clientCenter = canvas.clientCoordinatesFromCanvas(point);
        marker.style.width = `${diameter}px`;
        marker.style.height = `${diameter}px`;
        marker.style.left = `${clientCenter.x - diameter / 2}px`;
        marker.style.top = `${clientCenter.y - diameter / 2}px`;
        marker.style.display = "block";
        return point;
      };

      function onMove(event) {
        updateMarker(event);
      }

      function onPointerDown(event) {
        if (event.button !== 0 && event.button !== 2) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (event.button === 2) return cleanup(null);
        cleanup(updateMarker(event));
      }

      function onContextMenu(event) {
        event.preventDefault();
        event.stopPropagation();
        cleanup(null);
      }

      function onKeyDown(event) {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        cleanup(null);
      }

      view.addEventListener("pointermove", onMove, true);
      view.addEventListener("pointerdown", onPointerDown, true);
      view.addEventListener("contextmenu", onContextMenu, true);
      window.addEventListener("keydown", onKeyDown, true);
    });
  }

  console.log(`${TAG}[START]`);

  const sourceItem = getSourceItem();
  if (!sourceItem) {
    ui.notifications.error("Sommeil : sort introuvable.");
    return false;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;
  if (!caster) {
    ui.notifications.error("Sommeil : lanceur introuvable.");
    return false;
  }

  const effectsEngine = globalThis.ADD2E_EFFECTS;
  if (!effectsEngine) {
    throw new Error("Sommeil : le moteur canonique ADD2E est indisponible.");
  }
  if (typeof effectsEngine.rollResistanceDetails !== "function") {
    throw new Error("Sommeil : l’exécuteur canonique des résistances ADD2E est indisponible.");
  }

  registerSleepHooks();

  const level = casterLevel(caster, sourceItem);
  const rounds = sleepRounds(level);

  const refund = async (raison = "") => {
    if (raison) ui.notifications.warn(raison);
    try {
      if (sourceItem.type !== "sort") {
        const currentGlobal = await sourceItem.getFlag?.("add2e", "global_charges");
        if (currentGlobal !== undefined) await sourceItem.setFlag("add2e", "global_charges", Number(currentGlobal) + 1);
      }
    } catch (error) {
      console.warn(`${TAG}[REFUND_FAILED]`, error);
    }
  };

  let center;
  try {
    center = await chooseSleepCenter();
  } catch (error) {
    console.error(`${TAG}[PLACEMENT_ERROR]`, error);
    await refund(error?.message || "Placement de la zone de Sommeil impossible.");
    return false;
  }

  if (!center) {
    await refund("Annulé.");
    return false;
  }

  const gridSize = Number(canvas.dimensions?.size ?? canvas.grid?.size);
  const maxDistPixels = 1.5 * gridSize;
  const targets = canvas.tokens.placeables.filter(targetToken => {
    if (!targetToken.actor) return false;
    const dist = Math.hypot(targetToken.center.x - center.x, targetToken.center.y - center.y);
    return dist <= (maxDistPixels + (targetToken.w / 4));
  });

  if (!targets.length) {
    await refund("Personne dans la zone.");
    return false;
  }

  const ordered = targets.map(targetToken => {
    const dv = getDV(targetToken.actor);
    const hitDice = targetToken.actor?.system?.hitDice || "";
    return { token: targetToken, actor: targetToken.actor, dv, cat: getDVCategorie(dv, hitDice) };
  }).filter(entry => entry.dv > 0).sort((a, b) => a.dv - b.dv);

  if (!ordered.length) {
    await refund("Aucune cible valide.");
    return false;
  }

  const n1 = (await new Roll("4d4").evaluate()).total;
  const n2 = (await new Roll("2d4").evaluate()).total;
  const n3 = (await new Roll("1d4").evaluate()).total;
  const n4 = Math.ceil((await new Roll("1d4").evaluate()).total / 2);

  const maxByCat = { "1": n1, "2": n2, "3": n3, "4": n4, "4+": 1, HIGH: 0 };
  const count = { "1": 0, "2": 0, "3": 0, "4": 0, "4+": 0, HIGH: 0 };
  const pendingTargets = [];
  const affectedTokens = [];
  const listResults = [];

  for (const entry of ordered) {
    const { token: targetToken, actor: cible, cat, dv } = entry;
    let status = "Endormi";
    let color = "#c0392b";

    const resistanceSommeil = await effectsEngine.rollResistanceDetails(cible, "sommeil", {
      chat: false,
      showDice: true
    });

    if (resistanceSommeil?.immunise) {
      status = "Immunisé";
      color = "#7f8c8d";
    } else if (resistanceSommeil?.resiste) {
      status = `Résistance raciale (${resistanceSommeil.jet}/${resistanceSommeil.pct}%)`;
      color = "#1f8f3a";
    } else if (cat === "HIGH") {
      status = `Trop puissant (${dv} DV)`;
      color = "#7f8c8d";
    } else if (count[cat] >= maxByCat[cat]) {
      status = "Épargné (quota)";
      color = "#2980b9";
    } else {
      count[cat]++;
    }

    const resultEntry = { name: cible.name, status, color };
    listResults.push(resultEntry);
    if (status === "Endormi") pendingTargets.push({ targetToken, resultEntry });
  }

  for (const { targetToken, resultEntry } of pendingTargets) {
    if (!targetToken.actor) continue;
    const effectData = buildSleepEffect({ sourceItem, caster, targetActor: targetToken.actor, rounds });
    const applied = await createOrSocketEffect(targetToken, effectData);
    if (!applied) {
      resultEntry.status = "Effet bloqué";
      resultEntry.color = "#7f8c8d";
      continue;
    }
    affectedTokens.push(targetToken);
    await playSleepVfx(targetToken);
  }

  await createResultCard({ caster, sourceItem, level, rounds, listResults, affectedTokens });

  console.log(`${TAG}[END]`, { affected: affectedTokens.map(targetToken => targetToken.name), durationRounds: rounds });
  return true;
})();