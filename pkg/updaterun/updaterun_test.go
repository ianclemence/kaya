package updaterun

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func fakeKaya(t *testing.T, body string) string {
	t.Helper()
	dir := t.TempDir()
	bin := filepath.Join(dir, "kaya")
	os.WriteFile(bin, []byte("#!/bin/sh\n"+body+"\n"), 0755)
	t.Setenv("KAYA_BIN", bin)
	t.Setenv("KAYA_DIR", dir)
	return dir
}

func waitFor(t *testing.T, cond func() bool) {
	t.Helper()
	for i := 0; i < 100; i++ {
		if cond() {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatal("timed out waiting")
}

func TestDetachedUpdateReportsSuccess(t *testing.T) {
	fakeKaya(t, `echo "installing $1"; exit 0`)
	if err := startWithoutSystemd(); err != nil {
		t.Fatal(err)
	}
	waitFor(t, func() bool { return DetachedUpdateStatus().Success })
	p := DetachedUpdateStatus()
	if p.Running || !strings.Contains(p.Log, "installing update") {
		t.Fatalf("unexpected progress: %+v", p)
	}
}

func TestDetachedUpdateReportsFailureWithoutGuessing(t *testing.T) {
	fakeKaya(t, `echo "build broke"; exit 3`)
	if err := startWithoutSystemd(); err != nil {
		t.Fatal(err)
	}
	waitFor(t, func() bool { return strings.Contains(DetachedUpdateStatus().Log, "Update failed.") })
	if p := DetachedUpdateStatus(); p.Success || p.Running {
		t.Fatalf("a failed update must not read as success or running: %+v", p)
	}
}

func TestUpdateScriptQuotesTheBinaryPath(t *testing.T) {
	if s := updateScript("/opt/it's here/kaya"); !strings.Contains(s, `'/opt/it'\''s here/kaya' update`) {
		t.Fatalf("binary path not safely quoted: %s", s)
	}
}
