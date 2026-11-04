-- 검색·분류(작업 21): 국내/국외와 업무성격(보고·출장·초청·방문·기타) 분류를 쓸 수 있게 한다.
-- 1) 국내/국외(geo_category)는 "외국에서 진행(is_overseas)" 값에서 저장소가 자동으로 정한다. 사람이 따로 고르지 않는다.
-- 2) 업무성격(work_category)은 부원이 직접 고칠 수 있게 수정 권한을 연다. (AI가 추천해서 넣기도 한다)
-- 3) 업무성격이 바뀌면 수정 이력에 남긴다.

-- 국내/국외 자동 지정
create function public.set_event_geo_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.geo_category := case when new.is_overseas then 'overseas' else 'domestic' end;
  return new;
end;
$$;

create trigger events_set_geo_category
before insert or update on public.events
for each row execute function public.set_event_geo_category();

-- 이미 들어 있는 일정에도 적용한다. (트리거가 값을 채운다)
update public.events set is_overseas = is_overseas;

-- 업무성격 수정 허용 (그 밖의 칸은 앞서 정한 목록 그대로)
grant update (work_category) on public.events to authenticated;

-- 업무성격 변경 이력
create function public.log_event_category_change()
returns trigger
language plpgsql
security definer -- 이력 표의 접근 규칙과 상관없이 기록한다
set search_path = ''
as $$
declare
  actor uuid := coalesce(auth.uid(), new.created_by);
  names jsonb := '{"report":"보고","trip":"출장","invite":"초청","visit":"방문","etc":"기타","unclassified":"미분류"}';
begin
  if new.work_category is distinct from old.work_category then
    insert into public.event_history (event_id, changed_by, summary)
    values (
      new.id,
      actor,
      '업무성격 ' || coalesce(names ->> old.work_category, old.work_category)
        || ' → ' || coalesce(names ->> new.work_category, new.work_category)
    );
  end if;
  return new;
end;
$$;

revoke all on function public.log_event_category_change() from public, anon, authenticated;

create trigger events_log_category_change
after update on public.events
for each row execute function public.log_event_category_change();
