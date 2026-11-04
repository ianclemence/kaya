package voice

import (
	"os"
	"path/filepath"
	"testing"
)

func TestVerifySHA256(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "artifact.bin")
	if err := os.WriteFile(f, []byte("kaya-artifact"), 0600); err != nil {
		t.Fatal(err)
	}
	// sha256 of "kaya-artifact"
	good := "df00b5bfac0e17d27b38fcacf4e481540264a051d9c6ea4167cc740f0eb834c6"
	if err := verifySHA256(f, good); err != nil {
		t.Fatalf("matching digest must pass: %v", err)
	}
	if err := verifySHA256(f, "0000000000000000000000000000000000000000000000000000000000000000"); err == nil {
		t.Fatal("mismatching digest must fail")
	}
	if err := verifySHA256(f, ""); err != nil {
		t.Fatalf("empty digest must skip: %v", err)
	}
	if err := verifySHA256(filepath.Join(dir, "missing"), good); err == nil {
		t.Fatal("missing file must fail")
	}
}
