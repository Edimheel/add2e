// ADD2E — compatibilité de chemin : Détection de l'invisibilité.
// Compatible Foundry V13/V14/V15.
// La mécanique est exclusivement portée par illusionniste-detection-de-l-invisibilite.js.

const response = await fetch("systems/add2e/scripts/sorts/illusionniste-detection-de-l-invisibilite.js", { cache: "no-store" });
if (!response.ok) {
  throw new Error(`Détection de l'invisibilité : onUse principal introuvable (${response.status}).`);
}

const code = await response.text();
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction("actor", "item", "sort", "token", "args", "sourceItem", code);

return execute.call(
  this,
  typeof actor !== "undefined" ? actor : null,
  typeof item !== "undefined" ? item : null,
  typeof sort !== "undefined" ? sort : null,
  typeof token !== "undefined" ? token : null,
  typeof args !== "undefined" && Array.isArray(args) ? args : [],
  typeof sourceItem !== "undefined" ? sourceItem : null
);
