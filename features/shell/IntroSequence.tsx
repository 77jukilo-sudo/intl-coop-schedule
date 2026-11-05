"use client";

import { useEffect, useRef, useState } from "react";

// 첫 진입 연출(로그인 화면, 브라우저를 연 뒤 한 번만):
// 검은 화면 → 가운데 로고 + 0~100% 숫자 → 숫자가 위로 흐려지며 사라지고
// 로고가 제목줄 왼쪽 점 자리로 날아가 앉음 → 제목줄과 화면 내용이 떠오름.
// "건너뛰기"를 누르거나 '동작 줄이기' 설정이면 바로 끝낸다.
// 시작 여부는 layout.tsx의 작은 스크립트가 html의 data-intro="running"으로 미리 정해 둔다.

const COUNT_MS = 2600; // 숫자가 0에서 100까지 오르는 시간
const LEAVE_MS = 750; // 숫자가 사라지는 시간
const FLIGHT_MS = 2000; // 로고가 날아가는 시간
const REVEAL_AT_MS = 1400; // 날아가는 도중 제목줄을 보이기 시작하는 때

type Phase = "count" | "fly";

export default function IntroSequence() {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("count");
  const [value, setValue] = useState(0);
  const [logoStyle, setLogoStyle] = useState<React.CSSProperties>({});
  const timers = useRef<number[]>([]);
  const raf = useRef(0);
  const finished = useRef(false);

  const root = () => document.documentElement;

  // 연출을 완전히 끝내고 화면을 정상으로 돌린다.
  function finish() {
    if (finished.current) return;
    finished.current = true;
    cancelAnimationFrame(raf.current);
    timers.current.forEach((t) => window.clearTimeout(t));
    root().dataset.intro = "done";
    setActive(false);
  }

  // 로고를 제목줄의 점 위치로 보낸다.
  function startFlight() {
    const dot = document.querySelector<HTMLElement>("[data-logo-dot]");
    const r = dot?.getBoundingClientRect();
    if (r) {
      const targetX = r.left + r.width / 2 - window.innerWidth / 2;
      const targetY = r.top + r.height / 2 - window.innerHeight / 2;
      setLogoStyle({
        transform: `translate(calc(-50% + ${targetX}px), calc(-50% + ${targetY}px)) scale(${r.width / 56})`,
      });
    }
    setPhase("fly");
    timers.current.push(
      window.setTimeout(() => {
        root().dataset.intro = "done"; // 제목줄·내용이 떠오르기 시작
      }, REVEAL_AT_MS),
      window.setTimeout(finish, FLIGHT_MS + 50),
    );
  }

  useEffect(() => {
    if (root().dataset.intro !== "running") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      root().dataset.intro = "done";
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저에서만 알 수 있는 값이라 열린 뒤에 켠다
    setActive(true);

    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / COUNT_MS);
      setValue(Math.round(p * 100));
      if (p < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        timers.current.push(window.setTimeout(startFlight, LEAVE_MS * 0.4));
      }
    };
    raf.current = requestAnimationFrame(tick);

    const current = timers.current;
    return () => {
      cancelAnimationFrame(raf.current);
      current.forEach((t) => window.clearTimeout(t));
    };
    // 한 번만 시작하면 되므로 의존성은 비워 둔다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!active) return null;

  const flying = phase === "fly";

  return (
    <div
      className="fixed inset-0 z-50"
      style={{
        background: "#000",
        opacity: flying ? 0 : 1,
        transition: flying ? `opacity ${FLIGHT_MS * 0.6}ms ease ${FLIGHT_MS * 0.25}ms` : "none",
        pointerEvents: flying ? "none" : "auto",
      }}
      aria-label="국제협력부 일정을 불러오는 중"
      role="status"
    >
      {/* 가운데 로고: 지금은 점 아이콘, 나중에 그림 파일로 바꿔 끼울 수 있다 */}
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 block h-14 w-14 rounded-full bg-gradient-to-br from-sky-300 to-blue-600 shadow-[0_0_40px_8px_rgba(96,165,250,0.6)]"
        style={{
          transform: "translate(-50%, -50%)",
          transition: `transform ${FLIGHT_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
          zIndex: 51,
          ...logoStyle,
        }}
      />

      {/* 0~100% 숫자 */}
      <div
        className="absolute bottom-7 left-1/2 flex items-end gap-1 leading-none"
        style={{
          transform: "translateX(-50%)",
          animation: flying ? `intro-count-out ${LEAVE_MS}ms cubic-bezier(0.22,1,0.36,1) both` : "none",
        }}
      >
        <span className="text-6xl font-extralight tabular-nums">{value}</span>
        <span className="pb-1 text-2xl">%</span>
      </div>

      <button
        type="button"
        onClick={finish}
        className="absolute bottom-6 right-5 h-11 rounded-full border border-white/25 bg-white/5 px-4 text-sm text-white/80 hover:bg-white/10"
      >
        건너뛰기
      </button>
    </div>
  );
}
