import LoginForm from "../../features/auth/LoginForm";

// 로그인 화면. 계정은 관리자가 만들어 주며, 이 화면에서 가입할 수는 없다.
// 우주 배경 위에 큰 제목과 유리 느낌의 로그인 카드를 올린다.
export default function LoginPage() {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col pt-8 sm:pt-16">
      {/* 위쪽 작은 띠: 깜빡이는 점 + 영문 이름 */}
      <p className="rise-in flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.32em] text-sky-300/90">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400/70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-300" />
        </span>
        GLOBAL COOPERATION
      </p>

      {/* 큰 타이틀: 한 줄, 단단한 글꼴, 빛이 훑고 지나감 */}
      <h1 className="rise-in mt-3 [animation-delay:80ms]">
        <span className="title-display block whitespace-nowrap text-[clamp(3.1rem,17vw,5.4rem)] leading-[1.05]">
          국제협력부
        </span>
      </h1>

      {/* 얇은 선 + 서울 좌표 (배경 지구의 서울 불빛과 이어지는 장식) */}
      <div className="rise-in mt-3 flex items-center gap-3 text-[11px] tracking-[0.2em] text-foreground/55 [animation-delay:140ms]">
        <span className="h-px w-12 bg-gradient-to-r from-sky-300/80 to-transparent" />
        SEOUL · 37.57°N 126.98°E
      </div>
      <p className="rise-in mt-4 text-sm text-foreground/85 [text-shadow:0_1px_14px_rgba(0,0,0,0.8)] [animation-delay:200ms]">
        세계로 이어지는 우리 부서의 일정을 한눈에.
      </p>

      <div className="rise-in mt-8 rounded-3xl border border-white/15 bg-black/35 p-6 backdrop-blur-xl [animation-delay:240ms]">
        <h2 className="text-lg font-semibold">로그인</h2>
        <p className="mt-1 mb-5 text-sm text-foreground/70">
          국제협력부원만 이용할 수 있습니다. 아이디와 비밀번호는 담당자에게
          문의해 주세요.
        </p>
        <LoginForm />
      </div>
    </section>
  );
}
