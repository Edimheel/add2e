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
      grid-template-columns:1fr 34px;
      grid-template-rows:auto auto auto;
      gap:2px 5px;
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
      min-width:34px;
    }
    .add2e-character-v3 .a2e-thief-skill-icon-btn {
      width:32px;
      height:32px;
      min-width:32px;
      min-height:32px;
      padding:0;
      border:1px solid #1c6aa8;
      border-radius:10px;
      background:linear-gradient(180deg, #3a97da 0%, #1666a9 100%);
      color:#fff;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      box-shadow:0 2px 5px rgba(0,0,0,.18);
      transition:transform .08s ease, box-shadow .12s ease, filter .12s ease;
    }
    .add2e-character-v3 .a2e-thief-skill-icon-btn:hover {
      filter:brightness(1.07);
      box-shadow:0 3px 7px rgba(0,0,0,.22);
    }
    .add2e-character-v3 .a2e-thief-skill-icon-btn:active {
      transform:translateY(1px);
      box-shadow:0 1px 4px rgba(0,0,0,.18);
    }
    .add2e-character-v3 .a2e-thief-skill-icon-btn i {
      font-size:.95rem;
      line-height:1;
      pointer-events:none;
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
