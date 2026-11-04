import { NextResponse } from "next/server";
import { createSessionSupabase } from "../../../lib/server/supabase-session";
import { GeocodeError, geocodeCity } from "../../../lib/server/geocode";

const PLACE_MAX = 100;
const NOT_FOUND_RETRY_DAYS = 7; // 못 찾은 도시는 이 기간이 지나야 다시 찾아본다

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// 도시의 지도 위치: GET /api/places?city=자카르타&country=인도네시아
// 응답: { data: { lat, lng } } 또는 위치를 못 찾으면 { data: null }
// 한 번 찾은 위치는 보관함(place_cache)에 저장해 두고 다시 검색하지 않는다.
export async function GET(request: Request) {
  const supabase = await createSessionSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  const params = new URL(request.url).searchParams;
  const city = (params.get("city") ?? "").trim();
  const country = (params.get("country") ?? "").trim() || null;
  if (!city || city.length > PLACE_MAX || (country && country.length > PLACE_MAX)) {
    return errorResponse(400, "VALIDATION_ERROR", "도시 이름을 확인해 주세요.");
  }

  const placeKey = `${city}|${country ?? ""}`.toLowerCase();

  const { data: cached } = await supabase
    .from("place_cache")
    .select("found, lat, lng, fetched_at")
    .eq("place_key", placeKey)
    .maybeSingle();
  if (cached?.found && cached.lat !== null && cached.lng !== null) {
    return NextResponse.json({ data: { lat: cached.lat, lng: cached.lng } });
  }
  if (cached && !cached.found) {
    const ageDays = (Date.now() - new Date(cached.fetched_at).getTime()) / 86_400_000;
    if (ageDays < NOT_FOUND_RETRY_DAYS) return NextResponse.json({ data: null });
  }

  let hit;
  try {
    hit = await geocodeCity(city, country);
  } catch (error) {
    if (error instanceof GeocodeError) {
      return errorResponse(502, "GEOCODE_FAILED", error.message);
    }
    throw error;
  }

  // 결과(찾은 것과 못 찾은 것 모두)를 보관한다. 보관에 실패해도 지도는 보여 준다.
  const { error: saveError } = await supabase.from("place_cache").upsert(
    {
      place_key: placeKey,
      city,
      country,
      found: hit !== null,
      lat: hit?.lat ?? null,
      lng: hit?.lng ?? null,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "place_key" },
  );
  if (saveError) console.error(`[places] 위치 보관 오류: ${saveError.code ?? "unknown"}`);

  return NextResponse.json({ data: hit });
}
