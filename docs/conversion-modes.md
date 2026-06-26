# Conversion Modes

这份文档说明 Worker/UI 和 API 中 `compat` 与 `aggressive` 两种转换模式的区别。核心原则是：**先保证可用，再在可证明的范围内原生化**。

## Quick Choice

| 场景 | 建议模式 | 原因 |
| --- | --- | --- |
| 普通用户在线转换远程 Loon/Surge 模块 | `compat` | 默认模式，最大化保留脚本行为，风险边界清楚。 |
| 模块主要是 rewrite、reject、header、map local | `compat` | 这些本来就会走稳定原生映射。 |
| 模块包含普通 JSON 去广告 JS | `compat` | 只要能 100% 静态证明，默认模式就会提升为原生 `body-json`。 |
| 模块包含数组 `splice(0)` 这类常见但依赖源数据类型的清理 | `aggressive` | 通常是清空数组，但不是所有输入 JSON 都严格等价，因此需要用户主动开启。 |
| 模块包含 `$httpClient` / `$task.fetch` | `compat` | 兼容层会映射到 `Anywhere.http.request()`；不应静态原生化成 `body-json`。 |
| 模块包含 protobuf、binary、YouTube/Bilibili 大脚本 | `compat` + 实机验证或手工转换 | 通用转换器只能保留/标记，不能推断字段级语义。 |
| 调试“不下载 JS 时能转多少” | `compat` + `fetchScripts=false` | 只用于离线诊断，不面向网页普通用户。 |

## Compat Mode

`compat` 是默认模式，也是 Worker UI 标准转换路径。

它会做这些事：

- 解析 Loon/Surge 模块结构、参数、MITM、Rule、Rewrite、Header Rewrite、Map Local。
- 下载远程脚本，受 `MAX_SCRIPT_BYTES` 和 `MAX_TOTAL_SCRIPT_BYTES` 限制。
- 对高置信 JS 做默认原生化，例如：
  - 无控制流的 `JSON.parse($response.body)` 后 `delete obj.path`；
  - 无控制流的 `obj.path = []/{}/true/false/null/"text"`；
  - 静态 URL 分支内的 `obj.path = []` / `delete obj.path`；
  - 简单 body regex replace；
  - 简单数组 filter；
  - 多个同字段精确 filter 排除，例如 `item.type !== "ad" && item.type !== "sponsor"`；
  - 静态 request header set/delete；
  - 静态 request URL rewrite；
  - 固定 `$done({ response })`；
  - query 参数 302 redirect。
- 对未能安全原生化的脚本生成 Anywhere `op 100` 脚本。
- 在兼容层里提供常见 Loon/Surge API：
  - `$request`
  - `$response`
  - `$done`
  - `$argument`
  - `$persistentStore`
  - `$prefs`
  - `$httpClient`
  - `$task.fetch`
  - Env/BoxJS 常见 helper
- 将 `$httpClient` 和 `$task.fetch` 映射到 `Anywhere.http.request()`。
- 合并相同 gate 或同阶段脚本，减少规则数量。
- 对 protobuf、binary、动态代码、大 bundle、外部 HTTP 等风险打诊断标签。

它不会做这些事：

- 不会把所有 JS 都翻译成原生 `body-json`。
- 不会执行 JS 后猜测结果。
- 不会推断 protobuf 字段含义。
- 不会把外部 HTTP 请求结果静态折叠成原生规则。
- 不会把 helper 函数里的复杂对象遍历当作可证明 JSON 操作。

`compat` 的目标是：**尽量保留行为，少做不可靠猜测**。

## Aggressive Mode

`aggressive` 是 `compat` 的增强模式。它先执行 `compat` 的所有能力，然后额外尝试更进取的 JS 原生化。

典型输入：

```js
let obj = JSON.parse($response.body);
obj.data.items.splice(0);
$done({ body: JSON.stringify(obj) });
```

`compat` 会保留为兼容层脚本，因为如果 `obj.data.items` 不是数组，原脚本会抛错，而直接替换成 `[]` 会改变错误行为。  
`aggressive` 可以生成类似：

```text
1, 5, <原脚本URL范围>, replace, $.data.items, []
```

`compat` 已经支持的 URL guard 包括：

- `$request.url.includes("/path")`
- `$request.url.indexOf("/path") !== -1`
- `/\/path/.test($request.url)`
- `$request.url.match(/\/path/)`

