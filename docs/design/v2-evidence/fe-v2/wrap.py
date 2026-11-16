# -*- coding: utf-8 -*-
import sys, os
out = sys.argv[1]
scroll = int(sys.argv[2]) if len(sys.argv) > 2 else 0
for name in ["status","record","settlement","room","ended","offline","max-status","max-settlement","max-room"]:
    body = open(f"{out}/{name}.html", encoding="utf-8").read()
    html = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="app.css">
<style>@font-face {{ font-family: "PretendardLocal"; src: url(PretendardVariable.woff2) format("woff2"); font-weight: 45 920; }}
:root {{ --font-pretendard: "PretendardLocal"; }} html,body {{ margin:0; background:#888; }}
#vp {{ width:375px; height:812px; overflow:auto; position:relative; background: var(--colors-canvas); font-family: var(--fonts-body); color: var(--colors-ink); line-height:1.5; word-break: keep-all; overflow-wrap: break-word; }}</style></head>
<body><div id="vp">{body}</div>
<script>
document.fonts.ready.then(() => {{
  const vp = document.getElementById("vp");
  vp.scrollTop = {scroll};
  const r = {{ page: "{name}", vpScrollW: vp.scrollWidth, vpClientW: vp.clientWidth, overflowEls: [], money: [] }};
  for (const el of vp.querySelectorAll("*")) {{
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "visible" && el.tagName !== "INPUT" && el.tagName !== "SELECT") r.overflowEls.push(el.tagName + "." + (el.className.baseVal ?? el.className).slice(0,40));
  }}
  const vpRect = vp.getBoundingClientRect();
  for (const el of vp.querySelectorAll("span")) {{
    if (getComputedStyle(el).whiteSpace !== "nowrap") continue;
    const b = el.getBoundingClientRect();
    let card = el.closest("[class*='bg-c_paper']");
    const c = card ? card.getBoundingClientRect() : vpRect;
    r.money.push({{ text: el.textContent, w: Math.round(b.width*10)/10, fs: getComputedStyle(el).fontSize, right: Math.round(b.right), cardRight: Math.round(c.right - 20), fits: b.right <= c.right - 20 + 0.5 && b.left >= c.left + 19.5 }});
  }}
  const pre = document.createElement("pre"); pre.id = "result"; pre.textContent = JSON.stringify(r); document.body.appendChild(pre);
}});
</script></body></html>'''
    open(f"{out}/{name}-375.html", "w", encoding="utf-8").write(html)
print("ok")
