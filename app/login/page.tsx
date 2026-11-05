import LoginForm from "../../features/auth/LoginForm";

// 로그인 화면. 계정은 관리자가 만들어 주며, 이 화면에서 가입할 수는 없다.
// 우주 배경 위에 큰 제목과 유리 느낌의 로그인 카드를 올린다.
export default function LoginPage() {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col pt-8 sm:pt-16">
      <p className="rise-in text-xs font-semibold tracking-[0.28em] text-sky-300/90">
        GLOBAL COOPERATION
      </p>
      <h1 className="rise-in title-gradient mt-2 text-6xl font-black leading-[0.95] tracking-tight [animation-delay:80ms] sm:text-7xl">
        국제
        <br />
        협력부
      </h1>
      <p className="rise-in mt-4 text-sm text-foreground/85 [text-shadow:0_1px_14px_rgba(0,0,0,0.8)] [animation-delay:160ms]">
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
