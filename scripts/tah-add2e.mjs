/**
 * scripts/tah-add2e.mjs
 * Adaptateur Token Action HUD Core - Version Legacy / Direct
 */

console.log("ADD2E TAH | Chargement adaptateur...");

// Hook standard
Hooks.once("tokenActionHudCoreApiReady", async (coreModule) => {
    console.log("ADD2E TAH | Hook déclenché. Core Module :", coreModule);

    // --- DÉFINITIONS DES CLASSES ---

    class Add2eActionHandler extends coreModule.api.ActionHandler {
        async buildSystemActions(groupIds) {
            const actor = this.actor;
            if (!actor) return;

            // ARMES
            const armes = actor.items.filter(i => i.type === "arme");
            if (armes.length > 0) {
                const actions = armes.map(i => ({
                    id: i.id,
                    name: i.name,
                    img: i.img,
                    encodedValue: `arme|${i.id}`,
                    cssClass: i.system.equipee ? "tah-add2e-equipped" : ""
                }));
                this.addActions(actions, { id: 'combat', type: 'system' });
            }

            // SORTS
            const sorts = actor.items.filter(i => i.type === "sort");
            const actionsSorts = [];
            for (const s of sorts) {
                let mem = 0;
                try { mem = s.getFlag("add2e", "memorizedCount") || 0; } catch (e) {}
                if (mem > 0) {
                    actionsSorts.push({
                        id: s.id,
                        name: s.name,
                        img: s.img,
                        encodedValue: `sort|${s.id}`,
                        info1: { text: String(mem) }
                    });
                }
            }
            if (actionsSorts.length > 0) {
                this.addActions(actionsSorts, { id: 'magie', type: 'system' });
            }
        }
    }

    class Add2eRollHandler extends coreModule.api.RollHandler {
        async handleActionClick(event, context) {
            let type = context.actionTypeId;
            let id = context.actionId;
            // Décodage fallback
            if (!type && context.encodedValue) {
                [type, id] = context.encodedValue.split("|");
            }

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
        getActionHandler() { return new Add2eActionHandler(); }
        getRollHandler() { return new Add2eRollHandler(); }
        async registerDefaults() {
            return {
                layout: [
                    { id: 'combat', name: 'Combat', type: 'system', groups: [{ id: 'combat', name: 'Armes', type: 'system' }] },
                    { id: 'magie', name: 'Magie', type: 'system', groups: [{ id: 'magie', name: 'Sorts', type: 'system' }] }
                ]
            };
        }
    }

    /* =======================================
     * ENREGISTREMENT FORCÉ
     * ======================================= */
    const systemManager = new Add2eSystemManager();
    const systemId = "add2e";

    // Méthode 1 : API Standard v2
    if (coreModule.api.registerSystem) {
        coreModule.api.registerSystem(systemId, systemManager);
        console.log("ADD2E TAH | Enregistré (Standard System)");
    } 
    // Méthode 2 : API Module v2 (Fallback)
    else if (coreModule.api.registerModule) {
        coreModule.api.registerModule(systemId, systemManager);
        console.log("ADD2E TAH | Enregistré (Standard Module)");
    } 
    // Méthode 3 : Injection Directe (Brutale mais efficace)
    else {
        console.warn("ADD2E TAH | API non standard. Tentative d'injection directe...");
        // On essaie d'accéder à la map des systèmes via la globale
        if (game.tokenActionHud) {
            // Création manuelle de l'entrée système si l'API est cassée
            game.tokenActionHud.systems = game.tokenActionHud.systems || {};
            game.tokenActionHud.systems[systemId] = systemManager;
            console.log("ADD2E TAH | Enregistré (Injection Globale)");
        }
    }
});