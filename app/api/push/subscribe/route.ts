import { NextResponse } from "next/server";
import { createSessionSupabase } from "../../../../lib/server/supabase-session";
import { createAdminSupabase } from "../../../../lib/server/supabase";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// 알림 주소로 인정하는 브라우저 푸시 서비스 (Chrome·Edge·Samsung=Google, Firefox, Safari=Apple, Windows).
// 서버가 이 주소로 요청을 보내므로, 내부 주소 등 엉뚱한 곳으로 보내지 못하게 목록 밖의 주소는 받지 않는다.
const ALLOWED_PUSH_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
];

function isAllowedEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2000) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "") return false;
  return ALLOWED_PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

const KEY_PATTERN = /^[A-Za-z0-9_-]{10,300}$/;

async function currentMemberId(): Promise<string | null> {
  const supabase = await createSessionSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  // 부원 목록에 있는 사람만 알림을 등록할 수 있다.
  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("id", userData.user.id)
    .maybeSingle();
  return member ? (member.id as string) : null;
}

// 알림 받기 켜기: POST /api/push/subscribe   본문: 브라우저가 만든 구독 정보 { endpoint, keys: { p256dh, auth } }
export async function POST(request: Request) {
  const memberId = await currentMemberId();
  if (!memberId) return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");

  const body = (await request.json().catch(() => null)) as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  } | null;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (
    !isAllowedEndpoint(body?.endpoint) ||
    typeof p256dh !== "string" ||
    typeof auth !== "string" ||
    !KEY_PATTERN.test(p256dh) ||
    !KEY_PATTERN.test(auth)
  ) {
    return errorResponse(400, "VALIDATION_ERROR", "알림 정보를 확인할 수 없습니다. 다시 시도해 주세요.");
  }

  // 같은 기기를 다른 부원이 이어서 쓰면 주인을 지금 로그인한 부원으로 바꾼다. (부원 권한으로는 못 하므로 서버 열쇠를 쓴다)
  const { error } = await createAdminSupabase()
    .from("push_subscriptions")
    .upsert({ member_id: memberId, endpoint: body!.endpoint as string, p256dh, auth }, { onConflict: "endpoint" });
  if (error) {
    console.error(`[push] 구독 저장 오류: ${error.code ?? "unknown"}`);
    return errorResponse(500, "INTERNAL_ERROR", "알림을 켜지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  }
  return NextResponse.json({ data: { subscribed: true } }, { status: 201 });
}

// 알림 받기 끄기: DELETE /api/push/subscribe   본문: { endpoint }
export async function DELETE(request: Request) {
  const memberId = await currentMemberId();
  if (!memberId) return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");

  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string" || body.endpoint.length > 2000) {
    return errorResponse(400, "VALIDATION_ERROR", "알림 정보를 확인할 수 없습니다.");
  }

  // 내 기기만 지울 수 있다.
  const { error } = await createAdminSupabase()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", body.endpoint)
    .eq("member_id", memberId);
  if (error) {
    console.error(`[push] 구독 삭제 오류: ${error.code ?? "unknown"}`);
    return errorResponse(500, "INTERNAL_ERROR", "알림을 끄지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  }
  return NextResponse.json({ data: { subscribed: false } });
}
