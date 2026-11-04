import LoginForm from "../../features/auth/LoginForm";

// 로그인 화면. 계정은 관리자가 만들어 주며, 이 화면에서 가입할 수는 없다.
export default function LoginPage() {
  return (
    <section className="mx-auto w-full max-w-sm pt-6 sm:pt-12">
      <h1 className="text-xl font-semibold sm:text-2xl">로그인</h1>
      <p className="mt-1 mb-6 text-sm text-foreground/70">
        국제협력부원만 이용할 수 있습니다. 아이디와 비밀번호는 담당자에게
        문의해 주세요.
      </p>
      <LoginForm />
    </section>
  );
}
