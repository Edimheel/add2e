// ADD2E — Affichage détaillé des monstres
// Version : 2026-07-01-v5-monster-ranged-projectile-bridge
// But : séparer les capacités informatives MJ des effets système activables.
// Foundry V13/V14/V15 : en V14, les feuilles d'acteur ApplicationV2 doivent être raccordées via ActorSheetV2/DocumentSheetV2.

const ADD2E_MONSTER_CAPABILITIES_VERSION = "2026-07-01-v5-monster-ranged-projectile-bridge";
globalThis.ADD2E_MONSTER_CAPABILITIES_VERSION = ADD2E_MONSTER_CAPABILITIES_VERSION;

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(v => v !== undefined && v !== null && String(v).trim() !== "");
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
  if (typeof value === "object") {
    const numeric = Object.keys(value)
      .filter(k => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map(k => value[k]);
    if (numeric.length) return numeric;
    return Object.values(value).filter(v => v !== undefined && v !== null && String(v).trim() !== "");
  }
  return [];
}

function monsterCaps(system) {
  return toArray(system?.capacites_monstre).map(cap => {
    if (!cap || typeof cap !== "object") return { type: "note_mj", name: "Note", description: String(cap ?? ""), tags: [], affichage: "mj" };
    const tags = toArray(cap.tags ?? cap.effectTags);
    const text = norm(`${cap.name ?? ""} ${cap.type ?? ""} ${cap.description ?? ""} ${tags.join(" ")}`);
    const explicitSystem = cap.affichage === "systeme" || cap.mechanical === true || cap.systemEffect === true;
    const mechanical = explicitSystem || text.includes("bonus_attaque") || text.includes("lumiere_du_jour") || text.includes("lumiere_vive");
    return {
      type: String(cap.type ?? "capacité"),
      name: String(cap.name ?? cap.nom ?? "Capacité"),
      description: String(cap.description ?? cap.desc ?? ""),
      activation: String(cap.activation ?? ""),
      effet_systeme: String(cap.effet_systeme ?? cap.systemEffectText ?? ""),
      tags,
      affichage: mechanical ? "systeme" : "mj"
    };
  });
}

function badges(tags, cls = "") {
  const values = toArray(tags);
  if (!values.length) return "";
  return `<div class="add2e-monster-badges">${values.map(t => `<span class="add2e-monster-badge ${cls}">${esc(t)}</span>`).join("")}</div>`;
}

function infoCard(label, value) {
  return `<div class="add2e-monster-info"><b>${esc(label)}</b><span>${esc(value || "—")}</span></div>`;
}

function capCard(cap, system = false) {
  return `
    <div class="add2e-monster-cap-card ${system ? "system" : "mj"}">
      <div class="add2e-monster-cap-head">
        <strong>${esc(cap.name)}</strong>
        <span>${system ? "Effet système" : esc(cap.type)}</span>
      </div>
      ${cap.description ? `<p>${esc(cap.description)}</p>` : ""}
      ${cap.activation ? `<p><b>Activation :</b> ${esc(cap.activation)}</p>` : ""}
      ${cap.effet_systeme ? `<p><b>Règle appliquée :</b> ${esc(cap.effet_systeme)}</p>` : ""}
      ${badges(cap.tags, system ? "bad" : "")}
    </div>`;
}

