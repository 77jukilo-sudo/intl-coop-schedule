import type { ScheduleEvent } from "../../types/schedule";
import {
  WEEKDAY_LABELS,
  eventsOnDay,
  fromDateKey,
  isSameMonth,
  monthGrid,
  type DateKey,
} from "./dateUtils";
import EventChip from "./EventChip";
import { DOT_CLASS } from "./statusStyle";

const MAX_CHIPS = 3; // 칸 하나에 보여 줄 일정 줄 수 (넘으면 "+N개")

// 월 보기: 6주짜리 달력. 칸마다 일정 요약을 작게 보여 준다.
// 휴대폰처럼 좁은 화면에서는 줄 대신 점으로 표시하고, 날짜를 누르면 아래 목록에 그날 일정이 나온다.
export default function MonthGrid({
  anchor,
  today,
  selectedDay,
  events,
  onSelectDay,
}: {
  anchor: DateKey;
  today: DateKey;
  selectedDay: DateKey;
  events: ScheduleEvent[];
  onSelectDay: (day: DateKey) => void;
}) {
  const days = monthGrid(anchor);

  return (
    <div className="overflow-hidden rounded-xl border border-foreground/10">
      <div className="grid grid-cols-7 border-b border-foreground/10 bg-foreground/[0.03] text-center text-xs font-medium">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`py-2 ${i === 0 ? "text-red-600" : i === 6 ? "text-blue-600" : ""}`}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = eventsOnDay(events, day);
          const inMonth = isSameMonth(day, anchor);
          const isToday = day === today;
          const isSelected = day === selectedDay;
          const date = fromDateKey(day);
          const weekday = date.getDay();

          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(day)}
              aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일, 일정 ${dayEvents.length}개`}
              aria-pressed={isSelected}
              className={`flex min-h-16 flex-col items-stretch gap-1 border-foreground/10 p-1 text-left align-top sm:min-h-28 sm:p-1.5 ${
                index % 7 !== 6 ? "border-r" : ""
              } ${index < 35 ? "border-b" : ""} ${
                isSelected ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]"
              } ${inMonth ? "" : "text-foreground/35"}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center self-start rounded-full text-xs sm:text-sm ${
                  isToday
                    ? "bg-foreground font-semibold text-background"
                    : weekday === 0
                      ? "text-red-600"
                      : weekday === 6
                        ? "text-blue-600"
                        : ""
                } ${inMonth ? "" : "opacity-60"}`}
              >
                {date.getDate()}
              </span>

              {/* 넓은 화면: 일정 요약 줄 */}
              <div className="hidden flex-col gap-0.5 sm:flex">
                {dayEvents.slice(0, MAX_CHIPS).map((event) => (
                  <EventChip key={event.id} event={event} />
                ))}
                {dayEvents.length > MAX_CHIPS ? (
                  <span className="px-1 text-xs text-foreground/60">
                    +{dayEvents.length - MAX_CHIPS}개
                  </span>
                ) : null}
              </div>

              {/* 좁은 화면: 점 */}
              {dayEvents.length > 0 ? (
                <div className="flex gap-0.5 px-0.5 sm:hidden" aria-hidden="true">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[event.status]}`}
                    />
                  ))}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
