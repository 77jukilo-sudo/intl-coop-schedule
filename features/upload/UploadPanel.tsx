"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "../../app/login/actions";
import type { ScheduleEvent } from "../../types/schedule";
import { formatShortDay } from "../calendar/dateUtils";
import { applyChange } from "../events/eventApi";
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
  // 올라간 일정 목록 (결과를 눈으로 확인할 수 있게 보여 준다)
  found: FoundEvent[];
  // "변경으로 반영할까요?" 질문 목록 (비슷한 기존 일정이 있을 때)
  proposals: ProposalState[];
}

// 새 문서에서 읽은 내용과 비슷한 기존 일정 한 쌍 (서버가 찾아 준다)
interface Proposal {
  newId: string; // 새 문서에서 생긴 일정 (지금은 별개 일정으로 달력에 있다)
  incoming: PlaceTimeFields;
  existing: ScheduleEvent; // 비슷한 기존 일정
}

// 질문 한 건의 진행 상태: ask(답 기다림) / merged(변경으로 반영함) / kept(별개 일정으로 둠)
interface ProposalState extends Proposal {
  decision: "ask" | "merged" | "kept";
  busy: boolean;
  error: string | null;
}

// 비교해서 보여 줄 항목 (새 일정·기존 일정이 함께 갖고 있는 것)
interface PlaceTimeFields {
  title: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  city: string | null;
  country: string | null;
}

// 올라간 일정 한 줄 (optionNo가 있으면 1안·2안 중 하나)
interface FoundEvent {
  title: string;
  startDate: string | null;
  dateNote: string | null;
  optionNo: number | null;
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  ready: "올리기 전",
  working: "일정 찾는 중...",
  done: "완료",
  error: "올리지 못함",
};

// 서버가 돌려주는 결과 (app/api/upload/route.ts)
interface UploadResult {
  kind: UploadKind;
  sizeBytes: number;
  createdCount: number;
  undatedCount: number;
  truncated: boolean;
  events: FoundEvent[];
  proposals: Proposal[];
}

let nextItemId = 1;

// 한 줄 요약: "행사명 · 11월 12일 (목) ~ 11월 14일 (토) · 09:00~11:00 · 서울, 대한민국"
function describe(fields: PlaceTimeFields): string {
  const date = fields.startDate
    ? fields.endDate && fields.endDate !== fields.startDate
      ? `${formatShortDay(fields.startDate)} ~ ${formatShortDay(fields.endDate)}`
      : formatShortDay(fields.startDate)
    : "날짜 미정";
  const time = fields.startTime
    ? fields.endTime
      ? `${fields.startTime}~${fields.endTime}`
      : fields.startTime
    : null;
  const place = [fields.city, fields.country].filter(Boolean).join(", ");
  return [fields.title, date, time, place || null].filter(Boolean).join(" · ");
}

