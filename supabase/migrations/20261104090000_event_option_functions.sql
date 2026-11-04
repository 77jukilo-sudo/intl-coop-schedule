-- 1안·2안 처리: 한 안을 확정하면 같은 묶음의 나머지 안을 달력에서 숨긴다. (지우지 않고 hidden_at만 기록)
-- 확정과 숨김이 "한 번에" 이루어져야 중간에 멈춰도 어정쩡한 상태가 남지 않으므로 함수 하나로 처리한다.
-- 함수는 호출한 부원의 권한(RLS)으로 실행되고(security invoker), 수정 이력도 그 부원 이름으로 남는다.

-- 안 확정: 이 안을 확정하고, 같은 묶음의 다른 안을 숨긴다.
-- 내가 본 버전(p_expected_version)과 지금 버전이 다르면 아무것도 하지 않고 빈 결과를 돌려준다.
create function public.choose_event_option(p_event_id uuid, p_expected_version integer)
returns setof public.events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  chosen public.events;
begin
  update public.events
     set status = 'confirmed'
   where id = p_event_id
     and version = p_expected_version
  returning * into chosen;

  if not found then
    return;
  end if;

  if chosen.group_id is not null then
    update public.events
       set hidden_at = now()
     where group_id = chosen.group_id
       and id <> chosen.id
       and hidden_at is null;
  end if;

  return next chosen;
end;
$$;

-- 안 확정 되돌리기: 이 안을 "미확정"으로 되돌리고, 숨겼던 다른 안을 다시 달력에 보이게 한다.
create function public.reopen_event_options(p_event_id uuid, p_expected_version integer)
returns setof public.events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reopened public.events;
begin
  update public.events
     set status = 'tentative'
   where id = p_event_id
     and version = p_expected_version
  returning * into reopened;

  if not found then
    return;
  end if;

  if reopened.group_id is not null then
    update public.events
       set hidden_at = null
     where group_id = reopened.group_id
       and id <> reopened.id
       and hidden_at is not null;
  end if;

  return next reopened;
end;
$$;

-- 로그인한 부원만 쓸 수 있다.
revoke all on function public.choose_event_option(uuid, integer) from public, anon;
revoke all on function public.reopen_event_options(uuid, integer) from public, anon;
grant execute on function public.choose_event_option(uuid, integer) to authenticated;
grant execute on function public.reopen_event_options(uuid, integer) to authenticated;
