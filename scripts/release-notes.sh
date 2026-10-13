#!/usr/bin/env bash
# Prints Markdown release notes for a tag, built from the conventional-commit
# subjects since the previous tag. GitHub's generated notes list pull
# requests only, and this repo commits straight to main.
#
# Usage: scripts/release-notes.sh <tag>
set -euo pipefail

readonly REPO_URL='https://github.com/lyingpasta/nestjs-better-config'
readonly NPM_URL='https://www.npmjs.com/package/nestjs-better-config'
readonly RELEASE_COMMIT_PATTERN='^chore\(release\)'

previous_tag() {
  git describe --tags --abbrev=0 "$1^" 2>/dev/null || true
}

commit_subjects() {
  local range="$1"
  git log --format='%s' "$range" | grep -Ev "$RELEASE_COMMIT_PATTERN" || true
}

print_section() {
  local title="$1" subjects="$2"
  [ -z "$subjects" ] && return 0
  printf '### %s\n\n' "$title"
  printf '%s\n' "$subjects" | sed 's/^/- /'
  printf '\n'
}

main() {
  local tag="${1:?usage: release-notes.sh <tag>}"
  local previous range subjects
  previous="$(previous_tag "$tag")"
  range="${previous:+$previous..}$tag"
  subjects="$(commit_subjects "$range")"

  print_section 'Features' "$(grep -E '^feat' <<<"$subjects" || true)"
  print_section 'Fixes' "$(grep -E '^fix' <<<"$subjects" || true)"
  print_section 'Other changes' "$(grep -Ev '^(feat|fix)' <<<"$subjects" || true)"

  printf 'npm: %s/v/%s\n' "$NPM_URL" "${tag#v}"
  [ -n "$previous" ] && printf '\n**Full changelog**: %s/compare/%s...%s\n' \
    "$REPO_URL" "$previous" "$tag"
  return 0
}

main "$@"
