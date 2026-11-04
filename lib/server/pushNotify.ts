// 푸시 알림 보내기와 "무엇이 바뀌었는지" 문구 만들기. 서버에서만 쓴다. (보안 키 VAPID_PRIVATE_KEY 사용)
// 원칙: 알림을 못 보내도 일정 저장·수정은 절대 실패하지 않는다. 이 파일의 함수는 오류를 던지지 않는다.
// 알림 내용은 브라우저 푸시 서비스를 지나가지만 부원 기기의 키로 암호화되어 서비스 쪽에서는 읽을 수 없다.
import webpush from "web-push";
import type { EventRow } from "../../features/events/eventRow";
import { createAdminSupabase } from "./supabase";

const NOTIFICATION_TITLE = "국제협력부 일정 변경";
const SEND_TIMEOUT_MS = 8000;
const TTL_SECONDS = 60 * 60 * 24; // 기기가 꺼져 있으면 하루까지 기다렸다가 전달
const GONE_STATUS = [404, 410]; // 더 이상 없는 기기(알림을 끈 브라우저 등)

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

// 날짜를 "11/12"처럼 짧게
const shortDate = (date: string | null) => (date ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : "미정");

const STATUS_CHANGE_TEXT: Record<string, string> = {
  confirmed: "확정",
  cancelled: "취소 처리",
  tentative: "미확정으로 변경",
  pending_review: "확인 전으로 변경",
};

// 일정이 바뀐 내용을 짧은 말로 정리한다. (바뀐 것이 없으면 빈 목록)
export function describeChange(before: EventRow, after: EventRow): string[] {
  const parts: string[] = [];
  if (before.status !== after.status) parts.push(STATUS_CHANGE_TEXT[after.status] ?? "상태 변경");
  if (before.title !== after.title) parts.push("행사명 변경");
  if (before.start_date !== after.start_date || before.end_date !== after.end_date) {
    parts.push(`날짜 변경(${shortDate(before.start_date)} → ${shortDate(after.start_date)})`);
  }
  if (before.start_time !== after.start_time || before.end_time !== after.end_time) parts.push("시간 변경");
  if (before.city !== after.city || before.country !== after.country) parts.push("장소 변경");
  if (before.assignee_id !== after.assignee_id) parts.push("담당자 변경");
  return parts;
}

interface NotifyInput {
  actorId: string; // 고친 부원. 이 부원에게는 알림을 보내지 않는다.
  text: (actorName: string) => string; // 알림 내용 (고친 사람 이름을 넣을 수 있다)
}

// 알림을 켜 둔 다른 부원들의 기기로 알림을 보낸다. 오류는 서버 기록에 상태 번호만 남기고 던지지 않는다.
export async function notifyOthers({ actorId, text }: NotifyInput): Promise<void> {
  try {
    if (!configure()) return; // 알림 키가 없으면 조용히 건너뛴다.
    const admin = createAdminSupabase();

    const [{ data: subs }, { data: actor }] = await Promise.all([
      admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .neq("member_id", actorId)
        .limit(2000),
      admin.from("members").select("name").eq("id", actorId).maybeSingle(),
    ]);
    if (!subs || subs.length === 0) return;

    const payload = JSON.stringify({
      title: NOTIFICATION_TITLE,
      body: text((actor?.name as string | undefined) ?? "다른 부원"),
      tag: "schedule-change",
      url: "/",
    });

    const gone: string[] = [];
    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } },
            payload,
            { TTL: TTL_SECONDS, timeout: SEND_TIMEOUT_MS },
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status !== undefined && GONE_STATUS.includes(status)) gone.push(sub.id as string);
          else console.error(`[push] 알림 전송 실패: ${status ?? "연결 오류"}`);
        }
      }),
    );

    // 더 이상 없는 기기는 목록에서 지운다.
    if (gone.length > 0) await admin.from("push_subscriptions").delete().in("id", gone);
  } catch {
    console.error("[push] 알림 처리 중 예상하지 못한 오류");
  }
}
