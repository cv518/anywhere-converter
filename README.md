# Anywhere Loon/Surge Converter

This package is the reusable Loon/Surge -> Anywhere converter prototype. It contains a runtime-neutral conversion core, local CLI, Cloudflare Worker API, Worker UI, tests, golden comparison, and rule-mapping documentation. It converts both full plugins/modules and standalone rule sets.

The converter is intentionally conservative: hand-converted Anywhere modules are used as validation oracles, not as output templates. Compatibility mode is the default path because most ad-blocking modules rely on remote JavaScript. The converter still lifts only high-confidence JavaScript patterns into native Anywhere rules and marks protobuf, binary, and large bundled logic as `partial` / `sample-required`.

## Project Layout

| Path | Purpose |
| --- | --- |
| `core.mjs` | Parser, normalizer, emitter, validator, script compatibility wrapper. |
| `cli.mjs` | Local conversion command. |
| `worker.mjs` | Cloudflare Worker API, URL fetching, result serving, KV persistence. |
| `ui.mjs` | Browser UI rendered by the Worker. |
| `test/core.test.mjs` | Node test coverage for stable mappings. |
| `compare-golden.mjs` | Structural comparison against hand-verified Anywhere outputs. |
| `functional-golden-report.mjs` | Functional-equivalence report against hand-verified Anywhere outputs. |
| `compare-external.mjs` | Cross-check against another converter's `.amrs/.arrs` output without using it as truth. |
| `cross-check-report.mjs` | Batch M4 cross-check report for the matrix, optionally paired with external converter output. |
| `m4-verify.mjs` | M4 convergence gate combining tests, matrix, functional golden, and module2anywhere cross-check. |
| `progress-report.mjs` | Batch conversion matrix and golden coverage report generator. |
| `docs/architecture.md` | Pipeline, modes, golden philosophy, known boundaries. |
| `docs/conversion-modes.md` | Detailed `compat` / `aggressive` mode behavior and boundaries. |
| `docs/mapping-quick-reference.md` | Loon/Surge -> Anywhere mapping table. |
| `docs/ruleset-cross-check.md` | Rule-set converter cross-check against `anywhere-rules`. |
| `docs/js-mapping-and-lift.md` | JavaScript API compatibility and high-confidence native lift table. |
| `docs/protobuf-strategy.md` | Binary/protobuf handling strategy and limits. |
| `docs/release-checklist.md` | Standalone repository and deployment release checklist. |
| `docs/functional-golden-report.md` | Generated functional-equivalence report for hand-converted cases. |
| `docs/functional-gap-review.md` | M4 review queue separating true capability gaps from strict-output noise. |
| `docs/m4-convergence.md` | Generated M4 closure report and pass/fail checks. |
| `docs/progress-report.md` | Current generated default compat-mode stage report. |
| `docs/progress-report-compat.md` | Explicit compat-mode stage report with remote script fetching. |
| `docs/worker-deployment.md` | Local Worker preview and Cloudflare deployment notes. |

## Supported Mappings

The stable native slice currently covers:

- `[MITM] hostname` to `.amrs` `hostname`
- `[Rule]` `DOMAIN`, `DOMAIN-SUFFIX`, `DOMAIN-KEYWORD`, `IP-CIDR`, `IP-CIDR6` to `.arrs`
- `[Rule]` `URL-REGEX, ..., REJECT*` to `.amrs` request rewrite
- `[Rule]` simple `AND(URL-REGEX, USER-AGENT), REJECT*` to `.amrs` request rewrite with an explicit URL-scope degradation diagnostic
- standalone Loon/Surge rule sets to `.arrs` with selected `default` / `direct` / `reject` routing
- domain-set style rule sets (`example.com`, `+.example.com`, YAML `payload:` lists) to `DOMAIN-SUFFIX` `.arrs` entries
- standalone rule-set `URL-REGEX` entries to `.amrs` request reject when the selected rule-set routing is `reject`
- `[Rewrite]` reject / redirect / `response-body-replace-regex` / simple `response-body-json-jq del(.path)` to `.amrs`
- `[Header Rewrite]` and inline `request-header-*` / `response-header-*` actions to `.amrs`
- `[Map Local]` text/base64 mock responses to `.amrs`; status/header-preserving mocks use generated `Anywhere.respond` scripts
- `[Body Rewrite]` simple jq delete/replace/delpaths subset to `.amrs`
- `[Argument]` defaults and `enable={argument_name}` gates
- supported complex jq array filters to generated JSON scripts when native `body-json` cannot express them

