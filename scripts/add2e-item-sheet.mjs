export class Add2eItemSheet extends ItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "item"],
      width: 600,
      height: 700,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  /** @override */
  get template() {
    const type = String(this.item?.type ?? "").toLowerCase();

    const templates = {
      arme: "systems/add2e/templates/item/arme-sheet.hbs",
      armure: "systems/add2e/templates/item/armure-sheet.hbs",
      classe: "systems/add2e/templates/item/classe-sheet.hbs",
      race: "systems/add2e/templates/item/race-sheet.hbs",
      sort: "systems/add2e/templates/item/sort-sheet.hbs",
      objet: "systems/add2e/templates/item/magic-item-sheet.hbs"
    };

    return templates[type] ?? "systems/add2e/templates/item/magic-item-sheet.hbs";
  }

  /** @override */
  async getData() {
    const context = await super.getData();

    context.item = this.item;
    context.system = this.item.system;
    context.flags = this.item.flags;
    context.isGM = game.user.isGM;
    context.owner = this.item.isOwner;
    context.editable = this.isEditable;

    if (!context.system.pouvoirs) {
      context.system.pouvoirs = [];
    }

    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    if (!game.user.isGM) return;

    html.find(".item-create").click(this._onItemCreate.bind(this));
    html.find(".pouvoir-delete").click(this._onItemDelete.bind(this));
  }

  async _onItemCreate(event) {
    event.preventDefault();

    const pouvoirs = foundry.utils.deepClone(this.item.system.pouvoirs || []);

    const newPower = {
      name: "Nouveau Pouvoir",
      img: "icons/svg/mystery-man.svg",
      cout: 1,
      max: 1,
      niveau: 1,
      ecole: "",
      description: "",
      onUse: ""
    };

    pouvoirs.push(newPower);

    await this.item.update({
      "system.pouvoirs": pouvoirs
    });
  }

  async _onItemDelete(event) {
    event.preventDefault();

    const idx = Number($(event.currentTarget).data("index"));
    const pouvoirs = foundry.utils.deepClone(this.item.system.pouvoirs || []);

    if (Number.isNaN(idx) || idx < 0 || idx >= pouvoirs.length) return;

    pouvoirs.splice(idx, 1);

    await this.item.update({
      "system.pouvoirs": pouvoirs
    });
  }
}