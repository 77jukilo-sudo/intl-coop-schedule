import type { Metadata } from "next";
import { Black_Han_Sans } from "next/font/google";
import "./globals.css";
import AppShell from "../features/shell/AppShell";

// 큰 타이틀 전용 글꼴(키가 크고 단단한 느낌). 빌드할 때 내려받아 우리 서버에서 제공한다.
const titleFont = Black_Han_Sans({
  weight: "400",
  subsets: ["latin"],
  preload: false, // 한글 조각 파일은 글자가 쓰일 때만 내려받는다
  display: "swap",
  variable: "--font-title",
});

export const metadata: Metadata = {
  title: "국제협력부 일정",
  description: "국제협력부 부원이 함께 보는 공용 일정 달력",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: 아래 스크립트가 열리기 전에 html에 data-intro를 붙이기 때문
    <html lang="ko" className={`${titleFont.variable} h-full antialiased`} suppressHydrationWarning>
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
