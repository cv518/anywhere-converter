# Rule Set Cross Check

This note records the cross-check against the companion `anywhere-rules` repository.

## Sources Reviewed

- `anywhere-rules/scripts/convert_blackmatrix7.py`
- `anywhere-rules/scripts/build_common_rules.py`
- generated examples under `anywhere-rules/rules/common/*.arrs`
- generated examples under `anywhere-rules/rules/all/**/*.arrs`

## Adopted Into The Generic Converter

The generic converter now aligns with the reusable parts of the anywhere-rules conversion scripts:

- `HOST` -> `DOMAIN`
- `HOST-SUFFIX` -> `DOMAIN-SUFFIX`
- `HOST-KEYWORD` -> `DOMAIN-KEYWORD`
- `HOST-WILDCARD` -> `DOMAIN-WILDCARD`
- `IP6-CIDR` -> `IP-CIDR6`
- `DOMAIN-WILDCARD` is normalized to an Anywhere domain suffix rule with a degradation diagnostic.
- Domain values strip leading `+.`, `*.`, `.`, and trailing `.`.
- Invalid domain/keyword values containing path separators, wildcard characters, question marks, or whitespace are skipped instead of emitted.
- Common domain-set shorthands are supported: `example.com`, `.example.com`, `+.example.com`, `*.example.com`.
- YAML `payload:` lists remain supported.
- Standalone rule-set routing entries are deduped by routing/type/value.

## Kept Out Of The Generic Converter

These anywhere-rules behaviors are intentionally not part of the online plugin/rule-set converter:

- Repository discovery through GitHub trees.
- Batch catalog/index generation.
- 100,000-rule output splitting for curated rule libraries.
- DNS/MMDB/geosite extraction and verification.
- CN acceleration filtering against DNS and GeoIP.
- Curated common rule-set composition from many upstream URLs.
- Source-specific marker-domain filtering, such as skk marker domains.

Those are offline rule-library build jobs, not per-user online conversion behavior.

## Remaining Boundaries

- `DOMAIN`, `HOST`, `DOMAIN-WILDCARD`, and `HOST-WILDCARD` still widen to suffix semantics because Anywhere `.arrs` has suffix matching but no exact-domain or full wildcard matcher.
- `URL-REGEX` in a standalone rule set only converts when `ruleSetRouting=reject`, because `.arrs` cannot express URL regex routing.
- `RULE-SET`, `DOMAIN-SET`, `PROCESS-NAME`, `GEOIP`, `IP-ASN`, boolean rules, and port/process/device conditions stay unsupported in the generic converter.
