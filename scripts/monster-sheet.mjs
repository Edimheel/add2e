/**
 * Feuille de Monstre ADD2e - Version Finale Dynamique
 * - Layout stabilisé (CSS injecté)
 * - Inventaire complet (Armes, Armures, Loot)
 * - Injection automatique des pouvoirs d'objets (Baguettes, etc.)
 * - NETTOYAGE VISUEL AUTOMATIQUE (Hooks à la fin du fichier)
 */

// TABLE DE SAUVEGARDE GUERRIER (AD&D 2e)
const FIGHTER_SAVES = [
  { level: 0,  saves: [16, 17, 18, 20, 19] }, // < 1 DV
  { level: 1,  saves: [14, 16, 15, 17, 17] }, // 1-2 DV
  { level: 3,  saves: [13, 15, 14, 16, 16] }, // 3-4 DV
  { level: 5,  saves: [11, 13, 12, 13, 14] }, // 5-6 DV
  { level: 7,  saves: [10, 12, 11, 12, 13] }, // 7-8 DV
  { level: 9,  saves: [8,  10, 9,  9,  11] }, // 9-10 DV
  { level: 11, saves: [7,  9,  8,  8,  10] }, // 11-12 DV
  { level: 13, saves: [5,  7,  6,  5,  8]  }, // 13-14 DV
  { level: 15, saves: [4,  6,  5,  4,  7]  }, // 15-16 DV
  { level: 17, saves: [3,  5,  4,  4,  6]  }  // 17+ DV
];