function installStyles() {
  const id = "add2e-monster-capabilities-style";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    .add2e.sheet.monster .monster-extra-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .add2e.sheet.monster .add2e-monster-panel { background:rgba(255,252,239,.96); border:1px solid #d9bf73; border-radius:9px; margin-bottom:10px; overflow:hidden; }
    .add2e.sheet.monster .add2e-monster-panel h2, .add2e.sheet.monster .add2e-monster-panel h3 { margin:0; padding:8px 10px; background:rgba(240,224,169,.68); border-bottom:1px solid #d9bf73; color:#6f4b12; font-weight:900; font-size:1.02rem; }
    .add2e.sheet.monster .add2e-monster-panel-body { padding:10px; }
    .add2e.sheet.monster .add2e-monster-info-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .add2e.sheet.monster .add2e-monster-info { border:1px solid #dcc782; border-radius:7px; background:#fffdf4; padding:7px; min-height:44px; }
    .add2e.sheet.monster .add2e-monster-info b { display:block; color:#6f4b12; font-size:.8rem; text-transform:uppercase; margin-bottom:2px; }
    .add2e.sheet.monster .add2e-monster-cap-card { border:1px solid #dcc782; border-radius:8px; background:#fffdf4; padding:9px; margin-bottom:8px; }
    .add2e.sheet.monster .add2e-monster-cap-card.system { border-color:#ca8a8a; background:#fff7f2; }
    .add2e.sheet.monster .add2e-monster-cap-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:5px; }
    .add2e.sheet.monster .add2e-monster-cap-head strong { color:#3d2b0a; }
    .add2e.sheet.monster .add2e-monster-cap-head span { border:1px solid #d6bd70; background:#fff8df; color:#55390d; border-radius:999px; padding:2px 7px; font-size:.78rem; font-weight:900; white-space:nowrap; }
    .add2e.sheet.monster .add2e-monster-cap-card.system .add2e-monster-cap-head span { border-color:#ca8a8a; background:#fff0ec; color:#8a1f18; }
    .add2e.sheet.monster .add2e-monster-cap-card p { margin:.25rem 0; }
    .add2e.sheet.monster .add2e-monster-badges { display:flex; flex-wrap:wrap; gap:5px; margin-top:6px; }
    .add2e.sheet.monster .add2e-monster-badge { display:inline-flex; align-items:center; padding:3px 6px; border-radius:999px; border:1px solid #d6bd70; background:#fff8df; color:#55390d; font-weight:700; font-size:.78rem; }
    .add2e.sheet.monster .add2e-monster-badge.bad { border-color:#ca8a8a; background:#fff0ec; color:#8a1f18; }
    .add2e.sheet.monster .add2e-monster-note { color:#7f704d; font-style:italic; }
  `;
  document.head.appendChild(style);
}

function buildCapTab(actor) {
  const system = actor?.system ?? {};
  const caps = monsterCaps(system);
  const mjCaps = caps.filter(c => c.affichage !== "systeme");
  const sysCaps = caps.filter(c => c.affichage === "systeme");

  const mjHtml = mjCaps.length ? mjCaps.map(c => capCard(c, false)).join("") : `<p class="add2e-monster-note">Aucune capacité informative renseignée.</p>`;
  const sysHtml = sysCaps.length ? sysCaps.map(c => capCard(c, true)).join("") : `<p class="add2e-monster-note">Aucun effet système propre au monstre. Les tactiques sans valeur chiffrée restent des notes MJ.</p>`;

  return `
    <div class="tab" data-group="primary" data-tab="capacites">
      <div class="monster-extra-grid">
        <section class="add2e-monster-panel"><h2>Capacités / notes MJ</h2><div class="add2e-monster-panel-body">${mjHtml}</div></section>
        <section class="add2e-monster-panel"><h2>Effets système prévus</h2><div class="add2e-monster-panel-body">${sysHtml}</div></section>
      </div>
      <section class="add2e-monster-panel">
        <h2>Sens, langues et tags techniques</h2>
        <div class="add2e-monster-panel-body">
          <div class="add2e-monster-info-grid">
            ${infoCard("Sens", system.senses)}
            ${infoCard("Langues", system.languages)}
          </div>
          ${badges(system.tags)}
          ${badges(system.effectTags)}
        </div>
      </section>
    </div>`;
}

function buildDetails(actor) {
  const s = actor?.system ?? {};
  return `
    <section class="add2e-monster-panel add2e-monster-details-readonly">
      <h2>Résumé complet du monstre</h2>
      <div class="add2e-monster-panel-body add2e-monster-info-grid">
        ${infoCard("Fréquence", s.frequency)}
        ${infoCard("Habitat", s.habitat)}
        ${infoCard("Organisation", s.organization)}
        ${infoCard("Cycle", s.activityCycle)}
        ${infoCard("Régime", s.diet)}
        ${infoCard("Nombre apparaissant", s.numberAppearing)}
        ${infoCard("Intelligence", s.intelligence)}
        ${infoCard("Moral", s.morale)}
        ${infoCard("Trésor", s.treasure)}
        ${infoCard("PX", s.xp)}
        ${infoCard("Sauvegardes", s.savingThrows)}
        ${infoCard("Résistance magique", s.magicResistance)}
      </div>
    </section>`;
}

function isMonsterActor(actor) {
  return [actor?.type, actor?._source?.type, actor?.baseActor?.type, actor?.document?.type]
    .some(type => norm(type) === "monster");
}

function isProjectilePropulsedWeapon(weapon) {
  return globalThis.add2eGetWeaponUsageProfile?.(weapon)?.isProjectilePropulse === true;
}

function monsterVirtualProjectile(weapon) {
  const weaponId = String(weapon?.id ?? weapon?._id ?? "weapon").replace(/[^a-zA-Z0-9_-]/g, "") || "weapon";
  return {
    id: `add2e-monster-projectile-${weaponId}`,
    name: "Munitions de monstre",
    type: "objet",
    img: weapon?.img ?? "icons/svg/target.svg",
    system: {
      equipee: true,
      equipped: true,
      quantite: 1,
      quantity: 1,
      categorie: "munition",
      munitionType: "virtuel"
    },
    flags: { add2e: { monsterVirtualProjectile: true } }
  };
}

function installMonsterRangedProjectileBridge() {
  const current = globalThis.add2eGetEquippedProjectileForWeapon;
  if (typeof current !== "function") return false;
  if (current.__add2eMonsterRangedProjectileBridge === true) return true;

  const original = current;
  const wrapped = function add2eGetEquippedProjectileForMonsterRangedAttack(actor, weapon) {
    if (isMonsterActor(actor) && isProjectilePropulsedWeapon(weapon)) return monsterVirtualProjectile(weapon);
    return original.call(this, actor, weapon);
  };

  wrapped.__add2eMonsterRangedProjectileBridge = true;
  wrapped.__add2eMonsterRangedProjectileOriginal = original;
  globalThis.add2eGetEquippedProjectileForWeapon = wrapped;
  return true;
}

function installMonsterActorSheetFallback(actor) {
  if (!actor || actor.type !== "monster") return false;
  if (actor.__add2eMonsterSheetFallback === ADD2E_MONSTER_CAPABILITIES_VERSION) return false;

  try {
    if (actor.sheet?.render) return false;
  } catch (_err) {}

  let cachedSheet = null;
  Object.defineProperty(actor, "sheet", {
    configurable: true,
    get() {
      if (cachedSheet?.render) return cachedSheet;
      if (typeof globalThis.Add2eMonsterActorSheetV2 === "function") cachedSheet = new globalThis.Add2eMonsterActorSheetV2({ document: actor });
      else if (typeof globalThis.Add2eMonsterSheet === "function") cachedSheet = new globalThis.Add2eMonsterSheet(actor);
      return cachedSheet ?? null;
    }
  });

  actor.__add2eMonsterSheetFallback = ADD2E_MONSTER_CAPABILITIES_VERSION;
  return true;
}

function installMonsterActorSheetFallbacks() {
  let patched = 0;
  for (const actor of game.actors ?? []) if (installMonsterActorSheetFallback(actor)) patched++;
  console.log("[ADD2E][MONSTER_SHEET][ACTOR_SHEET_FALLBACK]", { version: ADD2E_MONSTER_CAPABILITIES_VERSION, patched });
  return true;
}

function registerMonsterActorSheetV2Wrapper() {
  if (globalThis.Add2eMonsterActorSheetV2 || typeof globalThis.Add2eMonsterSheet !== "function") return !!globalThis.Add2eMonsterActorSheetV2;

  const ActorSheetV2 = foundry?.applications?.sheets?.ActorSheetV2;
  const ActorsCollection = foundry?.documents?.collections?.Actors;
  if (typeof ActorSheetV2 !== "function" || !ActorsCollection?.registerSheet) return false;

  class Add2eMonsterActorSheetV2 extends ActorSheetV2 {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS ?? {}, {
      id: "add2e-monster-actorsheet-v2",
      classes: ["add2e", "sheet", "actor", "monster"],
      tag: "section",
      window: { title: "ADD2e Descartes (FR) - Monstre", resizable: true },
      position: { width: 720, height: 850 }
    }, { inplace: false });

    constructor(options = {}, ...args) {
      if (options?.documentName === "Actor" || options?.type === "monster") options = { document: options };
      super(options, ...args);
    }

    get title() { return this.actor?.name ?? super.title; }
    get editable() { return this.isEditable; }

    async getData() { return globalThis.Add2eMonsterSheet.prototype.getData.call(this); }
    async _renderHTML(context, options) { return globalThis.Add2eMonsterSheet.prototype._renderHTML.call(this, context, options); }
    _replaceHTML(result, content, options) { return globalThis.Add2eMonsterSheet.prototype._replaceHTML.call(this, result, content, options); }
    async _updateObject(event, formData) { return globalThis.Add2eMonsterSheet.prototype._updateObject.call(this, event, formData); }
    _captureViewBeforeRender(root) { return globalThis.Add2eMonsterSheet.prototype._captureViewBeforeRender.call(this, root); }
    _renderPreservingView(root) { return globalThis.Add2eMonsterSheet.prototype._renderPreservingView.call(this, root); }
    _restoreViewAfterRender(content) { return globalThis.Add2eMonsterSheet.prototype._restoreViewAfterRender.call(this, content); }
    _activateAutoSubmit(root) { return globalThis.Add2eMonsterSheet.prototype._activateAutoSubmit.call(this, root); }
    activateListeners(content) { return globalThis.Add2eMonsterSheet.prototype.activateListeners.call(this, content); }
    _injectLayoutFix() { return globalThis.Add2eMonsterSheet.prototype._injectLayoutFix.call(this); }
    async _setMonsterItemEquipped(item, equipped, reason) { return globalThis.Add2eMonsterSheet.prototype._setMonsterItemEquipped.call(this, item, equipped, reason); }
    async _onEquipItem(item) { return globalThis.Add2eMonsterSheet.prototype._onEquipItem.call(this, item); }
    async _recalculerCA() { return globalThis.Add2eMonsterSheet.prototype._recalculerCA.call(this); }
  }

  globalThis.Add2eMonsterActorSheetV2 = Add2eMonsterActorSheetV2;

  try {
    if (typeof ActorsCollection.unregisterSheet === "function") ActorsCollection.unregisterSheet("add2e", globalThis.Add2eMonsterSheet, { types: ["monster"] });
  } catch (_err) {}

  ActorsCollection.registerSheet("add2e", Add2eMonsterActorSheetV2, {
    types: ["monster"],
    makeDefault: true,
    label: "ADD2e Descartes (FR) - Monstre"
  });

  console.log("[ADD2E][MONSTER_SHEET][ACTORSHEETV2_REGISTERED]", ADD2E_MONSTER_CAPABILITIES_VERSION);
  return true;
}

Hooks.on("renderAdd2eMonsterSheet", (app, html, data) => {
  try {
    installStyles();
    const actor = app?.actor ?? data?.actor;
    if (!actor || actor.type !== "monster") return;

    const $html = html instanceof jQuery ? html : $(html);
    const tabs = $html.find(".sheet-tabs");
    const body = $html.find(".sheet-body");
    if (!tabs.length || !body.length) return;

    if (!tabs.find('[data-tab="capacites"]').length) {
      tabs.find('[data-tab="magie"], [data-tab="description"]').first().before(`<a class="item" data-tab="capacites"><i class="fas fa-list-check"></i> Capacités</a>`);
    }

    body.find('[data-tab="capacites"]').remove();
    const magieTab = body.find('[data-tab="magie"]');
    if (magieTab.length) magieTab.before(buildCapTab(actor));
    else body.append(buildCapTab(actor));

    const descTab = body.find('[data-tab="description"]');
    if (descTab.length && !descTab.find(".add2e-monster-details-readonly").length) descTab.prepend(buildDetails(actor));

    const effectsTab = body.find('[data-tab="effets"]');
    if (effectsTab.length && !effectsTab.find(".add2e-monster-effect-explain").length) {
      effectsTab.prepend(`<div class="add2e-monster-panel add2e-monster-effect-explain"><h2>Règle d’usage</h2><div class="add2e-monster-panel-body add2e-monster-note">Cet onglet doit contenir uniquement les effets qui modifient réellement la résolution de jeu ou qui doivent être activés/désactivés. Embuscade, attaque en groupe, discipline, écholocation narrative ou tactiques non chiffrées restent dans Capacités / notes MJ.</div></div>`);
    }

    $html.off("click.add2e-monster-cap-tabs").on("click.add2e-monster-cap-tabs", ".sheet-tabs .item", ev => {
      ev.preventDefault();
      const tab = ev.currentTarget.dataset.tab;
      $html.find(".sheet-tabs .item").removeClass("active");
      $(ev.currentTarget).addClass("active");
      $html.find(".sheet-body .tab").removeClass("active");
      $html.find(`.sheet-body .tab[data-tab=\"${tab}\"]`).addClass("active");
    });
  } catch (err) {
    console.error("[ADD2E][MONSTER_SHEET][CAPABILITIES] Erreur d'affichage", err);
  }
});

Hooks.once("ready", () => {
  installMonsterRangedProjectileBridge();
  registerMonsterActorSheetV2Wrapper();
  installMonsterActorSheetFallbacks();
  setTimeout(() => {
    installMonsterRangedProjectileBridge();
    registerMonsterActorSheetV2Wrapper();
    installMonsterActorSheetFallbacks();
  }, 500);
  if (!globalThis.__ADD2E_MONSTER_SHEET_CREATE_HOOK) {
    globalThis.__ADD2E_MONSTER_SHEET_CREATE_HOOK = true;
    Hooks.on("createActor", actor => {
      if (actor?.type === "monster") setTimeout(() => installMonsterActorSheetFallback(actor), 0);
    });
  }
});

console.log("[ADD2E][MONSTER_SHEET][CAPABILITIES] Module chargé", ADD2E_MONSTER_CAPABILITIES_VERSION);
