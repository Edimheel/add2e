// ADD2E — Livres de sorts et parchemins.
// Point d’entrée conservé pour compatibilité avec les imports existants.
// Compatible Foundry V13/V14/V15. ApplicationV2 / DialogV2 uniquement.

import {
  VERSION,
  isSpellbook,
  isScroll,
  documentEntries,
  actorArcaneLists,
  actorScrollLists,
  arcaneChatCard,
  createArcaneChatMessage
} from "./07b-arcane-documents-core.mjs";
import {
  syncActorSpellbooks,
  copySpellbook,
  viewSpellbook,
  detachPersonalSpellbooks
} from "./07b-arcane-spellbooks.mjs";
import {
  castScroll,
  scribeScroll,
  consumeScrollSpell,
  hydrateScroll
} from "./07b-arcane-scrolls.mjs";
import { installArcaneDocumentRuntime } from "./07b-arcane-runtime.mjs";

installArcaneDocumentRuntime();

globalThis.ADD2E_ARCANE_DOCUMENTS_VERSION = VERSION;
globalThis.ADD2E_ARCANE_DOCUMENTS = {
  version: VERSION,
  isSpellbook,
  isScroll,
  documentEntries,
  syncActorSpellbooks,
  copySpellbook,
  viewSpellbook,
  castScroll,
  scribeScroll,
  consumeScrollSpell,
  hydrateScroll,
  detachPersonalSpellbooks,
  arcaneChatCard,
  createArcaneChatMessage,
  actorArcaneLists,
  actorScrollLists
};

globalThis.add2eArcaneChatCard = arcaneChatCard;
globalThis.add2eCreateArcaneChatMessage = createArcaneChatMessage;
globalThis.add2eSyncActorSpellbooks = syncActorSpellbooks;
globalThis.add2eCopySpellbook = copySpellbook;
globalThis.add2eCastScroll = castScroll;
globalThis.add2eScribeScroll = scribeScroll;
globalThis.add2eDetachPersonalSpellbooks = detachPersonalSpellbooks;
