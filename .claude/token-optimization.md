# Token optimization guide (Claude Code, experiment 1)

Scope: Claude Code input/output tokens only. Not changed: model, `.agents/governance.md`, Orca, Codex. Not applied: I-6 (disabling MCP/plugins).
Never reduced: Specs, ACs, API contracts, review evidence, approval records, verification evidence.

When to read this file: when first applying the experiment, when changing these rules, or when analyzing experiment results. Do not read it on every task, and do not read it just because a task is large. The short principles in `CLAUDE.md` §9 are enough for ordinary work. Do not `@import` this file.

## Input

**I-1 Selective reading**
- Find sections with `grep -n '^#' <file>`, then read ranges (`Read` with offset/limit, or `sed -n a,bp`).
- Order: (1) the Task row in `tasks.md` and its basis column, (2) the matching `ac-matrix.md` rows, (3) the Spec sections they cite (§4 API, §9 responsibilities, referenced rules), (4) neighbouring sections only when a rule points to them.
- Read a whole document when judging conformance, editing, or when the cited sections are not enough. Say why in one line. Never omit required evidence (Spec, AC, API contract) to save tokens.
- Always read in full: `.agents/governance.md` before each phase, the file being edited, files named in a review finding.

**I-2 Task reading map** (proposal, not created in this experiment)
- A table "Task -> Spec sections, AC rows, API contract rows" derived from `tasks.md`/`ac-matrix.md`. It is an index only; judgments and edits use the source text.

**I-3 Terminal output**
- Default to summaries: `head`, `cut -c1-N`, `grep -n`, counts. Scripts print summary lines.
- Do not cut: error messages and stack traces, failing test output, diff hunks under review, command results cited as evidence.
- While waiting for a review, poll only the last lines; read the full result once.

**I-4 Re-reading**
- If you already know a file is unchanged (you read it in this context and nothing has edited it since), do not re-read it and do not run `git status`/`git diff` just to confirm.
- If unsure whether it changed (other tools, another branch, a long gap, after compaction), check `git status --short` and `git diff --stat` first; re-read only changed files or the sections needed for the next step.
- Files edited in this session: Edit/Write report failure, so no re-read just to confirm the edit. This does not waive required validation after a change (tests, type checks, linters, consistency scripts, diff review).

**I-5 Compaction and clear**
- Propose `/compact` or `/clear` at work or approval boundaries (`CLAUDE.md` §8). Not during an open review, an unresolved decision, a PR awaiting approval, or while a Codex terminal is running.
- Choosing: propose `/clear` when no review is open, no decision is unresolved, and every decision and status is already in files or memory (the summary a compaction carries would only add tokens). Propose `/compact` when the current flow must continue or some context exists only in the conversation.
- Before compacting or clearing, preserve in files or memory: unresolved decisions; review state (attempt count, latest verdict, open findings and their dispositions, terminal handles or dispatch IDs still needed); any decision that exists only in chat. A review in progress keeps its evidence.
- Pre-`/clear` checklist (state each item in the proposal, one line each):
  1. Decisions and approvals are recorded in their authoritative documents (e.g. `open-questions.md`).
  2. Review state is in `review.md` (attempts, verdict, findings and dispositions).
  3. Working state is reported: current branch/worktree, uncommitted or unpushed changes, open PRs, running terminals.
  4. The memory index (`MEMORY.md`) is current.
  5. Next-session start: where to begin reading (`.agents/governance.md`, `docs/specs/README.md`, the relevant Plan/Spec sections).
  If any item cannot be satisfied, propose `/compact` instead or finish the recording first.
- `/clear` and `/compact` are user commands. Claude proposes, never runs them, and does not repeat a declined proposal unless the context state changes materially.
- Put large outputs (full Spec text, Codex transcripts) in the scratchpad file and read only the needed lines.

## Output

**O-1** Do not repeat in chat what is already written to a file: give the path and a one-line conclusion. Keep review evidence and approval records complete in their files.
**O-2** Completion report (`CLAUDE.md` §7 still applies): lead with changes, verification results, unresolved issues, and approvals needed. Include commands run and checks not run. List other §7 items (documents/versions, review attempts and verdict, branch/PR status) when changed or relevant; omit unchanged items and repeated status tables.
**O-3** Decision requests: options, recommendation, and impact once. Do not recap settled decisions.
**O-4** File writes are not limited; correctness and verification come first. Prefer Edit for small changes. Do not restate written content in chat.
**O-5** Scripts print summary lines; print full lists only when they are the evidence.

## Measurement

- Tool: `python3 scripts/tokstat.py SESSION.jsonl [--from ISO] [--to ISO] [--label NAME]`. It prints aggregates only (calls, new input, cache write split 1h/5m, cache read, output and thinking tokens, context per call, tool-result characters by category).
- Aggregation unit: one assistant response counted once by message ID; tool results once per tool_use_id.
- Baseline: `.claude/baselines/baseline-2026-11-09.json` is a whole-session aggregate. Do not compare it directly with a single-task result.
- Comparison method: pick comparable tasks (same type and size, e.g. one Plan fix from a Spec plus one review), record the time window, run the script per task, and compare calls, cache read, average context, output tokens, and tool-result size. Use at least 2-3 comparable tasks before drawing conclusions. Mark windows that include a compaction or sub-agents.
- Quality check: count review findings caused by omitted evidence; the rules must not raise this number.
- Privacy: the script never prints conversation text, commands, file paths, or session IDs. Keep session logs out of the repository.
