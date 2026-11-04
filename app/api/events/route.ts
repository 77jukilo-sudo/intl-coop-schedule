import { NextResponse } from "next/server";
import { createSessionSupabase } from "../../../lib/server/supabase-session";
import { rowToEvent, type EventRow } from "../../../features/events/eventRow";
import {
  checkCrossFields,
  fieldsToRow,
  parseEventFields,
  type EventFields,
} from "../../../features/events/eventInput";
import { MANUAL_SOURCE_NAME } from "../../../types/schedule";

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

// 일정 직접 추가: POST /api/events
// 문서 없이 달력에서 입력한 일정이라 출처는 "직접 입력"으로 저장한다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseEventFields(body);
  if (!parsed.ok) {
    return errorResponse(400, "VALIDATION_ERROR", parsed.message);
  }
  if (!parsed.value.title || !parsed.value.startDate) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "행사명과 시작일은 꼭 입력해 주세요.",
    );
  }

  const fields: EventFields = {
    title: parsed.value.title,
    startDate: parsed.value.startDate,
    endDate: parsed.value.endDate ?? null,
    startTime: parsed.value.startTime ?? null,
    endTime: parsed.value.endTime ?? null,
    isOverseas: parsed.value.isOverseas ?? false,
    city: parsed.value.city ?? null,
    country: parsed.value.country ?? null,
    assigneeId: parsed.value.assigneeId ?? null,
    status: parsed.value.status ?? "confirmed",
  };
  const crossError = checkCrossFields(fields);
  if (crossError) return errorResponse(400, "VALIDATION_ERROR", crossError);

  const supabase = await createSessionSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  const { data, error } = await supabase
    .from("events")
    .insert({ ...fieldsToRow(fields), source_name: MANUAL_SOURCE_NAME })
    .select("*")
    .single();

  if (error) {
    // 23503: 없는 부원을 담당자로 지정한 경우
    if (error.code === "23503") {
      return errorResponse(400, "VALIDATION_ERROR", "담당자를 다시 선택해 주세요.");
    }
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "일정을 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
    );
  }

  return NextResponse.json({ data: rowToEvent(data as EventRow) }, { status: 201 });
}
