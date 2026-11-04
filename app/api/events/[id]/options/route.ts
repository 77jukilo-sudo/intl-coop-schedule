import { NextResponse, after } from "next/server";
import { notifyOthers } from "../../../../../lib/server/pushNotify";
import { createSessionSupabase } from "../../../../../lib/server/supabase-session";
import { rowToEvent, type EventRow } from "../../../../../features/events/eventRow";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResponse(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json({ error: { code, message }, ...extra }, { status });
}

// 같은 묶음(1안·2안…)의 안 목록: GET /api/events/:id/options
// 숨겨진 안도 포함해서 안 번호 순으로 돌려준다. 안이 없는 일정이면 빈 목록이다.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return errorResponse(404, "NOT_FOUND", "찾을 수 없는 일정입니다.");
  }

  const supabase = await createSessionSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  const { data: self, error: selfError } = await supabase
    .from("events")
    .select("group_id")
    .eq("id", id)
    .maybeSingle();
  if (selfError) {
    return errorResponse(500, "INTERNAL_ERROR", "안 목록을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  }
  if (!self) return errorResponse(404, "NOT_FOUND", "찾을 수 없는 일정입니다.");
  if (!self.group_id) return NextResponse.json({ data: [] });

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("group_id", self.group_id)
    .order("option_no", { ascending: true });
  if (error) {
    return errorResponse(500, "INTERNAL_ERROR", "안 목록을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  }

  return NextResponse.json({ data: (data as EventRow[]).map(rowToEvent) });
}

// 안 확정 / 확정 되돌리기: POST /api/events/:id/options
// 본문: { action: "choose" | "reopen", expectedVersion }
//  - choose: 이 안을 확정하고, 같은 묶음의 나머지 안을 달력에서 숨긴다(기록은 남김).
//  - reopen: 이 안을 미확정으로 되돌리고, 숨겼던 다른 안을 다시 보이게 한다.
// 확정과 숨김은 저장소 함수 하나로 한 번에 처리한다. 동시 수정 규칙은 일정 수정과 같다.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return errorResponse(404, "NOT_FOUND", "찾을 수 없는 일정입니다.");
  }

  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    expectedVersion?: unknown;
  } | null;
  const action = body?.action;
  const expectedVersion = body?.expectedVersion;
  if (action !== "choose" && action !== "reopen") {
    return errorResponse(400, "VALIDATION_ERROR", "처리할 내용을 확인해 주세요.");
  }
  if (
    typeof expectedVersion !== "number" ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1
  ) {
    return errorResponse(400, "VALIDATION_ERROR", "일정의 버전 정보가 없습니다. 화면을 새로 고친 뒤 다시 시도해 주세요.");
  }

  const supabase = await createSessionSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  const { data: current, error: readError } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) {
    return errorResponse(500, "INTERNAL_ERROR", "일정을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  }
  if (!current) return errorResponse(404, "NOT_FOUND", "찾을 수 없는 일정입니다.");
  const row = current as EventRow;

  const conflict = (latest: EventRow) =>
    errorResponse(
      409,
      "CONFLICT",
      "방금 다른 사람이 이 일정을 고쳤습니다. 최신 내용을 확인한 뒤 다시 시도해 주세요.",
      { data: rowToEvent(latest) },
    );
  if (row.version !== expectedVersion) return conflict(row);

  if (!row.group_id) {
    return errorResponse(400, "VALIDATION_ERROR", "1안·2안으로 묶인 일정이 아닙니다.");
  }
  if (row.hidden_at) {
    return errorResponse(400, "VALIDATION_ERROR", "달력에서 숨겨진 안입니다. 확정한 안에서 되돌려 주세요.");
  }
  if (action === "choose") {
    if (row.status === "confirmed" || row.status === "cancelled") {
      return errorResponse(400, "VALIDATION_ERROR", "확인 전이거나 미확정인 안만 확정할 수 있습니다.");
    }
    if (!row.start_date) {
      return errorResponse(400, "VALIDATION_ERROR", "날짜가 정해져야 확정할 수 있습니다. 날짜를 먼저 입력해 주세요.");
    }
  } else if (row.status !== "confirmed") {
    return errorResponse(400, "VALIDATION_ERROR", "확정된 안만 되돌릴 수 있습니다.");
  }

  const { data: updated, error: rpcError } = await supabase.rpc(
    action === "choose" ? "choose_event_option" : "reopen_event_options",
    { p_event_id: id, p_expected_version: expectedVersion },
  );
  if (rpcError) {
    console.error(`[options] 안 처리 오류: ${rpcError.code ?? "unknown"}`);
    return errorResponse(500, "INTERNAL_ERROR", "처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  }

  const rows = (updated ?? []) as EventRow[];
  if (rows.length === 0) {
    // 읽은 뒤 저장하기 전에 다른 사람이 먼저 고쳤다. 최신 내용을 다시 읽어 돌려준다.
    const { data: latest } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    if (!latest) return errorResponse(404, "NOT_FOUND", "찾을 수 없는 일정입니다.");
    return conflict(latest as EventRow);
  }

  // 확정·확정 되돌리기를 알림을 켜 둔 다른 부원에게 알린다.
  const resultRow = rows[0];
  const actorId = userData.user.id;
  after(() =>
    notifyOthers({
      actorId,
      text: (name) =>
        action === "choose"
          ? `${name}님이 ‘${resultRow.title}’ ${resultRow.option_no ?? ""}안을 확정했습니다. 나머지 안은 달력에서 숨겨졌습니다.`
          : `${name}님이 ‘${resultRow.title}’ 확정을 되돌렸습니다. 숨겨졌던 안이 다시 보입니다.`,
    }),
  );

  return NextResponse.json({ data: rowToEvent(resultRow) });
}
