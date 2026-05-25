// ADD2E — onUse Magicien : Bouclier
// Version : 2026-05-25-magicien-bouclier-v3-normalise
//
// Contrat avec scripts/add2e-attack/06-cast-spell.mjs :
// - return true  => le sort est lancé, le slot mémorisé réservé est consommé ;
// - return false => annulation technique, le slot mémorisé réservé est remboursé.
// La consommation du slot n'est PAS faite ici : elle est centralisée dans add2eCastSpell.

const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][BOUCLIER]";
const ADD2E_ACTOR = typeof actor !== "undefined" ? actor : null;
const ADD2E_ITEM = typeof item !== "undefined" ? item : (typeof sort !== "undefined" ? sort : (typeof spell !== "undefined" ? spell : null));
const ADD2E_TOKEN = typeof token !== "undefined" ? token : null;
const ADD2E_ARGS = typeof args !== "undefined" ? args : [];

const ADD2E_SORT_CONFIG = {
  name: "Bouclier",
  slug: "bouclier",
  level: 1,
  school: "Évocation",
  rangeText: "0",
  durationText: "5 rounds par niveau",
  castingTimeText: "1 segment",
  saveText: "Aucun",
  areaText: "spéciale",
  img: "systems/add2e/assets/icones/sorts/bouclier.webp",
  imgFallback: "icons/magic/defensive/shield-barrier-blue.webp"
};

function add2eClone(value) {
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
  return JSON.parse(JSON.stringify(value));
}

function add2eHtmlEscape(value) {
  const div = document.createElement("div");
  div.innerText = String(value ?? "");
  return div.innerHTML;
}

function add2eToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(add2eToArray).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
  return [value];
}

function add2eNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9:]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eSpellImg() {
  const img = String(ADD2E_ITEM?.img ?? "");
  if (img) return img;
  return ADD2E_SORT_CONFIG.imgFallback;
}

function add2eCasterLevel(actorDoc) {
  return Number(
    actorDoc?.system?.niveau ??
    actorDoc?.system?.level ??
    actorDoc?.system?.details?.niveau ??
    actorDoc?.system?.details?.level ??
    1
  ) || 1;
}

function add2eGetCasterToken(actorDoc) {
  return ADD2E_TOKEN
    ?? ADD2E_ARGS?.[0]?.token
    ?? canvas?.tokens?.controlled?.find(t => t.actor?.id === actorDoc?.id)
    ?? actorDoc?.getActiveTokens?.()?.[0]
    ?? canvas?.tokens?.controlled?.[0]
    ?? null;
}

function add2eEffectDuration(level) {
  return {
    rounds: Math.max(1, level) * 5,
    startRound: game.combat?.round ?? null,
    startTurn: game.combat?.turn ?? null,
    startTime: game.time?.worldTime ?? null,
    combat: game.combat?.id ?? null
  };
}

function add2eEmitGmOperation(operation, payload) {
  game.socket?.emit?.("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation,
    payload
  });
}

function add2eBuildBouclierEffect(actorDoc, level) {
  const rounds = Math.max(1, level) * 5;

  return {
    name: ADD2E_SORT_CONFIG.name,
    img: add2eSpellImg(),
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    origin: ADD2E_ITEM?.uuid ?? null,
    changes: [],
    duration: add2eEffectDuration(level),
    description: "Une barrière invisible se déplace devant le magicien et le protège des attaques frontales.",
    flags: {
      add2e: {
        tags: [
          "classe:magicien",
          "liste:magicien",
          "niveau:1",
          "sort:bouclier",
          "ecole:evocation",
          "type:protection",
          "type:defense",
          "immunite:missile_magique",
          "ca_fixe_projectile_lance:2",
          "ca_fixe_projectile_propulse:3",
          "ca_fixe_autres:4",
          "bonus_save_frontal:1",
          "condition:attaque_frontale",
          "duree:5_rounds_par_niveau",
          `duree_rounds:${rounds}`
        ],
        spell: {
          slug: ADD2E_SORT_CONFIG.slug,
          name: ADD2E_SORT_CONFIG.name,
          level: ADD2E_SORT_CONFIG.level,
          school: ADD2E_SORT_CONFIG.school,
          casterId: actorDoc?.id ?? null,
          casterUuid: actorDoc?.uuid ?? null,
          casterName: actorDoc?.name ?? "",
          durationRounds: rounds,
          acThrownProjectile: 2,
          acPropelledProjectile: 3,
          acOtherFrontal: 4,
          frontalSaveBonus: 1,
          magicMissileImmune: true,
          frontOnly: true,
          sourceItemId: ADD2E_ITEM?.id ?? null,
          sourceItemUuid: ADD2E_ITEM?.uuid ?? null
        }
      }
    }
  };
}

