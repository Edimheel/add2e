import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceFile = path.join(root, "fvtt-spells-all-normalise-mecanique-v4.json");
const reportFile = path.join(root, "audit/rapports/AUDIT-V4-SCHEMA-UTILISATION.json");
const clone = value => JSON.parse(JSON.stringify(value));
const own = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key);
const pick = (object, keys, fallback = "") => {
  for (const key of keys) if (own(object, key) && object[key] !== null && object[key] !== undefined && object[key] !== "") return clone(object[key]);
  return fallback;
};
const toList = value => Array.isArray(value) ? value : String(value ?? "").split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
const slug = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const requiredFields = ["classe", "spellLists", "niveau", "ecole", "portee", "duree", "zone_effet", "cible", "temps_incantation", "jet_sauvegarde", "composantes", "composants_materiels", "description", "onUse"];
const optionalFields = ["effectProfile"];

const input = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
const output = {
  exportVersion: input.exportVersion,
  system: input.system,
  rootFolder: input.rootFolder ? { id: input.rootFolder.id, name: input.rootFolder.name } : null,
  recursive: true,
  folders: (input.folders ?? []).map(folder => ({ _id: folder._id, name: folder.name, type: folder.type, folder: folder.folder ?? null, sorting: folder.sorting, sort: folder.sort, color: folder.color ?? null })),
  items: []
};
const folderIds = new Set(output.folders.map(folder => folder._id));
for (const item of input.items ?? []) {
  if (item.type !== "sort") throw new Error(`Item non-sort : ${item.name ?? "sans nom"}`);
  if (item.folder && !folderIds.has(item.folder)) throw new Error(`${item.name} : dossier introuvable`);
  const lists = [...new Set(toList(pick(item.system, ["spellLists", "classe", "class", "liste"], [])).map(slug).filter(Boolean))];
  if (!lists.length) throw new Error(`${item.name} : spellLists absent`);
  const flags = item.flags?.add2e ? { add2e: clone(item.flags.add2e) } : undefined;
  const system = {
    classe: String(pick(item.system, ["classe", "class", "liste"], lists[0])),
    spellLists: lists,
    niveau: Number(pick(item.system, ["niveau", "level"], 1)) || 1,
    ecole: pick(item.system, ["ecole", "école", "school"]),
    portee: pick(item.system, ["portee", "portée", "range"]),
    duree: pick(item.system, ["duree", "durée", "duration"]),
    zone_effet: pick(item.system, ["zone_effet", "zoneEffet", "area"]),
    cible: pick(item.system, ["cible", "target"]),
    temps_incantation: pick(item.system, ["temps_incantation", "tempsIncantation", "castingTime"]),
    jet_sauvegarde: pick(item.system, ["jet_sauvegarde", "jetSauvegarde", "savingThrow"]),
    composantes: pick(item.system, ["composantes", "components"]),
    composants_materiels: pick(item.system, ["composants_materiels", "composantsMateriels", "materialComponents"], []),
    description: pick(item.system, ["description", "description_reelle", "description_texte", "description_html"]),
    onUse: pick(item.system, ["onUse", "onuse", "on_use"]),
    ...(own(item.system, "effectProfile") ? { effectProfile: clone(item.system.effectProfile) } : {})
  };
  const expected = [...requiredFields, ...(own(item.system, "effectProfile") ? optionalFields : [])].sort();
  if (JSON.stringify(Object.keys(system).sort()) !== JSON.stringify(expected)) throw new Error(`${item.name} : contrat invalide`);
  output.items.push({ _id: item._id, name: item.name, type: "sort", img: item.img, folder: item.folder ?? null, sort: item.sort ?? 0, system, ...(flags ? { flags } : {}), ...(item.effects?.length ? { effects: clone(item.effects) } : {}) });
}
const inputEffectProfiles = (input.items ?? []).filter(item => own(item.system, "effectProfile")).length;
const outputEffectProfiles = output.items.filter(item => own(item.system, "effectProfile")).length;
if (inputEffectProfiles !== outputEffectProfiles) throw new Error(`effectProfile perdu : ${inputEffectProfiles} source, ${outputEffectProfiles} sortie`);
const report = {
  version: "2026-06-29-v4-compact-schema-v4",
  spells: output.items.length,
  effectProfiles: { input: inputEffectProfiles, output: outputEffectProfiles },
  inputBytes: fs.statSync(sourceFile).size,
  outputBytes: Buffer.byteLength(JSON.stringify(output, null, 2)),
  contract: { requiredFields, optionalFields },
  conclusion: "effectProfile est conservé à l’identique lorsqu’il est présent."
};
fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
if (process.argv.includes("--write")) fs.writeFileSync(sourceFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`[ADD2E][V4_COMPACT] ${output.items.length} sorts ; effectProfile ${inputEffectProfiles} → ${outputEffectProfiles}.`);
