#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { convertModuleAsync, internals, validateAnywhereOutput } from "./core.mjs";
import { goldenCases } from "./golden-cases.mjs";

const root = path.resolve(new URL("../..", import.meta.url).pathname);

const cases = [
  { id: "pinduoduo", source: "scratch/modules/Pinduoduo.lpx", category: "native" },
  { id: "hupu", source: "scratch/modules/Hupu.lpx", category: "native+routing" },
  { id: "autonavi", source: "scratch/modules/AutoNavi.lpx", category: "native+routing" },
  { id: "pixiv", source: "scratch/modules/Pixiv.lpx", category: "body-json+routing" },
  { id: "fanqienovel", source: "scratch/modules/FanQieNovel.lpx", category: "native+routing" },
  { id: "bank", source: "scratch/modules/Bank.module", category: "map-local+respond" },
  { id: "ximalaya", source: "scratch/modules/Ximalaya.lpx", category: "native+body-json+script-gap" },
  { id: "smzdm", source: "scratch/modules/SMZDM.lpx", category: "script-dispatcher" },
  { id: "weibo", source: "scratch/modules/weibo.plugin", category: "mixed-script" },
  { id: "bilibili", source: "scratch/modules/bilibili.sgmodule", category: "protobuf-risk" },
  { id: "spotify", source: "scratch/modules/spotify.module", category: "header+protobuf-risk" },
  { id: "amap-enhanced", source: "scratch/modules/Amap.lpx", category: "body-json+map-local" },
  { id: "coolapk", source: "scratch/modules/Coolapk.lpx", category: "script-gap" },
  { id: "xwebads", source: "scratch/modules/XWebAds.plugin", category: "script-gap" },
  { id: "httpdns", source: "scratch/wool_scripts/Loon/plugin/Block_HTTPDNS.plugin", category: "routing+complex-rule" },
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const [rawKey, inline] = item.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    args[key] = inline ?? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const fetchScripts = args.fetchScripts == null ? true : isTruthy(args.fetchScripts);
const externalRoot = args.externalRoot ? path.resolve(String(args.externalRoot)) : "";
const module2AnywhereBin = args.module2anywhereBin ? path.resolve(String(args.module2anywhereBin)) : "";
const module2AnywhereOut = args.module2anywhereOut
  ? path.resolve(String(args.module2anywhereOut))
  : path.join(root, "scratch/converter/out-module2anywhere");
const module2AnywhereFetchScripts = args.module2anywhereFetchScripts == null
  ? fetchScripts
  : isTruthy(args.module2anywhereFetchScripts);
const fetchText = createCachedFetchText(Number(args.maxScriptBytes || 1024 * 1024));
const report = {
  generatedAt: new Date().toISOString(),
  mode: args.mode || (fetchScripts ? "compat" : "safe"),
  externalRoot: externalRoot || null,
  externalTool: module2AnywhereBin
    ? {
        name: "module2anywhere",
        bin: module2AnywhereBin,
        out: module2AnywhereOut,
        fetchScripts: module2AnywhereFetchScripts,
      }
    : null,
  cases: [],
};

for (const item of cases) {
  const sourcePath = resolveRoot(item.source);
  if (!fs.existsSync(sourcePath)) {
    report.cases.push({ id: item.id, category: item.category, missing: true });
    continue;
  }
  const source = fs.readFileSync(sourcePath, "utf8");
  const result = await convertModuleAsync(source, withCaseFixtures({
    mode: args.mode,
    fetchScripts,
    maxScriptBytes: Number(args.maxScriptBytes || 1024 * 1024),
    maxTotalScriptBytes: Number(args.maxTotalScriptBytes || 5 * 1024 * 1024),
    fetchText,
  }, item.id));
  const ours = summarizeResult(result);
  const generatedExternal = module2AnywhereBin
    ? runModule2AnywhereForCase({
        bin: module2AnywhereBin,
        sourcePath,
        id: item.id,
        outRoot: module2AnywhereOut,
        fetchScripts: module2AnywhereFetchScripts,
        timeoutMs: Number(args.module2anywhereTimeoutMs || 120000),
      })
    : null;
  const externalFiles = generatedExternal
    ? generatedExternal.files
    : externalRoot
      ? collectExternalFilesForCase(externalRoot, item.id)
      : [];
  const external = externalFiles.length ? summarizeFiles(externalFiles) : null;
  report.cases.push({
    id: item.id,
    category: item.category,
    ours,
    external,
    externalRun: generatedExternal ? omitFiles(generatedExternal) : null,
    diff: external ? diffSummaries(ours, external) : null,
  });
}

report.summary = summarizeReport(report.cases);

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const markdown = renderMarkdown(report);
  if (args.write) {
    const target = path.resolve(args.write === true ? "docs/cross-check-report.md" : String(args.write));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, markdown, "utf8");
    console.log(`wrote ${target}`);
  } else {
    console.log(markdown);
  }
}

function resolveRoot(relPath) {
  return path.join(root, relPath);
}

