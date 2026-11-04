-- 변경 자료 반영(작업 16): 다시 올린 문서의 새 일정(p_new_id)을 기존 일정(p_existing_id)의 "변경"으로 반영한다.
--  - 기존 일정에 새 내용(행사명·날짜·시간·장소·출처 문서명)을 덮어쓴다. 새 문서에 없는 시간·장소는 기존 값을 남긴다.
--  - 담당자·상태·분류는 그대로 둔다. (무엇이 바뀌었는지는 수정 이력에 자동으로 남는다)
--  - 새 일정은 지우지 않고 달력에서 숨긴다. (기록으로 남김)
-- 두 단계가 한 번에 이루어져야 하므로 함수 하나로 처리한다. 호출한 부원의 권한(RLS)으로 실행된다.
-- 내가 본 버전(p_expected_version)과 지금 버전이 다르면 아무것도 하지 않고 빈 결과를 돌려준다.
create function public.apply_event_change(
  p_existing_id uuid,
  p_expected_version integer,
  p_new_id uuid
)
returns setof public.events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  incoming public.events;
  merged public.events;
begin
  if p_existing_id = p_new_id then
    return;
  end if;

  select * into incoming
    from public.events
   where id = p_new_id and hidden_at is null and group_id is null;
  if not found then
    return;
  end if;

  update public.events e
     set title = incoming.title,
         start_date = coalesce(incoming.start_date, e.start_date),
         end_date = case when incoming.start_date is not null then incoming.end_date else e.end_date end,
         start_time = coalesce(incoming.start_time, e.start_time),
         end_time = coalesce(incoming.end_time, e.end_time),
         is_overseas = incoming.is_overseas,
         city = coalesce(incoming.city, e.city),
         country = coalesce(incoming.country, e.country),
         date_note = case
           when coalesce(incoming.start_date, e.start_date) is null then incoming.date_note
           else null
         end,
         source_name = incoming.source_name
   where e.id = p_existing_id
     and e.version = p_expected_version
     and e.hidden_at is null
  returning e.* into merged;

  if not found then
    return;
  end if;

  update public.events set hidden_at = now() where id = p_new_id;

  return next merged;
end;
$$;

revoke all on function public.apply_event_change(uuid, integer, uuid) from public, anon;
grant execute on function public.apply_event_change(uuid, integer, uuid) to authenticated;
