/** 사이트맵·robots·메타데이터가 같은 주소를 쓰도록 한곳에서 관리한다. */
const FALLBACK_SITE_URL = "https://where-to-watch-kr.so0yeon.chatgpt.site";

export function getSiteUrl() {
  return (process.env.PUBLIC_SITE_URL || FALLBACK_SITE_URL).replace(/\/$/, "");
}
