#!/usr/bin/env bash
# Runs every browser test against the files in this repo (no internet or real database needed:
# Supabase is replaced by tests/mock_supabase.js).
# Needs: node + playwright (npm i -D playwright exceljs && npx playwright install chromium)
cd "$(dirname "$0")"
fail=0
for t in *.test.js; do
  out=$(node "$t" 2>&1 | grep -E '^(PASS|FAIL|ERR)' )
  echo "$t  ${out//$'\n'/ | }"
  echo "$out" | grep -qE 'FAIL [1-9]|^FAIL|^ERR' && fail=1
done
exit $fail
