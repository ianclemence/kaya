package appliance

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/kayahq/kaya/pkg/config"
)

func TestPlanWorkspaceMigration(t *testing.T) {
	cases := []struct {
		name           string
		current        string
		legacy         string
		target         string
		wantNeeded     bool
		wantRewriteCfg bool
	}{
		{name: "legacy layout needs migration", current: "/var/kaya/workspace", legacy: "/var/kaya/workspace", target: "/var/lib/kaya/workspace", wantNeeded: true, wantRewriteCfg: true},
		{name: "already at target", current: "/var/lib/kaya/workspace", legacy: "/var/kaya/workspace", target: "/var/lib/kaya/workspace"},
		{name: "custom location untouched", current: "/home/user/data", legacy: "/var/kaya/workspace", target: "/var/lib/kaya/workspace"},
		{name: "no configured workspace", current: "", legacy: "/var/kaya/workspace", target: "/var/lib/kaya/workspace"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			p := PlanWorkspaceMigration(tc.current, tc.legacy, tc.target)
			if p.Needed != tc.wantNeeded {
				t.Errorf("Needed = %v, want %v (reason: %s)", p.Needed, tc.wantNeeded, p.Reason)
			}
			if p.RewriteConfig != tc.wantRewriteCfg {
				t.Errorf("RewriteConfig = %v, want %v", p.RewriteConfig, tc.wantRewriteCfg)
			}
		})
	}
}

func TestApplyWorkspaceMigration(t *testing.T) {
	root := t.TempDir()
	kayaDir := filepath.Join(root, "kaya")
	legacy := filepath.Join(kayaDir, "workspace")
	target := filepath.Join(root, "runtime", "workspace")

	// Build a legacy layout with runtime state.
	os.MkdirAll(filepath.Join(legacy, "memory"), 0755)
	os.MkdirAll(filepath.Join(legacy, "skills"), 0755)
	os.WriteFile(filepath.Join(legacy, "kaya.db"), []byte("sqlite"), 0644)
	os.WriteFile(filepath.Join(legacy, "memory", "note.txt"), []byte("hello"), 0644)

	// Config pointing at the legacy workspace.
	cfg := config.DefaultConfig()
	cfg.Agents.Defaults.Workspace = legacy
	os.MkdirAll(filepath.Join(kayaDir, "config"), 0755)
	configPath := filepath.Join(kayaDir, "config", "config.json")
	if err := config.SaveConfig(configPath, cfg); err != nil {
		t.Fatal(err)
	}

	// Env pointing into the legacy workspace.
	envPath := filepath.Join(kayaDir, ".env")
	env := "KAYA_DB_PATH=" + filepath.Join(legacy, "kaya.db") + "\nMEMORY_DIR=" + filepath.Join(legacy, "memory") + "\nTZ=UTC\n"
	if err := os.WriteFile(envPath, []byte(env), 0600); err != nil {
		t.Fatal(err)
	}

	plan := &WorkspaceMigrationPlan{
		LegacyDir:       legacy,
		TargetDir:       target,
		ConfigPath:      configPath,
		EnvPath:         envPath,
		ConfigWorkspace: legacy,
		Needed:          true,
		RewriteConfig:   true,
		RewriteEnv:      true,
	}
	if err := ApplyWorkspaceMigration(plan); err != nil {
		t.Fatal(err)
	}

	// Data moved, legacy gone.
	if _, err := os.Stat(filepath.Join(target, "kaya.db")); err != nil {
		t.Errorf("target kaya.db missing: %v", err)
	}
	if _, err := os.Stat(filepath.Join(target, "memory", "note.txt")); err != nil {
		t.Errorf("target memory/note.txt missing: %v", err)
	}
	if _, err := os.Stat(filepath.Join(legacy, "kaya.db")); !os.IsNotExist(err) {
		t.Errorf("legacy kaya.db should be gone, got %v", err)
	}

	// Config rewritten.
	reloaded, err := config.LoadConfig(configPath)
	if err != nil {
		t.Fatal(err)
	}
	if reloaded.WorkspacePath() != target {
		t.Errorf("config workspace = %s, want %s", reloaded.WorkspacePath(), target)
	}

	// Env rewritten.
	envB, err := os.ReadFile(envPath)
	if err != nil {
		t.Fatal(err)
	}
	got := string(envB)
	if want := "KAYA_DB_PATH=" + filepath.Join(target, "kaya.db"); !containsLine(got, want) {
		t.Errorf("env missing %q in:\n%s", want, got)
	}
	if want := "MEMORY_DIR=" + filepath.Join(target, "memory"); !containsLine(got, want) {
		t.Errorf("env missing %q in:\n%s", want, got)
	}
}

