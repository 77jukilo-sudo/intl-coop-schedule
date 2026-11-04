import { NextResponse, after } from "next/server";
import { describeChange, notifyOthers } from "../../../../../lib/server/pushNotify";
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

// 변경으로 반영: POST /api/events/:id/merge   (:id = 고칠 기존 일정)
// 본문: { newId, expectedVersion }  newId = 다시 올린 문서에서 새로 생긴 일정
// 기존 일정에 새 내용을 반영하고 새 일정은 달력에서 숨긴다. 부원이 "변경으로 반영"을 눌렀을 때만 부른다.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    newId?: unknown;
    expectedVersion?: unknown;
  } | null;
  const newId = body?.newId;
  const expectedVersion = body?.expectedVersion;

  if (!UUID_PATTERN.test(id)) {
    return errorResponse(404, "NOT_FOUND", "찾을 수 없는 일정입니다.");
  }
  if (typeof newId !== "string" || !UUID_PATTERN.test(newId) || newId === id) {
    return errorResponse(400, "VALIDATION_ERROR", "반영할 새 일정을 확인해 주세요.");
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
  if (row.hidden_at || row.group_id) {
    return errorResponse(400, "VALIDATION_ERROR", "이 일정에는 변경을 반영할 수 없습니다.");
  }

  const { data: updated, error: rpcError } = await supabase.rpc("apply_event_change", {
    p_existing_id: id,
    p_expected_version: expectedVersion,
    p_new_id: newId,
  });
  if (rpcError) {
    console.error(`[merge] 변경 반영 오류: ${rpcError.code ?? "unknown"}`);
    return errorResponse(500, "INTERNAL_ERROR", "변경을 반영하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  }

  const rows = (updated ?? []) as EventRow[];
  if (rows.length === 0) {
    // 그 사이에 기존 일정이 바뀌었거나, 새 일정이 이미 처리되어 숨겨졌다.
    const { data: latest } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    if (!latest) return errorResponse(404, "NOT_FOUND", "찾을 수 없는 일정입니다.");
    const latestRow = latest as EventRow;
    if (latestRow.version === expectedVersion) {
      return errorResponse(400, "VALIDATION_ERROR", "새 일정이 이미 처리되었거나 찾을 수 없습니다. 달력을 새로 불러와 확인해 주세요.");
    }
    return conflict(latestRow);
  }

  // 변경 반영을 알림을 켜 둔 다른 부원에게 알린다.
  const mergedRow = rows[0];
  const changes = describeChange(row, mergedRow);
  if (changes.length > 0) {
    const actorId = userData.user.id;
    after(() =>
      notifyOthers({
        actorId,
        text: (name) => `${name}님이 새 문서 내용으로 ‘${mergedRow.title}’ 일정을 수정했습니다: ${changes.join(", ")}`,
      }),
    );
  }

  return NextResponse.json({ data: rowToEvent(mergedRow) });
}
