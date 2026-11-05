import type { Metadata } from "next";
import "./globals.css";
import AppShell from "../features/shell/AppShell";

export const metadata: Metadata = {
  title: "국제협력부 일정",
  description: "국제협력부 부원이 함께 보는 공용 일정 달력",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: 아래 스크립트가 열리기 전에 html에 data-intro를 붙이기 때문
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">
        {/* 로그인 화면을 이 브라우저에서 처음 열 때만 진입 연출을 켠다(화면이 그려지기 전에 정해야 깜빡임이 없다) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(location.pathname==="/login"&&!sessionStorage.getItem("introSeen")){sessionStorage.setItem("introSeen","1");document.documentElement.dataset.intro="running";}}catch(e){}`,
          }}
        />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
