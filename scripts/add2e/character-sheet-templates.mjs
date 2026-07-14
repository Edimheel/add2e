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

const ADD2E_BOOK_LEARNING_CHAT_VERSION = "2026-07-14-v20-precreate-single-card-nonmodal-reader";
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

function add2eBookLearningPlainText(value) {
  const source = String(value ?? "");
  if (!source) return "";
  try {
    const template = document.createElement("template");
    template.innerHTML = source;
    return String(template.content.textContent ?? "").replace(/\s+/g, " ").trim();
  } catch (_error) {
    return source.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
}

function add2eBookLearningActorKey(message, data = {}) {
  return String(
    data?.speaker?.actor
    ?? message?.speaker?.actor
    ?? data?.speaker?.token
    ?? message?.speaker?.token
    ?? game.user?.id
    ?? "global"
  );
}

function add2eBookLearningRollTotal(message, data = {}) {
  const rolls = message?.rolls ?? data?.rolls ?? [];
  const first = Array.isArray(rolls) ? rolls[0] : null;
  const total = Number(first?.total ?? first?._total);
  return Number.isFinite(total) ? total : null;
}

function add2eBookLearningImage(content) {
  return String(content ?? "").match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]
    ?? "icons/sundries/books/book-embossed-gold-red.webp";
}

