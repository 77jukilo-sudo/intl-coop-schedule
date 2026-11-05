# 국제협력부 일정관리 앱

국제협력부 부원들이 함께 쓰는 **공용 일정 달력** 웹앱입니다.
보고자료(PDF·Word)를 올리면 앱이 일정을 찾아 달력에 올려 주고, 일정이 바뀌면 모든 부원 화면에 바로 반영됩니다. 휴대폰(약 360px 폭)에서도 쓸 수 있습니다.

- 배포 주소: https://intl-coop-schedule.vercel.app (국제협력부원 전용 — 로그인 필요)
- 기획 문서: [PRD.md](PRD.md) (기능·규칙의 기준), [PLAN.md](PLAN.md) (개발 계획·작업 순서), [DESIGN.md](DESIGN.md) (설계)

## 왜 만들었나

행사·보고·국외출장이 많고 일정이 자주 바뀌는데, 일정이 문서 속에 흩어져 있어 부원마다 각자 달력에 옮겨 적다 보니 누락과 혼선이 생깁니다. 문서에서 일정을 자동으로 뽑아 하나의 공용 달력으로 보여 주고, 변경을 실시간으로 공유하기 위해 만들었습니다.

## 주요 기능

| 기능 | 설명 |
|---|---|
| 문서 → 일정 자동 추출 | PDF·Word(.docx)를 올리면 앱이 서버 안에서 글자를 읽고 **규칙으로** 날짜·장소·행사명·1안/2안·업무성격을 찾아 달력에 올립니다. 올린 원본은 저장하지 않습니다. |
| 일정 상태와 색 | 확인 전(회색) → 미확정(파란색, 1안·2안 포함) → 확정(흰색 막대), 취소는 취소선 |
| 제목 규칙 | `국가명 · 주최자/행사명` 형식 (예: 태국 · BAM 1차 포럼) |
| 공용 달력 | 월·주·오늘 보기, 클릭하면 담당자·장소·출처 문서·도시 지도가 팝업으로 표시 |
| 직접 추가·수정 | 문서 없이도 일정을 추가하고 고칠 수 있음. 수정 이력(누가·언제)을 남기고 동시 수정 시 경고 |
| 실시간 반영 | 한 부원이 고치면 다른 부원 화면에 수 초 안에 반영 |
| 변경 자료 다시 올리기 | 비슷한 기존 일정(이름이 달라도 같은 장소·날짜)을 찾아 "변경으로 반영할까요?"라고 **묻고**, 답 없이는 합치거나 지우지 않음 |
| 날짜 미정 목록 | "11월 중순", "추후 통보"처럼 모호한 날짜는 따로 모음 |
| 검색과 분류 | 키워드 검색, 국내/국외, 보고·출장·초청·방문·기타 필터 |
| 변경 알림 | 웹 푸시 알림 (iPhone은 홈 화면에 추가해야 받을 수 있음) |
| 보관 | 지난 일정과 수정 이력은 1년 보관 후 자동 정리 |

## 개인정보·보안 원칙

- **로그인한 국제협력부원만** 접속합니다. 계정은 담당자가 만들어 주며 가입 화면은 없습니다.
- 문서 전체를 외부 AI에 **보내지 않습니다.** AI 정리 단계는 선택 사항이며 기본은 꺼져 있습니다. (켜더라도 개인정보를 가린 짧은 문장만 전송)
- 여권번호·주민번호·연락처·항공권 예약번호는 저장하지 않습니다.
- 비밀 키(`.env`)는 저장소에 올리지 않으며, 서버 코드에서만 사용합니다.

## 기술 스택

- **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4**
- **Supabase**: 데이터베이스(Postgres), 개인 계정 로그인, 실시간 반영, 자동 정리(pg_cron)
- **Vercel**: 배포
- 문서 읽기: `unpdf`(PDF), `mammoth`(Word) + 자체 규칙 (`lib/server/ruleExtract.ts`)
- 지도: Leaflet + OpenStreetMap (위치 검색은 Nominatim, 서버에서 호출해 결과 저장)
- 알림: Web Push (서비스 워커)
- 화면: 어두운 우주 테마, 배경은 NASA Blue Marble 지구 지도 위에 코드로 구름·빛을 입힘

## 폴더 구조

```
app/        화면(페이지)과 API (login, api/events, api/upload, api/places, api/push ...)
features/   기능별 화면 조각 (auth, calendar, events, upload, notifications, shell)
lib/        서버 전용 코드(문서 읽기·규칙 추출·지도·알림)와 공용 코드
types/      일정 데이터 모양
supabase/   데이터베이스 변경 기록(migrations)
public/     서비스 워커, 아이콘, 지구 지도 이미지
scripts/    부원 계정 관리 도구
```

## 직접 실행해 보기

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 배포용 빌드
npm run lint     # 코드 검사
```

실행하려면 프로젝트 폴더에 `.env` 파일이 필요합니다. 이 파일은 저장소에 없으며, 필요한 **이름**은 아래와 같습니다. (값은 각자 발급해서 넣습니다.)

| 이름 | 용도 | 공개 여부 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase 연결 | 브라우저 공개용 |
| `SUPABASE_SECRET_KEY` | 서버가 데이터를 관리할 때 | 서버 전용 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 푸시 알림 | 브라우저 공개용 |
| `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | 푸시 알림 | 서버 전용 |
| `OPENAI_API_KEY`, `AI_TIDY` | (선택) AI 정리 단계. 없으면 꺼짐 | 서버 전용 |

데이터베이스 구조는 `supabase/migrations/`의 파일을 순서대로 적용하면 만들어집니다. 부원 계정은 `npm run members -- add` 로 만듭니다.

## 만들지 않은 것

부원별 권한·관리자 화면, 개인 구글·아웃룩 달력 연동, 회의실·차량·출장비 예약·결재, 문서 편집·번역, 반복 일정, 외부인 접속, 길 안내·항공권 검색, 스캔본·사진 문서 읽기, 메일 알림. (자세한 이유는 [PRD.md](PRD.md) 참고)

## 출처 표기

- 지구 지도: NASA Earth Observatory, *The Blue Marble: Land Surface, Ocean Color and Sea Ice*
- 지도 타일: © OpenStreetMap contributors
