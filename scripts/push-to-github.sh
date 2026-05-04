#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-main}"
REMOTE_NAME="github"
REMOTE_URL="https://github.com/mlk1gh/gymassistR.git"

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "Error: GITHUB_TOKEN is not set." >&2
  echo "Add it as a secret in the Replit Secrets panel (repo scope), then re-run." >&2
  exit 1
fi

if ! git remote get-url "$REMOTE_NAME" &>/dev/null; then
  git remote add "$REMOTE_NAME" "$REMOTE_URL"
else
  git remote set-url "$REMOTE_NAME" "$REMOTE_URL"
fi

echo "Pushing branch '$BRANCH' to GitHub ($REMOTE_URL)..."

git -c "credential.helper=!f() { echo username=mlk1gh; echo password=${GITHUB_TOKEN}; }; f" \
  push "$REMOTE_NAME" "$BRANCH"

echo "Done. Latest commits are live on https://github.com/mlk1gh/gymassistR"
