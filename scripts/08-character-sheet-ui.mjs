// ============================================================
// ADD2E — 08 Character Sheet UI — point d'entrée
// Fichier découpé :
// - 08-character-sheet-ui-00-utils.mjs
// - 08-character-sheet-ui-01-effects.mjs
// - 08-character-sheet-ui-02-capacites.mjs
// - 08-character-sheet-ui-03-styles.mjs
// ============================================================
import {
  ADD2E_CHARACTER_SHEET_UI_VERSION,
  getSheetRoot,
  expose
} from "./08-character-sheet-ui-00-utils.mjs";
import { injectEffectsTab } from "./08-character-sheet-ui-01-effects.mjs";
import { injectCapacitesTab } from "./08-character-sheet-ui-02-capacites.mjs";
import { injectCharacterUiStyles } from "./08-character-sheet-ui-03-styles.mjs";

console.log("[ADD2E][CHARACTER_UI][VERSION]", ADD2E_CHARACTER_SHEET_UI_VERSION);

const ADD2E_PROJECTILE_COMBAT_FLAG_SCOPE = "add2e";
const ADD2E_PROJECTILE_COMBAT_FLAG_KEY = "projectilesDepensesCombat";
const ADD2E_PROJECTILE_SOCKET_TYPE = "ADD2E_PROJECTILE_SPENT_REQUEST";

export function add2eEnhanceCharacterSheetUi(sheet, html) {
  const actor = sheet?.actor ?? sheet?.document;
  if (!actor || actor.type !== "personnage") return;

  const sheetRoot = getSheetRoot(html);
  if (!sheetRoot) return;

  injectEffectsTab(sheet, sheetRoot);
  injectCapacitesTab(sheet, sheetRoot);
  injectCharacterUiStyles(sheetRoot);

  sheet._add2eActivateTab?.(sheet._add2eActiveTab || sheet._add2eReadStoredTab?.() || "resume", sheetRoot);
}

function bindOnRender(app, html) {
  const actor = app?.actor ?? app?.document;
  if (actor?.type !== "personnage") return;

  for (const delay of [50, 150, 300]) {
    setTimeout(() => {
      try {
        add2eEnhanceCharacterSheetUi(app, html);
      } catch (err) {
        console.warn("[ADD2E][CHARACTER_UI][SPLIT] Injection impossible.", err);
      }
    }, delay);
  }
}

function add2eRefreshActorSheetsForItemChange(item, reason = "item-change") {
  const actor = item?.parent;
  if (!actor || actor.documentName !== "Actor" || actor.type !== "personnage") return;

  const type = String(item.type || "").toLowerCase();
  if (!["objet", "arme", "armure", "object", "magic", "objet_magique", "classe", "race", "sort"].includes(type)) return;

  const hasPowers = (() => {
    try {
      if (typeof globalThis.add2eMagicObjectActivePowerEntries === "function") {
        return globalThis.add2eMagicObjectActivePowerEntries(item).length > 0;
      }
    } catch (_e) {}
    const sys = item.system ?? {};
    const raw = sys.pouvoirs ?? sys.powers ?? sys.pouvoirsMagiques ?? sys.magicalPowers ?? sys.sorts ?? sys.spells ?? [];
    return Array.isArray(raw) ? raw.length > 0 : !!(raw && typeof raw === "object" && Object.keys(raw).length);
  })();

  if (!["objet", "arme", "armure", "object", "magic", "objet_magique"].includes(type) || hasPowers) {
    for (const app of Object.values(actor.apps ?? {})) {
      try {
        app._add2eRememberActiveTab?.(app.element, app._add2eActiveTab || app._add2eReadStoredTab?.() || "sorts");
        app.render(false);
      } catch (err) {
        console.warn("[ADD2E][CHARACTER_UI][REFRESH_ITEM] Impossible de rafraîchir la fiche", { actor: actor.name, item: item.name, reason, err });
      }
    }
  }
}

function add2eIsResponsibleGM() {
  if (!game.user?.isGM) return false;
  if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
  return game.users?.activeGM?.id === game.user.id || !game.users?.activeGM;
}

function add2eProjectileBuildSpentDeltas(combatId, value) {
  const deltas = [];
  const lastSent = globalThis.__ADD2E_PROJECTILE_LAST_SENT ?? {};
  globalThis.__ADD2E_PROJECTILE_LAST_SENT = lastSent;

  for (const actorEntry of Object.values(value ?? {})) {
    const actorId = actorEntry?.actorId;
    if (!actorId) continue;

    for (const itemEntry of Object.values(actorEntry.items ?? {})) {
      const itemId = itemEntry?.itemId || itemEntry?.itemName;
      const itemName = itemEntry?.itemName ?? "Projectile";
      const spent = Math.max(0, Math.floor(Number(itemEntry?.spent ?? 0)));
      if (!itemId || !spent) continue;

      const key = `${combatId}:${actorId}:${itemId}`;
      const previous = Math.max(0, Math.floor(Number(lastSent[key] ?? 0)));
      const delta = spent > previous ? spent - previous : 1;
      lastSent[key] = Math.max(spent, previous + delta);

      deltas.push({
        actorId,
        actorName: actorEntry.actorName ?? "Acteur",
        itemId: itemEntry.itemId ?? null,
        itemName,
        img: itemEntry.img ?? null,
        delta
      });
    }
  }

  return deltas;
}

