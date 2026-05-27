// ADD2E — Amitié : contrôleur lanceur et nettoyage des templates.

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
