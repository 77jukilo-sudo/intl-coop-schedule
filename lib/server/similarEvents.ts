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
      const score = titleSimilarity(event.title, row.title);
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
