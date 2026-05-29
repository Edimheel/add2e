// scripts/add2e-initiative.mjs
// ADD2E — Initiative propre.
// Règle système : initiative 1d6, le plus petit résultat agit en premier.
// Responsabilités : configuration initiative, tri ascendant réel, carte de chat, icône D6,
// verrou des actions hors tour, synchronisation du HUD sur le combattant actif.
// Ne gère pas le déplacement, les chemins, les traces ou le ruler.

const ADD2E_INITIATIVE_VERSION = "2026-05-29-d6-low-first-real-turns-hud-v2";
const ADD2E_INITIATIVE_ACTION_LOCK_VERSION = "2026-05-29-d6-low-first-action-lock-v1";
const ADD2E_INITIATIVE_CHAT_VERSION = "2026-05-29-d6-low-first-chat-v1";
const ADD2E_INITIATIVE_HUD_FOLLOW_VERSION = "2026-05-29-d6-low-first-hud-follow-v2";
const ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION = "2026-05-29-no-movement-history-record-v1";
const ADD2E_INITIATIVE_D6_ICON = "systems/add2e/assets/D6_3D_tracker.png";
const TAG = "[ADD2E][INIT]";

let configured = false;
let sorting = false;
let sortTimer = null;
let hudFollowTimer = null;
let warningAt = 0;
let cleanedLegacyHooks = false;
let combatTurnsPatchInstalled = false;
let movementHistoryPatchInstalled = false;
let lastHudCombatantKey = "";

globalThis.ADD2E_INITIATIVE_VERSION = ADD2E_INITIATIVE_VERSION;
globalThis.ADD2E_INITIATIVE_ACTION_LOCK_VERSION = ADD2E_INITIATIVE_ACTION_LOCK_VERSION;
globalThis.ADD2E_INITIATIVE_CHAT_VERSION = ADD2E_INITIATIVE_CHAT_VERSION;
globalThis.ADD2E_INITIATIVE_HUD_FOLLOW_VERSION = ADD2E_INITIATIVE_HUD_FOLLOW_VERSION;
globalThis.ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION = ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION;

function configureInitiative() {
  if (configured) return;
  configured = true;

  CONFIG.Combat ??= {};
  CONFIG.Combat.initiative = {
    formula: "1d6",
    decimals: 2
  };

  console.log(`${TAG}[CONFIG]`, {
    version: ADD2E_INITIATIVE_VERSION,
    formula: "1d6",
    order: "ascending",
    rule: "le plus petit résultat agit en premier"
  });
}

function initiativeValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function compareCombatantsAscending(a, b) {
  const ai = initiativeValue(a?.initiative);
  const bi = initiativeValue(b?.initiative);

  if (ai === null && bi === null) return 0;
  if (ai === null) return 1;
  if (bi === null) return -1;
  if (ai !== bi) return ai - bi;

  return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
}

function sortedCombatants(combat = game.combat) {
  return Array.from(combat?.combatants ?? []).sort(compareCombatantsAscending);
}

function hookSource(entry) {
  const fn = entry?.fn ?? entry?.callback ?? entry;
  if (typeof fn !== "function") return "";
  try { return Function.prototype.toString.call(fn); } catch (_e) { return ""; }
}

function cleanupLegacyInitiativeHooksFromStore(store) {
  if (!store || typeof store !== "object") return 0;
  let removed = 0;

  for (const hookName of ["updateCombatant", "updateCombat"]) {
    const entries = store[hookName];
    if (!Array.isArray(entries)) continue;

    const before = entries.length;
    store[hookName] = entries.filter(entry => {
      const source = hookSource(entry);
      return !(
        source.includes("triInitiativeAscendant") ||
        source.includes("add2eClearCombatMovementHistoryOnce") ||
        source.includes("add2eClearTokenMovementHistory") ||
        source.includes("add2ePurgeCombatantMovementHistory") ||
        source.includes("movementHistory") ||
        source.includes("showMovementHistory") ||
        source.includes("updateEmbeddedDocuments(\"Combatant\"")
      );
    });
    removed += before - store[hookName].length;
  }

  return removed;
}

