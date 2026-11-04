"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { signOut } from "../../app/login/actions";

type MapState =
  | { kind: "loading" }
  | { kind: "ready"; lat: number; lng: number }
  | { kind: "unknown" } // 도시는 있지만 위치를 찾지 못함
  | { kind: "error" }; // 위치 검색 서비스 문제

const CITY_ZOOM = 10; // 도시 한 곳이 보이는 정도

// 상세 팝업의 도시 지도. 도시 단위로만 보여 준다. (정확한 주소는 표시하지 않는다)
// 위치를 아직 모르면 서버에서 찾아 오고(한 번 찾으면 보관), 못 찾으면 "장소 미정"으로 보여 준다.
export default function CityMap({
  city,
  country,
  lat,
  lng,
}: {
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
}) {
  const hasPosition = lat !== null && lng !== null;
  // 위치를 찾은 결과는 어느 도시의 것인지 함께 기억한다. (도시가 바뀌면 다시 찾는다)
  const cityKey = `${city ?? ""}|${country ?? ""}`;
  const [found, setFound] = useState<{ key: string; state: MapState } | null>(null);

  useEffect(() => {
    if (hasPosition || !city) return;
    let cancelled = false;
    const query = new URLSearchParams({ city, ...(country ? { country } : {}) });
    fetch(`/api/places?${query}`, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          await signOut();
          return null;
        }
        if (!response.ok) return { kind: "error" } as MapState;
        const body = (await response.json()) as { data: { lat: number; lng: number } | null };
        return (body.data ? { kind: "ready", ...body.data } : { kind: "unknown" }) as MapState;
      })
      .catch(() => ({ kind: "error" }) as MapState)
      .then((state) => {
        if (!cancelled && state) setFound({ key: cityKey, state });
      });
    return () => {
      cancelled = true;
    };
  }, [city, country, hasPosition, cityKey]);

  const state: MapState = hasPosition
    ? { kind: "ready", lat, lng }
    : !city
      ? { kind: "unknown" }
      : found?.key === cityKey
        ? found.state
        : { kind: "loading" };

  if (state.kind === "ready") {
    return <LeafletMap lat={state.lat} lng={state.lng} label={city ?? ""} />;
  }

  const message =
    state.kind === "loading"
      ? "지도를 불러오는 중..."
      : state.kind === "error"
        ? "지도를 불러오지 못했습니다. 잠시 뒤 팝업을 다시 열어 주세요."
        : "장소 미정";
  return (
    <div
      role={state.kind === "error" ? "alert" : "status"}
      className="flex h-20 items-center justify-center rounded-lg border border-dashed border-foreground/20 text-sm text-foreground/60"
    >
      {message}
    </div>
  );
}

// 실제 지도 그림 (Leaflet + OpenStreetMap). 브라우저에서만 불러온다.
function LeafletMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let disposed = false;
    let removeMap: (() => void) | null = null;

    void import("leaflet").then((L) => {
      if (disposed) return;
      const map = L.map(box, {
        center: [lat, lng],
        zoom: CITY_ZOOM,
        scrollWheelZoom: false, // 팝업을 스크롤할 때 지도가 확대되지 않도록
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap",
      }).addTo(map);
      // 기본 핀 이미지는 번들러에서 경로가 깨지기 쉬워 원형 표시를 쓴다.
      L.circleMarker([lat, lng], {
        radius: 9,
        color: "#1d4ed8",
        fillColor: "#3b82f6",
        fillOpacity: 0.9,
        weight: 3,
      }).addTo(map);
      // 팝업이 열리는 중에 만들어지면 크기를 0으로 잘못 읽을 수 있어 한 번 다시 맞춘다.
      const timer = setTimeout(() => map.invalidateSize(), 150);
      removeMap = () => {
        clearTimeout(timer);
        map.remove();
      };
    });

    return () => {
      disposed = true;
      removeMap?.();
    };
  }, [lat, lng]);

  return (
    <div
      ref={boxRef}
      role="img"
      aria-label={`${label} 지도`}
      className="h-48 w-full overflow-hidden rounded-lg border border-foreground/15"
    />
  );
}
