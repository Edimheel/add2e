// ADD2E — Expiation
// Compatible Foundry V13/V14/V15.
// Le script orchestre l'arbitrage du sort ; il ne déduit ni la sincérité ni l'alignement antérieur.

const ADD2E_EXPIATION_VERSION = "2026-08-09-canonical-atonement-v5";
const ADD2E_EXPIATION_CONFIG = Object.freeze({
  name: "Expiation",
  slug: "expiation",
  level: 5,
  underwaterRestriction: "Expiation ne fonctionne normalement pas sous l’eau, sauf dans les limites d’un sort d’eau aérée."
});

globalThis.ADD2E_EXPIATION_VERSION = ADD2E_EXPIATION_VERSION;

function add2eExpiationEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eExpiationNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eExpiationSourceItem() {
  return typeof item !== "undefined" ? item : null;
}

function add2eExpiationCasterToken() {
  return (typeof token !== "undefined" ? token : null)
    ?? (typeof args !== "undefined" ? args?.[0]?.token : null)
    ?? canvas?.tokens?.controlled?.[0]
    ?? null;
}

function add2eExpiationRequireApis() {
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
}

function add2eExpiationTarget() {
  const targets = Array.from(game.user?.targets ?? []).filter(target => target?.actor);
  if (targets.length !== 1) {
    ui.notifications.warn("Expiation : sélectionne exactement une créature cible.");
    return null;
  }
  return targets[0];
}

function add2eExpiationTags(effect) {
  const raw = effect?.flags?.add2e?.tags ?? [];
  const values = Array.isArray(raw)
    ? raw
    : raw instanceof Set
      ? [...raw]
      : typeof raw === "string"
        ? raw.split(/[,;|\n]+/g)
        : [];
  return values.map(add2eExpiationNormalize).filter(Boolean);
}

function add2eExpiationIsAlignmentEffect(effect) {
  if (!effect) return false;
  const tags = add2eExpiationTags(effect);
  const tagged = tags.some(tag => (
    tag === "alignement"
    || tag === "alignment"
    || tag.startsWith("alignement_")
    || tag.startsWith("alignment_")
    || tag.includes("changement_alignement")
    || tag.includes("alignment_change")
  ));
  if (tagged) return true;

  return Array.isArray(effect.changes) && effect.changes.some(change => {
    const key = String(change?.key ?? "").trim();
    return [
      "system.alignement",
      "system.alignment",
      "system.details.alignement",
      "system.details.alignment"
    ].includes(key);
  });
}

function add2eExpiationAlignmentEffects(targetActor) {
  return Array.from(targetActor?.effects?.contents ?? targetActor?.effects ?? [])
    .filter(effect => effect?.disabled !== true && add2eExpiationIsAlignmentEffect(effect));
}

function add2eExpiationPendingEffects(targetActor) {
  return Array.from(targetActor?.effects?.contents ?? targetActor?.effects ?? [])
    .filter(effect => effect?.flags?.add2e?.expiation?.managed === true && effect?.flags?.add2e?.expiation?.pending === true);
}

