import { NextResponse } from "next/server";
import { createSessionSupabase } from "../../../lib/server/supabase-session";
import {
  ExtractError,
  extractEventsFromDocument,
  type ExtractErrorCode,
} from "../../../lib/server/extractEvents";
import {
  MAX_UPLOAD_BYTES,
  detectKind,
  formatBytes,
} from "../../../features/upload/uploadRules";

// 문서를 AI가 읽는 시간까지 포함해서 최대 1분 안에 끝내야 한다. (PRD: 업로드 후 1분 이내)
export const maxDuration = 60;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const STATUS_BY_EXTRACT_ERROR: Record<ExtractErrorCode, number> = {
  UNREADABLE: 422,
  AI_CONFIG: 503,
  AI_BUSY: 429,
  AI_TIMEOUT: 504,
  AI_FAILED: 502,
};

// 문서 올리기: POST /api/upload  (multipart/form-data, 항목 이름 "file", 파일 하나씩)
// 1) 형식·크기 확인 → 2) AI가 일정 추출 → 3) "확인 전(회색)" 일정으로 저장
// 원본 문서와 사진은 저장하지 않는다. (PRD 7번) 일정 정보와 출처 문서명만 남는다.
export async function POST(request: Request) {
  const supabase = await createSessionSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  // 본문을 읽기 전에 헤더의 크기부터 확인해서, 너무 큰 파일은 읽지 않고 돌려보낸다.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES + 64 * 1024) {
    return errorResponse(
      413,
      "FILE_TOO_LARGE",
      `파일이 너무 큽니다. ${formatBytes(MAX_UPLOAD_BYTES)} 이하로 올려 주세요.`,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "VALIDATION_ERROR", "보낸 파일을 읽을 수 없습니다.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return errorResponse(400, "VALIDATION_ERROR", "올릴 파일을 선택해 주세요.");
  }
  if (file.size === 0) {
    return errorResponse(400, "VALIDATION_ERROR", "비어 있는 파일입니다.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return errorResponse(
      413,
      "FILE_TOO_LARGE",
      `파일이 너무 큽니다(${formatBytes(file.size)}). ${formatBytes(MAX_UPLOAD_BYTES)} 이하로 올려 주세요.`,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectKind(new Uint8Array(bytes.subarray(0, 16)), file.name);
  if (!detected.ok) {
    return errorResponse(415, "UNSUPPORTED_FORMAT", detected.message);
  }

  // AI가 일정을 뽑는다.
  let extraction;
  try {
    extraction = await extractEventsFromDocument({ kind: detected.kind, bytes });
  } catch (error) {
    if (error instanceof ExtractError) {
      return errorResponse(STATUS_BY_EXTRACT_ERROR[error.code], error.code, error.message);
    }
    console.error("[upload] 일정 추출 중 예상하지 못한 오류");
    return errorResponse(500, "INTERNAL_ERROR", "문서를 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  }

  // 출처 문서명 (제어 문자를 빼고 200자까지)
  const sourceName =
    file.name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200) || "이름 없는 문서";

  // 추출한 일정은 모두 "확인 전(회색)"으로 저장한다. 부원이 확인해 확정하기 전에는 확정으로 올리지 않는다.
  // 1안·2안은 같은 묶음 번호(group_id)로 이어 둔다. 안은 확정 전이라 "미확정(파란색)"으로 저장한다.
  const groupIds = new Map<string, string>();
  const groupIdOf = (name: string | null) => {
    if (name === null) return null;
    if (!groupIds.has(name)) groupIds.set(name, crypto.randomUUID());
    return groupIds.get(name) ?? null;
  };
  const rows = extraction.events.map((event) => ({
    group_id: groupIdOf(event.optionGroup),
    option_no: event.optionNo,
    title: event.title,
    start_date: event.startDate,
    end_date: event.endDate,
    date_note: event.dateNote,
    start_time: event.startTime,
    end_time: event.endTime,
    is_overseas: event.isOverseas,
    city: event.city,
    country: event.country,
    status: event.optionNo !== null ? "tentative" : "pending_review",
    source_name: sourceName,
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from("events").insert(rows);
    if (error) {
      console.error(`[upload] 일정 저장 오류: ${error.code ?? "unknown"}`);
      return errorResponse(500, "INTERNAL_ERROR", "일정을 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
    }
  }

  return NextResponse.json({
    data: {
      fileName: file.name,
      kind: detected.kind,
      sizeBytes: file.size,
      createdCount: rows.length,
      undatedCount: extraction.events.filter((e) => !e.startDate).length,
      truncated: extraction.truncated,
      // 화면에 "이런 일정을 올렸습니다"를 보여 주기 위한 목록 (최대 50건)
      events: extraction.events.slice(0, 50).map((e) => ({
        title: e.title,
        startDate: e.startDate,
        dateNote: e.dateNote,
        optionNo: e.optionNo,
      })),
    },
  });
}
