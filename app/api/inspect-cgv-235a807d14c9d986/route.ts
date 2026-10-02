/**
 * 임시 점검용(확인 후 삭제): CGV 현재상영작 응답에서 영화 2편의 항목 이름과 값 예시를 돌려준다.
 * CGV는 GitHub 서버에서 막혀, 사이트 서버(Cloudflare)에서만 응답을 볼 수 있다.
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36";

function findCurrent(value: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCurrent(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (String(record.tabExpoNm ?? "").replace(/\s/g, "") === "현재상영작" && Array.isArray(record.movctSearchResDtoList)) {
    return record.movctSearchResDtoList as Record<string, unknown>[];
  }
  for (const child of Object.values(record)) {
    const found = findCurrent(child);
    if (found) return found;
  }
  return null;
}

export async function GET() {
  const response = await fetch("https://api.cgv.co.kr/met/dsp/scrDsp/searchScrDspCpotDtl?coCd=A420&unitCpotRelNo=1", {
    headers: {
      Accept: "application/json",
      "Accept-Language": "ko-KR,ko;q=0.9",
      Origin: "https://cgv.co.kr",
      Referer: "https://cgv.co.kr/",
      "User-Agent": UA,
    },
  });
  if (!response.ok) return Response.json({ status: response.status }, { status: 502 });
  const list = findCurrent(await response.json()) ?? [];
  const target = list.find((item) => String(item.movNm ?? "").includes("시간을 달리는"));
  const samples = [target, list[0]].filter(Boolean).map((item) =>
    Object.fromEntries(
      Object.entries(item as Record<string, unknown>).map(([key, value]) => [
        key,
        (typeof value === "object" ? JSON.stringify(value) : String(value)).slice(0, 200),
      ]),
    ),
  );
  return Response.json({ count: list.length, samples }, { headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
