// ADD2E — Quête religieuse
// Compatible Foundry V13/V14/V15.
// Le sort conserve son comportement actuel : saisir la contrainte de quête puis publier une carte commune.

const ADD2E_QUETE_RELIGIEUSE_VERSION = "2026-08-09-canonical-note-spell-v4";
const ADD2E_QUETE_RELIGIEUSE_CONFIG = Object.freeze({
  name: "Quête religieuse",
  slug: "quete_religieuse",
  level: 5,
  description: "Quête religieuse impose, retire ou transforme un état important. Le script note la contrainte ou les paramètres de la quête ; les cas ambigus restent à valider par le MD."
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

function add2eQueteReligieuseCasterToken() {
  return token ?? args?.[0]?.token ?? canvas?.tokens?.controlled?.[0] ?? null;
}

async function add2eQueteReligieuseParameters() {
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  return globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-quete-religieuse-dialog"],
    window: { title: ADD2E_QUETE_RELIGIEUSE_CONFIG.name },
    content: `
      <form class="add2e-quete-religieuse-form">
        <p><b>${add2eQueteReligieuseEscape(ADD2E_QUETE_RELIGIEUSE_CONFIG.name)}</b></p>
        <div class="form-group">
          <label>Note de scène / cible / paramètres</label>
          <textarea name="note" rows="3"></textarea>
        </div>
      </form>
    `,
    buttons: [
      {
        action: "cast",
        label: ADD2E_QUETE_RELIGIEUSE_CONFIG.name,
        icon: "<i class='fas fa-scroll'></i>",
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

async function add2eQueteReligieuseChat(caster, casterToken, note) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  const targets = Array.from(game.user?.targets ?? []);
  const targetLabel = targets.length ? targets.map(target => target.name).join(", ") : caster?.name ?? "Clerc";
  const safeDescription = add2eQueteReligieuseEscape(ADD2E_QUETE_RELIGIEUSE_CONFIG.description);
  const safeNote = add2eQueteReligieuseEscape(note);
  const options = {
    actor: caster,
    title: ADD2E_QUETE_RELIGIEUSE_CONFIG.name,
    icon: "fas fa-scroll",
    variant: "spell",
    source: {
      name: caster?.name ?? "Clerc",
      img: casterToken?.document?.texture?.src ?? caster?.img ?? item?.img ?? "icons/svg/mystery-man.svg",
      type: "Sort divin"
    },
    rows: [
      { label: "Cible", value: targetLabel },
      { label: "Résultat", value: ADD2E_QUETE_RELIGIEUSE_CONFIG.name.toUpperCase() }
    ],
    trustedBodyHtml: `<p>${safeDescription}</p>${safeNote ? `<p>Note : <b>${safeNote}</b></p>` : ""}<details style="margin-top:8px;"><summary>Règle appliquée</summary><div style="padding-top:6px;">${safeDescription}</div></details>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: { add2e: { spell: ADD2E_QUETE_RELIGIEUSE_CONFIG.slug, version: ADD2E_QUETE_RELIGIEUSE_VERSION } }
    }
  };
  globalThis.add2eBuildChatCard(options);
  return globalThis.add2eCreateChatCard(options);
}

const caster = actor ?? item?.parent ?? null;
if (!caster) {
  ui.notifications.error("Quête religieuse : lanceur introuvable.");
  return false;
}

const parameters = await add2eQueteReligieuseParameters();
if (!parameters) {
  ui.notifications.info("Quête religieuse annulée.");
  return false;
}

await add2eQueteReligieuseChat(caster, add2eQueteReligieuseCasterToken(), parameters.note);
return true;
