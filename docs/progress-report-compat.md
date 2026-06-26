# Converter Progress Report

Generated: 2026-06-26T09:29:08.070Z
Mode: compat (fetch scripts enabled)

## Summary

- Matrix cases: 15
- Matrix status: stable=2, partial=10, sample-required=3
- Matrix validation errors: 0
- Matrix sample-required cases: 3
- Golden default coverage: 6/9
- Golden skipped cases tracked: 0
- Golden validation errors: 0

## Conversion Matrix

| id | category | status | converted | skipped | files | rules | validation |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| pinduoduo | native | stable | 3 | 0 | 1 | 5 | 0 |
| hupu | native+routing | stable | 13 | 0 | 2 | 12 | 0 |
| autonavi | native+routing | partial | 18 | 0 | 2 | 18 | 0 |
| pixiv | body-json+routing | partial | 4 | 0 | 2 | 6 | 0 |
| fanqienovel | native+routing | partial | 35 | 0 | 2 | 35 | 0 |
| bank | map-local+respond | partial | 37 | 0 | 2 | 37 | 0 |
| ximalaya | native+body-json+script-gap | partial | 33 | 0 | 2 | 33 | 0 |
| smzdm | script-dispatcher | partial | 25 | 0 | 2 | 15 | 0 |
| weibo | mixed-script | sample-required | 67 | 0 | 2 | 53 | 0 |
| bilibili | protobuf-risk | sample-required | 16 | 6 | 2 | 15 | 0 |
| spotify | header+protobuf-risk | sample-required | 3 | 0 | 1 | 5 | 0 |
| amap-enhanced | body-json+map-local | partial | 37 | 0 | 2 | 26 | 0 |
| coolapk | script-gap | partial | 4 | 0 | 1 | 4 | 0 |
| xwebads | script-gap | partial | 1 | 0 | 1 | 3 | 0 |
| httpdns | routing+complex-rule | partial | 180 | 4 | 2 | 180 | 0 |

## Sample Required

| id | reasons |
| --- | --- |
| weibo | script-dynamic-sample-required |
| bilibili | sample-required-pattern, script-binary-sample-required |
| spotify | script-dynamic-sample-required, script-binary-sample-required |

## Golden Coverage

| id | tracked by default | status | amrs | arrs | missing | extra | validation |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| pinduoduo | yes | stable | 100% | 100% | 0 | 0 | 0 |
| hupu | yes | stable | 100% | 100% | 0 | 0 | 0 |
| autonavi | yes | partial | 100% | 100% | 0 | 0 | 0 |
| pixiv | yes | partial | 100% | 100% | 0 | 0 | 0 |
| fanqienovel | yes | partial | 100% | 100% | 0 | 0 | 0 |
| ximalaya | yes | partial | 84.4% | 100% | 5 | 7 | 0 |
| smzdm | yes | partial | 81.8% | 100% | 2 | 3 | 0 |
| bank | yes | partial | 100% | 100% | 0 | 30 | 0 |
| amap-enhanced | yes | partial | 57.1% | 100% | 12 | 14 | 0 |

## Notes

- Hand-converted outputs are validation oracles, not generation templates.
- Skipped golden cases are still measured here so we can see whether generic conversion is improving.
- Compat mode is the default path and fetches remote scripts; explicit safe mode is only for offline/native diagnostics.
- sample-required means rules were emitted, but protobuf/binary/high-frequency behavior needs real request/response samples or device validation.
- Protobuf field-level rewrites are intentionally outside the generic converter scope.
