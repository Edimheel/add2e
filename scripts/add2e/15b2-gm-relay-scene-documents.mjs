// ADD2E — Relais MJ : documents de scène.

import { resolveScene } from "./15b0-gm-relay-common.mjs";

function measuredTemplates(scene, payload) {
  if (!scene) return [];
  const requestId = payload.templateRequestId ?? payload.requestId ?? null;
  const templateId = payload.templateId ?? null;
  const spell = payload.spell ?? null;

  return Array.from(scene.templates ?? []).filter(t => {
    if (templateId && t.id === templateId) return true;
    if (requestId && (t.flags?.add2e?.templateRequestId === requestId || t.getFlag?.("add2e", "templateRequestId") === requestId)) return true;
    if (spell && t.flags?.add2e?.spell === spell && requestId && t.flags?.add2e?.templateRequestId === requestId) return true;
    return false;
  });
}

export async function createMeasuredTemplate(payload) {
  const scene = resolveScene(payload.sceneId);
  if (!scene) return console.warn("[ADD2E][GM-RELAY][createMeasuredTemplate] scène introuvable :", payload);

  const templateData = foundry.utils.deepClone(payload.templateData ?? {});
  const requestId = payload.templateRequestId ?? templateData.flags?.add2e?.templateRequestId ?? null;
  if (requestId && measuredTemplates(scene, { templateRequestId: requestId }).length) return;

  templateData.flags ??= {};
  templateData.flags.add2e ??= {};
  if (requestId) templateData.flags.add2e.templateRequestId = requestId;
  if (payload.spell) templateData.flags.add2e.spell = payload.spell;
  if (payload.spellName) templateData.flags.add2e.spellName = payload.spellName;

  await scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
}

export async function deleteMeasuredTemplates(payload) {
  const scene = resolveScene(payload.sceneId);
  if (!scene) return console.warn("[ADD2E][GM-RELAY][deleteMeasuredTemplates] scène introuvable :", payload);

  const ids = measuredTemplates(scene, payload).map(t => t.id).filter(Boolean);
  if (ids.length) await scene.deleteEmbeddedDocuments("MeasuredTemplate", ids);
}

export async function createAmbientLight(payload) {
  const scene = resolveScene(payload.sceneId);
  if (!scene) return console.warn("[ADD2E][GM-RELAY][createAmbientLight] scène introuvable :", payload);

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
      animation: payload.animation ?? { type: "torch", speed: 2, intensity: 2, reverse: false }
    },
    flags: { add2e: foundry.utils.duplicate(payload.flags?.add2e ?? {}) }
  };

  await scene.createEmbeddedDocuments("AmbientLight", [lightData]);
}

export async function deleteAmbientLight(payload) {
  const scene = resolveScene(payload.sceneId);
  if (!scene) return console.warn("[ADD2E][GM-RELAY][deleteAmbientLight] scène introuvable :", payload);

  const light = Array.from(scene.lights ?? []).find(l => {
    if (payload.lightId && l.id === payload.lightId) return true;
    if (payload.requestId && (l.flags?.add2e?.requestId === payload.requestId || l.getFlag?.("add2e", "requestId") === payload.requestId)) return true;
    return false;
  });

  if (light) await light.delete();
}

export async function updateToken(payload) {
  const scene = resolveScene(payload.sceneId);
  const tokenDoc = scene?.tokens?.get(payload.tokenId);
  if (!scene || !tokenDoc) return console.warn("[ADD2E][GM-RELAY][updateToken] scène/token introuvable :", payload);
  await tokenDoc.update(payload.updateData ?? {});
}
