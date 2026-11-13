// 실제 브라우저·실서버 점검: 페이지 분리(Plan v1.2.0, FE-P1~P3)를 Chrome DevTools 프로토콜로 확인한다.
// 기본 `pnpm test`에는 포함되지 않는다(실서버와 브라우저가 필요하다). 새 의존성은 없다(Node 22의 내장 WebSocket).
//
// 준비(점검용으로 서버와 DB를 따로 둔다. 개발용 서버·DB를 쓰지 않는다):
//   1) 백엔드를 별도 포트·별도 DB로 띄운다. `CORS_ORIGINS`에 아래 앱 주소를 넣는다.
//   2) `NEXT_PUBLIC_API_BASE_URL=<백엔드 주소> pnpm build` 뒤 `next start -p <포트>`(서버 주소는 빌드 때 고정된다).
//   3) 원격 디버깅이 켜진 Chrome: `chrome --headless=new --remote-debugging-port=9223 --user-data-dir=<임시> about:blank`
// 실행: `node scripts/qa-room-pages.mjs 9223 http://localhost:3055`
// 확인: 방 만들기→현황, 헤더·탭, 스트림(/events) 연결 1회 유지, 참여자 등록, 기록 저장 뒤 머물기·초안 유지,
//       현황 반영, 뒤로 가기, 새로고침·직접 주소 입력, 게임 종료와 종료 방 이동. 방을 새로 만들므로 시험 DB에 방이 남는다.
// 실제 Chrome(CDP) + 실서버로 페이지 분리를 점검한다. 사용: node cdp-qa.mjs <chrome-debug-port> <web-base-url>
const [, , PORT, WEB] = process.argv;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let nextId = 1;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error("evaluate 실패: " + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text) + "\n" + expression.slice(0, 200));
  return r.result.value;
};
const waitFor = async (expression, label, timeout = 20000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await ev(expression)) return true;
    } catch {}
    await sleep(150);
  }
  throw new Error(`시간 초과: ${label}`);
};

// 헬퍼: 화면 안에서 쓰는 함수들
const HELPERS = `
  window.__q = {
    label: (t) => { const l = [...document.querySelectorAll('label')].find(x => x.textContent.trim() === t); return l ? document.getElementById(l.htmlFor) : null; },
    set: (el, v) => { const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); },
    click: (sel, t) => { const e = [...document.querySelectorAll(sel)].find(x => x.textContent.trim() === t); if (!e) return false; e.click(); return true; },
    tab: (t) => { const a = [...document.querySelectorAll('nav[aria-label="방 페이지"] a')].find(x => x.textContent.trim() === t); if (!a) return false; a.click(); return true; },
    tabs: () => [...document.querySelectorAll('nav[aria-label="방 페이지"] a')].map(a => a.textContent.trim()),
    option: (sel, text) => [...sel.options].find(o => o.textContent.trim() === text)?.value,
  };`;

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
// 문서가 새로 로드될 때마다: 실시간 스트림(/events) 호출을 센다(앱 코드보다 먼저 fetch를 감싼다)
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `window.__ev = []; const __f = window.fetch.bind(window); window.fetch = function (u, ...r) { try { if (String(u).includes('/events')) window.__ev.push(String(u)); } catch (e) {} return __f(u, ...r); };` + HELPERS,
});
const nav = async (url) => {
  await send("Page.navigate", { url });
  await sleep(400);
};
const path = () => ev("location.pathname");
const evCount = () => ev("window.__ev.length");

