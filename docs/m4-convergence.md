# M4 Convergence Report

Generated: 2026-06-26T15:45:23.029Z
Status: pass

## Checks

| check | status | detail |
| --- | --- | --- |
| core tests pass | pass | node --test completed successfully. |
| progress validation errors | pass | matrix validation errors=0 |
| golden validation errors | pass | golden validation errors=0 |
| progress has no blocked cases | pass | matrix status=stable=2, partial=10, sample-required=3 |
| functional validation errors | pass | validation errors=0 |
| functional equivalent floor | pass | functional equivalent=11 |
| no functional invalid/usable-gap | pass | bad verdicts=none |
| non-sample partial is bounded | pass | non-sample partial=none |
| amap source recovery fixture | pass | amap verdict=likely-equivalent behavior=93.9% |
| classic script metrics tracked | pass | tracked=amap-enhanced, weibo, neteasecloudmusic, spotify |
| cross-check external generation | pass | external matched=15/15 |
| cross-check our validation errors | pass | ours validation errors=0 |
| cross-check external command errors | pass | external command errors=none |
| external validator errors are known | pass | external validation errors=8; current known cause is top-level content-type header |

## Functional Summary

- Cases: 18
- Verdicts: equivalent=10, likely-equivalent=1, sample-required=7
- Validation errors: 0
- Functional equivalent or likely-equivalent: 11
- Evaluation metrics: 4 cases, avg behavior 91.1%, sample-required weibo, neteasecloudmusic, spotify

## Cross-Check Summary

- External cases matched: 15/15
- Our validation errors: 0
- External validation errors: 8
- External command errors: none

## Conclusion

M4 can close; Amap source recovery is verified with a local script fixture, and remaining gaps are tracked sample-required/script-evaluation items.

## Notes

- module2anywhere remains useful as a cross-check, but its current output is not a stronger oracle for Anywhere correctness.
- Current external validation errors are caused by top-level `content-type = ...`, which current Anywhere does not recognize.
- M4 closure should allow documented `sample-required` cases; protobuf, large bundles, and dynamic app-specific scripts belong to the manual/agent route.
