"""Comment out SQL statements targeting tables that no migration ever creates.

The original hosted database had a 'corporate actions' feature (amalgamations,
corporate_actions, rights_issues, share_buybacks, share_subdivisions,
corporate_action_history) that was built via the dashboard and never captured in
a migration. Three RLS migrations manipulate policies on those tables, so they
cannot replay onto a fresh database. The app reads amalgamations from
scrip_entries and never touches the others, so the statements are dead.

Splits on ';' while respecting $$...$$ / $tag$...$tag$ bodies and quotes, so
function definitions are never broken.
"""
import re
import sys

PHANTOM = {
    "amalgamations",
    "corporate_actions",
    "corporate_action_history",
    "rights_issues",
    "share_buybacks",
    "share_subdivisions",
}

# Statement forms that name a table directly.
TARGET = re.compile(
    r"""(?isx)
    (?: \bON \s+ (?:public\.)? (?P<on>[a-z_]+) \b
      | \bALTER \s+ TABLE \s+ (?:IF \s+ EXISTS \s+)? (?:public\.)? (?P<alter>[a-z_]+) \b
    )""",
)


def split_statements(sql: str):
    """Yield (text, is_statement) chunks, splitting on top-level semicolons."""
    out, buf, i, n = [], [], 0, len(sql)
    tag = None  # active dollar-quote tag
    while i < n:
        ch = sql[i]
        if tag:
            if sql.startswith(tag, i):
                buf.append(tag)
                i += len(tag)
                tag = None
                continue
            buf.append(ch)
            i += 1
            continue
        m = re.match(r"\$[a-zA-Z_]*\$", sql[i:])
        if m:
            tag = m.group(0)
            buf.append(tag)
            i += len(tag)
            continue
        if ch == "'":  # single-quoted literal, '' escapes
            buf.append(ch)
            i += 1
            while i < n:
                buf.append(sql[i])
                if sql[i] == "'":
                    if i + 1 < n and sql[i + 1] == "'":
                        buf.append(sql[i + 1])
                        i += 2
                        continue
                    i += 1
                    break
                i += 1
            continue
        if ch == "-" and sql.startswith("--", i):  # line comment
            j = sql.find("\n", i)
            j = n if j == -1 else j + 1
            buf.append(sql[i:j])
            i = j
            continue
        if ch == "/" and sql.startswith("/*", i):  # block comment
            j = sql.find("*/", i)
            j = n if j == -1 else j + 2
            buf.append(sql[i:j])
            i = j
            continue
        if ch == ";":
            buf.append(ch)
            out.append("".join(buf))
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    if buf:
        out.append("".join(buf))
    return out


def phantom_target(stmt: str):
    """Return the phantom table this statement targets, if any."""
    # Ignore leading comments so a comment mentioning a table doesn't count.
    body = re.sub(r"(?s)/\*.*?\*/", " ", stmt)
    body = re.sub(r"(?m)^\s*--.*$", " ", body)
    if not body.strip():
        return None
    for m in TARGET.finditer(body):
        name = m.group("on") or m.group("alter")
        if name in PHANTOM:
            return name
    return None


def main(path: str) -> int:
    original = open(path, encoding="utf-8").read()
    chunks = split_statements(original)
    removed, result = 0, []
    for chunk in chunks:
        table = phantom_target(chunk)
        if table is None:
            result.append(chunk)
            continue
        removed += 1
        commented = "\n".join("-- " + ln for ln in chunk.strip("\n").split("\n"))
        result.append(
            f"\n-- [no-op on self-hosted: table '{table}' is not created by any"
            f" migration]\n{commented}\n"
        )
    open(path, "w", encoding="utf-8", newline="").write("".join(result))
    print(f"{path}: commented out {removed} statement(s)")
    return 0


if __name__ == "__main__":
    for p in sys.argv[1:]:
        main(p)
