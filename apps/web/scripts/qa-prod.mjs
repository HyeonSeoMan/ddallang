// 배포본(Vercel × Render × Supabase) 실사용 흐름 점검. **배포 DB에 시험 방 1개(참여자 2명·거래 3건)가 남는다.**
// 사용자 승인 없이 실행하지 않는다. 기본 `pnpm test`에는 포함되지 않는다. 새 의존성 없음(Node 22 내장 WebSocket).
// 준비: 원격 디버깅 Chrome — `chrome --headless=new --remote-debugging-port=9223 --user-data-dir=<임시> about:blank`
// 실행: `node scripts/qa-prod.mjs 9223 https://ddallang.vercel.app <스크린샷 폴더>`
// 확인: 방 만들기→참여자→거래→정산→종료, 같은 신원의 탭 두 개로 실시간(SSE) 반영 지연 측정(요청 송신 시각 기준, Spec S5 §6.7의 보수 기준),
//       새로고침 복원, 종료 방 이동, 점검 중 배포 API 4xx/5xx·네트워크 실패·JS 예외 기록.
// 배포본(Vercel × Render) 점검: 방 만들기→참여자→거래→정산→종료, 탭 두 개로 실시간(SSE) 지연 측정.
// 사용: node qa-prod.mjs <chrome-port> <web-url> <out-dir>
import { writeFileSync } from "node:fs";
const [, , PORT, WEB, OUT] = process.argv;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

const HELP = `window.__ev = []; (() => { const f = window.fetch.bind(window); window.fetch = function (u, ...r) { try { if (String(u).includes('/events')) window.__ev.push(String(u)); } catch (e) {} return f(u, ...r); }; })();
  window.__q = { label: (t) => { const l = [...document.querySelectorAll('label')].find(x => x.textContent.trim() === t); return l ? document.getElementById(l.htmlFor) : null; }, set: (el, v) => { const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }, click: (s, t) => { const e = [...document.querySelectorAll(s)].find(x => x.textContent.trim() === t); if (!e) return false; e.click(); return true; }, tab: (t) => { const a = [...document.querySelectorAll('nav[aria-label="방 페이지"] a')].find(x => x.textContent.trim() === t); if (!a) return false; a.click(); return true; }, tabs: () => [...document.querySelectorAll('nav[aria-label="방 페이지"] a')].map(a => a.textContent.trim()), option: (sel, t) => [...sel.options].find(o => o.textContent.trim() === t)?.value };`;

