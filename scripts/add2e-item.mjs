/**
 * scripts/add2e-item.js
 * ItemSheet custom pour les objets de type "classe"
 */
Hooks.once("init", () => {
  console.log("ADD2e | Initialisation du sheet custom Classe");

  // 1) Désenregistre la sheet core
  Items.unregisterSheet("core", ItemSheet);

  // 2) Déclare la sheet custom
  class Add2eClassSheet extends ItemSheet {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        classes: ["add2e","sheet","item","classe"],
        template: "systems/add2e/templates/item/classe-sheet.hbs",
        width: 600,
        height: 700,
        tabs: [{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "description" }]
      });
    }

    /** Expose `name` et `system` à la racine du template */
    getData() {
      const data = super.getData();
      data.name   = this.object.name;
      data.system = this.object.system;
      return data;
    }

    activateListeners(html) {
      super.activateListeners(html);
      // Onglets
      html.find(".tabs a").on("click", ev => {
        ev.preventDefault();
        const tab = $(ev.currentTarget).data("tab");
        html.find(".tabs a").removeClass("active");
        $(ev.currentTarget).addClass("active");
        html.find(".content").addClass("hidden");
        html.find(`.content[data-tab="${tab}"]`).removeClass("hidden");
      });
    }
  }

  // 3) Enregistre-la comme défaut pour les Item de type "classe"
  Items.registerSheet("add2e", Add2eClassSheet, {
    types: ["classe"],
    makeDefault: true,
    label: "ADD2e | Fiche Classe"
  });

  console.log("ADD2e | Sheet classe enregistrée");
});
