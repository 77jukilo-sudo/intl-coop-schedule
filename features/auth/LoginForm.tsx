"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "../../app/login/actions";

const initialState: LoginState = { error: null, loginId: "" };

// 로그인 입력 칸: 아이디, 비밀번호, 로그인 버튼.
// 글자 크기를 16px 이상으로 두어 휴대폰에서 입력 시 화면이 확대되지 않게 한다.
export default function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">아이디</span>
        <input
          name="loginId"
          type="text"
          defaultValue={state.loginId}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          className="h-11 rounded-lg border border-foreground/20 bg-background px-3 text-base outline-none focus:border-foreground/60"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">비밀번호</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 rounded-lg border border-foreground/20 bg-background px-3 text-base outline-none focus:border-foreground/60"
        />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-lg bg-foreground text-base font-medium text-background disabled:opacity-60"
      >
        {pending ? "확인 중..." : "로그인"}
      </button>
    </form>
  );
}