function withCaseFixtures(options, id) {
  const caseItem = goldenCases.find((entry) => entry.id === id);
  const fixtures = {};
  for (const [url, relPath] of Object.entries(caseItem?.scriptFixtures || {})) {
    fixtures[url] = fs.readFileSync(resolveRoot(relPath), "utf8");
  }
  if (!Object.keys(fixtures).length) return options;
  return { ...options, scriptTextByURL: { ...(options.scriptTextByURL || {}), ...fixtures } };
}

function collectExternalFilesForCase(baseDir, id) {
  if (!fs.existsSync(baseDir)) return [];
  const direct = path.join(baseDir, id);
  if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) return collectRuleFiles(direct);
  return collectRuleFiles(baseDir).filter((file) => file.name.toLowerCase().includes(id.toLowerCase()) || file.path.toLowerCase().includes(`/${id.toLowerCase()}/`));
}

function runModule2AnywhereForCase({ bin, sourcePath, id, outRoot, fetchScripts, timeoutMs }) {
  const outDir = path.join(outRoot, id);
  if (!fs.existsSync(bin)) {
    return { ok: false, outDir, files: [], error: `module2anywhere bin not found: ${bin}` };
  }
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const cliArgs = [
    "-i",
    sourcePath,
    "-o",
    outDir,
    "-format",
    "both",
    "-no-metadata",
    `-fetch-scripts=${fetchScripts ? "true" : "false"}`,
  ];
  const run = spawnSync(bin, cliArgs, {
    cwd: root,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
  });
  const files = fs.existsSync(outDir) ? collectRuleFiles(outDir) : [];
  const stdout = trimForReport(run.stdout);
  const stderr = trimForReport(run.stderr);
  return {
    ok: run.status === 0 && !run.error,
    status: run.status,
    signal: run.signal,
    outDir,
    files,
    fileCount: files.length,
    error: run.error ? String(run.error.message || run.error) : "",
    stdout,
    stderr,
  };
}

function collectRuleFiles(dir) {
  const files = [];
  for (const file of walk(dir)) {
    if (!/\.(?:amrs|arrs)$/i.test(file)) continue;
    files.push({
      path: file,
      name: path.basename(file),
      type: typeFromName(file),
      content: fs.readFileSync(file, "utf8"),
    });
  }
  return files;
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function summarizeResult(result) {
  return {
    ...summarizeFiles(result.files),
    status: result.report.status,
    converted: result.report.converted,
    skipped: result.report.skipped,
    diagnostics: countBy(result.diagnostics, (item) => item.code || item.level || "unknown"),
  };
}

function summarizeFiles(files) {
  const summary = {
    fileCount: files.length,
    ruleCount: 0,
    hostnames: [],
    mitmRules: 0,
    routingRules: 0,
    ops: {},
    routingTypes: {},
    validationErrors: 0,
  };
  const hosts = new Set();
  for (const file of files) {
    summary.validationErrors += validateAnywhereOutput(file).filter((item) => item.level === "error").length;
    for (const rawLine of String(file.content || "").replace(/\r\n?/g, "\n").split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || line.startsWith("//")) continue;
      const header = parseHeader(line);
      if (header) {
        if (file.type === "amrs" && header.key === "hostname") {
          for (const host of header.value.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean)) hosts.add(host);
        }
        continue;
      }
      summary.ruleCount += 1;
      if (file.type === "amrs") {
        const fields = internals.parseCsv(line);
        if (fields.length < 3) continue;
        summary.mitmRules += 1;
        increment(summary.ops, `${Number(fields[0])}:${Number(fields[1])}`);
      } else if (file.type === "arrs") {
        const split = line.split(",", 2);
        if (split.length !== 2) continue;
        summary.routingRules += 1;
        increment(summary.routingTypes, String(Number(split[0].trim())));
      }
    }
  }
  summary.hostnames = [...hosts].sort();
  return summary;
}

function diffSummaries(ours, external) {
  const oursHosts = new Set(ours.hostnames);
  const externalHosts = new Set(external.hostnames);
  return {
    hostnamesOnlyInOurs: [...oursHosts].filter((host) => !externalHosts.has(host)),
    hostnamesOnlyInExternal: [...externalHosts].filter((host) => !oursHosts.has(host)),
    ruleDelta: ours.ruleCount - external.ruleCount,
    mitmRuleDelta: ours.mitmRules - external.mitmRules,
    routingRuleDelta: ours.routingRules - external.routingRules,
    opDelta: deltaCounts(ours.ops, external.ops),
    routingTypeDelta: deltaCounts(ours.routingTypes, external.routingTypes),
    validationErrorDelta: ours.validationErrors - external.validationErrors,
  };
}

function summarizeReport(rows) {
  const withExternal = rows.filter((row) => row.external).length;
  return {
    total: rows.length,
    withExternal,
    withoutExternal: rows.length - withExternal,
    oursValidationErrors: rows.reduce((sum, row) => sum + (row.ours?.validationErrors || 0), 0),
    externalValidationErrors: rows.reduce((sum, row) => sum + (row.external?.validationErrors || 0), 0),
    externalCommandErrors: rows.filter((row) => row.externalRun && !row.externalRun.ok).map((row) => row.id),
    sampleRequired: rows.filter((row) => row.ours?.status === "sample-required").map((row) => row.id),
  };
}

