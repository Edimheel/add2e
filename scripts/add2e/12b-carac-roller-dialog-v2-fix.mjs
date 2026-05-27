// ============================================================
// ADD2E — Correctif DialogV2 pour le roller de caractéristiques
// Foundry V13 impose au moins un bouton dans DialogV2.config.buttons.
// Le roller affiche ses propres boutons dans son contenu ; ce patch injecte
// un bouton technique uniquement pour satisfaire DialogV2.
// ============================================================

const ADD2E_CARAC_ROLLER_DIALOG_V2_FIX_VERSION = "2026-05-27-carac-roller-dialog-v2-buttons-fix-v1";

globalThis.ADD2E_CARAC_ROLLER_DIALOG_V2_FIX_VERSION = ADD2E_CARAC_ROLLER_DIALOG_V2_FIX_VERSION;

function add2ePatchCaracRollerDialogV2() {
  const api = foundry?.applications?.api;
  const OriginalDialogV2 = api?.DialogV2;
  if (!api || !OriginalDialogV2) return false;
  if (OriginalDialogV2.__add2eCaracRollerButtonsFix) return true;

  class Add2eDialogV2WithCaracRollerFix extends OriginalDialogV2 {
    constructor(config = {}, options = {}) {
      const isCaracRoller = typeof config?.content === "string" && config.content.includes("data-add2e-carac-roller");
      const hasButtons = Array.isArray(config?.buttons) && config.buttons.length > 0;

      if (isCaracRoller && !hasButtons) {
        config = {
          ...config,
          buttons: [
            {
              action: "add2e-technical-cancel",
              label: "Annuler",
              default: true,
              callback: () => undefined
            }
          ]
        };
      }

      super(config, options);
    }
  }

  Object.defineProperty(Add2eDialogV2WithCaracRollerFix, "__add2eCaracRollerButtonsFix", {
    value: true,
    configurable: false
  });

  try {
    api.DialogV2 = Add2eDialogV2WithCaracRollerFix;
  } catch (err) {
    console.error("[ADD2E][CARAC_ROLLER][DIALOG_V2_FIX] Impossible de patcher DialogV2", err);
    return false;
  }

  console.log("[ADD2E][CARAC_ROLLER][DIALOG_V2_FIX]", ADD2E_CARAC_ROLLER_DIALOG_V2_FIX_VERSION);
  return true;
}

Hooks.once("init", () => add2ePatchCaracRollerDialogV2());
Hooks.once("ready", () => add2ePatchCaracRollerDialogV2());
