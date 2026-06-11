/**
 * scripts/add2e.mjs
 * Point d'entrée ADD2E.
 * Fichier découpé en modules dans scripts/add2e/*.mjs.
 */
import "./add2e-initiative.mjs";
import "./add2e/00-legacy-global-helpers.mjs";
import "./add2e/spell-dialog-ui.mjs";
import "./add2e/item-sheet-registration.mjs";
import "./add2e/handlebars-helpers.mjs";
import "./add2e/character-sheet-templates.mjs";
import "./add2e/monster-sheet-capabilities.mjs";
import "./add2e/01-macros-base-caracs.mjs";
import "./add2e/02-spell-sync.mjs";
import "./add2e/02b-spell-sync-dedupe.mjs";
import "./add2e/03-equipment-rules.mjs";
import "./add2e/04-class-active-abilities.mjs";
import "./add2e/object-magic-powers.mjs";
import "./add2e/06-class-effects-thief.mjs";
import "./add2e/07-spellcasting-rules.mjs";
import "./add2e/09-race-class-drop.mjs";
import "./add2e/10-monk-rules.mjs";
import "./add2e/11-character-data-prep.mjs";
import "./add2e/12-carac-roller.mjs";
import "./add2e/13-actor-sheet-legacy.mjs";
import "./add2e/14-item-sheets.mjs";
import "./add2e/15-validation-sockets.mjs";
import "./add2e/16-preparation-display.mjs";
import "./add2e/17-movement-xp.mjs";
import "./add2e/17b-multiclass.mjs";
import "./add2e/17c-multiclass-mechanics.mjs";
import "./add2e/18-token-state-overlay.mjs";
import "./add2e/20-session-xp.mjs";
import "./add2e/21-consumables.mjs";

const ADD2E_DIALOG_V2_ALERT_FALLBACK_VERSION = "2026-05-26-dialog-v2-alert-fallback-v1";
globalThis.ADD2E_DIALOG_V2_ALERT_FALLBACK_VERSION = ADD2E_DIALOG_V2_ALERT_FALLBACK_VERSION;

function add2eInstallDialogV2AlertFallback() {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2 || typeof DialogV2.alert === "function" || typeof DialogV2.confirm !== "function") return false;

  DialogV2.alert = async function add2eDialogV2AlertFallback({ window = {}, content = "", ok = {}, modal = true } = {}) {
    return DialogV2.confirm({
      window,
      content,
      yes: { label: ok?.label || "Compris" },
      no: { label: "Fermer" },
      modal
    });
  };

  game.add2e = game.add2e ?? {};
  game.add2e.dialogV2AlertFallbackVersion = ADD2E_DIALOG_V2_ALERT_FALLBACK_VERSION;
  console.log("[ADD2E][DIALOG_V2][ALERT_FALLBACK]", ADD2E_DIALOG_V2_ALERT_FALLBACK_VERSION);
  return true;
}

Hooks.once("init", () => add2eInstallDialogV2AlertFallback());
Hooks.once("ready", () => add2eInstallDialogV2AlertFallback());

const ADD2E_VENDOR_PROJECTILE_GM_RELAY_VERSION = "2026-05-29-vendor-projectile-personnages-only-v2";
globalThis.ADD2E_VENDOR_PROJECTILE_GM_RELAY_VERSION = ADD2E_VENDOR_PROJECTILE_GM_RELAY_VERSION;

const ADD2E_PROJECTILE_GM_CONSUME_FIX_VERSION = "2026-05-29-projectile-consume-personnages-only-v2";
globalThis.ADD2E_PROJECTILE_GM_CONSUME_FIX_VERSION = ADD2E_PROJECTILE_GM_CONSUME_FIX_VERSION;

function add2eVendorProjectileIsResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id || !game.users?.activeGM;
}

function add2eVendorProjectileRequestSet() {
  const set = globalThis.__ADD2E_VENDOR_PROJECTILE_GM_RELAY_REQUESTS ?? new Set();
  globalThis.__ADD2E_VENDOR_PROJECTILE_GM_RELAY_REQUESTS = set;
  return set;
}