function cleanupLegacyInitiativeHooks() {
  if (cleanedLegacyHooks) return 0;
  cleanedLegacyHooks = true;

  let removed = 0;
  try { removed += cleanupLegacyInitiativeHooksFromStore(Hooks.events); } catch (_e) {}
  try { removed += cleanupLegacyInitiativeHooksFromStore(Hooks._hooks); } catch (_e) {}

  console.log(`${TAG}[LEGACY_CLEAN]`, { removed });
  return removed;
}

function applyAscendingTurns(combat = game.combat) {
  if (!combat) return false;

  const turns = sortedCombatants(combat);
  if (!turns.length) return false;

  const previous = currentCombatant(combat);
  const previousId = previous?.id ?? combat.current?.combatantId ?? null;

  try {
    combat.turns = turns;

    if (previousId) {
      const nextIndex = turns.findIndex(c => c.id === previousId);
      if (nextIndex >= 0) {
        combat.turn = nextIndex;
        if (combat.current && typeof combat.current === "object") combat.current.turn = nextIndex;
      }
    }

    return true;
  } catch (err) {
    console.warn(`${TAG}[APPLY_TURNS][ERROR]`, err);
    return false;
  }
}

function installCombatTurnsPatch() {
  if (combatTurnsPatchInstalled) return true;
  const proto = globalThis.Combat?.prototype;
  if (!proto?.setupTurns) return false;

  const original = proto.setupTurns;
  if (original.__add2eD6LowFirstTurnsPatch === ADD2E_INITIATIVE_VERSION) {
    combatTurnsPatchInstalled = true;
    return true;
  }

  proto.setupTurns = function add2eD6LowFirstSetupTurns(...args) {
    const result = original.apply(this, args);
    try {
      if (game?.system?.id === "add2e") applyAscendingTurns(this);
    } catch (err) {
      console.warn(`${TAG}[SETUP_TURNS_PATCH][ERROR]`, err);
    }
    return result;
  };

  proto.setupTurns.__add2eD6LowFirstTurnsPatch = ADD2E_INITIATIVE_VERSION;
  proto.setupTurns.__add2eOriginal = original;
  combatTurnsPatchInstalled = true;
  console.log(`${TAG}[SETUP_TURNS_PATCH]`, ADD2E_INITIATIVE_VERSION);
  return true;
}

async function sortInitiativeAscending(combat = game.combat) {
  if (!combat || sorting) return false;

  const combatants = Array.from(combat.combatants ?? []);
  if (!combatants.length) return false;

  const sorted = sortedCombatants(combat);
  const updates = sorted
    .map((combatant, index) => ({ _id: combatant.id, sort: index }))
    .filter(update => {
      const current = combatants.find(c => c.id === update._id);
      return current && Number(current.sort) !== Number(update.sort);
    });

  sorting = true;
  try {
    if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates, { add2eInitiativeSort: true });
    combat.setupTurns?.();
    applyAscendingTurns(combat);
    ui.combat?.render?.(true);
    console.log(`${TAG}[SORT_ASC_REAL]`, sorted.map(c => `${c.name}:${c.initiative}`).join(" | "));
    return true;
  } catch (err) {
    console.error(`${TAG}[SORT_ASC][ERROR]`, err);
    return false;
  } finally {
    sorting = false;
  }
}

function scheduleInitiativeSort(combat = game.combat) {
  if (!combat) return;
  clearTimeout(sortTimer);
  sortTimer = setTimeout(() => sortInitiativeAscending(combat), 100);
}

function escapeHtml(value) {
  try { return foundry.utils.escapeHTML(String(value ?? "")); }
  catch (_e) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  }
}

function speakerActor(speaker = {}) {
  if (speaker.token && canvas?.tokens?.get) {
    const token = canvas.tokens.get(speaker.token);
    if (token?.actor) return token.actor;
  }
  if (speaker.actor) return game.actors?.get?.(speaker.actor) ?? null;
  return null;
}