Remote scripts are recognized in all modes and fetched by default in CLI/Worker/progress runs. The converter downloads them within per-file and total byte budgets, wraps common Loon/Surge APIs including `$argument`, `$httpClient`, `$task.fetch`, script-level `timeout=`, and common Env/BoxJS helpers, emits Anywhere script op `100`, merges same-gate scripts, merges repeated identical script sources, builds same-phase gated dispatchers for different URL patterns, compacts simple URL regex unions, and reports compatibility risks.

The compatibility scanner treats `import` / `importScripts` as hard blockers, but only warns on `require(...)`. Many Loon/Surge scripts embed an Env helper with a Node.js branch that contains `require`; those scripts should not be rejected before runtime sampling.

The Worker UI exposes a standard conversion path. Internally this is the `compat` path: fetch remote scripts, lift high-confidence patterns to native rules, including statically visible URL-guarded JSON mutations, and preserve the rest through the compatibility wrapper. The UI also has an opt-in "增强 JS 原生化" switch for `aggressive`, which additionally lifts common but slightly more assumption-heavy JSON cleanup idioms such as array `splice(0)` clears. CLI/debug modes such as `safe` remain available for offline diagnostics, but they are not part of the public web UI.

Read the mapping and protobuf details before widening rules:

- [Architecture](docs/architecture.md)
- [Conversion Modes](docs/conversion-modes.md)
- [Mapping Quick Reference](docs/mapping-quick-reference.md)
- [Rule Set Cross Check](docs/ruleset-cross-check.md)
- [JavaScript Mapping And Lift](docs/js-mapping-and-lift.md)
- [Protobuf And Binary Strategy](docs/protobuf-strategy.md)
- [Worker Deployment](docs/worker-deployment.md)
- [Release Checklist](docs/release-checklist.md)

## CLI

```sh
npm install
node cli.mjs --input path/to/module.plugin --out-dir ./out
```

For machine-readable output:

```sh
node cli.mjs --input path/to/module.plugin --json
```

Standalone rule sets often do not contain the policy action because Surge/Loon attach the action at the parent `RULE-SET` line. Pick the Anywhere routing explicitly when converting those files:

```sh
node cli.mjs \
  --input path/to/ad.list \
  --source-kind ruleset \
  --rule-set-routing reject \
  --out-dir ./out-ruleset
```

To preserve remote scripts with the lightweight Loon/Surge compatibility wrapper:

```sh
node cli.mjs \
  --input path/to/XWebAds.plugin \
  --out-dir ./out-x \
  --mode compat
```

To override module arguments:

```sh
node cli.mjs \
  --input path/to/SMZDM.lpx \
  --mode compat \
  --argument smzdm_enable=false
```

You can also pass a JSON object:

```sh
node cli.mjs \
  --input path/to/SMZDM.lpx \
  --arguments '{"smzdm_enable":false}'
```

If a remote script URL is blocked or deleted, provide trusted script text for that exact URL:

```sh
node cli.mjs \
  --input path/to/Amap.lpx \
  --script-text 'https://kelee.one/Resource/JavaScript/Amap/Amap_remove_ads.js=/path/to/Amap_remove_ads.js' \
  --out-dir ./out-amap
```

The JSON API accepts the same idea as `scriptTextByURL`; this is the generic escape hatch for protected script hosts, not an app-specific recipe.

Each run writes `.amrs` / `.arrs` files and `conversion-report.json`. The report status is one of `stable`, `partial`, `sample-required`, or `blocked`. `sample-required` means rules were emitted, but binary/protobuf/high-frequency behavior still needs request/response samples or device validation before being treated as stable.

## Cross Check

Use `compare-external.mjs` to compare our generated structure with another converter's output directory, such as a local module2anywhere run:

```sh
node compare-external.mjs \
  --input path/to/module.plugin \
  --external-dir /path/to/module2anywhere/output \
  --json
```

The report compares hostnames, MITM op distribution, routing type distribution, rule count deltas, generated respond scripts, and validation errors. It is an audit signal only; external output is not used as a conversion rule source.

For the M4 batch baseline:

```sh
npm run cross-check:report -- --write docs/cross-check-report.md
```

