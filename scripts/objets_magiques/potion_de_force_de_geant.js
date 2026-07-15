const { runGiantStrengthPotion } = await import(`/systems/add2e/scripts/objets_magiques/_potion-runtime.mjs?cb=${Date.now()}`);
return runGiantStrengthPotion({ actor, item, sourceItem, sort, power, pouvoir, powerIndex, scope, args });
