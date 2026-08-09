// ADD2E — Abaissement des eaux / Gonflement des eaux
// Propriétaire onUse unique pour les versions Clerc et Magicien.
// Compatible Foundry V13/V14/V15.

const ADD2E_ABAISSEMENT_EAUX_VERSION = "2026-08-09-canonical-water-level-v2";
const ADD2E_ABAISSEMENT_EAUX_SLUG = "abaissement_des_eaux";

function add2eWaterEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eWaterNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eWaterCasterToken() {
  if (typeof token !== "undefined" && token) return token;
  if (typeof args !== "undefined" && args?.[0]?.token) return args[0].token;
  return canvas?.tokens?.controlled?.[0] ?? null;
}

function add2eWaterSpellList(sourceItem) {
  const lists = Array.isArray(sourceItem?.system?.spellLists)
    ? sourceItem.system.spellLists.map(add2eWaterNormalize)
    : [];
  const supported = lists.find(list => list === "clerc" || list === "magicien");
  if (!supported) {
    throw new Error("Abaissement des eaux : liste de sort canonique Clerc ou Magicien introuvable.");
  }
  return supported;
}

function add2eWaterCasterLevel(caster, spellList) {
  const engine = globalThis.ADD2E_EFFECTS ?? globalThis.Add2eEffectsEngine ?? null;
  if (typeof engine?.getEmbeddedClassItems !== "function" || typeof engine?.getEmbeddedClassLevel !== "function") {
    throw new Error("Abaissement des eaux : API canonique des classes ADD2E indisponible.");
  }

  const expectedTag = `classe:${spellList}`;
  const classItem = engine.getEmbeddedClassItems(caster).find(entry => {
    const tags = [
      ...(Array.isArray(entry?.system?.tags) ? entry.system.tags : []),
      ...(Array.isArray(entry?.flags?.add2e?.tags) ? entry.flags.add2e.tags : [])
    ];
    return tags.some(tag => String(engine.normalizeTag?.(tag) ?? tag).toLowerCase() === expectedTag);
  });

  const level = engine.getEmbeddedClassLevel(classItem);
  if (!Number.isFinite(level) || level < 1) {
    throw new Error(`Abaissement des eaux : niveau de classe ${spellList} introuvable.`);
  }
  return level;
}

function add2eWaterProfile(spellList, casterLevel) {
  if (spellList === "clerc") {
    return {
      label: "Clerc",
      sourceType: "Sort divin",
      theme: "parchment",
      range: '12"',
      durationRounds: casterLevel * 10,
      durationLabel: `${casterLevel} tour(s)`,
      area: `${casterLevel}" × ${casterLevel}"`,
      lowerPercent: casterLevel * 5,
      raiseCm: casterLevel * 30
    };
  }

  return {
    label: "Magicien",
    sourceType: "Sort profane",
    theme: "wizard",
    range: '8"',
    durationRounds: casterLevel * 5,
    durationLabel: `${casterLevel * 5} round(s)`,
    area: `${casterLevel / 2}" × ${casterLevel / 2}"`,
    lowerPercent: casterLevel * 5,
    raiseCm: casterLevel * 15
  };
}

async function add2eWaterChooseMode(profile) {
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("Abaissement des eaux : l’API de fenêtre ADD2E est indisponible.");
  }

  return globalThis.add2eDialogWait({
    add2eTheme: profile.theme,
    add2ePrimaryAction: "lower",
    add2eClasses: ["add2e-abaissement-eaux-dialog"],
    window: { title: "Abaissement des eaux" },
    content: `
      <form class="add2e-abaissement-eaux-form">
        <p><b>Le sort ne peut pas être utilisé sous l’eau.</b></p>
        <p>Choisissez la forme lancée puis, si nécessaire, précisez la zone concernée.</p>
        <div class="form-group">
          <label>Note de scène / zone</label>
          <textarea name="note" rows="3"></textarea>
        </div>
      </form>
    `,
    buttons: [
      {
        action: "lower",
        label: "Abaissement des eaux",
        icon: "<i class='fas fa-water'></i>",
        default: true,
        callback: (_event, button) => ({
          mode: "lower",
          note: String(button.form?.elements?.note?.value ?? "")
        })
      },
      {
        action: "raise",
        label: "Gonflement des eaux",
        icon: "<i class='fas fa-water'></i>",
        callback: (_event, button) => ({
          mode: "raise",
          note: String(button.form?.elements?.note?.value ?? "")
        })
      },
      {
        action: "cancel",
        label: "Annuler",
        icon: "<i class='fas fa-times'></i>",
        callback: () => null
      }
    ],
    close: () => null
  });
}

