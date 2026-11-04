-- 일정 표(events)가 바뀌면 접속 중인 부원 화면에 실시간으로 알려 주도록 켠다.
-- 알림은 저장소의 접근 규칙(RLS)을 그대로 따른다: 로그인한 부원에게만 전달된다.
alter publication supabase_realtime add table public.events;
