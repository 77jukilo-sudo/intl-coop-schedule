-- 변경 알림(작업 22): 푸시 알림을 받겠다고 한 기기 목록.
-- 기기마다 브라우저가 만들어 주는 알림 주소(endpoint)와 암호 키(p256dh, auth)를 저장한다.
-- 이 값으로는 이름·연락처·이메일을 알 수 없다. 부원이 알림을 끄거나 부원 계정이 지워지면 함께 지워진다.
-- 접근: 부원 계정은 이 표를 직접 읽거나 쓸 수 없다. 서버(관리자 열쇠)만 저장·조회·삭제한다.
--  (다른 부원의 알림 주소를 몰라야 하고, 같은 기기를 다른 부원이 이어서 쓸 때 주인을 바꿔야 하기 때문)
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  endpoint text not null unique check (length(endpoint) between 10 and 2000),
  p256dh text not null check (length(p256dh) between 10 and 300),
  auth text not null check (length(auth) between 10 and 100),
  created_at timestamptz not null default now()
);

create index push_subscriptions_member_id_idx on public.push_subscriptions (member_id);

-- 접근 규칙을 켜고 부원용 규칙은 만들지 않는다. (= 부원 계정과 로그인 안 한 사람은 접근 불가)
alter table public.push_subscriptions enable row level security;
