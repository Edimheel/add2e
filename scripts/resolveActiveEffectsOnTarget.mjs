/**
 * ADD2E — Résolution générique des protections, résistances et sauvegardes.
 * Compatible Foundry V13/V14/V15.
 *
 * Usage : await resolveActiveEffectsOnTarget(actor, "sommeil")
 * Retour : { annulé, résiste, details, pct, jet, bonus }
 */

function add2eResolveEffectKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, "_");
}

function add2eResolveEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function resolveActiveEffectsOnTarget(actor, effectType) {
  if (!actor) {
    return { annulé: false, résiste: false, details: "Aucune cible", pct: 0, jet: 0, bonus: 0 };
  }

  const engine = globalThis.Add2eEffectsEngine;
  const type = String(effectType ?? "").trim() || "effet";
  const key = add2eResolveEffectKey(type);
  if (!engine?.getActiveTags) {
    return { annulé: false, résiste: false, details: "Effects Engine indisponible", pct: 0, jet: 0, bonus: 0 };
  }

  const tags = engine.getActiveTags(actor);
  if (engine.hasImmunity?.(actor, key) || tags.includes(`protection:${key}`)) {
    const result = {
      annulé: true,
      résiste: false,
      details: `Immunité ou protection contre ${type}`,
      pct: 100,
      jet: 0,
      bonus: 0
    };
    globalThis.add2eLastResistanceRoll = {
      found: true,
      immunise: true,
      resiste: true,
      type,
      matchedType: key,
      tag: tags.find(tag => tag === `immunite:${key}` || tag === `protection:${key}`) ?? `immunite:${key}`,
      pct: 100,
      jet: 0,
      details: result.details
    };
    return result;
  }

  const resistance = engine.checkResistanceDetails?.(actor, type, { chat: false })
    ?? { found: false, manual: false, resiste: false, pct: 0, jet: 0, details: "" };
  if (resistance.immunise) {
    return {
      annulé: true,
      résiste: false,
      details: resistance.details,
      pct: 100,
      jet: 0,
      bonus: 0
    };
  }
  if (resistance.found) {
    const result = {
      annulé: false,
      résiste: !!resistance.resiste,
      details: resistance.details,
      pct: Number(resistance.pct) || 0,
      jet: Number(resistance.jet) || 0,
      bonus: 0
    };
    if (typeof ChatMessage !== "undefined") {
      const color = result.résiste ? "#2f8f46" : "#b33a2e";
      const label = result.résiste ? "RÉSISTANCE RÉUSSIE" : "RÉSISTANCE ÉCHOUÉE";
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="add2e-chat-card" style="border:1px solid ${color};border-radius:8px;padding:8px;">
          <div style="font-weight:900;color:${color};">${label}</div>
          <div><b>${add2eResolveEscapeHtml(actor.name)}</b> contre <b>${add2eResolveEscapeHtml(type)}</b></div>
          <div>Résistance : <b>${result.pct}%</b> — jet <b>${result.jet}</b></div>
        </div>`
      });
    }
    return result;
  }

  const bonus = Number(engine.getSaveBonus?.(actor, type) ?? (
    Number(engine.getSaveBonusVs?.(actor, type) || 0)
    + Number(engine.getBonusSaveConstitution?.(actor, type) || 0)
  )) || 0;
  const category = engine.getSaveCategory?.(type) ?? key;
  const manual = engine.getResistanceInfo?.(actor, type)?.manual === true;
  const details = manual
    ? `Résistance au poison à appliquer selon la règle de campagne. ${bonus ? `Bonus de sauvegarde ${bonus >= 0 ? "+" : ""}${bonus}` : ""}`.trim()
    : (bonus
      ? `Bonus de sauvegarde (${category}) ${bonus >= 0 ? "+" : ""}${bonus}`
      : `Aucune immunité ni résistance active contre ${type}`);

  return {
    annulé: false,
    résiste: false,
    details,
    pct: 0,
    jet: 0,
    bonus
  };
}

window.resolveActiveEffectsOnTarget = resolveActiveEffectsOnTarget;
globalThis.resolveActiveEffectsOnTarget = resolveActiveEffectsOnTarget;
