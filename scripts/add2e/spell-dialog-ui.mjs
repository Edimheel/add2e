// ADD2E — UI commune des fenêtres et messages liés aux sorts.
// Compatible Foundry V13/V14/V15 — DialogV2 / ApplicationV2 uniquement.
const VERSION = "2026-07-14-v14-spellbook-scroll-parchment";
globalThis.ADD2E_SPELL_DIALOG_UI_VERSION = VERSION;

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

const THEMES = {
  cleric: { label: "Clerc", bg: "#fffaf0", accent: "#f3e6c8", dark: "#6f4b12", main: "#b88924", border: "#c99a36", text: "#2d2011", labelColor: "#6f4b12" },
  druid: { label: "Druide", bg: "#f4faef", accent: "#dfeccd", dark: "#264a23", main: "#719c4a", border: "#7fa45d", text: "#202d1a", labelColor: "#355428" },
  wizard: { label: "Magicien", bg: "#f8f3ff", accent: "#e8ddfb", dark: "#2e1c5a", main: "#6b49b8", border: "#8060cc", text: "#211735", labelColor: "#4b3684" },
  illusionist: { label: "Illusionniste", bg: "#f9f7ff", accent: "#dff2ff", dark: "#275a8a", main: "#925ac6", border: "#70a9d6", text: "#1e3043", labelColor: "#315d83" },
  thief: { label: "Voleur", bg: "#eff9fa", accent: "#cce9ed", dark: "#164a58", main: "#2a8293", border: "#3b9daf", text: "#14333b", labelColor: "#1b6372" }
};

function themeData(theme) { return THEMES[theme] ?? THEMES.cleric; }

function guessTheme({ title = "", content = "", theme = null } = {}) {
  if (theme && THEMES[theme]) return theme;
  const text = norm(`${title} ${content}`);
  if (text.includes("voleur") || text.includes("assassin") || text.includes("thief")) return "thief";
  if (text.includes("illusionniste") || text.includes("illusionist")) return "illusionist";
  if (text.includes("magicien") || text.includes("wizard") || text.includes("livre_de_sorts") || text.includes("parchemin") || text.includes("connaissance") || text.includes("comprehension")) return "wizard";
  if (text.includes("druide") || text.includes("druid")) return "druid";
  return "cleric";
}

