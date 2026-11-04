import { NextResponse } from "next/server";
import { createSessionSupabase } from "../../../../lib/server/supabase-session";
import { rowToEvent, type EventRow } from "../../../../features/events/eventRow";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// 날짜 미정 일정 목록: GET /api/events/undated
// 문서에 정확한 날짜가 없어서 달력에 올라가지 못한 일정을 모아 돌려준다.
// (달력에서 숨긴 안과 취소된 일정은 뺀다)
export async function GET() {
  const supabase = await createSessionSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .is("start_date", null)
    .is("hidden_at", null)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "날짜 미정 목록을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
    );
  }

  return NextResponse.json({ data: (data as EventRow[]).map(rowToEvent) });
}
