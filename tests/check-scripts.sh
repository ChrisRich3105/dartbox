#!/bin/bash
# Static checks for everything that runs on the box: Python compiles, shell scripts parse,
# JSON is valid, VERSION looks like a version. Used by CI; runs on any machine with bash + python3.
set -u
cd "$(dirname "$0")/.."
fail=0
PY="${PYTHON:-python3}"
for f in bin/* lib/*.py; do
    if head -n1 "$f" | grep -q python || [[ "$f" == *.py ]]; then
        "$PY" -c 'import ast, sys; ast.parse(open(sys.argv[1], encoding="utf-8").read(), sys.argv[1])' "$f" \
            && echo "ok  python $f" || { echo "ERR python $f"; fail=1; }
    elif head -n1 "$f" | grep -q bash; then
        bash -n "$f" && echo "ok  bash   $f" || { echo "ERR bash   $f"; fail=1; }
    fi
done
for f in install.sh get.sh tests/*.sh; do
    bash -n "$f" && echo "ok  bash   $f" || { echo "ERR bash   $f"; fail=1; }
done
for f in kiosk-extension/manifest.json playroom/package.json; do
    "$PY" -c 'import json, sys; json.load(open(sys.argv[1]))' "$f" && echo "ok  json   $f" || { echo "ERR json   $f"; fail=1; }
done
grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$' VERSION && echo "ok  VERSION $(cat VERSION)" || { echo "ERR VERSION"; fail=1; }
if grep -rl $'\r' --include='*' bin lib install.sh get.sh systemd config >/dev/null 2>&1; then
    echo "ERR Windows line endings (CRLF) found:"; grep -rl $'\r' bin lib install.sh get.sh systemd config; fail=1
fi
exit $fail
