// ADD2E — Contrôle du climat (Clerc 7 / Magicien 6 / Druide 7)
// Compatible Foundry V13/V14/V15.
// Le script valide et documente les changements autorisés ; il ne crée pas de moteur météo parallèle.

const ADD2E_CONTROLE_DU_CLIMAT_VERSION = "2026-08-09-canonical-weather-rules-v5";

const ADD2E_CONTROLE_DU_CLIMAT_PROFILES = Object.freeze({
  clerc: Object.freeze({
    classKey: "clerc",
    classLabel: "Clerc",
    spellLevel: 7,
    sourceType: "Sort divin",
    theme: "parchment",
    baseMaxShift: 1,
    durationMode: "cleric-dice",
    areaMode: "cleric-dice"
  }),
  magicien: Object.freeze({
    classKey: "magicien",
    classLabel: "Magicien",
    spellLevel: 6,
    sourceType: "Sort profane",
    theme: "wizard",
    baseMaxShift: 1,
    durationMode: "wizard-range",
    areaMode: "cleric-dice"
  }),
  druide: Object.freeze({
    classKey: "druide",
    classLabel: "Druide",
    spellLevel: 7,
    sourceType: "Sort druidique",
    theme: "druid",
    baseMaxShift: 1,
    durationMode: "druid-choice",
    areaMode: "druid-choice"
  })
});

const ADD2E_CONTROLE_DU_CLIMAT_AXES = Object.freeze({
  sky: Object.freeze([
    Object.freeze({ key: "clair", label: "Temps clair" }),
    Object.freeze({ key: "partiellement_nuageux", label: "Partiellement nuageux" }),
    Object.freeze({ key: "nuageux", label: "Nuageux" }),
    Object.freeze({ key: "tempete", label: "Tempête" })
  ]),
  temperature: Object.freeze([
    Object.freeze({ key: "tres_chaud", label: "Temps très chaud" }),
    Object.freeze({ key: "chaud", label: "Temps chaud" }),
    Object.freeze({ key: "doux", label: "Temps doux" }),
    Object.freeze({ key: "frais", label: "Temps frais" })
  ]),
  wind: Object.freeze([
    Object.freeze({ key: "calme", label: "Calme" }),
    Object.freeze({ key: "vent_leger", label: "Vent léger" }),
    Object.freeze({ key: "vent_fort", label: "Vent fort" }),
    Object.freeze({ key: "vent_tres_fort", label: "Vent très fort" })
  ])
});

globalThis.ADD2E_CONTROLE_DU_CLIMAT_VERSION = ADD2E_CONTROLE_DU_CLIMAT_VERSION;

function add2eControleDuClimatEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add2eControleDuClimatNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function add2eControleDuClimatSourceItem() {
  return typeof item !== "undefined" ? item : null;
}

function add2eControleDuClimatCasterToken() {
  return (typeof token !== "undefined" ? token : null)
    ?? (typeof args !== "undefined" ? args?.[0]?.token : null)
    ?? canvas?.tokens?.controlled?.[0]
    ?? null;
}

function add2eControleDuClimatRequireApis() {
  if (typeof globalThis.add2eDialogWait !== "function") {
    throw new Error("L’API de fenêtre ADD2E est indisponible.");
  }
  if (typeof globalThis.add2eBuildChatCard !== "function" || typeof globalThis.add2eCreateChatCard !== "function") {
    throw new Error("Les constructeurs communs de cartes ADD2E sont indisponibles.");
  }
  if (typeof globalThis.add2eNormalizeSpellKey !== "function" || typeof globalThis.add2eGetSpellListsFromItem !== "function" || typeof globalThis.add2eSpellClassLevel !== "function") {
    throw new Error("Le propriétaire canonique ADD2E des listes et niveaux de sorts est indisponible.");
  }
}

function add2eControleDuClimatProfile(sourceItem) {
  if (!sourceItem?.system) return null;
  const normalizeSpell = value => add2eControleDuClimatNormalize(globalThis.add2eNormalizeSpellKey(value));
  const declaredClass = normalizeSpell(sourceItem.system.classe);
  const lists = globalThis.add2eGetSpellListsFromItem(sourceItem).map(normalizeSpell).filter(Boolean);
  const allowed = new Set(Object.keys(ADD2E_CONTROLE_DU_CLIMAT_PROFILES));
  const keys = [...new Set([declaredClass, ...lists].filter(key => allowed.has(key)))];
  if (keys.length !== 1) return null;
  return ADD2E_CONTROLE_DU_CLIMAT_PROFILES[keys[0]] ?? null;
}

function add2eControleDuClimatCasterLevel(caster, profile) {
  const level = Number(globalThis.add2eSpellClassLevel(caster, profile.classKey));
  if (!Number.isFinite(level) || level < 1) {
    throw new Error(`Contrôle du climat : niveau canonique de ${profile.classLabel} introuvable sur l’Item classe du lanceur.`);
  }
  return Math.floor(level);
}

