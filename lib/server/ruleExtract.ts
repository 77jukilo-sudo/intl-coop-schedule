// 문서 글자에서 규칙으로 일정 후보를 찾는다. AI를 쓰지 않고 우리 서버 안에서만 처리한다. (서버에서만 쓴다)
// 찾는 것: 날짜(기간 포함), 장소(국가·도시), 행사명 재료, 1안·2안, 업무성격.
// 대상: "□ (출장계획) ㅇ (1차 포럼) … 10/13(화) ~15(목)"처럼 항목 기호(□ ㅇ ※ 등)로 나뉜 보고서 모양의 글.
// 모양이 다른 문서는 후보를 못 찾을 수 있다. 그때는 억지로 지어내지 않고 빈 결과를 돌려준다.
import type { WorkCategory } from "../../types/schedule";
import { COUNTRIES, COUNTRY_ALIASES, CITY_TO_COUNTRY, HOME_COUNTRY } from "./placeNames";

export interface RuleEvent {
  titleCountry: string | null; // 달력 제목의 국가명 (방문지 또는 방문자의 국가)
  title: string; // 주최자·행사명 재료 (국가명 제외)
  startDate: string;
  endDate: string | null;
  city: string | null;
  country: string | null;
  isOverseas: boolean;
  workCategory: WorkCategory;
  optionGroup: string | null;
  optionNo: number | null;
  context: string; // 이 일정이 적힌 원문 한 항목 (AI 정리 단계에서 개인정보를 가린 뒤 일부만 보낸다)
}

export interface RuleResult {
  docTitle: string;
  events: RuleEvent[];
}

const DOW = "[월화수목금토일]";
// 년·월·일 모두 있는 날짜 / 월·일만 있는 날짜 (월·일만 있으면 문서 작성일의 연도를 쓴다)
const FULL_DATE = `(\\d{4})\\s*[.\\-/년]\\s*(\\d{1,2})\\s*[.\\-/월]\\s*(\\d{1,2})\\s*일?`;
const MD_DATE = `(?<![\\d.])(\\d{1,2})\\s*[./월]\\s*(\\d{1,2})\\s*일?`;
const DATE_RE = new RegExp(`${FULL_DATE}(?:\\s*\\(\\s*${DOW}\\s*\\))?|${MD_DATE}(?:\\s*\\(\\s*${DOW}\\s*\\))?`, "g");
// 날짜 바로 뒤에 이어지는 기간의 끝 ("~15(목)", "~ 11월 2일", "~16")
const RANGE_RE = new RegExp(
  `^\\s*[~∼～–]\\s*(?:${FULL_DATE}|(\\d{1,2})\\s*[./월]\\s*(\\d{1,2})\\s*일?|(\\d{1,2})\\s*일?)(?:\\s*\\(\\s*${DOW}\\s*\\))?`,
);
const UNIT_AFTER_RE = /^\s*[조억만천%원명건개배년분초호주]/; // "3.5조원", "2명"처럼 날짜가 아닌 숫자

const BULLET_RE = /^(□|■|ㅇ|○|●|▪|•|◦|⦁|·|-|\*|※|[①-⑩]|\d+[.)])\s*/;
const TOP_BULLET_RE = /^(□|■)/;
const DOC_INFO_RE = /^\(.*(20\d{2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})\.?\s*\)\s*$/;

const SCHEDULE_LABEL_RE = /(계획|일정|일시|기간|개최|행사)/;
const NOT_SCHEDULE_LABEL_RE = /(배경|목적|개요|현황|요청|효과|향후|후속|항공|숙박|교통|예산|비용|소요|지원)/;
const SKIP_FALLBACK_LABEL_RE = /(항공|숙박|교통|예산|비용)/;
const GENERIC_LABEL_RE = /(출장|방문|계획|일정|개요|행사)/;

