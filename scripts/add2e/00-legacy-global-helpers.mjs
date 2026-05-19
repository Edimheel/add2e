// ============================================================
// ADD2E — Helpers globaux encore utilisés par la feuille legacy
// ============================================================

const ADD2E_LEGACY_GLOBAL_HELPERS_VERSION = "2026-05-19-legacy-global-helpers-v1";
globalThis.ADD2E_LEGACY_GLOBAL_HELPERS_VERSION = ADD2E_LEGACY_GLOBAL_HELPERS_VERSION;
console.log("[ADD2E][LEGACY_GLOBAL_HELPERS][VERSION]", ADD2E_LEGACY_GLOBAL_HELPERS_VERSION);

function add2eLegacyNormalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_");
}

function add2eLegacyArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(add2eLegacyArray).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
  if (value && typeof value === "object") {
    for (const key of ["value", "values", "list", "lists", "items", "allowed", "alignments", "alignements"]) {
      if (value[key] !== undefined) return add2eLegacyArray(value[key]);
    }
  }
  return [value];
}

function add2eClassAllowedAlignmentsFallback(classSystem = {}) {
  const sources = [
    classSystem.alignements_autorises,
    classSystem.alignementsAutorises,
    classSystem.allowedAlignments,
    classSystem.alignmentsAllowed,
    classSystem.alignements,
    classSystem.alignments,
    classSystem.alignment,
    classSystem.alignement
  ];

  const out = [];
  for (const src of sources) out.push(...add2eLegacyArray(src));

  const tags = add2eLegacyArray(classSystem.requirementTags);
  for (const raw of tags) {
    const tag = add2eLegacyNormalize(raw);
    const parts = tag.split(":");
    if (parts[0] !== "prerequis" || parts[1] !== "alignement") continue;
    if (parts[2] === "allow" && parts[3]) out.push(parts.slice(3).join(":"));
  }

  return [...new Set(out.map(v => String(v ?? "").trim()).filter(Boolean))];
}

if (typeof globalThis.add2eClassAllowedAlignments !== "function") {
  globalThis.add2eClassAllowedAlignments = add2eClassAllowedAlignmentsFallback;
}

if (typeof globalThis.add2ePickClassAlignment !== "function") {
  globalThis.add2ePickClassAlignment = function add2ePickClassAlignment(actor, classSystem = {}) {
    const allowed = globalThis.add2eClassAllowedAlignments?.(classSystem) ?? [];
    const current = String(actor?.system?.alignement ?? "").trim();
    const currentNorm = add2eLegacyNormalize(current);

    if (allowed.length) {
      const match = allowed.find(a => add2eLegacyNormalize(a) === currentNorm);
      if (match) return current;
      return allowed[0];
    }

    return current;
  };
}

if (typeof globalThis.add2eRegisterImgPicker !== "function") {
  globalThis.add2eRegisterImgPicker = function add2eRegisterImgPicker(html, sheet) {
    const root = html?.jquery ? html : $(html);
    if (!root?.find) return;

    const actor = sheet?.actor ?? sheet?.document;
    if (!actor) return;

    root.find("img[data-edit], .profile-img[data-edit], .actor-img[data-edit]")
      .off("click.add2e-img-picker")
      .on("click.add2e-img-picker", ev => {
        ev.preventDefault();
        const target = ev.currentTarget;
        const field = target.dataset.edit || target.getAttribute("data-edit") || "img";
        const current = foundry.utils.getProperty(actor, field) || target.getAttribute("src") || actor.img || "icons/svg/mystery-man.svg";

        new FilePicker({
          type: "image",
          current,
          callback: async path => {
            const update = {};
            update[field] = path;
            await actor.update(update);
          },
          top: sheet?.position?.top + 40,
          left: sheet?.position?.left + 10
        }).browse(current);
      });
  };
}