function add2eControleDuClimatAxisOptions(axis, selected = "") {
  return (ADD2E_CONTROLE_DU_CLIMAT_AXES[axis] ?? []).map(entry => (
    `<option value="${entry.key}"${entry.key === selected ? " selected" : ""}>${add2eControleDuClimatEscape(entry.label)}</option>`
  )).join("");
}

function add2eControleDuClimatAxisIndex(axis, key) {
  return (ADD2E_CONTROLE_DU_CLIMAT_AXES[axis] ?? []).findIndex(entry => entry.key === key);
}

function add2eControleDuClimatAxisLabel(axis, key) {
  return (ADD2E_CONTROLE_DU_CLIMAT_AXES[axis] ?? []).find(entry => entry.key === key)?.label ?? key;
}

function add2eControleDuClimatMaxShift(profile, parameters) {
  if (profile.classKey === "druide" && parameters.mistletoe === "major") return 2;
  return profile.baseMaxShift;
}

function add2eControleDuClimatValidateTransition(profile, parameters) {
  const maxShift = add2eControleDuClimatMaxShift(profile, parameters);
  const errors = [];
  for (const axis of ["sky", "temperature", "wind"]) {
    const current = add2eControleDuClimatAxisIndex(axis, parameters.current?.[axis]);
    const desired = add2eControleDuClimatAxisIndex(axis, parameters.desired?.[axis]);
    if (current < 0 || desired < 0) {
      errors.push(`${axis}: catégorie inconnue`);
      continue;
    }
    const shift = Math.abs(desired - current);
    if (shift > maxShift) {
      errors.push(`${add2eControleDuClimatAxisLabel(axis, parameters.current[axis])} → ${add2eControleDuClimatAxisLabel(axis, parameters.desired[axis])} : ${shift} catégories, maximum ${maxShift}`);
    }
  }
  return { valid: errors.length === 0, errors, maxShift };
}

async function add2eControleDuClimatRoll(formula) {
  const roll = await new Roll(formula).evaluate();
  if (game.dice3d) await game.dice3d.showForRoll(roll);
  return roll;
}

function add2eControleDuClimatNumber(value, min, max) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return null;
  if (number < min || number > max) return null;
  return number;
}

