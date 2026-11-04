// 브라우저에서 쓰는 저장소 연결 (로그인한 부원의 권한으로 동작).
// 로그인 정보는 쿠키에서 읽는다. 공개해도 되는 값(NEXT_PUBLIC_ 로 시작)만 사용하고,
// 비밀 키는 여기서 절대 쓰지 않는다.
import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function createBrowserSupabase() {
  if (!url || !publishableKey) {
    throw new Error(
      "저장소 연결 값이 없습니다. .env의 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 확인하세요.",
    );
  }
  // 로그인 쿠키는 배포(https)에서 보안 연결로만 보낸다.
  return createBrowserClient(url, publishableKey, {
    cookieOptions: { secure: process.env.NODE_ENV === "production" },
  });
}
