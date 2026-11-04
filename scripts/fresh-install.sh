#!/usr/bin/env bash
# Fresh-install dry run: run the real setup.sh against empty install roots.
#
#   scripts/fresh-install.sh install   # phase 1: setup.sh on a blank machine (no network)
#   scripts/fresh-install.sh install-online   # same, with the network (downloads speech engines)
#   scripts/fresh-install.sh shell CMD # run CMD inside the same blank machine
#   scripts/fresh-install.sh clean
#
# A private mount namespace (bwrap) puts empty directories over /usr/local,
# /var/kaya, /var/lib/kaya and /etc/systemd/system, so nothing on the real
# machine is read or written. sudo, systemctl and the package managers are
# shims. Phase 1 has no network on purpose: whatever setup.sh downloads
# best-effort must fail soft, exactly as on a Pod with bad wifi.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; W=/tmp/kaya-fresh
prep() {
  mkdir -p $W/usr-local $W/var-kaya $W/var-lib-kaya $W/systemd $W/home $W/shims $W/src
  for s in sudo systemctl apt-get apt pip3 ufw ollama journalctl; do
    case $s in
      sudo) printf '#!/bin/sh\nwhile [ "${1#-}" != "$1" ]; do shift; done\nexec "$@"\n' > $W/shims/sudo;;
      systemctl) printf '#!/bin/sh\necho "systemctl $*" >> /tmp/kaya-fresh/systemctl.log\ncase "$1" in is-active) exit 3;; esac\nexit 0\n' > $W/shims/systemctl;;
      *) printf '#!/bin/sh\necho "%s $*" >> /tmp/kaya-fresh/shim.log\nexit 0\n' $s > $W/shims/$s;;
    esac; chmod +x $W/shims/$s
  done
  (cd $ROOT && git ls-files -z --cached --others --exclude-standard | xargs -0 -I{} cp --parents {} $W/src/ 2>/dev/null) || true
  [ -f $W/src/.env ] || cp $W/src/.env.example $W/src/.env 2>/dev/null || true
}
box() { # box [--net] cmd...
  local net=(--unshare-net); [ "${1:-}" = "--net" ] && { net=(); shift; }
  bwrap --bind / / --dev-bind /dev /dev --proc /proc "${net[@]}" \
    --bind $W/usr-local /usr/local --bind $W/var-kaya /var/kaya \
    --bind $W/var-lib-kaya /var/lib/kaya --bind $W/systemd /etc/systemd/system \
    --setenv HOME $W/home --setenv PATH "$W/shims:/usr/local/bin:/usr/bin:/bin" \
    --setenv GOCACHE "$HOME/.cache/go-build" --setenv GOMODCACHE "$HOME/go/pkg/mod" --setenv GOFLAGS -mod=mod --setenv GOPROXY off \
    --chdir $W/src "$@"
}
case "${1:-}" in
  install) rm -rf $W; prep; box bash ./setup.sh --yes --no-service;;
  install-online) rm -rf $W; prep; box --net bash ./setup.sh --yes --no-service;;
  shell) shift; box --net "$@";;
  web) # web PORT: start the installed console on blank state (detached), fresh /var/kaya
    for p in $(pgrep -x kaya-web); do tr "\0" " " < /proc/$p/cmdline 2>/dev/null | grep -q -- "-port $2" && kill -9 $p; done; sleep 1
    find $W/var-kaya -mindepth 1 -delete
    (setsid "$0" shell bash -c "cd /var/kaya && exec /usr/local/bin/kaya-web -force -port $2 -dir /var/kaya > $W/web.log 2>&1" >/dev/null 2>&1 &); sleep 5
    grep -o 'Setup code: [0-9]*' $W/web.log | tail -1 | grep -o '[0-9]*$';;
  clean) rm -rf $W;;
  *) sed -n 2,6p "$0";;
esac
