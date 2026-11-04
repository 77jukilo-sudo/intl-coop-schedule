"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "../../app/login/actions";
import {
  EVENT_STATUS_LABEL,
  GEO_CATEGORY_LABEL,
  WORK_CATEGORIES,
  WORK_CATEGORY_LABEL,
  type Member,
  type ScheduleEvent,
} from "../../types/schedule";
import { CHIP_CLASS } from "../calendar/statusStyle";

const inputClass =
  "h-11 w-full rounded-lg border border-foreground/20 bg-background px-3 text-base outline-none focus:border-foreground/60";

const DEBOUNCE_MS = 300; // 글자를 치는 동안 매번 검색하지 않고 잠깐 멈추면 검색한다
const RESULT_LIMIT = 100; // 서버가 돌려주는 최대 건수 (app/api/events/search/route.ts와 같아야 한다)

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; events: ScheduleEvent[] }
  | { kind: "error" };

// 일정 검색(팝업): 글자와 분류(국내/국외, 업무성격)로 전체 기간의 일정을 찾는다.
export default function SearchDialog({
  members,
  onOpenEvent,
  onClose,
}: {
  members: Member[];
  onOpenEvent: (event: ScheduleEvent) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [geo, setGeo] = useState("");
  const [work, setWork] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });

  const hasCriteria = q.trim() !== "" || geo !== "" || work !== "";

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (!hasCriteria) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState({ kind: "loading" });
      const query = new URLSearchParams();
      if (q.trim()) query.set("q", q.trim());
      if (geo) query.set("geo", geo);
      if (work) query.set("work", work);
      fetch(`/api/events/search?${query}`, { signal: controller.signal, cache: "no-store" })
        .then(async (response) => {
          if (response.status === 401) {
            await signOut();
            return;
          }
          if (!response.ok) {
            setState({ kind: "error" });
            return;
          }
          const body = (await response.json()) as { data: ScheduleEvent[] };
          setState({ kind: "done", events: body.data });
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setState({ kind: "error" });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, geo, work, hasCriteria]);

  const shown = hasCriteria ? state : ({ kind: "idle" } as SearchState);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="search-title"
      className="m-auto max-h-[92dvh] w-[min(94vw,36rem)] overflow-y-auto rounded-xl border border-foreground/15 bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="search-title" className="text-lg font-semibold">
            일정 검색
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="닫기"
            className="h-11 w-11 shrink-0 rounded-lg border border-foreground/20 hover:bg-foreground/5"
          >
            ✕
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">검색어</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={100}
            placeholder="행사명, 도시·국가, 출처 문서, 담당자"
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">국내/국외</span>
            <select value={geo} onChange={(e) => setGeo(e.target.value)} className={inputClass}>
              <option value="">전체</option>
              <option value="domestic">{GEO_CATEGORY_LABEL.domestic}</option>
              <option value="overseas">{GEO_CATEGORY_LABEL.overseas}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">업무성격</span>
            <select value={work} onChange={(e) => setWork(e.target.value)} className={inputClass}>
              <option value="">전체</option>
              {WORK_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {WORK_CATEGORY_LABEL[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div aria-live="polite" className="flex flex-col gap-2">
          {shown.kind === "idle" ? (
            <p className="py-3 text-center text-sm text-foreground/60">
              검색어를 입력하거나 분류를 골라 주세요. 날짜와 상관없이 전체 일정에서 찾습니다.
            </p>
          ) : null}
          {shown.kind === "loading" ? (
            <p className="py-3 text-center text-sm text-foreground/60">찾는 중...</p>
          ) : null}
          {shown.kind === "error" ? (
            <p role="alert" className="py-3 text-center text-sm text-red-600">
              검색하지 못했습니다. 잠시 뒤 다시 시도해 주세요.
            </p>
          ) : null}
          {shown.kind === "done" ? (
            shown.events.length === 0 ? (
              <p className="py-3 text-center text-sm text-foreground/60">
                조건에 맞는 일정이 없습니다.
              </p>
            ) : (
              <>
                <p className="text-sm text-foreground/70">
                  {shown.events.length}건
                  {shown.events.length >= RESULT_LIMIT
                    ? ` (최근 ${RESULT_LIMIT}건만 보여 드립니다. 검색어를 더 자세히 써 주세요)`
                    : ""}
                </p>
                <ul className="flex flex-col gap-2">
                  {shown.events.map((event) => (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={() => onOpenEvent(event)}
                        className="flex min-h-11 w-full flex-col gap-1 rounded-lg border border-foreground/10 p-2.5 text-left hover:bg-foreground/5"
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="min-w-0 break-words text-sm font-medium">
                            {event.optionNo ? `${event.optionNo}안 ` : ""}
                            {event.title}
                          </span>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${CHIP_CLASS[event.status]}`}
                          >
                            {EVENT_STATUS_LABEL[event.status]}
                          </span>
                        </span>
                        <span className="text-xs text-foreground/70">
                          {event.startDate
                            ? event.endDate && event.endDate !== event.startDate
                              ? `${event.startDate} ~ ${event.endDate}`
                              : event.startDate
                            : "날짜 미정"}
                          {" · "}
                          {[event.city, event.country].filter(Boolean).join(", ") || "장소 미정"}
                        </span>
                        <span className="text-xs text-foreground/60">
                          {GEO_CATEGORY_LABEL[event.geoCategory]} ·{" "}
                          {WORK_CATEGORY_LABEL[event.workCategory]} ·{" "}
                          {event.assigneeId
                            ? (members.find((m) => m.id === event.assigneeId)?.name ?? "담당자 정보 없음")
                            : "담당자 미정"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : null}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="h-11 rounded-lg border border-foreground/20 px-4 text-base hover:bg-foreground/5"
          >
            닫기
          </button>
        </div>
      </div>
    </dialog>
  );
}
