// ============================================================
// ADD2E — 08 Character Sheet UI — 03 styles
// ============================================================

const ADD2E_RACIAL_HUD_STYLE_ID = "add2e-racial-capabilities-compact-style";

function injectRacialHudStyles() {
  if (document.getElementById(ADD2E_RACIAL_HUD_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = ADD2E_RACIAL_HUD_STYLE_ID;
  style.textContent = `
    #add2e-action-hud .a2e-hud-racial-panel {
      display:contents;
    }
    #add2e-action-hud .a2e-hud-racial-title {
      display:none !important;
    }
    #add2e-action-hud .a2e-hud-racial-effects .a2e-hud-racial-row:has(> img[src*="eye.svg"]) {
      display:none !important;
    }
    #add2e-action-hud .a2e-hud-racial-effects .a2e-hud-racial-row .meta,
    #add2e-action-hud .a2e-hud-racial-effects .a2e-hud-racial-row .a2e-hud-racial-description {
      display:none !important;
    }
    #add2e-action-hud .a2e-hud-racial-capabilities .a2e-hud-racial-row {
      min-height:34px;
      border-color:rgba(214,176,90,.34);
      background:rgba(0,0,0,.10);
    }
    #add2e-action-hud .a2e-hud-racial-capabilities .a2e-hud-racial-row .a2e-hud-racial-description {
      display:none !important;
    }
    #add2e-action-hud .a2e-hud-racial-capabilities .a2e-hud-racial-row .title {
      display:inline;
      font-weight:900;
    }
    #add2e-action-hud .a2e-hud-racial-capabilities .a2e-hud-racial-row .meta {
      display:inline !important;
      margin-left:5px;
      font-size:.82em;
    }
    #add2e-action-hud .a2e-hud-racial-capabilities .a2e-hud-racial-row .meta span {
      display:none !important;
    }
    #add2e-action-hud .a2e-hud-racial-capabilities .a2e-hud-racial-row .meta span:nth-child(2) {
      display:inline !important;
    }
    #add2e-action-hud .a2e-hud-racial-capabilities .a2e-hud-racial-row .meta span:nth-child(2)::before {
      content:" — ";
    }
    #add2e-action-hud .a2e-hud-racial-capabilities .a2e-hud-racial-row:has(.fa-eye, .fa-eye-slash) .meta {
      display:none !important;
    }
    #add2e-action-hud .a2e-hud-racial-icon {
      width:28px !important;
      min-width:28px !important;
      height:28px !important;
      min-height:28px !important;
      padding:0 !important;
      border:0 !important;
      border-radius:0 !important;
      background:transparent !important;
      box-shadow:none !important;
    }
    #add2e-action-hud .a2e-hud-racial-icon:has(.fa-eye) {
      color:#c23b35 !important;
    }
    #add2e-action-hud .a2e-hud-racial-icon:has(.fa-eye-slash) {
      color:#2a9a54 !important;
    }
    #add2e-action-hud .a2e-hud-racial-icon:hover {
      filter:brightness(1.15) saturate(1.1);
      transform:scale(1.12);
    }
  `;
  document.head.appendChild(style);
}

if (game?.ready) injectRacialHudStyles();
else Hooks.once("ready", injectRacialHudStyles);

export function injectCharacterUiStyles(sheetRoot) {
  if (!sheetRoot) return;
  injectRacialHudStyles();
  sheetRoot.querySelectorAll("style[data-add2e-ui-enhance-split]").forEach(s => s.remove());

  const style = document.createElement("style");
  style.dataset.add2eUiEnhanceSplit = "8";
  style.textContent = `
    .add2e-character-v3 .add2e-capacites-modern-root {
      display:block;
    }
    .add2e-character-v3 .a2e-thief-skills-inline {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(145px,1fr));
      gap:7px;
    }
    .add2e-character-v3 .a2e-thief-skill-card {
      display:grid;
      grid-template-columns:1fr 24px;
      grid-template-rows:auto auto auto;
      gap:2px 4px;
      align-items:center;
      padding:7px 7px;
      border:1px solid #d6b05a;
      border-radius:9px;
      background:#fffdf6;
      box-shadow:0 1px 3px rgba(80,58,10,.10);
      min-width:0;
      overflow:hidden;
    }
    .add2e-character-v3 .a2e-thief-skill-name {
      grid-column:1;
      font-weight:950;
      color:#3d2b0a;
      line-height:1.05;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .add2e-character-v3 .a2e-thief-skill-total {
      grid-column:1;
      font-size:1.12em;
      font-weight:950;
      color:#184a82;
      line-height:1.05;
    }
    .add2e-character-v3 .a2e-thief-skill-detail {
      grid-column:1;
      display:flex;
      gap:4px;
      flex-wrap:nowrap;
      align-items:center;
      color:#7f704d;
      font-size:.78em;
      font-weight:800;
      white-space:nowrap;
      min-width:0;
    }
    .add2e-character-v3 .a2e-thief-skill-bonus {
      border-radius:999px;
      padding:1px 5px;
      border:1px solid #dac276;
      background:#fff7dc;
      font-weight:950;
      white-space:nowrap;
    }
    .add2e-character-v3 .a2e-thief-skill-bonus.positive { color:#1f7c4d; }
    .add2e-character-v3 .a2e-thief-skill-bonus.negative { color:#a1261b; }
    .add2e-character-v3 .a2e-thief-skill-bonus.neutral { color:#7f704d; }
    .add2e-character-v3 .a2e-thief-skill-action {
      grid-column:2;
      grid-row:1 / span 3;
      display:flex;
      align-items:center;
      justify-content:center;
      min-width:24px;
    }
    .add2e-character-v3 .add2e-thief-skill-roll {
      --a2e-thief-icon-color:#2b82c8;
      width:22px;
      height:22px;
      min-width:22px;
      min-height:22px;
      padding:0;
      margin:0;
      border:0;
      outline:0;
      border-radius:0;
      background:transparent;
      color:var(--a2e-thief-icon-color);
      display:inline-flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      box-shadow:none;
      text-shadow:0 1px 1px rgba(255,255,255,.75), 0 1px 2px rgba(92,64,12,.18);
      transition:transform .08s ease, filter .12s ease;
      overflow:visible;
      line-height:1;
      appearance:none;
      -webkit-appearance:none;
    }
    .add2e-character-v3 .add2e-thief-skill-roll[data-skill-tone="lock"] { --a2e-thief-icon-color:#168a4a; }
    .add2e-character-v3 .add2e-thief-skill-roll[data-skill-tone="trap"] { --a2e-thief-icon-color:#d88916; }
    .add2e-character-v3 .add2e-thief-skill-roll[data-skill-tone="move"] { --a2e-thief-icon-color:#2b82c8; }
    .add2e-character-v3 .add2e-thief-skill-roll[data-skill-tone="hide"] { --a2e-thief-icon-color:#8a4bb3; }
    .add2e-character-v3 .add2e-thief-skill-roll[data-skill-tone="listen"] { --a2e-thief-icon-color:#2f9a9a; }
    .add2e-character-v3 .add2e-thief-skill-roll[data-skill-tone="climb"] { --a2e-thief-icon-color:#c66a1d; }
    .add2e-character-v3 .add2e-thief-skill-roll[data-skill-tone="language"] { --a2e-thief-icon-color:#6c5bd5; }
    .add2e-character-v3 .add2e-thief-skill-roll[data-skill-tone="pocket"] { --a2e-thief-icon-color:#b35b26; }
    .add2e-character-v3 .add2e-thief-skill-roll:hover {
      filter:brightness(1.14) saturate(1.08);
      transform:scale(1.12);
    }
    .add2e-character-v3 .add2e-thief-skill-roll:active {
      transform:translateY(1px) scale(1.03);
    }
    .add2e-character-v3 .add2e-thief-skill-roll i {
      font-size:1.12rem;
      line-height:1;
      pointer-events:none;
      color:inherit;
    }
    .add2e-character-v3 .a2e-feature-card-list {
      display:grid;
      gap:7px;
    }
    .add2e-character-v3 .a2e-feature-card {
      padding:7px 8px;
      border:1px solid #dac276;
      border-radius:9px;
      background:#fffdf6;
    }
    .add2e-character-v3 .a2e-feature-card-title {
      display:flex;
      justify-content:space-between;
      gap:8px;
      align-items:center;
      color:#3d2b0a;
    }
    .add2e-character-v3 .a2e-feature-card-title strong {
      min-width:0;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .add2e-character-v3 .a2e-feature-card-desc {
      margin-top:5px;
      font-size:.9em;
      line-height:1.28;
    }
    .add2e-character-v3 .add2e-feature-icon-only {
      width:30px !important;
      min-width:30px !important;
      height:30px !important;
      min-height:30px !important;
      margin:0 !important;
      padding:0 !important;
      border:0 !important;
      border-radius:0 !important;
      background:transparent !important;
      box-shadow:none !important;
      color:#1d6fae !important;
      display:inline-flex !important;
      align-items:center !important;
      justify-content:center !important;
      cursor:pointer !important;
      line-height:1 !important;
    }
    .add2e-character-v3 .add2e-feature-icon-only i {
      font-size:1.2rem;
      pointer-events:none;
    }
    .add2e-character-v3 .add2e-feature-icon-only:hover {
      filter:brightness(1.12) saturate(1.1);
      transform:scale(1.12);
    }
    .add2e-character-v3 .add2e-feature-icon-only.is-enabled { color:#23884d !important; }
    .add2e-character-v3 .add2e-feature-icon-only.is-disabled { color:#b6332e !important; }
    .add2e-character-v3 .add2e-feature-icon-only.is-roll { color:#1d6fae !important; }
    .add2e-character-v3 .add2e-effects-table td,
    .add2e-character-v3 .add2e-effects-table th {
      vertical-align:middle;
    }
  `;

  sheetRoot.prepend(style);
}
