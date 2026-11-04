package appliance

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNeedsSetup_NoFlagNoConfig(t *testing.T) {
	tmpDir := t.TempDir()
	fb := &SetupState{
		KayaDir:   filepath.Join(tmpDir, "kaya"),
		ConfigDir:  filepath.Join(tmpDir, "kaya", "config"),
		DataDir:    filepath.Join(tmpDir, "kaya", "data"),
		Workspace:  filepath.Join(tmpDir, "kaya", "workspace"),
		ConfigPath: filepath.Join(tmpDir, "kaya", "config", "config.json"),
		EnvPath:    filepath.Join(tmpDir, "kaya", ".env"),
	}

	if !fb.NeedsSetup() {
		t.Fatal("expected setup when no flag and no config")
	}
}

func TestNeedsSetup_WithFlag(t *testing.T) {
	tmpDir := t.TempDir()
	kayaDir := filepath.Join(tmpDir, "kaya")
	os.MkdirAll(kayaDir, 0755)
	os.WriteFile(filepath.Join(kayaDir, SetupCompleteFlag), []byte("done"), 0644)

	fb := &SetupState{
		KayaDir:   kayaDir,
		ConfigDir:  filepath.Join(kayaDir, "config"),
		DataDir:    filepath.Join(kayaDir, "data"),
		Workspace:  filepath.Join(kayaDir, "workspace"),
		ConfigPath: filepath.Join(kayaDir, "config", "config.json"),
		EnvPath:    filepath.Join(kayaDir, ".env"),
	}

	if fb.NeedsSetup() {
		t.Fatal("expected NOT setup when flag exists")
	}
}

func TestMarkSetupComplete(t *testing.T) {
	tmpDir := t.TempDir()
	kayaDir := filepath.Join(tmpDir, "kaya")
	os.MkdirAll(kayaDir, 0755)

	fb := &SetupState{
		KayaDir:   kayaDir,
		ConfigDir:  filepath.Join(kayaDir, "config"),
		DataDir:    filepath.Join(kayaDir, "data"),
		Workspace:  filepath.Join(kayaDir, "workspace"),
		ConfigPath: filepath.Join(kayaDir, "config", "config.json"),
		EnvPath:    filepath.Join(kayaDir, ".env"),
	}

	if err := fb.MarkSetupComplete(); err != nil {
		t.Fatalf("MarkSetupComplete failed: %v", err)
	}

	flagPath := filepath.Join(kayaDir, SetupCompleteFlag)
	if _, err := os.Stat(flagPath); os.IsNotExist(err) {
		t.Fatal("setup-complete flag was not created")
	}

	if fb.NeedsSetup() {
		t.Fatal("NeedsSetup should return false after MarkSetupComplete")
	}
}

func TestResetSetup(t *testing.T) {
	tmpDir := t.TempDir()
	kayaDir := filepath.Join(tmpDir, "kaya")
	os.MkdirAll(kayaDir, 0755)

	fb := &SetupState{
		KayaDir:   kayaDir,
		ConfigDir:  filepath.Join(kayaDir, "config"),
		DataDir:    filepath.Join(kayaDir, "data"),
		Workspace:  filepath.Join(kayaDir, "workspace"),
		ConfigPath: filepath.Join(kayaDir, "config", "config.json"),
		EnvPath:    filepath.Join(kayaDir, ".env"),
	}

	fb.MarkSetupComplete()
	if fb.NeedsSetup() {
		t.Fatal("expected NOT setup after mark")
	}

	fb.ResetSetup()
	if !fb.NeedsSetup() {
		t.Fatal("expected setup after reset")
	}
}

func TestEnsureDirectories(t *testing.T) {
	tmpDir := t.TempDir()
	kayaDir := filepath.Join(tmpDir, "kaya")

	fb := &SetupState{
		KayaDir:   kayaDir,
		ConfigDir:  filepath.Join(kayaDir, "config"),
		DataDir:    filepath.Join(kayaDir, "data"),
		Workspace:  filepath.Join(kayaDir, "workspace"),
		ConfigPath: filepath.Join(kayaDir, "config", "config.json"),
		EnvPath:    filepath.Join(kayaDir, ".env"),
	}

	if err := fb.EnsureDirectories(); err != nil {
		t.Fatalf("EnsureDirectories failed: %v", err)
	}

	requiredDirs := []string{
		kayaDir,
		filepath.Join(kayaDir, "config"),
		filepath.Join(kayaDir, "data"),
		filepath.Join(kayaDir, "workspace"),
		filepath.Join(kayaDir, "workspace", "skills"),
		filepath.Join(kayaDir, "workspace", "memory"),
	}

	for _, dir := range requiredDirs {
		if _, err := os.Stat(dir); os.IsNotExist(err) {
			t.Errorf("directory not created: %s", dir)
		}
	}
}

