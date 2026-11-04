#!/usr/bin/env bash
# Try a PUBLISHED release on a clean machine, using the real GitHub assets.
#
#   scripts/e2e-release.sh vX.Y.Z /path/to/previous/kaya /path/to/previous/kaya-web
#
# The previous release's binaries are installed into a sandbox (bubblewrap: an
# empty /usr/local, /var/kaya, /etc/systemd/system, a private HOME, no go and
# no git on PATH), then:
#   A. the PREVIOUS release's own updater is pointed at vX.Y.Z. It is the code
#      every existing install runs for its first update, so this is the true
#      "previous release -> new release" path.
#   B. the NEW updater runs `kaya update --force` against the same release. It
#      fetches, verifies (under the key built into the binary, no extra key) and
#      installs both binaries and refreshes the unit files.
#   C. one more `kaya update` must say it is current.
# Publish the release as a pre-release first (PRERELEASE=1 make release ...):
# KAYA_VERSION fetches it by tag, while installs that ask for "latest" are not
# offered it. Promote it afterwards with `gh release edit TAG --prerelease=false --latest`.
set -euo pipefail

TAG="${1:-}"; OLD_KAYA="${2:-}"; OLD_WEB="${3:-}"
[ -n "$TAG" ] && [ -x "$OLD_KAYA" ] && [ -x "$OLD_WEB" ] || { sed -n '2,/^set -e/p' "$0" | sed 's/^# \{0,1\}//;$d'; exit 2; }
command -v bwrap >/dev/null || { echo "bubblewrap (bwrap) is required"; exit 1; }
REPO="${KAYA_RELEASE_REPO:-ianclemence/kaya}"
ARCH="$(go env GOARCH)"
W="${E2E_DIR:-$HOME/.cache/kaya-e2e-release}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

rm -rf "$W"
mkdir -p "$W"/{box/usr-local/bin,box/var-kaya/.git,box/var-lib-kaya,box/systemd,box/home,shims,tools}
echo "== the published checksums, from GitHub (to compare what gets installed)"
gh release download "$TAG" -R "$REPO" -p checksums.txt -D "$W"
cat "$W/checksums.txt"

cp "$OLD_KAYA" "$W/box/usr-local/bin/kaya"; cp "$OLD_WEB" "$W/box/usr-local/bin/kaya-web"
chmod 755 "$W/box/usr-local/bin/"*
# .git: an install made by cloning the repository has a checkout, which the
# previous updater insists on finding.
for u in kaya kaya-web; do
  sed -e 's/__USER__/root/g;s/__GROUP__/root/g;s#__KAYA_DIR__#/var/kaya#g;s#__BIN_DIR__#/usr/local/bin#g' "$ROOT/$u.service.template" > "$W/box/systemd/$u.service"
  echo "# an older unit" >> "$W/box/systemd/$u.service"
done
printf '#!/bin/sh\nwhile [ "${1#-}" != "$1" ]; do shift; done\nexec "$@"\n' > "$W/shims/sudo"
printf '#!/bin/sh\ncase "$1" in --user) exit 1;; is-active) exit 3;; esac\nexit 0\n' > "$W/shims/systemctl"
chmod +x "$W/shims/"*
for t in sh bash env cat cmp cp rm mv mkdir install chmod mktemp date sleep head tail grep sed cut tr sort uniq wc ls readlink dirname basename sha256sum true false test ln; do
  p="$(command -v "$t" || true)"; [ -n "$p" ] && ln -sf "$p" "$W/tools/$t"
done
# CA certificates and DNS come from /etc, which the sandbox shares with the host.

cat > "$W/inner.sh" <<'INNER'
#!/bin/bash
set -uo pipefail
TAG="$1"; W="$2"
installed() { /usr/local/bin/kaya version 2>/dev/null | grep -o 'Kaya [^ ]*' | head -1 | cut -d' ' -f2; }
sum_of() { sha256sum "$1" | cut -d' ' -f1; }
want() { grep " $1\$" "$W/checksums.txt" | cut -d' ' -f1; }
ok=0; bad=0
check() { if eval "$2"; then echo "  PASS  $1"; ok=$((ok+1)); else echo "  FAIL  $1"; bad=$((bad+1)); fi; }
A="kaya_linux_$ARCH"; B="kaya-web_linux_$ARCH"
OLD="$(installed)"; OLD_WEB_SUM="$(sum_of /usr/local/bin/kaya-web)"

check "no go on this machine"  '! command -v go >/dev/null'
check "no git on this machine" '! command -v git >/dev/null'
echo "   starts at $OLD"

echo "-- A. the previous release's own updater, pointed at $TAG"
out="$(KAYA_VERSION="$TAG" /usr/local/bin/kaya update 2>&1)"; rc=$?
echo "$out" | sed 's/^/     | /' | cut -c1-160
check "it succeeds"                         '[ $rc -eq 0 ]'
check "kaya is now $TAG"                   '[ "$(installed)" = "$TAG" ]'
check "the installed kaya is byte-for-byte the published one" '[ "$(sum_of /usr/local/bin/kaya)" = "$(want $A)" ]'
echo "   (the previous updater only replaces kaya; the console is brought along in B)"

echo "-- B. the new updater, real signature, no extra key"
out="$(KAYA_VERSION="$TAG" KAYA_UPDATE_SANDBOX=1 /usr/local/bin/kaya update --force 2>&1)"; rc=$?
echo "$out" | sed 's/^/     | /' | cut -c1-160
check "it succeeds"                         '[ $rc -eq 0 ]'
check "the signature on checksums.txt was verified under the built-in key" 'echo "$out" | grep -q "Verified the signature"'
check "kaya matches the published checksum"      '[ "$(sum_of /usr/local/bin/kaya)" = "$(want $A)" ]'
check "kaya-web matches the published checksum"  '[ "$(sum_of /usr/local/bin/kaya-web)" = "$(want $B)" ]'
check "kaya-web actually changed"                '[ "$(sum_of /usr/local/bin/kaya-web)" != "$OLD_WEB_SUM" ]'
check "the unit files were refreshed"             '! grep -q "an older unit" /etc/systemd/system/kaya.service && ! grep -q "an older unit" /etc/systemd/system/kaya-web.service'
check "the service files point at the installed binary" 'grep -q "/usr/local/bin/kaya" /etc/systemd/system/kaya.service'
check "no staging files left"                     '[ -z "$(ls -d /tmp/kaya-rel-* 2>/dev/null)" ]'

echo "-- C. again"
out="$(KAYA_VERSION="$TAG" KAYA_UPDATE_SANDBOX=1 /usr/local/bin/kaya update 2>&1)"
check "says it is current"                  'echo "$out" | grep -q "Already current"'

echo; echo "passed: $ok  failed: $bad"
[ "$bad" -eq 0 ]
INNER
chmod +x "$W/inner.sh"

bwrap --bind / / --dev-bind /dev /dev --proc /proc --unshare-pid \
  --bind "$W/box/usr-local" /usr/local --bind "$W/box/var-kaya" /var/kaya \
  --bind "$W/box/var-lib-kaya" /var/lib/kaya --bind "$W/box/systemd" /etc/systemd/system \
  --tmpfs /tmp \
  --setenv HOME "$W/box/home" --setenv ARCH "$ARCH" --setenv PATH "$W/shims:$W/tools" \
  --setenv KAYA_SYSTEM_BIN_DIR /usr/local/bin \
  --chdir "$W/box/home" "$W/tools/bash" "$W/inner.sh" "$TAG" "$W"
