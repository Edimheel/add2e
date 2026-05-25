// ===============================
// ENREGISTREMENT SYSTEME
// ===============================
// -----------------------------
// Configuration et fiches (INIT)
// -----------------------------

// -------------------------------------------------
// Boutons de la barre de scène & Combat Tracker (READY)
// -------------------------------------------------


// --- VALIDATION DES FICHES ITEM ADD2E ---
// Si un vieux rendu ou une mauvaise configuration a mis en cache une fiche
// incorrecte pour les items classe, on vide le cache de sheet au lancement.
Hooks.once("ready", () => {
  add2eRegisterClassItemSheet();

  const clearClassSheetCache = (item) => {
    if (!item || item.type !== "classe") return;

    if (item._sheet && !(item._sheet instanceof Add2eItemSheet)) {
      console.warn("[ADD2E][SHEETS] Cache de fiche classe incorrect vidé", {
        item: item.name,
        cachedSheet: item._sheet?.constructor?.name,
        expected: Add2eItemSheet?.name
      });
      item._sheet = null;
    }
  };

  for (const item of game.items ?? []) clearClassSheetCache(item);

  for (const actor of game.actors ?? []) {
    for (const item of actor.items ?? []) clearClassSheetCache(item);
  }

  console.log("[ADD2E][SHEETS] Contrôle Item.classe", {
    importedClassSheet: Add2eItemSheet?.name,
    exampleWorldClassSheet: game.items.find(i => i.type === "classe")?.sheet?.constructor?.name ?? null,
    exampleEmbeddedClassSheet: game.actors.find(a => a.items?.some(i => i.type === "classe"))?.items?.find(i => i.type === "classe")?.sheet?.constructor?.name ?? null
  });
});

// --- SOCKET dégâts/états ADD2E + hook MJ --- 

Hooks.on("preCreateItem", (itemData, options, userId) => {
  if (itemData.type === "sort" && Array.isArray(itemData.effects)) {
    for (let eff of itemData.effects) {
      eff.transfer = false;
      eff.disabled = true;
    }
  }
});

async function rollInitiativeD6(combatants) {
    if (!combatants.length) return;
    for (const comb of combatants) {
        const roll = await new Roll("1d6").evaluate({async:true});
        // Mise à jour Acteur ET Combattant
        if (comb.actor) await comb.actor.update({ "system.initiative": roll.total });
        await comb.update({ initiative: roll.total });
        
        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: comb.actor }),
            content: `Initiative : <b>${roll.total}</b> (1d6)`,
            flavor: "Initiative"
        });
    }
}
// =========================================================
// NETTOYAGE AUTOMATIQUE (Suppression d'objet)
// =========================================================

/**
 * Déclenché quand un objet est supprimé.
 * Supprime les Effets Actifs (Bonus CA, etc.) qui proviennent de cet objet.
 */
