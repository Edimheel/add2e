/*
 * ADD2E — Druide : Forme animale
 * Script exécuté via on_use d'une classFeature.
 *
 * Le script ne fabrique pas de profil animal : le Manuel limite les catégories,
 * la taille et la récupération ; le choix précis de l'animal reste soumis au MJ.
 * Compatible Foundry V13/V14/V15 — DialogV2 uniquement.
 */
const ADD2E_DRUIDE_FORME_ANIMALE_VERSION = "2026-07-07-reusable-transformation-v2";
const ADD2E_TRANSFORMATION_SCOPE = "druid-animal-form";
const ADD2E_DAY_ROUNDS = 24 * 60;

globalThis.ADD2E_DRUIDE_FORME_ANIMALE_VERSION = ADD2E_DRUIDE_FORME_ANIMALE_VERSION;

globalThis.ADD2E_CAPABILITY_TRANSFORMATIONS ??= {};

function a2eDruideNorm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function a2eDruideEsc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function a2eDruideChatStyleData() {
  if (CONST.CHAT_MESSAGE_STYLES) return { style: CONST.CHAT_MESSAGE_STYLES.OTHER };
  return { type: CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0 };
}

function a2eDruideFeatureLevel(currentActor, currentFeature) {
  const level = Number(
    globalThis.add2eFeatureActorLevel?.(currentActor, currentFeature)
    ?? currentFeature?._add2eClassLevel
  );
  return Number.isFinite(level) && level >= 1 ? Math.floor(level) : null;
}

function a2eDruideCurrentTick() {
  const engine = game?.add2e?.time ?? globalThis.ADD2E_TIME_ENGINE ?? null;
  const tick = typeof engine?.currentTick === "function" ? Number(engine.currentTick()) : NaN;
  return Number.isFinite(tick) ? Math.max(0, Math.floor(tick)) : null;
}

function a2eDruideReadNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function a2eDruideHp(actorDocument) {
  const system = actorDocument?.system ?? {};
  const maximum = a2eDruideReadNumber(
    system.points_de_coup,
    system.pv_max,
    system.points_de_vie,
    system.hp?.max,
    system.attributes?.hp?.max
  );
  const current = a2eDruideReadNumber(
    system.pdv,
    system.pv,
    system.hp?.value,
    system.attributes?.hp?.value
  );
  return { maximum, current };
}

function a2eDruideCategoryLabel(category) {
  return ({ reptile: "Reptile", oiseau: "Oiseau", mammifere: "Mammifère" })[category] ?? "Forme animale";
}

function a2eDruideUsageState(currentActor, dayIndex) {
  const root = currentActor.getFlag("add2e", "capabilityUsage") ?? {};
  const stored = root?.[ADD2E_TRANSFORMATION_SCOPE] ?? {};
  const valid = Number(stored.dayIndex) === Number(dayIndex);
  return {
    root: root && typeof root === "object" ? root : {},
    categories: valid && stored.categories && typeof stored.categories === "object" ? stored.categories : {},
    dayIndex
  };
}

function a2eDruideTransformationEffects(currentActor) {
  return Array.from(currentActor?.effects ?? []).filter(effect => {
    const add2e = effect?.flags?.add2e ?? {};
    return add2e?.capabilityTransformation?.sourceKey === ADD2E_TRANSFORMATION_SCOPE
      || add2e?.sourceCapacite === "forme_animale";
  });
}

async function a2eDruideRemoveTransformations(currentActor) {
  const ids = a2eDruideTransformationEffects(currentActor).map(effect => effect.id).filter(Boolean);
  if (ids.length) await currentActor.deleteEmbeddedDocuments("ActiveEffect", ids, { add2eInternal: true, add2eReason: "capability-transformation-return" });
  return ids.length;
}

