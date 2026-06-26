# Functional Gap Review

Generated basis: `docs/functional-golden-report.md` and `docs/cross-check-report.md`.

## Current Signal

- Functional golden cases: 18
- Anywhere validation errors: 0
- Functionally equivalent cases: 11
- Evaluation metric average behavior: 91.1%
- Partial non-sample case: 0
- Sample-required cases: 7
- Strict exact matches are still useful, but no longer treated as the main quality metric.

## False Gaps Removed

`coolapk` and `xwebads` previously looked like capability gaps because the report classified every compatibility wrapper as `compat-wrapper` or `respond`. The wrapper itself contains helper code such as `Anywhere.respond`, so the old classifier hid the embedded upstream JSON transform.

The report now decodes wrapper `__source` and classifies the embedded script. Both cases are behavior-equivalent:

| case | strict AMRS | behavior | conclusion |
| --- | ---: | ---: | --- |
| coolapk | 33.3% | 100% | Not a core conversion gap. JS is preserved through compat wrapper; URL redirect is lifted. |
| xwebads | 25% | 100% | Not a core conversion gap. JS is preserved through compat wrapper; strict delta is mostly wrapper/form difference. |

These are still not nativeized. They are usable through the generic converter's JavaScript route, not proof that we understand every app-specific field.

## Source Recovery Verified

`amap-enhanced` now uses the local `scratch/scripts/amap.js` fixture for `https://kelee.one/Resource/JavaScript/Amap/Amap_remove_ads.js`. This exercises the generic source recovery path rather than an Amap-specific output template.

The case is now `likely-equivalent` in functional golden: behavior coverage is `93.9%`, validation errors are `0`, and skipped conversions are `0`. Remaining differences are source-backed/output-shape differences plus one hand-added route described below.

## Real Capability Gaps

| case | gap | why it matters | next action |
| --- | --- | --- | --- |
| amap-enhanced | Hand output includes `amdc.m.taobao.com` fixed reject that is not source-backed by the provided module. The converter now supports the same AMDC class when the input explicitly contains a simple `AND(URL-REGEX, USER-AGENT), REJECT` rule, as seen in XianYu-style modules. | This improves the hand module but is not a conversion rule that can be inferred when the source omits it. | Keep it out of the generic converter unless the input module contains the rule or a sample/recipe explicitly justifies it. |
| xiaohongshu | Manual output has many concrete `body-json add/replace/delete` actions, but the source route still lands in sample-required. | This is a candidate for more JS native lift if the upstream scripts use simple static JSON assignments. | Inspect fetched scripts for static `obj.path = []/{}` and `delete obj.path` under URL branches; lift only when branch and path are statically clear. |
| weibo | Behavior coverage is high, but sample-required remains due mixed/dynamic scripts and missing manual host/cache-header additions. | This is a classic mixed-script plugin and should remain a standing evaluation metric for generic conversion quality. | Separate source-backed misses from hand-added hardening. Consider static header-delete lift for simple cache headers if present in source. |
| weatherkit / iringo-maps | Large bundled scripts keep the cases in sample-required. | Strict output can be close while runtime behavior still depends on app-specific bundle semantics. | Keep as sample-required. Improve diagnostics and sample collection, not automatic field guessing. |
| neteasecloudmusic | Earlier behavior loss exposed a real generic host inference gap: `(ipv4|interface\d?)` did not expand to `interface1..9`. That is now fixed; behavior is 95%. | The remaining miss is the hand output's source-internal `api/ad/get -> {"code":200,"ads":{}}` extraction from a binary/encrypted script. Inferring that without samples would be app-specific guessing. | Keep binary script as sample-required. Do not promote the internal `api/ad/get` branch unless supplied by source rules, samples, or an explicit manual recipe. |
| spotify | Earlier behavior loss exposed two real generic gaps: `*spclient.spotify.com` lost the concrete `spclient.spotify.com`, and simple `$done({ url })` URL replacement was blocked instead of lifted. Both are now fixed; behavior is 88.9%. | The remaining miss is a hand-added Spotify ad reject from a different upstream rule source, plus protobuf unlock behavior that needs samples. | Keep source-external reject out of default conversion. Preserve protobuf script as sample-required and route field-level unlock edits to agent/manual conversion. |
| jd-price | Routing and script behavior diverge heavily because the hand output includes an extra JD Reject domain set that is not present in the source module, and default arguments enable only part of the script set. | This is a useful manual-conversion signal, but not a source-backed generic converter miss. | Keep it in sample-required/review. Do not emit hand-added JD domain rules unless they appear in input or an explicit opt-in recipe/sample justifies them. |

## M4 Review Queue

1. Static JSON assignment lift for simple `obj.path = []`, `obj.path = {}`, and `delete obj.path` inside URL-specific branches.
2. A targeted JD Price opt-in recipe decision: keep extra JD Reject domains out of default conversion unless source-backed.
3. CI gate that fails only on validation errors or functional-equivalence regressions, not strict-line deltas.
4. Product-level diff/diagnostic pages for M5. Source recovery UI is now implemented through `summary.scriptRecoveryUrls` and `scriptTextByURL`.