try {
  // ---------- A. 방 만들기 → 방 화면 ----------
  await nav(WEB + "/");
  await waitFor("!!__q.label('방 이름')", "방 만들기 폼");
  await ev("__q.set(__q.label('방 이름'), '금요일 포커'); __q.set(__q.label('내 닉네임'), '방장'); true");
  await ev("__q.click('button', '방 만들기')");
  await waitFor("/^\\/invite\\/[^/]+$/.test(location.pathname) && !!document.querySelector('header')", "방 화면(현황)");
  const base = await path();
  check("A1 방 만들기 뒤 초대 링크 경로의 현황 페이지로 간다", /^\/invite\/[^/]+$/.test(base), base);
  // 데이터가 도착하기 전에는 설계대로 `DDALLANG`만 보인다(서버 유래 값은 가림). 도착하면 방 이름과 진행 상태가 보인다.
  await waitFor("document.querySelector('header h1')?.textContent === '금요일 포커'", "방 이름 표시");
  check("A2 헤더에 방 이름과 진행 상태", (await ev("document.querySelector('header h1')?.textContent")) === "금요일 포커" && (await ev("document.querySelector('header').textContent.includes('진행 중')")));
  check("A3 탭 4개(현황·기록·정산·방)", JSON.stringify(await ev("__q.tabs()")) === JSON.stringify(["현황", "기록", "정산", "방"]));
  await waitFor("window.__ev.length >= 1", "스트림 연결");
  check("A4 실시간 스트림(/events)은 1번만 열린다", (await evCount()) === 1, `연결 호출 ${await evCount()}회`);
  await ev("window.__hdr = document.querySelector('header'); true");
  check("A5 현황에 누적 손익과 거래 내역 구역", await ev("[...document.querySelectorAll('h2')].map(h => h.textContent).join('|') === '누적 손익|거래 내역'"), await ev("[...document.querySelectorAll('h2')].map(h => h.textContent).join('|')"));

  // ---------- B. 방 페이지에서 참여자 등록 ----------
  await ev("__q.tab('방')");
  await waitFor("location.pathname.endsWith('/room') && !!__q.label('참여자 닉네임')", "방 페이지");
  check("B1 탭 클릭은 방 경로로 이동한다", (await path()).endsWith("/room"));
  check("B2 같은 헤더 요소가 유지된다(레이아웃 재생성 없음)", await ev("document.querySelector('header') === window.__hdr"));
  for (const name of ["가온", "나래"]) {
    await ev(`__q.set(__q.label('참여자 닉네임'), '${name}'); true`);
    await ev("__q.click('button', '참여자 등록')");
    await waitFor(`[...document.querySelectorAll('section[data-section=participants] li')].some(li => li.textContent.includes('${name}'))`, `참여자 ${name} 등록`);
  }
  check("B3 참여자 2명 등록", await ev("document.querySelectorAll('section[data-section=participants] li').length >= 2"));
  check("B4 여전히 스트림은 1번만 열려 있다", (await evCount()) === 1, `연결 호출 ${await evCount()}회`);

  // ---------- C. 기록 페이지: 저장 뒤 머물기 ----------
  await ev("__q.tab('기록')");
  await waitFor("location.pathname.endsWith('/record') && !!__q.label('금액')", "기록 페이지");
  check("C1 기록 페이지에는 거래 입력 구역만 있다", await ev("[...document.querySelectorAll('h2')].map(h => h.textContent).join('|') === '거래 입력'"));
  await ev("const p = __q.label('지급자'), q = __q.label('수취자'); __q.set(p, __q.option(p, '가온')); __q.set(q, __q.option(q, '나래')); __q.set(__q.label('금액'), '1000'); true");
  await ev("__q.click('button', '저장')");
  await waitFor("!!document.querySelector('[data-testid=saved-notice]')", "저장 안내");
  check("C2 저장하면 눈에 보이는 저장 안내가 뜬다", await ev("document.querySelector('[data-testid=saved-notice]').textContent.trim() === '거래를 저장했습니다.'"));
  check("C3 저장 뒤에도 기록 페이지에 머문다", (await path()).endsWith("/record"), await path());
  check("C4 폼이 비워져 연속 입력할 수 있다", (await ev("__q.label('금액').value")) === "" && (await ev("__q.label('지급자').value")) === "");
  // 입력 초안은 탭을 옮겨도 남는다
  await ev("__q.set(__q.label('금액'), '777'); true");
  await ev("__q.tab('정산')");
  await waitFor("location.pathname.endsWith('/settlement')", "정산 페이지");
  await ev("__q.tab('기록')");
  await waitFor("location.pathname.endsWith('/record') && !!__q.label('금액')", "기록 페이지 복귀");
  check("C5 다른 탭에 다녀와도 입력 초안이 남는다", (await ev("__q.label('금액').value")) === "777");
  await ev("__q.set(__q.label('금액'), ''); true");

  // ---------- D. 현황에 반영 ----------
  await ev("__q.tab('현황')");
  await waitFor("location.pathname === '" + base + "' && !!document.querySelector('section[data-section=balances]')", "현황 복귀");
  await waitFor("document.querySelector('section[data-section=balances]').textContent.includes('1,000')", "손익 반영");
  const bal = await ev("document.querySelector('section[data-section=balances]').textContent");
  check("D1 저장한 거래가 현황의 누적 손익에 반영된다(+1,000 / −1,000)", bal.includes("+1,000") && bal.includes("−1,000"), bal.replace(/\s+/g, " ").slice(0, 80));
  check("D2 거래 내역에도 보인다", await ev("document.querySelector('section[data-section=transactions]').textContent.includes('1,000')"));
  check("D3 탭을 계속 옮겼어도 스트림은 1번만 열려 있다", (await evCount()) === 1, `연결 호출 ${await evCount()}회`);

  // ---------- E. 뒤로 가기 ----------
  await ev("history.back()");
  await waitFor("location.pathname.endsWith('/record')", "뒤로 가기");
  check("E1 브라우저 뒤로 가기가 이전 페이지(기록)로 간다", (await path()).endsWith("/record"));
  check("E2 뒤로 가기 뒤에도 같은 헤더이고 스트림은 1번", (await ev("document.querySelector('header') === window.__hdr")) && (await evCount()) === 1);
  check("E3 뒤로 가기 뒤 탭 강조가 기록이다", (await ev("document.querySelector('nav[aria-label=\"방 페이지\"] a[aria-current=page]')?.textContent")) === "기록");

  // ---------- F. 새로고침·직접 주소 입력(문서 새로 로드) ----------
  await send("Page.reload");
  await sleep(500);
  await waitFor("location.pathname.endsWith('/record') && !!document.querySelector('header') && !!__q.label('금액')", "새로고침 뒤 기록 페이지");
  check("F1 기록 페이지에서 새로고침해도 입장을 복원해 같은 페이지로 돌아온다", (await path()).endsWith("/record"));
  check("F2 닉네임을 다시 묻지 않는다", await ev("!document.body.textContent.includes('닉네임') || !!document.querySelector('header')"));
  await waitFor("window.__ev.length >= 1", "새로고침 뒤 스트림");
  check("F3 새 문서에서도 스트림은 1번만 열린다", (await evCount()) === 1, `연결 호출 ${await evCount()}회`);
  await nav(WEB + base + "/room");
  await waitFor("!!document.querySelector('header') && location.pathname.endsWith('/room') && !!__q.label('참여자 닉네임')", "직접 주소 입력(방)");
  check("F4 하위 경로를 직접 입력해 열면 입장을 복원해 그 페이지를 보여 준다", (await path()).endsWith("/room"));

  // ---------- G. 게임 종료 ----------
  await ev("__q.tab('정산')");
  await waitFor("location.pathname.endsWith('/settlement') && [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '게임 종료')", "정산 페이지");
  check("G1 정산 페이지에 예상 정산과 게임 종료 컨트롤", await ev("document.querySelector('section[data-section=settlement] h2').textContent === '예상 정산'"));
  await ev("__q.click('button', '게임 종료')");
  await waitFor("!!document.querySelector('[role=dialog]')", "종료 확인 대화상자");
  await ev("[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === '게임 종료').click(); true");
  await waitFor("document.querySelector('section[data-section=settlement] h2')?.textContent === '최종 정산'", "최종 정산");
  check("G2 종료하면 같은 페이지가 `최종 정산`이 된다", true);
  await waitFor("!__q.tabs().includes('기록')", "기록 탭 제거");
  check("G3 종료 후 헤더에서 기록 탭이 사라지고 진행 상태가 `게임 종료`", JSON.stringify(await ev("__q.tabs()")) === JSON.stringify(["현황", "정산", "방"]) && (await ev("document.querySelector('header').textContent.includes('게임 종료')")));

  // ---------- H. 종료된 방 이동 ----------
  await nav(WEB + base + "/record");
  await waitFor("location.pathname.endsWith('/settlement')", "종료 방의 기록 경로 → 정산 이동", 25000);
  check("H1 종료된 방의 기록 주소로 들어가면 정산으로 보낸다", (await path()).endsWith("/settlement"), await path());
  await nav(WEB + base);
  await waitFor("location.pathname.endsWith('/settlement')", "종료 방의 처음 현황 → 정산", 25000);
  check("H2 종료된 방에 처음 들어온 곳이 현황이면 정산에서 시작한다", (await path()).endsWith("/settlement"), await path());
  await ev("__q.tab('현황')");
  await sleep(1500);
  check("H3 그 뒤 사용자가 현황 탭을 누르면 막지 않는다(정산으로 되돌려 보내지 않음)", (await path()) === base && (await ev("!!document.querySelector('section[data-section=balances]')")), await path());
} catch (e) {
  check("스크립트 오류 없음", false, String(e.message).slice(0, 300));
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n합계: ${results.length - failed} PASS, ${failed} FAIL`);
ws.close();
process.exit(failed ? 1 : 0);
