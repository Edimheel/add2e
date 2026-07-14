// ADD2E — Préchargement des partials de la feuille personnage.

const ADD2E_CHARACTER_SHEET_PARTIALS = [
  "systems/add2e/templates/actor/parts/character-header.hbs",
  "systems/add2e/templates/actor/parts/character-caracs-saves.hbs",
  "systems/add2e/templates/actor/parts/carac-force.hbs",
  "systems/add2e/templates/actor/parts/carac-dexterite.hbs",
  "systems/add2e/templates/actor/parts/carac-constitution.hbs",
  "systems/add2e/templates/actor/parts/carac-intelligence.hbs",
  "systems/add2e/templates/actor/parts/carac-sagesse.hbs",
  "systems/add2e/templates/actor/parts/carac-charisme.hbs",
  "systems/add2e/templates/actor/parts/character-saves.hbs",
  "systems/add2e/templates/actor/parts/character-tabs.hbs",
  "systems/add2e/templates/actor/parts/tab-resume.hbs",
  "systems/add2e/templates/actor/parts/tab-combat.hbs",
  "systems/add2e/templates/actor/parts/tab-capacites.hbs",
  "systems/add2e/templates/actor/parts/tab-sorts.hbs",
  "systems/add2e/templates/actor/parts/tab-effets.hbs",
  "systems/add2e/templates/actor/parts/tab-equipement.hbs",
  "systems/add2e/templates/actor/parts/tab-notes.hbs"
];

Hooks.once("init", async () => {
  await foundry.applications.handlebars.loadTemplates(ADD2E_CHARACTER_SHEET_PARTIALS);
});

// Une copie depuis un livre produit historiquement un message de jet puis une
// carte de résultat. Le regroupement est effectué après création afin de ne
// jamais modifier une chaîne HTML pendant la préparation du document.
const ADD2E_BOOK_LEARNING_CHAT_VERSION = "2026-07-14-v17-post-create-single-card";
globalThis.ADD2E_BOOK_LEARNING_CHAT_VERSION = ADD2E_BOOK_LEARNING_CHAT_VERSION;

const ADD2E_PENDING_BOOK_LEARNING_ROLLS = new Map();

function add2eBookLearningNormalize(value) {
  return String(value ?? "").trim().toLowerCase()
    .replace(/œ/g, "oe").replace(/æ/g, "ae")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function add2eBookLearningEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function add2eBookLearningActorKey(message) {
  return String(message?.speaker?.actor ?? message?.speaker?.token ?? message?.user?.id ?? game.user?.id ?? "global");
}

function add2eBookLearningRollTotal(message) {
  const rolls = Array.isArray(message?.rolls) ? message.rolls : [];
  const total = Number(rolls[0]?.total ?? rolls[0]?._total);
  return Number.isFinite(total) ? total : null;
}

function add2eBookLearningImage(content) {
  return String(content ?? "").match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]
    ?? "icons/sundries/books/book-embossed-gold-red.webp";
}

function add2eParseBookLearningRoll(message) {
  const flavor = String(message?.flavor ?? "");
  const content = String(message?.content ?? "");
  const text = `${flavor} ${content}`;
  const normalized = add2eBookLearningNormalize(text);
  const total = add2eBookLearningRollTotal(message);
  if (total === null || !normalized.includes("test_de_comprehension") || !normalized.includes("livre_de_sorts")) return null;

  const chanceMatch = text.match(/chance\s*:?\s*(\d+)\s*%/i);
  const cleanedFlavor = flavor.replace(/^\s*test\s+de\s+compr[ée]hension\s*[-—:]?\s*/i, "").trim();
  const parts = cleanedFlavor.split(/\s+[—–-]\s+/);
  return {
    createdAt: Date.now(),
    messageId: message.id,
    total,
    chance: chanceMatch ? Number(chanceMatch[1]) : null,
    spellName: String(parts[0] ?? "Sort").trim() || "Sort",
    sourceName: String(parts.slice(1).join(" — ") || "Livre de sorts").trim(),
    img: add2eBookLearningImage(content)
  };
}

function add2eIsFinalBookLearningMessage(message) {
  const normalized = add2eBookLearningNormalize(`${message?.flavor ?? ""} ${message?.content ?? ""}`);
  return normalized.includes("copie_d_un_sort_depuis_un_livre")
    || normalized.includes("copie_dun_sort_depuis_un_livre")
    || normalized.includes("ajoute_au_livre_personnel_et_a_la_liste_des_sorts")
    || normalized.includes("na_pas_ete_appris");
}

