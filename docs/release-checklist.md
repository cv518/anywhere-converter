# Release Checklist

Use this checklist before publishing the converter as a standalone repository.

## Repository

- Keep `node_modules/`, `.wrangler/`, `out-*`, and generated scratch outputs out of git.
- Keep `package-lock.json` committed so CI and Worker deploys are reproducible.
- Keep `LICENSE` aligned with the Anywhere project license.
- Public CI runs `npm test`.

## Worker

- Confirm `wrangler.toml` uses the intended Worker name.
- Create and bind `CONVERTER_KV` before relying on snapshot `/r/:hash/*` URLs in production.
- Keep `DYNAMIC_CACHE_TTL_SECONDS` non-zero for public deployments.
- Tune `RATE_LIMIT_PER_MINUTE`, `MAX_INPUT_BYTES`, `MAX_SCRIPT_BYTES`, and `MAX_TOTAL_SCRIPT_BYTES` for the deployment profile.

## Verification

- Run `npm test`.
- Run syntax checks for `src/core.mjs`, `src/worker.mjs`, `src/ui.mjs`, and `bin/cli.mjs`.
- Smoke test the Worker UI with a remote module URL and a standalone rule-set URL.

## Boundaries

- Do not add app-specific protobuf or large bundle behavior to the generic converter without samples and explicit recipes.
- Keep source-specific rule-library cleanup, such as marker-domain filtering, in rule-library build jobs rather than the generic online converter.
