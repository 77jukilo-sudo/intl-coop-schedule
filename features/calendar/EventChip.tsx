import type { ScheduleEvent } from "../../types/schedule";

// 달력 칸 안의 일정 요약 한 줄: 시간(있으면)과 행사명을 작게 보여 준다.
// 상태별 색 구분은 작업 6번, 클릭하면 뜨는 상세 팝업은 작업 7번에서 붙인다.
export default function EventChip({ event }: { event: ScheduleEvent }) {
  return (
    <div className="truncate rounded bg-foreground/10 px-1.5 py-0.5 text-xs leading-5">
      {event.startTime ? (
        <span className="mr-1 text-foreground/60">{event.startTime}</span>
      ) : null}
      {event.title}
    </div>
  );
}
