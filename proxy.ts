// 모든 요청이 화면에 닿기 전에 로그인 여부를 확인하는 문지기.
//  - 로그인하지 않은 사람은 로그인 화면(/login)으로 보낸다. (API는 401 응답)
//  - 이미 로그인한 사람이 /login 에 오면 첫 화면으로 보낸다.
//  - 로그인 정보(쿠키)가 만료되기 전에 새로 고쳐 준다.
// 이 확인은 1차 점검이다. 실제 데이터 보호는 저장소의 접근 규칙(RLS)이 한 번 더 한다.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/login";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("저장소 연결 값이 없습니다. .env를 확인하세요.");
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  // 갱신된 로그인 쿠키를 이동 응답에도 그대로 실어 보낸다.
  const withCookies = (target: NextResponse) => {
    response.cookies.getAll().forEach((c) => target.cookies.set(c));
    return target;
  };

  if (!loggedIn && pathname.startsWith("/api")) {
    return withCookies(
      NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } },
        { status: 401 },
      ),
    );
  }

  if (!loggedIn && pathname !== LOGIN_PATH) {
    return withCookies(NextResponse.redirect(new URL(LOGIN_PATH, request.url)));
  }

  if (loggedIn && pathname === LOGIN_PATH) {
    return withCookies(NextResponse.redirect(new URL("/", request.url)));
  }

  return response;
}

export const config = {
  // 정적 파일(이미지·아이콘 등)은 검사하지 않는다.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
