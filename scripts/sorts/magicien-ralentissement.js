// ADD2E — onUse Magicien : Ralentissement
// Compatible Foundry V13/V14/V15.
// Effet de mouvement résolu par le domaine canonique movement.

const ADD2E_SORT_VERSION = "2026-07-30-ralentissement-canonical-movement-v1";
const ADD2E_SORT_TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][RALENTISSEMENT]";
const ADD2E_CONTEXT_ACTOR = typeof actor !== "undefined" ? actor : null;
const ADD2E_CONTEXT_ITEM = typeof item !== "undefined" ? item : null;
const ADD2E_CONTEXT_TOKEN = typeof token !== "undefined" ? token : null;
const ADD2E_CONTEXT_ARGS = typeof args !== "undefined" ? args : null;

function add2eCasterToken() {
  return ADD2E_CONTEXT_TOKEN
    ?? ADD2E_CONTEXT_ARGS?.[0]?.token
    ?? canvas?.tokens?.controlled?.[0]
    ?? null;
}

function add2eCasterActor() {
  return ADD2E_CONTEXT_ACTOR ?? add2eCasterToken()?.actor ?? null;
}

function add2eCasterLevel(caster) {
  return Math.max(1, Number(
    caster?.system?.niveau
    ?? caster?.system?.level
    ?? caster?.system?.details?.niveau
    ?? 1
  ) || 1);
}

function add2eTagList(effect) {
  const raw = effect?.flags?.add2e?.tags ?? [];
  if (Array.isArray(raw)) return raw.map(value => String(value));
  if (raw instanceof Set) return [...raw].map(value => String(value));
  return String(raw ?? "").split(/[,;|\n]+/g).map(value => value.trim()).filter(Boolean);
}

function add2eEffectHasTag(effect, tag) {
  return add2eTagList(effect).includes(tag);
}

function add2eTargetActors(caster) {
  const selected = Array.from(game.user?.targets ?? [])
    .map(target => target?.actor)
    .filter(Boolean);
  if (selected.length) return [...new Map(selected.map(target => [target.uuid ?? target.id, target])).values()];
  return caster ? [caster] : [];
}

async function add2eApplySpeedEffect(targetActor, rounds) {
  const effects = Array.from(targetActor?.effects?.contents ?? targetActor?.effects ?? []);
  const ownTag = "sort:ralentissement";
  const oppositeTag = "sort:rapidite";
  const own = effects.filter(effect => add2eEffectHasTag(effect, ownTag));
  const opposite = effects.filter(effect => add2eEffectHasTag(effect, oppositeTag));

  if (opposite.length) {
    const ids = [...opposite, ...own].map(effect => effect.id).filter(Boolean);
    if (ids.length) await targetActor.deleteEmbeddedDocuments("ActiveEffect", [...new Set(ids)]);
    return { targetActor, outcome: "cancelled", removed: opposite.map(effect => effect.name) };
  }

  const ownIds = own.map(effect => effect.id).filter(Boolean);
  if (ownIds.length) await targetActor.deleteEmbeddedDocuments("ActiveEffect", ownIds);

  const sourceId = String(ADD2E_CONTEXT_ITEM?.id ?? "ralentissement");
  const sourceUuid = String(ADD2E_CONTEXT_ITEM?.uuid ?? "");
  await targetActor.createEmbeddedDocuments("ActiveEffect", [{
    name: ADD2E_CONTEXT_ITEM?.name ?? "Ralentissement",
    img: ADD2E_CONTEXT_ITEM?.img ?? "icons/svg/aura.svg",
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [],
    duration: {
      rounds,
      startRound: game.combat?.round ?? null,
      startTurn: game.combat?.turn ?? null,
      startTime: game.time?.worldTime ?? null,
      combat: game.combat?.id ?? null
    },
    description: "La vitesse de déplacement et le nombre d’attaques sont divisés par deux.",
    flags: {
      add2e: {
        version: ADD2E_SORT_VERSION,
        sourceType: "spell",
        sourceItemId: sourceId,
        sourceItemUuid: sourceUuid,
        tags: [
          ownTag,
          "classe:magicien",
          "liste:magicien",
          "niveau:3",
          "type:condition",
          "etat:ralentissement"
        ],
        modifiers: [{
          id: `spell:${sourceId}:ralentissement:movement-ground`,
          domain: "movement",
          target: "ground",
          operation: "multiply",
          value: 0.5,
          priority: 200,
          stacking: {
            mode: "exclusive",
            group: "spell-speed-movement"
          },
          conditions: {
            active: true
          },
          metadata: {
            spell: "ralentissement",
            modes: ["ground"]
          }
        }]
      }
    }
  }]);

  return { targetActor, outcome: "applied", removed: [] };
}

async function add2eCreateResultCard(caster, results, rounds) {
  const build = globalThis.add2eBuildChatCard;
  const create = globalThis.add2eCreateChatCard;
  if (typeof build !== "function" || typeof create !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }

  const applied = results.filter(result => result.outcome === "applied").map(result => result.targetActor.name);
  const cancelled = results.filter(result => result.outcome === "cancelled").map(result => result.targetActor.name);
  const rows = [
    { label: "Cibles", value: results.map(result => result.targetActor.name).join(", ") || "Aucune" },
    { label: "Durée", value: `${rounds} rounds` },
    { label: "Mouvement", value: "×0,5" },
    { label: "Effet", value: "divise par deux aussi le nombre d’attaques" }
  ];
  if (applied.length) rows.push({ label: "Effet appliqué", value: applied.join(", ") });
  if (cancelled.length) rows.push({ label: "Rapidité annulée", value: cancelled.join(", ") });

  const options = {
    actor: caster,
    title: ADD2E_CONTEXT_ITEM?.name ?? "Ralentissement",
    icon: "fas fa-hourglass-half",
    variant: "warning",
    source: {
      name: caster?.name ?? "Magicien",
      img: caster?.img,
      type: "Sort profane"
    },
    rows,
    message: "La vitesse de déplacement et le nombre d’attaques sont divisés par deux.",
    chatData: {
      flags: {
        add2e: {
          spellEffect: "ralentissement",
          version: ADD2E_SORT_VERSION
        }
      }
    }
  };

  const preview = build(options);
  if (!String(preview ?? "").trim()) throw new Error("La carte ADD2E générée est vide.");
  return create(options);
}

const caster = add2eCasterActor();
if (!caster) {
  ui.notifications.error("Ralentissement : lanceur introuvable.");
  return false;
}

const level = add2eCasterLevel(caster);
const rounds = 3 + level;
const targets = add2eTargetActors(caster);
if (!targets.length) {
  ui.notifications.warn("Ralentissement : aucune cible disponible.");
  return false;
}
if (targets.length > level) {
  ui.notifications.warn(`Ralentissement peut affecter au maximum ${level} créature(s) au niveau ${level}.`);
  return false;
}

console.log(`${ADD2E_SORT_TAG}[START]`, {
  version: ADD2E_SORT_VERSION,
  caster: caster.name,
  level,
  rounds,
  targets: targets.map(target => target.name)
});

const results = [];
for (const targetActor of targets) results.push(await add2eApplySpeedEffect(targetActor, rounds));
await add2eCreateResultCard(caster, results, rounds);

console.log(`${ADD2E_SORT_TAG}[DONE]`, {
  applied: results.filter(result => result.outcome === "applied").map(result => result.targetActor.name),
  cancelled: results.filter(result => result.outcome === "cancelled").map(result => result.targetActor.name)
});
return true;
