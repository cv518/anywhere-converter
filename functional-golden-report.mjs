#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { convertModuleAsync, internals, validateAnywhereOutput } from "./core.mjs";

const root = path.resolve(new URL("../..", import.meta.url).pathname);

const cases = [
  {
    id: "pinduoduo",
    category: "native",
    source: "scratch/modules/Pinduoduo.lpx",
    expected: ["scratch/.gist-77e4c94/Pinduoduo_AD_Anywhere.amrs"],
  },
  {
    id: "hupu",
    category: "native+routing",
    source: "scratch/modules/Hupu.lpx",
    expected: ["scratch/.gist-77e4c94/Hupu_AD_Anywhere.amrs", "scratch/.gist-77e4c94/Hupu_Reject.arrs"],
  },
  {
    id: "autonavi",
    category: "native+routing",
    source: "scratch/modules/AutoNavi.lpx",
    expected: ["scratch/.gist-77e4c94/AutoNavi_AD_Anywhere.amrs", "scratch/.gist-77e4c94/AutoNavi_Reject.arrs"],
  },
  {
    id: "pixiv",
    category: "body-json+routing",
    source: "scratch/modules/Pixiv.lpx",
    expected: ["scratch/.gist-77e4c94/Pixiv_AD_Anywhere.amrs", "scratch/.gist-77e4c94/Pixiv_Reject.arrs"],
  },
  {
    id: "fanqienovel",
    category: "native+routing",
    source: "scratch/modules/FanQieNovel.lpx",
    expected: ["scratch/.gist-77e4c94/FanQieNovel_AD_Anywhere.amrs", "scratch/.gist-77e4c94/FanQieNovel_Reject.arrs"],
  },
  {
    id: "bank",
    category: "map-local+respond",
    source: "scratch/modules/Bank.module",
    expected: ["scratch/.gist-77e4c94/Bank_AD_Anywhere.amrs", "scratch/.gist-77e4c94/Bank_Reject.arrs"],
  },
  {
    id: "ximalaya",
    category: "native+body-json+script",
    source: "scratch/modules/Ximalaya.lpx",
    expected: ["scratch/.gist-77e4c94/Ximalaya_AD_Anywhere.amrs", "scratch/.gist-77e4c94/Ximalaya_Reject.arrs"],
  },
  {
    id: "smzdm",
    category: "script-dispatcher",
    source: "scratch/modules/SMZDM.lpx",
    expected: ["scratch/.gist-77e4c94/SMZDM_AD_Anywhere.amrs", "scratch/.gist-77e4c94/SMZDM_Reject.arrs"],
    scriptFixtures: {
      "https://raw.githubusercontent.com/fmz200/wool_scripts/main/Scripts/smzdm/smzdm_ads.js": "scratch/scripts/smzdm_ads.js",
      "https://raw.githubusercontent.com/fmz200/wool_scripts/main/Scripts/smzdm/Smzdm.js": "scratch/scripts/smzdm.js",
    },
  },
  {
    id: "amap-enhanced",
    category: "body-json+map-local",
    source: "scratch/modules/Amap.lpx",
    expected: ["scratch/.gist-77e4c94/Amap_AD_Enhanced_Anywhere.amrs", "scratch/.gist-77e4c94/Amap_Enhanced_Reject.arrs"],
    evaluation: "source-recovery",
    scriptFixtures: {
      "https://kelee.one/Resource/JavaScript/Amap/Amap_remove_ads.js": "scratch/scripts/amap.js",
    },
  },
  {
    id: "coolapk",
    category: "script-json",
    source: "scratch/modules/Coolapk.lpx",
    expected: ["scratch/.gist-77e4c94/Coolapk_AD_Anywhere.amrs"],
  },
  {
    id: "xwebads",
    category: "script-json",
    source: "scratch/modules/XWebAds.plugin",
    expected: ["scratch/.gist-77e4c94/X_AD_Anywhere.amrs"],
  },
  {
    id: "xiaohongshu",
    category: "script-json+routing",
    source: "scratch/modules/Xiaohongshu.lpx",
    expected: ["scratch/.gist-77e4c94/Xiaohongshu_AD_Anywhere.amrs", "scratch/.gist-77e4c94/Xiaohongshu_Reject.arrs"],
  },
  {
    id: "weibo",
    category: "mixed-script",
    source: "scratch/modules/weibo.plugin",
    expected: ["scratch/.gist-77e4c94/Weibo_Anywhere.amrs", "scratch/.gist-77e4c94/Weibo_Reject.arrs"],
    evaluation: "classic-mixed-script",
  },
  {
    id: "neteasecloudmusic",
    category: "binary-script",
    source: "scratch/modules/NetEaseCloudMusic.lpx",
    expected: ["scratch/.gist-77e4c94/NetEaseCloudMusic_AD_Anywhere.amrs", "scratch/.gist-77e4c94/NetEaseCloudMusic_Reject.arrs"],
    evaluation: "classic-mixed-script",
  },
  {
    id: "spotify",
    category: "protobuf-script",
    source: "scratch/modules/spotify.module",
    expected: ["scratch/.gist-77e4c94/Spotify_Unlock_Anywhere.amrs"],
    evaluation: "unlock-script",
  },
  {
    id: "iringo-maps",
    category: "bundle-script",
    source: "scratch/modules/iringo-maps/iRingo.Maps.plugin",
    expected: ["scratch/.gist-77e4c94/iRingo_Maps_Anywhere.amrs", "scratch/.gist-77e4c94/iRingo_Maps_Direct.arrs"],
  },
  {
    id: "weatherkit",
    category: "bundle-script",
    source: "scratch/modules/iRingo.WeatherKit.plugin",
    expected: ["scratch/.gist-77e4c94/iRingo_WeatherKit_Anywhere.amrs", "scratch/.gist-77e4c94/iRingo_WeatherKit_Reject.arrs"],
  },
  {
    id: "jd-price",
    category: "script+routing",
    source: "scratch/modules/jd_price.plugin",
    expected: ["scratch/.gist-77e4c94/JD_Price_Anywhere.amrs", "scratch/.gist-77e4c94/JD_Reject.arrs"],
  },
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
const selected = args.case ? new Set(String(args.case).split(",").map((item) => item.trim())) : null;
const fetchText = createCachedFetchText(Number(args.maxScriptBytes || 1024 * 1024));
const rows = [];

for (const item of cases) {
  if (selected && !selected.has(item.id)) continue;
  const sourcePath = resolveRoot(item.source);
  if (!fs.existsSync(sourcePath)) {
    rows.push({ id: item.id, category: item.category, missing: true });
    continue;
  }
  const result = await convertModuleAsync(fs.readFileSync(sourcePath, "utf8"), {
    fetchScripts: true,
    maxScriptBytes: Number(args.maxScriptBytes || 1024 * 1024),
    maxTotalScriptBytes: Number(args.maxTotalScriptBytes || 5 * 1024 * 1024),
    fetchText,
    scriptTextByURL: loadScriptFixtures(item),
  });
  const expected = collectExpected(item);
  const actual = collectActual(result);
  const strictAmrs = diffSets(expected.semantic.amrs, actual.semantic.amrs);
  const strictArrs = diffSets(expected.semantic.arrs, actual.semantic.arrs);
  const behavior = diffMultiset(expected.behavior, actual.behavior);
  const validationErrors = result.files.flatMap((file) => validateAnywhereOutput(file)).filter((diagnostic) => diagnostic.level === "error").length;
  const sampleReasons = sampleRequiredReasons(result.diagnostics);
  rows.push({
    id: item.id,
    category: item.category,
    status: result.report.status,
    converted: result.report.converted,
    skipped: result.report.skipped,
    validationErrors,
    sampleReasons,
    strictAmrs,
    strictArrs,
    behavior,
    evaluation: item.evaluation || "",
    verdict: verdict({ result, validationErrors, sampleReasons, strictArrs, behavior }),
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  summary: summarize(rows),
  cases: rows,
};

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const markdown = renderMarkdown(report);
  if (args.write) {
    const target = path.resolve(args.write === true ? "docs/functional-golden-report.md" : String(args.write));
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

function loadScriptFixtures(item) {
  const out = {};
  for (const [url, relPath] of Object.entries(item.scriptFixtures || {})) out[url] = fs.readFileSync(resolveRoot(relPath), "utf8");
  return out;
}

function collectExpected(item) {
  return collectFiles(item.expected.map((relPath) => ({
    type: fileType(relPath),
    content: fs.readFileSync(resolveRoot(relPath), "utf8"),
  })));
}

function collectActual(result) {
  return collectFiles(result.files);
}

function collectFiles(files) {
  const semantic = { amrs: new Set(), arrs: new Set() };
  const behavior = new Map();
  for (const file of files) {
    const type = file.type || fileType(file.name || "");
    for (const line of normalizedLines(file.content, type)) {
      semantic[type]?.add(line.semantic);
      if (line.behavior) increment(behavior, line.behavior);
    }
  }
  return { semantic, behavior };
}

function normalizedLines(content, type) {
  const lines = [];
  for (const raw of String(content || "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    const header = parseHeader(line);
    if (header) {
      if (type === "amrs" && header.key === "hostname") {
        for (const host of header.value.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean)) {
          lines.push({ semantic: `hostname=${host}`, behavior: `host:${host}` });
        }
      }
      if (type === "arrs" && header.key === "routing") lines.push({ semantic: `routing=${header.value.trim()}`, behavior: `routing-target:${header.value.trim()}` });
      continue;
    }
    if (type === "amrs") {
      const fields = internals.parseCsv(line);
      if (fields.length < 3) continue;
      const phase = String(Number(fields[0]));
      const op = String(Number(fields[1]));
      const semantic = fields.map((field, index) => index <= 1 ? String(Number(field)) : field).join("\u001f");
      lines.push({ semantic, behavior: amrsBehaviorSignature(phase, op, fields.slice(3)) });
    } else if (type === "arrs") {
      const split = line.split(",", 2);
      if (split.length !== 2) continue;
      const semantic = `${Number(split[0].trim())}\u001f${split[1].trim().toLowerCase()}`;
      lines.push({ semantic, behavior: semantic });
    }
  }
  return lines;
}

function amrsBehaviorSignature(phase, op, fields) {
  if (op === "0") return `${phase}:rewrite:${fields[0] || ""}:${fields[1] || ""}`;
  if (op === "1" || op === "2" || op === "3") return `${phase}:header:${op}:${String(fields[0] || "").toLowerCase()}:${fields[1] || ""}`;
  if (op === "4") return `${phase}:body-replace:${fields[0] || ""}:${fields[1] || ""}`;
  if (op === "5") return `${phase}:body-json:${fields.join(":")}`;
  if (op === "100" || op === "101") return `${phase}:script:${classifyScript(fields[0] || "")}`;
  return `${phase}:${op}:${fields.join(":")}`;
}

function classifyScript(encoded) {
  const script = decodeBase64(encoded);
  const wrappedSource = extractCompatWrappedSource(script);
  if (wrappedSource) {
    if (/JSON\.parse|JSON\.stringify|\$response\.body|\bbody\s*=/.test(wrappedSource)) return "json-transform";
    return "compat-wrapper";
  }
  if (/Anywhere\.respond\s*\(/.test(script) && /status:\s*302/.test(script)) return "respond-302";
  if (/Anywhere\.respond\s*\(/.test(script)) return "respond";
  if (/JSON\.parse|JSON\.stringify|\$response\.body|\bbody\s*=/.test(script)) return "json-transform";
  if (/__source\s*=|new Function\(/.test(script)) return "compat-wrapper";
  return "custom";
}

function extractCompatWrappedSource(script) {
  const match = String(script || "").match(/__source\s*=\s*Anywhere\.codec\.utf8\.decode\s*\(\s*Anywhere\.codec\.base64\.decode\s*\(\s*"([A-Za-z0-9+/=]+)"\s*\)/);
  return match ? decodeBase64(match[1]) : "";
}

function diffSets(expected, actual) {
  const missing = [...expected].filter((line) => !actual.has(line));
  const extra = [...actual].filter((line) => !expected.has(line));
  const matched = expected.size - missing.length;
  return {
    expected: expected.size,
    actual: actual.size,
    matched,
    missing: missing.length,
    extra: extra.length,
    coverage: expected.size ? matched / expected.size : actual.size ? 0 : 1,
  };
}

function diffMultiset(expected, actual) {
  let expectedTotal = 0;
  let matched = 0;
  const missing = {};
  for (const [key, count] of expected.entries()) {
    expectedTotal += count;
    const got = actual.get(key) || 0;
    matched += Math.min(count, got);
    if (got < count) missing[key] = count - got;
  }
  let actualTotal = 0;
  let extraTotal = 0;
  for (const [key, count] of actual.entries()) {
    actualTotal += count;
    const exp = expected.get(key) || 0;
    if (count > exp) extraTotal += count - exp;
  }
  return {
    expected: expectedTotal,
    actual: actualTotal,
    matched,
    missing: expectedTotal - matched,
    extra: extraTotal,
    coverage: expectedTotal ? matched / expectedTotal : actualTotal ? 0 : 1,
    missingTop: Object.entries(missing).sort((a, b) => b[1] - a[1]).slice(0, 6),
  };
}

function verdict({ result, validationErrors, sampleReasons, strictArrs, behavior }) {
  if (validationErrors > 0) return "invalid";
  if (sampleReasons.length || result.report.status === "sample-required") return "sample-required";
  if (result.report.skipped > 0) return "partial";
  if (strictArrs.coverage < 1) return "partial";
  if (behavior.coverage >= 0.95) return "equivalent";
  if (behavior.coverage >= 0.8) return "likely-equivalent";
  return "usable-gap";
}

function summarize(rows) {
  const evaluationRows = rows.filter((row) => row.evaluation);
  return {
    total: rows.length,
    byVerdict: countBy(rows, (row) => row.verdict || "missing"),
    validationErrors: rows.reduce((sum, row) => sum + (row.validationErrors || 0), 0),
    strictEquivalent: rows.filter((row) => row.strictAmrs?.coverage === 1 && row.strictArrs?.coverage === 1).length,
    functionalEquivalent: rows.filter((row) => row.verdict === "equivalent" || row.verdict === "likely-equivalent").length,
    evaluation: {
      total: evaluationRows.length,
      byEvaluation: countBy(evaluationRows, (row) => row.evaluation || "unknown"),
      averageBehaviorCoverage: average(evaluationRows.map((row) => row.behavior?.coverage).filter((value) => typeof value === "number")),
      sampleRequired: evaluationRows.filter((row) => row.verdict === "sample-required").map((row) => row.id),
    },
  };
}

function renderMarkdown(data) {
  const lines = [];
  lines.push("# Functional Golden Report");
  lines.push("");
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Cases: ${data.summary.total}`);
  lines.push(`- Verdicts: ${Object.entries(data.summary.byVerdict).map(([key, value]) => `${key}=${value}`).join(", ")}`);
  lines.push(`- Validation errors: ${data.summary.validationErrors}`);
  lines.push(`- Strict exact equivalent: ${data.summary.strictEquivalent}`);
  lines.push(`- Functional equivalent or likely-equivalent: ${data.summary.functionalEquivalent}`);
  lines.push(`- Evaluation metrics: ${data.summary.evaluation.total} cases, avg behavior ${pct(data.summary.evaluation.averageBehaviorCoverage)}, sample-required ${data.summary.evaluation.sampleRequired.join(", ") || "none"}`);
  lines.push("");
  lines.push("## Cases");
  lines.push("");
  lines.push("| id | category | status | verdict | strict AMRS | strict ARRS | behavior | missing behavior |");
  lines.push("| --- | --- | --- | --- | ---: | ---: | ---: | --- |");
  for (const row of data.cases) {
    lines.push(`| ${row.id} | ${row.category} | ${row.status || "-"} | ${row.verdict || "missing"} | ${pct(row.strictAmrs?.coverage)} | ${pct(row.strictArrs?.coverage)} | ${pct(row.behavior?.coverage)} | ${formatMissing(row.behavior?.missingTop)} |`);
  }
  const evaluationRows = data.cases.filter((row) => row.evaluation);
  if (evaluationRows.length) {
    lines.push("");
    lines.push("## Evaluation Metrics");
    lines.push("");
    lines.push("| id | metric | status | verdict | behavior | sample reasons |");
    lines.push("| --- | --- | --- | --- | ---: | --- |");
    for (const row of evaluationRows) {
      lines.push(`| ${row.id} | ${row.evaluation} | ${row.status || "-"} | ${row.verdict || "missing"} | ${pct(row.behavior?.coverage)} | ${row.sampleReasons?.join(", ") || "-"} |`);
    }
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- Strict coverage compares normalized lines and is intentionally harsh.");
  lines.push("- Behavior coverage ignores URL regex spelling and compares action signatures such as fixed bodies, headers, body-json operations, routing types, and broad script classes.");
  lines.push("- Script bodies are not considered proven equivalent unless lifted to native behavior or matched by coarse script class; compat wrappers are classified by their embedded source when available. `sample-required` remains the boundary for protobuf, dynamic code, and large app-specific bundles.");
  lines.push("");
  return lines.join("\n");
}

function formatMissing(entries = []) {
  if (!entries.length) return "-";
  return entries.map(([key, count]) => `${key} x${count}`).join("<br>").replaceAll("|", "\\|");
}

function pct(value) {
  if (value == null) return "-";
  return `${Math.round(value * 1000) / 10}%`;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function fileType(filename) {
  if (/\.amrs$/i.test(filename)) return "amrs";
  if (/\.arrs$/i.test(filename)) return "arrs";
  return "unknown";
}

function parseHeader(line) {
  const equalIndex = line.indexOf("=");
  const commaIndex = line.indexOf(",");
  if (equalIndex < 0 || (commaIndex >= 0 && commaIndex < equalIndex)) return null;
  return { key: line.slice(0, equalIndex).trim().toLowerCase(), value: line.slice(equalIndex + 1).trim() };
}

function decodeBase64(value) {
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function countBy(items, keyFn) {
  const out = {};
  for (const item of items || []) out[keyFn(item)] = (out[keyFn(item)] || 0) + 1;
  return out;
}

function sampleRequiredReasons(diagnostics) {
  const seen = new Set();
  const out = [];
  for (const diagnostic of diagnostics || []) {
    const code = diagnostic.code || "";
    if (code !== "sample-required-pattern" && !/sample-required/.test(code)) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

function createCachedFetchText(maxBytes) {
  const cache = new Map();
  return async function fetchText(rawUrl) {
    if (cache.has(rawUrl)) return cache.get(rawUrl);
    const response = await fetch(rawUrl, {
      headers: { "user-agent": "AnywhereFunctionalGolden/0.1" },
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (new TextEncoder().encode(text).length > maxBytes) throw new Error(`script exceeds ${maxBytes} bytes`);
    cache.set(rawUrl, text);
    return text;
  };
}
