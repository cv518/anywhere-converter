# Functional Golden Report

Generated: 2026-06-26T09:28:41.746Z

## Summary

- Cases: 18
- Verdicts: equivalent=10, likely-equivalent=1, sample-required=7
- Validation errors: 0
- Strict exact equivalent: 5
- Functional equivalent or likely-equivalent: 11
- Evaluation metrics: 4 cases, avg behavior 91.1%, sample-required weibo, neteasecloudmusic, spotify

## Cases

| id | category | status | verdict | strict AMRS | strict ARRS | behavior | missing behavior |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| pinduoduo | native | stable | equivalent | 100% | 100% | 100% | - |
| hupu | native+routing | stable | equivalent | 100% | 100% | 100% | - |
| autonavi | native+routing | partial | equivalent | 100% | 100% | 100% | - |
| pixiv | body-json+routing | partial | equivalent | 100% | 100% | 100% | - |
| fanqienovel | native+routing | partial | equivalent | 100% | 100% | 100% | - |
| bank | map-local+respond | partial | equivalent | 96.7% | 100% | 96.9% | 0:script:respond x1 |
| ximalaya | native+body-json+script | partial | equivalent | 81.8% | 100% | 100% | - |
| smzdm | script-dispatcher | partial | equivalent | 75% | 100% | 100% | - |
| amap-enhanced | body-json+map-local | partial | likely-equivalent | 55.2% | 100% | 93.9% | host:amdc.m.taobao.com x1<br>0:rewrite:2: x1 |
| coolapk | script-json | partial | equivalent | 33.3% | 100% | 100% | - |
| xwebads | script-json | partial | equivalent | 25% | 100% | 100% | - |
| xiaohongshu | script-json+routing | sample-required | sample-required | 18.5% | 100% | 59.4% | 1:body-json:add:$.data:{} x1<br>1:body-json:replace:$.data.items:[] x1<br>1:body-json:replace:$.data.hint_words:[] x1<br>1:body-json:replace:$.data.queries:[] x1<br>1:body-json:replace:$.data.hint_word:{} x1<br>1:body-json:delete:$.data.app_theme x1 |
| weibo | mixed-script | sample-required | sample-required | 15.4% | 100% | 86.5% | host:uve.weibo.com x1<br>host:weibocdn.com x1<br>host:weibomingzi.com x1<br>host:viber.com x1<br>0:header:2:if-none-match: x1<br>0:header:2:if-modified-since: x1 |
| neteasecloudmusic | binary-script | sample-required | sample-required | 78.6% | 100% | 95% | 0:rewrite:2:{"code":200,"ads":{}} x1 |
| spotify | protobuf-script | sample-required | sample-required | 33.3% | 100% | 88.9% | 0:rewrite:2:{} x1 |
| iringo-maps | bundle-script | sample-required | sample-required | 28.6% | 100% | 92.9% | 0:header:2:if-none-match: x1 |
| weatherkit | bundle-script | sample-required | sample-required | 14.3% | 100% | 72.7% | 0:header:2:accept-encoding: x1<br>0:header:1:accept-encoding:identity x1<br>1:script:json-transform x1 |
| jd-price | script+routing | sample-required | sample-required | 33.3% | 0% | 23.8% | 0:script:json-transform x1<br>routing-target:2 x1<br>2jzt.jd.com x1<br>2img-x.jd.com x1<br>2du.jd.com x1<br>2c-nfa.jd.com x1 |

## Evaluation Metrics

| id | metric | status | verdict | behavior | sample reasons |
| --- | --- | --- | --- | ---: | --- |
| amap-enhanced | source-recovery | partial | likely-equivalent | 93.9% | - |
| weibo | classic-mixed-script | sample-required | sample-required | 86.5% | script-dynamic-sample-required |
| neteasecloudmusic | classic-mixed-script | sample-required | sample-required | 95% | script-binary-sample-required |
| spotify | unlock-script | sample-required | sample-required | 88.9% | script-dynamic-sample-required, script-binary-sample-required |

## Notes

- Strict coverage compares normalized lines and is intentionally harsh.
- Behavior coverage ignores URL regex spelling and compares action signatures such as fixed bodies, headers, body-json operations, routing types, and broad script classes.
- Script bodies are not considered proven equivalent unless lifted to native behavior or matched by coarse script class; compat wrappers are classified by their embedded source when available. `sample-required` remains the boundary for protobuf, dynamic code, and large app-specific bundles.
