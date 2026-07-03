// ============================================================
// ADD2E — 08 Character Sheet UI — 03 styles
// Styles des tuiles de la feuille ; le HUD conserve sa présentation native.
// ============================================================

const ADD2E_CAPABILITIES_STYLE_ID = "add2e-capabilities-sheet-styles";

function injectHudCapabilityStyles() {
  const existing = document.getElementById(ADD2E_CAPABILITIES_STYLE_ID);
  existing?.remove?.();

  const style = document.createElement("style");
  style.id = ADD2E_CAPABILITIES_STYLE_ID;
  style.textContent = `
    /* Les panneaux raciaux sont rendus par le HUD, ils ne doivent jamais être masqués. */
    #add2e-action-hud section[data-section="capacites"] > .a2e-hud-racial-capabilities,
    #add2e-action-hud section[data-section="effets"] > .a2e-hud-racial-effects,
    #add2e-action-hud .a2e-hud-racial-panel {
      display:grid !important;
    }
    #add2e-action-hud .a2e-hud-racial-title {
      display:block !important;
    }
    #add2e-action-hud .a2e-hud-racial-row .a2e-hud-racial-description,
    #add2e-action-hud .a2e-hud-racial-row .meta {
      display:flex;
    }
    #add2e-action-hud .a2e-hud-racial-row .a2e-hud-racial-description {
      display:block;
    }

    /* Le rendu compact du HUD est conservé : seul le libellé Utiliser devient une icône. */
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

if (game?.ready) injectHudCapabilityStyles();
else Hooks.once("ready", injectHudCapabilityStyles);

export function injectCharacterUiStyles(sheetRoot) {
  if (!sheetRoot) return;
  injectHudCapabilityStyles();
  sheetRoot.querySelectorAll("style[data-add2e-capabilities-sheet-style]").forEach(node => node.remove());

  const style = document.createElement("style");
  style.dataset.add2eCapabilitiesSheetStyle = "1";
  style.textContent = `
    .add2e-character-v3 .add2e-capacites-modern-root { display:grid; gap:10px; }
    .add2e-character-v3 .add2e-capacites-grid-modern { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .add2e-character-v3 .a2e-thief-skills-inline { display:grid; grid-template-columns:repeat(auto-fit,minmax(155px,1fr)); gap:8px; }
    .add2e-character-v3 .a2e-thief-skill-card {
      display:grid;
      grid-template-columns:minmax(0,1fr) 28px;
      grid-template-rows:auto auto auto;
      gap:3px 6px;
      align-items:center;
      min-width:0;
      padding:8px;
      border:1px solid #d6b05a;
      border-radius:9px;
      background:#fffdf6;
      box-shadow:0 1px 3px rgba(80,58,10,.10);
    }
    .add2e-character-v3 .a2e-thief-skill-card.has-feature-img { grid-template-columns:30px minmax(0,1fr) 28px; grid-template-rows:auto auto auto auto; }
    .add2e-character-v3 .a2e-thief-skill-feature-img { grid-column:1; grid-row:1 / span 4; width:28px; height:28px; border-radius:6px; object-fit:cover; border:1px solid #d6b05a; background:#fff7dc; }
    .add2e-character-v3 .a2e-thief-skill-name { grid-column:1; color:#3d2b0a; font-weight:900; line-height:1.08; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .add2e-character-v3 .has-feature-img .a2e-thief-skill-name,
    .add2e-character-v3 .has-feature-img .a2e-thief-skill-total,
    .add2e-character-v3 .has-feature-img .a2e-thief-skill-detail,
    .add2e-character-v3 .has-feature-img .a2e-thief-skill-description { grid-column:2; }
    .add2e-character-v3 .has-feature-img .a2e-thief-skill-name { white-space:normal; }
    .add2e-character-v3 .a2e-thief-skill-total { grid-column:1; color:#184a82; font-size:1.16em; font-weight:950; line-height:1; }
    .add2e-character-v3 .a2e-thief-skill-detail { grid-column:1; display:flex; gap:4px; align-items:center; color:#7f704d; font-size:.78em; font-weight:800; white-space:nowrap; }
    .add2e-character-v3 .a2e-thief-skill-description { color:#594b30; font-size:.78em; line-height:1.25; }
    .add2e-character-v3 .a2e-thief-skill-bonus { border:1px solid #dac276; border-radius:999px; padding:1px 5px; background:#fff7dc; font-weight:900; }
    .add2e-character-v3 .a2e-thief-skill-bonus.positive { color:#1f7c4d; }
    .add2e-character-v3 .a2e-thief-skill-bonus.negative { color:#a1261b; }
    .add2e-character-v3 .a2e-thief-skill-bonus.neutral { color:#7f704d; }
    .add2e-character-v3 .a2e-thief-skill-action { grid-column:2; grid-row:1 / span 3; display:flex; align-items:center; justify-content:center; }
    .add2e-character-v3 .has-feature-img .a2e-thief-skill-action { grid-column:3; grid-row:1 / span 4; }
    .add2e-character-v3 .add2e-thief-skill-roll,
    .add2e-character-v3 .add2e-feature-icon-only,
    .add2e-character-v3 .a2e-thief-skill-static {
      width:26px;
      min-width:26px;
      height:26px;
      min-height:26px;
      padding:0;
      margin:0;
      border:0;
      border-radius:0;
      background:transparent;
      color:#277fc4;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      box-shadow:none;
      line-height:1;
    }
    .add2e-character-v3 .a2e-thief-skill-static { cursor:default; color:#7a5f2e; }
    .add2e-character-v3 .add2e-thief-skill-roll[data-skill-tone="lock"] { color:#168a4a; }
    .add2e-character-v3 .add2e-thief-skill-roll[data-skill-tone="trap"] { color:#d88916; }
    .add2e-character-v3 .add2e-thief-skill-roll[data-skill-tone="move"] { color:#2b82c8; }
    .add2e-character-v3 .add2e-thief-skill-roll[data-skill-tone="hide"] { color:#8a4bb3; }
    .add2e-character-v3 .add2e-thief-skill-roll[data-skill-tone="listen"] { color:#2f9a9a; }
    .add2e-character-v3 .add2e-thief-skill-roll[data-skill-tone="climb"] { color:#c66a1d; }
    .add2e-character-v3 .add2e-thief-skill-roll[data-skill-tone="language"] { color:#6c5bd5; }
    .add2e-character-v3 .add2e-thief-skill-roll[data-skill-tone="pocket"] { color:#b35b26; }
    .add2e-character-v3 .add2e-thief-skill-roll:hover,
    .add2e-character-v3 .add2e-feature-icon-only:hover { filter:brightness(1.14) saturate(1.1); transform:scale(1.12); }
    .add2e-character-v3 .add2e-feature-icon-only.is-enabled { color:#23884d; }
    .add2e-character-v3 .add2e-feature-icon-only.is-disabled { color:#b6332e; }
    .add2e-character-v3 .add2e-feature-icon-only.is-roll { color:#1d6fae; }
    .add2e-character-v3 .a2e-feature-card-list { display:grid; gap:7px; }
    .add2e-character-v3 .a2e-feature-card { padding:8px; border:1px solid #dac276; border-radius:9px; background:#fffdf6; }
    .add2e-character-v3 .a2e-feature-card-title { display:flex; align-items:center; gap:7px; color:#3d2b0a; }
    .add2e-character-v3 .a2e-feature-card-title strong { flex:1 1 auto; min-width:0; }
    .add2e-character-v3 .a2e-feature-card-img { width:26px; height:26px; border-radius:6px; object-fit:cover; border:1px solid #d6b05a; }
    .add2e-character-v3 .a2e-feature-card-desc { margin-top:5px; color:#594b30; font-size:.88em; line-height:1.3; }
    @media (max-width:680px) { .add2e-character-v3 .add2e-capacites-grid-modern { grid-template-columns:1fr; } }
  `;
  sheetRoot.prepend(style);
}
