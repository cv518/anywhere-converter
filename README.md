# Anywhere Loon/Surge Converter

A generic Loon/Surge plugin, module, JavaScript rewrite, and rule-set converter for Anywhere.

The converter is intentionally conservative. It maps stable Loon/Surge features to native Anywhere rules, fetches remote JavaScript by default, lifts high-confidence JavaScript patterns to native rules when possible, and preserves the remaining script behavior through a lightweight compatibility wrapper. Protobuf, binary, very large bundles, and app-specific dynamic behavior are emitted as usable-but-needs-validation output instead of being guessed.

## Project Layout

| Path | Purpose |
| --- | --- |
| `src/core.mjs` | Parser, normalizer, emitter, validator, JavaScript lift logic, and compatibility wrapper. |
| `src/worker.mjs` | Cloudflare Worker API, URL fetching, dynamic subscriptions, snapshot serving, and KV integration. |
| `src/ui.mjs` | Browser UI rendered by the Worker. |
| `bin/cli.mjs` | Local conversion command. |
| `test/core.test.mjs` | Node test coverage for stable mappings. |
| `docs/architecture.md` | Conversion pipeline, Worker link model, and known boundaries. |
| `docs/conversion-modes.md` | Detailed `compat` / `aggressive` mode behavior. |
| `docs/mapping-quick-reference.md` | Loon/Surge to Anywhere mapping table. |
| `docs/js-mapping-and-lift.md` | JavaScript compatibility and native-lift table. |
| `docs/anywhere-native-capability-audit.md` | Anywhere native JS capability audit and converter coverage table. |
| `docs/protobuf-strategy.md` | Binary/protobuf handling strategy and limits. |
| `docs/worker-deployment.md` | Local Worker preview and Cloudflare deployment notes. |
| `docs/release-checklist.md` | Public release and deployment checklist. |

## Supported Mappings

The stable native slice currently covers:

- `[MITM] hostname` to `.amrs` `hostname`
- `[Rule]` `DOMAIN`, `DOMAIN-SUFFIX`, `DOMAIN-KEYWORD`, `IP-CIDR`, `IP-CIDR6` to `.arrs`
- `[Rule]` `URL-REGEX, ..., REJECT*` to `.amrs` request rewrite
- simple `AND(URL-REGEX, USER-AGENT), REJECT*` to `.amrs` request rewrite with an explicit degradation diagnostic
- standalone Loon/Surge rule sets to `.arrs` with selected `default` / `direct` / `reject` routing
- domain-set style rule sets (`example.com`, `+.example.com`, YAML `payload:` lists) to `DOMAIN-SUFFIX` `.arrs` entries
- standalone rule-set `URL-REGEX` entries to `.amrs` request reject when selected routing is `reject`
- `[Rewrite]` reject / redirect / `response-body-replace-regex` / simple `response-body-json-jq del(.path)` to `.amrs`
- `[Header Rewrite]` and inline `request-header-*` / `response-header-*` actions to `.amrs`
- `[Map Local]` text/base64 mock responses to `.amrs`
- status/header-preserving mock responses through generated `Anywhere.respond` scripts
- `[Body Rewrite]` simple jq delete/replace/delpaths subset to `.amrs`
- `[Argument]` defaults and `enable={argument_name}` gates
- supported complex jq array filters to generated JSON scripts when native `body-json` cannot express them

Remote scripts are recognized in all modes and fetched by default in CLI and Worker conversions. The converter downloads them within per-file and total byte budgets, wraps common Loon/Surge APIs including `$argument`, `$httpClient`, `$task.fetch`, global `fetch`, Web text/base64 helpers, lightweight `crypto.getRandomValues/randomUUID`, script-level `timeout=`, and common Env/BoxJS helpers, emits Anywhere script op `100`, merges same-gate scripts, merges repeated identical script sources, builds same-phase gated dispatchers for different URL patterns, compacts simple URL regex unions, and reports compatibility risks.

The public conversion path is `compat`: fetch remote scripts, lift high-confidence native patterns, and preserve the rest through the compatibility wrapper. `aggressive` is optional and additionally lifts common but slightly more assumption-heavy JSON cleanup idioms. See [Conversion Modes](docs/conversion-modes.md) and [JavaScript Mapping And Lift](docs/js-mapping-and-lift.md) before widening conversion rules.

## CLI

```sh
npm install
node bin/cli.mjs --input path/to/module.plugin --out-dir ./out
```

Machine-readable output:

```sh
node bin/cli.mjs --input path/to/module.plugin --json
```

