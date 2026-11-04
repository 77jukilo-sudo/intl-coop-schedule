// 동시 수정 때 "다른 사람이 저장한 최신 내용"과 "내가 입력한 내용"을 항목별로 비교한다.
import { EVENT_STATUS_LABEL, type ScheduleEvent } from "../../types/schedule";
import type { EventFields } from "./eventInput";

export type WhoChanged = "both" | "theirs" | "mine";

export interface DiffRow {
  label: string; // 항목 이름 (행사명, 날짜 ...)
  theirs: string; // 지금 저장된 최신 내용
  mine: string; // 내가 입력한 내용
  who: WhoChanged; // 처음 열었을 때와 비교해 누가 고쳤는지
}

// 비교용으로 모든 항목을 같은 모양의 글자로 바꾼다.
type Snapshot = Record<string, string>;

function snapshotOf(
  fields: EventFields,
  memberName: (id: string | null) => string,
): Snapshot {
  return {
    행사명: fields.title,
    날짜: `${fields.startDate || "미정"}${fields.endDate ? ` ~ ${fields.endDate}` : ""}`,
    시간: fields.startTime
      ? `${fields.startTime}${fields.endTime ? ` ~ ${fields.endTime}` : ""}`
      : "미정",
    "현지 시각(외국 일정)": fields.isOverseas ? "예" : "아니오",
    장소: [fields.city, fields.country].filter(Boolean).join(", ") || "미정",
    담당자: memberName(fields.assigneeId),
    상태: EVENT_STATUS_LABEL[fields.status],
  };
}

export function eventToFields(event: ScheduleEvent): EventFields {
  return {
    title: event.title,
    startDate: event.startDate ?? "",
    endDate: event.endDate,
    startTime: event.startTime,
    endTime: event.endTime,
    isOverseas: event.isOverseas,
    city: event.city,
    country: event.country,
    assigneeId: event.assigneeId,
    status: event.status,
  };
}

// base: 내가 처음 열었을 때의 일정, latest: 지금 저장된 최신 일정, mine: 내가 입력한 값
// 최신 내용과 내 입력이 다른 항목만 돌려준다.
export function diffWithLatest(
  base: ScheduleEvent,
  latest: ScheduleEvent,
  mine: EventFields,
  memberName: (id: string | null) => string,
): DiffRow[] {
  const baseSnap = snapshotOf(eventToFields(base), memberName);
  const theirSnap = snapshotOf(eventToFields(latest), memberName);
  const mineSnap = snapshotOf(mine, memberName);

  return Object.keys(mineSnap)
    .filter((label) => mineSnap[label] !== theirSnap[label])
    .map((label) => {
      const theirsChanged = theirSnap[label] !== baseSnap[label];
      const mineChanged = mineSnap[label] !== baseSnap[label];
      const who: WhoChanged =
        theirsChanged && mineChanged ? "both" : theirsChanged ? "theirs" : "mine";
      return {
        label,
        theirs: theirSnap[label],
        mine: mineSnap[label],
        who,
      };
    });
}

export const WHO_LABEL: Record<WhoChanged, string> = {
  both: "둘 다 고침",
  theirs: "다른 사람만 고침",
  mine: "나만 고침",
};
