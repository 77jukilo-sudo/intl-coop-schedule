// 다시 올린 문서의 일정과 "비슷한 기존 일정"을 찾는다. (작업 16: 변경 자료 반영)
// 여기서는 후보만 찾는다. 합치거나 지우는 일은 하지 않고, 부원이 "변경으로 반영"을 누를 때만 일어난다.
// 담당자가 여럿이라 비슷한 일정이 중복될 수 있으므로, 후보가 있어도 새 일정은 일단 그대로 저장한다.
import type { EventRow } from "../../features/events/eventRow";
import type { ExtractedEvent } from "./extractEvents";

const SIMILAR_THRESHOLD = 0.6; // 행사명이 이 정도 이상 닮으면 같은 행사로 본다 (0~1)
const MIN_CONTAINED_LENGTH = 4; // 한쪽 이름이 다른 쪽에 통째로 들어 있을 때 인정하는 최소 글자 수

// 비교용으로 이름을 다듬는다: 소문자로, 글자·숫자만 남긴다.
function normalize(title: string): string {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function bigrams(text: string): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < text.length - 1; i++) {
    const key = text.slice(i, i + 2);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

// 두 행사명이 얼마나 닮았는지 (0~1)
export function titleSimilarity(a: string, b: string): number {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= MIN_CONTAINED_LENGTH && long.includes(short)) return 0.9;
  if (short.length < 2) return 0;

  const bx = bigrams(x);
  const by = bigrams(y);
  let overlap = 0;
  for (const [key, count] of bx) overlap += Math.min(count, by.get(key) ?? 0);
  return (2 * overlap) / (x.length - 1 + (y.length - 1)); // Dice 계수
}

// ---- 이름이 달라도 "같은 일정"으로 보이는 경우 ----
// 같은 출장을 문서마다 다른 기관 이름·약칭으로 부르는 일이 많다. (예: "BAM 2차 MOU" / "방콕상업자산관리(BAM) MOU 체결")
// 그래서 이름이 달라도 "같은 장소 + 같은 날짜"이면 같은 일정일 가능성이 높다고 보고 합칠지 묻는다.
// 문서 속 AI 없이 앱 안에서 하는 규칙이라 개인정보가 밖으로 나가지 않는다.
const SCHEDULE_MATCH_SCORE = 0.7; // 며칠짜리 일정에서 장소·날짜가 같을 때의 닮음 점수
const SAME_DAY_MATCH_SCORE = 0.65; // 하루짜리는 같은 날 같은 도시 일정이 많아서, 이름에도 단서가 있을 때만

// 영문·숫자로 된 약칭(예: BAM, MOU)을 뽑는다. 일반적인 영단어 두 글자 이상만.
function latinTokens(title: string): Set<string> {
  return new Set((title.toUpperCase().match(/[A-Z][A-Z0-9]{1,}/g) ?? []));
}

function samePlace(incoming: ExtractedEvent, row: EventRow): boolean {
  if (incoming.city && row.city) return incoming.city === row.city;
  // 도시를 한쪽이라도 모르면 나라가 같은지만 본다 (둘 다 나라를 알 때)
  if (incoming.country && row.country) return incoming.country === row.country;
  return false;
}

// 장소와 날짜가 같은지로 매기는 점수 (해당 없으면 0)
function scheduleScore(incoming: ExtractedEvent, row: EventRow): number {
  if (incoming.startDate === null || row.start_date === null) return 0;
  if (incoming.startDate !== row.start_date) return 0;
  const inEnd = incoming.endDate ?? incoming.startDate;
  const rowEnd = row.end_date ?? row.start_date;
  if (inEnd !== rowEnd) return 0;
  if (!samePlace(incoming, row)) return 0;
  if (inEnd !== incoming.startDate) return SCHEDULE_MATCH_SCORE; // 며칠짜리: 장소·날짜가 같으면 충분
  // 하루짜리: 이름에 공통 약칭이 있거나 이름이 어느 정도 닮을 때만
  const a = latinTokens(incoming.title);
  const shared = [...latinTokens(row.title)].some((t) => a.has(t));
  return shared || titleSimilarity(incoming.title, row.title) >= 0.3 ? SAME_DAY_MATCH_SCORE : 0;
}

const hm = (time: string | null) => (time ? time.slice(0, 5) : null);

// 새 일정이 기존 일정과 "내용이 달라졌는지". 새 문서에 없는(비어 있는) 항목은 달라진 것으로 보지 않는다.
export function hasChange(incoming: ExtractedEvent, existing: EventRow): boolean {
  if (incoming.title !== existing.title) return true;
  if (incoming.startDate !== null) {
    if (incoming.startDate !== existing.start_date) return true;
    if ((incoming.endDate ?? null) !== (existing.end_date ?? null)) return true;
  }
  if (incoming.startTime !== null && incoming.startTime !== hm(existing.start_time)) return true;
  if (incoming.endTime !== null && incoming.endTime !== hm(existing.end_time)) return true;
  if (incoming.city !== null && incoming.city !== existing.city) return true;
  if (incoming.country !== null && incoming.country !== existing.country) return true;
  return false;
}

export interface SimilarMatch {
  incomingIndex: number; // 새로 뽑은 일정 목록에서의 위치
  existing: EventRow;
}

// 새로 뽑은 일정마다 가장 닮은 기존 일정을 하나씩 찾는다. (한 기존 일정은 한 번만 짝이 된다)
// 제외: 1안·2안은 처리가 복잡해 짝짓지 않는다. 날짜 없던 일정을 날짜 모름으로 덮어쓰는 경우도 제외한다.
export function findSimilarEvents(
  incoming: ExtractedEvent[],
  existing: EventRow[],
): SimilarMatch[] {
  const pairs: { i: number; j: number; score: number }[] = [];
  incoming.forEach((event, i) => {
    if (event.optionNo !== null) return;
    existing.forEach((row, j) => {
      if (row.group_id !== null || row.hidden_at !== null || row.status === "cancelled") return;
      // 기존엔 날짜가 있는데 새 문서는 날짜를 모르면, 바뀐 정보가 아니라 정보가 줄어든 것이다.
      if (event.startDate === null && row.start_date !== null) return;
      // 이름이 닮았거나, 이름은 달라도 장소·날짜가 같으면 후보로 본다
      const score = Math.max(titleSimilarity(event.title, row.title), scheduleScore(event, row));
      if (score < SIMILAR_THRESHOLD) return;
      if (!hasChange(event, row)) return;
      pairs.push({ i, j, score });
    });
  });

  pairs.sort((a, b) => b.score - a.score);
  const usedIncoming = new Set<number>();
  const usedExisting = new Set<number>();
  const matches: SimilarMatch[] = [];
  for (const { i, j } of pairs) {
    if (usedIncoming.has(i) || usedExisting.has(j)) continue;
    usedIncoming.add(i);
    usedExisting.add(j);
    matches.push({ incomingIndex: i, existing: existing[j] });
  }
  return matches.sort((a, b) => a.incomingIndex - b.incomingIndex);
}
