"use client";

import { useEffect, useRef, useState } from "react";
import {
  EVENT_STATUS_LABEL,
  type EventStatus,
  type Member,
  type ScheduleEvent,
} from "../../types/schedule";
import { createEvent, updateEvent } from "./eventApi";
import { checkCrossFields, type EventFields } from "./eventInput";

const inputClass =
  "h-11 w-full rounded-lg border border-foreground/20 bg-background px-3 text-base outline-none focus:border-foreground/60";

// 일정 입력 폼(팝업): 새 일정 추가와 기존 일정 수정에 함께 쓴다.
// 글자 크기를 16px 이상으로 두어 휴대폰에서 입력할 때 화면이 확대되지 않게 한다.
export default function EventForm({
  event,
  defaultDate,
  members,
  onSaved,
  onStale,
  onClose,
}: {
  event: ScheduleEvent | null; // null이면 새 일정 추가
  defaultDate: string; // 새 일정의 기본 시작일
  members: Member[];
  onSaved: () => void;
  onStale: () => void; // 다른 사람이 먼저 고쳐서 화면 내용이 오래됐을 때 달력을 새로 불러온다
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isEdit = event !== null;

  const [title, setTitle] = useState(event?.title ?? "");
  const [startDate, setStartDate] = useState(event?.startDate ?? defaultDate);
  const [endDate, setEndDate] = useState(event?.endDate ?? "");
  const [startTime, setStartTime] = useState(event?.startTime ?? "");
  const [endTime, setEndTime] = useState(event?.endTime ?? "");
  const [isOverseas, setIsOverseas] = useState(event?.isOverseas ?? false);
  const [city, setCity] = useState(event?.city ?? "");
  const [country, setCountry] = useState(event?.country ?? "");
  const [assigneeId, setAssigneeId] = useState(event?.assigneeId ?? "");
  const [status, setStatus] = useState<EventStatus>(event?.status ?? "confirmed");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // 새 일정은 "확정/미확정"만 고르게 하고, 수정할 때는 지금 상태도 목록에 남겨 둔다.
  const statusOptions: EventStatus[] = isEdit
    ? Array.from(new Set<EventStatus>([event.status, "confirmed", "tentative", "cancelled"]))
    : ["confirmed", "tentative"];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setError(null);

    const fields: EventFields = {
      title: title.trim(),
      startDate,
      endDate: endDate || null,
      startTime: startTime || null,
      endTime: endTime || null,
      isOverseas,
      city: city.trim() || null,
      country: country.trim() || null,
      assigneeId: assigneeId || null,
      status,
    };

    if (!fields.title) return setError("행사명을 입력해 주세요.");
    if (!fields.startDate) return setError("시작일을 입력해 주세요.");
    const crossError = checkCrossFields(fields);
    if (crossError) return setError(crossError);

    setSaving(true);
    const result = isEdit
      ? await updateEvent(event.id, event.version, fields)
      : await createEvent(fields);
    setSaving(false);

    if (result.ok) {
      onSaved();
      dialogRef.current?.close();
      return;
    }
    if (result.kind === "conflict") {
      // 달력을 최신으로 새로 불러와서, 창을 닫고 다시 열면 바뀐 내용이 보이게 한다.
      onStale();
      setError(`${result.message} 이 창을 닫고 일정을 다시 열어 주세요.`);
      return;
    }
    setError(result.message);
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // 입력 중 실수로 바깥을 눌러도 닫히지 않는다. (닫기 버튼, 취소 버튼, Esc 키로만 닫힌다)
      aria-labelledby="event-form-title"
      className="m-auto max-h-[92dvh] w-[min(94vw,32rem)] overflow-y-auto rounded-xl border border-foreground/15 bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="event-form-title" className="text-lg font-semibold">
            {isEdit ? "일정 수정" : "일정 추가"}
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

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            행사명 <span className="text-red-600">*</span>
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              시작일 <span className="text-red-600">*</span>
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">종료일 (여러 날일 때)</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">시작 시간</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">종료 시간</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isOverseas}
            onChange={(e) => setIsOverseas(e.target.checked)}
            className="h-4 w-4"
          />
          외국에서 진행 (시간은 현지 시각으로 입력)
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">도시</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={100}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">국가</span>
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              maxLength={100}
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">담당자</span>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={inputClass}
            >
              <option value="">담당자 미정</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">상태</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EventStatus)}
              className={inputClass}
            >
              {statusOptions.map((value) => (
                <option key={value} value={value}>
                  {EVENT_STATUS_LABEL[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="h-11 rounded-lg border border-foreground/20 px-4 text-base hover:bg-foreground/5"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-lg bg-foreground px-5 text-base font-medium text-background disabled:opacity-60"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
