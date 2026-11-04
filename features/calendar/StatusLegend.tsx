import { EVENT_STATUS_LABEL } from "../../types/schedule";
import { CHIP_CLASS, LEGEND_ORDER } from "./statusStyle";

// 달력 아래의 색 안내(범례): 어떤 색이 어떤 상태인지 알려 준다.
export default function StatusLegend() {
  return (
    <ul
      aria-label="일정 상태 색 안내"
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-foreground/70"
    >
      {LEGEND_ORDER.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`inline-block h-3.5 w-6 rounded ${CHIP_CLASS[status]}`}
          />
          {EVENT_STATUS_LABEL[status]}
        </li>
      ))}
    </ul>
  );
}
