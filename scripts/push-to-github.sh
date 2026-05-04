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

PUSH_FLAGS=""
if [ "${ALLOW_FORCE_PUSH:-}" = "true" ]; then
  echo "WARNING: Force-pushing with --force-with-lease — remote history will be overwritten if no one else has pushed since your last fetch." >&2
  PUSH_FLAGS="--force-with-lease"
fi

echo "Pushing branch '$BRANCH' to GitHub ($REMOTE_URL)..."

# shellcheck disable=SC2086
if ! git -c "credential.helper=!f() { echo username=mlk1gh; echo password=${GITHUB_TOKEN}; }; f" \
  push $PUSH_FLAGS "$REMOTE_NAME" "$BRANCH"; then
  echo "" >&2
  echo "Push failed. The remote may have commits not present locally." >&2
  echo "To override (destructive — discards remote-only commits):" >&2
  echo "  ALLOW_FORCE_PUSH=true bash scripts/push-to-github.sh" >&2
  exit 1
fi

echo "Done. Latest commits are live on https://github.com/mlk1gh/gymassistR"