async function a2eDruideChooseTransformation({ available, activeEffect }) {
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!DialogV2?.wait) {
    ui.notifications.error("Forme animale : DialogV2 est indisponible.");
    return null;
  }

  const options = available.map(category => `<option value="${a2eDruideEsc(category)}">${a2eDruideEsc(a2eDruideCategoryLabel(category))}</option>`).join("");
  const recoveryOptions = [10, 20, 30, 40, 50, 60]
    .map(value => `<option value="${value}">${value} %</option>`)
    .join("");
  const activeText = activeEffect
    ? `<div style="border:1px solid #8db586;border-radius:7px;background:#f3fff0;padding:7px;color:#24461e;"><b>Forme active :</b> ${a2eDruideEsc(activeEffect.name)}. Revenir à la forme normale ne rembourse pas une catégorie déjà utilisée.</div>`
    : "";
  const unavailableText = available.length
    ? ""
    : `<div style="border:1px solid #caa16a;border-radius:7px;background:#fff7e9;padding:7px;color:#68400f;">Les trois catégories sont déjà utilisées pour ce jour ADD2E.</div>`;

  return DialogV2.wait({
    window: { title: "Forme animale du druide" },
    position: { width: 510 },
    classes: ["add2e", "add2e-capability-dialog", "add2e-druid-transformation-dialog"],
    content: `
      <form class="add2e-druid-transformation-form" style="font-family:var(--font-primary);display:grid;gap:8px;color:#24351f;">
        <div style="border:1px solid #7eaa72;border-radius:8px;background:linear-gradient(180deg,#f7fff3,#e5f3dd);padding:8px;">
          <div style="font-weight:900;color:#365c2e;">Forme animale</div>
          <div style="font-size:.9em;line-height:1.35;margin-top:3px;">Une fois par jour ADD2E pour chaque catégorie : reptile, oiseau et mammifère. Le Manuel limite aussi la taille ; l'animal précis est soumis à la validation du MJ.</div>
        </div>
        ${activeText}
        ${unavailableText}
        ${available.length ? `
          <div class="form-group"><label style="font-weight:800;">Catégorie</label><select name="category" style="width:100%;">${options}</select></div>
          <div class="form-group"><label style="font-weight:800;">Animal choisi <small>(validation MJ)</small></label><input name="animal" type="text" maxlength="80" placeholder="Ex. aigle, ours noir, chauve-souris" style="width:100%;"></div>
          <div class="form-group"><label style="font-weight:800;">Récupération des PV perdus <small>(plage du Manuel : 10–60 %, arbitrage MJ)</small></label><select name="recoveryPercent" style="width:100%;">${recoveryOptions}</select></div>
        ` : ""}
      </form>`,
    buttons: [
      ...(available.length ? [{
        action: "transform",
        label: "Prendre la forme",
        icon: "fa-solid fa-paw",
        default: true,
        callback: (_event, button) => {
          const form = button.form;
          return {
            action: "transform",
            category: String(form?.elements?.category?.value ?? ""),
            animal: String(form?.elements?.animal?.value ?? "").trim(),
            recoveryPercent: Number(form?.elements?.recoveryPercent?.value ?? 0)
          };
        }
      }] : []),
      ...(activeEffect ? [{
        action: "return",
        label: "Revenir à la forme normale",
        icon: "fa-solid fa-person",
        callback: () => ({ action: "return" })
      }] : []),
      { action: "cancel", label: "Annuler", icon: "fa-solid fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });
}

async function a2eDruideCreateChat(actorDocument, title, body, img = "icons/magic/nature/wolf-paw-glow-green.webp") {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: actorDocument }),
    content: `
      <div class="add2e-chat-card" style="border:1px solid #668d55;border-radius:9px;overflow:hidden;background:#f5fff0;color:#203a1c;font-family:var(--font-primary);">
        <div style="display:flex;align-items:center;gap:8px;background:#3f6d35;color:#fff;padding:7px 9px;">
          <img src="${a2eDruideEsc(img)}" style="width:34px;height:34px;object-fit:cover;border-radius:5px;border:1px solid #cfe8c4;background:#fff;">
          <div style="font-weight:900;">${a2eDruideEsc(title)}</div>
        </div>
        <div style="padding:9px 10px;line-height:1.4;">${body}</div>
      </div>`,
    flags: { add2e: { capabilityTransformation: true, sourceCapacite: "forme_animale", version: ADD2E_DRUIDE_FORME_ANIMALE_VERSION } },
    ...a2eDruideChatStyleData()
  });
}

globalThis.ADD2E_CAPABILITY_TRANSFORMATIONS.currentTick = a2eDruideCurrentTick;
globalThis.ADD2E_CAPABILITY_TRANSFORMATIONS.find = a2eDruideTransformationEffects;
globalThis.ADD2E_CAPABILITY_TRANSFORMATIONS.remove = a2eDruideRemoveTransformations;

if (!actor) {
  ui.notifications.error("Forme animale : acteur introuvable.");
  return false;
}

const level = a2eDruideFeatureLevel(actor, feature);
if (level === null) {
  ui.notifications.error("Forme animale : niveau de Druide introuvable.");
  return false;
}
if (level < 7) {
  ui.notifications.warn("Forme animale indisponible avant le niveau 7.");
  return false;
}

const currentTick = a2eDruideCurrentTick();
if (currentTick === null) {
  ui.notifications.error("Forme animale : le compteur de temps ADD2E est indisponible.");
  return false;
}

