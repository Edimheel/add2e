import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repo = process.env.GITHUB_WORKSPACE;
execFileSync("git", ["fetch", "--depth=5", "origin", "agent-audit-sorts"], { cwd: repo, stdio: "inherit" });
const source = execFileSync("git", ["show", "HEAD^:audit/tools/generate-reference-files.mjs"], { cwd: repo, encoding: "utf8" })
  .replace("old.jet_sauvegarde ??? null", "old.jet_sauvegarde ?? null");
const temporary = path.join(os.tmpdir(), "generate-reference-files-fixed.mjs");
fs.writeFileSync(temporary, source, "utf8");
execFileSync("node", [temporary], { cwd: repo, env: process.env, stdio: "inherit" });
