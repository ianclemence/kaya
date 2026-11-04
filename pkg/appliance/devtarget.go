package appliance

import (
	"fmt"
	"path/filepath"
	"strconv"
)

// DefaultBinDir is the single canonical directory the `kaya` binary is
// installed to. Every service ExecStart and every documented install path uses
// it; a second copy elsewhere on PATH is what caused updates to appear not to
// take.
const DefaultBinDir = "/usr/local/bin"

// Development vs production separation.
//
// A Kaya source checkout and an installed Kaya must never share a config,
// workspace, or database, or prototype work silently reaches production. The
// dev target is a fully isolated instance rooted at a dev directory with its
// own config, workspace, data, and port. `kaya dev` runs the checkout against
// this target; `kaya update` deploys tagged releases to the production target
// (/var/kaya). The two never touch each other.

// Dev environment defaults. Overridable by env so a developer can place the
// instance anywhere.
const (
	DefaultDevKayaDir = ".kaya-dev"
	DefaultDevPort     = 8877
)

// DevTarget describes an isolated development instance.
type DevTarget struct {
	KayaDir  string
	ConfigDir string
	Workspace string
	DataDir   string
	Port      int
}

// ResolveDevTarget computes the isolated dev paths for a checkout rooted at
// home (the user's home directory) and a requested port. An empty port uses
// KAYA_DEV_PORT if set, else DefaultDevPort. It deliberately does NOT consult
// KAYA_API_PORT: the production .env sets that to the production port, and a
// dev instance must never collide with production. It performs no I/O so it is
// fully testable.
//
// Precedence for the dev root: KAYA_DEV_DIR env, else home/.kaya-dev.
func ResolveDevTarget(getenv func(string) string, home string, port int) DevTarget {
	root := getenv("KAYA_DEV_DIR")
	if root == "" {
		root = filepath.Join(home, DefaultDevKayaDir)
	}
	if !filepath.IsAbs(root) {
		root = filepath.Join(home, root)
	}
	if port <= 0 {
		if p := getenv("KAYA_DEV_PORT"); p != "" {
			if n, err := strconv.Atoi(p); err == nil && n > 0 {
				port = n
			}
		}
	}
	if port <= 0 {
		port = DefaultDevPort
	}
	return DevTarget{
		KayaDir:  root,
		ConfigDir: filepath.Join(root, "config"),
		Workspace: filepath.Join(root, "workspace"),
		DataDir:   filepath.Join(root, "data"),
		Port:      port,
	}
}

// ConflictsWithProduction reports whether the dev target would operate on the
// same directory as the installed Kaya. It is the safety check behind
// `kaya dev`: a dev instance must never point at /var/kaya.
func (t DevTarget) ConflictsWithProduction() bool {
	return cleanAbs(t.KayaDir) == cleanAbs(DefaultKayaDir) ||
		cleanAbs(t.ConfigDir) == cleanAbs(DefaultConfigDir) ||
		cleanAbs(t.Workspace) == cleanAbs(DefaultWorkspaceDir)
}

func cleanAbs(p string) string {
	if p == "" {
		return ""
	}
	if abs, err := filepath.Abs(p); err == nil {
		p = abs
	}
	return filepath.Clean(p)
}

// Describe renders a short human summary for the `kaya dev` banner.
func (t DevTarget) Describe() string {
	return fmt.Sprintf("dir=%s port=%d", t.KayaDir, t.Port)
}
