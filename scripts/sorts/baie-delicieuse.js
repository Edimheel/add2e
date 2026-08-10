// ADD2E — onUse Clerc niveau 2 : Baie Délicieuse
// Compatible Foundry V13/V14/V15 — ApplicationV2 / DialogV2 via API commune ADD2E.
// Version : 2026-08-10-canonical-berry-resource-v3

const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][BAIE_DELICIEUSE_V3]";

function add2eHtmlEscape(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function add2eGetCasterToken() {
  return token ?? args?.[0]?.token ?? canvas?.tokens?.controlled?.[0] ?? null;
}

async function add2eChat(title, html, speakerToken = null, options = {}) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }

  const casterToken = speakerToken ?? add2eGetCasterToken();
  const casterActor = actor ?? casterToken?.actor ?? null;
  const casterName = casterActor?.name ?? casterToken?.name ?? "Clerc";
  const spellName = item?.name ?? title ?? "Sort divin";
  const targetLabel = options.targetLabel ?? casterName;
  const outcome = options.outcome ?? title ?? spellName;
  const rule = options.rule ?? "Effet du sort appliqué selon sa description et l’arbitrage du MD.";

  const card = {
    actor: casterActor,
    title: title ?? spellName,
    icon: "fas fa-leaf",
    variant: options.variant ?? "spell",
    source: {
      name: casterName,
      img: casterToken?.document?.texture?.src ?? casterActor?.img ?? item?.img ?? "icons/svg/mystery-man.svg",
      type: options.subtitle ?? "Sort divin"
    },
    rows: [
      { label: "Cible", value: String(targetLabel) },
      { label: "Effet", value: String(outcome) },
      { label: "Règle", value: String(rule) }
    ],
    trustedBodyHtml: html,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: casterActor, token: casterToken })
    }
  };

  globalThis.add2eBuildChatCard(card);
  return globalThis.add2eCreateChatCard(card);
}

async function add2eChooseMode() {
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }

  return globalThis.add2eDialogWait({
    add2eTheme: "druid",
    add2ePrimaryAction: "normal",
    add2eClasses: ["add2e-goodberry-choice"],
    window: { title: "Baie Délicieuse" },
    content: `
      <div class="add2e-dialog add2e-goodberry-choice-content">
        <p>Choisir la forme du sort.</p>
        <p><b>Baie Délicieuse</b> crée 2d4 baies magiques consommables qui soignent 1 PV chacune.</p>
        <p><b>Baie Empoisonnée</b> crée 2d4 baies inversées consommables qui infligent 1 dégât chacune.</p>
      </div>
    `,
    buttons: [
      {
        action: "normal",
        label: "Baie Délicieuse",
        icon: "<i class='fas fa-leaf'></i>",
        default: true,
        callback: () => "normal"
      },
      {
        action: "inverse",
        label: "Baie Empoisonnée",
        icon: "<i class='fas fa-skull-crossbones'></i>",
        callback: () => "inverse"
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

function add2eBerryItemData({ mode, quantity }) {
  const poisoned = mode === "inverse";
  const name = poisoned ? "Baie Empoisonnée" : "Baie Délicieuse";
  const slug = poisoned ? "baie_empoisonnee" : "baie_delicieuse";

  return {
    name,
    type: "objet",
    img: "icons/consumables/fruit/berries-ration-round-red.webp",
    system: {
      nom: name,
      type: "objet_magique",
      categorie: "consommable",
      equipee: false,
      quantite: quantity,
      description: poisoned
        ? "Baie créée par la forme inversée de Baie Délicieuse. Lorsqu’elle est consommée, elle inflige 1 dégât puis disparaît."
        : "Baie magique créée par Baie Délicieuse. Lorsqu’elle est consommée, elle rend 1 point de vie puis disparaît.",
      onUse: "systems/add2e/scripts/sorts/baie-delicieuse-consommation.js",
      tags: [
        `objet:${slug}`,
        "objet_magique:baie",
        "consommable:baie",
        poisoned ? "degat:poison" : "soin:1",
        poisoned ? "baie:empoisonnee" : "baie:delicieuse"
      ]
    },
    flags: {
      add2e: {
        slug,
        createdBySpell: "Baie Délicieuse",
        berryMode: poisoned ? "poison" : "heal",
        healAmount: poisoned ? 0 : 1,
        damageAmount: poisoned ? 1 : 0,
        consumeOnUse: true,
        createdAt: Date.now()
      }
    },
    effects: [],
    ownership: { default: 0 }
  };
}

async function add2eCreateBerries(mode) {
  if (!actor) {
    ui.notifications.warn("Baie Délicieuse : acteur lanceur introuvable.");
    return false;
  }

  const roll = await new Roll("2d4").evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor, token: add2eGetCasterToken() }),
    flavor: mode === "inverse" ? "Baie Empoisonnée — nombre de baies" : "Baie Délicieuse — nombre de baies"
  });

  const quantity = Number(roll.total) || 0;
  if (quantity <= 0) return false;

  const itemData = add2eBerryItemData({ mode, quantity });
  await actor.createEmbeddedDocuments("Item", [itemData], {
    add2eInternal: true,
    add2eReason: "goodberry-create"
  });

  await add2eChat(
    mode === "inverse" ? "Baie Empoisonnée" : "Baie Délicieuse",
    `<p><b>${quantity}</b> baie(s) créée(s) dans l’inventaire de <b>${add2eHtmlEscape(actor.name)}</b>.</p><p>${mode === "inverse" ? "Chaque baie inflige 1 dégât et disparaît après utilisation." : "Chaque baie soigne 1 PV et disparaît après utilisation."}</p>`,
    null,
    {
      targetLabel: actor.name,
      outcome: `${quantity} baie(s) créée(s)`,
      variant: mode === "inverse" ? "failure" : "success"
    }
  );
  return true;
}

const mode = await add2eChooseMode();
if (!mode) {
  ui.notifications.info("Baie Délicieuse annulé.");
  return false;
}

console.log(`${ADD2E_ONUSE_TAG}[START]`, { actor: actor?.name, mode });
return add2eCreateBerries(mode);
