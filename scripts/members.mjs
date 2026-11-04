// 부원 계정을 관리하는 도구. 관리자가 터미널에서 직접 실행한다. (화면에서는 가입할 수 없다)
//
//   npm run members -- add      부원 추가 (아이디·이름·비밀번호를 물어봄)
//   npm run members -- reset    부원 비밀번호 바꾸기
//   npm run members -- list     부원 목록 보기 (아이디와 이름만, 비밀번호는 보이지 않음)
//
// 비밀번호는 입력할 때 화면에 보이지 않고, 채팅이나 파일에 남지 않는다.
// 서버용 비밀 키(.env의 SUPABASE_SECRET_KEY)를 쓰므로 이 컴퓨터에서만 실행한다.
import readline from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";

// lib/loginId.ts 와 같은 값이어야 한다.
const LOGIN_EMAIL_DOMAIN = "members.intl-coop.local";
const LOGIN_ID_PATTERN = /^[a-z0-9._-]{2,30}$/;
const MIN_PASSWORD_LENGTH = 8;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error(
    "저장소 연결 값이 없습니다. .env의 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY를 확인하세요.",
  );
  process.exit(1);
}
const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const toEmail = (loginId) => `${loginId}@${LOGIN_EMAIL_DOMAIN}`;

async function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

// 입력한 글자가 화면에 보이지 않게 비밀번호를 받는다.
function askHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    if (!stdin.isTTY) {
      // 터미널이 아니면(파이프 등) 숨길 수 없으므로 중단한다.
      console.error("\n비밀번호는 터미널에서 직접 입력해야 합니다.");
      process.exit(1);
    }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\u0003") {
          // Ctrl+C
          stdin.setRawMode(false);
          process.stdout.write("\n취소했습니다.\n");
          process.exit(1);
        } else if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        } else if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
        } else {
          value += ch;
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function askNewPassword() {
  const first = await askHidden(`비밀번호 (${MIN_PASSWORD_LENGTH}자 이상): `);
  if (first.length < MIN_PASSWORD_LENGTH) {
    console.error(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
    process.exit(1);
  }
  const second = await askHidden("비밀번호 한 번 더: ");
  if (first !== second) {
    console.error("두 번 입력한 비밀번호가 다릅니다.");
    process.exit(1);
  }
  return first;
}

async function askLoginId() {
  const loginId = (await ask("아이디 (영문 소문자·숫자, 2~30자): ")).toLowerCase();
  if (!LOGIN_ID_PATTERN.test(loginId)) {
    console.error(
      "아이디는 영문 소문자·숫자·점(.)·밑줄(_)·하이픈(-)만 쓸 수 있고 2~30자여야 합니다.",
    );
    process.exit(1);
  }
  return loginId;
}

async function findUserByEmail(email) {
  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function addMember() {
  const loginId = await askLoginId();
  const name = await ask("이름 (화면에 표시, 담당자 목록에 사용): ");
  if (!name) {
    console.error("이름을 입력해 주세요.");
    process.exit(1);
  }
  const password = await askNewPassword();

  const { data, error } = await admin.auth.admin.createUser({
    email: toEmail(loginId),
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) {
    console.error(
      error.message.toLowerCase().includes("already")
        ? "이미 있는 아이디입니다."
        : `계정을 만들지 못했습니다: ${error.message}`,
    );
    process.exit(1);
  }

  const { error: memberError } = await admin
    .from("members")
    .insert({ id: data.user.id, name });
  if (memberError) {
    // 반쪽만 만들어지지 않게 계정을 되돌린다.
    await admin.auth.admin.deleteUser(data.user.id);
    console.error(`부원 정보를 저장하지 못해 취소했습니다: ${memberError.message}`);
    process.exit(1);
  }
  console.log(`추가했습니다: 아이디 ${loginId} / 이름 ${name}`);
}

async function resetPassword() {
  const loginId = await askLoginId();
  const user = await findUserByEmail(toEmail(loginId));
  if (!user) {
    console.error("없는 아이디입니다.");
    process.exit(1);
  }
  const password = await askNewPassword();
  const { error } = await admin.auth.admin.updateUserById(user.id, { password });
  if (error) {
    console.error(`비밀번호를 바꾸지 못했습니다: ${error.message}`);
    process.exit(1);
  }
  console.log(`${loginId} 의 비밀번호를 바꿨습니다.`);
}

async function listMembers() {
  const { data: members, error } = await admin
    .from("members")
    .select("id, name, created_at")
    .order("created_at");
  if (error) {
    console.error(`목록을 불러오지 못했습니다: ${error.message}`);
    process.exit(1);
  }
  const emailById = new Map();
  for (let page = 1; page < 50; page += 1) {
    const { data, error: listError } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listError) throw listError;
    data.users.forEach((u) => emailById.set(u.id, u.email ?? ""));
    if (data.users.length < 200) break;
  }
  if (members.length === 0) {
    console.log("등록된 부원이 없습니다.");
    return;
  }
  const suffix = `@${LOGIN_EMAIL_DOMAIN}`;
  members.forEach((m) => {
    const email = emailById.get(m.id) ?? "";
    const loginId = email.endsWith(suffix) ? email.slice(0, -suffix.length) : "?";
    console.log(`${loginId}\t${m.name}`);
  });
}

const commands = { add: addMember, reset: resetPassword, list: listMembers };
const command = process.argv[2];
if (!commands[command]) {
  console.log("사용법: npm run members -- add | reset | list");
  process.exit(1);
}
await commands[command]();
