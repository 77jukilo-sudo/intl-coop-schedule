import { Suspense, type ReactNode } from "react";
import UserMenu from "../auth/UserMenu";
import SpaceBackground from "./SpaceBackground";

// 모든 화면이 함께 쓰는 공통 틀: 우주 배경 + 위쪽 알약 모양 제목줄 + 가운데 내용 영역.
// 모바일(약 360px)에서 PC까지 폭에 맞게 늘고 줄어든다.
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <SpaceBackground />

      <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center rounded-full border border-white/20 bg-white/10 px-4 backdrop-blur-xl sm:px-5">
          <span
            aria-hidden="true"
            className="mr-2.5 inline-block h-3 w-3 shrink-0 rounded-full bg-gradient-to-br from-sky-300 to-blue-600 shadow-[0_0_12px_2px_rgba(96,165,250,0.7)]"
          />
          <span className="mr-2 text-base font-bold tracking-tight sm:text-lg">
            국제협력부 일정
          </span>
          {/* 로그인 정보는 요청마다 달라서 Suspense로 감싼다 */}
          <Suspense fallback={null}>
            <UserMenu />
          </Suspense>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
