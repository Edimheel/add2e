// ADD2E — Bootstrap socket marchand.
// Version : 2026-06-14-vendor-socket-bootstrap-v1

import { registerSockets } from "./22a-vendor-core.mjs";

Hooks.once("ready", () => {
  registerSockets();
});
