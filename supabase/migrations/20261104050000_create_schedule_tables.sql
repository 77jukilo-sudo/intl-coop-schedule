-- 일정관리 앱의 표(테이블) 만들기 (DESIGN.md 3번, types/schedule.ts 기준)
-- 열 이름은 snake_case로 적고, 앱 코드에서는 camelCase로 바꿔 쓴다.
-- 개인정보 규칙: 여권번호·주민번호·연락처·예약번호 칸은 만들지 않는다.

-- ============================================================
-- 부원: 로그인 계정(auth.users)과 1:1로 연결, 담당자 선택 목록에 쓴다.
-- ============================================================
create table public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 일정
-- ============================================================
create table public.events (
  id uuid primary key default gen_random_uuid(),

  -- 1안·2안을 묶는 번호 (안이 없으면 null)
  group_id uuid,
  option_no integer check (option_no is null or option_no >= 1),

  title text not null check (length(trim(title)) > 0), -- 행사명

  -- 날짜가 null이면 "날짜 미정" 목록
  start_date date,
  end_date date,
  -- 시간: 국내=한국 시각, 외국=현지 시각
  start_time time,
  end_time time,
  is_overseas boolean not null default false,

  -- 장소 (도시 단위). 문서에 없으면 null → 화면에는 "장소 미정"
  city text,
  country text,
  location_note text,
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),

  -- 담당자 (빈칸 가능). 부원이 사라져도 일정은 남긴다.
  assignee_id uuid references public.members (id) on delete set null,

  status text not null default 'pending_review'
    check (status in ('pending_review', 'tentative', 'confirmed', 'cancelled')),
  geo_category text not null default 'unclassified'
    check (geo_category in ('domestic', 'overseas', 'unclassified')),
  work_category text not null default 'unclassified'
    check (work_category in ('report', 'trip', 'invite', 'visit', 'etc', 'unclassified')),

  source_name text not null, -- 출처 문서명, 직접 입력이면 '직접 입력'

  -- 선택되지 않은 안을 달력에서 숨긴 시각 (지우지 않고 기록으로 남김)
  hidden_at timestamptz,

  version integer not null default 1, -- 동시 수정 감지용

  created_by uuid not null default auth.uid() references public.members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (end_date is null or start_date is null or end_date >= start_date)
);

create index events_start_date_idx on public.events (start_date);
create index events_group_id_idx on public.events (group_id);
create index events_status_idx on public.events (status);

-- ============================================================
-- 수정 이력: 누가, 언제, 무엇을 고쳤는지
-- ============================================================
create table public.event_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  changed_by uuid not null default auth.uid() references public.members (id),
  changed_at timestamptz not null default now(),
  summary text not null
);

create index event_history_event_id_idx on public.event_history (event_id, changed_at desc);

-- ============================================================
-- 저장할 때마다 버전을 1 올리고 수정 시각을 갱신한다.
-- (앱은 "읽었던 버전과 같을 때만 저장"하는 방식으로 동시 수정을 감지한다.)
-- ============================================================
create function public.bump_event_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger events_bump_version
before update on public.events
for each row execute function public.bump_event_version();

-- ============================================================
-- 접근 규칙(RLS): 로그인한 부원만, 전원 같은 권한.
-- 일정 삭제는 허용하지 않는다. (취소는 상태로, 정리는 1년 보관 작업에서 따로 처리)
-- ============================================================
alter table public.members enable row level security;
alter table public.events enable row level security;
alter table public.event_history enable row level security;

create policy "부원은 부원 목록을 본다"
  on public.members for select to authenticated
  using (true);

create policy "부원은 일정을 본다"
  on public.events for select to authenticated
  using (true);

create policy "부원은 일정을 추가한다"
  on public.events for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "부원은 일정을 수정한다"
  on public.events for update to authenticated
  using (true)
  with check (true);

create policy "부원은 수정 이력을 본다"
  on public.event_history for select to authenticated
  using (true);

create policy "부원은 수정 이력을 남긴다"
  on public.event_history for insert to authenticated
  with check (changed_by = (select auth.uid()));
