export class Add2eItemSheet extends ItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "item"],
      width: 520,
      height: 600,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  /** @override */
  get template() {
    return "systems/add2e/templates/item/magic-item-sheet.hbs";
  }

  /** @override */
  async getData() {
    const context = await super.getData();
    const itemData = context.item;

    context.system = itemData.system;
    context.flags = itemData.flags;

    // VARIABLE CLÉ : Est-ce que l'utilisateur est le MJ ?
    context.isGM = game.user.isGM;

    // Sécurité pour les pouvoirs : s'assurer que c'est un tableau
    if (!context.system.pouvoirs) {
        context.system.pouvoirs = [];
    }

    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Si pas GM, on arrête ici (pas d'écouteurs d'édition)
    if (!game.user.isGM) return;

    // Ajouter un pouvoir
    html.find(".item-create").click(this._onItemCreate.bind(this));

    // Supprimer un pouvoir
    html.find(".pouvoir-delete").click(this._onItemDelete.bind(this));
  }

  async _onItemCreate(event) {
    event.preventDefault();
    const pouvoirs = this.item.system.pouvoirs || [];
    
    // Nouveau pouvoir vide
    const newPower = {
        name: "Nouveau Pouvoir",
        img: "icons/svg/mystery-man.svg",
        cout: 1,
        max: 1,
        description: "",
        onUse: ""
    };

    pouvoirs.push(newPower);
    await this.item.update({"system.pouvoirs": pouvoirs});
  }

  async _onItemDelete(event) {
    event.preventDefault();
    const idx = $(event.currentTarget).data("index");
    const pouvoirs = this.item.system.pouvoirs || [];

    if (idx > -1) {
        pouvoirs.splice(idx, 1);
        await this.item.update({"system.pouvoirs": pouvoirs});
    }
  }
}