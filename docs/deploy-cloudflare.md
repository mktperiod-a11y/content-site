# Cloudflare에 직접 배포하기

OpenAI Sites를 거치지 않고 이 앱을 직접 올리는 방법입니다. 코드가 원래
Cloudflare Workers용이라 옮기는 게 아니라 **껍데기만 벗는 것**에 가깝습니다.

**전부 무료 플랜 안에서 돌아갑니다.** Workers 하루 10만 요청, D1 5GB에 하루
500만 행 읽기, 크론 트리거까지 포함입니다. `worker/index.ts`가 `IMAGES`
바인딩을 선언하고 있지만 화면에서 `next/image`를 쓰는 곳이 없어 실제로는
호출되지 않습니다. 유료 기능인 Cloudflare Images는 필요 없습니다.

---

## 준비 — 처음 한 번만

### 1. 로그인

```bash
npx wrangler login
```

브라우저가 열리고 Cloudflare 계정을 물어봅니다. 계정이 없으면 여기서 무료로
만들면 됩니다.

### 2. D1 데이터베이스 만들기

```bash
npx wrangler d1 create where-to-watch
```

출력에 `database_id`가 나옵니다. 다음 단계에서 씁니다.

### 3. `.env.deploy` 만들기

저장소 루트에 이 이름으로 파일을 만들고 위에서 받은 값을 넣습니다.
`.gitignore`의 `.env*` 규칙에 걸려 **커밋되지 않습니다.**

```
CLOUDFLARE_D1_DATABASE_ID=2단계에서-받은-id
CLOUDFLARE_D1_DATABASE_NAME=where-to-watch
CLOUDFLARE_WORKER_NAME=where-to-watch
```

`CLOUDFLARE_WORKER_NAME`이 주소가 됩니다 —
`where-to-watch.<계정이름>.workers.dev`

### 4. 테이블 만들기

```bash
bash scripts/d1-migrate-remote.sh
```

`drizzle/`의 마이그레이션 4개를 순서대로 원격 D1에 적용합니다.

### 5. API 키 등록

```bash
npx wrangler secret put KOBIS_API_KEY
npx wrangler secret put TMDB_API_KEY
```

각 명령이 값을 **물어봅니다.** 거기에 붙여넣으세요.

> **키를 저장소에 넣지 마세요.** 한 번 커밋되면 나중에 지워도 히스토리에
> 남습니다. `wrangler secret put`은 값을 Cloudflare로 바로 암호화해 보내고,
> 파일에도 명령어 기록에도 남기지 않습니다.

주소를 확정한 뒤에는 이것도 등록하면 사이트맵과 공유 미리보기가 그 주소를
가리킵니다.

```bash
npx wrangler secret put PUBLIC_SITE_URL
```

---

## 배포 — 이후 매번

```bash
bash scripts/deploy-cloudflare.sh
```

빌드하고, 설정을 보여주고, 올립니다. D1 ID가 플레이스홀더면 멈춥니다.

---

## 확인

```bash
# 테이블이 만들어졌는지
npx wrangler d1 execute where-to-watch --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table'"

# 수집이 도는지 (크론을 기다리지 않고 바로)
curl -X POST https://where-to-watch.<계정이름>.workers.dev/api/releases/refresh

# 실시간 로그
npx wrangler tail
```

수집 응답의 `checked`/`matched` 숫자가 배치 한도(포스터 120·매칭 40·id 40)보다
유독 작으면 중간에 끊긴 신호입니다. 그때는 `lib/theater-catalog.ts`의 상수를
낮추면 됩니다.

---

## 내 도메인 붙이기 (선택)

`workers.dev` 주소로도 충분하지만, 도메인을 쓰려면 Cloudflare에 도메인을
등록(연 1~2만 원)하고 대시보드의 Workers → Custom Domains에서 연결합니다.
연결 후 `PUBLIC_SITE_URL`을 그 주소로 바꿔주세요.

---

## 크론이 두 번 도는 문제

Sites와 Cloudflare 양쪽이 동시에 떠 있으면 **크론이 두 번 돌아** 극장 3사 API를
두 배로 부릅니다. 각자 D1도 따로입니다. Cloudflare 쪽만 쓰기로 했다면 Sites
프로젝트를 정리하거나 최소한 그쪽 크론을 꺼주세요.

반대로 Cloudflare를 미리보기로만 쓸 거라면, `vite.config.ts`의
`triggers.crons`를 빈 배열로 두고 배포하면 이쪽 크론이 돌지 않습니다.
