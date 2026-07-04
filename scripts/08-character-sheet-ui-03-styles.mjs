// ============================================================
// ADD2E — 08 Character Sheet UI — 03 styles
// Styles globaux pour la feuille ApplicationV2 et le HUD compact.
// ============================================================

const ADD2E_CAPABILITIES_STYLE_ID = "add2e-capabilities-global-style";
const ADD2E_HUD_CAPABILITIES_TABS_FLAG = "__ADD2E_HUD_CAPABILITIES_TABS_V4";
const ADD2E_THIEF_DIALOG_FLAG = "__ADD2E_THIEF_DIALOG_STYLE_V3";
let add2eHudCapabilitiesTab = "classe";
let add2eHudCapabilitiesObserver = null;
let add2eThiefDialogObserver = null;

function add2eHudFeatureName(feature) {
  return String(feature?._add2eHudLabel ?? feature?.name ?? feature?.label ?? feature?.title ?? feature?.nom ?? "Capacité").trim();
}

function hudRoot() {
  return document.getElementById("add2e-action-hud");
}

function hudCapabilitiesSection() {
  return hudRoot()?.querySelector?.('section[data-section="capacites"]') ?? null;
}

function setHudCapabilitiesTab(section, value) {
  const racialPanel = section?.querySelector?.(':scope > .a2e-hud-racial-capabilities');
  const hasRacial = Boolean(racialPanel?.querySelector?.('.a2e-hud-racial-row'));
  const next = value === "racial" && hasRacial ? "racial" : "classe";
  add2eHudCapabilitiesTab = next;
  if (!section) return;

  section.dataset.add2eCapabilityTab = next;
  for (const button of section.querySelectorAll(':scope > .a2e-hud-capability-subtabs [data-add2e-capability-tab]')) {
    const active = button.dataset.add2eCapabilityTab === next;
    button.classList.toggle("active", active);
    button.disabled = button.dataset.add2eCapabilityTab === "racial" && !hasRacial;
  }
}

function decorateHudClassFeatureControls(section) {
  for (const button of section?.querySelectorAll?.('button.act[data-action="use-feature"]') ?? []) {
    const row = button.closest?.(".row.compact");
    if (!row) continue;
    if (row.firstElementChild !== button) row.prepend(button);
    if (button.dataset.add2eIconControl !== "true") {
      button.dataset.add2eIconControl = "true";
      button.setAttribute("aria-label", button.title || "Utiliser la capacité");
      button.innerHTML = '<i class="fas fa-bolt" aria-hidden="true"></i>';
    }
  }
}

function setupHudCapabilitiesTabs() {
  const section = hudCapabilitiesSection();
  if (!section) return;

  let tabs = section.querySelector(':scope > .a2e-hud-capability-subtabs');
  if (!tabs) {
    tabs = document.createElement("div");
    tabs.className = "a2e-hud-capability-subtabs";
    tabs.innerHTML = '<button type="button" data-add2e-capability-tab="classe">Classe</button><button type="button" data-add2e-capability-tab="racial">Racial</button>';
  }
  if (section.firstElementChild !== tabs) section.prepend(tabs);

  const racialPanel = section.querySelector(':scope > .a2e-hud-racial-capabilities');
  for (const child of Array.from(section.children)) {
    if (child === tabs || child === racialPanel) continue;
    child.dataset.add2eCapabilityGroup = "classe";
  }
  if (racialPanel) racialPanel.dataset.add2eCapabilityGroup = "racial";

  decorateHudClassFeatureControls(section);
  setHudCapabilitiesTab(section, add2eHudCapabilitiesTab);
}

function scheduleHudCapabilitiesTabs() {
  const raf = globalThis.requestAnimationFrame ?? (callback => window.setTimeout(callback, 16));
  raf(setupHudCapabilitiesTabs);
}

function restoreHudCapabilitiesTab() {
  const root = hudRoot();
  if (!root) return;
  const nav = root.querySelector?.('.a2e-hud-tab[data-tab="capacites"]');
  if (nav && !nav.classList.contains("active")) nav.click();
  const section = hudCapabilitiesSection();
  if (section) setHudCapabilitiesTab(section, add2eHudCapabilitiesTab);
}

