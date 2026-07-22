// ADD2E — UI commune des fenêtres et messages liés aux sorts.
// Compatible Foundry V13/V14/V15 — DialogV2 / ApplicationV2 uniquement.
const VERSION = "2026-07-14-v18-canonical-spell-descriptions";
globalThis.ADD2E_SPELL_DIALOG_UI_VERSION = VERSION;

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function norm(value) {
  return String(value ?? "").trim().toLowerCase()
    .replace(/œ/g, "oe").replace(/æ/g, "ae")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_").replace(/^_|_$/g, "");
}

const THEMES = {
  cleric: { label:"Clerc", bg:"#fffaf0", accent:"#f3e6c8", dark:"#6f4b12", main:"#b88924", border:"#c99a36", text:"#2d2011" },
  druid: { label:"Druide", bg:"#f4faef", accent:"#dfeccd", dark:"#264a23", main:"#719c4a", border:"#7fa45d", text:"#202d1a" },
  wizard: { label:"Magicien", bg:"#f8f3ff", accent:"#e8ddfb", dark:"#2e1c5a", main:"#6b49b8", border:"#8060cc", text:"#211735" },
  illusionist: { label:"Illusionniste", bg:"#f9f7ff", accent:"#dff2ff", dark:"#275a8a", main:"#925ac6", border:"#70a9d6", text:"#1e3043" },
  thief: { label:"Voleur", bg:"#eff9fa", accent:"#cce9ed", dark:"#164a58", main:"#2a8293", border:"#3b9daf", text:"#14333b" }
};

function themeData(theme) { return THEMES[theme] ?? THEMES.cleric; }
function guessTheme({ title = "", content = "", theme = null } = {}) {
  if (theme && THEMES[theme]) return theme;
  const text = norm(`${title} ${content}`);
  if (text.includes("voleur") || text.includes("assassin")) return "thief";
  if (text.includes("illusionniste")) return "illusionist";
  if (text.includes("magicien") || text.includes("livre_de_sorts") || text.includes("parchemin") || text.includes("comprehension")) return "wizard";
  if (text.includes("druide")) return "druid";
  return "cleric";
}
function guessIcon({ title = "", content = "", img = null } = {}) {
  if (img) return img;
  return norm(`${title} ${content}`).includes("voleur") ? "icons/svg/eye.svg" : "icons/svg/book.svg";
}