function speakerToken(speaker = {}) {
  if (!speaker.token || !canvas?.tokens?.get) return null;
  return canvas.tokens.get(speaker.token) ?? null;
}

function isInitiativeMessage(message, data = {}) {
  const flags = data.flags ?? message?.flags ?? {};
  const flavor = String(data.flavor ?? message?.flavor ?? "").toLowerCase();
  const speaker = data.speaker ?? message?.speaker ?? {};
  const roll = (data.rolls ?? message?.rolls ?? [])?.[0] ?? null;
  const formula = String(roll?.formula ?? roll?._formula ?? "").replace(/\s+/g, "").toLowerCase();

  if (flags?.add2e?.initiativeRoll || flags?.core?.initiativeRoll) return true;
  if (flavor.includes("initiative")) return true;
  return formula === "1d6" && !!speaker?.actor && game.combat?.combatants?.some?.(c => c.actor?.id === speaker.actor);
}

function initiativeTotal(message, data = {}) {
  const roll = (data.rolls ?? message?.rolls ?? [])?.[0] ?? null;
  const total = Number(roll?.total ?? roll?._total);
  return Number.isFinite(total) ? total : null;
}

function initiativeChatContent(message, data = {}) {
  const speaker = data.speaker ?? message?.speaker ?? {};
  const actor = speakerActor(speaker);
  const token = speakerToken(speaker);
  const name = token?.name ?? actor?.name ?? speaker.alias ?? "Combattant";
  const img = token?.document?.texture?.src ?? actor?.img ?? ADD2E_INITIATIVE_D6_ICON;
  const total = initiativeTotal(message, data);
  const result = total === null ? "—" : total;

  return `
    <div class="add2e-init-chat-card" style="border:1px solid #7c4a16;border-radius:10px;background:linear-gradient(135deg,#2a1708,#4b2a0e);color:#f7ead2;padding:10px 12px;box-shadow:0 2px 8px rgba(0,0,0,.35);font-family:serif;">
      <div style="display:flex;align-items:center;gap:10px;">
        <img src="${escapeHtml(img)}" alt="" style="width:42px;height:42px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,.25);background:#111;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:15px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#ffd891;">Initiative</div>
          <div style="font-size:18px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</div>
        </div>
        <div style="text-align:center;min-width:58px;background:rgba(255,255,255,.12);border:1px solid rgba(255,216,145,.35);border-radius:8px;padding:5px 8px;">
          <div style="font-size:11px;text-transform:uppercase;color:#ffd891;">D6</div>
          <div style="font-size:26px;line-height:1;font-weight:900;color:#ffffff;">${escapeHtml(result)}</div>
        </div>
      </div>
      <div style="margin-top:8px;font-size:12px;color:#ead6b0;display:flex;justify-content:space-between;gap:10px;">
        <span>Le plus petit résultat agit en premier.</span>
        <span style="white-space:nowrap;">1d6</span>
      </div>
    </div>`;
}

function installInitiativeChatCard() {
  if (globalThis.__ADD2E_INIT_CHAT_CARD_INSTALLED === ADD2E_INITIATIVE_CHAT_VERSION) return;
  globalThis.__ADD2E_INIT_CHAT_CARD_INSTALLED = ADD2E_INITIATIVE_CHAT_VERSION;

  Hooks.on("preCreateChatMessage", (message, data) => {
    try {
      if (!isInitiativeMessage(message, data)) return;
      message.updateSource?.({
        content: initiativeChatContent(message, data),
        flavor: "Initiative ADD2E",
        "flags.add2e.initiativeRoll": true,
        "flags.add2e.initiativeChatCardVersion": ADD2E_INITIATIVE_CHAT_VERSION
      });
    } catch (err) {
      console.warn(`${TAG}[CHAT][ERROR]`, err);
    }
  });
}

