// ============================================================
// ADD2E — 08 Character Sheet UI — 03 styles
// ============================================================

export function injectCharacterUiStyles(sheetRoot) {
  if (!sheetRoot) return;

  sheetRoot.querySelectorAll("style[data-add2e-ui-enhance-split]").forEach(s => s.remove());

  const style = document.createElement("style");
  style.dataset.add2eUiEnhanceSplit = "7";
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

    /* Force l'apparence icône seule, même si une ancienne classe .a2e-btn.blue reste dans le DOM. */
    .add2e-character-v3 button.add2e-thief-skill-roll,
    .add2e-character-v3 .add2e-thief-skill-roll,
    .add2e-character-v3 button.a2e-thief-skill-icon-btn,
    .add2e-character-v3 .a2e-thief-skill-icon-btn {
      --a2e-thief-icon-color:#2b82c8;
      width:22px !important;
      height:22px !important;
      min-width:22px !important;
      min-height:22px !important;
      max-width:22px !important;
      max-height:22px !important;
      padding:0 !important;
      margin:0 !important;
      border:0 !important;
      outline:0 !important;
      border-radius:0 !important;
      background:transparent !important;
      background-color:transparent !important;
      background-image:none !important;
      color:var(--a2e-thief-icon-color) !important;
      display:inline-flex !important;
      align-items:center !important;
      justify-content:center !important;
      cursor:pointer;
      box-shadow:none !important;
      text-shadow:0 1px 1px rgba(255,255,255,.75), 0 1px 2px rgba(92,64,12,.18);
      transition:transform .08s ease, filter .12s ease;
      overflow:visible !important;
      line-height:1 !important;
      appearance:none !important;
      -webkit-appearance:none !important;
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
    .add2e-character-v3 .add2e-thief-skill-roll i,
    .add2e-character-v3 .a2e-thief-skill-icon-btn i {
      font-size:1.12rem !important;
      line-height:1 !important;
      pointer-events:none;
      color:inherit !important;
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
    .add2e-character-v3 .a2e-feature-card-title span {
      font-size:.82em;
      font-weight:900;
      color:#6f4b12;
      white-space:nowrap;
    }
    .add2e-character-v3 .a2e-feature-card-desc {
      margin-top:5px;
      font-size:.9em;
      line-height:1.28;
    }
    .add2e-character-v3 .a2e-feature-actions {
      margin-top:7px;
      display:flex;
      justify-content:flex-start;
    }
    .add2e-character-v3 .add2e-effects-table td,
    .add2e-character-v3 .add2e-effects-table th {
      vertical-align:middle;
    }
  `;

  sheetRoot.prepend(style);
}
