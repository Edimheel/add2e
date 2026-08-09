// ADD2E — Quête religieuse
// Compatible Foundry V13/V14/V15.
// Le script orchestre l'arbitrage du sort ; le moteur canonique possède les sauvegardes.

const ADD2E_QUETE_RELIGIEUSE_VERSION = "2026-08-09-canonical-quest-v5";
const ADD2E_QUETE_RELIGIEUSE_CONFIG = Object.freeze({
  name: "Quête religieuse",
  slug: "quete_religieuse",
  level: 5,
  saveType: "sorts",
  sameAlignmentPenalty: -4,
  baseTags: Object.freeze([
    "classe:clerc",
    "liste:clerc",
    "niveau:5",
    "sort:quete_religieuse",
    "quete:religieuse",
    "contrainte:divine"
  ])
});

globalThis.ADD2E_QUETE_RELIGIEUSE_VERSION = ADD2E_QUETE_RELIGIEUSE_VERSION;

function add2eQueteReligieuseEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eQueteReligieuseSourceItem() {
  return typeof item !== "undefined" ? item : null;
}

function add2eQueteReligieuseCasterToken() {
  return (typeof token !== "undefined" ? token : null)
    ?? (typeof args !== "undefined" ? args?.[0]?.token : null)
    ?? canvas?.tokens?.controlled?.[0]
    ?? null;
}

function add2eQueteReligieuseRequireApis() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (typeof engine?.rollActionSave !== "function") {
    throw new Error("Le résolveur canonique ADD2E des jets de sauvegarde est indisponible.");
  }
  if (typeof engine?.hasImmunity !== "function") {
    throw new Error("Le résolveur canonique ADD2E des immunités est indisponible.");
  }
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  return engine;
}

function add2eQueteReligieuseTarget() {
  const targets = Array.from(game.user?.targets ?? []).filter(target => target?.actor);
  if (targets.length !== 1) {
    ui.notifications.warn("Quête religieuse : sélectionne exactement une créature cible.");
    return null;
  }
  return targets[0];
}

function add2eQueteReligieuseManagedEffects(targetActor) {
  return Array.from(targetActor?.effects?.contents ?? targetActor?.effects ?? [])
    .filter(effect => effect?.flags?.add2e?.questReligieuse?.managed === true);
}

function add2eQueteReligieuseEffectLabel(effect) {
  const data = effect?.flags?.add2e?.questReligieuse ?? {};
  const service = String(data.service ?? "").trim();
  const state = effect?.disabled === true ? "suspendue" : "active";
  const days = Math.max(0, Number(data.inactiveDays) || 0);
  return `${service || effect?.name || ADD2E_QUETE_RELIGIEUSE_CONFIG.name} — ${state}${days ? ` — ${days} j. d’inaction` : ""}`;
}

async function add2eQueteReligieuseManagementChoice(effects) {
  if (!game.user?.isGM || !effects.length) return { action: "new", effectId: "" };
  const options = effects.map(effect => `<option value="${add2eQueteReligieuseEscape(effect.id)}">${add2eQueteReligieuseEscape(add2eQueteReligieuseEffectLabel(effect))}</option>`).join("");
  return globalThis.add2eDialogWait({
    add2eTheme: "danger",
    add2ePrimaryAction: "new",
    add2eClasses: ["add2e-quete-religieuse-management"],
    window: { title: "Quête religieuse — gestion" },
    content: `
      <form class="add2e-quete-religieuse-management-form">
        <p>Cette cible possède déjà une ou plusieurs quêtes religieuses gérées par ADD2E.</p>
        <div class="form-group">
          <label>Quête concernée</label>
          <select name="effectId">${options}</select>
        </div>
        <p><small>L’inaction volontaire, la suspension et l’annulation sont des décisions du MD.</small></p>
      </form>
    `,
    buttons: [
      {
        action: "new",
        label: "Nouvelle quête",
        icon: "<i class='fas fa-scroll'></i>",
        default: true,
        callback: (_event, button) => ({ action: "new", effectId: String(button.form?.elements?.effectId?.value ?? "") })
      },
      {
        action: "inactive",
        label: "+1 jour d’inaction",
        icon: "<i class='fas fa-calendar-plus'></i>",
        callback: (_event, button) => ({ action: "inactive", effectId: String(button.form?.elements?.effectId?.value ?? "") })
      },
      {
        action: "toggle",
        label: "Suspendre / reprendre",
        icon: "<i class='fas fa-pause'></i>",
        callback: (_event, button) => ({ action: "toggle", effectId: String(button.form?.elements?.effectId?.value ?? "") })
      },
      {
        action: "complete",
        label: "Accomplie / annulée",
        icon: "<i class='fas fa-check'></i>",
        callback: (_event, button) => ({ action: "complete", effectId: String(button.form?.elements?.effectId?.value ?? "") })
      },
      {
        action: "cancel",
        label: "Fermer",
        icon: "<i class='fas fa-times'></i>",
        callback: () => null
      }
    ],
    close: () => null
  });
}

