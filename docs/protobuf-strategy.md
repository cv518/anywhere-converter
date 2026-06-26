# Protobuf And Binary Strategy

The generic converter should preserve what it can, but it must not advertise protobuf field-level editing as a general capability. Bilibili-style protobuf-lite work belongs to hand-tuned module conversion, not the default converter rulebook.

## Levels

| Level | Output | Status | When to Use |
| --- | --- | --- | --- |
| Fixed binary mock | `rewrite` submode `4` with base64 | stable | Map Local / mock-response-body already contains a known binary body. |
| Script preservation | `script` op `100` with compatibility wrapper | sample-required | Source has a protobuf JS bundle and the standard conversion path can fetch or receive the script source. |
| Schema/runtime translation | not automatic | blocked/manual | Source depends on protobuf-ts/protobufjs schema decode/encode, oneof, Any, nested messages, or endpoint-specific field semantics. |

`sample-required` still emits rules. It means the output is not accepted as stable until real request/response samples or device validation confirm the binary behavior.

## Current Behavior

The converter recognizes protobuf/binary hints:

- `binary-body-mode=1`
- `Uint8Array`, `ArrayBuffer`, `DataView`
- `protobuf`, `grpc`, endpoint names in URL patterns

In the standard Worker/UI path these scripts are downloaded or accepted through `scriptTextByURL`, wrapped when possible, and marked with `script-binary-sample-required`. When script fetching is disabled for diagnostics, they are reported without remote fetch.

Fixed base64 mocks are converted natively:

```text
^https://grpc.example/Service data-type=base64 data="AAAAAAA="
```

becomes:

```text
0, 0, ^https://grpc.example/Service, 4, AAAAAAA=
```

## Why Not Auto-Rewrite Protobuf Scripts?

Anywhere's `Anywhere.codec.protobuf` is useful for schema-free wire operations. It is not equivalent to a typed protobuf runtime:

- nested messages require field-path knowledge,
- oneof and unknown fields can be accidentally damaged,
- gRPC has framing and trailer/header semantics,
- request and response samples are needed to confirm field numbers,
- app behavior can break even if the protobuf remains syntactically valid.

This is exactly why Bilibili and YouTube remain manual/sample-driven categories.

## Boundary

No public conversion mode promises generic protobuf field editing. Binary/protobuf scripts remain `sample-required` unless a future hand-maintained recipe and samples prove the endpoint-specific behavior.

If a future hand-maintained module ships a Bilibili-specific protobuf helper, it should live with that module's recipe/tests, not in the generic Loon/Surge parser and emitter.
