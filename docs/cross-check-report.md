# Converter Cross-Check Report

Generated: 2026-06-26T09:29:04.139Z
Mode: compat
External root: not provided
External tool: module2anywhere
External tool fetch scripts: true

## Summary

- Cases: 15
- External cases matched: 15
- Our validation errors: 0
- External validation errors: 8
- External command errors: none
- sample-required: weibo, bilibili, spotify

## Cases

| id | category | ours status | ours rules | ours validation | external | rule delta | op delta | routing delta |
| --- | --- | --- | ---: | ---: | --- | ---: | --- | --- |
| pinduoduo | native | stable | 5 | 0 | 5 rules / 1 errors | 0 | {"1:4":-1,"1:5":1} | - |
| hupu | native+routing | stable | 12 | 0 | 13 rules / 0 errors | -1 | {"0:0":-1} | - |
| autonavi | native+routing | partial | 18 | 0 | 18 rules / 1 errors | 0 | - | - |
| pixiv | body-json+routing | partial | 6 | 0 | 5 rules / 0 errors | 1 | {"1:5":1} | - |
| fanqienovel | native+routing | partial | 35 | 0 | 35 rules / 0 errors | 0 | - | - |
| bank | map-local+respond | partial | 37 | 0 | 35 rules / 1 errors | 2 | {"0:0":2} | - |
| ximalaya | native+body-json+script-gap | partial | 33 | 0 | 33 rules / 1 errors | 0 | {"0:1":-2,"0:2":-2,"1:100":1,"1:5":3} | - |
| smzdm | script-dispatcher | partial | 15 | 0 | 51 rules / 1 errors | -36 | {"0:1":-12,"0:2":-12,"1:100":-12} | - |
| weibo | mixed-script | sample-required | 53 | 0 | 97 rules / 1 errors | -44 | {"0:0":2,"0:1":-16,"0:2":-16,"1:100":-16,"1:5":2} | - |
| bilibili | protobuf-risk | sample-required | 15 | 0 | 26 rules / 1 errors | -11 | {"0:0":-3,"0:1":-3,"0:100":1,"0:2":-3,"1:100":-3,"1:5":1} | {"2":-1} |
| spotify | header+protobuf-risk | sample-required | 5 | 0 | 4 rules / 0 errors | 1 | {"0:2":1} | - |
| amap-enhanced | body-json+map-local | partial | 26 | 0 | 3 rules / 0 errors | 23 | {"0:0":15,"0:1":1,"0:2":1,"1:100":1,"1:5":5} | - |
| coolapk | script-gap | partial | 4 | 0 | 10 rules / 0 errors | -6 | {"0:1":-2,"0:2":-2,"1:100":-2} | - |
| xwebads | script-gap | partial | 3 | 0 | 3 rules / 0 errors | 0 | - | - |
| httpdns | routing+complex-rule | partial | 180 | 0 | 180 rules / 1 errors | 0 | - | - |

## Notes

- External converter output is a cross-check signal, not a source of conversion rules.
- `--module2anywhere-bin` generated one external output folder per case before comparison; generated files are kept under `--module2anywhere-out` for manual inspection.
- A large delta is a review queue item: inspect whether it is caused by better coverage, unsupported semantics, or unsafe over-conversion.
