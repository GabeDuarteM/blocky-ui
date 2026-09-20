#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

runtime="${CONTAINER_RUNTIME:-}"
if [[ -z "$runtime" ]]; then
  if command -v docker >/dev/null; then
    runtime=docker
  else
    runtime=podman
  fi
fi

user_options=(--user "$(id -u):$(id -g)")
if [[ "$("$runtime" --version)" == podman* && "$(id -u)" != 0 ]]; then
  user_options=(--userns=keep-id)
fi

platform=linux/amd64
"$runtime" build --platform "$platform" -f e2e/Dockerfile -t blocky-ui-e2e .
mkdir -p test-results
"$runtime" run --rm --init --ipc=host --platform "$platform" \
  "${user_options[@]}" \
  -e CI="${CI:-}" \
  -v "$PWD/e2e:/app/e2e:Z" \
  -v "$PWD/test-results:/app/test-results:Z" \
  blocky-ui-e2e "$@"
