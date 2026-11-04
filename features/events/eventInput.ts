// 일정 입력값 검사. 서버(API)와 입력 폼이 같은 규칙을 쓴다. 서버의 검사가 최종 기준이다.
import { EVENT_STATUSES, type EventStatus } from "../../types/schedule";

// 폼·API가 주고받는 일정 입력 항목 (camelCase)
export interface EventFields {
  title: string; // 행사명
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // 여러 날 일정의 종료일
  startTime: string | null; // HH:mm
  endTime: string | null;
  isOverseas: boolean; // true면 현지 시각
  city: string | null;
  country: string | null;
  assigneeId: string | null; // 담당자 (빈칸 가능)
  status: EventStatus;
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TITLE_MAX = 200;
const PLACE_MAX = 100;

export function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// 빈 글자("")는 "비어 있음(null)"으로 본다.
function emptyToNull(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? null : value;
}

// 보낸 항목만 골라 검사한다. (수정할 때는 일부 항목만 보낼 수 있다)
export function parseEventFields(body: unknown): ParseResult<Partial<EventFields>> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "보낸 내용을 읽을 수 없습니다." };
  }
  const input = body as Record<string, unknown>;
  const out: Partial<EventFields> = {};

  if ("title" in input) {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title) return { ok: false, message: "행사명을 입력해 주세요." };
    if (title.length > TITLE_MAX) {
      return { ok: false, message: `행사명은 ${TITLE_MAX}자 이내로 입력해 주세요.` };
    }
    out.title = title;
  }

  if ("startDate" in input) {
    const value = input.startDate;
    if (typeof value !== "string" || !isRealDate(value)) {
      return { ok: false, message: "시작일을 올바른 날짜로 입력해 주세요." };
    }
    out.startDate = value;
  }

  if ("endDate" in input) {
    const value = emptyToNull(input.endDate);
    if (value !== null && (typeof value !== "string" || !isRealDate(value))) {
      return { ok: false, message: "종료일을 올바른 날짜로 입력해 주세요." };
    }
    out.endDate = value as string | null;
  }

  for (const [key, label] of [
    ["startTime", "시작 시간"],
    ["endTime", "종료 시간"],
  ] as const) {
    if (key in input) {
      const value = emptyToNull(input[key]);
      if (value !== null && (typeof value !== "string" || !TIME_PATTERN.test(value))) {
        return { ok: false, message: `${label}을 올바른 시각(예: 09:30)으로 입력해 주세요.` };
      }
      out[key] = value as string | null;
    }
  }

  if ("isOverseas" in input) {
    if (typeof input.isOverseas !== "boolean") {
      return { ok: false, message: "해외 일정 여부를 확인해 주세요." };
    }
    out.isOverseas = input.isOverseas;
  }

  for (const [key, label] of [
    ["city", "도시"],
    ["country", "국가"],
  ] as const) {
    if (key in input) {
      const value = emptyToNull(input[key]);
      if (value !== null) {
        if (typeof value !== "string" || value.trim().length > PLACE_MAX) {
          return { ok: false, message: `${label}는 ${PLACE_MAX}자 이내로 입력해 주세요.` };
        }
        out[key] = value.trim();
      } else {
        out[key] = null;
      }
    }
  }

  if ("assigneeId" in input) {
    const value = emptyToNull(input.assigneeId);
    if (value !== null && (typeof value !== "string" || !UUID_PATTERN.test(value))) {
      return { ok: false, message: "담당자를 다시 선택해 주세요." };
    }
    out.assigneeId = value as string | null;
  }

  if ("status" in input) {
    if (!EVENT_STATUSES.includes(input.status as EventStatus)) {
      return { ok: false, message: "일정 상태를 다시 선택해 주세요." };
    }
    out.status = input.status as EventStatus;
  }

  return { ok: true, value: out };
}

// 항목끼리의 앞뒤 관계 검사. 문제가 있으면 안내 문구를, 없으면 null을 돌려준다.
export function checkCrossFields(fields: EventFields): string | null {
  if (fields.endDate && fields.endDate < fields.startDate) {
    return "종료일은 시작일보다 빠를 수 없습니다.";
  }
  const sameDay = !fields.endDate || fields.endDate === fields.startDate;
  if (
    sameDay &&
    fields.startTime &&
    fields.endTime &&
    fields.endTime < fields.startTime
  ) {
    return "종료 시간은 시작 시간보다 빠를 수 없습니다.";
  }
  if (fields.endTime && !fields.startTime) {
    return "종료 시간을 쓰려면 시작 시간도 입력해 주세요.";
  }
  return null;
}

// 앱의 항목(camelCase)을 저장소의 열 이름(snake_case)으로 바꾼다.
const COLUMN_BY_FIELD: Record<keyof EventFields, string> = {
  title: "title",
  startDate: "start_date",
  endDate: "end_date",
  startTime: "start_time",
  endTime: "end_time",
  isOverseas: "is_overseas",
  city: "city",
  country: "country",
  assigneeId: "assignee_id",
  status: "status",
};

export function fieldsToRow(fields: Partial<EventFields>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(fields) as (keyof EventFields)[]) {
    row[COLUMN_BY_FIELD[key]] = fields[key];
  }
  return row;
}