function renderMarkdown(data) {
  const lines = [];
  lines.push("# Converter Cross-Check Report");
  lines.push("");
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push(`Mode: ${data.mode}`);
  lines.push(`External root: ${data.externalRoot || "not provided"}`);
  if (data.externalTool) {
    lines.push(`External tool: ${data.externalTool.name}`);
    lines.push(`External tool fetch scripts: ${data.externalTool.fetchScripts ? "true" : "false"}`);
  }
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Cases: ${data.summary.total}`);
  lines.push(`- External cases matched: ${data.summary.withExternal}`);
  lines.push(`- Our validation errors: ${data.summary.oursValidationErrors}`);
  lines.push(`- External validation errors: ${data.summary.externalValidationErrors}`);
  lines.push(`- External command errors: ${data.summary.externalCommandErrors.join(", ") || "none"}`);
  lines.push(`- sample-required: ${data.summary.sampleRequired.join(", ") || "none"}`);
  lines.push("");
  lines.push("## Cases");
  lines.push("");
  lines.push("| id | category | ours status | ours rules | ours validation | external | rule delta | op delta | routing delta |");
  lines.push("| --- | --- | --- | ---: | ---: | --- | ---: | --- | --- |");
  for (const row of data.cases) {
    const external = row.external
      ? `${row.external.ruleCount} rules / ${row.external.validationErrors} errors`
      : row.externalRun && !row.externalRun.ok
        ? `run failed: ${shortError(row.externalRun)}`
        : "-";
    lines.push(`| ${row.id} | ${row.category} | ${row.ours?.status || "missing"} | ${row.ours?.ruleCount ?? 0} | ${row.ours?.validationErrors ?? "-"} | ${external} | ${row.diff?.ruleDelta ?? "-"} | ${jsonShort(row.diff?.opDelta)} | ${jsonShort(row.diff?.routingTypeDelta)} |`);
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- External converter output is a cross-check signal, not a source of conversion rules.");
  if (data.externalTool) {
    lines.push("- `--module2anywhere-bin` generated one external output folder per case before comparison; generated files are kept under `--module2anywhere-out` for manual inspection.");
  } else {
    lines.push("- `--module2anywhere-bin` can generate one external output folder per case before comparison; generated files are kept under `--module2anywhere-out` for manual inspection.");
  }
  lines.push("- A large delta is a review queue item: inspect whether it is caused by better coverage, unsupported semantics, or unsafe over-conversion.");
  if (!data.externalRoot && !data.externalTool) lines.push("- No external root means this report is our own structural baseline for M4 validation.");
  lines.push("");
  return lines.join("\n");
}

function omitFiles(run) {
  const { files: _files, ...rest } = run;
  return rest;
}

function trimForReport(text) {
  const value = String(text || "").trim();
  return value.length > 1200 ? `${value.slice(0, 1200)}...` : value;
}

function shortError(run) {
  return (run.error || run.stderr || `status ${run.status ?? "unknown"}`).replaceAll("|", "\\|");
}

function jsonShort(value) {
  if (!value) return "-";
  const text = JSON.stringify(value);
  return text === "{}" ? "-" : text.replaceAll("|", "\\|");
}

function parseHeader(line) {
  const equalIndex = line.indexOf("=");
  const commaIndex = line.indexOf(",");
  if (equalIndex < 0 || (commaIndex >= 0 && commaIndex < equalIndex)) return null;
  return { key: line.slice(0, equalIndex).trim().toLowerCase(), value: line.slice(equalIndex + 1).trim() };
}

function typeFromName(name) {
  if (/\.amrs$/i.test(name)) return "amrs";
  if (/\.arrs$/i.test(name)) return "arrs";
  return "unknown";
}

function countBy(items, keyFn) {
  const out = {};
  for (const item of items || []) increment(out, keyFn(item));
  return out;
}

function deltaCounts(left, right) {
  const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
  const out = {};
  for (const key of [...keys].sort()) {
    const delta = (left?.[key] || 0) - (right?.[key] || 0);
    if (delta) out[key] = delta;
  }
  return out;
}

function increment(object, key) {
  object[key] = (object[key] || 0) + 1;
}

function isTruthy(value) {
  return value === true || /^(?:1|true|yes)$/i.test(String(value || ""));
}

function createCachedFetchText(maxBytes) {
  const cache = new Map();
  return async function fetchText(rawUrl) {
    if (cache.has(rawUrl)) return cache.get(rawUrl);
    const response = await fetch(rawUrl, {
      headers: { "user-agent": "AnywhereModuleConverterCrossCheck/0.1" },
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (new TextEncoder().encode(text).length > maxBytes) throw new Error(`script exceeds ${maxBytes} bytes`);
    cache.set(rawUrl, text);
    return text;
  };
}
