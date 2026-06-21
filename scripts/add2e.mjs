/**
 * scripts/add2e.mjs
 * Point d'entrée ADD2E.
 * Fichier découpé en modules dans scripts/add2e/*.mjs.
 */
import "./add2e-initiative.mjs";
import "./add2e/00-legacy-global-helpers.mjs";
import "./add2e/spell-dialog-ui.mjs";
import "./add2e/item-sheet-registration.mjs";
import "./add2e/handlebars-helpers.mjs";
import "./add2e/character-sheet-templates.mjs";
import "./add2e/monster-sheet-capabilities.mjs";
import "./add2e/01-macros-base-caracs.mjs";
import "./add2e/02-spell-sync.mjs";
import "./add2e/02c-spell-family-expansion.mjs";
import "./add2e/02b-spell-sync-dedupe.mjs";
import "./add2e/03-equipment-rules.mjs";
import "./add2e/04-class-active-abilities.mjs";
import "./add2e/object-magic-powers.mjs";
import "./add2e/06-class-effects-thief.mjs";
import "./add2e/07-spellcasting-rules.mjs";
import "./add2e/09-race-class-drop.mjs";
import "./add2e/10-monk-rules.mjs";
import "./add2e/11-character-data-prep.mjs";
import "./add2e/12-carac-roller.mjs";
import "./add2e/13-actor-sheet-legacy.mjs";
import "./add2e/14-item-sheets.mjs";
import "./add2e/15-validation-sockets.mjs";
import "./add2e/16-preparation-display.mjs";
import "./add2e/17-movement-xp.mjs";
import "./add2e/17b-multiclass.mjs";
import "./add2e/17c-multiclass-mechanics.mjs";
import "./add2e/18-token-state-overlay.mjs";
import "./add2e/20-session-xp.mjs";
import "./add2e/21-consumables.mjs";
import "./add2e/24-player-trades.mjs";

function add2eSpellFamilyDropNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eSpellFamilyDropLevel(system = {}) {
  const raw = system.niveau ?? system.niveau_sort ?? system.spellLevel ?? system.level ?? 0;
  return Number(String(raw).match(/\d+/)?.[0] ?? 0) || 0;
}

function add2eSpellFamilyDropLists(system = {}) {
  const raw = [
    system.spellLists,
    system.lists,
    system.classes,
    system.classe,
    system.class,
    system.liste
  ];

  return new Set(raw.flatMap(value => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return value.split(/[,;|\n]+/g);
    return value === null || value === undefined ? [] : [value];
  }).map(add2eSpellFamilyDropNormalize).filter(Boolean));
}

function add2eActorAlreadyHasSpellFamily(actor, pendingItem) {
  const pendingName = add2eSpellFamilyDropNormalize(pendingItem?.name ?? pendingItem?.system?.nom);
  const pendingLevel = add2eSpellFamilyDropLevel(pendingItem?.system ?? {});
  const pendingLists = add2eSpellFamilyDropLists(pendingItem?.system ?? {});

  if (!pendingName) return false;

  return actor?.items?.some?.(item => {
    if (String(item?.type ?? "").toLowerCase() !== "sort") return false;

    const family = item.flags?.add2e?.spellFamily ?? {};
    if (family.generated !== true) return false;
    if (add2eSpellFamilyDropNormalize(family.sourceItemName) !== pendingName) return false;
    if (pendingLevel && add2eSpellFamilyDropLevel(item.system ?? {}) !== pendingLevel) return false;

    if (!pendingLists.size) return true;
    const existingLists = add2eSpellFamilyDropLists(item.system ?? {});
    return [...pendingLists].some(list => existingLists.has(list));
  }) ?? false;
}

Hooks.on("preCreateItem", (item, _data, options = {}, userId) => {
  if (String(userId ?? "") !== String(game.user?.id ?? "")) return;
  if (options?.add2eSpellFamilyExpansion || options?.add2eSpellSync) return;
  if (String(item?.type ?? "").toLowerCase() !== "sort") return;
  if (item.flags?.add2e?.spellFamily?.generated === true) return;

  const actor = item.actor ?? item.parent ?? null;
  if (!actor || actor.type !== "personnage") return;
  if (!add2eActorAlreadyHasSpellFamily(actor, item)) return;

  ui.notifications.warn(`"${item.name}" est déjà présent sur cet acteur.`);
  return false;
});
