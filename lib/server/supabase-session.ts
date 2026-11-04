// 로그인한 부원의 권한으로 저장소를 쓰는 서버용 연결.
// 쿠키에 저장된 로그인 정보를 읽어서 쓰므로, 저장소의 접근 규칙(RLS)이 그대로 적용된다.
// 주의: 브라우저로 내려가는 코드에서 가져오지 않는다.
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createSessionSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "저장소 연결 값이 없습니다. .env의 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY를 확인하세요.",
    );
  }

  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 화면(서버 컴포넌트)을 그리는 중에는 쿠키를 바꿀 수 없다.
          // 로그인 정보 갱신은 proxy.ts가 대신 처리하므로 무시해도 된다.
        }
      },
    },
  });
}
