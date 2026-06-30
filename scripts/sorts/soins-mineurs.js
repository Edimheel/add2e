// ADD2E — Soins mineurs / Blessures mineures (Clerc niveau 1)
// Compatible Foundry V13/V14/V15.
// Contrat onUse : true = sort consommé ; false = sort non consommé.

const __add2eMinorCureResult = await (async () => {
  const CONFIG = Object.freeze({
    name: "Soins mineurs",
    icon: "systems/add2e/assets/icones/sorts/soins-mineurs.webp",
    healFormula: "1d8",
    touchWeaponName: "Blessures mineures"
  });

  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const normalize = value => String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const chatStyle = () => CONST.CHAT_MESSAGE_STYLES
    ? { style: CONST.CHAT_MESSAGE_STYLES.OTHER }
    : { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };

  const spellItem = typeof sourceItem !== "undefined" && sourceItem
    ? sourceItem
    : typeof sort !== "undefined" && sort
      ? sort
      : typeof item !== "undefined" && item
        ? item
        : typeof this !== "undefined" && this?.documentName === "Item"
          ? this
          : null;
  const caster = typeof actor !== "undefined" && actor
    ? actor
    : spellItem?.parent ?? null;

  if (!spellItem || !caster) {
    ui.notifications?.error?.(`${CONFIG.name} : lanceur ou sort introuvable.`);
    return false;
  }

  const targets = Array.from(game.user?.targets ?? []).filter(tokenDoc => tokenDoc?.actor);
  if (targets.length !== 1) {
    ui.notifications?.warn?.(`${CONFIG.name} : cible exactement une créature.`);
    return false;
  }

  const targetToken = targets[0];
  const targetActor = targetToken.actor;
  const casterToken = (typeof token !== "undefined" && token?.actor?.id === caster.id ? token : null)
    ?? (canvas?.tokens?.controlled ?? []).find(tokenDoc => tokenDoc?.actor?.id === caster.id || tokenDoc?.document?.actorId === caster.id)
    ?? caster.getActiveTokens?.()[0]
    ?? null;

  if (!casterToken) {
    ui.notifications?.warn?.(`${CONFIG.name} : sélectionne le token du lanceur.`);
    return false;
  }

  function tokenBounds(tokenDoc) {
    const object = tokenDoc?.object ?? tokenDoc;
    const document = object?.document ?? tokenDoc?.document ?? tokenDoc ?? {};
    const gridSize = Number(canvas?.grid?.size) || 100;
    return {
      x: Number(object?.x ?? document?.x ?? 0),
      y: Number(object?.y ?? document?.y ?? 0),
      width: Number(object?.w ?? Number(document?.width ?? 1) * gridSize),
      height: Number(object?.h ?? Number(document?.height ?? 1) * gridSize)
    };
  }

  function atTouchRange(firstToken, secondToken) {
    if (!firstToken || !secondToken) return false;
    if (firstToken === secondToken || firstToken?.id === secondToken?.id || firstToken?.document?.id === secondToken?.document?.id) return true;
    const first = tokenBounds(firstToken);
    const second = tokenBounds(secondToken);
    const gapX = Math.max(0, Math.max(first.x, second.x) - Math.min(first.x + first.width, second.x + second.width));
    const gapY = Math.max(0, Math.max(first.y, second.y) - Math.min(first.y + first.height, second.y + second.height));
    return gapX <= 1 && gapY <= 1;
  }

  if (!atTouchRange(casterToken, targetToken)) {
    ui.notifications?.warn?.(`${CONFIG.name} : la cible doit être au toucher.`);
    return false;
  }

  function targetTags(actorDoc) {
    const fromEngine = globalThis.Add2eEffectsEngine?.getContextTags?.(actorDoc)
      ?? globalThis.Add2eEffectsEngine?.getActiveTags?.(actorDoc)
      ?? [];
    const raw = [
      ...fromEngine,
      actorDoc?.type,
      actorDoc?.system?.tags,
      actorDoc?.system?.effectTags,
      actorDoc?.system?.type,
      actorDoc?.system?.type_monstre,
      actorDoc?.system?.categorie,
      actorDoc?.flags?.add2e?.tags
    ].flatMap(value => Array.isArray(value) ? value : String(value ?? "").split(/[,;|\n]+/g));
    return raw.map(normalize).filter(Boolean);
  }

  function cannotReceiveHealing(actorDoc) {
    const tags = targetTags(actorDoc);
    return tags.some(tag => (
      tag.includes("mort_vivant")
      || tag.includes("undead")
      || tag.includes("incorporel")
      || tag.includes("incorporeal")
      || tag.includes("immateriel")
      || tag.includes("ethereal")
      || tag === "immunite:soin"
      || tag === "immunity:healing"
    ));
  }

  const isMonster = ["monstre", "monster"].includes(normalize(targetActor.type));

  async function chooseMode() {
    const DialogV2 = foundry.applications?.api?.DialogV2;
    if (typeof DialogV2?.wait !== "function") {
      ui.notifications?.error?.(`${CONFIG.name} : DialogV2 est indisponible.`);
      return null;
    }

    const resistedContact = isMonster
      ? `<p style="margin:0;color:#6b3c27;font-size:.9em;">La cible est un monstre : <b>Blessures mineures</b> exigera automatiquement un jet de toucher.</p>`
      : `<label style="display:flex;gap:7px;align-items:center;margin-top:6px;"><input type="checkbox" name="resistsTouch"> La cible évite le contact : jet de toucher requis.</label>`;

    return DialogV2.wait({
      window: { title: `${CONFIG.name} — Choisir la facette` },
      content: `<form style="font-family:var(--font-primary);display:flex;flex-direction:column;gap:8px;"><p style="margin:0;">Choisis l'effet du sort au toucher.</p>${resistedContact}</form>`,
      buttons: [
        {
          action: "heal",
          label: "Soins mineurs",
          icon: "fa-solid fa-hands-praying",
          default: true,
          callback: () => ({ mode: "heal", resistsTouch: false })
        },
        {
          action: "harm",
          label: "Blessures mineures",
          icon: "fa-solid fa-hand-sparkles",
          callback: (_event, button) => ({
            mode: "harm",
            resistsTouch: isMonster || !!button?.form?.elements?.resistsTouch?.checked
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
  }

  async function roll(formula) {
    const result = await new Roll(formula).evaluate();
    if (game.dice3d) await game.dice3d.showForRoll(result);
    return result;
  }

  function hpMaximum(actorDoc) {
    const system = actorDoc?.system ?? {};
    const values = [
      system.points_de_coup,
      system.pdv_max,
      system.pv_max,
      system.hp?.max,
      system.attributes?.hp?.max
    ].map(Number).filter(value => Number.isFinite(value) && value >= 0);
    return values[0] ?? null;
  }

  function hpCurrent(actorDoc, max) {
    const system = actorDoc?.system ?? {};
    const values = [system.pdv, system.pv, system.hp?.value, system.attributes?.hp?.value]
      .map(Number).filter(Number.isFinite);
    return values[0] ?? max;
  }

  async function applyHealing(amount) {
    const max = hpMaximum(targetActor);
    if (max === null) {
      ui.notifications?.error?.(`${CONFIG.name} : PV maximum introuvables pour ${targetActor.name}.`);
      return null;
    }

    const before = hpCurrent(targetActor, max);
    const restored = Math.min(Math.max(0, Number(amount) || 0), Math.max(0, max - before));
    const after = before + restored;
    if (restored <= 0) return { before, after, restored, pending: false };

    if (game.user?.isGM || targetActor.isOwner) {
      await targetActor.update({ "system.pdv": after }, { add2eReason: "soins-mineurs" });
      await globalThis.add2eSyncActorVitalStatus?.(targetActor, { reason: "soins-mineurs" });
      return { before, after, restored, pending: false };
    }

    game.socket?.emit?.("system.add2e", {
      type: "applyDamage",
      actorId: targetActor.id,
      tokenId: targetToken?.id ?? targetToken?.document?.id ?? null,
      sceneId: canvas?.scene?.id ?? null,
      montant: -restored,
      damageType: "soin",
      details: "Soins mineurs"
    });
    return { before, after, restored, pending: true };
  }

  async function chatCard({ title, status, body, rule }) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      content: `<div class="add2e-chat-card add2e-spell-card add2e-spell-card-clerc" style="border:1px solid #75a86a;border-radius:9px;overflow:hidden;background:#f4faef;color:#24411f;font-family:var(--font-primary);"><header style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#2f6f3e;color:#fff;"><img src="${esc(spellItem.img ?? CONFIG.icon)}" style="width:32px;height:32px;border-radius:4px;object-fit:cover;background:#fff;"><div><b>${esc(caster.name)}</b><div style="font-size:.85em;">lance ${esc(title)}</div></div></header><section style="padding:10px;"><div style="font-weight:900;text-align:center;color:#1c7f41;">${esc(status)}</div><div style="margin-top:7px;line-height:1.4;">${body}</div><details style="margin-top:8px;border:1px solid #a7c99b;border-radius:5px;background:#fbfff8;padding:5px 7px;"><summary style="cursor:pointer;font-weight:700;">Règle appliquée</summary><div style="margin-top:5px;font-size:.9em;line-height:1.35;">${esc(rule)}</div></details></section></div>`,
      ...chatStyle()
    });
  }

  function buildTouchWeapon() {
    const id = foundry.utils.randomID();
    const tags = [
      "arme:toucher",
      "type_arme:toucher",
      "attaque:toucher",
      "attaque_speciale:contact",
      "usage:contact",
      "sort:blessures_mineures",
      "mod_carac:toucher:none",
      "mod_carac:degats:none"
    ];
    return {
      id,
      _id: id,
      type: "arme",
      name: CONFIG.touchWeaponName,
      img: spellItem.img ?? CONFIG.icon,
      system: {
        nom: CONFIG.touchWeaponName,
        equipee: true,
        equipped: true,
        categorie: "contact",
        category: "contact",
        type_arme: "toucher",
        type_degats: "magique",
        degats: CONFIG.healFormula,
        dégâts: { contre_moyen: CONFIG.healFormula, contre_grand: CONFIG.healFormula },
        bonus_hit: 0,
        bonus_dom: 0,
        portee_courte: 0,
        portee_moyenne: 0,
        portee_longue: 0,
        tags,
        effectTags: tags
      },
      flags: { add2e: { tags } }
    };
  }

  const choice = await chooseMode();
  if (!choice) return false;

  if (choice.mode === "heal") {
    if (cannotReceiveHealing(targetActor)) {
      ui.notifications?.warn?.(`${CONFIG.name} : cette cible ne peut pas recevoir de soins vitaux.`);
      return false;
    }

    const healingRoll = await roll(CONFIG.healFormula);
    const result = await applyHealing(healingRoll.total);
    if (!result) return false;

    await globalThis.ADD2E_PLAY_SPELL_FX?.("divine", { casterToken, targetToken });
    const receivedText = result.pending
      ? `Soins de <b>${result.restored}</b> PV demandés au MJ pour <b>${esc(targetActor.name)}</b>.`
      : `<b>${esc(targetActor.name)}</b> récupère <b>${result.restored}</b> PV (${result.before} → ${result.after}).`;
    await chatCard({
      title: CONFIG.name,
      status: "SOINS MINEURS",
      body: `${receivedText}<br><small>Jet : ${esc(healingRoll.result)}.</small>`,
      rule: "Au toucher, le sort rend 1d8 points de vie sans dépasser le maximum normal. Il n’affecte pas les morts-vivants ni les créatures sans corps matériel."
    });
    return true;
  }

  const requiresAttackRoll = isMonster || choice.resistsTouch === true;
  if (requiresAttackRoll) {
    const attack = globalThis.add2eAttackRoll;
    if (typeof attack !== "function") {
      ui.notifications?.error?.(`${CONFIG.touchWeaponName} : routine d’attaque indisponible.`);
      return false;
    }
    return (await attack({ actor: caster, arme: buildTouchWeapon(), token: casterToken, targetToken })) === true;
  }

  const damageRoll = await roll(CONFIG.healFormula);
  if (typeof globalThis.add2eApplyDamage !== "function") {
    ui.notifications?.error?.(`${CONFIG.touchWeaponName} : routine de dégâts indisponible.`);
    return false;
  }
  await globalThis.add2eApplyDamage({
    cible: targetToken,
    montant: Number(damageRoll.total) || 0,
    type: "magique",
    details: CONFIG.touchWeaponName
  });
  await chatCard({
    title: CONFIG.touchWeaponName,
    status: "BLESSURES MINEURES",
    body: `<b>${esc(targetActor.name)}</b> reçoit <b>${Number(damageRoll.total) || 0}</b> dégâts.<br><small>Jet : ${esc(damageRoll.result)}.</small>`,
    rule: "La forme inversée inflige 1d8 dégâts au toucher. Une cible qui ne cherche pas à éviter le contact ne nécessite pas de jet de toucher."
  });
  return true;
})();

return __add2eMinorCureResult;