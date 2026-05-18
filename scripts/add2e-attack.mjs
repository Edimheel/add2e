// scripts/add2e-attack.mjs
// ADD2E — Point d'entrée attaque / dégâts / sorts.
// Le fichier original a été découpé en modules pour faciliter les corrections ciblées.

import "./add2e-attack/01-core-helpers.mjs";
import "./add2e-attack/02-damage.mjs";
import "./add2e-attack/03-attack-rules.mjs";
import "./add2e-attack/04-attack-roll.mjs";
import "./add2e-attack/05-jb2a-vfx.mjs";
import "./add2e-attack/06-cast-spell.mjs";

console.log("ADD2E | add2e-attack modulaire chargé", globalThis.ADD2E_ATTACK_VERSION);
