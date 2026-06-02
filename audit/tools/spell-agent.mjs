import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../..");

const configPath = path.join(root, "audit/agent-config.json");
const statePath = path.join(root, "audit/agent-state.json");
const reportsDir = path.join(root, "audit/rapports");
const runReportPath = path.join(reportsDir, "AGENT-RUN.md");

function readJson(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function runNodeScript(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return { script: relativePath, status: "missing" };
  const output = execFileSync("node", [fullPath], { cwd: root, encoding: "utf8" });
  return { script: relativePath, status: "ok", output: output.trim() };
}

function numberFromLine(text, label) {
  const line = text.split("\n").find((entry) => entry.includes(label));
  if (!line) return null;
  const found = line.match(/\d+/g);
  return found ? Number(found[found.length - 1]) : null;
}

function parseReport(lot) {
  const filePath = path.join(reportsDir, `${lot}.md`);
  if (!fs.existsSync(filePath)) return { lot, status: "report_missing" };
  const text = fs.readFileSync(filePath, "utf8");
  return {
    lot,
    status: "report_ok",
    foundry: numberFromLine(text, "Sorts dans"),
    expected: numberFromLine(text, "Sorts attendus"),
    missing: numberFromLine(text, "Sorts manquants"),
    nameDiffs: numberFromLine(text, "Ecarts de nom") ?? numberFromLine(text, "Écarts de nom")
  };
}

function chooseNextLot(config, lotReports) {
  const order = Array.isArray(config.lotOrder) ? config.lotOrder : [];
  return order.find((lot) => {
    const report = lotReports.find((entry) => entry.lot === lot);
    return report && report.status === "report_ok" && ((report.missing || 0) > 0 || (report.nameDiffs || 0) > 0);
  }) || order[0] || null;
}

function plannedAction(entry) {
  return {
    lot: entry.lot,
    expected: entry.expected,
    foundry: entry.foundry,
    missing: entry.missing || 0,
    nameDiffs: entry.nameDiffs || 0,
    action: "prepare_safe_correction_plan"
  };
}

function main() {
  fs.mkdirSync(reportsDir, { recursive: true });

  const config = readJson(configPath, {});
  const previousState = readJson(statePath, {});
  const actions = [];

  if (config.autoGenerateReferences) actions.push(runNodeScript("audit/tools/generate-reference-files.mjs"));
  if (config.autoGenerateReports) actions.push(runNodeScript("audit/tools/generate-spell-audit-reports.mjs"));

  const lots = Array.isArray(config.lotOrder) ? config.lotOrder : [];
  const lotReports = lots.map(parseReport);
  const nextLot = chooseNextLot(config, lotReports);
  const blockedLots = lotReports.filter((entry) => entry.status !== "report_ok").map((entry) => entry.lot);
  const lotsWithFindings = lotReports.filter((entry) => entry.status === "report_ok" && ((entry.missing || 0) > 0 || (entry.nameDiffs || 0) > 0));
  const plannedActions = lotsWithFindings.map(plannedAction);

  const state = {
    ...previousState,
    agentName: config.agentName || "add2e-spell-agent",
    lastRunAt: new Date().toISOString(),
    lastRunStatus: "ok_finished",
    runCompleted: true,
    mode: config.mode || "audit_and_plan",
    allowProductionWrites: Boolean(config.allowProductionWrites),
    totalLots: lots.length,
    lotsWithFindingsCount: lotsWithFindings.length,
    plannedActionCount: plannedActions.length,
    currentLot: null,
    nextLot,
    blockedLots,
    safeActionsDone: actions,
    productionActionsPlanned: plannedActions
  };

  writeJson(statePath, state);

  const lines = [];
  lines.push("# Agent run");
  lines.push("");
  lines.push(`Run at: ${state.lastRunAt}`);
  lines.push(`Status: ${state.lastRunStatus}`);
  lines.push(`Run completed: ${state.runCompleted}`);
  lines.push(`Mode: ${state.mode}`);
  lines.push(`Production writes: ${state.allowProductionWrites}`);
  lines.push(`Total lots: ${state.totalLots}`);
  lines.push(`Lots with findings: ${state.lotsWithFindingsCount}`);
  lines.push(`Planned actions: ${state.plannedActionCount}`);
  lines.push(`Next lot: ${nextLot || "none"}`);
  lines.push("");
  lines.push("## Actions");
  lines.push("");
  for (const action of actions) lines.push(`- ${action.script}: ${action.status}`);
  lines.push("");
  lines.push("## Lots with findings");
  lines.push("");
  lines.push("| Lot | Expected | Export | Missing | Name diffs |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const entry of lotsWithFindings) {
    lines.push(`| ${entry.lot} | ${entry.expected ?? "?"} | ${entry.foundry ?? "?"} | ${entry.missing ?? 0} | ${entry.nameDiffs ?? 0} |`);
  }
  fs.writeFileSync(runReportPath, `${lines.join("\n")}\n`, "utf8");

  console.log(`Agent run complete. Findings: ${lotsWithFindings.length}. Next lot: ${nextLot || "none"}`);
}

main();
