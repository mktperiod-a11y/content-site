// 임시 점검용: 극장 3사 현재상영작 응답에서 영화 1편의 항목 이름과 값 예시를 출력한다.
// 포스터 주소가 어떤 항목에 오는지 확인하려는 것이며, 데이터는 저장하지 않는다.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36";
const LOOK = /\.(jpe?g|png|webp|gif)(\?|$)|img|poster|thumb|image/i;

async function json(url, init) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function findCgv(value) {
  if (Array.isArray(value)) { for (const v of value) { const f = findCgv(v); if (f) return f; } return null; }
  if (!value || typeof value !== "object") return null;
  if (String(value.tabExpoNm ?? "").replace(/\s/g, "") === "현재상영작" && Array.isArray(value.movctSearchResDtoList)) return value.movctSearchResDtoList;
  for (const v of Object.values(value)) { const f = findCgv(v); if (f) return f; }
  return null;
}

function report(name, items, titleKey) {
  console.log(`\n===== ${name}: ${items.length}편 =====`);
  if (!items.length) return;
  const pick = items.find((x) => String(x[titleKey] ?? "").includes("시간을 달리는")) ?? items[0];
  console.log(`예시 작품: ${pick[titleKey]}`);
  for (const [key, value] of Object.entries(pick)) {
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    const mark = LOOK.test(key) || LOOK.test(text) ? "  <== 이미지 후보" : "";
    console.log(`  ${key} = ${text.slice(0, 160)}${mark}`);
  }
}

async function run(name, load, titleKey) {
  try { report(name, await load(), titleKey); } catch (error) { console.log(`\n===== ${name}: 실패 ${error.message} =====`); }
}

await run("CGV", async () => findCgv(await json("https://api.cgv.co.kr/met/dsp/scrDsp/searchScrDspCpotDtl?coCd=A420&unitCpotRelNo=1", {
  headers: { Accept: "application/json", "Accept-Language": "ko-KR,ko;q=0.9", Origin: "https://cgv.co.kr", Referer: "https://cgv.co.kr/", "User-Agent": UA },
})) ?? [], "movNm");

await run("메가박스", async () => (await json("https://www.megabox.co.kr/on/oh/oha/Movie/selectMovieList.do", {
  method: "POST",
  headers: { Accept: "application/json", "Content-Type": "application/json;charset=UTF-8", "User-Agent": UA },
  body: JSON.stringify({ currentPage: "1", recordCountPerPage: "200", pageType: "ticketing", ibxMovieNo: "", onairYn: "Y", specialType: "", isAdult: "", masterType: "movie", sortType: "1" }),
})).movieList ?? [], "movieNm");

await run("롯데시네마", async () => {
  const body = new FormData();
  body.set("paramList", JSON.stringify({ MethodName: "GetMoviesToBe", channelType: "HO", osType: "Chrome", osVersion: UA, multiLanguageID: "KR", division: 1, moviePlayYN: "Y", orderType: "1", blockSize: 1000, pageNo: 1, memberOnNo: "0", imgdivcd: 2 }));
  return (await json("https://www.lottecinema.co.kr/LCWS/Movie/MovieData.aspx", { method: "POST", headers: { Accept: "application/json", "User-Agent": UA }, body })).Movies?.Items ?? [];
}, "MovieNameKR");