To let the report invoke a local module2anywhere binary and generate one external output folder per case:

```sh
npm run cross-check:module2anywhere
```

If module2anywhere or another converter has already generated one output folder per case id, pass it as an external root:

```sh
npm run cross-check:report -- --external-root /path/to/external/outputs --write docs/cross-check-report.md
```

Current module2anywhere cross-check status:

- `15/15` matrix cases generated external output successfully.
- Our generated outputs have `0` Anywhere validation errors.
- External outputs currently have `8` validation errors, all caused by top-level `content-type = ...`, which current Anywhere does not recognize.
- Large deltas are review queues, not automatic failures. For example, SMZDM/Weibo differ heavily because module2anywhere emits many fetched scripts separately while our converter merges same-gate scripts and dispatchers.

For the M4 convergence gate:

```sh
npm run m4:verify
```

Current status is `pass`. Amap enhanced now verifies the generic source recovery path with a local script fixture for the protected remote JavaScript. The remaining gaps are tracked as `sample-required` or review items, especially mixed scripts, unlock scripts, protobuf/binary behavior, and large app-specific bundles.

## Worker Entry Point

`worker.mjs` imports the auto-detecting converter and `validateAnywhereOutput()` from `core.mjs`, renders the browser UI through `ui.mjs`, and exposes:

- `POST /api/convert` for raw plugin/rule-set text or URL-fetched source
- `POST /api/inspect` for metadata and `[Argument]` discovery without generating rule files
- `GET /sub/mitm.amrs?url=<source-url>` for dynamic MITM rule subscriptions
- `GET /sub/reject.arrs?url=<source-url>`, `/sub/direct.arrs?url=<source-url>`, and `/sub/rule.arrs?url=<source-url>` for dynamic routing rule subscriptions
- `GET /sub/deeplink?url=<source-url>` for a dynamic `anywhere://add-rule-set` import page or redirect
- `GET /r/:hash/:filename.amrs`
- `GET /r/:hash/:filename.arrs`
- one-click import links using `anywhere://add-rule-set?link=...`
- source recovery through `scriptTextByURL`; the UI can prefill failed script URLs and submit trusted script text
- basic rate limiting, remote public URL fetch caching, and no-store JSON/API responses
- Chinese diagnostic filters in the UI for action-required, sample-required, script-related, semantic-degradation, and full diagnostic views

Run locally with Wrangler from this directory:

```sh
npm install
npx wrangler dev
```

For URL-based conversions, the public import URL uses dynamic subscription links under `/sub/*`, keeping the original source URL in the query string so upstream module or rule-set updates are picked up after the Worker cache TTL. In this path the Worker does not generate a hash or store `/r/:hash/*` files. Hash-backed snapshots are only a fallback for paste/manual-script-recovery conversions that cannot be represented by a public original-URL subscription.

For standalone rule sets, pass `sourceKind=ruleset` and `ruleSetRouting=default|direct|reject` when auto-detection or the desired route is ambiguous:

```text
https://<worker-host>/sub/reject.arrs?url=<ruleset-url>&sourceKind=ruleset&ruleSetRouting=reject
```

Production should bind `CONVERTER_KV` in `wrangler.toml` if snapshot links must stay durable; without KV the Worker uses isolate memory for `/r/:hash/*`, which is fine for local smoke tests. Dynamic `/sub/*` links do not require KV because they fetch and convert from the original source URL on demand.

Deploy to Cloudflare Workers:

```sh
npm install
npx wrangler login
npx wrangler kv namespace create CONVERTER_KV
```

Copy the returned namespace id into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CONVERTER_KV"
id = "your_namespace_id"
```

Then deploy:

```sh
npx wrangler deploy
```

The deployed service supports:

- browser UI: `https://<worker-host>/`
- JSON API: `POST https://<worker-host>/api/convert`
- dynamic subscription URLs: `https://<worker-host>/sub/mitm.amrs?url=<module-url>` and the matching `.arrs` endpoints; standalone rule sets use the same `.arrs` endpoints with `sourceKind=ruleset`
- generated snapshot rule URLs when fallback is required: `https://<worker-host>/r/<hash>/<filename>.amrs`
- Anywhere import URL in the API response: `importUrl` points to dynamic subscriptions when the source is a URL; `snapshotImportUrl` is only present for fallback snapshot conversions

Example API call:

