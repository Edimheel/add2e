// scripts/add2e/item-sheet-registration.mjs
// ADD2E — Enregistrement strict des fiches d'items spécialisées.

// 1. IMPORT (Obligatoire tout en haut)
import { Add2eItemSheet } from "../add2e-item-sheet.mjs";
globalThis.Add2eItemSheet = Add2eItemSheet;

function add2eItemsCollection() {
  return foundry?.documents?.collections?.Items ?? globalThis.Items;
}

function add2eItemDocumentClass() {
  return foundry?.documents?.Item ?? globalThis.Item;
}

function add2eDefaultActorTokenLink(actor, data = {}) {
  const type = String(actor?.type ?? data?.type ?? "").trim().toLowerCase();
  if (type === "personnage") return true;
  if (type === "monstre" || type === "monster") return false;
  return null;
}

// Foundry fournit actorLink, mais ne choisit pas sa valeur selon les types ADD2E.
// La valeur est donc fixée sur le prototype au moment de la création de l'acteur.
Hooks.on("preCreateActor", (actor, data = {}) => {
  const actorLink = add2eDefaultActorTokenLink(actor, data);
  if (actorLink === null) return;

  actor.updateSource({
    prototypeToken: {
      actorLink
    }
  });
});

function add2eIsJoinPage() {
  const body = document.body;
  return body?.classList?.contains("join-game")
    || body?.dataset?.application === "join"
    || !!document.querySelector("#join-game, form#join-game");
}

function add2eInstallJoinPageModernization() {
  if (!add2eIsJoinPage()) return;
  if (globalThis.__ADD2E_JOIN_PAGE_MODERNIZED_V1__) return;
  globalThis.__ADD2E_JOIN_PAGE_MODERNIZED_V1__ = true;

  const style = document.createElement("style");
  style.id = "add2e-join-page-modern-style";
  style.textContent = `
    body.join-game {
      --add2e-join-panel-bg: rgba(9, 12, 26, 0.76);
      --add2e-join-panel-border: rgba(211, 148, 49, 0.42);
      --add2e-join-panel-shadow: 0 18px 60px rgba(0, 0, 0, 0.44);
      --add2e-join-text: #f3ead8;
      --add2e-join-muted: rgba(243, 234, 216, 0.78);
      --add2e-join-button-bg: linear-gradient(135deg, #df8f20 0%, #f4b454 100%);
      --add2e-join-button-text: #1d1408;
    }

    body.join-game #join-game,
    body.join-game .join-game {
      width: min(430px, calc(100vw - 32px));
      max-width: min(430px, calc(100vw - 32px));
      margin: 0;
    }

    body.join-game #join-game .app,
    body.join-game .join-game .app,
    body.join-game #join-game > section,
    body.join-game .join-game > section {
      background: transparent;
      box-shadow: none;
      border: 0;
    }

    body.join-game #join-game {
      position: fixed;
      left: 24px;
      bottom: 24px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      z-index: 25;
    }

    body.join-game #join-game .app,
    body.join-game #join-game > section,
    body.join-game .join-game > section,
    body.join-game .join-game .app {
      background: var(--add2e-join-panel-bg);
      border: 1px solid var(--add2e-join-panel-border);
      border-radius: 18px;
      box-shadow: var(--add2e-join-panel-shadow);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      color: var(--add2e-join-text);
      padding: 16px 18px;
    }

    body.join-game #join-game .app h1,
    body.join-game #join-game .app h2,
    body.join-game #join-game > section h1,
    body.join-game #join-game > section h2,
    body.join-game #join-game .app .header,
    body.join-game #join-game > section .header {
      margin: 0 0 10px;
    }

    body.join-game #join-game .app h1,
    body.join-game #join-game .app h2,
    body.join-game #join-game > section h1,
    body.join-game #join-game > section h2 {
      font-size: 2rem;
      line-height: 1.1;
    }

    body.join-game #join-game .app .notes,
    body.join-game #join-game .app .details,
    body.join-game #join-game > section .notes,
    body.join-game #join-game > section .details {
      color: var(--add2e-join-muted);
    }

    body.join-game #join-game .app form,
    body.join-game #join-game > section form {
      margin: 0;
    }

    body.join-game #join-game input,
    body.join-game #join-game select,
    body.join-game #join-game textarea,
    body.join-game #join-game button {
      border-radius: 12px;
    }

    body.join-game #join-game button[type="submit"],
    body.join-game #join-game .join-btn,
    body.join-game #join-game [data-action="join"],
    body.join-game #join-game .form-footer button {
      background: var(--add2e-join-button-bg);
      color: var(--add2e-join-button-text);
      border: 0;
      box-shadow: none;
      font-weight: 700;
    }

    body.join-game #join-game .add2e-login-panel {
      padding-bottom: 18px;
    }

    body.join-game #join-game .add2e-login-panel .add2e-login-body {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    body.join-game #join-game .add2e-login-panel .add2e-login-body .add2e-world-description {
      font-size: 0.95rem;
      line-height: 1.45;
      color: var(--add2e-join-muted);
      max-height: 9.5em;
      overflow: auto;
      padding-right: 4px;
    }

    body.join-game #join-game .add2e-world-details-panel,
    body.join-game #join-game .add2e-hidden-session-panel {
      display: none !important;
    }

    body.join-game #join-game .add2e-home-panel {
      padding-top: 14px;
      padding-bottom: 14px;
    }

    body.join-game #join-game .add2e-home-panel p {
      display: none;
    }

    body.join-game #join-game .add2e-home-panel button,
    body.join-game #join-game .add2e-home-panel .button {
      width: 100%;
    }

    @media (max-width: 740px) {
      body.join-game #join-game {
        left: 16px;
        right: 16px;
        bottom: 16px;
        width: auto;
        max-width: none;
      }

      body.join-game #join-game,
      body.join-game #join-game .app,
      body.join-game #join-game > section {
        width: auto;
        max-width: none;
      }
    }
  `;
  document.head.append(style);

  const sections = [...document.querySelectorAll("#join-game > section, #join-game > .app, .join-game > section, .join-game > .app")]
    .filter(section => !section.classList.contains("add2e-login-panel") && !section.classList.contains("add2e-home-panel"));

  const loginPanel = sections.find(section => {
    const text = String(section.textContent ?? "").toLowerCase();
    return !!section.querySelector('form, input[type="password"], select[name="userid"], select[name="user"]')
      || text.includes("rejoindre la partie")
      || text.includes("join game");
  }) ?? document.querySelector("#join-game .app, #join-game > section, .join-game .app, .join-game > section");

  if (!loginPanel) return;
  loginPanel.classList.add("add2e-login-panel");

  const descriptionPanel = sections.find(section => {
    const text = String(section.textContent ?? "").toLowerCase();
    return text.includes("description du monde") || text.includes("world description");
  }) ?? null;

  const homePanel = sections.find(section => {
    const text = String(section.textContent ?? "").toLowerCase();
    return text.includes("retour à l’accueil")
      || text.includes("retour a l'accueil")
      || text.includes("return to setup")
      || text.includes("back to setup")
      || text.includes("retour à l'accueil");
  }) ?? null;

  const detailsPanel = sections.find(section => {
    const text = String(section.textContent ?? "").toLowerCase();
    return text.includes("détails de la session")
      || text.includes("details de la session")
      || text.includes("session details");
  }) ?? null;

  if (detailsPanel) detailsPanel.classList.add("add2e-hidden-session-panel");
  if (homePanel) homePanel.classList.add("add2e-home-panel");
  if (descriptionPanel) descriptionPanel.classList.add("add2e-world-details-panel");

  const loginForm = loginPanel.querySelector("form") ?? null;
  const loginBody = document.createElement("div");
  loginBody.className = "add2e-login-body";

  if (loginForm) loginForm.parentElement?.insertBefore(loginBody, loginForm.nextSibling);
  else loginPanel.append(loginBody);

  if (descriptionPanel) {
    const title = descriptionPanel.querySelector("h1, h2, header, .header")?.textContent?.trim() || "Description du monde";
    const descriptionContent = document.createElement("div");
    descriptionContent.className = "add2e-world-description";
    descriptionContent.innerHTML = `
      <details open>
        <summary>${title}</summary>
        <div class="add2e-world-description-content"></div>
      </details>
    `;
    const contentTarget = descriptionContent.querySelector(".add2e-world-description-content");
    const clone = document.createElement("div");

    for (const child of [...descriptionPanel.children]) {
      const isHeader = child.matches?.("h1, h2, header, .header");
      if (!isHeader) clone.append(child.cloneNode(true));
    }
    if (!clone.childNodes.length) clone.textContent = String(descriptionPanel.textContent ?? "").trim();
    contentTarget?.append(clone);
    loginBody.append(descriptionContent);
  }

  if (homePanel) loginBody.append(homePanel);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", add2eInstallJoinPageModernization, { once: true });
} else {
  add2eInstallJoinPageModernization();
}