async function add2eWaterCreateCard({ caster, casterToken, sourceItem, spellList, casterLevel, profile, choice }) {
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Abaissement des eaux : les constructeurs communs de cartes ADD2E sont indisponibles.");
  }

  const inverse = choice.mode === "raise";
  const title = inverse ? "Gonflement des eaux" : "Abaissement des eaux";
  const effect = inverse
    ? `Le niveau de l’eau monte de ${profile.raiseCm} cm dans la zone d’effet.`
    : `Le niveau de l’eau baisse de ${profile.lowerPercent} % dans la zone d’effet.`;
  const note = add2eWaterEscape(choice.note);

  const options = {
    actor: caster,
    title,
    icon: "fas fa-water",
    variant: "spell",
    source: {
      name: caster.name,
      img: casterToken?.document?.texture?.src ?? caster.img ?? sourceItem?.img ?? "icons/svg/book.svg",
      type: profile.sourceType,
      meta: `${profile.label} niveau ${casterLevel}`
    },
    rows: [
      { label: "Portée", value: profile.range },
      { label: "Durée", value: profile.durationLabel },
      { label: "Zone", value: profile.area },
      { label: "Jet de protection", value: "Aucun" },
      { label: "Effet", value: effect }
    ],
    trustedBodyHtml: `
      <p>${add2eWaterEscape(effect)}</p>
      ${note ? `<p><b>Note de scène :</b> ${note}</p>` : ""}
      <p><b>Restriction :</b> ce sort ne peut pas être utilisé sous l’eau.</p>
      <details style="margin-top:8px;">
        <summary>Règle appliquée</summary>
        <div style="padding-top:6px;">
          ${inverse
            ? `La forme inverse annule un abaissement existant et/ou élève le niveau des eaux de ${spellList === "clerc" ? "30" : "15"} cm par niveau du lanceur.`
            : "La forme normale abaisse le niveau de l’eau ou d’un liquide similaire de 5 % par niveau du lanceur."}
          Aucun ActiveEffect n’est créé sur une créature : il s’agit d’un effet de terrain et de scène.
        </div>
      </details>
    `,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken?.document ?? casterToken }),
      flags: {
        add2e: {
          spell: ADD2E_ABAISSEMENT_EAUX_SLUG,
          spellList,
          casterLevel,
          mode: choice.mode,
          durationRounds: profile.durationRounds,
          version: ADD2E_ABAISSEMENT_EAUX_VERSION
        }
      }
    }
  };

  globalThis.add2eBuildChatCard(options);
  return globalThis.add2eCreateChatCard(options);
}

const sourceItem = item ?? null;
const caster = actor ?? sourceItem?.parent ?? null;
if (!sourceItem || !caster) {
  ui.notifications.error("Abaissement des eaux : sort ou lanceur introuvable.");
  return false;
}

const spellList = add2eWaterSpellList(sourceItem);
const casterLevel = add2eWaterCasterLevel(caster, spellList);
const profile = add2eWaterProfile(spellList, casterLevel);
const choice = await add2eWaterChooseMode(profile);
if (!choice) {
  ui.notifications.info("Abaissement des eaux annulé.");
  return false;
}

await add2eWaterCreateCard({
  caster,
  casterToken: add2eWaterCasterToken(),
  sourceItem,
  spellList,
  casterLevel,
  profile,
  choice
});

return true;
