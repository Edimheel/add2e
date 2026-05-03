// Sommeil.js - AD&D2
// Correctif : résistance raciale / magique intégrée dans le message du sort.
// Ne modifie pas la mécanique d'application existante des effets.

function getDV(actor) {
  if (actor.system?.hitDice) {
    const match = String(actor.system.hitDice).match(/^(\d+)/);
    if (match) return parseInt(match[1], 10);
  }

  if (["personnage", "pj", "pnj"].includes((actor.type || "").toLowerCase())) {
    let niveau = 0;

    if (actor.system?.details_classe) {
      for (let k in actor.system.details_classe) {
        let niv = Number(actor.system.details_classe[k]?.niveau || 0);
        if (niv > niveau) niveau = niv;
      }
    }

    niveau = niveau || Number(actor.system.niveau || 0);
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

  let dvEff = dv + add;

  if (dvEff <= 1) return "1";
  if (dvEff <= 2) return "2";
  if (dvEff <= 3) return "3";
  if (dvEff <= 4) return "4";
  if (dvEff < 5) return "4+";

  return "HIGH";
}

function registerSleepHooks() {
  if (game.add2eSleepHooksRegistered) return;

  game.add2eSleepHooksRegistered = true;

  const endSleepVfx = (effect) => {
    if (!(effect.label || effect.name || "").toLowerCase().includes("sommeil")) return;

    const effActor = effect.parent;
    if (!effActor) return;

    const tokens = effActor.getActiveTokens?.() || [];

    for (const token of tokens) {
      const visName = `sleep-effect-${token.id}`;

      if (typeof Sequencer !== "undefined") {
        Sequencer.EffectManager.endEffects({
          name: visName,
          object: token
        });
      }
    }
  };

  Hooks.on("deleteActiveEffect", endSleepVfx);
  Hooks.on("updateActiveEffect", (e, c) => {
    if (c.disabled) endSleepVfx(e);
  });
}

(async () => {
  console.log("[ADD2E][SLEEP] Lancement (Mode Socket Restauré)");

  // ==============================================================
  // 1. INITIALISATION
  // ==============================================================
  let sourceItem = null;

  if (typeof sort !== "undefined" && sort) sourceItem = sort;
  else if (typeof item !== "undefined" && item) sourceItem = item;
  else if (typeof this !== "undefined" && this.documentName === "Item") sourceItem = this;
  if (!sourceItem && typeof spell !== "undefined") sourceItem = spell;

  if (!sourceItem) {
    ui.notifications.error("Sort introuvable.");
    return;
  }

  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem.parent;

  if (!caster) {
    ui.notifications.error("Lanceur introuvable.");
    return;
  }

  registerSleepHooks();

  const refund = async (raison = "") => {
    if (raison) ui.notifications.warn(raison);

    if (sourceItem.type !== "sort") {
      const currentGlobal = sourceItem.getFlag("add2e", "global_charges");

      if (currentGlobal !== undefined) {
        await sourceItem.setFlag("add2e", "global_charges", currentGlobal + 1);
      }
    }
  };

  // ==============================================================
  // 2. ZONE WARPGATE
  // ==============================================================
  const hasWarpGate = game.modules.get("warpgate")?.active && warpgate?.crosshairs?.show;
  let center = null;

  if (hasWarpGate) {
    const cross = await warpgate.crosshairs.show({
      size: 3,
      icon: sourceItem.img || "icons/svg/sleep.svg",
      label: "Sommeil (3\" diam.)",
      drawIcon: true,
      drawOutline: true,
      interval: 1
    });

    if (!cross || cross.cancelled) {
      await refund("Annulé.");
      return;
    }

    center = {
      x: cross.x,
      y: cross.y
    };
  }

  // ==============================================================
  // 3. CIBLES
  // ==============================================================
  let targets = [];

  if (center) {
    const gridSize = canvas.grid.size || 1;
    const radiusSquares = 1.5;
    const maxDistPixels = radiusSquares * gridSize;

    targets = canvas.tokens.placeables.filter(t => {
      if (!t.actor) return false;

      const dist = Math.hypot(t.center.x - center.x, t.center.y - center.y);
      return dist <= (maxDistPixels + (t.w / 4));
    });
  } else {
    targets = Array.from(game.user.targets);
  }

  if (!targets.length) {
    await refund("Personne dans la zone.");
    return;
  }

  // ==============================================================
  // 4. TRI DV
  // ==============================================================
  let ordered = targets.map(t => {
    let dv = getDV(t.actor);
    let hdStr = t.actor?.system?.hitDice || "";

    return {
      token: t,
      actor: t.actor,
      dv,
      cat: getDVCategorie(dv, hdStr)
    };
  })
  .filter(o => o.dv > 0)
  .sort((a, b) => a.dv - b.dv);

  if (!ordered.length) {
    ui.notifications.warn("Aucune cible valide.");
    return;
  }

  // ==============================================================
  // 5. JETS DU SORT
  // ==============================================================
  let n1 = (await new Roll("4d4").evaluate()).total;
  let n2 = (await new Roll("2d4").evaluate()).total;
  let n3 = (await new Roll("1d4").evaluate()).total;
  let n4 = Math.ceil((await new Roll("1d4").evaluate()).total / 2);

  let maxByCat = {
    "1": n1,
    "2": n2,
    "3": n3,
    "4": n4,
    "4+": 1,
    "HIGH": 0
  };

  let count = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "4+": 0,
    "HIGH": 0
  };

  let affectedTokens = [];
  let listResults = [];

  // ==============================================================
  // 6. RÉSOLUTION DES CIBLES
  // ==============================================================
  for (let entry of ordered) {
    const { token, actor: cible, cat, dv } = entry;

    let status = "Endormi";
    let color = "#c0392b";

    let isImmune = cible.effects.some(e =>
      (e.label || e.name || "").toLowerCase().includes("immunité")
    );

    // --------------------------------------------------------------
    // Résistance raciale / magique au sommeil
    // Le test est silencieux : aucun message séparé.
    // Le résultat est intégré dans le message principal du sort.
    // --------------------------------------------------------------
    let resistanceSommeil = null;

    if (
      typeof Add2eEffectsEngine !== "undefined" &&
      typeof Add2eEffectsEngine.checkResistanceDetails === "function"
    ) {
      resistanceSommeil = Add2eEffectsEngine.checkResistanceDetails(cible, "sommeil", {
        chat: false
      });
    }

    if (resistanceSommeil?.resiste) {
      status = `Résistance raciale (${resistanceSommeil.jet}/${resistanceSommeil.pct}%)`;
      color = "#1f8f3a";
    }
    else if (cat === "HIGH") {
      status = `Trop Puissant (${dv} DV)`;
      color = "#7f8c8d";
    }
    else if (isImmune) {
      status = "Immunisé";
      color = "#7f8c8d";
    }
    else if (count[cat] >= maxByCat[cat]) {
      status = "Épargné (Quota)";
      color = "#2980b9";
    }
    else {
      count[cat]++;
      affectedTokens.push(token);
    }

    listResults.push({
      name: cible.name,
      status,
      color
    });
  }

  // ==============================================================
  // 7. MESSAGE CHAT UNIQUE
  // ==============================================================
  const rows = listResults.map(r => `
    <div style="display:flex;justify-content:space-between;border-bottom:1px dashed #eee;font-size:0.9em;">
      <span>${r.name}</span>
      <span style="font-weight:bold;color:${r.color};">${r.status}</span>
    </div>
  `).join("");

  const chatHtml = `
  <div class="add2e-spell-card" style="border-radius:12px;box-shadow:0 4px 10px #715aab44;background:linear-gradient(135deg,#fdfbfd 0%,#f4efff 100%);border:1.5px solid #9373c7;overflow:hidden;padding:0;">
    <div style="background:linear-gradient(90deg,#6a3c99 0%,#8e44ad 100%);padding:8px;color:white;display:flex;align-items:center;gap:10px;">
      <img src="${caster.img}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;">
      <div style="line-height:1.2;flex:1;">
        <div style="font-weight:bold;">${caster.name}</div>
        <div style="font-size:0.8em;opacity:0.9;">lance ${sourceItem.name}</div>
      </div>
      <img src="${sourceItem.img}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
    </div>

    <div style="padding:10px;">
      <div style="background:#fff;border:1px solid #e0d4fc;border-radius:6px;padding:6px;margin-bottom:8px;">
        <div style="text-align:center;color:#6a3c99;font-weight:bold;border-bottom:1px solid #eee;margin-bottom:4px;">Résultat</div>
        ${rows || "<i>Aucune cible</i>"}
      </div>

      <details style="background:#fff;border:1px solid #e0d4fc;border-radius:6px;">
        <summary style="cursor:pointer;color:#6a3c99;font-weight:600;padding:6px;">Détails</summary>
        <div style="padding:8px;font-size:0.85em;">
          ${sourceItem.system?.description || "Description..."}
        </div>
      </details>
    </div>
  </div>`;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: chatHtml
  });

  // ==============================================================
  // 8. APPLICATION DES EFFETS
  // Mécanique conservée : socket système existant.
  // ==============================================================
  let jb2aPath = null;

  if (game.modules.get("jb2a_patreon")?.active) {
    jb2aPath = "modules/jb2a_patreon/Library/1st_Level/Sleep/Cloud01_01_Dark_OrangePurple_400x400.webm";
  }
  else if (game.modules.get("jb2a_free")?.active) {
    jb2aPath = "modules/jb2a_free/Library/1st_Level/Sleep/Cloud01_01_Dark_OrangePurple_400x400.webm";
  }

  for (let t of affectedTokens) {
    if (!t.actor) continue;

    const effectData = {
      name: "Sommeil",
      icon: "icons/svg/sleep.svg",
      duration: { rounds: 5 },
      flags: {
        add2e: {
          tags: ["etat:sommeil"]
        }
      },
      origin: sourceItem.uuid
    };

    // On conserve le fonctionnement existant :
    // le socket système applique l'effet côté MJ.
    if (game.socket) {
      console.log("[ADD2E] Emission socket pour", t.actor.name);

      game.socket.emit("system.add2e", {
        type: "applyActiveEffect",
        actorId: t.actor.id,
        effectData: effectData
      });
    } else {
      // Fallback GM
      await t.actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    }

    // VFX
    if (jb2aPath && typeof Sequence !== "undefined") {
      new Sequence()
        .effect()
        .file(jb2aPath)
        .attachTo(t)
        .persist(true)
        .name(`sleep-effect-${t.id}`)
        .belowTokens(true)
        .scale(0.5)
        .opacity(0.6)
        .play()
        .catch(e => {});
    }
  }

  console.log("[ADD2E][SLEEP] Terminé.");
})();