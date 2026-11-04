package appliance

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/ianclemence/kaya/pkg/kayastate"
)

// PreUpdateSnapshot takes a recovery snapshot of the personal AI
// workspace before any mutating update step. It is the Snapshot stage
// of RunUpdate: failure aborts the update while services still run.
// Secrets are included — a recovery point without credentials restores
// a lobotomized Kaya — sealed under the existing vault key.
func PreUpdateSnapshot() error {
	workspace := os.Getenv("KAYA_WORKSPACE_DIR")
	if workspace == "" {
		workspace = DefaultWorkspaceDir
	}
	configPath := filepath.Join(DefaultKayaDir, "config", "config.json")
	dest, removed, err := kayastate.SnapshotAndPrune(workspace, configPath, kayastate.SnapshotKeep)
	if err != nil {
		return err
	}
	fmt.Printf("  Recovery snapshot: %s\n", dest)
	for _, r := range removed {
		fmt.Printf("  Pruned old snapshot: %s\n", r)
	}
	return nil
}
