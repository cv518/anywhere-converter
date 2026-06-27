# Anywhere Native Capability Audit

This table is generated from the current Anywhere MITM script engine source and documents how the generic converter uses those native capabilities. It is a guardrail: adding a converter feature should update this file and the tests together.

| Anywhere native capability | Source API shape | Converter status | Notes |
| --- | --- | --- | --- |
| `Anywhere.codec.utf8` | `encode`, `decode` | bridged | Used by wrappers and generated scripts. Also backs `TextEncoder` / `TextDecoder` fallback. |
| `Anywhere.codec.base64` | `encode`, `decode` | bridged | Used for script loading and `atob` / `btoa` fallback. |
| `Anywhere.codec.base64url` | `encode`, `decode` | documented only | Available to hand-written scripts. No common Loon/Surge API needs automatic mapping yet. |
| `Anywhere.codec.hex` | `encode`, `decode` | documented only | Available to hand-written scripts. |
| `Anywhere.codec.gzip` | `encode`, `decode` | bridged | Exposed through `$utils.gzip` / `$utils.ungzip`. |
| `Anywhere.codec.deflate` | `encode`, `decode` | documented only | Available to hand-written scripts; not mapped to a common Loon/Surge helper yet. |
| `Anywhere.codec.brotli` | `encode`, `decode` | documented only | Available to hand-written scripts; not mapped to a common Loon/Surge helper yet. |
| `Anywhere.codec.protobuf` | `decode`, `encode`, `encodeVarint`, `decodeVarint` | preserved/manual | Generic converter marks protobuf/binary scripts as `sample-required`; it does not infer field semantics. |
| `Anywhere.crypto` | hashes, HMAC, random bytes, UUID, AES-GCM | partial bridge | `crypto.getRandomValues` and `crypto.randomUUID` are bridged. Full WebCrypto `crypto.subtle` is not emulated. |
| `Anywhere.jwt` | `decode`, `encode` | documented only | Available to hand-written scripts. No generic Loon/Surge mapping yet. |
| `Anywhere.json` | JSON path editing helpers | native output | Body JSON rewrite and lifted JS JSON recipes emit native `body-json` rules rather than JS calls. |
| `Anywhere.store` | `get`, `getString`, `set`, `delete`, `keys` | bridged | Backs `$persistentStore`, `$prefs`, and Env storage helpers. |
| `Anywhere.log` | `info`, `warning`, `error`, `debug` | bridged | Used by wrapper logging and Env `log/logErr`. |
| `Anywhere.done` / `exit` / `respond` | control flow | bridged | Backs `$done` and fixed request responses. |
| `Anywhere.http` | `get`, `post`, `request` | bridged | Backs `$httpClient`, `$task.fetch`, Env `get/post`, and global `fetch()`. |
| `TextEncoder` / `TextDecoder` globals | Web text codec | bridged | Anywhere installs these natively; wrapper also provides fallback for older clients or isolated evaluation. |

## Explicit Non-Goals

- The converter does not translate arbitrary `crypto.subtle` workflows into `Anywhere.crypto`.
- The converter does not translate generic protobuf bundles into field-level native edits.
- The converter does not expose every native codec through a Loon/Surge alias unless a real plugin pattern needs it.
- `XMLHttpRequest` is still not emulated; scripts using it should be treated as sample-required/manual until a focused compatibility shim is justified by real samples.
