"use client";

import { useEffect, useRef, useState } from "react";
import { EVENT_STATUS_LABEL, type ScheduleEvent } from "../../types/schedule";
import { CHIP_CLASS } from "../calendar/statusStyle";
import { updateEvent } from "./eventApi";

const inputClass =
  "h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-foreground/60";

// 날짜 미정 일정 한 줄: 날짜를 입력하면 달력에 올라간다.
function UndatedRow({
  event,
  onOpenEvent,
  onDated,
  onStale,
}: {
  event: ScheduleEvent;
  onOpenEvent: (event: ScheduleEvent) => void;
  onDated: (id: string) => void; // 날짜가 들어가 달력에 올라갔다
  onStale: () => void; // 다른 사람이 먼저 고쳤다
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    if (!startDate) return setError("시작일을 입력해 주세요.");
    if (endDate && endDate < startDate) {
      return setError("종료일은 시작일보다 빠를 수 없습니다.");
    }

    setSaving(true);
    const result = await updateEvent(event.id, event.version, {
      startDate,
      endDate: endDate || null,
    });
    setSaving(false);

    if (result.ok) {
      onDated(event.id);
      return;
    }
    if (result.kind === "conflict") {
      // 다른 사람이 먼저 고쳤다. 목록을 새로 불러와서 최신 내용으로 다시 보여 준다.
      onStale();
      setError("방금 다른 사람이 이 일정을 고쳤습니다. 목록을 새로 불러왔으니 확인해 주세요.");
      return;
    }
    setError(result.message);
  }

  return (
    <li className="rounded-lg border border-foreground/10 p-3">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpenEvent(event)}
          className="min-h-11 min-w-0 break-words py-2 text-left font-medium underline-offset-2 hover:underline"
        >
          {event.title}
        </button>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${CHIP_CLASS[event.status]}`}
        >
          {EVENT_STATUS_LABEL[event.status]}
        </span>
      </div>

      <p className="mt-1 text-xs text-foreground/60">
        {event.dateNote ? `문서에는 "${event.dateNote}" · ` : ""}
        출처 {event.sourceName}
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs text-foreground/70">시작일</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-foreground/70">종료일 (여러 날일 때)</span>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="h-11 rounded-full bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
        >
          {saving ? "올리는 중..." : "달력에 올리기"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="mt-1.5 text-sm text-rose-400">
          {error}
        </p>
      ) : null}
    </li>
  );
}

// 날짜 미정 목록(팝업): 문서에 정확한 날짜가 없어 달력에 올라가지 못한 일정을 모아 보여 준다.
// 날짜가 정해지면 여기서 날짜를 입력해 달력에 올린다.
export default function UndatedDialog({
  events,
  onOpenEvent,
  onChanged,
  onClose,
}: {
  events: ScheduleEvent[];
  onOpenEvent: (event: ScheduleEvent) => void;
  onChanged: () => void; // 날짜를 넣었거나 충돌이 났을 때 달력과 목록을 새로 불러온다
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // 방금 날짜를 넣은 일정은 새로 불러오기가 끝나기 전에도 목록에서 바로 뺀다.
  const [datedIds, setDatedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const visible = events.filter((e) => !datedIds.has(e.id));

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="undated-title"
      className="m-auto max-h-[92dvh] w-[min(94vw,36rem)] overflow-y-auto rounded-3xl border border-white/15 bg-[#0a0f1f]/90 p-0 backdrop-blur-2xl text-foreground shadow-xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="undated-title" className="text-lg font-semibold">
            날짜 미정 일정 ({visible.length})
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

        <p className="text-sm text-foreground/70">
          문서에 정확한 날짜가 없어서 달력에 올라가지 못한 일정입니다. 날짜가
          정해지면 입력해서 달력에 올려 주세요.
        </p>

        {visible.length === 0 ? (
          <p className="py-4 text-center text-sm text-foreground/50">
            날짜 미정 일정이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.map((event) => (
              <UndatedRow
                key={event.id}
                event={event}
                onOpenEvent={onOpenEvent}
                onDated={(id) => {
                  setDatedIds((set) => new Set(set).add(id));
                  onChanged();
                }}
                onStale={onChanged}
              />
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="h-11 rounded-full border border-white/25 bg-white/5 px-4 text-base hover:bg-foreground/5"
          >
            닫기
          </button>
        </div>
      </div>
    </dialog>
  );
}
