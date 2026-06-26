#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { convertModuleAsync, internals, validateAnywhereOutput } from "./core.mjs";
import { goldenCases } from "./golden-cases.mjs";

const root = path.resolve(new URL("../..", import.meta.url).pathname);

function resolveRoot(rel) {
  return path.join(root, rel);
}

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

function fileType(filename) {
  if (filename.endsWith(".amrs")) return "amrs";
  if (filename.endsWith(".arrs")) return "arrs";
  return "unknown";
}

function semanticLines(content, type) {
  const lines = [];
  for (const raw of String(content).replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    if (line.includes("=")) {
      const [keyRaw, valueRaw] = line.split("=", 2);
      const key = keyRaw.trim().toLowerCase();
      if (type === "amrs" && key === "hostname") {
        for (const host of valueRaw.split(",").map((item) => item.trim()).filter(Boolean)) {
          lines.push(`hostname=${host.toLowerCase()}`);
        }
      }
      if (type === "arrs" && key === "routing") lines.push(`routing=${valueRaw.trim()}`);
      continue;
    }
    if (type === "amrs") {
      lines.push(internals.parseCsv(line).map((field, index) => index <= 1 ? String(Number(field)) : field).join("\u001f"));
    } else if (type === "arrs") {
      const split = line.split(",", 2);
      if (split.length === 2) lines.push(`${Number(split[0].trim())}\u001f${split[1].trim().toLowerCase()}`);
    }
  }
  return new Set(lines);
}

function collectExpected(caseItem) {
  const byType = { amrs: new Set(), arrs: new Set() };
  for (const expected of caseItem.expected) {
    const type = fileType(expected);
    const content = fs.readFileSync(resolveRoot(expected), "utf8");
    for (const line of semanticLines(content, type)) byType[type].add(line);
  }
  return byType;
}

function collectActual(result) {
  const byType = { amrs: new Set(), arrs: new Set() };
  for (const file of result.files) {
    for (const line of semanticLines(file.content, file.type)) byType[file.type].add(line);
  }
  return byType;
}

function diffSets(expected, actual) {
  const missing = [...expected].filter((line) => !actual.has(line));
  const extra = [...actual].filter((line) => !expected.has(line));
  if (expected.size === 0) {
    return {
      expected: 0,
      actual: actual.size,
      matched: 0,
      missing,
      extra,
      coverage: actual.size === 0 ? 1 : 0,
    };
  }
  const matched = expected.size - missing.length;
  return {
    expected: expected.size,
    actual: actual.size,
    matched,
    missing,
    extra,
    coverage: matched / expected.size,
  };
}

const args = parseArgs(process.argv.slice(2));
const includeSkipped = args.includeSkipped === true || args.includeSkipped === "1" || args.includeSkipped === "true";
const selected = args.case ? new Set(String(args.case).split(",").map((item) => item.trim())) : null;
const rows = [];

for (const caseItem of goldenCases) {
  if (selected && !selected.has(caseItem.id)) continue;
  if (caseItem.skipReason && !includeSkipped) {
    rows.push({ id: caseItem.id, skipped: true, reason: caseItem.skipReason });
    continue;
  }
  const source = fs.readFileSync(resolveRoot(caseItem.source), "utf8");
  const result = await convertModuleAsync(source, {
    fetchScripts: true,
    scriptTextByURL: loadScriptFixtures(caseItem),
  });
  const expected = collectExpected(caseItem);
  const actual = collectActual(result);
  const amrs = diffSets(expected.amrs, actual.amrs);
  const arrs = diffSets(expected.arrs, actual.arrs);
  const validation = result.files.flatMap((file) => validateAnywhereOutput(file).map((diagnostic) => ({ file: file.name, ...diagnostic })));
  rows.push({
    id: caseItem.id,
    status: result.report.status,
    converted: result.report.converted,
    skipped: result.report.skipped,
    amrs,
    arrs,
    validationErrors: validation.filter((item) => item.level === "error").length,
  });
}

if (args.json) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  for (const row of rows) {
    if (row.skipped === true) {
      console.log(`${row.id}: skipped (${row.reason})`);
      continue;
    }
    console.log(`${row.id}: status=${row.status} converted=${row.converted} skipped=${row.skipped} amrs=${pct(row.amrs.coverage)} arrs=${pct(row.arrs.coverage)} validationErrors=${row.validationErrors}`);
    if (args.verbose) {
      console.log(`  amrs missing ${row.amrs.missing.length}, extra ${row.amrs.extra.length}`);
      console.log(row.amrs.missing.slice(0, 6).map((line) => `    - ${line}`).join("\n"));
      console.log(`  arrs missing ${row.arrs.missing.length}, extra ${row.arrs.extra.length}`);
      console.log(row.arrs.missing.slice(0, 6).map((line) => `    - ${line}`).join("\n"));
    }
  }
}

function pct(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function loadScriptFixtures(caseItem) {
  const out = {};
  for (const [url, relPath] of Object.entries(caseItem.scriptFixtures || {})) {
    out[url] = fs.readFileSync(resolveRoot(relPath), "utf8");
  }
  return out;
}
