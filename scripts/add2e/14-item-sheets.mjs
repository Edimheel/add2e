class Add2eArmureSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "item", "armure"],
      template: "systems/add2e/templates/item/armure-sheet.hbs",
      width: 500,
      height: 430,
      resizable: true
    });
  }
  async getData() {
  const data = await super.getData();
      data.system = data.item.system;
  data.img = this.item.img || "icons/svg/mystery-man.svg";
  return data;
}

  activateListeners(html) {
    super.activateListeners(html);
    add2eRegisterImgPicker(html, this);
    // Ajoute ici des listeners custom si besoin (ex : bouton, bascule équipee…)
    html.find(".toggle-equip").on("click", async ev => {
      ev.preventDefault();
      const value = !this.item.system.equipee;
      await this.item.update({"system.equipee": value});
      this.render(false);
    });
 
  }
}
globalThis.Add2eArmureSheet = Add2eArmureSheet;
Items.registerSheet("add2e", Add2eArmureSheet, {
  types: ["armure"],
  makeDefault: true,
  label: "ADD2e Armure"
});


class Add2eObjetSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "item", "objet", "objet-magique"],
      template: "systems/add2e/templates/item/objet-sheet.hbs",
      width: 760,
      height: "auto",
      resizable: true,
      tabs: [{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "resume" }]
    });
  }

  async getData(options = {}) {
    const data = await super.getData(options);
    const item = this.item ?? this.object;
    const system = item?.system ?? {};

    const toArray = value => {
      if (!value) return [];
      if (Array.isArray(value)) return value.filter(v => v !== undefined && v !== null && String(v).trim() !== "");
      if (typeof value === "object") return Object.values(value).filter(v => v !== undefined && v !== null && String(v).trim() !== "");
      if (typeof value === "string") return value.split(/[,;|\n]+/).map(v => v.trim()).filter(Boolean);
      return [];
    };

    const powersRaw = system.pouvoirs ?? system.powers ?? system.pouvoirsMagiques ?? system.magicalPowers ?? [];
    const pouvoirs = Array.isArray(powersRaw)
      ? powersRaw.filter(p => p && typeof p === "object")
      : (powersRaw && typeof powersRaw === "object" ? Object.values(powersRaw).filter(p => p && typeof p === "object") : []);

    data.item = item;
    data.system = system;
    data.img = item?.img || "icons/svg/mystery-man.svg";
    data.pouvoirs = pouvoirs;
    data.tags = toArray(system.tags);
    data.effectTags = toArray(system.effectTags ?? system.effets ?? system.effects);
    data.charges = {
      value: Number(system.charges?.value ?? system.chargesValeur ?? system.current_charges ?? system.currentCharges ?? 0) || 0,
      max: Number(system.charges?.max ?? system.max_charges ?? system.maxCharges ?? system.charges_max ?? 0) || 0
    };
    data.isMagicItem = system.magique === true || system.magic === true || String(system.categorie ?? "").toLowerCase().includes("magique");

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    add2eRegisterImgPicker(html, this);

    html.find(".tabs a").off("click.add2e-objet-tab").on("click.add2e-objet-tab", ev => {
      ev.preventDefault();
      const tab = ev.currentTarget.dataset.tab;
      html.find(".tabs a").removeClass("active");
      html.find(ev.currentTarget).addClass("active");
      html.find(".sheet-body .content").addClass("hidden");
      html.find(`.sheet-body .content[data-tab="${tab}"]`).removeClass("hidden");
    });
  }
}

globalThis.Add2eObjetSheet = Add2eObjetSheet;
Items.registerSheet("add2e", Add2eObjetSheet, {
  types: ["objet"],
  makeDefault: true,
  canConfigure: true,
  canBeDefault: true,
  label: "ADD2e Objet"
});

