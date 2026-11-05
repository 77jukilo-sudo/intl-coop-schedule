"use client";

import { useEffect, useRef, useState } from "react";
import {
  EVENT_STATUS_LABEL,
  WORK_CATEGORIES,
  WORK_CATEGORY_LABEL,
  type EventStatus,
  type Member,
  type ScheduleEvent,
  type WorkCategory,
} from "../../types/schedule";
import { createEvent, updateEvent } from "./eventApi";
import {
  WHO_LABEL,
  diffWithLatest,
  type DiffRow,
} from "./eventDiff";
import { checkCrossFields, type EventFields } from "./eventInput";

const inputClass =
  "h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-foreground/60";

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
  const [workCategory, setWorkCategory] = useState<WorkCategory>(
    event?.workCategory ?? "unclassified",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 내가 기준으로 삼은 일정(처음 열었을 때의 내용과 버전)
  const [origin, setOrigin] = useState<ScheduleEvent | null>(event);
  // 동시 수정이 났을 때 지금 저장된 최신 내용
  const [conflict, setConflict] = useState<ScheduleEvent | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // 새 일정은 "확정/미확정"만 고르게 하고, 수정할 때는 지금 상태도 목록에 남겨 둔다.
  const statusOptions: EventStatus[] = isEdit
    ? Array.from(new Set<EventStatus>([event.status, "confirmed", "tentative", "cancelled"]))
    : ["confirmed", "tentative"];

  function memberName(id: string | null): string {
    if (!id) return "담당자 미정";
    return members.find((m) => m.id === id)?.name ?? "담당자 정보 없음";
  }

  function currentFields(): EventFields {
    return {
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
      workCategory,
    };
  }

  // version: 저장할 때 "내가 본 버전"으로 보낼 값
  async function save(fields: EventFields, version: number) {
    setSaving(true);
    const result = origin
      ? await updateEvent(origin.id, version, fields)
      : await createEvent(fields);
    setSaving(false);

    if (result.ok) {
      onSaved();
      dialogRef.current?.close();
      return;
    }
    if (result.kind === "conflict" && result.latest) {
      // 다른 사람이 먼저 고쳤다. 내 입력은 그대로 두고 최신 내용과 비교해서 보여 준다.
      onStale();
      setError(null);
      setConflict(result.latest);
      return;
    }
    setError(result.message);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setError(null);

    const fields = currentFields();
    if (!fields.title) return setError("행사명을 입력해 주세요.");
    if (!fields.startDate) return setError("시작일을 입력해 주세요.");
    const crossError = checkCrossFields(fields);
    if (crossError) return setError(crossError);

    await save(fields, origin?.version ?? 0);
  }

  // 충돌 해결 1: 최신 내용으로 입력칸을 바꾼다. (내 입력은 사라진다)
  function useLatest() {
    if (!conflict) return;
    setTitle(conflict.title);
    setStartDate(conflict.startDate ?? "");
    setEndDate(conflict.endDate ?? "");
    setStartTime(conflict.startTime ?? "");
    setEndTime(conflict.endTime ?? "");
    setIsOverseas(conflict.isOverseas);
    setCity(conflict.city ?? "");
    setCountry(conflict.country ?? "");
    setAssigneeId(conflict.assigneeId ?? "");
    setStatus(conflict.status);
    setWorkCategory(conflict.workCategory);
    setOrigin(conflict);
    setConflict(null);
  }

  // 충돌 해결 2: 내 입력으로 덮어쓴다. (최신 버전을 확인했다는 뜻으로 그 버전으로 저장)
  async function overwriteWithMine() {
    if (!conflict || saving) return;
    const latest = conflict;
    setOrigin(latest);
    setConflict(null);
    await save(currentFields(), latest.version);
  }

  const diffRows: DiffRow[] =
    conflict && origin
      ? diffWithLatest(origin, conflict, currentFields(), memberName)
      : [];

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // 입력 중 실수로 바깥을 눌러도 닫히지 않는다. (닫기 버튼, 취소 버튼, Esc 키로만 닫힌다)
      aria-labelledby="event-form-title"
      className="m-auto max-h-[92dvh] w-[min(94vw,32rem)] overflow-y-auto rounded-3xl border border-white/15 bg-[#0a0f1f]/90 p-0 backdrop-blur-2xl text-foreground shadow-xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
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
            className="h-11 w-11 shrink-0 rounded-full border border-white/25 bg-white/5 hover:bg-foreground/10"
          >
            ✕
          </button>
        </div>

        {/* 동시 수정: 다른 사람이 먼저 저장했을 때 최신 내용과 내 입력을 비교해서 보여 준다 */}
        {conflict ? (
          <section
            role="alert"
            className="flex flex-col gap-3 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm"
          >
            <p className="font-semibold text-rose-400">
              방금 다른 사람이 이 일정을 고쳤습니다.
            </p>
            {diffRows.length > 0 ? (
              <div className="overflow-x-auto">
                {/* 좁은 화면에서도 옆으로 밀리지 않게 칸 너비를 고정하고 글자는 줄바꿈한다 */}
                <table className="w-full table-fixed border-collapse text-left">
                  <thead>
                    <tr className="text-xs text-foreground/60">
                      <th className="w-1/4 py-1 pr-2 font-normal">항목</th>
                      <th className="w-[37.5%] py-1 pr-2 font-normal">저장된 최신</th>
                      <th className="w-[37.5%] py-1 font-normal">내 입력</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffRows.map((row) => (
                      <tr
                        key={row.label}
                        className="border-t border-foreground/10 align-top"
                      >
                        <td className="py-1.5 pr-2">
                          {row.label}
                          <div className="text-[11px] text-foreground/60">
                            {WHO_LABEL[row.who]}
                          </div>
                        </td>
                        <td className="py-1.5 pr-2 break-words">{row.theirs}</td>
                        <td className="py-1.5 break-words">{row.mine}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>내가 입력한 내용은 저장된 최신 내용과 같습니다.</p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={useLatest}
                className="h-11 rounded-full border border-white/25 bg-white/5 px-3 hover:bg-foreground/5"
              >
                최신 내용으로 바꾸기
              </button>
              <button
                type="button"
                onClick={() => void overwriteWithMine()}
                disabled={saving}
                className="h-11 rounded-full bg-foreground px-3 font-medium text-background disabled:opacity-60"
              >
                내 입력으로 덮어쓰기
              </button>
            </div>
          </section>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            행사명 <span className="text-rose-400">*</span>
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
              시작일 <span className="text-rose-400">*</span>
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

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isOverseas}
            onChange={(e) => setIsOverseas(e.target.checked)}
            className="h-5 w-5"
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

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">업무성격</span>
          <select
            value={workCategory}
            onChange={(e) => setWorkCategory(e.target.value as WorkCategory)}
            className={inputClass}
          >
            {WORK_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {WORK_CATEGORY_LABEL[value]}
              </option>
            ))}
          </select>
          <span className="text-xs text-foreground/60">
            초청은 우리가 외국 기관·인사를 불러오는 것, 방문은 외국 손님이 우리를 찾아오는 것입니다.
          </span>
        </label>

        {error ? (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="h-11 rounded-full border border-white/25 bg-white/5 px-4 text-base hover:bg-foreground/5"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving || conflict !== null}
            className="h-11 rounded-full bg-foreground px-5 text-base font-medium text-background disabled:opacity-60"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
