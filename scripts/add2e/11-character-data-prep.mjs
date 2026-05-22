// =======================
//  HOOK UNIQUE updateActor
// =======================
Hooks.on("updateActor", async (actor, changes, options, userId) => {
  // 0. Anti-boucle pour la synchro (tokens / socket)
  if (options?._fromSync) {
    console.log(
      `[SYNC][SKIP] Boucle évitée (flag _fromSync) pour`,
      actor?.name || actor?.id || "???"
    );
    return;
  }

  // 0.1. Anti-spam ABSOLU : si les seuls "changements" sont l'_id, on IGNORE TOUT
  const changeKeys = Object.keys(changes ?? {});
  if (changeKeys.length === 1 && changeKeys[0] === "_id") {
    // Si tu veux vérifier que ça passe bien ici, décommente la ligne suivante :
    // console.debug("[SYNC][SKIP] updateActor ignoré (_id seul) pour", actor?.name || actor?.id || "???");
    return;
  }

  // À partir d'ici, on est sûr que ce n'est PAS un update “vide”
  console.log(
    `[SYNC][HOOK] updateActor déclenché pour :`,
    actor?.name || actor?.id || "???",
    "(ID:", actor?.id || "???", ") | changes :",
    changes
  );

  // =====================================================
  // 0) Garde anti-boucle + gestion PV au changement de niveau
  // =====================================================
  if (options?.add2eInternal) return;

  // Niveau maximum : si la classe possède une progression limitée, on ramène immédiatement au niveau max réel.
  if (changes?.system && Object.prototype.hasOwnProperty.call(changes.system, "niveau")) {
    const clamp = add2eClampLevelToClassMax(actor, changes.system.niveau, null, { notify: true });
    if (clamp.changed) {
      console.warn("[ADD2E][NIVEAU][MAX] Niveau supérieur au maximum de classe : correction automatique", {
        actor: actor?.name,
        niveauDemande: clamp.original,
        niveauMax: clamp.maxLevel,
        niveauApplique: clamp.level
      });
      await actor.update({ "system.niveau": clamp.level }, { add2eInternal: true });
      changes.system.niveau = clamp.level;
    }
  }

  // Au changement de niveau : on recalcule PV max (system.points_de_coup) et on aligne PV courant (system.pdv)
  if (changes?.system && Object.prototype.hasOwnProperty.call(changes.system, "niveau")) {
    const lvl = Number(changes.system.niveau) || Number(actor.system?.niveau) || 1;

    try {
      console.log(`[ADD2E][HP] Changement de niveau détecté -> recalcul PV max + PV courant (niveau=${lvl})`, { actor: actor?.name });

      // Priorité : si la feuille fournit la méthode, on l'utilise (même logique que drop classe)
      if (actor.sheet?.autoSetPointsDeCoup) {
        await actor.sheet.autoSetPointsDeCoup({ syncCurrent: true, force: true, reason: "level-change" });
      } else {
        // Fallback minimal (si la feuille n'est pas instanciée)
        const classeItem = actor.items?.find(i => i.type === "classe");
        const prog = classeItem?.system?.progression;
        const hpMax = Array.isArray(prog) && prog[lvl - 1] && prog[lvl - 1].pdv !== undefined ? Number(prog[lvl - 1].pdv) : NaN;
        if (Number.isFinite(hpMax) && hpMax > 0) {
          await actor.update({ "system.points_de_coup": hpMax, "system.pdv": hpMax }, { add2eInternal: true });
        }
      }
    } catch (e) {
      console.warn("[ADD2E][HP] Erreur recalcul PV au changement de niveau :", e);
    }
    try {
      await add2eSyncMonkUnarmedWeapon(actor);
    } catch (e) {
      console.warn("[ADD2E][MOINE] Erreur synchronisation Main nue au changement de niveau :", e);
    }

    try {
      await add2eSyncNewSpellLevelsAfterActorLevelChange(actor, lvl);
    } catch (e) {
      console.error("[ADD2E][LEVEL_SPELL_SYNC] Erreur import / nettoyage des sorts au changement de niveau :", {
        actor: actor?.name,
        niveau: lvl,
        err: e
      });
      ui.notifications.error("Erreur pendant la synchronisation des sorts au changement de niveau. Voir la console.");
    }
  }



  // =====================================================
  // 1) Auto-save & recalcul des bonus caracs (PATCH anti-bug)
  // =====================================================
  try {
    if (actor.type === "personnage" && changes.system) {
let caracChanged = false;

      // On évite les re-entrées infinies sur le même acteur
      if (caracChanged && !ACTIVE_CARAC_AUTO.has(actor.id)) {
        ACTIVE_CARAC_AUTO.add(actor.id);
        try {
          if (typeof actor.sheet?.autoSetCaracAjustements === "function") {
            await actor.sheet.autoSetCaracAjustements();
          } else if (typeof actor.autoSetCaracAjustements === "function") {
            await actor.autoSetCaracAjustements();
          }
          console.log("[CARAC] autoSetCaracAjustements exécuté pour", actor.name);
          // Forcer le refresh de la fiche si elle est ouverte (sinon les readonly restent visuellement figés)
        if (actor.sheet?.rendered) actor.sheet.render(false);

        } finally {
          ACTIVE_CARAC_AUTO.delete(actor.id);
        }
      }
    }
  } catch (e) {
    console.warn("[CARAC] Erreur auto-set ajustements caracs :", e);
  }

  // =====================================================
  // 2) Gestion auto des états INCONSCIENT / MORT (PV)
  // =====================================================
  try {
    // Seul le MJ actif gère les états
    if (game.user.isGM && game.user.id === game.users.activeGM?.id) {
      const HP_PATHS = ["system.points_de_coup", "system.pdv"];
      let hpPathChanged = null;

      for (const path of HP_PATHS) {
        if (foundry.utils.hasProperty(changes, path)) {
          hpPathChanged = path;
          break;
        }
      }

      if (hpPathChanged) {
        const newHP = Number(foundry.utils.getProperty(actor, hpPathChanged) ?? 0);

        const DEAD_STATUS        = "dead";
        const UNCONSCIOUS_STATUS = "unconscious";

        if (newHP <= -11) {
          // Mort : overlay "dead"
          await actor.toggleStatusEffect(UNCONSCIOUS_STATUS, { active: false, overlay: false });
          await actor.toggleStatusEffect(DEAD_STATUS,        { active: true,  overlay: true  });
          console.log("[HP-STATE] Overlay auto -> MORT pour", actor.name);
        } else if (newHP <= 0) {
          // Inconscient : overlay "unconscious"
          await actor.toggleStatusEffect(DEAD_STATUS,        { active: false, overlay: false });
          await actor.toggleStatusEffect(UNCONSCIOUS_STATUS, { active: true,  overlay: true  });
          console.log("[HP-STATE] Overlay auto -> INCONSCIENT pour", actor.name);
        } else {
          // PV > 0 : on enlève tout
          await actor.toggleStatusEffect(DEAD_STATUS,        { active: false, overlay: false });
          await actor.toggleStatusEffect(UNCONSCIOUS_STATUS, { active: false, overlay: false });
          console.log("[HP-STATE] Nettoyage auto des états HP pour", actor.name);
        }
      }
    }
  } catch (e) {
    console.warn("[HP-STATE] Erreur auto-gestion états HP :", e);
  }

  // =====================================================
  // 3) Synchronisation des tokens liés
  //    → Pour les tokens LIÉS, Foundry synchronise déjà.
  //      On ne refait PAS de actor.update() ici.
  // =====================================================
  try {
    const tokens = actor.getDependentTokens?.({ linked: true }) || [];
    if (!tokens.length) {
      console.log(
        `[SYNC] Aucun token lié trouvé pour`,
        actor?.name || actor?.id || "???",
        "."
      );
      return;
    }

    console.log(
      `[SYNC] Tokens liés détectés pour`,
      actor?.name || actor?.id || "???",
      `(${tokens.length} token(s)). Pas de resync manuelle (Foundry gère déjà).`
    );

    // Surtout NE PAS faire de tokenDoc.actor.update(...) ici.
  } catch (e) {
    console.warn("[SYNC] Erreur lors du traitement des tokens liés :", e);
  }
});

