// 빌드 산출물을 `next start`로 띄워 미생성 동적 경로(`/invite/아무코드`)가 렌더링되는지 확인한다(FD-2, FD-17).
// 사용: pnpm build && pnpm smoke
import { spawn } from "node:child_process";
import { createServer } from "node:net";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

const port = await freePort();
const env = { ...process.env, NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001" };
// pnpm이 next를 자식으로 띄우므로 프로세스 그룹째로 종료한다.
const server = spawn("pnpm", ["exec", "next", "start", "-p", String(port)], { env, stdio: "pipe", detached: true });
let output = "";
server.stdout.on("data", (d) => (output += d));
server.stderr.on("data", (d) => (output += d));

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`http://localhost:${port}/`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`서버가 시작되지 않았습니다.\n${output}`);
}

let failed = false;
try {
  await waitReady();
  // 앱 본문은 필수 기능 검사(FeatureGate) 뒤 브라우저에서만 그려지므로, 서버 응답에서는 "경로가 앱에 연결되고
  // 초대 코드가 전달됐는지"(200과 RSC 페이로드의 `inviteCode`)를 확인한다. 실제 렌더링은 브라우저 점검(FE-Z1)이다.
  const cases = [
    ["/invite/zz-never-created-code", "zz-never-created-code"],
    ["/invite/Ab_-9xYz0123456789abcdef", "Ab_-9xYz0123456789abcdef"],
  ];
  for (const [path, code] of cases) {
    const response = await fetch(`http://localhost:${port}${path}`);
    const html = await response.text();
    // 서버 렌더 결과에는 RSC 페이로드에 `"inviteCode":"<코드>"`로 전달된다.
    const ok = response.status === 200 && html.includes(`inviteCode\\":\\"${code}`);
    console.log(`${ok ? "OK  " : "FAIL"} ${path} -> ${response.status}`);
    if (!ok) failed = true;
  }
} catch (error) {
  console.error(error);
  failed = true;
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}
process.exit(failed ? 1 : 0);
