import { connection } from "next/server";
import { signOut } from "../../app/login/actions";
import { createSessionSupabase } from "../../lib/server/supabase-session";

// 제목줄 오른쪽: 로그인한 부원 이름과 로그아웃 버튼. 로그인하지 않았으면 아무것도 보이지 않는다.
export default async function UserMenu() {
  // 로그인 상태는 요청 때마다 달라지므로 미리 만들어 두지 않고 요청이 올 때 계산한다.
  await connection();
  const supabase = await createSessionSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: member } = await supabase
    .from("members")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="ml-auto flex items-center gap-3 text-sm">
      <span className="max-w-[40vw] truncate text-foreground/80">
        {member?.name ?? "부원"}님
      </span>
      <form action={signOut}>
        <button
          type="submit"
          className="h-11 rounded-lg border border-foreground/20 px-3 hover:bg-foreground/5"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
