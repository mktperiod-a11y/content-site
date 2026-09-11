import { syncReleaseCatalog } from "@/lib/release-catalog";
import { syncTheaterCatalog } from "@/lib/theater-catalog";

export async function POST() {
  try {
    const [releases, theaters] = await Promise.all([
      syncReleaseCatalog(),
      syncTheaterCatalog(),
    ]);
    return Response.json({ releases, theaters });
  } catch (error) {
    console.error("Release catalog refresh failed", error);
    return Response.json(
      { error: "개봉 정보를 갱신하지 못했어요. 저장된 기존 목록은 유지됩니다." },
      { status: 502 },
    );
  }
}
