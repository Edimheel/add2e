// ============================================================
// ADD2E — 08 Character Sheet UI — 03 styles
// ============================================================

export function injectCharacterUiStyles(sheetRoot) {
  if (!sheetRoot || sheetRoot.querySelector("style[data-add2e-ui-enhance-split='1']")) return;

  const style = document.createElement("style");
  style.dataset.add2eUiEnhanceSplit = "1";
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
      grid-template-columns:1fr auto;
      grid-template-rows:auto auto auto;
      gap:2px 6px;
      align-items:center;
      padding:7px 8px;
      border:1px solid #d6b05a;
      border-radius:9px;
      background:#fffdf6;
      box-shadow:0 1px 3px rgba(80,58,10,.10);
    }
    .add2e-character-v3 .a2e-thief-skill-name {
      grid-column:1;
      font-weight:950;
      color:#3d2b0a;
      line-height:1.05;
    }
    .add2e-character-v3 .a2e-thief-skill-total {
      grid-column:1;
      font-size:1.18em;
      font-weight:950;
      color:#184a82;
    }
    .add2e-character-v3 .a2e-thief-skill-detail {
      grid-column:1;
      display:flex;
      gap:5px;
      flex-wrap:wrap;
      align-items:center;
      color:#7f704d;
      font-size:.82em;
      font-weight:800;
    }
    .add2e-character-v3 .a2e-thief-skill-bonus {
      border-radius:999px;
      padding:1px 5px;
      border:1px solid #dac276;
      background:#fff7dc;
      font-weight:950;
    }
    .add2e-character-v3 .a2e-thief-skill-bonus.positive { color:#1f7c4d; }
    .add2e-character-v3 .a2e-thief-skill-bonus.negative { color:#a1261b; }
    .add2e-character-v3 .a2e-thief-skill-bonus.neutral { color:#7f704d; }
    .add2e-character-v3 .a2e-thief-skill-action {
      grid-column:2;
      grid-row:1 / span 3;
      text-align:center;
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
