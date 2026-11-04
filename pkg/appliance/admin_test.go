package appliance

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSetAndVerifyAdminPassword(t *testing.T) {
	kayaDir := filepath.Join(t.TempDir(), "kaya")

	if AdminConfigured(kayaDir) {
		t.Fatal("admin should not be configured before SetAdminPassword")
	}

	ok, err := VerifyAdminPassword(kayaDir, "my-valid-pass-123")
	if err != nil {
		t.Fatalf("VerifyAdminPassword before set failed: %v", err)
	}
	if ok {
		t.Fatal("VerifyAdminPassword should be false before any password is set")
	}

	if err := SetAdminPassword(kayaDir, "my-valid-pass-123"); err != nil {
		t.Fatalf("SetAdminPassword failed: %v", err)
	}

	if !AdminConfigured(kayaDir) {
		t.Fatal("admin should be configured after SetAdminPassword")
	}

	ok, err = VerifyAdminPassword(kayaDir, "my-valid-pass-123")
	if err != nil {
		t.Fatalf("VerifyAdminPassword failed: %v", err)
	}
	if !ok {
		t.Fatal("correct password should verify")
	}

	ok, err = VerifyAdminPassword(kayaDir, "wrong-password")
	if err != nil {
		t.Fatalf("VerifyAdminPassword failed: %v", err)
	}
	if ok {
		t.Fatal("wrong password should not verify")
	}
}

func TestSetAdminPasswordEmpty(t *testing.T) {
	if err := SetAdminPassword(t.TempDir(), ""); err == nil {
		t.Fatal("expected error for empty password")
	}
}

func TestAdminHashFilePermissions(t *testing.T) {
	kayaDir := filepath.Join(t.TempDir(), "kaya")
	if err := SetAdminPassword(kayaDir, "my-valid-pass-123"); err != nil {
		t.Fatalf("SetAdminPassword failed: %v", err)
	}

	info, err := os.Stat(AdminHashPath(kayaDir))
	if err != nil {
		t.Fatalf("failed to stat admin hash: %v", err)
	}
	if perm := info.Mode().Perm(); perm != 0600 {
		t.Fatalf("admin hash should be 0600, got %o", perm)
	}
}

func TestSetAdminPasswordReplacesHash(t *testing.T) {
	kayaDir := filepath.Join(t.TempDir(), "kaya")
	if err := SetAdminPassword(kayaDir, "first-pass-word"); err != nil {
		t.Fatalf("SetAdminPassword failed: %v", err)
	}

	if ok, _ := VerifyAdminPassword(kayaDir, "second-pass-word"); ok {
		t.Fatal("old password should not verify yet")
	}

	if err := SetAdminPassword(kayaDir, "second-pass-word"); err != nil {
		t.Fatalf("second SetAdminPassword failed: %v", err)
	}

	if ok, _ := VerifyAdminPassword(kayaDir, "first-pass-word"); ok {
		t.Fatal("first password should no longer verify after replacement")
	}
	if ok, _ := VerifyAdminPassword(kayaDir, "second-pass-word"); !ok {
		t.Fatal("replacement password should verify")
	}
}

func TestRemoveAdminPassword(t *testing.T) {
	kayaDir := filepath.Join(t.TempDir(), "kaya")

	// Removing when nothing is configured should be a no-op, not an error.
	if err := RemoveAdminPassword(kayaDir); err != nil {
		t.Fatalf("RemoveAdminPassword on unconfigured dir failed: %v", err)
	}

	if err := SetAdminPassword(kayaDir, "my-valid-pass-123"); err != nil {
		t.Fatalf("SetAdminPassword failed: %v", err)
	}
	if !AdminConfigured(kayaDir) {
		t.Fatal("admin should be configured after SetAdminPassword")
	}

	if err := RemoveAdminPassword(kayaDir); err != nil {
		t.Fatalf("RemoveAdminPassword failed: %v", err)
	}
	if AdminConfigured(kayaDir) {
		t.Fatal("admin should not be configured after RemoveAdminPassword")
	}
	if LoadAdminMeta(kayaDir) != nil {
		t.Fatal("admin metadata should be removed too")
	}
	if ok, _ := VerifyAdminPassword(kayaDir, "my-valid-pass-123"); ok {
		t.Fatal("password should no longer verify after removal")
	}
}
