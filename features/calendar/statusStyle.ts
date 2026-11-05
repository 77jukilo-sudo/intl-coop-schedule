// 일정 상태별 달력 표시 규칙 (PRD 5번 ①).
//  - 확인 전(pending_review): 회색, 흐릿하게
//  - 미확정(tentative, 1안·2안 포함): 파란색, 흐릿하게
//  - 확정(confirmed): 진한 색 (어두운 우주 배경에서는 밝은 흰색 막대에 검은 글자)
//  - 취소(cancelled): 취소선 + 회색
// 색만으로 구분하지 않도록 화면 읽기 프로그램용 글자(상태 이름)도 함께 붙인다.
import type { EventStatus } from "../../types/schedule";

// 일정 줄(칩)의 모양
export const CHIP_CLASS: Record<EventStatus, string> = {
  pending_review: "bg-white/12 text-white/65",
  tentative: "bg-sky-400/20 text-sky-200",
  confirmed: "bg-foreground text-background",
  cancelled: "bg-white/5 text-white/40 line-through",
};

// 범례(색 안내)에 보여 줄 순서
export const LEGEND_ORDER: EventStatus[] = [
  "confirmed",
  "pending_review",
  "tentative",
  "cancelled",
];
