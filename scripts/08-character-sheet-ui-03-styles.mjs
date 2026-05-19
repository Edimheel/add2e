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
      --a2e-thief-icon-color:#2b82c8;
      width:31px;
      height:31px;
      min-width:31px;
      min-height:31px;
      padding:0;
      border:2px solid var(--a2e-thief-icon-color);
      border-radius:999px;
      background:radial-gradient(circle at 35% 30%, #ffffff 0%, #fffaf0 62%, #f0dfb6 100%);
      color:var(--a2e-thief-icon-color);
      display:inline-flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      box-shadow:0 1px 4px rgba(92,64,12,.22), inset 0 0 0 1px rgba(255,255,255,.75);
      transition:transform .08s ease, box-shadow .12s ease, filter .12s ease;
    }
    .add2e-character-v3 .a2e-thief-skill-icon-btn[data-skill-tone="lock"] { --a2e-thief-icon-color:#168a4a; }
    .add2e-character-v3 .a2e-thief-skill-icon-btn[data-skill-tone="trap"] { --a2e-thief-icon-color:#d88916; }
    .add2e-character-v3 .a2e-thief-skill-icon-btn[data-skill-tone="move"] { --a2e-thief-icon-color:#2b82c8; }
    .add2e-character-v3 .a2e-thief-skill-icon-btn[data-skill-tone="hide"] { --a2e-thief-icon-color:#8a4bb3; }
    .add2e-character-v3 .a2e-thief-skill-icon-btn[data-skill-tone="listen"] { --a2e-thief-icon-color:#2f9a9a; }
    .add2e-character-v3 .a2e-thief-skill-icon-btn[data-skill-tone="climb"] { --a2e-thief-icon-color:#c66a1d; }
    .add2e-character-v3 .a2e-thief-skill-icon-btn[data-skill-tone="language"] { --a2e-thief-icon-color:#6c5bd5; }
    .add2e-character-v3 .a2e-thief-skill-icon-btn[data-skill-tone="pocket"] { --a2e-thief-icon-color:#b35b26; }
    .add2e-character-v3 .a2e-thief-skill-icon-btn:hover {
      filter:brightness(1.04);
      box-shadow:0 2px 6px rgba(92,64,12,.26), inset 0 0 0 1px rgba(255,255,255,.85);
    }
    .add2e-character-v3 .a2e-thief-skill-icon-btn:active {
      transform:translateY(1px);
      box-shadow:0 1px 3px rgba(92,64,12,.20), inset 0 0 0 1px rgba(255,255,255,.70);
    }
    .add2e-character-v3 .a2e-thief-skill-icon-btn i {
      font-size:.92rem;
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
