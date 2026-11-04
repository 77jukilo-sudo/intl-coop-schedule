import { NextResponse } from "next/server";
import { createSessionSupabase } from "../../../../../lib/server/supabase-session";
import type { EventHistoryEntry } from "../../../../../types/schedule";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

interface HistoryRow {
  id: string;
  event_id: string;
  changed_by: string;
  changed_at: string;
  summary: string;
  members: { name: string } | null;
}

// 수정 이력: GET /api/events/:id/history
// 누가, 언제, 무엇을 고쳤는지를 최근 것부터 돌려준다.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return errorResponse(404, "NOT_FOUND", "찾을 수 없는 일정입니다.");
  }

  const supabase = await createSessionSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return errorResponse(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  }

  const { data, error } = await supabase
    .from("event_history")
    .select("id, event_id, changed_by, changed_at, summary, members(name)")
    .eq("event_id", id)
    .order("changed_at", { ascending: false })
    .limit(100);

  if (error) {
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "수정 이력을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
    );
  }

  const entries: EventHistoryEntry[] = (data as unknown as HistoryRow[]).map(
    (row) => ({
      id: row.id,
      eventId: row.event_id,
      changedBy: row.changed_by,
      changedAt: row.changed_at,
      summary: row.summary,
      changedByName: row.members?.name ?? null,
    }),
  );

  return NextResponse.json({ data: entries });
}
