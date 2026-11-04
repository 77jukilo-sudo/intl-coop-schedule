import type { MetadataRoute } from "next";

// 앱 정보: iPhone 등에서 "홈 화면에 추가"로 앱처럼 설치할 수 있게 한다.
// (iPhone은 홈 화면에 추가한 앱에서만 푸시 알림을 받을 수 있다.)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "국제협력부 일정",
    short_name: "국제협력부",
    description: "국제협력부 부원이 함께 보는 공용 일정 달력",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    lang: "ko",
  };
}
