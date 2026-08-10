// ADD2E — Consommation Baie Délicieuse / Baie Empoisonnée
// Compatible Foundry V13/V14/V15.
// Version : 2026-08-10-canonical-berry-resource-v6

const ADD2E_BAIE_TAG = "[ADD2E][OBJET_ONUSE][BAIE_CONSOMMATION_V6]";

function add2eHtmlEscape(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function add2eGetActor() {
  return actor ?? item?.parent ?? token?.actor ?? canvas?.tokens?.controlled?.[0]?.actor ?? null;
}

function add2eReadQty(sourceItem) {
  const value = Number(sourceItem?.system?.quantite);
  if (!Number.isFinite(value)) {
    throw new Error(`${sourceItem?.name ?? "Consommable"} : system.quantite canonique est absent.`);
  }
  return Math.max(0, Math.floor(value));
}

function add2eBerryResourceEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (
    !engine
    || typeof engine.transactResources !== "function"
    || typeof engine.readHitPoints !== "function"
    || typeof engine.readMaximumHitPoints !== "function"
    || typeof engine.applyHitPointDamage !== "function"
    || typeof engine.applyHitPointHealing !== "function"
  ) {
    throw new Error("Les domaines canoniques ADD2E resource et hit-points ne sont pas disponibles pour la consommation des baies.");
  }
  return engine;
}

function add2eBerryResource(owner, sourceItem) {
  return {
    id: `${sourceItem.uuid ?? sourceItem.id}:berry-quantity`,
    type: "consumable-item",
    label: sourceItem.name,
    document: sourceItem,
    actor: owner,
    item: sourceItem,
    target: "quantity",
    get current() {
      return add2eReadQty(sourceItem);
    },
    maximum: null,
    cost: 1,
    source: {
      kind: "item",
      id: String(sourceItem.id ?? ""),
      uuid: String(sourceItem.uuid ?? ""),
      name: String(sourceItem.name ?? "Baie")
    },
    context: {
      consumer: "baie-delicieuse-consommation",
      itemId: String(sourceItem.id ?? "")
    },
    write: next => sourceItem.update(
      { "system.quantite": next },
      {
        add2eInternal: true,
        add2eReason: "berry-consumption-resource",
        render: false
      }
    )
  };
}

function add2eCasterToken() {
  const candidate = token ?? (typeof add2eGetCasterToken === "function" ? add2eGetCasterToken() : null);
  return candidate?.actor ? candidate : null;
}

async function add2eChat(title, bodyHtml, options = {}) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  const casterToken = add2eCasterToken();
  const casterActor = actor ?? casterToken?.actor ?? item?.parent ?? null;
  const casterName = casterActor?.name ?? casterToken?.name ?? "Clerc";
  const targetLabel = options.targetLabel ?? casterName;
  const outcome = options.outcome ?? title ?? item?.name ?? "Baie";
  const rule = options.rule ?? options.regle ?? "Effet appliqué selon la description de l’objet.";
  const card = {
    actor: casterActor,
    title: title ?? item?.name ?? "Baie",
    icon: "fas fa-leaf",
    variant: options.variant ?? "spell",
    source: {
      name: casterName,
      img: casterToken?.document?.texture?.src ?? casterActor?.img ?? item?.img ?? "icons/svg/mystery-man.svg",
      type: options.subtitle ?? "Objet consommable"
    },
    rows: [
      { label: "Cible", value: String(targetLabel) },
      { label: "Effet", value: String(outcome) },
      { label: "Règle", value: String(rule) }
    ],
    trustedBodyHtml: bodyHtml,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: casterActor, token: casterToken })
    }
  };
  globalThis.add2eBuildChatCard(card);
  return globalThis.add2eCreateChatCard(card);
}

const targetActor = add2eGetActor();
if (!targetActor) {
  ui.notifications.warn("Baie : acteur introuvable.");
  return false;
}
if (!item) {
  ui.notifications.warn("Baie : item introuvable.");
  return false;
}

const mode = item.flags?.add2e?.berryMode ?? "heal";
const healAmount = Math.max(0, Number(item.flags?.add2e?.healAmount ?? 1) || 0);
const damageAmount = Math.max(0, Number(item.flags?.add2e?.damageAmount ?? 0) || 0);
const engine = add2eBerryResourceEngine();
const current = engine.readHitPoints(targetActor);
const max = engine.readMaximumHitPoints(targetActor);
if (mode !== "poison" && (!Number.isFinite(max) || max <= 0)) {
  ui.notifications.warn(`Baie : PV maximum canoniques introuvables pour ${targetActor.name}.`);
  return false;
}

const quantityBefore = add2eReadQty(item);
if (quantityBefore < 1) {
  ui.notifications.warn(`${item.name} n’est plus disponible.`);
  return false;
}

let hpAfter = current;
let hpEffective = 0;
const transaction = await engine.transactResources(
  add2eBerryResource(targetActor, item),
  async () => {
    const mutation = mode === "poison"
      ? await engine.applyHitPointDamage(targetActor, damageAmount, {
        reason: "berry-poison-damage"
      })
      : await engine.applyHitPointHealing(targetActor, healAmount, {
        reason: "berry-healing"
      });
    hpAfter = Number(mutation?.after);
    hpEffective = Math.max(0, Number(mutation?.effective) || 0);
    return true;
  },
  {
    reason: "berry-consumption",
    consumer: "baie-delicieuse-consommation"
  }
);

if (!transaction.ok) {
  ui.notifications.warn(`${item.name} n’est plus disponible.`);
  return false;
}

const resourceState = transaction.resources?.[0] ?? null;
const quantityAfter = Math.max(0, Number(resourceState?.after ?? add2eReadQty(item)) || 0);
const label = item.name;
const itemName = item.name;

if (mode === "poison") {
  await add2eChat(
    label,
    `<p><b>${add2eHtmlEscape(targetActor.name)}</b> consomme une baie empoisonnée et subit <b>${hpEffective}</b> dégât.</p>`,
    { targetLabel: targetActor.name, outcome: `${hpEffective} dégât`, variant: "failure" }
  );
} else {
  await add2eChat(
    label,
    `<p><b>${add2eHtmlEscape(targetActor.name)}</b> consomme une baie délicieuse et récupère <b>${hpEffective}</b> PV.</p>`,
    { targetLabel: targetActor.name, outcome: `+${hpEffective} PV`, variant: "success" }
  );
}

if (quantityAfter <= 0) {
  await item.delete({ add2eInternal: true, add2eReason: "berry-consumed-empty" });
}

console.log(`${ADD2E_BAIE_TAG}[DONE]`, {
  actor: targetActor.name,
  item: itemName,
  mode,
  hpBefore: current,
  hpAfter,
  hpEffective,
  qtyBefore: quantityBefore,
  qtyAfter: quantityAfter
});
return true;
