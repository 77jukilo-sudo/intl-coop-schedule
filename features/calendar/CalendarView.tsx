"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { signOut } from "../../app/login/actions";
import type { ScheduleEvent } from "../../types/schedule";
import {
  addDays,
  addMonths,
  eventsOnDay,
  firstOfMonth,
  formatDayTitle,
  formatMonthTitle,
  formatShortDay,
  formatWeekTitle,
  isSameMonth,
  monthGrid,
  todayKey,
  weekDays,
  type DateKey,
} from "./dateUtils";
import EventList from "./EventList";
import MonthGrid from "./MonthGrid";
import StatusLegend from "./StatusLegend";

type View = "month" | "week" | "day";
type LoadState = "loading" | "ok" | "error";

const VIEW_LABELS: { value: View; label: string }[] = [
  { value: "month", label: "월" },
  { value: "week", label: "주" },
  { value: "day", label: "오늘" },
];

// 지금 화면에 보이는 기간 (일정을 이 기간만큼만 불러온다)
function visibleRange(view: View, anchor: DateKey): [DateKey, DateKey] {
  if (view === "month") {
    const days = monthGrid(anchor);
    return [days[0], days[days.length - 1]];
  }
  if (view === "week") {
    const days = weekDays(anchor);
    return [days[0], days[6]];
  }
  return [anchor, anchor];
}

// 오늘 날짜(한국 기준)는 브라우저에서만 읽는다. 서버가 미리 만들어 두는 화면에는 아직 없다(null).
// 이렇게 하면 미리 만든 화면과 실제 화면이 어긋나지 않는다.
const subscribeNothing = () => () => {};
function useToday(): DateKey | null {
  return useSyncExternalStore(subscribeNothing, todayKey, () => null);
}

// 공용 달력: 월 / 주 / 오늘 보기, 이전·다음 이동, 일정 요약 표시.
export default function CalendarView() {
  const today = useToday();
  // 사용자가 직접 옮기기 전에는 비어 있고(null), 그동안은 오늘 날짜를 쓴다.
  const [anchorPick, setAnchor] = useState<DateKey | null>(null);
  const [selectedPick, setSelectedDay] = useState<DateKey | null>(null);
  const [view, setView] = useState<View>("month");
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [retryCount, setRetryCount] = useState(0);

  const anchor = anchorPick ?? today;
  const selectedDay = selectedPick ?? anchor;

  useEffect(() => {
    if (!anchor) return;
    const [from, to] = visibleRange(view, anchor);
    let cancelled = false;

    async function load() {
      setLoadState("loading");
      try {
        const response = await fetch(`/api/events?from=${from}&to=${to}`);
        if (response.status === 401) {
          // 로그인 정보가 더 이상 맞지 않는다(예: 관리자가 계정을 지움).
          // 남아 있는 로그인 정보를 지우고 로그인 화면으로 보낸다. 그냥 이동만 하면 서로 되돌려 보내게 된다.
          await signOut();
          return;
        }
        if (!response.ok) throw new Error("load failed");
        const body = (await response.json()) as { data: ScheduleEvent[] };
        if (cancelled) return;
        setEvents(body.data);
        setLoadState("ok");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }
    void load();

    return () => {
      cancelled = true;
    };
  }, [view, anchor, retryCount]);

  if (!today || !anchor || !selectedDay) {
    return (
      <p className="py-10 text-center text-sm text-foreground/50">
        달력을 준비하고 있습니다...
      </p>
    );
  }

  function move(delta: number) {
    if (!anchor || !today) return;
    if (view === "month") {
      const next = addMonths(anchor, delta);
      setAnchor(next);
      // 오늘이 있는 달이면 오늘을, 아니면 그 달 1일을 선택한다.
      setSelectedDay(isSameMonth(next, today) ? today : next);
    } else if (view === "week") {
      const next = addDays(anchor, delta * 7);
      setAnchor(next);
      setSelectedDay(next);
    } else {
      const next = addDays(anchor, delta);
      setAnchor(next);
      setSelectedDay(next);
    }
  }

  function changeView(next: View) {
    if (!today) return;
    setView(next);
    if (next === "day") {
      // "오늘" 보기: 오늘 날짜로 이동한다.
      setAnchor(today);
      setSelectedDay(today);
    } else if (view === "day" && anchor) {
      setAnchor(next === "month" ? firstOfMonth(anchor) : anchor);
    }
  }

  const title =
    view === "month"
      ? formatMonthTitle(anchor)
      : view === "week"
        ? formatWeekTitle(anchor)
        : formatDayTitle(anchor);

  const moveLabel = view === "month" ? "달" : view === "week" ? "주" : "날";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label={`이전 ${moveLabel}`}
            className="h-9 w-9 rounded-lg border border-foreground/20 hover:bg-foreground/5"
          >
            ‹
          </button>
          <h1 className="min-w-0 px-2 text-base font-semibold sm:text-lg">
            {title}
          </h1>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label={`다음 ${moveLabel}`}
            className="h-9 w-9 rounded-lg border border-foreground/20 hover:bg-foreground/5"
          >
            ›
          </button>
        </div>

        <div
          role="group"
          aria-label="보기 방식"
          className="flex overflow-hidden rounded-lg border border-foreground/20 text-sm"
        >
          {VIEW_LABELS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => changeView(value)}
              aria-pressed={view === value}
              className={`h-9 px-4 ${
                view === value
                  ? "bg-foreground text-background"
                  : "hover:bg-foreground/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <StatusLegend />

      <div aria-live="polite" className="min-h-5 text-sm">
        {loadState === "loading" ? (
          <span className="text-foreground/50">일정을 불러오는 중...</span>
        ) : null}
        {loadState === "error" ? (
          <span className="text-red-600">
            일정을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.{" "}
            <button
              type="button"
              onClick={() => setRetryCount((n) => n + 1)}
              className="underline"
            >
              다시 시도
            </button>
          </span>
        ) : null}
      </div>

      {view === "month" ? (
        <>
          <MonthGrid
            anchor={anchor}
            today={today}
            selectedDay={selectedDay}
            events={events}
            onSelectDay={setSelectedDay}
          />
          {/* 좁은 화면: 선택한 날의 일정 목록 */}
          <section className="sm:hidden">
            <h2 className="mb-2 text-sm font-semibold">
              {formatDayTitle(selectedDay)}
            </h2>
            <EventList events={eventsOnDay(events, selectedDay)} />
          </section>
        </>
      ) : null}

      {view === "week" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
          {weekDays(anchor).map((day) => (
            <section
              key={day}
              className={`rounded-xl border p-2 ${
                day === today ? "border-foreground/50" : "border-foreground/10"
              }`}
            >
              <h2 className="mb-2 text-sm font-semibold">
                {formatShortDay(day)}
              </h2>
              <EventList events={eventsOnDay(events, day)} emptyText="일정 없음" />
            </section>
          ))}
        </div>
      ) : null}

      {view === "day" ? (
        <section className="rounded-xl border border-foreground/10 p-3">
          <EventList events={eventsOnDay(events, anchor)} />
        </section>
      ) : null}
    </div>
  );
}