// 2. INITIALISATION (enregistrement strict des fiches)
export function add2eRegisterClassItemSheet() {
  const options = {
    types: ["classe"],
    makeDefault: true,
    canConfigure: true,
    canBeDefault: true,
    label: "ADD2E | Fiche Classe"
  };

  // Foundry v13 : éviter le global déprécié Items.
  // Fallback conservé uniquement pour compatibilité si le namespace v13 n'existe pas.
  const ItemsCollection = add2eItemsCollection();
  if (ItemsCollection?.registerSheet) {
    ItemsCollection.registerSheet("add2e", Add2eItemSheet, options);
  } else {
    console.warn("[ADD2E][SHEETS] Collection Items introuvable : fiche classe non enregistrée.");
  }

  // API DocumentSheetConfig : double sécurité pour forcer Item.classe
  // sur la fiche de classe, et jamais sur la fiche acteur.
  const DSC = globalThis.DocumentSheetConfig ?? foundry?.applications?.apps?.DocumentSheetConfig;
  const ItemDocument = add2eItemDocumentClass();
  if (DSC?.registerSheet && ItemDocument) {
    try {
      DSC.registerSheet(ItemDocument, "add2e", Add2eItemSheet, options);
    } catch (e) {
      // En v13, ItemsCollection.registerSheet suffit. Ce fallback ne doit pas bloquer.
      console.warn("[ADD2E][SHEETS] DocumentSheetConfig classe non appliqué, fallback Items.registerSheet conservé.", e);
    }
  }

  console.log("[ADD2E][SHEETS] Fiche Item.classe enregistrée :", Add2eItemSheet?.name);
}

globalThis.add2eRegisterClassItemSheet = add2eRegisterClassItemSheet;

Hooks.once("init", function() {
  console.log("ADD2e | Initialisation du système...");

  // IMPORTANT : Add2eItemSheet est réservée au type d'item classe.
  // Ne pas désenregistrer la feuille core globale, sinon les autres types
  // ou les réglages de feuille peuvent basculer sur une mauvaise fiche.
  add2eRegisterClassItemSheet();
});