#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { convertModuleAsync, internals, validateAnywhereOutput } from "./core.mjs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (!item.startsWith("--")) {
      args._ = [...(args._ || []), item];
      continue;
    }
    const [rawKey, inline] = item.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    args[key] = inline ?? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true);
  }
  return args;
}

function usage() {
  console.error("Usage: node compare-external.mjs --input <module> [--external-dir <dir>] [--external-files a.amrs,b.arrs] [--json]");
}

const args = parseArgs(process.argv.slice(2));
const input = args.input || args._?.[0];
if (!input) {
  usage();
  process.exit(2);
}

const source = fs.readFileSync(input, "utf8");
const ours = await convertModuleAsync(source, {
  mode: args.mode,
  fetchScripts: isTruthy(args.fetchScripts),
  maxScriptBytes: Number(args.maxScriptBytes || 1024 * 1024),
  fetchText: async (url, options = {}) => {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const maxBytes = options.maxBytes || 1024 * 1024;
    if (new TextEncoder().encode(text).length > maxBytes) throw new Error(`script exceeds ${maxBytes} bytes`);
    return text;
  },
});

const externalFiles = collectExternalFiles(args);
const report = {
  input,
  ours: summarizeResult(ours),
  external: externalFiles.length ? summarizeFiles(externalFiles) : null,
};
if (report.external) report.diff = diffSummaries(report.ours, report.external);

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printSummary(report);
}

function collectExternalFiles(options) {
  const files = [];
  if (options.externalDir) {
    for (const file of walk(options.externalDir)) {
      if (/\.(?:amrs|arrs)$/i.test(file)) {
        files.push({ name: path.basename(file), type: typeFromName(file), content: fs.readFileSync(file, "utf8") });
      }
    }
  }
  if (options.externalFiles) {
    for (const file of String(options.externalFiles).split(",").map((item) => item.trim()).filter(Boolean)) {
      files.push({ name: path.basename(file), type: typeFromName(file), content: fs.readFileSync(file, "utf8") });
    }
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
  const summary = summarizeFiles(result.files);
  summary.status = result.report.status;
  summary.converted = result.report.converted;
  summary.skipped = result.report.skipped;
  summary.diagnostics = countBy(result.diagnostics, (item) => item.code || item.level || "unknown");
  return summary;
}

function summarizeFiles(files) {
  const summary = {
    fileCount: files.length,
    files: files.map((file) => ({ name: file.name, type: file.type, ruleCount: countRules(file) })),
    hostnames: [],
    mitmRules: 0,
    routingRules: 0,
    ops: {},
    routingTypes: {},
    generatedRespondScripts: 0,
    validationErrors: 0,
  };
  const hosts = new Set();

  for (const file of files) {
    const validation = validateAnywhereOutput(file);
    summary.validationErrors += validation.filter((item) => item.level === "error").length;
    for (const rawLine of String(file.content || "").replace(/\r\n?/g, "\n").split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || line.startsWith("//")) continue;
      const header = parseHeader(line);
      if (header) {
        if (file.type === "amrs" && header.key === "hostname") {
          for (const host of header.value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean)) hosts.add(host);
        }
        continue;
      }
      if (file.type === "amrs") {
        const fields = internals.parseCsv(line);
        if (fields.length < 3) continue;
        summary.mitmRules += 1;
        increment(summary.ops, `${Number(fields[0])}:${Number(fields[1])}`);
        if (Number(fields[1]) === 100) {
          const script = decodeBase64(fields[3] || "");
          if (/Anywhere\.respond\s*\(/.test(script)) summary.generatedRespondScripts += 1;
        }
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

function countRules(file) {
  return String(file.content || "").replace(/\r\n?/g, "\n").split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("//") && !parseHeader(line))
    .length;
}

function diffSummaries(ours, external) {
  const oursHosts = new Set(ours.hostnames);
  const externalHosts = new Set(external.hostnames);
  return {
    hostnamesOnlyInOurs: [...oursHosts].filter((host) => !externalHosts.has(host)),
    hostnamesOnlyInExternal: [...externalHosts].filter((host) => !oursHosts.has(host)),
    mitmRuleDelta: ours.mitmRules - external.mitmRules,
    routingRuleDelta: ours.routingRules - external.routingRules,
    opDelta: deltaCounts(ours.ops, external.ops),
    routingTypeDelta: deltaCounts(ours.routingTypes, external.routingTypes),
    validationErrorDelta: ours.validationErrors - external.validationErrors,
  };
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

function decodeBase64(value) {
  try {
    if (typeof atob === "function") return atob(value);
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function isTruthy(value) {
  return /^(?:1|true|yes)$/i.test(String(value || ""));
}

function printSummary(report) {
  console.log(`input: ${report.input}`);
  printOne("ours", report.ours);
  if (!report.external) {
    console.log("external: not provided");
    return;
  }
  printOne("external", report.external);
  console.log("diff:");
  console.log(`  hostnames only in ours: ${report.diff.hostnamesOnlyInOurs.length}`);
  console.log(`  hostnames only in external: ${report.diff.hostnamesOnlyInExternal.length}`);
  console.log(`  mitm rule delta: ${report.diff.mitmRuleDelta}`);
  console.log(`  routing rule delta: ${report.diff.routingRuleDelta}`);
  console.log(`  op delta: ${JSON.stringify(report.diff.opDelta)}`);
  console.log(`  routing type delta: ${JSON.stringify(report.diff.routingTypeDelta)}`);
  console.log(`  validation error delta: ${report.diff.validationErrorDelta}`);
}

function printOne(label, summary) {
  console.log(`${label}: status=${summary.status || "-"} files=${summary.fileCount} hosts=${summary.hostnames.length} mitm=${summary.mitmRules} routing=${summary.routingRules} validationErrors=${summary.validationErrors}`);
  console.log(`  ops: ${JSON.stringify(summary.ops)}`);
  console.log(`  routingTypes: ${JSON.stringify(summary.routingTypes)}`);
  if (summary.generatedRespondScripts) console.log(`  generated respond scripts: ${summary.generatedRespondScripts}`);
}
