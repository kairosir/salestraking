#!/bin/sh
set -e

msg="${1:-chore: auto sync}"

git add -A

if git diff --cached --quiet; then
  echo "No changes to commit."
  exit 0
fi

git commit -m "$msg"
git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
