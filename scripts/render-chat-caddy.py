#!/usr/bin/env python3
"""Render a replacement of the single chat site; preserve every other byte.

Usage: python3 scripts/render-chat-caddy.py CURRENT TEMPLATE > CANDIDATE
Validate CANDIDATE with Caddy before writing CURRENT in place (bind mount).
"""
import re
import sys
from pathlib import Path

def replace_chat_site(current: str, template: str) -> str:
    pattern = r"(?m)^marthi\.alexisrs\.dev\s*\{"
    matches = list(re.finditer(pattern, current))
    replacement_matches = list(re.finditer(pattern, template))
    if len(matches) > 1 or len(replacement_matches) != 1:
        raise ValueError("Expected exactly one chat site in template and at most one in current config")
    replacement = template[replacement_matches[0].start():].strip() + "\n"
    if not matches:
        return current + ("\n" if not current.endswith("\n") else "") + replacement
    start = matches[0].start()
    opening = current.index("{", start)
    depth = 0
    quoted = False
    escaped = False
    comment = False
    for index in range(opening, len(current)):
        character = current[index]
        if comment:
            if character == "\n":
                comment = False
            continue
        if escaped:
            escaped = False
            continue
        if quoted and character == "\\":
            escaped = True
            continue
        if character == '"':
            quoted = not quoted
            continue
        if quoted:
            continue
        if character == "#":
            comment = True
        elif character == "{":
            depth += 1
        elif character == "}":
            depth -= 1
            if depth == 0:
                end = index + 1
                if current[end:end + 1] == "\n":
                    end += 1
                return current[:start] + replacement + current[end:]
    raise ValueError("Unbalanced chat site; refusing to replace config")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: render-chat-caddy.py CURRENT TEMPLATE")
    sys.stdout.write(replace_chat_site(Path(sys.argv[1]).read_text(), Path(sys.argv[2]).read_text()))