func TestSetupCompleteTransition(t *testing.T) {
	tmpDir := t.TempDir()
	kayaDir := filepath.Join(tmpDir, "kaya")

	fb := &SetupState{
		KayaDir:   kayaDir,
		ConfigDir:  filepath.Join(kayaDir, "config"),
		DataDir:    filepath.Join(kayaDir, "data"),
		Workspace:  filepath.Join(kayaDir, "workspace"),
		ConfigPath: filepath.Join(kayaDir, "config", "config.json"),
		EnvPath:    filepath.Join(kayaDir, ".env"),
	}

	fb.EnsureDirectories()

	if !fb.NeedsSetup() {
		t.Fatal("expected setup initially")
	}

	fb.MarkSetupComplete()

	if fb.NeedsSetup() {
		t.Fatal("expected NOT setup after setup complete")
	}

	flagPath := filepath.Join(kayaDir, SetupCompleteFlag)
	data, err := os.ReadFile(flagPath)
	if err != nil {
		t.Fatalf("failed to read flag: %v", err)
	}
	if len(data) == 0 {
		t.Fatal("flag file is empty")
	}
}

func TestSetupCompleteIdempotent(t *testing.T) {
	tmpDir := t.TempDir()
	kayaDir := filepath.Join(tmpDir, "kaya")
	os.MkdirAll(kayaDir, 0755)

	fb := &SetupState{
		KayaDir:   kayaDir,
		ConfigDir:  filepath.Join(kayaDir, "config"),
		DataDir:    filepath.Join(kayaDir, "data"),
		Workspace:  filepath.Join(kayaDir, "workspace"),
		ConfigPath: filepath.Join(kayaDir, "config", "config.json"),
		EnvPath:    filepath.Join(kayaDir, ".env"),
	}

	fb.MarkSetupComplete()
	fb.MarkSetupComplete()

	if fb.NeedsSetup() {
		t.Fatal("expected NOT setup after double mark")
	}
}

func TestSetupCodeLifecycle(t *testing.T) {
	fb := &SetupState{KayaDir: t.TempDir()}

	if fb.VerifySetupCode("000000") {
		t.Fatal("no code file must never verify")
	}

	code, err := fb.RotateSetupCode()
	if err != nil {
		t.Fatal(err)
	}
	if len(code) != 6 {
		t.Fatalf("expected a 6-digit code, got %q", code)
	}
	if !fb.VerifySetupCode(code) {
		t.Fatal("the minted code must verify")
	}
	if fb.VerifySetupCode(code + "0") {
		t.Fatal("a longer code must not verify")
	}
	if fb.VerifySetupCode("") {
		t.Fatal("an empty code must not verify")
	}

	// Rotation invalidates the previous code (barring a 1-in-10^6 collision).
	next, err := fb.RotateSetupCode()
	if err != nil {
		t.Fatal(err)
	}
	if next != code && fb.VerifySetupCode(code) {
		t.Fatal("rotation must invalidate the previous code")
	}
	if !fb.VerifySetupCode(next) {
		t.Fatal("the rotated code must verify")
	}

	fb.ClearSetupCode()
	if fb.VerifySetupCode(next) {
		t.Fatal("a cleared code must not verify")
	}
}

// A Pod with no screen: the code is readable from the SD card, a factory can
// preset one, and finishing setup removes it.
func TestSetupCodeOnTheBootPartition(t *testing.T) {
	dir := t.TempDir()
	boot := filepath.Join(t.TempDir(), "firmware")
	os.MkdirAll(boot, 0o755)
	old := bootCodePaths
	bootCodePaths = []string{filepath.Join(boot, "kaya-setup-code")}
	defer func() { bootCodePaths = old }()
	fb := &SetupState{KayaDir: dir}

	// Generated: mirrored to the card, marked as generated, and replaced on restart.
	code1, err := fb.RotateSetupCode()
	if err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(bootCodePaths[0])
	if !strings.HasPrefix(string(b), code1+"\n# generated") {
		t.Fatalf("the generated code must be readable on the card: %q", b)
	}
	code2, _ := fb.RotateSetupCode()
	if code2 == code1 && len(code1) == 6 {
		t.Log("(same random code twice is possible but unlikely)")
	}
	if !fb.VerifySetupCode(code2) {
		t.Fatal("the current code must verify")
	}

	// Factory: a fixed code survives restarts.
	os.WriteFile(bootCodePaths[0], []byte("K7X9-Q2MP\n"), 0o644)
	for i := 0; i < 2; i++ {
		got, _ := fb.RotateSetupCode()
		if got != "K7X9-Q2MP" || !fb.VerifySetupCode("K7X9-Q2MP") {
			t.Fatalf("a factory code is fixed, got %q", got)
		}
	}
	// A junk file is ignored rather than trusted.
	os.WriteFile(bootCodePaths[0], []byte("no\n"), 0o644)
	if got, _ := fb.RotateSetupCode(); got == "no" {
		t.Fatal("an invalid factory code must be ignored")
	}

	fb.ClearSetupCode()
	if _, err := os.Stat(bootCodePaths[0]); !os.IsNotExist(err) {
		t.Fatal("finishing setup removes the code from the card")
	}
}
