// ADD2E — Réactions sociales contextuelles et effets d’Amitié.
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2 uniquement.

const ADD2E_AMITIE_REACTION_VERSION = "2026-07-26-contextual-reaction-v1";
globalThis.ADD2E_AMITIE_REACTION_VERSION = ADD2E_AMITIE_REACTION_VERSION;

function add2eAmitieEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (!engine || typeof engine.collect !== "function" || typeof engine.resolve !== "function") {
    throw new Error("Le moteur canonique ADD2E des modificateurs de réaction est indisponible.");
  }
  return engine;
}

function add2eAmitieEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eAmitieNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eAmitieSourceMatches(modifier, sourceActor) {
  const metadata = modifier?.metadata ?? {};
  const sourceUuid = String(metadata.sourceActorUuid ?? metadata.casterUuid ?? "").trim();
  const sourceId = String(metadata.sourceActorId ?? metadata.casterId ?? "").trim();
  if (sourceUuid && sourceUuid !== String(sourceActor?.uuid ?? "")) return false;
  if (sourceId && sourceId !== String(sourceActor?.id ?? "")) return false;
  return Boolean(sourceUuid || sourceId);
}

function add2eCollectIncomingReactionModifiers(sourceActor, targetActor, context = {}) {
  if (!sourceActor?.system || !targetActor?.system) return [];
  const engine = add2eAmitieEngine();
  const collected = engine.collect(targetActor, {
    ...context,
    actor: targetActor,
    sourceActor,
    targetActor,
    actionType: "reaction",
    charismaDomain: "reaction",
    charismaTarget: "encounter",
    source: context.source ?? "contextual-reaction"
  });

  return collected.filter(modifier => {
    const domain = add2eAmitieNormalize(modifier?.domain);
    const target = add2eAmitieNormalize(modifier?.target);
    const direction = add2eAmitieNormalize(modifier?.metadata?.direction ?? modifier?.metadata?.perspective);
    if (domain !== "reaction" || !["encounter", "all"].includes(target)) return false;
    if (!["incoming", "toward_source", "towards_source"].includes(direction)) return false;
    return add2eAmitieSourceMatches(modifier, sourceActor);
  });
}

function add2eResolveIncomingReaction(sourceActor, targetActor, context = {}) {
  const engine = add2eAmitieEngine();
  const modifiers = add2eCollectIncomingReactionModifiers(sourceActor, targetActor, context);
  const resolution = engine.resolve(targetActor, {
    domain: "reaction",
    target: "encounter",
    base: 0,
    rounding: "floor",
    modifiers,
    context: {
      ...context,
      actor: targetActor,
      sourceActor,
      targetActor,
      actionType: "reaction",
      source: context.source ?? "contextual-reaction"
    }
  });

  return {
    version: ADD2E_AMITIE_REACTION_VERSION,
    sourceActor,
    targetActor,
    modifiers,
    adjustment: Math.trunc(Number(resolution?.total) || 0),
    resolution
  };
}

function add2eMergeReactionCircumstances(context = {}, incoming = null) {
  const raw = context?.circumstance;
  const manualValue = Number(raw?.value ?? raw?.amount ?? raw?.bonus ?? raw?.modifier ?? 0) || 0;
  const manualLabel = String(raw?.label ?? raw?.name ?? "Circonstance").trim() || "Circonstance";
  const incomingValue = Number(incoming?.adjustment) || 0;
  const incomingLabel = incomingValue
    ? `Effets sur ${incoming?.targetActor?.name ?? "la cible"}`
    : "";
  const total = manualValue + incomingValue;
  if (!total) return null;

  const labels = [];
  if (manualValue) labels.push(manualLabel);
  if (incomingValue) labels.push(incomingLabel);
  return {
    label: labels.join(" ; ") || "Circonstance",
    value: total
  };
}

