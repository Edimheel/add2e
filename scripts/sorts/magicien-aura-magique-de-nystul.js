// ADD2E — onUse Magicien : Aura magique de Nystul
// Version : 2026-05-25-magicien-aura-magique-nystul-v3-objets-portes
//
// Contrat avec scripts/add2e-attack/06-cast-spell.mjs :
// - return true  => le sort est lancé, le slot mémorisé réservé est consommé ;
// - return false => annulation volontaire, le slot mémorisé réservé est remboursé.
// La consommation du slot n'est PAS faite ici : elle est centralisée dans add2eCastSpell.

const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][AURA_MAGIQUE_DE_NYSTUL]";
const ADD2E_ACTOR = typeof actor !== "undefined" ? actor : null;
const ADD2E_ITEM = typeof item !== "undefined" ? item : (typeof sort !== "undefined" ? sort : null);
const ADD2E_TOKEN = typeof token !== "undefined" ? token : null;
const ADD2E_ARGS = typeof args !== "undefined" ? args : [];

const ADD2E_SORT_CONFIG = {
  name: "Aura magique de Nystul",
  slug: "aura_magique_de_nystul",
  level: 1,
  school: "Illusion/Fantasme",
  rangeText: "au toucher",
  durationText: "1 jour par niveau",
  castingTimeText: "1 round",
  saveText: "Spécial",
  areaText: "spéciale",
  img: "systems/add2e/assets/icones/sorts/magicien-aura-magique-de-nystul.webp",
  imgFallback: "icons/magic/symbols/rune-sigil-purple.webp"
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

function add2eNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(add2eToArray).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
  return [value];
}

