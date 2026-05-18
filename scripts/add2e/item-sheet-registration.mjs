// scripts/add2e/item-sheet-registration.mjs
// ADD2E — Enregistrement strict des fiches d'items spécialisées.

// 1. IMPORT (Obligatoire tout en haut)
import { Add2eItemSheet } from "../add2e-item-sheet.mjs";
globalThis.Add2eItemSheet = Add2eItemSheet;

// 2. INITIALISATION (enregistrement strict des fiches)
export function add2eRegisterClassItemSheet() {
  const options = {
    types: ["classe"],
    makeDefault: true,
    canConfigure: true,
    canBeDefault: true,
    label: "ADD2E | Fiche Classe"
  };

  // API historique encore disponible en Foundry v13.
  // Important : cette fiche est limitée au type Item "classe".
  Items.registerSheet("add2e", Add2eItemSheet, options);

  // API DocumentSheetConfig : double sécurité pour forcer Item.classe
  // sur la fiche de classe, et jamais sur la fiche acteur.
  const DSC = globalThis.DocumentSheetConfig ?? foundry?.applications?.apps?.DocumentSheetConfig;
  if (DSC?.registerSheet) {
    try {
      DSC.registerSheet(Item, "add2e", Add2eItemSheet, options);
    } catch (e) {
      // En v13, Items.registerSheet suffit. Ce fallback ne doit pas bloquer.
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