import type { ReactNode } from "react";

// 모든 화면이 함께 쓰는 공통 틀: 위쪽 제목줄 + 가운데 내용 영역.
// 모바일(약 360px)에서 PC까지 폭에 맞게 늘고 줄어든다.
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:px-6">
          <span className="text-base font-semibold tracking-tight sm:text-lg">
            국제협력부 일정
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
