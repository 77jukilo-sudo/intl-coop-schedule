-- AI가 문서에서 일정을 뽑을 때, 정확한 날짜를 알 수 없으면(예: "11월 중순", "추후 통보")
-- 날짜 칸은 비워 두고(날짜 미정 목록으로 간다) 문서에 적힌 원래 표현을 여기에 남긴다.
alter table public.events add column date_note text;
