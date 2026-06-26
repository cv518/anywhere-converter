# Architecture

The converter is split into small runtime-neutral entry points instead of a monolithic Worker.

## Files

| File | Role |
| --- | --- |
| `core.mjs` | Parser, normalization, rule mapping, emitter, validator, script wrapper. |
| `cli.mjs` | Local command-line entry point. |
| `worker.mjs` | Cloudflare Worker API, source fetching, KV persistence, rule serving. |
| `ui.mjs` | Worker browser UI rendering. |
| `compare-golden.mjs` | Structural comparison against hand-verified Anywhere outputs. |
| `compare-external.mjs` | Structural cross-check against another converter's generated `.amrs/.arrs` files. |
| `golden-cases.mjs` | Golden case list and expected files. |
| `test/core.test.mjs` | Node test suite for parser/emitter/mapping behavior. |

## Pipeline

```mermaid
flowchart LR
  A["Input: URL, paste, file"] --> R["Auto-detect module vs rule set"]
  R --> B
  R --> S["Parse standalone rule set"]
  B --> C["Normalize source AST"]
  S --> C
  C --> D["Resolve arguments and enable gates"]
  D --> E["Map stable native rules"]
  E --> F["Optional script fetch/wrap"]
  F --> G["Verified generic recipes"]
  G --> H["Validate .amrs/.arrs"]
  H --> I["Serve dynamic subscriptions and snapshot files"]
```

## Conversion Modes

| Mode | Default | Behavior |
| --- | --- | --- |
| `compat` | yes | Downloads remote scripts by default, lifts high-confidence JavaScript patterns including static URL-guarded JSON mutations, wraps common Loon/Surge APIs, and merges same-phase scripts into gated dispatchers. Output is usually `partial` or `sample-required`. |
| `aggressive` | no | Starts from `compat`, then additionally lifts selected assumption-heavy JSON cleanup idioms such as array `splice(0)` clears. It does not native-lift protobuf, binary, dynamic code, helper-function mutation, or external HTTP-driven transformations. |
| `safe` | no | Offline/debug mode. Stable native mappings only. Remote scripts are recognized and reported but not fetched. |

The Worker UI exposes a standard conversion path backed by `compat` with remote script fetching enabled, plus an opt-in "增强 JS 原生化" switch for `aggressive`. `safe` remains a CLI/debug mode for offline/native-only diagnostics and is not exposed in the public UI.

See [Conversion Modes](conversion-modes.md) for the detailed `compat` / `aggressive` behavior boundary.

## Worker Link Model

URL-based conversions return dynamic subscription links by default:

- `/sub/mitm.amrs?url=<module-url>`
- `/sub/reject.arrs?url=<module-url>`
- `/sub/direct.arrs?url=<module-url>`
- `/sub/rule.arrs?url=<module-url>`
- `/sub/deeplink?url=<module-url>`

These links preserve the original module or rule-set URL in the subscription, so Anywhere can receive updated conversion output after upstream content changes and the Worker cache expires. Standalone rule sets can include `sourceKind=ruleset` and `ruleSetRouting=default|direct|reject` in the query when the source has no embedded policy action. URL-based conversions do not generate hashes. The API only emits hash-backed `/r/:hash/*` snapshot links when the input cannot be represented as a public dynamic subscription, such as paste-only input or conversions that depend on manual `scriptTextByURL` recovery.

## Golden Philosophy

Hand-converted Anywhere files used by the golden test workspace are validation oracles, not source code templates. The converter should learn generic rules from them:

- native mock responses,
- hostname normalization,
- safe URL-gate shaping,
- conservative grouped-host generalization when all expanded hosts are covered by `hostname`,
- argument defaulting and `enable={...}` gating,
- body-json/body-replace opportunities,
- diagnostics for cases that should remain manual.

Golden comparison strips comments and normalizes CSV fields. It does not require byte-for-byte output equality.

`compare-external.mjs` serves the same philosophy for module2anywhere or any other converter: it compares structure, not authority. Useful signals include hostname deltas, MITM op distribution, routing type counts, generated `Anywhere.respond` scripts, and validator errors.

## Known Boundaries

- Anywhere has one buffered script per matching message; same-gate scripts are composed, and same-phase script rules are merged into gated dispatchers.
- Request scripts cannot directly mutate URL, method, or headers. Those must be lifted to native rewrite/header rules.
- Protobuf/binary scripts can be preserved, but schema-level equivalence requires samples and endpoint-specific recipes.
- `DOMAIN` exact semantics cannot be represented in Anywhere routing; it is emitted as suffix with diagnostics.