function add2eBuildBookLearningCard(result, originalContent) {
  const original = add2eBookLearningNormalize(originalContent);
  const explicitFailure = original.includes("echec")
    || original.includes("nest_pas_compris")
    || original.includes("n_est_pas_compris")
    || original.includes("na_pas_ete_appris");
  const explicitSuccess = original.includes("a_ete_ajoute")
    || original.includes("ajoute_au_livre")
    || original.includes("reussite");
  const success = explicitSuccess || (!explicitFailure
    && Number.isFinite(result.total)
    && Number.isFinite(result.chance)
    && result.total <= result.chance);
  const status = success ? "Réussite" : "Échec";
  const detail = success
    ? `${result.spellName} a été ajouté au livre personnel et à la liste des sorts.`
    : `${result.spellName} n’a pas été appris et n’a pas été ajouté au livre personnel.`;

  return `
    <div class="add2e-card add2e-arcane-card add2e-book-learning-card ${success ? "is-success" : "is-failure"}">
      <header class="add2e-card-header">
        <img src="${add2eBookLearningEscape(result.img)}" alt="">
        <div>
          <h3><i class="fas fa-dice-d20"></i> Copie d’un sort depuis un livre</h3>
          <div class="add2e-card-source">${add2eBookLearningEscape(result.sourceName)}</div>
        </div>
      </header>
      <div class="add2e-card-body">
        <div class="add2e-book-learning-grid">
          <b>Sort</b><span>${add2eBookLearningEscape(result.spellName)}</span>
          <b>Résultat</b><span>${result.total}</span>
          <b>Chance</b><span>${Number.isFinite(result.chance) ? `${result.chance}%` : "—"}</span>
        </div>
        <div class="add2e-book-learning-status">${status}</div>
        <p>${add2eBookLearningEscape(detail)}</p>
      </div>
    </div>`;
}

function add2eInstallBookLearningCardStyles() {
  const id = "add2e-book-learning-card-style";
  const old = document.getElementById(id);
  if (old?.dataset?.version === ADD2E_BOOK_LEARNING_CHAT_VERSION) return;
  old?.remove();
  const style = document.createElement("style");
  style.id = id;
  style.dataset.version = ADD2E_BOOK_LEARNING_CHAT_VERSION;
  style.textContent = `
.chat-message .add2e-book-learning-card{overflow:hidden;border:2px solid #8060cc;border-radius:10px;background:linear-gradient(180deg,#f8f3ff,#e8ddfb);color:#211735}
.chat-message .add2e-book-learning-card .add2e-card-header{display:flex;align-items:center;gap:8px;padding:7px 9px;background:linear-gradient(90deg,#2e1c5a,#6b49b8);color:#fff}
.chat-message .add2e-book-learning-card .add2e-card-header img{width:38px!important;height:38px!important;min-width:38px!important;max-width:38px!important;object-fit:cover;border:1px solid rgba(255,255,255,.85);border-radius:6px;background:#fff}
.chat-message .add2e-book-learning-card .add2e-card-header h3{margin:0!important;border:0!important;color:#fff!important;font-size:1rem!important;line-height:1.15}
.chat-message .add2e-book-learning-card .add2e-card-source{font-size:.82rem;opacity:.92}
.chat-message .add2e-book-learning-card .add2e-card-body{padding:9px 10px}
.chat-message .add2e-book-learning-grid{display:grid;grid-template-columns:auto 1fr;gap:3px 8px;margin:0 0 7px}
.chat-message .add2e-book-learning-status{font-weight:900;margin:5px 0}
.chat-message .add2e-book-learning-card.is-success .add2e-book-learning-status{color:#17652d}
.chat-message .add2e-book-learning-card.is-failure .add2e-book-learning-status{color:#8b1e1e}
`;
  document.head.append(style);
}

async function add2eConsolidateBookLearningMessage(message, _options, userId) {
  if (String(userId ?? "") !== String(game.user?.id ?? "")) return;

  const roll = add2eParseBookLearningRoll(message);
  if (roll) {
    const key = add2eBookLearningActorKey(message);
    ADD2E_PENDING_BOOK_LEARNING_ROLLS.set(key, roll);
    window.setTimeout(() => {
      if (ADD2E_PENDING_BOOK_LEARNING_ROLLS.get(key) === roll) ADD2E_PENDING_BOOK_LEARNING_ROLLS.delete(key);
    }, 15000);
    return;
  }

  if (!add2eIsFinalBookLearningMessage(message)) return;
  const key = add2eBookLearningActorKey(message);
  const result = ADD2E_PENDING_BOOK_LEARNING_ROLLS.get(key);
  if (!result || Date.now() - result.createdAt > 15000) return;
  ADD2E_PENDING_BOOK_LEARNING_ROLLS.delete(key);

  const card = add2eBuildBookLearningCard(result, message.content);
  await message.update({ content: card, flavor: null, rolls: [] }, { add2eBookLearningMerge: true });

  const rollMessage = game.messages?.get?.(result.messageId);
  if (rollMessage && rollMessage.id !== message.id) {
    await rollMessage.delete({ add2eBookLearningMerge: true });
  }
}

Hooks.once("ready", add2eInstallBookLearningCardStyles);
Hooks.on("createChatMessage", (message, options, userId) => {
  void add2eConsolidateBookLearningMessage(message, options, userId).catch(error => {
    console.error("[ADD2E][BOOK_LEARNING_CHAT][ERROR]", error);
  });
});
