// 부원은 이메일 대신 짧은 아이디로 로그인한다.
// 저장소(Supabase)는 이메일 모양의 계정 이름이 필요해서, 아이디 뒤에 고정 주소를 붙여 쓴다.
// 이 주소는 실제 메일이 오가는 곳이 아니다. (scripts/members.mjs 의 같은 값과 맞춰 둘 것)
export const LOGIN_EMAIL_DOMAIN = "members.intl-coop.local";

// 아이디 규칙: 영문 소문자·숫자·점(.)·밑줄(_)·하이픈(-), 2~30자
export const LOGIN_ID_PATTERN = /^[a-z0-9._-]{2,30}$/;

export function normalizeLoginId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function loginIdToEmail(loginId: string): string {
  return `${normalizeLoginId(loginId)}@${LOGIN_EMAIL_DOMAIN}`;
}
