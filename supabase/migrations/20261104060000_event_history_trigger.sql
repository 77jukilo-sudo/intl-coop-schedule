-- 일정이 만들어지거나 바뀔 때마다 수정 이력(누가, 언제, 무엇을)을 자동으로 남긴다.
-- 앱 코드가 아니라 저장소 안에서 처리하므로, 화면·API·관리자 도구 등 어느 경로로 고쳐도 빠지지 않고
-- 일정 저장과 같은 순간(같은 거래)에 함께 기록된다.

-- 상태 이름(저장값 → 한국어)
create function public.event_status_label(status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case status
    when 'pending_review' then '확인 전'
    when 'tentative' then '미확정'
    when 'confirmed' then '확정'
    when 'cancelled' then '취소'
    else status
  end
$$;

create function public.log_event_change()
returns trigger
language plpgsql
security definer -- 이력 표의 접근 규칙(RLS)과 상관없이 기록한다
set search_path = ''
as $$
declare
  -- 고친 사람: 로그인한 부원. 관리자 도구처럼 로그인 없이 고치면 일정을 만든 사람으로 기록한다.
  actor uuid := coalesce(auth.uid(), new.created_by);
  parts text[] := '{}';
  old_text text;
  new_text text;
begin
  if tg_op = 'INSERT' then
    insert into public.event_history (event_id, changed_by, summary)
    values (new.id, actor, '일정을 만들었습니다: ' || new.title);
    return new;
  end if;

  if new.title is distinct from old.title then
    parts := parts || ('행사명 "' || old.title || '" → "' || new.title || '"');
  end if;

  if new.start_date is distinct from old.start_date
     or new.end_date is distinct from old.end_date then
    old_text := coalesce(to_char(old.start_date, 'YYYY-MM-DD'), '미정')
      || coalesce(' ~ ' || to_char(old.end_date, 'YYYY-MM-DD'), '');
    new_text := coalesce(to_char(new.start_date, 'YYYY-MM-DD'), '미정')
      || coalesce(' ~ ' || to_char(new.end_date, 'YYYY-MM-DD'), '');
    parts := parts || ('날짜 ' || old_text || ' → ' || new_text);
  end if;

  if new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time then
    old_text := coalesce(left(old.start_time::text, 5), '미정')
      || coalesce(' ~ ' || left(old.end_time::text, 5), '');
    new_text := coalesce(left(new.start_time::text, 5), '미정')
      || coalesce(' ~ ' || left(new.end_time::text, 5), '');
    parts := parts || ('시간 ' || old_text || ' → ' || new_text);
  end if;

  if new.is_overseas is distinct from old.is_overseas then
    parts := parts || ('외국 일정(현지 시각) '
      || case when old.is_overseas then '예' else '아니오' end
      || ' → ' || case when new.is_overseas then '예' else '아니오' end);
  end if;

  if new.city is distinct from old.city or new.country is distinct from old.country then
    old_text := coalesce(nullif(concat_ws(', ', old.city, old.country), ''), '미정');
    new_text := coalesce(nullif(concat_ws(', ', new.city, new.country), ''), '미정');
    parts := parts || ('장소 ' || old_text || ' → ' || new_text);
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    select name into old_text from public.members where id = old.assignee_id;
    select name into new_text from public.members where id = new.assignee_id;
    parts := parts || ('담당자 ' || coalesce(old_text, '미정') || ' → ' || coalesce(new_text, '미정'));
  end if;

  if new.status is distinct from old.status then
    parts := parts || ('상태 ' || public.event_status_label(old.status)
      || ' → ' || public.event_status_label(new.status));
  end if;

  if new.option_no is distinct from old.option_no then
    parts := parts || ('안 번호 ' || coalesce(old.option_no::text, '없음')
      || ' → ' || coalesce(new.option_no::text, '없음'));
  end if;

  if (new.hidden_at is null) is distinct from (old.hidden_at is null) then
    parts := parts || case when new.hidden_at is null then '달력에 다시 표시' else '달력에서 숨김' end;
  end if;

  -- 바뀐 내용이 있을 때만 기록한다. (버전·수정 시각만 바뀐 경우는 제외)
  if array_length(parts, 1) > 0 then
    insert into public.event_history (event_id, changed_by, summary)
    values (new.id, actor, array_to_string(parts, ' / '));
  end if;

  return new;
end;
$$;

-- 트리거 전용 함수라서 외부(API)에서 직접 부를 수 없게 막는다.
revoke all on function public.log_event_change() from public, anon, authenticated;

create trigger events_log_change
after insert or update on public.events
for each row execute function public.log_event_change();
