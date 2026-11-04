# Developing Kaya

```bash
make build               # both binaries
go vet ./... && go test ./...
kaya dev                # an isolated instance: own directory and port
```

| Tool | Use |
|---|---|
| `scripts/tui-pty.py COLS ROWS steps.json` | Drive the terminal in a real PTY and see what a user would see |
| `scripts/phone-sim.py --host <ip>` | A simulated phone: pairs, checks auth, chat, files, push, the live connection, updates |
| `scripts/preview/console.sh start` | The console on synthetic data, with screenshots |
| `scripts/fresh-install.sh` | A clean-room install in a sandbox |

## Releasing

A release is two Linux binaries (`kaya`, `kaya-web`) for arm64 and amd64, a
`checksums.txt`, and a signature per binary. `kaya update` installs a release
only when all of that is present and the signatures verify under the key built
into the `kaya` binary; it never builds the owner's own checkout.

```bash
# add a "## [X.Y.Z]" entry to pkg/changelog/CHANGELOG.md, commit, push
make release VERSION=vX.Y.Z               # build, sign and verify into dist/vX.Y.Z
make release VERSION=vX.Y.Z PUBLISH=1     # also tag, push the tag and create the GitHub release
```

The signing key lives at `~/.config/kaya-release/release.key` (make one with
`go run ./cmd/kaya-release keygen <file>`); only its public half is in the
repository (`embeddedReleaseKeys` in `cmd/kaya/update_release.go`). Back the key
up: without it no one can publish an update that installed Pods will accept. To
rotate, ship a release signed by the old key that trusts both keys, then switch.
On a platform with no prebuilt binary the updater fetches the release tag into a
throwaway checkout and builds that.

The Kaya app is a separate repository:
[kaya-app](https://github.com/kayahq/kaya-app).

Before you change how Kaya decides what it may do, read
[the Permission Broker](PERMISSION-BROKER.md) and [How Kaya works](README.md).
