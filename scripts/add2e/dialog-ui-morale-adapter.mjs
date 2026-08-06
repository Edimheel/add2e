// ADD2E — Adaptateur de transition pour la fenêtre de moral des monstres.
// Compatible Foundry V13/V14/V15 — DialogV2 / ApplicationV2 uniquement.

const ADD2E_MORALE_DIALOG_ADAPTER_VERSION = "2026-08-06-morale-dialog-adapter-v1";
globalThis.ADD2E_MORALE_DIALOG_ADAPTER_VERSION = ADD2E_MORALE_DIALOG_ADAPTER_VERSION;

function isMonsterMoraleDialog(options = {}) {
  return String(options?.content ?? "").includes("add2e-monster-morale-form");
}

function installMonsterMoraleDialogAdapter() {
  if (globalThis.__ADD2E_MORALE_DIALOG_ADAPTER_INSTALLED__ === true) return true;

  const DialogV2 = foundry.applications?.api?.DialogV2;
  const dialogApi = globalThis.ADD2E_DIALOG_UI;
  if (typeof DialogV2?.wait !== "function" || typeof dialogApi?.prepareOptions !== "function") return false;

  const nativeWait = DialogV2.wait.bind(DialogV2);

  const add2eWait = (options = {}, ...rest) => nativeWait(dialogApi.prepareOptions(options), ...rest);
  globalThis.add2eDialogWait = add2eWait;

  const wrappedWait = (options = {}, ...rest) => {
    if (!isMonsterMoraleDialog(options)) return nativeWait(options, ...rest);

    return add2eWait({
      ...options,
      add2eTheme: "monster",
      add2ePrimaryAction: "roll",
      add2eClasses: [
        ...(Array.isArray(options?.window?.classes) ? options.window.classes : []),
        "add2e-monster-morale-window"
      ]
    }, ...rest);
  };

  wrappedWait.__add2eMoraleDialogAdapter = true;
  wrappedWait.__add2eOriginalWait = nativeWait;
  DialogV2.wait = wrappedWait;

  globalThis.__ADD2E_MORALE_DIALOG_ADAPTER_INSTALLED__ = true;
  return true;
}

Hooks.once("init", installMonsterMoraleDialogAdapter);
Hooks.once("ready", installMonsterMoraleDialogAdapter);
installMonsterMoraleDialogAdapter();

console.log("[ADD2E][MORALE_DIALOG_ADAPTER][VERSION]", ADD2E_MORALE_DIALOG_ADAPTER_VERSION);
