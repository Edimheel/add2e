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
const ADD2E_PROJECTILE_RECOVERY_SOCKET_TYPE = "ADD2E_PROJECTILE_RECOVERY_RESULT";
const ADD2E_PROJECTILE_RECOVERY_RATE = 0.6;

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

function add2eEscapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
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
      if (spent <= previous) continue;

      const delta = spent - previous;
      lastSent[key] = spent;

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

function add2eProjectileExtractSpentFromCombatUpdate(changed) {
  return foundry.utils.getProperty(changed, `flags.${ADD2E_PROJECTILE_COMBAT_FLAG_SCOPE}.${ADD2E_PROJECTILE_COMBAT_FLAG_KEY}`)
    ?? changed?.flags?.[ADD2E_PROJECTILE_COMBAT_FLAG_SCOPE]?.[ADD2E_PROJECTILE_COMBAT_FLAG_KEY]
    ?? null;
}

function add2eProjectileEmitSpentDeltas(combat, value) {
  if (game.user?.isGM) return false;
  const combatId = combat?.id ?? combat?._id ?? game.combat?.id;
  if (!combatId) return false;

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

function add2eProjectileBuildRecoveryRows(combat) {
  const spent = foundry.utils.deepClone(combat?.getFlag?.(ADD2E_PROJECTILE_COMBAT_FLAG_SCOPE, ADD2E_PROJECTILE_COMBAT_FLAG_KEY) ?? {});
  const rows = [];

  for (const actorEntry of Object.values(spent)) {
    const actor = game.actors?.get(actorEntry.actorId);
    if (!actor || game.user?.isGM || !actor.isOwner) continue;

    for (const itemEntry of Object.values(actorEntry.items ?? {})) {
      const qtySpent = Math.max(0, Math.floor(Number(itemEntry.spent ?? 0)));
      if (!qtySpent) continue;
      rows.push({
        actor: actor.name,
        item: itemEntry.itemName ?? "Projectile",
        spent: qtySpent,
        recovered: Math.max(0, Math.round(qtySpent * ADD2E_PROJECTILE_RECOVERY_RATE))
      });
    }
  }

  return rows;
}

async function add2eProjectileShowRecoveryPopup(rows, { title = "Récupération des projectiles" } = {}) {
  if (!rows?.length) return false;
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  const htmlRows = rows.map(row => `
    <tr>
      <td style="padding:5px 7px;border-bottom:1px solid #e2ca88;">${add2eEscapeHtml(row.actor)}</td>
      <td style="padding:5px 7px;border-bottom:1px solid #e2ca88;">${add2eEscapeHtml(row.item)}</td>
      <td style="padding:5px 7px;border-bottom:1px solid #e2ca88;text-align:center;">${row.spent}</td>
      <td style="padding:5px 7px;border-bottom:1px solid #e2ca88;text-align:center;font-weight:900;color:#1f7a3f;">${row.recovered}</td>
    </tr>`).join("");

  const content = `
    <div class="add2e-dialog add2e-vendor-alert" style="color:#2f250c;">
      <h3>Récupération des projectiles</h3>
      <p>Fin de combat : 60 % des projectiles dépensés sont récupérés.</p>
      <table style="width:100%;border-collapse:collapse;background:#fffaf0;border:1px solid #d9bf73;">
        <thead><tr style="background:#e8d08f;"><th>Acteur</th><th>Projectile</th><th>Dépensés</th><th>Récupérés</th></tr></thead>
        <tbody>${htmlRows}</tbody>
      </table>
    </div>`;

  if (DialogV2?.confirm) {
    await DialogV2.confirm({
      window: { title },
      content,
      yes: { label: "Compris" },
      no: { label: "Fermer" },
      modal: true
    });
  } else {
    ui.notifications?.info?.("Récupération des projectiles effectuée.");
  }
  return true;
}

function add2eProjectileShowRecoveryForCombat(combat) {
  const combatId = combat?.id ?? combat?._id ?? "combat";
  const key = `${combatId}:${game.user?.id ?? "user"}`;
  const seen = globalThis.__ADD2E_PROJECTILE_RECOVERY_POPUP_SEEN ?? new Set();
  globalThis.__ADD2E_PROJECTILE_RECOVERY_POPUP_SEEN = seen;
  if (seen.has(key)) return;

  const rows = add2eProjectileBuildRecoveryRows(combat);
  if (!rows.length) return;
  seen.add(key);
  add2eProjectileShowRecoveryPopup(rows).catch(err => console.warn("[ADD2E][PROJECTILES][RECOVERY_POPUP]", err));
}

function add2ePatchCombatProjectileWrite(proto) {
  if (!proto) return false;

  if (typeof proto.setFlag === "function" && !proto.__add2eProjectileSpentSetFlagPatchedV3) {
    const originalSetFlag = proto.setFlag;
    proto.__add2eProjectileSpentSetFlagPatchedV3 = true;
    proto.setFlag = async function add2eProjectileSpentSetFlag(scope, key, value, ...rest) {
      if (!game.user?.isGM && scope === ADD2E_PROJECTILE_COMBAT_FLAG_SCOPE && key === ADD2E_PROJECTILE_COMBAT_FLAG_KEY) {
        add2eProjectileEmitSpentDeltas(this, value);
        return this;
      }
      return originalSetFlag.call(this, scope, key, value, ...rest);
    };
  }

  if (typeof proto.update === "function" && !proto.__add2eProjectileSpentUpdatePatchedV3) {
    const originalUpdate = proto.update;
    proto.__add2eProjectileSpentUpdatePatchedV3 = true;
    proto.update = async function add2eProjectileSpentUpdate(changed = {}, options = {}, ...rest) {
      if (!game.user?.isGM) {
        const value = add2eProjectileExtractSpentFromCombatUpdate(changed);
        if (value) {
          add2eProjectileEmitSpentDeltas(this, value);
          return this;
        }
      }
      return originalUpdate.call(this, changed, options, ...rest);
    };
  }

  return true;
}

function add2eRegisterProjectileSpentSocketPatch() {
  if (globalThis.__ADD2E_PROJECTILE_SPENT_SOCKET_PATCH_V3) return;
  globalThis.__ADD2E_PROJECTILE_SPENT_SOCKET_PATCH_V3 = true;

  game.socket?.on?.("system.add2e", data => {
    if (data?.type === ADD2E_PROJECTILE_SOCKET_TYPE) {
      add2eProjectileMergeSpentDeltas(data).catch(err => console.warn("[ADD2E][PROJECTILES][SOCKET_MERGE]", err));
      return;
    }
    if (data?.type === ADD2E_PROJECTILE_RECOVERY_SOCKET_TYPE && data.userId === game.user?.id) {
      add2eProjectileShowRecoveryPopup(data.rows ?? []).catch(err => console.warn("[ADD2E][PROJECTILES][SOCKET_RECOVERY_POPUP]", err));
    }
  });

  const candidates = new Set([
    CONFIG?.Combat?.documentClass?.prototype,
    foundry?.documents?.Combat?.prototype,
    game.combat?.constructor?.prototype
  ].filter(Boolean));

  for (const proto of candidates) add2ePatchCombatProjectileWrite(proto);
}

function add2eRegisterProjectileSpendUpdateGuard() {
  if (globalThis.__ADD2E_PROJECTILE_SPEND_UPDATE_GUARD_V1) return;
  const ItemClass = CONFIG?.Item?.documentClass ?? globalThis.Item;
  const proto = ItemClass?.prototype;
  if (!proto?.update) return;

  const originalUpdate = proto.update;
  globalThis.__ADD2E_PROJECTILE_SPEND_UPDATE_GUARD_V1 = true;
  proto.update = async function add2eProjectileSpendGuardedUpdate(data = {}, options = {}, ...rest) {
    if (options?.add2eReason === "projectile-spent-attack") {
      const actorId = this.parent?.id ?? "actor";
      const itemId = this.id ?? this.name ?? "item";
      const key = `${actorId}:${itemId}`;
      const now = Date.now();
      const last = globalThis.__ADD2E_PROJECTILE_LAST_ITEM_SPEND ?? {};
      globalThis.__ADD2E_PROJECTILE_LAST_ITEM_SPEND = last;
      if (last[key] && now - last[key] < 650) {
        return this;
      }
      last[key] = now;
    }
    return originalUpdate.call(this, data, options, ...rest);
  };
}

Hooks.on("renderActorSheet", bindOnRender);
Hooks.on("renderApplication", bindOnRender);
Hooks.on("createCombat", () => window.setTimeout(add2eRegisterProjectileSpentSocketPatch, 100));
Hooks.on("updateCombat", combat => window.setTimeout(add2eRegisterProjectileSpentSocketPatch, 100));
Hooks.on("deleteCombat", combat => {
  window.setTimeout(() => add2eProjectileShowRecoveryForCombat(combat), 100);
});
Hooks.on("updateCombat", (combat, changed) => {
  if (changed?.active === false || changed?.round === null) {
    window.setTimeout(() => add2eProjectileShowRecoveryForCombat(combat), 100);
  }
});

Hooks.once("ready", () => {
  add2eRegisterProjectileSpentSocketPatch();
  add2eRegisterProjectileSpendUpdateGuard();
});

for (const hookName of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(hookName, (item, _changes, _options, _userId) => {
    setTimeout(() => add2eRefreshActorSheetsForItemChange(item, hookName), 80);
  });
}

expose("add2eEnhanceCharacterSheetUi", add2eEnhanceCharacterSheetUi);
expose("add2eProjectileMergeSpentDeltas", add2eProjectileMergeSpentDeltas);
expose("add2eProjectileShowRecoveryPopup", add2eProjectileShowRecoveryPopup);
expose("add2eRegisterProjectileSpentSocketPatch", add2eRegisterProjectileSpentSocketPatch);