async function add2eProjectileMergeSpentDeltas({ combatId, deltas = [] } = {}) {
  if (!add2eIsResponsibleGM()) return false;
  const combat = game.combats?.get?.(combatId) ?? game.combat;
  if (!combat?.setFlag || !deltas.length) return false;

  const current = foundry.utils.deepClone(await combat.getFlag(ADD2E_PROJECTILE_COMBAT_FLAG_SCOPE, ADD2E_PROJECTILE_COMBAT_FLAG_KEY) ?? {});

  for (const deltaEntry of deltas) {
    const actorId = deltaEntry.actorId;
    const itemKey = deltaEntry.itemId || deltaEntry.itemName;
    const delta = Math.max(1, Math.floor(Number(deltaEntry.delta ?? 1)));
    if (!actorId || !itemKey) continue;

    current[actorId] = current[actorId] ?? {
      actorId,
      actorName: deltaEntry.actorName ?? "Acteur",
      items: {}
    };
    current[actorId].actorName = deltaEntry.actorName ?? current[actorId].actorName;
    current[actorId].items[itemKey] = current[actorId].items[itemKey] ?? {
      itemId: deltaEntry.itemId ?? null,
      itemName: deltaEntry.itemName ?? "Projectile",
      img: deltaEntry.img ?? null,
      spent: 0
    };
    current[actorId].items[itemKey].spent = Math.max(0, Math.floor(Number(current[actorId].items[itemKey].spent ?? 0))) + delta;
    current[actorId].items[itemKey].itemName = deltaEntry.itemName ?? current[actorId].items[itemKey].itemName;
    current[actorId].items[itemKey].img = deltaEntry.img ?? current[actorId].items[itemKey].img;
  }

  await combat.setFlag(ADD2E_PROJECTILE_COMBAT_FLAG_SCOPE, ADD2E_PROJECTILE_COMBAT_FLAG_KEY, current);
  return true;
}

function add2eRegisterProjectileSpentSocketPatch() {
  if (globalThis.__ADD2E_PROJECTILE_SPENT_SOCKET_PATCH_V1) return;
  globalThis.__ADD2E_PROJECTILE_SPENT_SOCKET_PATCH_V1 = true;

  game.socket?.on?.("system.add2e", data => {
    if (data?.type !== ADD2E_PROJECTILE_SOCKET_TYPE) return;
    add2eProjectileMergeSpentDeltas(data).catch(err => console.warn("[ADD2E][PROJECTILES][SOCKET_MERGE]", err));
  });

  const CombatClass = CONFIG?.Combat?.documentClass ?? foundry?.documents?.Combat ?? globalThis.Combat;
  const proto = CombatClass?.prototype;
  if (!proto?.setFlag || proto.__add2eProjectileSpentSetFlagPatched) return;

  const originalSetFlag = proto.setFlag;
  proto.__add2eProjectileSpentSetFlagPatched = true;
  proto.setFlag = async function add2eProjectileSpentSetFlag(scope, key, value, ...rest) {
    if (!game.user?.isGM && scope === ADD2E_PROJECTILE_COMBAT_FLAG_SCOPE && key === ADD2E_PROJECTILE_COMBAT_FLAG_KEY) {
      const combatId = this.id;
      const deltas = add2eProjectileBuildSpentDeltas(combatId, value);
      if (deltas.length) {
        game.socket?.emit?.("system.add2e", {
          type: ADD2E_PROJECTILE_SOCKET_TYPE,
          userId: game.user.id,
          combatId,
          deltas
        });
      }
      return true;
    }
    return originalSetFlag.call(this, scope, key, value, ...rest);
  };
}

Hooks.on("renderActorSheet", bindOnRender);
Hooks.on("renderApplication", bindOnRender);

Hooks.once("ready", () => {
  add2eRegisterProjectileSpentSocketPatch();
});

for (const hookName of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(hookName, (item, _changes, _options, _userId) => {
    setTimeout(() => add2eRefreshActorSheetsForItemChange(item, hookName), 80);
  });
}

expose("add2eEnhanceCharacterSheetUi", add2eEnhanceCharacterSheetUi);
expose("add2eProjectileMergeSpentDeltas", add2eProjectileMergeSpentDeltas);