// ===============================
// TABLES AJUSTEMENTS CARACTÉRISTIQUES
// ===============================
const FORCE_TABLE = {
  3:   { toucher: -3, degats: -1, poids: -350, ouvrir: "1", tordre: "0%" },
  4:   { toucher: -2, degats: -1, poids: -250, ouvrir: "1", tordre: "0%" },
  5:   { toucher: -2, degats: -1, poids: -250, ouvrir: "1", tordre: "0%" },
  6:   { toucher: -1, degats: 0,  poids: -150, ouvrir: "1", tordre: "0%" },
  7:   { toucher: -1, degats: 0,  poids: -150, ouvrir: "1", tordre: "0%" },
  8:   { toucher:  0, degats: 0,  poids: 0,    ouvrir: "1-2", tordre: "1%" },
  9:   { toucher:  0, degats: 0,  poids: 0,    ouvrir: "1-2", tordre: "1%" },
  10:  { toucher:  0, degats: 0,  poids: 0,    ouvrir: "1-2", tordre: "2%" },
  11:  { toucher:  0, degats: 0,  poids: 0,    ouvrir: "1-2", tordre: "2%" },
  12:  { toucher:  0, degats: 0,  poids: 100,  ouvrir: "1-2", tordre: "4%" },
  13:  { toucher:  0, degats: 0,  poids: 100,  ouvrir: "1-2", tordre: "4%" },
  14:  { toucher:  0, degats: 0,  poids: 200,  ouvrir: "1-2", tordre: "7%" },
  15:  { toucher:  0, degats: 0,  poids: 200,  ouvrir: "1-2", tordre: "7%" },
  16:  { toucher:  0, degats: 1,  poids: 350,  ouvrir: "1-3", tordre: "10%" },
  17:  { toucher:  1, degats: 1,  poids: 500,  ouvrir: "1-3", tordre: "13%" },
  18:  { toucher:  1, degats: 2,  poids: 750,  ouvrir: "1-3", tordre: "16%" },
  "18/01-50": { toucher: 1, degats: 3, poids: 1000, ouvrir: "1-3", tordre: "20%" },
  "18/51-75": { toucher: 2, degats: 3, poids: 1250, ouvrir: "1-4", tordre: "25%" },
  "18/76-90": { toucher: 2, degats: 4, poids: 1500, ouvrir: "1-4", tordre: "30%" },
  "18/91-99": { toucher: 2, degats: 5, poids: 2000, ouvrir: "1-4 (1)", tordre: "35%" },
  "18/00":    { toucher: 3, degats: 6, poids: 3000, ouvrir: "1-5 (2)", tordre: "40%" }
};
const INTELLIGENCE_TABLE = {3:{langues:0,chance_sort:0,min_sort:0,max_sort:0},4:{langues:0,chance_sort:0,min_sort:0,max_sort:0},5:{langues:0,chance_sort:0,min_sort:0,max_sort:0},6:{langues:0,chance_sort:0,min_sort:0,max_sort:0},7:{langues:0,chance_sort:0,min_sort:0,max_sort:0},8:{langues:1,chance_sort:0,min_sort:0,max_sort:0},9:{langues:1,chance_sort:35,min_sort:4,max_sort:6},10:{langues:2,chance_sort:45,min_sort:5,max_sort:7},11:{langues:2,chance_sort:45,min_sort:5,max_sort:7},12:{langues:3,chance_sort:45,min_sort:5,max_sort:7},13:{langues:3,chance_sort:55,min_sort:6,max_sort:9},14:{langues:4,chance_sort:55,min_sort:6,max_sort:9},15:{langues:4,chance_sort:65,min_sort:7,max_sort:11},16:{langues:5,chance_sort:65,min_sort:7,max_sort:11},17:{langues:6,chance_sort:75,min_sort:8,max_sort:14},18:{langues:7,chance_sort:85,min_sort:9,max_sort:18}}; // eslint-disable-line
const SAGESSE_TABLE = {3:{magie:-3,sort_suppl:0,echec:80},4:{magie:-2,sort_suppl:0,echec:75},5:{magie:-1,sort_suppl:0,echec:70},6:{magie:-1,sort_suppl:0,echec:65},7:{magie:-1,sort_suppl:0,echec:60},8:{magie:0,sort_suppl:0,echec:55},9:{magie:0,sort_suppl:0,echec:20},10:{magie:0,sort_suppl:0,echec:15},11:{magie:0,sort_suppl:0,echec:10},12:{magie:0,sort_suppl:0,echec:5},13:{magie:0,sort_suppl:1,echec:0},14:{magie:0,sort_suppl:2,echec:0},15:{magie:0,sort_suppl:2,echec:0},16:{magie:0,sort_suppl:2,echec:0},17:{magie:0,sort_suppl:3,echec:0},18:{magie:0,sort_suppl:4,echec:0}}; // eslint-disable-line
const DEXTERITE_TABLE = {3:{att:-3,def:+4},4:{att:-2,def:+3},5:{att:-1,def:+2},6:{att:0,def:+1},7:{att:0,def:0},8:{att:0,def:0},9:{att:0,def:0},10:{att:0,def:0},11:{att:0,def:0},12:{att:0,def:0},13:{att:0,def:0},14:{att:0,def:-1},15:{att:0,def:-1},16:{att:+1,def:-2},17:{att:+2,def:-3},18:{att:+3,def:-4}}; // eslint-disable-line
const CONSTITUTION_TABLE = {3:{pv:-2,trauma:35,resu:40},4:{pv:-1,trauma:40,resu:45},5:{pv:-1,trauma:45,resu:50},6:{pv:-1,trauma:50,resu:55},7:{pv:0,trauma:55,resu:60},8:{pv:0,trauma:60,resu:65},9:{pv:0,trauma:65,resu:70},10:{pv:0,trauma:70,resu:75},11:{pv:0,trauma:75,resu:80},12:{pv:0,trauma:80,resu:85},13:{pv:0,trauma:85,resu:90},14:{pv:0,trauma:88,resu:92},15:{pv:+1,trauma:91,resu:94},16:{pv:+2,trauma:95,resu:96},17:{pv:+2,trauma:97,resu:98},18:{pv:+2,trauma:99,resu:100}}; // eslint-disable-line
const CHARISME_TABLE = {3:{compagnons:1,loy:-30,react:-25},4:{compagnons:1,loy:-25,react:-20},5:{compagnons:2,loy:-20,react:-15},6:{compagnons:2,loy:-15,react:-10},7:{compagnons:3,loy:-10,react:-5},8:{compagnons:3,loy:-5,react:0},9:{compagnons:4,loy:0,react:0},10:{compagnons:4,loy:0,react:0},11:{compagnons:4,loy:0,react:0},12:{compagnons:5,loy:0,react:0},13:{compagnons:6,loy:+5,react:5},14:{compagnons:7,loy:+10,react:10},15:{compagnons:8,loy:+15,react:15},16:{compagnons:9,loy:+20,react:25},17:{compagnons:10,loy:+30,react:30},18:{compagnons:15,loy:+40,react:35}}; // eslint-disable-line

