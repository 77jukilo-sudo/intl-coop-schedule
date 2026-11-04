// 서버에서만 쓰는 저장소 연결 (관리자 권한, 접근 규칙(RLS)을 건너뛴다).
// 주의: 이 파일은 브라우저로 내려가는 코드(화면 컴포넌트 등)에서 가져오면 안 된다.
// 비밀 키(SUPABASE_SECRET_KEY)는 NEXT_PUBLIC_ 이 붙지 않아 서버에서만 읽힌다.
// 부원 대신 일하는 용도(예: 1년 지난 기록 정리)로만 쓰고, 일반 화면의 조회·저장은
// 로그인한 부원의 권한으로 처리한다. (작업 4번 로그인에서 연결)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export function createAdminSupabase() {
  if (!url || !secretKey) {
    throw new Error(
      "서버용 저장소 연결 값이 없습니다. .env의 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY를 확인하세요.",
    );
  }
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
