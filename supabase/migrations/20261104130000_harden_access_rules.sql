-- 배포 전 보안 점검(작업 20)에서 나온 데이터 접근 규칙 보강.
-- 1) "로그인한 사람"이 아니라 "부원 목록(members)에 있는 사람"만 일정·이력을 보고 고칠 수 있게 한다. (이중 방어)
-- 2) 일정 수정은 앱이 쓰는 칸만 허용한다. 만든 시각·만든 사람 같은 칸을 직접 바꿔
--    수정 이력을 피하거나 1년 정리 작업으로 일정을 지우게 만드는 일을 막는다.
-- 3) 수정 이력은 저장소의 자동 기록(트리거)만 남길 수 있다. 부원이 거짓 이력을 넣지 못하게 한다.
-- 4) 장소 위치 보관함은 서버(관리자 열쇠)만 쓸 수 있다. 부원이 좌표를 바꿔 지도를 오염시키지 못하게 한다.

-- 현재 로그인한 사람이 부원인지. 접근 규칙 안에서 쓴다.
create function public.is_member()
returns boolean
language sql
stable
security definer -- members 표의 접근 규칙과 상관없이 확인한다
set search_path = ''
as $$
  select exists (select 1 from public.members where id = auth.uid())
$$;

revoke all on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

-- ============================================================
-- 부원 목록·일정·수정 이력: 부원만
-- ============================================================
drop policy "부원은 부원 목록을 본다" on public.members;
create policy "부원은 부원 목록을 본다"
  on public.members for select to authenticated
  using ((select public.is_member()));

drop policy "부원은 일정을 본다" on public.events;
create policy "부원은 일정을 본다"
  on public.events for select to authenticated
  using ((select public.is_member()));

drop policy "부원은 일정을 추가한다" on public.events;
create policy "부원은 일정을 추가한다"
  on public.events for insert to authenticated
  with check (created_by = (select auth.uid()) and (select public.is_member()));

drop policy "부원은 일정을 수정한다" on public.events;
create policy "부원은 일정을 수정한다"
  on public.events for update to authenticated
  using ((select public.is_member()))
  with check ((select public.is_member()));

drop policy "부원은 수정 이력을 본다" on public.event_history;
create policy "부원은 수정 이력을 본다"
  on public.event_history for select to authenticated
  using ((select public.is_member()));

-- ============================================================
-- 수정 이력: 부원이 직접 넣는 길을 닫는다. (트리거가 대신 기록한다)
-- ============================================================
drop policy "부원은 수정 이력을 남긴다" on public.event_history;

-- ============================================================
-- 일정 수정: 앱이 실제로 고치는 칸만 허용한다.
-- (만든 시각·만든 사람·안 묶음 번호·위치·버전 등은 직접 바꿀 수 없다. 버전·수정 시각은 트리거가 올린다.)
-- ============================================================
revoke update on public.events from authenticated;
grant update (
  title, start_date, end_date, date_note, start_time, end_time,
  is_overseas, city, country, assignee_id, status, source_name, hidden_at
) on public.events to authenticated;

-- ============================================================
-- 장소 위치 보관함: 읽기만 부원, 쓰기는 서버 전용 열쇠로만
-- ============================================================
drop policy "부원은 장소 위치를 본다" on public.place_cache;
create policy "부원은 장소 위치를 본다"
  on public.place_cache for select to authenticated
  using ((select public.is_member()));

drop policy "부원은 장소 위치를 남긴다" on public.place_cache;
drop policy "부원은 장소 위치를 갱신한다" on public.place_cache;
