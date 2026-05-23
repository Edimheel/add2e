// Généré pour ADD2E — Clerc niveau 1
// Compatible Foundry V13, préparé V14.
// Contrat moteur : return false = le sort n'est pas consommé ; return true = le sort est lancé.
// Version : 2026-05-23-touch-attack-contact-spells-v1

const ADD2E_CLERIC_ONUSE_CONFIG = {
  kind: "healHarm",
  tags: [
    "sort:soins_des_blessures_legeres",
    "soin:1d8",
    "reversible:blessures_legeres",
    "degats_inverse:1d8",
    "etat:soin",
    "contact:jet_toucher_si_necessaire"
  ],
  rule: "Rend 1d8 points de vie a une creature vivante blessee. Inverse : blessures legeres, inflige 1d8 par contact. Si le contact n'est pas deja acquis, on resout un jet de toucher avant d'appliquer l'effet.",
  name: "Soins des Blessures Legeres",
  slug: "soins-des-blessures-legeres",
  imgFallback: "systems/add2e/assets/icones/sorts/soins-des-blessures-legeres.webp"
};

const __add2eOnUseResult = await (async () => {
  const CFG = ADD2E_CLERIC_ONUSE_CONFIG;

  const COLORS = {
    main: "#b88924",
    dark: "#6f4b12",
    pale: "#fff7df",
    pale2: "#fffaf0",
    border: "#e2bc63",
    borderDark: "#8a611d",
    success: "#2f8f46",
    fail: "#b33a2e",
    warn: "#b88924"
  };

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function chatStyleData() {
    if (CONST.CHAT_MESSAGE_STYLES) return { style: CONST.CHAT_MESSAGE_STYLES.OTHER };
    return { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
  }

  function sourceItemFromContext() {
    let sourceItem = null;
    if (typeof sort !== "undefined" && sort) sourceItem = sort;
    else if (typeof item !== "undefined" && item) sourceItem = item;
    else if (typeof spell !== "undefined" && spell) sourceItem = spell;
    else if (typeof this !== "undefined" && this?.documentName === "Item") sourceItem = this;
    if ((!sourceItem || !sourceItem.system) && typeof args !== "undefined" && args?.[0]?.item) sourceItem = args[0].item;
    return sourceItem;
  }

  function casterFromContext(sourceItem) {
    return (typeof actor !== "undefined" && actor) ? actor : sourceItem?.parent;
  }

  function casterTokenFor(caster) {
    return canvas.tokens?.controlled?.[0]
      ?? ((typeof token !== "undefined" && token) ? token : null)
      ?? caster?.getActiveTokens?.()[0]
      ?? null;
  }

  function singleTarget() {
    const targets = Array.from(game.user.targets ?? []);
    if (targets.length !== 1) {
      ui.notifications.warn(`${CFG.name} : cible exactement une creature.`);
      return null;
    }
    if (!targets[0]?.actor) {
      ui.notifications.warn(`${CFG.name} : la cible n'a pas d'acteur.`);
      return null;
    }
    return targets[0];
  }

  function tokensAuContact(a, b) {
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

  function readNumber(value) {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function getThac0(actorDoc) {
    const sys = actorDoc?.system ?? {};

    if (actorDoc?.type === "personnage") {
      const classeItem = actorDoc.items?.find(i => i.type === "classe");
      const niv = Number(sys.niveau) || 1;
      const prog = Array.isArray(classeItem?.system?.progression)
        ? classeItem.system.progression[niv - 1]
        : null;
      const fromProgression = readNumber(prog?.thac0);
      if (fromProgression !== null) return fromProgression;
    }

    return readNumber(sys.thac0) ?? 20;
  }

  function getTargetCA(targetActor, caster, sourceItem) {
    const sys = targetActor?.system ?? {};

    if (targetActor?.type === "personnage" && typeof Add2eEffectsEngine !== "undefined" && typeof Add2eEffectsEngine.getMagicPassiveDefense === "function") {
      const details = Add2eEffectsEngine.getMagicPassiveDefense(targetActor, {
        source: "spell-touch-attack",
        attacker: caster?.name,
        weapon: sourceItem?.name ?? CFG.name
      });
      const ca = readNumber(details?.caTotal);
      if (ca !== null) return { ca, source: "effects-engine:magic-passive-defense", details };
    }

    const ca = readNumber(sys.armorClass) ?? readNumber(sys.ca_total) ?? readNumber(sys.ca) ?? 10;
    return { ca, source: "actor-system", details: { armorClass: sys.armorClass, ca_total: sys.ca_total, ca: sys.ca } };
  }

  async function rollTouchAttack({ caster, targetActor, sourceItem }) {
    const thac0 = getThac0(caster);
    const caInfo = getTargetCA(targetActor, caster, sourceItem);
    const seuil = thac0 - caInfo.ca;
    const roll = await new Roll("1d20").evaluate({ async: true });
    if (game.dice3d) await game.dice3d.showForRoll(roll);
    const d20 = Number(roll.total) || 0;
    const success = d20 === 20 || (d20 !== 1 && d20 >= seuil);

    return {
      roll,
      d20,
      thac0,
      ca: caInfo.ca,
      caSource: caInfo.source,
      seuil,
      success
    };
  }

  function maxHP(actorDoc) {
    const sys = actorDoc?.system || {};
    return Number(sys.points_de_coup) || Number(sys.pv_max) || Number(sys.points_de_vie) || Number(sys.hp?.max) || Number(sys.attributes?.hp?.max) || 0;
  }

  function currentHP(actorDoc, max) {
    const sys = actorDoc?.system || {};
    const raw = sys.pdv;
    if (raw === undefined || raw === null || raw === "" || Number.isNaN(Number(raw))) return max;
    return Number(raw) || 0;
  }

  async function applyHpDelta(targetToken, targetActor, delta, sourceItem) {
    if (typeof add2eApplyDamage === "function") {
      await add2eApplyDamage({
        cible: targetToken,
        montant: delta < 0 ? Math.abs(delta) : -Math.abs(delta),
        type: delta < 0 ? "degats_magiques" : "soin",
        details: `${sourceItem.name} : ${Math.abs(delta)} ${delta < 0 ? "degats" : "PV rendus"}`
      });
      return true;
    }

    if (!game.user.isGM && !targetActor.isOwner) {
      ui.notifications.error(`${CFG.name} : droits insuffisants pour modifier les PV de ${targetActor.name}.`);
      return false;
    }

    const max = maxHP(targetActor);
    const cur = currentHP(targetActor, max);
    const next = delta > 0 ? Math.min(max, cur + delta) : cur + delta;
    await targetActor.update({ "system.pdv": next });
    return true;
  }

  async function createChat({ caster, sourceItem, title, targetActor, mode, amount = 0, effective = 0, touch = null }) {
    const isHeal = mode === "heal";
    const touchHtml = touch ? `
      <div style="margin:6px 0;padding:7px;border-radius:6px;background:${touch.success ? "#eefaf2" : "#fff1f0"};border:1px solid ${touch.success ? COLORS.success : COLORS.fail};">
        <div style="font-weight:900;color:${touch.success ? COLORS.success : COLORS.fail};">Jet de toucher ${touch.success ? "reussi" : "rate"}</div>
        <div>Jet : <b>${touch.d20}</b> / Seuil : <b>${touch.seuil}</b></div>
        <div style="font-size:.85em;color:#6b5a35;">THAC0 ${touch.thac0} - CA ${touch.ca} = ${touch.seuil}</div>
      </div>` : "";

    const resultHtml = touch && !touch.success
      ? `<div style="border:1px solid ${COLORS.fail};background:#fff5f2;border-radius:6px;padding:8px;text-align:center;color:${COLORS.dark};"><div style="font-weight:bold;color:${COLORS.fail};">CONTACT MANQUE</div><div>L'effet du sort n'est pas applique.</div></div>`
      : (isHeal
        ? `<div style="border:1px solid ${COLORS.border};background:#fffdf4;border-radius:6px;padding:8px;text-align:center;color:${COLORS.dark};"><div style="font-weight:bold;color:${COLORS.success};">SOINS</div><div>Jet : <b>1d8</b> = <b>${amount}</b></div><div>PV rendus : <b>${effective}</b>${effective < amount ? " (limite par le maximum)" : ""}</div></div>`
        : `<div style="border:1px solid ${COLORS.fail};background:#fff5f2;border-radius:6px;padding:8px;text-align:center;color:${COLORS.dark};"><div style="font-weight:bold;color:${COLORS.fail};">BLESSURES LEGERES</div><div>Jet : <b>1d8</b> = <b>${amount}</b></div><div>Degats infliges : <b>${amount}</b></div></div>`);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      content: `
        <div class="add2e-spell-card add2e-spell-card-clerc" style="border-radius:12px;box-shadow:0 4px 10px #0002;background:linear-gradient(135deg,${COLORS.pale2} 0%,${COLORS.pale} 100%);border:1.5px solid ${COLORS.border};overflow:hidden;padding:0;font-family:var(--font-primary);">
          <div style="background:linear-gradient(90deg,${COLORS.dark} 0%,${COLORS.main} 100%);padding:8px 12px;color:white;display:flex;align-items:center;gap:10px;border-bottom:2px solid ${COLORS.borderDark};">
            <img src="${esc(caster?.img || "icons/svg/mystery-man.svg")}" style="width:36px;height:36px;border-radius:50%;border:2px solid #fff;object-fit:cover;">
            <div style="line-height:1.2;flex:1;"><div style="font-weight:bold;font-size:1.05em;">${esc(caster?.name ?? "Lanceur")}</div><div style="font-size:0.85em;opacity:0.95;">lance <b>${esc(title)}</b></div></div>
            <img src="${esc(sourceItem?.img || CFG.imgFallback)}" style="width:32px;height:32px;border-radius:4px;background:#fff;">
          </div>
          <div style="padding:10px;">
            <div style="margin-bottom:6px;font-size:0.95em;color:${COLORS.dark};"><b>Cible :</b> ${esc(targetActor?.name ?? "—")}</div>
            ${touchHtml}
            ${resultHtml}
            <details style="margin-top:8px;background:white;border:1px solid ${COLORS.border};border-radius:6px;">
              <summary style="cursor:pointer;color:${COLORS.dark};font-weight:600;padding:6px;">Regle appliquee</summary>
              <div style="padding:8px;font-size:0.85em;line-height:1.45;color:${COLORS.dark};">${esc(CFG.rule)}</div>
            </details>
          </div>
        </div>`,
      ...chatStyleData()
    });
  }

  async function dialogCast() {
    const content = `
      <form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;">
        <div class="form-group">
          <label style="font-weight:bold;">Effet :</label>
          <select name="mode" style="width:100%;">
            <option value="heal">Soins des Blessures Legeres — rend 1d8 PV</option>
            <option value="harm">Blessures Legeres — inflige 1d8 PV</option>
          </select>
        </div>
        <label style="display:flex;gap:6px;align-items:center;">
          <input type="checkbox" name="touchConfirmed" checked>
          Contact automatique si la cible est deja au contact et consentante.
        </label>
        <p style="margin:0;color:#6b5a35;font-size:.86em;line-height:1.35;">Si la cible n'est pas au contact ou si le contact automatique est decoche, un jet de toucher est resolu avant l'effet.</p>
      </form>`;

    const DialogV2 = foundry.applications?.api?.DialogV2;
    if (DialogV2) {
      return await DialogV2.wait({
        window: { title: `Lancement : ${CFG.name}` },
        content,
        buttons: [
          { action: "cast", label: "Lancer", icon: "fa-solid fa-hands-praying", default: true, callback: (event, button) => ({ mode: button.form.elements.mode?.value || "heal", touchConfirmed: !!button.form.elements.touchConfirmed?.checked }) },
          { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
        ],
        rejectClose: false
      });
    }

    return await new Promise(resolve => {
      new Dialog({
        title: `Lancement : ${CFG.name}`,
        content,
        buttons: {
          cast: {
            label: "Lancer",
            icon: '<i class="fa-solid fa-hands-praying"></i>',
            callback: html => {
              const form = html[0]?.querySelector?.("form") ?? html.find?.("form")?.[0];
              resolve({ mode: form?.elements?.mode?.value || "heal", touchConfirmed: !!form?.elements?.touchConfirmed?.checked });
            }
          },
          cancel: { label: "Annuler", callback: () => resolve(null) }
        },
        default: "cast",
        close: () => resolve(null)
      }).render(true);
    });
  }

  async function run() {
    const sourceItem = sourceItemFromContext();
    const caster = casterFromContext(sourceItem);
    const casterToken = casterTokenFor(caster);

    if (!sourceItem || !caster) {
      ui.notifications.error(`${CFG.name} : lanceur ou sort introuvable.`);
      return false;
    }

    const targetToken = singleTarget();
    if (!targetToken) return false;
    const targetActor = targetToken.actor;

    const result = await dialogCast();
    if (!result) return false;

    const mode = result.mode === "harm" ? "harm" : "heal";
    const auContact = tokensAuContact(casterToken, targetToken);
    const contactAuto = !!result.touchConfirmed && auContact;
    let touch = null;

    if (!contactAuto) {
      touch = await rollTouchAttack({ caster, targetActor, sourceItem });
      if (!touch.success) {
        await createChat({ caster, sourceItem, title: mode === "harm" ? "Blessures Legeres" : CFG.name, targetActor, mode, touch });
        return true;
      }
    }

    const roll = await new Roll("1d8").evaluate({ async: true });
    if (game.dice3d) await game.dice3d.showForRoll(roll);
    const amount = Number(roll.total) || 0;

    let effective = amount;
    if (mode === "heal") {
      const max = maxHP(targetActor);
      if (!max || max <= 0) {
        ui.notifications.error(`${CFG.name} : PV maximum introuvables pour ${targetActor.name}.`);
        return false;
      }
      const cur = currentHP(targetActor, max);
      effective = Math.min(amount, Math.max(0, max - cur));
      if (effective > 0) {
        const ok = await applyHpDelta(targetToken, targetActor, effective, sourceItem);
        if (!ok) return false;
      }
    } else {
      const ok = await applyHpDelta(targetToken, targetActor, -amount, sourceItem);
      if (!ok) return false;
    }

    await createChat({ caster, sourceItem, title: mode === "harm" ? "Blessures Legeres" : CFG.name, targetActor, mode, amount, effective, touch });
    return true;
  }

  return await run();
})();

return __add2eOnUseResult;