function guessIcon({ title = "", content = "", img = null } = {}) {
  if (img) return img;
  const text = norm(`${title} ${content}`);
  return text.includes("voleur") || text.includes("assassin") ? "icons/svg/eye.svg" : "icons/svg/book.svg";
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
.application.add2e-spell-dialog-window{border:2px solid var(--a2e-border)!important;border-radius:16px!important;overflow:hidden!important;box-shadow:0 10px 26px rgba(0,0,0,.22)!important;background:linear-gradient(180deg,var(--a2e-bg),var(--a2e-accent))!important;color:var(--a2e-text)!important}
.application.add2e-spell-dialog-window .window-header{background:linear-gradient(90deg,var(--a2e-dark),var(--a2e-main))!important;color:#fff!important;border:0!important;border-bottom:2px solid var(--a2e-border)!important}
.application.add2e-spell-dialog-window .window-content{background:linear-gradient(180deg,var(--a2e-bg),var(--a2e-accent))!important;color:var(--a2e-text)!important;border:0!important;padding:12px!important}
.application.add2e-spell-dialog-window .dialog-content,.application.add2e-spell-dialog-window .add2e-dialog,.application.add2e-spell-dialog-window form{background:transparent!important;color:var(--a2e-text)!important;border:0!important;box-shadow:none!important}
.application.add2e-spell-dialog-window .dialog-buttons{background:transparent!important;border:0!important;padding-top:10px!important;gap:8px!important}
.application.add2e-spell-dialog-window .dialog-buttons button{border:1px solid var(--a2e-border)!important;border-radius:9px!important;background:#fff!important;color:var(--a2e-dark)!important;font-weight:800!important;box-shadow:none!important}
.add2e-spell-dialog-shell{border:2px solid var(--a2e-border);border-radius:14px;overflow:hidden;background:linear-gradient(180deg,var(--a2e-bg),var(--a2e-accent));color:var(--a2e-text)}
.add2e-spell-dialog-header{display:flex;align-items:center;gap:10px;padding:10px 12px;background:linear-gradient(90deg,var(--a2e-dark),var(--a2e-main));color:#fff;border-bottom:2px solid var(--a2e-border)}
.add2e-spell-dialog-header img{width:42px;height:42px;border-radius:8px;background:#fff;object-fit:cover;border:2px solid rgba(255,255,255,.9)}
.add2e-spell-dialog-title{font-size:1.08rem;font-weight:800}.add2e-spell-dialog-subtitle{font-size:.84rem;opacity:.95}.add2e-spell-dialog-body{padding:12px}
.chat-message .add2e-arcane-chat-card{padding:0!important;border:2px solid #8060cc!important;border-radius:10px!important;background:linear-gradient(180deg,#f8f3ff,#e8ddfb)!important;color:#211735!important;overflow:hidden!important}
.chat-message .add2e-arcane-chat-header{display:flex!important;align-items:center!important;gap:9px!important;padding:8px 10px!important;background:linear-gradient(90deg,#2e1c5a,#6b49b8)!important;color:#fff!important}
.chat-message .add2e-arcane-chat-header img{width:44px!important;height:44px!important;min-width:44px!important;max-width:44px!important;object-fit:cover!important;border:1px solid rgba(255,255,255,.85)!important;border-radius:7px!important;background:#fff!important}
.chat-message .add2e-arcane-chat-header h1,.chat-message .add2e-arcane-chat-header h2,.chat-message .add2e-arcane-chat-header h3{margin:0!important;color:#fff!important;font-size:1.05rem!important;border:0!important}
.chat-message .add2e-arcane-chat-body{padding:10px 11px!important}
.add2e-book-copy-complete{color:#6b7280!important;background:#e5e7eb!important;border-color:#9ca3af!important;box-shadow:none!important}
.application.add2e-spellbook-reader-window{width:min(1120px,96vw)!important;height:min(880px,94vh)!important;min-height:560px!important;background:#382316!important;border:2px solid #7a512f!important;box-shadow:0 18px 46px rgba(0,0,0,.45)!important}
.application.add2e-spellbook-reader-window .window-header{flex:0 0 auto;background:linear-gradient(180deg,#704725,#3d2415)!important;color:#f7e8c6!important;border-bottom:1px solid #9e7548!important}
.application.add2e-spellbook-reader-window .window-content{display:flex!important;flex-direction:column!important;min-height:0!important;height:100%!important;padding:10px!important;overflow:hidden!important;background:radial-gradient(ellipse at center,#6b472c 0%,#3b2417 72%,#24140d 100%)!important}
.application.add2e-spellbook-reader-window form,.application.add2e-spellbook-reader-window .dialog-content{display:flex!important;flex:1 1 auto!important;flex-direction:column!important;min-height:0!important;height:100%!important;overflow:hidden!important;background:transparent!important;padding:0!important}
.application.add2e-spellbook-reader-window .dialog-buttons{flex:0 0 auto!important;margin:8px 0 0!important;padding:0!important;background:transparent!important}
.application.add2e-spellbook-reader-window .dialog-buttons button{background:linear-gradient(180deg,#8b5c32,#4b2d1a)!important;border:1px solid #b58a59!important;color:#fff3d2!important}
.add2e-spellbook-reader{display:flex;flex:1 1 auto;flex-direction:column;min-height:0;height:100%;overflow:hidden;color:#352414}
.add2e-spellbook-tabs{display:flex;flex:0 0 auto;flex-wrap:wrap;justify-content:center;gap:5px;padding:4px 14px 0}
.add2e-spellbook-tab{border:1px solid #78532d;border-bottom:0;border-radius:9px 9px 0 0;padding:7px 14px;background:linear-gradient(180deg,#d1ad74,#9f7542);color:#321f10;font-weight:800;cursor:pointer;box-shadow:inset 0 1px rgba(255,255,255,.45)}
.add2e-spellbook-tab:hover{background:linear-gradient(180deg,#e1c492,#ad814b)}
.add2e-spellbook-tab.is-active{background:linear-gradient(180deg,#fff2d2,#e6c991);color:#4a2d14;transform:translateY(1px)}
.add2e-spellbook-pages{position:relative;display:block;flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;scrollbar-gutter:stable;padding:28px 42px 40px;background-color:#ead5a7;background-image:radial-gradient(circle at 14% 18%,rgba(126,82,36,.12) 0 1px,transparent 2px),radial-gradient(circle at 78% 62%,rgba(108,68,27,.10) 0 1px,transparent 2px),radial-gradient(ellipse at 23% 10%,rgba(255,255,255,.48),transparent 42%),radial-gradient(ellipse at 77% 14%,rgba(255,255,255,.38),transparent 40%),linear-gradient(90deg,#b98c50 0,#dfc18a 2.2%,#f5e4ba 6%,#f9edce 46.5%,#c5a069 49.2%,#76502f 50%,#c5a069 50.8%,#f9edce 53.5%,#f5e4ba 94%,#dfc18a 97.8%,#b98c50 100%);background-size:46px 46px,59px 59px,100% 100%,100% 100%,100% 100%;border:3px solid #7c552f;border-radius:15px 15px 10px 10px;box-shadow:inset 16px 0 20px rgba(78,45,18,.16),inset -16px 0 20px rgba(78,45,18,.16),inset 0 0 35px rgba(92,58,22,.22),0 9px 18px rgba(0,0,0,.35)}
.add2e-spellbook-pages:before{content:"";position:sticky;display:block;top:0;left:50%;width:12px;height:100%;margin:0 auto -100%;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(65,36,16,.26),rgba(255,239,197,.35),rgba(65,36,16,.26),transparent);filter:blur(1px);z-index:0}
.add2e-spellbook-panel{position:relative;z-index:1;display:none;min-height:min-content;padding-bottom:18px}.add2e-spellbook-panel.is-active{display:block}
.add2e-spellbook-level-title{text-align:center;margin:0 0 18px;color:#573719;font-family:Georgia,"Times New Roman",serif;font-size:1.5rem;text-shadow:0 1px rgba(255,255,255,.55);border-bottom:1px solid rgba(90,55,25,.38);padding-bottom:8px}
.add2e-spellbook-entry{margin:0 0 18px;padding:14px 16px;background:linear-gradient(135deg,rgba(255,251,234,.82),rgba(241,219,174,.66));border:1px solid rgba(112,77,39,.48);border-radius:10px;box-shadow:0 2px 5px rgba(80,48,20,.12),inset 0 1px rgba(255,255,255,.55)}
.add2e-spellbook-entry-head{display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(112,77,39,.32);padding-bottom:8px;margin-bottom:10px}
.add2e-spellbook-entry-head img{width:44px;height:44px;object-fit:cover;border:1px solid #73522d;border-radius:6px;box-shadow:0 2px 4px rgba(0,0,0,.18)}
.add2e-spellbook-entry-head h3{margin:0;color:#472b12;font-family:Georgia,"Times New Roman",serif;font-size:1.24rem}
.add2e-spellbook-entry-list{margin-left:auto;font-size:.84rem;font-weight:700;color:#75552b}
.add2e-spellbook-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 18px;font-size:.9rem}
.add2e-spellbook-field{display:grid;grid-template-columns:minmax(112px,auto) 1fr;gap:7px}.add2e-spellbook-field b{color:#58371a}
.add2e-spellbook-description{margin-top:11px;padding-top:10px;border-top:1px dashed rgba(112,77,39,.44);line-height:1.48}
@media(max-width:720px){.application.add2e-spellbook-reader-window{width:98vw!important;height:94vh!important}.add2e-spellbook-pages{padding:18px 17px 28px}.add2e-spellbook-fields{grid-template-columns:1fr}.add2e-spellbook-pages:before{display:none}}
`;
  document.head.append(style);
}

function shell({ theme = "cleric", title = "Sort", subtitle = "", img = "icons/svg/book.svg", body = "" } = {}) {
  ensureStyles();
  const t = themeData(theme);
  return `<div class="add2e-spell-dialog-shell" style="--a2e-bg:${t.bg};--a2e-accent:${t.accent};--a2e-dark:${t.dark};--a2e-main:${t.main};--a2e-border:${t.border};--a2e-text:${t.text};"><div class="add2e-spell-dialog-header"><img src="${esc(img)}" alt=""><div><div class="add2e-spell-dialog-title">${esc(title)}</div><div class="add2e-spell-dialog-subtitle">${esc(subtitle || t.label)}</div></div></div><div class="add2e-spell-dialog-body">${body}</div></div>`;
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
  return { ...options, window: { ...(options.window ?? {}), classes: [...new Set(classes)] }, content: shell({ theme, title: title || "ADD2E", subtitle: themeData(theme).label, img: guessIcon({ title, content, img: options?.add2eImg }), body: content }) };
}

function patchDialogV2() {
  const DialogV2 = foundry.applications?.api?.DialogV2;
  if (!DialogV2 || DialogV2.__add2eSpellDialogPatched) return;
  for (const method of ["wait", "confirm", "prompt", "alert"]) {
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
  for (const [key, value] of Object.entries({ "--a2e-bg": t.bg, "--a2e-accent": t.accent, "--a2e-dark": t.dark, "--a2e-main": t.main, "--a2e-border": t.border, "--a2e-text": t.text })) root.style.setProperty(key, value);
}

function spellLists(value) {
  const raw = value?.lists ?? value?.spellLists ?? value?.classes ?? value?.classe ?? value?.class ?? value?.system?.spellLists ?? value?.system?.lists ?? value?.system?.liste ?? value?.system?.classe ?? value?.system?.class ?? [];
  const values = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,;|\n]+/g) : raw && typeof raw === "object" ? Object.values(raw) : [];
  return [...new Set(values.map(norm).filter(Boolean))];
}

function spellLevel(value) { return Math.max(1, Number(value?.level ?? value?.niveau ?? value?.spellLevel ?? value?.system?.niveau ?? value?.system?.level ?? value?.system?.niveau_sort ?? 1) || 1); }

function actorKnowsBookEntry(actor, entry) {
  const name = norm(entry?.name ?? entry?.nom ?? entry?.label);
  const level = spellLevel(entry);
  const lists = spellLists(entry);
  return !!name && Array.from(actor?.items ?? []).some(item => {
    if (!["sort", "spell"].includes(String(item?.type ?? "").toLowerCase())) return false;
    if (item?.flags?.add2e?.spellFamily?.generated === true) return false;
    if (norm(item?.name ?? item?.system?.nom) !== name || spellLevel(item) !== level) return false;
    const knownLists = spellLists(item);
    return !lists.length || !knownLists.length || knownLists.some(list => lists.includes(list));
  });
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

function bookEntries(book) {
  try {
    const entries = globalThis.ADD2E_ARCANE_DOCUMENTS?.documentEntries?.(book);
    if (Array.isArray(entries)) return entries;
  } catch (_error) {}
  const document = book?.system?.arcaneDocument ?? {};
  return Array.isArray(document.spells) ? document.spells : document.spell ? [document.spell] : [];
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
  const raw = String(spell?.system?.description ?? spell?.system?.description_reelle ?? "").trim();
  if (!raw) return "<em>Aucune description.</em>";
  const editor = foundry?.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
  try { return editor?.enrichHTML ? await editor.enrichHTML(raw, { async: true, relativeTo: spell }) : esc(raw); }
  catch (_error) { return esc(raw); }
}

async function resolveBookSpell(actor, entry) {
  const name = norm(entry?.name ?? entry?.nom ?? entry?.label);
  const level = spellLevel(entry);
  const lists = spellLists(entry);
  let spell = Array.from(actor?.items ?? []).find(item => String(item?.type ?? "").toLowerCase() === "sort" && item?.flags?.add2e?.spellFamily?.generated !== true && norm(item?.name ?? item?.system?.nom) === name && spellLevel(item) === level && (!lists.length || spellLists(item).some(list => lists.includes(list)))) ?? null;
  if (!spell && entry?.sourceUuid && typeof fromUuid === "function") {
    try { spell = await fromUuid(entry.sourceUuid); } catch (_error) {}
  }
  return spell;
}

async function openPlayerSpellbook(actor, book) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) return ui.notifications.error("DialogV2 est introuvable.");
  const entries = bookEntries(book);
  if (!entries.length) return ui.notifications.info(`${book.name} ne contient aucun sort.`);
  const detailed = [];
  for (const entry of entries) detailed.push({ entry, spell: await resolveBookSpell(actor, entry), level: spellLevel(entry) });
  const levels = [...new Set(detailed.map(row => row.level))].sort((a, b) => a - b);
  const tabs = levels.map(level => `<button type="button" class="add2e-spellbook-tab" data-level="${level}">Niveau ${level}</button>`).join("");
  const panels = [];
  for (const level of levels) {
    const cards = [];
    for (const row of detailed.filter(row => row.level === level)) {
      const spell = row.spell;
      const system = spell?.system ?? row.entry?.system ?? row.entry ?? {};
      const description = spell ? await enrichSpellDescription(spell) : `<em>Description complète indisponible pour ${esc(row.entry?.name ?? "ce sort")}.</em>`;
      const listLabel = row.entry?.listLabel || spellLists(row.entry).map(list => list === "magicien" ? "Magicien" : list === "illusionniste" ? "Illusionniste" : list).join(" / ") || "Liste inconnue";
      const fields = [
        ["École", system.ecole ?? system["école"] ?? system.school],
        ["Portée", system.portee ?? system["portée"] ?? system.range],
        ["Durée", system.duree ?? system["durée"] ?? system.duration],
        ["Temps d’incantation", system.temps_incantation ?? system.tempsIncantation ?? system.castingTime],
        ["Composantes", system.composantes ?? system.components],
        ["Composants matériels", system.composants_materiels ?? system.materialComponents],
        ["Zone d’effet", system.zone_effet ?? system.zoneEffet ?? system.areaOfEffect],
        ["Cible", system.cible ?? system.target],
        ["Jet de sauvegarde", system.jet_sauvegarde ?? system.jetSauvegarde ?? system.savingThrow]
      ].map(([label, value]) => `<div class="add2e-spellbook-field"><b>${label}</b><span>${esc(formatSpellField(value))}</span></div>`).join("");
      cards.push(`<article class="add2e-spellbook-entry"><div class="add2e-spellbook-entry-head"><img src="${esc(spell?.img ?? row.entry?.img ?? book.img ?? "icons/svg/book.svg")}" alt=""><h3>${esc(spell?.name ?? row.entry?.name ?? "Sort")}</h3><span class="add2e-spellbook-entry-list">${esc(listLabel)}</span></div><div class="add2e-spellbook-fields">${fields}</div><div class="add2e-spellbook-description"><strong>Description</strong>${description}</div></article>`);
    }
    panels.push(`<section class="add2e-spellbook-panel" data-level="${level}"><h2 class="add2e-spellbook-level-title">Sorts de niveau ${level}</h2>${cards.join("")}</section>`);
  }
  return DialogV2.wait({ window: { title: `${book.name} — ${actor.name}`, classes: ["add2e-spellbook-reader-window"], resizable: true }, position: { width: 1120, height: 880 }, modal: false, rejectClose: false, content: `<div class="add2e-spellbook-reader"><nav class="add2e-spellbook-tabs">${tabs}</nav><div class="add2e-spellbook-pages">${panels.join("")}</div></div>`, buttons: [{ action: "close", label: "Fermer", icon: "fa-solid fa-book", default: true, callback: () => true }] });
}

function actorFromSpellbookButton(button) {
  const actorId = String(button?.dataset?.actorId ?? "").trim();
  if (actorId) {
    const worldActor = game.actors?.get?.(actorId) ?? null;
    if (worldActor) return worldActor;
  }
  const actorUuid = String(button?.dataset?.actorUuid ?? "").trim();
  if (actorUuid && typeof fromUuidSync === "function") {
    try { const actor = fromUuidSync(actorUuid); if (actor?.documentName === "Actor") return actor; } catch (_error) {}
  }
  const owner = button?.closest?.(".application, .window-app");
  for (const app of Object.values(ui.windows ?? {})) {
    const root = app?.element?.jquery ? app.element[0] : app?.element;
    if (root === owner || root?.contains?.(button)) {
      const actor = app?.actor ?? (app?.document?.documentName === "Actor" ? app.document : null);
      if (actor) return actor;
    }
  }
  return null;
}

function bindPlayerSpellbookOpen() {
  if (globalThis.__ADD2E_PLAYER_SPELLBOOK_READER_BOUND_V14__) return;
  globalThis.__ADD2E_PLAYER_SPELLBOOK_READER_BOUND_V14__ = true;
  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest?.('[data-add2e-arcane-action="view-book"][data-item-id]');
    if (!button) return;

    const actor = actorFromSpellbookButton(button);
    const book = actor?.items?.get?.(String(button.dataset.itemId ?? "")) ?? null;
    const document = book?.system?.arcaneDocument ?? {};
    const linkedPersonalBook = String(document.kind ?? "").toLowerCase() === "spellbook" && document.personal === true;

    // Le MJ conserve strictement la fenêtre historique. Les livres non liés aussi.
    if (game.user?.isGM || !linkedPersonalBook) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (!actor || !book) {
      console.error("[ADD2E][SPELLBOOK_READER][MISSING_CONTEXT]", { actorId: button.dataset.actorId, itemId: button.dataset.itemId, actor, book });
      ui.notifications.error("Impossible de retrouver le personnage ou son livre de sorts.");
      return;
    }

    void openPlayerSpellbook(actor, book).catch(error => {
      console.error("[ADD2E][SPELLBOOK_READER][ERROR]", { actor: actor.name, book: book.name, error });
      ui.notifications.error(error?.message || "Impossible d’ouvrir le livre de sorts.");
    });
  }, true);
}

function styleChatMessage(message, html) {
  const root = rootElement(html);
  if (!root) return;
  const text = norm(String(message?.content ?? root.textContent ?? ""));
  if (!text.includes("connaissance") && !text.includes("comprehension") && !text.includes("copie_du_sort") && !text.includes("livre_de_sorts") && !text.includes("parchemin")) return;
  const card = root.querySelector(".add2e-card-test,.chat-card,.message-content>div") ?? root.querySelector(".message-content");
  if (!(card instanceof HTMLElement)) return;
  card.classList.add("add2e-arcane-chat-card");
  let header = card.querySelector(":scope > .add2e-arcane-chat-header");
  if (!header) {
    const title = card.querySelector(":scope > h1,:scope > h2,:scope > h3") ?? card.querySelector("h1,h2,h3");
    const image = card.querySelector(":scope > img") ?? card.querySelector("img");
    if (title || image) {
      header = document.createElement("div");
      header.className = "add2e-arcane-chat-header";
      card.insertBefore(header, card.firstChild);
      if (image) header.append(image);
      if (title) header.append(title);
    }
  }
  if (!card.querySelector(":scope > .add2e-arcane-chat-body")) {
    const body = document.createElement("div");
    body.className = "add2e-arcane-chat-body";
    for (const child of [...card.children]) if (child !== header) body.append(child);
    card.append(body);
  }
}

const refreshTimers = new Map();
function refreshActorSheetForSpell(item) {
  const actor = item?.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage" || !["sort", "spell"].includes(String(item.type).toLowerCase())) return;
  const key = actor.uuid ?? actor.id;
  clearTimeout(refreshTimers.get(key));
  refreshTimers.set(key, setTimeout(() => {
    refreshTimers.delete(key);
    const apps = new Set([...Object.values(actor.apps ?? {}), ...Object.values(ui.windows ?? {}).filter(app => (app?.actor ?? app?.document ?? app?.object)?.id === actor.id)]);
    for (const app of apps) {
      try { app._add2eRememberActiveTab?.(app.element, app._add2eActiveTab || app._add2eReadStoredTab?.() || "sorts"); app.render?.({ force: true }); }
      catch (_error) { try { app.render?.(true); } catch (error) { console.warn("[ADD2E][SPELL_DIALOG_UI][REFRESH_ERROR]", error); } }
    }
  }, 50));
}

globalThis.ADD2E_SPELL_DIALOG_UI = { version: VERSION, themes: THEMES, shell, primaryButtonClass, ensureStyles, guessTheme, guessIcon, wrapDialogOptions, esc, openPlayerSpellbook };
Hooks.once("ready", () => { ensureStyles(); patchDialogV2(); bindPlayerSpellbookOpen(); });
Hooks.on("renderDialogV2", styleRenderedDialog);
Hooks.on("renderApplicationV2", (app, html) => { styleRenderedDialog(app, html); styleEquipmentSpellbooks(app, html); });
Hooks.on("renderChatMessageHTML", styleChatMessage);
Hooks.on("createItem", refreshActorSheetForSpell);
Hooks.on("updateItem", refreshActorSheetForSpell);
Hooks.on("deleteItem", refreshActorSheetForSpell);
ensureStyles();
console.log("[ADD2E][SPELL_DIALOG_UI][VERSION]", VERSION);
