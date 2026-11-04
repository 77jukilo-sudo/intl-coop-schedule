import { NextResponse } from "next/server";
import { createSessionSupabase } from "../../../../lib/server/supabase-session";
import { rowToEvent, type EventRow } from "../../../../features/events/eventRow";
import { WORK_CATEGORIES } from "../../../../types/schedule";

const QUERY_MAX = 100;
const RESULT_LIMIT = 100;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// 검색어에서 필터 문법을 깨뜨릴 수 있는 글자를 뺀다. (쉼표·괄호·따옴표·와일드카드 등)
function cleanTerm(raw: string): string {
  return raw.replace(/[,()*%_\\"'`:;]/g, " ").replace(/\s+/g, " ").trim();
}

// 일정 검색: GET /api/events/search?q=베트남&geo=overseas&work=trip
//  - q: 행사명·도시·국가·출처 문서명·담당자 이름에서 찾는다. (비워 두면 분류 조건만 적용)
//  - geo: domestic(국내) | overseas(국외)
//  - work: report | trip | invite | visit | etc | unclassified
// 날짜와 상관없이 전체 기간에서 찾고(달력에서 숨긴 안은 제외), 날짜가 늦은 일정이 먼저 나온다. 날짜 미정은 맨 뒤.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = cleanTerm((params.get("q") ?? "").slice(0, QUERY_MAX));
  const geo = params.get("geo") ?? "";
  const work = params.get("work") ?? "";

  if (geo && geo !== "domestic" && geo !== "overseas") {
    return errorResponse(400, "VALIDATION_ERROR", "국내/국외 구분을 확인해 주세요.");
  }
  if (work && !(WORK_CATEGORIES as readonly string[]).includes(work)) {
    return errorResponse(400, "VALIDATION_ERROR", "업무성격 구분을 확인해 주세요.");
  }

  const supabase = await createSessionSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  // 검색어도 분류 조건도 없으면 찾을 것이 없다.
  if (!q && !geo && !work) return NextResponse.json({ data: [] });

  let query = supabase.from("events").select("*").is("hidden_at", null);
  if (geo) query = query.eq("geo_category", geo);
  if (work) query = query.eq("work_category", work);

  if (q) {
    // 담당자 이름에 검색어가 들어 있는 부원의 일정도 찾는다.
    const { data: members } = await supabase
      .from("members")
      .select("id")
      .ilike("name", `%${q}%`)
      .limit(50);
    const assigneeIds = (members ?? []).map((m) => m.id as string);

    const pattern = `*${q}*`;
    const conditions = [
      `title.ilike.${pattern}`,
      `city.ilike.${pattern}`,
      `country.ilike.${pattern}`,
      `source_name.ilike.${pattern}`,
    ];
    if (assigneeIds.length > 0) conditions.push(`assignee_id.in.(${assigneeIds.join(",")})`);
    query = query.or(conditions.join(","));
  }

  const { data, error } = await query
    .order("start_date", { ascending: false, nullsFirst: false })
    .limit(RESULT_LIMIT);
  if (error) {
    return errorResponse(500, "INTERNAL_ERROR", "검색하지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  }

  return NextResponse.json({ data: (data as EventRow[]).map(rowToEvent) });
}
