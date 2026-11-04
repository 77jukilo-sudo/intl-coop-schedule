import { NextResponse } from "next/server";
import { createSessionSupabase } from "../../../lib/server/supabase-session";
import type { Member } from "../../../types/schedule";

// 부원 목록: GET /api/members
// 담당자 이름을 보여 주거나 담당자를 고를 때 쓴다. 로그인한 부원만 볼 수 있다.
export async function GET() {
  const supabase = await createSessionSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } },
      { status: 401 },
    );
  }

  const { data, error } = await supabase
    .from("members")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "부원 목록을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data as Member[] });
}