function currentCombatant(combat = game.combat) {
  if (!combat) return null;

  const turnIndex = Number(combat.turn ?? combat.current?.turn);
  if (Number.isInteger(turnIndex) && turnIndex >= 0 && Array.isArray(combat.turns)) {
    const byTurn = combat.turns[turnIndex];
    if (byTurn) return byTurn;
  }

  const id = combat.current?.combatantId ?? combat.combatantId ?? null;
  return (id ? combat.combatants?.get?.(id) : null) ?? combat.combatant ?? null;
}

function tokenFromCombatant(combatant) {
  return combatant?.token?.object ?? (combatant?.tokenId ? canvas?.tokens?.get?.(combatant.tokenId) : null) ?? null;
}

function combatantMatchesActor(combatant, actor) {
  if (!combatant || !actor) return false;
  if (combatant.actor?.id && combatant.actor.id === actor.id) return true;
  if (combatant.actorId && combatant.actorId === actor.id) return true;
  return false;
}

function combatActive(combat = game.combat) {
  return Boolean(combat && combat.started && currentCombatant(combat));
}

function notifyNotTurn(actor = null) {
  const now = Date.now();
  if (now - warningAt < 900) return;
  warningAt = now;

  const active = currentCombatant();
  const activeName = active?.name ?? active?.actor?.name ?? "l'acteur actif";
  const actorName = actor?.name ? `${actor.name} ne peut pas agir.` : "Cet acteur ne peut pas agir.";
  ui.notifications?.info?.(`${actorName} C'est le tour de ${activeName}.`);
}

function canActorActNow(actor, { notify = false } = {}) {
  const combat = game.combat;
  if (!combatActive(combat)) return true;
  if (game.user?.isGM) return true;
  if (combatantMatchesActor(currentCombatant(combat), actor)) return true;

  if (notify) notifyNotTurn(actor);
  return false;
}

function resolveActionActor(argsLike) {
  const args = Array.isArray(argsLike) ? argsLike : [];
  const first = args[0] ?? null;
  const source = first && typeof first === "object" ? first : {};

  if (source.actor) return source.actor;
  if (source.actorId) return game.actors?.get?.(source.actorId) ?? null;
  if (source.token?.actor) return source.token.actor;
  if (source.tokenId && canvas?.tokens?.get?.(source.tokenId)?.actor) return canvas.tokens.get(source.tokenId).actor;

  return canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
}

function wrapActionFunction(name, label) {
  const current = globalThis[name];
  if (typeof current !== "function") return false;
  if (current.__add2eCleanInitiativeActionLock === ADD2E_INITIATIVE_ACTION_LOCK_VERSION) return true;

  const wrapped = async function add2eCleanInitiativeActionLock(...args) {
    const actor = resolveActionActor(args);
    if (!canActorActNow(actor, { notify: true })) return false;
    return current.apply(this, args);
  };

  wrapped.__add2eCleanInitiativeActionLock = ADD2E_INITIATIVE_ACTION_LOCK_VERSION;
  wrapped.__add2eOriginal = current;
  globalThis[name] = wrapped;

  console.log(`${TAG}[ACTION_LOCK]`, { name, label, version: ADD2E_INITIATIVE_ACTION_LOCK_VERSION });
  return true;
}

function installActionLocks() {
  wrapActionFunction("add2eAttackRoll", "attaque");
  wrapActionFunction("add2eCastSpell", "sort");
  wrapActionFunction("cast_spell", "sort alias");
  wrapActionFunction("add2eExecuteClassFeatureOnUse", "capacité");
}

function makeD6Image() {
  const img = document.createElement("img");
  img.src = ADD2E_INITIATIVE_D6_ICON;
  img.alt = "D6";
  img.className = "add2e-init-d6-icon";
  img.style.width = "22px";
  img.style.height = "22px";
  img.style.objectFit = "contain";
  img.style.verticalAlign = "middle";
  img.style.border = "0";
  img.style.margin = "0";
  img.style.padding = "0";
  img.style.filter = "drop-shadow(0 0 2px rgba(255,255,255,.35))";
  return img;
}

