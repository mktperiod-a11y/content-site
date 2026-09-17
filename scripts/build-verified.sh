#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

# 빌드가 매달리지 않도록 시간 제한을 건다. macOS에는 GNU timeout이 기본으로
# 없고 coreutils를 설치하면 gtimeout이라는 이름으로 들어오므로 둘 다 찾아본다.
# 둘 다 없으면 제한 없이 그냥 빌드한다 — 없다고 빌드를 막을 이유는 없다.
if command -v timeout > /dev/null 2>&1; then
  timeout_cmd="timeout"
elif command -v gtimeout > /dev/null 2>&1; then
  timeout_cmd="gtimeout"
else
  timeout_cmd=""
  echo "timeout(GNU coreutils)이 없어 시간 제한 없이 빌드합니다." >&2
fi

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"
if [[ ! -x "${vinext}" ]]; then
  echo "vinext is unavailable. Run npm run install:ci and wait for it to finish before building." >&2
  exit 69
fi

if [[ -n "${timeout_cmd}" ]]; then
  echo "Running bounded vinext build..."
  "${timeout_cmd}" \
    --signal=TERM \
    --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" \
    "${SITES_BUILD_TIMEOUT:-3m}" \
    "${vinext}" build
else
  echo "Running vinext build..."
  "${vinext}" build
fi
