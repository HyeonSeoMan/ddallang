#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Aggregate token usage and tool-result sizes from a Claude Code session log (JSONL).

Read-only. Prints aggregate numbers only: no conversation text, file paths,
commands, or session identifiers.

Usage:
  python3 scripts/tokstat.py SESSION.jsonl [--from ISO8601] [--to ISO8601] [--label NAME]

Aggregation units:
  call   = one assistant API response, identified by message.id. A response can
           span several log lines; each id is counted once (verified: usage is
           identical across its lines).
  tokens = sums of usage fields over calls: input_tokens (uncached new input),
           cache_creation_input_tokens (cache write; split 1h/5m when present),
           cache_read_input_tokens, output_tokens, thinking_tokens (part of output).
  context_per_call = input + cache write + cache read for one call (prompt size).
  tool results = characters per tool_result, counted once per tool_use_id,
           grouped by category (tool name; Bash is split by command kind).
Time filter: --from/--to compare the log's ISO-8601 UTC timestamps as strings.
"""
import argparse
import collections
import json
import sys

USAGE_FIELDS = ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens")


def bash_kind(cmd):
    if "orca terminal" in cmd or "orca orchestration" in cmd:
        return "Bash:orca"
    if cmd.startswith(("git ", "gh ")) or " git " in cmd[:40]:
        return "Bash:git/gh"
    if any(w in cmd for w in ("sed -n", "cat ", "grep ", "head ", "tail ")):
        return "Bash:document-dump"
    return "Bash:other"


def text_len(content):
    if isinstance(content, str):
        return len(content)
    if isinstance(content, list):
        return sum(len(p.get("text", "")) for p in content if isinstance(p, dict))
    return 0


def aggregate(path, t0=None, t1=None, label=""):
    seen_calls, seen_results, uses = set(), set(), {}
    tot = collections.Counter()
    calls, ctx = 0, []
    cache_1h = cache_5m = 0
    res_chars, res_count, tool_calls = collections.Counter(), collections.Counter(), collections.Counter()
    sizes = []
    bad_lines = 0
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            try:
                d = json.loads(line)
            except ValueError:
                bad_lines += 1
                continue
            ts = d.get("timestamp", "")
            if ts and ((t0 and ts < t0) or (t1 and ts > t1)):
                continue
            m = d.get("message") or {}
            u = m.get("usage")
            if d.get("type") == "assistant" and u and m.get("id") not in seen_calls:
                seen_calls.add(m.get("id"))
                calls += 1
                for f in USAGE_FIELDS:
                    tot[f] += u.get(f, 0)
                tot["thinking_tokens"] += (u.get("output_tokens_details") or {}).get("thinking_tokens", 0)
                cc = u.get("cache_creation") or {}
                cache_1h += cc.get("ephemeral_1h_input_tokens", 0)
                cache_5m += cc.get("ephemeral_5m_input_tokens", 0)
                ctx.append(sum(u.get(f, 0) for f in USAGE_FIELDS[:3]))
            content = m.get("content")
            if d.get("type") not in ("user", "assistant") or not isinstance(content, list):
                continue
            for b in content:
                if b.get("type") == "tool_use":
                    inp = b.get("input") or {}
                    uses[b.get("id")] = (b.get("name", "?"), inp.get("command", "") if b.get("name") == "Bash" else "")
                    tool_calls[b.get("name", "?")] += 1
                elif b.get("type") == "tool_result" and b.get("tool_use_id") not in seen_results:
                    seen_results.add(b.get("tool_use_id"))
                    name, cmd = uses.get(b.get("tool_use_id"), ("?", ""))
                    kind = bash_kind(cmd) if name == "Bash" else name
                    n = text_len(b.get("content"))
                    res_chars[kind] += n
                    res_count[kind] += 1
                    sizes.append((n, kind))
    sizes.sort(reverse=True)
    return {
        "label": label,
        "time_filter": {"from": t0, "to": t1},
        "calls": calls,
        "tokens": {k: tot[k] for k in (*USAGE_FIELDS, "thinking_tokens")},
        "cache_write_split": {"1h": cache_1h, "5m": cache_5m},
        "context_per_call": {"avg": sum(ctx) // calls if calls else 0, "max": max(ctx) if ctx else 0},
        "tool_calls": dict(tool_calls),
        "tool_result_chars": dict(res_chars),
        "tool_result_count": dict(res_count),
        "tool_result_chars_total": sum(res_chars.values()),
        "largest_tool_results": [{"chars": n, "category": k} for n, k in sizes[:8]],
        "skipped_unparseable_lines": bad_lines,
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description="Aggregate Claude Code session token usage (aggregates only).")
    ap.add_argument("path", help="session log (.jsonl)")
    ap.add_argument("--from", dest="t0", help="ISO-8601 UTC lower bound")
    ap.add_argument("--to", dest="t1", help="ISO-8601 UTC upper bound")
    ap.add_argument("--label", default="", help="task label to include in the output")
    a = ap.parse_args(argv)
    try:
        out = aggregate(a.path, a.t0, a.t1, a.label)
    except OSError as e:
        print("error: cannot read log file (%s)" % e.strerror, file=sys.stderr)
        return 2
    print(json.dumps(out, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