class Add2eArmeSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "item", "arme"],
      template: "systems/add2e/templates/item/arme-sheet.hbs",
      width: 500,
      height: 400,
      resizable: true
    });
  }
  async getData() {
  const data = await super.getData();
      data.system = data.item.system;
  data.img = this.item.img || "icons/svg/mystery-man.svg";
  return data;
}
    activateListeners(html) {
    super.activateListeners(html);
add2eRegisterImgPicker(html, this);
  }

}
globalThis.Add2eArmeSheet = Add2eArmeSheet;
Items.registerSheet("add2e", Add2eArmeSheet, {
  types: ["arme"],
  makeDefault: true,
  label: "ADD2e Arme"
});
class Add2eSortSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "item", "sort"],
      template: "systems/add2e/templates/item/sort-sheet.hbs", // Chemin réel de ton template sort
      width: 500,
      height: "auto",
      resizable: true
    });
  }

 async getData() {
  const data = await super.getData();

  // Pour une ItemSheet (sort), toujours utiliser this.item
  data.name   = this.item?.name ?? "";
  data.img    = this.item?.img ?? "icons/svg/mystery-man.svg";
  data.system = this.item?.system ?? {};

  data.system.number         ??= "";
  data.system.diet           ??= "";
  data.system.encounterTable ??= "";

  // Les listes d’items (armes/armures/sorts) n’ont pas de sens dans une fiche de sort isolée
  // Sauf si la fiche sort est affichée “embarquée” dans un acteur (cas Foundry rare, mais tu peux le garder en fallback)
  data.listeArmes   = [];
  data.listeArmures = [];
  data.listeSorts   = [];

  if (this.item?.parent && this.item.parent.documentName === "Actor") {
    // L’item est bien embarqué sur un acteur (fiche PJ)
    const actorItems = this.item.parent.items || [];
    data.listeArmes   = actorItems.filter(i => i.type === "arme");
    data.listeArmures = actorItems.filter(i => i.type === "armure");
    data.listeSorts   = actorItems.filter(i => i.type === "sort");
  }

  // SECTION CRITIQUE POUR SORTS PAR NIVEAU
  const sorts = data.listeSorts ?? [];
  const sortsParNiveau = {};
  for (const sort of sorts) {
    let niveau = Number(sort.system?.niveau || sort.system?.level || 1);
    if (!niveau || isNaN(niveau)) niveau = 1;
    if (!sortsParNiveau[niveau]) sortsParNiveau[niveau] = [];
    sortsParNiveau[niveau].push(sort);
  }
  const niveauxSorts = Object.keys(sortsParNiveau).map(Number).sort((a, b) => a - b);

  data.sortsParNiveau = sortsParNiveau;
  data.niveauxSorts = niveauxSorts;

  // Champ pour la section “mémorisés” du template
  data.sortsMemorizedByLevel = {};

  return data;
}



    activateListeners(html) {
    super.activateListeners(html);
add2eRegisterImgPicker(html, this);
  }
}
globalThis.Add2eSortSheet = Add2eSortSheet;
Items.registerSheet("add2e", Add2eSortSheet, {
  types: ["sort"],
  makeDefault: true,
  label: "ADD2e Sort"
});


class Add2eRaceSheet extends ItemSheet {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["add2e", "sheet", "item", "race-sheet-modern"],
      template: "systems/add2e/templates/item/race-sheet.hbs",
      width: 700,
      height: "auto",
      resizable: true,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main"}],
      scrollY: [".sheet-body"],
    });
  }

