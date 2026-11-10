# Project hooks (Claude Code)

Files: `pretool_guard.py` (PreToolUse), `posttool_track.py` (PostToolUse), `test_hooks.py`. Registered in `.claude/settings.json`. No model calls; Python 3 standard library only. They do not touch or replace the global Orca hooks in `~/.claude/settings.json`; Claude Code runs both sets.

**The guard is a mistake-prevention aid, not a sandbox and not a security boundary.** It catches plain, clearly written commands that Claude might run by mistake. Anyone (or any model) who writes the same command differently can get past it. Approval gates (push, merge, repo creation) stay with the user either way.

## PreToolUse guard
Matcher `Bash|Read|Write|Edit|NotebookEdit`, timeout 5 s. A pass prints nothing (about 20-30 ms per call). Unreadable hook input or an internal error denies (fail closed). A Bash line that cannot be tokenized (e.g. unbalanced quote) is not analyzed and passes.

For Bash it examines each simple command of the line (quotes respected; split at `; & | ( )` and newlines; heredoc bodies ignored) and denies only these:

- **git:** `push`; `reset --hard`; `clean -f` (not with `-n`); branch delete (`branch -d|-D|--delete`); `commit|merge|rebase|cherry-pick|revert` while the repo's current branch (at the hook's working directory, or `-C <dir>`) is `main`/`master`; `add` of a sensitive file.
- **gh:** `pr merge`, `repo create|delete`.
- **destructive:** `sudo`/`doas`/`su`; `rm -r` of `/`, home, `*`, the working directory or its ancestors, anything with a `.git` component, or any path outside the working directory and temp dirs (build output inside the tree such as `node_modules`, `.next`, `dist` is allowed); `dd of=/dev/*`, `mkfs*`, `shred`, `diskutil erase*`; keychain password lookups.
- **sensitive files:** a sensitive path given as an operand to a content reader (`cat`, `head`, `tail`, `less`, `grep`/`rg`, `sed`, `awk`, `cp`, `curl`, `base64`, ...), including `< file`, `cat<file`, `curl -d@file`, `-F x=@file`. For `grep`/`rg` the pattern is not treated as a file (`rg -n '.env' README.md` passes); the pattern is the first operand, or the value of `-e`/`--regexp=`; the operand of `-f`/`--file=` is checked as a file. Other spellings (e.g. `-eKEY`, `-fFILE`) are not modeled. `grep -c/-l/-q` are allowed. A quoted separator-only token such as `";"` is data, not a separator.

For `Read`, `Write`, `Edit`, `NotebookEdit` it denies **sensitive paths only**: `.env` and `.env.*` (except `.example/.sample/.template/.dist`; writing `.env*` config is allowed), `*.pem`, `*.key`, `*.p12`, SSH private keys, `~/.ssh`, `~/.aws`, `~/.gnupg`, `.netrc`, `.git-credentials`. Symlinks are resolved first. **It does not block reads or writes of ordinary files outside the project**; Claude Code's own permission prompts decide those.

The decision does not depend on `permission_mode`. Runtime verification in a real Claude Code session: see "Runtime check" below.

### permissions.deny (second layer)
`settings.json` keeps a short deny list that overlaps the guard (push, reset --hard, clean -f, `gh pr merge`, `gh repo create|delete`, `sudo`, `Read` of `.env`, `.env.local`, `.env.production`, `~/.ssh`, `~/.aws`, `*.pem`). It is native to Claude Code and survives a hook failure, but matches by command prefix, so it has similar evasion gaps.

## Known limits (not blocked; do not rely on the guard for these)
- Anything built from variables, aliases, functions, encodings, or `$(...)`/backticks: `F=.env; cat $F`, `` cat `echo .env` ``.
- Wrappers and nested shells: `env git push`, `command git push`, `xargs ...`, `bash -c '...'`, `sh -lc '...'`, `eval`.
- Control flow that hides the command from the split: `if true; then git push; fi`.
- Directory and branch changes inside one line: the guard does not follow `cd ` or subshells (`cd .. && rm -rf <project>` is judged against the original directory), and the current branch is read once before the line runs (`git switch main && git commit`).
- Globs and recursion: glob patterns such as `cat .en[v]` or `cat .e*`, and `grep -R KEY .` over a tree that contains `.env`.
- Scripts and interpreters: `python -c`, `node -e`, `make`, `./script.sh`, `pnpm run <script that pushes>`; `find -exec`/`-delete`, `xargs`.
- HTTP writes (`curl -X DELETE https://api.github.com/...`, `gh api -X ...`), `git branch -f main`, `git update-ref`, `git add -A` staging a secret that is not gitignored.
- `curl -o` or other writes into sensitive paths by a reader, dumping the environment (`env`, `printenv`), secrets in paths the name rules do not know.
- Grep/Glob tools on secret paths (only the `Read(...)` deny rules cover them, best effort).
- A user-typed `!` command is not a tool call and is not governed by these hooks; it is not an approval path either. Claude can still edit `.claude/settings.json` and the hook files.

Passing `test_hooks.py` means the guard does what is listed above. It does not mean a command is safe.

## Approval gates stay with the user
After approval, the user runs push/merge/repo creation in a **separate terminal**; Claude does not run them. Claude prepares the exact commands and branch state, and reports them.

## PostToolUse tracker
Matcher `Edit|Write|NotebookEdit`. Records only repo-relative paths, edit counts, and implied verification kinds (`typecheck`, `lint`, `test`, `build`, `install-check`, `doc-consistency`, `approved-doc-change-check`, `script-check`) in `~/.claude/state/ddallang/<session>__<worktree>.json` (dir 0700, files 0600, entries older than 7 days removed daily). Paths outside the repo are counted, never stored. No `tool_response`, contents, or commands are stored. Silent on success; stderr and exit 1 on error (non-blocking). Edits made through Bash are not seen; use `git status`. It never runs tests.
`python3 .claude/hooks/posttool_track.py --summary | --clear`

## Tests
`python3 -B .claude/hooks/test_hooks.py` (mock stdin only; nothing dangerous is executed). Tests that need scratch files use `$HOOK_TEST_TMP` if set, else the system temp dir; with no writable directory (e.g. a read-only sandbox) they are reported as skipped and the stdin-only guard tests still run.

## Runtime check
Checked once on 2026-11-10 with Claude Code 2.1.309 (`claude -p`, throwaway git repo with a fake `.env`, no remote), hook alone (no `permissions` block):
- Denied with the hook's message, in both `default` and `--dangerously-skip-permissions` (bypass) modes: `git push origin HEAD`, `git reset --hard`, `cat .env`, `sudo -n true`. `git status --short` ran normally. The fake secret never appeared in any output.
- `Read .env` and `Write keys/test.pem` were denied by the hook; `Write notes.txt` succeeded and `keys/test.pem` was not created.
- With the user-level (Orca) settings loaded as well (default setting sources), `git status` ran and `git push` was denied.

`permissions.deny` alone (no hook), same environment: `Read .env` and `git push` denied, `Read .env.example` and `git status` allowed. Side effect: `ls .env` is also refused by that layer (over-blocking).

Not checked at runtime: the other denied commands in the list, any bypass listed under "Known limits", other Claude Code versions, and concurrency with other hooks beyond the Orca settings above. Re-run after a Claude Code upgrade.
