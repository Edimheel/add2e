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

function measuredDrawings(scene, payload) {
  if (!scene) return [];
  const requestId = payload.templateRequestId ?? payload.requestId ?? null;
  const spell = payload.spell ?? null;
  return Array.from(scene.drawings ?? []).filter(d => {
    const flags = d.flags?.add2e ?? {};
    if (requestId && flags.templateRequestId === requestId) return true;
    if (spell && flags.spell === spell && requestId && flags.templateRequestId === requestId) return true;
    return false;
  });
}

function sceneDistanceToPixels(scene, distance) {
  const gridDistance = Number(scene?.grid?.distance ?? canvas?.scene?.grid?.distance ?? 1) || 1;
  const gridSize = Number(scene?.grid?.size ?? canvas?.grid?.size ?? canvas?.dimensions?.size ?? 100) || 100;
  return (Number(distance) || 0) / gridDistance * gridSize;
}

async function createVisibleDrawingFallback(scene, templateData, payload = {}) {
  if (!scene) return;
  const flags = templateData.flags?.add2e ?? {};
  const requestId = payload.templateRequestId ?? flags.templateRequestId ?? null;
  if (requestId && measuredDrawings(scene, { templateRequestId: requestId }).length) return;

  const type = String(templateData.t ?? templateData.type ?? "circle").toLowerCase();
  const x = Number(templateData.x ?? 0);
  const y = Number(templateData.y ?? 0);
  const color = payload.drawingColor ?? templateData.fillColor ?? "#7aa85c";
  const alpha = Number(payload.drawingAlpha ?? 0.28);
  const stroke = payload.drawingStroke ?? color;

  let drawingData = null;
  if (type === "circle") {
    const radius = Math.max(12, sceneDistanceToPixels(scene, templateData.distance ?? 1));
    drawingData = {
      x: x - radius,
      y: y - radius,
      rotation: 0,
      hidden: false,
      locked: false,
      fillType: 1,
      fillColor: color,
      fillAlpha: alpha,
      strokeColor: stroke,
      strokeAlpha: 0.9,
      strokeWidth: 3,
      shape: { type: "e", width: radius * 2, height: radius * 2 }
    };
  } else if (type === "rect" || type === "rectangle") {
    const width = Math.max(12, sceneDistanceToPixels(scene, templateData.width ?? templateData.distance ?? 1));
    const height = Math.max(12, sceneDistanceToPixels(scene, templateData.distance ?? templateData.width ?? 1));
    drawingData = {
      x: x - width / 2,
      y: y - height / 2,
      rotation: Number(templateData.direction ?? 0),
      hidden: false,
      locked: false,
      fillType: 1,
      fillColor: color,
      fillAlpha: alpha,
      strokeColor: stroke,
      strokeAlpha: 0.9,
      strokeWidth: 3,
      shape: { type: "r", width, height }
    };
  }

  if (!drawingData) return;
  drawingData.flags = {
    add2e: {
      ...foundry.utils.duplicate(flags),
      spell: payload.spell ?? flags.spell ?? null,
      spellName: payload.spellName ?? flags.spellName ?? null,
      templateRequestId: requestId,
      drawingFallback: true
    }
  };

  await scene.createEmbeddedDocuments("Drawing", [drawingData]);
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

  try {
    await scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
  } catch (err) {
    console.warn("[ADD2E][GM-RELAY][createMeasuredTemplate] échec création template, fallback Drawing :", err, templateData);
  }

  if (payload.visibleDrawing !== false && templateData.flags?.add2e?.visibleDrawing !== false) {
    await createVisibleDrawingFallback(scene, templateData, payload);
  }
}

export async function deleteMeasuredTemplates(payload) {
  const scene = resolveScene(payload.sceneId);
  if (!scene) return console.warn("[ADD2E][GM-RELAY][deleteMeasuredTemplates] scène introuvable :", payload);

  const ids = measuredTemplates(scene, payload).map(t => t.id).filter(Boolean);
  if (ids.length) await scene.deleteEmbeddedDocuments("MeasuredTemplate", ids);

  const drawingIds = measuredDrawings(scene, payload).map(d => d.id).filter(Boolean);
  if (drawingIds.length) await scene.deleteEmbeddedDocuments("Drawing", drawingIds);
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