#!/usr/bin/env bash
# Cloudflare Workers에 직접 배포한다. OpenAI Sites를 거치지 않는다.
#
# 처음 한 번은 docs/deploy-cloudflare.md의 준비 단계를 먼저 끝내야 한다
# (Cloudflare 로그인, D1 생성, 마이그레이션 적용, 비밀값 등록).
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

cd "${SITES_PROJECT_ROOT}"
[[ -f .env.deploy ]] && set -a && source .env.deploy && set +a

if [[ -z "${CLOUDFLARE_D1_DATABASE_ID:-}" ]]; then
  cat >&2 <<'MSG'
CLOUDFLARE_D1_DATABASE_ID가 없습니다.

  npx wrangler d1 create where-to-watch

로 데이터베이스를 만들면 출력에 database_id가 나옵니다. 그 값을 .env.deploy에
적어주세요 (이 파일은 .gitignore의 .env* 에 걸려 커밋되지 않습니다):

  CLOUDFLARE_D1_DATABASE_ID=여기에-붙여넣기
  CLOUDFLARE_D1_DATABASE_NAME=where-to-watch
  CLOUDFLARE_WORKER_NAME=where-to-watch

자세한 순서는 docs/deploy-cloudflare.md 를 보세요.
MSG
  exit 64
fi

echo "빌드 중... (D1 ${CLOUDFLARE_D1_DATABASE_ID:0:8}…)"
npm run build

config="dist/server/wrangler.json"
echo
echo "배포할 설정:"
node -e '
const c = require("./dist/server/wrangler.json");
const d1 = c.d1_databases[0] ?? {};
console.log("  워커 이름 :", c.name);
console.log("  D1        :", d1.database_name, d1.database_id);
console.log("  크론      :", (c.triggers?.crons ?? []).join(", ") || "없음");
console.log("  정적 파일 :", c.assets?.directory ?? "없음");
if (d1.database_id === "00000000-0000-4000-8000-000000000000") {
  console.error("\n  ⚠ D1 ID가 아직 플레이스홀더입니다. 배포를 멈춥니다.");
  process.exit(65);
}
'
echo
npx wrangler deploy --config "${config}"