function add2eEffectIsBouclier(effect) {
  const name = add2eNormalize(effect?.name ?? effect?.label ?? "");
  const tags = add2eToArray(effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? []).map(add2eNormalize);
  const spell = effect?.flags?.add2e?.spell ?? effect?.getFlag?.("add2e", "spell") ?? {};
  return spell?.slug === ADD2E_SORT_CONFIG.slug
    || name.includes("bouclier")
    || tags.includes("sort:bouclier")
    || tags.includes("sort_bouclier")
    || tags.includes("immunite:missile_magique");
}

async function add2eDeleteExistingBouclier(actorDoc) {
  if (!actorDoc) return false;

  const effectIds = Array.from(actorDoc.effects ?? [])
    .filter(add2eEffectIsBouclier)
    .map(e => e.id)
    .filter(Boolean);

  if (!effectIds.length) return false;

  if (game.user?.isGM || actorDoc.isOwner) {
    await actorDoc.deleteEmbeddedDocuments("ActiveEffect", effectIds);
    return true;
  }

  add2eEmitGmOperation("deleteActiveEffects", {
    actorUuid: actorDoc.uuid,
    actorId: actorDoc.id,
    effectIds,
    tags: ["sort:bouclier", "immunite:missile_magique"],
    names: ["Bouclier"]
  });
  return true;
}

async function add2eApplyBouclierEffect(actorDoc, effectData) {
  if (!actorDoc || !effectData) return false;

  const casterToken = add2eGetCasterToken(actorDoc);
  const payload = {
    actorUuid: actorDoc.uuid,
    actorId: actorDoc.id,
    sceneId: canvas?.scene?.id ?? null,
    tokenId: casterToken?.document?.id ?? casterToken?.id ?? null,
    effectData
  };

  if (game.user?.isGM || actorDoc.isOwner) {
    try {
      await actorDoc.createEmbeddedDocuments("ActiveEffect", [add2eClone(effectData)]);
      return true;
    } catch (err) {
      console.warn(`${ADD2E_ONUSE_TAG}[DIRECT_EFFECT_FAILED] Passage par relais MJ.`, err);
    }
  }

  add2eEmitGmOperation("createActiveEffect", payload);
  return true;
}

function add2eRegisterBouclierVfxHooks() {
  if (globalThis.ADD2E_BOUCLIER_VFX_HOOKS_REGISTERED) return;
  globalThis.ADD2E_BOUCLIER_VFX_HOOKS_REGISTERED = true;

  const stopVfx = effect => {
    if (!add2eEffectIsBouclier(effect)) return;
    const actorDoc = effect?.parent;
    for (const tokenDoc of actorDoc?.getActiveTokens?.() ?? []) {
      const visName = `bouclier-effect-${tokenDoc.id}`;
      try { globalThis.Sequencer?.EffectManager?.endEffects?.({ name: visName, object: tokenDoc }); } catch (_err) {}
    }
  };

  Hooks.on("deleteActiveEffect", stopVfx);
  Hooks.on("updateActiveEffect", (effect, changes) => {
    if (changes?.disabled === true || changes?.disabled === 1) stopVfx(effect);
  });
}

function add2ePlayBouclierVfx(actorDoc) {
  const casterToken = add2eGetCasterToken(actorDoc);
  if (!casterToken || typeof Sequence !== "function") return false;

  let jb2aPath = null;
  if (game.modules.get("jb2a_patreon")?.active) {
    jb2aPath = "modules/jb2a_patreon/Library/1st_Level/Shield/Shield_02_Regular_Blue_Complete_400x400.webm";
  } else if (game.modules.get("jb2a_free")?.active) {
    jb2aPath = "modules/jb2a_free/Library/1st_Level/Shield/Shield_01_Regular_Blue_Intro_400x400.webm";
  }

  if (!jb2aPath) return false;

  const visName = `bouclier-effect-${casterToken.id}`;
  try { globalThis.Sequencer?.EffectManager?.endEffects?.({ name: visName, object: casterToken }); } catch (_err) {}

  new Sequence()
    .effect()
    .file(jb2aPath)
    .attachTo(casterToken)
    .persist(true)
    .name(visName)
    .belowTokens(false)
    .scale(0.70)
    .opacity(0.85)
    .play();

  return true;
}