export class Add2eMonsterSheet extends ActorSheet {
  
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "actor", "monster"],
      template: "systems/add2e/templates/actor/monster-sheet.hbs",
      width: 720,
      height: 850,
      resizable: true,
      tabs: [{ 
        navSelector: ".sheet-tabs", 
        contentSelector: ".sheet-body", 
        initial: "combat" 
      }]
    });
  }

  async getData() {
    const data = await super.getData();
    data.system = this.actor.system;
    data.actor = this.actor; 

    // 1. CALCUL DES SAUVEGARDES
    const manualSaves = data.system.sauvegardes;
    let finalSaves = [];

    if (manualSaves && (Array.isArray(manualSaves) || typeof manualSaves === 'object')) {
        const arr = Array.isArray(manualSaves) ? manualSaves : Object.values(manualSaves);
        if (arr.length >= 5) finalSaves = arr.map(Number);
    }

    if (finalSaves.length < 5) {
        let dv = parseInt(data.system.hitDice) || 1;
        let saveLine = FIGHTER_SAVES.slice().reverse().find(l => dv >= l.level) || FIGHTER_SAVES[1];
        finalSaves = saveLine.saves;
    }

    data.calculatedSaves = {
      paralysie: finalSaves[0],
      baguettes: finalSaves[1],
      petrification: finalSaves[2],
      souffle: finalSaves[3],
      sorts: finalSaves[4]
    };
    
    // Force l'affichage des boutons
    data.isSavingThrowString = false; 

    // 2. LISTES D'ITEMS
    data.listeArmes = this.actor.items.filter(i => i.type === "arme");
    data.listeArmures = this.actor.items.filter(i => i.type === "armure");
    data.listeObjets = this.actor.items.filter(i => 
        ["objet", "equipement", "consommable", "loot", "conteneur"].includes(i.type)
    );

    const sorts = this.actor.items.filter(i => i.type === "sort");

    // 3. INJECTION POUVOIRS (ARMES MAGIQUES)
    const armesEquipees = this.actor.items.filter(i => i.type === "arme" && i.system.equipee);
    for (const arme of armesEquipees) {
      if (Array.isArray(arme.system.pouvoirs)) {
        for (let [idx, p] of arme.system.pouvoirs.entries()) {
          const validFakeId = arme.id.substring(0, 14) + idx.toString().padStart(2, "0");
          const fakeSpellData = {
            _id: validFakeId, 
            name: `${p.name}`,
            type: "sort",
            img: p.img || arme.img,
            system: {
              niveau: p.niveau || 1,
              école: p.ecole || "Magique",
              description: p.description || "",
              composantes: "Objet",
              temps_incantation: "1",
              isPower: true,
              sourceWeaponId: arme.id,
              powerIndex: idx,
              cost: p.cout || 1,
              max: p.max || 1,
              onUse: p.onUse || ""
            }
          };
          const virtualSpell = new Item(fakeSpellData, { parent: this.actor });
          virtualSpell.getFlag = (scope, key) => {
            if (key === "memorizedCount") {
               const charges = arme.getFlag("add2e", `charges_${idx}`);
               return (charges !== undefined) ? charges : p.max;
            }
            return null;
          };
          sorts.push(virtualSpell);
        }
      }
    }

    // Organisation Sorts
    const sortsParNiveau = {};
    for (const sort of sorts) {
      let niv = Number(sort.system.niveau) || 1;
      if (!sortsParNiveau[niv]) sortsParNiveau[niv] = [];
      sortsParNiveau[niv].push(sort);
    }
    data.niveauxSorts = Object.keys(sortsParNiveau).map(Number).sort((a, b) => a - b);
    data.sortsParNiveau = sortsParNiveau;
    
    data.sortsMemorizedByLevel = {}; 
    for (const niv of data.niveauxSorts) {
        let count = 0;
        for (const s of sortsParNiveau[niv]) {
            count += Number(s.getFlag("add2e", "memorizedCount") || 0);
        }
        data.sortsMemorizedByLevel[niv] = { count: count, max: "-" };
    }

    // 4. EFFETS ACTIFS
    data.activeEffectsList = this.actor.effects.map(eff => {
      let durationStr = "Permanente";
      if (eff.duration?.rounds) durationStr = `${eff.duration.rounds} rds`;
      else if (eff.duration?.seconds) durationStr = `${eff.duration.seconds} s`;
      else if (eff.isTemporary) durationStr = "Temporaire";

      let desc = eff.description || "";
      if (!desc && eff.flags?.add2e?.tags) {
         desc = eff.flags.add2e.tags.join(", ");
      }

      return {
        id: eff.id,
        name: eff.name || eff.label,
        img: eff.img || eff.icon || "icons/svg/aura.svg",
        disabled: eff.disabled,
        duration: durationStr,
        description: desc,
        sourceName: eff.origin ? "Source externe" : "Propre"
      };
    });

    await this._recalculerCA();

    return data;
  }

  async _updateObject(event, formData) {
    if (!formData.name || formData.name.trim() === "") formData.name = this.actor.name;
    return super._updateObject(event, formData);
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // Injection du CSS correctif pour le layout
    this._injectLayoutFix(html);

    // Onglets
    html.find('.sheet-tabs .item').click(ev => {
      ev.preventDefault();
      const tabName = $(ev.currentTarget).data("tab");
      html.find('.sheet-tabs .item').removeClass("active");
      html.find('.tab').removeClass("active");
      $(ev.currentTarget).addClass("active");
      html.find(`.tab[data-tab="${tabName}"]`).addClass("active");
    });

    // Jets de Sauvegarde
    html.find('.roll-save').click(async ev => {
      ev.preventDefault();
      const btn = $(ev.currentTarget);
      const index = Number(btn.data('saveIndex'));
      const seuil = parseInt(btn.data('saveVal')) || 20;
      
      const labels = ["Paralysie / Mort", "Baguettes", "Pétrification", "Souffle", "Sorts"];
      const label = labels[index] || "Sauvegarde";
      const colors = ["#16a085", "#f39c12", "#8e44ad", "#d35400", "#c0392b"];
      const icons = ["fa-skull-crossbones", "fa-magic", "fa-cubes", "fa-wind", "fa-scroll"];
      const color = colors[index] || "#444";
      const icon = icons[index] || "fa-dice-d20";

      const roll = new Roll("1d20");
      await roll.evaluate();
      if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);

      const success = roll.total >= seuil;
      const content = `
        <div class="add2e-card-test" style="border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.2); background:linear-gradient(135deg, #fff 0%, #f0f0f0 100%); border:2px solid ${color}; padding:5px 10px; font-family:var(--font-primary);">
          <div style="display:flex; align-items:center; gap:10px; border-bottom:1px solid #ccc; padding-bottom:5px; margin-bottom:5px;">
            <i class="fas ${icon}" style="font-size:1.5em; color:${color};"></i>
            <div><div style="font-weight:bold; font-size:1.1em; color:${color};">${label}</div><div style="font-size:0.8em; color:#666;">Jet de Sauvegarde (Monstre)</div></div>
          </div>
          <div style="font-size:1.1em; text-align:center; margin:5px 0;">Seuil : <b>${seuil}</b> | Résultat : <b>${roll.total}</b></div>
          <div style="text-align:center; font-weight:bold; font-size:1.2em; margin-top:5px; color:${success ? '#27ae60' : '#c0392b'};">${success ? 'SUCCÈS' : 'ÉCHEC'}</div>
        </div>
      `;
      ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: content });
    });

    // Effets
    html.find('.effect-control').click(async ev => {
      ev.preventDefault();
      const btn = $(ev.currentTarget);
      const action = btn.data('action');
      const id = btn.data('effectId');
      
      if (action === 'create') {
          return this.actor.createEmbeddedDocuments("ActiveEffect", [{
              name: "Nouvel Effet",
              icon: "icons/svg/aura.svg",
              origin: this.actor.uuid,
              duration: { rounds: 1 }
          }]);
      }
      const eff = this.actor.effects.get(id);
      if (!eff) return;
      if (action === 'toggle') return eff.update({ disabled: !eff.disabled });
      if (action === 'edit') return eff.sheet.render(true);
      if (action === 'delete') return eff.delete(); // Déclenche le Hook défini plus bas
    });

    // Items (Équipement & Objets & Sorts)
    html.find('.item-equip').click(async ev => {
      const id = $(ev.currentTarget).data("itemId");
      const item = this.actor.items.get(id);
      if (item) await this._onEquipItem(item);
    });
    html.find('.item-edit, .arme-edit, .armure-edit, .sort-edit, .objet-edit').click(ev => {
      const id = $(ev.currentTarget).data("itemId") || $(ev.currentTarget).data("sortId");
      const item = this.actor.items.get(id);
      if (item) item.sheet.render(true);
    });
    html.find('.item-delete, .arme-delete, .armure-delete, .sort-delete, .objet-delete').click(async ev => {
      const id = $(ev.currentTarget).data("itemId") || $(ev.currentTarget).data("sortId");
      await this.actor.deleteEmbeddedDocuments("Item", [id]);
    });

    // Actions Spéciales
    html.find('.arme-img-attack').click(ev => {
      const id = $(ev.currentTarget).data("itemId");
      const item = this.actor.items.get(id);
      if (globalThis.add2eAttackRoll) globalThis.add2eAttackRoll({ actor: this.actor, arme: item });
    });

    // Sorts & Pouvoirs
    html.find('.sort-cast-img').click(ev => {
      ev.preventDefault();
      const sortId = $(ev.currentTarget).data("sortId");
      let item = this.actor.items.get(sortId);

      // Objets Magiques Virtuels
      if (!item) {
          const armesEquipees = this.actor.items.filter(i => i.type === "arme" && i.system.equipee && Array.isArray(i.system.pouvoirs));
          for (const arme of armesEquipees) {
              for (let [idx, p] of arme.system.pouvoirs.entries()) {
                  const fakeId = arme.id.substring(0, 14) + idx.toString().padStart(2, "0");
                  if (fakeId === sortId) {
                      const fakeSpellData = {
                          _id: fakeId,
                          name: `${p.name}`,
                          type: "sort",
                          img: p.img || arme.img,
                          system: {
                              niveau: p.niveau || 1,
                              isPower: true,
                              sourceWeaponId: arme.id,
                              powerIndex: idx,
                              cost: p.cout || 1,
                              max: p.max || 1,
                              onUse: p.onUse || "",
                              portee: { valeur: "Obj", unite: "" },
                              duree: { valeur: "Spec", unite: "" },
                              temps_incantation: { valeur: "1", unite: "" }
                          }
                      };
                      item = new Item(fakeSpellData, { parent: this.actor });
                      item.getFlag = (scope, key) => {
                          if (key === "memorizedCount") {
                             const charges = arme.getFlag("add2e", `charges_${idx}`);
                             return (charges !== undefined) ? charges : p.max;
                          }
                          return null;
                      };
                      break;
                  }
              }
              if (item) break;
          }
      }
      if (item && globalThis.add2eCastSpell) {
          globalThis.add2eCastSpell({ actor: this.actor, sort: item });
          this.render(false);
      }
    });

    html.find('.sort-memorize-plus').click(async ev => {
        const id = $(ev.currentTarget).data("sortId");
        const sort = this.actor.items.get(id);
        if(!sort) return;
        let cur = Number(sort.getFlag("add2e", "memorizedCount") || 0);
        await sort.setFlag("add2e", "memorizedCount", cur + 1);
        this.render(false);
    });
    html.find('.sort-memorize-minus').click(async ev => {
        const id = $(ev.currentTarget).data("sortId");
        const sort = this.actor.items.get(id);
        if(!sort) return;
        let cur = Number(sort.getFlag("add2e", "memorizedCount") || 0);
        await sort.setFlag("add2e", "memorizedCount", Math.max(0, cur - 1));
        this.render(false);
    });
    html.find('.toggle-sort-desc-chat').click(ev => {
      const id = $(ev.currentTarget).data("sortId");
      html.find(`#desc-chat-${id}`).slideToggle(200);
    });

    html.find('img[data-edit="img"]').click(ev => {
      new FilePicker({
        type: "image",
        current: this.actor.img,
        callback: path => {
            this.actor.update({ img: path });
            this.actor.update({ "prototypeToken.texture.src": path });
        }
      }).render(true);
    });
  }

  // --- STABILISATION LAYOUT ---
  _injectLayoutFix(html) {
      const styleId = "add2e-layout-fix";
      if ($(`#${styleId}`).length === 0) {
          $('head').append(`
            <style id="${styleId}">
                .add2e.sheet.monster .saves-section {
                    min-height: 65px !important;
                    margin-bottom: 2px !important;
                    display: flex; gap: 5px; align-items: center; justify-content: space-around;
                }
                .add2e.sheet.monster .sheet-tabs {
                    margin-top: 0 !important;
                    padding-top: 4px !important;
                    border-top: 2px solid #333;
                }
                .add2e.sheet.monster .sheet-body {
                    margin-top: 0 !important;
                    height: calc(100% - 240px);
                }
            </style>
          `);
      }
  }

  async _onEquipItem(item) {
    const actor = this.actor;
    const dejaEquipee = item.system.equipee === true;

    if (item.type === "arme") {
      if (dejaEquipee) { await item.update({ "system.equipee": false }); return; }
      if (item.system.deuxMains) {
        const bouclier = actor.items.find(i => i.type === "armure" && i.system.equipee && i.name.toLowerCase().includes("bouclier"));
        if (bouclier) { ui.notifications.warn(`Impossible : Bouclier équipé.`); return; }
      }
      await item.update({ "system.equipee": true });
    }
    else if (item.type === "armure") {
      if (dejaEquipee) {
        await item.update({ "system.equipee": false });
        await this._recalculerCA();
        return;
      }
      await item.update({ "system.equipee": true });
      await this._recalculerCA();
    }
  }

  async _recalculerCA() {
    const itemsEquipes = this.actor.items.filter(i => i.type === "armure" && i.system.equipee);
    let caBase = Number(this.actor.system.armorClass) || Number(this.actor.system.ca_naturel) || 10;
    let nouveauCA = caBase;
    for (const item of itemsEquipes) {
        let acItem = Number(item.system.ac);
        if (!isNaN(acItem)) {
            if (item.name.toLowerCase().includes("bouclier")) nouveauCA -= 1; 
            else if (acItem < nouveauCA) nouveauCA = acItem; 
        }
    }
    const dexDef = Number(this.actor.system.dex_def) || 0;
    nouveauCA += dexDef;
    if (nouveauCA !== this.actor.system.ca_total) await this.actor.update({ "system.ca_total": nouveauCA });
  }
}

