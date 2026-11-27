#!/bin/sh
cd "$(dirname "$0")" || exit 1
python3 serve.py 2>/dev/null || xdg-open index.html 2>/dev/null