function isInitiativeButton(button) {
  if (!button?.closest) return false;
  const row = button.closest(".combatant, li[data-combatant-id], [data-combatant-id]");
  if (!row) return false;

  return Boolean(
    button.matches?.("button.combatant-control.roll") ||
    button.matches?.("[data-action='rollInitiative']") ||
    button.matches?.("[data-control='rollInitiative']") ||
    button.classList?.contains("roll")
  );
}

function patchInitiativeButton(button) {
  if (!isInitiativeButton(button)) return false;

  const icon = button.querySelector?.("i.fa-dice-d20, i.fa-dice-d6, i.fa-dice");
  if (icon && !button.querySelector(".add2e-init-d6-icon")) icon.replaceWith(makeD6Image());

  button.style.setProperty("background-image", `url('${ADD2E_INITIATIVE_D6_ICON}')`, "important");
  button.style.setProperty("background-size", "contain", "important");
  button.style.setProperty("background-repeat", "no-repeat", "important");
  button.style.setProperty("background-position", "center", "important");
  button.dataset.add2eD6InitiativeIcon = "1";
  button.title = "Lancer l'initiative ADD2E (1d6, le plus petit commence)";

  return true;
}

function patchInitiativeIcons(root = document) {
  try {
    const scope = root?.jquery ? root[0] : root;
    if (!scope?.querySelectorAll) return 0;

    const selectors = [
      "#combat-tracker .combatant button.combatant-control.roll",
      "#combat .combatant button.combatant-control.roll",
      ".combat-sidebar .combatant button.combatant-control.roll",
      "#combat-tracker [data-combatant-id] button.combatant-control.roll",
      "#combat [data-combatant-id] button.combatant-control.roll",
      ".combat-sidebar [data-combatant-id] button.combatant-control.roll",
      "#combat-tracker .combatant [data-action='rollInitiative']",
      "#combat .combatant [data-action='rollInitiative']",
      ".combat-sidebar .combatant [data-action='rollInitiative']",
      "#combat-tracker [data-combatant-id] [data-action='rollInitiative']",
      "#combat [data-combatant-id] [data-action='rollInitiative']",
      ".combat-sidebar [data-combatant-id] [data-action='rollInitiative']"
    ];

    const elements = new Set();
    for (const selector of selectors) {
      for (const el of scope.querySelectorAll(selector)) elements.add(el);
    }

    let changed = 0;
    for (const el of elements) if (patchInitiativeButton(el)) changed++;
    return changed;
  } catch (err) {
    console.warn(`${TAG}[D6_ICON][ERROR]`, err);
    return 0;
  }
}

function actionHudIsOpen() {
  return Boolean(document.getElementById("add2e-action-hud"));
}

function syncActionHudToCombatant(combat = game.combat, { forceOpen = false, reason = "combat" } = {}) {
  combat?.setupTurns?.();
  applyAscendingTurns(combat);

  const combatant = currentCombatant(combat);
  const actor = combatant?.actor ?? null;
  if (!actor) return false;
  if (!forceOpen && !actionHudIsOpen()) return false;

  const token = tokenFromCombatant(combatant);
  const key = `${combat?.id ?? "combat"}.${combatant.id}.${actor.id}.${token?.id ?? "no-token"}`;
  if (lastHudCombatantKey === key && reason !== "manual") return true;
  lastHudCombatantKey = key;

  try {
    if (typeof globalThis.add2eRenderActionHud === "function") {
      globalThis.add2eRenderActionHud(actor, token, { reason: `initiative-${reason}` });
      console.log(`${TAG}[HUD_FOLLOW]`, { actor: actor.name, token: token?.name ?? null, reason });
      return true;
    }

    if (typeof game.add2e?.openActionHud === "function") {
      game.add2e.openActionHud(actor);
      console.log(`${TAG}[HUD_FOLLOW][API]`, { actor: actor.name, token: token?.name ?? null, reason });
      return true;
    }
  } catch (err) {
    console.warn(`${TAG}[HUD_FOLLOW][ERROR]`, err);
  }

  return false;
}