const dayMs = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
function isValid(y: number, m: number, d: number): boolean {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
const toTime = (key: string) => new Date(`${key}T00:00:00Z`).getTime();

interface Block {
  top: boolean; // □ 같은 큰 항목인지
  sectionLabel: string; // 이 항목이 속한 큰 항목의 이름 (예: 출장계획)
  label: string | null; // 이 항목의 "(…)" 이름 (예: 1차 포럼)
  text: string;
}

function normalize(text: string): string[] {
  return text
    .replace(/ /g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line !== "");
}

const firstLabel = (text: string): string | null => /^\(\s*([^()]{1,30}?)\s*\)/.exec(text)?.[1] ?? null;

// 항목 기호로 글을 나눈다. 기호 없이 이어지는 줄은 앞 항목에 붙인다.
function splitBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let section = "";
  for (const line of lines) {
    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      const text = line.slice(bullet[0].length).trim();
      const top = TOP_BULLET_RE.test(bullet[1]);
      const label = firstLabel(text);
      if (top) section = label ?? text.slice(0, 12);
      blocks.push({ top, sectionLabel: section, label, text });
    } else if (blocks.length > 0) {
      blocks[blocks.length - 1].text += ` ${line}`;
    } else {
      blocks.push({ top: false, sectionLabel: "", label: null, text: line });
    }
  }
  return blocks;
}

interface FoundDate {
  startDate: string;
  endDate: string | null;
  index: number; // 글 안에서의 위치
  optionNo: number | null;
}

// 글에서 날짜(와 기간)를 모두 찾는다.
function scanDates(text: string, docDate: string): FoundDate[] {
  const docYear = Number(docDate.slice(0, 4));
  const found: FoundDate[] = [];
  DATE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DATE_RE.exec(text)) !== null) {
    const end = m.index + m[0].length;
    // 날짜가 아닌 숫자 걸러내기: 바로 뒤에 숫자가 붙거나 단위(조·명·%…)가 오면 제외
    if (/\d/.test(text[end] ?? "") || UNIT_AFTER_RE.test(text.slice(end))) continue;

    const explicitYear = m[1] ? Number(m[1]) : null;
    const month = Number(m[1] ? m[2] : m[4]);
    const day = Number(m[1] ? m[3] : m[5]);
    let year = explicitYear ?? docYear;
    if (!isValid(year, month, day)) continue;
    let start = toKey(year, month, day);
    // 월·일만 적힌 날짜가 문서 작성일보다 한참 앞서면 다음 해로 본다.
    if (!explicitYear && toTime(start) < toTime(docDate) - 45 * dayMs) {
      year += 1;
      if (!isValid(year, month, day)) continue;
      start = toKey(year, month, day);
    }

    // 기간의 끝
    let endKey: string | null = null;
    let consumed = end;
    const range = RANGE_RE.exec(text.slice(end));
    if (range) {
      const afterRange = text.slice(end + range[0].length);
      const unitAfter = UNIT_AFTER_RE.test(afterRange) || /^\d/.test(afterRange);
      if (!unitAfter) {
        const startY = Number(start.slice(0, 4));
        const startM = Number(start.slice(5, 7));
        let ey = startY;
        let em = startM;
        let ed: number | null = null;
        if (range[1]) {
          ey = Number(range[1]);
          em = Number(range[2]);
          ed = Number(range[3]);
        } else if (range[4]) {
          em = Number(range[4]);
          ed = Number(range[5]);
        } else if (range[6]) {
          ed = Number(range[6]);
        }
        if (ed !== null && ed >= 1 && ed <= 31 && em >= 1 && em <= 12) {
          let candidate = isValid(ey, em, ed) ? toKey(ey, em, ed) : null;
          if (candidate && candidate < start) {
            // 끝이 시작보다 앞서면 달(또는 해)이 넘어간 것으로 본다.
            if (range[6]) em = startM + 1 > 12 ? 1 : startM + 1;
            else ey = startY + 1;
            if (range[6] && startM === 12) ey = startY + 1;
            candidate = isValid(ey, em, ed) ? toKey(ey, em, ed) : null;
          }
          if (candidate && candidate > start) {
            endKey = candidate;
            consumed = end + range[0].length;
          }
        }
      }
    }

    const before = text.slice(Math.max(0, m.index - 14), m.index);
    const opt = /([1-9]|[A-Ca-c])\s*안\s*[:：\-–)\]]?\s*$/.exec(before);
    const optionNo = opt ? (/\d/.test(opt[1]) ? Number(opt[1]) : opt[1].toUpperCase().charCodeAt(0) - 64) : null;

    found.push({ startDate: start, endDate: endKey, index: m.index, optionNo });
    DATE_RE.lastIndex = consumed;
  }
  return found;
}

