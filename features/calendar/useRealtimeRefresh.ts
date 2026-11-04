"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createBrowserSupabase } from "../../lib/client/supabase";

// 안전장치: 실시간 알림이 끊겨도 이 주기마다 한 번씩 확인한다. (목표: 늦어도 1분 안에 반영)
const FALLBACK_POLL_MS = 30_000;
// 알림이 연달아 와도 한 번만 새로 불러오도록 잠깐 모은다.
const BATCH_MS = 300;

// 다른 사람이 일정을 만들거나 고치면 onChange를 불러 준다. (달력이 조용히 새로 불러오는 데 쓴다)
//  1) 저장소의 실시간 알림: 보통 1~2초 안에 도착
//  2) 30초마다 확인: 알림이 끊겼을 때를 위한 안전장치
//  3) 화면이 다시 보일 때(탭 전환, 휴대폰 잠금 해제) 바로 확인
export function useRealtimeRefresh(onChange: () => void) {
  const callbackRef = useRef(onChange);
  useEffect(() => {
    callbackRef.current = onChange;
  });

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let channel: RealtimeChannel | null = null;

    const notify = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        if (!cancelled) callbackRef.current();
      }, BATCH_MS);
    };

    async function subscribe() {
      // 알림도 로그인한 부원의 권한으로 받는다. 로그인 정보를 알림 연결에 먼저 넘겨 준다.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);

      channel = supabase
        .channel("events-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "events" },
          notify,
        )
        .subscribe();
    }
    void subscribe();

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") notify();
    }, FALLBACK_POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") notify();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);
}
