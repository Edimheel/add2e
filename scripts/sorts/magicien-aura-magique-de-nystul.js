// ADD2E — onUse Magicien : Aura magique de Nystul
// Version : 2026-05-25-magicien-aura-magique-nystul-v1
//
// Contrat avec scripts/add2e-attack/06-cast-spell.mjs :
// - return true  => le sort est lancé, le slot mémorisé réservé est consommé ;
// - return false => annulation technique, le slot mémorisé réservé est remboursé.
// La consommation du slot n'est PAS faite ici : elle est centralisée dans add2eCastSpell.

const ADD2E_ONUSE_TAG = "[ADD2E][SORT_ONUSE][MAGICIEN][AURA_MAGIQUE_DE_NYSTUL]";
const ADD2E_ACTOR = typeof actor !== "undefined" ? actor : null;
const ADD2E_ITEM = typeof item !== "undefined" ? item : null;
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
  imgFallback: "icons/magic/symbols/rune-sigil-purple.webp"
};

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
  const seconds = Math.max(1, level) * 24 * 60 * 60;
  return {
    seconds,
    startTime: game.time?.worldTime ?? null,
    rounds: undefined,
    startRound: game.combat?.round ?? null,
    combat: game.combat?.id ?? null
  };
}

function add2eCarrierOptions(casterActor, targetToken) {
  const options = [];
  if (casterActor) options.push({ id: "caster", label: `${casterActor.name} — objets portés`, actor: casterActor, token: add2eGetCasterToken(casterActor) });
  if (targetToken?.actor && targetToken.actor?.id !== casterActor?.id) options.push({ id: "target", label: `${targetToken.name} — objets portés`, actor: targetToken.actor, token: targetToken });
  options.push({ id: "manual", label: "Objet non représenté sur une feuille", actor: null, token: null });
  return options;
}

