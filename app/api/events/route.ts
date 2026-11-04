import { NextResponse } from "next/server";
import { createSessionSupabase } from "../../../lib/server/supabase-session";
import { rowToEvent, type EventRow } from "../../../features/events/eventRow";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 100; // 한 번에 가져올 수 있는 기간 (달력 한 화면이면 충분)

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// 일정 목록: GET /api/events?from=2026-11-01&to=2026-11-30
// 해당 기간에 걸치는 일정을 돌려준다. (날짜 미정 일정과 달력에서 숨긴 안은 제외)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || from > to) {
    return errorResponse(
      400,
      "INVALID_RANGE",
      "조회할 기간(from, to)을 YYYY-MM-DD 형식으로 알려 주세요.",
    );
  }
  const days =
    (new Date(`${to}T00:00:00Z`).getTime() -
      new Date(`${from}T00:00:00Z`).getTime()) /
    86_400_000;
  if (days > MAX_RANGE_DAYS) {
    return errorResponse(400, "RANGE_TOO_LONG", "조회 기간이 너무 깁니다.");
  }

  const supabase = await createSessionSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  // 시작일이 기간 안에 있거나, 여러 날 일정이 기간과 겹치는 경우
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .is("hidden_at", null)
    .or(
      `and(start_date.gte.${from},start_date.lte.${to}),and(start_date.lte.${to},end_date.gte.${from})`,
    )
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true })
    .limit(1000);

  if (error) {
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "일정을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
    );
  }

  return NextResponse.json({ data: (data as EventRow[]).map(rowToEvent) });
}
