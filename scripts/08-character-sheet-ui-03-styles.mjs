// ============================================================
// ADD2E — 08 Character Sheet UI — 03 styles
// Tuiles feuille et subdivision compacte Classe / Racial du HUD.
// ============================================================

const ADD2E_CAPABILITIES_STYLE_ID = "add2e-capabilities-sheet-styles";
const ADD2E_HUD_CAPABILITIES_TABS_FLAG = "__ADD2E_HUD_CAPABILITIES_TABS_V1";
let add2eHudCapabilitiesTab = "classe";
let add2eHudCapabilitiesObserver = null;

function add2eHudFeatureName(feature) {
  return String(feature?._add2eHudLabel ?? feature?.name ?? feature?.label ?? feature?.title ?? feature?.nom ?? "Capacité").trim();
}

function hudCapabilitiesSection() {
  return document.querySelector('#add2e-action-hud section[data-section="capacites"]');
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

function setupHudCapabilitiesTabs() {
  const section = hudCapabilitiesSection();
  if (!section) return;

  let tabs = section.querySelector(':scope > .a2e-hud-capability-subtabs');
  if (!tabs) {
    tabs = document.createElement("div");
    tabs.className = "a2e-hud-capability-subtabs";
    tabs.innerHTML = `<button type="button" data-add2e-capability-tab="classe">Classe</button><button type="button" data-add2e-capability-tab="racial">Racial</button>`;
  }
  if (section.firstElementChild !== tabs) section.prepend(tabs);

  const racialPanel = section.querySelector(':scope > .a2e-hud-racial-capabilities');
  for (const child of Array.from(section.children)) {
    if (child === tabs || child === racialPanel) continue;
    child.dataset.add2eCapabilityGroup = "classe";
  }
  if (racialPanel) racialPanel.dataset.add2eCapabilityGroup = "racial";

  setHudCapabilitiesTab(section, add2eHudCapabilitiesTab);
}

function scheduleHudCapabilitiesTabs() {
  const raf = globalThis.requestAnimationFrame ?? (callback => window.setTimeout(callback, 16));
  raf(setupHudCapabilitiesTabs);
}

function installHudCapabilitiesTabs() {
  if (globalThis[ADD2E_HUD_CAPABILITIES_TABS_FLAG]) return;
  globalThis[ADD2E_HUD_CAPABILITIES_TABS_FLAG] = true;
  globalThis.add2eFeatureName ??= add2eHudFeatureName;

  document.addEventListener("click", event => {
    const button = event.target?.closest?.('[data-add2e-capability-tab]');
    if (!button || button.disabled) return;
    const section = button.closest?.('section[data-section="capacites"]');
    if (!section) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    setHudCapabilitiesTab(section, button.dataset.add2eCapabilityTab);
  }, true);

  add2eHudCapabilitiesObserver = new MutationObserver(mutations => {
    const touched = mutations.some(mutation => mutation.target?.closest?.("#add2e-action-hud") || [...(mutation.addedNodes ?? [])].some(node => node?.id === "add2e-action-hud" || node?.querySelector?.("#add2e-action-hud")));
    if (touched) scheduleHudCapabilitiesTabs();
  });
  add2eHudCapabilitiesObserver.observe(document.body, { childList: true, subtree: true });
  scheduleHudCapabilitiesTabs();
}

function injectHudCapabilityStyles() {
  const existing = document.getElementById(ADD2E_CAPABILITIES_STYLE_ID);
  existing?.remove?.();

  const style = document.createElement("style");
  style.id = ADD2E_CAPABILITIES_STYLE_ID;
  style.textContent = `
    /* Les panneaux raciaux sont fournis par le moteur racial du HUD. */
    #add2e-action-hud section[data-section="capacites"] > .a2e-hud-capability-subtabs {
      display:flex;
      gap:6px;
      padding-bottom:4px;
      border-bottom:1px solid rgba(214,176,90,.28);
    }
    #add2e-action-hud .a2e-hud-capability-subtabs button {
      min-height:30px;
      padding:5px 11px;
      border:1px solid rgba(214,176,90,.55);
      border-radius:999px;
      background:rgba(214,176,90,.12);
      color:#ffe4a1;
      font-weight:900;
      font-size:.82em;
      cursor:pointer;
    }
    #add2e-action-hud .a2e-hud-capability-subtabs button.active {
      background:linear-gradient(180deg,#f0c66d,#c78d2e);
      color:#211307;
    }
    #add2e-action-hud .a2e-hud-capability-subtabs button:disabled { opacity:.45; cursor:default; }
    #add2e-action-hud section[data-section="capacites"][data-add2e-capability-tab="classe"] > .a2e-hud-racial-capabilities { display:none !important; }
    #add2e-action-hud section[data-section="capacites"][data-add2e-capability-tab="racial"] > [data-add2e-capability-group="classe"] { display:none !important; }
    #add2e-action-hud section[data-section="capacites"][data-add2e-capability-tab="racial"] > .a2e-hud-racial-capabilities { display:grid !important; gap:7px; }
    #add2e-action-hud section[data-section="capacites"] > .a2e-hud-racial-capabilities .a2e-hud-racial-title { display:none !important; }

    /* Même ligne compacte que les capacités de classe. */
    #add2e-action-hud section[data-section="capacites"] .a2e-hud-racial-row {
      grid-template-columns:minmax(0,1fr) auto !important;
      min-height:38px !important;
      padding:6px !important;
    }
    #add2e-action-hud section[data-section="capacites"] .a2e-hud-racial-row > div {
      grid-column:1;
      grid-row:1;
      min-width:0;
    }
    #add2e-action-hud section[data-section="capacites"] .a2e-hud-racial-row > .a2e-hud-racial-icon {
      grid-column:2;
      grid-row:1;
      width:32px !important;
      min-width:32px !important;
      height:30px !important;
      min-height:30px !important;
      padding:0 !important;
      border:1px solid rgba(101,184,255,.82) !important;
      border-radius:8px !important;
      background:rgba(43,112,177,.24) !important;
      color:#8fd2ff !important;
      box-shadow:none !important;
    }
    #add2e-action-hud section[data-section="capacites"] .a2e-hud-racial-row > .a2e-hud-racial-icon:hover {
      color:#d7f1ff !important;
      border-color:#d7f1ff !important;
      filter:brightness(1.16);
      transform:scale(1.08);
    }
    #add2e-action-hud section[data-section="capacites"] .a2e-hud-racial-row .a2e-hud-racial-description { display:none !important; }
    #add2e-action-hud section[data-section="capacites"] .a2e-hud-racial-row .meta { margin-top:2px; }

    /* Le HUD natif reste inchangé, à l’exception du texte Utiliser devenu icône. */
    #add2e-action-hud button.act[data-action="use-feature"] {
      width:32px;
      min-width:32px;
      min-height:30px;
      padding:0;
      border:1px solid rgba(101,184,255,.82);
      border-radius:8px;
      background:rgba(43,112,177,.24);
      color:#8fd2ff;
      font-size:0;
      box-shadow:none;
    }
    #add2e-action-hud button.act[data-action="use-feature"]::before {
      content:"\\f0e7";
      font-family:"Font Awesome 6 Free","Font Awesome 5 Free";
      font-weight:900;
      font-size:14px;
      line-height:1;
    }
    #add2e-action-hud button.act[data-action="use-feature"]:hover {
      color:#d7f1ff;
      border-color:#d7f1ff;
      filter:brightness(1.16);
      transform:scale(1.08);
    }
  `;
  document.head.appendChild(style);
}

if (game?.ready) {
  injectHudCapabilityStyles();
  installHudCapabilitiesTabs();
} else {
  Hooks.once("ready", () => {
    injectHudCapabilityStyles();
    installHudCapabilitiesTabs();
  });
}

export function injectCharacterUiStyles(sheetRoot) {
  if (!sheetRoot) return;
  injectHudCapabilityStyles();
  sheetRoot.querySelectorAll("style[data-add2e-capabilities-sheet-style]").forEach(node => node.remove());

  const style = document.createElement("style");
  style.dataset.add2eCapabilitiesSheetStyle = "1";
  style.textContent = `
    .add2e-character-v3 .add2e-capacites-modern-root { display:grid; gap:10px; }
    .add2e-character-v3 .add2e-capacites-grid-modern { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .add2e-character-v3 .a2e-thief-skills-inline { display:grid; grid-template-columns:repeat(auto-fit,minmax(148px,1fr)); gap:8px; }
    .add2e-character-v3 .a2e-thief-skill-card {
      display:grid;
      grid-template-rows:auto auto auto;
      align-content:center;
      gap:5px;
      min-height:112px;
      width:100%;
      padding:10px 8px;
      border:1px solid #d6b05a;
      border-radius:9px;
      background:#fffdf6;
      box-shadow:0 1px 3px rgba(80,58,10,.10);
      text-align:center;
      font-family:inherit;
    }
    .add2e-character-v3 button.a2e-thief-skill-card { cursor:pointer; }
    .add2e-character-v3 button.a2e-thief-skill-card:hover { border-color:#8f6515; background:#fff8e3; transform:translateY(-1px); }
    .add2e-character-v3 .a2e-thief-skill-name { color:#3d2b0a; font-size:.94em; font-weight:950; line-height:1.18; white-space:normal; overflow:visible; text-overflow:clip; }
    .add2e-character-v3 .a2e-thief-skill-total { color:#184a82; font-size:1.18em; font-weight:950; line-height:1; }
    .add2e-character-v3 .a2e-thief-skill-bonus-line { color:#7f704d; font-size:.78em; font-weight:850; }
    .add2e-character-v3 .a2e-thief-skill-card.is-static { background:#f8f0d9; }
    .add2e-character-v3 .a2e-feature-card-list { display:grid; gap:7px; }
    .add2e-character-v3 .a2e-feature-card { padding:8px; border:1px solid #dac276; border-radius:9px; background:#fffdf6; }
    .add2e-character-v3 .a2e-feature-card-title { display:flex; align-items:center; gap:7px; color:#3d2b0a; }
    .add2e-character-v3 .a2e-feature-card-title strong { flex:1 1 auto; min-width:0; }
    .add2e-character-v3 .a2e-feature-card-img { width:26px; height:26px; border-radius:6px; object-fit:cover; border:1px solid #d6b05a; }
    .add2e-character-v3 .a2e-feature-card-desc { margin-top:5px; color:#594b30; font-size:.88em; line-height:1.3; }
    .add2e-character-v3 .add2e-feature-icon-only { width:26px; min-width:26px; height:26px; min-height:26px; padding:0; margin:0; border:0; border-radius:0; background:transparent; color:#1d6fae; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:none; line-height:1; }
    .add2e-character-v3 .add2e-feature-icon-only:hover { filter:brightness(1.14) saturate(1.1); transform:scale(1.12); }
    .add2e-character-v3 .add2e-feature-icon-only.is-enabled { color:#23884d; }
    .add2e-character-v3 .add2e-feature-icon-only.is-disabled { color:#b6332e; }
    .add2e-character-v3 .add2e-feature-icon-only.is-roll { color:#1d6fae; }
    @media (max-width:680px) { .add2e-character-v3 .add2e-capacites-grid-modern { grid-template-columns:1fr; } }
  `;
  sheetRoot.prepend(style);
}
