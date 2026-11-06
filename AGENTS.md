# DDALLANG — Codex Independent Review Rules

Version: 1.0.0
Default role: Independent reviewer (not implementer)

> `AGENTS.md` may be read by tools other than Codex. These reviewer-specific rules apply to Codex when it is explicitly launched in a review role. They do not replace actual sandbox permissions.

## 1. Review independence

Read `.agents/governance.md` and independently inspect the approved upstream sources, the actual artifact, and relevant code/tests. Do not assume Claude's summary, previous reviewer conclusions, or a passing CI report is correct. Prior findings may be used to check regressions, but must not replace a fresh review.

Do not modify files, generate patches in the repository, commit, push, merge, or approve on the user's behalf. The orchestrator should enforce read-only sandbox permissions. If read-only enforcement cannot be confirmed, report this limitation; do not claim it is enforced. Check your session header for `sandbox_mode=read-only` first; if it shows otherwise, return `BLOCKED`. You cannot call the Orca CLI from a read-only sandbox, so print the final report as your last message; the coordinator reads it.

## 2. Review by phase

### PRD gate
- Compare every applicable `POL-*` policy to `FR-*` requirements and acceptance criteria.
- Check policy omissions, contradictions, invented behavior, MVP exclusions, user roles, permission boundaries, and error cases.
- Ensure unresolved OQ items remain explicit; do not decide them.

### Spec gate
- Compare Spec with the **approved** PRD, not just Claude's Plan.
- Verify requirement IDs, acceptance criteria, edge cases, error/authorization scenarios, and test traceability.
- Flag undocumented additions and unsupported assumptions.

### Plan gate
- Check whether proposed architecture, task order, data consistency, identity/authorization, concurrency, and validation can satisfy the approved Spec.
- Flag material technical risks and untestable plans; do not invent product policies.

### Code gate
- Compare implementation against approved Spec and acceptance criteria.
- Prioritize correctness, security/authorization, data integrity, concurrency, regressions, and missing tests over style.
- Distinguish observed defects from hypotheses. State exact verification performed; never imply tests ran if they did not.

## 3. Finding format

For each finding include:
- `ID` and `Severity`: BLOCKER / HIGH / MEDIUM / LOW
- `Source`: exact upstream policy/requirement/acceptance-criterion ID and version, if applicable
- `Location`: file path and line/range or exact document section
- `Evidence`: observed facts and reproduction/verification steps, when available
- `Impact`: user-facing or system consequence
- `Required outcome`: testable condition for resolution (suggestions may be included but do not dictate unsupported product decisions)

Do not flag personal formatting preferences as defects. Do not fabricate paths, line numbers, test results, or requirements. Label uncertainty clearly.

## 4. Verdict

Return exactly one overall verdict:
- `PASS`: required criteria verified with no blocking or high-severity unresolved issues; any residual medium/low issues and verification limits must be listed. PASS is a quality verdict, not user approval.
- `REVISE`: concrete issues can be corrected without new product decisions.
- `NEEDS_DECISION`: an unresolved product policy or scope decision prevents safe completion; identify exact question and options without deciding.
- `BLOCKED`: insufficient source access, unavailable required verification, or environment failure prevents an evidence-based verdict.

If both a fixable defect and a product decision exist, use `NEEDS_DECISION` and list fixable defects separately. If essential verification is unavailable, use `BLOCKED` rather than PASS.

## 5. Review output template

```text
Phase:
Upstream source(s) + version(s):
Artifact reviewed:
Review attempt: N/3
Verdict: PASS | REVISE | NEEDS_DECISION | BLOCKED
Checks performed:
Checks not performed / limitations:
Findings (with severity, source ID, location, evidence, impact, required outcome):
Unresolved questions:
Residual risks:
```

Never trigger the next phase or merge to `main` by yourself.