// ---- 장소 ----
const CITY_NAMES = Object.keys(CITY_TO_COUNTRY).sort((a, b) => b.length - a.length);
const COUNTRY_NAMES = [...COUNTRIES, ...Object.keys(COUNTRY_ALIASES)].sort((a, b) => b.length - a.length);
const canonCountry = (name: string) => COUNTRY_ALIASES[name] ?? name;

// 글에 나온 도시·국가를 나온 횟수와 함께 센다. (긴 이름부터 찾아 "인도네시아" 안의 "인도"를 따로 세지 않는다)
function countNames(text: string, names: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  let rest = text;
  for (const name of names) {
    let count = 0;
    let pos = rest.indexOf(name);
    while (pos !== -1) {
      count++;
      rest = rest.slice(0, pos) + "\u0000".repeat(name.length) + rest.slice(pos + name.length);
      pos = rest.indexOf(name, pos + name.length);
    }
    if (count > 0) counts.set(name, (counts.get(name) ?? 0) + count);
  }
  return counts;
}

interface Places {
  city: string | null;
  country: string | null;
}

function bestOf(counts: Map<string, number>, skip: (name: string) => boolean): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (skip(name)) continue;
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

function findPlaces(text: string): Places {
  const cities = countNames(text, CITY_NAMES);
  const countries = countNames(text, COUNTRY_NAMES);
  const foreignCity = bestOf(cities, (c) => CITY_TO_COUNTRY[c] === HOME_COUNTRY);
  const homeCity = bestOf(cities, (c) => CITY_TO_COUNTRY[c] !== HOME_COUNTRY);
  const foreignCountryNames = new Map<string, number>();
  for (const [name, count] of countries) {
    const canon = canonCountry(name);
    if (canon !== HOME_COUNTRY) foreignCountryNames.set(canon, (foreignCountryNames.get(canon) ?? 0) + count);
  }
  const foreignCountry = bestOf(foreignCountryNames, () => false);

  if (foreignCity) return { city: foreignCity, country: CITY_TO_COUNTRY[foreignCity] };
  if (foreignCountry) return { city: null, country: foreignCountry };
  if (homeCity) return { city: homeCity, country: HOME_COUNTRY };
  return { city: null, country: null };
}

// 글에 나온 국내 도시 (가장 많이 나온 것)
function homeCityIn(text: string): string | null {
  return bestOf(countNames(text, CITY_NAMES), (c) => CITY_TO_COUNTRY[c] !== HOME_COUNTRY);
}

// ---- 문서 정보 ----
interface DocInfo {
  title: string;
  date: string;
  bodyLines: string[];
}

function readDocInfo(lines: string[], fileName: string, today: string): DocInfo {
  const infoIdx = lines.findIndex((l) => DOC_INFO_RE.test(l));
  let title: string;
  let bodyLines: string[];
  let date: string | null = null;
  if (infoIdx !== -1) {
    const m = DOC_INFO_RE.exec(lines[infoIdx])!;
    if (isValid(Number(m[1]), Number(m[2]), Number(m[3]))) date = toKey(Number(m[1]), Number(m[2]), Number(m[3]));
    title = lines.slice(0, infoIdx).join(" ");
    bodyLines = lines.slice(infoIdx + 1);
  } else {
    title = lines[0] ?? "";
    bodyLines = lines.slice(1);
  }
  if (!date) {
    // 파일 이름이 "260918 …"처럼 날짜(YYMMDD)로 시작하면 그 날짜를 쓴다.
    const f = /^(\d{2})(\d{2})(\d{2})/.exec(fileName.trim());
    if (f && isValid(2000 + Number(f[1]), Number(f[2]), Number(f[3]))) {
      date = toKey(2000 + Number(f[1]), Number(f[2]), Number(f[3]));
    }
  }
  return { title: title.trim(), date: date ?? today, bodyLines };
}