async getData() {
  const data = await super.getData();
  // Patch sécurité pour éviter les erreurs "undefined"
  data.system = data.system || data.item?.system || {};

  // -- Transforme les objets en array pour Handlebars si besoin --
  const toArray = obj =>
    Array.isArray(obj)
      ? obj
      : typeof obj === "object" && obj !== null
        ? Object.entries(obj)
            .filter(([k]) => !["NEW", "NEW_KEY", "NEW_VAL"].includes(k))
            .filter(([k, v]) => v !== "" && v !== null && v !== undefined)
            .map(([_, v]) => v)
        : [];

  // Capacités raciales (toujours array pour le HBS)
  data.system.capacites = toArray(data.system.capacites);

  // Limites de classes (clé → valeur)
  if (typeof data.system.limites_classes !== "object" || Array.isArray(data.system.limites_classes))
    data.system.limites_classes = {};
  // Min/Max caracs
  if (typeof data.system.min_caracteristiques !== "object" || Array.isArray(data.system.min_caracteristiques))
    data.system.min_caracteristiques = {};
  if (typeof data.system.max_caracteristiques !== "object" || Array.isArray(data.system.max_caracteristiques))
    data.system.max_caracteristiques = {};
  // Bonus caracs
  if (typeof data.system.bonus_caracteristiques !== "object" || Array.isArray(data.system.bonus_caracteristiques))
    data.system.bonus_caracteristiques = {};

  // Valeurs textuelles (par défaut vide)
  data.system.description ??= "";
  data.system.description_longue ??= "";
  data.system.note_md ??= "";
  data.system.langues ??= "";
  data.system.vitesse ??= "";
  data.system.taille ??= "";
  data.system["âge_debut"] ??= "";
  data.system["espérance_vie"] ??= "";

  return data;
}


  activateListeners(html) {
    super.activateListeners(html);
 
    // Image picker Foundry natif
    html.find('img[data-edit="img"]').off().on('click', ev => {
      ev.preventDefault();
      new FilePicker({
        type: "image",
        current: this.item.img,
        callback: path => {
          this.item.update({ img: path });
          html.find('img[data-edit="img"]').attr('src', path);
          html.find('input[name="img"]').val(path);
        }
      }).render(true);
    });

    // Autosave sur modification des champs (optionnel)
    html.find('input, textarea, select').on('change', async (event) => {
      event.preventDefault();
      const form = html.find('form')[0] || html[0];
      const formData = new FormData(form);
      let updateData = foundry.utils.expandObject(Object.fromEntries(formData));

      // Ajoute un nouveau bonus carac si les champs sont remplis
      if (updateData.system?.bonus_caracteristiques?.NEW_KEY) {
        const k = updateData.system.bonus_caracteristiques.NEW_KEY.trim();
        const v = Number(updateData.system.bonus_caracteristiques.NEW_VAL) || 0;
        if (k) {
          updateData[`system.bonus_caracteristiques.${k}`] = v;
        }
        delete updateData.system.bonus_caracteristiques.NEW_KEY;
        delete updateData.system.bonus_caracteristiques.NEW_VAL;
      }
      // Ajout nouvelle capacité
      if (updateData.system?.capacites?.NEW) {
        const newCap = updateData.system.capacites.NEW.trim();
        if (newCap) {
          const caps = this.item.system.capacites ? [...this.item.system.capacites] : [];
          caps.push(newCap);
          updateData['system.capacites'] = caps;
        }
        delete updateData.system.capacites.NEW;
      }

      await this.item.update(updateData);
      this.render(false);
    });
  }
}


globalThis.Add2eRaceSheet = Add2eRaceSheet;
Items.registerSheet("add2e", Add2eRaceSheet, {
  types: ["race"],
  makeDefault: true,
  label: "ADD2e Race"
});

// Exposition globale conservée pour compatibilité avec le code legacy et les scripts onUse.
try { globalThis.Add2eArmureSheet = Add2eArmureSheet; } catch (_e) {}
try { globalThis.Add2eObjetSheet = Add2eObjetSheet; } catch (_e) {}
try { globalThis.Add2eArmeSheet = Add2eArmeSheet; } catch (_e) {}
try { globalThis.Add2eSortSheet = Add2eSortSheet; } catch (_e) {}
try { globalThis.Add2eRaceSheet = Add2eRaceSheet; } catch (_e) {}
