
// Généré pour ADD2E — Clerc niveau 1
// Compatible Foundry V13, préparé V14.
// Contrat moteur : return false = le sort n'est pas consommé ; return true = le sort est lancé.

const ADD2E_CLERIC_ONUSE_CONFIG = {
  "kind": "detection",
  "durationRounds": "10+5*level",
  "targetLabel": "Émanations",
  "fields": [
    {
      "name": "mode",
      "label": "Mode",
      "type": "select",
      "options": [
        {
          "value": "mal",
          "label": "Détection du mal"
        },
        {
          "value": "bien",
          "label": "Inverse : détection du bien"
        }
      ]
    },
    {
      "name": "direction",
      "label": "Direction / zone observée",
      "type": "text",
      "value": "devant le lanceur"
    }
  ],
  "tags": [
    "sort:detection_du_mal",
    "detection:mal",
    "reversible:detection_du_bien",
    "aura:alignement"
  ],
  "rule": "Détecte les émanations du mal provenant de créatures ou objets. Révèle le degré et la nature générale du mal. Inverse : détection du bien.",
  "name": "Détection du mal",
  "slug": "detection-du-mal",
  "imgFallback": "systems/add2e/assets/icones/sorts/detection-du-mal.webp"
};

const __add2eOnUseResult = await (async () => {
  const CFG = ADD2E_CLERIC_ONUSE_CONFIG;

  const ADD2E_CLERIC_CHAT = {
    main: "#b88924",
    dark: "#6f4b12",
    pale: "#fff7df",
    pale2: "#fffaf0",
    border: "#e2bc63",
    borderDark: "#8a611d",
    success: "#2f8f46",
    fail: "#b33a2e",
    warn: "#b88924",
    muted: "#6b5a35"
  };

  function add2eEscapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function add2eNormalizeTag(tag) {
    if (typeof Add2eEffectsEngine !== "undefined" && Add2eEffectsEngine?.normalizeTag) {
      return Add2eEffectsEngine.normalizeTag(tag);
    }
    return String(tag ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/\s+/g, "_");
  }

  function add2eSpellImg(src, fallback = "icons/magic/holy/prayer-hands-glowing-yellow.webp") {
    return add2eEscapeHtml(src || fallback);
  }

  function add2eChatStyleData() {
    if (CONST.CHAT_MESSAGE_STYLES) return { style: CONST.CHAT_MESSAGE_STYLES.OTHER };
    return { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
  }

  async function add2eCreateChat({ caster, sourceItem, title, subtitle = "Sort divin", targetLabel = "—", resultHtml = "", detailsHtml = "" }) {
    const casterName = add2eEscapeHtml(caster?.name ?? "Lanceur");
    const spellName = add2eEscapeHtml(title || sourceItem?.name || CFG.name || "Sort");
    const targetText = add2eEscapeHtml(targetLabel || "—");

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      content: `
        <div class="add2e-spell-card add2e-spell-card-clerc" style="
          border-radius:12px;box-shadow:0 4px 10px #0002;
          background:linear-gradient(135deg,${ADD2E_CLERIC_CHAT.pale2} 0%,${ADD2E_CLERIC_CHAT.pale} 100%);
          border:1.5px solid ${ADD2E_CLERIC_CHAT.border};overflow:hidden;padding:0;font-family:var(--font-primary);">
          <div style="background:linear-gradient(90deg,${ADD2E_CLERIC_CHAT.dark} 0%,${ADD2E_CLERIC_CHAT.main} 100%);padding:8px 12px;color:white;display:flex;align-items:center;gap:10px;border-bottom:2px solid ${ADD2E_CLERIC_CHAT.borderDark};">
            <img src="${add2eSpellImg(caster?.img, "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
            <div style="line-height:1.2;flex:1;">
              <div style="font-weight:bold;font-size:1.05em;">${casterName}</div>
              <div style="font-size:0.85em;opacity:0.95;">lance <b>${spellName}</b></div>
            </div>
            <div style="text-align:right;font-size:0.78em;opacity:0.95;">${add2eEscapeHtml(subtitle)}</div>
            <img src="${add2eSpellImg(sourceItem?.img || CFG.imgFallback)}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
          </div>
          <div style="padding:10px;">
            <div style="margin-bottom:6px;font-size:0.95em;color:${ADD2E_CLERIC_CHAT.dark};"><b>Cible :</b> ${targetText}</div>
            ${resultHtml}
            <details style="margin-top:8px;background:white;border:1px solid ${ADD2E_CLERIC_CHAT.border};border-radius:6px;">
              <summary style="cursor:pointer;color:${ADD2E_CLERIC_CHAT.dark};font-weight:600;padding:6px;">Règle appliquée</summary>
              <div style="padding:8px;font-size:0.85em;line-height:1.45;color:${ADD2E_CLERIC_CHAT.dark};">
                ${detailsHtml || add2eEscapeHtml(CFG.rule || sourceItem?.system?.description || "")}
              </div>
            </details>
          </div>
        </div>`,
      ...add2eChatStyleData()
    });
  }


  async function add2ePlayVfx(target, preset = "divine") {
    try {
      if (globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX) {
        await globalThis.ADD2E_CLERC_PLAY_LAUNCH_FX(target, preset);
      }

      let tokenObj = target;
      if (target?.documentName === "Actor") tokenObj = target.getActiveTokens?.()[0] ?? null;
      if (!tokenObj || !tokenObj.center || !canvas?.ready) return;

      const point = tokenObj.center;

      // VFX natif Foundry uniquement : aucun appel Sequencer/JB2A ici.
      // Cela évite l'erreur Sequencer "baseTexture" quand un asset JB2A est absent.
      try {
        if (typeof canvas.ping === "function") {
          canvas.ping(point, {
            style: "pulse",
            color: "#b88924",
            size: 96,
            duration: 700
          });
        } else if (typeof canvas.controls?.ping === "function") {
          canvas.controls.ping(point, {
            style: "pulse",
            color: "#b88924",
            size: 96,
            duration: 700
          });
        }
      } catch (e) {}

      try {
        if (canvas.interface?.createScrollingText) {
          canvas.interface.createScrollingText(point, "✦", {
            anchor: CONST.TEXT_ANCHOR_POINTS?.CENTER ?? 0,
            direction: CONST.TEXT_ANCHOR_POINTS?.TOP ?? 1,
            distance: 0.8,
            fontSize: 28,
            fill: "#f5d37a",
            stroke: "#3a2608",
            strokeThickness: 4,
            duration: 900
          });
        }
      } catch (e) {}
    } catch (e) {
      console.warn(`[ADD2E][${CFG.slug || CFG.name}] VFX natif impossible`, e);
    }
  }

  function add2eGetSourceItem() {
    let sourceItem = null;
    if (typeof sort !== "undefined" && sort) sourceItem = sort;
    else if (typeof item !== "undefined" && item) sourceItem = item;
    else if (typeof this !== "undefined" && this?.documentName === "Item") sourceItem = this;
    else if (typeof spell !== "undefined" && spell) sourceItem = spell;
    if ((!sourceItem || !sourceItem.system) && typeof args !== "undefined" && args?.[0]?.item) sourceItem = args[0].item;
    if (!sourceItem && typeof arguments !== "undefined" && arguments.length > 1 && arguments[1]?.name) sourceItem = arguments[1];
    return sourceItem;
  }

  function add2eGetCaster(sourceItem) {
    return (typeof actor !== "undefined" && actor) ? actor : sourceItem?.parent;
  }

  function add2eGetCasterToken(caster) {
    return canvas.tokens?.controlled?.[0]
      ?? ((typeof token !== "undefined" && token) ? token : null)
      ?? caster?.getActiveTokens?.()[0]
      ?? null;
  }

  function add2eDurationData(rounds) {
    if (!Number.isFinite(Number(rounds)) || Number(rounds) <= 0) return {};
    return {
      rounds: Number(rounds),
      startRound: game.combat?.round ?? null,
      startTurn: game.combat?.turn ?? null,
      startTime: game.time.worldTime
    };
  }

  function add2eGetLevel(actorDoc) {
    if (!actorDoc) return 1;
    if (typeof Add2eEffectsEngine !== "undefined" && Add2eEffectsEngine?.getActorLevel) return Add2eEffectsEngine.getActorLevel(actorDoc);
    const candidates = [
      actorDoc.system?.niveau,
      actorDoc.system?.level,
      actorDoc.system?.details?.niveau,
      actorDoc.system?.details?.level
    ];
    for (const v of candidates) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 1;
  }

  function add2eRounds(formula, level) {
    if (formula === null || formula === undefined || formula === "") return 0;
    if (typeof formula === "number") return formula;
    const lvl = Math.max(1, Number(level) || 1);
    switch (String(formula)) {
      case "level": return lvl;
      case "level*3": return lvl * 3;
      case "level*4": return lvl * 4;
      case "level*10": return lvl * 10;
      case "10+level": return 10 + lvl;
      case "2+level": return 2 + lvl;
      case "10+5*level": return 10 + (5 * lvl);
      case "min10_level*10": return Math.max(10, lvl * 10);
      default: return Number(formula) || 0;
    }
  }

  function add2eAEAddChange(key, value, priority = 20) {
    if (CONST.ACTIVE_EFFECT_CHANGE_TYPES) return { key, type: "add", phase: "final", value: String(value), priority };
    return { key, mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: String(value), priority };
  }

  function add2eMakeChanges(rawChanges = []) {
    return rawChanges.map(c => add2eAEAddChange(c.key, c.value, c.priority ?? 20));
  }

  function add2eEmitGMOperation(operation, payload) {
    if (!game.socket) return false;
    const message = {
      type: "ADD2E_GM_OPERATION",
      operation,
      payload: { ...(payload ?? {}), fromUserId: game.user.id, sentAt: Date.now() }
    };
    console.log(`[ADD2E][${CFG.slug || CFG.name}][GM-RELAY] emit`, message);
    game.socket.emit("system.add2e", message);
    return true;
  }

  async function add2eCreateEffectOnActor(actorDoc, effectData, options = {}) {
    if (!actorDoc) return false;

    if (options.removeTags?.length && (game.user.isGM || actorDoc.isOwner)) {
      const wanted = options.removeTags.map(add2eNormalizeTag);
      const ids = actorDoc.effects.filter(e => {
        const tags = (e.flags?.add2e?.tags ?? e.getFlag?.("add2e", "tags") ?? []).map(add2eNormalizeTag);
        return wanted.some(t => tags.includes(t));
      }).map(e => e.id).filter(Boolean);
      if (ids.length) await actorDoc.deleteEmbeddedDocuments("ActiveEffect", ids);
    }

    if (game.user.isGM || actorDoc.isOwner) {
      await actorDoc.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return true;
    }

    const emitted = add2eEmitGMOperation("createActiveEffect", {
      actorUuid: actorDoc.uuid,
      actorId: actorDoc.id,
      effectData
    });

    if (!emitted) {
      ui.notifications.error(`${CFG.name} : socket indisponible, impossible de demander l’effet au MJ.`);
      return false;
    }

    return true;
  }

  function add2eTokensAuContact(a, b) {
    if (!a || !b || a.id === b.id) return true;
    const gridSize = canvas.grid?.size || 100;
    const aLeft = a.document.x / gridSize;
    const aTop = a.document.y / gridSize;
    const aRight = aLeft + (a.document.width || 1);
    const aBottom = aTop + (a.document.height || 1);
    const bLeft = b.document.x / gridSize;
    const bTop = b.document.y / gridSize;
    const bRight = bLeft + (b.document.width || 1);
    const bBottom = bTop + (b.document.height || 1);
    const gapX = Math.max(0, bLeft - aRight, aLeft - bRight);
    const gapY = Math.max(0, bTop - aBottom, aTop - bBottom);
    return gapX <= 0.01 && gapY <= 0.01;
  }

  function add2eDistanceMeters(tokenA, tokenB) {
    try {
      if (!tokenA || !tokenB) return 0;
      const gridSize = canvas.grid?.size || 100;
      const gridDistance = Number(canvas.scene?.grid?.distance) || 1;

      if (typeof canvas.grid?.measurePath === "function") {
        const result = canvas.grid.measurePath([
          { x: tokenA.center.x, y: tokenA.center.y },
          { x: tokenB.center.x, y: tokenB.center.y }
        ]);
        const measured = Number(result?.distance) || Number(result?.cost) || Number(result?.segments?.[0]?.distance) || 0;
        if (measured > 0) return measured;
      }

      if (typeof canvas.grid?.measureDistances === "function") {
        const distance = canvas.grid.measureDistances([{ ray: new Ray(tokenA.center, tokenB.center) }], { gridSpaces: true })[0];
        return Number(distance) || 0;
      }

      const dx = tokenA.center.x - tokenB.center.x;
      const dy = tokenA.center.y - tokenB.center.y;
      return Math.hypot(dx, dy) / gridSize * gridDistance;
    } catch (e) {
      console.warn(`[ADD2E][${CFG.slug || CFG.name}] mesure distance impossible`, e);
      return 0;
    }
  }

  async function add2eDialog({ title, content, buttons }) {
    const DialogV2 = foundry.applications?.api?.DialogV2;
    if (DialogV2) {
      return await DialogV2.wait({
        window: { title },
        content,
        buttons,
        rejectClose: false
      });
    }

    return await new Promise(resolve => {
      const dialogButtons = {};
      for (const b of buttons) {
        dialogButtons[b.action] = {
          label: b.label,
          icon: b.icon,
          callback: html => {
            const form = html[0]?.querySelector?.("form") ?? html.find?.("form")?.[0];
            const fakeButton = { form };
            resolve(b.callback?.(null, fakeButton) ?? null);
          }
        };
      }
      new Dialog({ title, content, buttons: dialogButtons, close: () => resolve(null), default: buttons.find(b => b.default)?.action ?? buttons[0]?.action }).render(true);
    });
  }

  function add2eModeSelectHtml(modes, label = "Version du sort") {
    if (!modes || modes.length <= 1) return "";
    return `<div class="form-group"><label style="font-weight:bold;">${add2eEscapeHtml(label)} :</label><select name="mode" style="width:100%;">${modes.map(m => `<option value="${add2eEscapeHtml(m.key)}">${add2eEscapeHtml(m.label)}</option>`).join("")}</select></div>`;
  }

  function add2eModeFromResult(result, modes) {
    const key = String(result?.mode || modes?.[0]?.key || "default");
    return modes?.find(m => m.key === key) ?? modes?.[0] ?? { key: "default", label: CFG.name, effectName: CFG.name, tags: CFG.tags ?? [] };
  }

  async function add2eGetSaveVsSpells(actorDoc) {
    if (!actorDoc) return NaN;
    if (actorDoc.type === "monster") {
      try {
        const sheetData = await actorDoc.sheet.getData();
        const val = Number(sheetData?.calculatedSaves?.sorts);
        if (Number.isFinite(val) && val > 0) return val;
      } catch (e) {
        console.warn(`[ADD2E][${CFG.slug || CFG.name}] sauvegarde monstre impossible via sheet.getData`, e);
      }
    }

    const candidates = [
      actorDoc.system?.sauvegarde_sortileges,
      actorDoc.system?.sauvegardes?.sortileges,
      actorDoc.system?.sauvegardes?.sorts,
      actorDoc.system?.saves?.sorts,
      actorDoc.system?.calculatedSaves?.sorts
    ];

    for (const raw of candidates) {
      const val = Number(raw);
      if (Number.isFinite(val) && val > 0) return val;
    }

    return NaN;
  }

  async function add2eRollSaveVsSpells(actorDoc, bonus = 0) {
    const saveVal = await add2eGetSaveVsSpells(actorDoc);
    if (!Number.isFinite(saveVal) || saveVal <= 0) {
      return { canRoll: false, saveVal: NaN, roll: null, total: 0, success: false };
    }
    const formula = bonus ? `1d20+${Number(bonus) || 0}` : "1d20";
    const roll = await new Roll(formula).evaluate({ async: true });
    if (game.dice3d) await game.dice3d.showForRoll(roll);
    return { canRoll: true, saveVal, roll, total: roll.total, success: roll.total >= saveVal };
  }

  function add2eEffectData({ name, sourceItem, caster, tags = [], durationRounds = 0, description = "", changes = [], extraFlags = {} }) {
    return {
      name,
      img: sourceItem?.img || CFG.imgFallback || "icons/svg/aura.svg",
      origin: sourceItem?.uuid ?? null,
      disabled: false,
      transfer: false,
      duration: add2eDurationData(durationRounds),
      description,
      flags: {
        add2e: {
          spellName: sourceItem?.name ?? CFG.name,
          sourceItemUuid: sourceItem?.uuid ?? null,
          casterId: caster?.id ?? null,
          casterUuid: caster?.uuid ?? null,
          tags: [...new Set((tags ?? []).map(add2eNormalizeTag).filter(Boolean))],
          ...extraFlags
        }
      },
      changes: add2eMakeChanges(changes)
    };
  }

  function add2eGetMaxHP(actorDoc) {
    const sys = actorDoc?.system || {};
    return Number(sys.points_de_coup) || Number(sys.pv_max) || Number(sys.points_de_vie) || Number(sys.hp?.max) || Number(sys.attributes?.hp?.max) || 0;
  }

  function add2eGetCurrentHP(actorDoc, maxHP) {
    const sys = actorDoc?.system || {};
    const raw = sys.pdv;
    if (raw === undefined || raw === null || raw === "" || Number.isNaN(Number(raw))) return maxHP;
    return Number(raw) || 0;
  }

  async function add2eApplyHpDelta(targetToken, targetActor, delta, sourceItem, caster) {
    if (typeof add2eApplyDamage === "function") {
      await add2eApplyDamage({
        cible: targetToken,
        montant: delta < 0 ? Math.abs(delta) : -Math.abs(delta),
        type: delta < 0 ? "degats_magiques" : "soin",
        details: `${sourceItem.name} : ${Math.abs(delta)} ${delta < 0 ? "dégâts" : "PV rendus"}`,
        source: sourceItem.name,
        lanceur: caster,
        silent: true,
        noChat: true
      });
      return true;
    }

    if (!game.user.isGM && !targetActor.isOwner) {
      ui.notifications.error(`${CFG.name} : add2eApplyDamage indisponible et cible non possédée.`);
      return false;
    }

    const maxHP = add2eGetMaxHP(targetActor);
    const currentHP = add2eGetCurrentHP(targetActor, maxHP);
    await targetActor.update({ "system.pdv": Math.min(maxHP, currentHP + delta) });
    return true;
  }

  function add2eTargetList() {
    return Array.from(game.user.targets ?? []);
  }

  function add2eRequireSingleTarget(spellName) {
    const targets = add2eTargetList();
    if (targets.length !== 1) {
      ui.notifications.warn(`${spellName} : cible exactement une créature.`);
      return null;
    }
    if (!targets[0]?.actor) {
      ui.notifications.warn(`${spellName} : la cible n’a pas d’acteur.`);
      return null;
    }
    return targets[0];
  }

  async function runHealHarm(sourceItem, caster, casterToken) {
    const modes = CFG.modes ?? [
      { key: "heal", label: "Soins des Blessures Légères — rend 1d8 PV" },
      { key: "harm", label: "Blessures Légères — inflige 1d8 PV" }
    ];
    const result = await add2eDialog({
      title: `Lancement : ${CFG.name}`,
      content: `<form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">${add2eModeSelectHtml(modes, "Effet")}<label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" name="touchConfirmed" checked> Contact réussi ou cible consentante.</label></form>`,
      buttons: [
        { action: "cast", label: "Lancer", icon: "fa-solid fa-hands-praying", default: true, callback: (event, button) => ({ mode: button.form.elements.mode?.value || "heal", touchConfirmed: !!button.form.elements.touchConfirmed?.checked }) },
        { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
      ]
    });
    if (!result) return false;
    if (!result.touchConfirmed) return false;

    const targetToken = add2eRequireSingleTarget(CFG.name);
    if (!targetToken) return false;
    if (casterToken && targetToken && !add2eTokensAuContact(casterToken, targetToken)) {
      ui.notifications.warn(`${CFG.name} : la cible doit être au toucher.`);
      return false;
    }

    const targetActor = targetToken.actor;
    const mode = result.mode === "harm" ? "harm" : "heal";
    const roll = await new Roll("1d8").evaluate({ async: true });
    if (game.dice3d) await game.dice3d.showForRoll(roll);

    const amount = Number(roll.total) || 0;
    let resultHtml = "";

    if (mode === "heal") {
      const maxHP = add2eGetMaxHP(targetActor);
      if (!maxHP || maxHP <= 0) {
        ui.notifications.error(`${CFG.name} : PV maximum introuvables pour ${targetActor.name}.`);
        return false;
      }
      const currentHP = add2eGetCurrentHP(targetActor, maxHP);
      const effective = Math.min(amount, Math.max(0, maxHP - currentHP));
      if (effective > 0) {
        const ok = await add2eApplyHpDelta(targetToken, targetActor, effective, sourceItem, caster);
        if (!ok) return false;
      }
      resultHtml = `<div style="border:1px solid ${ADD2E_CLERIC_CHAT.border};background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:${ADD2E_CLERIC_CHAT.dark};"><div style="font-weight:bold;color:${ADD2E_CLERIC_CHAT.success};">SOINS</div><div>Jet : <b>${add2eEscapeHtml(roll.result)}</b> = <b>${amount}</b></div><div>PV rendus : <b>${effective}</b>${effective < amount ? " (limité par le maximum)" : ""}</div></div>`;
    } else {
      const ok = await add2eApplyHpDelta(targetToken, targetActor, -amount, sourceItem, caster);
      if (!ok) return false;
      resultHtml = `<div style="border:1px solid ${ADD2E_CLERIC_CHAT.fail};background:#fff5f2;border-radius:6px;padding:8px;text-align:center;color:${ADD2E_CLERIC_CHAT.dark};"><div style="font-weight:bold;color:${ADD2E_CLERIC_CHAT.fail};">BLESSURES LÉGÈRES</div><div>Jet : <b>${add2eEscapeHtml(roll.result)}</b> = <b>${amount}</b></div><div>Dégâts infligés : <b>${amount}</b></div></div>`;
    }

    await add2ePlayVfx(targetToken, mode === "harm" ? "harm" : "heal");
    await add2eCreateChat({ caster, sourceItem, title: mode === "harm" ? "Blessures Légères" : CFG.name, targetLabel: targetActor.name, resultHtml, detailsHtml: CFG.rule });
    return true;
  }

  async function runCreateWater(sourceItem, caster) {
    const level = add2eGetLevel(caster);
    const maxLitres = level * 15;
    const maxOutres = Math.max(1, Math.floor(maxLitres / 5));
    const result = await add2eDialog({
      title: `Lancement : ${CFG.name}`,
      content: `<form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;"><div class="form-group"><label style="font-weight:bold;">Effet :</label><select name="mode" style="width:100%;"><option value="create">Créer de l’eau claire et potable</option><option value="destroy">Détruire de l’eau</option></select></div><div class="form-group"><label style="font-weight:bold;">Nombre d’outres de 5 L :</label><input type="number" name="nbOutres" value="${maxOutres}" min="1" max="${maxOutres}" step="1" style="width:100%;"><p style="margin:3px 0 0;color:#666;font-size:0.85em;">Maximum : ${maxOutres} outre(s), soit ${maxLitres} L au niveau ${level}.</p></div></form>`,
      buttons: [
        { action: "cast", label: "Lancer", icon: "fa-solid fa-droplet", default: true, callback: (event, button) => ({ mode: button.form.elements.mode?.value || "create", nbOutres: Number(button.form.elements.nbOutres?.value || 0) }) },
        { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
      ]
    });
    if (!result) return false;
    const mode = result.mode === "destroy" ? "destroy" : "create";
    const nbOutres = Math.floor(Number(result.nbOutres) || 0);
    const litres = nbOutres * 5;
    if (nbOutres <= 0 || nbOutres > maxOutres) {
      ui.notifications.warn(`${CFG.name} : quantité invalide.`);
      return false;
    }

    let itemText = "";
    if (mode === "create") {
      const itemName = "Outre d’eau (5 L)";
      const existing = caster.items?.find(i => i.type === "objet" && String(i.name || "").toLowerCase() === itemName.toLowerCase());
      try {
        if (existing) {
          const currentQty = Number(existing.system?.quantite) || 0;
          const newQty = currentQty + nbOutres;
          await existing.update({
            "system.quantite": newQty,
            "system.volume_litres": newQty * 5,
            "system.description": `Outres contenant de l’eau claire et potable créée par ${CFG.name}. Quantité : ${newQty} outre(s) de 5 L.`
          });
          itemText = `Équipement mis à jour : <b>${add2eEscapeHtml(itemName)}</b> +${nbOutres}`;
        } else {
          const created = await caster.createEmbeddedDocuments("Item", [{
            name: itemName,
            type: "objet",
            img: "icons/consumables/drinks/water-jug-blue.webp",
            system: {
              nom: itemName,
              description: `Outres contenant de l’eau claire et potable créée par ${CFG.name}.`,
              quantite: nbOutres,
              unite: "outre",
              volume_litres: litres,
              poids: 0,
              valeur: 0,
              equipee: false,
              tags: ["sort:creation_eau", "objet:outre_eau", "eau:potable", "volume_unitaire_litres:5"]
            },
            flags: { add2e: { createdBySpell: CFG.name, spellUuid: sourceItem.uuid ?? null, casterUuid: caster.uuid ?? null } }
          }]);
          if (!created?.[0]) throw new Error("Objet non créé");
          itemText = `Équipement créé : <b>${add2eEscapeHtml(itemName)}</b> × ${nbOutres}`;
        }
      } catch (e) {
        console.error(`[ADD2E][${CFG.slug}] création eau impossible`, e);
        ui.notifications.error(`${CFG.name} : impossible de créer ou mettre à jour l’objet d’eau.`);
        return false;
      }
    } else {
      itemText = "Destruction déclarée : retire manuellement l’eau concernée si elle est suivie dans l’inventaire.";
    }

    const resultHtml = `<div style="border:1px solid ${ADD2E_CLERIC_CHAT.border};background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:${ADD2E_CLERIC_CHAT.dark};"><div style="font-weight:bold;color:${mode === "destroy" ? ADD2E_CLERIC_CHAT.warn : ADD2E_CLERIC_CHAT.success};">${mode === "destroy" ? "DESTRUCTION D’EAU" : "CRÉATION D’EAU"}</div><div>Quantité : <b>${litres} L</b> (${nbOutres} outre(s))</div><div style="margin-top:4px;">${itemText}</div></div>`;
    await add2ePlayVfx(caster, "water");
    await add2eCreateChat({ caster, sourceItem, title: CFG.name, targetLabel: "Eau", resultHtml, detailsHtml: CFG.rule });
    return true;
  }

  async function runTouchEffect(sourceItem, caster, casterToken) {
    const modes = CFG.modes ?? [{ key: "default", label: CFG.name, effectName: CFG.effectName ?? CFG.name, tags: CFG.tags ?? [], changes: CFG.changes ?? [] }];
    const result = await add2eDialog({
      title: `Lancement : ${CFG.name}`,
      content: `<form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">${add2eModeSelectHtml(modes, "Effet")}<label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" name="touchConfirmed" checked> Contact réussi ou cible consentante.</label><div style="font-size:0.9em;color:#666;border-top:1px solid #ddd;padding-top:6px;">${add2eEscapeHtml(CFG.summary || CFG.rule || "")}</div></form>`,
      buttons: [
        { action: "cast", label: "Lancer", icon: "fa-solid fa-hands-praying", default: true, callback: (event, button) => ({ mode: button.form.elements.mode?.value || modes[0].key, touchConfirmed: !!button.form.elements.touchConfirmed?.checked }) },
        { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
      ]
    });
    if (!result) return false;
    if (!result.touchConfirmed) return false;
    const mode = add2eModeFromResult(result, modes);
    const targetToken = add2eRequireSingleTarget(CFG.name);
    if (!targetToken) return false;
    if (CFG.touch !== false && casterToken && !add2eTokensAuContact(casterToken, targetToken)) {
      ui.notifications.warn(`${CFG.name} : la cible doit être au toucher.`);
      return false;
    }
    const level = add2eGetLevel(caster);
    const rounds = add2eRounds(mode.durationRounds ?? CFG.durationRounds, level);
    const effectData = add2eEffectData({
      name: mode.effectName || CFG.effectName || CFG.name,
      sourceItem,
      caster,
      tags: mode.tags ?? CFG.tags ?? [],
      changes: mode.changes ?? CFG.changes ?? [],
      durationRounds: rounds,
      description: mode.description || CFG.rule || sourceItem.system?.description || "",
      extraFlags: mode.extraFlags ?? {}
    });
    const ok = await add2eCreateEffectOnActor(targetToken.actor, effectData, { removeTags: mode.removeTags ?? CFG.removeTags ?? [] });
    if (!ok) return false;
    const resultHtml = `<div style="border:1px solid ${ADD2E_CLERIC_CHAT.border};background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:${ADD2E_CLERIC_CHAT.dark};"><div style="font-weight:bold;color:${ADD2E_CLERIC_CHAT.success};">${add2eEscapeHtml((mode.effectName || CFG.effectName || CFG.name).toUpperCase())} APPLIQUÉ</div><div>Durée : <b>${rounds ? `${rounds} round(s)` : "spéciale / jusqu’à suppression"}</b></div><div style="margin-top:4px;font-size:0.9em;color:${ADD2E_CLERIC_CHAT.muted};">Tags : ${(effectData.flags.add2e.tags || []).map(add2eEscapeHtml).join(", ")}</div></div>`;
    await add2ePlayVfx(targetToken, mode.vfx || CFG.vfx || "divine");
    await add2eCreateChat({ caster, sourceItem, title: mode.label || CFG.name, targetLabel: targetToken.actor.name, resultHtml, detailsHtml: CFG.rule });
    return true;
  }

  async function runMultiEffect(sourceItem, caster, casterToken) {
    const modes = CFG.modes ?? [{ key: "default", label: CFG.name, effectName: CFG.effectName ?? CFG.name, tags: CFG.tags ?? [], changes: CFG.changes ?? [] }];
    const result = await add2eDialog({
      title: `Lancement : ${CFG.name}`,
      content: `<form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">${add2eModeSelectHtml(modes, "Effet")}<div style="font-size:0.9em;color:#666;border-top:1px solid #ddd;padding-top:6px;">Cible les tokens à affecter avant de lancer le sort.</div></form>`,
      buttons: [
        { action: "cast", label: "Lancer", icon: "fa-solid fa-hands-praying", default: true, callback: (event, button) => ({ mode: button.form.elements.mode?.value || modes[0].key }) },
        { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
      ]
    });
    if (!result) return false;
    const mode = add2eModeFromResult(result, modes);
    const targets = add2eTargetList().filter(t => t?.actor);
    if (!targets.length) {
      ui.notifications.warn(`${CFG.name} : cible au moins une créature.`);
      return false;
    }
    const range = Number(CFG.rangeMeters || 0);
    if (range > 0 && casterToken) {
      const out = targets.filter(t => add2eDistanceMeters(casterToken, t) > range);
      if (out.length) {
        ui.notifications.warn(`${CFG.name} : cible hors de portée (${out.map(t => t.name).join(", ")}).`);
        return false;
      }
    }
    const level = add2eGetLevel(caster);
    const rounds = add2eRounds(mode.durationRounds ?? CFG.durationRounds, level);
    const applied = [];
    const resisted = [];
    const failed = [];
    for (const t of targets) {
      let saveText = "";
      let effectMode = mode;
      if (CFG.save === true || mode.save === true) {
        const save = await add2eRollSaveVsSpells(t.actor, Number(mode.saveBonus ?? CFG.saveBonus ?? 0));
        if (save.canRoll && save.success) {
          if (!CFG.applyOnSave) {
            resisted.push(`${t.name} (${save.roll.total}/${save.saveVal})`);
            continue;
          }
          effectMode = CFG.saveEffect ?? mode;
          saveText = ` JS réussi ${save.roll.total}/${save.saveVal} — effet réduit`;
          resisted.push(`${t.name} (${save.roll.total}/${save.saveVal}, effet réduit)`);
        } else if (!save.canRoll && CFG.requireSaveValue) {
          failed.push(`${t.name} (sauvegarde introuvable)`);
          continue;
        } else if (save.canRoll) {
          saveText = ` JS raté ${save.roll.total}/${save.saveVal}`;
        }
      }
      const effectData = add2eEffectData({
        name: effectMode.effectName || mode.effectName || CFG.effectName || CFG.name,
        sourceItem,
        caster,
        tags: effectMode.tags ?? mode.tags ?? CFG.tags ?? [],
        changes: effectMode.changes ?? mode.changes ?? CFG.changes ?? [],
        durationRounds: rounds,
        description: effectMode.description || mode.description || CFG.rule || sourceItem.system?.description || "",
        extraFlags: { saveText }
      });
      const ok = await add2eCreateEffectOnActor(t.actor, effectData, { removeTags: effectMode.removeTags ?? mode.removeTags ?? CFG.removeTags ?? [] });
      if (ok) {
        applied.push(t.name + saveText);
        await add2ePlayVfx(t, mode.vfx || CFG.vfx || "bless");
      }
      else failed.push(t.name);
    }
    if (!applied.length && !resisted.length) return false;
    const resultHtml = `<div style="border:1px solid ${ADD2E_CLERIC_CHAT.border};background:#fffdf4;border-radius:6px;padding:8px;color:${ADD2E_CLERIC_CHAT.dark};"><div style="text-align:center;font-weight:bold;color:${ADD2E_CLERIC_CHAT.success};">${add2eEscapeHtml((mode.effectName || CFG.effectName || CFG.name).toUpperCase())}</div>${applied.length ? `<div><b>Affectés :</b><ul>${applied.map(n => `<li>${add2eEscapeHtml(n)}</li>`).join("")}</ul></div>` : ""}${resisted.length ? `<div style="color:${ADD2E_CLERIC_CHAT.success};"><b>Résistent :</b> ${resisted.map(add2eEscapeHtml).join(", ")}</div>` : ""}${failed.length ? `<div style="color:${ADD2E_CLERIC_CHAT.fail};"><b>Non appliqués :</b> ${failed.map(add2eEscapeHtml).join(", ")}</div>` : ""}<div>Durée : <b>${rounds ? `${rounds} round(s)` : "spéciale"}</b></div></div>`;
    await add2eCreateChat({ caster, sourceItem, title: mode.label || CFG.name, targetLabel: applied.join(", ") || resisted.join(", "), resultHtml, detailsHtml: CFG.rule });
    return true;
  }

  async function runDetection(sourceItem, caster) {
    const fields = CFG.fields ?? [];
    const fieldHtml = fields.map(f => {
      if (f.type === "select") return `<div class="form-group"><label style="font-weight:bold;">${add2eEscapeHtml(f.label)} :</label><select name="${add2eEscapeHtml(f.name)}" style="width:100%;">${(f.options ?? []).map(o => `<option value="${add2eEscapeHtml(o.value)}">${add2eEscapeHtml(o.label)}</option>`).join("")}</select></div>`;
      return `<div class="form-group"><label style="font-weight:bold;">${add2eEscapeHtml(f.label)} :</label><input type="text" name="${add2eEscapeHtml(f.name)}" value="${add2eEscapeHtml(f.value || "")}" style="width:100%;"></div>`;
    }).join("");
    const result = await add2eDialog({
      title: `Lancement : ${CFG.name}`,
      content: `<form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">${fieldHtml}<div style="font-size:0.9em;color:#666;border-top:1px solid #ddd;padding-top:6px;">${add2eEscapeHtml(CFG.summary || CFG.rule || "")}</div></form>`,
      buttons: [
        { action: "cast", label: "Lancer", icon: "fa-solid fa-eye", default: true, callback: (event, button) => { const out = {}; for (const f of fields) out[f.name] = button.form.elements[f.name]?.value || ""; return out; } },
        { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
      ]
    });
    if (!result) return false;
    const level = add2eGetLevel(caster);
    const rounds = add2eRounds(CFG.durationRounds, level);
    if (CFG.createEffect !== false) {
      const effectData = add2eEffectData({
        name: CFG.effectName || CFG.name,
        sourceItem,
        caster,
        tags: CFG.tags ?? [],
        durationRounds: rounds,
        description: CFG.rule || sourceItem.system?.description || "",
        extraFlags: { detectionOptions: result }
      });
      const ok = await add2eCreateEffectOnActor(caster, effectData, { removeTags: CFG.removeTags ?? [] });
      if (!ok) return false;
    }
    const lines = Object.entries(result).map(([k,v]) => `<div><b>${add2eEscapeHtml(k)} :</b> ${add2eEscapeHtml(v || "—")}</div>`).join("");
    const resultHtml = `<div style="border:1px solid ${ADD2E_CLERIC_CHAT.border};background:#fffdf4;border-radius:6px;padding:8px;color:${ADD2E_CLERIC_CHAT.dark};"><div style="text-align:center;font-weight:bold;color:${ADD2E_CLERIC_CHAT.success};">SORT ACTIF</div>${lines}<div style="margin-top:5px;">Le MJ annonce les informations détectées selon la scène.</div>${rounds ? `<div>Durée : <b>${rounds} round(s)</b></div>` : ""}</div>`;
    await add2ePlayVfx(caster, CFG.vfx || "detection");
    await add2eCreateChat({ caster, sourceItem, title: CFG.name, targetLabel: CFG.targetLabel || "Direction / zone", resultHtml, detailsHtml: CFG.rule });
    return true;
  }

  async function runDeclaration(sourceItem, caster) {
    const modes = CFG.modes ?? [{ key: "default", label: CFG.name }];
    const fields = CFG.fields ?? [];
    const html = `${add2eModeSelectHtml(modes, "Effet")}${fields.map(f => `<div class="form-group"><label style="font-weight:bold;">${add2eEscapeHtml(f.label)} :</label><input type="${f.type || "text"}" name="${add2eEscapeHtml(f.name)}" value="${add2eEscapeHtml(f.value || "")}" style="width:100%;"></div>`).join("")}`;
    const result = await add2eDialog({
      title: `Lancement : ${CFG.name}`,
      content: `<form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">${html}<div style="font-size:0.9em;color:#666;border-top:1px solid #ddd;padding-top:6px;">${add2eEscapeHtml(CFG.summary || CFG.rule || "")}</div></form>`,
      buttons: [
        { action: "cast", label: "Lancer", icon: "fa-solid fa-hands-praying", default: true, callback: (event, button) => { const out = { mode: button.form.elements.mode?.value || modes[0].key }; for (const f of fields) out[f.name] = button.form.elements[f.name]?.value || ""; return out; } },
        { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
      ]
    });
    if (!result) return false;
    const mode = add2eModeFromResult(result, modes);
    const level = add2eGetLevel(caster);
    const rounds = add2eRounds(mode.durationRounds ?? CFG.durationRounds, level);
    if (CFG.createEffect === true) {
      const effectData = add2eEffectData({
        name: mode.effectName || CFG.effectName || CFG.name,
        sourceItem,
        caster,
        tags: mode.tags ?? CFG.tags ?? [],
        changes: mode.changes ?? CFG.changes ?? [],
        durationRounds: rounds,
        description: mode.description || CFG.rule || sourceItem.system?.description || "",
        extraFlags: { declaration: result }
      });
      const ok = await add2eCreateEffectOnActor(caster, effectData, { removeTags: mode.removeTags ?? CFG.removeTags ?? [] });
      if (!ok) return false;
    }
    const lines = Object.entries(result).filter(([k]) => k !== "mode").map(([k,v]) => `<div><b>${add2eEscapeHtml(k)} :</b> ${add2eEscapeHtml(v || "—")}</div>`).join("");
    const resultHtml = `<div style="border:1px solid ${ADD2E_CLERIC_CHAT.border};background:#fffdf4;border-radius:6px;padding:8px;color:${ADD2E_CLERIC_CHAT.dark};"><div style="text-align:center;font-weight:bold;color:${ADD2E_CLERIC_CHAT.success};">${add2eEscapeHtml((mode.effectName || mode.label || CFG.name).toUpperCase())}</div>${lines}<div style="margin-top:5px;">${add2eEscapeHtml(mode.resultText || CFG.resultText || "Effet déclaré. Le MJ valide les conséquences exactes si nécessaire.")}</div>${rounds ? `<div>Durée : <b>${rounds} round(s)</b></div>` : ""}</div>`;
    await add2ePlayVfx(caster, mode.vfx || CFG.vfx || "divine");
    await add2eCreateChat({ caster, sourceItem, title: mode.label || CFG.name, targetLabel: CFG.targetLabel || "—", resultHtml, detailsHtml: CFG.rule });
    return true;
  }

  async function runCommand(sourceItem, caster, casterToken) {
    const targetToken = add2eRequireSingleTarget(CFG.name);
    if (!targetToken) return false;
    const range = Number(CFG.rangeMeters || 0);
    if (range > 0 && casterToken && add2eDistanceMeters(casterToken, targetToken) > range) {
      ui.notifications.warn(`${CFG.name} : cible hors de portée.`);
      return false;
    }
    const result = await add2eDialog({
      title: `Lancement : ${CFG.name}`,
      content: `<form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;"><div class="form-group"><label style="font-weight:bold;">Ordre d’un mot :</label><input type="text" name="command" value="Halte" style="width:100%;"></div><label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" name="allowSave" checked> La cible a droit au jet de protection.</label></form>`,
      buttons: [
        { action: "cast", label: "Lancer", icon: "fa-solid fa-comment", default: true, callback: (event, button) => ({ command: button.form.elements.command?.value || "Halte", allowSave: !!button.form.elements.allowSave?.checked }) },
        { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
      ]
    });
    if (!result) return false;
    let saveHtml = "";
    if (result.allowSave) {
      const save = await add2eRollSaveVsSpells(targetToken.actor);
      if (save.canRoll && save.success) {
        saveHtml = `<div style="color:${ADD2E_CLERIC_CHAT.success};">Jet de protection réussi : ${save.roll.total}/${save.saveVal}. Aucun effet.</div>`;
        await add2eCreateChat({ caster, sourceItem, title: CFG.name, targetLabel: targetToken.actor.name, resultHtml: `<div style="border:1px solid ${ADD2E_CLERIC_CHAT.border};background:#fffdf4;border-radius:6px;padding:8px;text-align:center;">${saveHtml}</div>`, detailsHtml: CFG.rule });
        return true;
      }
      if (save.canRoll) saveHtml = `<div>Jet de protection raté : <b>${save.roll.total}/${save.saveVal}</b>.</div>`;
      else saveHtml = `<div style="color:${ADD2E_CLERIC_CHAT.warn};">Sauvegarde introuvable : le MJ doit valider.</div>`;
    }
    const effectData = add2eEffectData({
      name: `Injonction : ${result.command}`,
      sourceItem,
      caster,
      tags: CFG.tags ?? [],
      durationRounds: 1,
      description: `La cible doit obéir à l’ordre : ${result.command}`,
      extraFlags: { command: result.command }
    });
    const ok = await add2eCreateEffectOnActor(targetToken.actor, effectData);
    if (!ok) return false;
    const resultHtml = `<div style="border:1px solid ${ADD2E_CLERIC_CHAT.border};background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:${ADD2E_CLERIC_CHAT.dark};"><div style="font-weight:bold;color:${ADD2E_CLERIC_CHAT.success};">INJONCTION</div><div>Ordre : <b>${add2eEscapeHtml(result.command)}</b></div>${saveHtml}<div>Durée : <b>1 round</b>.</div></div>`;
    await add2ePlayVfx(targetToken, CFG.vfx || "command");
    await add2eCreateChat({ caster, sourceItem, title: CFG.name, targetLabel: targetToken.actor.name, resultHtml, detailsHtml: CFG.rule });
    return true;
  }

  async function runMagicClub(sourceItem, caster) {
    const weapons = Array.from(caster.items ?? []).filter(i => {
      const n = String(i.name || "").toLowerCase();
      const t = String(i.type || "").toLowerCase();
      return t === "arme" && (n.includes("gourdin") || n.includes("bâton") || n.includes("baton") || n.includes("massue"));
    });
    const options = weapons.map(w => `<option value="${w.id}">${add2eEscapeHtml(w.name)}</option>`).join("");
    const result = await add2eDialog({
      title: `Lancement : ${CFG.name}`,
      content: `<form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;"><div class="form-group"><label style="font-weight:bold;">Arme de bois :</label><select name="weaponId" style="width:100%;">${options || `<option value="">Aucune arme trouvée — effet déclaratif</option>`}</select></div></form>`,
      buttons: [
        { action: "cast", label: "Lancer", icon: "fa-solid fa-wand-magic-sparkles", default: true, callback: (event, button) => ({ weaponId: button.form.elements.weaponId?.value || "" }) },
        { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
      ]
    });
    if (!result) return false;
    const weapon = result.weaponId ? caster.items.get(result.weaponId) : null;
    const level = add2eGetLevel(caster);
    const rounds = add2eRounds(CFG.durationRounds, level);
    const effectData = add2eEffectData({
      name: weapon ? `Gourdin Magique : ${weapon.name}` : "Gourdin Magique",
      sourceItem,
      caster,
      tags: CFG.tags ?? [],
      durationRounds: rounds,
      description: CFG.rule,
      extraFlags: { weaponId: weapon?.id ?? null, weaponName: weapon?.name ?? null }
    });
    const ok = await add2eCreateEffectOnActor(caster, effectData);
    if (!ok) return false;
    const resultHtml = `<div style="border:1px solid ${ADD2E_CLERIC_CHAT.border};background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:${ADD2E_CLERIC_CHAT.dark};"><div style="font-weight:bold;color:${ADD2E_CLERIC_CHAT.success};">ARME ENCHANTÉE</div><div>Arme : <b>${add2eEscapeHtml(weapon?.name || "à définir par le MJ")}</b></div><div>Durée : <b>${rounds} round(s)</b>.</div><div style="font-size:0.9em;color:${ADD2E_CLERIC_CHAT.muted};">L’effet porte les tags nécessaires au moteur. Vérifie que l’attaque lit ces tags pour appliquer les bonus.</div></div>`;
    await add2ePlayVfx(caster, CFG.vfx || "divine");
    await add2eCreateChat({ caster, sourceItem, title: CFG.name, targetLabel: weapon?.name || "Arme", resultHtml, detailsHtml: CFG.rule });
    return true;
  }

  async function runMagicStone(sourceItem, caster) {
    const result = await add2eDialog({
      title: `Lancement : ${CFG.name}`,
      content: `<form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;"><div class="form-group"><label style="font-weight:bold;">Nombre de pierres :</label><input type="number" name="qty" value="3" min="1" max="3" step="1" style="width:100%;"></div></form>`,
      buttons: [
        { action: "cast", label: "Lancer", icon: "fa-solid fa-gem", default: true, callback: (event, button) => ({ qty: Number(button.form.elements.qty?.value || 3) }) },
        { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
      ]
    });
    if (!result) return false;
    const qty = Math.max(1, Math.min(3, Math.floor(Number(result.qty) || 3)));
    try {
      await caster.createEmbeddedDocuments("Item", [{
        name: "Pierre magique",
        type: "objet",
        img: sourceItem.img || CFG.imgFallback || "icons/commodities/stone/stone-round-grey.webp",
        system: { nom: "Pierre magique", description: CFG.rule, quantite: qty, equipee: false, tags: CFG.tags ?? [] },
        flags: { add2e: { createdBySpell: CFG.name, spellUuid: sourceItem.uuid ?? null, casterUuid: caster.uuid ?? null } }
      }]);
    } catch (e) {
      console.error(`[ADD2E][${CFG.slug}] création pierres impossible`, e);
      ui.notifications.error(`${CFG.name} : impossible de créer les pierres magiques dans l’inventaire.`);
      return false;
    }
    const resultHtml = `<div style="border:1px solid ${ADD2E_CLERIC_CHAT.border};background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:${ADD2E_CLERIC_CHAT.dark};"><div style="font-weight:bold;color:${ADD2E_CLERIC_CHAT.success};">PIERRES ENCHANTÉES</div><div>Créées dans l’inventaire : <b>${qty}</b>.</div></div>`;
    await add2ePlayVfx(caster, CFG.vfx || "divine");
    await add2eCreateChat({ caster, sourceItem, title: CFG.name, targetLabel: "Pierres", resultHtml, detailsHtml: CFG.rule });
    return true;
  }

  // =====================================================
  // Exécution
  // =====================================================
  console.log(`%c[ADD2E][${CFG.slug || CFG.name}] ON USE CLERC N1`, "color:#b88924;font-weight:bold;", CFG);

  const sourceItem = add2eGetSourceItem();
  if (!sourceItem) {
    ui.notifications.error(`${CFG.name} : sort introuvable.`);
    return false;
  }

  const caster = add2eGetCaster(sourceItem);
  if (!caster) {
    ui.notifications.error(`${CFG.name} : lanceur introuvable.`);
    return false;
  }

  const casterToken = add2eGetCasterToken(caster);

  switch (CFG.kind) {
    case "healHarm": { const r = await runHealHarm(sourceItem, caster, casterToken); console.log(`[ADD2E][${CFG.slug || CFG.name}][ONUSE_RESULT]`, r); return r; }
    case "createWater": { const r = await runCreateWater(sourceItem, caster); console.log(`[ADD2E][${CFG.slug || CFG.name}][ONUSE_RESULT]`, r); return r; }
    case "touchEffect": { const r = await runTouchEffect(sourceItem, caster, casterToken); console.log(`[ADD2E][${CFG.slug || CFG.name}][ONUSE_RESULT]`, r); return r; }
    case "multiEffect": { const r = await runMultiEffect(sourceItem, caster, casterToken); console.log(`[ADD2E][${CFG.slug || CFG.name}][ONUSE_RESULT]`, r); return r; }
    case "detection": { const r = await runDetection(sourceItem, caster); console.log(`[ADD2E][${CFG.slug || CFG.name}][ONUSE_RESULT]`, r); return r; }
    case "declaration": { const r = await runDeclaration(sourceItem, caster); console.log(`[ADD2E][${CFG.slug || CFG.name}][ONUSE_RESULT]`, r); return r; }
    case "command": { const r = await runCommand(sourceItem, caster, casterToken); console.log(`[ADD2E][${CFG.slug || CFG.name}][ONUSE_RESULT]`, r); return r; }
    case "magicClub": { const r = await runMagicClub(sourceItem, caster); console.log(`[ADD2E][${CFG.slug || CFG.name}][ONUSE_RESULT]`, r); return r; }
    case "magicStone": { const r = await runMagicStone(sourceItem, caster); console.log(`[ADD2E][${CFG.slug || CFG.name}][ONUSE_RESULT]`, r); return r; }
    default:
      ui.notifications.error(`${CFG.name} : mécanique onUse inconnue (${CFG.kind}).`);
      return false;
  }
})();

if (__add2eOnUseResult !== true && __add2eOnUseResult !== false) {
  console.error("[ADD2E][ONUSE][BAD_RETURN_STRICT] Le script onUse doit retourner true ou false.", {
    script: "detection-du-mal.js",
    result: __add2eOnUseResult
  });
  ui.notifications?.error?.(`${sourceItem?.name ?? item?.name ?? sort?.name ?? "Sort"} : le script onUse n'a pas retourné true/false.`);
  return false;
}

return __add2eOnUseResult;
