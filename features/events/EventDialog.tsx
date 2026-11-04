"use client";

import { useEffect, useRef, useState } from "react";
import {
  EVENT_STATUS_LABEL,
  type EventStatus,
  type ScheduleEvent,
} from "../../types/schedule";
import { formatDayTitle, formatShortDay } from "../calendar/dateUtils";
import { CHIP_CLASS } from "../calendar/statusStyle";
import { changeOption, fetchOptions, updateEvent, type SaveResult } from "./eventApi";
import HistoryList from "./HistoryList";

// 날짜 표시: 하루짜리는 그 날짜, 여러 날이면 "시작 ~ 끝"
function formatDateRange(event: ScheduleEvent): string {
  if (!event.startDate) {
    // 문서에 적힌 원래 표현이 있으면 함께 보여 준다. (예: 날짜 미정 (문서에는 "11월 중순"))
    return event.dateNote ? `날짜 미정 (문서에는 "${event.dateNote}")` : "날짜 미정";
  }
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

// 일정 상세 팝업: 일정을 누르면 날짜·시간·장소·담당자·출처를 보여 주고,
// 수정·확정·취소 처리를 할 수 있다. 도시 지도는 작업 17번에서 붙인다.
export default function EventDialog({
  event,
  assigneeName,
  onEdit,
  onChanged,
  onStale,
  onRefresh,
  onClose,
}: {
  event: ScheduleEvent;
  assigneeName: string | null;
  onEdit: (event: ScheduleEvent) => void; // "수정" 버튼: 입력 폼을 연다
  onChanged: () => void; // 확정·취소 등으로 일정이 바뀐 뒤 달력을 새로 불러온다
  onStale: () => void; // 다른 사람이 먼저 고쳐서 화면 내용이 오래됐을 때 달력을 새로 불러온다
  onRefresh: (latest: ScheduleEvent) => void; // 팝업의 내용을 최신 내용으로 바꾼다
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  // 1안·2안: 같은 묶음의 안 목록(숨겨진 안 포함). 불러오는 중이거나 실패하면 null.
  const [options, setOptions] = useState<ScheduleEvent[] | null>(null);
  const [optionsFailed, setOptionsFailed] = useState(false);
  const [confirmingChoice, setConfirmingChoice] = useState(false); // 나머지 안을 숨겨도 되는지 묻는 중

  // 안이 있는 일정이면 다른 안을 불러온다. 일정이 바뀌면(버전이 달라지면) 다시 불러온다.
  const { id: eventId, groupId, version } = event;
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    void fetchOptions(eventId).then((list) => {
      if (cancelled) return;
      setOptions(list);
      setOptionsFailed(list === null);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, groupId, version]);

  // 열릴 때 모달로 띄운다. (바깥은 어두워지고, Esc 키로 닫힌다)
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const statusLabel = EVENT_STATUS_LABEL[event.status];
  const assignee = event.assigneeId
    ? (assigneeName ?? "담당자 정보 없음")
    : "담당자 미정";

  // 상태만 바꾸는 빠른 버튼(확정, 취소 처리, 취소 해제)
  async function changeStatus(next: EventStatus) {
    await runSave(() => updateEvent(event.id, event.version, { status: next }));
  }

  // 1안·2안: 이 안을 확정하고 나머지를 숨기거나(choose), 확정을 되돌려 숨긴 안을 다시 보인다(reopen)
  async function runOption(action: "choose" | "reopen") {
    await runSave(() => changeOption(event.id, event.version, action));
  }

  async function runSave(save: () => Promise<SaveResult>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await save();
    setBusy(false);
    if (result.ok) {
      onChanged();
      dialogRef.current?.close();
      return;
    }
    if (result.kind === "conflict") {
      // 다른 사람이 먼저 고쳤다. 달력과 이 팝업을 최신 내용으로 바꾸고, 확인한 뒤 다시 누르게 한다.
      onStale();
      setConfirmingChoice(false); // 내용이 바뀌었으니 숨겨질 안을 다시 확인하게 한다
      if (result.latest) onRefresh(result.latest);
      setError(
        "방금 다른 사람이 이 일정을 고쳐서 최신 내용으로 바꿨습니다. 내용을 확인한 뒤 다시 눌러 주세요.",
      );
      return;
    }
    setError(result.message);
  }

  function cancelEvent() {
    // 취소 처리는 되돌릴 수 있지만(취소 해제), 실수로 누르지 않도록 한 번 더 묻는다.
    if (window.confirm(`"${event.title}" 일정을 취소 처리할까요?`)) {
      void changeStatus("cancelled");
    }
  }

  const canConfirm = event.status === "pending_review" || event.status === "tentative";

  // 다른 안: 달력에 보이는 안(확정하면 숨겨질 안)과 이미 숨겨진 안
  const otherOptions = (options ?? []).filter((o) => o.id !== event.id);
  const willHide = otherOptions.filter((o) => !o.hiddenAt);
  const hiddenOptions = otherOptions.filter((o) => o.hiddenAt);
  const optionLine = (o: ScheduleEvent) =>
    `${o.optionNo ?? "?"}안 · ${o.startDate ? formatShortDay(o.startDate) : "날짜 미정"} · ${EVENT_STATUS_LABEL[o.status]}`;
  // 안이 있는 일정은 다른 안 목록을 불러온 뒤에야 확정할 수 있다. (무엇이 숨겨질지 알려 주기 위해서)
  const optionsLoading = Boolean(event.groupId) && options === null && !optionsFailed;

  function handleConfirmClick() {
    if (!event.groupId) {
      void changeStatus("confirmed");
    } else if (willHide.length > 0) {
      setConfirmingChoice(true); // 나머지 안이 숨겨지므로 한 번 더 묻는다
    } else {
      void runOption("choose");
    }
  }

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
          <span className={`rounded px-2 py-0.5 ${CHIP_CLASS[event.status]}`}>
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

        {/* 1안·2안: 같은 행사의 다른 안 */}
        {event.groupId ? (
          <div className="rounded-lg border border-foreground/10 p-3 text-sm">
            <p className="font-medium">같은 행사의 다른 안</p>
            {optionsFailed ? (
              <p className="mt-1 text-foreground/60">다른 안을 불러오지 못했습니다. 팝업을 닫았다가 다시 열어 주세요.</p>
            ) : options === null ? (
              <p className="mt-1 text-foreground/60">불러오는 중...</p>
            ) : otherOptions.length === 0 ? (
              <p className="mt-1 text-foreground/60">다른 안이 없습니다.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-0.5">
                {otherOptions.map((o) => (
                  <li key={o.id} className={o.hiddenAt ? "text-foreground/50" : undefined}>
                    {optionLine(o)}
                    {o.hiddenAt ? " (달력에서 숨김)" : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        {/* 확정하면 나머지 안이 숨겨지므로, 숨겨질 안을 보여 주고 한 번 더 묻는다 */}
        {confirmingChoice ? (
          <div role="alertdialog" aria-label="안 확정 확인" className="rounded-lg border border-foreground/30 bg-foreground/5 p-3 text-sm">
            <p className="font-medium">
              {event.optionNo ? `${event.optionNo}안` : "이 안"}을 확정할까요?
            </p>
            <p className="mt-1">아래 안은 달력에서 숨겨집니다. (기록은 남고, 나중에 확정을 되돌리면 다시 보입니다)</p>
            <ul className="mt-1 list-disc pl-5">
              {willHide.map((o) => (
                <li key={o.id}>{optionLine(o)}</li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmingChoice(false)}
                className="h-10 rounded-lg border border-foreground/20 px-3 text-sm hover:bg-foreground/5 disabled:opacity-60"
              >
                돌아가기
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runOption("choose")}
                className="h-10 rounded-lg bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
              >
                확정하고 나머지 숨기기
              </button>
            </div>
          </div>
        ) : null}

        {/* 수정 이력: 누가, 언제, 무엇을 고쳤는지 */}
        <div className="border-t border-foreground/10 pt-3">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            aria-expanded={showHistory}
            className="text-sm underline"
          >
            {showHistory ? "수정 이력 닫기" : "수정 이력 보기"}
          </button>
          {showHistory ? (
            <div className="mt-2">
              {/* 일정이 바뀌면(버전이 달라지면) 이력을 다시 불러온다 */}
              <HistoryList key={event.version} eventId={event.id} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {event.status === "cancelled" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void changeStatus("tentative")}
              className="h-10 rounded-lg border border-foreground/20 px-3 text-sm hover:bg-foreground/5 disabled:opacity-60"
            >
              취소 해제
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={cancelEvent}
              className="h-10 rounded-lg border border-foreground/20 px-3 text-sm hover:bg-foreground/5 disabled:opacity-60"
            >
              취소 처리
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onEdit(event);
              dialogRef.current?.close();
            }}
            className="h-10 rounded-lg border border-foreground/20 px-3 text-sm hover:bg-foreground/5 disabled:opacity-60"
          >
            수정
          </button>
          {event.status === "confirmed" && hiddenOptions.length > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runOption("reopen")}
              className="h-10 rounded-lg border border-foreground/20 px-3 text-sm hover:bg-foreground/5 disabled:opacity-60"
            >
              확정 되돌리고 다른 안 다시 보기
            </button>
          ) : null}
          {canConfirm && !confirmingChoice ? (
            <button
              type="button"
              disabled={busy || optionsLoading || optionsFailed}
              onClick={handleConfirmClick}
              className="h-10 rounded-lg bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
            >
              확정
            </button>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
