package appliance

import (
	"path/filepath"
	"testing"
)

func TestResolveDevTargetDefaults(t *testing.T) {
	noenv := func(string) string { return "" }
	got := ResolveDevTarget(noenv, "/home/dev", 0)
	if got.KayaDir != "/home/dev/.kaya-dev" {
		t.Errorf("kaya dir = %q", got.KayaDir)
	}
	if got.ConfigDir != "/home/dev/.kaya-dev/config" {
		t.Errorf("config dir = %q", got.ConfigDir)
	}
	if got.Workspace != "/home/dev/.kaya-dev/workspace" {
		t.Errorf("workspace = %q", got.Workspace)
	}
	if got.Port != DefaultDevPort {
		t.Errorf("port = %d, want %d", got.Port, DefaultDevPort)
	}
}

func TestResolveDevTargetEnvOverrides(t *testing.T) {
	env := func(k string) string {
		switch k {
		case "KAYA_DEV_DIR":
			return "/srv/dev-kaya"
		case "KAYA_DEV_PORT":
			return "9999"
		}
		return ""
	}
	got := ResolveDevTarget(env, "/home/dev", 0)
	if got.KayaDir != "/srv/dev-kaya" {
		t.Errorf("kaya dir = %q", got.KayaDir)
	}
	if got.Port != 9999 {
		t.Errorf("port = %d, want 9999", got.Port)
	}
}

func TestResolveDevTargetExplicitPortWins(t *testing.T) {
	env := func(k string) string {
		if k == "KAYA_DEV_PORT" {
			return "9999"
		}
		return ""
	}
	got := ResolveDevTarget(env, "/home/dev", 1234)
	if got.Port != 1234 {
		t.Errorf("explicit port must win, got %d", got.Port)
	}
}

// A dev instance must never adopt the production port from the production
// .env (KAYA_API_PORT=8766); it uses its own dev port instead.
func TestResolveDevTargetIgnoresProductionPort(t *testing.T) {
	env := func(k string) string {
		if k == "KAYA_API_PORT" {
			return "8766"
		}
		return ""
	}
	got := ResolveDevTarget(env, "/home/dev", 0)
	if got.Port != DefaultDevPort {
		t.Errorf("dev must ignore KAYA_API_PORT; port = %d, want %d", got.Port, DefaultDevPort)
	}
}

func TestResolveDevTargetRelativeEnvIsAnchoredToHome(t *testing.T) {
	env := func(k string) string {
		if k == "KAYA_DEV_DIR" {
			return "dev-instance"
		}
		return ""
	}
	got := ResolveDevTarget(env, "/home/dev", 0)
	if got.KayaDir != "/home/dev/dev-instance" {
		t.Errorf("relative dev dir must anchor to home, got %q", got.KayaDir)
	}
}

// The dev target must never resolve onto the production paths — that is the
// whole point of the separation.
func TestDevTargetConflictsWithProduction(t *testing.T) {
	safe := DevTarget{KayaDir: "/home/dev/.kaya-dev", ConfigDir: "/home/dev/.kaya-dev/config", Workspace: "/home/dev/.kaya-dev/workspace"}
	if safe.ConflictsWithProduction() {
		t.Errorf("a normal dev target must not conflict with production")
	}
	bad := DevTarget{KayaDir: DefaultKayaDir}
	if !bad.ConflictsWithProduction() {
		t.Errorf("a dev target pointing at %s MUST be rejected", DefaultKayaDir)
	}
	badCfg := DevTarget{KayaDir: "/tmp/x", ConfigDir: DefaultConfigDir}
	if !badCfg.ConflictsWithProduction() {
		t.Errorf("overlapping config dir with production MUST be rejected")
	}
	badWs := DevTarget{KayaDir: "/tmp/x", Workspace: filepath.Clean(DefaultWorkspaceDir)}
	if !badWs.ConflictsWithProduction() {
		t.Errorf("overlapping workspace with production MUST be rejected")
	}
}
