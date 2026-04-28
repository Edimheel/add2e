// normalize-classes.js
const fs = require("fs");
const path = require("path");

const directory = path.resolve("./packs/classes/_source");

fs.readdirSync(directory).forEach((file) => {
  if (!file.endsWith(".json")) return;

  const filePath = path.join(directory, file);
  const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  content._id = path.basename(file, ".json");
  content.type = "Item";
  content.flags = content.flags || {};
  content.sort = content.sort ?? 100000;
  content.folder = content.folder ?? null;

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2), "utf-8");
  console.log(`✔ Corrigé : ${file}`);
});

console.log("✅ Tous les fichiers ont été mis à jour.");