function installHudCapabilitiesTabs() {
  if (globalThis[ADD2E_HUD_CAPABILITIES_TABS_FLAG]) return;
  globalThis[ADD2E_HUD_CAPABILITIES_TABS_FLAG] = true;
  globalThis.add2eFeatureName ??= add2eHudFeatureName;

  document.addEventListener("click", event => {
    const subtab = event.target?.closest?.('[data-add2e-capability-tab]');
    if (subtab && !subtab.disabled) {
      const section = subtab.closest?.('section[data-section="capacites"]');
      if (!section) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      setHudCapabilitiesTab(section, subtab.dataset.add2eCapabilityTab);
      return;
    }

    const featureButton = event.target?.closest?.('#add2e-action-hud button.act[data-action="use-feature"]');
    if (!featureButton) return;
    const section = featureButton.closest?.('section[data-section="capacites"]');
    if (!section) return;
    const retainedSubtab = add2eHudCapabilitiesTab;
    for (const delay of [0, 120]) {
      window.setTimeout(() => {
        add2eHudCapabilitiesTab = retainedSubtab;
        restoreHudCapabilitiesTab();
      }, delay);
    }
  }, true);

  add2eHudCapabilitiesObserver = new MutationObserver(mutations => {
    const touched = mutations.some(mutation => mutation.target?.closest?.("#add2e-action-hud") || [...(mutation.addedNodes ?? [])].some(node => node?.id === "add2e-action-hud" || node?.querySelector?.("#add2e-action-hud")));
    if (touched) scheduleHudCapabilitiesTabs();
  });
  add2eHudCapabilitiesObserver.observe(document.body, { childList: true, subtree: true });
  scheduleHudCapabilitiesTabs();
}

function thiefDialogWindow(form) {
  return form?.closest?.(".application, .window-app, .app, .dialog") ?? null;
}

function styleThiefDialogs(root = document) {
  const forms = root?.matches?.(".add2e-thief-roll-dialog")
    ? [root]
    : Array.from(root?.querySelectorAll?.(".add2e-thief-roll-dialog") ?? []);
  for (const form of forms) {
    const windowElement = thiefDialogWindow(form);
    if (!windowElement) continue;
    windowElement.classList.add("add2e-thief-dialog-window", "add2e-theme-cleric");
    const cancel = windowElement.querySelector?.('button[data-action="cancel"]');
    if (!cancel || cancel.dataset.add2eCancelGuard === "true") continue;
    cancel.dataset.add2eCancelGuard = "true";
    cancel.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const close = windowElement.querySelector?.('.header-control.close, .window-header [data-action="close"], [data-action="close"]');
      close?.click?.();
    }, true);
  }
}

function installThiefDialogStyle() {
  if (globalThis[ADD2E_THIEF_DIALOG_FLAG]) return;
  globalThis[ADD2E_THIEF_DIALOG_FLAG] = true;
  add2eThiefDialogObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes ?? []) {
        if (node?.nodeType === Node.ELEMENT_NODE) styleThiefDialogs(node);
      }
    }
  });
  add2eThiefDialogObserver.observe(document.body, { childList: true, subtree: true });
  styleThiefDialogs();
}

