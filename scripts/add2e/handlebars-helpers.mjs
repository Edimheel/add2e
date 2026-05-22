// scripts/add2e/handlebars-helpers.mjs
// ADD2E — Helpers Handlebars partagés.

// Helpers Handlebars
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.json) {
  Handlebars.registerHelper("json", ctx => JSON.stringify(ctx, null, 2));
}
if (!Handlebars.helpers.subtract) Handlebars.registerHelper("subtract", (a, b) => a - b);
if (!Handlebars.helpers.eq)       Handlebars.registerHelper("eq", (a, b) => a === b);
if (!Handlebars.helpers.add) Handlebars.registerHelper("add", (a, b) =>
  Number(a ?? 0) + Number(b ?? 0)
);
if (!Handlebars.helpers.gt)       Handlebars.registerHelper("gt", (a, b) => Number(a) > Number(b));
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.array) {
  Handlebars.registerHelper("array", function() {
    // On retire le dernier argument (obj Handlebars)
    return Array.prototype.slice.call(arguments, 0, -1);
  });
}
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.lowercase) {
  Handlebars.registerHelper("lowercase", function(str) {
    return (str||"").toLowerCase();
  });
}
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.padLeft) {
  Handlebars.registerHelper("padLeft", function(value, width, char) {
    value = (value !== undefined && value !== null) ? String(value) : "";
    width = parseInt(width) || 2;
    char = (typeof char === "string" && char.length) ? char : "0";
    while (value.length < width) value = char + value;
    return value;
  });
}
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.formatSortChamp) {
  Handlebars.registerHelper("formatSortChamp", function(val) {
    if (!val) return "-";
    if (typeof val === "object") {
      const v = val.valeur !== undefined ? val.valeur : "";
      const u = val.unite ? (" " + val.unite) : "";
      return `${v}${u}`.trim() || "-";
    }
    return val;
  });
}

if (typeof Handlebars !== "undefined") {
  // Capitalise la première lettre
  Handlebars.registerHelper("capitalize", str =>
    (str && typeof str === "string") ? str.charAt(0).toUpperCase() + str.slice(1) : str
  );

  // Met en majuscule
  Handlebars.registerHelper("uppercase", str =>
    (str && typeof str === "string") ? str.toUpperCase() : str
  );

  // Sous-chaîne (substr)
  Handlebars.registerHelper("substr", (str, start, len) =>
    (str && typeof str === "string") ? str.substr(start, len) : str
  );

  // Concatène deux strings
  Handlebars.registerHelper("concat", function () {
    // Prend tous les arguments sauf le dernier (qui est options)
    return Array.from(arguments).slice(0, -1).join('');
  });

  // Crée un array (utile pour boucler sur une liste fixe dans le HBS)
  Handlebars.registerHelper("array", function () {
    return Array.prototype.slice.call(arguments, 0, -1);
  });
}

if (typeof Handlebars !== "undefined" && !Handlebars.helpers.getFlag) {
  Handlebars.registerHelper("getFlag", function(item, flag) {
    try {
      // Pour éviter les crashs si getFlag n'est pas dispo (ex : preview)
      if (!item || typeof item.getFlag !== "function") return false;
      const [scope, key] = flag.split('.');
      return item.getFlag(scope, key);
    } catch {
      return false;
    }
  });
}
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.toSpecialArray) {
  Handlebars.registerHelper("toSpecialArray", function (val) {
    // Si déjà un tableau, clone-le et filtre les vides/NEW
    if (Array.isArray(val)) {
      return val.filter(e => !!e && e !== "" && e !== "NEW");
    }
    // Si objet à clés numériques, convertis-le
    if (typeof val === "object" && val !== null) {
      return Object.values(val).filter(e => !!e && e !== "" && e !== "NEW");
    }
    // Rien à afficher
    return [];
  });
}
if (typeof Handlebars !== "undefined" && !Handlebars.helpers.length) {
  Handlebars.registerHelper('length', function(x) { return x ? x.length : 0; });
}

if (typeof Handlebars !== "undefined") {
  Handlebars.registerHelper("joinLines", function(value, fallback) {
    if (Array.isArray(value) && value.length) return value.filter(Boolean).join("\n");
    if (typeof value === "string" && value.trim()) return value;
    return typeof fallback === "string" ? fallback : "";
  });

  Handlebars.registerHelper("negativeNumber", function(value) {
    const n = Number(value || 0);
    return n === 0 ? 0 : -Math.abs(n);
  });

  Handlebars.registerHelper("magicSourceNames", function(value, fallback) {
    if (!Array.isArray(value) || !value.length) return typeof fallback === "string" ? fallback : "";
    return value
      .filter(Boolean)
      .map(source => String(source).replace(/:\s*[-+]?\d+\s*$/, ""))
      .join("\n");
  });
}
