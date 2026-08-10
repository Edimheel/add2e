/**
 * scripts/tah-add2e.mjs
 * Adaptateur Token Action HUD Core
 * Mémorisation lue exclusivement depuis 07-spellcasting-rules.mjs.
 */

console.log("ADD2E TAH | Chargement adaptateur...");

Hooks.once("tokenActionHudCoreApiReady", async coreModule => {
  console.log("ADD2E TAH | Hook déclenché. Core Module :", coreModule);

  class Add2eActionHandler extends coreModule.api.ActionHandler {
    async buildSystemActions(groupIds) {
      const actor = this.actor;
      if (!actor) return;

      const armes = actor.items.filter(item => item.type === "arme");
      if (armes.length > 0) {
        const actions = armes.map(item => ({
          id: item.id,
          name: item.name,
          img: item.img,
          encodedValue: `arme|${item.id}`,
          cssClass: item.system.equipee ? "tah-add2e-equipped" : ""
        }));
        this.addActions(actions, { id: "combat", type: "system" });
      }

      if (typeof globalThis.add2eGetTotalMemorizedCount !== "function") {
        throw new Error("Le propriétaire canonique de la mémorisation ADD2E est indisponible pour Token Action HUD.");
      }

      const sorts = actor.items.filter(item => item.type === "sort");
      const actionsSorts = [];
      for (const sort of sorts) {
        const memorized = Math.max(0, Math.floor(Number(globalThis.add2eGetTotalMemorizedCount(sort)) || 0));
        if (memorized <= 0) continue;
        actionsSorts.push({
          id: sort.id,
          name: sort.name,
          img: sort.img,
          encodedValue: `sort|${sort.id}`,
          info1: { text: String(memorized) }
        });
      }
      if (actionsSorts.length > 0) this.addActions(actionsSorts, { id: "magie", type: "system" });
    }
  }

  class Add2eRollHandler extends coreModule.api.RollHandler {
    async handleActionClick(event, context) {
      let type = context.actionTypeId;
      let id = context.actionId;
      if (!type && context.encodedValue) [type, id] = context.encodedValue.split("|");

      const actor = this.actor;
      if (!actor) return;

      if (type === "arme") {
        const item = actor.items.get(id);
        if (item && globalThis.add2eAttackRoll) await globalThis.add2eAttackRoll({ actor, arme: item });
      }
      if (type === "sort") {
        const item = actor.items.get(id);
        if (item && globalThis.add2eCastSpell) await globalThis.add2eCastSpell({ actor, sort: item });
      }
    }
  }

  class Add2eSystemManager extends coreModule.api.SystemManager {
    getIds(actionId) {
      const [actionType, id] = actionId.split("|");
      return { actionTypeId: actionType, actionId: id };
    }

    getActionHandler() {
      return new Add2eActionHandler();
    }

    getRollHandler() {
      return new Add2eRollHandler();
    }

    async registerDefaults() {
      return {
        layout: [
          { id: "combat", name: "Combat", type: "system", groups: [{ id: "combat", name: "Armes", type: "system" }] },
          { id: "magie", name: "Magie", type: "system", groups: [{ id: "magie", name: "Sorts", type: "system" }] }
        ]
      };
    }
  }

  const systemManager = new Add2eSystemManager();
  const systemId = "add2e";
  if (typeof coreModule.api.registerSystem !== "function") {
    throw new Error("Token Action HUD Core : API registerSystem indisponible.");
  }
  coreModule.api.registerSystem(systemId, systemManager);
  console.log("ADD2E TAH | Enregistré (Standard System)");
});