// Enregistrement
Actors.registerSheet("add2e", Add2eMonsterSheet, {
  types: ["monster"],
  makeDefault: true,
  label: "ADD2e Descartes (FR) - Monstre"
});


/* ========================================================== */
/* HOOK GLOBAL : NETTOYAGE VISUEL LORS DE LA SUPPRESSION D'EFFET */
/* ========================================================== */
Hooks.on("deleteActiveEffect", async (effect, options, userId) => {
    // 1. Gestion du Sort "Agrandissement" (Scale Token)
    const enlargeData = effect.flags?.add2e?.enlargeData;
    if (enlargeData) {
        const tokenDoc = canvas.scene.tokens.get(enlargeData.tokenId);
        if (tokenDoc) {
            console.log(`[ADD2e] Restauration taille token ${tokenDoc.name} à ${enlargeData.originalScale}`);
            // Si l'utilisateur a les droits, il le fait, sinon le GM le fera via le hook
            if (game.user.isGM || tokenDoc.actor?.isOwner) {
                await tokenDoc.update({
                    "texture.scaleX": enlargeData.originalScale,
                    "texture.scaleY": enlargeData.originalScale
                });
            } else if (game.socket && game.user.isGM) {
                // Securité supplémentaire: le GM execute toujours
            }
        }
    }

    // 2. Gestion Sequencer (Nettoyage Effets Visuels liés à l'effet)
    // Si le module Sequencer est actif, on tente de supprimer les effets liés à cet ActiveEffect
    if (globalThis.Sequencer) {
        // La convention Sequencer est souvent d'utiliser l'origin ou une ID spécifique
        // On tente de fermer les effets qui ont pour origine cet effet
        Sequencer.EffectManager.endEffects({ origin: effect.uuid });
        
        // Ou si l'effet a été créé avec un nom spécifique
        Sequencer.EffectManager.endEffects({ name: effect.name });
    }
});
/* ========================================================== */
/* ADD2E — AUTO-LINK ARMES MONSTRES AU DROP (TOKEN CREATE)     */
/* - Ignore system.damage du JSON monster                     */
/* - Utilise system.attackTypes pour importer depuis compendium */
/* ========================================================== */

