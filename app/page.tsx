// 시작 화면(임시): 달력 화면은 작업 5번에서 이 자리에 들어온다.
export default function Home() {
  return (
    <section className="rounded-xl border border-foreground/10 p-6 text-center">
      <h1 className="text-xl font-semibold sm:text-2xl">공용 일정 달력</h1>
      <p className="mt-2 text-sm text-foreground/70 sm:text-base">
        달력은 곧 이곳에 표시됩니다.
      </p>
    </section>
  );
}
