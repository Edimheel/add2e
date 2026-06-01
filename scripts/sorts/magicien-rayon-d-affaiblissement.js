// ADD2E — onUse Magicien : Rayon d’affaiblissement
// Version : 2026-05-28-magicien-attaque-n2-rayon-affaiblissement-v1
// Contrat : return true = sort consommé ; return false = sort non consommé.

return await (async () => {
  const TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][RAYON_AFFAIBLISSEMENT]";
  const SPELL = {
    name: "Rayon d’affaiblissement",
    slug: "rayon_d_affaiblissement",
    level: 2,
    school: "Évocation",
    rangeText: "10 m + 5 m/niveau",
    areaText: "une créature",
    saveText: "Annule",
    castingTimeText: "2 segments",
    componentsText: "V, S",
    imgFallback: "systems/add2e/assets/icones/sorts/rayon-d-affaiblissement.webp",
    description: "Avec ce sort, le magicien peut affaiblir un ennemi en réduisant sa force, et donc sa capacité de combat, de 25 % ou plus. Pour chaque niveau du lanceur de sort au-dessus du 3e, le pourcentage augmente de 2 % ; donc un magicien de niveau 4 réduira la force d’un adversaire de 27 %. La portée et la durée du sort dépendent aussi du niveau du magicien. Par exemple, si une créature est touchée par un rayon d’affaiblissement, elle perd le pourcentage approprié de dégâts qu’elle peut infliger par une attaque physique. Le MD déterminera les autres réductions à appliquer. Si la créature visée réussit son jet de protection, le sort n’a aucun effet."
  };

  const esc = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
  const n = (value, fallback = 0) => { const out = Number(value); return Number.isFinite(out) ? out : fallback; };

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

  function metersPerGridCell() {
    const grid = canvas.scene?.grid ?? canvas.grid;
    const raw = n(grid?.distance, 0);
    const units = String(grid?.units ?? "").trim().toLowerCase();
    if (raw > 0 && /^(m|meter|meters|metre|metres|mètre|mètres)$/.test(units)) return raw;
    if (raw > 0 && /^(ft|feet|foot|pied|pieds)$/.test(units)) return raw * 0.3048;
    if (raw > 1) return raw;
    return 1.5;
  }

  function gridSizePx() {
    return canvas.grid?.size || canvas.dimensions?.size || 100;
  }

  function rangeMeters(level) {
    return 10 + 5 * Math.max(1, level);
  }

  function distanceMeters(a, b) {
    const ac = a.center ?? { x: a.document.x, y: a.document.y };
    const bc = b.center ?? { x: b.document.x, y: b.document.y };
    return Math.hypot((bc.x ?? 0) - (ac.x ?? 0), (bc.y ?? 0) - (ac.y ?? 0)) / gridSizePx() * metersPerGridCell();
  }

  function selectedSingleTarget() {
    const targets = Array.from(game.user.targets ?? []).filter(t => t?.actor);
    if (targets.length !== 1) {
      ui.notifications.warn(`${SPELL.name} : cible exactement une créature.`);
      return null;
    }
    return targets[0];
  }

  async function askSaveResult({ targetToken, level, reductionPercent, durationRounds }) {
    const DialogV2 = foundry?.applications?.api?.DialogV2;
    if (!DialogV2?.wait) {
      ui.notifications.error(`${SPELL.name} : DialogV2 indisponible.`);
      return null;
    }

    const content = `
      <form class="add2e-dialog-v2" style="min-width:380px;max-width:480px;font-family:var(--font-primary);color:#2d2144;">
        <section style="border:1px solid #8e63c7;border-radius:8px;background:#f6f0ff;padding:9px;margin-bottom:8px;">
          <div style="font-weight:900;color:#6c31b5;text-transform:uppercase;text-align:center;">${esc(SPELL.name)}</div>
          <p style="margin:.4em 0 0;font-size:13px;text-align:center;">${esc(targetToken.name)} effectue un jet de protection contre les sorts.</p>
        </section>
        <section style="border:1px solid #8e63c7;border-radius:8px;background:#fffaff;padding:8px;font-size:13px;line-height:1.35;">
          <p><b>Affaiblissement en cas d’échec :</b> ${reductionPercent}%.</p>
          <p><b>Durée :</b> ${durationRounds} round${durationRounds > 1 ? "s" : ""}.</p>
        </section>
      </form>`;

    return await DialogV2.wait({
      window: { title: SPELL.name, icon: "fas fa-bolt" },
      content,
      modal: true,
      rejectClose: false,
      buttons: [
        { action: "failed", label: "Jet raté", icon: "fas fa-skull", callback: () => "failed" },
        { action: "saved", label: "Jet réussi", icon: "fas fa-shield-halved", default: true, callback: () => "saved" },
        { action: "cancel", label: "Annuler", icon: "fas fa-times", callback: () => null }
      ]
    });
  }

  async function createWeaknessEffect(targetActor, sourceItem, level, reductionPercent, durationRounds) {
    if (!targetActor) return false;
    const existing = targetActor.effects?.find?.(e => e.flags?.add2e?.spell === SPELL.slug);
    if (existing) await existing.delete();
    await targetActor.createEmbeddedDocuments("ActiveEffect", [{
      name: `${SPELL.name} (${reductionPercent}%)`,
      img: sourceItem?.img || SPELL.imgFallback,
      disabled: false,
      transfer: false,
      type: "base",
      system: {},
      changes: [],
      duration: {
        rounds: durationRounds,
        startRound: game.combat?.round ?? null,
        startTime: game.time?.worldTime ?? null,
        combat: game.combat?.id ?? null
      },
      description: SPELL.description,
      flags: {
        add2e: {
          spell: SPELL.slug,
          tags: ["classe:magicien", "liste:magicien", "niveau:2", "sort:rayon_d_affaiblissement", "type:affaiblissement", "malus:degats_physiques"],
          reductionPercent,
          casterLevel: level
        }
      }
    }]);
    return true;
  }

  async function createChat({ caster, sourceItem, sourceToken, targetToken, saveResult, reductionPercent, durationRounds, distance, range }) {
    const casterName = caster?.name ?? sourceToken?.name ?? "Magicien";
    const casterImg = sourceToken?.document?.texture?.src ?? caster?.img ?? "icons/svg/mystery-man.svg";
    const spellImg = sourceItem?.img || SPELL.imgFallback || "icons/svg/lightning.svg";
    const outcome = saveResult === "failed" ? `Affaiblissement de ${reductionPercent}%` : "Jet de protection réussi";

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster, token: sourceToken }),
      content: `
        <div class="add2e-chat-card add2e-magicien-sort add2e-sort-rayon-affaiblissement" style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary);">
          <div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px;">
            <img src="${esc(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff;" />
            <div style="flex:1;line-height:1.05;"><div style="font-weight:800;font-size:14px;">${esc(casterName)}</div><div style="font-size:12px;font-weight:700;">lance ${esc(SPELL.name)}</div></div>
            <div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">Magicien niv. 2</div>
            <img src="${esc(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;" />
          </div>
          <div style="padding:9px 10px 10px;background:#f6f0ff;">
            <div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;margin-bottom:7px;text-align:center;">
              <div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;">${esc(outcome)}</div>
              <p style="margin:.35em 0;font-size:13px;line-height:1.35;"><b>Cible :</b> ${esc(targetToken.name)}</p>
              ${saveResult === "failed" ? `<p style="margin:.35em 0;font-size:13px;line-height:1.35;"><b>Durée :</b> ${durationRounds} round${durationRounds > 1 ? "s" : ""}.</p>` : ""}
            </div>
            <details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;margin-top:7px;">
              <summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Détails du sort</summary>
              <div style="margin-top:5px;font-size:12px;line-height:1.35;">
                <p><b>École :</b> ${esc(SPELL.school)} — <b>Portée :</b> ${esc(SPELL.rangeText)} (${distance.toFixed(1)} m / ${range.toFixed(1)} m) — <b>Zone :</b> ${esc(SPELL.areaText)}.</p>
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
  if (!sourceItem || !caster || !sourceToken) {
    ui.notifications.warn(`${SPELL.name} : lanceur ou sort introuvable.`);
    return false;
  }

  const targetToken = selectedSingleTarget();
  if (!targetToken) return false;
  if (targetToken.id === sourceToken.id || targetToken.actor?.id === caster.id) {
    ui.notifications.warn(`${SPELL.name} : cible une autre créature.`);
    return false;
  }

  const level = casterLevel(caster);
  const range = rangeMeters(level);
  const dist = distanceMeters(sourceToken, targetToken);
  if (dist > range + 0.001) {
    ui.notifications.warn(`${SPELL.name} : cible hors portée.`);
    console.log(`${TAG}[OUT_OF_RANGE]`, { caster: caster.name, target: targetToken.name, dist, range });
    return false;
  }

  const reductionPercent = 25 + Math.max(0, level - 3) * 2;
  const durationRounds = Math.max(1, level);
  const saveResult = await askSaveResult({ targetToken, level, reductionPercent, durationRounds });
  if (!saveResult) return false;

  if (saveResult === "failed") await createWeaknessEffect(targetToken.actor, sourceItem, level, reductionPercent, durationRounds);
  await createChat({ caster, sourceItem, sourceToken, targetToken, saveResult, reductionPercent, durationRounds, distance: dist, range });

  console.log(`${TAG}[DONE]`, { caster: caster.name, target: targetToken.name, level, reductionPercent, durationRounds, saveResult });
  return true;
})();
