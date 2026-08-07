// ADD2E — Consommation Baie Délicieuse / Baie Empoisonnée
// Compatible Foundry V13/V14/V15.
// Version : 2026-08-07-canonical-resource-v4

const ADD2E_BAIE_TAG = "[ADD2E][OBJET_ONUSE][BAIE_CONSOMMATION_V4]";

function add2eHtmlEscape(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function add2eGetActor() {
  return actor ?? item?.parent ?? token?.actor ?? canvas?.tokens?.controlled?.[0]?.actor ?? null;
}

function add2eReadQty(sourceItem) {
  const candidates = [
    sourceItem?.system?.quantite,
    sourceItem?.system?.quantity,
    sourceItem?.system?.charges?.value
  ];
  for (const value of candidates) {
    const number = Number(value);
    if (Number.isFinite(number)) return Math.max(0, number);
  }
  return 1;
}

function add2eBerryResourceEngine() {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine;
  if (!engine || typeof engine.transactResources !== "function") {
    throw new Error("Le domaine canonique ADD2E resource n’est pas disponible pour la consommation des baies.");
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
    write: next => {
      const update = {};
      if (sourceItem.system?.quantite !== undefined) update["system.quantite"] = next;
      if (sourceItem.system?.quantity !== undefined) update["system.quantity"] = next;
      if (sourceItem.system?.charges?.value !== undefined) update["system.charges.value"] = next;
      if (!Object.keys(update).length) update["system.quantite"] = next;
      return sourceItem.update(update, {
        add2eInternal: true,
        add2eReason: "berry-consumption-resource",
        render: false
      });
    }
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
const healAmount = Number(item.flags?.add2e?.healAmount ?? 1) || 0;
const damageAmount = Number(item.flags?.add2e?.damageAmount ?? 0) || 0;
const current = Number(targetActor.system?.pdv ?? 0);
const max = Number(targetActor.system?.points_de_coup ?? targetActor.system?.pv_max ?? 0) || 0;
if (!Number.isFinite(current)) {
  ui.notifications.warn(`Baie : impossible de lire system.pdv sur ${targetActor.name}.`);
  console.warn(`${ADD2E_BAIE_TAG}[MISSING_SYSTEM_PDV]`, { actor: targetActor.name, system: targetActor.system });
  return false;
}

const quantityBefore = add2eReadQty(item);
if (quantityBefore < 1) {
  ui.notifications.warn(`${item.name} n’est plus disponible.`);
  return false;
}

let hpAfter = current;
const transaction = await add2eBerryResourceEngine().transactResources(
  add2eBerryResource(targetActor, item),
  async () => {
    hpAfter = mode === "poison"
      ? Math.max(0, current - damageAmount)
      : max > 0 ? Math.min(max, current + healAmount) : current + healAmount;
    await targetActor.update({ "system.pdv": hpAfter });
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
    `<p><b>${add2eHtmlEscape(targetActor.name)}</b> consomme une baie empoisonnée et subit <b>${damageAmount}</b> dégât.</p>`,
    { targetLabel: targetActor.name, outcome: `${damageAmount} dégât`, variant: "failure" }
  );
} else {
  await add2eChat(
    label,
    `<p><b>${add2eHtmlEscape(targetActor.name)}</b> consomme une baie délicieuse et récupère <b>${healAmount}</b> PV.</p>`,
    { targetLabel: targetActor.name, outcome: `+${healAmount} PV`, variant: "success" }
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
  qtyBefore: quantityBefore,
  qtyAfter: quantityAfter
});
return true;
