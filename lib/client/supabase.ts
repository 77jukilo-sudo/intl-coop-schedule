// 브라우저에서 쓰는 저장소 연결.
// 공개해도 되는 값(NEXT_PUBLIC_ 로 시작)만 사용한다. 비밀 키는 여기서 절대 쓰지 않는다.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function createBrowserSupabase() {
  if (!url || !publishableKey) {
    throw new Error(
      "저장소 연결 값이 없습니다. .env의 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 확인하세요.",
    );
  }
  return createClient(url, publishableKey);
}
