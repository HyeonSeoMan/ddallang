#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PreToolUse guard: a mistake-prevention aid, NOT a sandbox or a security boundary.

Denies a short, explicit list of clearly recognizable commands (git push, reset --hard,
clean -f, branch delete, commit/merge on main, gh pr merge / repo create|delete, sudo,
obviously destructive rm -r, disk tools) and reads/writes of sensitive files by name
(.env, keys, ~/.ssh, ~/.aws, ...). Everything else passes silently (no output, exit 0).

It looks at each simple command of a Bash line (quotes respected; split at ; & | ( ) and
newlines). It does NOT follow cd, subshells, variables, globs, wrappers (env/command/xargs),
`bash -c`, `$(...)`, aliases, scripts or interpreters. Those bypass it; see
.claude/hooks/README.md. permissions.deny in settings.json is a second, partly overlapping layer.

Fail-closed only for the hook's own input: unreadable JSON or an internal error denies.
A Bash line that shlex cannot tokenize is allowed (no analysis), so normal commands
are not blocked.
"""
import json
import os
import re
import shlex
import subprocess
import sys

GATE_HINT = "승인 게이트: 사용자가 별도 터미널에서 직접 실행하세요."
MAIN_BRANCHES = ("main", "master")
SAFE_ENV_SUFFIXES = (".example", ".sample", ".template", ".dist")
# Programs that print or transmit file contents when given a path operand.
READERS = {
    "cat", "head", "tail", "less", "more", "bat", "nl", "tac", "od", "xxd", "strings", "base64",
    "grep", "egrep", "fgrep", "rg", "sed", "awk", "cut", "sort", "tee",
    "cp", "scp", "rsync", "curl", "wget", "openssl", "pbcopy", "open",
}
GREPS = {"grep", "egrep", "fgrep", "rg"}
GREP_QUIET = {"-l", "-L", "-c", "-q", "--files-with-matches", "--files-without-match", "--count", "--quiet"}
# grep/rg options that take a value; that value is not the pattern or a file.
GREP_VALUE_OPTS = {"-m", "-A", "-B", "-C", "-g", "-t", "-T", "-j", "--glob", "--type", "--max-count", "--include", "--exclude", "--max-depth"}
TEMP_ROOTS = ("/tmp", "/private/tmp", "/var/folders", "/private/var/folders")


class Deny(Exception):
    pass


# ---------------------------------------------------------------- tokenizing

def _strip_heredocs(cmd):
    """Drop heredoc bodies so message text is not mistaken for commands."""
    out, lines, i = [], cmd.split("\n"), 0
    while i < len(lines):
        out.append(lines[i])
        m = re.search(r"(?<!<)<<-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1", lines[i])
        i += 1
        if m:
            while i < len(lines) and lines[i].strip() != m.group(2):
                i += 1
            if i < len(lines):
                out.append(lines[i])
                i += 1
    return "\n".join(out)


def _newlines_to_semicolons(cmd):
    """Turn unquoted newlines into ';' so they separate commands."""
    out, quote, esc = [], None, False
    for ch in cmd:
        if esc:
            esc = False
        elif ch == "\\" and quote != "'":
            esc = True
        elif quote:
            if ch == quote:
                quote = None
        elif ch in "'\"":
            quote = ch
        elif ch == "\n":
            ch = " ; "
        out.append(ch)
    return "".join(out)


# A quoted token made only of separator characters (printf "%s" ";") is data, not a separator.
_QUOTED_SEP = re.compile(r"(?<!\S)([\"'])([;&|()]+)\1(?!\S)")
_SEP_UNMASK = {"\x01a": ";", "\x01b": "&", "\x01c": "|", "\x01d": "(", "\x01e": ")"}
_SEP_MASK = {v: k for k, v in _SEP_UNMASK.items()}


def _unmask(tok):
    return re.sub("\x01[a-e]", lambda m: _SEP_UNMASK[m.group(0)], tok)


def split_commands(cmd):
    """Simple commands as token lists. Returns [] if the line cannot be tokenized."""
    try:
        text = _QUOTED_SEP.sub(lambda m: "".join(_SEP_MASK[ch] for ch in m.group(2)), _newlines_to_semicolons(_strip_heredocs(cmd)))
        lex = shlex.shlex(text, posix=True, punctuation_chars=True)
        lex.whitespace_split = True
        toks = list(lex)
    except ValueError:
        return []
    segs, cur = [], []
    for t in toks:
        if re.fullmatch(r"[;&|()]+", t):
            if cur:
                segs.append(cur)
            cur = []
        else:
            cur.append(_unmask(t))
    if cur:
        segs.append(cur)
    return segs


def _drop_redirects(tokens):
    """Remove output redirections (> >> >&) with their target; '<' is dropped, its target stays an operand."""
    out, skip = [], False
    for t in tokens:
        if skip:
            skip = False
        elif re.fullmatch(r"[<>]+&?", t):
            skip = t.startswith(">")
        else:
            out.append(t)
    return out


# ---------------------------------------------------------------- paths

def _resolve(path, cwd):
    p = path.strip()
    if p.startswith("@"):
        p = p[1:]
    if "=@" in p:
        p = p.split("=@", 1)[1]
    if not p or p.startswith("-") or "://" in p:
        return None
    p = os.path.expanduser(os.path.expandvars(p))
    if not os.path.isabs(p):
        p = os.path.join(cwd, p)
    try:
        return os.path.realpath(p)
    except Exception:
        return os.path.normpath(p)


def is_sensitive(path, cwd, for_write=False):
    """Sensitive by name/location (symlinks resolved). .env style files are sensitive for
    reading only: writing config such as .env.local stays allowed."""
    rp = _resolve(path, cwd)
    if not rp:
        return False
    base = os.path.basename(rp)
    low = base.lower()
    parts = rp.split(os.sep)
    if low == ".env" or (low.startswith(".env.") and not low.endswith(SAFE_ENV_SUFFIXES)):
        return not for_write
    if low.endswith((".pem", ".key", ".p12", ".pfx", ".jks", ".keystore")):
        return True
    if low.startswith(("id_rsa", "id_dsa", "id_ecdsa", "id_ed25519")) and not low.endswith(".pub"):
        return True
    if low in (".netrc", ".git-credentials", ".pypirc", ".npmrc") and rp.startswith(os.path.expanduser("~") + os.sep):
        return True
    if ".ssh" in parts and not low.endswith(".pub") and low not in ("known_hosts", "config"):
        return True
    if any(d in parts for d in (".aws", ".gnupg")):
        return True
    return False


# ---------------------------------------------------------------- rules

def _git(args, d):
    return subprocess.run(["git", "-C", d] + args, capture_output=True, text=True, timeout=2)


def _branch(cwd, opts):
    d = cwd
    for k, a in enumerate(opts):
        if a == "-C" and k + 1 < len(opts):
            d = os.path.join(d, opts[k + 1])
    try:
        return _git(["symbolic-ref", "--short", "-q", "HEAD"], d).stdout.strip()
    except Exception:
        return ""


def check_segment(tokens, cwd):
    tokens = _drop_redirects(tokens)
    while tokens and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", tokens[0]):
        tokens = tokens[1:]
    if not tokens:
        return
    prog, args = os.path.basename(tokens[0]), tokens[1:]

    if prog in ("sudo", "doas", "su"):
        raise Deny("권한 상승 명령(%s)은 승인 없이 실행할 수 없습니다. %s" % (prog, GATE_HINT))
    if prog == "git":
        _check_git(args, cwd)
    elif prog == "gh":
        a = [x for x in args if not x.startswith("-")]
        if a[:2] == ["pr", "merge"]:
            raise Deny("gh pr merge는 승인 게이트입니다. " + GATE_HINT)
        if a[:2] in (["repo", "create"], ["repo", "delete"]):
            raise Deny("저장소 생성·삭제는 승인 게이트입니다. " + GATE_HINT)
    elif prog == "rm":
        _check_rm(args, cwd)
    elif prog == "dd" and any(a.startswith("of=/dev/") for a in args):
        raise Deny("블록 장치에 쓰는 dd는 차단됩니다.")
    elif prog.startswith("mkfs") or prog == "shred" or (prog == "diskutil" and any(a.startswith(("erase", "partitionDisk", "secureErase")) for a in args)):
        raise Deny("디스크·파일 파괴 명령은 차단됩니다. " + GATE_HINT)
    elif prog == "security" and any(a.startswith(("find-generic-password", "find-internet-password", "dump-keychain")) for a in args):
        raise Deny("키체인 조회는 차단됩니다.")
    if prog in READERS:
        _check_reader(prog, args, cwd)


def _check_git(args, cwd):
    k, opts = 0, []
    while k < len(args) and args[k].startswith("-"):
        step = 2 if args[k] in ("-C", "-c", "--git-dir", "--work-tree", "--namespace") else 1
        opts += args[k:k + step]
        k += step
    if k >= len(args):
        return
    sub, rest = args[k], args[k + 1:]
    short = [a for a in rest if re.match(r"^-[a-zA-Z]+$", a)]
    if sub == "push":
        raise Deny("git push는 승인 게이트입니다. " + GATE_HINT)
    if sub == "reset" and "--hard" in rest:
        raise Deny("git reset --hard는 작업 내용을 잃을 수 있어 차단됩니다. 필요하면 사용자가 직접 실행하세요.")
    if sub == "clean" and (any("f" in a for a in short) or "--force" in rest) and not (any("n" in a for a in short) or "--dry-run" in rest):
        raise Deny("git clean -f는 추적되지 않는 파일을 삭제하므로 차단됩니다. 먼저 -n으로 확인하세요.")
    if sub == "branch" and (any(re.search(r"[dD]", a) for a in short) or "--delete" in rest):
        raise Deny("브랜치 삭제(git branch -d/-D)는 사용자 승인 사항입니다.")
    if sub in ("commit", "merge", "rebase", "cherry-pick", "revert") and "--dry-run" not in rest and _branch(cwd, opts) in MAIN_BRANCHES:
        raise Deny("현재 브랜치가 main/master라 git %s는 승인 게이트입니다. 작업 브랜치로 전환하세요. %s" % (sub, GATE_HINT))
    if sub == "add":
        for a in rest:
            if not a.startswith("-") and is_sensitive(a, cwd):
                raise Deny("민감 파일(%s)을 스테이징할 수 없습니다." % os.path.basename(a))


def _check_rm(args, cwd):
    if not any(a == "--recursive" or (re.match(r"^-[a-zA-Z]+$", a) and re.search(r"[rR]", a)) for a in args):
        return
    home = os.path.realpath(os.path.expanduser("~"))
    cw = os.path.realpath(cwd)
    for t in (a for a in args if a != "--" and not a.startswith("-")):
        rp = _resolve(t, cwd)
        bad = t in ("*", "/*", ".*", "~/*")
        if rp:
            inside = rp.startswith(cw + os.sep) or any(rp.startswith(r + os.sep) for r in TEMP_ROOTS)
            bad = bad or rp in ("/", home) or rp == cw or cw.startswith(rp + os.sep) or ".git" in rp.split(os.sep) or not inside
        if bad:
            raise Deny("rm -r 대상(%s)이 작업 디렉터리·그 상위·홈·.git이거나 작업 트리·임시 디렉터리 밖이라 차단됩니다. 빌드 산출물(node_modules, .next, dist 등)은 허용됩니다." % t)


def _grep_operands(args):
    """Operands of grep/rg without the pattern and option values."""
    pos, skip, has_pattern_opt = [], False, False
    for a in args:
        if skip:
            skip = False
        elif a in ("-e", "--regexp", "-f", "--file"):
            has_pattern_opt, skip = True, a in ("-e", "--regexp")
            if a in ("-f", "--file"):
                skip = False  # the value is a file operand and stays checked
        elif a.startswith("--regexp="):
            has_pattern_opt = True
        elif a.startswith("--file="):
            has_pattern_opt = True
            pos.append(a.split("=", 1)[1])
        elif a in GREP_VALUE_OPTS:
            skip = True
        elif a.startswith("-") and a != "-":
            continue
        else:
            pos.append(a)
    return pos if has_pattern_opt else pos[1:]


def _check_reader(prog, args, cwd):
    if prog in GREPS:
        if any(a in GREP_QUIET for a in args):
            return
        operands = _grep_operands(args)
    else:
        operands = args
    for a in operands:
        for cand in (a, a.split("@", 1)[1] if "@" in a else a):  # curl -d@file
            if is_sensitive(cand, cwd):
                raise Deny("민감 파일(%s)의 내용을 읽거나 전송할 수 없습니다. 키 이름만 필요하면 `grep -c`/`grep -l`로 존재만 확인하거나 사용자에게 요청하세요." % os.path.basename(cand))


# ---------------------------------------------------------------- entry

def decide(data):
    tool = data.get("tool_name", "")
    tin = data.get("tool_input") or {}
    cwd = data.get("cwd") or os.getcwd()
    if tool == "Bash":
        for seg in split_commands(tin.get("command", "") or ""):
            check_segment(seg, cwd)
    elif tool == "Read":
        p = tin.get("file_path", "")
        if p and is_sensitive(p, cwd):
            raise Deny("민감 파일(%s)은 읽을 수 없습니다. 키 이름만 필요하면 사용자에게 요청하세요." % os.path.basename(p))
    elif tool in ("Write", "Edit", "NotebookEdit"):
        p = tin.get("file_path") or tin.get("notebook_path") or ""
        if p and is_sensitive(p, cwd, for_write=True):
            raise Deny("자격 증명·키 파일(%s)은 수정할 수 없습니다." % os.path.basename(p))


def emit(decision, reason):
    sys.stdout.write(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse", "permissionDecision": decision, "permissionDecisionReason": reason}}, ensure_ascii=False))
    sys.stdout.flush()


def main():
    try:
        data = json.loads(sys.stdin.read())
        decide(data)
    except Deny as e:
        emit("deny", str(e))
    except Exception as e:  # fail closed on the hook's own errors
        emit("deny", "가드 오류로 호출을 차단했습니다(%s). .claude/hooks/pretool_guard.py를 확인하세요." % type(e).__name__)
    return 0


if __name__ == "__main__":
    sys.exit(main())
