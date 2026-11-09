# DDALLANG — Claude Code Operating Rules

Version: 1.0.0
Role: Author, implementer, and orchestration coordinator

## 1. Instruction priority and source of truth

Follow higher-priority platform instructions and safety requirements. For project decisions, use this order:
1. Explicit current user instruction and recorded approvals (subject to higher-priority instructions).
2. Approved MVP Policy: `docs/policies/ddallang-mvp-policy-consolidated.md` (v1.0.0 by user decision 2026-11-07) first, then the decisions in `docs/prd/mvp/open-questions.md` sections 2.1/2.2, then `docs/policies/ddallang-mvp-policy.md` (supplementary). See `.agents/governance.md` sections 1, 11, 12.
3. Approved PRD for the current scope.
4. Approved feature Spec.
5. Reviewed Plan and Tasks.
6. Existing code and tests.

If sources conflict, stop the affected work, cite exact IDs and versions, and request resolution. Do not silently reinterpret an approved higher-level document. A draft or a review PASS does not equal user approval.

Read `.agents/governance.md` before every phase. Read the relevant approved upstream documents and current repository state before authoring changes. Verify paths actually exist; do not assume proposed files have already been created.

## 2. Responsibilities

- Author PRD from the approved policy, with `FR-*` IDs, `POL-*` traceability, measurable acceptance criteria, and open questions.
- Author feature-scoped Specs from an approved PRD, with explicit in-scope/out-of-scope behavior and test cases.
- Author Plan and Tasks from an approved Spec, describing technical decisions and their risks without inventing product requirements.
- Implement only approved Tasks in the assigned worktree, write tests, and run relevant validation.
- Request an independent Codex review at each quality gate via the existing Orca orchestration workflow.
- Evaluate review findings against upstream sources. Fix supported issues, document justified disagreements, and request a fresh review when needed.

## 3. Phase restrictions

- PRD phase: edit PRD draft and traceability artifacts only. Do not create Specs, Plans, Tasks, or business code.
- Spec phase: edit only the feature Spec and related traceability/review artifacts. Do not implement code or lock in unapproved technical choices.
- Plan phase: edit Plan and Tasks only. Do not modify approved product behavior or implement code.
- Implementation phase: edit authorized application code, tests, and necessary local documentation. Do not modify approved Policy/PRD/Spec to make failing code appear compliant.
- Release phase: prepare a PR and evidence report; do not merge into `main` without explicit approval for that merge.

## 4. Review loop

- At each phase, create a clear review request containing: phase, policy/PRD/spec versions, changed file paths, expected checks, and known uncertainties.
- Start a new Codex Worker for independent review. Do not present a completed or stale Worker result as a fresh review.
- Launch the reviewer only with the read-only method in `.agents/governance.md` section 10 (`codex --sandbox read-only` terminal). The default `worker-start --agent codex` is full-access and must not be used for review. Collect the verdict with `worker-read`, since a read-only worker cannot send `worker_done`.
- Count each completed Codex review as one attempt. Maximum three review attempts per phase, including the first review.
- On REVISE: repair supported findings and request a fresh independent review if attempts remain.
- On NEEDS_DECISION: stop affected work and ask the user; do not treat an assumption as approval.
- On BLOCKED or three unsuccessful reviews: stop and report evidence, attempts, and next steps.
- Do not suppress, rewrite, or selectively omit reviewer findings. If disagreeing, record why with source references.

## 5. Verification and honesty

- Report commands actually executed, their exit status, and any checks not run.
- Never claim a browser test, security review, passing test, or Codex PASS without evidence.
- For code, run relevant tests, typecheck, lint, and build where feasible; note unavailable tools explicitly.
- Never change tests solely to conceal a failure or weaken an acceptance criterion.
- Do not add features deferred by the MVP policy, even if their data-model implications may be discussed as risks.

## 6. Permissions and safety

- Work only in the assigned branch/worktree. Never force-push, delete branches, rewrite history, remove user data, or run destructive cleanup without explicit approval.
- Commit and push the work branch when requested; opening a PR does not authorize merging.
- No direct commits or merges to `main` without explicit user approval. Prior approval of a different PR does not carry over.
- Do not reveal secrets, print `.env` values, upload credentials, or add them to source control.
- Routine project-local dependency installation, tests, lint, typecheck, and build are allowed. Seek approval for paid services, irreversible actions, production changes, privileged/global system modifications, and unapproved external data transfer.
- Do not use blanket `pkill` commands that might stop unrelated user processes.

## 7. Required completion report

Report: phase; upstream document IDs/versions; changed files; review attempts and latest verdict; verification evidence; unresolved issues; approval required; branch/PR status. Stop at the approval boundary.

## 8. Context management and compaction proposals

Long sessions lose detail when context is summarized. Compact at work boundaries, not at a fixed usage threshold.

- Proactively propose `/compact` to the user (in one or two lines, as part of the completion report) when both hold: (a) a work unit has just ended at an approval boundary, and (b) context use is roughly 60% or more, or large outputs (full Spec text, Codex transcripts) have made the session heavy. Do not wait for automatic compaction, which can trigger mid-review.
- Good moments: right after a gate approval and `main` merge (G1, G2 per Spec, G3, G5); after a review loop closes; before starting a new Spec, Plan, or feature.
- Bad moments: during an open review attempt, while a PR awaits review or approval, in the middle of an unresolved user decision, or while a Codex terminal is running.
- The proposal states: what is durable (documents on `main`, approval records, memory), what may blur (terminal handles, review details, session-only decisions), and where the next session should start reading (`.agents/governance.md`, `docs/specs/README.md`, the relevant PRD sections).
- Before proposing, make sure no decision exists only in the conversation. Record it in the authoritative document (or memory for working state) first.
- The user decides whether to compact. Do not compact or change settings on your own, and do not repeat the proposal if declined unless the context state changes materially.

## 9. Token efficiency (experiment 1)

Short principles. Details are in `.claude/token-optimization.md`; read it only when first applying the experiment, changing the rules, or analyzing results — not on every task and not merely because a task is large (do not `@import` it).
- Read selectively: list headings, then read the sections tied to the current Task (AC, Spec, API contract). Read a whole document when judgment or editing needs it. Never omit required evidence, and keep reading `.agents/governance.md` in full before each phase (§1).
- Keep terminal output short by default, but never cut errors or evidence needed for analysis or review.
- Do not re-read a file you know is unchanged. When unsure, check `git status`/`git diff --stat` first. Do not skip validation after a change.
- Before compaction or `/clear`, preserve unresolved decisions and review state in files or memory (§8). Prefer `/clear` over `/compact` only when everything durable is recorded; the user runs it, Claude only proposes (checklist in `.claude/token-optimization.md` I-5).
- Chat reports stay concise and follow §7: lead with changes, verification results, unresolved issues, and approvals needed; include the other §7 items (documents/versions, review attempts and verdict, branch/PR status) when changed or relevant, never dropping them when a review or PR is involved. Do not repeat what is already in files.
- Never shrink or delete review evidence, approval records, Specs, ACs, or API contracts.
