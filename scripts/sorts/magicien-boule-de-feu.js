// ADD2E — onUse Magicien : Boule de feu
// Version : 2026-05-28-magicien-attaque-n3-boule-feu-v1
// Contrat : return true = sort consommé ; return false = sort non consommé.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][BOULE_DE_FEU]";
  const SPELL = {
    name: "Boule de feu",
    slug: "boule_de_feu",
    level: 3,
    school: "Évocation",
    rangeText: "10 m + 10 m/niveau",
    areaText: "sphère de 6 m de rayon",
    saveText: "1/2 dégâts",
    castingTimeText: "3 segments",
    componentsText: "V, S, M",
    damageType: "feu",
    imgFallback: "systems/add2e/assets/icones/sorts/boule-de-feu.webp",
    description: "Une boule de feu est une explosion de flammes qui éclate avec un grondement sourd et inflige 1d6 points de dégâts par niveau du magicien, jusqu’à un maximum de 10d6. Les créatures prises dans la zone peuvent réussir un jet de protection contre les sorts pour ne subir que la moitié des dégâts. La boule de feu enflamme les combustibles et peut faire fondre les métaux tendres exposés, selon l’arbitrage du MD."
  };

  const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
  const n = (v,f=0) => { const x = Number(v); return Number.isFinite(x) ? x : f; };
  const sourceItem = (() => { if (typeof item !== "undefined" && item) return item; if (typeof sort !== "undefined" && sort) return sort; if (typeof spell !== "undefined" && spell) return spell; if (typeof args !== "undefined" && args?.[0]?.item) return args[0].item; return null; })();
  const caster = (typeof actor !== "undefined" && actor) ? actor : sourceItem?.parent;
  const casterToken = (() => { if (typeof token !== "undefined" && token?.actor?.id === caster?.id) return token; return canvas.tokens?.controlled?.find(t => t.actor?.id === caster?.id) ?? caster?.getActiveTokens?.()[0] ?? canvas.tokens?.controlled?.[0] ?? null; })();

  function casterLevel() {
    const d = caster?.system?.details_classe ?? {};
    const byClass = n(d.magicien?.niveau ?? d.mage?.niveau ?? d.illusionniste?.niveau, 0);
    if (byClass > 0) return byClass;
    const classItem = caster?.items?.find?.(i => String(i.type).toLowerCase() === "classe" && /magicien|mage|illusionniste/i.test(i.name ?? ""));
    return Math.max(1, n(classItem?.system?.niveau ?? classItem?.system?.level ?? caster?.system?.niveau ?? caster?.system?.level ?? caster?.system?.details?.niveau, 1));
  }

  function emitGmOperation(operation, payload) { game.socket?.emit?.("system.add2e", { type: "ADD2E_GM_OPERATION", operation, payload }); }

  async function applyDamage(targetToken, amount) {
    if (!targetToken?.actor || amount <= 0) return false;
    const payload = { actorUuid: targetToken.actor.uuid, actorId: targetToken.actor.id, sceneId: canvas.scene?.id, tokenId: targetToken.document?.id ?? targetToken.id, montant: amount, type: SPELL.damageType, details: `${SPELL.name} — ${amount} dégât${amount > 1 ? "s" : ""} de feu`, casterId: caster?.id ?? null, casterUuid: caster?.uuid ?? null, sourceItemId: sourceItem?.id ?? null, sourceItemUuid: sourceItem?.uuid ?? null };
    if (typeof globalThis.add2eApplyDamage === "function") { await globalThis.add2eApplyDamage({ cible: targetToken, montant: amount, type: SPELL.damageType, details: payload.details }); return true; }
    if (game.user.isGM || targetToken.actor.isOwner) {
      const sys = targetToken.actor.system ?? {};
      const current = [sys.pdv, sys.pv, sys.hp?.value, sys.attributes?.hp?.value].map(Number).find(Number.isFinite);
      if (current !== undefined) { await targetToken.actor.update({ "system.pdv": current - amount }, { add2eReason: "boule-de-feu" }); return true; }
    }
    emitGmOperation("applyDamage", payload);
    return true;
  }

  async function askSaveResults(targets, roll) {
    const DialogV2 = foundry?.applications?.api?.DialogV2;
    if (!DialogV2?.wait) { ui.notifications.error(`${SPELL.name} : DialogV2 indisponible.`); return null; }
    const rows = targets.map(t => `<label style="display:grid;grid-template-columns:34px 1fr 125px;gap:8px;align-items:center;border:1px solid #8e63c7;border-radius:7px;background:#fffaff;padding:6px;margin-bottom:5px;"><img src="${esc(t.document?.texture?.src || t.actor?.img || 'icons/svg/mystery-man.svg')}" style="width:32px;height:32px;border-radius:5px;object-fit:cover;"><span style="font-weight:900;color:#2d2144;">${esc(t.name)}</span><select name="target.${esc(t.id)}"><option value="failed">JP raté</option><option value="saved">JP réussi</option></select></label>`).join("");
    return await DialogV2.wait({
      window: { title: SPELL.name, icon: "fas fa-fire" }, modal: true, rejectClose: false,
      content: `<form style="min-width:450px;max-width:580px;font-family:var(--font-primary);color:#2d2144;"><section style="border:1px solid #8e63c7;border-radius:9px;background:#f6f0ff;padding:8px;margin-bottom:8px;text-align:center;"><b style="color:#6c31b5;text-transform:uppercase;">Boule de feu</b><br><span style="font-size:12px;">Dégâts : ${esc(roll.formula)} = <b>${roll.total}</b>. Jet réussi : moitié.</span></section>${rows}</form>`,
      buttons: [
        { action: "apply", label: "Appliquer", icon: "fas fa-check", default: true, callback: (_e,_b,dialog) => { const form = dialog.element?.querySelector("form"); const data = new FormData(form); return Object.fromEntries(targets.map(t => [t.id, data.get(`target.${t.id}`) || "failed"])); } },
        { action: "cancel", label: "Annuler", icon: "fas fa-times", callback: () => null }
      ]
    });
  }

  async function chat(targets, results, roll, appliedRows) {
    const casterName = caster?.name ?? casterToken?.name ?? "Magicien";
    const casterImg = casterToken?.document?.texture?.src ?? caster?.img ?? "icons/svg/mystery-man.svg";
    const spellImg = sourceItem?.img || SPELL.imgFallback;
    const rows = appliedRows.map(r => `<tr><td style="padding:4px 6px;"><b>${esc(r.name)}</b></td><td style="padding:4px 6px;text-align:center;">${r.saved ? "Réussi" : "Raté"}</td><td style="padding:4px 6px;text-align:right;"><b>${r.damage}</b></td></tr>`).join("");
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }), content: `<div class="add2e-chat-card add2e-magicien-sort add2e-sort-boule-de-feu" style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary);"><div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px;"><img src="${esc(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff;"><div style="flex:1;line-height:1.05;"><div style="font-weight:800;font-size:14px;">${esc(casterName)}</div><div style="font-size:12px;font-weight:700;">lance ${esc(SPELL.name)}</div></div><div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">Magicien niv. 3</div><img src="${esc(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;"></div><div style="padding:9px 10px 10px;background:#f6f0ff;"><div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;margin-bottom:7px;"><div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;text-align:center;">Explosion de feu</div><table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:13px;"><thead><tr><th style="text-align:left;padding:4px 6px;">Créature</th><th>JP</th><th style="text-align:right;padding:4px 6px;">Dégâts</th></tr></thead><tbody>${rows}</tbody></table></div><details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;"><summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Détails du sort</summary><div style="margin-top:5px;font-size:12px;line-height:1.35;"><p><b>École :</b> ${esc(SPELL.school)} — <b>Portée :</b> ${esc(SPELL.rangeText)} — <b>Zone :</b> ${esc(SPELL.areaText)}.</p><p><b>Composantes :</b> ${esc(SPELL.componentsText)} — <b>Incantation :</b> ${esc(SPELL.castingTimeText)} — <b>Jet de sauvegarde :</b> ${esc(SPELL.saveText)}.</p><p>${esc(SPELL.description)}</p></div></details></div></div>` });
  }

  if (!sourceItem || !caster || !casterToken) { ui.notifications.warn(`${SPELL.name} : lanceur ou sort introuvable.`); return false; }
  const targets = Array.from(game.user.targets ?? []).filter(t => t?.actor && t.id !== casterToken.id);
  if (!targets.length) { ui.notifications.warn(`${SPELL.name} : cible les créatures prises dans l’explosion.`); return false; }
  const level = casterLevel();
  const formula = `${Math.max(1, Math.min(10, level))}d6`;
  const roll = await new Roll(formula).evaluate({ async: true });
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  const results = await askSaveResults(targets, roll);
  if (!results) return false;
  const rows = [];
  for (const t of targets) { const saved = results[t.id] === "saved"; const damage = saved ? Math.floor(roll.total / 2) : roll.total; await applyDamage(t, damage); rows.push({ name: t.name, saved, damage }); }
  await chat(targets, results, roll, rows);
  console.log(`${TAG}[DONE]`, { caster: caster.name, level, formula, total: roll.total, rows });
  return true;
})();
