// 문서에서 일정을 뽑는 전체 흐름 (서버에서만 쓴다).
//  1) 우리 서버가 문서에서 글자를 뽑는다. (PDF·Word. 외부로 보내지 않는다)
//  2) 규칙으로 날짜·장소·행사명 재료·1안/2안·업무성격 후보를 찾는다.
//  3) (선택, 기본 꺼짐) 가린 짧은 원문만 AI에게 보내 제목·분류를 정리한다.
// 문서 전체를 AI가 읽는 예전 방식은 AI_FULL_DOCUMENT=1 일 때만 쓰고, 기본은 꺼져 있다. (사진·스캔본 전용 예비 방법)
import { todayKey } from "../../features/calendar/dateUtils";
import { readDocumentText } from "./documentText";
import {
  ExtractError,
  dedupe,
  extractEventsFromDocument,
  sanitizeEvent,
  validateOptionGroups,
  type ExtractedEvent,
  type ExtractionResult,
} from "./extractEvents";
import { extractByRules } from "./ruleExtract";
import { tidyEvents } from "./tidyWithAi";
import type { UploadKind } from "../../features/upload/uploadRules";

const MIN_TEXT_CHARS = 20; // 글자가 이보다 적으면 글자가 없는 문서(스캔본 등)로 본다
const MAX_EVENTS = 200;

export interface PipelineResult extends ExtractionResult {
  aiTidied: boolean; // AI 정리 단계를 거쳤는지
}

const fullDocumentAllowed = () => process.env.AI_FULL_DOCUMENT === "1";

const NO_TEXT_MESSAGE =
  "글자를 읽을 수 없는 문서입니다. 스캔본이나 사진은 지원하지 않습니다. 글자가 들어 있는 PDF·Word로 올리거나 직접 일정을 추가해 주세요.";

export async function extractFromDocument(input: {
  kind: UploadKind;
  bytes: Buffer;
  fileName: string;
}): Promise<PipelineResult> {
  const { kind, bytes, fileName } = input;

  // 사진: 글자 인식 기능이 없어 앱이 직접 읽을 수 없다.
  if (kind === "image") {
    if (!fullDocumentAllowed()) throw new ExtractError("UNREADABLE", NO_TEXT_MESSAGE);
    return { ...(await extractEventsFromDocument({ kind, bytes })), aiTidied: false };
  }

  const text = await readDocumentText(kind === "pdf" ? "pdf" : "docx", bytes);
  if (text.replace(/\s/g, "").length < MIN_TEXT_CHARS) {
    // 글자가 없는 PDF(스캔본)
    if (!fullDocumentAllowed()) throw new ExtractError("UNREADABLE", NO_TEXT_MESSAGE);
    return { ...(await extractEventsFromDocument({ kind, bytes })), aiTidied: false };
  }

  const rule = extractByRules(text, fileName, todayKey());
  const tidy = await tidyEvents(rule.docTitle, rule.events);

  const events: ExtractedEvent[] = [];
  rule.events.forEach((e, index) => {
    const t = tidy?.get(index);
    if (t && !t.keep) return; // AI가 "일정이 아님"으로 표시한 후보
    const sanitized = sanitizeEvent({
      titleCountry: t ? t.titleCountry : e.titleCountry,
      title: t ? t.title : e.title,
      startDate: e.startDate,
      endDate: e.endDate,
      dateText: null,
      startTime: null,
      endTime: null,
      isOverseas: e.isOverseas,
      city: e.city,
      country: e.country,
      optionGroup: e.optionGroup,
      optionNo: e.optionNo,
      workCategory: t ? t.workCategory : e.workCategory,
    });
    if (sanitized) events.push(sanitized);
  });

  return {
    events: validateOptionGroups(dedupe(events)).slice(0, MAX_EVENTS),
    truncated: false,
    aiTidied: tidy !== null,
  };
}