function add2eProjectileFixQuantity(item) {
  const n = Number(item?.system?.quantite ?? item?.system?.quantity ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function add2eProjectileFixAmmoType(item) {
  const sys = item?.system ?? {};
  return String(sys.munitionType ?? sys.munition_type ?? sys.sousType ?? sys.sous_type ?? sys.categorie ?? item?.name ?? "");
}

function add2eProjectileNormalizeType(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function add2eProjectileActorType(actor, payload = {}) {
  const candidates = [
    actor?.type,
    actor?._source?.type,
    actor?.baseActor?.type,
    actor?.document?.type,
    payload.actorType,
    payload.type
  ];
  for (const candidate of candidates) {
    const type = add2eProjectileNormalizeType(candidate);
    if (type) return type;
  }
  return "";
}

function add2eProjectileActorUsesInventory(actor, payload = {}) {
  return add2eProjectileActorType(actor, payload) === "personnage";
}

async function add2eGmRelayConsumeProjectile(payload = {}) {
  if (!add2eVendorProjectileIsResponsibleGM()) return false;

  let actor = null;
  if (payload.actorUuid) {
    try { actor = await fromUuid(payload.actorUuid); }
    catch (err) { console.warn("[ADD2E][GM-RELAY][consumeProjectile][UUID_ERROR]", payload.actorUuid, err); }
  }
  if (!actor && payload.actorId) actor = game.actors?.get?.(payload.actorId) ?? null;

  if (!actor) {
    console.warn("[ADD2E][GM-RELAY][consumeProjectile] acteur introuvable :", payload);
    return false;
  }

  if (!add2eProjectileActorUsesInventory(actor, payload)) {
    console.log("[ADD2E][GM-RELAY][consumeProjectile][SKIP_NON_PERSONNAGE]", { actor: actor.name, type: add2eProjectileActorType(actor, payload), payload });
    return false;
  }

  const item = actor.items?.get?.(payload.itemId) ?? null;
  if (!item) {
    console.warn("[ADD2E][GM-RELAY][consumeProjectile] projectile introuvable :", {
      actor: actor.name,
      itemId: payload.itemId,
      itemName: payload.itemName
    });
    return false;
  }

  const quantity = Math.max(1, Math.floor(Number(payload.quantity) || 1));
  const before = add2eProjectileFixQuantity(item);
  const after = Math.max(0, before - quantity);

  await item.update({ "system.quantite": after }, { add2eReason: "gm-relay-consume-projectile" });

  if (game.combat?.setFlag) {
    const registry = foundry.utils.deepClone(game.combat.getFlag("add2e", "projectilesDepenses") ?? {});
    const key = `${actor.id}.${item.id}`;
    registry[key] ??= {
      actorId: actor.id,
      actorName: actor.name,
      itemId: item.id,
      itemName: item.name,
      ammunitionType: add2eProjectileFixAmmoType(item),
      spent: 0,
      restoreRate: item.system?.recuperable === false ? 0 : Number(item.system?.taux_recuperation ?? 0.6),
      recoverable: item.system?.recuperable !== false
    };
    registry[key].spent = Number(registry[key].spent ?? 0) + quantity;
    registry[key].restoreRate = item.system?.recuperable === false ? 0 : Number(item.system?.taux_recuperation ?? 0.6);
    registry[key].recoverable = item.system?.recuperable !== false;
    await game.combat.setFlag("add2e", "projectilesDepenses", registry);
  }

  console.log("[ADD2E][GM-RELAY][consumeProjectile] OK", {
    actor: actor.name,
    projectile: item.name,
    before,
    after,
    quantity,
    requestId: payload.requestId ?? null
  });

  return true;
}

async function add2eVendorRecordProjectileSpent(payload = {}) {
  if (!add2eVendorProjectileIsResponsibleGM()) return false;
  const combat = game.combats?.get?.(payload.combatId) ?? game.combat;
  if (!combat?.getFlag || !combat?.setFlag || !payload.actorId) return false;

  const actor = payload.actorUuid ? await fromUuid(payload.actorUuid).catch(() => null) : game.actors?.get?.(payload.actorId) ?? null;
  if (!add2eProjectileActorUsesInventory(actor, payload)) {
    console.log("[ADD2E][GM-RELAY][vendorRecordProjectileSpent][SKIP_NON_PERSONNAGE]", { actor: actor?.name ?? payload.actorName, type: add2eProjectileActorType(actor, payload), payload });
    return false;
  }

  const key = payload.itemId || payload.itemName;
  if (!key) return false;

  const requestId = payload.requestId ?? null;
  const seen = add2eVendorProjectileRequestSet();
  if (requestId && seen.has(requestId)) return true;

  const current = foundry.utils.deepClone(await combat.getFlag("add2e", "projectilesDepensesCombat") ?? {});
  current[payload.actorId] ??= {
    actorId: payload.actorId,
    actorName: payload.actorName ?? actor?.name ?? "Acteur",
    items: {}
  };
  current[payload.actorId].actorName = payload.actorName ?? actor?.name ?? current[payload.actorId].actorName;
  current[payload.actorId].items[key] ??= {
    itemId: payload.itemId ?? null,
    itemName: payload.itemName ?? "Projectile",
    img: payload.img ?? null,
    spent: 0
  };

  const entry = current[payload.actorId].items[key];
  entry.itemId = payload.itemId ?? entry.itemId ?? null;
  entry.itemName = payload.itemName ?? entry.itemName ?? "Projectile";
  entry.img = payload.img ?? entry.img ?? null;
  entry.spent = Number(entry.spent ?? 0) + Math.max(1, Math.floor(Number(payload.quantity) || 1));

  await combat.setFlag("add2e", "projectilesDepensesCombat", current);
  return true;
}

Hooks.once("ready", () => {
  const handler = async payload => {
    if (payload?.type === "ADD2E_GM_OPERATION" && payload.operation === "vendorConsumeProjectile") return add2eGmRelayConsumeProjectile(payload.payload ?? {});
    if (payload?.type === "ADD2E_GM_OPERATION" && payload.operation === "vendorRecordProjectileSpent") return add2eVendorRecordProjectileSpent(payload.payload ?? {});
    return false;
  };
  game.socket?.on?.("system.add2e", handler);
});

const ADD2E_MULTICLASS_PLAYER_DIALOG_VERSION = "2026-06-11-v1-player-tiles";
globalThis.ADD2E_MULTICLASS_PLAYER_DIALOG_VERSION = ADD2E_MULTICLASS_PLAYER_DIALOG_VERSION;

function add2eMulticlassPlayerDialogButton(appRoot, action) {
  const buttons = Array.from(appRoot?.querySelectorAll?.("button") ?? []);
  const test = (button, words) => {
    const text = String(button.textContent ?? "").trim().toLowerCase();
    const data = String(button.dataset?.action ?? button.dataset?.button ?? button.getAttribute("data-action") ?? "").toLowerCase();
    return words.some(word => text.includes(word) || data.includes(word));
  };
  if (action === "multiclass") return buttons.find(button => test(button, ["multiclass", "appliquer", "actualiser", "resynchroniser", "recalculer"]));
  if (action === "replace") return buttons.find(button => test(button, ["replace-class", "remplacer la classe", "classe sélectionnée", "selectionnee"]));
  if (action === "mono") return buttons.find(button => test(button, ["monoclass", "mono-classe", "mono"]));
  return buttons.find(button => test(button, ["cancel", "annuler"]));
}

function add2eStyleMulticlassDialogElement(element, styles = {}) {
  if (!element) return;
  Object.assign(element.style, styles);
}

function add2eBuildMulticlassTile({ title, subtitle, note, tone, onChoose }) {
  const palette = {
    add: { bg: "linear-gradient(135deg,#f6e7a8,#d7a94d)", border: "#8a611d", icon: "✦", color: "#2b1c0d" },
    replace: { bg: "linear-gradient(135deg,#f3d4a0,#b66b2f)", border: "#8f4a18", icon: "↻", color: "#2b1c0d" },
    mono: { bg: "linear-gradient(135deg,#ded1ad,#9b8561)", border: "#5f4927", icon: "◆", color: "#24190c" },
    cancel: { bg: "linear-gradient(135deg,#ead0c7,#a64536)", border: "#7a251d", icon: "×", color: "#2b0f0b" }
  }[tone] ?? { bg: "#f6e7a8", border: "#8a611d", icon: "•", color: "#2b1c0d" };
  const tile = document.createElement("button");
  tile.type = "button";
  tile.innerHTML = `
    <span style="font-size:1.7rem;line-height:1;">${palette.icon}</span>
    <span style="display:grid;gap:3px;text-align:left;">
      <strong style="font-size:1.05rem;">${title}</strong>
      <span style="font-size:.9rem;line-height:1.25;">${subtitle}</span>
      ${note ? `<span style="font-size:.78rem;opacity:.82;line-height:1.2;">${note}</span>` : ""}
    </span>`;
  add2eStyleMulticlassDialogElement(tile, {
    display: "grid",
    gridTemplateColumns: "38px 1fr",
    gap: "10px",
    width: "100%",
    minHeight: "86px",
    padding: "12px",
    border: `2px solid ${palette.border}`,
    borderRadius: "14px",
    background: palette.bg,
    color: palette.color,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,.18), inset 0 0 0 1px rgba(255,255,255,.45)",
    fontWeight: "700",
    whiteSpace: "normal"
  });
  tile.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    onChoose?.();
  });
  return tile;
}

