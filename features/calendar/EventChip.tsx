import { EVENT_STATUS_LABEL, type ScheduleEvent } from "../../types/schedule";
import { CHIP_CLASS } from "./statusStyle";

// 달력 칸 안의 일정 요약 한 줄: (안 번호) 시간과 행사명을 작게 보여 준다.
// 색은 상태에 따라 달라진다. (확인 전 회색 / 미확정 파란색 / 확정 진한 색 / 취소 취소선)
// onOpen이 있으면 눌렀을 때 상세 팝업을 연다.
// compact: 좁은 화면의 작은 칸용. 글자를 더 작게 하고 시간은 생략한다.
export default function EventChip({
  event,
  compact = false,
  onOpen,
}: {
  event: ScheduleEvent;
  compact?: boolean;
  onOpen?: (event: ScheduleEvent) => void;
}) {
  const statusLabel = EVENT_STATUS_LABEL[event.status];
  // 좁은 칸(compact)은 한 줄로 자르면 2~3글자만 보여서, 두 줄까지 줄바꿈해 더 많이 보여 준다.
  const sizeClass = compact
    ? "line-clamp-2 break-all whitespace-normal px-1 py-px text-[10px] leading-4"
    : "block truncate px-1.5 py-0.5 text-xs leading-5";
  // 주의: 줄 수 제한(line-clamp)은 display를 직접 정하므로 compact에는 block을 함께 쓰지 않는다.
  const className = `w-full rounded text-left ${sizeClass} ${CHIP_CLASS[event.status]}`;
  const title = `${statusLabel} · ${event.title}`;

  const content = (
    <>
      {/* 색을 구별하기 어려운 사람과 화면 읽기 프로그램을 위해 상태 이름도 글자로 둔다 */}
      <span className="sr-only">{statusLabel}: </span>
      {event.optionNo ? (
        <span className="mr-0.5 font-semibold">{event.optionNo}안</span>
      ) : null}
      {event.startTime && !compact ? (
        <span className="mr-1 opacity-70">{event.startTime}</span>
      ) : null}
      {event.title}
    </>
  );

  if (!onOpen) {
    return (
      <div title={title} className={className}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation(); // 칸 전체를 누른 것으로 처리되지 않게 한다
        onOpen(event);
      }}
      className={`${className} hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foreground`}
    >
      {content}
    </button>
  );
}
