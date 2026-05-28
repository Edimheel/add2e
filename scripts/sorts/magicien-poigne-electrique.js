// ADD2E — onUse Magicien : Poigne électrique
// Version : 2026-05-28-groupe-a-chat-description-v2
// Contrat : return true = sort consommé ; return false = sort non consommé.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][POIGNE_ELECTRIQUE]";
  const SPELL = {
    name: "Poigne électrique",
    slug: "poigne_electrique",
    level: 1,
    school: "Altération",
    rangeText: "toucher",
    areaText: "créature touchée",
    saveText: "Aucun",
    castingTimeText: "1 segment",
    componentsText: "V, S",
    damageType: "electricite",
    imgFallback: "systems/add2e/assets/icones/sorts/magicien-poigne-electrique.webp",
    description: "Quand un magicien lance ce sort, il développe une puissante charge électrique qui provoque une secousse chez la créature touchée. Ce choc inflige de 1 à 8 points de dégâts (1d8) plus 1 point par niveau du magicien ; c.-à-d. qu’un magicien de niveau 2 infligera de 3 à 10 points de dégâts. Le magicien doit juste toucher la victime pour que la décharge électrique ait lieu ; mais si la victime touche d’elle-même le magicien, le sort ne se décharge pas."
  };

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function n(value, fallback = 0) {
    const out = Number(value);
    return Number.isFinite(out) ? out : fallback;
  }

  function sourceItemFromContext() {
    if (typeof item !== "undefined" && item) return item;
    if (typeof sort !== "undefined" && sort) return sort;
    if (typeof spell !== "undefined" && spell) return spell;
    if (typeof args !== "undefined" && args?.[0]?.item) return args[0].item;
    if (typeof this !== "undefined" && this?.documentName === "Item") return this;
    return null;
  }

  function casterFromContext(sourceItem) {
    return (typeof actor !== "undefined" && actor) ? actor : sourceItem?.parent;
  }

  function casterTokenFor(caster) {
    if (typeof token !== "undefined" && token?.actor?.id === caster?.id) return token;
    return canvas.tokens?.controlled?.find(t => t.actor?.id === caster?.id)
      ?? caster?.getActiveTokens?.()[0]
      ?? canvas.tokens?.controlled?.[0]
      ?? null;
  }

  function casterLevel(caster) {
    const details = caster?.system?.details_classe ?? {};
    const byClass = n(details.magicien?.niveau ?? details.mage?.niveau ?? details.illusionniste?.niveau, 0);
    if (byClass > 0) return byClass;
    const classItem = caster?.items?.find?.(i => String(i.type).toLowerCase() === "classe" && /magicien|mage|illusionniste/i.test(i.name ?? ""));
    const byItem = n(classItem?.system?.niveau ?? classItem?.system?.level, 0);
    return byItem > 0 ? byItem : Math.max(1, n(caster?.system?.niveau ?? caster?.system?.level ?? caster?.system?.details?.niveau, 1));
  }

  function selectedSingleTarget() {
    const targets = Array.from(game.user.targets ?? []).filter(t => t?.actor);
    if (targets.length !== 1) {
      ui.notifications.warn(`${SPELL.name} : cible exactement une créature au contact.`);
      return null;
    }
    return targets[0];
  }

  function tokensAuContact(a, b) {
    if (!a || !b || a.id === b.id) return false;
    const gridSize = canvas.grid?.size || 100;
    const ax1 = a.document.x / gridSize;
    const ay1 = a.document.y / gridSize;
    const ax2 = ax1 + (a.document.width || 1);
    const ay2 = ay1 + (a.document.height || 1);
    const bx1 = b.document.x / gridSize;
    const by1 = b.document.y / gridSize;
    const bx2 = bx1 + (b.document.width || 1);
    const by2 = by1 + (b.document.height || 1);
    const gapX = Math.max(0, bx1 - ax2, ax1 - bx2);
    const gapY = Math.max(0, by1 - ay2, ay1 - by2);
    return gapX <= 0.01 && gapY <= 0.01;
  }

  function emitGmOperation(operation, payload) {
    game.socket?.emit?.("system.add2e", { type: "ADD2E_GM_OPERATION", operation, payload });
  }

  async function applyDamage(targetToken, amount, caster, sourceItem) {
    if (!targetToken?.actor || amount <= 0) return false;
    const payload = {
      actorUuid: targetToken.actor.uuid,
      actorId: targetToken.actor.id,
      sceneId: canvas.scene?.id,
      tokenId: targetToken.document?.id ?? targetToken.id,
      montant: amount,
      type: SPELL.damageType,
      details: `${SPELL.name} — ${amount} dégât${amount > 1 ? "s" : ""} électriques`,
      sourceItemId: sourceItem?.id ?? null,
      sourceItemUuid: sourceItem?.uuid ?? null,
      casterId: caster?.id ?? null,
      casterUuid: caster?.uuid ?? null
    };

    if (typeof globalThis.add2eApplyDamage === "function") {
      await globalThis.add2eApplyDamage({ cible: targetToken, montant: amount, type: SPELL.damageType, details: payload.details });
      return true;
    }

    if (game.user.isGM || targetToken.actor.isOwner) {
      const sys = targetToken.actor.system ?? {};
      const current = [sys.pdv, sys.pv, sys.hp?.value, sys.attributes?.hp?.value].map(Number).find(Number.isFinite);
      if (current !== undefined) {
        await targetToken.actor.update({ "system.pdv": current - amount }, { add2eReason: "poigne-electrique" });
        return true;
      }
    }

    emitGmOperation("applyDamage", payload);
    return true;
  }

  async function createChat({ caster, sourceItem, sourceToken, targetToken, roll }) {
    const casterName = caster?.name ?? sourceToken?.name ?? "Magicien";
    const casterImg = sourceToken?.document?.texture?.src ?? caster?.img ?? "icons/svg/mystery-man.svg";
    const spellImg = sourceItem?.img || SPELL.imgFallback || "icons/svg/lightning.svg";
    const targetName = targetToken?.name ?? targetToken?.actor?.name ?? "—";

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster, token: sourceToken }),
      content: `
        <div class="add2e-chat-card add2e-magicien-sort add2e-sort-poigne-electrique"
             style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary);">
          <div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px;">
            <img src="${esc(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff;" />
            <div style="flex:1;line-height:1.05;">
              <div style="font-weight:800;font-size:14px;">${esc(casterName)}</div>
              <div style="font-size:12px;font-weight:700;">lance ${esc(SPELL.name)}</div>
            </div>
            <div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">Magicien niv. 1</div>
            <img src="${esc(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;" />
          </div>
          <div style="padding:9px 10px 10px 10px;background:#f6f0ff;">
            <div style="font-size:13px;margin:0 0 6px 0;"><b>Cible :</b> ${esc(targetName)}</div>
            <div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;margin-bottom:7px;text-align:center;">
              <div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;">Décharge au toucher</div>
              <p style="margin:.35em 0;font-size:13px;line-height:1.35;"><b>Dégâts :</b> ${esc(roll.formula)} = <b>${roll.total}</b>.</p>
            </div>
            <details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;margin-top:7px;">
              <summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Détails du sort</summary>
              <div style="margin-top:5px;font-size:12px;line-height:1.35;">
                <p><b>École :</b> ${esc(SPELL.school)} — <b>Portée :</b> ${esc(SPELL.rangeText)} — <b>Zone :</b> ${esc(SPELL.areaText)}.</p>
                <p><b>Composantes :</b> ${esc(SPELL.componentsText)} — <b>Incantation :</b> ${esc(SPELL.castingTimeText)} — <b>Jet de sauvegarde :</b> ${esc(SPELL.saveText)}.</p>
                <p>${esc(SPELL.description)}</p>
              </div>
            </details>
          </div>
        </div>`
    });
  }

  const sourceItem = sourceItemFromContext();
  const caster = casterFromContext(sourceItem);
  const sourceToken = casterTokenFor(caster);

  if (!sourceItem) {
    ui.notifications.warn(`${SPELL.name} : sort introuvable.`);
    return false;
  }
  if (!caster || !sourceToken) {
    ui.notifications.warn(`${SPELL.name} : lanceur ou token lanceur introuvable.`);
    return false;
  }

  const targetToken = selectedSingleTarget();
  if (!targetToken) return false;

  if (targetToken.id === sourceToken.id || targetToken.actor?.id === caster.id) {
    ui.notifications.warn(`${SPELL.name} : cible une autre créature au contact.`);
    return false;
  }

  if (!tokensAuContact(sourceToken, targetToken)) {
    ui.notifications.warn(`${SPELL.name} : la cible doit être au contact du lanceur.`);
    console.log(`${TAG}[OUT_OF_TOUCH_RANGE]`, { caster: caster.name, sourceToken: sourceToken.name, target: targetToken.name });
    return false;
  }

  const level = casterLevel(caster);
  const roll = await new Roll(`1d8+${Math.max(1, level)}`).evaluate({ async: true });
  if (game.dice3d) await game.dice3d.showForRoll(roll);

  await applyDamage(targetToken, Number(roll.total) || 0, caster, sourceItem);
  await createChat({ caster, sourceItem, sourceToken, targetToken, roll });

  console.log(`${TAG}[DONE]`, {
    caster: caster.name,
    target: targetToken.name,
    level,
    formula: roll.formula,
    total: roll.total
  });

  return true;
})();