function removeSneakAttackCard(sheetRoot) {
  for (const card of sheetRoot?.querySelectorAll?.('.a2e-thief-skill-card.is-static') ?? []) {
    const text = `${card.textContent ?? ""} ${card.title ?? ""}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (text.includes("attaque dans le dos") || text.includes("frappe dans le dos") || text.includes("attaque sournoise") || text.includes("backstab")) card.remove();
  }
}

function injectGlobalCapabilityStyles() {
  const existing = document.getElementById(ADD2E_CAPABILITIES_STYLE_ID);
  existing?.remove?.();

  const style = document.createElement("style");
  style.id = ADD2E_CAPABILITIES_STYLE_ID;
  style.textContent = `
    /* Feuille ApplicationV2 : style chargé dans document.head après les CSS système. */
    .add2e-character-v2-app .add2e-character-v3 .add2e-capacites-modern-root,
    .add2e-character-v3 .add2e-capacites-modern-root { display:grid; gap:10px; }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skills-inline,
    .add2e-character-v3 .a2e-thief-skills-inline { display:grid !important; grid-template-columns:repeat(auto-fit,minmax(145px,1fr)) !important; gap:7px !important; align-items:stretch !important; }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-card,
    .add2e-character-v2-app .add2e-character-v3 button.a2e-thief-skill-card,
    .add2e-character-v3 .a2e-thief-skill-card,
    .add2e-character-v3 button.a2e-thief-skill-card {
      display:grid !important;
      grid-template-columns:minmax(0,1fr) 30px !important;
      grid-template-rows:auto auto auto !important;
      gap:2px 6px !important;
      align-items:center !important;
      min-width:0 !important;
      min-height:74px !important;
      width:100% !important;
      box-sizing:border-box !important;
      margin:0 !important;
      padding:8px 9px !important;
      border:1px solid #d6b05a !important;
      border-radius:9px !important;
      background:#fffdf6 !important;
      background-image:none !important;
      color:#3d2b0a !important;
      box-shadow:0 1px 3px rgba(80,58,10,.10) !important;
      text-align:left !important;
      font:inherit !important;
      appearance:none !important;
      -webkit-appearance:none !important;
      overflow:hidden !important;
    }
    .add2e-character-v2-app .add2e-character-v3 button.a2e-thief-skill-card,
    .add2e-character-v3 button.a2e-thief-skill-card { cursor:pointer !important; }
    .add2e-character-v2-app .add2e-character-v3 button.a2e-thief-skill-card:hover,
    .add2e-character-v3 button.a2e-thief-skill-card:hover { border-color:#8f6515 !important; background:#fff8e3 !important; transform:translateY(-1px); }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-name,
    .add2e-character-v3 .a2e-thief-skill-name { grid-column:1 !important; grid-row:1 !important; display:block !important; min-width:0 !important; color:#3d2b0a !important; font-size:.92em !important; font-weight:950 !important; line-height:1.12 !important; white-space:normal !important; overflow:hidden !important; text-overflow:ellipsis !important; }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-total,
    .add2e-character-v3 .a2e-thief-skill-total { grid-column:1 !important; grid-row:2 !important; display:block !important; color:#184a82 !important; font-size:1.14em !important; font-weight:950 !important; line-height:1 !important; }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-detail,
    .add2e-character-v3 .a2e-thief-skill-detail { grid-column:1 !important; grid-row:3 !important; display:flex !important; gap:5px !important; flex-wrap:wrap !important; align-items:center !important; color:#7f704d !important; font-size:.78em !important; font-weight:850 !important; line-height:1.1 !important; }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-bonus,
    .add2e-character-v3 .a2e-thief-skill-bonus { border-radius:999px !important; padding:1px 5px !important; border:1px solid #dac276 !important; background:#fff7dc !important; font-weight:950 !important; }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-bonus.positive,
    .add2e-character-v3 .a2e-thief-skill-bonus.positive { color:#1f7c4d !important; }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-bonus.negative,
    .add2e-character-v3 .a2e-thief-skill-bonus.negative { color:#a1261b !important; }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-bonus.neutral,
    .add2e-character-v3 .a2e-thief-skill-bonus.neutral { color:#7f704d !important; }
    .add2e-character-v2-app .add2e-character-v3 .a2e-thief-skill-action,
    .add2e-character-v3 .a2e-thief-skill-action { grid-column:2 !important; grid-row:1 / span 3 !important; display:flex !important; align-items:center !important; justify-content:center !important; font-size:1.08em !important; }
    .add2e-character-v3 .a2e-thief-skill-card[data-skill-tone="lock"] .a2e-thief-skill-action { color:#168a4a !important; }
    .add2e-character-v3 .a2e-thief-skill-card[data-skill-tone="trap"] .a2e-thief-skill-action { color:#d88916 !important; }
    .add2e-character-v3 .a2e-thief-skill-card[data-skill-tone="move"] .a2e-thief-skill-action { color:#2b82c8 !important; }
    .add2e-character-v3 .a2e-thief-skill-card[data-skill-tone="hide"] .a2e-thief-skill-action { color:#8a4bb3 !important; }
    .add2e-character-v3 .a2e-thief-skill-card[data-skill-tone="listen"] .a2e-thief-skill-action { color:#2f9a9a !important; }
    .add2e-character-v3 .a2e-thief-skill-card[data-skill-tone="climb"] .a2e-thief-skill-action { color:#c66a1d !important; }
    .add2e-character-v3 .a2e-thief-skill-card[data-skill-tone="language"] .a2e-thief-skill-action { color:#6c5bd5 !important; }
    .add2e-character-v3 .a2e-thief-skill-card[data-skill-tone="pocket"] .a2e-thief-skill-action { color:#1f8f54 !important; }

    /* Sous-onglets compacts du HUD. */
    #add2e-action-hud section[data-section="capacites"] > .a2e-hud-capability-subtabs { display:flex; gap:6px; padding-bottom:4px; border-bottom:1px solid rgba(214,176,90,.28); }
    #add2e-action-hud .a2e-hud-capability-subtabs button { min-height:30px; padding:5px 11px; border:1px solid rgba(214,176,90,.55); border-radius:999px; background:rgba(214,176,90,.12); color:#ffe4a1; font-weight:900; font-size:.82em; cursor:pointer; }
    #add2e-action-hud .a2e-hud-capability-subtabs button.active { background:linear-gradient(180deg,#f0c66d,#c78d2e); color:#211307; }
    #add2e-action-hud .a2e-hud-capability-subtabs button:disabled { opacity:.45; cursor:default; }
    #add2e-action-hud section[data-section="capacites"][data-add2e-capability-tab="classe"] > .a2e-hud-racial-capabilities { display:none !important; }
    #add2e-action-hud section[data-section="capacites"][data-add2e-capability-tab="racial"] > [data-add2e-capability-group="classe"] { display:none !important; }
    #add2e-action-hud section[data-section="capacites"][data-add2e-capability-tab="racial"] > .a2e-hud-racial-capabilities { display:grid !important; gap:7px; }
    #add2e-action-hud section[data-section="capacites"] > .a2e-hud-racial-capabilities .a2e-hud-racial-title { display:none !important; }
    #add2e-action-hud section[data-section="capacites"] .row.compact:has(> button.act[data-action="use-feature"]),
    #add2e-action-hud section[data-section="capacites"] .a2e-hud-racial-row { grid-template-columns:32px minmax(0,1fr) !important; min-height:38px !important; padding:6px !important; }
    #add2e-action-hud section[data-section="capacites"] .row.compact > button.act[data-action="use-feature"],
    #add2e-action-hud section[data-section="capacites"] .a2e-hud-racial-row > .a2e-hud-racial-icon { grid-column:1 !important; grid-row:1 !important; width:32px !important; min-width:32px !important; height:30px !important; min-height:30px !important; padding:0 !important; border:1px solid rgba(101,184,255,.82) !important; border-radius:8px !important; background:rgba(43,112,177,.24) !important; color:#8fd2ff !important; box-shadow:none !important; }
    #add2e-action-hud section[data-section="capacites"] .row.compact > div,
    #add2e-action-hud section[data-section="capacites"] .a2e-hud-racial-row > div { grid-column:2 !important; grid-row:1 !important; min-width:0; }
    #add2e-action-hud section[data-section="capacites"] .row.compact > button.act[data-action="use-feature"] i { font-size:14px; pointer-events:none; }
    #add2e-action-hud section[data-section="capacites"] .a2e-hud-racial-row .a2e-hud-racial-description { display:none !important; }

    /* DialogV2 des compétences de voleur. */
    .application.add2e-thief-dialog-window,.window-app.add2e-thief-dialog-window,.app.add2e-thief-dialog-window,.dialog.add2e-thief-dialog-window { border:2px solid #c99a36 !important; border-radius:16px !important; overflow:hidden !important; box-shadow:0 10px 26px rgba(0,0,0,.22) !important; background:linear-gradient(180deg,#fffaf0,#f3e6c8) !important; }
    .application.add2e-thief-dialog-window .window-header,.window-app.add2e-thief-dialog-window .window-header,.app.add2e-thief-dialog-window .window-header,.dialog.add2e-thief-dialog-window .window-header { background:linear-gradient(90deg,#6f4b12,#b88924) !important; color:#fff !important; border-bottom:2px solid #c99a36 !important; }
    .application.add2e-thief-dialog-window .window-content,.window-app.add2e-thief-dialog-window .window-content,.app.add2e-thief-dialog-window .window-content,.dialog.add2e-thief-dialog-window .window-content { background:linear-gradient(180deg,#fffaf0,#f3e6c8) !important; color:#2d2011 !important; padding:12px !important; }
    .add2e-thief-roll-dialog { display:grid; gap:10px; padding:10px; margin:0; border:1px solid #c99a36; border-radius:10px; background:rgba(255,255,255,.76); color:#2d2011; }
  `;
  document.head.appendChild(style);
}

if (game?.ready) {
  injectGlobalCapabilityStyles();
  installHudCapabilitiesTabs();
  installThiefDialogStyle();
} else {
  Hooks.once("ready", () => {
    injectGlobalCapabilityStyles();
    installHudCapabilitiesTabs();
    installThiefDialogStyle();
  });
}

export function injectCharacterUiStyles(sheetRoot) {
  if (!sheetRoot) return;
  injectGlobalCapabilityStyles();
  removeSneakAttackCard(sheetRoot);
}
