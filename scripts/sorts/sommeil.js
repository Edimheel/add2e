// Sommeil.js — ADD2E
// Magicien niveau 1
// Version : 2026-06-06-magicien-sommeil-time-engine-v1
// Retour attendu : true = consommé, false = non consommé.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][SOMMEIL]";

  function getDV(actor) {
    if (actor?.system?.hitDice) {
      const match = String(actor.system.hitDice).match(/^(\d+)/);
      if (match) return parseInt(match[1], 10);
    }

    if (["personnage", "pj", "pnj"].includes(String(actor?.type || "").toLowerCase())) {
      let niveau = 0;
      if (actor?.system?.details_classe) {
        for (const k in actor.system.details_classe) {
          const niv = Number(actor.system.details_classe[k]?.niveau || 0);
          if (niv > niveau) niveau = niv;
        }
      }
      niveau = niveau || Number(actor?.system?.niveau || actor?.system?.level || 0);
      if (niveau > 0) return niveau;
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

  function casterLevel(actorDoc) {
    return Number(
      actorDoc?.system?.niveau ??
      actorDoc?.system?.level ??
      actorDoc?.system?.details?.niveau ??
      actorDoc?.system?.details?.level ??
      1
    ) || 1;
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
    if (game.add2eSleepHooksRegistered === "2026-06-06-magicien-sommeil-time-engine-v1") return;
    game.add2eSleepHooksRegistered = "2026-06-06-magicien-sommeil-time-engine-v1";

    const endSleepVfx = effect => {
      const tags = effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? [];
      const list = Array.isArray(tags) ? tags : String(tags).split(/[,;|\n]+/);
      const isSleep = String(effect?.label || effect?.name || "").toLowerCase().includes("sommeil") || list.includes("sort:sommeil") || list.includes("etat:sommeil");
      if (!isSleep) return;
      const tokens = effect?.parent?.getActiveTokens?.() || [];
      for (const token of tokens) {
        try {
          if (typeof Sequencer !== "undefined") {
            Sequencer.EffectManager.endEffects({ name: `sleep-effect-${token.id}`, object: token });
          }
        } catch (e) {
          console.warn(`${TAG}[VFX_END_FAILED]`, e);
        }
      }
    };

    Hooks.on("deleteActiveEffect", endSleepVfx);
    Hooks.on("updateActiveEffect", (effect, changes) => {
      if (changes?.disabled === true) endSleepVfx(effect);
    });
  }

  function emitGmOperation(operation, payload) {
    game.socket?.emit?.("system.add2e", {
      type: "ADD2E_GM_OPERATION",
      operation,
      payload: {
        ...(payload ?? {}),
        fromUserId: game.user?.id ?? null,
        sentAt: Date.now()
      }
    });
  }

  async function createOrSocketEffect(targetToken, effectData) {
    const targetActor = targetToken.actor;
    if (!targetActor) return false;

    if (game.user.isGM || targetActor.isOwner) {
      const oldIds = Array.from(targetActor.effects ?? [])
        .filter(e => {
          const tags = e.flags?.add2e?.tags ?? [];
          return Array.isArray(tags) && (tags.includes("sort:sommeil") || tags.includes("etat:sommeil"));
        })
        .map(e => e.id)
        .filter(Boolean);
      if (oldIds.length) await targetActor.deleteEmbeddedDocuments("ActiveEffect", oldIds);
      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return true;
    }

    emitGmOperation("createActiveEffect", {
      actorId: targetActor.id,
      actorUuid: targetActor.uuid,
      sceneId: canvas.scene?.id,
      tokenId: targetToken.id,
      effectData
    });
    return true;
  }

  async function playSleepVfx(t) {
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
          .attachTo(t)
          .persist(true)
          .name(`sleep-effect-${t.id}`)
          .belowTokens(true)
          .scale(0.5)
          .opacity(0.6)
          .play();
        return;
      } catch (e) {
        console.warn(`${TAG}[VFX_FAILED]`, { file, error: e });
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

  registerSleepHooks();

  const level = casterLevel(caster);
  const rounds = sleepRounds(level);

  const refund = async (raison = "") => {
    if (raison) ui.notifications.warn(raison);
    try {
      if (sourceItem.type !== "sort") {
        const currentGlobal = await sourceItem.getFlag?.("add2e", "global_charges");
        if (currentGlobal !== undefined) await sourceItem.setFlag("add2e", "global_charges", Number(currentGlobal) + 1);
      }
    } catch (e) {
      console.warn(`${TAG}[REFUND_FAILED]`, e);
    }
  };

  const wg = globalThis.warpgate;
  const hasWarpGate = !!(game.modules.get("warpgate")?.active && wg?.crosshairs?.show);
  let center = null;

  if (hasWarpGate) {
    const cross = await wg.crosshairs.show({
      size: 3,
      icon: sourceItem.img || "icons/svg/sleep.svg",
      label: "Sommeil (3\" diam.)",
      drawIcon: true,
      drawOutline: true,
      interval: 1
    });

    if (!cross || cross.cancelled) {
      await refund("Annulé.");
      return false;
    }

    center = { x: cross.x, y: cross.y };
  }

  let targets = [];
  if (center) {
    const gridSize = canvas.grid?.size || 1;
    const maxDistPixels = 1.5 * gridSize;
    targets = canvas.tokens.placeables.filter(t => {
      if (!t.actor) return false;
      const dist = Math.hypot(t.center.x - center.x, t.center.y - center.y);
      return dist <= (maxDistPixels + (t.w / 4));
    });
  } else {
    targets = Array.from(game.user.targets ?? []);
  }

  if (!targets.length) {
    await refund("Personne dans la zone ou aucune cible sélectionnée.");
    return false;
  }

  const ordered = targets.map(t => {
    const dv = getDV(t.actor);
    const hdStr = t.actor?.system?.hitDice || "";
    return { token: t, actor: t.actor, dv, cat: getDVCategorie(dv, hdStr) };
  }).filter(o => o.dv > 0).sort((a, b) => a.dv - b.dv);

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
  const affectedTokens = [];
  const listResults = [];

  for (const entry of ordered) {
    const { token: targetToken, actor: cible, cat, dv } = entry;
    let status = "Endormi";
    let color = "#c0392b";

    const isImmune = cible.effects?.some(e => {
      const label = String(e.label || e.name || "").toLowerCase();
      const tags = e.flags?.add2e?.tags || [];
      return label.includes("immunité") || label.includes("sommeil") || tags.includes("immunite:sommeil");
    });

    let resistanceSommeil = null;
    if (typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.checkResistanceDetails === "function") {
      resistanceSommeil = Add2eEffectsEngine.checkResistanceDetails(cible, "sommeil", { chat: false });
    }

    if (resistanceSommeil?.resiste) {
      status = `Résistance raciale (${resistanceSommeil.jet}/${resistanceSommeil.pct}%)`;
      color = "#1f8f3a";
    } else if (cat === "HIGH") {
      status = `Trop puissant (${dv} DV)`;
      color = "#7f8c8d";
    } else if (isImmune) {
      status = "Immunisé";
      color = "#7f8c8d";
    } else if (count[cat] >= maxByCat[cat]) {
      status = "Épargné (quota)";
      color = "#2980b9";
    } else {
      count[cat]++;
      affectedTokens.push(targetToken);
    }

    listResults.push({ name: cible.name, status, color });
  }

  const rows = listResults.map(r => `
    <div style="display:flex;justify-content:space-between;border-bottom:1px dashed #eee;font-size:0.9em;">
      <span>${htmlEscape(r.name)}</span>
      <span style="font-weight:bold;color:${r.color};">${htmlEscape(r.status)}</span>
    </div>`).join("");

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `
    <div class="add2e-spell-card" style="border-radius:12px;box-shadow:0 4px 10px #715aab44;background:linear-gradient(135deg,#fdfbfd 0%,#f4efff 100%);border:1.5px solid #9373c7;overflow:hidden;padding:0;">
      <div style="background:linear-gradient(90deg,#6a3c99 0%,#8e44ad 100%);padding:8px;color:white;display:flex;align-items:center;gap:10px;">
        <img src="${htmlEscape(caster.img || 'icons/svg/mystery-man.svg')}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;">
        <div style="line-height:1.2;flex:1;">
          <div style="font-weight:bold;">${htmlEscape(caster.name)}</div>
          <div style="font-size:0.8em;opacity:0.9;">lance ${htmlEscape(sourceItem.name)}</div>
        </div>
        <img src="${htmlEscape(sourceItem.img || 'icons/svg/sleep.svg')}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
      </div>
      <div style="padding:10px;">
        <div style="background:#fff;border:1px solid #e0d4fc;border-radius:6px;padding:6px;margin-bottom:8px;">
          <div style="text-align:center;color:#6a3c99;font-weight:bold;border-bottom:1px solid #eee;margin-bottom:4px;">Résultat</div>
          ${rows || "<i>Aucune cible</i>"}
          <div style="font-size:0.85em;margin-top:6px;text-align:center;color:#6a3c99;"><b>Durée des effets posés :</b> ${rounds} round(s).</div>
        </div>
        <details style="background:#fff;border:1px solid #e0d4fc;border-radius:6px;">
          <summary style="cursor:pointer;color:#6a3c99;font-weight:600;padding:6px;">Détails</summary>
          <div style="padding:8px;font-size:0.85em;">${sourceItem.system?.description || "Description..."}</div>
        </details>
      </div>
    </div>`
  });

  for (const t of affectedTokens) {
    if (!t.actor) continue;
    const effectData = buildSleepEffect({ sourceItem, caster, targetActor: t.actor, rounds });
    await createOrSocketEffect(t, effectData);
    await playSleepVfx(t);
  }

  console.log(`${TAG}[END]`, { affected: affectedTokens.map(t => t.name), durationRounds: rounds });
  return true;
})();