function add2eEnhanceMulticlassChoiceDialog(root = document) {
  const base = root?.querySelector?.(".add2e-multiclass-choice") ?? null;
  if (!base || base.dataset.add2ePlayerDialogVersion === ADD2E_MULTICLASS_PLAYER_DIALOG_VERSION) return;
  base.dataset.add2ePlayerDialogVersion = ADD2E_MULTICLASS_PLAYER_DIALOG_VERSION;

  const appRoot = base.closest(".application,.window-app,.app,.dialog") ?? base.parentElement;
  const contentRoot = base.closest(".window-content,.dialog-content") ?? base.parentElement;
  const multiclassSelect = base.querySelector('[name="multiclassChoice"]');
  const replacementSelect = base.querySelector('[name="replacementChoice"]');

  add2eStyleMulticlassDialogElement(appRoot, { minWidth: "720px", maxWidth: "860px" });
  add2eStyleMulticlassDialogElement(contentRoot, { background: "linear-gradient(180deg,#fff8df,#ead9af)", padding: "14px" });
  add2eStyleMulticlassDialogElement(base, { display: "grid", gap: "12px", minWidth: "620px", color: "#2b1c0d" });

  const title = base.querySelector(".a2e-mc-title");
  if (title) {
    title.innerHTML = `<h2 style="margin:0;color:#f9df9a;font-size:1.16rem;text-transform:uppercase;letter-spacing:.03em;">Choisis ton évolution</h2><p style="margin:4px 0 0;color:#e8c978;">Sélectionne une option claire pour cette nouvelle classe.</p>`;
    add2eStyleMulticlassDialogElement(title, { border: "1px solid #5c3b12", borderRadius: "14px", background: "linear-gradient(180deg,#3b2612,#1c1208)", padding: "12px 14px", boxShadow: "inset 0 0 0 1px rgba(255,221,145,.16),0 2px 8px rgba(0,0,0,.25)" });
  }

  const cards = Array.from(base.querySelectorAll(".a2e-mc-card"));
  const labels = ["Classe actuelle", "Classe déposée", "Race actuelle"];
  cards.forEach((card, index) => {
    const label = card.querySelector("label");
    const value = card.querySelector("b");
    if (label) label.textContent = labels[index] ?? label.textContent;
    add2eStyleMulticlassDialogElement(card, { border: "1px solid #b48a37", borderRadius: "12px", background: "linear-gradient(180deg,#fff7df,#ead7a7)", padding: "10px", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.5)" });
    add2eStyleMulticlassDialogElement(label, { display: "block", marginBottom: "4px", color: "#65420f", fontSize: ".74rem", fontWeight: "900", textTransform: "uppercase", letterSpacing: ".06em" });
    add2eStyleMulticlassDialogElement(value, { display: "block", color: "#2b1c0d", fontSize: "1.04rem" });
  });
  const grid = base.querySelector(".a2e-mc-grid");
  add2eStyleMulticlassDialogElement(grid, { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "8px" });

  base.querySelector(".a2e-mc-note")?.remove();
  base.querySelectorAll(".a2e-mc-panel").forEach(panel => panel.style.display = "none");
  base.querySelectorAll(".a2e-mc-warning,.a2e-mc-info").forEach(block => block.remove());

  const tileWrap = document.createElement("div");
  add2eStyleMulticlassDialogElement(tileWrap, { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "10px" });

  const choose = (action, index = null) => {
    if (action === "multiclass" && multiclassSelect && index !== null) multiclassSelect.value = String(index);
    if (action === "replace" && replacementSelect && index !== null) replacementSelect.value = String(index);
    const button = add2eMulticlassPlayerDialogButton(appRoot, action);
    button?.click?.();
  };

  if (multiclassSelect?.options?.length) {
    Array.from(multiclassSelect.options).forEach((option, index) => {
      const already = String(option.textContent ?? "").toLowerCase().includes("déjà présente");
      tileWrap.appendChild(add2eBuildMulticlassTile({
        title: already ? "Actualiser le multiclassage" : "Ajouter cette classe",
        subtitle: String(option.textContent ?? "").replace(/—/g, "•"),
        note: already ? "Remet les niveaux, titres et sorts en cohérence." : "Ajoute la classe sans perdre les autres.",
        tone: "add",
        onChoose: () => choose("multiclass", index)
      }));
    });
  }

  if (replacementSelect?.options?.length) {
    Array.from(replacementSelect.options).forEach((option, index) => {
      tileWrap.appendChild(add2eBuildMulticlassTile({
        title: "Remplacer une classe",
        subtitle: String(option.textContent ?? "").replace(/—/g, "•"),
        note: "Garde le personnage multiclassé avec une autre combinaison.",
        tone: "replace",
        onChoose: () => choose("replace", index)
      }));
    });
  }

  tileWrap.appendChild(add2eBuildMulticlassTile({
    title: "Garder une seule classe",
    subtitle: "Remplacer tout le parcours actuel par la classe déposée.",
    note: "À utiliser pour repartir sur une classe unique.",
    tone: "mono",
    onChoose: () => choose("mono")
  }));

  const intro = document.createElement("div");
  intro.textContent = "Choisis une tuile : l'action s'applique immédiatement.";
  add2eStyleMulticlassDialogElement(intro, { padding: "9px 11px", borderRadius: "10px", background: "#f2e1b5", borderLeft: "5px solid #c99a3a", color: "#5d451b", fontWeight: "800" });
  base.appendChild(intro);
  base.appendChild(tileWrap);

  const buttonBar = appRoot?.querySelector?.(".dialog-buttons,.form-footer,footer") ?? null;
  if (buttonBar) {
    add2eStyleMulticlassDialogElement(buttonBar, { display: "flex", justifyContent: "flex-end", gap: "10px", padding: "0 14px 14px" });
    Array.from(buttonBar.querySelectorAll("button")).forEach(button => {
      const text = String(button.textContent ?? "").toLowerCase();
      const isCancel = text.includes("annuler") || String(button.dataset?.action ?? "").includes("cancel");
      if (!isCancel) button.style.display = "none";
      else {
        button.textContent = "Fermer";
        add2eStyleMulticlassDialogElement(button, { minHeight: "36px", minWidth: "140px", borderRadius: "10px", border: "1px solid #7a251d", background: "linear-gradient(180deg,#a64536,#6d1c16)", color: "#fff1e8", fontWeight: "900" });
      }
    });
  }
}

Hooks.on("renderApplication", (app, html) => {
  const root = html?.[0] ?? html ?? app?.element?.[0] ?? app?.element ?? document;
  add2eEnhanceMulticlassChoiceDialog(root);
  setTimeout(() => add2eEnhanceMulticlassChoiceDialog(app?.element?.[0] ?? app?.element ?? document), 0);
  setTimeout(() => add2eEnhanceMulticlassChoiceDialog(document), 50);
});