function ensureStyles() {
  const id = "add2e-spell-dialog-ui-style";
  const old = document.getElementById(id);
  if (old?.dataset?.version === VERSION) return;
  old?.remove();
  const style = document.createElement("style");
  style.id = id;
  style.dataset.version = VERSION;
  style.textContent = `
.application.add2e-spell-dialog-window{border:2px solid var(--a2e-border)!important;border-radius:16px!important;overflow:hidden!important;background:linear-gradient(180deg,var(--a2e-bg),var(--a2e-accent))!important;color:var(--a2e-text)!important}
.application.add2e-spell-dialog-window .window-header{background:linear-gradient(90deg,var(--a2e-dark),var(--a2e-main))!important;color:#fff!important}
.application.add2e-spell-dialog-window .window-content{background:transparent!important;color:var(--a2e-text)!important}
.add2e-spell-dialog-shell{border:2px solid var(--a2e-border);border-radius:14px;overflow:hidden;background:linear-gradient(180deg,var(--a2e-bg),var(--a2e-accent));color:var(--a2e-text)}
.add2e-spell-dialog-header{display:flex;align-items:center;gap:10px;padding:10px 12px;background:linear-gradient(90deg,var(--a2e-dark),var(--a2e-main));color:#fff}
.add2e-spell-dialog-header img{width:42px;height:42px;border-radius:8px;background:#fff;object-fit:cover}
.add2e-spell-dialog-title{font-size:1.08rem;font-weight:800}.add2e-spell-dialog-body{padding:12px}
.add2e-book-copy-complete{color:#6b7280!important;background:#e5e7eb!important;border-color:#9ca3af!important;box-shadow:none!important}
.application.add2e-spellbook-reader-window{left:108px!important;top:52px!important;width:min(980px,calc(100vw - 520px))!important;height:min(820px,calc(100vh - 92px))!important;min-width:620px!important;min-height:520px!important;background:#382316!important;border:2px solid #7a512f!important}
.application.add2e-spellbook-reader-window .window-content{display:flex!important;flex-direction:column!important;min-height:0!important;height:100%!important;padding:10px!important;overflow:hidden!important;background:radial-gradient(ellipse at center,#6b472c 0%,#3b2417 72%,#24140d 100%)!important}
.add2e-spellbook-reader{display:flex;flex:1 1 auto;flex-direction:column;min-height:0;height:100%;overflow:hidden;color:#352414}
.add2e-spellbook-tabs{display:flex;flex:0 0 auto;flex-wrap:wrap;justify-content:center;gap:5px;padding:4px 14px 0}
.add2e-spellbook-tab{border:1px solid #78532d;border-bottom:0;border-radius:9px 9px 0 0;padding:7px 14px;background:linear-gradient(180deg,#d1ad74,#9f7542);color:#321f10;font-weight:800;cursor:pointer}
.add2e-spellbook-tab.is-active{background:linear-gradient(180deg,#fff2d2,#e6c991);transform:translateY(1px)}
.add2e-spellbook-pages{position:relative;flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;padding:28px 42px 40px;background-color:#ead5a7;background-image:radial-gradient(circle at 14% 18%,rgba(126,82,36,.12) 0 1px,transparent 2px),radial-gradient(circle at 78% 62%,rgba(108,68,27,.10) 0 1px,transparent 2px),linear-gradient(90deg,#b98c50 0,#dfc18a 2.2%,#f5e4ba 6%,#f9edce 46.5%,#c5a069 49.2%,#76502f 50%,#c5a069 50.8%,#f9edce 53.5%,#f5e4ba 94%,#dfc18a 97.8%,#b98c50 100%);background-size:46px 46px,59px 59px,100% 100%;border:3px solid #7c552f;border-radius:15px;box-shadow:inset 16px 0 20px rgba(78,45,18,.16),inset -16px 0 20px rgba(78,45,18,.16),0 9px 18px rgba(0,0,0,.35)}
.add2e-spellbook-panel{display:none;padding-bottom:18px}.add2e-spellbook-panel.is-active{display:block}
.add2e-spellbook-level-title{text-align:center;margin:0 0 18px;color:#573719;font-family:Georgia,serif;font-size:1.5rem;border-bottom:1px solid rgba(90,55,25,.38);padding-bottom:8px}
.add2e-spellbook-entry{margin:0 0 18px;padding:14px 16px;background:linear-gradient(135deg,rgba(255,251,234,.86),rgba(241,219,174,.72));border:1px solid rgba(112,77,39,.48);border-radius:10px}
.add2e-spellbook-entry-head{display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(112,77,39,.32);padding-bottom:8px;margin-bottom:10px}
.add2e-spellbook-entry-head img{width:44px;height:44px;object-fit:cover;border:1px solid #73522d;border-radius:6px}
.add2e-spellbook-entry-head h3{margin:0;color:#472b12;font-family:Georgia,serif;font-size:1.24rem}
.add2e-spellbook-entry-list{margin-left:auto;font-size:.84rem;font-weight:700;color:#75552b}
.add2e-spellbook-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 18px;font-size:.9rem}
.add2e-spellbook-field{display:grid;grid-template-columns:minmax(112px,auto) 1fr;gap:7px}.add2e-spellbook-field b{color:#58371a}
.add2e-spellbook-description{margin-top:11px;padding-top:10px;border-top:1px dashed rgba(112,77,39,.44);line-height:1.48}
.add2e-spellbook-description>strong{display:block;margin-bottom:6px;color:#58371a}
.add2e-spellbook-learn{margin-left:auto;white-space:nowrap;padding:6px 10px;border:1px solid #68451f;border-radius:6px;background:#f0d59d;color:#3d260f;font-weight:800;cursor:pointer}
.add2e-spellbook-learn:disabled{cursor:not-allowed;opacity:.55;background:#d8d0c2}
.add2e-spellbook-entry-state{margin-top:8px;font-weight:700;color:#6d4a24}
@media(max-width:1100px){.application.add2e-spellbook-reader-window{left:96px!important;width:calc(100vw - 430px)!important;min-width:520px!important}.add2e-spellbook-pages{padding:20px 24px 30px}}
`;
  document.head.append(style);
}