```sh
curl -sS https://<worker-host>/api/convert \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com/module.plugin","arguments":{"smzdm_enable":false},"includeContent":false,"includeSource":true}'
```

Standalone rule-set API example:

```sh
curl -sS https://<worker-host>/api/convert \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com/ad.list","sourceKind":"ruleset","ruleSetRouting":"reject","includeContent":false}'
```

Set `"fetchScripts": false` only for offline/native-only diagnostics. The default Worker path downloads remote scripts, applies high-confidence native lifts, and wraps the rest with the compatibility layer.
Set `"mode": "aggressive"` only when you want the converter to lift common but slightly more assumption-heavy JSON cleanup idioms, such as array `splice(0)` clears, into native `body-json` rules. Protobuf, binary, dynamic code, helper-function mutation, and external HTTP-driven transformations still remain compat or `sample-required`; `$httpClient` and `$task.fetch` are preserved by the compatibility wrapper through `Anywhere.http.request()`.
When remote scripts are protected or exceed budget, the response includes `summary.scriptRecoveryUrls`; pass trusted text back through `scriptTextByURL` or use the browser UI's script recovery panel.
The browser UI renders module arguments as form controls, shows a compact JS conversion overview, filters diagnostics by category, lets users switch previewed output files, and can copy either the current generated rule file or the full JSON response. If manual script text is supplied through `scriptTextByURL`, the response falls back to snapshot import links because that trusted script body cannot be represented inside a public dynamic URL.

## Verification

For the standalone repository, the default verification path is:

```sh
npm test
node --check core.mjs
node --check worker.mjs
node --check ui.mjs
node --check cli.mjs
```

The deeper M4/golden verification commands are internal quality gates. They require the companion fixture workspace that contains source modules, hand-converted Anywhere files, and optional module2anywhere output:

```sh
npm run progress -- --write docs/progress-report.md
npm run progress:safe -- --write docs/progress-report-safe.md
npm run golden
npm run golden:functional -- --write docs/functional-golden-report.md
npm run cross-check:module2anywhere
npm run m4:verify
```

`compare-golden.mjs` compares generated output against hand-verified files after stripping comments and normalizing CSV fields. Current fully matched cases:

- `pinduoduo`
- `hupu`
- `autonavi`
- `pixiv`
- `fanqienovel`
- `bank`

`ximalaya` and `smzdm` are now tracked by default golden comparison. They are not 100% exact-output matches because the generic converter avoids hand-written host generalization and app-specific compact scripts, but both emit usable rules with zero skipped items and zero validation errors.

Use `npm run golden:functional -- --write docs/functional-golden-report.md` to compare behavioral signatures rather than exact lines. Current functional golden status is `18` cases, `0` validation errors, `10` equivalent, `1` likely-equivalent, and `7` sample-required; the explicit evaluation set averages `91.1%` behavior coverage. Weibo, NetEase Cloud Music, and Spotify are kept as explicit evaluation metrics because they represent classic mixed-script and unlock-script conversion pressure. This is the preferred M4 signal for deciding whether the generic converter is functionally matching our hand-converted modules. See `docs/functional-gap-review.md` for the remaining real capability gaps.

Use `npm run progress` for the Worker-like compat matrix. `npm run progress:safe` remains available only for debugging how much can be emitted without network access.

## Current Gaps

- The compatibility wrapper covers common `$request`, `$response`, `$done`, `$argument`, `$persistentStore`, `$prefs`, Env-style helpers, and simple async `$httpClient` / `$task.fetch` use through `Anywhere.http.request()`, but it is not a full Loon/Surge runtime.
- Request scripts that mutate URL, method, or headers are lifted only when they are static and high-confidence, including static `$done({ url, headers })`, static `Object.assign($request.headers, {...})`, complete-target URL `replace(...)` objects, and simple local URL variable replacement via a lightweight `Anywhere.http` proxy script; dynamic mutation remains blocked/manual.
- Protobuf/binary scripts are preserved only as `sample-required`; the converter does not infer schema-level protobuf edits.
- Same-phase scripts are merged into a gated dispatcher, compat mode can split 100% static URL-guarded JSON branches, and aggressive mode can lift selected assumption-heavy JSON cleanup idioms, but complex async lifecycle, BoxJS Env behavior, helper-function mutation, and app-specific bundle semantics still need deeper recipes or manual conversion.