async function attach(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 1; const pend = new Map(); const bad = []; const reqs = [];
  ws.onmessage = (m) => {
    const x = JSON.parse(m.data);
    if (x.id && pend.has(x.id)) { const p = pend.get(x.id); pend.delete(x.id); if (x.error) p.rej(new Error(JSON.stringify(x.error)));
      else p.res(x.result);
      return; }
    if (x.method === "Network.requestWillBeSent") reqs.push({ url: x.params.request.url, method: x.params.request.method });
    if (x.method === "Network.responseReceived") { const r = x.params.response; if (r.url.includes("ddallang-api") && r.status >= 400) bad.push(`${r.status} ${r.url.replace(/^https:\/\/[^/]+/, "")}`); }
    if (x.method === "Network.loadingFailed" && !x.params.canceled) bad.push(`FAILED ${x.params.errorText} ${x.params.type}`);
    if (x.method === "Runtime.exceptionThrown") bad.push("JS 예외: " + (x.params.exceptionDetails.exception?.description ?? x.params.exceptionDetails.text).slice(0, 160));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = id++; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error("evaluate: " + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).slice(0, 200)); return r.result.value; };
  const waitFor = async (e, label, t = 90000) => { const s = Date.now(); while (Date.now() - s < t) { try { if (await ev(e)) return Date.now() - s; } catch {} await sleep(100); } throw new Error("시간 초과: " + label); };
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: HELP });
  const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, "base64")); };
  return { send, ev, waitFor, bad, reqs, shot, close: () => ws.close() };
}

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const A = await attach(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
let B;
try {
  // ---------- 방 만들기 (배포본) ----------
  const t0 = Date.now();
  await A.send("Page.navigate", { url: WEB + "/" });
  await A.waitFor("!!__q.label('방 이름')", "홈");
  check("1 배포 앱 홈이 열린다", true, `${Date.now() - t0}ms`);
  await A.ev("__q.set(__q.label('방 이름'), '점검용'); __q.set(__q.label('내 닉네임'), '방장'); true");
  const tCreate = Date.now();
  await A.ev("__q.click('button', '방 만들기')");
  await A.waitFor("/^\\/invite\\/[^/]+$/.test(location.pathname) && document.querySelector('header h1')?.textContent === '점검용'", "방 화면");
  const base = await A.ev("location.pathname");
  check("2 방 만들기가 배포 백엔드에서 성공하고 방 화면(현황)으로 간다", true, `${Date.now() - tCreate}ms, ${base}`);
  check("3 헤더에 방 이름·진행 상태, 탭 4개", (await A.ev("document.querySelector('header').textContent.includes('진행 중')")) && JSON.stringify(await A.ev("__q.tabs()")) === JSON.stringify(["현황", "기록", "정산", "방"]));
  await A.waitFor("window.__ev.length >= 1", "스트림 연결");
  check("4 실시간 스트림(/events)이 열린다(1회)", (await A.ev("window.__ev.length")) === 1);

  // ---------- 참여자 등록 ----------
  await A.ev("__q.tab('방')"); await A.waitFor("!!__q.label('참여자 닉네임')", "방 페이지");
  for (const n of ["가온", "나래"]) { await A.ev(`__q.set(__q.label('참여자 닉네임'), '${n}'); true`); await A.ev("__q.click('button', '참여자 등록')"); await A.waitFor(`[...document.querySelectorAll('section[data-section=participants] li')].some(li => li.textContent.includes('${n}'))`, n); }
  check("5 참여자 2명 등록", true);

  // ---------- 탭 B(같은 신원) 열기 ----------
  const nt = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(WEB + base)}`, { method: "PUT" })).json();
  B = await attach(nt.webSocketDebuggerUrl);
  const tB = await B.waitFor("location.pathname === '" + base + "' && !!document.querySelector('section[data-section=balances]') && document.querySelector('section[data-section=balances]').textContent.includes('가온')", "탭 B 현황", 120000);
  check("6 탭 B가 같은 방을 복원해 현황을 보인다(닉네임 재질문 없음)", true, `${tB}ms`);
  await B.waitFor("window.__ev.length >= 1", "탭 B 스트림");
  check("7 탭 B도 스트림 1회", (await B.ev("window.__ev.length")) === 1);

  // ---------- 실시간 지연: A가 저장 → B에 반영 ----------
  await A.ev("__q.tab('기록')"); await A.waitFor("!!__q.label('금액')", "기록");
  const samples = [];
  for (let i = 1; i <= 3; i++) {
    const amt = String(i * 1000);
    await A.ev(`(() => { const p = __q.label('지급자'), q = __q.label('수취자'); __q.set(p, __q.option(p, '가온')); __q.set(q, __q.option(q, '나래')); __q.set(__q.label('금액'), '${amt}'); return true; })()`);
    const before = await B.ev("document.querySelector('section[data-section=balances]').textContent");
    const tClick = Date.now();
    await A.ev("__q.click('button', '저장')");
    // 탭 B 폴링(50ms)으로 손익 텍스트가 바뀌는 시각을 잰다
    let tSeen = null;
    while (Date.now() - tClick < 30000) {
      const now = await B.ev("document.querySelector('section[data-section=balances]').textContent");
      if (now !== before) { tSeen = Date.now(); break; }
      await sleep(40);
    }
    await A.waitFor("!!document.querySelector('[data-testid=saved-notice]')", "A 저장 안내");
    const tSaved = Date.now();
    samples.push({ amt, ms: tSeen ? tSeen - tClick : null, savedMs: tSaved - tClick });
    console.log(`   거래 ${amt}: 탭 B 반영까지 ${tSeen ? tSeen - tClick + "ms" : "(30초 안에 반영 안 됨)"}, A의 저장 응답까지 ${tSaved - tClick}ms`);
    await A.ev("__q.click('button', '저장'); true".replace("__q.click('button', '저장');", "") );
    await sleep(300);
  }
  const ok = samples.every((s) => s.ms !== null);
  const max = Math.max(...samples.map((s) => s.ms ?? 1e9));
  check("8 한 접속자의 저장이 다른 탭에 실시간 반영된다(SSE, Render 프록시 경유)", ok, `반영 지연 ${samples.map((s) => s.ms + "ms").join(", ")}`);
  check("9 실시간 반영 지연이 Spec 목표(최대 5초) 이내", max <= 5000, `최대 ${max}ms`);
  const balB = await B.ev("document.querySelector('section[data-section=balances]').textContent");
  check("10 탭 B 손익이 서버 계산과 일치(가온 −6,000 / 나래 +6,000)", balB.includes("−6,000") && balB.includes("+6,000"), balB.replace(/\s+/g, " ").slice(0, 70));

  // ---------- 새로고침·직접 주소 ----------
  await A.send("Page.reload"); await sleep(500);
  await A.waitFor("location.pathname.endsWith('/record') && !!document.querySelector('header') && document.querySelector('header h1')?.textContent === '점검용'", "새로고침 뒤 복원", 120000);
  check("11 새로고침해도 입장을 복원해 같은 페이지(기록)로 돌아온다", true);

  // ---------- 종료: A가 종료 → B에 반영 ----------
  await A.ev("__q.tab('정산')"); await A.waitFor("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === '게임 종료')", "정산");
  check("12 정산 페이지의 예상 정산이 서버 값(나래 → 가온 6,000)과 일치", (await A.ev("document.querySelector('section[data-section=settlement]').textContent")).includes("6,000"));
  await A.ev("__q.click('button', '게임 종료')"); await A.waitFor("!!document.querySelector('[role=dialog]')", "대화상자");
  const tEnd = Date.now();
  await A.ev("[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === '게임 종료').click(); true");
  await A.waitFor("document.querySelector('section[data-section=settlement] h2')?.textContent === '최종 정산'", "A 최종 정산");
  const endA = Date.now() - tEnd;
  const endB = await B.waitFor("document.querySelector('header')?.textContent.includes('게임 종료') && !(__q.tabs().includes('기록'))", "B 종료 반영", 30000).then(() => Date.now() - tEnd);
  check("13 게임 종료가 다른 탭에 실시간 반영된다(기록 탭 제거, `게임 종료` 표시)", true, `A ${endA}ms, B ${endB}ms`);
  await A.shot("prod-final-390");
  await B.shot("prod-tabB-390");
  check("14 종료 뒤 기록 주소로 가면 정산으로 보낸다", await (async () => { await A.send("Page.navigate", { url: WEB + base + "/record" }); await A.waitFor("location.pathname.endsWith('/settlement')", "종료 방 이동", 60000); return true; })());

  // ---------- 오류 기록 ----------
  const badA = [...new Set(A.bad)], badB = [...new Set(B.bad)];
  check("15 점검 중 배포 API 4xx/5xx·네트워크 실패·JS 예외가 없다", badA.length === 0 && badB.length === 0, badA.concat(badB).join(" | ") || "없음");
  const apiHosts = new Set([...A.reqs, ...B.reqs].map((r) => { try { return new URL(r.url).host; } catch { return "?"; } }));
  console.log("   요청한 호스트:", [...apiHosts].join(", "));
} catch (e) {
  check("스크립트 오류 없음", false, String(e.message).slice(0, 300));
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n합계: ${results.length - failed} PASS, ${failed} FAIL`);
try { A.close(); B?.close(); } catch {}
process.exit(failed ? 1 : 0);
