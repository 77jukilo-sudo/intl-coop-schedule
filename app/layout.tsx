import type { Metadata } from "next";
import "./globals.css";
import AppShell from "../features/shell/AppShell";

export const metadata: Metadata = {
  title: "국제협력부 일정",
  description: "국제협력부 부원이 함께 보는 공용 일정 달력",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
