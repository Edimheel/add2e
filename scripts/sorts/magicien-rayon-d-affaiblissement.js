// ADD2E — onUse Magicien : Rayon d’affaiblissement
// Version : 2026-09-18-common-ui-chat-v2
// Contrat : return true = sort consommé ; return false = sort non consommé.
// Compatible Foundry V13/V14/V15.

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

  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error(`${SPELL.name} : l’API de fenêtre ADD2E est indisponible.`);
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error(`${SPELL.name} : les constructeurs communs de cartes ADD2E sont indisponibles.`);
  }

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

  async function askSaveResult({ targetToken, reductionPercent, durationRounds }) {
    const content = `
      <form class="add2e-rayon-affaiblissement-form">
        <p><b>Cible :</b> ${esc(targetToken.name)}</p>
        <p>La cible effectue un jet de protection contre les sorts.</p>
        <p><b>Affaiblissement en cas d’échec :</b> ${reductionPercent}%.</p>
        <p><b>Durée :</b> ${durationRounds} round${durationRounds > 1 ? "s" : ""}.</p>
      </form>`;

    return globalThis.add2eDialogWait({
      add2eTheme: "wizard",
      add2ePrimaryAction: "saved",
      add2eClasses: ["add2e-rayon-affaiblissement-dialog"],
      window: { title: SPELL.name },
      content,
      buttons: [
        {
          action: "failed",
          label: "Jet raté",
          icon: "<i class='fas fa-skull'></i>",
          callback: () => "failed"
        },
        {
          action: "saved",
          label: "Jet réussi",
          icon: "<i class='fas fa-shield-halved'></i>",
          default: true,
          callback: () => "saved"
        },
        {
          action: "cancel",
          label: "Annuler",
          icon: "<i class='fas fa-times'></i>",
          callback: () => null
        }
      ],
      close: () => null
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

  async function createChat({ caster, sourceItem, sourceToken, targetToken, saveResult, reductionPercent, durationRounds, distance, range, level }) {
    const failed = saveResult === "failed";
    const card = {
      actor: caster,
      title: SPELL.name,
      icon: "fas fa-bolt",
      variant: failed ? "failure" : "success",
      source: {
        name: caster?.name ?? sourceToken?.name ?? "Magicien",
        img: sourceToken?.document?.texture?.src ?? caster?.img ?? sourceItem?.img ?? SPELL.imgFallback,
        type: "Sort profane",
        meta: `Niveau de lanceur ${level}`
      },
      target: {
        name: targetToken.name ?? targetToken.actor?.name ?? "Cible",
        img: targetToken.actor?.img,
        type: "Créature ciblée",
        meta: `${distance.toFixed(1)} m / ${range.toFixed(1)} m`
      },
      rows: [
        { label: "Jet de protection", value: failed ? "Raté" : "Réussi" },
        { label: "Affaiblissement", value: failed ? `${reductionPercent}%` : "Aucun" },
        ...(failed ? [{ label: "Durée", value: `${durationRounds} round${durationRounds > 1 ? "s" : ""}` }] : [])
      ],
      message: failed
        ? `${targetToken.name ?? targetToken.actor?.name ?? "La cible"} subit un affaiblissement de ${reductionPercent}%.`
        : `${targetToken.name ?? targetToken.actor?.name ?? "La cible"} réussit son jet de protection : le sort est annulé.`,
      trustedBodyHtml: `
        <p><b>École :</b> ${esc(SPELL.school)} — <b>Portée :</b> ${esc(SPELL.rangeText)} — <b>Zone :</b> ${esc(SPELL.areaText)}.</p>
        <p><b>Composantes :</b> ${esc(SPELL.componentsText)} — <b>Incantation :</b> ${esc(SPELL.castingTimeText)} — <b>Jet de sauvegarde :</b> ${esc(SPELL.saveText)}.</p>
        <p>${esc(SPELL.description)}</p>`,
      chatData: {
        speaker: ChatMessage.getSpeaker({ actor: caster, token: sourceToken }),
        flags: {
          add2e: {
            chatCardType: "ray-of-enfeeblement",
            sourceItemUuid: sourceItem?.uuid ?? null,
            targetActorUuid: targetToken.actor?.uuid ?? null,
            casterLevel: level,
            reductionPercent: failed ? reductionPercent : 0,
            durationRounds: failed ? durationRounds : 0,
            saveResult,
            version: "2026-09-18-common-ui-chat-v2"
          }
        }
      }
    };
    const preview = globalThis.add2eBuildChatCard(card);
    if (!String(preview ?? "").trim()) throw new Error(`${SPELL.name} : carte ADD2E vide.`);
    return globalThis.add2eCreateChatCard(card);
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
  const saveResult = await askSaveResult({ targetToken, reductionPercent, durationRounds });
  if (!saveResult) return false;

  if (saveResult === "failed") await createWeaknessEffect(targetToken.actor, sourceItem, level, reductionPercent, durationRounds);
  await createChat({ caster, sourceItem, sourceToken, targetToken, saveResult, reductionPercent, durationRounds, distance: dist, range, level });

  console.log(`${TAG}[DONE]`, { caster: caster.name, target: targetToken.name, level, reductionPercent, durationRounds, saveResult });
  return true;
})();