function add2eQueteReligieusePenaltyTags(effect, inactiveDays) {
  const existing = Array.isArray(effect?.flags?.add2e?.tags)
    ? effect.flags.add2e.tags.map(value => String(value ?? "").trim()).filter(Boolean)
    : [];
  const tags = existing.filter(tag => !tag.startsWith("bonus_save:"));
  const days = Math.max(0, Math.floor(Number(inactiveDays) || 0));
  if (days > 0) tags.push(`bonus_save:-${days}`);
  return [...new Set(tags)];
}

async function add2eQueteReligieuseChat(caster, casterToken, {
  targetActor,
  service = "",
  adjudication = "",
  save = null,
  result = "",
  details = "",
  inactiveDays = null,
  suspended = null
} = {}) {
  const rolls = save?.roll ? [save.roll] : [];
  const rows = [
    { label: "Cible", value: targetActor?.name ?? "Créature" }
  ];
  if (service) rows.push({ label: "Quête", value: service });
  if (adjudication) rows.push({ label: "Arbitrage", value: adjudication });
  if (save) {
    rows.push({
      label: "Jet de protection",
      value: save.canRoll === false ? "indisponible" : (save.success === true ? "réussi — la quête est évitée" : "raté — la quête s’impose")
    });
  }
  if (inactiveDays !== null) rows.push({ label: "Inaction volontaire", value: `${inactiveDays} jour(s) · malus ${inactiveDays ? `−${inactiveDays}` : "0"} à tous les JP` });
  if (suspended !== null) rows.push({ label: "État", value: suspended ? "Suspendue par le MD" : "Active" });
  if (result) rows.push({ label: "Résultat", value: result });

  const sourceItem = add2eQueteReligieuseSourceItem();
  const safeDetails = add2eQueteReligieuseEscape(details);
  const options = {
    actor: caster,
    title: ADD2E_QUETE_RELIGIEUSE_CONFIG.name,
    icon: "fas fa-scroll",
    variant: "spell",
    source: {
      name: caster?.name ?? "Clerc",
      img: casterToken?.document?.texture?.src ?? caster?.img ?? sourceItem?.img ?? "icons/svg/mystery-man.svg",
      type: "Sort divin"
    },
    rows,
    trustedBodyHtml: `${safeDetails ? `<p>${safeDetails}</p>` : ""}<p><em>L’inaction volontaire, les circonstances de suspension et les causes d’annulation restent arbitrées par le MD.</em></p>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls,
      flags: {
        add2e: {
          spell: ADD2E_QUETE_RELIGIEUSE_CONFIG.slug,
          version: ADD2E_QUETE_RELIGIEUSE_VERSION
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(options);
  return globalThis.add2eCreateChatCard(options);
}

async function add2eQueteReligieuseManage(caster, casterToken, targetActor, effects) {
  const choice = await add2eQueteReligieuseManagementChoice(effects);
  if (!choice) return { handled: true, result: false };
  if (choice.action === "new") return { handled: false, result: null };

  const effect = effects.find(entry => String(entry.id) === String(choice.effectId));
  if (!effect) {
    ui.notifications.warn("Quête religieuse : effet de quête introuvable.");
    return { handled: true, result: false };
  }

  const data = effect.flags?.add2e?.questReligieuse ?? {};
  const service = String(data.service ?? "");

  if (choice.action === "inactive") {
    const inactiveDays = Math.max(0, Math.floor(Number(data.inactiveDays) || 0)) + 1;
    await effect.update({
      "flags.add2e.tags": add2eQueteReligieusePenaltyTags(effect, inactiveDays),
      "flags.add2e.questReligieuse.inactiveDays": inactiveDays
    }, {
      add2eInternal: true,
      add2eReason: "quete-religieuse-inactive-day"
    });
    await add2eQueteReligieuseChat(caster, casterToken, {
      targetActor,
      service,
      result: "Jour d’inaction volontaire ajouté par le MD",
      details: `La pénalité cumulative de la quête est maintenant de −${inactiveDays} à tous les jets de protection.`,
      inactiveDays,
      suspended: effect.disabled === true
    });
    return { handled: true, result: true };
  }

  if (choice.action === "toggle") {
    const suspended = effect.disabled !== true;
    await effect.update({
      disabled: suspended,
      "flags.add2e.questReligieuse.suspended": suspended
    }, {
      add2eInternal: true,
      add2eReason: suspended ? "quete-religieuse-suspend" : "quete-religieuse-resume"
    });
    await add2eQueteReligieuseChat(caster, casterToken, {
      targetActor,
      service,
      result: suspended ? "Quête suspendue" : "Quête reprise",
      details: suspended
        ? "Le MD suspend temporairement les effets mécaniques de la quête."
        : "Le MD réactive la quête et son éventuelle pénalité cumulative.",
      inactiveDays: Math.max(0, Math.floor(Number(data.inactiveDays) || 0)),
      suspended
    });
    return { handled: true, result: true };
  }

  if (choice.action === "complete") {
    await effect.delete({ add2eInternal: true, add2eReason: "quete-religieuse-complete-or-cancel" });
    await add2eQueteReligieuseChat(caster, casterToken, {
      targetActor,
      service,
      result: "Quête accomplie / annulée",
      details: "Le MD a mis fin à la quête religieuse et à toutes ses pénalités associées."
    });
    return { handled: true, result: true };
  }

  return { handled: true, result: false };
}

async function add2eQueteReligieuseParameters(targetActor) {
  return globalThis.add2eDialogWait({
    add2eTheme: "danger",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-quete-religieuse-dialog"],
    window: { title: ADD2E_QUETE_RELIGIEUSE_CONFIG.name },
    content: `
      <form class="add2e-quete-religieuse-form">
        <p><b>Cible :</b> ${add2eQueteReligieuseEscape(targetActor?.name ?? "Créature")}</p>
        <div class="form-group">
          <label>Service / quête imposée</label>
          <textarea name="service" rows="4" required></textarea>
        </div>
        <div class="form-group">
          <label>Arbitrage du MD</label>
          <select name="adjudication">
            <option value="no-save">Accord de la cible, ou même religion avec quête juste et méritée — aucun JP</option>
            <option value="same-alignment">Même alignement que le clerc — JP à −4</option>
            <option value="normal" selected>Autre situation — JP normal</option>
          </select>
        </div>
        <p><small>Le système ne déduit pas automatiquement la religion, la justification de la quête ou l’accord de la cible.</small></p>
      </form>
    `,
    buttons: [
      {
        action: "cast",
        label: "Imposer la quête",
        icon: "<i class='fas fa-scroll'></i>",
        default: true,
        callback: (_event, button) => ({
          service: String(button.form?.elements?.service?.value ?? "").trim(),
          adjudication: String(button.form?.elements?.adjudication?.value ?? "normal")
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

function add2eQueteReligieuseAdjudicationLabel(adjudication) {
  if (adjudication === "no-save") return "Accord / même religion et quête juste — aucun JP";
  if (adjudication === "same-alignment") return "Même alignement — JP à −4";
  return "Autre situation — JP normal";
}

async function add2eQueteReligieuseCreateEffect(targetActor, caster, parameters) {
  const sourceItem = add2eQueteReligieuseSourceItem();
  const data = {
    name: ADD2E_QUETE_RELIGIEUSE_CONFIG.name,
    img: sourceItem?.img || "icons/svg/aura.svg",
    origin: sourceItem?.uuid ?? null,
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [],
    duration: {},
    description: `Quête imposée : ${parameters.service}`,
    flags: {
      add2e: {
        tags: [...ADD2E_QUETE_RELIGIEUSE_CONFIG.baseTags],
        questReligieuse: {
          managed: true,
          active: true,
          service: parameters.service,
          adjudication: parameters.adjudication,
          saveModifier: parameters.adjudication === "same-alignment" ? ADD2E_QUETE_RELIGIEUSE_CONFIG.sameAlignmentPenalty : 0,
          inactiveDays: 0,
          suspended: false,
          casterActorId: caster?.id ?? "",
          casterActorUuid: caster?.uuid ?? "",
          casterName: caster?.name ?? "Clerc",
          sourceItemUuid: sourceItem?.uuid ?? "",
          sourceItemName: sourceItem?.name ?? ADD2E_QUETE_RELIGIEUSE_CONFIG.name,
          createdByUserId: game.user?.id ?? ""
        },
        spellConsumerVersion: ADD2E_QUETE_RELIGIEUSE_VERSION
      }
    }
  };
  const [effect] = await targetActor.createEmbeddedDocuments("ActiveEffect", [data]);
  return effect ?? null;
}

const caster = (typeof actor !== "undefined" ? actor : null) ?? add2eQueteReligieuseSourceItem()?.parent ?? null;
if (!caster) {
  ui.notifications.error("Quête religieuse : lanceur introuvable.");
  return false;
}

const engine = add2eQueteReligieuseRequireApis();
const casterToken = add2eQueteReligieuseCasterToken();
const targetToken = add2eQueteReligieuseTarget();
if (!targetToken) return false;
const targetActor = targetToken.actor;

const managedEffects = add2eQueteReligieuseManagedEffects(targetActor);
if (managedEffects.length && game.user?.isGM) {
  const managed = await add2eQueteReligieuseManage(caster, casterToken, targetActor, managedEffects);
  if (managed.handled) return managed.result;
}

if (engine.hasImmunity(targetActor, "quete")) {
  await add2eQueteReligieuseChat(caster, casterToken, {
    targetActor,
    result: "Immunité — aucun effet",
    details: `${targetActor.name} est immunisé aux quêtes selon les règles actives de l’acteur.`
  });
  return false;
}

const parameters = await add2eQueteReligieuseParameters(targetActor);
if (!parameters) {
  ui.notifications.info("Quête religieuse annulée.");
  return false;
}
if (!parameters.service) {
  ui.notifications.warn("Quête religieuse : décris le service ou la quête à accomplir.");
  return false;
}

let save = null;
if (parameters.adjudication !== "no-save") {
  const modifier = parameters.adjudication === "same-alignment"
    ? ADD2E_QUETE_RELIGIEUSE_CONFIG.sameAlignmentPenalty
    : 0;
  save = await engine.rollActionSave(targetActor, ADD2E_QUETE_RELIGIEUSE_CONFIG.saveType, modifier);
  if (!save?.canRoll) {
    ui.notifications.warn(`Quête religieuse : jet de protection indisponible pour ${targetActor.name}. Aucun effet appliqué.`);
    await add2eQueteReligieuseChat(caster, casterToken, {
      targetActor,
      service: parameters.service,
      adjudication: add2eQueteReligieuseAdjudicationLabel(parameters.adjudication),
      save,
      result: "JP indisponible — aucun effet",
      details: "Le sort n’est pas appliqué tant que le jet de protection canonique ne peut pas être résolu."
    });
    return false;
  }
  if (save.success === true) {
    await add2eQueteReligieuseChat(caster, casterToken, {
      targetActor,
      service: parameters.service,
      adjudication: add2eQueteReligieuseAdjudicationLabel(parameters.adjudication),
      save,
      result: "Quête évitée",
      details: `${targetActor.name} réussit son jet de protection et n’est pas soumis à la quête.`
    });
    return true;
  }
}

const effect = await add2eQueteReligieuseCreateEffect(targetActor, caster, parameters);
if (!effect) {
  ui.notifications.error("Quête religieuse : l’effet persistant n’a pas pu être créé.");
  return false;
}

await add2eQueteReligieuseChat(caster, casterToken, {
  targetActor,
  service: parameters.service,
  adjudication: add2eQueteReligieuseAdjudicationLabel(parameters.adjudication),
  save,
  result: "Quête imposée",
  details: "La quête reste active jusqu’à son accomplissement, son annulation ou sa suspension par décision du MD.",
  inactiveDays: 0,
  suspended: false
});
return true;
