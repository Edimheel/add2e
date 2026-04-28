/**
 * scripts/add2e-attack.js
 * Gestion des attaques, dégâts et sorts pour AD&D 2e
 * VERSION : GESTION CHARGES GLOBALES (CRISTAL) + PAR POUVOIR (MAGIUS)
 */

// --- TABLE 39 : THAC0 MONSTRES ---
const MONSTER_THACO_TABLE = [
  { min: 0,    max: 0.99, thaco: 20 },
  { min: 1,    max: 1.99, thaco: 19 },
  { min: 2,    max: 2.99, thaco: 19 },
  { min: 3,    max: 3.99, thaco: 17 },
  { min: 4,    max: 4.99, thaco: 17 },
  { min: 5,    max: 5.99, thaco: 15 },
  { min: 6,    max: 6.99, thaco: 15 },
  { min: 7,    max: 7.99, thaco: 13 },
  { min: 8,    max: 8.99, thaco: 13 },
  { min: 9,    max: 9.99, thaco: 11 },
  { min: 10,   max: 10.99, thaco: 11 },
  { min: 11,   max: 11.99, thaco: 9 },
  { min: 12,   max: 12.99, thaco: 9 },
  { min: 13,   max: 13.99, thaco: 7 },
  { min: 14,   max: 14.99, thaco: 7 },
  { min: 15,   max: 15.99, thaco: 5 },
  { min: 16,   max: 999,   thaco: 5 }
];

function getMonsterThaco(hdString) {
  const match = String(hdString).match(/^(\d+)/);
  const hd = match ? parseFloat(match[1]) : 1;
  const entry = MONSTER_THACO_TABLE.find(e => hd >= e.min && hd <= e.max);
  return entry ? entry.thaco : 20;
}

function formatSortChamp(val, niveau = 1) {
  if (!val) return "-";
  if (typeof val === "object") {
    const v = val.valeur !== undefined ? val.valeur : "";
    const u = val.unite ? (" " + val.unite) : "";
    return `${v}${u}`.trim() || "-";
  }
  return val;
}

/**
 * Application des dégâts via le système de Flag (Unifié)
 */
/**
 * Application des dégâts via le système de Flag (Émetteur)
 */
/**
 * Application universelle de dégâts
 * - Joueur : envoie un "flag" de dégâts au MJ via socket
 * - MJ     : applique directement
 */
/**
 * Application universelle de dégâts
 * - Joueur : envoie un "flag" de dégâts au MJ via socket
 * - MJ     : applique directement
 */