function scheduleHudFollow(combat = game.combat, { forceOpen = false, reason = "combat" } = {}) {
  if (!combat) return;
  clearTimeout(hudFollowTimer);
  hudFollowTimer = setTimeout(() => syncActionHudToCombatant(combat, { forceOpen, reason }), 120);
}

function isMovementHistoryFlag(scope, key) {
  if (scope !== "add2e") return false;
  return ["movementTurnKey", "movementSpentMeters", "lastAllowedPosition"].includes(String(key));
}

function patchSetFlagHistoryBlock(cls, label) {
  const proto = cls?.prototype;
  if (!proto?.setFlag || proto.setFlag.__add2eNoMovementHistory === ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION) return false;

  const original = proto.setFlag;
  proto.setFlag = function add2eNoMovementHistorySetFlag(scope, key, value, ...rest) {
    if (isMovementHistoryFlag(scope, key)) {
      console.log(`${TAG}[MOVE_HISTORY][BLOCK_SETFLAG]`, { document: label, name: this?.name ?? this?.id ?? null, key });
      return Promise.resolve(this);
    }
    return original.call(this, scope, key, value, ...rest);
  };

  proto.setFlag.__add2eNoMovementHistory = ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION;
  proto.setFlag.__add2eOriginal = original;
  return true;
}

function installMovementHistoryBlock() {
  if (movementHistoryPatchInstalled) return true;
  movementHistoryPatchInstalled = true;

  const patched = [];
  if (patchSetFlagHistoryBlock(globalThis.Actor, "Actor")) patched.push("Actor");
  if (patchSetFlagHistoryBlock(globalThis.TokenDocument ?? foundry?.documents?.TokenDocument, "TokenDocument")) patched.push("TokenDocument");

  game.add2e = game.add2e ?? {};
  game.add2e.movementHistoryDisabledVersion = ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION;
  console.log(`${TAG}[MOVE_HISTORY][DISABLED]`, { version: ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION, patched });
  return true;
}

async function clearExistingMovementHistoryFlags() {
  if (!game.user?.isGM) return;

  const actorUpdates = [];
  for (const actor of game.actors ?? []) {
    if (actor?.flags?.add2e?.movementTurnKey !== undefined || actor?.flags?.add2e?.movementSpentMeters !== undefined) {
      actorUpdates.push({ _id: actor.id, "flags.add2e.-=movementTurnKey": null, "flags.add2e.-=movementSpentMeters": null });
    }
  }
  if (actorUpdates.length) await Actor.updateDocuments(actorUpdates, { add2eIgnoreMovementHistoryCleanup: true });

  for (const scene of game.scenes ?? []) {
    const tokenUpdates = [];
    for (const token of scene.tokens ?? []) {
      if (token?.flags?.add2e?.lastAllowedPosition !== undefined) tokenUpdates.push({ _id: token.id, "flags.add2e.-=lastAllowedPosition": null });
    }
    if (tokenUpdates.length) await scene.updateEmbeddedDocuments("Token", tokenUpdates, { add2eIgnoreMovementHistoryCleanup: true });
  }

  if (actorUpdates.length) console.log(`${TAG}[MOVE_HISTORY][CLEAN_ACTORS]`, actorUpdates.length);
}

function exposeGlobals() {
  game.add2e = game.add2e ?? {};
  game.add2e.initiativeVersion = ADD2E_INITIATIVE_VERSION;
  game.add2e.initiativeHudFollowVersion = ADD2E_INITIATIVE_HUD_FOLLOW_VERSION;
  game.add2e.movementHistoryDisabledVersion = ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION;

  globalThis.add2eConfigureInitiative = configureInitiative;
  globalThis.add2eSortInitiativeAscending = sortInitiativeAscending;
  globalThis.add2eScheduleInitiativeSort = scheduleInitiativeSort;
  globalThis.add2ePatchCombatTrackerInitiativeIcons = patchInitiativeIcons;
  globalThis.add2eCanActorActNow = canActorActNow;
  globalThis.add2eSyncActionHudToCombatant = syncActionHudToCombatant;
  globalThis.add2eDisableMovementHistoryRecording = installMovementHistoryBlock;
  globalThis.add2eClearExistingMovementHistoryFlags = clearExistingMovementHistoryFlags;
  globalThis.triInitiativeAscendant = sortInitiativeAscending;
}