async function add2eControleDuClimatParameters(profile) {
  const druidFields = profile.classKey === "druide" ? `
    <div class="form-group">
      <label>Qualité du gui</label>
      <select name="mistletoe">
        <option value="major" selected>Gui majeur — jusqu’à 2 catégories</option>
        <option value="other">Autre gui — règles du sort de clerc</option>
      </select>
    </div>
    <div class="form-group">
      <label>Durée si gui majeur — 8 à 96 heures</label>
      <input name="druidDuration" type="number" min="8" max="96" step="1" value="8">
    </div>
    <div class="form-group">
      <label>Zone si gui majeur — 10 à 80 km²</label>
      <input name="druidArea" type="number" min="10" max="80" step="1" value="10">
    </div>
  ` : "";
  const wizardFields = profile.classKey === "magicien" ? `
    <div class="form-group">
      <label>Durée — 4 à 24 heures</label>
      <input name="wizardDuration" type="number" min="4" max="24" step="1" value="4">
      <p><small>Le Manuel donne la plage 4–24 heures sans formule de dés ; la valeur est donc choisie explicitement plutôt qu’inventée.</small></p>
    </div>
  ` : "";

  return globalThis.add2eDialogWait({
    add2eTheme: profile.theme,
    add2ePrimaryAction: "cast",
    add2eClasses: ["add2e-controle-du-climat-dialog"],
    window: { title: `Contrôle du climat — ${profile.classLabel}` },
    content: `
      <form class="add2e-controle-du-climat-form">
        <div class="form-group">
          <label>Environnement</label>
          <select name="environment">
            <option value="normal" selected>Conditions climatiques appropriées</option>
            <option value="underwater">Sous l’eau</option>
          </select>
        </div>
        ${druidFields}
        ${wizardFields}
        <fieldset>
          <legend>Conditions avant le sort</legend>
          <div class="form-group"><label>Ciel / précipitations</label><select name="currentSky">${add2eControleDuClimatAxisOptions("sky", "partiellement_nuageux")}</select></div>
          <div class="form-group"><label>Température</label><select name="currentTemperature">${add2eControleDuClimatAxisOptions("temperature", "doux")}</select></div>
          <div class="form-group"><label>Vent</label><select name="currentWind">${add2eControleDuClimatAxisOptions("wind", "vent_leger")}</select></div>
          <div class="form-group"><label>Direction actuelle du vent</label><input name="currentDirection" type="text"></div>
        </fieldset>
        <fieldset>
          <legend>Conditions recherchées</legend>
          <div class="form-group"><label>Ciel / précipitations</label><select name="desiredSky">${add2eControleDuClimatAxisOptions("sky", "partiellement_nuageux")}</select></div>
          <div class="form-group"><label>Température</label><select name="desiredTemperature">${add2eControleDuClimatAxisOptions("temperature", "doux")}</select></div>
          <div class="form-group"><label>Vent</label><select name="desiredWind">${add2eControleDuClimatAxisOptions("wind", "vent_leger")}</select></div>
          <div class="form-group"><label>Direction désirée du vent</label><input name="desiredDirection" type="text"></div>
          <div class="form-group"><label>Phénomène précis / note du MD</label><textarea name="weatherDetail" rows="2"></textarea></div>
        </fieldset>
        <p><small>Les catégories servent uniquement à contrôler l’écart réglementaire. Les phénomènes précis doivent rester compatibles avec la saison, le climat régional et entre eux ; par exemple un brouillard épais n’est pas compatible avec un vent très fort.</small></p>
      </form>
    `,
    buttons: [
      {
        action: "cast",
        label: "Valider le changement",
        icon: "<i class='fas fa-cloud-sun'></i>",
        default: true,
        callback: (_event, button) => {
          const form = button.form;
          return {
            environment: String(form?.elements?.environment?.value ?? "normal"),
            mistletoe: String(form?.elements?.mistletoe?.value ?? ""),
            wizardDuration: form?.elements?.wizardDuration?.value ?? "",
            druidDuration: form?.elements?.druidDuration?.value ?? "",
            druidArea: form?.elements?.druidArea?.value ?? "",
            current: {
              sky: String(form?.elements?.currentSky?.value ?? ""),
              temperature: String(form?.elements?.currentTemperature?.value ?? ""),
              wind: String(form?.elements?.currentWind?.value ?? ""),
              direction: String(form?.elements?.currentDirection?.value ?? "").trim()
            },
            desired: {
              sky: String(form?.elements?.desiredSky?.value ?? ""),
              temperature: String(form?.elements?.desiredTemperature?.value ?? ""),
              wind: String(form?.elements?.desiredWind?.value ?? ""),
              direction: String(form?.elements?.desiredDirection?.value ?? "").trim()
            },
            weatherDetail: String(form?.elements?.weatherDetail?.value ?? "").trim()
          };
        }
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

async function add2eControleDuClimatResolve(profile, parameters) {
  const rolls = [];
  const onset = await add2eControleDuClimatRoll("1d4");
  rolls.push(onset);
  const onsetTurns = Math.max(1, Math.floor(Number(onset.total) || 1));

  let durationHours = null;
  let areaKm2 = null;
  let resolutionMode = "";

  const druidMajor = profile.classKey === "druide" && parameters.mistletoe === "major";
  if (profile.classKey === "clerc" || (profile.classKey === "druide" && !druidMajor)) {
    const duration = await add2eControleDuClimatRoll("4d12");
    const area = await add2eControleDuClimatRoll("1d4");
    rolls.push(duration, area);
    durationHours = Math.max(4, Math.min(48, Math.floor(Number(duration.total) || 4)));
    areaKm2 = Math.max(10, Math.min(40, Math.floor(Number(area.total) || 1) * 10));
    resolutionMode = profile.classKey === "druide" ? "Autre gui — valeurs du sort de clerc" : "Valeurs du sort de clerc";
  } else if (profile.classKey === "magicien") {
    durationHours = add2eControleDuClimatNumber(parameters.wizardDuration, 4, 24);
    if (durationHours === null) throw new Error("La durée du Contrôle du climat de magicien doit être comprise entre 4 et 24 heures.");
    const area = await add2eControleDuClimatRoll("1d4");
    rolls.push(area);
    areaKm2 = Math.max(10, Math.min(40, Math.floor(Number(area.total) || 1) * 10));
    resolutionMode = "Durée choisie dans la plage du Manuel ; aire tirée selon le sort de clerc";
  } else if (druidMajor) {
    durationHours = add2eControleDuClimatNumber(parameters.druidDuration, 8, 96);
    areaKm2 = add2eControleDuClimatNumber(parameters.druidArea, 10, 80);
    if (durationHours === null) throw new Error("La durée au gui majeur doit être comprise entre 8 et 96 heures.");
    if (areaKm2 === null) throw new Error("La zone au gui majeur doit être comprise entre 10 et 80 km².");
    resolutionMode = "Gui majeur — plages propres au druide, sans formule de dés inventée";
  }

  return { rolls, onsetTurns, durationHours, areaKm2, resolutionMode };
}

async function add2eControleDuClimatChat(caster, casterToken, sourceItem, profile, casterLevel, parameters, validation, resolution) {
  const rows = [
    { label: "Version", value: `${profile.classLabel} · niveau ${profile.spellLevel}` },
    { label: "Niveau du lanceur", value: casterLevel },
    { label: "Écart maximal", value: `${validation.maxShift} catégorie(s) par aspect` },
    { label: "Ciel", value: `${add2eControleDuClimatAxisLabel("sky", parameters.current.sky)} → ${add2eControleDuClimatAxisLabel("sky", parameters.desired.sky)}` },
    { label: "Température", value: `${add2eControleDuClimatAxisLabel("temperature", parameters.current.temperature)} → ${add2eControleDuClimatAxisLabel("temperature", parameters.desired.temperature)}` },
    { label: "Vent", value: `${add2eControleDuClimatAxisLabel("wind", parameters.current.wind)} → ${add2eControleDuClimatAxisLabel("wind", parameters.desired.wind)}` },
    { label: "Direction du vent", value: `${parameters.current.direction || "—"} → ${parameters.desired.direction || "—"}` },
    { label: "Début du changement", value: `${resolution.onsetTurns} tour(s) après l’incantation` },
    { label: "Durée", value: `${resolution.durationHours} heure(s)` },
    { label: "Zone", value: `${resolution.areaKm2} km²` }
  ];
  if (profile.classKey === "druide") rows.splice(2, 0, { label: "Gui", value: parameters.mistletoe === "major" ? "Gui majeur" : "Autre gui" });

  const safeDetail = add2eControleDuClimatEscape(parameters.weatherDetail);
  const safeMode = add2eControleDuClimatEscape(resolution.resolutionMode);
  const options = {
    actor: caster,
    title: "Contrôle du climat",
    icon: "fas fa-cloud-sun",
    variant: "spell",
    source: {
      name: caster?.name ?? profile.classLabel,
      img: casterToken?.document?.texture?.src ?? caster?.img ?? sourceItem?.img ?? "icons/svg/mystery-man.svg",
      type: profile.sourceType
    },
    rows,
    trustedBodyHtml: `
      ${safeDetail ? `<p><b>Phénomène / décision du MD :</b> ${safeDetail}</p>` : ""}
      <p>${safeMode}</p>
      <p><em>Le système a validé l’écart entre catégories et les valeurs explicitement définies par la règle. Il ne modifie pas la météo de la scène : saison, climat régional, phénomènes précis et absence de contradictions restent sous l’autorité du MD.</em></p>
    `,
    chatData: {
      speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
      rolls: resolution.rolls,
      flags: {
        add2e: {
          spell: "controle_du_climat",
          weatherClass: profile.classKey,
          weatherMaxShift: validation.maxShift,
          version: ADD2E_CONTROLE_DU_CLIMAT_VERSION
        }
      }
    }
  };
  globalThis.add2eBuildChatCard(options);
  return globalThis.add2eCreateChatCard(options);
}

add2eControleDuClimatRequireApis();
const sourceItem = add2eControleDuClimatSourceItem();
const caster = (typeof actor !== "undefined" ? actor : null) ?? sourceItem?.parent ?? null;
if (!caster || !sourceItem) {
  ui.notifications.error("Contrôle du climat : lanceur ou Item sort introuvable.");
  return false;
}

const profile = add2eControleDuClimatProfile(sourceItem);
if (!profile) {
  ui.notifications.error("Contrôle du climat : l’Item doit identifier exactement la liste Clerc, Magicien ou Druide.");
  return false;
}
const casterLevel = add2eControleDuClimatCasterLevel(caster, profile);
const parameters = await add2eControleDuClimatParameters(profile);
if (!parameters) {
  ui.notifications.info("Contrôle du climat annulé.");
  return false;
}
if (parameters.environment === "underwater") {
  ui.notifications.warn("Contrôle du climat ne peut pas être utilisé sous l’eau.");
  return false;
}

const validation = add2eControleDuClimatValidateTransition(profile, parameters);
if (!validation.valid) {
  await globalThis.add2eDialogAlert({
    add2eTheme: "danger",
    window: { title: "Contrôle du climat — changement impossible" },
    content: `<p>Le changement demandé dépasse la limite réglementaire.</p><ul>${validation.errors.map(error => `<li>${add2eControleDuClimatEscape(error)}</li>`).join("")}</ul>`
  });
  return false;
}

try {
  const resolution = await add2eControleDuClimatResolve(profile, parameters);
  await add2eControleDuClimatChat(
    caster,
    add2eControleDuClimatCasterToken(),
    sourceItem,
    profile,
    casterLevel,
    parameters,
    validation,
    resolution
  );
  return true;
} catch (error) {
  console.error("[ADD2E][CONTROLE_DU_CLIMAT]", error);
  ui.notifications.error(`Contrôle du climat : ${error?.message ?? "erreur de résolution"}`);
  return false;
}