function shell({ theme = "cleric", title = "Sort", subtitle = "", img = "icons/svg/book.svg", body = "" } = {}) {
  ensureStyles();
  const t = themeData(theme);
  return `<div class="add2e-spell-dialog-shell" style="--a2e-bg:${t.bg};--a2e-accent:${t.accent};--a2e-dark:${t.dark};--a2e-main:${t.main};--a2e-border:${t.border};--a2e-text:${t.text};"><div class="add2e-spell-dialog-header"><img src="${esc(img)}" alt=""><div><div class="add2e-spell-dialog-title">${esc(title)}</div><div>${esc(subtitle || t.label)}</div></div></div><div class="add2e-spell-dialog-body">${body}</div></div>`;
}
function primaryButtonClass(buttons) { return buttons; }
function isManagedDialog(title, content) {
  const text = norm(`${title} ${content}`);
  return text.startsWith("lancement_") || text.includes("livre_de_sorts") || text.includes("grimoire") || text.includes("parchemin") || text.includes("copie_du_sort") || text.includes("connaissance") || text.includes("comprehension");
}
function wrapDialogOptions(options = {}) {
  const title = String(options?.window?.title ?? options?.title ?? "");
  const content = String(options?.content ?? "");
  if (!isManagedDialog(title, content) || content.includes("add2e-spell-dialog-shell") || content.includes("add2e-spellbook-reader")) return options;
  const theme = guessTheme({ title, content, theme: options?.add2eTheme });
  const classes = [...(Array.isArray(options?.window?.classes) ? options.window.classes : []), "add2e-spell-dialog-window"];
  return { ...options, window:{...(options.window ?? {}), classes:[...new Set(classes)]}, content:shell({theme,title:title || "ADD2E",subtitle:themeData(theme).label,img:guessIcon({title,content,img:options?.add2eImg}),body:content}) };
}
function patchDialogV2() {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2 || DialogV2.__add2eSpellDialogPatched) return;
  for (const method of ["wait","confirm","prompt","alert"]) {
    if (typeof DialogV2[method] !== "function") continue;
    const original = DialogV2[method].bind(DialogV2);
    DialogV2[method] = (options = {}, ...rest) => original(wrapDialogOptions(options), ...rest);
  }
  DialogV2.__add2eSpellDialogPatched = true;
}
function rootElement(html, app = null) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (app?.element instanceof HTMLElement) return app.element;
  if (app?.element?.[0] instanceof HTMLElement) return app.element[0];
  return null;
}
function bindSpellbookTabs(root) {
  const reader = root?.querySelector?.(".add2e-spellbook-reader");
  if (!reader || reader.dataset.bound === "1") return;
  reader.dataset.bound = "1";
  const activate = level => {
    reader.querySelectorAll(".add2e-spellbook-tab").forEach(tab => tab.classList.toggle("is-active", tab.dataset.level === level));
    reader.querySelectorAll(".add2e-spellbook-panel").forEach(panel => panel.classList.toggle("is-active", panel.dataset.level === level));
    const pages = reader.querySelector(".add2e-spellbook-pages");
    if (pages) pages.scrollTop = 0;
  };
  reader.querySelectorAll(".add2e-spellbook-tab").forEach(tab => tab.addEventListener("click", event => { event.preventDefault(); activate(tab.dataset.level); }));
  activate(reader.querySelector(".add2e-spellbook-tab")?.dataset?.level ?? "1");
}
function styleRenderedDialog(app, html) {
  const root = rootElement(html, app);
  if (!root) return;
  bindSpellbookTabs(root);
  if (root.querySelector(".add2e-spellbook-reader")) { root.classList.add("add2e-spellbook-reader-window"); return; }
  const title = String(app?.title ?? root.querySelector(".window-title")?.textContent ?? "");
  const content = String(root.querySelector(".window-content")?.textContent ?? root.textContent ?? "");
  if (!isManagedDialog(title, content)) return;
  const t = themeData(guessTheme({ title, content }));
  root.classList.add("add2e-spell-dialog-window");
  for (const [key,value] of Object.entries({"--a2e-bg":t.bg,"--a2e-accent":t.accent,"--a2e-dark":t.dark,"--a2e-main":t.main,"--a2e-border":t.border,"--a2e-text":t.text})) root.style.setProperty(key,value);
}