async function add2eExpiationChat(caster, casterToken, {
  targetActor,
  result,
  cause = "",
  penance = "",
  removedEffect = "",
  details = ""
} = {}) {
  const sourceItem = add2eExpiationSourceItem();
  const rows = [{ label: "Cible", value: targetActor?.name ?? "Créature" }];
  if (cause) rows.push({ label: "Situation", value: cause });
  if (penance) rows.push({ label: "Pénitence / sacrifice", value: penance });
  if (removedEffect) rows.push({ label: "Effet retiré", value: removedEffect });
  if (result) rows.push({ label: "Résultat", value: result });

  const safeDetails = add2eExpiationEscape(details);
  const options = {
    actor: caster,
    title: ADD2E_EXPIATION_CONFIG.name,
    icon: "fas fa-scale-balanced",
    variant: "spell",
    source: {
      name: caster?.name ?? "Clerc",
      img: casterToken?.document?.texture?.src ?? caster?.img ?? sourceItem?.img ?? "icons/svg/mystery-man.svg",
      type: "Sort divin"
    },
    rows,
    trustedBodyHtml: `${safeDetails ? `<p>${safeDetails}</p>` : ""}<p><em>${add2eExpiationEscape(ADD2E_EXPIATION_CONFIG.underwaterRestriction)}</em></p>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: { add2e: { spell: ADD2E_EXPIATION_CONFIG.slug, version: ADD2E_EXPIATION_VERSION } }
    }
  };
  globalThis.add2eBuildChatCard(options);
  return globalThis.add2eCreateChatCard(options);
}

async function add2eExpiationPendingChoice(pendingEffects) {
  if (!game.user?.isGM || !pendingEffects.length) return { action: "new", effectId: "" };
  const options = pendingEffects.map(effect => {
    const data = effect.flags?.add2e?.expiation ?? {};
    const label = String(data.penance ?? effect.name ?? "Pénitence en attente");
    return `<option value="${add2eExpiationEscape(effect.id)}">${add2eExpiationEscape(label)}</option>`;
  }).join("");

  return globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "new",
    add2eClasses: ["add2e-expiation-management"],
    window: { title: "Expiation — pénitence en attente" },
    content: `
      <form class="add2e-expiation-management-form">
        <p>Cette cible possède une expiation conditionnelle en attente.</p>
        <div class="form-group">
          <label>Pénitence</label>
          <select name="effectId">${options}</select>
        </div>
      </form>
    `,
    buttons: [
      {
        action: "new",
        label: "Nouvelle expiation",
        icon: "<i class='fas fa-scale-balanced'></i>",
        default: true,
        callback: (_event, button) => ({ action: "new", effectId: String(button.form?.elements?.effectId?.value ?? "") })
      },
      {
        action: "complete",
        label: "Pénitence accomplie",
        icon: "<i class='fas fa-check'></i>",
        callback: (_event, button) => ({ action: "complete", effectId: String(button.form?.elements?.effectId?.value ?? "") })
      },
      {
        action: "cancel-pending",
        label: "Expiation refusée / abandonnée",
        icon: "<i class='fas fa-ban'></i>",
        callback: (_event, button) => ({ action: "cancel-pending", effectId: String(button.form?.elements?.effectId?.value ?? "") })
      },
      {
        action: "close",
        label: "Fermer",
        icon: "<i class='fas fa-times'></i>",
        callback: () => null
      }
    ],
    close: () => null
  });
}

async function add2eExpiationManagePending(caster, casterToken, targetActor, pendingEffects) {
  const choice = await add2eExpiationPendingChoice(pendingEffects);
  if (!choice) return { handled: true, result: false };
  if (choice.action === "new") return { handled: false, result: null };

  const pending = pendingEffects.find(effect => String(effect.id) === String(choice.effectId));
  if (!pending) {
    ui.notifications.warn("Expiation : pénitence en attente introuvable.");
    return { handled: true, result: false };
  }

  const data = pending.flags?.add2e?.expiation ?? {};
  const penance = String(data.penance ?? "");

  if (choice.action === "cancel-pending") {
    await pending.delete({ add2eInternal: true, add2eReason: "expiation-pending-cancel" });
    await add2eExpiationChat(caster, casterToken, {
      targetActor,
      result: "Expiation refusée / abandonnée",
      penance,
      details: "La pénitence en attente est supprimée sans appliquer l’expiation."
    });
    return { handled: true, result: true };
  }

  if (choice.action === "complete") {
    let removedEffect = "";
    const alignmentEffectId = String(data.alignmentEffectId ?? "");
    if (alignmentEffectId) {
      const alignmentEffect = targetActor.effects?.get?.(alignmentEffectId)
        ?? Array.from(targetActor.effects ?? []).find(effect => String(effect.id) === alignmentEffectId)
        ?? null;
      if (alignmentEffect && add2eExpiationIsAlignmentEffect(alignmentEffect)) {
        removedEffect = alignmentEffect.name ?? "Changement magique d’alignement";
        await alignmentEffect.delete({ add2eInternal: true, add2eReason: "expiation-remove-magical-alignment" });
      }
    }
    await pending.delete({ add2eInternal: true, add2eReason: "expiation-pending-complete" });
    await add2eExpiationChat(caster, casterToken, {
      targetActor,
      result: "Expiation accordée",
      penance,
      removedEffect,
      details: removedEffect
        ? "La pénitence est accomplie et l’effet explicite de changement magique d’alignement est retiré."
        : "La pénitence est accomplie ; l’expiation narrative est accordée par décision du MD."
    });
    return { handled: true, result: true };
  }

  return { handled: true, result: false };
}

async function add2eExpiationParameters(targetActor, alignmentEffects) {
  const effectOptions = [
    `<option value="">Aucun effet mécanique à retirer</option>`,
    ...alignmentEffects.map(effect => `<option value="${add2eExpiationEscape(effect.id)}">${add2eExpiationEscape(effect.name ?? "Effet d’alignement")}</option>`)
  ].join("");

  return globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-expiation-dialog"],
    window: { title: ADD2E_EXPIATION_CONFIG.name },
    content: `
      <form class="add2e-expiation-form">
        <p><b>Cible :</b> ${add2eExpiationEscape(targetActor?.name ?? "Créature")}</p>
        <div class="form-group">
          <label>Nature de la faute ou de l’effet</label>
          <select name="cause">
            <option value="involuntary" selected>Acte ignoré ou involontaire</option>
            <option value="magical-alignment">Changement magique d’alignement</option>
            <option value="deliberate">Méfait délibéré, conscient et volontaire</option>
          </select>
        </div>
        <div class="form-group">
          <label>Effet explicite de changement d’alignement à retirer</label>
          <select name="alignmentEffectId">${effectOptions}</select>
        </div>
        <div class="form-group">
          <label>Décision de la divinité / du MD</label>
          <select name="decision">
            <option value="grant" selected>Expiation accordée immédiatement</option>
            <option value="conditional">Pénitence ou sacrifice requis avant l’expiation</option>
            <option value="refuse">Expiation refusée</option>
          </select>
        </div>
        <div class="form-group">
          <label>Pénitence, sacrifice ou précision du MD</label>
          <textarea name="penance" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>Environnement</label>
          <select name="environment">
            <option value="normal" selected>Conditions normales</option>
            <option value="aerated-water">Sous l’eau, dans une zone d’eau aérée</option>
            <option value="underwater">Sous l’eau, sans eau aérée</option>
          </select>
        </div>
        <p><small>Seuls les effets qui déclarent explicitement un changement d’alignement par leurs tags ou leurs changements de données sont proposés.</small></p>
      </form>
    `,
    buttons: [
      {
        action: "cast",
        label: "Résoudre l’expiation",
        icon: "<i class='fas fa-scale-balanced'></i>",
        default: true,
        callback: (_event, button) => ({
          cause: String(button.form?.elements?.cause?.value ?? "involuntary"),
          alignmentEffectId: String(button.form?.elements?.alignmentEffectId?.value ?? ""),
          decision: String(button.form?.elements?.decision?.value ?? "grant"),
          penance: String(button.form?.elements?.penance?.value ?? "").trim(),
          environment: String(button.form?.elements?.environment?.value ?? "normal")
        })
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

function add2eExpiationCauseLabel(cause) {
  if (cause === "magical-alignment") return "Changement magique d’alignement";
  if (cause === "deliberate") return "Méfait délibéré et volontaire";
  return "Acte ignoré ou involontaire";
}

async function add2eExpiationCreatePending(targetActor, caster, parameters) {
  const sourceItem = add2eExpiationSourceItem();
  const data = {
    name: "Expiation — pénitence en attente",
    img: sourceItem?.img || "icons/svg/aura.svg",
    origin: sourceItem?.uuid ?? null,
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [],
    duration: {},
    description: parameters.penance
      ? `Pénitence exigée : ${parameters.penance}`
      : "Une pénitence ou un sacrifice doit être accompli avant que l’expiation soit accordée.",
    flags: {
      add2e: {
        tags: ["classe:clerc", "liste:clerc", "niveau:5", "sort:expiation", "expiation:en_attente", "penitence"],
        expiation: {
          managed: true,
          pending: true,
          cause: parameters.cause,
          penance: parameters.penance,
          alignmentEffectId: parameters.cause === "magical-alignment" ? parameters.alignmentEffectId : "",
          casterActorId: caster?.id ?? "",
          casterActorUuid: caster?.uuid ?? "",
          casterName: caster?.name ?? "Clerc",
          sourceItemUuid: sourceItem?.uuid ?? "",
          createdByUserId: game.user?.id ?? ""
        },
        spellConsumerVersion: ADD2E_EXPIATION_VERSION
      }
    }
  };
  const [effect] = await targetActor.createEmbeddedDocuments("ActiveEffect", [data]);
  return effect ?? null;
}

add2eExpiationRequireApis();
const sourceItem = add2eExpiationSourceItem();
const caster = (typeof actor !== "undefined" ? actor : null) ?? sourceItem?.parent ?? null;
if (!caster) {
  ui.notifications.error("Expiation : lanceur introuvable.");
  return false;
}

const casterToken = add2eExpiationCasterToken();
const targetToken = add2eExpiationTarget();
if (!targetToken) return false;
const targetActor = targetToken.actor;

const pendingEffects = add2eExpiationPendingEffects(targetActor);
if (pendingEffects.length && game.user?.isGM) {
  const managed = await add2eExpiationManagePending(caster, casterToken, targetActor, pendingEffects);
  if (managed.handled) return managed.result;
}

const alignmentEffects = add2eExpiationAlignmentEffects(targetActor);
const parameters = await add2eExpiationParameters(targetActor, alignmentEffects);
if (!parameters) {
  ui.notifications.info("Expiation annulée.");
  return false;
}

const causeLabel = add2eExpiationCauseLabel(parameters.cause);
if (parameters.environment === "underwater") {
  await add2eExpiationChat(caster, casterToken, {
    targetActor,
    cause: causeLabel,
    result: "Sort impossible",
    penance: parameters.penance,
    details: "La cible est sous l’eau sans bénéficier d’une zone d’eau aérée."
  });
  return false;
}

if (parameters.cause === "deliberate") {
  await add2eExpiationChat(caster, casterToken, {
    targetActor,
    cause: causeLabel,
    result: "Expiation impossible",
    penance: parameters.penance,
    details: "Un méfait accompli en connaissance de cause et de plein gré ne peut pas être le sujet de ce sort."
  });
  return false;
}

if (parameters.decision === "refuse") {
  await add2eExpiationChat(caster, casterToken, {
    targetActor,
    cause: causeLabel,
    result: "Expiation refusée",
    penance: parameters.penance,
    details: "La divinité ou le MD refuse l’expiation dans les circonstances présentes."
  });
  return false;
}

let alignmentEffect = null;
if (parameters.cause === "magical-alignment" && parameters.alignmentEffectId) {
  alignmentEffect = alignmentEffects.find(effect => String(effect.id) === String(parameters.alignmentEffectId)) ?? null;
}

if (parameters.decision === "conditional") {
  const pending = await add2eExpiationCreatePending(targetActor, caster, parameters);
  if (!pending) {
    ui.notifications.error("Expiation : la pénitence en attente n’a pas pu être créée.");
    return false;
  }
  await add2eExpiationChat(caster, casterToken, {
    targetActor,
    cause: causeLabel,
    result: "Pénitence requise",
    penance: parameters.penance || "À déterminer par le MD",
    details: "L’expiation n’est pas encore accordée. Le MD pourra valider la pénitence lors d’une nouvelle utilisation du sort sur cette cible."
  });
  return true;
}

let removedEffect = "";
if (parameters.cause === "magical-alignment") {
  if (!alignmentEffect) {
    ui.notifications.warn("Expiation : aucun ActiveEffect explicite de changement magique d’alignement n’a été sélectionné ; aucun alignement n’est réécrit automatiquement.");
  } else {
    removedEffect = alignmentEffect.name ?? "Changement magique d’alignement";
    await alignmentEffect.delete({ add2eInternal: true, add2eReason: "expiation-remove-magical-alignment" });
  }
}

await add2eExpiationChat(caster, casterToken, {
  targetActor,
  cause: causeLabel,
  result: "Expiation accordée",
  penance: parameters.penance,
  removedEffect,
  details: removedEffect
    ? "L’effet explicite de changement magique d’alignement a été retiré."
    : "L’expiation est accordée par décision du MD ; aucun état mécanique non explicitement identifié n’est modifié."
});
return true;
