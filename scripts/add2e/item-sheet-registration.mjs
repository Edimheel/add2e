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

function add2eDefaultCharacterSightRange() {
  const gridDistance = Number(
    canvas?.scene?.grid?.distance
      ?? game?.scenes?.active?.grid?.distance
      ?? 1
  );
  return Number.isFinite(gridDistance) && gridDistance > 0 ? gridDistance * 5 : 5;
}

// Foundry fournit actorLink et la vision du prototype, mais ne choisit pas
// leurs valeurs selon les types ADD2E. Elles sont donc fixées à la création.
Hooks.on("preCreateActor", (actor, data = {}) => {
  const type = String(actor?.type ?? data?.type ?? "").trim().toLowerCase();
  const actorLink = add2eDefaultActorTokenLink(actor, data);
  if (actorLink === null) return;

  const prototypeToken = { actorLink };
  if (type === "personnage") {
    prototypeToken.sight = {
      enabled: true,
      angle: 270,
      range: add2eDefaultCharacterSightRange()
    };
  }

  actor.updateSource({ prototypeToken });
});

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