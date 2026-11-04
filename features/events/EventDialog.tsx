"use client";

import { useEffect, useRef } from "react";
import { EVENT_STATUS_LABEL, type ScheduleEvent } from "../../types/schedule";
import { formatDayTitle, formatShortDay } from "../calendar/dateUtils";
import { CHIP_CLASS } from "../calendar/statusStyle";

// 날짜 표시: 하루짜리는 그 날짜, 여러 날이면 "시작 ~ 끝"
function formatDateRange(event: ScheduleEvent): string {
  if (!event.startDate) return "날짜 미정";
  if (!event.endDate || event.endDate === event.startDate) {
    return formatDayTitle(event.startDate);
  }
  const sameYear = event.startDate.slice(0, 4) === event.endDate.slice(0, 4);
  return `${formatDayTitle(event.startDate)} ~ ${
    sameYear ? formatShortDay(event.endDate) : formatDayTitle(event.endDate)
  }`;
}

// 시간 표시: 외국 일정은 현지 시각이라는 표시를 함께 보여 준다.
function formatTime(event: ScheduleEvent): string {
  if (!event.startTime) return "시간 미정";
  const range = event.endTime
    ? `${event.startTime} ~ ${event.endTime}`
    : event.startTime;
  return event.isOverseas ? `${range} (현지 시각)` : range;
}

// 장소 표시: 도시·국가가 있으면 그것을, 없으면 문서에 적힌 원문을, 둘 다 없으면 "장소 미정"
function formatPlace(event: ScheduleEvent): string {
  const place = [event.city, event.country].filter(Boolean).join(", ");
  return place || event.locationNote || "장소 미정";
}

// 일정 상세 팝업: 일정을 누르면 날짜·시간·장소·담당자·출처를 보여 준다.
// 확정·수정·취소 버튼은 작업 8번, 도시 지도는 작업 17번에서 붙인다.
export default function EventDialog({
  event,
  assigneeName,
  onClose,
}: {
  event: ScheduleEvent;
  assigneeName: string | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // 열릴 때 모달로 띄운다. (바깥은 어두워지고, Esc 키로 닫힌다)
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const statusLabel = EVENT_STATUS_LABEL[event.status];
  const assignee = event.assigneeId
    ? (assigneeName ?? "담당자 정보 없음")
    : "담당자 미정";

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        // 어두운 바깥 부분을 누르면 닫는다.
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      aria-labelledby="event-dialog-title"
      className="m-auto w-[min(92vw,28rem)] rounded-xl border border-foreground/15 bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2
            id="event-dialog-title"
            className="min-w-0 break-words text-lg font-semibold"
          >
            {event.title}
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

        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={`rounded px-2 py-0.5 ${CHIP_CLASS[event.status]}`}
          >
            {statusLabel}
          </span>
          {event.optionNo ? (
            <span className="rounded bg-foreground/10 px-2 py-0.5">
              {event.optionNo}안
            </span>
          ) : null}
        </div>

        <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2.5 text-sm">
          <dt className="text-foreground/60">날짜</dt>
          <dd>{formatDateRange(event)}</dd>

          <dt className="text-foreground/60">시간</dt>
          <dd>{formatTime(event)}</dd>

          <dt className="text-foreground/60">장소</dt>
          <dd>{formatPlace(event)}</dd>

          <dt className="text-foreground/60">담당자</dt>
          <dd>{assignee}</dd>

          <dt className="text-foreground/60">출처</dt>
          {/* 직접 입력한 일정은 출처가 "직접 입력"으로 저장되어 있어 그대로 보여 주면 된다 */}
          <dd>{event.sourceName}</dd>
        </dl>
      </div>
    </dialog>
  );
}