async function consommerSortMemorise(actor, nomSort, niveau = 1) {
  // Ex: stockage classique: actor.system.memorized[1]['Sommeil'] = 2
  let chemin = `system.memorized.${niveau}.${nomSort}`;
  let nb = foundry.utils.getProperty(actor, chemin) ?? 0;
  if (nb > 0) {
    await actor.update({ [chemin]: nb - 1 });
    ui.notifications.info(`${nomSort} (niv.${niveau}) consommé pour ${actor.name} (${nb - 1} restants)`);
  } else {
    ui.notifications.warn(`${actor.name} n'a plus de ${nomSort} (niv.${niveau}) mémorisé !`);
  }
}

// Fonction utilitaire à placer une fois dans ton script
async function majImageToken(actor, newImg) {
  // Vérifie si c'est bien un ActorDocument
  if (!actor || typeof actor.update !== "function") return;
  // Patch à la fois token.img et prototypeToken.texture.src (pour compatibilité tous Foundry)
  let maj = {
    img: newImg,
    "token.img": newImg,
    "prototypeToken.texture.src": newImg
  };
  await actor.update(maj);
}

// Convertit une plage de type "2-8" en formule Roll "1d7+1"
function plageToRollFormula(plage) {
  if (typeof plage !== "string") return plage;
  const match = plage.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) return plage;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (isNaN(min) || isNaN(max) || max <= min) return plage;
  const faces = max - min + 1;
  const bonus = min - 1;
  return `1d${faces}` + (bonus > 0 ? `+${bonus}` : "");
}

