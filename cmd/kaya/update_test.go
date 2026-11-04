package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRenderUnitMatchesTheInstalledShape(t *testing.T) {
	got := renderUnit("User=__USER__\nExecStart=__BIN_DIR__/kaya serve\nWorkingDirectory=__KAYA_DIR__\n", "/usr/local/bin")
	want := "User=root\nExecStart=/usr/local/bin/kaya serve\nWorkingDirectory=/var/kaya\n"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestRemoveStaleShadowsOnlyRemovesKaya(t *testing.T) {
	canon := t.TempDir()
	stale, other := t.TempDir(), t.TempDir()
	os.WriteFile(filepath.Join(stale, "kaya"), []byte("...👻 Kaya - Your Local AI..."), 0o755)
	os.WriteFile(filepath.Join(other, "kaya"), []byte("a different program named kaya"), 0o755)
	removeStaleShadows(canon, []string{stale, other, canon})
	if _, err := os.Stat(filepath.Join(stale, "kaya")); !os.IsNotExist(err) {
		t.Fatal("a stale Kaya earlier in PATH must be removed")
	}
	if _, err := os.Stat(filepath.Join(other, "kaya")); err != nil {
		t.Fatal("an unrelated program called kaya must never be touched")
	}
}
