#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { convertModuleAsync, internals, validateAnywhereOutput } from "./core.mjs";
import { goldenCases } from "./golden-cases.mjs";

const root = path.resolve(new URL("../..", import.meta.url).pathname);

const matrixCases = [
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

function resolveRoot(rel) {
  return path.join(root, rel);
}

async function runMatrix(options) {
  const rows = [];
  for (const item of matrixCases) {
    const sourcePath = resolveRoot(item.source);
    if (!fs.existsSync(sourcePath)) {
      rows.push({ ...item, missing: true });
      continue;
    }
    const source = fs.readFileSync(sourcePath, "utf8");
    const result = await convertModuleAsync(source, withCaseFixtures(options, item.id));
    const validationErrors = result.files
      .flatMap((file) => validateAnywhereOutput(file))
      .filter((diagnostic) => diagnostic.level === "error")
      .length;
    rows.push({
      ...item,
      status: result.report.status,
      converted: result.report.converted,
      skipped: result.report.skipped,
      files: result.files.length,
      amrs: result.files.filter((file) => file.type === "amrs").length,
      arrs: result.files.filter((file) => file.type === "arrs").length,
      rules: result.files.reduce((sum, file) => sum + file.ruleCount, 0),
      validationErrors,
      diagnostics: result.report.diagnostics,
      sampleReasons: sampleRequiredReasons(result.diagnostics),
    });
  }
  return rows;
}

async function runGolden(options) {
  const rows = [];
  for (const item of goldenCases) {
    const source = fs.readFileSync(resolveRoot(item.source), "utf8");
    const result = await convertModuleAsync(source, withCaseFixtures(options, item.id));
    const expected = collectExpected(item);
    const actual = collectActual(result);
    const amrs = diffSets(expected.amrs, actual.amrs);
    const arrs = diffSets(expected.arrs, actual.arrs);
    const validationErrors = result.files
      .flatMap((file) => validateAnywhereOutput(file))
      .filter((diagnostic) => diagnostic.level === "error")
      .length;
    rows.push({
      id: item.id,
      status: result.report.status,
      converted: result.report.converted,
      skipped: result.report.skipped,
      skippedByDefault: Boolean(item.skipReason),
      skipReason: item.skipReason || "",
      amrsCoverage: amrs.coverage,
      arrsCoverage: arrs.coverage,
      amrsExpected: amrs.expected,
      amrsActual: amrs.actual,
      amrsMissing: amrs.missing.length,
      amrsExtra: amrs.extra.length,
      arrsExpected: arrs.expected,
      arrsActual: arrs.actual,
      arrsMissing: arrs.missing.length,
      arrsExtra: arrs.extra.length,
      validationErrors,
      sampleReasons: sampleRequiredReasons(result.diagnostics),
    });
  }
  return rows;
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
        for (const host of valueRaw.split(",").map((entry) => entry.trim()).filter(Boolean)) {
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

function collectExpected(item) {
  const out = { amrs: new Set(), arrs: new Set() };
  for (const expected of item.expected) {
    const type = fileType(expected);
    const content = fs.readFileSync(resolveRoot(expected), "utf8");
    for (const line of semanticLines(content, type)) out[type].add(line);
  }
  return out;
}

function collectActual(result) {
  const out = { amrs: new Set(), arrs: new Set() };
  for (const file of result.files) {
    for (const line of semanticLines(file.content, file.type)) out[file.type].add(line);
  }
  return out;
}

function diffSets(expected, actual) {
  const missing = [...expected].filter((line) => !actual.has(line));
  const extra = [...actual].filter((line) => !expected.has(line));
  if (expected.size === 0) {
    return {
      expected: 0,
      actual: actual.size,
      matched: actual.size === 0 ? 0 : -extra.length,
      missing,
      extra,
      coverage: actual.size === 0 ? 1 : 0,
    };
  }
  const denominator = Math.max(expected.size, 1);
  return {
    expected: expected.size,
    actual: actual.size,
    matched: expected.size - missing.length,
    missing,
    extra,
    coverage: (expected.size - missing.length) / denominator,
  };
}

function summarize(matrix, golden) {
  return {
    generatedAt: new Date().toISOString(),
    matrix: {
      total: matrix.length,
      byStatus: countBy(matrix, (row) => row.status || "missing"),
      validationErrors: matrix.reduce((sum, row) => sum + (row.validationErrors || 0), 0),
      sampleRequired: matrix.filter((row) => row.status === "sample-required").map((row) => ({
        id: row.id,
        reasons: row.sampleReasons || [],
      })),
    },
    golden: {
      total: golden.length,
      defaultTracked: golden.filter((row) => !row.skippedByDefault).length,
      defaultFullCoverage: golden.filter((row) => !row.skippedByDefault && row.amrsCoverage === 1 && row.arrsCoverage === 1).length,
      skippedTracked: golden.filter((row) => row.skippedByDefault).length,
      skippedCoverage: golden.filter((row) => row.skippedByDefault).map((row) => ({
        id: row.id,
        amrs: row.amrsCoverage,
        arrs: row.arrsCoverage,
      })),
      validationErrors: golden.reduce((sum, row) => sum + row.validationErrors, 0),
    },
  };
}

function sampleRequiredReasons(diagnostics) {
  const seen = new Set();
  const out = [];
  for (const diagnostic of diagnostics || []) {
    if (!isSampleRequiredDiagnostic(diagnostic)) continue;
    const key = diagnostic.code || diagnostic.message;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      code: diagnostic.code || "sample-required",
      message: diagnostic.message || "",
      line: diagnostic.line || 0,
    });
  }
  return out;
}

function withCaseFixtures(options, id) {
  const caseItem = goldenCases.find((item) => item.id === id);
  const fixtures = loadScriptFixtures(caseItem);
  if (!Object.keys(fixtures).length) return options;
  return {
    ...options,
    scriptTextByURL: {
      ...(options.scriptTextByURL || {}),
      ...fixtures,
    },
  };
}

function loadScriptFixtures(caseItem) {
  const out = {};
  for (const [url, relPath] of Object.entries(caseItem?.scriptFixtures || {})) {
    out[url] = fs.readFileSync(resolveRoot(relPath), "utf8");
  }
  return out;
}

function isSampleRequiredDiagnostic(diagnostic) {
  const code = diagnostic?.code || "";
  return code === "sample-required-pattern" || /sample-required/.test(code);
}

function countBy(items, keyFn) {
  const out = {};
  for (const item of items) {
    const key = keyFn(item);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# Converter Progress Report");
  lines.push("");
  lines.push(`Generated: ${report.summary.generatedAt}`);
  lines.push(`Mode: ${report.mode}${report.fetchScripts ? " (fetch scripts enabled)" : ""}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Matrix cases: ${report.summary.matrix.total}`);
  lines.push(`- Matrix status: ${Object.entries(report.summary.matrix.byStatus).map(([key, value]) => `${key}=${value}`).join(", ")}`);
  lines.push(`- Matrix validation errors: ${report.summary.matrix.validationErrors}`);
  lines.push(`- Matrix sample-required cases: ${report.summary.matrix.sampleRequired.length}`);
  lines.push(`- Golden default coverage: ${report.summary.golden.defaultFullCoverage}/${report.summary.golden.defaultTracked}`);
  lines.push(`- Golden skipped cases tracked: ${report.summary.golden.skippedTracked}`);
  lines.push(`- Golden validation errors: ${report.summary.golden.validationErrors}`);
  lines.push("");
  lines.push("## Conversion Matrix");
  lines.push("");
  lines.push("| id | category | status | converted | skipped | files | rules | validation |");
  lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |");
  for (const row of report.matrix) {
    lines.push(`| ${row.id} | ${row.category} | ${row.status || "missing"} | ${row.converted ?? 0} | ${row.skipped ?? 0} | ${row.files ?? 0} | ${row.rules ?? 0} | ${row.validationErrors ?? "-"} |`);
  }
  if (report.summary.matrix.sampleRequired.length) {
    lines.push("");
    lines.push("## Sample Required");
    lines.push("");
    lines.push("| id | reasons |");
    lines.push("| --- | --- |");
    for (const row of report.summary.matrix.sampleRequired) {
      const reasons = row.reasons.length
        ? row.reasons.map((item) => item.code).join(", ")
        : "sample-required";
      lines.push(`| ${row.id} | ${reasons} |`);
    }
  }
  lines.push("");
  lines.push("## Golden Coverage");
  lines.push("");
  lines.push("| id | tracked by default | status | amrs | arrs | missing | extra | validation |");
  lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |");
  for (const row of report.golden) {
    lines.push(`| ${row.id} | ${row.skippedByDefault ? "no" : "yes"} | ${row.status} | ${pct(row.amrsCoverage)} | ${pct(row.arrsCoverage)} | ${row.amrsMissing + row.arrsMissing} | ${row.amrsExtra + row.arrsExtra} | ${row.validationErrors} |`);
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- Hand-converted outputs are validation oracles, not generation templates.");
  lines.push("- Skipped golden cases are still measured here so we can see whether generic conversion is improving.");
  lines.push("- Compat mode is the default path and fetches remote scripts; explicit safe mode is only for offline/native diagnostics.");
  lines.push("- sample-required means rules were emitted, but protobuf/binary/high-frequency behavior needs real request/response samples or device validation.");
  lines.push("- Protobuf field-level rewrites are intentionally outside the generic converter scope.");
  lines.push("");
  return lines.join("\n");
}

function pct(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

const args = parseArgs(process.argv.slice(2));
const fetchScripts = isTruthy(args.safe) ? false : args.fetchScripts == null ? true : isTruthy(args.fetchScripts);
const fetchText = createCachedFetchText(Number(args.maxScriptBytes || 1024 * 1024));
const convertOptions = {
  mode: args.mode,
  fetchScripts,
  maxScriptBytes: Number(args.maxScriptBytes || 1024 * 1024),
  fetchText,
};
const matrix = await runMatrix(convertOptions);
const golden = await runGolden(convertOptions);
const report = {
  mode: args.mode || (fetchScripts ? "compat" : "safe"),
  fetchScripts,
  summary: summarize(matrix, golden),
  matrix,
  golden,
};

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const markdown = renderMarkdown(report);
  if (args.write) {
    const target = path.resolve(args.write === true ? "docs/progress-report.md" : String(args.write));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, markdown, "utf8");
    console.log(`wrote ${target}`);
  } else {
    console.log(markdown);
  }
}

function isTruthy(value) {
  return value === true || value === "1" || value === "true" || value === "yes";
}

function createCachedFetchText(maxBytes) {
  const cache = new Map();
  return async function fetchText(rawUrl) {
    if (cache.has(rawUrl)) return cache.get(rawUrl);
    assertPublicHttpURL(rawUrl);
    const response = await fetch(rawUrl, {
      headers: { "user-agent": "AnywhereModuleConverterProgress/0.1" },
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const length = Number(response.headers.get("content-length") || "0");
    if (length > maxBytes) throw new Error(`script exceeds ${maxBytes} bytes`);
    const text = await response.text();
    if (new TextEncoder().encode(text).length > maxBytes) throw new Error(`script exceeds ${maxBytes} bytes`);
    cache.set(rawUrl, text);
    return text;
  };
}

function assertPublicHttpURL(rawUrl) {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("only http/https script URLs are allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw new Error("local script URL is blocked");
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1, 3).map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) throw new Error("private script URL is blocked");
    if (a === 100 && b >= 64 && b <= 127) throw new Error("private script URL is blocked");
    if (a === 169 && b === 254) throw new Error("private script URL is blocked");
    if (a === 172 && b >= 16 && b <= 31) throw new Error("private script URL is blocked");
    if (a === 192 && b === 168) throw new Error("private script URL is blocked");
  }
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) throw new Error("private script URL is blocked");
}
