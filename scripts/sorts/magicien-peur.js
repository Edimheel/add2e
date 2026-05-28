// ADD2E — onUse Magicien : Peur
// Version : 2026-05-28-magicien-attaque-n2-peur-v1
// Contrat : return true = sort consommé ; return false = sort non consommé.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][PEUR]";
  const SPELL = {
    name: "Peur",
    slug: "peur",
    level: 2,
    school: "Illusion/Fantasme",
    rangeText: "0",
    areaText: "cône de peur devant le lanceur",
    saveText: "Annule",
    castingTimeText: "2 segments",
    componentsText: "V, S, M",
    imgFallback: "systems/add2e/assets/icones/sorts/peur.webp",
    description: "Ce sort projette devant le magicien une vague de terreur. Les créatures prises dans la zone doivent réussir un jet de protection contre les sorts, ou fuir le lanceur aussi vite que possible. Les objets tenus peuvent être lâchés selon l’arbitrage du MD."
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

  async function askResults(targets, durationRounds) {
    const DialogV2 = foundry?.applications?.api?.DialogV2;
    if (!DialogV2?.wait) { ui.notifications.error(`${SPELL.name} : DialogV2 indisponible.`); return null; }
    const rows = targets.map(t => `
      <label style="display:grid;grid-template-columns:34px 1fr 120px;gap:8px;align-items:center;border:1px solid #8e63c7;border-radius:7px;background:#fffaff;padding:6px;margin-bottom:5px;">
        <img src="${esc(t.document?.texture?.src || t.actor?.img || 'icons/svg/mystery-man.svg')}" style="width:32px;height:32px;border-radius:5px;object-fit:cover;">
        <span style="font-weight:900;color:#2d2144;">${esc(t.name)}</span>
        <select name="target.${esc(t.id)}" style="width:100%;"><option value="failed">JP raté</option><option value="saved">JP réussi</option></select>
      </label>`).join("");
    return await DialogV2.wait({
      window: { title: SPELL.name, icon: "fas fa-ghost" },
      modal: true,
      rejectClose: false,
      content: `<form style="min-width:430px;max-width:560px;font-family:var(--font-primary);color:#2d2144;"><section style="border:1px solid #8e63c7;border-radius:9px;background:#f6f0ff;padding:8px;margin-bottom:8px;text-align:center;"><b style="color:#6c31b5;text-transform:uppercase;">Peur</b><br><span style="font-size:12px;">Indique le résultat du jet de protection contre les sorts. Durée de l’effet : ${durationRounds} round${durationRounds>1?'s':''}.</span></section>${rows}</form>`,
      buttons: [
        { action: "apply", label: "Appliquer", icon: "fas fa-check", default: true, callback: (_e,_b,dialog) => { const form = dialog.element?.querySelector("form"); const data = new FormData(form); return Object.fromEntries(targets.map(t => [t.id, data.get(`target.${t.id}`) || "failed"])); } },
        { action: "cancel", label: "Annuler", icon: "fas fa-times", callback: () => null }
      ]
    });
  }

  async function applyFear(targetActor, sourceItem, durationRounds) {
    if (!targetActor) return false;
    const existing = targetActor.effects?.filter?.(e => e.flags?.add2e?.spell === SPELL.slug) ?? [];
    for (const e of existing) await e.delete();
    await targetActor.createEmbeddedDocuments("ActiveEffect", [{
      name: `${SPELL.name} — effrayé`,
      img: sourceItem?.img || SPELL.imgFallback,
      disabled: false,
      transfer: false,
      type: "base",
      system: {},
      changes: [],
      duration: { rounds: durationRounds, startRound: game.combat?.round ?? null, startTime: game.time?.worldTime ?? null, combat: game.combat?.id ?? null },
      description: SPELL.description,
      flags: { add2e: { spell: SPELL.slug, tags: ["classe:magicien","liste:magicien","niveau:2","sort:peur","type:condition","etat:peur","fuite"] } }
    }]);
    return true;
  }

  async function chat(targets, results, durationRounds) {
    const casterName = caster?.name ?? casterToken?.name ?? "Magicien";
    const casterImg = casterToken?.document?.texture?.src ?? caster?.img ?? "icons/svg/mystery-man.svg";
    const spellImg = sourceItem?.img || SPELL.imgFallback;
    const rows = targets.map(t => `<tr><td style="padding:4px 6px;"><b>${esc(t.name)}</b></td><td style="padding:4px 6px;text-align:center;">${results[t.id] === 'failed' ? 'Fuit' : 'Résiste'}</td></tr>`).join("");
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }), content: `
      <div class="add2e-chat-card add2e-magicien-sort add2e-sort-peur" style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px;"><img src="${esc(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff;"><div style="flex:1;line-height:1.05;"><div style="font-weight:800;font-size:14px;">${esc(casterName)}</div><div style="font-size:12px;font-weight:700;">lance ${esc(SPELL.name)}</div></div><div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">Magicien niv. 2</div><img src="${esc(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;"></div>
        <div style="padding:9px 10px 10px;background:#f6f0ff;"><div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;margin-bottom:7px;"><div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;text-align:center;">Terreur magique</div><table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:13px;"><thead><tr><th style="text-align:left;padding:4px 6px;">Créature</th><th>Résultat</th></tr></thead><tbody>${rows}</tbody></table>${durationRounds ? `<p style="font-size:12px;text-align:center;margin:.5em 0 0;">Durée des effets : ${durationRounds} round${durationRounds>1?'s':''}.</p>` : ''}</div>
        <details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;"><summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Détails du sort</summary><div style="margin-top:5px;font-size:12px;line-height:1.35;"><p><b>École :</b> ${esc(SPELL.school)} — <b>Portée :</b> ${esc(SPELL.rangeText)} — <b>Zone :</b> ${esc(SPELL.areaText)}.</p><p><b>Composantes :</b> ${esc(SPELL.componentsText)} — <b>Incantation :</b> ${esc(SPELL.castingTimeText)} — <b>Jet de sauvegarde :</b> ${esc(SPELL.saveText)}.</p><p>${esc(SPELL.description)}</p></div></details></div>
      </div>` });
  }

  if (!sourceItem || !caster || !casterToken) { ui.notifications.warn(`${SPELL.name} : lanceur ou sort introuvable.`); return false; }
  const targets = Array.from(game.user.targets ?? []).filter(t => t?.actor && t.id !== casterToken.id);
  if (!targets.length) { ui.notifications.warn(`${SPELL.name} : cible les créatures dans la zone de peur.`); return false; }
  const level = casterLevel();
  const durationRounds = Math.max(1, level);
  const results = await askResults(targets, durationRounds);
  if (!results) return false;
  for (const t of targets) if (results[t.id] === "failed") await applyFear(t.actor, sourceItem, durationRounds);
  await chat(targets, results, durationRounds);
  console.log(`${TAG}[DONE]`, { caster: caster.name, level, durationRounds, targets: targets.map(t => t.name), results });
  return true;
})();