Hooks.on("deleteItem", async (item, options, userId) => {
  // 1. Sécurité : On agit seulement si c'est l'utilisateur courant qui a fait l'action
  if (game.user.id !== userId) return;
  
  // 2. Vérifie que l'item appartient bien à un acteur
  if (!item.parent || item.parent.documentName !== "Actor") return;

  const actor = item.parent;

  // 3. Recherche des effets liés à cet objet.
  // Pour les classes, on supprime aussi les anciens effets générés sans origin fiable.
  const effectsToDelete = actor.effects
    .filter(e => item.type === "classe" ? add2eShouldDeleteEffectForClassPurge(e, [item]) : e.origin === item.uuid)
    .map(e => e.id);

  // 4. Suppression
  if (effectsToDelete.length > 0) {
    console.log(`[ADD2e] Suppression des effets liés à l'objet supprimé : ${item.name}`);
    await actor.deleteEmbeddedDocuments("ActiveEffect", effectsToDelete);
    
    // Petit feedback visuel
    ui.notifications.info(`Les effets de ${item.name} se sont dissipés.`);
  }
  
});
// =========================================================
// ADD2E — RELAIS MJ GÉNÉRIQUE POUR LES SCRIPTS DE SORTS
// Ne contient aucune logique spécifique à un sort.
// =========================================================
Hooks.once("ready", () => {
  if (globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED) return;
  globalThis.ADD2E_GM_OPERATION_RELAY_REGISTERED = true;

  console.log("%c[ADD2E][GM-RELAY] Relais MJ générique chargé", "color:#27ae60;font-weight:bold;");

  function isResponsibleGM() {
    if (!game.user.isGM) return false;
    if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
    return game.users.activeGM?.id === game.user.id;
  }

  function resolveScene(sceneId) {
    return game.scenes.get(sceneId) || canvas.scene || game.scenes.active || null;
  }

  async function resolveActor(payload) {
    if (payload.actorUuid) {
      try {
        const doc = await fromUuid(payload.actorUuid);
        if (doc) return doc;
      } catch (e) {
        console.warn("[ADD2E][GM-RELAY] actorUuid non résolu :", payload.actorUuid, e);
      }
    }

    if (payload.sceneId && payload.tokenId) {
      const scene = resolveScene(payload.sceneId);
      const tokenDoc = scene?.tokens?.get(payload.tokenId);
      if (tokenDoc?.actor) return tokenDoc.actor;
    }

    if (payload.actorId) {
      return game.actors.get(payload.actorId) ?? null;
    }

    return null;
  }

  function add2eRelayArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.flatMap(add2eRelayArray).filter(Boolean);
    if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
    return [value];
  }

  function add2eRelayNormalize(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/[\s\-]+/g, "_")
      .replace(/_+/g, "_");
  }

  function readHpMax(actorDoc) {
    const sys = actorDoc?.system ?? {};
    return Number(sys.points_de_coup)
      || Number(sys.pv_max)
      || Number(sys.points_de_vie)
      || Number(sys.hp?.max)
      || Number(sys.attributes?.hp?.max)
      || 0;
  }

  function readHpCurrent(actorDoc, max = 0) {
    const sys = actorDoc?.system ?? {};
    for (const raw of [sys.pdv, sys.pv, sys.hp?.value, sys.attributes?.hp?.value]) {
      if (raw === undefined || raw === null || raw === "") continue;
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
    return Number(max) || 0;
  }

  async function applyDamage(payload) {
    const targetActor = await resolveActor(payload);
    if (!targetActor) {
      console.warn("[ADD2E][GM-RELAY][applyDamage] acteur introuvable :", payload);
      return;
    }

    const amount = Math.abs(Number(payload.montant) || 0);
    if (!amount) return;
    const isHeal = String(payload.type ?? "").toLowerCase().includes("soin") || Number(payload.montant) < 0;
    const max = readHpMax(targetActor);
    const current = readHpCurrent(targetActor, max);
    const next = isHeal ? Math.min(max || current + amount, current + amount) : current - amount;

    console.log("[ADD2E][GM-RELAY][applyDamage] update :", {
      actor: targetActor.name,
      type: payload.type,
      montant: payload.montant,
      current,
      max,
      next,
      details: payload.details
    });

    await targetActor.update({ "system.pdv": next }, { add2eReason: "gm-relay-apply-damage", add2eDetails: payload.details });
  }

  async function deleteActiveEffects(payload) {
    const targetActor = await resolveActor(payload);
    if (!targetActor) {
      console.warn("[ADD2E][GM-RELAY][deleteActiveEffects] acteur introuvable :", payload);
      return;
    }

    const ids = new Set(add2eRelayArray(payload.effectIds).filter(Boolean));
    const tagNorms = add2eRelayArray(payload.tags).map(add2eRelayNormalize);
    const nameNorms = add2eRelayArray(payload.names).map(add2eRelayNormalize);

    if (tagNorms.length || nameNorms.length) {
      for (const effect of targetActor.effects ?? []) {
        const tags = add2eRelayArray(effect.flags?.add2e?.tags ?? effect.getFlag?.("add2e", "tags") ?? []).map(add2eRelayNormalize);
        const name = add2eRelayNormalize(effect.name);
        if (tagNorms.some(t => tags.includes(t)) || nameNorms.some(n => name.includes(n))) ids.add(effect.id);
      }
    }

    const finalIds = [...ids].filter(Boolean);
    if (!finalIds.length) return;

    console.log("[ADD2E][GM-RELAY][deleteActiveEffects] suppression :", {
      actor: targetActor.name,
      ids: finalIds,
      tags: payload.tags,
      names: payload.names
    });

    await targetActor.deleteEmbeddedDocuments("ActiveEffect", finalIds);
  }

  function findAmbientLight(scene, payload) {
    if (!scene) return null;

    if (payload.lightId) {
      const byId = scene.lights.get(payload.lightId);
      if (byId) return byId;
    }

    if (payload.requestId) {
      const byRequest = scene.lights.find(l =>
        l.flags?.add2e?.requestId === payload.requestId ||
        l.getFlag?.("add2e", "requestId") === payload.requestId
      );

      if (byRequest) return byRequest;
    }

    if (
      Number.isFinite(Number(payload.x)) &&
      Number.isFinite(Number(payload.y))
    ) {
      const px = Number(payload.x);
      const py = Number(payload.y);

      return scene.lights.find(l => {
        const lx = Number(l.x);
        const ly = Number(l.y);

        const samePos =
          Number.isFinite(lx) &&
          Number.isFinite(ly) &&
          Math.abs(lx - px) < 4 &&
          Math.abs(ly - py) < 4;

        const sameSpell =
          !payload.spellName ||
          l.flags?.add2e?.spellName === payload.spellName ||
          l.getFlag?.("add2e", "spellName") === payload.spellName;

        const sameActor =
          !payload.actorId ||
          l.flags?.add2e?.actorId === payload.actorId ||
          l.flags?.add2e?.actorUuid === payload.actorUuid ||
          l.getFlag?.("add2e", "actorId") === payload.actorId ||
          l.getFlag?.("add2e", "actorUuid") === payload.actorUuid;

        return samePos && sameSpell && sameActor;
      }) ?? null;
    }

    return null;
  }

  function add2eTemplateRequestFromEffect(effect) {
    return effect?.flags?.add2e?.templateRequestId
      ?? effect?.flags?.add2e?.spell?.templateRequestId
      ?? effect?.getFlag?.("add2e", "templateRequestId")
      ?? effect?.getFlag?.("add2e", "spell")?.templateRequestId
      ?? null;
  }

  function add2eTemplateSceneFromEffect(effect) {
    return effect?.flags?.add2e?.templateSceneId
      ?? effect?.flags?.add2e?.spell?.templateSceneId
      ?? effect?.getFlag?.("add2e", "templateSceneId")
      ?? effect?.getFlag?.("add2e", "spell")?.templateSceneId
      ?? canvas?.scene?.id
      ?? null;
  }

  function add2eEffectIsAmitie(effect) {
    const spellSlug = effect?.flags?.add2e?.spell?.slug ?? effect?.getFlag?.("add2e", "spell")?.slug ?? null;
    const tags = add2eRelayArray(effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? []).map(add2eRelayNormalize);
    return spellSlug === "amitie" || tags.includes("sort_amitie") || tags.includes("sort:amitie") || add2eRelayNormalize(effect?.name).includes("amitie");
  }

  function add2eEffectIsExpired(effect) {
    if (!effect || effect.disabled) return true;
    if (effect.isExpired === true) return true;

    const duration = effect.duration ?? {};
    if (Number.isFinite(Number(duration.remaining)) && Number(duration.remaining) <= 0) return true;

    const rounds = Number(duration.rounds ?? 0);
    const startRound = Number(duration.startRound ?? 0);
    const currentRound = Number(game.combat?.round ?? 0);
    if (rounds > 0 && startRound > 0 && currentRound > 0 && currentRound - startRound >= rounds) return true;

    const seconds = Number(duration.seconds ?? 0);
    const startTime = Number(duration.startTime ?? 0);
    const worldTime = Number(game.time?.worldTime ?? 0);
    if (seconds > 0 && startTime > 0 && worldTime > 0 && worldTime - startTime >= seconds) return true;

    return false;
  }

  function add2eHasLivingAmitieEffect(templateRequestId) {
    if (!templateRequestId) return false;
    for (const actor of game.actors ?? []) {
      for (const effect of actor.effects ?? []) {
        if (!add2eEffectIsAmitie(effect)) continue;
        if (add2eTemplateRequestFromEffect(effect) !== templateRequestId) continue;
        if (!add2eEffectIsExpired(effect)) return true;
      }
    }
    return false;
  }

  function findMeasuredTemplates(scene, payload) {
    if (!scene) return [];
    const requestId = payload.templateRequestId ?? payload.requestId ?? null;
    const templateId = payload.templateId ?? null;
    const spell = payload.spell ?? null;

    return Array.from(scene.templates ?? [])
      .filter(t => {
        if (templateId && t.id === templateId) return true;
        if (requestId && (t.flags?.add2e?.templateRequestId === requestId || t.getFlag?.("add2e", "templateRequestId") === requestId)) return true;
        if (spell && t.flags?.add2e?.spell === spell && requestId && t.flags?.add2e?.templateRequestId === requestId) return true;
        return false;
      });
  }

  async function createMeasuredTemplate(payload) {
    const scene = resolveScene(payload.sceneId);
    if (!scene) {
      console.warn("[ADD2E][GM-RELAY][createMeasuredTemplate] scène introuvable :", payload);
      return;
    }

    const templateData = foundry.utils.deepClone(payload.templateData ?? {});
    const requestId = payload.templateRequestId ?? templateData.flags?.add2e?.templateRequestId ?? null;
    if (requestId && findMeasuredTemplates(scene, { templateRequestId: requestId }).length) return;

    templateData.flags ??= {};
    templateData.flags.add2e ??= {};
    if (requestId) templateData.flags.add2e.templateRequestId = requestId;
    if (payload.spell) templateData.flags.add2e.spell = payload.spell;
    if (payload.spellName) templateData.flags.add2e.spellName = payload.spellName;

    const created = await scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
    console.log("[ADD2E][GM-RELAY][createMeasuredTemplate] créée :", {
      scene: scene.name,
      templateId: created?.[0]?.id ?? null,
      templateRequestId: requestId,
      spell: payload.spell
    });
  }

  async function deleteMeasuredTemplates(payload) {
    const scene = resolveScene(payload.sceneId);
    if (!scene) {
      console.warn("[ADD2E][GM-RELAY][deleteMeasuredTemplates] scène introuvable :", payload);
      return;
    }

    const ids = findMeasuredTemplates(scene, payload).map(t => t.id).filter(Boolean);
    if (!ids.length) return;

    console.log("[ADD2E][GM-RELAY][deleteMeasuredTemplates] suppression :", {
      scene: scene.name,
      ids,
      templateRequestId: payload.templateRequestId,
      reason: payload.reason
    });

    await scene.deleteEmbeddedDocuments("MeasuredTemplate", ids);
  }

  async function cleanupAmitieTemplate(payload) {
    if (!isResponsibleGM()) return;
    const requestId = payload?.templateRequestId ?? null;
    if (!requestId) return;
    if (add2eHasLivingAmitieEffect(requestId)) return;
    await deleteMeasuredTemplates(payload);
  }

  async function cleanupExpiredAmitieTemplates() {
    if (!isResponsibleGM()) return;

    const scenes = new Set([canvas?.scene, game.scenes?.active].filter(Boolean));
    for (const scene of scenes) {
      for (const template of Array.from(scene.templates ?? [])) {
        const flags = template.flags?.add2e ?? {};
        if (flags.spell !== "amitie" || !flags.templateRequestId) continue;
        await cleanupAmitieTemplate({
          sceneId: scene.id,
          templateId: template.id,
          templateRequestId: flags.templateRequestId,
          spell: "amitie",
          reason: "expired-effect-check"
        });
      }
    }
  }

  Hooks.on("deleteActiveEffect", (effect) => {
    if (!isResponsibleGM()) return;
    if (!add2eEffectIsAmitie(effect)) return;

    const templateRequestId = add2eTemplateRequestFromEffect(effect);
    const sceneId = add2eTemplateSceneFromEffect(effect);
    if (!templateRequestId) return;

    setTimeout(() => cleanupAmitieTemplate({
      sceneId,
      templateRequestId,
      spell: "amitie",
      reason: "delete-active-effect"
    }), 100);
  });

  Hooks.on("updateActiveEffect", (effect) => {
    if (!isResponsibleGM()) return;
    if (!add2eEffectIsAmitie(effect)) return;
    if (!add2eEffectIsExpired(effect)) return;

    const templateRequestId = add2eTemplateRequestFromEffect(effect);
    const sceneId = add2eTemplateSceneFromEffect(effect);
    if (!templateRequestId) return;

    setTimeout(() => cleanupAmitieTemplate({
      sceneId,
      templateRequestId,
      spell: "amitie",
      reason: "update-active-effect-expired"
    }), 100);
  });

  Hooks.on("updateCombat", () => {
    setTimeout(() => cleanupExpiredAmitieTemplates(), 150);
  });

  Hooks.on("updateWorldTime", () => {
    setTimeout(() => cleanupExpiredAmitieTemplates(), 150);
  });

  game.socket.on("system.add2e", async data => {
    console.log("[ADD2E SOCKET][RECU]", {
      user: game.user.name,
      isGM: game.user.isGM,
      data
    });

    // Compatibilité legacy : ancien protocole direct applyActiveEffect.
    if (data.type === "applyActiveEffect") {
      if (!game.user.isGM) return;
      const targetActor = await resolveActor(data);
      if (!targetActor) {
        console.warn("[ADD2E SOCKET][applyActiveEffect] ACTEUR CIBLE INTROUVABLE", data);
        return;
      }
      const effectData = foundry.utils.deepClone(data.effectData || {});
      if (!effectData.name && effectData.label) effectData.name = effectData.label;
      if (!effectData.label && effectData.name) effectData.label = effectData.name;
      effectData.flags ??= {};
      effectData.flags.add2e ??= {};
      effectData.flags.add2e.appliedBySocket = true;
      effectData.flags.add2e.appliedByGM = game.user.id;
      effectData.flags.add2e.appliedAt = Date.now();
      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return;
    }

    if (!data || data.type !== "ADD2E_GM_OPERATION") return;
    if (!isResponsibleGM()) return;

    const operation = data.operation;
    const payload = data.payload ?? {};

    console.log("[ADD2E][GM-RELAY] opération reçue :", { operation, payload });

    if (operation === "applyDamage") {
      await applyDamage(payload);
      return;
    }

    if (operation === "deleteActiveEffects") {
      await deleteActiveEffects(payload);
      return;
    }

    if (operation === "createMeasuredTemplate") {
      await createMeasuredTemplate(payload);
      return;
    }

    if (operation === "deleteMeasuredTemplates") {
      await cleanupAmitieTemplate(payload);
      return;
    }

    // -----------------------------------------------------
    // Créer une lumière ambiante
    // -----------------------------------------------------
    if (operation === "createAmbientLight") {
      const scene = resolveScene(payload.sceneId);

      if (!scene) {
        console.warn("[ADD2E][GM-RELAY][createAmbientLight] scène introuvable :", payload);
        return;
      }

      const lightData = {
        x: Number(payload.x ?? 0),
        y: Number(payload.y ?? 0),
        rotation: Number(payload.rotation ?? 0),
        walls: payload.walls !== false,
        vision: payload.vision === true,
        config: {
          dim: Number(payload.dim ?? 6),
          bright: Number(payload.bright ?? 3),
          angle: Number(payload.angle ?? 360),
          color: payload.color ?? "#fffec4",
          alpha: Number(payload.alpha ?? 0.5),
          coloration: Number(payload.coloration ?? 1),
          luminosity: Number(payload.luminosity ?? 0.5),
          attenuation: Number(payload.attenuation ?? 0.5),
          animation: payload.animation ?? {
            type: "torch",
            speed: 2,
            intensity: 2,
            reverse: false
          }
        },
        flags: {
          add2e: foundry.utils.duplicate(payload.flags?.add2e ?? {})
        }
      };

      const created = await scene.createEmbeddedDocuments("AmbientLight", [lightData]);
      const lightDoc = created?.[0];

      console.log("[ADD2E][GM-RELAY][createAmbientLight] créée :", {
        scene: scene.name,
        lightId: lightDoc?.id,
        requestId: payload.flags?.add2e?.requestId
      });

      return;
    }

    // -----------------------------------------------------
    // Supprimer une lumière ambiante
    // -----------------------------------------------------
    if (operation === "deleteAmbientLight") {
      const scene = resolveScene(payload.sceneId);

      if (!scene) {
        console.warn("[ADD2E][GM-RELAY][deleteAmbientLight] scène introuvable :", payload);
        return;
      }

      const lightDoc = findAmbientLight(scene, payload);

      if (!lightDoc) {
        console.warn("[ADD2E][GM-RELAY][deleteAmbientLight] lumière introuvable :", payload);
        return;
      }

      console.log("[ADD2E][GM-RELAY][deleteAmbientLight] suppression :", {
        scene: scene.name,
        lightId: lightDoc.id
      });

      await lightDoc.delete();
      return;
    }

    // -----------------------------------------------------
    // Mettre à jour un token
    // -----------------------------------------------------
    if (operation === "updateToken") {
      const scene = resolveScene(payload.sceneId);
      const tokenDoc = scene?.tokens?.get(payload.tokenId);

      if (!scene || !tokenDoc) {
        console.warn("[ADD2E][GM-RELAY][updateToken] scène/token introuvable :", payload);
        return;
      }

      console.log("[ADD2E][GM-RELAY][updateToken] update :", {
        scene: scene.name,
        token: tokenDoc.name,
        updateData: payload.updateData
      });

      await tokenDoc.update(payload.updateData ?? {});
      return;
    }

    // -----------------------------------------------------
    // Créer un ActiveEffect
    // -----------------------------------------------------
    if (operation === "createActiveEffect") {
      const targetActor = await resolveActor(payload);

      if (!targetActor) {
        console.warn("[ADD2E][GM-RELAY][createActiveEffect] acteur introuvable :", payload);
        return;
      }

      const effectData = foundry.utils.duplicate(payload.effectData ?? {});
      delete effectData._id;

      console.log("[ADD2E][GM-RELAY][createActiveEffect] création :", {
        actor: targetActor.name,
        actorUuid: targetActor.uuid,
        effectData
      });

      await targetActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      return;
    }

    console.warn("[ADD2E][GM-RELAY] opération inconnue :", operation, payload);
  });
});

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.rollInitiativeD6 = rollInitiativeD6; } catch (_e) {}