function spellLists(value) {
  try {
    const lists = globalThis.add2eGetSpellListsFromItem?.(value);
    if (Array.isArray(lists) && lists.length) return [...new Set(lists.map(norm).filter(Boolean))];
  } catch (_error) {}
  const raw = value?.lists ?? value?.spellLists ?? value?.classes ?? value?.classe ?? value?.class ?? value?.system?.spellLists ?? value?.system?.lists ?? value?.system?.liste ?? value?.system?.classe ?? value?.system?.class ?? [];
  const values = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,;|\n]+/g) : raw && typeof raw === "object" ? Object.values(raw) : [];
  return [...new Set(values.map(norm).filter(Boolean))];
}
function spellLevel(value) { return Math.max(1, Number(value?.level ?? value?.niveau ?? value?.spellLevel ?? value?.system?.niveau ?? value?.system?.level ?? value?.system?.niveau_sort ?? value?.system?.spellLevel ?? 1) || 1); }
function knownActorSpells(actor, book) {
  const ownerList = norm(book?.system?.arcaneDocument?.ownerList ?? book?.system?.arcaneDocument?.spellList ?? "");
  return Array.from(actor?.items ?? []).filter(item => {
    if (!["sort","spell"].includes(String(item?.type ?? "").toLowerCase())) return false;
    if (item?.system?.isPower === true || item?.system?.isObjectPower === true || item?.system?.isCapacity === true) return false;
    if (item?.flags?.add2e?.spellFamily?.generated === true) return false;
    const lists = spellLists(item);
    return !ownerList || !lists.length || lists.includes(ownerList);
  }).sort((a,b) => spellLevel(a)-spellLevel(b) || String(a.name).localeCompare(String(b.name),"fr"));
}
function actorKnowsBookEntry(actor, entry) {
  const name = norm(entry?.name ?? entry?.nom ?? entry?.label);
  const level = spellLevel(entry);
  const lists = spellLists(entry);
  return knownActorSpells(actor, null).some(item => norm(item.name) === name && spellLevel(item) === level && (!lists.length || spellLists(item).some(list => lists.includes(list))));
}
function actorSpellLists(actor) {
  const lists = new Set();
  try {
    for (const entry of globalThis.add2eGetSpellcastingEntries?.(actor) ?? []) {
      const key = norm(entry?.key);
      if (["magicien","illusionniste"].includes(key)) lists.add(key);
    }
  } catch (_error) {}
  for (const item of actor?.items ?? []) {
    if (String(item?.type ?? "").toLowerCase() !== "classe") continue;
    for (const value of [item.name,item.system?.slug,item.system?.label,item.system?.nom,item.system?.name]) {
      const key = norm(value);
      if (["magicien","illusionniste"].includes(key)) lists.add(key);
    }
  }
  return [...lists];
}
function externalBookAllSpellsKnown(actor, book) {
  const document = book?.system?.arcaneDocument ?? {};
  if (String(document.kind ?? "").toLowerCase() !== "spellbook" || document.personal === true) return false;
  const entries = Array.isArray(document.spells) ? document.spells : document.spell ? [document.spell] : [];
  return entries.length > 0 && entries.every(entry => actorKnowsBookEntry(actor, entry));
}
function styleEquipmentSpellbooks(app, html) {
  const actor = app?.actor ?? (app?.document?.documentName === "Actor" ? app.document : null);
  if (!actor || actor.type !== "personnage") return;
  const root = rootElement(html, app);
  for (const button of root?.querySelectorAll?.('[data-add2e-arcane-action="copy-book"][data-item-id]') ?? []) {
    const book = actor.items?.get?.(button.dataset.itemId);
    const complete = externalBookAllSpellsKnown(actor, book);
    button.classList.toggle("add2e-book-copy-complete", complete);
    button.classList.toggle("a2e-action-add", !complete);
    button.title = complete ? "Tous les sorts de ce livre sont déjà connus" : "Copier les sorts compatibles dans le livre personnel";
  }
}