// ---- 업무성격 ----
const CATEGORY_RULES: { category: WorkCategory; re: RegExp }[] = [
  { category: "trip", re: /출장|파견|해외연수|국외/ },
  { category: "invite", re: /초청|초대|유치/ },
  { category: "visit", re: /내방|방한|예방|방문/ },
  { category: "report", re: /보고/ },
];

// 문서 제목(가중치 3)과 목적·배경·개요 항목(가중치 1)의 단어로 업무성격을 정한다.
function detectCategory(title: string, blocks: Block[]): WorkCategory {
  const scores = new Map<WorkCategory, number>();
  for (const { category, re } of CATEGORY_RULES) {
    let score = re.test(title) ? 3 : 0;
    for (const block of blocks) {
      if (/(목적|개요|배경|취지)/.test(block.sectionLabel) && block.top && re.test(block.text)) score += 1;
    }
    if (score > 0) scores.set(category, score);
  }
  let best: WorkCategory = "unclassified";
  let bestScore = 0;
  for (const { category } of CATEGORY_RULES) {
    const score = scores.get(category) ?? 0;
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  return best;
}

// 글에 나온 외국의 국가 (도시 이름으로 알아내는 것 포함, 가장 많이 나온 것)
function foreignCountryIn(text: string): string | null {
  const place = findPlaces(text);
  if (place.country && place.country !== HOME_COUNTRY) return place.country;
  // findPlaces는 외국 도시·국가를 먼저 찾으므로, 여기까지 오면 외국 정보가 없는 글이다.
  return null;
}

// 항목(라벨·문장)에 업무성격 단서가 있으면 그것을 돌려준다. (예: "출장 추진" → 출장, "워크숍" → 기타)
const BLOCK_ETC_RE = /워크숍|워크샵|교육|연수|세미나|간담회|회의|포럼/;
function categoryOfBlock(block: Block): WorkCategory | null {
  const text = `${block.label ?? ""} ${block.text}`;
  for (const { category, re } of CATEGORY_RULES) {
    if (category === "report") continue; // "보고"는 항목에 너무 흔히 나와서 판단에 쓰지 않는다
    if (re.test(text)) return category;
  }
  return BLOCK_ETC_RE.test(text) ? "etc" : null;
}

// ---- 제목 재료 ----
const TITLE_TAIL_RE = /\s*(?:을\s*|를\s*)?(?:위한|위해|관련|대한)?\s*(?:국외\s*|해외\s*|국내\s*)?(?:출장|방문|참석|파견)\s*(?:계획|결과|보고|건)?(?:\s*\(안\))?\s*$/;

// 문서 제목에서 "…출장 계획" 같은 꼬리와 맨 앞 국가명을 떼어 낸 행사 이름
const TITLE_TAIL2_RE = /\s*(?:개최|추진|운영|실시)?\s*(?:계획|결과|보고)(?:\s*\(안\))?\s*$/;

function coreOfTitle(title: string): string {
  let core = title.replace(TITLE_TAIL_RE, "").replace(TITLE_TAIL2_RE, "").trim();
  // 맨 앞의 국가명("태국 …", "한-베트남 …")은 제목의 국가명 자리에 따로 쓰므로 뗀다.
  const lead = COUNTRY_NAMES.find((c) => new RegExp(`^(?:한\\s*[-‐–]\\s*)?${c}\\s`).test(core));
  if (lead) core = core.replace(new RegExp(`^(?:한\\s*[-‐–]\\s*)?${lead}\\s+`), "").trim();
  return core || title;
}

const orgOfTitle = (title: string): string | null => /\(([A-Z][A-Za-z0-9&.\-]{1,12})\)/.exec(title)?.[1] ?? null;

function cap(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

export function extractByRules(rawText: string, fileName: string, today: string): RuleResult {
  const lines = normalize(rawText);
  const info = readDocInfo(lines, fileName, today);
  const blocks = splitBlocks(info.bodyLines);

  const category = detectCategory(info.title, blocks);
  const docPlaces = findPlaces(`${info.title} ${info.title} ${info.bodyLines.join(" ")}`);
  const core = coreOfTitle(info.title);
  const org = orgOfTitle(info.title);
  const docForeign = foreignCountryIn(`${info.title} ${info.title} ${info.bodyLines.join(" ")}`);

  // 일정이 적힌 큰 항목(출장계획, 일정 …)의 문장만 먼저 본다. 하나도 없으면 문서 전체에서 날짜를 찾는다.
  const inScheduleSection = (b: Block) =>
    SCHEDULE_LABEL_RE.test(b.sectionLabel) && !NOT_SCHEDULE_LABEL_RE.test(b.sectionLabel);
  const pick = (use: (b: Block) => boolean) => {
    const found: { block: Block; date: FoundDate }[] = [];
    for (const block of blocks.filter(use)) for (const date of scanDates(block.text, info.date)) found.push({ block, date });
    return found;
  };
  let found = pick(inScheduleSection);
  if (found.length === 0) found = pick((b) => !SKIP_FALLBACK_LABEL_RE.test(b.sectionLabel));

  const optionCount = new Set(found.map((f) => f.date.optionNo).filter((n): n is number => n !== null)).size;

  const byKey = new Map<string, RuleEvent>();
  for (const { block, date } of found) {
    const own = findPlaces(block.text);
    // 이 항목만의 업무성격 단서가 있으면 그것을, 없으면 문서 전체의 업무성격을 쓴다.
    const eventCategory = categoryOfBlock(block) ?? category;
    let city = own.city ?? docPlaces.city;
    let country = own.country ?? (city ? CITY_TO_COUNTRY[city] : null) ?? docPlaces.country;
    if (eventCategory === "invite" || eventCategory === "visit") {
      // 외국 인사가 우리를 찾아오거나 우리가 초청하는 일정은 국내에서 열린다.
      city = homeCityIn(`${block.text} ${info.title}`) ?? null;
      country = HOME_COUNTRY;
    }
    const isOverseas = country !== null && country !== HOME_COUNTRY;
    // 제목에 쓸 국가: 항목에 외국이 나오면 그 나라, 해외 일정이면 방문지, 외국 인사의 방문·초청이면 상대국. (국내 일반 행사는 국가 없음)
    const counterpart =
      foreignCountryIn(block.text) ??
      (isOverseas ? country : eventCategory === "invite" || eventCategory === "visit" ? docForeign : null);
    const label = block.label && !GENERIC_LABEL_RE.test(block.label) ? block.label : null;
    // 이름: 항목 이름(라벨)이 문서 제목과 겹치는 말이면 라벨만, 아니면 "기관(또는 문서 제목) + 라벨"
    const overlaps = label ? label.split(/\s+/).some((t) => t.length >= 2 && core.includes(t)) : false;
    const name = !label ? core : overlaps ? label : [org ?? core, label].join(" ");
    const isOption = optionCount >= 2 && date.optionNo !== null;

    const event: RuleEvent = {
      titleCountry: counterpart,
      title: cap(name, 100),
      startDate: date.startDate,
      endDate: date.endDate,
      city,
      country,
      isOverseas,
      workCategory: eventCategory,
      optionGroup: isOption ? cap(core, 80) : null,
      optionNo: isOption ? date.optionNo : null,
      context: cap(block.text, 400),
    };
    const key = [event.startDate, event.endDate, event.optionNo].join("|");
    const existing = byKey.get(key);
    // 같은 날짜가 큰 항목과 세부 항목에 모두 나오면 이름(라벨)이 있는 쪽을 쓴다.
    if (!existing || (label && existing.title === cap(core, 100))) byKey.set(key, event);
  }

  const events = [...byKey.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return { docTitle: info.title, events };
}