// =========================================================
// ADD2E — Amitié : contrôleur lanceur et retour outil Token
// Intégré ici pour éviter tout nouveau fichier de script.
// =========================================================
Hooks.once("ready", () => {
  if (globalThis.ADD2E_AMITIE_TEMPLATE_CONTROLLER_REGISTERED) return;
  globalThis.ADD2E_AMITIE_TEMPLATE_CONTROLLER_REGISTERED = true;

  const TAG = "[ADD2E][AMITIE][CONTROLLER]";
  const SPELL = "amitie";
  const FALLBACK_IMG = "icons/magic/control/hypnosis-mesmerism-eye.webp";
  const pendingControllers = new Set();
  const cleaningRequests = new Set();

  function isResponsibleGM() {
    if (!game.user?.isGM) return false;
    if (typeof game.user.isActiveGM === "boolean") return game.user.isActiveGM;
    return game.users?.activeGM?.id === game.user.id;
  }

  function arr(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.flatMap(arr).filter(Boolean);
    if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
    return [value];
  }

  function norm(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9:]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function clone(value) {
    if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
    if (foundry?.utils?.duplicate) return foundry.utils.duplicate(value);
    return JSON.parse(JSON.stringify(value));
  }

  function sceneFromId(sceneId) {
    return game.scenes?.get?.(sceneId) || canvas?.scene || game.scenes?.active || null;
  }

  function spellData(effect) {
    return effect?.flags?.add2e?.spell ?? effect?.getFlag?.("add2e", "spell") ?? {};
  }

  function tags(effect) {
    return arr(effect?.flags?.add2e?.tags ?? effect?.getFlag?.("add2e", "tags") ?? []);
  }

  function isAmitie(effect) {
    if (!effect) return false;
    const spell = spellData(effect);
    const effectTags = tags(effect).map(norm);
    return spell?.slug === SPELL
      || effectTags.includes("sort:amitie")
      || effectTags.includes("sort_amitie")
      || norm(effect.name).includes("amitie");
  }

  function isController(effect) {
    if (!effect) return false;
    const flags = effect.flags?.add2e ?? {};
    const spell = spellData(effect);
    const effectTags = tags(effect).map(norm);
    return flags.role === "controller"
      || flags.amitieController === true
      || spell?.role === "controller"
      || effectTags.includes("role:controleur")
      || effectTags.includes("role_controller");
  }

  function requestId(doc) {
    return doc?.flags?.add2e?.templateRequestId
      ?? doc?.flags?.add2e?.spell?.templateRequestId
      ?? doc?.getFlag?.("add2e", "templateRequestId")
      ?? doc?.getFlag?.("add2e", "spell")?.templateRequestId
      ?? null;
  }

  function sceneIdFrom(doc) {
    return doc?.flags?.add2e?.templateSceneId
      ?? doc?.flags?.add2e?.spell?.templateSceneId
      ?? doc?.getFlag?.("add2e", "templateSceneId")
      ?? doc?.getFlag?.("add2e", "spell")?.templateSceneId
      ?? canvas?.scene?.id
      ?? null;
  }

  function templateIdFrom(effect) {
    return effect?.flags?.add2e?.templateId
      ?? effect?.flags?.add2e?.spell?.templateId
      ?? effect?.getFlag?.("add2e", "templateId")
      ?? effect?.getFlag?.("add2e", "spell")?.templateId
      ?? null;
  }

  function isExpired(effect) {
    if (!effect || effect.disabled) return true;
    if (effect.isExpired === true) return true;
    const duration = effect.duration ?? {};
    if (Number.isFinite(Number(duration.remaining)) && Number(duration.remaining) <= 0) return true;

    const rounds = Number(duration.rounds ?? 0);
    const startRound = Number(duration.startRound ?? 0);
    const currentRound = Number(game.combat?.round ?? 0);
    if (rounds > 0 && startRound > 0 && currentRound > 0 && currentRound - startRound >= rounds) return true;

    const seconds = Number(duration.seconds ?? 0);
    const startTime = Number(duration.startTime ?? 0);
    const worldTime = Number(game.time?.worldTime ?? 0);
    if (seconds > 0 && startTime > 0 && worldTime > 0 && worldTime - startTime >= seconds) return true;

    return false;
  }

  function effectsByRequest(templateRequestId) {
    if (!templateRequestId) return [];
    const found = [];
    for (const actor of game.actors ?? []) {
      for (const effect of actor.effects ?? []) {
        if (!isAmitie(effect)) continue;
        if (requestId(effect) !== templateRequestId) continue;
        found.push(effect);
      }
    }
    return found;
  }

  function hasLivingEffect(templateRequestId) {
    return effectsByRequest(templateRequestId).some(effect => !isExpired(effect));
  }

  function hasLivingTargetEffect(templateRequestId) {
    return effectsByRequest(templateRequestId).some(effect => !isController(effect) && !isExpired(effect));
  }

  function hasController(templateRequestId) {
    return effectsByRequest(templateRequestId).some(isController);
  }

  function hasLivingController(templateRequestId) {
    return effectsByRequest(templateRequestId).some(effect => isController(effect) && !isExpired(effect));
  }

  function templates(scene, payload = {}) {
    if (!scene) return [];
    const id = payload.templateId ?? null;
    const rid = payload.templateRequestId ?? payload.requestId ?? null;
    return Array.from(scene.templates ?? [])
      .filter(t => {
        const flags = t.flags?.add2e ?? {};
        if (id && t.id === id) return true;
        if (rid && flags.templateRequestId === rid) return true;
        return false;
      });
  }

  async function deleteTemplates({ sceneId, templateId = null, templateRequestId = null, reason = "cleanup" } = {}) {
    const scene = sceneFromId(sceneId);
    if (!scene?.deleteEmbeddedDocuments) return false;
    const ids = templates(scene, { templateId, templateRequestId }).map(t => t.id).filter(Boolean);
    if (!ids.length) return false;
    console.log(`${TAG}[DELETE_TEMPLATES]`, { scene: scene.name, ids, templateRequestId, reason });
    await scene.deleteEmbeddedDocuments("MeasuredTemplate", ids);
    return true;
  }

  async function deleteEffects(templateRequestId, reason = "cleanup") {
    if (!templateRequestId) return false;
    const byActor = new Map();
    for (const effect of effectsByRequest(templateRequestId)) {
      const actor = effect.parent;
      if (!actor?.deleteEmbeddedDocuments) continue;
      if (!byActor.has(actor)) byActor.set(actor, []);
      byActor.get(actor).push(effect.id);
    }

    let done = false;
    for (const [actor, ids] of byActor.entries()) {
      const finalIds = ids.filter(Boolean);
      if (!finalIds.length) continue;
      console.log(`${TAG}[DELETE_EFFECTS]`, { actor: actor.name, ids: finalIds, templateRequestId, reason });
      await actor.deleteEmbeddedDocuments("ActiveEffect", finalIds);
      done = true;
    }
    return done;
  }

  async function cleanupWholeRequest(templateRequestId, sceneId, templateId = null, reason = "cleanup") {
    if (!templateRequestId) return;
    if (cleaningRequests.has(templateRequestId)) return;
    cleaningRequests.add(templateRequestId);
    try {
      await deleteEffects(templateRequestId, reason);
      await deleteTemplates({ sceneId, templateId, templateRequestId, reason });
    } finally {
      setTimeout(() => cleaningRequests.delete(templateRequestId), 250);
    }
  }

  async function cleanupIfNoLivingTarget(templateRequestId, sceneId, templateId = null, reason = "cleanup") {
    if (!templateRequestId) return;
    if (hasLivingTargetEffect(templateRequestId)) return;
    await cleanupWholeRequest(templateRequestId, sceneId, templateId, reason);
  }

  async function casterFromEffect(effect) {
    const spell = spellData(effect);
    const casterUuid = spell?.casterUuid ?? effect?.flags?.add2e?.casterUuid ?? null;
    const casterId = spell?.casterId ?? effect?.flags?.add2e?.casterId ?? null;

    if (casterUuid) {
      try {
        const doc = await fromUuid(casterUuid);
        if (doc) return doc;
      } catch (err) {
        console.warn(`${TAG}[CASTER_UUID_FAIL]`, casterUuid, err);
      }
    }

    if (casterId) return game.actors?.get?.(casterId) ?? null;
    return null;
  }

  function buildControllerEffect(sourceEffect, casterActor) {
    const spell = spellData(sourceEffect);
    const rid = requestId(sourceEffect);
    const tid = templateIdFrom(sourceEffect);
    const sid = sceneIdFrom(sourceEffect);
    const duration = clone(sourceEffect.duration ?? {});
    delete duration.remaining;

    return {
      name: "Amitié — enchantement actif",
      img: sourceEffect.img || FALLBACK_IMG,
      disabled: false,
      transfer: false,
      type: "base",
      system: {},
      changes: [],
      duration,
      description: "Amitié maintient une zone d'enchantement social autour du magicien.",
      flags: {
        add2e: {
          role: "controller",
          amitieController: true,
          templateRequestId: rid,
          templateId: tid,
          templateSceneId: sid,
          tags: [
            "classe:magicien",
            "liste:magicien",
            "niveau:1",
            "sort:amitie",
            "role:controleur",
            "type:charme",
            "type:social",
            "duree:1_round_par_niveau",
            `template_request:${rid ?? ""}`
          ],
          spell: {
            ...spell,
            slug: SPELL,
            name: "Amitié",
            role: "controller",
            casterId: casterActor?.id ?? spell?.casterId ?? null,
            casterUuid: casterActor?.uuid ?? spell?.casterUuid ?? null,
            casterName: casterActor?.name ?? spell?.casterName ?? "",
            templateRequestId: rid,
            templateId: tid,
            templateSceneId: sid
          }
        }
      }
    };
  }

  async function ensureCasterController(sourceEffect) {
    if (!isResponsibleGM()) return;
    if (!isAmitie(sourceEffect)) return;
    if (isController(sourceEffect)) return;
    const rid = requestId(sourceEffect);
    if (!rid) return;
    if (hasController(rid)) return;
    if (pendingControllers.has(rid)) return;
    pendingControllers.add(rid);

    try {
      const casterActor = await casterFromEffect(sourceEffect);
      if (!casterActor?.createEmbeddedDocuments) return;
      if (hasController(rid)) return;
      const effectData = buildControllerEffect(sourceEffect, casterActor);
      console.log(`${TAG}[CREATE_CONTROLLER]`, { caster: casterActor.name, templateRequestId: rid });
      await casterActor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    } finally {
      pendingControllers.delete(rid);
    }
  }

  function returnToTokenControls() {
    try { canvas?.tokens?.activate?.(); } catch (_err) {}
    try { ui?.controls?.initialize?.({ control: "token", tool: "select" }); } catch (_err) {}
    try { ui?.controls?.activateControl?.("token"); ui?.controls?.activateTool?.("select"); } catch (_err) {}
    try { ui?.controls?.render?.(true); } catch (_err) {}
  }

  async function scanTemplates() {
    if (!isResponsibleGM()) return;
    const scenes = new Set([canvas?.scene, game.scenes?.active].filter(Boolean));
    for (const scene of scenes) {
      for (const template of Array.from(scene.templates ?? [])) {
        const flags = template.flags?.add2e ?? {};
        if (flags.spell !== SPELL || !flags.templateRequestId) continue;
        const rid = flags.templateRequestId;

        if (!hasLivingEffect(rid)) {
          await deleteTemplates({ sceneId: scene.id, templateId: template.id, templateRequestId: rid, reason: "no-living-effect" });
          continue;
        }

        if (!hasLivingTargetEffect(rid)) {
          await cleanupWholeRequest(rid, scene.id, template.id, "no-living-target-effect");
          continue;
        }

        if (hasController(rid) && !hasLivingController(rid)) {
          await cleanupWholeRequest(rid, scene.id, template.id, "controller-expired");
        }
      }
    }
  }

  Hooks.on("createMeasuredTemplate", template => {
    const flags = template?.flags?.add2e ?? {};
    if (flags.spell !== SPELL) return;
    setTimeout(() => returnToTokenControls(), 50);
  });

  Hooks.on("createActiveEffect", effect => {
    if (!isResponsibleGM()) return;
    if (!isAmitie(effect)) return;
    setTimeout(() => ensureCasterController(effect), 50);
  });

  Hooks.on("deleteActiveEffect", effect => {
    if (!isResponsibleGM()) return;
    if (!isAmitie(effect)) return;
    const rid = requestId(effect);
    const sid = sceneIdFrom(effect);
    const tid = templateIdFrom(effect);
    if (!rid) return;

    if (isController(effect)) {
      setTimeout(() => cleanupWholeRequest(rid, sid, tid, "controller-deleted"), 100);
      return;
    }

    setTimeout(() => cleanupIfNoLivingTarget(rid, sid, tid, "target-effect-deleted"), 100);
  });

  Hooks.on("updateActiveEffect", effect => {
    if (!isResponsibleGM()) return;
    if (!isAmitie(effect)) return;
    if (!isExpired(effect)) return;
    const rid = requestId(effect);
    const sid = sceneIdFrom(effect);
    const tid = templateIdFrom(effect);
    if (!rid) return;

    if (isController(effect)) {
      setTimeout(() => cleanupWholeRequest(rid, sid, tid, "controller-expired"), 100);
      return;
    }

    setTimeout(() => cleanupIfNoLivingTarget(rid, sid, tid, "target-effect-expired"), 100);
  });

  Hooks.on("updateCombat", () => setTimeout(() => scanTemplates(), 150));
  Hooks.on("updateWorldTime", () => setTimeout(() => scanTemplates(), 150));
});
