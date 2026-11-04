-- 장소 위치 보관함(작업 17): 도시 이름 → 지도 위치(위도·경도).
-- OpenStreetMap 검색(Nominatim)은 이용 규칙(초당 1회 이하) 때문에 같은 도시를 되풀이해 찾지 않도록 결과를 보관한다.
-- 일정 표(events)에 저장하지 않는 이유: 일정을 고치면 버전이 올라가 다른 부원의 편집과 충돌하기 때문이다.
-- 개인정보 규칙: 도시·국가 이름과 위치만 담는다. 문서 내용은 담지 않는다.
create table public.place_cache (
  place_key text primary key check (length(place_key) between 1 and 250), -- "도시|국가"를 소문자로 정리한 값
  city text not null,
  country text,
  found boolean not null, -- false면 검색했지만 찾지 못한 도시 (일정 기간 다시 찾지 않는다)
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  fetched_at timestamptz not null default now(),
  check (not found or (lat is not null and lng is not null))
);

alter table public.place_cache enable row level security;

create policy "부원은 장소 위치를 본다"
  on public.place_cache for select to authenticated
  using (true);

create policy "부원은 장소 위치를 남긴다"
  on public.place_cache for insert to authenticated
  with check (true);

create policy "부원은 장소 위치를 갱신한다"
  on public.place_cache for update to authenticated
  using (true)
  with check (true);