const ADD2E_WEAPON_PACK = "add2e.armes";
let __add2eWeaponIndexCache = null;

function __add2eNormalize(str) {
  return (str ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")          // enlève accents
    .replace(/[’']/g, "'")                   // homogénéise apostrophes
    .replace(/\s+/g, " ");                   // espaces multiples
}

async function __add2eGetWeaponPack() {
  const pack = game.packs.get(ADD2E_WEAPON_PACK); // <-- IMPORTANT (pas "Compendium.xxx")
  if (!pack) {
    console.warn(`[ADD2E][WEAP] Pack introuvable: ${ADD2E_WEAPON_PACK}`);
    return null;
  }
  return pack;
}

async function __add2eGetWeaponPackIndex() {
  if (__add2eWeaponIndexCache) return __add2eWeaponIndexCache;

  const pack = await __add2eGetWeaponPack();
  if (!pack) {
    __add2eWeaponIndexCache = [];
    return __add2eWeaponIndexCache;
  }

  const idx = await pack.getIndex({ fields: ["name", "type"] });
  __add2eWeaponIndexCache = Array.from(idx ?? []);
  console.log(`[ADD2E][WEAP] Index chargé (${ADD2E_WEAPON_PACK}):`, __add2eWeaponIndexCache.length);
  return __add2eWeaponIndexCache;
}

async function __add2eImportWeaponToActorByName(actor, weaponName) {
  const wantedRaw = (weaponName ?? "").toString().trim();
  const wanted = __add2eNormalize(wantedRaw);
  if (!wanted) return false;

  // Déjà présent ?
  const already = actor.items.find(i => i.type === "arme" && __add2eNormalize(i.name) === wanted);
  if (already) return false;

  const pack = await __add2eGetWeaponPack();
  if (!pack) return false;

  const idx = await __add2eGetWeaponPackIndex();

  // Debug : montre ce qu'on cherche
  console.log(`[ADD2E][WEAP] Recherche arme: "${wantedRaw}" -> "${wanted}"`);

  // Filtre type "arme" si type est présent dans l'index
  const entry =
    idx.find(e => __add2eNormalize(e.name) === wanted && (!e.type || e.type === "arme")) ||
    idx.find(e => __add2eNormalize(e.name) === wanted); // fallback

  if (!entry) {
    console.warn(`[ADD2E][WEAP] Arme non trouvée: "${wantedRaw}" (clé "${wanted}") dans ${ADD2E_WEAPON_PACK}`);
    // Debug : suggestion proche (contient le token)
    const suggestions = idx
      .map(e => e.name)
      .filter(n => __add2eNormalize(n).includes(wanted) || wanted.includes(__add2eNormalize(n)))
      .slice(0, 10);
    if (suggestions.length) console.warn(`[ADD2E][WEAP] Suggestions:`, suggestions);
    return false;
  }

  const doc = await pack.getDocument(entry._id);
  if (!doc) return false;
  if (doc.type !== "arme") {
    console.warn(`[ADD2E][WEAP] Doc trouvé mais type != "arme":`, doc.name, doc.type);
    return false;
  }

  const data = doc.toObject();
  delete data._id;

  await actor.createEmbeddedDocuments("Item", [data]);
  console.log(`[ADD2E][WEAP] Import OK: "${doc.name}" -> ${actor.name}`);
  return true;
}


async function __add2eEnsureMonsterWeapons(actor) {
try {
    if (!actor) return;
    if (actor.type !== "monster") return;

    const attackTypes = actor.system?.attackTypes; // ✅ OBLIGATOIRE

    console.log(`[ADD2E][WEAP] ${actor.name} attackTypes=`, attackTypes);

    if (!attackTypes || typeof attackTypes !== "string") {
      await actor.setFlag("add2e", "weaponsLinkedFromPack", true);
      return;
    }

    // "Épée courte, dague, arc court" -> ["Épée courte", "dague", "arc court"]
    const names = attackTypes
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    let imported = 0;
    for (const n of names) {
      const ok = await __add2eImportWeaponToActorByName(actor, n);
      if (ok) imported++;
    }

    await actor.setFlag("add2e", "weaponsLinkedFromPack", true);
    console.log(`[ADD2E][WEAP] ${actor.name}: ${imported} arme(s) importée(s) depuis ${ADD2E_WEAPON_PACK}`);
  } catch (e) {
    console.error("[ADD2E][WEAP] EnsureMonsterWeapons failed", e);
  }
}

/**
 * Point d'accroche demandé: "au moment du drop du monstre sur la scène"
 * => createToken
 */
Hooks.on("createToken", async (tokenDoc) => {
  const actor = tokenDoc?.actor;
  if (!actor) return;

  // On ne fait rien pour les PJ/NPC non-monstres
  if (actor.type !== "monster") return;

  // Au drop, on injecte les armes depuis compendium
  await __add2eEnsureMonsterWeapons(actor);
});