// 문서 올리기(팝업): 보고자료(PDF·Word·사진)를 골라 올린다.
// 서버가 문서의 글자에서 규칙으로 일정을 찾고, 달력에 "확인 전(회색)"으로 올린다. (AI는 선택적인 정리 단계에서만 쓴다)
export default function UploadPanel({
  onClose,
  onExtracted,
}: {
  onClose: () => void;
  onExtracted: () => void; // 일정이 새로 올라갔을 때 달력을 새로 불러온다
}) {
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
        found: [],
        proposals: [],
      })),
    );
  }

  // 질문 한 건의 상태를 바꾼다.
  function patchProposal(itemId: number, newId: string, patch: Partial<ProposalState>) {
    setItems((list) =>
      list.map((item) =>
        item.id === itemId
          ? {
              ...item,
              proposals: item.proposals.map((p) => (p.newId === newId ? { ...p, ...patch } : p)),
            }
          : item,
      ),
    );
  }

  // "변경으로 반영": 기존 일정에 새 내용을 반영하고 새 일정은 숨긴다.
  async function handleMerge(itemId: number, proposal: ProposalState) {
    if (proposal.busy) return;
    patchProposal(itemId, proposal.newId, { busy: true, error: null });
    const result = await applyChange(proposal.existing.id, proposal.existing.version, proposal.newId);
    if (result.ok) {
      patchProposal(itemId, proposal.newId, { busy: false, decision: "merged" });
      onExtracted(); // 달력을 새로 불러온다
      return;
    }
    if (result.kind === "conflict") {
      // 다른 사람이 먼저 고쳤다. 최신 내용으로 바꿔 보여 주고 다시 판단하게 한다.
      patchProposal(itemId, proposal.newId, {
        busy: false,
        error: "방금 다른 사람이 기존 일정을 고쳤습니다. 최신 내용으로 바꿨으니 다시 확인해 주세요.",
        ...(result.latest ? { existing: result.latest } : {}),
      });
      onExtracted();
      return;
    }
    patchProposal(itemId, proposal.newId, { busy: false, error: result.message });
  }

  // 파일을 하나씩 차례로 올린다. (한 번에 보낼 수 있는 크기에 제한이 있기 때문)
  async function uploadOne(item: Item) {
    patchItem(item.id, { status: "working", message: null, found: [], proposals: [] });

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
        data?: UploadResult;
        error?: { message: string };
      } | null;

      if (response.ok && body?.data) {
        const result = body.data;
        const parts = [
          `${UPLOAD_KIND_LABEL[result.kind]} · ${formatBytes(result.sizeBytes)}`,
          result.createdCount > 0
            ? `일정 ${result.createdCount}건을 달력에 올렸습니다 (확인 전)`
            : "이 문서에서 일정을 찾지 못했습니다. 문서 모양이 달라서일 수 있으니 직접 일정을 추가해 주세요",
        ];
        if (result.undatedCount > 0) {
          parts.push(`그중 날짜를 알 수 없는 일정 ${result.undatedCount}건`);
        }
        if (result.truncated) {
          parts.push("문서가 길어 앞부분만 읽었습니다");
        }
        if (result.proposals.length > 0) {
          parts.push(`비슷한 기존 일정 ${result.proposals.length}건이 있어 변경 여부를 묻습니다`);
        }
        patchItem(item.id, {
          status: "done",
          message: parts.join(" · "),
          found: result.events,
          proposals: result.proposals.map((p) => ({
            ...p,
            decision: "ask" as const,
            busy: false,
            error: null,
          })),
        });
        if (result.createdCount > 0) onExtracted();
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
      className="m-auto max-h-[92dvh] w-[min(94vw,32rem)] overflow-y-auto rounded-3xl border border-white/15 bg-[#0a0f1f]/90 p-0 backdrop-blur-2xl text-foreground shadow-xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
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
            className="h-11 w-11 shrink-0 rounded-full border border-white/25 bg-white/5 hover:bg-foreground/10"
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
            문서는 이 앱의 서버에서 글자를 읽어 일정을 찾으며, 올린 원본 파일은
            저장하지 않습니다. 정리 단계에서 AI를 쓰도록 설정된 경우에만, 개인정보를
            가린 짧은 문장 일부가 외부 AI 서비스로 전송될 수 있습니다.
          </p>
        </div>

        <p className="text-sm text-foreground/70">
          글자가 들어 있는 PDF나 Word(.docx)를 올리면 날짜·장소·행사명을 찾아 달력에
          회색(확인 전)으로 올려 줍니다. 모양이 다른 문서는 일정을 못 찾을 수 있으니
          그때는 직접 추가해 주세요. 스캔본·사진은 글자를 읽을 수 없어 지원하지
          않습니다. 파일 하나는 {formatBytes(MAX_UPLOAD_BYTES)} 이하입니다. 한글(.hwp)
          문서는 PDF로 저장해서 올려 주세요.
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
            className={`inline-flex h-11 cursor-pointer items-center rounded-full border border-white/25 bg-white/5 px-4 text-base hover:bg-foreground/5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foreground ${
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
                        ? "text-emerald-300"
                        : item.status === "error"
                          ? "text-rose-400"
                          : "text-foreground/60"
                    }`}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-foreground/60">
                  {item.message ?? `선택한 크기 ${formatBytes(item.file.size)}`}
                </div>
                {item.found.length > 0 ? (
                  <ul className="mt-1.5 flex max-h-32 flex-col gap-0.5 overflow-y-auto text-xs">
                    {item.found.map((event, index) => (
                      <li key={index} className="break-words">
                        <span className="text-foreground/60">
                          {event.startDate ??
                            (event.dateNote ? `날짜 미정(${event.dateNote})` : "날짜 미정")}
                        </span>{" "}
                        {event.optionNo ? (
                          <span className="font-semibold">{event.optionNo}안 </span>
                        ) : null}
                        {event.title}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {/* 비슷한 기존 일정이 있으면 변경으로 반영할지 묻는다. 답하기 전에는 아무것도 합치지 않는다. */}
                {item.proposals.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <p className="text-xs font-semibold">변경으로 반영할까요?</p>
                    {item.proposals.map((p) => (
                      <div
                        key={p.newId}
                        className="rounded-lg border border-foreground/15 bg-foreground/5 p-2.5 text-xs"
                      >
                        <p className="break-words">
                          <span className="font-semibold">기존 일정</span> {describe(p.existing)}
                        </p>
                        <p className="mt-1 break-words">
                          <span className="font-semibold">새 문서</span> {describe(p.incoming)}
                        </p>
                        {p.decision === "ask" ? (
                          <>
                            <p className="mt-1.5 text-foreground/70">
                              같은 행사가 바뀐 것이면 &lsquo;변경으로 반영&rsquo;을 눌러 주세요. 기존
                              일정이 새 내용으로 바뀌고 새 일정은 달력에서 숨겨집니다. 다른 행사이거나
                              담당자가 달라 둘 다 필요하면 &lsquo;별개 일정으로 두기&rsquo;를 눌러
                              주세요.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={p.busy}
                                onClick={() => void handleMerge(item.id, p)}
                                className="h-11 rounded-full bg-foreground px-3 text-sm font-medium text-background disabled:opacity-60"
                              >
                                {p.busy ? "반영 중..." : "변경으로 반영"}
                              </button>
                              <button
                                type="button"
                                disabled={p.busy}
                                onClick={() => patchProposal(item.id, p.newId, { decision: "kept" })}
                                className="h-11 rounded-full border border-white/25 bg-white/5 px-3 text-sm hover:bg-foreground/5 disabled:opacity-60"
                              >
                                별개 일정으로 두기
                              </button>
                            </div>
                          </>
                        ) : (
                          <p role="status" className="mt-1.5 font-medium">
                            {p.decision === "merged"
                              ? "기존 일정에 변경을 반영했습니다."
                              : "별개 일정으로 두었습니다."}
                          </p>
                        )}
                        {p.error ? (
                          <p role="alert" className="mt-1.5 text-rose-400">
                            {p.error}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {doneCount > 0 && pendingCount === 0 && !running ? (
          <p role="status" className="text-sm text-foreground/80">
            달력에 회색(확인 전)으로 올라간 일정을 눌러 내용을 확인하고, 맞으면
            &lsquo;확정&rsquo;을 눌러 주세요. 틀린 부분은 &lsquo;수정&rsquo;으로 고칠 수 있습니다.
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="h-11 rounded-full border border-white/25 bg-white/5 px-4 text-base hover:bg-foreground/5"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={running || pendingCount === 0}
            className="h-11 rounded-full bg-foreground px-5 text-base font-medium text-background disabled:opacity-60"
          >
            {running ? "올리는 중..." : "올리기"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
