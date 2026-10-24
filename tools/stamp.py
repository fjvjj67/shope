#!/usr/bin/env python3
"""Bump the ?v= cache-busting stamp on every css/js link in index.html.
Run this after editing any file in css/ or js/, before pushing:  python3 tools/stamp.py"""
import re, time, pathlib
p = pathlib.Path(__file__).resolve().parent.parent / 'index.html'
s = p.read_text(encoding='utf8')
v = time.strftime('%Y%m%d%H%M')
s2, n = re.subn(r'((?:css|js)/[\w.-]+\.(?:css|js))\?v=[\w_]+', r'\1?v=' + v, s)
p.write_text(s2, encoding='utf8')
print(f'stamped {n} files with v={v}')
