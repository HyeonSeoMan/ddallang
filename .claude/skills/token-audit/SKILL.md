---
name: token-audit
description: Measure Claude Code token usage of one task window with scripts/tokstat.py and compare like-with-like against recorded baselines.
disable-model-invocation: true
argument-hint: "[session.jsonl] [--from ISO] [--to ISO] [--label NAME]"
allowed-tools: Bash(python3 scripts/tokstat.py *)
---
Measure token usage for: $ARGUMENTS

1. Log file: use the given path. If none, the newest `*.jsonl` in `~/.claude/projects/<cwd with / replaced by ->/` (list with `ls -t | head -3`, say which one you chose). Never print or quote log contents.
2. Run `python3 scripts/tokstat.py <log> [--from ..] [--to ..] [--label ..]`. It prints aggregates only. Do not read the log yourself.
3. Report these separately: calls; new input; cache write (1h/5m); cache read; output (thinking is a part of output); context per call; tool-result characters by category.
4. Comparison rules:
   - `.claude/baselines/*.json` is a whole-session aggregate. Never compare it with a single-task window; use it only as trend context.
   - Compare only tasks of the same type and size, each measured in its own time window, and at least 2-3 of them before concluding. Mark windows containing compaction or sub-agents.
   - Quality check: note review findings caused by omitted evidence; token savings must not raise that count.
5. Cost: `tokstat.py` reports tokens, not money. A token-based estimate needs a price table you do not have here, so state it as unavailable unless the user supplies prices, and label any such number "estimate". Actual billing is only on the Anthropic usage/billing page, not in the log.
6. Report in the CLAUDE.md §7 style, briefly. Add no conversation text, commands, paths or session IDs to the report.
