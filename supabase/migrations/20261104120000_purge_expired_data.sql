-- 1년 보관 처리(작업 18, PRD 8번): 지난 일정과 수정 이력은 1년 보관한 뒤 자동으로 완전히 지운다.
--  - 일정: 종료일(종료일이 없으면 시작일)이 1년보다 더 지난 일정. 날짜 미정 일정은 만든 지 1년이 지난 것.
--    일정을 지우면 그 일정의 수정 이력도 함께 지워진다. (event_history가 일정과 연결되어 있음)
--  - 수정 이력: 일정이 남아 있어도 1년이 지난 이력은 지운다.
--  - 기준 날짜는 한국 날짜다. 지운 뒤에는 되돌릴 수 없다.

create function public.purge_expired_data(
  p_today date default (now() at time zone 'Asia/Seoul')::date
)
returns table (deleted_events integer, deleted_history integer)
language plpgsql
security definer -- 일정 삭제 권한이 부원에게 없으므로(접근 규칙), 이 정리 작업만 따로 권한을 갖는다
set search_path = ''
as $$
declare
  cutoff date := p_today - interval '1 year';
  removed_events integer;
  removed_history integer;
begin
  delete from public.events
   where coalesce(end_date, start_date, (created_at at time zone 'Asia/Seoul')::date) < cutoff;
  get diagnostics removed_events = row_count;

  delete from public.event_history
   where (changed_at at time zone 'Asia/Seoul')::date < cutoff;
  get diagnostics removed_history = row_count;

  return query select removed_events, removed_history;
end;
$$;

-- 앱 화면(부원 계정)에서는 부를 수 없고, 자동 실행과 관리용 열쇠(서버 전용)만 부를 수 있다.
revoke all on function public.purge_expired_data(date) from public, anon, authenticated;

-- 매일 한국 시각 새벽 3시(= UTC 18시)에 자동 실행한다. (Supabase pg_cron)
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'purge-expired-data',
  '0 18 * * *',
  $cron$select public.purge_expired_data();$cron$
);
