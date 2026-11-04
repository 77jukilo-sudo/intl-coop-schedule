import { EVENT_STATUS_LABEL, type ScheduleEvent } from "../../types/schedule";
import { CHIP_CLASS } from "./statusStyle";

// 달력 칸 안의 일정 요약 한 줄: (안 번호) 시간과 행사명을 작게 보여 준다.
// 색은 상태에 따라 달라진다. (확인 전 회색 / 미확정 파란색 / 확정 진한 색 / 취소 취소선)
// 클릭하면 뜨는 상세 팝업은 작업 7번에서 붙인다.
export default function EventChip({ event }: { event: ScheduleEvent }) {
  const statusLabel = EVENT_STATUS_LABEL[event.status];

  return (
    <div
      title={`${statusLabel} · ${event.title}`}
      className={`truncate rounded px-1.5 py-0.5 text-xs leading-5 ${CHIP_CLASS[event.status]}`}
    >
      {/* 색을 구별하기 어려운 사람과 화면 읽기 프로그램을 위해 상태 이름도 글자로 둔다 */}
      <span className="sr-only">{statusLabel}: </span>
      {event.optionNo ? (
        <span className="mr-1 font-semibold">{event.optionNo}안</span>
      ) : null}
      {event.startTime ? (
        <span className="mr-1 opacity-70">{event.startTime}</span>
      ) : null}
      {event.title}
    </div>
  );
}
