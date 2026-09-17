#!/usr/bin/env bash
# drizzle 마이그레이션을 Cloudflare의 원격 D1에 적용한다.
#
# 처음 한 번만 전부 적용하면 되고, 이후에는 새로 생긴 파일만 적용하면 된다.
# 이미 적용된 파일을 다시 돌리면 "table already exists"로 실패하는데,
# 그건 이미 반영돼 있다는 뜻이므로 그대로 두면 된다.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

cd "${SITES_PROJECT_ROOT}"
[[ -f .env.deploy ]] && set -a && source .env.deploy && set +a

db="${CLOUDFLARE_D1_DATABASE_NAME:-}"
if [[ -z "${db}" ]]; then
  echo "CLOUDFLARE_D1_DATABASE_NAME이 없습니다. .env.deploy를 확인하세요." >&2
  exit 64
fi

# 인자로 파일을 주면 그것만, 없으면 전부 순서대로 적용한다.
files=("$@")
if [[ ${#files[@]} -eq 0 ]]; then
  while IFS= read -r f; do files+=("$f"); done < <(ls -1 drizzle/*.sql | sort)
fi

for file in "${files[@]}"; do
  echo
  echo "── 적용: ${file}"
  npx wrangler d1 execute "${db}" --remote --file="${file}" --yes
done

echo
echo "완료. 테이블을 확인하려면:"
echo "  npx wrangler d1 execute ${db} --remote --command \"SELECT name FROM sqlite_master WHERE type='table'\""
