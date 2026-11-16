// 2.0.0 이어받기 흐름 실제 Chrome 점검(FE-M9). **배포 DB에 시험 방 1개(참여자 2명)가 남는다.** 기본 `pnpm test`에 포함되지 않는다.
// 브라우저 세 개(서로 다른 사용자 폴더 = 서로 다른 저장소): A 방장, B 이전 브라우저, C 이어받기 요청자.
// 준비: 앱을 대상 API로 빌드·실행(`NEXT_PUBLIC_API_BASE_URL=<api> pnpm build && pnpm start`), Chrome 세 개를
//       `chrome --headless=new --remote-debugging-port=<포트> --user-data-dir=<임시 폴더마다 다르게> about:blank`로 띄운다.
// 실행: `node scripts/qa-claims.mjs <A 포트> <B 포트> <C 포트> <web-url> <스크린샷 폴더>`
// 확인: 방 만들기 → B 새로 입장 → C 이어받기 요청·대기 → A 요청 구역·배지 → A 승인 → C 주기 조회로 방 화면 →
//       B 접근 상실 안내 → A가 C(이어받은 참여자) 비활성화 → C 조회 전용. 점검 중 예상 밖 4xx/5xx·JS 예외 기록.
import { writeFileSync } from "node:fs";

const [, , PA, PB, PC, WEB, OUT] = process.argv;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

const HELP = `window.__q = {
  label: (t) => { const l = [...document.querySelectorAll('label')].find(x => x.textContent.trim() === t); return l ? document.getElementById(l.htmlFor) : null; },
  set: (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); },
  click: (s, t) => { const e = [...document.querySelectorAll(s)].find(x => x.textContent.trim() === t && !x.disabled); if (!e) return false; e.click(); return true; },
  aria: (n) => { const e = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === n && !x.disabled); if (!e) return false; e.click(); return true; },
  tab: (t) => { const a = [...document.querySelectorAll('nav[aria-label="방 페이지"] a')].find(x => x.textContent.trim().startsWith(t)); if (!a) return false; a.click(); return true; },
  text: () => document.body.innerText,
};`;

async function attach(port, role) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 1;
  const pend = new Map();
  const bad = [];
  ws.onmessage = (m) => {
    const x = JSON.parse(m.data);
    if (x.id && pend.has(x.id)) {
      const p = pend.get(x.id);
      pend.delete(x.id);
      if (x.error) p.rej(new Error(JSON.stringify(x.error)));
      else p.res(x.result);
      return;
    }
    if (x.method === "Network.responseReceived") {
      const r = x.params.response;
      // 앱 출처가 아닌 응답(= API)의 4xx/5xx. API 주소에 묶지 않는다(검수 F5).
      if (new URL(r.url).origin !== new URL(WEB).origin && r.status >= 400) {
        bad.push({ at: Date.now(), status: r.status, path: new URL(r.url).pathname, text: `${r.status} ${new URL(r.url).pathname}` });
      }
    }
    if (x.method === "Runtime.consoleAPICalled" && x.params.type === "error") {
      bad.push({ at: Date.now(), text: "console.error: " + x.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 160) });
    }
    if (x.method === "Runtime.exceptionThrown") {
      bad.push({ at: Date.now(), text: "JS 예외: " + (x.params.exceptionDetails.exception?.description ?? x.params.exceptionDetails.text).slice(0, 160) });
    }
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = id++;
      pend.set(i, { res, rej });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const ev = async (e) => {
    const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`${role} evaluate: ` + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).slice(0, 200));
    return r.result.value;
  };
  const waitFor = async (e, label, t = 90000) => {
    const s = Date.now();
    while (Date.now() - s < t) {
      try {
        if (await ev(e)) return Date.now() - s;
      } catch {}
      await sleep(100);
    }
    throw new Error(`${role} 시간 초과: ${label}`);
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: HELP });
  const shot = async (name) => {
    const r = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, "base64"));
  };
  return { send, ev, waitFor, bad, shot, close: () => ws.close() };
}

