#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  docker compose -f docker-compose.integration.yml down >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[integration] Starting postgres service..."
docker compose -f docker-compose.integration.yml up -d postgres

echo "[integration] Waiting for postgres healthcheck..."
for _ in {1..60}; do
  status=$(docker inspect --format='{{.State.Health.Status}}' tango-postgres-1 2>/dev/null || true)
  if [[ "$status" == "healthy" ]]; then
    break
  fi
  sleep 1
done

status=$(docker inspect --format='{{.State.Health.Status}}' tango-postgres-1 2>/dev/null || true)
if [[ "$status" != "healthy" ]]; then
  echo "[integration] Postgres failed to become healthy."
  exit 1
fi

echo "[integration] Running sqlite integration suite..."
pnpm run test:integration:sqlite

echo "[integration] Running postgres integration suite..."
pnpm run test:integration:postgres

echo "[integration] All integration suites passed."