Standalone rule sets often do not contain the policy action because Surge/Loon attach the action at the parent `RULE-SET` line. Pick the Anywhere routing explicitly when converting those files:

```sh
node bin/cli.mjs \
  --input path/to/ad.list \
  --source-kind ruleset \
  --rule-set-routing reject \
  --out-dir ./out-ruleset
```

Compatibility mode is the default. You can opt into aggressive JavaScript lifting when you accept the extra assumptions:

```sh
node bin/cli.mjs \
  --input path/to/module.plugin \
  --mode aggressive \
  --out-dir ./out-aggressive
```

Override module arguments with repeated `--argument` flags or a JSON object:

```sh
node bin/cli.mjs \
  --input path/to/SMZDM.lpx \
  --argument smzdm_enable=false
```

```sh
node bin/cli.mjs \
  --input path/to/SMZDM.lpx \
  --arguments '{"smzdm_enable":false}'
```

If a remote script URL is blocked or deleted, provide trusted script text for that exact URL:

```sh
node bin/cli.mjs \
  --input path/to/Amap.lpx \
  --script-text 'https://example.com/script.js=/path/to/script.js' \
  --out-dir ./out-amap
```

Each run writes `.amrs` / `.arrs` files and `conversion-report.json`. The report status is one of `stable`, `partial`, `sample-required`, or `blocked`. `sample-required` means rules were emitted, but binary/protobuf/high-frequency behavior still needs request/response samples or device validation before being treated as stable.

## Worker

`src/worker.mjs` exposes:

- `POST /api/convert` for raw plugin/rule-set text or URL-fetched source
- `POST /api/inspect` for metadata and `[Argument]` discovery without generating rule files
- `GET /sub/mitm.amrs?url=<source-url>` for dynamic MITM rule subscriptions
- `GET /sub/reject.arrs?url=<source-url>`, `/sub/direct.arrs?url=<source-url>`, and `/sub/rule.arrs?url=<source-url>` for dynamic routing rule subscriptions
- `GET /sub/deeplink?url=<source-url>` for a dynamic `anywhere://add-rule-set` import page or redirect
- `GET /r/:hash/:filename.amrs` and `GET /r/:hash/:filename.arrs` for fallback snapshot files

Run locally with Wrangler:

```sh
npm install
npx wrangler dev
```

For URL-based conversions, the public import URL uses dynamic subscription links under `/sub/*`, keeping the original source URL in the query string so upstream module or rule-set updates are picked up after the Worker cache TTL. Hash-backed snapshots are only a fallback for paste/manual-script-recovery conversions that cannot be represented by a public original-URL subscription.

For standalone rule sets, pass `sourceKind=ruleset` and `ruleSetRouting=default|direct|reject` when auto-detection or desired route is ambiguous:

```text
https://<worker-host>/sub/reject.arrs?url=<ruleset-url>&sourceKind=ruleset&ruleSetRouting=reject
```

Production should bind `CONVERTER_KV` in `wrangler.toml` if snapshot links must stay durable. Dynamic `/sub/*` links do not require KV because they fetch and convert from the original source URL on demand.

Deploy to Cloudflare Workers:

```sh
npm install
npx wrangler login
npx wrangler kv namespace create CONVERTER_KV
npx wrangler deploy
```

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

When remote scripts are protected or exceed budget, the response includes `summary.scriptRecoveryUrls`; pass trusted text back through `scriptTextByURL` or use the browser UI's script recovery panel.

## Verification

```sh
npm test
node --check src/core.mjs
node --check src/worker.mjs
node --check src/ui.mjs
node --check bin/cli.mjs
```

## Current Gaps

- The compatibility wrapper covers common `$request`, `$response`, `$done`, `$argument`, `$persistentStore`, `$prefs`, Env-style helpers, and simple async `$httpClient` / `$task.fetch` / `fetch` use through `Anywhere.http.request()`, but it is not a full Loon/Surge runtime.
- Request scripts that mutate URL, method, or headers are lifted only when they are static and high-confidence. Dynamic mutation remains blocked/manual.
- Protobuf/binary scripts are preserved as `sample-required`; the converter does not infer schema-level protobuf edits.
- Same-phase scripts are merged into a gated dispatcher, compat mode can split 100% static URL-guarded JSON branches, and aggressive mode can lift selected assumption-heavy JSON cleanup idioms. Complex async lifecycle, helper-function mutation, and app-specific bundle semantics still need deeper recipes or manual conversion.
