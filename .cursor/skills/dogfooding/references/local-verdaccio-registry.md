# Local Verdaccio Registry Setup (for docs dogfooding)

Goal: serve the locally built `@danceroutine/*` packages from a throwaway registry so
subagents can run the documented commands **verbatim** (`pnpm dlx @danceroutine/tango-cli new ...`,
`pnpm add @danceroutine/...`), with all non-Tango deps (express, better-sqlite3, tsx, ...)
proxied from npmjs.

Run all of this yourself BEFORE launching subagents, and pre-flight the full Getting Started
flow once to confirm the registry is consumable. Subagents must never be the ones to set up
the registry.

## 1. Build the packages first

Tarball contents come from each package's `files`/`dist`, so build before publishing:

```bash
cd <repo-root>
pnpm run build:test:packages
```

## 2. Write a Verdaccio config (anonymous publish for the scope)

```bash
mkdir -p /tmp/tango-verdaccio/storage
cat > /tmp/tango-verdaccio/config.yaml <<'EOF'
storage: /tmp/tango-verdaccio/storage
auth:
  htpasswd:
    file: /tmp/tango-verdaccio/htpasswd
    max_users: -1
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
packages:
  '@danceroutine/*':
    access: $all
    publish: $anonymous
    unpublish: $anonymous
  '@*/*':
    access: $all
    publish: $authenticated
    proxy: npmjs
  '**':
    access: $all
    publish: $authenticated
    proxy: npmjs
log: { type: stdout, format: pretty, level: warn }
EOF
```

Keep `storage` under `/tmp` and ephemeral. A fresh storage dir avoids
"cannot publish over existing version" collisions on re-runs.

## 3. Launch Verdaccio (background) and wait for it

```bash
npx --yes verdaccio@6 --config /tmp/tango-verdaccio/config.yaml --listen 4873 \
  > /tmp/tango-verdaccio/verdaccio.log 2>&1 &
# wait until it answers, then sanity-check
sleep 6
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4873/   # expect 200
```

Record the Verdaccio PID so you can kill it during teardown.

## 4. Publish the Tango packages

Verdaccio requires _some_ auth token to publish, even anonymously. Use a fake one in an
`.npmrc`, and point pnpm at it via the `npm_config_userconfig` ENV VAR.

> Gotcha: `pnpm publish --userconfig ...` fails with "Unknown option: 'userconfig'".
> You MUST pass it as the `npm_config_userconfig` environment variable instead.

```bash
cat > /tmp/tango-verdaccio/.npmrc <<'EOF'
registry=http://localhost:4873/
//localhost:4873/:_authToken=fake-token-for-anonymous
EOF

cd <repo-root>
export npm_config_userconfig=/tmp/tango-verdaccio/.npmrc
export npm_config_registry=http://localhost:4873/

pnpm -r \
  --filter '@danceroutine/*' \
  --filter '!@danceroutine/tango-docs' \
  --filter '!@danceroutine/tango-example-*' \
  publish --registry http://localhost:4873/ --no-git-checks
```

Verify the key packages resolve (each should return 200):

```bash
for p in tango-cli tango-config tango-schema tango-orm tango-migrations \
         tango-resources tango-codegen tango-adapters-express; do
  curl -s -o /dev/null -w "%{http_code}  @danceroutine/$p\n" \
    "http://localhost:4873/@danceroutine%2f$p"
done
```

## 5. Per-subagent consumer environment

Each subagent gets its own isolated `/tmp` working dir with its own `.npmrc`. Critically,
give each one an **isolated pnpm store-dir** so concurrent subagents do not serve each other
a stale CLI from a shared `pnpm dlx` cache.

```bash
# one per subagent, e.g. /tmp/tango-agent-1, /tmp/tango-agent-2, ...
mkdir -p /tmp/tango-agent-1
cat > /tmp/tango-agent-1/.npmrc <<'EOF'
registry=http://localhost:4873/
@danceroutine:registry=http://localhost:4873/
store-dir=/tmp/tango-agent-1/.pnpm-store
EOF
```

When the subagent runs commands in that dir, export the userconfig so pnpm/dlx use the
local registry:

```bash
export npm_config_userconfig=/tmp/tango-agent-1/.npmrc
export npm_config_registry=http://localhost:4873/
```

## 6. Pre-flight the documented flow yourself

Confirm the docs are followable end to end before handing the env to subagents:

```bash
cd /tmp/tango-agent-preflight   # a scratch dir with its own .npmrc as above
pnpm dlx @danceroutine/tango-cli new my-app --framework express --dialect sqlite
cd my-app
pnpm install
pnpm run make:migrations --name initial
pnpm run dev &   # starts on :3000
sleep 9
curl -s -X POST http://localhost:3000/api/todos -H 'content-type: application/json' \
  -d '{"title":"preflight"}'
curl -s http://localhost:3000/api/todos
curl -s -o /dev/null -w "health:%{http_code} openapi:%{http_code}\n" \
  http://localhost:3000/health http://localhost:3000/api/openapi.json
pkill -f "tsx watch src/index.ts"
```

Verified behavior:

- `pnpm dlx @danceroutine/tango-cli new ...` DOES resolve the `tango` bin even though the
  package suffix is `tango-cli` (pnpm runs the sole bin). The `--package` workaround is not needed.
- `pnpm install` pulls `@danceroutine/*` from Verdaccio and express/pg/better-sqlite3/tsx from
  the npmjs uplink.

## 7. Known failure mode to expect (pnpm 10)

On pnpm 10+, dependency build scripts are blocked by default. `better-sqlite3` then never
compiles its native binding, and `make:migrations`/`dev` crash with a missing
`better_sqlite3.node`. To unblock during pre-flight:

```bash
pnpm approve-builds            # select better-sqlite3 and esbuild
pnpm install
# or, declaratively, add to the project package.json then reinstall:
#   "pnpm": { "onlyBuiltDependencies": ["better-sqlite3", "esbuild"] }
```

This is a genuine product/doc finding, not a registry problem. If the dogfooding goal is to
test the docs as-written, let the subagent HIT this and report it rather than pre-fixing it.

## 8. Teardown

```bash
kill <verdaccio-pid> 2>/dev/null
pkill -f verdaccio 2>/dev/null
rm -rf /tmp/tango-verdaccio /tmp/tango-agent-* /tmp/tango-agent-preflight
```

## Honest deviation to disclose in reports

The `.npmrc`/registry pointer is harness-provisioned setup, not a documented step. Each
subagent should treat it as "registry pre-provisioned" rather than as part of the docs flow.
