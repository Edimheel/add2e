// ADD2E — UI commune des fenêtres et messages liés aux sorts.
// Compatible Foundry V13/V14/V15 — DialogV2 / ApplicationV2 uniquement.
const VERSION = "2026-07-14-v16-player-external-spellbook";
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
.application.add2e-spellbook-reader-window{width:min(1120px,96vw)!important;height:min(880px,94vh)!important;min-height:560px!important;background:#382316!important;border:2px solid #7a512f!important}
.application.add2e-spellbook-reader-window .window-content{display:flex!important;flex-direction:column!important;min-height:0!important;height:100%!important;padding:10px!important;overflow:hidden!important;background:radial-gradient(ellipse at center,#6b472c 0%,#3b2417 72%,#24140d 100%)!important}
.application.add2e-spellbook-reader-window form,.application.add2e-spellbook-reader-window .dialog-content{display:flex!important;flex:1 1 auto!important;flex-direction:column!important;min-height:0!important;height:100%!important;overflow:hidden!important;background:transparent!important;padding:0!important}
.application.add2e-spellbook-reader-window .dialog-buttons{flex:0 0 auto!important;margin:8px 0 0!important}
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
@media(max-width:720px){.application.add2e-spellbook-reader-window{width:98vw!important;height:94vh!important}.add2e-spellbook-pages{padding:18px 17px 28px}.add2e-spellbook-fields{grid-template-columns:1fr}}
`;
  document.head.append(style);
}
function shell({ theme = "cleric", title = "Sort", subtitle = "", img = "icons/svg/book.svg", body = "" } = {}) {
  ensureStyles(); const t = themeData(theme);
  return `<div class="add2e-spell-dialog-shell" style="--a2e-bg:${t.bg};--a2e-accent:${t.accent};--a2e-dark:${t.dark};--a2e-main:${t.main};--a2e-border:${t.border};--a2e-text:${t.text};"><div class="add2e-spell-dialog-header"><img src="${esc(img)}" alt=""><div><div class="add2e-spell-dialog-title">${esc(title)}</div><div>${esc(subtitle || t.label)}</div></div></div><div class="add2e-spell-dialog-body">${body}</div></div>`;
}
function primaryButtonClass(buttons) { return buttons; }
function isManagedDialog(title, content) { const text = norm(`${title} ${content}`); return text.startsWith("lancement_") || text.includes("livre_de_sorts") || text.includes("grimoire") || text.includes("parchemin") || text.includes("copie_du_sort") || text.includes("connaissance") || text.includes("comprehension"); }
function wrapDialogOptions(options = {}) { const title=String(options?.window?.title??options?.title??""); const content=String(options?.content??""); if(!isManagedDialog(title,content)||content.includes("add2e-spell-dialog-shell")||content.includes("add2e-spellbook-reader")) return options; const theme=guessTheme({title,content,theme:options?.add2eTheme}); const classes=[...(Array.isArray(options?.window?.classes)?options.window.classes:[]),"add2e-spell-dialog-window"]; return {...options,window:{...(options.window??{}),classes:[...new Set(classes)]},content:shell({theme,title:title||"ADD2E",subtitle:themeData(theme).label,img:guessIcon({title,content,img:options?.add2eImg}),body:content})}; }
function patchDialogV2(){ const DialogV2=foundry.applications?.api?.DialogV2; if(!DialogV2||DialogV2.__add2eSpellDialogPatched)return; for(const method of ["wait","confirm","prompt","alert"]){if(typeof DialogV2[method]!=="function")continue; const original=DialogV2[method].bind(DialogV2); DialogV2[method]=(options={},...rest)=>original(wrapDialogOptions(options),...rest);} DialogV2.__add2eSpellDialogPatched=true; }
function rootElement(html,app=null){if(html instanceof HTMLElement)return html;if(html?.[0] instanceof HTMLElement)return html[0];if(app?.element instanceof HTMLElement)return app.element;if(app?.element?.[0] instanceof HTMLElement)return app.element[0];return null;}
function bindSpellbookTabs(root){const reader=root?.querySelector?.(".add2e-spellbook-reader");if(!reader||reader.dataset.bound==="1")return;reader.dataset.bound="1";const activate=level=>{reader.querySelectorAll(".add2e-spellbook-tab").forEach(tab=>tab.classList.toggle("is-active",tab.dataset.level===level));reader.querySelectorAll(".add2e-spellbook-panel").forEach(panel=>panel.classList.toggle("is-active",panel.dataset.level===level));const pages=reader.querySelector(".add2e-spellbook-pages");if(pages)pages.scrollTop=0;};reader.querySelectorAll(".add2e-spellbook-tab").forEach(tab=>tab.addEventListener("click",event=>{event.preventDefault();activate(tab.dataset.level);}));activate(reader.querySelector(".add2e-spellbook-tab")?.dataset?.level??"1");}
function styleRenderedDialog(app,html){const root=rootElement(html,app);if(!root)return;bindSpellbookTabs(root);if(root.querySelector(".add2e-spellbook-reader")){root.classList.add("add2e-spellbook-reader-window");return;}const title=String(app?.title??root.querySelector(".window-title")?.textContent??"");const content=String(root.querySelector(".window-content")?.textContent??root.textContent??"");if(!isManagedDialog(title,content))return;const t=themeData(guessTheme({title,content}));root.classList.add("add2e-spell-dialog-window");for(const[key,value]of Object.entries({"--a2e-bg":t.bg,"--a2e-accent":t.accent,"--a2e-dark":t.dark,"--a2e-main":t.main,"--a2e-border":t.border,"--a2e-text":t.text}))root.style.setProperty(key,value);}
function spellLists(value){try{const lists=globalThis.add2eGetSpellListsFromItem?.(value);if(Array.isArray(lists)&&lists.length)return[...new Set(lists.map(norm).filter(Boolean))];}catch(_error){}const raw=value?.lists??value?.spellLists??value?.classes??value?.classe??value?.class??value?.system?.spellLists??value?.system?.lists??value?.system?.liste??value?.system?.classe??value?.system?.class??[];const values=Array.isArray(raw)?raw:typeof raw==="string"?raw.split(/[,;|\n]+/g):raw&&typeof raw==="object"?Object.values(raw):[];return[...new Set(values.map(norm).filter(Boolean))];}
function spellLevel(value){return Math.max(1,Number(value?.level??value?.niveau??value?.spellLevel??value?.system?.niveau??value?.system?.level??value?.system?.niveau_sort??value?.system?.spellLevel??1)||1);}
function knownActorSpells(actor,book){const ownerList=norm(book?.system?.arcaneDocument?.ownerList??book?.system?.arcaneDocument?.spellList??"");return Array.from(actor?.items??[]).filter(item=>{if(!["sort","spell"].includes(String(item?.type??"").toLowerCase()))return false;if(item?.system?.isPower===true||item?.system?.isObjectPower===true||item?.system?.isCapacity===true)return false;if(item?.flags?.add2e?.spellFamily?.generated===true)return false;const lists=spellLists(item);return!ownerList||!lists.length||lists.includes(ownerList);}).sort((a,b)=>spellLevel(a)-spellLevel(b)||String(a.name).localeCompare(String(b.name),"fr"));}
function actorKnowsBookEntry(actor,entry){const name=norm(entry?.name??entry?.nom??entry?.label);const level=spellLevel(entry);const lists=spellLists(entry);return knownActorSpells(actor,null).some(item=>norm(item.name)===name&&spellLevel(item)===level&&(!lists.length||spellLists(item).some(list=>lists.includes(list))));}
function externalBookAllSpellsKnown(actor,book){const document=book?.system?.arcaneDocument??{};if(String(document.kind??"").toLowerCase()!=="spellbook"||document.personal===true)return false;const entries=Array.isArray(document.spells)?document.spells:document.spell?[document.spell]:[];return entries.length>0&&entries.every(entry=>actorKnowsBookEntry(actor,entry));}
function styleEquipmentSpellbooks(app,html){const actor=app?.actor??(app?.document?.documentName==="Actor"?app.document:null);if(!actor||actor.type!=="personnage")return;const root=rootElement(html,app);for(const button of root?.querySelectorAll?.('[data-add2e-arcane-action="copy-book"][data-item-id]')??[]){const book=actor.items?.get?.(button.dataset.itemId);const complete=externalBookAllSpellsKnown(actor,book);button.classList.toggle("add2e-book-copy-complete",complete);button.classList.toggle("a2e-action-add",!complete);button.title=complete?"Tous les sorts de ce livre sont déjà connus":"Copier les sorts compatibles dans le livre personnel";}}
let canonicalIndexPromise=null;
async function canonicalIndex(){canonicalIndexPromise??=(async()=>{const rows=[];for(const id of["add2e.sorts","world.sorts"]){const pack=game.packs?.get?.(id);if(pack?.documentName!=="Item")continue;let index;try{index=await pack.getIndex({fields:["name","type","system.niveau","system.level","system.spellLists","system.liste","system.classe"]});}catch(_error){index=await pack.getIndex();}const entries=Array.isArray(index?.contents)?index.contents:typeof index?.values==="function"?[...index.values()]:[...(index??[])];for(const entry of entries){if(!["sort","spell"].includes(String(entry?.type??"").toLowerCase()))continue;rows.push({pack,id:entry._id,name:norm(entry.name),level:spellLevel(entry),lists:spellLists(entry)});}}return rows;})();return canonicalIndexPromise;}
async function resolveCanonicalSpell(spell){const sourceUuid=String(spell?.sourceUuid??spell?.uuid??spell?.flags?.core?.sourceId??spell?._stats?.compendiumSource??spell?.flags?.add2e?.sourceUuid??"").trim();if(sourceUuid&&typeof fromUuid==="function"){try{const document=await fromUuid(sourceUuid);if(document?.documentName==="Item")return document;}catch(_error){}}const name=norm(spell?.name??spell?.nom??spell?.label);const level=spellLevel(spell);const lists=spellLists(spell);const matches=(await canonicalIndex()).filter(row=>row.name===name&&row.level===level);const selected=matches.find(row=>!lists.length||row.lists.some(list=>lists.includes(list)))??matches[0]??null;return selected?selected.pack.getDocument(selected.id):spell;}
function formatSpellField(value){if(value===undefined||value===null||value==="")return"—";if(Array.isArray(value))return value.map(formatSpellField).filter(v=>v!=="—").join(", ")||"—";if(typeof value==="object"){const direct=value.raw??value.texte??value.text??value.label??value.nom??value.name;if(direct!==undefined)return formatSpellField(direct);const amount=value.valeur??value.value??value.nombre??value.number;const unit=value.unite??value.unit;if(amount!==undefined)return`${amount}${unit?` ${unit}`:""}`;return Object.values(value).map(formatSpellField).filter(v=>v!=="—").join(", ")||"—";}return String(value).trim()||"—";}
async function enrichSpellDescription(spell){const raw=String(spell?.system?.description_reelle??spell?.system?.description??spell?.system?.texte??spell?.system?.text??"").trim();if(!raw)return"<em>Aucune description dans la source canonique.</em>";const editor=foundry?.applications?.ux?.TextEditor?.implementation??globalThis.TextEditor;try{return editor?.enrichHTML?await editor.enrichHTML(raw,{async:true,relativeTo:spell}):esc(raw);}catch(_error){return esc(raw);}}
function bookEntries(book){const document=book?.system?.arcaneDocument??{};const raw=Array.isArray(document.spells)?document.spells:document.spell?[document.spell]:[];return raw.filter(Boolean).map(entry=>({...entry,name:entry.name??entry.nom??entry.label??"Sort",level:spellLevel(entry),lists:spellLists(entry),img:entry.img??entry.image??book?.img}));}
async function openPlayerSpellbook(actor,book){
  const document=book?.system?.arcaneDocument??{};
  const sourceRows=document.personal===true?knownActorSpells(actor,book):bookEntries(book);
  if(!sourceRows.length)return ui.notifications.info(`${book.name} ne contient aucun sort.`);
  const detailed=[];
  for(const embedded of sourceRows){const canonical=await resolveCanonicalSpell(embedded);detailed.push({embedded,spell:canonical??embedded,level:spellLevel(canonical??embedded)});}
  const levels=[...new Set(detailed.map(row=>row.level))].sort((a,b)=>a-b);
  const tabs=levels.map(level=>`<button type="button" class="add2e-spellbook-tab" data-level="${level}">Niveau ${level}</button>`).join("");
  const panels=[];
  for(const level of levels){const cards=[];for(const row of detailed.filter(row=>row.level===level)){const spell=row.spell;const system=spell?.system??{};const description=await enrichSpellDescription(spell);const lists=spellLists(row.embedded);const listLabel=lists.map(list=>list==="magicien"?"Magicien":list==="illusionniste"?"Illusionniste":list).join(" / ")||"Liste inconnue";const fields=[["École",system.ecole??system["école"]??system.school],["Portée",system.portee??system["portée"]??system.range],["Durée",system.duree??system["durée"]??system.duration],["Temps d’incantation",system.temps_incantation??system.tempsIncantation??system.castingTime],["Composantes",system.composantes??system.components],["Composants matériels",system.composants_materiels??system.materialComponents],["Zone d’effet",system.zone_effet??system.zoneEffet??system.areaOfEffect],["Cible",system.cible??system.target],["Jet de sauvegarde",system.jet_sauvegarde??system.jetSauvegarde??system.savingThrow]].map(([label,value])=>`<div class="add2e-spellbook-field"><b>${label}</b><span>${esc(formatSpellField(value))}</span></div>`).join("");cards.push(`<article class="add2e-spellbook-entry"><div class="add2e-spellbook-entry-head"><img src="${esc(spell?.img??row.embedded?.img??book.img??"icons/svg/book.svg")}" alt=""><h3>${esc(spell?.name??row.embedded?.name??"Sort")}</h3><span class="add2e-spellbook-entry-list">${esc(listLabel)}</span></div><div class="add2e-spellbook-fields">${fields}</div><div class="add2e-spellbook-description"><strong>Description</strong>${description}</div></article>`);}panels.push(`<section class="add2e-spellbook-panel" data-level="${level}"><h2 class="add2e-spellbook-level-title">Sorts de niveau ${level}</h2>${cards.join("")}</section>`);}
  const Reader=globalThis.Add2eSpellbookReaderApplication;
  if(typeof Reader!=="function")return ui.notifications.error("Le lecteur ApplicationV2 du livre de sorts est introuvable.");
  const application=new Reader({content:`<div class="add2e-spellbook-reader"><nav class="add2e-spellbook-tabs">${tabs}</nav><div class="add2e-spellbook-pages">${panels.join("")}</div></div>`,window:{title:`${book.name} — ${actor.name}`,resizable:true},position:{width:1120,height:880}});
  application.render({force:true});
  return application;
}
function actorFromSpellbookButton(button){const actorId=String(button?.dataset?.actorId??"").trim();if(actorId){const actor=game.actors?.get?.(actorId);if(actor)return actor;}const owner=button?.closest?.(".application,.window-app");for(const app of Object.values(ui.windows??{})){const root=app?.element?.jquery?app.element[0]:app?.element;if(root===owner||root?.contains?.(button))return app?.actor??app?.document??null;}return null;}
function bindPlayerSpellbookOpen(){if(globalThis.__ADD2E_PLAYER_SPELLBOOK_READER_BOUND_V16__)return;globalThis.__ADD2E_PLAYER_SPELLBOOK_READER_BOUND_V16__=true;document.addEventListener("click",event=>{const button=event.target instanceof Element?event.target.closest('[data-add2e-arcane-action="view-book"][data-item-id]'):null;if(!button||game.user?.isGM)return;const actor=actorFromSpellbookButton(button);const book=actor?.items?.get?.(String(button.dataset.itemId??""))??null;const document=book?.system?.arcaneDocument??{};if(String(document.kind??"").toLowerCase()!=="spellbook")return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();if(!actor||!book)return ui.notifications.error("Impossible de retrouver le personnage ou son livre de sorts.");void openPlayerSpellbook(actor,book).catch(error=>{console.error("[ADD2E][SPELLBOOK_READER][ERROR]",{actor:actor.name,book:book.name,error});ui.notifications.error(error?.message||"Impossible d’ouvrir le livre de sorts.");});},true);}
function styleChatMessage(message,html){const root=rootElement(html);if(!root)return;const text=norm(String(message?.content??root.textContent??""));if(!text.includes("connaissance")&&!text.includes("comprehension")&&!text.includes("copie_du_sort")&&!text.includes("livre_de_sorts")&&!text.includes("parchemin"))return;const card=root.querySelector(".add2e-card-test,.chat-card,.message-content>div")??root.querySelector(".message-content");if(card instanceof HTMLElement)card.classList.add("add2e-arcane-chat-card");}
const refreshTimers=new Map();function refreshActorSheetForSpell(item){const actor=item?.parent;if(!actor||actor.documentName!=="Actor"||actor.type!=="personnage"||!["sort","spell"].includes(String(item.type).toLowerCase()))return;const key=actor.uuid??actor.id;clearTimeout(refreshTimers.get(key));refreshTimers.set(key,setTimeout(()=>{refreshTimers.delete(key);for(const app of Object.values(actor.apps??{})){try{app.render?.({force:true});}catch(_error){try{app.render?.(true);}catch(_){}}}},50));}
globalThis.ADD2E_SPELL_DIALOG_UI={version:VERSION,themes:THEMES,shell,primaryButtonClass,ensureStyles,guessTheme,guessIcon,wrapDialogOptions,esc,openPlayerSpellbook};
Hooks.once("ready",()=>{ensureStyles();patchDialogV2();bindPlayerSpellbookOpen();});
Hooks.on("renderDialogV2",styleRenderedDialog);
Hooks.on("renderApplicationV2",(app,html)=>{styleRenderedDialog(app,html);styleEquipmentSpellbooks(app,html);});
Hooks.on("renderChatMessageHTML",styleChatMessage);
Hooks.on("createItem",refreshActorSheetForSpell);Hooks.on("updateItem",refreshActorSheetForSpell);Hooks.on("deleteItem",refreshActorSheetForSpell);
ensureStyles();console.log("[ADD2E][SPELL_DIALOG_UI][VERSION]",VERSION);
