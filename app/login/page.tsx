import LoginForm from "../../features/auth/LoginForm";
import PortalWindow from "../../features/shell/PortalWindow";

// 로그인 화면. 계정은 관리자가 만들어 주며, 이 화면에서 가입할 수는 없다.
// 우주 배경 위에 큰 제목, 유리 느낌의 로그인 카드, 마우스를 따라 기울어지는 지구 포털 창을 올린다.
// 넓은 화면에서는 왼쪽에 제목·로그인, 오른쪽에 포털 창. 좁은 화면에서는 포털 창이 맨 위에 작게 놓인다.
export default function LoginPage() {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col pt-4 sm:pt-12 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,28rem)_1fr] lg:items-center lg:gap-12">
      <div className="flex flex-col">
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
      </div>

      {/* 포털 창 자리: 좁은 화면에서는 맨 위(작게), 넓은 화면에서는 오른쪽(크게) */}
      <div className="order-first mx-auto mb-6 w-36 sm:w-44 lg:order-none lg:mb-0 lg:w-[360px] lg:justify-self-center">
        <PortalWindow className="w-full" />
      </div>
    </section>
  );
}
