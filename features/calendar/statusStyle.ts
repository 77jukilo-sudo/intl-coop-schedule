// 일정 상태별 달력 표시 규칙 (PRD 5번 ①).
//  - 확인 전(pending_review): 회색, 흐릿하게
//  - 미확정(tentative, 1안·2안 포함): 파란색, 흐릿하게
//  - 확정(confirmed): 진한 색
//  - 취소(cancelled): 취소선 + 회색
// 색만으로 구분하지 않도록 화면 읽기 프로그램용 글자(상태 이름)도 함께 붙인다.
import type { EventStatus } from "../../types/schedule";

// 일정 줄(칩)의 모양
export const CHIP_CLASS: Record<EventStatus, string> = {
  pending_review: "bg-foreground/10 text-foreground/55",
  tentative: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  confirmed: "bg-foreground text-background",
  cancelled: "bg-foreground/5 text-foreground/40 line-through",
};

// 범례(색 안내)에 보여 줄 순서
export const LEGEND_ORDER: EventStatus[] = [
  "confirmed",
  "pending_review",
  "tentative",
  "cancelled",
];
