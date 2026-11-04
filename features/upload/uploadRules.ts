// 문서 업로드 규칙. 서버(API)와 업로드 화면이 같은 기준을 쓴다. 서버의 검사가 최종 기준이다.

// 올릴 수 있는 문서 종류
export type UploadKind = "pdf" | "docx" | "image";

export const UPLOAD_KIND_LABEL: Record<UploadKind, string> = {
  pdf: "PDF",
  docx: "Word",
  image: "사진",
};

// 파일 하나의 최대 크기. Vercel에 올리면 한 번에 보낼 수 있는 크기가 약 4.5MB라서 4MB로 둔다.
// 사진은 올리기 전에 브라우저에서 이 크기 안으로 자동으로 줄인다.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

// 한 번에 고를 수 있는 파일 수 (파일은 하나씩 차례로 올린다)
export const MAX_FILES_PER_BATCH = 5;

// 파일 선택 창에서 보여 줄 형식
export const FILE_INPUT_ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp";

export const UNSUPPORTED_FORMAT_MESSAGE =
  "PDF, Word(.docx), 사진(JPEG·PNG·WebP)만 올릴 수 있습니다.";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export type DetectResult =
  | { ok: true; kind: UploadKind }
  | { ok: false; message: string };

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, i) => bytes[offset + i] === value);

// 파일 이름이 아니라 파일 맨 앞의 표식(매직 넘버)으로 종류를 판별한다.
// 이름만 바꾼 가짜 파일(예: 글자 파일을 .pdf로 바꿈)을 걸러내기 위해서다.
export function detectKind(head: Uint8Array, fileName: string): DetectResult {
  const name = fileName.toLowerCase();

  if (startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { ok: true, kind: "pdf" }; // %PDF-
  }
  if (
    startsWith(head, [0xff, 0xd8, 0xff]) || // JPEG
    startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) || // PNG
    (startsWith(head, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(head, [0x57, 0x45, 0x42, 0x50], 8)) // WebP (RIFF....WEBP)
  ) {
    return { ok: true, kind: "image" };
  }
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) {
    // ZIP 모양: Word(.docx), 엑셀, 파워포인트, 한글(.hwpx)이 모두 이 모양이라 이름으로 한 번 더 가린다.
    if (name.endsWith(".docx")) return { ok: true, kind: "docx" };
    return {
      ok: false,
      message: `Word(.docx) 파일만 올릴 수 있습니다. 다른 형식은 PDF나 .docx로 저장해 올려 주세요.`,
    };
  }
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0])) {
    // 구형 Word(.doc)와 한글(.hwp)이 이 모양이다.
    return {
      ok: false,
      message:
        "구형 Word(.doc)와 한글(.hwp) 파일은 읽을 수 없습니다. PDF나 .docx로 저장해 올려 주세요.",
    };
  }
  return { ok: false, message: UNSUPPORTED_FORMAT_MESSAGE };
}
