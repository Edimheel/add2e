// ADD2E — Point d’entrée onUse : Agrandissement / Rétrécissement.
// Compatible Foundry V13/V14/V15.

const executeAgrandissement = globalThis.add2eCastAgrandissement;
if (typeof executeAgrandissement !== "function") {
  throw new Error("Le service canonique Agrandissement/Rétrécissement n’est pas chargé.");
}

return executeAgrandissement({
  actor: typeof actor !== "undefined" ? actor : null,
  item: typeof item !== "undefined" ? item : null,
  sort: typeof sort !== "undefined" ? sort : null,
  token: typeof token !== "undefined" ? token : null,
  args: typeof args !== "undefined" && Array.isArray(args) ? args : [],
  sourceItem: typeof sourceItem !== "undefined" ? sourceItem : null
});