let canonicalDocumentsPromise = null;
async function canonicalDocuments() {
  canonicalDocumentsPromise ??= (async () => {
    const pack = game.packs?.get?.("add2e.sorts");
    if (!pack || pack.documentName !== "Item") throw new Error("Compendium canonique introuvable : add2e.sorts");
    const documents = await pack.getDocuments();
    return documents.filter(document => String(document?.type ?? "").toLowerCase() === "sort");
  })();
  return canonicalDocumentsPromise;
}
function canonicalStableKey(value) {
  const name = String(value?.name ?? value?.nom ?? value?.label ?? "").trim();
  const system = value?.system ?? {
    niveau: spellLevel(value),
    spellLists: spellLists(value),
    classe: spellLists(value)
  };
  if (typeof globalThis.add2eSpellSyncStableKey === "function") {
    try { return globalThis.add2eSpellSyncStableKey(name, system); } catch (_error) {}
  }
  return `${spellLists(value).sort().join("+")}|${spellLevel(value)}|${norm(name)}`;
}
async function resolveCanonicalSpell(spell) {
  const sourceUuid = String(
    spell?.sourceUuid
    ?? spell?.flags?.core?.sourceId
    ?? spell?._stats?.compendiumSource
    ?? spell?.flags?.add2e?.sourceUuid
    ?? ""
  ).trim();
  if (sourceUuid.startsWith("Compendium.add2e.sorts.") && typeof fromUuid === "function") {
    try {
      const document = await fromUuid(sourceUuid);
      if (document?.documentName === "Item" && String(document.type).toLowerCase() === "sort") return document;
    } catch (_error) {}
  }

  const documents = await canonicalDocuments();
  const wantedKey = canonicalStableKey(spell);
  const exact = documents.find(document => canonicalStableKey(document) === wantedKey) ?? null;
  if (exact) return exact;

  const wantedName = norm(spell?.name ?? spell?.nom ?? spell?.label);
  const wantedLevel = spellLevel(spell);
  const wantedLists = spellLists(spell);
  const strictMatches = documents.filter(document => norm(document.name) === wantedName && spellLevel(document) === wantedLevel);
  const listMatch = strictMatches.find(document => {
    const lists = spellLists(document);
    return wantedLists.length > 0 && wantedLists.every(list => lists.includes(list));
  }) ?? null;
  if (listMatch) return listMatch;
  if (strictMatches.length === 1) return strictMatches[0];

  console.warn("[ADD2E][SPELLBOOK_READER][CANONICAL_NOT_FOUND]", {
    name: spell?.name ?? spell?.nom ?? spell?.label,
    level: wantedLevel,
    lists: wantedLists,
    sourceUuid,
    stableKey: wantedKey,
    candidates: strictMatches.map(document => ({ name: document.name, level: spellLevel(document), lists: spellLists(document), uuid: document.uuid }))
  });
  return null;
}
function formatSpellField(value) {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) return value.map(formatSpellField).filter(v => v !== "—").join(", ") || "—";
  if (typeof value === "object") {
    const direct = value.raw ?? value.texte ?? value.text ?? value.label ?? value.nom ?? value.name;
    if (direct !== undefined) return formatSpellField(direct);
    const amount = value.valeur ?? value.value ?? value.nombre ?? value.number;
    const unit = value.unite ?? value.unit;
    if (amount !== undefined) return `${amount}${unit ? ` ${unit}` : ""}`;
    return Object.values(value).map(formatSpellField).filter(v => v !== "—").join(", ") || "—";
  }
  return String(value).trim() || "—";
}
async function enrichSpellDescription(spell) {
  const raw = String(spell?.system?.description ?? "").trim();
  if (!raw) return "<em>Description canonique absente dans add2e.sorts.</em>";
  const editor = foundry?.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
  try { return editor?.enrichHTML ? await editor.enrichHTML(raw,{async:true,relativeTo:spell}) : esc(raw); }
  catch (_error) { return esc(raw); }
}
function bookEntries(book) {
  const document = book?.system?.arcaneDocument ?? {};
  const raw = Array.isArray(document.spells) ? document.spells : document.spell ? [document.spell] : [];
  return raw.filter(Boolean).map(entry => ({...entry,name:entry.name ?? entry.nom ?? entry.label ?? "Sort",level:spellLevel(entry),lists:spellLists(entry),img:entry.img ?? entry.image ?? book?.img}));
}
function actorIntelligence(actor) {
  const system = actor?.system ?? {};
  const direct = Number(system.intelligence ?? system.intelligence_total ?? system.intelligenceTotal);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
  return Math.floor((Number(system.intelligence_base) || 10) + (Number(system.intelligence_race) || 0) + (Number(system.bonus_caracteristiques?.intelligence) || 0));
}
function learningChance(actor) {
  const intelligence = Math.max(3, Math.min(18, actorIntelligence(actor)));
  const tableChance = Number(globalThis.INTELLIGENCE_TABLE?.[intelligence]?.chance_sort);
  if (Number.isFinite(tableChance)) return Math.max(0, Math.min(100, tableChance));
  return ({9:35,10:45,11:45,12:45,13:55,14:55,15:65,16:65,17:75,18:85})[intelligence] ?? 0;
}
function cleanEmbedded(source) {
  const data = foundry.utils.deepClone(source ?? {});
  delete data._id; delete data._stats; delete data.folder; delete data.ownership; delete data.sort;
  for (const effect of data.effects ?? []) { delete effect._id; delete effect._stats; delete effect.folder; delete effect.sort; }
  return data;
}
async function learnSpellFromExternalBook(actor, book, entry) {
  if (game.combat?.started === true) return ui.notifications.warn("L’apprentissage depuis un livre de sorts est impossible pendant un combat.");
  const actorLists = actorSpellLists(actor);
  const compatible = spellLists(entry).filter(list => actorLists.includes(list));
  if (!compatible.length) return ui.notifications.warn(`${actor.name} ne possède aucune classe compatible avec ${entry.name}.`);
  if (actorKnowsBookEntry(actor, entry)) return ui.notifications.info(`${actor.name} connaît déjà ${entry.name}.`);
  const sourceDocument = await resolveCanonicalSpell(entry);
  if (!sourceDocument?.toObject) return ui.notifications.error(`${entry.name} est introuvable dans le compendium canonique add2e.sorts.`);
  const chance = learningChance(actor);
  const roll = await new Roll("1d100").evaluate();
  const total = Number(roll.total) || 100;
  const success = total <= chance;
  await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:`Test de compréhension — ${esc(entry.name)} — Livre de sorts ${esc(book.name)} — Chance: ${chance}%`});
  if (success) {
    const data = cleanEmbedded(sourceDocument.toObject());
    data.system ??= {}; data.flags ??= {}; data.flags.core ??= {}; data.flags.add2e ??= {};
    data.system.spellLists = compatible;
    data.flags.core.sourceId = sourceDocument.uuid;
    data.flags.add2e.learnedSpellLists = compatible;
    data.flags.add2e.knownSpellLists = compatible;
    data.flags.add2e.manuallyLearnedSpell = true;
    data.flags.add2e.lastLearnedSpellList = compatible[0] ?? "";
    data.flags.add2e.learnedFromBookUuid = book.uuid;
    data.flags.add2e.learnedFromBookName = book.name;
    data.flags.add2e.bookCopyRoll = total;
    data.flags.add2e.bookCopyChance = chance;
    await actor.createEmbeddedDocuments("Item", [data], {add2eInternal:true,add2eArcaneCopy:true,render:false});
    try { await globalThis.add2eExpandActorSpellFamilies?.(actor); } catch (_error) {}
    try { await globalThis.add2eRemoveDuplicateActorSpells?.(actor,"book-learning"); } catch (_error) {}
    try { await globalThis.ADD2E_ARCANE_DOCUMENTS?.syncActorSpellbooks?.(actor,{reason:"book-learning"}); } catch (_error) {}
  }
  await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content:`<div><h3>Copie d’un sort depuis un livre</h3><p>${esc(entry.name)} ${success ? "a été ajouté au livre personnel et à la liste des sorts." : "n’a pas été appris et n’a pas été ajouté au livre personnel."}</p></div>`});
  globalThis.add2eRerenderActorSheet?.(actor,true);
  return success;
}

