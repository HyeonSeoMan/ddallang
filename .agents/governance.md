# DDALLANG — Shared Governance & Quality Gates

Version: 1.0.0
Scope: MVP PRD → Spec → Plan → Tasks → Implementation → PR

## 1. Authoritative sources

- Product policy, priority 1: `docs/policies/ddallang-mvp-policy-consolidated.md` (treated as v1.0.0 by user decision 2026-11-07). Policy decisions made after it are recorded in `docs/prd/mvp/open-questions.md` sections 2.1 (user decisions) and 2.2 (user-delegated Claude decisions); these are authoritative where the policy file is silent.
- Product policy, supplementary: `docs/policies/ddallang-mvp-policy.md` (source version 1.0.0, dated 2026-11-06; original Notion URL recorded in that file). It applies only where the consolidated policy is silent and does not conflict (see `docs/prd/mvp/policy-verification.md`).
- Product policy is the authority for MVP scope; deferred features remain deferred.
- PRD must map each applicable `POL-*` to one or more `FR-*` and acceptance criteria. Unresolved `OQ-*` items must remain visible.
- Feature Specs must reference an approved PRD version and trace to its `FR-*` IDs.
- Plans/Tasks must reference an approved Spec version; code/tests must trace to approved acceptance criteria.
- Do not invent document versions or approvals. Record actual version, link/commit, approver, and date when available.

## 2. Roles and boundaries

- User/product owner: approves PRD finalization, each feature Spec finalization, and each merge to `main`; resolves product policy questions.
- Claude Code: drafts/implements, coordinates review, and addresses validated findings.
- Codex: independent reviewer, no write or merge authority.
- Orca: starts/coordinates workers and worktrees. Tool support and actual sandbox restrictions must be verified; never assume an undocumented orchestration feature exists.

## 3. Mandatory gate sequence

| Gate | Inputs | Required outputs/checks | User approval? |
| --- | --- | --- | --- |
| G1 PRD | MVP Policy v1.0.0 | `FR-*` requirements, measurable acceptance criteria, `POL-*` traceability, MVP exclusions, open questions, independent Codex review | **Yes: PRD finalization** |
| G2 Spec | Approved PRD | Feature scope, testable behavior, edge cases, error/permission cases, `FR-*` traceability, independent Codex review | **Yes: each Spec finalization** |
| G3 Plan | Approved Spec | Technical plan, risks, architecture decisions, tasks, validation strategy, independent Codex review | No, unless a policy/scope decision arises |
| G4 Code | Reviewed Plan/Tasks + approved Spec | Implementation, tests, typecheck/lint/build as relevant, independent Codex review | No for ordinary implementation |
| G5 Release | Verified branch and PR | Evidence summary, residual risks, user review | **Yes: merge to `main`** |

Do not advance across G1 or G2 without the specified user approval. Do not merge `main` without explicit approval even if all automated checks pass. Approval is specific to a document version or PR; material changes invalidate the affected approval and require re-review/reapproval.

## 4. Review state machine

- `PASS`: gate quality conditions met; may proceed only if required user approval is also recorded.
- `REVISE`: Claude may revise and request another independent review.
- `NEEDS_DECISION`: pause affected work; ask user to resolve product/scope ambiguity.
- `BLOCKED`: pause affected work; report verification/environment obstacle.

Maximum **3 completed independent Codex review attempts per gate**, including the initial review. A fresh Codex worker is preferred for each independent attempt. No infinite loops. If attempts are exhausted, stop and report. No self-declared PASS by Claude. If the user resolves a product decision, record the decision in the authoritative upstream document before rerunning the affected gate.

A PASS does not assert absolute correctness. Record tests actually run, limitations, and residual risks. For G4, inability to run an essential test must be disclosed and may prevent PASS.

## 5. Change control

- Policy/PRD/Spec is not silently modified to accommodate a lower-level implementation.
- A new or conflicting requirement discovered in Plan or Code must be escalated to the appropriate upstream phase and reapproved when material.
- A PRD/Spec revision that changes accepted behavior triggers downstream impact review, including tests and affected Specs/Plans.
- MVP exclusions from policy v1.0.0: batch transaction entry; settlement confirmation/version history; post-game correction transactions; owner transfer/forced removal/invite regeneration; detailed audit browsing; auto-end/reopen/expiry/auto-deletion; automatic draft recovery.
- Original Notion PRD may contain deferred policies; their existence does not authorize MVP implementation.

## 6. MVP-specific review invariants

