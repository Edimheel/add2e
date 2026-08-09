// ADD2E — Pilier de feu
// Compatible Foundry V13/V14/V15.
// Le script orchestre le sort ; les sauvegardes et dégâts restent la responsabilité des moteurs canoniques.

const ADD2E_PILIER_DE_FEU_VERSION = "2026-08-09-canonical-save-damage-v5";
const ADD2E_PILIER_DE_FEU_CONFIG = Object.freeze({
  name: "Pilier de feu",
  slug: "pilier_de_feu",
  level: 5,
  failedSaveFormula: "6d8",
  successfulSaveFormula: "3d8",
  saveType: "sorts",
  damageType: "feu",
  area: "pilier de 3\" de haut et 1\" de diamètre",
  range: "6\"",
  underwaterRestriction: "Ce sort ne peut pas être utilisé sous l’eau."
});

globalThis.ADD2E_PILIER_DE_FEU_VERSION = ADD2E_PILIER_DE_FEU_VERSION;

function add2ePilierDeFeuEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2ePilierDeFeuCasterToken() {
  return token ?? args?.[0]?.token ?? canvas?.tokens?.controlled?.[0] ?? null;
}

function add2ePilierDeFeuTargets() {
  const seen = new Set();
  return Array.from(game.user?.targets ?? []).filter(target => {
    const actorId = String(target?.actor?.id ?? "");
    const tokenId = String(target?.id ?? target?.document?.id ?? "");
    const key = `${actorId}|${tokenId}`;
    if (!target?.actor || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function add2ePilierDeFeuRequireApis() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (typeof engine?.rollSavingThrow !== "function") {
    throw new Error("Le résolveur canonique ADD2E des jets de sauvegarde est indisponible.");
  }
  if (typeof globalThis.add2eApplyDamage !== "function") {
    throw new Error("Le résolveur canonique ADD2E des dégâts est indisponible.");
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  return engine;
}

function add2ePilierDeFeuSaveSummary(save) {
  const d20 = Number(save?.d20);
  const total = Number(save?.total);
  const target = Number(save?.target);
  const bonus = Number(save?.bonus) || 0;
  const parts = [];
  if (Number.isFinite(d20)) parts.push(`d20 ${d20}`);
  if (bonus) parts.push(`${bonus >= 0 ? "+" : "−"}${Math.abs(bonus)}`);
  if (Number.isFinite(total) && total !== d20) parts.push(`= ${total}`);
  if (Number.isFinite(target)) parts.push(`/ seuil ${target}`);
  return parts.join(" ") || "jet résolu";
}

async function add2ePilierDeFeuResolveTarget(engine, caster, targetToken) {
  const targetActor = targetToken?.actor ?? null;
  if (!targetActor) return null;

  const save = await engine.rollSavingThrow(targetActor, ADD2E_PILIER_DE_FEU_CONFIG.saveType, {
    createChat: false,
    source: ADD2E_PILIER_DE_FEU_CONFIG.slug,
    sourceItem: item ?? null,
    sourceActor: caster,
    targetToken
  });

  if (!save?.ok) {
    ui.notifications.warn(`Pilier de feu : jet de protection indisponible pour ${targetActor.name}. Aucun dégât appliqué à cette cible.`);
    return {
      targetToken,
      targetActor,
      save,
      damageRoll: null,
      damageResult: null,
      skipped: true
    };
  }

  const formula = save.success
    ? ADD2E_PILIER_DE_FEU_CONFIG.successfulSaveFormula
    : ADD2E_PILIER_DE_FEU_CONFIG.failedSaveFormula;
  const damageRoll = await new Roll(formula).evaluate();
  const damageResult = await globalThis.add2eApplyDamage({
    cible: targetToken,
    montant: Number(damageRoll.total) || 0,
    type: ADD2E_PILIER_DE_FEU_CONFIG.damageType,
    details: "Pilier de feu · feu magique",
    sourceItem: item ?? null,
    lanceur: caster,
    save: {
      success: save.success === true,
      successMultiplier: 1,
      failureMultiplier: 1
    },
    actionTags: [
      "spell",
      "magic",
      "sort:pilier_de_feu",
      "damage:feu",
      "degat:feu",
      "jet_sauvegarde:demi"
    ]
  });

  return {
    targetToken,
    targetActor,
    save,
    damageRoll,
    damageResult,
    skipped: false
  };
}

async function add2ePilierDeFeuChat(caster, casterToken, resolutions) {
  const rows = [
    { label: "Portée", value: ADD2E_PILIER_DE_FEU_CONFIG.range },
    { label: "Zone", value: ADD2E_PILIER_DE_FEU_CONFIG.area }
  ];
  const rolls = [];
  const resultHtml = [];

  for (const resolution of resolutions) {
    const targetName = resolution?.targetActor?.name ?? "Cible";
    const safeTarget = add2ePilierDeFeuEscape(targetName);
    const save = resolution?.save;

    if (save?.roll) rolls.push(save.roll);
    if (resolution?.damageRoll) rolls.push(resolution.damageRoll);

    if (resolution?.skipped) {
      rows.push({ label: targetName, value: "JP indisponible · aucun dégât appliqué" });
      resultHtml.push(`<p><strong>${safeTarget}</strong> : jet de protection indisponible, aucun dégât appliqué.</p>`);
      continue;
    }

    const saveState = save?.success === true ? "réussi" : "raté";
    const formula = save?.success === true
      ? ADD2E_PILIER_DE_FEU_CONFIG.successfulSaveFormula
      : ADD2E_PILIER_DE_FEU_CONFIG.failedSaveFormula;
    const rolledDamage = Number(resolution?.damageRoll?.total) || 0;
    const appliedDamage = Number(resolution?.damageResult?.amount);
    const damageText = Number.isFinite(appliedDamage)
      ? `${appliedDamage} dégât(s) après résolution`
      : "application des dégâts non confirmée";

    rows.push({
      label: targetName,
      value: `JP ${saveState} · ${formula} = ${rolledDamage} · ${damageText}`
    });
    resultHtml.push(
      `<p><strong>${safeTarget}</strong> : JP ${add2ePilierDeFeuEscape(saveState)} (${add2ePilierDeFeuEscape(add2ePilierDeFeuSaveSummary(save))}) → <strong>${add2ePilierDeFeuEscape(formula)} = ${rolledDamage}</strong>${Number.isFinite(appliedDamage) ? ` → ${appliedDamage} dégât(s) après défenses` : ""}.</p>`
    );
  }

  const options = {
    actor: caster,
    title: ADD2E_PILIER_DE_FEU_CONFIG.name,
    icon: "fas fa-fire-flame-curved",
    variant: "spell",
    source: {
      name: caster?.name ?? "Clerc",
      img: casterToken?.document?.texture?.src ?? caster?.img ?? item?.img ?? "icons/svg/mystery-man.svg",
      type: "Sort divin"
    },
    rows,
    trustedBodyHtml: `${resultHtml.join("")}<p><em>${add2ePilierDeFeuEscape(ADD2E_PILIER_DE_FEU_CONFIG.underwaterRestriction)}</em></p>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls,
      flags: {
        add2e: {
          spell: ADD2E_PILIER_DE_FEU_CONFIG.slug,
          version: ADD2E_PILIER_DE_FEU_VERSION,
          saveType: ADD2E_PILIER_DE_FEU_CONFIG.saveType,
          damageType: ADD2E_PILIER_DE_FEU_CONFIG.damageType,
          failedSaveFormula: ADD2E_PILIER_DE_FEU_CONFIG.failedSaveFormula,
          successfulSaveFormula: ADD2E_PILIER_DE_FEU_CONFIG.successfulSaveFormula,
          underwaterRestriction: true
        }
      }
    }
  };

  const preview = String(globalThis.add2eBuildChatCard(options) ?? "").trim();
  if (!preview) throw new Error("La carte de Pilier de feu ADD2E est vide.");
  return globalThis.add2eCreateChatCard(options);
}

const caster = actor ?? item?.parent ?? null;
if (!caster) {
  ui.notifications.error("Pilier de feu : lanceur introuvable.");
  return false;
}

const targets = add2ePilierDeFeuTargets();
if (!targets.length) {
  ui.notifications.warn("Pilier de feu : sélectionne toutes les créatures présentes dans la zone du pilier.");
  return false;
}

const engine = add2ePilierDeFeuRequireApis();
const resolutions = [];
for (const targetToken of targets) {
  const resolution = await add2ePilierDeFeuResolveTarget(engine, caster, targetToken);
  if (resolution) resolutions.push(resolution);
}

if (!resolutions.length) {
  ui.notifications.warn("Pilier de feu : aucune cible valide à résoudre.");
  return false;
}

await add2ePilierDeFeuChat(caster, add2ePilierDeFeuCasterToken(), resolutions);
return true;
