// ADD2E — Continuations joueur branchées depuis les contrôleurs de validation.
// Compatible Foundry V13/V14/V15.

const ADD2E_SOCKET = "system.add2e";
const VADE_RETRO_PLAYER_CONTINUATION = "ADD2E_VADE_RETRO_PLAYER_CONTINUATION";
const VERSION = "2026-07-06-vade-retro-player-continuation-v1";

function registerPlayerContinuations() {
  if (globalThis.ADD2E_PLAYER_CONTINUATION_VERSION === VERSION) return;
  globalThis.ADD2E_PLAYER_CONTINUATION_VERSION = VERSION;

  const socket = game["socket"];
  if (!socket) return;
  socket["on"](ADD2E_SOCKET, data => {
    if (data?.type !== VADE_RETRO_PLAYER_CONTINUATION) return;
    const run = globalThis.add2eRunPlayerVadeRetroContinuation;
    if (typeof run === "function") void run(data.payload ?? {});
  });
}

Hooks.once("ready", registerPlayerContinuations);

export {};