func TestApplyWorkspaceMigrationNoOpWhenNotNeeded(t *testing.T) {
	plan := &WorkspaceMigrationPlan{Needed: false}
	if err := ApplyWorkspaceMigration(plan); err != nil {
		t.Fatalf("no-op migration should succeed, got %v", err)
	}
}

func TestMigrateWorkspaceIfNeededRefusesNonEmptyTarget(t *testing.T) {
	root := t.TempDir()
	kayaDir := filepath.Join(root, "kaya")
	legacy := filepath.Join(kayaDir, "workspace")
	target := filepath.Join(root, "runtime", "workspace")

	cfg := config.DefaultConfig()
	cfg.Agents.Defaults.Workspace = legacy
	os.MkdirAll(filepath.Join(kayaDir, "config"), 0755)
	os.MkdirAll(legacy, 0755)
	os.WriteFile(filepath.Join(legacy, "data.txt"), []byte("x"), 0644)
	if err := config.SaveConfig(filepath.Join(kayaDir, "config", "config.json"), cfg); err != nil {
		t.Fatal(err)
	}
	os.MkdirAll(target, 0755)
	os.WriteFile(filepath.Join(target, "existing.txt"), []byte("y"), 0644)
	t.Setenv("KAYA_WORKSPACE_DIR", target)

	if _, err := MigrateWorkspaceIfNeeded(kayaDir); err == nil {
		t.Fatal("expected error when target is not empty")
	}
}

func TestMigrateWorkspaceIfNeededMovesLegacyLayout(t *testing.T) {
	root := t.TempDir()
	kayaDir := filepath.Join(root, "kaya")
	legacy := filepath.Join(kayaDir, "workspace")
	target := filepath.Join(root, "runtime", "workspace")
	t.Setenv("KAYA_WORKSPACE_DIR", target)

	cfg := config.DefaultConfig()
	cfg.Agents.Defaults.Workspace = legacy
	os.MkdirAll(filepath.Join(legacy, "skills"), 0755)
	os.WriteFile(filepath.Join(legacy, "skills", "SKILL.md"), []byte("x"), 0644)
	os.MkdirAll(filepath.Join(kayaDir, "config"), 0755)
	if err := config.SaveConfig(filepath.Join(kayaDir, "config", "config.json"), cfg); err != nil {
		t.Fatal(err)
	}

	newWorkspace, err := MigrateWorkspaceIfNeeded(kayaDir)
	if err != nil {
		t.Fatal(err)
	}
	if newWorkspace != target {
		t.Errorf("new workspace = %s, want %s", newWorkspace, target)
	}
	if _, err := os.Stat(filepath.Join(target, "skills", "SKILL.md")); err != nil {
		t.Errorf("migrated skill missing: %v", err)
	}
	if _, err := os.Stat(legacy); !os.IsNotExist(err) {
		t.Errorf("legacy workspace should be gone, got %v", err)
	}
}

func TestMigrateWorkspaceIfNeededIdempotent(t *testing.T) {
	root := t.TempDir()
	kayaDir := filepath.Join(root, "kaya")
	target := filepath.Join(root, "runtime", "workspace")
	t.Setenv("KAYA_WORKSPACE_DIR", target)

	cfg := config.DefaultConfig()
	cfg.Agents.Defaults.Workspace = target
	os.MkdirAll(target, 0755)
	os.MkdirAll(filepath.Join(kayaDir, "config"), 0755)
	if err := config.SaveConfig(filepath.Join(kayaDir, "config", "config.json"), cfg); err != nil {
		t.Fatal(err)
	}

	newWorkspace, err := MigrateWorkspaceIfNeeded(kayaDir)
	if err != nil {
		t.Fatal(err)
	}
	if newWorkspace != "" {
		t.Errorf("expected no-op, got migration to %s", newWorkspace)
	}
}

func TestRewriteEnvWorkspaceIgnoresUnrelatedValues(t *testing.T) {
	root := t.TempDir()
	envPath := filepath.Join(root, ".env")
	env := "KAYA_DB_PATH=/elsewhere/workspace/kaya.db\nANTHROPIC_API_KEY=sk-ant-x\n"
	if err := os.WriteFile(envPath, []byte(env), 0600); err != nil {
		t.Fatal(err)
	}
	if err := rewriteEnvWorkspace(envPath, "/var/kaya/workspace", "/var/lib/kaya/workspace"); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(envPath)
	if got := string(b); got != env {
		t.Errorf("env should be untouched, got:\n%s", got)
	}
}

func containsLine(haystack, needle string) bool {
	for _, ln := range lineSplit(haystack) {
		if ln == needle {
			return true
		}
	}
	return false
}

func lineSplit(s string) []string {
	var out []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			out = append(out, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		out = append(out, s[start:])
	}
	return out
}
