// 브라우저에서 일정 추가·수정 API를 부르는 도구.
import { signOut } from "../../app/login/actions";
import type { ScheduleEvent } from "../../types/schedule";
import type { EventFields } from "./eventInput";

export type SaveResult =
  | { ok: true; event: ScheduleEvent }
  // conflict: 다른 사람이 먼저 고쳤다 (latest = 지금 저장된 최신 내용)
  // invalid: 입력값 문제 (message를 그대로 보여 주면 된다)
  // error: 그 밖의 문제
  | {
      ok: false;
      kind: "conflict" | "invalid" | "error";
      message: string;
      latest?: ScheduleEvent;
    };

const GENERIC_ERROR = "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";

async function toResult(response: Response): Promise<SaveResult> {
  if (response.status === 401) {
    // 로그인 정보가 맞지 않으면 남은 로그인 정보를 지우고 로그인 화면으로 보낸다.
    await signOut();
    return { ok: false, kind: "error", message: "로그인이 필요합니다." };
  }

  const body = (await response.json().catch(() => null)) as {
    data?: ScheduleEvent;
    error?: { code: string; message: string };
  } | null;

  if (response.ok && body?.data) return { ok: true, event: body.data };

  const message = body?.error?.message ?? GENERIC_ERROR;
  if (response.status === 409) {
    return { ok: false, kind: "conflict", message, latest: body?.data };
  }
  if (response.status === 400) return { ok: false, kind: "invalid", message };
  return { ok: false, kind: "error", message };
}

async function send(url: string, method: "POST" | "PATCH", payload: unknown): Promise<SaveResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await toResult(response);
  } catch {
    return { ok: false, kind: "error", message: "네트워크 연결을 확인해 주세요." };
  }
}

// 일정 직접 추가
export function createEvent(fields: EventFields): Promise<SaveResult> {
  return send("/api/events", "POST", fields);
}

// 1안·2안 처리: 이 안을 확정하고 나머지 안을 숨기거나(choose), 확정을 되돌려 숨긴 안을 다시 보이게 한다(reopen).
export function changeOption(
  id: string,
  expectedVersion: number,
  action: "choose" | "reopen",
): Promise<SaveResult> {
  return send(`/api/events/${id}/options`, "POST", { action, expectedVersion });
}

// 변경으로 반영: 다시 올린 문서의 새 일정(newId)을 기존 일정(id)의 변경으로 반영하고 새 일정은 숨긴다.
export function applyChange(
  id: string,
  expectedVersion: number,
  newId: string,
): Promise<SaveResult> {
  return send(`/api/events/${id}/merge`, "POST", { newId, expectedVersion });
}

// 같은 묶음의 안 목록 (숨겨진 안 포함). 실패하면 null.
export async function fetchOptions(id: string): Promise<ScheduleEvent[] | null> {
  try {
    const response = await fetch(`/api/events/${id}/options`, { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: ScheduleEvent[] };
    return body.data ?? null;
  } catch {
    return null;
  }
}

// 일정 수정. expectedVersion은 내가 화면에서 본 일정의 버전이다.
export function updateEvent(
  id: string,
  expectedVersion: number,
  patch: Partial<EventFields>,
): Promise<SaveResult> {
  return send(`/api/events/${id}`, "PATCH", { ...patch, expectedVersion });
}
