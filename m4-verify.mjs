#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cwd = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(cwd, "../..");

const args = parseArgs(process.argv.slice(2));
const rows = [];

const tests = runCommand("core tests", [process.execPath, "--test", "test/core.test.mjs"], { json: false });
addCheck("core tests pass", tests.ok, tests.ok ? "node --test completed successfully." : tests.error);

const progress = runJson("progress matrix", [process.execPath, "progress-report.mjs", "--json"]);
if (progress.ok) {
  addCheck("progress validation errors", progress.data.summary.matrix.validationErrors === 0, `matrix validation errors=${progress.data.summary.matrix.validationErrors}`);
  addCheck("golden validation errors", progress.data.summary.golden.validationErrors === 0, `golden validation errors=${progress.data.summary.golden.validationErrors}`);
  addCheck("progress has no blocked cases", !progress.data.summary.matrix.byStatus.blocked, `matrix status=${formatCounts(progress.data.summary.matrix.byStatus)}`);
} else {
  addCheck("progress report generated", false, progress.error);
}

const functional = runJson("functional golden", [process.execPath, "functional-golden-report.mjs", "--json"]);
if (functional.ok) {
  const verdicts = functional.data.summary.byVerdict || {};
  const nonSamplePartial = functional.data.cases.filter((item) => item.verdict === "partial" && item.status !== "sample-required").map((item) => item.id);
  const badVerdicts = ["invalid", "blocked", "usable-gap"].flatMap((key) => Array(verdicts[key] || 0).fill(key));
  const evaluationIds = new Set(functional.data.cases.filter((item) => item.evaluation).map((item) => item.id));
  const amap = functional.data.cases.find((item) => item.id === "amap-enhanced");
  addCheck("functional validation errors", functional.data.summary.validationErrors === 0, `validation errors=${functional.data.summary.validationErrors}`);
  addCheck("functional equivalent floor", functional.data.summary.functionalEquivalent >= 10, `functional equivalent=${functional.data.summary.functionalEquivalent}`);
  addCheck("no functional invalid/usable-gap", badVerdicts.length === 0, `bad verdicts=${badVerdicts.join(", ") || "none"}`);
  addCheck("non-sample partial is bounded", nonSamplePartial.length <= 1 && (!nonSamplePartial.length || nonSamplePartial[0] === "amap-enhanced"), `non-sample partial=${nonSamplePartial.join(", ") || "none"}`);
  addCheck("amap source recovery fixture", amap && ["equivalent", "likely-equivalent"].includes(amap.verdict), `amap verdict=${amap?.verdict || "missing"} behavior=${formatPercent(amap?.behavior?.coverage)}`);
  addCheck(
    "classic script metrics tracked",
    ["weibo", "neteasecloudmusic", "spotify"].every((id) => evaluationIds.has(id)),
    `tracked=${[...evaluationIds].join(", ") || "none"}`
  );
} else {
  addCheck("functional report generated", false, functional.error);
}

const module2Bin = path.join(root, "scratch/external/module2anywhere/bin/module2anywhere");
let cross = null;
if (fs.existsSync(module2Bin)) {
  cross = runJson("module2anywhere cross-check", [
    process.execPath,
    "cross-check-report.mjs",
    "--module2anywhere-bin",
    module2Bin,
    "--json",
  ]);
  if (cross.ok) {
    addCheck("cross-check external generation", cross.data.summary.withExternal === cross.data.summary.total, `external matched=${cross.data.summary.withExternal}/${cross.data.summary.total}`);
    addCheck("cross-check our validation errors", cross.data.summary.oursValidationErrors === 0, `ours validation errors=${cross.data.summary.oursValidationErrors}`);
    addCheck("cross-check external command errors", cross.data.summary.externalCommandErrors.length === 0, `external command errors=${cross.data.summary.externalCommandErrors.join(", ") || "none"}`);
    addCheck(
      "external validator errors are known",
      cross.data.summary.externalValidationErrors === 8,
      `external validation errors=${cross.data.summary.externalValidationErrors}; current known cause is top-level content-type header`
    );
  } else {
    addCheck("cross-check generated", false, cross.error);
  }
} else {
  addCheck("cross-check external tool available", true, "module2anywhere binary not found; skipped external generation.", "warn");
}