- RoomMember (connected identity) and Participant (game participant) are distinct.
- Identity recovery is browser-bound; no implied recovery of lost host permissions.
- Server enforces transaction authorship/host permissions and room/participant states.
- Amounts are positive integers; self-transfers are prohibited.
- Duplicate request IDs cannot create duplicate transactions; distinct identical-content transactions remain allowed.
- Deleted transactions do not affect net totals; required minimal original/author records remain.
- Net balance across all participants is zero; settlement uses policy-defined greedy matching, not a globally optimal transfer-count guarantee.
- After game end, ordinary transactions are locked; MVP settlement has no confirmation/version state.
- Offline/stale data must not be presented as current; reconnect refreshes server state without auto-resubmitting unfinished transactions.

These are review reminders, not replacements for the full policy file. If any reminder differs from the source, the source governs and the discrepancy must be reported.

## 7. Git and operational safety

- Perform work in the designated feature branch/worktree. No direct `main` writes, force push, destructive cleanup, branch deletion, or history rewrite without explicit authorization.
- PR creation is allowed when requested; PR creation is not merge approval.
- No secrets in commits, logs, review reports, or third-party prompts.
- Routine project-local dependency install and validation are permitted; paid services, production changes, destructive actions, privileged/global modifications, and external disclosure require approval.
- Do not stop unrelated local processes or claim a process was stopped without verifying.

## 8. Required evidence bundle

For every gate record: gate name, artifact path and version, upstream versions/IDs, review attempt count (max 3), latest verdict, issues and dispositions, checks run/results, unverified checks, open questions, user approval status, branch/PR status, and next allowed action.

## 9. Adoption checklist

1. [done] Existing `CLAUDE.md`, `AGENTS.md`, `.agents/`, and Orca configuration inspected: none existed on the branch; no overwrite or merge conflict.
2. [done] Policy placed at `docs/policies/ddallang-mvp-policy.md` unchanged (byte-identical to the provided file).
3. [done, with limitation] Orca Codex read-only enforcement verified empirically; see section 10.
4. [done] One PRD-only trial (G1; PRD v0.5.0 approved 2026-11-07) to verify the review loop and approval pause. Do not enable later gates before it succeeds.

## 10. Codex read-only enforcement in Orca (verified 2026-11-06)

Codex CLI 0.166.0, Orca CLI on macOS. A probe asked each worker to run `echo x > PROBE_WRITE_TEST.txt`.

| Launch method | Result | Enforced? |
| --- | --- | --- |
| `orca orchestration worker-start --agent codex` | Session reported `sandbox_mode=danger-full-access`, approval `never`; write succeeded | **No** |
| `orca terminal create --command "codex --sandbox read-only --ask-for-approval never"` then `worker-start --terminal <handle>` (no `--agent`) | `sandbox_mode=read-only`; write failed with `operation not permitted` | **Yes** (Codex sandbox layer) |

Rules:
- `worker-start` has no sandbox flag; the default Codex worker MUST NOT be used for review, because it has full write access and only a prompt would restrain it.
- Launch reviewers with the read-only terminal method above, one fresh terminal per review attempt.
- A read-only worker cannot reach the Orca runtime (`runtime_access_denied`/EPERM), so it cannot send `worker_done` or `ask`. The coordinator reads the verdict with `orca orchestration worker-read --dispatch <id>` (or `terminal read`); a `stopReason=finished` escalation is expected, not a failure.
- Before each review, confirm the session header shows `sandbox_mode=read-only`; otherwise treat the review as BLOCKED.
- Residual limits: the sandbox restricts writes but not reads (secrets in readable paths stay exposed to the reviewer, so do not keep secrets in the worktree), and the guarantee depends on the Codex CLI flags, not on Orca. Re-verify after Orca or Codex upgrades.

## 11. Common Spec and repository split

- `ddallang` (frontend + shared docs) is the single source of truth for Policy, PRD, and feature Specs. Feature Specs live under `docs/specs/`.
- `ddallang-server` (backend, not yet created; create only with user approval) references approved Specs from `ddallang`. It must not keep its own copy of shared Specs or decide API contracts or business rules independently.
- Each Plan/Tasks/implementation records the Spec version or `ddallang` commit it follows. Reviewers check against that same Spec.
- If the Spec is inaccessible, do not guess the contract; report to the user.
- A material Spec change needs impact review on both repositories and re-review/re-approval under section 3.
- Repositories have independent branches, commits, PRs, and deployments. Plan/Tasks are per repository.

## 12. Technology decisions

Confirmed backend stack (change only with user approval): TypeScript, Node.js LTS, NestJS, PostgreSQL, Prisma, REST (mutations), Server-Sent Events (server-to-client change notifications). Start as a single NestJS application with feature modules; no microservices; Redis or message queues only when a concrete need is shown.
Frontend keeps the existing stack in `apps/web` (Next.js, React, TanStack Query, Jotai, Panda CSS, Vitest).
Test framework, package manager, deployment, and API documentation tooling for the backend are undecided. Propose them in the backend Plan.
