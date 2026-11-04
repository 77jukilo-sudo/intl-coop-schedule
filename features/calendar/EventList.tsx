import type { ScheduleEvent } from "../../types/schedule";
import EventChip from "./EventChip";

// 하루치 일정을 세로로 나열한다. (주 보기, 오늘 보기, 모바일에서 날짜를 눌렀을 때 쓴다)
export default function EventList({
  events,
  emptyText = "일정이 없습니다.",
}: {
  events: ScheduleEvent[];
  emptyText?: string;
}) {
  if (events.length === 0) {
    return <p className="py-2 text-sm text-foreground/50">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {events.map((event) => (
        <li key={event.id}>
          <EventChip event={event} />
        </li>
      ))}
    </ul>
  );
}
