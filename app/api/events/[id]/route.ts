import { NextResponse, after } from "next/server";
import { describeChange, notifyOthers } from "../../../../lib/server/pushNotify";
import { createSessionSupabase } from "../../../../lib/server/supabase-session";
import { rowToEvent, type EventRow } from "../../../../features/events/eventRow";
import {
  checkCrossFields,
  fieldsToRow,
  parseEventFields,
  type EventFields,
} from "../../../../features/events/eventInput";

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

// 일정 수정: PATCH /api/events/:id
// 본문: { expectedVersion, ...고칠 항목 }  (고칠 항목은 일부만 보내도 된다)
// 동시 수정 감지: 내가 읽었을 때의 버전(expectedVersion)과 지금 저장된 버전이 같을 때만 저장한다.
// 다르면 409를 돌려주고 최신 내용을 함께 보낸다. (다른 사람이 먼저 고친 것을 덮어쓰지 않기 위해서)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return errorResponse(404, "NOT_FOUND", "찾을 수 없는 일정입니다.");
  }

  const body = (await request.json().catch(() => null)) as
    | (Record<string, unknown> & { expectedVersion?: unknown })
    | null;
  const expectedVersion = body?.expectedVersion;
  if (
    typeof expectedVersion !== "number" ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1
  ) {
    return errorResponse(400, "VALIDATION_ERROR", "일정의 버전 정보가 없습니다. 화면을 새로 고친 뒤 다시 시도해 주세요.");
  }

  const parsed = parseEventFields(body);
  if (!parsed.ok) {
    return errorResponse(400, "VALIDATION_ERROR", parsed.message);
  }
  if (Object.keys(parsed.value).length === 0) {
    return errorResponse(400, "VALIDATION_ERROR", "고칠 내용이 없습니다.");
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
  if (!current) {
    return errorResponse(404, "NOT_FOUND", "찾을 수 없는 일정입니다.");
  }
  const currentRow = current as EventRow;

  const conflict = () =>
    errorResponse(
      409,
      "CONFLICT",
      "방금 다른 사람이 이 일정을 고쳤습니다. 최신 내용을 확인한 뒤 다시 저장해 주세요.",
      { data: rowToEvent(currentRow) },
    );
  if (currentRow.version !== expectedVersion) return conflict();

  // 고친 값을 현재 값과 합쳐서 항목끼리의 관계(종료일 ≥ 시작일 등)를 검사한다.
  const merged: EventFields = {
    title: parsed.value.title ?? currentRow.title,
    startDate: parsed.value.startDate ?? currentRow.start_date ?? "",
    endDate: "endDate" in parsed.value ? (parsed.value.endDate ?? null) : currentRow.end_date,
    startTime:
      "startTime" in parsed.value
        ? (parsed.value.startTime ?? null)
        : (currentRow.start_time?.slice(0, 5) ?? null),
    endTime:
      "endTime" in parsed.value
        ? (parsed.value.endTime ?? null)
        : (currentRow.end_time?.slice(0, 5) ?? null),
    isOverseas: parsed.value.isOverseas ?? currentRow.is_overseas,
    city: "city" in parsed.value ? (parsed.value.city ?? null) : currentRow.city,
    country: "country" in parsed.value ? (parsed.value.country ?? null) : currentRow.country,
    assigneeId: "assigneeId" in parsed.value ? (parsed.value.assigneeId ?? null) : currentRow.assignee_id,
    status: parsed.value.status ?? (currentRow.status as EventFields["status"]),
    workCategory:
      parsed.value.workCategory ?? (currentRow.work_category as EventFields["workCategory"]),
  };
  // 날짜 미정 일정(시작일 없음)도 제목 수정·취소 처리 등은 할 수 있다. 관련 규칙은 checkCrossFields가 본다.
  const crossError = checkCrossFields(merged);
  if (crossError) return errorResponse(400, "VALIDATION_ERROR", crossError);

  // 1안·2안 일정은 나머지 안을 숨기는 일이 함께 필요하므로, 확정은 상세 화면의 "확정" 버튼(안 확정)으로만 한다.
  if (
    currentRow.group_id &&
    parsed.value.status === "confirmed" &&
    currentRow.status !== "confirmed"
  ) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "1안·2안 일정은 상세 화면의 \"확정\" 버튼으로 확정해 주세요. 다른 안이 달력에서 함께 정리됩니다.",
    );
  }

  // 저장 순간에도 버전이 같은지 다시 확인한다. (읽은 뒤 저장하기 전에 다른 사람이 고쳤을 수 있다)
  const { data: updated, error: updateError } = await supabase
    .from("events")
    .update(fieldsToRow(parsed.value))
    .eq("id", id)
    .eq("version", expectedVersion)
    .select("*");

  if (updateError) {
    if (updateError.code === "23503") {
      return errorResponse(400, "VALIDATION_ERROR", "담당자를 다시 선택해 주세요.");
    }
    return errorResponse(500, "INTERNAL_ERROR", "일정을 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  }
  if (!updated || updated.length === 0) {
    // 그 사이에 다른 사람이 먼저 저장했다. 최신 내용을 다시 읽어 돌려준다.
    const { data: latest } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!latest) return errorResponse(404, "NOT_FOUND", "찾을 수 없는 일정입니다.");
    return errorResponse(
      409,
      "CONFLICT",
      "방금 다른 사람이 이 일정을 고쳤습니다. 최신 내용을 확인한 뒤 다시 저장해 주세요.",
      { data: rowToEvent(latest as EventRow) },
    );
  }

  // 바뀐 내용이 있으면 알림을 켜 둔 다른 부원에게 알린다. (응답을 보낸 뒤에 처리하고, 실패해도 저장에는 영향이 없다)
  const savedRow = updated[0] as EventRow;
  const changes = describeChange(currentRow, savedRow);
  if (changes.length > 0) {
    const actorId = userData.user.id;
    after(() =>
      notifyOthers({
        actorId,
        text: (name) => `${name}님이 ‘${savedRow.title}’ 일정을 수정했습니다: ${changes.join(", ")}`,
      }),
    );
  }

  return NextResponse.json({ data: rowToEvent(savedRow) });
}
