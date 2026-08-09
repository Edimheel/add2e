// ADD2E — Communion
// Compatible Foundry V13/V14/V15.
// Le sort conserve son comportement actuel : saisir la question divine puis publier une carte commune.

const ADD2E_COMMUNION_VERSION = "2026-08-09-canonical-note-spell-v4";
const ADD2E_COMMUNION_CONFIG = Object.freeze({
  name: "Communion",
  slug: "communion",
  level: 5,
  description: "Communion permet au clerc de recevoir une information, une orientation ou une réponse d’origine divine. La réponse peut être directe, symbolique, partielle ou conditionnée par la clarté de la demande, la puissance de la cible et l’arbitrage du MD."
});

globalThis.ADD2E_COMMUNION_VERSION = ADD2E_COMMUNION_VERSION;

function add2eCommunionEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eCommunionCasterToken() {
  return token ?? args?.[0]?.token ?? canvas?.tokens?.controlled?.[0] ?? null;
}

async function add2eCommunionParameters() {
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  return globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-communion-dialog"],
    window: { title: ADD2E_COMMUNION_CONFIG.name },
    content: `
      <form class="add2e-communion-form">
        <p><b>${add2eCommunionEscape(ADD2E_COMMUNION_CONFIG.name)}</b></p>
        <div class="form-group">
          <label>Note de scène / cible / paramètres</label>
          <textarea name="note" rows="3"></textarea>
        </div>
      </form>
    `,
    buttons: [
      {
        action: "cast",
        label: ADD2E_COMMUNION_CONFIG.name,
        icon: "<i class='fas fa-hands-praying'></i>",
        default: true,
        callback: (_event, button) => ({ note: String(button.form?.elements?.note?.value ?? "") })
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

async function add2eCommunionChat(caster, casterToken, note) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  const targets = Array.from(game.user?.targets ?? []);
  const targetLabel = targets.length ? targets.map(target => target.name).join(", ") : caster?.name ?? "Clerc";
  const safeDescription = add2eCommunionEscape(ADD2E_COMMUNION_CONFIG.description);
  const safeNote = add2eCommunionEscape(note);
  const options = {
    actor: caster,
    title: ADD2E_COMMUNION_CONFIG.name,
    icon: "fas fa-hands-praying",
    variant: "spell",
    source: {
      name: caster?.name ?? "Clerc",
      img: casterToken?.document?.texture?.src ?? caster?.img ?? item?.img ?? "icons/svg/mystery-man.svg",
      type: "Sort divin"
    },
    rows: [
      { label: "Cible", value: targetLabel },
      { label: "Résultat", value: ADD2E_COMMUNION_CONFIG.name.toUpperCase() }
    ],
    trustedBodyHtml: `<p>${safeDescription}</p>${safeNote ? `<p>Note : <b>${safeNote}</b></p>` : ""}<details style="margin-top:8px;"><summary>Règle appliquée</summary><div style="padding-top:6px;">${safeDescription}</div></details>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: { add2e: { spell: ADD2E_COMMUNION_CONFIG.slug, version: ADD2E_COMMUNION_VERSION } }
    }
  };
  globalThis.add2eBuildChatCard(options);
  return globalThis.add2eCreateChatCard(options);
}

const caster = actor ?? item?.parent ?? null;
if (!caster) {
  ui.notifications.error("Communion : lanceur introuvable.");
  return false;
}

const parameters = await add2eCommunionParameters();
if (!parameters) {
  ui.notifications.info("Communion annulée.");
  return false;
}

await add2eCommunionChat(caster, add2eCommunionCasterToken(), parameters.note);
return true;
