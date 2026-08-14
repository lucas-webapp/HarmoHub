#!/bin/bash
total_pass=0
total_fail=0
failed_files=()
for f in *_test.js; do
    out=$(node "$f" 2>&1)
    last=$(echo "$out" | grep -E '^=== [0-9]+ PASS / [0-9]+ FAIL ===' | tail -1)
    if [ -z "$last" ]; then
        echo "CRASH: $f"
        failed_files+=("$f (crash)")
        echo "$out" | tail -20
        continue
    fi
    p=$(echo "$last" | grep -oE '[0-9]+ PASS' | grep -oE '[0-9]+')
    fa=$(echo "$last" | grep -oE '[0-9]+ FAIL' | grep -oE '[0-9]+')
    total_pass=$((total_pass+p))
    total_fail=$((total_fail+fa))
    if [ "$fa" != "0" ]; then
        echo "FAIL in $f: $last"
        failed_files+=("$f")
    fi
done
echo ""
echo "=== TOTAL: $total_pass PASS / $total_fail FAIL across $(ls *_test.js | wc -l) suites ==="
if [ ${#failed_files[@]} -gt 0 ]; then
    echo "Failed files:"
    for f in "${failed_files[@]}"; do echo "  - $f"; done
fi
