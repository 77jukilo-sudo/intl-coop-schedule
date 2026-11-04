// 달력에서 쓰는 날짜 계산 도구.
// 날짜는 "2026-11-04" 같은 글자(DateKey)로만 다룬다. 시간대 때문에 하루가 밀리는 일을 막기 위해서다.
import type { ScheduleEvent } from "../../types/schedule";

export type DateKey = string; // YYYY-MM-DD

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// 해당 날짜의 한국 시각 기준 오늘 (브라우저가 어느 나라에 있어도 한국 날짜로 계산)
export function todayKey(): DateKey {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA 형식이 YYYY-MM-DD 이다
}

export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

// 해당 달의 1일
export function firstOfMonth(key: DateKey): DateKey {
  const date = fromDateKey(key);
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

// 달을 앞뒤로 옮긴 뒤 그 달의 1일
export function addMonths(key: DateKey, months: number): DateKey {
  const date = fromDateKey(key);
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + months, 1));
}

// 그 주의 일요일
export function startOfWeek(key: DateKey): DateKey {
  const date = fromDateKey(key);
  return addDays(key, -date.getDay());
}

export function weekDays(key: DateKey): DateKey[] {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// 월 보기에 그릴 6주(42칸)
export function monthGrid(key: DateKey): DateKey[] {
  const start = startOfWeek(firstOfMonth(key));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function isSameMonth(a: DateKey, b: DateKey): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function formatMonthTitle(key: DateKey): string {
  const date = fromDateKey(key);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

export function formatDayTitle(key: DateKey): string {
  const date = fromDateKey(key);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_LABELS[date.getDay()]})`;
}

export function formatShortDay(key: DateKey): string {
  const date = fromDateKey(key);
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_LABELS[date.getDay()]})`;
}

export function formatWeekTitle(key: DateKey): string {
  const days = weekDays(key);
  const first = fromDateKey(days[0]);
  const last = fromDateKey(days[6]);
  const left = `${first.getFullYear()}년 ${first.getMonth() + 1}월 ${first.getDate()}일`;
  const right =
    first.getMonth() === last.getMonth()
      ? `${last.getDate()}일`
      : `${last.getMonth() + 1}월 ${last.getDate()}일`;
  return `${left} ~ ${right}`;
}

// 어떤 날에 걸치는 일정만 고른다. (여러 날 일정은 시작일~종료일 모든 날에 나온다)
export function eventsOnDay(
  events: ScheduleEvent[],
  day: DateKey,
): ScheduleEvent[] {
  return events
    .filter((event) => {
      if (!event.startDate) return false;
      const end = event.endDate ?? event.startDate;
      return event.startDate <= day && day <= end;
    })
    .sort((a, b) => {
      // 시간이 없는 일정(종일)을 먼저, 그다음 시간순, 같으면 제목순
      const at = a.startTime ?? "";
      const bt = b.startTime ?? "";
      if (at !== bt) return at < bt ? -1 : 1;
      return a.title.localeCompare(b.title, "ko");
    });
}
