// 일정관리 앱의 데이터 모양 정의 (DESIGN.md 3번 기준).
// 이 파일은 다른 폴더를 가져오지 않는다. 모든 기능이 이 모양을 함께 쓴다.

// 일정 상태: 달력 색과 연결된다.
//  - pending_review: 확인 전 (AI가 추출했고 부원이 아직 확인 안 함) → 회색
//  - tentative: 미확정 (1안·2안 중 미정 포함) → 파란색
//  - confirmed: 확정 → 진한 색
//  - cancelled: 취소 → 취소선 + 회색
export const EVENT_STATUSES = [
  "pending_review",
  "tentative",
  "confirmed",
  "cancelled",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

// 지리적 구분: 국내 / 국외
export const GEO_CATEGORIES = ["domestic", "overseas", "unclassified"] as const;
export type GeoCategory = (typeof GEO_CATEGORIES)[number];

// 업무성격 구분: 보고 / 출장 / 초청 / 방문 / 기타
//  - 초청: 우리가 외국 기관·인사를 불러오는 것
//  - 방문: 외국 손님이 우리를 찾아오는 것
export const WORK_CATEGORIES = [
  "report",
  "trip",
  "invite",
  "visit",
  "etc",
  "unclassified",
] as const;
export type WorkCategory = (typeof WORK_CATEGORIES)[number];

// 화면에 보여 줄 한국어 이름
export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  pending_review: "확인 전",
  tentative: "미확정",
  confirmed: "확정",
  cancelled: "취소",
};

export const GEO_CATEGORY_LABEL: Record<GeoCategory, string> = {
  domestic: "국내",
  overseas: "국외",
  unclassified: "미분류",
};

export const WORK_CATEGORY_LABEL: Record<WorkCategory, string> = {
  report: "보고",
  trip: "출장",
  invite: "초청",
  visit: "방문",
  etc: "기타",
  unclassified: "미분류",
};

// 일정 한 건
export interface ScheduleEvent {
  id: string;

  // 1안·2안을 묶는 번호. 안이 없는 일정은 null.
  groupId: string | null;
  optionNo: number | null;

  title: string; // 행사명 (필수)

  // 날짜가 null이면 "날짜 미정" 목록에 들어간다. (예: "11월 중순", "추후 통보")
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null; // 여러 날 출장이면 종료일
  // 시간: 국내 일정은 한국 시각, 외국 일정은 현지 시각
  startTime: string | null; // HH:mm
  endTime: string | null;
  isOverseas: boolean; // true면 "현지 시각" 표시를 함께 보여 준다.

  // 장소 (도시 단위). 문서에 없으면 null → 화면에는 "장소 미정"
  city: string | null;
  country: string | null;
  locationNote: string | null; // 문서에 적힌 장소 원문
  lat: number | null; // 지도 표시용 위치
  lng: number | null;

  assigneeId: string | null; // 담당자. 비어 있으면 "담당자 미정"

  status: EventStatus;
  geoCategory: GeoCategory;
  workCategory: WorkCategory;

  sourceName: string; // 출처 문서명, 직접 입력한 일정은 "직접 입력"

  // 선택되지 않은 안을 달력에서 숨긴 시각. 지우지 않고 기록으로만 남긴다.
  hiddenAt: string | null;

  version: number; // 동시 수정 감지용. 저장할 때마다 1씩 늘어난다.

  createdBy: string;
  createdAt: string; // ISO 시각
  updatedAt: string;
}

// 수정 이력 한 건: 누가, 언제, 무엇을 고쳤는지
export interface EventHistory {
  id: string;
  eventId: string;
  changedBy: string;
  changedAt: string;
  summary: string; // 예: "날짜 11/12 → 11/15"
}

// 부원 (로그인 계정과 연결). 담당자 선택 목록에 쓴다.
export interface Member {
  id: string;
  name: string;
}

// 직접 입력하는 출처 이름
export const MANUAL_SOURCE_NAME = "직접 입력";
