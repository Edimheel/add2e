// ADD2E Spell Dialog UI
const VERSION = "2026-05-21-v1";
globalThis.ADD2E_SPELL_DIALOG_UI_VERSION = VERSION;
function esc(v) { return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;"); }
const THEMES = {
  cleric: { label: "Clerc", bg: "#fffaf0", dark: "#5c3c0b", main: "#b88924", border: "#c99a36", text: "#2d2011", labelColor: "#6f4b12" },
  druid: { label: "Druide", bg: "#f4faef", dark: "#264a23", main: "#719c4a", border: "#7fa45d", text: "#202d1a", labelColor: "#355428" },
  wizard: { label: "Magicien", bg: "#f8f3ff", dark: "#2e1c5a", main: "#6b49b8", border: "#8060cc", text: "#211735", labelColor: "#4b3684" },
  illusionist: { label: "Illusionniste", bg: "#f9f7ff", dark: "#275a8a", main: "#925ac6", border: "#70a9d6", text: "#1e3043", labelColor: "#315d83" }
};
function themeData(theme) { return THEMES[theme] ?? THEMES.cleric; }
function shell({ theme = "cleric", title = "Sort", subtitle = "", img = "icons/svg/book.svg", body = "" } = {}) {
  const t = themeData(theme);
  return `<div class="add2e-spell-dialog-shell add2e-spell-dialog-theme-${esc(theme)}" style="border-radius:14px;overflow:hidden;border:2px solid ${t.border};background:${t.bg};color:${t.text};box-shadow:0 8px 20px rgba(0,0,0,.18);font-family:var(--font-primary);"><div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:linear-gradient(90deg,${t.dark},${t.main});color:white;border-bottom:2px solid ${t.border};"><img src="${esc(img)}" style="width:42px;height:42px;border-radius:8px;background:#fff;object-fit:cover;border:2px solid rgba(255,255,255,.9);"><div><div style="font-size:1.08rem;font-weight:800;line-height:1.15;">${esc(title)}</div><div style="font-size:.84rem;opacity:.95;line-height:1.2;margin-top:2px;">${esc(subtitle || t.label)}</div></div></div><div style="padding:12px;display:flex;flex-direction:column;gap:10px;">${body}</div></div>`;
}
function primaryButtonClass(buttons) { return buttons; }
globalThis.ADD2E_SPELL_DIALOG_UI = { version: VERSION, themes: THEMES, shell, primaryButtonClass, esc };
console.log("[ADD2E][SPELL_DIALOG_UI][VERSION]", VERSION);
