import os
import sys
import shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
EXTS = {
    '.java', '.js', '.ts', '.jsx', '.tsx', '.html', '.xml', '.css', '.scss', '.properties', '.md', '.txt', '.sh', '.py', '.yml', '.yaml'
}

def remove_comments_c_style(s):
    # Removes // line comments and /* block comments, avoiding text inside quotes and schemes like http://
    out = []
    i = 0
    n = len(s)
    in_dq = False
    in_sq = False
    in_block = False
    in_line = False
    escape = False
    while i < n:
        ch = s[i]
        nxt = s[i+1] if i+1<n else ''
        if in_block:
            if ch == '*' and nxt == '/':
                in_block = False
                i += 2
                continue
            else:
                i += 1
                continue
        if in_line:
            if ch == '\n':
                in_line = False
                out.append(ch)
            i += 1
            continue
        if escape:
            out.append(ch)
            escape = False
            i += 1
            continue
        if ch == '\\':
            # start escape in string
            out.append(ch)
            escape = True
            i += 1
            continue
        if in_dq:
            if ch == '"':
                in_dq = False
            out.append(ch)
            i += 1
            continue
        if in_sq:
            if ch == "'":
                in_sq = False
            out.append(ch)
            i += 1
            continue
        # not in string or comment
        if ch == '"':
            in_dq = True
            out.append(ch)
            i += 1
            continue
        if ch == "'":
            in_sq = True
            out.append(ch)
            i += 1
            continue
        # block comment start
        if ch == '/' and nxt == '*':
            in_block = True
            i += 2
            continue
        # line comment start: ensure not part of scheme like http:// (previous char not ':')
        if ch == '/' and nxt == '/':
            prev = out[-1] if out else ''
            if prev == ':' or prev == '/':
                # probably part of scheme or path, keep
                out.append(ch)
                i += 1
                continue
            # else start line comment
            in_line = True
            i += 2
            continue
        out.append(ch)
        i += 1
    return ''.join(out)


def remove_html_comments(s):
    out = []
    i = 0
    n = len(s)
    in_comment = False
    while i < n:
        if not in_comment and s.startswith('<!--', i):
            in_comment = True
            i += 4
            continue
        if in_comment and s.startswith('-->', i):
            in_comment = False
            i += 3
            continue
        if not in_comment:
            out.append(s[i])
        i += 1
    return ''.join(out)


def process_file(path):
    ext = os.path.splitext(path)[1].lower()
    if ext not in EXTS:
        return False
    with open(path, 'r', encoding='utf-8', errors='surrogateescape') as f:
        orig = f.read()
    new = orig
    if ext in {'.html', '.xml'}:
        new = remove_html_comments(orig)
        # remove // comments that start a line (JS inside script tags may have //)
        lines = []
        for line in new.splitlines(keepends=True):
            stripped = line.lstrip()
            if stripped.startswith('//'):
                # drop
                continue
            # remove trailing // comments if not in a scheme (avoid http://)
            if '//' in line:
                idx = line.find('//')
                # check char before
                if idx>0 and line[idx-1] != ':' and '"' not in line[:idx] and "'" not in line[:idx]:
                    line = line[:idx].rstrip() + '\n'
            lines.append(line)
        new = ''.join(lines)
    elif ext == '.md' or ext == '.txt' or ext == '.properties' or ext == '.yml' or ext == '.yaml' or ext == '.sh' or ext == '.py':
        # remove lines starting with # (after optional whitespace)
        lines = []
        for line in orig.splitlines(keepends=True):
            if line.lstrip().startswith('#'):
                continue
            lines.append(line)
        new = ''.join(lines)
    else:
        new = remove_comments_c_style(orig)
    if new != orig:
        bak = path + '.commentbak'
        if not os.path.exists(bak):
            shutil.copy2(path, bak)
        with open(path, 'w', encoding='utf-8', errors='surrogateescape') as f:
            f.write(new)
        return True
    return False


def main():
    changed = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        # skip target and node_modules
        if 'target' in dirpath.split(os.sep) or 'node_modules' in dirpath.split(os.sep) or '.git' in dirpath.split(os.sep):
            continue
        for fn in filenames:
            path = os.path.join(dirpath, fn)
            ext = os.path.splitext(fn)[1].lower()
            if ext in EXTS:
                try:
                    if process_file(path):
                        changed.append(path)
                except Exception as e:
                    print(f'ERROR processing {path}: {e}', file=sys.stderr)
    print('Modified files:')
    for c in changed:
        print(c)

if __name__ == '__main__':
    main()

