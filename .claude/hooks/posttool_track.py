#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PostToolUse tracker: records which repo files Edit/Write/NotebookEdit changed.

Stores only repo-relative paths, counts and the verification kinds they imply, in
a per-session, per-worktree state file outside the repository
(~/.claude/state/ddallang/, dir 0700, files 0600, entries older than 7 days are
removed). Never stores tool_response, file contents or commands. Silent on
success. Does not run tests. Errors go to stderr with exit 1 (non-blocking).

Limits: edits made through Bash (sed -i, redirects, formatters) are not seen;
use `git status` at Task end as the authoritative list.

CLI: posttool_track.py --summary   print state for the current worktree/session(s)
     posttool_track.py --clear     remove this worktree's state files
"""
import fcntl
import hashlib
import json
import os
import re
import sys
import time

STATE_DIR = os.path.join(os.path.expanduser("~"), ".claude", "state", "ddallang")
RETENTION_SECONDS = 7 * 24 * 3600
CODE_EXT = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css")


def kinds_for(rel):
    k = set()
    base = os.path.basename(rel)
    if rel.startswith(".claude/") or rel.startswith("scripts/"):
        k.add("script-check")
    if base in ("package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "turbo.json") or base.startswith("tsconfig") or ".config." in base:
        k.update(("build", "typecheck", "install-check"))
    elif rel.endswith(CODE_EXT):
        k.update(("typecheck", "lint", "test"))
        if re.search(r"\.(test|spec)\.", base):
            k.discard("typecheck")
    elif rel.startswith("docs/"):
        k.add("doc-consistency")
        if rel.startswith(("docs/policies/", "docs/prd/", "docs/specs/")):
            k.add("approved-doc-change-check")  # approved documents need change-control review
    return sorted(k)


def repo_root(start):
    d = os.path.realpath(start)
    while True:
        if os.path.exists(os.path.join(d, ".git")):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            return None
        d = parent


def state_path(session_id, root):
    sid = re.sub(r"[^A-Za-z0-9-]", "", session_id or "")[:64] or "nosession"
    wt = hashlib.sha1(root.encode("utf-8")).hexdigest()[:10]
    return os.path.join(STATE_DIR, "%s__%s.json" % (sid, wt))


def cleanup():
    marker = os.path.join(STATE_DIR, ".last_cleanup")
    now = time.time()
    try:
        if now - os.path.getmtime(marker) < 24 * 3600:
            return
    except OSError:
        pass
    for name in os.listdir(STATE_DIR):
        if not name.endswith((".json", ".json.lock")):
            continue
        p = os.path.join(STATE_DIR, name)
        try:
            if now - os.path.getmtime(p) > RETENTION_SECONDS:
                os.remove(p)
        except OSError:
            pass
    fd = os.open(marker, os.O_WRONLY | os.O_CREAT, 0o600)
    os.close(fd)
    os.utime(marker, None)


def ensure_dir():
    os.makedirs(STATE_DIR, mode=0o700, exist_ok=True)
    os.chmod(STATE_DIR, 0o700)


def record(data):
    tin = data.get("tool_input") or {}
    path = tin.get("file_path") or tin.get("notebook_path")
    if not path:
        return
    cwd = data.get("cwd") or os.getcwd()
    root = repo_root(cwd)
    if root is None:
        return
    ap = os.path.realpath(path if os.path.isabs(path) else os.path.join(cwd, path))
    ensure_dir()
    sp = state_path(data.get("session_id"), root)
    lock = os.open(sp + ".lock", os.O_WRONLY | os.O_CREAT, 0o600)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            with open(sp, encoding="utf-8") as f:
                st = json.load(f)
        except (OSError, ValueError):
            st = {"v": 1, "files": {}, "outside_repo": 0}
        if ap.startswith(root + os.sep):
            rel = os.path.relpath(ap, root)
            e = st["files"].setdefault(rel, {"n": 0, "kinds": kinds_for(rel)})
            e["n"] += 1
            e["last"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        else:
            st["outside_repo"] = st.get("outside_repo", 0) + 1  # path itself is not stored
        tmp = sp + ".tmp"
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(st, f, ensure_ascii=False)
        os.replace(tmp, sp)
        os.chmod(sp, 0o600)
    finally:
        fcntl.flock(lock, fcntl.LOCK_UN)
        os.close(lock)
    cleanup()


def summary(clear=False):
    root = repo_root(os.getcwd())
    if root is None or not os.path.isdir(STATE_DIR):
        print("no state")
        return
    wt = hashlib.sha1(root.encode("utf-8")).hexdigest()[:10]
    found = False
    for name in sorted(os.listdir(STATE_DIR)):
        if not name.endswith("__%s.json" % wt):
            continue
        p = os.path.join(STATE_DIR, name)
        if clear:
            os.remove(p)
            found = True
            continue
        with open(p, encoding="utf-8") as f:
            st = json.load(f)
        found = True
        allk = sorted({k for e in st["files"].values() for k in e["kinds"]})
        print("session %s: %d files, outside_repo=%d, verification: %s" % (name.split("__")[0][:8], len(st["files"]), st.get("outside_repo", 0), ", ".join(allk) or "-"))
        for rel, e in sorted(st["files"].items()):
            print("  %s x%d [%s]" % (rel, e["n"], ",".join(e["kinds"])))
    if not found:
        print("no state")
    elif clear:
        print("cleared")


def main():
    if len(sys.argv) > 1:
        summary(clear=sys.argv[1] == "--clear")
        return 0
    try:
        record(json.loads(sys.stdin.read()))
    except Exception as e:
        sys.stderr.write("posttool_track error: %s\n" % type(e).__name__)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
