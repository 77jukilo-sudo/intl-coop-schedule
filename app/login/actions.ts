"use server";

import { redirect } from "next/navigation";
import { createSessionSupabase } from "../../lib/server/supabase-session";
import {
  LOGIN_ID_PATTERN,
  loginIdToEmail,
  normalizeLoginId,
} from "../../lib/loginId";

export interface LoginState {
  error: string | null;
  loginId: string; // 실패했을 때 아이디 칸을 비우지 않기 위해 돌려준다 (비밀번호는 돌려주지 않음)
}

const LOGIN_FAILED = "아이디 또는 비밀번호가 맞지 않습니다.";

// 로그인: 아이디와 비밀번호가 맞으면 첫 화면으로 이동한다.
// 틀린 이유(없는 아이디인지 비밀번호 오류인지)는 알려 주지 않는다.
export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const loginId = normalizeLoginId(String(formData.get("loginId") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!LOGIN_ID_PATTERN.test(loginId) || password.length === 0) {
    return { error: LOGIN_FAILED, loginId };
  }

  const supabase = await createSessionSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: loginIdToEmail(loginId),
    password,
  });

  if (error) {
    return { error: LOGIN_FAILED, loginId };
  }

  redirect("/");
}

// 로그아웃: 로그인 정보를 지우고 로그인 화면으로 이동한다.
export async function signOut() {
  const supabase = await createSessionSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