function installHooks() {
  Hooks.on("updateCombatant", (combatant, changes, options) => {
    if (options?.add2eInitiativeSort) return;
    if (foundry.utils.hasProperty(changes ?? {}, "initiative")) scheduleInitiativeSort(combatant.combat ?? game.combat);
  });

  Hooks.on("createCombatant", (combatant, options) => {
    if (options?.add2eInitiativeSort) return;
    scheduleInitiativeSort(combatant.combat ?? game.combat);
  });

  Hooks.on("deleteCombatant", (combatant, options) => {
    if (options?.add2eInitiativeSort) return;
    scheduleInitiativeSort(combatant.combat ?? game.combat);
  });

  Hooks.on("updateCombat", (combat, changes, options) => {
    if (options?.add2eInitiativeSort) return;
    if (
      foundry.utils.hasProperty(changes ?? {}, "turn") ||
      foundry.utils.hasProperty(changes ?? {}, "round") ||
      foundry.utils.hasProperty(changes ?? {}, "current") ||
      foundry.utils.hasProperty(changes ?? {}, "started")
    ) {
      combat.setupTurns?.();
      applyAscendingTurns(combat);
      scheduleHudFollow(combat, { forceOpen: false, reason: "updateCombat" });
      ui.combat?.render?.(true);
    }
  });

  Hooks.on("combatTurn", combat => scheduleHudFollow(combat, { forceOpen: false, reason: "combatTurn" }));
  Hooks.on("combatRound", combat => scheduleHudFollow(combat, { forceOpen: false, reason: "combatRound" }));
  Hooks.on("deleteCombat", () => { lastHudCombatantKey = ""; });

  Hooks.on("renderCombatTracker", (app, html) => patchInitiativeIcons(html));
  Hooks.on("renderCombatantConfig", () => setTimeout(() => patchInitiativeIcons(document), 50));
  Hooks.on("renderSidebarTab", (app, html) => {
    if (app?.options?.id === "combat" || app?.tabName === "combat" || app?.id === "combat") {
      patchInitiativeIcons(html);
      setTimeout(() => patchInitiativeIcons(document), 50);
    }
  });

  installInitiativeChatCard();
  console.log(`${TAG}[HOOKS_INSTALLED]`, {
    version: ADD2E_INITIATIVE_VERSION,
    hudFollow: ADD2E_INITIATIVE_HUD_FOLLOW_VERSION,
    movementHistoryDisabled: ADD2E_MOVEMENT_HISTORY_DISABLED_VERSION
  });
}

Hooks.once("init", configureInitiative);

Hooks.once("ready", () => {
  configureInitiative();
  cleanupLegacyInitiativeHooks();
  installCombatTurnsPatch();
  installMovementHistoryBlock();
  exposeGlobals();
  patchInitiativeIcons(document);
  installActionLocks();
  installHooks();

  clearExistingMovementHistoryFlags().catch(err => console.warn(`${TAG}[MOVE_HISTORY][CLEAN_ERROR]`, err));

  setTimeout(() => patchInitiativeIcons(document), 500);
  setTimeout(() => patchInitiativeIcons(document), 1500);
  setTimeout(() => installActionLocks(), 800);
  setTimeout(() => installActionLocks(), 2000);
  setTimeout(() => installActionLocks(), 4000);
  setTimeout(() => scheduleInitiativeSort(game.combat), 700);
  setTimeout(() => scheduleHudFollow(game.combat, { forceOpen: false, reason: "ready" }), 1000);
});

export {
  configureInitiative as add2eConfigureInitiative,
  sortInitiativeAscending as add2eSortInitiativeAscending,
  canActorActNow as add2eCanActorActNow,
  syncActionHudToCombatant as add2eSyncActionHudToCombatant,
  installMovementHistoryBlock as add2eDisableMovementHistoryRecording
};
