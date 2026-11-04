#!/usr/bin/env bash
# Build, sign, verify and (optionally) publish a Kaya release.
#
#   scripts/release.sh v0.24.106              build and verify only (writes dist/v0.24.106/)
#   scripts/release.sh v0.24.106 --publish    also tag, push the tag and create the GitHub release
#   PRERELEASE=1 scripts/release.sh v0.24.106 --publish
#       publish as a pre-release: installs are not offered it, but
#       KAYA_VERSION=v0.24.106 kaya update can fetch it, so it can be tried on
#       a clean machine first. Promote it with:
#       gh release edit v0.24.106 --prerelease=false --latest
#
# A release is: kaya and kaya-web for linux/arm64 and linux/amd64, a
# checksums.txt, and checksums.txt.sig (one signature over the checksum list,
# which binds every binary). `kaya update` refuses a release that is missing
# any of it, so this script checks its own output the way the updater will
# before it publishes anything. The only signature asset is named after the
# checksum list, never after a binary: older updaters find a binary by a
# substring of its name and must not be able to land on a signature.
#
# The signing key is read from $KAYA_RELEASE_KEY (default
# ~/.config/kaya-release/release.key). It is made once with
# `kaya-release keygen <file>` and its public half is built into the binary
# (embeddedReleaseKeys in cmd/kaya/update_release.go). Back the key file up:
# without it nobody can publish an update that existing installs will accept.
set -euo pipefail

VERSION="${1:-}"
PUBLISH=0
[ "${2:-}" = "--publish" ] && PUBLISH=1
KEY="${KAYA_RELEASE_KEY:-$HOME/.config/kaya-release/release.key}"
REPO_SLUG="${KAYA_RELEASE_REPO:-ianclemence/kaya}"
ARCHES="${KAYA_RELEASE_ARCHES:-arm64 amd64}"

die() { echo "release: $*" >&2; exit 1; }

[[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "usage: scripts/release.sh vMAJOR.MINOR.PATCH [--publish]"
cd "$(dirname "$0")/.."

[ -f "$KEY" ] || die "no signing key at $KEY (make one with: go run ./cmd/kaya-release keygen $KEY)"
[ -z "$(git status --porcelain)" ] || die "the working tree has uncommitted changes; a release is built from a commit"

NUM="${VERSION#v}"
grep -q "^## \[$NUM\]" pkg/changelog/CHANGELOG.md || die "pkg/changelog/CHANGELOG.md has no entry for $NUM"

if [ "$PUBLISH" = 1 ]; then
  git fetch -q origin
  git merge-base --is-ancestor HEAD origin/"$(git branch --show-current)" || die "HEAD is not pushed; push it first, the tag must point at a commit users can fetch"
  if git rev-parse -q --verify "refs/tags/$VERSION" >/dev/null; then
    [ "$(git rev-parse "$VERSION^{commit}")" = "$(git rev-parse HEAD)" ] || die "tag $VERSION exists but points at a different commit"
  fi
fi

if [ "${SKIP_TESTS:-0}" != 1 ]; then
  echo "== build, vet, test"
  go build ./...
  go vet ./...
  go test ./... -count=1
fi

OUT="dist/$VERSION"
rm -rf "$OUT"
mkdir -p "$OUT"

echo "== build $VERSION"
for arch in $ARCHES; do
  for bin in kaya kaya-web; do
    name="${bin}_linux_${arch}"
    CGO_ENABLED=0 GOOS=linux GOARCH="$arch" \
      go build -trimpath -ldflags "-s -w -X main.version=$VERSION" -o "$OUT/$name" "./cmd/$bin"
    echo "   $name"
  done
done

echo "== checksums and signatures"
go build -o "$OUT/.kaya-release" ./cmd/kaya-release
FILES=("$OUT"/kaya_linux_* "$OUT"/kaya-web_linux_*)
"$OUT/.kaya-release" checksums "$OUT/checksums.txt" "${FILES[@]}"
"$OUT/.kaya-release" sign "$KEY" "$OUT/checksums.txt"

echo "== verify exactly as 'kaya update' will"
PUB="$(grep -o 'embeddedReleaseKeys = "[^"]*"' cmd/kaya/update_release.go | cut -d'"' -f2)"
[ -n "$PUB" ] || die "could not read the embedded release key"
"$OUT/.kaya-release" verify "$OUT/checksums.txt" "$PUB" "${FILES[@]}" \
  || die "the signatures do not verify under the key built into kaya: wrong signing key?"

# The binary that will run on this machine must report the version it is released as.
NATIVE="$(go env GOARCH)"
if [ -x "$OUT/kaya_linux_$NATIVE" ] && [ "$(go env GOOS)" = linux ]; then
  got="$("$OUT/kaya_linux_$NATIVE" version | grep -o 'Kaya [^ ]*' | head -1 | cut -d' ' -f2)"
  [ "$got" = "$VERSION" ] || die "the built binary says $got, expected $VERSION"
  echo "   kaya_linux_$NATIVE reports $got"
fi
rm -f "$OUT/.kaya-release"

if [ "$PUBLISH" != 1 ]; then
  echo "== built and verified in $OUT (not published; add --publish)"
  exit 0
fi

echo "== publish $VERSION"
NOTES="$(mktemp)"
trap 'rm -f "$NOTES"' EXIT
sed -n "/^## \[$NUM\]/,/^## \[/p" pkg/changelog/CHANGELOG.md | sed '1d;$d' > "$NOTES"
[ -s "$NOTES" ] || die "the changelog entry for $NUM is empty"
git rev-parse -q --verify "refs/tags/$VERSION" >/dev/null || git tag "$VERSION"
git push -q origin "$VERSION"
if [ "${PRERELEASE:-0}" = 1 ]; then CHANNEL=(--prerelease); else CHANNEL=(--latest); fi
gh release create "$VERSION" -R "$REPO_SLUG" --title "Kaya $VERSION" "${CHANNEL[@]}" --notes-file "$NOTES" \
  "$OUT"/kaya_linux_* "$OUT"/kaya-web_linux_* "$OUT/checksums.txt" "$OUT/checksums.txt.sig"
echo "== published: https://github.com/$REPO_SLUG/releases/tag/$VERSION"

# Each release leaves ~120 MB of signed binaries behind, and the Pod has a
# small card. Keep the two most recent versions for rollback and drop the
# rest; never touch $OUT itself.
echo "== prune old release builds"
ls -1dt dist/v* 2>/dev/null | tail -n +3 | while read -r old; do
  [ "$old" = "$OUT" ] && continue
  echo "   removing $old"
  rm -rf "$old"
done

# The build cache is ~1.8 GB after a release. Clearing it on a healthy machine
# only makes the next build slow; clear it when the card is actually tight.
USE="$(df -P . | awk 'NR==2 {gsub("%","",$5); print $5}')"
if [ "${USE:-0}" -ge 85 ]; then
  echo "== disk at ${USE}%: clearing the Go build cache"
  go clean -cache || true
fi