支持的分支内操作包括：

- `obj.path = []`
- `obj.path = {}`
- `obj.path = null`
- `obj.path = true/false`
- `obj.path = "text"`
- `delete obj.path`
- `obj.path.length = 0`
- `obj.list = obj.list.filter(item => item.type !== "ad")`
- `obj.list = obj.list.filter(item => item.type !== "ad" && item.type !== "sponsor")`
- `obj.list = obj.list.filter(item => !["ad", "sponsor"].includes(item.type))`

`aggressive` 的关键限制：

- JSON 根对象必须来自 `JSON.parse($response.body)`。
- 最终必须通过 `$done({ body: JSON.stringify(obj) })`，或 `$response.body = JSON.stringify(obj); $done({})` 交还 body。
- 对于 URL 分支 lift，原脚本 URL pattern 会和分支 URL guard 做交集，不会把规则扩大到全网。
- 不会调用 `clean(obj)` 这类 helper 后猜测 helper 做了什么。

`aggressive` 不会 native-lift：

- protobuf / binary / `bodyBytes`
- `eval` / `new Function`
- `import` / `importScripts`
- `require`
- `$httpClient` / `$task.fetch` / `fetch` / `XMLHttpRequest` 驱动的改写
- 动态 path，例如 `obj[key] = []`
- 根对象重赋值，例如 `obj = transform(obj)`
- 依赖样本才能知道 schema 的 feed 清理

注意：`$httpClient` 和 `$task.fetch` **不是不支持**。它们会在兼容层中映射到 `Anywhere.http.request()`。只是这类运行时外部 IO 不应该被 `aggressive` 静态提升成 `body-json`。

`aggressive` 的目标是：**多转一部分可证明的 JSON 清理脚本，但仍不把通用转换器变成 JS 猜测器**。

## Output Differences

同一个模块在两种模式下可能出现这些差异：

| 差异 | `compat` | `aggressive` |
| --- | --- | --- |
| 100% 可证明 URL 分支 JSON 清理 | 拆成多条 `body-json` 原生规则 | 同 `compat` |
| `obj.list.splice(0)` | 兼容层 | 可能提升为 `body-json replace $.list []` |
| `$httpClient` / `$task.fetch` | 兼容层映射到 `Anywhere.http.request()` | 仍是兼容层，不做原生 `body-json` |
| protobuf/binary | `sample-required` | `sample-required` |
| 动态代码 | compat + `sample-required` | compat + `sample-required` |
| 动态订阅链接 | `/sub/*.amrs?url=...` | `/sub/*.amrs?url=...&mode=aggressive` |

## Diagnostics

常见诊断含义：

| Diagnostic | 含义 |
| --- | --- |
| `script-native-lift` | 默认模式已将脚本提升为原生规则。 |
| `script-aggressive-native-lift` | aggressive 已将更进取的静态 JSON 操作提升为原生规则。 |
| `script-compat-layer` | 脚本已保留为 Anywhere `op 100` 兼容层。 |
| `script-http-client` | 脚本使用外部 HTTP；兼容层支持，但需要注意超时、网络和实机行为。 |
| `script-binary-sample-required` | 涉及 protobuf/binary，通用转换器不推断字段级语义。 |
| `script-dynamic-sample-required` | 涉及动态代码或运行时行为，需要实机样本验证。 |
| `request-mutation-script` | request mutation 未能提升为静态 rewrite/header/proxy 规则。 |

## API Usage

默认：

```json
{
  "url": "https://example.com/module.plugin",
  "mode": "compat"
}
```

增强原生化：

```json
{
  "url": "https://example.com/module.plugin",
  "mode": "aggressive"
}
```

动态订阅会保留模式参数：

```text
https://<worker-host>/sub/mitm.amrs?url=<module-url>&mode=aggressive
```

这样 Anywhere 后续刷新订阅时，会继续用 aggressive 规则重新转换上游模块。

## Maintenance Rule

新增 aggressive recipe 前必须满足：

1. 输入模式可以静态识别。
2. 输出规则不会扩大 URL 匹配范围。
3. 不依赖执行 JS。
4. 不依赖外部 HTTP 返回值。
5. 不推断 protobuf/binary schema。
6. 有默认 `compat` 不触发、`aggressive` 触发的测试。
7. 诊断能说明为什么发生了 aggressive lift。

如果做不到这些条件，就应该保留为兼容层或标记 `sample-required`。