const report = {
  generatedAt: new Date().toISOString(),
  status: rows.some((row) => row.status === "fail") ? "fail" : rows.some((row) => row.status === "warn") ? "warn" : "pass",
  checks: rows,
  summary: {
    progress: progress.ok ? progress.data.summary : null,
    functional: functional.ok ? functional.data.summary : null,
    crossCheck: cross?.ok ? cross.data.summary : null,
  },
  conclusion: conclusion(rows, functional.ok ? functional.data : null),
};

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const markdown = renderMarkdown(report);
  if (args.write) {
    const target = path.resolve(cwd, args.write === true ? "docs/m4-convergence.md" : String(args.write));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, markdown, "utf8");
    console.log(`wrote ${target}`);
  } else {
    console.log(markdown);
  }
}

process.exitCode = report.status === "fail" ? 1 : 0;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const [rawKey, inline] = item.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    out[key] = inline ?? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true);
  }
  return out;
}

function runJson(label, command) {
  const result = runCommand(label, command, { json: true });
  if (!result.ok) return result;
  try {
    return { ok: true, data: JSON.parse(result.stdout) };
  } catch (error) {
    return { ok: false, error: `${label} returned invalid JSON: ${error.message}` };
  }
}

function runCommand(label, command) {
  const [cmd, ...cmdArgs] = command;
  const result = spawnSync(cmd, cmdArgs, {
    cwd,
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0 || result.error) {
    return {
      ok: false,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      error: result.error?.message || result.stderr || `${label} exited ${result.status}`,
    };
  }
  return { ok: true, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function addCheck(name, ok, detail, severity = "fail") {
  rows.push({ name, status: ok ? "pass" : severity, detail });
}

function formatCounts(counts = {}) {
  return Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(", ");
}

function formatPercent(value) {
  if (typeof value !== "number") return "-";
  return `${Math.round(value * 1000) / 10}%`;
}

function conclusion(checks, functionalData) {
  if (checks.some((row) => row.status === "fail")) return "M4 is not ready to close; fix failed checks first.";
  const partial = functionalData?.cases?.find((item) => item.verdict === "partial" && item.status !== "sample-required");
  if (partial?.id === "amap-enhanced") {
    return "M4 can close with one documented non-sample gap: Amap depends on a remote script source that currently returns HTTP 403. Source recovery is now supported through CLI/API overrides.";
  }
  return "M4 can close; Amap source recovery is verified with a local script fixture, and remaining gaps are tracked sample-required/script-evaluation items.";
}

function renderMarkdown(data) {
  const lines = [];
  lines.push("# M4 Convergence Report");
  lines.push("");
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push(`Status: ${data.status}`);
  lines.push("");
  lines.push("## Checks");
  lines.push("");
  lines.push("| check | status | detail |");
  lines.push("| --- | --- | --- |");
  for (const row of data.checks) lines.push(`| ${row.name} | ${row.status} | ${String(row.detail || "").replaceAll("|", "\\|")} |`);
  lines.push("");
  lines.push("## Functional Summary");
  lines.push("");
  if (data.summary.functional) {
    lines.push(`- Cases: ${data.summary.functional.total}`);
    lines.push(`- Verdicts: ${formatCounts(data.summary.functional.byVerdict)}`);
    lines.push(`- Validation errors: ${data.summary.functional.validationErrors}`);
    lines.push(`- Functional equivalent or likely-equivalent: ${data.summary.functional.functionalEquivalent}`);
    if (data.summary.functional.evaluation) {
      lines.push(`- Evaluation metrics: ${data.summary.functional.evaluation.total} cases, avg behavior ${formatPercent(data.summary.functional.evaluation.averageBehaviorCoverage)}, sample-required ${data.summary.functional.evaluation.sampleRequired.join(", ") || "none"}`);
    }
  }
  lines.push("");
  lines.push("## Cross-Check Summary");
  lines.push("");
  if (data.summary.crossCheck) {
    lines.push(`- External cases matched: ${data.summary.crossCheck.withExternal}/${data.summary.crossCheck.total}`);
    lines.push(`- Our validation errors: ${data.summary.crossCheck.oursValidationErrors}`);
    lines.push(`- External validation errors: ${data.summary.crossCheck.externalValidationErrors}`);
    lines.push(`- External command errors: ${data.summary.crossCheck.externalCommandErrors.join(", ") || "none"}`);
  }
  lines.push("");
  lines.push("## Conclusion");
  lines.push("");
  lines.push(data.conclusion);
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- module2anywhere remains useful as a cross-check, but its current output is not a stronger oracle for Anywhere correctness.");
  lines.push("- Current external validation errors are caused by top-level `content-type = ...`, which current Anywhere does not recognize.");
  lines.push("- M4 closure should allow documented `sample-required` cases; protobuf, large bundles, and dynamic app-specific scripts belong to the manual/agent route.");
  lines.push("");
  return lines.join("\n");
}
