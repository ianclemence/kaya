package doctor

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/ianclemence/kaya/pkg/appliance"
)

// checkBinaries warns when a stale `kaya` binary earlier in PATH shadows the
// one that was actually installed. This is a real, recurring failure here:
// `kaya update` installs to /usr/local/bin, but ~/.local/bin usually comes
// first in PATH, so a stale copy there keeps running the old build after an
// update. The check makes that visible instead of leaving the operator to
// wonder why an update "didn't take".
func (d *Doctor) checkBinaries(ctx context.Context) CheckResult {
	start := time.Now()
	pathEnv := os.Getenv("PATH")
	bins := appliance.FindKayaBinaries(pathEnv, findExecutable)
	if len(bins) < 2 {
		// One binary is the normal case: report nothing rather than a
		// permanent "inventory" row (diagnostics is health, not inventory).
		return CheckResult{Name: "binaries", Label: "Troubleshooting", Status: "info", Latency: time.Since(start).Milliseconds()}
	}

	shadow, ok := appliance.DetectBinaryShadow(bins, func(p string) string {
		return kayaVersionAt(ctx, p)
	})
	if !ok {
		// Matching duplicates are harmless; say nothing.
		return CheckResult{Name: "binaries", Label: "Troubleshooting", Status: "info", Latency: time.Since(start).Milliseconds()}
	}

	return CheckResult{
		Name:   "binaries",
		Label:  "Troubleshooting",
		Status: "warning",
		Message: "An out-of-date Kaya is shadowing the installed one: " +
			shadow.Wins + " (" + shadow.WinsVersion + ") runs instead of " +
			shadow.Shadows + " (" + shadow.ShadowsVersion + "). " +
			"There should be exactly one `kaya`, at " + appliance.DefaultBinDir + ". " +
			"Fix it now with `sudo kaya update` (which removes the stale copy) or " +
			"`sudo rm " + shadow.Wins + "`.",
		Latency: time.Since(start).Milliseconds(),
	}
}

// findExecutable resolves name within dir, mirroring the parts of
// exec.LookPath we need (executable bit checked by the OS on execution; here
// we require a regular file).
func findExecutable(dir, name string) (string, bool) {
	p := filepath.Join(dir, name)
	info, err := os.Stat(p)
	if err != nil || info.IsDir() {
		return "", false
	}
	if info.Mode()&0o111 == 0 {
		return "", false
	}
	return p, true
}

// kayaVersionAt runs `<path> version` and extracts the version token. It is
// bounded and best-effort: an unreadable or hung binary yields "" (unknown),
// which Detects a shadow only when there is a real difference.
func kayaVersionAt(ctx context.Context, path string) string {
	cctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	out, err := exec.CommandContext(cctx, path, "version").Output()
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "👻 Kaya ") {
			v := strings.TrimSpace(strings.TrimPrefix(line, "👻 Kaya "))
			// "vX.Y.Z (git: abc1234)" -> keep the version, drop the parenthetical
			// for a readable message; the full string still differs between builds.
			if i := strings.Index(v, " ("); i > 0 {
				v = v[:i]
			}
			return v
		}
	}
	return ""
}