const A = await attach(PA, "A");
const B = await attach(PB, "B");
const C = await attach(PC, "C");
const ROOM = `이어받기점검${Date.now() % 10000}`;
let tApprove = Number.POSITIVE_INFINITY;
try {
  // ---------- A: 방 만들기 ----------
  await A.send("Page.navigate", { url: WEB + "/" });
  await A.waitFor("!!__q.label('방 이름')", "홈");
  await A.ev(`__q.set(__q.label('방 이름'), '${ROOM}'); __q.set(__q.label('내 닉네임'), '방장A'); true`);
  await A.ev("__q.click('button', '방 만들기')");
  await A.waitFor(`/^\\/invite\\/[^/]+$/.test(location.pathname) && document.querySelector('header h1')?.textContent === '${ROOM}'`, "방 화면", 120000);
  const base = await A.ev("location.pathname");
  check("1 A가 방을 만들고 방 화면에 들어간다", true, base);

  // ---------- B: 새로 입장 ----------
  await B.send("Page.navigate", { url: WEB + base });
  await B.waitFor("__q.text().includes('새로 입장하기') && __q.text().includes('기존 참여자 이어받기') === false", "B 선택 화면(후보 없음)", 120000);
  check("2 B(신원 없음)는 선택 화면을 본다. 방장만 있어 이어받기 후보가 없으면 이어받기를 숨긴다", true);
  await B.ev("__q.click('button', '새로 입장하기')");
  await B.waitFor("!!__q.label('닉네임')", "B 닉네임");
  await B.ev("__q.set(__q.label('닉네임'), '이전B'); true");
  await B.ev("__q.click('button', '입장')");
  await B.waitFor("!!document.querySelector('section[data-section=balances]') && document.querySelector('section[data-section=balances]').textContent.includes('이전B')", "B 방 화면", 120000);
  check("3 B가 새로 입장해 방 화면에 들어간다", true);

  // ---------- C: 이어받기 요청 ----------
  await C.send("Page.navigate", { url: WEB + base });
  await C.waitFor("__q.text().includes('기존 참여자 이어받기')", "C 선택 화면", 120000);
  await C.ev("__q.click('button', '기존 참여자 이어받기')");
  await C.waitFor("__q.text().includes('이어받을 참여자 선택')", "C 후보");
  const candidates = await C.ev("[...document.querySelectorAll('ul[aria-label=\"이어받기 후보\"] button')].map(b => b.textContent.trim())");
  check("4 C의 후보는 방장을 뺀 참여자다", JSON.stringify(candidates) === JSON.stringify(["이전B"]), JSON.stringify(candidates));
  await C.ev("__q.click('button', '이전B')");
  await C.waitFor("!!document.querySelector('[role=dialog]')", "C 확인");
  await C.shot("c-confirm-390");
  await C.ev("[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === '요청').click(); true");
  await C.waitFor("__q.text().includes('방장의 승인을 기다리는 중')", "C 대기", 60000);
  check("5 C가 이어받기를 요청하고 대기 화면(방 정보 없음)을 본다", !(await C.ev(`__q.text().includes('${ROOM}')`)));
  await C.shot("c-waiting-390");

  // ---------- A: 요청 구역·배지 ----------
  const tArrive = await A.waitFor("!!document.querySelector('nav[aria-label=\"방 페이지\"] a[aria-label=\"방 대기 중인 이어받기 요청 1건\"]')", "A 배지", 30000);
  check("6 A(방장) 방 탭에 대기 건수 배지가 새로고침 없이 붙는다", true, `요청 뒤 ${tArrive}ms 안에 관측`);
  await A.ev("__q.tab('방')");
  await A.waitFor("!!document.querySelector('section[data-section=claims]') && document.querySelector('section[data-section=claims]').textContent.includes('이전B 이어받기 요청')", "A 요청 구역");
  check("7 A 방 페이지에 이어받기 요청 구역(참여자 위)이 있다", await A.ev("(() => { const s = [...document.querySelectorAll('section[data-section]')].map(x => x.dataset.section); return s.indexOf('claims') < s.indexOf('participants'); })()"));
  await A.shot("a-claims-390");

  // ---------- A 승인 → C 방 화면, B 접근 상실 ----------
  await A.ev("__q.aria('이전B 이어받기 승인')");
  await A.waitFor("!!document.querySelector('[role=dialog]')", "A 승인 확인");
  tApprove = Date.now();
  await A.ev("[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === '승인').click(); true");
  const [cMs, bMs] = await Promise.all([
    C.waitFor("!!document.querySelector('section[data-section=balances]')", "C 방 화면", 30000).then(() => Date.now() - tApprove),
    B.waitFor("__q.text().includes('더 이상 접근할 수 없습니다')", "B 접근 상실", 30000).then(() => Date.now() - tApprove),
  ]);
  check("8 승인 뒤 C가 주기 조회로 알아채고 방 화면에 들어간다", true, `${cMs}ms`);
  check("9 승인 뒤 B(이전 브라우저)가 접근 상실 안내를 보고 방 화면이 닫힌다", !(await B.ev("!!document.querySelector('section[data-section=balances]')")), `${bMs}ms`);
  check("10 지연이 화면 반영 목표(최대 5초) 이내(배포 환경, 참고값)", cMs <= 5000 && bMs <= 5000, `C ${cMs}ms, B ${bMs}ms`);
  await C.shot("c-room-390");
  await B.shot("b-access-lost-390");
  check("11 B는 다시 새로 입장·이어받기를 고를 수 있다", await B.ev("__q.text().includes('새로 입장하기')"));
  await A.waitFor("!document.querySelector('section[data-section=claims]')", "A 요청 구역 사라짐", 30000);
  check("12 A의 요청 구역이 처리 뒤 사라진다", true);

  // ---------- A가 C(이어받은 참여자 이전B)를 비활성화 → C 조회 전용 ----------
  await A.ev("__q.aria('이전B 비활성화')");
  await C.ev("__q.tab('기록')");
  const roMs = await C.waitFor("__q.text().includes('비활성 참여자라 조회만 할 수 있습니다')", "C 조회 전용", 30000);
  check("13 비활성화된 C는 기록 탭에서 조회 전용 안내와 비활성화된 입력을 본다", await C.ev("!!__q.label('금액')?.matches(':disabled')"), `${roMs}ms`);
  await C.shot("c-readonly-390");
  await A.shot("a-room-after-390");

  // ---------- 오류 기록 ----------
  // B에서 예상되는 오류는 승인 뒤 이 방·초대 경로의 401(IDENTITY_REVOKED)뿐이다(검수 F4). 코드는 CDP 응답 본문 없이
  // 알 수 없으므로 시각·경로·상태로 좁힌다. 그 밖의 401·승인 전 401은 예상 밖이다.
  const roomPath = (p) => p.startsWith("/rooms/") || p.startsWith("/invites/");
  const expectedB = (x) => x.status === 401 && x.at >= tApprove && roomPath(x.path ?? "");
  const texts = (list) => [...new Set(list.map((x) => x.text))];
  const badA = texts(A.bad);
  const badB = texts(B.bad.filter((x) => !expectedB(x)));
  const badC = texts(C.bad);
  check(
    "14 예상 밖 4xx/5xx·console.error·JS 예외가 없다(B의 승인 뒤 401은 예상)",
    badA.length + badB.length + badC.length === 0,
    [...badA, ...badB, ...badC].join(" | ") || `없음(B 승인 뒤 401 ${B.bad.filter(expectedB).length}건)`,
  );
} catch (e) {
  check("스크립트 오류 없음", false, String(e.message).slice(0, 300));
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n합계: ${results.length - failed} PASS, ${failed} FAIL`);
for (const s of [A, B, C]) {
  try {
    s.close();
  } catch {}
}
process.exit(failed ? 1 : 0);
