// ADD2E — Contrôle du climat
// Compatible Foundry V13/V14/V15.
// Le sort conserve son comportement actuel : saisir les paramètres météorologiques puis publier une carte commune.

const ADD2E_CONTROLE_DU_CLIMAT_VERSION = "2026-08-09-canonical-note-spell-v4";
const ADD2E_CONTROLE_DU_CLIMAT_CONFIG = Object.freeze({
  name: "Contrôle du climat",
  slug: "controle_du_climat",
  level: 7,
  description: "Contrôle du climat modifie l’environnement, les éléments ou une zone. L’effet est principalement tactique et scénographique : le MD fixe les dimensions exactes, les dégâts éventuels, la praticabilité et les conséquences durables."
});

globalThis.ADD2E_CONTROLE_DU_CLIMAT_VERSION = ADD2E_CONTROLE_DU_CLIMAT_VERSION;

function add2eControleDuClimatEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eControleDuClimatCasterToken() {
  return token ?? args?.[0]?.token ?? canvas?.tokens?.controlled?.[0] ?? null;
}

async function add2eControleDuClimatParameters() {
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  return globalThis.add2eDialogWait({
    add2eTheme: "wizard",
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-controle-du-climat-dialog"],
    window: { title: ADD2E_CONTROLE_DU_CLIMAT_CONFIG.name },
    content: `
      <form class="add2e-controle-du-climat-form">
        <p><b>${add2eControleDuClimatEscape(ADD2E_CONTROLE_DU_CLIMAT_CONFIG.name)}</b></p>
        <div class="form-group">
          <label>Note de scène / cible / paramètres</label>
          <textarea name="note" rows="3"></textarea>
        </div>
      </form>
    `,
    buttons: [
      {
        action: "cast",
        label: ADD2E_CONTROLE_DU_CLIMAT_CONFIG.name,
        icon: "<i class='fas fa-cloud-sun'></i>",
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

async function add2eControleDuClimatChat(caster, casterToken, note) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  const targets = Array.from(game.user?.targets ?? []);
  const targetLabel = targets.length ? targets.map(target => target.name).join(", ") : caster?.name ?? "Clerc";
  const safeDescription = add2eControleDuClimatEscape(ADD2E_CONTROLE_DU_CLIMAT_CONFIG.description);
  const safeNote = add2eControleDuClimatEscape(note);
  const options = {
    actor: caster,
    title: ADD2E_CONTROLE_DU_CLIMAT_CONFIG.name,
    icon: "fas fa-cloud-sun",
    variant: "spell",
    source: {
      name: caster?.name ?? "Clerc",
      img: casterToken?.document?.texture?.src ?? caster?.img ?? item?.img ?? "icons/svg/mystery-man.svg",
      type: "Sort divin"
    },
    rows: [
      { label: "Cible", value: targetLabel },
      { label: "Résultat", value: ADD2E_CONTROLE_DU_CLIMAT_CONFIG.name.toUpperCase() }
    ],
    trustedBodyHtml: `<p>${safeDescription}</p>${safeNote ? `<p>Note : <b>${safeNote}</b></p>` : ""}<details style="margin-top:8px;"><summary>Règle appliquée</summary><div style="padding-top:6px;">${safeDescription}</div></details>`,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      flags: { add2e: { spell: ADD2E_CONTROLE_DU_CLIMAT_CONFIG.slug, version: ADD2E_CONTROLE_DU_CLIMAT_VERSION } }
    }
  };
  globalThis.add2eBuildChatCard(options);
  return globalThis.add2eCreateChatCard(options);
}

const caster = actor ?? item?.parent ?? null;
if (!caster) {
  ui.notifications.error("Contrôle du climat : lanceur introuvable.");
  return false;
}

const parameters = await add2eControleDuClimatParameters();
if (!parameters) {
  ui.notifications.info("Contrôle du climat annulé.");
  return false;
}

await add2eControleDuClimatChat(caster, add2eControleDuClimatCasterToken(), parameters.note);
return true;
