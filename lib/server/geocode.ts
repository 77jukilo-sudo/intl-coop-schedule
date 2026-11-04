// 도시 이름 → 지도 위치(위도·경도). OpenStreetMap 검색(Nominatim)을 서버에서만 쓴다.
// 보내는 것은 도시·국가 이름뿐이다. (문서 내용이나 개인 정보는 보내지 않는다)
// 이용 규칙: 초당 1회 이하로 요청하고, 앱을 알아볼 수 있는 User-Agent를 보낸다.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "intl-coop-schedule/1.0 (internal team calendar)";
const MIN_GAP_MS = 1100; // 요청 사이 최소 간격
const TIMEOUT_MS = 8000;

export interface GeocodeHit {
  lat: number;
  lng: number;
}

export class GeocodeError extends Error {}

// 요청이 몰려도 간격을 지키도록 한 줄로 세운다. (같은 서버 안에서의 간격)
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function inLine<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

// 찾으면 위치, 검색은 됐지만 없으면 null. 서비스에 연결하지 못하면 GeocodeError를 던진다.
export async function geocodeCity(city: string, country: string | null): Promise<GeocodeHit | null> {
  const query = country ? `${city}, ${country}` : city;
  const url = `${NOMINATIM_URL}?${new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
    "accept-language": "ko",
  })}`;

  return inLine(async () => {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      throw new GeocodeError("위치 검색 서비스에 연결하지 못했습니다.");
    }
    if (!response.ok) {
      console.error(`[geocode] 위치 검색 응답 오류: HTTP ${response.status}`);
      throw new GeocodeError("위치 검색 서비스가 응답하지 않습니다.");
    }
    const list = (await response.json().catch(() => null)) as { lat?: string; lon?: string }[] | null;
    const first = Array.isArray(list) ? list[0] : undefined;
    const lat = Number(first?.lat);
    const lng = Number(first?.lon);
    if (!first || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  });
}
