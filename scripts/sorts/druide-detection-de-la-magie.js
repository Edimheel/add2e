// ADD2E — Détection de la magie — Druide — point d’entrée unifié.
// Compatible Foundry V13/V14/V15. DialogV2 uniquement.

const __add2eDetectMagicCanonicalPath = "systems/add2e/scripts/sorts/magicien-detection-de-la-magie.js";
const __add2eDetectMagicResponse = await fetch(__add2eDetectMagicCanonicalPath, { cache: "no-store" });

if (!__add2eDetectMagicResponse.ok) {
  console.error("[ADD2E][DETECTION_MAGIE][CANONICAL_LOAD_FAILED]", {
    path: __add2eDetectMagicCanonicalPath,
    status: __add2eDetectMagicResponse.status
  });
  ui.notifications.error("Détection de la magie : script canonique introuvable.");
  return false;
}

const __add2eDetectMagicCode = await __add2eDetectMagicResponse.text();
const __add2eDetectMagicAsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const __add2eDetectMagicRun = new __add2eDetectMagicAsyncFunction(
  "actor",
  "item",
  "sort",
  "token",
  "args",
  __add2eDetectMagicCode
);

console.log("[ADD2E][DETECTION_MAGIE][DELEGATE]", {
  source: "druide-detection-de-la-magie.js",
  target: __add2eDetectMagicCanonicalPath
});

return await __add2eDetectMagicRun(
  typeof actor !== "undefined" ? actor : null,
  typeof item !== "undefined" ? item : null,
  typeof sort !== "undefined" ? sort : null,
  typeof token !== "undefined" ? token : null,
  typeof args !== "undefined" ? args : []
);
