"use client";

import { useEffect, useState } from "react";
import type { EventHistoryEntry } from "../../types/schedule";

// 한국 시각으로 "2026년 11월 4일 14:30" 모양으로 보여 준다.
const formatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; entries: EventHistoryEntry[] };

// 한 일정의 수정 이력(누가, 언제, 무엇을)을 최근 것부터 보여 준다.
export default function HistoryList({ eventId }: { eventId: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/events/${eventId}/history`);
        if (!response.ok) throw new Error("load failed");
        const body = (await response.json()) as { data: EventHistoryEntry[] };
        if (!cancelled) setState({ status: "ok", entries: body.data });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (state.status === "loading") {
    return <p className="text-sm text-foreground/50">이력을 불러오는 중...</p>;
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="text-sm text-red-600">
        수정 이력을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.
      </p>
    );
  }
  if (state.entries.length === 0) {
    return <p className="text-sm text-foreground/50">기록된 수정 이력이 없습니다.</p>;
  }

  return (
    <ol className="flex max-h-52 flex-col gap-2 overflow-y-auto pr-1">
      {state.entries.map((entry) => (
        <li
          key={entry.id}
          className="rounded-lg border border-foreground/10 p-2 text-sm"
        >
          <div className="text-xs text-foreground/60">
            {formatter.format(new Date(entry.changedAt))} ·{" "}
            {entry.changedByName ?? "알 수 없음"}
          </div>
          <div className="mt-0.5 break-words">{entry.summary}</div>
        </li>
      ))}
    </ol>
  );
}
