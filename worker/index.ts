/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { syncReleaseCatalog } from "../lib/release-catalog";
import {
  syncTheaterCatalog,
  syncTheaterKobisMatches,
  syncTheaterPosters,
} from "../lib/theater-catalog";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  KOBIS_API_KEY?: string;
  TMDB_API_KEY?: string;
  KOBIS_API_BASE?: string;
  TMDB_API_BASE?: string;
  TMDB_IMAGE_BASE?: string;
  PUBLIC_SITE_URL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

/**
 * Sites 런타임이 넘겨주는 값 중 서버 코드가 process.env로 읽는 키.
 * fetch와 scheduled가 같은 목록을 쓰게 해, 크론으로 도는 수집이 요청 경로와
 * 다른 설정으로 동작하지 않도록 한다.
 */
const RUNTIME_ENV_KEYS = [
  "KOBIS_API_KEY",
  "TMDB_API_KEY",
  "KOBIS_API_BASE",
  "TMDB_API_BASE",
  "TMDB_IMAGE_BASE",
  "PUBLIC_SITE_URL",
] as const;

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Server Components and route handlers read the request-scoped D1 binding
    // through db/index.ts without importing a Cloudflare-only module in Node tests.
    (globalThis as typeof globalThis & { __WHERE_TO_WATCH_DB__?: D1Database })
      .__WHERE_TO_WATCH_DB__ = env.DB;

    // Sites runtime bindings are injected through env. Keep every secret server-side
    // and expose it only to server components and route handlers via process.env.
    for (const key of RUNTIME_ENV_KEYS) {
      const value = env[key];
      if (value) process.env[key] = value;
    }

    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    (globalThis as typeof globalThis & { __WHERE_TO_WATCH_DB__?: D1Database })
      .__WHERE_TO_WATCH_DB__ = env.DB;
    for (const key of RUNTIME_ENV_KEYS) {
      const value = env[key];
      if (value) process.env[key] = value;
    }
    ctx.waitUntil(
      Promise.allSettled([syncReleaseCatalog(), syncTheaterCatalog()])
        // 포스터 보강과 KOBIS 매칭은 갓 저장된 극장 목록을 읽으므로 그 뒤에 돈다.
        .then(() => Promise.allSettled([syncTheaterPosters(), syncTheaterKobisMatches()]))
        .then(() => undefined),
    );
  },
};

export default worker;