async function openPlayerSpellbook(actor, book) {
  const document = book?.system?.arcaneDocument ?? {};
  const personal = document.personal === true;
  const sourceRows = personal ? knownActorSpells(actor, book) : bookEntries(book);
  if (!sourceRows.length) return ui.notifications.info(`${book.name} ne contient aucun sort.`);
  const detailed = [];
  for (const embedded of sourceRows) {
    const canonical = await resolveCanonicalSpell(embedded);
    detailed.push({embedded,spell:canonical,level:spellLevel(canonical ?? embedded)});
  }
  const levels = [...new Set(detailed.map(row => row.level))].sort((a,b) => a-b);
  const tabs = levels.map(level => `<button type="button" class="add2e-spellbook-tab" data-level="${level}">Niveau ${level}</button>`).join("");
  const panels = [];
  for (const level of levels) {
    const cards = [];
    for (const row of detailed.filter(row => row.level === level)) {
      const spell = row.spell;
      const system = spell?.system ?? {};
      const description = spell
        ? await enrichSpellDescription(spell)
        : `<em>Le document canonique de ${esc(row.embedded?.name ?? "ce sort")} est introuvable dans add2e.sorts.</em>`;
      const lists = spell ? spellLists(spell) : spellLists(row.embedded);
      const listLabel = lists.map(list => list === "magicien" ? "Magicien" : list === "illusionniste" ? "Illusionniste" : list).join(" / ") || "Liste inconnue";
      const known = actorKnowsBookEntry(actor,row.embedded);
      const compatible = lists.some(list => actorSpellLists(actor).includes(list));
      const learnButton = personal ? "" : `<button type="button" class="add2e-spellbook-learn" data-spell-key="${esc(row.embedded.key ?? `${lists[0] ?? "sort"}|${row.level}|${norm(row.embedded.name)}`)}" ${known || !compatible || !spell ? "disabled" : ""}>${known ? "Déjà connu" : !spell ? "Source introuvable" : compatible ? "Apprendre" : "Incompatible"}</button>`;
      const fields = [
        ["École",system.ecole ?? system["école"] ?? system.school],
        ["Portée",system.portee ?? system["portée"] ?? system.range],
        ["Durée",system.duree ?? system["durée"] ?? system.duration],
        ["Temps d’incantation",system.temps_incantation ?? system.tempsIncantation ?? system.castingTime],
        ["Composantes",system.composantes ?? system.components],
        ["Composants matériels",system.composants_materiels ?? system.materialComponents],
        ["Zone d’effet",system.zone_effet ?? system.zoneEffet ?? system.areaOfEffect],
        ["Cible",system.cible ?? system.target],
        ["Jet de sauvegarde",system.jet_sauvegarde ?? system.jetSauvegarde ?? system.savingThrow]
      ].map(([label,value]) => `<div class="add2e-spellbook-field"><b>${label}</b><span>${esc(formatSpellField(value))}</span></div>`).join("");
      cards.push(`<article class="add2e-spellbook-entry"><div class="add2e-spellbook-entry-head"><img src="${esc(spell?.img ?? row.embedded?.img ?? book.img ?? "icons/svg/book.svg")}" alt=""><h3>${esc(spell?.name ?? row.embedded?.name ?? "Sort")}</h3><span class="add2e-spellbook-entry-list">${esc(listLabel)}</span>${learnButton}</div><div class="add2e-spellbook-fields">${fields}</div><div class="add2e-spellbook-description"><strong>Description</strong>${description}</div></article>`);
    }
    panels.push(`<section class="add2e-spellbook-panel" data-level="${level}"><h2 class="add2e-spellbook-level-title">Sorts de niveau ${level}</h2>${cards.join("")}</section>`);
  }
  const Reader = globalThis.Add2eSpellbookReaderApplication;
  if (typeof Reader !== "function") return ui.notifications.error("Le lecteur ApplicationV2 du livre de sorts est introuvable.");
  const application = new Reader({content:`<div class="add2e-spellbook-reader"><nav class="add2e-spellbook-tabs">${tabs}</nav><div class="add2e-spellbook-pages">${panels.join("")}</div></div>`,window:{title:`${book.name} — ${actor.name}`,resizable:true},position:{left:108,top:52,width:980,height:820}});
  application._add2eActor = actor;
  application._add2eBook = book;
  application.render({force:true});
  return application;
}
function bindBookLearningButtons(app, html) {
  const actor = app?._add2eActor;
  const book = app?._add2eBook;
  if (!actor || !book || book.system?.arcaneDocument?.personal === true) return;
  const root = rootElement(html, app);
  if (!root) return;
  const entries = bookEntries(book);
  for (const button of root.querySelectorAll(".add2e-spellbook-learn[data-spell-key]")) {
    if (button.dataset.bound === "1") continue;
    button.dataset.bound = "1";
    button.addEventListener("click", async event => {
      event.preventDefault(); event.stopPropagation();
      const entry = entries.find(candidate => String(candidate.key ?? `${candidate.lists?.[0] ?? "sort"}|${candidate.level}|${norm(candidate.name)}`) === String(button.dataset.spellKey));
      if (!entry) return ui.notifications.warn("Le sort sélectionné est introuvable dans ce livre.");
      button.disabled = true;
      const previous = button.textContent;
      button.textContent = "Jet en cours…";
      try {
        const success = await learnSpellFromExternalBook(actor,book,entry);
        if (success) button.textContent = "Appris";
        else { button.disabled = false; button.textContent = previous; }
      } catch (error) {
        console.error("[ADD2E][SPELLBOOK_READER][LEARN_ERROR]",{actor:actor.name,book:book.name,spell:entry.name,error});
        ui.notifications.error(error?.message || "Impossible d’apprendre ce sort.");
        button.disabled = false; button.textContent = previous;
      }
    });
  }
}
function actorFromSpellbookButton(button) {
  const actorId = String(button?.dataset?.actorId ?? "").trim();
  if (actorId) { const actor = game.actors?.get?.(actorId); if (actor) return actor; }
  const owner = button?.closest?.(".application,.window-app");
  for (const app of Object.values(ui.windows ?? {})) {
    const root = app?.element?.jquery ? app.element[0] : app?.element;
    if (root === owner || root?.contains?.(button)) return app?.actor ?? app?.document ?? null;
  }
  return null;
}
function bindPlayerSpellbookOpen() {
  if (globalThis.__ADD2E_PLAYER_SPELLBOOK_READER_BOUND_V18__) return;
  globalThis.__ADD2E_PLAYER_SPELLBOOK_READER_BOUND_V18__ = true;
  document.addEventListener("click", event => {
    const button = event.target instanceof Element ? event.target.closest('[data-add2e-arcane-action="view-book"][data-item-id]') : null;
    if (!button || game.user?.isGM) return;
    const actor = actorFromSpellbookButton(button);
    const book = actor?.items?.get?.(String(button.dataset.itemId ?? "")) ?? null;
    const document = book?.system?.arcaneDocument ?? {};
    if (String(document.kind ?? "").toLowerCase() !== "spellbook") return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    if (!actor || !book) return ui.notifications.error("Impossible de retrouver le personnage ou son livre de sorts.");
    void openPlayerSpellbook(actor,book).catch(error => {
      console.error("[ADD2E][SPELLBOOK_READER][ERROR]",{actor:actor.name,book:book.name,error});
      ui.notifications.error(error?.message || "Impossible d’ouvrir le livre de sorts.");
    });
  },true);
}
function styleChatMessage(message, html) {
  const root = rootElement(html);
  if (!root) return;
  const text = norm(String(message?.content ?? root.textContent ?? ""));
  if (!text.includes("connaissance") && !text.includes("comprehension") && !text.includes("copie_du_sort") && !text.includes("livre_de_sorts") && !text.includes("parchemin")) return;
  const card = root.querySelector(".add2e-card-test,.chat-card,.message-content>div") ?? root.querySelector(".message-content");
  if (card instanceof HTMLElement) card.classList.add("add2e-arcane-chat-card");
}
const refreshTimers = new Map();
function refreshActorSheetForSpell(item) {
  const actor = item?.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage" || !["sort","spell"].includes(String(item.type).toLowerCase())) return;
  const key = actor.uuid ?? actor.id;
  clearTimeout(refreshTimers.get(key));
  refreshTimers.set(key,setTimeout(() => {
    refreshTimers.delete(key);
    for (const app of Object.values(actor.apps ?? {})) {
      try { app.render?.({force:true}); } catch (_error) { try { app.render?.(true); } catch (_) {} }
    }
  },50));
}

globalThis.ADD2E_SPELL_DIALOG_UI = {version:VERSION,themes:THEMES,shell,primaryButtonClass,ensureStyles,guessTheme,guessIcon,wrapDialogOptions,esc,openPlayerSpellbook};
Hooks.once("ready",()=>{ensureStyles();patchDialogV2();bindPlayerSpellbookOpen();});
Hooks.on("renderDialogV2",styleRenderedDialog);
Hooks.on("renderApplicationV2",(app,html)=>{styleRenderedDialog(app,html);styleEquipmentSpellbooks(app,html);bindBookLearningButtons(app,html);});
Hooks.on("renderChatMessageHTML",styleChatMessage);
Hooks.on("createItem",refreshActorSheetForSpell);
Hooks.on("updateItem",refreshActorSheetForSpell);
Hooks.on("deleteItem",refreshActorSheetForSpell);
ensureStyles();
console.log("[ADD2E][SPELL_DIALOG_UI][VERSION]",VERSION);
