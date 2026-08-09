// ADD2E — Rappel
// Compatible Foundry V13/V14/V15.
// Le sort conserve son comportement actuel : saisir les paramètres du rappel puis publier une carte commune.

const ADD2E_RAPPEL_VERSION = "2026-08-09-canonical-note-spell-v4";
const ADD2E_RAPPEL_CONFIG = Object.freeze({
  name: "Rappel",
  slug: "rappel",
  level: 6,
  description: "Rappel produit un déplacement magique ou un passage surnaturel. La destination, les limites de transport, les risques, les restrictions de plan et les protections éventuelles sont fixés par les règles du sort et par le MD selon la scène."
});

globalThis.ADD2E_RAPPEL_VERSION = ADD2E_RAPPEL_VERSION;

function add2eRappelEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eRappelCasterToken() {
  return token ?? args?.[0]?.token ?? canvas?.tokens?.controlled?.[0] ?? null;
}

async function add2eRappelParameters() {
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  return globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-rappel-dialog"],
    window: { title: ADD2E_RAPPEL_CONFIG.name },
    content: `
      <form class="add2e-rappel-form">
        <p><b>${add2eRappelEscape(ADD2E_RAPPEL_CONFIG.name)}</b></p>
        <div class="form-group">
          <label>Note de scène / cible / paramètres</label>
          <textarea name="note" rows="3"></textarea>
        </div>
      </form>
    `,
    buttons: [
      {
        action: "cast",
        label: ADD2E_RAPPEL_CONFIG.name,
        icon: "<i class='fas fa-place-of-worship'></i>",
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

async function add2eRappelChat(caster, casterToken, note) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  const targets = Array.from(game.user?.targets ?? []);
  const targetLabel = targets.length ? targets.map(target => target.name).join(", ") : caster?.name ?? "Clerc";
  const safeDescription = add2eRappelEscape(ADD2E_RAPPEL_CONFIG.description);
  const safeNote = add2eRappelEscape(note);
  const options = {
    actor: caster,
    title: ADD2E_RAPPEL_CONFIG.name,
    icon: "fas fa-place-of-worship",
    variant: "spell",
    source: {
      name: caster?.name ?? "Clerc",
      img: casterToken?.document?.texture?.src ?? caster?.img ?? item?.img ?? "icons/svg/mystery-man.svg",
      type: "Sort divin"
    },
    rows: [
      { label: "Cible", value: targetLabel },
      { label: "Résultat", value: ADD2E_RAPPEL_CONFIG.name.toUpperCase() }
    ],
    trustedBodyHtml: `<p>${safeDescription}</p>${safeNote ? `<p>Note : <b>${safeNote}</b></p>` : ""}<details style="margin-top:8px;"><summary>Règle appliquée</summary><div style="padding-top:6px;">${safeDescription}</div></details>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: { add2e: { spell: ADD2E_RAPPEL_CONFIG.slug, version: ADD2E_RAPPEL_VERSION } }
    }
  };
  globalThis.add2eBuildChatCard(options);
  return globalThis.add2eCreateChatCard(options);
}

const caster = actor ?? item?.parent ?? null;
if (!caster) {
  ui.notifications.error("Rappel : lanceur introuvable.");
  return false;
}

const parameters = await add2eRappelParameters();
if (!parameters) {
  ui.notifications.info("Rappel annulé.");
  return false;
}

await add2eRappelChat(caster, add2eRappelCasterToken(), parameters.note);
return true;
