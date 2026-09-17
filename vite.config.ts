import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

/**
 * Sites는 실행 시점에 D1을 붙여주므로 위 플레이스홀더로 충분하다.
 * 직접 Cloudflare에 올릴 때는 진짜 데이터베이스 ID가 필요해서, 환경변수로
 * 받는다. 비워두면 지금까지와 똑같이 동작한다.
 */
const databaseId =
  process.env.CLOUDFLARE_D1_DATABASE_ID || SITE_CREATOR_PLACEHOLDER_DATABASE_ID;
/** workers.dev 주소가 이 이름을 따른다. 비워두면 package.json의 이름을 쓴다. */
const workerName = process.env.CLOUDFLARE_WORKER_NAME;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  ...(workerName ? { name: workerName } : {}),
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  // 매일 03:00(KST). 개봉작은 내부 7일 TTL로 건너뛰고 극장 상영 정보만 매일 갱신한다.
  triggers: { crons: ["0 18 * * *"] },
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: process.env.CLOUDFLARE_D1_DATABASE_NAME || "site-creator-d1",
          database_id: databaseId,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