async function add2eRollContextualReactionCard(sourceActor, targetActor = null, context = {}) {
  if (typeof globalThis.add2eRollCharismaReactionCard !== "function") {
    throw new Error("Le jet canonique de réaction de Charisme est indisponible.");
  }
  const incoming = targetActor
    ? add2eResolveIncomingReaction(sourceActor, targetActor, context)
    : null;
  const circumstance = add2eMergeReactionCircumstances(context, incoming);
  const result = await globalThis.add2eRollCharismaReactionCard(sourceActor, {
    ...context,
    targetActor,
    circumstance
  });
  return { ...result, incomingReaction: incoming };
}

async function add2ePromptContextualReaction(sourceActor, targetActor = null) {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2?.wait) throw new Error("DialogV2 est indisponible.");
  const targetText = targetActor?.name
    ? `<p style="margin:0;font-size:.85em;"><b>Cible :</b> ${add2eAmitieEscape(targetActor.name)}</p>`
    : `<p style="margin:0;font-size:.85em;">Aucune cible unique : réaction générale.</p>`;

  return DialogV2.wait({
    window: { title: "Réaction initiale — circonstance" },
    position: { width: 410 },
    content: `<form style="display:flex;flex-direction:column;gap:8px;">${targetText}<div class="form-group"><label>Circonstance</label><input type="text" name="label" placeholder="Ex. offre généreuse"></div><div class="form-group"><label>Modificateur</label><input type="number" name="value" value="0" step="1"></div><p style="margin:0;font-size:.85em;">Les effets contextuels présents sur la cible sont ajoutés automatiquement.</p></form>`,
    buttons: [
      {
        action: "roll",
        label: "Lancer",
        icon: "fa-solid fa-dice-d20",
        default: true,
        callback: (_event, button) => ({
          label: String(button.form?.elements?.label?.value ?? "").trim() || "Circonstance",
          value: Number(button.form?.elements?.value?.value ?? 0) || 0
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

function add2eInstallContextualReactionSheetBinding() {
  const prototype = globalThis.Add2eActorSheet?.prototype;
  if (!prototype || prototype.__add2eContextualReactionV1 === true) return Boolean(prototype);
  const originalActivateListeners = prototype.activateListeners;
  if (typeof originalActivateListeners !== "function") {
    throw new Error("activateListeners ApplicationV2 est indisponible pour les réactions contextuelles.");
  }

  prototype.activateListeners = function add2eContextualReactionActivateListeners(html) {
    originalActivateListeners.call(this, html);
    const root = html?.jquery ? html : $(html);
    root.find('.add2e-charisma-check[data-check="reaction"]')
      .off('click.add2eCharismaCheck')
      .off('click.add2eContextualReaction')
      .on('click.add2eContextualReaction', async event => {
        event.preventDefault();
        event.stopPropagation();
        this._add2eRememberActiveTab?.(root);
        const selectedTargets = Array.from(game.user?.targets ?? []).filter(token => token?.actor);
        const targetActor = selectedTargets.length === 1 ? selectedTargets[0].actor : null;
        try {
          const circumstance = await add2ePromptContextualReaction(this.actor, targetActor);
          if (!circumstance) return;
          await add2eRollContextualReactionCard(this.actor, targetActor, {
            source: "actor-sheet-charisma-reaction",
            circumstance
          });
        } catch (error) {
          console.error("[ADD2E][CHARISME][CONTEXTUAL_REACTION_ERROR]", {
            actor: this.actor?.name,
            target: targetActor?.name,
            error
          });
          ui.notifications.error(error?.message || "Erreur pendant le jet de réaction.");
        }
      });
  };

  prototype.__add2eContextualReactionV1 = true;
  return true;
}

globalThis.add2eCollectIncomingReactionModifiers = add2eCollectIncomingReactionModifiers;
globalThis.add2eResolveIncomingReaction = add2eResolveIncomingReaction;
globalThis.add2eRollContextualReactionCard = add2eRollContextualReactionCard;

add2eInstallContextualReactionSheetBinding();
