import { redirect } from "next/navigation";

// 첫 화면은 개봉작 목록이다. 검색·가격 비교는 /search 로 옮겼다.
export default function Home() {
  redirect("/movies/now");
}