function add2eActorItemsForAura(actorDoc) {
  return Array.from(actorDoc?.items ?? [])
    .filter(i => !["classe", "race", "sort"].includes(String(i?.type ?? "").toLowerCase()))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function add2eAskAuraNystul(casterActor) {
  const targetToken = add2eGetFirstTarget();
  const carriers = add2eCarrierOptions(casterActor, targetToken);

  const carrierOptions = carriers.map(c => `<option value="${add2eHtmlEscape(c.id)}">${add2eHtmlEscape(c.label)}</option>`).join("");
  const casterItems = add2eActorItemsForAura(casterActor);
  const targetItems = add2eActorItemsForAura(targetToken?.actor ?? null);

  const itemOptionsByCarrier = {
    caster: casterItems.map(i => `<option value="${add2eHtmlEscape(i.id)}">${add2eHtmlEscape(i.name)}</option>`).join(""),
    target: targetItems.map(i => `<option value="${add2eHtmlEscape(i.id)}">${add2eHtmlEscape(i.name)}</option>`).join(""),
    manual: ""
  };

  return await new Promise(resolve => {
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      resolve(value);
    };

    new Dialog({
      title: ADD2E_SORT_CONFIG.name,
      content: `
        <form class="add2e-dialog add2e-aura-nystul-dialog">
          <p><b>${add2eHtmlEscape(ADD2E_SORT_CONFIG.name)}</b></p>
          <p>Choisis l'objet touché et l'aura que le sort doit lui donner.</p>

          <div class="form-group">
            <label>Objet porté par</label>
            <select name="carrier">${carrierOptions}</select>
          </div>

          <div class="form-group add2e-nystul-item-row">
            <label>Objet</label>
            <select name="itemId"></select>
          </div>

          <div class="form-group">
            <label>Objet non représenté / précision</label>
            <input type="text" name="manualObject" placeholder="Ex. coffre, anneau, dague, parchemin..." />
          </div>

          <div class="form-group">
            <label>Aura perçue</label>
            <select name="auraType">
              <option value="fausse_magie">Un objet non magique paraît magique</option>
              <option value="aura_modifiee">Un objet magique paraît d'une autre nature</option>
            </select>
          </div>

          <div class="form-group">
            <label>Nature apparente</label>
            <select name="apparentSchool">
              <option value="abjuration">Abjuration</option>
              <option value="alteration">Altération</option>
              <option value="conjuration">Conjuration</option>
              <option value="divination">Divination</option>
              <option value="enchantement_charme">Enchantement/Charme</option>
              <option value="evocation">Évocation</option>
              <option value="illusion_fantasme">Illusion/Fantasme</option>
              <option value="necromancie">Nécromancie</option>
              <option value="indeterminee">Indéterminée</option>
            </select>
          </div>
        </form>

        <script>
          (() => {
            const itemOptions = ${JSON.stringify(itemOptionsByCarrier)};
            const root = document.currentScript.closest(".dialog-content") || document.currentScript.parentElement;
            const carrier = root.querySelector("[name='carrier']");
            const itemSelect = root.querySelector("[name='itemId']");
            const row = root.querySelector(".add2e-nystul-item-row");
            const refresh = () => {
              const key = carrier.value || "manual";
              itemSelect.innerHTML = itemOptions[key] || "";
              row.style.display = itemSelect.options.length ? "" : "none";
            };
            carrier.addEventListener("change", refresh);
            refresh();
          })();
        </script>
      `,
      buttons: {
        cast: {
          label: "Lancer",
          callback: html => {
            const carrierId = String(html.find("[name='carrier']").val() ?? "caster");
            const carrier = carriers.find(c => c.id === carrierId) ?? carriers[0] ?? null;
            finish({
              carrierId,
              carrierActor: carrier?.actor ?? null,
              carrierToken: carrier?.token ?? null,
              itemId: String(html.find("[name='itemId']").val() ?? ""),
              manualObject: String(html.find("[name='manualObject']").val() ?? "").trim(),
              auraType: String(html.find("[name='auraType']").val() ?? "fausse_magie"),
              apparentSchool: String(html.find("[name='apparentSchool']").val() ?? "indeterminee")
            });
          }
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

function add2eResolveChosenItem(choice) {
  if (!choice?.carrierActor || !choice.itemId) return null;
  return choice.carrierActor.items?.get?.(choice.itemId) ?? null;
}

function add2eObjectLabel(choice, chosenItem) {
  return chosenItem?.name || choice?.manualObject || "objet touché";
}

function add2eBuildAuraEffect({ choice, chosenItem, objectLabel, casterActor, level }) {
  const itemSlug = add2eNormalize(chosenItem?.id || objectLabel || "objet");
  const apparentSchool = add2eNormalize(choice.apparentSchool || "indeterminee");
  const auraType = add2eNormalize(choice.auraType || "fausse_magie");

  return {
    name: `${ADD2E_SORT_CONFIG.name} — ${objectLabel}`,
    img: ADD2E_ITEM?.img || ADD2E_SORT_CONFIG.imgFallback,
    disabled: false,
    transfer: false,
    type: "base",
    system: {},
    changes: [],
    duration: add2eDuration(level),
    description: `${objectLabel} porte une aura magique illusoire : ${auraType === "aura_modifiee" ? "aura modifiée" : "fausse aura magique"}.`,
    flags: {
      add2e: {
        tags: [
          "classe:magicien",
          "liste:magicien",
          "niveau:1",
          "sort:aura_magique_de_nystul",
          "ecole:illusion_fantasme",
          "type:illusion",
          "type:objet",
          "aura:magique",
          `aura_type:${auraType}`,
          `aura_apparente:${apparentSchool}`,
          `objet:${itemSlug}`,
          "detection_magie:fausse_information",
          "identification:peut_tromper",
          "jet_sauvegarde:special",
          "duree:1_jour_par_niveau",
          `duree_jours:${Math.max(1, level)}`
        ],
        spell: {
          slug: ADD2E_SORT_CONFIG.slug,
          name: ADD2E_SORT_CONFIG.name,
          level: ADD2E_SORT_CONFIG.level,
          school: ADD2E_SORT_CONFIG.school,
          casterId: casterActor?.id ?? null,
          casterUuid: casterActor?.uuid ?? null,
          casterName: casterActor?.name ?? "",
          objectName: objectLabel,
          itemId: chosenItem?.id ?? null,
          itemUuid: chosenItem?.uuid ?? null,
          carrierActorId: choice.carrierActor?.id ?? null,
          carrierActorUuid: choice.carrierActor?.uuid ?? null,
          auraType,
          apparentSchool,
          casterLevel: level,
          durationDays: Math.max(1, level),
          sourceItemId: ADD2E_ITEM?.id ?? null,
          sourceItemUuid: ADD2E_ITEM?.uuid ?? null
        }
      }
    }
  };
}

async function add2eApplyAuraEffect(choice, effectData) {
  if (!choice?.carrierActor || !effectData) return false;

  const payload = {
    actorUuid: choice.carrierActor.uuid,
    actorId: choice.carrierActor.id,
    sceneId: canvas?.scene?.id ?? null,
    tokenId: choice.carrierToken?.document?.id ?? choice.carrierToken?.id ?? null,
    effectData
  };

  if (game.user?.isGM || choice.carrierActor.isOwner) {
    try {
      await choice.carrierActor.createEmbeddedDocuments("ActiveEffect", [foundry.utils.duplicate(effectData)]);
      return true;
    } catch (err) {
      console.warn(`${ADD2E_ONUSE_TAG}[DIRECT_EFFECT_FAILED] Passage par relais MJ.`, err);
    }
  }

  game.socket?.emit?.("system.add2e", {
    type: "ADD2E_GM_OPERATION",
    operation: "createActiveEffect",
    payload
  });

  return true;
}

function add2eAuraTypeLabel(type) {
  if (type === "aura_modifiee") return "l'aura magique de l'objet prend une apparence trompeuse";
  return "l'objet paraît désormais magique";
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
    indeterminee: "nature indéterminée"
  };
  return map[value] ?? value;
}

async function add2eChatAuraNystul(actorDoc, choice, objectLabel, applied) {
  const casterToken = add2eGetCasterToken(actorDoc);
  const casterName = actorDoc?.name ?? casterToken?.name ?? "Magicien";
  const casterImg = casterToken?.document?.texture?.src ?? actorDoc?.img ?? "icons/svg/mystery-man.svg";
  const spellImg = ADD2E_ITEM?.img ?? ADD2E_SORT_CONFIG.imgFallback;
  const level = add2eCasterLevel(actorDoc);
  const durationDays = Math.max(1, level);
  const auraLabel = add2eAuraTypeLabel(choice.auraType);
  const schoolLabel = add2eSchoolLabel(choice.apparentSchool);

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
            <p style="margin:.35em 0;font-size:13px;line-height:1.35;">Le magicien effleure <b>${add2eHtmlEscape(objectLabel)}</b> et y dépose une empreinte magique trompeuse.</p>
            <p style="margin:.35em 0;font-size:13px;line-height:1.35;">${add2eHtmlEscape(auraLabel)} ; sa nature apparente évoque ${add2eHtmlEscape(schoolLabel)}.</p>
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
  console.log(`${ADD2E_ONUSE_TAG}[CANCEL] Sort annulé : remboursement du slot mémorisé par le dispatcher.`);
  return false;
}

const level = add2eCasterLevel(ADD2E_ACTOR);
const chosenItem = add2eResolveChosenItem(choice);
const objectLabel = add2eObjectLabel(choice, chosenItem);

if (!objectLabel || objectLabel === "objet touché") {
  ui.notifications?.warn?.("Aura magique de Nystul : indique ou sélectionne l'objet touché.");
  console.warn(`${ADD2E_ONUSE_TAG}[NO_OBJECT] Aucun objet sélectionné ou indiqué.`);
  return false;
}

const effectData = choice.carrierActor
  ? add2eBuildAuraEffect({ choice, chosenItem, objectLabel, casterActor: ADD2E_ACTOR, level })
  : null;
const applied = await add2eApplyAuraEffect(choice, effectData);

console.log(`${ADD2E_ONUSE_TAG}[START]`, {
  actor: ADD2E_ACTOR?.name,
  sort: ADD2E_ITEM?.name,
  level,
  objectLabel,
  item: chosenItem?.name ?? null,
  carrier: choice.carrierActor?.name ?? null,
  auraType: choice.auraType,
  apparentSchool: choice.apparentSchool,
  effectRequested: applied
});

await add2eChatAuraNystul(ADD2E_ACTOR, choice, objectLabel, applied);

console.log(`${ADD2E_ONUSE_TAG}[DONE]`, {
  consumedByDispatcher: true,
  objectLabel,
  effectRequested: applied,
  durationDays: Math.max(1, level)
});

return true;
