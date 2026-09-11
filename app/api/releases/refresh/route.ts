import { syncReleaseCatalog } from "@/lib/release-catalog";
import { syncTheaterCatalog } from "@/lib/theater-catalog";

export async function POST() {
  const [releaseResult, theaterResult] = await Promise.allSettled([
    syncReleaseCatalog(),
    syncTheaterCatalog(),
  ]);

  if (releaseResult.status === "rejected") {
    console.error("Release catalog refresh failed", releaseResult.reason);
  }
  if (theaterResult.status === "rejected") {
    console.error("Theater catalog refresh failed", theaterResult.reason);
  }

  if (releaseResult.status === "rejected" && theaterResult.status === "rejected") {
    return Response.json(
      { error: "영화 정보를 갱신하지 못했어요. 저장된 기존 목록은 유지됩니다." },
      { status: 502 },
    );
  }

  return Response.json({
    releases: releaseResult.status === "fulfilled" ? releaseResult.value : null,
    theaters: theaterResult.status === "fulfilled" ? theaterResult.value : null,
    partial: releaseResult.status === "rejected" || theaterResult.status === "rejected",
  });
}