async function add2eApplyDamage({ cible, montant, type = "", details = "" }) {
  if (!cible) {
    ui.notifications.error("Pas de cible !");
    return;
  }

  const dmg = Number(montant) || 0;
  console.log(`ADD2E SOCKET | 🎯 Demande de dégâts (${dmg}) sur`, cible?.name);

  // === CAS JOUEUR : on envoie un FLAG au MJ ===
  if (!game.user.isGM) {
    if (!game.socket) {
      console.warn("ADD2E SOCKET | ⚠️ game.socket indisponible côté joueur.");
      ui.notifications.error("Socket Foundry indisponible (game.socket).");
      return;
    }

    const tokenId =
      cible.token?.id ||
      (cible instanceof Token ? cible.id : null);

    const actorId =
      cible.actor?.id || // si cible = Token
      cible.id;          // si cible = Actor

    const flagData = {
      montant: dmg,
      type,
      details,
      source: "attack",
      fromUserId: game.user.id,
      timestamp: Date.now()
    };

    console.log("ADD2E SOCKET | 📤 Joueur -> emit applyDamageFlag :", {
      tokenId,
      actorId,
      flagData
    });

    game.socket.emit("system.add2e", {
      type: "applyDamageFlag",
      tokenId,
      actorId,
      flagData
    });

    ui.notifications.info(`Dégâts (${dmg}) envoyés au MJ.`);
    return;
  }

  // === CAS MJ : application directe ===
  console.log("ADD2E SOCKET | 🛠️ MJ -> Application directe dégâts.");

  const actor = cible.actor || cible;

  // Alignement strict sur ta fiche :
  // - max = system.points_de_coup
  // - courant = system.pdv
  const maxHP = Number(actor.system?.points_de_coup) || 0;

  // Si pdv n'existe pas, on l'initialise au max (sans toucher au max).
  let currentHP = actor.system?.pdv;
  if (currentHP === undefined || currentHP === null || currentHP === "" || isNaN(Number(currentHP))) {
    currentHP = maxHP;
  } else {
    currentHP = Number(currentHP) || 0;
  }

  const oldHP = currentHP;
  const newHP = oldHP - dmg; // dmg>0 => dégâts, dmg<0 => soins

  // Mise à jour UNIQUEMENT des PV courants
  // (PV max = points_de_coup ne bouge jamais ici)
  const updateData = { "system.pdv": newHP };

  // Optionnel mais recommandé : si pdv était absent, on force l’écriture (déjà inclus)
  await actor.update(updateData);

  console.log(
    `ADD2E SOCKET | 💉 PV courants sur ${actor.name} : ${oldHP} -> ${newHP} (${dmg >= 0 ? "-" : "+"}${Math.abs(dmg)}) | PV max inchangé = ${maxHP}`
  );

  // === Gestion états inconscient / mort via status overlay (MJ seulement) ===
  try {
    const DEAD_STATUS = "dead";
    const UNCONSCIOUS_STATUS = "unconscious";

    const toggleStatus = async (id, options) => {
      if (!id) return;
      await actor.toggleStatusEffect(id, options);
    };

    if (newHP <= -11) {
      await toggleStatus(UNCONSCIOUS_STATUS, { active: false, overlay: false });
      await toggleStatus(DEAD_STATUS,        { active: true,  overlay: true  });
      console.log("ADD2E SOCKET | 🎭 Statut overlay : MORT");
    } else if (newHP <= 0) {
      await toggleStatus(DEAD_STATUS,        { active: false, overlay: false });
      await toggleStatus(UNCONSCIOUS_STATUS, { active: true,  overlay: true  });
      console.log("ADD2E SOCKET | 🎭 Statut overlay : INCONSCIENT");
    } else {
      await toggleStatus(DEAD_STATUS,        { active: false, overlay: false });
      await toggleStatus(UNCONSCIOUS_STATUS, { active: false, overlay: false });
      console.log("ADD2E SOCKET | 🎭 Statut overlay : aucun (PV > 0)");
    }
  } catch (e) {
    console.warn("ADD2E SOCKET | ⚠️ Erreur mise à jour overlay HP (MJ direct) :", e);
  }

  ui.notifications.info(`${actor.name} prend ${dmg} dégâts.`);
}

// accès global pour macros
globalThis.add2eApplyDamage = add2eApplyDamage;



function getEffetTypeByNom(arme, mappingTable) {
  const nom = (arme.name || arme.system?.nom || "").toLowerCase();
  for (const entry of mappingTable) {
    if (entry.patterns.some(p => nom.includes(p))) {
      return entry.type;
    }
  }
  return "";
}

function plageToRollFormula(plage) {
  if (typeof plage !== "string") return plage;
  if (plage.includes("d")) return plage;
  const match = plage.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) return plage;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (isNaN(min) || isNaN(max) || max <= min) return plage;
  const faces = max - min + 1;
  const bonus = min - 1;
  return `1d${faces}` + (bonus > 0 ? `+${bonus}` : "");
}

/**
 * Script principal d'attaque AD&D2e
 */
