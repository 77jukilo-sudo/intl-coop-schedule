"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "../../app/login/actions";
import { ImagePrepError, prepareImage } from "./imagePrep";
import {
  FILE_INPUT_ACCEPT,
  MAX_FILES_PER_BATCH,
  MAX_UPLOAD_BYTES,
  UPLOAD_KIND_LABEL,
  formatBytes,
  type UploadKind,
} from "./uploadRules";

type ItemStatus = "ready" | "working" | "done" | "error";

interface Item {
  id: number;
  file: File;
  status: ItemStatus;
  message: string | null;
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  ready: "올리기 전",
  working: "확인 중...",
  done: "확인 완료",
  error: "올리지 못함",
};

let nextItemId = 1;

// 문서 올리기(팝업): 보고자료(PDF·Word·사진)를 골라 올린다.
// 지금 단계(작업 12)는 파일을 받아 형식과 크기를 확인하는 데까지 한다.
// AI가 일정을 찾아 달력에 올리는 기능은 작업 13번에서 이어 붙인다.
export default function UploadPanel({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function patchItem(id: number, patch: Partial<Item>) {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // 같은 파일을 다시 골라도 선택이 인식되도록 비운다
    if (picked.length === 0) return;

    const accepted = picked.slice(0, MAX_FILES_PER_BATCH);
    setNotice(
      picked.length > MAX_FILES_PER_BATCH
        ? `한 번에 ${MAX_FILES_PER_BATCH}개까지만 올릴 수 있어 앞의 ${MAX_FILES_PER_BATCH}개만 담았습니다.`
        : null,
    );
    setItems(
      accepted.map((file) => ({
        id: nextItemId++,
        file,
        status: "ready" as const,
        message: null,
      })),
    );
  }

  // 파일을 하나씩 차례로 올린다. (한 번에 보낼 수 있는 크기에 제한이 있기 때문)
  async function uploadOne(item: Item) {
    patchItem(item.id, { status: "working", message: null });

    let toSend = item.file;
    try {
      if (item.file.type.startsWith("image/")) {
        toSend = await prepareImage(item.file, MAX_UPLOAD_BYTES);
      }
    } catch (error) {
      patchItem(item.id, {
        status: "error",
        message:
          error instanceof ImagePrepError
            ? error.message
            : "사진을 준비하지 못했습니다. 다른 사진으로 시도해 주세요.",
      });
      return;
    }

    const form = new FormData();
    form.append("file", toSend);
    try {
      const response = await fetch("/api/upload", { method: "POST", body: form });
      if (response.status === 401) {
        await signOut();
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        data?: { kind: UploadKind; sizeBytes: number };
        error?: { message: string };
      } | null;

      if (response.ok && body?.data) {
        patchItem(item.id, {
          status: "done",
          message: `${UPLOAD_KIND_LABEL[body.data.kind]} · ${formatBytes(body.data.sizeBytes)}`,
        });
      } else {
        patchItem(item.id, {
          status: "error",
          message: body?.error?.message ?? "올리지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
        });
      }
    } catch {
      patchItem(item.id, {
        status: "error",
        message: "네트워크 연결을 확인해 주세요.",
      });
    }
  }

  async function handleUpload() {
    if (running) return;
    setRunning(true);
    // 아직 안 올린 파일과 실패한 파일을 올린다.
    for (const item of items.filter((i) => i.status === "ready" || i.status === "error")) {
      await uploadOne(item);
    }
    setRunning(false);
  }

  const doneCount = items.filter((i) => i.status === "done").length;
  const pendingCount = items.filter((i) => i.status === "ready" || i.status === "error").length;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="upload-title"
      className="m-auto max-h-[92dvh] w-[min(94vw,32rem)] overflow-y-auto rounded-xl border border-foreground/15 bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="upload-title" className="text-lg font-semibold">
            문서 올리기
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="닫기"
            className="h-9 w-9 shrink-0 rounded-lg border border-foreground/20 hover:bg-foreground/5"
          >
            ✕
          </button>
        </div>

        {/* PRD 7번: 대외비 문서는 올리지 않는다는 안내 */}
        <div
          role="note"
          className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
        >
          <p className="font-semibold">대외비·기밀 표시가 있는 문서는 올리지 마세요.</p>
          <p className="mt-1 text-foreground/80">
            일정을 찾기 위해 문서 내용이 외부 AI 서비스로 전송될 수 있습니다. 올린
            원본 파일은 저장하지 않습니다.
          </p>
        </div>

        <p className="text-sm text-foreground/70">
          PDF, Word(.docx), 사진(JPEG·PNG·WebP)을 올릴 수 있습니다. 파일 하나는
          {" "}{formatBytes(MAX_UPLOAD_BYTES)} 이하이고, 사진은 자동으로 줄여서
          올립니다. 한글(.hwp) 문서는 PDF로 저장해서 올려 주세요.
        </p>

        <div>
          <input
            type="file"
            multiple
            accept={FILE_INPUT_ACCEPT}
            onChange={handleSelect}
            disabled={running}
            className="peer sr-only"
            id="upload-input"
          />
          {/* 키보드로 이동했을 때도 어디에 있는지 보이도록 peer로 표시를 단다 */}
          <label
            htmlFor="upload-input"
            className={`inline-flex h-11 cursor-pointer items-center rounded-lg border border-foreground/20 px-4 text-base hover:bg-foreground/5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foreground ${
              running ? "pointer-events-none opacity-60" : ""
            }`}
          >
            파일 고르기 (최대 {MAX_FILES_PER_BATCH}개)
          </label>
        </div>

        {notice ? <p className="text-sm text-foreground/70">{notice}</p> : null}

        {items.length > 0 ? (
          <ul className="flex flex-col gap-2" aria-live="polite">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-foreground/10 p-2.5 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-all font-medium">{item.file.name}</span>
                  <span
                    className={`shrink-0 text-xs ${
                      item.status === "done"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : item.status === "error"
                          ? "text-red-600"
                          : "text-foreground/60"
                    }`}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-foreground/60">
                  {item.message ?? `선택한 크기 ${formatBytes(item.file.size)}`}
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {doneCount > 0 && pendingCount === 0 && !running ? (
          <p role="status" className="text-sm text-foreground/80">
            파일 확인을 마쳤습니다. AI가 일정을 찾아 달력에 올리는 기능은 아직
            준비 중입니다.
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="h-11 rounded-lg border border-foreground/20 px-4 text-base hover:bg-foreground/5"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={running || pendingCount === 0}
            className="h-11 rounded-lg bg-foreground px-5 text-base font-medium text-background disabled:opacity-60"
          >
            {running ? "올리는 중..." : "올리기"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