// ========== FONCTION ROLL HP ==============
function rollHitDice(hdString) {
  if (!hdString) return 0;
  const match = hdString.match(/^(\d+)d(\d+)(?:\s*\+\s*(\d+))?$/i);
  if (!match) return 0;
  const nb = Number(match[1]);
  const faces = Number(match[2]);
  const bonus = Number(match[3] || 0);
  let total = 0;
  for (let i = 0; i < nb; i++) total += Math.floor(Math.random() * faces) + 1;
  total += bonus;
  return total;
}
// =========================================================
// GROS BLOC "READY" UNIQUE (A coller une seule fois)
// =========================================================
Hooks.once("ready", () => {
  console.log("ADD2E | Ready Hook - start");

  // =========================================================
  // [ADD2E][SPELLCASTING] ASSURE actor.system.spellcasting
  // Source STRICTE (JSON) : item "classe" embarqué sur l'acteur
  // -> classItem.system.spellcasting
  // AUCUNE déduction par nom de classe, aucun fallback else.
  // =========================================================
  (async () => {
    try {
      if (!game.user.isGM) {
        console.log("[ADD2E][SPELLCASTING] SKIP (not GM)");
        return;
      }

      console.log("%c[ADD2E][SPELLCASTING] ready assure start", "color:#8e44ad;font-weight:bold;");

      const actors = game.actors?.contents || [];
      console.log("[ADD2E][SPELLCASTING] actors count =", actors.length);

      for (const actor of actors) {
        const current = actor.system?.spellcasting;

        // Log état initial
        console.log("[ADD2E][SPELLCASTING] actor state", {
          id: actor.id,
          name: actor.name,
          currentSpellcasting: current
        });

        // Si déjà présent => on ne touche pas
        if (current !== undefined && current !== null) {
          console.log("[ADD2E][SPELLCASTING] OK (already present)", { id: actor.id, name: actor.name });
          continue;
        }

        // Source stricte : item "classe"
        const classItem = actor.items?.find(i => i.type === "classe") || null;
        const scFromClass = classItem?.system?.spellcasting ?? null;

        console.log("[ADD2E][SPELLCASTING] classItem", classItem ? {
          id: classItem.id,
          name: classItem.name,
          hasSpellcasting: !!scFromClass
        } : null);

        console.log("[ADD2E][SPELLCASTING] scFromClass(raw) =", scFromClass);

        if (!scFromClass || typeof scFromClass !== "object") {
          console.warn("[ADD2E][SPELLCASTING] SKIP (no classItem.system.spellcasting)", {
            actorId: actor.id,
            actorName: actor.name,
            classItem: classItem ? { id: classItem.id, name: classItem.name } : null
          });
          continue;
        }

        if (!Array.isArray(scFromClass.lists) || scFromClass.lists.length === 0) {
          console.warn("[ADD2E][SPELLCASTING] SKIP (invalid spellcasting.lists)", {
            actorId: actor.id,
            actorName: actor.name,
            lists: scFromClass.lists
          });
          continue;
        }

        const patchValue = foundry.utils.duplicate(scFromClass);
        console.log("[ADD2E][SPELLCASTING] PATCH apply", {
          actorId: actor.id,
          actorName: actor.name,
          patchValue
        });

        await actor.update({ "system.spellcasting": patchValue });

        console.log("%c[ADD2E][SPELLCASTING] PATCH OK", "color:#27ae60;font-weight:bold;", {
          actorId: actor.id,
          actorName: actor.name,
          spellcastingNow: actor.system?.spellcasting
        });
      }

      console.log("%c[ADD2E][SPELLCASTING] ready assure end", "color:#8e44ad;font-weight:bold;");
    } catch (e) {
      console.error("[ADD2E][SPELLCASTING] ready assure ERROR:", e);
    }
  })();

  // --- le reste de TON ready hook peut rester inchangé en dessous ---
});

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.FORCE_TABLE = FORCE_TABLE; } catch (_e) {}
try { globalThis.INTELLIGENCE_TABLE = INTELLIGENCE_TABLE; } catch (_e) {}
try { globalThis.SAGESSE_TABLE = SAGESSE_TABLE; } catch (_e) {}
try { globalThis.DEXTERITE_TABLE = DEXTERITE_TABLE; } catch (_e) {}
try { globalThis.CONSTITUTION_TABLE = CONSTITUTION_TABLE; } catch (_e) {}
try { globalThis.CHARISME_TABLE = CHARISME_TABLE; } catch (_e) {}
try { globalThis.consommerSortMemorise = consommerSortMemorise; } catch (_e) {}
try { globalThis.majImageToken = majImageToken; } catch (_e) {}
try { globalThis.plageToRollFormula = plageToRollFormula; } catch (_e) {}
try { globalThis.rollHitDice = rollHitDice; } catch (_e) {}