async function add2eAttackRoll({ actor, arme, actorId, itemId }) {
  if (!actor && actorId) actor = game.actors.get(actorId);
  if (!arme && itemId && actor) arme = actor.items.get(itemId);

  if (!actor) return ui.notifications.warn("Acteur introuvable !");
  if (!arme) return ui.notifications.warn("Arme introuvable !");
  if (!arme.system.equipee) return ui.notifications.warn(`L'arme "${arme.name}" n'est pas équipée !`);

  const srcToken = actor.getActiveTokens()[0];
  const chatImg = srcToken?.document.texture.src || actor.img;

  const cibleToken = Array.from(game.user.targets)[0];
  const cible = cibleToken ? cibleToken.actor : null;
  if (!cibleToken) return ui.notifications.warn("Aucune cible sélectionnée !");

  return new Promise((resolve) => {
    new Dialog({
      title: "Bonus/Malus d’attaque",
      content: `
        <form>
          <div style="margin-bottom:0.7em;">
            <label for="add2e-bonus-attaque">Bonus ou malus temporaire au jet d'attaque⯯:</label>
            <input id="add2e-bonus-attaque" type="number" value="0" step="1" style="width:4em;margin-left:1em;">
            <span style="color:#888">(ex: -2, 0, +1...)</span>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          label: "Lancer l'attaque",
          callback: async (dlgHtml) => {
            const userBonus = Number(dlgHtml.find("#add2e-bonus-attaque").val()) || 0;
            const categorieArme = arme.system.categorie || "melee";

            // --- Calcul portée et malus ---
            let dist = 0, malusPortee = 0, descPortee = "", typePortee = "Contact";
            const isDistance = (arme.system.portee_courte ?? 0) > 0;

            if (isDistance) {
              const pC = Number(arme.system.portee_courte) || 0;
              const pM = Number(arme.system.portee_moyenne) || 0;
              const pL = Number(arme.system.portee_longue) || 0;

              if (srcToken && cibleToken) {
                try {
                  const d = canvas.grid.measureDistances([{ ray: new Ray(srcToken.center, cibleToken.center) }], { gridSpaces: true })[0];
                  dist = d;
                } catch (e) { dist = 0; }
              }

              if (dist <= pC) { descPortee = "Courte"; typePortee = "Courte"; }
              else if (dist <= pM) { descPortee = "Moyenne"; typePortee = "Moyenne"; malusPortee = -2; }
              else if (dist <= pL) { descPortee = "Longue"; typePortee = "Longue"; malusPortee = -5; }
              else { descPortee = "Hors de portée"; typePortee = "Loin"; }
            } else {
              dist = 1;
              descPortee = "Contact";
              typePortee = "Contact";
            }

            // --- 1. THAC0 ---
            const sys = actor.system || {};
            let thaco = 20;
            if (actor.type === "personnage") {
              let classeItem = actor.items?.find(i => i.type === "classe");
              if (classeItem && Array.isArray(classeItem.system.progression)) {
                const niv = Number(sys.niveau) || 1;
                const prog = classeItem.system.progression[niv - 1];
                if (prog && typeof prog.thac0 !== "undefined") thaco = Number(prog.thac0);
              } else if (typeof sys.thaco !== "undefined") {
                thaco = Number(sys.thaco);
              }
            } else {
              if (sys.thaco && sys.thaco !== 0) thaco = Number(sys.thaco);
              else if (sys.hitDice || sys.dv) thaco = getMonsterThaco(sys.hitDice || sys.dv);
            }

            // --- 2. BONUS ATTAQUE ---
            let bonusHit = Number(arme.system.bonus_hit || 0);
            let bonusDom = Number(arme.system.bonus_dom || 0);
            let modCaracToucher = 0;
            let modCaracDegats = 0;

            const typeArme = arme.system.type || "";
            const bonusForceToucher = arme.system.bonus_force_toucher ?? false;
            const bonusForceDegats = arme.system.bonus_force_degats ?? false;

            if (typeArme === "melee" || typeArme === "Arme de jet" || bonusForceToucher) {
              modCaracToucher = Number(sys.force_bonus_toucher) || 0;
            }
            if (typeArme === "melee" || typeArme === "Arme de jet" || bonusForceDegats) {
              modCaracDegats = Number(sys.force_bonus_degats) || 0;
            }
            if (categorieArme === "projectile_propulse") {
              modCaracToucher += Number(sys.dex_att || 0);
            }

            let bonusToucheEffets = 0;
            let bonusRacialVs = 0;
            if (typeof Add2eEffectsEngine !== "undefined") {
              const typeCible = cible.system.type_monstre || cible.system.race || "";
              bonusRacialVs = Add2eEffectsEngine.getBonusToucheVs(actor, typeCible);
              const typeArmeEffet = getEffetTypeByNom(arme, [
                { patterns: ["épée", "epee"], type: "epee" },
                { patterns: ["arc"], type: "arc" }
              ]);
              bonusToucheEffets = Add2eEffectsEngine.getBonusTouche(actor, typeArmeEffet);
            }

            let totalBonusToucher = modCaracToucher + bonusHit + malusPortee + userBonus + bonusToucheEffets + bonusRacialVs;
            let totalBonusDegats = modCaracDegats + bonusDom;

            // --- 3. CA CIBLE ---
            let sysCible = cible.system || {};
            let nomCible = cible.name;
            let tailleCible = (sysCible.taille || sysCible.size || "M").toUpperCase();

            // A. CA Base (Physique)
            let caBaseCible = 10;
            if (typeof sysCible.ca_naturel !== "undefined") caBaseCible = Number(sysCible.ca_naturel);
            else if (typeof sysCible.armorClass !== "undefined") caBaseCible = Number(sysCible.armorClass);
            else if (typeof sysCible.ca !== "undefined") caBaseCible = Number(sysCible.ca);
            else if (typeof sysCible.ca_total !== "undefined") caBaseCible = Number(sysCible.ca_total);

            // B. CA Finale (Magique)
            let caFinaleCible = 10;
            if (typeof sysCible.ca_total !== "undefined") {
              caFinaleCible = Number(sysCible.ca_total);
            } else {
              caFinaleCible = caBaseCible;
            }

            // C. Recalcul dynamique
            if (typeof Add2eEffectsEngine !== "undefined") {
              const bonusMagiqueGlobal = Add2eEffectsEngine.getCABonus(cible);
              const caTheorique = caBaseCible - bonusMagiqueGlobal;
              if (caTheorique < caFinaleCible) {
                caFinaleCible = caTheorique;
              }

              if (Add2eEffectsEngine.analyze) {
                let sousTypeAttaque = "autres";
                if (categorieArme === "projectile_lance") sousTypeAttaque = "projectile_lance";
                else if (categorieArme === "projectile_propulse") sousTypeAttaque = "projectile_propulse";
                const analyse = Add2eEffectsEngine.analyze(cible, { type: "attaque", sousType: sousTypeAttaque, frontale: true });
                if (analyse?.ca_fixe !== undefined) caFinaleCible = analyse.ca_fixe;
                if (analyse?.bonus_ca) caFinaleCible -= analyse.bonus_ca;
              }
            }

            // --- 4. TYPE D'ARMURE ---
            let typeArmureCible = caBaseCible;
            if (cible.items) {
              const armurePortee = cible.items.find(i =>
                i.type === "armure" && i.system.equipee &&
                !i.name.toLowerCase().includes("bouclier") &&
                !i.name.toLowerCase().includes("heaume") &&
                !i.name.toLowerCase().includes("casque")
              );
              if (armurePortee && typeof armurePortee.system.ac === "number") {
                typeArmureCible = Number(armurePortee.system.ac);
              }
            }
            typeArmureCible = Math.max(2, Math.min(10, Math.round(Number(typeArmureCible))));

            let ajustementCA = 0;
            if (Array.isArray(arme.system.ajustement_ca)) {
              let idx = typeArmureCible - 2;
              if (idx < 0) idx = 0; if (idx > 8) idx = 8;
              if (idx < arme.system.ajustement_ca.length) {
                ajustementCA = Number(arme.system.ajustement_ca[idx]) || 0;
              }
            }

            // --- 5. RESOLUTION ---
            let valeurPourToucher = thaco - caFinaleCible - ajustementCA;

            // ✅ ORDONNANCEMENT: d'abord les dés 3D, ensuite le chat (attaque)
            const roll = await (new Roll("1d20")).evaluate({ async: true });
            if (game.dice3d) await game.dice3d.showForRoll(roll);
            await new Promise(r => setTimeout(r, 300));

            const d20 = roll.total;
            const totalAuToucher = d20 + totalBonusToucher;

            // Logique de touche (20 touche toujours, 1 rate toujours)
            const estTouche = (d20 === 20) || (d20 !== 1 && totalAuToucher >= valeurPourToucher);

            const finalResult = estTouche;

            // Dégâts
            let degats = 0;
            let formulaDegats = "1d6";
            let detailsDegats = "";
            let typeDegats = arme.system.type_degats || "contondant";

            if (finalResult) {
              const isGrand = ["G", "L", "LARGE"].includes(tailleCible);
              let rawDmg = isGrand ? arme.system.dégâts?.contre_grand : arme.system.dégâts?.contre_moyen;
              if (!rawDmg) rawDmg = "1d6";

              formulaDegats = plageToRollFormula(rawDmg);

              if (totalBonusDegats !== 0) {
                formulaDegats += (totalBonusDegats > 0 ? `+${totalBonusDegats}` : `${totalBonusDegats}`);
              }

              const rDmg = await (new Roll(formulaDegats)).evaluate({ async: true });

              // ✅ ORDONNANCEMENT: dés dégâts avant le chat
              if (game.dice3d) await game.dice3d.showForRoll(rDmg);
              await new Promise(r => setTimeout(r, 300));

              degats = Math.max(1, rDmg.total);
              detailsDegats = rDmg.result;

              if (cible) {
                await add2eApplyDamage({ cible, montant: degats, source: arme.name, lanceur: actor, silent: true });
              }
            }

            // --- 6. MESSAGE CHAT ---
            const colorResult = finalResult ? "#2ecc71" : "#e74c3c";
            const textResult = finalResult ? "TOUCHÉ !" : "Raté.";
            const iconResult = finalResult ? "fa-check" : "fa-times";

            let txtAjust = `${ajustementCA >= 0 ? "+" : ""}${ajustementCA}`;
            if (ajustementCA < 0) txtAjust = `<span style="color:#c0392b;">${txtAjust}</span>`;
            else if (ajustementCA > 0) txtAjust = `<span style="color:#18b531;">${txtAjust}</span>`;

            // Affichage du calcul simple (ex: 11 + 5 = 16)
            const signeBonus = totalBonusToucher >= 0 ? "+" : "";
            const calculSimple = `<b>${d20}</b> <span style="color:#888;font-size:0.8em;">(d20)</span> ${signeBonus} ${totalBonusToucher} = <b style="font-size:1.1em;">${totalAuToucher}</b>`;

            let chatContent = `
            <div class="add2e-chat-card" style="font-family:var(--font-primary); background:#fff; border:1px solid #aaa; border-radius:5px; padding:5px;">
               <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                  <div style="text-align:center;">
                     <img src="${actor.img || 'icons/svg/mystery-man.svg'}" style="width:48px;height:48px;border-radius:5px;border:1px solid #333;">
                     <div style="font-weight:bold; font-size:0.9em; margin-top:2px;">${actor.name}</div>
                     <div style="font-size:0.8em; color:#666;">${arme.name}</div>
                  </div>
                  <div style="font-size:2em; color:#aaa;">&rarr;</div>
                  <div style="text-align:center;">
                     <img src="${cible.img || 'icons/svg/mystery-man.svg'}" style="width:48px;height:48px;border-radius:5px;border:1px solid #333;">
                     <div style="font-weight:bold; font-size:0.9em; margin-top:2px;">${nomCible}</div>
                  </div>
               </div>

               <div style="text-align:center; font-size:1em; margin-bottom:10px;">
                  ${actor.name} tente de frapper <b>${nomCible}</b> avec sa <b>${arme.name}</b> !
               </div>

               <div style="text-align:center; color:#666; font-size:0.9em; margin-bottom:5px;">
                  Portée: <b>${descPortee}</b> — ${typePortee}
               </div>

               <div style="background:#f1f5f9; padding:8px; border-radius:5px; text-align:center; margin-bottom:10px; font-size:1.1em;">
                   <i class="fas fa-dice-d20"></i> ${calculSimple}
               </div>

               <div style="text-align:center; margin-bottom:10px;">
                   Seuil à atteindre : <span style="font-weight:bold; color:#d35400;">${valeurPourToucher}</span>
               </div>

               <div style="text-align:center; margin-bottom:10px; font-size:1.4em; font-weight:bold; color:${colorResult};">
                   <i class="fas ${iconResult}"></i> ${textResult}
               </div>

               ${finalResult ? `
               <div style="text-align:center; border-top:1px dashed #ccc; padding-top:5px; margin-bottom:10px;">
                   <span style="font-size:1.2em;">Dégâts : <b>${degats}</b></span>
                   <div style="font-size:0.8em; color:#7f8c8d;">(${formulaDegats} -> ${detailsDegats})</div>
               </div>` : ''}

               <details style="margin-top:5px; font-size:0.8em; color:#666;">
                  <summary>Détails du calcul</summary>
                  <ul>
                     <li><b>THAC0 - CA :</b> <span style="color:blue;">${thaco} - ${caFinaleCible} = ${thaco - caFinaleCible}</span></li>
                     <li><b>Mod. caractéristique :</b> <span style="color:#d35400;">${modCaracToucher >= 0 ? "+" : ""}${modCaracToucher}</span></li>
                     <li><b>Mod. portée :</b> ${malusPortee} (${descPortee})</li>
                     <li><b>Bonus temporaire :</b> <span style="color:#d35400;">${userBonus >= 0 ? "+" : ""}${userBonus}</span></li>
                     <li><b>Mod. armure :</b> <span style="color:#c0392b;">${txtAjust}</span></li>
                     <li><b>Valeur pour toucher finale :</b> <span style="color:green; font-weight:bold;">${valeurPourToucher}</span></li>
                  </ul>
               </details>
            </div>
            `;

            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: chatContent,
              avatar: chatImg
            });

            resolve();
          }
        },
        cancel: { label: "Annuler" }
      },
      default: "ok"
    }).render(true);
  });
}


/**
 * Lancer de sort (Script + Gestion Charges Objet)
 */
async function add2eCastSpell({ actor, sort }) {
  if (!actor || !sort) return;

  let canCast = false;
  let labelCharge = "";
  let spellToUse = sort; // Sort virtuel ou réel

  // 1. GESTION DU COÛT
  
  // CAS A : Pouvoir d'objet (Virtuel)
  if (sort.system.isPower) {
      const weapon = actor.items.get(sort.system.sourceWeaponId);
      if (!weapon) return ui.notifications.error("Objet source introuvable.");

      // --- DETECTION DU TYPE DE CHARGES (GLOBALES vs PAR POUVOIR) ---
      // Si max_charges > 0, on considère une gestion globale (Bâton Cristal)
      // Sinon on considère une gestion par pouvoir (Bâton Magius)
      let maxChargesGlobal = Number(weapon.system.max_charges || 0);
      let isGlobalMode = maxChargesGlobal > 0;

      let current = 0;
      let max = 0;

      if (isGlobalMode) {
          const val = weapon.getFlag("add2e", "global_charges");
          max = maxChargesGlobal;
          current = (val !== undefined && val !== null) ? val : max;
      } else {
          const val = weapon.flags?.add2e?.[`charges_${sort.system.powerIndex}`];
          max = sort.system.max || 1;
          current = (val !== undefined && val !== null) ? val : max;
      }

      if (current < sort.system.cost) {
          return ui.notifications.warn(`L'objet ${weapon.name} n'a plus assez de charges (${current}/${sort.system.cost} req).`);
      }

      const newCharges = current - sort.system.cost;
      
      if (isGlobalMode) {
          await weapon.setFlag("add2e", "global_charges", newCharges);
      } else {
          await weapon.setFlag("add2e", `charges_${sort.system.powerIndex}`, newCharges);
      }
      
      canCast = true;
      labelCharge = `<span style="color:#d35400;">Charges : ${newCharges}/${max}</span>`;

      // Recherche du Vrai Sort
      const baseName = sort.name.replace(/\s\(.*?\)$/, "").trim();
      const realSpell = game.items.find(i => i.type === "sort" && i.name.toLowerCase() === baseName.toLowerCase());
      if (realSpell) spellToUse = realSpell;
  } 
  
  // CAS B : Sort Classique
  else {
      let mem = await sort.getFlag("add2e", "memorizedCount") || 0;
      if (mem <= 0) {
          return ui.notifications.warn(`Le sort "${sort.name}" n'est plus mémorisé !`);
      }
      await sort.setFlag("add2e", "memorizedCount", mem - 1);
      canCast = true;
      labelCharge = `<span style="color:#2980b9;">Reste : ${mem - 1}</span>`;
  }

  if (!canCast) return;

  // =========================================================
  // 2. EXECUTION DU SCRIPT (onUse)
  // =========================================================
  const info = spellToUse.system;
  const scriptPath = info.onUse || info.onuse || info.on_use;
  
  if (scriptPath) {
     try {
        const response = await fetch(scriptPath);
        if (response.ok) {
            const code = await response.text();
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const fn = new AsyncFunction("actor", "item", "sort", code);
            
            // [CORRECTION] : On passe 'sort' (l'origine) en 3ème argument
            // actor = le lanceur
            // item  = le sort complet (pour les effets/description)
            // sort  = l'objet déclencheur (pour les charges/remboursement)
            await fn(actor, spellToUse, sort);
            
            return; 
        }
     } catch(e) {
        console.error(`[ADD2e] Erreur script :`, e);
     }
  }

  // 3. MESSAGE CHAT
  const niveauPerso = Number(actor.system.niveau) || Number(info.niveau) || 1;
  const details = [
    { label: "Portée",   val: formatSortChamp(info.portee, niveauPerso) },
    { label: "Durée",    val: formatSortChamp(info.duree, niveauPerso) },
    { label: "Cible",    val: formatSortChamp(info.cible, niveauPerso) },
    { label: "Incant.",  val: formatSortChamp(info.temps_incantation, niveauPerso) }
  ];

  const htmlMsg = `
    <div class="add2e-spell-card" style="
      border-radius: 12px;
      box-shadow: 0 2px 10px #715aab33;
      background: linear-gradient(100deg, #f8f6fc 90%, #e8def8 100%);
      border: 1.5px solid #9373c7;
      margin: 0.3em 0 0.2em 0;
      max-width: 440px;
      padding: 0.5em 1.3em 0.5em 1em;
      font-family: var(--font-primary);
    ">
      <div style="display: flex; align-items: center; gap: 0.7em;">
        <img src="${spellToUse.img || "icons/svg/book.svg"}" alt="" style="width:46px; height:46px; border-radius:7px; box-shadow:0 1px 4px #0002; object-fit:contain;">
        <span style="font-size:1.18em; font-weight:bold; color:#6841a2;">${spellToUse.name}</span>
        <span style="margin-left:auto; color:#8e44ad; font-size:0.97em; font-weight:600;">Niv. ${info.niveau || "-"}</span>
        <span style="font-size:0.9em; font-weight:bold; margin-left:5px;">${labelCharge}</span>
      </div>
      <table style="margin:0.3em 0 0.3em 0; width:100%; font-size:0.98em;">
        ${details.map(d => `<tr>
          <td style="color:#8571a5; font-weight:600; width:120px;">${d.label}</td>
          <td style="color:#222; font-weight:500;">${d.val || "-"}</td>
        </tr>`).join("")}
      </table>
      <details open style="margin-top:0.2em; background: #eee8fa; border-radius: 6px; border:1px solid #e1d2fb;">
        <summary style="cursor:pointer; color:#6a3c99; font-size:1em; font-weight: 600;">Description</summary>
        <div style="color:#48307a; font-size:0.99em; margin-top:0.3em; margin-bottom:0.2em; padding:0.15em 0.4em 0.25em 0.2em;">
          ${info.description || "<em>Aucune description.</em>"}
        </div>
      </details>
    </div>`;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: htmlMsg
  });
}

// Exports globaux
globalThis.add2eAttackRoll = add2eAttackRoll;
globalThis.add2eCastSpell = add2eCastSpell;