function add2eBookLearningSpellFromFinalText(text) {
  const success = text.match(/(.{1,120}?)\s+a\s+[ée]t[ée]\s+ajout[ée]\s+au\s+livre\s+personnel/i);
  if (success?.[1]) return success[1].replace(/^.*?(?:réussite|sort)\s*:?\s*/i, "").trim();
  const failure = text.match(/(.{1,120}?)\s+n['’]\s*a\s+pas\s+[ée]t[ée]\s+appris/i);
  if (failure?.[1]) return failure[1].replace(/^.*?(?:échec|sort)\s*:?\s*/i, "").trim();
  return "";
}

function add2eParseBookLearningRoll(message, data = {}) {
  const flavor = String(data?.flavor ?? message?.flavor ?? "");
  const content = String(data?.content ?? message?.content ?? "");
  const plain = add2eBookLearningPlainText(`${flavor} ${content}`);
  const normalized = add2eBookLearningNormalize(plain);
  const total = add2eBookLearningRollTotal(message, data);

  if (total === null || !normalized.includes("test_de_comprehension") || !normalized.includes("livre_de_sorts")) {
    return null;
  }

  const chanceMatch = plain.match(/chance\s*:?\s*(\d+)\s*%/i);
  const sourceMatch = plain.match(/(livre\s+de\s+sorts(?:\s+de\s+[a-zà-ÿ'’ -]+)?)/i);
  const spellMatch = plain.match(/test\s+de\s+compr[ée]hension\s*(?:[-—:]\s*)?(.+?)\s*[-—]\s*livre\s+de\s+sorts/i);

  return {
    createdAt: Date.now(),
    total,
    chance: chanceMatch ? Number(chanceMatch[1]) : null,
    spellName: String(spellMatch?.[1] ?? "").trim(),
    sourceName: String(sourceMatch?.[1] ?? "Livre de sorts").trim(),
    img: add2eBookLearningImage(content)
  };
}

function add2eIsFinalBookLearningMessage(message, data = {}) {
  const plain = add2eBookLearningPlainText(`${data?.flavor ?? message?.flavor ?? ""} ${data?.content ?? message?.content ?? ""}`);
  const normalized = add2eBookLearningNormalize(plain);
  return normalized.includes("copie_d_un_sort_depuis_un_livre")
    || normalized.includes("copie_dun_sort_depuis_un_livre")
    || normalized.includes("ajoute_au_livre_personnel_et_a_la_liste_des_sorts")
    || normalized.includes("na_pas_ete_appris");
}

function add2eBuildBookLearningCard(result, originalContent) {
  const plain = add2eBookLearningPlainText(originalContent);
  const normalized = add2eBookLearningNormalize(plain);
  const explicitFailure = normalized.includes("echec")
    || normalized.includes("nest_pas_compris")
    || normalized.includes("n_est_pas_compris")
    || normalized.includes("na_pas_ete_appris");
  const explicitSuccess = normalized.includes("a_ete_ajoute")
    || normalized.includes("ajoute_au_livre")
    || normalized.includes("reussite");
  const success = explicitSuccess || (!explicitFailure
    && Number.isFinite(result.total)
    && Number.isFinite(result.chance)
    && result.total <= result.chance);

  const spellName = add2eBookLearningSpellFromFinalText(plain)
    || result.spellName
    || "Sort";
  const status = success ? "Réussite" : "Échec";
  const detail = success
    ? `${spellName} a été ajouté au livre personnel et à la liste des sorts.`
    : `${spellName} n’a pas été appris et n’a pas été ajouté au livre personnel.`;

  return `<div class="add2e-card add2e-arcane-card add2e-book-learning-card ${success ? "is-success" : "is-failure"}">
    <header class="add2e-card-header">
      <img src="${add2eBookLearningEscape(result.img)}" alt="">
      <div>
        <h3><i class="fas fa-dice-d20"></i> Copie d’un sort depuis un livre</h3>
        <div class="add2e-card-source">${add2eBookLearningEscape(result.sourceName)}</div>
      </div>
    </header>
    <div class="add2e-card-body">
      <div class="add2e-book-learning-grid">
        <b>Sort</b><span>${add2eBookLearningEscape(spellName)}</span>
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

function add2ePrepareSingleBookLearningMessage(message, data = {}, _options = {}, userId = null) {
  if (userId && String(userId) !== String(game.user?.id ?? "")) return;

  const roll = add2eParseBookLearningRoll(message, data);
  if (roll) {
    const key = add2eBookLearningActorKey(message, data);
    ADD2E_PENDING_BOOK_LEARNING_ROLLS.set(key, roll);
    window.setTimeout(() => {
      if (ADD2E_PENDING_BOOK_LEARNING_ROLLS.get(key) === roll) {
        ADD2E_PENDING_BOOK_LEARNING_ROLLS.delete(key);
      }
    }, 15000);

    // Le message de jet n'est jamais créé : aucune notification éphémère parasite.
    return false;
  }

  if (!add2eIsFinalBookLearningMessage(message, data)) return;

  const key = add2eBookLearningActorKey(message, data);
  const result = ADD2E_PENDING_BOOK_LEARNING_ROLLS.get(key);
  if (!result || Date.now() - result.createdAt > 15000) return;
  ADD2E_PENDING_BOOK_LEARNING_ROLLS.delete(key);

  const originalContent = String(data?.content ?? message?.content ?? "");
  message.updateSource({
    content: add2eBuildBookLearningCard(result, originalContent),
    flavor: null,
    rolls: []
  });
}

function add2eInstallNonModalSpellbookWait() {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2 || DialogV2.__add2eNonModalSpellbookWaitV20) return false;
  if (typeof DialogV2.wait !== "function") return false;

  const originalWait = DialogV2.wait.bind(DialogV2);
  DialogV2.wait = function add2eNonModalSpellbookWait(options = {}, ...rest) {
    const content = String(options?.content ?? "");
    const isSpellbookReader = content.includes("add2e-spellbook-reader");

    if (!isSpellbookReader) return originalWait(options, ...rest);

    const application = new DialogV2({
      ...options,
      modal: false,
      rejectClose: false
    });
    application.render({ force: true });
    return Promise.resolve(application);
  };

  DialogV2.__add2eNonModalSpellbookWaitV20 = true;
  return true;
}

function add2eOpenGmSpellbookAsSheet(event) {
  if (!game.user?.isGM) return;

  const button = event.target instanceof Element
    ? event.target.closest('[data-add2e-arcane-action="view-book"][data-item-id]')
    : null;
  if (!button) return;

  const actorId = String(button.dataset.actorId ?? "").trim();
  const actor = game.actors?.get?.(actorId) ?? null;
  const book = actor?.items?.get?.(String(button.dataset.itemId ?? "")) ?? null;
  if (!book || String(book.system?.arcaneDocument?.kind ?? "").toLowerCase() !== "spellbook") return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  book.sheet?.render?.({ force: true });
}

add2eInstallNonModalSpellbookWait();

Hooks.once("init", async () => {
  await foundry.applications.handlebars.loadTemplates(ADD2E_CHARACTER_SHEET_PARTIALS);
});

Hooks.once("ready", () => {
  add2eInstallBookLearningCardStyles();
  add2eInstallNonModalSpellbookWait();
  document.addEventListener("click", add2eOpenGmSpellbookAsSheet, true);
});

Hooks.on("preCreateChatMessage", add2ePrepareSingleBookLearningMessage);