function add2eSpellImg() {
  return ADD2E_ITEM?.img || ADD2E_SORT_CONFIG.img || ADD2E_SORT_CONFIG.imgFallback;
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

function add2eGetFirstTarget() {
  return Array.from(game.user?.targets ?? [])[0] ?? null;
}

function add2eDuration(level) {
  return {
    seconds: Math.max(1, level) * 24 * 60 * 60,
    startTime: game.time?.worldTime ?? null,
    rounds: undefined,
    startRound: game.combat?.round ?? null,
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

function add2eAuraTypeLabel(type) {
  if (type === "aura_masquee") return "son aura magique est voilée par une illusion";
  if (type === "aura_modifiee") return "son aura magique paraît d'une autre nature";
  return "il semble désormais porter une aura magique";
}

function add2eSchoolLabel(value) {
  const map = {
    abjuration: "abjuration",
    alteration: "altération",
    conjuration: "conjuration",
    divination: "divination",
    enchantement_charme: "enchantement/charme",
    evocation: "évocation",
    illusion_fantasme: "illusion/fantasme",
    necromancie: "nécromancie",
    aucune: "aucune aura perceptible",
    indeterminee: "nature indéterminée"
  };
  return map[value] ?? value;
}

function add2eIsItemCarried(item) {
  const s = item?.system ?? {};
  return s.equipee === true
    || s.equipped === true
    || s.portee === true
    || s.worn === true
    || s.tenu === true
    || s.carried === true;
}

function add2eActorItemsForAura(actorDoc) {
  return Array.from(actorDoc?.items ?? [])
    .filter(i => !["classe", "race", "sort"].includes(String(i?.type ?? "").toLowerCase()))
    .sort((a, b) => {
      const ac = add2eIsItemCarried(a) ? 0 : 1;
      const bc = add2eIsItemCarried(b) ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return String(a.name).localeCompare(String(b.name));
    });
}

function add2eEffectIsNystulAura(effect) {
  if (!effect || effect.disabled) return false;
  const spell = effect.flags?.add2e?.spell ?? effect.getFlag?.("add2e", "spell") ?? {};
  const tags = add2eToArray(effect.flags?.add2e?.tags ?? effect.getFlag?.("add2e", "tags") ?? []).map(add2eNormalize);
  return spell?.slug === ADD2E_SORT_CONFIG.slug
    || tags.includes("sort_aura_magique_de_nystul")
    || tags.includes("sort:aura_magique_de_nystul")
    || add2eNormalize(effect.name).includes("aura_magique_de_nystul");
}

function add2eEffectMatchesItem(effect, item) {
  if (!effect || !item) return false;
  const spell = effect.flags?.add2e?.spell ?? effect.getFlag?.("add2e", "spell") ?? {};
  const itemId = spell?.itemId ?? spell?.objectItemId ?? null;
  const itemUuid = spell?.itemUuid ?? spell?.objectItemUuid ?? null;
  const objectName = spell?.objectName ?? "";
  return itemId === item.id
    || itemUuid === item.uuid
    || add2eNormalize(objectName) === add2eNormalize(item.name);
}

function add2eItemAuraInfo(actorDoc, item) {
  const effects = Array.from(actorDoc?.effects ?? [])
    .filter(add2eEffectIsNystulAura)
    .filter(e => add2eEffectMatchesItem(e, item));

  const effect = effects[0] ?? null;
  if (!effect) return { active: false, label: "", effect: null };

  const spell = effect.flags?.add2e?.spell ?? effect.getFlag?.("add2e", "spell") ?? {};
  const auraType = spell?.auraType ?? "aura_active";
  const school = spell?.apparentSchool ?? "indeterminee";
  const label = `✨ aura active : ${add2eAuraTypeLabel(auraType)}, ${add2eSchoolLabel(school)}`;
  return { active: true, label, effect };
}

function add2eBuildObjectCandidates(casterActor) {
  const targetToken = add2eGetFirstTarget();
  const holders = [];

  if (casterActor) holders.push({ actor: casterActor, token: add2eGetCasterToken(casterActor), label: casterActor.name });
  if (targetToken?.actor && targetToken.actor.id !== casterActor?.id) holders.push({ actor: targetToken.actor, token: targetToken, label: targetToken.name });

  const seen = new Set();
  const candidates = [];

  for (const holder of holders) {
    for (const item of add2eActorItemsForAura(holder.actor)) {
      const key = `${holder.actor.id}:${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const carried = add2eIsItemCarried(item);
      const aura = add2eItemAuraInfo(holder.actor, item);
      const typeLabel = String(item.type ?? "objet");

      candidates.push({
        kind: "item",
        actor: holder.actor,
        token: holder.token,
        item,
        carried,
        aura,
        label: `${holder.label} — ${item.name} [${typeLabel}${carried ? ", porté" : ""}]${aura.active ? ` — ${aura.label}` : ""}`
      });
    }
  }

  candidates.push({
    kind: "manual",
    actor: casterActor,
    token: add2eGetCasterToken(casterActor),
    item: null,
    carried: false,
    aura: { active: false, label: "", effect: null },
    label: "Objet non listé / élément du décor"
  });

  return candidates;
}

function add2eReadFormValue(form, name) {
  if (!form) return "";
  return String(new FormData(form).get(name) ?? "");
}

function add2eDialogForm(button, dialog, fallbackId) {
  return button?.form
    ?? dialog?.element?.querySelector?.("form")
    ?? dialog?.element?.[0]?.querySelector?.("form")
    ?? document.getElementById(fallbackId)
    ?? null;
}

async function add2eAskAuraNystul(casterActor) {
  const candidates = add2eBuildObjectCandidates(casterActor);
  const formId = `add2e-aura-nystul-${foundry?.utils?.randomID?.(8) ?? Date.now()}`;
  const options = candidates.map((c, index) => `<option value="${index}">${add2eHtmlEscape(c.label)}</option>`).join("");

  const content = `
    <form id="${formId}" class="add2e-dialog add2e-aura-nystul-dialog">
      <p style="margin:0 0 8px 0;"><b>Objet touché</b></p>
      <div class="form-group">
        <label>Objet porté ou cible du sort</label>
        <select name="candidateIndex">${options}</select>
      </div>

      <div class="form-group">
        <label>Si l'objet n'est pas listé</label>
        <input type="text" name="manualObject" placeholder="Ex. coffre, pierre, porte, parchemin..." />
      </div>

      <div class="form-group">
        <label>Effet souhaité</label>
        <select name="auraType">
          <option value="fausse_magie">Ajouter une aura magique</option>
          <option value="aura_masquee">Masquer une aura magique</option>
          <option value="aura_modifiee">Modifier la nature apparente de l'aura</option>
        </select>
      </div>

      <div class="form-group">
        <label>Nature apparente</label>
        <select name="apparentSchool">
          <option value="indeterminee">Indéterminée</option>
          <option value="aucune">Aucune aura perceptible</option>
          <option value="abjuration">Abjuration</option>
          <option value="alteration">Altération</option>
          <option value="conjuration">Conjuration</option>
          <option value="divination">Divination</option>
          <option value="enchantement_charme">Enchantement/Charme</option>
          <option value="evocation">Évocation</option>
          <option value="illusion_fantasme">Illusion/Fantasme</option>
          <option value="necromancie">Nécromancie</option>
        </select>
      </div>
    </form>
  `;

  const readChoice = form => {
    const index = Number(add2eReadFormValue(form, "candidateIndex"));
    const candidate = candidates[index] ?? candidates[candidates.length - 1];
    const manualObject = add2eReadFormValue(form, "manualObject").trim();
    const item = candidate.kind === "item" ? candidate.item : null;
    const objectLabel = item?.name || manualObject || "Objet touché";

    return {
      candidate,
      carrierActor: candidate.actor ?? casterActor,
      carrierToken: candidate.token ?? add2eGetCasterToken(casterActor),
      item,
      objectLabel,
      auraAlreadyActive: candidate.aura?.active === true,
      existingAuraLabel: candidate.aura?.label ?? "",
      auraType: add2eReadFormValue(form, "auraType") || "fausse_magie",
      apparentSchool: add2eReadFormValue(form, "apparentSchool") || "indeterminee"
    };
  };

  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (DialogV2?.wait) {
    return await DialogV2.wait({
      window: { title: ADD2E_SORT_CONFIG.name },
      content,
      modal: true,
      rejectClose: false,
      buttons: [
        {
          action: "cast",
          label: "Lancer",
          default: true,
          callback: (event, button, dialog) => readChoice(add2eDialogForm(button, dialog, formId))
        },
        {
          action: "cancel",
          label: "Annuler",
          callback: () => null
        }
      ]
    });
  }

  return await new Promise(resolve => {
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      resolve(value);
    };

    new Dialog({
      title: ADD2E_SORT_CONFIG.name,
      content,
      buttons: {
        cast: {
          label: "Lancer",
          callback: html => finish(readChoice(html[0]?.querySelector?.("form") ?? document.getElementById(formId)))
        },
        cancel: {
          label: "Annuler",
          callback: () => finish(null)
        }
      },
      default: "cast",
      close: () => finish(null)
    }).render(true);
  });
}

function add2eBuildAuraEffect({ casterActor, choice, level }) {
  const objectLabel = choice.objectLabel || "Objet touché";
  const item = choice.item ?? null;
  const objectSlug = add2eNormalize(item?.id || objectLabel || "objet_touche");
  const auraType = add2eNormalize(choice.auraType || "fausse_magie");
  const apparentSchool = add2eNormalize(choice.apparentSchool || "indeterminee");
  const durationDays = Math.max(1, level);

  return {
    name: `${ADD2E_SORT_CONFIG.name} — ${objectLabel}`,
    img: add2eSpellImg(),
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [],
    duration: add2eDuration(level),
    origin: ADD2E_ITEM?.uuid ?? null,
    description: `${objectLabel} porte une aura magique illusoire pendant ${durationDays} jour${durationDays > 1 ? "s" : ""}.`,
    flags: {
      add2e: {
        tags: [
          "classe:magicien",
          "liste:magicien",
          "niveau:1",
          "sort:aura_magique_de_nystul",
          "ecole:illusion_fantasme",
          "type:illusion",
          "type:fantasme",
          "type:objet",
          "aura:magique",
          "aura:illusoire",
          `aura_type:${auraType}`,
          `aura_apparente:${apparentSchool}`,
          `objet:${objectSlug}`,
          item ? `item_id:${item.id}` : "item_id:manuel",
          "detection_magie:fausse_information",
          "identification:peut_tromper",
          "jet_sauvegarde:special",
          "duree:1_jour_par_niveau",
          `duree_jours:${durationDays}`
        ],
        spell: {
          slug: ADD2E_SORT_CONFIG.slug,
          name: ADD2E_SORT_CONFIG.name,
          level: ADD2E_SORT_CONFIG.level,
          school: ADD2E_SORT_CONFIG.school,
          casterId: casterActor?.id ?? null,
          casterUuid: casterActor?.uuid ?? null,
          casterName: casterActor?.name ?? "",
          carrierActorId: choice.carrierActor?.id ?? null,
          carrierActorUuid: choice.carrierActor?.uuid ?? null,
          carrierActorName: choice.carrierActor?.name ?? "",
          objectName: objectLabel,
          itemId: item?.id ?? null,
          itemUuid: item?.uuid ?? null,
          auraAlreadyActive: choice.auraAlreadyActive === true,
          previousAuraLabel: choice.existingAuraLabel ?? "",
          auraType,
          apparentSchool,
          casterLevel: level,
          durationDays,
          sourceItemId: ADD2E_ITEM?.id ?? null,
          sourceItemUuid: ADD2E_ITEM?.uuid ?? null
        }
      }
    }
  };
}

async function add2eApplyAuraEffect(choice, effectData) {
  const targetActor = choice?.carrierActor ?? ADD2E_ACTOR;
  if (!targetActor || !effectData) return false;

  const payload = {
    actorUuid: targetActor.uuid,
    actorId: targetActor.id,
    sceneId: canvas?.scene?.id ?? null,
    tokenId: choice?.carrierToken?.document?.id ?? choice?.carrierToken?.id ?? null,
    effectData
  };

  if (game.user?.isGM || targetActor.isOwner) {
    try {
      await targetActor.createEmbeddedDocuments("ActiveEffect", [add2eClone(effectData)]);
      return true;
    } catch (err) {
      console.warn(`${ADD2E_ONUSE_TAG}[DIRECT_EFFECT_FAILED] Passage par relais MJ.`, err);
    }
  }

  add2eEmitGmOperation("createActiveEffect", payload);
  return true;
}

async function add2eChatAuraNystul(actorDoc, choice, level) {
  const casterToken = add2eGetCasterToken(actorDoc);
  const casterName = actorDoc?.name ?? casterToken?.name ?? "Magicien";
  const casterImg = casterToken?.document?.texture?.src ?? actorDoc?.img ?? "icons/svg/mystery-man.svg";
  const spellImg = add2eSpellImg();
  const durationDays = Math.max(1, level);
  const auraLabel = add2eAuraTypeLabel(choice.auraType);
  const schoolLabel = add2eSchoolLabel(choice.apparentSchool);
  const objectLabel = choice.objectLabel || "Objet touché";
  const carriedBy = choice.carrierActor?.name ? ` porté par ${choice.carrierActor.name}` : "";
  const already = choice.auraAlreadyActive ? `<p style="margin:.35em 0;font-size:13px;line-height:1.35;">Une aura précédente était déjà perceptible sur cet objet.</p>` : "";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actorDoc, token: casterToken }),
    content: `
      <div class="add2e-chat-card add2e-magicien-sort add2e-sort-aura-nystul"
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
            <div style="color:#6c31b5;font-weight:900;font-size:14px;text-transform:uppercase;letter-spacing:.3px;text-align:center;">Aura illusoire</div>
            <p style="margin:.35em 0;font-size:13px;line-height:1.35;">Le magicien effleure <b>${add2eHtmlEscape(objectLabel)}</b>${add2eHtmlEscape(carriedBy)} et y dépose une empreinte trompeuse.</p>
            <p style="margin:.35em 0;font-size:13px;line-height:1.35;">${add2eHtmlEscape(auraLabel)} ; sa nature apparente évoque ${add2eHtmlEscape(schoolLabel)}.</p>
            ${already}
            <p style="margin:.35em 0;font-size:13px;line-height:1.35;"><b>Durée :</b> ${durationDays} jour${durationDays > 1 ? "s" : ""}.</p>
          </div>

          <details style="border:1px solid #8e63c7;border-radius:5px;background:#fffaff;padding:5px 7px;margin-top:7px;">
            <summary style="cursor:pointer;font-weight:800;color:#4a2e78;">Paramètres du sort</summary>
            <div style="margin-top:5px;font-size:12px;line-height:1.35;">
              <p><b>École :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.school)} — <b>Portée :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.rangeText)}.</p>
              <p><b>Zone :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.areaText)} — <b>Jet de sauvegarde :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.saveText)}.</p>
              <p><b>Composantes :</b> V, S, M — <b>Incantation :</b> ${add2eHtmlEscape(ADD2E_SORT_CONFIG.castingTimeText)}.</p>
            </div>
          </details>
        </div>
      </div>`
  });
}

if (!ADD2E_ACTOR) {
  ui.notifications?.warn?.("Aura magique de Nystul : acteur lanceur introuvable.");
  console.warn(`${ADD2E_ONUSE_TAG}[NO_ACTOR] Acteur lanceur introuvable.`);
  return false;
}

const choice = await add2eAskAuraNystul(ADD2E_ACTOR);
if (!choice) {
  console.log(`${ADD2E_ONUSE_TAG}[CANCEL] Sort annulé volontairement.`);
  return false;
}

const level = add2eCasterLevel(ADD2E_ACTOR);
const effectData = add2eBuildAuraEffect({ casterActor: ADD2E_ACTOR, choice, level });
const effectRequested = await add2eApplyAuraEffect(choice, effectData);

console.log(`${ADD2E_ONUSE_TAG}[START]`, {
  actor: ADD2E_ACTOR?.name,
  sort: ADD2E_ITEM?.name,
  level,
  carrier: choice.carrierActor?.name ?? null,
  objectLabel: choice.objectLabel,
  item: choice.item?.name ?? null,
  auraAlreadyActive: choice.auraAlreadyActive,
  auraType: choice.auraType,
  apparentSchool: choice.apparentSchool,
  effectRequested
});

await add2eChatAuraNystul(ADD2E_ACTOR, choice, level);

console.log(`${ADD2E_ONUSE_TAG}[DONE]`, {
  consumedByDispatcher: true,
  objectLabel: choice.objectLabel,
  effectRequested,
  durationDays: Math.max(1, level)
});

return true;
