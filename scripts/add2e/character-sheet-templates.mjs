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

const ADD2E_BOOK_LEARNING_CHAT_VERSION = "2026-07-16-v23-scroll-learning-card-consumption";
globalThis.ADD2E_BOOK_LEARNING_CHAT_VERSION = ADD2E_BOOK_LEARNING_CHAT_VERSION;

const ADD2E_PENDING_BOOK_LEARNING_ROLLS = new Map();
const ADD2E_PENDING_SCROLL_LEARNING_ROLLS = new Map();

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

function add2eBookLearningRolls(message, data = {}) {
  const rolls = message?.rolls ?? data?.rolls ?? [];
  return Array.isArray(rolls) ? rolls : [];
}

function add2eBookLearningRollTotal(message, data = {}) {
  const first = add2eBookLearningRolls(message, data)[0] ?? null;
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

function add2eParseScrollLearningRoll(message, data = {}) {
  const flavor = String(data?.flavor ?? message?.flavor ?? "");
  const content = String(data?.content ?? message?.content ?? "");
  const plain = add2eBookLearningPlainText(`${flavor} ${content}`);
  const normalized = add2eBookLearningNormalize(plain);
  const total = add2eBookLearningRollTotal(message, data);

  if (total === null || !normalized.includes("comprehension_de") || normalized.includes("livre_de_sorts")) return null;
  if (!normalized.includes("chance") || (!normalized.includes("reussite") && !normalized.includes("echec"))) return null;

  const chanceMatch = plain.match(/chance\s*:?\s*(\d+)\s*%/i);
  const spellMatch = plain.match(/compr[ée]hension\s+de\s+(.+?)\s*[-—]\s*chance/i);

  return {
    createdAt: Date.now(),
    total,
    chance: chanceMatch ? Number(chanceMatch[1]) : null,
    spellName: String(spellMatch?.[1] ?? "Sort").trim(),
    sourceName: "Parchemin de sort",
    img: "icons/sundries/scrolls/scroll-runed-brown.webp"
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

function add2eIsFinalScrollLearningMessage(message, data = {}) {
  const plain = add2eBookLearningPlainText(`${data?.flavor ?? message?.flavor ?? ""} ${data?.content ?? message?.content ?? ""}`);
  const normalized = add2eBookLearningNormalize(plain);
  return normalized.includes("copie_depuis_un_parchemin")
    || normalized.includes("copie_d_un_parchemin")
    || normalized.includes("inscription_disparait_du_parchemin")
    || normalized.includes("inscription_du_parchemin");
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

function add2eBuildScrollLearningCard(result, originalContent) {
  const plain = add2eBookLearningPlainText(originalContent);
  const normalized = add2eBookLearningNormalize(plain);
  const success = normalized.includes("sort_est_copie")
    || normalized.includes("copie_dans_le_livre_personnel")
    || (Number.isFinite(result.total) && Number.isFinite(result.chance) && result.total <= result.chance);
  const consumed = normalized.includes("disparait_du_parchemin")
    || normalized.includes("effacee_apres_la_tentative")
    || !normalized.includes("na_pas_pu_etre_effacee");
  const spellName = result.spellName || "Sort";
  const status = success ? "Apprentissage réussi" : "Apprentissage échoué";
  const detail = success
    ? `${spellName} est copié dans le livre personnel.`
    : `${spellName} n’a pas été compris et n’est pas ajouté au livre personnel.`;
  const consumption = consumed
    ? "L’inscription a été effacée du parchemin après la tentative."
    : "L’inscription n’a pas pu être effacée du parchemin.";

  return `<div class="add2e-card add2e-arcane-card add2e-scroll-learning-card ${success ? "is-success" : "is-failure"}">
    <header class="add2e-card-header">
      <img src="${add2eBookLearningEscape(result.img)}" alt="">
      <div>
        <h3><i class="fas fa-scroll"></i> Apprentissage depuis un parchemin</h3>
        <div class="add2e-card-source">${add2eBookLearningEscape(result.sourceName)}</div>
      </div>
    </header>
    <div class="add2e-card-body">
      <div class="add2e-book-learning-grid">
        <b>Sort</b><span>${add2eBookLearningEscape(spellName)}</span>
        <b>Jet</b><span>${result.total}</span>
        <b>Chance</b><span>${Number.isFinite(result.chance) ? `${result.chance}%` : "—"}</span>
      </div>
      <div class="add2e-book-learning-status">${status}</div>
      <p>${add2eBookLearningEscape(detail)}</p>
      <p class="add2e-scroll-consumption"><i class="fas fa-fire"></i> ${add2eBookLearningEscape(consumption)}</p>
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
.chat-message .add2e-book-learning-card,.chat-message .add2e-scroll-learning-card{overflow:hidden;border:2px solid #8060cc;border-radius:10px;background:linear-gradient(180deg,#f8f3ff,#e8ddfb);color:#211735}
.chat-message .add2e-book-learning-card .add2e-card-header,.chat-message .add2e-scroll-learning-card .add2e-card-header{display:flex;align-items:center;gap:8px;padding:7px 9px;background:linear-gradient(90deg,#2e1c5a,#6b49b8);color:#fff}
.chat-message .add2e-scroll-learning-card{border-color:#9a6a20;background:linear-gradient(180deg,#fff9e9,#efe0b7);color:#38270d}
.chat-message .add2e-scroll-learning-card .add2e-card-header{background:linear-gradient(90deg,#56370e,#a27025)}
.chat-message .add2e-book-learning-card .add2e-card-header img,.chat-message .add2e-scroll-learning-card .add2e-card-header img{width:38px!important;height:38px!important;min-width:38px!important;max-width:38px!important;object-fit:cover;border:1px solid rgba(255,255,255,.85);border-radius:6px;background:#fff}
.chat-message .add2e-book-learning-card .add2e-card-header h3,.chat-message .add2e-scroll-learning-card .add2e-card-header h3{margin:0!important;border:0!important;color:#fff!important;font-size:1rem!important;line-height:1.15}
.chat-message .add2e-book-learning-card .add2e-card-source,.chat-message .add2e-scroll-learning-card .add2e-card-source{font-size:.82rem;opacity:.92}
.chat-message .add2e-book-learning-card .add2e-card-body,.chat-message .add2e-scroll-learning-card .add2e-card-body{padding:9px 10px}
.chat-message .add2e-book-learning-grid{display:grid;grid-template-columns:auto 1fr;gap:3px 8px;margin:0 0 7px}
.chat-message .add2e-book-learning-status{font-weight:900;margin:5px 0}
.chat-message .add2e-book-learning-card.is-success .add2e-book-learning-status,.chat-message .add2e-scroll-learning-card.is-success .add2e-book-learning-status{color:#17652d}
.chat-message .add2e-book-learning-card.is-failure .add2e-book-learning-status,.chat-message .add2e-scroll-learning-card.is-failure .add2e-book-learning-status{color:#8b1e1e}
.chat-message .add2e-scroll-learning-card .add2e-scroll-consumption{margin:7px 0 0;padding-top:7px;border-top:1px solid rgba(92,57,10,.35);font-size:.88rem}
`;
  document.head.append(style);
}

async function add2eShowBookLearningDice(message, data = {}) {
  const dice3d = game?.dice3d;
  if (!dice3d?.showForRoll) return false;
  const roll = add2eBookLearningRolls(message, data)[0] ?? null;
  if (!roll) return false;
  try {
    await dice3d.showForRoll(roll, game.user, true, null, false);
    return true;
  } catch (error) {
    console.warn("[ADD2E][BOOK_LEARNING_CHAT][DICE_SO_NICE] Animation impossible.", error);
    return false;
  }
}

function add2eRememberLearningRoll(map, key, roll) {
  map.set(key, roll);
  window.setTimeout(() => {
    if (map.get(key) === roll) map.delete(key);
  }, 15000);
}

function add2ePrepareSingleBookLearningMessage(message, data = {}, _options = {}, userId = null) {
  if (userId && String(userId) !== String(game.user?.id ?? "")) return;

  const bookRoll = add2eParseBookLearningRoll(message, data);
  if (bookRoll) {
    const key = add2eBookLearningActorKey(message, data);
    add2eRememberLearningRoll(ADD2E_PENDING_BOOK_LEARNING_ROLLS, key, bookRoll);
    void add2eShowBookLearningDice(message, data);
    return false;
  }

  const scrollRoll = add2eParseScrollLearningRoll(message, data);
  if (scrollRoll) {
    const key = add2eBookLearningActorKey(message, data);
    add2eRememberLearningRoll(ADD2E_PENDING_SCROLL_LEARNING_ROLLS, key, scrollRoll);
    void add2eShowBookLearningDice(message, data);
    return false;
  }

  const key = add2eBookLearningActorKey(message, data);

  if (add2eIsFinalScrollLearningMessage(message, data)) {
    const result = ADD2E_PENDING_SCROLL_LEARNING_ROLLS.get(key);
    if (!result || Date.now() - result.createdAt > 15000) return;
    ADD2E_PENDING_SCROLL_LEARNING_ROLLS.delete(key);
    const originalContent = String(data?.content ?? message?.content ?? "");
    message.updateSource({
      content: add2eBuildScrollLearningCard(result, originalContent),
      flavor: null,
      rolls: []
    });
    return;
  }

  if (!add2eIsFinalBookLearningMessage(message, data)) return;

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

function add2eArcaneRawScrollEntries(scroll) {
  const document = scroll?.system?.arcaneDocument;
  if (!document || typeof document !== "object" || Array.isArray(document)) return [];
  if (Array.isArray(document.spells)) return foundry.utils.deepClone(document.spells);
  if (document.spell && typeof document.spell === "object") return [foundry.utils.deepClone(document.spell)];
  return [];
}

function add2eArcaneScrollEntryKey(entry) {
  return String(entry?.key ?? entry?.stableKey ?? entry?.spellKey ?? "").trim();
}

async function add2eConsumeScrollSpellReliable(actor, scroll, spellKey) {
  if (!actor || !scroll || String(scroll?.type ?? "").toLowerCase() !== "objet") return false;
  const liveScroll = actor.items?.get?.(scroll.id) ?? scroll;
  if (!liveScroll || liveScroll.parent?.id !== actor.id) return false;

  const kind = String(liveScroll.system?.arcaneDocument?.kind ?? liveScroll.flags?.add2e?.arcaneDocumentKind ?? "").toLowerCase();
  if (kind !== "spell-scroll") return false;

  const entries = add2eArcaneRawScrollEntries(liveScroll);
  const wanted = String(spellKey ?? "").trim();
  const wantedNormalized = add2eBookLearningNormalize(wanted);
  const index = entries.findIndex(entry => {
    const key = add2eArcaneScrollEntryKey(entry);
    return key === wanted || (wantedNormalized && add2eBookLearningNormalize(key) === wantedNormalized);
  });
  if (index < 0) return false;

  const quantityField = liveScroll.system?.quantite !== undefined ? "system.quantite" : "system.quantity";
  const quantity = Math.max(1, Math.floor(Number(liveScroll.system?.quantite ?? liveScroll.system?.quantity ?? 1) || 1));

  if (entries.length === 1 && quantity > 1) {
    await liveScroll.update({ [quantityField]: quantity - 1 }, {
      add2eInternal: true,
      add2eArcaneScroll: true,
      add2eArcaneConsume: true,
      render: false
    });
    return Number(liveScroll.system?.quantite ?? liveScroll.system?.quantity ?? 0) === quantity - 1;
  }

  entries.splice(index, 1);
  if (!entries.length) {
    await actor.deleteEmbeddedDocuments("Item", [liveScroll.id], {
      add2eInternal: true,
      add2eArcaneScroll: true,
      add2eArcaneConsume: true,
      render: false
    });
    return !actor.items?.has?.(liveScroll.id);
  }

  const nextDocument = foundry.utils.deepClone(liveScroll.system?.arcaneDocument ?? {});
  nextDocument.schema = Number(nextDocument.schema) || 1;
  nextDocument.kind = "spell-scroll";
  nextDocument.personal = false;
  nextDocument.spells = entries;
  delete nextDocument.spell;

  await liveScroll.update({ "system.arcaneDocument": nextDocument }, {
    add2eInternal: true,
    add2eArcaneScroll: true,
    add2eArcaneConsume: true,
    render: false
  });

  return !add2eArcaneRawScrollEntries(liveScroll)
    .some(entry => add2eArcaneScrollEntryKey(entry) === wanted);
}

function add2eInstallReliableScrollConsumption() {
  const api = globalThis.ADD2E_ARCANE_DOCUMENTS;
  if (!api || typeof api !== "object") return false;
  if (api.__add2eReliableScrollConsumptionV23 === true) return true;

  api.consumeScrollSpell = add2eConsumeScrollSpellReliable;
  api.__add2eReliableScrollConsumptionV23 = true;
  globalThis.add2eConsumeScrollSpellReliable = add2eConsumeScrollSpellReliable;
  return true;
}

const ADD2E_APPLICATION_V2 = foundry?.applications?.api?.ApplicationV2;

class Add2eSpellbookReaderApplication extends ADD2E_APPLICATION_V2 {
  static DEFAULT_OPTIONS = {
    id: "add2e-spellbook-reader-{id}",
    classes: ["add2e-spellbook-reader-window"],
    tag: "section",
    window: {
      frame: true,
      positioned: true,
      resizable: true,
      title: "Livre de sorts"
    },
    position: {
      width: 1120,
      height: 880
    }
  };

  constructor(options = {}) {
    const { content = "", ...applicationOptions } = options;
    super(applicationOptions);
    this._add2eContent = String(content ?? "");
  }

  async _renderHTML() {
    return `<div class="add2e-spellbook-reader-application-content">${this._add2eContent}</div>
      <footer class="add2e-spellbook-reader-footer">
        <button type="button" data-action="close"><i class="fa-solid fa-book"></i> Fermer</button>
      </footer>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  async _onRender(context, options) {
    await super._onRender?.(context, options);
    const root = this.element?.jquery ? this.element[0] : this.element;
    if (!(root instanceof HTMLElement)) return;

    const reader = root.querySelector(".add2e-spellbook-reader");
    if (reader && reader.dataset.bound !== "1") {
      reader.dataset.bound = "1";
      const activate = level => {
        reader.querySelectorAll(".add2e-spellbook-tab").forEach(tab => {
          tab.classList.toggle("is-active", tab.dataset.level === level);
        });
        reader.querySelectorAll(".add2e-spellbook-panel").forEach(panel => {
          panel.classList.toggle("is-active", panel.dataset.level === level);
        });
        const pages = reader.querySelector(".add2e-spellbook-pages");
        if (pages) pages.scrollTop = 0;
      };
      for (const tab of reader.querySelectorAll(".add2e-spellbook-tab")) {
        tab.addEventListener("click", event => {
          event.preventDefault();
          activate(tab.dataset.level);
        });
      }
      activate(reader.querySelector(".add2e-spellbook-tab")?.dataset?.level ?? "1");
    }

    root.querySelector('[data-action="close"]')?.addEventListener("click", event => {
      event.preventDefault();
      void this.close();
    });
  }
}

globalThis.Add2eSpellbookReaderApplication = Add2eSpellbookReaderApplication;

function add2eInstallNonModalSpellbookWait() {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2 || DialogV2.__add2eNonModalSpellbookWaitV22) return false;
  if (typeof DialogV2.wait !== "function") return false;

  const originalWait = DialogV2.wait.bind(DialogV2);
  DialogV2.wait = function add2eNonModalSpellbookWait(options = {}, ...rest) {
    const content = String(options?.content ?? "");
    if (!content.includes("add2e-spellbook-reader")) return originalWait(options, ...rest);

    const application = new Add2eSpellbookReaderApplication({
      content,
      window: {
        ...(options.window ?? {}),
        title: String(options?.window?.title ?? "Livre de sorts"),
        resizable: true
      },
      position: {
        width: Number(options?.position?.width) || 1120,
        height: Number(options?.position?.height) || 880
      }
    });
    application.render({ force: true });
    return Promise.resolve(application);
  };

  DialogV2.__add2eNonModalSpellbookWaitV22 = true;
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
  add2eInstallReliableScrollConsumption();
  document.addEventListener("click", add2eOpenGmSpellbookAsSheet, true);
});

Hooks.on("preCreateChatMessage", add2ePrepareSingleBookLearningMessage);