const dayIndex = Math.floor(currentTick / ADD2E_DAY_ROUNDS);
const categories = ["reptile", "oiseau", "mammifere"];
const usage = a2eDruideUsageState(actor, dayIndex);
const available = categories.filter(category => usage.categories?.[category]?.used !== true);
const activeEffects = a2eDruideTransformationEffects(actor);
const choice = await a2eDruideChooseTransformation({ available, activeEffect: activeEffects[0] ?? null });
if (!choice) return false;

if (choice.action === "return") {
  const returned = await a2eDruideRemoveTransformations(actor);
  if (!returned) {
    ui.notifications.warn("Aucune forme animale active à retirer.");
    return false;
  }
  await a2eDruideCreateChat(
    actor,
    "Forme animale",
    `<b>${a2eDruideEsc(actor.name)}</b> reprend sa forme normale.<br><small>Les catégories déjà utilisées restent dépensées pour ce jour ADD2E.</small>`
  );
  ui.notifications.info("Retour à la forme normale.");
  return true;
}

const category = a2eDruideNorm(choice.category);
const animal = String(choice.animal ?? "").trim();
const recoveryPercent = Math.floor(Number(choice.recoveryPercent) || 0);
if (!available.includes(category)) {
  ui.notifications.warn("Cette catégorie de forme animale est indisponible aujourd’hui.");
  return false;
}
if (!animal) {
  ui.notifications.warn("Indique l’animal choisi afin que le MJ puisse valider la forme.");
  return false;
}
if (recoveryPercent < 10 || recoveryPercent > 60 || recoveryPercent % 10 !== 0) {
  ui.notifications.warn("La récupération doit rester dans la plage 10–60 % indiquée par le Manuel.");
  return false;
}

const categoryLabel = a2eDruideCategoryLabel(category);
const { maximum: hpMaximum, current: hpCurrent } = a2eDruideHp(actor);
const lostHp = Number.isFinite(hpMaximum) && Number.isFinite(hpCurrent) ? Math.max(0, hpMaximum - hpCurrent) : 0;
const recoveredHp = Math.min(lostHp, Math.ceil(lostHp * recoveryPercent / 100));

await a2eDruideRemoveTransformations(actor);
const created = await actor.createEmbeddedDocuments("ActiveEffect", [{
  name: `Forme animale — ${animal}`,
  img: "icons/magic/nature/wolf-paw-glow-green.webp",
  disabled: false,
  transfer: false,
  changes: [],
  duration: {},
  flags: {
    add2e: {
      sourceClasse: "druide",
      sourceCapacite: "forme_animale",
      forme: category,
      capabilityTransformation: {
        version: ADD2E_DRUIDE_FORME_ANIMALE_VERSION,
        sourceKey: ADD2E_TRANSFORMATION_SCOPE,
        category,
        formName: animal,
        requiresMjValidation: true,
        activatedAtTick: currentTick
      },
      tags: [
        "classe:druide",
        "capability:transformation",
        "forme_animale:active",
        `forme_animale:${category}`
      ]
    }
  }
}], { add2eInternal: true, add2eReason: "capability-transformation-apply" });

const nextCategories = {
  ...usage.categories,
  [category]: {
    used: true,
    usedAtTick: currentTick,
    formName: animal,
    recoveryPercent,
    recoveryPoints: recoveredHp
  }
};
await actor.setFlag("add2e", "capabilityUsage", {
  ...usage.root,
  [ADD2E_TRANSFORMATION_SCOPE]: {
    version: ADD2E_DRUIDE_FORME_ANIMALE_VERSION,
    reset: { type: "add2e-day", rounds: ADD2E_DAY_ROUNDS },
    dayIndex,
    categories: nextCategories,
    updatedAtTick: currentTick
  }
});

if (recoveredHp > 0) {
  await actor.update({ "system.pdv": hpCurrent + recoveredHp }, { add2eInternal: true, add2eReason: "capability-transformation-recovery" });
}

const usedCount = categories.filter(entry => nextCategories?.[entry]?.used === true).length;
const effectId = created?.[0]?.id ?? null;
await a2eDruideCreateChat(
  actor,
  "Forme animale",
  `<b>${a2eDruideEsc(actor.name)}</b> prend la forme <b>${a2eDruideEsc(animal)}</b> (${a2eDruideEsc(categoryLabel)}).<br>
   <small>La taille et les capacités précises de l’animal restent à valider par le MJ. Effet : ${a2eDruideEsc(effectId ? "actif" : "créé")}. </small><br>
   <b>Récupération :</b> ${recoveredHp} PV (${recoveryPercent} % des ${lostHp} PV perdus avant la transformation).<br>
   <b>Catégories restantes ce jour ADD2E :</b> ${Math.max(0, categories.length - usedCount)} / ${categories.length}.`
);

ui.notifications.info(`Forme animale utilisée : ${animal}.`);
return true;