import { NextResponse } from "next/server";
import { createSessionSupabase } from "../../../lib/server/supabase-session";
import {
  MAX_UPLOAD_BYTES,
  detectKind,
  formatBytes,
  type UploadKind,
} from "../../../features/upload/uploadRules";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// 파일 받기: POST /api/upload  (multipart/form-data, 항목 이름 "file", 파일 하나씩)
// 지금 단계(작업 12)는 파일을 받아 형식과 크기만 확인한다. AI 일정 추출은 작업 13번에서 이어 붙인다.
// 원본 문서와 사진은 저장하지 않는다. (PRD 7번) 확인이 끝나면 메모리에서 사라진다.
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

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detected = detectKind(head, file.name);
  if (!detected.ok) {
    return errorResponse(415, "UNSUPPORTED_FORMAT", detected.message);
  }

  const kind: UploadKind = detected.kind;
  return NextResponse.json({
    data: { fileName: file.name, kind, sizeBytes: file.size },
  });
}