async function add2eChatBouclier(actorDoc, level) {
  const casterToken = add2eGetCasterToken(actorDoc);
  const casterName = actorDoc?.name ?? casterToken?.name ?? "Magicien";
  const casterImg = casterToken?.document?.texture?.src ?? actorDoc?.img ?? "icons/svg/mystery-man.svg";
  const spellImg = add2eSpellImg();
  const rounds = Math.max(1, level) * 5;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actorDoc, token: casterToken }),
    content: `
      <div class="add2e-chat-card add2e-magicien-sort add2e-sort-bouclier"
           style="border:1px solid #8e63c7;border-radius:8px;overflow:hidden;background:#f6f0ff;color:#2d2144;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:8px;background:#5b3f8c;color:#fff;padding:7px 9px;">
          <img src="${add2eHtmlEscape(casterImg)}" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:2px solid #d8c3ff;background:#fff;" />
          <div style="flex:1;line-height:1.05;">
            <div style="font-weight:800;font-size:14px;">${add2eHtmlEscape(casterName)}</div>
            <div style="font-size:12px;font-weight:700;">lance ${add2eHtmlEscape(ADD2E_SORT_CONFIG.name)}</div>
          </div>
          <div style="font-weight:800;font-size:12px;text-align:center;white-space:nowrap;">Magicien niv. 1</div>
          <img src="${add2eHtmlEscape(spellImg)}" style="width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid #d8c3ff;background:#fff;" />
        </div>

        <div style="padding:9px 10px 10px 10px;background:#f6f0ff;">
          <div style="border:1px solid #8e63c7;border-radius:6px;background:#fffaff;padding:8px;margin-bottom:7px;">
            <div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;text-align:center;">Barrière invisible</div>
            <p style="margin:.35em 0;font-size:13px;line-height:1.35;">Une force invisible se dresse devant le magicien et se déplace avec lui.</p>
            <p style="margin:.35em 0;font-size:13px;line-height:1.35;">Elle détourne les attaques frontales et arrête les projectiles magiques.</p>
            <p style="margin:.35em 0;font-size:13px;line-height:1.35;"><b>Durée :</b> ${rounds} round${rounds > 1 ? "s" : ""}.</p>
          </div>

          <details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;margin-top:7px;">
            <summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Paramètres du sort</summary>
            <div style="margin-top:5px;font-size:12px;line-height:1.35;">
              <p><b>École :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.school)} — <b>Portée :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.rangeText)}.</p>
              <p><b>Durée :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.durationText)} — <b>Zone :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.areaText)}.</p>
              <p><b>Composantes :</b> V, S — <b>Incantation :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.castingTimeText)} — <b>Jet de sauvegarde :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.saveText)}.</p>
              <p>Les avantages ne valent que contre les attaques frontales.</p>
            </div>
          </details>
        </div>
      </div>`
  });
}

if (!ADD2E_ACTOR) {
  ui.notifications?.warn?.("Bouclier : acteur lanceur introuvable.");
  console.warn(`${ADD2E_ONUSE_TAG}[NO_ACTOR] Acteur lanceur introuvable.`);
  return false;
}

add2eRegisterBouclierVfxHooks();

const level = add2eCasterLevel(ADD2E_ACTOR);
const effectData = add2eBuildBouclierEffect(ADD2E_ACTOR, level);

console.log(`${ADD2E_ONUSE_TAG}[START]`, {
  actor: ADD2E_ACTOR?.name,
  sort: ADD2E_ITEM?.name,
  level,
  durationRounds: Math.max(1, level) * 5
});

await add2eDeleteExistingBouclier(ADD2E_ACTOR);
const effectRequested = await add2eApplyBouclierEffect(ADD2E_ACTOR, effectData);
add2ePlayBouclierVfx(ADD2E_ACTOR);
await add2eChatBouclier(ADD2E_ACTOR, level);

console.log(`${ADD2E_ONUSE_TAG}[DONE]`, {
  consumedByDispatcher: true,
  effectRequested,
  durationRounds: Math.max(1, level) * 5
});

return true;
