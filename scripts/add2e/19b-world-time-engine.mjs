// ============================================================================
// ADD2E — Gestion du temps hors combat : façade de compatibilité.
// Compatible Foundry V13/V14/V15.
// ============================================================================
import { add2eRegisterTimeEngineApi, add2eTimeCurrentTick } from "./19a-time-engine.mjs";
import {
  ADD2E_WORLD_TIME_PERIODIC_SAVE_VERSION,
  add2eRegisterWorldTimePeriodicSaveHook,
  add2eScheduleWorldTimePeriodicSaveProcessing,
  add2eWorldTimeProcessPeriodicSaves
} from "./19b1-world-time-periodic-saves.mjs";
import {
  add2eWorldTimeAdvance,
  add2eWorldTimeExpireAllActors
} from "./19b2-world-time-core.mjs";
import {
  ADD2EWorldTimeApplication,
  add2eInstallWorldTimeSceneButton,
  add2eOpenWorldTimeApplication,
  add2eRegisterWorldTimeUi
} from "./19b3-world-time-ui.mjs";

export const ADD2E_WORLD_TIME_ENGINE_VERSION = "2026-07-07-world-time-split-v5";

const TAG = "[ADD2E][WORLD_TIME]";

function log(label, data = {}) {
  console.log(`${TAG}${label}`, data);
}

export {
  ADD2E_WORLD_TIME_PERIODIC_SAVE_VERSION,
  ADD2EWorldTimeApplication,
  add2eInstallWorldTimeSceneButton,
  add2eOpenWorldTimeApplication,
  add2eWorldTimeAdvance,
  add2eWorldTimeExpireAllActors,
  add2eWorldTimeProcessPeriodicSaves
};

add2eRegisterWorldTimeUi();
add2eRegisterWorldTimePeriodicSaveHook();
globalThis.add2eInstallWorldTimeSceneButton = add2eInstallWorldTimeSceneButton;

export function add2eRegisterWorldTimeEngine() {
  add2eRegisterTimeEngineApi();

  game.add2e = game.add2e ?? {};
  game.add2e.time = game.add2e.time ?? {};
  game.add2e.time.worldVersion = ADD2E_WORLD_TIME_ENGINE_VERSION;
  game.add2e.time.advance = add2eWorldTimeAdvance;
  game.add2e.time.expireAll = add2eWorldTimeExpireAllActors;
  game.add2e.time.processPeriodicSaves = add2eWorldTimeProcessPeriodicSaves;
  game.add2e.time.open = add2eOpenWorldTimeApplication;

  globalThis.ADD2E_WORLD_TIME_ENGINE_VERSION = ADD2E_WORLD_TIME_ENGINE_VERSION;
  globalThis.ADD2E_PERIODIC_SAVE_VERSION = ADD2E_WORLD_TIME_PERIODIC_SAVE_VERSION;
  globalThis.ADD2EWorldTimeApplication = ADD2EWorldTimeApplication;
  globalThis.add2eWorldTimeAdvance = add2eWorldTimeAdvance;
  globalThis.add2eWorldTimeExpireAllActors = add2eWorldTimeExpireAllActors;
  globalThis.add2eWorldTimeProcessPeriodicSaves = add2eWorldTimeProcessPeriodicSaves;
  globalThis.add2eOpenWorldTimeApplication = add2eOpenWorldTimeApplication;

  add2eRegisterWorldTimeUi();
  add2eRegisterWorldTimePeriodicSaveHook();
  add2eScheduleWorldTimePeriodicSaveProcessing("world-time-ready");

  log("[REGISTERED]", {
    version: ADD2E_WORLD_TIME_ENGINE_VERSION,
    tick: add2eTimeCurrentTick(),
    toolbar: "xp-pattern",
    scan: "world+tokens+combatants",
    periodicSave: ADD2E_WORLD_TIME_PERIODIC_SAVE_VERSION
  });
  return true;
}
